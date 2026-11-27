package ru.livebook.app

import android.app.ActivityManager
import android.app.Application
import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Debug
import android.provider.OpenableColumns
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import ru.livebook.core.game.BackupException
import ru.livebook.core.game.BenchResult
import ru.livebook.core.game.GameInfo
import ru.livebook.core.game.SlotInfo
import ru.livebook.core.game.TurnListener
import ru.livebook.core.game.TurnResult
import ru.livebook.core.importer.BookImportException
import ru.livebook.core.importer.BookImporter
import ru.livebook.core.llm.GameSettings
import ru.livebook.core.llm.GgufInspector
import ru.livebook.core.lore.BookInfo
import ru.livebook.core.lore.Entity
import ru.livebook.core.model.GameState
import ru.livebook.core.model.Text
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

enum class Screen { LIBRARY, BOOK, GAME, SETTINGS }

data class FeedItem(val kind: String, val text: String, val meta: String = "")   // hero | narrator | system | notice

data class ModelUi(val installed: Boolean = false, val label: String = "", val busy: Boolean = false, val progress: Float = -1f, val error: String = "", val verified: Boolean = false)
data class ImportUi(val title: String, val done: Int = 0, val total: Int = 0, val bookId: String = "")
data class GameUi(
    val id: String, val title: String, val state: GameState, val feed: List<FeedItem> = emptyList(), val streaming: String = "", val status: String = "",
    val busy: Boolean = false, val suggestions: List<String> = emptyList(), val slots: List<SlotInfo> = emptyList(), val canUndo: Boolean = false, val lastStats: String = "",
)
data class Prefs(val detail: Boolean = false, val economy: Boolean = false, val suggestions: Boolean = true, val threads: Int = 4, val fontScale: Float = 1f, val bigOnly: Boolean = false)

data class UiState(
    val screen: Screen = Screen.LIBRARY,
    val books: List<BookInfo> = emptyList(),
    val games: List<GameInfo> = emptyList(),
    val model: ModelUi = ModelUi(),
    val importing: ImportUi? = null,
    val book: BookInfo? = null,
    val entities: List<Entity> = emptyList(),
    val refine: Pair<Int, Int>? = null,
    val game: GameUi? = null,
    val prefs: Prefs = Prefs(),
    val bench: List<BenchResult> = emptyList(),
    val benchRunning: String = "",
    val pendingCharset: Uri? = null,
    val message: String = "",
)

class MainViewModel(app: Application) : AndroidViewModel(app) {
    private val c = (app as LiveBookApp).container
    private val _ui = MutableStateFlow(UiState())
    val ui: StateFlow<UiState> = _ui
    val voice = c.narrator.state
    val narrator get() = c.narrator

    /** Вся работа с моделью — в одном отдельном потоке, не в UI. */
    private val llmThread = Executors.newSingleThreadExecutor { r -> Thread(r, "livebook-llm").apply { priority = Thread.NORM_PRIORITY } }.asCoroutineDispatcher()
    private val cancelImport = AtomicBoolean(false)
    private val cancelRefine = AtomicBoolean(false)
    private var importJob: Job? = null

    init {
        loadPrefs()
        refreshLibrary()
        refreshModel()
        c.narrator.start()
        viewModelScope.launch(Dispatchers.IO) {
            // Сборка с моделью внутри APK: установка при первом запуске.
            if (!c.llm.installed()) {
                val ok = runCatching { c.llm.installFromAssetsIfBundled { done, _ -> _ui.update { it.copy(model = it.model.copy(busy = true, label = "Распаковка модели: ${done / 1048576} МБ")) } } }.getOrDefault(false)
                refreshModel()
                if (ok) runBenchmark(auto = true)
            }
            // Незавершённая индексация продолжается после перезапуска.
            c.books.books().firstOrNull { !it.fullyIndexed }?.let { resumeIndexing(it.id, it.title) }
        }
    }

    private fun loadPrefs() {
        val p = c.prefs
        _ui.update { it.copy(prefs = Prefs(p.getBoolean("detail", false), p.getBoolean("economy", false), p.getBoolean("suggestions", true), p.getInt("threads", 4), p.getFloat("font", 1f), p.getBoolean("big_only", false))) }
    }

