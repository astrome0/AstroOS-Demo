// AstroTabulky — pás karet jako v Excelu (Domů, Vložení, Kreslení, Rozložení stránky, Vzorce, Data,
// Revize, Zobrazení, Automatizovat, Nápověda + kontextové Návrh tabulky, Návrh grafu, Formát)
//
// Stavební kameny (velke, male, delene, skupina, kombo…) sdílí s Písmem (js/pismo/pas.js).

import { el } from '../util.js';
import { ik } from '../pismo/ikony.js';
import { rozbal, zavriRozbal, nabidka, paleta, dialog, zprava } from '../pismo/ui.js';
import { velke, male, delene, skupina, radek, sloupec, oddelovac, kombo, zadrz } from '../pismo/pas.js';
import { PISMA } from '../pismo/dokument.js';
import { FORMATY, formatuj, rozborKodu, kodCesky, kodZCeskeho } from './format.js';
import { STYLY_BUNEK, STYLY_TABULEK, PREDVOLBY_CF, DATOVE_PRUHY, BAREVNE_SKALY, SADY_IKON, MOTIV, odstin, stylTabulky } from './styly.js';
import { FUNKCE, KATEGORIE_FUNKCI, syntaxe } from './vzorce.js';
import { TYPY_GRAFU, STYLY_GRAFU, PALETY, NAZVY_PALET, svgGrafu, dataGrafu } from './grafy.js';
import { TVARY } from './objekty.js';
import { textOblasti } from './adresy.js';
import { kresliIkonuCF } from './kresleni.js';
import * as D from './dialogy.js';

const TB_PISMA = ['Aptos Narrow', ...PISMA];

// ---------------------------------------------------------------- galerie
function galerieStyluBunek(P) {
  return el('div.tb-gal-bunky', {}, STYLY_BUNEK.map((sk) => [
    el('div.ps-nab-nadpis', { text: sk.skupina }),
    el('div.tb-gal-bunky-mrizka', {}, sk.styly.map((st) => {
      const s = st.s;
      const ohr = s.ohr ? `border-bottom:${s.ohr.b ? `${s.ohr.b.s === 'dvojita' ? '3px double' : s.ohr.b.s === 'tlusta' ? '2.5px solid' : '1px solid'} ${s.ohr.b.b}` : 'none'};${s.ohr.t ? `border-top:1px solid ${s.ohr.t.b}` : ''};${s.ohr.l ? `border-left:1px solid ${s.ohr.l.b};border-right:1px solid ${s.ohr.r.b}` : ''}` : '';
      return el('button.tb-gal-bunka', {
        type: 'button', title: st.titulek || st.nazev, onclick: () => { zavriRozbal(); P.stylBunkyGalerie(st.id); },
        style: `background:${s.pozadi || '#fff'};color:${s.barva || '#000'};font-weight:${s.b ? 700 : 400};font-style:${s.i ? 'italic' : 'normal'};font-size:${Math.min(15, (s.vel || 11) * 1.05)}px;${ohr}`,
      }, st.nazev);
    })),
  ]).flat(), el('div.ps-nab-sep'), nabidka([
    { text: 'Nový styl buňky…', zakazano: true },
    { text: 'Sloučit styly…', zakazano: true },
  ]));
}

function nahledStyluTabulky(id) {
  const t = { styl: id, oblast: { r1: 0, c1: 0, r2: 4, c2: 4 }, zahlavi: true, pruhyR: true };
  const lFake = { skryteR: new Set(), skryteFiltrem: new Set() };
  const radky = [];
  for (let r = 0; r <= 4; r++) {
    const bunky = [];
    for (let c = 0; c <= 4; c++) {
      const s = stylTabulky(t, r, c, null, lFake);
      const car = (x) => (x ? `1px solid ${x.b}` : 'none');
      bunky.push(el('td', { style: `background:${s.pozadi || '#fff'};border-top:${car(s.ohr?.t)};border-bottom:${car(s.ohr?.b)};border-left:${car(s.ohr?.l)};border-right:${car(s.ohr?.r)}` },
        el('i', { style: { background: s.pismo?.barva || (s.pozadi && s.pozadi !== '#fff' && s.pozadi !== '#FFFFFF' && r === 0 ? '#fff' : '#555') } })));
    }
    radky.push(el('tr', {}, bunky));
  }
  return el('table.tb-nahled-tab', {}, radky);
}

function galerieTabulek(P, akce) {
  const skupiny = [['svetly', 'Světlé'], ['stredni', 'Středně sytá'], ['tmavy', 'Tmavé']];
  return el('div.tb-gal-tabulky', {}, skupiny.map(([id, nazev]) => [
    el('div.ps-nab-nadpis', { text: nazev }),
    el('div.tb-gal-tab-mrizka', {}, Object.entries(STYLY_TABULEK).filter(([, s]) => s.skupina === id).map(([k, s]) =>
      el('button.tb-gal-tab', { type: 'button', title: s.nazev, onclick: () => { zavriRozbal(); akce(k); } }, nahledStyluTabulky(k)))),
  ]).flat(), el('div.ps-nab-sep'), nabidka([
    { text: 'Nový styl tabulky…', zakazano: true },
    { text: 'Nový styl kontingenční tabulky…', zakazano: true },
  ]));
}

function ikonaCF(sada) {
  const c = document.createElement('canvas');
  c.width = 72; c.height = 18;
  const x = c.getContext('2d');
  const n = /5$/.test(sada) ? 5 : /4$/.test(sada) ? 4 : 3;
  for (let i = 0; i < n; i++) kresliIkonuCF(x, { sada, i, n }, 2 + i * 14, 9, 1);
  return c;
}

function nabidkaPodminene(P) {
  const podmenu = (pol) => (e) => { e.stopPropagation(); rozbal(e.currentTarget, nabidka(pol, { sirka: 280 }), { app: 'tabulky' }); };
  const polozka = (ikona, text, obsah) => el('button.ps-nab-polozka.tb-sub', { type: 'button', onclick: podmenu(obsah) }, el('span.ps-nab-ik', {}, ik(ikona)), el('span.ps-nab-text', { text }), el('span.tb-sub-sipka', { text: '›' }));
  const pruhy = el('div.tb-cf-galerie', {}, el('div.ps-nab-nadpis', { text: 'Přechodová výplň' }), el('div.tb-cf-mrizka', {}, DATOVE_PRUHY.map(([b, n]) => el('button.tb-cf-pruh', { type: 'button', title: n, onclick: () => { zavriRozbal(); P.podminene({ typ: 'pruh', barva: b }); } }, [0.9, 0.55, 0.3].map((k) => el('i', { style: { width: k * 100 + '%', background: `linear-gradient(90deg, ${b}, ${b}22)`, borderColor: b } }))))),
    el('div.ps-nab-nadpis', { text: 'Plná výplň' }), el('div.tb-cf-mrizka', {}, DATOVE_PRUHY.map(([b, n]) => el('button.tb-cf-pruh', { type: 'button', title: n.replace('datový', 'plný datový'), onclick: () => { zavriRozbal(); P.podminene({ typ: 'pruh', barva: b, plny: true }); } }, [0.9, 0.55, 0.3].map((k) => el('i', { style: { width: k * 100 + '%', background: b + 'CC', borderColor: b } }))))));
  const skaly = el('div.tb-cf-galerie', {}, el('div.tb-cf-mrizka.skaly', {}, BAREVNE_SKALY.map(([barvy, n]) => el('button.tb-cf-skala', { type: 'button', title: n, onclick: () => { zavriRozbal(); P.podminene({ typ: 'skala', barvy }); } }, [0, 0.5, 1].map((t) => el('i', { style: { background: t === 0.5 && barvy.length === 2 ? barvy[0] + '88' : barvy[Math.round(t * (barvy.length - 1))] } }))))));
  const ikony = el('div.tb-cf-galerie', {}, el('div.tb-cf-sloupec', {}, SADY_IKON.map(([id, n]) => el('button.tb-cf-ikony', { type: 'button', title: n, onclick: () => { zavriRozbal(); P.podminene({ typ: 'ikony', sada: id }); } }, ikonaCF(id)))));
  const galerie = (obsah) => (e) => { e.stopPropagation(); rozbal(e.currentTarget, obsah, { app: 'tabulky' }); };
  const polGal = (ikona, text, obsah) => el('button.ps-nab-polozka.tb-sub', { type: 'button', onclick: galerie(obsah) }, el('span.ps-nab-ik', {}, ik(ikona)), el('span.ps-nab-text', { text }), el('span.tb-sub-sipka', { text: '›' }));
  return el('div.ps-nabidka', { style: { width: '290px' } },
    polozka('podminene', 'Pravidla zvýraznění buněk', [
      { text: 'Větší než…', akce: () => D.dialogPodminka(P, 'vetsi') },
      { text: 'Menší než…', akce: () => D.dialogPodminka(P, 'mensi') },
      { text: 'Mezi…', akce: () => D.dialogPodminka(P, 'mezi') },
      { text: 'Je rovno…', akce: () => D.dialogPodminka(P, 'rovno') },
      { text: 'Text, který obsahuje…', akce: () => D.dialogPodminka(P, 'text') },
      { text: 'Datum, které nastane…', akce: () => D.dialogPodminka(P, 'datum') },
      { text: 'Duplicitní hodnoty…', akce: () => D.dialogPodminka(P, 'duplicitni') },
      'sep', { text: 'Další pravidla…', akce: () => D.dialogNovePravidlo(P) },
    ]),
    polozka('seraditZA', 'Pravidla pro nejvyšší či nejnižší hodnoty', [
      { text: 'Prvních 10 položek…', akce: () => D.dialogPodminka(P, 'prvni') },
      { text: 'Prvních 10 %…', akce: () => D.dialogPodminka(P, 'prvniProc') },
      { text: 'Posledních 10 položek…', akce: () => D.dialogPodminka(P, 'posledni') },
      { text: 'Posledních 10 %…', akce: () => D.dialogPodminka(P, 'posledniProc') },
      { text: 'Nad průměrem…', akce: () => D.dialogPodminka(P, 'nadPrumerem') },
      { text: 'Pod průměrem…', akce: () => D.dialogPodminka(P, 'podPrumerem') },
      'sep', { text: 'Další pravidla…', akce: () => D.dialogNovePravidlo(P) },
    ]),
    polGal('grafPruhy', 'Datové pruhy', pruhy),
    polGal('zmenitBarvy', 'Barevné škály', skaly),
    polGal('podminene', 'Sady ikon', ikony),
    el('div.ps-nab-sep'),
    nabidka([
      { text: 'Nové pravidlo…', akce: () => D.dialogNovePravidlo(P) },
      { uzel: el('button.ps-nab-polozka.tb-sub', { type: 'button', onclick: (e) => { e.stopPropagation(); rozbal(e.currentTarget, nabidka([{ text: 'Vymazat pravidla z vybraných buněk', akce: () => P.vymazatPodminene('vyber') }, { text: 'Vymazat pravidla z celého listu', akce: () => P.vymazatPodminene('list') }], { sirka: 280 }), { app: 'tabulky' }); } }, el('span.ps-nab-ik', {}, ik('vymazat')), el('span.ps-nab-text', { text: 'Vymazat pravidla' }), el('span.tb-sub-sipka', { text: '›' })) },
      { text: 'Spravovat pravidla…', akce: () => D.dialogSpravcePravidel(P) },
    ]));
}

