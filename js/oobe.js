// AstroOS — první spuštění: instalační program + nastavení systému (OOBE) a reset počítače
//
// Fáze A je klasická „Instalace AstroOS“ (jazyk, kód Product Key, licence, typ instalace, výběr
// disku, kopírování souborů, restart). Fáze B je modré-zelené nastavení jako ve Windows 11
// (země, klávesnice, Wi-Fi, aktualizace, účet, PIN, soukromí, vzhled, nabídky, „Ahoj“).
// Celé to má trvat 3,5–5 minut, poslední obrazovka čekání dorovná.
//
// Čistá instalace smaže všechno AstroOS z localStorage (klíče „astroos.*“). Na konci se výsledek
// zapíše do State a stránka se obnoví, aby žádný modul nedržel v paměti starý stav.

import { el, sleep } from './util.js';
import { logo, icon } from './icons.js';
import { State, ACCENTS } from './state.js';
import * as FS from './fs.js';
import * as Sit from './sit.js';
import { applyAccent } from './vzhled.js';
import { applyWallpaper, WALLPAPERS } from './wallpapers.js';
import { zvuk } from './zvuk.js';
import { rozeberKlic, formatujPole } from './aktivace.js';
import { jazykTed, nastavJazyk, anglicky } from './i18n.js';

const VIDENO = 'astroos-oobe-videno';    // přežije čistou instalaci → nabídne zrychlení
const MIN_DELKA = 210_000;                // 3,5 minuty
const MAX_DOROVNANI = 60_000;

let rychlost = 1;
/** Pro testování z konzole: (await import('/js/oobe.js')).nastavRychlost(0.05) */
export const nastavRychlost = (r) => { rychlost = r; };
const cekej = (ms) => sleep(ms * rychlost);

let root = null;          // #oobe
let enterAkce = null;     // co udělá Enter na aktuální obrazovce
let zacatek = 0;

// ================================================================ vstup
/** Projde celou instalaci. Nikdy se nevrátí — na konci obnoví stránku. */
export async function runOobe() {
  zacatek = Date.now();
  root = el('div#oobe.oobe');
  document.body.append(root);
  root.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter' && enterAkce && !e.target.closest('textarea')) { e.preventDefault(); enterAkce(); }
  });

  const v = {};   // všechno, co uživatel vybral
  await fazeInstalace(v);
  await fazeNastaveni(v);
  await dokonci(v);
}

// Předchozí instalace = uložený disk, nebo nastavení systému, který už byl aspoň jednou na ploše
// (disk se zapíše až po první změně souboru; samotný POST si do nastavení zapíše `fastboot`).
const maData = () => {
  try {
    if (localStorage.getItem('astroos.fs.v1') !== null) return true;
    return JSON.parse(localStorage.getItem('astroos.v1') || '{}').firstRun === false;
  } catch { return false; }
};

function vymazVse() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('astroos.')) localStorage.removeItem(k);
  } catch { /* nevadí */ }
  State.reset();
  FS.resetDisk();
}

// ================================================================ drobné stavební kameny
const ui = (jmeno) => zvuk(jmeno);

function tlacitko(text, { hlavni = false, onclick, trida = '' } = {}) {
  const b = el('button.oobe-btn' + (hlavni ? '.hlavni' : '') + trida, { text });
  b.addEventListener('click', () => { if (!b.disabled) ui('jemny'); });
  if (onclick) b.addEventListener('click', () => { if (!b.disabled) onclick(); });
  return b;
}

function pole(placeholder, { typ = 'text', hodnota = '', max = 80, auto = true } = {}) {
  const i = el('input.oobe-pole', { type: typ, placeholder, maxlength: max, spellcheck: 'false', autocomplete: 'off' });
  i.value = hodnota;
  if (auto) setTimeout(() => i.focus(), 420 * Math.min(1, rychlost * 4));
  return i;
}

function chyba() { return el('div.oobe-chyba'); }
function ukazChybu(c, text) { c.textContent = text; c.classList.toggle('on', !!text); if (text) ui('chyba'); }

/** Seznam, ze kterého jde vybrat jedna položka. */
function seznam(polozky, vybrana, onVyber, { vyska = 260 } = {}) {
  const box = el('div.oobe-seznam', { style: { maxHeight: vyska + 'px' } });
  const radky = polozky.map((p) => {
    const r = el('button.oobe-polozka', {}, el('span', { text: p.text }), p.sub ? el('small', { text: p.sub }) : null);
    r.onclick = () => { radky.forEach((x) => x.classList.remove('on')); r.classList.add('on'); ui('jemny'); onVyber(p.id); };
    if (p.id === vybrana) r.classList.add('on');
    box.append(r);
    return r;
  });
  setTimeout(() => {
    const on = box.querySelector('.on');
    if (on) box.scrollTop = on.offsetTop - box.clientHeight / 2 + on.offsetHeight / 2;
  }, 50);
  box.filtr = (q) => {
    const n = q.trim().toLowerCase();
    // hledá v češtině i v tom, co je zrovna vidět (přeložený text)
    radky.forEach((r, i) => {
      r.hidden = !!n && !polozky[i].text.toLowerCase().includes(n) && !r.textContent.toLowerCase().includes(n);
    });
  };
  return box;
}

function prepinacAnoNe(hodnota, onZmena) {
  const box = el('div.oobe-anone');
  const ano = el('button', { text: 'Ano' }), ne = el('button', { text: 'Ne' });
  const nastav = (x) => { ano.classList.toggle('on', x); ne.classList.toggle('on', !x); };
  ano.onclick = () => { nastav(true); ui('jemny'); onZmena(true); };
  ne.onclick = () => { nastav(false); ui('jemny'); onZmena(false); };
  nastav(hodnota);
  box.append(ano, ne);
  return box;
}

function spinner() { return el('div.spinner', {}, el('i'), el('i'), el('i'), el('i'), el('i')); }

/** Falešné upozornění „z telefonu“ v rohu — tak přijde ověřovací kód (i obnova hesla na zámku). */
export function upozorneni(nadpis, text) {
  const n = el('div.oobe-notif', {},
    el('div.oobe-notif-ic', {}, icon('mail')),
    el('div', {}, el('b', { text: nadpis }), el('p', { text })),
  );
  document.body.append(n);
  zvuk('oznameni');
  const pryc = () => { n.classList.add('pryc'); setTimeout(() => n.remove(), 400); };
  n.onclick = pryc;
  setTimeout(pryc, 20000);
  return n;
}

/** Malé modální okno nad instalací. Vrací hodnotu stisknutého tlačítka. */
function dialog(nadpis, text, tlacitka = [['OK', true]]) {
  return new Promise((resolve) => {
    const zavri = (h) => { bg.remove(); resolve(h); };
    const bg = el('div.oobe-dialog-bg', {},
      el('div.oobe-dialog', {},
        el('h3', { text: nadpis }),
        el('p', { text }),
        el('div.oobe-dialog-tl', {}, ...tlacitka.map(([t, h], i) => tlacitko(t, { hlavni: i === 0, onclick: () => zavri(h) }))),
      ),
    );
    root.append(bg);
  });
}

// ================================================================ fáze A: instalační program
function setupPozadi() {
  root.replaceChildren(el('div.oobe-setup'));
  root.dataset.faze = 'setup';
  return root.firstChild;
}

/**
 * Okno instalačního programu. `obsah` = uzly, `tlacitka` = [{ text, hlavni, kontrola }].
 * Vrací text stisknutého tlačítka.
 */
function setupOkno({ obsah, tlacitka = [], krok = 1, bezListy = false }) {
  return new Promise((resolve) => {
    const scena = root.querySelector('.oobe-setup') || setupPozadi();
    const tl = tlacitka.map((t) => {
      const b = tlacitko(t.text, { hlavni: t.hlavni });
      if (t.zakazane) b.disabled = true;
      b.onclick = async () => {
        if (b.disabled) return;
        if (t.kontrola && !(await t.kontrola())) return;
        enterAkce = null;
        resolve(t.text);
      };
      t.uzel = b;
      return b;
    });
    const hlavni = tlacitka.find((t) => t.hlavni);
    enterAkce = hlavni ? () => hlavni.uzel.click() : null;

    const okno = el('div.oobe-okno', {},
      el('div.oobe-okno-lista', {}, logo('oobe-okno-logo'), el('span', { text: 'Instalační program AstroOS' })),
      el('div.oobe-okno-telo', {}, ...obsah),
      tl.length ? el('div.oobe-okno-pata', {}, ...tl) : null,
    );
    const lista = bezListy ? null : el('div.oobe-kroky', {},
      el('span' + (krok === 1 ? '.on' : '.hotovo'), {}, el('b', { text: '1' }), 'Shromažďování informací'),
      el('span' + (krok === 2 ? '.on' : ''), {}, el('b', { text: '2' }), 'Instalace AstroOS'),
    );
    scena.replaceChildren(okno, lista || '');
  });
}

