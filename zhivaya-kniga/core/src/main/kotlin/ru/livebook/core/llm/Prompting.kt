package ru.livebook.core.llm

import ru.livebook.core.model.GameState
import ru.livebook.core.model.Text
import ru.livebook.core.rules.GameEvent
import ru.livebook.core.rules.RulesEngine

data class GameSettings(
    /** «Подробнее»: 3–5 предложений вместо 1–3. */
    val detail: Boolean = false,
    /** Экономичный режим: меньше контекста и текста, без подсказок от модели. */
    val economy: Boolean = false,
    val suggestions: Boolean = true,
    val temp: Float = 0.45f,
    val seed: Int = -1,
) {
    val maxTokens: Int get() = when { economy -> 70; detail -> 210; else -> 120 }
    val loreChars: Int get() = when { economy -> 220; detail -> 520; else -> 420 }
    val historyTurns: Int get() = if (economy) 2 else 3
}

/** Какие изменения мира вообще возможны в этом ходу — решается правилами ДО генерации и зашивается в грамматику. */
data class TurnPolicy(
    val itemAdd: Boolean, val removable: List<String>, val coinsMinus: IntRange?, val coinsPlus: Boolean,
    val hpMinus: Boolean, val hpPlus: Boolean, val relationNpcs: List<String>, val meetNpcs: List<String>, val meetFree: Boolean,
    val killable: List<String>, val quest: Boolean, val near: List<String>,
) {
    companion object {
        fun of(state: GameState, action: String, canonPersons: List<String>): TurnPolicy {
            val near = state.nearbyNpcs().map { it.name }
            val named = RulesEngine.namedCoins(action)
            // Назвал сумму больше, чем есть, — платить нечем вовсе.
            val coins = when { !RulesEngine.pays(action) || state.hero.gold <= 0 -> null; named == null -> 1..minOf(9, state.hero.gold); named in 1..state.hero.gold -> named..named; else -> null }
            val known = state.characters.filter { it.alive }.map { it.name }
            val meet = (known + canonPersons).distinct().filter { it !in near && Text.mentions(action, it) && state.findNpc(it)?.alive != false }.take(4)
            return TurnPolicy(
                itemAdd = RulesEngine.hasAny(action, RulesEngine.TAKE + RulesEngine.SEARCH),
                removable = if (RulesEngine.hasAny(action, RulesEngine.GIVE)) state.inventory.filter { Text.mentions(action, it.name) }.map { it.name } else emptyList(),
                coinsMinus = coins,
                coinsPlus = RulesEngine.earns(action),
                hpMinus = RulesEngine.hasAny(action, RulesEngine.RISK),
                hpPlus = RulesEngine.hasAny(action, RulesEngine.REST) && state.hero.hp < state.hero.maxHp,
                relationNpcs = near.filter { Text.mentions(action, it) },
                meetNpcs = meet, meetFree = state.storyMode != "canon" && RulesEngine.hasAny(action, listOf("зову", "позов", "ищу кого", "встреч", "стуч", "окли", "кричу", "знаком")),
                killable = if (RulesEngine.hasAny(action, RulesEngine.KILL)) near.filter { Text.mentions(action, it) } else emptyList(),
                quest = RulesEngine.hasAny(action, RulesEngine.PROMISE),
                near = near,
            )
        }
    }
}

