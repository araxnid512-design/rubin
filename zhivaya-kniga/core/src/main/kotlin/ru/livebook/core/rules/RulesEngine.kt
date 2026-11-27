package ru.livebook.core.rules

import kotlinx.serialization.Serializable
import ru.livebook.core.model.GameState
import ru.livebook.core.model.Item
import ru.livebook.core.model.Npc
import ru.livebook.core.model.Quest
import ru.livebook.core.model.Text

/** Предложенное моделью (или системой) изменение мира. Применяется только после проверки движком. */
@Serializable
data class GameEvent(val type: String, val name: String = "", val delta: Int = 0) {
    fun describe(): String = when (type) {
        ITEM_ADD -> "Получено: $name"
        ITEM_REMOVE -> "Потеряно: $name"
        GOLD -> if (delta >= 0) "Монеты: +$delta" else "Монеты: $delta"
        HP -> if (delta >= 0) "Здоровье: +$delta" else "Здоровье: $delta"
        MOVE -> "Новое место: $name"
        RELATION -> "Отношение — $name: ${if (delta >= 0) "+$delta" else "$delta"}"
        MEET -> "Встреча: $name"
        DEAD -> "Погиб: $name"
        QUEST_ADD -> "Новое задание: $name"
        QUEST_DONE -> "Задание выполнено: $name"
        UNLOCK -> "Открыт путь: $name"
        else -> name
    }
    companion object {
        const val ITEM_ADD = "item_add"; const val ITEM_REMOVE = "item_remove"; const val GOLD = "gold_delta"; const val HP = "hp_delta"
        const val MOVE = "move"; const val RELATION = "npc_relation_delta"; const val MEET = "npc_meet"; const val DEAD = "npc_dead"
        const val QUEST_ADD = "quest_add"; const val QUEST_DONE = "quest_done"; const val UNLOCK = "unlock"
        val ALL = setOf(ITEM_ADD, ITEM_REMOVE, GOLD, HP, MOVE, RELATION, MEET, DEAD, QUEST_ADD, QUEST_DONE, UNLOCK)
    }
}

data class Rejected(val event: GameEvent, val reason: String)
data class ApplyResult(val state: GameState, val applied: List<GameEvent>, val rejected: List<Rejected>, val notes: List<String>)

/**
 * Детерминированный движок правил. Модель только предлагает события; здесь проверяются
 * типы, диапазоны, существование персонажей и предметов и «улики» в тексте хода:
 * предмет нельзя получить, если о нём нет ни слова в действии или сцене, и т. д.
 */
