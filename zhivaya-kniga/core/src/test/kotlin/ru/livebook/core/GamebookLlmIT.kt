package ru.livebook.core

import ru.livebook.core.db.Db
import ru.livebook.core.game.GameOrchestrator
import ru.livebook.core.game.SaveRepository
import ru.livebook.core.importer.BookImporter
import ru.livebook.core.llm.GameSettings
import ru.livebook.core.llm.LlamaLlm
import ru.livebook.core.lore.BookRepository
import java.io.File
import kotlin.random.Random
import kotlin.test.Test
import kotlin.test.assertTrue

/** Партия в книгу-игру с НАСТОЯЩЕЙ моделью: правила и кубики решают исход, модель пишет параграфы. Запуск — как у RealLlmIT. */
class GamebookLlmIT {
    @Test fun playGamebookWithRealModel() {
        val path = System.getenv("LIVEBOOK_MODEL")?.takeIf { File(it).exists() && System.getenv("LIVEBOOK_NATIVE_DIR") != null } ?: return println("GamebookLlmIT пропущен")
        val llm = LlamaLlm(path, 2048, 4); llm.configureThreads(4, false)
        val db = Db(":memory:"); val books = BookRepository(db); val saves = SaveRepository(db)
        val game = GameOrchestrator(books, saves) { llm }
        val bookId = books.addBook(BookImporter.import("vorota_mha.txt", Fixtures.sampleBytes)); books.indexBook(bookId)
        val rng = Random(20261127)
        val g = game.newGame(bookId, "Арсений", "странник", "canon", true, gamebook = true, rng = rng)
        val sb = StringBuilder("# Книга-игра с настоящей моделью (${llm.meta("general.name")}, настольная машина)\n\n")
        val s0 = saves.state(g)!!
        sb.append("Герой: ${s0.hero.name}. Ловкость ${s0.gamebook!!.skill}, Сила ${s0.hero.hp}, Удача ${s0.gamebook!!.luck}. Цель: ${s0.quests.firstOrNull()?.title}. Заперто: ${s0.lockedLocations}.\n\n")
        val settings = GameSettings(seed = 99)
        val texts = ArrayList<String>(); val times = ArrayList<Double>(); var fallbacks = 0; var turns = 0
        var choice = "start"
        while (turns < 40) {
            val before = saves.state(g)!!.gamebook!!
            val label = before.choices.firstOrNull { it.id == choice }?.label ?: "Начало"
            val r = game.gamebookTurn(g, choice, settings, rng = rng)
            turns++
            val gb = r.state.gamebook!!
            if (r.kind == "fallback") fallbacks++ else { texts += r.narrative; r.stats?.let { times += it.totalMs } }
            sb.append("**§${gb.para}. $label**\n\n${r.narrative}\n\n")
            if (r.notes.firstOrNull().orEmpty().isNotEmpty()) sb.append("_${r.notes.first()}_\n\n")
            if (r.beat.isNotEmpty()) sb.append("_(зацепка от режиссёра: ${r.beat.take(100)})_\n\n")
            assertTrue(!r.narrative.contains("ИТОГ") && r.narrative.count { it in 'а'..'я' } > 10, r.narrative)
            assertTrue(r.state.hero.hp >= 0 && r.state.hero.gold >= 0)
            game.betweenTurns(g, settings)
            if (gb.dead || gb.won) break
            val cs = gb.choices
            // Та же простая стратегия, что и в тесте логики.
            choice = (cs.firstOrNull { it.kind == "strike" } ?: cs.firstOrNull { it.kind == "eat" } ?: cs.firstOrNull { it.kind == "talk" && it.label.startsWith("Расспросить") }
                ?: cs.firstOrNull { it.kind == "search" } ?: cs.firstOrNull { it.label.startsWith("Открыть ключом") } ?: cs.firstOrNull { it.kind == "go" && !it.label.contains("заперто") && it.target !in gb.visited }
                ?: cs.firstOrNull { it.kind == "wait" } ?: cs.first { it.kind == "go" && !it.label.contains("заперто") }).id
        }
        val s = saves.state(g)!!; val gb = s.gamebook!!
        sb.append("## Итог\n\n- Параграфов: ${gb.para}; исход: ${if (gb.won) "финал, цель достигнута" else if (gb.dead) "герой погиб" else "партия не закончена за $turns ходов"}\n")
        sb.append("- Параграфов от модели: ${texts.size}, из них разных: ${texts.distinct().size}; заменено сухой записью из-за сбоя модели: $fallbacks\n")
        sb.append("- Среднее время параграфа: ${times.average().toInt()} мс, максимум ${times.max().toInt()} мс\n")
        sb.append("- Лист героя: Ловкость ${gb.skill}, Сила ${s.hero.hp}/${s.hero.maxHp}, Удача ${gb.luck}/${gb.luckMax}, припасы ${gb.provisions}, монеты ${s.hero.gold}, побед ${gb.kills}\n")
        sb.append("- Вещи: ${s.inventory.joinToString { it.name }}; посещено мест: ${gb.visited.joinToString()}\n- Журнал: ${s.journal.joinToString(" | ")}\n")
        File("build/reports").mkdirs(); File("build/reports/gamebook-llm.md").writeText(sb.toString())
        llm.close(); db.close()
        assertTrue(texts.size >= turns - 2, "параграфов от модели ${texts.size} из $turns")
        assertTrue(texts.distinct().size >= texts.size - 1)
        assertTrue(gb.won || gb.dead || turns == 40)
    }
}
