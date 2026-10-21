// AstroOS — hlavní panel, oznamovací oblast a její panely

import { $, el, cz, bus, pad, plural, clamp } from './util.js';
import { icon, logo, glyfAplikace } from './icons.js';
import { State } from './state.js';
import { APPS, panelPins, prepniPin, jePripnuto, openApp } from './apps.js';
import { windows, oknaPlochy, getPlocha, prepniPlochu, getFocused, focus, minimize, close, minimizeAll } from './wm.js';
import { popup, popupId, closePopup, contextMenu, tooltip, toast, notifications, notifItem, hideTip } from './ui.js';
import { buildStartMenu } from './startmenu.js';
import { ACCENTS } from './state.js';
import { applyAccent } from './vzhled.js';
import * as Obrana from './obrana.js';
import * as Ovladace from './ovladace.js';
import * as Sit from './sit.js';
import { tx } from './i18n.js';

let bar, centerEl, clockEl, bellEl, trayEl, startBtn, wsEl, stitEl;

export function initTaskbar() {
  const root = $('#taskbar-root');
  root.innerHTML = '';

  // --- levá část: přepínač ploch ---
  wsEl = el('div.ws');
  const pocetPloch = clamp(State.get('pocetPloch') ?? 2, 1, 4);
  if (!State.get('zobrazitPlochy') || pocetPloch < 2) wsEl.classList.add('hidden');
  for (let i = 0; i < pocetPloch; i++) {
    const b = el('b', { class: i === State.get('workspace') ? 'on' : '' });
    b.onclick = () => {
      State.set('workspace', i);
      prepniPlochu(i);
      [...wsEl.children].forEach((c, j) => c.classList.toggle('on', j === i));
      const pocet = oknaPlochy(i).length;
      toast({
        title: `Plocha ${i + 1}`,
        body: pocet ? plural(pocet, ['okno', 'okna', 'oken']) : 'Prázdná plocha',
        icon: 'grid', timeout: 1800,
      });
    };
    tooltip(b, `Plocha ${i + 1}`);
    wsEl.append(b);
  }

  // --- střed: start + aplikace ---
  startBtn = el('button.tb-btn.tb-start', { title: 'Start' }, logo('logo'));
  startBtn.onclick = () => toggleStart();
  tooltip(startBtn, 'Start');

  centerEl = el('div.tb-center', {}, startBtn);

  // --- pravá část: oznamovací oblast ---
  trayEl = el('button.tray', {}, ...ikonyTray());
  trayEl.onclick = () => togglePanel('qs', quickSettings(), trayEl, 'right');
  tooltip(trayEl, 'Síť a zvuk');

  stitEl = el('button.tb-btn.tb-obrana');
  stitEl.onclick = () => { hideTip(); openApp('defender'); };
  stitEl.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const bezi = !!Obrana.probihajici();
    contextMenu([
      { icon: 'shield', label: 'Otevřít Astro Defender', onClick: () => openApp('defender') },
      { icon: 'radar', label: bezi ? 'Kontrola už probíhá' : 'Rychlá kontrola', disabled: bezi, onClick: () => Obrana.spustKontrolu('rychla') },
      { icon: 'clock', label: 'Historie ochrany', onClick: () => openApp('defender', { stranka: 'historie' }) },
    ], { x: e.clientX, y: e.clientY, align: 'br' });
  });
  aktualizujStit();
  Obrana.spustSluzbu();
  Ovladace.spustSluzbu();
  setTimeout(() => import('./nakaza.js').then((m) => m.spust()), 1500);

  clockEl = el('button.tb-clock', {}, el('div.t'), el('div.d'));
  clockEl.onclick = () => togglePanel('cal', calendarPanel(), clockEl, 'right');

  bellEl = el('button.tb-btn.tb-bell', {}, icon(State.get('dnd') ? 'bellOff' : 'bell'));
  bellEl.onclick = () => togglePanel('notif', notifPanel(), bellEl, 'right');
  tooltip(bellEl, 'Oznámení');
  if (!State.get('zobrazitZvonecek')) bellEl.classList.add('hidden');

  const showDesk = el('button.tb-btn.show-desktop', {});
  showDesk.onclick = () => minimizeAll();
  tooltip(showDesk, 'Zobrazit plochu');
  if (!State.get('zobrazitPlochuBtn')) showDesk.classList.add('hidden');

  bar = el('div.taskbar', {},
    el('div.tb-left', {}, wsEl),
    centerEl,
    el('div.tb-right', {}, stitEl, trayEl, clockEl, bellEl, showDesk),
  );
  bar.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.tb-btn, .tray, .tb-clock')) return;
    e.preventDefault();
    contextMenu([
      { icon: 'monitor', label: 'Zobrazit plochu', onClick: minimizeAll },
      { icon: 'cpu', label: 'Správce úloh', onClick: () => openApp('monitor') },
      'sep',
      { icon: 'settings', label: 'Nastavení hlavního panelu', onClick: () => openApp('settings') },
    ], { x: e.clientX, y: e.clientY });
  });

  root.append(bar);
  renderButtons();
  tick();
  setInterval(tick, 1000);

  bus.on('wm:change', renderButtons);
  bus.on('piny', renderButtons);
  bus.on('notif', updateBell);
  bus.on('state:wifi', updateTray);
  bus.on('sit:zmena', updateTray);
  bus.on('state:volume', updateTray);
  bus.on('state:dnd', updateBell);
  bus.on('obrana', aktualizujStit);
  bus.on('obrana:prubeh', (b) => { if (!!b !== stitEl.classList.contains('skenuje')) aktualizujStit(); });
  for (const k of ['wifi', 'user', 'zamknoutPo']) bus.on('state:' + k, aktualizujStit);
  bus.on('sit:zmena', aktualizujStit);
  updateBell();
}

