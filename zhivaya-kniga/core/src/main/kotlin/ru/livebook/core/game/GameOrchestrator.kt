package ru.livebook.core.game

import ru.livebook.core.llm.GameSettings
import ru.livebook.core.llm.GenParams
import ru.livebook.core.llm.GenStats
import ru.livebook.core.llm.GrammarBuilder
import ru.livebook.core.model.Quest
import ru.livebook.core.llm.LocalLlm
import ru.livebook.core.llm.PromptBuilder
import ru.livebook.core.llm.ResponseParser
import ru.livebook.core.lore.BookRepository
import ru.livebook.core.lore.EntityExtractor
import ru.livebook.core.model.GameState
import ru.livebook.core.model.Hero
import ru.livebook.core.model.Item
import ru.livebook.core.model.Morph
import ru.livebook.core.model.Npc
import ru.livebook.core.model.Text
import ru.livebook.core.model.TurnBrief
import ru.livebook.core.rules.GameEvent
import ru.livebook.core.rules.Rejected
import ru.livebook.core.rules.RulesEngine

sealed class Intent {
    object Inventory : Intent(); object Status : Intent(); object Save : Intent(); object Journal : Intent()
    object Quests : Intent(); object Characters : Intent(); object Help : Intent(); object Where : Intent()
    data class Creative(val text: String) : Intent()
}

/** Простые команды распознаются без модели и выполняются мгновенно; всё остальное — творческое действие. */
object IntentParser {
    private val MAP = listOf(
        Intent.Inventory to listOf("инвентарь", "вещи", "мои вещи", "что у меня есть", "что у меня", "рюкзак", "сумка", "что в сумке", "показать инвентарь", "проверить инвентарь", "открыть инвентарь", "проверяю инвентарь"),
        Intent.Status to listOf("статус", "состояние", "здоровье", "герой", "мой статус", "как я", "показать статус", "сколько у меня монет", "сколько монет", "монеты", "деньги"),
        Intent.Save to listOf("сохранить", "сохранить игру", "сохранение", "сохранись", "сохраниться", "сохрани", "сохрани игру"),
        Intent.Journal to listOf("журнал", "дневник", "что было", "история", "показать журнал"),
        Intent.Quests to listOf("задания", "квесты", "задание", "мои задания", "цели"),
        Intent.Characters to listOf("персонажи", "кто рядом", "кто здесь", "знакомые", "отношения"),
        Intent.Where to listOf("где я", "место", "где я нахожусь", "локация"),
        Intent.Help to listOf("помощь", "справка", "команды", "что делать", "help", "?"),
    )

    fun parse(input: String): Intent {
        val t = Text.norm(input).trim().trim('.', '!', '?', ' ').replace(Regex("\\s+"), " ")
        for ((intent, phrases) in MAP) if (t in phrases) return intent
        return Intent.Creative(input.trim())
    }
}

data class TurnResult(
    /** llm — ответ локальной модели; system — мгновенная команда; fallback — модель дала сбой; error — ход не выполнен. */
    val kind: String,
    val narrative: String,
    val state: GameState,
    val applied: List<GameEvent> = emptyList(),
    val rejected: List<Rejected> = emptyList(),
    val notes: List<String> = emptyList(),
    val suggestions: List<String> = emptyList(),
    val stats: GenStats? = null,
    val turn: Int = 0,
    val notice: String = "",
    /** Поворот сюжета, который «режиссёр» подбросил в эту сцену (для журнала проверок). */
    val beat: String = "",
    /** Книга-игра: номер страницы квеста и взята ли она готовой (без вызова модели). */
    val page: Int = 0,
    val cached: Boolean = false,
)

interface TurnListener {
    /** Нейтральный статус ожидания («Рассказчик думает…») — это не текст модели. */
    fun onStatus(status: String) {}
    /** Видимый текст сцены по мере генерации (без служебных строк). */
    fun onText(visible: String) {}
    /** Готовое предложение — его можно отдавать в озвучку. */
    fun onSentence(sentence: String) {}
}

class GameOrchestrator(private val books: BookRepository, private val saves: SaveRepository, private val llm: () -> LocalLlm?) {

