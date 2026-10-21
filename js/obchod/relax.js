// AstroOS — aplikace z Obchodu: Piano, Mazlíček, Kaleidoskop (ukázková verze; Beatbox, Akvárium a Planetárium jsou v plné)

import { el, plural } from '../util.js';
import { tx } from '../i18n.js';
import { toast } from '../ui.js';
import * as FS from '../fs.js';
import { nacti, uloz, ton, sum, audio, platno, smycka, nahodne, mezi, nota } from './spolecne.js';

const lista = (...deti) => el('div.oa-bar', {}, ...deti);
const tlacitko = (text, onclick, trida = '') => el('button.oa-btn' + trida, { text, onclick });

// ================================================================ Piano
const NASTROJE = {
  piano: { nazev: 'Piano', typ: 'triangle', delka: 1.1 },
  varhany: { nazev: 'Varhany', typ: 'square', delka: 0.9, hl: 0.45 },
  synt: { nazev: 'Syntík', typ: 'sawtooth', delka: 0.7, hl: 0.5 },
  fletna: { nazev: 'Flétna', typ: 'sine', delka: 0.8 },
};
// bílé a černé klávesy přes dvě oktávy (od C4); čísla = půltóny od A4
const KLAVESY = [
  ['C', -9, 'a'], ['C#', -8, 'w'], ['D', -7, 's'], ['D#', -6, 'e'], ['E', -5, 'd'], ['F', -4, 'f'], ['F#', -3, 't'],
  ['G', -2, 'g'], ['G#', -1, 'z'], ['A', 0, 'h'], ['A#', 1, 'u'], ['H', 2, 'j'],
  ['C', 3, 'k'], ['C#', 4, 'o'], ['D', 5, 'l'], ['D#', 6, 'p'], ['E', 7, 'ů'], ['F', 8, ''], ['F#', 9, ''],
  ['G', 10, ''], ['G#', 11, ''], ['A', 12, ''], ['A#', 13, ''], ['H', 14, ''], ['C', 15, ''],
];
// Óda na radost (Beethoven) — půltóny od A4 a délky v dobách
const ODA = [[-5, 1], [-5, 1], [-4, 1], [-2, 1], [-2, 1], [-4, 1], [-5, 1], [-7, 1], [-9, 1], [-9, 1], [-7, 1], [-5, 1], [-5, 1.5], [-7, 0.5], [-7, 2],
  [-5, 1], [-5, 1], [-4, 1], [-2, 1], [-2, 1], [-4, 1], [-5, 1], [-7, 1], [-9, 1], [-9, 1], [-7, 1], [-5, 1], [-7, 1.5], [-9, 0.5], [-9, 2]];

