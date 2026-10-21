// AstroOS — aktivace: kódy Product Key, vodoznak, falešný obchod (astro://koupit) a e-maily s licencí
//
// Kód má 25 znaků z abecedy bez dvojznačných písmen (jako u Windows). První znak říká edici,
// poslední je kontrolní součet — vymyšlený kód tak neprojde, koupený ano (i po čisté instalaci).
// Platba je vymyšlená: Astro peněženka se zůstatkem v State, nebo uložená karta AstroBank.
// Žádné skutečné platební údaje se nikde nezadávají.

import { el, sleep, cz } from './util.js';
import { icon, logo } from './icons.js';
import { State } from './state.js';
import { TARIFY, TYDEN, mujTarif, datum as datumDo } from './limit.js';

const ABC = 'BCDFGHJKMPQRTVWXY2346789';

export const EDICE = {
  home: {
    nazev: 'AstroOS Home', znak: 'H', cena: 3490,
    popis: 'Pro domácí počítače, školu a hraní.',
    body: ['Všechny aplikace AstroOS', 'Astro Office (Písmo, Tabulky, Prezentace)', 'Astro Defender', 'AstroAI'],
  },
  pro: {
    nazev: 'AstroOS Pro', znak: 'P', cena: 5990, doporuceno: true,
    popis: 'Pro náročné, vývojáře a lidi, co chtějí mít „Pro“ v názvu.',
    body: ['Všechno z verze Home', 'Editor kódu a vlastní aplikace', 'AstroGPU s ovladači Studio', 'Pocit důležitosti'],
  },
  edu: {
    nazev: 'AstroOS Education', znak: 'K', cena: null,
    popis: 'Jen pro školy. Ověření probíhá přes ředitele.',
    body: ['Všechno z verze Pro', 'Licence pro celou třídu', 'Zakázané hry o přestávce'],
  },
  astro: {
    nazev: 'AstroOS Pro pro pracovní stanice ve vesmíru', znak: 'X', cena: 99999,
    popis: 'Pro raketoplány, vesmírné stanice a velmi drahé počítače.',
    body: ['Všechno z verze Pro', 'Podpora nulové gravitace', 'Hodiny v čase Marsu', 'Tapeta z oběžné dráhy'],
  },
};

// Tarif AI (limit tokenů, limit.js): Free má každý, placené jsou předplatné na 7 dní — edice systému
// na limit vliv nemá. Ceny a tokeny jsou v js/limit.js (TARIFY), tady jen popisy do obchodu.
const POPISY_AI = {
  free: { popis: 'Pro občasné otázky a krátké chaty.',
    body: ['AstroAI, Jirka a AI v aplikacích', 'Astro Studio na pozadí se nepočítá'] },
  plus: { popis: 'Pro dlouhé chaty, hledání na webu a Jirku, co ovládá systém.',
    body: ['5× víc než Free', 'Platí pro celé AstroOS'] },
  max5: { popis: 'Pro masivní psaní: celé dokumenty, Editor kódu, Astro 3D.', doporuceno: true,
    body: ['12,5× víc než Free', 'Na dlouhé úlohy s AI bez čekání'] },
  max20: { popis: 'Pro ty, co AI nechají pracovat celý den.',
    body: ['50× víc než Free', 'Prakticky bez čekání na obnovení'] },
};
// co jde koupit v obchodě: edice systému (licence s kódem) a tarify AI (bez kódu, platí hned 7 dní)
const PRODUKTY = { ...EDICE };
for (const id of ['plus', 'max5', 'max20']) PRODUKTY['ai-' + id] = { ...TARIFY[id], ...POPISY_AI[id], ai: id };

/** Mail, když předplatné AI vyprší (volá js/limit.js). */
export function mailKonecTarifu(tarif) {
  const t = TARIFY[tarif];
  if (!t) return;
  posta({
    od: 'obchod@astroos', odJmeno: 'AstroOS Store',
    predmet: `Předplatné ${t.nazev} skončilo`,
    telo: `Dobrý den, ${State.get('user').name},

vašemu předplatnému ${t.nazev} skončilo 7 dní. Limit AI je teď zase ${TARIFY.free.tokeny.toLocaleString('cs-CZ')} tokenů za 10 minut (AstroAI Free).

Prodloužit nebo koupit jiný tarif můžete v Nově na adrese astro://koupit/ai.

AstroOS Store · AstroMeo Systems`,
  }, 500);
}

