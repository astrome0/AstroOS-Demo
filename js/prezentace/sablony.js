// AstroPrezentace — šablony nových prezentací a generátor obrázků SmartArt (skupina obrazců s textem)

import { Prezentace, novySnimek, odstavce, noveId } from './model.js';

/** Vyplní zástupné symboly snímku: { nadpis, podtitul, obsah: [...], obsah2, text, text2 } (pole = odstavce). */
export function vypln(s, obsah = {}) {
  for (const o of s.objekty) {
    const v = obsah[o.ph];
    if (v === undefined) continue;
    o.html = Array.isArray(v) ? odstavce(v) : odstavce([v]);
  }
  return s;
}

export function tvar(tvarId, x, y, w, h, o = {}) {
  return { id: noveId(), typ: 'tvar', tvar: tvarId, x, y, w, h, rot: 0, html: o.text ? odstavce(Array.isArray(o.text) ? o.text : [o.text]) : '', ...o, text: undefined };
}
export function textovePole(x, y, w, h, radky, o = {}) {
  return { id: noveId(), typ: 'text', x, y, w, h, rot: 0, html: odstavce(radky), vel: 18, ...o };
}

/** Obrazce SmartArt pro typ v oblasti (x, y, w, h). polozky = [text | [text, podtext]]. */
export function smartArt(typ, polozky, { x = 66, y = 150, w = 828, h = 320 } = {}) {
  const n = polozky.length;
  const txt = (p) => (Array.isArray(p) ? p : [p]);
  const out = [];
  const barvaI = (i) => (n > 1 ? `a1${i ? `+${Math.round((i / n) * 45)}` : ''}` : 'a1');
  switch (typ) {
    case 'proces': {
      const sipka = 34, bw = (w - sipka * (n - 1)) / n;
      polozky.forEach((p, i) => {
        out.push(tvar('zaobleny', x + i * (bw + sipka), y + h / 2 - 70, bw - 10, 140, { vypln: barvaI(i), obrys: 'lt', obrysW: 1.5, text: txt(p), vel: 20 }));
        if (i < n - 1) out.push(tvar('sipkaVpravo', x + i * (bw + sipka) + bw - 6, y + h / 2 - 16, sipka - 2, 32, { vypln: 'a1+60', obrys: 'none' }));
      });
      break;
    }
    case 'cyklus': {
      const r = Math.min(w, h) / 2 - 50, cx = x + w / 2, cy = y + h / 2, d = 108;
      polozky.forEach((p, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        out.push(tvar('oval', cx + Math.cos(a) * r - d / 2, cy + Math.sin(a) * r - d / 2, d, d, { vypln: barvaI(i), obrys: 'lt', obrysW: 1.5, text: txt(p), vel: 16 }));
        const a2 = a + Math.PI / n;
        out.push({ ...tvar('sipkaVpravo', cx + Math.cos(a2) * r - 14, cy + Math.sin(a2) * r - 10, 28, 20, { vypln: 'a1+50', obrys: 'none' }), rot: Math.round((a2 * 180) / Math.PI + 90) });
      });
      break;
    }
    case 'hierarchie': {
      const [hlava, ...deti] = polozky;
      const bw = Math.min(200, (w - 20 * (deti.length - 1)) / Math.max(1, deti.length));
      out.push(tvar('zaobleny', x + w / 2 - 110, y + 10, 220, 90, { vypln: 'a1', obrys: 'lt', obrysW: 1.5, text: txt(hlava), vel: 20 }));
      const celkem = deti.length * bw + (deti.length - 1) * 20, x0 = x + (w - celkem) / 2;
      if (deti.length) out.push({ ...tvar('cara', x0 + bw / 2, y + 140, celkem - bw, 0, { obrys: 'a1-25', obrysW: 1.5 }) }, { ...tvar('cara', x + w / 2, y + 100, 0, 40, { obrys: 'a1-25', obrysW: 1.5 }) });
      deti.forEach((p, i) => {
        out.push({ ...tvar('cara', x0 + i * (bw + 20) + bw / 2, y + 140, 0, 40, { obrys: 'a1-25', obrysW: 1.5 }) });
        out.push(tvar('zaobleny', x0 + i * (bw + 20), y + 180, bw, 84, { vypln: 'a1+30', obrys: 'lt', obrysW: 1.5, text: txt(p), vel: 18 }));
      });
      break;
    }
    case 'pyramida': {
      const vh = h / n;
      polozky.forEach((p, i) => {
        const sh = ((i + 1) / n) * w * 0.8;
        out.push(tvar(i === 0 ? 'trojuhelnik' : 'lichobeznik', x + w / 2 - sh / 2, y + i * vh, sh, vh - 4, { vypln: barvaI(i), obrys: 'lt', obrysW: 1.5, text: txt(p), vel: 18 }));
      });
      break;
    }
    case 'vennuv': {
      const d = Math.min(h * 0.75, w / 2.2);
      const pozice = n <= 2 ? [[-0.3, 0], [0.3, 0]] : [[-0.28, -0.18], [0.28, -0.18], [0, 0.3]];
      polozky.slice(0, 3).forEach((p, i) => {
        const [kx, ky] = pozice[i] || [0, 0];
        out.push(tvar('oval', x + w / 2 + kx * d - d / 2, y + h / 2 + ky * d - d / 2, d, d, { vypln: `a${i + 1}`, vyplnPruhlednost: 45, obrys: 'lt', obrysW: 1.5, text: txt(p), vel: 20, barva: 'tx' }));
      });
      break;
    }
    case 'casovaOsa': {
      out.push(tvar('sipkaVpravo', x, y + h / 2 - 14, w, 28, { vypln: 'a1+60', obrys: 'none' }));
      polozky.forEach((p, i) => {
        const cx = x + ((i + 0.5) / n) * (w - 30);
        out.push(tvar('oval', cx - 11, y + h / 2 - 11, 22, 22, { vypln: 'bg', obrys: 'a1', obrysW: 3 }));
        const nahore = i % 2 === 0;
        out.push(tvar('zaobleny', cx - Math.min(90, w / n / 2 - 4), nahore ? y + 10 : y + h / 2 + 30, Math.min(180, w / n - 8), 90, { vypln: barvaI(i), obrys: 'none', text: txt(p), vel: 16 }));
      });
      break;
    }
    case 'svisly': {
      const vh = (h - 10 * (n - 1)) / n;
      polozky.forEach((p, i) => {
        out.push(tvar('zaobleny', x, y + i * (vh + 10), w, vh, { vypln: barvaI(i), obrys: 'lt', obrysW: 1.5, text: txt(p), vel: 20, zar: 'l', okraje: { l: 20, r: 12, t: 4, b: 4 } }));
      });
      break;
    }
    default: {   // seznam bloků
      const sl = Math.min(n, 3), rady = Math.ceil(n / sl), gap = 18;
      const bw = (w - gap * (sl - 1)) / sl, bh = Math.min(150, (h - gap * (rady - 1)) / rady);
      polozky.forEach((p, i) => {
        const r = Math.floor(i / sl), c = i % sl;
        const vRade = Math.min(sl, n - r * sl);
        const posun = ((sl - vRade) * (bw + gap)) / 2;
        out.push(tvar('obdelnik', x + posun + c * (bw + gap), y + r * (bh + gap), bw, bh, { vypln: barvaI(i), obrys: 'lt', obrysW: 1.5, text: txt(p), vel: 22 }));
      });
    }
  }
  const skupina = noveId('g');
  for (const o of out) o.smartart = skupina;
  return out;
}

