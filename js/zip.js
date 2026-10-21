// AstroOS — skutečné soubory ZIP (Soubory ▸ Komprimovat / Rozbalit)
//
// Formát podle specifikace PKWARE: lokální hlavičky + centrální adresář, komprese deflate přes
// CompressionStream('deflate-raw') (když se nevyplatí, uloží se bez komprese), CRC-32, názvy v UTF-8 (bit 11).
// Na disku AstroOS je .zip dataURL („data:application/zip;base64,…“) — jde stáhnout do počítače a otevřít
// ve Windows, a naopak ZIP z Windows jde rozbalit tady. Obrázky/nahrávky (dataURL) se do ZIPu dávají
// jako skutečné bajty; původní typ (MIME) se pamatuje v komentáři položky, ať se po rozbalení vrátí stejný.

import * as FS from './fs.js';

// ---------------------------------------------------------------- pomocné
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b) {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function proud(bytes, Trida, rezim) {
  const s = new Blob([bytes]).stream().pipeThrough(new Trida(rezim));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

function dosCas(ms) {
  const d = new Date(ms || Date.now());
  const rok = Math.max(1980, d.getFullYear());
  return {
    cas: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    datum: ((rok - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}
function zDos(cas, datum) {
  if (!datum) return Date.now();
  return new Date(1980 + (datum >> 9), ((datum >> 5) & 15) - 1, datum & 31, cas >> 11, (cas >> 5) & 63, (cas & 31) * 2).getTime();
}

const utf8 = new TextEncoder();

export function zDataUrl(url) {
  const i = url.indexOf(',');
  const hlava = url.slice(5, i);
  const telo = url.slice(i + 1);
  const mime = hlava.split(';')[0] || 'application/octet-stream';
  if (hlava.includes(';base64')) {
    const bin = atob(telo);
    const b = new Uint8Array(bin.length);
    for (let j = 0; j < bin.length; j++) b[j] = bin.charCodeAt(j);
    return { mime, data: b };
  }
  return { mime, data: utf8.encode(decodeURIComponent(telo)) };
}

export function naDataUrl(bytes, mime) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return `data:${mime};base64,${btoa(s)}`;
}

// ---------------------------------------------------------------- zápis
/**
 * polozky: [{ cesta: 'slozka/soubor.txt', data?: Uint8Array, cas, slozka?: true, komentar?: string }]
 * → Uint8Array (celý soubor .zip)
 */
export async function vytvorZip(polozky) {
  const casti = [], adresar = [];
  let offset = 0;
  for (const p of polozky) {
    const jmeno = utf8.encode(p.slozka ? p.cesta.replace(/\/?$/, '/') : p.cesta);
    const komentar = utf8.encode(p.komentar || '');
    const data = p.slozka ? new Uint8Array(0) : p.data;
    const crc = crc32(data);
    let metoda = 0, ulozeno = data;
    if (data.length > 64) {
      const z = await proud(data, CompressionStream, 'deflate-raw');
      if (z.length < data.length) { metoda = 8; ulozeno = z; }
    }
    const { cas, datum } = dosCas(p.cas);

    const lok = new DataView(new ArrayBuffer(30));
    lok.setUint32(0, 0x04034b50, true);
    lok.setUint16(4, 20, true);
    lok.setUint16(6, 0x0800, true);              // názvy v UTF-8
    lok.setUint16(8, metoda, true);
    lok.setUint16(10, cas, true);
    lok.setUint16(12, datum, true);
    lok.setUint32(14, crc, true);
    lok.setUint32(18, ulozeno.length, true);
    lok.setUint32(22, data.length, true);
    lok.setUint16(26, jmeno.length, true);
    casti.push(new Uint8Array(lok.buffer), jmeno, ulozeno);

    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true);
    cen.setUint16(4, 0x0314, true);              // vytvořeno: verze 2.0, „Unix“ (kvůli atributům)
    cen.setUint16(6, 20, true);
    cen.setUint16(8, 0x0800, true);
    cen.setUint16(10, metoda, true);
    cen.setUint16(12, cas, true);
    cen.setUint16(14, datum, true);
    cen.setUint32(16, crc, true);
    cen.setUint32(20, ulozeno.length, true);
    cen.setUint32(24, data.length, true);
    cen.setUint16(28, jmeno.length, true);
    cen.setUint16(32, komentar.length, true);
    cen.setUint32(38, (p.slozka ? 0o40755 : 0o100644) << 16 | (p.slozka ? 0x10 : 0), true);
    cen.setUint32(42, offset, true);
    adresar.push(new Uint8Array(cen.buffer), jmeno, komentar);

    offset += 30 + jmeno.length + ulozeno.length;
  }
  const velikostAdresare = adresar.reduce((s, b) => s + b.length, 0);
  const konec = new DataView(new ArrayBuffer(22));
  konec.setUint32(0, 0x06054b50, true);
  konec.setUint16(8, polozky.length, true);
  konec.setUint16(10, polozky.length, true);
  konec.setUint32(12, velikostAdresare, true);
  konec.setUint32(16, offset, true);

  const vse = [...casti, ...adresar, new Uint8Array(konec.buffer)];
  const out = new Uint8Array(vse.reduce((s, b) => s + b.length, 0));
  let o = 0;
  for (const b of vse) { out.set(b, o); o += b.length; }
  return out;
}

// ---------------------------------------------------------------- čtení
/** → [{ cesta, slozka, data: Uint8Array, cas, komentar }] */
export async function prectiZip(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let konec = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { konec = i; break; }
  }
  if (konec < 0) throw new Error('Tohle není soubor ZIP (nebo je poškozený).');
  const pocet = v.getUint16(konec + 10, true);
  let p = v.getUint32(konec + 16, true);
  if (p === 0xffffffff) throw new Error('ZIP64 (archivy nad 4 GB) AstroOS neumí.');
  const dec = new TextDecoder();
  const out = [];
  for (let n = 0; n < pocet; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('Poškozený adresář v ZIPu.');
    const priznaky = v.getUint16(p + 8, true);
    const metoda = v.getUint16(p + 10, true);
    const cas = v.getUint16(p + 12, true), datum = v.getUint16(p + 14, true);
    const crc = v.getUint32(p + 16, true);
    const zabaleno = v.getUint32(p + 20, true);
    const delkaJmena = v.getUint16(p + 28, true), delkaExtra = v.getUint16(p + 30, true), delkaKom = v.getUint16(p + 32, true);
    const lokal = v.getUint32(p + 42, true);
    // bez bitu 11 je název v CP437 — pro běžné (anglické) názvy to vyjde nastejno
    const cesta = dec.decode(bytes.subarray(p + 46, p + 46 + delkaJmena));
    const komentar = dec.decode(bytes.subarray(p + 46 + delkaJmena + delkaExtra, p + 46 + delkaJmena + delkaExtra + delkaKom));
    p += 46 + delkaJmena + delkaExtra + delkaKom;

    if (priznaky & 1) throw new Error(`„${cesta}“ je zaheslovaný — šifrované ZIPy AstroOS neumí.`);
    const slozka = cesta.endsWith('/');
    let data = new Uint8Array(0);
    if (!slozka) {
      const zac = lokal + 30 + v.getUint16(lokal + 26, true) + v.getUint16(lokal + 28, true);
      const surova = bytes.subarray(zac, zac + zabaleno);
      if (metoda === 0) data = surova.slice();
      else if (metoda === 8) data = await proud(surova, DecompressionStream, 'deflate-raw');
      else throw new Error(`„${cesta}“ používá kompresi, kterou AstroOS neumí (metoda ${metoda}).`);
      if (crc32(data) !== crc) throw new Error(`„${cesta}“ je poškozený (nesedí kontrolní součet).`);
    }
    out.push({ cesta, slozka, data, zabaleno, cas: zDos(cas, datum), komentar });
  }
  return out;
}

// ---------------------------------------------------------------- AstroOS disk ↔ ZIP
const MIME = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', webm: 'audio/webm', mp4: 'video/mp4',
  zip: 'application/zip', pdf: 'application/pdf', iso: 'application/octet-stream',
};
const pripona = (jmeno) => (jmeno.includes('.') ? jmeno.slice(jmeno.lastIndexOf('.') + 1).toLowerCase() : '');
export const jeZip = (jmeno) => pripona(jmeno) === 'zip';

/** Obsah souboru na disku → bajty (+ MIME, když to byl dataURL). */
export async function bajtySouboru(c) {
  if (c.startsWith('data:')) return zDataUrl(c);
  if (c.startsWith('astro-img:')) {
    const r = await fetch(c.slice(10));
    return { mime: r.headers.get('content-type') || 'application/octet-stream', data: new Uint8Array(await r.arrayBuffer()) };
  }
  return { mime: null, data: utf8.encode(c) };
}

/** Bajty (z ZIPu nebo z počítače) → obsah souboru na disku: text, nebo dataURL. */
export function obsahSouboru(jmeno, data, mime) {
  if (mime) return naDataUrl(data, mime);
  const ext = pripona(jmeno);
  if (MIME[ext] && ext !== 'svg') return naDataUrl(data, MIME[ext]);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(data); }
  catch { return naDataUrl(data, MIME[ext] || 'application/octet-stream'); }
}

