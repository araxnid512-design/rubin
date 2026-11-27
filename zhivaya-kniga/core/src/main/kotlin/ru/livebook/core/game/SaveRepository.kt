package ru.livebook.core.game

import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import ru.livebook.core.db.Db
import ru.livebook.core.importer.Chapter
import ru.livebook.core.importer.ImportedBook
import ru.livebook.core.lore.BookRepository
import ru.livebook.core.model.GameState
import ru.livebook.core.rules.GameEvent
import java.io.InputStream
import java.io.OutputStream
import java.util.UUID
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream

data class GameInfo(val id: String, val bookId: String, val title: String, val turn: Int, val updatedAt: Long)
@Serializable data class TurnRecord(val n: Int, val action: String, val narrative: String, val events: List<GameEvent> = emptyList(), val kind: String = "llm", val stats: String = "", val createdAt: Long = 0)
data class SlotInfo(val slot: Int, val label: String, val turn: Int, val createdAt: Long)

@Serializable private data class BackupGame(val id: String, val bookId: String, val bookTitle: String, val title: String, val state: String, val turn: Int, val updatedAt: Long, val turns: List<TurnRecord>, val slots: List<BackupSlot>)
@Serializable private data class BackupSlot(val slot: Int, val label: String, val state: String, val turn: Int, val createdAt: Long)
@Serializable private data class BackupBook(val id: String, val title: String, val author: String, val format: String, val chapters: List<BackupChapter>)
@Serializable private data class BackupChapter(val title: String, val text: String)
@Serializable private data class BackupManifest(val app: String = "zhivaya-kniga", val version: Int = 1, val createdAt: Long, val games: Int, val books: Int)

class BackupException(message: String) : Exception(message)

/** Сохранения: автосохранение каждого хода (в одной транзакции), ручные слоты, откат хода, резервные копии. */
class SaveRepository(private val db: Db) {
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    fun createGame(bookId: String, title: String, state: GameState, now: Long = System.currentTimeMillis()): String {
        val id = UUID.randomUUID().toString()
        db.exec("INSERT INTO game(id,book_id,title,state,turn,updated_at) VALUES(?,?,?,?,0,?)", id, bookId, title, state.toJson(), now)
        return id
    }

    fun games(bookId: String? = null): List<GameInfo> {
        val map: (Db.Row) -> GameInfo = { GameInfo(it.str(0), it.str(1), it.str(2), it.int(3), it.long(4)) }
        return if (bookId == null) db.query("SELECT id,book_id,title,turn,updated_at FROM game ORDER BY updated_at DESC", map = map)
        else db.query("SELECT id,book_id,title,turn,updated_at FROM game WHERE book_id=? ORDER BY updated_at DESC", bookId, map = map)
    }

    fun game(id: String): GameInfo? = db.one("SELECT id,book_id,title,turn,updated_at FROM game WHERE id=?", id) { GameInfo(it.str(0), it.str(1), it.str(2), it.int(3), it.long(4)) }
    fun state(gameId: String): GameState? = db.one("SELECT state FROM game WHERE id=?", gameId) { it.str(0) }?.let { GameState.fromJson(it) }
    fun deleteGame(id: String) = db.exec("DELETE FROM game WHERE id=?", id)

    /** Автосохранение: прежнее состояние уходит в слот 0 («до последнего хода»), новое записывается вместе с ходом. */
    fun commitTurn(gameId: String, prev: GameState, next: GameState, rec: TurnRecord, now: Long = System.currentTimeMillis()): Int = db.tx {
        val n = (db.one("SELECT turn FROM game WHERE id=?", gameId) { it.int(0) } ?: throw IllegalStateException("игра не найдена")) + 1
        db.exec("INSERT OR REPLACE INTO save_slot(game_id,slot,label,state,turn,created_at) VALUES(?,0,'До последнего хода',?,?,?)", gameId, prev.toJson(), n - 1, now)
        db.exec("INSERT OR REPLACE INTO turn(game_id,n,action,narrative,events,kind,stats,created_at) VALUES(?,?,?,?,?,?,?,?)",
            gameId, n, rec.action, rec.narrative, json.encodeToString(ListSerializer(GameEvent.serializer()), rec.events), rec.kind, rec.stats, now)
        db.exec("UPDATE game SET state=?, turn=?, updated_at=? WHERE id=?", next.toJson(), n, now, gameId)
        n
    }

