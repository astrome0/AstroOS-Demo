// AstroTabulky — šablony sešitů (Soubor › Nový)

import { Sesit, slozStyl } from './sesit.js';
import { rozeberOblast, sloupecZPismen, textOblasti, jmenoListuVeVzorci } from './adresy.js';
import { serial } from './format.js';
import { MOTIV, odstin } from './styly.js';

const A = MOTIV.akcenty;
const ZELENA = '#107C41';

/** Pomocník pro stavbu šablony: t.z('A1', 'text'), t.s('A1:D1', { b: true })… */
function stavitel(s) {
  let l = s.list;
  const o = (a) => rozeberOblast(a);
  const t = {
    get list() { return l; },
    z(a, text) { const x = o(a); s.zadej(l, x.r1, x.c1, String(text)); return t; },
    radek(a, hodnoty) { const x = o(a); hodnoty.forEach((h, i) => { if (h !== null && h !== undefined) s.zadej(l, x.r1, x.c1 + i, String(h)); }); return t; },
    sloupec(a, hodnoty) { const x = o(a); hodnoty.forEach((h, i) => { if (h !== null && h !== undefined) s.zadej(l, x.r1 + i, x.c1, String(h)); }); return t; },
    s(a, styl) { s.stylOblasti(l, [o(a)], styl); return t; },
    nf(a, kod) { s.stylOblasti(l, [o(a)], { nf: kod }); return t; },
    sir(sloupce, px) { for (const x of sloupce.split(',')) { const p = x.split('-'); const a = sloupecZPismen(p[0].trim()), b = sloupecZPismen((p[1] || p[0]).trim()); for (let c = a; c <= b; c++) l.sirky.set(c, px); } return t; },
    vys(r, px) { l.vysky.set(r - 1, px); return t; },
    sluc(a, typ = 'bunky') { s.sluc(l, o(a), typ); return t; },
    ohr(a, typ, cara) { s.ohranic(l, o(a), typ, cara); return t; },
    tab(a, styl = 'stredni2', nazev) { const x = s.vytvorTabulku(l, o(a), { styl }); x.filtrTl = true; if (nazev) x.nazev = nazev; return t; },
    souhrn(nazev) { const x = l.tabulky.find((y) => y.nazev === nazev); s.radekSouhrnu(l, x, true); return t; },
    graf(g) { l.grafy.push({ id: 'g' + Math.random().toString(36).slice(2, 8), radyVeSloupcich: true, styl: 1, paleta: 'barevne', w: 480, h: 288, ...g, zdroj: g.zdroj.includes('!') ? g.zdroj : jmenoListuVeVzorci(l.nazev) + '!' + g.zdroj }); return t; },
    cf(a, pravidlo) { l.podminene.push({ ...pravidlo, oblasti: a.split(';').map(o) }); return t; },
    over(a, v) { l.validace.push({ ignorovatPrazdne: true, sipka: true, ...v, oblast: o(a) }); return t; },
    pozn(a, text, autor = 'AstroTabulky') { const x = o(a); const b = l.b.get(x.r1 * 16384 + x.c1) || {}; s.zapis(l, x.r1, x.c1, { ...b, pozn: { text, autor } }); return t; },
    ukotvit(r, c = 0) { l.ukotveni = { r, c, r0: 0, c0: 0 }; return t; },
    novyList(nazev) { l = s.pridejList(s.listy.length - 1, nazev); return t; },
    vyber(a) { const x = o(a); l.vyber = { r: x.r1, c: x.c1, oblasti: [x] }; return t; },
    bezMrizky() { l.mrizka = false; return t; },
    barva(b) { l.barva = b; return t; },
  };
  return t;
}

const nadpis = { vel: 20, b: true, barva: MOTIV.tmava2, font: 'Aptos Display' };
const podnadpis = { i: true, barva: '#595959' };
const KC = '#,##0 "Kč";[Red]-#,##0 "Kč"';
const KC2 = '#,##0.00 "Kč";[Red]-#,##0.00 "Kč"';

function sablona(fn) {
  return (autor) => {
    const s = new Sesit();
    fn(stavitel(s), s, autor);
    s.aktivni = 0;
    s.prepocitej({ vynutit: true });
    return s;
  };
}

