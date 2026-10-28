// Описания скелетов, в которые сводится риг MakeHuman (163 кости).
//   simple — 19 костей (зомби): Hips/Spine/Chest/..., UpperArm.L, Forearm.L, Hand.L ...
//   full   — 56 костей (герой), по образцу Mixamo: три позвонка, ключицы, кость скручивания
//            предплечья, по 15 костей пальцев на руку, носки стоп.
// У всех костей в позе привязки нет поворотов (оси совпадают с мировыми).

const SIDES = { L: 'Left', R: 'Right' };

// ---------- 19 костей ----------
const SIMPLE_PARENTS = {
	Root: null, Hips: 'Root', Spine: 'Hips', Chest: 'Spine', Neck: 'Chest', Head: 'Neck', Jaw: 'Head',
	'UpperArm.L': 'Chest', 'Forearm.L': 'UpperArm.L', 'Hand.L': 'Forearm.L',
	'UpperArm.R': 'Chest', 'Forearm.R': 'UpperArm.R', 'Hand.R': 'Forearm.R',
	'UpperLeg.L': 'Hips', 'LowerLeg.L': 'UpperLeg.L', 'Foot.L': 'LowerLeg.L',
	'UpperLeg.R': 'Hips', 'LowerLeg.R': 'UpperLeg.R', 'Foot.R': 'LowerLeg.R',
};
const SIMPLE_CENTER = new Set(['Root', 'Hips', 'Spine', 'Chest', 'Neck', 'Head', 'Jaw']);
// кость MakeHuman (без стороны) → наша часть
const SIMPLE_MH = {
	root: 'Hips', pelvis: 'Hips', spine05: 'Hips', spine04: 'Spine', spine03: 'Spine',
	spine02: 'Chest', spine01: 'Chest', clavicle: 'Chest', shoulder01: 'Chest', breast: 'Chest',
	upperarm01: 'UpperArm', upperarm02: 'UpperArm', lowerarm01: 'Forearm', lowerarm02: 'Forearm', wrist: 'Hand',
	upperleg01: 'UpperLeg', upperleg02: 'UpperLeg', lowerleg01: 'LowerLeg', lowerleg02: 'LowerLeg', foot: 'Foot',
	neck01: 'Neck', neck02: 'Neck', neck03: 'Neck', head: 'Head', jaw: 'Jaw',
};
// где стоит наша кость: голова кости MakeHuman
const SIMPLE_HEAD = {
	Hips: 'spine05', Spine: 'spine04', Chest: 'spine02', Neck: 'neck01', Head: 'head', Jaw: 'jaw',
	UpperArm: 'upperarm01', Forearm: 'lowerarm01', Hand: 'wrist', UpperLeg: 'upperleg01', LowerLeg: 'lowerleg01', Foot: 'foot',
};

export const SIMPLE_RIG = {
	id: 'simple',
	parents: SIMPLE_PARENTS,
	names: Object.keys(SIMPLE_PARENTS),
	center: SIMPLE_CENTER,
	mhHead(name) {
		const [stem, side] = name.split('.');
		return side ? `${SIMPLE_HEAD[stem]}.${side}` : SIMPLE_HEAD[stem];
	},
	mapMH(mhName) {
		const [stem, side] = mhName.split('.');
		const part = SIMPLE_MH[stem];
		if (!part) return null;
		return SIMPLE_CENTER.has(part) ? part : `${part}.${side}`;
	},
	part: (name) => name,
	limb: (s) => ({ upperArm: `UpperArm.${s}`, foreArm: `Forearm.${s}`, hand: `Hand.${s}`, upLeg: `UpperLeg.${s}`, leg: `LowerLeg.${s}`, foot: `Foot.${s}` }),
	alias: { Hips: 'Hips', Spine: 'Spine', Chest: 'Chest', Neck: 'Neck', Head: 'Head', Jaw: 'Jaw' },
};

// ---------- 56 костей ----------
export const FINGERS = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];

