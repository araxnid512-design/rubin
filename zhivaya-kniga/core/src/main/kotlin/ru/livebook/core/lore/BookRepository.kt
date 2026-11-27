package ru.livebook.core.lore

import ru.livebook.core.db.Db
import ru.livebook.core.importer.Chapter
import ru.livebook.core.importer.ImportedBook
import ru.livebook.core.model.Text
import java.util.UUID

data class BookInfo(
    val id: String, val title: String, val author: String, val format: String, val addedAt: Long,
    val chars: Int, val chapters: Int, val indexedChapters: Int, val entitiesDone: Boolean, val deepDone: Int,
) {
    val fullyIndexed: Boolean get() = indexedChapters >= chapters
    val progress: Float get() = if (chapters == 0) 0f else indexedChapters.toFloat() / chapters
}

data class LoreHit(val chapterIdx: Int, val text: String, val score: Double)

/** BookLibrary + LoreIndex: главы, чанки, FTS5-поиск и карточки сущностей. Канон книги хранится отдельно от состояния игр. */
class BookRepository(private val db: Db) {

    fun addBook(book: ImportedBook, now: Long = System.currentTimeMillis()): String {
        val id = UUID.randomUUID().toString()
        db.tx {
            db.exec("INSERT INTO book(id,title,author,format,added_at,chars,chapters) VALUES(?,?,?,?,?,?,?)", id, book.title, book.author, book.format, now, book.chars, book.chapters.size)
            book.chapters.forEachIndexed { i, ch -> db.exec("INSERT INTO chapter(book_id,idx,title,body) VALUES(?,?,?,?)", id, i, ch.title, ch.text) }
        }
        return id
    }

    fun books(): List<BookInfo> = db.query("SELECT id,title,author,format,added_at,chars,chapters,indexed_chapters,entities_done,deep_done FROM book ORDER BY added_at DESC") { toBook(it) }
    fun book(id: String): BookInfo? = db.one("SELECT id,title,author,format,added_at,chars,chapters,indexed_chapters,entities_done,deep_done FROM book WHERE id=?", id) { toBook(it) }
    private fun toBook(r: Db.Row) = BookInfo(r.str(0), r.str(1), r.str(2), r.str(3), r.long(4), r.int(5), r.int(6), r.int(7), r.int(8) == 1, r.int(9))

    fun deleteBook(id: String) = db.tx {
        db.exec("DELETE FROM chunk_fts WHERE rowid IN (SELECT id FROM chunk WHERE book_id=?)", id)
        db.exec("DELETE FROM book WHERE id=?", id)
    }

    fun chapters(bookId: String): List<Chapter> = db.query("SELECT title, body FROM chapter WHERE book_id=? ORDER BY idx", bookId) { Chapter(it.str(0), it.str(1)) }
    fun chapterTitles(bookId: String): List<Pair<String, Boolean>> = db.query("SELECT title, indexed FROM chapter WHERE book_id=? ORDER BY idx", bookId) { it.str(0) to (it.int(1) == 1) }

    /** Индексирует следующую главу. Возвращает false, когда индексировать больше нечего. */
    fun indexNextChapter(bookId: String): Boolean {
        val next = db.one("SELECT idx, body FROM chapter WHERE book_id=? AND indexed=0 ORDER BY idx LIMIT 1", bookId) { it.int(0) to it.str(1) } ?: return false
        db.tx {
            chunk(next.second).forEachIndexed { pos, body ->
                db.exec("INSERT INTO chunk(book_id,chapter_idx,pos,body) VALUES(?,?,?,?)", bookId, next.first, pos, body)
                db.exec("INSERT INTO chunk_fts(rowid,norm) VALUES(?,?)", db.lastInsertId(), Text.norm(body))
            }
            db.exec("UPDATE chapter SET indexed=1 WHERE book_id=? AND idx=?", bookId, next.first)
            db.exec("UPDATE book SET indexed_chapters=(SELECT COUNT(*) FROM chapter WHERE book_id=? AND indexed=1), entities_done=0 WHERE id=?", bookId, bookId)
        }
        return true
    }

    /**
     * Полная индексация с прогрессом, отменой и возобновлением: уже обработанные главы не трогаются.
     * Карточки персонажей строятся после первой главы (чтобы можно было начать играть) и в конце.
     */
    fun indexBook(bookId: String, isCancelled: () -> Boolean = { false }, onProgress: (done: Int, total: Int) -> Unit = { _, _ -> }): Boolean {
        val total = book(bookId)?.chapters ?: return false
        var done = book(bookId)!!.indexedChapters
        onProgress(done, total)
        while (!isCancelled()) {
            if (!indexNextChapter(bookId)) break
            done++
            if (done == 1 || done % 12 == 0) rebuildEntities(bookId)
            onProgress(done, total)
        }
        rebuildEntities(bookId)
        return book(bookId)!!.fullyIndexed
    }

