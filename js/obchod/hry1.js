// AstroOS — aplikace z Obchodu: Piškvorky, Raketa, Pexeso, Šibenice, Reakce

import { el, plural } from '../util.js';
import { nacti, uloz, ton, sum, platno, smycka, nahodne, mezi, zamichej } from './spolecne.js';

const lista = (...deti) => el('div.oa-bar', {}, ...deti);
const tlacitko = (text, onclick, trida = '') => el('button.oa-btn' + trida, { text, onclick });

// ================================================================ Piškvorky
export function piskvorky(body) {
  const N = 15;
  const SMERY = [[1, 0], [0, 1], [1, 1], [1, -1]];
  const st = nacti('piskvorky', { ty: 0, pocitac: 0, remizy: 0, tezka: true });
  let deska, konec, tah;

  const stav = el('div.oa-stav');
  const skore = el('div.oa-stat');
  const mrizka = el('div.oa-pi-mrizka');
  mrizka.style.setProperty('--n', N);
  const obtiznost = el('select.oa-vyber', {},
    el('option', { value: 'l', text: 'Lehká' }), el('option', { value: 't', text: 'Těžká' }));
  obtiznost.value = st.tezka ? 't' : 'l';
  obtiznost.onchange = () => { st.tezka = obtiznost.value === 't'; uloz('piskvorky', st); nova(); };

  const bunky = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const b = el('button.oa-pi-bunka');
      b.onclick = () => hrajHrac(x, y);
      bunky.push(b);
      mrizka.append(b);
    }
  }

  const get = (x, y) => (x < 0 || y < 0 || x >= N || y >= N ? -1 : deska[y * N + x]);

  function rada(x, y, hrac) {
    for (const [dx, dy] of SMERY) {
      const pole = [[x, y]];
      for (const s of [1, -1]) {
        let i = 1;
        while (get(x + dx * i * s, y + dy * i * s) === hrac) { pole.push([x + dx * i * s, y + dy * i * s]); i++; }
      }
      if (pole.length >= 5) return pole;
    }
    return null;
  }

  // ohodnocení pole pro hráče: kolik kamenů by spojil a jestli mají volné konce
  function hodnota(x, y, hrac) {
    let s = 0;
    for (const [dx, dy] of SMERY) {
      let n = 1, volne = 0;
      for (const sm of [1, -1]) {
        let i = 1;
        while (get(x + dx * i * sm, y + dy * i * sm) === hrac) { n++; i++; }
        if (get(x + dx * i * sm, y + dy * i * sm) === 0) volne++;
      }
      if (n >= 5) s += 1e6;
      else if (n === 4) s += volne === 2 ? 1e5 : volne ? 1.2e4 : 0;
      else if (n === 3) s += volne === 2 ? 4000 : volne ? 350 : 0;
      else if (n === 2) s += volne === 2 ? 120 : volne ? 20 : 0;
      else s += volne * 2;
    }
    return s;
  }

  function tahPocitace() {
    let nej = -1, kam = null;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (deska[y * N + x]) continue;
        let blizko = false;
        for (let dy = -2; dy <= 2 && !blizko; dy++) for (let dx = -2; dx <= 2; dx++) if (get(x + dx, y + dy) > 0) { blizko = true; break; }
        if (!blizko) continue;
        let v = hodnota(x, y, 2) * 1.1 + hodnota(x, y, 1);
        if (!st.tezka) v = hodnota(x, y, 2) * mezi(0.4, 1.4) + hodnota(x, y, 1) * mezi(0, 0.9);
        if (v > nej) { nej = v; kam = [x, y]; }
      }
    }
    return kam || [7, 7];
  }

  function poloz(x, y, hrac) {
    deska[y * N + x] = hrac;
    const b = bunky[y * N + x];
    b.textContent = hrac === 1 ? '✕' : '○';
    b.classList.add(hrac === 1 ? 'x' : 'o');
    bunky.forEach((c) => c.classList.remove('posledni'));
    b.classList.add('posledni');
    ton(hrac === 1 ? 660 : 440, 0.08, { typ: 'triangle', hl: 0.6 });
    const vyhra = rada(x, y, hrac);
    if (vyhra) {
      konec = true;
      vyhra.forEach(([vx, vy]) => bunky[vy * N + vx].classList.add('vyhra'));
      if (hrac === 1) { st.ty++; stav.textContent = 'Vyhrál jsi! 🎉'; [523, 659, 784].forEach((f, i) => ton(f, 0.25, { zpozdeni: i * 0.12 })); }
      else { st.pocitac++; stav.textContent = 'Počítač vyhrál. Zkus to znovu.'; ton(300, 0.4, { doF: 150, typ: 'sawtooth', hl: 0.5 }); }
      uloz('piskvorky', st);
      ukazSkore();
      return true;
    }
    if (!deska.includes(0)) {
      konec = true; st.remizy++; uloz('piskvorky', st); ukazSkore();
      stav.textContent = 'Remíza — deska je plná.';
      return true;
    }
    return false;
  }

  function hrajHrac(x, y) {
    if (konec || tah !== 1 || deska[y * N + x]) return;
    if (poloz(x, y, 1)) return;
    tah = 2;
    stav.textContent = 'Počítač přemýšlí…';
    setTimeout(() => {
      if (konec) return;
      const [px, py] = tahPocitace();
      if (!poloz(px, py, 2)) { tah = 1; stav.textContent = 'Jsi na tahu (✕)'; }
    }, 280 + Math.random() * 300);
  }

  function ukazSkore() { skore.textContent = `Ty ${st.ty} : ${st.pocitac} Počítač${st.remizy ? ` · remízy ${st.remizy}` : ''}`; }

  function nova() {
    deska = new Array(N * N).fill(0);
    konec = false;
    tah = 1;
    bunky.forEach((b) => { b.textContent = ''; b.className = 'oa-pi-bunka'; });
    stav.textContent = 'Jsi na tahu (✕). Spoj pět v řadě.';
  }

  body.append(el('div.oa', {},
    lista(stav, el('div.oa-mezera'), skore, obtiznost, tlacitko('Nová hra', nova)),
    el('div.oa-stred', {}, mrizka),
  ));
  ukazSkore();
  nova();
}

