// AstroTabulky — dialogová okna (Formát buněk, Vložit funkci, Najít a nahradit, Seřadit, Podmíněné formátování,
// Ověření dat, Hledání řešení, Správce názvů, Zamknout list, Graf, Kontingenční tabulka, Vzhled stránky…)

import { el } from '../util.js';
import * as FS from '../fs.js';
import { ik } from '../pismo/ikony.js';
import { dialog, zprava, pole, rozbal, zavriRozbal, nabidka, paleta, MOTIV_BARVY, STANDARDNI } from '../pismo/ui.js';
import { PISMA } from '../pismo/dokument.js';
import { klic, zKlice, MAX_R, MAX_C, adresa, textOblasti, rozeberOblast, serad, obsahuje, prekryva, pismena, jmenoListuVeVzorci } from './adresy.js';
import { formatuj, rozborKodu, kodCesky, kodZCeskeho, KATEGORIE, kodCislo, kodMena, kodUcetni, jeChyba, obecne, rozpoznej, datumZTextu, dnes } from './format.js';
import { slozStyl, oblastDatTabulky, rozdelCsv, uhodniOddelovac, Sesit, rozdelText } from './sesit.js';
import { FUNKCE, KATEGORIE_FUNKCI, syntaxe, parse, vyhodnot, Ref, naPole, lex, normalizujVzorec, posunVzorec } from './vzorce.js';
import { PREDVOLBY_CF, DATOVE_PRUHY, BAREVNE_SKALY, SADY_IKON, STYLY_TABULEK } from './styly.js';
import { TYPY_GRAFU, svgGrafu, dataGrafu, doporuceneGrafy } from './grafy.js';
import { vytvorKontingencni, zdrojKontingencni } from './kontingencni.js';
import { zasobnik } from './kresleni.js';

const L = (P) => P.S.list;
const V = (P) => L(P).vyber;
const OBL = (P) => { const o = V(P).oblasti; return o[o.length - 1]; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const stop = (u) => { u.addEventListener('keydown', (e) => e.stopPropagation()); return u; };
const vstup = (o = {}) => stop(el('input.ps-vstup', { type: 'text', spellcheck: 'false', ...o }));
const vyber = (moznosti, hodnota, o = {}) => el('select.ps-vyber', o, moznosti.map(([v, t]) => el('option', { value: v, text: t, selected: String(v) === String(hodnota) })));
const zaskrt = (text, zap, onchange) => { const c = el('input', { type: 'checkbox' }); c.checked = !!zap; if (onchange) c.onchange = () => onchange(c.checked); return { uzel: el('label.ps-zaskrt', {}, c, el('span', { text })), c }; };
const prepinac = (jmeno, moznosti, hodnota, onchange) => {
  const radia = moznosti.map(([v, t]) => { const r = el('input', { type: 'radio', name: jmeno, value: v }); r.checked = v === hodnota; r.onchange = () => onchange?.(v); return el('label.ps-zaskrt', {}, r, el('span', { text: t })); });
  return { uzly: radia, hodnota: () => radia.map((x) => x.querySelector('input')).find((x) => x.checked)?.value };
};
let citac = 0;

/** Posunutelný dialog bez zatmavení (Najít a nahradit, Okno kukátka…). */
function nemodalni(d) {
  d.okno.closest('.ps-kryt')?.classList.add('tb-nemodalni');
  const hlava = d.okno.querySelector('.ps-dialog-hlava');
  hlava.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    const r = d.okno.getBoundingClientRect();
    const dx = e.clientX - r.left, dy = e.clientY - r.top;
    const kryt = d.okno.closest('.ps-kryt').getBoundingClientRect();
    const mv = (ev) => { d.okno.style.position = 'absolute'; d.okno.style.margin = '0'; d.okno.style.left = (ev.clientX - kryt.left - dx) + 'px'; d.okno.style.top = (ev.clientY - kryt.top - dy) + 'px'; };
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  });
  return d;
}

/** Pole pro oblast s tlačítkem „sbalit dialog“ — dá se vybrat myší v listu (RefEdit v Excelu). */
function poleOblasti(P, hodnota = '', { popis = '' } = {}) {
  const i = vstup({ value: hodnota, class: 'ps-vstup tb-refedit' });
  const b = el('button.tb-refedit-b', { type: 'button', title: 'Sbalit dialog a vybrat oblast v listu' }, ik('sbalit'));
  b.onclick = () => {
    const kryt = i.closest('.ps-kryt');
    if (!kryt) return;
    kryt.style.display = 'none';
    const lista = el('div.tb-refedit-lista', {}, el('span', { text: popis || 'Vyberte oblast' }), stop(el('input.ps-vstup', { value: i.value })), el('button.ps-tlac.primarni', { type: 'button', text: 'Hotovo' }));
    const [, li, hotovo] = lista.children;
    P.koren.append(lista);
    const puvodni = P.poZmeneVyberu;
    P.poZmeneVyberu = (t) => {
      puvodni(t);
      const o = OBL(P);
      li.value = (L(P) !== P._refList ? jmenoListuVeVzorci(L(P).nazev) + '!' : '') + textOblasti(o, true);
    };
    P._refList = L(P);
    const konec = () => { P.poZmeneVyberu = puvodni; lista.remove(); kryt.style.display = ''; i.value = li.value; i.dispatchEvent(new Event('input')); i.focus(); };
    hotovo.onclick = konec;
    li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === 'Escape') konec(); });
    P.grid.fokus();
  };
  const u = el('div.tb-refedit-ram', {}, i, b);
  u.vstup = i;
  return u;
}

/** Hodnota odkazu jako text pro náhled „= …“ v dialogu Argumenty funkce. */
function nahledHodnoty(P, text) {
  if (!text.trim()) return '';
  try {
    const s = parse('=' + text);
    let x = vyhodnot(s, { S: P.S.S, list: L(P), r: V(P).r, c: V(P).c });
    if (x instanceof Ref) x = naPole(x, { S: P.S.S, list: L(P), r: V(P).r, c: V(P).c });
    const f = (v) => (typeof v === 'string' ? `"${v}"` : jeChyba(v) ? v.kod : typeof v === 'boolean' ? (v ? 'PRAVDA' : 'NEPRAVDA') : typeof v === 'number' ? obecne(v, 12) : v === null ? '0' : String(v));
    if (Array.isArray(x)) return '{' + x.slice(0, 6).map((r) => r.slice(0, 6).map(f).join('\\')).join(';') + (x.length > 6 ? ';…' : '') + '}';
    return f(x);
  } catch { return 'neplatné'; }
}

// ================================================================ Formát buněk
export function dialogFormatBunek(P, karta = 'cislo', kategorie = null) {
  const s = { ...(P.stav.s || {}) };
  const zmeny = {};
  const nastav = (k, v) => { zmeny[k] = v; s[k] = v; };
  const hodnota = P.stav.hodnota;
  const karty = [['cislo', 'Číslo'], ['zarovnani', 'Zarovnání'], ['pismo', 'Písmo'], ['ohraniceni', 'Ohraničení'], ['vypln', 'Výplň'], ['zamek', 'Zámek']];
  const telo = el('div.tb-fb-telo');
  const zalozky = el('div.tb-zalozky-dlg', {}, karty.map(([id, t]) => el('button', { type: 'button', text: t, dataset: { id }, onclick: () => ukaz(id) })));
  let ohraniceniStav = null;

  const STRANY = {
    cislo() {
      const r = rozborKodu(s.nf || 'General');
      let kat = kategorie || r.kat;
      if (kat === 'datum' && !KATEGORIE.find((k) => k.id === 'datum')) kat = 'vlastni';
      const seznam = el('div.tb-fb-seznam');
      const prava = el('div.tb-fb-prava');
      const ukazka = el('div.tb-fb-ukazka');
      const kodNyni = () => s.nf || 'General';
      const obnovUkazku = () => { const f = formatuj(typeof hodnota === 'number' || typeof hodnota === 'string' ? hodnota : 1234.5, kodNyni()); ukazka.replaceChildren(el('small', { text: 'Ukázka' }), el('div', { text: f.text || ' ', style: { color: f.barva || '' } })); };
      const kresliKat = () => {
        seznam.replaceChildren(...KATEGORIE.map((k) => el('button' + (k.id === kat ? '.vybrano' : ''), { type: 'button', text: k.nazev, onclick: () => { kat = k.id; vychozi(); kresliKat(); } })));
        const k = KATEGORIE.find((x) => x.id === kat);
        const ovl = [];
        const des = el('input.ps-vstup.kratky', { type: 'number', min: 0, max: 30, value: rozborKodu(kodNyni()).des || (['cislo', 'mena', 'ucetni', 'procenta', 'vedecky'].includes(kat) ? 2 : 0) });
        stop(des);
        if (kat === 'cislo') {
          const tis = zaskrt('Použít oddělovač 1000 ( )', /,/.test(kodNyni().split(';')[0]));
          const zap = el('div.tb-fb-zaporna');
          let z = /\[Red\]-/.test(kodNyni()) ? 3 : /;-/.test(kodNyni()) ? 2 : /\[Red\]/.test(kodNyni()) ? 1 : 0;
          const kresliZap = () => zap.replaceChildren(...[0, 1, 2, 3].map((i) => {
            const t = formatuj(-1234.1, kodCislo({ des: +des.value, tisice: tis.c.checked, zaporne: i }));
            return el('button' + (i === z ? '.vybrano' : ''), { type: 'button', style: { color: t.barva || '' }, text: t.text, onclick: () => { z = i; aplikuj(); } });
          }));
          const aplikuj = () => { nastav('nf', kodCislo({ des: +des.value, tisice: tis.c.checked, zaporne: z })); kresliZap(); obnovUkazku(); };
          des.oninput = aplikuj; tis.c.onchange = aplikuj;
          kresliZap();
          ovl.push(pole('Desetinná místa:', des), tis.uzel, el('small', { text: 'Záporná čísla:' }), zap);
        } else if (kat === 'mena' || kat === 'ucetni') {
          const sym = vyber([['Kč', 'Kč'], ['€', '€'], ['$', '$'], ['', 'Žádný']], rozborKodu(kodNyni()).symbol ?? 'Kč');
          const aplikuj = () => { nastav('nf', kat === 'mena' ? kodMena({ des: +des.value, symbol: sym.value, zaporne: 0 }) : kodUcetni({ des: +des.value, symbol: sym.value })); obnovUkazku(); };
          des.oninput = aplikuj; sym.onchange = aplikuj;
          ovl.push(pole('Desetinná místa:', des), pole('Symbol:', sym));
        } else if (kat === 'procenta' || kat === 'vedecky') {
          const aplikuj = () => { const d = +des.value; nastav('nf', kat === 'procenta' ? (d ? '0.' + '0'.repeat(d) : '0') + '%' : (d ? '0.' + '0'.repeat(d) : '0') + 'E+00'); obnovUkazku(); };
          des.oninput = aplikuj;
          ovl.push(pole('Desetinná místa:', des));
        } else if (k.kody) {
          const seznamKodu = el('div.tb-fb-kody', {}, k.kody.map((kod) => el('button' + (kod === kodNyni() ? '.vybrano' : ''), { type: 'button', text: formatuj(typeof hodnota === 'number' ? hodnota : 46288.5, kod).text, title: kodCesky(kod), onclick: (e) => { nastav('nf', kod); seznamKodu.querySelectorAll('button').forEach((b) => b.classList.toggle('vybrano', b === e.currentTarget)); obnovUkazku(); } })));
          ovl.push(el('small', { text: 'Typ:' }), seznamKodu);
        } else if (kat === 'vlastni') {
          const typ = vstup({ value: kodCesky(kodNyni()) });
          const bezne = ['Obecný', '0', '0,00', '# ##0', '# ##0,00', '# ##0 Kč', '# ##0,00 Kč', '0%', '0,00%', '0,00E+00', 'd.m.rrrr', 'd. mmmm rrrr', 'dddd', 'mmmm', 'h:mm', 'h:mm:ss', '[h]:mm', '@', '"ks" 0', '0" ks"', '+0;-0;0', '[Red]0;[Blue]-0'];
          const s2 = el('div.tb-fb-kody', {}, bezne.map((kd) => el('button', { type: 'button', text: kd, onclick: () => { typ.value = kd; typ.dispatchEvent(new Event('input')); } })));
          typ.oninput = () => { nastav('nf', kodZCeskeho(typ.value)); obnovUkazku(); };
          ovl.push(pole('Typ:', typ), s2);
        } else if (kat === 'text' || kat === 'obecny') { /* jen popis */ }
        prava.replaceChildren(ukazka, ...ovl, el('p.tb-fb-popis', { text: k.popis }));
        obnovUkazku();
      };
      const vychozi = () => {
        const kody = { obecny: 'General', cislo: '0.00', mena: kodMena({ des: 2, symbol: 'Kč' }), ucetni: kodUcetni({ des: 2, symbol: 'Kč' }), datum: 'd.m.yyyy', cas: 'h:mm:ss', procenta: '0.00%', zlomek: '# ?/?', vedecky: '0.00E+00', text: '@', zvlastni: '000 00' };
        if (kody[kat]) nastav('nf', kody[kat]);
      };
      if (kategorie && kategorie !== r.kat) vychozi();
      kresliKat();
      return el('div.tb-fb-cislo', {}, el('div', {}, el('small', { text: 'Druh:' }), seznam), prava);
    },
    zarovnani() {
      const h = vyber([['g', 'Obecné'], ['l', 'Vlevo (odsazení)'], ['c', 'Na střed'], ['r', 'Vpravo (odsazení)'], ['fill', 'Vyplnit'], ['j', 'Do bloku'], ['cs', 'Zarovnat na střed výběru']], s.h || 'g', { onchange: (e) => nastav('h', e.target.value === 'g' ? null : e.target.value) });
      const v = vyber([['t', 'Nahoru'], ['m', 'Na střed'], ['b', 'Dolů'], ['j', 'Do bloku']], s.v || 'b', { onchange: (e) => nastav('v', e.target.value === 'b' ? null : e.target.value) });
      const ods = stop(el('input.ps-vstup.kratky', { type: 'number', min: 0, max: 15, value: s.odsaz || 0, oninput: (e) => nastav('odsaz', +e.target.value || null) }));
      const zal = zaskrt('Zalamovat text', s.zalam, (x) => nastav('zalam', x || null));
      const zm = zaskrt('Přizpůsobit buňce', s.zmensit, (x) => nastav('zmensit', x || null));
      const sl = zaskrt('Sloučit buňky', P.stav.slouceno, (x) => { zmeny._sloucit = x; });
      const uhel = stop(el('input.ps-vstup.kratky', { type: 'number', min: -90, max: 90, value: typeof s.otoc === 'number' ? s.otoc : 0 }));
      const oblouk = el('div.tb-fb-orientace');
      const kresliOblouk = () => {
        oblouk.innerHTML = `<svg viewBox="0 0 120 120"><path d="M20 110 A90 90 0 0 1 20 -70" fill="none" stroke="#bbb" stroke-dasharray="2 4"/>${[-90, -45, 0, 45, 90].map((a) => { const r = a * Math.PI / 180; return `<circle cx="${20 + 88 * Math.cos(r)}" cy="${60 - 88 * Math.sin(r)}" r="3" fill="${+uhel.value === a ? '#107c41' : '#999'}"/>`; }).join('')}<g transform="translate(20 60) rotate(${-(+uhel.value || 0)})"><line x1="0" y1="0" x2="80" y2="0" stroke="#107c41" stroke-width="1.5"/><text x="12" y="-4" font-size="11" fill="currentColor">Text ——</text></g></svg>`;
      };
      oblouk.onclick = (e) => {
        const r = oblouk.getBoundingClientRect();
        const x = e.clientX - r.left - r.width * 20 / 120, y = r.top + r.height / 2 - e.clientY;
        uhel.value = Math.max(-90, Math.min(90, Math.round(Math.atan2(y, x) * 180 / Math.PI / 5) * 5));
        uhel.dispatchEvent(new Event('input'));
      };
      uhel.oninput = () => { nastav('otoc', +uhel.value || null); kresliOblouk(); };
      const svisly = el('button.tb-fb-svisly' + (s.otoc === 'svisle' ? '.vybrano' : ''), { type: 'button', html: 'T<br>e<br>x<br>t', onclick: (e) => { const zap = s.otoc !== 'svisle'; nastav('otoc', zap ? 'svisle' : null); e.currentTarget.classList.toggle('vybrano', zap); } });
      kresliOblouk();
      return el('div.tb-fb-zarovnani', {},
        el('div', {}, el('h4', { text: 'Zarovnání textu' }), pole('Vodorovně:', h), pole('Svisle:', v), pole('Odsazení:', ods),
          el('h4', { text: 'Nastavení textu' }), zal.uzel, zm.uzel, sl.uzel),
        el('div', {}, el('h4', { text: 'Orientace' }), el('div.tb-fb-or', {}, svisly, oblouk), pole('Stupně:', uhel)));
    },
    pismo() {
      const nahled = el('div.tb-fb-nahled-pismo', { text: 'AaBbCcYyZz' });
      const obnov = () => Object.assign(nahled.style, { fontFamily: zasobnik(s.font), fontWeight: s.b ? 700 : 400, fontStyle: s.i ? 'italic' : 'normal', fontSize: Math.min(28, (s.vel || 11) * 1.33) + 'px', color: s.barva || '#000', textDecoration: [s.u && 'underline', s.st && 'line-through'].filter(Boolean).join(' ') || 'none', textDecorationStyle: s.u === 'd' ? 'double' : 'solid' });
      const seznamP = el('div.tb-fb-list');
      const pismoV = vstup({ value: s.font || 'Aptos Narrow' });
      const kresliP = () => seznamP.replaceChildren(...['Aptos Narrow', ...PISMA].filter((p) => p.toLowerCase().includes(pismoV.value.toLowerCase()) || !pismoV.value).map((p) => el('button' + (p === (s.font || 'Aptos Narrow') ? '.vybrano' : ''), { type: 'button', text: p, style: { fontFamily: zasobnik(p) }, onclick: () => { nastav('font', p === 'Aptos Narrow' ? null : p); pismoV.value = p; kresliP(); obnov(); } })));
      pismoV.oninput = kresliP;
      const rez = el('div.tb-fb-list.kratky', {}, [['n', 'Obyčejné'], ['i', 'Kurzíva'], ['b', 'Tučné'], ['bi', 'Tučná kurzíva']].map(([k, t]) => el('button' + ((k === 'n' && !s.b && !s.i) || (k === 'b' && s.b && !s.i) || (k === 'i' && s.i && !s.b) || (k === 'bi' && s.b && s.i) ? '.vybrano' : ''), { type: 'button', text: t, onclick: (e) => { nastav('b', k.includes('b') || null); nastav('i', k.includes('i') || null); rez.querySelectorAll('button').forEach((b) => b.classList.toggle('vybrano', b === e.currentTarget)); obnov(); } })));
      const vel = el('div.tb-fb-list.kratky', {}, [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72].map((v) => el('button' + (v === (s.vel || 11) ? '.vybrano' : ''), { type: 'button', text: v, onclick: (e) => { nastav('vel', v === 11 ? null : v); vel.querySelectorAll('button').forEach((b) => b.classList.toggle('vybrano', b === e.currentTarget)); obnov(); } })));
      const podtr = vyber([['', 'Žádné'], ['s', 'Jednoduché'], ['d', 'Dvojité']], s.u || '', { onchange: (e) => { nastav('u', e.target.value || null); obnov(); } });
      const barva = el('input', { type: 'color', value: s.barva || '#000000', oninput: (e) => { nastav('barva', e.target.value.toUpperCase()); obnov(); } });
      const pr = zaskrt('Přeškrtnuté', s.st, (x) => { nastav('st', x || null); obnov(); });
      kresliP(); obnov();
      return el('div.tb-fb-pismo', {},
        el('div.tb-fb-3', {}, el('div', {}, el('small', { text: 'Písmo:' }), pismoV, seznamP), el('div', {}, el('small', { text: 'Řez písma:' }), rez), el('div', {}, el('small', { text: 'Velikost:' }), vel)),
        el('div.tb-fb-3', {}, pole('Podtržení:', podtr), pole('Barva:', barva), el('div', {}, el('small', { text: 'Efekty:' }), pr.uzel)),
        el('div.tb-fb-nahled-ram', {}, el('small', { text: 'Náhled' }), nahled));
    },
    ohraniceni() {
      const o = OBL(P);
      const vice = o.r1 !== o.r2 || o.c1 !== o.c2;
      const st = ohraniceniStav || (ohraniceniStav = { cara: { s: 'tenka', b: '#000000' }, strany: { ...(vice ? {} : s.ohr || {}) } });
      const car = [['tenka', 'Tenká'], ['stredni', 'Střední'], ['tlusta', 'Tlustá'], ['dvojita', 'Dvojitá'], ['carky', 'Čárkovaná'], ['tecky', 'Tečkovaná'], ['stredniCarky', 'Střední čárkovaná'], ['carkaTecka', 'Čárka tečka']];
      const styly = el('div.tb-fb-cary', {}, car.map(([k, t]) => el('button' + (st.cara.s === k ? '.vybrano' : ''), { type: 'button', title: t, onclick: (e) => { st.cara = { ...st.cara, s: k }; styly.querySelectorAll('button').forEach((b) => b.classList.toggle('vybrano', b === e.currentTarget)); } }, el('i.tb-cara-' + k))));
      const barva = el('input', { type: 'color', value: st.cara.b, oninput: (e) => { st.cara = { ...st.cara, b: e.target.value.toUpperCase() }; } });
      const nahled = el('div.tb-fb-ohr-nahled');
      const kresli = () => {
        const x = st.strany;
        const c = (k) => (x[k] ? `<line class="c" stroke="${x[k].b}" stroke-width="${{ tlusta: 3, stredni: 2, dvojita: 3 }[x[k].s] || 1}" ${{ carky: 'stroke-dasharray="4 2"', tecky: 'stroke-dasharray="1 2"' }[x[k].s] || ''}` : '<line stroke="transparent"');
        nahled.innerHTML = `<svg viewBox="0 0 160 110"><text x="80" y="${vice ? 38 : 60}" text-anchor="middle" font-size="12" fill="#888">Text</text>${vice ? '<text x="80" y="88" text-anchor="middle" font-size="12" fill="#888">Text</text>' : ''}
          ${c('t')} x1="10" y1="8" x2="150" y2="8"/>${c('b')} x1="10" y1="102" x2="150" y2="102"/>${c('l')} x1="10" y1="8" x2="10" y2="102"/>${c('r')} x1="150" y1="8" x2="150" y2="102"/>
          ${vice ? `${c('h')} x1="10" y1="55" x2="150" y2="55"/>${c('v')} x1="80" y1="8" x2="80" y2="102"/>` : ''}${c('dd')} x1="10" y1="8" x2="150" y2="102"/>${c('du')} x1="10" y1="102" x2="150" y2="8"/>
          <path d="M6 8h-4M10 4V0M154 8h4M150 4V0M6 102h-4M10 106v4M154 102h4M150 106v4" stroke="#999"/></svg>`;
      };
      const prepni = (k) => { st.strany[k] = st.strany[k] ? null : { ...st.cara }; kresli(); zmeny._ohr = st; };
      const tl = (k, t) => el('button.tb-fb-ohr-tl', { type: 'button', title: t, onclick: () => prepni(k) }, ik({ t: 'zarovnatNahoru', b: 'zarovnatDolu', l: 'zarovnatVlevo', r: 'zarovnatVpravo', h: 'zarovnatDoprostred', v: 'sloupce', dd: 'odebratSipky', du: 'odebratSipky' }[k]));
      const predvolba = (typ) => {
        if (typ === 'zadne') st.strany = {};
        if (typ === 'vnejsi') Object.assign(st.strany, { t: { ...st.cara }, b: { ...st.cara }, l: { ...st.cara }, r: { ...st.cara } });
        if (typ === 'vnitrni') Object.assign(st.strany, { h: { ...st.cara }, v: { ...st.cara } });
        zmeny._ohr = st;
        kresli();
      };
      kresli();
      return el('div.tb-fb-ohr', {},
        el('div', {}, el('h4', { text: 'Čára' }), el('small', { text: 'Styl:' }), styly, pole('Barva:', barva)),
        el('div', {},
          el('h4', { text: 'Předvolby' }),
          el('div.tb-fb-predvolby', {}, [['zadne', 'Žádné'], ['vnejsi', 'Vnější'], ['vnitrni', 'Vnitřní']].map(([k, t]) => el('button', { type: 'button', onclick: () => predvolba(k), disabled: k === 'vnitrni' && !vice }, ik('ohraniceni'), el('span', { text: t })))),
          el('h4', { text: 'Ohraničení' }),
          el('div.tb-fb-ohr-mrizka', {}, el('div.tb-fb-ohr-sl', {}, tl('t', 'Horní'), vice ? tl('h', 'Vnitřní vodorovné') : null, tl('b', 'Dolní')), nahled),
          el('div.tb-fb-ohr-rad', {}, tl('dd', 'Úhlopříčka dolů'), tl('l', 'Levé'), vice ? tl('v', 'Vnitřní svislé') : null, tl('r', 'Pravé'), tl('du', 'Úhlopříčka nahoru')),
          el('p.tb-fb-popis', { text: 'Vybraný styl ohraničení lze použít kliknutím na předvolby, obrázek náhledu nebo tlačítka výše.' })));
    },
    vypln() {
      const ukazka = el('div.tb-fb-vypln-ukazka', { style: { background: s.pozadi || '#fff' } });
      const vyberB = (b) => { nastav('pozadi', b); ukazka.style.background = b || '#fff'; };
      const radek = (barvy) => el('div.ps-paleta-radek', {}, barvy.map((b) => el('button.ps-barva', { type: 'button', title: b, style: { background: b }, onclick: () => vyberB(b) })));
      const odst = (h, k) => { const hx = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); return '#' + hx.map((v) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)).toString(16).padStart(2, '0')).join('').toUpperCase(); };
      return el('div.tb-fb-vypln', {},
        el('div', {}, el('h4', { text: 'Barva pozadí:' }), el('button.ps-tlac', { type: 'button', text: 'Bez barvy', onclick: () => vyberB(null) }),
          el('div.tb-fb-paleta', {}, radek(MOTIV_BARVY), ...[0.8, 0.6, 0.4, -0.25, -0.5].map((k) => radek(MOTIV_BARVY.map((b) => odst(b, k)))), el('div', { style: { height: '8px' } }), radek(STANDARDNI)),
          el('label.ps-tlac.tb-dalsi-barvy', {}, 'Další barvy…', el('input', { type: 'color', oninput: (e) => vyberB(e.target.value.toUpperCase()) }))),
        el('div', {}, el('h4', { text: 'Ukázka' }), ukazka));
    },
    zamek() {
      const z = zaskrt('Zamknuto', s.zamek !== false, (x) => nastav('zamek', x ? null : false));
      const sk = zaskrt('Skryto', s.skryty, (x) => nastav('skryty', x || null));
      return el('div.tb-fb-zamek', {}, z.uzel, sk.uzel, el('p.tb-fb-popis', { text: 'Zamknutí buněk nebo skrytí vzorců se projeví až po zamknutí listu (karta Revize, skupina Zamknout, tlačítko Zamknout list).' }));
    },
  };
  const ukaz = (id) => {
    zalozky.querySelectorAll('button').forEach((b) => b.classList.toggle('aktivni', b.dataset.id === id));
    telo.replaceChildren(STRANY[id]());
  };
  ukaz(karta);
  dialog(P.koren, {
    titulek: 'Formát buněk', sirka: 620, cls: 'tb-dlg-format',
    obsah: el('div', {}, zalozky, telo),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => {
      const { _ohr, _sloucit, ...styl } = zmeny;
      if (Object.keys(styl).length) P.styl(styl, 'Formát buněk');
      if (_ohr) {
        const o = OBL(P);
        P.prikaz('Ohraničení', () => P.S.stylOblasti(L(P), [o], (st, r, c) => {
          const x = { ...(st?.ohr || {}) };
          const set = (k, v) => { if (v === null) delete x[k]; else if (v) x[k] = v; };
          const S2 = _ohr.strany;
          if ('t' in S2 && r === o.r1) set('t', S2.t);
          if ('b' in S2 && r === o.r2) set('b', S2.b);
          if ('l' in S2 && c === o.c1) set('l', S2.l);
          if ('r' in S2 && c === o.c2) set('r', S2.r);
          if ('h' in S2 && r < o.r2) set('b', S2.h);
          if ('v' in S2 && c < o.c2) set('r', S2.v);
          if ('dd' in S2) set('dd', S2.dd);
          if ('du' in S2) set('du', S2.du);
          if (!Object.keys(S2).length) return slozStyl(st, { ohr: null });
          return slozStyl(st, { ohr: Object.keys(x).length ? x : null });
        }), { prepocet: false });
      }
      if (_sloucit !== undefined) P.sloucit(_sloucit ? 'bunky' : 'zrusit');
    } }, { text: 'Zrušit' }],
  });
}

