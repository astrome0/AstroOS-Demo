// AstroPrezentace — pás karet jako v PowerPointu 365: Domů, Vložení, Kreslení, Návrh, Přechody, Animace,
// Prezentace, Nahrávání, Revize, Zobrazení, Nápověda + kontextové Formát obrazce, Formát obrázku, Návrh tabulky,
// Rozložení (tabulky) a Návrh grafu. Stavební kameny (velke, male, delene, skupina…) sdílí s Písmem.

import { el } from '../util.js';
import { ik } from '../pismo/ikony.js';
import { rozbal, zavriRozbal, nabidka, paletaZvyrazneni } from '../pismo/ui.js';
import { velke, male, delene, skupina, radek, sloupec, oddelovac, kombo, zadrz } from '../pismo/pas.js';
import { PISMA, VELIKOSTI_PISMA, zasobnikPisma } from '../pismo/dokument.js';
import { MOTIVY, ROZVRZENI, VELIKOSTI_SNIMKU, barvyMotivu, barva, odstin, rychleStyly } from './motivy.js';
import { TVARY, JMENA_TVARU, cestaTvaru, ODRAZKY, WORDART, NAZVY_STINU, stylTabulkyBunky, kresliPozadi, kontextSnimku } from './render.js';
import { PRECHODY, NAZVY_PRECHODU, MOZNOSTI_PRECHODU, VYCHOZI_DELKA, ANIMACE, MOZNOSTI_ANIMACE, VYCHOZI_TRVANI, nazevAnimace } from './efekty.js';
import { ikonaPrechodu, ikonaAnimace } from './ikony.js';
import { TYPY_GRAFU } from '../tabulky/grafy.js';

const registruj = (P, text, ikona, akce, klavesa) => { if (text && akce) P.prikazy.push({ text, ikona, akce, klavesa }); };

// ---------------------------------------------------------------- společné ovládací prvky
export function zaskrt(P, text, cti, zapis, ikona = 'kontrola') {
  const c = el('input', { type: 'checkbox', onchange: () => zapis(c.checked) });
  P.obnovy.push(() => { c.checked = !!cti(); });
  registruj(P, text, ikona, () => zapis(!cti()));
  return zadrz(el('label.ps-zaskrt', {}, c, el('span', { text })));
}

export function spinner(P, { popis, jednotka = '', krok = 1, min = 0, max = 9999, cti, zapis, sirka = 64, format }) {
  const v = el('input.ps-spin-vstup', { type: 'text', style: { width: sirka + 'px' } });
  const zmen = (d) => {
    const x = Math.max(min, Math.min(max, +(parseFloat(String(v.value).replace(',', '.').replace(/[^\d.-]/g, '')) || 0) + d));
    zapis(+x.toFixed(2));
    P.obnov();
  };
  v.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); zmen(0); P.dok.vratVyber(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); zmen(krok); }
    if (e.key === 'ArrowDown') { e.preventDefault(); zmen(-krok); }
  });
  v.addEventListener('change', () => zmen(0));
  P.obnovy.push(() => {
    if (document.activeElement === v) return;
    const h = cti();
    v.value = h === null || h === undefined || h === '' ? '' : (format ? format(h) : String(h).replace('.', ',') + (jednotka ? ' ' + jednotka : ''));
  });
  return el('div.ps-spin', {}, popis ? el('span.ps-spin-popis', { text: popis }) : null, el('div.ps-spin-pole', {}, v,
    el('div.ps-spin-sipky', {},
      zadrz(el('button', { type: 'button', text: '▴', onclick: () => zmen(krok) })),
      zadrz(el('button', { type: 'button', text: '▾', onclick: () => zmen(-krok) })))));
}

/** Galerie v pásu karet (rámeček s položkami, šipky nahoru/dolů a rozbalení). */
function galerie(P, { polozky, sirka = 380, vyska = 68, cls = '', rozbalene, trida = '' }) {
  const g = el('div.ps-galerie.pr-galerie' + (cls ? '.' + cls : ''), { style: { width: sirka + 'px', height: vyska + 'px' } });
  const naplnit = () => g.replaceChildren(...polozky());
  naplnit();
  P.obnovyGalerii = [...(P.obnovyGalerii || []), naplnit];
  const posun = (smer) => g.scrollBy({ top: smer * g.clientHeight, behavior: 'smooth' });
  const vse = zadrz(el('button.ps-gal-sipka', { type: 'button', title: 'Další' }, el('span', { text: '⌄' })));
  vse.onclick = () => { const u = rozbal(vse, rozbalene ? rozbalene() : el('div.pr-gal-vse' + (trida ? '.' + trida : ''), {}, polozky())); u?.classList.add('pr-rozbal-galerie'); };
  return el('div.ps-galerie-ram.pr-galerie-ram', { style: { height: vyska + 2 + 'px' } }, g, el('div.ps-gal-sipky', {},
    zadrz(el('button.ps-gal-sipka', { type: 'button', title: 'Nahoru', onclick: () => posun(-1) }, el('span', { text: '⌃' }))),
    zadrz(el('button.ps-gal-sipka', { type: 'button', title: 'Dolů', onclick: () => posun(1) }, el('span', { text: '⌄' }))),
    vse));
}

// ---------------------------------------------------------------- paleta barev motivu
const MOTIV_SLOUPCE = ['bg', 'tx', 'bg2', 'tx2', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6'];
const ODSTINY = { bg: [-5, -15, -25, -35, -50], tx: [50, 35, 25, 15, 5], bg2: [-10, -25, -50, -75, -90], tx2: [80, 60, 40, -25, -50] };
const STANDARDNI = ['#C00000', '#FF0000', '#FFC000', '#FFFF00', '#92D050', '#00B050', '#00B0F0', '#0070C0', '#002060', '#7030A0'];
const NAZVY_SLOUPCU = { bg: 'Bílá, pozadí 1', tx: 'Černá, text 1', bg2: 'Světlá, pozadí 2', tx2: 'Tmavá, text 2' };

export function paletaMotivu(P, { auto = 'Automaticky', autoBarva = null, bezBarvy = false, onVyber, dalsi = [] }) {
  const b = P.barvy();
  const vyber = (x) => { zavriRozbal(); onVyber(x); };
  const nazev = (s, k) => `${NAZVY_SLOUPCU[s] || 'Zvýraznění ' + s[1]}${k ? `, ${k > 0 ? 'světlejší' : 'tmavší'} ${Math.abs(k)} %` : ''}`;
  const bunka = (ref, titulek) => el('button.ps-barva', { type: 'button', title: titulek, style: { background: barva(b, ref) }, onclick: () => vyber(ref) });
  const vlastni = el('input', { type: 'color', value: '#1F4E79', onchange: (e) => vyber(e.target.value.toUpperCase()) });
  const nedavne = P.nedavneBarvy || [];
  const kapatko = window.EyeDropper ? el('button.ps-nab-polozka', { type: 'button', onclick: async () => { zavriRozbal(); try { const r = await new window.EyeDropper().open(); onVyber(r.sRGBHex.toUpperCase()); } catch { /* zrušeno */ } } }, el('span.ps-nab-ik', {}, ik('stetec')), el('span', { text: 'Kapátko' })) : null;
  return el('div.ps-paleta', {},
    auto ? el('button.ps-nab-polozka', { type: 'button', onclick: () => vyber(bezBarvy ? 'none' : 'auto') }, el('span.ps-barva-vzor', { style: { background: bezBarvy ? 'transparent' : autoBarva || b.tx } }), el('span', { text: auto })) : null,
    el('div.ps-nab-nadpis', { text: 'Barvy motivu' }),
    el('div.ps-paleta-motiv', {},
      el('div.ps-paleta-radek', {}, MOTIV_SLOUPCE.map((s) => bunka(s, nazev(s, 0)))),
      el('div.ps-paleta-odstiny', {}, [0, 1, 2, 3, 4].map((r) => el('div.ps-paleta-radek', {}, MOTIV_SLOUPCE.map((s) => {
        const k = (ODSTINY[s] || [80, 60, 40, -25, -50])[r];
        return bunka(`${s}${k > 0 ? '+' : ''}${k}`, nazev(s, k));
      }))))),
    el('div.ps-nab-nadpis', { text: 'Standardní barvy' }),
    el('div.ps-paleta-radek', {}, STANDARDNI.map((x) => bunka(x, x))),
    nedavne.length ? el('div.ps-nab-nadpis', { text: 'Poslední barvy' }) : null,
    nedavne.length ? el('div.ps-paleta-radek', {}, nedavne.map((x) => bunka(x, x))) : null,
    el('div.ps-nab-sep'),
    ...dalsi,
    el('label.ps-nab-polozka.ps-vlastni-barva', {}, el('span.ps-nab-ik', {}, '🎨'), el('span', { text: 'Další barvy…' }), vlastni),
    kapatko);
}

/** Nabídka obrysu: paleta + tloušťka + čárkování. */
function nabidkaObrysu(P, { text = false } = {}) {
  const sub = (nazev, polozky) => el('button.ps-nab-polozka.tb-sub', { type: 'button', onclick: (e) => { e.stopPropagation(); rozbal(e.currentTarget, nabidka(polozky, { sirka: 200 }), { app: 'prezentace' }); } }, el('span.ps-nab-ik'), el('span.ps-nab-text', { text: nazev }), el('span.tb-sub-sipka', { text: '›' }));
  return paletaMotivu(P, {
    auto: text ? 'Bez obrysu' : 'Bez obrysu', bezBarvy: true, onVyber: (x) => (text ? P.obrysTextu(x) : P.obrysTvaru({ barva: x })),
    dalsi: text ? [] : [
      sub('Tloušťka', [0.25, 0.5, 0.75, 1, 1.5, 2.25, 3, 4.5, 6].map((w) => ({ uzel: el('button.ps-nab-polozka', { type: 'button', onclick: () => { zavriRozbal(); P.obrysTvaru({ w }); } }, el('span.pr-tloustka', { style: { height: Math.max(1, w) + 'px' } }), el('span', { text: `${String(w).replace('.', ',')} b.` })) }))),
      sub('Čárky', [['plna', 'Plná čára'], ['carky', 'Čárkovaná'], ['tecky', 'Tečkovaná']].map(([v, t]) => ({ text: t, akce: () => P.obrysTvaru({ styl: v }) }))),
    ],
  });
}

function nabidkaEfektu(P, { text = false } = {}) {
  const sub = (nazev, ikona, polozky) => el('button.ps-nab-polozka.tb-sub', { type: 'button', onclick: (e) => { e.stopPropagation(); rozbal(e.currentTarget, nabidka(polozky, { sirka: 250 }), { app: 'prezentace' }); } }, el('span.ps-nab-ik', {}, ikona ? ik(ikona) : ''), el('span.ps-nab-text', { text: nazev }), el('span.tb-sub-sipka', { text: '›' }));
  const nast = (e) => (text ? P.efektyTextu(e) : P.efektyTvaru(e));
  return el('div.ps-nabidka', { style: { width: '220px' } },
    text ? null : sub('Předvolba', 'efektyTvaru', [
      { text: 'Bez předvolby', akce: () => nast({ stin: null, zar: null, mekke: null }) },
      { text: 'Předvolba 1 (stín)', akce: () => nast({ stin: 'vnejsi' }) },
      { text: 'Předvolba 2 (měkký stín a záře)', akce: () => nast({ stin: 'vnejsiMekky', zar: 'a1+60' }) },
      { text: 'Předvolba 3 (perspektiva)', akce: () => nast({ stin: 'perspektiva' }) },
    ]),
    sub('Stín', null, [{ text: 'Bez stínu', akce: () => nast({ stin: null }) }, ...Object.entries(NAZVY_STINU).map(([k, t]) => ({ text: t, akce: () => nast({ stin: k }) }))]),
    sub('Záře', null, [{ text: 'Bez záře', akce: () => nast({ zar: null }) }, ...['a1', 'a2', 'a3', 'a4', 'a5', 'a6'].map((a, i) => ({ text: `Záře: 8 b.; barva zvýraznění ${i + 1}`, akce: () => nast({ zar: a + '+40', zarVel: 8 }) })), { text: 'Záře: 18 b.; barva zvýraznění 1', akce: () => nast({ zar: 'a1+40', zarVel: 18 }) }]),
    text ? null : sub('Měkké okraje', null, [0, 1, 2.5, 5, 10].map((v) => ({ text: v ? `${String(v).replace('.', ',')} b.` : 'Bez měkkých okrajů', akce: () => nast({ mekke: v || null }) }))),
    text ? sub('Transformace', null, [{ text: 'Bez transformace', akce: () => P.efektyTextu({ transformace: null }) }, { text: 'Oblouk', akce: () => P.efektyTextu({ transformace: 'oblouk' }) }]) : null);
}

// ---------------------------------------------------------------- galerie tvarů a rozvržení
function ikonaTvaru(t) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '-2 -2 24 24');
  s.setAttribute('class', 'pr-ik-tvar');
  if (t === 'cara' || t === 'caraSipka' || t === 'caraDvojSipka') {
    s.innerHTML = `<path d="M2 18L18 2" stroke="currentColor" stroke-width="1.3"/>${t !== 'cara' ? '<path d="M18 2l-5 1.2M18 2l-1.2 5" stroke="currentColor" stroke-width="1.3" fill="none"/>' : ''}${t === 'caraDvojSipka' ? '<path d="M2 18l5-1.2M2 18l1.2-5" stroke="currentColor" stroke-width="1.3" fill="none"/>' : ''}`;
    return s;
  }
  if (t === 'textove') { s.innerHTML = '<rect x="1" y="3" width="18" height="14" fill="none" stroke="currentColor" stroke-width="1.1"/><text x="10" y="14" text-anchor="middle" font-size="9" font-family="Segoe UI" fill="currentColor">A</text>'; return s; }
  s.innerHTML = `<path d="${cestaTvaru(t, 20, t.startsWith('bublina') || t === 'myslenka' ? 17 : 20)}" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round" fill-rule="evenodd"/>`;
  return s;
}