function nabidkaOhraniceni(P) {
  const o = (typ, text, ikona) => ({ text, ikona: ikona || 'ohraniceni', akce: () => P.ohraniceni(typ) });
  return el('div', {}, nabidka([
    { nadpis: 'Ohraničení' },
    o('dolni', 'Dolní ohraničení'), o('horni', 'Horní ohraničení'), o('leve', 'Levé ohraničení'), o('prave', 'Pravé ohraničení'),
    'sep',
    o('zadne', 'Bez ohraničení'), o('vsechna', 'Všechna ohraničení'), o('vnejsi', 'Vnější ohraničení'), o('tlusteVnejsi', 'Tlusté vnější ohraničení'),
    'sep',
    o('dvojitaDolni', 'Dvojité dolní ohraničení'), o('tlustaDolni', 'Tlusté dolní ohraničení'), o('horniDolni', 'Horní a dolní ohraničení'),
    o('horniTlustaDolni', 'Horní a tlusté dolní ohraničení'), o('horniDvojitaDolni', 'Horní a dvojité dolní ohraničení'), o('vnitrni', 'Vnitřní ohraničení'),
    { nadpis: 'Nakreslit ohraničení' },
    { uzel: el('label.ps-nab-polozka.ps-vlastni-barva', {}, el('span.ps-nab-ik', {}, '🎨'), el('span', { text: 'Barva čáry' }), el('input', { type: 'color', value: P.stav.cara?.b || '#000000', onchange: (e) => { P.stav.cara = { ...(P.stav.cara || { s: 'tenka' }), b: e.target.value.toUpperCase() }; } })) },
    ...[['tenka', 'Styl čáry: tenká'], ['stredni', 'Styl čáry: střední'], ['tlusta', 'Styl čáry: tlustá'], ['dvojita', 'Styl čáry: dvojitá'], ['carky', 'Styl čáry: čárkovaná'], ['tecky', 'Styl čáry: tečkovaná']]
      .map(([s, t]) => ({ text: t, zaskrtnuto: (P.stav.cara?.s || 'tenka') === s, akce: () => { P.stav.cara = { ...(P.stav.cara || { b: '#000000' }), s }; } })),
    'sep',
    { text: 'Další ohraničení…', ikona: 'formatBunek', akce: () => D.dialogFormatBunek(P, 'ohraniceni') },
  ], { sirka: 270 }));
}

function nabidkaFunkci(P, kat) {
  const f = Object.values(FUNKCE).filter((x) => x.kat === kat).sort((a, b) => a.n.localeCompare(b.n, 'cs'));
  return el('div.tb-seznam-funkci', {}, nabidka([...f.map((x) => ({ text: x.n, akce: () => D.dialogArgumenty(P, x) })), 'sep', { text: 'Vložit funkci…', ikona: 'fx', akce: () => D.dialogVlozitFunkci(P, kat) }], { sirka: 240 }));
}