/**
 * Zabalí cesty do nového .zip ve složce `kam`. Vrací { cesta, puvodne, zip, polozek }.
 * Jméno: jedna položka → „název.zip“, víc → podle první (jako Windows).
 */
export async function komprimuj(cesty, kam = FS.dirname(cesty[0])) {
  const { zip, puvodne, polozek } = await zabal(cesty);
  const zaklad = FS.basename(cesty[0]).replace(/\.[^.]+$/, '') || 'archiv';
  const jmeno = FS.exists(FS.join(kam, zaklad + '.zip')) ? FS.freeName(kam, zaklad + '.zip') : zaklad + '.zip';
  const cesta = FS.join(kam, jmeno);
  const obsah = naDataUrl(zip, 'application/zip');
  FS.write(cesta, obsah);
  return { cesta, puvodne, zip: obsah.length, polozek };
}

/** Zabalí cesty do ZIPu jen v paměti (stahování složky do počítače). */
export async function zabal(cesty) {
  const polozky = [];
  let puvodne = 0;
  const pridej = async (cesta, vZipu) => {
    const node = FS.get(cesta);
    if (FS.isDir(node)) {
      polozky.push({ cesta: vZipu, slozka: true, cas: node.m });
      for (const jm of Object.keys(node.d)) await pridej(cesta + '/' + jm, vZipu + '/' + jm);
    } else if (FS.isFile(node)) {
      const { mime, data } = await bajtySouboru(node.c);
      puvodne += node.c.length;
      polozky.push({ cesta: vZipu, data, cas: node.m, komentar: mime ? 'mime:' + mime : '' });
    }
  };
  for (const c of cesty) await pridej(c, FS.basename(c));
  if (!polozky.length) throw new Error('Není co zabalit.');

  return { zip: await vytvorZip(polozky), puvodne, polozek: polozky.filter((p) => !p.slozka).length };
}

