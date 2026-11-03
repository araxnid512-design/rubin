// Смена суток: направление и цвет солнца/луны, окружающий свет неба и земли, туман, цветокоррекция.
import { V3, clamp, smoothstep, lerp } from '../engine/math.js';
import { Game } from './state.js';

const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export class DayNight {
  constructor(r, settings) { this.r = r; this.settings = settings; this.last = -1; this.apply(true); }
  update(dt) {
    const dayLen = Math.max(1, this.settings.dayLength || 24) * 60; // минут реального времени на сутки
    Game.advance(dt / dayLen * 24);
    if (Math.abs(Game.time - this.last) > 0.02) this.apply(false);
  }
  nightK() {
    const h = Game.time, dayK = clamp((h - 5.5) / 15, 0, 1), elev = Math.sin(dayK * Math.PI), isDay = h > 5.5 && h < 20.5;
    return isDay ? 1 - smoothstep(0, 0.18, elev) : 1;
  }
  apply() {
    this.last = Game.time;
    const h = Game.time, dayK = clamp((h - 5.5) / 15, 0, 1), elev = Math.sin(dayK * Math.PI), isDay = h > 5.5 && h < 20.5;
    const dawn = 1 - smoothstep(0, 0.35, elev), nightK = this.nightK(), e = this.r.env;
    if (isDay) {
      const az = (lerp(-100, 100, dayK) + 20) * Math.PI / 180, el = lerp(10, 62, elev) * Math.PI / 180;
      e.sunDir = new V3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).norm();
      const energy = lerp(0.35, 1.2, smoothstep(0, 0.6, elev)) * (1 - nightK * 0.6);
      const col = mix([1, 0.7, 0.48], [1, 0.95, 0.86], smoothstep(0.1, 0.6, elev));
      e.sunCol = col.map((c) => c * energy * 1.05);
    } else {
      e.sunDir = new V3(0.45, 0.75, 0.5).norm();
      e.sunCol = [0.16, 0.2, 0.32];
    }
    const skyDay = [0.38, 0.42, 0.46], skyDawn = [0.36, 0.3, 0.32], skyNight = [0.05, 0.065, 0.11];
    const grDay = [0.24, 0.23, 0.2], grNight = [0.035, 0.04, 0.05];
    e.sky = mix(mix(skyDay, skyDawn, dawn * 0.7), skyNight, nightK);
    e.ground = mix(grDay, grNight, nightK);
    const fogDay = [0.6, 0.61, 0.58], fogDawn = [0.7, 0.55, 0.42], fogNight = [0.05, 0.06, 0.09];
    e.fog = mix(mix(fogDay, fogDawn, dawn * 0.8), fogNight, nightK);
    e.clear = e.fog;
    // цветокоррекция: приглушённая палитра, ночью — холоднее и менее насыщенно
    this.r.grade = [lerp(0.74, 0.55, nightK), 1.06, lerp(1.0, 1.1, nightK), lerp(0.015, -0.035, nightK) + dawn * 0.03 * (1 - nightK)];
  }
}
