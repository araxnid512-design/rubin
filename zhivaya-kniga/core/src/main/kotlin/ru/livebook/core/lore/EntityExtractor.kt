package ru.livebook.core.lore

import ru.livebook.core.importer.Chapter
import ru.livebook.core.model.Morph
import ru.livebook.core.model.Text

data class Entity(
    val kind: String,          // person | place | faction | item | rule | event
    val name: String,
    val stem: String,
    val freq: Int,
    val descr: String,
    val firstChapter: Int,
    val source: String = "rules",
    val refined: Boolean = false,
    val id: Long = 0,
)

/**
 * Извлечение имён, мест, фракций, предметов и правил мира регулярными правилами (без модели).
 * Это эвристика: она быстрая и работает офлайн, но может ошибаться в типе сущности —
 * поэтому карточки потом можно уточнить локальной моделью («глубокий разбор»).
 */
object EntityExtractor {
    val PLACE_NOUNS = setOf("город", "деревн", "сел", "трактир", "таверн", "замок", "замк", "крепост", "долин", "лес", "рек", "гор", "башн", "перевал", "остров", "улиц", "площад", "королевств", "царств", "импер", "земл", "ворот", "мост", "порт", "гаван", "монастыр", "храм", "дворец", "дворц", "пещер", "озер", "мор", "пустын", "болот", "станц", "дом", "двор", "рынок", "рынк", "кладбищ", "тракт", "дорог", "холм", "пол", "степ", "край", "провинц", "област", "квартал", "бухт", "руин", "шахт", "подземел", "корчм", "постоял", "лагер", "форт", "цитадел", "академ", "школ", "библиотек")
    val FACTION_NOUNS = setOf("орден", "гильд", "клан", "братств", "страж", "совет", "арм", "культ", "отряд", "легион", "союз", "банд", "секта", "сект", "род", "династ", "плем", "круг", "ковен", "корпорац", "парт", "общин", "цех")
    val ROLE_NOUNS = setOf("хозяйк", "хозяин", "странник", "капитан", "страж", "брат", "сестр", "корол", "королев", "лорд", "лед", "господин", "госпож", "мастер", "старик", "старух", "трактирщик", "кузнец", "купец", "купц", "торговец", "рыцар", "маг", "ведьм", "князь", "княз", "принц", "принцесс", "доктор", "профессор", "сержант", "генерал", "охотник", "монах", "жрец", "жриц", "сын", "доч", "отец", "отц", "мат", "дяд", "тёт", "тет", "дед", "бабушк", "учител", "слуг", "мальчик", "девочк", "девушк", "юнош", "смотрител", "писар", "лекар", "командир", "вожд", "староста", "старост", "путник", "проводник", "вор", "разбойник")
    val ITEM_NOUNS = setOf("меч", "ключ", "карт", "кольц", "амулет", "книг", "письм", "кинжал", "посох", "монет", "нож", "лук", "стрел", "щит", "плащ", "факел", "фонар", "верёвк", "веревк", "зель", "свитк", "свиток", "камен", "камн", "кристалл", "топор", "копь", "шлем", "доспех", "сумк", "мешок", "мешк", "фляг", "печат", "медальон", "браслет", "свеч", "ламп", "компас", "дневник", "записк", "перстен", "перстн", "жезл", "арбалет", "пистолет", "ружь", "отмычк", "сундук", "шкатулк", "кошел", "хлеб", "обрывок", "обрывк", "зеркал", "флейт", "рог", "знам", "корон", "эликсир", "трав", "бинт")
    private val RULE_MARKS = listOf("нельзя", "запрещ", "закон", "никто не", "никогда", "всегда", "маги", "проклят", "обыча", "клятв", "колдов", "правил", "только тот", "лишь тот", "печат", "чары", "древн")
    private val STRONG_PREP = setOf("в", "во", "из", "через")
    private val WEAK_PREP = setOf("на", "к", "ко", "у", "до", "от", "за", "под", "над", "около", "возле")
    private val STOP = setOf("он", "она", "они", "оно", "это", "этот", "эта", "эти", "но", "и", "а", "в", "на", "когда", "если", "там", "тогда", "после", "потом", "что", "как", "так", "его", "её", "ее", "их", "мы", "вы", "ты", "я", "все", "всё", "никто", "кто", "где", "здесь", "тут", "уже", "ещё", "еще", "только", "затем", "однако", "вдруг", "утром", "ночью", "днём", "днем", "вечером", "наконец", "теперь", "глава", "часть", "автор", "да", "нет", "не", "ни", "из", "за", "по", "со", "от", "до", "для", "при", "под", "над", "то", "же", "ли", "бы", "вот", "ну", "ах", "ох", "эй", "мне", "тебе", "нам", "вам", "ему", "ей", "им", "мой", "твой", "наш", "ваш", "свой", "один", "одна", "одни", "два", "три", "сегодня", "завтра", "вчера", "может", "пусть", "чтобы", "потому", "поэтому", "хотя", "почему", "зачем", "куда", "откуда", "какой", "какая", "такой", "каждый", "любой", "другой", "сам", "сама", "ничего", "что-то", "кто-то", "однажды", "пока", "снова", "опять", "именно", "конечно", "возможно", "наверное", "говорят", "скажи", "смотри", "слушай", "пролог", "эпилог")