export function nabidkaTvaru(P, { akce } = {}) {
  const vloz = akce || ((t) => P.vlozTvar(t));
  return el('div.pr-tvary-nabidka', {},
    TVARY.map((sk) => [
      el('div.ps-nab-nadpis', { text: sk.skupina }),
      el('div.pr-tvary-mrizka', {}, sk.tvary.map(([t, n]) => el('button.pr-tvar-pol', { type: 'button', title: n, onclick: () => { zavriRozbal(); vloz(t); } }, ikonaTvaru(t)))),
    ]).flat());
}

function miniRozvrzeni(r) {
  const m = el('div.pr-mini-rozvrzeni');
  for (const p of r.ph) {
    const b = el('div.pr-mini-ph' + (p.ph.startsWith('nadpis') ? '.nadpis' : '') + (p.ph === 'obrazek' ? '.obr' : ''), { style: { left: (p.x / 960) * 100 + '%', top: (p.y / 540) * 100 + '%', width: (p.w / 960) * 100 + '%', height: (p.h / 540) * 100 + '%' } });
    if (/^(obsah|text)/.test(p.ph)) b.append(el('i'), el('i'), el('i'));
    m.append(b);
  }
  return m;
}
export function galerieRozvrzeni(P, akce) {
  const b = P.barvy();
  return el('div.pr-rozvrzeni-gal', {},
    el('div.ps-nab-nadpis', { text: MOTIVY.find((m) => m.id === P.pres.motiv)?.nazev || 'Motiv Office' }),
    el('div.pr-rozvrzeni-mrizka', { style: { '--pr-bg': b.bg, '--pr-tx': b.tx, '--pr-a1': b.a[0] } }, ROZVRZENI.map((r) => el('button.pr-rozvrzeni-pol' + (P.snimek()?.rozvrzeni === r.id && akce === P.zmenRozvrzeni ? '.zapnuto' : ''), {
      type: 'button', title: r.nazev, onclick: () => { zavriRozbal(); akce(r.id); },
    }, el('div.pr-rozvrzeni-nahled', { style: { background: b.bg } }, pozadiMotivu(P, r.uvodni), miniRozvrzeni(r)), el('span', { text: r.nazev })))));
}
function pozadiMotivu(P, uvodni, motiv = P.pres.motiv, varianta = P.pres.varianta) {
  const falesna = { motiv, varianta, velikost: P.pres.velikost, src: (x) => x };
  const s = { rozvrzeni: uvodni ? 'uvodni' : 'obsah', pozadi: null };
  const v = kresliPozadi(falesna, s, kontextSnimku(falesna, s));
  v.classList.add('pr-mini-pozadi');
  return v;
}

