// AstroOS — Astro Defender: jádro ochrany
//
// Kontroly procházejí skutečný virtuální disk (fs.js) a načtené soubory systému,
// nalezené hrozby jdou do karantény (/system/obrana/Karanténa, obsah zakódovaný, ať
// se nedá omylem otevřít). Ochrana v reálném čase poslouchá `fs:change`.
// Pravidla jsou schválně jednoduchá: testovací soubor, maskované přípony, cracky
// a podvodné přihlašovací stránky. Stav a historie žijí v nastavení pod klíčem `obrana`.

import { bus, sleep, plural } from './util.js';
import { State } from './state.js';
import * as FS from './fs.js';
import { toast } from './ui.js';
import { profil as profilSite } from './sit.js';

const KLIC = 'obrana';
export const KARANTENA = '/system/obrana/Karanténa';

/** Obsah testovacího souboru — napiš ho do libovolného souboru a Defender ho chytí. */
export const TESTOVACI_TEXT = 'ASTRO-DEFENDER-TEST-FILE';

export const ZAVAZNOST = {
  zavazna: { nazev: 'Závažná', poradi: 4 },
  vysoka: { nazev: 'Vysoká', poradi: 3 },
  stredni: { nazev: 'Střední', poradi: 2 },
  nizka: { nazev: 'Nízká', poradi: 1 },
};

