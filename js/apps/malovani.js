// AstroOS — Malování (kreslení na plátno a ukládání na virtuální disk jako PNG)
//
// Dvě plátna přes sebe: spodní drží hotový obrázek, horní slouží jako náhled
// rozkreslených tvarů a chytá myš. Levé tlačítko kreslí první barvou,
// pravé druhou — stejně jako ve Windows.

import { el, clamp } from '../util.js';
import { icon } from '../icons.js';
import * as FS from '../fs.js';
import { toast, contextMenu } from '../ui.js';
import { State } from '../state.js';
import { applyWallpaper } from '../wallpapers.js';

const OBRAZKY = FS.HOME + '/Obrázky';
const MAX_KROKU = 24;          // kolik kroků si pamatuje zpět/vpřed
const MAX_W = 2400, MAX_H = 1600;

const PALETA = [
  '#000000', '#7f7f7f', '#880015', '#ed1c24', '#ff7f27', '#fff200', '#22b14c', '#00a2e8', '#3f48cc', '#a349a4',
  '#ffffff', '#c3c3c3', '#b97a57', '#ffaec9', '#ffc90e', '#efe4b0', '#b5e61d', '#99d9ea', '#7092be', '#c8bfe7',
];

const NASTROJE = [
  { id: 'tuzka', name: 'Tužka', ikona: 'pencil' },
  { id: 'stetec', name: 'Štětec', ikona: 'brush' },
  { id: 'guma', name: 'Guma', ikona: 'eraser' },
  { id: 'vypln', name: 'Plechovka', ikona: 'fill' },
  { id: 'kapatko', name: 'Kapátko', ikona: 'pipette' },
  { id: 'cara', name: 'Čára', ikona: 'line' },
  { id: 'obdelnik', name: 'Obdélník', ikona: 'rect' },
  { id: 'elipsa', name: 'Elipsa', ikona: 'circle' },
];

const TVARY = ['cara', 'obdelnik', 'elipsa'];

