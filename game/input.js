// Управление: клавиатура/мышь на ПК, виртуальный джойстик и кнопки на телефоне.

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
		const canvasHost = document.getElementById('game');
		canvasHost.addEventListener('mousedown', (e) => { if (e.button === 0 && !this.touchMode) { this.pressed.add('attack'); this.holding.add('attack'); } });
		addEventListener('mouseup', () => { if (!this.touchMode) this.holding.delete('attack'); });
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
		let id = null, ox = 0, oy = 0;
		const R = 56;
		zone.addEventListener('touchstart', (e) => {
			this.touchMode = true;
			const t = e.changedTouches[0];
			id = t.identifier; ox = t.clientX; oy = t.clientY;
			base.style.left = `${ox}px`; base.style.top = `${oy}px`;
			base.classList.add('active');
			e.preventDefault();
		}, { passive: false });
		zone.addEventListener('touchmove', (e) => {
			for (const t of e.changedTouches) {
				if (t.identifier !== id) continue;
				let dx = t.clientX - ox, dy = t.clientY - oy;
				const l = Math.hypot(dx, dy);
				if (l > R) { dx *= R / l; dy *= R / l; }
				knob.style.transform = `translate(${dx}px, ${dy}px)`;
				this.stick = { x: dx / R, y: dy / R };
				this.sync();
			}
			e.preventDefault();
		}, { passive: false });
		const end = (e) => {
			for (const t of e.changedTouches) {
				if (t.identifier !== id) continue;
				id = null;
				this.stick = { x: 0, y: 0 };
				knob.style.transform = '';
				base.classList.remove('active');
				this.sync();
			}
		};
		zone.addEventListener('touchend', end);
		zone.addEventListener('touchcancel', end);
		const button = (elId, action, hold) => {
			const el = document.getElementById(elId);
			el.addEventListener('touchstart', (e) => { this.touchMode = true; this.pressed.add(action); if (hold) this.holding.add(action); el.classList.add('down'); e.preventDefault(); }, { passive: false });
			el.addEventListener('touchend', () => { this.holding.delete(action); el.classList.remove('down'); });
			el.addEventListener('mousedown', (e) => { this.pressed.add(action); e.stopPropagation(); });
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