// ---------------------------------------------------------------- Domů
function kartaDomu(P) {
  let posledniVypln = 'a1', posledniObrys = 'a1-50', posledniPismo = '#FF0000', posledniZvyr = '#FFFF00';
  const schranka = skupina('Schránka', [
    velke(P, {
      ik: 'vlozit', text: 'Vložit', deleno: true, klavesa: 'Ctrl+V', akce: () => P.vlozit(),
      rozbal: () => nabidka([
        { nadpis: 'Možnosti vložení:' },
        { text: 'Použít motiv cíle (H)', ikona: 'vlozit', akce: () => P.vlozit('motiv') },
        { text: 'Zachovat formátování zdroje (K)', ikona: 'stetec', akce: () => P.vlozit('zdroj') },
        { text: 'Obrázek (U)', ikona: 'obrazky', akce: () => P.vlozit('obrazek') },
        { text: 'Ponechat pouze text (T)', ikona: 'novy', akce: () => P.vlozit('text') },
        'sep',
        { text: 'Vložit jinak…', akce: () => P.vlozit('jinak') },
      ], { sirka: 250 }),
    }),
    sloupec(
      male(P, { ik: 'vyjmout', titulek: 'Vyjmout', klavesa: 'Ctrl+X', akce: () => P.vyjmout() }),
      delene(P, { ik: 'kopirovat', titulek: 'Kopírovat', klavesa: 'Ctrl+C', akce: () => P.kopirovat(), rozbal: () => nabidka([{ text: 'Kopírovat', ikona: 'kopirovat', akce: () => P.kopirovat() }, { text: 'Duplikovat', ikona: 'duplikovat', klavesa: 'Ctrl+D', akce: () => P.duplikovat() }], { sirka: 180 }) }),
      (() => { const b = male(P, { ik: 'stetec', titulek: 'Kopírovat formát', klavesa: 'Ctrl+Shift+C', akce: () => P.stetec(), stav: () => !!P.st.stetec }); b.addEventListener('dblclick', () => P.stetec(true)); return b; })(),
    ),
  ], { spoustec: () => P.podokno('schranka'), priorita: 3, ikona: 'vlozit' });

  const snimky = skupina('Snímky', [
    velke(P, { ik: 'novySnimek', text: 'Nový\nsnímek', deleno: true, klavesa: 'Ctrl+M', akce: () => P.novySnimek(), rozbal: () => el('div', {}, galerieRozvrzeni(P, (id) => P.novySnimek(id)), nabidka([
      'sep',
      { text: 'Duplikovat vybrané snímky', ikona: 'duplikovat', akce: () => P.duplikovatSnimky() },
      { text: 'Snímky z osnovy…', ikona: 'osnova', akce: () => P.snimkyZOsnovy() },
      { text: 'Opakovaně použít snímky…', ikona: 'otevrit', akce: () => P.pouzitSnimky() },
    ])) }),
    sloupec(
      male(P, { ik: 'rozvrzeni', text: 'Rozložení', rozbal: () => galerieRozvrzeni(P, P.zmenRozvrzeni) }),
      male(P, { ik: 'obnovit', text: 'Obnovit', titulek: 'Obnovit — vrátí polohu, velikost a formát zástupných symbolů', akce: () => P.obnovitSnimek() }),
      male(P, { ik: 'oddil', text: 'Oddíl', rozbal: () => nabidka([
        { text: 'Přidat oddíl', akce: () => P.oddil('pridat') },
        { text: 'Přejmenovat oddíl', zakazano: !P.pres.oddilSnimku(P.st.aktivni), akce: () => P.oddil('prejmenovat') },
        { text: 'Odebrat oddíl', zakazano: !P.pres.oddilSnimku(P.st.aktivni), akce: () => P.oddil('odebrat') },
        { text: 'Odebrat všechny oddíly', zakazano: !P.pres.oddily.length, akce: () => P.oddil('odebratVse') },
        'sep',
        { text: 'Sbalit vše', zakazano: !P.pres.oddily.length, akce: () => P.oddil('sbalit') },
        { text: 'Rozbalit vše', zakazano: !P.pres.oddily.length, akce: () => P.oddil('rozbalit') },
      ], { sirka: 220 }) }),
    ),
  ], { priorita: 6, ikona: 'novySnimek' });

  const pismo = skupina('Písmo', [
    radek(
      kombo(P, { titulek: 'Písmo (Ctrl+Shift+F)', sirka: 116, nahled: true, hodnoty: () => PISMA, pismaMotivu: [`${P.pismaMotivu().nadpis} (Nadpisy)`, `${P.pismaMotivu().telo} (Základní text)`], zobraz: () => P.stav.pismo || '', aplikuj: (v) => P.pismo(v) }),
      kombo(P, { titulek: 'Velikost písma (Ctrl+Shift+P)', sirka: 30, hodnoty: () => VELIKOSTI_PISMA.map((v) => String(v).replace('.', ',')), zobraz: () => (P.stav.velikost ? String(P.stav.velikost).replace('.', ',') + (P.stav.fit ? '+' : '') : ''), aplikuj: (v) => P.velikost(v) }),
      male(P, { ik: 'zvetsit', titulek: 'Zvětšit velikost písma', klavesa: 'Ctrl+Shift+>', akce: () => P.formatuj('vetsi') }),
      male(P, { ik: 'zmensit', titulek: 'Zmenšit velikost písma', klavesa: 'Ctrl+Shift+<', akce: () => P.formatuj('mensi') }),
      oddelovac(),
      male(P, { ik: 'vymazatFormat', titulek: 'Vymazat veškeré formátování', klavesa: 'Ctrl+mezerník', akce: () => P.formatuj('vymazat') }),
    ),
    radek(
      male(P, { ik: 'tucne', titulek: 'Tučné', klavesa: 'Ctrl+B', akce: () => P.formatuj('tucne'), stav: () => P.stav.tucne }),
      male(P, { ik: 'kurziva', titulek: 'Kurzíva', klavesa: 'Ctrl+I', akce: () => P.formatuj('kurziva'), stav: () => P.stav.kurziva }),
      male(P, { ik: 'podtrzeni', titulek: 'Podtržení', klavesa: 'Ctrl+U', akce: () => P.formatuj('podtrzeni'), stav: () => P.stav.podtrzeni }),
      male(P, { ik: 'stinTextu', titulek: 'Stín textu', akce: () => P.formatuj('stin'), stav: () => P.stav.stin }),
      male(P, { ik: 'preskrtnuti', titulek: 'Přeškrtnutí', akce: () => P.formatuj('preskrtnuti'), stav: () => P.stav.preskrtnuti }),
      male(P, { ik: 'rozestupZnaku', titulek: 'Mezery mezi znaky', rozbal: () => nabidka([
        ...[[-3, 'Velmi těsné'], [-1.5, 'Těsné'], [0, 'Normální'], [3, 'Volné'], [6, 'Velmi volné']].map(([v, t]) => ({ text: t, zaskrtnuto: (P.stav.rozestup || 0) === v, akce: () => P.formatuj('rozestup', v) })),
      ], { sirka: 200 }) }),
      male(P, { ik: 'velikostPismen', titulek: 'Velká a malá písmena', rozbal: () => nabidka([
        { text: 'Jako ve větě.', akce: () => P.formatuj('pismena', 'veta') },
        { text: 'malá písmena', akce: () => P.formatuj('pismena', 'mala') },
        { text: 'VELKÁ PÍSMENA', akce: () => P.formatuj('pismena', 'velka') },
        { text: 'Velká Na Začátku Slov', akce: () => P.formatuj('pismena', 'slova') },
        { text: 'pŘEPNOUT vELIKOST pÍSMEN', akce: () => P.formatuj('pismena', 'prepnout') },
      ]) }),
      oddelovac(),
      delene(P, { ik: 'zvyraznovac', titulek: 'Barva zvýraznění textu', barva: () => posledniZvyr, akce: () => P.formatuj('zvyrazneni', posledniZvyr), rozbal: () => paletaZvyrazneni((b) => { posledniZvyr = b || 'transparent'; P.formatuj('zvyrazneni', b); P.obnov(); }) }),
      delene(P, { ik: 'barvaPisma', titulek: 'Barva písma', barva: () => barva(P.barvy(), posledniPismo), akce: () => P.formatuj('barva', posledniPismo), rozbal: () => paletaMotivu(P, { onVyber: (x) => { if (x !== 'auto') posledniPismo = x; P.formatuj('barva', x); P.obnov(); } }) }),
    ),
  ], { spoustec: () => P.dialogPismo(), priorita: 8, ikona: 'barvaPisma' });

  const odstavec = skupina('Odstavec', [
    radek(
      delene(P, { ik: 'odrazky', titulek: 'Odrážky', akce: () => P.odrazky(), stav: () => P.stav.odrazky, rozbal: () => el('div.ps-knihovna', {},
        el('div.ps-knihovna-mrizka.pr-odrazky', {}, [['ne', 'Žádné'], ...ODRAZKY].map(([z, t]) => el('button.ps-knihovna-pol', { type: 'button', title: t, onclick: () => { zavriRozbal(); P.odrazky(z); } }, z === 'ne' ? el('span.pr-zadne', { text: 'Žádné' }) : el('span', {}, el('b', { text: z }), el('i'), el('b', { text: z }), el('i'), el('b', { text: z }), el('i'))))),
        nabidka(['sep', { text: 'Odrážky a číslování…', akce: () => P.dialogOdrazky() }])) }),
      delene(P, { ik: 'cislovani', titulek: 'Číslování', akce: () => P.cislovani(), stav: () => P.stav.cislovani, rozbal: () => el('div.ps-knihovna', {},
        el('div.ps-knihovna-mrizka.pr-odrazky', {}, [['ne', 'Žádné'], ['1.', '1. 2. 3.'], ['1)', '1) 2) 3)'], ['I.', 'I. II. III.'], ['A.', 'A. B. C.'], ['a)', 'a) b) c)'], ['a.', 'a. b. c.'], ['i.', 'i. ii. iii.']].map(([z, t]) => el('button.ps-knihovna-pol', { type: 'button', title: t, onclick: () => { zavriRozbal(); P.cislovani(z); } }, z === 'ne' ? el('span.pr-zadne', { text: 'Žádné' }) : el('span', {}, ...t.split(' ').flatMap((c) => [el('b', { text: c }), el('i')]))))),
        nabidka(['sep', { text: 'Odrážky a číslování…', akce: () => P.dialogOdrazky(true) }])) }),
      oddelovac(),
      male(P, { ik: 'zmensitOdsazeni', titulek: 'Snížit úroveň seznamu', klavesa: 'Shift+Tab', akce: () => P.uroven(-1) }),
      male(P, { ik: 'zvetsitOdsazeni', titulek: 'Zvýšit úroveň seznamu', klavesa: 'Tab', akce: () => P.uroven(1) }),
      oddelovac(),
      male(P, { ik: 'radkovani', titulek: 'Řádkování', rozbal: () => nabidka([
        ...[1, 1.5, 2, 2.5, 3].map((v) => ({ text: String(v).replace('.', ','), zaskrtnuto: P.stav.radkovani === v, akce: () => P.radkovani(v) })),
        'sep', { text: 'Možnosti řádkování…', akce: () => P.dialogOdstavec() },
      ], { sirka: 190 }) }),
      male(P, { ik: 'smerTextu', titulek: 'Směr textu', rozbal: () => nabidka([
        { text: 'Vodorovně', akce: () => P.smerTextu(false) },
        { text: 'Otočit veškerý text o 270°', akce: () => P.smerTextu('270') },
        { text: 'Svisle', akce: () => P.smerTextu(true) },
      ], { sirka: 230 }) }),
    ),
    radek(
      male(P, { ik: 'zarovnatVlevo', titulek: 'Zarovnat text doleva', klavesa: 'Ctrl+L', akce: () => P.formatuj('zarL'), stav: () => P.stav.zar === 'l' }),
      male(P, { ik: 'zarovnatNaStred', titulek: 'Zarovnat na střed', klavesa: 'Ctrl+E', akce: () => P.formatuj('zarC'), stav: () => P.stav.zar === 'c' }),
      male(P, { ik: 'zarovnatVpravo', titulek: 'Zarovnat text doprava', klavesa: 'Ctrl+R', akce: () => P.formatuj('zarR'), stav: () => P.stav.zar === 'r' }),
      male(P, { ik: 'zarovnatDoBloku', titulek: 'Do bloku', klavesa: 'Ctrl+J', akce: () => P.formatuj('zarJ'), stav: () => P.stav.zar === 'j' }),
      male(P, { ik: 'sloupce', titulek: 'Přidat nebo odebrat sloupce', rozbal: () => nabidka([1, 2, 3].map((n) => ({ text: ['Jeden sloupec', 'Dva sloupce', 'Tři sloupce'][n - 1], zaskrtnuto: (P.stav.sloupce || 1) === n, akce: () => P.sloupce(n) })), { sirka: 180 }) }),
      oddelovac(),
      male(P, { ik: 'zarovnatText', titulek: 'Zarovnat text', rozbal: () => nabidka([['t', 'Nahoru'], ['m', 'Doprostřed'], ['b', 'Dolů']].map(([v, t]) => ({ text: t, zaskrtnuto: P.stav.svisle === v, akce: () => P.zarovnatText(v) })), { sirka: 170 }) }),
      male(P, { ik: 'prevestSmartArt', titulek: 'Převést na obrázek SmartArt', rozbal: () => nabidkaSmartArt(P, true) }),
    ),
  ], { spoustec: () => P.dialogOdstavec(), priorita: 7, ikona: 'zarovnatVlevo' });

  const tvaryGal = el('div.pr-tvary-gal', {}, ['textove', 'cara', 'caraSipka', 'obdelnik', 'oval', 'trojuhelnik', 'pravouhly', 'sipkaVpravo', 'zaobleny', 'petiuhelnikSipka', 'kosoctverec', 'hvezda5', 'bublina', 'srdce', 'krokev', 'sestiuhelnik', 'oblak', 'blesk'].map((t) =>
    zadrz(el('button.pr-tvar-pol', { type: 'button', title: JMENA_TVARU[t], onclick: () => P.vlozTvar(t) }, ikonaTvaru(t)))));
  const tvaryVse = zadrz(el('button.ps-gal-sipka', { type: 'button', title: 'Obrazce' }, el('span', { text: '⌄' })));
  tvaryVse.onclick = () => rozbal(tvaryVse, nabidkaTvaru(P));
  const kresleni = skupina('Kreslení', [
    el('div.ps-galerie-ram.pr-tvary-ram', {}, tvaryGal, el('div.ps-gal-sipky', {},
      zadrz(el('button.ps-gal-sipka', { type: 'button', title: 'Nahoru', onclick: () => tvaryGal.scrollBy({ top: -46, behavior: 'smooth' }) }, el('span', { text: '⌃' }))),
      zadrz(el('button.ps-gal-sipka', { type: 'button', title: 'Dolů', onclick: () => tvaryGal.scrollBy({ top: 46, behavior: 'smooth' }) }, el('span', { text: '⌄' }))),
      tvaryVse)),
    velke(P, { ik: 'usporadat', text: 'Uspořádat', rozbal: () => nabidkaUsporadat(P) }),
    velke(P, { ik: 'rychleStyly', text: 'Rychlé\nstyly', rozbal: () => galerieRychlychStylu(P) }),
    sloupec(
      delene(P, { ik: 'vyplnTvaru', titulek: 'Výplň obrazce', barva: () => barva(P.barvy(), posledniVypln), akce: () => P.vyplnTvaru(posledniVypln), rozbal: () => paletaMotivu(P, { auto: 'Bez výplně', bezBarvy: true, onVyber: (x) => { if (x !== 'none') posledniVypln = x; P.vyplnTvaru(x); P.obnov(); }, dalsi: [el('button.ps-nab-polozka', { type: 'button', onclick: () => { zavriRozbal(); P.vyplnObrazkem(); } }, el('span.ps-nab-ik', {}, ik('obrazky')), el('span', { text: 'Obrázek…' })), el('button.ps-nab-polozka', { type: 'button', onclick: () => { zavriRozbal(); P.vyplnPrechodem(); } }, el('span.ps-nab-ik'), el('span', { text: 'Přechod' }))] }) }),
      delene(P, { ik: 'obrysTvaru', titulek: 'Obrys obrazce', barva: () => barva(P.barvy(), posledniObrys), akce: () => P.obrysTvaru({ barva: posledniObrys }), rozbal: () => nabidkaObrysu(P) }),
      male(P, { ik: 'efektyTvaru', titulek: 'Efekty obrazce', rozbal: () => nabidkaEfektu(P) }),
    ),
  ], { spoustec: () => P.podokno('format'), priorita: 5, ikona: 'tvary' });

  const upravy = skupina('Úpravy', [
    sloupec(
      male(P, { ik: 'najitMaly', text: 'Najít', klavesa: 'Ctrl+F', akce: () => P.najit() }),
      male(P, { ik: 'nahradit', text: 'Nahradit', klavesa: 'Ctrl+H', rozbal: () => nabidka([{ text: 'Nahradit…', ikona: 'nahradit', akce: () => P.najit(true) }, { text: 'Nahradit písma…', akce: () => P.nahraditPisma() }], { sirka: 190 }) }),
      male(P, { ik: 'vybrat', text: 'Vybrat', rozbal: () => nabidka([
        { text: 'Vybrat vše', klavesa: 'Ctrl+A', akce: () => P.vybratVse() },
        { text: 'Vybrat objekty', akce: () => P.vybratVse(true) },
        { text: 'Podokno výběru…', ikona: 'podoknoVyberu', akce: () => P.podokno('vyber') },
      ], { sirka: 200 }) }),
    ),
  ], { priorita: 4, ikona: 'najit' });

  return [
    schranka, snimky, pismo, odstavec, kresleni, upravy,
    skupina('Hlas', [velke(P, { ik: 'diktovat', text: 'Diktovat', stav: () => !!P.st.diktovani, akce: () => P.diktovat() })], { priorita: 2, ikona: 'diktovat' }),
    skupina('Designer', [velke(P, { ik: 'designer', text: 'Designer', stav: () => P.st.podokno === 'designer', akce: () => P.podokno(P.st.podokno === 'designer' ? null : 'designer') })], { priorita: 3, ikona: 'designer' }),
    skupina('AstroAI', [velke(P, { ik: 'astroai', text: 'AstroAI', stav: () => P.st.podokno === 'ai', akce: () => P.podokno(P.st.podokno === 'ai' ? null : 'ai') })], { priorita: 2, ikona: 'astroai' }),
  ];
}

function nabidkaUsporadat(P) {
  const sub = (nazev, ikona, polozky) => ({ uzel: el('button.ps-nab-polozka.tb-sub', { type: 'button', onclick: (e) => { e.stopPropagation(); rozbal(e.currentTarget, nabidka(polozky, { sirka: 230 }), { app: 'prezentace' }); } }, el('span.ps-nab-ik', {}, ik(ikona)), el('span.ps-nab-text', { text: nazev }), el('span.tb-sub-sipka', { text: '›' })) });
  const nic = !P.ed.vyber.length;
  return nabidka([
    { nadpis: 'Seřadit objekty' },
    { text: 'Přenést do popředí', ikona: 'dopredu', zakazano: nic, akce: () => P.usporadat('popredi') },
    { text: 'Přenést do pozadí', ikona: 'dozadu', zakazano: nic, akce: () => P.usporadat('pozadi') },
    { text: 'Přenést blíž', ikona: 'dopredu', zakazano: nic, akce: () => P.usporadat('dopredu') },
    { text: 'Přenést dál', ikona: 'dozadu', zakazano: nic, akce: () => P.usporadat('dozadu') },
    { nadpis: 'Umístit objekty' },
    sub('Zarovnat', 'zarovnatObjekty', [
      { text: 'Zarovnat doleva', akce: () => P.zarovnatObjekty('l') }, { text: 'Zarovnat na střed', akce: () => P.zarovnatObjekty('c') }, { text: 'Zarovnat doprava', akce: () => P.zarovnatObjekty('r') },
      'sep', { text: 'Zarovnat nahoru', akce: () => P.zarovnatObjekty('t') }, { text: 'Zarovnat doprostřed', akce: () => P.zarovnatObjekty('m') }, { text: 'Zarovnat dolů', akce: () => P.zarovnatObjekty('b') },
      'sep', { text: 'Rozmístit vodorovně', akce: () => P.zarovnatObjekty('rozmistitH') }, { text: 'Rozmístit svisle', akce: () => P.zarovnatObjekty('rozmistitV') },
      'sep', { text: 'Zarovnat ke snímku', zaskrtnuto: P.st.zarovnatKeSnimku !== false, akce: () => { P.st.zarovnatKeSnimku = true; } }, { text: 'Zarovnat vybrané objekty', zaskrtnuto: P.st.zarovnatKeSnimku === false, akce: () => { P.st.zarovnatKeSnimku = false; } },
    ]),
    sub('Otočit', 'otocitObjekt', [
      { text: 'Otočit doprava o 90°', akce: () => P.otocit(90) }, { text: 'Otočit doleva o 90°', akce: () => P.otocit(-90) },
      { text: 'Překlopit svisle', akce: () => P.otocit('svisle') }, { text: 'Překlopit vodorovně', akce: () => P.otocit('vodorovne') },
    ]),
    'sep',
    { text: 'Podokno výběru…', ikona: 'podoknoVyberu', akce: () => P.podokno('vyber') },
  ], { sirka: 240 });
}