// ---------------------------------------------------------------- jednotlivé šablony
const prohlidka = sablona((t, s) => {
  t.list.nazev = '1. Začínáme';
  t.bezMrizky().sir('A', 24).sir('B', 150).sir('C', 110).sir('D', 24).sir('E-H', 90).barva(ZELENA);
  t.z('B2', 'Vítejte v AstroTabulkách').s('B2', { ...nadpis, vel: 24, barva: ZELENA });
  t.z('B3', 'Pár rychlých cvičení, po kterých budete s tabulkami kamarádi.').s('B3', podnadpis);
  t.z('B5', '1. Sečtěte čísla').s('B5', { b: true, vel: 14, barva: MOTIV.tmava2 });
  t.z('B6', 'Klikněte do žluté buňky C11 a stiskněte Alt+= (automatické shrnutí), pak Enter.').s('B6', { barva: '#404040' });
  t.radek('B7', ['Ovoce', 'Kusy']).s('B7:C7', { b: true, ohr: { b: { s: 'tenka', b: ZELENA } } });
  t.sloupec('B8', ['Jablka', 'Hrušky', 'Třešně']).sloupec('C8', [50, 20, 30]);
  t.z('B11', 'Celkem').s('B11', { b: true }).s('C11', { pozadi: '#FFF2CC', ohr: { t: { s: 'tenka', b: '#000' } } });
  t.pozn('C11', 'Tady má být =SUMA(C8:C10). Zkuste Alt+= nebo napište vzorec ručně.');
  t.z('B13', '2. Automatické vyplňování').s('B13', { b: true, vel: 14, barva: MOTIV.tmava2 });
  t.z('B14', 'Vyberte buňku B15 a táhněte malý zelený čtvereček v jejím rohu dolů. Dny pokračují samy — zkuste to i s čísly.').s('B14', { barva: '#404040' });
  t.z('B15', 'pondělí').z('C15', 'Položka 1');
  t.s('B15:C21', { pozadi: '#E2EFDA' });
  t.z('B23', '3. Seřaďte a filtrujte').s('B23', { b: true, vel: 14, barva: MOTIV.tmava2 });
  t.z('B24', 'Klikněte do tabulky vpravo a použijte šipky v záhlaví — seřaďte hráče podle bodů nebo vyfiltrujte tým.').s('B24', { barva: '#404040' });
  t.radek('E26', ['Hráč', 'Tým', 'Body']);
  [['Adam', 'Modří', 42], ['Běla', 'Zelení', 57], ['Cyril', 'Modří', 35], ['Dana', 'Zelení', 61], ['Emil', 'Červení', 48], ['Filip', 'Červení', 29]].forEach((r, i) => t.radek(`E${27 + i}`, r));
  t.tab('E26:G32', 'stredni7');
  t.z('B34', 'Tip: Ctrl+T udělá z oblasti tabulku, Alt+F1 vloží graf, F1 otevře nápovědu.').s('B34', { i: true, barva: ZELENA });
  t.vyber('C11');

  t.novyList('2. Vzorce').barva(A[0]);
  t.bezMrizky().sir('A', 24).sir('B', 170).sir('C', 110).sir('D', 250);
  t.z('B2', 'Vzorce počítají za vás').s('B2', nadpis);
  t.z('B3', 'Vzorec začíná „=“. Klikněte na buňku ve sloupci C a podívejte se do řádku vzorců nahoře.').s('B3', podnadpis);
  t.radek('B5', ['Popis', 'Výsledek', 'Vzorec']).s('B5:D5', { b: true, barva: '#FFFFFF', pozadi: A[0] });
  const radky = [
    ['Cena bez DPH', '1000', ''], ['DPH 21 %', '=C6*21%', '=C6*21%'], ['Cena s DPH', '=C6+C7', '=C6+C7'],
    ['Průměr čísel 3, 5, 10', '=PRŮMĚR(3;5;10)', '=PRŮMĚR(3;5;10)'], ['Je cena vyšší než 1 000?', '=KDYŽ(C8>1000;"ano";"ne")', '=KDYŽ(C8>1000;"ano";"ne")'],
    ['Dnešní datum', '=DNES()', '=DNES()'], ['Dní do Silvestra', '=DATUM(ROK(DNES());12;31)-DNES()', '=DATUM(ROK(DNES());12;31)-DNES()'],
    ['Text velkými písmeny', '=VELKÁ("ahoj")', '=VELKÁ("ahoj")'], ['Pořadí 1–5 (dynamické pole)', '=SEQUENCE(1;5)', '=SEQUENCE(1;5)'],
  ];
  radky.forEach(([a, b, c], i) => { t.z(`B${6 + i}`, a).z(`C${6 + i}`, b); if (c) t.z(`D${6 + i}`, "'" + c); });
  t.nf('C6:C8', KC2).s('D6:D16', { font: 'Consolas', barva: '#595959' }).ohr('B5:D14', 'vnitrni', { s: 'tenka', b: '#D9D9D9' });
  t.z('B17', 'Zkuste: napište do buňky C17 =SU a všimněte si našeptávače funkcí. Tab doplní název.').s('B17', { i: true, barva: A[0] });

  t.novyList('3. Grafy').barva(A[1]);
  t.sir('A', 110).sir('B-C', 90);
  t.radek('A1', ['Měsíc', 'Příjmy', 'Výdaje']).s('A1:C1', { b: true });
  ['leden', 'únor', 'březen', 'duben', 'květen', 'červen'].forEach((m, i) => t.radek(`A${2 + i}`, [m, 30000 + i * 1500 + (i % 2) * 800, 24000 + ((i * 3371) % 5000)]));
  t.nf('B2:C7', KC);
  t.graf({ typ: 'sloupcovy', zdroj: '$A$1:$C$7', x: 330, y: 10, w: 470, h: 290, nazev: 'Příjmy a výdaje' });
  t.z('A10', 'Graf se mění s daty — přepište číslo v tabulce a sledujte ho.').s('A10', { i: true, barva: '#595959' });
});

