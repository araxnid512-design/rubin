package ru.livebook.app

import android.app.Application
import android.content.ComponentCallbacks2
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.SystemClock
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.text.PDFTextStripper
import kotlinx.coroutines.flow.MutableStateFlow
import ru.livebook.core.db.Db
import ru.livebook.core.game.Benchmarks
import ru.livebook.core.game.GameOrchestrator
import ru.livebook.core.game.LoreRefiner
import ru.livebook.core.game.SaveRepository
import ru.livebook.core.importer.BookImportException
import ru.livebook.core.importer.PdfTextExtractor
import ru.livebook.core.llm.GgufInfo
import ru.livebook.core.llm.GgufInspector
import ru.livebook.core.llm.LlamaLlm
import ru.livebook.core.llm.LocalLlm
import ru.livebook.core.lore.BookRepository
import ru.livebook.core.narration.NarrationQueue
import ru.livebook.core.narration.SpeechEngine
import java.io.File
import java.util.Locale

class LiveBookApp : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }

    /** Приложение ушло в фон и системе нужна память — выгружаем модель; инференс в фоне не держим. */
    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        if (level >= ComponentCallbacks2.TRIM_MEMORY_BACKGROUND) container.llm.unloadIfIdle()
    }
}

class AppContainer(val context: Context) {
    val prefs = context.getSharedPreferences("settings", Context.MODE_PRIVATE)
    val db = Db(File(context.filesDir, "livebook.db").path)
    val books = BookRepository(db)
    val saves = SaveRepository(db)
    val llm = LlmHolder(context, { prefs.getInt("threads", 4) }, { prefs.getBoolean("big_only", false) })
    val game = GameOrchestrator(books, saves) { llm.get() }
    val refiner = LoreRefiner(books) { llm.get() }
    val bench = Benchmarks(db)
    val narrator = Narrator(context, prefs)
    val pdf = PdfBoxExtractor(context)
}

/** Локальная модель: файл лежит в частной папке приложения, загружается лениво и выгружается, когда не нужна. */
class LlmHolder(private val context: Context, private val threads: () -> Int, private val bigOnly: () -> Boolean = { false }) {
    val file = File(File(context.filesDir, "models").apply { mkdirs() }, "model.gguf")
    private var llm: LlamaLlm? = null
    @Volatile var busy = false
    @Volatile var lastError = ""

    fun installed(): Boolean = file.exists() && file.length() > GgufInspector.MIN_BYTES
    fun info(): GgufInfo? = if (installed()) runCatching { GgufInspector.inspect(file) }.getOrNull() else null

    @Synchronized fun get(): LocalLlm? {
        llm?.let { return it }
        if (!installed()) return null
        return try {
            // Пул потоков создаётся в потоке модели; при bigOnly вычисления идут только на быстрых ядрах.
            LlamaLlm(file.path, 2048, threads()).also { it.configureThreads(threads(), bigOnly()); llm = it; lastError = "" }
        } catch (t: Throwable) {
            lastError = t.message ?: t.javaClass.simpleName
            null
        }
    }

    fun cancel() { llm?.cancel() }
    @Synchronized fun unload() { llm?.close(); llm = null }
    fun unloadIfIdle() { if (!busy) unload() }

    /**
     * Установка модели из файла, выбранного пользователем: копируем во временный файл, проверяем формат GGUF,
     * архитектуру, размер и считаем SHA-256. Негодный файл не устанавливается и не запускается.
     */
    fun install(uri: Uri, onProgress: (Long, Long) -> Unit): Pair<GgufInfo, String> {
        val tmp = File(file.parentFile, "model.tmp")
        try {
            val total = runCatching { context.contentResolver.openAssetFileDescriptor(uri, "r")?.use { it.length } }.getOrNull() ?: -1L
            if (total > GgufInspector.MAX_BYTES) throw IllegalStateException("Файл слишком велик для телефона с 8 ГБ памяти (больше 2,5 ГБ).")
            val input = context.contentResolver.openInputStream(uri) ?: throw IllegalStateException("Не удалось открыть файл.")
            input.use { ins ->
                val head = ByteArray(4)
                val n = ins.read(head)
                if (n < 4 || String(head, Charsets.ISO_8859_1) != "GGUF") throw IllegalStateException("Это не файл модели GGUF.")
                tmp.outputStream().use { out ->
                    out.write(head)
                    val buf = ByteArray(1 shl 20)
                    var done = 4L
                    while (true) {
                        val r = ins.read(buf); if (r < 0) break
                        out.write(buf, 0, r); done += r
                        if (done > GgufInspector.MAX_BYTES) throw IllegalStateException("Файл слишком велик (больше 2,5 ГБ).")
                        onProgress(done, total)
                    }
                }
            }
            val info = GgufInspector.inspect(tmp)
            if (!info.ok) throw IllegalStateException(info.problems.joinToString(" "))
            val sha = GgufInspector.sha256(tmp)
            unload()
            if (file.exists()) file.delete()
            if (!tmp.renameTo(file)) throw IllegalStateException("Не удалось сохранить файл модели.")
            return info to sha
        } finally { if (tmp.exists()) tmp.delete() }
    }