// ================================================================ Raketa (flappy)
export function raketa(body) {
  const st = nacti('raketa', { rekord: 0, her: 0 });
  const obal = el('div.oa-hra');
  const info = el('div.oa-stat', { text: `Rekord ${st.rekord}` });
  body.append(el('div.oa', {}, lista(el('div.oa-stav', { text: 'Mezerník, šipka nahoru nebo klik = zážeh' }), el('div.oa-mezera'), info), obal));
  const p = platno(obal);

  const H = 600; // logická výška, šířka podle okna
  const SVETY = [
    { nebe: ['#0b1026', '#1d1747'], skala: '#6b5a8e', jmeno: 'Mlhovina' },
    { nebe: ['#1a0b0b', '#4a1d12'], skala: '#b8582c', jmeno: 'Mars' },
    { nebe: ['#03161c', '#0d3f45'], skala: '#3fa79b', jmeno: 'Ledový měsíc' },
    { nebe: ['#140a1f', '#3b1150'], skala: '#d05ab8', jmeno: 'Neonová galaxie' },
    { nebe: ['#000000', '#101010'], skala: '#e6e6e6', jmeno: 'Černá díra' },
  ];
  const hvezdy = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random() * H, r: mezi(0.4, 1.8), v: mezi(8, 40) }));
  let r, prekazky, skore, faze, cas, castice, svet;

  function nova() {
    r = { y: H / 2, v: 0 };
    prekazky = [];
    castice = [];
    skore = 0;
    faze = 'start';
    cas = 0;
    svet = 0;
  }

  function zazeh() {
    if (faze === 'konec') { if (cas > 0.6) nova(); return; }
    if (faze === 'start') faze = 'hra';
    r.v = -330;
    ton(220, 0.12, { typ: 'sawtooth', hl: 0.25, doF: 120 });
  }

  const klavesa = (e) => {
    if ([' ', 'ArrowUp', 'w', 'W'].includes(e.key)) { e.preventDefault(); zazeh(); }
  };
  body.addEventListener('keydown', klavesa);
  obal.addEventListener('pointerdown', zazeh);

  const zastav = smycka((dt) => {
    const meritko = p.h / H;
    const W = p.w / meritko;
    cas += dt;
    const rx = W * 0.28;

    if (faze === 'hra') {
      r.v += 980 * dt;
      r.y += r.v * dt;
      const rychlost = 170 + Math.min(130, skore * 4);
      const posledni = prekazky[prekazky.length - 1];
      if (!posledni || posledni.x < W - 260) {
        const mezera = Math.max(150, 215 - skore * 2);
        prekazky.push({ x: W + 40, stred: mezi(120, H - 120), mezera, proslo: false, tvar: Math.random() });
      }
      for (const o of prekazky) {
        o.x -= rychlost * dt;
        if (!o.proslo && o.x + 35 < rx) {
          o.proslo = true;
          skore++;
          ton(880, 0.07, { hl: 0.5 });
          if (skore % 15 === 0) { svet = (svet + 1) % SVETY.length; [523, 784, 1047].forEach((f, i) => ton(f, 0.18, { zpozdeni: i * 0.08 })); }
        }
        const vX = rx + 14 > o.x - 35 && rx - 14 < o.x + 35;
        const vY = r.y - 12 < o.stred - o.mezera / 2 || r.y + 12 > o.stred + o.mezera / 2;
        if (vX && vY) naraz();
      }
      prekazky = prekazky.filter((o) => o.x > -60);
      if (r.y > H - 6 || r.y < 6) naraz();
      castice.push({ x: rx - 16, y: r.y + 4, vx: -mezi(60, 140), vy: mezi(-30, 30), z: 0.5 });
    } else if (faze === 'start') {
      r.y = H / 2 + Math.sin(cas * 3) * 14;
    }
    for (const c of castice) { c.x += c.vx * dt; c.y += c.vy * dt; c.z -= dt; }
    castice = castice.filter((c) => c.z > 0);

    // ---- kreslení
    const { g } = p;
    const S = SVETY[svet];
    const gr = g.createLinearGradient(0, 0, 0, p.h);
    gr.addColorStop(0, S.nebe[0]);
    gr.addColorStop(1, S.nebe[1]);
    g.fillStyle = gr;
    g.fillRect(0, 0, p.w, p.h);
    g.save();
    g.scale(meritko, meritko);
    g.fillStyle = '#fff';
    for (const h of hvezdy) {
      if (faze === 'hra') h.x -= (h.v * dt) / W;
      if (h.x < 0) h.x += 1;
      g.globalAlpha = 0.3 + h.r / 3;
      g.beginPath(); g.arc(h.x * W, h.y, h.r, 0, 7); g.fill();
    }
    g.globalAlpha = 1;
    for (const o of prekazky) {
      g.fillStyle = S.skala;
      skalniSloup(g, o.x, 0, o.stred - o.mezera / 2, o.tvar);
      skalniSloup(g, o.x, o.stred + o.mezera / 2, H, o.tvar + 0.5);
    }
    for (const c of castice) {
      g.globalAlpha = c.z * 1.6;
      g.fillStyle = c.z > 0.3 ? '#ffd166' : '#ff6b35';
      g.beginPath(); g.arc(c.x, c.y, 3 + (0.5 - c.z) * 6, 0, 7); g.fill();
    }
    g.globalAlpha = 1;
    // raketa
    g.save();
    g.translate(rx, r.y);
    g.rotate(Math.max(-0.5, Math.min(1.1, r.v / 600)) + Math.PI / 2);
    g.fillStyle = '#e8edf2';
    g.beginPath(); g.moveTo(0, -18); g.quadraticCurveTo(11, -4, 8, 12); g.lineTo(-8, 12); g.quadraticCurveTo(-11, -4, 0, -18); g.fill();
    g.fillStyle = '#ef4f4f';
    g.beginPath(); g.moveTo(-8, 4); g.lineTo(-14, 15); g.lineTo(-7, 12); g.fill();
    g.beginPath(); g.moveTo(8, 4); g.lineTo(14, 15); g.lineTo(7, 12); g.fill();
    g.fillStyle = '#4aa3e8';
    g.beginPath(); g.arc(0, -3, 4, 0, 7); g.fill();
    g.restore();
    // texty
    g.textAlign = 'center';
    g.fillStyle = '#fff';
    g.font = '700 46px system-ui, sans-serif';
    if (faze !== 'start') g.fillText(String(skore), W / 2, 70);
    g.font = '600 15px system-ui, sans-serif';
    if (svet && faze === 'hra') { g.globalAlpha = 0.6; g.fillText(S.jmeno, W / 2, 96); g.globalAlpha = 1; }
    if (faze === 'start') g.fillText('Klikni nebo zmáčkni mezerník', W / 2, H / 2 + 70);
    if (faze === 'konec') {
      g.fillStyle = 'rgba(0,0,0,.45)';
      g.fillRect(W / 2 - 150, H / 2 - 70, 300, 140);
      g.fillStyle = '#fff';
      g.font = '700 24px system-ui, sans-serif';
      g.fillText('Bum! 💥', W / 2, H / 2 - 28);
      g.font = '500 15px system-ui, sans-serif';
      g.fillText(`Skóre ${skore} · rekord ${st.rekord}`, W / 2, H / 2 + 4);
      g.fillText('Klikni pro další let', W / 2, H / 2 + 36);
    }
    g.restore();
  });

  function naraz() {
    faze = 'konec';
    cas = 0;
    sum(0.5, { hl: 0.8, filtr: { typ: 'lowpass', f: 900 } });
    st.her++;
    if (skore > st.rekord) { st.rekord = skore; info.textContent = `Rekord ${st.rekord} 🏆`; }
    uloz('raketa', st);
  }

  nova();
  return () => { zastav(); p.stop(); body.removeEventListener('keydown', klavesa); };
}

