// AstroOS — Hudba (přehrávač melodií skládaných za běhu přes WebAudio)
//
// Žádné zvukové soubory: každá skladba je seznam not, které se naplánují
// oscilátorům dopředu. Pauza oscilátory zruší a zapamatuje si, kde skončily,
// takže se dá pustit dál od stejného místa.

import { el, clamp, bus, pad } from '../util.js';
import { icon } from '../icons.js';
import { State } from '../state.js';
import * as FS from '../fs.js';

// Česká jména tónů: „h“ je anglické B, „b“ bereme jako totéž.
const PULTONY = { c: 0, 'c#': 1, d: 2, 'd#': 3, e: 4, f: 5, 'f#': 6, g: 7, 'g#': 8, a: 9, 'a#': 10, h: 11, b: 11 };

function frekvence(nota) {
  const m = /^([a-h]#?)(\d)$/.exec(nota);
  if (!m) return 0;
  return 440 * 2 ** ((PULTONY[m[1]] - 9) / 12 + (+m[2] - 4));
}

/** Zápis „c4:2 e4 g4 p:4“ → [[nota, doby], …]; výchozí délka je jedna doba. */
function noty(zapis) {
  return zapis.trim().split(/\s+/).map((kus) => {
    const [t, d] = kus.split(':');
    return [t, d ? +d : 1];
  });
}

const SKLADBY = [
  {
    id: 'astro', name: 'Astro téma', autor: 'AstroOS', tempo: 120, typ: 'triangle',
    melodie: noty(`c5:1 e5:1 g5:2 f5:1 e5:1 d5:2 c5:1 e5:1 a5:2 g5:2
                   c5:1 e5:1 g5:2 f5:1 a5:1 g5:2 e5:1 d5:1 c5:4`),
    bas: noty(`c3:2 c3:2 f3:2 g3:2 a2:2 a2:2 g3:2 g3:2
               c3:2 c3:2 f3:2 f3:2 g3:2 c3:4`),
  },
  {
    id: 'rano', name: 'Ranní start', autor: 'AstroOS', tempo: 96, typ: 'sine',
    melodie: noty(`g4:2 a4:1 h4:1 d5:2 h4:2 c5:1 d5:1 e5:2 d5:2
                   g4:2 a4:1 h4:1 d5:2 g5:2 e5:1 d5:1 c5:2 g4:2`),
    bas: noty(`g2:4 e2:4 c3:4 d3:4 g2:4 e2:4 a2:4 g2:4`),
  },
  {
    id: 'noc', name: 'Noční režim', autor: 'AstroOS', tempo: 72, typ: 'sine',
    melodie: noty(`a4:2 c5:2 e5:3 d5:1 c5:4 a4:2 g4:2 a4:4
                   f4:2 a4:2 c5:3 h4:1 a4:4 e4:4`),
    bas: noty(`a2:4 a2:4 f2:4 e2:4 d3:4 a2:4`),
  },
  {
    id: 'chip', name: 'Chiptune procházka', autor: 'AstroOS', tempo: 150, typ: 'square',
    melodie: noty(`c5 e5 g5 e5 c5 e5 g5 c6 h5 g5 d5 g5 h5 g5 d5 h4
                   c5 e5 g5 e5 a5 f5 c5 f5 g5 h5 d6:2 g5:2`),
    bas: noty(`c3:2 c3:2 g2:2 g2:2 a2:2 f2:2 c3:2 g2:2`),
  },
  {
    id: 'oda', name: 'Óda na radost', autor: 'Ludwig van Beethoven', tempo: 108, typ: 'triangle',
    melodie: noty(`e5 e5 f5 g5 g5 f5 e5 d5 c5 c5 d5 e5 e5:1.5 d5:0.5 d5:2
                   e5 e5 f5 g5 g5 f5 e5 d5 c5 c5 d5 e5 d5:1.5 c5:0.5 c5:2`),
    bas: noty(`c3:2 g2:2 c3:2 g2:2 a2:2 e3:2 g2:2 c3:2
               c3:2 g2:2 c3:2 g2:2 a2:2 e3:2 g2:2 c3:2`),
  },
];

const delkaSkladby = (s) => (s.melodie.reduce((a, [, d]) => a + d, 0) * 60) / s.tempo;
const cas = (sek) => `${Math.floor(sek / 60)}:${pad(Math.round(sek % 60))}`;

export const hudbaApp = {
  id: 'music', name: 'Hudba', icon: 'music', color: 'linear-gradient(145deg,#f07f9c,#c04a6a)',
  cat: 'media', width: 760, height: 560,

  mount(body, win) {
    const st = { i: 0, hraje: false, odkud: 0, start: 0, dokola: State.get('hudbaDokola') !== false, zdroje: [] };
    win.hudba = st;

    let ctx = null, mistr = null, analyzer = null, kresba = null, tikac = null;

    function zvukovyKontext() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        mistr = ctx.createGain();
        analyzer = ctx.createAnalyser();
        analyzer.fftSize = 128;
        mistr.connect(analyzer).connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
      mistr.gain.value = hlasitost();
      return ctx;
    }

    const hlasitost = () => (State.get('zvuky') === false ? 0 : ((State.get('volume') ?? 62) / 100) * 0.3);

    // ---------------------------------------------------------------- přehrávání
    function naplanuj(hlas, poleNot, typ, tempo, odkud, hlasitostiPomer) {
      const doba = 60 / tempo;
      let t = 0;
      for (const [nota, delka] of poleNot) {
        const zacatek = t;
        t += delka * doba;
        if (nota === 'p') continue;
        if (t <= odkud) continue;                       // nota už zazněla
        const f = frekvence(nota);
        if (!f) continue;
        const kdy = ctx.currentTime + Math.max(0, zacatek - odkud);
        const trvani = Math.min(delka * doba, t - odkud) * 0.92;

        const osc = ctx.createOscillator();
        const zes = ctx.createGain();
        osc.type = typ;
        osc.frequency.setValueAtTime(f, kdy);
        zes.gain.setValueAtTime(0.0001, kdy);
        zes.gain.exponentialRampToValueAtTime(hlasitostiPomer, kdy + 0.02);
        zes.gain.exponentialRampToValueAtTime(0.0001, kdy + trvani);
        osc.connect(zes).connect(hlas);
        osc.start(kdy);
        osc.stop(kdy + trvani + 0.05);
        st.zdroje.push(osc);
      }
    }

    function hraj(odkud = 0) {
      const a = zvukovyKontext();
      if (!a) return;
      utni();
      const s = SKLADBY[st.i];
      st.odkud = odkud;
      st.start = a.currentTime;
      st.hraje = true;
      naplanuj(mistr, s.melodie, s.typ, s.tempo, odkud, 0.9);
      if (s.bas) naplanuj(mistr, s.bas, 'sine', s.tempo, odkud, 0.5);
      kresliStav();
      spustSmycku();
    }

    function utni() {
      for (const o of st.zdroje) { try { o.stop(); } catch { /* už doběhl */ } }
      st.zdroje = [];
    }

    function pauza() {
      if (!st.hraje) return;
      st.odkud = pozice();
      st.hraje = false;
      utni();
      kresliStav();
    }

    const pozice = () => (st.hraje && ctx ? st.odkud + (ctx.currentTime - st.start) : st.odkud);

    function prepni(i, hned = true) {
      utni();
      st.i = (i + SKLADBY.length) % SKLADBY.length;
      st.odkud = 0;
      kresliSeznam();
      if (hned) hraj(0); else { st.hraje = false; kresliStav(); }
      win.title = `${SKLADBY[st.i].name} — Hudba`;
    }

    function spustSmycku() {
      clearInterval(tikac);
      tikac = setInterval(() => {
        const p = pozice();
        const d = delkaSkladby(SKLADBY[st.i]);
        if (st.hraje && p >= d) {
          if (st.dokola) return hraj(0);
          if (st.i < SKLADBY.length - 1) return prepni(st.i + 1);
          st.hraje = false; st.odkud = 0; kresliStav();
          return;
        }
        kresliCas();
      }, 200);
    }

    // ---------------------------------------------------------------- vzhled
    const seznamEl = el('div.hu-seznam');
    const nazevEl = el('div.hu-nazev');
    const autorEl = el('div.hu-autor');
    const casEl = el('div.hu-cas');
    const pruh = el('div.hu-pruh', {}, el('i'));
    const vizual = el('canvas.hu-vizual', { width: 520, height: 90 });
    const vx = vizual.getContext('2d');

    const bHraj = el('button.hu-hlavni', { title: 'Přehrát / pauza' }, icon('play'));
    const bPred = el('button.hu-ovl', { title: 'Předchozí', onclick: () => prepni(st.i - 1) }, icon('chevronLeft'));
    const bDalsi = el('button.hu-ovl', { title: 'Další', onclick: () => prepni(st.i + 1) }, icon('chevronRight'));
    const bDokola = el('button.hu-ovl', { title: 'Dokola' }, icon('refresh'));

    bHraj.onclick = () => (st.hraje ? pauza() : hraj(st.odkud));
    bDokola.onclick = () => {
      st.dokola = !st.dokola;
      State.set('hudbaDokola', st.dokola);
      bDokola.classList.toggle('on', st.dokola);
    };
    bDokola.classList.toggle('on', st.dokola);

    pruh.onclick = (e) => {
      const r = pruh.getBoundingClientRect();
      const podil = clamp((e.clientX - r.left) / r.width, 0, 0.999);
      const kam = podil * delkaSkladby(SKLADBY[st.i]);
      if (st.hraje) hraj(kam); else { st.odkud = kam; kresliCas(); }
    };

    function kresliSeznam() {
      seznamEl.replaceChildren(...SKLADBY.map((s, i) => {
        const r = el('button.hu-radek' + (i === st.i ? '.on' : ''), {},
          el('span.hu-poradi', {}, i === st.i && st.hraje ? icon('volume') : el('span', { text: String(i + 1) })),
          el('span.hu-jmeno', {}, el('b', { text: s.name }), el('i', { text: s.autor })),
          el('span.hu-delka', { text: cas(delkaSkladby(s)) }),
        );
        r.onclick = () => prepni(i);
        return r;
      }));
    }

    function kresliStav() {
      const s = SKLADBY[st.i];
      nazevEl.textContent = s.name;
      autorEl.textContent = `${s.autor} · ${s.tempo} BPM · ${s.typ === 'square' ? 'hranatá vlna' : s.typ === 'triangle' ? 'trojúhelníková vlna' : 'sinus'}`;
      bHraj.replaceChildren(icon(st.hraje ? 'pause' : 'play'));
      kresliSeznam();
      kresliCas();
    }

    function kresliCas() {
      const d = delkaSkladby(SKLADBY[st.i]);
      const p = clamp(pozice(), 0, d);
      casEl.textContent = `${cas(p)} / ${cas(d)}`;
      pruh.firstChild.style.width = `${(p / d) * 100}%`;
    }

    function kresliVizual() {
      kresba = requestAnimationFrame(kresliVizual);
      const w = vizual.width, h = vizual.height;
      vx.clearRect(0, 0, w, h);
      if (!analyzer) return;
      const data = new Uint8Array(analyzer.frequencyBinCount);
      analyzer.getByteFrequencyData(data);
      const pocet = 28;
      const sirka = w / pocet;
      for (let i = 0; i < pocet; i++) {
        const v = data[i] / 255;
        const vyska = Math.max(3, v * h);
        vx.fillStyle = `rgba(70, 195, 111, ${0.25 + v * 0.75})`;
        vx.fillRect(i * sirka + 2, h - vyska, sirka - 4, vyska);
      }
    }

    body.append(el('div.hu', {},
      el('div.hu-prehravac', {},
        vizual,
        el('div.hu-info', {}, nazevEl, autorEl),
        el('div.hu-radka', {}, casEl, pruh),
        el('div.hu-ovladani', {}, bDokola, bPred, bHraj, bDalsi),
      ),
      el('div.hu-knihovna', {},
        el('div.hu-hlavicka', { text: `Knihovna · ${SKLADBY.length} skladeb` }),
        seznamEl,
      ),
    ));

    const offHlas = bus.on('state:volume', () => { if (mistr) mistr.gain.value = hlasitost(); });

    kresliStav();
    kresliVizual();
    win.title = `${SKLADBY[st.i].name} — Hudba`;

    // playlist na disk, ať je co číst v Souborech i terminálu
    try {
      if (FS.exists(FS.HOME + '/Hudba')) {
        FS.write(FS.HOME + '/Hudba/playlist.txt',
          SKLADBY.map((s, i) => `${i + 1}. ${s.name} — ${s.autor} (${cas(delkaSkladby(s))})`).join('\n') + '\n');
      }
    } catch { /* plný disk nevadí */ }

    win.onClose = () => {
      utni();
      clearInterval(tikac);
      cancelAnimationFrame(kresba);
      offHlas();
      ctx?.close?.();
    };
  },

  unmount(win) { win.onClose?.(); },
};
