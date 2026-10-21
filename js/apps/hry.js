// AstroOS — Hry (Had, 2048 a Miny v jednom okně)
//
// Každá hra si po sobě uklidí: `spust()` vrátí funkci, která zruší časovače
// a posluchače. Rekordy se ukládají do nastavení, takže přežijí restart.

import { el, clamp, plural } from '../util.js';
import { icon } from '../icons.js';
import { State } from '../state.js';
import { zvuk } from '../zvuk.js';

const REKORDY = 'hryRekordy';

const rekord = (id) => (State.get(REKORDY) || {})[id] || 0;
function zapisRekord(id, skore) {
  if (skore <= rekord(id)) return false;
  State.set(REKORDY, { ...(State.get(REKORDY) || {}), [id]: skore });
  return true;
}

const HRY = [
  { id: 'had', name: 'Had', popis: 'Sbírej jablka a nenaraž do sebe. Šipky nebo WASD.', barva: '#54d98a' },
  { id: 'dva', name: '2048', popis: 'Posouvej dlaždice šipkami a slučuj stejná čísla.', barva: '#f0b95c' },
  { id: 'miny', name: 'Miny', popis: 'Odkryj políčka a vyhni se minám. Pravým dáš vlajku.', barva: '#6aa9f0' },
];

export const hryApp = {
  id: 'games', name: 'Hry', icon: 'game', color: 'linear-gradient(145deg,#54d98a,#2b9b53)',
  cat: 'media', width: 720, height: 700,

  mount(body, win) {
    const plocha = el('div.hr-plocha');
    const nadpis = el('div.hr-nazev', { text: 'Hry' });
    const skoreEl = el('div.hr-skore');
    const bZpet = el('button.hr-btn.hidden', {}, icon('chevronLeft'), el('span', { text: 'Zpět na výběr' }));
    const bZnovu = el('button.hr-btn.hidden', {}, icon('refresh'), el('span', { text: 'Znovu' }));

    let uklid = null;
    let ktera = null;

    function konecHry() {
      uklid?.();
      uklid = null;
    }

    function menu() {
      konecHry();
      ktera = null;
      win.title = 'Hry';
      nadpis.textContent = 'Hry';
      skoreEl.textContent = '';
      bZpet.classList.add('hidden');
      bZnovu.classList.add('hidden');
      plocha.replaceChildren(el('div.hr-menu', {}, HRY.map((h) => {
        const k = el('button.hr-karta', { style: { '--barva': h.barva } },
          el('div.hr-ikona', {}, icon('game')),
          el('h3', { text: h.name }),
          el('p', { text: h.popis }),
          el('div.hr-rekord', { text: rekord(h.id) ? `Rekord ${rekord(h.id)}` : 'Zatím bez rekordu' }),
        );
        k.onclick = () => spust(h.id);
        return k;
      })));
    }

    function spust(id) {
      konecHry();
      ktera = id;
      const h = HRY.find((x) => x.id === id);
      nadpis.textContent = h.name;
      win.title = `${h.name} — Hry`;
      bZpet.classList.remove('hidden');
      bZnovu.classList.remove('hidden');
      plocha.replaceChildren();
      uklid = ({ had: hraHad, dva: hra2048, miny: hraMiny }[id])(plocha, skoreEl, body);
      body.focus();
    }

    bZpet.onclick = menu;
    bZnovu.onclick = () => ktera && spust(ktera);

    body.append(el('div.hr', {},
      el('div.hr-bar', {}, nadpis, el('div.hr-spacer'), skoreEl, bZnovu, bZpet),
      plocha,
    ));
    body.tabIndex = 0;
    menu();
    setTimeout(() => body.focus(), 60);

    win.onClose = konecHry;
  },

  unmount(win) { win.onClose?.(); },
};