object RulesEngine {
    const val MAX_ITEMS = 24
    val TAKE = listOf("бер", "возьм", "взя", "подним", "подбир", "подобр", "хвата", "схват", "куп", "покуп", "забир", "забер", "краду", "украд", "укра", "вору", "стащ", "прош", "попрош", "выпраш", "срыва", "сорв", "собира", "собер", "меняю", "обмен", "вымен", "получ", "снима", "сним", "приним", "выигр", "вытаск", "вытащ", "отбира", "отним", "одолж", "достаю из", "выдёрг", "выдерг", "вынима", "выну")
    /** Поиск: позволяет найти предмет, который есть в книге для этой сцены. */
    val SEARCH = listOf("обыск", "ищ", "осматрива", "осмотр", "исследу", "роюсь", "шарю", "заглядыва", "загляну", "проверя", "копа", "открыва", "откро", "ощупыва", "изуча")
    val GIVE = listOf("отда", "дар", "подар", "брос", "выбрас", "выброс", "прода", "меня", "обмен", "клад", "полож", "остав", "теря", "лома", "слома", "съед", "ем ", "выпива", "выпью", "пью", "плач", "заплат", "жертв", "вруча", "вруч", "переда", "закладыва", "трач", "сжига", "сожг", "рву", "порв", "кида", "кину", "мета", "швыр", "использ", "вставля", "скарм", "угоща")
    val PAY = listOf("плач", "заплат", "оплач", "покуп", "куп", "взятк", "подкуп", "ставк", "ставлю", "нанима", "найм", "расплач", "отсчит", "заказ", "трач", "чаев")
    val EARN = listOf("прода", "выигр", "наград", "зарабат", "заработ", "долг")
    val RISK = listOf("дерус", "дра", "бью", "удар", "атак", "напада", "напад", "сража", "прыг", "пада", "лез", "карабк", "бег", "руб", "стреля", "борюсь", "толка", "ломаю", "выбива", "штурм", "ныря", "плыв", "пью", "ем ", "съед", "трога", "хвата", "краду", "укра", "проник", "взлам", "угрож", "оскорб", "провоц", "кида", "мета", "защища", "закрыва", "уворач", "уклон", "дуэл", "вызыва", "спор")
    val REST = listOf("отдых", "сплю", "спать", "посп", "ем ", "поем", "съед", "ужина", "обеда", "завтрака", "пью", "выпью", "выпива", "леч", "перевяз", "зель", "молюсь", "греюсь", "отлеж", "бинту", "заказ", "похлёбк", "похлебк")
    val MOVE = listOf("ид", "пойд", "выхо", "выйд", "вхо", "войд", "захо", "зайд", "отправ", "бег", "беж", "еду", "поед", "поднима", "подним", "спуска", "спущ", "возвраща", "верн", "ухо", "уйд", "перехо", "перейд", "шага", "след", "направл", "лез", "плыв", "скач", "прохо", "пройд", "покида", "покин", "добира", "добер", "двига", "двин", "мчу", "крад", "прокрад", "прибега", "полз", "приближ", "подхо", "подойд", "сворач", "сверн", "бреду", "бред", "шеств", "переправ")
    val KILL = listOf("убива", "убью", "убить", "зареза", "заруб", "закалыва", "закол", "душу", "задуш", "добива", "добью", "казн", "отрав", "застрел", "прикончи", "смертельн", "пронза", "пронж", "руб", "бью", "атак", "напада", "напад", "сража", "стреля", "удар")
    val DEATH_WORDS = listOf("умира", "умер", "погиб", "мёртв", "мертв", "замертво", "убит", "бездыхан", "испуска", "последн вздох", "труп", "тело", "скончал", "не дыш")
    val PROMISE = listOf("обеща", "соглаша", "соглас", "берусь", "возьмусь", "помог", "клянусь", "покля", "принима", "найду", "узнаю", "выясню", "поручен", "задани", "договарива", "договор", "прошу о работе", "работ", "миссию", "спасу", "верну", "доставлю", "разыщу", "отыщу", "выполню", "сделаю")
    val HURT_WORDS = listOf("удар", "ран", "боль", "кров", "пада", "упал", "упада", "ожог", "обжиг", "царап", "синяк", "бьёт", "бьет", "режет", "порез", "ушиб", "слабе", "задыха", "яд", "отрав", "вывих", "ломает", "кулак", "клинок", "стрела", "когт", "зуб", "укус")
    val HEAL_WORDS = listOf("отдых", "сон", "спишь", "ешь", "еда", "пьёшь", "пьешь", "леч", "перевяз", "легче", "силы", "зель", "тепло", "сыт", "похлёбк", "похлебк", "бодр", "заживает", "исцел", "свеж")
    val COIN_WORDS = listOf("монет", "золот", "серебр", "медяк", "медн", "деньг", "плат", "кошел", "грош", "цен", "сдач", "выручк", "наград", "долг")

    val KIND = listOf("благодар", "спасибо", "помога", "помог", "угоща", "дарю", "подар", "утеша", "защища", "хвалю", "извиня", "обнима", "спаса", "лечу", "перевязыва", "делюсь", "поддержива", "выруча")
    val HOSTILE = listOf("угрожа", "оскорб", "обзыва", "бью", "удар", "напада", "напад", "атак", "толка", "обманыва", "краду у", "граблю", "плюю", "издева", "насмеха", "кричу на", "ругаю", "проклина", "предаю")

