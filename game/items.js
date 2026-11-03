// База предметов и 20 видов оружия (ближнего боя нет).
// hold — класс хвата (набор поз и анимаций держания), reload — тип перезарядки.
export const CAT = { WEAPON: 0, AMMO: 1, MED: 2, RESOURCE: 3, FOOD: 4, GEAR: 5, QUEST: 6 };
export const RESOURCES = ['scrap', 'planks', 'electronics', 'tools', 'fuel', 'medicine', 'weapon_parts', 'provisions'];

export const ITEMS = {
	// --- патроны ---
	"ammo_9x18": {"name": "Патроны 9×18", "cat": CAT.AMMO, "stack": 120, "weight": 0.01, "color": [0.75, 0.6, 0.25], "desc": "ПМ, АПС, «Кедр», «Бизон»."},
	"ammo_762x25": {"name": "Патроны 7,62×25", "cat": CAT.AMMO, "stack": 120, "weight": 0.011, "color": [0.72, 0.58, 0.26], "desc": "Для ТТ."},
	"ammo_545": {"name": "Патроны 5,45×39", "cat": CAT.AMMO, "stack": 150, "weight": 0.011, "color": [0.7, 0.5, 0.2], "desc": "АК-74, АКС-74У, РПК-74, АН-94."},
	"ammo_762x39": {"name": "Патроны 7,62×39", "cat": CAT.AMMO, "stack": 120, "weight": 0.016, "color": [0.68, 0.48, 0.22], "desc": "АКМ и СКС."},
	"ammo_9x39": {"name": "Патроны 9×39", "cat": CAT.AMMO, "stack": 100, "weight": 0.023, "color": [0.55, 0.55, 0.3], "desc": "Дозвуковые: АС «Вал» и ВСС «Винторез»."},
	"ammo_762r": {"name": "Патроны 7,62×54R", "cat": CAT.AMMO, "stack": 100, "weight": 0.022, "color": [0.65, 0.45, 0.2], "desc": "СВД, ПКМ, винтовка Мосина."},
	"ammo_12": {"name": "Патроны 12×70", "cat": CAT.AMMO, "stack": 40, "weight": 0.04, "color": [0.7, 0.2, 0.15], "desc": "Картечь: ТОЗ-34, «Сайга-12К»."},
	"ammo_23": {"name": "Патроны 23 мм", "cat": CAT.AMMO, "stack": 20, "weight": 0.2, "color": [0.35, 0.4, 0.3], "desc": "Для КС-23."},
	"ammo_vog": {"name": "Гранаты ВОГ-25", "cat": CAT.AMMO, "stack": 12, "weight": 0.25, "color": [0.35, 0.38, 0.3], "desc": "Для гранатомёта РГ-6."},
	// --- медицина ---
	"bandage": {"name": "Бинт", "cat": CAT.MED, "stack": 10, "weight": 0.05, "color": [0.9, 0.9, 0.85],
		"desc": "Останавливает кровотечение и восстанавливает 20 здоровья.", "heal": 20.0, "use_time": 2.2},
	"medkit": {"name": "Аптечка", "cat": CAT.MED, "stack": 5, "weight": 0.3, "color": [0.85, 0.15, 0.15],
		"desc": "Армейская аптечка. Восстанавливает 60 здоровья.", "heal": 60.0, "use_time": 3.0},
	"antirad": {"name": "Антирад", "cat": CAT.MED, "stack": 5, "weight": 0.1, "color": [0.2, 0.55, 0.85],
		"desc": "Выводит радионуклиды из организма.", "rad": -60.0, "use_time": 1.5},
	"canned": {"name": "Тушёнка", "cat": CAT.FOOD, "stack": 6, "weight": 0.35, "color": [0.55, 0.55, 0.5],
		"desc": "Армейская тушёнка. +10 здоровья, восстанавливает выносливость.", "heal": 10.0, "stamina": 100.0, "use_time": 2.5},
	// --- ресурсы ---
	"scrap": {"name": "Металлолом", "cat": CAT.RESOURCE, "stack": 50, "weight": 0.5, "color": [0.45, 0.35, 0.3], "desc": "Обрезки металла, арматура, листы железа."},
	"planks": {"name": "Доски", "cat": CAT.RESOURCE, "stack": 30, "weight": 1.0, "color": [0.6, 0.45, 0.28], "desc": "Строительный пиломатериал."},
	"electronics": {"name": "Электронные компоненты", "cat": CAT.RESOURCE, "stack": 20, "weight": 0.2, "color": [0.2, 0.55, 0.3], "desc": "Платы, реле, лампы, провода."},
	"tools": {"name": "Инструменты", "cat": CAT.RESOURCE, "stack": 5, "weight": 2.0, "color": [0.75, 0.3, 0.1], "desc": "Набор инструментов. Необходим для ремонта."},
	"fuel": {"name": "Топливо", "cat": CAT.RESOURCE, "stack": 10, "weight": 4.0, "color": [0.2, 0.35, 0.15], "desc": "Канистра дизельного топлива."},
	"medicine": {"name": "Медикаменты", "cat": CAT.RESOURCE, "stack": 20, "weight": 0.2, "color": [0.9, 0.95, 0.95], "desc": "Препараты для медпункта."},
	"weapon_parts": {"name": "Оружейные детали", "cat": CAT.RESOURCE, "stack": 20, "weight": 0.4, "color": [0.3, 0.3, 0.32], "desc": "Затворы, пружины, стволы."},
	"provisions": {"name": "Провизия", "cat": CAT.RESOURCE, "stack": 20, "weight": 0.8, "color": [0.6, 0.5, 0.35], "desc": "Сухпайки и консервы для личного состава."},
	// --- снаряжение ---
	"armor_duty": {"name": "Костюм «Долга» (повр.)", "cat": CAT.GEAR, "stack": 1, "weight": 8.0, "color": [0.5, 0.08, 0.08], "desc": "Повреждённый бронекостюм. Броня 25%.", "armor": 0.25},
	"vest": {"name": "Армейская разгрузка", "cat": CAT.GEAR, "stack": 1, "weight": 1.2, "color": [0.2, 0.22, 0.18], "desc": "4 быстрых слота."},
	"backpack": {"name": "Небольшой рюкзак", "cat": CAT.GEAR, "stack": 1, "weight": 1.0, "color": [0.25, 0.22, 0.17], "desc": "Вместимость 16 ячеек."},
};