// ---------------------------------------------------------------- Domů
function kartaDomu(P) {
  let posledniVypln = '#FFFF00', posledniPismo = '#FF0000';
  const schranka = skupina('Schránka', [
    velke(P, {
      ik: 'vlozit', text: 'Vložit', deleno: true, klavesa: 'Ctrl+V', akce: () => P.vlozit(),
      rozbal: () => nabidka([
        { nadpis: 'Vložit' },
        { text: 'Vložit', ikona: 'vlozit', akce: () => P.vlozit('vse') },
        { text: 'Vzorce', akce: () => P.vlozit('vzorce') },
        { text: 'Vzorce a formátování čísel', akce: () => P.vlozit('vzorceFormaty') },
        { text: 'Bez ohraničení', akce: () => P.vlozit('bezOhraniceni') },
        { text: 'Zachovat šířky zdrojových sloupců', akce: () => P.vlozit('vseSirky') },
        { text: 'Transponovat', ikona: 'prepnoutRadek', akce: () => P.schranka && P.vlozVnitrni(P.schranka, 'vse', { transponovat: true }) },
        { nadpis: 'Vložit hodnoty' },
        { text: 'Hodnoty', akce: () => P.vlozit('hodnoty') },
        { text: 'Hodnoty a formátování čísel', akce: () => P.vlozit('hodnotyFormaty') },
        { nadpis: 'Další možnosti vložení' },
        { text: 'Formátování', ikona: 'stetec', akce: () => P.vlozit('formaty') },
        { text: 'Vložit propojení', ikona: 'odkaz', akce: () => P.vlozit('propojit') },
        'sep',
        { text: 'Vložit jinak…', akce: () => D.dialogVlozitJinak(P) },
      ], { sirka: 250 }),
    }),
    sloupec(
      male(P, { ik: 'vyjmout', titulek: 'Vyjmout', klavesa: 'Ctrl+X', akce: () => P.vyjmout() }),
      male(P, { ik: 'kopirovat', titulek: 'Kopírovat', klavesa: 'Ctrl+C', akce: () => P.kopirovat() }),
      (() => {
        const b = male(P, { ik: 'stetec', titulek: 'Kopírovat formát', akce: () => P.stetec(), stav: () => !!P.st.stetec });
        b.addEventListener('dblclick', () => P.stetec(true, true));
        return b;
      })(),
    ),
  ], { spoustec: () => P.podokno('schranka'), priorita: 3, ikona: 'vlozit' });

  const pismo = skupina('Písmo', [
    radek(
      kombo(P, { titulek: 'Písmo', sirka: 118, nahled: true, hodnoty: () => TB_PISMA, pismaMotivu: ['Aptos Display (Nadpisy)', 'Aptos Narrow (Základní text)'], zobraz: () => P.stav.pismo || 'Aptos Narrow', aplikuj: (v) => P.pismo(v) }),
      kombo(P, { titulek: 'Velikost písma', sirka: 30, hodnoty: () => [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72].map(String), zobraz: () => String(P.stav.velikost || 11).replace('.', ','), aplikuj: (v) => P.velikost(v) }),
      male(P, { ik: 'zvetsit', titulek: 'Zvětšit písmo', klavesa: 'Ctrl+Shift+>', akce: () => P.zmenVelikost(1) }),
      male(P, { ik: 'zmensit', titulek: 'Zmenšit písmo', klavesa: 'Ctrl+Shift+<', akce: () => P.zmenVelikost(-1) }),
    ),
    radek(
      male(P, { ik: 'tucne', titulek: 'Tučné', klavesa: 'Ctrl+B', akce: () => P.prepni('b', 'Tučné'), stav: () => P.stav.tucne }),
      male(P, { ik: 'kurziva', titulek: 'Kurzíva', klavesa: 'Ctrl+I', akce: () => P.prepni('i', 'Kurzíva'), stav: () => P.stav.kurziva }),
      delene(P, {
        ik: 'podtrzeni', titulek: 'Podtržení', klavesa: 'Ctrl+U', akce: () => P.prepni('u', 'Podtržení'), stav: () => !!P.stav.podtrzeni,
        rozbal: () => nabidka([
          { text: 'Podtržení', ikona: 'podtrzeni', akce: () => P.styl({ u: P.stav.podtrzeni === 's' ? null : 's' }, 'Podtržení') },
          { text: 'Dvojité podtržení', akce: () => P.styl({ u: P.stav.podtrzeni === 'd' ? null : 'd' }, 'Dvojité podtržení') },
        ]),
      }),
      oddelovac(),
      delene(P, { ik: 'ohraniceni', titulek: 'Ohraničení', akce: () => P.ohraniceni(P.posledniOhraniceni || 'dolni'), rozbal: () => nabidkaOhraniceni(P) }),
      oddelovac(),
      delene(P, { ik: 'barvaVyplne', titulek: 'Barva výplně', akce: () => P.barvaVyplne(posledniVypln), barva: () => posledniVypln, rozbal: () => paleta({ auto: 'Bez výplně', bezBarvy: true, onVyber: (b) => { if (b) posledniVypln = b; P.barvaVyplne(b); P.obnov(); } }) }),
      delene(P, { ik: 'barvaPisma', titulek: 'Barva písma', akce: () => P.barvaPisma(posledniPismo), barva: () => posledniPismo, rozbal: () => paleta({ onVyber: (b) => { if (b !== 'auto') posledniPismo = b; P.barvaPisma(b); P.obnov(); } }) }),
    ),
  ], { spoustec: () => D.dialogFormatBunek(P, 'pismo'), priorita: 8, ikona: 'barvaPisma' });

  const zarovnani = skupina('Zarovnání', [
    radek(
      male(P, { ik: 'zarovnatNahoru', titulek: 'Zarovnat nahoru', akce: () => P.svisle('t'), stav: () => P.stav.v === 't' }),
      male(P, { ik: 'zarovnatDoprostred', titulek: 'Zarovnat doprostřed', akce: () => P.svisle('m'), stav: () => P.stav.v === 'm' }),
      male(P, { ik: 'zarovnatDolu', titulek: 'Zarovnat dolů', akce: () => P.svisle('b'), stav: () => P.stav.v === 'b' }),
      oddelovac(),
      male(P, {
        ik: 'orientace', titulek: 'Orientace', rozbal: () => nabidka([
          { text: 'Otočit text proti směru hodinových ručiček', akce: () => P.otoceni(45) },
          { text: 'Otočit text po směru hodinových ručiček', akce: () => P.otoceni(-45) },
          { text: 'Svislý text', akce: () => P.otoceni('svisle') },
          { text: 'Otočit text nahoru', akce: () => P.otoceni(90) },
          { text: 'Otočit text dolů', akce: () => P.otoceni(-90) },
          { text: 'Vodorovný text', akce: () => P.otoceni(null) },
          'sep',
          { text: 'Formátovat zarovnání buňky', akce: () => D.dialogFormatBunek(P, 'zarovnani') },
        ], { sirka: 280 }),
      }),
      oddelovac(),
      male(P, { ik: 'zalamovat', text: 'Zalamovat text', titulek: 'Zalamovat text', akce: () => P.zalamovat(), stav: () => P.stav.zalam }),
    ),
    radek(
      male(P, { ik: 'zarovnatVlevo', titulek: 'Zarovnat text doleva', akce: () => P.zarovnat('l'), stav: () => P.stav.h === 'l' }),
      male(P, { ik: 'zarovnatNaStred', titulek: 'Zarovnat na střed', akce: () => P.zarovnat('c'), stav: () => P.stav.h === 'c' }),
      male(P, { ik: 'zarovnatVpravo', titulek: 'Zarovnat text doprava', akce: () => P.zarovnat('r'), stav: () => P.stav.h === 'r' }),
      oddelovac(),
      male(P, { ik: 'zmensitOdsazeni', titulek: 'Zmenšit odsazení', akce: () => P.odsazeni(-1) }),
      male(P, { ik: 'zvetsitOdsazeni', titulek: 'Zvětšit odsazení', akce: () => P.odsazeni(1) }),
      oddelovac(),
      (() => {
        const hlavni = el('button.ps-b-cast', { type: 'button', title: 'Sloučit a zarovnat na střed', onclick: () => P.sloucit('stred') }, ik('sloucit'), el('span', { text: 'Sloučit a zarovnat na střed' }));
        const sipka = el('button.ps-b-cast.sipka', { type: 'button', title: 'Sloučit' }, ik('sipkaDolu'));
        const b = el('div.ps-b.male.deleno.s-textem', {}, hlavni, sipka);
        sipka.onclick = () => rozbal(b, nabidka([
          { text: 'Sloučit a zarovnat na střed', ikona: 'sloucit', akce: () => P.sloucit('stred') },
          { text: 'Sloučit přes', akce: () => P.sloucit('pres') },
          { text: 'Sloučit buňky', akce: () => P.sloucit('bunky') },
          { text: 'Zrušit sloučení buněk', akce: () => P.sloucit('zrusit') },
        ], { sirka: 240 }));
        P.stavy.push({ uzel: b, fn: () => P.stav.slouceno });
        P.prikazy.push({ text: 'Sloučit a zarovnat na střed', ikona: 'sloucit', akce: () => P.sloucit('stred') });
        return zadrz(b);
      })(),
    ),
  ], { spoustec: () => D.dialogFormatBunek(P, 'zarovnani'), priorita: 7, ikona: 'zarovnatVlevo' });

  const formatSeznam = () => {
    const v = P.stav.hodnota;
    return el('div.ps-nabidka.tb-formaty', {}, FORMATY.map((f) => el('button.ps-nab-polozka.tb-format-pol', { type: 'button', onclick: () => { zavriRozbal(); P.formatCisla(f.kod); } },
      el('span.tb-format-ik', {}, ik({ obecny: 'cesky', cislo: 'tisice', mena: 'mena', ucetni: 'mena', datum: 'datumFunkce', datumDl: 'datumFunkce', cas: 'hodiny', procenta: 'procenta', zlomek: 'textFunkce', vedecky: 'matFunkce', text: 'textFunkce' }[f.id] || 'cesky')),
      el('span.tb-format-txt', {}, el('b', { text: f.nazev }), el('small', { text: v === null || v === undefined ? '' : formatuj(typeof v === 'string' && f.id !== 'text' ? v : v, f.kod).text })))),
    el('div.ps-nab-sep'), el('button.ps-nab-polozka', { type: 'button', onclick: () => { zavriRozbal(); D.dialogFormatBunek(P, 'cislo'); } }, el('span.ps-nab-ik'), el('span', { text: 'Další formáty čísla…' })));
  };
  const nazevFormatu = () => {
    const k = P.stav.nf || 'General';
    const f = FORMATY.find((x) => x.kod === k);
    if (f) return f.nazev;
    return { obecny: 'Obecný', cislo: 'Číslo', mena: 'Měna', ucetni: 'Účetnický', datum: 'Krátké datum', cas: 'Čas', procenta: 'Procenta', zlomek: 'Zlomky', vedecky: 'Matematický', text: 'Text', vlastni: 'Vlastní' }[rozborKodu(k).kat] || 'Vlastní';
  };
  const cislo = skupina('Číslo', [
    radek((() => {
      const vstup = el('input.ps-kombo-vstup', { type: 'text', readonly: true, style: { width: '104px' }, title: 'Číselný formát' });
      const k = el('div.ps-kombo', {}, vstup, el('button.ps-kombo-sipka', { type: 'button', tabindex: '-1' }, ik('sipkaDolu')));
      k.onclick = () => rozbal(k, formatSeznam(), { app: 'tabulky' });
      P.obnovy.push(() => { vstup.value = nazevFormatu(); });
      P.prikazy.push({ text: 'Číselný formát', ikona: 'tisice', akce: () => rozbal(k, formatSeznam()) });
      return zadrz(k);
    })()),
    radek(
      delene(P, {
        ik: 'mena', titulek: 'Účetnický číselný formát', akce: () => P.menaFormat('Kč'),
        rozbal: () => nabidka([
          { text: 'Kč čeština', akce: () => P.menaFormat('Kč') },
          { text: '€ euro (€ 123)', akce: () => P.menaFormat('€') },
          { text: '$ angličtina (USA)', akce: () => P.menaFormat('$') },
          { text: '£ angličtina (Spojené království)', akce: () => P.menaFormat('£') },
          'sep', { text: 'Další účetnické formáty…', akce: () => D.dialogFormatBunek(P, 'cislo', 'ucetni') },
        ], { sirka: 250 }),
      }),
      male(P, { ik: 'procenta', titulek: 'Styl procent', klavesa: 'Ctrl+Shift+%', akce: () => P.procentaFormat() }),
      male(P, { ik: 'tisice', titulek: 'Styl s oddělovačem tisíců', akce: () => P.tisiceFormat() }),
      oddelovac(),
      male(P, { ik: 'pridatDesetinne', titulek: 'Přidat desetinné místo', akce: () => P.desetinna(1) }),
      male(P, { ik: 'ubratDesetinne', titulek: 'Odebrat desetinné místo', akce: () => P.desetinna(-1) }),
    ),
  ], { spoustec: () => D.dialogFormatBunek(P, 'cislo'), priorita: 6, ikona: 'tisice' });

  const styly = skupina('Styly', [
    velke(P, { ik: 'podminene', text: 'Podmíněné\nformátování', rozbal: () => nabidkaPodminene(P) }),
    velke(P, { ik: 'jakoTabulku', text: 'Formátovat\njako tabulku', rozbal: () => galerieTabulek(P, (k) => P.formatJakoTabulku(k)) }),
    velke(P, { ik: 'stylyBunek', text: 'Styly\nbuněk', rozbal: () => galerieStyluBunek(P) }),
  ], { priorita: 4, ikona: 'stylyBunek' });

  const bunky = skupina('Buňky', [
    velke(P, {
      ik: 'vlozitBunky', text: 'Vložit', deleno: true, akce: () => P.vlozitBunky(),
      rozbal: () => nabidka([
        { text: 'Vložit buňky…', ikona: 'vlozitBunky', akce: () => D.dialogVlozitBunky(P, false) },
        { text: 'Vložit řádky listu', ikona: 'vlozitRadky', akce: () => P.vlozitBunky('radky') },
        { text: 'Vložit sloupce listu', ikona: 'vlozitSloupce', akce: () => P.vlozitBunky('sloupce') },
        'sep', { text: 'Vložit list', ikona: 'list', akce: () => P.novyList() },
      ], { sirka: 220 }),
    }),
    velke(P, {
      ik: 'odstranitBunky', text: 'Odstranit', deleno: true, akce: () => P.odstranitBunky(),
      rozbal: () => nabidka([
        { text: 'Odstranit buňky…', ikona: 'odstranitBunky', akce: () => D.dialogVlozitBunky(P, true) },
        { text: 'Odstranit řádky listu', ikona: 'odstranitRadky', akce: () => P.odstranitBunky('radky') },
        { text: 'Odstranit sloupce listu', ikona: 'odstranitSloupce', akce: () => P.odstranitBunky('sloupce') },
        'sep', { text: 'Odstranit list', ikona: 'list', akce: () => P.smazatList(P.S.list) },
      ], { sirka: 230 }),
    }),
    velke(P, {
      ik: 'formatVelky', text: 'Formát', rozbal: () => {
        const l = P.S.list;
        const sub = (text, pol) => ({ uzel: el('button.ps-nab-polozka.tb-sub', { type: 'button', onclick: (e) => { e.stopPropagation(); rozbal(e.currentTarget, nabidka(pol, { sirka: 230 }), { app: 'tabulky' }); } }, el('span.ps-nab-ik'), el('span.ps-nab-text', { text }), el('span.tb-sub-sipka', { text: '›' })) });
        return nabidka([
          { nadpis: 'Velikost buňky' },
          { text: 'Výška řádku…', ikona: 'vyskaRadku', akce: () => D.dialogRozmer(P, 'vyska') },
          { text: 'Přizpůsobit výšku řádku', akce: () => P.prizpusobVyskyVyberu() },
          { text: 'Šířka sloupce…', ikona: 'sirkaSloupce', akce: () => D.dialogRozmer(P, 'sirka') },
          { text: 'Přizpůsobit šířku sloupce', akce: () => P.prizpusobSirkyVyberu() },
          { text: 'Výchozí šířka…', akce: () => D.dialogRozmer(P, 'vychozi') },
          { nadpis: 'Viditelnost' },
          sub('Skrýt a zobrazit', [
            { text: 'Skrýt řádky', akce: () => P.skryt('radky') }, { text: 'Skrýt sloupce', akce: () => P.skryt('sloupce') },
            { text: 'Skrýt list', akce: () => P.nabidkaListu && P.prikaz('Skrýt list', () => { if (P.S.listy.filter((x) => !x.skryty).length > 1) { l.skryty = true; P.S.aktivni = P.S.listy.findIndex((x) => !x.skryty); } }, { prepocet: false }) },
            'sep', { text: 'Zobrazit řádky', akce: () => P.zobrazitSkryte('radky') }, { text: 'Zobrazit sloupce', akce: () => P.zobrazitSkryte('sloupce') },
            { text: 'Zobrazit list…', akce: () => D.dialogZobrazitList(P) },
          ]),
          { nadpis: 'Uspořádat listy' },
          { text: 'Přejmenovat list', akce: () => P.prejmenovatListNaMiste(l) },
          { text: 'Přesunout nebo zkopírovat list…', akce: () => D.dialogPresunList(P, l) },
          sub('Barva karty', [...['#C00000', '#FF0000', '#FFC000', '#FFFF00', '#92D050', '#00B050', '#00B0F0', '#0070C0', '#002060', '#7030A0'].map((b) => ({ uzel: el('button.ps-nab-polozka', { type: 'button', onclick: () => { zavriRozbal(); P.prikaz('Barva karty', () => { l.barva = b; }, { prepocet: false }); } }, el('span.ps-barva-vzor', { style: { background: b } }), el('span', { text: b })) })), { text: 'Bez barvy', akce: () => P.prikaz('Barva karty', () => { l.barva = null; }, { prepocet: false }) }]),
          { nadpis: 'Zámek' },
          { text: l.zamek ? 'Odemknout list…' : 'Zamknout list…', ikona: 'zamekList', akce: () => (l.zamek ? P.odemknoutList() : D.dialogZamknoutList(P)) },
          { text: 'Zamknout buňku', ikona: 'zamekMaly', zaskrtnuto: P.stav.s?.zamek !== false, akce: () => P.styl({ zamek: P.stav.s?.zamek === false ? null : false }, 'Zamknout buňku') },
          { text: 'Formát buněk…', ikona: 'formatBunek', akce: () => D.dialogFormatBunek(P) },
        ], { sirka: 250 });
      },
    }),
  ], { priorita: 3, ikona: 'vlozitBunky' });

  const upravy = skupina('Úpravy', [
    sloupec(
      (() => {
        const b = delene(P, {
          ik: 'autoSuma', titulek: 'Automatické shrnutí', klavesa: 'Alt+=', akce: () => P.autoSuma('SUMA'),
          rozbal: () => nabidka([
            { text: 'Součet', ikona: 'autoSuma', akce: () => P.autoSuma('SUMA') },
            { text: 'Průměr', akce: () => P.autoSuma('PRŮMĚR') },
            { text: 'Počet čísel', akce: () => P.autoSuma('POČET') },
            { text: 'Maximum', akce: () => P.autoSuma('MAX') },
            { text: 'Minimum', akce: () => P.autoSuma('MIN') },
            'sep', { text: 'Další funkce…', akce: () => D.dialogVlozitFunkci(P) },
          ], { sirka: 180 }),
        });
        b.querySelector('.ps-b-cast').append(el('span', { text: 'Automatické shrnutí' }));
        b.classList.add('s-textem');
        return b;
      })(),
      male(P, {
        ik: 'vypln', text: 'Výplň', rozbal: () => nabidka([
          { text: 'Dolů', akce: () => P.vyplnit('dolu'), klavesa: 'Ctrl+D' }, { text: 'Doprava', akce: () => P.vyplnit('vpravo'), klavesa: 'Ctrl+R' },
          { text: 'Nahoru', akce: () => P.vyplnit('nahoru') }, { text: 'Doleva', akce: () => P.vyplnit('vlevo') },
          'sep', { text: 'Řady…', akce: () => D.dialogRada(P) }, { text: 'Dynamické doplňování', klavesa: 'Ctrl+E', akce: () => P.dynamickeDoplnovani() },
        ], { sirka: 220 }),
      }),
      male(P, {
        ik: 'vymazat', text: 'Vymazat', rozbal: () => nabidka([
          { text: 'Vymazat vše', ikona: 'vymazat', akce: () => P.vymazat('vse') }, { text: 'Vymazat formáty', akce: () => P.vymazat('formaty') },
          { text: 'Vymazat obsah', akce: () => P.vymazat('obsah') }, { text: 'Vymazat komentáře a poznámky', akce: () => P.vymazat('komentare') },
          { text: 'Vymazat hypertextové odkazy', akce: () => P.vymazat('odkazy') },
        ], { sirka: 240 }),
      }),
    ),
    velke(P, {
      ik: 'seraditFiltrVelky', text: 'Seřadit a\nfiltrovat', rozbal: () => nabidka([
        { text: 'Seřadit od A do Z', ikona: 'seraditAZ', akce: () => P.seraditRychle(true) },
        { text: 'Seřadit od Z do A', ikona: 'seraditZA', akce: () => P.seraditRychle(false) },
        { text: 'Vlastní řazení…', ikona: 'seraditVelky', akce: () => D.dialogSeradit(P) },
        'sep',
        { text: 'Filtr', ikona: 'filtrMaly', klavesa: 'Ctrl+Shift+L', zaskrtnuto: !!P.S.list.filtr, akce: () => P.filtr() },
        { text: 'Vymazat', ikona: 'filtrVymazat', akce: () => P.vymazatFiltr() },
        { text: 'Znovu použít', ikona: 'znovuPouzit', akce: () => P.znovuPouzitFiltr() },
      ], { sirka: 240 }),
    }),
    velke(P, {
      ik: 'najit', text: 'Najít a\nvybrat', rozbal: () => nabidka([
        { text: 'Najít…', ikona: 'najitMaly', klavesa: 'Ctrl+F', akce: () => D.dialogNajit(P, 'najit') },
        { text: 'Nahradit…', ikona: 'nahradit', klavesa: 'Ctrl+H', akce: () => D.dialogNajit(P, 'nahradit') },
        { text: 'Přejít na…', klavesa: 'Ctrl+G', akce: () => D.dialogPrejit(P) },
        { text: 'Přejít na – jinak…', akce: () => D.dialogPrejitJinak(P) },
        'sep',
        { text: 'Vzorce', akce: () => D.vyberJinak(P, 'vzorce') },
        { text: 'Poznámky', akce: () => D.vyberJinak(P, 'poznamky') },
        { text: 'Podmíněné formátování', akce: () => D.vyberJinak(P, 'podminene') },
        { text: 'Konstanty', akce: () => D.vyberJinak(P, 'konstanty') },
        { text: 'Ověření dat', akce: () => D.vyberJinak(P, 'overeni') },
      ], { sirka: 230 }),
    }),
  ], { priorita: 5, ikona: 'autoSuma' });

  const analyza = skupina('Analýza', [velke(P, { ik: 'analyzovat', text: 'Analyzovat\ndata', akce: () => P.podokno('analyza') })], { priorita: 2, ikona: 'analyzovat' });
  const ai = skupina('AstroAI', [velke(P, { ik: 'astroai', text: 'AstroAI', akce: () => P.podokno('ai') })], { priorita: 1, ikona: 'astroai' });
  return [schranka, pismo, zarovnani, cislo, styly, bunky, upravy, analyza, ai];
}