    /** Создание приключения: стартовое место, персонажи и вещи берутся из уже проиндексированной части книги. */
    fun newGame(bookId: String, heroName: String, heroRole: String, storyMode: String, bookHero: Boolean, gamebook: Boolean = false, rng: kotlin.random.Random = kotlin.random.Random.Default): String {
        val book = books.book(bookId) ?: throw IllegalArgumentException("книга не найдена")
        val persons = books.entities(bookId, "person")
        val places = books.entities(bookId, "place")
        val name = heroName.trim().ifEmpty { "Странник" }
        // Стартовое место: самое раннее в книге; конкретное заведение («…» в названии) предпочтительнее целого края.
        val startEntity = places.sortedWith(compareBy({ it.firstChapter }, { if ('«' in it.name) 0 else 1 }, { -it.freq })).firstOrNull()
        val start = startEntity?.name ?: "Начало пути"
        val nearStems = books.search(bookId, start, 6).filter { it.chapterIdx == (startEntity?.firstChapter ?: 0) }.flatMap { Text.stems(it.text) }.toSet()
        val heroStem = Text.stemKey(name)
        val npcs = persons.filter { !(bookHero && it.stem == heroStem) }.take(40).map { p ->
            Npc(Text.slug(p.name), p.name, lastSeen = if (p.firstChapter == (startEntity?.firstChapter ?: 0) && Text.stems(p.name).any { it in nearStems }) start else "", note = p.descr)
        }.distinctBy { it.id }
        var gold = 3
        var items = emptyList<Item>()
        if (bookHero) {
            val kit = startKit(bookId, name)
            gold = kit.first; items = kit.second
        }
        // Запертые места книги и главная цель героя — основа сюжета.
        val locks = books.entities(bookId, "lock")
        val goal = (if (bookHero) StoryDirector.mainQuest(books, bookId, name) else null) ?: StoryDirector.mysteryQuest(books, bookId, start)
        var state = GameState(
            bookId = bookId, storyMode = if (storyMode == "alternate") "alternate" else "canon",
            hero = Hero(name, heroRole.trim().take(60), gold = gold), location = start,
            inventory = items, characters = npcs, knownLocations = (listOf(start) + places.map { it.name } + locks.map { it.name }).distinct().take(40),
            lockedLocations = locks.map { it.name }.filter { Text.stemKey(it) != Text.stemKey(start) },
            canonFacts = (books.entities(bookId, "rule").map { it.descr } + locks.map { it.descr }).distinct().take(8),
            quests = listOfNotNull(goal?.let { Quest("main", it.replaceFirstChar { c -> c.uppercase() }) }),
        )
        state = state.copy(suggestions = Suggestions.build(state))
        // Книга-игра: бросаем кубики на Ловкость, Силу и Удачу.
        if (gamebook) {
            // Карта открывается по главам: в начале известны только места первой главы.
            val first = books.entities(bookId).filter { it.kind in GamebookEngine.PLACE_KINDS && it.firstChapter <= (startEntity?.firstChapter ?: 0) }.map { it.name }
            state = GamebookEngine.rollHero(state.copy(knownLocations = (listOf(start) + first).distinctBy { Text.stemKey(it) }.take(40)), rng)
        }
        return saves.createGame(bookId, "$name — ${book.title}", state)
    }

    /** Стартовые вещи героя книги: ищем рядом с его именем числа монет и предметы из словаря (детерминированно). */
    private fun startKit(bookId: String, hero: String): Pair<Int, List<Item>> {
        var gold = 0
        val items = LinkedHashMap<String, Item>()
        val heroStems = Text.stems(hero).toSet()
        for (hit in books.search(bookId, "$hero принёс имел с собой монеты", 6)) {
            for (s in Text.splitSentences(hit.text)) {
                if (!RulesEngine.hasAny(s, listOf("принёс", "принес", "с собой", "имел", "было при", "в кармане", "за поясом", "носил", "хранил", "взял из дома", "достал"))) continue
                val around = Text.stems(hit.text).toSet()
                if (heroStems.none { it in around }) continue
                if (gold == 0) RulesEngine.namedCoins(s)?.let { gold = it }
                val words = s.split(Regex("[^А-Яа-яЁё-]+")).filter { it.isNotEmpty() }
                for ((i, w) in words.withIndex()) {
                    val st = Text.stem(w)
                    if (st !in EntityExtractor.ITEM_NOUNS || st.startsWith("монет")) continue
                    val adj = words.getOrNull(i - 1)?.takeIf { it[0].isLowerCase() && Regex("(ый|ий|ой|ая|яя|ое|ее|ые|ие|ую|юю)$").containsMatchIn(it) }
                    val nm = (if (adj != null) "$adj $w" else w).lowercase()
                    val tail = words.getOrNull(i + 1)?.takeIf { Text.stem(it) in EntityExtractor.ITEM_NOUNS && Text.stem(w).startsWith("обрыв") }
                    val full = if (tail != null) "$nm ${tail.lowercase()}" else nm
                    if (items.size < 5) items.putIfAbsent(Text.stemKey(full), Item(Text.slug(full), full))
                }
            }
        }
        return (if (gold == 0) 3 else gold) to items.values.filter { cand -> items.values.none { it !== cand && it.name.length > cand.name.length && Text.stems(it.name).containsAll(Text.stems(cand.name)) } }
    }

