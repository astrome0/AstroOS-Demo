// AstroOS — trvalé nastavení systému (localStorage)

import { bus } from './util.js';
import { klic } from './profil.js';

// každý účet má vlastní nastavení (profil.js): hlavní „astroos.v1“, další „astroos.v1.u.<id>“
const KEY = klic('astroos.v1');

const DEFAULT = {
  user: { name: 'Uživatel', password: 'astro', hint: 'jméno systému malými písmeny', avatar: 'U' },
  wallpaper: 'aurora',
  customWallpaper: null,      // obrázek vybraný ve Fotkách
  customWallpaperName: '',
  accent: 'green',
  accentVlastni: '#46c36f',

  // vzhled (výchozí hodnoty drží js/vzhled.js)
  motiv: 'tmavy',
  rohy: 'normal',
  sklo: 'silne',
  animace: 'plne',
  panel: 'normal',
  zarovnani: 'uprostred',
  skrytPanel: false,
  ikony: 'stredni',
  pocetPloch: 2,
  hodiny24: true,
  sekundy: false,
  datumVPanelu: true,
  zobrazitPlochy: true,
  zobrazitZvonecek: true,
  zobrazitPlochuBtn: true,

  // systém
  jmenoPc: 'astro',
  zamknoutPo: 0,              // minuty nečinnosti, 0 = nikdy
  zvuky: true,
  avatarObrazek: null,        // cesta k obrázku z Fotek
  volume: 62,
  brightness: 92,
  wifi: true,
  bluetooth: false,
  night: false,
  dnd: false,
  fastboot: false,      // přeskočí POST po prvním spuštění
  aiRezim: 'auto',      // auto | server | mistni
  aiAdresa: '/ai',      // jen v plné verzi (ukázka AI nemá, viz js/demo.js)
  aiModel: '',
  aiTeplota: 0.7,
  workspace: 0,
  iconPos: {},          // id → { col, row }
  iconNames: {},        // id → vlastní název
  firstRun: true,
  installed: Date.now(),
};

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { ...DEFAULT, ...raw, user: { ...DEFAULT.user, ...(raw.user || {}) } };
  } catch {
    return { ...DEFAULT };
  }
}

export const State = {
  data: load(),

  get(k) { return this.data[k]; },

  set(k, v) {
    this.data[k] = v;
    this.save();
    bus.emit('state:' + k, v);
    bus.emit('state', { key: k, value: v });
  },

  patch(obj) {
    Object.assign(this.data, obj);
    this.save();
    for (const k of Object.keys(obj)) bus.emit('state:' + k, obj[k]);
    bus.emit('state', { key: null, value: obj });
  },

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* plné úložiště, nevadí */ }
  },

  reset() {
    try { localStorage.removeItem(KEY); } catch { /* nevadí */ }
    this.data = { ...DEFAULT };
  },
};

export const ACCENTS = {
  green: { name: 'Mátová', accent: '#46c36f', deep: '#2b9b53', text: '#0b1410' },
  blue: { name: 'Nebeská', accent: '#4aa3e8', deep: '#2b7ab8', text: '#061119' },
  violet: { name: 'Fialová', accent: '#a077f0', deep: '#7a52c8', text: '#0d0818' },
  amber: { name: 'Jantarová', accent: '#e0a63c', deep: '#b8802a', text: '#181005' },
  rose: { name: 'Růžová', accent: '#ef6f8e', deep: '#c44b6b', text: '#1a0a0f' },
};