    fun turns(gameId: String, limit: Int = 200): List<TurnRecord> =
        db.query("SELECT n,action,narrative,events,kind,stats,created_at FROM (SELECT * FROM turn WHERE game_id=? ORDER BY n DESC LIMIT ?) ORDER BY n", gameId, limit) {
            TurnRecord(it.int(0), it.str(1), it.str(2), runCatching { json.decodeFromString(ListSerializer(GameEvent.serializer()), it.str(3)) }.getOrDefault(emptyList()), it.str(4), it.str(5), it.long(6))
        }

    fun saveSlot(gameId: String, slot: Int, label: String, now: Long = System.currentTimeMillis()) {
        require(slot in 1..3) { "слоты 1–3" }
        db.tx {
            val (state, turn) = db.one("SELECT state, turn FROM game WHERE id=?", gameId) { it.str(0) to it.int(1) } ?: throw IllegalStateException("игра не найдена")
            db.exec("INSERT OR REPLACE INTO save_slot(game_id,slot,label,state,turn,created_at) VALUES(?,?,?,?,?,?)", gameId, slot, label, state, turn, now)
        }
    }

    fun slots(gameId: String): List<SlotInfo> = db.query("SELECT slot,label,turn,created_at FROM save_slot WHERE game_id=? ORDER BY slot", gameId) { SlotInfo(it.int(0), it.str(1), it.int(2), it.long(3)) }

    /** Восстановление из слота: состояние и счётчик ходов откатываются, более поздние ходы удаляются. */
    fun restoreSlot(gameId: String, slot: Int, now: Long = System.currentTimeMillis()): GameState? = db.tx {
        val (state, turn) = db.one("SELECT state, turn FROM save_slot WHERE game_id=? AND slot=?", gameId, slot) { it.str(0) to it.int(1) } ?: return@tx null
        db.exec("DELETE FROM turn WHERE game_id=? AND n>?", gameId, turn)
        db.exec("UPDATE game SET state=?, turn=?, updated_at=? WHERE id=?", state, turn, now, gameId)
        if (slot == 0) db.exec("DELETE FROM save_slot WHERE game_id=? AND slot=0", gameId)
        GameState.fromJson(state)
    }

    /** «Переиграть ход»: вернуться к состоянию до последнего хода. */
    fun undoLastTurn(gameId: String): GameState? = restoreSlot(gameId, 0)

    /** Резервная копия ZIP: сохранения всегда, тексты книг — только по явной просьбе. */
    fun exportBackup(out: OutputStream, books: BookRepository, includeBooks: Boolean, now: Long = System.currentTimeMillis()) {
        val bookTitles = books.books().associate { it.id to it.title }
        val games = db.query("SELECT id,book_id,title,state,turn,updated_at FROM game ORDER BY updated_at") { r ->
            val id = r.str(0)
            BackupGame(id, r.str(1), bookTitles[r.str(1)].orEmpty(), r.str(2), r.str(3), r.int(4), r.long(5), emptyList(), emptyList())
        }.map { g ->
            g.copy(turns = turns(g.id, 100000), slots = db.query("SELECT slot,label,state,turn,created_at FROM save_slot WHERE game_id=?", g.id) { BackupSlot(it.int(0), it.str(1), it.str(2), it.int(3), it.long(4)) })
        }
        val bookList = if (!includeBooks) emptyList() else books.books().map { b -> BackupBook(b.id, b.title, b.author, b.format, books.chapters(b.id).map { BackupChapter(it.title, it.text) }) }
        ZipOutputStream(out).use { z ->
            z.putNextEntry(ZipEntry("manifest.json")); z.write(json.encodeToString(BackupManifest.serializer(), BackupManifest(createdAt = now, games = games.size, books = bookList.size)).toByteArray()); z.closeEntry()
            z.putNextEntry(ZipEntry("games.json")); z.write(json.encodeToString(ListSerializer(BackupGame.serializer()), games).toByteArray()); z.closeEntry()
            if (includeBooks) { z.putNextEntry(ZipEntry("books.json")); z.write(json.encodeToString(ListSerializer(BackupBook.serializer()), bookList).toByteArray()); z.closeEntry() }
        }
    }