function aktualizujStit() {
  if (!stitEl) return;
  const stav = Obrana.celkovyStav();
  const bezi = !!Obrana.probihajici();
  const ic = { ok: 'shield', varovani: 'shieldAlert', kriticke: 'shieldX' }[stav];
  stitEl.className = `tb-btn tb-obrana ${stav}${bezi ? ' skenuje' : ''}`;
  stitEl.replaceChildren(icon(ic));
  stitEl.title = bezi ? 'Astro Defender · probíhá kontrola'
    : { ok: 'Astro Defender · zařízení je chráněné', varovani: 'Astro Defender · doporučujeme akce', kriticke: 'Astro Defender · vyžaduje akci' }[stav];
}

function volIcon() {
  const v = State.get('volume');
  return v === 0 ? 'volumeOff' : 'volume';
}

/** Ikona sítě: letadlo, připojeno, nebo přeškrtnutá Wi-Fi. */
const ikonaSite = () => (Sit.letadlo() && !Sit.wifiZapnuta() ? 'letadlo' : Sit.online() ? 'wifi' : 'wifiOff');
const ikonyTray = () => [icon(ikonaSite()), icon(volIcon())];

function updateTray() {
  trayEl?.replaceChildren(...ikonyTray());
}

function updateBell() {
  const n = notifications.length;
  bellEl.replaceChildren(icon(State.get('dnd') ? 'bellOff' : 'bell'));
  if (n && !State.get('dnd')) bellEl.append(el('span.dot', { text: n > 9 ? '9+' : String(n) }));
}

function tick() {
  const d = new Date();
  const h24 = State.get('hodiny24') !== false;
  const h = h24 ? d.getHours() : (d.getHours() % 12 || 12);
  const sek = State.get('sekundy') ? ':' + pad(d.getSeconds()) : '';
  const dopo = h24 ? '' : (d.getHours() < 12 ? tx(' dop.', ' AM') : tx(' odp.', ' PM'));
  clockEl.firstChild.textContent = `${h}:${pad(d.getMinutes())}${sek}${dopo}`;

  const ukazDatum = State.get('datumVPanelu') !== false;
  clockEl.lastChild.textContent = ukazDatum ? cz.datumKratky(d) : '';
  clockEl.lastChild.classList.toggle('hidden', !ukazDatum);
}