// ================================================================ Vložit jinak
export function dialogVlozitJinak(P) {
  if (!P.schranka) { zprava(P.koren, 'Schránka je prázdná. Nejdřív zkopírujte buňky (Ctrl+C).'); return; }
  const rez = prepinac('vj-r' + ++citac, [['vse', 'Vše'], ['vzorce', 'Vzorce'], ['hodnoty', 'Hodnoty'], ['formaty', 'Formáty'], ['bezOhraniceni', 'Vše kromě ohraničení'], ['sirky', 'Šířky sloupců'], ['vzorceFormaty', 'Vzorce a formáty čísla'], ['hodnotyFormaty', 'Hodnoty a formáty čísla']], 'vse');
  const op = prepinac('vj-o' + citac, [['', 'Žádná'], ['pricist', 'Sečíst'], ['odecist', 'Odečíst'], ['nasobit', 'Násobit'], ['delit', 'Dělit']], '');
  const prazdne = zaskrt('Vynechat prázdné', false);
  const trans = zaskrt('Transponovat', false);
  dialog(P.koren, {
    titulek: 'Vložit jinak', sirka: 460,
    obsah: el('div.tb-vj', {}, el('h4', { text: 'Vložit' }), el('div.tb-dva-sloupce', {}, rez.uzly), el('h4', { text: 'Operace' }), el('div.tb-dva-sloupce', {}, op.uzly),
      el('div.tb-dva-sloupce', {}, prazdne.uzel, trans.uzel)),
    tlacitka: [
      { text: 'Vložit propojení', akce: () => P.vlozVnitrni(P.schranka, 'propojit') },
      { text: 'OK', primarni: true, akce: () => P.vlozVnitrni(P.schranka, rez.hodnota(), { operace: op.hodnota() || null, preskocitPrazdne: prazdne.c.checked, transponovat: trans.c.checked }) },
      { text: 'Zrušit' },
    ],
  });
}

// ================================================================ Najít a nahradit
export function dialogNajit(P, rezim = 'najit', vychozi = '') {
  const st = { rezim, rozlisovat: false, cele: false, kde: 'list', oblast: 'vzorce', vysledky: [], index: -1 };
  const najit = vstup({ value: vychozi || P.posledniHledani || '' });
  const nahradit = vstup({ value: P.posledniNahrazeni || '' });
  const radekNahradit = pole('Nahradit čím:', nahradit);
  const moznosti = el('div.tb-najit-moznosti', { hidden: true },
    pole('V:', vyber([['list', 'List'], ['sesit', 'Sešit']], 'list', { onchange: (e) => { st.kde = e.target.value; } })),
    pole('Oblast hledání:', vyber([['vzorce', 'Vzorce'], ['hodnoty', 'Hodnoty'], ['poznamky', 'Poznámky']], 'vzorce', { onchange: (e) => { st.oblast = e.target.value; } })),
    zaskrt('Rozlišovat velká a malá', false, (x) => { st.rozlisovat = x; }).uzel,
    zaskrt('Shoda s celým obsahem buňky', false, (x) => { st.cele = x; }).uzel);
  const vysledky = el('div.tb-najit-vysledky', { hidden: true });
  const zalozky = el('div.tb-zalozky-dlg', {}, el('button', { type: 'button', text: 'Najít', onclick: () => prepni('najit') }), el('button', { type: 'button', text: 'Nahradit', onclick: () => prepni('nahradit') }));
  const tlNahraditVse = el('button.ps-tlac', { type: 'button', text: 'Nahradit vše' });
  const tlNahradit = el('button.ps-tlac', { type: 'button', text: 'Nahradit' });
  const tlVse = el('button.ps-tlac', { type: 'button', text: 'Najít vše' });
  const tlDalsi = el('button.ps-tlac.primarni', { type: 'button', text: 'Najít další' });
  const prepni = (r) => {
    st.rezim = r;
    zalozky.children[0].classList.toggle('aktivni', r === 'najit');
    zalozky.children[1].classList.toggle('aktivni', r === 'nahradit');
    radekNahradit.hidden = r !== 'nahradit';
    tlNahraditVse.hidden = tlNahradit.hidden = r !== 'nahradit';
    d?.okno.querySelector('.ps-dialog-hlava span')?.replaceChildren('Najít a nahradit');
  };
  const test = (t) => {
    const q = najit.value;
    if (!q) return false;
    const a = st.rozlisovat ? t : t.toLocaleLowerCase('cs'), b = st.rozlisovat ? q : q.toLocaleLowerCase('cs');
    const re = /[*?]/.test(b) ? new RegExp((st.cele ? '^' : '') + b.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + (st.cele ? '$' : ''), 's') : null;
    return re ? re.test(a) : st.cele ? a === b : a.includes(b);
  };
  const hledej = () => {
    P.posledniHledani = najit.value;
    const out = [];
    const listy = st.kde === 'sesit' ? P.S.listy : [L(P)];
    for (const l of listy) {
      const klice = [...l.b.keys()].sort((a, b) => a - b);
      for (const k of klice) {
        const b = l.b.get(k);
        const [r, c] = zKlice(k);
        let t;
        if (st.oblast === 'poznamky') t = b.pozn?.text || b.kom?.vlakno?.map((x) => x.text).join(' ') || '';
        else if (st.oblast === 'vzorce' && b.f) t = b.f;
        else t = P.S.textBunky(l, r, c);
        if (t && test(t)) out.push({ l, r, c, t, f: b.f || '' });
      }
    }
    st.vysledky = out;
    return out;
  };
  const vyber1 = (x) => { if (x.l !== L(P)) P.prepniNaList(x.l); P.grid.nastavVyber(x.r, x.c); };
  tlDalsi.onclick = () => {
    const out = hledej();
    if (!out.length) { zprava(P.koren, `Hledaný text „${najit.value}“ se nepodařilo najít.`); return; }
    const v = V(P);
    const i = out.findIndex((x) => (x.l === L(P) && (x.r > v.r || (x.r === v.r && x.c > v.c))) || P.S.listy.indexOf(x.l) > P.S.aktivni);
    vyber1(out[i < 0 ? 0 : i]);
  };
  tlVse.onclick = () => {
    const out = hledej();
    vysledky.hidden = false;
    vysledky.replaceChildren(
      el('div.tb-nv-radek.hlava', {}, ['List', 'Buňka', 'Hodnota', 'Vzorec'].map((t) => el('span', { text: t }))),
      ...out.slice(0, 500).map((x) => el('button.tb-nv-radek', { type: 'button', onclick: () => vyber1(x) }, el('span', { text: x.l.nazev }), el('span', { text: adresa(x.r, x.c, true, true) }), el('span', { text: P.S.textBunky(x.l, x.r, x.c) }), el('span', { text: x.f }))),
      el('small', { text: `Nalezené buňky: ${out.length}` }));
  };
  const nahradVBunce = (x) => {
    const b = x.l.b.get(klic(x.r, x.c));
    const puvodni = b.f || (b.v === null || b.v === undefined ? '' : P.grid.textProEditaci?.call({ S: P.S, list: x.l }, x.r, x.c) ?? String(b.v));
    const q = najit.value.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
    const re = new RegExp(st.cele ? `^${q}$` : q, st.rozlisovat ? 'g' : 'gi');
    const text = b.f ? b.f.replace(re, nahradit.value) : String(typeof b.v === 'number' ? obecne(b.v, 15) : b.v ?? '').replace(re, nahradit.value);
    P.S.zadej(x.l, x.r, x.c, text);
  };
  tlNahraditVse.onclick = () => {
    P.posledniNahrazeni = nahradit.value;
    const out = hledej().filter((x) => st.oblast !== 'poznamky');
    if (!out.length) { zprava(P.koren, 'Nebylo co nahradit.'); return; }
    P.prikaz('Nahradit vše', () => { for (const x of out) nahradVBunce(x); });
    zprava(P.koren, `Hotovo. Počet nahrazení: ${out.length}.`);
  };
  tlNahradit.onclick = () => {
    const v = V(P);
    const out = hledej();
    const aktualni = out.find((x) => x.l === L(P) && x.r === v.r && x.c === v.c);
    if (aktualni) P.prikaz('Nahradit', () => nahradVBunce(aktualni));
    tlDalsi.click();
  };
  const tlMoznosti = el('button.ps-tlac', { type: 'button', text: 'Možnosti >>', onclick: (e) => { moznosti.hidden = !moznosti.hidden; e.currentTarget.textContent = moznosti.hidden ? 'Možnosti >>' : '<< Možnosti'; } });
  najit.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); tlDalsi.click(); } });
  const d = nemodalni(dialog(P.koren, {
    titulek: 'Najít a nahradit', sirka: 520, cls: 'tb-dlg-najit',
    obsah: el('div', {}, zalozky, pole('Najít:', najit), radekNahradit, moznosti, el('div.tb-najit-tl', {}, tlMoznosti, el('span.tb-mezera'), tlNahraditVse, tlNahradit, tlVse, tlDalsi), vysledky),
    tlacitka: [{ text: 'Zavřít' }],
  }));
  prepni(rezim);
  setTimeout(() => { najit.focus(); najit.select(); }, 40);
}

// ================================================================ Přejít na
export function dialogPrejit(P) {
  const odkaz = vstup({ value: '' });
  const nazvy = [...P.S.nazvy.values()].map((d) => d.nazev);
  const seznam = el('div.tb-fb-list', {}, [...nazvy, ...(P.posledniPrechody || [])].map((n) => el('button', { type: 'button', text: n, onclick: () => { odkaz.value = n; }, ondblclick: () => { odkaz.value = n; d.okno.querySelector('.primarni').click(); } })));
  const d = dialog(P.koren, {
    titulek: 'Přejít na', sirka: 340,
    obsah: el('div', {}, el('small', { text: 'Přejít na:' }), seznam, pole('Odkaz:', odkaz)),
    tlacitka: [
      { text: 'Jinak…', akce: () => { setTimeout(() => dialogPrejitJinak(P)); } },
      { text: 'OK', primarni: true, akce: () => { if (!odkaz.value.trim()) return false; P.posledniPrechody = [odkaz.value, ...(P.posledniPrechody || [])].slice(0, 6); P.prejdiNa(odkaz.value.trim()); } },
      { text: 'Zrušit' },
    ],
  });
}

export function dialogPrejitJinak(P) {
  const v = prepinac('pj' + ++citac, [['poznamky', 'Poznámky'], ['konstanty', 'Konstanty'], ['vzorce', 'Vzorce'], ['prazdne', 'Prázdné buňky'], ['oblast', 'Aktuální oblast'], ['objekty', 'Objekty'], ['posledni', 'Poslední buňka'], ['viditelne', 'Pouze viditelné buňky'], ['podminene', 'Podmíněné formáty'], ['overeni', 'Ověření dat'], ['predchudci', 'Předchůdci'], ['naslednici', 'Následníci']], 'konstanty');
  dialog(P.koren, {
    titulek: 'Přejít na – jinak', sirka: 420,
    obsah: el('div.tb-dva-sloupce', {}, v.uzly),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => vyberJinak(P, v.hodnota()) }, { text: 'Zrušit' }],
  });
}

