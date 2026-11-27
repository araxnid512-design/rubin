package ru.livebook.app

import android.net.Uri
import android.util.Log
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.lifecycle.ViewModelProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.pdmodel.PDPage
import com.tom_roush.pdfbox.pdmodel.PDPageContentStream
import com.tom_roush.pdfbox.pdmodel.font.PDType0Font
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.FixMethodOrder
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.MethodSorters
import ru.livebook.core.importer.BookImportException
import ru.livebook.core.importer.BookImporter
import ru.livebook.core.llm.GenParams
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileInputStream

/**
 * Проверка на настоящем Android (устройство или эмулятор): запуск интерфейса, база с FTS5, импорт TXT и PDF,
 * системные команды игры, экран настроек, статус офлайн-голоса и — если модель лежит в /data/local/tmp/model.gguf —
 * установка модели из файла и реальная генерация через JNI.
 */
@RunWith(AndroidJUnit4::class)
@FixMethodOrder(MethodSorters.NAME_ASCENDING)
class DeviceSmokeTest {
    @get:Rule val rule = createAndroidComposeRule<MainActivity>()
    private val app get() = rule.activity.application as LiveBookApp
    private val vm get() = ViewModelProvider(rule.activity)[MainViewModel::class.java]
    private fun sample(): ByteArray = InstrumentationRegistry.getInstrumentation().context.assets.open("vorota_mha.txt").use { it.readBytes() }
    private fun waitText(text: String, ms: Long = 60_000) = rule.waitUntil(ms) { rule.onAllNodesWithText(text, substring = true, ignoreCase = true).fetchSemanticsNodes().isNotEmpty() }
    private fun log(s: String) { Log.i("LiveBookTest", s); println("LiveBookTest: $s") }

    @Test fun t1_libraryScreenStarts() {
        rule.onNodeWithText("Живая книга").assertIsDisplayed()
        rule.onNodeWithText("Добавить книгу").assertExists()
        rule.onNodeWithText("Настройки").assertIsDisplayed()
        // Манифест без сетевых разрешений.
        val pi = rule.activity.packageManager.getPackageInfo(rule.activity.packageName, android.content.pm.PackageManager.GET_PERMISSIONS)
        val perms = pi.requestedPermissions?.toList() ?: emptyList()
        log("permissions=$perms")
        assertTrue(perms.none { it.contains("INTERNET") || it.contains("NETWORK") })
    }

    @Test fun t2_importBookPlaySystemCommandsAndSheets() {
        val c = app.container
        c.books.books().forEach { c.books.deleteBook(it.id) }
        val t0 = System.currentTimeMillis()
        val id = c.books.addBook(BookImporter.import("vorota_mha.txt", sample()))
        assertTrue(c.books.indexBook(id))
        log("import+index ms=${System.currentTimeMillis() - t0}")
        val persons = c.books.entities(id, "person").map { it.name }
        log("persons=$persons places=${c.books.entities(id, "place").map { it.name }}")
        assertTrue(persons.containsAll(listOf("Мира", "Арсений", "Борин")))
        assertTrue(c.books.search(id, "ключ страж ворота", 2).isNotEmpty())   // FTS5 на устройстве

        vm.refreshLibrary()
        waitText("ВОРОТА МХА")
        rule.onNodeWithText("ВОРОТА МХА").performClick()
        waitText("Новое приключение")
        rule.onNodeWithText("Начать приключение").performScrollTo().assertExists()
        rule.onNodeWithText("Свободная история").performScrollTo().performClick()

        val gid = c.game.newGame(id, "Арсений", "странник", "canon", true)
        vm.openGame(gid)
        waitText("Что ты делаешь?")
        rule.onNodeWithText("Что ты делаешь?").performTextInput("инвентарь")
        rule.onNodeWithText("Отправить").performClick()
        waitText("потёртый плащ")
        rule.onNodeWithText("Лист героя").performClick()
        waitText("Сохранения")
        for (tab in listOf("Инвентарь", "Журнал", "Персонажи", "Книга")) { rule.onAllNodesWithText(tab)[0].performClick(); rule.waitForIdle() }
        waitText("Факты книги")
        rule.onNodeWithText("Закрыть").performClick()
        waitText("Что ты делаешь?")
        log("t2 ui flow ok")
        // Сохранение в слот и состояние в базе.
        c.saves.saveSlot(gid, 1, "тест")
        assertEquals(1, c.saves.slots(gid).count { it.slot == 1 })
        assertTrue(c.saves.state(gid)!!.hasItem("плащ"))
    }

    @Test fun t3_settingsScreenAndVoiceStatus() {
        vm.go(Screen.SETTINGS)
        waitText("Голос рассказчика")
        rule.onNodeWithText("Резервная копия", ignoreCase = true).performScrollTo().assertExists()
        rule.onNodeWithText("О приложении", ignoreCase = true).performScrollTo().assertExists()
        rule.waitUntil(30_000) { vm.voice.value.status != "init" }
        val v = vm.voice.value
        log("tts status=${v.status} engine='${v.engine}' offlineRuVoices=${v.voices.size}")
        assertTrue(v.status in setOf("ready", "no_voice", "no_engine"))
        if (v.status != "ready") { vm.go(Screen.LIBRARY); waitText("Озвучка пока недоступна") }   // честное сообщение вместо молчания
    }

