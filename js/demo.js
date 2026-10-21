// AstroOS — ukázková (veřejná) verze
//
// Plná verze má AI napojenou na lokální model a pár aplikací, které na ní stojí (AstroAI, Jirka,
// Astro Studio). V ukázce zůstaly v nabídkách, ale místo aplikace se otevře „zamčená“ obrazovka.

import { el } from './util.js';

export const UKAZKA = true;

/** Hláška, kterou dostane každá AI funkce (Písmo, Tabulky, Prezentace, Pošta, Editor…). */
export const DEMO_AI = 'AstroAI není v ukázkové verzi AstroOS k dispozici. Plná verze běží na lokálním jazykovém modelu, který tahle ukázka nemá.';

const ZAMCENE = [
  {
    id: 'astroai', name: 'AstroAI', icon: 'ai', color: 'linear-gradient(145deg,#a077f0,#6a43c0)', cat: 'fav',
    co: 'Chatovací asistent s hledáním na webu, obrázky a přemýšlením.',
  },
  {
    id: 'jirka', name: 'Jirka', icon: 'mic', color: 'radial-gradient(circle at 35% 30%,#7cc0ff,#2563eb 55%,#0b1020)', cat: 'tools',
    co: 'Hlasový asistent, který umí ovládat celý systém.',
  },
  {
    id: 'studio', name: 'Astro Studio', icon: 'raketa', color: 'linear-gradient(145deg,#a077f0,#4b2a9a)', cat: 'tools',
    co: 'Vydávání vlastních her do Obchodu, s recenzemi od AI hráčů a konkurenčními studii.',
  },
];

function obrazovka(a, body, win) {
  const kod = 'ERR_DEMO_' + a.id.toUpperCase();
  body.append(el('div.demo-zamek', {},
    el('div.demo-ikona', {},
      el('img', { src: `img/ikony/${a.id}.png`, alt: '', draggable: 'false' }),
      el('div.demo-zamecek', { html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>' })),
    el('div.demo-stitek', { text: 'Ukázková verze' }),
    el('h2', { text: `${a.name} tu není` }),
    el('p', { text: a.co }),
    el('p.demo-proc', { text: 'Tahle aplikace potřebuje AI, která běží jen v plné verzi AstroOS. V ukázce ji vidíš v nabídkách, ale spustit ji nejde.' }),
    el('code.demo-kod', { text: kod }),
    el('div.demo-tlacitka', {},
      el('button.btn.primary', { text: 'Rozumím', onclick: () => win.close() })),
  ));
}

/** Vodoznak vpravo dole na ploše (jako u neaktivovaného Windows), aby bylo vždy jasné, že je to ukázka. */
export function vodoznakUkazky() {
  if (document.querySelector('.demo-vodoznak')) return;
  // Anglicky schválně (i v české verzi) — autorská práva musí pochopit každý.
  document.body.append(el('div.demo-vodoznak', { translate: 'no' },
    el('b', { text: 'AstroOS DEMO' }),
    el('span', { text: 'Not a finished product. AI, Render Pro and more are in the full version only.' }),
    el('small', { text: '© 2026 AstroMeo · All rights reserved · Do not copy or redistribute' })));
}

/** Definice aplikací pro apps.js — stejné id, jméno a ikona jako v plné verzi. */
export const zamceneAplikace = ZAMCENE.map((a) => ({
  id: a.id, name: a.name, icon: a.icon, color: a.color, cat: a.cat,
  width: 560, height: 520, demo: true,
  mount(body, win) { obrazovka(a, body, win); },
}));