    fun rebuildEntities(bookId: String) {
        val chapters = db.query("SELECT idx, title, body FROM chapter WHERE book_id=? AND indexed=1 ORDER BY idx", bookId) { IndexedValue(it.int(0), Chapter(it.str(1), it.str(2))) }
        val found = EntityExtractor.extract(chapters)
        db.tx {
            val refined = db.query("SELECT stem, kind, descr FROM entity WHERE book_id=? AND refined=1", bookId) { it.str(0) to (it.str(1) to it.str(2)) }.toMap()
            db.exec("DELETE FROM entity WHERE book_id=?", bookId)
            for (e in found) {
                val r = refined[e.stem]
                db.exec("INSERT INTO entity(book_id,kind,name,stem,freq,descr,first_chapter,source,refined) VALUES(?,?,?,?,?,?,?,?,?)",
                    bookId, r?.first ?: e.kind, e.name, e.stem, e.freq, r?.second ?: e.descr, e.firstChapter, if (r != null) "llm" else "rules", r != null)
            }
            db.exec("UPDATE book SET entities_done=1 WHERE id=?", bookId)
        }
    }

    fun entities(bookId: String, kind: String? = null): List<Entity> {
        val map: (Db.Row) -> Entity = { Entity(it.str(1), it.str(2), it.str(3), it.int(4), it.str(5), it.int(6), it.str(7), it.int(8) == 1, it.long(0)) }
        val sql = "SELECT id,kind,name,stem,freq,descr,first_chapter,source,refined FROM entity WHERE book_id=?"
        return if (kind == null) db.query("$sql ORDER BY id", bookId, map = map) else db.query("$sql AND kind=? ORDER BY freq DESC, id", bookId, kind, map = map)
    }

    fun refineEntity(id: Long, kind: String, descr: String) = db.tx {
        db.exec("UPDATE entity SET kind=?, descr=?, source='llm', refined=1 WHERE id=?", kind, descr, id)
        db.exec("UPDATE book SET deep_done=(SELECT COUNT(*) FROM entity e WHERE e.book_id=book.id AND e.refined=1) WHERE id=(SELECT book_id FROM entity WHERE id=?)", id)
    }

    /** Полнотекстовый поиск по основам слов запроса (FTS5 + bm25). */
    fun search(bookId: String, query: String, limit: Int = 3): List<LoreHit> {
        val stems = Text.words(query).filter { it.length >= 3 && it !in QUERY_STOP }.map { Text.stem(it) }.filter { it.length >= 3 }.distinct().take(12)
        if (stems.isEmpty()) return emptyList()
        val match = stems.joinToString(" OR ") { "\"$it\"*" }
        return db.query(
            "SELECT c.chapter_idx, c.body, bm25(chunk_fts) FROM chunk_fts JOIN chunk c ON c.id = chunk_fts.rowid WHERE chunk_fts MATCH ? AND c.book_id=? ORDER BY bm25(chunk_fts) LIMIT ?",
            match, bookId, limit,
        ) { LoreHit(it.int(0), it.str(1), -it.double(2)) }
    }

    fun firstChunks(bookId: String, limit: Int = 2): List<String> = db.query("SELECT body FROM chunk WHERE book_id=? ORDER BY chapter_idx, pos LIMIT ?", bookId, limit) { it.str(0) }

    companion object {
        private val QUERY_STOP = setOf("что", "как", "это", "его", "она", "они", "мне", "меня", "мой", "моя", "мою", "или", "для", "при", "про", "над", "под", "уже", "еще", "ещё", "там", "тут", "где", "когда", "если", "хочу", "буду", "очень", "тоже", "себя", "свой", "свою", "него", "неё", "нее", "ним", "них", "был", "была", "были", "есть", "герой", "героя")

        /** Чанки по 300–700 знаков, границы — по предложениям. */
        fun chunk(text: String, min: Int = 300, max: Int = 700): List<String> {
            val out = ArrayList<String>()
            val sb = StringBuilder()
            for (s in Text.splitSentences(text)) {
                var sent = s
                while (sent.length > max) { // очень длинное предложение режем по словам
                    val cut = sent.lastIndexOf(' ', max).let { if (it < max / 2) max else it }
                    if (sb.isNotEmpty()) { out += sb.toString().trim(); sb.setLength(0) }
                    out += sent.take(cut).trim(); sent = sent.drop(cut).trim()
                }
                if (sb.length + sent.length + 1 > max && sb.length >= min) { out += sb.toString().trim(); sb.setLength(0) }
                else if (sb.length + sent.length + 1 > max) { out += sb.toString().trim(); sb.setLength(0) }
                if (sb.isNotEmpty()) sb.append(' ')
                sb.append(sent)
            }
            if (sb.isNotBlank()) { if (sb.length < min / 2 && out.isNotEmpty() && out.last().length + sb.length < max + 150) out[out.size - 1] = out.last() + " " + sb.toString().trim() else out += sb.toString().trim() }
            return out.filter { it.isNotBlank() }
        }
    }
}