function galerieRychlychStylu(P, cil = (s) => P.rychlyStyl(s)) {
  const b = P.barvy();
  const styly = rychleStyly();
  return el('div.pr-rychle-styly', {},
    el('div.ps-nab-nadpis', { text: 'Styly motivu' }),
    el('div.pr-rs-mrizka', {}, styly.map((s) => {
      const bt = el('button.pr-rs-pol', { type: 'button', title: s.nazev, onclick: () => { zavriRozbal(); cil(s); } }, el('span', { text: 'Abc' }));
      Object.assign(bt.style, {
        background: s.prechod ? `linear-gradient(180deg, ${barva(b, s.prechod[0])}, ${barva(b, s.prechod[1])})` : barva(b, s.vypln),
        border: s.obrys === 'none' ? '1px solid transparent' : `1.5px solid ${barva(b, s.obrys)}`, color: barva(b, s.text),
        boxShadow: s.efekty?.stin ? '2px 2px 3px rgba(0,0,0,.35)' : 'none',
      });
      return bt;
    })),
    el('div.ps-nab-nadpis', { text: 'Předvolby' }),
    el('div.pr-rs-mrizka', {}, ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'tx'].map((f) => {
      const bt = el('button.pr-rs-pol', { type: 'button', title: 'Průhledná výplň', onclick: () => { zavriRozbal(); cil({ vypln: 'none', obrys: f, text: f === 'tx' ? 'tx' : f }); } }, el('span', { text: 'Abc' }));
      Object.assign(bt.style, { background: 'transparent', border: `1.5px dashed ${barva(b, f)}`, color: barva(b, f) });
      return bt;
    })));
}

function nabidkaSmartArt(P, prevest = false) {
  const typy = [['seznam', 'Základní seznam bloků'], ['proces', 'Základní proces'], ['cyklus', 'Základní cyklus'], ['hierarchie', 'Organizační diagram'], ['pyramida', 'Základní pyramida'], ['vennuv', 'Základní Vennův diagram'], ['casovaOsa', 'Základní časová osa'], ['svisly', 'Svislý seznam s odrážkami']];
  const nahled = (t) => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 60 40');
    const c = '#156082';
    s.innerHTML = {
      seznam: `<rect x="3" y="6" width="16" height="12" fill="${c}"/><rect x="22" y="6" width="16" height="12" fill="${c}"/><rect x="41" y="6" width="16" height="12" fill="${c}"/><rect x="12" y="22" width="16" height="12" fill="${c}"/><rect x="31" y="22" width="16" height="12" fill="${c}"/>`,
      proces: `<rect x="2" y="13" width="14" height="14" fill="${c}"/><path d="M18 20h4M21 18l2 2-2 2" stroke="#999" fill="none"/><rect x="24" y="13" width="14" height="14" fill="${c}"/><path d="M40 20h4M43 18l2 2-2 2" stroke="#999" fill="none"/><rect x="46" y="13" width="12" height="14" fill="${c}"/>`,
      cyklus: `<circle cx="30" cy="8" r="6" fill="${c}"/><circle cx="46" cy="28" r="6" fill="${c}"/><circle cx="14" cy="28" r="6" fill="${c}"/><path d="M37 11l6 10M40 30H20M17 21l7-10" stroke="#999" fill="none"/>`,
      hierarchie: `<rect x="22" y="3" width="16" height="10" fill="${c}"/><rect x="4" y="25" width="14" height="10" fill="${c}"/><rect x="23" y="25" width="14" height="10" fill="${c}"/><rect x="42" y="25" width="14" height="10" fill="${c}"/><path d="M30 13v6M11 19h38M11 19v6M30 19v6M49 19v6" stroke="#999" fill="none"/>`,
      pyramida: `<path d="M30 3l8 10H22z" fill="${c}"/><path d="M21 15h18l7 10H14z" fill="${c}" opacity=".8"/><path d="M13 27h34l7 10H6z" fill="${c}" opacity=".6"/>`,
      vennuv: `<circle cx="22" cy="16" r="11" fill="${c}" opacity=".55"/><circle cx="38" cy="16" r="11" fill="${c}" opacity=".55"/><circle cx="30" cy="28" r="11" fill="${c}" opacity=".55"/>`,
      casovaOsa: `<path d="M3 20h54" stroke="${c}" stroke-width="3"/><circle cx="12" cy="20" r="3" fill="#fff" stroke="${c}" stroke-width="2"/><circle cx="30" cy="20" r="3" fill="#fff" stroke="${c}" stroke-width="2"/><circle cx="48" cy="20" r="3" fill="#fff" stroke="${c}" stroke-width="2"/><rect x="5" y="6" width="14" height="7" fill="${c}"/><rect x="23" y="27" width="14" height="7" fill="${c}"/><rect x="41" y="6" width="14" height="7" fill="${c}"/>`,
      svisly: `<rect x="4" y="3" width="52" height="9" fill="${c}"/><rect x="4" y="15" width="52" height="9" fill="${c}"/><rect x="4" y="27" width="52" height="9" fill="${c}"/>`,
    }[t];
    return s;
  };
  return el('div.pr-smartart-nab', {},
    el('div.pr-smartart-mrizka', {}, typy.map(([t, n]) => el('button.pr-smartart-pol', { type: 'button', title: n, onclick: () => { zavriRozbal(); P.vlozSmartArt(t, prevest); } }, nahled(t)))),
    nabidka(['sep', { text: 'Další obrázky SmartArt…', akce: () => P.dialogSmartArt(prevest) }]));
}

// ---------------------------------------------------------------- Vložení
function kartaVlozeni(P) {
  const mrizkaTabulky = () => {
    const info = el('div.ps-nab-nadpis', { text: 'Vložit tabulku' });
    const mr = el('div.ps-vyber-mrizka');
    for (let r = 0; r < 8; r++) for (let c = 0; c < 10; c++) {
      const b = el('button', { type: 'button', dataset: { r, c } });
      b.onmouseenter = () => { info.textContent = `Tabulka ${c + 1}×${r + 1}`; mr.querySelectorAll('button').forEach((x) => x.classList.toggle('zap', +x.dataset.r <= r && +x.dataset.c <= c)); };
      b.onclick = () => { zavriRozbal(); P.vlozTabulku(r + 1, c + 1); };
      mr.append(b);
    }
    return el('div', {}, info, mr, nabidka(['sep', { text: 'Vložit tabulku…', ikona: 'tabulka', akce: () => P.dialogTabulka() }, { text: 'Nakreslit tabulku', zakazano: true }, { text: 'Tabulka aplikace AstroTabulky', ikona: 'list', akce: () => P.tabulkaZExcelu() }]));
  };
  return [
    skupina('Snímky', [velke(P, { ik: 'novySnimek', text: 'Nový\nsnímek', deleno: true, akce: () => P.novySnimek(), rozbal: () => galerieRozvrzeni(P, (id) => P.novySnimek(id)) })], { priorita: 6, ikona: 'novySnimek' }),
    skupina('Tabulky', [velke(P, { ik: 'tabulka', text: 'Tabulka', rozbal: mrizkaTabulky })], { priorita: 5, ikona: 'tabulka' }),
    skupina('Obrázky', [
      velke(P, { ik: 'obrazky', text: 'Obrázky', rozbal: () => nabidka([
        { nadpis: 'Vložit obrázek z' },
        { text: 'Toto zařízení…', ikona: 'pocitac', akce: () => P.vlozObrazekZeZarizeni() },
        { text: 'Obrázky v AstroOS…', ikona: 'slozka', akce: () => P.vlozObrazekZDisku() },
      ], { sirka: 220 }) }),
      velke(P, { ik: 'fotoalbum', text: 'Fotoalbum', akce: () => P.fotoalbum() }),
    ], { priorita: 5, ikona: 'obrazky' }),
    skupina('Ilustrace', [
      velke(P, { ik: 'tvary', text: 'Obrazce', rozbal: () => nabidkaTvaru(P) }),
      velke(P, { ik: 'ikonyVlozit', text: 'Ikony', akce: () => P.dialogIkony() }),
      velke(P, { ik: 'smartart', text: 'SmartArt', rozbal: () => nabidkaSmartArt(P) }),
      velke(P, { ik: 'grafSloupce', text: 'Graf', akce: () => P.dialogGraf() }),
    ], { priorita: 4, ikona: 'tvary' }),
    skupina('Odkazy', [velke(P, { ik: 'odkaz', text: 'Odkaz', klavesa: 'Ctrl+K', akce: () => P.dialogOdkaz() })], { priorita: 3, ikona: 'odkaz' }),
    skupina('Komentáře', [velke(P, { ik: 'komentarNovy', text: 'Komentář', akce: () => P.novyKomentar() })], { priorita: 3, ikona: 'komentarNovy' }),
    skupina('Text', [
      velke(P, { ik: 'textovePole', text: 'Textové\npole', akce: () => P.vlozTextovePole() }),
      velke(P, { ik: 'zahlavi', text: 'Záhlaví\na zápatí', akce: () => P.dialogZapati() }),
      velke(P, { ik: 'wordart', text: 'WordArt', rozbal: () => el('div.pr-wordart-gal', {}, WORDART.map((w) => {
        const bt = el('button.pr-wa-pol', { type: 'button', title: w.nazev, onclick: () => { zavriRozbal(); P.vlozWordArt(w.id); } }, el('span', { text: 'A' }));
        Object.assign(bt.firstChild.style, w.styl(P.barvy()));
        return bt;
      })) }),
      sloupec(
        male(P, { ik: 'datumCas', text: 'Datum a čas', akce: () => P.dialogZapati('datum') }),
        male(P, { ik: 'cisloSnimku', text: 'Číslo snímku', akce: () => P.dialogZapati('cislo') }),
      ),
    ], { priorita: 4, ikona: 'textovePole' }),
    skupina('Symboly', [
      velke(P, { ik: 'rovnice', text: 'Rovnice', rozbal: () => nabidka([
        { nadpis: 'Předdefinované' },
        ...['a² + b² = c²', 'x = (−b ± √(b² − 4ac)) / 2a', 'S = π · r²', 'E = m · c²', 'v = s / t', '(x + a)ⁿ = Σ (ⁿₖ) xᵏ aⁿ⁻ᵏ'].map((r) => ({ text: r, styl: { fontFamily: 'Cambria Math, Cambria, Georgia, serif', fontStyle: 'italic' }, akce: () => P.vlozRovnici(r) })),
        'sep', { text: 'Vložit novou rovnici', akce: () => P.vlozRovnici('Sem zadejte rovnici.') },
      ], { sirka: 290 }) }),
      velke(P, { ik: 'symbol', text: 'Symbol', rozbal: () => nabidkaSymbolu(P) }),
    ], { priorita: 3, ikona: 'symbol' }),
    skupina('Média', [
      velke(P, { ik: 'zvuk', text: 'Zvuk', rozbal: () => nabidka([
        { text: 'Zvuk z Nahrávek…', ikona: 'slozka', akce: () => P.vlozZvuk() },
        { text: 'Zvuk ze zařízení…', ikona: 'pocitac', akce: () => P.vlozZvukZeZarizeni() },
        { text: 'Nahrát zvuk…', ikona: 'diktovat', akce: () => P.nahratZvuk() },
      ], { sirka: 210 }) }),
    ], { priorita: 2, ikona: 'zvuk' }),
  ];
}

function nabidkaSymbolu(P) {
  const znaky = '©®™°±×÷≠≈≤≥∞√∑π€£¥§¶•…–—‘’„“«»←↑→↓↔⇒★☆♥♦♣♠✓✗☺☼♪♫αβγδΩµ½¼¾²³'.split('');
  return el('div.pr-symboly', {}, el('div.ps-nab-nadpis', { text: 'Symboly' }), el('div.pr-symboly-mrizka', {}, znaky.map((z) => el('button', { type: 'button', text: z, onclick: () => { zavriRozbal(); P.vlozSymbol(z); } }))));
}