async function fazeInstalace(v) {
  setupPozadi();
  await cekej(900);

  // --- jazyk ---
  const videno = (() => { try { return !!localStorage.getItem(VIDENO); } catch { return false; } })();
  // value = český text, ať výběr nezávisí na tom, do jakého jazyka se popisek přeložil
  const vyber = (popisek, moznosti, vybrana) => {
    const s = el('select.oobe-select', {}, ...moznosti.map(([hodnota, text]) =>
      el('option', { value: hodnota, text: text ?? hodnota, selected: hodnota === vybrana })));
    return [s, el('label.oobe-radek', {}, el('span', { text: popisek }), s)];
  };
  const ted = jazykTed();
  const [jazyk, rJazyk] = vyber('Jazyk instalace:', [['cs', 'Čeština'], ['en', 'English (United States)']], ted);
  const [format, rFormat] = vyber('Formát času a měny:', [['cs', 'Čeština (Česko)'], ['en', 'English (United States)']], ted);
  const [klav, rKlav] = vyber('Klávesnice nebo metoda zadávání:',
    [['Česká'], ['Česká (QWERTY)'], ['Slovenská'], ['Anglická (USA)'], ['Německá']], ted === 'en' ? 'Anglická (USA)' : 'Česká');
  // výběr jazyka přepne celou instalaci hned, jako ve Windows
  jazyk.onchange = () => {
    nastavJazyk(jazyk.value);
    format.value = jazyk.value;
    klav.value = jazyk.value === 'en' ? 'Anglická (USA)' : 'Česká';
  };
  const zrychlit = el('input', { type: 'checkbox' });
  await setupOkno({
    obsah: [
      el('div.oobe-setup-hlava', {}, logo('oobe-setup-logo'), el('span', { text: 'AstroOS' })),
      rJazyk, rFormat, rKlav,
      el('p.oobe-drobne', { text: 'Zadejte svůj jazyk a další předvolby a pokračujte kliknutím na Další.' }),
      videno ? el('label.oobe-zatrh', {}, zrychlit, el('span', { text: 'Zrychlená instalace (tohle už jsem jednou viděl)' })) : null,
    ],
    tlacitka: [{ text: 'Další', hlavni: true }],
  });
  Object.assign(v, { jazyk: jazyk.value, format: format.value, klavesnice: klav.value });
  if (zrychlit.checked) rychlost = 0.15;
  try { localStorage.setItem(VIDENO, '1'); } catch { /* nevadí */ }

  // --- Instalovat ---
  for (;;) {
    const opravit = el('button.oobe-odkaz', { text: 'Opravit počítač' });
    const p = setupOkno({
      obsah: [
        el('div.oobe-instalovat', {},
          logo('oobe-setup-logo velke'),
          el('div.oobe-setup-nazev', { text: 'AstroOS' }),
          tlacitko('Instalovat', { hlavni: true, trida: '.velke', onclick: () => { enterAkce = null; root.dispatchEvent(new CustomEvent('oobe-dal')); } }),
        ),
        opravit,
      ],
    });
    const volba = await new Promise((r) => {
      root.addEventListener('oobe-dal', () => r('dal'), { once: true });
      opravit.onclick = () => r('opravit');
      enterAkce = () => r('dal');
    });
    void p;
    if (volba === 'dal') break;
    await setupCekani('Hledání problémů…', 3500);
    await dialog('Oprava spuštění', 'Nebyly nalezeny žádné problémy. Počítač je v pořádku — zatím na něm totiž nic není.');
  }
  await setupCekani('Instalační program se spouští…', 3200);

  // --- Product Key ---
  const klic = pole('XXXXX-XXXXX-XXXXX-XXXXX-XXXXX', { max: 29 });
  klic.classList.add('oobe-klic');
  const chK = chyba();
  let bezKlice = false;
  const pk = setupOkno({
    obsah: [
      el('h2', { text: 'Aktivace AstroOS' }),
      el('p', { text: 'Pokud instalujete AstroOS poprvé, musíte zadat platný kód Product Key. Najdete ho na krabici, ve které jste AstroOS koupili, nebo v potvrzovacím e-mailu.' }),
      el('p.oobe-drobne', { text: 'Kód Product Key vypadá zhruba takhle: XXXXX-XXXXX-XXXXX-XXXXX-XXXXX. Pomlčky se doplní samy.' }),
      klic, chK,
      el('button.oobe-odkaz', { text: 'Nemám kód Product Key', onclick: () => { bezKlice = true; enterAkce = null; root.querySelector('.oobe-okno-pata .hlavni').click(); } }),
    ],
    tlacitka: [{
      text: 'Další', hlavni: true,
      kontrola: async () => {
        if (bezKlice) return true;
        const ciste = klic.value.replace(/[^A-Z0-9]/gi, '');
        if (ciste.length !== 25) { ukazChybu(chK, 'Kód Product Key má 25 znaků. Zkontrolujte ho, nebo klikněte na „Nemám kód Product Key“.'); return false; }
        if (!rozeberKlic(ciste)) { ukazChybu(chK, 'Tento kód Product Key nefunguje. Zkontrolujte ho, nebo klikněte na „Nemám kód Product Key“ — AstroOS jde koupit i později.'); return false; }
        return true;
      },
    }],
  });
  klic.addEventListener('input', () => { formatujPole(klic); ukazChybu(chK, ''); });
  await pk;
  v.aktivovano = !bezKlice;
  v.produktKlic = bezKlice ? null : klic.value;

  // --- edice (jen když není klíč, jako ve Windows) ---
  if (bezKlice) {
    let edice = 'home';
    const ed = seznam([
      { id: 'home', text: 'AstroOS Home', sub: 'x64 · 13. 10. 2026' },
      { id: 'pro', text: 'AstroOS Pro', sub: 'x64 · 13. 10. 2026' },
      { id: 'edu', text: 'AstroOS Education', sub: 'x64 · 13. 10. 2026' },
      { id: 'astro', text: 'AstroOS Pro pro pracovní stanice ve vesmíru', sub: 'x64 · 13. 10. 2026' },
    ], edice, (id) => { edice = id; }, { vyska: 220 });
    await setupOkno({
      obsah: [el('h2', { text: 'Vyberte operační systém, který chcete nainstalovat' }), ed],
      tlacitka: [{ text: 'Další', hlavni: true }],
    });
    v.edice = edice;
  } else v.edice = rozeberKlic(klic.value).edice;

  // --- licence ---
  const souhlas = el('input', { type: 'checkbox' });
  const lic = setupOkno({
    obsah: [
      el('h2', { text: 'Platné poznámky a licenční podmínky' }),
      el('div.oobe-licence', { text: anglicky() ? LICENCE_EN : LICENCE }),
      el('label.oobe-zatrh', {}, souhlas, el('span', { text: 'Přijímám licenční podmínky' })),
    ],
    tlacitka: [{ text: 'Další', hlavni: true, zakazane: true }],
  });
  souhlas.onchange = () => { root.querySelector('.oobe-okno-pata .hlavni').disabled = !souhlas.checked; };
  await lic;

  // --- typ instalace ---
  const data = maData();
  let typ = 'vlastni';
  if (data) {
    typ = await new Promise((resolve) => {
      const volba = (id, nadpis, text) => el('button.oobe-volba', { onclick: () => { ui('jemny'); enterAkce = null; resolve(id); } },
        el('b', { text: nadpis }), el('span', { text }));
      setupOkno({
        obsah: [
          el('h2', { text: 'Jaký typ instalace chcete provést?' }),
          volba('upgrade', 'Upgrade: Nainstalovat AstroOS a zachovat soubory, nastavení a aplikace',
            'Soubory, nastavení a aplikace se přesunou do nové instalace AstroOS. Tato možnost je k dispozici, jen když je v počítači spuštěná podporovaná verze AstroOS.'),
          volba('vlastni', 'Vlastní: Nainstalovat jenom AstroOS (rozšířené)',
            'Soubory, nastavení a aplikace se nepřesunou. Pokud chcete změnit oddíly a disky, spusťte počítač z instalačního disku. Doporučujeme vám, abyste si soubory před pokračováním zazálohovali.'),
        ],
      });
    });
  }
  v.vymazat = false;

  // --- disk ---
  if (typ === 'vlastni') {
    v.vymazat = await vyberDisku(data);
  }

  // --- instalace ---
  if (v.vymazat || !data) { vymazVse(); v.cista = true; }
  await instalace(typ === 'upgrade');
  await restart('Příprava zařízení', 14000);
}

