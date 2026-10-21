// AstroOS — AstroGPU (aplikace ve stylu NVIDIA App)
//
// Ovladače (Game Ready / Studio, stažení, expresní a vlastní instalace, historie),
// Grafika (digitální živost a odstín opravdu mění barvy systému), Systém (živé hodnoty
// karty + skutečné údaje o displeji z prohlížeče) a Nastavení aktualizací.
// Jádro a efekty obrazovky jsou v js/ovladace.js.

import { el, bus, cz, clamp } from '../util.js';
import { icon } from '../icons.js';
import { contextMenu } from '../ui.js';
import { windows } from '../wm.js';
import { openApp } from '../apps.js';
import * as G from '../ovladace.js';

const NAV = [
  ['ovladace', 'Ovladače', 'download'],
  ['grafika', 'Grafika', 'sliders'],
  ['system', 'Systém', 'gpu'],
  ['nastaveni', 'Nastavení', 'settings'],
];

const datum = (ts) => cz.datumKratky(new Date(ts));
const datumCas = (ts) => `${datum(ts)} ${cz.cas(new Date(ts))}`;
const mb = (b) => Math.round(b / 1048576).toLocaleString('cs');
const FREKVENCE = [60, 75, 90, 100, 120, 144, 165, 170, 180, 200, 240, 280, 300, 360, 480, 500];

/** Kreslená grafická karta — při zátěži se točí ventilátory. */
function kartaArt(toci = false) {
  const lopatky = Array.from({ length: 7 }, (_, i) =>
    `<path d="M0 -5 C 9 -24, 22 -15, 25 -5 Z" fill="#454c53" transform="rotate(${(i * 360) / 7})"/>`).join('');
  const vent = (x) => `<g transform="translate(${x} 50)">
      <circle r="31" fill="#121416" stroke="#4a5158" stroke-width="1.5"/>
      <g class="ag-lopatky"><circle r="26" fill="none"/>${lopatky}</g>
      <circle r="7.5" fill="#23272b" stroke="#7ec63c" stroke-width="1.4"/></g>`;
  const box = el('div.ag-art' + (toci ? '.toci' : ''));
  box.innerHTML = `<svg viewBox="0 0 224 108">
    <defs><linearGradient id="ag-telo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3b4147"/><stop offset="1" stop-color="#1b1e21"/></linearGradient></defs>
    <rect x="12" y="92" width="118" height="9" rx="1.5" fill="#b5993f"/>
    <rect x="6" y="10" width="212" height="82" rx="11" fill="url(#ag-telo)" stroke="#50575e"/>
    <path d="M18 10 h60 l6 6 h122" fill="none" stroke="#7ec63c" stroke-width="1.6" opacity=".8"/>
    ${vent(66)}${vent(158)}
    <text x="206" y="86" text-anchor="end" font-size="7.5" font-weight="700" fill="#7ec63c" letter-spacing="2.4">ASTRO</text>
  </svg>`;
  return box;
}

function zaskrt(text, zapnuto, zmen, { zamceno = false, popis = '' } = {}) {
  return el('label.ag-check' + (zamceno ? '.zamceno' : ''), {},
    el('input', { type: 'checkbox', checked: zapnuto, disabled: zamceno, onchange: (e) => zmen?.(e.target.checked) }),
    el('div', {}, el('span', { text }), popis ? el('small', { text: popis }) : null));
}

function prepinac(text, popis, zapnuto, zmen) {
  const sw = el('button.ag-prep', { role: 'switch', 'aria-checked': String(zapnuto), onclick: () => zmen(!zapnuto) },
    el('span.switch' + (zapnuto ? '.on' : '')));
  return el('div.ag-radek', {}, el('div', {}, el('b', { text }), popis ? el('span', { text: popis }) : null), sw);
}

function volba(text, popis, moznosti, hodnota, zmen) {
  const s = el('select.ag-select', { onchange: (e) => zmen(e.target.value) },
    moznosti.map(([v, t]) => el('option', { value: v, text: t, selected: String(v) === String(hodnota) })));
  return el('div.ag-radek', {}, el('div', {}, el('b', { text }), popis ? el('span', { text: popis }) : null), s);
}