    fun setPrefs(f: (Prefs) -> Prefs) {
        val n = f(_ui.value.prefs)
        val threadsChanged = n.threads != _ui.value.prefs.threads || n.bigOnly != _ui.value.prefs.bigOnly
        c.prefs.edit().putBoolean("detail", n.detail).putBoolean("economy", n.economy).putBoolean("suggestions", n.suggestions).putInt("threads", n.threads).putFloat("font", n.fontScale).putBoolean("big_only", n.bigOnly).apply()
        _ui.update { it.copy(prefs = n) }
        if (threadsChanged) viewModelScope.launch(llmThread) { c.llm.unload() }
    }

    private fun settings(): GameSettings = _ui.value.prefs.let { GameSettings(detail = it.detail, economy = it.economy, suggestions = it.suggestions) }
    fun message(text: String) = _ui.update { it.copy(message = text) }
    fun clearMessage() = _ui.update { it.copy(message = "") }
    fun go(screen: Screen) { if (screen != Screen.GAME) c.narrator.queue.stop(); _ui.update { it.copy(screen = screen) }; if (screen == Screen.LIBRARY) refreshLibrary(); if (screen == Screen.SETTINGS) { c.narrator.refresh(); _ui.update { it.copy(bench = c.bench.history(8)) } } }

    fun refreshLibrary() = viewModelScope.launch(Dispatchers.IO) {
        val books = c.books.books(); val games = c.saves.games()
        _ui.update { it.copy(books = books, games = games) }
    }

    // ---------- модель ----------
    private fun refreshModel() {
        val info = c.llm.info()
        val verified = c.prefs.getString("model_sha", "").orEmpty() in GgufInspector.KNOWN
        _ui.update {
            it.copy(model = if (info == null) ModelUi() else ModelUi(true, "${info.name.ifEmpty { "Модель" }} · ${info.quant} · ${info.sizeBytes / 1048576} МБ" + if (verified) " · проверена" else " · контрольная сумма не из списка проверенных", verified = verified))
        }
    }

    fun installModel(uri: Uri) = viewModelScope.launch(Dispatchers.IO) {
        _ui.update { it.copy(model = it.model.copy(busy = true, error = "", progress = 0f, label = "Копирование модели…")) }
        try {
            val (info, sha) = c.llm.install(uri) { done, total -> _ui.update { it.copy(model = it.model.copy(busy = true, progress = if (total > 0) done.toFloat() / total else -1f, label = "Копирование: ${done / 1048576} МБ")) } }
            c.prefs.edit().putString("model_sha", sha).apply()
            refreshModel()
            message("Модель установлена: ${info.name} (${info.quant}). Запускаю замер скорости.")
            runBenchmark(auto = true)
        } catch (t: Throwable) {
            refreshModel()
            _ui.update { it.copy(model = it.model.copy(busy = false, error = t.message ?: "Не удалось установить модель.")) }
        }
    }

    fun removeModel() = viewModelScope.launch(llmThread) { c.llm.remove(); c.prefs.edit().remove("model_sha").apply(); refreshModel() }

    /** Замер скорости на этом устройстве; при первом запуске сам выбирает число потоков. */
    fun runBenchmark(auto: Boolean = false) = viewModelScope.launch(llmThread) {
        if (c.llm.busy) return@launch
        val llm = c.llm.get() ?: run { message("Модель не загружена: ${c.llm.lastError.ifEmpty { "файл не установлен" }}"); return@launch }
        c.llm.busy = true
        try {
            val cores = Runtime.getRuntime().availableProcessors()
            val big = runCatching { ru.livebook.core.llm.LlamaLlm.bigCoreCount() }.getOrDefault(0)
            // Варианты: только быстрые ядра (если процессор их выделяет) и разное число потоков на всех ядрах.
            val options = if (!auto) listOf(_ui.value.prefs.threads to _ui.value.prefs.bigOnly)
                else (listOfNotNull(if (big in 2 until cores) big to true else null) + listOf(2, 4, 6).filter { it <= cores }.map { it to false }).distinct()
            var best: BenchResult? = null
            for ((th, bo) in options) {
                _ui.update { it.copy(benchRunning = "Замер скорости: $th потока(ов)" + (if (bo) ", быстрые ядра" else "") + "…") }
                val r = c.bench.run(llm, th, bo)
                c.bench.save(r, "${Build.MANUFACTURER} ${Build.MODEL}", memoryMb(), if (auto) "авто" else "вручную")
                if (best == null || r.tokPerSec > best.tokPerSec * 1.05) best = r
            }
            best?.let { b ->
                llm.configureThreads(b.threads, b.bigOnly)
                if (auto) { c.prefs.edit().putInt("threads", b.threads).putBoolean("big_only", b.bigOnly).putBoolean("economy", b.estimateTurnSeconds() > 20.0).apply(); loadPrefs() }
                message("Скорость: ${"%.1f".format(b.tokPerSec)} токенов/с, ${b.threads} потока(ов)" + (if (b.bigOnly) " на быстрых ядрах" else "") + ". Короткий ход — примерно ${"%.0f".format(b.estimateTurnSeconds())} с." + if (auto && b.estimateTurnSeconds() > 20.0) " Это медленно, включён экономичный режим." else "")
            }
        } catch (t: Throwable) {
            message("Замер не удался: ${t.message}")
        } finally {
            c.llm.busy = false
            _ui.update { it.copy(benchRunning = "", bench = c.bench.history(8)) }
        }
    }