export const WEAPONS = {
	"pm": {"name": "ПМ", "ammo": "ammo_9x18", "mag": 8, "dmg": 20.0, "rof": 0.28, "spread": 3.0, "range": 26.0, "auto": false, "hold": "pistol", "reload": "pistol", "reload_time": 1.6, "noise": 30.0, "sound": "shot_pistol", "weight": 0.8,
		"desc": "Пистолет Макарова. Надёжный, но слабый."},
	"aps": {"name": "АПС", "ammo": "ammo_9x18", "mag": 20, "dmg": 20.0, "rof": 0.08, "spread": 4.5, "range": 26.0, "auto": true, "hold": "pistol", "reload": "pistol", "reload_time": 1.8, "noise": 32.0, "sound": "shot_pistol", "weight": 1.2,
		"desc": "Автоматический пистолет Стечкина. Очередь на 20 патронов."},
	"tt": {"name": "ТТ", "ammo": "ammo_762x25", "mag": 8, "dmg": 26.0, "rof": 0.3, "spread": 2.6, "range": 30.0, "auto": false, "hold": "pistol", "reload": "pistol", "reload_time": 1.6, "noise": 34.0, "sound": "shot_pistol", "weight": 0.9,
		"desc": "Пистолет Токарева. Высокая пробивная способность."},
	"aks74u": {"name": "АКС-74У", "ammo": "ammo_545", "mag": 30, "dmg": 24.0, "rof": 0.085, "spread": 4.0, "range": 32.0, "auto": true, "hold": "smg", "reload": "mag", "reload_time": 2.2, "noise": 45.0, "sound": "shot_rifle", "weight": 2.7,
		"desc": "Укороченный автомат. Хорош на ближней дистанции."},
	"bizon": {"name": "ПП-19 «Бизон»", "ammo": "ammo_9x18", "mag": 64, "dmg": 18.0, "rof": 0.085, "spread": 4.2, "range": 28.0, "auto": true, "hold": "smg", "reload": "mag", "reload_time": 2.4, "noise": 36.0, "sound": "shot_smg", "weight": 2.5,
		"desc": "Пистолет-пулемёт со шнековым магазином на 64 патрона."},
	"kedr": {"name": "ПП-91 «Кедр»", "ammo": "ammo_9x18", "mag": 30, "dmg": 17.0, "rof": 0.07, "spread": 4.6, "range": 24.0, "auto": true, "hold": "smg", "reload": "mag", "reload_time": 1.9, "noise": 34.0, "sound": "shot_smg", "weight": 1.6,
		"desc": "Компактный пистолет-пулемёт."},
	"ak74": {"name": "АК-74", "ammo": "ammo_545", "mag": 30, "dmg": 28.0, "rof": 0.1, "spread": 2.6, "range": 42.0, "auto": true, "hold": "rifle", "reload": "mag", "reload_time": 2.3, "noise": 50.0, "sound": "shot_rifle", "weight": 3.6,
		"desc": "Основной автомат бойцов «Долга»."},
	"akm": {"name": "АКМ", "ammo": "ammo_762x39", "mag": 30, "dmg": 33.0, "rof": 0.1, "spread": 3.2, "range": 40.0, "auto": true, "hold": "rifle", "reload": "mag", "reload_time": 2.3, "noise": 52.0, "sound": "shot_rifle", "weight": 3.8,
		"desc": "Автомат Калашникова модернизированный. Мощный патрон 7,62×39."},
	"an94": {"name": "АН-94 «Абакан»", "ammo": "ammo_545", "mag": 30, "dmg": 29.0, "rof": 0.09, "spread": 1.9, "range": 46.0, "auto": true, "hold": "rifle", "reload": "mag", "reload_time": 2.5, "noise": 50.0, "sound": "shot_rifle", "weight": 3.9,
		"desc": "Редкий автомат Никонова. Очень кучный."},
	"val": {"name": "АС «Вал»", "ammo": "ammo_9x39", "mag": 20, "dmg": 34.0, "rof": 0.09, "spread": 2.4, "range": 38.0, "auto": true, "hold": "rifle", "reload": "mag", "reload_time": 2.2, "noise": 14.0, "sound": "shot_silenced", "weight": 2.5,
		"desc": "Бесшумный автомат. Почти не привлекает внимания."},
	"sks": {"name": "СКС", "ammo": "ammo_762x39", "mag": 10, "dmg": 42.0, "rof": 0.35, "spread": 1.4, "range": 52.0, "auto": false, "hold": "rifle", "reload": "clip", "reload_time": 2.6, "noise": 52.0, "sound": "shot_rifle", "weight": 3.9,
		"desc": "Самозарядный карабин Симонова. Заряжается обоймой."},
	"svd": {"name": "СВД", "ammo": "ammo_762r", "mag": 10, "dmg": 90.0, "rof": 0.9, "spread": 0.5, "range": 75.0, "auto": false, "hold": "sniper", "reload": "mag", "reload_time": 2.6, "noise": 65.0, "sound": "shot_sniper", "weight": 4.3,
		"desc": "Снайперская винтовка Драгунова."},
	"vss": {"name": "ВСС «Винторез»", "ammo": "ammo_9x39", "mag": 10, "dmg": 60.0, "rof": 0.3, "spread": 0.8, "range": 60.0, "auto": false, "hold": "sniper", "reload": "mag", "reload_time": 2.4, "noise": 12.0, "sound": "shot_silenced", "weight": 2.6,
		"desc": "Бесшумная снайперская винтовка."},
	"mosin": {"name": "Винтовка Мосина", "ammo": "ammo_762r", "mag": 5, "dmg": 85.0, "rof": 1.2, "spread": 0.7, "range": 70.0, "auto": false, "hold": "sniper", "reload": "clip", "reload_time": 3.0, "noise": 62.0, "sound": "shot_sniper", "weight": 4.0,
		"desc": "Трёхлинейка с оптикой. Затвор перезаряжается после каждого выстрела."},
	"toz34": {"name": "ТОЗ-34", "ammo": "ammo_12", "mag": 2, "dmg": 13.0, "pellets": 8, "rof": 0.35, "spread": 7.0, "range": 18.0, "auto": false, "hold": "shotgun", "reload": "break", "reload_time": 2.4, "noise": 50.0, "sound": "shot_shotgun", "weight": 3.2,
		"desc": "Двуствольное ружьё. Страшно на ближней дистанции."},
	"saiga": {"name": "«Сайга-12К»", "ammo": "ammo_12", "mag": 8, "dmg": 12.0, "pellets": 8, "rof": 0.3, "spread": 6.5, "range": 20.0, "auto": false, "hold": "shotgun", "reload": "mag", "reload_time": 2.5, "noise": 52.0, "sound": "shot_shotgun", "weight": 3.6,
		"desc": "Самозарядный гладкоствольный карабин на базе АК."},
	"ks23": {"name": "КС-23", "ammo": "ammo_23", "mag": 3, "dmg": 24.0, "pellets": 9, "rof": 0.9, "spread": 6.0, "range": 22.0, "auto": false, "hold": "shotgun", "reload": "shells", "reload_time": 3.0, "noise": 60.0, "sound": "shot_shotgun", "weight": 3.9,
		"desc": "Помповый карабин калибра 23 мм."},
	"pkm": {"name": "ПКМ", "ammo": "ammo_762r", "mag": 100, "dmg": 34.0, "rof": 0.09, "spread": 3.4, "range": 48.0, "auto": true, "hold": "mg", "reload": "box", "reload_time": 4.5, "noise": 60.0, "sound": "shot_mg", "weight": 8.0,
		"desc": "Единый пулемёт. Коробка на 100 патронов."},
	"rpk74": {"name": "РПК-74", "ammo": "ammo_545", "mag": 45, "dmg": 29.0, "rof": 0.1, "spread": 2.8, "range": 46.0, "auto": true, "hold": "mg", "reload": "mag", "reload_time": 2.8, "noise": 52.0, "sound": "shot_rifle", "weight": 5.0,
		"desc": "Ручной пулемёт с удлинённым стволом и магазином на 45 патронов."},
	"rg6": {"name": "РГ-6", "ammo": "ammo_vog", "mag": 6, "dmg": 110.0, "rof": 0.6, "spread": 2.0, "range": 40.0, "auto": false, "hold": "launcher", "reload": "drum", "reload_time": 3.6, "noise": 55.0, "sound": "shot_launcher", "weight": 6.2, "explosive": 4.0,
		"desc": "Шестизарядный револьверный гранатомёт. Урон по площади."},
};

for (const id in WEAPONS) {
  const w = WEAPONS[id];
  ITEMS[id] = { name: w.name, cat: CAT.WEAPON, stack: 1, weight: w.weight, color: [0.3, 0.28, 0.25], desc: w.desc };
}
export const item = (id) => ITEMS[id] || { name: id, cat: CAT.RESOURCE, stack: 1, weight: 0, color: [1, 0, 1], desc: '' };
export const itemName = (id) => item(id).name;
export const stackSize = (id) => item(id).stack || 1;
export const isWeapon = (id) => id in WEAPONS;
export const weapon = (id) => WEAPONS[id] || null;
export const weaponSlot = (id) => (WEAPONS[id] ? (WEAPONS[id].hold === 'pistol' ? 1 : 0) : -1);
export const isResource = (id) => item(id).cat === CAT.RESOURCE;