    fun turn(gameId: String, input: String, settings: GameSettings = GameSettings(), listener: TurnListener = object : TurnListener {}): TurnResult {
        val state = saves.state(gameId) ?: throw IllegalArgumentException("игра не найдена")
        val action = input.trim()
        if (action.isEmpty()) return TurnResult("error", "", state, notice = "Напиши, что делает герой.")
        return when (val intent = IntentParser.parse(action)) {
            is Intent.Creative -> creativeTurn(gameId, state, intent.text, settings, listener)
            else -> systemTurn(gameId, state, intent)
        }
    }

    /** Вступительная сцена — тоже настоящая генерация модели. */
    fun opening(gameId: String, settings: GameSettings = GameSettings(), listener: TurnListener = object : TurnListener {}): TurnResult {
        val state = saves.state(gameId) ?: throw IllegalArgumentException("игра не найдена")
        return creativeTurn(gameId, state, "осматриваюсь вокруг и прислушиваюсь", settings, listener)
    }

    private fun systemTurn(gameId: String, s: GameState, intent: Intent): TurnResult {
        val text = when (intent) {
            Intent.Inventory -> if (s.inventory.isEmpty()) "У тебя нет вещей. Монет: ${s.hero.gold}." else "У тебя: " + s.inventory.joinToString(", ") { if (it.qty > 1) "${it.name} (${it.qty})" else it.name } + ". Монет: ${s.hero.gold}."
            Intent.Status -> "${s.hero.name}${if (s.hero.role.isBlank()) "" else ", " + s.hero.role}. Здоровье ${s.hero.hp} из ${s.hero.maxHp}, монет ${s.hero.gold}. Место: ${s.location}. Ход ${s.timeTick}."
            Intent.Save -> { saves.saveSlot(gameId, 1, "Быстрое сохранение"); "Игра сохранена в слот 1." }
            Intent.Journal -> if (s.journal.isEmpty()) "Журнал пока пуст." else s.journal.takeLast(8).joinToString("\n")
            Intent.Quests -> s.quests.filter { it.status == "active" }.let { q -> if (q.isEmpty()) "Активных заданий нет." else "Задания: " + q.joinToString("; ") { it.title } + "." }
            Intent.Characters -> s.nearbyNpcs().let { n -> if (n.isEmpty()) "Рядом никого знакомого." else "Рядом: " + n.joinToString(", ") { "${it.name} (${relationWord(it.relation)})" } + "." }
            Intent.Where -> "Ты здесь: ${s.location}."
            else -> "Пиши любое действие своими словами — например: «спрошу хозяйку о брате». Быстрые команды: инвентарь, статус, журнал, задания, кто рядом, сохранить."
        }
        return TurnResult("system", text, s, suggestions = s.suggestions)
    }

    /**
     * Перемещение — явное намерение игрока, поэтому его решает движок, а не модель:
     * место определяется по тексту действия, запертые пути проверяются правилами.
     */
    private fun resolveMove(state: GameState, action: String): Pair<GameState, List<String>> {
        if (!RulesEngine.hasAny(action, RulesEngine.MOVE)) return state to emptyList()
        val known = state.knownLocations.filter { Text.stemKey(it) != Text.stemKey(state.location) }
            .filter { loc -> Text.stems(loc).lastOrNull { it.length >= 3 }?.let { it in Text.stems(action) } == true }
            .maxByOrNull { loc -> Text.stems(loc).count { it in Text.stems(action) } }
        val target = known ?: Morph.destination(action) ?: return state to emptyList()
        if (Text.stemKey(target) == Text.stemKey(state.location)) return state to emptyList()
        val r = RulesEngine.apply(state.copy(timeTick = state.timeTick - 1), listOf(GameEvent(GameEvent.MOVE, target)), action, target)
        return if (r.applied.isEmpty()) state to r.rejected.map { "Путь в «$target» закрыт: ${it.reason}." } + r.notes else populate(r.state) to r.notes
    }