// ---------------------------------------------------------------- Vložení
function kartaVlozeni(P) {
  const grafy = (skup) => TYPY_GRAFU.filter((t) => skup.includes(t.skupina)).map((t) => ({ text: t.nazev, ikona: t.ikona, akce: () => P.vlozGraf(t.id) }));
  const nabidkaGrafu = (skup) => () => el('div', {}, nabidka([...grafy(skup), 'sep', { text: 'Další grafy…', akce: () => D.dialogVlozitGraf(P, { karta: 'vse' }) }], { sirka: 300 }));
  return [
    skupina('Tabulky', [
      velke(P, { ik: 'kontingencni', text: 'Kontingenční\ntabulka', akce: () => D.dialogKontingencni(P) }),
      velke(P, { ik: 'kontingencniDoporucene', text: 'Doporučené\nkontingenční tabulky', akce: () => D.dialogKontingencni(P, { doporucene: true }) }),
      velke(P, { ik: 'tabulkaVelka', text: 'Tabulka', klavesa: 'Ctrl+T', akce: () => D.dialogVytvoritTabulku(P) }),
    ], { priorita: 6, ikona: 'tabulkaVelka' }),
    skupina('Ilustrace', [
      velke(P, {
        ik: 'obrazky', text: 'Obrázky', rozbal: () => nabidka([
          { text: 'Toto zařízení…', ikona: 'otevrit', akce: () => { const v = el('input', { type: 'file', accept: 'image/*' }); v.onchange = () => P.vlozObrazekSoubor(v.files[0]); v.click(); } },
          { text: 'Z disku AstroOS…', ikona: 'slozka', akce: () => D.dialogObrazekZDisku(P) },
        ], { sirka: 220 }),
      }),
      velke(P, { ik: 'tvary', text: 'Tvary', rozbal: () => el('div.ps-tvary', {}, TVARY.map(([id, n, svg]) => el('button.ps-tvar', { type: 'button', title: n, onclick: () => { zavriRozbal(); P.vlozTvar(id); }, html: `<svg viewBox="0 0 32 32"><g fill="#dbe9f9" stroke="#0f6cbd" stroke-width="1.4">${svg}</g></svg>` }))) }),
      velke(P, { ik: 'ikonyVlozit', text: 'Ikony', rozbal: () => el('div.ps-symboly', {}, el('div.ps-symboly-mrizka', {}, ['★', '♥', '✔', '✘', '☎', '✉', '⚑', '☀', '☂', '⚠', '➜', '⬆', '⬇', '⌚', '⚽', '♪', '☺', '✈', '⚙', '🏠'].map((s) => el('button', { type: 'button', text: s, onclick: () => { zavriRozbal(); P.prikaz('Ikona', () => P.S.zadej(P.S.list, P.S.list.vyber.r, P.S.list.vyber.c, s)); } })))) }),
    ], { priorita: 4, ikona: 'obrazky' }),
    skupina('Grafy', [
      velke(P, { ik: 'doporuceneGrafy', text: 'Doporučené\ngrafy', akce: () => D.dialogVlozitGraf(P) }),
      sloupec(
        radek(
          male(P, { ik: 'grafSloupce', titulek: 'Vložit sloupcový nebo pruhový graf', rozbal: nabidkaGrafu(['Sloupcový', 'Pruhový']) }),
          male(P, { ik: 'grafSpojnice', titulek: 'Vložit spojnicový nebo plošný graf', rozbal: nabidkaGrafu(['Spojnicový', 'Plošný']) }),
          male(P, { ik: 'grafVysec', titulek: 'Vložit výsečový nebo prstencový graf', rozbal: nabidkaGrafu(['Výsečový']) }),
        ),
        radek(
          male(P, { ik: 'grafBodovy', titulek: 'Vložit bodový (XY) graf', rozbal: nabidkaGrafu(['XY bodový']) }),
          male(P, { ik: 'grafKombo', titulek: 'Vložit kombinovaný graf', akce: () => P.vlozGraf('kombinovany') }),
          male(P, { ik: 'grafPlosny', titulek: 'Vložit plošný graf', akce: () => P.vlozGraf('plosny') }),
        ),
      ),
      velke(P, { ik: 'kontingencniGraf', text: 'Kontingenční\ngraf', akce: () => D.dialogKontingencni(P, { graf: true }) }),
    ], { spoustec: () => D.dialogVlozitGraf(P, { karta: 'vse' }), priorita: 7, ikona: 'doporuceneGrafy' }),
    skupina('Minigrafy', [
      velke(P, { ik: 'minigrafCara', text: 'Spojnicový', akce: () => D.dialogMinigrafy(P, 'cara') }),
      velke(P, { ik: 'minigrafSloupec', text: 'Sloupcový', akce: () => D.dialogMinigrafy(P, 'sloupec') }),
      velke(P, { ik: 'minigrafZtrata', text: 'Zisk/\nztráta', akce: () => D.dialogMinigrafy(P, 'ztrata') }),
    ], { priorita: 3, ikona: 'minigrafCara' }),
    skupina('Filtry', [
      velke(P, { ik: 'prurez', text: 'Průřez', akce: () => zprava(P.koren, 'Průřezy se připojují k tabulkám a kontingenčním tabulkám. Filtrujte zatím tlačítky filtru v záhlaví tabulky.') }),
      velke(P, { ik: 'casovaOsa', text: 'Časová\nosa', zakazano: true }),
    ], { priorita: 1, ikona: 'prurez' }),
    skupina('Odkazy', [velke(P, { ik: 'odkaz', text: 'Odkaz', klavesa: 'Ctrl+K', akce: () => D.dialogOdkaz(P) })], { priorita: 5, ikona: 'odkaz' }),
    skupina('Komentáře', [velke(P, { ik: 'komentarNovy', text: 'Komentář', akce: () => P.podokno('komentare', { novy: true }) })], { priorita: 5, ikona: 'komentarNovy' }),
    skupina('Text', [
      velke(P, { ik: 'textovePole', text: 'Textové\npole', akce: () => P.vlozTvar('text') }),
      velke(P, { ik: 'zahlavi', text: 'Záhlaví a\nzápatí', akce: () => D.dialogVzhledStranky(P, 'zahlavi') }),
      velke(P, { ik: 'wordart', text: 'WordArt', akce: () => { P.vlozTvar('text'); } }),
    ], { priorita: 2, ikona: 'textovePole' }),
    skupina('Symboly', [
      velke(P, { ik: 'rovnice', text: 'Rovnice', akce: () => P.prikaz('Rovnice', () => P.S.zadej(P.S.list, P.S.list.vyber.r, P.S.list.vyber.c, 'x = (−b ± √(b² − 4ac)) / 2a')) }),
      velke(P, { ik: 'symbol', text: 'Symbol', akce: () => D.dialogSymbol(P) }),
    ], { priorita: 2, ikona: 'symbol' }),
  ];
}

// ---------------------------------------------------------------- Kreslení
function kartaKresleni(P) {
  const pero = (id, text, barva, ikona = 'pero', sirka = 2) => {
    const b = velke(P, { ik: ikona, text, akce: () => P.kreslit(P.st.kresleni?.id === id ? null : { id, barva, sirka, zvyraznovac: ikona === 'zvyraznovacKresleni' }) });
    b.querySelector('.psi')?.style.setProperty('color', barva);
    P.stavy.push({ uzel: b, fn: () => P.st.kresleni?.id === id });
    return b;
  };
  return [
    skupina('Nástroje kreslení', [
      velke(P, { ik: 'vybrat', text: 'Vybrat', akce: () => P.kreslit(null), stav: () => !P.st.kresleni }),
      pero('cerne', 'Pero', '#000000'), pero('cervene', 'Pero', '#E0301E'), pero('modre', 'Pero', '#0F6CBD'),
      pero('zvyr', 'Zvýrazňovač', '#FFEB3B', 'zvyraznovacKresleni', 12),
      velke(P, { ik: 'guma', text: 'Guma', akce: () => P.kreslit(P.st.kresleni?.id === 'guma' ? null : { id: 'guma', guma: true }), stav: () => P.st.kresleni?.id === 'guma' }),
    ], { priorita: 5, ikona: 'pero' }),
    skupina('Úpravy', [
      velke(P, { ik: 'odstranit', text: 'Vymazat\nkresbu', akce: () => P.prikaz('Vymazat kresbu', () => { P.S.list.kresba = []; }, { prepocet: false }) }),
    ], { priorita: 3, ikona: 'odstranit' }),
  ];
}

