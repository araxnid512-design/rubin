// Описания скелетов, в которые сводится риг MakeHuman (163 кости).
//   simple — 19 костей (зомби): Hips/Spine/Chest/..., UpperArm.L, Forearm.L, Hand.L ...
//   mixamo — стандартный скелет Mixamo (герой): 65 костей с теми же именами и иерархией, что у
//            персонажей Mixamo в three.js (mixamorigHips, mixamorigLeftArm, ... — GLTFLoader убирает «:»
//            из «mixamorig:Hips»). Поза покоя — T-поза, оси всех костей совпадают с мировыми, как у X Bot,
//            поэтому анимации Mixamo проигрываются на герое напрямую.
// У simple поза покоя совпадает с позой привязки (руки опущены).

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

// ---------- общее для стандартного рига ----------
export const FINGERS = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];

// кость MakeHuman → стандартная (кости скручивания нет: дальняя часть предплечья — ForeArm, как у Mixamo)
const STANDARD_MH = {
	root: 'Hips', pelvis: 'Hips', spine05: 'Hips', spine04: 'Spine', spine03: 'Spine', spine02: 'Spine1', spine01: 'Spine2', breast: 'Spine2',
	clavicle: 'Shoulder', shoulder01: 'Shoulder', upperarm01: 'Arm', upperarm02: 'Arm', lowerarm01: 'ForeArm', lowerarm02: 'ForeArm',
	wrist: 'Hand', metacarpal1: 'Hand', metacarpal2: 'Hand', metacarpal3: 'Hand', metacarpal4: 'Hand',
	upperleg01: 'UpLeg', upperleg02: 'UpLeg', lowerleg01: 'Leg', lowerleg02: 'Leg', foot: 'Foot',
	neck01: 'Neck', neck02: 'Neck', neck03: 'Neck', head: 'Head', jaw: 'Head',
};
FINGERS.forEach((f, i) => { for (let k = 1; k <= 3; k++) STANDARD_MH[`finger${i + 1}-${k}`] = `Hand${f}${k}`; });

// часть «простого» рига для имени стандартной кости — общая разметка для одежды и текстур
function standardPart(name) {
	if (MIXAMO_CENTER.has(name)) return name === 'Spine1' || name === 'Spine2' ? 'Chest' : name;
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

// ---------- 65 костей: стандарт Mixamo ----------
const MX = 'mixamorig';
const MIXAMO_PARENTS = { Hips: null, Spine: 'Hips', Spine1: 'Spine', Spine2: 'Spine1', Neck: 'Spine2', Head: 'Neck', HeadTop_End: 'Head' };
for (const S of Object.values(SIDES)) {
	Object.assign(MIXAMO_PARENTS, { [`${S}Shoulder`]: 'Spine2', [`${S}Arm`]: `${S}Shoulder`, [`${S}ForeArm`]: `${S}Arm`, [`${S}Hand`]: `${S}ForeArm` });
	for (const f of FINGERS) for (let k = 1; k <= 4; k++) MIXAMO_PARENTS[`${S}Hand${f}${k}`] = k === 1 ? `${S}Hand` : `${S}Hand${f}${k - 1}`;
	Object.assign(MIXAMO_PARENTS, { [`${S}UpLeg`]: 'Hips', [`${S}Leg`]: `${S}UpLeg`, [`${S}Foot`]: `${S}Leg`, [`${S}ToeBase`]: `${S}Foot`, [`${S}Toe_End`]: `${S}ToeBase` });
}
const MIXAMO_CENTER = new Set(['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'HeadTop_End']);
// сустав MakeHuman для каждой кости (голова кости или кончик для концевых костей)
const MIXAMO_JOINT = {
	Hips: 'spine05____head', Spine: 'spine04____head', Spine1: 'spine02____head', Spine2: 'spine01____head',
	Neck: 'neck01____head', Head: 'head____head', HeadTop_End: 'head____tail',
	Shoulder: 'clavicle____head', Arm: 'upperarm01____head', ForeArm: 'lowerarm01____head', Hand: 'wrist____head',
	UpLeg: 'upperleg01____head', Leg: 'lowerleg01____head', Foot: 'foot____head', ToeBase: 'toe3-1____head', Toe_End: 'toe3-3____tail',
};
FINGERS.forEach((f, i) => {
	for (let k = 1; k <= 3; k++) MIXAMO_JOINT[`Hand${f}${k}`] = `finger${i + 1}-${k}____head`;
	MIXAMO_JOINT[`Hand${f}4`] = `finger${i + 1}-3____tail`;
});
const short = (name) => name.startsWith(MX) ? name.slice(MX.length) : name;

export const MIXAMO_RIG = {
	id: 'mixamo',
	prefix: MX,
	root: `${MX}Hips`,
	tPose: true,
	parents: Object.fromEntries(Object.entries(MIXAMO_PARENTS).map(([n, p]) => [MX + n, p && MX + p])),
	names: Object.keys(MIXAMO_PARENTS).map((n) => MX + n),
	center: new Set([...MIXAMO_CENTER].map((n) => MX + n)),
	short,
	bone: (name) => (name.startsWith(MX) ? name : MX + name),
	mhJoint(name) {
		const n = short(name);
		if (MIXAMO_CENTER.has(n)) return MIXAMO_JOINT[n];
		const side = n.startsWith('Left') ? 'L' : 'R';
		const [bone, end] = MIXAMO_JOINT[n.replace(/^(Left|Right)/, '')].split('____');
		return `${bone}.${side}____${end}`;
	},
	mapMH(mhName) {
		const [stem, side] = mhName.split('.');
		const part = stem.startsWith('toe') ? 'ToeBase' : STANDARD_MH[stem];
		if (!part) return null;
		return MX + (MIXAMO_CENTER.has(part) ? part : `${SIDES[side]}${part}`);
	},
	part: (name) => {
		const n = short(name);
		if (n === 'HeadTop_End') return 'Head';
		if (n.endsWith('Toe_End')) return `Foot.${n.startsWith('Left') ? 'L' : 'R'}`;
		return standardPart(n);
	},
	limb: (s) => {
		const S = SIDES[s];
		return { upperArm: `${MX}${S}Arm`, foreArm: `${MX}${S}ForeArm`, hand: `${MX}${S}Hand`, upLeg: `${MX}${S}UpLeg`, leg: `${MX}${S}Leg`, foot: `${MX}${S}Foot` };
	},
	alias: { Hips: `${MX}Hips`, Spine: `${MX}Spine`, Chest: `${MX}Spine1`, Neck: `${MX}Neck`, Head: `${MX}Head`, Jaw: `${MX}Head` },
};

export const RIGS = { simple: SIMPLE_RIG, mixamo: MIXAMO_RIG };
