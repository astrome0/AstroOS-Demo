// AstroTabulky — podokna vpravo (AstroAI, Analyzovat data, Komentáře, Formát grafu, Pole kontingenční tabulky,
// Nápověda, Pravopis, Přístupnost, Kontrola chyb, Okno kukátka, Skripty, Podokno výběru) a drobné nástroje
// (kreslení perem, lupa na výběr, rychlá analýza, ukázkové skripty)

import { el } from '../util.js';
import { tt } from '../i18n.js';
import { ik } from '../pismo/ikony.js';
import { rozbal, zavriRozbal, nabidka, dialog, zprava, pole } from '../pismo/ui.js';
import { send, aktivniRezim } from '../ai.js';
import { klic, zKlice, MAX_R, MAX_C, adresa, textOblasti, rozeberOblast, pismena, jmenoListuVeVzorci, obsahuje } from './adresy.js';
import { formatuj, jeChyba, obecne, rozpoznej } from './format.js';
import { slozStyl } from './sesit.js';
import { FUNKCE, syntaxe, parse, vyhodnot } from './vzorce.js';
import { svgGrafu, dataGrafu, doporuceneGrafy, TYPY_GRAFU, PALETY } from './grafy.js';
import { vytvorKontingencni, zdrojKontingencni, kontingencniV, FUNKCE_HODNOT } from './kontingencni.js';
import * as D from './dialogy.js';

const NAZVY = {
  ai: 'AstroAI', analyza: 'Analyzovat data', komentare: 'Komentáře', formatGrafu: 'Formát oblasti grafu', pivot: 'Pole kontingenční tabulky',
  napoveda: 'Nápověda', pravopis: 'Pravopis', pristupnost: 'Přístupnost', chyby: 'Kontrola chyb', kukatko: 'Okno kukátka', skripty: 'Kódový editor',
  schranka: 'Schránka', vyber: 'Výběr',
};