// ---------------------------------------------------------------- Rozložení stránky
function kartaRozlozeni(P) {
  const tisk = () => P.S.list.tisk || (P.S.list.tisk = {});
  const nastav = (z, popis) => P.prikaz(popis, () => { P.S.list.tisk = { ...(P.S.list.tisk || {}), ...z }; }, { prepocet: false });
  const zaskrt = (text, fn, akce) => {
    const ch = el('input', { type: 'checkbox' });
    ch.onchange = () => akce(ch.checked);
    P.obnovy.push(() => { ch.checked = !!fn(); });
    return el('label.ps-zaskrt', {}, ch, el('span', { text }));
  };
  return [
    skupina('Motivy', [
      velke(P, { ik: 'motivy', text: 'Motivy', rozbal: () => nabidka([{ nadpis: 'Office' }, { text: 'Motiv Office', zaskrtnuto: true }, { text: 'Hledat motivy…', zakazano: true }], { sirka: 200 }) }),
      sloupec(
        male(P, { ik: 'zmenitBarvy', text: 'Barvy', rozbal: () => nabidka(Object.entries(PALETY).map(([id, b]) => ({ uzel: el('button.ps-nab-polozka', { type: 'button', onclick: () => { zavriRozbal(); P.prikaz('Barvy motivu', () => { for (const g of P.S.list.grafy) g.paleta = id; }, { prepocet: false }); } }, el('span.ps-barvy-vzor', {}, b.map((x) => el('i', { style: { background: x } }))), el('span', { text: NAZVY_PALET[id] })) })), { sirka: 260 }) }),
        male(P, { ik: 'velikostPismen', text: 'Písma', rozbal: () => nabidka([{ text: 'Office · Aptos Narrow', zaskrtnuto: true }, { text: 'Hledat písma…', zakazano: true }], { sirka: 220 }) }),
        male(P, { ik: 'efekty', text: 'Efekty', zakazano: true }),
      ),
    ], { priorita: 2, ikona: 'motivy' }),
    skupina('Vzhled stránky', [
      velke(P, { ik: 'okrajeVelke', text: 'Okraje', rozbal: () => nabidka([
        { text: 'Normální', zaskrtnuto: (tisk().okraje || 'normalni') === 'normalni', akce: () => nastav({ okraje: 'normalni' }, 'Okraje') },
        { text: 'Široké', zaskrtnuto: tisk().okraje === 'siroke', akce: () => nastav({ okraje: 'siroke' }, 'Okraje') },
        { text: 'Úzké', zaskrtnuto: tisk().okraje === 'uzke', akce: () => nastav({ okraje: 'uzke' }, 'Okraje') },
        'sep', { text: 'Vlastní okraje…', akce: () => D.dialogVzhledStranky(P, 'okraje') },
      ], { sirka: 200 }) }),
      velke(P, { ik: 'orientace', text: 'Orientace', rozbal: () => nabidka([
        { text: 'Na výšku', zaskrtnuto: tisk().orientace !== 'sirka', akce: () => nastav({ orientace: 'vyska' }, 'Orientace') },
        { text: 'Na šířku', zaskrtnuto: tisk().orientace === 'sirka', akce: () => nastav({ orientace: 'sirka' }, 'Orientace') },
      ], { sirka: 160 }) }),
      velke(P, { ik: 'velikost', text: 'Velikost', rozbal: () => nabidka(['A4', 'A3', 'A5', 'Letter'].map((p) => ({ text: { A4: 'A4 (21 × 29,7 cm)', A3: 'A3 (29,7 × 42 cm)', A5: 'A5 (14,8 × 21 cm)', Letter: 'Letter (21,59 × 27,94 cm)' }[p], zaskrtnuto: (tisk().papir || 'A4') === p, akce: () => nastav({ papir: p }, 'Velikost papíru') })), { sirka: 230 }) }),
      velke(P, { ik: 'oblastTisku', text: 'Oblast\ntisku', rozbal: () => nabidka([
        { text: 'Nastavit oblast tisku', akce: () => nastav({ oblast: textOblasti(P.S.list.vyber.oblasti.at(-1)) }, 'Oblast tisku') },
        { text: 'Vymazat oblast tisku', akce: () => nastav({ oblast: null }, 'Oblast tisku') },
      ], { sirka: 210 }) }),
      velke(P, { ik: 'konce', text: 'Konce', rozbal: () => nabidka([{ text: 'Zobrazit konce stránek', akce: () => P.zobrazeni('konce') }, { text: 'Vrátit normální zobrazení', akce: () => P.zobrazeni('normalni') }], { sirka: 220 }) }),
      velke(P, { ik: 'pozadi', text: 'Pozadí', zakazano: true }),
      velke(P, { ik: 'tiskNazvu', text: 'Tisk\nnázvů', akce: () => D.dialogVzhledStranky(P, 'list') }),
    ], { spoustec: () => D.dialogVzhledStranky(P), priorita: 6, ikona: 'okrajeVelke' }),
    skupina('Přizpůsobit', [
      sloupec(
        el('label.ps-spin', {}, el('span.ps-spin-popis', { text: 'Šířka:' }), (() => { const s = el('select.ps-vyber.tb-maly-vyber', { onchange: (e) => nastav({ naSirku1: e.target.value === '1' }, 'Přizpůsobit') }, el('option', { value: 'a', text: 'Automaticky' }), el('option', { value: '1', text: '1 stránka' })); P.obnovy.push(() => { s.value = tisk().naSirku1 ? '1' : 'a'; }); return s; })()),
        el('label.ps-spin', {}, el('span.ps-spin-popis', { text: 'Výška:' }), el('select.ps-vyber.tb-maly-vyber', {}, el('option', { text: 'Automaticky' }))),
        el('label.ps-spin', {}, el('span.ps-spin-popis', { text: 'Měřítko:' }), (() => { const i = el('input.ps-vstup.tb-maly-vyber', { type: 'number', min: 10, max: 400, step: 5, onchange: (e) => nastav({ meritko: +e.target.value || 100 }, 'Měřítko') }); P.obnovy.push(() => { i.value = tisk().meritko || 100; }); i.addEventListener('keydown', (e) => e.stopPropagation()); return i; })()),
      ),
    ], { spoustec: () => D.dialogVzhledStranky(P, 'stranka'), priorita: 3, ikona: 'meritko' }),
    skupina('Možnosti listu', [
      el('div.tb-moznosti-listu', {},
        el('div', {}, el('b', { text: 'Mřížka' }), zaskrt('Zobrazit', () => P.S.list.mrizka !== false, () => P.prepnoutMrizku()), zaskrt('Tisk', () => tisk().mrizka, (x) => nastav({ mrizka: x }, 'Tisk mřížky'))),
        el('div', {}, el('b', { text: 'Záhlaví' }), zaskrt('Zobrazit', () => P.S.list.zahlavi !== false, () => P.prepnoutZahlavi()), zaskrt('Tisk', () => tisk().zahlavi, (x) => nastav({ zahlavi: x }, 'Tisk záhlaví')))),
    ], { spoustec: () => D.dialogVzhledStranky(P, 'list'), priorita: 4, ikona: 'mrizka' }),
    skupina('Uspořádat', [
      sloupec(
        male(P, { ik: 'predchozi', text: 'Přenést blíž', akce: () => P.poradiObjektu?.(1), zakazano: false }),
        male(P, { ik: 'dalsi', text: 'Přenést dál', akce: () => P.poradiObjektu?.(-1) }),
        male(P, { ik: 'navigace', text: 'Podokno výběru', akce: () => P.podokno('vyber') }),
      ),
    ], { priorita: 1, ikona: 'navigace' }),
  ];
}

// ---------------------------------------------------------------- Vzorce
function kartaVzorce(P) {
  const kat = (id, ikona, text) => velke(P, { ik: ikona, text, rozbal: () => nabidkaFunkci(P, id) });
  const nedavne = () => {
    const n = (P.nastaveni().nedavneFunkce || ['SUMA', 'PRŮMĚR', 'KDYŽ', 'SVYHLEDAT', 'POČET', 'MAX', 'MIN', 'ZAOKROUHLIT', 'COUNTIF', 'DNES']).map((x) => FUNKCE[x]).filter(Boolean);
    return el('div', {}, nabidka([...n.map((f) => ({ text: f.n, akce: () => D.dialogArgumenty(P, f) })), 'sep', { text: 'Vložit funkci…', ikona: 'fx', akce: () => D.dialogVlozitFunkci(P) }], { sirka: 220 }));
  };
  return [
    skupina('Knihovna funkcí', [
      velke(P, { ik: 'vlozitFunkci', text: 'Vložit\nfunkci', klavesa: 'Shift+F3', akce: () => D.dialogVlozitFunkci(P), titulek: 'Vložit funkci…' }),
      velke(P, {
        ik: 'autoSumaVelka', text: 'Automatické\nshrnutí', deleno: true, akce: () => P.autoSuma('SUMA'),
        rozbal: () => nabidka([{ text: 'Součet', akce: () => P.autoSuma('SUMA') }, { text: 'Průměr', akce: () => P.autoSuma('PRŮMĚR') }, { text: 'Počet čísel', akce: () => P.autoSuma('POČET') }, { text: 'Maximum', akce: () => P.autoSuma('MAX') }, { text: 'Minimum', akce: () => P.autoSuma('MIN') }], { sirka: 170 }),
      }),
      velke(P, { ik: 'naposledy', text: 'Naposledy\npoužité', rozbal: nedavne }),
      kat('fin', 'financni', 'Finanční'),
      kat('log', 'logicke', 'Logické'),
      kat('text', 'textFunkce', 'Text'),
      kat('dat', 'datumFunkce', 'Datum\na čas'),
      kat('vyhl', 'hledaniFunkce', 'Vyhledávací\na referenční'),
      kat('mat', 'matFunkce', 'Matematické\na trigonometrické'),
      velke(P, { ik: 'dalsiFunkce', text: 'Další\nfunkce', rozbal: () => nabidka([
        { uzel: el('button.ps-nab-polozka.tb-sub', { type: 'button', onclick: (e) => { e.stopPropagation(); rozbal(e.currentTarget, nabidkaFunkci(P, 'stat'), { app: 'tabulky' }); } }, el('span.ps-nab-ik', {}, ik('statistika')), el('span.ps-nab-text', { text: 'Statistické' }), el('span.tb-sub-sipka', { text: '›' })) },
        { uzel: el('button.ps-nab-polozka.tb-sub', { type: 'button', onclick: (e) => { e.stopPropagation(); rozbal(e.currentTarget, nabidkaFunkci(P, 'info'), { app: 'tabulky' }); } }, el('span.ps-nab-ik', {}, ik('informace')), el('span.ps-nab-text', { text: 'Informační' }), el('span.tb-sub-sipka', { text: '›' })) },
      ], { sirka: 200 }) }),
    ], { priorita: 6, ikona: 'vlozitFunkci' }),
    skupina('Definované názvy', [
      velke(P, { ik: 'spravceNazvu', text: 'Správce\nnázvů', klavesa: 'Ctrl+F3', akce: () => D.dialogSpravceNazvu(P) }),
      sloupec(
        male(P, { ik: 'tuzka', text: 'Definovat název', akce: () => D.dialogNovyNazev(P) }),
        male(P, { ik: 'fx', text: 'Použít ve vzorci', rozbal: () => { const n = [...P.S.nazvy.values()]; return nabidka(n.length ? n.map((d) => ({ text: d.nazev, akce: () => P.pouzijNazev(d.nazev) })) : [{ text: 'Žádné definované názvy', zakazano: true }], { sirka: 200 }); } }),
        male(P, { ik: 'tabulka', text: 'Vytvořit z výběru', akce: () => D.dialogZVyberu(P) }),
      ),
    ], { priorita: 4, ikona: 'spravceNazvu' }),
    skupina('Závislosti vzorců', [
      sloupec(
        male(P, { ik: 'predchudci', text: 'Předchůdci', akce: () => P.predchudci() }),
        male(P, { ik: 'naslednici', text: 'Následníci', akce: () => P.naslednici() }),
        male(P, { ik: 'odebratSipky', text: 'Odebrat šipky', akce: () => P.odebratSipky() }),
      ),
      sloupec(
        male(P, { ik: 'zobrazitVzorce', text: 'Zobrazit vzorce', klavesa: 'Ctrl+`', akce: () => P.zobrazitVzorce(), stav: () => !!P.S.list.zobrazitVzorce }),
        male(P, { ik: 'kontrolaChyb', text: 'Kontrola chyb', akce: () => P.podokno('chyby') }),
        male(P, { ik: 'vyhodnotit', text: 'Vyhodnotit vzorec', akce: () => D.dialogVyhodnotit(P) }),
      ),
      velke(P, { ik: 'kukatko', text: 'Okno\nkukátka', akce: () => P.podokno('kukatko') }),
    ], { priorita: 5, ikona: 'predchudci' }),
    skupina('Výpočet', [
      velke(P, { ik: 'moznostiVypoctu', text: 'Možnosti\nvýpočtů', rozbal: () => nabidka([
        { text: 'Automaticky', zaskrtnuto: P.S.vypocet === 'auto', akce: () => P.moznostiVypoctu('auto') },
        { text: 'Ručně', zaskrtnuto: P.S.vypocet === 'rucne', akce: () => P.moznostiVypoctu('rucne') },
      ], { sirka: 180 }) }),
      sloupec(
        male(P, { ik: 'prepocitat', text: 'Přepočítat', klavesa: 'F9', akce: () => P.prepocitat() }),
        male(P, { ik: 'prepocitatList', text: 'Přepočítat list', klavesa: 'Shift+F9', akce: () => P.prepocitat(false) }),
      ),
    ], { priorita: 3, ikona: 'moznostiVypoctu' }),
  ];
}

