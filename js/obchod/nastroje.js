// AstroOS — aplikace z Obchodu: Pomodoro, Převodník, Kostky, Morseovka

import { el, plural } from '../util.js';
import { toast } from '../ui.js';
import { tt } from '../i18n.js';
import { nacti, uloz, ton, sum, nahodne, mezi, cislo } from './spolecne.js';

const lista = (...deti) => el('div.oa-bar', {}, ...deti);
const tlacitko = (text, onclick, trida = '') => el('button.oa-btn' + trida, { text, onclick });
const dnes = () => new Date().toISOString().slice(0, 10);

// ================================================================ Pomodoro
export function pomodoro(body, win) {
  const st = nacti('pomodoro', { prace: 25, pauza: 5, dlouha: 15, faze: 'prace', konec: 0, zbyva: 0, kolo: 0, den: '', dnes: 0, celkem: 0 });
  if (st.den !== dnes()) { st.den = dnes(); st.dnes = 0; }
  const FAZE = {
    prace: { nazev: 'Soustředění', barva: '#ef6a5a', min: () => st.prace },
    pauza: { nazev: 'Krátká pauza', barva: '#54d98a', min: () => st.pauza },
    dlouha: { nazev: 'Dlouhá pauza', barva: '#4aa3e8', min: () => st.dlouha },
  };
  const R = 92, OBVOD = 2 * Math.PI * R;
  const kruh = el('div.oa-po-kruh', {
    html: `<svg viewBox="0 0 220 220"><circle cx="110" cy="110" r="${R}" class="oa-po-dra"/><circle cx="110" cy="110" r="${R}" class="oa-po-vypln" stroke-dasharray="${OBVOD}"/></svg>`,
  });
  const cas = el('div.oa-po-cas');
  const nazev = el('div.oa-po-nazev');
  kruh.append(el('div.oa-po-text', {}, nazev, cas));
  const bStart = tlacitko('Start', prepni, '.primary');
  const tecky = el('div.oa-po-tecky');
  const stat = el('div.oa-po-stat');
  const vybery = el('div.oa-po-vybery', {}, ...Object.keys(FAZE).map((f) => {
    const b = el('button.oa-po-faze', { text: FAZE[f].nazev, dataset: { f } });
    b.onclick = () => { st.faze = f; st.konec = 0; st.zbyva = 0; uloz('pomodoro', st); kresli(); };
    return b;
  }));
  const nast = el('div.oa-po-nast', {}, ...[['prace', 'Práce'], ['pauza', 'Pauza'], ['dlouha', 'Dlouhá']].map(([k, t]) => {
    const i = el('input.oa-vstup', { type: 'number', min: 1, max: 90, value: st[k] });
    i.onchange = () => { st[k] = Math.max(1, Math.min(90, +i.value || 1)); i.value = st[k]; uloz('pomodoro', st); kresli(); };
    return el('label', {}, el('span', { text: t }), i, el('span', { text: 'min' }));
  }));

  const delka = () => FAZE[st.faze].min() * 60 * 1000;
  const zbyvaMs = () => (st.konec ? Math.max(0, st.konec - Date.now()) : st.zbyva || delka());

  function prepni() {
    if (st.konec) { st.zbyva = zbyvaMs(); st.konec = 0; }
    else { st.konec = Date.now() + zbyvaMs(); st.zbyva = 0; ton(660, 0.1, { hl: 0.4 }); }
    uloz('pomodoro', st);
    kresli();
  }

  function dokonceno() {
    [784, 659, 784, 1047].forEach((f, i) => ton(f, 0.25, { zpozdeni: i * 0.18, typ: 'triangle' }));
    if (st.faze === 'prace') {
      st.kolo++; st.dnes++; st.celkem++;
      st.faze = st.kolo % 4 === 0 ? 'dlouha' : 'pauza';
      toast({ title: '🍅 Hotovo!', body: st.kolo % 4 === 0 ? 'Čtyři kola za sebou. Zasloužíš si dlouhou pauzu.' : 'Dej si pauzu, protáhni se a napij se.', icon: 'pomodoro' });
    } else {
      st.faze = 'prace';
      toast({ title: 'Konec pauzy', body: 'Zpátky do práce, další rajče čeká.', icon: 'pomodoro' });
    }
    st.konec = 0; st.zbyva = 0;
    uloz('pomodoro', st);
  }

  function kresli() {
    if (st.konec && Date.now() >= st.konec) dokonceno();
    const f = FAZE[st.faze];
    const ms = zbyvaMs();
    const s = Math.ceil(ms / 1000);
    cas.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    nazev.textContent = f.nazev;
    kruh.style.setProperty('--barva', f.barva);
    kruh.querySelector('.oa-po-vypln').style.strokeDashoffset = String(OBVOD * (1 - ms / delka()));
    bStart.textContent = st.konec ? 'Pozastavit' : (ms < delka() ? 'Pokračovat' : 'Start');
    vybery.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.f === st.faze));
    tecky.replaceChildren(...[0, 1, 2, 3].map((i) => el('span' + (i < st.kolo % 4 ? '.on' : ''))));
    stat.textContent = `Dnes ${plural(st.dnes, ['rajče', 'rajčata', 'rajčat'])} 🍅 · celkem ${st.celkem}`;
    win.title = st.konec ? `${cas.textContent} — ${f.nazev}` : 'Pomodoro';
  }

  const tik = setInterval(kresli, 250);
  body.append(el('div.oa.oa-po', {}, vybery, kruh, tecky,
    el('div.oa-po-akce', {}, bStart, tlacitko('Reset', () => { st.konec = 0; st.zbyva = 0; uloz('pomodoro', st); kresli(); })),
    stat, nast));
  kresli();
  return () => clearInterval(tik);
}