// ---------------------------------------------------------------- šablony
function zalozeni(motiv, varianta = 0) {
  const p = new Prezentace();
  p.motiv = motiv;
  p.varianta = varianta;
  return p;
}
const snimek = (p, rozvrzeni, obsah, dalsi = {}) => {
  const s = vypln(novySnimek(rozvrzeni), obsah);
  if (dalsi.objekty) s.objekty.push(...dalsi.objekty);
  if (dalsi.prechod) s.prechod = dalsi.prechod;
  if (dalsi.poznamky) s.poznamky = dalsi.poznamky;
  if (dalsi.animace) s.animace = dalsi.animace(s);
  if (dalsi.pozadi) s.pozadi = dalsi.pozadi;
  p.snimky.push(s);
  return s;
};
const obj = (s, ph) => s.objekty.find((o) => o.ph === ph);
const anim = (o, druh, efekt, start = 'klik', x = {}) => ({ id: noveId('a'), obj: o.id, druh, efekt, start, ...x });

export const SABLONY_PR = [
  {
    id: 'prazdny', nazev: 'Prázdná prezentace', motiv: 'office',
    vytvor() { const p = zalozeni('office'); snimek(p, 'uvodni', {}); return p; },
  },
  {
    id: 'prohlidka', nazev: 'Vítejte v AstroPrezentacích', motiv: 'vapor',
    vytvor(autor) {
      const p = zalozeni('vapor');
      snimek(p, 'uvodni', { nadpis: 'Vítejte v AstroPrezentacích', podtitul: `5 tipů, jak z prezentace udělat zážitek${autor ? ` · ${autor}` : ''}` }, {
        poznamky: 'Tohle je stránka poznámek. Při prezentování je uvidíte v zobrazení prezentujícího (Alt+F5), publikum ne.',
        animace: (s) => [anim(obj(s, 'nadpis'), 'vstup', 'zeslabit', 'spolu', { trvani: 1 }), anim(obj(s, 'podtitul'), 'vstup', 'ploutDovnitr', 'po', { trvani: 0.8 })],
      });
      snimek(p, 'obsah', { nadpis: '1 · Přidejte snímek', obsah: ['Na kartě Domů klikněte na šipku u tlačítka Nový snímek', 'Vyberte rozložení — třeba Porovnání nebo Obrázek s titulkem', ['Zkratka: Ctrl+M', 1], 'Snímky přesouvejte přetažením v panelu vlevo'] }, { prechod: { typ: 'posunuti', smer: 'zprava' } });
      const s3 = snimek(p, 'nadpis', { nadpis: '2 · Kreslete a zarovnávejte' }, {
        prechod: { typ: 'premena' },
        objekty: [
          tvar('oval', 120, 190, 150, 150, { vypln: 'a1', obrys: 'none', text: 'Táhněte', vel: 18 }),
          tvar('zaobleny', 405, 190, 150, 150, { vypln: 'a2', obrys: 'none', text: 'mě', vel: 18 }),
          tvar('hvezda5', 690, 190, 150, 150, { vypln: 'a3', obrys: 'none' }),
          textovePole(120, 390, 720, 60, ['Při tažení se objeví červená vodítka — objekty se přichytí ke středu snímku i k sobě navzájem.'], { zar: 'c', vel: 18, barva: 'tx2' }),
        ],
      });
      void s3;
      snimek(p, 'dva', { nadpis: '3 · Přechody a animace', obsah: ['Karta Přechody: Přeměna, Krychle, Galerie…', 'Náhled přehraje efekt hned'], obsah2: ['Karta Animace: vstup, zdůraznění, konec', 'Podokno animací určí pořadí'] }, {
        prechod: { typ: 'krychle', smer: 'zprava' },
        animace: (s) => [anim(obj(s, 'obsah'), 'vstup', 'priletet', 'klik', { smer: 'zleva' }), anim(obj(s, 'obsah2'), 'vstup', 'priletet', 'po', { smer: 'zprava' })],
      });
      snimek(p, 'obsah', { nadpis: '4 · Designer a AstroAI', obsah: ['Designer (karta Domů) navrhne rozvržení snímku', 'AstroAI napíše osnovu celé prezentace z jedné věty', 'Návrh › Motivy změní vzhled všech snímků najednou'] }, { prechod: { typ: 'galerie', smer: 'zprava' } });
      snimek(p, 'oddil', { nadpis: '5 · Prezentujte!', text: 'F5 od začátku · Shift+F5 od tohoto snímku · B černá obrazovka · Ctrl+P pero' }, {
        prechod: { typ: 'lupa' },
        animace: (s) => [anim(obj(s, 'nadpis'), 'zduraz', 'pulz', 'po', { zpozdeni: 0.3 })],
      });
      return p;
    },
  },
  {
    id: 'referat', nazev: 'Školní referát', motiv: 'integral',
    vytvor(autor) {
      const p = zalozeni('integral');
      snimek(p, 'uvodni', { nadpis: 'Sluneční soustava', podtitul: `Referát · ${autor || 'Jméno Příjmení'} · ${new Date().getFullYear()}` });
      snimek(p, 'obsah', { nadpis: 'Obsah', obsah: ['Co je Sluneční soustava', 'Planety', 'Zajímavosti', 'Zdroje'] }, { prechod: { typ: 'zeslabit' } });
      snimek(p, 'obsah', { nadpis: 'Co je Sluneční soustava', obsah: ['Slunce a všechna tělesa, která kolem něj obíhají', 'Vznikla asi před 4,6 miliardy let', ['z oblaku plynu a prachu', 1], '8 planet, trpasličí planety, měsíce, planetky a komety'] }, { prechod: { typ: 'zeslabit' } });
      snimek(p, 'porovnani', { nadpis: 'Planety', text: 'Terestrické (kamenné)', obsah: ['Merkur', 'Venuše', 'Země', 'Mars'], text2: 'Plynní obři', obsah2: ['Jupiter', 'Saturn', 'Uran', 'Neptun'] }, { prechod: { typ: 'zeslabit' } });
      snimek(p, 'nadpis', { nadpis: 'Velikost planet (průměr v tis. km)' }, {
        prechod: { typ: 'zeslabit' },
        objekty: [{ id: noveId(), typ: 'graf', x: 90, y: 140, w: 780, h: 340, rot: 0, graf: { typ: 'sloupcovy', nazev: null, legenda: null, kategorie: ['Merkur', 'Venuše', 'Země', 'Mars', 'Jupiter', 'Saturn', 'Uran', 'Neptun'], rady: [{ nazev: 'Průměr', hodnoty: [4.9, 12.1, 12.7, 6.8, 139.8, 116.5, 50.7, 49.2] }] } }],
      });
      snimek(p, 'obsah', { nadpis: 'Zajímavosti', obsah: ['Den na Venuši je delší než její rok', 'Jupiter má přes 90 známých měsíců', 'Na Marsu je nejvyšší sopka — Olympus Mons (asi 22 km)'] }, { prechod: { typ: 'zeslabit' } });
      snimek(p, 'oddil', { nadpis: 'Děkuji za pozornost', text: 'Máte nějaké otázky?' }, { prechod: { typ: 'zeslabit' } });
      return p;
    },
  },
  {
    id: 'projekt', nazev: 'Projektový plán', motiv: 'retrospect',
    vytvor() {
      const p = zalozeni('retrospect');
      snimek(p, 'uvodni', { nadpis: 'Projekt Nová aplikace', podtitul: 'Plán na čtvrtletí' });
      snimek(p, 'obsah', { nadpis: 'Cíle', obsah: ['Vydat první verzi do konce září', 'Získat 100 testerů', 'Průměrné hodnocení alespoň 4,5 ★'] }, { prechod: { typ: 'posunuti', smer: 'zdola' } });
      snimek(p, 'nadpis', { nadpis: 'Harmonogram' }, { prechod: { typ: 'posunuti', smer: 'zdola' }, objekty: smartArt('casovaOsa', ['Návrh\nčervenec', 'Vývoj\nsrpen', 'Testování\nzáří', 'Vydání\nříjen'].map((t) => t.split('\n'))) });
      snimek(p, 'nadpis', { nadpis: 'Tým a úkoly' }, {
        prechod: { typ: 'posunuti', smer: 'zdola' },
        objekty: [{ id: noveId(), typ: 'tabulka', x: 66, y: 150, w: 828, h: 200, rot: 0, vel: 18, tab: { styl: 'stredni2-a1', zahlavi: true, pruhyR: true, sloupce: [300, 300, 228], radky: [
          ['Úkol', 'Kdo', 'Termín'], ['Grafický návrh', 'Anna', '15. 7.'], ['Programování', 'Petr, Jana', '31. 8.'], ['Testování', 'Celý tým', '20. 9.'],
        ].map((r) => r.map((t) => ({ html: t }))) } }],
      });
      snimek(p, 'nadpis', { nadpis: 'Rozpočet' }, {
        prechod: { typ: 'posunuti', smer: 'zdola' },
        objekty: [{ id: noveId(), typ: 'graf', x: 160, y: 140, w: 640, h: 350, rot: 0, graf: { typ: 'prstencovy', nazev: null, legenda: 'vpravo', kategorie: ['Vývoj', 'Design', 'Marketing', 'Rezerva'], rady: [{ nazev: 'Rozpočet', hodnoty: [55, 15, 20, 10] }] } }],
      });
      snimek(p, 'oddil', { nadpis: 'Další kroky', text: 'Schůzka týmu každé pondělí v 9:00' }, { prechod: { typ: 'posunuti', smer: 'zdola' } });
      return p;
    },
  },
  {
    id: 'cestovani', nazev: 'Cestovní deník', motiv: 'celestial',
    vytvor() {
      const p = zalozeni('celestial', 1);
      snimek(p, 'uvodni', { nadpis: 'Léto u moře', podtitul: 'Chorvatsko · 2026' }, { animace: (s) => [anim(obj(s, 'nadpis'), 'vstup', 'lupa', 'spolu'), anim(obj(s, 'podtitul'), 'vstup', 'zeslabit', 'po')] });
      snimek(p, 'obsahTitulek', { nadpis: 'Den 1', text: 'Cesta autem, první koupání a zmrzlina v přístavu.', obsah: ['Odjezd v 5:00', 'Příjezd do Splitu', 'Večer procházka po nábřeží'] }, { prechod: { typ: 'galerie', smer: 'zprava' } });
      snimek(p, 'obsahTitulek', { nadpis: 'Den 2', text: 'Výlet lodí na ostrovy.', obsah: ['Delfíni!', 'Šnorchlování v zátoce', 'Grilované ryby'] }, { prechod: { typ: 'galerie', smer: 'zprava' } });
      snimek(p, 'nadpis', { nadpis: 'Nejlepší momenty' }, { prechod: { typ: 'galerie', smer: 'zprava' }, objekty: smartArt('seznam', ['Delfíni', 'Západ slunce', 'Zmrzlina', 'Skákání do vody', 'Noční trh']) });
      snimek(p, 'oddil', { nadpis: 'Zase za rok!', text: 'Fotky najdete ve složce Obrázky.' }, { prechod: { typ: 'lupa' } });
      return p;
    },
  },
  {
    id: 'portfolio', nazev: 'Portfolio', motiv: 'slice',
    vytvor(autor) {
      const p = zalozeni('slice');
      snimek(p, 'uvodni', { nadpis: 'Moje portfolio', podtitul: autor || 'Jméno Příjmení' });
      snimek(p, 'obsah', { nadpis: 'O mně', obsah: ['Baví mě programování a design', 'Tvořím hry, weby a aplikace', 'Učím se HTML, CSS a JavaScript'] }, { prechod: { typ: 'prepnout', smer: 'zprava' } });
      snimek(p, 'dva', { nadpis: 'Projekty', obsah: ['AstroOS — operační systém v prohlížeči', 'Minecraft klon'], obsah2: ['Vlastní server', 'Mobilní ovládání'] }, { prechod: { typ: 'prepnout', smer: 'zprava' } });
      snimek(p, 'nadpis', { nadpis: 'Dovednosti' }, { prechod: { typ: 'prepnout', smer: 'zprava' }, objekty: [{ id: noveId(), typ: 'graf', x: 90, y: 140, w: 780, h: 340, rot: 0, graf: { typ: 'pruhovy', nazev: null, legenda: null, kategorie: ['HTML', 'CSS', 'JavaScript', 'Design'], rady: [{ nazev: 'Úroveň', hodnoty: [80, 70, 60, 75] }] } }] });
      snimek(p, 'oddil', { nadpis: 'Kontakt', text: 'Napište mi v aplikaci Pošta' }, { prechod: { typ: 'prepnout', smer: 'zprava' } });
      return p;
    },
  },
  {
    id: 'pitch', nazev: 'Představení nápadu', motiv: 'ion',
    vytvor() {
      const p = zalozeni('ion');
      snimek(p, 'uvodni', { nadpis: 'Náš nápad', podtitul: 'Jak to změní svět ve třech minutách' });
      snimek(p, 'obsah', { nadpis: 'Problém', obsah: ['Lidé nemají čas…', '…a informace jsou roztroušené všude'] }, { prechod: { typ: 'krychle', smer: 'zprava' } });
      snimek(p, 'obsah', { nadpis: 'Řešení', obsah: ['Jedna aplikace pro všechno', 'Funguje offline', 'Zdarma pro studenty'] }, { prechod: { typ: 'krychle', smer: 'zprava' } });
      snimek(p, 'nadpis', { nadpis: 'Jak to funguje' }, { prechod: { typ: 'krychle', smer: 'zprava' }, objekty: smartArt('proces', ['Stáhnout', 'Přihlásit se', 'Používat']) });
      snimek(p, 'nadpis', { nadpis: 'Růst uživatelů' }, { prechod: { typ: 'krychle', smer: 'zprava' }, objekty: [{ id: noveId(), typ: 'graf', x: 90, y: 140, w: 780, h: 340, rot: 0, graf: { typ: 'spojnicovyZnacky', nazev: null, legenda: 'dole', kategorie: ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čer'], rady: [{ nazev: 'Uživatelé (tis.)', hodnoty: [1, 3, 7, 12, 20, 34] }, { nazev: 'Cíl', hodnoty: [2, 4, 6, 10, 15, 25] }] } }] });
      snimek(p, 'oddil', { nadpis: 'Děkujeme!', text: 'Otázky?' }, { prechod: { typ: 'krychle', smer: 'zprava' } });
      return p;
    },
  },
];

export function vytvorZeSablony(id, autor) {
  const s = SABLONY_PR.find((x) => x.id === id) || SABLONY_PR[0];
  const p = s.vytvor(autor);
  p.zalozHistorii();
  return p;
}
