// AstroPísmo — pás karet (ribbon) jako ve Wordu
//
// Každé tlačítko se registruje do P.prikazy (hledání v titulku „Hledat“) a případně do
// P.stavy (zapnuto/vypnuto podle výběru). Obsah karty se staví až při prvním otevření.

import { el } from '../util.js';
import { ik } from './ikony.js';
import { rozbal, zavriRozbal, nabidka, paleta, paletaZvyrazneni } from './ui.js';
import { PISMA, VELIKOSTI_PISMA, STYLY, VELIKOSTI, OKRAJE, zasobnikPisma, MM } from './dokument.js';
import * as D from './dialogy.js';

// ---------------------------------------------------------------- stavební kameny
function zadrz(uzel) {
  // klik do pásu karet nesmí vzít editoru výběr
  uzel.addEventListener('mousedown', (e) => { if (!e.target.closest('input, select')) e.preventDefault(); });
  return uzel;
}

function registruj(P, text, ikona, akce, klavesa) {
  if (text && akce) P.prikazy.push({ text, ikona, akce, klavesa });
}

/** Velké tlačítko (ikona nad popiskem). rozbal = funkce vracející obsah nabídky. */
function velke(P, { ik: ikona, text, akce, rozbal: obsah, titulek, klavesa, stav, zakazano, deleno }) {
  const popis = el('span.ps-b-popis', {}, ...text.split('\n').map((r, i, a) => [r, i < a.length - 1 ? el('br') : null]).flat());
  if (obsah && !deleno) popis.append(el('span.ps-b-sipka', {}, ik('sipkaDolu')));
  let b;
  if (deleno && obsah) {
    const horni = el('button.ps-b-horni', { type: 'button', title: titulek || text.replace('\n', ' '), onclick: akce }, ik(ikona));
    const dolni = el('button.ps-b-dolni', { type: 'button', title: titulek || text.replace('\n', ' ') }, popis, el('span.ps-b-sipka', {}, ik('sipkaDolu')));
    dolni.onclick = () => rozbal(dolni, obsah());
    b = el('div.ps-b.velke.deleno', {}, horni, dolni);
  } else {
    b = el('button.ps-b.velke', { type: 'button', title: (titulek || text.replace('\n', ' ')) + (klavesa ? ` (${klavesa})` : '') }, ik(ikona), popis);
    b.onclick = () => (obsah ? rozbal(b, obsah()) : akce?.());
  }
  if (zakazano) { b.classList.add('zakazano'); b.querySelectorAll('button').forEach((x) => (x.disabled = true)); if (b.tagName === 'BUTTON') b.disabled = true; }
  if (stav) P.stavy.push({ uzel: b, fn: stav });
  if (!zakazano) registruj(P, titulek || text.replace('\n', ' '), ikona, akce || (() => rozbal(b, obsah())), klavesa);
  return zadrz(b);
}

/** Malé tlačítko 24 px, volitelně s popiskem vpravo. */
function male(P, { ik: ikona, text, akce, titulek, klavesa, stav, zakazano, rozbal: obsah }) {
  const b = el('button.ps-b.male' + (text ? '.s-textem' : ''), {
    type: 'button', title: (titulek || text || '') + (klavesa ? ` (${klavesa})` : ''),
  }, ik(ikona), text ? el('span', { text }) : null, obsah ? el('span.ps-b-sipka', {}, ik('sipkaDolu')) : null);
  b.onclick = () => (obsah ? rozbal(b, obsah()) : akce?.());
  if (zakazano) { b.disabled = true; b.classList.add('zakazano'); }
  if (stav) P.stavy.push({ uzel: b, fn: stav });
  if (!zakazano) registruj(P, titulek || text, ikona, akce || (() => rozbal(b, obsah())), klavesa);
  return zadrz(b);
}

/** Dělené malé tlačítko: ikona provede akci, šipka otevře nabídku. */
function delene(P, { ik: ikona, akce, rozbal: obsah, titulek, klavesa, stav, barva }) {
  const pruh = barva ? el('span.ps-b-pruh', { style: { background: barva() } }) : null;
  const hlavni = el('button.ps-b-cast', { type: 'button', title: titulek + (klavesa ? ` (${klavesa})` : ''), onclick: akce }, ik(ikona), pruh);
  const sipka = el('button.ps-b-cast.sipka', { type: 'button', title: titulek }, ik('sipkaDolu'));
  const b = el('div.ps-b.male.deleno', {}, hlavni, sipka);
  sipka.onclick = () => rozbal(b, obsah());
  if (stav) P.stavy.push({ uzel: b, fn: stav });
  if (barva) P.obnovy.push(() => { pruh.style.background = barva(); });
  registruj(P, titulek, ikona, akce, klavesa);
  return zadrz(b);
}

const radek = (...k) => el('div.ps-radek', {}, k);
const sloupec = (...k) => el('div.ps-sloupec', {}, k);
const oddelovac = () => el('div.ps-svisla');

/** Skupina pásu karet s názvem dole a volitelným spouštěčem dialogu ↘. priorita = pořadí sbalování (nižší dřív). */
function skupina(nazev, obsah, { spoustec, priorita = 5, ikona = 'informace' } = {}) {
  const telo = el('div.ps-sk-telo', {}, obsah);
  const sbaleno = el('button.ps-b.velke.ps-sk-sbaleno', { type: 'button', title: nazev }, ik(ikona), el('span.ps-b-popis', {}, nazev, el('span.ps-b-sipka', {}, ik('sipkaDolu'))));
  const s = el('div.ps-skupina', { dataset: { priorita } },
    telo, sbaleno,
    el('div.ps-sk-nazev', {}, el('span', { text: nazev }),
      spoustec ? zadrz(el('button.ps-spoustec', { type: 'button', title: nazev + ' – další možnosti', onclick: spoustec },
        el('svg', {}))) : null));
  // svg v el() nejde vytvořit správně — nahradíme
  const sp = s.querySelector('.ps-spoustec');
  if (sp) sp.innerHTML = '<svg viewBox="0 0 10 10"><path d="M1.5 1.5h7v7M8.5 8.5 3 3M8.5 8.5V5M8.5 8.5H5" fill="none" stroke="currentColor" stroke-width="1"/></svg>';
  sbaleno.onclick = () => {
    const vnitrek = el('div.ps-sk-rozbalena');
    vnitrek.append(telo);
    rozbal(sbaleno, vnitrek, { poZavreni: () => s.prepend(telo) });
  };
  zadrz(sbaleno);
  return s;
}

// ---------------------------------------------------------------- pole pro písmo a velikost
function kombo(P, { hodnoty, sirka, zobraz, aplikuj, titulek, nahled, pismaMotivu = ['Aptos Display (Nadpisy)', 'Aptos (Základní text)'] }) {
  const vstup = el('input.ps-kombo-vstup', { type: 'text', spellcheck: 'false', title: titulek, style: { width: sirka + 'px' } });
  const sipka = el('button.ps-kombo-sipka', { type: 'button', tabindex: '-1', title: titulek }, ik('sipkaDolu'));
  const k = el('div.ps-kombo', {}, vstup, sipka);
  const otevri = () => {
    const seznam = el('div.ps-nabidka.ps-kombo-seznam', { style: { width: Math.max(sirka + 24, nahled ? 250 : 60) + 'px' } },
      nahled ? el('div.ps-nab-nadpis', { text: 'Písma motivu' }) : null,
      (nahled ? pismaMotivu : []).map((h) => polozka(h)),
      nahled ? el('div.ps-nab-nadpis', { text: 'Všechna písma' }) : null,
      hodnoty().map((h) => polozka(h)));
    function polozka(h) {
      const vybrano = String(h) === vstup.value;
      return el('button.ps-nab-polozka.ps-kombo-pol' + (vybrano ? '.zaskrtnuto' : ''), {
        type: 'button',
        style: nahled ? { fontFamily: zasobnikPisma(String(h).replace(/ \(.*\)$/, '')), fontSize: '15px' } : null,
        onclick: () => { zavriRozbal(); vstup.value = h; aplikuj(String(h)); },
      }, String(h));
    }
    const u = rozbal(k, seznam);
    u?.querySelector('.zaskrtnuto')?.scrollIntoView({ block: 'center' });
  };
  sipka.onclick = otevri;
  zadrz(sipka);
  vstup.addEventListener('focus', () => vstup.select());
  vstup.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); aplikuj(vstup.value.trim()); }
    if (e.key === 'Escape') { P.dok.vratVyber(); }
    if (e.key === 'ArrowDown' && e.altKey) otevri();
  });
  P.obnovy.push(() => { if (document.activeElement !== vstup) vstup.value = zobraz(); });
  return k;
}

// ---------------------------------------------------------------- společné akce
const exec = (P, prikaz, hodnota = null, popis = '') => P.prikaz(() => document.execCommand(prikaz, false, hodnota), popis || prikaz);
// null = fokus je mimo dokument (podokno, dialog) → tlačítko si nechá poslední stav
const stav = (prikaz) => () => {
  if (!document.activeElement?.classList?.contains('ps-ed')) return null;
  try { return document.queryCommandState(prikaz); } catch { return false; }
};

function nastavVelikost(P, v) {
  const n = parseFloat(String(v).replace(',', '.'));
  if (!n || n < 1 || n > 1638) return;
  P.dok.velikostCeka = n;
  P.prikaz(() => {
    document.execCommand('fontSize', false, '7');
    P.dok.normalizuj();
  }, 'Velikost písma');
}

function nastavPismo(P, jmeno) {
  const p = jmeno.replace(/ \(.*\)$/, '');
  if (!p) return;
  P.prikaz(() => document.execCommand('fontName', false, zasobnikPisma(p)), 'Písmo');
}

function zmenVelikost(P, smer) {
  const akt = P.stav.velikost || 12;
  const dalsi = smer > 0 ? VELIKOSTI_PISMA.find((v) => v > akt) || akt + 10 : [...VELIKOSTI_PISMA].reverse().find((v) => v < akt) || Math.max(1, akt - 1);
  nastavVelikost(P, dalsi);
}

