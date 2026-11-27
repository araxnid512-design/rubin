package ru.livebook.core

import ru.livebook.core.db.Db
import ru.livebook.core.game.GameOrchestrator
import ru.livebook.core.game.SaveRepository
import ru.livebook.core.importer.BookImporter
import ru.livebook.core.llm.GenParams
import ru.livebook.core.llm.GenResult
import ru.livebook.core.llm.GenStats
import ru.livebook.core.llm.LocalLlm
import ru.livebook.core.lore.BookRepository
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

object Fixtures {
    val sampleFile: File = listOf(File("../sample/vorota_mha.txt"), File("sample/vorota_mha.txt")).first { it.exists() }
    val sampleBytes: ByteArray get() = sampleFile.readBytes()
    val sampleText: String get() = String(sampleBytes, Charsets.UTF_8)

    fun zip(vararg entries: Pair<String, String>): ByteArray {
        val bos = ByteArrayOutputStream()
        ZipOutputStream(bos).use { z -> for ((n, c) in entries) { z.putNextEntry(ZipEntry(n)); z.write(c.toByteArray(Charsets.UTF_8)); z.closeEntry() } }
        return bos.toByteArray()
    }

    fun fb2(encoding: String = "utf-8"): ByteArray = """<?xml version="1.0" encoding="$encoding"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0" xmlns:l="http://www.w3.org/1999/xlink">
<description><title-info><genre>fantasy</genre><author><first-name>Анна</first-name><last-name>Лесная</last-name></author><book-title>Песок и ветер</book-title><lang>ru</lang></title-info></description>
<body><title><p>Песок и ветер</p></title>
<section><title><p>Глава первая. Караван</p></title><p>Караван шёл через пустыню Харад третий день. Проводник Тарик молчал и смотрел на звёзды.</p><p>Девочка Лейла несла медный компас, подарок отца. В городе Самар их ждал купец Юсуф.</p></section>
<section><title><p>Глава вторая. Колодец</p></title><p>У колодца Тарик остановил верблюдов. Лейла заметила, что вода пахнет железом, и Тарик запретил её пить.</p><p>Ночью к костру вышел незнакомец и спросил дорогу в Самар.</p></section>
</body>
<body name="notes"><section><p>Примечание, которое не должно попасть в текст.</p></section></body>
<binary id="cover.jpg" content-type="image/jpeg">/9j/4AAQSkZJRgABAQ==</binary>
</FictionBook>""".toByteArray(charset(encoding))

    fun epub(encrypted: Boolean = false): ByteArray {
        val entries = arrayListOf(
            "mimetype" to "application/epub+zip",
            "META-INF/container.xml" to """<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>""",
            "OEBPS/content.opf" to """<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Город на воде</dc:title><dc:creator>Пётр Речной</dc:creator></metadata>
<manifest><item id="c1" href="text/ch1.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="text/ch2.xhtml" media-type="application/xhtml+xml"/><item id="css" href="style.css" media-type="text/css"/></manifest><spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>""",
            "OEBPS/text/ch1.xhtml" to """<html xmlns="http://www.w3.org/1999/xhtml"><head><title>1</title><style>p{color:red}</style></head><body><h1>Глава 1. Причал</h1><p>Лодочник Савва каждое утро перевозил людей через канал в городе Велеград.</p><p>Его дочь Зоя мечтала стать картографом и рисовала карты на старых парусах.</p></body></html>""",
            "OEBPS/text/ch2.xhtml" to """<html xmlns="http://www.w3.org/1999/xhtml"><head><title>2</title></head><body><h2>Глава 2. Туман</h2><p>Когда на Велеград опустился туман, Савва не вышел на воду. Зоя нашла в лодке чужой фонарь и записку.</p></body></html>""",
            "OEBPS/style.css" to "p{margin:0}",
        )
        if (encrypted) entries += "META-INF/encryption.xml" to """<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:enc="http://www.w3.org/2001/04/xmlenc#"><enc:EncryptedData><enc:CipherData><enc:CipherReference URI="OEBPS/text/ch1.xhtml"/></enc:CipherData></enc:EncryptedData><enc:EncryptedData><enc:CipherData><enc:CipherReference URI="OEBPS/text/ch2.xhtml"/></enc:CipherData></enc:EncryptedData></encryption>"""
        return zip(*entries.toTypedArray())
    }
}

/** Подменная модель для проверки игровой логики без нейросети (в приложении не используется). */
class FakeLlm(private val replies: MutableList<String>) : LocalLlm {
    val prompts = ArrayList<String>()
    val grammars = ArrayList<String?>()
    var cancelNext = false
    private var counter = 0
    private val DEFAULTS = listOf("Ветер стихает, становится совсем тихо.", "Где-то скрипит половица, пахнет дымом.", "Огонь потрескивает, тени пляшут.", "Издалека доносится собачий лай.", "Дождь барабанит снаружи.", "Свеча мигает, воск капает.", "Половицы холодят ступни.", "Сквозняк шевелит занавеску.", "Вдалеке ухает сова.", "Пыль кружится в луче.", "Кошка спрыгивает с лавки.", "Туман липнет к ставням.")
    val warmed = ArrayList<String>()
    override val contextSize: Int = 2048
    override fun countTokens(text: String): Int = text.length / 3
    override fun generate(prompt: String, params: GenParams, onPiece: (String) -> Boolean): GenResult {
        prompts += prompt; grammars += params.grammar
        if (cancelNext) { cancelNext = false; return GenResult("", GenStats(stopReason = 2)) }
        if (params.maxTokens == 0) { warmed += prompt; prompts.removeAt(prompts.size - 1); grammars.removeAt(grammars.size - 1); return GenResult("", GenStats(stopReason = 1)) }
        val reply = if (replies.isEmpty()) DEFAULTS[(counter++) % DEFAULTS.size] else replies.removeAt(0)
        for (w in reply.chunked(7)) onPiece(w)
        return GenResult(reply, GenStats(100, 0, reply.length / 3, 50.0, 60.0, 500.0, 0))
    }
    override fun cancel() {}
    override fun setThreads(n: Int) {}
    override fun clearCache() {}
    override fun meta(key: String): String = ""
    override fun close() {}
}

class World(path: String = ":memory:", val replies: MutableList<String> = arrayListOf()) : AutoCloseable {
    val db = Db(path)
    val books = BookRepository(db)
    val saves = SaveRepository(db)
    val llm = FakeLlm(replies)
    var llmAvailable = true
    val game = GameOrchestrator(books, saves) { if (llmAvailable) llm else null }
    fun addSample(): String { val id = books.addBook(BookImporter.import("vorota_mha.txt", Fixtures.sampleBytes)); books.indexBook(id); return id }
    override fun close() = db.close()
}
