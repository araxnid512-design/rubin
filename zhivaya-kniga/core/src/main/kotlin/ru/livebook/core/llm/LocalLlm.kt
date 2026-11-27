package ru.livebook.core.llm

import java.io.DataInputStream
import java.io.File
import java.io.FileInputStream
import java.io.BufferedInputStream
import java.io.InputStream
import java.security.MessageDigest

data class GenParams(
    val maxTokens: Int = 110,
    val temp: Float = 0.45f,
    val topP: Float = 0.8f,
    val topK: Int = 20,
    val repeatPenalty: Float = 1.1f,
    val seed: Int = -1,
    val grammar: String? = null,
    /** Текст прошлой сцены: его слова штрафуются при выборе токенов, чтобы модель не повторялась. */
    val avoid: String? = null,
)

data class GenStats(
    val promptTokens: Int = 0, val reusedTokens: Int = 0, val genTokens: Int = 0,
    val promptMs: Double = 0.0, val ttftMs: Double = 0.0, val genMs: Double = 0.0, val stopReason: Int = 0,
) {
    val tokensPerSecond: Double get() = if (genMs > 0 && genTokens > 1) (genTokens - 1) * 1000.0 / genMs else 0.0
    val totalMs: Double get() = ttftMs + genMs
}

data class GenResult(val text: String, val stats: GenStats)

class LlmException(message: String) : Exception(message)

/** Локальная языковая модель. Реализация — llama.cpp через JNI ([LlamaLlm]). */
interface LocalLlm : AutoCloseable {
    val contextSize: Int
    /** Маленькая модель (меньше ~1 млрд параметров): ей нужны примеры в промпте и защита от самоповторов. */
    val isSmall: Boolean get() = false
    fun countTokens(text: String): Int
    /** [onPiece] получает кусочки текста по мере генерации; вернуть false — остановить. */
    fun generate(prompt: String, params: GenParams, onPiece: (String) -> Boolean = { true }): GenResult
    fun cancel()
    fun setThreads(n: Int)
    /** Постоянный пул потоков; bigOnly — считать только на быстрых ядрах. Возвращает число быстрых ядер (0 — не определить). */
    fun configureThreads(n: Int, bigOnly: Boolean): Int = 0.also { setThreads(n) }
    /** Прогрев: заранее обработать начало будущего промпта, чтобы оно осталось в KV-кеше. */
    fun warm(prefix: String) { runCatching { generate(prefix, GenParams(maxTokens = 0)) } }
    fun clearCache()
    fun meta(key: String): String
}

/** JNI-мост к native/lb_jni.cpp. Строки передаются байтами UTF-8, чтобы не зависеть от «modified UTF-8». */
object LlamaNative {
    fun interface PieceCallback { fun onPiece(bytes: ByteArray): Boolean }

    @Volatile private var loaded = false
    @Synchronized fun ensureLoaded() { if (!loaded) { System.loadLibrary("livebook_llm"); loaded = true } }

    external fun nativeLoad(path: ByteArray, nCtx: Int, nThreads: Int): Long
    external fun nativeFree(handle: Long)
    external fun nativeLastError(): ByteArray
    external fun nativeSetThreads(handle: Long, n: Int)
    external fun nativeConfigureThreads(handle: Long, n: Int, bigOnly: Boolean): Int
    external fun nativeBigCoreCount(): Int
    external fun nativeContextSize(handle: Long): Int
    external fun nativeCountTokens(handle: Long, text: ByteArray): Int
    external fun nativeMeta(handle: Long, key: ByteArray): ByteArray
    external fun nativeCancel(handle: Long)
    external fun nativeClearCache(handle: Long)
    external fun nativeSystemInfo(): ByteArray
    external fun nativeGenerate(handle: Long, prompt: ByteArray, grammar: ByteArray?, maxTokens: Int, temp: Float, topP: Float, topK: Int, repeatPenalty: Float, seed: Int, avoid: ByteArray?, cb: PieceCallback): DoubleArray
}

class LlamaLlm(modelPath: String, nCtx: Int = 2048, threads: Int = 4) : LocalLlm {
    private var handle: Long