export function piano(body) {
  const st = nacti('piano', { nastroj: 'piano', nahravka: [] });
  const klav = el('div.oa-pn-klav');
  const prvky = new Map();
  let nahravam = null, timery = [];

  const bily = KLAVESY.filter(([n]) => !n.includes('#'));
  let bileI = 0;
  for (const [n, p, k] of KLAVESY) {
    const cerna = n.includes('#');
    const b = el('div.oa-pn-k' + (cerna ? '.cerna' : '.bila'), {}, el('span', { text: k ? k.toUpperCase() : '' }));
    if (cerna) b.style.left = `calc(${(bileI / bily.length) * 100}% - var(--cerna-w) / 2)`;
    else bileI++;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); hraj(p); });
    klav.append(b);
    prvky.set(p, b);
  }

  function hraj(p, zaznamenat = true) {
    const n = NASTROJE[st.nastroj];
    ton(nota(p), n.delka, { typ: n.typ, hl: n.hl ?? 0.8 });
    if (n.typ === 'triangle') ton(nota(p + 12), n.delka * 0.6, { typ: 'sine', hl: 0.15 });
    const b = prvky.get(p);
    if (b) { b.classList.add('on'); setTimeout(() => b.classList.remove('on'), 160); }
    if (zaznamenat && nahravam) nahravam.push([p, performance.now() - nahravam.start]);
  }

  const mapa = Object.fromEntries(KLAVESY.filter((k) => k[2]).map(([, p, k]) => [k, p]));
  const dolu = (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.target.tagName === 'SELECT') return;
    const p = mapa[e.key.toLowerCase()];
    if (p !== undefined) { e.preventDefault(); hraj(p); }
  };
  body.addEventListener('keydown', dolu);

  const vyber = el('select.oa-vyber', {}, ...Object.entries(NASTROJE).map(([id, n]) => el('option', { value: id, text: n.nazev })));
  vyber.value = st.nastroj;
  vyber.onchange = () => { st.nastroj = vyber.value; uloz('piano', st); body.focus(); };

  const bNahraj = tlacitko('● Nahrát', () => {
    if (nahravam) {
      st.nahravka = nahravam.slice(); // pole bez vlastnosti start
      uloz('piano', st);
      nahravam = null;
      bNahraj.textContent = '● Nahrát';
      bNahraj.classList.remove('nahrava');
      stav.textContent = st.nahravka.length ? `Nahráno ${plural(st.nahravka.length, ['tón', 'tóny', 'tónů'])}.` : 'Nic se nenahrálo.';
    } else {
      nahravam = Object.assign([], { start: performance.now() });
      bNahraj.textContent = '■ Stop';
      bNahraj.classList.add('nahrava');
      stav.textContent = 'Nahrávám… hraj!';
    }
    body.focus();
  });
  const stav = el('div.oa-stav', { text: 'Hraj myší nebo klávesami A–Ů (černé W E T Z U O P)' });

  function prehrajNotY(noty) {
    timery.forEach(clearTimeout);
    timery = noty.map(([p, t]) => setTimeout(() => hraj(p, false), t));
  }

  body.append(el('div.oa.oa-pn', {},
    lista(stav, el('div.oa-mezera'), vyber, bNahraj,
      tlacitko('▶ Moje nahrávka', () => { if (st.nahravka.length) prehrajNotY(st.nahravka); body.focus(); }),
      tlacitko('🎵 Óda na radost', () => {
        let t = 0;
        prehrajNotY(ODA.map(([p, d]) => { const r = [p, t]; t += d * 380; return r; }));
        body.focus();
      })),
    el('div.oa-pn-telo', {}, el('div.oa-pn-logo', { text: 'AstroPiano' }), klav)));
  return () => { timery.forEach(clearTimeout); body.removeEventListener('keydown', dolu); };
}

// ================================================================ Mazlíček
const MAZ_VETY = {
  hlad: ['Mám hlad… 🍪', 'Kručí mi v bříšku.', 'Nedal bys mi něco?'],
  unava: ['Zívám… 😴', 'Jsem nějak ospalý.'],
  nuda: ['Pojď si hrát!', 'Nudím se…', 'Hodíš mi míček?'],
  spina: ['Jsem celý od prachu z hvězd.', 'Chtělo by to koupel 🫧'],
  stastny: ['Mám tě rád! 💚', 'Dnešek je super.', 'Jsi nejlepší!', 'Bzz bzz. To je mimozemsky „ahoj“.', 'Víš, že pocházím z planety Gloop?'],
};
const JIDLA = ['🍪', '🍎', '🍕', '🥕', '🍩', '🍉'];

