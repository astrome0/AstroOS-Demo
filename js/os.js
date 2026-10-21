// AstroOS — životní cyklus systému: boot → přihlášení → plocha → napájení

import { $, el, sleep, bus } from './util.js';
import { State } from './state.js';
import { applyVse, applyVzhled, applyAccent, applyDisplay } from './vzhled.js';
import { applyKurzor } from './kurzor.js';
import { applyWallpaper } from './wallpapers.js';
import { runBoot, shutdownScreen } from './boot.js';
import { showLock } from './lock.js';
import { initDesktop } from './desktop.js';
import { initTaskbar, toggleStart, closeAllPanels } from './taskbar.js';
import { windows, oknaPlochy, close as closeWin, focus as focusWin, getFocused, minimizeAll } from './wm.js';
import { icon, glyfAplikace } from './icons.js';
import { openApp } from './apps.js';
import { toast, closeMenu, closePopup } from './ui.js';
import { t } from './i18n.js';
import * as Akt from './aktualizace.js';
import './verze.js';   // historie verzí: přihlásí se k FS.write

let powerResolve = null;
bus.on('power', (kind) => {
  if (powerResolve) { const r = powerResolve; powerResolve = null; r(kind); }
});

const waitForPower = () => new Promise((r) => { powerResolve = r; });

async function fade(on) {
  const f = $('#fader');
  f.classList.toggle('on', on);
  await sleep(on ? 460 : 320);
}

export const OS = {
  async start() {
    applyVse();
    applyKurzor();
    applyWallpaper();
    bindShortcuts();
    hlidejNecinnost();

    // každé nastavení vzhledu se projeví hned, odkudkoli se změní
    bus.on('state:brightness', applyDisplay);
    bus.on('state:night', applyDisplay);
    bus.on('state:accent', () => applyAccent());
    bus.on('state:accentVlastni', () => applyAccent());
    // kurzor má barvu akcentu, takže se překreslí i po jeho změně
    for (const k of ['kurzor', 'kurzorVelikost', 'kurzorStopa', 'accent', 'accentVlastni']) bus.on('state:' + k, applyKurzor);
    for (const k of ['motiv', 'rohy', 'sklo', 'animace', 'panel', 'zarovnani', 'skrytPanel', 'ikony']) {
      bus.on('state:' + k, applyVzhled);
    }
    // změna panelu/ikon mění rozměry → překreslit plochu i panel
    for (const k of ['panel', 'skrytPanel', 'ikony', 'pocetPloch', 'zobrazitPlochy', 'zobrazitZvonecek', 'zobrazitPlochuBtn', 'zarovnani']) {
      bus.on('state:' + k, () => {
        if ($('#desktop').classList.contains('hidden')) return;
        initDesktop();
        initTaskbar();
      });
    }

    // Hned po dokončení instalace (oobe.js obnoví stránku) jde systém rovnou na plochu, jako Windows.
    let poOobe = !!State.get('poOobe');
    if (poOobe) {
      State.set('poOobe', false);
      $('#boot').classList.add('hidden');
      $('#fader').classList.add('on');
      setTimeout(() => $('#fader').classList.remove('on'), 120);
    }

    // Přepnutí uživatele (ucty.js) obnoví stránku — počítač neběží znovu, rovnou zámek nového účtu.
    let prepnuti = false;
    try { prepnuti = sessionStorage.getItem('astroos-prepnuti') === '1'; sessionStorage.removeItem('astroos-prepnuti'); } catch { /* nevadí */ }
    if (prepnuti && !poOobe) $('#boot').classList.add('hidden');

    // hlavní smyčka: jedno kolo = jeden běh počítače
    for (;;) {
      if (!poOobe && !prepnuti) await runBoot();
      prepnuti = false;
      // aktualizace čekající na restart dojedou 30–100 % (aktualizace.js)
      await Akt.poStartu();
      // první spuštění (nebo reset počítače) → instalace; na konci obnoví stránku
      if (!State.get('oobeHotovo')) {
        const { runOobe } = await import('./oobe.js');
        await runOobe();
      }

      // přihlašovací smyčka (zámek se může vracet bez restartu)
      for (;;) {
        const res = poOobe ? 'unlock' : await showLock();
        poOobe = false;
        if (res === 'shutdown') { await Akt.predRestartem(true); await powerOff(); break; }
        if (res === 'restart') { await fade(true); await Akt.predRestartem(); await fade(false); break; }

        enterDesktop();
        const act = await waitForPower();
        const back = await handlePower(act);
        if (back === 'reboot') break;
        // jinak pokračuje přihlašovací smyčka (zámek / odhlášení / spánek)
      }
    }
  },
};