// ---------------------------------------------------------------- Had
function hraHad(plocha, skoreEl, body) {
  const POLE = 20, BUNKA = 21;
  const cv = el('canvas.hr-canvas', { width: POLE * BUNKA, height: POLE * BUNKA });
  const cx = cv.getContext('2d');
  const hlaska = el('div.hr-hlaska.hidden');
  plocha.append(el('div.hr-stred', {}, cv, hlaska));

  let had, smer, dalsiSmer, jablko, skore, bezi, tik, rychlost;

  function nova() {
    had = [{ x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }];
    smer = { x: 1, y: 0 };
    dalsiSmer = smer;
    skore = 0;
    rychlost = 130;
    bezi = true;
    hlaska.classList.add('hidden');
    poloz();
    naplanuj();
    kresli();
  }

  function poloz() {
    do {
      jablko = { x: Math.floor(Math.random() * POLE), y: Math.floor(Math.random() * POLE) };
    } while (had.some((s) => s.x === jablko.x && s.y === jablko.y));
  }

  function naplanuj() {
    clearTimeout(tik);
    if (bezi) tik = setTimeout(krok, rychlost);
  }

  function krok() {
    smer = dalsiSmer;
    const hlava = { x: had[0].x + smer.x, y: had[0].y + smer.y };
    if (hlava.x < 0 || hlava.y < 0 || hlava.x >= POLE || hlava.y >= POLE
      || had.some((s) => s.x === hlava.x && s.y === hlava.y)) return konec();

    had.unshift(hlava);
    if (hlava.x === jablko.x && hlava.y === jablko.y) {
      skore += 10;
      rychlost = Math.max(60, rychlost - 3);
      zvuk('klik');
      poloz();
    } else {
      had.pop();
    }
    ukazSkore();
    kresli();
    naplanuj();
  }

  function konec() {
    bezi = false;
    clearTimeout(tik);
    zvuk('chyba');
    const novy = zapisRekord('had', skore);
    hlaska.classList.remove('hidden');
    hlaska.replaceChildren(
      el('b', { text: 'Konec hry' }),
      el('span', { text: `Získal jsi ${skore} ${plural(skore / 10, ['jablko', 'jablka', 'jablek'])}.` }),
      novy ? el('span.hr-novy', { text: 'Nový rekord!' }) : null,
      el('button.hr-btn.primary', { text: 'Hrát znovu', onclick: nova }),
    );
  }

  const ukazSkore = () => { skoreEl.textContent = `Skóre ${skore} · rekord ${Math.max(skore, rekord('had'))}`; };

  function kresli() {
    cx.fillStyle = '#0d1418';
    cx.fillRect(0, 0, cv.width, cv.height);
    cx.strokeStyle = 'rgba(255,255,255,0.04)';
    for (let i = 1; i < POLE; i++) {
      cx.beginPath(); cx.moveTo(i * BUNKA, 0); cx.lineTo(i * BUNKA, cv.height); cx.stroke();
      cx.beginPath(); cx.moveTo(0, i * BUNKA); cx.lineTo(cv.width, i * BUNKA); cx.stroke();
    }
    cx.fillStyle = '#ef6a5a';
    cx.beginPath();
    cx.arc(jablko.x * BUNKA + BUNKA / 2, jablko.y * BUNKA + BUNKA / 2, BUNKA / 2 - 3, 0, Math.PI * 2);
    cx.fill();
    had.forEach((s, i) => {
      cx.fillStyle = i === 0 ? '#7ae8a8' : `rgba(84,217,138,${clamp(0.85 - i * 0.02, 0.35, 0.85)})`;
      cx.fillRect(s.x * BUNKA + 2, s.y * BUNKA + 2, BUNKA - 4, BUNKA - 4);
    });
  }

  const klavesy = {
    ArrowUp: { x: 0, y: -1 }, w: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 }, s: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 }, a: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 },
  };

  const klavesa = (e) => {
    const k = klavesy[e.key] || klavesy[e.key.toLowerCase()];
    if (!k) {
      if (e.key === ' ' && !bezi) { e.preventDefault(); nova(); }
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (k.x === -smer.x && k.y === -smer.y) return;   // couvnout do sebe nejde
    dalsiSmer = k;
  };
  body.addEventListener('keydown', klavesa);

  nova();
  ukazSkore();
  return () => { clearTimeout(tik); body.removeEventListener('keydown', klavesa); };
}

// ---------------------------------------------------------------- 2048
function hra2048(plocha, skoreEl, body) {
  const N = 4;
  let deska, skore, konec;
  const mrizka = el('div.hr-2048');
  const hlaska = el('div.hr-hlaska.hidden');
  plocha.append(el('div.hr-stred', {}, mrizka, hlaska));

  function nova() {
    deska = Array(N * N).fill(0);
    skore = 0;
    konec = false;
    hlaska.classList.add('hidden');
    pridej(); pridej();
    kresli();
  }

  function pridej() {
    const volna = deska.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
    if (!volna.length) return;
    deska[volna[Math.floor(Math.random() * volna.length)]] = Math.random() < 0.9 ? 2 : 4;
  }

  /** Jeden řádek zleva: sesype čísla k sobě a sloučí sousední dvojice. */
  function slozRadek(r) {
    const a = r.filter(Boolean);
    for (let i = 0; i < a.length - 1; i++) {
      if (a[i] === a[i + 1]) { a[i] *= 2; skore += a[i]; a.splice(i + 1, 1); }
    }
    while (a.length < N) a.push(0);
    return a;
  }

  const indexy = (smer, i) => Array.from({ length: N }, (_, j) => {
    if (smer === 'l') return i * N + j;
    if (smer === 'r') return i * N + (N - 1 - j);
    if (smer === 'u') return j * N + i;
    return (N - 1 - j) * N + i;
  });

  function posun(smer) {
    if (konec) return;
    let zmena = false;
    for (let i = 0; i < N; i++) {
      const idx = indexy(smer, i);
      const puvodni = idx.map((k) => deska[k]);
      const novy = slozRadek(puvodni);
      novy.forEach((v, j) => {
        if (deska[idx[j]] !== v) zmena = true;
        deska[idx[j]] = v;
      });
    }
    if (!zmena) return;
    zvuk('klik');
    pridej();
    kresli();
    if (!lzeTahnout()) dokonceno();
  }

  function lzeTahnout() {
    if (deska.includes(0)) return true;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const v = deska[y * N + x];
        if (x < N - 1 && v === deska[y * N + x + 1]) return true;
        if (y < N - 1 && v === deska[(y + 1) * N + x]) return true;
      }
    }
    return false;
  }

  function dokonceno() {
    konec = true;
    zvuk('chyba');
    const novy = zapisRekord('dva', skore);
    hlaska.classList.remove('hidden');
    hlaska.replaceChildren(
      el('b', { text: 'Už není kam táhnout' }),
      el('span', { text: `Skóre ${skore}.` }),
      novy ? el('span.hr-novy', { text: 'Nový rekord!' }) : null,
      el('button.hr-btn.primary', { text: 'Hrát znovu', onclick: nova }),
    );
  }

  function kresli() {
    skoreEl.textContent = `Skóre ${skore} · rekord ${Math.max(skore, rekord('dva'))}`;
    mrizka.replaceChildren(...deska.map((v) => el('div.hr-dlazdice' + (v ? '.plna' : ''),
      { dataset: { v: String(v) } }, v ? String(v) : '')));
  }

  const klavesa = (e) => {
    const smer = { ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'd', a: 'l', d: 'r', w: 'u', s: 'd' }[e.key] ||
      { a: 'l', d: 'r', w: 'u', s: 'd' }[e.key.toLowerCase()];
    if (!smer) return;
    e.preventDefault();
    e.stopPropagation();
    posun(smer);
  };
  body.addEventListener('keydown', klavesa);

  nova();
  return () => body.removeEventListener('keydown', klavesa);
}