// ---------------------------------------------------------------- kódy
const soucet = (s24) => ABC[[...s24].reduce((a, c, i) => a + (i + 1) * ABC.indexOf(c), 0) % ABC.length];
const poPeti = (s) => s.match(/.{1,5}/g)?.join('-') || '';

export function vyrobKlic(edice) {
  let s = EDICE[edice].znak;
  while (s.length < 24) s += ABC[Math.floor(Math.random() * ABC.length)];
  return poPeti(s + soucet(s));
}

/** Platný kód → { edice, klic }, jinak null. */
export function rozeberKlic(text) {
  const c = String(text).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (c.length !== 25 || [...c].some((ch) => !ABC.includes(ch)) || soucet(c.slice(0, 24)) !== c[24]) return null;
  const edice = Object.keys(EDICE).find((k) => EDICE[k].znak === c[0]);
  return edice ? { edice, klic: poPeti(c) } : null;
}

/** Pro vstupní pole: velká písmena a pomlčky po pěti znacích. */
export function formatujPole(input) {
  input.value = poPeti(input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 25));
}

const penize = (n) => n.toLocaleString('cs-CZ') + ' Kč';
const licence = () => State.get('licence') || [];
const zustatek = () => State.get('penezenka') ?? 12000;
const nahodne = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');

function posta(zprava, zpozdeni = 0) {
  setTimeout(() => import('./apps/posta.js').then(({ dorucZpravu }) => dorucZpravu(zprava)).catch(() => {}), zpozdeni);
}

const otevriObchod = () => import('./apps.js').then(({ openApp }) => openApp('browser', { url: 'astro://koupit' }));

// ---------------------------------------------------------------- vodoznak
const HLASKY = [
  'Přejděte do Nastavení a aktivujte AstroOS.',
  'Licenci koupíte v Nově na adrese astro://koupit.',
  'Pořád neaktivováno. Jen říkám. 👀',
  'Tenhle nápis nezmizí, dokud nezaplatíte. 💸',
  'Neaktivovaný systém je jako pizza bez sýra.',
  'AstroMeo Systems vás vidí. (Nevidí.)',
  'Tip: okno přes tenhle nápis nepomůže.',
];
let hlaskyCasovac = null;

/** Vodoznak „Aktivovat AstroOS“ vpravo dole — nad okny, kliky propouští. */
export function vodoznak() {
  if (State.get('aktivovano') !== false || document.querySelector('.aktivace-vodoznak')) return;
  const radek = el('span', { text: HLASKY[0] });
  const w = el('div.aktivace-vodoznak', {}, el('b', { text: 'Aktivovat AstroOS' }), radek);
  document.body.append(w);
  let i = 0;
  clearInterval(hlaskyCasovac);
  hlaskyCasovac = setInterval(() => {
    if (!w.isConnected) { clearInterval(hlaskyCasovac); return; }
    i = (i + 1) % HLASKY.length;
    radek.textContent = HLASKY[i];
  }, 40000);
}

export function skryjVodoznak() {
  clearInterval(hlaskyCasovac);
  document.querySelector('.aktivace-vodoznak')?.remove();
}

// ---------------------------------------------------------------- dialog s kódem
function tlacitko(text, hlavni, onclick) {
  const b = el('button.oobe-btn' + (hlavni ? '.hlavni' : ''), { text });
  b.onclick = () => { if (!b.disabled) onclick(); };
  return b;
}

