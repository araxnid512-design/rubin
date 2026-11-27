package ru.livebook.core

import ru.livebook.core.game.GamebookEngine
import ru.livebook.core.model.Combat
import ru.livebook.core.model.GameState
import ru.livebook.core.model.Item
import java.io.File
import ru.livebook.core.importer.BookImporter
import kotlin.random.Random
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Кубики с заранее заданными значениями. */
class Dice(vararg values: Int) : Random() {
    private val q = ArrayDeque(values.toList())
    override fun nextBits(bitCount: Int): Int = 0
    override fun nextInt(from: Int, until: Int): Int = if (q.isEmpty()) 3 else q.removeFirst()
}

class GamebookTest {
    private fun World.start(vararg dice: Int = intArrayOf(4, 3, 4, 3)): String = game.newGame(addSample(), "Арсений", "странник", "canon", true, gamebook = true, rng = Dice(*dice))
    private fun World.put(g: String, f: (GameState) -> GameState) = db.exec("UPDATE game SET state=? WHERE id=?", f(saves.state(g)!!).toJson(), g)
    private fun World.gb(g: String) = saves.state(g)!!.gamebook!!

    @Test fun heroIsRolledByTheGenreRules() = World().use { w ->
        val g = w.start(4, 3, 5, 2)
        val s = w.saves.state(g)!!
        assertEquals(10, s.gamebook!!.skill); assertEquals(20, s.hero.hp); assertEquals(20, s.hero.maxHp); assertEquals(8, s.gamebook!!.luck); assertEquals(2, s.gamebook!!.provisions)
        repeat(30) { val r = GamebookEngine.rollHero(s, Random(it)); assertTrue(r.gamebook!!.skill in 7..12 && r.hero.hp in 14..24 && r.gamebook!!.luck in 7..12) }
        // Старые сохранения без книги-игры читаются как раньше.
        assertNull(GameState.fromJson(s.copy(gamebook = null).toJson()).gamebook)
        assertEquals(s, GameState.fromJson(s.toJson()))
    }

    @Test fun firstParagraphAndChoices() = World().use { w ->
        val g = w.start()
        val r = w.game.gamebookTurn(g, "start")
        assertEquals("llm", r.kind)
        val gb = r.state.gamebook!!
        assertEquals(1, gb.para)
        println("ВЫБОР: " + gb.choices.joinToString(" | ") { it.label })
        assertTrue(gb.choices.any { it.kind == "talk" && it.label.contains("Миру") })
        assertTrue(gb.choices.any { it.kind == "search" })
        assertTrue(gb.choices.any { it.kind == "go" && it.label.contains("Старая башня") && it.label.contains("заперто") })
        assertTrue(gb.choices.size in 3..7)
        val p = w.llm.prompts.single()
        assertTrue(p.contains("параграфы книги-игры") && p.contains("говори «вы»"))
        assertTrue(w.llm.grammars.single()!!.contains("\"Вы \""))
        assertEquals("Страница 1. Начало", w.saves.turns(g).single().action)
        assertEquals("error", w.game.gamebookTurn(g, "нет-такого").kind)
        assertEquals(1, w.gb(g).para, "неверный выбор ничего не меняет")
    }

    @Test fun talkAdvancesThePlot() = World().use { w ->
        val g = w.start(); w.game.gamebookTurn(g, "start")
        val r = w.game.gamebookTurn(g, "talk:mira")
        assertTrue(r.beat.startsWith("в сцене всплывает зацепка"), r.beat)
        assertTrue(w.llm.prompts.last().contains("Упомяни своими словами: ") && w.llm.prompts.last().contains("Выбор читателя: расспросить Миру"))
        assertEquals(1, r.state.findNpc("Мира")!!.relation); assertEquals(1, r.state.usedClues.size)
        assertEquals(1, r.state.stage, "первая глава короткая: одной зацепки хватает, сюжет идёт дальше")
        // На новом этапе у Миры есть новая новость, а после неё — уже нет.
        val second = w.game.gamebookTurn(g, "talk:mira")
        assertTrue(second.beat.isNotEmpty() && second.beat != r.beat)
    }

