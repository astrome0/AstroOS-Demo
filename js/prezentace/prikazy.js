// AstroPrezentace — příkazy: formát textu a objektů, snímky a oddíly, přechody, animace, vkládání obsahu,
// schránka, hledání a nahrazování. Registruje metody na objektu P (viz apps/prezentace.js).

import { el } from '../util.js';
import * as FS from '../fs.js';
import { rozbal, zavriRozbal, nabidka, dialog, pole } from '../pismo/ui.js';
import { ik } from '../pismo/ikony.js';
import { VELIKOSTI_PISMA, zasobnikPisma } from '../pismo/dokument.js';
import { Editor, obalka, kopieObjektu } from './editor.js';
import { novySnimek as modelNovySnimek, noveId, kopie, odstavce, textZHtml, jePrazdnyText, Prezentace } from './model.js';
import { rozvrzeniPodleId, VELIKOSTI_SNIMKU, MOTIVY, motivPodleId } from './motivy.js';
import { barvaCss, jeCara, jeTelo, vychoziOdrazka, kresliSnimek, poVlozeni } from './render.js';
import { prehrajPrechod, krokyAnimaci, prehrajKrok, pripravAnimace, VYCHOZI_DELKA } from './efekty.js';
import { smartArt } from './sablony.js';
import * as D from './dialogy.js';
import { anglicky } from '../i18n.js';

const TEXTOVE = (o) => o && (o.typ === 'text' || (o.typ === 'tvar' && !jeCara(o.tvar)) || o.typ === 'tabulka');

