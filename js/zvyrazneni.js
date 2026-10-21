// AstroOS — zvýraznění syntaxe pro Editor kódu
//
// Žádná knihovna, jen jeden průchod regulárním výrazem na jazyk. Není to
// plnohodnotný parser — hlídá si hlavně komentáře, řetězce a klíčová slova,
// takže na učení HTML, CSS a JavaScriptu to bohatě stačí.

const escHtml = (s) => s.replace(/[&<>]/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[z]));

/** Pravidla jsou pole [třída, regulární výraz]; pořadí rozhoduje. */
const PRAVIDLA = {
  js: [
    ['kom', /\/\/[^\n]*|\/\*[\s\S]*?\*\//],
    ['txt', /`(?:\\[\s\S]|[^`\\])*`|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/],
    ['klic', /\b(?:const|let|var|function|return|if|else|for|while|do|of|in|new|class|extends|super|import|export|from|as|async|await|try|catch|finally|throw|typeof|instanceof|delete|switch|case|break|continue|default|yield|void)\b/],
    ['hod', /\b(?:true|false|null|undefined|this|NaN|Infinity)\b/],
    ['cis', /\b0[xX][0-9a-fA-F]+\b|\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/],
    ['glob', /\b(?:document|window|console|Math|JSON|Date|Array|Object|String|Number|Boolean|Promise|setTimeout|setInterval|requestAnimationFrame|localStorage|alert)\b/],
    ['fun', /\b[A-Za-z_$][\w$]*(?=\s*\()/],
  ],
  css: [
    ['kom', /\/\*[\s\S]*?\*\//],
    ['txt', /"[^"\n]*"|'[^'\n]*'/],
    ['at', /@[\w-]+/],
    ['sel', /[.#][A-Za-z_][\w-]*|::?[a-z-]+(?![\w-]*\s*:)|\b[a-z]+(?=[^{};:]*\{)/],
    ['vlas', /[-a-z]+(?=\s*:)/],
    ['cis', /#[0-9a-fA-F]{3,8}\b|\b\d+(?:\.\d+)?(?:px|%|em|rem|vh|vw|vmin|vmax|s|ms|deg|fr|ch)?\b/],
  ],
  html: [
    ['kom', /<!--[\s\S]*?-->/],
    ['dok', /<!DOCTYPE[^>]*>/i],
    ['znac', /<\/?[A-Za-z][\w-]*|\/?>/],
    ['txt', /"[^"]*"|'[^']*'/],
    ['atr', /\b[a-z-]+(?=\s*=)/],
    ['ent', /&[a-z]+;|&#\d+;/i],
  ],
};

PRAVIDLA.json = [
  ['txt', /"(?:\\.|[^"\\])*"(?!\s*:)/],
  ['vlas', /"(?:\\.|[^"\\])*"(?=\s*:)/],
  ['hod', /\b(?:true|false|null)\b/],
  ['cis', /-?\b\d+(?:\.\d+)?\b/],
];

/** Jazyk podle přípony souboru; null = zvýraznění vypnuto. */
export function jazykSouboru(name = '') {
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
  if (ext === 'htm') return 'html';
  if (ext === 'mjs') return 'js';
  return PRAVIDLA[ext] ? ext : null;
}

const spojene = new Map();

function vyrazProJazyk(jazyk) {
  if (spojene.has(jazyk)) return spojene.get(jazyk);
  const pravidla = PRAVIDLA[jazyk];
  const zdroj = pravidla.map(([tr, re]) => `(?<${tr}>${re.source})`).join('|');
  const re = new RegExp(zdroj, 'gm');
  spojene.set(jazyk, re);
  return re;
}

/** Vrátí HTML se `<span class="t-…">`; text mimo pravidla se jen ošetří. */
export function zvyrazni(kod, jazyk) {
  if (!jazyk || !PRAVIDLA[jazyk]) return escHtml(kod);
  const re = vyrazProJazyk(jazyk);
  let out = '';
  let konec = 0;
  for (const m of kod.matchAll(re)) {
    const trida = Object.keys(m.groups).find((k) => m.groups[k] !== undefined);
    out += escHtml(kod.slice(konec, m.index));
    out += `<span class="t-${trida}">${escHtml(m[0])}</span>`;
    konec = m.index + m[0].length;
  }
  return out + escHtml(kod.slice(konec));
}