    /**
     * События, которые прямо следуют из слов игрока и не зависят от фантазии модели:
     * обещание становится заданием, доброта или враждебность к тому, кто рядом, меняет отношение.
     */
    fun intentEvents(state: GameState, action: String): List<GameEvent> {
        val out = ArrayList<GameEvent>()
        val near = state.nearbyNpcs().filter { Text.mentions(action, it.name) }
        val target = near.firstOrNull() ?: state.nearbyNpcs().singleOrNull()
        if (target != null) {
            if (hasAny(action, HOSTILE)) out += GameEvent(GameEvent.RELATION, target.name, -1)
            else if (hasAny(action, KIND)) out += GameEvent(GameEvent.RELATION, target.name, 1)
        }
        Regex("(?<![а-яё])(обещаю|клянусь|берусь|обязуюсь|даю слово)\\s+(.{6,80})", RegexOption.IGNORE_CASE).find(action)?.let { m ->
            var t = m.groupValues[2].trim().trim('.', '!', ',', ' ')
            t = t.replace(Regex("^(ей|ему|им|тебе|вам|что|,)\\s+", RegexOption.IGNORE_CASE), "").replace(Regex("^(ей|ему|им|что)\\s+", RegexOption.IGNORE_CASE), "")
            t = t.split(Regex("[,;.!?]| и затем | а потом ")).first().trim()
            if (t.length >= 5) out += GameEvent(GameEvent.QUEST_ADD, t.take(60))
        }
        return out
    }

    /** Герой платит: явные глаголы оплаты либо «отдаю/даю … монеты». */
    fun pays(action: String): Boolean = hasAny(action, PAY) || (hasAny(action, GIVE + listOf("даю", "дам")) && hasAny(action, COIN_WORDS))
    /** Герой пытается получить деньги: продажа, выигрыш, награда либо «беру/ищу/краду … монеты». */
    fun earns(action: String): Boolean = hasAny(action, EARN) || (hasAny(action, TAKE) && hasAny(action, COIN_WORDS))

    fun hasAny(text: String, stems: List<String>): Boolean {
        val t = " " + Text.norm(text) + " "
        return stems.any { s -> Regex("(?<![а-я])" + Regex.escape(s.trim())).containsMatchIn(t) }
    }