const FULL_PARENTS = { Root: null, Hips: 'Root', Spine: 'Hips', Spine1: 'Spine', Spine2: 'Spine1', Neck: 'Spine2', Head: 'Neck', Jaw: 'Head' };
for (const S of Object.values(SIDES)) {
	Object.assign(FULL_PARENTS, {
		[`${S}Shoulder`]: 'Spine2', [`${S}Arm`]: `${S}Shoulder`, [`${S}ForeArm`]: `${S}Arm`,
		[`${S}ForeArmTwist`]: `${S}ForeArm`, [`${S}Hand`]: `${S}ForeArmTwist`,
	});
	for (const f of FINGERS) for (let k = 1; k <= 3; k++) FULL_PARENTS[`${S}Hand${f}${k}`] = k === 1 ? `${S}Hand` : `${S}Hand${f}${k - 1}`;
	Object.assign(FULL_PARENTS, { [`${S}UpLeg`]: 'Hips', [`${S}Leg`]: `${S}UpLeg`, [`${S}Foot`]: `${S}Leg`, [`${S}ToeBase`]: `${S}Foot` });
}
const FULL_CENTER = new Set(['Root', 'Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'Jaw']);
const FULL_HEAD = {
	Hips: 'spine05', Spine: 'spine04', Spine1: 'spine02', Spine2: 'spine01', Neck: 'neck01', Head: 'head', Jaw: 'jaw',
	Shoulder: 'clavicle', Arm: 'upperarm01', ForeArm: 'lowerarm01', ForeArmTwist: 'lowerarm02', Hand: 'wrist',
	UpLeg: 'upperleg01', Leg: 'lowerleg01', Foot: 'foot', ToeBase: 'toe3-1',
};
FINGERS.forEach((f, i) => { for (let k = 1; k <= 3; k++) FULL_HEAD[`Hand${f}${k}`] = `finger${i + 1}-${k}`; });

const FULL_MH = {
	root: 'Hips', pelvis: 'Hips', spine05: 'Hips', spine04: 'Spine', spine03: 'Spine', spine02: 'Spine1', spine01: 'Spine2', breast: 'Spine2',
	clavicle: 'Shoulder', shoulder01: 'Shoulder', upperarm01: 'Arm', upperarm02: 'Arm', lowerarm01: 'ForeArm', lowerarm02: 'ForeArmTwist',
	wrist: 'Hand', metacarpal1: 'Hand', metacarpal2: 'Hand', metacarpal3: 'Hand', metacarpal4: 'Hand',
	upperleg01: 'UpLeg', upperleg02: 'UpLeg', lowerleg01: 'Leg', lowerleg02: 'Leg', foot: 'Foot',
	neck01: 'Neck', neck02: 'Neck', neck03: 'Neck', head: 'Head', jaw: 'Jaw',
};
FINGERS.forEach((f, i) => { for (let k = 1; k <= 3; k++) FULL_MH[`finger${i + 1}-${k}`] = `Hand${f}${k}`; });

// часть «простого» рига для имени полной кости — общая разметка для одежды и текстур
function fullPart(name) {
	if (FULL_CENTER.has(name)) return name === 'Spine1' || name === 'Spine2' ? 'Chest' : name;
	const side = name.startsWith('Left') ? 'L' : 'R';
	const p = name.replace(/^(Left|Right)/, '');
	if (p === 'Shoulder') return 'Chest';
	if (p === 'Arm') return `UpperArm.${side}`;
	if (p.startsWith('ForeArm')) return `Forearm.${side}`;
	if (p.startsWith('Hand')) return `Hand.${side}`;
	if (p === 'UpLeg') return `UpperLeg.${side}`;
	if (p === 'Leg') return `LowerLeg.${side}`;
	return `Foot.${side}`;
}

export const FULL_RIG = {
	id: 'full',
	parents: FULL_PARENTS,
	names: Object.keys(FULL_PARENTS),
	center: FULL_CENTER,
	mhHead(name) {
		if (FULL_CENTER.has(name)) return FULL_HEAD[name];
		const side = name.startsWith('Left') ? 'L' : 'R';
		return `${FULL_HEAD[name.replace(/^(Left|Right)/, '')]}.${side}`;
	},
	mapMH(mhName) {
		const [stem, side] = mhName.split('.');
		const part = stem.startsWith('toe') ? 'ToeBase' : FULL_MH[stem];
		if (!part) return null;
		return FULL_CENTER.has(part) ? part : `${SIDES[side]}${part}`;
	},
	part: fullPart,
	limb: (s) => {
		const S = SIDES[s];
		return { upperArm: `${S}Arm`, foreArm: `${S}ForeArm`, hand: `${S}Hand`, upLeg: `${S}UpLeg`, leg: `${S}Leg`, foot: `${S}Foot` };
	},
	alias: { Hips: 'Hips', Spine: 'Spine', Chest: 'Spine1', Neck: 'Neck', Head: 'Head', Jaw: 'Jaw' },
};

export const RIGS = { simple: SIMPLE_RIG, full: FULL_RIG };
