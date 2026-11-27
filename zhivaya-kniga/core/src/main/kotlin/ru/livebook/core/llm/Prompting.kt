package ru.livebook.core.llm

import ru.livebook.core.game.GameOrchestrator
import ru.livebook.core.model.GameState
import ru.livebook.core.model.Text

data class GameSettings(
    /** «Подробнее»: 3–5 предложений вместо 1–3. */
    val detail: Boolean = false,
    /** Экономичный режим: меньше контекста и текста. */
    val economy: Boolean = false,
    /** Показывать подсказки действий (их строят правила, модель на них время не тратит). */
    val suggestions: Boolean = true,
    val temp: Float = 0.45f,
    val seed: Int = -1,
    /** Профиль маленькой модели: примеры в промпте, без карточек персонажей, сильнее штраф за повтор. */
    val small: Boolean = false,
) {
    val maxTokens: Int get() = when { economy -> 50; detail -> 170; else -> 84 }
    val loreChars: Int get() = when { economy -> 220; detail -> 520; else -> 420 }
    val historyTurns: Int get() = if (economy) 2 else 3
}

object GrammarBuilder {
    private fun lit(s: String): String = "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ") + "\""

    /** GBNF-грамматика сцены: только русский текст из 1–N предложений. Изменения мира модель не пишет — их выводит движок правил. */
    fun build(near: List<String>, settings: GameSettings): String {
        val (minS, maxS) = when { settings.economy -> 1 to 2; settings.detail -> 3 to 5; else -> 2 to 2 }
        val sb = StringBuilder("root ::= first")
        repeat(minS - 1) { sb.append(" \" \" sent") }
        repeat(maxS - minS) { sb.append(" (\" \" sent)?") }
        sb.append("\n")
        // После начала фразы идёт строчная буква: не «Ты — Мира…», а сразу действие.
        // Первая фраза начинается с того, кто рядом, или с героя и мира вокруг — так в сцену не попадают чужие имена.
        val starts = near.map { "$it " } + listOf("Ты ", "Тебе ", "Тебя ", "Вокруг ", "В ", "На ", "У ", "За ", "Перед тобой ", "Впереди ", "Здесь ", "Тишин")
        sb.append("first ::= (" + starts.joinToString(" | ") { lit(it) } + ") [а-яё] ch+ [.!?…] \"»\"?\n")
        sb.append("sent ::= [А-ЯЁ«—] ch+ [.!?…] \"»\"?\n")
        // Заглавная буква допустима только в начале слова (имена): служебные слова из одних заглавных в сцену не попадут.
        sb.append("ch ::= [а-яё0-9 ,;«»—-] | [А-ЯЁ] [а-яё]\n")
        return sb.toString()
    }
}

object PromptBuilder {
    private const val THINK = "<think>\n\n</think>\n\n"
    fun system(settings: GameSettings, storyMode: String): String {
        val len = when { settings.economy -> "1-2 коротких предложения"; settings.detail -> "4-5 предложений"; else -> "2 коротких предложения" }
        val mode = if (storyMode == "canon") "Держись фактов книги и характеров её персонажей." else "История может пойти иначе, чем в книге, но мир и характеры остаются прежними."
        return "<|im_start|>system\nТы — рассказчик текстовой игры по книге. Игрок пишет действие героя. Ты пишешь, что произошло дальше: ответ персонажа, реакцию мира. " +
            "Пиши по-русски, $len, герою говори «ты». Персонажи отвечают прямой речью в кавычках «» и говорят по-разному, согласно своему характеру. Не повторяй слова игрока. " +
            "Не пересказывай книгу, придумывай новую сцену. У героя есть только вещи из списка. Если указан «Поворот», обязательно вплети его в сцену. $mode /no_think<|im_end|>\n" +
            // Маленькой модели нужны образцы формы ответа; большой они только мешают (она начинает их копировать).
            if (!settings.small) "" else
            "<|im_start|>user\nМесто: кузница. Рядом: Гордей. Герой: Лука, путник; здоровье 10 из 10, монеты 5, вещи: фляга.\nДействие героя: плачу две монеты и забираю нож<|im_end|>\n" +
            "<|im_start|>assistant\n$THINK" + "Гордей пересчитывает монеты и протягивает тебе нож рукоятью вперёд. «Береги его, лезвие острое», — бросает он.<|im_end|>\n" +
            "<|im_start|>user\nМесто: кузница. Рядом: Гордей. Герой: Лука, путник; здоровье 10 из 10, монеты 3, вещи: фляга, нож.\nДействие героя: спрашиваю кузнеца, далеко ли до города<|im_end|>\n" +
            "<|im_start|>assistant\n$THINK" + "Гордей кивает в сторону холмов и щурится на солнце. «К вечеру дойдёшь, если не свернёшь в лес», — говорит он.<|im_end|>\n"
    }