// ---------------------------------------------------------------- tlačítka aplikací
function renderButtons() {
  // panel ukazuje jen okna z aktuální plochy
  const nasePlose = oknaPlochy();
  const running = [...new Set(nasePlose.map((w) => w.app.id))];
  const ids = [...new Set([...panelPins(), ...running])];
  const foc = getFocused();

  [...centerEl.querySelectorAll('.tb-app')].forEach((n) => n.remove());
  [...wsEl.children].forEach((c, j) => c.classList.toggle('plna', oknaPlochy(j).length > 0));

  for (const id of ids) {
    const a = APPS[id];
    if (!a) continue;
    const wins = nasePlose.filter((w) => w.app.id === id);
    const b = el('button.tb-btn.tb-app', { dataset: { id } },
      glyfAplikace(a),
      el('span.run'),
    );
    if (wins.length) b.classList.add('running');
    if (foc && foc.app.id === id) b.classList.add('focused');

    b.onclick = () => {
      hideTip();
      const open = oknaPlochy().filter((w) => w.app.id === id);
      if (!open.length) return openApp(id);
      const f = getFocused();
      if (f && f.app.id === id && !f.minimized) minimize(f);
      else focus(open.find((w) => w.minimized) || open[0]);
    };
    b.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      contextMenu([
        { icon: 'arrowRight', label: 'Otevřít', onClick: () => openApp(id) },
        {
          icon: 'pin',
          label: jePripnuto('pinyPanel', id) ? 'Odepnout z panelu' : 'Připnout na panel',
          onClick: () => {
            const pripnuto = prepniPin('pinyPanel', id);
            renderButtons();
            toast({ title: pripnuto ? 'Připnuto na panel' : 'Odepnuto z panelu', body: a.name, icon: 'pin', timeout: 2200 });
          },
        },
        'sep',
        { icon: 'x', label: 'Zavřít okno', danger: true, disabled: !wins.length, onClick: () => wins.forEach(close) },
      ], { x: e.clientX, y: e.clientY });
    });
    tooltip(b, a.name);
    centerEl.append(b);
  }
}

// ---------------------------------------------------------------- panely
function togglePanel(id, node, anchor, align) {
  const was = popupId();
  const open = popup({ id, node, anchor, align, onClose: () => anchor.classList.remove('active') });
  anchor.classList.toggle('active', !!open);
  if (was && was !== id) { /* přepnutí mezi panely */ }
  return open;
}

export function toggleStart() {
  const open = togglePanel('start', buildStartMenu(), startBtn, 'center');
  startBtn.classList.toggle('active', !!open);
  return open;
}

export function closeAllPanels() {
  closePopup();
  startBtn?.classList.remove('active');
}