// ---------------------------------------------------------------- plocha
function enterDesktop() {
  const desk = $('#desktop');
  desk.classList.remove('hidden');
  initDesktop();
  initTaskbar();
  import('./sit.js').then(({ spustHru }) => spustHru());

  import('./zvuk.js').then(({ zvuk }) => zvuk('prihlaseni'));
  if (State.get('aktivovano') === false) import('./aktivace.js').then(({ vodoznak }) => vodoznak());
  import('./demo.js').then(({ vodoznakUkazky }) => vodoznakUkazky());
  Akt.poPrihlaseni();
  import('./uloziste.js').then(({ automatickyUklid }) => automatickyUklid());

  setTimeout(() => {
    const h = new Date().getHours();
    const pozdrav = h < 5 ? 'Ještě vzhůru?' : h < 10 ? 'Dobré ráno' : h < 18 ? 'Hezký den' : 'Dobrý večer';
    toast({ title: `${t(pozdrav)}, ${State.get('user').name}`, body: 'AstroOS je připraven.', icon: 'star', silent: true });
  }, 700);

  if (State.get('firstRun')) {
    setTimeout(() => {
      openApp('welcome');
      State.set('firstRun', false);
    }, 900);
  }
}

function leaveDesktop() {
  closeMenu();
  closePopup(true);
  [...windows].forEach((w) => closeWin(w, true));
  document.querySelector('.aktivace-vodoznak')?.remove();
  import('./widgety.js').then(({ zastavWidgety }) => zastavWidgety());
  import('./sit.js').then(({ zastavHru }) => zastavHru());
  $('#desktop').classList.add('hidden');
  $('#taskbar-root').innerHTML = '';
  $('#toasts').innerHTML = '';
}

// ---------------------------------------------------------------- napájení
async function handlePower(kind) {
  if (kind === 'lock' || kind === 'logout') {
    await fade(true);
    leaveDesktop();
    await fade(false);
    return 'lock';
  }
  if (kind === 'sleep') {
    await fade(true);
    leaveDesktop();
    await waitClick();
    await fade(false);
    return 'lock';
  }
  if (kind === 'restart') {
    await fade(true);
    leaveDesktop();
    await Akt.predRestartem();
    await sleep(500);
    await fade(false);
    return 'reboot';
  }
  // shutdown
  await fade(true);
  leaveDesktop();
  await Akt.predRestartem(true);
  $('#fader').classList.remove('on');
  await powerOff();
  return 'reboot';
}

async function powerOff() {
  $('#wallpaper').classList.remove('blurred');
  $('#wallpaper-dim').classList.remove('on');
  await shutdownScreen('Vypínání...');
}

function waitClick() {
  return new Promise((r) => {
    const hint = el('div', {
      text: 'Spánek — klikni pro probuzení',
      style: {
        position: 'fixed', inset: 'auto 0 12% 0', textAlign: 'center', zIndex: '1000',
        color: 'rgba(255,255,255,.35)', fontSize: '13px', letterSpacing: '.05em',
      },
    });
    document.body.append(hint);
    const go = () => {
      window.removeEventListener('pointerdown', go);
      window.removeEventListener('keydown', go);
      hint.remove();
      r();
    };
    window.addEventListener('pointerdown', go);
    window.addEventListener('keydown', go);
  });
}