const PRAVIDLA = [
  {
    nazev: 'Virus:Astro/TestovaciSoubor', kategorie: 'Virus', zavaznost: 'zavazna',
    popis: 'Neškodný testovací soubor. Slouží jen k ověření, že antivirová ochrana funguje.',
    obsah: (c) => c.includes(TESTOVACI_TEXT),
  },
  {
    nazev: 'Trojan:Win32/Maskovani.A', kategorie: 'Trojský kůň', zavaznost: 'vysoka',
    popis: 'Soubor předstírá, že je dokument nebo obrázek, ale podle přípony je to program.',
    jmeno: /\.(pdf|docx?|xlsx?|pptx?|jpe?g|png|gif|txt|mp3|mp4)\.(exe|scr|com|pif|bat|cmd|vbs)$/i,
  },
  {
    nazev: 'HackTool:Win32/Keygen', kategorie: 'Hackerský nástroj', zavaznost: 'stredni',
    popis: 'Nástroj na nelegální aktivaci programů. Takové soubory často nesou další škodlivý kód.',
    jmeno: /(keygen|crack|activator|patcher)[^/]*\.(exe|zip|rar|7z|bat|cmd)$/i,
  },
  {
    nazev: 'PUA:Win32/Bundler', kategorie: 'Potenciálně nežádoucí aplikace', zavaznost: 'nizka',
    popis: 'Instalátor, který spolu s programem přidá reklamy nebo další nevyžádané aplikace.',
    jmeno: /(setup|install)[^/]*(free|zdarma|premium|full)[^/]*\.exe$/i,
  },
  {
    nazev: 'Trojan:HTML/Phish.A!ml', kategorie: 'Phishing', zavaznost: 'vysoka', cloud: true,
    popis: 'Stránka chce heslo a láká na něco zdarma nebo na „ověření účtu“. Typický podvod na krádež účtu.',
    html: (c) => /type\s*=\s*["']?password/i.test(c)
      && /(robux|v-?bucks|zdarma|free|výhr|vyhr|ověř(it|te)?\s+(svůj\s+)?účet|verify\s+your\s+account)/i.test(c),
  },
];

const CHRANENE = ['Dokumenty', 'Obrázky', 'Hudba', 'Plocha', 'Nahrávky'].map((s) => FS.HOME + '/' + s);

const VYCHOZI = {
  rt: true, cloud: true, vzorky: true, tamper: true,
  cfa: false, cfaSlozky: CHRANENE, cfaPovolene: [],
  vylouceni: [], povolene: [], hrozby: [], karantena: [], historie: [],
  posledniKontrola: null, definice: Date.now() - 5 * 3600e3,
  firewall: { domena: true, soukroma: true, verejna: true }, fwBlok: {},
  smartscreen: true, kontrolaAplikaci: true, integritaPameti: true,
  rtVypnuto: 0,
};

const data = { ...VYCHOZI, ...(State.get(KLIC) || {}) };
export const nastaveni = () => data;

function uloz() {
  State.set(KLIC, data);
  bus.emit('obrana', data);
}

export function nastav(klic, hodnota) {
  data[klic] = hodnota;
  if (klic === 'rt') {
    data.rtVypnuto = hodnota ? 0 : Date.now();
    zapis({ typ: 'nastaveni', nadpis: hodnota ? 'Ochrana v reálném čase zapnuta' : 'Ochrana v reálném čase vypnuta' });
    // po zapnutí se ochrana hned podívá na to, co mezitím proklouzlo
    if (hodnota) setTimeout(() => { infekce().hlavni.forEach((c) => fronta.add(c)); if (fronta.size) zpracujFrontu(); }, 400);
  }
  uloz();
}

// ---------------------------------------------------------------- historie
export function zapis(z) {
  data.historie.unshift({ id: noveId(), cas: Date.now(), ...z });
  data.historie.length = Math.min(data.historie.length, 200);
}

export function smazHistorii() {
  data.historie = [];
  uloz();
}

const noveId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ---------------------------------------------------------------- rozpoznávání
function otisk(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
}

export const jeVylouceno = (cesta) => data.vylouceni.some((v) => cesta === v || cesta.startsWith(v + '/'));

/** Vrátí hrozbu pro soubor, nebo null. */
export function zkontrolujSoubor(cesta) {
  if (cesta.startsWith('/system/obrana') || jeVylouceno(cesta)) return null;
  const uzel = FS.get(cesta);
  if (!FS.isFile(uzel)) return null;
  const jmeno = FS.basename(cesta);
  const c = uzel.c;
  const binarni = c.startsWith('data:') || c.startsWith('astro-img:');
  const html = /\.html?$/i.test(jmeno);

  for (const p of PRAVIDLA) {
    if (p.cloud && !data.cloud) continue;
    const zasah = (p.jmeno && p.jmeno.test(jmeno))
      || (p.obsah && !binarni && p.obsah(c))
      || (p.html && html && p.html(c));
    if (!zasah) continue;
    const hash = otisk(jmeno + '\n' + c);
    if (data.povolene.some((x) => x.hash === hash)) return null;
    return {
      id: noveId(), cesta, jmeno, hash, nazev: p.nazev, kategorie: p.kategorie,
      zavaznost: p.zavaznost, popis: p.popis, cas: Date.now(),
    };
  }
  return null;
}

function projdi(koren, ven, limit = Infinity) {
  const uzel = FS.get(koren);
  if (FS.isFile(uzel)) { ven.push(koren); return; }
  if (!FS.isDir(uzel) || koren.startsWith('/system/obrana')) return;
  for (const it of FS.list(koren, { hidden: true })) {
    if (ven.length >= limit) return;
    if (it.dir) projdi(it.path, ven, limit);
    else ven.push(it.path);
  }
}

/** Rychlé ověření složky (třeba aplikace před spuštěním). */
export function zkontrolujSlozku(slozka) {
  const soubory = [];
  projdi(slozka, soubory, 2000);
  return soubory.map(zkontrolujSoubor).filter(Boolean);
}

/** Kontrola aplikace před spuštěním. Vrací nalezené hrozby (prázdné pole = smí běžet). */
export function kontrolaPredSpustenim(slozka, nazev) {
  if (!data.kontrolaAplikaci) return [];
  const nalezene = zkontrolujSlozku(slozka);
  if (!nalezene.length) return [];
  for (const h of nalezene) {
    if (!data.hrozby.some((x) => x.cesta === h.cesta && x.nazev === h.nazev)) data.hrozby.push(h);
  }
  zapis({ typ: 'blokovano', nadpis: 'Spuštění aplikace zablokováno', text: `${nazev}: ${nalezene.map((h) => h.nazev).join(', ')}`, zavaznost: nalezene[0].zavaznost });
  uloz();
  return nalezene;
}

// ---------------------------------------------------------------- kontroly
export const TYPY = {
  rychla: { nazev: 'Rychlá kontrola', prodleva: 45 },
  uplna: { nazev: 'Úplná kontrola', prodleva: 60 },
  vlastni: { nazev: 'Vlastní kontrola', prodleva: 50 },
  offline: { nazev: 'Kontrola Astro Defender offline', prodleva: 40 },
};

let beh = null;
export const probihajici = () => beh;

async function cileKontroly(typ, cesta) {
  const cile = [];
  const disk = (koren) => { const s = []; projdi(koren, s); s.forEach((p) => cile.push({ cesta: p, disk: true })); };

  if (typ === 'vlastni') {
    disk(cesta);
    return cile;
  }

  // paměť: běžící okna a načtené soubory systému (důvěryhodné, jen se započítají)
  const { windows } = await import('./wm.js');
  for (const w of windows) cile.push({ cesta: `paměť://${w.app.id} (${w.title})` });
  const zdroje = performance.getEntriesByType('resource')
    .map((r) => { try { return new URL(r.name); } catch { return null; } })
    .filter((u) => u && u.origin === location.origin && /^\/(js|css|img|sdk)\//.test(u.pathname));
  for (const u of new Set(zdroje.map((u) => u.pathname))) cile.push({ cesta: 'astro://system' + decodeURI(u) });

  if (typ === 'rychla') {
    for (const s of ['Plocha', 'Stažené', 'Aplikace']) disk(FS.HOME + '/' + s);
    disk('/dočasné');
    for (const it of FS.list(FS.HOME, { hidden: true })) if (!it.dir) cile.push({ cesta: it.path, disk: true });
  } else {
    cile.push({ cesta: 'astro://nastaveni (' + Object.keys(State.data).length + ' položek)' });
    disk('/');
  }
  return cile;
}

/**
 * Spustí kontrolu na pozadí (běží dál i po zavření okna).
 * typ: rychla | uplna | vlastni | offline, tiche = bez oznámení o čistém výsledku.
 */
export async function spustKontrolu(typ = 'rychla', { cesta = FS.HOME, tiche = false } = {}) {
  if (beh) return beh.promise;
  const b = beh = {
    typ, cesta, start: Date.now(), hotovo: 0, celkem: 0, aktualni: 'Připravuji…',
    nalezeno: [], zruseno: false,
  };
  bus.emit('obrana:prubeh', b);

  b.promise = (async () => {
    const cile = await cileKontroly(typ, cesta);
    b.celkem = cile.length;
    const prodleva = TYPY[typ].prodleva;
    for (const c of cile) {
      if (b.zruseno) break;
      b.aktualni = c.cesta;
      if (c.disk) {
        const h = zkontrolujSoubor(c.cesta);
        if (h) b.nalezeno.push(h);
      }
      b.hotovo++;
      bus.emit('obrana:prubeh', b);
      await sleep(c.disk ? prodleva : prodleva / 3);
    }
    return dokonci(b, tiche);
  })();
  return b.promise;
}

export function zrusKontrolu() {
  if (beh) beh.zruseno = true;
}

function dokonci(b, tiche) {
  beh = null;
  const trvani = Date.now() - b.start;
  const nazev = TYPY[b.typ].nazev;

  if (b.zruseno) {
    zapis({ typ: 'kontrola', nadpis: `${nazev} zrušena`, text: `Zkontrolováno ${plural(b.hotovo, ['soubor', 'soubory', 'souborů'])}.` });
    uloz();
    bus.emit('obrana:prubeh', null);
    return b;
  }

  offlineBeh = b.typ === 'offline';
  for (const h of b.nalezeno) {
    if (b.typ === 'offline') { karantena(h, false); continue; }
    if (!data.hrozby.some((x) => x.cesta === h.cesta && x.nazev === h.nazev)) data.hrozby.push(h);
  }
  offlineBeh = false;
  data.posledniKontrola = { typ: b.typ, cas: Date.now(), trvani, souboru: b.hotovo, nalezeno: b.nalezeno.length };
  zapis({
    typ: 'kontrola',
    nadpis: `${nazev} dokončena`,
    text: `${b.nalezeno.length ? plural(b.nalezeno.length, ['hrozba', 'hrozby', 'hrozeb']) : 'Žádné hrozby'} · zkontrolováno ${plural(b.hotovo, ['soubor', 'soubory', 'souborů'])} za ${trvaniText(trvani)}`,
    zavaznost: b.nalezeno.length ? 'vysoka' : null,
  });
  uloz();
  bus.emit('obrana:prubeh', null);

  if (b.nalezeno.length) {
    oznameni('Byly nalezeny hrozby', `${nazev} našla ${plural(b.nalezeno.length, ['hrozbu', 'hrozby', 'hrozeb'])}. Klikni a zvol, co s nimi.`, 'shieldX', 'viry');
  } else if (!tiche) {
    oznameni('Nebyly nalezeny žádné hrozby', `${nazev} zkontrolovala ${plural(b.hotovo, ['soubor', 'soubory', 'souborů'])}.`, 'shield', 'viry');
  }
  return b;
}

export function trvaniText(ms) {
  const s = Math.max(1, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const sek = plural(s % 60, ['sekunda', 'sekundy', 'sekund']);
  return m ? `${plural(m, ['minuta', 'minuty', 'minut'])} ${sek}` : sek;
}

function oznameni(title, body, ic, stranka) {
  toast({
    title, body: 'Astro Defender · ' + body, icon: ic, timeout: 7000,
    onClick: () => import('./apps.js').then(({ openApp }) => openApp('defender', { stranka })),
  });
}

// ---------------------------------------------------------------- karanténa
function zakoduj(text) {
  const bajty = new TextEncoder().encode([...text].reverse().join(''));
  let bin = '';
  for (let i = 0; i < bajty.length; i += 0x8000) bin += String.fromCharCode.apply(null, bajty.subarray(i, i + 0x8000));
  return 'ASTROQ1:' + btoa(bin);
}

function dekoduj(q) {
  const bajty = Uint8Array.from(atob(q.slice(8)), (z) => z.charCodeAt(0));
  return [...new TextDecoder().decode(bajty)].reverse().join('');
}

let interni = false;   // vlastní zápisy nesmí spustit ochranu v reálném čase
let offlineBeh = false; // karanténa z kontroly offline (nakaza.js podle toho ví, že tvrdá nákaza končí)

function odeberZHrozeb(h) {
  data.hrozby = data.hrozby.filter((x) => x.id !== h.id);
}

/** Přesune soubor do karantény. */
export function karantena(h, ulozit = true) {
  odeberZHrozeb(h);
  let obsah;
  try { obsah = FS.read(h.cesta); } catch { if (ulozit) uloz(); return; }
  interni = true;
  let zakodovano = false;
  try {
    if (!FS.exists(KARANTENA)) FS.mkdir(KARANTENA, { parents: true });
    FS.write(`${KARANTENA}/${h.id}.bin`, zakoduj(obsah));
    zakodovano = true;
  } catch { /* plný disk — soubor se aspoň odstraní */ }
  try { FS.remove(h.cesta, { toTrash: false }); } catch { /* už neexistuje */ }
  interni = false;

  data.karantena.push({ ...h, vKarantene: Date.now(), ulozeno: zakodovano });
  zapis({
    typ: 'hrozba', stav: zakodovano ? 'karantena' : 'odebrano', hrozba: h,
    nadpis: zakodovano ? 'Hrozba umístěna do karantény' : 'Hrozba odebrána',
    zavaznost: h.zavaznost,
  });
  if (ulozit) uloz();
  bus.emit('obrana:odebrano', { cesta: h.cesta, offline: offlineBeh });
}

/** Odstraní soubor natrvalo (bez koše). */
export function odeber(h) {
  odeberZHrozeb(h);
  interni = true;
  try { FS.remove(h.cesta, { toTrash: false }); } catch { /* už neexistuje */ }
  interni = false;
  zapis({ typ: 'hrozba', stav: 'odebrano', hrozba: h, nadpis: 'Hrozba odebrána', zavaznost: h.zavaznost });
  uloz();
  bus.emit('obrana:odebrano', { cesta: h.cesta, offline: offlineBeh });
}

/** Povolí hrozbu na zařízení — příště ji kontroly přeskočí. */
export function povol(h) {
  odeberZHrozeb(h);
  if (!data.povolene.some((x) => x.hash === h.hash)) data.povolene.push({ hash: h.hash, nazev: h.nazev, cesta: h.cesta, cas: Date.now() });
  zapis({ typ: 'hrozba', stav: 'povoleno', hrozba: h, nadpis: 'Hrozba povolena', zavaznost: h.zavaznost });
  uloz();
}

export function nepovol(hash) {
  data.povolene = data.povolene.filter((x) => x.hash !== hash);
  uloz();
}

/** Vrátí soubor z karantény na původní místo a povolí ho. */
export function obnov(id) {
  const k = data.karantena.find((x) => x.id === id);
  if (!k) return;
  const soubor = `${KARANTENA}/${id}.bin`;
  if (!FS.isFile(FS.get(soubor))) {
    data.karantena = data.karantena.filter((x) => x.id !== id);
    uloz();
    toast({ title: 'Soubor nejde obnovit', body: 'Astro Defender · v karanténě už není uložený.', icon: 'shieldAlert' });
    return;
  }
  const obsah = dekoduj(FS.read(soubor));
  const slozka = FS.dirname(k.cesta);
  interni = true;
  try {
    if (!FS.exists(slozka)) FS.mkdir(slozka, { parents: true });
    const cil = FS.exists(k.cesta) ? slozka + '/' + FS.freeName(slozka, k.jmeno) : k.cesta;
    FS.write(cil, obsah);
    FS.remove(soubor, { toTrash: false });
  } finally { interni = false; }
  data.karantena = data.karantena.filter((x) => x.id !== id);
  if (!data.povolene.some((x) => x.hash === k.hash)) data.povolene.push({ hash: k.hash, nazev: k.nazev, cesta: k.cesta, cas: Date.now() });
  zapis({ typ: 'hrozba', stav: 'obnoveno', hrozba: k, nadpis: 'Soubor obnoven z karantény', zavaznost: k.zavaznost });
  uloz();
}

/** Smaže soubor z karantény natrvalo. */
export function smazZKaranteny(id) {
  const k = data.karantena.find((x) => x.id === id);
  if (!k) return;
  interni = true;
  try { FS.remove(`${KARANTENA}/${id}.bin`, { toTrash: false }); } catch { /* nebyl uložený */ }
  interni = false;
  data.karantena = data.karantena.filter((x) => x.id !== id);
  zapis({ typ: 'hrozba', stav: 'odebrano', hrozba: k, nadpis: 'Hrozba odebrána z karantény', zavaznost: k.zavaznost });
  uloz();
}

// ---------------------------------------------------------------- ochrana v reálném čase
const fronta = new Set();
let casovacFronty = 0;

bus.on('fs:change', (cesta) => {
  if (!data.rt || interni || !cesta || cesta === '/' || cesta.startsWith('/system/obrana')) return;
  fronta.add(cesta);
  clearTimeout(casovacFronty);
  casovacFronty = setTimeout(zpracujFrontu, 150);
});

function zpracujFrontu() {
  const soubory = new Set();
  for (const c of fronta) {
    const s = [];
    if (FS.get(c)) projdi(c, s, 400);
    else if (FS.isDir(FS.get(FS.dirname(c)))) FS.list(FS.dirname(c), { hidden: true }).forEach((it) => !it.dir && s.push(it.path));
    s.forEach((p) => soubory.add(p));
  }
  fronta.clear();

  const nalezene = [...soubory].map(zkontrolujSoubor).filter(Boolean);
  if (!nalezene.length) return;
  for (const h of nalezene) karantena(h, false);
  uloz();
  const h = nalezene[0];
  oznameni(
    'Hrozba byla zablokována',
    nalezene.length > 1
      ? `Ochrana v reálném čase přesunula do karantény ${plural(nalezene.length, ['soubor', 'soubory', 'souborů'])}.`
      : `${h.nazev} v souboru ${h.jmeno} je v karanténě.`,
    'shieldX', 'historie',
  );
}

// ---------------------------------------------------------------- řízený přístup ke složkám
export function jeChranena(cesta) {
  return data.cfaSlozky.some((s) => cesta === s || cesta.startsWith(s + '/'));
}

/** Smí aplikace (id) měnit tuhle cestu? Když ne, zapíše blokování a vyhodí chybu. */
export function hlidejZapis(app, cesta) {
  if (!data.cfa || !app || !jeChranena(cesta) || data.cfaPovolene.includes(app.id)) return;
  zapis({ typ: 'blokovano', nadpis: 'Chráněný přístup ke složce blokován', text: `${app.nazev} chtěla změnit ${cesta}`, app: { id: app.id, nazev: app.nazev }, cesta, zavaznost: 'nizka' });
  uloz();
  oznameni('Neoprávněné změny zablokovány', `${app.nazev} chtěla změnit chráněnou složku.`, 'folderLock', 'historie');
  throw new Error('Astro Defender zablokoval změnu chráněné složky (řízený přístup ke složkám).');
}

export function povolAplikaciCfa(app) {
  if (!data.cfaPovolene.includes(app.id)) data.cfaPovolene.push(app.id);
  uloz();
}

// ---------------------------------------------------------------- brána firewall
export const aktivniProfil = () => profilSite();

/** Smí aplikace do internetu? */
export function firewallPovoli(appId) {
  if (!data.firewall[aktivniProfil()]) return true;
  return !data.fwBlok[appId];
}

export function zapisFirewall(appId, nazev) {
  zapis({ typ: 'blokovano', nadpis: 'Brána firewall zablokovala připojení', text: `${nazev} se nemůže připojit k internetu.`, zavaznost: 'nizka' });
  uloz();
}

// ---------------------------------------------------------------- SmartScreen pro Novu
// Jen jména bez koncovky — google.cz i google.com jsou v pořádku. Krátká běžná slova
// (apple, twitch) tu nejsou, podobných skutečných webů je moc.
const ZNAME = ['google', 'youtube', 'seznam', 'wikipedia', 'facebook', 'instagram', 'roblox', 'discord',
  'steamcommunity', 'paypal', 'microsoft', 'minecraft', 'tiktok', 'netflix'];

function vzdalenost(a, b) {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let predchozi = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const t = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, predchozi + (a[i - 1] === b[j - 1] ? 0 : 1));
      predchozi = t;
    }
  }
  return d[b.length];
}

