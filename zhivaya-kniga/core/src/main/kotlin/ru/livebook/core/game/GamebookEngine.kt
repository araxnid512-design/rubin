package ru.livebook.core.game

import ru.livebook.core.lore.BookRepository
import ru.livebook.core.model.Choice
import ru.livebook.core.model.Combat
import ru.livebook.core.model.GameState
import ru.livebook.core.model.Gamebook
import ru.livebook.core.model.Item
import ru.livebook.core.model.Morph
import ru.livebook.core.model.Text
import kotlin.random.Random

/**
 * Книга-игра по загруженной книге: пронумерованные параграфы, выбор из вариантов, Ловкость, Сила и Удача, бои на кубиках.
 * Вся механика здесь детерминирована (кубики — через переданный генератор); модель только пишет текст параграфа.
 */
object GamebookEngine {
    /** Что произошло после выбора: новое состояние и то, что нужно рассказать в параграфе. */
    data class Outcome(val state: GameState, val action: String, val note: String, val beat: String, val important: List<String> = emptyList())

    /** Противники, которых ищем в тексте книги: основа слова → (название, Ловкость, Сила). */
    private val THREATS = linkedMapOf(
        "голем" to Triple("глиняный голем", 9, 10), "дракон" to Triple("дракон", 10, 14), "демон" to Triple("демон", 10, 12), "чудовищ" to Triple("чудовище", 9, 10),
        "призрак" to Triple("призрак", 8, 6), "скелет" to Triple("скелет", 6, 6), "мертвец" to Triple("мертвец", 6, 7), "волк" to Triple("волк", 6, 6),
        "медвед" to Triple("медведь", 8, 10), "зме" to Triple("змея", 6, 5), "паук" to Triple("огромный паук", 7, 6), "крыс" to Triple("крыса", 5, 4),
        "разбойник" to Triple("разбойник", 7, 6), "бандит" to Triple("бандит", 7, 6), "пират" to Triple("пират", 7, 7), "наёмник" to Triple("наёмник", 8, 8), "наемник" to Triple("наёмник", 8, 8),
        "солдат" to Triple("солдат", 7, 8), "стражник" to Triple("стражник", 7, 8), "охранник" to Triple("охранник", 7, 7), "орк" to Triple("орк", 8, 8), "гоблин" to Triple("гоблин", 5, 5),
        "робот" to Triple("боевой робот", 8, 10), "твар" to Triple("неведомая тварь", 8, 8), "звер" to Triple("дикий зверь", 7, 8), "колдун" to Triple("колдун", 8, 7), "ведьм" to Triple("ведьма", 8, 6),
        "механизм" to Triple("взбесившийся механизм", 8, 8), "убийц" to Triple("наёмный убийца", 9, 7), "вор" to Triple("вор", 6, 5),
    )
    private val FALLBACK = listOf(Triple("бродяга с ножом", 6, 5), Triple("одичавший пёс", 6, 6), Triple("ночной грабитель", 7, 6))

    val PLACE_KINDS = setOf("place", "site", "lock")
    fun d6(rng: Random): Int = rng.nextInt(1, 7)
    private fun talkKey(name: String, s: GameState): String = "$name@${s.stage}"

    /** Создание персонажа по правилам жанра: Ловкость 1к6+6, Сила 2к6+12, Удача 1к6+6. */
    fun rollHero(state: GameState, rng: Random): GameState {
        val skill = d6(rng) + 6; val stamina = d6(rng) + d6(rng) + 12; val luck = d6(rng) + 6
        val gb = Gamebook(skill = skill, luck = luck, luckMax = luck, provisions = 2, visited = listOf(state.location),
            dice = "Броски при создании героя: Ловкость $skill, Сила $stamina, Удача $luck.")
        return state.copy(hero = state.hero.copy(hp = stamina, maxHp = stamina), gamebook = gb)
    }

    /** Противники, встречающиеся в книге (по главам до текущей включительно). */
    fun threats(books: BookRepository, bookId: String, upToChapter: Int): List<Triple<String, Int, Int>> {
        val text = (0..upToChapter).flatMap { books.chapterChunks(bookId, it) }.joinToString(" ") { it.second }
        val stems = Text.stems(text).toSet()
        return THREATS.filter { (k, _) -> stems.any { it == k || (k.length >= 4 && it.startsWith(k)) } }.values.distinctBy { it.first }.toList()
    }