// ---------------------------------------------------------------- zamknutí po nečinnosti
function hlidejNecinnost() {
  let naposledy = Date.now();
  const probud = () => { naposledy = Date.now(); };
  for (const ev of ['pointerdown', 'pointermove', 'keydown', 'wheel']) {
    window.addEventListener(ev, probud, { passive: true });
  }
  setInterval(() => {
    const minut = State.get('zamknoutPo') || 0;
    if (!minut) return;
    if ($('#desktop').classList.contains('hidden')) { probud(); return; }
    if (Date.now() - naposledy >= minut * 60000) {
      probud();
      bus.emit('power', 'lock');
    }
  }, 5000);
}

// ---------------------------------------------------------------- přepínač oken (Alt+Tab)
let prepinac = null;

function otevriPrepinac(smer) {
  const okna = oknaPlochy().sort((a, b) => +b.node.style.zIndex - +a.node.style.zIndex);
  if (okna.length < 2) {
    if (okna.length === 1) focusWin(okna[0]);
    return;
  }

  if (!prepinac) {
    const box = el('div.prepinac');
    document.body.append(box);
    // start na druhém okně — jedno ťuknutí přepne na předchozí, jako ve Windows
    prepinac = { box, okna, i: 1, polozky: [] };

    for (const w of okna) {
      const p = el('div.prep-i', {},
        glyfAplikace(w.app, 'div.prep-ic'),
        el('div.prep-t', { text: w.title }),
      );
      p.onclick = () => { prepinac.i = okna.indexOf(w); zavriPrepinac(true); };
      p.onpointerenter = () => { prepinac.i = okna.indexOf(w); zvyrazni(); };
      box.append(p);
      prepinac.polozky.push(p);
    }
  } else {
    prepinac.i += smer;
  }
  const n = prepinac.okna.length;
  prepinac.i = ((prepinac.i % n) + n) % n;
  zvyrazni();
}

function zvyrazni() {
  prepinac?.polozky.forEach((p, i) => p.classList.toggle('on', i === prepinac.i));
}

function zavriPrepinac(prepnout = true) {
  if (!prepinac) return;
  const cil = prepinac.okna[prepinac.i];
  prepinac.box.remove();
  prepinac = null;
  if (prepnout && cil) focusWin(cil);
}

// ---------------------------------------------------------------- klávesové zkratky
function bindShortcuts() {
  // vlastní nabídka místo té prohlížečové
  window.addEventListener('contextmenu', (e) => {
    if (e.target.closest('input, textarea')) return;
    e.preventDefault();
  });

  let metaDown = false;
  window.addEventListener('keydown', (e) => {
    if ($('#desktop').classList.contains('hidden')) return;
    const meta = e.metaKey || e.key === 'Meta';

    if (e.key === 'Meta') { metaDown = true; return; }
    if (e.key === 'Escape') {
      // Ctrl+Esc otevírá Start — musí se řešit tady, jinak ho spolkne zavírání panelů
      if (e.ctrlKey) { e.preventDefault(); toggleStart(); return; }
      if (prepinac) return zavriPrepinac(false);
      closeMenu(); closePopup(); return;
    }

    if (e.key === 'Tab' && e.altKey) {
      e.preventDefault();
      otevriPrepinac(e.shiftKey ? -1 : 1);
      return;
    }

    if (meta && e.key.toLowerCase() === 'l') { e.preventDefault(); bus.emit('power', 'lock'); return; }
    if (meta && e.key.toLowerCase() === 'd') { e.preventDefault(); minimizeAll(); return; }
    if (e.altKey && e.key === 'F4') {
      e.preventDefault();
      const f = getFocused();
      if (f) closeWin(f); else bus.emit('power', 'shutdown');
      return;
    }
    if (metaDown) metaDown = false;   // Win + jiná klávesa už Start neotevře
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'Alt' && prepinac) zavriPrepinac(true);
    if (e.key === 'Meta' && metaDown) {
      metaDown = false;
      if (!$('#desktop').classList.contains('hidden')) toggleStart();
    }
  });

  window.addEventListener('blur', () => { metaDown = false; zavriPrepinac(false); });
  window.addEventListener('resize', closeAllPanels);
}