    /** Тексты примеров: их слова штрафуются при генерации, а ответ, похожий на пример, считается негодным. */
    const val EXAMPLES = "Гордей пересчитывает монеты и протягивает тебе нож рукоятью вперёд. Береги его, лезвие острое, — бросает он. Гордей кивает в сторону холмов и щурится на солнце. К вечеру дойдёшь, если не свернёшь в лес, — говорит он."

    fun situation(state: GameState): String {
        val near = state.nearbyNpcs().map { it.name }
        val items = if (state.inventory.isEmpty()) "вещей нет" else "вещи: " + state.inventory.joinToString(", ") { if (it.qty > 1) "${it.name} (${it.qty})" else it.name }
        val role = if (state.hero.role.isBlank()) "" else ", ${state.hero.role}"
        return "Место: ${state.location}. Рядом: ${if (near.isEmpty()) "никого" else near.joinToString(", ")}. Герой: ${state.hero.name}$role; здоровье ${state.hero.hp} из ${state.hero.maxHp}, монеты ${state.hero.gold}, $items."
    }

    /** Карточки тех, кто рядом: кто это по книге и как относится к герою. */
    private fun npcCards(state: GameState, small: Boolean): String {
        val sb = StringBuilder()
        if (small) return ""   // маленькая модель переписывает карточку дословно вместо сцены
        for (npc in state.nearbyNpcs().take(2)) {
            val who = Text.splitSentences(npc.note).firstOrNull()?.trim()?.trimEnd('.', '…').orEmpty()
            sb.append("О персонаже ").append(npc.name).append(": ")
            if (who.isNotEmpty()) sb.append(if (who.length <= 150) who else who.take(150).substringBeforeLast(' ')).append(". ")
            sb.append("К герою ").append(GameOrchestrator.relationWord(npc.relation)).append(".\n")
        }
        return sb.toString()
    }

    /**
     * Неизменная между ходами часть блока: лор сцены, карточки персонажей, состояние героя, цель, сводка сюжета.
     * Она стоит первой, чтобы оставаться в KV-кеше модели; её же можно обработать заранее («прогрев»).
     */
    fun stablePart(state: GameState, bookTitle: String, sceneLore: List<String>, loreChars: Int, small: Boolean = false): String {
        val sb = StringBuilder()
        val scene = clipLore(sceneLore, loreChars * 6 / 10)
        if (scene.isNotEmpty()) sb.append("Книга «").append(bookTitle).append("»: ").append(scene).append('\n')
        sb.append(npcCards(state, small))
        sb.append(situation(state)).append('\n')
        val quest = state.quests.firstOrNull { it.status == "active" }
        if (quest != null) sb.append("Цель героя: ").append(quest.title).append(".\n")
        val dead = state.characters.filter { !it.alive }.map { it.name }
        if (dead.isNotEmpty()) sb.append("Мертвы: ").append(dead.take(4).joinToString(", ")).append(".\n")
        if (state.summary.isNotEmpty()) sb.append("Сюжет до этого: ").append(state.summary.takeLast(2).joinToString(" ")).append('\n')
        return sb.toString()
    }

    fun prefix(state: GameState, bookTitle: String, sceneLore: List<String>, settings: GameSettings): String =
        system(settings, state.storyMode) + "<|im_start|>user\n" + stablePart(state, bookTitle, sceneLore, settings.loreChars, settings.small)

