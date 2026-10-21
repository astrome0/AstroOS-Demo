// AstroOS — POST obrazovka a spouštěcí logo

import { $, el, sleep } from './util.js';
import { logo, icon } from './icons.js';
import { verzeOS } from './aktualizace.js';
import { State } from './state.js';

const POST = [
  { t: 'AstroBIOS (C) 2026 AstroMeo Systems', c: 'hl', d: 60 },
  { t: 'Verze 2.4.1 — build 20260920', c: 'dim', d: 90 },
  { t: '', d: 120 },
  { t: 'Procesor    : Astro Core X7-9900 @ 4.20 GHz  (8C/16T)', d: 110 },
  { t: 'Paměť       : ', mem: 32768, d: 40 },
  { t: 'Detekce úložišť...', d: 160 },
  { t: '  NVMe0     : NOVA NVMe 2TB              [ OK ]', c: 'ok', d: 90 },
  { t: '  SATA0     : ASTRO SSD 1TB              [ OK ]', c: 'ok', d: 90 },
  { t: '  SATA1     : —', c: 'dim', d: 70 },
  { t: 'Řadič USB   : 6 zařízení nalezeno', d: 120 },
  { t: 'Síť         : AstroNet 2.5G  MAC 3A:F1:09:2B:77:0C', d: 130 },
  { t: 'Klávesnice  : detekována                  [ OK ]', c: 'ok', d: 80 },
  { t: '', d: 90 },
  { t: 'Pořadí spouštění: NVMe0 → AstroOS', c: 'hl', d: 200 },
  { t: 'Načítání zavaděče', dots: 3, d: 120 },
];

const STATUS = [
  'Spouštění služeb',
  'Připojování disků',
  'Načítání ovladačů',
  'Příprava plochy',
  'Téměř hotovo',
];

let skip = false;

function onSkip(e) {
  if (e.type === 'keydown' && e.key === 'F12') return;   // ať jde otevřít devtools
  skip = true;
}

/** Spustí celou sekvenci. Vrací se po dokončení. */
export async function runBoot() {
  const root = $('#boot');
  root.classList.remove('hidden', 'fade');
  skip = false;
  window.addEventListener('keydown', onSkip);
  window.addEventListener('pointerdown', onSkip);

  if (!State.get('fastboot')) await postScreen(root);
  skip = false;
  await splash(root);

  window.removeEventListener('keydown', onSkip);
  window.removeEventListener('pointerdown', onSkip);

  root.classList.add('fade');
  await sleep(500);
  root.classList.add('hidden');
  root.innerHTML = '';
}

async function postScreen(root) {
  const post = el('div.post');
  const hint = el('div.post-hint', { text: 'stiskni libovolnou klávesu pro přeskočení' });
  root.innerHTML = '';
  root.append(post, hint);

  for (const line of POST) {
    if (skip) break;
    const row = el('div.row' + (line.c ? '.' + line.c : ''));
    post.append(row);

    if (line.mem) {
      // „počítání“ paměti jako ve starém BIOSu
      row.textContent = line.t + '0 MB';
      const steps = 26;
      for (let i = 1; i <= steps; i++) {
        if (skip) break;
        row.textContent = `${line.t}${Math.round((line.mem / steps) * i)} MB`;
        await sleep(18);
      }
      row.innerHTML = `${line.t}<span class="ok">${line.mem} MB  OK</span>`;
    } else if (line.dots) {
      row.textContent = line.t;
      for (let i = 0; i < line.dots; i++) {
        if (skip) break;
        await sleep(200);
        row.textContent += '.';
      }
    } else {
      row.textContent = line.t;
    }
    await sleep(skip ? 0 : line.d);
  }

  post.append(el('div.row', {}, el('span.cursor')));
  if (!skip) await sleep(420);
  State.set('fastboot', true);
}

async function splash(root) {
  const status = el('div.status', { text: STATUS[0] });
  const splash = el('div.splash', {},
    logo('logo'),
    el('div.name', { text: 'AstroOS' }),
    el('div.spinner', {}, el('i'), el('i'), el('i'), el('i'), el('i')),
    status,
    el('div.ver', { text: `AstroOS ${verzeOS().verze} DEMO  ·  © 2026 AstroMeo  ·  All rights reserved` }),
  );
  root.innerHTML = '';
  root.append(splash);

  const krok = State.get('fastboot') ? 340 : 480;
  for (let i = 0; i < STATUS.length; i++) {
    if (skip && i > 0) break;
    status.style.opacity = '0';
    await sleep(140);
    status.textContent = STATUS[i];
    status.style.opacity = '1';
    await sleep(krok);
  }
}

/** Obrazovka po vypnutí — čeká na kliknutí a vrátí 'on'. */
export function shutdownScreen(text = 'Vypínání...') {
  return new Promise((resolve) => {
    const scr = el('div.shutdown');
    const msg = el('div.msg', { text });
    scr.append(el('div.spinner', {}, el('i'), el('i'), el('i'), el('i'), el('i')), msg);
    document.body.append(scr);

    setTimeout(() => {
      // V aplikaci (Electron) vypnutí systému zavře celé okno, jako skutečný počítač
      if (window.astroElectron) { window.astroElectron.vypnout(); return; }
      scr.innerHTML = '';
      const btn = el('button.power-btn', { title: 'Zapnout', onclick: () => { scr.remove(); resolve('on'); } }, icon('power'));
      scr.append(btn, el('div.msg', { text: 'Počítač je vypnutý', style: { fontSize: '14px', color: '#5a6b62' } }));
    }, 2200);
  });
}