/** Odstraní z HTML vlastnost stylu (a odpovídající značky), aby se projevila hodnota celého objektu. */
function odstranStyl(html, css, znacky = []) {
  if (!html) return html;
  const d = document.createElement('div');
  d.innerHTML = html;
  if (css) d.querySelectorAll('[style]').forEach((x) => { x.style.removeProperty(css); if (!x.getAttribute('style')) x.removeAttribute('style'); });
  for (const z of znacky) d.querySelectorAll(z).forEach((x) => x.replaceWith(...x.childNodes));
  d.querySelectorAll('span:not([style]):not([class])').forEach((s) => s.replaceWith(...s.childNodes));
  return d.innerHTML;
}
function upravHtml(html, fn) {
  const d = document.createElement('div');
  d.innerHTML = html || '';
  fn(d);
  return d.innerHTML;
}
function prevedPismena(t, typ) {
  if (typ === 'mala') return t.toLocaleLowerCase('cs');
  if (typ === 'velka') return t.toLocaleUpperCase('cs');
  if (typ === 'slova') return t.toLocaleLowerCase('cs').replace(/(^|[\s(„"-])(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase('cs'));
  if (typ === 'prepnout') return [...t].map((c) => (c === c.toLocaleUpperCase('cs') ? c.toLocaleLowerCase('cs') : c.toLocaleUpperCase('cs'))).join('');
  return t.toLocaleLowerCase('cs').replace(/(^\s*|[.!?]\s+)(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase('cs'));
}
function textoveUzly(koren, rozsah) {
  const w = document.createTreeWalker(koren, NodeFilter.SHOW_TEXT);
  const out = [];
  let n;
  while ((n = w.nextNode())) if (!rozsah || rozsah.intersectsNode(n)) out.push(n);
  return out;
}

/** Zmenší obrázek (dataURL) na max. rozměr a vrátí { src, w, h }. */
export function pripravObrazek(src, max = 1600) {
  return new Promise((hotovo, chyba) => {
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth || 800, h = img.naturalHeight || 600;
      const svg = /^data:image\/svg/.test(src);
      if (svg || (w <= max && h <= max && src.length < 400000)) { hotovo({ src, w, h }); return; }
      const k = Math.min(1, max / Math.max(w, h));
      w = Math.round(w * k); h = Math.round(h * k);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0, w, h);
      // průhlednost zachovat jen u PNG, kde na ní záleží
      const png = /^data:image\/png/.test(src) && src.length < 900000;
      hotovo({ src: c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.85), w, h });
    };
    img.onerror = () => chyba(new Error('Obrázek se nepodařilo načíst.'));
    img.src = src;
  });
}
const souborNaDataUrl = (f) => new Promise((hotovo, chyba) => { const r = new FileReader(); r.onload = () => hotovo(r.result); r.onerror = chyba; r.readAsDataURL(f); });
function vyberSoubor(accept) {
  return new Promise((hotovo) => {
    const v = el('input', { type: 'file', accept });
    v.onchange = () => hotovo(v.files[0] || null);
    v.click();
  });
}

export function pridejPrikazy(P) {
  const ed = P.ed;
  const S = () => P.snimek();
  const vyb = () => ed.vybrane();

  // ------------------------------------------------------------ úpravy objektů
  P.upravObjekt = (z, popis = 'Formát', ids = null) => {
    const cile = ids ? ids.map((id) => ed.objekt(id)).filter(Boolean) : vyb();
    if (!cile.length) return;
    P.prikaz(popis, () => { for (const o of cile) { for (const [k, v] of Object.entries(z)) { if (v === null || v === undefined) delete o[k]; else o[k] = v; } } });
  };
  P.velikostObjektu = (klic, v) => {
    P.prikaz('Velikost', () => {
      for (const o of vyb()) {
        const pomer = o.typ === 'obrazek' || o.zamekPomeru;
        const stare = o[klic];
        o[klic] = Math.max(1, v);
        if (pomer && stare) { const druhy = klic === 'w' ? 'h' : 'w'; o[druhy] = o[druhy] * (v / stare); }
        if (o.rust && klic === 'h') o.rust = false;
      }
    });
  };
  P.odstranitVybrane = () => {
    const ids = [...ed.vyber];
    if (!ids.length) return;
    const s = S();
    P.prikaz('Odstranit', () => {
      // zástupný symbol s textem se vyprázdní (jako v PowerPointu), prázdný se odstraní
      const smazat = [];
      for (const id of ids) {
        const o = ed.objekt(id);
        if (o?.ph && !jePrazdnyText(o.html)) o.html = '';
        else smazat.push(id);
      }
      P.pres.smazObjekty(s, smazat);
      ed.vyber = ids.filter((id) => !smazat.includes(id));
    });
  };
  P.duplikovatObjekty = () => {
    const puv = vyb();
    if (!puv.length) return;
    P.prikaz('Duplikovat', () => {
      const nove = puv.map((o) => ({ ...kopieObjektu(o), x: o.x + 18, y: o.y + 18 }));
      S().objekty.push(...nove);
      ed.vyber = nove.map((n) => n.id);
    });
  };
  P.duplikovat = () => { if (P.st.fokus === 'miniatury' || !ed.vyber.length) P.duplikovatSnimky(); else P.duplikovatObjekty(); };
  P.usporadat = (kam) => { if (!ed.vyber.length) return; P.prikaz('Uspořádat', () => P.pres.poradi(S(), ed.vyber, kam)); };
  P.zarovnatObjekty = (jak) => {
    const v = vyb();
    if (!v.length) return;
    const keSnimku = v.length === 1 || P.st.zarovnatKeSnimku !== false && v.length === 1;
    const ob = keSnimku ? { x: 0, y: 0, w: P.pres.velikost.w, h: P.pres.velikost.h } : obalka(v);
    P.prikaz('Zarovnat', () => {
      if (jak === 'rozmistitH' || jak === 'rozmistitV') {
        const h = jak === 'rozmistitH';
        const serazene = [...v].sort((a, b) => (h ? a.x - b.x : a.y - b.y));
        const celkem = serazene.reduce((n, o) => n + (h ? o.w : o.h), 0);
        const prostor = (h ? ob.w : ob.h) - celkem;
        const mezera = prostor / Math.max(1, serazene.length - 1);
        let poz = h ? ob.x : ob.y;
        for (const o of serazene) { if (h) { o.x = poz; poz += o.w + mezera; } else { o.y = poz; poz += o.h + mezera; } }
        return;
      }
      for (const o of v) {
        if (jak === 'l') o.x = ob.x; if (jak === 'c') o.x = ob.x + ob.w / 2 - o.w / 2; if (jak === 'r') o.x = ob.x + ob.w - o.w;
        if (jak === 't') o.y = ob.y; if (jak === 'm') o.y = ob.y + ob.h / 2 - o.h / 2; if (jak === 'b') o.y = ob.y + ob.h - o.h;
      }
    });
  };
  P.otocit = (jak) => P.prikaz('Otočit', () => {
    for (const o of vyb()) {
      if (jak === 'svisle') o.flipV = !o.flipV;
      else if (jak === 'vodorovne') o.flipH = !o.flipH;
      else o.rot = (((o.rot || 0) + jak) % 360 + 360) % 360;
    }
  });

  // ------------------------------------------------------------ výplň, obrys, efekty
  const tvarove = () => vyb().filter((o) => o.typ === 'tvar' || o.typ === 'text' || o.typ === 'obrazek');
  P.vyplnTvaru = (ref) => { if (!tvarove().length) return; P.prikaz('Výplň obrazce', () => { for (const o of tvarove()) { if (o.typ === 'obrazek') continue; o.vypln = ref === 'auto' ? undefined : ref; delete o.prechod; delete o.vyplnObrazek; } }); zapamatujBarvu(ref); };
  P.vyplnPrechodem = () => P.prikaz('Přechodová výplň', () => { for (const o of tvarove()) { const zakl = (o.vypln && o.vypln !== 'none' ? o.vypln : 'a1').replace(/[+-]\d+$/, ''); o.vypln = zakl; o.prechod = [zakl + '+40', zakl + '-25']; } });
  P.vyplnObrazkem = async () => {
    const f = await vyberSoubor('image/*');
    if (!f) return;
    const { src } = await pripravObrazek(await souborNaDataUrl(f), 1200);
    const ref = P.pres.pridejMedium(src);
    P.prikaz('Obrázková výplň', () => { for (const o of tvarove()) { if (o.typ !== 'obrazek') { o.vyplnObrazek = ref; if (o.typ === 'text') o.vypln = 'bg'; } } });
  };
  P.obrysTvaru = ({ barva: b, w, styl }) => {
    if (!tvarove().length) return;
    P.prikaz('Obrys obrazce', () => {
      for (const o of tvarove()) {
        if (b !== undefined) o.obrys = b === 'auto' ? undefined : b;
        if (w !== undefined) { o.obrysW = w; if (!o.obrys || o.obrys === 'none') o.obrys = o.typ === 'obrazek' ? 'tx' : 'a1-50'; }
        if (styl !== undefined) { o.obrysStyl = styl; if (!o.obrys || o.obrys === 'none') o.obrys = 'a1-50'; }
      }
    });
    if (b) zapamatujBarvu(b);
  };
  P.efektyTvaru = (e) => P.prikaz('Efekty obrazce', () => { for (const o of vyb()) { o.efekty = { ...(o.efekty || {}), ...e }; for (const [k, v] of Object.entries(o.efekty)) if (v === null) delete o.efekty[k]; if (!Object.keys(o.efekty).length) delete o.efekty; } });
  P.rychlyStyl = (s) => P.prikaz('Rychlý styl', () => {
    for (const o of vyb()) {
      if (o.typ === 'obrazek' || o.typ === 'graf' || o.typ === 'tabulka') continue;
      if (o.typ === 'tvar' && jeCara(o.tvar)) { o.obrys = s.obrys === 'lt' ? s.vypln : s.obrys; o.efekty = s.efekty; continue; }
      o.vypln = s.vypln; o.obrys = s.obrys; o.barva = s.text;
      if (s.prechod) o.prechod = s.prechod; else delete o.prechod;
      if (s.efekty) o.efekty = s.efekty; else delete o.efekty;
      o.html = odstranStyl(o.html, 'color');
    }
  });
  P.obrysTextu = (ref) => P.formatuj('obrysTextu', ref);
  P.efektyTextu = (e) => P.prikaz('Efekty textu', () => { for (const o of vyb()) { if (e.stin !== undefined) o.textStin = e.stin; if (e.zar !== undefined) o.textZar = e.zar; o.wordart = null; delete o.wordart; o.efektyTextu = { ...(o.efektyTextu || {}), ...e }; } });
  P.stylWordArt = (id) => P.prikaz('Styl WordArt', () => { for (const o of vyb()) if (TEXTOVE(o) && o.typ !== 'tabulka') { o.wordart = id; o.html = odstranStyl(o.html, 'color'); } });
  function zapamatujBarvu(ref) {
    if (!ref || ref[0] !== '#') return;
    P.nedavneBarvy = [ref, ...(P.nedavneBarvy || []).filter((x) => x !== ref)].slice(0, 10);
  }

  // ------------------------------------------------------------ text
  const velikostVyberu = () => P.stav.velikost || 18;
  const dalsiVelikost = (akt, smer) => (smer > 0 ? VELIKOSTI_PISMA.find((v) => v > akt) || Math.round(akt * 1.2) : [...VELIKOSTI_PISMA].reverse().find((v) => v < akt) || Math.max(1, akt - 1));
  const naObjektech = (popis, fn) => {
    const cile = vyb().filter(TEXTOVE);
    if (!cile.length) return;
    P.prikaz(popis, () => { for (const o of cile) fn(o); });
  };

  /** Formátovací příkaz z pásu karet (při úpravě textu na výběr, jinak na celé objekty). */
  P.formatuj = (cmd, hodnota) => {
    const upravuje = !!ed.upravuje;
    const exec = (c, v = null) => ed.naTextu(popisPrikazu(cmd), () => { document.execCommand('styleWithCSS', false, false); document.execCommand(c, false, v); });
    const obal = (styl) => ed.naTextu(popisPrikazu(cmd), (k) => Editor.obalStylem(k, styl));
    switch (cmd) {
      case 'tucne': case 'kurziva': case 'podtrzeni': case 'preskrtnuti': {
        const c = { tucne: 'bold', kurziva: 'italic', podtrzeni: 'underline', preskrtnuti: 'strikeThrough' }[cmd];
        if (upravuje) { exec(c); return; }
        const klic = { tucne: 'tucne', kurziva: 'kurziva', podtrzeni: 'podtrzeni', preskrtnuti: 'preskrtnuti' }[cmd];
        const nova = !P.stav[klic];
        naObjektech(popisPrikazu(cmd), (o) => {
          if (o.typ === 'tabulka') { o.tab.radky.flat().forEach((b) => { b.html = odstranStyl(b.html, null, { tucne: ['b', 'strong'], kurziva: ['i', 'em'], podtrzeni: ['u'], preskrtnuti: ['s', 'strike'] }[cmd]); }); }
          o[klic] = nova;
          o.html = odstranStyl(o.html, { tucne: 'font-weight', kurziva: 'font-style', podtrzeni: 'text-decoration', preskrtnuti: 'text-decoration' }[cmd], { tucne: ['b', 'strong'], kurziva: ['i', 'em'], podtrzeni: ['u'], preskrtnuti: ['s', 'strike'] }[cmd]);
        });
        return;
      }
      case 'stin': {
        const zap = !P.stav.stin;
        if (upravuje) { obal({ textShadow: zap ? '1.5px 1.5px 2px rgba(0,0,0,.4)' : 'none' }); return; }
        naObjektech('Stín textu', (o) => { o.textStin = zap ? 'vnejsi' : null; if (!zap) delete o.textStin; o.html = odstranStyl(o.html, 'text-shadow'); });
        return;
      }
      case 'vetsi': case 'mensi': {
        const n = dalsiVelikost(velikostVyberu(), cmd === 'vetsi' ? 1 : -1);
        P.velikost(n);
        return;
      }
      case 'vymazat': {
        if (upravuje) { exec('removeFormat'); ed.naTextu('Vymazat formátování', (k) => { const sel = getSelection(); if (!sel.rangeCount) return; k.querySelectorAll('span[style]').forEach((s) => { if (sel.getRangeAt(0).intersectsNode(s)) s.replaceWith(...s.childNodes); }); }); return; }
        naObjektech('Vymazat formátování', (o) => {
          for (const k of ['tucne', 'kurziva', 'podtrzeni', 'preskrtnuti', 'vel', 'pismo', 'barva', 'rozestup', 'textStin', 'wordart', 'velkaPismena']) delete o[k];
          o.html = upravHtml(o.html, (d) => { d.querySelectorAll('b,strong,i,em,u,s,strike,span,font').forEach((x) => x.replaceWith(...x.childNodes)); d.querySelectorAll('p').forEach((p) => p.removeAttribute('style')); });
        });
        return;
      }
      case 'barva': {
        const css = barvaCss(hodnota);
        zapamatujBarvu(hodnota);
        if (upravuje) { obal({ color: css || 'inherit' }); return; }
        naObjektech('Barva písma', (o) => { if (hodnota === 'auto') delete o.barva; else o.barva = hodnota; o.html = odstranStyl(o.html, 'color'); if (o.typ === 'tabulka') o.tab.radky.flat().forEach((b) => { b.html = upravHtml(b.html, (d) => { d.innerHTML = `<span style="color:${css}">${d.innerHTML}</span>`; }); }); });
        return;
      }
      case 'obrysTextu': {
        const css = barvaCss(hodnota);
        const styl = hodnota === 'none' ? { webkitTextStroke: '0' } : { webkitTextStroke: `1px ${css}` };
        if (upravuje) { obal(styl); return; }
        naObjektech('Obrys textu', (o) => { o.textObrys = hodnota === 'none' ? null : hodnota; if (!o.textObrys) delete o.textObrys; });
        return;
      }
      case 'zvyrazneni': {
        if (!upravuje) { naObjektech('Zvýraznění', (o) => { o.html = upravHtml(o.html, (d) => { d.querySelectorAll('p').forEach((p) => { p.innerHTML = hodnota ? `<span style="background-color:${hodnota}">${p.innerHTML}</span>` : p.innerHTML; }); if (!hodnota) d.querySelectorAll('[style]').forEach((x) => x.style.removeProperty('background-color')); }); }); return; }
        obal({ backgroundColor: hodnota || 'transparent' });
        return;
      }
      case 'rozestup': {
        if (upravuje) { obal({ letterSpacing: hodnota + 'px' }); return; }
        naObjektech('Mezery mezi znaky', (o) => { o.rozestup = hodnota || null; if (!hodnota) delete o.rozestup; o.html = odstranStyl(o.html, 'letter-spacing'); });
        return;
      }
      case 'pismena': {
        if (upravuje) {
          ed.naTextu('Velká a malá písmena', (k) => {
            const sel = getSelection();
            if (!sel.rangeCount) return;
            const r = sel.getRangeAt(0);
            for (const n of textoveUzly(k, r)) {
              const od = n === r.startContainer ? r.startOffset : 0, doo = n === r.endContainer ? r.endOffset : n.length;
              n.textContent = n.textContent.slice(0, od) + prevedPismena(n.textContent.slice(od, doo), hodnota) + n.textContent.slice(doo);
            }
          });
          return;
        }
        naObjektech('Velká a malá písmena', (o) => { o.html = upravHtml(o.html, (d) => { for (const n of textoveUzly(d)) n.textContent = prevedPismena(n.textContent, hodnota); }); });
        return;
      }
      case 'zarL': case 'zarC': case 'zarR': case 'zarJ': {
        const z = cmd.slice(3).toLowerCase();
        const css = { l: 'left', c: 'center', r: 'right', j: 'justify' }[z];
        if (upravuje) {
          const odst = ed.odstavceVyberu();
          if (!odst.length) { const td = getSelection().anchorNode?.parentElement?.closest('td'); if (td) td.style.textAlign = css; }
          for (const p of odst) p.style.textAlign = css;
          ed.poVstupu(ed.upravuje);
          ed.ulozText(ed.upravuje, 'Zarovnání');
          P.obnov();
          return;
        }
        naObjektech('Zarovnání', (o) => {
          if (o.typ === 'tabulka') { o.tab.radky.flat().forEach((b) => { b.zar = z; }); return; }
          o.zar = z;
          o.html = upravHtml(o.html, (d) => d.querySelectorAll('p').forEach((p) => { p.style.removeProperty('text-align'); if (!p.getAttribute('style')) p.removeAttribute('style'); }));
        });
        return;
      }
      default:
    }
  };
  const popisPrikazu = (c) => ({ tucne: 'Tučné', kurziva: 'Kurzíva', podtrzeni: 'Podtržení', preskrtnuti: 'Přeškrtnutí', stin: 'Stín textu', barva: 'Barva písma', zvyrazneni: 'Zvýraznění', rozestup: 'Mezery mezi znaky', pismena: 'Velká a malá písmena', obrysTextu: 'Obrys textu' }[c] || 'Formát');

  P.pismo = (jmeno) => {
    const p = String(jmeno).replace(/ \((Nadpisy|Základní text)\)$/, '');
    const motivove = /\(Nadpisy\)$/.test(jmeno) ? '+nadpis' : /\(Základní text\)$/.test(jmeno) ? '+telo' : null;
    if (!p) return;
    if (ed.upravuje) { ed.naTextu('Písmo', (k) => Editor.obalStylem(k, { fontFamily: zasobnikPisma(p) })); return; }
    naObjektech('Písmo', (o) => { o.pismo = motivove || p; o.html = odstranStyl(o.html, 'font-family'); if (o.typ === 'tabulka') o.tab.radky.flat().forEach((b) => { b.html = odstranStyl(b.html, 'font-family'); }); });
  };
  P.velikost = (v) => {
    const n = parseFloat(String(v).replace(',', '.').replace('+', ''));
    if (!n || n < 1 || n > 4000) return;
    if (ed.upravuje) { ed.naTextu('Velikost písma', (k) => Editor.obalStylem(k, { fontSize: n + 'px' })); return; }
    naObjektech('Velikost písma', (o) => {
      o.vel = n;
      o.html = odstranStyl(o.html, 'font-size');
      if (o.typ === 'tabulka') o.tab.radky.flat().forEach((b) => { b.html = odstranStyl(b.html, 'font-size'); });
      if (o.autofit !== 'ne' && o.ph) o.autofit = o.autofit || undefined;
    });
  };

  // odrážky a číslování
  const nastavSeznam = (druh, cislovani) => {
    if (ed.upravuje) {
      const o = ed.objekt(ed.upravuje);
      const odst = ed.odstavceVyberu();
      const vychozi = vychoziOdrazka(o);
      const ma = (p) => { const d = p.dataset.o === 'ne' ? null : p.dataset.o || vychozi; return cislovani ? !!(d && /[.)]$/.test(d)) : !!(d && !/[.)]$/.test(d)); };
      const cil = druh ?? (odst.every(ma) ? 'ne' : cislovani ? '1.' : '•');
      for (const p of odst) { if (cil === vychozi) delete p.dataset.o; else p.dataset.o = cil; }
      ed.poVstupu(ed.upravuje);
      ed.ulozText(ed.upravuje, cislovani ? 'Číslování' : 'Odrážky');
      P.obnov();
      return;
    }
    naObjektech(cislovani ? 'Číslování' : 'Odrážky', (o) => {
      if (o.typ === 'tabulka') return;
      const akt = cislovani ? P.stav.cislovani : P.stav.odrazky;
      const cil = druh ?? (akt ? 'ne' : cislovani ? '1.' : '•');
      o.odrazky = cil === 'ne' ? (o.ph && o.ph.startsWith('obsah') ? 'ne' : null) : cil;
      if (o.odrazky === null) delete o.odrazky;
      o.html = upravHtml(o.html, (d) => d.querySelectorAll('p').forEach((p) => delete p.dataset.o));
    });
  };
  P.odrazky = (druh) => nastavSeznam(druh, false);
  P.cislovani = (druh) => nastavSeznam(druh, true);
  P.uroven = (smer) => ed.zmenUroven(smer);
  P.radkovani = (v) => naObjektech('Řádkování', (o) => { o.radkovani = v; });
  P.smerTextu = (v) => naObjektech('Směr textu', (o) => { o.svislyText = !!v; if (!v) delete o.svislyText; });
  P.sloupce = (n) => naObjektech('Sloupce', (o) => { if (n > 1) o.sloupce = n; else delete o.sloupce; });
  P.zarovnatText = (v) => naObjektech('Zarovnat text', (o) => { o.svisle = v; });

  // ------------------------------------------------------------ kopírovat formát
  const FORMAT_KLICE = ['vypln', 'obrys', 'obrysW', 'obrysStyl', 'prechod', 'efekty', 'barva', 'vel', 'pismo', 'tucne', 'kurziva', 'podtrzeni', 'preskrtnuti', 'rozestup', 'textStin', 'wordart', 'obrStyl', 'pruhlednost'];
  P.stetec = (trvale = false) => {
    if (P.st.stetec) { P.st.stetec = null; P.koren.classList.remove('pr-stetec'); P.obnov(); return; }
    const o = vyb()[0];
    if (!o) return;
    P.st.stetec = { format: Object.fromEntries(FORMAT_KLICE.map((k) => [k, o[k]])), trvale };
    P.koren.classList.add('pr-stetec');
    P.obnov();
  };
  P.pouzijStetec = (ids) => {
    const f = P.st.stetec;
    if (!f) return;
    P.prikaz('Kopírovat formát', () => { for (const id of ids) { const o = ed.objekt(id); if (!o) continue; for (const [k, v] of Object.entries(f.format)) { if (v === undefined) delete o[k]; else o[k] = kopie(v); } } });
    if (!f.trvale) { P.st.stetec = null; P.koren.classList.remove('pr-stetec'); }
  };

  // ------------------------------------------------------------ snímky
  P.novySnimek = (rozvrzeni) => {
    const akt = S();
    const r = rozvrzeni || (akt?.rozvrzeni === 'uvodni' ? 'obsah' : akt?.rozvrzeni || 'obsah');
    let novy;
    P.prikaz('Nový snímek', () => {
      novy = P.pres.vlozSnimek(P.pripravSnimek(modelNovySnimek(r)), P.pres.index(P.st.aktivni));
    });
    if (novy) P.jdiNaSnimek(novy.id);
  };
  P.duplikovatSnimky = () => {
    const ids = P.vybraneSnimky();
    let posledni;
    P.prikaz('Duplikovat snímek', () => { for (const id of [...ids].reverse()) posledni = P.pres.duplikuj(id); });
    if (posledni) P.jdiNaSnimek(posledni.id);
  };
  P.odstranitSnimky = () => {
    const ids = P.vybraneSnimky();
    if (!ids.length) return;
    const i = P.pres.index(ids[0]);
    P.prikaz(ids.length > 1 ? 'Odstranit snímky' : 'Odstranit snímek', () => {
      P.pres.smaz(ids);
      if (!P.pres.snimky.length) P.pres.snimky.push(P.pripravSnimek(modelNovySnimek('uvodni')));
    });
    const dalsi = P.pres.snimky[Math.min(i, P.pres.snimky.length - 1)];
    P.jdiNaSnimek(dalsi.id);
  };
  P.zmenRozvrzeni = (id) => {
    const ids = P.vybraneSnimky();
    P.prikaz('Rozložení', () => { for (const sid of ids) { const s = P.pres.snimek(sid); P.pres.zmenRozvrzeni(s, id); P.pripravSnimek(s, true); } });
  };
  P.obnovitSnimek = () => {
    const ids = P.vybraneSnimky();
    P.prikaz('Obnovit snímek', () => {
      for (const sid of ids) {
        const s = P.pres.snimek(sid);
        P.pres.obnovRozvrzeni(s);
        P.pripravSnimek(s, true);
        for (const o of s.objekty) if (o.ph) for (const k of ['vel', 'pismo', 'barva', 'zar', 'svisle', 'tucne', 'kurziva', 'vypln', 'obrys', 'efekty', 'autofit', 'radkovani', 'odrazky']) delete o[k];
      }
    });
  };
  P.skrytSnimek = () => {
    const ids = P.vybraneSnimky();
    const skryt = !P.pres.snimek(ids[0])?.skryty;
    P.prikaz(skryt ? 'Skrýt snímek' : 'Zobrazit snímek', () => { for (const id of ids) P.pres.snimek(id).skryty = skryt; });
  };
  P.oddil = (akce) => {
    const s = S();
    const od = P.pres.oddilSnimku(s.id);
    if (akce === 'pridat' || akce === 'prejmenovat') {
      const vstup = el('input.ps-vstup', { value: akce === 'prejmenovat' ? od?.nazev || '' : 'Oddíl bez názvu' });
      vstup.addEventListener('keydown', (e) => e.stopPropagation());
      dialog(P.koren, { titulek: akce === 'pridat' ? 'Přidat oddíl' : 'Přejmenovat oddíl', sirka: 340, obsah: pole('Název oddílu:', vstup), tlacitka: [{ text: akce === 'pridat' ? 'Přidat' : 'Přejmenovat', primarni: true, akce: () => {
        const n = vstup.value.trim() || 'Oddíl bez názvu';
        P.prikaz('Oddíl', () => {
          if (akce === 'prejmenovat' && od) od.nazev = n;
          else {
            const zacina = P.pres.oddily.find((x) => x.od === s.id);
            if (zacina) zacina.nazev = n; else P.pres.oddily.push({ id: noveId('d'), nazev: n, od: s.id });
            // první oddíl: snímky před ním dostanou „Výchozí oddíl“
            const prvni = P.pres.snimky[0];
            if (prvni.id !== s.id && !P.pres.oddily.some((x) => x.od === prvni.id)) P.pres.oddily.push({ id: noveId('d'), nazev: 'Výchozí oddíl', od: prvni.id });
          }
        });
      } }, { text: 'Zrušit' }] });
      setTimeout(() => vstup.select(), 40);
      return;
    }
    if (akce === 'odebrat' && od) P.prikaz('Odebrat oddíl', () => { P.pres.oddily = P.pres.oddily.filter((x) => x !== od); });
    if (akce === 'odebratVse') P.prikaz('Odebrat všechny oddíly', () => { P.pres.oddily = []; });
    if (akce === 'sbalit') { P.st.sbalene = new Set(P.pres.oddily.map((x) => x.id)); P.kresliMiniatury(true); }
    if (akce === 'rozbalit') { P.st.sbalene = new Set(); P.kresliMiniatury(true); }
  };
  P.presunoutSnimky = (ids, naIndex) => P.prikaz('Přesunout snímek', () => P.pres.presun(ids, naIndex));

  // ------------------------------------------------------------ motiv a pozadí
  P.nastavMotiv = (id) => P.prikaz('Motiv', () => { P.pres.motiv = id; P.pres.varianta = 0; P.pres.barvyZ = null; P.pres.pisma = null; });
  P.nastavVariantu = (i) => P.prikaz('Varianta', () => { P.pres.varianta = i; P.pres.barvyZ = null; });
  P.nastavBarvyZMotivu = (id) => P.prikaz('Barvy motivu', () => { P.pres.barvyZ = id === P.pres.motiv ? null : id; });
  P.nastavPismaZMotivu = (id) => P.prikaz('Písma motivu', () => { const m = motivPodleId(id); P.pres.pisma = { ...m.pismo }; });
  P.nastavPozadi = (p, vse = false, popis = 'Formát pozadí') => {
    const ids = vse ? P.pres.snimky.map((s) => s.id) : P.vybraneSnimky();
    P.prikaz(vse ? 'Použít pozadí u všech' : popis, () => { for (const id of ids) P.pres.snimek(id).pozadi = p ? kopie(p) : null; });
  };
  P.pozadiObrazkem = async () => {
    const f = await vyberSoubor('image/*');
    if (!f) return;
    const { src } = await pripravObrazek(await souborNaDataUrl(f), 1920);
    P.nastavPozadi({ ...(S().pozadi || {}), typ: 'obrazek', src: P.pres.pridejMedium(src) }, false, 'Obrázek na pozadí');
  };
  P.velikostSnimku = (id) => { const v = VELIKOSTI_SNIMKU.find((x) => x.id === id); if (v) P.nastavVelikostSnimku({ id, w: v.w, h: v.h }, true); };
  P.nastavVelikostSnimku = ({ id, w, h }, prizpusobit = true) => {
    const star = P.pres.velikost;
    if (Math.abs(star.w - w) < 0.5 && Math.abs(star.h - h) < 0.5) { P.pres.velikost.id = id; return; }
    P.prikaz('Velikost snímku', () => {
      const kx = w / star.w, ky = h / star.h;
      const k = prizpusobit ? Math.min(kx, ky) : Math.max(kx, ky);
      const dx = (w - star.w * k) / 2, dy = (h - star.h * k) / 2;
      for (const s of P.pres.snimky) for (const o of s.objekty) {
        o.x = o.x * k + dx; o.y = o.y * k + dy; o.w *= k; o.h *= k;
        if (o.vel) o.vel = +(o.vel * k).toFixed(1);
        else if (TEXTOVE(o) && k < 0.95) o.vel = Math.round((o.ph?.startsWith('nadpis') ? 44 : jeTelo(o) ? 28 : 18) * k);
      }
      P.pres.velikost = { id, w, h };
    });
    ed.prizpusob();
  };

  // ------------------------------------------------------------ přechody
  P.nastavPrechod = (zmeny, vse = false) => {
    const zdroj = S().prechod || { typ: 'zadny' };
    const ids = vse ? P.pres.snimky.map((s) => s.id) : P.vybraneSnimky();
    P.prikaz(vse ? 'Použít u všech' : 'Přechod', () => {
      for (const id of ids) {
        const s = P.pres.snimek(id);
        const zaklad = vse ? kopie(zdroj) : { ...(s.prechod || { typ: 'zadny' }) };
        const novy = { ...zaklad, ...zmeny };
        for (const [k, v] of Object.entries(novy)) if (v === undefined || v === null) delete novy[k];
        if (novy.typ === 'zadny' && !('auto' in novy) && !novy.bezKliku && !novy.zvuk) s.prechod = null; else s.prechod = novy;
      }
    });
    if (zmeny.typ && zmeny.typ !== 'zadny') setTimeout(() => P.nahledPrechodu(), 60);
    if (vse) P.toast('Přechod se použil u všech snímků.');
  };
  P.nahledPrechodu = async () => {
    const s = S();
    if (!s.prechod?.typ || s.prechod.typ === 'zadny') return;
    const i = P.pres.index(s.id);
    const pred = P.pres.snimky[i - 1];
    const z = ed.z;
    const vrstva = (sn) => { const v = el('div.pr-show-vrstva'); const x = kresliSnimek(P.pres, sn, { cislo: P.pres.index(sn.id) + 1 }); x.style.transformOrigin = '0 0'; x.style.transform = `scale(${z})`; v.append(x); return v; };
    const kont = el('div.pr-nahled-efektu');
    Object.assign(kont.style, { left: ed.snObal.style.left, top: ed.snObal.style.top, width: ed.snObal.style.width, height: ed.snObal.style.height });
    const stary = pred ? vrstva(pred) : el('div.pr-show-vrstva', { style: { background: '#000' } });
    const novy = vrstva(s);
    kont.append(stary, novy);
    ed.obal.append(kont);
    poVlozeni(novy.firstElementChild, P.pres, s);
    if (pred) poVlozeni(stary.firstElementChild, P.pres, pred);
    P.prehravaSe = true;
    await prehrajPrechod(s.prechod, { stary, novy, kontejner: kont, W: P.pres.velikost.w * z, H: P.pres.velikost.h * z });
    kont.remove();
    P.prehravaSe = false;
  };

  // ------------------------------------------------------------ animace
  P.st.vybraneAnimace = [];
  P.animaceVyberu = () => {
    const s = S();
    const an = s?.animace || [];
    if (P.st.vybraneAnimace.length) { const x = an.filter((a) => P.st.vybraneAnimace.includes(a.id)); if (x.length) return x; }
    const ids = new Set(ed.vyber);
    return an.filter((a) => ids.has(a.obj));
  };
  P.vyberAnimaci = (id, pridat = false) => {
    P.st.vybraneAnimace = pridat ? [...new Set([...P.st.vybraneAnimace, id])] : [id];
    const a = S().animace.find((x) => x.id === id);
    if (a) { ed.vyber = [a.obj]; ed.kresliVyber(); }
    P.obnov();
    P.podoknoPoVyberu?.();
  };
  P.pridatAnimaci = (druh, efekt, nahradit) => {
    const objekty = vyb();
    if (!objekty.length) { P.toast('Nejdřív vyberte objekt, který chcete animovat.'); return; }
    const nove = [];
    P.prikaz('Animace', () => {
      const s = S();
      s.animace = s.animace || [];
      for (const o of objekty) {
        if (nahradit) {
          const existujici = s.animace.find((a) => a.obj === o.id);
          if (existujici) { Object.assign(existujici, { druh, efekt, smer: undefined, trvani: undefined }); delete existujici.smer; delete existujici.trvani; nove.push(existujici); continue; }
        }
        const a = { id: noveId('a'), obj: o.id, druh, efekt, start: 'klik' };
        // odstavce těla se animují po odstavcích jako jeden krok (zjednodušeně celý objekt)
        s.animace.push(a);
        nove.push(a);
      }
    });
    P.st.vybraneAnimace = nove.map((a) => a.id);
    P.obnov();
    setTimeout(() => P.nahledAnimaci(false, nove.map((a) => a.id)), 40);
  };
  P.odebratAnimace = (ids) => {
    const set = new Set(ids || P.animaceVyberu().map((a) => a.id));
    if (!set.size) return;
    P.prikaz('Odebrat animaci', () => { const s = S(); s.animace = s.animace.filter((a) => !set.has(a.id)); });
    P.st.vybraneAnimace = [];
  };
  P.upravAnimace = (z, ids) => {
    const set = new Set(ids || P.animaceVyberu().map((a) => a.id));
    if (!set.size) return;
    P.prikaz('Upravit animaci', () => { for (const a of S().animace) if (set.has(a.id)) { for (const [k, v] of Object.entries(z)) { if (v === undefined) delete a[k]; else a[k] = v; } } });
    if (z.smer) setTimeout(() => P.nahledAnimaci(false, [...set]), 40);
  };
  P.presunAnimaci = (smer) => {
    const vybrane = P.animaceVyberu();
    if (!vybrane.length) return;
    P.prikaz('Změnit pořadí animace', () => {
      const an = S().animace;
      const set = new Set(vybrane.map((a) => a.id));
      const poradi = smer < 0 ? an.map((_, i) => i) : an.map((_, i) => an.length - 1 - i);
      for (const i of poradi) {
        const j = i + smer;
        if (!set.has(an[i].id) || j < 0 || j >= an.length || set.has(an[j].id)) continue;
        [an[i], an[j]] = [an[j], an[i]];
      }
    });
  };
  P.presunAnimaciNa = (id, index) => P.prikaz('Změnit pořadí animace', () => { const an = S().animace; const i = an.findIndex((a) => a.id === id); const [a] = an.splice(i, 1); an.splice(index, 0, a); });
  P.kopirovatAnimaci = () => {
    if (P.st.stetecAnimace) { P.st.stetecAnimace = null; P.obnov(); return; }
    const o = vyb()[0];
    const an = o && S().animace.filter((a) => a.obj === o.id);
    if (!an?.length) { P.toast('Vybraný objekt nemá žádnou animaci.'); return; }
    P.st.stetecAnimace = an.map((a) => ({ ...a }));
    P.koren.classList.add('pr-stetec');
    P.obnov();
  };
  P.pouzijStetecAnimace = (ids) => {
    const vzor = P.st.stetecAnimace;
    P.prikaz('Kopírovat animaci', () => { const s = S(); for (const id of ids) { s.animace = s.animace.filter((a) => a.obj !== id); for (const a of vzor) s.animace.push({ ...a, id: noveId('a'), obj: id }); } });
    P.st.stetecAnimace = null;
    P.koren.classList.remove('pr-stetec');
  };
  /** Náhled animací přímo na plátně (bez klikání, jako tlačítko Náhled). */
  P.nahledAnimaci = async (vse = true, jen = null) => {
    const s = S();
    let an = s.animace || [];
    if (!an.length) return;
    if (!vse) {
      const vybrane = jen ? an.filter((a) => jen.includes(a.id)) : P.animaceVyberu();
      if (vybrane.length) an = an.slice(an.indexOf(vybrane[0]));
      if (jen) an = vybrane;
    }
    const z = ed.z;
    const kont = el('div.pr-nahled-efektu');
    Object.assign(kont.style, { left: ed.snObal.style.left, top: ed.snObal.style.top, width: ed.snObal.style.width, height: ed.snObal.style.height });
    const v = el('div.pr-show-vrstva');
    const sn = kresliSnimek(P.pres, s, { cislo: P.pres.index(s.id) + 1 });
    sn.style.transformOrigin = '0 0'; sn.style.transform = `scale(${z})`;
    v.append(sn);
    kont.append(v);
    ed.obal.append(kont);
    poVlozeni(sn, P.pres, s);
    const docasny = { ...s, animace: an.map((a, i) => (i === 0 && a.start !== 'klik' ? { ...a, start: 'klik' } : a)) };
    pripravAnimace(docasny, v);
    const kroky = krokyAnimaci(docasny);
    P.prehravaSe = true;
    const geo = (id) => ({ o: s.objekty.find((x) => x.id === id) || { x: 0, y: 0, w: 0, h: 0 }, W: P.pres.velikost.w, H: P.pres.velikost.h });
    for (const k of kroky) { if (!kont.isConnected) break; await prehrajKrok(k, v, geo); }
    await new Promise((r) => setTimeout(r, 250));
    kont.remove();
    P.prehravaSe = false;
  };

  // ------------------------------------------------------------ vkládání
  const oblastObsahu = () => {
    const vybrany = vyb()[0];
    if (vybrany && vybrany.ph && /^obsah|obrazek/.test(vybrany.ph + (vybrany.phObrazek ? 'obrazek' : '')) && jePrazdnyText(vybrany.html)) return { x: vybrany.x, y: vybrany.y, w: vybrany.w, h: vybrany.h, nahradit: vybrany.id };
    const s = S();
    const ph = s.objekty.find((o) => o.ph && /^obsah/.test(o.ph) && jePrazdnyText(o.html));
    if (ph) return { x: ph.x, y: ph.y, w: ph.w, h: ph.h, nahradit: ph.id };
    const W = P.pres.velikost.w, H = P.pres.velikost.h;
    return { x: W * 0.069, y: H * 0.266, w: W * 0.862, h: H * 0.634 };
  };
  const vlozObjekty = (popis, objekty, { nahradit, upravovat } = {}) => {
    P.prikaz(popis, () => {
      const s = S();
      if (nahradit) {
        const i = s.objekty.findIndex((o) => o.id === nahradit);
        if (i >= 0) s.objekty.splice(i, 1, ...objekty); else s.objekty.push(...objekty);
      } else s.objekty.push(...objekty);
      ed.vyber = objekty.map((o) => o.id);
    });
    if (upravovat) ed.zacniUpravy(objekty[0].id, { vybratVse: true });
  };
  P.vlozDoZastupneho = (co, id) => {
    ed.vyberObjekty([id]);
    ({ tabulka: () => D.dialogTabulka(P), graf: () => D.dialogGraf(P), smartart: () => D.dialogSmartArt(P), obrazky: () => P.vlozObrazekZeZarizeni(), ikony: () => D.dialogIkony(P), zvuk: () => P.vlozZvuk() }[co])?.();
  };
  P.vlozTvar = (t) => ed.zacniVkladani(t === 'textove' ? { typ: 'text' } : { typ: 'tvar', tvar: t });
  P.vlozTextovePole = () => ed.zacniVkladani({ typ: 'text' });
  P.vlozWordArt = (id) => {
    const W = P.pres.velikost.w, H = P.pres.velikost.h;
    const o = { id: noveId(), typ: 'text', x: W / 2 - 300, y: H / 2 - 50, w: 600, h: 100, rot: 0, html: odstavce(['Sem zadejte svůj text']), vel: 54, zar: 'c', wordart: id, rust: true, pismo: '+nadpis' };
    vlozObjekty('WordArt', [o], { upravovat: true });
  };
  P.vlozTabulku = (r, c) => {
    const ob = oblastObsahu();
    const vyska = r * 37;
    const o = { id: noveId(), typ: 'tabulka', x: ob.x, y: ob.y, w: ob.w, h: vyska, rot: 0, vel: 18, tab: { styl: 'stredni2-a1', zahlavi: true, pruhyR: true, sloupce: Array(c).fill(ob.w / c), radky: Array.from({ length: r }, () => Array.from({ length: c }, () => ({ html: '' }))) } };
    vlozObjekty('Vložit tabulku', [o], { nahradit: ob.nahradit });
    ed.zacniUpravy(o.id);
  };
  P.vlozGraf = (typ, data) => {
    const ob = oblastObsahu();
    const o = { id: noveId(), typ: 'graf', x: ob.x, y: ob.y, w: ob.w, h: ob.h, rot: 0, graf: { typ, nazev: undefined, legenda: /vysec|prstenc/.test(typ) ? 'vpravo' : 'dole', ...data } };
    vlozObjekty('Vložit graf', [o], { nahradit: ob.nahradit });
  };
  P.upravGraf = (z, popis = 'Upravit graf') => P.prikaz(popis, () => { for (const o of vyb()) if (o.typ === 'graf') { for (const [k, v] of Object.entries(z)) { if (v === undefined) delete o.graf[k]; else o.graf[k] = v; } } });
  P.upravDataGrafu = (id) => { const o = id ? ed.objekt(id) : vyb().find((x) => x.typ === 'graf'); if (o) { ed.vyberObjekty([o.id]); D.dialogDataGrafu(P, o); } };
  P.vlozSmartArt = (typ, prevest) => {
    const o = vyb()[0];
    let polozky = ['[Text]', '[Text]', '[Text]'];
    let ob = oblastObsahu();
    let nahradit = ob.nahradit;
    if (prevest && o && TEXTOVE(o) && o.typ !== 'tabulka') {
      const r = textZHtml(o.html).split('\n').map((x) => x.trim()).filter(Boolean);
      if (r.length) polozky = r.slice(0, 8);
      ob = { x: o.x, y: o.y, w: o.w, h: o.h };
      nahradit = o.id;
    } else if (typ === 'hierarchie') polozky = ['[Text]', '[Text]', '[Text]', '[Text]'];
    vlozObjekty(prevest ? 'Převést na SmartArt' : 'Vložit SmartArt', smartArt(typ, polozky, ob), { nahradit });
  };
  P.vlozObrazek = async (src, nazev = 'Obrázek') => {
    let data;
    try { data = await pripravObrazek(src); } catch (e) { P.zprava(e.message); return; }
    const ref = P.pres.pridejMedium(data.src);
    const W = P.pres.velikost.w, H = P.pres.velikost.h;
    const v = vyb()[0];
    let o;
    if (v && ((v.ph && jePrazdnyText(v.html)) || v.phObrazek)) {
      // do zástupného symbolu: vyplnit a oříznout
      o = { id: noveId(), typ: 'obrazek', x: v.x, y: v.y, w: v.w, h: v.h, rot: 0, src: ref, alt: '', nazevSouboru: nazev };
      const pomerObr = data.w / data.h, pomer = v.w / v.h;
      if (pomerObr > pomer) { const k = (1 - pomer / pomerObr) / 2; o.orez = { l: k, r: k, t: 0, b: 0 }; } else { const k = (1 - pomerObr / pomer) / 2; o.orez = { l: 0, r: 0, t: k, b: k }; }
      vlozObjekty('Vložit obrázek', [o], { nahradit: v.id });
      return;
    }
    const k = Math.min(1, (W * 0.6) / data.w, (H * 0.7) / data.h);
    const w = data.w * k, h = data.h * k;
    o = { id: noveId(), typ: 'obrazek', x: (W - w) / 2, y: (H - h) / 2, w, h, rot: 0, src: ref, alt: '', nazevSouboru: nazev };
    vlozObjekty('Vložit obrázek', [o]);
  };
  P.vlozObrazekZeZarizeni = async () => {
    const f = await vyberSoubor('image/*');
    if (f) P.vlozObrazek(await souborNaDataUrl(f), f.name);
  };
  P.vlozObrazekZDisku = () => D.dialogObrazkyZDisku(P, ([x]) => P.vlozObrazek(x.src, x.nazev));
  P.zmenitObrazek = async () => {
    const o = vyb().find((x) => x.typ === 'obrazek');
    if (!o) return;
    const f = await vyberSoubor('image/*');
    if (!f) return;
    const data = await pripravObrazek(await souborNaDataUrl(f));
    P.upravObjekt({ src: P.pres.pridejMedium(data.src), h: o.w * (data.h / data.w), orez: null }, 'Změnit obrázek', [o.id]);
  };
  P.upravObrazek = (z) => {
    const cile = vyb().filter((o) => o.typ === 'obrazek');
    if (!cile.length) return;
    P.prikaz('Upravit obrázek', () => {
      for (const o of cile) {
        if (z === null) { delete o.upravy; delete o.obrFiltr; delete o.obrStyl; delete o.pruhlednost; continue; }
        o.upravy = { ...(o.upravy || {}), ...z };
        const u = o.upravy;
        const f = [];
        if (u.jas) f.push(`brightness(${1 + u.jas / 100})`);
        if (u.kontrast) f.push(`contrast(${1 + u.kontrast / 100})`);
        if (u.sytost !== undefined && u.sytost !== 100) f.push(`saturate(${u.sytost / 100})`);
        for (const k of ['opravy', 'barva', 'umelecke']) if (u[k]) f.push(u[k]);
        o.obrFiltr = f.join(' ') || undefined;
        if (!o.obrFiltr) delete o.obrFiltr;
      }
    });
  };
  P.orez = (r) => P.upravObjekt({ orez: r.l || r.r || r.t || r.b ? r : null }, 'Oříznout');
  P.orezPomer = (pomer) => {
    const o = vyb().find((x) => x.typ === 'obrazek');
    if (!o) return;
    const img = new Image();
    img.onload = () => {
      const pomerObr = img.naturalWidth / img.naturalHeight;
      let r;
      if (pomerObr > pomer) { const k = (1 - pomer / pomerObr) / 2; r = { l: k, r: k, t: 0, b: 0 }; } else { const k = (1 - pomerObr / pomer) / 2; r = { l: 0, r: 0, t: k, b: k }; }
      P.upravObjekt({ orez: r, h: o.w / pomer }, 'Oříznout na poměr stran', [o.id]);
    };
    img.src = P.pres.src(o.src);
  };
  P.fotoalbum = () => D.dialogObrazkyZDisku(P, async (obr) => {
    const W = P.pres.velikost.w, H = P.pres.velikost.h;
    const pripravene = [];
    for (const x of obr) { try { pripravene.push({ ...(await pripravObrazek(x.src, 1280)), nazev: x.nazev }); } catch { /* vynechat */ } }
    let prvni;
    P.prikaz('Fotoalbum', () => {
      const uvod = P.pripravSnimek(modelNovySnimek('uvodni'));
      uvod.objekty.find((o) => o.ph === 'nadpis').html = odstavce(['Fotoalbum']);
      uvod.objekty.find((o) => o.ph === 'podtitul').html = odstavce([`${P.autor()} · ${new Date().toLocaleDateString('cs-CZ')}`]);
      let i = P.pres.index(P.st.aktivni);
      P.pres.vlozSnimek(uvod, i++);
      prvni = uvod;
      for (const d of pripravene) {
        const s = P.pripravSnimek(modelNovySnimek('prazdny'));
        const k = Math.min((W * 0.9) / d.w, (H * 0.9) / d.h);
        s.objekty.push({ id: noveId(), typ: 'obrazek', x: (W - d.w * k) / 2, y: (H - d.h * k) / 2, w: d.w * k, h: d.h * k, rot: 0, src: P.pres.pridejMedium(d.src), alt: d.nazev, obrStyl: 'ramecek' });
        s.prechod = { typ: 'zeslabit' };
        P.pres.vlozSnimek(s, i++);
      }
    });
    if (prvni) P.jdiNaSnimek(prvni.id);
  }, { vice: true, titulek: 'Fotoalbum — vyberte obrázky' });
  P.vlozIkony = (nazvy) => {
    const W = P.pres.velikost.w, H = P.pres.velikost.h;
    const obj = nazvy.map((n, i) => ({ id: noveId(), typ: 'ikona', ikona: n, x: W / 2 - (nazvy.length * 110) / 2 + i * 110 + 7, y: H / 2 - 48, w: 96, h: 96, rot: 0, barva: 'tx' }));
    vlozObjekty('Vložit ikony', obj);
  };
  P.vlozZvukData = (src, nazev) => {
    const W = P.pres.velikost.w, H = P.pres.velikost.h;
    vlozObjekty('Vložit zvuk', [{ id: noveId(), typ: 'zvuk', x: W / 2 - 24, y: H / 2 - 24, w: 48, h: 48, rot: 0, src: P.pres.pridejMedium(src), nazev, alt: nazev }]);
  };
  P.vlozZvuk = () => D.dialogZvuky(P, (src, n) => P.vlozZvukData(src, n));
  P.vlozZvukZeZarizeni = async () => { const f = await vyberSoubor('audio/*'); if (f) P.vlozZvukData(await souborNaDataUrl(f), f.name); };
  P.nahratZvuk = () => D.dialogNahratZvuk(P, (src, n) => P.vlozZvukData(src, n));
  P.vlozRovnici = (r) => {
    const W = P.pres.velikost.w, H = P.pres.velikost.h;
    vlozObjekty('Rovnice', [{ id: noveId(), typ: 'text', x: W / 2 - 250, y: H / 2 - 30, w: 500, h: 60, rot: 0, html: `<p><span style="font-family:'Cambria Math',Cambria,Georgia,serif;font-style:italic">${r}</span></p>`, vel: 28, zar: 'c', rust: true }], { upravovat: r === 'Sem zadejte rovnici.' });
  };
  P.vlozSymbol = (z) => {
    if (ed.upravuje) { ed.naTextu('Symbol', () => document.execCommand('insertText', false, z)); return; }
    const v = vyb()[0];
    if (v && TEXTOVE(v) && v.typ !== 'tabulka') { ed.zacniUpravy(v.id); document.execCommand('insertText', false, z); return; }
    P.toast('Symbol vložíte do textu — klikněte do textového pole.');
  };
  P.vlozOdkaz = (adresa, text) => {
    if (ed.upravuje) {
      ed.naTextu('Odkaz', () => {
        const sel = getSelection();
        if (sel.isCollapsed && text) document.execCommand('insertHTML', false, `<a href="${adresa}">${text.replace(/</g, '&lt;')}</a>`);
        else document.execCommand('createLink', false, adresa);
      });
      return;
    }
    if (vyb().length) { P.upravObjekt({ odkaz: adresa }, 'Odkaz'); return; }
    const W = P.pres.velikost.w;
    vlozObjekty('Odkaz', [{ id: noveId(), typ: 'text', x: W / 2 - 200, y: 460, w: 400, h: 40, rot: 0, html: `<p><a href="${adresa}">${(text || adresa).replace(/</g, '&lt;')}</a></p>`, vel: 18, rust: true }]);
  };
  P.tabulkaZExcelu = () => {
    let soubory = [];
    const hledej = (d) => { try { for (const x of FS.list(d)) { const c = FS.join(d, x.name); if (FS.isDir(x.node)) hledej(c); else if (/\.(xlsx|csv)$/i.test(x.name)) soubory.push(c); } } catch { /* nic */ } };
    hledej(FS.HOME);
    soubory = soubory.slice(0, 40);
    const d = dialog(P.koren, {
      titulek: 'Vložit tabulku z AstroTabulek', sirka: 460,
      obsah: el('div.pr-dlg-zvuky', {}, soubory.length ? soubory.map((c) => el('button.ps-zk-radek', { type: 'button', onclick: async () => {
        d.zavri();
        const { Sesit } = await import('../tabulky/sesit.js');
        let ses;
        try { const t = FS.read(c); ses = /\.csv$/i.test(c) ? Sesit.zCsv(t, 'List1') : Sesit.rozeber(t); } catch { P.zprava('Sešit se nepodařilo otevřít.'); return; }
        const l = ses.listy[0];
        const u = ses.rozsah(l);
        const R = Math.min(12, u.r + 1), C = Math.min(8, u.c + 1);
        const radky = Array.from({ length: R }, (_, r) => Array.from({ length: C }, (_, s) => ({ html: String(ses.textBunky(l, r, s) ?? '').replace(/</g, '&lt;') })));
        const ob = oblastObsahu();
        vlozObjekty('Tabulka z AstroTabulek', [{ id: noveId(), typ: 'tabulka', x: ob.x, y: ob.y, w: ob.w, h: R * 30, rot: 0, vel: R > 8 ? 12 : 14, tab: { styl: 'stredni2-a1', zahlavi: true, pruhyR: true, sloupce: Array(C).fill(ob.w / C), radky } }], { nahradit: ob.nahradit });
      } }, el('span.ps-zk-docx.mala.tb-zk-xlsx', {}, ik('list')), el('span', { text: FS.basename(c) }), el('small', { text: FS.dirname(c).replace(FS.HOME, '~') }))) : el('p', { text: 'Na disku nejsou žádné sešity AstroTabulek.' })),
      tlacitka: [{ text: 'Zrušit' }],
    });
  };

  // ------------------------------------------------------------ tabulka
  P.upravTabulku = (op, hodnota) => {
    const o = vyb().find((x) => x.typ === 'tabulka') || (ed.upravuje && ed.objekt(ed.upravuje)?.typ === 'tabulka' ? ed.objekt(ed.upravuje) : null);
    if (!o) return;
    const td = getSelection().anchorNode && (getSelection().anchorNode.nodeType === 1 ? getSelection().anchorNode : getSelection().anchorNode.parentElement)?.closest?.('td');
    const r = td ? +td.dataset.r : o.tab.radky.length - 1, c = td ? +td.dataset.c : o.tab.sloupce.length - 1;
    if (ed.upravuje) ed.ulozText(ed.upravuje);
    const t = o.tab;
    const prazdny = () => ({ html: '' });
    P.prikaz('Úprava tabulky', () => {
      if (op === 'styl') t.styl = hodnota;
      if (op === 'moznost') Object.assign(t, hodnota);
      if (op === 'radekNad' || op === 'radekPod') { t.radky.splice(op === 'radekNad' ? r : r + 1, 0, t.sloupce.map(prazdny)); o.h += 37; }
      if (op === 'sloupecVlevo' || op === 'sloupecVpravo') { const i = op === 'sloupecVlevo' ? c : c + 1; const w = o.w / (t.sloupce.length + 1); t.sloupce = t.sloupce.map((x) => x * (t.sloupce.length / (t.sloupce.length + 1))); t.sloupce.splice(i, 0, w); for (const radek of t.radky) radek.splice(i, 0, prazdny()); }
      if (op === 'smazRadek' && t.radky.length > 1) { t.radky.splice(r, 1); o.h = Math.max(20, o.h - o.h / (t.radky.length + 1)); }
      if (op === 'smazSloupec' && t.sloupce.length > 1) { t.sloupce.splice(c, 1); for (const radek of t.radky) radek.splice(c, 1); }
      if (op === 'rozlozitSloupce') { const w = t.sloupce.reduce((a, b) => a + b, 0) / t.sloupce.length; t.sloupce = t.sloupce.map(() => w); }
      if (op === 'rozlozitRadky') delete t.vysky;
      if (op === 'zar' || op === 'svisle') { const cile = td ? [t.radky[r][c]] : t.radky.flat(); for (const b of cile) b[op] = hodnota; }
      if (op === 'stinovani') { const cile = td ? [t.radky[r][c]] : t.radky.flat(); for (const b of cile) { if (hodnota === 'none') delete b.bg; else b.bg = hodnota; } }
    });
  };

  // ------------------------------------------------------------ kreslení perem
  P.kreslit = (n) => {
    P.st.kresleni = n;
    ed.plocha.classList.toggle('kresleni', !!n);
    ed.plocha.dataset.nastroj = n?.id === 'guma' ? 'guma' : n ? 'pero' : '';
    if (n) { ed.ukonciUpravy(); ed.zrusVyber(); }
    P.obnov();
  };
  ed.plocha.addEventListener('pointerdown', (e) => {
    const n = P.st.kresleni;
    if (!n || e.button !== 0 || !e.target.closest('.pr-platno-obal')) return;
    e.preventDefault(); e.stopPropagation();
    const bod = (ev) => { const b = ed.bod(ev); return [+b.x.toFixed(1), +b.y.toFixed(1)]; };
    if (n.id === 'guma') {
      const [x, y] = bod(e);
      const s = S();
      const cil = [...s.objekty].reverse().find((o) => o.typ === 'kresba' && (o.tahy || []).some((t) => t.body.some(([a, b]) => Math.hypot(a + o.x - x, b + o.y - y) < 8)));
      if (cil) P.prikaz('Guma', () => { const t = cil.tahy.findIndex((t) => t.body.some(([a, b]) => Math.hypot(a + cil.x - x, b + cil.y - y) < 8)); cil.tahy.splice(t, 1); if (!cil.tahy.length) P.pres.smazObjekty(s, [cil.id]); });
      return;
    }
    const body = [bod(e)];
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'pr-inkoust-nahled');
    const cesta = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    Object.entries({ fill: 'none', stroke: n.barva, 'stroke-width': n.sirka * ed.z, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: n.zvyr ? 0.45 : 1 }).forEach(([k, v]) => cesta.setAttribute(k, v));
    svg.append(cesta);
    ed.vodVrstva.append(svg);
    const kresli = () => cesta.setAttribute('d', 'M' + body.map(([x, y]) => `${x * ed.z} ${y * ed.z}`).join('L'));
    const mv = (ev) => { body.push(bod(ev)); kresli(); };
    const up = () => {
      removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
      svg.remove();
      if (body.length < 2) return;
      const xs = body.map((b) => b[0]), ys = body.map((b) => b[1]);
      const x = Math.min(...xs) - n.sirka, y = Math.min(...ys) - n.sirka;
      const o = { id: noveId(), typ: 'kresba', x, y, w: Math.max(...xs) - x + n.sirka, h: Math.max(...ys) - y + n.sirka, rot: 0, tahy: [{ barva: n.barva, sirka: n.sirka, zvyr: n.zvyr, body: body.map(([a, b]) => [+(a - x).toFixed(1), +(b - y).toFixed(1)]) }] };
      P.prikaz('Kreslení', () => { S().objekty.push(o); });
    };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  }, true);
  P.smazatRukopis = () => { const s = S(); const ids = s.objekty.filter((o) => o.typ === 'kresba').map((o) => o.id); if (ids.length) P.prikaz('Smazat rukopis', () => P.pres.smazObjekty(s, ids)); };
  P.prehratRukopis = () => {
    const tahy = [...ed.snObal.querySelectorAll('.pr-o[data-typ="kresba"] path')];
    if (!tahy.length) { P.toast('Na snímku není žádný rukopis.'); return; }
    let zpozdeni = 0;
    for (const p of tahy) {
      const d = p.getTotalLength();
      p.style.strokeDasharray = d; p.style.strokeDashoffset = d;
      const t = Math.min(1500, d * 4);
      p.animate([{ strokeDashoffset: d }, { strokeDashoffset: 0 }], { duration: t, delay: zpozdeni, fill: 'forwards', easing: 'linear' }).finished.then(() => { p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; });
      zpozdeni += t * 0.8;
    }
  };

  // ------------------------------------------------------------ schránka
  const MARKER = 'astroprezentace-schranka:';
  const zapisSchranku = (text) => { navigator.clipboard?.writeText(text).catch(() => {}); };
  P.kopirovat = (vyjmout = false) => {
    if (ed.upravuje) { document.execCommand(vyjmout ? 'cut' : 'copy'); return; }
    if (P.st.fokus === 'miniatury' || !ed.vyber.length) {
      const ids = P.vybraneSnimky();
      const data = ids.map((id) => kopie(P.pres.snimek(id)));
      P.schranka = { typ: 'snimky', data, media: medii(data), id: noveId('c') };
      zapisSchranku(MARKER + P.schranka.id + '\n' + data.map((s) => P.nadpisSnimku(s)).join('\n'));
      if (vyjmout) P.odstranitSnimky();
      return;
    }
    const data = vyb().map((o) => kopie(o));
    P.schranka = { typ: 'objekty', data, media: medii(data), zdroj: P.st.aktivni, id: noveId('c'), vlozeno: 0 };
    zapisSchranku(MARKER + P.schranka.id + '\n' + data.map((o) => textZHtml(o.html)).filter(Boolean).join('\n'));
    if (vyjmout) { P.prikaz('Vyjmout', () => P.pres.smazObjekty(S(), ed.vyber)); ed.vyber = []; }
  };
  const medii = (data) => { const m = {}; JSON.stringify(data, (k, v) => { if (typeof v === 'string' && v.startsWith('media:')) m[v.slice(6)] = P.pres.media[v.slice(6)]; return v; }); return m; };
  P.vyjmout = () => P.kopirovat(true);
  P.vlozit = async (rezim) => {
    if (ed.upravuje) {
      try { const t = await navigator.clipboard.readText(); if (t) ed.naTextu('Vložit', () => document.execCommand('insertText', false, t.startsWith(MARKER) ? t.split('\n').slice(1).join('\n') : t)); } catch { P.toast('Vložte klávesami Ctrl+V.'); }
      return;
    }
    if (rezim === 'jinak') { P.toast('Vložit jinak: použijte Vložit › Ponechat pouze text nebo Obrázek.'); return; }
    const sch = P.schranka;
    if (!sch) {
      try {
        const polozky = await navigator.clipboard.read();
        for (const p of polozky) {
          const typ = p.types.find((t) => t.startsWith('image/'));
          if (typ) { const b = await p.getType(typ); P.vlozObrazek(await souborNaDataUrl(b), 'Vložený obrázek'); return; }
        }
        const t = await navigator.clipboard.readText();
        if (t) P.vlozText(t);
      } catch { P.toast('Schránka je prázdná.'); }
      return;
    }
    Object.assign(P.pres.media, sch.media);
    if (sch.typ === 'snimky') {
      let posledni;
      P.prikaz('Vložit snímky', () => {
        let i = P.pres.index(P.st.aktivni);
        for (const s0 of sch.data) {
          const s = kopie(s0);
          s.id = noveId('s');
          const mapa = {};
          for (const o of s.objekty) { const n = noveId(); mapa[o.id] = n; o.id = n; }
          s.animace = (s.animace || []).map((a) => ({ ...a, id: noveId('a'), obj: mapa[a.obj] || a.obj }));
          if (rezim === 'text') s.objekty = s.objekty.filter((o) => TEXTOVE(o));
          posledni = P.pres.vlozSnimek(s, i++);
        }
      });
      if (posledni) P.jdiNaSnimek(posledni.id);
      return;
    }
    const posun = sch.zdroj === P.st.aktivni ? 18 * (++sch.vlozeno) : 0;
    const nove = sch.data.map((o) => {
      const n = { ...kopieObjektu(o), x: o.x + posun, y: o.y + posun };
      if (rezim === 'text') { n.html = odstavce(textZHtml(n.html).split('\n')); delete n.wordart; delete n.barva; }
      return n;
    }).filter((o) => rezim !== 'text' || TEXTOVE(o));
    if (nove.length) vlozObjekty('Vložit', nove);
  };
  P.vlozText = (t) => {
    if (t.startsWith(MARKER)) return;
    const W = P.pres.velikost.w;
    const radky = t.split(/\r?\n/).slice(0, 60);
    vlozObjekty('Vložit text', [{ id: noveId(), typ: 'text', x: W / 2 - 300, y: 150, w: 600, h: 40, rot: 0, html: odstavce(radky), vel: 18, rust: true }]);
  };
  // skutečná událost vložení (soubory obrázků z jiných aplikací, text z webu)
  P.koren.addEventListener('paste', (e) => {
    if (ed.upravuje || e.target.closest('input, textarea, [contenteditable="true"], [contenteditable="plaintext-only"]')) return;
    const soubory = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
    const text = e.clipboardData?.getData('text/plain') || '';
    if (soubory.length) { e.preventDefault(); P.stalaSeUdalostVlozeni = true; souborNaDataUrl(soubory[0]).then((u) => P.vlozObrazek(u, soubory[0].name || 'Vložený obrázek')); return; }
    if (text && !text.startsWith(MARKER) && (!P.schranka || !text.includes(P.schranka.id))) { e.preventDefault(); P.stalaSeUdalostVlozeni = true; P.schranka = null; P.vlozText(text); }
  });

  // ------------------------------------------------------------ hledání
  const hledatVText = (text, co, { velka, cela }) => {
    const flags = velka ? 'g' : 'gi';
    const vzor = co.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(cela ? `(?<![\\p{L}\\d])${vzor}(?![\\p{L}\\d])` : vzor, flags + 'u').exec(text);
  };
  P.najitDalsi = (co, volby) => {
    if (!co) return false;
    const snimky = P.pres.snimky;
    const start = P.pres.index(P.st.aktivni);
    const akt = ed.upravuje;
    for (let k = 0; k <= snimky.length; k++) {
      const s = snimky[(start + k) % snimky.length];
      const obj = s.objekty.filter(TEXTOVE);
      let zacit = 0;
      if (k === 0 && akt) zacit = obj.findIndex((o) => o.id === akt) + 1;
      for (let j = zacit; j < obj.length; j++) {
        const o = obj[j];
        const text = o.typ === 'tabulka' ? o.tab.radky.flat().map((b) => textZHtml(b.html)).join(' ') : textZHtml(o.html);
        if (!hledatVText(text, co, volby)) continue;
        if (s.id !== P.st.aktivni) P.jdiNaSnimek(s.id);
        ed.zacniUpravy(o.id);
        const koren = ed.editovatelne(o.id);
        if (koren) {
          const vse = textoveUzly(koren);
          const cely = vse.map((n) => n.textContent).join('');
          const m = hledatVText(cely, co, volby);
          if (m) {
            let poz = 0, a = null, b = null;
            for (const n of vse) {
              if (!a && m.index < poz + n.length) a = [n, m.index - poz];
              if (!b && m.index + m[0].length <= poz + n.length) { b = [n, m.index + m[0].length - poz]; break; }
              poz += n.length;
            }
            if (a && b) { const r = document.createRange(); r.setStart(...a); r.setEnd(...b); getSelection().removeAllRanges(); getSelection().addRange(r); }
          }
        }
        return true;
      }
    }
    return false;
  };
  P.nahraditVyber = (co, cim, volby) => {
    const sel = getSelection();
    if (ed.upravuje && sel.toString() && hledatVText(sel.toString(), co, volby)?.[0] === sel.toString()) ed.naTextu('Nahradit', () => document.execCommand('insertText', false, cim));
  };
  P.nahraditVse = (co, cim, volby) => {
    if (!co) return 0;
    ed.ukonciUpravy();
    let n = 0;
    const re = () => new RegExp(co.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), volby.velka ? 'g' : 'gi');
    P.prikaz('Nahradit vše', () => {
      for (const s of P.pres.snimky) for (const o of s.objekty) {
        const nahrad = (html) => upravHtml(html, (d) => { for (const t of textoveUzly(d)) { const nove = t.textContent.replace(re(), () => { n++; return cim; }); if (nove !== t.textContent) t.textContent = nove; } });
        if (o.html) o.html = nahrad(o.html);
        if (o.typ === 'tabulka') for (const b of o.tab.radky.flat()) b.html = nahrad(b.html);
      }
    });
    return n;
  };
  P.pouzitaPisma = () => {
    const set = new Set([P.pismaMotivu().nadpis, P.pismaMotivu().telo]);
    for (const s of P.pres.snimky) for (const o of s.objekty) { if (o.pismo && !o.pismo.startsWith('+')) set.add(o.pismo); for (const m of (o.html || '').matchAll(/font-family:\s*"?([^";,]+)/g)) set.add(m[1]); }
    return [...set];
  };
  P.nahraditPismo = (z, na) => P.prikaz('Nahradit písmo', () => {
    for (const s of P.pres.snimky) for (const o of s.objekty) {
      if (o.pismo === z) o.pismo = na;
      if (o.html?.includes(z)) o.html = o.html.split(z).join(na);
    }
    if (P.pismaMotivu().nadpis === z || P.pismaMotivu().telo === z) P.pres.pisma = { nadpis: P.pismaMotivu().nadpis === z ? na : P.pismaMotivu().nadpis, telo: P.pismaMotivu().telo === z ? na : P.pismaMotivu().telo };
  });

  // ------------------------------------------------------------ diktování
  P.diktovat = () => {
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!R) { P.zprava('Diktování potřebuje prohlížeč s rozpoznáváním řeči (Chrome, Edge).'); return; }
    if (P.st.diktovani) { P.st.diktovani.stop(); return; }
    let cil = ed.upravuje;
    if (!cil) {
      const o = vyb().find((x) => TEXTOVE(x) && x.typ !== 'tabulka') || S().objekty.find((x) => /^obsah/.test(x.ph || '')) || S().objekty.find((x) => x.ph === 'nadpis');
      if (!o) { P.toast('Klikněte do textového pole, kam se má text psát.'); return; }
      cil = o.id;
      ed.zacniUpravy(cil);
    }
    const r = new R();
    r.lang = anglicky() ? 'en-US' : 'cs-CZ';
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) { const t = e.results[i][0].transcript.trim(); if (t && ed.upravuje) ed.naTextu('Diktování', () => document.execCommand('insertText', false, t + ' ')); } };
    r.onend = () => { P.st.diktovani = null; P.obnov(); };
    r.onerror = () => { P.st.diktovani = null; P.obnov(); };
    r.start();
    P.st.diktovani = r;
    P.toast('Poslouchám… Mluvte česky. Dalším kliknutím na Diktovat skončíte.');
    P.obnov();
  };

  // ------------------------------------------------------------ Designer
  P.pouzijNavrh = (n) => {
    P.prikaz('Designer', () => {
      const s = S();
      s.objekty = n.objekty.map((o) => kopie(o));
      if (!s.objekty.some((o) => o.ph === 'nadpis')) s.rozvrzeni = 'prazdny'; else s.rozvrzeni = 'nadpis';
      const ids = new Set(s.objekty.map((o) => o.id));
      s.animace = (s.animace || []).filter((a) => ids.has(a.obj));
    });
    ed.zrusVyber();
  };

  // ------------------------------------------------------------ osnova → snímky
  P.snimkyZOsnovyDat = (osnova) => {
    let prvni;
    P.prikaz('Snímky z osnovy', () => {
      const prazdna = P.pres.snimky.length === 1 && P.pres.snimky[0].objekty.every((o) => jePrazdnyText(o.html) && o.ph);
      if (prazdna) P.pres.snimky = [];
      let i = prazdna ? -1 : P.pres.index(P.st.aktivni);
      osnova.forEach((x, k) => {
        const uvod = prazdna && k === 0;
        const s = P.pripravSnimek(modelNovySnimek(uvod ? 'uvodni' : 'obsah'));
        s.objekty.find((o) => o.ph === 'nadpis').html = odstavce([x.nadpis]);
        const telo = s.objekty.find((o) => o.ph === (uvod ? 'podtitul' : 'obsah'));
        if (telo && x.body.length) telo.html = odstavce(uvod ? [x.body.map((b) => b[0]).join(' · ')] : x.body);
        P.pres.vlozSnimek(s, i++);
        if (!prvni) prvni = s;
      });
    });
    if (prvni) P.jdiNaSnimek(prvni.id);
  };
  P.snimkyZOsnovy = () => {
    const soubory = [];
    const hledej = (d) => { try { for (const x of FS.list(d)) { const c = FS.join(d, x.name); if (FS.isDir(x.node)) hledej(c); else if (/\.(txt|md|docx)$/i.test(x.name)) soubory.push(c); } } catch { /* nic */ } };
    hledej(FS.HOME);
    const d = dialog(P.koren, {
      titulek: 'Vložit osnovu', sirka: 460,
      obsah: el('div', {}, el('p.ps-dlg-pozn', { text: 'Nadpisy (bez odsazení nebo # …) se stanou názvy snímků, odsazené řádky a odrážky jejich textem. Dokument AstroPísma použije nadpisy.' }),
        el('div.pr-dlg-zvuky', {}, soubory.length ? soubory.slice(0, 50).map((c) => el('button.ps-zk-radek', { type: 'button', onclick: () => { d.zavri(); nactiOsnovu(c); } }, ik(/\.docx$/i.test(c) ? 'novy' : 'fileText'), el('span', { text: FS.basename(c) }), el('small', { text: FS.dirname(c).replace(FS.HOME, '~') }))) : el('p', { text: 'Na disku nejsou žádné textové soubory ani dokumenty.' }))),
      tlacitka: [{ text: 'Zrušit' }],
    });
  };
  function nactiOsnovu(c) {
    let text = FS.read(c);
    if (/\.docx$/i.test(c)) {
      try {
        const doc = JSON.parse(text);
        const dd = document.createElement('div');
        dd.innerHTML = doc.html || '';
        text = [...dd.children].map((x) => (/^H[1-3]$/.test(x.tagName) ? '# ' + x.textContent : x.tagName === 'UL' || x.tagName === 'OL' ? [...x.children].map((li) => '- ' + li.textContent).join('\n') : x.textContent.trim() ? '- ' + x.textContent : '')).join('\n');
      } catch { /* obyčejný text */ }
    } else if (!/^#/m.test(text)) {
      text = text.split('\n').map((r) => (/^\s+|^[-*•]/.test(r) ? '- ' + r.trim().replace(/^[-*•]\s*/, '') : r.trim() ? '# ' + r.trim() : '')).join('\n');
    }
    import('./podokna.js').then(({ rozeberOsnovu }) => { const o = rozeberOsnovu(text); if (o.length) P.snimkyZOsnovyDat(o); else P.zprava('V souboru se nenašly žádné nadpisy.'); });
  }
  P.pouzitSnimky = () => {
    const soubory = [];
    const hledej = (d) => { try { for (const x of FS.list(d)) { const c = FS.join(d, x.name); if (FS.isDir(x.node)) hledej(c); else if (/\.pptx$/i.test(x.name) && c !== P.st.cesta) soubory.push(c); } } catch { /* nic */ } };
    hledej(FS.HOME);
    const vpravo = el('div.pr-pouzit-mrizka');
    const d = dialog(P.koren, {
      titulek: 'Opakovaně použít snímky', sirka: 640,
      obsah: el('div.pr-pouzit', {}, el('div.pr-dlg-zvuky', {}, soubory.length ? soubory.map((c) => el('button.ps-zk-radek', { type: 'button', onclick: () => ukazSnimky(c) }, el('span.ps-zk-docx.mala.pr-zk-pptx', {}, el('b', { text: 'P' })), el('span', { text: FS.basename(c) }))) : el('p', { text: 'Na disku nejsou žádné další prezentace.' })), vpravo),
      tlacitka: [{ text: 'Zavřít' }],
    });
    void d;
    function ukazSnimky(c) {
      let zdroj;
      try { zdroj = Prezentace.rozeber(FS.read(c)); } catch { P.zprava('Prezentaci se nepodařilo otevřít.'); return; }
      import('./render.js').then(({ miniatura }) => {
        vpravo.replaceChildren(...zdroj.snimky.map((s, i) => el('button.pr-pouzit-pol', { type: 'button', title: 'Vložit tento snímek', onclick: () => {
          Object.assign(P.pres.media, zdroj.media);
          P.prikaz('Opakovaně použít snímek', () => { const k = kopie(s); k.id = noveId('s'); for (const o of k.objekty) o.id = noveId(); k.animace = []; P.pres.vlozSnimek(k, P.pres.index(P.st.aktivni)); });
          P.toast(`Vložen snímek ${i + 1}.`);
        } }, miniatura(zdroj, s, 160), el('span', { text: String(i + 1) }))));
      });
    }
  };

  // ------------------------------------------------------------ zápatí, nastavení prezentace
  P.nastavZapati = (z) => P.prikaz('Záhlaví a zápatí', () => { P.pres.zapati = { ...P.pres.zapati, ...z }; });
  P.nastavPrezentaci = (z) => P.prikaz('Nastavit prezentaci', () => { Object.assign(P.pres.nastaveni, z); });
  P.vymazatCasovani = () => P.prikaz('Vymazat časování', () => { for (const s of P.pres.snimky) if (s.prechod) { delete s.prechod.auto; } });

  // ------------------------------------------------------------ komentáře
  P.novyKomentar = () => P.podokno('komentare', { novy: true });
  P.smazatKomentar = (rozsah) => P.prikaz('Odstranit komentář', () => {
    if (rozsah === 'vse') for (const s of P.pres.snimky) s.komentare = [];
    else if (rozsah === 'snimek') S().komentare = [];
    else S().komentare = (S().komentare || []).slice(0, -1);
  });
  P.dalsiKomentar = (smer) => {
    const sn = P.pres.snimky;
    const i = P.pres.index(P.st.aktivni);
    for (let k = 1; k <= sn.length; k++) { const s = sn[(i + smer * k + sn.length * 2) % sn.length]; if (s.komentare?.length) { P.jdiNaSnimek(s.id); P.podokno('komentare'); return; } }
    P.toast('V prezentaci nejsou žádné další komentáře.');
  };

  // ------------------------------------------------------------ pravopis (jednoduchá kontrola)
  P.pravopis = () => {
    const nalezy = [];
    P.pres.snimky.forEach((s, i) => {
      for (const o of s.objekty) {
        const t = P.textObjektu(o);
        const opak = /\b(\p{L}+)\s+\1\b/iu.exec(t);
        if (opak) nalezy.push([i, o, `Opakované slovo „${opak[1]}“`]);
        if (/ {2,}/.test(t)) nalezy.push([i, o, 'Dvojitá mezera']);
        if (/\s[,.!?]/.test(t)) nalezy.push([i, o, 'Mezera před interpunkcí']);
      }
    });
    if (!nalezy.length) { P.zprava('Kontrola pravopisu je dokončena. Všechno je v pořádku.', 'Kontrola pravopisu'); return; }
    dialog(P.koren, { titulek: 'Kontrola pravopisu', sirka: 420, obsah: el('div.pr-dlg-zvuky', {}, nalezy.map(([i, o, t]) => el('button.ps-zk-radek', { type: 'button', onclick: () => { P.jdiNaSnimek(P.pres.snimky[i].id); ed.vyberObjekty([o.id]); } }, el('span', { text: t }), el('small', { text: `Snímek ${i + 1}` })))), tlacitka: [{ text: 'Zavřít' }] });
  };
}