    /**
     * Восстановление из копии. Игры привязываются к книге по идентификатору или по названию;
     * если книги нет ни в библиотеке, ни в копии — такая игра пропускается. Возвращает (восстановлено, пропущено).
     */
    fun importBackup(input: InputStream, books: BookRepository): Pair<Int, Int> {
        var gamesJson: String? = null; var booksJson: String? = null; var manifest: String? = null
        try {
            ZipInputStream(input).use { z ->
                while (true) {
                    val e = z.nextEntry ?: break
                    when (e.name) { "manifest.json" -> manifest = String(z.readBytes()); "games.json" -> gamesJson = String(z.readBytes()); "books.json" -> booksJson = String(z.readBytes()) }
                }
            }
        } catch (e: Exception) { throw BackupException("Файл резервной копии повреждён.") }
        if (manifest == null || gamesJson == null) throw BackupException("Это не резервная копия «Живой книги».")
        val man = runCatching { json.decodeFromString(BackupManifest.serializer(), manifest!!) }.getOrNull()
        if (man == null || man.app != "zhivaya-kniga") throw BackupException("Это не резервная копия «Живой книги».")
        if (man.version > 1) throw BackupException("Копия создана более новой версией приложения.")
        val games = runCatching { json.decodeFromString(ListSerializer(BackupGame.serializer()), gamesJson!!) }.getOrElse { throw BackupException("Файл резервной копии повреждён.") }
        val idMap = HashMap<String, String>()
        val existing = books.books()
        booksJson?.let { bj ->
            for (b in runCatching { json.decodeFromString(ListSerializer(BackupBook.serializer()), bj) }.getOrDefault(emptyList())) {
                val have = existing.firstOrNull { it.id == b.id } ?: existing.firstOrNull { it.title == b.title }
                idMap[b.id] = have?.id ?: books.addBook(ImportedBook(b.title, b.author, b.format, b.chapters.map { Chapter(it.title, it.text) })).also { books.indexBook(it) }
            }
        }
        var ok = 0; var skipped = 0
        val now = books.books()
        for (g in games) {
            val bookId = idMap[g.bookId] ?: now.firstOrNull { it.id == g.bookId }?.id ?: now.firstOrNull { it.title == g.bookTitle && g.bookTitle.isNotEmpty() }?.id
            if (bookId == null) { skipped++; continue }
            val state = runCatching { GameState.fromJson(g.state).copy(bookId = bookId) }.getOrNull()
            if (state == null) { skipped++; continue }
            db.tx {
                db.exec("DELETE FROM game WHERE id=?", g.id)
                db.exec("INSERT INTO game(id,book_id,title,state,turn,updated_at) VALUES(?,?,?,?,?,?)", g.id, bookId, g.title, state.toJson(), g.turn, g.updatedAt)
                for (t in g.turns) db.exec("INSERT INTO turn(game_id,n,action,narrative,events,kind,stats,created_at) VALUES(?,?,?,?,?,?,?,?)", g.id, t.n, t.action, t.narrative, json.encodeToString(ListSerializer(GameEvent.serializer()), t.events), t.kind, t.stats, t.createdAt)
                for (s in g.slots) db.exec("INSERT INTO save_slot(game_id,slot,label,state,turn,created_at) VALUES(?,?,?,?,?,?)", g.id, s.slot, s.label, runCatching { GameState.fromJson(s.state).copy(bookId = bookId).toJson() }.getOrDefault(s.state), s.turn, s.createdAt)
            }
            ok++
        }
        return ok to skipped
    }
}