object GrammarBuilder {
    private fun lit(s: String): String = "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ") + "\""
    private fun alt(xs: List<String>): String = xs.joinToString(" | ") { lit(it) }

    /** GBNF-грамматика ответа: 1–N предложений по-русски, строка ИТОГ с разрешёнными событиями, строка ДАЛЬШЕ. */
    fun build(policy: TurnPolicy, settings: GameSettings): String {
        val (minS, maxS) = when { settings.economy -> 1 to 2; settings.detail -> 3 to 5; else -> 1 to 3 }
        val evs = ArrayList<String>()
        if (policy.itemAdd) evs += "\"получено «\" name \"»\""
        if (policy.removable.isNotEmpty()) evs += "\"потеряно «\" (" + alt(policy.removable) + ") \"»\""
        policy.coinsMinus?.let { r -> evs += "\"монеты -\" (" + alt(r.map { it.toString() }) + ")" }
        if (policy.coinsPlus) evs += "\"монеты +\" [1-9]"
        if (policy.hpMinus) evs += "\"здоровье -\" [1-3]"
        if (policy.hpPlus) evs += "\"здоровье +\" [1-3]"
        if (policy.relationNpcs.isNotEmpty()) evs += "\"отношение \" (" + alt(policy.relationNpcs) + ") \" \" [+-] \"1\""
        if (policy.meetNpcs.isNotEmpty()) evs += "\"встреча: \" (" + alt(policy.meetNpcs) + ")" else if (policy.meetFree) evs += "\"встреча: \" pname"
        if (policy.killable.isNotEmpty()) evs += "\"погиб: \" (" + alt(policy.killable) + ")"
        if (policy.quest) evs += "\"задание: \" name"
        val sb = StringBuilder()
        sb.append("root ::= first")
        repeat(minS - 1) { sb.append(" \" \" sent") }
        repeat(maxS - minS) { sb.append(" (\" \" sent)?") }
        sb.append(" \"\\nИТОГ: \" itog")
        if (settings.suggestions && !settings.economy) sb.append(" \"\\nДАЛЬШЕ: \" sug \" | \" sug \" | \" sug")
        sb.append("\n")
        // Первая фраза начинается с того, кто рядом, или с героя и мира вокруг — так в сцену не попадают чужие имена.
        val starts = policy.near.map { "$it " } + listOf("Ты ", "Тебе ", "Тебя ", "Вокруг ", "В ", "На ", "У ", "За ", "Перед тобой ", "Впереди ", "Здесь ", "Тишин")
        sb.append("first ::= (" + alt(starts) + ") ch+ [.!?…] \"»\"?\n")
        sb.append("sent ::= [А-ЯЁ«—] ch+ [.!?…] \"»\"?\n")
        sb.append("ch ::= [а-яёА-ЯЁ0-9 ,;«»—-]\n")
        sb.append(if (evs.isEmpty()) "itog ::= \"ничего\"\n" else "itog ::= \"ничего\" | ev (\"; \" ev)?\nev ::= " + evs.joinToString(" | ") + "\n")
        sb.append("name ::= [а-яёА-ЯЁ] [а-яёА-ЯЁ -]+\n")
        sb.append("pname ::= [А-ЯЁ] [а-яё]+\n")
        sb.append("sug ::= [А-ЯЁ] [а-яё -]+\n")
        return sb.toString()
    }
}

object PromptBuilder {
    /** Тексты обучающих примеров: их слова штрафуются при генерации, чтобы примеры не просачивались в сцены. */
    const val EXAMPLES = "Гордей пересчитывает монеты и протягивает тебе нож рукоятью вперёд. Береги его, лезвие острое, — бросает он. Гордей кивает в сторону холмов и щурится на солнце. К вечеру дойдёшь, если не свернёшь в лес"

    private const val THINK = "<think>\n\n</think>\n\n"

    fun system(settings: GameSettings, storyMode: String): String {
        val len = when { settings.economy -> "1-2 коротких предложения"; settings.detail -> "4-5 предложений"; else -> "2 коротких предложения" }
        val mode = if (storyMode == "canon") "Держись фактов книги и характеров её персонажей." else "История может пойти иначе, чем в книге, но мир и характеры остаются прежними."
        val tail = if (settings.suggestions && !settings.economy) "Затем строка ИТОГ и строка ДАЛЬШЕ." else "Затем строка ИТОГ."
        val sugA = if (settings.suggestions && !settings.economy) "\nДАЛЬШЕ: Поблагодарить кузнеца | Спросить о дороге | Выйти на улицу" else ""
        val sugB = if (settings.suggestions && !settings.economy) "\nДАЛЬШЕ: Заплатить две монеты | Поторговаться | Уйти" else ""
        return "<|im_start|>system\nТы — рассказчик текстовой игры по книге. Игрок пишет действие героя. Ты пишешь, что произошло дальше: ответ персонажа, реакцию мира. " +
            "Пиши по-русски, $len, герою говори «ты». Персонажи отвечают прямой речью в кавычках «». Не повторяй слова игрока. Не пересказывай книгу, придумывай новую сцену. " +
            "У героя есть только вещи из списка. $mode $tail /no_think<|im_end|>\n" +
            "<|im_start|>user\nМесто: кузница. Рядом: Гордей. Герой: Лука, путник; здоровье 10 из 10, монеты 5, вещи: фляга.\nДействие героя: плачу две монеты и забираю нож<|im_end|>\n" +
            "<|im_start|>assistant\n$THINK" + "Гордей пересчитывает монеты и протягивает тебе нож рукоятью вперёд. «Береги его, лезвие острое», — бросает он.\nИТОГ: монеты -2; получено «нож»$sugA<|im_end|>\n" +
            "<|im_start|>user\nМесто: кузница. Рядом: Гордей. Герой: Лука, путник; здоровье 10 из 10, монеты 3, вещи: фляга, нож.\nДействие героя: спрашиваю кузнеца, далеко ли до города<|im_end|>\n" +
            "<|im_start|>assistant\n$THINK" + "Гордей кивает в сторону холмов и щурится на солнце. «К вечеру дойдёшь, если не свернёшь в лес», — говорит он.\nИТОГ: ничего$sugB<|im_end|>\n"
    }

