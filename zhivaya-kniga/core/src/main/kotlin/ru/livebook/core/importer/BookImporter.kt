package ru.livebook.core.importer

import org.jsoup.Jsoup
import org.jsoup.nodes.Element
import org.jsoup.parser.Parser
import org.xml.sax.Attributes
import org.xml.sax.InputSource
import org.xml.sax.helpers.DefaultHandler
import java.io.ByteArrayInputStream
import java.nio.ByteBuffer
import java.nio.charset.Charset
import java.nio.charset.CodingErrorAction
import java.util.zip.ZipInputStream
import javax.xml.parsers.SAXParserFactory

data class Chapter(val title: String, val text: String)
data class ImportedBook(val title: String, val author: String, val format: String, val chapters: List<Chapter>, val charset: String = "") {
    val chars: Int get() = chapters.sumOf { it.text.length }
}

/** Ошибка импорта с понятным пользователю русским текстом. */
class BookImportException(val userMessage: String, cause: Throwable? = null) : Exception(userMessage, cause)

/** Извлечение текста из PDF реализуется платформой (на Android — pdfbox-android). */
interface PdfTextExtractor {
    /** Текст по страницам. Для защищённых файлов бросает [BookImportException]. */
    fun extractPages(bytes: ByteArray): List<String>
}

object BookImporter {
    const val MAX_BYTES = 80 * 1024 * 1024
    val CHARSETS = listOf("UTF-8", "windows-1251", "KOI8-R", "IBM866", "UTF-16LE", "UTF-16BE")

    fun import(fileName: String, bytes: ByteArray, charsetOverride: String? = null, pdf: PdfTextExtractor? = null): ImportedBook {
        if (bytes.isEmpty()) throw BookImportException("Файл пустой.")
        if (bytes.size > MAX_BYTES) throw BookImportException("Файл слишком большой (больше 80 МБ).")
        val lower = fileName.lowercase()
        val isZip = bytes.size > 4 && bytes[0] == 'P'.code.toByte() && bytes[1] == 'K'.code.toByte()
        val isPdf = startsWith(bytes, "%PDF")
        val book = try {
            when {
                isPdf || lower.endsWith(".pdf") -> importPdf(fileName, bytes, pdf)
                isZip && lower.endsWith(".fb2.zip") || isZip && lower.endsWith(".fbz") -> importFb2Zip(fileName, bytes)
                isZip && (lower.endsWith(".epub") || zipHas(bytes, "META-INF/container.xml")) -> EpubImporter.import(fileName, bytes)
                isZip && lower.endsWith(".zip") -> importFb2Zip(fileName, bytes)
                isZip -> throw BookImportException("Этот тип архива не поддерживается. Подойдут TXT, FB2, EPUB и PDF с текстом.")
                lower.endsWith(".fb2") || looksLikeFb2(bytes) -> Fb2Importer.import(fileName, bytes)
                lower.endsWith(".epub") -> throw BookImportException("Файл EPUB повреждён: это не ZIP-архив.")
                lower.endsWith(".txt") || lower.endsWith(".text") || lower.endsWith(".md") || !lower.contains('.') -> TxtImporter.import(fileName, bytes, charsetOverride)
                UNSUPPORTED.any { lower.endsWith(it) } -> throw BookImportException("Формат «${lower.substringAfterLast('.')}» не поддерживается. Подойдут TXT, FB2, EPUB и PDF с текстом.")
                else -> TxtImporter.import(fileName, bytes, charsetOverride)
            }
        } catch (e: BookImportException) {
            throw e
        } catch (e: OutOfMemoryError) {
            throw BookImportException("Не хватило памяти, чтобы прочитать книгу.")
        } catch (e: Exception) {
            throw BookImportException("Файл повреждён или имеет неизвестную структуру.", e)
        }
        val chapters = book.chapters.map { Chapter(it.title.trim().take(120), clean(it.text)) }.filter { it.text.length >= 20 }
        if (chapters.sumOf { it.text.length } < 150) throw BookImportException("В файле слишком мало текста, чтобы строить по нему историю.")
        return book.copy(title = book.title.trim().ifEmpty { baseName(fileName) }.take(160), author = book.author.trim().take(120), chapters = chapters)
    }

