package ru.livebook.core

import ru.livebook.core.db.Db
import ru.livebook.core.game.Benchmarks
import ru.livebook.core.game.GameOrchestrator
import ru.livebook.core.game.LoreRefiner
import ru.livebook.core.game.SaveRepository
import ru.livebook.core.game.TurnListener
import ru.livebook.core.importer.BookImporter
import ru.livebook.core.llm.GameSettings
import ru.livebook.core.llm.GenParams
import ru.livebook.core.llm.LlamaLlm
import ru.livebook.core.lore.BookRepository
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Интеграционный тест с НАСТОЯЩЕЙ моделью Qwen3-0.6B через тот же JNI-мост, что и в приложении.
 * Запуск: LIVEBOOK_MODEL=/путь/к/модели.gguf LIVEBOOK_NATIVE_DIR=/каталог/с/liblivebook_llm.so ./gradlew :core:test
 * Без этих переменных тест пропускается.
 */
class RealLlmIT {
    private val modelPath: String? = System.getenv("LIVEBOOK_MODEL")?.takeIf { File(it).exists() && System.getenv("LIVEBOOK_NATIVE_DIR") != null }
    private fun rssPeakMb(): Double = runCatching { File("/proc/self/status").readLines().first { it.startsWith("VmHWM") }.filter { it.isDigit() }.toDouble() / 1024 }.getOrDefault(0.0)

    private val actions = listOf(
        "подхожу к Мире и спрашиваю, не видела ли она моего брата прошлой весной",
        "показываю Мире обрывок карты и прошу объяснить, что на нём написано",
        "заказываю похлёбку и плачу одну монету",
        "осматриваю камин и беру ржавый ключ из щели между камнями",
        "спрашиваю Миру, что она знает о старой башне и магической печати",
        "достаю меч и угрожаю гостям трактира",
        "благодарю Миру и обещаю ей найти пропавших людей",
        "выхожу из трактира и иду к северным воротам",
        "здороваюсь со стражем Борином и честно говорю, что ищу брата",
        "показываю найденный ключ страже",
        "спрашиваю Борина, почему он не подчиняется королю",
        "прошу Борина пропустить меня к башне",
        "осматриваю ворота и ищу следы брата",
        "сажусь у ворот и жду ночи, чтобы увидеть зелёный свет",
        "спрашиваю Борина, что это за свет над крепостью",
        "плачу Борину десять монет за проход",
        "иду к старой башне",
        "ищу вход в мастерскую под башней",
        "вспоминаю три правила големов и произношу их вслух",
        "ищу кристаллическую батарею среди обломков",
        "возвращаюсь в трактир «Лисья свеча»",
        "рассказываю Мире всё, что видел у ворот",
        "инвентарь",
        "прошу Миру дать мне фонарь для дороги",
        "отдаю Мире потёртый плащ в благодарность",
        "ложусь спать у очага и отдыхаю до утра",
        "утром спрашиваю Миру, кто ещё искал моего брата",
        "пытаюсь тайком залезть за стойку и украсть еду",
        "извиняюсь перед Мирой и предлагаю помочь по хозяйству",
        "выхожу во двор и осматриваю следы на дороге",
        "кричу в сторону леса имя брата",
        "статус",
        "иду обратно к северным воротам",
        "спрашиваю Борина о големах",
    )