function skalniSloup(g, x, y1, y2, tvar) {
  g.beginPath();
  g.moveTo(x - 30, y1);
  const kroku = 6;
  for (let i = 0; i <= kroku; i++) {
    const y = y1 + ((y2 - y1) * i) / kroku;
    g.lineTo(x - 30 - Math.sin(tvar * 20 + i * 1.7) * 6, y);
  }
  for (let i = kroku; i >= 0; i--) {
    const y = y1 + ((y2 - y1) * i) / kroku;
    g.lineTo(x + 30 + Math.cos(tvar * 13 + i * 2.1) * 6, y);
  }
  g.closePath();
  g.fill();
}

// ================================================================ Pexeso
const SYMBOLY = ['🪐', '🚀', '⭐', '🌙', '☄️', '👽', '🛸', '🌍', '🌞', '🔭', '🌌', '🛰️', '🌈', '⚡', '🔥', '❄️', '🍀', '🐙'];

export function pexeso(body) {
  const st = nacti('pexeso', { rekordy: {} });
  let velikost = 4, karty, otocene, tahy, nalezeno, start, tik, zamek;
  const mrizka = el('div.oa-px-mrizka');
  const stav = el('div.oa-stav');
  const cas = el('div.oa-stat');
  const vyber = el('select.oa-vyber', {},
    el('option', { value: '4', text: '4 × 4' }), el('option', { value: '6', text: '6 × 6' }));
  vyber.onchange = () => { velikost = +vyber.value; nova(); };

  function nova() {
    clearInterval(tik);
    const pocet = (velikost * velikost) / 2;
    karty = zamichej(zamichej(SYMBOLY).slice(0, pocet).flatMap((s) => [s, s]));
    otocene = []; tahy = 0; nalezeno = 0; start = 0; zamek = false;
    mrizka.style.setProperty('--n', velikost);
    mrizka.replaceChildren(...karty.map((s, i) => {
      const k = el('button.oa-px-karta', {}, el('div.oa-px-rub'), el('div.oa-px-lic', { text: s }));
      k.onclick = () => otoc(i, k);
      return k;
    }));
    cas.textContent = '0:00';
    const r = st.rekordy[velikost];
    stav.textContent = r ? `Rekord: ${r.tahy} tahů za ${fmtCas(r.cas)}` : 'Najdi všechny dvojice.';
  }

  const fmtCas = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  function otoc(i, k) {
    if (zamek || k.classList.contains('on') || k.classList.contains('nalez')) return;
    if (!start) {
      start = Date.now();
      tik = setInterval(() => { cas.textContent = fmtCas(Math.floor((Date.now() - start) / 1000)); }, 500);
    }
    k.classList.add('on');
    ton(500 + otocene.length * 120, 0.06, { typ: 'triangle', hl: 0.4 });
    otocene.push({ i, k });
    if (otocene.length < 2) return;
    tahy++;
    const [a, b] = otocene;
    otocene = [];
    if (karty[a.i] === karty[b.i]) {
      a.k.classList.add('nalez'); b.k.classList.add('nalez');
      nalezeno++;
      ton(784, 0.12, { zpozdeni: 0.05 }); ton(1047, 0.15, { zpozdeni: 0.13 });
      if (nalezeno === karty.length / 2) hotovo();
    } else {
      zamek = true;
      setTimeout(() => { a.k.classList.remove('on'); b.k.classList.remove('on'); zamek = false; }, 750);
    }
  }

  function hotovo() {
    clearInterval(tik);
    const s = Math.floor((Date.now() - start) / 1000);
    const r = st.rekordy[velikost];
    const novy = !r || tahy < r.tahy || (tahy === r.tahy && s < r.cas);
    if (novy) { st.rekordy[velikost] = { tahy, cas: s }; uloz('pexeso', st); }
    stav.textContent = `Hotovo za ${plural(tahy, ['tah', 'tahy', 'tahů'])} a ${fmtCas(s)}${novy ? ' — nový rekord! 🏆' : ''}`;
    [523, 659, 784, 1047].forEach((f, i) => ton(f, 0.2, { zpozdeni: i * 0.1 }));
  }

  body.append(el('div.oa', {},
    lista(stav, el('div.oa-mezera'), cas, vyber, tlacitko('Zamíchat', nova)),
    el('div.oa-stred', {}, mrizka)));
  nova();
  return () => clearInterval(tik);
}

