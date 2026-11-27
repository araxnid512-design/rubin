package ru.livebook.core.model

/**
 * Мини-морфология для названий мест: «к северным воротам» → «Северные ворота», «Северной долины» → «Северная долина».
 * Работает по небольшому словарю нарицательных слов-мест; для слов вне словаря ничего не выдумывает.
 */
object Morph {
    /** основа → (именительный падеж, род: m/f/n/p) */
    val PLACES: Map<String, Pair<String, Char>> = listOf(
        "ворота" to 'p', "башня" to 'f', "трактир" to 'm', "таверна" to 'f', "крепость" to 'f', "долина" to 'f', "лес" to 'm', "река" to 'f',
        "мастерская" to 'f', "двор" to 'm', "площадь" to 'f', "перевал" to 'm', "мост" to 'm', "рынок" to 'm', "замок" to 'm', "дворец" to 'm',
        "кузница" to 'f', "конюшня" to 'f', "подвал" to 'm', "чердак" to 'm', "комната" to 'f', "зал" to 'm', "кухня" to 'f', "погреб" to 'm',
        "сад" to 'm', "берег" to 'm', "дорога" to 'f', "тракт" to 'm', "улица" to 'f', "деревня" to 'f', "город" to 'm', "храм" to 'm',
        "церковь" to 'f', "пещера" to 'f', "озеро" to 'n', "море" to 'n', "холм" to 'm', "болото" to 'n', "порт" to 'm', "гавань" to 'f',
        "пристань" to 'f', "причал" to 'm', "лагерь" to 'm', "шахта" to 'f', "руины" to 'p', "подземелье" to 'n', "кладбище" to 'n',
        "монастырь" to 'm', "библиотека" to 'f', "лавка" to 'f', "стена" to 'f', "колодец" to 'm', "мельница" to 'f', "ферма" to 'f',
        "хижина" to 'f', "дом" to 'm', "выход" to 'm', "вход" to 'm', "окраина" to 'f', "опушка" to 'f', "поляна" to 'f', "тропа" to 'f',
        "склад" to 'm', "амбар" to 'm', "темница" to 'f', "тюрьма" to 'f', "казарма" to 'f', "станция" to 'f', "корабль" to 'm', "палуба" to 'f',
        "трюм" to 'm', "каюта" to 'f', "остров" to 'm', "бухта" to 'f', "маяк" to 'm', "крыша" to 'f', "переулок" to 'm', "квартал" to 'm',
        "горы" to 'p', "пустыня" to 'f', "степь" to 'f', "село" to 'n', "королевство" to 'n', "столица" to 'f', "академия" to 'f', "школа" to 'f',
        "корчма" to 'f', "форт" to 'm', "цитадель" to 'f', "граница" to 'f', "застава" to 'f', "караван" to 'm', "оазис" to 'm', "канал" to 'm',
        "спальня" to 'f', "коридор" to 'm', "лестница" to 'f', "балкон" to 'm', "сторожка" to 'f', "часовня" to 'f', "арена" to 'f', "чаща" to 'f',
    ).flatMap { (nom, g) ->
        val forms = listOf(nom) + when {
            nom.endsWith("ок") -> listOf(nom.dropLast(2) + "ка")            // рынок → рынка
            nom.endsWith("ец") -> listOf(nom.dropLast(2) + "ца")            // дворец → дворца
            nom.endsWith("ень") -> listOf(nom.dropLast(3) + "ня")
            nom == "церковь" -> listOf("церкви")
            else -> emptyList()
        }
        forms.map { Text.stem(it) to (nom to g) }
    }.toMap()

    private val ADJ_ENDINGS = listOf("ого", "его", "ому", "ему", "ыми", "ими", "ая", "яя", "ую", "юю", "ой", "ей", "ый", "ий", "ое", "ее", "ые", "ие", "ым", "им", "ом", "ем", "ых", "их")
    private val SOFT = setOf("ий", "яя", "ее", "ие", "его", "ему", "им", "ей", "юю", "их", "ими", "ем")

    fun placeNoun(word: String): Pair<String, Char>? = PLACES[Text.stem(word)]

    fun isAdjective(word: String): Boolean = Text.norm(word).let { w -> w.length >= 5 && ADJ_ENDINGS.any { w.endsWith(it) } }

    fun adjNominative(adj: String, gender: Char): String {
        val w = adj.lowercase()
        val end = ADJ_ENDINGS.firstOrNull { Text.norm(w).endsWith(it) && w.length - it.length >= 3 } ?: return w
        val stem = w.dropLast(end.length)
        val velar = stem.last() in "гкхжшщч"
        val soft = end in SOFT && !velar
        return stem + when (gender) {
            'f' -> if (soft) "яя" else "ая"
            'n' -> if (soft || stem.last() in "жшщч") "ее" else "ое"
            'p' -> if (soft || velar) "ие" else "ые"
            else -> if (soft || velar) "ий" else "ый"
        }
    }

    /** «северным воротам» → «Северные ворота»; null, если главное слово — не место из словаря. */
    fun placeNominative(phrase: String): String? {
        val words = phrase.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
        if (words.isEmpty() || words.size > 3) return null
        val (nom, g) = placeNoun(words.last()) ?: return null
        if (words.dropLast(1).any { !isAdjective(it) }) return null
        return (words.dropLast(1).map { adjNominative(it, g) } + nom).joinToString(" ").replaceFirstChar { it.uppercase() }
    }

    private val DEST = Regex("(?<![а-яё])(?:к|ко|в|во|на|до|через|под|за|внутрь|вглубь|вдоль)\\s+((?:[а-яё-]+\\s+){0,2}[а-яё-]+)")

    /** Куда герой собирается идти, если это названо нарицательным словом-местом: «иду к старой башне» → «Старая башня». */
    fun destination(action: String): String? {
        val t = action.lowercase().replace('ё', 'ё')
        for (m in DEST.findAll(t)) {
            val words = m.groupValues[1].split(Regex("\\s+"))
            for (n in words.indices) {
                if (placeNoun(words[n]) == null) continue
                placeNominative(words.subList(0, n + 1).joinToString(" "))?.let { return it }
                placeNominative(words[n])?.let { return it }
            }
        }
        return null
    }
}
