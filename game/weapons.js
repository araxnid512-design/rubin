// Оружие в системе координат хвата (узлы GripR/GripL в модели игрока):
// начало — центр кулака, +Z — в сторону большого пальца (вдоль топорища/рукояти),
// −Y — от запястья к пальцам (куда смотрит лезвие и ствол).

import * as THREE from 'three';

const shadow = (g) => { g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); return g; };

/** Топор: хват у нижнего конца топорища, топорище уходит от большого пальца, лезвие — по пальцам. */
export function makeAxe() {
	const g = new THREE.Group();
	g.name = 'Axe';
	const wood = new THREE.MeshStandardMaterial({ color: 0x7a5432, roughness: 0.75 });
	const steel = new THREE.MeshStandardMaterial({ color: 0x8e959a, roughness: 0.32, metalness: 0.9 });
	const edgeMat = new THREE.MeshStandardMaterial({ color: 0xc8ced2, roughness: 0.2, metalness: 1 });
	const L = 0.62;
	const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.019, L, 10), wood);
	handle.rotation.x = Math.PI / 2;
	handle.position.z = L / 2 - 0.09; // ниже кулака торчит 9 см
	const knob = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), wood);
	knob.position.z = -0.09;
	// обух и щёки топора
	const head = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.07, 0.07), steel);
	head.position.set(0, 0.005, L - 0.12);
	// клин лезвия, расширяется к режущей кромке (по −Y)
	const blade = new THREE.Shape();
	blade.moveTo(-0.035, 0); blade.lineTo(0.035, 0); blade.lineTo(0.06, -0.13); blade.lineTo(-0.055, -0.13); blade.closePath();
	const bladeGeo = new THREE.ExtrudeGeometry(blade, { depth: 0.012, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 1 });
	bladeGeo.translate(0, -0.025, -0.006);
	bladeGeo.rotateY(Math.PI / 2);
	const bladeMesh = new THREE.Mesh(bladeGeo, steel);
	bladeMesh.position.set(0, 0, L - 0.12);
	const edge = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.006, 0.118), edgeMat);
	edge.position.set(0, -0.158, L - 0.12);
	g.add(handle, knob, head, bladeMesh, edge);
	return shadow(g);
}

/** Пистолет Макарова: рукоять через кулак, ствол над большим пальцем смотрит по направлению пальцев. */
export function makePistol() {
	const g = new THREE.Group();
	g.name = 'Pistol';
	const metal = new THREE.MeshStandardMaterial({ color: 0x1e2022, roughness: 0.4, metalness: 0.75 });
	const grip = new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.65 });
	// рукоять чуть наклонена назад, как у ПМ
	const handle = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.032, 0.085), grip);
	handle.position.set(0, 0.004, 0.006);
	handle.rotation.x = -0.18;
	const frame = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.13, 0.022), metal);
	frame.position.set(0, -0.035, 0.052);
	const slide = new THREE.Mesh(new THREE.BoxGeometry(0.027, 0.16, 0.026), metal);
	slide.position.set(0, -0.045, 0.074);
	const guard = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 6, 12, Math.PI), metal);
	guard.rotation.y = Math.PI / 2;
	guard.position.set(0, -0.03, 0.04);
	const mag = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.026, 0.012), metal);
	mag.position.set(0, 0.008, -0.052);
	g.add(handle, frame, slide, guard, mag);
	g.userData.muzzle = new THREE.Vector3(0, -0.128, 0.074);
	return shadow(g);
}
