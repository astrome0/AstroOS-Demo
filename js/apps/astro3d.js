// AstroOS — Astro 3D (jednoduchý Blender: scéna z tvarů, úpravy sítě, snímek)
//
// Ovládání je převzaté z Blenderu, ať se dá jedno naučit z druhého:
//   kolečko/pravé tlačítko táhnout = otáčet pohled, Shift = posouvat, kolečko = přiblížit,
//   G / R / S = posun / otočení / měřítko (pak X Y Z = osa, čísla = přesná hodnota, Ctrl = po krocích),
//   Shift+A přidat, Shift+D duplikovat, X / Delete smazat, H skrýt, A vybrat vše,
//   1 3 7 (i na numerické) = zepředu / zprava / shora, 5 = perspektiva, F12 = snímek do Fotek.
// Režim úprav (Tab): 1 2 3 = vrcholy / hrany / plochy, E vytáhnout, I vsadit, Ctrl+R řez smyčkou,
//   F vyplnit, M spojit, Alt+klik smyčka, L / Ctrl+L propojené, Ctrl+I obrátit výběr.
// Scéna se ukládá jako .a3d (JSON) do ~/Dokumenty/3D.

import { el, clamp } from '../util.js';
import { icon } from '../icons.js';
import * as FS from '../fs.js';
import { toast, contextMenu } from '../ui.js';
import * as M from '../blend/mat.js';
import { TVARY, HLADKY, vytvor, statistika, kUlozeni, platna } from '../blend/sit.js';
import * as U from '../blend/uprava.js';
import { Renderer, MAX_SVETEL, hexNaRgb } from '../blend/render.js';
import { PathTracer } from '../blend/pathtracer.js';
import * as A from '../blend/animace.js';
import { nactiObj, zapisObj } from '../blend/obj.js';
import { UKAZKY, ukazkaPodle } from '../blend/ukazky.js';
import * as AI from '../ai.js';
import { t } from '../i18n.js';

const SLOZKA = FS.HOME + '/Dokumenty/3D';
const OBRAZKY = FS.HOME + '/Obrázky';
const FOV = 40 * M.DEG;
const MAX_KROKU = 64;
const OSY = ['X', 'Y', 'Z'];
const BARVY_OS = ['#ff3352', '#8bdc00', '#2890ff'];
const SVETLE_OS = ['#ff8a9c', '#c4f55c', '#7fbcff'];
const E = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const PITCH_MAX = 89.99 * M.DEG;

const NASTROJE = [
  { id: 'vyber', nazev: 'Výběr', ikona: 'b3vyber', klavesa: 'E / Q' },
  { id: 'presun', nazev: 'Posun', ikona: 'b3presun', klavesa: 'G' },
  { id: 'otoceni', nazev: 'Otočení', ikona: 'b3otoceni', klavesa: 'R' },
  { id: 'meritko', nazev: 'Měřítko', ikona: 'b3meritko', klavesa: 'E / Q' },
];

const REZIMY = [
  { id: 'v', nazev: 'Vrcholy', ikona: 'b3vrchol', klavesa: '1' },
  { id: 'e', nazev: 'Hrany', ikona: 'b3hrana', klavesa: '2' },
  { id: 'f', nazev: 'Plochy', ikona: 'b3plocha', klavesa: '3' },
];

const POHLEDY = {
  predni: { yaw: -90, pitch: 0, nazev: 'Zepředu' },
  zadni: { yaw: 90, pitch: 0, nazev: 'Zezadu' },
  prava: { yaw: 0, pitch: 0, nazev: 'Zprava' },
  leva: { yaw: 180, pitch: 0, nazev: 'Zleva' },
  horni: { yaw: -90, pitch: 90, nazev: 'Shora' },
  dolni: { yaw: -90, pitch: -90, nazev: 'Zdola' },
};

const PALETA = ['#cccccc', '#f2f2f2', '#3a3a3a', '#d9534f', '#f0a030', '#f5d547', '#5cb85c', '#3fb6c8', '#4a7fd6', '#9a6ad6', '#e57fb0', '#8b5a3c'];

const fmt = (v, d = 3) => {
  const s = (Math.round(v * 10 ** d) / 10 ** d).toFixed(d);
  return s === '-0.' + '0'.repeat(d) ? (0).toFixed(d) : s;
};

const DRUHY_SVETEL = [
  { id: 'bod', nazev: 'Bodové', ikona: 'b3svetlo' },
  { id: 'slunce', nazev: 'Slunce', ikona: 'b3slunce' },
  { id: 'reflektor', nazev: 'Reflektor', ikona: 'b3reflektor' },
];
const PALETA_SVETLA = ['#ffffff', '#fff1d6', '#ffd29a', '#ff9a5a', '#e0ecff', '#9ec5ff', '#ff6b6b', '#7dff9a', '#c89bff', '#5ee0ff'];
const jeSvetlo = (o) => o?.typ === 'svetlo';
const linearni = (rgb) => rgb.map((x) => x ** 2.2);
/** Světla svítí po své lokální ose −Z (jako v Blenderu). */
const smerSvetla = (o) => M.norm(M.aplikuj3(M.rotace(o.rot), [0, 0, -1]));
/** Otočení, které namíří −Z ze světla na cíl. */
function miritNa(poz, cil) {
  const d = M.norm(M.sub(cil, poz));
  return [Math.acos(clamp(-d[2], -1, 1)) / M.DEG, 0, Math.atan2(-d[0], d[1]) / M.DEG];
}

const BARVA_VYBER = [1, 0.62, 0.2, 1];
const BARVA_PLOCHA = [1, 0.55, 0.15, 0.2];