    private val UNSUPPORTED = listOf(".doc", ".docx", ".rtf", ".mobi", ".azw", ".azw3", ".djvu", ".jpg", ".jpeg", ".png", ".mp3", ".apk", ".exe", ".odt", ".html", ".htm")

    fun baseName(fileName: String): String = fileName.substringAfterLast('/').substringBeforeLast('.').replace('_', ' ').trim().ifEmpty { "Без названия" }
    private fun startsWith(b: ByteArray, s: String) = b.size >= s.length && s.indices.all { b[it] == s[it].code.toByte() }
    private fun looksLikeFb2(b: ByteArray): Boolean = String(b, 0, minOf(b.size, 2000), Charsets.ISO_8859_1).contains("<FictionBook")

    private fun zipHas(bytes: ByteArray, name: String): Boolean = runCatching {
        ZipInputStream(ByteArrayInputStream(bytes)).use { z -> generateSequence { z.nextEntry }.any { it.name == name } }
    }.getOrDefault(false)

    private fun importFb2Zip(fileName: String, bytes: ByteArray): ImportedBook {
        ZipInputStream(ByteArrayInputStream(bytes)).use { z ->
            while (true) {
                val e = z.nextEntry ?: break
                if (e.name.lowercase().endsWith(".fb2")) return Fb2Importer.import(e.name, z.readBytes())
            }
        }
        throw BookImportException("В архиве нет книги FB2.")
    }

    private fun importPdf(fileName: String, bytes: ByteArray, pdf: PdfTextExtractor?): ImportedBook {
        if (pdf == null) throw BookImportException("Чтение PDF в этой сборке недоступно.")
        val pages = pdf.extractPages(bytes)
        if (pages.isEmpty()) throw BookImportException("В PDF нет страниц.")
        val letters = pages.sumOf { p -> p.count { it.isLetter() } }
        if (letters < 200 || letters / pages.size < 40) {
            throw BookImportException("В этом PDF нет текстового слоя — похоже, это скан. Распознавание сканов не поддерживается: нужен PDF с текстом, TXT, FB2 или EPUB.")
        }
        val text = pages.joinToString("\n\n")
        val chapters = TxtImporter.splitChapters(text)
        return ImportedBook(TxtImporter.guessTitle(text, fileName), TxtImporter.guessAuthor(text), "pdf", chapters)
    }

    fun clean(text: String): String = text.replace("\r\n", "\n").replace('\r', '\n').replace(' ', ' ').replace("­", "")
        .replace(Regex("[ \\t]+"), " ").replace(Regex(" ?\\n ?"), "\n").replace(Regex("\\n{3,}"), "\n\n").trim()
}

object TxtImporter {
    fun import(fileName: String, bytes: ByteArray, charsetOverride: String?): ImportedBook {
        val nul = bytes.take(4000).count { it == 0.toByte() }
        val (cs, text) = decode(bytes, charsetOverride)
        if (charsetOverride == null && nul > 8 && !cs.startsWith("UTF-16")) throw BookImportException("Это не текстовый файл. Подойдут TXT, FB2, EPUB и PDF с текстом.")
        val letters = text.take(20000).count { it.isLetter() }
        val bad = text.take(20000).count { it == '�' || (it < ' ' && it != '\n' && it != '\r' && it != '\t') }
        if (bad > letters / 5 || (letters < 50 && text.length > 400)) throw BookImportException("Не удалось прочитать текст: неизвестная кодировка или повреждённый файл. Попробуйте выбрать кодировку вручную.")
        return ImportedBook(guessTitle(text, fileName), guessAuthor(text), "txt", splitChapters(text), cs)
    }