    private fun creativeTurn(gameId: String, state0: GameState, action: String, settings0: GameSettings, listener: TurnListener): TurnResult {
        val model = llm() ?: return TurnResult("error", "", state0, notice = "Локальная модель не установлена. Открой «Настройки» → «Установить модель из файла».")
        val settings = settings0.copy(small = model.isSmall)
        val (state, moveNotes) = resolveMove(state0, action)
        val moved = state.location != state0.location
        val book = books.book(state.bookId)
        listener.onStatus("Рассказчик обдумывает сцену…")
        val near = state.nearbyNpcs().map { it.name }
        // Лор сцены зависит только от места и тех, кто рядом, — он не меняется от хода к ходу и остаётся в KV-кеше.
        val sceneLore = books.search(state.bookId, "${state.location} ${near.joinToString(" ")}", if (settings.economy) 1 else 2).map { it.text }
        val actionLore = if (settings.economy) emptyList() else books.search(state.bookId, action, 2).map { it.text }
        val lexicon = EntityExtractor.ITEM_NOUNS
        val constraints = RulesEngine.constraints(state, action, lexicon) + moveNotes.filter { it.startsWith("Путь") } + (if (moved) listOf("Герой только что пришёл сюда: ${state.location}.") else emptyList())
        val grammar = GrammarBuilder.build(near, settings)
        // «Режиссёр сюжета»: зацепка из книги или осложнение для этой сцены.
        val beat = StoryDirector.beat(state, books, action)

        // Промпт должен поместиться в контекст: при нехватке сначала урезаем лор, потом историю.
        var history = settings.historyTurns
        var loreChars = settings.loreChars
        var prompt = PromptBuilder.build(state, book?.title.orEmpty(), sceneLore, actionLore, constraints, beat.text, action, settings, history, loreChars)
        val budget = model.contextSize - settings.maxTokens - 16
        while (model.countTokens(prompt) > budget && (history > 0 || loreChars > 0)) {
            if (loreChars > 150) loreChars /= 2 else if (history > 0) history-- else loreChars = 0
            prompt = PromptBuilder.build(state, book?.title.orEmpty(), sceneLore, actionLore, constraints, beat.text, action, settings, history, loreChars)
        }

        val recentReplies = state.history.takeLast(3).map { it.reply }
        val avoid = (recentReplies + (if (settings.small) listOf(PromptBuilder.EXAMPLES) else emptyList())).joinToString(" ").ifEmpty { null }
        var parsed = ResponseParser.parse("", action)
        var stats: GenStats? = null
        var raw = ""
        var cancelled = false
        for (attempt in 0..1) {
            val sb = StringBuilder()
            var shown = ""
            var spoken = 0
            if (attempt == 1) { listener.onStatus("Ответ получился негодным — рассказчик пробует ещё раз…"); listener.onText("") }
            val res = try {
                model.generate(prompt, GenParams(settings.maxTokens, if (attempt == 0) settings.temp else settings.temp + 0.2f, seed = if (settings.seed < 0) -1 else settings.seed + state.timeTick * 7 + attempt, grammar = grammar, avoid = avoid, repeatPenalty = if (settings.small) 1.18f else 1.1f)) { piece ->
                    sb.append(piece)
                    val vis = ResponseParser.visible(sb.toString())
                    if (attempt == 0 && vis != shown) {
                        shown = vis
                        listener.onText(vis)
                        val done = Text.splitSentences(vis).let { ss -> if (vis.isNotEmpty() && vis.last() in ".!?…»" || sb.contains("\nИТОГ")) ss else ss.dropLast(1) }
                        while (spoken < done.size) listener.onSentence(done[spoken++])
                    }
                    true
                }
            } catch (e: Exception) {
                return TurnResult("error", "", state0, notice = "Сбой локальной модели: ${e.message}. Сохранение не затронуто.")
            }
            stats = res.stats
            raw = res.text
            if (res.stats.stopReason == 2) { cancelled = true; break }
            parsed = ResponseParser.parse(raw, action)
            // Самоповтор: сцена почти дословно совпала с прошлой или с примером из промпта — первая попытка бракуется.
            if (parsed.valid && attempt == 0) {
                val first = Text.splitSentences(parsed.narrative).firstOrNull().orEmpty()
                val same = (recentReplies + PromptBuilder.EXAMPLES).any { old -> ResponseParser.overlap(parsed.narrative, old) > 0.7 || Text.splitSentences(old).any { ResponseParser.overlap(first, it) > 0.6 } }
                if (same) parsed = parsed.copy(valid = false, problem = "повтор прошлой сцены")
            }
            if (parsed.valid) {
                if (attempt == 1) { listener.onText(parsed.narrative); Text.splitSentences(parsed.narrative).forEach { listener.onSentence(it) } }
                else { val all = Text.splitSentences(parsed.narrative); while (spoken < all.size) listener.onSentence(all[spoken++]) }
                break
            }
        }
        if (cancelled) return TurnResult("error", "", state0, stats = stats, notice = "Генерация остановлена. Ход не засчитан, сохранение не изменилось.")

        if (!parsed.valid) {
            // Честный запасной вариант: мир не меняется, игроку прямо сказано о сбое.
            val text = "Мгновение ничего не происходит — мир будто замер."
            val next = state0.copy(timeTick = state0.timeTick + 1)
            val n = saves.commitTurn(gameId, state0, next, TurnRecord(0, action, text, kind = "fallback"))
            listener.onText(text)
            return TurnResult("fallback", text, next, stats = stats, turn = n, suggestions = state0.suggestions,
                notice = "Локальная модель дважды дала негодный ответ (${parsed.problem}). Показана запасная фраза, состояние мира не менялось. Попробуй переформулировать действие.")
        }

        // Изменения мира выводятся из слов игрока и текста сцены, затем проверяются движком.
        val loreText = (sceneLore + actionLore).joinToString(" ")
        val proposed = RulesEngine.infer(state, action, parsed.narrative, loreText, lexicon, state.history.takeLast(2).joinToString(" ") { it.reply }, books.entities(state.bookId, "item").map { it.name })
        val result = RulesEngine.apply(beat.state, proposed, action, parsed.narrative, loreText)
        var next = result.state
        next = next.copy(history = (next.history + TurnBrief(action, parsed.narrative)).takeLast(6))
        next = next.copy(suggestions = Suggestions.build(next))
        val statsText = stats?.let { "ttft=${it.ttftMs.toInt()}мс; ${"%.1f".format(it.tokensPerSecond)} ток/с; всего ${it.totalMs.toInt()}мс; промпт ${it.promptTokens} (из кеша ${it.reusedTokens}); ответ ${it.genTokens}" }.orEmpty()
        val applied = (if (moved) listOf(GameEvent(GameEvent.MOVE, state.location)) else emptyList()) + result.applied
        val n = saves.commitTurn(gameId, state0, next, TurnRecord(0, action, parsed.narrative, applied, "llm", statsText))
        return TurnResult("llm", parsed.narrative, next, applied, result.rejected, moveNotes + result.notes, next.suggestions, stats, n, beat = beat.text)
    }

