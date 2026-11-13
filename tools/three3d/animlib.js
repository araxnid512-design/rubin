// Библиотека движений людей для 3D-боя → game/models/anim_human.js (DW.ANIM3). Запуск: node tools/three3d/animlib.js
const path = require('path'), fs = require('fs');
const A = path.join(__dirname, '..', 'art3d');
const { open } = require(path.join(A, 'run.js'));
const M = require(path.join(A, 'manifest.js'));
(async () => {
  const { browser, page } = await open();
  const has = (u) => fs.existsSync(path.join(__dirname, '..', '..', u));
  // node tools/three3d/animlib.js [ключи через запятую] — только эти движения, остальные в файле остаются как были
  const ONLY = process.argv[2] ? process.argv[2].split(',') : null;
  const anims = M.HUMAN.concat(M.HUMAN3D || []).filter((a) => (!a.src || has(a.src)) && (!ONLY || ONLY.indexOf(a.key) >= 0));
  const t0 = Date.now();
  let r = await page.evaluate((spec) => BK.animLib(spec), { clipSrc: M.CLIPS, body: M.BODIES[0].src, height: 1.8, anims, weapon: M.WEAPONS[1], ref: M.WEAPONS[1], fps: 20 });
  const out = path.join(__dirname, '..', '..', 'game', 'models', 'anim_human.js');
  if (ONLY && fs.existsSync(out)) {
    const tx = fs.readFileSync(out, 'utf8');
    const old = JSON.parse(tx.slice(tx.indexOf('DW.ANIM3 = ') + 11).replace(/;\s*$/, ''));
    if (JSON.stringify(old.bones) !== JSON.stringify(r.bones)) throw new Error('кости библиотеки не совпадают — нужна полная пересборка');
    Object.assign(old.clips, r.clips); r = old;
  }
  fs.writeFileSync(out, '/* Сгенерировано tools/three3d/animlib.js — движения людей для 3D-боя */\nwindow.DW = window.DW || {};\nDW.ANIM3 = ' + JSON.stringify(r) + ';\n');
  const bad = Object.keys(r.clips).filter((k) => r.clips[k].err);
  console.log('движений:', Object.keys(r.clips).length, 'ошибки:', bad.join(',') || 'нет', Math.round(fs.statSync(out).size / 1024) + ' КБ', (Date.now() - t0) + ' мс');
  await browser.close();
})();
