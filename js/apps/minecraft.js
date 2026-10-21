// AstroOS — Astro Minecraft (hra z astrome0.github.io/minecraft-html) + Astro Launcher
//
// Hra: okno s rámečkem na GitHub Pages (bez proxy — Pages rámeček dovolí). Myš se rozhlíží přes Pointer Lock:
// v Electronu ho povoluje app/main.js (relace AstroOS) i app/web.js (Nova), v prohlížeči stačí rámeček bez sandboxu.
// Launcher: vzhled podle Minecraft Launcheru — boční lišta, Hrát / Instalace / Poznámky k verzím, zelené HRÁT,
// novinky. Instalace = pojmenované adresy hry (výchozí GitHub Pages, k tomu třeba vlastní kopie).
// Stav: State.mcLauncher { instalace: [{ id, nazev, url }], vybrana, hrano: { id: čas }, zavrit, maximalizovat }.

import { el, cz, pred, bus } from '../util.js';
import { icon, glyfAplikace } from '../icons.js';
import { State } from '../state.js';
import { toast, contextMenu } from '../ui.js';
import * as Sit from '../sit.js';

export const HRA_URL = 'https://astrome0.github.io/minecraft-html/';
const REPO = 'astrome0/minecraft-html';
const VYCHOZI = { id: 'vychozi', nazev: 'Nejnovější vydání', url: HRA_URL, pevna: true };

const otevri = (id, o) => import('../apps.js').then(({ openApp }) => openApp(id, o));

// ---------------------------------------------------------------- stav launcheru
const data = () => {
  const d = State.get('mcLauncher') || {};
  return { instalace: [], vybrana: 'vychozi', hrano: {}, zavrit: false, maximalizovat: true, ...d };
};
const uloz = (zmena) => State.set('mcLauncher', { ...data(), ...zmena });
const instalace = () => [VYCHOZI, ...data().instalace];
const vybrana = () => instalace().find((i) => i.id === data().vybrana) || VYCHOZI;