const rozpocet = sablona((t) => {
  t.list.nazev = 'Rozpočet';
  t.bezMrizky().sir('A', 20).sir('B', 190).sir('C-E', 115).sir('F', 30).sir('G', 170).sir('H', 125);
  t.z('B2', 'Měsíční rozpočet domácnosti').s('B2', { ...nadpis, barva: A[0] });
  t.z('B3', 'Vyplňte bílá pole — ostatní se spočítá samo.').s('B3', podnadpis);
  // příjmy
  t.z('B5', 'Příjmy').s('B5:C5', { b: true, vel: 13, barva: '#FFFFFF', pozadi: A[0] });
  t.sloupec('B6', ['Mzda', 'Brigáda', 'Ostatní']).sloupec('C6', [35000, 4000, 1500]);
  t.z('B9', 'Příjmy celkem').z('C9', '=SUMA(C6:C8)').s('B9:C9', { b: true, ohr: { t: { s: 'tenka', b: A[0] } } });
  t.nf('C6:C9', KC);
  // výdaje
  t.radek('B11', ['Výdaje', 'Plán', 'Skutečnost', 'Rozdíl']);
  const vydaje = [['Bydlení', 12000, 12000], ['Energie', 3200, 3550], ['Jídlo', 7000, 7840], ['Doprava', 1800, 1420], ['Telefon a internet', 900, 900], ['Zábava', 2000, 2650], ['Oblečení', 1500, 900], ['Spoření', 5000, 5000], ['Ostatní', 1000, 1230]];
  vydaje.forEach(([k, p, s], i) => t.radek(`B${12 + i}`, [k, p, s, `=C${12 + i}-D${12 + i}`]));
  t.tab(`B11:E${11 + vydaje.length}`, 'stredni2', 'Vydaje').souhrn('Vydaje');
  const soucty = 12 + vydaje.length;
  t.z(`C${soucty}`, `=SUBTOTAL(109;Vydaje[Plán])`).z(`D${soucty}`, `=SUBTOTAL(109;Vydaje[Skutečnost])`);
  t.nf(`C12:E${soucty}`, KC);
  t.cf(`E12:E${soucty - 1}`, { typ: 'mensi', a: 0, styl: { barva: '#9C0006', pozadi: '#FFC7CE' } });
  t.cf(`D12:D${soucty - 1}`, { typ: 'pruh', barva: '#638EC6' });
  // shrnutí
  t.z('G5', 'Shrnutí').s('G5:H5', { b: true, vel: 13, barva: '#FFFFFF', pozadi: MOTIV.tmava2 });
  t.sloupec('G6', ['Příjmy', 'Výdaje (skutečnost)', 'Zůstatek', 'Ušetřeno z příjmů']);
  t.z('H6', '=C9').z('H7', `=D${soucty}`).z('H8', '=H6-H7').z('H9', '=KDYŽ(H6=0;0;(H8+SUMIF(B12:B20;"Spoření";D12:D20))/H6)');
  t.nf('H6:H8', KC).nf('H9', '0%').s('G8:H8', { b: true, ohr: { t: { s: 'tenka', b: '#000' }, b: { s: 'dvojita', b: '#000' } } });
  t.cf('H8', { typ: 'mensi', a: 0, styl: { barva: '#9C0006' } });
  // graf potřebuje kategorie a skutečnost vedle sebe → pomocná oblast J:K (šedě, stranou)
  t.graf({ typ: 'prstencovy', zdroj: `$J$11:$K$${soucty - 1}`, x: 540, y: 250, w: 380, h: 300, nazev: 'Kam jdou peníze', legenda: 'vpravo' });
  t.radek('J11', ['Kategorie', 'Skutečnost']);
  vydaje.forEach((v, i) => t.z(`J${12 + i}`, `=B${12 + i}`).z(`K${12 + i}`, `=D${12 + i}`));
  t.s(`J11:K${soucty - 1}`, { barva: '#A6A6A6', vel: 9 }).sir('J-K', 80);
  t.vyber('C6');
});