// --- rychlá nastavení ---
function quickSettings() {
  const wrap = el('div.qs');
  const grid = el('div.qs-grid');

  const tile = (key, label, ic, onToggle) => {
    const t = el('div.qs-tile' + (State.get(key) ? '.on' : ''), {}, icon(ic), el('span', { text: label }));
    t.onclick = () => {
      const v = !State.get(key);
      State.set(key, v);
      t.classList.toggle('on', v);
      onToggle?.(v, t);
    };
    return t;
  };

  // Wi-Fi: klik = zapnout/vypnout, šipka = seznam sítí
  const wifiTile = el('div.qs-tile.qs-split');
  const kresliWifi = () => {
    wifiTile.classList.toggle('on', Sit.wifiZapnuta());
    const sipka = el('button.qs-sipka', { title: 'Sítě v dosahu' }, icon('chevronRight'));
    sipka.onclick = (e) => { e.stopPropagation(); ukazSite(); };
    wifiTile.replaceChildren(icon(Sit.online() ? 'wifi' : 'wifiOff'),
      el('span', { text: Sit.wifiZapnuta() ? (Sit.aktualni()?.ssid || 'Wi-Fi') : 'Wi-Fi vyp.' }), sipka);
  };
  wifiTile.onclick = () => { Sit.nastavWifi(!Sit.wifiZapnuta()); kresliWifi(); };
  kresliWifi();

  const btTile = tile('bluetooth', 'Bluetooth', 'bluetooth');
  const letadloTile = el('div.qs-tile' + (Sit.letadlo() ? '.on' : ''), {}, icon('letadlo'), el('span', { text: 'Letadlo' }));
  letadloTile.onclick = () => {
    Sit.nastavLetadlo(!Sit.letadlo());
    letadloTile.classList.toggle('on', Sit.letadlo());
    btTile.classList.toggle('on', !!State.get('bluetooth'));
    kresliWifi();
    toast({
      title: Sit.letadlo() ? 'Režim Letadlo zapnutý' : 'Režim Letadlo vypnutý',
      body: Sit.letadlo() ? 'Internet je pryč. AstroAI pořád odpovídá — model běží u tebe.' : Sit.popis(),
      icon: Sit.letadlo() ? 'letadlo' : 'wifi',
    });
  };

  grid.append(
    wifiTile,
    btTile,
    letadloTile,
    tile('night', 'Noční režim', 'night'),
    tile('dnd', 'Nerušit', 'bellOff'),
    el('div.qs-tile', { onclick: () => { closePopup(); openApp('settings'); } }, icon('settings'), el('span', { text: 'Nastavení' })),
  );

  const slider = (key, ic, min, max, onInput) => {
    const val = el('span.v', { text: State.get(key) + ' %' });
    const inp = el('input', { type: 'range', min, max, value: State.get(key) });
    inp.oninput = () => {
      const v = +inp.value;
      State.set(key, v);
      val.textContent = v + ' %';
      onInput?.(v);
    };
    return el('div.qs-slider', {}, icon(ic), inp, val);
  };

  // barvy systému
  const accents = el('div.qs-slider', {}, icon('palette'),
    el('div', { style: { display: 'flex', gap: '8px', flex: '1' } },
      Object.entries(ACCENTS).map(([id, a]) => {
        const dot = el('button', {
          title: a.name,
          style: {
            width: '20px', height: '20px', borderRadius: '50%', background: a.accent,
            border: State.get('accent') === id ? '2px solid #fff' : '2px solid transparent',
            boxShadow: '0 0 0 1px rgba(0,0,0,.4)',
          },
        });
        dot.onclick = () => {
          State.set('accent', id);
          applyAccent(id);
          [...accents.querySelectorAll('button')].forEach((b) => (b.style.border = '2px solid transparent'));
          dot.style.border = '2px solid #fff';
        };
        return dot;
      }),
    ),
  );

  wrap.append(grid,
    slider('volume', 'volume', 0, 100),
    slider('brightness', 'brightness', 20, 100),
    accents,
    el('div.qs-foot', {},
      el('div.batt', {}, icon(ikonaSite()), el('span', { text: Sit.popis() })),
      el('button', { title: 'Všechna nastavení', onclick: () => { closePopup(); openApp('settings'); } }, icon('settings')),
    ),
  );
  const hlavni = [...wrap.children];

  /** Seznam sítí v dosahu přímo v panelu (jako ve Windows 11). */
  function ukazSite() {
    const seznam = el('div.qs-site');
    let rozbalena = null;
    const prepnout = el('div.switch' + (Sit.wifiZapnuta() ? '.on' : ''));
    prepnout.onclick = () => { Sit.nastavWifi(!Sit.wifiZapnuta()); prepnout.classList.toggle('on', Sit.wifiZapnuta()); kresli(); };

    const sila = (n) => el('span.qs-sila', { title: `Signál ${n}/4` }, [1, 2, 3, 4].map((i) => el('i' + (i <= n ? '.on' : ''))));

    function radek(s) {
      const stav = s.pripojena ? 'Připojeno' + (s.zabezpeceni ? ', zabezpečeno' : '')
        : s.zabezpeceni ? (s.znama ? 'Uloženo, zabezpečeno' : 'Zabezpečeno') : 'Otevřená';
      const hlava = el('div.qs-sit-hlava', {},
        sila(s.sila),
        el('div.qs-sit-txt', {}, el('b', { text: s.ssid }), el('span', { text: stav })),
        s.zabezpeceni && !s.znama ? icon('lock') : null);
      hlava.onclick = () => { rozbalena = rozbalena === s.id ? null : s.id; kresli(); };
      const r = el('div.qs-sit' + (s.pripojena ? '.pripojena' : '') + (rozbalena === s.id ? '.rozbalena' : ''), {}, hlava);
      if (rozbalena !== s.id) return r;

      if (s.pripojena) {
        r.append(el('div.qs-sit-akce', {},
          el('button.btn', { text: 'Odpojit', onclick: () => { Sit.odpoj(); rozbalena = null; kresli(); kresliWifi(); } })));
        return r;
      }
      const zprava = el('div.qs-sit-zprava');
      const tlacitko = el('button.btn.primary', { text: 'Připojit' });
      const heslo = s.zabezpeceni && !s.znama ? el('input.qs-heslo', { type: 'password', placeholder: 'Heslo k síti', spellcheck: 'false' }) : null;
      const pripoj = async () => {
        tlacitko.disabled = true;
        tlacitko.textContent = 'Připojuji…';
        zprava.textContent = '';
        const v = await Sit.pripoj(s.id, heslo?.value || '');
        if (v.ok) { rozbalena = null; kresli(); kresliWifi(); return; }
        tlacitko.disabled = false;
        tlacitko.textContent = 'Připojit';
        zprava.textContent = v.chyba;
        heslo?.select();
      };
      tlacitko.onclick = pripoj;
      if (heslo) {
        heslo.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') pripoj(); };
        setTimeout(() => heslo.focus(), 30);
      }
      r.append(
        heslo || '',
        s.napoveda && !s.znama ? el('div.qs-sit-tip', {}, icon('info'), el('span', { text: s.napoveda })) : '',
        zprava,
        el('div.qs-sit-akce', {}, tlacitko),
      );
      return r;
    }

    function kresli() {
      const site = Sit.vDosahu();
      seznam.replaceChildren(...(site.length ? site.map(radek)
        : [el('div.qs-site-nic', { text: Sit.letadlo() ? 'Režim Letadlo je zapnutý. Wi-Fi můžeš zapnout i tak.' : 'Wi-Fi je vypnutá.' })]));
    }
    kresli();
    const hra = Sit.stavHry();

    wrap.replaceChildren(
      el('div.qs-site-hlava', {},
        el('button.qs-zpet', { title: 'Zpět', onclick: () => { wrap.replaceChildren(...hlavni); kresliWifi(); } }, icon('chevronLeft')),
        el('b', { text: 'Wi-Fi' }), prepnout),
      seznam,
      el('div.qs-foot', {},
        el('div.batt', { title: 'Sítě, ke kterým ses dostal' }, icon('key'), el('span', { text: `Síťový detektiv ${hra.nalezeno}/${hra.celkem}` })),
        el('button', { title: 'Další nastavení sítě', onclick: () => { closePopup(); openApp('settings', { section: 'sit' }); } }, icon('settings'))),
    );
  }
  if (otevritSite) { otevritSite = false; ukazSite(); }
  return wrap;
}