// ================================================================ Převodník
const JEDNOTKY = {
  'Délka': { m: 1, km: 1000, cm: 0.01, mm: 0.001, 'míle': 1609.344, 'stopa': 0.3048, 'palec': 0.0254, 'banán 🍌': 0.18, 'fotbalové hřiště ⚽': 105, 'Eiffelovka 🗼': 330, 'světelný rok ✨': 9.4607e15 },
  'Hmotnost': { kg: 1, g: 0.001, t: 1000, 'libra': 0.453592, 'unce': 0.0283495, 'kočka 🐈': 4.5, 'slon 🐘': 6000, 'modrá velryba 🐋': 150000 },
  'Objem': { l: 1, ml: 0.001, 'm³': 1000, 'galon (US)': 3.78541, 'hrnek ☕': 0.25, 'vana 🛁': 150, 'bazén 🏊': 2.5e6 },
  'Rychlost': { 'km/h': 1, 'm/s': 3.6, 'mph': 1.609344, 'uzel': 1.852, 'šnek 🐌': 0.048, 'gepard 🐆': 110, 'zvuk 🔊': 1235, 'světlo 💡': 1.0792528e9 },
  'Čas': { s: 1, min: 60, h: 3600, den: 86400, 'týden': 604800, rok: 31557600, 'přestávka ve škole 🔔': 600, 'film 🎬': 7200 },
  'Data': { B: 1, kB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12, 'disketa 💾': 1.44e6, 'disk AstroOS 💽': 5.24288e6 },
  'Teplota': { '°C': 'c', '°F': 'f', 'K': 'k' },
  'Měna': { 'CZK': 1, 'EUR': 25.2, 'USD': 23.1, 'GBP': 30.4, 'PLN': 5.9, 'JPY': 0.155, 'Robux 🟩': 0.29, 'zmrzlina 🍦': 45 },
};