export function zmenVelikostPismen(P, typ) {
  P.prikaz(() => P.dok.upravText((t) => {
    if (typ === 'mala') return t.toLocaleLowerCase('cs');
    if (typ === 'velka') return t.toLocaleUpperCase('cs');
    if (typ === 'slova') return t.toLocaleLowerCase('cs').replace(/(^|[\s(„"-])(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase('cs'));
    if (typ === 'prepnout') return [...t].map((c) => (c === c.toLocaleUpperCase('cs') ? c.toLocaleLowerCase('cs') : c.toLocaleUpperCase('cs'))).join('');
    // jako ve větě
    return t.toLocaleLowerCase('cs').replace(/(^\s*|[.!?]\s+)(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase('cs'));
  }), 'Změnit velikost písmen');
}

function naBloky(P, fn, popis) {
  P.prikaz(() => { for (const b of P.dok.vybraneBloky()) fn(b); }, popis);
}

export function styl(P, id) {
  const s = STYLY.find((x) => x.id === id);
  if (!s) return;
  if (s.znak) {
    P.prikaz(() => P.dok.obalVyber((sp) => {
      if (id === 'jemne') { sp.style.fontStyle = 'italic'; sp.style.color = '#404040'; }
      if (id === 'zduraz') sp.style.fontStyle = 'italic';
      if (id === 'silne') sp.style.fontWeight = '700';
    }), s.nazev);
    return;
  }
  P.prikaz(() => {
    // v seznamu formatBlock rozbije odrážku — nejdřív seznam zrušíme
    const li = P.dok.blokKurzoru()?.closest('li');
    if (li) P.dok.prepniSeznam(li.parentElement.tagName.toLowerCase());
    document.execCommand('formatBlock', false, id);
  }, 'Styl ' + s.nazev);
}

export function seznam(P, typ, styl) {
  P.prikaz(() => P.dok.prepniSeznam(typ, styl), typ === 'ol' ? 'Číslování' : 'Odrážky');
}

function odsazeni(P, smer) {
  const li = P.dok.blokKurzoru()?.closest('li');
  if (li) return exec(P, smer > 0 ? 'indent' : 'outdent', null, 'Odsazení');
  naBloky(P, (b) => {
    const m = (parseFloat(b.style.marginLeft) || 0) + smer * 1.25 * 10 * MM;
    b.style.marginLeft = m > 0.5 ? m.toFixed(1) + 'px' : '';
  }, 'Odsazení');
}

function radkovani(P, v) {
  naBloky(P, (b) => { b.style.lineHeight = v ? String(+(v * 1.17).toFixed(3)) : ''; }, 'Řádkování');
}

const OHRANICENI = {
  dolni: ['Dolní ohraničení', { borderBottom: '0.75pt solid #000', paddingBottom: '1pt' }],
  horni: ['Horní ohraničení', { borderTop: '0.75pt solid #000', paddingTop: '1pt' }],
  leve: ['Levé ohraničení', { borderLeft: '0.75pt solid #000', paddingLeft: '4pt' }],
  prave: ['Pravé ohraničení', { borderRight: '0.75pt solid #000', paddingRight: '4pt' }],
  vsechna: ['Všechna ohraničení', { border: '0.75pt solid #000', padding: '1pt 4pt' }],
  vnejsi: ['Vnější ohraničení', { border: '0.75pt solid #000', padding: '1pt 4pt' }],
};

// ---------------------------------------------------------------- karta Domů
function kartaDomu(P) {
  const d = P.dok;
  let posledniZvyr = '#FFFF00', posledniBarva = '#FF0000', posledniStin = null;

  const schranka = skupina('Schránka', [
    velke(P, {
      ik: 'vlozit', text: 'Vložit', deleno: true, klavesa: 'Ctrl+V', akce: () => P.vlozit(false),
      rozbal: () => nabidka([
        { nadpis: 'Možnosti vložení:' },
        { text: 'Zachovat formátování zdroje (Z)', ikona: 'vlozit', akce: () => P.vlozit(false) },
        { text: 'Ponechat pouze text (P)', ikona: 'novy', akce: () => P.vlozit(true) },
      ]),
    }),
    sloupec(
      male(P, { ik: 'vyjmout', titulek: 'Vyjmout', klavesa: 'Ctrl+X', akce: () => exec(P, 'cut', null, 'Vyjmout') }),
      male(P, { ik: 'kopirovat', titulek: 'Kopírovat', klavesa: 'Ctrl+C', akce: () => { d.vratVyber(); document.execCommand('copy'); } }),
      male(P, { ik: 'stetec', titulek: 'Kopírovat formát', klavesa: 'Ctrl+Shift+C', akce: () => P.stetec(), stav: () => !!P.st.stetec }),
    ),
  ], { spoustec: () => P.podokno('schranka'), priorita: 3, ikona: 'vlozit' });

  const pismo = skupina('Písmo', [
    radek(
      kombo(P, {
        titulek: 'Písmo (Ctrl+Shift+F)', sirka: 116, nahled: true, hodnoty: () => PISMA,
        zobraz: () => P.stav.pismoPopis || '', aplikuj: (v) => nastavPismo(P, v),
      }),
      kombo(P, {
        titulek: 'Velikost písma (Ctrl+Shift+P)', sirka: 30, hodnoty: () => VELIKOSTI_PISMA.map((v) => String(v).replace('.', ',')),
        zobraz: () => (P.stav.velikost ? String(P.stav.velikost).replace('.', ',') : ''), aplikuj: (v) => nastavVelikost(P, v),
      }),
      male(P, { ik: 'zvetsit', titulek: 'Zvětšit písmo', klavesa: 'Ctrl+>', akce: () => zmenVelikost(P, 1) }),
      male(P, { ik: 'zmensit', titulek: 'Zmenšit písmo', klavesa: 'Ctrl+<', akce: () => zmenVelikost(P, -1) }),
      oddelovac(),
      male(P, {
        ik: 'velikostPismen', titulek: 'Velká a malá písmena', rozbal: () => nabidka([
          { text: 'Jako ve větě.', akce: () => zmenVelikostPismen(P, 'veta') },
          { text: 'malá písmena', akce: () => zmenVelikostPismen(P, 'mala') },
          { text: 'VELKÁ PÍSMENA', akce: () => zmenVelikostPismen(P, 'velka') },
          { text: 'Velká Na Začátku Slov', akce: () => zmenVelikostPismen(P, 'slova') },
          { text: 'pŘEPNOUT vELIKOST pÍSMEN', akce: () => zmenVelikostPismen(P, 'prepnout') },
        ]),
      }),
      male(P, {
        ik: 'vymazatFormat', titulek: 'Vymazat veškeré formátování', akce: () => P.prikaz(() => {
          document.execCommand('removeFormat');
          document.execCommand('unlink');
          for (const b of d.vybraneBloky()) if (!b.matches('li, td, th')) b.removeAttribute('style');
          document.execCommand('formatBlock', false, 'p');
        }, 'Vymazat formátování'),
      }),
    ),
    radek(
      male(P, { ik: 'tucne', titulek: 'Tučné', klavesa: 'Ctrl+B', akce: () => exec(P, 'bold', null, 'Tučné'), stav: stav('bold') }),
      male(P, { ik: 'kurziva', titulek: 'Kurzíva', klavesa: 'Ctrl+I', akce: () => exec(P, 'italic', null, 'Kurzíva'), stav: stav('italic') }),
      delene(P, {
        ik: 'podtrzeni', titulek: 'Podtržení', klavesa: 'Ctrl+U', akce: () => exec(P, 'underline', null, 'Podtržení'), stav: stav('underline'),
        rozbal: () => nabidka([
          ...[['solid', 'Jednoduché'], ['double', 'Dvojité'], ['dotted', 'Tečkované'], ['dashed', 'Čárkované'], ['wavy', 'Vlnovka']].map(([v, n]) => ({
            text: n, styl: { textDecoration: 'underline', textDecorationStyle: v, textUnderlineOffset: '3px' },
            akce: () => P.prikaz(() => d.obalVyber((s) => { s.style.textDecoration = `underline ${v}`; }), 'Podtržení'),
          })),
          'sep',
          { text: 'Barva podtržení…', akce: () => rozbalPozdeji(P, '.ps-b.deleno', (k) => paleta({ auto: 'Automaticky', onVyber: (b) => P.prikaz(() => d.obalVyber((s) => { s.style.textDecoration = 'underline'; s.style.textDecorationColor = b === 'auto' ? '' : b; }), 'Barva podtržení') })) },
        ]),
      }),
      male(P, { ik: 'preskrtnuti', titulek: 'Přeškrtnutí', akce: () => exec(P, 'strikeThrough', null, 'Přeškrtnutí'), stav: stav('strikeThrough') }),
      male(P, { ik: 'dolniIndex', titulek: 'Dolní index', klavesa: 'Ctrl+=', akce: () => exec(P, 'subscript', null, 'Dolní index'), stav: stav('subscript') }),
      male(P, { ik: 'horniIndex', titulek: 'Horní index', klavesa: 'Ctrl+Shift++', akce: () => exec(P, 'superscript', null, 'Horní index'), stav: stav('superscript') }),
      oddelovac(),
      male(P, {
        ik: 'efekty', titulek: 'Textové efekty a typografie', rozbal: () => nabidka([
          { nadpis: 'Efekty' },
          ...[
            ['Obrys', { textShadow: '-0.6px -0.6px 0 #0f6cbd, 0.6px -0.6px 0 #0f6cbd, -0.6px 0.6px 0 #0f6cbd, 0.6px 0.6px 0 #0f6cbd', color: '#fff' }],
            ['Stín', { textShadow: '2px 2px 3px rgba(0,0,0,.4)' }],
            ['Odraz', { textShadow: '0 6px 2px rgba(0,0,0,.12)' }],
            ['Záře', { textShadow: '0 0 6px #4ea72e, 0 0 10px #4ea72e' }],
            ['Kapitálky', { fontVariant: 'small-caps' }],
            ['Rozšířené proložení', { letterSpacing: '2px' }],
          ].map(([n, s]) => ({ text: n, styl: s, akce: () => P.prikaz(() => d.obalVyber((sp) => Object.assign(sp.style, s)), n) })),
          'sep',
          { text: 'Bez efektů', akce: () => P.prikaz(() => d.obalVyber((sp) => Object.assign(sp.style, { textShadow: 'none', fontVariant: 'normal', letterSpacing: 'normal' })), 'Bez efektů') },
        ], { sirka: 230 }),
      }),
      delene(P, {
        ik: 'zvyraznovac', titulek: 'Barva zvýraznění textu', barva: () => posledniZvyr || 'transparent',
        akce: () => exec(P, 'hiliteColor', posledniZvyr || 'transparent', 'Zvýraznění'),
        rozbal: () => paletaZvyrazneni((b) => { posledniZvyr = b; P.obnov(); exec(P, 'hiliteColor', b || 'transparent', 'Zvýraznění'); }),
      }),
      delene(P, {
        ik: 'barvaPisma', titulek: 'Barva písma', barva: () => posledniBarva,
        akce: () => exec(P, 'foreColor', posledniBarva, 'Barva písma'),
        rozbal: () => paleta({
          onVyber: (b) => { const c = b === 'auto' ? '#000000' : b; if (b !== 'auto') posledniBarva = b; P.obnov(); exec(P, 'foreColor', c, 'Barva písma'); },
        }),
      }),
    ),
  ], { spoustec: () => D.dialogPismo(P), priorita: 8, ikona: 'barvaPisma' });

  const odstavec = skupina('Odstavec', [
    radek(
      delene(P, {
        ik: 'odrazky', titulek: 'Odrážky', akce: () => seznam(P, 'ul'), stav: () => P.stav.seznam === 'UL',
        rozbal: () => el('div.ps-knihovna', {},
          el('div.ps-nab-nadpis', { text: 'Knihovna odrážek' }),
          el('div.ps-knihovna-mrizka', {}, [['disc', '●'], ['circle', '○'], ['square', '■'], ['"❖  "', '❖'], ['"➢  "', '➢'], ['"✓  "', '✓'], ['"–  "', '–']].map(([s, z]) =>
            el('button.ps-knihovna-pol', { type: 'button', onclick: () => { zavriRozbal(); seznam(P, 'ul', s); } }, el('span', { text: z }))))),
      }),
      delene(P, {
        ik: 'cislovani', titulek: 'Číslování', akce: () => seznam(P, 'ol'), stav: () => P.stav.seznam === 'OL',
        rozbal: () => el('div.ps-knihovna', {},
          el('div.ps-nab-nadpis', { text: 'Knihovna číslování' }),
          el('div.ps-knihovna-mrizka.velka', {}, [['decimal', '1.\n2.\n3.'], ['upper-roman', 'I.\nII.\nIII.'], ['upper-alpha', 'A.\nB.\nC.'], ['lower-alpha', 'a)\nb)\nc)'], ['lower-roman', 'i.\nii.\niii.'], ['decimal-leading-zero', '01.\n02.\n03.']].map(([s, z]) =>
            el('button.ps-knihovna-pol', { type: 'button', onclick: () => { zavriRozbal(); seznam(P, 'ol', s); } }, el('pre', { text: z }))))),
      }),
      male(P, {
        ik: 'viceurovnovy', titulek: 'Víceúrovňový seznam', rozbal: () => el('div.ps-knihovna', {},
          el('div.ps-nab-nadpis', { text: 'Knihovna seznamů' }),
          el('div.ps-knihovna-mrizka.velka', {},
            el('button.ps-knihovna-pol', { type: 'button', onclick: () => { zavriRozbal(); seznam(P, 'ol', 'viceur'); } }, el('pre', { text: '1.\n  a.\n    i.' })),
            el('button.ps-knihovna-pol', { type: 'button', onclick: () => { zavriRozbal(); seznam(P, 'ol', 'decimal'); } }, el('pre', { text: '1.\n  1.\n    1.' })))),
      }),
      oddelovac(),
      male(P, { ik: 'zmensitOdsazeni', titulek: 'Zmenšit odsazení', akce: () => odsazeni(P, -1) }),
      male(P, { ik: 'zvetsitOdsazeni', titulek: 'Zvětšit odsazení', akce: () => odsazeni(P, 1) }),
      oddelovac(),
      male(P, { ik: 'seradit', titulek: 'Seřadit', akce: () => D.dialogSeradit(P) }),
      male(P, { ik: 'znacky', titulek: 'Zobrazit vše', klavesa: 'Ctrl+Shift+8', akce: () => P.prepniZnacky(), stav: () => P.st.znacky }),
    ),
    radek(
      male(P, { ik: 'zarovnatVlevo', titulek: 'Zarovnat text doleva', klavesa: 'Ctrl+L', akce: () => exec(P, 'justifyLeft', null, 'Zarovnat doleva'), stav: () => P.stav.zarovnani === 'left' }),
      male(P, { ik: 'zarovnatNaStred', titulek: 'Zarovnat na střed', klavesa: 'Ctrl+E', akce: () => exec(P, 'justifyCenter', null, 'Zarovnat na střed'), stav: () => P.stav.zarovnani === 'center' }),
      male(P, { ik: 'zarovnatVpravo', titulek: 'Zarovnat text doprava', klavesa: 'Ctrl+R', akce: () => exec(P, 'justifyRight', null, 'Zarovnat doprava'), stav: () => P.stav.zarovnani === 'right' }),
      male(P, { ik: 'zarovnatDoBloku', titulek: 'Zarovnat do bloku', klavesa: 'Ctrl+J', akce: () => exec(P, 'justifyFull', null, 'Zarovnat do bloku'), stav: () => P.stav.zarovnani === 'justify' }),
      oddelovac(),
      male(P, {
        ik: 'radkovani', titulek: 'Řádkování a mezery mezi odstavci', rozbal: () => nabidka([
          ...[1, 1.15, 1.5, 2, 2.5, 3].map((v) => ({ text: String(v.toFixed(v === 1.15 ? 2 : 1)).replace('.', ','), zaskrtnuto: P.stav.radkovani === v, akce: () => radkovani(P, v) })),
          'sep',
          { text: 'Možnosti řádkování…', akce: () => D.dialogOdstavec(P) },
          'sep',
          { text: 'Přidat mezeru před odstavcem', ikona: 'radkovani', akce: () => naBloky(P, (b) => { b.style.marginTop = '12pt'; }, 'Mezera před') },
          { text: 'Odebrat mezeru za odstavcem', ikona: 'radkovani', akce: () => naBloky(P, (b) => { b.style.marginBottom = '0'; }, 'Mezera za') },
        ], { sirka: 270 }),
      }),
      delene(P, {
        ik: 'stinovani', titulek: 'Stínování', barva: () => posledniStin || 'transparent',
        akce: () => naBloky(P, (b) => { b.style.backgroundColor = posledniStin || ''; }, 'Stínování'),
        rozbal: () => paleta({ auto: 'Bez barvy', bezBarvy: true, onVyber: (b) => { posledniStin = b; P.obnov(); naBloky(P, (x) => { x.style.backgroundColor = b || ''; }, 'Stínování'); } }),
      }),
      delene(P, {
        ik: 'ohraniceni', titulek: 'Ohraničení', akce: () => naBloky(P, (b) => Object.assign(b.style, OHRANICENI.dolni[1]), 'Ohraničení'),
        rozbal: () => nabidka([
          ...Object.values(OHRANICENI).map(([n, s]) => ({ text: n, ikona: 'ohraniceni', akce: () => naBloky(P, (b) => Object.assign(b.style, s), n) })),
          { text: 'Bez ohraničení', ikona: 'ohraniceni', akce: () => naBloky(P, (b) => { b.style.border = ''; b.style.padding = ''; }, 'Bez ohraničení') },
          'sep',
          { text: 'Vodorovná čára', ikona: 'cara', akce: () => P.prikaz(() => document.execCommand('insertHorizontalRule'), 'Vodorovná čára') },
        ], { sirka: 230 }),
      }),
    ),
  ], { spoustec: () => D.dialogOdstavec(P), priorita: 7, ikona: 'zarovnatVlevo' });

  const galerie = el('div.ps-galerie');
  const polozkyGalerie = STYLY.slice(0, 11).map((s) => {
    const b = el('button.ps-gal-pol', { type: 'button', title: s.nazev + (s.klavesa ? ` (${s.klavesa})` : ''), onclick: () => styl(P, s.id) },
      el('span.ps-gal-nahled', { dataset: { styl: s.id }, text: s.nazev }));
    P.stavy.push({ uzel: b, fn: () => !s.znak && P.stav.styl === s.id });
    registruj(P, 'Styl ' + s.nazev, 'informace', () => styl(P, s.id), s.klavesa);
    return zadrz(b);
  });
  galerie.append(...polozkyGalerie);
  const posun = (smer) => { galerie.scrollBy({ top: smer * galerie.clientHeight, behavior: 'smooth' }); };
  const vse = zadrz(el('button.ps-gal-sipka', { type: 'button', title: 'Další' }, el('span', { text: '⌄' })));
  vse.onclick = () => rozbal(vse, el('div.ps-galerie-vse', {},
    el('div.ps-galerie-mrizka', {}, STYLY.map((s) => el('button.ps-gal-pol', { type: 'button', onclick: () => { zavriRozbal(); styl(P, s.id); } },
      el('span.ps-gal-nahled', { dataset: { styl: s.id }, text: s.nazev })))),
    nabidka([
      'sep',
      { text: 'Vytvořit styl', zakazano: true },
      { text: 'Vymazat formátování', ikona: 'vymazatFormat', akce: () => P.prikaz(() => { document.execCommand('removeFormat'); document.execCommand('formatBlock', false, 'p'); }, 'Vymazat formátování') },
      { text: 'Použít styly…', akce: () => P.podokno('styly') },
    ])), { zarovnat: 'vpravo' });
  const styly = skupina('Styly', [
    el('div.ps-galerie-ram', {}, galerie, el('div.ps-gal-sipky', {},
      zadrz(el('button.ps-gal-sipka', { type: 'button', title: 'Nahoru', onclick: () => posun(-1) }, el('span', { text: '⌃' }))),
      zadrz(el('button.ps-gal-sipka', { type: 'button', title: 'Dolů', onclick: () => posun(1) }, el('span', { text: '⌄' }))),
      vse)),
  ], { spoustec: () => P.podokno('styly'), priorita: 4, ikona: 'velikostPismen' });

  const upravy = skupina('Úpravy', [
    sloupec(
      delene(P, {
        ik: 'najitMaly', titulek: 'Najít', klavesa: 'Ctrl+F', akce: () => P.podokno('navigace', { hledat: true }),
        rozbal: () => nabidka([
          { text: 'Najít', ikona: 'najitMaly', klavesa: 'Ctrl+F', akce: () => P.podokno('navigace', { hledat: true }) },
          { text: 'Rozšířené hledání…', ikona: 'najitMaly', akce: () => D.dialogNahradit(P, 'najit') },
          { text: 'Přejít na…', klavesa: 'Ctrl+G', akce: () => D.dialogNahradit(P, 'prejit') },
        ]),
      }),
      male(P, { ik: 'nahradit', text: 'Nahradit', klavesa: 'Ctrl+H', akce: () => D.dialogNahradit(P, 'nahradit') }),
      male(P, {
        ik: 'vybrat', text: 'Vybrat', rozbal: () => nabidka([
          { text: 'Vybrat vše', ikona: 'vybrat', klavesa: 'Ctrl+A', akce: () => { d.vratVyber(); document.execCommand('selectAll'); } },
          { text: 'Vybrat objekty', zakazano: true },
          { text: 'Vybrat text s podobným formátováním', zakazano: true },
        ]),
      }),
    ),
  ], { priorita: 2, ikona: 'najit' });
  // popisky u Najít (dělené tlačítko má jen ikonu)
  upravy.querySelector('.ps-b.deleno .ps-b-cast')?.append(el('span', { text: 'Najít' }));
  upravy.querySelector('.ps-b.deleno')?.classList.add('s-textem');

  const hlas = skupina('Hlas', [
    velke(P, {
      ik: 'diktovat', text: 'Diktovat', deleno: true, klavesa: 'Alt+`', akce: () => P.diktovat(), stav: () => !!P.st.diktovani,
      rozbal: () => nabidka([{ text: 'Čeština', zaskrtnuto: true, akce: () => P.diktovat() }, { text: 'Angličtina (Spojené státy)', akce: () => P.diktovat('en-US') }]),
    }),
  ], { priorita: 1, ikona: 'diktovat' });

  const editor = skupina('Editor', [velke(P, { ik: 'editor', text: 'Editor', akce: () => P.podokno('editor'), klavesa: 'F7' })], { priorita: 1, ikona: 'editor' });
  const doplnky = skupina('Doplňky', [velke(P, { ik: 'doplnky', text: 'Doplňky', akce: () => D.dialogDoplnky(P) })], { priorita: 0, ikona: 'doplnky' });
  const ai = skupina('AstroAI', [velke(P, { ik: 'astroai', text: 'AstroAI', titulek: 'AstroAI – pomocník pro psaní', akce: () => P.podokno('ai') })], { priorita: 6, ikona: 'astroai' });

  return [schranka, pismo, odstavec, styly, upravy, hlas, editor, doplnky, ai];
}

/** Otevře druhou úroveň nabídky pod stejným místem pásu (např. barva podtržení). */
function rozbalPozdeji(P, sel, obsah) {
  setTimeout(() => {
    const kotva = P.pas.querySelector('.ps-karta-obsah.aktivni ' + sel) || P.pas;
    rozbal(kotva, obsah(kotva));
  });
}

// ---------------------------------------------------------------- karta Vložení
function mrizkaTabulky(P) {
  const popis = el('div.ps-nab-nadpis', { text: 'Vložit tabulku' });
  const mr = el('div.ps-vyber-mrizka');
  for (let r = 0; r < 8; r++) for (let s = 0; s < 10; s++) {
    const b = el('div.ps-vyber-bunka', { dataset: { r, s } });
    mr.append(b);
  }
  mr.addEventListener('pointermove', (e) => {
    const b = e.target.closest('.ps-vyber-bunka');
    if (!b) return;
    const R = +b.dataset.r, S = +b.dataset.s;
    mr.querySelectorAll('.ps-vyber-bunka').forEach((x) => x.classList.toggle('on', +x.dataset.r <= R && +x.dataset.s <= S));
    popis.textContent = `Tabulka ${S + 1}×${R + 1}`;
  });
  mr.addEventListener('click', (e) => {
    const b = e.target.closest('.ps-vyber-bunka');
    if (!b) return;
    zavriRozbal();
    P.vlozTabulku(+b.dataset.r + 1, +b.dataset.s + 1);
  });
  return el('div.ps-tabulka-vyber', {}, popis, mr, nabidka([
    'sep',
    { text: 'Vložit tabulku…', ikona: 'tabulka', akce: () => D.dialogTabulka(P) },
    { text: 'Nakreslit tabulku', zakazano: true },
    { text: 'Převést text na tabulku…', akce: () => P.textNaTabulku() },
    { text: 'Tabulka Excelu', zakazano: true },
  ]));
}

const TVARY = {
  'Obdélník': '<rect x="3" y="3" width="94" height="54" fill="#156082" stroke="#0e4058" stroke-width="2"/>',
  'Zaoblený obdélník': '<rect x="3" y="3" width="94" height="54" rx="12" fill="#156082" stroke="#0e4058" stroke-width="2"/>',
  'Elipsa': '<ellipse cx="50" cy="30" rx="47" ry="27" fill="#156082" stroke="#0e4058" stroke-width="2"/>',
  'Šipka doprava': '<path d="M3 18h60V4l34 26-34 26V42H3z" fill="#156082" stroke="#0e4058" stroke-width="2"/>',
  'Hvězda': '<path d="M50 2l8.6 17.5 19.4 2.8-14 13.6 3.3 19.3L50 46.1l-17.3 9.1L36 35.9 22 22.3l19.4-2.8z" fill="#E97132" stroke="#a24d1f" stroke-width="2" transform="translate(0 1)"/>',
  'Srdce': '<path d="M50 56S4 32 4 16A13 13 0 0 1 30 10c8 0 14 6 20 12 6-6 12-12 20-12a13 13 0 0 1 26 6c0 16-46 40-46 40z" fill="#C00000" stroke="#7d0000" stroke-width="2"/>',
  'Bublina': '<path d="M8 3h84a5 5 0 0 1 5 5v32a5 5 0 0 1-5 5H38L22 57V45H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5z" fill="#fff" stroke="#156082" stroke-width="2.5"/>',
  'Trojúhelník': '<path d="M50 3l47 54H3z" fill="#4EA72E" stroke="#2f6c1a" stroke-width="2"/>',
};

function kartaVlozeni(P) {
  const tvary = () => el('div.ps-knihovna', {},
    el('div.ps-nab-nadpis', { text: 'Základní obrazce' }),
    el('div.ps-tvary', {}, Object.entries(TVARY).map(([n, svg]) => {
      const b = el('button.ps-tvar', { type: 'button', title: n, onclick: () => { zavriRozbal(); P.vlozObrazek('data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60">${svg}</svg>`), 200, n); } });
      b.innerHTML = `<svg viewBox="0 0 100 60">${svg}</svg>`;
      return b;
    })));

  const cislo = (kde, zar) => () => P.cisloStranky(kde, zar);
  return [
    skupina('Stránky', [
      velke(P, {
        ik: 'titulniStrana', text: 'Titulní\nstránka', rozbal: () => nabidka([
          { nadpis: 'Předdefinované' },
          { text: 'Mřížka', ikona: 'titulniStrana', akce: () => P.titulniStrana('mrizka') },
          { text: 'Pohyb', ikona: 'titulniStrana', akce: () => P.titulniStrana('pohyb') },
          { text: 'Iontový (tmavý)', ikona: 'titulniStrana', akce: () => P.titulniStrana('iont') },
        ], { sirka: 220 }),
      }),
      velke(P, { ik: 'prazdnaStrana', text: 'Prázdná\nstránka', akce: () => P.prazdnaStrana() }),
      velke(P, { ik: 'koneStranky', text: 'Konec\nstránky', klavesa: 'Ctrl+Enter', akce: () => P.konecStranky() }),
    ], { priorita: 3, ikona: 'prazdnaStrana' }),
    skupina('Tabulky', [velke(P, { ik: 'tabulka', text: 'Tabulka', rozbal: () => mrizkaTabulky(P) })], { priorita: 6, ikona: 'tabulka' }),
    skupina('Ilustrace', [
      velke(P, {
        ik: 'obrazky', text: 'Obrázky', rozbal: () => nabidka([
          { nadpis: 'Vložit obrázek z' },
          { text: 'Toto zařízení…', ikona: 'pocitac', akce: () => P.obrazekZeZarizeni() },
          { text: 'Obrázky v AstroOS…', ikona: 'slozka', akce: () => D.dialogObrazky(P) },
          { text: 'Online obrázky…', zakazano: true },
        ], { sirka: 220 }),
      }),
      velke(P, { ik: 'tvary', text: 'Tvary', rozbal: tvary }),
      velke(P, { ik: 'ikonyVlozit', text: 'Ikony', akce: () => D.dialogIkony(P) }),
      sloupec(
        male(P, { ik: 'obrazky', text: 'SmartArt', zakazano: true }),
        male(P, { ik: 'sloupce', text: 'Graf', zakazano: true }),
        male(P, { ik: 'pocitac', text: 'Snímek obrazovky', zakazano: true }),
      ),
    ], { priorita: 5, ikona: 'obrazky' }),
    skupina('Komentáře', [velke(P, { ik: 'komentarNovy', text: 'Komentář', akce: () => P.novyKomentar(), klavesa: 'Ctrl+Alt+M' })], { priorita: 2, ikona: 'komentarNovy' }),
    skupina('Odkazy', [
      velke(P, { ik: 'odkaz', text: 'Odkaz', klavesa: 'Ctrl+K', akce: () => D.dialogOdkaz(P) }),
      sloupec(
        male(P, { ik: 'pripnout', text: 'Záložka', zakazano: true }),
        male(P, { ik: 'odkaz', text: 'Křížový odkaz', zakazano: true }),
      ),
    ], { priorita: 2, ikona: 'odkaz' }),
    skupina('Záhlaví a zápatí', [
      velke(P, {
        ik: 'zahlavi', text: 'Záhlaví', rozbal: () => nabidka([
          { nadpis: 'Předdefinované' },
          { text: 'Prázdné', akce: () => P.upravZahlavi('zahlavi', '<p><br></p>') },
          { text: 'Název dokumentu vpravo', akce: () => P.upravZahlavi('zahlavi', `<p style="text-align:right;color:#595959">${P.st.nazev}</p>`) },
          { text: 'Název a datum', akce: () => P.upravZahlavi('zahlavi', `<p style="border-bottom:0.75pt solid #7f7f7f;color:#595959">${P.st.nazev}<span style="float:right">${new Date().toLocaleDateString('cs-CZ')}</span></p>`) },
          'sep',
          { text: 'Upravit záhlaví', ikona: 'tuzka', akce: () => P.upravZahlavi('zahlavi') },
          { text: 'Odebrat záhlaví', ikona: 'zavrit', akce: () => P.nastavStranku({ zahlavi: '' }, 'Odebrat záhlaví') },
        ], { sirka: 240 }),
      }),
      velke(P, {
        ik: 'zapati', text: 'Zápatí', rozbal: () => nabidka([
          { nadpis: 'Předdefinované' },
          { text: 'Prázdné', akce: () => P.upravZahlavi('zapati', '<p><br></p>') },
          { text: 'Jméno autora a číslo stránky', akce: () => P.upravZahlavi('zapati', `<p style="color:#595959">${P.autor()}<span style="float:right">Strana <span class="ps-pole-cislo">1</span> z <span class="ps-pole-pocet">1</span></span></p>`) },
          'sep',
          { text: 'Upravit zápatí', ikona: 'tuzka', akce: () => P.upravZahlavi('zapati') },
          { text: 'Odebrat zápatí', ikona: 'zavrit', akce: () => P.nastavStranku({ zapati: '' }, 'Odebrat zápatí') },
        ], { sirka: 260 }),
      }),
      velke(P, {
        ik: 'cisloStranky', text: 'Číslo\nstránky', rozbal: () => nabidka([
          { nadpis: 'Horní okraj stránky' },
          { text: 'Jednoduché číslo 1 (vlevo)', akce: cislo('zahlavi', 'left') },
          { text: 'Jednoduché číslo 2 (na střed)', akce: cislo('zahlavi', 'center') },
          { text: 'Jednoduché číslo 3 (vpravo)', akce: cislo('zahlavi', 'right') },
          { nadpis: 'Dolní okraj stránky' },
          { text: 'Jednoduché číslo 1 (vlevo)', akce: cislo('zapati', 'left') },
          { text: 'Jednoduché číslo 2 (na střed)', akce: cislo('zapati', 'center') },
          { text: 'Jednoduché číslo 3 (vpravo)', akce: cislo('zapati', 'right') },
          { text: 'Strana X z Y', akce: () => P.upravZahlavi('zapati', '<p style="text-align:center">Strana <b class="ps-pole-cislo">1</b> z <b class="ps-pole-pocet">1</b></p>') },
          'sep',
          { text: 'Odebrat čísla stránek', ikona: 'zavrit', akce: () => P.odeberCisla() },
        ], { sirka: 260 }),
      }),
    ], { priorita: 4, ikona: 'zahlavi' }),
    skupina('Text', [
      velke(P, { ik: 'textovePole', text: 'Textové\npole', akce: () => P.prikaz(() => document.execCommand('insertHTML', false, '<div class="ps-textpole"><p>Sem napište text.</p></div><p><br></p>'), 'Textové pole') }),
      sloupec(
        male(P, {
          ik: 'wordart', text: 'WordArt', rozbal: () => el('div.ps-knihovna', {},
            el('div.ps-wordart', {}, [
              'color:#156082;text-shadow:2px 2px 0 #b4c7e7', 'color:#fff;text-shadow:-1px -1px 0 #E97132,1px -1px 0 #E97132,-1px 1px 0 #E97132,1px 1px 0 #E97132,3px 3px 4px rgba(0,0,0,.3)',
              'background:linear-gradient(90deg,#A02B93,#0F9ED5);-webkit-background-clip:text;background-clip:text;color:transparent', 'color:#196B24;font-style:italic;text-shadow:0 0 8px #92D050',
            ].map((s) => {
              const b = el('button.ps-wa', { type: 'button', style: s + ';font-weight:700;font-size:26px;font-family:Georgia', text: 'A' });
              b.onclick = () => { zavriRozbal(); P.prikaz(() => document.execCommand('insertHTML', false, `<p style="text-align:center"><span style="${s};font-weight:700;font-size:36pt;font-family:Georgia">Sem napište text</span></p>`), 'WordArt'); };
              return b;
            }))),
        }),
        male(P, { ik: 'velikostPismen', text: 'Iniciála', akce: () => P.prikaz(() => { const b = P.dok.blokKurzoru(); if (b) b.classList.toggle('ps-inicialka'); }, 'Iniciála') }),
        male(P, { ik: 'datumCas', text: 'Datum a čas', akce: () => D.dialogDatum(P) }),
      ),
    ], { priorita: 3, ikona: 'textovePole' }),
    skupina('Symboly', [
      velke(P, {
        ik: 'rovnice', text: 'Rovnice', rozbal: () => nabidka([
          { nadpis: 'Předdefinované' },
          ...['a² + b² = c²', 'x = (−b ± √(b² − 4ac)) / 2a', 'S = π · r²', 'E = m · c²', 'v = s / t'].map((r) => ({
            text: r, styl: { fontFamily: 'Cambria Math, Cambria, Georgia, serif', fontStyle: 'italic' },
            akce: () => P.prikaz(() => document.execCommand('insertHTML', false, `<p style="text-align:center"><span style="font-family:'Cambria Math',Cambria,Georgia,serif;font-style:italic">${r}</span></p>`), 'Rovnice'),
          })),
        ], { sirka: 280 }),
      }),
      velke(P, { ik: 'symbol', text: 'Symbol', rozbal: () => D.nabidkaSymbolu(P) }),
      velke(P, { ik: 'cara', text: 'Vodorovná\nčára', akce: () => P.prikaz(() => document.execCommand('insertHorizontalRule'), 'Vodorovná čára') }),
    ], { priorita: 4, ikona: 'symbol' }),
  ];
}

// ---------------------------------------------------------------- Kreslení
function kartaKresleni(P) {
  const nastroj = (id, ikona, text, barva, sirka, zvyr) => velke(P, {
    ik: ikona, text, titulek: text, stav: () => P.st.kresleni?.id === id,
    akce: () => P.kreslit(P.st.kresleni?.id === id ? null : { id, barva, sirka, zvyr }),
  });
  return [
    skupina('Nástroje pro kreslení', [
      velke(P, { ik: 'vybrat', text: 'Vybrat', stav: () => !P.st.kresleni, akce: () => P.kreslit(null) }),
      nastroj('guma', 'guma', 'Guma', null, 0, false),
      nastroj('cerne', 'pero', 'Pero\nčerné', '#1a1a1a', 2.2, false),
      nastroj('cervene', 'pero', 'Pero\nčervené', '#d13438', 2.2, false),
      nastroj('modre', 'pero', 'Pero\nmodré', '#0f6cbd', 2.2, false),
      nastroj('zvyr', 'zvyraznovacKresleni', 'Zvýraz-\nňovač', '#ffe600', 14, true),
    ], { priorita: 5, ikona: 'pero' }),
    skupina('Upravit', [
      velke(P, { ik: 'guma', text: 'Smazat\nvše', akce: () => P.nastavStranku({ kresba: [] }, 'Smazat rukopis') }),
    ], { priorita: 3, ikona: 'guma' }),
    skupina('Převést', [
      velke(P, { ik: 'kresleni', text: 'Rukopis na\ntvar', zakazano: true }),
      velke(P, { ik: 'rovnice', text: 'Rukopis na\nmatematiku', zakazano: true }),
    ], { priorita: 1, ikona: 'kresleni' }),
  ];
}

// ---------------------------------------------------------------- Návrh
export const SADY = {
  vychozi: { nazev: 'Výchozí', vars: {} },
  zakladni: { nazev: 'Základní (elegantní)', vars: { '--ps-nadpis-barva': '#262626', '--ps-pismo-nadpisy': 'Georgia, "Times New Roman", serif', '--ps-nadpis-ramecek': '0.75pt solid #262626' } },
  cara: { nazev: 'Čára (výrazná)', vars: { '--ps-nadpis-barva': '#156082', '--ps-nadpis-ramecek': '1.5pt solid #156082', '--ps-nadpis-vaha': '600' } },
  stin: { nazev: 'Stín', vars: { '--ps-nadpis-barva': '#fff', '--ps-nadpis-pozadi': '#156082', '--ps-nadpis-vaha': '600' } },
  moderni: { nazev: 'Moderní', vars: { '--ps-nadpis-barva': '#A02B93', '--ps-pismo-nadpisy': '"Segoe UI", Calibri, sans-serif', '--ps-nadpis-vaha': '300' } },
  klasicka: { nazev: 'Klasická', vars: { '--ps-nadpis-barva': '#000', '--ps-pismo': '"Times New Roman", serif', '--ps-pismo-nadpisy': '"Times New Roman", serif', '--ps-nadpis-vaha': '700' } },
};
export const BARVY_MOTIVU = {
  office: ['Office', '#0F4761'], modra: ['Modrá', '#1F4E79'], zelena: ['Zelená', '#196B24'], cervena: ['Červená', '#8B1A1A'],
  oranzova: ['Oranžová', '#C55A11'], fialova: ['Fialová', '#5B2C83'], seda: ['Stupně šedi', '#3A3A3A'],
};
export const PISMA_MOTIVU = {
  office: ['Office', 'Aptos Display', 'Aptos'], office2013: ['Office 2013–2022', 'Calibri Light', 'Calibri'],
  georgia: ['Georgia', 'Georgia', 'Georgia'], times: ['Times New Roman', 'Times New Roman', 'Times New Roman'],
  arial: ['Arial', 'Arial', 'Arial'], segoe: ['Segoe UI', 'Segoe UI Light', 'Segoe UI'], comic: ['Comic Sans', 'Comic Sans MS', 'Comic Sans MS'],
};
export const MEZERY = {
  vychozi: ['Výchozí', '8pt', '1.35'], bez: ['Bez mezer odstavce', '0pt', '1.17'], kompaktni: ['Kompaktní', '4pt', '1.17'],
  tesne: ['Těsné', '6pt', '1.25'], otevrene: ['Otevřené', '10pt', '1.5'], uvolnene: ['Uvolněné', '6pt', '1.75'], dvojite: ['Dvojité', '8pt', '2.34'],
};

function kartaNavrh(P) {
  const n = () => P.dok.nast;
  const sady = el('div.ps-galerie.ps-galerie-sady');
  for (const [id, s] of Object.entries(SADY)) {
    const b = zadrz(el('button.ps-sada', { type: 'button', title: s.nazev, onclick: () => P.nastavStranku({ sada: id }, 'Sada stylů') },
      el('div.ps-sada-nahled', { style: s.vars },
        el('div.ps-sada-nazev', { text: 'Název' }), el('div.ps-sada-nadpis', { text: 'Nadpis 1' }),
        el('div.ps-sada-text', { text: 'Na kartě Vložení najdete galerie položek, které vzhledem odpovídají dokumentu.' }))));
    P.stavy.push({ uzel: b, fn: () => (n().sada || 'vychozi') === id });
    sady.append(b);
  }
  return [
    skupina('Motivy', [velke(P, {
      ik: 'motivy', text: 'Motivy', rozbal: () => nabidka([
        { nadpis: 'Office' },
        ...Object.entries(BARVY_MOTIVU).map(([id, [nz, b]]) => ({ text: nz, styl: { color: b }, zaskrtnuto: (n().barvy || 'office') === id, akce: () => P.nastavStranku({ barvy: id }, 'Motiv') })),
      ], { sirka: 200 }),
    })], { priorita: 2, ikona: 'motivy' }),
    skupina('Formátování dokumentu', [
      sady,
      sloupec(
        male(P, {
          ik: 'barvaPisma', text: 'Barvy', rozbal: () => nabidka(Object.entries(BARVY_MOTIVU).map(([id, [nz, b]]) => ({
            uzel: el('button.ps-nab-polozka' + ((n().barvy || 'office') === id ? '.zaskrtnuto' : ''), { type: 'button', onclick: () => { zavriRozbal(); P.nastavStranku({ barvy: id }, 'Barvy motivu'); } },
              el('span.ps-barvy-vzor', {}, [b, '#E97132', '#196B24', '#0F9ED5', '#A02B93'].map((c) => el('i', { style: { background: c } }))), el('span', { text: nz })),
          })), { sirka: 240 }),
        }),
        male(P, {
          ik: 'velikostPismen', text: 'Písma', rozbal: () => nabidka(Object.entries(PISMA_MOTIVU).map(([id, [nz, h, t]]) => ({
            uzel: el('button.ps-nab-polozka.ps-pisma-motivu' + ((n().pisma || 'office') === id ? '.zaskrtnuto' : ''), { type: 'button', onclick: () => { zavriRozbal(); P.nastavStranku({ pisma: id }, 'Písma motivu'); } },
              el('span.ps-pm-aa', { text: 'Aa', style: { fontFamily: zasobnikPisma(h) } }),
              el('span', {}, el('b', { text: nz }), el('span', { text: h, style: { fontFamily: zasobnikPisma(h) } }), el('span', { text: t, style: { fontFamily: zasobnikPisma(t) } }))),
          })), { sirka: 260 }),
        }),
      ),
      sloupec(
        male(P, {
          ik: 'radkovani', text: 'Mezery mezi odstavci', rozbal: () => nabidka(Object.entries(MEZERY).map(([id, [nz]]) => ({
            text: nz, zaskrtnuto: (n().mezery || 'vychozi') === id, akce: () => P.nastavStranku({ mezery: id }, 'Mezery mezi odstavci'),
          })), { sirka: 220 }),
        }),
        male(P, { ik: 'efekty', text: 'Efekty', zakazano: true }),
        male(P, { ik: 'kontrola', text: 'Nastavit jako výchozí', zakazano: true }),
      ),
    ], { priorita: 4, ikona: 'motivy' }),
    skupina('Pozadí stránky', [
      velke(P, {
        ik: 'vodoznak', text: 'Vodoznak', rozbal: () => nabidka([
          { nadpis: 'Právní omezení' },
          ...['DŮVĚRNÉ', 'NEKOPÍROVAT'].map((t) => ({ text: t, akce: () => P.nastavStranku({ vodoznak: t }, 'Vodoznak') })),
          { nadpis: 'Upozornění' },
          ...['KONCEPT', 'VZOR', 'NALÉHAVÉ'].map((t) => ({ text: t, akce: () => P.nastavStranku({ vodoznak: t }, 'Vodoznak') })),
          'sep',
          { text: 'Vlastní vodoznak…', ikona: 'vodoznak', akce: () => D.dialogVodoznak(P) },
          { text: 'Odebrat vodoznak', ikona: 'zavrit', akce: () => P.nastavStranku({ vodoznak: null }, 'Odebrat vodoznak') },
        ], { sirka: 220 }),
      }),
      velke(P, {
        ik: 'barvaStranky', text: 'Barva\nstránky', rozbal: () => paleta({ auto: 'Bez barvy', bezBarvy: true, onVyber: (b) => P.nastavStranku({ barvaStranky: b }, 'Barva stránky') }),
      }),
      velke(P, { ik: 'ohraniceniStranky', text: 'Ohraničení\nstránek', stav: () => !!n().ohraniceni, akce: () => P.nastavStranku({ ohraniceni: !n().ohraniceni }, 'Ohraničení stránek') }),
    ], { priorita: 3, ikona: 'barvaStranky' }),
  ];
}

// ---------------------------------------------------------------- Rozložení
function spinner(P, { popis, jednotka, krok, cti, zapis }) {
  const v = el('input.ps-spin-vstup', { type: 'text' });
  const zmen = (d) => {
    const x = Math.max(0, +(parseFloat(v.value.replace(',', '.')) || 0) + d);
    zapis(+x.toFixed(2));
  };
  v.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); zmen(0); P.dok.vratVyber(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); zmen(krok); }
    if (e.key === 'ArrowDown') { e.preventDefault(); zmen(-krok); }
  });
  v.addEventListener('change', () => zmen(0));
  P.obnovy.push(() => { if (document.activeElement !== v) v.value = String(cti()).replace('.', ',') + ' ' + jednotka; });
  const s = el('div.ps-spin', {}, el('span.ps-spin-popis', { text: popis }), el('div.ps-spin-pole', {}, v,
    el('div.ps-spin-sipky', {},
      zadrz(el('button', { type: 'button', text: '▴', onclick: () => zmen(krok) })),
      zadrz(el('button', { type: 'button', text: '▾', onclick: () => zmen(-krok) })))));
  return s;
}

function kartaRozlozeni(P) {
  const n = () => P.dok.nast;
  const blok = () => P.dok.blokKurzoru();
  const cs = (p) => { const b = blok(); return b ? parseFloat(getComputedStyle(b)[p]) || 0 : 0; };
  return [
    skupina('Vzhled stránky', [
      velke(P, {
        ik: 'okraje', text: 'Okraje', rozbal: () => nabidka([
          ...Object.entries(OKRAJE).map(([id, o]) => ({
            uzel: el('button.ps-nab-polozka.ps-okraje-pol' + (n().okraje === id ? '.zaskrtnuto' : ''), { type: 'button', onclick: () => { zavriRozbal(); P.nastavStranku({ okraje: id }, 'Okraje'); } },
              ik('okraje'), el('span', {}, el('b', { text: o.nazev }),
                el('span', { text: `Nahoře: ${(o.t / 10).toFixed(2).replace('.', ',')} cm   Dole: ${(o.b / 10).toFixed(2).replace('.', ',')} cm` }),
                el('span', { text: `Vlevo: ${(o.l / 10).toFixed(2).replace('.', ',')} cm   Vpravo: ${(o.r / 10).toFixed(2).replace('.', ',')} cm` }))),
          })),
          'sep',
          { text: 'Vlastní okraje…', akce: () => D.dialogVzhledStranky(P) },
        ], { sirka: 300 }),
      }),
      velke(P, {
        ik: 'orientace', text: 'Orientace', rozbal: () => nabidka([
          { text: 'Na výšku', ikona: 'rozlozeniTisk', zaskrtnuto: n().orientace !== 'na-sirku', akce: () => P.nastavStranku({ orientace: 'na-vysku' }, 'Orientace') },
          { text: 'Na šířku', ikona: 'rozlozeniWeb', zaskrtnuto: n().orientace === 'na-sirku', akce: () => P.nastavStranku({ orientace: 'na-sirku' }, 'Orientace') },
        ]),
      }),
      velke(P, {
        ik: 'velikost', text: 'Velikost', rozbal: () => nabidka([
          ...Object.entries(VELIKOSTI).map(([id, v]) => ({
            uzel: el('button.ps-nab-polozka.ps-okraje-pol' + (n().velikost === id ? '.zaskrtnuto' : ''), { type: 'button', onclick: () => { zavriRozbal(); P.nastavStranku({ velikost: id }, 'Velikost stránky'); } },
              ik('velikost'), el('span', {}, el('b', { text: v.nazev }), el('span', { text: v.popis }))),
          })),
          'sep',
          { text: 'Další velikosti papíru…', akce: () => D.dialogVzhledStranky(P) },
        ], { sirka: 260 }),
      }),
      velke(P, { ik: 'sloupce', text: 'Sloupce', zakazano: true }),
      sloupec(
        male(P, {
          ik: 'konce', text: 'Konce', rozbal: () => nabidka([
            { nadpis: 'Konce stránek' },
            { text: 'Stránka', ikona: 'koneStranky', klavesa: 'Ctrl+Enter', akce: () => P.konecStranky() },
            { text: 'Sloupec', zakazano: true },
            { text: 'Obtékání textu', akce: () => P.prikaz(() => document.execCommand('insertLineBreak'), 'Zalomení řádku') },
          ], { sirka: 220 }),
        }),
        male(P, { ik: 'cislovani', text: 'Čísla řádků', zakazano: true }),
        male(P, {
          ik: 'seradit', text: 'Dělení slov', rozbal: () => nabidka([
            { text: 'Žádné', zaskrtnuto: !n().deleni, akce: () => P.nastavStranku({ deleni: false }, 'Dělení slov') },
            { text: 'Automaticky', zaskrtnuto: !!n().deleni, akce: () => P.nastavStranku({ deleni: true }, 'Dělení slov') },
          ]),
        }),
      ),
    ], { spoustec: () => D.dialogVzhledStranky(P), priorita: 6, ikona: 'okraje' }),
    skupina('Odstavec', [
      sloupec(
        el('div.ps-spin-nadpis', { text: 'Odsazení' }),
        spinner(P, { popis: 'Vlevo:', jednotka: 'cm', krok: 0.1, cti: () => +(cs('marginLeft') / MM / 10).toFixed(1), zapis: (v) => naBloky(P, (b) => { b.style.marginLeft = v ? v * 10 * MM + 'px' : ''; }, 'Odsazení vlevo') }),
        spinner(P, { popis: 'Vpravo:', jednotka: 'cm', krok: 0.1, cti: () => +(cs('marginRight') / MM / 10).toFixed(1), zapis: (v) => naBloky(P, (b) => { b.style.marginRight = v ? v * 10 * MM + 'px' : ''; }, 'Odsazení vpravo') }),
      ),
      oddelovac(),
      sloupec(
        el('div.ps-spin-nadpis', { text: 'Mezery' }),
        spinner(P, { popis: 'Před:', jednotka: 'b.', krok: 6, cti: () => Math.round(cs('marginTop') * 0.75), zapis: (v) => naBloky(P, (b) => { b.style.marginTop = v + 'pt'; }, 'Mezera před') }),
        spinner(P, { popis: 'Za:', jednotka: 'b.', krok: 6, cti: () => Math.round(cs('marginBottom') * 0.75), zapis: (v) => naBloky(P, (b) => { b.style.marginBottom = v + 'pt'; }, 'Mezera za') }),
      ),
    ], { spoustec: () => D.dialogOdstavec(P), priorita: 5, ikona: 'radkovani' }),
    skupina('Uspořádat', [
      velke(P, { ik: 'obtekani', text: 'Obtékání\ntextu', akce: () => P.obrazekObtekani(), zakazano: false }),
      sloupec(
        male(P, { ik: 'zarovnatNaStred', text: 'Zarovnat', rozbal: () => nabidka([
          { text: 'Zarovnat doleva', ikona: 'zarovnatVlevo', akce: () => exec(P, 'justifyLeft', null, 'Zarovnat') },
          { text: 'Zarovnat na střed', ikona: 'zarovnatNaStred', akce: () => exec(P, 'justifyCenter', null, 'Zarovnat') },
          { text: 'Zarovnat doprava', ikona: 'zarovnatVpravo', akce: () => exec(P, 'justifyRight', null, 'Zarovnat') },
        ]) }),
        male(P, { ik: 'noveOkno', text: 'Přenést dopředu', zakazano: true }),
        male(P, { ik: 'noveOkno', text: 'Přenést dozadu', zakazano: true }),
      ),
    ], { priorita: 2, ikona: 'obtekani' }),
  ];
}

// ---------------------------------------------------------------- Reference, Korespondence
function kartaReference(P) {
  return [
    skupina('Obsah', [
      velke(P, {
        ik: 'obsah', text: 'Obsah', rozbal: () => nabidka([
          { nadpis: 'Předdefinované' },
          { text: 'Automatická tabulka 1', ikona: 'obsah', akce: () => P.vlozObsah('Obsah') },
          { text: 'Automatická tabulka 2', ikona: 'obsah', akce: () => P.vlozObsah('Obsah dokumentu') },
          'sep',
          { text: 'Odebrat obsah', ikona: 'zavrit', akce: () => P.prikaz(() => P.dok.ed.querySelectorAll('.ps-toc').forEach((t) => t.remove()), 'Odebrat obsah') },
        ], { sirka: 240 }),
      }),
      sloupec(
        male(P, { ik: 'aktualizovat', text: 'Aktualizovat tabulku', akce: () => P.aktualizujObsah() }),
        male(P, { ik: 'novy', text: 'Přidat text', zakazano: true }),
      ),
    ], { priorita: 5, ikona: 'obsah' }),
    skupina('Poznámky pod čarou', [
      velke(P, { ik: 'poznamkaPodCarou', text: 'Vložit poznámku\npod čarou', klavesa: 'Ctrl+Alt+F', akce: () => P.vlozPoznamku() }),
      sloupec(
        male(P, { ik: 'poznamkaPodCarou', text: 'Vložit vysvětlivku', akce: () => P.vlozPoznamku() }),
        male(P, { ik: 'sipkaDolu', text: 'Další poznámka', akce: () => P.dalsiPoznamka() }),
      ),
    ], { priorita: 4, ikona: 'poznamkaPodCarou' }),
    skupina('Citace a bibliografie', [
      velke(P, { ik: 'komentar', text: 'Vložit\ncitaci', zakazano: true }),
      sloupec(male(P, { ik: 'seradit', text: 'Styl: APA', zakazano: true }), male(P, { ik: 'obsah', text: 'Bibliografie', zakazano: true })),
    ], { priorita: 2, ikona: 'komentar' }),
    skupina('Titulky', [velke(P, { ik: 'textovePole', text: 'Vložit\ntitulek', akce: () => D.dialogTitulek(P) })], { priorita: 3, ikona: 'textovePole' }),
    skupina('Rejstřík', [velke(P, { ik: 'obsah', text: 'Označit\npoložku', zakazano: true })], { priorita: 1, ikona: 'obsah' }),
  ];
}

function kartaKorespondence(P) {
  const nic = () => D.zpravaP(P, 'Hromadná korespondence potřebuje seznam příjemců. Tahle funkce v AstroPísmu zatím není.');
  return [
    skupina('Vytvořit', [velke(P, { ik: 'obalka', text: 'Obálky', akce: nic }), velke(P, { ik: 'stitky', text: 'Štítky', akce: nic })], { priorita: 3, ikona: 'obalka' }),
    skupina('Spustit hromadnou korespondenci', [
      velke(P, { ik: 'hromadna', text: 'Spustit hromadnou\nkorespondenci', akce: nic }),
      velke(P, { ik: 'prijemci', text: 'Vybrat\npříjemce', akce: nic }),
      velke(P, { ik: 'tabulka', text: 'Upravit seznam\npříjemců', zakazano: true }),
    ], { priorita: 2, ikona: 'hromadna' }),
    skupina('Zapisovat a vkládat pole', [
      velke(P, { ik: 'obsah', text: 'Zvýraznit slučovaná\npole', zakazano: true }),
      velke(P, { ik: 'obalka', text: 'Blok\nadresy', zakazano: true }),
      velke(P, { ik: 'komentar', text: 'Řádek\npozdravu', zakazano: true }),
    ], { priorita: 1, ikona: 'obsah' }),
    skupina('Náhled výsledků', [velke(P, { ik: 'oko', text: 'Náhled\nvýsledků', zakazano: true })], { priorita: 1, ikona: 'oko' }),
    skupina('Dokončit', [velke(P, { ik: 'hromadna', text: 'Dokončit\na sloučit', zakazano: true })], { priorita: 1, ikona: 'hromadna' }),
  ];
}

// ---------------------------------------------------------------- Revize
function kartaRevize(P) {
  return [
    skupina('Kontrola pravopisu', [
      velke(P, { ik: 'pravopis', text: 'Pravopis\na gramatika', klavesa: 'F7', akce: () => P.podokno('editor') }),
      sloupec(
        male(P, { ik: 'nahradit', text: 'Tezaurus', zakazano: true }),
        male(P, { ik: 'pocetSlov', text: 'Počet slov', akce: () => D.dialogPocetSlov(P) }),
      ),
    ], { priorita: 5, ikona: 'pravopis' }),
    skupina('Řeč', [velke(P, { ik: 'predcitat', text: 'Předčítat', klavesa: 'Ctrl+Alt+Mezerník', akce: () => P.predcitat(), stav: () => !!P.st.predcitani })], { priorita: 4, ikona: 'predcitat' }),
    skupina('Přístupnost', [velke(P, { ik: 'pristupnost', text: 'Zkontrolovat\npřístupnost', akce: () => P.podokno('pristupnost') })], { priorita: 3, ikona: 'pristupnost' }),
    skupina('Jazyk', [
      velke(P, { ik: 'prelozit', text: 'Přeložit', zakazano: true }),
      velke(P, {
        ik: 'jazyk', text: 'Jazyk', rozbal: () => nabidka([
          { text: 'Čeština', zaskrtnuto: P.dok.ed.lang === 'cs', akce: () => { P.dok.ed.lang = 'cs'; P.obnov(); } },
          { text: 'Slovenština', zaskrtnuto: P.dok.ed.lang === 'sk', akce: () => { P.dok.ed.lang = 'sk'; P.obnov(); } },
          { text: 'Angličtina (Spojené státy)', zaskrtnuto: P.dok.ed.lang === 'en', akce: () => { P.dok.ed.lang = 'en'; P.obnov(); } },
          { text: 'Němčina', zaskrtnuto: P.dok.ed.lang === 'de', akce: () => { P.dok.ed.lang = 'de'; P.obnov(); } },
        ], { sirka: 240 }),
      }),
    ], { priorita: 2, ikona: 'jazyk' }),
    skupina('Komentáře', [
      velke(P, { ik: 'komentarNovy', text: 'Nový\nkomentář', akce: () => P.novyKomentar() }),
      sloupec(
        male(P, { ik: 'zavrit', text: 'Odstranit', akce: () => P.smazKomentar() }),
        male(P, { ik: 'sipkaVlevo', text: 'Předchozí', akce: () => P.skokKomentar(-1) }),
        male(P, { ik: 'znovu', text: 'Další', akce: () => P.skokKomentar(1) }),
      ),
      velke(P, { ik: 'komentar', text: 'Zobrazit\nkomentáře', stav: () => P.st.podokno === 'komentare', akce: () => P.podokno(P.st.podokno === 'komentare' ? null : 'komentare') }),
    ], { priorita: 5, ikona: 'komentarNovy' }),
    skupina('Sledování', [velke(P, { ik: 'sledovat', text: 'Sledovat\nzměny', zakazano: true })], { priorita: 1, ikona: 'sledovat' }),
    skupina('Chránit', [velke(P, { ik: 'zamek', text: 'Omezit\núpravy', stav: () => P.st.jenCteni, akce: () => P.jenCteni(!P.st.jenCteni) })], { priorita: 2, ikona: 'zamek' }),
  ];
}

// ---------------------------------------------------------------- Zobrazení, Nápověda
function zaskrt(P, text, ikona, cti, zapis) {
  const c = el('input', { type: 'checkbox', onchange: () => zapis(c.checked) });
  P.obnovy.push(() => { c.checked = cti(); });
  registruj(P, text, ikona, () => zapis(!cti()));
  return zadrz(el('label.ps-zaskrt', {}, c, el('span', { text })));
}

function kartaZobrazeni(P) {
  return [
    skupina('Zobrazení', [
      velke(P, { ik: 'rezimCteni', text: 'Režim\nčtení', stav: () => P.st.rezim === 'cteni', akce: () => P.rezim('cteni') }),
      velke(P, { ik: 'rozlozeniTisk', text: 'Rozložení\npři tisku', stav: () => P.st.rezim === 'tisk', akce: () => P.rezim('tisk') }),
      velke(P, { ik: 'rozlozeniWeb', text: 'Rozložení\npro web', stav: () => P.st.rezim === 'web', akce: () => P.rezim('web') }),
      sloupec(male(P, { ik: 'odrazky', text: 'Osnova', zakazano: true }), male(P, { ik: 'novy', text: 'Koncept', zakazano: true })),
    ], { priorita: 6, ikona: 'rozlozeniTisk' }),
    skupina('Asistivní', [
      velke(P, { ik: 'zamereni', text: 'Zaměření', akce: () => P.zamereni(true) }),
      velke(P, { ik: 'cteckaTextu', text: 'Asistivní\nčtečka', akce: () => P.rezim('cteni') }),
    ], { priorita: 3, ikona: 'zamereni' }),
    skupina('Zobrazit', [sloupec(
      zaskrt(P, 'Pravítko', 'pravitko', () => P.st.pravitko, (v) => P.pravitko(v)),
      zaskrt(P, 'Mřížka', 'mrizka', () => P.st.mrizka, (v) => { P.st.mrizka = v; P.koren.classList.toggle('ps-s-mrizkou', v); P.obnov(); }),
      zaskrt(P, 'Navigační podokno', 'navigace', () => P.st.podoknoVlevo === 'navigace', (v) => P.podokno(v ? 'navigace' : null, { vlevo: true })),
    )], { priorita: 4, ikona: 'pravitko' }),
    skupina('Lupa', [
      velke(P, { ik: 'lupa', text: 'Lupa', akce: () => D.dialogLupa(P) }),
      velke(P, { ik: 'sto', text: '100 %', akce: () => P.lupa(1) }),
      sloupec(
        male(P, { ik: 'rozlozeniTisk', text: 'Jedna stránka', akce: () => P.lupa('strana') }),
        male(P, { ik: 'rezimCteni', text: 'Více stránek', akce: () => P.lupa('vice') }),
        male(P, { ik: 'zarovnatDoBloku', text: 'Šířka stránky', akce: () => P.lupa('sirka') }),
      ),
    ], { priorita: 5, ikona: 'lupa' }),
    skupina('Okno', [
      velke(P, { ik: 'noveOkno', text: 'Nové\nokno', zakazano: true }),
      sloupec(male(P, { ik: 'mrizka', text: 'Uspořádat vše', zakazano: true }), male(P, { ik: 'zarovnatDoBloku', text: 'Rozdělit', zakazano: true })),
    ], { priorita: 1, ikona: 'noveOkno' }),
    skupina('Makra', [velke(P, { ik: 'rozlozeniWeb', text: 'Makra', zakazano: true })], { priorita: 0, ikona: 'rozlozeniWeb' }),
  ];
}

function kartaNapoveda(P) {
  return [
    skupina('Nápověda', [
      velke(P, { ik: 'napoveda', text: 'Nápověda', klavesa: 'F1', akce: () => P.podokno('napoveda') }),
      velke(P, { ik: 'podpora', text: 'Kontaktovat\npodporu', akce: () => D.zpravaP(P, 'Podpora AstroOS je dostupná 24/7 — stačí se zeptat AstroAI v nabídce Start.') }),
      velke(P, { ik: 'nazory', text: 'Názory', akce: () => D.dialogNazory(P) }),
      velke(P, { ik: 'skoleni', text: 'Zobrazit\nškolení', akce: () => P.novy('prohlidka') }),
      velke(P, { ik: 'coNoveho', text: 'Co je\nnového', akce: () => D.dialogCoNoveho(P) }),
    ], { priorita: 5, ikona: 'napoveda' }),
  ];
}

// ---------------------------------------------------------------- kontextové karty
export const STYLY_TABULKY = {
  'ps-tab-mrizka': 'Mřížka tabulky',
  'ps-tab-modra': 'Tabulka s mřížkou 4 – zvýraznění 1',
  'ps-tab-svetla': 'Světlá mřížka',
  'ps-tab-pruhy': 'Tabulka se seznamem 3',
  'ps-tab-oranzova': 'Tabulka s mřížkou 5 tmavá – zvýraznění 2',
  'ps-tab-bez': 'Obyčejná tabulka (bez ohraničení)',
};

function kartaTabNavrh(P) {
  const gal = el('div.ps-galerie.ps-galerie-tabulky');
  for (const [cls, n] of Object.entries(STYLY_TABULKY)) {
    const t = el('table.ps-tab.ps-tab-mini.' + cls, {}, el('tbody', {}, [0, 1, 2, 3].map(() => el('tr', {}, [0, 1, 2, 3].map(() => el('td'))))));
    const b = zadrz(el('button.ps-gal-tab', { type: 'button', title: n, onclick: () => P.stylTabulky(cls) }, t));
    P.stavy.push({ uzel: b, fn: () => P.tabulka()?.classList.contains(cls) });
    gal.append(b);
  }
  return [
    skupina('Možnosti stylů tabulek', [sloupec(
      zaskrt(P, 'Řádek záhlaví', 'tabulka', () => !P.tabulka()?.classList.contains('bez-zahlavi'), (v) => P.prikaz(() => P.tabulka()?.classList.toggle('bez-zahlavi', !v), 'Řádek záhlaví')),
      zaskrt(P, 'Pruhované řádky', 'tabulka', () => !!P.tabulka()?.classList.contains('pruhovane'), (v) => P.prikaz(() => P.tabulka()?.classList.toggle('pruhovane', v), 'Pruhované řádky')),
      zaskrt(P, 'První sloupec', 'tabulka', () => !!P.tabulka()?.classList.contains('prvni-sloupec'), (v) => P.prikaz(() => P.tabulka()?.classList.toggle('prvni-sloupec', v), 'První sloupec')),
    )], { priorita: 3, ikona: 'tabulka' }),
    skupina('Styly tabulek', [
      gal,
      sloupec(
        delene(P, {
          ik: 'stinovani', titulek: 'Stínování', akce: () => {},
          rozbal: () => paleta({ auto: 'Bez barvy', bezBarvy: true, onVyber: (b) => P.prikaz(() => P.vybraneBunky().forEach((c) => { c.style.backgroundColor = b || ''; }), 'Stínování buňky') }),
        }),
      ),
    ], { priorita: 5, ikona: 'tabulka' }),
    skupina('Ohraničení', [
      male(P, {
        ik: 'ohraniceni', text: 'Ohraničení', rozbal: () => nabidka([
          { text: 'Všechna ohraničení', akce: () => P.prikaz(() => P.vybraneBunky().forEach((c) => { c.style.border = '0.75pt solid #000'; }), 'Ohraničení') },
          { text: 'Bez ohraničení', akce: () => P.prikaz(() => P.vybraneBunky().forEach((c) => { c.style.border = 'none'; }), 'Ohraničení') },
          { text: 'Tlusté ohraničení', akce: () => P.prikaz(() => P.vybraneBunky().forEach((c) => { c.style.border = '2.25pt solid #000'; }), 'Ohraničení') },
        ]),
      }),
    ], { priorita: 2, ikona: 'ohraniceni' }),
  ];
}

function kartaTabRozlozeni(P) {
  return [
    skupina('Tabulka', [sloupec(
      male(P, {
        ik: 'vybrat', text: 'Vybrat', rozbal: () => nabidka([
          { text: 'Vybrat buňku', akce: () => P.vyberTabulky('bunka') },
          { text: 'Vybrat sloupec', akce: () => P.vyberTabulky('sloupec') },
          { text: 'Vybrat řádek', akce: () => P.vyberTabulky('radek') },
          { text: 'Vybrat tabulku', akce: () => P.vyberTabulky('tabulka') },
        ]),
      }),
      male(P, { ik: 'mrizka', text: 'Zobrazit mřížku', akce: () => { P.koren.classList.toggle('ps-mrizka-tabulek'); } }),
      male(P, { ik: 'informace', text: 'Vlastnosti', akce: () => D.zpravaP(P, `Tabulka má ${P.tabulka()?.rows.length || 0} řádků a ${P.tabulka()?.rows[0]?.cells.length || 0} sloupců.`) }),
    )], { priorita: 2, ikona: 'tabulka' }),
    skupina('Řádky a sloupce', [
      velke(P, {
        ik: 'odstranit', text: 'Odstranit', rozbal: () => nabidka([
          { text: 'Odstranit buňky…', zakazano: true },
          { text: 'Odstranit sloupce', akce: () => P.upravTabulku('smazSloupec') },
          { text: 'Odstranit řádky', akce: () => P.upravTabulku('smazRadek') },
          { text: 'Odstranit tabulku', akce: () => P.upravTabulku('smazTabulku') },
        ]),
      }),
      velke(P, { ik: 'vlozitNad', text: 'Vložit\nnad', akce: () => P.upravTabulku('radekNad') }),
      velke(P, { ik: 'vlozitPod', text: 'Vložit\npod', akce: () => P.upravTabulku('radekPod') }),
      velke(P, { ik: 'vlozitVlevo', text: 'Vložit\nvlevo', akce: () => P.upravTabulku('sloupecVlevo') }),
      velke(P, { ik: 'vlozitVpravo', text: 'Vložit\nvpravo', akce: () => P.upravTabulku('sloupecVpravo') }),
    ], { priorita: 5, ikona: 'vlozitPod' }),
    skupina('Sloučit', [sloupec(
      male(P, { ik: 'sloucit', text: 'Sloučit buňky', akce: () => P.upravTabulku('sloucit') }),
      male(P, { ik: 'sloupce', text: 'Rozdělit tabulku', akce: () => P.upravTabulku('rozdelit') }),
    )], { priorita: 3, ikona: 'sloucit' }),
    skupina('Zarovnání', [
      radek(
        male(P, { ik: 'zarovnatVlevo', titulek: 'Zarovnat vlevo', akce: () => P.prikaz(() => P.vybraneBunky().forEach((c) => { c.style.textAlign = 'left'; }), 'Zarovnání buňky') }),
        male(P, { ik: 'zarovnatNaStred', titulek: 'Zarovnat na střed', akce: () => P.prikaz(() => P.vybraneBunky().forEach((c) => { c.style.textAlign = 'center'; }), 'Zarovnání buňky') }),
        male(P, { ik: 'zarovnatVpravo', titulek: 'Zarovnat vpravo', akce: () => P.prikaz(() => P.vybraneBunky().forEach((c) => { c.style.textAlign = 'right'; }), 'Zarovnání buňky') }),
      ),
      radek(
        male(P, { ik: 'sipkaDolu', titulek: 'Nahoru', akce: () => P.prikaz(() => P.vybraneBunky().forEach((c) => { c.style.verticalAlign = 'top'; }), 'Svislé zarovnání') }),
        male(P, { ik: 'zarovnatNaStred', titulek: 'Na střed svisle', akce: () => P.prikaz(() => P.vybraneBunky().forEach((c) => { c.style.verticalAlign = 'middle'; }), 'Svislé zarovnání') }),
        male(P, { ik: 'sipkaDolu', titulek: 'Dolů', akce: () => P.prikaz(() => P.vybraneBunky().forEach((c) => { c.style.verticalAlign = 'bottom'; }), 'Svislé zarovnání') }),
      ),
    ], { priorita: 4, ikona: 'zarovnatNaStred' }),
  ];
}

function kartaObrazek(P) {
  const obr = () => P.st.obrazek;
  return [
    skupina('Styly obrázků', [(() => {
      const g = el('div.ps-galerie.ps-galerie-obr');
      const STYLY_OBR = {
        '': 'Bez stylu', 'ps-obr-ramecek': 'Jednoduchý rámeček, bílý', 'ps-obr-stin': 'Vržený stín', 'ps-obr-zaobleny': 'Zaoblený obdélník',
        'ps-obr-otoceny': 'Otočený, bílý', 'ps-obr-ovalny': 'Oválný', 'ps-obr-cerny': 'Silný rámeček, černý',
      };
      for (const [cls, n] of Object.entries(STYLY_OBR)) {
        const b = zadrz(el('button.ps-gal-obr', { type: 'button', title: n, onclick: () => P.prikaz(() => {
          const o = obr(); if (!o) return;
          Object.keys(STYLY_OBR).filter(Boolean).forEach((c) => o.classList.remove(c));
          if (cls) o.classList.add(cls);
        }, 'Styl obrázku') }, el('span.ps-obr-vzor' + (cls ? '.' + cls : ''))));
        g.append(b);
      }
      return g;
    })()], { priorita: 4, ikona: 'obrazky' }),
    skupina('Usnadnění', [velke(P, { ik: 'textovePole', text: 'Alternativní\ntext', akce: () => D.dialogAlt(P) })], { priorita: 2, ikona: 'textovePole' }),
    skupina('Uspořádat', [
      velke(P, {
        ik: 'obtekani', text: 'Obtékání\ntextu', rozbal: () => nabidka([
          { text: 'V řádku s textem', akce: () => P.obtekani('radek') },
          { text: 'Obdélník (vlevo)', akce: () => P.obtekani('vlevo') },
          { text: 'Obdélník (vpravo)', akce: () => P.obtekani('vpravo') },
          { text: 'Nahoře a dole', akce: () => P.obtekani('blok') },
        ], { sirka: 200 }),
      }),
      velke(P, {
        ik: 'zarovnatNaStred', text: 'Zarovnat', rozbal: () => nabidka([
          { text: 'Zarovnat doleva', ikona: 'zarovnatVlevo', akce: () => exec(P, 'justifyLeft', null, 'Zarovnat') },
          { text: 'Zarovnat na střed', ikona: 'zarovnatNaStred', akce: () => exec(P, 'justifyCenter', null, 'Zarovnat') },
          { text: 'Zarovnat doprava', ikona: 'zarovnatVpravo', akce: () => exec(P, 'justifyRight', null, 'Zarovnat') },
        ]),
      }),
    ], { priorita: 3, ikona: 'obtekani' }),
    skupina('Velikost', [sloupec(
      spinner(P, { popis: 'Výška:', jednotka: 'cm', krok: 0.5, cti: () => (obr() ? +(obr().offsetHeight / MM / 10).toFixed(2) : 0), zapis: (v) => P.velikostObrazku(null, v) }),
      spinner(P, { popis: 'Šířka:', jednotka: 'cm', krok: 0.5, cti: () => (obr() ? +(obr().offsetWidth / MM / 10).toFixed(2) : 0), zapis: (v) => P.velikostObrazku(v, null) }),
    )], { priorita: 5, ikona: 'velikost' }),
  ];
}

function kartaZahlavi(P) {
  return [
    skupina('Záhlaví a zápatí', [
      velke(P, {
        ik: 'cisloStranky', text: 'Číslo\nstránky', akce: () => P.vlozDoZahlavi('<span class="ps-pole-cislo">1</span>'),
      }),
    ], { priorita: 3, ikona: 'cisloStranky' }),
    skupina('Vložit', [
      velke(P, { ik: 'datumCas', text: 'Datum\na čas', akce: () => P.vlozDoZahlavi(new Date().toLocaleDateString('cs-CZ')) }),
      velke(P, { ik: 'novy', text: 'Informace\no dokumentu', akce: () => P.vlozDoZahlavi(P.st.nazev) }),
    ], { priorita: 2, ikona: 'datumCas' }),
    skupina('Zavřít', [velke(P, { ik: 'zavritZahlavi', text: 'Zavřít záhlaví\na zápatí', akce: () => P.zavriZahlavi() })], { priorita: 9, ikona: 'zavritZahlavi' }),
  ];
}

// ---------------------------------------------------------------- sestavení pásu
export const KARTY = [
  { id: 'domu', nazev: 'Domů', stav: kartaDomu },
  { id: 'vlozeni', nazev: 'Vložení', stav: kartaVlozeni },
  { id: 'kresleni', nazev: 'Kreslení', stav: kartaKresleni },
  { id: 'navrh', nazev: 'Návrh', stav: kartaNavrh },
  { id: 'rozlozeni', nazev: 'Rozložení', stav: kartaRozlozeni },
  { id: 'reference', nazev: 'Reference', stav: kartaReference },
  { id: 'korespondence', nazev: 'Korespondence', stav: kartaKorespondence },
  { id: 'revize', nazev: 'Revize', stav: kartaRevize },
  { id: 'zobrazeni', nazev: 'Zobrazení', stav: kartaZobrazeni },
  { id: 'napoveda', nazev: 'Nápověda', stav: kartaNapoveda },
  { id: 'tabNavrh', nazev: 'Návrh tabulky', stav: kartaTabNavrh, kontext: 'tabulka' },
  { id: 'tabRozlozeni', nazev: 'Rozložení', stav: kartaTabRozlozeni, kontext: 'tabulka' },
  { id: 'obrazek', nazev: 'Formát obrázku', stav: kartaObrazek, kontext: 'obrazek' },
  { id: 'zahlavi', nazev: 'Záhlaví a zápatí', stav: kartaZahlavi, kontext: 'zahlavi' },
];

/** Postaví všechny karty (obsah se staví hned — kvůli hledání příkazů v titulku). */
export function postavKarty(P) {
  const obsahy = {};
  for (const k of KARTY) {
    const o = el('div.ps-karta-obsah', { dataset: { karta: k.id } }, k.stav(P));
    obsahy[k.id] = o;
  }
  return obsahy;
}

// stavební kameny sdílí i AstroTabulky (js/tabulky/pas.js)
export { velke, male, delene, skupina, radek, sloupec, oddelovac, kombo, zadrz };

/** Sbalí skupiny s nejnižší prioritou, dokud se karta nevejde. */
export function prizpusobKartu(obsah, sirka) {
  const sk = [...obsah.querySelectorAll(':scope > .ps-skupina')];
  sk.forEach((s) => s.classList.remove('sbalena'));
  const serazene = [...sk].sort((a, b) => +a.dataset.priorita - +b.dataset.priorita);
  for (const s of serazene) {
    if (obsah.scrollWidth <= sirka + 1) break;
    s.classList.add('sbalena');
  }
}
