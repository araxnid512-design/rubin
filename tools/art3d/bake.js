// Запекание всех наборов: node tools/art3d/bake.js [фильтр через запятую]
// Результат: game/assets3d/<id>_<страница>.webp и game/assets3d/meta.js (DW.A3 — описание кадров).
const fs = require('fs');
const path = require('path');
const { open, saveDataURL, ROOT } = require('./run.js');
const M = require('./manifest.js');
const OUT = path.join(ROOT, 'game', 'assets3d');
const ONLY = process.argv[2] ? process.argv[2].split(',') : null;
const has = (u) => fs.existsSync(path.join(ROOT, u));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const metaFile = path.join(OUT, 'meta.js');
  let meta = { sets: {} };
  if (fs.existsSync(metaFile)) { try { const tx = fs.readFileSync(metaFile, 'utf8'); meta = JSON.parse(tx.slice(tx.indexOf('DW.A3 = ') + 8).replace(/;\s*$/, '')); } catch (e) { console.log('meta.js не прочитан — заново'); } }
  const { browser, page } = await open();
  const jobs = [];
  const canon = M.BODIES[0];
  // движения: основные и редкие (отдельный атлас); без исходника — пропуск
  const okAn = (a) => !a.src || has(a.src);
  const CORE = M.HUMAN.filter((a) => !a.x && okAn(a)), EXTRA = M.HUMAN.filter((a) => a.x && okAn(a));
  for (const b of M.BODIES) {
    let src = b.src;
    if (!has(src) && M.BODY_FALLBACK[b.id] && has(M.BODY_FALLBACK[b.id])) src = M.BODY_FALLBACK[b.id];
    if (!has(src)) { console.log('нет тела', b.id); continue; }
    jobs.push({ id: 'b_' + b.id, spec: { kind: 'human', clipSrc: M.CLIPS, body: src, height: b.h || 1.8, layer: 'body', anims: CORE, weapon: Object.assign({}, M.WEAPONS[1]) } });
    if (EXTRA.length) jobs.push({ id: 'bx_' + b.id, spec: { kind: 'human', clipSrc: M.CLIPS, body: src, height: b.h || 1.8, layer: 'body', anims: EXTRA, weapon: Object.assign({}, M.WEAPONS[1]) } });
    // портрет: голова и плечи вполоборота
    jobs.push({ id: 'h_' + b.id, spec: { kind: 'head', clipSrc: M.CLIPS, body: src, height: b.h || 1.8, clip: 'Idle', t: 0.4 } });
    // крупная фигура для экрана отряда (один кадр, ×4)
    jobs.push({ id: 'f_' + b.id, spec: { kind: 'human', clipSrc: M.CLIPS, body: src, height: b.h || 1.8, layer: 'body', anims: M.FIGURE, dirs: [0], ss: 4, weapon: Object.assign({}, M.WEAPONS[1]) } });
  }
  for (const w of M.WEAPONS) {
    let src = w.src;
    if (!has(src) && M.WEAPON_FALLBACK[w.id] && has(M.WEAPON_FALLBACK[w.id])) src = M.WEAPON_FALLBACK[w.id];
    if (!has(src)) { console.log('нет оружия', w.id); continue; }
    // ref — автомат: руки тел запечены на нём, рукоять любого ствола ставится туда же
    jobs.push({ id: 'w_' + w.id, spec: { kind: 'human', clipSrc: M.CLIPS, body: canon.src, height: 1.8, layer: 'weapon', anims: CORE, weapon: Object.assign({}, w, { src }), ref: M.WEAPONS[1] } });
    if (EXTRA.length) jobs.push({ id: 'wx_' + w.id, spec: { kind: 'human', clipSrc: M.CLIPS, body: canon.src, height: 1.8, layer: 'weapon', anims: EXTRA, weapon: Object.assign({}, w, { src }), ref: M.WEAPONS[1] } });
    jobs.push({ id: 'fw_' + w.id, spec: { kind: 'human', clipSrc: M.CLIPS, body: canon.src, height: 1.8, layer: 'weapon', anims: M.FIGURE, dirs: [0], ss: 4, weapon: Object.assign({}, w, { src }), ref: M.WEAPONS[1] } });
  }
  for (const c of M.CREATURES) {
    if (!has(c.src)) { console.log('нет существа', c.id); continue; }
    jobs.push({ id: 'c_' + c.id, spec: { kind: 'creature', body: c.src, more: c.more && has(c.more) ? c.more : null, height: c.h, layer: 'body', anims: c.anims, box: c.box } });
  }
  for (const p of M.PROPS) {
    const vs = p.variants.filter((v) => has(v.src));
    if (!vs.length) { console.log('нет реквизита', p.id); continue; }
    jobs.push({ id: 'p_' + p.id, type: p.type, spec: { kind: 'prop', variants: vs.map((v) => Object.assign({ ss: 2 }, v)) } });
  }
  for (const j of jobs) {
    if (ONLY && !ONLY.some((o) => j.id.indexOf(o) >= 0)) continue;
    const t0 = Date.now();
    try {
      const r = await page.evaluate((spec) => BK.bakeSet(spec), j.spec);
      const files = [];
      r.pages.forEach((url, i) => { const f = j.id + '_' + i + '.webp'; saveDataURL(path.join(OUT, f), url); files.push(f); });
      const lo = [];
      (r.lo || []).forEach((url, i) => { const f = j.id + '_' + i + '_lo.webp'; saveDataURL(path.join(OUT, f), url); lo.push(f); });
      // старые лишние страницы
      for (let i = r.pages.length; i < 8; i++) { const f = path.join(OUT, j.id + '_' + i + '.webp'); if (fs.existsSync(f)) fs.unlinkSync(f); }
      meta.sets[j.id] = { ss: r.ss, dirs: r.dirs, anims: r.anims, frames: r.frames, pages: files, lo: lo.length ? lo : undefined, type: j.type };
      const kb = files.reduce((a, f) => a + fs.statSync(path.join(OUT, f)).size, 0) / 1024;
      console.log(j.id, files.length + ' стр.', Math.round(kb) + ' КБ', (Date.now() - t0) + ' мс');
    } catch (e) { console.log('ОШИБКА', j.id, String(e).slice(0, 300)); }
  }
  fs.writeFileSync(metaFile, '/* Сгенерировано tools/art3d/bake.js — кадры 3D-спрайтов */\nwindow.DW = window.DW || {};\nDW.A3 = ' + JSON.stringify(meta) + ';\n');
  await browser.close();
})();