/** Posoudí adresu. Vrací null (v pořádku) nebo { typ, duvod }. */
export function posudWeb(url) {
  if (!data.smartscreen) return null;
  let u;
  try { u = new URL(url); } catch { return null; }
  const host = u.hostname.replace(/^www\./, '').toLowerCase();
  const casti = host.split('.');
  const domena = casti.slice(-2).join('.');
  const jmeno = casti.at(-2) || '';

  // oficiální testovací stránky Google Safe Browsing
  if (host === 'testsafebrowsing.appspot.com' && u.pathname.startsWith('/s/')) {
    return u.pathname.includes('phishing')
      ? { typ: 'phishing', duvod: 'Testovací stránka phishingu (Google Safe Browsing).' }
      : { typ: 'malware', duvod: 'Testovací stránka se škodlivým softwarem (Google Safe Browsing).' };
  }
  if (/(free-?robux|robux-?(zdarma|free|gen)|free-?v-?bucks|v-?bucks-?(zdarma|free))/.test(host)) {
    return { typ: 'podvod', duvod: 'Web slibuje herní měnu zdarma. Takové stránky kradou účty.' };
  }
  if (ZNAME.includes(jmeno)) return null;
  const zamena = jmeno.replace(/rn/g, 'm').replace(/vv/g, 'w').replace(/1/g, 'l').replace(/0/g, 'o');
  if (ZNAME.includes(zamena)) {
    return { typ: 'phishing', duvod: `Adresa ${domena} napodobuje web ${zamena} záměnou podobných znaků.` };
  }
  for (const z of ZNAME) {
    if (casti.slice(0, -2).includes(z)) return { typ: 'phishing', duvod: `Adresa se tváří jako ${z}, ale patří jinému webu (${domena}).` };
    const d = vzdalenost(jmeno, z);
    if (jmeno.length >= 4 && d >= 1 && d <= (z.length > 6 ? 2 : 1)) {
      return { typ: 'phishing', duvod: `Adresa ${domena} je nápadně podobná webu ${z}. Může jít o napodobeninu.` };
    }
  }
  if (host.split('.').some((c) => c.startsWith('xn--'))) {
    return { typ: 'podvod', duvod: 'Adresa používá znaky, které vypadají jako běžná písmena, ale jsou jiné (punycode).' };
  }
  return null;
}

