// AstroTabulky — příkazy nad výběrem: formátování, schránka, vkládání/mazání, řazení, filtry, zkratky, nabídky

import { el } from '../util.js';
import { ik } from '../pismo/ikony.js';
import { rozbal, zavriRozbal, nabidka, paleta, dialog, zprava, pole } from '../pismo/ui.js';
import { klic, zKlice, MAX_R, MAX_C, adresa, textOblasti, rozeberOblast, serad, obsahuje, prekryva, pismena, jmenoListuVeVzorci } from './adresy.js';
import { formatuj, jeChyba, obecne, rozpoznej, zmenDesetinna, rozborKodu, kodMena, kodUcetni, FORMATY, jeDatovyFormat, dnes, ted } from './format.js';
import { slozStyl, ChybaUpravy, VYCHOZI_SIRKA, VYCHOZI_VYSKA, VYCHOZI_VELIKOST, oblastDatTabulky, rozdelCsv, uhodniOddelovac } from './sesit.js';
import { posunVzorec, upravPoPresunu, parse, vyhodnot, Ref, naPole, naText, predchudci, FUNKCE } from './vzorce.js';
import { pismoCanvas, zalomit } from './kresleni.js';
import { STYLY_BUNEK, STYLY_TABULEK, PREDVOLBY_CF, stylTabulky } from './styly.js';
import * as D from './dialogy.js';
import { setCaret } from './mrizka.js';