    private class Cand(val stem: String) {
        val forms = HashMap<String, Int>()
        val subj = HashMap<String, Int>()   // сколько раз форма стояла перед глаголом, т. е. была подлежащим
        var mid = 0; var start = 0
        var person = 0.0; var place = 0.0; var faction = 0.0
        var firstChapter = Int.MAX_VALUE
        var descr = ""
        var display = ""
    }

    private val WORD = Regex("[A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё-]*|«|»|[.,!?;:—–-]")

    fun extract(chapters: List<IndexedValue<Chapter>>): List<Entity> {
        val cands = LinkedHashMap<String, Cand>()
        val lowerCount = HashMap<String, Int>()
        val items = LinkedHashMap<String, Cand>()
        val rules = ArrayList<Entity>()
        val locks = ArrayList<Entity>()
        val sites = LinkedHashMap<String, IntArray>()   // название → (сколько раз, первая глава)
        val events = ArrayList<Entity>()
        val perChapter = HashMap<Int, HashMap<String, Int>>()

        for ((ci, ch) in chapters) {
            for (sentence in Text.splitSentences(ch.text)) {
                val toks = WORD.findAll(sentence).map { it.value }.toList()
                var firstWord = true
                var i = 0
                while (i < toks.size) {
                    val t = toks[i]
                    if (!t[0].isLetter()) { if (t == "«" || t == "—" || t == "–") { /* после кавычки/тире слово может быть началом реплики */ }; i++; continue }
                    val isCap = t[0].isUpperCase() && t.length >= 2 && t.any { it.isLowerCase() }
                    if (!isCap) {
                        lowerCount.merge(Text.norm(t), 1, Int::plus)
                        // Предметы: существительное из словаря + необязательное прилагательное перед ним.
                        val st = Text.stem(t)
                        if (st in ITEM_NOUNS) {
                            val prev = toks.getOrNull(i - 1)
                            val adj = prev?.takeIf { it[0].isLetter() && it[0].isLowerCase() && ADJ.containsMatchIn(it) && Text.stem(it) !in ITEM_NOUNS }
                            val name = (if (adj != null) "$adj $t" else t).lowercase()
                            val key = (if (adj != null) Text.stem(adj) + " " else "") + st
                            val c = items.getOrPut(key) { Cand(key) }
                            c.forms.merge(name, 1, Int::plus); c.mid++
                            if (ci < c.firstChapter) { c.firstChapter = ci; c.descr = clip(sentence) }
                        }
                        firstWord = false; i++; continue
                    }
                    val prev = toks.getOrNull(i - 1)
                    val atStart = firstWord || prev == "«" || prev == "—" || prev == "–"
                    firstWord = false
                    val low = Text.norm(t)
                    if (low in STOP) { i++; continue }
                    // «Трактир „Лисья свеча“»: имя в кавычках после нарицательного слова.
                    var name = t
                    var span = 1
                    while (toks.getOrNull(i + span)?.let { it[0].isUpperCase() && it.any { c -> c.isLowerCase() } && Text.norm(it) !in STOP } == true && span < 3) { name += " " + toks[i + span]; span++ }
                    val next = toks.getOrNull(i + span)
                    val nextStem = next?.takeIf { it[0].isLetter() }?.let { Text.stem(it) }
                    val prevStem = prev?.takeIf { it[0].isLetter() }?.let { Text.stem(it) }
                    val beforeQuote = if (prev == "«") toks.getOrNull(i - 2)?.takeIf { it[0].isLetter() }?.let { Text.stem(it) } else null
                    var display = name
                    var stem = Text.stemKey(name)
                    var forcedPlace = false; var forcedFaction = false
                    if (nextStem != null && next!![0].isLowerCase() && nextStem in PLACE_NOUNS && span == 1 && ADJ.containsMatchIn(t)) {
                        display = Morph.placeNominative("$t $next") ?: "$t $next"; stem = Text.stem(t) + " " + nextStem; forcedPlace = true
                    } else if (beforeQuote != null && (beforeQuote in PLACE_NOUNS || beforeQuote in FACTION_NOUNS)) {
                        // имя в кавычках: берём до закрывающей кавычки
                        val end = (i until minOf(toks.size, i + 5)).firstOrNull { toks[it] == "»" }
                        if (end != null) { display = toks.subList(i, end).joinToString(" "); stem = Text.stemKey(display); span = end - i }
                        if (beforeQuote in PLACE_NOUNS) forcedPlace = true else forcedFaction = true
                        display = toks[i - 2].replaceFirstChar { it.uppercase() } + " «" + display + "»"
                    }
                    if (stem.length < 2) { i += span; continue }
                    val c = cands.getOrPut(stem) { Cand(stem) }
                    c.forms.merge(display, 1, Int::plus)
                    if (atStart && !forcedPlace && !forcedFaction) c.start++ else c.mid++
                    if (forcedPlace) c.place += 4.0
                    if (forcedFaction) c.faction += 4.0
                    if (prevStem != null) {
                        val pl = Text.norm(prev!!)
                        if (pl in STRONG_PREP) c.place += 1.5 else if (pl in WEAK_PREP) c.place += 0.3
                        if (prevStem in PLACE_NOUNS) c.place += 3.0
                        if (prevStem in FACTION_NOUNS) c.faction += 3.0
                        if (prevStem in ROLE_NOUNS) c.person += 3.0
                    }
                    if (next != null && next[0].isLetter() && next[0].isLowerCase()) {
                        if (PAST_VERB.containsMatchIn(next) && nextStem !in PLACE_NOUNS) { c.person += 1.5; c.subj.merge(display, 1, Int::plus) }
                        if (nextStem in PLACE_NOUNS && !forcedPlace) c.place += 2.0
                    }
                    if (next == "—" || next == ",") c.person += 0.4
                    if (ci < c.firstChapter) { c.firstChapter = ci; c.descr = clip(sentence) }
                    perChapter.getOrPut(ci) { HashMap() }.merge(stem, 1, Int::plus)
                    i += span
                }
                // Места, названные обычными словами («северные ворота», «мастерская»): из них складывается карта книги-игры.
                for (site in Morph.findPlaces(sentence)) { val c = sites.getOrPut(site) { intArrayOf(0, ci) }; c[0]++ }
                // Запертые и запечатанные места: «у ворот башни сохранялась печать», «дверь в подвал заперта».
                if (locks.size < 6 && LOCK.containsMatchIn(Text.norm(sentence))) {
                    Morph.findPlaces(sentence).firstOrNull()?.let { place -> if (locks.none { it.name == place }) locks += Entity("lock", place, Text.stemKey(place), 1, clip(sentence, 220), ci) }
                }
                if (rules.size < 8 && sentence.length in 30..260) {
                    val l = Text.norm(sentence)
                    if (RULE_MARKS.any { l.contains(it) } && rules.none { it.descr == clip(sentence, 220) }) {
                        rules += Entity("rule", "Правило ${rules.size + 1}", "rule${rules.size + 1}", 1, clip(sentence, 220), ci)
                    }
                }
            }
        }

        // Одно имя в разных падежах («Радим», «Радима», «Радиму») — один персонаж.
        val single = cands.values.filter { c -> c.forms.keys.all { ' ' !in it && '«' !in it } }.sortedByDescending { it.mid + it.start }
        for (a in single) {
            if (a.stem !in cands) continue
            val base = nameBase(a.forms.keys.minByOrNull { it.length }!!)
            if (base.length < 3) continue
            for (b in single) {
                if (b === a || b.stem !in cands) continue
                val all = a.forms.keys + b.forms.keys
                if (all.any { f -> val n = Text.norm(f); !n.startsWith(base) || n.removePrefix(base) !in CASE_TAILS }) continue
                b.forms.forEach { (k, v) -> a.forms.merge(k, v, Int::plus) }; b.subj.forEach { (k, v) -> a.subj.merge(k, v, Int::plus) }
                a.start += b.start; a.mid += b.mid; a.place += b.place; a.faction += b.faction; a.person += b.person
                if (b.firstChapter < a.firstChapter) { a.firstChapter = b.firstChapter; a.descr = b.descr }
                perChapter.values.forEach { m -> m.remove(b.stem)?.let { n -> m.merge(a.stem, n, Int::plus) } }
                cands.remove(b.stem)
            }
        }

        val out = ArrayList<Entity>()
        for (c in cands.values) {
            val total = c.mid + c.start
            val firstForm = c.forms.keys.first()
            val lowTimes = if (' ' in firstForm) 0 else c.forms.keys.sumOf { lowerCount[Text.norm(it)] ?: 0 }
            if (c.mid == 0 && (c.start < 2 || lowTimes > 0)) continue          // только в начале предложений — скорее обычное слово
            if (lowTimes > c.mid * 2 && c.place < 3 && c.faction < 3) continue  // чаще пишется со строчной — не имя
            if (total < 1) continue
            // Начальная форма имени: для остальных — та, что чаще стоит подлежащим («Мира сказала»), затем самая частая.
            // Мужские имена в начальной форме оканчиваются на согласную, «й» или «ь» («Арсений», а не «Арсения»).
            val masc = c.forms.entries.filter { ' ' !in it.key && Text.norm(it.key).last() in "бвгджзйклмнпрстфхцчшщь" }
            // «Немой Латник», а не «Немому Латнику»: прилагательное и существительное в начальной форме.
            val phrase = c.forms.entries.filter { e -> val w = e.key.split(' '); w.size == 2 && '«' !in e.key && Regex("(ый|ий|ой|ая|яя)$").containsMatchIn(Text.norm(w[0])) && Text.norm(w[1]).last() in "бвгджзйклмнпрстфхцчшщьая" }
            val name = (phrase.firstOrNull { !Text.norm(it.key.substringBefore(' ')).endsWith("ой") || Text.norm(it.key).last() !in "ая" } ?: masc.maxByOrNull { it.value } ?: c.forms.entries.sortedWith(compareByDescending<Map.Entry<String, Int>> { (c.subj[it.key] ?: 0) * 3 + it.value }.thenBy { nominativeRank(it.key) }.thenBy { it.key.length }).first()).key
            val kind = when {
                c.faction >= 3 && c.faction >= c.place && c.faction >= c.person -> "faction"
                c.place >= 2.5 && c.place > c.person -> "place"
                else -> "person"
            }
            if (kind == "person" && total < 2 && c.person < 1.5) continue      // единичное упоминание без признаков персонажа
            // Персонаж «живёт» в той главе, где о нём говорится больше всего: писарь, упомянутый в первой главе, ждёт героя в шестой.
            val home = if (kind == "person") perChapter.entries.filter { (it.value[c.stem] ?: 0) > 0 }.sortedBy { it.key }.maxByOrNull { it.value[c.stem]!! }?.key ?: c.firstChapter else c.firstChapter
            out += Entity(kind, name, c.stem, total, c.descr, home)
        }
        for (c in items.values.sortedByDescending { it.mid }.take(24)) {
            val name = c.forms.entries.maxByOrNull { it.value }!!.key
            out += Entity("item", name, c.stem, c.mid, c.descr, c.firstChapter)
        }
        out += rules
        out += locks
        val named = out.filter { it.kind == "place" }.flatMap { Text.stems(it.name) }.toSet()
        for ((name, c) in sites) {
            val specific = ' ' in name || c[0] >= 2
            if (!specific || Text.stem(name.substringAfterLast(' ')) in GENERIC_SITES && ' ' !in name) continue
            if (Text.stems(name).all { it in named }) continue                      // уже есть как собственное название
            if (out.size < 400 && sites.keys.none { it != name && it.endsWith(" " + name.lowercase()) && ' ' !in name }) out += Entity("site", name, Text.stemKey(name), c[0], "", c[1])
        }
        for ((ci, ch) in chapters) {
            val top = perChapter[ci]?.entries?.sortedByDescending { it.value }?.take(5)?.mapNotNull { e -> out.firstOrNull { it.stem == e.key }?.name } ?: emptyList()
            events += Entity("event", ch.title, "chapter$ci", 1, if (top.isEmpty()) "" else "Участвуют: " + top.joinToString(", "), ci)
        }
        out += events
        return out.sortedWith(compareBy<Entity> { KIND_ORDER.indexOf(it.kind) }.thenByDescending { it.freq })
    }