    @Test fun searchAlwaysFindsThePlotItemLuckDecidesTheRest() = World().use { w ->
        val g = w.start(); w.game.gamebookTurn(g, "start")
        val luck = w.gb(g).luck; val gold = w.saves.state(g)!!.hero.gold
        val ok = w.game.gamebookTurn(g, "search", rng = Dice(1, 1, 4))
        println("ПОИСК: " + ok.notes.single())
        assertTrue(ok.notes.single().contains("повезло") && ok.state.hasItem("ржавый ключ"), ok.notes.toString())
        assertEquals(luck - 1, ok.state.gamebook!!.luck); assertEquals(gold + 4, ok.state.hero.gold)
        assertTrue(w.llm.prompts.last().contains("Важно: Вы находите здесь: ржавый ключ."))
        assertTrue(ok.state.gamebook!!.choices.none { it.kind == "search" }, "одно место обыскивается один раз")
        // Неудача: ловушка, но ключ всё равно найден — сюжет не заходит в тупик.
        World().use { w2 ->
            val g2 = w2.start(); w2.game.gamebookTurn(g2, "start")
            val hp = w2.saves.state(g2)!!.hero.hp
            val bad = w2.game.gamebookTurn(g2, "search", rng = Dice(6, 6))
            assertTrue(bad.notes.single().contains("не повезло")); assertEquals(hp - 2, bad.state.hero.hp); assertTrue(bad.state.hasItem("ржавый ключ"))
        }
    }

    @Test fun lockedPlaceNeedsTheKey() = World().use { w ->
        val g = w.start(); w.game.gamebookTurn(g, "start")
        val id = w.gb(g).choices.first { it.target == "Старая башня" }.id
        val blocked = w.game.gamebookTurn(g, id)
        assertTrue(blocked.state.location.contains("Лисья свеча")); assertTrue(blocked.notes.single().contains("Заперто"))
        w.put(g) { it.copy(inventory = it.inventory + Item("kluch", "ржавый ключ")).let { s -> s.copy(gamebook = s.gamebook!!.copy(choices = GamebookEngine.choices(s))) } }
        assertTrue(w.gb(g).choices.any { it.label.startsWith("Открыть ключом") })
        val opened = w.game.gamebookTurn(g, id)
        assertEquals("Старая башня", opened.state.location); assertTrue(opened.state.lockedLocations.isEmpty()); assertTrue(opened.notes.single().contains("ржавый ключ"))
    }

    @Test fun combatByDiceUntilVictory() = World().use { w ->
        val g = w.start(); w.game.gamebookTurn(g, "start")
        w.put(g) { it.copy(gamebook = it.gamebook!!.copy(combat = Combat("волк", 6, 4, 0, it.location))).let { s -> s.copy(gamebook = s.gamebook!!.copy(choices = GamebookEngine.choices(s))) } }
        assertEquals(listOf("strike", "luck"), w.gb(g).choices.map { it.id }, "бежать можно только после первого раунда")
        val hp = w.saves.state(g)!!.hero.hp; val gold = w.saves.state(g)!!.hero.gold
        val r1 = w.game.gamebookTurn(g, "strike", rng = Dice(6, 6, 1, 1))
        println("БОЙ: " + r1.notes.single())
        assertEquals(2, r1.state.gamebook!!.combat!!.stamina); assertEquals(hp, r1.state.hero.hp)
        assertTrue(r1.state.gamebook!!.choices.any { it.id == "flee" })
        assertTrue(w.llm.prompts.last().contains("вы раните противника") && w.llm.grammars.last()!!.contains("\"Волк \""))
        val r2 = w.game.gamebookTurn(g, "strike", rng = Dice(6, 6, 1, 1, 4))
        assertNull(r2.state.gamebook!!.combat); assertEquals(1, r2.state.gamebook!!.kills); assertEquals(gold + 3, r2.state.hero.gold)
        assertTrue(r2.notes.single().contains("Победа")); assertTrue(r2.state.journal.last().contains("побеждён волк"))
        assertTrue(r2.state.gamebook!!.choices.any { it.kind == "talk" }, "после боя снова обычный выбор")
    }