    init {
        LlamaNative.ensureLoaded()
        handle = LlamaNative.nativeLoad(modelPath.toByteArray(Charsets.UTF_8), nCtx, threads)
        if (handle == 0L) throw LlmException(String(LlamaNative.nativeLastError(), Charsets.UTF_8).ifEmpty { "не удалось загрузить модель" })
    }

    override val contextSize: Int get() = LlamaNative.nativeContextSize(handle)
    override val isSmall: Boolean = java.io.File(modelPath).length() < 900L * 1024 * 1024
    override fun countTokens(text: String): Int = LlamaNative.nativeCountTokens(handle, text.toByteArray(Charsets.UTF_8))
    override fun cancel() { if (handle != 0L) LlamaNative.nativeCancel(handle) }
    override fun setThreads(n: Int) = LlamaNative.nativeSetThreads(handle, n)
    override fun configureThreads(n: Int, bigOnly: Boolean): Int = LlamaNative.nativeConfigureThreads(handle, n, bigOnly)
    override fun clearCache() = LlamaNative.nativeClearCache(handle)
    override fun meta(key: String): String = String(LlamaNative.nativeMeta(handle, key.toByteArray(Charsets.UTF_8)), Charsets.UTF_8)

    @Synchronized
    override fun generate(prompt: String, params: GenParams, onPiece: (String) -> Boolean): GenResult {
        check(handle != 0L) { "модель выгружена" }
        val sb = StringBuilder()
        val r = LlamaNative.nativeGenerate(handle, prompt.toByteArray(Charsets.UTF_8), params.grammar?.toByteArray(Charsets.UTF_8), params.maxTokens,
            params.temp, params.topP, params.topK, params.repeatPenalty, params.seed, params.avoid?.toByteArray(Charsets.UTF_8)) { bytes ->
            val piece = String(bytes, Charsets.UTF_8)
            sb.append(piece)
            onPiece(piece)
        }
        if (r[0] == 0.0) throw LlmException(String(LlamaNative.nativeLastError(), Charsets.UTF_8))
        return GenResult(sb.toString(), GenStats(r[1].toInt(), r[2].toInt(), r[3].toInt(), r[4], r[5], r[6], r[7].toInt()))
    }

    @Synchronized
    override fun close() { if (handle != 0L) { LlamaNative.nativeFree(handle); handle = 0 } }

    companion object { fun bigCoreCount(): Int { LlamaNative.ensureLoaded(); return LlamaNative.nativeBigCoreCount() }
        fun systemInfo(): String { LlamaNative.ensureLoaded(); return String(LlamaNative.nativeSystemInfo(), Charsets.UTF_8) } }
}

data class GgufInfo(
    val version: Int, val architecture: String, val name: String, val fileType: Int, val sizeLabel: String,
    val contextLength: Long, val sizeBytes: Long, val problems: List<String>,
) {
    val ok: Boolean get() = problems.isEmpty()
    val quant: String get() = FILE_TYPES[fileType] ?: "тип $fileType"
    companion object { val FILE_TYPES = mapOf(1 to "F16", 2 to "Q4_0", 3 to "Q4_1", 7 to "Q8_0", 8 to "Q5_0", 11 to "Q3_K_S", 12 to "Q3_K_M", 14 to "Q4_K_S", 15 to "Q4_K_M", 16 to "Q5_K_S", 17 to "Q5_K_M", 18 to "Q6_K", 32 to "BF16") }
}

/** Проверка файла модели до запуска: формат GGUF, архитектура, размер, контрольная сумма. */
object GgufInspector {
    const val MIN_BYTES = 50L * 1024 * 1024
    const val MAX_BYTES = 2600L * 1024 * 1024
    /** Сверенные сборки (SHA-256 → описание). */
    val KNOWN = mapOf(
        "ac2d97712095a558e31573f62f466a3f9d93990898b0ec79d7c974c1780d524a" to "Qwen3-0.6B Q4_K_M (unsloth/Qwen3-0.6B-GGUF, проверено при сборке)",
        "b139949c5bd74937ad8ed8c8cf3d9ffb1e99c866c823204dc42c0d91fa181897" to "Qwen3-1.7B Q4_K_M (unsloth/Qwen3-1.7B-GGUF, проверено при сборке)",
    )