const LICENCE = `LICENČNÍ PODMÍNKY PRO SOFTWARE ASTROOS
Poslední aktualizace: říjen 2026

1. Tento software je licencován, nikoli prodán. Patří společnosti AstroMeo Systems, která vám ho laskavě půjčuje, dokud budete hodní.

2. MŮŽETE: používat AstroOS na jednom počítači (nebo v jednom prohlížeči, což je skoro totéž), měnit tapety, kolik se vám zachce, a psát v AstroPísmu slohové práce.

3. NESMÍTE: tvrdit, že AstroOS je Windows; nastavit heslo „1234“ a pak se divit; vypnout počítač během aktualizace, protože se pak AstroOS urazí.

4. AKTUALIZACE. AstroOS se bude čas od času aktualizovat, typicky když to nejvíc spěchá. Souhlasíte s tím, že „Aktualizace 37 %“ může trvat libovolně dlouho.

5. OCHRANA OSOBNÍCH ÚDAJŮ. Všechna data zůstávají ve vašem prohlížeči. Nikam se neposílají. AstroMeo Systems o vás neví vůbec nic, ani jak se jmenujete — to nám teprve řeknete.

6. ZÁRUKA. Software je poskytován „tak, jak je“. Pokud se rozbije, zkuste ho vypnout a zapnout. Pokud to nepomůže, zkuste to znovu.

7. KOČKY. Pokud vám kočka přejde po klávesnici a něco tím změní, AstroMeo Systems za to nenese odpovědnost.

8. VESMÍR. AstroOS je možné používat i na oběžné dráze. Podpora gravitace je zatím experimentální.

Kliknutím na „Přijímám“ potvrzujete, že jste tohle celé přečetli. (Nepřečetli. Nikdo to nečte.)`;

const LICENCE_EN = `ASTROOS SOFTWARE LICENSE TERMS
Last updated: October 2026

1. This software is licensed, not sold. It belongs to AstroMeo Systems, which kindly lends it to you for as long as you behave.

2. YOU MAY: use AstroOS on one computer (or in one browser, which is almost the same thing), change backgrounds as often as you like, and write school essays in AstroPísmo.

3. YOU MAY NOT: claim that AstroOS is Windows; set your password to “1234” and then act surprised; turn off your computer during an update, because AstroOS will get offended.

4. UPDATES. AstroOS will update itself from time to time, typically when you’re in the biggest hurry. You agree that “Updating 37 %” may take an arbitrarily long time.

5. PRIVACY. All data stays in your browser. Nothing is sent anywhere. AstroMeo Systems knows nothing about you, not even your name — you’re about to tell us that.

6. WARRANTY. The software is provided “as is”. If it breaks, try turning it off and on again. If that doesn’t help, try again.

7. CATS. If your cat walks across the keyboard and changes something, AstroMeo Systems is not responsible.

8. SPACE. AstroOS may also be used in orbit. Gravity support is still experimental.

By clicking “I accept” you confirm that you have read all of this. (You haven’t. Nobody reads this.)`;

/** Okno „Kam chcete AstroOS nainstalovat?“. Vrací true, když se starý systém smaže. */
async function vyberDisku(data) {
  const oddily = [
    { id: 'rez', nazev: 'Disk 0 Oddíl 1: Systémový rezervovaný', vel: '100.0 MB', volne: '68.4 MB', typ: 'Systém' },
    data
      ? { id: 'sys', nazev: 'Disk 0 Oddíl 2: AstroOS', vel: '1862.9 GB', volne: '1450.2 GB', typ: 'Primární', data: true }
      : { id: 'sys', nazev: 'Nepřidělené místo na disku 0', vel: '1862.9 GB', volne: '1862.9 GB', typ: '' },
    { id: 'd1', nazev: 'Nepřidělené místo na disku 1', vel: '931.5 GB', volne: '931.5 GB', typ: '' },
  ];
  let vybrany = 'sys';
  let smazat = false;

  for (;;) {
    const tabulka = el('div.oobe-disky', {},
      el('div.oobe-disk.hlava', {}, el('span', { text: 'Název' }), el('span', { text: 'Celková velikost' }), el('span', { text: 'Volné místo' }), el('span', { text: 'Typ' })),
    );
    const radky = oddily.map((o) => {
      const r = el('button.oobe-disk' + (o.id === vybrany ? '.on' : ''), {},
        el('span', {}, icon('hdd'), o.nazev), el('span', { text: o.vel }), el('span', { text: o.volne }), el('span', { text: o.typ }));
      r.onclick = () => { vybrany = o.id; radky.forEach((x) => x.classList.remove('on')); r.classList.add('on'); ui('jemny'); };
      tabulka.append(r);
      return r;
    });
    const akce = (text, ikona, fn) => el('button.oobe-odkaz.s-ikonou', { onclick: fn }, icon(ikona), text);
    const cekaNa = new Promise((resolve) => {
      setupOkno({
        obsah: [
          el('h2', { text: 'Kam chcete AstroOS nainstalovat?' }),
          tabulka,
          el('div.oobe-disk-akce', {},
            akce('Aktualizovat', 'refresh', () => resolve('obnov')),
            akce('Odstranit', 'x', () => resolve('odstranit')),
            akce('Formátovat', 'hdd', () => resolve('formatovat')),
            akce('Nový', 'plus', () => resolve('novy')),
            akce('Načíst ovladač', 'download', () => resolve('ovladac')),
          ),
        ],
        tlacitka: [{ text: 'Další', hlavni: true }],
      }).then(() => resolve('dal'));
    });
    const a = await cekaNa;
    const o = oddily.find((x) => x.id === vybrany);

    if (a === 'obnov') { await setupCekani('Hledání disků…', 1800); continue; }
    if (a === 'ovladac') { await dialog('Načíst ovladač', 'Nebyly nalezeny žádné ovladače. Všechno potřebné už AstroOS má v sobě.'); continue; }
    if (a === 'novy') { await dialog('Nový oddíl', 'Abyste mohli vytvořit nový oddíl, musí na disku být nepřidělené místo. AstroOS si vystačí s tím, co je.'); continue; }
    if (a === 'odstranit' || a === 'formatovat') {
      if (o.id === 'rez') { await dialog('Instalační program AstroOS', 'Tento oddíl si AstroOS rezervuje pro spouštění. Raději ho nechte být.'); continue; }
      if (!o.data) { await dialog('Instalační program AstroOS', 'Na vybraném místě nejsou žádná data, není co mazat.'); continue; }
      const h = await dialog('Instalační program AstroOS',
        a === 'formatovat'
          ? 'Tento oddíl může obsahovat soubory pro obnovení nebo předchozí instalaci AstroOS. Pokud ho naformátujete, budou všechna data, která jsou na něm uložena, ztracena.'
          : 'Tento oddíl může obsahovat důležitá data. Pokud ho odstraníte, budou všechna data, která jsou na něm uložena, ztracena.',
        [['OK', true], ['Zrušit', false]]);
      if (!h) continue;
      await setupCekani(a === 'formatovat' ? 'Formátování oddílu…' : 'Odstraňování oddílu…', 2600);
      smazat = true;
      Object.assign(o, a === 'formatovat'
        ? { volne: '1862.8 GB', data: false }
        : { nazev: 'Nepřidělené místo na disku 0', volne: '1862.9 GB', typ: '', data: false });
      continue;
    }
    // Další
    if (o.id === 'rez') { await dialog('Instalační program AstroOS', 'AstroOS nelze nainstalovat na tento oddíl. Je moc malý (100 MB) — vybrat jiný.'); continue; }
    if (o.id === 'd1') { await dialog('Instalační program AstroOS', 'AstroOS nelze nainstalovat na disk 1. Disk SATA1 je určený jen pro data. Vyberte disk 0.'); continue; }
    if (o.data) {
      const h = await dialog('Instalační program AstroOS',
        'Vybraný oddíl obsahuje předchozí instalaci AstroOS. Pokud budete pokračovat, všechny soubory, nastavení a aplikace z ní budou odstraněny a začnete úplně načisto.',
        [['Pokračovat', true], ['Zrušit', false]]);
      if (!h) continue;
      smazat = true;
    }
    return smazat;
  }
}

/** Šedé okno s kolečkem a textem. */
async function setupCekani(text, ms) {
  const scena = root.querySelector('.oobe-setup') || setupPozadi();
  enterAkce = null;
  scena.replaceChildren(el('div.oobe-setup-cekani', {}, spinner(), el('span', { text })));
  await cekej(ms);
}