    @Test fun luckInCombatFleeEatAndDeath() = World().use { w ->
        val g = w.start(); w.game.gamebookTurn(g, "start")
        fun fight(st: Int) = w.put(g) { it.copy(gamebook = it.gamebook!!.copy(combat = Combat("голем", 9, st, 1, "Северные ворота"))).let { s -> s.copy(gamebook = s.gamebook!!.copy(choices = GamebookEngine.choices(s))) } }
        fight(10)
        val luck = w.gb(g).luck
        val lucky = w.game.gamebookTurn(g, "luck", rng = Dice(6, 6, 1, 1, 1, 1))     // герой попал и удачлив: урон 4
        assertEquals(6, lucky.state.gamebook!!.combat!!.stamina); assertEquals(luck - 1, lucky.state.gamebook!!.luck)
        val hp = lucky.state.hero.hp
        val unlucky = w.game.gamebookTurn(g, "luck", rng = Dice(1, 1, 6, 6, 6, 6))   // герой пропустил удар и неудачлив: урон 3
        assertEquals(hp - 3, unlucky.state.hero.hp)
        val fled = w.game.gamebookTurn(g, "flee")
        assertEquals(hp - 5, fled.state.hero.hp); assertNull(fled.state.gamebook!!.combat); assertEquals("Северные ворота", fled.state.location)
        val ate = w.game.gamebookTurn(g, "eat")
        assertEquals(hp - 1, ate.state.hero.hp); assertEquals(1, ate.state.gamebook!!.provisions)
        // Гибель: Сила падает до нуля, выбора больше нет, это записано в сохранении.
        w.put(g) { it.copy(hero = it.hero.copy(hp = 2)) }; fight(10)
        val dead = w.game.gamebookTurn(g, "strike", rng = Dice(1, 1, 6, 6))
        assertTrue(dead.state.gamebook!!.dead); assertTrue(dead.state.gamebook!!.choices.isEmpty()); assertEquals(0, dead.state.hero.hp)
        assertTrue(w.llm.prompts.last().contains("Вы погибаете"))
        assertEquals("error", w.game.gamebookTurn(g, "strike").kind)
        assertNotNull(w.saves.undoLastTurn(g), "последний ход можно переиграть")
        assertFalse(w.gb(g).dead)
    }

    @Test fun mapOpensChapterByChapter() = World().use { w ->
        val g = w.start()
        val sites = w.books.entities(w.saves.state(g)!!.bookId, "site")
        println("МЕСТА ИЗ КНИГИ: " + sites.joinToString { "${it.name} (гл. ${it.firstChapter + 1})" })
        assertTrue(sites.any { it.name == "Северные ворота" } && sites.any { it.name.contains("астерская") }, sites.map { it.name }.toString())
        assertTrue(sites.none { it.name.startsWith("Сво") || it.name.startsWith("Дыхани") }, "местоимения и существительные — не названия")
        val start = w.saves.state(g)!!.knownLocations
        assertTrue(start.none { it == "Мастерская" } && start.any { it.contains("Лисья свеча") } && start.any { it == "Северные ворота" }, "в начале известны места первой главы: $start")
        w.game.gamebookTurn(g, "start"); w.game.gamebookTurn(g, "talk:mira")
        val mid = w.saves.state(g)!!
        assertTrue(mid.stage == 1 && mid.knownLocations.any { it == "Разрушенная крепость" } && mid.knownLocations.none { it == "Мастерская" }, "открылась вторая глава: ${mid.stage} ${mid.knownLocations}")
    }