export function zapisWeb(url, posudek) {
  zapis({ typ: 'web', nadpis: 'SmartScreen zablokoval nebezpečný web', text: url, zavaznost: 'stredni', duvod: posudek.duvod });
  uloz();
}

// ---------------------------------------------------------------- aktualizace definic
export function verzeDefinic(cas = data.definice) {
  const d = new Date(cas);
  const dny = Math.floor((cas - Date.UTC(2026, 0, 1)) / 864e5);
  return `1.${421 + Math.floor(dny / 2)}.${(dny * 97 + d.getHours() * 13) % 1000}.0`;
}

export async function aktualizujDefinice() {
  await sleep(1600 + Math.random() * 900);
  data.definice = Date.now();
  zapis({ typ: 'aktualizace', nadpis: 'Definice hrozeb aktualizovány', text: `Verze ${verzeDefinic()}` });
  uloz();
}

// ---------------------------------------------------------------- celkový stav
/**
 * Podezřelé appky z Obchodu, které Defender propustil a teď „řádí“ (nakaza.js).
 * hlavni = jejich viditelné soubory ve Stažených (skryté kopie najde jen úplná kontrola).
 */
function infekce() {
  const inst = State.get('obchodAplikace') || [];
  const jeSoubor = (c) => FS.isFile(FS.get(c));
  const hlavni = [], ids = new Set();
  for (const [id, c] of Object.entries(State.get('oaVirSoubory') || {})) if (inst.includes(id) && jeSoubor(c)) { hlavni.push(c); ids.add(id); }
  for (const [id, c] of Object.entries(State.get('oaVirSkryte') || {})) if (inst.includes(id) && jeSoubor(c)) ids.add(id);
  for (const id of State.get('nkZakotveno') || []) if (inst.includes(id)) ids.add(id);
  return { hlavni, pocet: ids.size };
}