    @Test fun t4_pdfTextLayerAndScanOnDevice() {
        val c = app.container
        com.tom_roush.pdfbox.android.PDFBoxResourceLoader.init(rule.activity.applicationContext)
        fun pdf(withText: Boolean): ByteArray = PDDocument().use { doc ->
            val font = PDType0Font.load(doc, FileInputStream(File("/system/fonts/Roboto-Regular.ttf")))
            val lines = String(sample(), Charsets.UTF_8).split("\n").filter { it.isNotBlank() }.flatMap { it.chunked(90) }
            for (chunk in lines.chunked(40)) {
                val page = PDPage(); doc.addPage(page)
                PDPageContentStream(doc, page).use { cs ->
                    if (withText) { cs.beginText(); cs.setFont(font, 10f); cs.setLeading(13f); cs.newLineAtOffset(40f, 760f); chunk.forEach { cs.showText(it); cs.newLine() }; cs.endText() }
                    else { cs.addRect(50f, 50f, 400f, 600f); cs.stroke() }
                }
            }
            ByteArrayOutputStream().also { doc.save(it) }.toByteArray()
        }
        val book = BookImporter.import("vorota.pdf", pdf(true), pdf = c.pdf)
        log("pdf chars=${book.chars} chapters=${book.chapters.size}")
        assertTrue(book.chapters.any { it.text.contains("Борин") })
        val err = try { BookImporter.import("scan.pdf", pdf(false), pdf = c.pdf); "" } catch (e: BookImportException) { e.userMessage }
        assertTrue(err, err.contains("скан"))
    }

    @Test fun t5_installModelFromFileAndGenerate() {
        val src = File("/data/local/tmp/model.gguf")
        if (!src.exists()) { log("llm: пропущено — нет /data/local/tmp/model.gguf"); return }
        val c = app.container
        val t0 = System.currentTimeMillis()
        val (info, sha) = c.llm.install(Uri.fromFile(src)) { _, _ -> }
        log("model install ms=${System.currentTimeMillis() - t0} arch=${info.architecture} quant=${info.quant} sha=$sha")
        assertEquals("qwen3", info.architecture)
        val llm = c.llm.get()
        assertNotNull("модель не загрузилась: ${c.llm.lastError}", llm)
        val r = llm!!.generate("<|im_start|>user\nСкажи: привет /no_think<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n", GenParams(maxTokens = 8, seed = 3))
        log("llm text='${r.text}' promptTokens=${r.stats.promptTokens} ttftMs=${r.stats.ttftMs.toInt()} tokS=${"%.2f".format(r.stats.tokensPerSecond)} ramMb=${vm.memoryMb().toInt()}")
        assertTrue(r.text.isNotBlank())
        assertTrue(r.stats.genTokens > 0)
        // Негодный файл отклоняется до запуска.
        val bad = File(rule.activity.cacheDir, "bad.gguf").apply { writeBytes(ByteArray(4096) { 1 }) }
        val msg = try { c.llm.install(Uri.fromFile(bad)) { _, _ -> }; "" } catch (e: Exception) { e.message.orEmpty() }
        assertTrue(msg, msg.contains("не файл модели"))
        assertTrue(c.llm.installed())
    }

    @Test fun t25_gamebookScreen() {
        val c = app.container
        val id = c.books.books().firstOrNull()?.id ?: c.books.addBook(BookImporter.import("vorota_mha.txt", sample())).also { c.books.indexBook(it) }
        val gid = c.game.newGame(id, "Арсений", "странник", "canon", true, gamebook = true)
        val s = c.saves.state(gid)!!
        log("gamebook hero skill=${s.gamebook!!.skill} stamina=${s.hero.hp} luck=${s.gamebook!!.luck} goal=${s.quests.firstOrNull()?.title} locked=${s.lockedLocations} places=${s.knownLocations}")
        assertTrue(s.gamebook!!.skill in 7..12 && s.hero.hp in 14..24 && s.gamebook!!.luck in 7..12)
        vm.openGame(gid)
        waitText("Ловкость")                       // шапка с листом персонажа
        rule.onNodeWithText("Начать").assertExists() // без модели первый параграф не пишется, но экран готов
        rule.onNodeWithText("Лист героя").performClick()
        waitText("Проверка удачи")                 // правила на листе героя
        rule.onNodeWithText("Закрыть").performClick()
        waitText("Начать")
        log("gamebook screen ok")
    }

    @Test fun t6_builtinVoiceFromFile() {
        val src = File("/data/local/tmp/voice.zip")
        if (!src.exists()) { log("voice: пропущено — нет /data/local/tmp/voice.zip"); return }
        val n = vm.narrator
        val t0 = System.currentTimeMillis()
        val name = n.builtin.install(Uri.fromFile(src))
        log("voice install ms=${System.currentTimeMillis() - t0} name=$name installed=${n.builtin.installed()}")
        assertTrue(n.builtin.installed())
        val (samples, rate) = n.builtin.synthesize("Вечер опускается на долину.", 0.95f)
        log("voice synth samples=$samples rate=$rate seconds=${"%.2f".format(samples.toDouble() / rate.coerceAtLeast(1))} synthMs=${n.builtin.lastSynthMs} err='${n.builtin.lastError}'")
        assertTrue("синтез не дал звука: ${n.builtin.lastError}", samples > rate / 2)
        n.preferBuiltin = true; n.publish()
        assertEquals("ready", vm.voice.value.status); assertTrue(vm.voice.value.builtinActive)
        // Негодный архив отклоняется, установленный голос остаётся.
        val bad = File(rule.activity.cacheDir, "bad.zip").apply { writeBytes(ByteArray(2048) { 5 }) }
        val msg = try { n.builtin.install(Uri.fromFile(bad)); "" } catch (e: Exception) { e.message.orEmpty() }
        assertTrue(msg, msg.isNotEmpty()); assertTrue(n.builtin.installed())
    }
}