export const malovaniApp = {
  id: 'malovani', name: 'Malování', icon: 'brush', color: 'linear-gradient(145deg,#f07f9c,#c04a6a)',
  cat: 'media', width: 960, height: 680,

  mount(body, win) {
    const st = {
      w: 760, h: 500,
      path: null, dirty: false,
      nastroj: 'stetec', sirka: 6,
      barva: '#000000', barva2: '#ffffff',
      vyplnit: false,
      undo: [], redo: [],
      tah: null,                 // rozkreslený tah
      obnovuje: false,           // probíhá načítání snímku (zpět/vpřed)
    };
    win.paint = st;

    // ---------------------------------------------------------------- plátno
    const cv = el('canvas.pt-cv');
    const ov = el('canvas.pt-ov');
    const cx = cv.getContext('2d', { willReadFrequently: true });
    const ox = ov.getContext('2d');
    const paper = el('div.pt-paper', {}, cv, ov);
    const stage = el('div.pt-stage', {}, paper);

    /** Nastaví rozměr plátna a vybílí ho; volitelně přenese starý obsah. */
    function rozmer(w, h, zachovat = false) {
      const novaW = clamp(Math.round(w), 16, MAX_W);
      const novaH = clamp(Math.round(h), 16, MAX_H);
      const stary = zachovat && cv.width
        ? cx.getImageData(0, 0, Math.min(cv.width, novaW), Math.min(cv.height, novaH))
        : null;
      st.w = novaW; st.h = novaH;
      for (const c of [cv, ov]) {
        c.width = st.w; c.height = st.h;
        c.style.width = st.w + 'px'; c.style.height = st.h + 'px';
      }
      cx.fillStyle = '#ffffff';
      cx.fillRect(0, 0, st.w, st.h);
      if (stary) cx.putImageData(stary, 0, 0);
      cx.lineCap = 'round';
      cx.lineJoin = 'round';
      stav();
    }

    // ---------------------------------------------------------------- zpět / vpřed
    const snimek = () => cv.toDataURL('image/png');

    function zapamatuj() {
      st.undo.push(snimek());
      if (st.undo.length > MAX_KROKU) st.undo.shift();
      st.redo.length = 0;
      stav();
    }

    function nakresliSnimek(url) {
      return new Promise((hotovo) => {
        const img = new Image();
        img.onload = () => {
          rozmer(img.naturalWidth, img.naturalHeight);
          cx.drawImage(img, 0, 0);
          hotovo(true);
        };
        img.onerror = () => hotovo(false);
        img.src = url;
      });
    }

    // Načtení snímku je asynchronní (Image.onload), takže kroky řadíme za sebe.
    // Bez fronty by rychlé klikání na Zpět většinu kroků zahodilo.
    let fronta = Promise.resolve();
    const vRade = (krok) => { fronta = fronta.then(krok).catch(() => {}); return fronta; };

    const zpet = () => vRade(async () => {
      if (!st.undo.length) return;
      st.obnovuje = true;
      st.redo.push(snimek());
      await nakresliSnimek(st.undo.pop());
      st.obnovuje = false;
      spinavy(true);
      stav();
    });

    const vpred = () => vRade(async () => {
      if (!st.redo.length) return;
      st.obnovuje = true;
      st.undo.push(snimek());
      await nakresliSnimek(st.redo.pop());
      st.obnovuje = false;
      spinavy(true);
      stav();
    });

    // ---------------------------------------------------------------- kreslení
    const bod = (e) => {
      const r = ov.getBoundingClientRect();
      return {
        x: (e.clientX - r.left) * (st.w / r.width),
        y: (e.clientY - r.top) * (st.h / r.height),
      };
    };

    /** Barva podle stisknutého tlačítka — pravé kreslí druhou barvou. */
    const barvaTahu = (e) => (e.button === 2 || e.buttons === 2 ? st.barva2 : st.barva);

    function pripravCtx(ctx, barva) {
      ctx.strokeStyle = barva;
      ctx.fillStyle = barva;
      ctx.lineWidth = st.nastroj === 'tuzka' ? 1 : st.sirka;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }

    const hexNaRgb = (hex) => {
      const n = parseInt(hex.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };

    ov.oncontextmenu = (e) => e.preventDefault();

    ov.onpointerdown = (e) => {
      if (st.obnovuje) return;
      e.preventDefault();
      body.focus();
      const p = bod(e);
      const barva = barvaTahu(e);

      if (st.nastroj === 'kapatko') {
        const d = cx.getImageData(clamp(p.x | 0, 0, st.w - 1), clamp(p.y | 0, 0, st.h - 1), 1, 1).data;
        const hex = '#' + [d[0], d[1], d[2]].map((n) => n.toString(16).padStart(2, '0')).join('');
        if (e.button === 2) st.barva2 = hex; else st.barva = hex;
        kresliBarvy();
        return;
      }

      if (st.nastroj === 'vypln') {
        zapamatuj();
        if (vyplnit(p.x | 0, p.y | 0, barva)) spinavy(true);
        else { st.undo.pop(); stav(); }
        return;
      }

      zapamatuj();
      try { ov.setPointerCapture(e.pointerId); } catch { /* třeba už není co chytat */ }
      st.tah = { od: p, na: p, barva, tvar: TVARY.includes(st.nastroj) };

      if (!st.tah.tvar) {
        // guma maluje druhou barvou, jako ve Windows
        pripravCtx(cx, st.nastroj === 'guma' ? st.barva2 : barva);
        cx.beginPath();
        cx.moveTo(p.x, p.y);
        cx.lineTo(p.x + 0.01, p.y + 0.01);
        cx.stroke();
      }
    };

    ov.onpointermove = (e) => {
      const p = bod(e);
      poloha.textContent = `${p.x | 0}, ${p.y | 0} px`;
      if (!st.tah) return;

      if (st.tah.tvar) {
        st.tah.na = p;
        ox.clearRect(0, 0, st.w, st.h);
        nakresliTvar(ox, st.tah, e.shiftKey);
      } else {
        cx.lineTo(p.x, p.y);
        cx.stroke();
        st.tah.na = p;
      }
    };

    const konecTahu = (e) => {
      if (!st.tah) return;
      if (st.tah.tvar) {
        ox.clearRect(0, 0, st.w, st.h);
        nakresliTvar(cx, st.tah, e?.shiftKey);
      }
      st.tah = null;
      spinavy(true);
    };
    ov.onpointerup = konecTahu;
    ov.onpointercancel = konecTahu;
    ov.onpointerleave = () => { poloha.textContent = ''; };

    /** Čára, obdélník nebo elipsa; se Shiftem čtverec, kruh a úhly po 45°. */
    function nakresliTvar(ctx, tah, shift) {
      const od = tah.od;
      let na = tah.na;
      pripravCtx(ctx, tah.barva);

      if (shift && st.nastroj === 'cara') {
        const dx = na.x - od.x, dy = na.y - od.y;
        const uhel = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
        const d = Math.hypot(dx, dy);
        na = { x: od.x + Math.cos(uhel) * d, y: od.y + Math.sin(uhel) * d };
      } else if (shift) {
        const s = Math.max(Math.abs(na.x - od.x), Math.abs(na.y - od.y));
        na = { x: od.x + Math.sign(na.x - od.x || 1) * s, y: od.y + Math.sign(na.y - od.y || 1) * s };
      }

      ctx.beginPath();
      if (st.nastroj === 'cara') {
        ctx.moveTo(od.x, od.y);
        ctx.lineTo(na.x, na.y);
      } else if (st.nastroj === 'obdelnik') {
        ctx.rect(Math.min(od.x, na.x), Math.min(od.y, na.y), Math.abs(na.x - od.x), Math.abs(na.y - od.y));
      } else {
        ctx.ellipse((od.x + na.x) / 2, (od.y + na.y) / 2,
          Math.abs(na.x - od.x) / 2, Math.abs(na.y - od.y) / 2, 0, 0, Math.PI * 2);
      }
      if (st.vyplnit && st.nastroj !== 'cara') {
        ctx.fillStyle = tah.barva === st.barva ? st.barva2 : st.barva;
        ctx.fill();
      }
      ctx.stroke();
    }

    /** Plechovka — rozlije barvu po souvislé ploše (s malou tolerancí). */
    function vyplnit(x, y, barva) {
      if (x < 0 || y < 0 || x >= st.w || y >= st.h) return false;
      const img = cx.getImageData(0, 0, st.w, st.h);
      const d = img.data;
      const start = (y * st.w + x) * 4;
      const cil = [d[start], d[start + 1], d[start + 2], d[start + 3]];
      const nova = hexNaRgb(barva);
      const rozdil = Math.abs(cil[0] - nova[0]) + Math.abs(cil[1] - nova[1]) + Math.abs(cil[2] - nova[2]);
      if (rozdil < 8 && cil[3] === 255) return false;      // už je tam ta samá barva

      const tol = 28;
      const videno = new Uint8Array(st.w * st.h);
      const fronta = [y * st.w + x];
      while (fronta.length) {
        const p = fronta.pop();
        if (videno[p]) continue;
        videno[p] = 1;
        const i = p * 4;
        if (Math.abs(d[i] - cil[0]) > tol || Math.abs(d[i + 1] - cil[1]) > tol
          || Math.abs(d[i + 2] - cil[2]) > tol || Math.abs(d[i + 3] - cil[3]) > tol) continue;
        d[i] = nova[0]; d[i + 1] = nova[1]; d[i + 2] = nova[2]; d[i + 3] = 255;
        const px = p % st.w, py = (p / st.w) | 0;
        if (px > 0) fronta.push(p - 1);
        if (px < st.w - 1) fronta.push(p + 1);
        if (py > 0) fronta.push(p - st.w);
        if (py < st.h - 1) fronta.push(p + st.w);
      }
      cx.putImageData(img, 0, 0);
      return true;
    }

    // ---------------------------------------------------------------- soubor
    function spinavy(v) {
      st.dirty = v;
      nazev();
    }

    function nazev() {
      const jmeno = st.path ? FS.basename(st.path) : 'Bez názvu';
      jmenoEl.textContent = (st.dirty ? '• ' : '') + jmeno;
      jmenoEl.title = st.path || 'Zatím neuloženo';
      win.title = (st.dirty ? '• ' : '') + jmeno + ' — Malování';
    }

    function novy() {
      zapamatuj();
      rozmer(760, 500);
      st.path = null;
      spinavy(false);
    }

    function nacti(path) {
      const src = FS.imageSrc(path);
      if (!src) return toast({ title: 'Tohle otevřít neumím', body: FS.basename(path), icon: 'info' });
      const img = new Image();
      img.onload = () => {
        st.undo.length = 0;
        st.redo.length = 0;
        rozmer(img.naturalWidth, img.naturalHeight);
        cx.drawImage(img, 0, 0, st.w, st.h);
        st.path = FS.normalize(path);
        spinavy(false);
        stav();
      };
      img.onerror = () => toast({ title: 'Obrázek se nenačetl', body: FS.basename(path), icon: 'info' });
      img.src = src;
    }

    function uloz(jinam = false) {
      if (!FS.exists(OBRAZKY)) FS.mkdir(OBRAZKY, { parents: true });
      let path = st.path;
      if (!path || jinam) {
        const zaklad = path ? FS.basename(path) : 'kresba.png';
        path = FS.normalize(OBRAZKY + '/' + FS.freeName(OBRAZKY, zaklad));
      }
      const data = cv.toDataURL('image/png');
      try {
        FS.write(path, data);
      } catch (err) {
        return toast({ title: 'Uložení selhalo', body: err.message, icon: 'info', timeout: 6000 });
      }
      st.path = path;
      spinavy(false);
      stav();
      toast({ title: 'Uloženo', body: `${path} · ${FS.humanSize(data.length)}`, icon: 'check', timeout: 2600 });
    }

    function otevriNabidku(btn) {
      const r = btn.getBoundingClientRect();
      const obrazky = FS.findImages(FS.HOME).slice(0, 20);
      const polozky = obrazky.map((it) => ({ icon: 'image', label: it.name, onClick: () => nacti(it.path) }));
      if (!polozky.length) polozky.push({ icon: 'info', label: 'Na disku není žádný obrázek', disabled: true });
      polozky.push('sep', {
        icon: 'folderOpen', label: 'Procházet v Souborech',
        onClick: () => import('../apps.js').then(({ openApp }) => openApp('files', { path: OBRAZKY })),
      });
      contextMenu(polozky, { x: r.left, y: r.bottom + 6 });
    }

    function tapeta() {
      const data = cv.toDataURL('image/png');
      State.patch({
        customWallpaper: data,
        customWallpaperName: st.path ? FS.basename(st.path) : 'kresba.png',
        wallpaper: 'vlastni',
      });
      applyWallpaper('vlastni');
      toast({ title: 'Tapeta nastavena', body: 'Tvoje kresba je teď na ploše.', icon: 'image' });
    }

    // ---------------------------------------------------------------- pruh nástrojů
    const jmenoEl = el('div.pt-jmeno');
    const poloha = el('div');
    const rozmerEl = el('div');
    const kroky = el('div');

    const bZpet = el('button.pt-btn.ic', { title: 'Zpět (Ctrl+Z)', onclick: zpet }, icon('undo'));
    const bVpred = el('button.pt-btn.ic', { title: 'Vpřed (Ctrl+Y)', onclick: vpred }, icon('redo'));

    const nastrojeEl = el('div.pt-grp', {}, NASTROJE.map((n) => {
      const b = el('button.pt-btn.ic', { title: n.name, dataset: { nastroj: n.id } }, icon(n.ikona));
      b.onclick = () => { st.nastroj = n.id; kresliNastroje(); stav(); };
      return b;
    }));

    const bVyplnit = el('button.pt-btn', { title: 'Vyplnit tvar druhou barvou' }, icon('fill'), el('span', { text: 'Výplň' }));
    bVyplnit.onclick = () => { st.vyplnit = !st.vyplnit; bVyplnit.classList.toggle('on', st.vyplnit); };

    function kresliNastroje() {
      for (const b of nastrojeEl.children) b.classList.toggle('on', b.dataset.nastroj === st.nastroj);
      ov.classList.toggle('kapatko', st.nastroj === 'kapatko');
      bVyplnit.disabled = !['obdelnik', 'elipsa'].includes(st.nastroj);
    }

    const swPrim = el('div.pt-sw.prim');
    const swSec = el('div.pt-sw.sec');
    const tecka = el('div.pt-tecka', { title: 'Tloušťka stopy' }, el('i'));

    const vlastni = el('input.pt-vlastni', { type: 'color', value: '#46c36f', title: 'Vlastní barva' });
    vlastni.oninput = () => { st.barva = vlastni.value; kresliBarvy(); };

    const paletaEl = el('div.pt-paleta', {}, PALETA.map((c) => {
      const b = el('button.pt-barva', { style: { background: c }, title: `${c} — levým na první barvu, pravým na druhou` });
      b.onclick = () => { st.barva = c; kresliBarvy(); };
      b.oncontextmenu = (e) => { e.preventDefault(); st.barva2 = c; kresliBarvy(); };
      return b;
    }));

    const sirkaEl = el('input.pt-sirka', { type: 'range', min: '1', max: '48', value: '6', title: 'Tloušťka stopy' });
    sirkaEl.oninput = () => { st.sirka = +sirkaEl.value; kresliBarvy(); stav(); };

    function kresliBarvy() {
      swPrim.style.background = st.barva;
      swSec.style.background = st.barva2;
      swPrim.title = `První barva: ${st.barva} (levé tlačítko)`;
      swSec.title = `Druhá barva: ${st.barva2} (pravé tlačítko a guma)`;
      const t = tecka.firstChild;
      t.style.width = t.style.height = clamp(st.sirka, 2, 22) + 'px';
      t.style.background = st.barva;
    }

    const bOtevri = el('button.pt-btn', {}, icon('folderOpen'), el('span', { text: 'Otevřít' }));
    bOtevri.onclick = () => otevriNabidku(bOtevri);

    const bar = el('div.pt-bar', {},
      el('div.pt-grp', {},
        el('button.pt-btn', { title: 'Nové plátno', onclick: novy }, icon('plus'), el('span', { text: 'Nový' })),
        bOtevri,
        el('button.pt-btn', { title: 'Uložit (Ctrl+S)', onclick: () => uloz(false) }, icon('save'), el('span', { text: 'Uložit' })),
        el('button.pt-btn.ic', { title: 'Uložit jako novou kopii (Ctrl+Shift+S)', onclick: () => uloz(true) }, icon('plus')),
      ),
      el('div.pt-grp', {}, bZpet, bVpred),
      nastrojeEl,
      el('div.pt-grp', {}, tecka, sirkaEl, bVyplnit),
      el('div.pt-grp', {},
        el('div.pt-pair', {}, swPrim, swSec),
        el('button.pt-swap', {
          title: 'Prohodit barvy (X)',
          onclick: () => { const b = st.barva; st.barva = st.barva2; st.barva2 = b; kresliBarvy(); },
        }, icon('swap')),
        paletaEl,
        vlastni,
      ),
      el('div.pt-grp', {},
        el('button.pt-btn.ic', {
          title: 'Vymazat plátno',
          onclick: () => { zapamatuj(); cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, st.w, st.h); spinavy(true); },
        }, icon('trash')),
        el('button.pt-btn.ic', { title: 'Nastavit jako tapetu', onclick: tapeta }, icon('palette')),
      ),
    );

    function stav() {
      rozmerEl.textContent = `${st.w} × ${st.h} px · stopa ${st.nastroj === 'tuzka' ? 1 : st.sirka} px`;
      kroky.textContent = st.undo.length ? `${st.undo.length}× zpět` : 'žádná historie';
      bZpet.disabled = !st.undo.length;
      bVpred.disabled = !st.redo.length;
    }

    body.append(el('div.pt', {}, bar, stage, el('div.pt-foot', {},
      jmenoEl, el('div.pt-spacer'), poloha, rozmerEl, kroky)));

    // ---------------------------------------------------------------- klávesy
    body.tabIndex = 0;
    body.onkeydown = (e) => {
      const k = e.key.toLowerCase();
      if (e.ctrlKey && k === 's') { e.preventDefault(); e.stopPropagation(); uloz(e.shiftKey); return; }
      if (e.ctrlKey && k === 'z') { e.preventDefault(); e.stopPropagation(); (e.shiftKey ? vpred : zpet)(); return; }
      if (e.ctrlKey && k === 'y') { e.preventDefault(); e.stopPropagation(); vpred(); return; }
      if (e.ctrlKey || e.altKey) return;
      if (k === 'x') { const b = st.barva; st.barva = st.barva2; st.barva2 = b; kresliBarvy(); e.stopPropagation(); return; }
      if (k === '[' || k === ']') {
        st.sirka = clamp(st.sirka + (k === ']' ? 1 : -1), 1, 48);
        sirkaEl.value = String(st.sirka);
        kresliBarvy();
        stav();
        e.stopPropagation();
      }
    };

    // ---------------------------------------------------------------- start
    rozmer(st.w, st.h);
    kresliNastroje();
    kresliBarvy();
    nazev();
    stav();
    if (win.opts?.path) nacti(win.opts.path);
    setTimeout(() => body.focus(), 60);

    win.nactiObrazek = (p) => nacti(p);
  },

  reopen(win, opts) { if (opts?.path) win.nactiObrazek?.(opts.path); },

  unmount(win) {
    if (win.paint?.dirty) toast({ title: 'Malování zavřeno', body: 'Kresba nebyla uložena.', icon: 'info', timeout: 3200 });
  },
};