// ---------------------------------------------------------------- Kreslení
function kartaKresleni(P) {
  const nastroj = (id, ikona, text, barvaPera, sirka, zvyr) => velke(P, {
    ik: ikona, text, titulek: text.replace('\n', ' '), stav: () => P.st.kresleni?.id === id,
    akce: () => P.kreslit(P.st.kresleni?.id === id ? null : { id, barva: barvaPera, sirka, zvyr }),
  });
  return [
    skupina('Nástroje pro kreslení', [
      velke(P, { ik: 'vybrat', text: 'Vybrat', stav: () => !P.st.kresleni, akce: () => P.kreslit(null) }),
      nastroj('guma', 'guma', 'Guma', null, 0, false),
      nastroj('cerne', 'pero', 'Pero\nčerné', '#000000', 2.5, false),
      nastroj('cervene', 'pero', 'Pero\nčervené', '#E71224', 2.5, false),
      nastroj('modre', 'pero', 'Pero\nmodré', '#0F6CBD', 2.5, false),
      nastroj('zvyr', 'zvyraznovacKresleni', 'Zvýraz-\nňovač', '#FFFF00', 14, true),
    ], { priorita: 5, ikona: 'pero' }),
    skupina('Upravit', [velke(P, { ik: 'guma', text: 'Smazat\nrukopis', akce: () => P.smazatRukopis() })], { priorita: 3, ikona: 'guma' }),
    skupina('Převést', [velke(P, { ik: 'kresleni', text: 'Rukopis na\nobrazec', zakazano: true }), velke(P, { ik: 'rovnice', text: 'Rukopis na\nmatematiku', zakazano: true })], { priorita: 1, ikona: 'kresleni' }),
    skupina('Přehrát', [velke(P, { ik: 'nahled', text: 'Přehrát\nrukopis', akce: () => P.prehratRukopis() })], { priorita: 2, ikona: 'nahled' }),
  ];
}

// ---------------------------------------------------------------- Návrh
function nahledMotivu(P, m, varianta = 0) {
  const b = barvyMotivu(m.id, varianta);
  const n = el('div.pr-motiv-nahled', { style: { background: b.bg } }, pozadiMotivu(P, true, m.id, varianta),
    el('span.pr-motiv-aa', { text: 'Aa', style: { fontFamily: zasobnikPisma(m.pismo.nadpis), color: m.titulni ? m.titulni.tx : b.tx } }),
    el('div.pr-motiv-barvy', {}, b.a.map((x) => el('i', { style: { background: x } }))));
  return n;
}
function kartaNavrh(P) {
  const motivy = () => MOTIVY.map((m) => {
    const bt = zadrz(el('button.pr-motiv-pol' + (P.pres.motiv === m.id ? '.zapnuto' : ''), { type: 'button', title: m.nazev, onclick: () => { zavriRozbal(); P.nastavMotiv(m.id); } }, nahledMotivu(P, m)));
    return bt;
  });
  const varianty = () => {
    const m = MOTIVY.find((x) => x.id === P.pres.motiv) || MOTIVY[0];
    return m.varianty.map((_, i) => zadrz(el('button.pr-motiv-pol' + (P.pres.varianta === i ? '.zapnuto' : ''), { type: 'button', title: `Varianta ${i + 1}`, onclick: () => { zavriRozbal(); P.nastavVariantu(i); } }, nahledMotivu(P, m, i))));
  };
  return [
    skupina('Motivy', [galerie(P, { polozky: motivy, sirka: 452, vyska: 70, cls: 'motivy', rozbalene: () => el('div.pr-gal-vse.motivy', {}, el('div.ps-nab-nadpis', { text: 'Office' }), el('div.pr-gal-mrizka', {}, motivy()), nabidka(['sep', { text: 'Uložit aktuální motiv…', zakazano: true }])) })], { priorita: 6, ikona: 'motivy' }),
    skupina('Varianty', [galerie(P, { polozky: varianty, sirka: 250, vyska: 70, cls: 'motivy', rozbalene: () => nabidkaVariant(P) })], { priorita: 4, ikona: 'motivy' }),
    skupina('Přizpůsobit', [
      velke(P, { ik: 'velikostSnimku', text: 'Velikost\nsnímku', rozbal: () => nabidka([
        ...VELIKOSTI_SNIMKU.slice(0, 2).map((v) => ({ text: v.nazev, zaskrtnuto: P.pres.velikost.id === v.id, akce: () => P.velikostSnimku(v.id) })),
        'sep', { text: 'Vlastní velikost snímku…', akce: () => P.dialogVelikostSnimku() },
      ], { sirka: 230 }) }),
      velke(P, { ik: 'formatPozadi', text: 'Formát\npozadí', stav: () => P.st.podokno === 'pozadi', akce: () => P.podokno(P.st.podokno === 'pozadi' ? null : 'pozadi') }),
    ], { priorita: 5, ikona: 'velikostSnimku' }),
    skupina('Designer', [velke(P, { ik: 'designer', text: 'Designer', stav: () => P.st.podokno === 'designer', akce: () => P.podokno(P.st.podokno === 'designer' ? null : 'designer') })], { priorita: 3, ikona: 'designer' }),
  ];
}
function nabidkaVariant(P) {
  const sub = (nazev, obsah) => el('button.ps-nab-polozka.tb-sub', { type: 'button', onclick: (e) => { e.stopPropagation(); rozbal(e.currentTarget, obsah(), { app: 'prezentace' }); } }, el('span.ps-nab-ik'), el('span.ps-nab-text', { text: nazev }), el('span.tb-sub-sipka', { text: '›' }));
  return el('div.ps-nabidka', { style: { width: '220px' } },
    sub('Barvy', () => nabidka(MOTIVY.map((m) => ({ uzel: el('button.ps-nab-polozka', { type: 'button', onclick: () => { zavriRozbal(); P.nastavBarvyZMotivu(m.id); } }, el('span.ps-barvy-vzor', {}, barvyMotivu(m.id).a.map((x) => el('i', { style: { background: x } }))), el('span', { text: m.nazev })) })), { sirka: 260 })),
    sub('Písma', () => nabidka(MOTIVY.map((m) => ({ uzel: el('button.ps-nab-polozka.ps-pisma-motivu', { type: 'button', onclick: () => { zavriRozbal(); P.nastavPismaZMotivu(m.id); } }, el('span.ps-pm-aa', { text: 'Aa', style: { fontFamily: zasobnikPisma(m.pismo.nadpis) } }), el('span', {}, el('b', { text: m.nazev }), el('span', { text: m.pismo.nadpis, style: { fontFamily: zasobnikPisma(m.pismo.nadpis) } }), el('span', { text: m.pismo.telo, style: { fontFamily: zasobnikPisma(m.pismo.telo) } }))) })), { sirka: 260 })),
    sub('Styly pozadí', () => {
      const b = P.barvy();
      const styly = [['bg'], ['bg2'], ['tx2'], ['tx'], ['bg', 'bg2'], ['bg2', 'bg'], ['tx2', 'tx'], ['a1', 'tx2'], ['bg', 'a1+80'], ['a1+80', 'bg'], ['bg2', 'a2+60'], ['tx2', 'a1']];
      return el('div.pr-styly-pozadi', {}, styly.map((s) => el('button', { type: 'button', style: { background: s.length === 1 ? barva(b, s[0]) : `linear-gradient(180deg, ${barva(b, s[0])}, ${barva(b, s[1])})` }, onclick: () => { zavriRozbal(); P.nastavPozadi(s.length === 1 ? { typ: 'barva', b: s[0] } : { typ: 'prechod', b1: s[0], b2: s[1], uhel: 180 }, true); } })));
    }));
}

// ---------------------------------------------------------------- Přechody
function kartaPrechody(P) {
  const pr = () => P.snimek()?.prechod || { typ: 'zadny' };
  const polozky = () => PRECHODY.flatMap((sk) => sk.polozky).map(([id, n]) => zadrz(el('button.pr-efekt-pol' + ((pr().typ || 'zadny') === id ? '.zapnuto' : ''), { type: 'button', title: n, onclick: () => { zavriRozbal(); P.nastavPrechod({ typ: id, smer: undefined, trvani: undefined }); } }, ikonaPrechodu(id), el('span', { text: n }))));
  const vse = () => el('div.pr-gal-vse.efekty', {}, PRECHODY.map((sk) => [el('div.ps-nab-nadpis', { text: sk.skupina }), el('div.pr-gal-mrizka', {}, sk.polozky.map(([id, n]) => el('button.pr-efekt-pol' + ((pr().typ || 'zadny') === id ? '.zapnuto' : ''), { type: 'button', title: n, onclick: () => { zavriRozbal(); P.nastavPrechod({ typ: id, smer: undefined, trvani: undefined }); } }, ikonaPrechodu(id), el('span', { text: n }))))]).flat());
  const auto = el('input', { type: 'checkbox' });
  const klik = el('input', { type: 'checkbox' });
  auto.onchange = () => P.nastavPrechod({ auto: auto.checked ? (pr().auto ?? 0) || 0 : null });
  klik.onchange = () => P.nastavPrechod({ bezKliku: !klik.checked });
  P.obnovy.push(() => { auto.checked = pr().auto !== undefined && pr().auto !== null; klik.checked = !pr().bezKliku; });
  return [
    skupina('Náhled', [velke(P, { ik: 'nahled', text: 'Náhled', akce: () => P.nahledPrechodu() })], { priorita: 6, ikona: 'nahled' }),
    skupina('Přechod na tento snímek', [
      galerie(P, { polozky, sirka: 610, vyska: 70, cls: 'efekty', rozbalene: vse }),
      velke(P, { ik: 'moznostiEfektu', text: 'Možnosti\nefektu', rozbal: () => {
        const m = MOZNOSTI_PRECHODU[pr().typ];
        if (!m) return nabidka([{ text: 'Pro tento přechod nejsou žádné možnosti.', zakazano: true }], { sirka: 250 });
        const akt = pr().smer || m[0][0];
        return nabidka(m.map(([v, t]) => ({ text: t, zaskrtnuto: akt === v, akce: () => P.nastavPrechod({ smer: v }) })), { sirka: 200 });
      } }),
    ], { priorita: 5, ikona: 'prechodIk' }),
    skupina('Časování', [
      sloupec(
        radek(el('span.pr-pas-popis', {}, ik('zvukPrechodu'), 'Zvuk:'), kombo(P, { titulek: 'Zvuk přechodu', sirka: 90, hodnoty: () => ZVUKY.map((z) => z[1]), zobraz: () => ZVUKY.find((z) => z[0] === (pr().zvuk || ''))?.[1] || '[Bez zvuku]', aplikuj: (v) => P.nastavPrechod({ zvuk: ZVUKY.find((z) => z[1] === v)?.[0] || '' }) })),
        radek(el('span.pr-pas-popis', {}, ik('trvani'), 'Doba trvání:'), spinner(P, { krok: 0.25, min: 0.01, max: 59, sirka: 54, cti: () => (pr().typ === 'zadny' ? '' : (pr().trvani ?? VYCHOZI_DELKA[pr().typ] ?? 1)), zapis: (v) => P.nastavPrechod({ trvani: v }), format: (v) => Number(v).toFixed(2).replace('.', ',') })),
        male(P, { ik: 'pouzitVse', text: 'Použít u všech', akce: () => P.nastavPrechod({}, true) }),
      ),
      sloupec(
        el('div.pr-pas-nadpis', { text: 'Přechod na další snímek' }),
        zadrz(el('label.ps-zaskrt', {}, klik, el('span', { text: 'Po kliknutí myší' }))),
        radek(zadrz(el('label.ps-zaskrt', {}, auto, el('span', { text: 'Po:' }))), spinner(P, { krok: 1, min: 0, max: 5999, sirka: 64, cti: () => pr().auto ?? 0, zapis: (v) => P.nastavPrechod({ auto: v }), format: (v) => casMmSs(v) })),
      ),
    ], { priorita: 4, ikona: 'trvani' }),
  ];
}
export const ZVUKY = [['', '[Bez zvuku]'], ['potlesk', 'Potlesk'], ['zvonek', 'Zvonek'], ['kasa', 'Pokladna'], ['vitr', 'Vítr'], ['klik', 'Kliknutí'], ['buben', 'Bubnování'], ['kouzlo', 'Kouzelná hůlka']];
const casMmSs = (v) => { const s = +v || 0; return `${String(Math.floor(s / 60)).padStart(2, '0')}:${(s % 60).toFixed(2).padStart(5, '0').replace('.', ',')}`; };

