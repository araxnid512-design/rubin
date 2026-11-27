package ru.livebook.core.game

import ru.livebook.core.llm.GameSettings
import ru.livebook.core.llm.GenParams
import ru.livebook.core.llm.GenStats
import ru.livebook.core.llm.GrammarBuilder
import ru.livebook.core.llm.LocalLlm
import ru.livebook.core.llm.PromptBuilder
import ru.livebook.core.llm.ResponseParser
import ru.livebook.core.llm.TurnPolicy
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
    fun newGame(bookId: String, heroName: String, heroRole: String, storyMode: String, bookHero: Boolean): String {
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
        val state = GameState(
            bookId = bookId, storyMode = if (storyMode == "alternate") "alternate" else "canon",
            hero = Hero(name, heroRole.trim().take(60), gold = gold), location = start,
            inventory = items, characters = npcs, knownLocations = (listOf(start) + places.map { it.name }).distinct().take(40),
            canonFacts = books.entities(bookId, "rule").map { it.descr }.take(6),
        )
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

    private fun creativeTurn(gameId: String, state0: GameState, action: String, settings: GameSettings, listener: TurnListener): TurnResult {
        val model = llm() ?: return TurnResult("error", "", state0, notice = "Локальная модель не установлена. Открой «Настройки» → «Установить модель из файла».")
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
        val canonPersons = books.entities(state.bookId, "person").map { it.name }
        val policy = TurnPolicy.of(state, action, canonPersons)
        val grammar = GrammarBuilder.build(policy, settings)

        // Промпт должен поместиться в контекст: при нехватке сначала урезаем лор, потом историю.
        var history = settings.historyTurns
        var loreChars = settings.loreChars
        var prompt = PromptBuilder.build(state, book?.title.orEmpty(), sceneLore, actionLore, constraints, action, settings, history, loreChars)
        val budget = model.contextSize - settings.maxTokens - 16
        while (model.countTokens(prompt) > budget && (history > 0 || loreChars > 0)) {
            if (loreChars > 150) loreChars /= 2 else if (history > 0) history-- else loreChars = 0
            prompt = PromptBuilder.build(state, book?.title.orEmpty(), sceneLore, actionLore, constraints, action, settings, history, loreChars)
        }

        val avoid = PromptBuilder.EXAMPLES + " " + state.history.takeLast(2).joinToString(" ") { it.reply }
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
                model.generate(prompt, GenParams(settings.maxTokens, if (attempt == 0) settings.temp else settings.temp + 0.2f, seed = if (settings.seed < 0) -1 else settings.seed + state.timeTick * 7 + attempt, grammar = grammar, avoid = avoid)) { piece ->
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

        // Сначала то, что прямо сказал игрок (обещание, отношение), затем предложения модели; повторы отсекает движок.
        val intents = RulesEngine.intentEvents(state, action)
        val proposed = intents + parsed.events.filter { e -> intents.none { it.type == e.type } }
        val result = RulesEngine.apply(state, proposed, action, parsed.narrative, (sceneLore + actionLore).joinToString(" "))
        var next = result.state
        next = next.copy(history = (next.history + TurnBrief(action, parsed.narrative)).takeLast(6), suggestions = parsed.suggestions)
        val statsText = stats?.let { "ttft=${it.ttftMs.toInt()}мс; ${"%.1f".format(it.tokensPerSecond)} ток/с; всего ${it.totalMs.toInt()}мс; промпт ${it.promptTokens} (из кеша ${it.reusedTokens}); ответ ${it.genTokens}" }.orEmpty()
        val applied = (if (moved) listOf(GameEvent(GameEvent.MOVE, state.location)) else emptyList()) + result.applied
        val n = saves.commitTurn(gameId, state0, next, TurnRecord(0, action, parsed.narrative, applied, "llm", statsText))
        return TurnResult("llm", parsed.narrative, next, applied, result.rejected, moveNotes + result.notes, parsed.suggestions, stats, n)
    }

    private fun populate(s: GameState): GameState {
        val stems = books.search(s.bookId, s.location, 4).flatMap { Text.stems(it.text) }.toSet()
        return s.copy(characters = s.characters.map { if (it.alive && it.canon && it.lastSeen.isEmpty() && Text.stems(it.name).any { st -> st in stems }) it.copy(lastSeen = s.location) else it })
    }

    companion object {
        fun relationWord(r: Int): String = when { r >= 6 -> "близкий друг"; r >= 3 -> "друг"; r >= 1 -> "расположен"; r <= -6 -> "враг"; r <= -3 -> "враждебен"; r <= -1 -> "насторожен"; else -> "нейтрален" }
    }
}