export function mazlicek(body, win) {
  const st = nacti('mazlicek', { jmeno: '', narozen: 0, hlad: 80, energie: 80, nalada: 80, cistota: 80, cas: Date.now(), spi: false, barva: 0 });
  const BARVY = ['#54d98a', '#4aa3e8', '#f07f9c', '#f0b95c', '#a077f0'];
  // čas mimo aplikaci: hodnoty pomalu klesají (za hodinu cca 6 bodů)
  const ubehlo = Math.min(48, (Date.now() - st.cas) / 3600e3);
  if (st.narozen) {
    st.hlad = Math.max(0, st.hlad - ubehlo * 6);
    st.nalada = Math.max(0, st.nalada - ubehlo * 4);
    st.cistota = Math.max(0, st.cistota - ubehlo * 3);
    st.energie = st.spi ? Math.min(100, st.energie + ubehlo * 20) : Math.max(0, st.energie - ubehlo * 3);
  }
  const koren = el('div.oa.oa-mz');
  body.append(koren);
  let tik = null, bublinaT = null;

  function ulozit() { st.cas = Date.now(); uloz('mazlicek', st); }

  function pojmenovani() {
    const vstup = el('input.oa-vstup', { placeholder: 'Jméno mazlíčka', maxlength: 16 });
    const barvy = el('div.oa-mz-barvy', {}, ...BARVY.map((b, i) => {
      const t = el('button.oa-mz-barva' + (i === st.barva ? '.on' : ''), { style: { background: b } });
      t.onclick = () => { st.barva = i; barvy.querySelectorAll('button').forEach((x, j) => x.classList.toggle('on', j === i)); };
      return t;
    }));
    const potvrd = () => {
      const j = vstup.value.trim();
      if (!j) { vstup.focus(); return; }
      Object.assign(st, { jmeno: j, narozen: Date.now(), hlad: 80, energie: 90, nalada: 90, cistota: 100, spi: false });
      ulozit();
      hlavni();
    };
    vstup.addEventListener('keydown', (e) => { if (e.key === 'Enter') potvrd(); });
    koren.replaceChildren(el('div.oa-mz-uvod', {},
      el('div.oa-mz-vejce', { text: '🥚' }),
      el('h2', { text: 'Z vajíčka se něco klube!' }),
      el('p', { text: 'Vymysli jméno a barvu pro svého mimozemského mazlíčka. Bude na tebe čekat i po zavření okna.' }),
      vstup, barvy, tlacitko('Vylíhnout', potvrd, '.primary')));
    setTimeout(() => vstup.focus(), 50);
  }

  function hlavni() {
    const stari = Math.floor((Date.now() - st.narozen) / 86400e3);
    const faze = stari >= 7 ? 'dospělý' : stari >= 2 ? 'mládě' : 'miminko';
    const tvor = el('button.oa-mz-tvor', {},
      el('div.oa-mz-tykadla'), el('div.oa-mz-oci', {}, el('span'), el('span')), el('div.oa-mz-pusa'), el('div.oa-mz-tvare'));
    tvor.style.setProperty('--barva', BARVY[st.barva]);
    tvor.style.setProperty('--vel', faze === 'dospělý' ? 1.15 : faze === 'mládě' ? 1 : 0.8);
    const bublina = el('div.oa-mz-bublina');
    const scena = el('div.oa-mz-scena', {}, bublina, tvor, el('div.oa-mz-stin'));
    const ukazatele = {};
    const radek = (k, t, ikona) => {
      const v = el('div.oa-mz-vypln');
      ukazatele[k] = v;
      return el('div.oa-mz-uk', {}, el('span', { text: ikona + ' ' + t }), el('div.oa-mz-pruh', {}, v));
    };
    const akce = {
      nakrmit: tlacitko('🍪 Nakrmit', () => {
        if (st.spi) return rekni('Psst, spím… 💤');
        if (st.hlad > 95) return rekni('Už nemůžu, prasknu! 🎈');
        st.hlad = Math.min(100, st.hlad + 25); st.cistota = Math.max(0, st.cistota - 4);
        const j = nahodne(JIDLA);
        efekt(j); rekni(`Mňam, ${j}!`); ton(600, 0.08); ton(800, 0.1, { zpozdeni: 0.1 }); ulozit(); kresli();
      }),
      hrat: tlacitko('⚽ Hrát si', () => {
        if (st.spi) return rekni('Teď ne, spím… 💤');
        if (st.energie < 15) return rekni('Jsem moc unavený 😴');
        st.nalada = Math.min(100, st.nalada + 20); st.energie = Math.max(0, st.energie - 12); st.hlad = Math.max(0, st.hlad - 6);
        tvor.classList.remove('skok'); void tvor.offsetWidth; tvor.classList.add('skok');
        efekt('⚽'); rekni(nahodne(['Juchů!', 'Ještě jednou!', 'Chytil jsem to!'])); [523, 659, 784].forEach((f, i) => ton(f, 0.1, { zpozdeni: i * 0.07 })); ulozit(); kresli();
      }),
      umyt: tlacitko('🫧 Umýt', () => {
        if (st.spi) return rekni('Zzz…');
        st.cistota = 100; st.nalada = Math.min(100, st.nalada + 5);
        efekt('🫧'); efekt('🫧'); rekni('Brr, ale voním! ✨'); sum(0.5, { hl: 0.2, filtr: { typ: 'bandpass', f: 3000 } }); ulozit(); kresli();
      }),
      spat: tlacitko('🌙 Spát', () => {
        st.spi = !st.spi; ulozit(); kresli();
        rekni(st.spi ? 'Dobrou noc… 💤' : 'Dobré ráno! ☀️');
      }),
    };
    function efekt(znak) {
      const n = el('div.oa-mz-efekt', { text: znak, style: { left: mezi(35, 60) + '%' } });
      scena.append(n);
      setTimeout(() => n.remove(), 1200);
    }
    function rekni(t) {
      bublina.textContent = t;
      bublina.classList.add('on');
      clearTimeout(bublinaT);
      bublinaT = setTimeout(() => bublina.classList.remove('on'), 2600);
    }
    let pohlazeni = 0;
    tvor.onclick = () => {
      if (st.spi) { rekni('Hmm… ještě pět minut…'); return; }
      pohlazeni++;
      st.nalada = Math.min(100, st.nalada + 3);
      tvor.classList.remove('hihi'); void tvor.offsetWidth; tvor.classList.add('hihi');
      ton(mezi(900, 1200), 0.08, { hl: 0.4 });
      rekni(pohlazeni % 10 === 0 ? 'Hihihi, to lechtá! 😆' : pohlazeni === 3 ? 'Prrr… 💚' : nahodne(['Hihi!', '♥', 'Ještě!', '😊']));
      ulozit(); kresli();
    };

    function kresli() {
      for (const k of ['hlad', 'energie', 'nalada', 'cistota']) {
        const v = st[k];
        ukazatele[k].style.width = v + '%';
        ukazatele[k].style.background = v < 25 ? '#ef6a5a' : v < 50 ? '#f0b95c' : '#54d98a';
      }
      const smutny = st.hlad < 25 || st.nalada < 25 || st.cistota < 20;
      tvor.classList.toggle('spi', st.spi);
      tvor.classList.toggle('smutny', !st.spi && smutny);
      tvor.classList.toggle('spinavy', st.cistota < 35);
      akce.spat.textContent = st.spi ? '☀️ Probudit' : '🌙 Spát';
      win.title = `${st.jmeno} — Mazlíček`;
    }

    koren.replaceChildren(
      el('div.oa-mz-hlava', {}, el('h2', { text: st.jmeno }), el('span', { text: `${faze} · ${plural(stari, ['den', 'dny', 'dní'])}` })),
      scena,
      el('div.oa-mz-ukazatele', {}, radek('hlad', tx('Sytost', 'Fullness'), '🍪'), radek('energie', 'Energie', '⚡'), radek('nalada', 'Nálada', '💚'), radek('cistota', 'Čistota', '🫧')),
      el('div.oa-mz-akce', {}, ...Object.values(akce)));
    kresli();

    clearInterval(tik);
    let sekund = 0;
    tik = setInterval(() => {
      sekund++;
      // v okně ubývá rychleji, ať je co dělat (hlad ~1 bod za 20 s)
      st.hlad = Math.max(0, st.hlad - 0.05);
      st.nalada = Math.max(0, st.nalada - 0.04);
      st.cistota = Math.max(0, st.cistota - 0.025);
      st.energie = st.spi ? Math.min(100, st.energie + 0.5) : Math.max(0, st.energie - 0.03);
      if (st.spi && st.energie >= 100) { st.spi = false; rekni('Vyspal jsem se do růžova! ☀️'); }
      if (sekund % 12 === 0 && !st.spi) {
        const potreba = st.hlad < 35 ? 'hlad' : st.energie < 25 ? 'unava' : st.nalada < 35 ? 'nuda' : st.cistota < 30 ? 'spina' : 'stastny';
        if (potreba !== 'stastny' || Math.random() < 0.4) rekni(nahodne(MAZ_VETY[potreba]));
      }
      if (sekund % 10 === 0) ulozit();
      kresli();
    }, 1000);
    if (ubehlo > 3 && st.hlad < 40) setTimeout(() => rekni(`Konečně jsi zpátky! Stýskalo se mi. 🥺`), 500);
    else setTimeout(() => rekni(nahodne([`Ahoj! To jsem já, ${st.jmeno}.`, 'Ahoj! 👋', 'Jé, ty jsi tu!'])), 500);
  }

  if (st.narozen) hlavni(); else pojmenovani();
  return () => { clearInterval(tik); clearTimeout(bublinaT); ulozit(); };
}