// ---------------------------------------------------------------- Data
function kartaData(P) {
  return [
    skupina('Načíst a transformovat data', [
      velke(P, { ik: 'nacistData', text: 'Načíst\ndata', rozbal: () => nabidka([
        { text: 'Z textu/CSV…', ikona: 'csv', akce: () => D.dialogImportCsv(P) },
        { text: 'Z webu…', ikona: 'web', akce: () => D.dialogZWebu(P) },
        { text: 'Z tabulky/oblasti', ikona: 'tabulka', akce: () => D.dialogVytvoritTabulku(P) },
        { text: 'Ze sešitu na disku…', ikona: 'otevrit', akce: () => D.dialogImportSesit(P) },
      ], { sirka: 220 }) }),
      sloupec(
        male(P, { ik: 'csv', text: 'Z textu/CSV', akce: () => D.dialogImportCsv(P) }),
        male(P, { ik: 'web', text: 'Z webu', akce: () => D.dialogZWebu(P) }),
        male(P, { ik: 'tabulka', text: 'Z tabulky/oblasti', akce: () => D.dialogVytvoritTabulku(P) }),
      ),
    ], { priorita: 3, ikona: 'nacistData' }),
    skupina('Dotazy a připojení', [
      velke(P, { ik: 'aktualizovatVse', text: 'Aktualizovat\nvše', akce: () => { P.aktualizujKontingencni?.(); P.aktualizujWeb?.(); P.prepocitat(); } }),
    ], { priorita: 2, ikona: 'aktualizovatVse' }),
    skupina('Seřadit a filtrovat', [
      sloupec(
        male(P, { ik: 'seraditAZ', titulek: 'Seřadit od A do Z', akce: () => P.seraditRychle(true) }),
        male(P, { ik: 'seraditZA', titulek: 'Seřadit od Z do A', akce: () => P.seraditRychle(false) }),
      ),
      velke(P, { ik: 'seraditVelky', text: 'Seřadit', akce: () => D.dialogSeradit(P) }),
      velke(P, { ik: 'filtrVelky', text: 'Filtr', klavesa: 'Ctrl+Shift+L', akce: () => P.filtr(), stav: () => !!P.S.list.filtr || !!P.stav.tabulka?.filtrTl }),
      sloupec(
        male(P, { ik: 'filtrVymazat', text: 'Vymazat', akce: () => P.vymazatFiltr() }),
        male(P, { ik: 'znovuPouzit', text: 'Znovu použít', akce: () => P.znovuPouzitFiltr() }),
        male(P, { ik: 'filtrMaly', text: 'Upřesnit', akce: () => D.dialogSeradit(P) }),
      ),
    ], { priorita: 7, ikona: 'seraditFiltrVelky' }),
    skupina('Datové nástroje', [
      velke(P, { ik: 'textDoSloupcu', text: 'Text do\nsloupců', akce: () => D.dialogTextDoSloupcu(P) }),
      sloupec(
        male(P, { ik: 'dynamicke', titulek: 'Dynamické doplňování', klavesa: 'Ctrl+E', akce: () => P.dynamickeDoplnovani() }),
        male(P, { ik: 'duplicity', titulek: 'Odebrat duplicity', akce: () => D.dialogDuplicity(P) }),
        delene(P, { ik: 'overeni', titulek: 'Ověření dat', akce: () => D.dialogOvereni(P), rozbal: () => nabidka([
          { text: 'Ověření dat…', ikona: 'overeni', akce: () => D.dialogOvereni(P) },
          { text: 'Zakroužkovat neplatná data', akce: () => P.zakrouzkovatNeplatna() },
          { text: 'Vymazat kroužky ověření', akce: () => { P.grid.sipky = P.grid.sipky.filter((s) => !s.krouzek); P.grid.prekresli(); } },
        ], { sirka: 240 }) }),
      ),
      sloupec(
        male(P, { ik: 'souhrn', titulek: 'Sloučit', zakazano: true }),
        male(P, { ik: 'dataMaly', titulek: 'Relace', zakazano: true }),
      ),
    ], { priorita: 5, ikona: 'textDoSloupcu' }),
    skupina('Prognóza', [
      velke(P, { ik: 'citlivostni', text: 'Citlivostní\nanalýza', rozbal: () => nabidka([
        { text: 'Správce scénářů…', zakazano: true },
        { text: 'Hledání řešení…', akce: () => D.dialogHledaniReseni(P) },
        { text: 'Tabulka dat…', zakazano: true },
      ], { sirka: 200 }) }),
      velke(P, { ik: 'prognoza', text: 'List\nprognózy', akce: () => D.dialogPrognoza(P) }),
    ], { priorita: 4, ikona: 'citlivostni' }),
    skupina('Osnova', [
      sloupec(
        male(P, { ik: 'seskupit', text: 'Seskupit', akce: () => P.seskupit(true) }),
        male(P, { ik: 'oddelit', text: 'Oddělit', akce: () => P.seskupit(false) }),
        male(P, { ik: 'souhrn', text: 'Souhrn', akce: () => D.dialogSouhrn(P) }),
      ),
    ], { priorita: 2, ikona: 'seskupit' }),
  ];
}

// ---------------------------------------------------------------- Revize
function kartaRevize(P) {
  return [
    skupina('Kontrola pravopisu', [
      velke(P, { ik: 'pravopis', text: 'Pravopis', klavesa: 'F7', akce: () => P.podokno('pravopis') }),
      velke(P, { ik: 'statistika', text: 'Statistika\nsešitu', akce: () => D.dialogStatistika(P) }),
    ], { priorita: 4, ikona: 'pravopis' }),
    skupina('Přístupnost', [velke(P, { ik: 'pristupnost', text: 'Zkontrolovat\npřístupnost', akce: () => P.podokno('pristupnost') })], { priorita: 3, ikona: 'pristupnost' }),
    skupina('Přehledy', [velke(P, { ik: 'najit', text: 'Inteligentní\nvyhledávání', akce: () => { const t = P.S.textBunky(P.S.list, P.S.list.vyber.r, P.S.list.vyber.c); P.otevriAplikaci('browser', { url: 'https://cs.wikipedia.org/wiki/' + encodeURIComponent(t || 'Tabulkový_procesor') }); } })], { priorita: 1, ikona: 'najit' }),
    skupina('Komentáře', [
      velke(P, { ik: 'komentarNovy', text: 'Nový\nkomentář', akce: () => P.podokno('komentare', { novy: true }) }),
      velke(P, { ik: 'smazatKomentar', text: 'Odstranit', akce: () => P.smazatPoznamku() }),
      sloupec(
        male(P, { ik: 'predchozi', text: 'Předchozí', akce: () => P.dalsiKomentar(-1) }),
        male(P, { ik: 'dalsi', text: 'Další', akce: () => P.dalsiKomentar(1) }),
      ),
      velke(P, { ik: 'zobrazitKomentare', text: 'Zobrazit\nkomentáře', akce: () => P.podokno(P.st.podokno === 'komentare' ? null : 'komentare'), stav: () => P.st.podokno === 'komentare' }),
    ], { priorita: 5, ikona: 'komentarNovy' }),
    skupina('Poznámky', [
      velke(P, { ik: 'poznamkyVelke', text: 'Poznámky', rozbal: () => nabidka([
        { text: 'Nová poznámka', ikona: 'poznamka', klavesa: 'Shift+F2', akce: () => P.novaPoznamka() },
        { text: 'Předchozí poznámka', akce: () => P.dalsiPoznamka?.(-1) },
        { text: 'Další poznámka', akce: () => P.dalsiPoznamka?.(1) },
        { text: 'Zobrazit/skrýt poznámku', akce: () => { P.grid.poznamkaPripnuta = !P.grid.poznamkaPripnuta; const v = P.S.list.vyber; const b = P.S.bunka(P.S.list, v.r, v.c); if (b?.pozn && P.grid.poznamkaPripnuta) P.grid.ukazPoznamku(v.r, v.c, b); else P.grid.poznamka.hidden = true; } },
        { text: 'Převést na komentáře', akce: () => P.prevestPoznamky?.() },
      ], { sirka: 230 }) }),
    ], { priorita: 3, ikona: 'poznamkyVelke' }),
    skupina('Zamknout', [
      velke(P, { ik: 'zamekListVelky', text: 'Zamknout\nlist', akce: () => (P.S.list.zamek ? P.odemknoutList() : D.dialogZamknoutList(P)), stav: () => !!P.S.list.zamek }),
      velke(P, { ik: 'zamekSesitVelky', text: 'Zamknout\nsešit', akce: () => D.dialogZamknoutSesit(P), stav: () => !!P.S.zamek }),
      velke(P, { ik: 'zamek', text: 'Povolit úpravy\noblastí', zakazano: true }),
    ], { priorita: 4, ikona: 'zamekListVelky' }),
  ];
}