export function prevodnik(body) {
  const st = nacti('prevodnik', { kat: 'Délka', z: 'km', na: 'banán 🍌', hodnota: '1' });
  const kategorie = el('div.oa-pr-kat');
  const vstup = el('input.oa-vstup.oa-pr-cislo', { type: 'text', inputmode: 'decimal' });
  const vysledek = el('div.oa-pr-vysledek');
  const selZ = el('select.oa-vyber');
  const selNa = el('select.oa-vyber');
  const poznamka = el('div.oa-pr-pozn');
  const tabulka = el('div.oa-pr-tab');

  function preved(v, z, na) {
    const J = JEDNOTKY[st.kat];
    if (st.kat === 'Teplota') {
      const c = J[z] === 'c' ? v : J[z] === 'f' ? (v - 32) * 5 / 9 : v - 273.15;
      return J[na] === 'c' ? c : J[na] === 'f' ? c * 9 / 5 + 32 : c + 273.15;
    }
    return (v * J[z]) / J[na];
  }

  const fmt = (n) => {
    if (!isFinite(n)) return '—';
    const a = Math.abs(n);
    if (a !== 0 && (a >= 1e12 || a < 1e-4)) {
      const [m, e] = n.toExponential(3).split('e');
      const horni = String(+e).replace(/./g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'['0123456789'.indexOf(c)] ?? '⁻');
      return `${m.replace('.', ',')} × 10${horni}`;
    }
    const zaok = Math.round(n * 1e4) / 1e4;
    const [c, d] = String(Math.abs(zaok)).split('.');
    return (zaok < 0 ? '−' : '') + cislo(+c) + (d ? ',' + d : '');
  };

  function naplnSelecty() {
    const jmena = Object.keys(JEDNOTKY[st.kat]);
    if (!jmena.includes(st.z)) st.z = jmena[0];
    if (!jmena.includes(st.na)) st.na = jmena[1];
    for (const [s, k] of [[selZ, 'z'], [selNa, 'na']]) {
      s.replaceChildren(...jmena.map((j) => el('option', { value: j, text: j })));
      s.value = st[k];
    }
  }

  function prepocti() {
    const v = parseFloat(String(vstup.value).replace(/\s/g, '').replace(',', '.'));
    st.hodnota = vstup.value;
    uloz('prevodnik', st);
    if (isNaN(v)) { vysledek.textContent = '—'; tabulka.replaceChildren(); return; }
    vysledek.textContent = `${fmt(preved(v, st.z, st.na))} ${tt(st.na)}`;
    poznamka.textContent = st.kat === 'Měna' ? 'Orientační kurzy uložené v aplikaci, převodník je offline.' : '';
    tabulka.replaceChildren(...Object.keys(JEDNOTKY[st.kat]).filter((j) => j !== st.z).map((j) =>
      el('div.oa-pr-radek', {}, el('span', { text: j }), el('b', { text: fmt(preved(v, st.z, j)) }))));
  }

  function kresliKategorie() {
    kategorie.replaceChildren(...Object.keys(JEDNOTKY).map((k) => {
      const b = el('button.oa-pr-k' + (k === st.kat ? '.on' : ''), { text: k });
      b.onclick = () => { st.kat = k; kresliKategorie(); naplnSelecty(); prepocti(); };
      return b;
    }));
  }

  selZ.onchange = () => { st.z = selZ.value; prepocti(); };
  selNa.onchange = () => { st.na = selNa.value; prepocti(); };
  vstup.oninput = prepocti;
  vstup.value = st.hodnota;

  body.append(el('div.oa.oa-pr', {},
    kategorie,
    el('div.oa-pr-hlavni', {},
      el('div.oa-pr-radka', {}, vstup, selZ),
      el('button.oa-btn.oa-pr-swap', { text: '⇅', title: 'Prohodit', onclick: () => { [st.z, st.na] = [st.na, st.z]; naplnSelecty(); prepocti(); } }),
      el('div.oa-pr-radka', {}, vysledek, selNa),
      poznamka),
    el('div.oa-pr-nadpis', { text: 'Ve všech jednotkách' }),
    tabulka));
  kresliKategorie();
  naplnSelecty();
  prepocti();
}

// ================================================================ Kostky a náhoda
const KOULE = [
  'Určitě ano.', 'Bez pochyby.', 'Hvězdy říkají ano.', 'Spíš ano.', 'Vypadá to dobře.',
  'Zeptej se později.', 'Teď to nedokážu říct.', 'Soustřeď se a zeptej se znovu.', 'Radši ti to neřeknu…',
  'Spíš ne.', 'Moje zdroje říkají ne.', 'Vůbec ne.', 'Ani náhodou.', 'Zeptej se AstroAI, já mám pauzu.',
];
const TECKY = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

export function kostky(body) {
  const st = nacti('kostky', { pocet: 2, jmena: 'Anna\nBeta\nCyril\nDáša' });
  const obsah = el('div.oa-ko-obsah');
  const zalozky = [['kostky', 'Kostky 🎲'], ['mince', 'Mince 🪙'], ['los', 'Losování 🎟️'], ['koule', 'Magická koule 🎱']];
  let aktivni = 'kostky';
  const lis = el('div.oa-ko-zal', {}, ...zalozky.map(([id, t]) => {
    const b = el('button.oa-pr-k', { text: t, dataset: { z: id } });
    b.onclick = () => { aktivni = id; kresli(); };
    return b;
  }));
  const timery = [];

  const kostka = (n) => el('div.oa-ko-kostka', {}, ...Array.from({ length: 9 }, (_, i) => el('span' + (TECKY[n].includes(i) ? '.t' : ''))));

  function kostkyUI() {
    const pole = el('div.oa-ko-pole');
    const soucet = el('div.oa-ko-soucet');
    const pocet = el('select.oa-vyber', {}, ...[1, 2, 3, 4, 5, 6].map((n) => el('option', { value: n, text: plural(n, ['kostka', 'kostky', 'kostek']) })));
    pocet.value = st.pocet;
    pocet.onchange = () => { st.pocet = +pocet.value; uloz('kostky', st); hod(true); };
    function hod(tiche) {
      const hodnoty = Array.from({ length: st.pocet }, () => 1 + Math.floor(Math.random() * 6));
      pole.replaceChildren(...hodnoty.map((n) => { const k = kostka(n); if (!tiche) k.classList.add('hod'); return k; }));
      soucet.textContent = st.pocet > 1 ? `Součet ${hodnoty.reduce((a, b) => a + b, 0)}` : '';
      if (!tiche) for (let i = 0; i < 5; i++) sum(0.03, { hl: 0.4, zpozdeni: i * 0.05, filtr: { typ: 'highpass', f: 2000 } });
      if (!tiche && hodnoty.length > 1 && hodnoty.every((x) => x === 6)) soucet.textContent += ' — samé šestky! 🎉';
    }
    hod(true);
    return el('div.oa-ko-sekce', {}, pole, soucet, el('div.oa-ko-akce', {}, pocet, tlacitko('Hodit', () => hod(false), '.primary')));
  }

  function minceUI() {
    const mince = el('div.oa-ko-mince', {}, el('div.lic', { text: 'Panna' }), el('div.rub', { text: 'Orel' }));
    const vys = el('div.oa-ko-soucet', { text: 'Klikni na Hodit' });
    let uhel = 0, panny = 0, orli = 0;
    return el('div.oa-ko-sekce', {}, mince, vys, el('div.oa-ko-akce', {}, tlacitko('Hodit mincí', () => {
      const panna = Math.random() < 0.5;
      uhel += 1800;
      if ((uhel % 360 === 0) !== panna) uhel += 180;   // líc (0°) = panna
      mince.style.transform = `rotateY(${uhel}deg)`;
      ton(1400, 0.05, { hl: 0.3 });
      vys.textContent = '…';
      timery.push(setTimeout(() => {
        if (panna) panny++; else orli++;
        vys.textContent = `${panna ? 'Panna' : 'Orel'}!  (panna ${panny} × orel ${orli})`;
        ton(900, 0.05, { hl: 0.3 });
      }, 1000));
    }, '.primary')));
  }

  function losUI() {
    const pole = el('textarea.oa-vstup.oa-ko-jmena', { placeholder: 'Jedno jméno na řádek' });
    pole.value = st.jmena;
    pole.oninput = () => { st.jmena = pole.value; uloz('kostky', st); };
    const vys = el('div.oa-ko-vylosovano', { text: '?' });
    const los = (kolik) => {
      const jmena = pole.value.split('\n').map((x) => x.trim()).filter(Boolean);
      if (!jmena.length) { vys.textContent = 'Napiš nějaká jména'; return; }
      if (kolik === 'poradi') {
        const p = [...jmena].sort(() => Math.random() - 0.5);
        vys.textContent = p.map((j, i) => `${i + 1}. ${j}`).join('   ');
        return;
      }
      let k = 0;
      const krok = () => {
        vys.textContent = nahodne(jmena);
        ton(400 + k * 30, 0.03, { hl: 0.3, typ: 'square' });
        if (++k < 18) timery.push(setTimeout(krok, 40 + k * 9));
        else ton(1047, 0.25, { hl: 0.5 });
      };
      krok();
    };
    return el('div.oa-ko-sekce.los', {}, pole, vys, el('div.oa-ko-akce', {},
      tlacitko('Vylosovat jednoho', () => los(1), '.primary'), tlacitko('Náhodné pořadí', () => los('poradi'))));
  }

  function kouleUI() {
    const otazka = el('input.oa-vstup.oa-ko-otazka', { placeholder: 'Zeptej se na otázku s odpovědí ano/ne…' });
    const okno = el('div.oa-ko-okno', { text: '8' });
    const koule = el('button.oa-ko-koule', {}, okno);
    const zatres = () => {
      if (!otazka.value.trim()) { otazka.focus(); otazka.placeholder = 'Nejdřív otázku 🙂'; return; }
      koule.classList.remove('tres'); void koule.offsetWidth; koule.classList.add('tres');
      okno.textContent = '…';
      timery.push(setTimeout(() => {
        const q = otazka.value.toLowerCase();
        okno.textContent = /astroos/.test(q) && /(nejlep|super|cool)/.test(q) ? 'Samozřejmě! 💚'
          : /smysl.*život|odpověď na všechno/.test(q) ? '42.' : nahodne(KOULE);
        ton(mezi(500, 700), 0.4, { typ: 'sine', hl: 0.3, doF: 300 });
      }, 900));
    };
    otazka.addEventListener('keydown', (e) => { if (e.key === 'Enter') zatres(); });
    koule.onclick = zatres;
    return el('div.oa-ko-sekce', {}, koule, otazka, el('div.oa-ko-akce', {}, tlacitko('Zatřást', zatres, '.primary')));
  }

  function kresli() {
    lis.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.z === aktivni));
    obsah.replaceChildren({ kostky: kostkyUI, mince: minceUI, los: losUI, koule: kouleUI }[aktivni]());
  }

  body.append(el('div.oa.oa-ko', {}, lis, obsah));
  kresli();
  return () => timery.forEach(clearTimeout);
}