// ================================================================ hra
export const astroMinecraftApp = {
  id: 'astrominecraft', name: 'Astro Minecraft', icon: 'game', color: 'linear-gradient(145deg,#6fbf4a,#7a5230)',
  cat: 'media', width: 1120, height: 700,

  mount(body, win) {
    const url = win.opts?.url || vybrana().url;
    win.title = win.opts?.nazev && win.opts.nazev !== VYCHOZI.nazev ? `Astro Minecraft — ${win.opts.nazev}` : 'Astro Minecraft';
    const obal = el('div.amc');
    body.append(obal);

    const nacitani = el('div.amc-nacitani', {},
      glyfAplikace(astroMinecraftApp, 'div.amc-logo'),
      el('div.amc-nazev', { text: 'Astro Minecraft' }),
      el('div.amc-pruh', {}, el('i')),
      el('div.amc-tip', { text: 'Klikni do hry a myš se zachytí — Esc ji zase pustí.' }));

    if (!Sit.online()) {
      obal.append(el('div.amc-nacitani', {},
        icon('wifi'),
        el('div.amc-nazev', { text: 'Bez připojení k internetu' }),
        el('div.amc-tip', { text: 'Astro Minecraft se načítá z GitHubu. Připoj se k Wi-Fi a zkus to znovu.' }),
        el('button.btn.primary', { text: 'Zkusit znovu', onclick: () => { body.innerHTML = ''; astroMinecraftApp.mount(body, win); } })));
      return;
    }

    // bez sandboxu: hra potřebuje Pointer Lock, zvuk i celou obrazovku; je to jiný původ, k AstroOS nesáhne
    const ram = el('iframe.amc-ram', {
      src: url,
      allow: 'fullscreen; autoplay; gamepad; clipboard-write; pointer-lock',
      allowfullscreen: true,
      title: 'Astro Minecraft',
    });
    // Hra volá preventDefault() na každý mousedown, takže kliknutí do rámečku mu NEdá fokus — myš
    // (pointer lock) funguje, ale klávesy by zůstaly v AstroOS. Proto: fokus do rámečku dáváme sami
    // (po načtení, při přepnutí na okno) a když ho rámeček nemá, leží přes něj neviditelná vrstva —
    // první klik zaměří hru, další už jdou do hry.
    const chytac = el('div.amc-chytac');
    const zamer = () => { try { ram.focus(); ram.contentWindow?.focus(); } catch { /* jiný původ — nevadí */ } };
    const hlidej = () => setTimeout(() => { chytac.hidden = document.activeElement === ram; }, 0);
    chytac.onpointerdown = (e) => {
      e.preventDefault();
      zamer();
      import('../wm.js').then((wm) => wm.focus(win));
      hlidej();
    };
    ram.onload = () => {
      nacitani.classList.add('pryc');
      setTimeout(() => nacitani.remove(), 400);
      import('../wm.js').then((wm) => { if (wm.getFocused() === win) zamer(); hlidej(); });
    };
    obal.append(ram, chytac, nacitani);
    win.ram = ram;

    // fokus v rámečku → okno dopředu; fokus zpátky v AstroOS → vrstva zpět přes hru
    const priBlur = () => setTimeout(() => {
      if (document.activeElement === ram) import('../wm.js').then((wm) => wm.focus(win));
      hlidej();
    }, 0);
    window.addEventListener('blur', priBlur);
    window.addEventListener('focus', hlidej);
    document.addEventListener('focusin', hlidej);
    document.addEventListener('pointerdown', hlidej, true);   // klik kamkoli do AstroOS = fokus mimo hru
    // přepnutí na okno hry z panelu / Alt+Tab / záhlaví → klávesy rovnou do hry
    let byloAktivni = false;
    const odWm = bus.on('wm:change', () => import('../wm.js').then((wm) => {
      const ted = wm.getFocused() === win;
      if (ted && !byloAktivni && !win.minimized) zamer();
      byloAktivni = ted;
      hlidej();
    }));
    win.onClose = () => {
      window.removeEventListener('blur', priBlur);
      window.removeEventListener('focus', hlidej);
      document.removeEventListener('focusin', hlidej);
      document.removeEventListener('pointerdown', hlidej, true);
      odWm();
    };

    const d = data();
    if (!d.napovedaVidena) {
      uloz({ napovedaVidena: true });
      setTimeout(() => toast({ title: 'Astro Minecraft', body: 'Klikni do hry a rozhlížej se myší. Esc myš pustí.', icon: 'game', timeout: 7000 }), 1200);
    }
  },
  unmount(win) { win.onClose?.(); },
  reopen(win, opts) {
    if (!opts?.url || !win.ram || opts.url === win.ram.src) return;
    win.opts = opts;
    win.body.innerHTML = '';
    astroMinecraftApp.mount(win.body, win);
  },
};

// ================================================================ kreslení (pixel art na plátnech)
/** Krajina z bloků: obloha, slunce, mraky, kopce s trávou, hlína, kámen, stromy. Nízké rozlišení + pixelated. */
function krajina(w = 192, h = 84, seed = 7) {
  const c = el('canvas.mcl-krajina', { width: w, height: h });
  const g = c.getContext('2d');
  let s = seed;
  const nah = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const obloha = g.createLinearGradient(0, 0, 0, h);
  obloha.addColorStop(0, '#2b1a3f'); obloha.addColorStop(0.45, '#c8573a'); obloha.addColorStop(0.75, '#f2a24a');
  g.fillStyle = obloha; g.fillRect(0, 0, w, h);
  g.fillStyle = '#ffe08a'; g.fillRect(w * 0.68, h * 0.22, 12, 12);
  g.fillStyle = '#fff3c4'; g.fillRect(w * 0.68 + 3, h * 0.22 + 3, 6, 6);
  for (let i = 0; i < 6; i++) {                 // hranaté mraky
    const x = nah() * w, y = 4 + nah() * 18, d = 8 + nah() * 16;
    g.fillStyle = 'rgba(255,214,190,.55)'; g.fillRect(x, y, d, 3); g.fillRect(x + 3, y - 2, d - 6, 2);
  }
  const vrstva = (zaklad, amp, frek, barvy, krok) => {
    for (let x = 0; x < w; x += krok) {
      const v = Math.round((zaklad + Math.sin(x * frek + seed) * amp + Math.sin(x * frek * 2.7 + seed * 2) * amp * 0.4) / krok) * krok;
      g.fillStyle = barvy[0]; g.fillRect(x, v, krok, h - v);
      if (barvy[1]) { g.fillStyle = barvy[1]; g.fillRect(x, v, krok, krok); }
    }
  };
  vrstva(h * 0.52, 7, 0.05, ['#5a2f46'], 3);                      // vzdálené hory
  vrstva(h * 0.62, 6, 0.07, ['#6b3a2a', '#7c4a2b'], 3);
  // popředí: tráva, hlína, kámen + stromy
  for (let x = 0; x < w; x += 4) {
    const v = Math.round((h * 0.74 + Math.sin(x * 0.045) * 5 + Math.sin(x * 0.13) * 2) / 4) * 4;
    for (let y = v; y < h; y += 4) {
      const hloubka = (y - v) / 4;
      g.fillStyle = hloubka === 0 ? (nah() < 0.3 ? '#6fbf4a' : '#5ca83c') : hloubka < 3 ? (nah() < 0.25 ? '#8a5a35' : '#79502f') : (nah() < 0.2 ? '#8d8d8d' : '#7a7a7a');
      g.fillRect(x, y, 4, 4);
    }
    if (nah() < 0.07 && x > 8 && x < w - 12) {
      g.fillStyle = '#5b3a1f'; g.fillRect(x, v - 12, 4, 12);
      g.fillStyle = '#3f7f2a'; g.fillRect(x - 6, v - 22, 16, 10); g.fillRect(x - 2, v - 26, 8, 4);
    }
  }
  return c;
}