// ---------------------------------------------------------------- Zobrazení
function kartaZobrazeni(P) {
  const zaskrt = (text, fn, akce) => {
    const ch = el('input', { type: 'checkbox' });
    ch.onchange = () => akce(ch.checked);
    P.obnovy.push(() => { ch.checked = !!fn(); });
    return el('label.ps-zaskrt', {}, ch, el('span', { text }));
  };
  return [
    skupina('Zobrazení sešitu', [
      velke(P, { ik: 'normalni', text: 'Normální', akce: () => P.zobrazeni('normalni'), stav: () => P.st.zobrazeni === 'normalni' }),
      velke(P, { ik: 'konceStranek', text: 'Zobrazení konců\nstránek', akce: () => P.zobrazeni('konce'), stav: () => P.st.zobrazeni === 'konce' }),
      velke(P, { ik: 'rozlozeniStranky', text: 'Rozložení\nstránky', akce: () => P.zobrazeni('rozlozeni'), stav: () => P.st.zobrazeni === 'rozlozeni' }),
      velke(P, { ik: 'vlastniZobrazeni', text: 'Vlastní\nzobrazení', zakazano: true }),
    ], { priorita: 4, ikona: 'normalni' }),
    skupina('Zobrazit', [
      el('div.tb-zobrazit-zaskrt', {},
        zaskrt('Pravítko', () => P.st.zobrazeni === 'rozlozeni', () => P.zobrazeni(P.st.zobrazeni === 'rozlozeni' ? 'normalni' : 'rozlozeni')),
        zaskrt('Řádek vzorců', () => P.st.radekVzorcu, (x) => P.radekVzorcuViditelny(x)),
        zaskrt('Mřížka', () => P.S.list.mrizka !== false, () => P.prepnoutMrizku()),
        zaskrt('Záhlaví', () => P.S.list.zahlavi !== false, () => P.prepnoutZahlavi())),
    ], { priorita: 5, ikona: 'mrizka' }),
    skupina('Lupa', [
      velke(P, { ik: 'lupa', text: 'Lupa', akce: () => D.dialogLupa(P) }),
      velke(P, { ik: 'sto', text: '100 %', akce: () => P.lupa(1) }),
      velke(P, { ik: 'priblizitVyber', text: 'Přizpůsobit\nvýběru', akce: () => P.lupaNaVyber() }),
    ], { priorita: 3, ikona: 'lupa' }),
    skupina('Okno', [
      velke(P, { ik: 'noveOkno', text: 'Nové\nokno', zakazano: true }),
      velke(P, { ik: 'usporadat', text: 'Uspořádat\nvše', zakazano: true }),
      velke(P, { ik: 'ukotvitVelke', text: 'Ukotvit\npříčky', rozbal: () => nabidka([
        { text: P.S.list.ukotveni ? 'Uvolnit příčky' : 'Ukotvit příčky', ikona: 'ukotvit', akce: () => P.ukotvit(P.S.list.ukotveni ? 'zrusit' : 'pricky') },
        { text: 'Ukotvit horní řádek', akce: () => P.ukotvit('radek') },
        { text: 'Ukotvit první sloupec', akce: () => P.ukotvit('sloupec') },
      ], { sirka: 230 }) }),
      sloupec(
        male(P, { ik: 'rozdelit', text: 'Rozdělit', zakazano: true }),
        male(P, { ik: 'skryt', text: 'Skrýt', zakazano: true }),
        male(P, { ik: 'oko', text: 'Zobrazit', zakazano: true }),
      ),
      velke(P, { ik: 'prepnoutOkna', text: 'Přepnout\nokna', rozbal: () => nabidka([{ text: `1 ${P.st.nazev}`, zaskrtnuto: true }], { sirka: 220 }) }),
    ], { priorita: 6, ikona: 'ukotvitVelke' }),
    skupina('Makra', [velke(P, { ik: 'skriptyVelke', text: 'Makra', akce: () => P.podokno('skripty') })], { priorita: 1, ikona: 'skriptyVelke' }),
  ];
}

// ---------------------------------------------------------------- Automatizovat
function kartaAutomatizace(P) {
  return [
    skupina('Office skripty', [
      velke(P, { ik: 'novyScript', text: 'Nový\nskript', akce: () => P.podokno('skripty', { novy: true }) }),
      velke(P, { ik: 'skriptyVelke', text: 'Zobrazit\nskripty', akce: () => P.podokno('skripty') }),
      velke(P, { ik: 'zaznamenatVelke', text: 'Zaznamenat\nakce', akce: () => P.zaznamAkci?.() }),
    ], { priorita: 3, ikona: 'skriptyVelke' }),
    skupina('Ukázkové skripty', [
      el('div.tb-skripty-galerie', {}, (P.UKAZKOVE_SKRIPTY || []).map((s) => zadrz(el('button.tb-skript-karta', { type: 'button', title: s.popis, onclick: () => P.spustSkript(s.kod, s.nazev) }, ik('skript'), el('span', { text: s.nazev }))))),
    ], { priorita: 2, ikona: 'skript' }),
  ];
}

// ---------------------------------------------------------------- Nápověda
function kartaNapoveda(P) {
  return [
    skupina('Nápověda', [
      velke(P, { ik: 'napoveda', text: 'Nápověda', klavesa: 'F1', akce: () => P.podokno('napoveda') }),
      velke(P, { ik: 'podpora', text: 'Klávesové\nzkratky', akce: () => P.podokno('napoveda', { zkratky: true }) }),
      velke(P, { ik: 'nazory', text: 'Názory', akce: () => D.dialogNazory(P) }),
      velke(P, { ik: 'skoleni', text: 'Zobrazit\nškolení', akce: () => P.novy('prohlidka') }),
      velke(P, { ik: 'coNoveho', text: 'Co je\nnového', akce: () => P.podokno('napoveda', { novinky: true }) }),
    ], { priorita: 5, ikona: 'napoveda' }),
  ];
}

// ---------------------------------------------------------------- Návrh tabulky
function kartaTabNavrh(P) {
  const t = () => P.stav.tabulka;
  const nazev = el('input.ps-vstup.tb-nazev-tabulky', { type: 'text', spellcheck: 'false' });
  nazev.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { P.nastavTabulku({ nazev: nazev.value }); P.grid.fokus(); } if (e.key === 'Escape') { nazev.value = t()?.nazev || ''; P.grid.fokus(); } });
  nazev.addEventListener('blur', () => { if (t() && nazev.value !== t().nazev) P.nastavTabulku({ nazev: nazev.value }); });
  P.obnovy.push(() => { if (document.activeElement !== nazev) nazev.value = t()?.nazev || ''; });
  const zaskrt = (text, klic, vychozi) => {
    const ch = el('input', { type: 'checkbox' });
    ch.onchange = () => P.nastavTabulku({ [klic]: ch.checked });
    P.obnovy.push(() => { const x = t(); if (x) ch.checked = x[klic] === undefined ? vychozi : !!x[klic]; });
    return el('label.ps-zaskrt', {}, ch, el('span', { text }));
  };
  const galerieRam = el('div.tb-gal-inline');
  let posledniStyl = null;
  P.obnovy.push(() => {
    const x = t();
    if (!x || x.styl + x.pruhyR + x.zahlavi === posledniStyl) return;
    posledniStyl = x.styl + x.pruhyR + x.zahlavi;
    const vybrane = ['svetly1', 'svetly9', 'svetly15', 'stredni1', 'stredni2', 'stredni3', 'stredni4', 'stredni9', 'stredni16', 'tmavy2'];
    galerieRam.replaceChildren(...vybrane.map((k) => el('button.tb-gal-tab' + (x.styl === k ? '.zapnuto' : ''), { type: 'button', title: STYLY_TABULEK[k].nazev, onclick: () => P.formatJakoTabulku(k) }, nahledStyluTabulky(k))),
      el('button.ps-gal-sipka.tb-gal-vice', { type: 'button', text: '▾', title: 'Další', onclick: (e) => rozbal(e.currentTarget, galerieTabulek(P, (k) => P.formatJakoTabulku(k)), { app: 'tabulky' }) }));
  });
  return [
    skupina('Vlastnosti', [
      sloupec(el('span.tb-popis-maly', { text: 'Název tabulky:' }), nazev,
        male(P, { ik: 'sirkaSloupce', text: 'Změnit velikost tabulky', akce: () => D.dialogZmenitTabulku(P) })),
    ], { priorita: 5, ikona: 'tabulka' }),
    skupina('Nástroje', [
      sloupec(
        male(P, { ik: 'kontingencni', text: 'Shrnout pomocí kontingenční tabulky', akce: () => D.dialogKontingencni(P) }),
        male(P, { ik: 'duplicity', text: 'Odebrat duplicity', akce: () => D.dialogDuplicity(P) }),
        male(P, { ik: 'tabulka', text: 'Převést na oblast', akce: () => P.prevestNaOblast() }),
      ),
    ], { priorita: 3, ikona: 'kontingencni' }),
    skupina('Možnosti stylů tabulky', [
      el('div.tb-moznosti-tabulky', {},
        zaskrt('Řádek záhlaví', 'zahlavi', true), zaskrt('Řádek souhrnů', 'souhrn', false), zaskrt('Pruhované řádky', 'pruhyR', true),
        zaskrt('První sloupec', 'prvniS', false), zaskrt('Poslední sloupec', 'posledniS', false), zaskrt('Pruhované sloupce', 'pruhyS', false),
        zaskrt('Tlačítko filtru', 'filtrTl', true)),
    ], { priorita: 4, ikona: 'mrizka' }),
    skupina('Styly tabulky', [galerieRam], { priorita: 2, ikona: 'jakoTabulku' }),
  ];
}