    /**
     * Ход книги-игры. Сначала правила и кубики решают, чем кончился выбор (это не зависит от модели),
     * затем модель пишет параграф об уже случившемся. [choiceId] = "start" — первый параграф.
     */
    fun gamebookTurn(gameId: String, choiceId: String, settings0: GameSettings = GameSettings(), listener: TurnListener = object : TurnListener {}, rng: kotlin.random.Random = kotlin.random.Random.Default): TurnResult {
        val state0 = saves.state(gameId) ?: throw IllegalArgumentException("игра не найдена")
        val gb0 = state0.gamebook ?: return TurnResult("error", "", state0, notice = "Это приключение не в режиме книги-игры.")
        val label = if (choiceId == "start") "Начало" else GamebookEngine.choices(state0).firstOrNull { it.id == choiceId }?.label ?: return TurnResult("error", "", state0, notice = "Такого выбора сейчас нет.")
        val settings = settings0.copy(small = llm()?.isSmall ?: false, gamebook = true)
        listener.onStatus("Кубики брошены. Рассказчик пишет параграф…")
        val out = GamebookEngine.apply(state0, choiceId, rng, books) { st, source -> StoryDirector.clue(st, books, source) }
        val state = populate(out.state)
        val gb = state.gamebook!!
        val near = state.nearbyNpcs().map { it.name }
        val enemy = gb.combat?.enemy ?: gb0.combat?.enemy.orEmpty()
        val note = GameEvent("note", out.note)
        // Страницы квеста постоянны: тот же поворот событий в этой книге всегда ведёт на ту же страницу, без вызова модели.
        val key = pageKey(state, out, gb0.combat?.round ?: 0)
        books.page(state.bookId, key)?.let { (num, body) ->
            listener.onText(body); Text.splitSentences(body).forEach { listener.onSentence(it) }
            val next = state.copy(history = (state.history + TurnBrief(out.action, body)).takeLast(6))
            val n = saves.commitTurn(gameId, state0, next, TurnRecord(0, "Страница $num. $label", body, listOf(note), "page", ""))
            return TurnResult("llm", body, next, listOf(note), notes = listOf(out.note), turn = n, beat = out.beat, page = num, cached = true)
        }
        val model = llm() ?: return TurnResult("error", "", state0, notice = "Эта страница квеста ещё не написана, а модель не установлена. Установи модель в настройках или подготовь квест заранее.")
        val sceneLore = books.search(state.bookId, "${state.location} ${near.joinToString(" ")}", if (settings.economy) 1 else 2).map { it.text }
        val grammar = GrammarBuilder.build(near, settings, enemy)
        var history = settings.historyTurns; var loreChars = settings.loreChars
        var prompt = PromptBuilder.build(state, books.book(state.bookId)?.title.orEmpty(), sceneLore, emptyList(), out.important, out.beat, out.action, settings, history, loreChars)
        val budget = model.contextSize - settings.maxTokens - 16
        while (model.countTokens(prompt) > budget && (history > 0 || loreChars > 0)) {
            if (loreChars > 150) loreChars /= 2 else if (history > 0) history-- else loreChars = 0
            prompt = PromptBuilder.build(state, books.book(state.bookId)?.title.orEmpty(), sceneLore, emptyList(), out.important, out.beat, out.action, settings, history, loreChars)
        }
        val recent = state0.history.takeLast(3).map { it.reply }
        val avoid = (recent + (if (settings.small) listOf(PromptBuilder.GAMEBOOK_EXAMPLES) else emptyList())).joinToString(" ").ifEmpty { null }
        var parsed = ResponseParser.parse("", out.action)
        var stats: GenStats? = null
        for (attempt in 0..1) {
            val sb = StringBuilder(); var shown = ""; var spoken = 0
            if (attempt == 1) listener.onText("")
            val res = try {
                model.generate(prompt, GenParams(settings.maxTokens, if (attempt == 0) settings.temp else settings.temp + 0.2f, seed = if (settings.seed < 0) -1 else settings.seed + state.timeTick * 7 + attempt, grammar = grammar, avoid = avoid, repeatPenalty = (if (settings.small) 1.18f else 1.1f) + attempt * 0.15f)) { piece ->
                    sb.append(piece)
                    val vis = ResponseParser.visible(sb.toString())
                    if (attempt == 0 && vis != shown) {
                        shown = vis; listener.onText(vis)
                        val done = Text.splitSentences(vis).let { ss -> if (vis.isNotEmpty() && vis.last() in ".!?…»") ss else ss.dropLast(1) }
                        while (spoken < done.size) listener.onSentence(done[spoken++])
                    }
                    true
                }
            } catch (e: Exception) { return TurnResult("error", "", state0, notice = "Сбой локальной модели: ${e.message}. Ход не засчитан.") }
            stats = res.stats
            if (res.stats.stopReason == 2) return TurnResult("error", "", state0, stats = stats, notice = "Генерация остановлена. Ход не засчитан, кубики будут брошены заново.")
            parsed = ResponseParser.parse(res.text, "")
            if (parsed.valid && attempt == 0) {
                val first = Text.splitSentences(parsed.narrative).firstOrNull().orEmpty()
                if (SERVICE.any { parsed.narrative.contains(it) }) parsed = parsed.copy(valid = false, problem = "служебное слово в тексте")
                else if ((recent + PromptBuilder.GAMEBOOK_EXAMPLES).any { old -> ResponseParser.overlap(parsed.narrative, old) > 0.7 || Text.splitSentences(old).any { ResponseParser.overlap(first, it) > 0.6 } }) parsed = parsed.copy(valid = false, problem = "повтор прошлого параграфа")
            }
            // Вторая попытка: служебные слова вырезаются вместе с предложением.
            if (attempt == 1 && parsed.valid && SERVICE.any { parsed.narrative.contains(it) }) {
                val clean = Text.splitSentences(parsed.narrative).filter { st -> SERVICE.none { st.contains(it) } }.joinToString(" ")
                parsed = if (clean.length >= 12) parsed.copy(narrative = clean) else parsed.copy(valid = false, problem = "служебное слово в тексте")
            }
            if (parsed.valid) {
                if (attempt == 1) { listener.onText(parsed.narrative); Text.splitSentences(parsed.narrative).forEach { listener.onSentence(it) } }
                else { val all = Text.splitSentences(parsed.narrative); while (spoken < all.size) listener.onSentence(all[spoken++]) }
                break
            }
        }
        // Механика уже сработала, поэтому при сбое модели параграф заменяется сухой записью исхода — и об этом сказано прямо.
        val failed = !parsed.valid
        val narrative = if (failed) (out.important.joinToString(" ").ifEmpty { "Вы действуете, как решили." }).also { listener.onText(it) } else parsed.narrative
        val next = state.copy(history = (state.history + TurnBrief(out.action, narrative)).takeLast(6))
        val statsText = stats?.let { "ttft=${it.ttftMs.toInt()}мс; ${"%.1f".format(it.tokensPerSecond)} ток/с; всего ${it.totalMs.toInt()}мс" }.orEmpty()
        val num = if (failed) 0 else books.putPage(state.bookId, key, narrative)
        val n = saves.commitTurn(gameId, state0, next, TurnRecord(0, if (num > 0) "Страница $num. $label" else label, narrative, listOf(note), if (failed) "fallback" else "llm", statsText))
        return TurnResult(if (failed) "fallback" else "llm", narrative, next, listOf(note), notes = listOf(out.note), stats = stats, turn = n, beat = out.beat, page = num,
            notice = if (failed) "Модель дважды дала негодный текст (${parsed.problem}), поэтому параграф заменён краткой записью исхода. Сам ход засчитан." else "")
    }