async function instalace(upgrade) {
  const kroky = [
    ['Kopírování souborů AstroOS', 5200],
    ['Příprava souborů k instalaci', 24000, true],
    ['Instalace funkcí', 8000],
    ['Instalace aktualizací', 8500],
    ['Dokončování', 5000],
  ];
  if (upgrade) kroky.splice(1, 0, ['Přenášení vašich souborů, nastavení a aplikací', 6000, true]);
  const radky = kroky.map(([t]) => el('li', {}, el('span.oobe-fajfka'), el('span.oobe-krok-t', { text: t })));
  const pruh = el('i');
  setupOkno({
    krok: 2,
    obsah: [
      el('h2', { text: 'Instaluje se AstroOS' }),
      el('p', { text: 'Stav:' }),
      el('ul.oobe-postup', {}, ...radky),
      el('div.oobe-pruh-celk', {}, pruh),
    ],
  });
  const celkem = kroky.reduce((s, k) => s + k[1], 0);
  let hotovo = 0;
  for (let i = 0; i < kroky.length; i++) {
    const [t, ms, procenta] = kroky[i];
    const r = radky[i];
    r.classList.add('bezi');
    const txt = r.querySelector('.oobe-krok-t');
    // nerovnoměrné kroky: chvíli rychle, pak se zasekne (jako doopravdy)
    const n = procenta ? 40 : 6;
    for (let j = 1; j <= n; j++) {
      const zaseknuti = procenta && Math.random() < 0.08 ? 4 : 1;
      await cekej((ms / n) * (0.4 + Math.random() * 1.2) * zaseknuti / (zaseknuti > 1 ? 2 : 1));
      if (procenta) txt.textContent = `${t} (${Math.min(100, Math.round((j / n) * 100))} %)`;
      pruh.style.width = ((hotovo + (ms * j) / n) / celkem) * 100 + '%';
    }
    hotovo += ms;
    r.classList.replace('bezi', 'ok');
    if (procenta) txt.textContent = t;
  }

  // odpočet k restartu
  let s = 10;
  const odp = el('p', { text: `AstroOS se musí restartovat, aby mohl pokračovat. Restart proběhne za ${s} s.` });
  let hned = false;
  setupOkno({
    krok: 2,
    obsah: [el('h2', { text: 'AstroOS se musí restartovat' }), odp, el('div.oobe-pruh-celk', {}, el('i', { style: { width: '100%' } }))],
    tlacitka: [{ text: 'Restartovat hned', hlavni: true, kontrola: async () => { hned = true; return true; } }],
  });
  while (s > 0 && !hned) {
    await sleep(1000 * Math.max(rychlost, 0.15));
    s--;
    odp.textContent = `AstroOS se musí restartovat, aby mohl pokračovat. Restart proběhne za ${s} s.`;
  }
}

/** Černá obrazovka → logo s kolečkem a procenty. */
async function restart(text, ms, { procenta = true } = {}) {
  enterAkce = null;
  root.dataset.faze = 'cerna';
  root.replaceChildren();
  await cekej(1600);
  const stav = el('div.oobe-restart-t', { text: procenta ? `${text} 0 %` : text });
  root.replaceChildren(el('div.oobe-restart', {}, logo('oobe-restart-logo'), spinner(), stav));
  if (procenta) {
    let p = 0;
    while (p < 100) {
      await cekej(ms / 30 * (0.5 + Math.random()));
      p = Math.min(100, p + 1 + Math.floor(Math.random() * 6));
      stav.textContent = `${text} ${p} %`;
    }
    await cekej(900);
    stav.textContent = 'Příprava';
    await cekej(2600);
  } else await cekej(ms);
  root.replaceChildren();
  await cekej(900);
}

// ================================================================ fáze B: nastavení (OOBE)
function kartaPozadi() {
  root.dataset.faze = 'oobe';
  root.toggleAttribute('data-svetly', State.get('motiv') === 'svetly');
  root.replaceChildren(
    el('div.oobe-scena', {}, el('div.oobe-karta')),
    dolniLista(),
  );
  return root.querySelector('.oobe-karta');
}

function dolniLista() {
  const zvukBtn = el('button', { title: 'Zvuk' }, icon(State.get('zvuky') === false ? 'volumeOff' : 'volume'));
  zvukBtn.onclick = () => {
    State.set('zvuky', State.get('zvuky') === false);
    zvukBtn.replaceChildren(icon(State.get('zvuky') === false ? 'volumeOff' : 'volume'));
  };
  const pristup = el('button', { title: 'Usnadnění přístupu — větší text' }, icon('access'));
  pristup.onclick = () => { root.classList.toggle('velky-text'); ui('jemny'); };
  return el('div.oobe-dolni', {}, pristup, zvukBtn);
}

/** Ilustrace vlevo: velká ikona v zářícím kruhu. */
function ilustrace(ikona) {
  return el('div.oobe-ilu', {},
    el('div.oobe-ilu-orbita'),
    el('div.oobe-ilu-kruh', {}, typeof ikona === 'string' ? icon(ikona) : ikona),
    el('i.t1'), el('i.t2'), el('i.t3'),
  );
}

/**
 * Jedna obrazovka nastavení. tlacitka: [{ text, hlavni, hodnota, kontrola, zakazane }].
 * Vrací hodnotu (nebo text) stisknutého tlačítka.
 */
function krok({ ilu, nadpis, popis, obsah = [], tlacitka = [], vlevo = null }) {
  return new Promise((resolve) => {
    const karta = root.querySelector('.oobe-karta') || kartaPozadi();
    const tl = tlacitka.map((t) => {
      const b = tlacitko(t.text, { hlavni: t.hlavni });
      if (t.zakazane) b.disabled = true;
      b.onclick = async () => {
        if (b.disabled) return;
        if (t.kontrola) {
          b.disabled = true;
          const ok = await t.kontrola();
          b.disabled = false;
          if (!ok) return;
        }
        enterAkce = null;
        resolve(t.hodnota ?? t.text);
      };
      t.uzel = b;
      return b;
    });
    const hlavni = tlacitka.find((t) => t.hlavni);
    enterAkce = hlavni ? () => hlavni.uzel.click() : null;

    karta.classList.remove('cekani');
    karta.replaceChildren(
      el('div.oobe-levy', {}, ilustrace(ilu)),
      el('div.oobe-pravy', {},
        el('h1', { text: nadpis }),
        popis ? el('p.oobe-popis', { text: popis }) : null,
        el('div.oobe-obsah', {}, ...obsah),
        el('div.oobe-tlac', {}, vlevo ? el('div.oobe-tlac-vlevo', {}, vlevo) : null, ...tl),
      ),
    );
  });
}

/** „Chvilku strpení…“ mezi kroky. */
async function strpeni(text = 'Chvilku strpení…', ms = 2200) {
  enterAkce = null;
  const karta = root.querySelector('.oobe-karta') || kartaPozadi();
  karta.classList.add('cekani');
  karta.replaceChildren(el('div.oobe-strpeni', {}, spinner(), el('span', { text })));
  await cekej(ms);
}