/** Okno pro zadání kódu Product Key (Nastavení, obchod). */
export function aktivacniDialog() {
  return new Promise((resolve) => {
    const klic = el('input.oobe-pole.oobe-klic', { placeholder: 'XXXXX-XXXXX-XXXXX-XXXXX-XXXXX', maxlength: 29, spellcheck: 'false' });
    const ch = el('div.oobe-chyba');
    const zavri = (ok) => { bg.remove(); resolve(ok); };
    klic.oninput = () => { formatujPole(klic); ch.classList.remove('on'); };

    const ok = tlacitko('Aktivovat', true, async () => {
      const r = rozeberKlic(klic.value);
      ok.disabled = true;
      ok.textContent = 'Ověřuji…';
      await sleep(1800);
      if (!r) {
        ok.disabled = false;
        ok.textContent = 'Aktivovat';
        ch.textContent = 'Tento kód Product Key nefunguje. Zkontrolujte ho a zkuste to znovu, nebo si kupte nový.';
        ch.classList.add('on');
        return;
      }
      aktivuj(r);
      zavri(true);
    });
    klic.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') ok.click(); if (e.key === 'Escape') zavri(false); };

    const bg = el('div.oobe.oobe-dialog-bg.samostatny', {},
      el('div.oobe-dialog', {},
        el('h3', { text: 'Zadejte kód Product Key' }),
        el('p', { text: 'Kód najdete v e-mailu z AstroOS Store. Má 25 znaků.' }),
        klic, ch,
        el('div.oobe-dialog-tl', {},
          el('button.oobe-odkaz', { text: 'Koupit AstroOS', style: { marginRight: 'auto' }, onclick: () => { zavri(false); otevriObchod(); } }),
          ok, tlacitko('Zrušit', false, () => zavri(false))),
      ),
    );
    document.body.append(bg);
    setTimeout(() => klic.focus(), 50);
  });
}

/** Odebere licenci z tohoto počítače — vodoznak se vrátí a kód je potřeba zadat znovu ručně. */
export function deaktivuj() {
  const klic = State.get('produktKlic');
  State.patch({ aktivovano: false, produktKlic: null });
  if (!document.getElementById('desktop')?.classList.contains('hidden')) vodoznak();
  import('./ui.js').then(({ toast }) => toast({ title: 'AstroOS není aktivovaný', body: 'Licence byla z tohoto počítače odebrána. Kód najdeš v Poště.', icon: 'key' }));
  posta({
    od: 'licence@astroos', odJmeno: 'Licenční oddělení AstroOS',
    predmet: 'Licence odebrána z počítače',
    telo: `Dobrý den, ${State.get('user').name},

z počítače ${State.get('jmenoPc') || 'astro'} byla odebrána licence`
      + (klic ? ` s kódem ${klic.slice(0, 5)}-•••••-•••••-•••••-${klic.slice(-5)}` : '')
      + `.

Kód zůstává platný — znovu ho zadáte v Nastavení → Systém → Aktivace. Celý kód najdete v e-mailu „Váš kód Product Key“.

Licenční oddělení AstroMeo Systems`,
  }, 2500);
}

function aktivuj({ edice, klic }) {
  State.patch({ aktivovano: true, produktKlic: klic, edice });
  skryjVodoznak();
  import('./ui.js').then(({ toast }) => toast({ title: 'AstroOS je aktivovaný', body: `${EDICE[edice].nazev} — děkujeme, že používáte originální AstroOS.`, icon: 'shield' }));
  const u = State.get('user');
  posta({
    od: 'licence@astroos', odJmeno: 'Licenční oddělení AstroOS',
    predmet: 'AstroOS je aktivovaný ✓',
    telo: `Dobrý den, ${u.name},\n\nváš systém je teď aktivovaný. Vodoznak zmizel a už se nevrátí `
      + `(pokud nepřeinstalujete systém a nezapomenete kód).\n\nEdice: ${EDICE[edice].nazev}\n`
      + `Kód: ${klic.slice(0, 5)}-•••••-•••••-•••••-${klic.slice(-5)}\nPočítač: ${State.get('jmenoPc') || 'astro'}\n`
      + `Aktivováno: ${cz.datumKratky(new Date())}\n\nUžijte si originální AstroOS!\n\nLicenční oddělení AstroMeo Systems`,
  }, 3000);
}