/** Hlava postavy 8×8 (Steve) — avatar účtu. */
function hlava(velikost = 36) {
  const c = el('canvas.mcl-avatar', { width: 8, height: 8, style: { width: velikost + 'px', height: velikost + 'px' } });
  const g = c.getContext('2d');
  const P = ['22222222', '22222222', '11111111', '13311331', '11111111', '11144111', '11555511', '11111111'];
  const B = { 1: '#c18a63', 2: '#3b2614', 3: '#ffffff', 4: '#8a5a3c', 5: '#6a3e2a' };
  P.forEach((r, y) => [...r].forEach((k, x) => { g.fillStyle = B[k]; g.fillRect(x, y, 1, 1); }));
  g.fillStyle = '#3a4fa8'; g.fillRect(2, 3, 1, 1); g.fillRect(5, 3, 1, 1);
  return c;
}

// ================================================================ launcher
const NOVINKY = [
  { stitek: 'Astro Minecraft', nazev: 'Hraj s kamarády', text: 'Založ svět a pozvi kamarády — multiplayer jde přes server AstroMeo.', seed: 3 },
  { stitek: 'Astro Minecraft', nazev: 'Hraj i na mobilu', text: 'Stejná hra běží na telefonu s dotykovým ovládáním.', seed: 11 },
  { stitek: 'Open source', nazev: 'Kód je na GitHubu', text: 'Celá hra je jeden HTML soubor. Podívej se, jak funguje.', seed: 19, akce: 'github' },
  { stitek: 'AstroOS', nazev: 'Myš už funguje', text: 'Ve hře se teď rozhlížíš myší i v AstroOS — klikni do hry, Esc pustí.', seed: 27 },
];