/** Stav oblastí: ok | varovani | kriticke, s krátkou zprávou. */
export function stavOblasti() {
  const s = {};

  const inf = infekce().pocet;
  if (inf) s.viry = { uroven: 'kriticke', text: `Aktivní infekce: ${inf}. Spusť rychlou kontrolu.` };
  else if (data.hrozby.length) s.viry = { uroven: 'kriticke', text: `${plural(data.hrozby.length, ['hrozba', 'hrozby', 'hrozeb'])} čeká na akci.` };
  else if (!data.rt) s.viry = { uroven: 'kriticke', text: 'Ochrana v reálném čase je vypnutá.' };
  else if (!data.posledniKontrola || Date.now() - data.posledniKontrola.cas > 7 * 864e5) s.viry = { uroven: 'varovani', text: 'Doporučuje se provést kontrolu.' };
  else if (Date.now() - data.definice > 3 * 864e5) s.viry = { uroven: 'varovani', text: 'Definice hrozeb jsou zastaralé.' };
  else if (!data.cloud) s.viry = { uroven: 'varovani', text: 'Cloudová ochrana je vypnutá.' };
  else s.viry = { uroven: 'ok', text: 'Nevyžaduje se žádná akce.' };

  // Heslo a zamykání jsou jen doporučení — kvůli nim štít nežloutne.
  s.ucet = { uroven: 'ok', text: 'Nevyžaduje se žádná akce.' };

  const profil = aktivniProfil();
  s.firewall = data.firewall[profil]
    ? { uroven: 'ok', text: 'Nevyžaduje se žádná akce.' }
    : { uroven: 'kriticke', text: 'Brána firewall aktivní sítě je vypnutá.' };

  s.aplikace = data.smartscreen && data.kontrolaAplikaci
    ? { uroven: 'ok', text: 'Nevyžaduje se žádná akce.' }
    : { uroven: 'varovani', text: 'Část ochrany je vypnutá.' };

  s.zarizeni = data.integritaPameti
    ? { uroven: 'ok', text: 'Nevyžaduje se žádná akce.' }
    : { uroven: 'varovani', text: 'Integrita paměti je vypnutá.' };

  const misto = vyuzitiUloziste();
  s.vykon = misto.procent > 85
    ? { uroven: 'varovani', text: 'Úložiště je skoro plné.' }
    : { uroven: 'ok', text: 'Nevyžaduje se žádná akce.' };
  return s;
}