async function fazeNastaveni(v) {
  kartaPozadi();
  await strpeni('Chvilku strpení…', 3200);

  // --- země ---
  const ZEME = ['Česko', 'Slovensko', 'Německo', 'Rakousko', 'Polsko', 'Maďarsko', 'Ukrajina', 'Spojené království',
    'Spojené státy', 'Kanada', 'Francie', 'Itálie', 'Španělsko', 'Portugalsko', 'Nizozemsko', 'Belgie', 'Švýcarsko',
    'Dánsko', 'Švédsko', 'Norsko', 'Finsko', 'Island', 'Chorvatsko', 'Slovinsko', 'Řecko', 'Japonsko', 'Austrálie',
    'Nový Zéland', 'Brazílie', 'Mexiko', 'Antarktida', 'Mars (beta)'];
  v.zeme = 'Česko';
  const hledat = pole('Hledat', { auto: false });
  const sz = seznam(ZEME.map((z) => ({ id: z, text: z })), v.zeme, (id) => { v.zeme = id; });
  hledat.oninput = () => sz.filtr(hledat.value);
  await krok({
    ilu: 'globe', nadpis: 'Je to správná země nebo oblast?',
    obsah: [hledat, sz],
    tlacitka: [{ text: 'Ano', hlavni: true }],
  });
  if (v.zeme === 'Mars (beta)') await strpeni('Hledáme signál z Marsu…', 3000);

  // --- klávesnice ---
  const KLAV = ['Česká', 'Česká (QWERTY)', 'Česká programátorská', 'Slovenská', 'Anglická (USA)', 'Anglická (Spojené království)', 'Německá', 'Polská (programátorská)'];
  v.klavesnice = KLAV.includes(v.klavesnice) ? v.klavesnice : 'Česká';
  await krok({
    ilu: 'keyboard', nadpis: 'Je to správné rozložení nebo metoda zadávání pro klávesnici?',
    popis: 'Pokud chcete použít jiné rozložení, můžete ho přidat v dalším kroku.',
    obsah: [seznam(KLAV.map((k) => ({ id: k, text: k })), v.klavesnice, (id) => { v.klavesnice = id; })],
    tlacitka: [{ text: 'Ano', hlavni: true }],
  });
  const druhe = await krok({
    ilu: 'keyboard', nadpis: 'Chcete přidat druhé rozložení klávesnice?',
    tlacitka: [{ text: 'Přidat rozložení', hodnota: 'ano' }, { text: 'Přeskočit', hlavni: true, hodnota: 'ne' }],
  });
  if (druhe === 'ano') {
    v.klavesnice2 = KLAV.find((k) => k !== v.klavesnice);
    await krok({
      ilu: 'keyboard', nadpis: 'Jaké rozložení chcete přidat?',
      obsah: [seznam(KLAV.filter((k) => k !== v.klavesnice).map((k) => ({ id: k, text: k })), v.klavesnice2, (id) => { v.klavesnice2 = id; })],
      tlacitka: [{ text: 'Přidat rozložení', hlavni: true }],
    });
    await strpeni('Přidávání rozložení…', 1800);
  }

  // --- síť ---
  await strpeni('Kontrolujeme připojení k síti…', 2600);
  await krokWifi(v);

  // --- aktualizace ---
  if (Sit.online()) await aktualizace();

  // --- název zařízení ---
  const nahodne = 'ASTRO-' + Math.random().toString(36).slice(2, 7).toUpperCase();
  const jmeno = pole('Název zařízení', { max: 15 });
  const chJ = chyba();
  const pjm = await krok({
    ilu: 'computer', nadpis: 'Pojmenujte si zařízení',
    popis: 'Název pomůže zařízení poznat, když se k němu připojujete z jiných zařízení. Nové jméno se projeví po restartu.',
    obsah: [jmeno, chJ, el('p.oobe-drobne', { text: 'Nanejvýš 15 znaků. Smí obsahovat písmena, číslice a pomlčku, ale ne mezery.' })],
    tlacitka: [
      { text: 'Přeskočit', hodnota: 'skip' },
      {
        text: 'Další', hlavni: true,
        kontrola: async () => {
          const h = jmeno.value.trim();
          if (!h) { ukazChybu(chJ, 'Zadejte název, nebo krok přeskočte.'); return false; }
          if (!/^[A-Za-z0-9-]+$/.test(h)) { ukazChybu(chJ, 'Název nesmí obsahovat mezery ani speciální znaky.'); return false; }
          if (/^\d+$/.test(h)) { ukazChybu(chJ, 'Název nesmí být jen z číslic.'); return false; }
          return true;
        },
      },
    ],
  });
  v.jmenoPc = pjm === 'skip' ? nahodne : jmeno.value.trim();
  if (pjm !== 'skip') {
    await restart('Restartování', 3500, { procenta: false });
    kartaPozadi();
    await strpeni('Chvilku strpení…', 2000);
  }

  // --- osobní / škola ---
  let pouziti = 'osobni';
  const volba = (id, ikona, nadpis, text) => {
    const b = el('button.oobe-volba-karta' + (id === pouziti ? '.on' : ''), {},
      el('div.oobe-volba-ic', {}, icon(ikona)), el('div', {}, el('b', { text: nadpis }), el('span', { text })));
    b.onclick = () => { pouziti = id; b.parentNode.querySelectorAll('.on').forEach((x) => x.classList.remove('on')); b.classList.add('on'); ui('jemny'); };
    return b;
  };
  await krok({
    ilu: 'user', nadpis: 'Jak chcete toto zařízení nastavit?',
    obsah: [el('div.oobe-volby', {},
      volba('osobni', 'home', 'Nastavit pro osobní použití', 'Nastavíme ho pro vás a budete mít úplnou kontrolu nad vším.'),
      volba('skola', 'book', 'Nastavit pro práci nebo školu', 'Získáte přístup k prostředkům organizace, jako jsou e-mail, sítě a aplikace.'),
    )],
    tlacitka: [{ text: 'Další', hlavni: true }],
  });
  if (pouziti === 'skola') {
    await strpeni('Hledáme vaši organizaci…', 3600);
    await krok({
      ilu: 'book', nadpis: 'Organizaci se nepodařilo najít',
      popis: 'Vaše škola zatím AstroOS nepoužívá (ale měla by!). Zařízení proto nastavíme pro osobní použití. Školní účet si můžete přidat později v Nastavení.',
      tlacitka: [{ text: 'Pokračovat', hlavni: true }],
    });
  }

  // --- účet ---
  await krokUcet(v);

  // --- PIN ---
  await krokPin(v);

  // --- soukromí ---
  await krokSoukromi(v);

  // --- zájmy ---
  const ZAJMY = [['hry', 'Hry', 'game'], ['skola', 'Škola', 'book'], ['tvoreni', 'Tvoření', 'brush'], ['zabava', 'Zábava', 'music'],
    ['vyvoj', 'Vývoj', 'code'], ['vesmir', 'Vesmír', 'raketa'], ['rodina', 'Rodina', 'heart'], ['podnikani', 'Podnikání', 'tabulky']];
  const vybrane = new Set();
  const chipy = el('div.oobe-chipy', {}, ...ZAJMY.map(([id, t, ic]) => {
    const c = el('button.oobe-chip', {}, icon(ic), t);
    c.onclick = () => { vybrane.has(id) ? vybrane.delete(id) : vybrane.add(id); c.classList.toggle('on'); ui('jemny'); };
    return c;
  }));
  await krok({
    ilu: 'star', nadpis: 'Přizpůsobte si prostředí',
    popis: 'Vyberte, jak plánujete zařízení používat. Podle toho vám v Obchodě a ve Startu budeme ukazovat tipy a aplikace.',
    obsah: [chipy],
    tlacitka: [{ text: 'Přeskočit', hodnota: 'skip' }, { text: 'Přijmout', hlavni: true }],
  });
  v.zajmy = [...vybrane];

  // --- vzhled ---
  await krokVzhled(v);

  // --- nabídky ---
  if (v.email) {
    const zal = await krok({
      ilu: 'download', nadpis: 'Zálohujte soubory do AstroCloudu',
      popis: 'Plocha, Dokumenty a Obrázky se budou zálohovat do AstroCloudu, takže o ně nepřijdete, ani když se počítač ztratí v černé díře.',
      tlacitka: [{ text: 'Ukládat soubory jen do tohoto počítače', hodnota: 'ne' }, { text: 'Zálohovat soubory', hlavni: true, hodnota: 'ano' }],
    });
    v.cloud = zal === 'ano';
    if (v.cloud) await strpeni('Připravujeme AstroCloud…', 2200);
  }
  const ai = await krok({
    ilu: 'ai', nadpis: 'Seznamte se s AstroAI',
    popis: 'AstroAI je asistent přímo v systému. Odpoví na otázky, pomůže s úkoly do školy a umí hledat na internetu. Běží na vašem počítači, nic neposílá do cloudu.',
    tlacitka: [{ text: 'Teď ne', hodnota: 'ne' }, { text: 'Zapnout AstroAI', hlavni: true, hodnota: 'ano' }],
  });
  v.ai = ai === 'ano';
  const gp = await krok({
    ilu: 'game', nadpis: 'Astro Game Pass Ultimate — první měsíc za 1 Kč',
    popis: 'Stovky her, mezi nimi Piškvorky, Pexeso i legendární Šibenice. Zrušit můžete kdykoli*.\n\n* kdykoli = po vyplnění 14 formulářů',
    tlacitka: [{ text: 'Ne, děkuji', hodnota: 'ne' }, { text: 'Získat za 1 Kč', hlavni: true, hodnota: 'ano' }],
  });
  if (gp === 'ano') {
    await strpeni('Ověřujeme nabídku…', 2000);
    await krok({
      ilu: 'game', nadpis: 'Nabídka právě vypršela',
      popis: 'Omlouváme se, tahle nabídka platila jen pro lidi, kteří kliknou na „Ne, děkuji“. Všechny hry z Obchodu jsou ale v AstroOS zdarma, takže o nic nepřicházíte.',
      tlacitka: [{ text: 'Pokračovat', hlavni: true }],
    });
  }
  const tel = await krok({
    ilu: 'phone', nadpis: 'Používejte telefon s počítačem',
    popis: 'Propojte telefon a čtěte zprávy, volejte a prohlížejte fotky přímo v AstroOS.',
    tlacitka: [{ text: 'Přeskočit', hlavni: true, hodnota: 'ne' }, { text: 'Propojit telefon', hodnota: 'ano' }],
  });
  if (tel === 'ano') {
    await strpeni('Hledáme telefon poblíž…', 3200);
    await krok({
      ilu: 'phone', nadpis: 'Žádný telefon jsme nenašli',
      popis: 'V okolí není žádný telefon s aplikací Astro Link. Můžete ho propojit později v Nastavení.',
      tlacitka: [{ text: 'Pokračovat', hlavni: true }],
    });
  }
}