    @Test fun fullGameWithRealModel() {
        val path = modelPath ?: return println("RealLlmIT пропущен: нет LIVEBOOK_MODEL / LIVEBOOK_NATIVE_DIR")
        val report = StringBuilder()
        val tLoad = System.nanoTime()
        val llm = LlamaLlm(path, 2048, 4)
        val loadMs = (System.nanoTime() - tLoad) / 1e6
        report.append("# Прогон с настоящей моделью (настольная машина, не телефон)\n\n")
        report.append("- Модель: ${llm.meta("general.name")} (${llm.meta("general.architecture")}), файл ${File(path).name}, ${File(path).length() / 1024 / 1024} МБ\n")
        report.append("- Процессор: ${File("/proc/cpuinfo").readLines().firstOrNull { it.startsWith("model name") }?.substringAfter(": ") ?: "?"}, потоков в тесте: 4\n")
        report.append("- llama.cpp: ${LlamaLlm.systemInfo().trim()}\n")
        report.append("- Загрузка модели: ${loadMs.toInt()} мс, контекст ${llm.contextSize}\n\n")

        val db = Db(":memory:")
        val books = BookRepository(db); val saves = SaveRepository(db)
        val game = GameOrchestrator(books, saves) { llm }
        val bookId = books.addBook(BookImporter.import("vorota_mha.txt", Fixtures.sampleBytes)); books.indexBook(bookId)

        // Замер скорости (то же, что показывает приложение при первом запуске).
        val bench = Benchmarks(db)
        report.append("## Замер скорости\n\n| Потоки | До первого токена | Токенов/с | 30 токенов | 60 токенов |\n|---|---|---|---|---|\n")
        for (th in listOf(2, 4)) { val b = bench.run(llm, th); bench.save(b, "host", rssPeakMb()); report.append("| $th | ${b.ttftMs.toInt()} мс | ${"%.1f".format(b.tokPerSec)} | ${b.t30Ms.toInt()} мс | ${b.t60Ms.toInt()} мс |\n") }
        llm.setThreads(4)
        assertEquals(2, bench.history().size)

        val gid = game.newGame(bookId, "Арсений", "странник", "canon", bookHero = true)
        report.append("\n## Игра по книге «Ворота мха» (режим «ближе к канону»)\n\n")
        var llmTurns = 0; var fallbacks = 0; var system = 0
        val narratives = ArrayList<String>()
        val totals = ArrayList<Double>(); val ttfts = ArrayList<Double>(); val speeds = ArrayList<Double>(); var reusedSum = 0; var promptSum = 0
        var streamedPieces = 0; var spokenSentences = 0
        val listener = object : TurnListener { override fun onText(visible: String) { streamedPieces++; assertTrue(!visible.contains("ИТОГ") && !visible.contains("<think"), "служебный текст в ленте: $visible") }; override fun onSentence(sentence: String) { spokenSentences++ } }
        val settings = GameSettings(seed = 1234)
        fun record(action: String, r: ru.livebook.core.game.TurnResult) {
            report.append("**> $action**\n\n")
            when (r.kind) {
                "llm" -> { llmTurns++; narratives += r.narrative; r.stats?.let { totals += it.totalMs; ttfts += it.ttftMs; speeds += it.tokensPerSecond; reusedSum += it.reusedTokens; promptSum += it.promptTokens } }
                "fallback" -> fallbacks++
                "system" -> system++
            }
            report.append(r.narrative.ifEmpty { "(${r.notice})" }).append("\n\n")
            val meta = ArrayList<String>()
            if (r.applied.isNotEmpty()) meta += "применено: " + r.applied.joinToString("; ") { it.describe() }
            if (r.rejected.isNotEmpty()) meta += "отклонено движком: " + r.rejected.joinToString("; ") { it.event.describe() + " — " + it.reason }
            if (r.notes.isNotEmpty()) meta += r.notes.joinToString(" ")
            if (r.suggestions.isNotEmpty() && r.kind == "llm") meta += "подсказки: " + r.suggestions.joinToString(" | ")
            r.stats?.let { meta += "[${r.kind}; до 1-го токена ${it.ttftMs.toInt()} мс; ${"%.1f".format(it.tokensPerSecond)} ток/с; всего ${it.totalMs.toInt()} мс; промпт ${it.promptTokens}, из кеша ${it.reusedTokens}; ответ ${it.genTokens} ток.]" }
            if (r.notice.isNotEmpty() && r.narrative.isNotEmpty()) meta += r.notice
            if (meta.isNotEmpty()) report.append("_").append(meta.joinToString(" · ")).append("_\n\n")
            // Инварианты мира после каждого хода.
            assertTrue(r.state.hero.gold >= 0 && r.state.hero.hp in 1..r.state.hero.maxHp)
            assertTrue(r.state.inventory.none { it.name.contains("меч") }, "меч не может появиться из воздуха: ${r.state.inventory}")
        }
        try {
            record("(вступление)", game.opening(gid, settings, listener))
            for (a in actions) record(a, game.turn(gid, a, settings, listener))
        } finally { File("build/reports").mkdirs(); File("build/reports/real-llm.md").writeText(report.toString()) }

        val state = saves.state(gid)!!
        val distinct = narratives.distinct().size
        report.append("## Итоги прогона\n\n")
        report.append("- Ходов всего: ${actions.size + 1}; ответов модели: $llmTurns; запасных фраз после двух негодных ответов: $fallbacks; мгновенных команд без модели: $system\n")
        report.append("- Разных текстов сцены: $distinct из $llmTurns\n")
        report.append("- Время хода (всего): среднее ${totals.average().toInt()} мс, медиана ${totals.sorted()[totals.size / 2].toInt()} мс, максимум ${totals.max().toInt()} мс\n")
        report.append("- До первого токена: среднее ${ttfts.average().toInt()} мс; скорость генерации: средняя ${"%.1f".format(speeds.average())} ток/с\n")
        report.append("- KV-кеш: из ${promptSum} токенов промпта переиспользовано ${reusedSum} (${reusedSum * 100 / promptSum.coerceAtLeast(1)}%)\n")
        report.append("- Потоковый вывод: $streamedPieces обновлений текста, $spokenSentences предложений отдано в очередь озвучки\n")
        report.append("- Пиковая память процесса теста (JVM + модель): ${rssPeakMb().toInt()} МБ\n")
        report.append("- Итоговое состояние: место «${state.location}», здоровье ${state.hero.hp}/${state.hero.maxHp}, монеты ${state.hero.gold}, вещи: ${state.inventory.joinToString { it.name }}; задания: ${state.quests.joinToString { it.title }}; отношения: ${state.characters.filter { it.relation != 0 }.joinToString { it.name + " " + it.relation }}\n")
        report.append("- Журнал: ${state.journal.joinToString(" | ")}\n\n")

        // Глубокий разбор карточек моделью.
        val refined = LoreRefiner(books) { llm }.refine(bookId, limit = 5)
        report.append("## Глубокий разбор (модель описывает сущности книги)\n\n")
        for (e in books.entities(bookId).filter { it.refined }) report.append("- ${e.name} (${e.kind}, источник: ${e.source}): ${e.descr}\n")
        report.append("\nОбработано карточек: $refined\n")

        // Без грамматики и без игры: модель действительно генерирует свободный русский текст.
        val free = llm.generate("<|im_start|>user\nНапиши одно предложение о тумане над рекой. /no_think<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n", GenParams(maxTokens = 40, seed = 5))
        report.append("\n## Свободная генерация без грамматики\n\n${free.text.trim()}\n")

        File("build/reports").mkdirs(); File("build/reports/real-llm.md").writeText(report.toString())
        println(report)
        llm.close(); db.close()

        assertTrue(llmTurns >= 28, "ответов модели: $llmTurns, запасных: $fallbacks")
        assertEquals(2, system)
        assertTrue(distinct >= llmTurns - 2, "ответы должны быть разными: $distinct из $llmTurns")
        assertTrue(narratives.all { n -> n.count { it in 'а'..'я' } > 10 })
        assertTrue(reusedSum > promptSum / 4, "KV-кеш должен переиспользоваться")
        assertTrue(spokenSentences >= llmTurns)
        assertTrue(free.text.count { it in 'а'..'я' } > 10)
        assertTrue(state.hasItem("ржавый ключ") || state.journal.none { it.contains("Получено: ржавый ключ") })
    }
}