    fun situation(state: GameState): String {
        val near = state.nearbyNpcs().map { npc -> npc.name + when { npc.relation >= 3 -> " (друг)"; npc.relation <= -3 -> " (враждебен)"; else -> "" } }
        val items = if (state.inventory.isEmpty()) "вещей нет" else "вещи: " + state.inventory.joinToString(", ") { if (it.qty > 1) "${it.name} (${it.qty})" else it.name }
        val role = if (state.hero.role.isBlank()) "" else ", ${state.hero.role}"
        return "Место: ${state.location}. Рядом: ${if (near.isEmpty()) "никого" else near.joinToString(", ")}. Герой: ${state.hero.name}$role; здоровье ${state.hero.hp} из ${state.hero.maxHp}, монеты ${state.hero.gold}, $items."
    }

    /**
     * Блок текущего хода. Порядок выбран ради KV-кеша: сначала то, что между ходами обычно не меняется
     * (лор сцены, состояние героя), затем изменчивое (недавние события, лор под действие, само действие).
     */
    fun userBlock(state: GameState, bookTitle: String, sceneLore: List<String>, actionLore: List<String>, constraints: List<String>, action: String, loreChars: Int, historyTurns: Int): String {
        val sb = StringBuilder()
        val scene = clipLore(sceneLore, loreChars * 6 / 10)
        if (scene.isNotEmpty()) sb.append("Книга «").append(bookTitle).append("»: ").append(scene).append('\n')
        sb.append(situation(state)).append('\n')
        val quest = state.quests.lastOrNull { it.status == "active" }
        if (quest != null) sb.append("Задание героя: ").append(quest.title).append(".\n")
        val dead = state.characters.filter { !it.alive }.map { it.name }
        if (dead.isNotEmpty()) sb.append("Мертвы: ").append(dead.take(4).joinToString(", ")).append(".\n")
        val recent = state.history.takeLast(historyTurns)
        if (recent.isNotEmpty()) {
            sb.append("Раньше: ")
            recent.forEach { t -> sb.append("герой — ").append(cleanAction(t.action).take(70)).append("; итог — ").append(brief(t.reply)).append(' ') }
            sb.setLength(sb.length - 1); sb.append('\n')
        }
        val extra = clipLore(actionLore.filter { it !in sceneLore }, loreChars * 4 / 10)
        if (extra.isNotEmpty()) sb.append("Ещё из книги: ").append(extra).append('\n')
        if (constraints.isNotEmpty()) sb.append("Важно: ").append(constraints.joinToString(" ")).append('\n')
        sb.append("Действие героя: ").append(cleanAction(action))
        return sb.toString()
    }

    private fun brief(reply: String): String {
        val first = Text.splitSentences(reply.substringBefore("\nИТОГ")).firstOrNull().orEmpty()
        return if (first.length <= 110) first else first.take(110).substringBeforeLast(' ') + "…"
    }

    fun build(state: GameState, bookTitle: String, sceneLore: List<String>, actionLore: List<String>, constraints: List<String>, action: String, settings: GameSettings, historyTurns: Int = settings.historyTurns, loreChars: Int = settings.loreChars): String {
        val sb = StringBuilder(system(settings, state.storyMode))
        sb.append("<|im_start|>user\n").append(userBlock(state, bookTitle, sceneLore, actionLore, constraints, action, loreChars, historyTurns)).append("<|im_end|>\n")
        sb.append("<|im_start|>assistant\n").append(THINK)
        return sb.toString()
    }

    /** Служебные токены чата из пользовательского ввода и книги вырезаются. */
    fun cleanAction(s: String): String = s.replace(Regex("<\\|[^|>]*\\|>"), " ").replace(Regex("</?think>"), " ").replace(Regex("\\s+"), " ").trim().take(300)

    private fun clipLore(lore: List<String>, maxChars: Int): String {
        val sb = StringBuilder()
        for (chunk in lore) {
            for (s in Text.splitSentences(chunk.replace(Regex("<\\|[^|>]*\\|>"), " ").replace(Regex("\\s+"), " "))) {
                if (sb.length + s.length + 1 > maxChars) return sb.toString().trim()
                sb.append(s).append(' ')
            }
        }
        return sb.toString().trim()
    }
}