// ---------------------------------------------------------------- Wi-Fi
async function krokWifi(v) {
  State.set('sit', null);   // na začátku nastavení není nikdo připojený
  if (!Sit.wifiZapnuta()) State.patch({ wifi: true, letadlo: false });

  return new Promise((resolve) => {
    let otevrena = null;
    const box = el('div.oobe-wifi');
    const nemam = el('button.oobe-odkaz.oobe-nemam', { text: 'Nemám internet', hidden: true });
    let dalsi;

    const vykresli = () => {
      box.replaceChildren();
      for (const s of Sit.vDosahu()) {
        const pripojena = Sit.aktualni()?.id === s.id;
        const r = el('div.oobe-sit' + (otevrena === s.id ? '.otevrena' : '') + (pripojena ? '.pripojena' : ''));
        const hlava = el('button.oobe-sit-hlava', {},
          el('span.oobe-sit-ic.s' + s.sila, {}, icon('wifi')),
          el('span.oobe-sit-t', {}, el('b', { text: s.ssid }),
            el('small', { text: pripojena ? 'Připojeno, zabezpečeno' : s.zabezpeceni ? 'Zabezpečeno' : 'Otevřená síť' })),
          s.zabezpeceni ? icon('lock') : null,
        );
        hlava.onclick = () => { otevrena = otevrena === s.id ? null : s.id; ui('jemny'); vykresli(); };
        r.append(hlava);
        if (otevrena === s.id) r.append(detail(s, pripojena));
        box.append(r);
      }
      dalsi.disabled = !Sit.online();
    };

    const detail = (s, pripojena) => {
      const d = el('div.oobe-sit-detail');
      if (pripojena) {
        d.append(el('div.oobe-sit-ok', {}, icon('check'), 'Připojeno'),
          tlacitko('Odpojit', { onclick: () => { Sit.odpoj(); vykresli(); } }));
        return d;
      }
      const auto = el('input', { type: 'checkbox', checked: true });
      // AstroNet bere sit.js jako vždy známou; při instalaci ale chceme heslo i k ní
      const znama = !!(State.get('sitZname') || {})[s.id];
      const heslo = s.zabezpeceni && !znama ? pole('Zadejte klíč zabezpečení sítě', { typ: 'password', max: 63 }) : null;
      const ch = chyba();
      const pripoj = tlacitko('Připojit', {
        hlavni: true,
        onclick: async () => {
          pripoj.disabled = true;
          heslo && (heslo.disabled = true);
          stav.replaceChildren(spinner(), el('span', { text: 'Ověřování a připojování…' }));
          const norm = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
          const res = heslo && norm(heslo.value) !== norm(s.heslo)
            ? (await cekej(1400), { ok: false, chyba: 'Heslo není správné.' })
            : await Sit.pripoj(s.id, s.heslo || '');
          stav.replaceChildren();
          if (!res.ok) {
            pripoj.disabled = false;
            if (heslo) { heslo.disabled = false; heslo.select(); }
            ukazChybu(ch, res.chyba + (s.id === 'astronet' ? ' Heslo najdete na štítku routeru.' : ''));
            return;
          }
          v.sit = s.id;
          otevrena = null;
          vykresli();
        },
      });
      const stav = el('div.oobe-sit-stav');
      d.append(el('label.oobe-zatrh', {}, auto, el('span', { text: 'Připojit automaticky' })));
      if (heslo) {
        heslo.onkeydown = (e) => { if (e.key === 'Enter') { e.stopPropagation(); pripoj.click(); } };
        d.append(heslo);
        if (s.id === 'astronet') d.append(el('button.oobe-odkaz', { text: 'Kde najdu heslo?', onclick: () => router(d) }));
      }
      d.append(ch, stav, el('div.oobe-sit-tl', {}, pripoj));
      return d;
    };

    const router = (kam) => {
      if (kam.querySelector('.oobe-router')) return;
      kam.append(el('div.oobe-router', {},
        el('div.oobe-router-hlava', { text: 'AstroNet Router AX2400' }),
        el('div.oobe-router-radky', {},
          el('span', { text: 'SSID:' }), el('b', { text: 'AstroNet' }),
          el('span', { text: 'Heslo Wi-Fi:' }), el('b', { text: 'astro-domov' }),
          el('span', { text: 'S/N:' }), el('b', { text: 'AX24-0091-7731' }),
        ),
        el('div.oobe-router-car'),
      ));
    };

    dalsi = tlacitko('Další', { hlavni: true, onclick: () => { clearTimeout(t); enterAkce = null; resolve(); } });
    nemam.onclick = async () => {
      clearTimeout(t);
      const h = await krok({
        ilu: 'wifiOff', nadpis: 'Bez internetu přijdete o spoustu věcí',
        popis: 'S připojením k internetu dostanete nejnovější aktualizace a Astro účet. Bez něj to bude omezené prostředí s místním účtem.',
        tlacitka: [{ text: 'Pokračovat s omezeným nastavením', hodnota: 'bez' }, { text: 'Připojit se hned', hlavni: true, hodnota: 'zpet' }],
      });
      if (h === 'bez') { v.sit = null; resolve(); return; }
      krokWifi(v).then(resolve);
    };
    // „Nemám internet“ se ukáže až po chvíli — jako ve Windows 11, kde ho schovávají
    const t = setTimeout(() => { nemam.hidden = false; }, 9000 * Math.max(rychlost, 0.3));

    const karta = root.querySelector('.oobe-karta') || kartaPozadi();
    karta.classList.remove('cekani');
    karta.replaceChildren(
      el('div.oobe-levy', {}, ilustrace('wifi')),
      el('div.oobe-pravy', {},
        el('h1', { text: 'Pojďme vás připojit k síti' }),
        el('p.oobe-popis', { text: 'K dokončení nastavení zařízení budete potřebovat připojení k internetu. Po připojení dostanete nejnovější funkce a aktualizace zabezpečení.' }),
        el('div.oobe-obsah', {}, box),
        el('div.oobe-tlac', {}, el('div.oobe-tlac-vlevo', {}, nemam), dalsi),
      ),
    );
    enterAkce = () => { if (!dalsi.disabled) dalsi.click(); };
    vykresli();
  });
}

async function aktualizace() {
  await strpeni('Kontrolujeme aktualizace…', 9000);
  const titul = el('span', { text: 'Stahování aktualizací: 0 %' });
  const karta = root.querySelector('.oobe-karta');
  karta.classList.add('cekani');
  karta.replaceChildren(el('div.oobe-strpeni', {}, spinner(), titul,
    el('small', { text: 'Může to chvíli trvat. Nevypínejte počítač.' })));
  for (const [nazev, ms] of [['Stahování aktualizací', 15000], ['Instalace aktualizací', 9000]]) {
    let p = 0;
    while (p < 100) {
      await cekej(ms / 25 * (0.4 + Math.random() * 1.2));
      p = Math.min(100, p + 2 + Math.floor(Math.random() * 6));
      titul.textContent = `${nazev}: ${p} %`;
    }
  }
  await cekej(1200);
  await restart('Instalace aktualizací', 6000, { procenta: false });
  kartaPozadi();
  await strpeni('Chvilku strpení…', 2000);
}

// ---------------------------------------------------------------- účet
const OTAZKY = [
  'Jak se jmenovalo vaše první domácí zvíře?',
  'Jak se jmenuje město, kde jste se narodili?',
  'Jaká byla vaše přezdívka v dětství?',
  'Jak se jmenovala vaše první škola?',
  'Jaké je vaše oblíbené jídlo?',
  'Jak se jmenuje vaše oblíbená hra?',
];

async function krokUcet(v) {
  if (!Sit.online()) return mistniUcet(v);

  for (;;) {
    const email = pole('E-mail nebo telefon', { typ: 'email', max: 80 });
    const ch = chyba();
    const moznosti = el('button.oobe-odkaz.s-ikonou', {}, icon('key'), 'Možnosti přihlášení');
    const r = krok({
      ilu: 'user', nadpis: 'Přidejte svůj Astro účet',
      popis: 'S Astro účtem máte nastavení, soubory a aplikace na všech zařízeních. Účet existuje jen v tomhle AstroOS, nikam se nic neposílá.',
      obsah: [email, ch, el('p.oobe-drobne', { text: 'Nemáte účet? Zadejte svůj e-mail a vytvoříme ho.' }), moznosti],
      tlacitka: [{
        text: 'Další', hlavni: true, hodnota: 'email',
        kontrola: async () => {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) { ukazChybu(ch, 'Zadejte platnou e-mailovou adresu, třeba jmeno@astro.cz.'); return false; }
          return true;
        },
      }],
    });
    const h = await Promise.race([r, new Promise((res) => { moznosti.onclick = () => { ui('jemny'); res('moznosti'); }; })]);

    if (h === 'moznosti') {
      const m = await new Promise((res) => {
        const karta = (ikona, nadpis, text, onclick) => el('button.oobe-volba-karta', { onclick: () => { ui('jemny'); onclick(); } },
          el('div.oobe-volba-ic', {}, icon(ikona)), el('div', {}, el('b', { text: nadpis }), el('span', { text })));
        krok({
          ilu: 'key', nadpis: 'Možnosti přihlášení',
          obsah: [el('div.oobe-volby', {},
            karta('computer', 'Offline účet', 'Místní účet jen pro tohle zařízení.', () => res('offline')),
            karta('key', 'Přihlásit se bezpečnostním klíčem', 'Použijte fyzický klíč USB.',
              () => dialog('Bezpečnostní klíč', 'Vložte bezpečnostní klíč do portu USB… Žádný jsme nenašli. Zkuste jinou možnost.')),
          )],
          tlacitka: [{ text: 'Zpět', hodnota: 'zpet' }],
        }).then(res);
      });
      if (m === 'offline') {
        const o = await krok({
          ilu: 'computer', nadpis: 'Opravdu chcete místní účet?',
          popis: 'S Astro účtem dostanete AstroCloud, synchronizaci nastavení a obnovení hesla e-mailem. Místní účet je omezené prostředí — ale funguje taky.',
          tlacitka: [{ text: 'Omezené prostředí', hodnota: 'ano' }, { text: 'Přihlásit se', hlavni: true, hodnota: 'zpet' }],
        });
        if (o === 'ano') return mistniUcet(v);
      }
      continue;
    }

    v.email = email.value.trim();
    await strpeni('Hledáme váš účet…', 2200);
    await astroUcet(v);
    return;
  }
}