/** Výběr buněk podle druhu (Najít a vybrat › …). */
export function vyberJinak(P, co) {
  const l = L(P), S = P.S;
  const o = OBL(P);
  const jedna = o.r1 === o.r2 && o.c1 === o.c2;
  const u = S.rozsah(l);
  const rozsah = jedna ? { r1: 0, c1: 0, r2: u.r, c2: u.c } : { ...o, r2: Math.min(o.r2, u.r), c2: Math.min(o.c2, u.c) };
  if (co === 'oblast') { P.grid.vyberOblast(S.aktualniOblast(l, V(P).r, V(P).c)); return; }
  if (co === 'posledni') { const d = S.rozsahDat(l); P.grid.nastavVyber(Math.max(0, d.r), Math.max(0, d.c)); return; }
  if (co === 'objekty') { const x = [...l.grafy, ...l.obrazky][0]; if (x) P.vyberObjekt({ id: x.id, typ: l.grafy.includes(x) ? 'graf' : 'obr' }); else zprava(P.koren, 'Nebyly nalezeny žádné objekty.'); return; }
  const bunky = [];
  const pridej = (r, c) => bunky.push([r, c]);
  if (co === 'predchudci') { for (const z of S.zavislosti(l, V(P).r, V(P).c)) if (z.list === l) { P.grid.list.vyber = { ...V(P) }; bunky.push(...rozlozit(z.oblast)); } }
  else if (co === 'naslednici') { for (const n of S.naslednici(l, V(P).r, V(P).c)) if (n.list === l) pridej(n.r, n.c); }
  else if (co === 'prazdne' || co === 'viditelne') {
    for (let r = rozsah.r1; r <= rozsah.r2 && bunky.length < 20000; r++) for (let c = rozsah.c1; c <= rozsah.c2; c++) {
      if (co === 'prazdne' && S.hodnota(l, r, c) === null) pridej(r, c);
      if (co === 'viditelne' && !l.skryteR.has(r) && !l.skryteFiltrem.has(r) && !l.skryteC.has(c)) pridej(r, c);
    }
  } else {
    for (const [k, b] of l.b) {
      const [r, c] = zKlice(k);
      if (!obsahuje(rozsah, r, c)) continue;
      if (co === 'vzorce' && b.f) pridej(r, c);
      if (co === 'konstanty' && !b.f && b.v !== null && b.v !== undefined) pridej(r, c);
      if (co === 'poznamky' && (b.pozn || b.kom)) pridej(r, c);
    }
    if (co === 'podminene') for (const p of l.podminene) bunky.push(...(p.oblasti || [p.oblast]).flatMap(rozlozit));
    if (co === 'overeni') for (const v of l.validace) bunky.push(...rozlozit(v.oblast));
  }
  if (!bunky.length) { zprava(P.koren, 'Nebyly nalezeny žádné buňky.'); return; }
  // souvislé úseky v řádcích → oblasti
  const podleRadku = new Map();
  for (const [r, c] of bunky) { if (!podleRadku.has(r)) podleRadku.set(r, new Set()); podleRadku.get(r).add(c); }
  const oblasti = [];
  for (const [r, cs] of [...podleRadku].sort((a, b) => a[0] - b[0])) {
    const s = [...cs].sort((a, b) => a - b);
    let z = s[0], p = s[0];
    for (let i = 1; i <= s.length; i++) {
      if (s[i] === p + 1) { p = s[i]; continue; }
      const posl = oblasti[oblasti.length - 1];
      if (posl && posl.c1 === z && posl.c2 === p && posl.r2 === r - 1) posl.r2 = r;
      else oblasti.push({ r1: r, r2: r, c1: z, c2: p });
      z = p = s[i];
    }
  }
  P.grid.nastavVyber(oblasti[0].r1, oblasti[0].c1, oblasti.slice(0, 5000));
}
function rozlozit(o) { const out = []; for (let r = o.r1; r <= Math.min(o.r2, o.r1 + 2000); r++) for (let c = o.c1; c <= Math.min(o.c2, o.c1 + 200); c++) out.push([r, c]); return out; }

// ================================================================ Vložit funkci a Argumenty funkce
export function dialogVlozitFunkci(P, kategorie = 'nedavne') {
  const hledat = vstup({ placeholder: 'Zadejte stručný popis toho, co chcete provést, a klikněte na tlačítko Přejít' });
  const kat = vyber(KATEGORIE_FUNKCI, kategorie);
  const seznam = el('div.tb-fn-seznam', { tabindex: '0' });
  const popis = el('div.tb-fn-popis');
  let vybrana = null;
  const nedavne = () => (P.nastaveni().nedavneFunkce || ['SUMA', 'PRŮMĚR', 'KDYŽ', 'SVYHLEDAT', 'POČET', 'MAX', 'MIN', 'ZAOKROUHLIT', 'COUNTIF', 'DNES']).map((n) => FUNKCE[n]).filter(Boolean);
  const kresli = (dotaz = null) => {
    let f;
    if (dotaz) {
      const q = dotaz.toLocaleLowerCase('cs');
      f = Object.values(FUNKCE).filter((x) => x.n.toLocaleLowerCase('cs').includes(q) || x.en.toLowerCase().includes(q) || x.p.toLocaleLowerCase('cs').includes(q));
    } else if (kat.value === 'nedavne') f = nedavne();
    else if (kat.value === 'vse') f = Object.values(FUNKCE);
    else f = Object.values(FUNKCE).filter((x) => x.kat === kat.value);
    if (!dotaz && kat.value !== 'nedavne') f.sort((a, b) => a.n.localeCompare(b.n, 'cs'));
    seznam.replaceChildren(...f.map((x, i) => el('button' + (i === 0 ? '.vybrano' : ''), { type: 'button', text: x.n, onclick: (e) => zvol(x, e.currentTarget), ondblclick: () => { zvol(x); d.okno.querySelector('.primarni').click(); } })));
    zvol(f[0], seznam.firstChild);
  };
  const zvol = (f, b) => {
    vybrana = f;
    seznam.querySelectorAll('button').forEach((x) => x.classList.toggle('vybrano', x === b));
    popis.replaceChildren(f ? el('b', { text: syntaxe(f) }) : '', f ? el('p', { text: f.p }) : '');
  };
  kat.onchange = () => kresli();
  hledat.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); kresli(hledat.value); } });
  kresli();
  const d = dialog(P.koren, {
    titulek: 'Vložit funkci', sirka: 520, cls: 'tb-dlg-funkce',
    obsah: el('div', {}, el('small', { text: 'Vyhledat funkci:' }), el('div.tb-radek-dlg', {}, hledat, el('button.ps-tlac', { type: 'button', text: 'Přejít', onclick: () => kresli(hledat.value) })),
      pole('Vybrat kategorii:', kat), el('small', { text: 'Vybrat funkci:' }), seznam, popis,
      el('button.ps-zk-odkaz', { type: 'button', text: 'Nápověda k této funkci', onclick: () => P.podokno('napoveda', { funkce: vybrana?.n }) })),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => { if (vybrana) setTimeout(() => dialogArgumenty(P, vybrana)); } }, { text: 'Zrušit' }],
  });
  setTimeout(() => hledat.focus(), 40);
}

export function dialogArgumenty(P, f) {
  const ulozNedavne = () => { const n = [f.n, ...(P.nastaveni().nedavneFunkce || []).filter((x) => x !== f.n)].slice(0, 10); P.ulozNastaveni({ nedavneFunkce: n }); };
  const variabilni = f.a.includes('…');
  const zakladni = f.a.filter((a) => a !== '…');
  const pole1 = [];
  const telo = el('div.tb-arg-pole');
  const vysledek = el('div.tb-arg-vysledek');
  const popisArg = el('p.tb-arg-popis');
  // předvyplnit: když je v buňce vzorec s touto funkcí
  const b = P.S.bunka(L(P), V(P).r, V(P).c);
  let predvypl = [];
  if (b?.f) {
    const m = new RegExp(`^=${f.n.replace(/[.]/g, '\\.')}\\((.*)\\)$`, 'i').exec(b.f);
    if (m) predvypl = rozdelArgumenty(m[1]);
  }
  const pridej = (nazev, hodnota = '') => {
    const x = poleOblasti(P, hodnota);
    const nahled = el('span.tb-arg-nahled');
    const i = pole1.length;
    x.vstup.addEventListener('input', () => { nahled.textContent = x.vstup.value ? '= ' + nahledHodnoty(P, x.vstup.value) : ''; spocitej(); if (variabilni && i === pole1.length - 1 && x.vstup.value) pridej(zakladni[zakladni.length - 1].replace(/\d+$/, '') + (pole1.length + 1).toString().replace(/^/, '')); });
    x.vstup.addEventListener('focus', () => { popisArg.textContent = `${nazev.replace(/[[\]]/g, '')}: ${nazev.startsWith('[') ? 'nepovinný argument' : 'povinný argument'} funkce ${f.n}.`; });
    pole1.push(x.vstup);
    telo.append(el('div.tb-arg-radek', {}, el('label', { text: nazev.replace(/[[\]]/g, '') }), x, nahled));
    if (hodnota) x.vstup.dispatchEvent(new Event('input'));
  };
  const spocitej = () => {
    const args = pole1.map((i) => i.value.trim());
    while (args.length && !args[args.length - 1]) args.pop();
    const t = `${f.n}(${args.join(';')})`;
    vysledek.textContent = `Výsledek vzorce = ${nahledHodnoty(P, t)}`;
    return '=' + t;
  };
  zakladni.forEach((a, i) => pridej(a, predvypl[i] || ''));
  for (let i = zakladni.length; i < predvypl.length; i++) pridej(`${zakladni[zakladni.length - 1].replace(/\d+$|[\]]/g, '')}${i + 1}`, predvypl[i]);
  spocitej();
  dialog(P.koren, {
    titulek: 'Argumenty funkce', sirka: 560, cls: 'tb-dlg-argumenty',
    obsah: el('div', {}, el('h4', { text: f.n }), telo, el('p.tb-arg-fn-popis', { text: f.p }), popisArg, vysledek,
      el('button.ps-zk-odkaz', { type: 'button', text: 'Nápověda k této funkci', onclick: () => P.podokno('napoveda', { funkce: f.n }) })),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => {
      const vzorec = spocitej();
      ulozNedavne();
      const g = P.grid;
      if (g.edit && g.edit.text[0] === '=') {
        const elm = g.edit.zdroj || g.editor;
        const t = g.edit.text + vzorec.slice(1);
        g.edit.text = t;
        g.kresliEditor(elm, t, t.length);
        elm.focus();
        return;
      }
      P.prikaz('Vložit funkci', () => P.S.zadej(L(P), V(P).r, V(P).c, vzorec));
    } }, { text: 'Zrušit' }],
  });
  setTimeout(() => pole1[0]?.focus(), 40);
}

function rozdelArgumenty(t) {
  const out = [];
  let hl = 0, akt = '', uvoz = false;
  for (const ch of t) {
    if (ch === '"') uvoz = !uvoz;
    if (!uvoz && ch === '(') hl++;
    if (!uvoz && ch === ')') hl--;
    if (!uvoz && hl === 0 && ch === ';') { out.push(akt); akt = ''; continue; }
    akt += ch;
  }
  out.push(akt);
  return out;
}

// ================================================================ Vložit / odstranit buňky, rozměry
export function dialogVlozitBunky(P, odstranit) {
  const v = prepinac('vb' + ++citac, odstranit
    ? [['bunkyVlevo', 'Posunout buňky vlevo'], ['bunkyNahoru', 'Posunout buňky nahoru'], ['radky', 'Celý řádek'], ['sloupce', 'Celý sloupec']]
    : [['bunkyVpravo', 'Posunout buňky vpravo'], ['bunkyDolu', 'Posunout buňky dolů'], ['radky', 'Celý řádek'], ['sloupce', 'Celý sloupec']], odstranit ? 'bunkyNahoru' : 'bunkyDolu');
  dialog(P.koren, {
    titulek: odstranit ? 'Odstranit' : 'Vložit', sirka: 280,
    obsah: el('div', {}, el('h4', { text: odstranit ? 'Odstranit' : 'Vložit' }), ...v.uzly),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => (odstranit ? P.odstranitBunky(v.hodnota()) : P.vlozitBunky(v.hodnota())) }, { text: 'Zrušit' }],
  });
}

export function dialogRozmer(P, typ) {
  const l = L(P), v = V(P);
  const akt = typ === 'sirka' ? P.S.sirka(l, v.c) : typ === 'vyska' ? P.grid.vyskaRadku(v.r) : l.vychoziSirka || 64;
  const hodnota = typ === 'vyska' ? (akt * 0.75).toFixed(2).replace('.', ',') : (Math.max(0, akt - 5) / 7).toFixed(2).replace('.', ',');
  const i = vstup({ value: hodnota });
  dialog(P.koren, {
    titulek: { sirka: 'Šířka sloupce', vyska: 'Výška řádku', vychozi: 'Standardní šířka' }[typ], sirka: 300,
    obsah: pole({ sirka: 'Šířka sloupce:', vyska: 'Výška řádku:', vychozi: 'Standardní šířka sloupce:' }[typ], i),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => {
      const n = parseFloat(i.value.replace(',', '.'));
      if (isNaN(n) || n < 0 || n > (typ === 'vyska' ? 409 : 255)) { zprava(P.koren, 'Zadaná hodnota není platná.'); return false; }
      if (typ === 'vyska') P.vyskaRadku(Math.round(n / 0.75));
      else if (typ === 'sirka') P.sirkaSloupcu(n ? Math.round(n * 7 + 5) : 0);
      else P.prikaz('Standardní šířka', () => { l.vychoziSirka = Math.round(n * 7 + 5); }, { prepocet: false });
    } }, { text: 'Zrušit' }],
  });
  setTimeout(() => i.select(), 40);
}

// ================================================================ Řazení a filtr
export function dialogSeradit(P, o = {}) {
  const d0 = o.oblast ? { oblast: o.oblast, zahlavi: o.zahlavi } : P.oblastDat();
  let zahlavi = d0.zahlavi;
  const oblast = d0.oblast;
  const l = L(P);
  const nazvy = () => Array.from({ length: oblast.c2 - oblast.c1 + 1 }, (_, i) => [oblast.c1 + i, zahlavi ? String(P.S.hodnota(l, oblast.r1, oblast.c1 + i) ?? `Sloupec ${pismena(oblast.c1 + i)}`) : `Sloupec ${pismena(oblast.c1 + i)}`]);
  const urovne = [{ c: o.c ?? (V(P).c >= oblast.c1 && V(P).c <= oblast.c2 ? V(P).c : oblast.c1), podle: 'hodnota', vzestupne: true }];
  const seznam = el('div.tb-seradit-urovne');
  let vybrana = 0;
  const kresli = () => {
    seznam.replaceChildren(el('div.tb-su-radek.hlava', {}, el('span', { text: 'Sloupec' }), el('span', { text: 'Řazení na základě' }), el('span', { text: 'Pořadí' })),
      ...urovne.map((u, i) => {
        const sl = vyber(nazvy(), u.c, { onchange: (e) => { u.c = +e.target.value; } });
        const na = vyber([['hodnota', 'Hodnoty buněk'], ['barva', 'Barva buňky'], ['pismo', 'Barva písma']], u.podle, { onchange: (e) => { u.podle = e.target.value; kresli(); } });
        let por;
        if (u.podle === 'hodnota') por = vyber([['a', 'Od A do Z / od nejmenšího'], ['z', 'Od Z do A / od největšího'], ['dny', 'Vlastní: pondělí, úterý, …'], ['mesice', 'Vlastní: leden, únor, …']], u.seznam ? u.seznamId : u.vzestupne ? 'a' : 'z', { onchange: (e) => {
          const x = e.target.value;
          u.vzestupne = x !== 'z';
          u.seznamId = x;
          u.seznam = x === 'dny' ? ['pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota', 'neděle'] : x === 'mesice' ? ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'] : null;
        } });
        else por = el('span.tb-su-barva', {}, el('input', { type: 'color', value: u.barva || '#FFFF00', onchange: (e) => { u.barva = e.target.value.toUpperCase(); } }), vyber([['n', 'Nahoře'], ['d', 'Dole']], u.vzestupne ? 'n' : 'd', { onchange: (e) => { u.vzestupne = e.target.value === 'n'; } }));
        return el('div.tb-su-radek' + (i === vybrana ? '.vybrano' : ''), { onclick: () => { vybrana = i; seznam.querySelectorAll('.tb-su-radek').forEach((x, j) => x.classList.toggle('vybrano', j === i + 1)); } }, el('span', {}, el('small', { text: i ? 'Potom podle' : 'Seřadit podle' }), sl), na, por);
      }));
  };
  const zah = zaskrt('Data obsahují záhlaví', zahlavi, (x) => { zahlavi = x; kresli(); });
  kresli();
  dialog(P.koren, {
    titulek: 'Seřadit', sirka: 640, cls: 'tb-dlg-seradit',
    obsah: el('div', {},
      el('div.tb-seradit-tl', {},
        el('button.ps-tlac', { type: 'button', onclick: () => { if (urovne.length < 64) urovne.push({ c: oblast.c1, podle: 'hodnota', vzestupne: true }); kresli(); } }, '+ Přidat úroveň'),
        el('button.ps-tlac', { type: 'button', text: '✕ Odstranit úroveň', onclick: () => { if (urovne.length > 1) urovne.splice(vybrana, 1); vybrana = 0; kresli(); } }),
        el('button.ps-tlac', { type: 'button', text: 'Kopírovat úroveň', onclick: () => { urovne.splice(vybrana + 1, 0, { ...urovne[vybrana] }); kresli(); } }),
        el('button.ps-tlac', { type: 'button', text: '▲', title: 'Posunout nahoru', onclick: () => { if (vybrana > 0) { [urovne[vybrana - 1], urovne[vybrana]] = [urovne[vybrana], urovne[vybrana - 1]]; vybrana--; kresli(); } } }),
        el('button.ps-tlac', { type: 'button', text: '▼', title: 'Posunout dolů', onclick: () => { if (vybrana < urovne.length - 1) { [urovne[vybrana + 1], urovne[vybrana]] = [urovne[vybrana], urovne[vybrana + 1]]; vybrana++; kresli(); } } }),
        el('span.tb-mezera'), zah.uzel),
      seznam),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => P.seradit(urovne.map((u) => ({ ...u, seznam: u.seznam ? u.seznam : null })), oblast, zahlavi) }, { text: 'Zrušit' }],
  });
}

export function dialogVlastniFiltr(P, zdroj, c, typ, op = '=') {
  const ops = typ === 'cisla' || typ === 'data'
    ? [['=', 'je rovno'], ['<>', 'není rovno'], ['>', 'je větší než'], ['>=', 'je větší nebo rovno'], ['<', 'je menší než'], ['<=', 'je menší nebo rovno']]
    : [['=', 'je rovno'], ['<>', 'není rovno'], ['zacina', 'začíná na'], ['konci', 'končí na'], ['obsahuje', 'obsahuje'], ['neobsahuje', 'neobsahuje'], ['>', 'je větší než'], ['<', 'je menší než']];
  const mezi = op === 'mezi';
  const op1 = vyber(ops, mezi ? '>=' : op), v1 = vstup();
  const op2 = vyber([['', ''], ...ops], mezi ? '<=' : ''), v2 = vstup();
  const spoj = prepinac('vf' + ++citac, [['a', 'A'], ['nebo', 'Nebo']], 'a');
  dialog(P.koren, {
    titulek: 'Vlastní automatický filtr', sirka: 460,
    obsah: el('div.tb-vlastni-filtr', {}, el('p', { text: 'Zobrazit řádky, kde:' }), el('div.tb-radek-dlg', {}, op1, v1), el('div.tb-radek-dlg', {}, ...spoj.uzly), el('div.tb-radek-dlg', {}, op2, v2),
      el('p.tb-fb-popis', { text: 'Použijte ? pro libovolný jeden znak a * pro libovolnou posloupnost znaků.' })),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => {
      const a = { op: op1.value, v: v1.value };
      const b = op2.value ? { op: op2.value, v: v2.value } : null;
      P.nastavFiltr(zdroj, c, { podminka: { a, b, spoj: spoj.hodnota() } });
    } }, { text: 'Zrušit' }],
  });
  setTimeout(() => v1.focus(), 40);
}

