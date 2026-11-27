package ru.livebook.core.game

import ru.livebook.core.lore.BookRepository
import ru.livebook.core.model.GameState
import ru.livebook.core.model.Morph
import ru.livebook.core.model.Text
import ru.livebook.core.rules.RulesEngine

/**
 * «Режиссёр сюжета». Маленькая модель сама интригу не держит, поэтому историю ведут правила:
 * у героя есть главная цель из книги, каждые несколько ходов в сцену подбрасывается зацепка из очередной главы
 * или осложнение, а сюжет постепенно идёт по главам книги от первой к последней.
 */
object StoryDirector {
    private val WANTS = listOf("искал", "ищет", "разыскива", "хотел", "хочет", "мечта", "должен", "поклял", "надеял", "собирал", "стремил", "пытал")

    /** Главная цель героя книги: фраза вроде «искал следы своего старшего брата» рядом с его именем. */
    fun mainQuest(books: BookRepository, bookId: String, hero: String): String? {
        val heroStems = Text.stems(hero).toSet()
        for (hit in books.search(bookId, "$hero искал хотел должен поклялся мечтал", 5)) {
            val sentences = Text.splitSentences(hit.text)
            for ((i, s) in sentences.withIndex()) {
                val about = Text.stems(s).any { it in heroStems } || (i > 0 && Text.stems(sentences[i - 1]).any { it in heroStems } && Regex("^(Он|Она)\\s").containsMatchIn(s))
                if (!about) continue
                val m = Regex("(?<![а-яё])(искал[аи]?|ищет|разыскивал[аи]?|хотел[аи]?|мечтал[аи]?|должен|должна|поклял[а-я]+|надеял[а-я]+|пытал[а-я]+)\\s+([^.!?;]{6,90})", RegexOption.IGNORE_CASE).find(s) ?: continue
                val verb = m.groupValues[1].lowercase()
                val what = m.groupValues[2].split(Regex(",\\s*(который|которая|которые|исчезнувш|пропавш|чтобы|но |а )")).first().trim().trim(',', ' ')
                if (what.length < 5) continue
                val title = when { verb.startsWith("иск") || verb.startsWith("ищ") || verb.startsWith("разыск") -> "Найти $what"; else -> "Цель: $what" }
                return title.take(70)
            }
        }
        return null
    }

    /** Цель для своего героя: тайна самого заметного запертого места или места из книги. */
    fun mysteryQuest(books: BookRepository, bookId: String, start: String): String? {
        books.entities(bookId, "lock").firstOrNull()?.let { return "Узнать, что скрывает место: ${it.name}" }
        return books.entities(bookId, "place").firstOrNull { Text.stemKey(it.name) != Text.stemKey(start) }?.let { "Разведать место: ${it.name}" }
    }

    data class Beat(val text: String, val state: GameState)

    /**
     * Зацепка для книги-игры. У каждого источника (персонаж, место) на каждом этапе сюжета своя постоянная зацепка —
     * поэтому страница квеста не зависит от того, каким путём игрок к ней пришёл.
     */
    fun clue(state: GameState, books: BookRepository, source: String): Beat {
        val chapters = books.indexedChapterCount(state.bookId)
        if (chapters == 0) return Beat("", state)
        val stage = state.stage.coerceIn(0, chapters - 1)
        val pool = books.chapterChunks(state.bookId, stage)
        if (pool.isEmpty()) return Beat("", state)
        val (id, body) = pool[(source.sumOf { it.code } and 0x7fffffff) % pool.size]
        val heroStems = Text.stems(state.hero.name).toSet()
        val sentences = Text.splitSentences(body).filter { it.length in 30..190 }
        val sentence = sentences.firstOrNull { s -> Text.stems(s).none { it in heroStems } } ?: sentences.firstOrNull() ?: body.take(160)
        val used = if (id in state.usedClues) state.usedClues else (state.usedClues + id).takeLast(200)
        val inChapter = pool.count { it.first in used }
        // В короткой главе хватает одной зацепки, в обычной нужны две разные.
        val next = if (inChapter >= (if (pool.size <= 2) 1 else 2) && stage < chapters - 1) stage + 1 else stage
        return Beat("в сцене всплывает зацепка — ${sentence.trim()}", state.copy(usedClues = used, stage = next))
    }

