'use strict';
// ---------- Оружие: находки на вылазках и арсенал базы ----------

const MELEE_W = ['knife', 'bat', 'crowbar', 'axe'];
const RANGED_W = ['pistol', 'shotgun', 'rifle'];
const WKG = { knife: 0.3, bat: 1, crowbar: 1.5, axe: 2, pistol: 1, shotgun: 3, rifle: 3.5 };   // вес в рюкзаке
const WSCRAP = { knife: 0, bat: 1, crowbar: 1, axe: 2, pistol: 3, shotgun: 4, rifle: 5 };      // деталей при разборке
// Где что лежит: [шанс, что может найтись]
const WFIND = {
  gun: [0.45, ['shotgun', 'rifle', 'pistol', 'shotgun']],
  armory: [0.6, ['rifle', 'pistol', 'shotgun', 'rifle']],
  evidence: [0.35, ['pistol', 'pistol', 'shotgun']],
  ration: [0.1, ['rifle', 'pistol']],
  locker: [0.05, ['pistol', 'crowbar', 'bat']],
  toolbox: [0.1, ['axe', 'crowbar']],
  trunk: [0.06, ['bat', 'crowbar', 'pistol']],
  crate: [0.02, ['crowbar', 'axe']],
};
// Что можно снять с убитого
const WDROP = { collector: [0.15, 'bat'], collector_gun: [0.3, 'pistol'], raider: [0.15, 'crowbar'], raider_gun: [0.3, 'shotgun'], soldier: [0.4, 'rifle'] };

function seedWeapons(m, mul = 1) {
  for (const k in m.cont) {
    const c = m.cont[k], f = WFIND[c.k];
    if (f && rnd() < f[0] * mul) c.wpn = pick(f[1]);
  }
}
const contEmpty = c => !c.wpn && !Object.keys(c.loot).length;
function gearW(u) { let w = 0; for (const x of u.found || []) w += WKG[x]; return w; }
function takeWeapon(u, c) {
  if (!c.wpn) return false;
  if (carried(u) + WKG[c.wpn] > u.cap + 1e-6) return false;
  u.found = u.found || [];
  u.found.push(c.wpn);
  delete c.wpn;
  return true;
}
const wName = w => WEAP[w].name;
function wList(ws) {
  const cnt = {};
  for (const w of ws) cnt[w] = (cnt[w] || 0) + 1;
  return Object.keys(cnt).map(w => wName(w).toLowerCase() + (cnt[w] > 1 ? ` ×${cnt[w]}` : '')).join(', ');
}

// ----- арсенал базы -----
function ensureArsenal() { S.arsenal = S.arsenal || {}; }
function stash(w) { if (!w || w === 'knife') return; ensureArsenal(); S.arsenal[w] = (S.arsenal[w] || 0) + 1; }
function unstash(w) { if (!w || w === 'knife') return true; ensureArsenal(); if (!S.arsenal[w]) return false; S.arsenal[w]--; if (!S.arsenal[w]) delete S.arsenal[w]; return true; }
// Сменить оружие выжившему: старое уходит в арсенал
function equip(sid, slot, w) {
  const s = S.survivors.find(o => o.id === sid);
  if (!s) return false;
  const cur = slot === 'melee' ? s.melee : s.ranged;
  if ((w || null) === (cur || null)) return false;
  if (w && !unstash(w)) return false;
  stash(cur);
  if (slot === 'melee') s.melee = w || 'knife'; else s.ranged = w || null;
  return true;
}
function scrapWeapon(w) {
  if (!unstash(w)) return 0;
  const n = WSCRAP[w] + (S.survivors.some(s => s.trait === 'mechanic') ? 1 : 0);
  S.res.parts += n;
  return n;
}
// Выживший погиб на базе: его оружие остаётся
function dropGear(s) { stash(s.melee); stash(s.ranged); }
