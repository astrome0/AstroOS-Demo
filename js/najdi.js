// AstroOS — hledání souborů na disku (Soubory; jde použít i jinde, třeba ve Startu)
//
// hledej('ukoly', { kde: '/domov/uzivatel', obsah: true, druh, velikost, datum, skryte })
// → [{ name, path, node, dir, size, modified, count, kde: 'nazev'|'obsah', uryvek }]
// Bez ohledu na velikost písmen a diakritiku („ukoly“ najde „Úkoly“). Víc slov = musí sedět všechna
// (v názvu nebo v obsahu). „*.png“ = podle přípony. Obsah se prohledává jen u textových souborů
// (ne dataURL obrázků/nahrávek) a normalizovaný text se pamatuje, dokud se soubor nezmění.

import * as FS from './fs.js';

const bezDiakritiky = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// normalizovaný obsah podle uzlu souboru — při změně se liší délka nebo čas
const mezipamet = new WeakMap();
function obsahPro(node) {
  const c = node.c;
  if (typeof c !== 'string' || c.length > 400_000 || c.startsWith('data:') || c.startsWith('astro-img:')) return null;
  const m = mezipamet.get(node);
  if (m && m.m === node.m && m.len === c.length) return m.text;
  const text = bezDiakritiky(c);
  mezipamet.set(node, { m: node.m, len: c.length, text });
  return text;
}

export const DRUHY = [
  ['vse', 'Vše'], ['dokumenty', 'Dokumenty'], ['obrazky', 'Obrázky'], ['zvuk', 'Hudba a zvuk'],
  ['videa', 'Videa'], ['kod', 'Kód'], ['3d', '3D'], ['slozky', 'Složky'],
];
export const VELIKOSTI = [
  ['vse', 'Libovolná'], ['male', 'Malé (do 10 kB)'], ['stredni', 'Střední (10–100 kB)'], ['velke', 'Velké (nad 100 kB)'],
];
export const DATA = [
  ['vse', 'Kdykoli'], ['dnes', 'Dnes'], ['tyden', 'Posledních 7 dní'], ['mesic', 'Posledních 30 dní'], ['starsi', 'Starší než měsíc'],
];

function druhSouboru(name, node, dir) {
  if (dir) return 'slozky';
  if (typeof node.c === 'string' && node.c.startsWith('data:video/')) return 'videa';
  if (FS.isAudio(name)) return 'zvuk';
  if (FS.isImage(name)) return 'obrazky';
  if (/\.(a3d|obj)$/i.test(name)) return '3d';
  if (/\.(js|css|html?|json)$/i.test(name)) return 'kod';
  return 'dokumenty';
}

function sediVelikost(size, v) {
  if (v === 'male') return size < 10 * 1024;
  if (v === 'stredni') return size >= 10 * 1024 && size <= 100 * 1024;
  if (v === 'velke') return size > 100 * 1024;
  return true;
}

function sediDatum(m, d) {
  const stari = Date.now() - m;
  if (d === 'dnes') return new Date(m).toDateString() === new Date().toDateString();
  if (d === 'tyden') return stari <= 7 * 864e5;
  if (d === 'mesic') return stari <= 30 * 864e5;
  if (d === 'starsi') return stari > 30 * 864e5;
  return true;
}

/** Úryvek kolem první shody v původním (nenormalizovaném) textu: { pred, shoda, za }. */
function uryvek(c, norm, slovo) {
  const i = norm.indexOf(slovo);
  if (i < 0) return null;
  // NFD bez znamének má stejnou délku jako původní text jen bez rozložených znaků → hledáme
  // v původním textu znak po znaku, aby sedělo i „úkoly“ vs. „ukoly“
  let start = i;
  if (bezDiakritiky(c.slice(i, i + slovo.length)) !== slovo) {
    start = -1;
    for (let j = Math.max(0, i - 40); j < Math.min(c.length, i + 40); j++) {
      if (bezDiakritiky(c.slice(j, j + slovo.length)) === slovo) { start = j; break; }
    }
    if (start < 0) return null;
  }
  const radekOd = Math.max(c.lastIndexOf('\n', start - 1) + 1, start - 50);
  const radekDo = Math.min(...[c.indexOf('\n', start + slovo.length), start + slovo.length + 70].filter((x) => x >= 0));
  return {
    pred: (radekOd > 0 && c[radekOd - 1] !== '\n' ? '…' : '') + c.slice(radekOd, start).trimStart(),
    shoda: c.slice(start, start + slovo.length),
    za: c.slice(start + slovo.length, radekDo) + (radekDo < c.length && c[radekDo] !== '\n' ? '…' : ''),
  };
}