// ================================================================ Podmíněné formátování
const POPIS_PODMINKY = {
  vetsi: 'Formátovat buňky, které jsou VĚTŠÍ NEŽ:', mensi: 'Formátovat buňky, které jsou MENŠÍ NEŽ:', mezi: 'Formátovat buňky, které jsou MEZI:',
  rovno: 'Formátovat buňky, které jsou ROVNY:', text: 'Formátovat buňky, které obsahují tento text:', datum: 'Formátovat buňky obsahující datum, které nastane:',
  duplicitni: 'Formátovat buňky, které obsahují:', prvni: 'Formátovat buňky v PRVNÍCH položkách:', prvniProc: 'Formátovat buňky v PRVNÍCH procentech:',
  posledni: 'Formátovat buňky v POSLEDNÍCH položkách:', posledniProc: 'Formátovat buňky v POSLEDNÍCH procentech:',
  nadPrumerem: 'Formátovat buňky, které jsou NAD PRŮMĚREM:', podPrumerem: 'Formátovat buňky, které jsou POD PRŮMĚREM:',
};
const NAZEV_PODMINKY = { vetsi: 'Větší než', mensi: 'Menší než', mezi: 'Mezi', rovno: 'Rovno', text: 'Text, který obsahuje', datum: 'Datum, které nastane', duplicitni: 'Duplicitní hodnoty', prvni: 'Prvních 10 položek', prvniProc: 'Prvních 10 %', posledni: 'Posledních 10 položek', posledniProc: 'Posledních 10 %', nadPrumerem: 'Nad průměrem', podPrumerem: 'Pod průměrem' };

export function dialogPodminka(P, typ) {
  const l = L(P), o = OBL(P);
  const cisla = [];
  P.S.projdi(l, { ...o, r2: Math.min(o.r2, P.S.rozsah(l).r), c2: Math.min(o.c2, P.S.rozsah(l).c) }, (r, c, v) => { if (typeof v === 'number') cisla.push(v); });
  const prumer = cisla.length ? cisla.reduce((a, b) => a + b, 0) / cisla.length : 0;
  const serazene = [...cisla].sort((a, b) => a - b);
  const vychozi = { vetsi: serazene[Math.floor(serazene.length * 0.7)] ?? '', mensi: serazene[Math.floor(serazene.length * 0.3)] ?? '', rovno: serazene[0] ?? '' }[typ];
  const a = vstup({ value: vychozi === undefined ? '' : String(vychozi).replace('.', ',') });
  const b = vstup({ value: typ === 'mezi' ? String(serazene[serazene.length - 1] ?? '').replace('.', ',') : '' });
  if (typ === 'mezi') a.value = String(serazene[0] ?? '').replace('.', ',');
  const n = stop(el('input.ps-vstup.kratky', { type: 'number', min: 1, value: 10 }));
  const datum = vyber([['vcera', 'Včera'], ['dnes', 'Dnes'], ['zitra', 'Zítra'], ['poslednich7', 'Za posledních 7 dní'], ['minulyTyden', 'Minulý týden'], ['tentoTyden', 'Tento týden'], ['pristiTyden', 'Příští týden'], ['minulyMesic', 'Minulý měsíc'], ['tentoMesic', 'Tento měsíc'], ['pristiMesic', 'Příští měsíc']], 'vcera');
  const dup = vyber([['duplicitni', 'Duplicitní'], ['jedinecne', 'Jedinečné']], 'duplicitni');
  let vlastni = null;
  const format = vyber([...PREDVOLBY_CF.map((p) => [p.id, p.nazev]), ['vlastni', 'Vlastní formát…']], 'cervena', { onchange: (e) => { if (e.target.value === 'vlastni') dialogMiniFormat(P, (s) => { vlastni = s; }); } });
  let ovl;
  if (typ === 'mezi') ovl = el('div.tb-radek-dlg', {}, a, el('span', { text: 'a' }), b);
  else if (typ === 'datum') ovl = datum;
  else if (typ === 'duplicitni') ovl = dup;
  else if (/^prvni|^posledni/.test(typ)) ovl = el('div.tb-radek-dlg', {}, n, /Proc/.test(typ) ? el('span', { text: '%' }) : null);
  else if (/Prumerem/.test(typ)) ovl = el('span', { text: 'pro vybranou oblast' });
  else ovl = a;
  dialog(P.koren, {
    titulek: NAZEV_PODMINKY[typ], sirka: 480,
    obsah: el('div.tb-podminka', {}, el('p', { text: POPIS_PODMINKY[typ] }), el('div.tb-radek-dlg', {}, ovl, el('span', { text: 's' }), format)),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => {
      const styl = format.value === 'vlastni' ? vlastni || {} : PREDVOLBY_CF.find((p) => p.id === format.value).styl;
      const hodnota = (x) => { const r = rozpoznej(x.value.trim()); return x.value.trim()[0] === '=' ? normalizujVzorec(x.value.trim()) : r.v ?? x.value; };
      let pr;
      if (typ === 'duplicitni') pr = { typ: dup.value };
      else if (typ === 'datum') pr = { typ: 'datum', a: datum.value };
      else if (/^prvni|^posledni/.test(typ)) pr = { typ: typ.startsWith('prvni') ? 'prvni' : 'posledni', pocet: +n.value || 10, procenta: /Proc/.test(typ) };
      else if (/Prumerem/.test(typ)) pr = { typ };
      else pr = { typ, a: hodnota(a), b: typ === 'mezi' ? hodnota(b) : undefined };
      P.podminene({ ...pr, styl });
    } }, { text: 'Zrušit' }],
  });
  setTimeout(() => a.select(), 40);
}

/** Malý dialog Formát buněk pro podmíněné formátování (písmo, barva, výplň). */
function dialogMiniFormat(P, hotovo, s0 = {}) {
  const s = { ...s0 };
  const b = zaskrt('Tučné', s.b, (x) => { s.b = x || undefined; });
  const i = zaskrt('Kurzíva', s.i, (x) => { s.i = x || undefined; });
  const pr = zaskrt('Přeškrtnuté', s.st, (x) => { s.st = x || undefined; });
  const barva = el('input', { type: 'color', value: s.barva || '#000000', oninput: (e) => { s.barva = e.target.value.toUpperCase(); } });
  const vypln = el('input', { type: 'color', value: s.pozadi || '#FFFFFF', oninput: (e) => { s.pozadi = e.target.value.toUpperCase(); } });
  const bez = zaskrt('Bez výplně', !s.pozadi, (x) => { if (x) delete s.pozadi; else s.pozadi = vypln.value.toUpperCase(); });
  dialog(P.koren, {
    titulek: 'Formát buněk', sirka: 360,
    obsah: el('div.tb-mini-format', {}, el('h4', { text: 'Písmo' }), b.uzel, i.uzel, pr.uzel, pole('Barva písma:', barva), el('h4', { text: 'Výplň' }), bez.uzel, pole('Barva pozadí:', vypln)),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => hotovo(s) }, { text: 'Zrušit' }],
  });
}

const TYPY_PRAVIDEL = [
  ['hodnoty', 'Formátovat všechny buňky podle hodnot'],
  ['obsahujici', 'Formátovat pouze buňky obsahující'],
  ['prvni', 'Formátovat pouze hodnoty zařazené jako první nebo poslední'],
  ['prumer', 'Formátovat pouze hodnoty, které jsou nad nebo pod průměrem'],
  ['duplicitni', 'Formátovat pouze jedinečné nebo duplicitní hodnoty'],
  ['vzorec', 'Určit buňky k formátování pomocí vzorce'],
];

export function dialogNovePravidlo(P, upravit = null, poUlozeni = null) {
  const p0 = upravit || {};
  let typ = upravit ? ({ pruh: 'hodnoty', skala: 'hodnoty', ikony: 'hodnoty', prvni: 'prvni', posledni: 'prvni', nadPrumerem: 'prumer', podPrumerem: 'prumer', duplicitni: 'duplicitni', jedinecne: 'duplicitni', vzorec: 'vzorec' }[p0.typ] || 'obsahujici') : 'obsahujici';
  let styl = { ...(p0.styl || { pozadi: '#FFC7CE', barva: '#9C0006' }) };
  const seznam = el('div.tb-fb-list.tb-typy-pravidel');
  const telo = el('div.tb-pravidlo-telo');
  let sestav = () => null;
  const nahledFormatu = () => el('div.tb-nahled-formatu', { text: 'AaBbCcYyZz', style: `background:${styl.pozadi || 'transparent'};color:${styl.barva || '#000'};font-weight:${styl.b ? 700 : 400};font-style:${styl.i ? 'italic' : 'normal'};text-decoration:${styl.st ? 'line-through' : 'none'}` });
  const formatTl = () => { const n = nahledFormatu(); return el('div.tb-radek-dlg', {}, el('span', { text: 'Náhled:' }), n, el('button.ps-tlac', { type: 'button', text: 'Formát…', onclick: () => dialogMiniFormat(P, (s) => { styl = s; n.replaceWith(nahledFormatu()); kresli(); }, styl) })); };
  const kresli = () => {
    seznam.replaceChildren(...TYPY_PRAVIDEL.map(([id, t]) => el('button' + (id === typ ? '.vybrano' : ''), { type: 'button', text: '► ' + t, onclick: () => { typ = id; kresli(); } })));
    if (typ === 'hodnoty') {
      const druh = vyber([['skala2', 'Dvoubarevná škála'], ['skala3', 'Tříbarevná škála'], ['pruh', 'Datový pruh'], ['ikony', 'Sady ikon']], p0.typ === 'pruh' ? 'pruh' : p0.typ === 'ikony' ? 'ikony' : p0.barvy?.length === 2 ? 'skala2' : 'skala3');
      const b1 = el('input', { type: 'color', value: p0.barvy?.[0] || '#F8696B' }), b2 = el('input', { type: 'color', value: p0.barvy?.[1] || '#FFEB84' }), b3 = el('input', { type: 'color', value: p0.barvy?.[2] || '#63BE7B' });
      const pruhB = el('input', { type: 'color', value: p0.barva || '#638EC6' });
      const sada = vyber(SADY_IKON, p0.sada || 'sipky3');
      const ovl = el('div');
      const obnov = () => ovl.replaceChildren(druh.value === 'pruh' ? pole('Barva pruhu:', pruhB) : druh.value === 'ikony' ? pole('Styl ikon:', sada) : el('div.tb-radek-dlg', {}, pole('Minimum:', b1), druh.value === 'skala3' ? pole('Středový bod:', b2) : null, pole('Maximum:', b3)));
      druh.onchange = obnov;
      obnov();
      telo.replaceChildren(el('h4', { text: 'Upravit popis pravidla:' }), pole('Styl formátu:', druh), ovl);
      sestav = () => (druh.value === 'pruh' ? { typ: 'pruh', barva: pruhB.value.toUpperCase() } : druh.value === 'ikony' ? { typ: 'ikony', sada: sada.value } : { typ: 'skala', barvy: druh.value === 'skala2' ? [b1.value, b3.value] : [b1.value, b2.value, b3.value] });
    } else if (typ === 'obsahujici') {
      const co = vyber([['hodnota', 'Hodnota buňky'], ['text', 'Určitý text'], ['datum', 'Data'], ['prazdne', 'Prázdné'], ['chyby', 'Chyby']], ['text', 'zacina'].includes(p0.typ) ? 'text' : p0.typ === 'datum' ? 'datum' : p0.typ === 'prazdne' ? 'prazdne' : p0.typ === 'chyby' ? 'chyby' : 'hodnota');
      const op = vyber([['mezi', 'mezi'], ['rovno', 'rovno'], ['vetsi', 'větší než'], ['mensi', 'menší než']], ['mezi', 'rovno', 'vetsi', 'mensi'].includes(p0.typ) ? p0.typ : 'mezi');
      const a = vstup({ value: p0.a ?? '' }), b = vstup({ value: p0.b ?? '' });
      const ovl = el('div');
      const obnov = () => ovl.replaceChildren(co.value === 'hodnota' ? el('div.tb-radek-dlg', {}, op, a, op.value === 'mezi' ? el('span', { text: 'a' }) : null, op.value === 'mezi' ? b : null) : co.value === 'text' ? el('div.tb-radek-dlg', {}, el('span', { text: 'obsahující' }), a) : co.value === 'datum' ? el('span', { text: 'Dnes' }) : el('span'));
      co.onchange = obnov; op.onchange = obnov;
      obnov();
      telo.replaceChildren(el('h4', { text: 'Formátovat pouze buňky s:' }), el('div.tb-radek-dlg', {}, co), ovl, formatTl());
      sestav = () => {
        const h = (x) => { const r = rozpoznej(x.value.trim()); return x.value.trim()[0] === '=' ? normalizujVzorec(x.value.trim()) : r.v ?? x.value; };
        if (co.value === 'hodnota') return { typ: op.value, a: h(a), b: op.value === 'mezi' ? h(b) : undefined, styl };
        if (co.value === 'text') return { typ: 'text', a: a.value, styl };
        if (co.value === 'datum') return { typ: 'datum', a: 'dnes', styl };
        return { typ: co.value, styl };
      };
    } else if (typ === 'prvni') {
      const smer = vyber([['prvni', 'Nejvyšší'], ['posledni', 'Nejnižší']], p0.typ === 'posledni' ? 'posledni' : 'prvni');
      const n = stop(el('input.ps-vstup.kratky', { type: 'number', value: p0.pocet || 10 }));
      const proc = zaskrt('% z vybrané oblasti', p0.procenta);
      telo.replaceChildren(el('h4', { text: 'Formátovat hodnoty, které jsou zařazeny:' }), el('div.tb-radek-dlg', {}, smer, n, proc.uzel), formatTl());
      sestav = () => ({ typ: smer.value, pocet: +n.value || 10, procenta: proc.c.checked, styl });
    } else if (typ === 'prumer') {
      const smer = vyber([['nadPrumerem', 'nad'], ['podPrumerem', 'pod']], p0.typ === 'podPrumerem' ? 'podPrumerem' : 'nadPrumerem');
      telo.replaceChildren(el('h4', { text: 'Formátovat hodnoty, které jsou:' }), el('div.tb-radek-dlg', {}, smer, el('span', { text: 'průměr vybrané oblasti' })), formatTl());
      sestav = () => ({ typ: smer.value, styl });
    } else if (typ === 'duplicitni') {
      const d = vyber([['duplicitni', 'duplicitní'], ['jedinecne', 'jedinečné']], p0.typ === 'jedinecne' ? 'jedinecne' : 'duplicitni');
      telo.replaceChildren(el('h4', { text: 'Formátovat vše:' }), el('div.tb-radek-dlg', {}, d, el('span', { text: 'hodnoty ve vybrané oblasti' })), formatTl());
      sestav = () => ({ typ: d.value, styl });
    } else {
      const f = vstup({ value: p0.vzorec || '=' });
      telo.replaceChildren(el('h4', { text: 'Formátovat hodnoty, pro které platí tento vzorec:' }), f, el('p.tb-fb-popis', { text: `Vzorec se vyhodnotí pro levou horní buňku oblasti (${adresa(OBL(P).r1, OBL(P).c1)}) a posune se pro ostatní, např. =B2>100 nebo =$C2="Hotovo".` }), formatTl());
      sestav = () => ({ typ: 'vzorec', vzorec: normalizujVzorec(f.value.trim()[0] === '=' ? f.value.trim() : '=' + f.value.trim()), styl });
    }
  };
  kresli();
  dialog(P.koren, {
    titulek: upravit ? 'Upravit pravidlo formátování' : 'Nové pravidlo formátování', sirka: 560,
    obsah: el('div', {}, el('small', { text: 'Vybrat typ pravidla:' }), seznam, telo),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => { const pr = sestav(); if (!pr) return false; if (poUlozeni) poUlozeni(pr); else P.podminene(pr); } }, { text: 'Zrušit' }],
  });
}

export function dialogSpravcePravidel(P) {
  const l = L(P);
  let pravidla = structuredClone(l.podminene);
  let vybrane = 0, zobraz = 'vyber';
  const seznam = el('div.tb-spravce-pravidel');
  const popis = (p) => ({ vetsi: `Hodnota buňky > ${p.a}`, mensi: `Hodnota buňky < ${p.a}`, mezi: `Hodnota buňky mezi ${p.a} a ${p.b}`, rovno: `Hodnota buňky = ${p.a}`, text: `Text obsahuje „${p.a}“`, datum: 'Datum', duplicitni: 'Duplicitní hodnoty', jedinecne: 'Jedinečné hodnoty', prvni: `Prvních ${p.pocet}${p.procenta ? ' %' : ''}`, posledni: `Posledních ${p.pocet}${p.procenta ? ' %' : ''}`, nadPrumerem: 'Nad průměrem', podPrumerem: 'Pod průměrem', pruh: 'Datový pruh', skala: 'Barevná škála', ikony: 'Sada ikon', vzorec: `Vzorec: ${p.vzorec}`, prazdne: 'Prázdné', chyby: 'Chyby' }[p.typ] || p.typ);
  const kresli = () => {
    const vid = pravidla.map((p, i) => ({ p, i })).filter(({ p }) => zobraz === 'list' || (p.oblasti || [p.oblast]).some((x) => l.vyber.oblasti.some((y) => prekryva(x, y))));
    seznam.replaceChildren(el('div.tb-sp-radek.hlava', {}, ['Pravidlo (použité v uvedeném pořadí)', 'Formát', 'Platí pro', 'Zastavit'].map((t) => el('span', { text: t }))),
      ...vid.map(({ p, i }) => {
        const obl = vstup({ value: (p.oblasti || [p.oblast]).map((x) => textOblasti(x, true)).join(';') });
        obl.onchange = () => { const o = obl.value.split(/[;,]/).map((x) => rozeberOblast(x.replace(/\$/g, ''))).filter(Boolean); if (o.length) p.oblasti = o; };
        const st = p.styl || {};
        return el('div.tb-sp-radek' + (i === vybrane ? '.vybrano' : ''), { onclick: () => { vybrane = i; kresli(); } },
          el('span', { text: popis(p) }),
          el('span.tb-nahled-formatu', { text: ['pruh', 'skala', 'ikony'].includes(p.typ) ? '▮▮▮' : 'AaBbCcYyZz', style: `background:${p.typ === 'skala' ? `linear-gradient(90deg,${p.barvy.join(',')})` : st.pozadi || 'transparent'};color:${p.typ === 'pruh' ? p.barva : st.barva || '#000'};font-weight:${st.b ? 700 : 400}` }),
          obl, el('input', { type: 'checkbox', checked: p.zastavit || null, onchange: (e) => { p.zastavit = e.target.checked; } }));
      }));
    if (!vid.length) seznam.append(el('p.tb-fb-popis', { text: 'Žádná pravidla k zobrazení.' }));
  };
  kresli();
  dialog(P.koren, {
    titulek: 'Správce pravidel podmíněného formátování', sirka: 720, cls: 'tb-dlg-spravce',
    obsah: el('div', {},
      pole('Zobrazit pravidla formátování pro:', vyber([['vyber', 'Aktuální výběr'], ['list', 'Tento list']], zobraz, { onchange: (e) => { zobraz = e.target.value; kresli(); } })),
      el('div.tb-seradit-tl', {},
        el('button.ps-tlac', { type: 'button', text: 'Nové pravidlo…', onclick: () => dialogNovePravidlo(P, null, (pr) => { pravidla.push({ ...pr, oblasti: l.vyber.oblasti.map((x) => ({ ...x })) }); kresli(); }) }),
        el('button.ps-tlac', { type: 'button', text: 'Upravit pravidlo…', onclick: () => { const p = pravidla[vybrane]; if (p) dialogNovePravidlo(P, p, (pr) => { pravidla[vybrane] = { ...pr, oblasti: p.oblasti || [p.oblast], zastavit: p.zastavit }; kresli(); }); } }),
        el('button.ps-tlac', { type: 'button', text: '✕ Odstranit pravidlo', onclick: () => { pravidla.splice(vybrane, 1); vybrane = 0; kresli(); } }),
        el('button.ps-tlac', { type: 'button', text: '▲', onclick: () => { if (vybrane > 0) { [pravidla[vybrane - 1], pravidla[vybrane]] = [pravidla[vybrane], pravidla[vybrane - 1]]; vybrane--; kresli(); } } }),
        el('button.ps-tlac', { type: 'button', text: '▼', onclick: () => { if (vybrane < pravidla.length - 1) { [pravidla[vybrane + 1], pravidla[vybrane]] = [pravidla[vybrane], pravidla[vybrane + 1]]; vybrane++; kresli(); } } })),
      seznam),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => P.prikaz('Spravovat pravidla', () => { l.podminene = pravidla; }, { prepocet: false }) }, { text: 'Zrušit' }],
  });
}