const vydaje = sablona((t) => {
  t.list.nazev = 'Výdaje';
  t.sir('A', 20).sir('B', 95).sir('C', 210).sir('D', 130).sir('E', 110).sir('F', 30).sir('G', 130).sir('H', 115);
  t.z('B2', 'Sledování výdajů').s('B2', { ...nadpis, barva: A[3] });
  const kat = ['Jídlo', 'Doprava', 'Zábava', 'Bydlení', 'Oblečení', 'Zdraví', 'Ostatní'];
  t.radek('B4', ['Datum', 'Popis', 'Kategorie', 'Částka']);
  const zaznamy = [['1.9.2026', 'Nákup potravin', 'Jídlo', 1240], ['2.9.2026', 'Jízdenka na měsíc', 'Doprava', 550], ['3.9.2026', 'Kino', 'Zábava', 360], ['5.9.2026', 'Nájem', 'Bydlení', 12000], ['7.9.2026', 'Pizza s přáteli', 'Jídlo', 420],
    ['9.9.2026', 'Boty', 'Oblečení', 1790], ['12.9.2026', 'Lékárna', 'Zdraví', 260], ['14.9.2026', 'Nákup potravin', 'Jídlo', 980], ['18.9.2026', 'Koncert', 'Zábava', 890], ['21.9.2026', 'Benzín', 'Doprava', 1500], ['23.9.2026', 'Dárek', 'Ostatní', 650]];
  zaznamy.forEach((r, i) => t.radek(`B${5 + i}`, r));
  const konec = 4 + zaznamy.length;
  t.tab(`B4:E${konec}`, 'stredni10', 'Vydaje');
  t.nf(`E5:E${konec + 30}`, KC).nf(`B5:B${konec + 30}`, 'd.m.yyyy');
  t.over(`D5:D${konec + 30}`, { typ: 'seznam', zdroj: kat.join(';'), zprava: { titulek: 'Kategorie', text: 'Vyberte kategorii ze seznamu.' }, chyba: { styl: 'stop', text: 'Vyberte kategorii ze seznamu (šipka vpravo od buňky).' } });
  t.z('G4', 'Kategorie').z('H4', 'Celkem').s('G4:H4', { b: true, barva: '#FFFFFF', pozadi: A[3] });
  kat.forEach((k, i) => t.z(`G${5 + i}`, k).z(`H${5 + i}`, `=SUMIF(Vydaje[Kategorie];G${5 + i};Vydaje[Částka])`));
  t.z(`G${5 + kat.length}`, 'Celkem').z(`H${5 + kat.length}`, `=SUMA(H5:H${4 + kat.length})`).s(`G${5 + kat.length}:H${5 + kat.length}`, { b: true, ohr: { t: { s: 'tenka', b: '#000' } } });
  t.nf(`H5:H${5 + kat.length}`, KC);
  t.cf(`H5:H${4 + kat.length}`, { typ: 'pruh', barva: '#008AEF' });
  t.graf({ typ: 'pruhovy', zdroj: `$G$4:$H$${4 + kat.length}`, x: 625, y: 190, w: 400, h: 270, nazev: 'Výdaje podle kategorií', legenda: null });
  t.ukotvit(4, 0).vyber(`B${konec + 1}`);
});

