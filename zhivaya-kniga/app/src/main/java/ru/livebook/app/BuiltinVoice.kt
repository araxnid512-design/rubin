package ru.livebook.app

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.net.Uri
import android.os.SystemClock
import com.k2fsa.sherpa.onnx.OfflineTts
import com.k2fsa.sherpa.onnx.OfflineTtsConfig
import com.k2fsa.sherpa.onnx.OfflineTtsModelConfig
import com.k2fsa.sherpa.onnx.OfflineTtsVitsModelConfig
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger
import java.util.zip.ZipInputStream

/**
 * Встроенный офлайн-голос: движок sherpa-onnx и голос Piper, установленный из файла-пакета (ZIP).
 * Работает без системного синтеза речи и без сети. Синтез идёт в отдельном потоке по одному предложению.
 */
class BuiltinVoice(private val context: Context) {
    val dir = File(context.filesDir, "voice")
    private val worker = Executors.newSingleThreadExecutor { r -> Thread(r, "livebook-voice") }
    private val token = AtomicInteger(0)
    @Volatile private var tts: OfflineTts? = null
    @Volatile private var track: AudioTrack? = null
    @Volatile var lastError = ""
    @Volatile var lastSynthMs = -1L

    fun installed(): Boolean = File(dir, "model.onnx").length() > 1_000_000 && File(dir, "tokens.txt").exists() && File(dir, "espeak-ng-data/ru_dict").exists()
    fun name(): String = runCatching { Regex("\"name\"\\s*:\\s*\"([^\"]+)\"").find(File(dir, "voice.json").readText())?.groupValues?.get(1) }.getOrNull() ?: "Встроенный"

    /** Установка пакета голоса: распаковка во временную папку, проверка состава, замена старого голоса. */
    fun install(uri: Uri, onProgress: (Long) -> Unit = {}): String =
        install(context.contentResolver.openInputStream(uri) ?: throw IllegalStateException("Не удалось открыть файл."), onProgress)

    /** Сборка «всё в одном файле»: голос лежит в APK (assets/voice.zip) и ставится при первом запуске. */
    fun installFromAssetsIfBundled(onProgress: (Long) -> Unit = {}): Boolean {
        if (installed()) return false
        val names = runCatching { context.assets.list("") }.getOrNull() ?: return false
        if ("voice.zip" !in names) return false
        install(context.assets.open("voice.zip"), onProgress)
        return true
    }

    fun install(input: java.io.InputStream, onProgress: (Long) -> Unit = {}): String {
        val tmp = File(context.filesDir, "voice.tmp")
        tmp.deleteRecursively(); tmp.mkdirs()
        try {
            var total = 0L
            ZipInputStream(input.buffered()).use { z ->
                while (true) {
                    val e = z.nextEntry ?: break
                    val out = File(tmp, e.name)
                    // Защита от путей вида ../../ внутри архива.
                    if (!out.canonicalPath.startsWith(tmp.canonicalPath + File.separator)) throw IllegalStateException("Архив голоса повреждён.")
                    if (e.isDirectory) { out.mkdirs(); continue }
                    out.parentFile?.mkdirs()
                    out.outputStream().buffered(1 shl 16).use { o ->   // буфер: распаковщик отдаёт данные мелкими порциями
                        val buf = ByteArray(1 shl 16)
                        while (true) { val n = z.read(buf); if (n < 0) break; o.write(buf, 0, n); total += n; if (total > 300L * 1024 * 1024) throw IllegalStateException("Архив слишком большой для пакета голоса."); onProgress(total) }
                    }
                }
            }
            if (File(tmp, "model.onnx").length() < 1_000_000 || !File(tmp, "tokens.txt").exists() || !File(tmp, "espeak-ng-data/ru_dict").exists())
                throw IllegalStateException("Это не пакет голоса «Живой книги»: в архиве нет model.onnx, tokens.txt или русских данных произношения.")
            release()
            dir.deleteRecursively()
            if (!tmp.renameTo(dir)) throw IllegalStateException("Не удалось сохранить голос.")
            return name()
        } catch (e: java.util.zip.ZipException) { throw IllegalStateException("Файл не является ZIP-архивом голоса.") } finally { if (tmp.exists()) tmp.deleteRecursively() }
    }

    fun remove() { release(); dir.deleteRecursively() }

    @Synchronized private fun engine(): OfflineTts? {
        tts?.let { return it }
        if (!installed()) return null
        return try {
            val vits = OfflineTtsVitsModelConfig(model = File(dir, "model.onnx").path, tokens = File(dir, "tokens.txt").path, dataDir = File(dir, "espeak-ng-data").path)
            OfflineTts(assetManager = null, config = OfflineTtsConfig(model = OfflineTtsModelConfig(vits = vits, numThreads = 2, provider = "cpu"))).also { tts = it; lastError = "" }
        } catch (t: Throwable) { lastError = t.message ?: t.javaClass.simpleName; null }
    }

    /** Синтез без воспроизведения — для проверки и замера. Возвращает (число отсчётов, частота). */
    fun synthesize(text: String, speed: Float = 1f): Pair<Int, Int> {
        val e = engine() ?: return 0 to 0
        val t0 = SystemClock.elapsedRealtime()
        val a = e.generate(text, 0, speed)
        lastSynthMs = SystemClock.elapsedRealtime() - t0
        return a.samples.size to a.sampleRate
    }

    fun speak(text: String, speed: Float, volume: Float, onStart: (Long) -> Unit, onDone: () -> Unit) {
        val my = token.incrementAndGet()
        stopTrack()
        val asked = SystemClock.elapsedRealtime()
        worker.execute {
            try {
                val e = engine() ?: run { onDone(); return@execute }
                val audio = e.generate(text, 0, speed)
                if (token.get() != my || audio.samples.isEmpty()) { if (token.get() == my) onDone(); return@execute }
                val pcm = ShortArray(audio.samples.size) { i -> (audio.samples[i].coerceIn(-1f, 1f) * 32767f).toInt().toShort() }
                val t = AudioTrack.Builder()
                    .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
                    .setAudioFormat(AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT).setSampleRate(audio.sampleRate).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
                    .setTransferMode(AudioTrack.MODE_STATIC).setBufferSizeInBytes(pcm.size * 2).build()
                t.write(pcm, 0, pcm.size)
                t.setVolume(volume)
                track = t
                if (token.get() != my) { stopTrack(); return@execute }
                t.play()
                onStart(SystemClock.elapsedRealtime() - asked)
                val endAt = SystemClock.elapsedRealtime() + pcm.size * 1000L / audio.sampleRate + 120
                while (token.get() == my && SystemClock.elapsedRealtime() < endAt && t.playbackHeadPosition < pcm.size) Thread.sleep(25)
                val finished = token.get() == my
                runCatching { t.stop(); t.release() }
                if (track === t) track = null
                if (finished) onDone()
            } catch (t: Throwable) { lastError = t.message ?: t.javaClass.simpleName; if (token.get() == my) onDone() }
        }
    }

    fun stop() { token.incrementAndGet(); stopTrack() }
    private fun stopTrack() { track?.let { t -> runCatching { t.pause(); t.flush(); t.stop(); t.release() } }; track = null }
    @Synchronized fun release() { stop(); runCatching { tts?.release() }; tts = null }
}