export function celkovyStav() {
  const urovne = Object.values(stavOblasti()).map((x) => x.uroven);
  return urovne.includes('kriticke') ? 'kriticke' : urovne.includes('varovani') ? 'varovani' : 'ok';
}

/** Skutečné využití localStorage vůči zhruba 5 MB, které prohlížeč dává. */
export function vyuzitiUloziste() {
  let znaku = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      znaku += k.length + (localStorage.getItem(k) || '').length;
    }
  } catch { /* nedostupné */ }
  const bajtu = znaku * 2, limit = 5 * 1024 * 1024;
  return { bajtu, limit, procent: (bajtu / limit) * 100 };
}

// ---------------------------------------------------------------- chování aplikací z Obchodu
/**
 * Aplikace se chystá udělat něco podezřelého. Se zapnutou ochranou v reálném čase to Defender
 * zastaví (vrací true = zablokováno), jinak to projde a nikdo si ničeho nevšimne.
 */
export function hlidejChovani({ appId, appNazev, hrozba, co }) {
  if (!data.rt) return false;
  zapis({
    typ: 'blokovano', nadpis: `Zablokováno: ${hrozba.nazev}`, text: `${appNazev} — ${co}`,
    zavaznost: hrozba.zavaznost, duvod: hrozba.popis, app: { id: appId, nazev: appNazev },
  });
  uloz();
  oznameni('Nebezpečné chování zablokováno', `${appNazev}: ${hrozba.kategorie.toLowerCase()}`, 'shieldX', 'historie');
  return true;
}