// ================================================================ Šibenice
const SLOVA = {
  'Vesmír': ['planeta', 'kometa', 'astronaut', 'galaxie', 'mlhovina', 'teleskop', 'družice', 'meteorit', 'souhvězdí', 'raketoplán', 'gravitace', 'skafandr'],
  'Zvířata': ['krokodýl', 'žirafa', 'tučňák', 'chobotnice', 'veverka', 'nosorožec', 'pavouk', 'velryba', 'ježek', 'pštros', 'mravenečník', 'klokan'],
  'Počítače': ['klávesnice', 'procesor', 'monitor', 'prohlížeč', 'algoritmus', 'grafika', 'záloha', 'program', 'heslo', 'obrazovka', 'reproduktor', 'myš'],
  'Jídlo': ['palačinka', 'knedlík', 'rajče', 'jahoda', 'hranolky', 'brokolice', 'čokoláda', 'svíčková', 'meloun', 'okurka', 'perník', 'buchta'],
  'Hry': ['minecraft', 'šachy', 'pexeso', 'piškvorky', 'fotbal', 'schovávaná', 'monopoly', 'tetris', 'kuželky', 'dáma', 'sudoku', 'kostky'],
};
const BEZ = (c) => c.normalize('NFD').replace(/[̀-ͯ]/g, '');