// ================================================================ Ověření dat
export function dialogOvereni(P) {
  const l = L(P), v = V(P);
  const puvodni = P.S.validaceV(l, v.r, v.c);
  const x = structuredClone(puvodni || { typ: 'vse', op: 'mezi', ignorovatPrazdne: true, sipka: true, zprava: { zobrazit: true, titulek: '', text: '' }, chyba: { zobrazit: true, styl: 'stop', titulek: '', text: '' } });
  const karty = [['nastaveni', 'Nastavení'], ['zprava', 'Zpráva při zadávání'], ['chyba', 'Chybové hlášení']];
  const telo = el('div.tb-ov-telo');
  const zal = el('div.tb-zalozky-dlg', {}, karty.map(([id, t]) => el('button', { type: 'button', text: t, dataset: { id }, onclick: () => ukaz(id) })));
  const S = {
    nastaveni() {
      const typ = vyber([['vse', 'Libovolná hodnota'], ['cele', 'Celé číslo'], ['desetinne', 'Desetinné číslo'], ['seznam', 'Seznam'], ['datum', 'Datum'], ['cas', 'Čas'], ['delka', 'Délka textu'], ['vlastni', 'Vlastní']], x.typ);
      const op = vyber([['mezi', 'je mezi'], ['mimo', 'není mezi'], ['=', 'je rovno'], ['<>', 'není rovno'], ['>', 'je větší než'], ['<', 'je menší než'], ['>=', 'je větší nebo rovno'], ['<=', 'je menší nebo rovno']], x.op || 'mezi');
      const a = vstup({ value: x.a ?? '' }), b = vstup({ value: x.b ?? '' });
      const zdroj = poleOblasti(P, x.zdroj || '', { popis: 'Zdroj seznamu' });
      const vz = vstup({ value: x.vzorec || '=' });
      const ign = zaskrt('Ignorovat prázdné', x.ignorovatPrazdne !== false, (y) => { x.ignorovatPrazdne = y; });
      const sip = zaskrt('Rozevírací seznam v buňce', x.sipka !== false, (y) => { x.sipka = y; });
      const ovl = el('div');
      const obnov = () => {
        x.typ = typ.value; x.op = op.value;
        const mezi = ['mezi', 'mimo'].includes(op.value);
        const cis = ['cele', 'desetinne', 'datum', 'cas', 'delka'].includes(typ.value);
        ovl.replaceChildren(
          cis ? pole('Data:', op) : null,
          cis ? pole(mezi ? 'Minimum:' : 'Hodnota:', a) : null,
          cis && mezi ? pole('Maximum:', b) : null,
          typ.value === 'seznam' ? el('div', {}, pole('Zdroj:', zdroj), sip.uzel, el('p.tb-fb-popis', { text: 'Položky oddělte středníkem (Ano;Ne;Možná) nebo zadejte oblast, např. =$F$2:$F$10.' })) : null,
          typ.value === 'vlastni' ? pole('Vzorec:', vz) : null);
      };
      typ.onchange = obnov; op.onchange = obnov;
      a.oninput = () => { x.a = a.value; }; b.oninput = () => { x.b = b.value; };
      zdroj.vstup.oninput = () => { x.zdroj = zdroj.vstup.value; };
      vz.oninput = () => { x.vzorec = normalizujVzorec(vz.value); };
      obnov();
      return el('div', {}, el('h4', { text: 'Ověřovací kritéria' }), pole('Povolit:', typ), ign.uzel, ovl);
    },
    zprava() {
      const z = x.zprava || (x.zprava = {});
      const ch = zaskrt('Zobrazit zprávu při výběru buňky', z.zobrazit !== false, (y) => { z.zobrazit = y; });
      const t = vstup({ value: z.titulek || '', oninput: (e) => { z.titulek = e.target.value; } });
      const tx = stop(el('textarea.ps-vstup', { rows: 5, oninput: (e) => { z.text = e.target.value; } }, z.text || ''));
      return el('div', {}, ch.uzel, el('h4', { text: 'Při výběru buňky zobrazit tuto zprávu:' }), pole('Název:', t), pole('Zpráva při zadávání:', tx));
    },
    chyba() {
      const c = x.chyba || (x.chyba = {});
      const ch = zaskrt('Po zadání neplatných údajů zobrazit chybové hlášení', c.zobrazit !== false, (y) => { c.zobrazit = y; });
      const st = vyber([['stop', 'Stop'], ['varovani', 'Varování'], ['info', 'Informace']], c.styl || 'stop', { onchange: (e) => { c.styl = e.target.value; } });
      const t = vstup({ value: c.titulek || '', oninput: (e) => { c.titulek = e.target.value; } });
      const tx = stop(el('textarea.ps-vstup', { rows: 5, oninput: (e) => { c.text = e.target.value; } }, c.text || ''));
      return el('div', {}, ch.uzel, el('h4', { text: 'Po zadání neplatných údajů zobrazit toto chybové hlášení:' }), pole('Styl:', st), pole('Název:', t), pole('Chybové hlášení:', tx));
    },
  };
  const ukaz = (id) => { zal.querySelectorAll('button').forEach((b) => b.classList.toggle('aktivni', b.dataset.id === id)); telo.replaceChildren(S[id]()); };
  ukaz('nastaveni');
  dialog(P.koren, {
    titulek: 'Ověření dat', sirka: 480,
    obsah: el('div', {}, zal, telo),
    tlacitka: [
      { text: 'Vymazat vše', akce: () => { P.prikaz('Ověření dat', () => { l.validace = l.validace.filter((y) => !l.vyber.oblasti.some((o) => prekryva(o, y.oblast))); }, { prepocet: false }); } },
      { text: 'OK', primarni: true, akce: () => {
        if (x.typ === 'seznam' && !x.zdroj) { zprava(P.koren, 'Musíte zadat zdroj seznamu (položky oddělené středníkem nebo oblast).'); return false; }
        if (x.zdroj && x.zdroj[0] === '=') x.zdroj = normalizujVzorec(x.zdroj);
        if (!x.zprava?.zobrazit) x.zprava = { ...(x.zprava || {}), text: x.zprava?.zobrazit === false ? '' : x.zprava?.text };
        if (x.chyba?.zobrazit === false) x.chyba.styl = 'info';
        P.prikaz('Ověření dat', () => {
          l.validace = l.validace.filter((y) => !l.vyber.oblasti.some((o) => prekryva(o, y.oblast)));
          if (x.typ !== 'vse' || x.zprava?.text) for (const o of l.vyber.oblasti) l.validace.push({ ...structuredClone(x), oblast: { ...o, r2: Math.min(o.r2, o.r1 + 100000) } });
        }, { prepocet: false });
      } },
      { text: 'Zrušit' },
    ],
  });
}

// ================================================================ Hledání řešení
export function dialogHledaniReseni(P) {
  const v = V(P);
  const cil = poleOblasti(P, adresa(v.r, v.c, true, true), { popis: 'Nastavená buňka' });
  const hodnota = vstup({ value: '' });
  const zmena = poleOblasti(P, '', { popis: 'Měněná buňka' });
  dialog(P.koren, {
    titulek: 'Hledání řešení', sirka: 360,
    obsah: el('div', {}, pole('Nastavená buňka:', cil), pole('Cílová hodnota:', hodnota), pole('Měněná buňka:', zmena)),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => {
      const c = rozeberOblast(cil.vstup.value.replace(/\$/g, '')), z = rozeberOblast(zmena.vstup.value.replace(/\$/g, ''));
      const h = rozpoznej(hodnota.value).v;
      if (!c || !z || typeof h !== 'number') { zprava(P.koren, 'Zadejte nastavenou buňku se vzorcem, číselnou cílovou hodnotu a měněnou buňku.'); return false; }
      const l = L(P);
      if (!P.S.bunka(l, c.r1, c.c1)?.f) { zprava(P.koren, 'Nastavená buňka musí obsahovat vzorec.'); return false; }
      if (P.S.bunka(l, z.r1, z.c1)?.f) { zprava(P.koren, 'Měněná buňka musí obsahovat hodnotu, ne vzorec.'); return false; }
      const puvodni = P.S.hodnota(l, z.r1, z.c1);
      let vysledek;
      P.prikaz('Hledání řešení', () => { vysledek = P.S.hledaniReseni(l, { r: c.r1, c: c.c1 }, h, { r: z.r1, c: z.c1 }); });
      setTimeout(() => dialog(P.koren, {
        titulek: 'Stav hledání řešení', sirka: 380,
        obsah: el('div', {}, el('p', { text: vysledek.nalezeno ? `Hledání řešení pro buňku ${adresa(c.r1, c.c1)} nalezlo řešení.` : `Hledání řešení pro buňku ${adresa(c.r1, c.c1)} nemusí najít řešení.` }),
          el('p', { text: `Cílová hodnota: ${obecne(h)}` }), el('p', { text: `Aktuální hodnota: ${P.S.textBunky(l, c.r1, c.c1)}` })),
        tlacitka: [{ text: 'OK', primarni: true }, { text: 'Zrušit', akce: () => P.prikaz('Hledání řešení', () => { const b = l.b.get(klic(z.r1, z.c1)) || {}; P.S.zapis(l, z.r1, z.c1, { ...b, v: puvodni }); }) }],
      }));
    } }, { text: 'Zrušit' }],
  });
}

// ================================================================ Text do sloupců, duplicity
export function dialogTextDoSloupcu(P) {
  const o = OBL(P);
  if (o.c1 !== o.c2) { zprava(P.koren, 'Najednou lze převést jen jeden sloupec. Oblast může mít mnoho řádků, ale jen jeden sloupec.'); return; }
  const l = L(P);
  const odd = { '\t': true, ';': true, ',': false, ' ': false };
  let jiny = '', spojit = false;
  const nahled = el('div.tb-tds-nahled');
  const kresli = () => {
    const znaky = Object.entries(odd).filter(([, x]) => x).map(([k]) => k).concat(jiny ? [jiny] : []);
    const radky = [];
    for (let r = o.r1; r <= Math.min(o.r2, o.r1 + 8); r++) {
      let casti = rozdelText(String(P.S.hodnota(l, r, o.c1) ?? ''), znaky);
      if (spojit) casti = casti.filter((x) => x !== '');
      radky.push(casti);
    }
    nahled.replaceChildren(el('table', {}, radky.map((r) => el('tr', {}, r.map((x) => el('td', { text: x }))))));
  };
  const ch = (k, t) => zaskrt(t, odd[k], (x) => { odd[k] = x; kresli(); }).uzel;
  const j = vstup({ class: 'ps-vstup kratky', maxlength: 1, oninput: (e) => { jiny = e.target.value; kresli(); } });
  kresli();
  dialog(P.koren, {
    titulek: 'Převést text na sloupce', sirka: 520,
    obsah: el('div', {}, el('p', { text: 'Nastavte oddělovače, které data obsahují. Náhled ukazuje výsledek.' }),
      el('div.tb-dva-sloupce', {}, ch('\t', 'Tabulátor'), ch(';', 'Středník'), ch(',', 'Čárka'), ch(' ', 'Mezera'), el('label.ps-zaskrt', {}, el('span', { text: 'Jiný:' }), j)),
      zaskrt('Považovat následné oddělovače za jeden', false, (x) => { spojit = x; kresli(); }).uzel,
      el('h4', { text: 'Náhled dat' }), nahled),
    tlacitka: [{ text: 'Dokončit', primarni: true, akce: () => {
      const znaky = Object.entries(odd).filter(([, x]) => x).map(([k]) => k).concat(jiny ? [jiny] : []);
      P.prikaz('Text do sloupců', () => {
        for (let r = o.r1; r <= Math.min(o.r2, P.S.rozsah(l).r); r++) {
          let casti = rozdelText(String(P.S.hodnota(l, r, o.c1) ?? ''), znaky);
          if (spojit) casti = casti.filter((x) => x !== '');
          casti.forEach((x, k) => P.S.zadej(l, r, o.c1 + k, x.trim()));
        }
      });
    } }, { text: 'Zrušit' }],
  });
}

export function dialogDuplicity(P) {
  const d = P.oblastDat();
  const l = L(P);
  let zahlavi = d.zahlavi;
  const o = d.oblast;
  const vybrane = new Set(Array.from({ length: o.c2 - o.c1 + 1 }, (_, i) => o.c1 + i));
  const seznam = el('div.tb-fb-list.tb-duplicity');
  const kresli = () => seznam.replaceChildren(...[...Array(o.c2 - o.c1 + 1)].map((_, i) => {
    const c = o.c1 + i;
    return zaskrt(zahlavi ? String(P.S.hodnota(l, o.r1, c) ?? `Sloupec ${pismena(c)}`) : `Sloupec ${pismena(c)}`, vybrane.has(c), (x) => { if (x) vybrane.add(c); else vybrane.delete(c); }).uzel;
  }));
  kresli();
  dialog(P.koren, {
    titulek: 'Odebrat duplicity', sirka: 420,
    obsah: el('div', {}, el('p', { text: 'Pokud chcete odstranit duplicitní hodnoty, vyberte jeden nebo více sloupců, které obsahují duplicity.' }),
      el('div.tb-seradit-tl', {}, el('button.ps-tlac', { type: 'button', text: 'Vybrat vše', onclick: () => { for (let c = o.c1; c <= o.c2; c++) vybrane.add(c); kresli(); } }), el('button.ps-tlac', { type: 'button', text: 'Zrušit výběr všech', onclick: () => { vybrane.clear(); kresli(); } }),
        el('span.tb-mezera'), zaskrt('Data obsahují záhlaví', zahlavi, (x) => { zahlavi = x; kresli(); }).uzel),
      seznam),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => {
      if (!vybrane.size) return false;
      let v;
      P.prikaz('Odebrat duplicity', () => { v = P.S.odstranDuplicity(l, o, [...vybrane], zahlavi); });
      setTimeout(() => zprava(P.koren, v.odstraneno ? `Počet nalezených a odebraných duplicitních hodnot: ${v.odstraneno}. Zbývající počet jedinečných hodnot: ${v.zbyva}.` : 'Nebyly nalezeny žádné duplicitní hodnoty.'));
    } }, { text: 'Zrušit' }],
  });
}

// ================================================================ Názvy
export function dialogSpravceNazvu(P) {
  const seznam = el('div.tb-spravce-nazvu');
  let vybrany = null;
  const kresli = () => {
    const nazvy = [...P.S.nazvy.entries()];
    seznam.replaceChildren(el('div.tb-sn-radek.hlava', {}, ['Název', 'Hodnota', 'Odkaz na', 'Obor', 'Komentář'].map((t) => el('span', { text: t }))),
      ...nazvy.map(([k, d]) => el('div.tb-sn-radek' + (k === vybrany ? '.vybrano' : ''), { onclick: () => { vybrany = k; kresli(); }, ondblclick: () => { vybrany = k; dialogNovyNazev(P, d, kresli); } },
        el('span', { text: d.nazev }), el('span', { text: nahledHodnoty(P, d.vzorec.slice(1)) }), el('span', { text: d.vzorec }), el('span', { text: d.rozsah ? P.S.listPodleId(d.rozsah)?.nazev || '?' : 'Sešit' }), el('span', { text: d.komentar || '' }))),
      ...P.S.listy.flatMap((l) => l.tabulky.map((t) => el('div.tb-sn-radek.tabulka', {}, el('span', { text: '▦ ' + t.nazev }), el('span', { text: '{…}' }), el('span', { text: `=${jmenoListuVeVzorci(l.nazev)}!${textOblasti(oblastDatTabulky(t), true)}` }), el('span', { text: 'Sešit' }), el('span')))));
  };
  kresli();
  dialog(P.koren, {
    titulek: 'Správce názvů', sirka: 720, cls: 'tb-dlg-spravce',
    obsah: el('div', {}, el('div.tb-seradit-tl', {},
      el('button.ps-tlac', { type: 'button', text: 'Nový…', onclick: () => dialogNovyNazev(P, null, kresli) }),
      el('button.ps-tlac', { type: 'button', text: 'Upravit…', onclick: () => { const d = P.S.nazvy.get(vybrany); if (d) dialogNovyNazev(P, d, kresli); } }),
      el('button.ps-tlac', { type: 'button', text: 'Odstranit', onclick: () => { if (vybrany) { P.prikaz('Odstranit název', () => P.S.nazvy.delete(vybrany)); vybrany = null; kresli(); } } })), seznam),
    tlacitka: [{ text: 'Zavřít', primarni: true }],
  });
}

export function dialogNovyNazev(P, upravit = null, hotovo = null) {
  const o = OBL(P);
  const navrh = (() => { const v = P.S.hodnota(L(P), o.r1, o.c1 - 1); return typeof v === 'string' ? v.replace(/[^\p{L}\d_.]/gu, '_').replace(/^(\d)/, '_$1') : ''; })();
  const jm = vstup({ value: upravit?.nazev || navrh });
  const obor = vyber([['', 'Sešit'], ...P.S.listy.map((l) => [l.id, l.nazev])], upravit?.rozsah || '');
  const kom = stop(el('textarea.ps-vstup', { rows: 3 }, upravit?.komentar || ''));
  const odkaz = poleOblasti(P, upravit?.vzorec || '=' + jmenoListuVeVzorci(L(P).nazev) + '!' + textOblasti(o, true));
  dialog(P.koren, {
    titulek: upravit ? 'Upravit název' : 'Nový název', sirka: 440,
    obsah: el('div', {}, pole('Název:', jm), pole('Obor:', obor), pole('Komentář:', kom), pole('Odkaz na:', odkaz)),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => {
      const n = jm.value.trim();
      if (!/^[\p{L}_\\][\p{L}\d_.]*$/u.test(n) || /^[A-Z]{1,3}\d+$/i.test(n) || /^(r|c|ř|s)$/i.test(n)) { zprava(P.koren, 'Zadaný název není platný.\n\nNázev musí začínat písmenem nebo podtržítkem, nesmí obsahovat mezery a nesmí vypadat jako odkaz na buňku (např. A1).'); return false; }
      const f = odkaz.vstup.value.trim();
      P.prikaz(upravit ? 'Upravit název' : 'Definovat název', () => {
        if (upravit) for (const [k, d] of P.S.nazvy) if (d === upravit) P.S.nazvy.delete(k);
        P.S.definujNazev(n, normalizujVzorec(f[0] === '=' ? f : '=' + f), { rozsah: obor.value ? +obor.value : null, komentar: kom.value });
      });
      hotovo?.();
    } }, { text: 'Zrušit' }],
  });
  setTimeout(() => jm.select(), 40);
}