/** Aplikace zkouší vypnout ochranu. Ochrana před falšováním (tamper) to nedovolí. */
export function pokusVypnoutOchranu(appNazev) {
  if (data.tamper && data.rt) {
    zapis({ typ: 'blokovano', nadpis: 'Ochrana před falšováním zabránila změně', text: `${appNazev} chtěla vypnout ochranu v reálném čase.`, zavaznost: 'vysoka' });
    uloz();
    oznameni('Ochrana před falšováním zasáhla', `${appNazev} chtěla vypnout ochranu.`, 'shieldX', 'historie');
    return false;
  }
  if (data.rt) { data.rt = false; data.rtVypnuto = Date.now(); uloz(); }
  return true;
}

// ---------------------------------------------------------------- služba
let sluzba = false;

/** Spouští se s plochou: hlídá vypnutou ochranu a jednou denně udělá tichou kontrolu. */
export function spustSluzbu() {
  if (sluzba) return;
  sluzba = true;
  setInterval(() => {
    if (!data.rt && data.rtVypnuto && Date.now() - data.rtVypnuto > 15 * 60e3) {
      nastav('rt', true);
      oznameni('Ochrana v reálném čase je zase zapnutá', 'Vypnutí platí jen dočasně.', 'shield', 'viry');
    }
  }, 30e3);
  setTimeout(() => {
    const posledni = data.posledniKontrola?.cas || 0;
    if (Date.now() - posledni > 864e5 && !beh) spustKontrolu('rychla', { tiche: true });
  }, 3 * 60e3);
}