/**
 * Rozbalí .zip do nové složky vedle něj (nebo do `cil`). Vrací { cesta, souboru }.
 * Cesty s „..“ nebo absolutní se přeskočí (zip slip). Celý strom se sestaví v paměti a uloží jednou.
 */
export async function rozbal(cestaZip, cil = null) {
  const c = FS.read(cestaZip);
  if (!c.startsWith('data:')) throw new Error('Tenhle soubor není skutečný ZIP.');
  const polozky = await prectiZip(zDataUrl(c).data);

  const kam = FS.dirname(cestaZip);
  const zaklad = FS.basename(cestaZip).replace(/\.zip$/i, '') || 'archiv';
  const nazevCile = cil ? null : (FS.exists(FS.join(kam, zaklad)) ? FS.freeName(kam, zaklad) : zaklad);
  const koren = { d: {}, m: Date.now() };
  let souboru = 0;

  for (const p of polozky) {
    const casti = p.cesta.replace(/\\/g, '/').split('/').filter(Boolean);
    if (!casti.length || casti.some((s) => s === '..' || s === '.') || /^[a-z]:/i.test(casti[0])) continue;
    if (casti[0] === '__MACOSX') continue;
    let uzel = koren;
    const posledni = p.slozka ? casti.length : casti.length - 1;
    for (let i = 0; i < posledni; i++) {
      const s = casti[i];
      if (!uzel.d[s] || !FS.isDir(uzel.d[s])) uzel.d[s] = { d: {}, m: p.cas };
      uzel = uzel.d[s];
    }
    if (p.slozka) { uzel.m = p.cas; continue; }
    const jmeno = casti[casti.length - 1];
    const mime = p.komentar.startsWith('mime:') ? p.komentar.slice(5) : null;
    uzel.d[jmeno] = { c: obsahSouboru(jmeno, p.data, mime), m: p.cas };
    souboru++;
  }

  // do existující složky (Rozbalit sem): sloučit, jinak nová složka s názvem ZIPu — když je v ZIPu
  // jediná hlavní složka, rozbalí se rovnou ona (bez zdvojeného „projekt/projekt/…“)
  const rodic = FS.get(cil || kam);
  if (!FS.isDir(rodic)) throw new Error('Cílová složka neexistuje.');
  const zaloha = { ...rodic.d };
  const hlavni = Object.entries(koren.d);
  let nazev = nazevCile;
  if (cil) for (const [k, n] of hlavni) rodic.d[FS.exists(FS.join(cil, k)) ? FS.freeName(cil, k) : k] = n;
  else if (hlavni.length === 1 && FS.isDir(hlavni[0][1])) {
    const [jm, uzel] = hlavni[0];
    nazev = FS.exists(FS.join(kam, jm)) ? FS.freeName(kam, jm) : jm;
    rodic.d[nazev] = uzel;
  } else rodic.d[nazev] = koren;
  rodic.m = Date.now();
  if (!FS.save(cil || kam)) {
    rodic.d = zaloha;
    FS.save(cil || kam);
    throw new Error('Na disku není dost místa na rozbalení.');
  }
  return { cesta: cil || FS.join(kam, nazev), souboru };
}