    fun build(state: GameState, bookTitle: String, sceneLore: List<String>, actionLore: List<String>, constraints: List<String>, beat: String, action: String,
              settings: GameSettings, historyTurns: Int = settings.historyTurns, loreChars: Int = settings.loreChars): String {
        val sb = StringBuilder(system(settings, state.storyMode))
        sb.append("<|im_start|>user\n").append(stablePart(state, bookTitle, sceneLore, loreChars, settings.small))
        val recent = state.history.takeLast(historyTurns)
        if (recent.isNotEmpty()) {
            sb.append("Раньше было так. ")
            // Маленькой модели прошлые сцены не показываем: она начинает переписывать их дословно. Ей хватает действий героя.
            recent.forEach { t -> sb.append("Ты: ").append(cleanAction(t.action).take(70).trimEnd('.', '!', '?')).append(". "); if (!settings.small) sb.append("В ответ: ").append(brief(t.reply)).append(' ') }
            sb.setLength(sb.length - 1); sb.append('\n')
        }
        val extra = clipLore(actionLore.filter { it !in sceneLore }, loreChars * 4 / 10)
        if (extra.isNotEmpty()) sb.append("Ещё из книги: ").append(extra).append('\n')
        if (constraints.isNotEmpty()) sb.append("Важно: ").append(constraints.joinToString(" ")).append('\n')
        if (beat.isNotEmpty()) sb.append("Поворот: ").append(beat).append('\n')
        sb.append("Действие героя: ").append(cleanAction(action)).append("<|im_end|>\n")
        sb.append("<|im_start|>assistant\n").append(THINK)
        return sb.toString()
    }

    fun brief(reply: String): String {
        val first = Text.splitSentences(reply).firstOrNull().orEmpty()
        return if (first.length <= 110) first else first.take(110).substringBeforeLast(' ') + "…"
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

data class ParsedTurn(val narrative: String, val valid: Boolean, val problem: String = "")

object ResponseParser {
    /** Видимая часть ответа во время потоковой генерации (служебные хвосты, если модель их всё же выдала, отрезаются). */
    fun visible(raw: String): String {
        var t = raw
        for (mark in listOf("ИТОГ", "ДАЛЬШЕ", "<|")) { val i = t.indexOf(mark); if (i >= 0) t = t.substring(0, i) }
        return t.trimEnd()
    }

    fun parse(raw: String, action: String): ParsedTurn {
        val text = visible(raw.replace("\r", "")).replace('\n', ' ').replace(Regex("\\s+"), " ").trim()
        // Обрезанный лимитом ответ: оставляем только законченные предложения.
        val narrative = Text.splitSentences(text).filter { it.last() in ".!?…»" }.joinToString(" ")
        val letters = narrative.count { it in 'а'..'я' || it in 'А'..'Я' || it == 'ё' }
        val problem = when {
            narrative.length < 12 || letters < 10 -> "пустой или обрезанный ответ"
            echoes(narrative, action) -> "ответ повторяет действие игрока"
            else -> ""
        }
        return ParsedTurn(narrative, problem.isEmpty(), problem)
    }

    /** Доля слов ответа, уже встречавшихся в другом тексте (по первым пяти буквам). */
    fun overlap(narrative: String, other: String): Double {
        val o = Text.words(other).filter { it.length >= 4 }.map { it.take(5) }.toSet()
        val n = Text.words(narrative).filter { it.length >= 4 }.map { it.take(5) }
        return if (n.size < 4 || o.isEmpty()) 0.0 else n.count { it in o }.toDouble() / n.size
    }

    /** Маленькая модель иногда просто пересказывает ввод игрока — такой ответ считаем негодным. */
    private fun echoes(narrative: String, action: String): Boolean {
        val a = Text.words(action).filter { it.length >= 4 }.map { it.take(4) }.toSet()
        val n = Text.words(narrative).filter { it.length >= 4 }.map { it.take(4) }
        if (a.size < 3 || n.isEmpty()) return false
        return n.count { it in a }.toDouble() / n.size > 0.75
    }
}