export const astro3dApp = {
  id: 'astro3d', name: 'Astro 3D', icon: 'b3krychle', color: 'linear-gradient(145deg,#f5a04a,#c4581f)',
  cat: 'media', width: 1100, height: 700,

  mount(body, win) {
    // ---------------------------------------------------------------- stav
    const sc = {
      objekty: [],
      vybrane: new Set(),
      aktivni: null,
      uprava: null,          // režim úprav: { id, rezim: 'v'|'e'|'f', v: Set, e: Set, f: Set }
      path: null, dirty: false,
      undo: [], redo: [],
      nastroj: 'presun',
      drat: false, mrizka: true, render: false, pro: false,
      anim: { start: 1, konec: 120, fps: 24, snimek: 1 },
      svet: { barva: '#404040', sila: 1 },
    };
    const kam = { stred: [0, 0, 0], yaw: -43.3 * M.DEG, pitch: 26 * M.DEG, dist: 12, ortho: false, autoOrtho: false, nazevPohledu: null };
    let pohled = null;           // spočítané matice pro aktuální snímek
    let uchop = null;            // probíhající G / R / S / I
    let tah = null;              // tažení myší (orbit, pan, výběr rámečkem…)
    let animace = null;          // plynulý přechod pohledu
    let najeto = null;           // úchyt gizma pod myší
    let najetoNav = null;        // kulička navigačního gizma pod myší
    let rez = null;              // nástroj řez smyčkou: { trvaly, kl, usecky }
    let mys = { x: 0, y: 0, uvnitr: false };
    let dalsiId = 1;
    let verzeVyberu = 0;
    win.astro3d = sc;

    // ---------------------------------------------------------------- DOM
    const cv = el('canvas.b3-gl');
    const ov = el('canvas.b3-ov');
    const ovx = ov.getContext('2d');
    const ptCv = el('canvas.b3-pt');
    const view = el('div.b3-view', { tabIndex: -1 }, cv, ptCv, ov);
    let r;
    try { r = new Renderer(cv); } catch (err) {
      body.append(el('div.b3-chyba', {}, icon('info'), el('h3', { text: 'Astro 3D se nespustilo' }), el('p', { text: err.message })));
      return;
    }

    // ---------------------------------------------------------------- objekty
    function unikatniNazev(zaklad) {
      const jmena = new Set(sc.objekty.map((o) => o.nazev));
      if (!jmena.has(zaklad)) return zaklad;
      const koren = zaklad.replace(/\.\d{3}$/, '');
      for (let i = 1; ; i++) { const n = `${koren}.${String(i).padStart(3, '0')}`; if (!jmena.has(n)) return n; }
    }

    function novyObjekt(typ, extra = {}) {
      const tv = TVARY.find((x) => x.id === typ) || TVARY[0];
      return {
        id: 'o' + dalsiId++, nazev: unikatniNazev(tv.nazev), typ: tv.id, sit: vytvor(tv.id),
        poz: [0, 0, 0], rot: [0, 0, 0], mer: [1, 1, 1],
        barva: '#cccccc', drs: 0.5, kov: 0, hladke: HLADKY[tv.id], skryty: false,
        ...extra,
      };
    }

    function noveSvetlo(druh) {
      const dt = DRUHY_SVETEL.find((x) => x.id === druh) || DRUHY_SVETEL[0];
      const poz = { bod: [4.08, 1.0, 5.9], slunce: [-4, -1.5, 6], reflektor: [4, -4, 5] }[dt.id];
      // slunce zboku, ať je stín z výchozího pohledu vidět
      const rot = dt.id === 'bod' ? [0, 0, 0] : miritNa(poz, [0, 0, 0]);
      return {
        id: 'o' + dalsiId++, nazev: unikatniNazev(dt.id === 'slunce' ? 'Slunce' : dt.id === 'reflektor' ? 'Reflektor' : 'Světlo'),
        typ: 'svetlo', druh: dt.id, poz: [...poz], rot, mer: [1, 1, 1],
        barva: '#ffffff', sila: dt.id === 'slunce' ? 2 : 1000, uhel: 45, mekkost: 0.15, stiny: true, polomer: 0.25, skryty: false,
      };
    }

    function pridejSvetlo(druh) {
      zapamatuj();
      const o = noveSvetlo(druh);
      sc.objekty.push(o);
      vyber([o.id]);
      spinavy();
      if (!sc.render) toast({ title: 'Světlo přidáno', body: 'Svítí v režimu Render (Shift+Z).', icon: 'b3render', timeout: 3000 });
    }

    const aktivniObj = () => sc.objekty.find((o) => o.id === sc.aktivni) || null;
    const vybraneObj = () => sc.objekty.filter((o) => sc.vybrane.has(o.id) && !o.skryty);
    const modelObj = (o) => M.trs(o.poz, o.rot, o.mer);

    function vyber(ids, { pridat = false, aktivni } = {}) {
      if (!pridat) sc.vybrane.clear();
      for (const id of ids) sc.vybrane.add(id);
      if (aktivni !== undefined) sc.aktivni = aktivni;
      else if (ids.length) sc.aktivni = ids[ids.length - 1];
      else if (!pridat) sc.aktivni = null;
      obnovVse();
    }

    function pridej(typ) {
      if (sc.uprava) return pridejDoSite(typ);
      zapamatuj();
      const o = novyObjekt(typ);
      sc.objekty.push(o);
      vyber([o.id]);
      spinavy();
    }

    function smazVybrane() {
      const pryc = vybraneObj();
      if (!pryc.length) return;
      zapamatuj();
      sc.objekty = sc.objekty.filter((o) => !sc.vybrane.has(o.id) || o.skryty);
      sc.vybrane.clear();
      sc.aktivni = null;
      spinavy();
      obnovVse();
      uklidGpu();
    }

    function duplikuj() {
      if (sc.uprava) return duplikujVSiti();
      const zdroj = vybraneObj();
      if (!zdroj.length) return;
      zapamatuj();
      const kopie = zdroj.map((o) => ({ ...o, id: 'o' + dalsiId++, nazev: unikatniNazev(o.nazev), poz: [...o.poz], rot: [...o.rot], mer: [...o.mer] }));
      sc.objekty.push(...kopie);
      vyber(kopie.map((o) => o.id));
      spinavy();
      // jako v Blenderu se kopie hned chytí a jde s myší
      zacniUchop('g', { bezZapamatovani: true });
    }

    function skryj(vybrane) {
      zapamatuj();
      if (vybrane) {
        for (const o of vybraneObj()) o.skryty = true;
        sc.vybrane.clear();
        sc.aktivni = null;
      } else {
        for (const o of sc.objekty) if (o.skryty) { o.skryty = false; sc.vybrane.add(o.id); }
      }
      spinavy();
      obnovVse();
    }

    function stinovani(hladke) {
      zapamatuj();
      const cil = sc.uprava ? [upravObj()] : vybraneObj().filter((o) => o.sit);
      for (const o of cil) o.hladke = hladke;
      spinavy(); obnovVse();
    }

    /** Catmull–Clark na celé sítě vybraných objektů (v režimu úprav na upravovanou). */
    function vyhlad() {
      const cil = sc.uprava ? [upravObj()] : vybraneObj().filter((o) => o.sit);
      if (!cil.length) return;
      const velke = cil.find((o) => o.sit.f.reduce((s, pl) => s + pl.length, 0) > 60000);
      if (velke) return toast({ title: 'Síť je už moc hustá', body: `${velke.nazev} — další vyhlazení by bylo pomalé.`, icon: 'info' });
      zapamatuj();
      for (const o of cil) { o.sit = U.catmullClark(o.sit); o.hladke = true; }
      if (sc.uprava) vsechnoVybrat(true);
      spinavy(); obnovVse(); uklidGpu();
    }

    // ---------------------------------------------------------------- zpět / vpřed
    const kopieUpravy = (u) => u && { id: u.id, rezim: u.rezim, v: new Set(u.v), e: new Set(u.e), f: new Set(u.f) };
    const snimek = () => ({
      objekty: sc.objekty.map((o) => ({ ...o, poz: [...o.poz], rot: [...o.rot], mer: [...o.mer] })),
      vybrane: [...sc.vybrane], aktivni: sc.aktivni, uprava: kopieUpravy(sc.uprava), svet: { ...sc.svet },
    });
    function obnovSnimek(s) {
      sc.objekty = s.objekty.map((o) => ({ ...o, poz: [...o.poz], rot: [...o.rot], mer: [...o.mer] }));
      sc.vybrane = new Set(s.vybrane);
      sc.aktivni = s.aktivni;
      sc.uprava = kopieUpravy(s.uprava);
      if (s.svet) sc.svet = { ...s.svet };
      if (sc.uprava && !upravObj()) sc.uprava = null;
    }
    function zapamatuj() {
      sc.undo.push(snimek());
      if (sc.undo.length > MAX_KROKU) sc.undo.shift();
      sc.redo.length = 0;
    }
    function zpet() {
      if (uchop) return zrusUchop();
      if (!sc.undo.length) return;
      sc.redo.push(snimek());
      obnovSnimek(sc.undo.pop());
      spinavy(); obnovVse();
    }
    function vpred() {
      if (!sc.redo.length) return;
      sc.undo.push(snimek());
      obnovSnimek(sc.redo.pop());
      spinavy(); obnovVse();
    }
    function uklidGpu() {
      const zive = new Set();
      for (const s of [sc, ...sc.undo, ...sc.redo]) for (const o of s.objekty) zive.add(o.sit);
      r.uklid(zive);
    }

    // ---------------------------------------------------------------- režim úprav: výběr
    const upravObj = () => (sc.uprava ? sc.objekty.find((o) => o.id === sc.uprava.id) || null : null);

    /** Vybrané vrcholy (podle režimu dopočítané z hran nebo ploch). */
    function selV() {
      const u = sc.uprava, o = upravObj();
      if (!u || !o) return new Set();
      if (u.rezim === 'v') return u.v;
      const out = new Set();
      if (u.rezim === 'e') for (const k of u.e) for (const i of U.vrcholyHrany(k)) out.add(i);
      else for (const fi of u.f) for (const i of o.sit.f[fi] || []) out.add(i);
      return out;
    }
    function selE() {
      const u = sc.uprava, o = upravObj();
      if (!u || !o) return new Set();
      if (u.rezim === 'e') return u.e;
      const out = new Set();
      if (u.rezim === 'f') { for (const fi of u.f) for (const k of U.hranyPlochy(o.sit.f[fi] || [])) out.add(k); return out; }
      for (const [k, h] of U.topologie(o.sit).hrany) if (u.v.has(h.a) && u.v.has(h.b)) out.add(k);
      return out;
    }
    function selF() {
      const u = sc.uprava, o = upravObj();
      if (!u || !o) return new Set();
      if (u.rezim === 'f') return u.f;
      const vv = selV(), out = new Set();
      o.sit.f.forEach((pl, fi) => { if (pl.every((i) => vv.has(i))) out.add(fi); });
      return out;
    }

    /** Nastaví výběr z výsledku operace ({ v, e, f }) podle aktuálního režimu. */
    function nastavVyberUpravy(vyb) {
      const u = sc.uprava, o = upravObj();
      if (!u || !o) return;
      const v = new Set(vyb.v || []), e = new Set(vyb.e || []), f = new Set(vyb.f || []);
      u.v = new Set(); u.e = new Set(); u.f = new Set();
      if (u.rezim === 'v') {
        u.v = v;
        for (const k of e) for (const i of U.vrcholyHrany(k)) u.v.add(i);
        for (const fi of f) for (const i of o.sit.f[fi] || []) u.v.add(i);
      } else if (u.rezim === 'e') {
        u.e = e;
        if (!e.size) {
          if (f.size) { for (const fi of f) for (const k of U.hranyPlochy(o.sit.f[fi] || [])) u.e.add(k); } else {
            for (const [k, h] of U.topologie(o.sit).hrany) if (v.has(h.a) && v.has(h.b)) u.e.add(k);
          }
        }
      } else {
        u.f = f;
        if (!f.size && v.size) o.sit.f.forEach((pl, fi) => { if (pl.every((i) => v.has(i))) u.f.add(fi); });
      }
    }

    function nastavRezim(rezim) {
      const u = sc.uprava;
      if (!u || u.rezim === rezim) return;
      const v = selV(), e = selE(), f = selF();
      u.rezim = rezim;
      u.v = rezim === 'v' ? new Set(v) : new Set();
      u.e = rezim === 'e' ? new Set(e) : new Set();
      u.f = rezim === 'f' ? new Set(f) : new Set();
      obnovVse();
    }

    function vsechnoVybrat(ano) {
      const u = sc.uprava, o = upravObj();
      if (!u || !o) return;
      u.v = new Set(); u.e = new Set(); u.f = new Set();
      if (ano) {
        if (u.rezim === 'v') for (let i = 0; i < o.sit.v.length / 3; i++) u.v.add(i);
        else if (u.rezim === 'e') for (const k of U.topologie(o.sit).hrany.keys()) u.e.add(k);
        else o.sit.f.forEach((_, fi) => u.f.add(fi));
      }
    }

    function obratVyber() {
      const u = sc.uprava, o = upravObj();
      if (!u || !o) return;
      if (u.rezim === 'v') { const n = new Set(); for (let i = 0; i < o.sit.v.length / 3; i++) if (!u.v.has(i)) n.add(i); u.v = n; }
      else if (u.rezim === 'e') { const n = new Set(); for (const k of U.topologie(o.sit).hrany.keys()) if (!u.e.has(k)) n.add(k); u.e = n; }
      else { const n = new Set(); o.sit.f.forEach((_, fi) => { if (!u.f.has(fi)) n.add(fi); }); u.f = n; }
      obnovVse();
    }

    function prepniUpravy() {
      if (uchop) return;
      ukonciRez();
      if (sc.uprava) {
        zapamatuj();
        sc.uprava = null;
        obnovVse();
        return;
      }
      const o = aktivniObj();
      if (!o || o.skryty) return toast({ title: 'Vyber objekt', body: 'Do režimu úprav se přepíná aktivní objekt.', icon: 'info', timeout: 2600 });
      if (!o.sit) return toast({ title: 'Světlo nemá síť', body: 'Upravovat jde jen tvary. Světlo posuneš a otočíš přes G a R.', icon: 'info', timeout: 2800 });
      zapamatuj();
      sc.vybrane = new Set([o.id]);
      sc.uprava = { id: o.id, rezim: 'v', v: new Set(), e: new Set(), f: new Set() };
      vsechnoVybrat(true);
      obnovVse();
    }

    /** Výsledek operace → nová síť a výběr (zapamatuj() už proběhlo). */
    function pouzij(res) {
      const o = upravObj();
      if (!o || !res) return false;
      o.sit = res.sit;
      nastavVyberUpravy(res.vyber || {});
      spinavy();
      obnovVse();
      uklidGpu();
      return true;
    }

    // ---------------------------------------------------------------- režim úprav: operace
    function vytahni() {
      const o = upravObj();
      if (!o) return;
      const plochy = [...selF()];
      zapamatuj();
      let res, normala = null;
      if (plochy.length) {
        res = U.vytahniPlochy(o.sit, plochy);
        if (M.len(res.normala) > 1e-6) normala = M.norm(M.smer(modelObj(o), res.normala));
      } else {
        res = U.vytahniHrany(o.sit, [...selE()]);
      }
      if (!res) { sc.undo.pop(); return toast({ title: 'Není co vytáhnout', body: 'Vyber plochy nebo okrajové hrany (třeba okraj roviny).', icon: 'info', timeout: 3200 }); }
      pouzij(res);
      zacniUchop('g', { bezZapamatovani: true, vlastniOsa: normala, nazevOsy: normala ? 'normála' : null });
    }

    function vsazeni() {
      const o = upravObj();
      const plochy = [...selF()];
      if (!o || !plochy.length) return toast({ title: 'Vyber plochy', body: 'Vsazení pracuje s plochami.', icon: 'info', timeout: 2600 });
      zacniUchop('i');
    }

    function duplikujVSiti() {
      const o = upravObj();
      const plochy = [...selF()];
      if (!o || !plochy.length) return toast({ title: 'Vyber plochy', body: 'Duplikovat jde jen celé plochy.', icon: 'info', timeout: 2600 });
      zapamatuj();
      pouzij(U.duplikujPlochy(o.sit, plochy));
      zacniUchop('g', { bezZapamatovani: true });
    }

    function smazVSiti(druh) {
      const o = upravObj();
      if (!o) return;
      const vyb = { v: selV(), e: selE(), f: selF() };
      if (druh === 'vrcholy' && !vyb.v.size) return;
      zapamatuj();
      pouzij(U.smaz(o.sit, druh, vyb));
    }

    function spoj(druh) {
      const o = upravObj();
      const vv = selV();
      if (!o || vv.size < 2) return toast({ title: 'Vyber aspoň dva vrcholy', body: '', icon: 'info', timeout: 2200 });
      zapamatuj();
      if (druh === 'stred') pouzij(U.spojDoStredu(o.sit, vv));
      else {
        const res = U.spojPodleVzdalenosti(o.sit, vv);
        pouzij(res);
        toast({ title: 'Spojeno podle vzdálenosti', body: `Odebráno vrcholů: ${res.odebrano}`, icon: 'check', timeout: 2200 });
      }
    }

    function vypln() {
      const o = upravObj();
      if (!o) return;
      const res = U.vypln(o.sit, selV());
      if (!res) return toast({ title: 'Tady nejde udělat plochu', body: 'Vyber vrcholy kolem díry (okraj, který se uzavírá).', icon: 'info', timeout: 3200 });
      zapamatuj();
      pouzij(res);
    }

    function rozdelit() {
      const o = upravObj();
      const plochy = [...selF()];
      if (!o || !plochy.length) return toast({ title: 'Vyber plochy', body: 'Rozdělení pracuje s plochami.', icon: 'info', timeout: 2600 });
      zapamatuj();
      pouzij(U.rozdel(o.sit, plochy));
    }

    function vyberPropojene(podMysi) {
      const o = upravObj();
      if (!o) return;
      let start;
      if (podMysi) {
        const pr = prvekPod(mys.x, mys.y, 'v');
        start = pr ? [pr.i] : null;
        if (!start) {
          const pl = prvekPod(mys.x, mys.y, 'f');
          start = pl ? o.sit.f[pl.i] : null;
        }
        if (!start) return;
      } else start = [...selV()];
      const vv = U.propojene(o.sit, start);
      if (podMysi) { const puv = selV(); for (const i of puv) vv.add(i); }
      nastavVyberUpravy({ v: vv });
      obnovVse();
    }

    function pridejDoSite(typ) {
      const o = upravObj();
      zapamatuj();
      pouzij(U.pripoj(o.sit, vytvor(typ)));
    }

    // řez smyčkou (Ctrl+R): najetí ukáže žlutý náhled, klik řízne
    function zacniRez(trvaly) {
      if (!sc.uprava) return;
      rez = { trvaly, kl: null, usecky: null };
      aktualizujRez();
      obnovListu();
      obnovStav();
    }
    function ukonciRez() {
      if (!rez) return;
      rez = null;
      obnovListu(); obnovStav(); pozadej();
    }
    function aktualizujRez() {
      const o = upravObj();
      if (!rez || !o || !pohled) return;
      const h = prvekPod(mys.x, mys.y, 'e');
      if (h?.k === rez.kl) return;
      rez.kl = h?.k ?? null;
      rez.usecky = null;
      if (h) {
        const n = U.nahledRezu(o.sit, h.k);
        if (n?.usecky.length) {
          const Mo = modelObj(o);
          rez.usecky = n.usecky.map(([a, b]) => [M.bod(Mo, a), M.bod(Mo, b)]);
        }
      }
      pozadej();
    }
    function provedRez() {
      const o = upravObj();
      if (!rez || !o || rez.kl === null || !rez.usecky) return;
      const res = U.rezSmyckou(o.sit, rez.kl);
      if (!res) return;
      zapamatuj();
      nastavRezim('e');
      pouzij(res);
      if (!rez.trvaly) ukonciRez(); else { rez.kl = null; aktualizujRez(); }
    }

    // ---------------------------------------------------------------- kamera
    function spocitejPohled() { pohled = pohledPro(view.clientWidth || 1, view.clientHeight || 1); }

    /** Matice kamery pro plátno W × H (výřez, snímek, video). */
    function pohledPro(W, H) {
      const cp = Math.cos(kam.pitch);
      const smerOka = [cp * Math.cos(kam.yaw), cp * Math.sin(kam.yaw), Math.sin(kam.pitch)];
      const oko = M.add(kam.stred, M.mul(smerOka, kam.dist));
      const V = M.lookAt(oko, kam.stred, [0, 0, 1]);
      const aspect = W / H;
      const pulV = kam.dist * Math.tan(FOV / 2);
      const P = kam.ortho
        ? M.ortho(-pulV * aspect, pulV * aspect, -pulV, pulV, -kam.dist * 50 - 100, kam.dist * 50 + 100)
        : M.perspective(FOV, aspect, Math.max(0.01, kam.dist * 0.005), kam.dist * 60 + 200);
      const vp = M.mul4(P, V);
      const vpravo = [V[0], V[4], V[8]], nahoru = [V[1], V[5], V[9]], dozadu = [V[2], V[6], V[10]];

      // ve čistě bočním ortogonálním pohledu se mřížka postaví čelem ke kameře (jako v Blenderu)
      let rovina = 'xy';
      if (kam.ortho && Math.abs(kam.pitch) < 0.001) {
        rovina = Math.abs(Math.sin(kam.yaw)) > 0.999 ? 'xz' : Math.abs(Math.cos(kam.yaw)) > 0.999 ? 'yz' : 'xy';
      }
      const stredMrizky = [...kam.stred];
      if (rovina === 'xy') stredMrizky[2] = 0; else if (rovina === 'xz') stredMrizky[1] = 0; else stredMrizky[0] = 0;
      const dosah = kam.ortho ? 1e5 : clamp(kam.dist * 3.5, 14, 60);
      return { W, H, vp, inv: M.invert(vp), oko, vpravo, nahoru, dozadu, rovina, stredMrizky, dosah, pulV };
    }

    /** Bod ve světě → pixely v okně (x, y, hloubka w). */
    function naObr(p) {
      const v = pohled.vp;
      const x = v[0] * p[0] + v[4] * p[1] + v[8] * p[2] + v[12];
      const y = v[1] * p[0] + v[5] * p[1] + v[9] * p[2] + v[13];
      const w = v[3] * p[0] + v[7] * p[1] + v[11] * p[2] + v[15];
      return [(x / w * 0.5 + 0.5) * pohled.W, (0.5 - y / w * 0.5) * pohled.H, w];
    }

    function paprsek(x, y) {
      const nx = x / pohled.W * 2 - 1, ny = 1 - y / pohled.H * 2;
      const a = M.bod(pohled.inv, [nx, ny, -1]), b = M.bod(pohled.inv, [nx, ny, 1]);
      return { o: a.slice(0, 3), d: M.norm(M.sub(b.slice(0, 3), a.slice(0, 3))) };
    }

    /** Kolik světových jednotek je jeden pixel v hloubce bodu p. */
    function jednotkaNaPx(p) {
      if (kam.ortho) return 2 * pohled.pulV / pohled.H;
      const hloubka = Math.max(0.001, -M.dot(M.sub(p, pohled.oko), pohled.dozadu));
      return 2 * hloubka * Math.tan(FOV / 2) / pohled.H;
    }

    function nastavPohled(cil, { ortho, nazev } = {}) {
      animace = { od: { ...kam, stred: [...kam.stred] }, do: cil, t0: performance.now() };
      if (ortho !== undefined) { kam.ortho = ortho; kam.autoOrtho = ortho; }
      kam.nazevPohledu = nazev ?? null;
      pozadej();
    }

    function osovyPohled(id) {
      const p = POHLEDY[id];
      nastavPohled({ yaw: p.yaw * M.DEG, pitch: clamp(p.pitch * M.DEG, -PITCH_MAX, PITCH_MAX) }, { ortho: true, nazev: p.nazev });
    }

    /** Pohled na vybrané (nebo na celou scénu): střed a vzdálenost podle obálky. */
    function zamer(jenVybrane) {
      const body = [];
      const o = upravObj();
      if (o && jenVybrane) {
        const Mo = modelObj(o), vv = selV();
        const idx = vv.size ? [...vv] : [...Array(o.sit.v.length / 3).keys()];
        for (const i of idx) body.push(M.bod(Mo, [o.sit.v[i * 3], o.sit.v[i * 3 + 1], o.sit.v[i * 3 + 2]]));
      } else {
        const kandidati = jenVybrane ? vybraneObj() : sc.objekty.filter((x) => !x.skryty);
        // světla (hlavně vzdálené slunce) se do záběru počítají, jen když nic jiného není
        const sTvary = kandidati.some((x) => x.sit);
        for (const ob of kandidati) {
          if (!ob.sit) { if (!sTvary) body.push(ob.poz); continue; }
          const Mo = modelObj(ob), v = ob.sit.v;
          for (let i = 0; i < v.length; i += 3) body.push(M.bod(Mo, [v[i], v[i + 1], v[i + 2]]));
        }
      }
      if (!body.length) return nastavPohled({ stred: [0, 0, 0], dist: 12 });
      const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
      for (const p of body) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[k]); mx[k] = Math.max(mx[k], p[k]); }
      const stred = mn.map((a, k) => (a + mx[k]) / 2);
      const polomer = Math.max(0.2, M.len(M.sub(mx, mn)) / 2);
      nastavPohled({ stred, dist: polomer / Math.sin(FOV / 2) * 1.15 });
    }

    function krokAnimace(ted) {
      if (!animace) return false;
      const tt = clamp((ted - animace.t0) / 240, 0, 1), k = 1 - (1 - tt) ** 3;
      const { od, do: cil } = animace;
      if (cil.yaw !== undefined) {
        let d = cil.yaw - od.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        kam.yaw = od.yaw + d * k;
      }
      if (cil.pitch !== undefined) kam.pitch = od.pitch + (cil.pitch - od.pitch) * k;
      if (cil.dist !== undefined) kam.dist = od.dist + (cil.dist - od.dist) * k;
      if (cil.stred) kam.stred = od.stred.map((a, i) => a + (cil.stred[i] - a) * k);
      if (tt >= 1) animace = null;
      return true;
    }

    function orbit(dx, dy) {
      kam.yaw -= dx * 0.008;
      kam.pitch = clamp(kam.pitch + dy * 0.008, -PITCH_MAX, PITCH_MAX);
      if (kam.autoOrtho) { kam.ortho = false; kam.autoOrtho = false; }
      kam.nazevPohledu = null;
      animace = null;
    }

    function posunPohled(dx, dy) {
      const j = jednotkaNaPx(kam.stred);
      kam.stred = M.add(kam.stred, M.add(M.mul(pohled.vpravo, -dx * j), M.mul(pohled.nahoru, dy * j)));
      animace = null;
    }

    // ---------------------------------------------------------------- volný pohyb (Fly/Walk v Blenderu)
    // Kamera se otáčí kolem vlastního oka (ne kolem středu), WASD letí, Q/E dolů/nahoru.
    // Klik / Enter = zůstat, pravé / Esc = vrátit pohled. Myš přes pointer lock, jinak movementX/Y.
    let volny = null;
    const KLAVESY_LETU = {
      KeyW: [1, 0, 0], ArrowUp: [1, 0, 0], KeyS: [-1, 0, 0], ArrowDown: [-1, 0, 0],
      KeyD: [0, 1, 0], ArrowRight: [0, 1, 0], KeyA: [0, -1, 0], ArrowLeft: [0, -1, 0],
      KeyE: [0, 0, 1], Space: [0, 0, 1], KeyQ: [0, 0, -1], KeyC: [0, 0, -1],
    };
    const smerKOku = () => { const cp = Math.cos(kam.pitch); return [cp * Math.cos(kam.yaw), cp * Math.sin(kam.yaw), Math.sin(kam.pitch)]; };
    const okoKamery = () => M.add(kam.stred, M.mul(smerKOku(), kam.dist));

    // WASD v běžném pohledu: W/S dopředu/dozadu tam, kam se kouká, A/D do stran. Rychlost podle vzdálenosti
    // kamery od středu (malá scéna = pomalu, velká = rychle); střed jede s kamerou, takže se rychlost nemění.
    const POHYB = { KeyW: [1, 0], KeyS: [-1, 0], KeyD: [0, 1], KeyA: [0, -1] };
    const drzene = new Set();
    let pohybBezi = false, pohybPosl = 0;

    function drzimPohyb(kod) {
      drzene.add(kod);
      if (pohybBezi) return;
      pohybBezi = true;
      pohybPosl = performance.now();
      animace = null;
      requestAnimationFrame(krokPohybu);
    }

    function krokPohybu(ted) {
      if (!drzene.size || volny || uchop || !view.isConnected) { pohybBezi = false; drzene.clear(); return; }
      const dt = Math.min(0.05, (ted - pohybPosl) / 1000);
      pohybPosl = ted;
      let f = 0, s = 0;
      for (const kod of drzene) { f += POHYB[kod][0]; s += POHYB[kod][1]; }
      const v = Math.max(0.5, kam.dist * 0.9) * dt;
      if (kam.ortho) {
        // v ortogonálním pohledu „dopředu“ nic nemění → W/S přibližuje, A/D posouvá
        if (f) kam.dist = clamp(kam.dist * Math.exp(-f * dt * 1.2), 0.05, 800);
        if (s) kam.stred = M.add(kam.stred, M.mul(pohled.vpravo, s * v));
      } else {
        const dopredu = M.mul(smerKOku(), -1);
        const vpravo = [-Math.sin(kam.yaw), Math.cos(kam.yaw), 0];
        kam.stred = M.add(kam.stred, M.add(M.mul(dopredu, f * v), M.mul(vpravo, s * v)));
      }
      if (rez) aktualizujRez();
      pozadej();
      requestAnimationFrame(krokPohybu);
    }

    function zacniVolny({ gravitace = false } = {}) {
      if (volny || uchop || exportBezi) return;
      if (rez) ukonciRez();
      tah = null; animace = null;
      const oko = okoKamery();
      volny = {
        puvodni: { ...kam, stred: [...kam.stred] },
        klavesy: new Set(), shift: false,
        rychlost: clamp(Math.round(kam.dist * 0.5), 1, 50),   // m/s, kolečkem se mění
        posl: performance.now(),
      };
      kam.ortho = false; kam.autoOrtho = false; kam.nazevPohledu = null;
      kam.dist = 1;
      kam.stred = M.sub(oko, smerKOku());
      view.classList.add('let');
      view.focus({ preventScroll: true });
      try { const z = view.requestPointerLock?.(); z?.catch?.(() => {}); } catch { /* bez zámku jede movementX */ }
      if (gravitace) prepniGravitaci();
      requestAnimationFrame(krokLetu);
      pozadej();
    }

    function ukonciVolny(potvrdit) {
      if (!volny) return;
      if (!potvrdit) Object.assign(kam, volny.puvodni);
      volny = null;
      view.classList.remove('let');
      if (document.pointerLockElement === view) document.exitPointerLock();
      pozadej();
    }

    function rozhlizej(dx, dy) {
      const oko = okoKamery();
      kam.yaw -= dx * 0.0025;
      kam.pitch = clamp(kam.pitch + dy * 0.0025, -PITCH_MAX, PITCH_MAX);
      kam.stred = M.sub(oko, M.mul(smerKOku(), kam.dist));
      pozadej();
    }

    // chůze (Tab za letu): oči ve výšce 1,7 m, schod do 0,5 m, skok ~1 m, země = nejvyšší plocha pod nohama nebo z = 0
    const OCI = 1.7, SCHOD = 0.5, TIHA = 9.81, SKOK = Math.sqrt(2 * TIHA * 1.0);

    /** Výška povrchu pod bodem p (svisle dolů z výšky `od`); bez zásahu rovina z = 0. */
    function zemPod(p, od) {
      const o = [p[0], p[1], od], d = [0, 0, -1];
      let nej = od >= 0 ? 0 : -Infinity;
      for (const ob of sc.objekty) {
        if (ob.skryty || !ob.sit) continue;
        const inv = M.invert(modelObj(ob));
        const lo = M.bod(inv, o).slice(0, 3), ld = M.smer(inv, d);
        const tri = r.pick(ob);
        for (let i = 0; i < tri.length; i += 3) {
          const t = M.paprsekTroj(lo, ld, tri[i], tri[i + 1], tri[i + 2]);
          if (t > 0 && od - t > nej) nej = od - t;
        }
      }
      return nej;
    }

    function prepniGravitaci() {
      volny.gravitace = !volny.gravitace;
      volny.vz = 0;
      volny.naZemi = false;
      // chůze má vlastní rychlost (lidský krok), let si tu svou pamatuje
      [volny.rychlost, volny.rychlostDruha] = [volny.rychlostDruha ?? (volny.gravitace ? 2.5 : volny.rychlost), volny.rychlost];
      pozadej();
    }

    function krokChuze(dt, s) {
      const oko = okoKamery();
      const p = [...oko];
      if (s[0] || s[1]) {
        const dopredu = [-Math.cos(kam.yaw), -Math.sin(kam.yaw), 0];   // jen po zemi, i když se díváš nahoru
        const vpravo = [-Math.sin(kam.yaw), Math.cos(kam.yaw), 0];
        const v = volny.rychlost * (volny.shift ? 2 : 1) * dt / Math.max(1, Math.hypot(s[0], s[1]));
        p[0] += (dopredu[0] * s[0] + vpravo[0] * s[1]) * v;
        p[1] += (dopredu[1] * s[0] + vpravo[1] * s[1]) * v;
      }
      const zem = zemPod(p, p[2] - OCI + SCHOD);
      volny.vz -= TIHA * dt;
      p[2] += volny.vz * dt;
      if (p[2] <= zem + OCI) { p[2] = zem + OCI; volny.vz = 0; volny.naZemi = true; }
      else volny.naZemi = false;
      if (p[0] !== oko[0] || p[1] !== oko[1] || p[2] !== oko[2]) {
        kam.stred = M.add(kam.stred, M.sub(p, oko));
        pozadej();
      }
    }

    function krokLetu(ted) {
      if (!volny || !view.isConnected) return;
      const dt = Math.min(0.05, (ted - volny.posl) / 1000);
      volny.posl = ted;
      const s = [0, 0, 0];
      for (const kod of volny.klavesy) { const d = KLAVESY_LETU[kod]; if (d) for (let i = 0; i < 3; i++) s[i] += d[i]; }
      if (volny.gravitace) { krokChuze(dt, s); requestAnimationFrame(krokLetu); return; }
      if (s[0] || s[1] || s[2]) {
        const k = smerKOku();
        const dopredu = M.mul(k, -1);                                   // kam kamera kouká (i nahoru/dolů)
        const vpravo = [-Math.sin(kam.yaw), Math.cos(kam.yaw), 0];
        const v = volny.rychlost * (volny.shift ? 3 : 1) * dt;
        const posun = M.add(M.add(M.mul(dopredu, s[0] * v), M.mul(vpravo, s[1] * v)), [0, 0, s[2] * v]);
        kam.stred = M.add(kam.stred, posun);
        pozadej();
      }
      requestAnimationFrame(krokLetu);
    }

    const naZamek = () => {
      // Esc v prohlížeči zámek zruší dřív, než nám pošle klávesu → bereme to jako Esc
      if (volny && document.pointerLockElement !== view && volny.zamceno) ukonciVolny(false);
      if (volny && document.pointerLockElement === view) volny.zamceno = true;
    };
    const naBlur = () => { drzene.clear(); if (volny) { volny.klavesy.clear(); volny.shift = false; } };
    document.addEventListener('pointerlockchange', naZamek);
    window.addEventListener('blur', naBlur);

    // ---------------------------------------------------------------- výběr myší (objekty)
    function svetloPod(x, y) {
      let nej = null, nejD = 13;
      for (const ob of sc.objekty) {
        if (!jeSvetlo(ob) || ob.skryty) continue;
        const s = naObr(ob.poz);
        const d = Math.hypot(s[0] - x, s[1] - y);
        if (s[2] > 0 && d < nejD) { nejD = d; nej = ob; }
      }
      return nej;
    }

    function objektPod(x, y) {
      const sv = svetloPod(x, y);
      if (sv) return sv;
      const { o, d } = paprsek(x, y);
      let nej = null, nejT = Infinity;
      for (const ob of sc.objekty) {
        if (ob.skryty || !ob.sit) continue;
        const inv = M.invert(modelObj(ob));
        const lo = M.bod(inv, o).slice(0, 3), ld = M.smer(inv, d);
        const tri = r.pick(ob);
        for (let i = 0; i < tri.length; i += 3) {
          const tt = M.paprsekTroj(lo, ld, tri[i], tri[i + 1], tri[i + 2]);
          if (tt > 0 && tt < nejT) { nejT = tt; nej = ob; }
        }
      }
      return nej;
    }

    function vyberRameckem(a, b, pridat) {
      const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
      const uvnitr = (s) => s[2] > 0 && s[0] >= x0 && s[0] <= x1 && s[1] >= y0 && s[1] <= y1;
      if (sc.uprava) return vyberRameckemUpravy(uvnitr, pridat);
      const zasah = [];
      for (const o of sc.objekty) {
        if (o.skryty) continue;
        if (!o.sit) { if (uvnitr(naObr(o.poz))) zasah.push(o.id); continue; }
        const Mo = modelObj(o), v = o.sit.v;
        for (let i = 0; i < v.length; i += 3) {
          if (uvnitr(naObr(M.bod(Mo, [v[i], v[i + 1], v[i + 2]])))) { zasah.push(o.id); break; }
        }
      }
      vyber(zasah, { pridat, aktivni: zasah.length ? (zasah.includes(sc.aktivni) ? sc.aktivni : zasah[0]) : (pridat ? sc.aktivni : null) });
    }

    // ---------------------------------------------------------------- výběr myší (režim úprav)
    const trojCache = new WeakMap();
    const troj = (sit) => { let x = trojCache.get(sit); if (!x) { x = U.trojuhelniky(sit); trojCache.set(sit, x); } return x; };

    /** Je bod (lokálně) vidět, nebo ho zakrývá vlastní síť? V drátovém režimu je vidět všechno. */
    function viditelny(o, inv, pSvet) {
      if (sc.drat) return true;
      const od = kam.ortho ? M.add(pSvet, M.mul(pohled.dozadu, kam.dist * 4 + 50)) : pohled.oko;
      const lo = M.bod(inv, od).slice(0, 3), lp = M.bod(inv, pSvet).slice(0, 3);
      const d = M.sub(lp, lo);
      const v = o.sit.v;
      for (const [a, b, c] of troj(o.sit)) {
        const tt = M.paprsekTroj(lo, d, [v[a * 3], v[a * 3 + 1], v[a * 3 + 2]], [v[b * 3], v[b * 3 + 1], v[b * 3 + 2]], [v[c * 3], v[c * 3 + 1], v[c * 3 + 2]]);
        if (tt > 0 && tt < 0.999) return false;
      }
      return true;
    }

    /** Body sítě ve světě a na obrazovce. */
    function promitni(o) {
      const Mo = modelObj(o), v = o.sit.v, svet = [], obr = [];
      for (let i = 0; i < v.length; i += 3) {
        const p = M.bod(Mo, [v[i], v[i + 1], v[i + 2]]).slice(0, 3);
        svet.push(p); obr.push(naObr(p));
      }
      return { Mo, inv: M.invert(Mo), svet, obr };
    }

    /** Vrchol / hrana / plocha pod myší: { i } nebo { k } nebo { i: plocha }. */
    function prvekPod(x, y, rezim = sc.uprava?.rezim) {
      const o = upravObj();
      if (!o || !pohled) return null;
      const pr = promitni(o);
      if (rezim === 'v') {
        const kand = [];
        pr.obr.forEach((s, i) => { if (s[2] > 0) { const d = Math.hypot(s[0] - x, s[1] - y); if (d < 14) kand.push({ i, d }); } });
        kand.sort((a, b) => a.d - b.d);
        for (const c of kand.slice(0, 12)) if (viditelny(o, pr.inv, pr.svet[c.i])) return { i: c.i };
        return null;
      }
      if (rezim === 'e') {
        const kand = [];
        for (const [k, h] of U.topologie(o.sit).hrany) {
          const a = pr.obr[h.a], b = pr.obr[h.b];
          if (a[2] <= 0 || b[2] <= 0) continue;
          const d = vzdalUsecka(x, y, a[0], a[1], b[0], b[1]);
          if (d < 10) kand.push({ k, d, h });
        }
        kand.sort((a, b) => a.d - b.d);
        for (const c of kand.slice(0, 12)) {
          const mid = M.mul(M.add(pr.svet[c.h.a], pr.svet[c.h.b]), 0.5);
          if (viditelny(o, pr.inv, mid)) return { k: c.k };
        }
        return null;
      }
      // plochy — paprsek
      const { o: po, d } = paprsek(x, y);
      const lo = M.bod(pr.inv, po).slice(0, 3), ld = M.smer(pr.inv, d);
      const v = o.sit.v;
      let nej = null, nejT = Infinity;
      for (const [a, b, c, fi] of troj(o.sit)) {
        const tt = M.paprsekTroj(lo, ld, [v[a * 3], v[a * 3 + 1], v[a * 3 + 2]], [v[b * 3], v[b * 3 + 1], v[b * 3 + 2]], [v[c * 3], v[c * 3 + 1], v[c * 3 + 2]]);
        if (tt > 0 && tt < nejT) { nejT = tt; nej = fi; }
      }
      return nej === null ? null : { i: nej };
    }

    const jeVybrany = (pr) => {
      const u = sc.uprava;
      return u.rezim === 'e' ? u.e.has(pr.k) : (u.rezim === 'v' ? u.v : u.f).has(pr.i);
    };

    function klikUpravy(pr, pridat, smycka) {
      const u = sc.uprava, o = upravObj();
      if (smycka && pr) {
        // Alt+klik: smyčka hran, v režimu ploch pás ploch
        let k = pr.k;
        if (k === undefined) { const h = prvekPod(mys.x, mys.y, 'e'); k = h?.k; }
        if (k === undefined) return;
        if (!pridat) { u.v = new Set(); u.e = new Set(); u.f = new Set(); }
        if (u.rezim === 'f') { const p = U.prstenec(o.sit, k); if (p) for (const fi of p.plochy) u.f.add(fi); }
        else {
          const sm = U.smyckaHran(o.sit, k);
          if (u.rezim === 'e') for (const x of sm) u.e.add(x);
          else for (const x of sm) for (const i of U.vrcholyHrany(x)) u.v.add(i);
        }
        obnovVse();
        return;
      }
      if (!pr) { if (!pridat) { vsechnoVybrat(false); obnovVse(); } return; }
      const mn = u.rezim === 'e' ? u.e : u.rezim === 'v' ? u.v : u.f;
      const kl = u.rezim === 'e' ? pr.k : pr.i;
      if (pridat) { if (mn.has(kl)) mn.delete(kl); else mn.add(kl); } else { mn.clear(); mn.add(kl); }
      obnovVse();
    }

    function vyberRameckemUpravy(uvnitr, pridat) {
      const u = sc.uprava, o = upravObj();
      const pr = promitni(o);
      const vid = (i) => uvnitr(pr.obr[i]) && viditelny(o, pr.inv, pr.svet[i]);
      if (!pridat) vsechnoVybrat(false);
      if (u.rezim === 'v') { pr.obr.forEach((_, i) => { if (vid(i)) u.v.add(i); }); }
      else if (u.rezim === 'e') {
        const ok = new Map();
        const v = (i) => { if (!ok.has(i)) ok.set(i, vid(i)); return ok.get(i); };
        for (const [k, h] of U.topologie(o.sit).hrany) if (v(h.a) && v(h.b)) u.e.add(k);
      } else {
        o.sit.f.forEach((pl, fi) => {
          const c = M.bod(pr.Mo, U.stredPlochy(o.sit, fi)).slice(0, 3);
          if (uvnitr(naObr(c)) && viditelny(o, pr.inv, c)) u.f.add(fi);
        });
      }
      obnovVse();
    }

    // ---------------------------------------------------------------- G / R / S / I
    function pivot() {
      const o = upravObj();
      if (o) {
        const Mo = modelObj(o), vv = selV();
        const s = [0, 0, 0];
        for (const i of vv) { const p = M.bod(Mo, [o.sit.v[i * 3], o.sit.v[i * 3 + 1], o.sit.v[i * 3 + 2]]); for (let k = 0; k < 3; k++) s[k] += p[k] / vv.size; }
        return s;
      }
      const objs = vybraneObj();
      const s = [0, 0, 0];
      for (const ob of objs) for (let k = 0; k < 3; k++) s[k] += ob.poz[k] / objs.length;
      return s;
    }

    const neniCoUpravit = () => (sc.uprava ? selV().size === 0 : vybraneObj().length === 0);

    function zacniUchop(typ, { osa = null, myskou = false, bezZapamatovani = false, vlastniOsa = null, nazevOsy = null } = {}) {
      if (neniCoUpravit()) return;
      if (!mys.uvnitr && pohled) mys = { x: pohled.W / 2, y: pohled.H / 2 + 60, uvnitr: true };
      if (!bezZapamatovani) zapamatuj();
      const p = pivot();
      uchop = {
        typ, osa, myskou, cislo: '', vlastniOsa, nazevVlastniOsy: nazevOsy,
        start: { x: mys.x, y: mys.y },
        pivot: p, pivotObr: naObr(p),
        uhel: 0, posledniUhel: null, info: '',
      };
      const o = upravObj();
      if (o) {
        const Mo = modelObj(o);
        const idx = [...selV()];
        uchop.edit = {
          o, sit0: o.sit, idx, M: Mo, inv: M.invert(Mo), plochy: [...selF()],
          svet0: idx.map((i) => M.bod(Mo, [o.sit.v[i * 3], o.sit.v[i * 3 + 1], o.sit.v[i * 3 + 2]]).slice(0, 3)),
        };
      } else {
        uchop.puvodni = new Map(vybraneObj().map((ob) => [ob.id, { poz: [...ob.poz], rot: [...ob.rot], mer: [...ob.mer] }]));
      }
      najeto = null;
      aktualizujUchop(false);
      obnovVse();
    }

    /** V režimu úprav: nová poloha vybraných vrcholů z funkce svět → svět. */
    function posunVrcholy(fn) {
      const ed = uchop.edit;
      const v = ed.sit0.v.slice();
      ed.idx.forEach((i, j) => {
        const l = M.bod(ed.inv, fn(ed.svet0[j]));
        v[i * 3] = l[0]; v[i * 3 + 1] = l[1]; v[i * 3 + 2] = l[2];
      });
      nastavMeziSit({ v, f: ed.sit0.f });
    }

    function nastavMeziSit(sit) {
      const ed = uchop.edit;
      if (ed.o.sit !== ed.sit0) r.zapomen(ed.o.sit);
      ed.o.sit = sit;
    }

    function aktualizujUchop(ctrl) {
      const u = uchop;
      if (!u) return;
      const cislo = u.cislo !== '' && u.cislo !== '-' && u.cislo !== '.' ? parseFloat(u.cislo.replace(',', '.')) : null;
      const osaV = u.osa !== null ? E[u.osa] : u.vlastniOsa;
      const nazevOsy = u.osa !== null ? OSY[u.osa] : u.vlastniOsa ? t(u.nazevVlastniOsy || 'osa') : '';
      const [px, py] = u.pivotObr;

      if (u.typ === 'g') {
        let delta;
        if (cislo !== null) {
          delta = M.mul(osaV ? M.norm(osaV) : E[0], cislo);
        } else if (!osaV) {
          const n = pohled.dozadu;
          const naRovinu = (x, y) => {
            const { o, d } = paprsek(x, y);
            const tt = M.dot(M.sub(u.pivot, o), n) / (M.dot(d, n) || 1e-9);
            return M.add(o, M.mul(d, tt));
          };
          delta = M.sub(naRovinu(mys.x, mys.y), naRovinu(u.start.x, u.start.y));
        } else {
          const A = M.norm(osaV);
          const p0 = paprsek(u.start.x, u.start.y), p1 = paprsek(mys.x, mys.y);
          const t0 = M.nejblizsiNaPrimce(u.pivot, A, p0.o, p0.d), t1 = M.nejblizsiNaPrimce(u.pivot, A, p1.o, p1.d);
          delta = M.mul(A, t1 - t0);
        }
        if (ctrl && cislo === null) {
          const krok = 10 ** Math.floor(Math.log10(Math.max(kam.dist, 0.1) / 2));
          if (osaV && u.osa === null) {
            const A = M.norm(osaV);
            delta = M.mul(A, Math.round(M.dot(delta, A) / krok) * krok);
          } else delta = delta.map((x) => Math.round(x / krok) * krok);
        }
        if (u.edit) posunVrcholy((p) => M.add(p, delta));
        else for (const o of sc.objekty) { const p = u.puvodni.get(o.id); if (p) o.poz = M.add(p.poz, delta); }
        u.info = !osaV
          ? t('Posun: {x} m', { x: `${fmt(delta[0])}  ${fmt(delta[1])}  ${fmt(delta[2])}` })
          : t('Posun {o}: {x} m', { o: nazevOsy, x: u.cislo !== '' ? u.cislo : fmt(u.osa !== null ? delta[u.osa] : M.dot(delta, M.norm(osaV))) });
      } else if (u.typ === 'r') {
        const a = Math.atan2(-(mys.y - py), mys.x - px);
        if (u.posledniUhel === null) u.posledniUhel = Math.atan2(-(u.start.y - py), u.start.x - px);
        let d = a - u.posledniUhel;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        u.uhel += d;
        u.posledniUhel = a;
        const osa = osaV ? M.norm(osaV) : pohled.dozadu;
        let stupne = u.uhel / M.DEG * (M.dot(osa, pohled.dozadu) >= 0 ? 1 : -1);
        if (cislo !== null) stupne = cislo;
        else if (ctrl) stupne = Math.round(stupne / 5) * 5;
        const R = M.kolemOsy(osa, stupne * M.DEG);
        if (u.edit) posunVrcholy((p) => M.add(u.pivot, M.aplikuj3(R, M.sub(p, u.pivot))));
        else {
          for (const o of sc.objekty) {
            const p = u.puvodni.get(o.id);
            if (!p) continue;
            o.rot = M.euler(M.mul3(R, M.rotace(p.rot))).map((x) => Math.round(x * 1e4) / 1e4);
            o.poz = M.add(u.pivot, M.aplikuj3(R, M.sub(p.poz, u.pivot)));
          }
        }
        u.info = t(osaV ? 'Otočení {o}: {x}°' : 'Otočení: {x}°', { o: nazevOsy, x: u.cislo !== '' ? u.cislo : fmt(stupne, 1) });
      } else if (u.typ === 's') {
        // start těsně u středu by dal obří skoky (třeba hned po řezu smyčkou) — počítá se aspoň od 60 px
        const d0 = Math.max(60, Math.hypot(u.start.x - px, u.start.y - py));
        let f = 1 + (Math.hypot(mys.x - px, mys.y - py) - Math.hypot(u.start.x - px, u.start.y - py)) / d0;
        f = Math.max(0, f);
        if (cislo !== null) f = cislo;
        else if (ctrl) f = Math.round(f * 10) / 10;
        if (u.edit) {
          posunVrcholy((p) => p.map((x, k) => (u.osa === null || k === u.osa ? u.pivot[k] + (x - u.pivot[k]) * f : x)));
        } else {
          for (const o of sc.objekty) {
            const p = u.puvodni.get(o.id);
            if (!p) continue;
            if (u.osa === null) {
              o.mer = p.mer.map((m) => m * f);
              o.poz = M.add(u.pivot, M.mul(M.sub(p.poz, u.pivot), f));
            } else {
              // světová osa → nejpodobnější osa objektu (u neotočených je to ta samá)
              const R = M.rotace(p.rot);
              let nej = 0, nejD = -1;
              for (let k = 0; k < 3; k++) { const dd = Math.abs(R[u.osa][k]); if (dd > nejD) { nejD = dd; nej = k; } }
              o.mer = p.mer.map((m, k) => (k === nej ? m * f : m));
              o.poz = p.poz.map((x, k) => (k === u.osa ? u.pivot[k] + (x - u.pivot[k]) * f : x));
            }
          }
        }
        u.info = t(u.osa === null ? 'Měřítko: {x}' : 'Měřítko {o}: {x}', { o: nazevOsy, x: u.cislo !== '' ? u.cislo : fmt(f, 3) });
      } else if (u.typ === 'i') {
        // vsazení: myš blíž ke středu = širší okraj
        const d0 = Math.max(60, Math.hypot(u.start.x - px, u.start.y - py));
        let tt = clamp(1 - Math.hypot(mys.x - px, mys.y - py) / d0, 0, 0.95);
        if (cislo !== null) tt = clamp(cislo, 0, 0.99);
        else if (ctrl) tt = Math.round(tt * 20) / 20;
        const res = U.vsad(u.edit.sit0, u.edit.plochy, tt);
        nastavMeziSit(res.sit);
        nastavVyberUpravy(res.vyber);
        u.info = t('Vsazení: {x}', { x: u.cislo !== '' ? u.cislo : fmt(tt, 3) });
      }
      verzeVyberu++;
      obnovVlastnosti();
      pozadej();
    }

    function potvrdUchop() {
      if (!uchop) return;
      uchop = null;
      spinavy();
      obnovVse();
      if (sc.uprava) uklidGpu();
    }

    function zrusUchop() {
      if (!uchop) return;
      uchop = null;
      obnovSnimek(sc.undo.pop());
      obnovVse();
      uklidGpu();
    }

    /** Přepnutí G ↔ R ↔ S za běhu, jako v Blenderu. */
    function prepniUchop(typ, ctrl) {
      const u = uchop;
      if (u.typ === 'i') return;
      if (u.edit) nastavMeziSit(u.edit.sit0);
      else for (const o of sc.objekty) { const p = u.puvodni.get(o.id); if (p) { o.poz = p.poz; o.rot = p.rot; o.mer = p.mer; } }
      const { start, myskou } = u;
      uchop = null;
      zacniUchop(typ, { bezZapamatovani: true, myskou });
      if (uchop) { uchop.start = start; aktualizujUchop(ctrl); }
    }

    // ---------------------------------------------------------------- gizmo
    function gizmo() {
      if (uchop || rez || sc.nastroj === 'vyber' || neniCoUpravit()) return null;
      const p = pivot();
      const P = naObr(p);
      if (P[2] <= 0) return null;
      const j = jednotkaNaPx(p);
      const g = { typ: sc.nastroj, P, osy: [], kruhy: [] };
      for (let k = 0; k < 3; k++) {
        const konec = naObr(M.add(p, M.mul(E[k], 82 * j)));
        const dx = konec[0] - P[0], dy = konec[1] - P[1];
        g.osy.push({ k, konec, delka: Math.hypot(dx, dy) });
      }
      if (g.typ === 'otoceni') {
        for (let k = 0; k < 3; k++) {
          const a = E[(k + 1) % 3], b = E[(k + 2) % 3];
          const body = [];
          for (let i = 0; i <= 64; i++) {
            const uh = i / 64 * Math.PI * 2;
            const w = M.add(M.mul(a, Math.cos(uh) * 72 * j), M.mul(b, Math.sin(uh) * 72 * j));
            const s = naObr(M.add(p, w));
            body.push({ x: s[0], y: s[1], vpredu: M.dot(w, pohled.dozadu) >= -1e-6 });
          }
          g.kruhy.push({ k, body });
        }
      }
      return g;
    }

    function vzdalUsecka(px, py, ax, ay, bx, by) {
      const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy || 1;
      const tt = clamp(((px - ax) * dx + (py - ay) * dy) / l, 0, 1);
      return Math.hypot(px - ax - dx * tt, py - ay - dy * tt);
    }

    /** Úchyt gizma pod myší: { typ: 'g'|'r'|'s', osa } nebo null. */
    function uchytPod(g, x, y) {
      if (!g) return null;
      const [px, py] = g.P;
      const dStred = Math.hypot(x - px, y - py);
      const typ = { presun: 'g', otoceni: 'r', meritko: 's' }[g.typ];
      if (g.typ === 'otoceni') {
        let nej = null, nejD = 8;
        for (const kr of g.kruhy) {
          for (let i = 1; i < kr.body.length; i++) {
            const a = kr.body[i - 1], b = kr.body[i];
            if (!a.vpredu && !b.vpredu) continue;
            const d = vzdalUsecka(x, y, a.x, a.y, b.x, b.y);
            if (d < nejD) { nejD = d; nej = kr.k; }
          }
        }
        if (nej !== null) return { typ, osa: nej };
        if (Math.abs(dStred - 92) < 7) return { typ, osa: null };
        return null;
      }
      for (const o of g.osy) {
        if (o.delka < 14) continue;
        const ax = px + (o.konec[0] - px) * 0.2, ay = py + (o.konec[1] - py) * 0.2;
        if (vzdalUsecka(x, y, ax, ay, o.konec[0], o.konec[1]) < 8) return { typ, osa: o.k };
      }
      if (g.typ === 'presun' && dStred < 11) return { typ, osa: null };
      if (g.typ === 'meritko' && Math.abs(dStred - 18) < 6) return { typ, osa: null };
      return null;
    }

    // ---------------------------------------------------------------- navigační gizmo (vpravo nahoře)
    function navGeom() {
      const c = { x: pohled.W - 62, y: 62 };
      const kulicky = [];
      for (let k = 0; k < 3; k++) {
        for (const znam of [1, -1]) {
          const e = M.mul(E[k], znam);
          kulicky.push({
            k, znam,
            x: c.x + M.dot(e, pohled.vpravo) * 40,
            y: c.y - M.dot(e, pohled.nahoru) * 40,
            hloubka: M.dot(e, pohled.dozadu),
          });
        }
      }
      kulicky.sort((a, b) => a.hloubka - b.hloubka);
      return { c, kulicky };
    }

    function navPod(x, y) {
      const n = navGeom();
      for (let i = n.kulicky.length - 1; i >= 0; i--) {
        const b = n.kulicky[i];
        if (Math.hypot(x - b.x, y - b.y) < (b.znam > 0 ? 10 : 8)) return b;
      }
      if (Math.hypot(x - n.c.x, y - n.c.y) < 54) return 'kruh';
      return null;
    }

    function navKlik(b) {
      const id = [['prava', 'leva'], ['zadni', 'predni'], ['horni', 'dolni']][b.k][b.znam > 0 ? 0 : 1];
      osovyPohled(id);
    }

    // ---------------------------------------------------------------- kreslení
    let naplanovano = false;
    function pozadej() {
      if (naplanovano) return;
      naplanovano = true;
      requestAnimationFrame(snimekOkna);
    }

    function velikost() {
      const dpr = window.devicePixelRatio || 1;
      const W = Math.max(1, view.clientWidth), H = Math.max(1, view.clientHeight);
      for (const c of [cv, ov]) {
        const w = Math.round(W * dpr), h = Math.round(H * dpr);
        if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      }
    }

    // data pro překryv režimu úprav — přepočítají se jen když se změní síť, výběr nebo drát
    let upravaData = null;
    function dataUpravy() {
      const o = upravObj();
      if (!o) return null;
      const u = sc.uprava;
      const klic = `${verzeVyberu}|${sc.drat}|${u.rezim}`;
      if (upravaData && upravaData.sit === o.sit && upravaData.klic === klic) {
        upravaData.gl.M = modelObj(o);
        return upravaData.gl;
      }
      const vv = selV(), ee = selE(), ff = selF();
      const v = o.sit.v;
      const P = (i) => [v[i * 3], v[i * 3 + 1], v[i * 3 + 2]];
      const plochy = [], cary = [], body = [];
      for (const fi of ff) {
        const pl = o.sit.f[fi];
        if (!pl) continue;
        for (let k = 1; k < pl.length - 1; k++) for (const i of [pl[0], pl[k], pl[k + 1]]) plochy.push(...P(i), ...BARVA_PLOCHA);
      }
      const nevybrana = sc.drat ? [0.78, 0.78, 0.8, 0.75] : [0.02, 0.02, 0.03, 0.9];
      for (const [k, h] of U.topologie(o.sit).hrany) {
        const b = ee.has(k) ? BARVA_VYBER : nevybrana;
        cary.push(...P(h.a), ...b, ...P(h.b), ...b);
      }
      if (u.rezim === 'v') {
        for (let i = 0; i < v.length / 3; i++) body.push(...P(i), ...(vv.has(i) ? BARVA_VYBER : nevybrana));
      } else if (u.rezim === 'f') {
        o.sit.f.forEach((pl, fi) => body.push(...U.stredPlochy(o.sit, fi), ...(ff.has(fi) ? BARVA_VYBER : [0.05, 0.05, 0.06, 0.8])));
      }
      upravaData = {
        sit: o.sit, klic,
        gl: { id: o.id, M: modelObj(o), verze: Math.random(), plochy: new Float32Array(plochy), cary: new Float32Array(cary), body: new Float32Array(body) },
      };
      return upravaData.gl;
    }

    function snimekOkna(ted) {
      naplanovano = false;
      if (!view.isConnected || exportBezi) return;
      const anim = krokAnimace(ted);
      velikost();
      spocitejPohled();
      const vybrane = new Set(vybraneObj().map((o) => o.id));
      if (sc.uprava) vybrane.delete(sc.uprava.id);
      r.kresli(sc.objekty, pohled, {
        drat: sc.drat, mrizka: sc.mrizka, vybrane, aktivni: sc.uprava ? null : sc.aktivni, uprava: dataUpravy(),
        render: (sc.render || (sc.pro && sc.uprava)) && !sc.drat ? renderNastaveni() : null,
      });
      view.classList.toggle('pro', ptAktivni());
      if (ptAktivni()) ptKresli();
      kresliPrekryv();
      if (anim) pozadej();
    }

    /** Světla scény pro renderer (max 4); bez světel svítí výchozí slunce od kamery. */
    function renderNastaveni(pevneSlunce = false) {
      const svetla = sc.objekty.filter((o) => jeSvetlo(o) && !o.skryty).slice(0, MAX_SVETEL).map((o) => ({
        druh: { bod: 0, slunce: 1, reflektor: 2 }[o.druh], poz: [...o.poz], smer: smerSvetla(o),
        barva: linearni(hexNaRgb(o.barva)), sila: o.sila, uhel: o.uhel * M.DEG, mekkost: o.mekkost, stiny: o.stiny, polomer: o.polomer,
      }));
      if (!svetla.length && pohled) {
        const L = pevneSlunce ? M.norm([-0.45, -0.35, 0.82])
          : M.norm(M.add(M.add(M.mul(pohled.vpravo, -0.45), M.mul(pohled.nahoru, 0.8)), M.mul(pohled.dozadu, 0.4)));
        svetla.push({ druh: 1, poz: [0, 0, 0], smer: M.mul(L, -1), barva: [1, 0.97, 0.92], sila: 3, uhel: 1, mekkost: 0, stiny: true, polomer: 0.3 });
      }
      return { svetla, svet: linearni(hexNaRgb(sc.svet.barva)).map((x) => x * sc.svet.sila) };
    }

    function kresliSvetla(c) {
      for (const o of sc.objekty) {
        if (!jeSvetlo(o) || o.skryty) continue;
        const [x, y, w] = naObr(o.poz);
        if (w <= 0) continue;
        const akt = o.id === sc.aktivni && !sc.uprava, vyb = sc.vybrane.has(o.id) && !sc.uprava;
        const barva = akt ? '#ffb347' : vyb ? '#ee7a1a' : 'rgba(230,230,232,.85)';
        c.lineWidth = 1.3;
        c.strokeStyle = barva;
        if (o.druh !== 'slunce' && Math.abs(o.poz[2]) > 0.01) {
          const z = naObr([o.poz[0], o.poz[1], 0]);
          if (z[2] > 0) {
            c.setLineDash([3, 4]);
            c.beginPath(); c.moveTo(x, y); c.lineTo(z[0], z[1]);
            c.strokeStyle = 'rgba(0,0,0,.45)'; c.stroke();
            c.setLineDash([]);
            c.strokeStyle = barva;
          }
        }
        if (o.druh !== 'bod') {
          const d = smerSvetla(o);
          if (o.druh === 'reflektor') {
            const delka = 2, r0 = Math.tan(o.uhel * M.DEG / 2) * delka;
            const a = M.norm(M.cross(d, Math.abs(d[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1])), b = M.cross(d, a);
            const kruh = [];
            for (let i = 0; i <= 32; i++) {
              const t2 = i / 32 * Math.PI * 2;
              kruh.push(naObr(M.add(M.add(o.poz, M.mul(d, delka)), M.add(M.mul(a, Math.cos(t2) * r0), M.mul(b, Math.sin(t2) * r0)))));
            }
            c.beginPath();
            kruh.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
            for (const i of [0, 8, 16, 24]) { c.moveTo(x, y); c.lineTo(kruh[i][0], kruh[i][1]); }
            c.stroke();
          } else {
            const k = naObr(M.add(o.poz, M.mul(d, 2.5)));
            c.setLineDash([5, 4]);
            c.beginPath(); c.moveTo(x, y); c.lineTo(k[0], k[1]); c.stroke();
            c.setLineDash([]);
          }
        }
        c.beginPath();
        c.arc(x, y, 6, 0, Math.PI * 2);
        c.fillStyle = o.barva;
        c.fill();
        c.lineWidth = 1.6;
        c.stroke();
        if (o.druh === 'slunce') {
          c.beginPath();
          for (let i = 0; i < 8; i++) {
            const a = i / 8 * Math.PI * 2;
            c.moveTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9);
            c.lineTo(x + Math.cos(a) * 13, y + Math.sin(a) * 13);
          }
          c.stroke();
        } else {
          c.beginPath();
          c.setLineDash([2, 3]);
          c.arc(x, y, 11, 0, Math.PI * 2);
          c.stroke();
          c.setLineDash([]);
        }
      }
    }

    function kresliPrekryv() {
      const dpr = window.devicePixelRatio || 1;
      const c = ovx;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, pohled.W, pohled.H);

      kresliSvetla(c);

      // počátky vybraných objektů (oranžové tečky)
      for (const o of vybraneObj()) {
        if (!o.sit) continue;
        const [x, y, w] = naObr(o.poz);
        if (w <= 0) continue;
        c.beginPath();
        c.arc(x, y, 3.2, 0, Math.PI * 2);
        c.fillStyle = o.id === sc.aktivni ? '#ffb347' : '#ee7a1a';
        c.fill();
        c.lineWidth = 1;
        c.strokeStyle = 'rgba(0,0,0,.7)';
        c.stroke();
      }

      // náhled řezu smyčkou
      if (rez?.usecky) {
        c.beginPath();
        for (const [a, b] of rez.usecky) {
          const A = naObr(a), B = naObr(b);
          if (A[2] <= 0 || B[2] <= 0) continue;
          c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]);
        }
        c.strokeStyle = '#ffe14d';
        c.lineWidth = 2;
        c.stroke();
      }

      // vodítka během G / R / S
      if (uchop) {
        const [px, py] = uchop.pivotObr;
        const osaV = uchop.osa !== null ? E[uchop.osa] : uchop.vlastniOsa;
        if (osaV) {
          const a = naObr(M.sub(uchop.pivot, osaV)), b = naObr(M.add(uchop.pivot, osaV));
          let dx = b[0] - a[0], dy = b[1] - a[1];
          const l = Math.hypot(dx, dy);
          if (l > 0.01) {
            dx /= l; dy /= l;
            c.beginPath();
            c.moveTo(px - dx * 4000, py - dy * 4000);
            c.lineTo(px + dx * 4000, py + dy * 4000);
            c.strokeStyle = uchop.osa !== null ? BARVY_OS[uchop.osa] : '#ffe14d';
            c.lineWidth = 1.5;
            c.stroke();
          }
        }
        if (uchop.typ !== 'g') {
          c.setLineDash([4, 4]);
          c.beginPath();
          c.moveTo(px, py);
          c.lineTo(mys.x, mys.y);
          c.strokeStyle = 'rgba(255,255,255,.75)';
          c.lineWidth = 1;
          c.stroke();
          c.setLineDash([]);
        }
      }

      // gizmo nástroje
      const g = gizmo();
      if (g) kresliGizmo(c, g);

      // rámeček výběru
      if (tah?.typ === 'ramecek' && tah.pohnul) {
        const x = Math.min(tah.x0, mys.x), y = Math.min(tah.y0, mys.y);
        c.fillStyle = 'rgba(255,255,255,.06)';
        c.fillRect(x, y, Math.abs(mys.x - tah.x0), Math.abs(mys.y - tah.y0));
        c.setLineDash([5, 4]);
        c.strokeStyle = 'rgba(255,255,255,.85)';
        c.lineWidth = 1;
        c.strokeRect(x + 0.5, y + 0.5, Math.abs(mys.x - tah.x0), Math.abs(mys.y - tah.y0));
        c.setLineDash([]);
      }

      kresliNav(c);

      // popisek pohledu vlevo nahoře
      c.font = '600 12px "Segoe UI", system-ui, sans-serif';
      c.textBaseline = 'top';
      c.fillStyle = 'rgba(255,255,255,.88)';
      c.shadowColor = 'rgba(0,0,0,.6)';
      c.shadowBlur = 3;
      const nazev = kam.nazevPohledu ? t('{x} · ortogonální', { x: t(kam.nazevPohledu) }) : t(kam.ortho ? 'Uživatelský · ortogonální' : 'Uživatelská perspektiva');
      c.fillText(nazev, 12, 10);
      c.font = '12px "Segoe UI", system-ui, sans-serif';
      c.fillStyle = 'rgba(255,255,255,.65)';
      const a = sc.uprava ? upravObj() : aktivniObj();
      let radek = `(${sc.objekty.length}) ${a ? a.nazev : t('Scéna')}${sc.uprava ? ' · ' + t('Režim úprav') : ''}`;
      if (ptAktivni() && pt) {
        radek += ' · ' + t('Render Pro · vzorky {x}', { x: `${pt.vzorky}/${PT_LIMIT}` });
      } else if ((sc.render || sc.pro) && !sc.drat) {
        const n = sc.objekty.filter((o) => jeSvetlo(o) && !o.skryty).length;
        radek += ' · ' + (n ? t('Render · světla {n}', { n: Math.min(n, MAX_SVETEL) }) + (n > MAX_SVETEL ? ' ' + t('(max {n})', { n: MAX_SVETEL }) : '') : t('Render · výchozí slunce'));
      }
      c.fillText(radek, 12, 28);
      let y = 50;
      c.font = '600 13px "Segoe UI", system-ui, sans-serif';
      if (uchop) { c.fillStyle = '#ffd08a'; c.fillText(uchop.info, 12, y); y += 20; }
      if (rez) { c.fillStyle = '#ffe14d'; c.fillText(t('Řez smyčkou — najeď na hranu a klikni'), 12, y); y += 20; }
      if (hlaska && performance.now() < hlaska.do) { c.fillStyle = '#ffd08a'; c.fillText(hlaska.text, 12, y); y += 20; }
      if (volny) {
        c.fillStyle = '#7fd6ff';
        const v = +(volny.rychlost * (volny.shift ? (volny.gravitace ? 2 : 3) : 1)).toFixed(1);
        c.fillText(volny.gravitace ? t('Chůze · rychlost {x} m/s', { x: v }) : t('Volný pohyb · rychlost {x} m/s', { x: v }), 12, y);
        c.font = '12px "Segoe UI", system-ui, sans-serif';
        c.fillStyle = 'rgba(255,255,255,.75)';
        c.fillText(volny.gravitace
          ? t('WASD chůze · mezerník skok · Shift běh · kolečko rychlost · Tab létat')
          : t('WASD let · Q/E dolů/nahoru · myš rozhlížení · kolečko rychlost · Shift rychleji · Tab chůze'), 12, y + 20);
        c.fillText(t('Klik nebo Enter = zůstat tady · pravé tlačítko nebo Esc = zpět'), 12, y + 38);
        // zaměřovací kříž uprostřed
        const cx = pohled.W / 2, cy = pohled.H / 2;
        c.strokeStyle = 'rgba(255,255,255,.8)';
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(cx - 9, cy); c.lineTo(cx - 3, cy); c.moveTo(cx + 3, cy); c.lineTo(cx + 9, cy);
        c.moveTo(cx, cy - 9); c.lineTo(cx, cy - 3); c.moveTo(cx, cy + 3); c.lineTo(cx, cy + 9);
        c.stroke();
      }
      c.shadowBlur = 0;
    }

    function kresliGizmo(c, g) {
      const [px, py] = g.P;
      const jeNajeto = (osa) => najeto && najeto.osa === osa;
      if (g.typ === 'otoceni') {
        // vnější bílý kruh = otáčení kolem osy pohledu
        c.beginPath();
        c.arc(px, py, 92, 0, Math.PI * 2);
        c.strokeStyle = jeNajeto(null) ? '#fff' : 'rgba(255,255,255,.55)';
        c.lineWidth = jeNajeto(null) ? 3 : 2;
        c.stroke();
        for (const kr of g.kruhy) {
          for (const vpredu of [false, true]) {
            c.beginPath();
            let kreslim = false;
            for (let i = 0; i < kr.body.length; i++) {
              const b = kr.body[i];
              if (b.vpredu !== vpredu) { kreslim = false; continue; }
              if (!kreslim) { c.moveTo(b.x, b.y); kreslim = true; } else c.lineTo(b.x, b.y);
            }
            const h = jeNajeto(kr.k);
            c.strokeStyle = h ? SVETLE_OS[kr.k] : BARVY_OS[kr.k];
            c.globalAlpha = vpredu ? 1 : 0.22;
            c.lineWidth = h ? 4 : 2.6;
            c.stroke();
          }
        }
        c.globalAlpha = 1;
        return;
      }
      // osy seřazené odzadu dopředu
      const osy = [...g.osy].sort((a, b) => a.konec[2] - b.konec[2]).reverse();
      for (const o of osy) {
        if (o.delka < 14) continue;
        const h = jeNajeto(o.k);
        const barva = h ? SVETLE_OS[o.k] : BARVY_OS[o.k];
        const dx = (o.konec[0] - px) / o.delka, dy = (o.konec[1] - py) / o.delka;
        c.beginPath();
        c.moveTo(px + dx * o.delka * 0.2, py + dy * o.delka * 0.2);
        c.lineTo(o.konec[0], o.konec[1]);
        c.strokeStyle = barva;
        c.lineWidth = h ? 3.5 : 2.4;
        c.stroke();
        c.fillStyle = barva;
        if (g.typ === 'presun') {
          const [ex, ey] = o.konec;
          c.beginPath();
          c.moveTo(ex + dx * 14, ey + dy * 14);
          c.lineTo(ex - dy * 6, ey + dx * 6);
          c.lineTo(ex + dy * 6, ey - dx * 6);
          c.closePath();
          c.fill();
        } else {
          c.fillRect(o.konec[0] - 5.5, o.konec[1] - 5.5, 11, 11);
        }
      }
      c.beginPath();
      c.arc(px, py, g.typ === 'presun' ? 9 : 18, 0, Math.PI * 2);
      c.strokeStyle = jeNajeto(null) ? '#fff' : 'rgba(255,255,255,.7)';
      c.lineWidth = jeNajeto(null) ? 2.5 : 1.6;
      c.stroke();
    }

    function kresliNav(c) {
      const n = navGeom();
      if (najetoNav || tah?.typ === 'nav') {
        c.beginPath();
        c.arc(n.c.x, n.c.y, 54, 0, Math.PI * 2);
        c.fillStyle = 'rgba(255,255,255,.1)';
        c.fill();
      }
      for (const b of n.kulicky) {
        if (b.znam > 0) {
          c.beginPath();
          c.moveTo(n.c.x, n.c.y);
          c.lineTo(b.x, b.y);
          c.strokeStyle = BARVY_OS[b.k];
          c.lineWidth = 2.2;
          c.stroke();
        }
      }
      for (const b of n.kulicky) {
        const h = najetoNav && najetoNav !== 'kruh' && najetoNav.k === b.k && najetoNav.znam === b.znam;
        c.beginPath();
        c.arc(b.x, b.y, b.znam > 0 ? 9 : 7, 0, Math.PI * 2);
        if (b.znam > 0) {
          c.fillStyle = h ? '#fff' : BARVY_OS[b.k];
          c.fill();
          c.fillStyle = h ? '#111' : 'rgba(0,0,0,.85)';
          c.font = 'bold 11px "Segoe UI", system-ui, sans-serif';
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.fillText(OSY[b.k], b.x, b.y + 0.5);
          c.textAlign = 'left';
        } else {
          c.fillStyle = h ? 'rgba(255,255,255,.9)' : BARVY_OS[b.k] + '55';
          c.fill();
          c.strokeStyle = BARVY_OS[b.k];
          c.lineWidth = 1.2;
          c.stroke();
        }
      }
    }

    // ---------------------------------------------------------------- myš ve 3D okně
    const poziceMysi = (e) => {
      const rc = view.getBoundingClientRect();
      return { x: e.clientX - rc.left, y: e.clientY - rc.top };
    };

    view.oncontextmenu = (e) => e.preventDefault();

    view.onpointerdown = (e) => {
      view.focus({ preventScroll: true });
      const p = poziceMysi(e);
      mys = { ...p, uvnitr: true };
      if (!pohled) return;

      if (volny) { e.preventDefault(); if (e.button === 0) ukonciVolny(true); else if (e.button === 2) ukonciVolny(false); return; }

      if (uchop) {
        if (e.button === 0) potvrdUchop();
        else if (e.button === 2) zrusUchop();
        return;
      }

      try { view.setPointerCapture(e.pointerId); } catch { /* nic */ }

      if (e.button === 1 || e.button === 2) {
        e.preventDefault();
        if (rez && e.button === 2) { ukonciRez(); return; }
        tah = { typ: e.button === 1 && e.shiftKey ? 'pan' : 'orbit', x0: p.x, y0: p.y, lx: p.x, ly: p.y, pohnul: false, tlacitko: e.button };
        if (e.button === 1 && e.ctrlKey) tah.typ = 'zoom';
        return;
      }
      if (e.button !== 0) return;

      const nav = navPod(p.x, p.y);
      if (nav) { tah = { typ: 'nav', cil: nav, x0: p.x, y0: p.y, lx: p.x, ly: p.y, pohnul: false }; return; }

      if (rez) { provedRez(); return; }

      const u = uchytPod(gizmo(), p.x, p.y);
      if (u) { zacniUchop(u.typ, { osa: u.osa, myskou: true }); return; }

      const pridat = e.shiftKey || e.ctrlKey;
      if (sc.uprava) {
        const pr = prvekPod(p.x, p.y);
        tah = { typ: pr ? 'prvek' : 'ramecek', prvek: pr, pridat, smycka: e.altKey, x0: p.x, y0: p.y, lx: p.x, ly: p.y, pohnul: false };
        return;
      }
      const obj = objektPod(p.x, p.y);
      tah = { typ: obj ? 'objekt' : 'ramecek', obj, pridat, x0: p.x, y0: p.y, lx: p.x, ly: p.y, pohnul: false };
    };

    view.onpointermove = (e) => {
      if (volny) { rozhlizej(e.movementX || 0, e.movementY || 0); return; }
      const p = poziceMysi(e);
      mys = { ...p, uvnitr: true };
      if (!pohled) return;
      if (uchop) { aktualizujUchop(e.ctrlKey); return; }

      if (!tah) {
        if (rez) { aktualizujRez(); return; }
        const g = gizmo();
        const n = uchytPod(g, p.x, p.y);
        const nav = navPod(p.x, p.y);
        const zmena = JSON.stringify(n) !== JSON.stringify(najeto) || nav !== najetoNav;
        najeto = n; najetoNav = nav;
        view.style.cursor = n || (nav && nav !== 'kruh') ? 'pointer' : '';
        if (zmena) pozadej();
        return;
      }

      const dx = p.x - tah.lx, dy = p.y - tah.ly;
      tah.lx = p.x; tah.ly = p.y;
      if (!tah.pohnul && Math.hypot(p.x - tah.x0, p.y - tah.y0) > 3) tah.pohnul = true;
      if (!tah.pohnul) return;

      if (tah.typ === 'orbit' || tah.typ === 'nav') {
        if (tah.typ === 'orbit' && e.shiftKey) posunPohled(dx, dy); else orbit(dx, dy);
      } else if (tah.typ === 'pan') posunPohled(dx, dy);
      else if (tah.typ === 'zoom') kam.dist = clamp(kam.dist * Math.exp(dy * 0.01), 0.05, 800);
      else if (tah.typ === 'objekt' || tah.typ === 'prvek') {
        // tažení = vyber a chyť (jako „tweak“ v Blenderu)
        if (tah.typ === 'objekt') {
          const id = tah.obj.id;
          if (!sc.vybrane.has(id)) vyber([id], { pridat: tah.pridat });
          else sc.aktivni = id;
        } else if (!jeVybrany(tah.prvek)) klikUpravy(tah.prvek, tah.pridat, false);
        mys = { x: tah.x0, y: tah.y0, uvnitr: true };
        tah = null;
        zacniUchop('g', { myskou: true });
        mys = { ...p, uvnitr: true };
        aktualizujUchop(e.ctrlKey);
        return;
      }
      pozadej();
    };

    view.onpointerup = (e) => {
      const p = poziceMysi(e);
      if (uchop?.myskou && e.button === 0) { potvrdUchop(); return; }
      const tt = tah;
      tah = null;
      if (!tt) return;
      if (tt.typ === 'nav' && !tt.pohnul && tt.cil !== 'kruh') navKlik(tt.cil);
      else if (tt.typ === 'orbit' && !tt.pohnul && tt.tlacitko === 2) (sc.uprava ? nabidkaUpravy : nabidkaObjektu)(e.clientX, e.clientY, p);
      else if (tt.typ === 'objekt' && !tt.pohnul) {
        const id = tt.obj.id;
        if (tt.pridat && sc.vybrane.has(id) && sc.aktivni === id) {
          sc.vybrane.delete(id);
          sc.aktivni = null;
          obnovVse();
        } else vyber([id], { pridat: tt.pridat });
      } else if (tt.typ === 'prvek' && !tt.pohnul) klikUpravy(tt.prvek, tt.pridat, tt.smycka);
      else if (tt.typ === 'ramecek') {
        if (tt.pohnul) vyberRameckem({ x: tt.x0, y: tt.y0 }, p, tt.pridat);
        else if (sc.uprava) klikUpravy(null, tt.pridat, false);
        else if (!tt.pridat) vyber([]);
      }
      pozadej();
    };

    view.onpointerleave = () => {
      mys.uvnitr = false;
      if (najeto || najetoNav) { najeto = null; najetoNav = null; pozadej(); }
    };

    view.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (volny) {
        volny.rychlost = clamp(volny.rychlost * (e.deltaY < 0 ? 1.25 : 0.8), 0.1, 500);
        pozadej();
        return;
      }
      if (uchop) return;
      kam.dist = clamp(kam.dist * Math.exp(Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 120) * 0.0015), 0.05, 800);
      animace = null;
      pozadej();
      if (rez) aktualizujRez();
    }, { passive: false });

    // ---------------------------------------------------------------- klávesy
    body.tabIndex = 0;
    body.addEventListener('keydown', (e) => {
      if (e.target.matches('input, textarea, select')) return;
      const k = e.key.toLowerCase();
      const hotovo = () => { e.preventDefault(); e.stopPropagation(); };

      if (volny) {
        hotovo();
        volny.shift = e.shiftKey;
        if (k === 'escape') ukonciVolny(false);
        else if (k === 'enter') ukonciVolny(true);
        else if (k === 'tab') prepniGravitaci();
        else if (volny.gravitace && (e.code === 'Space' || e.code === 'KeyV')) {
          if (volny.naZemi && !e.repeat) { volny.vz = SKOK; volny.naZemi = false; }
        } else if (KLAVESY_LETU[e.code]) volny.klavesy.add(e.code);
        return;
      }
      // chůze s gravitací: Shift+` jako v Blenderu (na české klávesnici klávesa vlevo od 1), nebo Shift+F
      if (e.shiftKey && !e.ctrlKey && (e.code === 'Backquote' || (k === 'f' && !sc.uprava))) { hotovo(); zacniVolny({ gravitace: true }); return; }

      if (e.ctrlKey && k === 's') { hotovo(); uloz(e.shiftKey); return; }
      if (e.ctrlKey && k === 'o') { hotovo(); otevriNabidku(bSoubor); return; }
      if (e.ctrlKey && k === 'z') { hotovo(); (e.shiftKey ? vpred : zpet)(); return; }
      if (e.ctrlKey && k === 'y') { hotovo(); vpred(); return; }
      if (e.key === 'F12') { hotovo(); if (e.ctrlKey || e.shiftKey) snimekDoFotek(); else renderPro(); return; }

      if (uchop) {
        hotovo();
        if (k === 'escape') zrusUchop();
        else if (k === 'enter' || k === ' ') potvrdUchop();
        else if ((k === 'x' || k === 'y' || k === 'z') && uchop.typ !== 'i') {
          const osa = 'xyz'.indexOf(k);
          uchop.osa = uchop.osa === osa ? null : osa;
          aktualizujUchop(e.ctrlKey);
        } else if (k === 'g' || k === 'r' || k === 's') prepniUchop(k, e.ctrlKey);
        else if (/^[0-9.,-]$/.test(e.key)) {
          uchop.cislo = e.key === '-' ? (uchop.cislo.startsWith('-') ? uchop.cislo.slice(1) : '-' + uchop.cislo) : uchop.cislo + e.key;
          aktualizujUchop(e.ctrlKey);
        } else if (k === 'backspace') {
          uchop.cislo = uchop.cislo.slice(0, -1);
          aktualizujUchop(e.ctrlKey);
        }
        return;
      }

      // WASD hýbe kamerou pořád (drží se, dokud je klávesa dole)
      if (POHYB[e.code] && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) { hotovo(); drzimPohyb(e.code); return; }

      if (k === 'tab') { hotovo(); prepniUpravy(); return; }
      if (rez && k === 'escape') { hotovo(); ukonciRez(); return; }

      if (e.ctrlKey && !e.shiftKey && k === 'a') { hotovo(); vybratVse(); return; }
      // režim úprav — klávesy s Ctrl
      if (sc.uprava && e.ctrlKey) {
        if (k === 'e') { hotovo(); vytahni(); return; }
        if (k === 'r') { hotovo(); zacniRez(false); return; }
        if (k === 'i') { hotovo(); obratVyber(); return; }
        if (k === 'l') { hotovo(); vyberPropojene(false); return; }
        return;
      }
      if (e.ctrlKey || e.metaKey) return;

      const kod = e.code;
      if (sc.uprava && !e.altKey && !e.shiftKey && (kod === 'Digit1' || kod === 'Digit2' || kod === 'Digit3')) {
        hotovo(); nastavRezim({ Digit1: 'v', Digit2: 'e', Digit3: 'f' }[kod]); return;
      }
      const ciselne = { Numpad1: 1, Numpad3: 3, Numpad7: 7, Numpad5: 5, Digit1: 1, Digit3: 3, Digit7: 7, Digit5: 5 };
      if (ciselne[kod] !== undefined && !e.altKey) {
        hotovo();
        const c = ciselne[kod];
        if (c === 5) { kam.ortho = !kam.ortho; kam.autoOrtho = false; if (!kam.ortho) kam.nazevPohledu = null; pozadej(); return; }
        const id = { 1: ['predni', 'zadni'], 3: ['prava', 'leva'], 7: ['horni', 'dolni'] }[c][e.shiftKey ? 1 : 0];
        osovyPohled(id);
        return;
      }
      if (kod === 'NumpadDecimal') { hotovo(); zamer(true); return; }
      if (k === 'home') { hotovo(); zamer(false); return; }

      if (e.shiftKey && k === 'z') { hotovo(); nastavStinovani(sc.render && !sc.drat ? 'plne' : 'render'); return; }
      // animace: mezerník přehraje, šipky posouvají čas, ↑ ↓ skáčou po klíčích
      if (k === ' ') { hotovo(); prehrat(); return; }
      if (k === 'arrowleft' || k === 'arrowright') {
        hotovo();
        const dopredu = k === 'arrowright';
        nastavSnimek(e.shiftKey ? (dopredu ? sc.anim.konec : sc.anim.start) : sc.anim.snimek + (dopredu ? 1 : -1));
        return;
      }
      if (k === 'arrowup' || k === 'arrowdown') { hotovo(); skocNaKlic(k === 'arrowup' ? 1 : -1); return; }
      if (e.altKey && k === 'i' && !sc.uprava) { hotovo(); smazKlic(); return; }
      if (e.shiftKey && k === 'a') { hotovo(); nabidkaPridat(); return; }
      if (e.shiftKey && k === 'd') { hotovo(); duplikuj(); return; }
      if (e.altKey && k === 'a') { hotovo(); if (sc.uprava) { vsechnoVybrat(false); obnovVse(); } else vyber([]); return; }
      if (e.altKey && k === 'h' && !sc.uprava) { hotovo(); skryj(false); return; }
      if (e.altKey) return;

      if (k === 'g' || k === 'r') { hotovo(); zacniUchop(k); return; }   // měřítko je na nástroji (E/Q), S je pohyb
      if (k === 'x' || k === 'delete') {
        hotovo();
        if (sc.uprava) {
          if (k === 'delete' && sc.uprava.rezim !== 'v') smazVSiti(sc.uprava.rezim === 'e' ? 'hrany' : 'plochy');
          else nabidkaSmazat();
        } else smazVybrane();
        return;
      }
      if (sc.uprava) {
        if (k === 'i') { hotovo(); vsazeni(); return; }
        if (k === 'f') { hotovo(); vypln(); return; }
        if (k === 'm') { hotovo(); nabidkaSpojit(); return; }
        if (k === 'l') { hotovo(); vyberPropojene(true); return; }
      } else {
        if (k === 'f') { hotovo(); zamer(true); return; }
        if (k === 'h') { hotovo(); skryj(true); return; }
        if (k === 'i') { hotovo(); vlozKlic(); return; }
      }
      // E = další nástroj (výběr → posun → otočení → měřítko), Q = předchozí
      if (k === 'e' || k === 'q') {
        hotovo();
        const i = NASTROJE.findIndex((n) => n.id === sc.nastroj);
        nastavNastroj(NASTROJE[(i + (k === 'e' ? 1 : NASTROJE.length - 1)) % NASTROJE.length].id);
        return;
      }
      if (k === 'z') { hotovo(); nastavStinovani(sc.drat ? (sc.pro ? 'pro' : sc.render ? 'render' : 'plne') : 'drat'); return; }
      if (k === 'escape' && !sc.uprava && sc.vybrane.size) { hotovo(); vyber([]); }
    });

    body.addEventListener('keyup', (e) => {
      drzene.delete(e.code);
      if (!volny) return;
      volny.klavesy.delete(e.code);
      volny.shift = e.shiftKey;
    });

    function vybratVse() {
      if (sc.uprava) {
        const vse = sc.uprava.rezim === 'v' ? upravObj().sit.v.length / 3 : sc.uprava.rezim === 'e' ? U.topologie(upravObj().sit).hrany.size : upravObj().sit.f.length;
        const ted = sc.uprava.rezim === 'v' ? sc.uprava.v.size : sc.uprava.rezim === 'e' ? sc.uprava.e.size : sc.uprava.f.size;
        vsechnoVybrat(ted < vse);
        obnovVse();
        return;
      }
      const vse = sc.objekty.filter((o) => !o.skryty).map((o) => o.id);
      vyber(sc.vybrane.size === vse.length ? [] : vse, { aktivni: sc.aktivni ?? vse[0] ?? null });
    }

    const zbytekX = () => view.getBoundingClientRect().left + (mys.uvnitr ? mys.x : pohled.W / 2);
    const zbytekY = () => view.getBoundingClientRect().top + (mys.uvnitr ? mys.y : pohled.H / 2);

    // ---------------------------------------------------------------- nabídky
    const polozkySvetla = () => DRUHY_SVETEL.map((d) => ({ icon: d.ikona, label: d.nazev, onClick: () => pridejSvetlo(d.id) }));
    const polozkyPridat = () => [
      ...TVARY.map((tv) => ({ icon: tv.ikona, label: tv.nazev, onClick: () => pridej(tv.id) })),
      ...(sc.uprava ? [] : ['sep', { icon: 'b3svetlo', label: 'Světlo', sub: polozkySvetla() }]),
    ];

    function nabidkaPridat() {
      contextMenu([{ icon: 'plus', label: 'Přidat síť', disabled: true }, 'sep', ...polozkyPridat()], { x: zbytekX(), y: zbytekY() });
    }

    const polozkySmazat = () => [
      { icon: 'b3vrchol', label: 'Vrcholy', onClick: () => smazVSiti('vrcholy') },
      { icon: 'b3hrana', label: 'Hrany', onClick: () => smazVSiti('hrany') },
      { icon: 'b3plocha', label: 'Plochy', onClick: () => smazVSiti('plochy') },
    ];
    const polozkySpojit = () => [
      { icon: 'b3vrchol', label: 'Do středu', onClick: () => spoj('stred') },
      { icon: 'b3vrchol', label: 'Podle vzdálenosti', onClick: () => spoj('vzdalenost') },
    ];
    const nabidkaSmazat = () => contextMenu([{ icon: 'trash', label: 'Smazat', disabled: true }, 'sep', ...polozkySmazat()], { x: zbytekX(), y: zbytekY() });
    const nabidkaSpojit = () => contextMenu([{ icon: 'b3vrchol', label: 'Spojit', disabled: true }, 'sep', ...polozkySpojit()], { x: zbytekX(), y: zbytekY() });

    function nabidkaObjektu(cx, cy, p) {
      const obj = objektPod(p.x, p.y);
      if (obj && !sc.vybrane.has(obj.id)) vyber([obj.id]);
      const ma = vybraneObj().length > 0;
      contextMenu([
        { icon: 'plus', label: 'Přidat', sub: polozkyPridat(), key: 'Shift+A' },
        'sep',
        { icon: 'b3uprava', label: 'Upravit síť', key: 'Tab', disabled: !aktivniObj(), onClick: prepniUpravy },
        'sep',
        { icon: 'b3presun', label: 'Posunout', key: 'G', disabled: !ma, onClick: () => zacniUchop('g') },
        { icon: 'b3otoceni', label: 'Otočit', key: 'R', disabled: !ma, onClick: () => zacniUchop('r') },
        { icon: 'b3meritko', label: 'Změnit měřítko', disabled: !ma, onClick: () => zacniUchop('s') },
        'sep',
        { icon: 'b3koule', label: 'Hladké stínování', disabled: !ma, onClick: () => stinovani(true) },
        { icon: 'b3krychle', label: 'Ploché stínování', disabled: !ma, onClick: () => stinovani(false) },
        { icon: 'b3vyhlad', label: 'Vyhladit dělením', disabled: !ma, onClick: vyhlad },
        'sep',
        { icon: 'copy', label: 'Duplikovat', key: 'Shift+D', disabled: !ma, onClick: duplikuj },
        { icon: 'eyeOff', label: 'Skrýt', key: 'H', disabled: !ma, onClick: () => skryj(true) },
        { icon: 'trash', label: 'Smazat', key: 'X', danger: true, disabled: !ma, onClick: smazVybrane },
      ], { x: cx, y: cy });
    }

    function nabidkaUpravy(cx, cy) {
      const ma = selV().size > 0;
      const plochy = selF().size > 0;
      contextMenu([
        { icon: 'b3vytah', label: 'Vytáhnout', key: 'Ctrl+E', disabled: !ma, onClick: vytahni },
        { icon: 'b3vsad', label: 'Vsadit plochy', key: 'I', disabled: !plochy, onClick: vsazeni },
        { icon: 'b3rez', label: 'Řez smyčkou', key: 'Ctrl+R', onClick: () => zacniRez(false) },
        { icon: 'b3plocha', label: 'Rozdělit', disabled: !plochy, onClick: rozdelit },
        { icon: 'b3plocha', label: 'Vyplnit díru', key: 'F', disabled: !ma, onClick: vypln },
        'sep',
        { icon: 'b3presun', label: 'Posunout', key: 'G', disabled: !ma, onClick: () => zacniUchop('g') },
        { icon: 'b3otoceni', label: 'Otočit', key: 'R', disabled: !ma, onClick: () => zacniUchop('r') },
        { icon: 'b3meritko', label: 'Změnit měřítko', disabled: !ma, onClick: () => zacniUchop('s') },
        'sep',
        { icon: 'b3vrchol', label: 'Spojit', sub: polozkySpojit(), key: 'M' },
        { icon: 'copy', label: 'Duplikovat', key: 'Shift+D', disabled: !plochy, onClick: duplikuj },
        { icon: 'trash', label: 'Smazat', sub: polozkySmazat(), key: 'X' },
        'sep',
        { icon: 'b3vyber', label: 'Vybrat vše', key: 'Ctrl+A', onClick: () => { vsechnoVybrat(true); obnovVse(); } },
        { icon: 'b3vyber', label: 'Obrátit výběr', key: 'Ctrl+I', onClick: obratVyber },
        { icon: 'b3vyber', label: 'Vybrat propojené', key: 'Ctrl+L', disabled: !ma, onClick: () => vyberPropojene(false) },
        'sep',
        { icon: 'b3vyhlad', label: 'Vyhladit dělením', onClick: vyhlad },
        { icon: 'b3uprava', label: 'Zpět do objektů', key: 'Tab', onClick: prepniUpravy },
      ], { x: cx, y: cy });
    }

    function nabidkaPohled(btn) {
      const r0 = btn.getBoundingClientRect();
      contextMenu([
        { icon: 'b3krychle', label: 'Zepředu', key: '1', onClick: () => osovyPohled('predni') },
        { icon: 'b3krychle', label: 'Zezadu', key: 'Shift+1', onClick: () => osovyPohled('zadni') },
        { icon: 'b3krychle', label: 'Zprava', key: '3', onClick: () => osovyPohled('prava') },
        { icon: 'b3krychle', label: 'Zleva', key: 'Shift+3', onClick: () => osovyPohled('leva') },
        { icon: 'b3krychle', label: 'Shora', key: '7', onClick: () => osovyPohled('horni') },
        { icon: 'b3krychle', label: 'Zdola', key: 'Shift+7', onClick: () => osovyPohled('dolni') },
        'sep',
        { icon: 'eye', label: kam.ortho ? 'Přepnout na perspektivu' : 'Přepnout na ortogonální', key: '5', onClick: () => { kam.ortho = !kam.ortho; kam.autoOrtho = false; if (!kam.ortho) kam.nazevPohledu = null; pozadej(); } },
        { icon: 'search', label: 'Zaměřit vybrané', key: sc.uprava ? 'Num .' : 'F', onClick: () => zamer(true) },
        { icon: 'grid', label: 'Zobrazit vše', key: 'Home', onClick: () => zamer(false) },
        'sep',
        { icon: 'arrowRight', label: 'Chůze s gravitací', key: 'Shift+F', onClick: () => setTimeout(() => zacniVolny({ gravitace: true }), 0) },
      ], { x: r0.left, y: r0.bottom + 6 });
    }

    function nabidkaSoubor(btn) {
      const r0 = btn.getBoundingClientRect();
      contextMenu([
        { icon: 'plus', label: 'Nová scéna', onClick: novaScena },
        { icon: 'folderOpen', label: 'Otevřít…', key: 'Ctrl+O', onClick: () => otevriNabidku(btn) },
        { icon: 'save', label: 'Uložit', key: 'Ctrl+S', onClick: () => uloz(false) },
        { icon: 'save', label: 'Uložit jako kopii', key: 'Ctrl+Shift+S', onClick: () => uloz(true) },
        'sep',
        { icon: 'b3pro', label: 'Render Pro…', key: 'F12', onClick: renderPro },
        { icon: 'image', label: 'Rychlý snímek', key: 'Shift+F12', onClick: snimekDoFotek },
        { icon: 'b3film', label: 'Export videa…', onClick: dialogExportu },
        { icon: 'folder', label: 'Složka se scénami', onClick: () => { mkSlozku(); import('../apps.js').then(({ openApp }) => openApp('files', { path: SLOZKA })); } },
        'sep',
        { icon: 'star', label: 'Ukázkové scény', sub: UKAZKY.map((u) => ({ icon: 'b3krychle', label: u.nazev, onClick: () => otevriUkazku(u) })) },
        { icon: 'ai', label: 'AstroAI postaví scénu…', onClick: dialogAI },
        'sep',
        { icon: 'download', label: 'Importovat OBJ', sub: polozkyImportu() },
        { icon: 'upload', label: 'Exportovat OBJ', sub: [
          { icon: 'save', label: 'Na disk AstroOS', onClick: () => exportujObj(false) },
          { icon: 'download', label: 'Stáhnout do počítače', onClick: () => exportujObj(true) },
        ] },
      ], { x: r0.left, y: r0.bottom + 6 });
    }

    // ---------------------------------------------------------------- soubor
    const mkSlozku = () => { if (!FS.exists(SLOZKA)) FS.mkdir(SLOZKA, { parents: true }); };

    function spinavy(v = true) {
      sc.dirty = v;
      nazev();
    }

    function nazev() {
      const jm = sc.path ? FS.basename(sc.path) : 'Bez názvu';
      win.title = (sc.dirty ? '• ' : '') + jm + ' — Astro 3D';
      jmenoEl.textContent = (sc.dirty ? '• ' : '') + jm;
      jmenoEl.title = sc.path || 'Zatím neuloženo';
    }

    function vychoziScena() {
      sc.objekty = [novyObjekt('krychle'), noveSvetlo('bod')];
      sc.vybrane = new Set([sc.objekty[0].id]);
      sc.aktivni = sc.objekty[0].id;
      sc.uprava = null;
    }

    function novaScena() {
      zapamatuj();
      vychoziScena();
      sc.path = null;
      Object.assign(kam, { stred: [0, 0, 0], yaw: -43.3 * M.DEG, pitch: 26 * M.DEG, dist: 12, ortho: false, autoOrtho: false, nazevPohledu: null });
      spinavy(false);
      obnovVse();
    }

    function doJson() {
      return JSON.stringify({
        format: 'astro3d', verze: 1,
        kamera: { stred: kam.stred, yaw: kam.yaw, pitch: kam.pitch, dist: kam.dist, ortho: kam.ortho },
        svet: sc.svet,
        anim: { start: sc.anim.start, konec: sc.anim.konec, fps: sc.anim.fps },
        objekty: sc.objekty.map((o) => (jeSvetlo(o) ? {
          nazev: o.nazev, typ: 'svetlo', druh: o.druh, poz: o.poz, rot: o.rot, barva: o.barva, sila: o.sila,
          uhel: o.uhel, mekkost: o.mekkost, stiny: o.stiny, polomer: o.polomer, skryty: o.skryty, klice: o.klice,
        } : {
          nazev: o.nazev, typ: o.typ, sit: kUlozeni(o.sit), poz: o.poz, rot: o.rot, mer: o.mer,
          barva: o.barva, drs: o.drs, kov: o.kov, zare: o.zare || 0, hladke: o.hladke, skryty: o.skryty, klice: o.klice,
        })),
      });
    }

    function nacti(path) {
      let data;
      try { data = JSON.parse(FS.read(path)); } catch (err) {
        return toast({ title: 'Scénu nejde otevřít', body: `${FS.basename(path)} — ${err.message}`, icon: 'info' });
      }
      if (data?.format !== 'astro3d' || !Array.isArray(data.objekty)) {
        return toast({ title: 'Tohle není scéna Astro 3D', body: FS.basename(path), icon: 'info' });
      }
      const cislo = (v, d) => (Number.isFinite(v) ? v : d);
      const vektor = (v, d) => (Array.isArray(v) && v.length === 3 ? v.map((x, i) => cislo(x, d[i])) : [...d]);
      const objekty = [];
      const barvaHex = (b, d) => (/^#[0-9a-f]{6}$/i.test(b) ? b : d);
      for (const o of data.objekty) {
        if (o?.typ === 'svetlo') {
          objekty.push({
            id: 'o' + dalsiId++, nazev: String(o.nazev || 'Světlo').slice(0, 63), typ: 'svetlo',
            druh: DRUHY_SVETEL.some((d) => d.id === o.druh) ? o.druh : 'bod',
            poz: vektor(o.poz, [0, 0, 3]), rot: vektor(o.rot, [0, 0, 0]), mer: [1, 1, 1], barva: barvaHex(o.barva, '#ffffff'),
            sila: clamp(cislo(o.sila, 1000), 0, 1e7), uhel: clamp(cislo(o.uhel, 45), 1, 180), mekkost: clamp(cislo(o.mekkost, 0.15), 0, 1),
            stiny: o.stiny !== false, polomer: clamp(cislo(o.polomer, 0.25), 0, 1), skryty: !!o.skryty, klice: A.platneKlice(o.klice),
          });
          continue;
        }
        if (!platna(o?.sit)) continue;
        objekty.push({
          id: 'o' + dalsiId++, nazev: String(o.nazev || 'Objekt').slice(0, 63), typ: String(o.typ || 'sit'), sit: o.sit,
          poz: vektor(o.poz, [0, 0, 0]), rot: vektor(o.rot, [0, 0, 0]), mer: vektor(o.mer, [1, 1, 1]),
          barva: /^#[0-9a-f]{6}$/i.test(o.barva) ? o.barva : '#cccccc',
          drs: clamp(cislo(o.drs, 0.5), 0, 1), kov: clamp(cislo(o.kov, 0), 0, 1), zare: clamp(cislo(o.zare, 0), 0, 100), hladke: !!o.hladke, skryty: !!o.skryty, klice: A.platneKlice(o.klice),
        });
      }
      if (uchop) { uchop = null; }
      ukonciRez();
      sc.undo.length = 0;
      sc.redo.length = 0;
      sc.objekty = objekty;
      sc.vybrane.clear();
      sc.aktivni = null;
      sc.uprava = null;
      sc.svet = { barva: barvaHex(data.svet?.barva, '#404040'), sila: clamp(cislo(data.svet?.sila, 1), 0, 100) };
      const an = data.anim || {};
      const zac = Math.round(cislo(an.start, 1)), kon = Math.round(cislo(an.konec, 120));
      sc.anim = { start: zac, konec: Math.max(zac + 1, kon), fps: [12, 24, 25, 30, 60].includes(an.fps) ? an.fps : 24, snimek: zac };
      prehravani = null;
      vyhodnotAnimaci();
      const k = data.kamera || {};
      Object.assign(kam, {
        stred: vektor(k.stred, [0, 0, 0]), yaw: cislo(k.yaw, -43.3 * M.DEG), pitch: clamp(cislo(k.pitch, 26 * M.DEG), -PITCH_MAX, PITCH_MAX),
        dist: clamp(cislo(k.dist, 12), 0.05, 800), ortho: !!k.ortho, autoOrtho: false, nazevPohledu: null,
      });
      sc.path = FS.normalize(path);
      spinavy(false);
      obnovVse();
      uklidGpu();
    }

    function uloz(jinam) {
      mkSlozku();
      let path = sc.path;
      if (!path || jinam) {
        const zaklad = path ? FS.basename(path) : 'scena.a3d';
        path = FS.normalize(SLOZKA + '/' + FS.freeName(SLOZKA, zaklad));
      }
      const data = doJson();
      try { FS.write(path, data); } catch (err) {
        return toast({ title: 'Uložení selhalo', body: err.message, icon: 'info', timeout: 6000 });
      }
      sc.path = path;
      spinavy(false);
      toast({ title: 'Uloženo', body: `${path} · ${FS.humanSize(data.length)}`, icon: 'check', timeout: 2600 });
    }

    const najdiSceny = () => najdiSoubory(/\.a3d$/i);

    function najdiSoubory(vzor, root = FS.HOME) {
      const out = [];
      const walk = (p) => {
        let items;
        try { items = FS.list(p); } catch { return; }
        for (const it of items) {
          if (it.dir) walk(it.path);
          else if (vzor.test(it.name)) out.push(it);
        }
      };
      walk(root);
      return out;
    }

    function otevriNabidku(btn) {
      const r0 = btn.getBoundingClientRect();
      const polozky = najdiSceny().slice(0, 24).map((it) => ({ icon: 'b3krychle', label: it.name, onClick: () => nacti(it.path) }));
      if (!polozky.length) polozky.push({ icon: 'info', label: 'Na disku zatím není žádná scéna', disabled: true });
      contextMenu(polozky, { x: r0.left, y: r0.bottom + 6 });
    }


    // ---------------------------------------------------------------- Render Pro (path tracer)
    const ptIdSiti = new WeakMap();
    let ptDalsiId = 1;
    const idSite = (sit) => { if (!ptIdSiti.has(sit)) ptIdSiti.set(sit, ptDalsiId++); return ptIdSiti.get(sit); };

    /** Co path tracer potřebuje ze scény: viditelné sítě s lineárními barvami, světla a svět. */
    function ptData() {
      const rn = renderNastaveni(true);
      return {
        objekty: sc.objekty.filter((o) => o.sit && !o.skryty).map((o) => ({ ...o, barva: linearni(hexNaRgb(o.barva)) })),
        svetla: rn.svetla, svet: rn.svet,
      };
    }

    /** Otisk scény — když se změní, path tracer staví BVH znovu. */
    function klicSceny() {
      return JSON.stringify([
        sc.objekty.filter((o) => !o.skryty).map((o) => (o.sit
          ? [idSite(o.sit), o.hladke, o.poz, o.rot, o.mer, o.barva, o.drs, o.kov, o.zare || 0]
          : [o.druh, o.poz, o.rot, o.barva, o.sila, o.uhel, o.mekkost, o.stiny, o.polomer])),
        sc.svet,
      ]);
    }

    let pt = null, ptKlic = null, ptBezi = false;
    const PT_LIMIT = 512;
    const ptAktivni = () => sc.pro && !sc.drat && !sc.uprava && !exportBezi;

    function ptViewport() {
      if (pt) return pt;
      try { pt = new PathTracer(ptCv); } catch (err) {
        sc.pro = false;
        obnovListu();
        toast({ title: 'Render Pro tu nejede', body: err.message, icon: 'info', timeout: 6000 });
        return null;
      }
      return pt;
    }

    /** Ve výřezu: připraví scénu a kameru, první vzorek hned, další ve vlastní smyčce. */
    function ptKresli() {
      const p = ptViewport();
      if (!p) return;
      p.velikost(pohled.W, pohled.H);
      const klic = klicSceny();
      if (klic !== ptKlic) { ptKlic = klic; p.nastavScenu(ptData()); }
      p.kamera(pohled.inv);
      if (p.vzorky === 0) p.krok(1);
      if (!ptBezi && p.vzorky < PT_LIMIT) { ptBezi = true; requestAnimationFrame(ptSmycka); }
    }

    function ptSmycka() {
      if (!pt || !ptAktivni() || !view.isConnected || pt.vzorky >= PT_LIMIT) { ptBezi = false; if (view.isConnected) kresliPrekryv(); return; }
      pt.krok(pt.vzorky < 8 ? 1 : 4);
      kresliPrekryv();
      requestAnimationFrame(ptSmycka);
    }

    // ---------------------------------------------------------------- dialogy (Render Pro, export videa, přehrávač)
    let dialog = null;
    function zavriDialog() {
      if (!dialog) return;
      dialog.zavrit?.();
      dialog.el.remove();
      dialog = null;
      body.focus();
      pozadej();
    }
    function otevriDialog(nadpis, ikona, obsah, zavrit) {
      zavriDialog();
      const el0 = el('div.b3-dlg-pozadi', {},
        el('div.b3-dlg', {},
          el('div.b3-dlg-hlava', {}, icon(ikona), el('span', { text: nadpis }), el('div.b3-spacer'),
            el('button.b3-btn.ic', { title: 'Zavřít (Esc)', onclick: zavriDialog }, icon('x'))),
          obsah));
      el0.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Escape') zavriDialog(); };
      el0.tabIndex = -1;
      body.querySelector('.b3').append(el0);
      dialog = { el: el0, zavrit };
      setTimeout(() => el0.focus(), 30);
    }

    const ROZLISENI = [['okno', 'Podle okna'], ['854x480', '854 × 480'], ['1280x720', '1280 × 720 (HD)'], ['1920x1080', '1920 × 1080 (Full HD)']];
    function rozmer(volba) {
      if (volba !== 'okno') return volba.split('x').map(Number);
      const s = Math.max(1, 1600 / pohled.W);
      return [Math.round(pohled.W * Math.min(s, 2)), Math.round(pohled.H * Math.min(s, 2))];
    }
    const vyber0 = (moznosti, vychozi) => el('select.b3-select', {}, moznosti.map(([v, t0]) => el('option', { value: v, text: t0, selected: v === vychozi })));

    function ulozObrazek(data, zaklad) {
      if (!FS.exists(OBRAZKY)) FS.mkdir(OBRAZKY, { parents: true });
      const path = FS.normalize(OBRAZKY + '/' + FS.freeName(OBRAZKY, zaklad));
      try { FS.write(path, data); } catch (err) {
        toast({ title: 'Snímek se neuložil', body: err.message, icon: 'info', timeout: 6000 });
        return null;
      }
      toast({
        title: 'Snímek uložen do Fotek', body: `${FS.basename(path)} · klikni pro otevření`, icon: 'image', timeout: 4200,
        onClick: () => import('../apps.js').then(({ openApp }) => openApp('photos', { path })),
      });
      return path;
    }

    /** F12: finální render path tracerem v okně s průběhem. */
    function renderPro() {
      if (!pohled) return;
      const platno = el('canvas.b3-dlg-platno');
      let tracer;
      try { tracer = new PathTracer(platno); } catch (err) {
        return toast({ title: 'Render Pro tu nejede', body: err.message, icon: 'info', timeout: 6000 });
      }
      const selVzorky = vyber0([['64', '64'], ['128', '128'], ['256', '256'], ['512', '512'], ['1024', '1024']], '256');
      const selRozl = vyber0(ROZLISENI.slice(0, 1).concat(ROZLISENI.slice(2)), 'okno');
      const selOdrazy = vyber0([['3', '3'], ['6', '6'], ['10', '10']], '6');
      const pruh = el('div.b3-pruh', {}, el('i'));
      const stavEl = el('div.b3-dlg-stav');
      const bUlozit = el('button.btn.primary', { disabled: true }, 'Uložit do Fotek');
      let beh = 0, t0 = 0, cil = 256;
      const start = () => {
        const [W, H] = rozmer(selRozl.value);
        cil = +selVzorky.value;
        tracer.odrazy = +selOdrazy.value;
        tracer.velikost(W, H);
        tracer.nastavScenu(ptData());
        tracer.kamera(pohledPro(W, H).inv);
        tracer.reset();
        t0 = performance.now();
        bUlozit.disabled = true;
        const moje = ++beh;
        const smycka = () => {
          if (moje !== beh || !platno.isConnected) return;
          tracer.krok(Math.min(4, cil - tracer.vzorky));
          const s = ((performance.now() - t0) / 1000).toFixed(1);
          pruh.firstChild.style.width = (tracer.vzorky / cil * 100) + '%';
          stavEl.textContent = tracer.vzorky >= cil
            ? t('Hotovo · {n} vzorků · {x} s', { n: cil, x: s })
            : t('Vzorek {x} · {y} s', { x: `${tracer.vzorky}/${cil}`, y: s });
          if (tracer.vzorky >= cil) { bUlozit.disabled = false; return; }
          requestAnimationFrame(smycka);
        };
        requestAnimationFrame(smycka);
      };
      bUlozit.onclick = () => {
        const zaklad = (sc.path ? FS.basename(sc.path).replace(/\.a3d$/i, '') : 'render') + '-pro.png';
        ulozObrazek(platno.toDataURL('image/png'), zaklad);
      };
      for (const s of [selVzorky, selRozl, selOdrazy]) s.onchange = start;
      otevriDialog('Render Pro', 'b3pro', el('div.b3-dlg-telo', {},
        el('div.b3-dlg-volby', {},
          el('label', {}, el('span', { text: 'Vzorky' }), selVzorky),
          el('label', {}, el('span', { text: 'Rozlišení' }), selRozl),
          el('label', {}, el('span', { text: 'Odrazy' }), selOdrazy),
          el('div.b3-dlg-info', { text: 'Path tracing: odrazy světla, měkké stíny a zářící materiály. Obraz se postupně čistí od šumu.' }),
        ),
        el('div.b3-dlg-nahled', {}, platno),
        pruh,
        el('div.b3-dlg-pata', {}, stavEl, el('div.b3-spacer'),
          el('button.btn', { onclick: start }, 'Znovu'), bUlozit),
      ), () => { beh++; tracer.znic(); });
      start();
    }

    /** Rychlý snímek bez path tracingu (render se stíny). */
    function snimekDoFotek() {
      if (!pohled) return;
      const [W, H] = rozmer('okno');
      cv.width = W; cv.height = H;
      r.kresli(sc.objekty, pohledPro(W, H), { cisty: true, vybrane: new Set(), aktivni: null, render: renderNastaveni(true) });
      const data = cv.toDataURL('image/png');
      cv.width = 1; // velikost() ho při dalším snímku vrátí
      pozadej();
      ulozObrazek(data, (sc.path ? FS.basename(sc.path).replace(/\.a3d$/i, '') : 'render') + '.png');
    }

    // export animace do WebM: snímky se kreslí v reálném čase do plátna, které nahrává MediaRecorder
    let exportBezi = false;
    function dialogExportu() {
      if (!pohled) return;
      if (!window.MediaRecorder) return toast({ title: 'Nahrávání videa tu nejde', body: 'Prohlížeč nemá MediaRecorder.', icon: 'info' });
      const a = sc.anim;
      const selRozl = vyber0(ROZLISENI.slice(1), '1280x720');
      const selKvalita = vyber0([['render', 'Render se stíny'], ['plne', 'Plné stínování']], 'render');
      const tocit = el('input', { type: 'checkbox' });
      const pocet = a.konec - a.start + 1;
      const info = el('div.b3-dlg-info', { text: t('{n} snímků · {x} s při {y} fps', { n: pocet, x: (pocet / a.fps).toFixed(1), y: a.fps }) });
      const pruh = el('div.b3-pruh', {}, el('i'));
      const stavEl = el('div.b3-dlg-stav', { text: 'Připraveno' });
      const vysledek = el('div.b3-dlg-video');
      const bStart = el('button.btn.primary', {}, 'Exportovat');
      let zrusit = false;
      bStart.onclick = async () => {
        bStart.disabled = true;
        zrusit = false;
        vysledek.replaceChildren();
        const [W, H] = selRozl.value.split('x').map(Number);
        let blob;
        try {
          blob = await exportujVideo({ W, H, stiny: selKvalita.value === 'render', tocit: tocit.checked }, (i, n) => {
            pruh.firstChild.style.width = (i / n * 100) + '%';
            stavEl.textContent = t('Nahrávám snímek {x}', { x: `${i}/${n}` });
          }, () => zrusit);
        } catch (err) {
          stavEl.textContent = err.message;
          bStart.disabled = false;
          return;
        }
        bStart.disabled = false;
        if (!blob) { stavEl.textContent = 'Zrušeno'; return; }
        stavEl.textContent = t('Hotovo · {x}', { x: FS.humanSize(blob.size) });
        ukazVideo(vysledek, blob);
      };
      otevriDialog('Export videa', 'b3film', el('div.b3-dlg-telo', {},
        el('div.b3-dlg-volby', {},
          el('label', {}, el('span', { text: 'Rozlišení' }), selRozl),
          el('label', {}, el('span', { text: 'Kvalita' }), selKvalita),
          el('label.b3-dlg-check', {}, tocit, el('span', { text: 'Otočit kamerou kolem scény' })),
          info,
        ),
        vysledek,
        pruh,
        el('div.b3-dlg-pata', {}, stavEl, el('div.b3-spacer'), bStart),
      ), () => { zrusit = true; });
    }

    async function exportujVideo({ W, H, stiny, tocit }, prubeh, zruseno) {
      const a = sc.anim;
      const rec = document.createElement('canvas');
      rec.width = W; rec.height = H;
      const rx = rec.getContext('2d');
      const stream = rec.captureStream(0);
      const stopa = stream.getVideoTracks()[0];
      const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m));
      const mr = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: W >= 1920 ? 4e6 : W >= 1280 ? 2.5e6 : 1.2e6 });
      const kusy = [];
      mr.ondataavailable = (e) => { if (e.data.size) kusy.push(e.data); };
      const puvodni = { snimek: a.snimek, yaw: kam.yaw };
      const pocet = a.konec - a.start + 1;
      exportBezi = true;
      mr.start();
      let preruseno = false;
      try {
        for (let i = 0; i < pocet; i++) {
          if (zruseno()) { preruseno = true; break; }
          a.snimek = a.start + i;
          vyhodnotAnimaci();
          if (tocit) kam.yaw = puvodni.yaw + Math.PI * 2 * i / pocet;
          cv.width = W; cv.height = H;
          r.kresli(sc.objekty, pohledPro(W, H), { cisty: true, vybrane: new Set(), aktivni: null, render: stiny ? renderNastaveni(true) : null });
          rx.drawImage(cv, 0, 0);
          stopa.requestFrame();
          prubeh(i + 1, pocet);
          await new Promise((res) => setTimeout(res, 1000 / a.fps));
        }
      } finally {
        await new Promise((res) => { mr.onstop = res; mr.stop(); });
        stopa.stop();
        exportBezi = false;
        a.snimek = puvodni.snimek;
        kam.yaw = puvodni.yaw;
        vyhodnotAnimaci();
        cv.width = 1;
        obnovVse();
      }
      return preruseno ? null : new Blob(kusy, { type: 'video/webm' });
    }

    /** Náhled hotového videa + uložení na disk AstroOS / stažení. */
    function ukazVideo(kam0, blob, jmeno = null) {
      const url = URL.createObjectURL(blob);
      const video = el('video', { src: url, controls: true, autoplay: true, loop: true, muted: true });
      // WebM z MediaRecorderu nemá v hlavičce délku → přetočit na konec, prohlížeč ji dopočítá
      video.onloadedmetadata = () => {
        if (video.duration !== Infinity) return;
        video.currentTime = 1e9;
        video.ontimeupdate = () => { video.ontimeupdate = null; video.currentTime = 0; video.play().catch(() => {}); };
      };
      const zaklad = (jmeno || (sc.path ? FS.basename(sc.path).replace(/\.a3d$/i, '') : 'animace')).replace(/\.webm$/i, '') + '.webm';
      const bUlozit = el('button.btn', {}, icon('save'), el('span', { text: 'Uložit do Videí' }));
      bUlozit.onclick = () => {
        const fr = new FileReader();
        fr.onload = () => {
          const slozka = FS.HOME + '/Videa';
          if (!FS.exists(slozka)) FS.mkdir(slozka, { parents: true });
          const path = FS.normalize(slozka + '/' + FS.freeName(slozka, zaklad));
          try { FS.write(path, fr.result); } catch (err) {
            return toast({ title: 'Na disk AstroOS se video nevešlo', body: `${FS.humanSize(blob.size)} — ${err.message}. Zkus menší rozlišení nebo kratší animaci.`, icon: 'info', timeout: 7000 });
          }
          toast({ title: 'Video uloženo', body: path, icon: 'check', timeout: 3000 });
        };
        fr.readAsDataURL(blob);
      };
      const bStahnout = el('a.btn', { href: url, download: zaklad }, icon('download'), el('span', { text: 'Stáhnout' }));
      kam0.replaceChildren(video, el('div.b3-dlg-akce', {}, bUlozit, bStahnout));
    }

    /** Video z disku AstroOS (.webm s obrazem) — otevírá se dvojklikem v Souborech. */
    function prehravac(path) {
      let data;
      try { data = FS.read(path); } catch { return; }
      if (!String(data).startsWith('data:video/')) return toast({ title: 'Tohle není video', body: FS.basename(path), icon: 'info' });
      fetch(data).then((x) => x.blob()).then((blob) => {
        const misto = el('div.b3-dlg-video');
        otevriDialog(FS.basename(path), 'b3film', el('div.b3-dlg-telo', {}, misto));
        ukazVideo(misto, blob, FS.basename(path));
      });
    }

    function otevriSoubor(p) {
      if (/\.webm$/i.test(p)) return prehravac(p);
      if (/\.obj$/i.test(p)) {
        let text;
        try { text = FS.read(p); } catch { return; }
        return importujObj(text, FS.basename(p).replace(/\.obj$/i, ''));
      }
      return nacti(p);
    }

    // ---------------------------------------------------------------- animace
    function vyhodnotAnimaci() {
      for (const o of sc.objekty) {
        if (!A.maKlice(o)) continue;
        const h = A.vyhodnot(o.klice, sc.anim.snimek);
        if (h) { o.poz = h.poz; o.rot = h.rot; o.mer = h.mer; }
      }
    }

    function nastavSnimek(f) {
      if (uchop) return;
      sc.anim.snimek = clamp(Math.round(f), -9999, 99999);
      vyhodnotAnimaci();
      obnovVlastnosti();
      obnovOsu();
      pozadej();
    }

    function vlozKlic() {
      const objs = vybraneObj();
      if (!objs.length) return toast({ title: 'Vyber objekt', body: 'Klíčový snímek se vkládá vybraným objektům.', icon: 'info', timeout: 2400 });
      return toast({ title: 'Jen v plné verzi', body: A.JEN_PLNA, icon: 'info', timeout: 4000 });
      zapamatuj();
      for (const o of objs) o.klice = A.sKlicem(o, sc.anim.snimek);
      spinavy();
      obnovVse();
      ukazHlasku(t('Klíč vložen · snímek {n}', { n: sc.anim.snimek }));
    }

    function smazKlic() {
      const objs = vybraneObj().filter((o) => o.klice?.[sc.anim.snimek]);
      if (!objs.length) return;
      zapamatuj();
      for (const o of objs) o.klice = A.bezKlice(o, sc.anim.snimek);
      spinavy();
      obnovVse();
      ukazHlasku(t('Klíč smazán · snímek {n}', { n: sc.anim.snimek }));
    }

    function skocNaKlic(smer) {
      const zdroj = vybraneObj().length ? vybraneObj() : sc.objekty;
      const vse = [...new Set(zdroj.flatMap((o) => A.snimkyKlicu(o.klice)))].sort((a, b) => a - b);
      const f = sc.anim.snimek;
      const cil = smer > 0 ? vse.find((x) => x > f) : [...vse].reverse().find((x) => x < f);
      if (cil !== undefined) nastavSnimek(cil);
    }

    let prehravani = null;
    function prehrat() {
      if (prehravani) { prehravani = null; obnovOsu(); return; }
      if (uchop) return;
      const a = sc.anim;
      if (a.snimek >= a.konec) a.snimek = a.start;
      prehravani = { t0: performance.now(), od: a.snimek };
      const krok = (ted) => {
        if (!prehravani || !view.isConnected) return;
        const delka = a.konec - a.start + 1;
        const f = prehravani.od + Math.floor((ted - prehravani.t0) / 1000 * a.fps);
        const novy = a.start + ((f - a.start) % delka + delka) % delka;
        if (novy !== a.snimek) nastavSnimek(novy);
        requestAnimationFrame(krok);
      };
      requestAnimationFrame(krok);
      obnovOsu();
    }

    let hlaska = null;
    function ukazHlasku(text) {
      hlaska = { text, do: performance.now() + 1600 };
      pozadej();
      setTimeout(pozadej, 1650);
    }

    // ---------------------------------------------------------------- scéna z předpisu (ukázky a AstroAI)
    const cisloSp = (v, d, min = -1e4, max = 1e4) => (Number.isFinite(+v) ? clamp(+v, min, max) : d);
    const hexSp = (b, d) => (/^#[0-9a-f]{6}$/i.test(String(b || '').trim()) ? String(b).trim().toLowerCase() : d);

    /** Postaví objekty a světla z předpisu { objekty, svetla, svet } (formát ukázek i AstroAI). */
    function zeSpecu(spec, { nahradit }) {
      zapamatuj();
      sc.uprava = null;
      ukonciRez();
      if (nahradit) { sc.objekty = []; sc.vybrane.clear(); sc.aktivni = null; }
      const nove = [];
      for (const s of (spec.objekty || []).slice(0, 60)) {
        const tvar = TVARY.some((x) => x.id === s.tvar) ? s.tvar : 'krychle';
        const tr = s.sirka !== undefined ? zRozmeru(tvar, s) : {
          poz: [cisloSp(s.x, 0), cisloSp(s.y, 0), cisloSp(s.z, 0)],
          rot: [cisloSp(s.rx, 0, -360, 360), cisloSp(s.ry, 0, -360, 360), cisloSp(s.rz, 0, -360, 360)],
          mer: [cisloSp(s.sx, 1, 0.001, 1000), cisloSp(s.sy, 1, 0.001, 1000), cisloSp(s.sz, 1, 0.001, 1000)],
        };
        const ob = novyObjekt(tvar, {
          ...tr,
          barva: hexSp(s.barva, '#cccccc'), drs: cisloSp(s.drsnost, 0.5, 0, 1), kov: cisloSp(s.kov, 0, 0, 1), zare: cisloSp(s.zare, 0, 0, 50),
        });
        if (s.nazev) ob.nazev = unikatniNazev(String(s.nazev).trim().slice(0, 40) || ob.nazev);
        sc.objekty.push(ob);
        nove.push(ob.id);
      }
      for (const l of (spec.svetla || []).slice(0, MAX_SVETEL)) {
        const druh = DRUHY_SVETEL.some((d) => d.id === l.druh) ? l.druh : 'bod';
        const sv = noveSvetlo(druh);
        sv.poz = [cisloSp(l.x, 0), cisloSp(l.y, 0), cisloSp(l.vyska ?? l.z, 5)];
        sv.sila = cisloSp(l.sila, sv.sila, 0, 1e5);
        sv.barva = hexSp(l.barva, '#ffffff');
        if (druh !== 'bod') {
          const cil = [cisloSp(l.cil_x, 0), cisloSp(l.cil_y, 0), cisloSp(l.cil_vyska ?? l.cil_z, 0)];
          if (M.len(M.sub(cil, sv.poz)) > 1e-3) sv.rot = miritNa(sv.poz, cil);
        }
        sc.objekty.push(sv);
      }
      if (spec.svet && (nahradit || !sc.objekty.some(jeSvetlo))) {
        sc.svet = { barva: hexSp(spec.svet.barva, sc.svet.barva), sila: cisloSp(spec.svet.sila, 1, 0, 10) };
      }
      // zaměřit na stavbu, ne na celou louku pod ní
      const bezZeme = nove.filter((id) => sc.objekty.find((x) => x.id === id)?.typ !== 'rovina');
      vyber(bezZeme.length ? bezZeme : nove);
      zamer(true);
      vyber(nove);
      spinavy();
      uklidGpu();
      return nove.length;
    }

    // základní rozměr tvarů v jejich vlastních osách (torus je placatý, rovina nemá tloušťku)
    const ZAKLAD = { torus: [2.5, 2.5, 0.5], rovina: [2, 2, 0] };

    /**
     * Předpis s rozměry v metrech → poloha / otočení / měřítko.
     * sirka, hloubka, vyska = výsledný rozměr v ose X, Y, Z (po položení, před otočením kolem svislé osy),
     * spodek = výška spodní hrany nad zemí, polozit = 'ne' | 'dopredu' (osa tvaru míří k divákovi) | 'do_strany'.
     */
    function zRozmeru(tvar, s) {
      const W = cisloSp(s.sirka, 1, 0.01, 1000), D = cisloSp(s.hloubka, 1, 0.01, 1000), H = cisloSp(s.vyska, 1, 0.01, 1000);
      const E = ZAKLAD[tvar] || [2, 2, 2];
      // které skutečné rozměry připadnou na vlastní osy tvaru x, y, z
      let lok, rot;
      if (s.polozit === 'dopredu') { lok = [W, H, D]; rot = [90, 0]; }
      else if (s.polozit === 'do_strany') { lok = [H, D, W]; rot = [0, 90]; }
      else { lok = [W, D, H]; rot = [0, 0]; }
      const mer = lok.map((d, k) => (E[k] ? Math.max(0.001, d / E[k]) : 1));
      const spodek = cisloSp(s.spodek, 0);
      const z = tvar === 'rovina' && !s.polozit ? spodek : spodek + H / 2;
      return {
        poz: [cisloSp(s.x, 0), cisloSp(s.y, 0), z],
        rot: [rot[0], rot[1], cisloSp(s.otoceni, 0, -360, 360)],
        mer,
      };
    }

    function otevriUkazku(u) {
      zeSpecu(u.postav(), { nahradit: true });
      sc.path = null;
      spinavy();
      vyber([]);
      if (!sc.pro) nastavStinovani('render');
    }

    // ---------------------------------------------------------------- AstroAI staví scénu
    const cisloS = { type: 'number' };
    function schemaAI(pridat) {
      return {
        type: 'object', additionalProperties: false,
        properties: {
          plan: { type: 'string' },
          objekty: {
            type: 'array', minItems: 1, maxItems: 40,
            items: {
              type: 'object', additionalProperties: false,
              properties: {
                nazev: { type: 'string' }, tvar: { type: 'string', enum: TVARY.map((x) => x.id) },
                x: cisloS, y: cisloS, spodek: cisloS, sirka: cisloS, hloubka: cisloS, vyska: cisloS,
                otoceni: cisloS, polozit: { type: 'string', enum: ['ne', 'dopredu', 'do_strany'] },
                barva: { type: 'string' }, drsnost: cisloS, kov: cisloS, zare: cisloS,
              },
              required: ['nazev', 'tvar', 'x', 'y', 'spodek', 'sirka', 'hloubka', 'vyska', 'otoceni', 'polozit', 'barva', 'drsnost', 'kov', 'zare'],
            },
          },
          svetla: {
            type: 'array', minItems: pridat ? 0 : 1, maxItems: 3,
            items: {
              type: 'object', additionalProperties: false,
              properties: {
                druh: { type: 'string', enum: ['slunce', 'bod', 'reflektor'] }, x: cisloS, y: cisloS, vyska: cisloS, sila: cisloS,
                barva: { type: 'string' }, cil_x: cisloS, cil_y: cisloS, cil_vyska: cisloS,
              },
              required: ['druh', 'x', 'y', 'vyska', 'sila', 'barva', 'cil_x', 'cil_y', 'cil_vyska'],
            },
          },
          svet: { type: 'object', additionalProperties: false, properties: { barva: { type: 'string' }, sila: cisloS }, required: ['barva', 'sila'] },
          popis: { type: 'string' },
        },
        required: ['plan', 'objekty', 'svetla', 'svet', 'popis'],
      };
    }

    const SYSTEM_AI = [
      'Jsi pomocník 3D editoru Astro 3D. Ze zadání postavíš scénu z jednoduchých tvarů a vrátíš ji jako JSON.',
      '',
      'SOUŘADNICE (důležité):',
      '- Zem je ve výšce 0. Nic nesmí být pod zemí — spodek je vždy 0 nebo víc.',
      '- x, y je STŘED půdorysu objektu (nikdy ne roh!). x = vlevo (−) / vpravo (+), y = blíž k divákovi (−) / dál (+). Celá scéna má střed v x = 0, y = 0.',
      '- Výšku určuje jen „spodek“: výška spodní hrany nad zemí v metrech.',
      '- sirka = rozměr ve směru x, hloubka = ve směru y, vyska = svislý rozměr. Vše jsou SKUTEČNÉ rozměry v metrech.',
      '- Věc stojí na zemi, když spodek = 0. Věc položená na jiné má spodek = spodek té spodní + její výška.',
      '- otoceni = natočení kolem svislé osy ve stupních (obvykle 0). polozit: "ne" (obvykle), "dopredu" = osa válce/kužele míří k divákovi, "do_strany" = osa míří doprava (kola auta, kmen ležící na zemi).',
      '',
      'TVARY:',
      '- krychle: kvádr (zdi, hradby, stoly, bedny, schody, okna, dveře).',
      '- valec: kulatý sloup, věž, kmen, kolo (polozit "do_strany"), hrnek. koule / ikokoule: koule, koruna stromu, hlava.',
      '- kuzel: kulatá špičatá střecha věže, špička stromu, mrkev. jehlan: čtyřhranná špičatá střecha nebo pyramida.',
      '- strecha: sedlová střecha domu — hřeben vede ve směru x, šikmé plochy klesají k ±y. Dej jí stejnou sirku jako domu, hloubku o kousek větší a spodek = horní hrana zdí.',
      '- rovina: zem nebo podlaha (vyska 0, x 0, y 0). torus: prstenec, kruh, pneumatika.',
      '- Světla (slunce, lampy) patří JEN do pole svetla, nikdy do objekty. Svítící věc (žárovka, oheň) může být objekt se zare > 0.',
      '',
      'STAVBA:',
      '- Věci se musí dotýkat: střecha leží na zdech, okna a dveře jsou na přední stěně (y = přední hrana budovy minus kousek, hloubka 0.1).',
      '- Rozmísti věci kolem bodu x = 0, y = 0 v rozumných velikostech (dům ~6 m, strom ~4 m, člověk ~1.8 m).',
      '- Skládej detaily: okna, dveře, komíny, cimbuří, kola, oči… Typicky 10–35 objektů. Zem přidej jako rovinu (např. 30 × 30 m, spodek 0).',
      '- Barvy "#rrggbb". drsnost 0–1 (0 = lesklé), kov 0 nebo 1, zare 0–15 (svítí: okna v noci, lampy, oheň, oči robota).',
      '- Světla: "slunce" (sila 1–4) svítí z bodu x, y, vyska směrem k cil_x, cil_y, cil_vyska — dej ho vysoko a šikmo (např. −10, −8, 15). "bod" = žárovka (sila 200–2000 W). "reflektor" (sila 200–2000 W) míří na cíl.',
      '- svet = barva oblohy a síla okolního světla. Pokud zadání neříká noc, je DEN: svet světle modrý (#9cc4ec), síla 0,6–0,9, slunce síla 2–3. Noc: tmavě modrá, síla 0,2, svítící okna.',
      '- Používej pestré, ale přirozené barvy: kámen šedý, střechy červené/hnědé/modré, tráva zelená, dřevo hnědé.',
      '- plan = nejdřív si krátce rozmysli části a jejich rozměry; popis = jedna česká věta, co jsi postavil.',
      '',
      'PŘÍKLAD (domek 6 × 4 m, zdi vysoké 3 m):',
      '{"nazev":"Zdi","tvar":"krychle","x":0,"y":0,"spodek":0,"sirka":6,"hloubka":4,"vyska":3,"otoceni":0,"polozit":"ne","barva":"#e8dcc8","drsnost":0.8,"kov":0,"zare":0}',
      '{"nazev":"Střecha","tvar":"strecha","x":0,"y":0,"spodek":3,"sirka":6.4,"hloubka":4.6,"vyska":2,"otoceni":0,"polozit":"ne","barva":"#a8442e","drsnost":0.7,"kov":0,"zare":0}',
      '{"nazev":"Dveře","tvar":"krychle","x":0,"y":-2.02,"spodek":0,"sirka":1,"hloubka":0.1,"vyska":2,"otoceni":0,"polozit":"ne","barva":"#6b3f22","drsnost":0.6,"kov":0,"zare":0}',
      '{"nazev":"Okno","tvar":"krychle","x":-1.8,"y":-2.02,"spodek":1.2,"sirka":0.9,"hloubka":0.1,"vyska":0.9,"otoceni":0,"polozit":"ne","barva":"#ffd98a","drsnost":0.2,"kov":0,"zare":2}',
      '{"nazev":"Zem","tvar":"rovina","x":0,"y":0,"spodek":0,"sirka":30,"hloubka":30,"vyska":0,"otoceni":0,"polozit":"ne","barva":"#5f9e45","drsnost":0.9,"kov":0,"zare":0}',
      'PŘÍKLAD věže v rohu (x 5, y 4): válec 2.4 m široký a 7 m vysoký, na něm kuželová střecha:',
      '{"nazev":"Věž","tvar":"valec","x":5,"y":4,"spodek":0,"sirka":2.4,"hloubka":2.4,"vyska":7,"otoceni":0,"polozit":"ne","barva":"#9a9a9a","drsnost":0.9,"kov":0,"zare":0}',
      '{"nazev":"Střecha věže","tvar":"kuzel","x":5,"y":4,"spodek":7,"sirka":3,"hloubka":3,"vyska":2.5,"otoceni":0,"polozit":"ne","barva":"#3a5fa8","drsnost":0.6,"kov":0,"zare":0}',
      'PŘÍKLAD kola auta (osa do strany): {"nazev":"Kolo","tvar":"valec","x":1.4,"y":-1,"spodek":0,"sirka":0.3,"hloubka":0.8,"vyska":0.8,"otoceni":0,"polozit":"do_strany","barva":"#222222","drsnost":0.7,"kov":0,"zare":0}',
    ].join('\n');

    function popisSceny() {
      return sc.objekty.filter((o) => !o.skryty).slice(0, 40).map((o) => (o.sit
        ? `- ${o.nazev}: ${o.typ}, střed (${o.poz.map((x) => x.toFixed(2)).join(', ')}), měřítko (${o.mer.map((x) => x.toFixed(2)).join(', ')}), barva ${o.barva}`
        : `- ${o.nazev}: světlo ${o.druh} v (${o.poz.map((x) => x.toFixed(1)).join(', ')})`)).join('\n');
    }

    function dialogAI() {
      const pole = el('textarea.b3-ai-pole', { rows: '3', placeholder: 'Popiš scénu — třeba „malý ostrov s palmou a majákem“', spellcheck: 'false' });
      pole.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); bPostav.click(); } if (e.key === 'Escape') zavriDialog(); };
      const NAVRHY = ['domek se zahradou', 'sněhulák', 'robot', 'hrad se čtyřmi věžemi', 'raketa na startovací rampě', 'stůl s lampou', 'auto', 'ostrov s palmou'];
      const chipy = el('div.b3-ai-chipy', {}, NAVRHY.map((n) => el('button.b3-chip', { onclick: () => { pole.value = n; pole.focus(); } }, el('span', { text: n }))));
      const nahradit = el('input', { type: 'checkbox', checked: true });
      const stavEl = el('div.b3-ai-stav');
      const bPostav = el('button.btn.primary', {}, icon('ai'), el('span', { text: 'Postavit' }));
      let ctrl = null;
      bPostav.onclick = async () => {
        const zadani = pole.value.trim();
        if (!zadani || ctrl) return;
        ctrl = new AbortController();
        bPostav.disabled = true;
        const t0 = performance.now();
        const casovac = setInterval(() => { stavEl.textContent = t('AstroAI staví scénu… {x} s', { x: Math.round((performance.now() - t0) / 1000) }); }, 500);
        stavEl.className = 'b3-ai-stav';
        stavEl.textContent = t('AstroAI staví scénu… {x} s', { x: 0 });
        const pridat = !nahradit.checked;
        const prompt = pridat
          ? `ZADÁNÍ: ${zadani}\n\nVe scéně už je:\n${popisSceny() || '(nic)'}\n\nVrať jen NOVÉ objekty, které se ke scéně přidají (navaž na polohy existujících). Světla přidej jen když jsou potřeba.`
          : `ZADÁNÍ: ${zadani}`;
        try {
          const signal = AbortSignal.any ? AbortSignal.any([ctrl.signal, AbortSignal.timeout(300e3)]) : ctrl.signal;
          const spec = await AI.jsonOdpoved([{ role: 'user', content: prompt }], schemaAI(pridat), { system: SYSTEM_AI, teplota: 0.4, maxTokenu: 8000, signal, zdroj: '3d' });
          // malý model občas přidá slunce/světlo i jako tvar (pak vrhá obří stín) — takové vyhodit
          spec.objekty = (spec.objekty || []).filter((o) => !(/slunce|sluníčko|\bsun\b/i.test(o.nazev || '')
            || (/^(světlo|svetlo|light)\b/i.test(String(o.nazev || '').trim()) && !(o.zare > 0))));
          const n = zeSpecu(spec, { nahradit: !pridat });
          if (!pridat) { sc.path = null; spinavy(); }
          if (!sc.pro) nastavStinovani('render');
          stavEl.className = 'b3-ai-stav ok';
          stavEl.textContent = `${spec.popis || ''} (${t('{n} objektů', { n })})`;
        } catch (err) {
          if (err.name === 'AbortError' && !dialog) return;
          stavEl.className = 'b3-ai-stav chyba';
          const u = ukazkaPodle(zadani);
          stavEl.replaceChildren(el('span', { text: err.name === 'TimeoutError' ? 'AstroAI nestihla odpovědět.' : err.message.replace(/\*\*/g, '') }));
          if (u) {
            stavEl.append(el('button.btn', { onclick: () => { otevriUkazku(u); zavriDialog(); } }, t('Postavit ukázku „{x}“', { x: u.nazev })));
          }
        } finally {
          clearInterval(casovac);
          ctrl = null;
          bPostav.disabled = false;
        }
      };
      otevriDialog('AstroAI staví scénu', 'ai', el('div.b3-dlg-telo.b3-ai', {},
        pole,
        chipy,
        el('div.b3-dlg-pata', {},
          el('label.b3-dlg-check', {}, nahradit, el('span', { text: 'Nahradit celou scénu (jinak přidá k té současné)' })),
          el('div.b3-spacer'), bPostav),
        stavEl,
        el('div.b3-dlg-info', { text: 'V plné verzi AI skládá scénu z krychlí, koulí, válců… V ukázkové verzi AI není.' }),
      ), () => ctrl?.abort());
      setTimeout(() => pole.focus(), 60);
    }

    // ---------------------------------------------------------------- OBJ
    function importujObj(text, jmeno = 'Model') {
      let casti;
      try { casti = nactiObj(text, jmeno); } catch (err) {
        return toast({ title: 'OBJ nejde načíst', body: err.message, icon: 'info', timeout: 5000 });
      }
      const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
      for (const c of casti) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], c.mn[k]); mx[k] = Math.max(mx[k], c.mx[k]); }
      const vel = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]);
      // obří nebo drobné modely (třeba v milimetrech) se přizpůsobí na ~4 m
      const s = vel > 50 || vel < 0.05 ? 4 / Math.max(vel, 1e-9) : 1;
      zapamatuj();
      sc.uprava = null;
      const nove = [];
      for (const c of casti) {
        const ob = {
          id: 'o' + dalsiId++, nazev: unikatniNazev(c.nazev || jmeno), typ: 'sit', sit: c.sit,
          poz: c.stred.map((x) => x * s), rot: [0, 0, 0], mer: [s, s, s],
          barva: '#cccccc', drs: 0.5, kov: 0, zare: 0, hladke: c.sit.v.length / 3 > 200, skryty: false,
        };
        sc.objekty.push(ob);
        nove.push(ob.id);
      }
      vyber(nove);
      spinavy();
      zamer(true);
      const ploch = casti.reduce((a, c) => a + c.sit.f.length, 0);
      toast({
        title: t('Importováno: {x}', { x: jmeno }),
        body: t('{n} objektů', { n: casti.length }) + ` · ${ploch.toLocaleString('cs-CZ')} ploch` + (s !== 1 ? ` · ${t('velikost upravena ×{x}', { x: +s.toPrecision(3) })}` : ''),
        icon: 'b3krychle', timeout: 4000,
      });
    }

    function exportujObj(stahnout) {
      return toast({ title: 'Jen v plné verzi', body: 'Import a export OBJ je jen v plné verzi AstroOS.', icon: 'info', timeout: 4000 });
      const vyb = vybraneObj().filter((o) => o.sit);
      const objs = (vyb.length ? vyb : sc.objekty).filter((o) => o.sit && !o.skryty);
      if (!objs.length) return toast({ title: 'Není co exportovat', body: 'Ve scéně nejsou žádné tvary.', icon: 'info' });
      const text = zapisObj(objs);
      const jmeno = (sc.path ? FS.basename(sc.path).replace(/\.a3d$/i, '') : 'model') + '.obj';
      if (stahnout) {
        const url = URL.createObjectURL(new Blob([text], { type: 'model/obj' }));
        const a = el('a', { href: url, download: jmeno });
        document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        return;
      }
      mkSlozku();
      const path = FS.normalize(SLOZKA + '/' + FS.freeName(SLOZKA, jmeno));
      try { FS.write(path, text); } catch (err) {
        return toast({ title: 'Export selhal', body: err.message, icon: 'info', timeout: 6000 });
      }
      toast({ title: 'OBJ uložen', body: `${path} · ${t('{n} objektů', { n: objs.length })} · ${FS.humanSize(text.length)}`, icon: 'check', timeout: 3500 });
    }

    function importZPocitace() {
      const inp = el('input', { type: 'file', accept: '.obj,text/plain' });
      inp.onchange = () => {
        const f = inp.files?.[0];
        if (!f) return;
        if (f.size > 40 * 1024 * 1024) return toast({ title: 'Soubor je moc velký', body: `${f.name} · ${FS.humanSize(f.size)}`, icon: 'info' });
        f.text().then((txt) => importujObj(txt, f.name.replace(/\.obj$/i, '')));
      };
      inp.click();
    }

    const polozkyImportu = () => {
      const soubory = najdiSoubory(/\.obj$/i).slice(0, 20).map((it) => ({ icon: 'b3krychle', label: it.name, onClick: () => importujObj(FS.read(it.path), it.name.replace(/\.obj$/i, '')) }));
      return [...soubory, ...(soubory.length ? ['sep'] : []), { icon: 'folderOpen', label: 'Z počítače…', onClick: importZPocitace }];
    };

    // ---------------------------------------------------------------- lišta
    const jmenoEl = el('div.b3-jmeno');
    const bSoubor = el('button.b3-menu', { text: 'Soubor' });
    bSoubor.onclick = () => nabidkaSoubor(bSoubor);
    const bPridat = el('button.b3-menu', { text: 'Přidat' });
    bPridat.onclick = () => { const q = bPridat.getBoundingClientRect(); contextMenu(polozkyPridat(), { x: q.left, y: q.bottom + 6 }); };
    const bPohled = el('button.b3-menu', { text: 'Pohled' });
    bPohled.onclick = () => nabidkaPohled(bPohled);
    const bObjekt = el('button.b3-menu', { text: 'Objekt' });
    bObjekt.onclick = () => {
      const q = bObjekt.getBoundingClientRect();
      if (sc.uprava) nabidkaUpravy(q.left, q.bottom + 6); else nabidkaObjektu(q.left, q.bottom + 6, { x: -1e4, y: -1e4 });
    };

    const bRezim = el('button.b3-rezim', { title: 'Přepnout režim (Tab)', onclick: prepniUpravy }, icon('b3uprava'), el('span'));
    const rezimyEl = el('div.b3-grp.b3-rezimy', {}, REZIMY.map((rz) => el('button.b3-btn.ic', {
      title: `${rz.nazev} (${rz.klavesa})`, dataset: { id: rz.id }, onclick: () => nastavRezim(rz.id),
    }, icon(rz.ikona))));

    const bZpet = el('button.b3-btn.ic', { title: 'Zpět (Ctrl+Z)', onclick: zpet }, icon('undo'));
    const bVpred = el('button.b3-btn.ic', { title: 'Vpřed (Ctrl+Y)', onclick: vpred }, icon('redo'));
    function nastavStinovani(druh) {
      if (druh === 'drat') sc.drat = true;
      else { sc.drat = false; sc.render = druh === 'render'; sc.pro = druh === 'pro'; }
      if (sc.pro && sc.uprava) toast({ title: 'Render Pro ukáže výsledek po návratu do objektů', body: 'V režimu úprav se kreslí rychlý render.', icon: 'info', timeout: 3000 });
      obnovListu(); obnovStav(); pozadej();
    }
    const bDrat = el('button.b3-btn', { title: 'Drátový model (Z)', onclick: () => nastavStinovani('drat') }, icon('b3drat'), el('span', { text: 'Drát' }));
    const bSolid = el('button.b3-btn', { title: 'Plné stínování', onclick: () => nastavStinovani('plne') }, icon('b3koule'), el('span', { text: 'Plné' }));
    const bRender = el('button.b3-btn', { title: 'Render se světly a stíny (Shift+Z)', onclick: () => nastavStinovani('render') }, icon('b3render'), el('span', { text: 'Render' }));
    const bMrizka = el('button.b3-btn.ic', { title: 'Mřížka', onclick: () => { sc.mrizka = !sc.mrizka; obnovListu(); pozadej(); } }, icon('grid'));
    const bPro = el('button.b3-btn', { title: 'Render Pro — path tracing přímo ve výřezu', onclick: () => nastavStinovani('pro') }, icon('b3pro'), el('span', { text: 'Pro' }));
    const bSnimek = el('button.b3-btn.b3-render', { title: 'Render Pro do obrázku (F12)', onclick: renderPro }, icon('b3pro'), el('span', { text: 'Render' }));

    const lista = el('div.b3-lista', {},
      el('div.b3-grp', {}, bRezim),
      rezimyEl,
      el('div.b3-grp', {}, bSoubor, bPridat, bObjekt, bPohled),
      el('div.b3-grp', {}, bZpet, bVpred),
      el('div.b3-grp', {}, bDrat, bSolid, bRender, bPro, bMrizka),
      el('div.b3-spacer'),
      el('button.b3-btn.b3-ai-btn', { title: 'AstroAI postaví scénu podle popisu', onclick: () => dialogAI() }, icon('ai'), el('span', { text: 'AI' })),
      bSnimek,
    );

    // levý sloupec: nástroje + v režimu úprav i operace
    const nastrojeEl = el('div.b3-nastroje-grp', {}, NASTROJE.map((n) => el('button.b3-nastroj', {
      title: `${n.nazev} (${n.klavesa})`, dataset: { id: n.id }, onclick: () => nastavNastroj(n.id),
    }, icon(n.ikona))));
    const bVytah = el('button.b3-nastroj', { title: 'Vytáhnout (Ctrl+E)', onclick: () => { mysDoStredu(); vytahni(); } }, icon('b3vytah'));
    const bVsad = el('button.b3-nastroj', { title: 'Vsadit plochy (I)', onclick: () => { mysDoStredu(); vsazeni(); } }, icon('b3vsad'));
    const bRez = el('button.b3-nastroj', { title: 'Řez smyčkou (Ctrl+R)', onclick: () => (rez ? ukonciRez() : zacniRez(true)) }, icon('b3rez'));
    const operaceEl = el('div.b3-nastroje-grp.b3-operace', {}, el('div.b3-oddel'), bVytah, bVsad, bRez);
    const levyEl = el('div.b3-nastroje', {}, nastrojeEl, operaceEl);

    /** Tlačítka v levém sloupci: modální operace začne s myší kousek od výběru. */
    function mysDoStredu() {
      if (!pohled || neniCoUpravit()) return;
      const P = naObr(pivot());
      mys = { x: clamp(P[0] + 90, 10, pohled.W - 10), y: clamp(P[1] - 40, 10, pohled.H - 10), uvnitr: true };
    }

    function obnovListu() {
      bZpet.disabled = !sc.undo.length;
      bVpred.disabled = !sc.redo.length;
      bSolid.classList.toggle('on', !sc.drat && !sc.render && !sc.pro);
      bDrat.classList.toggle('on', sc.drat);
      bRender.classList.toggle('on', !sc.drat && sc.render);
      bPro.classList.toggle('on', !sc.drat && sc.pro);
      bMrizka.classList.toggle('on', sc.mrizka);
      for (const b of nastrojeEl.children) b.classList.toggle('on', b.dataset.id === sc.nastroj);
      bRezim.classList.toggle('on', !!sc.uprava);
      bRezim.lastChild.textContent = sc.uprava ? 'Režim úprav' : 'Režim objektů';
      rezimyEl.style.display = sc.uprava ? '' : 'none';
      operaceEl.style.display = sc.uprava ? '' : 'none';
      for (const b of rezimyEl.children) b.classList.toggle('on', b.dataset.id === sc.uprava?.rezim);
      bRez.classList.toggle('on', !!rez);
    }

    function nastavNastroj(id) { ukonciRez(); sc.nastroj = id; najeto = null; obnovListu(); pozadej(); }

    // ---------------------------------------------------------------- časová osa
    const osaCv = el('canvas.b3-osa-cv');
    const bHrat = el('button.b3-btn.ic', { title: 'Přehrát / zastavit (mezerník)', onclick: () => prehrat() }, icon('b3hrat'));
    const snimekInp = el('input.b3-osa-cislo', { type: 'number', title: 'Aktuální snímek' });
    const startInp = el('input.b3-osa-cislo', { type: 'number', title: 'První snímek' });
    const konecInp = el('input.b3-osa-cislo', { type: 'number', title: 'Poslední snímek' });
    const fpsSel = el('select.b3-select.b3-osa-fps', { title: 'Snímků za sekundu' }, [12, 24, 25, 30, 60].map((f) => el('option', { value: String(f), text: `${f} fps` })));
    for (const inp of [snimekInp, startInp, konecInp]) {
      inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter' || e.key === 'Escape') { inp.blur(); body.focus(); } };
    }
    snimekInp.onchange = () => nastavSnimek(+snimekInp.value || 0);
    startInp.onchange = () => {
      const v = Math.round(+startInp.value || 0);
      sc.anim.start = Math.min(v, sc.anim.konec - 1);
      spinavy(); obnovOsu();
    };
    konecInp.onchange = () => {
      const v = Math.round(+konecInp.value || 0);
      sc.anim.konec = Math.max(v, sc.anim.start + 1);
      spinavy(); obnovOsu();
    };
    fpsSel.onchange = () => { sc.anim.fps = +fpsSel.value; spinavy(); };

    const osaEl = el('div.b3-osa', {},
      el('div.b3-osa-ovl', {},
        el('button.b3-btn.ic', { title: 'Na začátek (Shift+←)', onclick: () => nastavSnimek(sc.anim.start) }, icon('b3naZacatek')),
        el('button.b3-btn.ic', { title: 'Předchozí klíč (↓)', onclick: () => skocNaKlic(-1) }, icon('chevronLeft')),
        bHrat,
        el('button.b3-btn.ic', { title: 'Další klíč (↑)', onclick: () => skocNaKlic(1) }, icon('chevronRight')),
        el('button.b3-btn.ic', { title: 'Na konec (Shift+→)', onclick: () => nastavSnimek(sc.anim.konec) }, icon('b3naKonec')),
        snimekInp,
      ),
      osaCv,
      el('div.b3-osa-ovl', {},
        el('span.b3-osa-popis', { text: 'Od' }), startInp,
        el('span.b3-osa-popis', { text: 'Do' }), konecInp,
        fpsSel,
        el('button.b3-btn', { title: 'Vložit klíčový snímek (I)', onclick: vlozKlic }, icon('b3klic'), el('span', { text: 'Klíč' })),
        el('button.b3-btn.ic', { title: 'Smazat klíč na tomto snímku (Alt+I)', onclick: smazKlic }, icon('trash')),
        el('button.b3-btn', { title: 'Uložit animaci jako video', onclick: dialogExportu }, icon('b3film'), el('span', { text: 'Video' })),
      ),
    );

    const xSnimku = (f, w) => {
      const a = sc.anim, okraj = 10;
      return okraj + (f - a.start) / Math.max(1, a.konec - a.start) * (w - okraj * 2);
    };

    function obnovOsu() {
      const a = sc.anim;
      if (document.activeElement !== snimekInp) snimekInp.value = String(a.snimek);
      if (document.activeElement !== startInp) startInp.value = String(a.start);
      if (document.activeElement !== konecInp) konecInp.value = String(a.konec);
      fpsSel.value = String(a.fps);
      bHrat.replaceChildren(icon(prehravani ? 'b3pauza' : 'b3hrat'));
      bHrat.classList.toggle('on', !!prehravani);

      const dpr = window.devicePixelRatio || 1;
      const w = osaCv.clientWidth || 1, h = osaCv.clientHeight || 1;
      if (osaCv.width !== Math.round(w * dpr) || osaCv.height !== Math.round(h * dpr)) { osaCv.width = Math.round(w * dpr); osaCv.height = Math.round(h * dpr); }
      const c = osaCv.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);
      const tmave = getComputedStyle(body).getPropertyValue('--txt').trim() || '#ddd';
      // rozsah a dílky
      c.fillStyle = 'rgba(128,128,128,.10)';
      c.fillRect(xSnimku(a.start, w), 0, xSnimku(a.konec, w) - xSnimku(a.start, w), h);
      const naSnimek = (w - 20) / Math.max(1, a.konec - a.start);
      const krok = [1, 2, 5, 10, 20, 50, 100, 200, 500].find((k) => k * naSnimek >= 34) || 1000;
      c.font = '10px "Segoe UI", system-ui, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'top';
      for (let f = Math.ceil(a.start / krok) * krok; f <= a.konec; f += krok) {
        const x = xSnimku(f, w);
        c.fillStyle = 'rgba(128,128,128,.45)';
        c.fillRect(Math.round(x), 14, 1, h - 14);
        c.fillStyle = tmave;
        c.globalAlpha = 0.55;
        c.fillText(String(f), x, 2);
        c.globalAlpha = 1;
      }
      // klíče: vybraných objektů výrazně, ostatních slabě
      const vyb = new Set(vybraneObj().map((o) => o.id));
      for (const o of sc.objekty) {
        const sel = vyb.has(o.id);
        for (const f of A.snimkyKlicu(o.klice)) {
          if (f < a.start - 1 || f > a.konec + 1) continue;
          const x = xSnimku(f, w), y = h * 0.62, r0 = sel ? 5 : 3.5;
          c.beginPath();
          c.moveTo(x, y - r0); c.lineTo(x + r0, y); c.lineTo(x, y + r0); c.lineTo(x - r0, y); c.closePath();
          c.fillStyle = sel ? (f === a.snimek ? '#ffd24d' : '#f0b030') : 'rgba(160,160,160,.6)';
          c.fill();
          c.strokeStyle = 'rgba(0,0,0,.5)';
          c.lineWidth = 1;
          c.stroke();
        }
      }
      // ukazatel aktuálního snímku
      const x = xSnimku(a.snimek, w);
      c.fillStyle = '#4d8ff0';
      c.fillRect(Math.round(x) - 1, 0, 2, h);
      const txt = String(a.snimek), tw = c.measureText(txt).width + 10;
      c.beginPath();
      c.roundRect(x - tw / 2, 0, tw, 14, 4);
      c.fill();
      c.fillStyle = '#fff';
      c.fillText(txt, x, 2);
    }

    // tažením po ose se posouvá čas
    osaCv.onpointerdown = (e) => {
      e.preventDefault();
      try { osaCv.setPointerCapture(e.pointerId); } catch { /* nic */ }
      const naSnimek = (ev) => {
        const r0 = osaCv.getBoundingClientRect(), a = sc.anim;
        const f = a.start + (ev.clientX - r0.left - 10) / Math.max(1, r0.width - 20) * (a.konec - a.start);
        nastavSnimek(f);
      };
      naSnimek(e);
      osaCv.onpointermove = (ev) => { if (ev.buttons) naSnimek(ev); };
      osaCv.onpointerup = () => { osaCv.onpointermove = null; body.focus(); };
    };
    new ResizeObserver(() => obnovOsu()).observe(osaCv);

    // ---------------------------------------------------------------- přehled scény
    const seznamEl = el('div.b3-seznam');

    function obnovSeznam() {
      seznamEl.replaceChildren(...sc.objekty.map((o) => {
        const tv = TVARY.find((x) => x.id === o.typ);
        const jm = el('span.b3-ob-jm', { text: o.nazev });
        const oko = el('button.b3-oko', { title: o.skryty ? 'Zobrazit' : 'Skrýt' }, icon(o.skryty ? 'eyeOff' : 'eye'));
        oko.onclick = (e) => {
          e.stopPropagation();
          if (sc.uprava?.id === o.id) return;
          zapamatuj();
          o.skryty = !o.skryty;
          if (o.skryty) { sc.vybrane.delete(o.id); if (sc.aktivni === o.id) sc.aktivni = null; }
          spinavy(); obnovVse();
        };
        const radek = el('div.b3-ob' + (sc.vybrane.has(o.id) ? '.vybrany' : '') + (sc.aktivni === o.id ? '.aktivni' : '') + (o.skryty ? '.skryty' : '') + (sc.uprava?.id === o.id ? '.upravovany' : ''), {},
          icon(sc.uprava?.id === o.id ? 'b3uprava' : jeSvetlo(o) ? DRUHY_SVETEL.find((d) => d.id === o.druh).ikona : tv?.ikona || 'b3krychle'), jm, oko);
        radek.onclick = (e) => {
          if (o.skryty || sc.uprava) return;
          if (e.ctrlKey || e.shiftKey) {
            if (sc.vybrane.has(o.id) && sc.aktivni === o.id) { sc.vybrane.delete(o.id); sc.aktivni = null; obnovVse(); } else vyber([o.id], { pridat: true });
          } else vyber([o.id]);
        };
        radek.ondblclick = () => prejmenuj(o, jm);
        radek.oncontextmenu = (e) => {
          e.preventDefault();
          if (sc.uprava) return;
          if (!sc.vybrane.has(o.id) && !o.skryty) vyber([o.id]);
          contextMenu([
            { icon: 'pencil', label: 'Přejmenovat', onClick: () => prejmenuj(o, jm) },
            { icon: 'b3uprava', label: 'Upravit síť', onClick: () => { vyber([o.id]); prepniUpravy(); } },
            { icon: 'search', label: 'Zaměřit', onClick: () => zamer(true) },
            { icon: 'copy', label: 'Duplikovat', onClick: duplikuj },
            { icon: 'trash', label: 'Smazat', danger: true, onClick: smazVybrane },
          ], { x: e.clientX, y: e.clientY });
        };
        return radek;
      }));
      if (!sc.objekty.length) seznamEl.append(el('div.b3-prazdno', { text: 'Scéna je prázdná — přidej tvar přes Shift+A.' }));
    }

    function prejmenuj(o, jmEl) {
      const inp = el('input.b3-prejm', { value: o.nazev, maxlength: '63' });
      jmEl.replaceWith(inp);
      inp.focus(); inp.select();
      let hotovo = false;
      const konec = (ulozit) => {
        if (hotovo) return;
        hotovo = true;
        const nove = inp.value.trim();
        if (ulozit && nove && nove !== o.nazev) { zapamatuj(); o.nazev = unikatniNazev(nove); spinavy(); }
        obnovVse();
        body.focus();
      };
      inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') konec(true); if (e.key === 'Escape') konec(false); };
      inp.onblur = () => konec(true);
      inp.onclick = (e) => e.stopPropagation();
    }

    // ---------------------------------------------------------------- vlastnosti
    const vlastnostiEl = el('div.b3-vlastnosti');
    const pole = [];          // { obnov() } — objekt
    const poleUpravy = [];    // { obnov() } — režim úprav

    /** Číselné pole jako v Blenderu: tažení do stran mění hodnotu, klik = psaní. */
    function cisloPole(get, set, { krok = 0.01, desetin = 3, jednotka = '' } = {}, seznam = pole) {
      const inp = el('input.b3-cislo', { type: 'text', spellcheck: 'false' });
      let tt = null;
      const J = () => (typeof jednotka === 'function' ? jednotka() : jednotka);
      const K = () => (typeof krok === 'function' ? krok() : krok);
      const ukaz = () => { if (document.activeElement !== inp) inp.value = fmt(get(), desetin) + J(); };
      inp.onpointerdown = (e) => {
        if (document.activeElement === inp) return;
        e.preventDefault();
        tt = { x: e.clientX, v: get(), pohnul: false };
        try { inp.setPointerCapture(e.pointerId); } catch { /* nic */ }
      };
      inp.onpointermove = (e) => {
        if (!tt) return;
        const dx = e.clientX - tt.x;
        if (!tt.pohnul && Math.abs(dx) > 3) { tt.pohnul = true; zapamatuj(); inp.classList.add('tahne'); }
        if (tt.pohnul) {
          let v = tt.v + dx * K() * (e.shiftKey ? 0.1 : 1);
          if (e.ctrlKey) v = Math.round(v / (K() * 10)) * K() * 10;
          set(v); ukaz(); pozadej();
        }
      };
      inp.onpointerup = () => {
        if (!tt) return;
        const pohnul = tt.pohnul;
        tt = null;
        inp.classList.remove('tahne');
        if (pohnul) { spinavy(); obnovVse(); uklidGpu(); } else { inp.value = fmt(get(), desetin); inp.focus(); inp.select(); }
      };
      const potvrd = () => {
        const v = parseFloat(inp.value.replace(',', '.').replace(/[^\d.eE+-]/g, ''));
        if (Number.isFinite(v) && Math.abs(v - get()) > 1e-9) { zapamatuj(); set(v); spinavy(); obnovVse(); uklidGpu(); }
        ukaz();
      };
      inp.onkeydown = (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') { potvrd(); inp.blur(); body.focus(); }
        if (e.key === 'Escape') { ukaz(); inp.blur(); body.focus(); }
      };
      inp.onblur = () => potvrd();
      seznam.push({ obnov: ukaz });
      return inp;
    }

    function trojice(nazev, get, set, volby, seznam = pole) {
      return el('div.b3-skup', {},
        el('div.b3-popis', { text: nazev }),
        el('div.b3-trojice', {}, [0, 1, 2].map((i) => el('label.b3-os', {},
          el('span', { text: OSY[i], style: { color: BARVY_OS[i] } }),
          cisloPole(() => get(i), (v) => set(i, v), volby, seznam),
        ))),
      );
    }
    const trojiceObj = (nazev, klic, volby) => trojice(nazev,
      (i) => aktivniObj()?.[klic][i] ?? 0,
      (i, v) => { const o = aktivniObj(); if (o) o[klic][i] = v; }, volby);

    function posuvnik(nazev, klic, max = 1) {
      const rng = el('input.b3-rozsah', { type: 'range', min: '0', max: String(max), step: String(max / 100) });
      const hodnota = el('span.b3-hodnota');
      let zacal = false;
      rng.oninput = () => {
        const o = aktivniObj();
        if (!o) return;
        if (!zacal) { zapamatuj(); zacal = true; }
        o[klic] = +rng.value;
        hodnota.textContent = (+rng.value).toFixed(2);
        pozadej();
      };
      rng.onchange = () => { zacal = false; spinavy(); obnovListu(); };
      rng.onkeydown = (e) => e.stopPropagation();
      pole.push({ obnov: () => { const o = aktivniObj(); if (o) { rng.value = String(o[klic] || 0); hodnota.textContent = (o[klic] || 0).toFixed(2); } } });
      return el('div.b3-radek', {}, el('span.b3-popis', { text: nazev }), rng, hodnota);
    }

    const nazevInp = el('input.b3-text', { maxlength: '63', spellcheck: 'false' });
    nazevInp.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter' || e.key === 'Escape') { if (e.key === 'Escape') nazevInp.value = aktivniObj()?.nazev || ''; nazevInp.blur(); body.focus(); } };
    nazevInp.onchange = () => {
      const o = aktivniObj(), nove = nazevInp.value.trim();
      if (o && nove && nove !== o.nazev) { zapamatuj(); o.nazev = unikatniNazev(nove); spinavy(); obnovVse(); }
    };
    pole.push({ obnov: () => { if (document.activeElement !== nazevInp) nazevInp.value = aktivniObj()?.nazev || ''; } });

    const barvaInp = el('input.b3-barva', { type: 'color' });
    let barvaZacala = false;
    barvaInp.oninput = () => {
      const o = aktivniObj();
      if (!o) return;
      if (!barvaZacala) { zapamatuj(); barvaZacala = true; }
      o.barva = barvaInp.value;
      pozadej();
    };
    barvaInp.onchange = () => { barvaZacala = false; spinavy(); obnovListu(); };
    const paletaEl = el('div.b3-paleta', {}, PALETA.map((c) => el('button.b3-vzorek', {
      style: { background: c }, title: c,
      onclick: () => { const o = aktivniObj(); if (!o) return; zapamatuj(); o.barva = c; barvaInp.value = c; spinavy(); obnovListu(); pozadej(); },
    })));
    pole.push({ obnov: () => { const o = aktivniObj(); if (o) barvaInp.value = o.barva; } });

    const hladkeInp = el('input', { type: 'checkbox' });
    hladkeInp.onchange = () => { const o = aktivniObj(); if (!o) return; zapamatuj(); o.hladke = hladkeInp.checked; spinavy(); obnovListu(); pozadej(); };
    pole.push({ obnov: () => { hladkeInp.checked = !!aktivniObj()?.hladke; } });

    const statEl = el('div.b3-stat');
    pole.push({
      obnov: () => {
        const o = aktivniObj();
        if (!o?.sit) return;
        const s = statistika(o.sit);
        statEl.textContent = `${s.vrcholy} vrcholů · ${s.plochy} ploch · ${s.troj} trojúhelníků`;
      },
    });

    // režim úprav: střed výběru (lokálně, jako „Median“ v Blenderu) + rychlé operace
    function stredVyberu() {
      const o = upravObj(), vv = selV();
      const s = [0, 0, 0];
      if (!o || !vv.size) return s;
      for (const i of vv) for (let k = 0; k < 3; k++) s[k] += o.sit.v[i * 3 + k] / vv.size;
      return s;
    }
    const upravaEl = el('div.b3-form.b3-upr', {},
      el('div.b3-nadpis', {}, icon('b3uprava'), el('span', { text: 'Režim úprav' })),
      el('div.b3-rezimy-panel', {}, REZIMY.map((rz) => el('button.b3-chip', { dataset: { id: rz.id }, onclick: () => nastavRezim(rz.id) }, icon(rz.ikona), el('span', { text: rz.nazev })))),
      trojice('Střed výběru', (i) => stredVyberu()[i], (i, v) => {
        const o = upravObj(), vv = selV();
        if (!o || !vv.size) return;
        const d = v - stredVyberu()[i];
        const nv = o.sit.v.slice();
        for (const j of vv) nv[j * 3 + i] += d;
        o.sit = { v: nv, f: o.sit.f };
      }, { krok: 0.01, desetin: 3, jednotka: ' m' }, poleUpravy),
      el('div.b3-stat.b3-upr-stat'),
      el('div.b3-akce', {},
        el('button.b3-akce-btn', { onclick: () => { mysDoStredu(); vytahni(); } }, icon('b3vytah'), el('span', { text: 'Vytáhnout' }), el('kbd', { text: 'Ctrl+E' })),
        el('button.b3-akce-btn', { onclick: () => { mysDoStredu(); vsazeni(); } }, icon('b3vsad'), el('span', { text: 'Vsadit' }), el('kbd', { text: 'I' })),
        el('button.b3-akce-btn', { onclick: () => zacniRez(false) }, icon('b3rez'), el('span', { text: 'Řez smyčkou' }), el('kbd', { text: 'Ctrl+R' })),
        el('button.b3-akce-btn', { onclick: rozdelit }, icon('b3plocha'), el('span', { text: 'Rozdělit' })),
        el('button.b3-akce-btn', { onclick: vypln }, icon('b3plocha'), el('span', { text: 'Vyplnit díru' }), el('kbd', { text: 'F' })),
        el('button.b3-akce-btn', { onclick: vyhlad }, icon('b3vyhlad'), el('span', { text: 'Vyhladit dělením' })),
      ),
    );
    const updStat = upravaEl.querySelector('.b3-upr-stat');

    // části formuláře, které se schovávají podle druhu objektu (síť / světlo)
    const otoceniEl = trojiceObj('Otočení', 'rot', { krok: 0.5, desetin: 1, jednotka: '°' });
    const meritkoEl = trojiceObj('Měřítko', 'mer', { krok: 0.005, desetin: 3 });
    const materialEl = el('div', {},
      el('div.b3-nadpis', {}, icon('b3koule'), el('span', { text: 'Materiál' })),
      el('div.b3-radek', {}, el('span.b3-popis', { text: 'Barva' }), barvaInp, paletaEl),
      posuvnik('Drsnost', 'drs'),
      posuvnik('Kovovost', 'kov'),
      posuvnik('Záře', 'zare', 10),
      el('label.b3-radek.b3-check', {}, hladkeInp, el('span', { text: 'Hladké stínování' })),
    );

    // světlo
    const zmenaSvetla = (fn) => { const o = aktivniObj(); if (!jeSvetlo(o)) return; zapamatuj(); fn(o); spinavy(); obnovVse(); };
    const druhyEl = el('div.b3-rezimy-panel', {}, DRUHY_SVETEL.map((d) => el('button.b3-chip', {
      dataset: { id: d.id },
      onclick: () => zmenaSvetla((o) => {
        if (o.druh === d.id) return;
        // slunce měří sílu ve W/m², ostatní ve W — přepočet na rozumné výchozí hodnoty
        if (d.id === 'slunce') o.sila = 2; else if (o.druh === 'slunce') o.sila = 1000;
        o.druh = d.id;
      }),
    }, icon(d.ikona), el('span', { text: d.nazev }))));
    const svBarvaInp = el('input.b3-barva', { type: 'color' });
    let svBarvaZacala = false;
    svBarvaInp.oninput = () => {
      const o = aktivniObj();
      if (!jeSvetlo(o)) return;
      if (!svBarvaZacala) { zapamatuj(); svBarvaZacala = true; }
      o.barva = svBarvaInp.value;
      pozadej();
    };
    svBarvaInp.onchange = () => { svBarvaZacala = false; spinavy(); obnovListu(); };
    const svPaleta = el('div.b3-paleta', {}, PALETA_SVETLA.map((c) => el('button.b3-vzorek', {
      style: { background: c }, title: c,
      onclick: () => zmenaSvetla((o) => { o.barva = c; }),
    })));
    pole.push({ obnov: () => { const o = aktivniObj(); if (jeSvetlo(o)) svBarvaInp.value = o.barva; } });
    const silaEl = el('div.b3-radek', {}, el('span.b3-popis', { text: 'Síla' }),
      cisloPole(() => aktivniObj()?.sila ?? 0, (v) => { const o = aktivniObj(); if (jeSvetlo(o)) o.sila = Math.max(0, v); }, {
        krok: () => (aktivniObj()?.druh === 'slunce' ? 0.02 : 10), desetin: 1,
        jednotka: () => (aktivniObj()?.druh === 'slunce' ? ' W/m²' : ' W'),
      }));
    const uhelEl = el('div.b3-radek', {}, el('span.b3-popis', { text: 'Kužel' }),
      cisloPole(() => aktivniObj()?.uhel ?? 45, (v) => { const o = aktivniObj(); if (jeSvetlo(o)) o.uhel = clamp(v, 1, 180); }, { krok: 0.5, desetin: 1, jednotka: '°' }));
    const mekkostEl = posuvnik('Okraj', 'mekkost');
    const stinyInp = el('input', { type: 'checkbox' });
    stinyInp.onchange = () => zmenaSvetla((o) => { o.stiny = stinyInp.checked; });
    pole.push({ obnov: () => { const o = aktivniObj(); if (jeSvetlo(o)) stinyInp.checked = o.stiny; } });
    const svPozn = el('button.b3-pozn', { onclick: () => nastavStinovani('render') }, icon('b3render'),
      el('span', { text: 'Světla svítí v režimu Render — zapnout (Shift+Z)' }));
    const svetloEl = el('div', {},
      el('div.b3-nadpis', {}, icon('b3svetlo'), el('span', { text: 'Světlo' })),
      druhyEl,
      el('div.b3-radek', {}, el('span.b3-popis', { text: 'Barva' }), svBarvaInp, svPaleta),
      silaEl, uhelEl, mekkostEl,
      el('label.b3-radek.b3-check', {}, stinyInp, el('span', { text: 'Vrhá stíny' })),
      posuvnik('Měkkost stínu', 'polomer'),
      svPozn,
    );

    const formular = el('div.b3-form', {},
      el('div.b3-nadpis', {}, icon('b3krychle'), el('span', { text: 'Objekt' })),
      el('div.b3-radek', {}, el('span.b3-popis', { text: 'Název' }), nazevInp),
      trojiceObj('Umístění', 'poz', { krok: 0.01, desetin: 3, jednotka: ' m' }),
      otoceniEl,
      meritkoEl,
      statEl,
      materialEl,
      svetloEl,
    );

    // svět (pozadí a okolní světlo) — ukazuje se, když není nic vybrané
    const poleSvet = [];
    const svetBarvaInp = el('input.b3-barva', { type: 'color' });
    let svetZacal = false;
    svetBarvaInp.oninput = () => {
      if (!svetZacal) { zapamatuj(); svetZacal = true; }
      sc.svet.barva = svetBarvaInp.value;
      pozadej();
    };
    svetBarvaInp.onchange = () => { svetZacal = false; spinavy(); obnovListu(); };
    poleSvet.push({ obnov: () => { svetBarvaInp.value = sc.svet.barva; } });
    const svetEl = el('div.b3-form.b3-svet', {},
      el('div.b3-nadpis', {}, icon('globe'), el('span', { text: 'Svět' })),
      el('div.b3-radek', {}, el('span.b3-popis', { text: 'Barva' }), svetBarvaInp, el('span.b3-popis.b3-dlouhy', { text: 'pozadí a okolní světlo v Renderu' })),
      el('div.b3-radek', {}, el('span.b3-popis', { text: 'Síla' }),
        cisloPole(() => sc.svet.sila, (v) => { sc.svet.sila = clamp(v, 0, 100); }, { krok: 0.01, desetin: 2 }, poleSvet)),
    );

    const nicEl = el('div.b3-nic', {},
      icon('b3vyber'),
      el('p', { text: 'Nic není vybrané.' }),
      el('p.mal', { text: 'Klikni na objekt ve scéně nebo v seznamu. Nový tvar přidáš přes Shift+A.' }),
    );
    vlastnostiEl.append(upravaEl, formular, nicEl, svetEl);

    function obnovVlastnosti() {
      const o = aktivniObj();
      upravaEl.style.display = sc.uprava ? '' : 'none';
      formular.style.display = o && !sc.uprava ? '' : 'none';
      nicEl.style.display = o || sc.uprava ? 'none' : '';
      svetEl.style.display = nicEl.style.display;
      if (!o && !sc.uprava) for (const p of poleSvet) p.obnov();
      if (o && !sc.uprava) {
        const sv = jeSvetlo(o);
        for (const x of [meritkoEl, statEl, materialEl]) x.style.display = sv ? 'none' : '';
        svetloEl.style.display = sv ? '' : 'none';
        if (sv) {
          otoceniEl.style.display = o.druh === 'bod' ? 'none' : '';
          for (const x of [uhelEl, mekkostEl]) x.style.display = o.druh === 'reflektor' ? '' : 'none';
          for (const b of druhyEl.children) b.classList.toggle('on', b.dataset.id === o.druh);
          svPozn.style.display = sc.render ? 'none' : '';
        } else otoceniEl.style.display = '';
      }
      if (sc.uprava) {
        for (const p of poleUpravy) p.obnov();
        for (const b of upravaEl.querySelectorAll('.b3-chip')) b.classList.toggle('on', b.dataset.id === sc.uprava.rezim);
        const vv = selV().size;
        updStat.textContent = vv ? `${vv} vybraných vrcholů` : 'Nic není vybrané — klikni na vrchol, hranu nebo plochu.';
      } else if (o) for (const p of pole) p.obnov();
    }

    // ---------------------------------------------------------------- stavový řádek
    const napovedaEl = el('div.b3-napoveda');
    const pocetEl = el('div');

    function obnovStav() {
      let tipy;
      if (uchop) tipy = [['X Y Z', 'osa'], ['čísla', 'přesně'], ['Ctrl', 'po krocích'], ['klik / Enter', 'potvrdit'], ['Esc / pravé', 'zrušit']];
      else if (rez) tipy = [['klik', 'říznout'], ['Esc / pravé', 'konec']];
      else if (sc.uprava) tipy = [['Tab', 'objekty'], ['1 2 3', 'vrchol / hrana / plocha'], ['WASD', 'pohyb'], ['Ctrl+E', 'vytáhnout'], ['I', 'vsadit'], ['Ctrl+R', 'řez'], ['Alt+klik', 'smyčka']];
      else tipy = [['levé', 'vybrat / táhnout'], ['pravé / kolečko táhni', 'otáčet pohled'], ['WASD', 'pohyb'], ['E / Q', 'nástroj'], ['Shift+A', 'přidat'], ['Shift+F', 'chůze'], ['Tab', 'upravit síť']];
      napovedaEl.replaceChildren(...tipy.map(([k, popis]) => el('span', {}, el('kbd', { text: k }), el('span', { text: popis }))));
      const o = upravObj();
      if (o) {
        const topo = U.topologie(o.sit);
        pocetEl.textContent = `Vrcholy ${selV().size}/${o.sit.v.length / 3} · Hrany ${selE().size}/${topo.hrany.size} · Plochy ${selF().size}/${o.sit.f.length}`;
        return;
      }
      let v = 0, tr = 0;
      for (const ob of sc.objekty) { if (ob.skryty || !ob.sit) continue; const s = statistika(ob.sit); v += s.vrcholy; tr += s.troj; }
      pocetEl.textContent = `Objekty ${vybraneObj().length}/${sc.objekty.length} · Vrcholy ${v} · Trojúhelníky ${tr}`;
    }

    function obnovVse() {
      verzeVyberu++;
      obnovOsu();
      obnovSeznam();
      obnovVlastnosti();
      obnovListu();
      obnovStav();
      pozadej();
    }

    // ---------------------------------------------------------------- sestavení
    body.append(el('div.b3', {},
      lista,
      el('div.b3-hlavni', {},
        levyEl,
        view,
        el('div.b3-panel', {},
          el('div.b3-sekce', {}, el('div.b3-nadpis', {}, icon('b3scena'), el('span', { text: 'Scéna' })), seznamEl),
          vlastnostiEl,
        ),
      ),
      osaEl,
      el('div.b3-pata', {}, jmenoEl, napovedaEl, el('div.b3-spacer'), pocetEl),
    ));

    const ro = new ResizeObserver(() => pozadej());
    ro.observe(view);
    win.b3Uklid = () => {
      ukonciVolny(true); document.removeEventListener('pointerlockchange', naZamek); window.removeEventListener('blur', naBlur);
      ro.disconnect(); prehravani = null; zavriDialog(); pt?.znic(); r.znic(); };

    vychoziScena();
    nazev();
    obnovVse();
    if (win.opts?.path) otevriSoubor(win.opts.path);
    setTimeout(() => body.focus(), 60);
    win.nactiScenu = (p) => otevriSoubor(p);

    // ladění z konzole: wm.windows.find(w => w.app.id === 'astro3d').astro3dApi
    win.astro3dApi = {
      sc, kam, r, U, A, renderPro, dialogExportu, exportujVideo, nastavSnimek, vlozKlic, smazKlic, prehrat, nastavStinovani,
      get pt() { return pt; },
      zeSpecu, otevriUkazku, dialogAI, importujObj, exportujObj, UKAZKY,
      pridej, nacti, uloz, zacniUchop, potvrdUchop, zrusUchop, vyber, snimekDoFotek, pozadej, prepniUpravy,
      nastavRezim, vytahni, vsazeni, rozdelit, vypln, spoj, smazVSiti, vyhlad, zacniRez, provedRez, aktualizujRez,
      selV, selE, selF, nastavVyberUpravy, obnovVse, prvekPod, klikUpravy, zpet, vpred,
      nastavMys: (x, y) => { mys = { x, y, uvnitr: true }; },
      zacniVolny, ukonciVolny, rozhlizej, prepniGravitaci, zemPod, krokChuze, get volny() { return volny; },
      get pohled() { return pohled; }, get uchop() { return uchop; }, get rez() { return rez; },
    };
  },

  reopen(win, opts) { if (opts?.path) win.nactiScenu?.(opts.path); },

  unmount(win) {
    win.b3Uklid?.();
    if (win.astro3d?.dirty) toast({ title: 'Astro 3D zavřeno', body: 'Scéna nebyla uložena.', icon: 'info', timeout: 3200 });
  },
};