    @Test fun firstVisitMayStartAFight() = World().use { w ->
        val g = w.start(); w.game.gamebookTurn(g, "start")
        assertTrue(GamebookEngine.threats(w.books, w.saves.state(g)!!.bookId, 2).any { it.first == "глиняный голем" }, "враги берутся из книги")
        var fights = 0
        for (c in w.gb(g).choices.filter { it.kind == "go" && !it.label.contains("заперто") }) {
            w.put(g) { s -> s.copy(location = "Трактир «Лисья свеча»", gamebook = s.gamebook!!.copy(combat = null)).let { x -> x.copy(gamebook = x.gamebook!!.copy(choices = GamebookEngine.choices(x))) } }
            val id = w.gb(g).choices.firstOrNull { it.target == c.target }?.id ?: continue
            val r = w.game.gamebookTurn(g, id)
            if (r.state.gamebook!!.combat != null) { fights++; assertTrue(r.notes.single().contains("Бой!")); assertEquals(listOf("strike", "luck"), r.state.gamebook!!.choices.map { it.id }) }
            // Повторный приход боя не начинает.
        }
        println("БОЁВ ПРИ ПЕРВОМ ПОСЕЩЕНИИ: $fights")
    }

    @Test fun storyReachesTheFinale() = World().use { w ->
        val g = w.start(); w.game.gamebookTurn(g, "start")
        var turns = 0
        val path = ArrayList<String>()
        // Простая стратегия игрока: бой — бить; иначе новое: расспросить, обыскать, открыть ключом, идти в новое место, ждать.
        while (!w.gb(g).won && !w.gb(g).dead && turns < 60) {
            val cs = w.gb(g).choices
            val c = cs.firstOrNull { it.kind == "strike" } ?: cs.firstOrNull { it.kind == "eat" } ?: cs.firstOrNull { it.kind == "talk" && it.label.startsWith("Расспросить") }
                ?: cs.firstOrNull { it.kind == "search" } ?: cs.firstOrNull { it.label.startsWith("Открыть ключом") } ?: cs.firstOrNull { it.kind == "go" && !it.label.contains("заперто") && it.target !in w.gb(g).visited }
                ?: cs.firstOrNull { it.kind == "wait" } ?: cs.first { it.kind == "go" && !it.label.contains("заперто") }
            path += c.label.take(28)
            w.game.gamebookTurn(g, c.id, rng = if (c.kind == "strike") Dice(6, 5, 1, 2, 3) else Dice(1, 2)); turns++
        }
        println("ПУТЬ: " + path.joinToString(" → "))
        val s = w.saves.state(g)!!
        println("ФИНАЛ через $turns ходов, глава ${s.stage + 1}, зацепок ${s.usedClues.size}, мест ${s.gamebook!!.visited.size}, побед ${s.gamebook!!.kills}, Сила ${s.hero.hp}")
        assertTrue(s.gamebook!!.won, "финал достигнут")
        assertTrue(s.quests.all { it.status == "done" }); assertTrue(s.gamebook!!.choices.isEmpty())
        assertTrue(w.llm.prompts.last().contains("Это финал"))
        assertEquals(turns + 1, s.gamebook!!.para)
        assertTrue(s.gamebook!!.visited.size >= 3 && s.lockedLocations.isEmpty(), "до финала надо пройти мир и открыть башню")
        assertTrue(s.knownLocations.any { it == "Мастерская" }, "к финалу открыты места последней главы")
    }