    /** Ключ страницы: всё, от чего зависит её текст (место, выбор, исход, зацепка), — но не броски кубиков и не лист героя. */
    private fun pageKey(state: GameState, out: GamebookEngine.Outcome, round: Int): String {
        // Страницы боя общие для всех мест: они зависят только от противника и исхода раунда.
        val fight = round >= 0 && out.action.startsWith("сражаться")
        val raw = listOf(state.storyMode, state.hero.name, if (fight) "" else state.location, if (fight) "" else state.nearbyNpcs().joinToString(",") { it.name }, out.action, out.important.joinToString("/"), out.beat).joinToString("|")
        return java.security.MessageDigest.getInstance("MD5").digest(raw.toByteArray()).joinToString("") { "%02x".format(it) }
    }

    /**
     * Подготовка квеста заранее: несколько пробных прохождений подряд, в каждом выбирается то, что ещё не пробовали.
     * Все встреченные страницы пишутся моделью и сохраняются; потом игра идёт мгновенно — выбор просто открывает готовую страницу.
     * Можно остановить и продолжить: написанные страницы не теряются. Возвращает число новых страниц.
     */
    fun prepareQuest(bookId: String, heroName: String, heroRole: String, storyMode: String, bookHero: Boolean, settings: GameSettings = GameSettings(), runs: Int = 24,
                     isCancelled: () -> Boolean = { false }, onProgress: (pages: Int, run: Int) -> Unit = { _, _ -> }): Int {
        val tried = HashMap<String, Int>()
        var created = 0; var quiet = 0
        for (run in 0 until runs) {
            if (isCancelled()) break
            val rng = kotlin.random.Random(1000 + run * 77)
            val g = newGame(bookId, heroName, heroRole, storyMode, bookHero, gamebook = true, rng = rng)
            var choice = "start"; var steps = 0; var fresh = 0
            try {
                while (steps < 90 && !isCancelled()) {
                    val r = gamebookTurn(g, choice, settings, rng = rng); steps++
                    if (r.kind == "error") break
                    if (!r.cached && r.kind == "llm") { created++; fresh++ }
                    onProgress(books.pageCount(bookId), run + 1)
                    val gb = r.state.gamebook ?: break
                    if (gb.dead || gb.won || gb.choices.isEmpty()) break
                    val where = "${r.state.location}|${gb.combat?.enemy}|${r.state.stage}|${r.state.inventory.size}"
                    val pick = gb.choices.withIndex().minByOrNull { (i, c) -> (tried["$where|${c.id}"] ?: 0) * 10 + (i + run) % gb.choices.size }!!.value
                    tried.merge("$where|${pick.id}", 1, Int::plus)
                    choice = pick.id
                }
            } finally { saves.deleteGame(g) }
            quiet = if (fresh <= 1) quiet + 1 else 0
            if (run >= 4 && quiet >= 4) break   // четыре прохождения подряд почти без новых страниц — квест готов
        }
        return created
    }

