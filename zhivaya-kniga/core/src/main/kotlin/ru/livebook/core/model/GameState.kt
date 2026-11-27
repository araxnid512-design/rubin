package ru.livebook.core.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/** Состояние мира одного приключения. Хранится детерминированно, модель его напрямую не меняет. */
@Serializable
data class Hero(
    val name: String,
    val role: String = "",
    val hp: Int = 10,
    @SerialName("max_hp") val maxHp: Int = 10,
    val gold: Int = 0,
)

@Serializable
data class Item(val id: String, val name: String, val qty: Int = 1)

@Serializable
data class Npc(
    val id: String,
    val name: String,
    val relation: Int = 0,
    val alive: Boolean = true,
    @SerialName("last_seen") val lastSeen: String = "",
    val note: String = "",
    /** true — персонаж из книги (канон), false — появился в ходе игры. */
    val canon: Boolean = true,
)

@Serializable
data class Quest(val id: String, val title: String, val status: String = "active")

@Serializable
data class TurnBrief(val action: String, val reply: String)

/** Вариант выбора в книге-игре. kind: go, talk, search, strike, luckstrike, flee, eat, wait, start. */
@Serializable
data class Choice(val id: String, val label: String, val kind: String, val target: String = "")

/** Идущий бой: у противника, как у героя, есть Ловкость и Сила. */
@Serializable
data class Combat(val enemy: String, val skill: Int, val stamina: Int, val round: Int = 0, @SerialName("from") val cameFrom: String = "")

/** Лист персонажа книги-игры. Сила героя хранится в hero.hp. */
@Serializable
data class Gamebook(
    val skill: Int = 0, val luck: Int = 0, @SerialName("luck_max") val luckMax: Int = 0, val provisions: Int = 0,
    /** Номер текущего параграфа. */
    val para: Int = 0,
    val combat: Combat? = null,
    val choices: List<Choice> = emptyList(),
    /** Последние броски кубиков — для показа игроку. */
    val dice: String = "",
    val searched: List<String> = emptyList(),
    val visited: List<String> = emptyList(),
    val talked: List<String> = emptyList(),
    val dead: Boolean = false,
    val won: Boolean = false,
    val kills: Int = 0,
)

@Serializable
data class GameState(
    @SerialName("save_version") val saveVersion: Int = 1,
    @SerialName("book_id") val bookId: String,
    /** "canon" — ближе к канону, "alternate" — свободная история. */
    @SerialName("story_mode") val storyMode: String = "canon",
    val hero: Hero,
    val location: String,
    @SerialName("time_tick") val timeTick: Int = 0,
    val inventory: List<Item> = emptyList(),
    val characters: List<Npc> = emptyList(),
    val quests: List<Quest> = emptyList(),
    @SerialName("known_locations") val knownLocations: List<String> = emptyList(),
    @SerialName("locked_locations") val lockedLocations: List<String> = emptyList(),
    /** Факты первоисточника (не меняются игрой). */
    @SerialName("canon_facts") val canonFacts: List<String> = emptyList(),
    /** Факты, появившиеся из-за действий игрока. */
    @SerialName("story_facts") val storyFacts: List<String> = emptyList(),
    val journal: List<String> = emptyList(),
    @SerialName("turn_history_compact") val history: List<TurnBrief> = emptyList(),
    /** Последние подсказки-действия. */
    val suggestions: List<String> = emptyList(),
    /** Сводка сюжета: короткие записи о том, что уже произошло. */
    val summary: List<String> = emptyList(),
    @SerialName("summary_tick") val summaryTick: Int = 0,
    /** До какой главы книги дошёл сюжет и какие зацепки из неё уже использованы. */
    val stage: Int = 0,
    @SerialName("used_clues") val usedClues: List<Long> = emptyList(),
    /** Не null — приключение идёт в режиме книги-игры (параграфы, выбор, кубики). */
    val gamebook: Gamebook? = null,
) {
    fun toJson(): String = JSON.encodeToString(serializer(), this)
    fun hasItem(name: String): Boolean = findItem(name) != null
    fun hasItemExact(name: String): Boolean = inventory.any { Text.stemKey(it.name) == Text.stemKey(name) }
    fun findItem(name: String): Item? {
        val key = Text.stemKey(name)
        return inventory.firstOrNull { Text.stemKey(it.name) == key }
            ?: inventory.firstOrNull { Text.sharesStem(it.name, name) }
    }
    fun findNpc(name: String): Npc? {
        val key = Text.stemKey(name)
        return characters.firstOrNull { Text.stemKey(it.name) == key }
            ?: characters.firstOrNull { Text.sharesStem(it.name, name) }
    }
    fun nearbyNpcs(): List<Npc> = characters.filter { it.alive && Text.stemKey(it.lastSeen) == Text.stemKey(location) }

    companion object {
        val JSON = Json { ignoreUnknownKeys = true; encodeDefaults = true }
        fun fromJson(s: String): GameState = JSON.decodeFromString(serializer(), s)
    }
}