    private val TWISTS = listOf(
        "кто-то незаметно наблюдает за героем",
        "{npc} что-то скрывает и на миг выдаёт себя",
        "снаружи слышен тревожный шум, времени мало",
        "{npc} просит героя о небольшой услуге",
        "герой замечает странный след или знак",
        "появляется препятствие: дальше просто так не пройти",
        "{npc} вспоминает важную подробность",
    )

    /**
     * Поворот для ближайшей сцены (или пустая строка). Каждые три хода — зацепка из текущей главы книги,
     * иногда — осложнение. Использованные зацепки запоминаются; после двух зацепок сюжет переходит к следующей главе.
     */
    /** [force] — выдать зацепку сейчас (в книге-игре её приносит разговор или находка), а не раз в три хода. */
    fun beat(state: GameState, books: BookRepository, action: String, force: Boolean = false): Beat {
        val t = state.timeTick
        if (t == 0 && !force) return Beat("", state)
        val near = state.nearbyNpcs().firstOrNull()?.name
        if (t % 3 == 0 || force) {
            val chapters = books.indexedChapterCount(state.bookId)
            var stage = state.stage.coerceIn(0, (chapters - 1).coerceAtLeast(0))
            repeat(2) {
                val pool = books.chapterChunks(state.bookId, stage).filter { it.first !in state.usedClues }
                if (pool.isNotEmpty()) {
                    val want = Text.stems(state.quests.joinToString(" ") { it.title } + " " + state.location + " " + action + " " + (near ?: "")).filter { it.length >= 4 }.toSet()
                    val heroStems = Text.stems(state.hero.name).toSet()
                    val (id, body) = pool.maxByOrNull { (_, b) -> Text.stems(b).count { it in want } }!!
                    val sentence = Text.splitSentences(body).filter { it.length in 30..190 }.maxByOrNull { s -> Text.stems(s).count { it in want } * 2 - Text.stems(s).count { it in heroStems } * 3 } ?: body.take(160)
                    val used = state.usedClues + id
                    val inChapter = books.chapterChunks(state.bookId, stage).count { it.first in used }
                    val nextStage = if ((inChapter >= 2 || pool.size == 1) && stage < chapters - 1) stage + 1 else stage
                    return Beat("в сцене всплывает зацепка — ${sentence.trim()}", state.copy(usedClues = used.takeLast(200), stage = nextStage))
                }
                if (stage < chapters - 1) stage++ else return@repeat
            }
            return Beat("", state)
        }
        if (t % 7 == 5 && !RulesEngine.hasAny(action, RulesEngine.MOVE)) {
            val options = TWISTS.filter { near != null || !it.contains("{npc}") }
            val pick = options[(t / 7 + state.hero.name.length) % options.size]
            return Beat(pick.replace("{npc}", near ?: ""), state)
        }
        return Beat("", state)
    }
}

/** Подсказки действий строятся правилами по состоянию мира — быстро и без вызова модели. */
object Suggestions {
    fun build(s: GameState): List<String> {
        val out = ArrayList<String>()
        val near = s.nearbyNpcs()
        val quest = s.quests.firstOrNull { it.status == "active" }
        val t = s.timeTick
        near.getOrNull(t % near.size.coerceAtLeast(1))?.let { npc ->
            val who = Morph.accusative(npc.name, true)
            out += when {
                npc.relation <= -2 -> "Извиниться перед: ${npc.name}"
                quest != null && t % 2 == 0 -> "Расспросить $who о деле"
                t % 3 == 1 -> "Спросить $who, что тут происходит"
                else -> "Поговорить по душам: ${npc.name}"
            }
        }
        val places = s.knownLocations.filter { Text.stemKey(it) != Text.stemKey(s.location) }
        if (places.isNotEmpty()) {
            val p = places[(t / 2) % places.size]
            out += if (s.lockedLocations.any { Text.stemKey(it) == Text.stemKey(p) }) "Узнать, как попасть в место: $p" else "Отправиться в место: $p"
        }
        val item = s.inventory.getOrNull(t % s.inventory.size.coerceAtLeast(1))
        if (item != null && near.isNotEmpty() && t % 2 == 1) out += "Показать ${Morph.accusative(item.name, false)}"
        else if (item != null && t % 4 == 2) out += "Рассмотреть ${Morph.accusative(item.name, false)}"
        if (s.hero.hp <= s.hero.maxHp / 2) out += "Отдохнуть и перевязать раны"
        for (extra in listOf("Осмотреться внимательнее", "Прислушаться", "Поискать что-нибудь полезное")) if (out.size < 3) out += extra
        return out.distinct().take(3)
    }
}