    /** Сборка «всё внутри APK»: если модель лежит в assets, копируем её при первом запуске. */
    fun installFromAssetsIfBundled(onProgress: (Long, Long) -> Unit): Boolean {
        if (installed()) return false
        val names = runCatching { context.assets.list("") }.getOrNull() ?: return false
        if ("model.gguf" !in names) return false
        val tmp = File(file.parentFile, "model.tmp")
        context.assets.open("model.gguf").use { ins -> tmp.outputStream().use { out ->
            val buf = ByteArray(1 shl 20); var done = 0L
            while (true) { val r = ins.read(buf); if (r < 0) break; out.write(buf, 0, r); done += r; onProgress(done, -1) }
        } }
        return GgufInspector.inspect(tmp).ok && tmp.renameTo(file)
    }

    fun remove() { unload(); file.delete() }
}

data class VoiceInfo(val name: String, val label: String)
data class VoiceState(
    /** init — движок запускается; ready — есть офлайн-голос; no_voice — русского офлайн-голоса нет; no_engine — нет движка синтеза. */
    val status: String = "init",
    val voices: List<VoiceInfo> = emptyList(),
    val selected: String = "",
    val engine: String = "",
    val playback: NarrationQueue.State = NarrationQueue.State.IDLE,
    val latencyMs: Long = -1,
    /** Установлен ли встроенный голос и используется ли он сейчас вместо системного синтеза. */
    val builtinInstalled: Boolean = false,
    val builtinActive: Boolean = false,
    val builtinName: String = "",
    /** Состояние системного синтеза само по себе (status учитывает и встроенный голос). */
    val systemStatus: String = "init",
)

/** Озвучка: встроенный офлайн-голос (если установлен) или Android TextToSpeech с голосом, которому не нужна сеть. */
class Narrator(private val context: Context, private val prefs: android.content.SharedPreferences) : SpeechEngine {
    val state = MutableStateFlow(VoiceState())
    val queue = NarrationQueue(this) { s -> state.value = state.value.copy(playback = s) }
    private var tts: TextToSpeech? = null
    private var ready = false
    private var speakAt = 0L
    val builtin = BuiltinVoice(context)
    var preferBuiltin: Boolean get() = prefs.getBoolean("tts_builtin", true); set(v) { prefs.edit().putBoolean("tts_builtin", v).apply(); stop(); publish() }

    private fun useBuiltin(): Boolean = preferBuiltin && builtin.installed()
    /** Собрать общий статус из состояния встроенного голоса и системного синтеза. */
    fun publish() {
        val st = state.value
        val b = builtin.installed()
        state.value = st.copy(builtinInstalled = b, builtinActive = b && preferBuiltin, builtinName = if (b) builtin.name() else "", status = if (b && preferBuiltin) "ready" else st.systemStatus)
    }

    var rate: Float get() = prefs.getFloat("tts_rate", 0.95f); set(v) { prefs.edit().putFloat("tts_rate", v.coerceIn(0.85f, 1.15f)).apply() }
    var pitch: Float get() = prefs.getFloat("tts_pitch", 0.95f); set(v) { prefs.edit().putFloat("tts_pitch", v.coerceIn(0.8f, 1.2f)).apply() }
    var volume: Float get() = prefs.getFloat("tts_volume", 1f); set(v) { prefs.edit().putFloat("tts_volume", v.coerceIn(0.2f, 1f)).apply() }
    var auto: Boolean get() = prefs.getBoolean("tts_auto", true); set(v) { prefs.edit().putBoolean("tts_auto", v).apply() }