    fun apply(state: GameState, events: List<GameEvent>, action: String, narrative: String, lore: String = ""): ApplyResult {
        var s = state
        val applied = ArrayList<GameEvent>()
        val rejected = ArrayList<Rejected>()
        val notes = ArrayList<String>()
        val both = "$action $narrative"
        var itemsAdded = 0
        val seen = HashSet<String>()
        for (raw in events.take(4)) {
            val e = raw.copy(name = raw.name.trim().trim('«', '»', '"', '.', ' ').take(60))
            fun no(reason: String) { rejected += Rejected(e, reason) }
            if (e.type !in GameEvent.ALL) { no("неизвестный тип события"); continue }
            if (!seen.add(e.type + "|" + Text.stemKey(e.name))) { no("повтор события"); continue }
            when (e.type) {
                GameEvent.ITEM_ADD -> {
                    if (e.name.length < 2 || !e.name.any { it.isLetter() }) { no("пустое название предмета"); continue }
                    if (itemsAdded >= 1) { no("не больше одного нового предмета за ход"); continue }
                    if (s.inventory.size >= MAX_ITEMS) { no("инвентарь полон"); continue }
                    // Взять можно то, что игрок сам назвал; найти при поиске — только то, что есть в книге для этой сцены.
                    val named = hasAny(action, TAKE) && Text.mentions(action, e.name)
                    val found = hasAny(action, SEARCH) && Text.mentions(narrative, e.name) && Text.mentions(lore, e.name)
                    if (!named && !found) { no(if (hasAny(action, TAKE + SEARCH)) "такого предмета нет ни в действии героя, ни в книге для этой сцены" else "герой не пытался ничего взять"); continue }
                    val have = s.findItem(e.name)
                    s = if (have != null && Text.stemKey(have.name) == Text.stemKey(e.name)) s.copy(inventory = s.inventory.map { if (it.id == have.id) it.copy(qty = it.qty + 1) else it })
                    else s.copy(inventory = s.inventory + Item(uniqueId(Text.slug(e.name), s.inventory.map { it.id }), e.name.lowercase()))
                    itemsAdded++; applied += e
                }
                GameEvent.ITEM_REMOVE -> {
                    val have = s.findItem(e.name)
                    if (have == null) { no("у героя нет такого предмета"); continue }
                    if (!hasAny(action, GIVE)) { no("герой не отдавал и не тратил предмет"); continue }
                    if (!Text.mentions(action, have.name)) { no("предмет не упоминается в действии"); continue }
                    s = s.copy(inventory = if (have.qty > 1) s.inventory.map { if (it.id == have.id) it.copy(qty = it.qty - 1) else it } else s.inventory.filter { it.id != have.id })
                    applied += e.copy(name = have.name)
                }
                GameEvent.GOLD -> {
                    if (e.delta == 0 || e.delta !in -99..20) { no("недопустимая сумма"); continue }
                    if (e.delta < 0) {
                        if (s.hero.gold + e.delta < 0) { no("у героя не хватает монет"); continue }
                        if (!pays(action)) { no("герой ничего не платил"); continue }
                    } else {
                        if (!earns(action)) { no("герой не делал ничего, что приносит монеты"); continue }
                        if (!hasAny(narrative, COIN_WORDS)) { no("в сцене нет ни слова о монетах"); continue }
                    }
                    s = s.copy(hero = s.hero.copy(gold = s.hero.gold + e.delta)); applied += e
                }
                GameEvent.HP -> {
                    if (e.delta == 0 || e.delta !in -3..3) { no("недопустимое изменение здоровья"); continue }
                    if (e.delta < 0 && !(hasAny(action, RISK) || hasAny(narrative, HURT_WORDS))) { no("нет причины для раны"); continue }
                    if (e.delta > 0 && !(hasAny(action, REST) && hasAny(both, HEAL_WORDS))) { no("нет причины для лечения"); continue }
                    if (e.delta > 0 && s.hero.hp >= s.hero.maxHp) { no("герой и так здоров"); continue }
                    val hp = (s.hero.hp + e.delta).coerceIn(0, s.hero.maxHp)
                    s = s.copy(hero = s.hero.copy(hp = hp)); applied += e
                }
                GameEvent.MOVE -> {
                    if (e.name.length < 2) { no("не указано место"); continue }
                    if (Text.stemKey(e.name) == Text.stemKey(s.location)) { no("герой уже здесь"); continue }
                    if (!hasAny(action, MOVE)) { no("герой никуда не шёл"); continue }
                    if (!Text.mentions(both, e.name)) { no("место не упоминается ни в действии, ни в сцене"); continue }
                    val known = s.knownLocations.firstOrNull { Text.stemKey(it) == Text.stemKey(e.name) } ?: s.knownLocations.firstOrNull { Text.stems(it).last() == Text.stems(e.name).last() && Text.stems(e.name).size == 1 }
                    val target = known ?: e.name.replaceFirstChar { it.uppercase() }
                    val locked = s.lockedLocations.firstOrNull { Text.stemKey(it) == Text.stemKey(target) }
                    if (locked != null) {
                        val key = s.inventory.firstOrNull { Text.mentions(it.name, "ключ") || Text.mentions(it.name, "отмычка") }
                        if (key == null || !Text.mentions(action, key.name)) { no("путь заперт: нужен ключ"); notes += "Путь в «$locked» заперт."; continue }
                        s = s.copy(lockedLocations = s.lockedLocations - locked); notes += "«${key.name}» открывает путь."
                    }
                    s = s.copy(location = target, knownLocations = if (known == null) s.knownLocations + target else s.knownLocations)
                    applied += e.copy(name = target)
                }
                GameEvent.RELATION -> {
                    val npc = s.findNpc(e.name)
                    if (npc == null) { no("такого персонажа нет"); continue }
                    if (!npc.alive) { no("персонаж мёртв"); continue }
                    if (e.delta == 0 || e.delta !in -2..2) { no("недопустимое изменение отношения"); continue }
                    if (!Text.mentions(both, npc.name) && state.nearbyNpcs().none { it.id == npc.id }) { no("персонаж не участвует в сцене"); continue }
                    s = s.copy(characters = s.characters.map { if (it.id == npc.id) it.copy(relation = (it.relation + e.delta).coerceIn(-10, 10), lastSeen = s.location) else it })
                    applied += e.copy(name = npc.name)
                }
                GameEvent.MEET -> {
                    val npc = s.findNpc(e.name)
                    if (npc != null) {
                        if (!npc.alive) { no("персонаж мёртв и не может появиться"); continue }
                        if (!Text.mentions(both, npc.name)) { no("персонаж не упоминается в сцене"); continue }
                        s = s.copy(characters = s.characters.map { if (it.id == npc.id) it.copy(lastSeen = s.location) else it }); applied += e.copy(name = npc.name)
                    } else {
                        if (s.storyMode == "canon") { no("в режиме «ближе к канону» новые персонажи не создаются"); continue }
                        if (e.name.length < 2 || !e.name[0].isUpperCase() || !Text.mentions(narrative, e.name)) { no("новый персонаж не появляется в сцене"); continue }
                        if (s.characters.size >= 60) { no("слишком много персонажей"); continue }
                        s = s.copy(characters = s.characters + Npc(uniqueId(Text.slug(e.name), s.characters.map { it.id }), e.name, lastSeen = s.location, canon = false))
                        applied += e
                    }
                }
                GameEvent.DEAD -> {
                    val npc = s.findNpc(e.name)
                    if (npc == null) { no("такого персонажа нет"); continue }
                    if (!npc.alive) { no("персонаж уже мёртв"); continue }
                    if (Text.stemKey(npc.lastSeen) != Text.stemKey(s.location)) { no("персонажа нет рядом"); continue }
                    if (!hasAny(action, KILL) || !hasAny(narrative, DEATH_WORDS)) { no("в сцене нет гибели персонажа"); continue }
                    s = s.copy(characters = s.characters.map { if (it.id == npc.id) it.copy(alive = false) else it })
                    applied += e.copy(name = npc.name)
                }
                GameEvent.QUEST_ADD -> {
                    if (e.name.length < 4) { no("пустое задание"); continue }
                    if (!hasAny(action, PROMISE)) { no("герой не брал на себя обязательств"); continue }
                    if (s.quests.count { it.status == "active" } >= 6) { no("слишком много активных заданий"); continue }
                    if (s.quests.any { Text.stemKey(it.title) == Text.stemKey(e.name) }) { no("такое задание уже есть"); continue }
                    s = s.copy(quests = s.quests + Quest(uniqueId(Text.slug(e.name).take(24), s.quests.map { it.id }), e.name.replaceFirstChar { it.uppercase() }))
                    applied += e
                }
                GameEvent.QUEST_DONE -> {
                    val q = s.quests.firstOrNull { it.status == "active" && (Text.stemKey(it.title) == Text.stemKey(e.name) || Text.sharesStem(it.title, e.name)) }
                    if (q == null) { no("нет такого активного задания"); continue }
                    s = s.copy(quests = s.quests.map { if (it.id == q.id) it.copy(status = "done") else it }); applied += e.copy(name = q.title)
                }
                GameEvent.UNLOCK -> {
                    val locked = s.lockedLocations.firstOrNull { Text.stemKey(it) == Text.stemKey(e.name) }
                    if (locked == null) { no("это место не заперто"); continue }
                    val key = s.inventory.firstOrNull { Text.mentions(it.name, "ключ") || Text.mentions(it.name, "отмычка") }
                    if (key == null) { no("нет ключа"); continue }
                    s = s.copy(lockedLocations = s.lockedLocations - locked); applied += e.copy(name = locked)
                }
            }
        }
        // Время идёт каждый ход; встреченные рядом персонажи запоминаются по месту.
        s = s.copy(timeTick = s.timeTick + 1)
        val facts = applied.filter { it.type != GameEvent.RELATION }.map { it.describe() }
        if (facts.isNotEmpty()) s = s.copy(storyFacts = (s.storyFacts + facts).takeLast(40), journal = (s.journal + facts.map { "Ход ${s.timeTick}: $it" }).takeLast(200))
        // Герой не умирает молча: при нуле здоровья он приходит в себя ослабленным.
        if (s.hero.hp <= 0) {
            s = s.copy(hero = s.hero.copy(hp = (s.hero.maxHp / 3).coerceAtLeast(1)), journal = (s.journal + "Ход ${s.timeTick}: герой потерял сознание и очнулся ослабленным").takeLast(200))
            notes += "Ты теряешь сознание… и приходишь в себя ослабленным."
        }
        return ApplyResult(s, applied, rejected, notes)
    }