data class ParsedTurn(val narrative: String, val events: List<GameEvent>, val suggestions: List<String>, val valid: Boolean, val problem: String = "")

object ResponseParser {
    /** Видимая часть ответа во время потоковой генерации: всё до служебной строки ИТОГ. */
    fun visible(raw: String): String {
        var t = raw
        val cut = t.indexOf("\nИТОГ").let { if (it >= 0) it else t.indexOf("ИТОГ:") }
        if (cut >= 0) t = t.substring(0, cut)
        // Хвост, который может оказаться началом служебной строки, пока не показываем.
        val nl = t.lastIndexOf('\n')
        if (nl >= 0 && "ИТОГ".startsWith(t.substring(nl + 1).trim()) ) t = t.substring(0, nl)
        return t.trimEnd()
    }

    fun parse(raw: String, action: String): ParsedTurn {
        val text = raw.replace("\r", "").trim()
        val itogAt = text.indexOf("\nИТОГ:")
        var narrative = (if (itogAt >= 0) text.substring(0, itogAt) else text.substringBefore("ИТОГ:")).trim()
        val rest = if (itogAt >= 0) text.substring(itogAt + 1) else ""
        val itog = rest.lineSequence().firstOrNull { it.startsWith("ИТОГ:") }?.removePrefix("ИТОГ:")?.trim().orEmpty()
        val next = rest.lineSequence().firstOrNull { it.startsWith("ДАЛЬШЕ:") }?.removePrefix("ДАЛЬШЕ:")?.trim().orEmpty()
        // Обрезанный лимитом ответ: оставляем только законченные предложения.
        if (itogAt < 0) {
            val sents = Text.splitSentences(narrative)
            narrative = sents.filter { it.last() in ".!?…»" }.joinToString(" ")
        }
        val events = if (itog.isEmpty() || itog.startsWith("ничего")) emptyList() else itog.split(";").mapNotNull { parseEvent(it.trim()) }
        val suggestions = next.split("|").map { it.trim().trim('.') }.filter { it.length in 3..60 }.distinct().take(3)
        val letters = narrative.count { it in 'а'..'я' || it in 'А'..'Я' || it == 'ё' }
        val problem = when {
            narrative.length < 12 || letters < 10 -> "пустой или обрезанный ответ"
            echoes(narrative, action) -> "ответ повторяет действие игрока"
            else -> ""
        }
        return ParsedTurn(narrative, events, suggestions, problem.isEmpty(), problem)
    }

    private fun parseEvent(s: String): GameEvent? {
        fun num(t: String): Int? = Regex("([+-])\\s*(\\d+)").find(t)?.let { (if (it.groupValues[1] == "-") -1 else 1) * it.groupValues[2].toInt() }
        return when {
            s.startsWith("получено") -> GameEvent(GameEvent.ITEM_ADD, s.removePrefix("получено").trim().trim('«', '»', ' '))
            s.startsWith("потеряно") -> GameEvent(GameEvent.ITEM_REMOVE, s.removePrefix("потеряно").trim().trim('«', '»', ' '))
            s.startsWith("монеты") -> num(s)?.let { GameEvent(GameEvent.GOLD, delta = it) }
            s.startsWith("здоровье") -> num(s)?.let { GameEvent(GameEvent.HP, delta = it) }
            s.startsWith("место:") -> GameEvent(GameEvent.MOVE, s.removePrefix("место:").trim())
            s.startsWith("отношение") -> num(s)?.let { GameEvent(GameEvent.RELATION, s.removePrefix("отношение").substringBeforeLast(' ').trim(), it) }
            s.startsWith("встреча:") -> GameEvent(GameEvent.MEET, s.removePrefix("встреча:").trim())
            s.startsWith("погиб:") -> GameEvent(GameEvent.DEAD, s.removePrefix("погиб:").trim())
            s.startsWith("задание:") -> GameEvent(GameEvent.QUEST_ADD, s.removePrefix("задание:").trim())
            else -> null
        }
    }

    /** Маленькая модель иногда просто пересказывает ввод игрока — такой ответ считаем негодным. */
    private fun echoes(narrative: String, action: String): Boolean {
        val a = Text.words(action).filter { it.length >= 4 }.map { it.take(4) }.toSet()
        val n = Text.words(narrative).filter { it.length >= 4 }.map { it.take(4) }
        if (a.size < 3 || n.isEmpty()) return false
        return n.count { it in a }.toDouble() / n.size > 0.75
    }
}