    /**
     * Работа между ходами, пока игрок читает сцену: раз в шесть ходов — сводка сюжета, затем прогрев KV-кеша
     * началом следующего промпта. Вызывать в потоке модели после показа ответа.
     */
    fun betweenTurns(gameId: String, settings0: GameSettings = GameSettings()): Boolean {
        val model = llm() ?: return false
        var state = saves.state(gameId) ?: return false
        val settings = settings0.copy(small = model.isSmall, gamebook = state.gamebook != null)
        var summarized = false
        if (state.timeTick >= 6 && state.timeTick - state.summaryTick >= 6 && state.history.size >= 3) {
            state = state.copy(summary = (state.summary + summarize(model, state)).takeLast(3), summaryTick = state.timeTick)
            saves.updateState(gameId, state)
            summarized = true
        }
        val near = state.nearbyNpcs().map { it.name }
        val sceneLore = books.search(state.bookId, "${state.location} ${near.joinToString(" ")}", if (settings.economy) 1 else 2).map { it.text }
        model.warm(PromptBuilder.prefix(state, books.book(state.bookId)?.title.orEmpty(), sceneLore, settings))
        return summarized
    }

    /** Сводка: факты из журнала (надёжно) плюс одно предложение модели, если оно опирается на события. */
    private fun summarize(model: LocalLlm, state: GameState): String {
        val facts = state.storyFacts.takeLast(4).joinToString("; ") { it.replaceFirstChar { c -> c.lowercase() } }
        val events = state.history.takeLast(6).joinToString(" ") { "Герой: ${PromptBuilder.cleanAction(it.action).take(60)}. Итог: ${PromptBuilder.brief(it.reply)}" }
        val prompt = "<|im_start|>system\nСожми события в одно короткое предложение о том, что сделал герой и к чему это привело. Пиши по-русски, в прошедшем времени, без выдумок. /no_think<|im_end|>\n" +
            "<|im_start|>user\nГерой: спрашиваю кузнеца о дороге. Итог: Гордей кивает в сторону холмов. Герой: покупаю нож. Итог: Гордей протягивает нож.<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\nГерой узнал у кузнеца дорогу и купил нож.<|im_end|>\n" +
            "<|im_start|>user\n$events<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n"
        val grammar = "root ::= \"Герой \" ch+ \".\"\nch ::= [а-яё0-9 ,;«»—-] | [А-ЯЁ] [а-яё]\n"
        val text = runCatching { model.generate(prompt, GenParams(maxTokens = 48, temp = 0.3f, seed = 5, grammar = grammar)).text.trim() }.getOrDefault("")
        val known = Text.stems(events).toSet()
        val words = Text.stems(text).filter { it.length >= 4 }
        val grounded = text.endsWith(".") && words.size >= 3 && words.count { it in known } * 10 >= words.size * 6
        return listOf(if (grounded) text else "", if (facts.isNotEmpty()) "Изменилось: $facts." else "").filter { it.isNotEmpty() }.joinToString(" ").ifEmpty { "Герой провёл время в месте «${state.location}»." }
    }

    private fun populate(s: GameState): GameState {
        val stems = books.search(s.bookId, s.location, 4).flatMap { Text.stems(it.text) }.toSet()
        return s.copy(characters = s.characters.map { if (it.alive && it.canon && it.lastSeen.isEmpty() && Text.stems(it.name).any { st -> st in stems }) it.copy(lastSeen = s.location) else it })
    }

    companion object {
        private val SERVICE = listOf("Поворот", "Зацепк", "Важно", "Выбор читателя", "Ваш выбор", "ваш выбор", "выбор привёл", "параграф")
        fun relationWord(r: Int): String = when { r >= 6 -> "близкий друг"; r >= 3 -> "друг"; r >= 1 -> "расположен"; r <= -6 -> "враг"; r <= -3 -> "враждебен"; r <= -1 -> "насторожен"; else -> "нейтрален" }
    }
}