const ukoly = sablona((t) => {
  t.list.nazev = 'Úkoly';
  t.sir('A', 20).sir('B', 260).sir('C', 90).sir('D', 110).sir('E', 100).sir('F', 90).sir('G', 200);
  t.z('B2', 'Seznam úkolů').s('B2', { ...nadpis, barva: A[4] });
  t.z('B3', '=POČET2(B6:B40)&" úkolů · hotovo "&COUNTIF(D6:D40;"Hotovo")&" · po termínu "&COUNTIFS(E6:E40;"<"&DNES();D6:D40;"<>Hotovo")').s('B3', podnadpis);
  t.radek('B5', ['Úkol', 'Priorita', 'Stav', 'Termín', 'Hotovo', 'Poznámka']);
  const dnes = new Date();
  const d = (plus) => { const x = new Date(dnes); x.setDate(x.getDate() + plus); return `${x.getDate()}.${x.getMonth() + 1}.${x.getFullYear()}`; };
  const data = [['Naučit se na test z matiky', 'Vysoká', 'Probíhá', d(2), '60%', 'kapitola 4–5'], ['Odevzdat referát z dějepisu', 'Vysoká', 'Nezahájeno', d(-1), '0%', ''], ['Uklidit pokoj', 'Nízká', 'Hotovo', d(-3), '100%', ''],
    ['Trénink florbalu', 'Střední', 'Nezahájeno', d(1), '0%', 'vzít chrániče'], ['Přečíst knihu do čtenářského deníku', 'Střední', 'Probíhá', d(10), '35%', ''], ['Narozeninový dárek pro mámu', 'Vysoká', 'Nezahájeno', d(6), '0%', 'nápad: kniha'], ['Aktualizovat AstroOS', 'Nízká', 'Hotovo', d(-5), '100%', '']];
  data.forEach((r, i) => t.radek(`B${6 + i}`, r));
  const konec = 5 + data.length;
  t.tab(`B5:G${konec}`, 'svetly12', 'Ukoly');
  t.nf(`E6:E${konec + 30}`, 'd.m.yyyy').nf(`F6:F${konec + 30}`, '0%');
  t.over(`C6:C${konec + 30}`, { typ: 'seznam', zdroj: 'Vysoká;Střední;Nízká' });
  t.over(`D6:D${konec + 30}`, { typ: 'seznam', zdroj: 'Nezahájeno;Probíhá;Hotovo' });
  t.cf(`F6:F${konec + 30}`, { typ: 'pruh', barva: '#63C384' });
  t.cf(`D6:D${konec + 30}`, { typ: 'rovno', a: 'Hotovo', styl: { pozadi: '#C6EFCE', barva: '#006100' } });
  t.cf(`D6:D${konec + 30}`, { typ: 'rovno', a: 'Probíhá', styl: { pozadi: '#FFEB9C', barva: '#9C5700' } });
  t.cf(`C6:C${konec + 30}`, { typ: 'rovno', a: 'Vysoká', styl: { barva: '#C00000', b: true } });
  t.cf(`B6:G${konec + 30}`, { typ: 'vzorec', vzorec: '=A($E6<DNES();$D6<>"Hotovo";$E6<>"")', styl: { barva: '#C00000' } });
  t.cf(`B6:G${konec + 30}`, { typ: 'vzorec', vzorec: '=$D6="Hotovo"', styl: { barva: '#A6A6A6', st: true } });
  t.ukotvit(5, 0).vyber(`B${konec + 1}`);
});