    fun start() {
        if (tts != null) return
        tts = TextToSpeech(context) { code ->
            if (code != TextToSpeech.SUCCESS) { state.value = state.value.copy(systemStatus = "no_engine"); publish(); return@TextToSpeech }
            ready = true
            tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(id: String?) { if (speakAt > 0) { state.value = state.value.copy(latencyMs = SystemClock.elapsedRealtime() - speakAt); speakAt = 0 } }
                override fun onDone(id: String?) { id?.let { queue.onUtteranceDone(it) } }
                @Deprecated("Deprecated in Java") override fun onError(id: String?) { id?.let { queue.onUtteranceDone(it) } }
                override fun onError(id: String?, errorCode: Int) { id?.let { queue.onUtteranceDone(it) } }
            })
            refresh()
        }
    }

    /** Перечитать голоса: вызывается после возврата из системных настроек синтеза речи. */
    fun refresh() {
        publish()
        val t = tts ?: return
        if (!ready) return
        val all: Set<Voice> = runCatching { t.voices }.getOrNull() ?: emptySet()
        val offline = all.filter { v ->
            v.locale.language == "ru" && !v.isNetworkConnectionRequired && !v.features.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED)
        }.sortedWith(compareByDescending<Voice> { it.quality }.thenBy { it.name })
        val engine = runCatching { t.defaultEngine }.getOrNull().orEmpty()
        if (offline.isEmpty()) { state.value = state.value.copy(systemStatus = "no_voice", voices = emptyList(), engine = engine); publish(); return }
        val wanted = prefs.getString("tts_voice", "")
        val chosen = offline.firstOrNull { it.name == wanted } ?: offline.first()
        runCatching { t.language = Locale("ru", "RU"); t.voice = chosen }
        state.value = state.value.copy(systemStatus = "ready", engine = engine, selected = chosen.name,
            voices = offline.mapIndexed { i, v -> VoiceInfo(v.name, "Голос ${i + 1}" + (if (v.quality >= Voice.QUALITY_HIGH) " · высокое качество" else "") + " · без сети") })
        publish()
    }

    fun select(name: String) {
        prefs.edit().putString("tts_voice", name).apply()
        refresh()
    }

    fun available(): Boolean = state.value.status == "ready"

    override fun speak(text: String, utteranceId: String) {
        if (useBuiltin()) {
            builtin.speak(text, rate, volume, onStart = { ms -> state.value = state.value.copy(latencyMs = ms) }, onDone = { queue.onUtteranceDone(utteranceId) })
            return
        }
        val t = tts ?: return
        if (!available()) return
        t.setSpeechRate(rate); t.setPitch(pitch)
        val params = Bundle().apply { putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, volume) }
        speakAt = SystemClock.elapsedRealtime()
        t.speak(text, TextToSpeech.QUEUE_FLUSH, params, utteranceId)
    }

    override fun stop() { builtin.stop(); runCatching { tts?.stop() } }

    fun settingsIntent(): Intent = Intent("com.android.settings.TTS_SETTINGS").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    fun installDataIntent(): Intent = Intent(TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

    fun shutdown() { builtin.release(); runCatching { tts?.shutdown() }; tts = null; ready = false }
}

/** Текст из PDF через pdfbox-android. Сканы без текстового слоя отсеивает BookImporter. */
class PdfBoxExtractor(private val context: Context) : PdfTextExtractor {
    override fun extractPages(bytes: ByteArray): List<String> {
        runCatching { PDFBoxResourceLoader.init(context.applicationContext) }
        val doc = try { PDDocument.load(bytes) } catch (e: Exception) {
            val msg = (e.message ?: "").lowercase()
            throw BookImportException(if (msg.contains("password") || msg.contains("encrypt")) "PDF защищён паролем или DRM — открыть его нельзя." else "Файл PDF повреждён.", e)
        }
        doc.use { d ->
            if (d.isEncrypted) throw BookImportException("PDF защищён паролем или DRM — открыть его нельзя.")
            val stripper = PDFTextStripper()
            val n = d.numberOfPages
            if (n > 3000) throw BookImportException("В PDF слишком много страниц.")
            return (1..n).map { p -> stripper.startPage = p; stripper.endPage = p; runCatching { stripper.getText(d) }.getOrDefault("") }
        }
    }
}