// ================================================================ Kaleidoskop
export function kaleidoskop(body) {
  const st = nacti('kaleidoskop', { osy: 8, tloustka: 4, zrcadlo: true });
  const obal = el('div.oa-hra.oa-ka');
  const p = platno(obal, (pl) => { pl.g.fillStyle = '#0b0b12'; pl.g.fillRect(0, 0, pl.w, pl.h); }, { zachovat: true });
  let posledni = null, odstin = Math.random() * 360, kresli = false;
  const info = el('div.oa-stav', { text: 'Kresli myší, symetrie se postará o zbytek' });

  function cara(x1, y1, x2, y2) {
    const { g, w, h } = p;
    const cx = w / 2, cy = h / 2;
    odstin = (odstin + 1.2) % 360;
    g.strokeStyle = `hsl(${odstin} 90% 62%)`;
    g.lineWidth = st.tloustka;
    g.lineCap = 'round';
    g.shadowColor = `hsl(${odstin} 90% 62%)`;
    g.shadowBlur = st.tloustka * 2;
    for (let i = 0; i < st.osy; i++) {
      const u = (Math.PI * 2 * i) / st.osy;
      for (const zr of st.zrcadlo ? [1, -1] : [1]) {
        g.save();
        g.translate(cx, cy);
        g.rotate(u);
        g.scale(1, zr);
        g.beginPath();
        g.moveTo(x1 - cx, y1 - cy);
        g.lineTo(x2 - cx, y2 - cy);
        g.stroke();
        g.restore();
      }
    }
    g.shadowBlur = 0;
  }

  const bod = (e) => { const r = obal.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  obal.addEventListener('pointerdown', (e) => { kresli = true; posledni = bod(e); obal.setPointerCapture(e.pointerId); });
  obal.addEventListener('pointermove', (e) => {
    if (!kresli) return;
    const b = bod(e);
    cara(...posledni, ...b);
    posledni = b;
  });
  obal.addEventListener('pointerup', () => { kresli = false; });

  const osy = el('select.oa-vyber', {}, ...[4, 6, 8, 12, 16].map((n) => el('option', { value: n, text: `${n} os` })));
  osy.value = st.osy;
  osy.onchange = () => { st.osy = +osy.value; uloz('kaleidoskop', st); };
  const tl = el('input', { type: 'range', min: 1, max: 16, value: st.tloustka });
  tl.oninput = () => { st.tloustka = +tl.value; uloz('kaleidoskop', st); };
  const zr = el('button.oa-btn' + (st.zrcadlo ? '.on' : ''), { text: 'Zrcadlit' });
  zr.onclick = () => { st.zrcadlo = !st.zrcadlo; zr.classList.toggle('on', st.zrcadlo); uloz('kaleidoskop', st); };

  function nahodny() {
    const { w, h } = p;
    for (let k = 0; k < 6; k++) {
      let x = w / 2 + mezi(-w / 4, w / 4), y = h / 2 + mezi(-h / 4, h / 4);
      for (let i = 0; i < 30; i++) {
        const nx = x + mezi(-25, 25), ny = y + mezi(-25, 25);
        cara(x, y, nx, ny);
        x = nx; y = ny;
      }
    }
  }

  function ulozit() {
    try {
      const slozka = FS.HOME + '/Obrázky';
      if (!FS.exists(slozka)) FS.mkdir(slozka, { parents: true });
      const jmeno = FS.freeName(slozka, 'kaleidoskop.png');
      FS.write(`${slozka}/${jmeno}`, p.cv.toDataURL('image/png'));
      toast({ title: 'Uloženo', body: `~/Obrázky/${jmeno} — najdeš ho ve Fotkách.`, icon: 'image' });
    } catch (err) {
      toast({ title: 'Nepodařilo se uložit', body: err.message, icon: 'info', timeout: 6000 });
    }
  }

  body.append(el('div.oa', {},
    lista(info, el('div.oa-mezera'), osy, el('label.oa-bb-tempo', {}, el('span', { text: 'Štětec' }), tl), zr,
      tlacitko('🎲 Náhoda', nahodny), tlacitko('Smazat', () => { p.g.fillStyle = '#0b0b12'; p.g.fillRect(0, 0, p.w, p.h); }), tlacitko('Uložit', ulozit, '.primary')),
    obal));
  return () => p.stop();
}