export function pridejPodokna(P) {
  const g = P.grid;
  const L = () => P.S.list;
  const V = () => L().vyber;
  const uzel = P.podoknoUzel;
  let zruseni = null;

  P.podokno = (typ, o = {}) => {
    zruseni?.();
    zruseni = null;
    P.st.podokno = typ;
    if (!typ) { uzel.hidden = true; uzel.replaceChildren(); P.obnov?.(); g.prekresli(); return; }
    const telo = el('div.tb-pod-telo');
    uzel.replaceChildren(
      el('div.ps-pod-hlava', {}, el('span', { text: NAZVY[typ] || typ }), el('button.ps-dialog-x', { type: 'button', title: 'Zavřít', onclick: () => P.podokno(null) }, ik('zavrit'))),
      telo);
    uzel.hidden = false;
    uzel.dataset.typ = typ;
    const f = PODOKNA[typ];
    if (f) zruseni = f(P, telo, o) || null;
    P.obnov?.();
    g.prekresli();
  };
  P.zavriPodokna = () => { zruseni?.(); zruseni = null; };
  // podokna, která sledují výběr/data (volá je lepidlo v apps/tabulky.js)
  P.poZmeneVyberuPodokna = (t) => { if (t) return; P.podoknoPoVyberu?.(); automatickePivot(); };
  P.poZmeneDat = () => P.podoknoPoDatech?.();

  function automatickePivot() {
    const k = kontingencniV(L(), V().r, V().c);
    if (k && P.st.podokno !== 'pivot') P.podokno('pivot');
    else if (!k && P.st.podokno === 'pivot') P.podokno(null);
  }

  // ------------------------------------------------------------ drobné nástroje
  P.lupaNaVyber = () => {
    const o = V().oblasti.at(-1);
    g.geometrie();
    const w = g.osaS.pos(Math.min(o.c2, o.c1 + 200) + 1) - g.osaS.pos(o.c1);
    const h = g.osaR.pos(Math.min(o.r2, o.r1 + 2000) + 1) - g.osaR.pos(o.r1);
    const z = Math.max(0.1, Math.min(4, Math.min((g.sirka - g.zahlaviSirka - 20) / w, (g.vyska - g.zahlaviVyska - 20) / h)));
    P.lupa(+z.toFixed(2));
    g.nastavVyber(V().r, V().c, V().oblasti);
    g.scroll.scrollLeft = g.osaS.pos(o.c1) * z; g.scroll.scrollTop = g.osaR.pos(o.r1) * z;
  };
  P.pouzijNazev = (n) => {
    if (g.edit) { document.execCommand('insertText', false, n); return; }
    g.zacniEditaci('zadat', '=' + n);
  };
  P.zakrouzkovatNeplatna = () => {
    const l = L();
    g.sipky = g.sipky.filter((s) => !s.krouzek);
    let n = 0;
    for (const v of l.validace) {
      const o = v.oblast;
      const u = P.S.rozsah(l);
      for (let r = o.r1; r <= Math.min(o.r2, u.r); r++) for (let c = o.c1; c <= Math.min(o.c2, u.c); c++) {
        const t = g.textProEditaci.call({ S: P.S, list: l }, r, c);
        if (t === '') continue;
        if (P.S.overVstup(l, r, c, t)) { g.sipky.push({ list: l, z: { r1: r, c1: c, r2: r, c2: c }, do: { r1: r, c1: c, r2: r, c2: c }, oblast: true, barva: '#E0301E', krouzek: true }); n++; }
      }
    }
    g.prekresli();
    if (!n) P.toast('Všechna data odpovídají pravidlům ověření.');
  };
  P.dalsiPoznamka = (smer) => {
    const l = L(), v = V();
    const pozn = [...l.b].filter(([, b]) => b.pozn).map(([k]) => zKlice(k)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (!pozn.length) return;
    let i = pozn.findIndex(([r, c]) => r > v.r || (r === v.r && c > v.c));
    if (smer < 0) i = ((i < 0 ? pozn.length : i) - 1 - (pozn.some(([r, c]) => r === v.r && c === v.c) ? 1 : 0) + pozn.length * 2) % pozn.length;
    else if (i < 0) i = 0;
    const [r, c] = pozn[i];
    g.nastavVyber(r, c);
    g.ukazPoznamku(r, c, P.S.bunka(l, r, c));
  };
  P.prevestPoznamky = () => P.prikaz('Převést na komentáře', () => {
    for (const l of P.S.listy) for (const [k, b] of l.b) if (b.pozn) { const [r, c] = zKlice(k); P.S.zapis(l, r, c, { ...b, pozn: null, kom: { vlakno: [{ autor: b.pozn.autor || P.autor(), text: b.pozn.text, cas: Date.now() }] } }); }
  }, { prepocet: false });
  P.poradiObjektu = (smer) => {
    const o = P.st.objekt && P.najdiObjekt(P.st.objekt.id);
    if (!o) return;
    P.prikaz('Pořadí', () => {
      const l = L();
      const pole1 = l.obrazky.includes(o) ? 'obrazky' : 'grafy';
      const x = l[pole1].find((y) => y.id === o.id);
      l[pole1] = smer > 0 ? [...l[pole1].filter((y) => y !== x), x] : [x, ...l[pole1].filter((y) => y !== x)];
    }, { prepocet: false });
  };
  P.aktualizujKontingencni = () => {
    let n = 0;
    P.prikaz('Aktualizovat', () => { for (const l of P.S.listy) for (const k of l.kontingencni || []) { vytvorKontingencni(P.S, l, k); n++; } });
    if (n) P.toast(`Aktualizováno kontingenčních tabulek: ${n}`);
  };
  P.aktualizujWeb = () => {};
  P.seskupit = () => zprava(P.koren, 'Seskupení řádků zatím AstroTabulky neumí — použijte Data › Souhrn nebo skrytí řádků (Ctrl+9).');

  // ------------------------------------------------------------ kreslení perem
  let kresliciVrstva = null;
  P.kreslit = (nastroj) => {
    P.st.kresleni = nastroj;
    if (!nastroj) { kresliciVrstva?.remove(); kresliciVrstva = null; P.obnov(); P.obnovKresbu(); return; }
    if (!kresliciVrstva) {
      kresliciVrstva = el('div.tb-kresleni-vrstva');
      g.uzel.append(kresliciVrstva);
      kresliciVrstva.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const n = P.st.kresleni;
        if (!n) return;
        const r = g.scroll.getBoundingClientRect();
        const bod = (ev) => {
          const x = ev.clientX - r.left, y = ev.clientY - r.top;
          const lx = x < g.x0 ? (x - g.zahlaviSirka) / g.z + g.osaS.pos(g.c0) : (x - g.x0 + g.scroll.scrollLeft) / g.z + g.osaS.pos(g.fc);
          const ly = y < g.y0 ? (y - g.zahlaviVyska) / g.z + g.osaR.pos(g.r0) : (y - g.y0 + g.scroll.scrollTop) / g.z + g.osaR.pos(g.fr);
          return [Math.round(lx * 10) / 10, Math.round(ly * 10) / 10];
        };
        if (n.guma) {
          const [x, y] = bod(e);
          const tah = (L().kresba || []).findIndex((t) => t.body.some(([a, b]) => Math.hypot(a - x, b - y) < 8));
          if (tah >= 0) P.prikaz('Guma', () => { L().kresba.splice(tah, 1); }, { prepocet: false });
          P.obnovKresbu();
          return;
        }
        const t = { barva: n.barva, sirka: n.sirka, zvyr: !!n.zvyraznovac, body: [bod(e)] };
        const docasny = { ...t };
        (L().kresba ||= []).push(docasny);
        const mv = (ev) => { docasny.body.push(bod(ev)); P.obnovKresbu(); };
        const up = () => {
          removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
          L().kresba = L().kresba.filter((x) => x !== docasny);
          if (docasny.body.length > 1) P.prikaz('Kreslení', () => { (L().kresba ||= []).push({ ...docasny }); }, { prepocet: false });
          P.obnovKresbu();
        };
        addEventListener('pointermove', mv); addEventListener('pointerup', up);
      });
      kresliciVrstva.addEventListener('wheel', (e) => { g.scroll.scrollTop += e.deltaY; g.scroll.scrollLeft += e.deltaX; }, { passive: true });
    }
    kresliciVrstva.style.cursor = nastroj.guma ? 'cell' : 'crosshair';
    P.obnov();
  };
  const svgKresby = el('div.tb-kresba');
  g.objekty.append(svgKresby);
  P.obnovKresbu = () => {
    const k = L().kresba || [];
    if (!k.length) { svgKresby.innerHTML = ''; return; }
    g.geometrie();
    const sx = (x) => (x < g.osaS.pos(g.fc) && g.fc > g.c0 ? g.zahlaviSirka + (x - g.osaS.pos(g.c0)) * g.z : g.x0 + (x - g.osaS.pos(g.fc)) * g.z - g.scroll.scrollLeft);
    const sy = (y) => (y < g.osaR.pos(g.fr) && g.fr > g.r0 ? g.zahlaviVyska + (y - g.osaR.pos(g.r0)) * g.z : g.y0 + (y - g.osaR.pos(g.fr)) * g.z - g.scroll.scrollTop);
    svgKresby.innerHTML = `<svg width="100%" height="100%">${k.map((t) => `<path d="M${t.body.map(([x, y]) => `${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`).join('L')}" fill="none" stroke="${t.barva}" stroke-width="${t.sirka * g.z}" stroke-linecap="round" stroke-linejoin="round" ${t.zvyr ? 'opacity=".45"' : ''}/>`).join('')}</svg>`;
  };
  const puvodniPosun = P.poPosunu;
  P.poPosunu = () => { puvodniPosun?.(); P.obnovKresbu(); };
  const puvodniObjekty = P.obnovObjekty;
  P.obnovObjekty = () => { puvodniObjekty?.(); P.obnovKresbu(); };

  // ------------------------------------------------------------ rychlá analýza (Ctrl+Q)
  P.rychlaAnalyza = () => {
    const o = V().oblasti.at(-1);
    if (o.r1 === o.r2 && o.c1 === o.c2) { zprava(P.koren, 'Rychlá analýza potřebuje vybranou oblast s daty.'); return; }
    const karty = [['format', 'Formátování'], ['grafy', 'Grafy'], ['souhrny', 'Souhrny'], ['tabulky', 'Tabulky'], ['minigrafy', 'Minigrafy']];
    const telo = el('div.tb-ra-telo');
    const tl = (ikona, text, akce) => el('button.tb-ra-tl', { type: 'button', onclick: () => { zavriRozbal(); akce(); } }, ik(ikona), el('span', { text }));
    const obsah = {
      format: () => [tl('grafPruhy', 'Datové pruhy', () => P.podminene({ typ: 'pruh', barva: '#638EC6' })), tl('zmenitBarvy', 'Barevná škála', () => P.podminene({ typ: 'skala', barvy: ['#F8696B', '#FFEB84', '#63BE7B'] })), tl('podminene', 'Sada ikon', () => P.podminene({ typ: 'ikony', sada: 'sipky3' })), tl('seraditZA', 'Větší než', () => D.dialogPodminka(P, 'vetsi')), tl('statistika', 'Prvních 10 %', () => P.podminene({ typ: 'prvni', pocet: 10, procenta: true, styl: { pozadi: '#FFC7CE', barva: '#9C0006' } })), tl('vymazat', 'Vymazat formát', () => P.vymazatPodminene('vyber'))],
      grafy: () => { const d = dataGrafu(P.S, L(), { zdroj: jmenoListuVeVzorci(L().nazev) + '!' + textOblasti(o, true), radyVeSloupcich: true }); return doporuceneGrafy(d).slice(0, 5).map((t) => { const x = TYPY_GRAFU.find((y) => y.id === t); return tl(x.ikona, x.nazev, () => P.vlozGraf(t, { zdroj: o })); }); },
      souhrny: () => ['SUMA', 'PRŮMĚR', 'POČET', 'MAX', 'MIN'].map((f) => tl('autoSuma', { SUMA: 'Součet', PRŮMĚR: 'Průměr', POČET: 'Počet', MAX: 'Maximum', MIN: 'Minimum' }[f], () => { g.vyberOblast(o); P.autoSuma(f); })),
      tabulky: () => [tl('tabulkaVelka', 'Tabulka', () => { g.vyberOblast(o); D.dialogVytvoritTabulku(P); }), tl('kontingencni', 'Kontingenční tabulka', () => { g.vyberOblast(o); D.dialogKontingencni(P, { doporucene: true }); })],
      minigrafy: () => [tl('minigrafCara', 'Spojnicový', () => D.dialogMinigrafy(P, 'cara')), tl('minigrafSloupec', 'Sloupcový', () => D.dialogMinigrafy(P, 'sloupec')), tl('minigrafZtrata', 'Zisk/ztráta', () => D.dialogMinigrafy(P, 'ztrata'))],
    };
    const zal = el('div.tb-ra-zalozky', {}, karty.map(([k, t]) => el('button', { type: 'button', text: t, dataset: { k }, onclick: () => ukaz(k) })));
    const ukaz = (k) => { zal.querySelectorAll('button').forEach((b) => b.classList.toggle('aktivni', b.dataset.k === k)); telo.replaceChildren(...obsah[k]()); };
    ukaz('format');
    const r = g.obdelnik(o) || { x: 100, y: 100, w: 0, h: 0 };
    const sr = g.scroll.getBoundingClientRect();
    const kotva = el('div', { style: { position: 'fixed', left: (sr.left + Math.min(g.sirka - 40, r.x + r.w)) + 'px', top: (sr.top + Math.min(g.vyska - 20, r.y + r.h)) + 'px', width: '1px', height: '1px' } });
    document.body.append(kotva);
    rozbal(kotva, el('div.tb-rychla-analyza', {}, zal, telo, el('p.tb-fb-popis', { text: 'Rychlá analýza použije nejčastější nástroje na vybraná data.' })), { poZavreni: () => kotva.remove(), app: 'tabulky' });
  };

  // ------------------------------------------------------------ skripty (Automatizovat)
  P.UKAZKOVE_SKRIPTY = UKAZKOVE;
  P.spustSkript = (kod, nazev = 'Skript') => {
    const api = rozhraniSkriptu(P);
    try {
      let vystup = [];
      api.vypis = (...x) => vystup.push(x.map(String).join(' '));
      P.prikaz(nazev, () => { new Function('sesit', 'list', 'vypis', kod)(api, api.aktivniList(), api.vypis); });
      P.toast(`Skript „${nazev}“ doběhl.`);
      return vystup;
    } catch (e) {
      zprava(P.koren, `Skript „${nazev}“ skončil chybou:\n\n${e.message}`);
      return [String(e.message)];
    }
  };
}

