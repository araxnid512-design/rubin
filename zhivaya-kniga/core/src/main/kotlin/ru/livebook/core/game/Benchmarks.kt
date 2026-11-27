package ru.livebook.core.game

import ru.livebook.core.db.Db
import ru.livebook.core.llm.GameSettings
import ru.livebook.core.llm.GenParams
import ru.livebook.core.llm.LocalLlm
import ru.livebook.core.llm.PromptBuilder
import ru.livebook.core.lore.BookRepository
import ru.livebook.core.lore.Entity
import ru.livebook.core.model.Text

data class BenchResult(val threads: Int, val ttftMs: Double, val tokPerSec: Double, val t30Ms: Double, val t60Ms: Double, val promptTokens: Int, val ramMb: Double = 0.0, val createdAt: Long = 0, val device: String = "", val note: String = "") {
    /** Оценка времени короткого хода: обработка ~350 новых токенов промпта + ~80 токенов ответа. */
    fun estimateTurnSeconds(): Double = if (tokPerSec <= 0 || promptTokens <= 0) 0.0 else (ttftMs / promptTokens * 350 + 80 * 1000.0 / tokPerSec) / 1000.0
}

/** Реальный замер скорости на этом устройстве. Ничего не оценивает «на глаз» — только измеренные значения. */
class Benchmarks(private val db: Db) {
    fun run(llm: LocalLlm, threads: Int): BenchResult {
        llm.setThreads(threads)
        llm.clearCache()
        val prompt = PromptBuilder.system(GameSettings(), "canon") +
            "<|im_start|>user\nМесто: постоялый двор. Рядом: хозяин. Герой: Путник; здоровье 10 из 10, монеты 3, вещей нет.\nДействие героя: сажусь у очага и прошу рассказать о дороге на север<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n"
        val t0 = System.nanoTime()
        var t30 = 0.0
        var n = 0
        val r = llm.generate(prompt, GenParams(maxTokens = 60, seed = 7)) { n++; if (n == 30) t30 = (System.nanoTime() - t0) / 1e6; true }
        val total = (System.nanoTime() - t0) / 1e6
        llm.clearCache()
        return BenchResult(threads, r.stats.ttftMs, r.stats.tokensPerSecond, if (t30 > 0) t30 else total, total, r.stats.promptTokens)
    }

    fun save(r: BenchResult, device: String, ramMb: Double, note: String = "", now: Long = System.currentTimeMillis()) =
        db.exec("INSERT INTO bench(created_at,device,threads,ttft_ms,tok_s,t30_ms,t60_ms,ram_mb,note) VALUES(?,?,?,?,?,?,?,?,?)", now, device, r.threads, r.ttftMs, r.tokPerSec, r.t30Ms, r.t60Ms, ramMb, note + "|pt=" + r.promptTokens)

    fun history(limit: Int = 20): List<BenchResult> = db.query("SELECT threads,ttft_ms,tok_s,t30_ms,t60_ms,ram_mb,created_at,device,note FROM bench ORDER BY id DESC LIMIT ?", limit) {
        BenchResult(it.int(0), it.double(1), it.double(2), it.double(3), it.double(4), it.str(8).substringAfter("|pt=", "0").toIntOrNull() ?: 0, it.double(5), it.long(6), it.str(7), it.str(8).substringBefore("|pt="))
    }
}

/**
 * «Глубокий разбор»: локальная модель своими словами описывает уже найденные сущности по фрагментам книги.
 * Работает по одной карточке, результат сразу сохраняется — можно отменить и продолжить позже.
 */
class LoreRefiner(private val books: BookRepository, private val llm: () -> LocalLlm?) {
    fun pending(bookId: String, limit: Int = 24): List<Entity> = books.entities(bookId).filter { !it.refined && it.kind in setOf("person", "place", "faction") }.sortedByDescending { it.freq }.take(limit)

    fun refine(bookId: String, limit: Int = 24, isCancelled: () -> Boolean = { false }, onProgress: (Int, Int) -> Unit = { _, _ -> }): Int {
        val model = llm() ?: return 0
        val todo = pending(bookId, limit)
        var done = 0
        for (e in todo) {
            if (isCancelled()) break
            val ctx = books.search(bookId, e.name, 2).joinToString(" ") { it.text }.take(700).replace(Regex("<\\|[^|>]*\\|>"), " ")
            val prompt = "<|im_start|>system\nТы помогаешь разобрать книгу. По фрагменту ответь одной короткой фразой, кто или что это. Не выдумывай того, чего нет во фрагменте. /no_think<|im_end|>\n" +
                "<|im_start|>user\nФрагмент: За стойкой стоял Гордей, старый кузнец, который чинил оружие всей округе.\nКто или что такое «Гордей»?<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\nПерсонаж: старый кузнец, чинит оружие всей округе.<|im_end|>\n" +
                "<|im_start|>user\nФрагмент: $ctx\nКто или что такое «${e.name}»?<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n"
            val grammar = "root ::= (\"Персонаж\" | \"Место\" | \"Группа\") \": \" [а-яё] [а-яёА-ЯЁ ,«»-]+ \".\"\n"
            val r = runCatching { model.generate(prompt, GenParams(maxTokens = 40, temp = 0.3f, seed = 11, grammar = grammar)) }.getOrNull() ?: break
            if (r.stats.stopReason == 2) break
            val text = r.text.trim()
            val kind = when { text.startsWith("Место") -> "place"; text.startsWith("Группа") -> "faction"; else -> "person" }
            val descr = text.substringAfter(": ", "").trim()
            // Тип меняем только если правила не были уверены; описание принимаем, если оно опирается на слова фрагмента.
            val grounded = Text.stems(descr).filter { it.length >= 4 }.let { ws -> ws.isNotEmpty() && ws.count { it in Text.stems(ctx).toSet() } * 2 >= ws.size }
            if (descr.length >= 8 && grounded) books.refineEntity(e.id, if (e.freq <= 2) kind else e.kind, descr.replaceFirstChar { it.uppercase() })
            else books.refineEntity(e.id, e.kind, e.descr)
            done++
            onProgress(done, todo.size)
        }
        return done
    }
}