const faktura = sablona((t, s, autor) => {
  t.list.nazev = 'Faktura';
  t.bezMrizky().sir('A', 20).sir('B', 260).sir('C', 80).sir('D', 70).sir('E', 110).sir('F', 120);
  t.z('B2', 'FAKTURA').s('B2', { vel: 26, b: true, barva: A[0], font: 'Aptos Display' });
  t.z('E2', 'Číslo faktury:').z('F2', "'2026-0142").z('E3', 'Datum vystavení:').z('F3', '=DNES()').z('E4', 'Datum splatnosti:').z('F4', '=F3+14');
  t.nf('F3:F4', 'd.m.yyyy').s('E2:E4', { barva: '#595959', h: 'r' }).s('F2:F4', { b: true, h: 'r' });
  t.z('B6', 'Dodavatel').s('B6', { b: true, barva: A[0] }).z('E6', 'Odběratel').s('E6', { b: true, barva: A[0] });
  t.sloupec('B7', [autor || 'Jan Novák', 'Hlavní 12', '602 00 Brno', 'IČO: 12345678']);
  t.sloupec('E7', ['Firma s.r.o.', 'Nádražní 5', '110 00 Praha 1', 'IČO: 87654321']);
  t.radek('B13', ['Popis', 'Množství', 'Jednotka', 'Cena za jednotku', 'Celkem']);
  const pol = [['Tvorba webové stránky', 1, 'ks', 15000], ['Grafický návrh loga', 1, 'ks', 4500], ['Konzultace', 3, 'hod', 800], ['Hosting na rok', 12, 'měs', 120]];
  pol.forEach(([p, m, j, c], i) => t.radek(`B${14 + i}`, [p, m, j, c, `=C${14 + i}*E${14 + i}`]));
  const k = 14 + pol.length;
  t.s(`B13:F13`, { b: true, barva: '#FFFFFF', pozadi: A[0] }).s(`C13:F13`, { h: 'r' });
  t.ohr(`B14:F${k - 1}`, 'vnitrni', { s: 'tenka', b: '#D9D9D9' }).ohr(`B${k - 1}:F${k - 1}`, 'dolni', { s: 'tenka', b: A[0] });
  t.nf(`E14:F${k + 3}`, KC2);
  t.z(`E${k + 1}`, 'Mezisoučet').z(`F${k + 1}`, `=SUMA(F14:F${k - 1})`);
  t.z(`E${k + 2}`, 'DPH 21 %').z(`F${k + 2}`, `=ZAOKROUHLIT(F${k + 1}*21%;2)`);
  t.z(`E${k + 3}`, 'Celkem k úhradě').z(`F${k + 3}`, `=F${k + 1}+F${k + 2}`);
  t.s(`E${k + 1}:E${k + 3}`, { h: 'r', barva: '#595959' }).s(`E${k + 3}:F${k + 3}`, { b: true, vel: 13, barva: A[0], ohr: { t: { s: 'tenka', b: A[0] }, b: { s: 'dvojita', b: A[0] } } });
  t.z(`B${k + 6}`, 'Platba převodem na účet 123456789/0800, variabilní symbol 20260142.').s(`B${k + 6}`, { barva: '#595959' });
  t.z(`B${k + 7}`, 'Děkujeme za spolupráci!').s(`B${k + 7}`, { i: true, barva: A[0] });
  t.list.tisk = { okraje: 'normalni', naSirku1: true };
  t.vyber('B14');
});

const znamky = sablona((t) => {
  t.list.nazev = 'Známky';
  t.sir('A', 20).sir('B', 150).sir('C-H', 44).sir('I', 80).sir('J', 90);
  t.z('B2', 'Moje známky').s('B2', { ...nadpis, barva: A[2] });
  t.z('B3', 'Pololetí 2026/27 · průměr se počítá sám').s('B3', podnadpis);
  t.radek('B5', ['Předmět', '1', '2', '3', '4', '5', '6', 'Průměr', 'Výsledná']);
  const pred = [['Matematika', 1, 2, 1, 3, 2], ['Český jazyk', 2, 2, 3, 1], ['Anglický jazyk', 1, 1, 2, 1, 1, 1], ['Fyzika', 3, 2, 2, 4], ['Dějepis', 2, 1, 1], ['Zeměpis', 1, 2, 2, 1], ['Přírodopis', 2, 3, 2], ['Informatika', 1, 1, 1, 1]];
  pred.forEach(([p, ...z], i) => {
    const r = 6 + i;
    t.z(`B${r}`, p);
    z.forEach((x, j) => t.z(`${String.fromCharCode(67 + j)}${r}`, x));
    t.z(`I${r}`, `=IFERROR(ZAOKROUHLIT(PRŮMĚR(C${r}:H${r});2);"")`).z(`J${r}`, `=IFERROR(ZAOKROUHLIT(I${r};0);"")`);
  });
  const k = 5 + pred.length;
  t.tab(`B5:J${k}`, 'stredni3', 'Znamky');
  t.s(`C6:J${k}`, { h: 'c' }).nf(`I6:I${k}`, '0.00');
  t.cf(`I6:I${k}`, { typ: 'skala', barvy: ['#63BE7B', '#FFEB84', '#F8696B'] });
  t.cf(`C6:H${k}`, { typ: 'rovno', a: 1, styl: { barva: '#006100', b: true } });
  t.cf(`C6:H${k}`, { typ: 'vetsi', a: 3, styl: { barva: '#C00000', b: true } });
  t.over(`C6:H${k + 20}`, { typ: 'cele', op: 'mezi', a: 1, b: 5, chyba: { styl: 'stop', titulek: 'Neplatná známka', text: 'Známka musí být celé číslo od 1 do 5.' } });
  t.z(`B${k + 2}`, 'Celkový průměr').z(`I${k + 2}`, `=ZAOKROUHLIT(PRŮMĚR(I6:I${k});2)`).s(`B${k + 2}:J${k + 2}`, { b: true, ohr: { t: { s: 'tenka', b: '#000' } } }).nf(`I${k + 2}`, '0.00');
  t.z(`B${k + 3}`, 'Vyznamenání?').z(`I${k + 3}`, `=KDYŽ(A(I${k + 2}<=1,5;MAX(J6:J${k})<=2);"ano 🎉";"zatím ne")`).s(`B${k + 3}:J${k + 3}`, { b: true });
  t.graf({ typ: 'pruhovy', zdroj: `$L$5:$M$${k}`, x: 720, y: 20, w: 400, h: 300, nazev: 'Průměr podle předmětů', legenda: null, osaMin: 1, osaMax: 5 });
  t.radek('L5', ['Předmět', 'Průměr']);
  pred.forEach((p, i) => t.z(`L${6 + i}`, `=B${6 + i}`).z(`M${6 + i}`, `=I${6 + i}`));
  t.s(`L5:M${k}`, { barva: '#A6A6A6', vel: 9 });
  t.vyber('H6');
});