export function sibenice(body) {
  const st = nacti('sibenice', { serie: 0, nejSerie: 0, vyhry: 0 });
  let slovo, kategorie, hadane, chyby, konec;
  const MAX = 10;
  const obr = el('div.oa-si-obr');
  const slovoEl = el('div.oa-si-slovo');
  const klav = el('div.oa-si-klav');
  const stav = el('div.oa-stav');
  const stat = el('div.oa-stat');
  const PISMENA = 'AÁBCČDĎEÉĚFGHIÍJKLMNŇOÓPQRŘSŠTŤUÚŮVWXYÝZŽ'.split('').filter((c) => BEZ(c) === c);

  const DILY = [
    '<path d="M20 190h120"/>', '<path d="M50 190V20"/>', '<path d="M50 20h80"/>', '<path d="M50 50l30-30"/>',
    '<path d="M130 20v25"/>', '<circle cx="130" cy="60" r="15"/>', '<path d="M130 75v50"/>',
    '<path d="M130 90l-22 18M130 90l22 18"/>', '<path d="M130 125l-18 30"/>', '<path d="M130 125l18 30"/>',
  ];

  function kresli() {
    obr.innerHTML = `<svg viewBox="0 0 180 200" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round">${DILY.slice(0, chyby).join('')}</svg>`;
    slovoEl.replaceChildren(...[...slovo].map((c) => el('span' + (hadane.has(BEZ(c).toUpperCase()) || konec ? '.ok' : ''),
      { text: hadane.has(BEZ(c).toUpperCase()) || konec ? c.toUpperCase() : '' })));
    stat.textContent = `Série ${st.serie} · nejlepší ${st.nejSerie}`;
  }

  function nova() {
    kategorie = nahodne(Object.keys(SLOVA));
    slovo = nahodne(SLOVA[kategorie]);
    hadane = new Set();
    chyby = 0;
    konec = false;
    stav.textContent = `Kategorie: ${kategorie} · ${plural(slovo.length, ['písmeno', 'písmena', 'písmen'])}`;
    klav.replaceChildren(...PISMENA.map((c) => el('button.oa-si-p', { text: c, dataset: { p: c }, onclick: () => hadej(c) })));
    kresli();
  }

  function hadej(c) {
    if (konec || hadane.has(c)) return;
    hadane.add(c);
    const b = klav.querySelector(`[data-p="${c}"]`);
    const trefa = [...slovo].some((x) => BEZ(x).toUpperCase() === c);
    b?.classList.add(trefa ? 'ok' : 'chyba');
    if (trefa) ton(700, 0.08, { hl: 0.5 });
    else { chyby++; ton(200, 0.15, { typ: 'square', hl: 0.25 }); }
    const vse = [...slovo].every((x) => hadane.has(BEZ(x).toUpperCase()));
    if (vse) {
      konec = true; st.serie++; st.vyhry++; st.nejSerie = Math.max(st.nejSerie, st.serie);
      stav.textContent = st.serie >= 5 ? `Uhádnuto! Už ${st.serie} v řadě, jsi mistr slov 🧠` : 'Uhádnuto! 🎉';
      [523, 659, 784].forEach((f, i) => ton(f, 0.2, { zpozdeni: i * 0.1 }));
    } else if (chyby >= MAX) {
      konec = true; st.serie = 0;
      stav.textContent = `Oběšenec… Hledané slovo: ${slovo.toUpperCase()}`;
    }
    if (konec) uloz('sibenice', st);
    kresli();
  }

  const klavesa = (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key === 'Enter' && konec) return nova();
    const c = BEZ(e.key).toUpperCase();
    if (c.length === 1 && PISMENA.includes(c)) hadej(c);
  };
  body.addEventListener('keydown', klavesa);

  body.append(el('div.oa', {},
    lista(stav, el('div.oa-mezera'), stat, tlacitko('Nové slovo', nova)),
    el('div.oa-si', {}, obr, slovoEl, klav)));
  nova();
  return () => body.removeEventListener('keydown', klavesa);
}