// ---------------------------------------------------------------- obchod astro://koupit
/** Stránka obchodu pro Novu. Vrací uzel; kroky (výběr → pokladna → hotovo) se mění uvnitř. */
export function strankaKoupit(arg = {}) {
  const root = el('div.ak');
  const ukaz = (...uzly) => { root.replaceChildren(...uzly.filter(Boolean)); root.closest('.nb-obsah')?.scrollTo(0, 0); };

  const hlava = () => el('div.ak-hlava', {},
    logo('ak-logo'), el('b', { text: 'AstroOS Store' }),
    el('span.ak-hlava-zust', {}, icon('box'), 'Astro peněženka: ', el('b', { text: penize(zustatek()) })),
  );
  const pata = () => el('div.ak-pata', { text: 'Ukázkový obchod uvnitř AstroOS · Nic se doopravdy neplatí a žádné údaje se nikam neposílají · © 2026 AstroMeo Systems' });

  // --- 1. výběr edice ---
  function vyber() {
    const aktivni = State.get('aktivovano') !== false && State.get('produktKlic');
    const karty = Object.entries(EDICE).map(([id, e]) => el('div.ak-karta' + (e.doporuceno ? '.doporuceno' : ''), {},
      e.doporuceno ? el('div.ak-stitek', { text: 'Nejprodávanější' }) : null,
      el('h3', { text: e.nazev }),
      el('p.ak-popis', { text: e.popis }),
      el('div.ak-cena', { text: e.cena ? penize(e.cena) : 'Jen pro školy' }),
      el('ul', {}, ...e.body.map((b) => el('li', {}, icon('check'), b))),
      e.cena
        ? el('button.ak-btn.hlavni', { text: 'Koupit', onclick: () => pokladna(id) })
        : el('button.ak-btn', { text: 'Ověřit školu', onclick: (ev) => { ev.currentTarget.textContent = 'Ředitel neodpovídá…'; ev.currentTarget.disabled = true; } }),
    ));
    ukaz(hlava(),
      el('div.ak-hero', {},
        el('h1', { text: 'Kupte si AstroOS' }),
        el('p', { text: aktivni
          ? `Tenhle počítač už je aktivovaný (${EDICE[State.get('edice')]?.nazev || 'AstroOS'}). Další licence se hodí na druhý počítač… nebo jen tak.`
          : 'Tenhle počítač není aktivovaný. Vyberte edici, zaplaťte a kód Product Key vám přijde do Pošty.' }),
      ),
      el('div.ak-karty', {}, ...karty),
      sekceAI(),
      licence().length ? el('div.ak-moje', {},
        el('h4', { text: 'Vaše licence' }),
        ...licence().slice().reverse().map((l) => el('div.ak-moje-r', {},
          el('span', { text: EDICE[l.edice]?.nazev }), el('code', { text: l.klic }), el('small', { text: `${l.objednavka} · ${cz.datumKratky(new Date(l.cas))}` }))),
      ) : null,
      pata());
  }

  // tarify AI: Free (má každý), Plus, Max 5×, Max 20× — týdenní předplatné, limit tokenů celého AstroOS
  function sekceAI() {
    const mam = mujTarif();
    const doKdy = State.get('aiTarifDo');
    const cislo = (n) => n.toLocaleString('cs-CZ');
    const karta = (id) => {
      const t = TARIFY[id], d = POPISY_AI[id];
      const tlacitko = id === 'free'
        ? el('button.ak-btn', { text: mam === 'free' ? 'Používáš' : 'Vždy v ceně', disabled: true })
        : el('button.ak-btn' + (id === mam || d.doporuceno ? '.hlavni' : ''), {
          text: id === mam ? 'Prodloužit o 7 dní' : mam === 'free' ? `Koupit ${t.kratce}` : `Přejít na ${t.kratce}`,
          onclick: () => pokladna('ai-' + id),
        });
      return el('div.ak-karta' + (d.doporuceno ? '.doporuceno' : ''), {},
        id === mam ? el('div.ak-stitek', { text: id === 'free' ? 'Tvůj tarif' : `Tvůj tarif · do ${datumDo(doKdy)}` })
          : d.doporuceno ? el('div.ak-stitek', { text: 'Pro masivní psaní' }) : null,
        el('h3', { text: t.nazev }),
        el('p.ak-popis', { text: d.popis }),
        el('div.ak-cena', {}, t.cena ? penize(t.cena) : 'Zdarma', t.cena ? el('small', { text: ' / 7 dní' }) : null),
        el('ul', {}, el('li', {}, icon('check'), el('b', { text: `${cislo(t.tokeny)} tokenů` }), ' za 10 minut'),
          ...d.body.map((b) => el('li', {}, icon('check'), b))),
        tlacitko);
    };
    // ceník: přehled všech tarifů na jednom místě
    const radky = ['free', 'plus', 'max5', 'max20'].map((id) => {
      const t = TARIFY[id];
      return el('tr' + (id === mam ? '.ak-cenik-muj' : ''), {},
        el('td', {}, el('b', { text: t.nazev })),
        el('td', { text: `${cislo(t.tokeny)}` }),
        el('td', { text: id === 'free' ? '—' : `${(Math.round(t.tokeny / TARIFY.free.tokeny * 10) / 10).toLocaleString('cs-CZ')}×` }),
        el('td', { text: t.cena ? `${penize(t.cena)} / 7 dní` : 'zdarma' }),
        el('td', { text: t.cena ? `${penize(Math.round(t.cena / 7))} / den` : '—' }));
    });
    return el('div.ak-ai', { id: 'ak-ai' },
      el('div.ak-hero', {},
        el('h1', { text: 'Tarif AI' }),
        el('p', { text: 'Kolik tokenů za 10 minut smí spotřebovat AstroAI, Jirka a AI v aplikacích. Placené tarify jsou '
          + 'předplatné na 7 dní, pak se vrátí Free. '
          + (mam === 'free' ? `Teď máš Free — ${cislo(TARIFY.free.tokeny)} tokenů za 10 minut.`
            : `Teď máš ${TARIFY[mam].nazev} do ${datumDo(doKdy)}.`) })),
      el('div.ak-karty.ak-karty-ai', {}, ...['free', 'plus', 'max5', 'max20'].map(karta)),
      el('div.ak-cenik', {},
        el('h4', { text: 'Ceník' }),
        el('table', {},
          el('thead', {}, el('tr', {}, ...['Tarif', 'Tokenů za 10 min', 'Oproti Free', 'Cena', 'Na den'].map((h) => el('th', { text: h })))),
          el('tbody', {}, ...radky)),
        el('p', { text: 'Koupíš-li znovu tarif, který máš, prodlouží se o dalších 7 dní. Jiný tarif platí hned 7 dní od nákupu '
          + 'a nahradí ten dosavadní. Nic se neplatí doopravdy — jen z Astro peněženky nebo testovací karty.' })));
  }

  // --- 2. pokladna ---
  function pokladna(id) {
    const e = PRODUKTY[id];
    const u = State.get('user');
    const bez = Math.round(e.cena / 1.21);
    let metoda = zustatek() >= e.cena ? 'penezenka' : 'karta';

    const jmeno = el('input.ak-pole', { value: [u.name, u.prijmeni].filter(Boolean).join(' ') });
    const email = el('input.ak-pole', { value: u.email || `${(u.name || 'uzivatel').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}@astroos` });
    [jmeno, email].forEach((i) => { i.onkeydown = (ev) => ev.stopPropagation(); });
    const souhlas = el('input', { type: 'checkbox' });
    const chyba = el('div.ak-chyba');

    const volba = (kod, ikona, nazev, pod, zakazano) => {
      const r = el('label.ak-metoda' + (metoda === kod ? '.on' : '') + (zakazano ? '.zakazano' : ''), {},
        el('input', { type: 'radio', name: 'ak-platba', checked: metoda === kod || null, disabled: zakazano || null }),
        el('div.ak-metoda-ic', {}, icon(ikona)),
        el('div', {}, el('b', { text: nazev }), el('small', { text: pod })));
      r.onclick = () => {
        if (zakazano) return;
        metoda = kod;
        r.parentNode.querySelectorAll('.ak-metoda').forEach((x) => x.classList.toggle('on', x === r));
      };
      return r;
    };

    const zaplatit = el('button.ak-btn.hlavni.velke', { text: `Zaplatit ${penize(e.cena)}` });
    zaplatit.onclick = async () => {
      chyba.textContent = '';
      if (!jmeno.value.trim()) { chyba.textContent = 'Vyplňte jméno.'; return; }
      if (!/^[^\s@]+@[^\s@]+$/.test(email.value.trim())) { chyba.textContent = e.ai ? 'Vyplňte e-mail pro účtenku.' : 'Vyplňte e-mail, kam má přijít kód.'; return; }
      if (!souhlas.checked) { chyba.textContent = 'Potvrďte obchodní podmínky.'; return; }
      zaplatit.disabled = true;
      const vysledek = await zaplat(e, metoda, root);
      zaplatit.disabled = false;
      if (!vysledek.ok) { chyba.textContent = vysledek.chyba; return; }
      hotovo(id, { jmeno: jmeno.value.trim(), email: email.value.trim(), metoda: vysledek.popis, transakce: vysledek.transakce });
    };

    ukaz(hlava(),
      el('button.ak-zpet', { onclick: vyber }, icon('chevronLeft'), 'Zpět na výběr'),
      el('div.ak-pokladna', {},
        el('div.ak-sloupec', {},
          el('h2', { text: 'Pokladna' }),
          el('h4', { text: 'Kontaktní údaje' }),
          el('label.ak-l', {}, el('span', { text: 'Jméno a příjmení' }), jmeno),
          el('label.ak-l', {}, el('span', { text: e.ai ? 'E-mail pro účtenku' : 'E-mail pro kód Product Key' }), email),
          el('h4', { text: 'Způsob platby' }),
          el('div.ak-metody', {},
            volba('penezenka', 'box', 'Astro peněženka', `Zůstatek ${penize(zustatek())}`, zustatek() < e.cena),
            volba('karta', 'key', 'AstroBank Visa •••• 4242', 'Uložená karta · platnost 12/29 · ověření v aplikaci banky'),
          ),
          el('label.ak-souhlas', {}, souhlas, el('span', { text: 'Souhlasím s obchodními podmínkami AstroOS Store a beru na vědomí, že digitální licenci nelze vrátit (ani když se vám nelíbí tapety).' })),
          chyba,
          zaplatit,
        ),
        el('div.ak-souhrn', {},
          el('h4', { text: 'Souhrn objednávky' }),
          el('div.ak-polozka', {}, logo('ak-logo-m'), el('div', {}, el('b', { text: e.nazev }), el('small', { text: e.ai ? `Tarif AI · ${e.tokeny.toLocaleString('cs-CZ')} tokenů / 10 min · 7 dní` : 'Digitální licence · 1 zařízení' }))),
          el('div.ak-r', {}, el('span', { text: 'Cena bez DPH' }), el('span', { text: penize(bez) })),
          el('div.ak-r', {}, el('span', { text: 'DPH 21 %' }), el('span', { text: penize(e.cena - bez) })),
          el('div.ak-r', {}, el('span', { text: 'Doprava' }), el('span', { text: 'zdarma (e-mailem)' })),
          el('div.ak-r.celkem', {}, el('span', { text: 'Celkem' }), el('span', { text: penize(e.cena) })),
        ),
      ),
      pata());
  }

  // --- 3. hotovo ---
  function hotovo(id, o) {
    const e = PRODUKTY[id];
    const obj = `AOS-2026-${nahodne(6)}`;
    if (e.ai) {
      const prodlouzit = mujTarif() === e.ai;
      const doKdy = (prodlouzit ? State.get('aiTarifDo') : Date.now()) + TYDEN;
      State.patch({ aiTarif: e.ai, aiTarifDo: doKdy });   // js/limit.js to pošle serveru → nový limit
      posliEmaily({ e, obj, klic: null, ted: new Date(), doKdy, ...o });
      import('./ui.js').then(({ toast }) => toast({ title: `${e.nazev} je aktivní`, body: `${e.tokeny.toLocaleString('cs-CZ')} tokenů za 10 minut, do ${datumDo(doKdy)}.`, icon: 'blesk' }));
      ukaz(hlava(),
        el('div.ak-hotovo', {},
          el('div.ak-hotovo-ic', {}, icon('check')),
          el('h1', { text: prodlouzit ? `${e.nazev} prodloužen!` : `${e.nazev} je aktivní!` }),
          el('p', { text: `Objednávka ${obj} je zaplacená. Limit AI pro celé AstroOS je teď ${e.tokeny.toLocaleString('cs-CZ')} tokenů `
            + `za 10 minut a platí do ${datumDo(doKdy)}. Účtenka přijde do Pošty na ${o.email}.` }),
          el('div.ak-hotovo-tl', {},
            el('button.ak-btn.hlavni', { onclick: () => import('./apps.js').then(({ openApp }) => openApp('astroai')) }, icon('ai'), 'Otevřít AstroAI'),
            el('button.ak-btn', { text: 'Zpět do obchodu', onclick: vyber }))),
        pata());
      return;
    }
    const klic = vyrobKlic(id);
    const ted = new Date();
    State.set('licence', [...licence(), { klic, edice: id, objednavka: obj, cas: ted.getTime(), cena: e.cena, email: o.email }]);
    posliEmaily({ e, obj, klic, ted, ...o });

    ukaz(hlava(),
      el('div.ak-hotovo', {},
        el('div.ak-hotovo-ic', {}, icon('check')),
        el('h1', { text: 'Děkujeme za nákup!' }),
        el('p', { text: `Objednávka ${obj} je zaplacená. Kód Product Key pro ${e.nazev} vám za chvilku přijde do Pošty na ${o.email}.` }),
        el('div.ak-hotovo-tl', {},
          el('button.ak-btn', { onclick: () => import('./apps.js').then(({ openApp }) => openApp('mail')) }, icon('mail'), 'Otevřít Poštu'),
          State.get('aktivovano') === false ? el('button.ak-btn.hlavni', { text: 'Zadat kód Product Key', onclick: () => aktivacniDialog() }) : null,
          el('button.ak-btn', { text: 'Zpět do obchodu', onclick: vyber }),
        ),
      ),
      pata());
  }

  vyber();
  // astro://koupit/ai (tlačítko „Víc tokenů“ v okénku Využití) → rovnou na tarif AI
  if (arg.cesta === '/ai') setTimeout(() => root.querySelector('#ak-ai')?.scrollIntoView({ block: 'start' }), 60);
  return root;
}