export function dialogZVyberu(P) {
  const h = zaskrt('Horní řádek', true), lv = zaskrt('Levý sloupec', false), d = zaskrt('Dolní řádek', false), p = zaskrt('Pravý sloupec', false);
  dialog(P.koren, {
    titulek: 'Vytvořit názvy z výběru', sirka: 320,
    obsah: el('div', {}, el('p', { text: 'Vytvořit názvy z hodnot v:' }), h.uzel, lv.uzel, d.uzel, p.uzel),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => {
      const o = OBL(P), l = L(P);
      const cist = (x) => String(x ?? '').trim().replace(/[^\p{L}\d_.]/gu, '_').replace(/^(\d)/, '_$1');
      let n = 0;
      P.prikaz('Vytvořit z výběru', () => {
        const pref = jmenoListuVeVzorci(l.nazev) + '!';
        if (h.c.checked) for (let c = o.c1; c <= o.c2; c++) { const jm = cist(P.S.hodnota(l, o.r1, c)); if (jm) { P.S.definujNazev(jm, '=' + pref + textOblasti({ r1: o.r1 + 1, r2: o.r2, c1: c, c2: c }, true)); n++; } }
        if (lv.c.checked) for (let r = o.r1 + (h.c.checked ? 1 : 0); r <= o.r2; r++) { const jm = cist(P.S.hodnota(l, r, o.c1)); if (jm) { P.S.definujNazev(jm, '=' + pref + textOblasti({ r1: r, r2: r, c1: o.c1 + 1, c2: o.c2 }, true)); n++; } }
        if (d.c.checked) for (let c = o.c1; c <= o.c2; c++) { const jm = cist(P.S.hodnota(l, o.r2, c)); if (jm) { P.S.definujNazev(jm, '=' + pref + textOblasti({ r1: o.r1, r2: o.r2 - 1, c1: c, c2: c }, true)); n++; } }
        if (p.c.checked) for (let r = o.r1; r <= o.r2; r++) { const jm = cist(P.S.hodnota(l, r, o.c2)); if (jm) { P.S.definujNazev(jm, '=' + pref + textOblasti({ r1: r, r2: r, c1: o.c1, c2: o.c2 - 1 }, true)); n++; } }
      });
      P.toast(`Vytvořeno názvů: ${n}`);
    } }, { text: 'Zrušit' }],
  });
}

// ================================================================ Zámek
export function dialogZamknoutList(P) {
  const heslo = vstup({ type: 'password' });
  const povol = { vybratZamknute: true, vybratOdemknute: true, formatBunek: false, formatSloupcu: false, formatRadku: false, vlozitSloupce: false, vlozitRadky: false, odkazy: false, odstranitSloupce: false, odstranitRadky: false, razeni: false, filtr: false, objekty: false };
  const nazvy = { vybratZamknute: 'Vybrat zamknuté buňky', vybratOdemknute: 'Vybrat odemknuté buňky', formatBunek: 'Formátovat buňky', formatSloupcu: 'Formátovat sloupce', formatRadku: 'Formátovat řádky', vlozitSloupce: 'Vložit sloupce', vlozitRadky: 'Vložit řádky', odkazy: 'Vložit hypertextové odkazy', odstranitSloupce: 'Odstranit sloupce', odstranitRadky: 'Odstranit řádky', razeni: 'Seřadit', filtr: 'Použít automatický filtr', objekty: 'Upravit objekty' };
  dialog(P.koren, {
    titulek: 'Zamknout list', sirka: 380,
    obsah: el('div', {}, zaskrt('Zamknout list a obsah zamknutých buněk', true).uzel, pole('Heslo pro odemknutí listu:', heslo),
      el('p', { text: 'Povolit všem uživatelům tohoto listu:' }), el('div.tb-fb-list.tb-povoleni', {}, Object.entries(nazvy).map(([k, t]) => zaskrt(t, povol[k], (x) => { povol[k] = x; }).uzel))),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => {
      const hotovo = () => { P.prikaz('Zamknout list', () => { L(P).zamek = { heslo: heslo.value || null, povolit: povol }; }, { prepocet: false }); P.toast('List je zamknutý. Odemknete ho na kartě Revize.'); };
      if (!heslo.value) { hotovo(); return; }
      setTimeout(() => {
        const znovu = vstup({ type: 'password' });
        dialog(P.koren, { titulek: 'Potvrdit heslo', sirka: 340, obsah: el('div', {}, pole('Znovu zadejte heslo:', znovu), el('p.tb-fb-popis', { text: 'Pozor: Ztracená nebo zapomenutá hesla nelze obnovit.' })),
          tlacitka: [{ text: 'OK', primarni: true, akce: () => { if (znovu.value !== heslo.value) { zprava(P.koren, 'Potvrzené heslo není shodné.'); return false; } hotovo(); } }, { text: 'Zrušit' }] });
        setTimeout(() => znovu.focus(), 40);
      });
    } }, { text: 'Zrušit' }],
  });
  setTimeout(() => heslo.focus(), 40);
}

export function dialogZamknoutSesit(P) {
  if (P.S.zamek) {
    const h = vstup({ type: 'password' });
    dialog(P.koren, { titulek: 'Odemknout sešit', sirka: 320, obsah: pole('Heslo:', h), tlacitka: [{ text: 'OK', primarni: true, akce: () => { if (P.S.zamek.heslo && h.value !== P.S.zamek.heslo) { zprava(P.koren, 'Zadané heslo není správné.'); return false; } P.S.zamek = null; P.obnov(); } }, { text: 'Zrušit' }] });
    return;
  }
  const h = vstup({ type: 'password' });
  dialog(P.koren, {
    titulek: 'Zamknout strukturu a okna', sirka: 340,
    obsah: el('div', {}, el('p', { text: 'Zamknout sešit pro:' }), zaskrt('Strukturu', true).uzel, pole('Heslo (volitelné):', h)),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => { P.S.zamek = { heslo: h.value || null }; P.obnov(); P.toast('Struktura sešitu je zamknutá — listy nejde přidávat, mazat ani přesouvat.'); } }, { text: 'Zrušit' }],
  });
}

// ================================================================ Odkaz
export function dialogOdkaz(P) {
  const l = L(P), v = V(P);
  const b = P.S.bunka(l, v.r, v.c);
  const text = vstup({ value: b?.v ?? '' });
  const adr = vstup({ value: b?.odkaz && !/^#/.test(b.odkaz) ? b.odkaz : '' });
  const list = vyber(P.S.listy.map((x) => [x.nazev, x.nazev]), l.nazev);
  const bunka = vstup({ value: 'A1' });
  let druh = b?.odkaz && /^#/.test(b.odkaz) ? 'misto' : 'web';
  const telo = el('div');
  const kresli = () => telo.replaceChildren(druh === 'web' ? pole('Adresa:', adr) : el('div', {}, pole('Zadejte odkaz na buňku:', bunka), pole('Nebo vyberte místo v tomto dokumentu:', list)));
  const odkazNa = el('div.tb-odkaz-na', {}, [['web', 'Existující soubor nebo webová stránka'], ['misto', 'Místo v tomto dokumentu']].map(([k, t]) => el('button' + (k === druh ? '.vybrano' : ''), { type: 'button', text: t, onclick: (e) => { druh = k; odkazNa.querySelectorAll('button').forEach((x) => x.classList.toggle('vybrano', x === e.currentTarget)); kresli(); } })));
  kresli();
  dialog(P.koren, {
    titulek: 'Vložit hypertextový odkaz', sirka: 520,
    obsah: el('div.tb-odkaz', {}, el('div', {}, el('small', { text: 'Odkaz na:' }), odkazNa), el('div', {}, pole('Zobrazený text:', text), telo)),
    tlacitka: [
      ...(b?.odkaz ? [{ text: 'Odebrat odkaz', akce: () => P.vymazat('odkazy') }] : []),
      { text: 'OK', primarni: true, akce: () => {
        let u = druh === 'web' ? adr.value.trim() : `#${jmenoListuVeVzorci(list.value)}!${bunka.value.trim() || 'A1'}`;
        if (!u) return false;
        if (druh === 'web' && !/^[a-z]+:/i.test(u)) u = 'https://' + u;
        P.prikaz('Hypertextový odkaz', () => {
          const x = l.b.get(klic(v.r, v.c)) || {};
          P.S.zapis(l, v.r, v.c, { ...x, v: text.value || u.replace(/^#/, ''), f: null, odkaz: u, s: slozStyl(x.s, { u: 's', barva: '#0563C1' }) });
        });
      } },
      { text: 'Zrušit' },
    ],
  });
}

// ================================================================ Tabulka
export function dialogVytvoritTabulku(P, styl = 'stredni2') {
  const l = L(P), v = V(P);
  if (P.S.tabulkaV(l, v.r, v.c)) { zprava(P.koren, 'Vybraná oblast už je součástí tabulky.'); return; }
  const o0 = OBL(P);
  const o = o0.r1 === o0.r2 && o0.c1 === o0.c2 ? P.S.aktualniOblast(l, v.r, v.c) : o0;
  const obl = poleOblasti(P, textOblasti(o, true), { popis: 'Vytvořit tabulku' });
  const zah = zaskrt('Tabulka obsahuje záhlaví', P.odhadniZahlavi(l, o) || typeof P.S.hodnota(l, o.r1, o.c1) === 'string');
  dialog(P.koren, {
    titulek: 'Vytvořit tabulku', sirka: 340,
    obsah: el('div', {}, pole('Kde jsou data pro tabulku?', obl), zah.uzel),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => {
      const x = rozeberOblast(obl.vstup.value.replace(/\$/g, ''));
      if (!x) { zprava(P.koren, 'Odkaz není platný.'); return false; }
      if (l.sloucene.some((m) => prekryva(m, x))) { zprava(P.koren, 'Tabulka nemůže obsahovat sloučené buňky.'); return false; }
      P.prikaz('Vytvořit tabulku', () => { const t = P.S.vytvorTabulku(l, x, { styl, zahlavi: zah.c.checked }); t.filtrTl = true; if (l.filtr && prekryva(l.filtr.oblast, x)) l.filtr = null; });
      P.grid.vyberOblast({ ...x, r2: x.r2 + (zah.c.checked ? 0 : 1) });
      P.prepniKartu('tabNavrh');
    } }, { text: 'Zrušit' }],
  });
}

export function dialogZmenitTabulku(P) {
  const l = L(P), t = P.stav.tabulka;
  if (!t) return;
  const obl = poleOblasti(P, textOblasti(t.oblast, true));
  dialog(P.koren, {
    titulek: 'Změnit velikost tabulky', sirka: 340,
    obsah: el('div', {}, el('p', { text: 'Vyberte novou oblast dat pro tabulku:' }), obl, el('p.tb-fb-popis', { text: 'Záhlaví musí zůstat ve stejném řádku a výsledná oblast tabulky se musí překrývat s původní.' })),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => {
      const x = rozeberOblast(obl.vstup.value.replace(/\$/g, ''));
      if (!x || x.r1 !== t.oblast.r1) { zprava(P.koren, 'Záhlaví musí zůstat ve stejném řádku.'); return false; }
      P.prikaz('Změnit velikost tabulky', () => { l.tabulky.find((y) => y.nazev === t.nazev).oblast = x; });
    } }, { text: 'Zrušit' }],
  });
}

// ================================================================ Grafy
export function dialogVlozitGraf(P, { karta = 'doporucene', zmena = false } = {}) {
  const l = L(P);
  const gr0 = zmena ? P.vybranyGraf() : null;
  const d = P.oblastDat();
  const zdroj = gr0 ? gr0.zdroj : jmenoListuVeVzorci(l.nazev) + '!' + textOblasti(d.oblast, true);
  const vzor = { id: 'nahled' + ++citac, zdroj, radyVeSloupcich: gr0?.radyVeSloupcich ?? true, styl: gr0?.styl || 1, paleta: gr0?.paleta || 'barevne' };
  const data = dataGrafu(P.S, l, { ...vzor, typ: 'sloupcovy' });
  const doporucene = doporuceneGrafy(data);
  let typ = gr0?.typ || doporucene[0];
  const levy = el('div.tb-graf-typy');
  const pravy = el('div.tb-graf-nahled');
  const zal = el('div.tb-zalozky-dlg', {}, el('button', { type: 'button', text: 'Doporučené grafy', onclick: () => kresli('doporucene') }), el('button', { type: 'button', text: 'Všechny grafy', onclick: () => kresli('vse') }));
  const popisy = { sloupcovy: 'Skupinový sloupcový graf se používá k porovnání hodnot mezi několika kategoriemi.', spojnicovy: 'Spojnicový graf ukazuje trendy v čase (roky, měsíce, dny) nebo v kategoriích.', vysecovy: 'Výsečový graf ukazuje podíl jednotlivých částí na celku. Hodí se, když je hodnot málo.', pruhovy: 'Pruhový graf porovnává hodnoty mezi kategoriemi, hodí se pro dlouhé popisky.', sloupcovySkladany: 'Skládaný sloupcový graf ukazuje, jak se části podílejí na celku v jednotlivých kategoriích.', bodovy: 'Bodový graf ukazuje vztah mezi dvěma sadami hodnot.', kombinovany: 'Kombinovaný graf zvýrazní odlišné druhy informací — poslední řada jako spojnice.', plosny: 'Plošný graf zdůrazňuje velikost změny v čase.' };
  const kresli = (k) => {
    karta = k;
    zal.children[0].classList.toggle('aktivni', k === 'doporucene');
    zal.children[1].classList.toggle('aktivni', k === 'vse');
    const typy = k === 'doporucene' ? doporucene.map((id) => TYPY_GRAFU.find((t) => t.id === id)) : TYPY_GRAFU;
    if (!typy.find((t) => t.id === typ)) typ = typy[0].id;
    levy.replaceChildren(...typy.map((t) => el('button.tb-graf-typ' + (t.id === typ ? '.vybrano' : ''), { type: 'button', title: t.nazev, onclick: () => { typ = t.id; kresli(karta); }, ondblclick: () => d0.okno.querySelector('.primarni').click() },
      k === 'doporucene' ? el('div.tb-graf-mini', { html: svgGrafu({ ...vzor, typ: t.id, id: vzor.id + t.id, legenda: null }, dataGrafu(P.S, l, { ...vzor, typ: t.id }), 150, 90) }) : ik(t.ikona), el('span', { text: k === 'doporucene' ? '' : t.nazev }))));
    const t = TYPY_GRAFU.find((x) => x.id === typ);
    pravy.replaceChildren(el('h4', { text: t.nazev }), el('div.tb-graf-velky', { html: svgGrafu({ ...vzor, typ, id: vzor.id + 'V' }, dataGrafu(P.S, l, { ...vzor, typ }), 420, 260) }), el('p.tb-fb-popis', { text: popisy[typ] || 'Použijte tento typ grafu k zobrazení vybraných dat.' }));
  };
  kresli(zmena ? 'vse' : karta);
  const d0 = dialog(P.koren, {
    titulek: zmena ? 'Změnit typ grafu' : 'Vložit graf', sirka: 760, cls: 'tb-dlg-graf',
    obsah: el('div', {}, zal, el('div.tb-graf-dlg', {}, levy, pravy)),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => { if (zmena) P.upravGraf({ typ }, 'Změnit typ grafu'); else P.vlozGraf(typ); } }, { text: 'Zrušit' }],
  });
}

export function dialogVybratData(P) {
  const g = P.vybranyGraf();
  if (!g) return;
  const obl = poleOblasti(P, g.zdroj, { popis: 'Oblast dat grafu' });
  const obsah = el('div.tb-vd');
  let radyVeSloupcich = g.radyVeSloupcich !== false;
  const kresli = () => {
    const d = dataGrafu(P.S, L(P), { ...g, zdroj: obl.vstup.value, radyVeSloupcich });
    obsah.replaceChildren(el('div', {}, el('h4', { text: 'Položky legendy (řady)' }), el('div.tb-fb-list', {}, d.rady.map((r) => el('div.tb-vd-pol', { text: r.nazev })))),
      el('div', {}, el('h4', { text: 'Popisky vodorovné osy (kategorie)' }), el('div.tb-fb-list', {}, d.kategorie.map((k) => el('div.tb-vd-pol', { text: k })))));
  };
  obl.vstup.addEventListener('input', kresli);
  kresli();
  dialog(P.koren, {
    titulek: 'Vybrat zdroj dat', sirka: 600,
    obsah: el('div', {}, pole('Oblast dat grafu:', obl), el('button.ps-tlac.tb-prepnout', { type: 'button', text: '⇄ Přepnout řádek/sloupec', onclick: () => { radyVeSloupcich = !radyVeSloupcich; kresli(); } }), obsah),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => P.upravGraf({ zdroj: normalizujVzorec('=' + obl.vstup.value.replace(/^=/, '')).slice(1), radyVeSloupcich }, 'Vybrat data') }, { text: 'Zrušit' }],
  });
}

export function dialogPresunGraf(P) {
  const g = P.vybranyGraf();
  if (!g) return;
  const jm = vstup({ value: P.S.volneJmenoListu('Graf') });
  const list = vyber(P.S.listy.map((l) => [l.id, l.nazev]), L(P).id);
  const v = prepinac('pg' + ++citac, [['novy', 'Nový list:'], ['objekt', 'Objekt v:']], 'objekt');
  dialog(P.koren, {
    titulek: 'Přesunout graf', sirka: 420,
    obsah: el('div.tb-presun-graf', {}, el('p', { text: 'Zvolte, kam chcete graf umístit:' }), el('div.tb-radek-dlg', {}, v.uzly[0], jm), el('div.tb-radek-dlg', {}, v.uzly[1], list)),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => {
      const zdroj = L(P);
      P.prikaz('Přesunout graf', () => {
        let cil;
        if (v.hodnota() === 'novy') { cil = P.S.pridejList(P.S.aktivni, jm.value.trim() || P.S.volneJmenoListu('Graf')); cil.mrizka = false; Object.assign(g, { x: 10, y: 10, w: 900, h: 560 }); }
        else cil = P.S.listPodleId(+list.value);
        if (cil === zdroj) return;
        zdroj.grafy = zdroj.grafy.filter((x) => x.id !== g.id);
        cil.grafy.push({ ...g });
        P.S.aktivni = P.S.listy.indexOf(cil);
      }, { prepocet: false });
      P.kresliListy(); P.grid.obnovPosun(); P.obnovObjekty();
    } }, { text: 'Zrušit' }],
  });
}

// ================================================================ Kontingenční tabulka
export function dialogKontingencni(P, { doporucene = false, graf = false } = {}) {
  // ukázková verze: kontingenční tabulky a grafy jsou v plné verzi (tabulky/kontingencni.js)
  return zprava(P.koren, 'Kontingenční tabulky a kontingenční grafy jsou jen v plné verzi AstroOS.');
  const l = L(P), v = V(P);
  const t = P.S.tabulkaV(l, v.r, v.c);
  const o = t ? t.oblast : P.S.aktualniOblast(l, v.r, v.c);
  const zdroj = poleOblasti(P, t ? t.nazev : jmenoListuVeVzorci(l.nazev) + '!' + textOblasti(o, true), { popis: 'Tabulka nebo oblast' });
  const kam = prepinac('kt' + ++citac, [['novy', 'Nový list'], ['existujici', 'Existující list']], 'novy');
  const umisteni = poleOblasti(P, '', { popis: 'Umístění' });
  dialog(P.koren, {
    titulek: doporucene ? 'Doporučené kontingenční tabulky' : 'Vytvořit kontingenční tabulku', sirka: 460,
    obsah: el('div', {}, el('h4', { text: 'Vyberte data, která chcete analyzovat' }), pole('Tabulka nebo oblast:', zdroj),
      el('h4', { text: 'Zvolte, kam chcete sestavu kontingenční tabulky umístit' }), ...kam.uzly, pole('Umístění:', umisteni)),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => {
      let zt = zdroj.vstup.value.trim();
      const tab = P.S.tabulkaPodleJmena(zt);
      if (tab) { const tl = P.S.listPodleId(tab.list); zt = jmenoListuVeVzorci(tl.nazev) + '!' + textOblasti(tab.oblast, true); }
      if (!rozeberOblast(zt.replace(/\$/g, ''))) { zprava(P.koren, 'Odkaz na zdroj dat není platný.'); return false; }
      const def = { id: 'k' + Date.now().toString(36), nazev: 'KontingenčníTabulka' + (P.S.listy.reduce((n, x) => n + (x.kontingencni?.length || 0), 0) + 1), zdroj: zt, radky: [], sloupce: [], hodnoty: [], filtry: [] };
      const z = zdrojKontingencni(P.S, def);
      if (!z || !z.radky.length) { zprava(P.koren, 'Zdrojová oblast neobsahuje žádná data. Kontingenční tabulka potřebuje oblast se záhlavím a aspoň jedním řádkem dat.'); return false; }
      if (doporucene || graf) {
        const text = z.pole.find((p) => !p.cisla), cislo = z.pole.find((p) => p.cisla);
        if (text) def.radky = [text.nazev];
        if (cislo) def.hodnoty = [{ pole: cislo.nazev, fn: 'SUMA' }];
        else if (text) def.hodnoty = [{ pole: text.nazev, fn: 'POČET' }];
      }
      let cilList;
      P.prikaz('Kontingenční tabulka', () => {
        if (kam.hodnota() === 'novy') { cilList = P.S.pridejList(P.S.aktivni - 1 < 0 ? 0 : P.S.aktivni - 1); def.r = 2; def.c = 0; }
        else {
          const u = rozeberOblast(umisteni.vstup.value.replace(/\$/g, ''));
          if (!u) throw new Error('Umístění není platné.');
          cilList = u.list ? P.S.listPodleJmena(u.list) : l;
          P.S.aktivni = P.S.listy.indexOf(cilList);
          def.r = u.r1; def.c = u.c1;
        }
        cilList.kontingencni = [...(cilList.kontingencni || []), def];
        vytvorKontingencni(P.S, cilList, def);
      });
      P.kresliListy(); P.grid.obnovPosun(); P.obnovObjekty();
      P.grid.nastavVyber(def.r, def.c);
      P.podokno('pivot');
      if (graf && def.vystup) P.vlozGraf('sloupcovy', { zdroj: { ...def.vystup, r1: def.vystup.r1 + (def.filtry?.length ? def.filtry.length + 1 : 0), r2: def.vystup.r2 - 1 } });
    } }, { text: 'Zrušit' }],
  });
}

