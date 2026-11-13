'use strict';
/* Сюжетные главы «Хроники». Только то, что известно о книге (К. Шарапов, «Мёртвый мир. Форт Крут»):
   опыты НИИ открыли переход в мёртвый мир, Портал оказался односторонним; заключённых — воров, бандитов,
   убийц — выбрасывают туда; кто выживет, несёт к Порталу ценное, чтобы протянуть ещё день; Крут, питерский
   авторитет, строит своё поселение. События самой книги добавляются сюда отдельными главами (D.STORY),
   когда их перескажет игрок, — ничего не выдумываем. */
(function (DW) {
  const ST = {};
  // глава: id, заголовок, условие (st → bool), текст, кто говорит (портрет из отряда по имени)
  ST.CHAPTERS = [
    { id: 'landing', t: 'Глава 1. Тюрьма без решёток', when: function () { return true; }, silent: true,
      text: 'Опыты в институте открыли переход в другой мир — пустой, погибший после катастрофы. Обратной дороги нет: Портал работает в одну сторону. Теперь сюда выбрасывают тех, кого не жалко.' },
    { id: 'fort', t: 'Глава 2. Форт Крут', when: function (st) { return st.baseNode !== null; },
      text: 'Крут не собирался бегать по пустоши вечно. Здесь будет своё поселение — стены, склад, крыша над головой. Форт Крут.', who: 'Крут' },
    { id: 'price', t: 'Глава 3. Цена одного дня', when: function (st) { return st.delivered >= 50; },
      text: 'Институт платит только за то, что приносят к Порталу. Кристаллы — это патроны, еда и ещё один день жизни.' },
    { id: 'trust', t: 'Глава 4. Свои люди', when: function () { return DW.G.tier && DW.G.tier() >= 2; },
      text: 'Груз через Портал стал щедрее: в Институте поняли, что с этим отрядом можно иметь дело.' }
  ].concat(DW.D.STORY || []);

  /* проверить новые главы; вернуть массив только что открытых */
  ST.check = function () {
    const st = DW.G.state;
    if (!st) return [];
    st.story = st.story || [];
    const out = [];
    ST.CHAPTERS.forEach(function (c) {
      if (st.story.indexOf(c.id) >= 0) return;
      let ok = false;
      try { ok = c.when(st); } catch (e) { ok = false; }
      if (ok) { st.story.push(c.id); if (!c.silent) { out.push(c); DW.G.log('Хроника: «' + c.t + '».'); } }
    });
    return out;
  };
  /* показать главы по очереди */
  ST.show = async function (list) {
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      const st = DW.G.state;
      const sp = c.who ? st.roster.find(function (s) { return s.name.split(' ')[0] === c.who; }) : null;
      const html = '<div class="story">' + (sp ? '<img class="ava" src="' + DW.ART.portrait(sp) + '" alt="">' : '') + '<div class="stxt">' + c.text + '</div></div>';
      if (DW.Music) DW.Music.sting('victory');
      await DW.UI.alert(c.t, html, 'portal');
    }
  };
  ST.run = async function () { const l = ST.check(); if (l.length) await ST.show(l); };
  /* «Хроника» — список открытых глав */
  ST.open = function () {
    const st = DW.G.state;
    const box = DW.U.el('div', { class: 'chron' });
    ST.CHAPTERS.forEach(function (c) {
      const got = st.story && st.story.indexOf(c.id) >= 0;
      box.appendChild(DW.U.el('div', { class: 'chap' + (got ? '' : ' locked'), html: '<b>' + (got ? c.t : '???') + '</b><div>' + (got ? c.text : 'Глава ещё не открыта.') + '</div>' }));
    });
    DW.UI.modal({ title: 'Хроника', cls: 'wide', body: box });
  };

  DW.Story = ST;
})(window.DW);