    /** Определение кодировки: BOM → строгий UTF-8 → лучшая из русских однобайтовых по частотам букв. */
    fun decode(bytes: ByteArray, override: String? = null): Pair<String, String> {
        if (override != null) return override to String(bytes, Charset.forName(override)).removePrefix("﻿")
        if (bytes.size >= 3 && bytes[0] == 0xEF.toByte() && bytes[1] == 0xBB.toByte() && bytes[2] == 0xBF.toByte()) return "UTF-8" to String(bytes, 3, bytes.size - 3, Charsets.UTF_8)
        if (bytes.size >= 2 && bytes[0] == 0xFF.toByte() && bytes[1] == 0xFE.toByte()) return "UTF-16LE" to String(bytes, 2, bytes.size - 2, Charsets.UTF_16LE)
        if (bytes.size >= 2 && bytes[0] == 0xFE.toByte() && bytes[1] == 0xFF.toByte()) return "UTF-16BE" to String(bytes, 2, bytes.size - 2, Charsets.UTF_16BE)
        runCatching {
            val dec = Charsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT)
            return "UTF-8" to dec.decode(ByteBuffer.wrap(bytes)).toString()
        }
        val sample = if (bytes.size > 60000) bytes.copyOf(60000) else bytes
        val best = listOf("windows-1251", "KOI8-R", "IBM866").maxByOrNull { score(String(sample, Charset.forName(it))) }!!
        return best to String(bytes, Charset.forName(best))
    }

    private const val COMMON = "оеаинтсрвлкмдпу"
    private fun score(s: String): Double {
        var common = 0; var lower = 0; var upper = 0; var other = 0
        for (c in s) when {
            c in 'а'..'я' || c == 'ё' -> { lower++; if (c in COMMON) common++ }
            c in 'А'..'Я' -> upper++
            c.code > 127 -> other++
        }
        val total = (lower + upper + other).coerceAtLeast(1)
        return (common * 2.0 + lower - upper * 1.5 - other * 3.0) / total
    }

    private val HEADING = Regex("^\\s*((ГЛАВА|Глава|ЧАСТЬ|Часть|КНИГА|ПРОЛОГ|Пролог|ЭПИЛОГ|Эпилог|CHAPTER|Chapter)(?![А-Яа-яЁёA-Za-z]).{0,90}|[IVXLC]{1,7}\\.?|\\d{1,3}\\.?)\\s*$")

    fun splitChapters(text: String): List<Chapter> {
        val lines = text.replace("\r\n", "\n").replace('\r', '\n').split('\n')
        val chapters = ArrayList<Chapter>()
        var title = ""
        val sb = StringBuilder()
        fun flush() {
            val body = sb.toString().trim()
            if (body.length >= 20) chapters += Chapter(title.ifEmpty { if (chapters.isEmpty()) "Начало" else "Часть ${chapters.size + 1}" }, body)
            sb.setLength(0)
        }
        for (i in lines.indices) {
            val line = lines[i]
            val blankBefore = i == 0 || lines[i - 1].isBlank()
            if (blankBefore && line.length < 100 && HEADING.matches(line)) { flush(); title = line.trim() } else sb.append(line).append('\n')
        }
        flush()
        // Короткий блок перед первой главой (название, автор) главой не считается.
        if (chapters.size > 1 && chapters[0].title == "Начало" && chapters[0].text.length < 400) chapters.removeAt(0)
        // Нет глав или они огромные — режем по абзацам примерно по 8000 знаков.
        val out = ArrayList<Chapter>()
        for (ch in chapters) {
            if (ch.text.length <= 14000) { out += ch; continue }
            var part = 1
            val cur = StringBuilder()
            for (para in ch.text.split(Regex("\\n\\s*\\n|\\n"))) {
                if (cur.length + para.length > 8000 && cur.isNotEmpty()) { out += Chapter("${ch.title} (${part++})", cur.toString()); cur.setLength(0) }
                cur.append(para).append("\n\n")
            }
            if (cur.isNotBlank()) out += Chapter(if (part == 1) ch.title else "${ch.title} ($part)", cur.toString())
        }
        return out
    }

    fun guessTitle(text: String, fileName: String): String {
        val first = text.lineSequence().map { it.trim() }.firstOrNull { it.isNotEmpty() } ?: ""
        return if (first.length in 2..80 && !first.endsWith(".") && !HEADING.matches(first)) first else BookImporter.baseName(fileName)
    }

    fun guessAuthor(text: String): String =
        Regex("^\\s*Автор:\\s*(.{2,80})$", RegexOption.MULTILINE).find(text.take(2000))?.groupValues?.get(1)?.trim()?.takeIf { !it.contains("тестовый") && it.length < 60 } ?: ""
}