// ---------------------------------------------------------------- Animace
function kartaAnimace(P) {
  const vybrane = () => P.animaceVyberu();
  const prvni = () => vybrane()[0];
  const polozka = (druh, id, n, akce) => zadrz(el('button.pr-efekt-pol.anim' + (prvni()?.druh === druh && prvni()?.efekt === id ? '.zapnuto' : ''), { type: 'button', title: n, onclick: () => { zavriRozbal(); akce(); } }, ikonaAnimace(druh, id), el('span', { text: n })));
  const polozky = () => [
    polozka('', 'zadne', 'Žádné', () => P.odebratAnimace()),
    ...['vstup', 'zduraz', 'vystup'].flatMap((d) => ANIMACE[d].polozky.slice(0, 7).map(([id, n]) => polozka(d, id, n, () => P.pridatAnimaci(d, id, true)))),
  ];
  const vse = (pridat) => () => el('div.pr-gal-vse.efekty.animace', {},
    pridat ? null : el('div.pr-gal-mrizka', {}, polozka('', 'zadne', 'Žádné', () => P.odebratAnimace())),
    ...Object.entries(ANIMACE).map(([d, a]) => [el('div.ps-nab-nadpis', { text: a.nazev }), el('div.pr-gal-mrizka', {}, a.polozky.map(([id, n]) => polozka(d, id, n, () => P.pridatAnimaci(d, id, !pridat))))]).flat());
  const moznosti = () => {
    const a = prvni();
    const m = a && MOZNOSTI_ANIMACE[a.efekt];
    if (!m) return nabidka([{ text: a ? 'Pro tuto animaci nejsou žádné možnosti.' : 'Nejdřív vyberte objekt s animací.', zakazano: true }], { sirka: 260 });
    return nabidka([{ nadpis: 'Směr' }, ...m.map(([v, t]) => ({ text: t, zaskrtnuto: (a.smer || m[0][0]) === v, akce: () => P.upravAnimace({ smer: v }) }))], { sirka: 220 });
  };
  const START = [['klik', 'Po kliknutí'], ['spolu', 'S předchozí'], ['po', 'Po předchozí']];
  return [
    skupina('Náhled', [velke(P, { ik: 'nahled', text: 'Náhled', akce: () => P.nahledAnimaci() })], { priorita: 6, ikona: 'nahled' }),
    skupina('Animace', [
      galerie(P, { polozky, sirka: 436, vyska: 70, cls: 'efekty', rozbalene: vse(false) }),
      velke(P, { ik: 'moznostiEfektu', text: 'Možnosti\nefektu', rozbal: moznosti }),
    ], { spoustec: () => P.podokno('animace'), priorita: 5, ikona: 'pridatAnimaci' }),
    skupina('Rozšířené animace', [
      velke(P, { ik: 'pridatAnimaci', text: 'Přidat\nanimaci', rozbal: vse(true) }),
      sloupec(
        male(P, { ik: 'podoknoAnimaci', text: 'Podokno animací', stav: () => P.st.podokno === 'animace', akce: () => P.podokno(P.st.podokno === 'animace' ? null : 'animace') }),
        male(P, { ik: 'zacatek', text: 'Aktivační událost', zakazano: true }),
        male(P, { ik: 'kopirovatAnimaci', text: 'Kopírovat animaci', stav: () => !!P.st.stetecAnimace, akce: () => P.kopirovatAnimaci() }),
      ),
    ], { priorita: 4, ikona: 'pridatAnimaci' }),
    skupina('Časování', [
      sloupec(
        radek(el('span.pr-pas-popis', {}, ik('zacatek'), 'Začátek:'), kombo(P, { titulek: 'Začátek', sirka: 94, hodnoty: () => START.map((s) => s[1]), zobraz: () => (prvni() ? START.find((s) => s[0] === (prvni().start || 'klik'))?.[1] : ''), aplikuj: (v) => P.upravAnimace({ start: START.find((s) => s[1] === v)?.[0] || 'klik' }) })),
        radek(el('span.pr-pas-popis', {}, ik('trvani'), 'Doba trvání:'), spinner(P, { krok: 0.25, min: 0.01, max: 59, sirka: 54, cti: () => (prvni() ? prvni().trvani ?? VYCHOZI_TRVANI[prvni().efekt] ?? 0.5 : ''), zapis: (v) => P.upravAnimace({ trvani: v }), format: (v) => Number(v).toFixed(2).replace('.', ',') })),
        radek(el('span.pr-pas-popis', {}, ik('zpozdeni'), 'Zpoždění:'), spinner(P, { krok: 0.25, min: 0, max: 59, sirka: 54, cti: () => (prvni() ? prvni().zpozdeni || 0 : ''), zapis: (v) => P.upravAnimace({ zpozdeni: v }), format: (v) => Number(v).toFixed(2).replace('.', ',') })),
      ),
      sloupec(
        el('div.pr-pas-nadpis', { text: 'Změnit pořadí animace' }),
        male(P, { ik: 'presunoutDrive', text: 'Přesunout dříve', akce: () => P.presunAnimaci(-1) }),
        male(P, { ik: 'presunoutPozdeji', text: 'Přesunout později', akce: () => P.presunAnimaci(1) }),
      ),
    ], { priorita: 3, ikona: 'trvani' }),
  ];
}

// ---------------------------------------------------------------- Prezentace, Nahrávání
function kartaPrezentace(P) {
  return [
    skupina('Spustit prezentaci', [
      velke(P, { ik: 'prezentaceZacatek', text: 'Od\nzačátku', klavesa: 'F5', akce: () => P.prezentovat(0) }),
      velke(P, { ik: 'prezentaceAktualni', text: 'Od aktuál-\nního snímku', klavesa: 'Shift+F5', akce: () => P.prezentovat() }),
      velke(P, { ik: 'prezentovatOnline', text: 'Prezentovat\nonline', zakazano: true }),
      velke(P, { ik: 'vlastniPrezentace', text: 'Vlastní\nprezentace', rozbal: () => nabidka([{ text: 'Jen vybrané snímky', akce: () => P.prezentovat(null, { vybrane: true }) }, { text: 'Bez skrytých snímků od začátku', akce: () => P.prezentovat(0) }], { sirka: 240 }) }),
    ], { priorita: 6, ikona: 'prezentaceZacatek' }),
    skupina('Nastavení', [
      velke(P, { ik: 'nastavitPrezentaci', text: 'Nastavit\nprezentaci', akce: () => P.dialogNastavit() }),
      velke(P, { ik: 'skrytSnimek', text: 'Skrýt\nsnímek', stav: () => !!P.snimek()?.skryty, akce: () => P.skrytSnimek() }),
      velke(P, { ik: 'vyzkouset', text: 'Vyzkoušet\nčasování', akce: () => P.prezentovat(0, { zkouska: true }) }),
      velke(P, { ik: 'nahrat', text: 'Nahrát', rozbal: () => nabidka([{ text: 'Od začátku…', akce: () => P.prezentovat(0, { zkouska: true }) }, { text: 'Od aktuálního snímku…', akce: () => P.prezentovat(null, { zkouska: true }) }, 'sep', { text: 'Vymazat časování na všech snímcích', akce: () => P.vymazatCasovani() }], { sirka: 260 }) }),
      sloupec(
        zaskrt(P, 'Přehrát komentáře', () => true, () => {}),
        zaskrt(P, 'Použít časování', () => !P.pres.nastaveni.bezCasovani, (v) => P.nastavPrezentaci({ bezCasovani: !v })),
        zaskrt(P, 'Zobrazit ovládací prvky médií', () => true, () => {}),
      ),
    ], { priorita: 5, ikona: 'nastavitPrezentaci' }),
    skupina('Monitory', [sloupec(
      zaskrt(P, 'Použít zobrazení prezentujícího', () => !!P.pres.nastaveni.prezentujici, (v) => P.nastavPrezentaci({ prezentujici: v })),
      el('div.pr-pas-info', { text: 'Monitor: Automaticky' }),
    )], { priorita: 3, ikona: 'nastavitPrezentaci' }),
  ];
}
function kartaNahravani(P) {
  return [
    skupina('Nahrát', [
      velke(P, { ik: 'nahrat', text: 'Nahrát', rozbal: () => nabidka([{ text: 'Od začátku', akce: () => P.prezentovat(0, { zkouska: true }) }, { text: 'Od aktuálního snímku', akce: () => P.prezentovat(null, { zkouska: true }) }], { sirka: 200 }) }),
      velke(P, { ik: 'vyzkouset', text: 'Vyzkoušet\nčasování', akce: () => P.prezentovat(0, { zkouska: true }) }),
    ], { priorita: 5, ikona: 'nahrat' }),
    skupina('Automatické přehrávání médií', [
      velke(P, { ik: 'zvuk', text: 'Zvuk', akce: () => P.nahratZvuk() }),
      velke(P, { ik: 'zaznamObrazovky', text: 'Záznam\nobrazovky', zakazano: true }),
    ], { priorita: 4, ikona: 'zvuk' }),
    skupina('Uložit', [velke(P, { ik: 'exportVidea', text: 'Exportovat\ndo videa', akce: () => P.zprava('Export do videa AstroPrezentace zatím neumí. Prezentaci můžete uložit jako PDF (Soubor › Export).') })], { priorita: 2, ikona: 'exportVidea' }),
  ];
}

// ---------------------------------------------------------------- Revize, Zobrazení, Nápověda
function kartaRevize(P) {
  return [
    skupina('Kontrola pravopisu', [velke(P, { ik: 'pravopis', text: 'Kontrola\npravopisu', klavesa: 'F7', akce: () => P.pravopis() })], { priorita: 5, ikona: 'pravopis' }),
    skupina('Přístupnost', [velke(P, { ik: 'pristupnost', text: 'Zkontrolovat\npřístupnost', stav: () => P.st.podokno === 'pristupnost', akce: () => P.podokno(P.st.podokno === 'pristupnost' ? null : 'pristupnost') })], { priorita: 4, ikona: 'pristupnost' }),
    skupina('Jazyk', [velke(P, { ik: 'prelozit', text: 'Přeložit', zakazano: true }), velke(P, { ik: 'jazyk', text: 'Jazyk', rozbal: () => nabidka([{ text: 'čeština', zaskrtnuto: true, akce: () => {} }, { text: 'angličtina (Spojené státy)', akce: () => P.toast('Jazyk kontroly pravopisu: angličtina') }], { sirka: 220 }) })], { priorita: 2, ikona: 'jazyk' }),
    skupina('Komentáře', [
      velke(P, { ik: 'komentarNovy', text: 'Nový\nkomentář', akce: () => P.novyKomentar() }),
      velke(P, { ik: 'smazatKomentar', text: 'Odstranit', rozbal: () => nabidka([{ text: 'Odstranit', akce: () => P.smazatKomentar() }, { text: 'Odstranit všechny komentáře na snímku', akce: () => P.smazatKomentar('snimek') }, { text: 'Odstranit všechny komentáře v této prezentaci', akce: () => P.smazatKomentar('vse') }], { sirka: 300 }) }),
      sloupec(male(P, { ik: 'predchozi', text: 'Předchozí', akce: () => P.dalsiKomentar(-1) }), male(P, { ik: 'dalsi', text: 'Další', akce: () => P.dalsiKomentar(1) })),
      velke(P, { ik: 'komentar', text: 'Zobrazit\nkomentáře', stav: () => P.st.podokno === 'komentare', akce: () => P.podokno(P.st.podokno === 'komentare' ? null : 'komentare') }),
    ], { priorita: 5, ikona: 'komentarNovy' }),
    skupina('Porovnat', [velke(P, { ik: 'sledovat', text: 'Porovnat', zakazano: true })], { priorita: 1, ikona: 'sledovat' }),
  ];
}
function kartaZobrazeni(P) {
  const r = (id, ikona, text) => velke(P, { ik: ikona, text, stav: () => P.st.zobrazeni === id, akce: () => P.zobrazeni(id) });
  return [
    skupina('Zobrazení prezentace', [
      r('normalni', 'normalni', 'Normální'), r('osnova', 'osnova', 'Zobrazení\nosnovy'), r('razeni', 'razeni', 'Řazení\nsnímků'), r('poznamky', 'strankaPoznamek', 'Stránka\npoznámek'),
      velke(P, { ik: 'cteni', text: 'Zobrazení\npro čtení', akce: () => P.prezentovat(null, { okno: true }) }),
    ], { priorita: 6, ikona: 'normalni' }),
    skupina('Zobrazení předloh', [
      velke(P, { ik: 'predloha', text: 'Předloha\nsnímků', akce: () => P.zprava('Předlohu snímků upravíte na kartě Návrh: motiv, varianty, barvy, písma a Formát pozadí › Použít u všech.') }),
      velke(P, { ik: 'predlohaPoznamek', text: 'Předloha\npoznámek', zakazano: true }),
    ], { priorita: 2, ikona: 'predloha' }),
    skupina('Zobrazit', [sloupec(
      zaskrt(P, 'Pravítko', () => P.st.pravitko, (v) => P.nastavZobrazeni({ pravitko: v })),
      zaskrt(P, 'Mřížka', () => P.st.mrizka, (v) => P.nastavZobrazeni({ mrizka: v })),
      zaskrt(P, 'Vodítka', () => P.st.voditka, (v) => P.nastavZobrazeni({ voditka: v })),
    ), velke(P, { ik: 'poznamky', text: 'Poznámky', stav: () => P.st.poznamky, akce: () => P.prepniPoznamky() })], { spoustec: () => P.dialogMrizka(), priorita: 4, ikona: 'mrizka' }),
    skupina('Lupa', [velke(P, { ik: 'lupa', text: 'Lupa', akce: () => P.dialogLupa() }), velke(P, { ik: 'prizpusobitOknu', text: 'Přizpůsobit\noknu', akce: () => P.lupaPrizpusobit() })], { priorita: 3, ikona: 'lupa' }),
    skupina('Barva / stupně šedi', [sloupec(
      male(P, { ik: 'barevne', text: 'Barevně', stav: () => !P.st.barevnyRezim, akce: () => P.barevnyRezim(null) }),
      male(P, { ik: 'stupneSedi', text: 'Stupně šedi', stav: () => P.st.barevnyRezim === 'sedi', akce: () => P.barevnyRezim('sedi') }),
      male(P, { ik: 'cernobile', text: 'Černobílé', stav: () => P.st.barevnyRezim === 'cb', akce: () => P.barevnyRezim('cb') }),
    )], { priorita: 1, ikona: 'barevne' }),
  ];
}
function kartaNapoveda(P) {
  return [
    skupina('Nápověda', [
      velke(P, { ik: 'napoveda', text: 'Nápověda', klavesa: 'F1', akce: () => P.podokno('napoveda') }),
      velke(P, { ik: 'nazory', text: 'Názory', akce: () => P.dialogNazory() }),
      velke(P, { ik: 'skoleni', text: 'Zobrazit\nškolení', akce: () => P.novaPrezentace('prohlidka') }),
      velke(P, { ik: 'coNoveho', text: 'Co je\nnového', akce: () => P.coNoveho() }),
    ], { priorita: 5, ikona: 'napoveda' }),
  ];
}