    /**
     * Проверка действия до генерации: чего у героя точно нет. Результат идёт в промпт как ограничение,
     * чтобы рассказчик не «достал меч из воздуха».
     */
    fun constraints(state: GameState, action: String, itemLexicon: Set<String>): List<String> {
        val out = ArrayList<String>()
        val words = Text.words(action)
        val uses = hasAny(action, GIVE + listOf("показ", "доста", "вынима", "выним", "размах", "замах", "открыва", "отпира", "отопр", "чита", "зажига", "надева", "вооруж", "целюсь", "мечом", "ножом", "кинжалом", "ключом", "луком", "топором"))
        if (uses) {
            for (w in words) {
                val st = Text.stem(w)
                if (st.length >= 3 && st in itemLexicon && !st.startsWith("монет") && state.inventory.none { inv -> Text.stems(inv.name).any { it == st } }) {
                    val msg = "У героя нет предмета «$w» — использовать его не получится."
                    if (msg !in out) out += msg
                }
            }
        }
        val n = Regex("(\\d{1,3})\\s*(монет|золот|медн|серебр)").find(Text.norm(action))?.groupValues?.get(1)?.toIntOrNull()
            ?: NUMERALS.entries.firstOrNull { (k, _) -> Regex("(?<![а-я])$k[а-я]{0,3}\\s+(медн[а-я]*\\s+|золот[а-я]*\\s+|серебр[а-я]*\\s+)?монет").containsMatchIn(Text.norm(action)) }?.value
        if (n != null && pays(action) && n > state.hero.gold) out += "У героя только ${state.hero.gold} монет — заплатить $n он не может."
        if (state.hero.gold == 0 && hasAny(action, listOf("плач", "заплат", "покуп", "куп", "взятк", "подкуп"))) out += "У героя нет монет."
        for (npc in state.characters.filter { !it.alive }) if (Text.mentions(action, npc.name)) out += "${npc.name} мёртв и не может ответить."
        return out.take(3)
    }

    val NUMERALS = linkedMapOf("одн" to 1, "один" to 1, "дв" to 2, "тр" to 3, "четыр" to 4, "пят" to 5, "шест" to 6, "сем" to 7, "восем" to 8, "девят" to 9, "десят" to 10)

    /** Сколько монет герой явно называет в действии («плачу две монеты»), иначе null. */
    fun namedCoins(action: String): Int? {
        val t = Text.norm(action)
        Regex("(\\d{1,2})\\s*(монет|золот|медн|серебр|медяк)").find(t)?.let { return it.groupValues[1].toIntOrNull() }
        for ((k, v) in NUMERALS) if (Regex("(?<![а-я])$k[а-я]{0,3}\\s+(медн[а-я]*\\s+|золот[а-я]*\\s+|серебр[а-я]*\\s+)?(монет|медяк|золот)").containsMatchIn(t)) return v
        if (Regex("(?<![а-я])монет[уа](?![а-я])").containsMatchIn(t)) return 1
        return null
    }

    private fun uniqueId(base: String, used: List<String>): String {
        if (base !in used) return base
        var i = 2
        while ("${base}_$i" in used) i++
        return "${base}_$i"
    }
}