// ================================================================ Reakce
const ZVIRATA = [
  [180, 'Gepard 🐆', 'Tohle už je na hraně lidských možností.'],
  [230, 'Sokol 🦅', 'Výborné reflexy, takový pilot by se hodil.'],
  [280, 'Kočka 🐈', 'Rychlejší než většina lidí.'],
  [340, 'Pes 🐕', 'Solidní průměr.'],
  [420, 'Kráva 🐄', 'Chce to víc kafe.'],
  [Infinity, 'Lenochod 🦥', 'Neusínáš náhodou?'],
];

export function reakce(body) {
  const st = nacti('reakce', { nej: 0, nejPrumer: 0 });
  const KOL = 5;
  let faze = 'uvod', casy = [], casovac, startT;
  const plocha = el('button.oa-re-plocha');
  const velky = el('div.oa-re-velky');
  const maly = el('div.oa-re-maly');
  const stat = el('div.oa-stat');
  plocha.append(velky, maly);

  function ukaz(trida, a, b) {
    plocha.className = 'oa-re-plocha ' + trida;
    velky.textContent = a;
    maly.textContent = b;
    stat.textContent = `Nejlepší ${st.nej ? st.nej + ' ms' : '—'} · nejlepší průměr ${st.nejPrumer ? st.nejPrumer + ' ms' : '—'}`;
  }

  function cekej() {
    faze = 'cekani';
    ukaz('cervena', 'Počkej na zelenou…', `Kolo ${casy.length + 1} z ${KOL}`);
    casovac = setTimeout(() => {
      faze = 'ted';
      startT = performance.now();
      ukaz('zelena', 'TEĎ!', '');
      ton(880, 0.06, { hl: 0.4 });
    }, mezi(1400, 4200));
  }

  plocha.addEventListener('pointerdown', () => {
    if (faze === 'uvod' || faze === 'vysledek') { casy = []; cekej(); return; }
    if (faze === 'cekani') {
      clearTimeout(casovac);
      faze = 'brzo';
      ton(160, 0.25, { typ: 'square', hl: 0.3 });
      ukaz('modra', 'Moc brzo! 😅', 'Klikni a zkus to kolo znovu');
      return;
    }
    if (faze === 'brzo') { cekej(); return; }
    if (faze === 'ted') {
      const ms = Math.round(performance.now() - startT);
      casy.push(ms);
      if (!st.nej || ms < st.nej) st.nej = ms;
      if (casy.length >= KOL) {
        const prumer = Math.round(casy.reduce((a, b) => a + b, 0) / casy.length);
        if (!st.nejPrumer || prumer < st.nejPrumer) st.nejPrumer = prumer;
        uloz('reakce', st);
        const [, zvire, veta] = ZVIRATA.find(([lim]) => prumer < lim);
        faze = 'vysledek';
        ukaz('modra', `${prumer} ms — ${zvire}`, `${veta}  Časy: ${casy.join(', ')} ms. Klikni pro další pokus.`);
      } else {
        faze = 'mezi';
        ukaz('modra', `${ms} ms`, 'Klikni pro další kolo');
      }
      return;
    }
    if (faze === 'mezi') cekej();
  });

  body.append(el('div.oa', {}, lista(el('div.oa-stav', { text: `Klikni, jakmile se plocha zbarví zeleně. ${KOL} kol.` }), el('div.oa-mezera'), stat), plocha));
  ukaz('modra', 'Test reakce ⚡', 'Klikni kamkoli pro start');
  return () => clearTimeout(casovac);
}