// ---------------------------------------------------------------- kontextové karty
function velikostSkupina(P) {
  return skupina('Velikost', [sloupec(
    radek(el('span.pr-pas-popis', { text: 'Výška:' }), spinner(P, { krok: 0.1, min: 0.01, max: 140, sirka: 58, cti: () => (P.stav.objekt ? +(P.stav.objekt.h / 28.3465).toFixed(2) : ''), zapis: (v) => P.velikostObjektu('h', v * 28.3465), format: (v) => String(v).replace('.', ',') + ' cm' })),
    radek(el('span.pr-pas-popis', { text: 'Šířka:' }), spinner(P, { krok: 0.1, min: 0.01, max: 140, sirka: 58, cti: () => (P.stav.objekt ? +(P.stav.objekt.w / 28.3465).toFixed(2) : ''), zapis: (v) => P.velikostObjektu('w', v * 28.3465), format: (v) => String(v).replace('.', ',') + ' cm' })),
  )], { spoustec: () => P.podokno('format', { zalozka: 'velikost' }), priorita: 3, ikona: 'velikost' });
}
function usporadatSkupina(P) {
  return skupina('Uspořádat', [
    sloupec(
      male(P, { ik: 'dopredu', text: 'Přenést blíž', akce: () => P.usporadat('dopredu') }),
      male(P, { ik: 'dozadu', text: 'Přenést dál', akce: () => P.usporadat('dozadu') }),
      male(P, { ik: 'podoknoVyberu', text: 'Podokno výběru', akce: () => P.podokno('vyber') }),
    ),
    sloupec(
      male(P, { ik: 'zarovnatObjekty', text: 'Zarovnat', rozbal: () => nabidka([['l', 'Zarovnat doleva'], ['c', 'Zarovnat na střed'], ['r', 'Zarovnat doprava'], ['t', 'Zarovnat nahoru'], ['m', 'Zarovnat doprostřed'], ['b', 'Zarovnat dolů'], ['rozmistitH', 'Rozmístit vodorovně'], ['rozmistitV', 'Rozmístit svisle']].map(([v, t]) => ({ text: t, akce: () => P.zarovnatObjekty(v) })), { sirka: 200 }) }),
      male(P, { ik: 'otocitObjekt', text: 'Otočit', rozbal: () => nabidka([{ text: 'Otočit doprava o 90°', akce: () => P.otocit(90) }, { text: 'Otočit doleva o 90°', akce: () => P.otocit(-90) }, { text: 'Překlopit svisle', akce: () => P.otocit('svisle') }, { text: 'Překlopit vodorovně', akce: () => P.otocit('vodorovne') }], { sirka: 200 }) }),
    ),
  ], { priorita: 4, ikona: 'usporadat' });
}

function kartaFormatObrazce(P) {
  const b = () => P.barvy();
  const styly = () => rychleStyly().map((s) => {
    const bt = zadrz(el('button.pr-rs-pol.mala', { type: 'button', title: s.nazev, onclick: () => P.rychlyStyl(s) }, el('span', { text: 'Abc' })));
    Object.assign(bt.style, { background: s.prechod ? `linear-gradient(180deg, ${barva(b(), s.prechod[0])}, ${barva(b(), s.prechod[1])})` : barva(b(), s.vypln), border: s.obrys === 'none' ? '1px solid transparent' : `1.5px solid ${barva(b(), s.obrys)}`, color: barva(b(), s.text) });
    return bt;
  });
  const wa = () => WORDART.map((w) => { const bt = zadrz(el('button.pr-wa-pol.mala', { type: 'button', title: w.nazev, onclick: () => P.stylWordArt(w.id) }, el('span', { text: 'A' }))); Object.assign(bt.firstChild.style, w.styl(b())); return bt; });
  return [
    skupina('Vložit obrazce', [
      el('div.pr-tvary-gal.mala', {}, ['textove', 'cara', 'caraSipka', 'obdelnik', 'oval', 'trojuhelnik', 'sipkaVpravo', 'zaobleny', 'hvezda5', 'bublina', 'srdce', 'kosoctverec'].map((t) => zadrz(el('button.pr-tvar-pol', { type: 'button', title: JMENA_TVARU[t], onclick: () => P.vlozTvar(t) }, ikonaTvaru(t))))),
      sloupec(male(P, { ik: 'tvary', text: 'Další obrazce', rozbal: () => nabidkaTvaru(P) }), male(P, { ik: 'textovePole', text: 'Textové pole', akce: () => P.vlozTextovePole() })),
    ], { priorita: 2, ikona: 'tvary' }),
    skupina('Styly obrazců', [
      galerie(P, { polozky: styly, sirka: 240, vyska: 68, cls: 'rs', rozbalene: () => galerieRychlychStylu(P) }),
      sloupec(
        delene(P, { ik: 'vyplnTvaru', titulek: 'Výplň obrazce', akce: () => P.podokno('format'), rozbal: () => paletaMotivu(P, { auto: 'Bez výplně', bezBarvy: true, onVyber: (x) => P.vyplnTvaru(x) }) }),
        delene(P, { ik: 'obrysTvaru', titulek: 'Obrys obrazce', akce: () => P.podokno('format'), rozbal: () => nabidkaObrysu(P) }),
        male(P, { ik: 'efektyTvaru', titulek: 'Efekty obrazce', rozbal: () => nabidkaEfektu(P) }),
      ),
    ], { spoustec: () => P.podokno('format'), priorita: 5, ikona: 'rychleStyly' }),
    skupina('Styly WordArt', [
      galerie(P, { polozky: wa, sirka: 150, vyska: 68, cls: 'wa', rozbalene: () => el('div.pr-wordart-gal', {}, wa()) }),
      sloupec(
        male(P, { ik: 'vyplnTextu', titulek: 'Výplň textu', rozbal: () => paletaMotivu(P, { onVyber: (x) => P.formatuj('barva', x) }) }),
        male(P, { ik: 'obrysTextu', titulek: 'Obrys textu', rozbal: () => nabidkaObrysu(P, { text: true }) }),
        male(P, { ik: 'efektyTextu', titulek: 'Efekty textu', rozbal: () => nabidkaEfektu(P, { text: true }) }),
      ),
    ], { priorita: 4, ikona: 'wordart' }),
    skupina('Usnadnění', [velke(P, { ik: 'alternativniText', text: 'Alternativní\ntext', akce: () => P.dialogAlt() })], { priorita: 1, ikona: 'alternativniText' }),
    usporadatSkupina(P),
    velikostSkupina(P),
  ];
}

const OBR_STYLY = [['ramecek', 'Jednoduchý rámeček, bílý'], ['stin', 'Zkosený, s měkkým stínem'], ['zaobleny', 'Zaoblený obdélník'], ['oval', 'Ovál s měkkými okraji'], ['odraz', 'Odraz, zaoblený obdélník'], ['cerny', 'Silný rámeček, černý'], ['perspektiva', 'Perspektiva, vlevo'], ['polaroid', 'Obrázek s rámečkem']];
const OPRAVY = [['brightness(.6)', 'Jas: −40 %'], ['brightness(.8)', 'Jas: −20 %'], ['', 'Jas: 0 % (normální)'], ['brightness(1.2)', 'Jas: +20 %'], ['brightness(1.4)', 'Jas: +40 %'], ['contrast(.6)', 'Kontrast: −40 %'], ['contrast(1.4)', 'Kontrast: +40 %'], ['contrast(1.25) saturate(1.1)', 'Doostřit']];
const BARVY_OBR = [['saturate(0)', 'Sytost: 0 %'], ['saturate(.5)', 'Sytost: 50 %'], ['', 'Sytost: 100 %'], ['saturate(2)', 'Sytost: 200 %'], ['sepia(1)', 'Sépie'], ['grayscale(1) contrast(1.2)', 'Stupně šedi'], ['hue-rotate(180deg)', 'Přebarvit: obráceně'], ['invert(1)', 'Negativ']];
const UMELECKE = [['', 'Žádný'], ['blur(3px)', 'Rozostření'], ['contrast(1.8) saturate(1.6)', 'Plakát'], ['grayscale(1) contrast(2) brightness(1.2)', 'Kresba tužkou'], ['sepia(.7) contrast(1.1) brightness(1.05)', 'Starý film'], ['saturate(2.5) hue-rotate(15deg)', 'Pop art'], ['blur(1px) brightness(1.1) saturate(1.3)', 'Záře'], ['contrast(1.5) grayscale(.5)', 'Fotokopie']];
function nahledyFiltru(P, seznam, akce) {
  const o = P.stav.objekt;
  const src = o?.typ === 'obrazek' ? P.pres.src(o.src) : '';
  return el('div.pr-filtry', {}, seznam.map(([f, t]) => el('button.pr-filtr-pol', { type: 'button', title: t, onclick: () => { zavriRozbal(); akce(f); } }, el('img', { src, style: { filter: f || 'none' } }), el('span', { text: t }))));
}
function kartaFormatObrazku(P) {
  return [
    skupina('Upravit', [
      velke(P, { ik: 'vymazat', text: 'Odebrat\npozadí', zakazano: true }),
      velke(P, { ik: 'opravy', text: 'Opravy', rozbal: () => nahledyFiltru(P, OPRAVY, (f) => P.upravObrazek({ opravy: f })) }),
      velke(P, { ik: 'barvaObrazku', text: 'Barva', rozbal: () => nahledyFiltru(P, BARVY_OBR, (f) => P.upravObrazek({ barva: f })) }),
      velke(P, { ik: 'umeleckeEfekty', text: 'Umělecké\nefekty', rozbal: () => nahledyFiltru(P, UMELECKE, (f) => P.upravObrazek({ umelecke: f })) }),
      velke(P, { ik: 'pruhlednostObr', text: 'Průhlednost', rozbal: () => nabidka([0, 15, 30, 50, 65, 80, 95].map((v) => ({ text: `Průhlednost: ${v} %`, akce: () => P.upravObjekt({ pruhlednost: v || null }, 'Průhlednost') })), { sirka: 200 }) }),
      sloupec(
        male(P, { ik: 'obrazky', text: 'Změnit obrázek', akce: () => P.zmenitObrazek() }),
        male(P, { ik: 'obnovit', text: 'Obnovit obrázek', akce: () => P.upravObrazek(null) }),
      ),
    ], { priorita: 4, ikona: 'opravy' }),
    skupina('Styly obrázků', [
      galerie(P, { polozky: () => OBR_STYLY.map(([id, t]) => { const o = P.stav.objekt; const bt = zadrz(el('button.pr-obrstyl-pol', { type: 'button', title: t, onclick: () => P.upravObjekt({ obrStyl: id }, 'Styl obrázku') }, el('div.pr-img-ram.obr-' + id, {}, el('img', { src: o?.typ === 'obrazek' ? P.pres.src(o.src) : '' })))); return bt; }), sirka: 300, vyska: 68, cls: 'obrstyly' }),
      sloupec(
        male(P, { ik: 'obrysTvaru', text: 'Ohraničení obrázku', rozbal: () => paletaMotivu(P, { auto: 'Bez obrysu', bezBarvy: true, onVyber: (x) => P.upravObjekt({ obrys: x === 'none' ? null : x, obrysW: 3 }, 'Ohraničení obrázku') }) }),
        male(P, { ik: 'efektyTvaru', text: 'Efekty obrázku', rozbal: () => nabidkaEfektu(P) }),
        male(P, { ik: 'stylyObrazku', text: 'Bez stylu', akce: () => P.upravObjekt({ obrStyl: null, obrys: null, efekty: null }, 'Bez stylu') }),
      ),
    ], { spoustec: () => P.podokno('format'), priorita: 5, ikona: 'stylyObrazku' }),
    skupina('Usnadnění', [velke(P, { ik: 'alternativniText', text: 'Alternativní\ntext', akce: () => P.dialogAlt() })], { priorita: 1, ikona: 'alternativniText' }),
    usporadatSkupina(P),
    skupina('Velikost', [
      velke(P, { ik: 'oriznout', text: 'Oříznout', rozbal: () => nabidka([
        { text: 'Oříznout…', ikona: 'oriznout', akce: () => P.dialogOrez() },
        { text: 'Oříznout podle obrazce: ovál', akce: () => P.upravObjekt({ obrStyl: 'oval' }, 'Oříznout podle obrazce') },
        { text: 'Oříznout podle obrazce: zaoblený', akce: () => P.upravObjekt({ obrStyl: 'zaobleny' }, 'Oříznout podle obrazce') },
        { nadpis: 'Poměr stran' },
        ...[['1:1', 1], ['4:3', 4 / 3], ['16:9', 16 / 9], ['3:4', 3 / 4]].map(([t, p]) => ({ text: t, akce: () => P.orezPomer(p) })),
        'sep', { text: 'Zrušit oříznutí', akce: () => P.upravObjekt({ orez: null }, 'Zrušit oříznutí') },
      ], { sirka: 240 }) }),
      velikostSkupina(P).querySelector('.ps-sk-telo').firstElementChild,
    ], { spoustec: () => P.podokno('format', { zalozka: 'velikost' }), priorita: 3, ikona: 'oriznout' }),
  ];
}