/** Простейшая русская нормализация: без словарей, достаточно для сопоставления имён и предметов. */
object Text {
    private val ENDINGS = listOf(
        "иями", "ями", "ами", "ого", "его", "ому", "ему", "ыми", "ими", "ием", "ией", "иях",
        "ая", "яя", "ую", "юю", "ой", "ей", "ый", "ий", "ые", "ие", "ым", "им", "ом", "ем", "ам", "ям", "ах", "ях", "ов", "ев", "ью", "ия", "ию", "ии",
        "а", "я", "о", "е", "у", "ю", "ы", "и", "ь", "й",
    )

    fun norm(s: String): String = s.lowercase().replace('ё', 'е')

    /** Грубая основа слова: срезаем типичное окончание, оставляя минимум 3 буквы. */
    fun stem(word: String): String {
        val w = norm(word).filter { it.isLetterOrDigit() }
        if (w.length <= 3) return w
        for (e in ENDINGS) if (w.length - e.length >= 3 && w.endsWith(e)) return w.dropLast(e.length)
        return w
    }

    fun words(s: String): List<String> = norm(s).split(Regex("[^a-zа-я0-9]+")).filter { it.isNotEmpty() }
    fun stems(s: String): List<String> = words(s).map { stem(it) }
    fun stemKey(s: String): String = stems(s).joinToString(" ")

    /** Есть ли у двух названий общее значимое слово (по основе). */
    fun sharesStem(a: String, b: String): Boolean {
        val sa = stems(a).filter { it.length >= 3 }.toSet()
        return stems(b).any { it.length >= 3 && it in sa }
    }

    /** Упоминается ли название (любое его значимое слово) в тексте. */
    fun mentions(text: String, name: String): Boolean {
        val ts = stems(text).toSet()
        val ns = stems(name).filter { it.length >= 3 }
        return ns.isNotEmpty() && ns.any { it in ts }
    }

    fun slug(s: String): String {
        val map = "абвгдежзийклмнопрстуфхцчшщъыьэюя".toList().zip(
            listOf("a", "b", "v", "g", "d", "e", "zh", "z", "i", "y", "k", "l", "m", "n", "o", "p", "r", "s", "t", "u", "f", "h", "c", "ch", "sh", "sch", "", "y", "", "e", "yu", "ya")
        ).toMap()
        return norm(s).map { c -> map[c] ?: if (c.isLetterOrDigit()) c.toString() else "_" }.joinToString("").trim('_').replace(Regex("_+"), "_").ifEmpty { "x" }
    }

    fun splitSentences(text: String): List<String> {
        val out = ArrayList<String>()
        val sb = StringBuilder()
        var i = 0
        while (i < text.length) {
            val c = text[i]
            sb.append(c)
            if (c == '.' || c == '!' || c == '?' || c == '…') {
                while (i + 1 < text.length && (text[i + 1] == '.' || text[i + 1] == '!' || text[i + 1] == '?' || text[i + 1] == '»' || text[i + 1] == '"')) { i++; sb.append(text[i]) }
                val next = text.getOrNull(i + 1)
                if (next == null || next.isWhitespace()) { val s = sb.toString().trim(); if (s.isNotEmpty()) out += s; sb.setLength(0) }
            } else if (c == '\n') { val s = sb.toString().trim(); if (s.isNotEmpty()) out += s; sb.setLength(0) }
            i++
        }
        val tail = sb.toString().trim(); if (tail.isNotEmpty()) out += tail
        return out
    }
}
