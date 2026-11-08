/* Клык — иллюстрации глав. Рисует тот же движок, что и «Пришлого» (game/js/art.js),
   плюс несколько степных фигур: орк, юрта, каменная баба. */
(function () {
  'use strict';
  const R = window.R;
  const P = R.ART.Pic.prototype;
  const f = (n) => Math.round(n * 10) / 10;

  // Орк: сутулый широкоплечий силуэт с клыками. Локальные координаты: ступни на 0, рост около 100.
  P.orc = function (x, b, h, d, o) {
    o = o || {};
    const c = o.c || this.col(d), F = o.flip ? -1 : 1, k = h / 100;
    let s = '<polygon points="-15,-40 -6,-40 -8,0 -19,0"/><polygon points="4,-40 13,-40 17,0 6,0"/>' +
      '<polygon points="-22,-40 -27,-70 -18,-86 10,-91 25,-80 22,-56 14,-40"/>' +
      '<circle cx="16" cy="-93" r="9"/><polygon points="9,-91 27,-93 25,-84 12,-82"/>' +
      '<polygon points="14,-101 18,-110 20,-100"/>' +
      '<polygon points="-24,-78 -31,-50 -27,-33 -20,-35 -22,-52 -16,-74"/>';
    if (o.robe) s += '<polygon points="-24,-80 26,-80 34,0 -32,0" opacity=".92"/>';
    if (o.weapon === 'axe') s += '<polygon points="18,-78 32,-62 36,-48 30,-46 25,-60 14,-70"/><path d="M33,-47L44,-104" stroke="currentColor" stroke-width="3.4"/><path d="M40,-100Q56,-104 58,-86Q48,-90 42,-88Z"/>';
    else if (o.weapon === 'spear') s += '<polygon points="18,-78 32,-62 36,-48 30,-46 25,-60 14,-70"/><path d="M33,-47L38,-140" stroke="currentColor" stroke-width="2.6"/><polygon points="35,-140 38.5,-156 42,-140"/>';
    else if (o.weapon === 'staff') s += '<polygon points="18,-78 30,-64 32,-50 26,-48 23,-60 14,-70"/><path d="M30,-50L32,-128" stroke="currentColor" stroke-width="3"/><circle cx="32" cy="-132" r="5"/>';
    else s += '<polygon points="18,-78 28,-52 26,-34 20,-35 21,-52 14,-70"/>';
    this.add(`<g fill="${c}" color="${c}" transform="translate(${f(x)},${f(b)}) scale(${f(F * k * 100) / 100},${f(k * 100) / 100})">${s}</g>`);
    if (o.tusks !== false && h > 40) this.add(`<g fill="#e9dfc6" opacity=".85" transform="translate(${f(x)},${f(b)}) scale(${f(F * k * 100) / 100},${f(k * 100) / 100})"><polygon points="22,-87 24,-94 25.6,-87"/></g>`);
    if (o.weapon === 'staff') this.light(x + F * 32 * k, b - 132 * k, 26 * k, 0.8);
    return this;
  };

  P.yurt = function (x, b, s, d, o) {
    o = o || {};
    const c = this.col(d), lit = o.lit === undefined ? !!this.p.dark : o.lit;
    const felt = mixFelt(this, c);
    this.add(`<path d="M${f(x - 42 * s)},${b}V${f(b - 26 * s)}Q${f(x)},${f(b - 74 * s)} ${f(x + 42 * s)},${f(b - 26 * s)}V${b}Z" fill="${felt}"/>` +
      `<path d="M${f(x - 42 * s)},${f(b - 26 * s)}Q${f(x)},${f(b - 74 * s)} ${f(x + 42 * s)},${f(b - 26 * s)}" fill="none" stroke="${c}" stroke-width="${f(2 * s)}"/>` +
      `<path d="M${f(x - 42 * s)},${f(b - 14 * s)}H${f(x + 42 * s)}" stroke="${c}" stroke-width="${f(1.4 * s)}" opacity=".7"/>` +
      `<rect x="${f(x - 7 * s)}" y="${f(b - 22 * s)}" width="${f(14 * s)}" height="${f(22 * s)}" fill="${lit ? this.p.light : c}"/>`);
    if (lit) this.light(x, b - 10 * s, 50 * s, 0.5);
    if (o.smoke) this.smoke(x, b - 50 * s, 60 * s);
    if (o.horns) this.add(`<path d="M${f(x + 30 * s)},${f(b - 20 * s)}V${f(b - 86 * s)}" stroke="${c}" stroke-width="${f(2 * s)}"/><path d="M${f(x + 22 * s)},${f(b - 92 * s)}Q${f(x + 30 * s)},${f(b - 80 * s)} ${f(x + 38 * s)},${f(b - 92 * s)}" stroke="${c}" stroke-width="${f(3 * s)}" fill="none"/>`);
    return this;
  };
  function mixFelt(pic, c) { return R.ART.mix(c, '#b9a585', pic.p.dark ? 0.18 : 0.35); }

  P.idol = function (x, b, h, d, glow) { // каменная баба
    const c = this.col(d);
    this.add(`<path d="M${f(x - h * 0.18)},${b}L${f(x - h * 0.16)},${f(b - h * 0.78)}Q${f(x)},${f(b - h * 1.04)} ${f(x + h * 0.16)},${f(b - h * 0.78)}L${f(x + h * 0.18)},${b}Z" fill="${c}"/>` +
      `<path d="M${f(x - h * 0.08)},${f(b - h * 0.78)}h${f(h * 0.05)}M${f(x + h * 0.03)},${f(b - h * 0.78)}h${f(h * 0.05)}M${f(x - h * 0.04)},${f(b - h * 0.66)}h${f(h * 0.08)}M${f(x - h * 0.1)},${f(b - h * 0.45)}q${f(h * 0.1)},${f(h * 0.06)} ${f(h * 0.2)},0" stroke="${glow ? this.p.light : R.ART.mix(c, '#ffffff', 0.18)}" stroke-width="${f(Math.max(1.4, h * 0.02))}" fill="none"${glow ? ` filter="${this.glowF()}"` : ''}/>`);
    return this;
  };

  P.grass = function (y0, y1, n, d) {
    let s = '';
    for (let i = 0; i < n; i++) {
      const y = this.rn(y0, y1), x = this.rn(-10, 810), hh = 6 + ((y - y0) / Math.max(1, y1 - y0)) * 22, l = this.rn(-6, 6);
      s += `M${f(x)},${f(y)}q${f(l * 0.4)},${f(-hh * 0.6)} ${f(l)},${f(-hh)}`;
    }
    return this.add(`<path d="${s}" stroke="${this.col(d)}" stroke-width="1.3" fill="none" opacity=".8"/>`);
  };

  const SC = {};
  const S = (id, title, draw) => { SC[id] = { id, title, draw }; };

  S('o_ravine', 'Овраг', (b) => {
    b.sky('golden').sun(560, 90, 26).birds(5, 420, 110, 90, 0.5, 1.6);
    b.ridge(0.2, 250, 50).cliff(0, 300, 120, 0.6, 'left').cliff(520, 800, 140, 0.65);
    b.ground(0.85, 400).add(`<g fill="${b.col(0.95)}"><ellipse cx="300" cy="420" rx="40" ry="10"/><ellipse cx="520" cy="430" rx="60" ry="12"/></g>`);
    b.add(`<g transform="translate(420,418) rotate(-82)">`).orc(0, 0, 86, 1, { tusks: false }).add('</g>').vignette(0.4);
  });
  S('o_steppe', 'Степь Ашхар', (b) => {
    b.sky('golden').sun(150, 230, 30).clouds(3, 60, 140, 0.35).hills(0.2, 300, 22).hills(0.4, 330, 26);
    b.idol(560, 316, 70, 0.55).hills(0.65, 372, 22).grass(360, 450, 260, 0.75).orc(300, 430, 92, 1, { weapon: 'spear' }).birds(3, 620, 120, 40, 0.7);
  });
  S('o_camp', 'Стойбище Сломанного Рога', (b) => {
    b.sky('dusk').sun(620, 300, 28).hills(0.3, 318, 22);
    for (let i = 0; i < 7; i++) b.yurt(70 + i * 112, 344 + (i % 2) * 6, 0.55, 0.6, { lit: i % 3 === 0 });
    b.yurt(170, 410, 1.3, 0.88, { lit: true, smoke: true, horns: true }).yurt(640, 416, 1.2, 0.9, { lit: true });
    b.ground(0.95, 420).campfire(410, 430, 1.4).orc(330, 446, 90, 1, { weapon: 'axe' }).orc(495, 448, 82, 1, { flip: true }).embers(20, 360, 460, 330, 410);
  });
  S('o_spirits', 'Испытание духов', (b) => {
    b.sky('magic').stars(130, 300).aurora(80, 0.45).hills(0.5, 350, 20);
    b.idol(400, 360, 150, 0.85, true).ground(1, 400).campfire(400, 418, 1.6);
    b.orc(270, 446, 100, 1, { robe: true, weapon: 'staff' }).orc(540, 448, 92, 1, { flip: true }).sparkles(28, 220, 580, 120, 360);
  });
  S('o_ford', 'Верхний Брод', (b) => {
    b.sky('mist').hills(0.25, 300, 20).village(470, 330, 6, 0.6, 0.45, { smoke: true }).church(640, 330, 0.7, 0.45);
    b.river(420, 320, 300, 30, 200).ground(0.8, 380).fog(300, 70, 0.55);
    b.horse(120, 418, 1.1, 1, { c: b.col(1) }).orc(124, 384, 64, 1, { weapon: 'spear' }).horse(220, 430, 1.2, 1).orc(222, 394, 66, 1, { weapon: 'axe' });
  });
  S('o_kurultai', 'Курултай у Чёрного камня', (b) => {
    b.sky('night').stars(140, 260).moon(640, 90, 22).hills(0.4, 330, 20);
    for (let i = 0; i < 9; i++) b.yurt(30 + i * 95, 350, 0.45, 0.6, { lit: i % 2 === 0 });
    b.add(`<polygon points="360,410 372,170 400,140 430,175 446,410" fill="#05060a"/>`).light(400, 400, 260, 0.35);
    b.ground(1, 415).campfire(300, 428, 1.2).campfire(510, 430, 1.2).crowd(80, 260, 450, 70, 1, 4, ['cloak']).crowd(560, 740, 450, 70, 1, 4, ['cloak']).banner(400, 452, 150, 1, '#1a1a1a');
  });
  S('o_whitestone', 'Белый камень', (b) => {
    b.sky('winter').clouds(5, 40, 150, 0.55, '#d3dce4').ridge(0.18, 280, 70).hills(0.3, 320, 18);
    b.army(470, 800, 344, 18, 0.5, 2, { banners: 3, color: '#d8d0b8' }).army(0, 330, 346, 18, 0.55, 2, { banners: 3, color: '#3a2a1a' });
    b.river(400, 330, 400, 12, 120).menhir(400, 410, 150, 0.85).orc(330, 440, 96, 1, { weapon: 'axe' }).snow(80, 0.6);
  });

  R.ORC_ART = {
    has: (id) => !!SC[id] || !!R.ART.byId[id],
    title: (id) => (SC[id] ? SC[id].title : R.ART.byId[id] ? R.ART.byId[id].title : ''),
    render(id) {
      if (!SC[id]) return R.ART.render(id); // сцены «Пришлого» тоже доступны
      const pic = new R.ART.Pic('orc:' + id);
      SC[id].draw(pic);
      return pic.svg();
    },
    ids: Object.keys(SC),
  };
})();
