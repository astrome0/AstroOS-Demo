// AstroOS — obecná „vtipná“ aplikace pro podezřelé appky z Obchodu
//
// Jedna obrazovka: emoji, nadpis, volitelný výběr, tlačítko. Po kliknutí se plynule
// plní lišta a pod ní naskakují řádky záznamu, nakonec přijde pointa. Žádné blikání.
// {v} v textech se nahradí zvolenou hodnotou.

import { el } from '../util.js';
import { tx } from '../i18n.js';

export function apkaVtip(c) {
  return (body) => {
    const casy = [];
    const pozdeji = (fn, ms) => { const t = setTimeout(fn, ms); casy.push(t); };
    const v = () => (volba ? volba.value : '');
    const dosad = (t) => t.replaceAll('{v}', v());

    const volba = c.volba
      ? el('select.oa-vyber', {}, ...c.volba.map((o) => el('option', { value: o, text: o })))
      : null;
    const tlacitko = el('button.oa-btn.primary', { text: dosad(c.tlacitko), onclick: start });
    if (volba) volba.onchange = () => { tlacitko.textContent = dosad(c.tlacitko); };

    const vypln = el('div.oa-vt-vypln');
    const lista = el('div.oa-vt-lista', {}, vypln);
    const zaznam = el('div.oa-vt-zaznam');
    const konec = el('div.oa-vt-konec');
    const uvod = el('div.oa-vt-uvod', {},
      el('div.oa-vt-emoji', { text: c.emoji }),
      el('h2', { text: c.nadpis }),
      el('p', { text: c.podnadpis }),
      volba, tlacitko);

    const obal = el('div.oa-vt', {}, uvod, lista, zaznam, konec);
    lista.hidden = true;
    body.append(obal);

    function start() {
      uvod.classList.add('maly');
      tlacitko.disabled = true;
      if (volba) volba.disabled = true;
      konec.replaceChildren();
      zaznam.replaceChildren();
      lista.hidden = false;
      vypln.style.width = '0%';
      const n = c.kroky.length;
      const krok = 1200;
      c.kroky.forEach((t, i) => {
        pozdeji(() => {
          zaznam.append(el('div', {}, '> ', el('span', { text: dosad(t) })));
          vypln.style.width = Math.round(((i + 1) / (n + 1)) * 100) + '%';
        }, i * krok);
      });
      pozdeji(() => {
        vypln.style.width = '100%';
        konec.replaceChildren(
          el('div.oa-vt-emoji', { text: c.konec.emoji }),
          el('h3', { text: dosad(c.konec.nadpis) }),
          el('p', { text: dosad(c.konec.text) }),
          el('button.oa-btn', { text: tx('Znovu', 'Again'), onclick: znovu }));
      }, n * krok + 400);
    }

    function znovu() {
      uvod.classList.remove('maly');
      lista.hidden = true;
      zaznam.replaceChildren();
      konec.replaceChildren();
      tlacitko.disabled = false;
      if (volba) volba.disabled = false;
    }

    return () => casy.forEach(clearTimeout);
  };
}