// ---------------------------------------------------------------- počítač ↔ AstroOS
/** Stáhne soubor do skutečného počítače (složku jako .zip). */
export async function stahniDoPocitace(cesta) {
  const node = FS.get(cesta);
  let blob, jmeno = FS.basename(cesta);
  if (FS.isDir(node)) {
    blob = new Blob([(await zabal([cesta])).zip], { type: 'application/zip' });
    jmeno += '.zip';
  } else {
    const { mime, data } = await bajtySouboru(node.c);
    blob = new Blob([data], { type: mime || 'text/plain;charset=utf-8' });
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: jmeno });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/** Nahraje soubory z počítače (input / přetažení) do složky. Vrací cesty nových souborů. */
export async function nahrajZPocitace(soubory, kam) {
  const nove = [];
  for (const f of soubory) {
    const data = new Uint8Array(await f.arrayBuffer());
    const jmeno = FS.exists(FS.join(kam, f.name)) ? FS.freeName(kam, f.name) : f.name;
    // obrázky/zvuk/ZIP podle přípony jako dataURL, co je platné UTF-8 jako text, ostatní jako dataURL
    FS.write(FS.join(kam, jmeno), obsahSouboru(jmeno, data, null));
    nove.push(FS.join(kam, jmeno));
  }
  return nove;
}