    private val KIND_ORDER = listOf("person", "place", "faction", "item", "rule", "lock", "site", "event")
    private val GENERIC_SITES = setOf("дорог", "земл", "дом", "двор", "край", "город", "стен", "выход", "вход", "улиц", "комнат", "зал")
    private val LOCK = Regex("заперт|запечат|печать|под замком|на замке|на засов|замурован|наглухо закрыт")
    private val ADJ = Regex("(ый|ий|ой|ая|яя|ое|ее|ые|ие|ую|юю|ого|его|ому|ему|ых|их|ым|им)$")
    private val PAST_VERB = Regex("(л|ла|ло|ли|лся|лась|лись|ет|ит|ёт)$")

    private val CASE_TAILS = setOf("", "а", "у", "е", "ы", "и", "я", "ю", "ой", "ей", "ом", "ем", "ою", "ью", "ь", "й", "ия", "ию", "ии", "ием", "ий")
    private fun nameBase(form: String): String { val n = Text.norm(form); return if (n.last() in "аяйь") n.dropLast(1).let { if (it.endsWith("и")) it.dropLast(1) else it } else n }

    private fun nominativeRank(form: String): Int {
        val last = Text.norm(form).last()
        return when (last) { 'а', 'я', 'й', 'ь', 'н', 'р', 'л', 'т', 'с', 'к', 'д', 'м', 'в', 'г', 'з', 'б', 'п', 'х', 'ж', 'ш', 'ч', 'ц', 'ф', 'щ' -> 0; 'о', 'е' -> 1; else -> 2 }
    }

    private fun clip(s: String, max: Int = 170): String {
        val t = s.replace(Regex("\\s+"), " ").trim()
        return if (t.length <= max) t else t.take(max).substringBeforeLast(' ') + "…"
    }
}
