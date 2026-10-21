// AstroOS — aplikace z Obchodu: sdílené pomůcky
//
// Ukládání (jeden klíč v nastavení na aplikaci), zvuky skládané za běhu
// s ohledem na systémovou hlasitost, plátno, které drží velikost okna, a herní smyčka.

import { State } from '../state.js';

// ---------------------------------------------------------------- ukládání
export const nacti = (id, vychozi = {}) => ({ ...vychozi, ...(State.get('oa:' + id) || {}) });
export const uloz = (id, data) => State.set('oa:' + id, data);

// ---------------------------------------------------------------- zvuk
let ac = null;
export function audio() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

export const hlasitost = () => (State.get('zvuky') === false ? 0 : (State.get('volume') ?? 62) / 100);

/** Jeden tón. f v Hz, delka v sekundách. */
export function ton(f, delka = 0.15, { typ = 'sine', hl = 1, zpozdeni = 0, doF = null, utlum = true } = {}) {
  const a = audio();
  const sila = hlasitost() * 0.22 * hl;
  if (!a || sila <= 0) return;
  const t0 = a.currentTime + zpozdeni;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = typ;
  osc.frequency.setValueAtTime(f, t0);
  if (doF) osc.frequency.exponentialRampToValueAtTime(doF, t0 + delka);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(sila, t0 + 0.012);
  if (utlum) g.gain.exponentialRampToValueAtTime(0.0001, t0 + delka);
  else { g.gain.setValueAtTime(sila, t0 + delka - 0.03); g.gain.linearRampToValueAtTime(0.0001, t0 + delka); }
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + delka + 0.05);
}

/** Krátký šum (bicí, výbuchy). filtr = { typ, f } */
export function sum(delka = 0.1, { hl = 1, filtr = null, zpozdeni = 0 } = {}) {
  const a = audio();
  const sila = hlasitost() * 0.3 * hl;
  if (!a || sila <= 0) return;
  const t0 = a.currentTime + zpozdeni;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * delka), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  const g = a.createGain();
  g.gain.setValueAtTime(sila, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + delka);
  let uzel = src;
  if (filtr) {
    const f = a.createBiquadFilter();
    f.type = filtr.typ;
    f.frequency.value = filtr.f;
    uzel = uzel.connect(f);
  }
  uzel.connect(g).connect(a.destination);
  src.start(t0);
}

/** Frekvence noty: 0 = A4 (440 Hz), po půltónech. */
export const nota = (pultony) => 440 * 2 ** (pultony / 12);

// ---------------------------------------------------------------- plátno
/**
 * Plátno, které vyplní obal a drží ostrost i při změně velikosti okna.
 * Vrací { cv, g, w, h, stop } — w/h jsou v CSS pixelech a mění se za běhu.
 * zachovat: při změně velikosti nakreslí původní obsah zpátky doprostřed (kreslicí aplikace).
 */
export function platno(obal, poZmene, { zachovat = false } = {}) {
  const cv = document.createElement('canvas');
  cv.className = 'oa-platno';
  obal.append(cv);
  const g = cv.getContext('2d');
  const p = { cv, g, w: 1, h: 1, stop: null };
  const zmer = () => {
    const r = obal.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (w === p.w && h === p.h) return;
    let stare = null;
    if (zachovat && p.w > 1) {
      stare = document.createElement('canvas');
      stare.width = cv.width; stare.height = cv.height;
      stare.getContext('2d').drawImage(cv, 0, 0);
    }
    const [sw, sh] = [p.w, p.h];
    p.w = w; p.h = h;
    cv.width = w * dpr;
    cv.height = h * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    poZmene?.(p);
    if (stare) g.drawImage(stare, (w - sw) / 2, (h - sh) / 2, sw, sh);
  };
  const ro = new ResizeObserver(zmer);
  ro.observe(obal);
  zmer();
  p.stop = () => ro.disconnect();
  return p;
}

/** Herní smyčka; fn(dt v sekundách). Vrací funkci pro zastavení. */
export function smycka(fn) {
  let posledni = performance.now();
  let id = 0, bezi = true;
  const krok = (t) => {
    if (!bezi) return;
    const dt = Math.min(0.05, (t - posledni) / 1000);
    posledni = t;
    fn(dt, t);
    id = requestAnimationFrame(krok);
  };
  id = requestAnimationFrame(krok);
  return () => { bezi = false; cancelAnimationFrame(id); };
}

// ---------------------------------------------------------------- náhoda
export const nahodne = (pole) => pole[Math.floor(Math.random() * pole.length)];
export const mezi = (a, b) => a + Math.random() * (b - a);
export function zamichej(pole) {
  const p = [...pole];
  for (let i = p.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  return p;
}

/** 12345 → „12 345“ */
export const cislo = (n) => Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