const rozvrh = sablona((t) => {
  t.list.nazev = 'Rozvrh';
  t.bezMrizky().sir('A', 20).sir('B', 90).sir('C-I', 100);
  t.z('B2', 'Rozvrh hodin').s('B2', { ...nadpis, barva: A[5] });
  const hodiny = ['1.\n8:00–8:45', '2.\n8:55–9:40', '3.\n10:00–10:45', '4.\n10:55–11:40', '5.\n11:50–12:35', '6.\n12:45–13:30', '7.\n13:40–14:25'];
  t.z('B4', '').radek('C4', hodiny);
  t.s('C4:I4', { b: true, h: 'c', zalam: true, barva: '#FFFFFF', pozadi: A[5] }).vys(4, 40);
  const dny = [['Pondělí', ['Čj', 'M', 'Aj', 'Z', 'Tv', 'Tv', '']], ['Úterý', ['M', 'F', 'Čj', 'D', 'Hv', 'Inf', '']], ['Středa', ['Aj', 'Čj', 'M', 'Př', 'Vv', 'Vv', '']], ['Čtvrtek', ['F', 'M', 'Čj', 'Aj', 'Ch', 'Z', 'Ov']], ['Pátek', ['D', 'Př', 'Aj', 'M', 'Čj', '', '']]];
  const barvy = { Čj: '#F8CBAD', M: '#BDD7EE', Aj: '#C6E0B4', Z: '#FFE699', Tv: '#D9D9D9', F: '#B4C6E7', D: '#F4B084', Hv: '#E2BBE8', Inf: '#9BC2E6', Př: '#A9D08E', Vv: '#FFD966', Ch: '#C9C9C9', Ov: '#DDEBF7' };
  dny.forEach(([d, pr], i) => {
    const r = 5 + i;
    t.z(`B${r}`, d).s(`B${r}`, { b: true, v: 'm' }).vys(r, 36);
    pr.forEach((p, j) => { const a = `${String.fromCharCode(67 + j)}${r}`; if (p) t.z(a, p).s(a, { pozadi: barvy[p] || '#EDEDED', h: 'c', v: 'm', b: true, ohr: { t: { s: 'tenka', b: '#FFFFFF' }, b: { s: 'tenka', b: '#FFFFFF' }, l: { s: 'tenka', b: '#FFFFFF' }, r: { s: 'tenka', b: '#FFFFFF' } } }); });
  });
  t.z('B11', 'Zkratky').s('B11', { b: true });
  Object.entries({ Čj: 'Český jazyk', M: 'Matematika', Aj: 'Anglický jazyk', F: 'Fyzika', D: 'Dějepis', Z: 'Zeměpis', Př: 'Přírodopis', Ch: 'Chemie', Inf: 'Informatika', Tv: 'Tělesná výchova', Hv: 'Hudební výchova', Vv: 'Výtvarná výchova', Ov: 'Občanská výchova' }).forEach(([k, v], i) => {
    const c = String.fromCharCode(66 + (i % 4) * 2), r = 12 + Math.floor(i / 4);
    t.z(`${c}${r}`, k).s(`${c}${r}`, { pozadi: barvy[k], h: 'c', b: true }).z(`${String.fromCharCode(c.charCodeAt(0) + 1)}${r}`, v).s(`${String.fromCharCode(c.charCodeAt(0) + 1)}${r}`, { barva: '#595959' });
  });
  t.z('B18', '=POČET2(C5:I9)&" vyučovacích hodin týdně"').s('B18', podnadpis);
  t.vyber('C5');
});