let otevritSite = false;
/** Otevře rychlá nastavení rovnou na seznamu sítí (z oznámení „Nová síť v dosahu“). */
export function otevriSite() {
  if (!trayEl) return;
  closePopup();
  otevritSite = true;
  togglePanel('qs', quickSettings(), trayEl, 'right');
}

// --- kalendář ---
function calendarPanel() {
  const wrap = el('div.cal');
  const now = new Date();
  let view = new Date(now.getFullYear(), now.getMonth(), 1);

  const big = el('div.cal-big', { html: `${cz.casS()}<span>${cz.datumDlouhy()}</span>` });
  const timer = setInterval(() => {
    if (!wrap.isConnected) return clearInterval(timer);
    big.innerHTML = `${cz.casS()}<span>${cz.datumDlouhy()}</span>`;
  }, 1000);

  const title = el('div', { text: cz.mesicRok(view) });
  const grid = el('div.cal-grid');

  function draw() {
    title.textContent = cz.mesicRok(view);
    grid.innerHTML = '';
    for (const d of cz.dnyTydne()) grid.append(el('div.dow', { text: d }));

    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const shift = (first.getDay() + 6) % 7;            // pondělí první
    const start = new Date(first);
    start.setDate(1 - shift);

    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const cls = ['day'];
      if (d.getMonth() !== view.getMonth()) cls.push('mute');
      if ([0, 6].includes(d.getDay())) cls.push('we');
      if (d.toDateString() === now.toDateString()) cls.push('today');
      grid.append(el('div.' + cls.join('.'), { text: String(d.getDate()) }));
    }
  }
  draw();

  wrap.append(big,
    el('div.cal-head', {}, title, el('div.nav', {},
      el('button', { onclick: () => { view.setMonth(view.getMonth() - 1); draw(); } }, icon('chevronLeft')),
      el('button', { onclick: () => { view = new Date(now.getFullYear(), now.getMonth(), 1); draw(); } }, icon('clock')),
      el('button', { onclick: () => { view.setMonth(view.getMonth() + 1); draw(); } }, icon('chevronRight')),
    )),
    grid,
  );
  return wrap;
}

// --- oznámení ---
function notifPanel() {
  const list = el('div.notif-list');
  const draw = () => {
    list.innerHTML = '';
    if (!notifications.length) {
      list.append(el('div.notif-empty', {}, icon('bell'), el('div', { text: 'Žádná nová oznámení' })));
      return;
    }
    notifications.forEach((n) => list.append(notifItem(n)));
  };
  draw();

  return el('div.notif', {},
    el('div.notif-head', {},
      el('span', { text: 'Oznámení' }),
      el('button', {
        text: 'Vymazat vše',
        onclick: () => { notifications.length = 0; draw(); updateBell(); },
      }),
    ),
    list,
  );
}