async function astroUcet(v) {
  const heslo = pole('Vytvořte si heslo', { typ: 'password' });
  const heslo2 = pole('Potvrďte heslo', { typ: 'password', auto: false });
  const ch = chyba();
  await krok({
    ilu: 'lock', nadpis: 'Vytvořte si heslo',
    popis: `Účet ${v.email} zatím neexistuje, takže ho teď vytvoříme. Heslo budete používat k přihlášení do AstroOS.`,
    obsah: [heslo, heslo2, ch, el('p.oobe-drobne', { text: 'Aspoň 6 znaků. Kombinace písmen a číslic je nejlepší.' })],
    tlacitka: [{
      text: 'Další', hlavni: true,
      kontrola: async () => {
        if (heslo.value.length < 6) { ukazChybu(ch, 'Heslo musí mít aspoň 6 znaků.'); return false; }
        if (heslo.value !== heslo2.value) { ukazChybu(ch, 'Hesla se neshodují.'); return false; }
        return true;
      },
    }],
  });
  v.heslo = heslo.value;

  const jm = pole('Jméno'), pr = pole('Příjmení', { auto: false });
  const chj = chyba();
  await krok({
    ilu: 'user', nadpis: 'Jak se jmenujete?',
    popis: 'Potřebujeme ještě pár údajů, abychom mohli dokončit nastavení účtu.',
    obsah: [jm, pr, chj],
    tlacitka: [{ text: 'Další', hlavni: true, kontrola: async () => { if (!jm.value.trim()) { ukazChybu(chj, 'Zadejte jméno.'); return false; } return true; } }],
  });
  v.jmeno = jm.value.trim();
  v.prijmeni = pr.value.trim();

  const kod = String(1000 + Math.floor(Math.random() * 9000));
  const vstup = pole('0000', { max: 4 });
  vstup.classList.add('oobe-kod');
  const chk = chyba();
  setTimeout(() => upozorneni('Astro účet', `Váš bezpečnostní kód pro ${v.email}: ${kod}`), 2600 * Math.max(rychlost, 0.3));
  await krok({
    ilu: 'mail', nadpis: 'Ověřte e-mail',
    popis: `Na adresu ${v.email} jsme poslali čtyřmístný kód. Zadejte ho sem.`,
    obsah: [vstup, chk, el('button.oobe-odkaz', {
      text: 'Kód nepřišel? Poslat znovu',
      onclick: () => upozorneni('Astro účet', `Váš bezpečnostní kód pro ${v.email}: ${kod}`),
    })],
    tlacitka: [{ text: 'Další', hlavni: true, kontrola: async () => { if (vstup.value.trim() !== kod) { ukazChybu(chk, 'Kód nesouhlasí. Zkontrolujte upozornění vpravo nahoře.'); return false; } return true; } }],
  });
  document.querySelectorAll('.oobe-notif').forEach((n) => n.remove());
  await strpeni('Vytváříme váš účet…', 3200);
  v.hint = `heslo k Astro účtu ${v.email}`;
}

async function mistniUcet(v) {
  const jm = pole('Uživatelské jméno', { max: 20 });
  const ch = chyba();
  await krok({
    ilu: 'user', nadpis: 'Kdo bude používat toto zařízení?',
    popis: 'Jaké jméno chcete používat?',
    obsah: [jm, ch],
    tlacitka: [{
      text: 'Další', hlavni: true,
      kontrola: async () => {
        const n = jm.value.trim();
        if (!n) { ukazChybu(ch, 'Zadejte jméno.'); return false; }
        if (/^(admin|administrator|system|guest|host)$/i.test(n)) { ukazChybu(ch, 'Toto jméno je vyhrazené. Zvolte jiné.'); return false; }
        return true;
      },
    }],
  });
  v.jmeno = jm.value.trim();

  const heslo = pole('Heslo', { typ: 'password' });
  await krok({
    ilu: 'lock', nadpis: 'Vytvořte si heslo, které si zapamatujete',
    popis: 'Vyberte si něco, co si určitě zapamatujete. Bez hesla se do AstroOS dostane kdokoli.',
    obsah: [heslo],
    tlacitka: [{ text: 'Další', hlavni: true }],
  });
  v.heslo = heslo.value;
  if (v.heslo) {
    const h2 = pole('Heslo znovu', { typ: 'password' });
    const ch2 = chyba();
    await krok({
      ilu: 'lock', nadpis: 'Potvrďte heslo',
      obsah: [h2, ch2],
      tlacitka: [{ text: 'Další', hlavni: true, kontrola: async () => { if (h2.value !== v.heslo) { ukazChybu(ch2, 'Hesla se neshodují. Zkuste to znovu.'); h2.select(); return false; } return true; } }],
    });

    // tři bezpečnostní otázky, každá na vlastní obrazovce (ano, je to otrava — jako ve Windows)
    v.otazky = [];
    for (let i = 0; i < 3; i++) {
      const zbyle = OTAZKY.filter((q) => !v.otazky.some((o) => o.q === q));
      const sel = el('select.oobe-select', {}, el('option', { text: 'Vyberte bezpečnostní otázku (' + (i + 1) + ' ze 3)', value: '' }),
        ...zbyle.map((q) => el('option', { text: q, value: q })));
      const odp = pole('Vaše odpověď', { auto: false });
      const cho = chyba();
      await krok({
        ilu: 'shield', nadpis: 'Teď přidejte bezpečnostní otázky',
        popis: 'Pokud heslo zapomenete, tyhle otázky vám pomůžou dostat se zpátky do počítače.',
        obsah: [sel, odp, cho],
        tlacitka: [{
          text: 'Další', hlavni: true,
          kontrola: async () => {
            if (!sel.value) { ukazChybu(cho, 'Vyberte otázku.'); return false; }
            if (!odp.value.trim()) { ukazChybu(cho, 'Napište odpověď.'); return false; }
            return true;
          },
        }],
      });
      v.otazky.push({ q: sel.value, a: odp.value.trim() });
    }
    v.hint = 'Odpovězte na bezpečnostní otázky';
  } else v.hint = 'heslo je prázdné';
  await strpeni('Vytváříme místní účet…', 2400);
}

async function krokPin(v) {
  const h = await krok({
    ilu: 'pinKod', nadpis: 'Vytvořte si PIN',
    popis: 'PIN je rychlejší a bezpečnější způsob přihlášení do AstroOS. Na zamykací obrazovce ho můžete zadat místo hesla.',
    tlacitka: [{ text: 'Teď ne', hodnota: 'ne' }, { text: 'Vytvořit PIN', hlavni: true, hodnota: 'ano' }],
  });
  if (h === 'ne') return;
  const p1 = pole('Nový PIN', { typ: 'password', max: 8 }), p2 = pole('Potvrdit PIN', { typ: 'password', max: 8, auto: false });
  p1.inputMode = p2.inputMode = 'numeric';
  const ch = chyba();
  await krok({
    ilu: 'pinKod', nadpis: 'Nastavte si PIN',
    popis: 'Jen číslice, aspoň 4.',
    obsah: [p1, p2, ch],
    tlacitka: [{
      text: 'OK', hlavni: true,
      kontrola: async () => {
        if (!/^\d{4,8}$/.test(p1.value)) { ukazChybu(ch, 'PIN musí mít 4 až 8 číslic.'); return false; }
        if (/^(\d)\1+$/.test(p1.value) || '0123456789'.includes(p1.value) || '9876543210'.includes(p1.value)) {
          ukazChybu(ch, 'Tenhle PIN je moc jednoduchý. Zvolte jiný.'); return false;
        }
        if (p1.value !== p2.value) { ukazChybu(ch, 'PINy se neshodují.'); return false; }
        return true;
      },
    }],
  });
  v.pin = p1.value;
  await strpeni('Nastavujeme PIN…', 1600);
}