const STYLY_TAB = [['stredni2', 'Středně sytý styl 2'], ['svetly1', 'Světlý styl 1'], ['svetly2', 'Světlý styl 2'], ['tmavy1', 'Tmavý styl 1'], ['mrizka', 'Mřížka tabulky'], ['bez', 'Bez stylu']];
function nahledStyluTabulky(P, id) {
  const tab = { styl: id, radky: Array.from({ length: 5 }, () => Array.from({ length: 4 }, () => ({}))), zahlavi: true, pruhyR: true };
  const b = P.barvy();
  return el('table.pr-tab-nahled', {}, tab.radky.map((r, i) => el('tr', {}, r.map((_, c) => { const s = stylTabulkyBunky(tab, i, c, b); return el('td', { style: { background: s.bg, border: s.ohr ? `1px solid ${s.ohr}` : s.ramecek ? `1px solid ${s.ramecek}` : 'none', borderBottom: s.hranaH && (i === 0 || i === 4) ? `1px solid ${s.hranaH}` : undefined } }); }))));
}
function kartaTabNavrh(P) {
  const t = () => P.stav.objekt?.tab || {};
  const styly = () => {
    const out = [];
    for (const [druh, n] of STYLY_TAB) for (const a of (druh === 'bez' ? ['tx'] : ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'tx'].slice(0, druh === 'mrizka' ? 3 : 7))) {
      const id = `${druh}-${a}`;
      out.push(zadrz(el('button.pr-tabstyl-pol' + (t().styl === id ? '.zapnuto' : ''), { type: 'button', title: `${n} – ${a === 'tx' ? 'tmavá' : 'zvýraznění ' + a[1]}`, onclick: () => { zavriRozbal(); P.upravTabulku('styl', id); } }, nahledStyluTabulky(P, id))));
    }
    return out;
  };
  return [
    skupina('Možnosti stylů tabulek', [
      sloupec(zaskrt(P, 'Řádek záhlaví', () => t().zahlavi !== false, (v) => P.upravTabulku('moznost', { zahlavi: v })), zaskrt(P, 'Řádek souhrnů', () => !!t().celkem, (v) => P.upravTabulku('moznost', { celkem: v })), zaskrt(P, 'Pruhované řádky', () => t().pruhyR !== false, (v) => P.upravTabulku('moznost', { pruhyR: v }))),
      sloupec(zaskrt(P, 'První sloupec', () => !!t().prvniSloupec, (v) => P.upravTabulku('moznost', { prvniSloupec: v }))),
    ], { priorita: 3, ikona: 'tabulka' }),
    skupina('Styly tabulek', [
      galerie(P, { polozky: styly, sirka: 380, vyska: 68, cls: 'tabstyly' }),
      sloupec(
        male(P, { ik: 'barvaVyplne', text: 'Stínování', rozbal: () => paletaMotivu(P, { auto: 'Bez výplně', bezBarvy: true, onVyber: (x) => P.upravTabulku('stinovani', x) }) }),
        male(P, { ik: 'ohraniceni', text: 'Ohraničení', rozbal: () => nabidka([{ text: 'Všechna ohraničení', akce: () => P.upravTabulku('styl', `mrizka-${(t().styl || 'x-a1').split('-')[1]}`) }, { text: 'Bez ohraničení', akce: () => P.upravTabulku('styl', `bez-tx`) }], { sirka: 200 }) }),
      ),
    ], { priorita: 5, ikona: 'tabulka' }),
  ];
}
function kartaTabRozlozeni(P) {
  return [
    skupina('Řádky a sloupce', [
      velke(P, { ik: 'odstranit', text: 'Odstranit', rozbal: () => nabidka([{ text: 'Odstranit sloupce', akce: () => P.upravTabulku('smazSloupec') }, { text: 'Odstranit řádky', akce: () => P.upravTabulku('smazRadek') }, { text: 'Odstranit tabulku', akce: () => P.odstranitVybrane() }], { sirka: 200 }) }),
      velke(P, { ik: 'vlozitNad', text: 'Vložit\nnad', akce: () => P.upravTabulku('radekNad') }),
      velke(P, { ik: 'vlozitPod', text: 'Vložit\npod', akce: () => P.upravTabulku('radekPod') }),
      sloupec(male(P, { ik: 'vlozitSloupce', text: 'Vložit vlevo', akce: () => P.upravTabulku('sloupecVlevo') }), male(P, { ik: 'vlozitSloupce', text: 'Vložit vpravo', akce: () => P.upravTabulku('sloupecVpravo') })),
    ], { priorita: 5, ikona: 'vlozitPod' }),
    skupina('Velikost buňky', [sloupec(
      male(P, { ik: 'vyskaRadku', text: 'Rozložit řádky rovnoměrně', akce: () => P.upravTabulku('rozlozitRadky') }),
      male(P, { ik: 'sirkaSloupce', text: 'Rozložit sloupce rovnoměrně', akce: () => P.upravTabulku('rozlozitSloupce') }),
    )], { priorita: 3, ikona: 'sirkaSloupce' }),
    skupina('Zarovnání', [
      radek(
        male(P, { ik: 'zarovnatVlevo', titulek: 'Zarovnat text doleva', akce: () => P.upravTabulku('zar', 'l') }),
        male(P, { ik: 'zarovnatNaStred', titulek: 'Zarovnat na střed', akce: () => P.upravTabulku('zar', 'c') }),
        male(P, { ik: 'zarovnatVpravo', titulek: 'Zarovnat text doprava', akce: () => P.upravTabulku('zar', 'r') }),
      ),
      radek(
        male(P, { ik: 'zarovnatNahoru', titulek: 'Zarovnat nahoru', akce: () => P.upravTabulku('svisle', 't') }),
        male(P, { ik: 'zarovnatDoprostred', titulek: 'Zarovnat doprostřed', akce: () => P.upravTabulku('svisle', 'm') }),
        male(P, { ik: 'zarovnatDolu', titulek: 'Zarovnat dolů', akce: () => P.upravTabulku('svisle', 'b') }),
      ),
    ], { priorita: 4, ikona: 'zarovnatVlevo' }),
    usporadatSkupina(P),
  ];
}
function kartaGrafNavrh(P) {
  const g = () => P.stav.objekt?.graf || {};
  return [
    skupina('Rozložení grafu', [
      velke(P, { ik: 'pridatPrvek', text: 'Přidat prvek\ngrafu', rozbal: () => nabidka([
        { nadpis: 'Název grafu' }, { text: 'Žádný', zaskrtnuto: g().zobrazitNazev === false, akce: () => P.upravGraf({ zobrazitNazev: false }) }, { text: 'Nad grafem', zaskrtnuto: g().zobrazitNazev !== false, akce: () => P.upravGraf({ zobrazitNazev: true }) },
        { nadpis: 'Legenda' }, ...[['Žádná', null], ['Vpravo', 'vpravo'], ['Nahoře', 'nahore'], ['Dole', 'dole']].map(([t, v]) => ({ text: t, zaskrtnuto: (g().legenda ?? 'dole') === v, akce: () => P.upravGraf({ legenda: v }) })),
        { nadpis: 'Popisky dat' }, { text: 'Zobrazit', zaskrtnuto: !!g().popisky, akce: () => P.upravGraf({ popisky: !g().popisky }) },
      ], { sirka: 200 }) }),
    ], { priorita: 4, ikona: 'pridatPrvek' }),
    skupina('Styly grafů', [velke(P, { ik: 'zmenitBarvy', text: 'Změnit\nbarvy', rozbal: () => nabidka([
      { text: 'Barevná (motiv prezentace)', akce: () => P.upravGraf({ barvyRad: null }) },
      ...['a1', 'a2', 'a3', 'a4', 'a5', 'a6'].map((a, i) => ({ text: `Jednobarevná paleta ${i + 1}`, akce: () => { const b = P.barvy(); P.upravGraf({ barvyRad: [0, 0.3, -0.3, 0.55, -0.5, 0.75].map((k) => odstin(barva(b, a), k)) }); } })),
    ], { sirka: 230 }) })], { priorita: 3, ikona: 'zmenitBarvy' }),
    skupina('Data', [velke(P, { ik: 'upravitData', text: 'Upravit\ndata', akce: () => P.upravDataGrafu() })], { priorita: 5, ikona: 'upravitData' }),
    skupina('Typ', [velke(P, { ik: 'zmenitTypGrafu', text: 'Změnit\ntyp grafu', rozbal: () => nabidka(TYPY_GRAFU.map((t) => ({ text: t.nazev, ikona: t.ikona, zaskrtnuto: g().typ === t.id, akce: () => P.upravGraf({ typ: t.id }) })), { sirka: 260 }) })], { priorita: 4, ikona: 'zmenitTypGrafu' }),
    usporadatSkupina(P),
  ];
}

// ---------------------------------------------------------------- sestavení
export const KARTY_PR = [
  { id: 'domu', nazev: 'Domů', stav: kartaDomu },
  { id: 'vlozeni', nazev: 'Vložení', stav: kartaVlozeni },
  { id: 'kresleni', nazev: 'Kreslení', stav: kartaKresleni },
  { id: 'navrh', nazev: 'Návrh', stav: kartaNavrh },
  { id: 'prechody', nazev: 'Přechody', stav: kartaPrechody },
  { id: 'animace', nazev: 'Animace', stav: kartaAnimace },
  { id: 'prezentace', nazev: 'Prezentace', stav: kartaPrezentace },
  { id: 'nahravani', nazev: 'Nahrávání', stav: kartaNahravani },
  { id: 'revize', nazev: 'Revize', stav: kartaRevize },
  { id: 'zobrazeni', nazev: 'Zobrazení', stav: kartaZobrazeni },
  { id: 'napoveda', nazev: 'Nápověda', stav: kartaNapoveda },
  { id: 'tvarFormat', nazev: 'Formát obrazce', stav: kartaFormatObrazce, kontext: 'tvar' },
  { id: 'obrFormat', nazev: 'Formát obrázku', stav: kartaFormatObrazku, kontext: 'obrazek' },
  { id: 'tabNavrh', nazev: 'Návrh tabulky', stav: kartaTabNavrh, kontext: 'tabulka' },
  { id: 'tabRozlozeni', nazev: 'Rozložení', stav: kartaTabRozlozeni, kontext: 'tabulka' },
  { id: 'grafNavrh', nazev: 'Návrh grafu', stav: kartaGrafNavrh, kontext: 'graf' },
];

export function postavKartyPr(P) {
  const obsahy = {};
  for (const k of KARTY_PR) obsahy[k.id] = el('div.ps-karta-obsah', { dataset: { karta: k.id } }, k.stav(P));
  return obsahy;
}

export { nazevAnimace, galerieRychlychStylu, nabidkaSmartArt };