export const astrogpuApp = {
  id: 'astrogpu', name: 'AstroGPU', icon: 'gpu', color: 'linear-gradient(145deg,#8fd34e,#3f7d18)',
  cat: 'system', width: 980, height: 660,

  mount(body, win) {
    const st = {
      stranka: win.opts?.stranka || 'ovladace',
      vlastni: false,
      volby: { cista: false, audio: true, physx: true },
      faze: null, hotovo: false,
      mon: { zatez: 3, tep: 35, takt: 210, vram: 1.1, vent: 0, hist: Array(60).fill(3) },
      hz: null,
    };

    const nav = el('nav.ag-nav');
    const obsah = el('div.ag-obsah');
    body.append(el('div.ag', {}, nav, obsah));

    const jdi = (s) => { st.stranka = s; obsah.scrollTop = 0; kresli(); };
    win.jdi = jdi;

    // ---------------------------------------------------------------- navigace
    function kresliNav() {
      const d = G.nastaveni();
      const f = G.faze();
      const tecka = ['dostupny', 'stazeno'].includes(f);
      nav.replaceChildren(
        el('div.ag-logo', {}, el('div.ag-logo-ic', {}, icon('gpu')), el('span', { text: 'AstroGPU' })),
        ...NAV.map(([id, nazev, ic]) => el('button.ag-nav-i' + (st.stranka === id ? '.on' : ''), { onclick: () => jdi(id) },
          icon(ic), el('span', { text: nazev }), id === 'ovladace' && tecka ? el('b.ag-tecka') : null)),
        el('div.ag-nav-pata', {},
          el('b', { text: G.GPU.nazev }),
          el('span', { text: `Ovladač ${d.verze}` })),
      );
    }

    // ---------------------------------------------------------------- ovladače
    function stahovani() {
      const r = { pruh: el('i'), text: el('span') };
      const box = el('div.ag-stah', {},
        el('div.ag-pruh', {}, r.pruh),
        el('div.ag-stah-radek', {}, r.text, el('button.ag-odkaz', { text: 'Zrušit', onclick: () => G.zrusStahovani() })));
      box._r = r;
      aktualizujStah(box);
      return box;
    }

    function aktualizujStah(box) {
      const b = G.prubeh();
      const zbyva = b.rychlost ? Math.ceil((b.celkem - b.stazeno) / b.rychlost) : 0;
      box._r.pruh.style.width = (b.celkem ? (b.stazeno / b.celkem) * 100 : 0) + '%';
      box._r.text.textContent = `Stahuji… ${mb(b.stazeno)} MB z ${mb(b.celkem)} MB · `
        + `${(b.rychlost / 1048576).toFixed(1).replace('.', ',')} MB/s · zbývá ${zbyva} s`;
    }

    function instalaceVolby() {
      const v = st.volby;
      return el('div.ag-inst', {},
        el('p.ag-stazeno', {}, icon('check'), el('span', { text: 'Stažení dokončeno' })),
        el('div.ag-akce', {},
          el('button.ag-btn', { onclick: () => G.nainstaluj({ audio: true, physx: true }) }, el('span', { text: 'Expresní instalace' })),
          el('button.ag-btn.obrys' + (st.vlastni ? '.on' : ''), { onclick: () => { st.vlastni = !st.vlastni; kresli(); } },
            el('span', { text: 'Vlastní instalace' }), icon(st.vlastni ? 'chevronDown' : 'chevronRight'))),
        st.vlastni ? el('div.ag-vlastni', {},
          el('b', { text: 'Součásti ovladače' }),
          zaskrt('Grafický ovladač', true, null, { zamceno: true }),
          zaskrt('Ovladač HD Audio', v.audio, (x) => { v.audio = x; }),
          zaskrt('Systémový software PhysX', v.physx, (x) => { v.physx = x; }),
          el('div.ag-oddel'),
          zaskrt('Provést čistou instalaci', v.cista, (x) => { v.cista = x; },
            { popis: 'Vrátí digitální živost, odstín a výkon 3D na výchozí hodnoty.' }),
          el('button.ag-btn', { onclick: () => { st.vlastni = false; G.nainstaluj({ ...v }); } }, el('span', { text: 'Nainstalovat' })))
          : null);
    }

    function hlavniKarta() {
      const d = G.nastaveni(), f = G.faze(), b = G.prubeh(), u = d.cekajici;

      if (f === 'instaluje') {
        const hotovych = b.kroky.filter((k) => k.stav === 'hotovo').length;
        return el('div.ag-hlavni.instaluje', {},
          kartaArt(true),
          el('div.ag-hlavni-text', {},
            el('span.ag-typ', { text: b.reinstalace ? 'Přeinstalace ovladače' : 'Instalace ovladače' }),
            el('h2', { text: `${G.TYPY[b.cil.typ]} ${b.cil.verze}` }),
            el('div.ag-pruh.velky', {}, el('i', { style: { width: ((hotovych + 0.5) / b.kroky.length) * 100 + '%' } })),
            el('ul.ag-kroky', {}, b.kroky.map((k) => el('li.' + k.stav, {},
              k.stav === 'hotovo' ? icon('check') : k.stav === 'bezi' ? el('span.ag-toc') : el('span.ag-tecka-k'),
              el('span', { text: k.t })))),
            el('p.ag-pozn', {}, icon('info'),
              el('span', { text: 'Obrazovka může během instalace několikrát bliknout nebo na pár vteřin zčernat. To je normální.' }))));
      }

      if (b.hotovo) {
        const h = b.hotovo;
        return el('div.ag-hlavni.hotovo', {},
          el('div.ag-hotovo-ic', {}, icon('check')),
          el('div.ag-hlavni-text', {},
            el('h2', { text: h.reinstalace ? 'Ovladač přeinstalován' : 'Instalace dokončena' }),
            el('p', { text: `${G.TYPY[h.typ]} ovladač ${h.verze} je nainstalovaný${h.cista ? ' a nastavení grafiky je zase výchozí' : ''}.` }),
            el('div.ag-akce', {}, el('button.ag-btn', { text: 'Hotovo', onclick: () => G.zavriHotovo() }))));
      }

      if (f === 'kontroluje') {
        return el('div.ag-hlavni', {}, kartaArt(false),
          el('div.ag-hlavni-text.stred', {}, el('span.ag-toc.velky'), el('h2', { text: 'Kontroluji aktualizace…' })));
      }

      if (f === 'aktualni') {
        return el('div.ag-hlavni', {}, kartaArt(false),
          el('div.ag-hlavni-text', {},
            el('p.ag-ok', {}, icon('check'), el('span', { text: 'Máš nejnovější ovladač' })),
            el('h2', { text: `${G.TYPY[d.nainstalovanyTyp]} ${d.verze}` }),
            el('p', { text: d.posledniKontrola ? `Naposledy zkontrolováno ${datumCas(d.posledniKontrola)}` : 'Zatím nezkontrolováno' })));
      }

      return el('div.ag-hlavni', {},
        kartaArt(f === 'stahuje'),
        el('div.ag-hlavni-text', {},
          el('div.ag-stitky', {}, el('span.ag-chip.novy', { text: 'NOVÝ' }), el('span.ag-typ', { text: `${G.TYPY[u.typ]} ovladač` })),
          el('h2', { text: `Verze ${u.verze}` }),
          el('p', { text: `Vydáno ${datum(u.vydano)} · ${u.velikost} MB` }),
          f === 'dostupny' ? el('div.ag-akce', {},
            el('button.ag-btn', { onclick: () => G.stahni() }, icon('download'), el('span', { text: 'Stáhnout' }))) : null,
          f === 'stahuje' ? stahovani() : null,
          f === 'stazeno' ? instalaceVolby() : null));
    }

    function poznamky(u) {
      const cast = (nadpis, polozky) => el('div.ag-pozn-sekce', {},
        el('h4', { text: nadpis }), el('ul', {}, polozky.map((p) => el('li', { text: p }))));
      return el('div.ag-karta.ag-poznamky', {},
        el('h3', { text: `Co je nového ve verzi ${u.verze}` }),
        cast(u.typ === 'studio' ? 'Pro tvůrce' : 'Game Ready', u.novinky),
        cast('Opravené problémy', u.opravy),
        cast('Známé problémy', u.zname));
    }

    function stranaOvladace() {
      const d = G.nastaveni(), f = G.faze(), b = G.prubeh(), u = d.cekajici;
      const zaneprazdneno = !!b.faze;

      const typy = el('div.ag-seg', {}, Object.entries(G.TYPY).map(([id, n]) => el('button' + (d.typ === id ? '.on' : ''), {
        text: n, disabled: f === 'instaluje', onclick: () => G.nastavTyp(id),
      })));
      const vic = el('button.ag-ikbtn', {
        title: 'Další možnosti',
        onclick: (e) => contextMenu([
          { icon: 'refresh', label: 'Přeinstalovat ovladač', disabled: zaneprazdneno, onClick: () => G.nainstaluj({ reinstalace: true }) },
          { icon: 'info', label: 'O systému', onClick: () => openApp('about') },
        ], { x: e.clientX, y: e.clientY }),
      }, icon('dots'));
      const kontrola = el('button.ag-btn.obrys', { disabled: zaneprazdneno, onclick: () => G.zkontrolujTed() },
        f === 'kontroluje' ? el('span.ag-toc') : icon('refresh'), el('span', { text: 'Zkontrolovat aktualizace' }));

      return el('div.ag-stranka', {},
        el('div.ag-hlava', {}, el('h1', { text: 'Ovladače' }), el('div.ag-hlava-akce', {}, typy, kontrola, vic)),
        hlavniKarta(),
        u && f !== 'instaluje' && !b.hotovo ? poznamky(u) : null,
        el('h2.ag-nadpis', { text: 'Nainstalovaný ovladač' }),
        el('div.ag-karta.ag-nainst', {},
          el('div.ag-nainst-ic', {}, icon('gpu')),
          el('div', {},
            el('b', { text: `${G.TYPY[d.nainstalovanyTyp]} ovladač ${d.verze}` }),
            el('span', { text: `Nainstalováno ${datumCas(d.nainstalovano)}` })),
          el('span.ag-chip' + (u ? '.stary' : '.ok'), { text: u ? 'Starší verze' : 'Aktuální' })),
        d.historie.length ? el('h2.ag-nadpis', { text: 'Dříve nainstalované' }) : null,
        d.historie.length ? el('div.ag-karta.ag-historie', {}, d.historie.map((h) => el('div.ag-hist-r', {},
          el('b', { text: h.verze }), el('span', { text: G.TYPY[h.typ] }),
          el('span', { text: `${datum(h.nainstalovano)} – ${datum(h.odebrano)}` })))) : null,
      );
    }

    // ---------------------------------------------------------------- grafika
    function posuvnik(nazev, popis, klic, min, max, format) {
      const d = G.nastaveni();
      const hodnota = el('span.ag-hodnota', { text: format(d[klic]) });
      const vstup = el('input', { type: 'range', min, max, value: d[klic] });
      // při tažení se jen přepíná obraz, uloží se až puštěním — překreslení by vzalo posuvník z ruky
      vstup.oninput = () => { d[klic] = +vstup.value; G.aplikujObraz(); hodnota.textContent = format(+vstup.value); };
      vstup.onchange = () => G.nastav(klic, +vstup.value);
      return el('div.ag-posuvnik', {},
        el('div.ag-posuvnik-hlava', {}, el('div', {}, el('b', { text: nazev }), el('span', { text: popis })), hodnota),
        vstup);
    }

    function stranaGrafika() {
      const d = G.nastaveni();
      return el('div.ag-stranka', {},
        el('div.ag-hlava', {}, el('h1', { text: 'Grafika' })),
        el('p.ag-mdl', { text: 'Globální nastavení obrazu. Platí pro celý systém — tapetu, okna i hlavní panel.' }),
        el('div.ag-karta', {},
          posuvnik('Digitální živost', 'Sytost barev. Výchozí hodnota je 50 %.', 'zivost', 0, 100, (v) => v + ' %'),
          posuvnik('Odstín', 'Otočí všechny barvy po barevném kruhu.', 'odstin', -180, 180, (v) => (v > 0 ? '+' : '') + v + '°'),
          el('div.ag-akce', {}, el('button.ag-btn.obrys', { text: 'Obnovit výchozí', onclick: () => G.obnovObraz() }))),
        el('h2.ag-nadpis', { text: 'Výkon 3D' }),
        el('div.ag-karta', {},
          volba('Režim nízké latence', 'Zkrátí frontu snímků čekajících na vykreslení.',
            [['vyp', 'Vypnuto'], ['zap', 'Zapnuto'], ['ultra', 'Ultra']], d.latence, (v) => G.nastav('latence', v)),
          volba('Vertikální synchronizace', 'Sladí snímky s obnovovací frekvencí displeje.',
            [['aplikace', 'Podle aplikace'], ['zap', 'Zapnuto'], ['vyp', 'Vypnuto']], d.vsync, (v) => G.nastav('vsync', v)),
          volba('Max. snímková frekvence', 'Horní hranice snímků za vteřinu.',
            [[0, 'Bez omezení'], [60, '60 FPS'], [120, '120 FPS'], [144, '144 FPS'], [240, '240 FPS']], d.fpsLimit, (v) => G.nastav('fpsLimit', +v))),
      );
    }

    // ---------------------------------------------------------------- systém
    const mon = {};
    function dlazdice(klic, nazev) {
      mon[klic] = { hodnota: el('b'), pruh: el('i') };
      return el('div.ag-mon', {}, el('span', { text: nazev }), mon[klic].hodnota, el('div.ag-pruh.maly', {}, mon[klic].pruh));
    }

    function stranaSystem() {
      const d = G.nastaveni();
      const graf = el('div.ag-graf');
      mon.graf = graf;
      const radek = (k, v) => el('div.ag-info-r', {}, el('span', { text: k }), el('b', { text: v }));
      const hdr = matchMedia('(dynamic-range: high)').matches;
      const stranka = el('div.ag-stranka', {},
        el('div.ag-hlava', {}, el('h1', { text: 'Systém' })),
        el('div.ag-karta.ag-gpu', {},
          kartaArt(st.mon.vent > 0),
          el('div', {},
            el('h2', { text: G.GPU.nazev }),
            el('p', { text: `${G.GPU.pamet} GB ${G.GPU.typPameti} · ovladač ${G.TYPY[d.nainstalovanyTyp]} ${d.verze}` }))),
        el('h2.ag-nadpis', { text: 'Výkon' }),
        el('div.ag-mon-mrizka', {},
          dlazdice('zatez', 'Využití GPU'), dlazdice('tep', 'Teplota'), dlazdice('takt', 'Takt jádra'),
          dlazdice('vram', 'Paměť'), dlazdice('vent', 'Ventilátory')),
        el('div.ag-karta.ag-graf-box', {}, el('span', { text: 'Využití GPU · posledních 60 s' }), graf),
        el('h2.ag-nadpis', { text: 'Displej' }),
        el('div.ag-karta.ag-info', {},
          radek('Rozlišení', `${Math.round(screen.width * devicePixelRatio)} × ${Math.round(screen.height * devicePixelRatio)}`),
          mon.hzRadek = radek('Obnovovací frekvence', st.hz ? `${st.hz} Hz` : 'měřím…'),
          radek('Barevná hloubka', `${screen.colorDepth} bitů`),
          radek('HDR', hdr ? 'Podporováno' : 'Nepodporováno')),
        el('h2.ag-nadpis', { text: 'Grafická karta' }),
        el('div.ag-karta.ag-info', {},
          radek('Název', G.GPU.nazev),
          radek('Paměť', `${G.GPU.pamet} GB ${G.GPU.typPameti}`),
          radek('Jádra Astro', G.GPU.jader.toLocaleString('cs')),
          radek('Sběrnice', 'PCIe 4.0 ×16'),
          radek('Resizable BAR', 'Zapnuto'),
          radek('AstroX', '12 Ultimate'),
          radek('Ovladač', `${G.TYPY[d.nainstalovanyTyp]} ${d.verze} (${datum(d.nainstalovano)})`)),
      );
      if (!st.hz) zmerHz();
      aktualizujMon();
      return stranka;
    }

    function zmerHz() {
      let snimku = 0;
      const start = performance.now();
      const krok = (t) => {
        snimku++;
        if (t - start < 1000) return requestAnimationFrame(krok);
        const namereno = (snimku * 1000) / (t - start);
        st.hz = FREKVENCE.reduce((a, b) => (Math.abs(b - namereno) < Math.abs(a - namereno) ? b : a));
        if (mon.hzRadek?.isConnected) mon.hzRadek.lastChild.textContent = `${st.hz} Hz`;
      };
      requestAnimationFrame(krok);
    }

    function tikMon() {
      const m = st.mon;
      const okna = windows.length;
      const hra = windows.some((w) => w.app.id === 'games');
      const instalace = G.faze() === 'instaluje';
      const cil = 2 + okna * 2.4 + (hra ? 38 : 0) + (instalace ? 26 : 0) + Math.random() * 6;
      m.zatez = clamp(m.zatez + (cil - m.zatez) * 0.3, 0, 100);
      m.tep += (33 + m.zatez * 0.42 - m.tep) * 0.08;
      m.takt = m.zatez < 8 ? 210 + Math.random() * 40 : Math.min(2610, 1400 + m.zatez * 11 + Math.random() * 60);
      m.vram += (0.8 + okna * 0.32 + (hra ? 1.6 : 0) - m.vram) * 0.2;
      m.vent = m.tep < 50 ? 0 : clamp((m.tep - 50) * 3 + 30, 30, 100);
      m.hist.push(m.zatez);
      m.hist.shift();
      if (st.stranka === 'system' && body.isConnected) aktualizujMon();
    }

    function aktualizujMon() {
      const m = st.mon;
      if (!mon.zatez?.hodnota.isConnected) return;
      const nastav = (k, text, proc) => { mon[k].hodnota.textContent = text; mon[k].pruh.style.width = clamp(proc, 0, 100) + '%'; };
      nastav('zatez', Math.round(m.zatez) + ' %', m.zatez);
      nastav('tep', Math.round(m.tep) + ' °C', ((m.tep - 20) / 70) * 100);
      nastav('takt', Math.round(m.takt).toLocaleString('cs') + ' MHz', (m.takt / 2610) * 100);
      nastav('vram', `${m.vram.toFixed(1).replace('.', ',')} / ${G.GPU.pamet} GB`, (m.vram / G.GPU.pamet) * 100);
      nastav('vent', m.vent ? Math.round(m.vent) + ' %' : '0 % · pasivní', m.vent);
      const body_ = m.hist.map((v, i) => `${(i / (m.hist.length - 1)) * 300},${60 - (v / 100) * 58}`).join(' ');
      mon.graf.innerHTML = `<svg viewBox="0 0 300 60" preserveAspectRatio="none">
        <polygon points="0,60 ${body_} 300,60" fill="#7ec63c" fill-opacity=".14"/>
        <polyline points="${body_}" fill="none" stroke="#7ec63c" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>`;
      const art = obsah.querySelector('.ag-gpu .ag-art');
      art?.classList.toggle('toci', m.vent > 0);
    }

    // ---------------------------------------------------------------- nastavení
    function stranaNastaveni() {
      const d = G.nastaveni();
      return el('div.ag-stranka', {},
        el('div.ag-hlava', {}, el('h1', { text: 'Nastavení' })),
        el('h2.ag-nadpis', { text: 'Aktualizace ovladačů' }),
        el('div.ag-karta', {},
          volba('Automaticky kontrolovat', 'Jak často AstroGPU hledá nový ovladač.',
            [['30min', 'Každých 30 minut'], ['denne', 'Jednou denně'], ['vyp', 'Vypnuto']], d.kontrola, (v) => G.nastav('kontrola', v)),
          prepinac('Automaticky stahovat aktualizace', 'Nový ovladač se stáhne sám. Instalaci spustíš ty.', d.autoStahovat, (v) => G.nastav('autoStahovat', v)),
          prepinac('Oznámení na ploše', 'Upozorní na nový nebo stažený ovladač.', d.oznameni, (v) => G.nastav('oznameni', v))),
        el('h2.ag-nadpis', { text: 'O aplikaci' }),
        el('div.ag-karta.ag-info', {},
          el('div.ag-info-r', {}, el('span', { text: 'Verze aplikace' }), el('b', { text: 'AstroGPU 11.0.4' })),
          el('div.ag-info-r', {}, el('span', { text: 'Poslední kontrola' }), el('b', { text: d.posledniKontrola ? datumCas(d.posledniKontrola) : '—' }))),
      );
    }

    // ---------------------------------------------------------------- vykreslení
    const STRANKY = { ovladace: stranaOvladace, grafika: stranaGrafika, system: stranaSystem, nastaveni: stranaNastaveni };

    function kresli() {
      st.faze = G.faze();
      st.hotovo = !!G.prubeh().hotovo;
      kresliNav();
      const posun = obsah.scrollTop;
      obsah.replaceChildren(STRANKY[st.stranka]());
      obsah.scrollTop = posun;
    }

    const odpoj = [
      bus.on('ovladac', () => { if (body.isConnected && !obsah.contains(document.activeElement?.closest?.('.ag-posuvnik'))) kresli(); }),
      bus.on('ovladac:prubeh', () => {
        if (!body.isConnected) return;
        const f = G.faze();
        if (f !== st.faze || f === 'instaluje' || !!G.prubeh().hotovo !== st.hotovo) return kresli();
        const s = obsah.querySelector('.ag-stah');
        if (s) aktualizujStah(s);
      }),
    ];
    const casovac = setInterval(tikMon, 1000);
    win.onClose = () => { odpoj.forEach((f) => f()); clearInterval(casovac); };

    kresli();
  },

  unmount(win) { win.onClose?.(); },

  reopen(win, opts) { if (opts?.stranka) win.jdi?.(opts.stranka); },
};