async function krokSoukromi(v) {
  const POLOZKY = [
    ['poloha', 'Poloha', 'Aplikace jako Počasí a Mapy můžou zjistit, kde jste.'],
    ['najit', 'Najít moje zařízení', 'Když zařízení ztratíte, pomůžeme vám ho najít. (Ve vesmíru zatím ne.)'],
    ['diagnostika', 'Diagnostická data', 'Posílat jen povinná diagnostická data. (Stejně se nikam neposílají.)'],
    ['psani', 'Rukopis a psaní', 'Vylepšovat rozpoznávání toho, co píšete.'],
    ['prizpusobene', 'Přizpůsobené prostředí', 'Tipy a doporučení podle toho, jak AstroOS používáte.'],
    ['reklama', 'ID inzerce', 'Aplikace vám můžou ukazovat reklamy podle vašich zájmů.'],
  ];
  v.soukromi = {};
  const obsah = el('div.oobe-soukromi', {}, ...POLOZKY.map(([id, nazev, popis]) => {
    v.soukromi[id] = true;
    return el('div.oobe-souk', {},
      el('div', {}, el('b', { text: nazev }), el('span', { text: popis })),
      prepinacAnoNe(true, (x) => { v.soukromi[id] = x; }),
    );
  }));
  const tl = { text: 'Další', hlavni: true };
  let svitek = null;   // .oobe-obsah — posouvá se celý obsah karty
  const dole = () => !svitek || svitek.scrollTop + svitek.clientHeight >= svitek.scrollHeight - 6;
  // tlačítko „Další“ nejdřív jen posouvá dolů, „Přijmout“ až na konci (taky jako ve Windows)
  tl.kontrola = async () => {
    if (dole()) return true;
    svitek.scrollBy({ top: svitek.clientHeight * 0.8, behavior: 'smooth' });
    return false;
  };
  const p = krok({
    ilu: 'shield', nadpis: 'Zvolte nastavení ochrany osobních údajů pro své zařízení',
    popis: 'Vyberte, jaká nastavení chcete. Všechno jde později změnit v Nastavení.',
    obsah: [obsah],
    tlacitka: [tl],
  });
  svitek = obsah.parentNode;
  const zkontroluj = () => { tl.uzel.textContent = dole() ? 'Přijmout' : 'Další'; };
  svitek.addEventListener('scroll', zkontroluj);
  setTimeout(zkontroluj, 60);
  await p;
  await strpeni('Ukládáme nastavení…', 1600);
}

async function krokVzhled(v) {
  v.motiv = State.get('motiv') === 'svetly' ? 'svetly' : 'tmavy';
  v.accent = ACCENTS[State.get('accent')] ? State.get('accent') : 'green';
  v.wallpaper = WALLPAPERS[State.get('wallpaper')] ? State.get('wallpaper') : 'aurora';
  v.rohy = State.get('rohy') || 'normal';

  const skupina = (nadpis, polozky, aktivni, onVyber, trida = '') => {
    const box = el('div.oobe-vzhled-sk' + trida);
    const uzly = polozky.map(([id, obsahUzel, popisek]) => {
      const b = el('button.oobe-vzhled-v' + (id === aktivni ? '.on' : ''), { title: popisek || '' }, obsahUzel, popisek ? el('span', { text: popisek }) : null);
      b.onclick = () => { uzly.forEach((x) => x.classList.remove('on')); b.classList.add('on'); ui('jemny'); onVyber(id); };
      return b;
    });
    box.append(...uzly);
    return el('div.oobe-vzhled-blok', {}, el('h4', { text: nadpis }), box);
  };

  const nahledMotivu = (svetly) => el('div.oobe-nahled' + (svetly ? '.svetly' : ''), {}, el('i'), el('i'), el('i'));
  const tapeta = (id) => {
    const w = WALLPAPERS[id];
    return el('div.oobe-tapeta', { style: { background: w.image ? `url("${w.image}") center/cover, ${w.base}` : w.base } });
  };

  const obsah = [
    skupina('Motiv', [['tmavy', nahledMotivu(false), 'Tmavý'], ['svetly', nahledMotivu(true), 'Světlý']], v.motiv,
      (id) => { v.motiv = id; State.set('motiv', id); root.toggleAttribute('data-svetly', id === 'svetly'); }),
    skupina('Barva zvýraznění', Object.entries(ACCENTS).map(([id, a]) => [id, el('i.oobe-barva', { style: { background: a.accent } }), null]), v.accent,
      (id) => { v.accent = id; State.set('accent', id); applyAccent(id); }, '.barvy'),
    skupina('Tapeta', Object.keys(WALLPAPERS).map((id) => [id, tapeta(id), null]), v.wallpaper,
      (id) => { v.wallpaper = id; State.set('wallpaper', id); applyWallpaper(id); }, '.tapety'),
    skupina('Rohy oken', [['ostre', el('i.oobe-roh.ostre'), 'Ostré'], ['normal', el('i.oobe-roh'), 'Jako Windows 11'], ['kulate', el('i.oobe-roh.kulate'), 'Kulaté jako Mint']], v.rohy,
      (id) => { v.rohy = id; State.set('rohy', id); }),
  ];
  await krok({
    ilu: 'palette', nadpis: 'Jak má AstroOS vypadat?',
    popis: 'Změny se projeví hned. Na pozadí za tímhle oknem vidíte vybranou tapetu.',
    obsah: [el('div.oobe-vzhled', {}, ...obsah)],
    tlacitka: [{ text: 'Další', hlavni: true }],
  });
}

// ================================================================ konec: „Ahoj“
async function dokonci(v) {
  enterAkce = null;
  const jmeno = v.jmeno || 'uživateli';
  const ubehlo = Date.now() - zacatek;
  const delka = Math.max(26000, Math.min(MIN_DELKA - ubehlo, MAX_DOROVNANI)) * (rychlost < 1 ? rychlost * 2 : 1);
  const TEXTY = [`Ahoj, ${jmeno}`, 'Připravujeme pro vás vše', 'Instalujeme aplikace', 'Může to trvat několik minut',
    'Nevypínejte počítač', 'Ještě pár drobností', 'Už to skoro je', 'Pojďme na to'];

  root.dataset.faze = 'ahoj';
  const t = el('div.oobe-ahoj-t');
  root.replaceChildren(el('div.oobe-ahoj', {}, t, el('div.oobe-ahoj-pruh', {}, el('i'))));
  root.style.setProperty('--ahoj-delka', delka + 'ms');
  for (let i = 0; i < TEXTY.length; i++) {
    t.classList.remove('vidi');
    await cekej(700);
    t.textContent = TEXTY[i];
    t.classList.add('vidi');
    await sleep(Math.max(300, (delka / TEXTY.length) - 700 * rychlost));
  }
  await cekej(1400);
  t.classList.remove('vidi');
  await cekej(900);

  // zapsat výsledek
  const sitZname = { ...(State.get('sitZname') || {}) };
  // Po čisté instalaci začít od výchozího stavu — moduly načtené před smazáním (Defender, ovladače…)
  // mohly mezitím do State zapsat svoje stará data z paměti.
  const zvuky = State.get('zvuky');
  if (v.cista) { State.reset(); State.data.zvuky = zvuky; }
  const user = {
    name: jmeno,
    password: v.heslo || '',
    hint: v.hint || 'žádná nápověda',
    avatar: jmeno[0].toUpperCase(),
    email: v.email || null,
    pin: v.pin || null,
    otazky: v.otazky || null,
    prijmeni: v.prijmeni || '',
  };
  State.patch({
    user,
    jmenoPc: v.jmenoPc,
    region: { zeme: v.zeme, jazyk: v.jazyk, format: v.format, klavesnice: v.klavesnice, klavesnice2: v.klavesnice2 || null },
    motiv: v.motiv, accent: v.accent, wallpaper: v.wallpaper, rohy: v.rohy,
    sit: v.sit ?? null, sitZname,
    soukromi: v.soukromi, zajmy: v.zajmy, astroCloud: !!v.cloud,
    aiRezim: v.ai ? 'auto' : 'mistni',
    aktivovano: v.aktivovano, produktKlic: v.produktKlic, edice: v.edice,
    oobeHotovo: true, poOobe: true, firstRun: true, fastboot: true,
    installed: Date.now(),
  });
  document.getElementById('fader')?.classList.add('on');
  await sleep(500);
  location.reload();
  await new Promise(() => {});
}

// ================================================================ reset počítače (z Nastavení)
/** Obrazovka „Resetování tohoto počítače“. zachovat = soubory zůstanou, jinak se smaže všechno. */
export async function resetujPocitac(zachovat) {
  const scr = el('div.oobe.oobe-reset', { 'data-faze': 'cerna' });
  document.body.append(scr);
  const t = el('div.oobe-restart-t', { text: 'Resetování tohoto počítače 0 %' });
  scr.append(el('div.oobe-restart', {}, logo('oobe-restart-logo'), spinner(), t));
  let p = 0;
  while (p < 100) {
    await sleep(140 + Math.random() * 260);
    p = Math.min(100, p + 1 + Math.floor(Math.random() * 4));
    t.textContent = `Resetování tohoto počítače ${p} %`;
  }
  try {
    if (zachovat) localStorage.removeItem('astroos.v1');
    else for (const k of Object.keys(localStorage)) if (k.startsWith('astroos.')) localStorage.removeItem(k);
  } catch { /* nevadí */ }
  // nic už nesmí stav zapsat zpátky
  State.save = () => {};
  t.textContent = 'Restartování';
  await sleep(1800);
  location.reload();
}