    fun inspect(file: File): GgufInfo = FileInputStream(file).use { inspect(it, file.length()) }

    fun inspect(input: InputStream, sizeBytes: Long): GgufInfo {
        val problems = ArrayList<String>()
        val d = DataInputStream(BufferedInputStream(input, 1 shl 16))
        fun u32(): Long { val b = ByteArray(4); d.readFully(b); return (b[0].toLong() and 0xFF) or ((b[1].toLong() and 0xFF) shl 8) or ((b[2].toLong() and 0xFF) shl 16) or ((b[3].toLong() and 0xFF) shl 24) }
        fun u64(): Long { val lo = u32(); val hi = u32(); return lo or (hi shl 32) }
        fun str(max: Int = 1 shl 20): String { val n = u64(); if (n < 0 || n > max) throw IllegalStateException("строка $n"); val b = ByteArray(n.toInt()); d.readFully(b); return String(b, Charsets.UTF_8) }
        var version = 0; var arch = ""; var name = ""; var ft = -1; var ctx = 0L; var label = ""
        try {
            val magic = ByteArray(4); d.readFully(magic)
            if (String(magic, Charsets.ISO_8859_1) != "GGUF") return GgufInfo(0, "", "", -1, "", 0, sizeBytes, listOf("Это не файл модели GGUF."))
            version = u32().toInt()
            if (version !in 2..3) problems += "Неподдерживаемая версия GGUF: $version."
            u64() // tensors
            val kv = u64()
            fun skip(type: Int) { when (type) { 0, 1, 7 -> d.skipBytes(1); 2, 3 -> d.skipBytes(2); 4, 5, 6 -> d.skipBytes(4); 10, 11, 12 -> d.skipBytes(8); 8 -> str(); else -> throw IllegalStateException("тип $type") } }
            var i = 0L
            while (i < kv && i < 400 && !(ft >= 0 && arch.isNotEmpty() && ctx > 0 && name.isNotEmpty())) {
                val key = str(4096)
                val type = u32().toInt()
                when {
                    type == 8 -> { val v = str(); when (key) { "general.architecture" -> arch = v; "general.name" -> name = v; "general.size_label" -> label = v } }
                    type == 4 || type == 5 -> { val v = u32(); if (key == "general.file_type") ft = v.toInt(); if (key.endsWith(".context_length")) ctx = v }
                    type == 10 || type == 11 -> { val v = u64(); if (key.endsWith(".context_length")) ctx = v }
                    type == 9 -> { val et = u32().toInt(); val n = u64(); var j = 0L; while (j < n) { skip(et); j++ } }
                    else -> skip(type)
                }
                i++
            }
        } catch (e: Exception) {
            problems += "Файл модели повреждён или обрезан."
        }
        if (problems.isEmpty()) {
            if (arch.isEmpty()) problems += "В файле не указана архитектура модели."
            else if (!arch.startsWith("qwen")) problems += "Архитектура «$arch» не поддерживается: игра рассчитана на Qwen3 (ожидается qwen3)."
            if (sizeBytes < MIN_BYTES) problems += "Файл слишком мал для языковой модели."
            if (sizeBytes > MAX_BYTES) problems += "Файл слишком велик для телефона с 8 ГБ памяти (больше 2,5 ГБ)."
        }
        return GgufInfo(version, arch, name, ft, label, ctx, sizeBytes, problems)
    }

    fun sha256(file: File, onProgress: (Long) -> Unit = {}): String {
        val md = MessageDigest.getInstance("SHA-256")
        val buf = ByteArray(1 shl 20)
        var total = 0L
        FileInputStream(file).use { ins -> while (true) { val n = ins.read(buf); if (n < 0) break; md.update(buf, 0, n); total += n; onProgress(total) } }
        return md.digest().joinToString("") { "%02x".format(it) }
    }
}