export function pridejPrikazy(P) {
  const g = P.grid;
  const L = () => P.S.list;
  const V = () => L().vyber;
  const oblasti = () => V().oblasti;
  const oblast = () => { const o = V().oblasti; return o[o.length - 1]; };
  const S = () => P.S;

  /** Oblasti výběru oříznuté na rozumnou velikost (celé sloupce nechá celé — styl se uloží na sloupec). */
  const cile = () => oblasti();

  // ------------------------------------------------------------ zámek listu
  P.zamcenaAktivni = () => {
    const l = L();
    if (!l.zamek) return false;
    const s = S().stylBunky(l, V().r, V().c);
    return !s || s.zamek !== false;
  };
  P.hlaskaZamek = (text) => zprava(P.koren, text || 'Buňka nebo graf, které se pokoušíte změnit, jsou na zamknutém listu. Změny provedete po odemknutí listu. Může být vyžadováno heslo.', 'AstroTabulky');
  const kontrolaZamku = (povoleni) => {
    const l = L();
    if (!l.zamek) return true;
    if (povoleni && l.zamek.povolit?.[povoleni]) return true;
    P.hlaskaZamek();
    return false;
  };

  // ------------------------------------------------------------ formát
  P.styl = (zmena, popis = 'Formát') => {
    if (P.st.objekt) return P.stylObjektu?.(zmena, popis);
    if (!kontrolaZamku('formatBunek')) return;
    P.posledniAkce = () => P.styl(zmena, popis);
    P.prikaz(popis, () => S().stylOblasti(L(), cile(), zmena), { prepocet: false });
  };
  P.prepni = (k, popis) => {
    const akt = P.stav.s?.[k];
    P.styl({ [k]: akt ? null : (k === 'u' ? 's' : true) }, popis);
  };
  P.pismo = (jmeno) => { const p = jmeno.replace(/ \(.*\)$/, ''); if (p) P.styl({ font: p === 'Aptos Narrow' ? null : p }, 'Písmo'); };
  P.velikost = (v) => {
    const n = parseFloat(String(v).replace(',', '.'));
    if (!n || n < 1 || n > 409) return;
    P.styl({ vel: n === VYCHOZI_VELIKOST ? null : n }, 'Velikost písma');
  };
  const VELIKOSTI = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];
  P.zmenVelikost = (smer) => {
    const akt = P.stav.velikost || 11;
    const dalsi = smer > 0 ? VELIKOSTI.find((v) => v > akt) || akt + 10 : [...VELIKOSTI].reverse().find((v) => v < akt) || Math.max(1, akt - 1);
    P.velikost(dalsi);
  };
  P.barvaPisma = (b) => P.styl({ barva: b === 'auto' ? null : b }, 'Barva písma');
  P.barvaVyplne = (b) => P.styl({ pozadi: b || null }, 'Barva výplně');
  P.zarovnat = (h) => P.styl({ h: P.stav.h === h ? null : h }, 'Zarovnání');
  P.svisle = (v) => P.styl({ v: v === 'b' ? null : v }, 'Svislé zarovnání');
  P.zalamovat = () => P.styl({ zalam: !P.stav.zalam }, 'Zalamovat text');
  P.odsazeni = (smer) => P.styl((s) => {
    const o = Math.max(0, Math.min(15, (s?.odsaz || 0) + smer));
    return slozStyl(s, { odsaz: o || null, h: o && !['l', 'r'].includes(s?.h) ? 'l' : s?.h || null });
  }, 'Odsazení');
  P.otoceni = (u) => P.styl({ otoc: u || null }, 'Orientace');
  P.ohraniceni = (typ, cara) => {
    if (!kontrolaZamku('formatBunek')) return;
    const c = cara || P.stav.cara || { s: 'tenka', b: '#000000' };
    P.posledniOhraniceni = typ;
    P.prikaz('Ohraničení', () => { for (const o of cile()) S().ohranic(L(), orez(o), typ, c); }, { prepocet: false });
  };
  const orez = (o) => { const u = S().rozsah(L()); return { r1: o.r1, c1: o.c1, r2: Math.min(o.r2, Math.max(o.r1, u.r + 1)), c2: Math.min(o.c2, Math.max(o.c1, u.c + 1)) }; };

  P.formatCisla = (kod) => P.styl({ nf: /^general$/i.test(kod) ? null : kod }, 'Číselný formát');
  P.desetinna = (smer) => {
    const kod = P.stav.nf;
    P.styl((s, r, c) => slozStyl(s, { nf: zmenDesetinna(s?.nf || kod, smer, r >= 0 && c >= 0 ? S().hodnota(L(), r, c) : P.stav.hodnota) }), smer > 0 ? 'Přidat desetinné místo' : 'Odebrat desetinné místo');
  };
  P.menaFormat = (symbol = 'Kč') => P.formatCisla(kodUcetni({ des: 2, symbol }));
  P.procentaFormat = () => P.formatCisla('0%');
  P.tisiceFormat = () => P.formatCisla('_-* #,##0.00_-;-* #,##0.00_-;_-* "-"??_-;_-@_-');

  P.stylBunkyGalerie = (id) => {
    const st = STYLY_BUNEK.flatMap((s) => s.styly).find((x) => x.id === id);
    if (!st) return;
    P.styl((s) => {
      if (id === 'normalni') return null;
      const z = { ...st.s };
      return Object.freeze({ ...(s?.nf && !z.nf ? { nf: s.nf } : {}), ...(s?.h ? { h: s.h } : {}), ...z });
    }, `Styl ${st.titulek || st.nazev}`);
  };

  P.sloucit = async (typ = 'stred') => {
    if (!kontrolaZamku('formatBunek')) return;
    const o = oblast();
    if (typ === 'zrusit' || (typ === 'stred' && P.stav.slouceno)) { P.prikaz('Zrušit sloučení buněk', () => S().sluc(L(), o, 'zrusit'), { prepocet: false }); return; }
    if (o.r1 === o.r2 && o.c1 === o.c2) return;
    if (L().tabulky.some((t) => prekryva(t.oblast, o))) { zprava(P.koren, 'Buňky v tabulce nelze sloučit.'); return; }
    const ztrata = S().hodnotyKeZtrate(L(), o);
    const proved = () => { P.prikaz(typ === 'stred' ? 'Sloučit a zarovnat na střed' : 'Sloučit buňky', () => S().sluc(L(), o, typ)); g.vyberOblast(o); };
    if (ztrata) dialog(P.koren, { titulek: 'AstroTabulky', obsah: el('p.ps-zprava', { text: 'Sloučením buněk se zachová jen hodnota v levé horní buňce a ostatní hodnoty se zahodí.' }), tlacitka: [{ text: 'OK', primarni: true, akce: proved }, { text: 'Zrušit' }] });
    else proved();
  };

  // kopírovat formát (štětec)
  P.stetec = (zapnout = !P.st.stetec, trvale = false) => {
    if (zapnout) {
      const v = V();
      const o = oblast();
      const styly = [];
      for (let r = o.r1; r <= Math.min(o.r2, o.r1 + 200); r++) { const radek = []; for (let c = o.c1; c <= Math.min(o.c2, o.c1 + 50); c++) radek.push(S().stylBunky(L(), r, c)); styly.push(radek); }
      P.st.stetec = { styly, trvale, sloucene: L().sloucene.filter((m) => obsahuje(o, m.r1, m.c1)).map((m) => ({ ...m, r1: m.r1 - o.r1, r2: m.r2 - o.r1, c1: m.c1 - o.c1, c2: m.c2 - o.c1 })) };
      g.kopie = { list: L(), oblast: o, stetec: true };
      P.koren.classList.add('tb-stetec');
    } else {
      P.st.stetec = null;
      if (g.kopie?.stetec) g.kopie = null;
      P.koren.classList.remove('tb-stetec');
    }
    g.prekresli();
    P.obnov();
  };
  P.pouzijStetec = () => {
    const s = P.st.stetec;
    if (!s) return;
    const cil = oblast();
    const R = s.styly.length, C = s.styly[0].length;
    const r2 = Math.max(cil.r2, cil.r1 + R - 1), c2 = Math.max(cil.c2, cil.c1 + C - 1);
    P.prikaz('Kopírovat formát', () => {
      S().stylOblasti(L(), [{ r1: cil.r1, c1: cil.c1, r2: r2, c2: c2 }], (st, r, c) => s.styly[(r - cil.r1) % R]?.[(c - cil.c1) % C] || null);
      for (const m of s.sloucene) S().sluc(L(), { r1: cil.r1 + m.r1, r2: cil.r1 + m.r2, c1: cil.c1 + m.c1, c2: cil.c1 + m.c2 }, 'bunky');
    }, { prepocet: false });
    if (!s.trvale) P.stetec(false);
  };

  // ------------------------------------------------------------ výška řádků podle obsahu
  P.prepocitejVysky = () => {
    const ctx = g.ctx;
    for (const l of S().listy) {
      const mapa = new Map();
      for (const [k, b] of l.b) {
        const s = b.s;
        const text = typeof b.v === 'string' ? b.v : null;
        const velke = s?.vel && s.vel > 11.5;
        const zalam = s?.zalam;
        const radky = text && text.includes('\n');
        if (!velke && !zalam && !radky) continue;
        const [r, c] = zKlice(k);
        if (l.vysky.has(r) || S().sloucenaV(l, r, c)) continue;
        const vel = s?.vel || VYCHOZI_VELIKOST;
        const radek = vel * 4 / 3 * 1.22;
        let n = 1;
        if (zalam || radky) {
          ctx.font = pismoCanvas(s, 1);
          const t = S().textBunky(l, r, c);
          n = zalam ? zalomit(ctx, t, S().sirka(l, c) - 6).length : t.split('\n').length;
        }
        const h = Math.ceil(n * radek + 2.5);
        if (h > VYCHOZI_VYSKA + 0.5) mapa.set(r, Math.max(mapa.get(r) || 0, Math.min(409 / 0.75, h)));
      }
      l.vyskyAuto = mapa;
    }
  };

  /** Excel sám rozšíří sloupec s výchozí šířkou, když se do něj nevejde formátované číslo nebo datum. */
  P.rozsirSloupceProCisla = () => {
    const l = L(), ctx = g.ctx, u = S().rozsah(l);
    let n = 0;
    for (const o of oblasti()) {
      for (let c = o.c1; c <= Math.min(o.c2, u.c); c++) {
        if (l.sirky.has(c) || l.skryteC.has(c)) continue;
        let max = 0;
        for (let r = o.r1; r <= Math.min(o.r2, u.r); r++) {
          if (++n > 4000) return;
          const v = S().hodnota(l, r, c);
          if (typeof v !== 'number') continue;
          const s = S().stylBunky(l, r, c);
          if (!s?.nf || /^general$/i.test(s.nf) || S().sloucenaV(l, r, c)) continue;
          ctx.font = pismoCanvas(s, 1);
          max = Math.max(max, ctx.measureText(formatuj(v, s.nf).text).width + 10 + (s.odsaz || 0) * 9);
        }
        if (max > S().sirka(l, c)) l.sirky.set(c, Math.ceil(max));
      }
    }
  };

  P.prizpusobSirku = (c) => {
    const l = L();
    const sloupce = new Set([c]);
    for (const o of oblasti()) if (o.r1 === 0 && o.r2 === MAX_R - 1 && c >= o.c1 && c <= o.c2) for (let i = o.c1; i <= Math.min(o.c2, o.c1 + 300); i++) sloupce.add(i);
    P.prikaz('Přizpůsobit šířku sloupce', () => { for (const x of sloupce) nastavSirkuPodleObsahu(l, x); }, { prepocet: false });
  };
  function nastavSirkuPodleObsahu(l, c, radky = null) {
    const ctx = g.ctx;
    let max = 0;
    const u = S().rozsah(l);
    for (let r = radky?.r1 ?? 0; r <= Math.min(radky?.r2 ?? u.r, u.r); r++) {
      const v = S().hodnota(l, r, c);
      if (v === null) continue;
      if (S().sloucenaV(l, r, c)) continue;
      const s = S().stylBunky(l, r, c);
      if (s?.zalam) continue;
      ctx.font = pismoCanvas(s, 1);
      const t = l.zobrazitVzorce && S().bunka(l, r, c)?.f ? S().bunka(l, r, c).f : S().textBunky(l, r, c);
      const w = Math.max(...String(t).split('\n').map((x) => ctx.measureText(x).width)) + 8 + (s?.odsaz || 0) * 9;
      const filtr = (l.filtr && l.filtr.oblast.r1 === r) || l.tabulky.some((tb) => tb.oblast.r1 === r && c >= tb.oblast.c1 && c <= tb.oblast.c2) ? 20 : 0;
      if (w + filtr > max) max = w + filtr;
    }
    if (max) l.sirky.set(c, Math.min(1500, Math.ceil(max)));
    else l.sirky.delete(c);
  }
  P.nastavSirkuPodleObsahu = nastavSirkuPodleObsahu;
  P.prizpusobVysku = (r) => {
    const l = L();
    P.prikaz('Přizpůsobit výšku řádku', () => { l.vysky.delete(r); }, { prepocet: false });
  };
  P.prizpusobSirkyVyberu = () => P.prikaz('Přizpůsobit šířku sloupce', () => { for (const o of oblasti()) for (let c = o.c1; c <= Math.min(o.c2, o.c1 + 300); c++) nastavSirkuPodleObsahu(L(), c, o.r1 === 0 && o.r2 === MAX_R - 1 ? null : o); }, { prepocet: false });
  P.prizpusobVyskyVyberu = () => P.prikaz('Přizpůsobit výšku řádku', () => { for (const o of oblasti()) for (let r = o.r1; r <= Math.min(o.r2, o.r1 + 5000); r++) L().vysky.delete(r); }, { prepocet: false });
  P.sirkaSloupcu = (px) => P.prikaz('Šířka sloupce', () => { for (const o of oblasti()) for (let c = o.c1; c <= Math.min(o.c2, o.c1 + 16384); c++) { if (px === 0) L().skryteC.add(c); else { L().sirky.set(c, px); L().skryteC.delete(c); } } }, { prepocet: false });
  P.vyskaRadku = (px) => P.prikaz('Výška řádku', () => { for (const o of oblasti()) for (let r = o.r1; r <= Math.min(o.r2, o.r1 + 100000); r++) { if (px === 0) L().skryteR.add(r); else { L().vysky.set(r, px); L().skryteR.delete(r); } } }, { prepocet: false });
  P.skryt = (co) => {
    if (!kontrolaZamku(co === 'radky' ? 'formatRadku' : 'formatSloupcu')) return;
    P.prikaz(co === 'radky' ? 'Skrýt řádky' : 'Skrýt sloupce', () => {
      for (const o of oblasti()) {
        if (co === 'radky') for (let r = o.r1; r <= Math.min(o.r2, o.r1 + 100000); r++) L().skryteR.add(r);
        else for (let c = o.c1; c <= o.c2; c++) L().skryteC.add(c);
      }
    }, { prepocet: false });
    const v = V();
    if (co === 'radky') { let r = oblast().r2 + 1; g.nastavVyber(Math.min(MAX_R - 1, r), v.c); }
    else { let c = oblast().c2 + 1; g.nastavVyber(v.r, Math.min(MAX_C - 1, c)); }
  };
  P.zobrazitSkryte = (co) => P.prikaz(co === 'radky' ? 'Zobrazit řádky' : 'Zobrazit sloupce', () => {
    for (const o of oblasti()) {
      if (co === 'radky') { for (const r of [...L().skryteR]) if (r >= o.r1 - 1 && r <= o.r2 + 1) L().skryteR.delete(r); if (o.r1 === 0) for (const r of [...L().skryteR]) if (r < o.r1) L().skryteR.delete(r); }
      else { for (const c of [...L().skryteC]) if (c >= o.c1 - 1 && c <= o.c2 + 1) L().skryteC.delete(c); if (o.c1 === 0) for (const c of [...L().skryteC]) if (c < o.c1) L().skryteC.delete(c); }
    }
  }, { prepocet: false });

  // ------------------------------------------------------------ vložit / odstranit
  P.vlozitBunky = (typ) => {
    const o = oblast();
    const celeRadky = o.c1 === 0 && o.c2 === MAX_C - 1, celeSloupce = o.r1 === 0 && o.r2 === MAX_R - 1;
    if (!typ) {
      if (celeRadky) typ = 'radky';
      else if (celeSloupce) typ = 'sloupce';
      else { D.dialogVlozitBunky(P, false); return; }
    }
    if (typ === 'list') { P.novyList(); return; }
    const popis = { radky: 'Vložit řádky', sloupce: 'Vložit sloupce', bunkyDolu: 'Vložit buňky', bunkyVpravo: 'Vložit buňky' }[typ];
    P.posledniAkce = () => P.vlozitBunky(typ);
    P.prikaz(popis, () => {
      const serazene = [...oblasti()].sort((a, b) => (typ === 'sloupce' || typ === 'bunkyVpravo' ? b.c1 - a.c1 : b.r1 - a.r1));
      for (const x of serazene) {
        if (typ === 'radky') S().vloz(L(), 'r', x.r1, x.r2 - x.r1 + 1);
        else if (typ === 'sloupce') S().vloz(L(), 'c', x.c1, x.c2 - x.c1 + 1);
        else if (typ === 'bunkyDolu') S().vloz(L(), 'r', x.r1, x.r2 - x.r1 + 1, { od: x.c1, do: x.c2 });
        else S().vloz(L(), 'c', x.c1, x.c2 - x.c1 + 1, { od: x.r1, do: x.r2 });
      }
      posunObjekty(typ, o, 1);
    });
  };
  P.odstranitBunky = (typ) => {
    const o = oblast();
    const celeRadky = o.c1 === 0 && o.c2 === MAX_C - 1, celeSloupce = o.r1 === 0 && o.r2 === MAX_R - 1;
    if (!typ) {
      if (celeRadky) typ = 'radky';
      else if (celeSloupce) typ = 'sloupce';
      else { D.dialogVlozitBunky(P, true); return; }
    }
    if (typ === 'list') { P.smazatList(L()); return; }
    const popis = { radky: 'Odstranit řádky', sloupce: 'Odstranit sloupce', bunkyNahoru: 'Odstranit buňky', bunkyVlevo: 'Odstranit buňky' }[typ];
    P.posledniAkce = () => P.odstranitBunky(typ);
    P.prikaz(popis, () => {
      const serazene = [...oblasti()].sort((a, b) => (typ === 'sloupce' || typ === 'bunkyVlevo' ? b.c1 - a.c1 : b.r1 - a.r1));
      for (const x of serazene) {
        if (typ === 'radky') S().vloz(L(), 'r', x.r1, -(x.r2 - x.r1 + 1));
        else if (typ === 'sloupce') S().vloz(L(), 'c', x.c1, -(x.c2 - x.c1 + 1));
        else if (typ === 'bunkyNahoru') S().vloz(L(), 'r', x.r1, -(x.r2 - x.r1 + 1), { od: x.c1, do: x.c2 });
        else S().vloz(L(), 'c', x.c1, -(x.c2 - x.c1 + 1), { od: x.r1, do: x.r2 });
      }
      posunObjekty(typ, o, -1);
    });
    g.nastavVyber(V().r, V().c, oblasti().map((x) => ({ ...x })), { ukazat: false });
  };
  function posunObjekty(typ, o, smer) {
    // grafy a obrázky pod vloženými řádky se posunou (jako v Excelu „přesouvat s buňkami“)
    const l = L();
    const dy = typ === 'radky' ? (o.r2 - o.r1 + 1) * VYCHOZI_VYSKA * smer : 0;
    const dx = typ === 'sloupce' ? (o.c2 - o.c1 + 1) * (l.vychoziSirka || VYCHOZI_SIRKA) * smer : 0;
    if (!dx && !dy) return;
    const hranice = typ === 'radky' ? g.osaR.pos(o.r1) : g.osaS.pos(o.c1);
    for (const x of [...l.grafy, ...l.obrazky]) {
      if (typ === 'radky' && x.y >= hranice) x.y = Math.max(0, x.y + dy);
      if (typ === 'sloupce' && x.x >= hranice) x.x = Math.max(0, x.x + dx);
    }
  }

  P.vymazObsah = (proEditaci = false) => {
    if (P.st.objekt) { P.smazObjekt(); return; }
    if (P.zamcenaAktivni() || (L().zamek && oblasti().some((o) => { try { S().zkontrolujZamek(L(), [o]); return false; } catch { return true; } }))) { P.hlaskaZamek(); return; }
    const o = proEditaci ? [{ r1: V().r, c1: V().c, r2: V().r, c2: V().c }] : oblasti();
    // Delete v rozlité oblasti nic nesmaže (smaže se jen kotva)
    const ma = o.some((x) => S().kliceVOblasti(L(), x).some((k) => { const b = L().b.get(k); return b.f || (b.v !== null && b.v !== undefined); }));
    if (!ma) return;
    P.prikaz('Vymazat', () => S().vymaz(L(), o, 'obsah'));
  };
  P.vymazat = (co) => {
    if (!kontrolaZamku()) return;
    const popis = { vse: 'Vymazat vše', formaty: 'Vymazat formáty', obsah: 'Vymazat obsah', komentare: 'Vymazat komentáře a poznámky', odkazy: 'Odebrat hypertextové odkazy' }[co];
    P.prikaz(popis, () => S().vymaz(L(), oblasti(), co));
  };

  // ------------------------------------------------------------ schránka
  function snimekOblasti(l, o) {
    const u = S().rozsah(l);
    const oo = { r1: o.r1, c1: o.c1, r2: Math.min(o.r2, Math.max(o.r1, u.r)), c2: Math.min(o.c2, Math.max(o.c1, u.c)) };
    const bunky = [];
    const radkyTsv = [];
    for (let r = oo.r1; r <= oo.r2; r++) {
      if (l.skryteFiltrem.has(r)) continue;   // vyfiltrované řádky se nekopírují
      const radek = [], txt = [];
      for (let c = oo.c1; c <= oo.c2; c++) {
        const b = l.b.get(klic(r, c));
        const s = S().stylBunky(l, r, c);
        const v = S().hodnota(l, r, c);
        radek.push({ b, s, v, r, c });
        let t = S().textBunky(l, r, c);
        if (/[\t\n"]/.test(t)) t = '"' + t.replace(/"/g, '""') + '"';
        txt.push(t);
      }
      bunky.push(radek);
      radkyTsv.push(txt.join('\t'));
    }
    const sirky = [];
    for (let c = oo.c1; c <= oo.c2; c++) sirky.push(l.sirky.get(c) ?? null);
    return { list: l, oblast: oo, bunky, text: radkyTsv.join('\r\n') + '\r\n', sirky, sloucene: l.sloucene.filter((m) => obsahuje(oo, m.r1, m.c1)).map((m) => ({ ...m })) };
  }
  function htmlOblasti(sn) {
    const td = (x) => {
      const s = x.s || {};
      const css = [s.b && 'font-weight:bold', s.i && 'font-style:italic', s.u && 'text-decoration:underline', s.barva && `color:${s.barva}`, s.pozadi && `background:${s.pozadi}`, s.font && `font-family:'${s.font}'`, s.vel && `font-size:${s.vel}pt`].filter(Boolean).join(';');
      const t = S().textBunky(sn.list, x.r, x.c);
      return `<td${css ? ` style="${css}"` : ''}>${t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</td>`;
    };
    return `<table>${sn.bunky.map((r) => `<tr>${r.map(td).join('')}</tr>`).join('')}</table>`;
  }

  P.kopiruj = (vyjmout, cd) => {
    if (P.st.objekt) { P.kopirujObjekt?.(vyjmout); return; }
    if (oblasti().length > 1) { zprava(P.koren, 'Tento příkaz nelze použít pro vícenásobný výběr.'); return; }
    if (vyjmout && !kontrolaZamku()) return;
    const sn = snimekOblasti(L(), oblast());
    sn.vyjmout = vyjmout;
    P.schranka = sn;
    g.kopie = { list: L(), oblast: sn.oblast };
    try {
      if (cd) { cd.setData('text/plain', sn.text); cd.setData('text/html', htmlOblasti(sn)); }
      else navigator.clipboard?.writeText(sn.text).catch(() => {});
    } catch { /* schránka nedostupná */ }
    P.poZmeneSchranky?.();
    g.prekresli();
  };
  const pripravSchranku = () => { g.fokus(); g.klav.value = '​'; g.klav.select(); };
  P.vyjmout = () => { pripravSchranku(); if (!document.execCommand('cut') || !P.schranka) P.kopiruj(true); };
  P.kopirovat = () => { pripravSchranku(); if (!document.execCommand('copy') || !P.schranka) P.kopiruj(false); };

  P.vlozZeSchranky = (cd) => {
    if (!kontrolaZamku()) return;
    if (P.st.objekt || (P.schrankaObjekt && !g.kopie && !cd?.getData('text/plain'))) { if (P.vlozObjekt?.()) return; }
    const text = cd?.getData('text/plain') ?? null;
    const norm = (t) => (t || '').replace(/\r/g, '').trim();
    if (P.schranka && (text === null || norm(text) === norm(P.schranka.text))) { P.vlozVnitrni(P.schranka, 'vse'); return; }
    const obr = cd && [...(cd.items || [])].find((i) => i.type.startsWith('image/'));
    if (obr) { P.vlozObrazekSoubor?.(obr.getAsFile()); return; }
    const html = cd?.getData('text/html');
    if (html && /<table/i.test(html)) { P.vlozHtml(html); return; }
    if (text) P.vlozText(text);
  };
  P.vlozit = async (rezim = 'vse') => {
    if (P.schranka) { P.vlozVnitrni(P.schranka, rezim); return; }
    try { const t = await navigator.clipboard.readText(); if (t) P.vlozText(t, rezim === 'hodnoty'); }
    catch { zprava(P.koren, 'Prohlížeč nedovolil číst schránku. Vložte obsah klávesami Ctrl+V.'); }
  };

  P.vlozText = (text, jenHodnoty = false) => {
    const odd = text.includes('\t') ? '\t' : uhodniOddelovac(text) === ';' && text.includes(';') ? ';' : '\t';
    const radky = rozdelCsv(text.replace(/\r?\n$/, ''), odd);
    const v = V();
    const r0 = oblast().r1, c0 = oblast().c1;
    P.prikaz('Vložit', () => {
      radky.forEach((radek, i) => radek.forEach((t, j) => {
        if (jenHodnoty) { const b = L().b.get(klic(r0 + i, c0 + j)) || {}; S().zapis(L(), r0 + i, c0 + j, { ...b, v: t === '' ? null : rozpoznej(t).v ?? t, f: null }); }
        else S().zadej(L(), r0 + i, c0 + j, t);
      }));
    });
    const w = Math.max(...radky.map((r) => r.length));
    g.vyberOblast({ r1: r0, c1: c0, r2: r0 + radky.length - 1, c2: c0 + w - 1 }, { r: v.r, c: v.c });
    P.ukazMoznostiVlozeni();
  };
  P.vlozHtml = (html) => {
    const d = new DOMParser().parseFromString(html, 'text/html');
    const tab = d.querySelector('table');
    if (!tab) return;
    const r0 = oblast().r1, c0 = oblast().c1;
    const trs = [...tab.querySelectorAll('tr')];
    P.prikaz('Vložit', () => {
      trs.forEach((tr, i) => {
        let j = 0;
        for (const td of tr.querySelectorAll('td, th')) {
          const t = td.innerText.replace(/ /g, ' ').trim();
          if (t !== '') S().zadej(L(), r0 + i, c0 + j, t);
          const cs = td.getAttribute('style') || '';
          const z = {};
          if (/font-weight:\s*(bold|[6-9]00)/i.test(cs) || td.tagName === 'TH' || td.querySelector('b, strong')) z.b = true;
          if (/font-style:\s*italic/i.test(cs) || td.querySelector('i, em')) z.i = true;
          const bg = /background(?:-color)?:\s*(#[0-9a-f]{6}|#[0-9a-f]{3}|rgb\([^)]+\))/i.exec(cs);
          if (bg) z.pozadi = naHex(bg[1]);
          const col = /(?:^|;)\s*color:\s*(#[0-9a-f]{6}|#[0-9a-f]{3}|rgb\([^)]+\))/i.exec(cs);
          if (col) z.barva = naHex(col[1]);
          if (Object.keys(z).length) S().stylOblasti(L(), [{ r1: r0 + i, c1: c0 + j, r2: r0 + i, c2: c0 + j }], z);
          j += +(td.getAttribute('colspan') || 1);
        }
      });
    });
    const w = Math.max(...trs.map((tr) => tr.querySelectorAll('td, th').length));
    g.vyberOblast({ r1: r0, c1: c0, r2: r0 + trs.length - 1, c2: c0 + w - 1 });
  };

  /**
   * Vložení z vlastní schránky. rezim: vse | hodnoty | hodnotyFormaty | vzorce | vzorceFormaty | formaty | bezOhraniceni | sirky | vseSirky | propojit
   * o: { transponovat, operace: 'pricist'|'odecist'|'nasobit'|'delit', preskocitPrazdne }
   */
  P.vlozVnitrni = (sn, rezim = 'vse', o = {}) => {
    const R = sn.bunky.length, C = sn.bunky[0]?.length || 0;
    if (!R || !C) return;
    const [RR, CC] = o.transponovat ? [C, R] : [R, C];
    const cil = oblast();
    const tr = cil.r2 - cil.r1 + 1, tc = cil.c2 - cil.c1 + 1;
    let opakR = 1, opakC = 1;
    if (!sn.vyjmout && tr % RR === 0 && tc % CC === 0 && (tr > RR || tc > CC) && tr < 100000) { opakR = tr / RR; opakC = tc / CC; }
    const r0 = cil.r1, c0 = cil.c1;
    if (sn.vyjmout) {
      if (sn.list === L()) P.presunOblast(sn.oblast, { r1: r0, c1: c0, r2: r0 + R - 1, c2: c0 + C - 1 }, { kopie: false, bezDotazu: true });
      else presunMeziListy(sn, r0, c0);
      P.schranka = null;
      g.kopie = null;
      return;
    }
    const cilova = { r1: r0, c1: c0, r2: r0 + RR * opakR - 1, c2: c0 + CC * opakC - 1 };
    if (L().tabulky.some((t) => prekryva(t.oblast, cilova) && !(obsahuje(t.oblast, cilova.r1, cilova.c1) && obsahuje(t.oblast, cilova.r2, cilova.c2))) && rezim === 'vse') { /* Excel to dovolí, tabulka se rozšíří */ }
    P.prikaz('Vložit', () => {
      for (let pr = 0; pr < opakR; pr++) for (let pc = 0; pc < opakC; pc++) {
        for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) {
          const x = sn.bunky[i][j];
          const [ti, tj] = o.transponovat ? [j, i] : [i, j];
          const r = r0 + pr * RR + ti, c = c0 + pc * CC + tj;
          if (r >= MAX_R || c >= MAX_C) continue;
          const puvodni = L().b.get(klic(r, c)) || {};
          const prazdny = !x.b || (!x.b.f && (x.b.v === null || x.b.v === undefined));
          if (o.preskocitPrazdne && prazdny) continue;
          const f = x.b?.f ? posunVzorec(x.b.f, r - x.r, c - x.c) : null;
          let nova;
          switch (rezim) {
            case 'hodnoty': nova = { ...puvodni, v: x.v, f: null }; break;
            case 'hodnotyFormaty': nova = { ...puvodni, v: x.v, f: null, s: x.s ? slozStyl(puvodni.s, { nf: x.s.nf || null }) : puvodni.s }; break;
            case 'hodnotyZdroj': nova = { ...puvodni, v: x.v, f: null, s: x.s }; break;
            case 'vzorce': nova = { ...puvodni, v: f ? null : x.b?.v ?? null, f }; break;
            case 'vzorceFormaty': nova = { ...puvodni, v: f ? null : x.b?.v ?? null, f, s: x.s ? slozStyl(puvodni.s, { nf: x.s.nf || null }) : puvodni.s }; break;
            case 'formaty': nova = { ...puvodni, s: x.s }; break;
            case 'bezOhraniceni': nova = { ...(x.b || {}), f, s: x.s ? slozStyl(x.s, { ohr: null }) : null }; break;
            case 'propojit': {
              const pref = sn.list !== L() ? jmenoListuVeVzorci(sn.list.nazev) + '!' : '';
              nova = { ...puvodni, f: `=${pref}${adresa(x.r, x.c)}`, v: null };
              break;
            }
            case 'sirky': nova = null; break;
            default: nova = { ...(x.b || {}), f, s: x.s };
          }
          if (o.operace && typeof x.v === 'number') {
            const a = S().hodnota(L(), r, c);
            const an = typeof a === 'number' ? a : 0;
            const vys = { pricist: an + x.v, odecist: an - x.v, nasobit: an * x.v, delit: x.v ? an / x.v : null }[o.operace];
            nova = { ...puvodni, v: vys, f: null };
          }
          if (nova) S().zapis(L(), r, c, nova);
        }
        if (rezim === 'vse' || rezim === 'vseSirky' || rezim === 'bezOhraniceni') {
          for (const m of sn.sloucene) {
            const [a, b] = o.transponovat ? [[m.c1 - sn.oblast.c1, m.r1 - sn.oblast.r1], [m.c2 - sn.oblast.c1, m.r2 - sn.oblast.r1]] : [[m.r1 - sn.oblast.r1, m.c1 - sn.oblast.c1], [m.r2 - sn.oblast.r1, m.c2 - sn.oblast.c1]];
            S().sluc(L(), { r1: r0 + pr * RR + a[0], c1: c0 + pc * CC + a[1], r2: r0 + pr * RR + b[0], c2: c0 + pc * CC + b[1] }, 'bunky');
          }
        }
      }
      if (rezim === 'sirky' || rezim === 'vseSirky') sn.sirky.forEach((w, j) => { if (w !== null) L().sirky.set(c0 + j, w); else L().sirky.delete(c0 + j); });
    });
    g.vyberOblast(cilova, { r: r0, c: c0 });
    P.ukazMoznostiVlozeni(sn);
  };

  function presunMeziListy(sn, r0, c0) {
    const zdroj = sn.list;
    P.prikaz('Vložit', () => {
      sn.bunky.forEach((radek, i) => radek.forEach((x, j) => {
        const b = x.b ? { ...x.b } : null;
        S().zapis(L(), r0 + i, c0 + j, b ? { ...b, s: x.s } : null);
        zdroj.b.delete(klic(x.r, x.c));
      }));
    });
    g.vyberOblast({ r1: r0, c1: c0, r2: r0 + sn.bunky.length - 1, c2: c0 + sn.bunky[0].length - 1 });
  }

  /** Tlačítko „Možnosti vložení (Ctrl)“ u vložené oblasti. */
  P.ukazMoznostiVlozeni = (sn) => {
    const b = g.chytry;
    const o = g.obdelnik(oblast());
    if (!o) return;
    b.replaceChildren(ik('vlozit'), ik('sipkaDolu'));
    b.title = 'Možnosti vložení (Ctrl)';
    b.style.left = Math.min(g.sirka - 40, o.x + o.w + 2) + 'px';
    b.style.top = Math.min(g.vyska - 24, o.y + o.h + 2) + 'px';
    b.hidden = false;
    b.onclick = () => {
      if (!sn) { b.hidden = true; return; }
      const znovu = (rezim, op = {}) => () => { P.zpet(); g.vyberOblast({ r1: oblast().r1, c1: oblast().c1, r2: oblast().r1, c2: oblast().c1 }); P.vlozVnitrni(sn, rezim, op); };
      rozbal(b, nabidka([
        { nadpis: 'Vložit' },
        { text: 'Vložit', ikona: 'vlozit', akce: znovu('vse') },
        { text: 'Vzorce', akce: znovu('vzorce') },
        { text: 'Vzorce a formátování čísel', akce: znovu('vzorceFormaty') },
        { text: 'Zachovat formátování zdroje', akce: znovu('vse') },
        { text: 'Bez ohraničení', akce: znovu('bezOhraniceni') },
        { text: 'Zachovat šířky zdrojových sloupců', akce: znovu('vseSirky') },
        { text: 'Transponovat', akce: znovu('vse', { transponovat: true }) },
        { nadpis: 'Vložit hodnoty' },
        { text: 'Hodnoty', akce: znovu('hodnoty') },
        { text: 'Hodnoty a formátování čísel', akce: znovu('hodnotyFormaty') },
        { text: 'Hodnoty a formátování zdroje', akce: znovu('hodnotyZdroj') },
        { nadpis: 'Další možnosti vložení' },
        { text: 'Formátování', akce: znovu('formaty') },
        { text: 'Vložit propojení', akce: znovu('propojit') },
      ], { sirka: 260 }));
    };
  };

  // ------------------------------------------------------------ přesun tažením
  P.presunOblast = async (zdroj, cil, { kopie = false, bezDotazu = false } = {}) => {
    const l = L();
    if (!kontrolaZamku()) return;
    if (!kopie && !bezDotazu) {
      let plne = false;
      for (let r = cil.r1; r <= cil.r2 && !plne; r++) for (let c = cil.c1; c <= cil.c2; c++) {
        if (obsahuje(zdroj, r, c)) continue;
        if (S().hodnota(l, r, c) !== null) { plne = true; break; }
      }
      if (plne) {
        const ok = await new Promise((hotovo) => dialog(P.koren, { titulek: 'AstroTabulky', obsah: el('p.ps-zprava', { text: 'Tady už nějaká data jsou. Chcete je nahradit?' }), tlacitka: [{ text: 'OK', primarni: true, akce: () => hotovo(true) }, { text: 'Zrušit', akce: () => hotovo(false) }], pri_zavreni: () => hotovo(false) }));
        if (!ok) return;
      }
    }
    const dr = cil.r1 - zdroj.r1, dc = cil.c1 - zdroj.c1;
    P.prikaz(kopie ? 'Kopírovat' : 'Přesunout', () => {
      const bunky = [];
      for (const k of S().kliceVOblasti(l, zdroj)) { const [r, c] = zKlice(k); bunky.push([r, c, l.b.get(k)]); }
      const sloucene = l.sloucene.filter((m) => obsahuje(zdroj, m.r1, m.c1));
      if (!kopie) {
        for (const [r, c] of bunky) l.b.delete(klic(r, c));
        l.sloucene = l.sloucene.filter((m) => !obsahuje(zdroj, m.r1, m.c1));
      }
      // cíl vyčistit
      for (const k of S().kliceVOblasti(l, cil)) l.b.delete(k);
      l.sloucene = l.sloucene.filter((m) => !prekryva(m, cil));
      for (const [r, c, b] of bunky) {
        const nb = kopie && b.f ? { ...b, f: posunVzorec(b.f, dr, dc) } : b;
        l.b.set(klic(r + dr, c + dc), Object.freeze({ ...nb }));
      }
      for (const m of sloucene) l.sloucene.push({ r1: m.r1 + dr, r2: m.r2 + dr, c1: m.c1 + dc, c2: m.c2 + dc });
      if (!kopie) S().prepisVzorce((t, lv) => upravPoPresunu(t, { z: zdroj, dr, dc, naListu: l.nazev, listVzorce: lv.nazev }));
    });
    g.vyberOblast(cil, { r: V().r + dr, c: V().c + dc });
  };

  // ------------------------------------------------------------ vyplnění
  P.vypln = (zdroj, cil, o = {}) => {
    if (!kontrolaZamku()) return;
    P.prikaz('Automatické vyplňování', () => S().vypln(L(), zdroj, cil, o));
    g.vyberOblast(cil, { r: V().r, c: V().c });
    ukazMoznostiVyplneni(zdroj, cil, o);
  };
  P.nahledVyplneni = (zdroj, cil, ctrl) => {
    try { return S().vypln(L(), zdroj, cil, { kopie: ctrl, nahled: true }); } catch { return null; }
  };
  function ukazMoznostiVyplneni(zdroj, cil) {
    const b = g.chytry;
    const o = g.obdelnik(cil);
    if (!o) return;
    b.replaceChildren(ik('vypln'), ik('sipkaDolu'));
    b.title = 'Možnosti automatického vyplňování';
    b.style.left = Math.min(g.sirka - 40, o.x + o.w + 2) + 'px';
    b.style.top = Math.min(g.vyska - 24, o.y + o.h + 2) + 'px';
    b.hidden = false;
    const datum = jeDatovyFormat(S().stylBunky(L(), zdroj.r1, zdroj.c1)?.nf || '');
    b.onclick = () => {
      const znovu = (op) => () => { P.zpet(); P.prikaz('Automatické vyplňování', () => S().vypln(L(), zdroj, cil, op)); g.vyberOblast(cil); };
      rozbal(b, nabidka([
        { text: 'Kopírovat buňky', akce: znovu({ rada: { typ: 'kopie' } }) },
        { text: 'Vyplnit řady', akce: znovu({ kopie: false, rada: { krok: 1 } }) },
        { text: 'Vyplnit pouze formáty', akce: znovu({ jenFormat: true }) },
        { text: 'Vyplnit bez formátování', akce: znovu({ bezFormatu: true }) },
        ...(datum ? ['sep',
          { text: 'Vyplnit dny', akce: znovu({ rada: { jednotka: 'den', krok: 1 } }) },
          { text: 'Vyplnit pracovní dny', akce: znovu({ rada: { jednotka: 'den', krok: 1, pracovni: true } }) },
          { text: 'Vyplnit měsíce', akce: znovu({ rada: { jednotka: 'mesic', krok: 1 } }) },
          { text: 'Vyplnit roky', akce: znovu({ rada: { jednotka: 'rok', krok: 1 } }) }] : []),
        'sep',
        { text: 'Dynamické doplňování', akce: () => P.dynamickeDoplnovani() },
      ], { sirka: 230 }));
    };
  }
  P.vyplnDvojklikem = () => {
    const o = oblast();
    const l = L();
    // délka podle sousedního sloupce vlevo (nebo vpravo)
    let konec = -1;
    for (const c of [o.c1 - 1, o.c2 + 1]) {
      if (c < 0) continue;
      if (S().hodnota(l, o.r2 + 1, c) === null) continue;
      let r = o.r2 + 1;
      while (r + 1 < MAX_R && S().hodnota(l, r + 1, c) !== null) r++;
      konec = r;
      break;
    }
    if (konec < 0) {
      // v tabulce do konce tabulky
      const t = S().tabulkaV(l, o.r1, o.c1);
      if (t) konec = oblastDatTabulky(t).r2;
    }
    if (konec <= o.r2) return;
    P.vypln(o, { ...o, r2: konec });
  };
  P.vyplnit = (smer) => {
    const o = oblast();
    if (smer === 'rada') { D.dialogRada(P); return; }
    let zdroj, cil = o;
    if (smer === 'dolu') { if (o.r1 === o.r2) { if (!o.r1) return; cil = { ...o, r1: o.r1 - 1 }; } zdroj = { ...cil, r2: cil.r1 }; }
    else if (smer === 'vpravo') { if (o.c1 === o.c2) { if (!o.c1) return; cil = { ...o, c1: o.c1 - 1 }; } zdroj = { ...cil, c2: cil.c1 }; }
    else if (smer === 'nahoru') zdroj = { ...o, r1: o.r2 };
    else zdroj = { ...o, c1: o.c2 };
    P.prikaz(smer === 'dolu' ? 'Vyplnit dolů' : smer === 'vpravo' ? 'Vyplnit doprava' : 'Vyplnit', () => S().vypln(L(), zdroj, cil, { rada: { typ: 'kopie' } }));
  };

  /** Dynamické doplňování (Flash Fill): odhadne vzor z vyplněných řádků. */
  P.dynamickeDoplnovani = () => {
    const l = L(), v = V();
    const c = v.c;
    const oblast = S().aktualniOblast(l, v.r, c - 1 >= 0 ? c - 1 : c);
    const vzory = [];
    for (let r = oblast.r1; r <= oblast.r2; r++) {
      const cil = S().hodnota(l, r, c);
      if (cil !== null && typeof cil === 'string') vzory.push({ r, cil });
    }
    if (!vzory.length) { zprava(P.koren, 'Vzor pro dynamické doplňování se nenašel. Zadejte příklad výsledku do prvního řádku a zkuste to znovu.'); return; }
    const zdrojText = (r) => { const a = []; for (let cc = oblast.c1; cc < c; cc++) a.push(S().textBunky(l, r, cc)); return a; };
    // kandidáti transformací
    const kandidati = [];
    const n = c - oblast.c1;
    for (let i = 0; i < n; i++) {
      kandidati.push((a) => a[i]);
      kandidati.push((a) => a[i]?.split(/\s+/)[0]);
      kandidati.push((a) => a[i]?.split(/\s+/).slice(-1)[0]);
      kandidati.push((a) => a[i]?.split(/[@.,;-]/)[0]);
      kandidati.push((a) => a[i]?.toLocaleUpperCase('cs'));
      kandidati.push((a) => a[i]?.toLocaleLowerCase('cs'));
      kandidati.push((a) => a[i]?.split(/\s+/).map((w) => w[0]).join(''));
      kandidati.push((a) => (a[i]?.split('@')[1] || null));
      kandidati.push((a) => a[i]?.replace(/\D/g, ''));
      for (let j = 0; j < n; j++) if (i !== j) {
        for (const odd of [' ', ', ', '.', '', '-', '_']) {
          kandidati.push((a) => (a[i] && a[j] ? a[i] + odd + a[j] : null));
          kandidati.push((a) => (a[i] && a[j] ? a[i].split(/\s+/)[0] + odd + a[j].split(/\s+/)[0] : null));
          kandidati.push((a) => (a[i] && a[j] ? (a[i][0] + odd + a[j]).toLocaleLowerCase('cs') : null));
          kandidati.push((a) => (a[i] && a[j] ? (a[i] + odd + a[j]).toLocaleLowerCase('cs') : null));
        }
      }
    }
    kandidati.push((a) => a.filter(Boolean).join(' '));
    const f = kandidati.find((k) => vzory.every((x) => { try { return k(zdrojText(x.r)) === x.cil; } catch { return false; } }));
    if (!f) { zprava(P.koren, 'Vzor pro dynamické doplňování se nenašel. Zadejte další příklad a zkuste to znovu.'); return; }
    let pocet = 0;
    P.prikaz('Dynamické doplňování', () => {
      for (let r = oblast.r1; r <= oblast.r2; r++) {
        if (S().hodnota(l, r, c) !== null) continue;
        const a = zdrojText(r);
        if (!a.some(Boolean)) continue;
        const t = f(a);
        if (t) { S().zapis(l, r, c, { ...(l.b.get(klic(r, c)) || {}), v: t }); pocet++; }
      }
    });
    P.toast(`Dynamické doplňování změnilo ${pocet} ${pocet === 1 ? 'buňku' : pocet < 5 ? 'buňky' : 'buněk'}.`);
  };

  // ------------------------------------------------------------ automatické shrnutí
  P.autoSuma = (fn = 'SUMA') => {
    if (!kontrolaZamku()) return;
    const l = L(), v = V(), o = oblast();
    const jedna = o.r1 === o.r2 && o.c1 === o.c2;
    if (jedna) {
      // najít souvislá čísla nad (nebo vlevo od) buňky
      let r = v.r - 1;
      while (r >= 0 && S().hodnota(l, r, v.c) === null) r--;
      let r1 = r;
      while (r1 - 1 >= 0 && typeof S().hodnota(l, r1 - 1, v.c) === 'number') r1--;
      let text;
      if (r >= 0 && typeof S().hodnota(l, r, v.c) === 'number') text = `=${fn}(${textOblasti({ r1, c1: v.c, r2: r, c2: v.c })})`;
      else {
        let c = v.c - 1;
        while (c >= 0 && S().hodnota(l, v.r, c) === null) c--;
        let c1 = c;
        while (c1 - 1 >= 0 && typeof S().hodnota(l, v.r, c1 - 1) === 'number') c1--;
        text = c >= 0 && typeof S().hodnota(l, v.r, c) === 'number' ? `=${fn}(${textOblasti({ r1: v.r, c1, r2: v.r, c2: c })})` : `=${fn}()`;
      }
      g.zacniEditaci('upravit', text);
      if (!g.edit) return;
      // stříška před závorku a navržená oblast jako „ukazovaný“ odkaz — šipky nebo myš ji hned přepíšou
      const m = /\(([^)]*)\)$/.exec(text);
      const konec = text.length - 1;
      setCaret(g.editor, konec);
      if (m && m[1]) { g.edit.ukaz = { a: konec - m[1].length, b: konec }; g.vlozOdkaz(rozeberOblast(m[1])); }
      return;
    }
    // oblast: součet pod každým sloupcem (a vpravo, když je výběr širší)
    P.prikaz('Automatické shrnutí', () => {
      const posledniPlny = (() => { for (let r = o.r2; r >= o.r1; r--) for (let c = o.c1; c <= o.c2; c++) if (S().hodnota(l, r, c) !== null) return r; return o.r1; })();
      const cilR = S().hodnota(l, o.r2, o.c1) === null && o.r2 > posledniPlny ? o.r2 : o.r2 + 1;
      for (let c = o.c1; c <= o.c2; c++) {
        const cisla = [];
        for (let r = o.r1; r < cilR; r++) if (typeof S().hodnota(l, r, c) === 'number') cisla.push(r);
        if (!cisla.length) continue;
        S().zadej(l, cilR, c, `=${fn}(${textOblasti({ r1: o.r1, c1: c, r2: cilR - 1, c2: c })})`);
      }
    });
  };

  // ------------------------------------------------------------ řazení a filtr
  function odhadniZahlavi(l, o) {
    if (o.r1 === o.r2) return false;
    const prvni = [], druha = [];
    for (let c = o.c1; c <= Math.min(o.c2, o.c1 + 40); c++) { prvni.push(S().hodnota(l, o.r1, c)); druha.push(S().hodnota(l, o.r1 + 1, c)); }
    const textovy = prvni.every((v) => typeof v === 'string' || v === null) && prvni.some((v) => typeof v === 'string');
    const tucny = S().stylBunky(l, o.r1, o.c1)?.b && !S().stylBunky(l, o.r1 + 1, o.c1)?.b;
    return textovy && (druha.some((v) => typeof v !== 'string' && v !== null) || tucny);
  }
  P.odhadniZahlavi = odhadniZahlavi;

  /** Oblast dat pro řazení/filtr/graf: výběr, nebo aktuální oblast okolo buňky. */
  P.oblastDat = () => {
    const l = L(), v = V(), o = oblast();
    const t = S().tabulkaV(l, v.r, v.c);
    if (t) return { oblast: { ...t.oblast, r2: t.souhrn ? t.oblast.r2 - 1 : t.oblast.r2 }, zahlavi: true, tabulka: t };
    if (l.filtr && obsahuje(l.filtr.oblast, v.r, v.c)) return { oblast: l.filtr.oblast, zahlavi: true, filtr: true };
    if (o.r1 !== o.r2 || o.c1 !== o.c2) {
      const u = S().rozsahDat(l);
      const oo = { ...o, r2: Math.min(o.r2, u.r), c2: Math.min(o.c2, u.c) };
      return { oblast: oo, zahlavi: odhadniZahlavi(l, oo) };
    }
    const a = S().aktualniOblast(l, v.r, v.c);
    return { oblast: a, zahlavi: odhadniZahlavi(l, a) };
  };

  P.seradit = (klice, o, zahlavi, popis = 'Seřadit') => {
    if (!kontrolaZamku('razeni')) return;
    const l = L();
    if (l.sloucene.some((m) => prekryva(m, o) && !(m.r1 === m.r2))) { zprava(P.koren, 'Aby to šlo, musí mít všechny sloučené buňky stejnou velikost.'); return; }
    P.prikaz(popis, () => {
      S().serad(l, o, klice, { zahlavi });
      const f = l.filtr && prekryva(l.filtr.oblast, o) ? l.filtr : S().tabulkaV(l, o.r1, o.c1)?.filtr;
      if (f && klice.length) f.razeni = { c: klice[0].c, vzestupne: klice[0].vzestupne !== false };
    });
  };
  P.seraditRychle = (vzestupne) => {
    const d = P.oblastDat();
    if (d.oblast.r1 === d.oblast.r2 && S().hodnota(L(), d.oblast.r1, d.oblast.c1) === null) { zprava(P.koren, 'Tento příkaz nelze použít pro vybranou oblast. Vyberte jednu buňku v oblasti a zkuste to znovu.'); return; }
    const c = V().c >= d.oblast.c1 && V().c <= d.oblast.c2 ? V().c : d.oblast.c1;
    P.seradit([{ c, vzestupne }], d.oblast, d.zahlavi, vzestupne ? 'Seřadit od A do Z' : 'Seřadit od Z do A');
  };

  P.filtr = () => {
    if (!kontrolaZamku('filtr')) return;
    const l = L(), v = V();
    const t = S().tabulkaV(l, v.r, v.c);
    if (t) { P.prikaz('Filtr', () => { const x = l.tabulky.find((y) => y.nazev === t.nazev); x.filtrTl = !x.filtrTl; if (!x.filtrTl) x.filtr = { podminky: {} }; }, { prepocet: false }); return; }
    if (l.filtr) { P.prikaz('Filtr', () => { l.filtr = null; l.skryteFiltrem = new Set(); }, { prepocet: false }); return; }
    const d = P.oblastDat();
    if (d.oblast.r1 === d.oblast.r2 && S().hodnota(l, d.oblast.r1, d.oblast.c1) === null) { zprava(P.koren, 'Tento příkaz nelze použít pro vybranou oblast. Vyberte jednu buňku v oblasti a zkuste to znovu.'); return; }
    P.prikaz('Filtr', () => { l.filtr = { oblast: { ...d.oblast }, podminky: {} }; }, { prepocet: false });
  };
  P.vymazatFiltr = () => {
    const l = L();
    P.prikaz('Vymazat filtr', () => {
      if (l.filtr) l.filtr.podminky = {};
      for (const t of l.tabulky) if (t.filtr) t.filtr.podminky = {};
      l.skryteFiltrem = new Set();
    }, { prepocet: false });
  };
  P.znovuPouzitFiltr = () => { S().pouzijFiltr(L()); g.prekresli(); P.obnovObjekty?.(); };
  P.nastavFiltr = (zdroj, c, podminka) => {
    const l = L();
    P.prikaz('Filtr', () => {
      const f = zdroj === 'filtr' ? l.filtr : l.tabulky.find((t) => t.nazev === zdroj.nazev)?.filtr;
      if (!f) return;
      if (podminka) f.podminky[c] = podminka; else delete f.podminky[c];
    }, { prepocet: false });
    P.obnovObjekty?.();
  };

  /** Rozbalovací nabídka filtru ve sloupci (jako Excel). */
  P.nabidkaFiltru = (z, e) => {
    const l = L();
    const zdroj = z.zdroj;
    const c = z.c;
    const f = zdroj === 'filtr' ? l.filtr : l.tabulky.find((t) => t.nazev === zdroj.nazev)?.filtr;
    const o = zdroj === 'filtr' ? l.filtr.oblast : { ...zdroj.oblast, r2: zdroj.souhrn ? zdroj.oblast.r2 - 1 : zdroj.oblast.r2 };
    const nazevSloupce = String(S().hodnota(l, o.r1, c) ?? pismena(c));
    // hodnoty sloupce (bez ohledu na ostatní filtry by bylo jednodušší, Excel ale ukazuje jen viditelné podle ostatních filtrů)
    const hodnoty = new Map();
    let cisla = 0, data = 0, texty = 0;
    for (let r = o.r1 + 1; r <= o.r2; r++) {
      const jinyFiltr = Object.entries(f.podminky || {}).some(([cc, p]) => +cc !== c && p && l.skryteFiltrem.has(r));
      if (jinyFiltr) continue;
      const v = S().hodnota(l, r, c);
      const t = v === null || v === '' ? '' : S().textBunky(l, r, c);
      if (typeof v === 'number') { if (jeDatovyFormat(S().stylBunky(l, r, c)?.nf || '')) data++; else cisla++; } else if (typeof v === 'string') texty++;
      if (!hodnoty.has(t)) hodnoty.set(t, v);
    }
    const typ = data > cisla && data >= texty ? 'data' : cisla > texty ? 'cisla' : 'text';
    const serazene = [...hodnoty.entries()].sort((a, b) => {
      if (a[0] === '') return 1;
      if (b[0] === '') return -1;
      if (typeof a[1] === 'number' && typeof b[1] === 'number') return a[1] - b[1];
      return String(a[0]).localeCompare(String(b[0]), 'cs', { numeric: true });
    });
    const akt = f.podminky?.[c];
    const vybrane = new Set(akt?.hodnoty || serazene.map((x) => x[0]));
    const hledat = el('input.ps-vstup.tb-filtr-hledat', { type: 'search', placeholder: 'Hledat' });
    const seznam = el('div.tb-filtr-seznam');
    const kresliSeznam = () => {
      const q = hledat.value.trim().toLocaleLowerCase('cs');
      const vidit = serazene.filter(([t]) => !q || (t || '(Prázdné)').toLocaleLowerCase('cs').includes(q));
      const vse = el('input', { type: 'checkbox' });
      vse.checked = vidit.every(([t]) => vybrane.has(t));
      vse.indeterminate = !vse.checked && vidit.some(([t]) => vybrane.has(t));
      vse.onchange = () => { for (const [t] of vidit) { if (vse.checked) vybrane.add(t); else vybrane.delete(t); } kresliSeznam(); };
      seznam.replaceChildren(
        el('label.tb-filtr-pol', {}, vse, el('span', { text: q ? '(Vybrat všechny výsledky hledání)' : '(Vybrat vše)' })),
        ...vidit.slice(0, 1000).map(([t]) => {
          const ch = el('input', { type: 'checkbox' });
          ch.checked = vybrane.has(t);
          ch.onchange = () => { if (ch.checked) vybrane.add(t); else vybrane.delete(t); kresliSeznam(); };
          return el('label.tb-filtr-pol', {}, ch, el('span', { text: t === '' ? '(Prázdné)' : t }));
        }));
    };
    hledat.addEventListener('input', kresliSeznam);
    hledat.addEventListener('keydown', (ev) => ev.stopPropagation());
    kresliSeznam();
    const podmenu = (polozky) => (ev) => { ev.stopPropagation(); const kotva = ev.currentTarget; rozbal(kotva, nabidka(polozky, { sirka: 220 }), {}); };
    const vlastni = (op) => () => D.dialogVlastniFiltr(P, zdroj, c, typ, op);
    const barvyVyplne = [...new Set([...Array(o.r2 - o.r1)].map((_, i) => S().stylBunky(l, o.r1 + 1 + i, c)?.pozadi || ''))];
    const menu = el('div.tb-filtr-menu', {},
      nabidka([
        { text: typ === 'cisla' ? 'Seřadit od nejmenšího k největšímu' : typ === 'data' ? 'Seřadit od nejstaršího k nejnovějšímu' : 'Seřadit od A do Z', ikona: 'seraditAZ', akce: () => P.seradit([{ c, vzestupne: true }], o, true) },
        { text: typ === 'cisla' ? 'Seřadit od největšího k nejmenšímu' : typ === 'data' ? 'Seřadit od nejnovějšího k nejstaršímu' : 'Seřadit od Z do A', ikona: 'seraditZA', akce: () => P.seradit([{ c, vzestupne: false }], o, true) },
        { text: 'Seřadit podle barvy', akce: () => D.dialogSeradit(P, { oblast: o, zahlavi: true, c }) },
        'sep',
        { text: `Vymazat filtr z „${nazevSloupce.slice(0, 24)}“`, ikona: 'filtrVymazat', zakazano: !akt, akce: () => P.nastavFiltr(zdroj, c, null) },
        { text: 'Filtrovat podle barvy', zakazano: barvyVyplne.length < 2, akce: () => {} },
      ], { sirka: 290 }),
      el('button.ps-nab-polozka.tb-sub', { type: 'button', onclick: podmenu(typ === 'cisla' ? [
        { text: 'Rovná se…', akce: vlastni('=') }, { text: 'Nerovná se…', akce: vlastni('<>') }, { text: 'Větší než…', akce: vlastni('>') },
        { text: 'Větší nebo rovno…', akce: vlastni('>=') }, { text: 'Menší než…', akce: vlastni('<') }, { text: 'Menší nebo rovno…', akce: vlastni('<=') },
        { text: 'Mezi…', akce: vlastni('mezi') }, { text: 'Prvních 10…', akce: () => P.nastavFiltr(zdroj, c, { prvnich: { n: 10, horni: true } }) },
        { text: 'Nad průměrem', akce: () => { const x = [...hodnoty.values()].filter((y) => typeof y === 'number'); const pr = x.reduce((a, b) => a + b, 0) / (x.length || 1); P.nastavFiltr(zdroj, c, { podminka: { a: { op: '>', v: String(pr).replace('.', ',') } } }); } },
        { text: 'Pod průměrem', akce: () => { const x = [...hodnoty.values()].filter((y) => typeof y === 'number'); const pr = x.reduce((a, b) => a + b, 0) / (x.length || 1); P.nastavFiltr(zdroj, c, { podminka: { a: { op: '<', v: String(pr).replace('.', ',') } } }); } },
        'sep', { text: 'Vlastní filtr…', akce: vlastni('=') },
      ] : [
        { text: 'Rovná se…', akce: vlastni('=') }, { text: 'Nerovná se…', akce: vlastni('<>') }, { text: 'Začíná na…', akce: vlastni('zacina') },
        { text: 'Končí na…', akce: vlastni('konci') }, { text: 'Obsahuje…', akce: vlastni('obsahuje') }, { text: 'Neobsahuje…', akce: vlastni('neobsahuje') },
        'sep', { text: 'Vlastní filtr…', akce: vlastni('=') },
      ]) }, el('span.ps-nab-ik'), el('span.ps-nab-text', { text: typ === 'cisla' ? 'Filtry čísel' : typ === 'data' ? 'Filtry kalendářních dat' : 'Filtry textu' }), el('span.tb-sub-sipka', { text: '›' })),
      el('div.tb-filtr-telo', {}, hledat, seznam),
      el('div.tb-filtr-pata', {},
        el('button.ps-tlac.primarni', { type: 'button', text: 'OK', onclick: () => {
          zavriRozbal();
          const vse = serazene.every(([t]) => vybrane.has(t));
          P.nastavFiltr(zdroj, c, vse ? null : { hodnoty: [...vybrane] });
        } }),
        el('button.ps-tlac', { type: 'button', text: 'Zrušit', onclick: () => zavriRozbal() })));
    const kotva = el('div', { style: { position: 'fixed', left: (g.scroll.getBoundingClientRect().left + z.kotva.x) + 'px', top: (g.scroll.getBoundingClientRect().top + z.kotva.y) + 'px', width: '1px', height: '1px' } });
    document.body.append(kotva);
    rozbal(kotva, menu, { poZavreni: () => kotva.remove(), tema: P.koren.dataset.motiv, app: 'tabulky' });
    setTimeout(() => hledat.focus(), 40);
  };

  // ------------------------------------------------------------ ověření dat
  P.chybaOvereni = (v, cb) => {
    const ch = v.chyba || {};
    const styl = ch.styl || 'stop';
    const text = ch.text || 'Tato hodnota neodpovídá omezením ověření dat definovaným pro tuto buňku.';
    const titulek = ch.titulek || 'AstroTabulky';
    const tlacitka = styl === 'stop'
      ? [{ text: 'Opakovat', primarni: true, akce: () => cb('znovu') }, { text: 'Zrušit', akce: () => cb('zrusit') }]
      : styl === 'varovani'
        ? [{ text: 'Ano', akce: () => cb('ano') }, { text: 'Ne', primarni: true, akce: () => cb('znovu') }, { text: 'Zrušit', akce: () => cb('zrusit') }]
        : [{ text: 'OK', primarni: true, akce: () => cb('ano') }, { text: 'Zrušit', akce: () => cb('zrusit') }];
    dialog(P.koren, {
      titulek, sirka: 420,
      obsah: el('div.tb-overeni-chyba', {}, el('span.tb-ov-ikona.' + styl, { text: styl === 'stop' ? '✕' : styl === 'varovani' ? '!' : 'i' }),
        el('div', {}, el('p', { text }), styl === 'varovani' ? el('p', { text: 'Chcete pokračovat?' }) : null)),
      tlacitka,
    });
  };
  P.seznamOvereni = () => {
    const l = L(), v = V();
    const val = S().validaceV(l, v.r, v.c);
    if (!val || val.typ !== 'seznam') return;
    const polozky = S().polozkySeznamu(l, val, v.r, v.c);
    const kotva = P.sipkaOvereni;
    rozbal(kotva || g.uzel, el('div.ps-nabidka.tb-seznam-overeni', {}, polozky.map((t) => el('button.ps-nab-polozka', {
      type: 'button', text: t,
      onclick: () => { zavriRozbal(); P.prikaz('Psaní', () => S().zadej(l, v.r, v.c, t)); g.fokus(); },
    }))), { app: 'tabulky' });
  };
  P.sipkaOvereni = el('button.tb-sipka-overeni', { type: 'button', hidden: true, title: 'Vybrat ze seznamu' }, ik('sipkaDolu'));
  g.uzel.append(P.sipkaOvereni);
  P.sipkaOvereni.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); });
  P.sipkaOvereni.onclick = () => P.seznamOvereni();
  P.umistiSipkuOvereni = () => {
    const l = L(), v = V();
    const val = l.validace.length ? S().validaceV(l, v.r, v.c) : null;
    const b = P.sipkaOvereni;
    if (!val || val.typ !== 'seznam' || val.sipka === false || g.edit) { b.hidden = true; return; }
    const o = g.obdelnik({ r1: v.r, c1: v.c, r2: v.r, c2: v.c });
    if (!o) { b.hidden = true; return; }
    b.style.left = (o.x + o.w + 1) + 'px';
    b.style.top = (o.y + o.h - 18) + 'px';
    b.hidden = false;
    // vstupní zpráva
    const z = P.zpravaOvereni || (P.zpravaOvereni = el('div.tb-vstupni-zprava', { hidden: true }));
    if (!z.isConnected) g.uzel.append(z);
  };
  const puvodniUmisteni = P.umistiSipkuOvereni;
  P.umistiSipkuOvereni = () => {
    puvodniUmisteni();
    const l = L(), v = V();
    const val = l.validace.length ? S().validaceV(l, v.r, v.c) : null;
    const z = P.zpravaOvereni;
    if (!z) return;
    if (val?.zprava?.text && !g.edit) {
      const o = g.obdelnik({ r1: v.r, c1: v.c, r2: v.r, c2: v.c });
      if (o) {
        z.replaceChildren(val.zprava.titulek ? el('b', { text: val.zprava.titulek }) : null, el('div', { text: val.zprava.text }));
        z.style.left = (o.x + 18) + 'px';
        z.style.top = (o.y + o.h + 4) + 'px';
        z.hidden = false;
        return;
      }
    }
    z.hidden = true;
  };

  // ------------------------------------------------------------ názvy a přechody
  P.nazevOblasti = (o) => {
    for (const d of P.S.nazvy.values()) {
      const x = rozeberOblast(d.vzorec.slice(1).replace(/\$/g, ''));
      if (!x) continue;
      const l = x.list ? S().listPodleJmena(x.list) : L();
      if (l === L() && x.r1 === o.r1 && x.r2 === o.r2 && x.c1 === o.c1 && x.c2 === o.c2) return d.nazev;
    }
    for (const t of L().tabulky) { const d = oblastDatTabulky(t); if (d.r1 === o.r1 && d.r2 === o.r2 && d.c1 === o.c1 && d.c2 === o.c2) return t.nazev; }
    return null;
  };
  P.prejdiNa = (text) => {
    if (!text) return;
    const s = S();
    // název / tabulka
    const d = s.najdiNazev(text, L());
    let cil = null;
    if (d) cil = rozeberOblast(d.vzorec.slice(1).replace(/\$/g, ''));
    const t = s.tabulkaPodleJmena(text);
    if (!cil && t) { const l = s.listPodleId(t.list); if (l !== L()) P.prepniNaList(l); const o = oblastDatTabulky(t); g.vyberOblast(o); return; }
    if (!cil) cil = rozeberOblast(text.replace(/\$/g, ''));
    if (!cil && /^[\p{L}_][\p{L}\d_.]*$/u.test(text) && !/^[A-Z]{1,3}\d+$/i.test(text)) {
      // nové jméno pro výběr (jako Excel)
      P.prikaz('Definovat název', () => s.definujNazev(text, '=' + jmenoListuVeVzorci(L().nazev) + '!' + textOblasti(oblast(), true)), { prepocet: false });
      P.toast(`Název „${text}“ odkazuje na ${textOblasti(oblast())}`);
      return;
    }
    if (!cil) { zprava(P.koren, 'Odkaz není platný.'); return; }
    if (cil.list) { const l = s.listPodleJmena(cil.list); if (!l) { zprava(P.koren, 'Odkaz není platný.'); return; } P.prepniNaList(l); }
    g.vyberOblast(cil);
  };

  // ------------------------------------------------------------ listy
  P.novyList = () => {
    const za = S().aktivni;
    P.prikaz('Vložit list', () => { S().pridejList(za); }, { prepocet: false });
    P.kresliListy();
    g.obnovPosun();
    P.obnovObjekty?.();
    P.poZmeneVyberu();
  };
  P.smazatList = (l) => {
    const maData = l.b.size || l.grafy.length;
    const proved = () => {
      P.prikaz('Odstranit list', () => S().smazList(l));
      P.kresliListy();
      g.obnovPosun();
      P.obnovObjekty?.();
      P.poZmeneVyberu();
    };
    if (maData) dialog(P.koren, { titulek: 'AstroTabulky', obsah: el('p.ps-zprava', { text: 'Listy, které odstraníte, nepůjde obnovit (jen tlačítkem Zpět). Opravdu chcete vybrané listy odstranit?' }), tlacitka: [{ text: 'Odstranit', primarni: true, akce: proved }, { text: 'Zrušit' }] });
    else proved();
  };
  P.prejmenovatListNaMiste = (l) => {
    const b = [...document.querySelectorAll('.tb-zalozka')].find((x) => x.closest('.ps') === P.koren && x.textContent === l.nazev);
    if (!b) return;
    const vstup = el('input.tb-zalozka-vstup', { value: l.nazev, maxlength: 31 });
    b.replaceChildren(vstup);
    vstup.focus(); vstup.select();
    let hotovo = false;
    const konec = (ulozit) => {
      if (hotovo) return;
      hotovo = true;
      const nove = vstup.value.trim();
      if (ulozit && nove && nove !== l.nazev) P.prikaz('Přejmenovat list', () => S().prejmenujList(l, nove));
      P.kresliListy();
      g.fokus();
    };
    vstup.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') konec(true); if (e.key === 'Escape') konec(false); });
    vstup.addEventListener('blur', () => konec(true));
    vstup.addEventListener('pointerdown', (e) => e.stopPropagation());
  };
  P.nabidkaListu = (tlacitko, l) => {
    const barvy = ['#C00000', '#FF0000', '#FFC000', '#FFFF00', '#92D050', '#00B050', '#00B0F0', '#0070C0', '#002060', '#7030A0'];
    rozbal(tlacitko, nabidka([
      { text: 'Vložit…', ikona: 'list', akce: () => P.novyList() },
      { text: 'Odstranit', ikona: 'odstranit', akce: () => P.smazatList(l) },
      { text: 'Přejmenovat', ikona: 'tuzka', akce: () => P.prejmenovatListNaMiste(l) },
      { text: 'Přesunout nebo zkopírovat…', akce: () => D.dialogPresunList(P, l) },
      { text: 'Zobrazit kód', zakazano: true },
      { text: l.zamek ? 'Odemknout list…' : 'Zamknout list…', ikona: 'zamekList', akce: () => (l.zamek ? P.odemknoutList() : D.dialogZamknoutList(P)) },
      { uzel: el('div.tb-nab-barvy', {}, el('span', { text: 'Barva karty' }), el('div', {}, [...barvy.map((b) => el('button.ps-barva', { type: 'button', title: b, style: { background: b }, onclick: () => { zavriRozbal(); P.prikaz('Barva karty', () => { l.barva = b; }, { prepocet: false }); } })),
        el('button.ps-barva.bez', { type: 'button', title: 'Bez barvy', onclick: () => { zavriRozbal(); P.prikaz('Barva karty', () => { l.barva = null; }, { prepocet: false }); } })])) },
      'sep',
      { text: 'Skrýt', akce: () => { if (S().listy.filter((x) => !x.skryty).length < 2) { zprava(P.koren, 'Sešit musí obsahovat aspoň jeden viditelný list.'); return; } P.prikaz('Skrýt list', () => { l.skryty = true; const i = S().listy.findIndex((x) => !x.skryty); S().aktivni = i; }, { prepocet: false }); P.kresliListy(); g.obnovPosun(); P.obnovObjekty?.(); } },
      { text: 'Zobrazit…', zakazano: !S().listy.some((x) => x.skryty), akce: () => D.dialogZobrazitList(P) },
      'sep',
      { text: 'Vybrat všechny listy', zakazano: true },
    ], { sirka: 240 }), { nad: true });
  };
  P.odemknoutList = () => {
    const l = L();
    if (!l.zamek) return;
    if (!l.zamek.heslo) { P.prikaz('Odemknout list', () => { l.zamek = null; }, { prepocet: false }); return; }
    const vstup = el('input.ps-vstup', { type: 'password' });
    dialog(P.koren, {
      titulek: 'Odemknout list', sirka: 320, obsah: pole('Heslo:', vstup),
      tlacitka: [{ text: 'OK', primarni: true, akce: () => { if (vstup.value !== l.zamek.heslo) { zprava(P.koren, 'Zadané heslo není správné. Zkontrolujte, jestli nemáte zapnutý CAPS LOCK a používáte správnou velikost písmen.'); return false; } P.prikaz('Odemknout list', () => { l.zamek = null; }, { prepocet: false }); } }, { text: 'Zrušit' }],
    });
  };

  // ------------------------------------------------------------ ukotvení, zobrazení, výpočet
  P.ukotvit = (typ) => {
    const l = L();
    P.prikaz('Ukotvit příčky', () => {
      if (typ === 'zrusit' || (typ === 'pricky' && l.ukotveni)) { l.ukotveni = null; return; }
      const r0 = typ === 'sloupec' ? 0 : g.viditelne?.r1 || 0, c0 = typ === 'radek' ? 0 : g.viditelne?.c1 || 0;
      if (typ === 'radek') l.ukotveni = { r: r0 + 1, c: 0, r0, c0: 0 };
      else if (typ === 'sloupec') l.ukotveni = { r: 0, c: c0 + 1, r0: 0, c0 };
      else {
        const v = V();
        l.ukotveni = { r: Math.max(v.r, r0), c: Math.max(v.c, c0), r0: Math.min(r0, v.r), c0: Math.min(c0, v.c) };
      }
    }, { prepocet: false });
    g.scroll.scrollTop = 0; g.scroll.scrollLeft = 0;
    g.kresliTed();
  };
  P.zobrazitVzorce = () => { const l = L(); l.zobrazitVzorce = !l.zobrazitVzorce; if (l.zobrazitVzorce) for (let c = 0; c < 40; c++) if (!l.sirky.has(c)) l.sirky.set(c, 128), (l._docasneSirky ||= new Set()).add(c); else if (l._docasneSirky) { for (const c of l._docasneSirky) l.sirky.delete(c); l._docasneSirky = null; } g.prekresli(); P.obnov(); };
  P.prepnoutMrizku = () => P.prikaz('Mřížka', () => { L().mrizka = L().mrizka === false; }, { prepocet: false });
  P.prepnoutZahlavi = () => P.prikaz('Záhlaví', () => { L().zahlavi = L().zahlavi === false; }, { prepocet: false });
  P.prepocitat = (vse = true) => { S().prepocitej({ vynutit: true }); if (!vse) { /* jen list */ } P.zmena('prepocet'); g.prekresli(); P.obnov(); };
  P.moznostiVypoctu = (m) => { S().vypocet = m; if (m === 'auto') S().prepocitej(); P.obnov(); g.prekresli(); };

  P.predchudci = () => {
    const l = L(), v = V();
    const z = S().zavislosti(l, v.r, v.c);
    if (!z.length) { zprava(P.koren, 'Aktivní buňka neobsahuje vzorec s platnými odkazy.'); return; }
    for (const x of z) g.sipky.push({ list: l, z: x.oblast, do: { r1: v.r, c1: v.c, r2: v.r, c2: v.c }, oblast: x.oblast.r1 !== x.oblast.r2 || x.oblast.c1 !== x.oblast.c2, barva: x.list !== l ? '#555' : '#1F5FBF' });
    g.prekresli();
  };
  P.naslednici = () => {
    const l = L(), v = V();
    const n = S().naslednici(l, v.r, v.c);
    if (!n.length) { zprava(P.koren, 'Aktivní buňka nemá žádné následníky — žádný vzorec na ni neodkazuje.'); return; }
    for (const x of n) g.sipky.push({ list: l, z: { r1: v.r, c1: v.c, r2: v.r, c2: v.c }, do: { r1: x.r, c1: x.c, r2: x.r, c2: x.c }, barva: x.list !== l ? '#555' : '#1F5FBF' });
    g.prekresli();
  };
  P.odebratSipky = () => { g.sipky = []; g.prekresli(); };

  P.vyhodnotCast = (text, cb) => {
    try {
      const s = parse('=' + text);
      let x = vyhodnot(s, { S: S().S, list: L(), r: V().r, c: V().c });
      if (x instanceof Ref) x = naPole(x, { S: S().S, list: L(), r: V().r, c: V().c });
      const fmt = (v) => (typeof v === 'string' ? `"${v}"` : jeChyba(v) ? v.kod : typeof v === 'boolean' ? (v ? 'PRAVDA' : 'NEPRAVDA') : typeof v === 'number' ? obecne(v, 15) : v === null ? '0' : String(v));
      cb(Array.isArray(x) ? `{${x.map((r) => r.map(fmt).join('\\')).join(';')}}` : fmt(x));
    } catch { /* neplatná část */ }
  };

  P.kontrolaPristupnosti = () => {
    const out = [];
    for (const l of S().listy) {
      for (const gg of l.grafy) if (!gg.alt) out.push({ list: l, text: `Chybí alternativní text: graf na listu ${l.nazev}` });
      for (const o of l.obrazky) if (!o.alt && o.typ === 'obrazek') out.push({ list: l, text: `Chybí alternativní text: obrázek na listu ${l.nazev}` });
      if (l.sloucene.length) out.push({ list: l, text: `Sloučené buňky na listu ${l.nazev} (${l.sloucene.length}) — čtečky obrazovky s nimi mají potíže`, varovani: true });
      if (/^List\d+$/.test(l.nazev) && l.b.size && S().listy.length > 1) out.push({ list: l, text: `Výchozí název listu „${l.nazev}“`, tip: true });
    }
    return out.filter((x) => !x.tip && !x.varovani);
  };

  // ------------------------------------------------------------ komentáře a poznámky
  P.novaPoznamka = () => {
    const l = L(), v = V();
    const b = S().bunka(l, v.r, v.c);
    const text = b?.pozn?.text || '';
    const vstup = el('textarea.ps-vstup.tb-poznamka-vstup', { rows: 5 }, text);
    dialog(P.koren, {
      titulek: b?.pozn ? 'Upravit poznámku' : 'Nová poznámka', sirka: 340,
      obsah: el('div', {}, el('b', { text: P.autor() + ':' }), vstup),
      tlacitka: [{ text: 'OK', primarni: true, akce: () => { P.prikaz('Poznámka', () => { const x = l.b.get(klic(v.r, v.c)) || {}; S().zapis(l, v.r, v.c, { ...x, pozn: vstup.value.trim() ? { text: vstup.value.trim(), autor: P.autor() } : null }); }, { prepocet: false }); } }, { text: 'Zrušit' }],
    });
  };
  P.smazatPoznamku = () => P.prikaz('Odstranit poznámku', () => { const l = L(); for (const o of oblasti()) for (const k of S().kliceVOblasti(l, o)) { const [r, c] = zKlice(k); const b = l.b.get(k); if (b.pozn || b.kom) S().zapis(l, r, c, { ...b, pozn: null, kom: null }); } }, { prepocet: false });
  P.vsechnyKomentare = () => { const out = []; for (const l of S().listy) for (const [k, b] of l.b) if (b.kom) { const [r, c] = zKlice(k); out.push({ l, r, c, b }); } return out.sort((a, b) => S().listy.indexOf(a.l) - S().listy.indexOf(b.l) || a.r - b.r || a.c - b.c); };
  P.dalsiKomentar = (smer) => {
    const vse = P.vsechnyKomentare();
    if (!vse.length) return;
    const v = V();
    const idx = vse.findIndex((x) => x.l === L() && (x.r > v.r || (x.r === v.r && x.c > v.c)));
    let i = smer > 0 ? (idx < 0 ? 0 : idx) : ((idx < 0 ? vse.length : idx) - 1 + vse.length) % vse.length;
    if (smer > 0 && vse[i]?.l === L() && vse[i].r === v.r && vse[i].c === v.c) i = (i + 1) % vse.length;
    const x = vse[i];
    if (x.l !== L()) P.prepniNaList(x.l);
    g.nastavVyber(x.r, x.c);
    P.podokno('komentare');
  };

  // ------------------------------------------------------------ klávesové zkratky mřížky
  P.predKlavesou = (e) => {
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    const hotovo = () => { e.preventDefault(); e.stopPropagation(); return true; };
    if (P.globalniKlavesa(e)) return true;
    if (e.key === 'Escape' && P.st.stetec) { P.stetec(false); return hotovo(); }
    if (e.key === 'Delete' && P.st.objekt) { P.smazObjekt(); return hotovo(); }
    if (e.key === 'F4' && !ctrl && !e.shiftKey) { P.posledniAkce?.(); return hotovo(); }
    if (e.key === 'F5' || (ctrl && k === 'g')) { D.dialogPrejit(P); return hotovo(); }
    if (e.key === 'F9') { P.prepocitat(); return hotovo(); }
    if (e.key === 'F7') { P.podokno('pravopis'); return hotovo(); }
    if (e.key === 'F11' && e.shiftKey) { P.novyList(); return hotovo(); }
    if (e.key === 'F11' || (e.altKey && e.key === 'F1')) { P.vlozGraf(null); return hotovo(); }
    if (e.key === 'F2' && e.shiftKey) { P.novaPoznamka(); return hotovo(); }
    if (e.key === 'F3' && e.shiftKey) { D.dialogVlozitFunkci(P); return hotovo(); }
    if (e.altKey && !ctrl && (e.code === 'Equal' || (e.code === 'Minus' && !e.shiftKey))) { P.autoSuma(); return hotovo(); }
    if (ctrl && e.altKey && k === 'v') { D.dialogVlozitJinak(P); return hotovo(); }
    if (!ctrl) return false;
    if (e.shiftKey) {
      switch (e.code) {
        case 'Digit1': P.formatCisla('#,##0.00'); return hotovo();
        case 'Digit2': P.formatCisla('h:mm'); return hotovo();
        case 'Digit3': P.formatCisla('d.m.yyyy'); return hotovo();
        case 'Digit4': P.formatCisla('#,##0.00 "Kč"'); return hotovo();
        case 'Digit5': P.formatCisla('0%'); return hotovo();
        case 'Digit6': P.formatCisla('0.00E+00'); return hotovo();
        case 'Digit7': P.ohraniceni('vnejsi'); return hotovo();
        case 'Backquote': P.formatCisla('General'); return hotovo();
        case 'Minus': P.ohraniceni('zadne'); return hotovo();
        case 'Digit9': P.zobrazitSkryte('radky'); return hotovo();
        case 'Digit0': P.zobrazitSkryte('sloupce'); return hotovo();
        case 'Equal': P.vlozitBunky(); return hotovo();
        case 'Semicolon': case 'Period': { const t = new Date(); g.zacniEditaci('zadat', `${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}`); return hotovo(); }
      }
      if (k === 'l') { P.filtr(); return hotovo(); }
      if (k === 'f' || k === 'p') { D.dialogFormatBunek(P, 'pismo'); return hotovo(); }
      if (k === 'u') { document.querySelector('.tb-rv-rozbal')?.click(); return hotovo(); }
      if (k === 'a') { return hotovo(); }
    }
    if (e.key === ';' || e.code === 'Comma' && e.shiftKey) {
      g.zacniEditaci('zadat', new Date().toLocaleDateString('cs-CZ').replace(/\s/g, ''));
      return hotovo();
    }
    if (e.key === ':') { const t = new Date(); g.zacniEditaci('zadat', `${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}`); return hotovo(); }
    if (e.key === '`') { P.zobrazitVzorce(); return hotovo(); }
    switch (k) {
      case 'b': P.prepni('b', 'Tučné'); return hotovo();
      case 'i': P.prepni('i', 'Kurzíva'); return hotovo();
      case 'u': P.prepni('u', 'Podtržení'); return hotovo();
      case '5': P.prepni('st', 'Přeškrtnutí'); return hotovo();
      case '1': D.dialogFormatBunek(P, 'cislo'); return hotovo();
      case 'd': P.vyplnit('dolu'); return hotovo();
      case 'r': P.vyplnit('vpravo'); return hotovo();
      case 'e': P.dynamickeDoplnovani(); return hotovo();
      case 'k': D.dialogOdkaz(P); return hotovo();
      case 't': case 'l': D.dialogVytvoritTabulku(P); return hotovo();
      case 'q': P.rychlaAnalyza?.(); return hotovo();
      case '9': P.skryt('radky'); return hotovo();
      case '0': P.skryt('sloupce'); return hotovo();
      case 'y': P.znovu(); return hotovo();
    }
    if (e.key === '-' || e.code === 'NumpadSubtract' || (e.code === 'Slash' && !e.shiftKey)) { P.odstranitBunky(); return hotovo(); }
    if (e.key === '+' || e.code === 'NumpadAdd') { P.vlozitBunky(); return hotovo(); }
    if (e.key === 'Enter') return false;
    return false;
  };

  // ------------------------------------------------------------ kontextová nabídka mřížky
  P.kontextovaNabidka = (e, z) => {
    const kotva = el('div', { style: { position: 'fixed', left: e.clientX + 'px', top: e.clientY + 'px', width: '1px', height: '1px' } });
    document.body.append(kotva);
    const zavri = () => kotva.remove();
    const mini = miniLista();
    let polozky;
    if (z.typ === 'sloupec' || z.typ === 'radek' || z.typ === 'hranaS' || z.typ === 'hranaR') {
      const sloupec = z.typ === 'sloupec' || z.typ === 'hranaS';
      polozky = [
        { text: 'Vyjmout', ikona: 'vyjmout', akce: () => P.vyjmout() },
        { text: 'Kopírovat', ikona: 'kopirovat', akce: () => P.kopirovat() },
        { text: 'Možnosti vložení:', ikona: 'vlozit', zakazano: !P.schranka, akce: () => P.vlozit() },
        { text: 'Vložit jinak…', akce: () => D.dialogVlozitJinak(P), zakazano: !P.schranka },
        'sep',
        { text: 'Vložit', akce: () => P.vlozitBunky(sloupec ? 'sloupce' : 'radky') },
        { text: 'Odstranit', akce: () => P.odstranitBunky(sloupec ? 'sloupce' : 'radky') },
        { text: 'Vymazat obsah', akce: () => P.vymazat('obsah') },
        'sep',
        { text: 'Formát buněk…', ikona: 'formatBunek', akce: () => D.dialogFormatBunek(P) },
        { text: sloupec ? 'Šířka sloupce…' : 'Výška řádku…', akce: () => D.dialogRozmer(P, sloupec ? 'sirka' : 'vyska') },
        { text: 'Skrýt', akce: () => P.skryt(sloupec ? 'sloupce' : 'radky') },
        { text: 'Zobrazit', akce: () => P.zobrazitSkryte(sloupec ? 'sloupce' : 'radky') },
      ];
    } else {
      const v = V();
      const b = S().bunka(L(), v.r, v.c);
      const t = S().tabulkaV(L(), v.r, v.c);
      const odkaz = b?.odkaz;
      polozky = [
        { text: 'Vyjmout', ikona: 'vyjmout', klavesa: 'Ctrl+X', akce: () => P.vyjmout() },
        { text: 'Kopírovat', ikona: 'kopirovat', klavesa: 'Ctrl+C', akce: () => P.kopirovat() },
        { uzel: moznostiVlozeniRadek() },
        { text: 'Vložit jinak…', akce: () => D.dialogVlozitJinak(P), zakazano: !P.schranka },
        'sep',
        { text: 'Inteligentní vyhledávání', ikona: 'najitMaly', akce: () => { const x = S().textBunky(L(), v.r, v.c); if (x) P.otevriAplikaci('browser', { url: 'https://cs.wikipedia.org/wiki/' + encodeURIComponent(x) }); } },
        'sep',
        { text: 'Vložit…', akce: () => P.vlozitBunky() },
        { text: 'Odstranit…', akce: () => P.odstranitBunky() },
        { text: 'Vymazat obsah', akce: () => P.vymazat('obsah') },
        'sep',
        { text: 'Rychlá analýza', ikona: 'analyzovat', klavesa: 'Ctrl+Q', akce: () => P.rychlaAnalyza?.() },
        { text: 'Filtr', ikona: 'filtrMaly', akce: () => rozbal(kotva, nabidka([
          { text: 'Znovu použít', akce: () => P.znovuPouzitFiltr() },
          { text: 'Filtrovat podle hodnoty vybrané buňky', akce: () => { const d = P.oblastDat(); if (!L().filtr && !t) P.prikaz('Filtr', () => { L().filtr = { oblast: d.oblast, podminky: {} }; }, { prepocet: false }); P.nastavFiltr(t || 'filtr', v.c, { hodnoty: [S().textBunky(L(), v.r, v.c)] }); } },
          { text: 'Filtrovat podle barvy vybrané buňky', akce: () => { const d = P.oblastDat(); if (!L().filtr && !t) P.prikaz('Filtr', () => { L().filtr = { oblast: d.oblast, podminky: {} }; }, { prepocet: false }); P.nastavFiltr(t || 'filtr', v.c, { barva: S().stylBunky(L(), v.r, v.c)?.pozadi || '' }); } },
        ], { sirka: 280 }), { poZavreni: zavri, app: 'tabulky' }) },
        { text: 'Seřadit', ikona: 'seraditAZ', akce: () => rozbal(kotva, nabidka([
          { text: 'Seřadit od A do Z', ikona: 'seraditAZ', akce: () => P.seraditRychle(true) },
          { text: 'Seřadit od Z do A', ikona: 'seraditZA', akce: () => P.seraditRychle(false) },
          { text: 'Vybranou barvu buňky dát nahoru', akce: () => { const d = P.oblastDat(); P.seradit([{ c: v.c, podle: 'barva', barva: S().stylBunky(L(), v.r, v.c)?.pozadi || '' }], d.oblast, d.zahlavi); } },
          { text: 'Vlastní řazení…', akce: () => D.dialogSeradit(P) },
        ], { sirka: 260 }), { poZavreni: zavri, app: 'tabulky' }) },
        ...(t ? [{ text: 'Tabulka', ikona: 'tabulkaVelka', akce: () => rozbal(kotva, nabidka([
          { text: 'Řádek souhrnů', zaskrtnuto: t.souhrn, akce: () => P.nastavTabulku({ souhrn: !t.souhrn }) },
          { text: 'Převést na oblast', akce: () => P.prevestNaOblast() },
        ], { sirka: 220 }), { poZavreni: zavri, app: 'tabulky' }) }] : []),
        { text: 'Načíst data z tabulky nebo oblasti…', zakazano: true },
        'sep',
        { text: 'Nový komentář', ikona: 'komentarNovy', akce: () => P.podokno('komentare', { novy: true }) },
        { text: b?.pozn ? 'Upravit poznámku' : 'Nová poznámka', ikona: 'poznamka', akce: () => P.novaPoznamka() },
        ...(b?.pozn || b?.kom ? [{ text: 'Odstranit poznámku', akce: () => P.smazatPoznamku() }] : []),
        'sep',
        { text: 'Formát buněk…', ikona: 'formatBunek', klavesa: 'Ctrl+1', akce: () => D.dialogFormatBunek(P) },
        { text: 'Vybrat z rozevíracího seznamu…', akce: () => P.seznamHodnot() },
        { text: 'Definovat název…', akce: () => D.dialogNovyNazev(P) },
        { text: odkaz ? 'Upravit hypertextový odkaz…' : 'Odkaz', ikona: 'odkaz', klavesa: 'Ctrl+K', akce: () => D.dialogOdkaz(P) },
        ...(odkaz ? [{ text: 'Otevřít hypertextový odkaz', akce: () => P.otevriOdkaz(odkaz) }, { text: 'Odebrat hypertextový odkaz', akce: () => P.vymazat('odkazy') }] : []),
      ];
    }
    rozbal(kotva, el('div.ps-kontext', {}, mini, nabidka(polozky, { sirka: 270 })), { poZavreni: zavri, tema: P.koren.dataset.motiv, app: 'tabulky' });
  };

  function moznostiVlozeniRadek() {
    const tl = (ikona, titulek, rezim, o = {}) => el('button.ps-b.male', { type: 'button', title: titulek, disabled: !P.schranka, onclick: () => { zavriRozbal(); if (P.schranka) P.vlozVnitrni(P.schranka, rezim, o); else P.vlozit(); } }, ik(ikona));
    return el('div.tb-moznosti-vlozeni', {}, el('div.ps-nab-nadpis', { text: 'Možnosti vložení:' }),
      el('div.tb-mv-radek', {}, tl('vlozit', 'Vložit (P)', 'vse'), tl('cislovani', 'Hodnoty (H)', 'hodnoty'), tl('fx', 'Vzorce (V)', 'vzorce'), tl('prepnoutRadek', 'Transponovat (T)', 'vse', { transponovat: true }), tl('stetec', 'Formátování (R)', 'formaty'), tl('odkaz', 'Vložit propojení (N)', 'propojit')));
  }

  function miniLista() {
    const s = P.stav.s || {};
    const b = (ikona, titulek, akce, zap) => el('button.ps-b.male' + (zap ? '.zapnuto' : ''), { type: 'button', title: titulek, onclick: () => { zavriRozbal(); akce(); } }, ik(ikona));
    const pismo = el('input.ps-kombo-vstup.tb-mini-pismo', { value: s.font || 'Aptos Narrow', title: 'Písmo' });
    const vel = el('input.ps-kombo-vstup.tb-mini-vel', { value: String(s.vel || 11).replace('.', ','), title: 'Velikost písma' });
    for (const [vstup, fn] of [[pismo, (x) => P.pismo(x)], [vel, (x) => P.velikost(x)]]) {
      vstup.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { fn(vstup.value); zavriRozbal(); } });
    }
    return el('div.ps-minilista.tb-minilista', {},
      el('div.tb-mini-radek', {}, el('div.ps-kombo', {}, pismo), el('div.ps-kombo', {}, vel),
        b('zvetsit', 'Zvětšit písmo', () => P.zmenVelikost(1)), b('zmensit', 'Zmenšit písmo', () => P.zmenVelikost(-1)),
        b('mena', 'Účetnický číselný formát', () => P.menaFormat()), b('procenta', 'Styl procent', () => P.procentaFormat()), b('tisice', 'Styl s oddělovačem tisíců', () => P.tisiceFormat())),
      el('div.tb-mini-radek', {},
        b('tucne', 'Tučné', () => P.prepni('b', 'Tučné'), s.b), b('kurziva', 'Kurzíva', () => P.prepni('i', 'Kurzíva'), s.i),
        b('zarovnatNaStred', 'Zarovnat na střed', () => P.zarovnat('c'), s.h === 'c'),
        b('barvaVyplne', 'Barva výplně (žlutá)', () => P.barvaVyplne('#FFFF00')), b('barvaPisma', 'Barva písma (červená)', () => P.barvaPisma('#FF0000')),
        b('ohraniceni', 'Ohraničení', () => P.ohraniceni('vsechna')), b('sloucit', 'Sloučit a zarovnat na střed', () => P.sloucit('stred')),
        b('pridatDesetinne', 'Přidat desetinné místo', () => P.desetinna(1)), b('ubratDesetinne', 'Odebrat desetinné místo', () => P.desetinna(-1)), b('stetec', 'Kopírovat formát', () => P.stetec(true))));
  }

  /** Alt+↓: seznam hodnot ze sloupce (Vybrat z rozevíracího seznamu). */
  P.seznamHodnot = () => {
    const l = L(), v = V();
    const hodnoty = new Set();
    for (const smer of [-1, 1]) for (let r = v.r + smer, n = 0; r >= 0 && n < 2000; r += smer, n++) {
      const x = S().hodnota(l, r, v.c);
      if (x === null) break;
      if (typeof x === 'string') hodnoty.add(x);
    }
    const pol = [...hodnoty].sort((a, b) => a.localeCompare(b, 'cs'));
    if (!pol.length) return;
    const o = g.obdelnik({ r1: v.r, c1: v.c, r2: v.r, c2: v.c });
    const r = g.scroll.getBoundingClientRect();
    const kotva = el('div', { style: { position: 'fixed', left: (r.left + o.x) + 'px', top: (r.top + o.y + o.h) + 'px', width: Math.max(o.w, 1) + 'px', height: '1px' } });
    document.body.append(kotva);
    rozbal(kotva, el('div.ps-nabidka.tb-seznam-overeni', { style: { minWidth: Math.max(120, o.w) + 'px' } }, pol.map((t) => el('button.ps-nab-polozka', {
      type: 'button', text: t, onclick: () => { zavriRozbal(); P.prikaz('Psaní', () => S().zadej(l, v.r, v.c, t)); g.fokus(); },
    }))), { poZavreni: () => kotva.remove(), app: 'tabulky' });
  };

  P.zavriPlovouci = () => { g.chytry.hidden = true; };

  // ------------------------------------------------------------ tabulky
  P.nastavTabulku = (zmena) => {
    const l = L(), v = V();
    const t = S().tabulkaV(l, v.r, v.c);
    if (!t) return;
    P.prikaz('Návrh tabulky', () => {
      const x = l.tabulky.find((y) => y.nazev === t.nazev);
      if ('souhrn' in zmena) S().radekSouhrnu(l, x, zmena.souhrn);
      const { souhrn, ...zbytek } = zmena;
      if ('nazev' in zbytek) {
        const n = zbytek.nazev.trim();
        if (!/^[\p{L}_][\p{L}\d_.]*$/u.test(n) || /^[A-Z]{1,3}\d+$/i.test(n)) throw new ChybaUpravy('Zadaný název není platný. Název musí začínat písmenem nebo podtržítkem a nesmí obsahovat mezery ani vypadat jako odkaz na buňku.', 'nazev');
        if (S().tabulkaPodleJmena(n) && n.toLocaleLowerCase('cs') !== x.nazev.toLocaleLowerCase('cs')) throw new ChybaUpravy('Tento název už v sešitu existuje. Zadejte jedinečný název.', 'nazev');
        // odkazy v strukturovaných vzorcích
        const stary = x.nazev;
        S().prepisVzorce((f) => f.split(stary + '[').join(n + '['));
        for (const ll of S().listy) for (const [k, b] of ll.b) if (b.f && b.f.includes(stary + '[')) ll.b.set(k, Object.freeze({ ...b, f: b.f.split(stary + '[').join(n + '[') }));
      }
      Object.assign(x, zbytek);
    });
  };
  P.prevestNaOblast = () => {
    const l = L(), v = V();
    const t = S().tabulkaV(l, v.r, v.c);
    if (!t) return;
    dialog(P.koren, {
      titulek: 'AstroTabulky', obsah: el('p.ps-zprava', { text: 'Chcete převést tabulku na normální oblast?' }),
      tlacitka: [{ text: 'Ano', primarni: true, akce: () => P.prikaz('Převést na oblast', () => {
        const x = l.tabulky.find((y) => y.nazev === t.nazev);
        const o = x.oblast;
        // formát tabulky zůstane jako přímé formátování
        for (let r = o.r1; r <= o.r2; r++) for (let c = o.c1; c <= o.c2; c++) {
          const ts = stylTabulky(x, r, c, S(), l);
          const b = l.b.get(klic(r, c)) || {};
          const s = { ...(ts.pozadi ? { pozadi: ts.pozadi } : {}), ...(ts.pismo?.barva ? { barva: ts.pismo.barva } : {}), ...(ts.pismo?.b ? { b: true } : {}), ...(ts.ohr ? { ohr: ts.ohr } : {}), ...(b.s || {}) };
          S().zapis(l, r, c, { ...b, s: Object.keys(s).length ? Object.freeze(s) : null });
        }
        // strukturované odkazy → běžné adresy
        const hlavicka = Array.from({ length: o.c2 - o.c1 + 1 }, (_, i) => String(S().hodnota(l, o.r1, o.c1 + i) ?? '').toLocaleLowerCase('cs'));
        const d = oblastDatTabulky(x);
        const sloupec = (jm) => o.c1 + Math.max(0, hlavicka.indexOf(jm.replace(/^\[|\]$/g, '').toLocaleLowerCase('cs')));
        const prepis = (f, r) => f.replace(new RegExp(`(${x.nazev.replace(/[.]/g, '\\.')})?\\[(@)?\\[?([^\\]]+)\\]?\\]`, 'g'), (m, tab, zav, jm) => {
          if (!tab && !zav && !obsahuje(o, r, o.c1)) return m;
          const c = sloupec(jm);
          return zav ? adresa(r, c) : `${adresa(d.r1, c, true, true)}:${adresa(d.r2, c, true, true)}`;
        });
        for (const ll of S().listy) for (const [k, b] of ll.b) {
          if (!b.f || !/\[/.test(b.f)) continue;
          const [r] = zKlice(k);
          const f = prepis(b.f, r);
          if (f !== b.f) ll.b.set(k, Object.freeze({ ...b, f }));
        }
        l.tabulky = l.tabulky.filter((y) => y !== x);
      }) }, { text: 'Ne' }],
    });
  };
  P.formatJakoTabulku = (styl = 'stredni2') => {
    const l = L(), v = V();
    const t = S().tabulkaV(l, v.r, v.c);
    if (t) { P.prikaz('Styl tabulky', () => { l.tabulky.find((y) => y.nazev === t.nazev).styl = styl; }, { prepocet: false }); return; }
    D.dialogVytvoritTabulku(P, styl);
  };

  // ------------------------------------------------------------ podmíněné formátování
  P.podminene = (pravidlo) => {
    if (!kontrolaZamku('formatBunek')) return;
    const o = oblasti().map((x) => orez(x));
    P.prikaz('Podmíněné formátování', () => { L().podminene.push({ ...pravidlo, oblasti: o }); }, { prepocet: false });
  };
  P.vymazatPodminene = (co) => P.prikaz('Vymazat pravidla', () => {
    const l = L();
    if (co === 'list') l.podminene = [];
    else l.podminene = l.podminene.filter((p) => !(p.oblasti || [p.oblast]).some((x) => oblasti().some((y) => prekryva(x, y))));
  }, { prepocet: false });

  // ------------------------------------------------------------ export a tisk
  P.stranky = () => {
    const l = L();
    const u = S().rozsahDat(l);
    if (u.r < 0) return [];
    const oblast = l.tisk?.oblast ? rozeberOblast(l.tisk.oblast) : { r1: 0, c1: 0, r2: u.r, c2: u.c };
    if (!oblast) return [];
    const nast = l.tisk || {};
    const naSirku = nast.orientace === 'sirka';
    const [pw, ph] = { A4: [794, 1123], A3: [1123, 1587], Letter: [816, 1056], A5: [559, 794] }[nast.papir || 'A4'];
    const okr = { normalni: [0.7, 0.75], uzke: [0.25, 0.75], siroke: [1, 1] }[nast.okraje || 'normalni'];
    const sirka = (naSirku ? ph : pw) - okr[0] * 2 * 96;
    const vyska = (naSirku ? pw : ph) - okr[1] * 2 * 96 - 40;
    const mer = (nast.meritko || 100) / 100;
    const out = [];
    const deleni = (od, doo, vel, lim) => {
      const casti = [];
      let zac = od, sum = 0;
      for (let i = od; i <= doo; i++) {
        const w = vel(i) * mer;
        if (sum + w > lim && i > zac) { casti.push([zac, i - 1]); zac = i; sum = 0; }
        sum += w;
      }
      casti.push([zac, doo]);
      return casti;
    };
    const sl = nast.naSirku1 ? [[oblast.c1, oblast.c2]] : deleni(oblast.c1, oblast.c2, (c) => S().sirka(l, c), sirka);
    const rd = deleni(oblast.r1, oblast.r2, (r) => g.vyskaRadku(r), vyska);
    for (const [c1, c2] of sl) for (const [r1, r2] of rd) out.push({ r1, r2, c1, c2, auto: true });
    return out;
  };

  P.exportHtml = (co = 'list') => {
    const listy = co === 'sesit' ? S().listy.filter((l) => !l.skryty) : [L()];
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const car = (c) => (c ? `${c.s === 'tlusta' ? 2.5 : c.s === 'stredni' ? 1.8 : 1}px ${c.s === 'dvojita' ? 'double' : c.s === 'tecky' ? 'dotted' : /carky/i.test(c.s) ? 'dashed' : 'solid'} ${c.b || '#000'}` : '');
    const casti = listy.map((l) => {
      const u = S().rozsahDat(l);
      let o = co === 'vyber' ? oblast() : l.tisk?.oblast ? rozeberOblast(l.tisk.oblast) : { r1: 0, c1: 0, r2: Math.max(0, u.r), c2: Math.max(0, u.c) };
      o = { ...o, r2: Math.min(o.r2, Math.max(u.r, o.r1)), c2: Math.min(o.c2, Math.max(u.c, o.c1)) };
      const mrizka = l.tisk?.mrizka;
      let html = `<h2 class="list">${esc(l.nazev)}</h2><table><colgroup>${Array.from({ length: o.c2 - o.c1 + 1 }, (_, i) => `<col style="width:${S().sirka(l, o.c1 + i)}px">`).join('')}</colgroup>`;
      if (l.tisk?.zahlavi) html += `<tr><th></th>${Array.from({ length: o.c2 - o.c1 + 1 }, (_, i) => `<th>${pismena(o.c1 + i)}</th>`).join('')}</tr>`;
      const skryte = new Set();
      for (let r = o.r1; r <= o.r2; r++) {
        if (l.skryteR.has(r) || l.skryteFiltrem.has(r)) continue;
        html += `<tr style="height:${g.vyskaRadku(r)}px">`;
        if (l.tisk?.zahlavi) html += `<th>${r + 1}</th>`;
        for (let c = o.c1; c <= o.c2; c++) {
          if (skryte.has(r + ':' + c) || l.skryteC.has(c)) continue;
          const m = S().sloucenaV(l, r, c);
          let span = '';
          if (m) {
            if (m.r1 !== r || m.c1 !== c) continue;
            for (let rr = m.r1; rr <= m.r2; rr++) for (let cc = m.c1; cc <= m.c2; cc++) skryte.add(rr + ':' + cc);
            span = ` rowspan="${m.r2 - m.r1 + 1}" colspan="${m.c2 - m.c1 + 1}"`;
          }
          const s = S().stylBunky(l, r, c) || {};
          const v = S().hodnota(l, r, c);
          const f = formatuj(v, s.nf);
          const h = s.h || (typeof v === 'number' ? 'r' : typeof v === 'boolean' || jeChyba(v) ? 'c' : 'l');
          const css = [
            `text-align:${{ l: 'left', c: 'center', r: 'right', j: 'justify', cs: 'center' }[h] || 'left'}`,
            `vertical-align:${{ t: 'top', m: 'middle', b: 'bottom' }[s.v || 'b']}`,
            s.b && 'font-weight:bold', s.i && 'font-style:italic', (s.u || s.st) && `text-decoration:${[s.u && 'underline', s.st && 'line-through'].filter(Boolean).join(' ')}`,
            (f.barva || s.barva) && `color:${f.barva || s.barva}`, s.pozadi && `background:${s.pozadi}`,
            s.font && `font-family:'${s.font}'`, s.vel && `font-size:${s.vel}pt`, s.zalam ? 'white-space:pre-wrap' : 'white-space:pre',
            s.ohr?.t && `border-top:${car(s.ohr.t)}`, s.ohr?.b && `border-bottom:${car(s.ohr.b)}`, s.ohr?.l && `border-left:${car(s.ohr.l)}`, s.ohr?.r && `border-right:${car(s.ohr.r)}`,
            mrizka && !s.ohr && 'border:1px solid #d0d0d0',
          ].filter(Boolean).join(';');
          html += `<td${span} style="${css}">${esc(f.text)}</td>`;
        }
        html += '</tr>';
      }
      html += '</table>';
      const grafy = l.grafy.map((gr) => `<div class="graf">${P.svgGrafu?.(gr) || ''}</div>`).join('');
      return html + grafy;
    });
    const t = L().tisk || {};
    const okr = { normalni: '1.9cm 1.8cm', uzke: '1.9cm 0.64cm', siroke: '2.54cm 2.54cm' }[t.okraje || 'normalni'];
    return `<!DOCTYPE html><html lang="cs"><head><meta charset="utf-8"><title>${esc(P.st.nazev)}</title><style>
@page { size: ${t.papir || 'A4'} ${t.orientace === 'sirka' ? 'landscape' : 'portrait'}; margin: ${okr}; }
body { font: 11pt "Aptos Narrow", Aptos, Calibri, Arial, sans-serif; color: #000; margin: 0; }
table { border-collapse: collapse; table-layout: fixed; ${t.meritko ? `zoom: ${t.meritko / 100};` : ''} }
td, th { padding: 1px 4px; overflow: hidden; }
th { background: #f2f2f2; border: 1px solid #bbb; font-weight: normal; color: #444; }
h2.list { font: 600 12pt "Segoe UI", sans-serif; margin: 0 0 6px; ${listy.length < 2 ? 'display:none;' : ''} }
table + h2.list, .graf + h2.list { break-before: page; }
.graf { margin: 14px 0; break-inside: avoid; }
</style></head><body>${casti.join('')}</body></html>`;
  };

  P.tiskni = (co = 'list') => {
    const f = el('iframe', { style: { position: 'fixed', width: '0', height: '0', border: '0', right: '0', bottom: '0' } });
    document.body.append(f);
    f.contentDocument.open();
    f.contentDocument.write(P.exportHtml(co));
    f.contentDocument.close();
    P.st.meta.tisk = Date.now();
    setTimeout(() => {
      try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { zprava(P.koren, 'Tisk se nepodařilo spustit: ' + e.message); }
      setTimeout(() => f.remove(), 1500);
    }, 250);
  };
}

function naHex(c) {
  if (c[0] === '#') return c.length === 4 ? '#' + [...c.slice(1)].map((x) => x + x).join('') : c.toUpperCase();
  const m = c.match(/\d+/g);
  return m ? '#' + m.slice(0, 3).map((x) => (+x).toString(16).padStart(2, '0')).join('').toUpperCase() : null;
}