    @Test fun modelFailureKeepsTheDiceResult() = World(replies = arrayListOf("Тишина вокруг, вы ждёте.", "…", "Я.")).use { w ->
        val g = w.start(); w.game.gamebookTurn(g, "start")
        val r = w.game.gamebookTurn(g, "search", rng = Dice(1, 1))
        assertEquals("fallback", r.kind); assertTrue(r.notice.contains("ход засчитан"))
        assertTrue(r.state.hasItem("ржавый ключ"), "исход кубиков не теряется")
        assertTrue(r.narrative.contains("ржавый ключ")); assertEquals(2, w.gb(g).para)
        w.llm.cancelNext = true
        assertEquals("error", w.game.gamebookTurn(g, "talk:mira").kind); assertEquals(2, w.gb(g).para)
    }
}

class QuestPagesTest {
    @Test fun samePlaceSameChoiceSamePage() = World().use { w ->
        val book = w.addSample()
        val g1 = w.game.newGame(book, "Арсений", "странник", "canon", true, gamebook = true, rng = Dice(4, 3, 4, 3))
        val a1 = w.game.gamebookTurn(g1, "start"); val b1 = w.game.gamebookTurn(g1, "talk:mira")
        assertFalse(a1.cached); assertEquals(1, a1.page); assertEquals(2, b1.page)
        val calls = w.llm.prompts.size
        // Новая партия по той же книге: те же страницы открываются мгновенно, модель не вызывается.
        val g2 = w.game.newGame(book, "Арсений", "странник", "canon", true, gamebook = true, rng = Dice(6, 6, 6, 6))
        val a2 = w.game.gamebookTurn(g2, "start"); val b2 = w.game.gamebookTurn(g2, "talk:mira")
        assertTrue(a2.cached && b2.cached); assertEquals(calls, w.llm.prompts.size)
        assertEquals(a1.narrative, a2.narrative); assertEquals(b1.narrative, b2.narrative); assertEquals(listOf(1, 2), listOf(a2.page, b2.page))
        assertEquals("Страница 2. Расспросить Миру", w.saves.turns(g2).last().action)
        // Готовые страницы читаются и без модели; ненаписанная страница без модели — понятная ошибка.
        w.llmAvailable = false
        val g3 = w.game.newGame(book, "Арсений", "странник", "canon", true, gamebook = true, rng = Dice(4, 3, 4, 3))
        assertTrue(w.game.gamebookTurn(g3, "start").cached)
        val miss = w.game.gamebookTurn(g3, "search")
        assertEquals("error", miss.kind); assertTrue(miss.notice.contains("ещё не написана"))
        assertEquals(1, w.saves.state(g3)!!.gamebook!!.para, "ход без страницы не засчитан")
        // Другой герой — другие страницы; очистка стирает всё.
        assertEquals(2, w.books.pageCount(book)); w.books.clearPages(book); assertEquals(0, w.books.pageCount(book))
    }

    @Test fun questCanBePreparedInAdvance() = World().use { w ->
        val book = w.addSample()
        var seen = 0
        val created = w.game.prepareQuest(book, "Арсений", "странник", "canon", true) { pages, _ -> seen = pages }
        val pages = w.books.pageCount(book)
        println("ПОДГОТОВКА: написано страниц $pages, вызовов модели ${w.llm.prompts.size}")
        assertTrue(pages >= 25, "страниц: $pages"); assertEquals(pages, seen); assertEquals(pages, created)
        assertTrue(w.saves.games().isEmpty(), "пробные прохождения не остаются в списке игр")
        // Повторная подготовка почти ничего не добавляет.
        val again = w.game.prepareQuest(book, "Арсений", "странник", "canon", true, runs = 3)
        println("ПОВТОРНАЯ ПОДГОТОВКА: новых страниц $again")
        assertTrue(again <= pages / 4, "повторно создано $again")
        // Обычная партия после подготовки: большинство страниц уже готово.
        val g = w.game.newGame(book, "Арсений", "странник", "canon", true, gamebook = true, rng = Dice(4, 3, 4, 3))
        var ready = 0; var total = 0; var choice = "start"
        while (total < 25) {
            val r = w.game.gamebookTurn(g, choice, rng = Random(total)); total++; if (r.cached) ready++
            val gb = r.state.gamebook!!; if (gb.dead || gb.won) break
            val cs = gb.choices
            choice = (cs.firstOrNull { it.kind == "strike" } ?: cs.firstOrNull { it.kind == "talk" && it.label.startsWith("Расспросить") } ?: cs.firstOrNull { it.kind == "search" }
                ?: cs.firstOrNull { it.label.startsWith("Открыть ключом") } ?: cs.firstOrNull { it.kind == "go" && !it.label.contains("заперто") && it.target !in gb.visited } ?: cs.first()).id
        }
        println("ПАРТИЯ ПОСЛЕ ПОДГОТОВКИ: готовых страниц $ready из $total")
        assertTrue(ready * 10 >= total * 7, "готовых $ready из $total")
        // Отмена сохраняет уже написанное.
        w.books.clearPages(book)
        var n = 0
        w.game.prepareQuest(book, "Арсений", "странник", "canon", true, isCancelled = { n >= 5 }) { p, _ -> n = p }
        assertTrue(w.books.pageCount(book) in 5..7)
    }
}