// ================================================================ Morseovka
const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', CH: '----', I: '..', J: '.---',
  K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-',
  V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..', 0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-',
  5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.', '.': '.-.-.-', ',': '--..--', '?': '..--..', '!': '-.-.--',
};
const ZPET = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));
const bezDiakritiky = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');

export function morse(body) {
  const st = nacti('morse', { text: 'AHOJ ASTRO', wpm: 14 });
  const vstup = el('textarea.oa-vstup.oa-mo-vstup', { placeholder: 'Napiš text…' });
  vstup.value = st.text;
  const kod = el('div.oa-mo-kod');
  const svetlo = el('div.oa-mo-svetlo');
  const bPrehraj = tlacitko('▶ Přehrát', prehraj, '.primary');
  const rychlost = el('input', { type: 'range', min: 6, max: 30, value: st.wpm });
  const tap = el('button.oa-mo-tap', { text: 'Ťukej sem (nebo drž mezerník)' });
  const preklad = el('div.oa-mo-preklad');
  const tapKod = el('div.oa-mo-tapkod');
  let prehrava = null, timery = [];

  function zakoduj(t) {
    const slova = bezDiakritiky(t.toUpperCase()).split(/\s+/).filter(Boolean);
    return slova.map((s) => {
      const out = [];
      for (let i = 0; i < s.length; i++) {
        if (s[i] === 'C' && s[i + 1] === 'H') { out.push(MORSE.CH); i++; continue; }
        if (MORSE[s[i]]) out.push(MORSE[s[i]]);
      }
      return out.join(' ');
    }).join(' / ');
  }

  function ukaz() {
    st.text = vstup.value;
    uloz('morse', st);
    kod.textContent = zakoduj(vstup.value) || '—';
  }

  function prehraj() {
    if (prehrava) { zastav(); return; }
    const k = zakoduj(vstup.value);
    if (!k) return;
    const t = 1.2 / st.wpm; // délka tečky v sekundách
    let cas = 0;
    const sos = /^\.\.\. --- \.\.\.$/.test(k);
    svetlo.classList.toggle('sos', sos);
    for (const z of k) {
      if (z === '.' || z === '-') {
        const d = z === '.' ? t : t * 3;
        ton(620, d, { hl: 0.6, zpozdeni: cas, utlum: false });
        timery.push(setTimeout(() => svetlo.classList.add('on'), cas * 1000));
        timery.push(setTimeout(() => svetlo.classList.remove('on'), (cas + d) * 1000));
        cas += d + t;
      } else if (z === ' ') cas += t * 2;
      else if (z === '/') cas += t * 2;
    }
    bPrehraj.textContent = '■ Zastavit';
    prehrava = setTimeout(zastav, cas * 1000 + 100);
  }

  function zastav() {
    clearTimeout(prehrava); prehrava = null;
    timery.forEach(clearTimeout); timery = [];
    svetlo.classList.remove('on');
    bPrehraj.textContent = '▶ Přehrát';
  }

  // ťukání: krátký stisk = tečka, dlouhý = čárka, pauza = konec písmene.
  // Držený tón = krátká pípnutí za sebou, dokud se drží (jeden dlouhý tón by nešel utnout).
  let dole = 0, znak = '', dekodovano = '', pauzaT = null, mezeraT = null, drzet = null;
  const pipni = () => ton(620, 0.08, { hl: 0.5, utlum: false });
  function stiskni() {
    if (dole) return;
    dole = performance.now();
    clearTimeout(pauzaT); clearTimeout(mezeraT);
    tap.classList.add('on'); svetlo.classList.add('on');
    pipni();
    drzet = setInterval(pipni, 70);
  }
  function pust() {
    if (!dole) return;
    const d = performance.now() - dole;
    dole = 0;
    clearInterval(drzet);
    tap.classList.remove('on'); svetlo.classList.remove('on');
    znak += d < 220 ? '.' : '-';
    tapKod.textContent = znak;
    pauzaT = setTimeout(() => {
      dekodovano += ZPET[znak] || '?';
      znak = '';
      tapKod.textContent = '';
      preklad.textContent = dekodovano;
      if (/SOS$/.test(dekodovano)) { svetlo.classList.add('sos'); preklad.textContent += '  🆘 Pomoc je na cestě!'; }
      mezeraT = setTimeout(() => { dekodovano += ' '; }, 900);
    }, 550);
  }

  tap.addEventListener('pointerdown', stiskni);
  tap.addEventListener('pointerup', pust);
  tap.addEventListener('pointerleave', pust);
  const dolu = (e) => { if (e.key === ' ' && e.target !== vstup) { e.preventDefault(); if (!e.repeat) stiskni(); } };
  const nahoru = (e) => { if (e.key === ' ' && e.target !== vstup) pust(); };
  body.addEventListener('keydown', dolu);
  body.addEventListener('keyup', nahoru);

  vstup.oninput = ukaz;
  rychlost.oninput = () => { st.wpm = +rychlost.value; uloz('morse', st); };

  body.append(el('div.oa.oa-mo', {},
    el('div.oa-mo-sloupec', {},
      el('h3', { text: 'Text → Morseovka' }), vstup, kod,
      el('div.oa-mo-akce', {}, bPrehraj, el('label.oa-mo-rych', {}, el('span', { text: 'Rychlost' }), rychlost)),
    ),
    el('div.oa-mo-sloupec', {},
      el('h3', { text: 'Morseovka → text' }), svetlo, tap, tapKod, preklad,
      el('div.oa-mo-tip', { text: 'Krátce = tečka, dlouze = čárka. Chvilka ticha ukončí písmeno.' }),
      tlacitko('Smazat', () => { dekodovano = ''; znak = ''; preklad.textContent = ''; svetlo.classList.remove('sos'); }),
    )));
  ukaz();
  return () => { zastav(); clearInterval(drzet); clearTimeout(pauzaT); clearTimeout(mezeraT); body.removeEventListener('keydown', dolu); body.removeEventListener('keyup', nahoru); };
}