// ---------------------------------------------------------------- Návrh grafu a Formát
function kartaGrafNavrh(P) {
  const gr = () => P.vybranyGraf();
  const galerie = el('div.tb-gal-inline.grafy');
  let posledni = null;
  P.obnovy.push(() => {
    const g = gr();
    if (!g) return;
    const podpis = JSON.stringify(g) + P.S.gen;
    if (podpis === posledni) return;
    posledni = podpis;
    const d = dataGrafu(P.S, P.S.list, g);
    galerie.replaceChildren(...STYLY_GRAFU.map((s) => el('button.tb-sg-nahled.mini' + ((g.styl || 1) === s.id ? '.zapnuto' : ''), { type: 'button', title: s.nazev, onclick: () => P.upravGraf({ styl: s.id }, 'Styl grafu'), html: svgGrafu({ ...g, styl: s.id, id: g.id + 'p' + s.id, legenda: null, nazev: null }, d, 120, 76) })));
  });
  const rozlozeni = [
    { t: 'Rozložení 1', z: { zobrazitNazev: true, legenda: 'vpravo', popisky: false } },
    { t: 'Rozložení 2', z: { zobrazitNazev: true, legenda: 'nahore', popisky: true, mrizka: false } },
    { t: 'Rozložení 3', z: { zobrazitNazev: true, legenda: 'dole', popisky: false } },
    { t: 'Rozložení 4', z: { zobrazitNazev: false, legenda: 'dole', popisky: true } },
    { t: 'Rozložení 5', z: { zobrazitNazev: true, legenda: null, nazevOsyY: 'Název osy', popisky: false } },
    { t: 'Rozložení 6', z: { zobrazitNazev: true, legenda: null, nazevOsyY: 'Název osy', nazevOsyX: 'Název osy' } },
  ];
  return [
    skupina('Rozložení grafu', [
      velke(P, { ik: 'pridatPrvek', text: 'Přidat prvek\ngrafu', rozbal: () => {
        const sub = (text, pol) => ({ uzel: el('button.ps-nab-polozka.tb-sub', { type: 'button', onclick: (e) => { e.stopPropagation(); rozbal(e.currentTarget, nabidka(pol, { sirka: 200 }), { app: 'tabulky' }); } }, el('span.ps-nab-ik'), el('span.ps-nab-text', { text }), el('span.tb-sub-sipka', { text: '›' })) });
        return nabidka([
          sub('Osy', [{ text: 'Zobrazit osy', zaskrtnuto: gr()?.osy !== false, akce: () => P.upravGraf({ osy: gr()?.osy === false }, 'Osy') }]),
          sub('Názvy os', [{ text: 'Vodorovná', akce: () => P.upravGraf({ nazevOsyX: gr()?.nazevOsyX ? null : 'Název osy' }, 'Název osy') }, { text: 'Svislá', akce: () => P.upravGraf({ nazevOsyY: gr()?.nazevOsyY ? null : 'Název osy' }, 'Název osy') }]),
          sub('Název grafu', [{ text: 'Žádný', akce: () => P.upravGraf({ zobrazitNazev: false }, 'Název grafu') }, { text: 'Nad grafem', akce: () => P.upravGraf({ zobrazitNazev: true }, 'Název grafu') }]),
          sub('Popisky dat', [{ text: 'Žádné', akce: () => P.upravGraf({ popisky: false }, 'Popisky dat') }, { text: 'Zobrazit', akce: () => P.upravGraf({ popisky: true }, 'Popisky dat') }]),
          sub('Mřížka', [{ text: 'Hlavní vodorovná', zaskrtnuto: gr()?.mrizka !== false, akce: () => P.upravGraf({ mrizka: gr()?.mrizka === false }, 'Mřížka') }, { text: 'Hlavní svislá (XY)', zaskrtnuto: !!gr()?.mrizkaX, akce: () => P.upravGraf({ mrizkaX: !gr()?.mrizkaX }, 'Mřížka') }]),
          sub('Legenda', [['Žádná', null], ['Vpravo', 'vpravo'], ['Nahoře', 'nahore'], ['Vlevo', 'vlevo'], ['Dole', 'dole']].map(([t, v]) => ({ text: t, zaskrtnuto: (gr()?.legenda ?? 'dole') === v, akce: () => P.upravGraf({ legenda: v }, 'Legenda') }))),
          sub('Spojnice trendu', [{ text: 'Žádná', akce: () => P.upravGraf({ trend: false }, 'Spojnice trendu') }, { text: 'Lineární', akce: () => P.upravGraf({ trend: true }, 'Spojnice trendu') }]),
        ], { sirka: 220 });
      } }),
      velke(P, { ik: 'rychleRozlozeni', text: 'Rychlé\nrozložení', rozbal: () => el('div.tb-rychle-rozlozeni', {}, rozlozeni.map((x) => el('button.tb-sg-nahled.mini', { type: 'button', title: x.t, onclick: () => { zavriRozbal(); P.upravGraf(x.z, 'Rychlé rozložení'); }, html: gr() ? svgGrafu({ ...gr(), ...x.z, id: gr().id + x.t.slice(-1) }, dataGrafu(P.S, P.S.list, gr()), 140, 90) : '' }))) }),
    ], { priorita: 4, ikona: 'pridatPrvek' }),
    skupina('Styly grafů', [
      velke(P, { ik: 'zmenitBarvy', text: 'Změnit\nbarvy', rozbal: () => nabidka(Object.entries(PALETY).map(([id, b]) => ({ uzel: el('button.ps-nab-polozka' + ((gr()?.paleta || 'barevne') === id ? '.zaskrtnuto' : ''), { type: 'button', onclick: () => { zavriRozbal(); P.upravGraf({ paleta: id, barvyRad: null }, 'Změnit barvy'); } }, el('span.ps-barvy-vzor', {}, b.map((x) => el('i', { style: { background: x } }))), el('span', { text: NAZVY_PALET[id] })) })), { sirka: 280 }) }),
      galerie,
    ], { priorita: 3, ikona: 'zmenitBarvy' }),
    skupina('Data', [
      velke(P, { ik: 'prepnoutRadek', text: 'Přepnout\nřádek/sloupec', akce: () => P.upravGraf((g) => ({ radyVeSloupcich: g.radyVeSloupcich === false }), 'Přepnout řádek/sloupec') }),
      velke(P, { ik: 'vybratData', text: 'Vybrat\ndata', akce: () => D.dialogVybratData(P) }),
    ], { priorita: 5, ikona: 'vybratData' }),
    skupina('Typ', [velke(P, { ik: 'zmenitTypGrafu', text: 'Změnit\ntyp grafu', akce: () => D.dialogVlozitGraf(P, { zmena: true }) })], { priorita: 6, ikona: 'zmenitTypGrafu' }),
    skupina('Umístění', [velke(P, { ik: 'presunoutGraf', text: 'Přesunout\ngraf', akce: () => D.dialogPresunGraf(P) })], { priorita: 2, ikona: 'presunoutGraf' }),
  ];
}

function kartaGrafFormat(P) {
  const spin = (popis, klic) => {
    const i = el('input.ps-spin-vstup', { type: 'number', min: 1, step: 0.1 });
    i.addEventListener('keydown', (e) => e.stopPropagation());
    i.onchange = () => { const cm = parseFloat(i.value); if (cm > 0) P.upravGraf({ [klic]: Math.round(cm * 37.8) }, 'Velikost grafu'); };
    P.obnovy.push(() => { const g = P.vybranyGraf(); if (g && document.activeElement !== i) i.value = (g[klic] / 37.8).toFixed(2); });
    return el('div.ps-spin', {}, el('span.ps-spin-popis', { text: popis }), el('div.ps-spin-pole', {}, i), el('span', { text: 'cm' }));
  };
  return [
    skupina('Styly tvarů', [
      velke(P, { ik: 'vyplnTvaru', text: 'Výplň\ngrafu', rozbal: () => paleta({ auto: 'Automaticky', onVyber: (b) => P.upravGraf({ pozadi: b === 'auto' ? null : b }, 'Výplň grafu') }) }),
      velke(P, { ik: 'obrysTvaru', text: 'Obrys\ngrafu', rozbal: () => nabidka([{ text: 'Bez obrysu', akce: () => P.upravGraf({ bezOkraje: true }, 'Obrys') }, { text: 'Automaticky', akce: () => P.upravGraf({ bezOkraje: false }, 'Obrys') }], { sirka: 170 }) }),
      velke(P, { ik: 'stetecGraf', text: 'Barvy\nřad', rozbal: () => {
        const g = P.vybranyGraf();
        const d = g ? dataGrafu(P.S, P.S.list, g) : { rady: [] };
        return nabidka(d.rady.map((r, i) => ({ uzel: el('label.ps-nab-polozka.ps-vlastni-barva', {}, el('span.ps-barva-vzor', { style: { background: g.barvyRad?.[i] || (PALETY[g.paleta || 'barevne'])[i % 6] } }), el('span', { text: r.nazev }), el('input', { type: 'color', onchange: (e) => { const b = [...(g.barvyRad || [])]; b[i] = e.target.value; P.upravGraf({ barvyRad: b }, 'Barva řady'); } })) })), { sirka: 220 });
      } }),
    ], { priorita: 4, ikona: 'vyplnTvaru' }),
    skupina('Usnadnění', [velke(P, { ik: 'textovePole', text: 'Alternativní\ntext', akce: () => { const g = P.vybranyGraf(); if (!g) return; const t = el('textarea.ps-vstup', { rows: 4 }, g.alt || ''); dialog(P.koren, { titulek: 'Alternativní text', obsah: t, tlacitka: [{ text: 'OK', primarni: true, akce: () => P.upravGraf({ alt: t.value }, 'Alternativní text') }, { text: 'Zrušit' }] }); } })], { priorita: 2, ikona: 'textovePole' }),
    skupina('Velikost', [sloupec(spin('Výška:', 'h'), spin('Šířka:', 'w'))], { priorita: 3, ikona: 'velikost' }),
  ];
}

function kartaObrFormat(P) {
  const obj = () => (P.st.objekt ? P.najdiObjekt(P.st.objekt.id) : null);
  const uprav = (z, popis) => { const o = obj(); if (o) P.prikaz(popis, () => Object.assign(P.najdiObjekt(o.id), z), { prepocet: false }); };
  return [
    skupina('Styly tvarů', [
      velke(P, { ik: 'vyplnTvaru', text: 'Výplň\ntvaru', rozbal: () => paleta({ auto: 'Bez výplně', bezBarvy: true, onVyber: (b) => uprav({ vypln: b || 'transparent' }, 'Výplň tvaru') }) }),
      velke(P, { ik: 'obrysTvaru', text: 'Obrys\ntvaru', rozbal: () => paleta({ auto: 'Bez obrysu', bezBarvy: true, onVyber: (b) => uprav({ obrys: b || 'transparent' }, 'Obrys tvaru') }) }),
    ], { priorita: 4, ikona: 'vyplnTvaru' }),
    skupina('Text', [
      sloupec(
        male(P, { ik: 'tucne', titulek: 'Tučné', akce: () => uprav({ b: !obj()?.b }, 'Tučné') }),
        male(P, { ik: 'kurziva', titulek: 'Kurzíva', akce: () => uprav({ i: !obj()?.i }, 'Kurzíva') }),
        male(P, { ik: 'barvaPisma', titulek: 'Barva textu', rozbal: () => paleta({ onVyber: (b) => uprav({ barvaTextu: b === 'auto' ? null : b }, 'Barva textu') }) }),
      ),
    ], { priorita: 3, ikona: 'barvaPisma' }),
    skupina('Uspořádat', [
      sloupec(
        male(P, { ik: 'predchozi', text: 'Přenést do popředí', akce: () => P.poradiObjektu?.(1) }),
        male(P, { ik: 'dalsi', text: 'Přenést do pozadí', akce: () => P.poradiObjektu?.(-1) }),
        male(P, { ik: 'odstranit', text: 'Odstranit', akce: () => P.smazObjekt() }),
      ),
    ], { priorita: 2, ikona: 'odstranit' }),
  ];
}

// ---------------------------------------------------------------- sestavení
export const KARTY_TB = [
  { id: 'domu', nazev: 'Domů', stav: kartaDomu },
  { id: 'vlozeni', nazev: 'Vložení', stav: kartaVlozeni },
  { id: 'kresleni', nazev: 'Kreslení', stav: kartaKresleni },
  { id: 'rozlozeni', nazev: 'Rozložení stránky', stav: kartaRozlozeni },
  { id: 'vzorce', nazev: 'Vzorce', stav: kartaVzorce },
  { id: 'data', nazev: 'Data', stav: kartaData },
  { id: 'revize', nazev: 'Revize', stav: kartaRevize },
  { id: 'zobrazeni', nazev: 'Zobrazení', stav: kartaZobrazeni },
  { id: 'automatizace', nazev: 'Automatizovat', stav: kartaAutomatizace },
  { id: 'napoveda', nazev: 'Nápověda', stav: kartaNapoveda },
  { id: 'tabNavrh', nazev: 'Návrh tabulky', stav: kartaTabNavrh, kontext: 'tabulka' },
  { id: 'grafNavrh', nazev: 'Návrh grafu', stav: kartaGrafNavrh, kontext: 'graf' },
  { id: 'grafFormat', nazev: 'Formát', stav: kartaGrafFormat, kontext: 'graf' },
  { id: 'obrFormat', nazev: 'Formát tvaru', stav: kartaObrFormat, kontext: 'obrazek' },
];

export function postavKartyTb(P) {
  const obsahy = {};
  for (const k of KARTY_TB) obsahy[k.id] = el('div.ps-karta-obsah', { dataset: { karta: k.id } }, k.stav(P));
  return obsahy;
}