export const launcherApp = {
  id: 'mclauncher', name: 'Astro Launcher', icon: 'game', color: 'linear-gradient(145deg,#5fbf4a,#2b6e2a)',
  cat: 'media', width: 1120, height: 720,

  mount(body, win) {
    const st = { stranka: 'hra', tab: 'hrat' };
    const obal = el('div.mcl');
    const lista = el('div.mcl-lista');
    const hlavni = el('div.mcl-hlavni');
    obal.append(lista, hlavni);
    body.append(obal);

    const jmeno = () => State.get('user')?.name || 'Hráč';

    // ---------- boční lišta
    function kresliListu() {
      const polozka = (id, nazev, ikona, nadpis) => {
        const b = el('button.mcl-nav' + (st.stranka === id ? '.on' : ''), {}, ikona,
          el('span', {}, nadpis ? el('small', { text: nadpis }) : null, el('b', { text: nazev })));
        b.onclick = () => { st.stranka = id; kresli(); };
        return b;
      };
      const u = State.get('user') || {};
      lista.replaceChildren(
        el('div.mcl-ucet', {}, hlava(34), el('div', {},
          el('b', { text: jmeno(), 'data-no-i18n': true }),
          el('small', { text: u.email ? 'Astro účet' : 'Místní účet' }))),
        polozka('domu', 'DOMŮ', el('div.mcl-nav-ic', {}, icon('home'))),
        polozka('hra', 'WEB EDITION', glyfAplikace(astroMinecraftApp, 'div.mcl-nav-glyf'), 'ASTRO MINECRAFT:'),
        el('div.mcl-mezera'),
        polozka('novinky', 'CO JE NOVÉHO', el('div.mcl-nav-ic', {}, icon('book'))),
        polozka('nastaveni', 'NASTAVENÍ', el('div.mcl-nav-ic', {}, icon('sliders'))),
        el('div.mcl-verze', { text: 'v.1.0.0-astro' }),
      );
    }

    // ---------- spuštění hry
    function hraj(inst = vybrana(), tlacitko = null) {
      if (tlacitko) {
        if (tlacitko.disabled) return;
        tlacitko.disabled = true;
        tlacitko.classList.add('spousti');
        tlacitko.firstChild.textContent = 'SPOUŠTÍM…';
      }
      uloz({ vybrana: inst.id, hrano: { ...data().hrano, [inst.id]: Date.now() } });
      setTimeout(async () => {
        const w = await otevri('astrominecraft', { url: inst.url, nazev: inst.nazev });
        if (data().maximalizovat && w && !w.maximized) import('../wm.js').then((wm) => wm.toggleMax(w));
        if (data().zavrit) win.close();
        else if (tlacitko?.isConnected) kresli();
      }, tlacitko ? 900 : 0);
    }

    // ---------- stránky
    const novinkyKarty = () => el('div.mcl-novinky', {}, NOVINKY.map((n) => {
      const karta = el('div.mcl-karta', {},
        el('div.mcl-karta-obr', {}, krajina(96, 54, n.seed)),
        el('div.mcl-karta-t', {}, el('b', { text: n.nazev }), el('p', { text: n.text })),
        el('div.mcl-karta-pata', {}, el('span.mcl-stitek', { text: n.stitek }), el('span.mcl-zpravy', {}, icon('book'), el('span', { text: 'Novinky' }))));
      if (n.akce === 'github') { karta.classList.add('klik'); karta.onclick = () => otevri('browser', { url: 'https://github.com/' + REPO }); }
      return karta;
    }));

    function stranaHrat() {
      const inst = vybrana();
      const hrat = el('button.mcl-hrat', {}, el('span', { text: 'HRÁT' }));
      hrat.onclick = () => hraj(vybrana(), hrat);
      const vyber = el('button.mcl-instalace', {},
        glyfAplikace(astroMinecraftApp, 'div.mcl-inst-glyf'),
        el('div', {}, el('b', { text: inst.nazev }), el('small', { text: inst.pevna ? 'web · GitHub Pages' : inst.url.replace(/^https?:\/\//, ''), 'data-no-i18n': true })),
        icon('chevronDown'));
      vyber.onclick = () => {
        const r = vyber.getBoundingClientRect();
        contextMenu(instalace().map((i) => ({
          icon: i.id === inst.id ? 'check' : null, label: i.nazev,
          onClick: () => { uloz({ vybrana: i.id }); kresli(); },
        })), { x: r.left, y: r.top, align: 'br' });
      };
      const hrano = data().hrano[inst.id];
      return el('div.mcl-hrat-strana', {},
        el('div.mcl-hero', {},
          krajina(),
          el('div.mcl-logo', {}, el('div.mcl-logo-t', { text: 'ASTRO MINECRAFT' }), el('div.mcl-logo-s', { text: 'WEB EDITION' })),
          el('div.mcl-hero-box', { text: 'Hraj s kamarády — svět si můžete sdílet přes server AstroMeo!' })),
        el('div.mcl-lista-hry', {},
          vyber,
          el('div.mcl-hrat-obal', {}, hrat, hrano ? el('small', { text: `Naposledy hráno ${pred(hrano)}` }) : null),
          el('div.mcl-hrac', {}, el('span', { text: jmeno(), 'data-no-i18n': true }), hlava(22))),
        novinkyKarty());
    }

    function stranaInstalace() {
      const radky = instalace().map((i) => {
        const hrano = data().hrano[i.id];
        const vice = el('button.mcl-tl-mini', { title: 'Další možnosti' }, icon('dots'));
        vice.onclick = (e) => {
          contextMenu([
            { icon: 'play', label: 'Hrát', onClick: () => hraj(i) },
            { icon: 'globe', label: 'Otevřít v Nově', onClick: () => otevri('browser', { url: i.url }) },
            ...(i.pevna ? [] : [
              { icon: 'notes', label: 'Upravit', onClick: () => formular(i) },
              { icon: 'trash', label: 'Smazat', danger: true, onClick: () => { uloz({ instalace: data().instalace.filter((x) => x.id !== i.id), vybrana: data().vybrana === i.id ? 'vychozi' : data().vybrana }); kresli(); } },
            ]),
          ], { x: e.clientX, y: e.clientY });
        };
        return el('div.mcl-inst-radek', {},
          glyfAplikace(astroMinecraftApp, 'div.mcl-inst-glyf'),
          el('div', { style: { flex: '1', minWidth: '0' } },
            el('b', { text: i.nazev }),
            el('small', { text: (i.pevna ? 'Nejnovější verze z GitHub Pages' : i.url) + (hrano ? ` · hráno ${pred(hrano)}` : ''), 'data-no-i18n': !i.pevna })),
          el('button.mcl-hrat.mini', { onclick: () => hraj(i) }, el('span', { text: 'HRÁT' })),
          vice);
      });
      const pridat = el('button.mcl-tl', {}, icon('plus'), el('span', { text: 'Nová instalace' }));
      pridat.onclick = () => formular();
      return el('div.mcl-stranka', {},
        el('div.mcl-nadpis', {}, el('h2', { text: 'Instalace' }), pridat),
        el('p.mcl-popis', { text: 'Instalace je adresa, odkud se hra spustí — třeba tvoje vlastní testovací kopie.' }),
        el('div.mcl-inst', {}, radky));
    }

    function formular(puvodni = null) {
      const nazev = el('input.mcl-pole', { value: puvodni?.nazev || '', placeholder: 'Název (třeba Testovací verze)' });
      const url = el('input.mcl-pole', { value: puvodni?.url || '', placeholder: 'https://…' });
      [nazev, url].forEach((i) => (i.onkeydown = (e) => e.stopPropagation()));
      const chyba = el('div.mcl-chyba');
      const ulozit = el('button.mcl-hrat.mini', {}, el('span', { text: puvodni ? 'ULOŽIT' : 'VYTVOŘIT' }));
      ulozit.onclick = () => {
        let u;
        try { u = new URL(url.value.trim()); } catch { u = null; }
        if (!u || !/^https?:$/.test(u.protocol)) { chyba.textContent = 'Zadej celou adresu začínající https://'; return; }
        const n = nazev.value.trim() || u.hostname;
        const vse = data().instalace;
        if (puvodni) uloz({ instalace: vse.map((x) => (x.id === puvodni.id ? { ...x, nazev: n, url: u.href } : x)) });
        else uloz({ instalace: [...vse, { id: 'i' + Date.now().toString(36), nazev: n, url: u.href }] });
        kresli();
      };
      hlavni.querySelector('.mcl-obsah').replaceChildren(el('div.mcl-stranka', {},
        el('h2', { text: puvodni ? 'Upravit instalaci' : 'Nová instalace' }),
        el('label.mcl-stitek-pole', { text: 'Název' }), nazev,
        el('label.mcl-stitek-pole', { text: 'Adresa hry' }), url, chyba,
        el('div.mcl-tlacitka', {}, el('button.mcl-tl', { text: 'Zrušit', onclick: () => kresli() }), ulozit)));
      nazev.focus();
    }

    function stranaPoznamky() {
      const seznam = el('div.mcl-poznamky', {}, el('p.mcl-popis', { text: 'Načítám historii z GitHubu…' }));
      if (!Sit.online()) seznam.replaceChildren(el('p.mcl-popis', { text: 'Bez internetu se historie verzí nenačte.' }));
      else {
        fetch(`https://api.github.com/repos/${REPO}/commits?per_page=15`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
          .then((commity) => seznam.replaceChildren(...commity.map((c) => el('div.mcl-pozn', {},
            el('div.mcl-pozn-d', { text: cz.datumKratky(new Date(c.commit.author.date)) }),
            el('div', { style: { flex: '1', minWidth: '0' } },
              el('b', { text: c.commit.message.split('\n')[0], 'data-no-i18n': true }),
              el('small', { text: `${c.commit.author.name} · ${c.sha.slice(0, 7)}`, 'data-no-i18n': true }))))))
          .catch(() => seznam.replaceChildren(el('p.mcl-popis', { text: 'Historii se nepodařilo načíst (GitHub neodpovídá).' })));
      }
      return el('div.mcl-stranka', {},
        el('div.mcl-nadpis', {}, el('h2', { text: 'Poznámky k verzím' }),
          el('button.mcl-tl', { onclick: () => otevri('browser', { url: 'https://github.com/' + REPO }) }, icon('globe'), el('span', { text: 'GitHub' }))),
        el('p.mcl-popis', { text: 'Každá změna, kterou AstroMeo nahrál do hry.' }),
        seznam);
    }

    function stranaDomu() {
      const karta = el('div.mcl-domu-hra', {},
        el('div.mcl-domu-obr', {}, krajina(160, 70, 42)),
        el('div.mcl-domu-t', {}, glyfAplikace(astroMinecraftApp, 'div.mcl-inst-glyf'),
          el('div', {}, el('b', { text: 'Astro Minecraft' }), el('small', { text: 'Web Edition · zdarma' })),
          el('button.mcl-hrat.mini', { onclick: () => { st.stranka = 'hra'; st.tab = 'hrat'; kresli(); } }, el('span', { text: 'HRÁT' }))));
      return el('div.mcl-stranka', {},
        el('h2', { text: `Ahoj, ${jmeno()}!` }),
        el('p.mcl-popis', { text: 'Tvoje hry na jednom místě.' }),
        karta,
        el('h3.mcl-h3', { text: 'Novinky' }),
        novinkyKarty());
    }

    function stranaNastaveni() {
      const prepinac = (klic, nazev, popis) => {
        const sw = el('div.switch' + (data()[klic] ? '.on' : ''));
        sw.onclick = () => { const v = !data()[klic]; uloz({ [klic]: v }); sw.classList.toggle('on', v); };
        return el('div.mcl-volba', {}, el('div', {}, el('b', { text: nazev }), el('small', { text: popis })), sw);
      };
      return el('div.mcl-stranka', {},
        el('h2', { text: 'Nastavení' }),
        prepinac('zavrit', 'Po spuštění hry zavřít launcher', 'Launcher se zavře, jakmile se otevře okno hry.'),
        prepinac('maximalizovat', 'Spouštět hru maximalizovanou', 'Okno hry zabere celou plochu.'),
        el('div.mcl-volba', {}, el('div', {}, el('b', { text: 'Ovládání myší' }),
          el('small', { text: 'Klikni do hry — myš se zachytí a rozhlížíš se. Esc ji pustí.' }))));
    }

    // ---------- celé vykreslení
    function kresli() {
      kresliListu();
      const obsah = el('div.mcl-obsah');
      if (st.stranka === 'hra') {
        const tab = (id, nazev) => el('button.mcl-tab' + (st.tab === id ? '.on' : ''), { text: nazev, onclick: () => { st.tab = id; kresli(); } });
        hlavni.replaceChildren(
          el('div.mcl-hlava', {}, el('small', { text: 'ASTRO MINECRAFT: WEB EDITION' }),
            el('div.mcl-taby', {}, tab('hrat', 'Hrát'), tab('instalace', 'Instalace'), tab('poznamky', 'Poznámky k verzím'))),
          obsah);
        obsah.append({ hrat: stranaHrat, instalace: stranaInstalace, poznamky: stranaPoznamky }[st.tab]());
      } else {
        hlavni.replaceChildren(obsah);
        obsah.append({ domu: stranaDomu, novinky: () => el('div.mcl-stranka', {}, el('h2', { text: 'Co je nového' }), novinkyKarty()), nastaveni: stranaNastaveni }[st.stranka]());
      }
    }
    kresli();
  },
};