// ================================================================ Minigrafy
export function dialogMinigrafy(P, typ) {
  const o = OBL(P);
  const data = poleOblasti(P, o.r1 !== o.r2 || o.c1 !== o.c2 ? textOblasti(o) : '', { popis: 'Oblast dat' });
  const umisteni = poleOblasti(P, o.r1 !== o.r2 || o.c1 !== o.c2 ? textOblasti({ r1: o.r1, r2: o.r2, c1: o.c2 + 1, c2: o.c2 + 1 }, true) : adresa(o.r1, o.c1, true, true), { popis: 'Oblast umístění' });
  dialog(P.koren, {
    titulek: 'Vytvořit minigrafy', sirka: 400,
    obsah: el('div', {}, el('h4', { text: 'Zvolte požadovaná data' }), pole('Oblast dat:', data), el('h4', { text: 'Zvolte, kam chcete minigrafy umístit' }), pole('Oblast umístění:', umisteni)),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => {
      const d = rozeberOblast(data.vstup.value.replace(/\$/g, '')), u = rozeberOblast(umisteni.vstup.value.replace(/\$/g, ''));
      if (!d || !u) { zprava(P.koren, 'Odkaz na oblast dat nebo umístění není platný.'); return false; }
      const svisle = u.c1 === u.c2;
      const pocet = svisle ? u.r2 - u.r1 + 1 : u.c2 - u.c1 + 1;
      P.prikaz('Minigrafy', () => {
        const l = L(P);
        for (let i = 0; i < pocet; i++) {
          const r = svisle ? u.r1 + i : u.r1, c = svisle ? u.c1 : u.c1 + i;
          const zdroj = pocet === 1 ? textOblasti(d) : svisle ? textOblasti({ r1: d.r1 + i, r2: d.r1 + i, c1: d.c1, c2: d.c2 }) : textOblasti({ r1: d.r1, r2: d.r2, c1: d.c1 + i, c2: d.c1 + i });
          l.minigrafy = l.minigrafy.filter((m) => m.r !== r || m.c !== c);
          l.minigrafy.push({ r, c, zdroj, typ });
        }
      }, { prepocet: false });
    } }, { text: 'Zrušit' }],
  });
}

// ================================================================ Lupa, vzhled stránky
export function dialogLupa(P) {
  const z = Math.round(L(P).zoom * 100);
  const vl = vstup({ class: 'ps-vstup kratky', value: z });
  const v = prepinac('lu' + ++citac, [['200', '200 %'], ['100', '100 %'], ['75', '75 %'], ['50', '50 %'], ['25', '25 %'], ['vyber', 'Přizpůsobit výběru'], ['vlastni', 'Vlastní:']], [200, 100, 75, 50, 25].includes(z) ? String(z) : 'vlastni');
  dialog(P.koren, {
    titulek: 'Lupa', sirka: 260,
    obsah: el('div', {}, el('h4', { text: 'Zvětšení' }), ...v.uzly.slice(0, 6), el('div.tb-radek-dlg', {}, v.uzly[6], vl, el('span', { text: '%' }))),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => { const h = v.hodnota(); if (h === 'vyber') P.lupaNaVyber(); else P.lupa((h === 'vlastni' ? Math.max(10, Math.min(400, +vl.value || 100)) : +h) / 100); } }, { text: 'Zrušit' }],
  });
}

export function dialogVzhledStranky(P, karta = 'stranka') {
  const l = L(P);
  const t = { ...(l.tisk || {}) };
  const telo = el('div');
  const karty = [['stranka', 'Stránka'], ['okraje', 'Okraje'], ['zahlavi', 'Záhlaví a zápatí'], ['list', 'List']];
  const zal = el('div.tb-zalozky-dlg', {}, karty.map(([id, x]) => el('button', { type: 'button', text: x, dataset: { id }, onclick: () => ukaz(id) })));
  const S = {
    stranka() {
      const o = prepinac('vs-o' + ++citac, [['vyska', 'Na výšku'], ['sirka', 'Na šířku']], t.orientace === 'sirka' ? 'sirka' : 'vyska', (x) => { t.orientace = x; });
      const m = stop(el('input.ps-vstup.kratky', { type: 'number', min: 10, max: 400, value: t.meritko || 100, oninput: (e) => { t.meritko = +e.target.value; } }));
      const naSirku = zaskrt('Přizpůsobit na 1 stránku na šířku', t.naSirku1, (x) => { t.naSirku1 = x; });
      const papir = vyber([['A4', 'A4'], ['A3', 'A3'], ['A5', 'A5'], ['Letter', 'Letter']], t.papir || 'A4', { onchange: (e) => { t.papir = e.target.value; } });
      return el('div', {}, el('h4', { text: 'Orientace' }), el('div.tb-radek-dlg', {}, ...o.uzly), el('h4', { text: 'Měřítko' }), el('div.tb-radek-dlg', {}, el('span', { text: 'Upravit na:' }), m, el('span', { text: '% normální velikosti' })), naSirku.uzel, pole('Velikost papíru:', papir));
    },
    okraje() {
      const o = prepinac('vs-ok' + ++citac, [['normalni', 'Normální (horní 1,9 cm, levý 1,8 cm)'], ['uzke', 'Úzké (horní 1,9 cm, levý 0,6 cm)'], ['siroke', 'Široké (2,54 cm)']], t.okraje || 'normalni', (x) => { t.okraje = x; });
      const stred = zaskrt('Na střed vodorovně', t.naStred, (x) => { t.naStred = x; });
      return el('div', {}, ...o.uzly, el('h4', { text: 'Zarovnat na střed stránky' }), stred.uzel);
    },
    zahlavi() {
      const z = vstup({ value: t.zahlaviText || '', placeholder: 'např. Rozpočet 2026' });
      const zp = vstup({ value: t.zapatiText || '', placeholder: 'např. Stránka &[Stránka] z &[Stránky]' });
      z.oninput = () => { t.zahlaviText = z.value; }; zp.oninput = () => { t.zapatiText = zp.value; };
      return el('div', {}, pole('Záhlaví:', z), pole('Zápatí:', zp), el('p.tb-fb-popis', { text: 'Zástupné znaky: &[Stránka], &[Stránky], &[Datum], &[Soubor], &[List].' }));
    },
    list() {
      const obl = poleOblasti(P, t.oblast || '', { popis: 'Oblast tisku' });
      obl.vstup.addEventListener('input', () => { t.oblast = obl.vstup.value.replace(/\$/g, '') || null; });
      const radky = vstup({ value: t.opakovatRadky || '', placeholder: '$1:$1' });
      radky.oninput = () => { t.opakovatRadky = radky.value; };
      return el('div', {}, pole('Oblast tisku:', obl), el('h4', { text: 'Tisk názvů' }), pole('Nahoře opakovat řádky:', radky),
        el('h4', { text: 'Tisk' }), zaskrt('Mřížka', t.mrizka, (x) => { t.mrizka = x; }).uzel, zaskrt('Záhlaví řádků a sloupců', t.zahlavi, (x) => { t.zahlavi = x; }).uzel);
    },
  };
  const ukaz = (id) => { zal.querySelectorAll('button').forEach((b) => b.classList.toggle('aktivni', b.dataset.id === id)); telo.replaceChildren(S[id]()); };
  ukaz(karta);
  dialog(P.koren, {
    titulek: 'Vzhled stránky', sirka: 480,
    obsah: el('div', {}, zal, telo),
    tlacitka: [
      { text: 'Náhled tisku', akce: () => { P.prikaz('Vzhled stránky', () => { l.tisk = t; }, { prepocet: false }); import('./zakulisi.js').then((m) => m.otevriZakulisi(P, 'tisk')); } },
      { text: 'OK', primarni: true, akce: () => P.prikaz('Vzhled stránky', () => { l.tisk = t; }, { prepocet: false }) },
      { text: 'Zrušit' },
    ],
  });
}

// ================================================================ Vyhodnotit vzorec
export function dialogVyhodnotit(P) {
  const l = L(P), v = V(P);
  const b = P.S.bunka(l, v.r, v.c);
  if (!b?.f) { zprava(P.koren, 'Aktivní buňka neobsahuje vzorec.'); return; }
  let text = b.f;
  const pole1 = el('div.tb-vyhodnotit-text');
  const kroky = [];
  const hodnotaLiteral = (x) => (typeof x === 'string' ? `"${x.replace(/"/g, '""')}"` : jeChyba(x) ? x.kod : typeof x === 'boolean' ? (x ? 'PRAVDA' : 'NEPRAVDA') : typeof x === 'number' ? obecne(x, 15) : x === null ? '0' : Array.isArray(x) ? '{' + x.map((r) => r.map(hodnotaLiteral).join('\\')).join(';') + '}' : String(x));
  const dalsiKrok = () => {
    // 1) nejbližší odkaz na buňku / oblast
    const tok = lex(text.slice(1));
    const ref = tok.find((t) => t.typ === 'ref' || t.typ === 'name');
    if (ref) return { a: ref.a + 1, b: ref.b + 1 };
    // 2) nejvnitřnější funkce nebo závorka
    let nejl = null, hl = 0, max = -1;
    for (let i = 0; i < tok.length; i++) {
      if (tok[i].typ === '(') { hl++; if (hl > max) { max = hl; const zac = tok[i - 1]?.typ === 'fn' ? tok[i - 1].a : tok[i].a; let h = 0, j = i; for (; j < tok.length; j++) { if (tok[j].typ === '(') h++; if (tok[j].typ === ')') { h--; if (!h) break; } } nejl = { a: zac + 1, b: (tok[j]?.b ?? tok[i].b) + 1 }; } }
      if (tok[i].typ === ')') hl--;
    }
    if (nejl) return nejl;
    return { a: 1, b: text.length, cele: true };
  };
  const kresli = () => {
    const k = dalsiKrok();
    pole1.innerHTML = esc(text.slice(0, k.a)) + `<u>${esc(text.slice(k.a, k.b))}</u>` + esc(text.slice(k.b));
    return k;
  };
  let krok = kresli();
  const tl = el('button.ps-tlac.primarni', { type: 'button', text: 'Vyhodnotit' });
  tl.onclick = () => {
    if (krok.cele && kroky.length && /^=[^A-Za-zÁ-ž]*$/.test(text)) { text = b.f; kroky.length = 0; tl.textContent = 'Vyhodnotit'; krok = kresli(); return; }
    const cast = text.slice(krok.a, krok.b);
    let x;
    try {
      const s = parse('=' + cast);
      x = vyhodnot(s, { S: P.S.S, list: l, r: v.r, c: v.c });
      if (x instanceof Ref) x = x.jedna ? P.S.hodnota(x.list, x.r1, x.c1) : naPole(x, { S: P.S.S, list: l, r: v.r, c: v.c });
    } catch { x = null; }
    kroky.push(text);
    text = text.slice(0, krok.a) + hodnotaLiteral(x) + text.slice(krok.b);
    if (krok.cele) { pole1.textContent = text; tl.textContent = 'Znovu'; krok = { cele: true }; return; }
    krok = kresli();
  };
  dialog(P.koren, {
    titulek: 'Vyhodnotit vzorec', sirka: 560,
    obsah: el('div', {}, el('div.tb-radek-dlg', {}, el('b', { text: `Odkaz: ${jmenoListuVeVzorci(l.nazev)}!${adresa(v.r, v.c, true, true)}` })), el('small', { text: 'Vyhodnocení:' }), pole1,
      el('p.tb-fb-popis', { text: 'Podtržený výraz se vyhodnotí po kliknutí na Vyhodnotit. Výsledek posledního kroku je zobrazen kurzívou.' }), el('div.tb-seradit-tl', {}, tl)),
    tlacitka: [{ text: 'Zavřít' }],
  });
}

// ================================================================ Statistika, listy, symbol, řada
export function dialogStatistika(P) {
  const l = L(P);
  const cnt = (list) => {
    let data = 0, vzorce = 0, pozn = 0;
    for (const b of list.b.values()) { if (b.f || (b.v !== null && b.v !== undefined)) data++; if (b.f) vzorce++; if (b.pozn || b.kom) pozn++; }
    return { data, vzorce, pozn };
  };
  const a = cnt(l);
  const vse = P.S.listy.map(cnt).reduce((x, y) => ({ data: x.data + y.data, vzorce: x.vzorce + y.vzorce, pozn: x.pozn + y.pozn }), { data: 0, vzorce: 0, pozn: 0 });
  const d = P.S.rozsahDat(l);
  const radek = (k, v) => el('div.ps-zk-vl', {}, el('span', { text: k }), el('span', { text: String(v) }));
  dialog(P.koren, {
    titulek: 'Statistika sešitu', sirka: 380,
    obsah: el('div.tb-statistika', {},
      el('h4', { text: 'Aktuální list:' }), radek('Konec listu', d.r < 0 ? 'A1' : adresa(d.r, d.c)), radek('Buňky s daty', a.data), radek('Tabulky', l.tabulky.length), radek('Kontingenční tabulky', (l.kontingencni || []).length), radek('Vzorce', a.vzorce), radek('Grafy', l.grafy.length), radek('Obrázky a tvary', l.obrazky.length), radek('Poznámky a komentáře', a.pozn),
      el('h4', { text: 'Sešit:' }), radek('Listy', P.S.listy.length), radek('Buňky s daty', vse.data), radek('Vzorce', vse.vzorce), radek('Definované názvy', P.S.nazvy.size)),
    tlacitka: [{ text: 'OK', primarni: true }],
  });
}

export function dialogPresunList(P, l) {
  const pred = vyber([...P.S.listy.filter((x) => x !== l).map((x, i) => [x.id, x.nazev]), ['konec', '(přesunout na konec)']], 'konec');
  pred.size = 8;
  pred.classList.add('tb-seznam-vyber');
  const kopie = zaskrt('Vytvořit kopii', false);
  dialog(P.koren, {
    titulek: 'Přesunout nebo zkopírovat', sirka: 340,
    obsah: el('div', {}, el('p', { text: `Přesunout vybrané listy (${l.nazev}) před list:` }), pred, kopie.uzel),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => {
      const S = P.S;
      P.prikaz(kopie.c.checked ? 'Kopírovat list' : 'Přesunout list', () => {
        let cil = pred.value === 'konec' ? S.listy.length : S.listy.findIndex((x) => String(x.id) === pred.value);
        if (kopie.c.checked) S.kopirujList(l, cil);
        else { const z = S.listy.indexOf(l); S.presunList(z, cil > z ? cil - 1 : cil); }
      });
      P.kresliListy(); P.grid.obnovPosun(); P.obnovObjekty();
    } }, { text: 'Zrušit' }],
  });
}

export function dialogZobrazitList(P) {
  const skryte = P.S.listy.filter((l) => l.skryty);
  const s = vyber(skryte.map((l) => [l.id, l.nazev]), skryte[0]?.id);
  s.size = 6;
  s.classList.add('tb-seznam-vyber');
  dialog(P.koren, {
    titulek: 'Zobrazit', sirka: 300,
    obsah: el('div', {}, el('p', { text: 'Zobrazit list:' }), s),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => { const l = P.S.listPodleId(+s.value); if (!l) return; P.prikaz('Zobrazit list', () => { l.skryty = false; }, { prepocet: false }); P.prepniNaList(l); P.kresliListy(); } }, { text: 'Zrušit' }],
  });
}

export function dialogSymbol(P) {
  const symboly = '€£¥©®™°±×÷≠≈≤≥∞√∑∏∫∂πΩαβγδεθλμσφψω←↑→↓↔⇒⇔∀∃∈∉∩∪⊂⊃½¼¾⅓⅔‰§¶•…–—„“‚‘«»★☆♠♣♥♦✓✗☎✉⌂☀☁☂☃♪♫¹²³ⁿ₀₁₂₃'.split('');
  let vybrany = symboly[0];
  const mrizka = el('div.ps-symboly-mrizka.velka', {}, symboly.map((s) => el('button' + (s === vybrany ? '.vybrano' : ''), { type: 'button', text: s, onclick: (e) => { vybrany = s; mrizka.querySelectorAll('button').forEach((b) => b.classList.toggle('vybrano', b === e.currentTarget)); }, ondblclick: () => vloz() })));
  const vloz = () => {
    const g = P.grid;
    if (g.edit) { document.execCommand('insertText', false, vybrany); return; }
    const l = L(P), v = V(P);
    const t = (g.textProEditaci(v.r, v.c) || '') + vybrany;
    P.prikaz('Symbol', () => P.S.zadej(l, v.r, v.c, t));
  };
  dialog(P.koren, { titulek: 'Symbol', sirka: 520, obsah: mrizka, tlacitka: [{ text: 'Vložit', primarni: true, akce: () => { vloz(); return false; } }, { text: 'Zavřít' }] });
}

export function dialogRada(P) {
  const o = OBL(P);
  const vRadcich = o.c2 - o.c1 > o.r2 - o.r1;
  const smer = prepinac('ra-s' + ++citac, [['radky', 'Řádky'], ['sloupce', 'Sloupce']], vRadcich ? 'radky' : 'sloupce');
  const typ = prepinac('ra-t' + citac, [['linearni', 'Lineární'], ['rust', 'Geometrický'], ['datum', 'Kalendářní'], ['auto', 'Automatické vyplňování']], 'linearni');
  const jednotka = prepinac('ra-j' + citac, [['den', 'Den'], ['pracovni', 'Pracovní den'], ['mesic', 'Měsíc'], ['rok', 'Rok']], 'den');
  const krok = vstup({ value: '1', class: 'ps-vstup kratky' });
  const konec = vstup({ value: '', class: 'ps-vstup kratky' });
  dialog(P.koren, {
    titulek: 'Řady', sirka: 440,
    obsah: el('div.tb-rada', {}, el('div', {}, el('h4', { text: 'Řady v' }), ...smer.uzly), el('div', {}, el('h4', { text: 'Typ' }), ...typ.uzly), el('div', {}, el('h4', { text: 'Jednotka kalendářní' }), ...jednotka.uzly),
      el('div.tb-radek-dlg', {}, pole('Hodnota kroku:', krok), pole('Konečná hodnota:', konec))),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => {
      const k = rozpoznej(krok.value).v ?? 1;
      const l = L(P);
      const svisle = smer.hodnota() === 'sloupce';
      const zdroj = svisle ? { ...o, r2: o.r1 } : { ...o, c2: o.c1 };
      let cil = o;
      const konecH = rozpoznej(konec.value).v;
      const start = P.S.hodnota(l, o.r1, o.c1);
      if (typeof konecH === 'number' && typeof start === 'number' && k) {
        const n = typ.hodnota() === 'rust' ? Math.floor(Math.log(konecH / start) / Math.log(k)) : Math.floor((konecH - start) / k);
        cil = svisle ? { ...o, r2: o.r1 + Math.max(0, n) } : { ...o, c2: o.c1 + Math.max(0, n) };
      }
      const t = typ.hodnota();
      const rada = t === 'auto' ? null : t === 'datum' ? { jednotka: jednotka.hodnota() === 'pracovni' ? 'den' : jednotka.hodnota(), pracovni: jednotka.hodnota() === 'pracovni', krok: k } : { typ: t, krok: k };
      P.prikaz('Řady', () => P.S.vypln(l, zdroj, cil, { rada }));
      P.grid.vyberOblast(cil);
    } }, { text: 'Zrušit' }],
  });
}

