package ru.livebook.core.narration

/** Платформенный синтез речи (на Android — TextToSpeech с офлайн-голосом). */
interface SpeechEngine {
    fun speak(text: String, utteranceId: String)
    fun stop()
}

/**
 * Очередь фраз рассказчика. Пауза реализована по предложениям: многие TTS-движки не умеют
 * точную паузу, поэтому мы останавливаем речь и запоминаем номер предложения, а «Продолжить»
 * начинает с него же.
 */
class NarrationQueue(private val engine: SpeechEngine, private val onState: (State) -> Unit = {}) {
    enum class State { IDLE, PLAYING, PAUSED }

    private val sentences = ArrayList<String>()
    private var index = 0
    private var generation = 0
    var state: State = State.IDLE
        private set

    @Synchronized fun currentIndex(): Int = index
    @Synchronized fun size(): Int = sentences.size

    /** Новый текст заменяет старый и (если autoPlay) сразу читается. */
    @Synchronized fun setText(list: List<String>, autoPlay: Boolean) {
        engine.stop(); generation++
        sentences.clear(); sentences.addAll(list.map { it.trim() }.filter { speakable(it) }); index = 0
        set(State.IDLE)
        if (autoPlay) play()
    }

    /** Добавить готовое предложение во время потоковой генерации. */
    @Synchronized fun append(sentence: String, autoPlay: Boolean) {
        val s = sentence.trim()
        if (!speakable(s)) return
        sentences += s
        if (autoPlay && state == State.IDLE) { set(State.PLAYING); speakCurrent() }
    }

    @Synchronized fun play() {
        if (sentences.isEmpty()) return
        if (index >= sentences.size) index = 0
        set(State.PLAYING); speakCurrent()
    }

    @Synchronized fun pause() { if (state == State.PLAYING) { generation++; engine.stop(); set(State.PAUSED) } }
    @Synchronized fun resume() { if (state == State.PAUSED) { set(State.PLAYING); speakCurrent() } }
    @Synchronized fun stop() { generation++; engine.stop(); index = 0; set(State.IDLE) }
    @Synchronized fun clear() { generation++; engine.stop(); sentences.clear(); index = 0; set(State.IDLE) }

    /** Вызывается движком, когда фраза дочитана. */
    @Synchronized fun onUtteranceDone(utteranceId: String) {
        if (state != State.PLAYING || utteranceId != "$generation:$index") return
        index++
        if (index < sentences.size) speakCurrent() else set(State.IDLE)
    }

    private fun speakCurrent() {
        if (index < sentences.size) engine.speak(sentences[index], "$generation:$index") else set(State.IDLE)
    }

    private fun set(s: State) { if (state != s) { state = s; onState(s) } }

    companion object {
        /** Служебные строки и токены вслух не читаются. */
        fun speakable(s: String): Boolean = s.any { it.isLetter() } && !s.startsWith("ИТОГ") && !s.startsWith("ДАЛЬШЕ") && !s.contains("<|") && !s.contains("<think")
    }
}
