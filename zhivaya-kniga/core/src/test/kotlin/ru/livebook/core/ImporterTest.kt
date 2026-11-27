package ru.livebook.core

import org.apache.pdfbox.pdmodel.PDDocument
import org.apache.pdfbox.pdmodel.PDPage
import org.apache.pdfbox.pdmodel.PDPageContentStream
import org.apache.pdfbox.pdmodel.font.PDType0Font
import org.apache.pdfbox.text.PDFTextStripper
import ru.livebook.core.importer.BookImportException
import ru.livebook.core.importer.BookImporter
import ru.livebook.core.importer.PdfTextExtractor
import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.charset.Charset
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class ImporterTest {
    private fun fails(name: String, bytes: ByteArray, pdf: PdfTextExtractor? = null): String = assertFailsWith<BookImportException> { BookImporter.import(name, bytes, pdf = pdf) }.userMessage

    @Test fun txtUtf8() {
        val b = BookImporter.import("vorota_mha.txt", Fixtures.sampleBytes)
        assertEquals("ВОРОТА МХА", b.title)
        assertEquals(3, b.chapters.size)
        assertTrue(b.chapters[0].title.startsWith("ГЛАВА 1"))
        assertTrue(b.chapters[1].text.contains("Борин"))
        assertEquals("UTF-8", b.charset)
    }

    @Test fun txtWindows1251AndKoi8Autodetect() {
        for (cs in listOf("windows-1251", "KOI8-R", "IBM866")) {
            val b = BookImporter.import("book.txt", Fixtures.sampleText.toByteArray(Charset.forName(cs)))
            assertEquals(cs, b.charset, "кодировка $cs")
            assertTrue(b.chapters[0].text.contains("трактир «Лисья свеча»") || b.chapters[0].text.contains("трактир"), cs)
            assertTrue(b.chapters.any { it.text.contains("Арсений") }, cs)
        }
    }

    @Test fun txtManualCharsetOverride() {
        val bytes = Fixtures.sampleText.toByteArray(Charset.forName("windows-1251"))
        val b = BookImporter.import("book.txt", bytes, charsetOverride = "windows-1251")
        assertTrue(b.chapters.any { it.text.contains("Мира") })
    }

    @Test fun txtUtf8WithBomAndUtf16() {
        val bom = byteArrayOf(0xEF.toByte(), 0xBB.toByte(), 0xBF.toByte()) + Fixtures.sampleBytes
        assertEquals("ВОРОТА МХА", BookImporter.import("b.txt", bom).title)
        val u16 = byteArrayOf(0xFF.toByte(), 0xFE.toByte()) + Fixtures.sampleText.toByteArray(Charsets.UTF_16LE)
        assertEquals(3, BookImporter.import("b.txt", u16).chapters.size)
    }

    @Test fun rejectsBinaryEmptyAndUnsupported() {
        assertTrue(fails("x.txt", ByteArray(0)).contains("пуст"))
        val rnd = ByteArray(5000) { (it * 31 % 251).toByte() }
        fails("x.txt", rnd)
        assertTrue(fails("report.docx", Fixtures.zip("word/document.xml" to "<w:document/>")).contains("не поддерживается"))
        assertTrue(fails("photo.jpg", ByteArray(3000) { 7 }).contains("не поддерживается"))
        assertTrue(fails("tiny.txt", "Привет.".toByteArray()).contains("мало текста"))
    }

    @Test fun fb2Utf8AndWindows1251() {
        for (enc in listOf("utf-8", "windows-1251")) {
            val b = BookImporter.import("pesok.fb2", Fixtures.fb2(enc))
            assertEquals("Песок и ветер", b.title, enc)
            assertEquals("Анна Лесная", b.author, enc)
            assertEquals(2, b.chapters.size, enc)
            assertTrue(b.chapters[0].title.contains("Караван"), enc)
            assertTrue(b.chapters[1].text.contains("Лейла заметила"), enc)
            assertTrue(b.chapters.none { it.text.contains("Примечание") || it.text.contains("/9j/") }, enc)
        }
    }

    @Test fun fb2InsideZip() {
        val zipped = Fixtures.zip("pesok.fb2" to String(Fixtures.fb2(), Charsets.UTF_8))
        assertEquals(2, BookImporter.import("pesok.fb2.zip", zipped).chapters.size)
    }

    @Test fun fb2Corrupted() {
        val msg = fails("bad.fb2", "<?xml version=\"1.0\"?><FictionBook><body><section><p>Обрыв".toByteArray())
        assertTrue(msg.contains("FB2") || msg.contains("мало текста"), msg)
        // Обрезанный посередине файл: уцелевшие главы всё равно читаются.
        val whole = Fixtures.fb2()
        val cut = whole.copyOf(whole.size * 2 / 3)
        val b = BookImporter.import("cut.fb2", cut)
        assertTrue(b.chapters.isNotEmpty())
    }

    @Test fun epubValid() {
        val b = BookImporter.import("gorod.epub", Fixtures.epub())
        assertEquals("Город на воде", b.title)
        assertEquals("Пётр Речной", b.author)
        assertEquals(2, b.chapters.size)
        assertEquals("Глава 1. Причал", b.chapters[0].title)
        assertTrue(b.chapters[0].text.contains("Лодочник Савва"))
        assertTrue(!b.chapters[0].text.contains("color:red"))
    }

    @Test fun epubDrmAndCorrupted() {
        assertTrue(fails("drm.epub", Fixtures.epub(encrypted = true)).contains("DRM"))
        assertTrue(fails("bad.epub", ByteArray(4000) { (it % 200).toByte() }).contains("повреждён"))
        val half = Fixtures.epub().let { it.copyOf(it.size / 2) }
        fails("half.epub", half)
        assertTrue(fails("empty.epub", Fixtures.zip("mimetype" to "application/epub+zip")).contains("повреждён"))
    }

    /** В тестах текст PDF извлекает настольный PDFBox; в приложении тот же интерфейс реализован через pdfbox-android. */
    private val pdfBox = object : PdfTextExtractor {
        override fun extractPages(bytes: ByteArray): List<String> = PDDocument.load(bytes).use { doc ->
            if (doc.isEncrypted) throw BookImportException("PDF защищён паролем.")
            val st = PDFTextStripper()
            (1..doc.numberOfPages).map { p -> st.startPage = p; st.endPage = p; st.getText(doc) }
        }
    }

    private fun pdf(withText: Boolean): ByteArray {
        PDDocument().use { doc ->
            val font = PDType0Font.load(doc, File("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
            val paras = Fixtures.sampleText.split("\n").filter { it.isNotBlank() }
            for (chunk in paras.chunked(4)) {
                val page = PDPage(); doc.addPage(page)
                PDPageContentStream(doc, page).use { cs ->
                    if (withText) {
                        cs.beginText(); cs.setFont(font, 9f); cs.setLeading(11f); cs.newLineAtOffset(40f, 740f)
                        for (para in chunk) for (line in para.chunked(110)) { cs.showText(line); cs.newLine() }
                        cs.endText()
                    } else { cs.addRect(40f, 40f, 500f, 700f); cs.stroke() }
                }
            }
            val bos = ByteArrayOutputStream(); doc.save(bos); return bos.toByteArray()
        }
    }

    @Test fun pdfWithTextLayer() {
        val b = BookImporter.import("vorota.pdf", pdf(true), pdf = pdfBox)
        assertEquals("pdf", b.format)
        assertTrue(b.chapters.any { it.text.contains("Борин") })
        assertTrue(b.chars > 1500)
    }

    @Test fun pdfScanRejectedWithClearMessage() {
        val msg = fails("scan.pdf", pdf(false), pdfBox)
        assertTrue(msg.contains("скан") && msg.contains("текстового слоя"), msg)
        assertTrue(fails("x.pdf", pdf(true), null).contains("недоступно"))
        fails("broken.pdf", "%PDF-1.4 garbage".toByteArray() + ByteArray(600) { 1 }, pdfBox)
    }
}
