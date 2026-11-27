package ru.livebook.core

import ru.livebook.core.lore.EntityExtractor
import ru.livebook.core.model.GameState
import ru.livebook.core.model.Hero
import ru.livebook.core.model.Item
import ru.livebook.core.model.Morph
import ru.livebook.core.model.Npc
import ru.livebook.core.model.Quest
import ru.livebook.core.rules.GameEvent
import ru.livebook.core.rules.RulesEngine
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class RulesTest {
    private val base = GameState(
        bookId = "b", hero = Hero("Арсений", "странник", gold = 3), location = "Трактир «Лисья свеча»",
        inventory = listOf(Item("plasch", "потёртый плащ"), Item("karta", "обрывок карты")),
        characters = listOf(Npc("mira", "Мира", lastSeen = "Трактир «Лисья свеча»"), Npc("borin", "Борин", lastSeen = "Северные ворота"), Npc("old", "Старик", alive = false, lastSeen = "Трактир «Лисья свеча»")),
        knownLocations = listOf("Трактир «Лисья свеча»", "Северные ворота", "Старая башня"), lockedLocations = listOf("Старая башня"),
    )
    private fun ev(type: String, name: String = "", delta: Int = 0) = GameEvent(type, name, delta)

    @Test fun itemCannotAppearFromThinAir() {
        // Модель «выдала» меч, хотя герой только разговаривал.
        val r = RulesEngine.apply(base, listOf(ev(GameEvent.ITEM_ADD, "меч")), "спрашиваю Миру о брате", "Мира качает головой. «Не видела», — говорит она.")
        assertTrue(r.applied.isEmpty()); assertEquals(1, r.rejected.size)
        assertFalse(r.state.hasItem("меч"))
        // Герой брал ключ, но модель записала другой предмет, которого нет в сцене.
        val r2 = RulesEngine.apply(base, listOf(ev(GameEvent.ITEM_ADD, "золотая корона")), "беру ржавый ключ из щели", "Ты вытаскиваешь ключ, он холодный.")
        assertTrue(r2.applied.isEmpty())
    }

    @Test fun itemTakenWhenActionAndSceneAgree() {
        val r = RulesEngine.apply(base, listOf(ev(GameEvent.ITEM_ADD, "ржавый ключ")), "беру ржавый ключ из щели между камнями", "Ты вытаскиваешь ключ, он холодный и тяжёлый.")
        assertEquals(1, r.applied.size)
        assertTrue(r.state.hasItem("ржавый ключ")); assertTrue(r.state.hasItem("ключ"))
        assertTrue(r.state.journal.last().contains("Получено: ржавый ключ"))
        assertEquals(1, r.state.timeTick)
        // Реальный случай из прогона с моделью: герой «ищет брата», а модель записала ему меч из своей же сцены.
        assertTrue(RulesEngine.apply(base, listOf(ev(GameEvent.ITEM_ADD, "меч")), "здороваюсь со стражем и говорю, что ищу брата", "Страж поднял меч и кивнул.").applied.isEmpty())
        // Находка при поиске: предмет должен быть в книге для этой сцены.
        val lore = "У трактирного камина Арсений случайно заметил ржавый ключ, который кто-то засунул в щель между камнями."
        assertTrue(RulesEngine.apply(base, listOf(ev(GameEvent.ITEM_ADD, "ржавый ключ")), "осматриваю камин", "Ты замечаешь в щели ржавый ключ.", lore).state.hasItem("ржавый ключ"))
        assertTrue(RulesEngine.apply(base, listOf(ev(GameEvent.ITEM_ADD, "алмаз")), "осматриваю камин", "Ты находишь алмаз.", lore).applied.isEmpty())
        // Не больше одного нового предмета за ход.
        val r2 = RulesEngine.apply(base, listOf(ev(GameEvent.ITEM_ADD, "ключ"), ev(GameEvent.ITEM_ADD, "нож")), "беру ключ и нож", "Ты берёшь ключ и нож.")
        assertEquals(1, r2.applied.size)
    }

    @Test fun cannotLoseWhatYouDoNotHave() {
        val r = RulesEngine.apply(base, listOf(ev(GameEvent.ITEM_REMOVE, "меч")), "отдаю меч Мире", "Мира берёт меч.")
        assertTrue(r.applied.isEmpty()); assertEquals(2, r.state.inventory.size)
        val r2 = RulesEngine.apply(base, listOf(ev(GameEvent.ITEM_REMOVE, "потёртый плащ")), "отдаю плащ Мире", "Мира берёт плащ и улыбается.")
        assertEquals(1, r2.applied.size); assertFalse(r2.state.hasItem("плащ"))
        // Предмет есть, но герой его не отдавал.
        val r3 = RulesEngine.apply(base, listOf(ev(GameEvent.ITEM_REMOVE, "потёртый плащ")), "спрашиваю Миру о дороге", "Мира пожимает плечами.")
        assertTrue(r3.applied.isEmpty())
    }

    @Test fun goldRules() {
        assertTrue(RulesEngine.apply(base, listOf(ev(GameEvent.GOLD, delta = -5)), "плачу пять монет", "Мира берёт монеты.").applied.isEmpty(), "нельзя потратить больше, чем есть")
        val paid = RulesEngine.apply(base, listOf(ev(GameEvent.GOLD, delta = -1)), "заказываю похлёбку и плачу одну монету", "Мира ставит миску.")
        assertEquals(2, paid.state.hero.gold)
        assertTrue(RulesEngine.apply(base, listOf(ev(GameEvent.GOLD, delta = -1)), "смотрю в окно", "За окном темно.").applied.isEmpty(), "монеты не пропадают без оплаты")
        assertTrue(RulesEngine.apply(base, listOf(ev(GameEvent.GOLD, delta = 9)), "смотрю в окно", "За окном темно.").applied.isEmpty(), "монеты не берутся из воздуха")
        assertTrue(RulesEngine.apply(base, listOf(ev(GameEvent.GOLD, delta = 50)), "продаю плащ", "Мира даёт монеты.").applied.isEmpty(), "слишком большая сумма")
        val sold = RulesEngine.apply(base, listOf(ev(GameEvent.GOLD, delta = 2), ev(GameEvent.ITEM_REMOVE, "потёртый плащ")), "продаю плащ Мире", "Мира отсчитывает две монеты и забирает плащ.")
        assertEquals(5, sold.state.hero.gold); assertFalse(sold.state.hasItem("плащ"))
    }

    @Test fun healthRules() {
        assertTrue(RulesEngine.apply(base, listOf(ev(GameEvent.HP, delta = -2)), "спрашиваю о погоде", "Мира улыбается.").applied.isEmpty())
        val hurt = RulesEngine.apply(base, listOf(ev(GameEvent.HP, delta = -2)), "дерусь с пьяным гостем", "Гость бьёт тебя кулаком в плечо.")
        assertEquals(8, hurt.state.hero.hp)
        assertTrue(RulesEngine.apply(base, listOf(ev(GameEvent.HP, delta = -9)), "дерусь", "Удар.").applied.isEmpty(), "диапазон")
        assertTrue(RulesEngine.apply(base, listOf(ev(GameEvent.HP, delta = 2)), "отдыхаю у огня", "Ты отдыхаешь, силы возвращаются.").applied.isEmpty(), "нельзя лечиться выше максимума")
        val healed = RulesEngine.apply(hurt.state, listOf(ev(GameEvent.HP, delta = 3)), "отдыхаю у огня", "Ты отдыхаешь, силы возвращаются.")
        assertEquals(10, healed.state.hero.hp)
        // Ноль здоровья — не тихая смерть, а детерминированное последствие.
        val weak = base.copy(hero = base.hero.copy(hp = 2))
        val down = RulesEngine.apply(weak, listOf(ev(GameEvent.HP, delta = -3)), "бросаюсь в драку", "Тебя сбивают с ног ударом.")
        assertEquals(3, down.state.hero.hp); assertTrue(down.notes.any { it.contains("сознание") })
    }

    @Test fun movementAndLockedDoor() {
        assertTrue(RulesEngine.apply(base, listOf(ev(GameEvent.MOVE, "Северные ворота")), "спрашиваю Миру про ворота", "Мира молчит.").applied.isEmpty(), "без движения герой не перемещается")
        val moved = RulesEngine.apply(base, listOf(ev(GameEvent.MOVE, "Северные ворота")), "выхожу из трактира и иду к северным воротам", "Дорога выводит тебя к воротам.")
        assertEquals("Северные ворота", moved.state.location)
        assertEquals(listOf("Борин"), moved.state.nearbyNpcs().map { it.name })
        // Запертое место: без ключа не пройти.
        val blocked = RulesEngine.apply(moved.state, listOf(ev(GameEvent.MOVE, "Старая башня")), "иду в старую башню", "Ты подходишь к башне.")
        assertEquals("Северные ворота", blocked.state.location)
        assertTrue(blocked.rejected.single().reason.contains("заперт"))
        val withKey = moved.state.copy(inventory = moved.state.inventory + Item("kluch", "ржавый ключ"))
        assertEquals("Северные ворота", RulesEngine.apply(withKey, listOf(ev(GameEvent.MOVE, "Старая башня")), "иду в старую башню", "Ты подходишь к башне.").state.location, "ключ есть, но герой им не воспользовался")
        val opened = RulesEngine.apply(withKey, listOf(ev(GameEvent.MOVE, "Старая башня")), "открываю ржавым ключом дверь и вхожу в старую башню", "Замок щёлкает, и ты входишь в башню.")
        assertEquals("Старая башня", opened.state.location); assertTrue(opened.state.lockedLocations.isEmpty())
        assertTrue(RulesEngine.apply(base, listOf(ev(GameEvent.MOVE, "Луна")), "иду гулять", "Ты выходишь во двор.").applied.isEmpty(), "место не упомянуто")
    }

    @Test fun npcRules() {
        val rel = RulesEngine.apply(base, listOf(ev(GameEvent.RELATION, "Мира", 1)), "благодарю Миру", "Мира улыбается.")
        assertEquals(1, rel.state.findNpc("Мира")!!.relation)
        assertTrue(RulesEngine.apply(base, listOf(ev(GameEvent.RELATION, "Гэндальф", 1)), "благодарю", "Он кивает.").applied.isEmpty(), "несуществующий персонаж")
        assertTrue(RulesEngine.apply(base, listOf(ev(GameEvent.RELATION, "Старик", 1)), "благодарю старика", "Старик кивает.").applied.isEmpty(), "мёртвый персонаж не реагирует")
        assertTrue(RulesEngine.apply(base, listOf(ev(GameEvent.MEET, "Старик")), "зову старика", "Старик выходит из тени.").applied.isEmpty(), "мёртвые не возвращаются")
        assertTrue(RulesEngine.apply(base, listOf(ev(GameEvent.RELATION, "Мира", 7)), "благодарю Миру", "Мира улыбается.").applied.isEmpty(), "диапазон")
        // Гибель персонажа — необратимое решение: нужна и атака, и гибель в сцене.
        assertTrue(RulesEngine.apply(base, listOf(ev(GameEvent.DEAD, "Мира")), "спрашиваю Миру", "Мира отвечает.").applied.isEmpty())
        assertTrue(RulesEngine.apply(base, listOf(ev(GameEvent.DEAD, "Борин")), "убиваю Борина", "Борин падает замертво.").applied.isEmpty(), "Борина нет рядом")
        val killed = RulesEngine.apply(base, listOf(ev(GameEvent.DEAD, "Мира")), "нападаю на Миру с ножом", "Мира падает замертво.")
        assertFalse(killed.state.findNpc("Мира")!!.alive)
        assertTrue(killed.state.nearbyNpcs().isEmpty())
        // В каноне новые персонажи не создаются, в свободной истории — можно.
        assertTrue(RulesEngine.apply(base, listOf(ev(GameEvent.MEET, "Вальтер")), "зову кого-нибудь", "Из темноты выходит Вальтер.").applied.isEmpty())
        val alt = RulesEngine.apply(base.copy(storyMode = "alternate"), listOf(ev(GameEvent.MEET, "Вальтер")), "зову кого-нибудь", "Из темноты выходит Вальтер.")
        assertFalse(alt.state.findNpc("Вальтер")!!.canon)
    }

    @Test fun questsAndUnknownEvents() {
        assertTrue(RulesEngine.apply(base, listOf(ev(GameEvent.QUEST_ADD, "найти брата")), "смотрю в окно", "Темно.").applied.isEmpty())
        val q = RulesEngine.apply(base, listOf(ev(GameEvent.QUEST_ADD, "найти батарею для Борина")), "обещаю Борину найти батарею", "Борин кивает.")
        assertEquals("active", q.state.quests.single().status)
        val done = RulesEngine.apply(q.state, listOf(ev(GameEvent.QUEST_DONE, "найти батарею")), "отдаю батарею", "Борин берёт батарею.")
        assertEquals("done", done.state.quests.single().status)
        assertTrue(RulesEngine.apply(base, listOf(ev("teleport", "Луна"), ev("item_add", "")), "беру", "Пусто.").applied.isEmpty())
        val many = base.copy(quests = (1..6).map { Quest("q$it", "Задание $it") })
        assertTrue(RulesEngine.apply(many, listOf(ev(GameEvent.QUEST_ADD, "ещё одно дело")), "обещаю помочь", "Хорошо.").applied.isEmpty())
    }

    @Test fun preflightConstraints() {
        val lex = EntityExtractor.ITEM_NOUNS
        assertTrue(RulesEngine.constraints(base, "достаю меч и размахиваю им", lex).any { it.contains("меч") })
        assertTrue(RulesEngine.constraints(base, "показываю Мире обрывок карты", lex).isEmpty())
        assertTrue(RulesEngine.constraints(base, "плачу десять монет за комнату", lex).any { it.contains("только 3") })
        assertTrue(RulesEngine.constraints(base, "спрашиваю старика о башне", lex).any { it.contains("мёртв") })
        assertTrue(RulesEngine.constraints(base, "открываю дверь ключом", lex).any { it.contains("ключ") })
        assertEquals(2, RulesEngine.namedCoins("плачу две монеты"))
        assertEquals(3, RulesEngine.namedCoins("отдаю три медные монеты"))
        assertEquals(1, RulesEngine.namedCoins("бросаю монету"))
        assertEquals(null, RulesEngine.namedCoins("иду к воротам"))
    }

    @Test fun playerIntentBecomesEvents() {
        assertEquals(listOf(GameEvent(GameEvent.RELATION, "Мира", 1), GameEvent(GameEvent.QUEST_ADD, "найти пропавших людей")), RulesEngine.intentEvents(base, "благодарю Миру и обещаю ей найти пропавших людей"))
        assertEquals(listOf(GameEvent(GameEvent.RELATION, "Мира", -1)), RulesEngine.intentEvents(base, "угрожаю Мире ножом"))
        assertTrue(RulesEngine.intentEvents(base, "спрашиваю Миру о погоде").isEmpty())
        assertTrue(RulesEngine.intentEvents(base, "благодарю Борина").none { it.name == "Борин" }, "Борина нет рядом")
        val r = RulesEngine.apply(base, RulesEngine.intentEvents(base, "благодарю Миру и обещаю ей найти пропавших людей"), "благодарю Миру и обещаю ей найти пропавших людей", "Она кивает.")
        assertEquals(1, r.state.findNpc("Мира")!!.relation); assertEquals("Найти пропавших людей", r.state.quests.single().title)
    }

    @Test fun placeNamesAreNormalized() {
        assertEquals("Северные ворота", Morph.destination("выхожу из трактира и иду к северным воротам"))
        assertEquals("Старая башня", Morph.destination("иду в старую башню"))
        assertEquals("Башня", Morph.destination("бегу к башне"))
        assertEquals("Мастерская", Morph.destination("спускаюсь в мастерскую под башней"))
        assertEquals("Древняя крепость", Morph.destination("иду в древнюю крепость"))
        assertEquals("Рынок", Morph.destination("иду на рынок"))
        assertEquals("Высокий холм", Morph.destination("поднимаюсь на высокий холм"))
        assertEquals(null, Morph.destination("подхожу к Мире и спрашиваю о брате"))
        assertEquals(null, Morph.destination("смотрю в окно"))
        assertEquals("Северная долина", Morph.placeNominative("Северной долины"))
        assertEquals("Тёмный лес", Morph.placeNominative("тёмного леса"))
    }

    @Test fun stateSerializationRoundTrip() {
        val json = base.toJson()
        assertTrue(json.contains("\"save_version\":1") && json.contains("\"story_mode\"") && json.contains("\"max_hp\"") && json.contains("\"canon_facts\""))
        assertEquals(base, GameState.fromJson(json))
        // Неизвестные поля из будущих версий не ломают загрузку.
        assertEquals(base, GameState.fromJson(json.replaceFirst("{", "{\"future_field\":123,")))
    }
}