// ---------------------------------------------------------------- API pro skripty
function rozhraniSkriptu(P) {
  const S = P.S;
  const listApi = (l) => ({
    nazev: l.nazev,
    hodnota: (a) => { const o = rozeberOblast(a); return S.hodnota(l, o.r1, o.c1); },
    text: (a) => { const o = rozeberOblast(a); return S.textBunky(l, o.r1, o.c1); },
    nastav: (a, v) => { const o = rozeberOblast(a); S.zadej(l, o.r1, o.c1, typeof v === 'number' ? obecne(v, 15) : String(v)); },
    styl: (a, z) => { const o = rozeberOblast(a); S.stylOblasti(l, [o], z); },
    oblast: (a) => { const o = rozeberOblast(a); const out = []; for (let r = o.r1; r <= o.r2; r++) { const x = []; for (let c = o.c1; c <= o.c2; c++) x.push(S.hodnota(l, r, c)); out.push(x); } return out; },
    pouzitaOblast: () => { const u = S.rozsahDat(l); return u.r < 0 ? null : textOblasti({ r1: 0, c1: 0, r2: u.r, c2: u.c }); },
    posledniRadek: () => S.rozsahDat(l).r + 1,
    posledniSloupec: () => S.rozsahDat(l).c + 1,
    vlozRadky: (od, n = 1) => S.vloz(l, 'r', od - 1, n),
    odstranRadky: (od, n = 1) => S.vloz(l, 'r', od - 1, -n),
    serad: (a, sloupec, vzestupne = true) => { const o = rozeberOblast(a); S.serad(l, o, [{ c: o.c1 + sloupec - 1, vzestupne }], { zahlavi: true }); },
    sirka: (sloupec, px) => l.sirky.set(typeof sloupec === 'string' ? rozeberOblast(sloupec + '1').c1 : sloupec - 1, px),
    ukotvitRadek: () => { l.ukotveni = { r: 1, c: 0, r0: 0, c0: 0 }; },
    vyber: () => textOblasti(l.vyber.oblasti.at(-1)),
  });
  return {
    aktivniList: () => listApi(S.list),
    list: (n) => { const l = S.listPodleJmena(n); return l ? listApi(l) : null; },
    listy: () => S.listy.map((l) => l.nazev),
    pridejList: (n) => listApi(S.pridejList(S.aktivni, n || S.volneJmenoListu())),
  };
}

const UKAZKOVE = [
  { nazev: 'Zvýraznit prázdné buňky', popis: 'Obarví prázdné buňky v použité oblasti žlutě.', kod: `const o = list.pouzitaOblast();
if (!o) return;
const data = list.oblast(o);
const [zac] = o.split(':');
const c0 = zac.replace(/\\d+/g, '').charCodeAt(0) - 65;
data.forEach((radek, r) => radek.forEach((v, c) => {
  if (v === null) list.styl(String.fromCharCode(65 + c0 + c) + (r + 1), { pozadi: '#FFF2CC' });
}));` },
  { nazev: 'Odstranit prázdné řádky', popis: 'Smaže řádky, které jsou v použité oblasti úplně prázdné.', kod: `const posledni = list.posledniRadek();
for (let r = posledni; r >= 1; r--) {
  const radek = list.oblast('A' + r + ':Z' + r)[0];
  if (radek.every((v) => v === null)) list.odstranRadky(r);
}` },
  { nazev: 'Formátovat záhlaví', popis: 'První řádek tučně, zelené pozadí, ukotvený a širší sloupce.', kod: `const n = list.posledniSloupec();
for (let c = 0; c < n; c++) {
  const a = String.fromCharCode(65 + c) + '1';
  list.styl(a, { b: true, pozadi: '#107C41', barva: '#FFFFFF' });
  list.sirka(c + 1, 110);
}
list.ukotvitRadek();` },
  { nazev: 'Očíslovat řádky', popis: 'Do sloupce A vloží pořadová čísla (posune data doprava).', kod: `const posledni = list.posledniRadek();
for (let r = 1; r <= posledni; r++) {
  list.nastav('A' + r, r === 1 ? '#' : r - 1);
}` },
  { nazev: 'Přidat datum a čas', popis: 'Do vybrané buňky zapíše aktuální datum a čas.', kod: `const a = list.vyber().split(':')[0];
list.nastav(a, new Date().toLocaleString('cs-CZ'));` },
  { nazev: 'Text na čísla', popis: 'Převede čísla uložená jako text v použité oblasti na skutečná čísla.', kod: `const o = list.pouzitaOblast();
if (!o) return;
const data = list.oblast(o);
let n = 0;
data.forEach((radek, r) => radek.forEach((v, c) => {
  if (typeof v === 'string' && /^\\s*-?[\\d\\s]+([.,]\\d+)?\\s*$/.test(v)) { list.nastav(String.fromCharCode(65 + c) + (r + 1), v.trim()); n++; }
}));
vypis('Převedeno buněk:', n);` },
];