// ---------------------------------------------------------------- Miny
function hraMiny(plocha, skoreEl) {
  const W = 9, H = 9, MIN = 10;
  let pole, odkryto, konec, prvni, cas, tik;
  const mrizka = el('div.hr-miny');
  const hlaska = el('div.hr-hlaska.hidden');
  plocha.append(el('div.hr-stred', {}, mrizka, hlaska));

  const soused = (i) => {
    const x = i % W, y = (i / W) | 0;
    const out = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H) out.push(ny * W + nx);
      }
    }
    return out;
  };

  function nova() {
    pole = Array.from({ length: W * H }, () => ({ mina: false, odkryta: false, vlajka: false, cislo: 0 }));
    odkryto = 0;
    konec = false;
    prvni = true;
    cas = 0;
    clearInterval(tik);
    hlaska.classList.add('hidden');
    kresli();
  }

  function rozmisti(mimo) {
    const zakazane = new Set([mimo, ...soused(mimo)]);
    let polozeno = 0;
    while (polozeno < MIN) {
      const i = Math.floor(Math.random() * W * H);
      if (pole[i].mina || zakazane.has(i)) continue;
      pole[i].mina = true;
      polozeno++;
    }
    pole.forEach((b, i) => { b.cislo = soused(i).filter((j) => pole[j].mina).length; });
    tik = setInterval(() => { cas++; ukazStav(); }, 1000);
  }

  function odkryj(i) {
    const b = pole[i];
    if (konec || b.odkryta || b.vlajka) return;
    if (prvni) { prvni = false; rozmisti(i); }
    b.odkryta = true;
    odkryto++;
    if (b.mina) return dokonceno(false);
    if (b.cislo === 0) soused(i).forEach(odkryj);
    if (odkryto >= W * H - MIN) dokonceno(true);
  }

  function dokonceno(vyhra) {
    konec = true;
    clearInterval(tik);
    zvuk(vyhra ? 'prihlaseni' : 'chyba');
    if (!vyhra) pole.forEach((b) => { if (b.mina) b.odkryta = true; });
    let novy = false;
    if (vyhra) {
      const bodu = Math.max(10, 600 - cas * 5);
      novy = zapisRekord('miny', bodu);
    }
    kresli();
    hlaska.classList.remove('hidden');
    hlaska.replaceChildren(
      el('b', { text: vyhra ? 'Vyčištěno!' : 'Bouch.' }),
      el('span', { text: vyhra ? `Zvládls to za ${cas} s.` : 'Šlápls na minu.' }),
      novy ? el('span.hr-novy', { text: 'Nový rekord!' }) : null,
      el('button.hr-btn.primary', { text: 'Hrát znovu', onclick: nova }),
    );
  }

  const ukazStav = () => {
    const vlajky = pole.filter((b) => b.vlajka).length;
    skoreEl.textContent = `Miny ${MIN - vlajky} · čas ${cas} s · rekord ${rekord('miny')}`;
  };

  function kresli() {
    ukazStav();
    mrizka.replaceChildren(...pole.map((b, i) => {
      const t = el('button.hr-bunka' + (b.odkryta ? '.odkryta' : '') + (b.mina && b.odkryta ? '.mina' : ''),
        { dataset: { c: String(b.cislo) } },
        b.odkryta ? (b.mina ? '✳' : (b.cislo || '')) : (b.vlajka ? '⚑' : ''));
      t.onclick = () => { odkryj(i); kresli(); };
      t.oncontextmenu = (e) => {
        e.preventDefault();
        if (konec || b.odkryta) return;
        b.vlajka = !b.vlajka;
        kresli();
      };
      return t;
    }));
  }

  nova();
  return () => clearInterval(tik);
}