// ================================================================ Import dat
function prochazetDisk(P, { filtr, titulek, hotovo }) {
  let cesta = FS.HOME + '/Dokumenty';
  const seznam = el('div.tb-fb-list.tb-prochazec');
  const drobky = el('div.tb-drobky');
  const kresli = () => {
    drobky.textContent = cesta.replace(FS.HOME, '~');
    let pol = [];
    try { pol = FS.list(cesta); } catch { /* nic */ }
    seznam.replaceChildren(
      cesta !== '/' ? el('button', { type: 'button', text: '⮤ ..', onclick: () => { cesta = FS.dirname(cesta); kresli(); } }) : null,
      ...pol.filter((p) => p.dir).map((p) => el('button', { type: 'button', onclick: () => { cesta = p.path; kresli(); } }, ik('slozka'), el('span', { text: p.name }))),
      ...pol.filter((p) => !p.dir && filtr.test(p.name)).map((p) => el('button', { type: 'button', onclick: () => { d.zavri(); hotovo(p.path); } }, ik('novy'), el('span', { text: p.name }))));
  };
  kresli();
  const d = dialog(P.koren, { titulek, sirka: 460, obsah: el('div', {}, drobky, seznam), tlacitka: [{ text: 'Zrušit' }] });
}

export function dialogObrazekZDisku(P) {
  const obr = FS.findImages();
  dialog(P.koren, {
    titulek: 'Vložit obrázek z AstroOS', sirka: 560,
    obsah: el('div.tb-obrazky-disk', {}, obr.length ? obr.slice(0, 60).map((o) => el('button', { type: 'button', title: o.name, onclick: (e) => { e.currentTarget.closest('.ps-kryt').remove(); P.vlozObrazekSrc(FS.imageSrc(o.path), o.name); } }, el('img', { src: FS.imageSrc(o.path), alt: '' }), el('span', { text: o.name }))) : el('p', { text: 'Na disku nejsou žádné obrázky.' })),
    tlacitka: [{ text: 'Zrušit' }],
  });
}

export function dialogImportCsv(P) {
  const zpracuj = (text, nazev) => {
    let odd = uhodniOddelovac(text);
    const oddSel = vyber([[';', 'Středník'], [',', 'Čárka'], ['\t', 'Tabulátor'], ['|', 'Svislá čára']], odd, { onchange: (e) => { odd = e.target.value; kresli(); } });
    const nahled = el('div.tb-tds-nahled');
    const kresli = () => nahled.replaceChildren(el('table', {}, rozdelCsv(text.split(/\r?\n/).slice(0, 12).join('\n'), odd).map((r) => el('tr', {}, r.map((x) => el('td', { text: x }))))));
    kresli();
    dialog(P.koren, {
      titulek: nazev, sirka: 620,
      obsah: el('div', {}, el('div.tb-radek-dlg', {}, pole('Kódování:', vyber([['utf8', '65001: Unicode (UTF-8)']], 'utf8')), pole('Oddělovač:', oddSel)), nahled),
      tlacitka: [{ text: 'Načíst', primarni: true, akce: () => {
        const radky = rozdelCsv(text, odd);
        P.prikaz('Načíst data', () => {
          const l = P.S.pridejList(P.S.aktivni, nazev.replace(/\.[^.]+$/, '').slice(0, 28).replace(/[\\/?*[\]:]/g, '_') || P.S.volneJmenoListu());
          radky.forEach((r, i) => r.forEach((x, j) => { if (x !== '') P.S.zadej(l, i, j, x); }));
          if (radky.length > 1) P.S.vytvorTabulku(l, { r1: 0, c1: 0, r2: radky.length - 1, c2: Math.max(...radky.map((r) => r.length)) - 1 }, { styl: 'stredni2' });
          for (let c = 0; c < Math.min(40, radky[0]?.length || 0); c++) P.nastavSirkuPodleObsahu(l, c);
        });
        P.kresliListy(); P.grid.obnovPosun(); P.obnovObjekty(); P.poZmeneVyberu();
      } }, { text: 'Zrušit' }],
    });
  };
  dialog(P.koren, {
    titulek: 'Načíst data', sirka: 360,
    obsah: el('div.tb-import-volba', {},
      el('button.ps-tlac', { type: 'button', text: 'Z disku AstroOS…', onclick: (e) => { e.currentTarget.closest('.ps-kryt').remove(); prochazetDisk(P, { filtr: /\.(csv|txt|tsv)$/i, titulek: 'Importovat data', hotovo: (c) => zpracuj(FS.read(c), FS.basename(c)) }); } }),
      el('button.ps-tlac', { type: 'button', text: 'Z tohoto zařízení…', onclick: (e) => { e.currentTarget.closest('.ps-kryt').remove(); const v = el('input', { type: 'file', accept: '.csv,.txt,.tsv' }); v.onchange = async () => { const f = v.files[0]; if (f) zpracuj(await f.text(), f.name); }; v.click(); } })),
    tlacitka: [{ text: 'Zrušit' }],
  });
}

export function dialogImportSesit(P) {
  prochazetDisk(P, {
    filtr: /\.xlsx$/i, titulek: 'Importovat listy ze sešitu', hotovo: (c) => {
      let s;
      try { s = Sesit.rozeber(FS.read(c)); } catch { zprava(P.koren, 'Sešit se nepodařilo načíst.'); return; }
      P.prikaz('Importovat listy', () => {
        for (const l of s.listy) {
          const n = P.S.pridejList(P.S.listy.length - 1, P.S.listPodleJmena(l.nazev) ? P.S.volneJmenoListu(l.nazev.slice(0, 25) + ' ') : l.nazev);
          const id = n.id;
          Object.assign(n, l, { id, nazev: n.nazev });
        }
      });
      P.kresliListy(); P.grid.obnovPosun(); P.obnovObjekty();
    },
  });
}

export function dialogZWebu(P) {
  const url = vstup({ value: 'https://cs.wikipedia.org/wiki/Seznam_nejvyšších_hor_Česka', placeholder: 'https://…' });
  dialog(P.koren, {
    titulek: 'Z webu', sirka: 520,
    obsah: el('div', {}, pole('Adresa URL', url), el('p.tb-fb-popis', { text: 'AstroTabulky stáhnou stránku přes proxy prohlížeče Nova a nabídnou tabulky, které na ní najdou.' })),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => { nactiWeb(P, url.value.trim()); } }, { text: 'Zrušit' }],
  });
  setTimeout(() => url.select(), 40);
}

async function nactiWeb(P, adresa) {
  if (!/^https?:\/\//i.test(adresa)) adresa = 'https://' + adresa;
  let u;
  try { u = new URL(adresa); } catch { zprava(P.koren, 'Adresa URL není platná.'); return; }
  const pres = u.href;   // ukázková verze nemá proxy — jdou jen weby, které povolují CORS
  P.toast('Načítám stránku…');
  let html;
  try {
    const r = await fetch(pres, { signal: AbortSignal.timeout(20000) });
    html = await r.text();
  } catch (e) { zprava(P.koren, 'Stránku se nepodařilo stáhnout. Ukázková verze nemá proxy, takže jdou jen weby, které to povolují (třeba Wikipedie).\n\n' + e.message); return; }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const tabulky = [...doc.querySelectorAll('table')].map((t) => [...t.querySelectorAll('tr')].map((tr) => [...tr.querySelectorAll('th, td')].map((td) => td.textContent.replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim()))).filter((t) => t.length > 1 && t[0].length > 1);
  if (!tabulky.length) { zprava(P.koren, 'Na stránce se nenašla žádná tabulka.'); return; }
  let vybrana = 0;
  const seznam = el('div.tb-fb-list');
  const nahled = el('div.tb-tds-nahled');
  const kresli = () => {
    seznam.replaceChildren(...tabulky.map((t, i) => el('button' + (i === vybrana ? '.vybrano' : ''), { type: 'button', text: `Tabulka ${i + 1} (${t.length} × ${t[0].length})`, onclick: () => { vybrana = i; kresli(); } })));
    nahled.replaceChildren(el('table', {}, tabulky[vybrana].slice(0, 15).map((r) => el('tr', {}, r.map((x) => el('td', { text: x }))))));
  };
  kresli();
  dialog(P.koren, {
    titulek: 'Navigátor', sirka: 760, cls: 'tb-dlg-navigator',
    obsah: el('div.tb-navigator', {}, el('div', {}, el('b', { text: doc.title || u.host }), seznam), nahled),
    tlacitka: [{ text: 'Načíst', primarni: true, akce: () => {
      const t = tabulky[vybrana];
      P.prikaz('Načíst z webu', () => {
        const l = P.S.pridejList(P.S.aktivni, P.S.volneJmenoListu('Web'));
        t.forEach((r, i) => r.forEach((x, j) => { if (x) P.S.zadej(l, i, j, x); }));
        P.S.vytvorTabulku(l, { r1: 0, c1: 0, r2: t.length - 1, c2: Math.max(...t.map((r) => r.length)) - 1 }, { styl: 'stredni2' });
        for (let c = 0; c < Math.min(30, t[0].length); c++) P.nastavSirkuPodleObsahu(l, c);
        l.zdrojWeb = adresa;
      });
      P.kresliListy(); P.grid.obnovPosun(); P.obnovObjekty(); P.poZmeneVyberu();
    } }, { text: 'Zrušit' }],
  });
}

// ================================================================ Prognóza, souhrn
export function dialogPrognoza(P) {
  const l = L(P), v = V(P);
  const o = P.S.aktualniOblast(l, v.r, v.c);
  if (o.c2 - o.c1 < 1) { zprava(P.koren, 'Vyberte oblast se dvěma sloupci: časová osa (data nebo čísla) a hodnoty.'); return; }
  const zahlavi = typeof P.S.hodnota(l, o.r1, o.c1 + 1) === 'string';
  const r1 = zahlavi ? o.r1 + 1 : o.r1;
  const body = [];
  for (let r = r1; r <= o.r2; r++) { const x = P.S.hodnota(l, r, o.c1), y = P.S.hodnota(l, r, o.c1 + 1); if (typeof x === 'number' && typeof y === 'number') body.push([x, y]); }
  if (body.length < 3) { zprava(P.koren, 'Pro prognózu jsou potřeba aspoň tři řádky s číselnou časovou osou a hodnotami.'); return; }
  const n = stop(el('input.ps-vstup.kratky', { type: 'number', value: Math.max(3, Math.round(body.length / 2)), min: 1 }));
  dialog(P.koren, {
    titulek: 'Vytvořit list prognózy', sirka: 400,
    obsah: el('div', {}, el('p', { text: `Prognóza použije lineární trend z ${body.length} bodů.` }), pole('Počet period prognózy:', n)),
    tlacitka: [{ text: 'Vytvořit', primarni: true, akce: () => {
      const N = Math.max(1, +n.value || 3);
      const krok = body.length > 1 ? (body[body.length - 1][0] - body[0][0]) / (body.length - 1) : 1;
      const nf = P.S.stylBunky(l, r1, o.c1)?.nf;
      const nazevY = zahlavi ? String(P.S.hodnota(l, o.r1, o.c1 + 1)) : 'Hodnota';
      P.prikaz('List prognózy', () => {
        const nl = P.S.pridejList(P.S.aktivni - 1 < 0 ? 0 : P.S.aktivni - 1, P.S.volneJmenoListu('Prognóza'));
        const zdroj = jmenoListuVeVzorci(l.nazev) + '!';
        P.S.zadej(nl, 0, 0, zahlavi ? String(P.S.hodnota(l, o.r1, o.c1)) : 'Časová osa');
        P.S.zadej(nl, 0, 1, nazevY);
        P.S.zadej(nl, 0, 2, `Prognóza (${nazevY})`);
        body.forEach(([x, y], i) => { P.S.zapis(nl, i + 1, 0, { v: x, s: nf ? Object.freeze({ nf }) : null }); P.S.zapis(nl, i + 1, 1, { v: y }); });
        const posl = body.length;
        P.S.zapis(nl, posl, 2, { f: `=B${posl + 1}` });
        const xr = `$A$2:$A$${posl + 1}`, yr = `$B$2:$B$${posl + 1}`;
        for (let i = 1; i <= N; i++) {
          const r = posl + i;
          P.S.zapis(nl, r, 0, { v: body[body.length - 1][0] + krok * i, s: nf ? Object.freeze({ nf }) : null });
          P.S.zapis(nl, r, 2, { f: `=FORECAST.LINEAR(A${r + 1};${yr};${xr})`, s: Object.freeze({ nf: '0.00' }) });
        }
        P.S.vytvorTabulku(nl, { r1: 0, c1: 0, r2: posl + N, c2: 2 }, { styl: 'stredni2' });
        nl.sirky.set(0, 110); nl.sirky.set(1, 110); nl.sirky.set(2, 150);
        nl.grafy.push({ id: 'g' + Date.now().toString(36), typ: 'spojnicovyZnacky', zdroj: `${jmenoListuVeVzorci(nl.nazev)}!$A$1:$C$${posl + N + 1}`, radyVeSloupcich: true, x: 360, y: 10, w: 560, h: 320, nazev: `Prognóza: ${nazevY}` });
      });
      P.kresliListy(); P.grid.obnovPosun(); P.obnovObjekty(); P.poZmeneVyberu();
    } }, { text: 'Zrušit' }],
  });
}

export function dialogSouhrn(P) {
  const l = L(P), v = V(P);
  const o = P.S.aktualniOblast(l, v.r, v.c);
  const sloupce = Array.from({ length: o.c2 - o.c1 + 1 }, (_, i) => [o.c1 + i, String(P.S.hodnota(l, o.r1, o.c1 + i) ?? pismena(o.c1 + i))]);
  const podle = vyber(sloupce, o.c1);
  const fn = vyber([['9', 'Součet'], ['2', 'Počet'], ['1', 'Průměr'], ['4', 'Maximum'], ['5', 'Minimum']], '9');
  const cile = new Set([o.c2]);
  dialog(P.koren, {
    titulek: 'Souhrn', sirka: 380,
    obsah: el('div', {}, pole('U každé změny ve sloupci:', podle), pole('Použít funkci:', fn),
      el('small', { text: 'Přidat souhrn do sloupce:' }), el('div.tb-fb-list', {}, sloupce.map(([c, t]) => zaskrt(t, cile.has(c), (x) => { if (x) cile.add(c); else cile.delete(c); }).uzel))),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => {
      const c0 = +podle.value;
      P.prikaz('Souhrn', () => {
        let r = o.r1 + 1, zac = r, konec = o.r2;
        const nazevFn = { 9: 'Celkem', 2: 'Počet', 1: 'Průměr', 4: 'Max', 5: 'Min' }[fn.value];
        const souhrny = [];
        while (r <= konec + 1) {
          const akt = r <= konec ? P.S.hodnota(l, r, c0) : Symbol('konec');
          const pred = P.S.hodnota(l, zac, c0);
          if (r > konec || akt !== pred) {
            P.S.vloz(l, 'r', r, 1);
            P.S.zapis(l, r, c0, { v: `${pred} ${nazevFn}`, s: Object.freeze({ b: true }) });
            for (const c of cile) P.S.zapis(l, r, c, { f: `=SUBTOTAL(${fn.value};${textOblasti({ r1: zac, r2: r - 1, c1: c, c2: c })})`, s: Object.freeze({ b: true }) });
            souhrny.push(r);
            konec++;
            r++;
            zac = r;
          }
          r++;
        }
        P.S.vloz(l, 'r', konec + 1, 1);
        P.S.zapis(l, konec + 1, c0, { v: `Celkový ${nazevFn.toLocaleLowerCase('cs')}`, s: Object.freeze({ b: true }) });
        for (const c of cile) P.S.zapis(l, konec + 1, c, { f: `=SUBTOTAL(${fn.value};${textOblasti({ r1: o.r1 + 1, r2: konec, c1: c, c2: c })})`, s: Object.freeze({ b: true }) });
      });
    } }, { text: 'Zrušit' }],
  });
}

// ================================================================ Názory, možnosti
export function dialogNazory(P) {
  const t = stop(el('textarea.ps-vstup', { rows: 6, placeholder: 'Co se vám líbí, co byste zlepšili?' }));
  dialog(P.koren, { titulek: 'Názory na AstroTabulky', sirka: 420, obsah: el('div', {}, el('p', { text: 'Děkujeme, že nám pomáháte vylepšovat AstroTabulky.' }), t), tlacitka: [{ text: 'Odeslat', primarni: true, akce: () => P.toast('Děkujeme za zpětnou vazbu!') }, { text: 'Zrušit' }] });
}

export function dialogMoznosti(P) {
  const n = P.nastaveni();
  const jmeno = vstup({ value: n.jmeno || P.autor() });
  const motiv = vyber([['barevny', 'Barevný'], ['tmave-sedy', 'Tmavě šedý'], ['cerny', 'Černý'], ['bily', 'Bílý'], ['system', 'Použít nastavení systému']], n.motiv || 'barevny');
  const vypocet = vyber([['auto', 'Automaticky'], ['rucne', 'Ručně']], P.S.vypocet);
  const enter = vyber([['dolu', 'Dolů'], ['vpravo', 'Vpravo'], ['nahoru', 'Nahoru'], ['vlevo', 'Vlevo']], n.smerEnter || 'dolu');
  const dok = zaskrt('Povolit automatické dokončování hodnot buněk', n.dokoncovani !== false);
  const auto = zaskrt('Automaticky ukládat soubory uložené v AstroOS', !!n.autoUkladani);
  const chyby = zaskrt('Kontrola chyb na pozadí (zelené trojúhelníčky)', n.kontrolaChyb !== false);
  const umisteni = vstup({ value: n.umisteni || FS.HOME + '/Dokumenty' });
  const telo = el('div.tb-moznosti-telo');
  const karty = { obecne: ['Obecné', [el('h4', { text: 'Přizpůsobení kopie Microsoft 365' }), pole('Uživatelské jméno:', jmeno), pole('Motiv Office:', motiv)]], vzorce: ['Vzorce', [el('h4', { text: 'Možnosti výpočtů' }), pole('Výpočty v sešitu:', vypocet), chyby.uzel]], ulozit: ['Uložit', [auto.uzel, pole('Výchozí umístění místního souboru:', umisteni)]], upresnit: ['Upřesnit', [el('h4', { text: 'Možnosti úprav' }), pole('Po stisknutí klávesy Enter přesunout výběr:', enter), dok.uzel]] };
  const levy = el('div.tb-moznosti-menu', {}, Object.entries(karty).map(([k, [t]]) => el('button', { type: 'button', text: t, dataset: { k }, onclick: () => ukaz(k) })));
  const ukaz = (k) => { levy.querySelectorAll('button').forEach((b) => b.classList.toggle('aktivni', b.dataset.k === k)); telo.replaceChildren(...karty[k][1]); };
  ukaz('obecne');
  dialog(P.koren, {
    titulek: 'Možnosti aplikace AstroTabulky', sirka: 620, cls: 'tb-dlg-moznosti',
    obsah: el('div.tb-moznosti', {}, levy, telo),
    tlacitka: [{ text: 'OK', primarni: true, akce: () => {
      P.ulozNastaveni({ jmeno: jmeno.value.trim(), motiv: motiv.value, smerEnter: enter.value, dokoncovani: dok.c.checked, autoUkladani: auto.c.checked, kontrolaChyb: chyby.c.checked, umisteni: umisteni.value.trim() });
      P.moznostiVypoctu(vypocet.value);
      P.grid.kontrolaChyb = chyby.c.checked;
      P.grid.prekresli();
    } }, { text: 'Zrušit' }],
  });
}
