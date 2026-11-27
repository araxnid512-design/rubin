package ru.livebook.core

import ru.livebook.core.importer.BookImporter
import ru.livebook.core.lore.BookRepository
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class LoreTest {
    @Test fun indexSampleBookAndExtractEntities() = World().use { w ->
        val id = w.addSample()
        val b = w.books.book(id)!!
        assertTrue(b.fullyIndexed); assertTrue(b.entitiesDone)
        val persons = w.books.entities(id, "person").map { it.name }
        val places = w.books.entities(id, "place").map { it.name }
        val items = w.books.entities(id, "item").map { it.name }
        println("ПЕРСОНАЖИ: $persons\nМЕСТА: $places\nПРЕДМЕТЫ: $items\nФРАКЦИИ: ${w.books.entities(id, "faction").map { it.name }}\nПРАВИЛА: ${w.books.entities(id, "rule").map { it.descr }}")
        for (n in listOf("Мира", "Арсений", "Борин")) assertTrue(n in persons, "$n среди персонажей: $persons")
        assertTrue(places.any { it.contains("Лисья свеча") }, "трактир среди мест: $places")
        assertTrue("Северная долина" in places, "долина среди мест: $places")
        assertTrue(persons.none { it in places })
        assertTrue(items.any { it.contains("ключ") } && items.any { it.contains("плащ") }, "$items")
        assertTrue(w.books.entities(id, "rule").isNotEmpty())
        assertEquals(3, w.books.entities(id, "event").size)
        assertEquals(listOf("Старая башня"), w.books.entities(id, "lock").map { it.name }, "запечатанное место из книги")
    }

    @Test fun searchFindsRelevantChunk() = World().use { w ->
        val id = w.addSample()
        val hits = w.books.search(id, "показываю ключ стражу у северных ворот", 2)
        assertTrue(hits.isNotEmpty())
        assertTrue(hits.any { it.text.contains("Борин") }, hits.joinToString(" || ") { it.text })
        assertTrue(w.books.search(id, "големы и три правила мастерской", 1)[0].text.contains("голем"))
        assertTrue(w.books.search(id, "и в на", 3).isEmpty())
        assertTrue(w.books.search(id, "космический корабль лазер", 3).isEmpty())
    }

    @Test fun chunkSizes() {
        val chunks = BookRepository.chunk(Fixtures.sampleText)
        assertTrue(chunks.size >= 3)
        assertTrue(chunks.all { it.length <= 860 }, chunks.map { it.length }.toString() + chunks.maxByOrNull { it.length })
        assertTrue(chunks.dropLast(1).count { it.length < 150 } <= 1, chunks.map { it.length }.toString())
    }

    @Test fun indexingCanBeCancelledAndResumed() = World().use { w ->
        val id = w.books.addBook(BookImporter.import("vorota_mha.txt", Fixtures.sampleBytes))
        var calls = 0
        val finished = w.books.indexBook(id, isCancelled = { calls >= 1 }) { done, _ -> calls = done }
        assertFalse(finished)
        val partial = w.books.book(id)!!
        assertEquals(1, partial.indexedChapters)
        assertTrue(partial.entitiesDone, "после первой главы уже можно играть")
        assertTrue("Мира" in w.books.entities(id, "person").map { it.name })
        assertTrue(w.books.search(id, "Борин страж", 2).isEmpty(), "вторая глава ещё не проиндексирована")
        assertTrue(w.books.indexBook(id))
        assertEquals(3, w.books.book(id)!!.indexedChapters)
        assertTrue(w.books.search(id, "Борин страж", 2).isNotEmpty())
    }

    @Test fun deleteBookRemovesIndex() = World().use { w ->
        val id = w.addSample()
        w.books.deleteBook(id)
        assertTrue(w.books.books().isEmpty())
        assertTrue(w.books.search(id, "Мира трактир", 3).isEmpty())
        assertEquals(0, w.db.one("SELECT COUNT(*) FROM chunk_fts") { it.int(0) })
    }
}
