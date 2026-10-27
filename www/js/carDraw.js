// Машины рисуются кодом в координатах кузова (x вперёд, y вверх, метры).
// Каждое улучшение добавляет видимую деталь, уровень — её размер/количество.
// Детали ставятся по точкам кузова (def.anchors), поэтому подходят всем машинам.
(function () {
  function path(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }

  function shade(hex, amt) {
    if (hex[0] !== '#') return hex;
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, v + amt));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }

  const METAL = '#5a5c5e', DARK = '#2c2d2e', RIVET = '#8a8c8e';

  // --- Колесо: шины и шипы видны по уровню ---
  function drawWheel(ctx, x, y, angle, r, ups) {
    const tires = ups.tires || 0, spikes = ups.spikes || 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const rr = r * (1 + tires * 0.03);
    ctx.fillStyle = '#16161a';
    ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.fill();
    // Протектор: грунтовые шины — крупные грунтозацепы.
    ctx.fillStyle = '#26262a';
    const lugs = 10 + tires * 2;
    for (let i = 0; i < lugs; i++) {
      const a = i / lugs * Math.PI * 2;
      ctx.save(); ctx.rotate(a);
      ctx.fillRect(rr * 0.8, -0.03 - tires * 0.008, rr * 0.2 + tires * 0.02, 0.06 + tires * 0.016);
      ctx.restore();
    }
    // Шипы.
    if (spikes) {
      ctx.fillStyle = '#b8b8b0';
      const n = 6 + spikes * 3;
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2;
        ctx.save(); ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(rr - 0.02, -0.035); ctx.lineTo(rr + 0.08 + spikes * 0.035, 0); ctx.lineTo(rr - 0.02, 0.035);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
    ctx.fillStyle = '#6a6a66';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.52, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#3a3a38';
    ctx.lineWidth = 0.05;
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5); ctx.stroke();
    }
    ctx.fillStyle = '#2a2a28';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.14, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // --- Кузова машин ---
  function sedan(ctx, def, ups) {
    const c = def.color;
    ctx.fillStyle = shade(c, -10);
    path(ctx, def.body); ctx.fill();
    ctx.fillStyle = c;
    path(ctx, def.cabin); ctx.fill();
    ctx.fillStyle = '#2a3a44';
    path(ctx, [[-1.2, 0.45], [-0.4, 0.45], [-0.4, 0.88], [-1.05, 0.88]]); ctx.fill();
    path(ctx, [[-0.3, 0.45], [0.42, 0.45], [0.02, 0.88], [-0.3, 0.88]]); ctx.fill();
    ctx.strokeStyle = 'rgba(220,230,235,0.5)';
    ctx.lineWidth = 0.02;
    ctx.beginPath(); ctx.moveTo(0.1, 0.62); ctx.lineTo(0.25, 0.7); ctx.lineTo(0.18, 0.8); ctx.stroke();
    ctx.strokeStyle = shade(c, -45);
    ctx.lineWidth = 0.035;
    ctx.beginPath(); ctx.moveTo(-0.35, 0.38); ctx.lineTo(-0.35, -0.22); ctx.stroke();
    ctx.fillStyle = shade(c, -60);
    ctx.fillRect(-0.15, 0.18, 0.2, 0.05);
    ctx.fillStyle = 'rgba(110,55,25,0.65)';
    ctx.beginPath(); ctx.ellipse(-1.6, -0.12, 0.28, 0.12, 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(1.2, 0.05, 0.2, 0.08, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8dca0';
    ctx.fillRect(2.02, 0.0, 0.13, 0.13);
    ctx.fillStyle = '#a02020';
    ctx.fillRect(-2.1, 0.08, 0.1, 0.14);
    ctx.fillStyle = '#4a4a48';
    ctx.fillRect(1.95, -0.34, 0.3, 0.12);
    ctx.fillRect(-2.2, -0.34, 0.3, 0.12);
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(def.wheels.rearX, -0.3, 0.45, 0, Math.PI); ctx.fill();
    ctx.beginPath(); ctx.arc(def.wheels.frontX, -0.3, 0.45, 0, Math.PI); ctx.fill();
  }

  // Общие мелочи кузова: фара, стоп-сигнал, бамперы, арки колёс.
  function trims(ctx, def, opt) {
    const A = def.anchors, W = def.wheels;
    ctx.fillStyle = '#e8dca0';
    ctx.fillRect(A.front - 0.14, A.bottom + 0.3, 0.14, 0.14);
    ctx.fillStyle = '#a02020';
    ctx.fillRect(A.rear, A.bottom + 0.35, 0.1, 0.16);
    ctx.fillStyle = opt && opt.bumper || '#3a3a38';
    ctx.fillRect(A.front - 0.2, A.bottom - 0.06, 0.32, 0.16);
    ctx.fillRect(A.rear - 0.1, A.bottom - 0.06, 0.32, 0.16);
    ctx.fillStyle = '#141414';
    ctx.beginPath(); ctx.arc(W.rearX, A.bottom, W.radius * 1.15, 0, Math.PI); ctx.fill();
    ctx.beginPath(); ctx.arc(W.frontX, A.bottom, W.radius * 1.15, 0, Math.PI); ctx.fill();
  }

  function rust(ctx, spots) {
    ctx.fillStyle = 'rgba(110,55,25,0.55)';
    for (const [x, y, rx, ry] of spots) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0.2, 0, Math.PI * 2); ctx.fill(); }
  }

  // Старый внедорожник: угловатый, запаска сзади, багажник-рейлинги.
  function offroad(ctx, def) {
    const c = def.color;
    ctx.fillStyle = shade(c, -12); path(ctx, def.body); ctx.fill();
    ctx.fillStyle = c; path(ctx, def.cabin); ctx.fill();
    ctx.fillStyle = '#26343c';
    path(ctx, [[-1.8, 0.62], [-1.0, 0.62], [-1.0, 1.15], [-1.78, 1.15]]); ctx.fill();
    path(ctx, [[-0.9, 0.62], [-0.05, 0.62], [-0.05, 1.15], [-0.9, 1.15]]); ctx.fill();
    path(ctx, [[0.05, 0.62], [0.55, 0.62], [0.3, 1.15], [0.05, 1.15]]); ctx.fill();
    ctx.strokeStyle = shade(c, -40); ctx.lineWidth = 0.035;
    ctx.beginPath(); ctx.moveTo(-0.95, 0.5); ctx.lineTo(-0.95, -0.25); ctx.moveTo(0.0, 0.5); ctx.lineTo(0.0, -0.25); ctx.stroke();
    ctx.fillStyle = '#2a2a28'; ctx.fillRect(-1.9, 1.3, 2.1, 0.06);           // рейлинги
    ctx.fillStyle = '#16161a'; ctx.beginPath(); ctx.arc(-2.3, 0.15, 0.42, 0, Math.PI * 2); ctx.fill(); // запаска
    ctx.fillStyle = '#5a5a56'; ctx.beginPath(); ctx.arc(-2.3, 0.15, 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(1.3, 0.05, 0.9, 0.08);           // решётка радиатора
    rust(ctx, [[-1.6, -0.1, 0.25, 0.1], [1.5, 0.1, 0.2, 0.08]]);
    trims(ctx, def, { bumper: '#2e2e2c' });
  }

  // Пикап: кабина, открытый кузов с бортами, заводской отвал.
  function pickup(ctx, def) {
    const c = def.color;
    ctx.fillStyle = shade(c, -12); path(ctx, def.body); ctx.fill();
    ctx.fillStyle = c; path(ctx, def.cabin); ctx.fill();
    ctx.fillStyle = '#26343c';
    path(ctx, [[-0.25, 0.6], [0.55, 0.6], [0.6, 1.12], [-0.25, 1.12]]); ctx.fill();
    path(ctx, [[0.65, 0.6], [0.95, 0.6], [0.72, 1.1], [0.65, 1.1]]); ctx.fill();
    ctx.fillStyle = shade(c, -30); ctx.fillRect(-2.45, 0.5, 2.0, 0.28);       // борт кузова
    ctx.strokeStyle = shade(c, -50); ctx.lineWidth = 0.03;
    for (let x = -2.3; x < -0.5; x += 0.35) { ctx.beginPath(); ctx.moveTo(x, 0.5); ctx.lineTo(x, 0.78); ctx.stroke(); }
    ctx.fillStyle = '#3a3a2a'; ctx.fillRect(-2.2, 0.78, 0.5, 0.3); ctx.fillRect(-1.6, 0.78, 0.35, 0.22); // груз
    // Заводской отвал.
    const x = def.anchors.front;
    ctx.fillStyle = '#7a6a2a';
    path(ctx, [[x - 0.1, -0.5], [x + 0.55, -0.6], [x + 0.35, 0.2], [x - 0.1, 0.65]]); ctx.fill();
    ctx.strokeStyle = '#4a4018'; ctx.lineWidth = 0.04;
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x - 0.05, -0.5 + i * 0.28); ctx.lineTo(x + 0.45 - i * 0.05, -0.55 + i * 0.22); ctx.stroke(); }
    rust(ctx, [[-1.9, 0.0, 0.3, 0.1], [0.8, -0.1, 0.2, 0.08]]);
    trims(ctx, def);
  }

  // Инкассаторский броневик: высокий короб, узкие окна-бойницы, мигалка.
  function van(ctx, def) {
    const c = def.color;
    ctx.fillStyle = shade(c, -14); path(ctx, def.body); ctx.fill();
    ctx.fillStyle = c; path(ctx, def.cabin); ctx.fill();
    ctx.fillStyle = shade(c, 12); ctx.fillRect(-2.5, 0.85, 3.4, 0.08);       // полоса
    ctx.fillStyle = '#1a2228';
    path(ctx, [[0.55, 0.85], [1.25, 0.85], [1.12, 1.4], [0.55, 1.4]]); ctx.fill();
    for (const x of [-2.1, -1.4, -0.7]) ctx.fillRect(x, 1.05, 0.4, 0.14);    // окна-бойницы
    ctx.strokeStyle = shade(c, -40); ctx.lineWidth = 0.04;
    ctx.strokeRect(-2.4, -0.2, 1.3, 1.6);                                     // задняя дверь сейфа
    ctx.fillStyle = RIVET;
    for (let x = -2.45; x < 1.3; x += 0.3) { ctx.fillRect(x, 1.48, 0.04, 0.04); ctx.fillRect(x, 0.6, 0.04, 0.04); }
    ctx.fillStyle = '#2a4a8a'; ctx.fillRect(0.2, 1.55, 0.3, 0.12);           // мигалка
    trims(ctx, def, { bumper: '#2a2c2e' });
  }

  // Армейский грузовик: кабина, кузов под тентом с дугами.
  function truck(ctx, def) {
    const c = def.color;
    ctx.fillStyle = shade(c, -12); path(ctx, def.body); ctx.fill();
    ctx.fillStyle = c; path(ctx, def.cabin); ctx.fill();
    ctx.fillStyle = '#1e2a22';
    path(ctx, [[1.6, 0.95], [2.5, 0.95], [2.32, 1.5], [1.6, 1.5]]); ctx.fill();
    // Тент кузова.
    ctx.fillStyle = shade(c, 18);
    ctx.beginPath();
    ctx.moveTo(-3.15, 0.6); ctx.lineTo(-3.15, 1.75); ctx.quadraticCurveTo(-1.1, 2.0, 0.85, 1.75); ctx.lineTo(0.85, 0.6);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = shade(c, -20); ctx.lineWidth = 0.05;
    for (let x = -2.9; x < 0.8; x += 0.75) { ctx.beginPath(); ctx.moveTo(x, 0.6); ctx.lineTo(x, 1.82); ctx.stroke(); }
    ctx.fillStyle = '#e0d8b0'; ctx.font = '0.32px sans-serif';
    ctx.save(); ctx.scale(1, -1); ctx.fillText('★', -1.3, -1.05); ctx.restore();
    ctx.fillStyle = '#2a2a28'; ctx.fillRect(2.65, 0.0, 0.5, 0.45);           // решётка
    trims(ctx, def, { bumper: '#2a2a26' });
  }

  // Рейдерский броневоз: скошенная броня, шипы, черепа-трафареты, выхлоп вверх.
  function raider(ctx, def) {
    const c = def.color;
    ctx.fillStyle = shade(c, -8); path(ctx, def.body); ctx.fill();
    ctx.fillStyle = shade(c, 10); path(ctx, def.cabin); ctx.fill();
    ctx.fillStyle = '#4a4c4e';
    path(ctx, [[-2.85, 0.58], [1.45, 0.58], [1.1, 0.8], [-2.6, 0.8]]); ctx.fill(); // наклонный лист
    ctx.fillStyle = '#121418';
    ctx.fillRect(-1.2, 0.95, 1.1, 0.12); ctx.fillRect(0.0, 0.95, 0.42, 0.12);   // смотровые щели
    ctx.fillStyle = '#b8b0a0';
    for (let x = -2.6; x < 1.2; x += 0.45) { ctx.beginPath(); ctx.moveTo(x, 1.35); ctx.lineTo(x + 0.12, 1.6); ctx.lineTo(x + 0.24, 1.35); ctx.fill(); }
    ctx.fillStyle = '#a02a20';
    ctx.fillRect(-2.5, 0.0, 0.9, 0.06); ctx.fillRect(-2.5, 0.12, 0.6, 0.06);  // полосы
    ctx.fillStyle = '#5a5a58'; ctx.fillRect(-0.6, 1.35, 0.12, 0.6); ctx.fillRect(-0.4, 1.35, 0.12, 0.45); // выхлоп
    ctx.fillStyle = '#d8d0c0'; ctx.beginPath(); ctx.arc(-0.9, 0.25, 0.14, 0, Math.PI * 2); ctx.fill(); // «череп»
    ctx.fillStyle = '#121212'; ctx.fillRect(-0.96, 0.24, 0.04, 0.04); ctx.fillRect(-0.86, 0.24, 0.04, 0.04);
    trims(ctx, def, { bumper: '#5a5c5e' });
  }

  const BODIES = { sedan, offroad, pickup, van, truck, raider };

  // --- Детали улучшений: сначала то, что за кузовом, потом поверх ---
  function behind(ctx, def, ups, t) {
    const A = def.anchors;
    // Пружины подвески видны между кузовом и колёсами.
    if (ups.suspension) {
      ctx.strokeStyle = '#c8a040';
      ctx.lineWidth = 0.04 + ups.suspension * 0.01;
      for (const wx of [def.wheels.rearX, def.wheels.frontX]) {
        ctx.beginPath();
        for (let i = 0; i <= 8; i++) ctx.lineTo(wx + (i % 2 ? 0.1 : -0.1), A.bottom - 0.02 - i * 0.03);
        ctx.stroke();
      }
    }
    // Спойлер-антикрыло сзади.
    if (ups.spoiler) {
      const h = 0.25 + ups.spoiler * 0.08, w = 0.6 + ups.spoiler * 0.15;
      ctx.fillStyle = DARK;
      ctx.fillRect(A.rear + 0.25, A.beltY - 0.02, 0.06, h);
      ctx.fillRect(A.rear + 0.55, A.beltY - 0.02, 0.06, h);
      ctx.fillStyle = ups.spoiler >= 3 ? '#a8302a' : METAL;
      path(ctx, [[A.rear - 0.05, A.beltY + h], [A.rear + w, A.beltY + h + 0.04], [A.rear + w, A.beltY + h + 0.12], [A.rear - 0.05, A.beltY + h + 0.1]]);
      ctx.fill();
    }
    // Багажник на крыше: канистры, бак.
    const roofItems = (ups.roofCan || 0) + (ups.tank >= 3 ? 1 : 0) + (ups.canisters || 0 ? 1 : 0);
    if (roofItems) {
      const [x0, x1] = A.roofX;
      ctx.fillStyle = DARK;
      ctx.fillRect(x0 - 0.1, A.roofY, x1 - x0 + 0.2, 0.05);
      for (let i = 0; i < Math.min(4, roofItems + (ups.roofCan === 2 ? 1 : 0)); i++) {
        const cx = x0 + 0.05 + i * 0.32;
        ctx.fillStyle = i % 2 ? '#3a5a2a' : '#b8302a';
        ctx.fillRect(cx, A.roofY + 0.05, 0.26, 0.36);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(cx, A.roofY + 0.2, 0.26, 0.03);
      }
    }
  }

  function front(ctx, def, ups, t, car) {
    const A = def.anchors;
    // Облегчённый кузов: вырезы в дверях и капоте.
    if (ups.lightBody) {
      ctx.fillStyle = 'rgba(15,15,15,0.75)';
      for (let i = 0; i < ups.lightBody + 1; i++) {
        ctx.beginPath(); ctx.ellipse(-1.5 + i * 0.55, -0.05, 0.13, 0.09, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Броня: стальные листы по борту и на стёклах, заклёпки. Размер — от габаритов кузова.
    if (ups.armor) {
      const n = ups.armor, L = A.front - A.rear, low = A.bottom + 0.05, beltH = A.beltY - low;
      const [rx0, rx1] = A.roofX;
      const plates = [
        [A.rear + L * 0.06, low, L * 0.3, beltH * 0.9],
        [A.rear + L * 0.38, low, L * 0.28, beltH * 0.9],
        [A.rear + L * 0.68, low + beltH * 0.15, L * 0.24, beltH * 0.7],
        [rx0, A.beltY + 0.05, (rx1 - rx0) * 0.45, (A.roofY - A.beltY) * 0.75],
        [rx0 + (rx1 - rx0) * 0.5, A.beltY + 0.05, (rx1 - rx0) * 0.45, (A.roofY - A.beltY) * 0.75],
      ];
      for (let i = 0; i < Math.min(n, plates.length); i++) {
        const [x, y, w, h] = plates[i];
        ctx.fillStyle = 'rgba(70,72,74,0.92)';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = RIVET;
        for (let k = 0; k < 4; k++) ctx.fillRect(x + 0.05 + k * (w - 0.12) / 3, y + h - 0.08, 0.035, 0.035);
      }
      if (n >= 4) {
        ctx.strokeStyle = METAL;
        ctx.lineWidth = 0.03;
        for (let x = rx0; x < rx1; x += 0.12) { ctx.beginPath(); ctx.moveTo(x, A.beltY + 0.07); ctx.lineTo(x + 0.02, A.roofY - 0.1); ctx.stroke(); }
      }
    }
    // Клетка на кабину: трубы по контуру и поперёк.
    if (ups.cage) {
      const [x0, x1] = A.roofX;
      ctx.strokeStyle = '#3c3e40';
      ctx.lineWidth = 0.05 + ups.cage * 0.012;
      ctx.beginPath();
      ctx.moveTo(x0 - 0.25, A.beltY); ctx.lineTo(x0 - 0.1, A.roofY + 0.12); ctx.lineTo(x1 + 0.1, A.roofY + 0.12); ctx.lineTo(x1 + 0.55, A.beltY);
      ctx.stroke();
      const bars = 2 + ups.cage * 2;
      for (let i = 1; i < bars; i++) {
        const x = x0 - 0.1 + (x1 - x0 + 0.2) * i / bars;
        ctx.beginPath(); ctx.moveTo(x, A.roofY + 0.12); ctx.lineTo(x + 0.02, A.beltY); ctx.stroke();
      }
    }
    // Двигатель: воздухозаборник на капоте, растёт с уровнем.
    if (ups.engine) {
      const [h0, h1] = A.hood;
      const w = 0.3 + ups.engine * 0.08, h = 0.06 + ups.engine * 0.025;
      const x = (h0 + h1) / 2 - w / 2;
      ctx.fillStyle = shade(def.color, -30);
      path(ctx, [[x, A.beltY - 0.12], [x + w, A.beltY - 0.12], [x + w - 0.05, A.beltY - 0.12 + h], [x + 0.08, A.beltY - 0.12 + h]]);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.fillRect(x + w - 0.08, A.beltY - 0.1, 0.05, h - 0.03);
    }
    // Турбина: блестящая улитка у капота.
    if (ups.turbo) {
      const [h0] = A.hood;
      ctx.fillStyle = '#9a9a96';
      ctx.beginPath(); ctx.arc(h0 + 0.2, A.beltY - 0.05, 0.1 + ups.turbo * 0.025, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5a5a58';
      ctx.beginPath(); ctx.arc(h0 + 0.2, A.beltY - 0.05, 0.05, 0, Math.PI * 2); ctx.fill();
    }
    // Коробка передач: гоночная полоса по борту.
    if (ups.gearbox) {
      ctx.fillStyle = 'rgba(230,200,90,0.75)';
      for (let i = 0; i < Math.min(3, ups.gearbox); i++) ctx.fillRect(A.rear + 0.2, 0.0 - i * 0.07, A.front - A.rear - 0.4, 0.035);
    }
    // Экономайзер: зелёный фильтр-бочонок под днищем.
    if (ups.economizer) {
      ctx.fillStyle = '#4a7a3a';
      ctx.fillRect(-0.6, A.bottom - 0.12, 0.35 + ups.economizer * 0.08, 0.12);
    }
    // Полный привод: раздатка и передний кардан.
    if (ups.awd) {
      ctx.strokeStyle = '#7a7a76';
      ctx.lineWidth = 0.07;
      ctx.beginPath(); ctx.moveTo(def.wheels.rearX + 0.3, A.bottom - 0.08); ctx.lineTo(def.wheels.frontX - 0.3, A.bottom - 0.08); ctx.stroke();
      ctx.fillStyle = '#8a8a86';
      ctx.fillRect(-0.2, A.bottom - 0.18, 0.4, 0.16);
    }
    // Таран / отвал: от трубы-кенгурятника до клина.
    if (ups.ram) {
      const x = A.front, L = ups.ram;
      ctx.fillStyle = L >= 3 ? '#6a6c6e' : '#4a4c4e';
      if (L === 1) {
        ctx.fillRect(x - 0.05, A.bottom - 0.05, 0.22, 0.55);
        ctx.fillRect(x - 0.05, A.bottom + 0.45, 0.3, 0.06);
      } else {
        const h = 0.6 + L * 0.15, d = 0.25 + L * 0.12;
        path(ctx, [[x - 0.05, A.bottom - 0.15], [x + d, A.bottom - 0.25], [x + d * 0.6, A.bottom + h * 0.5], [x - 0.05, A.bottom + h]]);
        ctx.fill();
        ctx.strokeStyle = '#2a2c2e';
        ctx.lineWidth = 0.03;
        for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x, A.bottom - 0.15 + h * i / 4); ctx.lineTo(x + d * 0.7, A.bottom - 0.2 + h * i / 4 * 0.6); ctx.stroke(); }
      }
    }
    // Нитро: баллон в багажнике и сопло.
    if (ups.nitro) {
      ctx.fillStyle = '#2a5a8a';
      ctx.fillRect(A.rear + 0.2, A.beltY - 0.05, 0.5 + (ups.nitroTank || 0) * 0.1, 0.16);
      ctx.fillStyle = '#9ac8f0';
      ctx.fillRect(A.rear + 0.25, A.beltY - 0.01, 0.08, 0.08);
      ctx.fillStyle = '#5a5a5a';
      ctx.fillRect(A.rear - 0.12, A.bottom + 0.05, 0.14, 0.1);
    }
    // Споросборник: сетка-ковш сзади, светится зелёным.
    if (ups.collector) {
      ctx.strokeStyle = 'rgba(143,208,106,0.85)';
      ctx.lineWidth = 0.03;
      const r = 0.2 + ups.collector * 0.07;
      ctx.beginPath(); ctx.arc(A.rear - 0.1, A.beltY - 0.1, r, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke();
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(A.rear - 0.1, A.beltY - 0.1); ctx.lineTo(A.rear - 0.1 - r, A.beltY - 0.1 + i * r * 0.6); ctx.stroke(); }
    }
    // Сканер: антенна-тарелка, медленно вращается.
    if (ups.scanner) {
      const x = A.roofX[1] - 0.1, y = A.roofY;
      ctx.fillStyle = DARK;
      ctx.fillRect(x - 0.02, y, 0.04, 0.3);
      ctx.save();
      ctx.translate(x, y + 0.32);
      ctx.scale(Math.cos((t || 0) * 2), 1);
      ctx.fillStyle = '#b8bcc0';
      ctx.beginPath(); ctx.ellipse(0, 0, 0.18 + ups.scanner * 0.05, 0.06, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // Прожектор: фары-люстра на крыше.
    if (ups.light) {
      const x0 = A.roofX[0] + 0.1, y = A.roofY + 0.05;
      for (let i = 0; i < ups.light + 1; i++) {
        ctx.fillStyle = DARK;
        ctx.fillRect(x0 + i * 0.28, y, 0.22, 0.16);
        ctx.fillStyle = '#f0e8b0';
        ctx.fillRect(x0 + i * 0.28 + 0.15, y + 0.03, 0.06, 0.1);
      }
    }
  }

  // Рисует машину целиком. car — физическая машина; ups — уровни улучшений.
  function draw(ctx, car, t) {
    const def = car.def, ups = car.ups || {};
    const r = def.wheels.radius;
    const p = car.chassis.getPosition();
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(car.chassis.getAngle());
    behind(ctx, def, ups, t);
    ctx.restore();
    for (const w of [car.rear, car.front]) {
      const wp = w.body.getPosition();
      drawWheel(ctx, wp.x, wp.y, w.body.getAngle(), r, ups);
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(car.chassis.getAngle());
    if (car.nitroOn) {
      const len = 0.8 + Math.random() * 0.5;
      const x = def.anchors.rear;
      const g = ctx.createLinearGradient(x, 0, x - len, 0);
      g.addColorStop(0, 'rgba(120,200,255,0.95)');
      g.addColorStop(0.4, 'rgba(255,170,60,0.8)');
      g.addColorStop(1, 'rgba(255,80,20,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - 0.05, def.anchors.bottom + 0.25); ctx.lineTo(x - len, def.anchors.bottom + 0.1); ctx.lineTo(x - 0.05, def.anchors.bottom);
      ctx.closePath(); ctx.fill();
    }
    (BODIES[def.id] || sedan)(ctx, def, ups);
    front(ctx, def, ups, t, car);
    if (window.Weapons) window.Weapons.drawOnCar(ctx, car, t);
    ctx.restore();
  }

  // Предпросмотр в стабе: машина стоит, колёса по чертежу.
  function preview(ctx, def, ups, t) {
    ctx.save();
    behind(ctx, def, ups, t);
    const W = def.wheels;
    const rest = W.y; // положение колёс на подвеске в покое
    drawWheel(ctx, W.rearX, rest, t * 0.5, W.radius, ups);
    drawWheel(ctx, W.frontX, rest, t * 0.5, W.radius, ups);
    (BODIES[def.id] || sedan)(ctx, def, ups);
    front(ctx, def, ups, t, null);
    if (window.Weapons) window.Weapons.drawOnCar(ctx, { def, ups, weaponState: {} }, t);
    ctx.restore();
  }

  window.CarDraw = { draw, preview, drawWheel, path, shade, BODIES };
})();