// ---------------------------------------------------------------- jednotlivá podokna
const PODOKNA = {
  // ---------- AstroAI (jako Copilot v Excelu)
  ai(P, telo) {
    const zpravy = [];
    const vypis = el('div.tb-ai-zpravy');
    const vstup = el('textarea.ps-vstup.tb-ai-vstup', { rows: 3, placeholder: 'Zeptejte se na data v tomto listu…' });
    const stav = el('div.tb-ai-stav');
    let rizeni = null;
    const navrhy = ['Shrň data na tomto listu', 'Jaký vzorec sečte sloupec B?', 'Najdi nejvyšší hodnotu', 'Navrhni graf pro tato data', 'Zvýrazni duplicitní hodnoty'];
    const bublina = (role, text) => {
      const b = el('div.tb-ai-bublina.' + role);
      b.innerHTML = md(text);
      vypis.append(b);
      vypis.scrollTop = vypis.scrollHeight;
      return b;
    };
    const akceVzorce = (b, text) => {
      const vzorce = [...new Set((text.match(/=[A-ZÁ-Ž][A-ZÁ-Ž0-9.]*\([^\n`]*\)/g) || []).map((x) => x.trim()))];
      for (const f of vzorce.slice(0, 3)) b.append(el('button.ps-tlac.tb-ai-vlozit', { type: 'button', onclick: () => { const v = P.S.list.vyber; P.prikaz('AstroAI', () => P.S.zadej(P.S.list, v.r, v.c, f)); } }, 'Vložit ', el('code', { text: f }), ` do ${adresa(P.S.list.vyber.r, P.S.list.vyber.c)}`));
    };
    const posli = async (text) => {
      if (!text.trim()) return;
      vstup.value = '';
      bublina('ja', text);
      zpravy.push({ role: 'user', content: text });
      const b = bublina('ai', '…');
      stav.textContent = 'AstroAI přemýšlí…';
      let odpoved = '';
      rizeni = new AbortController();
      try {
        const rezim = (await aktivniRezim()).rezim;
        if (rezim === 'server') {
          const kontext = kontextListu(P);
          const dotaz = `Jsi pomocník v tabulkovém procesoru AstroTabulky (česká obdoba Excelu). Vzorce piš česky se středníky, např. =SUMA(B2:B10), =KDYŽ(A2>5;"ano";"ne"), =SVYHLEDAT(...). Odpovídej stručně, ve stejném jazyce, jakým je položená otázka.\n\nData listu „${P.S.list.nazev}“ (CSV, první řádek = řádek 1):\n${kontext}\n\nOtázka: ${text}`;
          const t0 = Date.now();
          const cekani = setTimeout(() => { stav.textContent = 'Model počítá…'; }, 6000);
          const r = await send([...zpravy.slice(0, -1), { role: 'user', content: dotaz }], { signal: rizeni.signal, onToken: (k) => { odpoved += k; b.innerHTML = md(odpoved); vypis.scrollTop = vypis.scrollHeight; } });
          clearTimeout(cekani);
          odpoved = r.text;
          stav.textContent = `Model · ${((Date.now() - t0) / 1000).toFixed(0)} s`;
        } else {
          odpoved = mistniAsistent(P, text);
          b.innerHTML = '';
          for (const slovo of odpoved.match(/\S+\s*/g) || []) { if (rizeni.signal.aborted) break; b.innerHTML = md((b.dataset.t = (b.dataset.t || '') + slovo)); await new Promise((x) => setTimeout(x, 18)); }
          stav.textContent = 'Místní režim (lokální model neběží)';
        }
      } catch (e) {
        if (e.name !== 'AbortError') { odpoved = mistniAsistent(P, text); stav.textContent = 'Místní režim (model není dostupný)'; }
      }
      b.innerHTML = md(odpoved);
      akceVzorce(b, odpoved);
      zpravy.push({ role: 'assistant', content: odpoved });
      vypis.scrollTop = vypis.scrollHeight;
    };
    vstup.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); posli(vstup.value); } });
    vypis.append(el('div.tb-ai-uvod', {}, el('div.tb-ai-logo', {}, ik('astroai')), el('h3', { text: 'Ahoj! S čím s daty pomůžu?' }), el('p', { text: 'Umím shrnout list, najít nejvyšší hodnoty, navrhnout vzorec nebo graf. Když běží lokální model, odpovídá AstroAI; jinak odpovídá místní pomocník.' }),
      el('div.tb-ai-navrhy', {}, navrhy.map((n) => el('button', { type: 'button', text: n, onclick: () => posli(n) })))));
    telo.append(vypis, stav, el('div.tb-ai-dole', {}, vstup, el('button.ps-tlac.primarni', { type: 'button', text: 'Odeslat', onclick: () => posli(vstup.value) })));
    setTimeout(() => vstup.focus(), 50);
    return () => rizeni?.abort();
  },

  // ---------- Analyzovat data
  analyza(P, telo) {
    const kresli = () => {
      const l = P.S.list, v = l.vyber;
      const o = P.S.aktualniOblast(l, v.r, v.c);
      const z = zdrojKontingencni(P.S, { zdroj: jmenoListuVeVzorci(l.nazev) + '!' + textOblasti(o, true) });
      if (!z || z.radky.length < 2) { telo.replaceChildren(el('div.tb-an-prazdne', {}, ik('analyzovat'), el('p', { text: 'Klikněte do oblasti s daty se záhlavím (aspoň dva řádky) a AstroTabulky navrhnou přehledy, grafy a kontingenční tabulky.' }))); return; }
      const cisla = z.pole.filter((p) => p.cisla), texty = z.pole.filter((p) => !p.cisla);
      const karty = [];
      for (const p of cisla.slice(0, 4)) {
        const x = z.radky.map((r) => r[p.i]).filter((q) => typeof q === 'number');
        const suma = x.reduce((a, b) => a + b, 0);
        karty.push(el('div.tb-an-karta', {}, el('b', { text: p.nazev }), el('div.tb-an-cisla', {},
          el('span', {}, el('small', { text: 'Součet' }), formatuj(suma, p.nf).text), el('span', {}, el('small', { text: 'Průměr' }), formatuj(suma / (x.length || 1), p.nf).text || obecne(suma / (x.length || 1))),
          el('span', {}, el('small', { text: 'Min' }), formatuj(Math.min(...x), p.nf).text), el('span', {}, el('small', { text: 'Max' }), formatuj(Math.max(...x), p.nf).text))));
      }
      // nejvyšší podle první textové kategorie
      if (texty.length && cisla.length) {
        const t = texty[0], c = cisla[0];
        const souhrn = new Map();
        for (const r of z.radky) { const k = String(r[t.i] ?? '(prázdné)'); souhrn.set(k, (souhrn.get(k) || 0) + (typeof r[c.i] === 'number' ? r[c.i] : 0)); }
        const serazene = [...souhrn].sort((a, b) => b[1] - a[1]);
        const nej = serazene[0];
        const def = { zdroj: jmenoListuVeVzorci(l.nazev) + '!' + textOblasti(o, true), radky: [t.nazev], hodnoty: [{ pole: c.nazev, fn: 'SUMA' }] };
        const mini = { id: 'an1', typ: serazene.length <= 6 ? 'vysecovy' : 'sloupcovy', paleta: 'barevne' };
        const dataMini = { kategorie: serazene.slice(0, 8).map((x) => x[0]), rady: [{ nazev: `${c.nazev} podle ${t.nazev}`, hodnoty: serazene.slice(0, 8).map((x) => x[1]), nf: c.nf }] };
        karty.unshift(el('div.tb-an-karta.hlavni', {},
          el('p', {}, `Nejvyšší ${c.nazev.toLocaleLowerCase('cs')} má `, el('b', { text: nej[0] }), ` (${formatuj(nej[1], c.nf).text || obecne(nej[1])}).`),
          el('div.tb-an-graf', { html: svgGrafu({ ...mini, nazev: `${c.nazev} podle ${t.nazev}` }, dataMini, 280, 180) }),
          el('div.tb-an-tl', {},
            el('button.ps-tlac', { type: 'button', text: '+ Vložit kontingenční tabulku', onclick: () => {
              return P.toast('Kontingenční tabulky jsou jen v plné verzi AstroOS.');   // ukázková verze
              P.prikaz('Kontingenční tabulka', () => { const nl = P.S.pridejList(P.S.aktivni); const d = { id: 'k' + Date.now().toString(36), nazev: 'Analýza', ...def, sloupce: [], filtry: [], r: 2, c: 0 }; nl.kontingencni = [d]; vytvorKontingencni(P.S, nl, d); });
              P.kresliListy(); P.grid.obnovPosun(); P.obnovObjekty();
            } }),
            el('button.ps-tlac', { type: 'button', text: '+ Vložit graf', onclick: () => P.vlozGraf(null, { zdroj: o }) }))));
      }
      telo.replaceChildren(el('p.tb-an-uvod', {}, 'Tady jsou přehledy pro oblast ', el('b', { text: textOblasti(o) }), ` (${z.radky.length} řádků, ${z.pole.length} sloupců).`), ...karty,
        el('div.tb-an-dotaz', {}, el('button.ps-tlac', { type: 'button', text: 'Zeptat se AstroAI na data…', onclick: () => P.podokno('ai') })));
    };
    kresli();
    P.podoknoPoVyberu = kresli;
    return () => { P.podoknoPoVyberu = null; };
  },

  // ---------- Komentáře (vlákna)
  komentare(P, telo, o) {
    const kresli = () => {
      const vse = P.vsechnyKomentare();
      const v = P.S.list.vyber;
      const nove = el('div.tb-kom-novy');
      const b = P.S.bunka(P.S.list, v.r, v.c);
      if (o.novy && !b?.kom) {
        const t = el('textarea.ps-vstup', { rows: 3, placeholder: 'Začněte konverzaci. Pomocí @ někoho zmiňte.' });
        t.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && e.ctrlKey) odeslat.click(); });
        const odeslat = el('button.ps-tlac.primarni', { type: 'button', text: 'Publikovat', onclick: () => {
          if (!t.value.trim()) return;
          P.prikaz('Nový komentář', () => { const x = P.S.list.b.get(klic(v.r, v.c)) || {}; P.S.zapis(P.S.list, v.r, v.c, { ...x, kom: { vlakno: [{ autor: P.autor(), text: t.value.trim(), cas: Date.now() }] } }); }, { prepocet: false });
          o.novy = false;
          kresli();
        } });
        nove.append(el('div.tb-kom-karta.aktivni', {}, el('div.tb-kom-hlava', {}, el('span.ps-avatar.maly', { text: P.inicialy() }), el('b', { text: P.autor() }), el('small', { text: adresa(v.r, v.c) })), t, el('div.tb-kom-tl', {}, el('button.ps-tlac', { type: 'button', text: 'Zrušit', onclick: () => { o.novy = false; kresli(); } }), odeslat)));
        setTimeout(() => t.focus(), 40);
      }
      telo.replaceChildren(nove, ...vse.map((x) => {
        const aktivni = x.l === P.S.list && x.r === v.r && x.c === v.c;
        const k = x.b.kom;
        const odpoved = el('input.ps-vstup', { placeholder: 'Odpovědět' });
        odpoved.addEventListener('keydown', (e) => {
          e.stopPropagation();
          if (e.key === 'Enter' && odpoved.value.trim()) P.prikaz('Odpověď', () => { const bb = x.l.b.get(klic(x.r, x.c)); P.S.zapis(x.l, x.r, x.c, { ...bb, kom: { ...bb.kom, vlakno: [...bb.kom.vlakno, { autor: P.autor(), text: odpoved.value.trim(), cas: Date.now() }] } }); }, { prepocet: false }), kresli();
        });
        return el('div.tb-kom-karta' + (aktivni ? '.aktivni' : '') + (k.vyreseno ? '.vyreseno' : ''), { onclick: (e) => { if (e.target.closest('input, button')) return; if (x.l !== P.S.list) P.prepniNaList(x.l); P.grid.nastavVyber(x.r, x.c); } },
          el('div.tb-kom-misto', { text: `${x.l.nazev} · ${adresa(x.r, x.c)}` }),
          ...k.vlakno.map((z) => el('div.tb-kom-zprava', {}, el('div.tb-kom-hlava', {}, el('span.ps-avatar.maly', { text: z.autor.split(/\s+/).map((s) => s[0]).join('').slice(0, 2).toUpperCase() }), el('b', { text: z.autor }), el('small', { text: new Date(z.cas).toLocaleString('cs-CZ') })), el('p', { text: z.text }))),
          aktivni ? odpoved : null,
          el('div.tb-kom-tl', {},
            el('button.ps-zk-odkaz', { type: 'button', text: k.vyreseno ? 'Znovu otevřít vlákno' : 'Vyřešit vlákno', onclick: () => { P.prikaz('Vyřešit', () => { const bb = x.l.b.get(klic(x.r, x.c)); P.S.zapis(x.l, x.r, x.c, { ...bb, kom: { ...bb.kom, vyreseno: !bb.kom.vyreseno } }); }, { prepocet: false }); kresli(); } }),
            el('button.ps-zk-odkaz', { type: 'button', text: 'Odstranit vlákno', onclick: () => { P.prikaz('Odstranit komentář', () => { const bb = x.l.b.get(klic(x.r, x.c)); P.S.zapis(x.l, x.r, x.c, { ...bb, kom: null }); }, { prepocet: false }); kresli(); } })));
      }), !vse.length && !o.novy ? el('div.tb-an-prazdne', {}, ik('komentar'), el('p', { text: 'Zatím tu nejsou žádné komentáře. Vyberte buňku a klikněte na Nový komentář.' }), el('button.ps-tlac.primarni', { type: 'button', text: 'Nový komentář', onclick: () => { o.novy = true; kresli(); } })) : null);
    };
    kresli();
    P.podoknoPoVyberu = kresli;
    return () => { P.podoknoPoVyberu = null; };
  },

  // ---------- Formát grafu
  formatGrafu(P, telo) {
    const kresli = () => {
      const gr = P.vybranyGraf();
      if (!gr) { telo.replaceChildren(el('p.tb-fb-popis', { text: 'Vyberte graf na listu.' })); return; }
      const sekce = (nazev, ...obsah) => el('details.tb-sekce', { open: true }, el('summary', { text: nazev }), ...obsah);
      const vstupNazev = el('input.ps-vstup', { value: gr.nazev ?? '', placeholder: 'Název grafu (automaticky)' });
      vstupNazev.addEventListener('keydown', (e) => e.stopPropagation());
      vstupNazev.onchange = () => P.upravGraf({ nazev: vstupNazev.value || undefined }, 'Název grafu');
      const osaX = el('input.ps-vstup', { value: gr.nazevOsyX || '', placeholder: 'bez názvu' }), osaY = el('input.ps-vstup', { value: gr.nazevOsyY || '', placeholder: 'bez názvu' });
      [osaX, osaY].forEach((i) => i.addEventListener('keydown', (e) => e.stopPropagation()));
      osaX.onchange = () => P.upravGraf({ nazevOsyX: osaX.value || null }, 'Název osy');
      osaY.onchange = () => P.upravGraf({ nazevOsyY: osaY.value || null }, 'Název osy');
      const min = el('input.ps-vstup.kratky', { value: gr.osaMin ?? '', placeholder: 'Automaticky' }), max = el('input.ps-vstup.kratky', { value: gr.osaMax ?? '', placeholder: 'Automaticky' });
      [min, max].forEach((i) => i.addEventListener('keydown', (e) => e.stopPropagation()));
      min.onchange = () => P.upravGraf({ osaMin: min.value === '' ? null : rozpoznej(min.value).v }, 'Meze osy');
      max.onchange = () => P.upravGraf({ osaMax: max.value === '' ? null : rozpoznej(max.value).v }, 'Meze osy');
      const mezera = el('input', { type: 'range', min: 0, max: 500, value: gr.sirkaMezery ?? 219, onchange: (e) => P.upravGraf({ sirkaMezery: +e.target.value }, 'Šířka mezery') });
      const legenda = el('select.ps-vyber', { onchange: (e) => P.upravGraf({ legenda: e.target.value || null }, 'Legenda') }, [['', 'Žádná'], ['dole', 'Dole'], ['nahore', 'Nahoře'], ['vpravo', 'Vpravo'], ['vlevo', 'Vlevo']].map(([v, t]) => el('option', { value: v, text: t, selected: (gr.legenda ?? 'dole') === v })));
      const d = dataGrafu(P.S, P.S.list, gr);
      telo.replaceChildren(
        sekce('Název a legenda', pole('Název grafu:', vstupNazev), pole('Legenda:', legenda)),
        sekce('Osy', pole('Název vodorovné osy:', osaX), pole('Název svislé osy:', osaY), el('div.tb-radek-dlg', {}, pole('Minimum:', min), pole('Maximum:', max))),
        sekce('Řady', pole('Šířka mezery (%):', mezera), ...d.rady.map((r, i) => el('label.ps-nab-polozka.ps-vlastni-barva', {}, el('span.ps-barva-vzor', { style: { background: gr.barvyRad?.[i] || (PALETY[gr.paleta || 'barevne'])[i % 6] } }), el('span', { text: r.nazev }), el('input', { type: 'color', onchange: (e) => { const b = [...(gr.barvyRad || [])]; b[i] = e.target.value; P.upravGraf({ barvyRad: b }, 'Barva řady'); } })))),
        sekce('Oblast grafu', el('label.ps-nab-polozka.ps-vlastni-barva', {}, el('span.ps-barva-vzor', { style: { background: gr.pozadi || '#fff' } }), el('span', { text: 'Barva pozadí' }), el('input', { type: 'color', onchange: (e) => P.upravGraf({ pozadi: e.target.value }, 'Výplň grafu') })),
          el('label.ps-zaskrt', {}, el('input', { type: 'checkbox', checked: gr.bezOkraje || null, onchange: (e) => P.upravGraf({ bezOkraje: e.target.checked }, 'Obrys') }), el('span', { text: 'Bez ohraničení' }))));
    };
    kresli();
    P.podoknoPoDatech = kresli;
    return () => { P.podoknoPoDatech = null; };
  },

  // ---------- Pole kontingenční tabulky
  pivot(P, telo) {
    const kresli = () => {
      const l = P.S.list, v = l.vyber;
      const k = kontingencniV(l, v.r, v.c);
      if (!k) { telo.replaceChildren(el('p.tb-fb-popis', { text: 'Vyberte buňku v kontingenční tabulce.' })); return; }
      const z = zdrojKontingencni(P.S, k);
      if (!z) return;
      const uloz = (fn) => { P.prikaz('Pole kontingenční tabulky', () => { const x = l.kontingencni.find((y) => y.id === k.id); fn(x); vytvorKontingencni(P.S, l, x); }); };
      const vPouziti = (n) => k.radky.includes(n) || k.sloupce.includes(n) || k.hodnoty.some((h) => h.pole === n) || k.filtry.some((f) => f.pole === n);
      const hledat = el('input.ps-vstup', { placeholder: 'Hledat' });
      hledat.addEventListener('keydown', (e) => e.stopPropagation());
      const pole1 = el('div.tb-pivot-pole');
      const kresliPole = () => pole1.replaceChildren(...z.pole.filter((p) => !hledat.value || p.nazev.toLocaleLowerCase('cs').includes(hledat.value.toLocaleLowerCase('cs'))).map((p) => el('label.ps-zaskrt', {}, el('input', {
        type: 'checkbox', checked: vPouziti(p.nazev) || null,
        onchange: (e) => uloz((x) => {
          if (e.target.checked) { if (p.cisla) x.hodnoty.push({ pole: p.nazev, fn: 'SUMA' }); else x.radky.push(p.nazev); }
          else { x.radky = x.radky.filter((y) => y !== p.nazev); x.sloupce = x.sloupce.filter((y) => y !== p.nazev); x.hodnoty = x.hodnoty.filter((y) => y.pole !== p.nazev); x.filtry = x.filtry.filter((y) => y.pole !== p.nazev); }
        }),
      }), el('span', { text: p.nazev }))));
      hledat.oninput = kresliPole;
      kresliPole();
      const oblast = (nazev, klic1) => {
        const polozky = klic1 === 'hodnoty' ? k.hodnoty.map((h) => ({ n: h.pole, t: `${FUNKCE_HODNOT[h.fn].nazev} z ${h.pole}`, h })) : k[klic1].map((x) => (klic1 === 'filtry' ? { n: x.pole, t: x.pole, f: x } : { n: x, t: x }));
        return el('div.tb-pivot-oblast', {}, el('small', { text: nazev }), el('div.tb-pivot-seznam', {}, polozky.map((p) => {
          const b = el('button.tb-pivot-pol', { type: 'button' }, el('span', { text: p.t }), ik('sipkaDolu'));
          b.onclick = () => rozbal(b, nabidka([
            ...['filtry', 'sloupce', 'radky', 'hodnoty'].filter((x) => x !== klic1).map((x) => ({ text: { filtry: 'Přesunout do filtru sestavy', sloupce: 'Přesunout do popisků sloupců', radky: 'Přesunout do popisků řádků', hodnoty: 'Přesunout do hodnot' }[x], akce: () => uloz((y) => {
              y.radky = y.radky.filter((q) => q !== p.n); y.sloupce = y.sloupce.filter((q) => q !== p.n); y.hodnoty = y.hodnoty.filter((q) => q.pole !== p.n); y.filtry = y.filtry.filter((q) => q.pole !== p.n);
              if (x === 'hodnoty') y.hodnoty.push({ pole: p.n, fn: z.pole.find((q) => q.nazev === p.n)?.cisla ? 'SUMA' : 'POČET' });
              else if (x === 'filtry') y.filtry.push({ pole: p.n, hodnota: null });
              else y[x].push(p.n);
            }) })),
            ...(klic1 === 'hodnoty' ? ['sep', ...Object.entries(FUNKCE_HODNOT).map(([fk, fv]) => ({ text: `Shrnout: ${fv.nazev}`, zaskrtnuto: p.h.fn === fk, akce: () => uloz((y) => { y.hodnoty.find((q) => q.pole === p.n).fn = fk; }) }))] : []),
            ...(klic1 === 'filtry' ? ['sep', { text: '(Vše)', zaskrtnuto: p.f.hodnota === null, akce: () => uloz((y) => { y.filtry.find((q) => q.pole === p.n).hodnota = null; }) }, ...[...new Set(z.radky.map((r) => r[z.pole.find((q) => q.nazev === p.n).i]))].slice(0, 40).map((hv) => ({ text: String(hv ?? '(prázdné)'), zaskrtnuto: p.f.hodnota === String(hv ?? '(prázdné)'), akce: () => uloz((y) => { y.filtry.find((q) => q.pole === p.n).hodnota = String(hv ?? '(prázdné)'); }) }))] : []),
            'sep', { text: 'Odebrat pole', akce: () => uloz((y) => { y[klic1] = klic1 === 'hodnoty' ? y.hodnoty.filter((q) => q.pole !== p.n) : klic1 === 'filtry' ? y.filtry.filter((q) => q.pole !== p.n) : y[klic1].filter((q) => q !== p.n); }) },
          ], { sirka: 250 }), { app: 'tabulky' });
          return b;
        })));
      };
      telo.replaceChildren(el('p.tb-fb-popis', { text: 'Zvolte pole, která chcete přidat do sestavy:' }), hledat, pole1,
        el('p.tb-fb-popis', { text: 'Pole můžete přesouvat mezi oblastmi nabídkou u pole.' }),
        el('div.tb-pivot-oblasti', {}, oblast('Filtry', 'filtry'), oblast('Sloupce', 'sloupce'), oblast('Řádky', 'radky'), oblast('Hodnoty', 'hodnoty')),
        el('div.tb-seradit-tl', {}, el('button.ps-tlac', { type: 'button', text: 'Aktualizovat', onclick: () => uloz(() => {}) })));
    };
    kresli();
    P.podoknoPoVyberu = kresli;
    return () => { P.podoknoPoVyberu = null; };
  },

  // ---------- Nápověda
  napoveda(P, telo, o) {
    const temata = [
      ['Začínáme', 'Do buňky pište přímo — číslo, text nebo vzorec začínající „=“. Enter potvrdí a posune se dolů, Tab doprava. Dvojklik nebo F2 buňku upraví.'],
      ['Vzorce', 'Vzorce začínají „=“ a argumenty se oddělují středníkem: =SUMA(A1:A10), =KDYŽ(B2>100;"velké";"malé"). Klikáním do buněk při psaní vzorce vkládáte odkazy, F4 přepíná $A$1 / A$1 / $A1. Anglické názvy (SUM, IF…) se přeloží samy.'],
      ['Automatické vyplňování', 'Táhněte za zelený čtvereček v rohu výběru. Čísla, data, dny v týdnu, měsíce i „Položka 1“ pokračují v řadě; s klávesou Ctrl se kopíruje. Dvojklik na úchyt vyplní dolů podle sousedního sloupce.'],
      ['Dynamická pole', 'Funkce jako SEQUENCE, UNIQUE, SORT, FILTER nebo TRANSPOZICE vrátí víc hodnot — rozlijí se do sousedních buněk. Když je místo obsazené, ukáže se #PŘESAH!.'],
      ['Tabulky', 'Ctrl+T udělá z oblasti tabulku s pruhy, filtrem a řádkem souhrnů. Ve vzorcích lze psát Tabulka1[Cena] nebo [@Cena].'],
      ['Grafy', 'Vyberte data a zvolte Vložení › Doporučené grafy (nebo Alt+F1). Graf sleduje změny v buňkách. Tlačítka vedle grafu přidávají prvky a mění styl.'],
      ['Kontingenční tabulky', 'Vložení › Kontingenční tabulka shrne data podle kategorií. V podokně Pole zaškrtněte pole a přesuňte je do Řádků, Sloupců nebo Hodnot.'],
      ['Podmíněné formátování', 'Domů › Podmíněné formátování zvýrazní hodnoty podle pravidel: větší než, duplicity, prvních 10, datové pruhy, barevné škály a ikony.'],
      ['Ukládání', 'Sešity se ukládají na disk AstroOS jako .xlsx (formát AstroTabulek). Uložit jako CSV můžete jen aktivní list. Soubor › Tisk umí i PDF.'],
    ];
    const zkratky = [
      ['Ctrl+C / X / V', 'Kopírovat / vyjmout / vložit'], ['Ctrl+Alt+V', 'Vložit jinak'], ['Ctrl+Z / Y', 'Zpět / znovu'], ['F2', 'Upravit buňku'], ['F4', 'Přepnout $ v odkazu / opakovat akci'],
      ['Ctrl+šipka', 'Skok na okraj dat'], ['Ctrl+Shift+šipka', 'Vybrat k okraji dat'], ['Ctrl+Home / End', 'Na začátek / konec dat'], ['Ctrl+A', 'Vybrat oblast / vše'], ['Ctrl+mezerník', 'Vybrat sloupec'], ['Shift+mezerník', 'Vybrat řádek'],
      ['Ctrl+D / R', 'Vyplnit dolů / doprava'], ['Ctrl+Enter', 'Zadat do celého výběru'], ['Alt+Enter', 'Nový řádek v buňce'], ['Ctrl+;', 'Dnešní datum'], ['Ctrl+Shift+:', 'Aktuální čas'],
      ['Alt+=', 'Automatické shrnutí'], ['Ctrl+1', 'Formát buněk'], ['Ctrl+B / I / U', 'Tučné / kurzíva / podtržení'], ['Ctrl+Shift+$ % #', 'Měna / procenta / datum'],
      ['Ctrl+T', 'Vytvořit tabulku'], ['Ctrl+Shift+L', 'Filtr'], ['Alt+F1', 'Vložit graf'], ['Ctrl+Q', 'Rychlá analýza'], ['Ctrl+E', 'Dynamické doplňování'], ['Ctrl+K', 'Hypertextový odkaz'],
      ['Ctrl+F / H', 'Najít / nahradit'], ['Ctrl+G, F5', 'Přejít na'], ['F9', 'Přepočítat'], ['Ctrl+`', 'Zobrazit vzorce'], ['Ctrl+- / Ctrl++', 'Odstranit / vložit buňky'], ['Ctrl+9 / 0', 'Skrýt řádky / sloupce'],
      ['Shift+F11', 'Nový list'], ['Ctrl+PageUp / PageDown', 'Předchozí / další list'], ['Shift+F2', 'Poznámka'], ['Shift+F3', 'Vložit funkci'], ['Alt+Q', 'Hledat příkaz'],
    ];
    const hledat = el('input.ps-vstup', { placeholder: 'Hledat v nápovědě a funkcích' });
    hledat.addEventListener('keydown', (e) => e.stopPropagation());
    const obsah = el('div.tb-napoveda');
    const kresli = () => {
      const q = hledat.value.trim().toLocaleLowerCase('cs');
      if (o.funkce || q) {
        const f = o.funkce ? [FUNKCE[o.funkce]].filter(Boolean) : Object.values(FUNKCE).filter((x) => x.n.toLocaleLowerCase('cs').includes(q) || x.p.toLocaleLowerCase('cs').includes(q)).slice(0, 20);
        const t = temata.filter(([a, b]) => q && (a + b).toLocaleLowerCase('cs').includes(q));
        obsah.replaceChildren(...t.map(([a, b]) => el('div.tb-nap-tema', {}, el('b', { text: a }), el('p', { text: b }))),
          ...f.map((x) => el('div.tb-nap-tema', {}, el('b', { text: `${x.n}  (${x.en})` }), el('code', { text: syntaxe(x) }), el('p', { text: x.p }))));
        o.funkce = null;
        return;
      }
      if (o.zkratky) { obsah.replaceChildren(el('h4', { text: 'Klávesové zkratky' }), el('div.tb-zkratky', {}, zkratky.map(([k, t]) => el('div', {}, el('kbd', { text: k }), el('span', { text: t }))))); return; }
      if (o.novinky) { obsah.replaceChildren(el('h4', { text: 'Co je nového' }), ...['Dynamická pole: UNIQUE, SORT, FILTER, SEQUENCE, XLOOKUP, LET, TEXTSPLIT…', 'AstroAI v podokně: shrnutí listu a návrhy vzorců', 'Office skripty na kartě Automatizovat', 'Načítání tabulek z webu přes Novu', 'List prognózy s lineárním trendem'].map((t) => el('p', { text: '• ' + t }))); return; }
      obsah.replaceChildren(...temata.map(([a, b]) => el('details.tb-nap-tema', {}, el('summary', { text: a }), el('p', { text: b }))),
        el('button.ps-zk-odkaz', { type: 'button', text: 'Klávesové zkratky', onclick: () => { o.zkratky = true; kresli(); } }));
    };
    hledat.oninput = () => { o.zkratky = false; kresli(); };
    kresli();
    telo.append(hledat, obsah);
  },

  // ---------- Pravopis (jednoduchá česká pravidla jako Editor v Písmu)
  pravopis(P, telo) {
    const nalezy = [];
    for (const [k, b] of P.S.list.b) {
      if (typeof b.v !== 'string') continue;
      const [r, c] = zKlice(k);
      const t = b.v;
      const m1 = /\b(\p{L}+)\s+\1\b/iu.exec(t);
      if (m1) nalezy.push({ r, c, t, popis: `Opakované slovo „${m1[1]}“`, oprava: t.replace(m1[0], m1[1]) });
      if (/ {2,}/.test(t)) nalezy.push({ r, c, t, popis: 'Dvojitá mezera', oprava: t.replace(/ {2,}/g, ' ') });
      if (/\s[,.!?;:]/.test(t)) nalezy.push({ r, c, t, popis: 'Mezera před interpunkcí', oprava: t.replace(/\s+([,.!?;:])/g, '$1') });
      if (/^\s|\s$/.test(t)) nalezy.push({ r, c, t, popis: 'Mezera na začátku nebo na konci', oprava: t.trim() });
    }
    if (!nalezy.length) { telo.append(el('div.tb-an-prazdne', {}, ik('kontrola'), el('p', { text: 'Kontrola pravopisu je hotová. Můžete pokračovat!' }))); return; }
    telo.append(el('p.tb-fb-popis', { text: `Nalezeno: ${nalezy.length}` }), ...nalezy.map((x) => el('div.tb-kom-karta', { onclick: () => P.grid.nastavVyber(x.r, x.c) },
      el('div.tb-kom-misto', { text: adresa(x.r, x.c) }), el('b', { text: x.popis }), el('p', { text: x.t }),
      el('button.ps-tlac', { type: 'button', text: 'Opravit', onclick: (e) => { e.stopPropagation(); P.prikaz('Opravit', () => P.S.zadej(P.S.list, x.r, x.c, x.oprava)); e.currentTarget.closest('.tb-kom-karta').remove(); } }))));
  },

  pristupnost(P, telo) {
    const vse = [];
    for (const l of P.S.listy) {
      for (const gr of l.grafy) if (!gr.alt) vse.push({ l, typ: 'chyba', text: 'Chybí alternativní text', misto: `Graf na listu ${l.nazev}`, akce: () => { P.prepniNaList(l); P.vyberObjekt({ id: gr.id, typ: 'graf' }); } });
      for (const o of l.obrazky) if (!o.alt) vse.push({ l, typ: 'chyba', text: 'Chybí alternativní text', misto: `Obrázek na listu ${l.nazev}`, akce: () => { P.prepniNaList(l); P.vyberObjekt({ id: o.id, typ: 'obr' }); } });
      for (const m of l.sloucene) vse.push({ l, typ: 'varovani', text: 'Sloučené buňky', misto: `${l.nazev}!${textOblasti(m)}`, akce: () => { P.prepniNaList(l); P.grid.vyberOblast(m); } });
      if (/^List\d+$/.test(l.nazev) && l.b.size) vse.push({ l, typ: 'tip', text: 'Výchozí název listu', misto: l.nazev, akce: () => P.prejmenovatListNaMiste(l) });
    }
    if (!vse.length) { telo.append(el('div.tb-an-prazdne', {}, ik('pristupnost'), el('p', { text: 'Nebyly nalezeny žádné problémy s přístupností. Lidé se zdravotním postižením by neměli mít potíže se čtením tohoto sešitu.' }))); return; }
    const skup = { chyba: 'Chyby', varovani: 'Upozornění', tip: 'Tipy' };
    for (const [k, t] of Object.entries(skup)) {
      const x = vse.filter((y) => y.typ === k);
      if (!x.length) continue;
      telo.append(el('details.tb-sekce', { open: true }, el('summary', { text: `${t} (${x.length})` }), ...x.map((y) => el('button.tb-prist-pol', { type: 'button', onclick: y.akce }, el('b', { text: y.text }), el('small', { text: y.misto })))));
    }
  },

  chyby(P, telo) {
    const out = [];
    for (const l of P.S.listy) for (const [k, b] of l.b) {
      if (!b.f) continue;
      const [r, c] = zKlice(k);
      const v = P.S.hodnota(l, r, c);
      if (jeChyba(v)) out.push({ l, r, c, v, f: b.f });
    }
    if (P.S.cyklus) telo.append(el('div.tb-kom-karta', {}, el('b', { text: 'Cyklický odkaz' }), el('p', { text: `Vzorec odkazuje sám na sebe (list ${P.S.cyklus.list}). Výsledek je 0.` })));
    if (!out.length && !P.S.cyklus) { telo.append(el('div.tb-an-prazdne', {}, ik('kontrola'), el('p', { text: 'Kontrola chyb celého listu je dokončená.' }))); return; }
    const vysvetleni = { '#DĚLENÍ_NULOU!': 'Vzorec dělí nulou nebo prázdnou buňkou.', '#NÁZEV?': 'Vzorec obsahuje neznámý název funkce nebo oblasti.', '#HODNOTA!': 'Hodnota ve vzorci má nesprávný typ (např. text místo čísla).', '#ODKAZ!': 'Odkaz ve vzorci není platný — buňka byla nejspíš odstraněna.', '#NENÍ_K_DISPOZICI': 'Hledaná hodnota nebyla nalezena.', '#ČÍSLO!': 'Výsledek je číslo mimo povolený rozsah.', '#PŘESAH!': 'Dynamické pole se nemůže rozlít, protože cílové buňky nejsou prázdné.', '#POČÍTÁNÍ!': 'Výpočet vrátil prázdné pole.' };
    telo.append(...out.slice(0, 200).map((x) => el('div.tb-kom-karta', { onclick: () => { if (x.l !== P.S.list) P.prepniNaList(x.l); P.grid.nastavVyber(x.r, x.c); } },
      el('div.tb-kom-misto', { text: `${x.l.nazev}!${adresa(x.r, x.c)}` }), el('b', { text: `Chyba ${x.v.kod}` }), el('code', { text: x.f }), el('p', { text: vysvetleni[x.v.kod] || '' }),
      el('div.tb-kom-tl', {}, el('button.ps-zk-odkaz', { type: 'button', text: 'Vyhodnotit vzorec', onclick: () => { P.grid.nastavVyber(x.r, x.c); D.dialogVyhodnotit(P); } }), el('button.ps-zk-odkaz', { type: 'button', text: 'Upravit v řádku vzorců', onclick: () => { P.grid.nastavVyber(x.r, x.c); P.radekVzorcu.focus(); } })))));
  },

  kukatko(P, telo) {
    const sledovane = P.st.kukatko || (P.st.kukatko = []);
    const tabulka = el('div.tb-kukatko');
    const kresli = () => tabulka.replaceChildren(el('div.tb-kuk-radek.hlava', {}, ['List', 'Buňka', 'Hodnota', 'Vzorec'].map((t) => el('span', { text: t }))),
      ...sledovane.map((x, i) => {
        const l = P.S.listPodleId(x.l);
        if (!l) return null;
        return el('div.tb-kuk-radek', { ondblclick: () => { P.prepniNaList(l); P.grid.nastavVyber(x.r, x.c); } }, el('span', { text: l.nazev }), el('span', { text: adresa(x.r, x.c) }), el('span', { text: P.S.textBunky(l, x.r, x.c) }), el('span', { text: P.S.bunka(l, x.r, x.c)?.f || '' }),
          el('button.ps-dialog-x', { type: 'button', title: 'Odstranit kukátko', onclick: () => { sledovane.splice(i, 1); kresli(); } }, ik('zavrit')));
      }));
    kresli();
    telo.append(el('div.tb-seradit-tl', {}, el('button.ps-tlac', { type: 'button', text: '+ Přidat kukátko…', onclick: () => { for (const o of P.S.list.vyber.oblasti) for (let r = o.r1; r <= Math.min(o.r2, o.r1 + 20); r++) for (let c = o.c1; c <= Math.min(o.c2, o.c1 + 10); c++) sledovane.push({ l: P.S.list.id, r, c }); kresli(); } })), tabulka);
    P.podoknoPoDatech = kresli;
    return () => { P.podoknoPoDatech = null; };
  },

  skripty(P, telo, o) {
    const ulozene = P.nastaveni().skripty || [];
    const editor = el('textarea.tb-skript-editor', { spellcheck: 'false', rows: 14 }, o.novy ? `// Nový skript — API: sesit, list, vypis\n// list.hodnota('A1'), list.nastav('B2', 42), list.styl('A1', { b: true, pozadi: '#FFFF00' })\n// list.oblast('A1:C5') vrací pole hodnot, list.posledniRadek(), sesit.pridejList('Nový')\n\nlist.nastav('A1', 'Ahoj ze skriptu!');\nlist.styl('A1', { b: true, barva: '#107C41' });\n` : UKAZKOVE[0].kod);
    editor.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '  '); } });
    const vystup = el('pre.tb-skript-vystup');
    const nazev = el('input.ps-vstup', { value: o.novy ? 'Skript 1' : UKAZKOVE[0].nazev });
    nazev.addEventListener('keydown', (e) => e.stopPropagation());
    const seznam = el('div.tb-fb-list');
    const kresliSeznam = () => seznam.replaceChildren(...[...UKAZKOVE.map((s) => ({ ...s, ukazka: true })), ...(P.nastaveni().skripty || [])].map((s) => el('button', { type: 'button', onclick: () => { editor.value = s.kod; nazev.value = s.nazev; } }, ik('skript'), el('span', { text: s.nazev + (s.ukazka ? '' : ' ★') }))));
    kresliSeznam();
    telo.append(el('small', { text: 'Skripty:' }), seznam, pole('Název:', nazev), editor,
      el('div.tb-seradit-tl', {},
        el('button.ps-tlac.primarni', { type: 'button', text: '▶ Spustit', onclick: () => { vystup.textContent = (P.spustSkript(editor.value, nazev.value) || []).join('\n'); } }),
        el('button.ps-tlac', { type: 'button', text: 'Uložit', onclick: () => { const s = [...(P.nastaveni().skripty || []).filter((x) => x.nazev !== nazev.value), { nazev: nazev.value, kod: editor.value }]; P.ulozNastaveni({ skripty: s }); kresliSeznam(); P.toast('Skript uložen'); } })),
      vystup);
  },

  schranka(P, telo) {
    const s = P.schranka;
    telo.append(el('p.tb-fb-popis', { text: 'Položky kopírované v AstroTabulkách:' }),
      s ? el('button.tb-kom-karta', { type: 'button', onclick: () => P.vlozVnitrni(s, 'vse') }, el('b', { text: `${s.list.nazev}!${textOblasti(s.oblast)}` }), el('pre', { text: s.text.slice(0, 300) })) : el('p', { text: 'Schránka je prázdná.' }));
  },

  vyber(P, telo) {
    const l = P.S.list;
    const vse = [...l.grafy.map((x) => ({ x, typ: 'graf', n: x.nazev || 'Graf' })), ...l.obrazky.map((x) => ({ x, typ: 'obr', n: x.typ === 'obrazek' ? 'Obrázek' : 'Tvar' }))];
    telo.append(el('p.tb-fb-popis', { text: 'Tvary na tomto listu:' }), ...vse.map((o, i) => el('button.tb-prist-pol', { type: 'button', onclick: () => P.vyberObjekt({ id: o.x.id, typ: o.typ }) }, el('b', { text: `${o.n} ${i + 1}` }))),
      !vse.length ? el('p', { text: 'Na listu nejsou žádné objekty.' }) : null);
  },
};

// ---------------------------------------------------------------- AstroAI: kontext a místní pomocník
function kontextListu(P) {
  const l = P.S.list;
  const u = P.S.rozsahDat(l);
  if (u.r < 0) return '(list je prázdný)';
  const radky = [];
  for (let r = 0; r <= Math.min(u.r, 60); r++) {
    const x = [];
    for (let c = 0; c <= Math.min(u.c, 12); c++) x.push(P.S.textBunky(l, r, c).replace(/;/g, ','));
    radky.push(`${r + 1}: ` + x.join(';'));
  }
  const hl = Array.from({ length: Math.min(u.c, 12) + 1 }, (_, c) => pismena(c)).join(';');
  return `sloupce: ${hl}\n` + radky.join('\n') + (u.r > 60 ? `\n… (celkem ${u.r + 1} řádků)` : '');
}

// odpovědi místního pomocníka se skládají česky a v angličtině je přeloží slovník po řádcích
const mistniAsistent = (P, dotaz) => tt(mistniAsistentCs(P, dotaz));

function mistniAsistentCs(P, dotaz) {
  const l = P.S.list;
  const q = dotaz.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const u = P.S.rozsahDat(l);
  if (u.r < 0) return 'List je zatím prázdný. Zadejte data (třeba se záhlavím v prvním řádku) a zeptejte se znovu.';
  const o = { r1: 0, c1: 0, r2: u.r, c2: u.c };
  const z = zdrojKontingencni(P.S, { zdroj: jmenoListuVeVzorci(l.nazev) + '!' + textOblasti(o, true) });
  const cisla = z.pole.filter((p) => p.cisla);
  // sloupec zmíněný v dotazu (písmeno nebo název)
  const zminka = z.pole.find((p) => q.includes(p.nazev.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''))) || (() => { const m = /sloupe?c\w*\s+([a-z]{1,2})\b/.exec(q); return m ? z.pole.find((p) => pismena(p.c).toLowerCase() === m[1]) : null; })();
  const sloupec = zminka || cisla[0];
  const rozsahSloupce = (p) => textOblasti({ r1: 1, r2: u.r, c1: p.c, c2: p.c });
  if (/vzorec|funkc|secti|soucet|suma|prumer|pocet|maxim|minim|formula|\bsum\b|average|count/.test(q) && sloupec) {
    const fn = /prumer|average/.test(q) ? 'PRŮMĚR' : /pocet|count/.test(q) ? 'POČET' : /maxim|nejvys|nejvet|highest|largest/.test(q) ? 'MAX' : /minim|nejniz|nejmen|lowest|smallest/.test(q) ? 'MIN' : 'SUMA';
    const f = `=${fn}(${rozsahSloupce(sloupec)})`;
    const v = vyhodnot(parse(f), { S: P.S.S, list: l, r: 0, c: 0 });
    return `Pro sloupec **${sloupec.nazev}** (${pismena(sloupec.c)}) použijte:\n\n\`${f}\`\n\nVýsledek by teď byl **${formatuj(v, sloupec.nf).text || obecne(v)}**. Tlačítkem níže vzorec vložíte do vybrané buňky.`;
  }
  if (/nejvys|nejvet|maximum|top|nejlep|highest|largest|best/.test(q) && sloupec) {
    const i = z.pole.indexOf(sloupec);
    const serazene = z.radky.filter((r) => typeof r[i] === 'number').sort((a, b) => b[i] - a[i]).slice(0, 3);
    const popis = z.pole.find((p) => !p.cisla);
    return `Nejvyšší hodnoty ve sloupci **${sloupec.nazev}**:\n\n${serazene.map((r, k) => `${k + 1}. ${popis ? r[popis.i] + ': ' : ''}**${formatuj(r[i], sloupec.nf).text || obecne(r[i])}**`).join('\n')}`;
  }
  if (/graf|chart/.test(q)) {
    const d = dataGrafu(P.S, l, { zdroj: jmenoListuVeVzorci(l.nazev) + '!' + textOblasti(o, true), radyVeSloupcich: true });
    const t = TYPY_GRAFU.find((x) => x.id === doporuceneGrafy(d)[0]);
    return `Pro tato data doporučuji **${tt(t.nazev).toLowerCase()} graf** (${d.rady.length} ${d.rady.length === 1 ? 'řada' : 'řady'}, ${d.kategorie.length} kategorií). Vložíte ho přes **Vložení › Doporučené grafy** nebo klávesami **Alt+F1**.`;
  }
  if (/duplic/.test(q)) {
    P.grid.vyberOblast({ r1: 1, r2: u.r, c1: (sloupec || z.pole[0]).c, c2: (sloupec || z.pole[0]).c });
    P.podminene({ typ: 'duplicitni', styl: { pozadi: '#FFC7CE', barva: '#9C0006' } });
    return `Hotovo — duplicitní hodnoty ve sloupci **${(sloupec || z.pole[0]).nazev}** jsou zvýrazněné červeně (Domů › Podmíněné formátování).`;
  }
  // shrnutí
  const vety = [`List **${l.nazev}** má ${z.radky.length} řádků dat a ${z.pole.length} sloupců: ${z.pole.map((p) => p.nazev).join(', ')}.`];
  for (const p of cisla.slice(0, 3)) {
    const x = z.radky.map((r) => r[p.i]).filter((y) => typeof y === 'number');
    const s = x.reduce((a, b) => a + b, 0);
    vety.push(`- **${p.nazev}**: součet ${formatuj(s, p.nf).text || obecne(s)}, průměr ${formatuj(s / (x.length || 1), p.nf).text || obecne(s / (x.length || 1))}, rozsah ${obecne(Math.min(...x))} – ${obecne(Math.max(...x))}`);
  }
  vety.push('\nZeptejte se třeba „jaký vzorec sečte sloupec B“, „najdi nejvyšší hodnotu“ nebo „navrhni graf“.');
  return vety.join('\n');
}

function md(t) {
  const e = String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  return e.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
}
