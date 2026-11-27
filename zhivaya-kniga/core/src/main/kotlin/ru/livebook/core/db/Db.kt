package ru.livebook.core.db

import androidx.sqlite.SQLiteConnection
import androidx.sqlite.SQLiteStatement
import androidx.sqlite.driver.bundled.BundledSQLiteDriver
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

/**
 * Локальная база SQLite (встроенная сборка с FTS5, одинаковая на Android и в настольных тестах).
 * Одно соединение под блокировкой: простые и предсказуемые транзакции.
 */
class Db(path: String) : AutoCloseable {
    private val conn: SQLiteConnection = BundledSQLiteDriver().open(path)
    private val lock = ReentrantLock()

    init {
        exec("PRAGMA journal_mode=WAL")
        exec("PRAGMA synchronous=NORMAL")
        exec("PRAGMA foreign_keys=ON")
        migrate()
    }

    class Row(private val st: SQLiteStatement) {
        fun str(i: Int): String = if (st.isNull(i)) "" else st.getText(i)
        fun long(i: Int): Long = if (st.isNull(i)) 0 else st.getLong(i)
        fun int(i: Int): Int = long(i).toInt()
        fun double(i: Int): Double = if (st.isNull(i)) 0.0 else st.getDouble(i)
    }

    private fun bind(st: SQLiteStatement, args: Array<out Any?>) {
        args.forEachIndexed { idx, a ->
            val i = idx + 1
            when (a) {
                null -> st.bindNull(i)
                is String -> st.bindText(i, a)
                is Int -> st.bindLong(i, a.toLong())
                is Long -> st.bindLong(i, a)
                is Double -> st.bindDouble(i, a)
                is Boolean -> st.bindLong(i, if (a) 1 else 0)
                else -> st.bindText(i, a.toString())
            }
        }
    }

    fun exec(sql: String, vararg args: Any?) = lock.withLock {
        val st = conn.prepare(sql)
        try { bind(st, args); while (st.step()) { /* drain */ } } finally { st.close() }
    }

    fun <T> query(sql: String, vararg args: Any?, map: (Row) -> T): List<T> = lock.withLock {
        val st = conn.prepare(sql)
        try {
            bind(st, args)
            val row = Row(st)
            val out = ArrayList<T>()
            while (st.step()) out += map(row)
            out
        } finally { st.close() }
    }

    fun <T> one(sql: String, vararg args: Any?, map: (Row) -> T): T? = query(sql, *args, map = map).firstOrNull()
    fun lastInsertId(): Long = one("SELECT last_insert_rowid()") { it.long(0) } ?: 0

    /** Всё или ничего: при исключении изменения откатываются, сохранение не портится. */
    fun <T> tx(block: () -> T): T = lock.withLock {
        if (inTx) return block()
        exec("BEGIN IMMEDIATE")
        inTx = true
        try {
            val r = block()
            exec("COMMIT")
            r
        } catch (t: Throwable) {
            runCatching { exec("ROLLBACK") }
            throw t
        } finally { inTx = false }
    }
    private var inTx = false

    private fun migrate() {
        var v = one("PRAGMA user_version") { it.int(0) } ?: 0
        while (v < MIGRATIONS.size) {
            tx { MIGRATIONS[v].forEach { exec(it) } }
            v++
            exec("PRAGMA user_version=$v")
        }
    }

    override fun close() = lock.withLock { conn.close() }

    companion object {
        const val SCHEMA_VERSION = 2
        private val MIGRATIONS: List<List<String>> = listOf(
            listOf(
                """CREATE TABLE book(id TEXT PRIMARY KEY, title TEXT NOT NULL, author TEXT NOT NULL DEFAULT '', format TEXT NOT NULL,
                    added_at INTEGER NOT NULL, chars INTEGER NOT NULL DEFAULT 0, chapters INTEGER NOT NULL DEFAULT 0,
                    indexed_chapters INTEGER NOT NULL DEFAULT 0, entities_done INTEGER NOT NULL DEFAULT 0, deep_done INTEGER NOT NULL DEFAULT 0)""",
                "CREATE TABLE chapter(book_id TEXT NOT NULL REFERENCES book(id) ON DELETE CASCADE, idx INTEGER NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, indexed INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(book_id, idx))",
                "CREATE TABLE chunk(id INTEGER PRIMARY KEY AUTOINCREMENT, book_id TEXT NOT NULL REFERENCES book(id) ON DELETE CASCADE, chapter_idx INTEGER NOT NULL, pos INTEGER NOT NULL, body TEXT NOT NULL)",
                "CREATE INDEX chunk_book ON chunk(book_id, chapter_idx, pos)",
                "CREATE VIRTUAL TABLE chunk_fts USING fts5(norm, tokenize='unicode61')",
                """CREATE TABLE entity(id INTEGER PRIMARY KEY AUTOINCREMENT, book_id TEXT NOT NULL REFERENCES book(id) ON DELETE CASCADE, kind TEXT NOT NULL,
                    name TEXT NOT NULL, stem TEXT NOT NULL, freq INTEGER NOT NULL DEFAULT 0, descr TEXT NOT NULL DEFAULT '', first_chapter INTEGER NOT NULL DEFAULT 0,
                    source TEXT NOT NULL DEFAULT 'rules', refined INTEGER NOT NULL DEFAULT 0)""",
                "CREATE INDEX entity_book ON entity(book_id, kind, freq DESC)",
                "CREATE TABLE game(id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES book(id) ON DELETE CASCADE, title TEXT NOT NULL, state TEXT NOT NULL, turn INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL)",
                "CREATE TABLE turn(game_id TEXT NOT NULL REFERENCES game(id) ON DELETE CASCADE, n INTEGER NOT NULL, action TEXT NOT NULL, narrative TEXT NOT NULL, events TEXT NOT NULL DEFAULT '[]', kind TEXT NOT NULL, stats TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, PRIMARY KEY(game_id, n))",
                "CREATE TABLE save_slot(game_id TEXT NOT NULL REFERENCES game(id) ON DELETE CASCADE, slot INTEGER NOT NULL, label TEXT NOT NULL, state TEXT NOT NULL, turn INTEGER NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(game_id, slot))",
                "CREATE TABLE bench(id INTEGER PRIMARY KEY AUTOINCREMENT, created_at INTEGER NOT NULL, device TEXT NOT NULL, threads INTEGER NOT NULL, ttft_ms REAL NOT NULL, tok_s REAL NOT NULL, t30_ms REAL NOT NULL, t60_ms REAL NOT NULL, ram_mb REAL NOT NULL, note TEXT NOT NULL DEFAULT '')",
            ),
            // Версия 2: готовые страницы квеста. Один и тот же поворот событий всегда ведёт на одну и ту же страницу.
            listOf(
                "CREATE TABLE quest_page(book_id TEXT NOT NULL REFERENCES book(id) ON DELETE CASCADE, key TEXT NOT NULL, num INTEGER NOT NULL, body TEXT NOT NULL, PRIMARY KEY(book_id, key))",
            ),
        )
    }
}