/** Zpracování platby: peněženka rovnou, karta přes ověřovací kód „z aplikace banky“. */
async function zaplat(e, metoda, root) {
  const vrstva = el('div.ak-zpracovani', {}, el('div.ak-spinner'), el('span', { text: 'Zpracování platby…' }));
  root.append(vrstva);
  const pryc = () => vrstva.remove();
  await sleep(2200);

  if (metoda === 'penezenka') {
    if (zustatek() < e.cena) { pryc(); return { ok: false, chyba: 'V Astro peněžence není dost peněz.' }; }
    State.set('penezenka', zustatek() - e.cena);
    pryc();
    return { ok: true, popis: 'Astro peněženka', transakce: 'AP-' + nahodne(10) };
  }

  // karta: 3-D Secure
  const kod = nahodne(6);
  const vstup = el('input.ak-pole.ak-kod', { placeholder: '000000', maxlength: 6, inputmode: 'numeric' });
  const ch = el('div.ak-chyba');
  const vysledek = await new Promise((resolve) => {
    vstup.onkeydown = (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') overit.click(); };
    const overit = el('button.ak-btn.hlavni', { text: 'Potvrdit platbu' });
    overit.onclick = () => {
      if (vstup.value.trim() !== kod) { ch.textContent = 'Kód nesouhlasí. Najdete ho v upozornění vpravo nahoře.'; return; }
      resolve('ok');
    };
    vrstva.replaceChildren(el('div.ak-3ds', {},
      el('div.ak-3ds-hlava', {}, icon('shield'), el('b', { text: 'AstroBank · Ověření platby' })),
      el('p', { text: `Platba ${penize(e.cena)} pro AstroMeo Systems kartou •••• 4242.` }),
      el('p', { text: 'Do aplikace AstroBank jsme poslali šestimístný kód. Opište ho sem.' }),
      vstup, ch,
      el('div.ak-3ds-tl', {}, el('button.ak-btn', { text: 'Zrušit', onclick: () => resolve('zruseno') }), overit),
    ));
    setTimeout(() => vstup.focus(), 50);
    setTimeout(() => import('./oobe.js').then(({ upozorneni }) => upozorneni('AstroBank', `Potvrzovací kód platby ${penize(e.cena)}: ${kod}`)), 1500);
  });
  document.querySelectorAll('.oobe-notif').forEach((n) => n.remove());

  if (vysledek !== 'ok') { pryc(); return { ok: false, chyba: 'Platba byla zrušena.' }; }
  vrstva.replaceChildren(el('div.ak-spinner'), el('span', { text: 'Banka ověřuje platbu…' }));
  await sleep(2000);
  pryc();
  if (e.cena > 50000) return { ok: false, chyba: 'Banka platbu zamítla: na kartě není 99 999 Kč. Zkuste levnější vesmír.' };
  return { ok: true, popis: 'Karta AstroBank Visa •••• 4242', transakce: 'TX-' + nahodne(10) };
}

function posliEmaily({ e, obj, klic, ted, jmeno, email, metoda, transakce, doKdy }) {
  const bez = Math.round(e.cena / 1.21);
  const datum = `${cz.datumKratky(ted)}, ${cz.cas()}`;
  const sloupec = (a, b) => a.padEnd(24) + b.padStart(12);

  posta({
    od: 'obchod@astroos', odJmeno: 'AstroOS Store',
    predmet: `Potvrzení objednávky ${obj}`,
    telo: [
      `Dobrý den, ${jmeno},`, '',
      'děkujeme za nákup v AstroOS Store! Objednávku jsme přijali a je zaplacená.', '',
      `OBJEDNÁVKA ${obj}`,
      `Datum: ${datum}`,
      '────────────────────────────────────',
      `1× ${e.nazev}`,
      e.ai ? `   tarif AI, ${e.tokeny.toLocaleString('cs-CZ')} tokenů / 10 min, 7 dní` : '   digitální licence, 1 zařízení',
      sloupec('Cena bez DPH', penize(bez)),
      sloupec('DPH 21 %', penize(e.cena - bez)),
      sloupec('Doprava (e-mailem)', '0 Kč'),
      '────────────────────────────────────',
      sloupec('CELKEM', penize(e.cena)), '',
      `Způsob platby: ${metoda}`,
      `Číslo transakce: ${transakce}`,
      `Fakturační e-mail: ${email}`, '',
      e.ai ? `${e.nazev} platí hned na tomhle počítači, do ${datumDo(doKdy)}. Prodloužit ho můžete na astro://koupit/ai.` : 'Kód Product Key vám pošleme v samostatném e-mailu, jakmile ho vygenerujeme (obvykle do minuty).', '',
      'S pozdravem',
      'AstroOS Store · AstroMeo Systems',
      'Hvězdná 1, 110 00 Astro City · IČO 26101300', '',
      '— Tohle je ukázkový obchod uvnitř AstroOS. Žádné skutečné peníze se neúčtovaly. —',
    ].join('\n'),
  }, 2500);

  if (e.ai) return;   // tarif AI nemá kód Product Key
  posta({
    od: 'licence@astroos', odJmeno: 'Licenční oddělení AstroOS',
    predmet: `Váš kód Product Key pro ${e.nazev}`,
    telo: [
      `Dobrý den, ${jmeno},`, '',
      'tady je váš kód Product Key. Uschovejte si ho — budete ho potřebovat i při přeinstalaci systému.', '',
      `        ${klic}`, '',
      'PODROBNOSTI LICENCE',
      `Produkt:            ${e.nazev}`,
      'Typ licence:        Retail (digitální)',
      'Počet zařízení:     1',
      `ID licence:         LIC-${klic.slice(0, 5)}-${nahodne(8)}`,
      `Objednávka:         ${obj}`,
      `Zakoupeno:          ${datum}`,
      'Platnost:           doživotní (nebo do konce vesmíru, co nastane dřív)',
      'Aktualizace:        zdarma, kanál Stabilní', '',
      'JAK AKTIVOVAT',
      '1. Otevřete Nastavení → Systém.',
      '2. U řádku Aktivace klikněte na „Zadat kód Product Key“.',
      '3. Vložte kód výše a klikněte na Aktivovat.', '',
      'Licenci můžete přenést na jiný počítač. Kód nesdílejte s nikým — ani s kočkou.', '',
      'Licenční oddělení AstroMeo Systems',
    ].join('\n'),
  }, 9000);
}