export function hledej(dotaz, { kde = FS.HOME, obsah = true, druh = 'vse', velikost = 'vse', datum = 'vse', stitek = 'vse', skryte = false, limit = 300 } = {}) {
  const q = bezDiakritiky(dotaz.trim());
  // bez dotazu jen se štítkem = všechno, co ho má (boční lišta Souborů ▸ Štítky)
  if (!q && stitek === 'vse') return [];
  const pripona = /^\*\.([\w-]+)$/.exec(q)?.[1];
  const slova = pripona ? [] : q.split(/\s+/).filter(Boolean);
  const vysledky = [];
  let prohledano = 0;

  const walk = (node, path) => {
    for (const [name, n] of Object.entries(node.d)) {
      if (!skryte && name.startsWith('.')) continue;
      const p = path === '/' ? '/' + name : path + '/' + name;
      if (p === FS.TRASH && kde !== FS.TRASH) continue;
      const dir = FS.isDir(n);
      if (dir) walk(n, p);
      if (!dir && !FS.isFile(n)) continue;

      if (stitek !== 'vse' && !(Array.isArray(n.tagy) && n.tagy.includes(stitek))) continue;
      const size = FS.size(n);
      if (druh !== 'vse' && druhSouboru(name, n, dir) !== druh) continue;
      if (dir && velikost !== 'vse') continue;
      if (!sediVelikost(size, velikost) || !sediDatum(n.m || 0, datum)) continue;

      const nazev = bezDiakritiky(name);
      let vNazvu, vObsahu = null, ury = null;
      if (pripona) {
        if (!nazev.endsWith('.' + pripona)) continue;
        vNazvu = true;
      } else {
        vNazvu = slova.every((s) => nazev.includes(s));
        if (!vNazvu && obsah && !dir) {
          const text = obsahPro(n);
          if (text !== null) {
            prohledano++;
            // každé slovo musí být v názvu nebo v obsahu, aspoň jedno v obsahu
            const chybi = slova.filter((s) => !nazev.includes(s));
            if (chybi.every((s) => text.includes(s))) {
              vObsahu = chybi[0];
              ury = uryvek(n.c, text, vObsahu);
            }
          }
        }
        if (!vNazvu && vObsahu === null) continue;
      }

      // pořadí: přesný název > začíná > obsahuje > jen v obsahu; složky před soubory; pak novější
      const bez = nazev.replace(/\.[^.]+$/, '');
      const skore = !vNazvu ? 1 : bez === q || nazev === q ? 4 : nazev.startsWith(slova[0] || '') ? 3 : 2;
      vysledky.push({
        name, path: p, node: n, dir, size, modified: n.m || 0,
        count: dir ? Object.keys(n.d).length : 0,
        kde: vNazvu ? 'nazev' : 'obsah', uryvek: ury, skore,
      });
    }
  };
  const start = FS.get(kde);
  if (FS.isDir(start)) walk(start, kde);
  vysledky.sort((a, b) => b.skore - a.skore || (a.dir === b.dir ? b.modified - a.modified : a.dir ? -1 : 1));
  const out = vysledky.slice(0, limit);
  out.celkem = vysledky.length;
  out.prohledano = prohledano;
  return out;
}

/** Rozdělí text na kusy se zvýrazněním shod (bez diakritiky): [{ t, shoda }]. */
export function zvyrazni(text, dotaz) {
  const slova = bezDiakritiky(dotaz.trim()).split(/\s+/).filter((s) => s && !s.startsWith('*.'));
  if (!slova.length) return [{ t: text, shoda: false }];
  const norm = bezDiakritiky(text);
  const znacky = new Array(text.length).fill(false);
  // normalizace může změnit délku jen u rozložených znaků, které se odstraní → délky sedí 1:1
  if (norm.length === text.length) {
    for (const s of slova) {
      let i = norm.indexOf(s);
      while (i >= 0) { for (let j = i; j < i + s.length; j++) znacky[j] = true; i = norm.indexOf(s, i + s.length); }
    }
  }
  const kusy = [];
  for (let i = 0; i < text.length; i++) {
    const posledni = kusy[kusy.length - 1];
    if (posledni && posledni.shoda === znacky[i]) posledni.t += text[i];
    else kusy.push({ t: text[i], shoda: znacky[i] });
  }
  return kusy;
}