object Fb2Importer {
    fun import(fileName: String, bytes: ByteArray): ImportedBook {
        var title = ""
        val authorParts = ArrayList<String>()
        val chapters = ArrayList<Chapter>()
        val handler = object : DefaultHandler() {
            val path = ArrayList<String>()
            val text = StringBuilder()
            val body = StringBuilder()
            var chTitle = ""
            var titleBuf: StringBuilder? = null
            var inNotes = false
            var bodyDepth = -1
            fun inPath(name: String) = path.contains(name)
            fun flush() {
                val b = body.toString().trim()
                if (b.length >= 20) chapters += Chapter(chTitle.ifEmpty { if (chapters.isEmpty()) "Начало" else "Часть ${chapters.size + 1}" }, b)
                body.setLength(0)
            }
            override fun startElement(uri: String?, localName: String?, qName: String, a: Attributes) {
                val n = qName.substringAfter(':')
                path += n
                text.setLength(0)
                if (n == "body") { inNotes = a.getValue("name") == "notes" || a.getValue("name") == "comments"; bodyDepth = path.size }
                if (n == "section" && inPath("body") && !inNotes) { flush(); chTitle = "" }
                if (n == "title" && inPath("body") && !inNotes) titleBuf = StringBuilder()
            }
            override fun characters(ch: CharArray, start: Int, length: Int) {
                if (inPath("binary")) return
                text.append(ch, start, length)
            }
            override fun endElement(uri: String?, localName: String?, qName: String) {
                val n = qName.substringAfter(':')
                val t = text.toString().replace(Regex("\\s+"), " ").trim()
                when {
                    inPath("title-info") && n == "book-title" -> title = t
                    inPath("title-info") && inPath("author") && (n == "first-name" || n == "middle-name" || n == "last-name") && authorParts.size < 3 -> if (t.isNotEmpty()) authorParts += t
                    inPath("body") && !inNotes && titleBuf != null && (n == "p" || n == "subtitle") -> titleBuf!!.append(t).append(' ')
                    inPath("body") && !inNotes && n == "title" -> {
                        val tt = titleBuf.toString().trim(); titleBuf = null
                        if (path.count { it == "section" } == 0) { if (title.isEmpty()) title = tt } else if (chTitle.isEmpty()) chTitle = tt else body.append(tt).append("\n\n")
                    }
                    inPath("body") && !inNotes && titleBuf == null && (n == "p" || n == "v" || n == "subtitle" || n == "text-author") -> if (t.isNotEmpty()) body.append(t).append("\n\n")
                    n == "body" -> flush()
                }
                text.setLength(0)
                path.removeAt(path.size - 1)
            }
        }
        val f = SAXParserFactory.newInstance()
        f.isNamespaceAware = false
        runCatching { f.setFeature("http://apache.org/xml/features/disallow-doctype-decl", false) }
        runCatching { f.setFeature("http://xml.org/sax/features/external-general-entities", false) }
        runCatching { f.setFeature("http://xml.org/sax/features/external-parameter-entities", false) }
        runCatching { f.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false) }
        try {
            f.newSAXParser().parse(InputSource(ByteArrayInputStream(bytes)), handler)
        } catch (e: Exception) {
            if (chapters.isEmpty()) throw BookImportException("Файл FB2 повреждён: разметка обрывается или нарушена.", e)
        }
        if (chapters.isEmpty()) throw BookImportException("В файле FB2 не найден текст книги.")
        return ImportedBook(title, authorParts.joinToString(" "), "fb2", chapters)
    }
}