    private fun enemyFor(state: GameState, books: BookRepository, place: String): Triple<String, Int, Int>? {
        val gb = state.gamebook!!
        val seed = Text.stemKey(place).sumOf { it.code } + state.stage * 7 + state.hero.name.length
        if (seed % 3 == 0) return null                       // в трети новых мест спокойно
        val pool = threats(books, state.bookId, state.stage).ifEmpty { FALLBACK }
        val e = pool[seed % pool.size]
        // Чем дальше по сюжету, тем противники крепче.
        return Triple(e.first, (e.second + state.stage / 2).coerceAtMost(11), e.third + state.stage + gb.kills / 3)
    }

    /** Варианты выбора для текущего положения. */
    fun choices(s: GameState): List<Choice> {
        val gb = s.gamebook ?: return emptyList()
        if (gb.dead || gb.won) return emptyList()
        gb.combat?.let { c ->
            return listOfNotNull(Choice("strike", "Нанести удар", "strike"), if (gb.luck > 0) Choice("luck", "Ударить, испытав удачу", "luckstrike") else null,
                if (c.round >= 1) Choice("flee", "Бежать (−2 к Силе)", "flee") else null)
        }
        val out = ArrayList<Choice>()
        val near = s.nearbyNpcs()
        // Каждый персонаж знает одну новость на каждом этапе сюжета: чтобы узнать больше, надо идти дальше.
        near.take(2).forEach { npc -> out += Choice("talk:${npc.id}", (if (talkKey(npc.name, s) in gb.talked) "Просто поговорить: " + npc.name else "Расспросить " + Morph.accusative(npc.name, true)), "talk", npc.name) }
        if (Text.stemKey(s.location) !in gb.searched.map { Text.stemKey(it) }) out += Choice("search", "Обыскать это место (проверка удачи)", "search")
        val places = s.knownLocations.filter { Text.stemKey(it) != Text.stemKey(s.location) }
        val fresh = places.filter { p -> gb.visited.none { Text.stemKey(it) == Text.stemKey(p) } }
        val seen = places - fresh.toSet()
        (fresh.take(2) + seen.take(if (fresh.size >= 2) 1 else 2)).take(3).forEach { p ->
            val locked = s.lockedLocations.any { Text.stemKey(it) == Text.stemKey(p) }
            val key = s.inventory.any { Text.mentions(it.name, "ключ") || Text.mentions(it.name, "отмычка") }
            out += Choice("go:" + Text.slug(p), when { locked && key -> "Открыть ключом и войти: $p"; locked -> "Попробовать войти: $p (заперто)"; else -> "Отправиться: $p" }, "go", p)
        }
        if (gb.provisions > 0 && s.hero.hp <= s.hero.maxHp - 3) out += Choice("eat", "Съесть припасы (+4 к Силе, осталось ${gb.provisions})", "eat")
        val freshTalk = near.take(2).any { talkKey(it.name, s) !in gb.talked }
        if (!freshTalk && out.none { it.kind == "search" }) out += Choice("wait", "Затаиться и понаблюдать", "wait")
        return out
    }

    private fun testLuck(gb: Gamebook, rng: Random): Triple<Boolean, String, Gamebook> {
        val a = d6(rng); val b = d6(rng)
        val ok = a + b <= gb.luck
        return Triple(ok, "Проверка удачи: $a + $b = ${a + b} против Удачи ${gb.luck} — ${if (ok) "повезло" else "не повезло"}. Удача уменьшается на 1.", gb.copy(luck = (gb.luck - 1).coerceAtLeast(0)))
    }