class CastleBookTest {
    @Test fun secondSampleBookBecomesAQuest() = World().use { w ->
        val file = listOf(File("../sample/zamok_voronya_skala.txt"), File("sample/zamok_voronya_skala.txt")).first { it.exists() }
        val book = w.books.addBook(BookImporter.import(file.name, file.readBytes())); w.books.indexBook(book)
        for (k in listOf("person", "place", "site", "lock", "item", "faction")) println("ЗАМОК $k: " + w.books.entities(book, k).joinToString { it.name })
        val pages = w.game.prepareQuest(book, "Радим", "следопыт", "canon", true)
        println("ЗАМОК: страниц $pages")
        var wins = 0; var shown = false
        for (seed in 1..8) {
            val g = w.game.newGame(book, "Радим", "следопыт", "canon", true, gamebook = true, rng = Random(seed))
            var total = 0; var ready = 0; var choice = "start"; val path = ArrayList<String>(); val rng = Random(seed * 31)
            while (total < 120) {
                val before = w.saves.state(g)!!
                path += before.gamebook!!.choices.firstOrNull { it.id == choice }?.label ?: "Начало"
                val r = w.game.gamebookTurn(g, choice, rng = rng); total++; if (r.cached) ready++
                val gb = r.state.gamebook!!; if (gb.dead || gb.won) break
                val cs = gb.choices; val hp = r.state.hero.hp
                // Осторожный игрок: при малой Силе ест, бежит из боя и не лезет в ловушки.
                choice = (cs.firstOrNull { it.kind == "flee" && hp <= 6 } ?: cs.firstOrNull { it.kind == "strike" } ?: cs.firstOrNull { it.kind == "eat" } ?: cs.firstOrNull { it.kind == "talk" && it.label.startsWith("Расспросить") }
                    ?: cs.firstOrNull { it.kind == "search" && hp > 8 } ?: cs.firstOrNull { it.label.startsWith("Открыть ключом") } ?: cs.firstOrNull { it.kind == "go" && !it.label.contains("заперто") && it.target !in gb.visited }
                    ?: cs.firstOrNull { it.kind == "search" } ?: cs.first()).id
            }
            val gb = w.saves.state(g)!!.gamebook!!
            println("ЗАМОК партия $seed: ходов $total, готовых страниц $ready, победа ${gb.won}, гибель ${gb.dead}")
            assertTrue(gb.won || gb.dead, "партия $seed не закончилась за $total ходов")
            if (gb.won) { wins++; if (!shown) { shown = true; println("ЗАМОК ПУТЬ: " + path.joinToString(" → ")) } }
        }
        assertTrue(wins >= 2, "побед $wins из 8")
        assertTrue(pages >= 30, "страниц $pages")
    }
}