const kalendar = sablona((t) => {
  t.list.nazev = 'Kalendář';
  t.bezMrizky().sir('A', 20).sir('B-H', 92);
  const d = new Date();
  t.z('B2', 'Rok').z('C2', d.getFullYear()).z('D2', 'Měsíc').z('E2', d.getMonth() + 1);
  t.s('B2', { barva: '#595959', h: 'r' }).s('D2', { barva: '#595959', h: 'r' }).s('C2', { b: true, pozadi: '#FFF2CC', h: 'c' }).s('E2', { b: true, pozadi: '#FFF2CC', h: 'c' });
  t.over('E2', { typ: 'cele', op: 'mezi', a: 1, b: 12, zprava: { titulek: 'Měsíc', text: 'Zadejte číslo měsíce 1–12 — kalendář se překreslí.' } });
  t.z('B4', '=VELKÁ(HODNOTA.NA.TEXT(DATUM(C2;E2;1);"mmmm rrrr"))').sluc('B4:H4').s('B4', { vel: 22, b: true, barva: A[0], h: 'c', font: 'Aptos Display' }).vys(4, 40);
  t.radek('B6', ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne']).s('B6:H6', { b: true, h: 'c', barva: '#FFFFFF', pozadi: A[0] });
  t.s('G6:H6', { pozadi: odstin(A[0], -0.25) });
  t.z('B7', '=DATUM(C2;E2;1)-DENTÝDNE(DATUM(C2;E2;1);2)+1');
  for (let r = 7; r <= 12; r++) {
    for (let c = 0; c < 7; c++) {
      const a = `${String.fromCharCode(66 + c)}${r}`;
      if (r === 7 && c === 0) continue;
      const pred = c === 0 ? `H${r - 1}` : `${String.fromCharCode(65 + c)}${r}`;
      t.z(a, `=${pred}+1`);
    }
    t.vys(r, 58);
  }
  t.nf('B7:H12', 'd').s('B7:H12', { h: 'r', v: 't', vel: 14, ohr: { t: { s: 'tenka', b: '#D9D9D9' }, b: { s: 'tenka', b: '#D9D9D9' }, l: { s: 'tenka', b: '#D9D9D9' }, r: { s: 'tenka', b: '#D9D9D9' } } });
  t.s('G7:H12', { barva: '#C00000' });
  t.cf('B7:H12', { typ: 'vzorec', vzorec: '=MĚSÍC(B7)<>$E$2', styl: { barva: '#BFBFBF' } });
  t.cf('B7:H12', { typ: 'vzorec', vzorec: '=B7=DNES()', styl: { pozadi: '#C6EFCE', b: true } });
  t.z('B14', 'Změňte rok nebo měsíc ve žlutých buňkách nahoře.').s('B14', podnadpis);
  t.vyber('E2');
});

export const SABLONY_TB = [
  { id: 'prazdny', nazev: 'Prázdný sešit', vytvor: () => new Sesit(), barva: '#fff' },
  { id: 'prohlidka', nazev: 'Vítejte v AstroTabulkách', popis: 'Prohlídka', vytvor: prohlidka, barva: ZELENA },
  { id: 'rozpocet', nazev: 'Rozpočet domácnosti', vytvor: rozpocet, barva: A[0] },
  { id: 'vydaje', nazev: 'Sledování výdajů', vytvor: vydaje, barva: A[3] },
  { id: 'ukoly', nazev: 'Seznam úkolů', vytvor: ukoly, barva: A[4] },
  { id: 'znamky', nazev: 'Moje známky', vytvor: znamky, barva: A[2] },
  { id: 'rozvrh', nazev: 'Rozvrh hodin', vytvor: rozvrh, barva: A[5] },
  { id: 'kalendar', nazev: 'Měsíční kalendář', vytvor: kalendar, barva: A[0] },
  { id: 'faktura', nazev: 'Faktura', vytvor: faktura, barva: A[0] },
];