    fun apply(state: GameState, choiceId: String, rng: Random, books: BookRepository, director: (GameState, String) -> StoryDirector.Beat): Outcome {
        val gb0 = state.gamebook ?: throw IllegalStateException("это не книга-игра")
        val choice = if (choiceId == "start") Choice("start", "", "start") else choices(state).firstOrNull { it.id == choiceId } ?: throw IllegalArgumentException("такого выбора сейчас нет")
        var s = state.copy(timeTick = state.timeTick + 1)
        var gb = gb0.copy(para = gb0.para + 1, dice = "")
        var action = ""; var note = ""; var beat = ""
        val important = ArrayList<String>()
        fun hurt(n: Int) { s = s.copy(hero = s.hero.copy(hp = (s.hero.hp - n).coerceAtLeast(0))) }
        fun journal(t: String) { s = s.copy(journal = (s.journal + "§${gb.para}: $t").takeLast(200), storyFacts = (s.storyFacts + t).takeLast(40)) }

        when (choice.kind) {
            "start" -> { action = "оглядеться и вспомнить, что привело вас сюда"; note = gb0.dice; gb = gb.copy(dice = gb0.dice) }
            "talk" -> {
                val npc = s.findNpc(choice.target)!!
                action = "расспросить ${Morph.accusative(npc.name, true)} о том, что здесь происходит"
                // Разговор двигает сюжет: на каждом этапе собеседник даёт одну зацепку из книги.
                val key = talkKey(npc.name, s)
                if (key !in gb.talked) {
                    gb = gb.copy(talked = (gb.talked + key).takeLast(120))
                    s = s.copy(characters = s.characters.map { if (it.id == npc.id) it.copy(relation = (it.relation + 1).coerceAtMost(10)) else it })
                    val b = director(s, action); s = b.state.copy(gamebook = s.gamebook); beat = b.text
                    if (beat.isNotEmpty()) journal("${npc.name} рассказывает важное")
                } else important += "${npc.name} уже рассказал всё, что знал; сейчас он лишь коротко отвечает."
            }
            "search" -> {
                action = "тщательно обыскать это место"
                gb = gb.copy(searched = gb.searched + s.location)
                // Важная вещь из книги находится всегда — иначе неудачный бросок завёл бы сюжет в тупик. Удача решает остальное.
                val lore = books.search(s.bookId, s.location, 3).joinToString(" ") { it.text }
                val loreStems = Text.stems(lore).toSet()
                val item = books.entities(s.bookId, "item").map { it.name }
                    .filter { ' ' in it && !Text.mentions(it, "монета") && !Text.mentions(it, "печать") && Text.stems(it).all { st -> st in loreStems } && s.findItem(it) == null }
                    .sortedBy { if (Text.mentions(it, "ключ") || Text.mentions(it, "отмычка")) 0 else 1 }.firstOrNull()
                if (item != null) { s = s.copy(inventory = s.inventory + Item(Text.slug(item), item)); note = "Найдено: $item. "; important += "Вы находите здесь: $item."; journal("найдено: $item") }
                val (ok, text, g2) = testLuck(gb, rng); gb = g2; note += text
                if (ok) { val g = d6(rng); s = s.copy(hero = s.hero.copy(gold = s.hero.gold + g)); note += " Заодно найдено монет: $g."; important += "Заодно вы находите несколько монет." }
                else { hurt(2); note += " Ловушка: −2 к Силе."; important += "При обыске вы попадаете в ловушку и ранены." }
                val b = director(s, action); s = b.state.copy(gamebook = s.gamebook); beat = b.text
            }
            "go" -> {
                val target = choice.target
                val locked = s.lockedLocations.firstOrNull { Text.stemKey(it) == Text.stemKey(target) }
                val key = s.inventory.firstOrNull { Text.mentions(it.name, "ключ") || Text.mentions(it.name, "отмычка") }
                if (locked != null && key == null) {
                    action = "попытаться войти в место: $target"; note = "Заперто. Нужен ключ."; important += "Путь в место «$target» заперт, без ключа вы войти не можете и остаётесь снаружи."
                } else {
                    if (locked != null) { s = s.copy(lockedLocations = s.lockedLocations - locked); note = "«${key!!.name}» подходит к замку. "; important += "Вы отпираете путь предметом «${key.name}» и входите." }
                    val from = s.location
                    val first = gb.visited.none { Text.stemKey(it) == Text.stemKey(target) }
                    s = s.copy(location = target); gb = gb.copy(visited = (gb.visited + target).distinct())
                    action = "отправиться в место: $target"
                    val enemy = if (first) enemyFor(s.copy(gamebook = gb), books, target) else null
                    if (enemy != null) {
                        gb = gb.copy(combat = Combat(enemy.first, enemy.second, enemy.third, 0, from))
                        note += "Враг: ${enemy.first} (Ловкость ${enemy.second}, Сила ${enemy.third}). Бой!"
                        important += "Здесь на вас нападает ${enemy.first}. Начинается бой, он ещё не окончен."
                    } else { journal("новое место: $target") }
                }
            }
            "strike", "luckstrike" -> {
                val c = gb.combat!!
                val h1 = d6(rng); val h2 = d6(rng); val e1 = d6(rng); val e2 = d6(rng)
                val hero = h1 + h2 + gb.skill; val foe = e1 + e2 + c.skill
                note = "Раунд ${c.round + 1}. Вы: $h1 + $h2 + Ловкость ${gb.skill} = $hero. ${c.enemy.replaceFirstChar { it.uppercase() }}: $e1 + $e2 + ${c.skill} = $foe. "
                var dmgFoe = 0; var dmgHero = 0
                if (hero > foe) dmgFoe = 2 else if (foe > hero) dmgHero = 2
                if (choice.kind == "luckstrike" && (dmgFoe > 0 || dmgHero > 0)) {
                    val (ok, text, g2) = testLuck(gb, rng); gb = g2
                    if (dmgFoe > 0) dmgFoe = if (ok) 4 else 1 else dmgHero = if (ok) 1 else 3
                    note += "$text "
                }
                val foeLeft = c.stamina - dmgFoe
                hurt(dmgHero)
                note += when { dmgFoe > 0 -> "Ваш удар: −$dmgFoe к Силе врага (осталось ${foeLeft.coerceAtLeast(0)})."; dmgHero > 0 -> "Вы ранены: −$dmgHero к Силе."; else -> "Удары отбиты, никто не ранен." }
                action = "сражаться, противник — ${c.enemy}"
                when {
                    foeLeft <= 0 -> {
                        val g = d6(rng) / 2 + 1
                        s = s.copy(hero = s.hero.copy(gold = s.hero.gold + g)); gb = gb.copy(combat = null, kills = gb.kills + 1)
                        note += " Победа! Добыча: монет $g."; important += "Вы побеждаете: ${c.enemy} повержен."; journal("побеждён ${c.enemy}")
                    }
                    else -> {
                        gb = gb.copy(combat = c.copy(stamina = foeLeft, round = c.round + 1))
                        important += if (dmgFoe > 0) "В этом раунде вы раните противника (${c.enemy}), бой продолжается." else if (dmgHero > 0) "В этом раунде ${c.enemy} ранит вас, бой продолжается." else "Противники обмениваются ударами без результата, бой продолжается."
                    }
                }
            }
            "flee" -> {
                val c = gb.combat!!
                hurt(2); note = "Вы бежите с поля боя: −2 к Силе."
                action = "вырваться из боя и бежать"
                s = s.copy(location = c.cameFrom.ifEmpty { s.location }); gb = gb.copy(combat = null)
                important += "Вы спасаетесь бегством, ${c.enemy} остаётся позади."
            }
            "eat" -> { gb = gb.copy(provisions = gb.provisions - 1); s = s.copy(hero = s.hero.copy(hp = (s.hero.hp + 4).coerceAtMost(s.hero.maxHp))); action = "сделать привал и поесть"; note = "Привал: +4 к Силе. Припасов осталось: ${gb.provisions}." }
            else -> { action = "затаиться и понаблюдать"; val b = director(s, action); s = b.state.copy(gamebook = s.gamebook); beat = b.text }
        }

        if (s.hero.hp <= 0) {
            gb = gb.copy(dead = true, combat = null); note += " Сила упала до нуля."
            important.clear(); important += "Вы погибаете. Это конец пути — опиши гибель коротко и без натурализма."
            journal("герой погиб")
        } else if (gb.combat == null && isFinale(s, books)) {
            gb = gb.copy(won = true)
            val goal = s.quests.firstOrNull()?.title ?: "разгадать тайну этих мест"
            important += "Это финал: вы достигаете цели («$goal»). Опиши развязку."
            s = s.copy(quests = s.quests.map { it.copy(status = "done") }); journal("цель достигнута")
        }
        gb = gb.copy(dice = note)
        // Сюжет продвинулся — на карте появляются места из новых глав книги.
        val open = books.entities(s.bookId).filter { it.kind in PLACE_KINDS && it.firstChapter <= s.stage }.map { it.name }
        s = s.copy(knownLocations = (s.knownLocations + open).distinctBy { Text.stemKey(it) }.take(40))
        s = s.copy(gamebook = gb)
        s = s.copy(gamebook = gb.copy(choices = choices(s)))
        return Outcome(s, action, note.trim(), beat, important)
    }

    /** Финал: сюжет дошёл до последней главы книги, её зацепки найдены, мир пройден. */
    fun isFinale(s: GameState, books: BookRepository): Boolean {
        val chapters = books.indexedChapterCount(s.bookId)
        if (chapters == 0 || s.stage < chapters - 1) return false
        val last = books.chapterChunks(s.bookId, chapters - 1).map { it.first }
        val gb = s.gamebook ?: return false
        // Кроме зацепок последней главы нужно пройти мир: побывать хотя бы в трёх местах и открыть запертые.
        return last.isNotEmpty() && last.count { it in s.usedClues } >= minOf(2, last.size) && gb.visited.size >= minOf(3, s.knownLocations.size) && s.lockedLocations.isEmpty()
    }
}