    fun memoryMb(): Double {
        val am = getApplication<Application>().getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val pss = runCatching { am.getProcessMemoryInfo(intArrayOf(android.os.Process.myPid()))[0].totalPss / 1024.0 }.getOrDefault(0.0)
        return if (pss > 0) pss else Debug.getNativeHeapAllocatedSize() / 1048576.0
    }

    // ---------- книги ----------
    private fun fileName(uri: Uri): String {
        val cr = getApplication<Application>().contentResolver
        runCatching { cr.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cur -> if (cur.moveToFirst()) return cur.getString(0) ?: "" } }
        return uri.lastPathSegment ?: "book"
    }

    fun importBook(uri: Uri, charset: String? = null) {
        if (_ui.value.importing != null) { message("Сначала дождись окончания текущего разбора."); return }
        cancelImport.set(false)
        importJob = viewModelScope.launch(Dispatchers.IO) {
            val name = fileName(uri)
            _ui.update { it.copy(importing = ImportUi("Чтение файла «$name»…"), pendingCharset = null) }
            try {
                val cr = getApplication<Application>().contentResolver
                val size = runCatching { cr.openAssetFileDescriptor(uri, "r")?.use { it.length } }.getOrNull() ?: 0L
                if (size > BookImporter.MAX_BYTES) throw BookImportException("Файл слишком большой (больше 80 МБ).")
                val bytes = cr.openInputStream(uri)?.use { it.readBytes() } ?: throw BookImportException("Не удалось открыть файл.")
                val book = BookImporter.import(name, bytes, charset, c.pdf)
                val id = c.books.addBook(book)
                resumeIndexing(id, book.title)
            } catch (e: BookImportException) {
                // Нечитаемый текст в TXT — предлагаем выбрать кодировку вручную.
                val askCharset = charset == null && name.lowercase().let { it.endsWith(".txt") || !it.contains('.') } && e.userMessage.contains("кодировк")
                _ui.update { it.copy(importing = null, pendingCharset = if (askCharset) uri else null, message = e.userMessage) }
            } catch (t: Throwable) {
                _ui.update { it.copy(importing = null, message = "Не удалось добавить книгу: ${t.message ?: "неизвестная ошибка"}") }
            }
        }
    }

    private fun resumeIndexing(id: String, title: String) {
        _ui.update { it.copy(importing = ImportUi("Разбор книги «$title»", bookId = id)) }
        val done = c.books.indexBook(id, isCancelled = { cancelImport.get() }) { d, t -> _ui.update { it.copy(importing = ImportUi("Разбор книги «$title»", d, t, id)) } }
        _ui.update { it.copy(importing = null, message = if (done) "Книга «$title» разобрана." else "Разбор приостановлен. Играть можно по уже разобранным главам; продолжить — на странице книги.") }
        refreshLibrary()
        if (_ui.value.book?.id == id) openBook(id)
    }

    fun cancelImport() { cancelImport.set(true) }
    fun continueIndexing(id: String) { if (_ui.value.importing != null) return; cancelImport.set(false); viewModelScope.launch(Dispatchers.IO) { resumeIndexing(id, c.books.book(id)?.title.orEmpty()) } }
    fun dismissCharset() = _ui.update { it.copy(pendingCharset = null) }

    fun openBook(id: String) = viewModelScope.launch(Dispatchers.IO) {
        val b = c.books.book(id) ?: return@launch
        val e = c.books.entities(id); val g = c.saves.games()
        _ui.update { it.copy(screen = Screen.BOOK, book = b, entities = e, games = g) }
    }

    fun deleteBook(id: String) = viewModelScope.launch(Dispatchers.IO) { c.books.deleteBook(id); _ui.update { it.copy(screen = Screen.LIBRARY, book = null) }; refreshLibrary() }

    fun refineBook(id: String) = viewModelScope.launch(llmThread) {
        if (c.llm.busy) return@launch
        if (c.llm.get() == null) { message("Сначала установи модель в настройках."); return@launch }
        c.llm.busy = true; cancelRefine.set(false)
        try {
            val n = c.refiner.refine(id, 24, { cancelRefine.get() }) { d, t -> _ui.update { it.copy(refine = d to t) } }
            message(if (n == 0) "Все карточки уже уточнены." else "Уточнено карточек: $n.")
        } finally { c.llm.busy = false; _ui.update { it.copy(refine = null) }; openBook(id) }
    }
    fun cancelRefine() { cancelRefine.set(true); c.llm.cancel() }

    // ---------- игра ----------
    fun newGame(bookId: String, hero: String, role: String, mode: String, bookHero: Boolean) = viewModelScope.launch(Dispatchers.IO) {
        if (!c.llm.installed()) { message("Сначала установи модель: «Настройки» → «Установить модель из файла»."); return@launch }
        val id = c.game.newGame(bookId, hero, role, mode, bookHero)
        openGame(id, opening = true)
    }

    fun openGame(id: String, opening: Boolean = false) = viewModelScope.launch(Dispatchers.IO) {
        val info = c.saves.game(id) ?: return@launch
        val state = c.saves.state(id) ?: return@launch
        val feed = ArrayList<FeedItem>()
        for (t in c.saves.turns(id, 60)) {
            if (t.n > 1 || !t.action.startsWith("осматриваюсь вокруг")) feed += FeedItem("hero", t.action)
            feed += FeedItem(if (t.kind == "fallback") "notice" else "narrator", t.narrative, t.events.joinToString(" · ") { it.describe() })
        }
        c.narrator.queue.clear()
        _ui.update { it.copy(screen = Screen.GAME, game = GameUi(id, info.title, state, feed, suggestions = state.suggestions, slots = c.saves.slots(id).filter { s -> s.slot > 0 }, canUndo = c.saves.slots(id).any { s -> s.slot == 0 })) }
        if (opening) runTurn(id, null) else between(id)
    }

    fun deleteGame(id: String) = viewModelScope.launch(Dispatchers.IO) { c.saves.deleteGame(id); refreshLibrary(); _ui.value.book?.let { openBook(it.id) } }

    fun send(text: String) {
        val g = _ui.value.game ?: return
        val action = text.trim()
        if (action.isEmpty() || g.busy) return
        c.llm.cancel()   // прерываем фоновый прогрев, если он ещё идёт
        runTurn(g.id, action)
    }

    /** Пока игрок читает сцену: сводка сюжета (раз в шесть ходов) и прогрев начала следующего промпта. */
    private fun between(gameId: String) {
        if (!c.llm.installed()) return
        viewModelScope.launch(llmThread) { runCatching { if (_ui.value.game?.id == gameId && !c.llm.busy) c.game.betweenTurns(gameId, settings()) } }
    }

    private fun runTurn(gameId: String, action: String?) {
        _ui.update { s -> s.game?.let { g -> s.copy(game = g.copy(busy = true, streaming = "", status = "", feed = if (action != null) g.feed + FeedItem("hero", action) else g.feed)) } ?: s }
        c.narrator.queue.clear()
        viewModelScope.launch(llmThread) {
            c.llm.busy = true
            val listener = object : TurnListener {
                override fun onStatus(status: String) = _ui.update { s -> s.game?.let { s.copy(game = it.copy(status = status)) } ?: s }
                override fun onText(visible: String) = _ui.update { s -> s.game?.let { s.copy(game = it.copy(streaming = visible, status = "")) } ?: s }
                // Озвучка начинается с первых готовых предложений, не дожидаясь конца ответа.
                override fun onSentence(sentence: String) { c.narrator.queue.append(sentence, c.narrator.auto && c.narrator.available()) }
            }
            val r: TurnResult = try {
                if (action == null) c.game.opening(gameId, settings(), listener) else c.game.turn(gameId, action, settings(), listener)
            } catch (t: Throwable) {
                TurnResult("error", "", _ui.value.game!!.state, notice = "Ошибка хода: ${t.message}. Сохранение не затронуто.")
            } finally { c.llm.busy = false }
            val add = ArrayList<FeedItem>()
            when (r.kind) {
                "llm" -> add += FeedItem("narrator", r.narrative, (r.applied.map { it.describe() } + r.notes).joinToString(" · "))
                "system" -> add += FeedItem("system", r.narrative)
                "fallback" -> { add += FeedItem("notice", r.narrative); add += FeedItem("notice", r.notice) }
                else -> add += FeedItem("notice", r.notice.ifEmpty { c.llm.lastError.ifEmpty { "Ход не выполнен." } })
            }
            if (r.kind == "system" && c.narrator.auto && c.narrator.available()) c.narrator.queue.setText(Text.splitSentences(r.narrative), true)
            val stats = r.stats?.takeIf { r.kind == "llm" }?.let { "до первого слова ${"%.1f".format(it.ttftMs / 1000)} с · ${"%.1f".format(it.tokensPerSecond)} ток/с · весь ход ${"%.1f".format(it.totalMs / 1000)} с" }.orEmpty()
            val slots = c.saves.slots(gameId)
            _ui.update { s -> s.game?.takeIf { it.id == gameId }?.let { g ->
                s.copy(game = g.copy(busy = false, streaming = "", status = "", state = r.state, feed = (g.feed + add).takeLast(160), suggestions = r.state.suggestions.ifEmpty { g.suggestions },
                    slots = slots.filter { it.slot > 0 }, canUndo = slots.any { it.slot == 0 }, lastStats = stats.ifEmpty { g.lastStats }))
            } ?: s }
            if (r.kind == "llm") between(gameId)
        }
    }

    fun cancelGeneration() { c.llm.cancel() }

    fun undo() = viewModelScope.launch(Dispatchers.IO) {
        val g = _ui.value.game ?: return@launch
        if (g.busy) return@launch
        if (c.saves.undoLastTurn(g.id) != null) { openGame(g.id); message("Последний ход отменён. Можно сыграть его иначе.") } else message("Отменять нечего.")
    }

    fun saveSlot(slot: Int) = viewModelScope.launch(Dispatchers.IO) {
        val g = _ui.value.game ?: return@launch
        c.saves.saveSlot(g.id, slot, "Ход ${g.state.timeTick}, ${g.state.location}")
        _ui.update { s -> s.copy(game = s.game?.copy(slots = c.saves.slots(g.id).filter { it.slot > 0 }), message = "Сохранено в слот $slot.") }
    }

    fun loadSlot(slot: Int) = viewModelScope.launch(Dispatchers.IO) {
        val g = _ui.value.game ?: return@launch
        if (g.busy) return@launch
        if (c.saves.restoreSlot(g.id, slot) != null) { openGame(g.id); message("Загружен слот $slot.") }
    }

    // ---------- встроенный голос ----------
    fun installVoice(uri: Uri) = viewModelScope.launch(Dispatchers.IO) {
        try {
            message("Устанавливаю голос…")
            val name = c.narrator.builtin.install(uri)
            c.narrator.preferBuiltin = true
            c.narrator.refresh(); c.narrator.publish()
            message("Голос «$name» установлен. Он работает без интернета и без системного синтеза речи.")
        } catch (t: Throwable) { c.narrator.publish(); message(t.message ?: "Не удалось установить голос.") }
    }
    fun removeVoice() = viewModelScope.launch(Dispatchers.IO) { c.narrator.builtin.remove(); c.narrator.publish(); c.narrator.refresh() }
    fun useBuiltinVoice(on: Boolean) { c.narrator.preferBuiltin = on }

    // ---------- резервные копии ----------
    fun exportBackup(uri: Uri, includeBooks: Boolean) = viewModelScope.launch(Dispatchers.IO) {
        try {
            getApplication<Application>().contentResolver.openOutputStream(uri)?.use { c.saves.exportBackup(it, c.books, includeBooks) } ?: throw IllegalStateException("не удалось открыть файл")
            message(if (includeBooks) "Копия сохранена вместе с текстами книг." else "Копия сохранений создана (без текстов книг).")
        } catch (t: Throwable) { message("Не удалось сохранить копию: ${t.message}") }
    }

    fun importBackup(uri: Uri) = viewModelScope.launch(Dispatchers.IO) {
        try {
            val (ok, skipped) = getApplication<Application>().contentResolver.openInputStream(uri)?.use { c.saves.importBackup(it, c.books) } ?: throw BackupException("Не удалось открыть файл.")
            message("Восстановлено игр: $ok." + if (skipped > 0) " Пропущено: $skipped — для них нет книги в библиотеке (добавь книгу и повтори)." else "")
            refreshLibrary()
        } catch (e: BackupException) { message(e.message ?: "Ошибка копии.") } catch (t: Throwable) { message("Не удалось восстановить копию: ${t.message}") }
    }

    override fun onCleared() { super.onCleared(); c.narrator.queue.stop() }
}
