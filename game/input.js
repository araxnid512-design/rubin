// Управление: клавиатура/мышь на ПК, виртуальный джойстик и кнопки на телефоне.
// Кнопки работают на pointer-событиях с захватом указателя: отпускание пальца доходит до кнопки,
// даже если палец съехал с неё, — зажатая атака гарантированно прекращается.

import { toApp } from './screen.js';

export class Input {
	constructor() {
		this.keys = new Set();
		this.pressed = new Set();
		this.holding = new Set();
		this.move = { x: 0, y: 0 };
		this.stick = { x: 0, y: 0 };
		addEventListener('keydown', (e) => {
			if (e.repeat) return;
			this.keys.add(e.code);
			if (['Space', 'KeyJ', 'KeyF'].includes(e.code)) { this.pressed.add('attack'); this.holding.add('attack'); e.preventDefault(); }
			if (['KeyQ', 'Tab', 'Digit1', 'Digit2'].includes(e.code)) { this.pressed.add('switch'); e.preventDefault(); }
			if (e.code === 'KeyR') this.pressed.add('reload');
			this.updateKeys();
		});
		addEventListener('keyup', (e) => {
			this.keys.delete(e.code);
			if (['Space', 'KeyJ', 'KeyF'].includes(e.code)) this.holding.delete('attack');
			this.updateKeys();
		});
		addEventListener('blur', () => { this.keys.clear(); this.holding.clear(); this.updateKeys(); });
		// мышь: атака левой кнопкой по игровому полю
		const canvasHost = document.getElementById('game');
		canvasHost.addEventListener('pointerdown', (e) => {
			if (e.pointerType !== 'mouse' || e.button !== 0) return;
			this.pressed.add('attack'); this.holding.add('attack');
		});
		addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') this.holding.delete('attack'); });
		this.setupTouch();
	}

	updateKeys() {
		const k = this.keys;
		let x = 0, y = 0;
		if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
		if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
		if (k.has('KeyW') || k.has('ArrowUp')) y -= 1;
		if (k.has('KeyS') || k.has('ArrowDown')) y += 1;
		const l = Math.hypot(x, y) || 1;
		this.keyMove = { x: x / l, y: y / l };
		this.sync();
	}

	sync() {
		const km = this.keyMove ?? { x: 0, y: 0 };
		const useStick = Math.hypot(this.stick.x, this.stick.y) > 0.01;
		this.move = useStick ? this.stick : km;
	}

	setupTouch() {
		const zone = document.getElementById('stick-zone');
		const base = document.getElementById('stick-base');
		const knob = document.getElementById('stick-knob');
		let id = null, o = null;
		const R = 56;
		zone.addEventListener('pointerdown', (e) => {
			if (id !== null || e.pointerType === 'mouse') return;
			id = e.pointerId;
			o = toApp(e.clientX, e.clientY);
			zone.setPointerCapture?.(id);
			base.style.left = `${o.x}px`; base.style.top = `${o.y}px`;
			base.classList.add('active');
			e.preventDefault();
		});
		zone.addEventListener('pointermove', (e) => {
			if (e.pointerId !== id) return;
			const p = toApp(e.clientX, e.clientY);
			let dx = p.x - o.x, dy = p.y - o.y;
			const l = Math.hypot(dx, dy);
			if (l > R) { dx *= R / l; dy *= R / l; }
			knob.style.transform = `translate(${dx}px, ${dy}px)`;
			this.stick = { x: dx / R, y: dy / R };
			this.sync();
			e.preventDefault();
		});
		const end = (e) => {
			if (e.pointerId !== id) return;
			id = null;
			this.stick = { x: 0, y: 0 };
			knob.style.transform = '';
			base.classList.remove('active');
			this.sync();
		};
		for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) zone.addEventListener(ev, end);

		const button = (elId, action, hold) => {
			const el = document.getElementById(elId);
			const fingers = new Set();
			el.addEventListener('pointerdown', (e) => {
				e.preventDefault();
				e.stopPropagation();
				if (fingers.has(e.pointerId)) return;
				fingers.add(e.pointerId);
				el.setPointerCapture?.(e.pointerId);
				this.pressed.add(action); // одно нажатие — одно действие
				if (hold) this.holding.add(action);
				el.classList.add('down');
			});
			const release = (e) => {
				if (!fingers.delete(e.pointerId) || fingers.size) return;
				if (hold) this.holding.delete(action); // отпустили — серия сразу прекращается
				el.classList.remove('down');
			};
			for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(ev, release);
			el.addEventListener('contextmenu', (e) => e.preventDefault());
		};
		button('btn-attack', 'attack', true);
		button('btn-weapon', 'switch');
		button('btn-reload', 'reload');
	}

	consume(action) {
		const had = this.pressed.has(action);
		this.pressed.delete(action);
		return had;
	}

	held(action) { return this.holding.has(action); }
}