object EpubImporter {
    fun import(fileName: String, bytes: ByteArray): ImportedBook {
        val files = HashMap<String, ByteArray>()
        var total = 0L
        try {
            ZipInputStream(ByteArrayInputStream(bytes)).use { z ->
                while (true) {
                    val e = z.nextEntry ?: break
                    if (e.isDirectory) continue
                    val n = e.name.lowercase()
                    if (n.endsWith(".jpg") || n.endsWith(".jpeg") || n.endsWith(".png") || n.endsWith(".gif") || n.endsWith(".ttf") || n.endsWith(".otf") || n.endsWith(".woff") || n.endsWith(".mp3") || n.endsWith(".mp4")) continue
                    val data = z.readBytes()
                    total += data.size
                    if (total > 200L * 1024 * 1024) throw BookImportException("Книга слишком большая для разбора.")
                    files[e.name] = data
                }
            }
        } catch (e: BookImportException) { throw e } catch (e: Exception) {
            throw BookImportException("Файл EPUB повреждён: архив не читается.", e)
        }
        if (files.containsKey("META-INF/rights.xml")) throw BookImportException(DRM)
        val container = files["META-INF/container.xml"] ?: throw BookImportException("Файл EPUB повреждён: нет оглавления (container.xml).")
        val opfPath = Jsoup.parse(String(container, Charsets.UTF_8), "", Parser.xmlParser()).select("rootfile").attr("full-path")
        val opfBytes = files[opfPath] ?: throw BookImportException("Файл EPUB повреждён: не найден файл описания книги.")
        val opf = Jsoup.parse(String(opfBytes, Charsets.UTF_8), "", Parser.xmlParser())
        val base = opfPath.substringBeforeLast('/', "").let { if (it.isEmpty()) "" else "$it/" }
        val manifest = opf.select("manifest > item").associate { it.attr("id") to it.attr("href") }
        val spine = opf.select("spine > itemref").mapNotNull { manifest[it.attr("idref")] }.map { resolve(base, it) }
        if (spine.isEmpty()) throw BookImportException("Файл EPUB повреждён: пустой порядок чтения.")
        files["META-INF/encryption.xml"]?.let { enc ->
            val doc = Jsoup.parse(String(enc, Charsets.UTF_8), "", Parser.xmlParser())
            val encrypted = doc.select("*").filter { it.tagName().substringAfter(':') == "CipherReference" }.map { java.net.URLDecoder.decode(it.attr("URI"), "UTF-8") }.toSet()
            if (spine.any { it in encrypted }) throw BookImportException(DRM)
        }
        val title = opf.select("metadata > *").firstOrNull { it.tagName().substringAfter(':') == "title" }?.text().orEmpty()
        val author = opf.select("metadata > *").firstOrNull { it.tagName().substringAfter(':') == "creator" }?.text().orEmpty()
        val chapters = ArrayList<Chapter>()
        for (path in spine) {
            val data = files[path] ?: continue
            val doc = Jsoup.parse(String(data, Charsets.UTF_8))
            doc.select("script, style, nav, head > *:not(title)").remove()
            val body = doc.body()
            val heading = body.selectFirst("h1, h2, h3")?.text()?.trim().orEmpty()
            val sb = StringBuilder()
            val blocks = body.select("p, div, li, blockquote, h1, h2, h3, h4").filter { el -> el.children().none { it.tagName() in BLOCKS } }
            if (blocks.isEmpty()) sb.append(body.text()) else blocks.forEach { el: Element -> val t = el.text().trim(); if (t.isNotEmpty() && t != heading) sb.append(t).append("\n\n") }
            val text = sb.toString().trim()
            if (text.length >= 20) chapters += Chapter(heading.ifEmpty { "Часть ${chapters.size + 1}" }, text)
        }
        if (chapters.isEmpty()) throw BookImportException("В файле EPUB не найден текст (возможно, книга состоит из картинок).")
        return ImportedBook(title, author, "epub", chapters)
    }

    private val BLOCKS = setOf("p", "div", "li", "blockquote", "h1", "h2", "h3", "h4", "section", "ul", "ol", "table")
    private const val DRM = "Книга защищена от копирования (DRM). Такие файлы открыть нельзя — нужен файл без защиты."

    private fun resolve(base: String, href: String): String {
        val clean = java.net.URLDecoder.decode(href.substringBefore('#'), "UTF-8")
        val parts = ArrayList<String>()
        for (p in (base + clean).split('/')) when (p) { "", "." -> {} ".." -> if (parts.isNotEmpty()) parts.removeAt(parts.size - 1) else -> parts += p }
        return parts.joinToString("/")
    }
}
