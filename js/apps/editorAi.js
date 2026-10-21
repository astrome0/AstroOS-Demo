// AstroOS — AI panel v Editoru kódu
//
// Vpravo vedle náhledu. Uživatel napíše, co chce („přidej tmavý režim“, „proč to nefunguje“),
// model dostane celý projekt (HTML/CSS/JS ze složky), označený kód a chyby z konzole a odpoví
// celými novými soubory v blocích ```soubor:jméno```. Každý soubor je karta s rozdílem
// a tlačítky Použít / Vrátit. Změny jdou do záložek jako neuložené — ukládá se pořád Ctrl+S.

import { el } from '../util.js';
import { icon } from '../icons.js';
import { State } from '../state.js';
import * as FS from '../fs.js';
import { send, aktivniRezim, NEBEZI } from '../ai.js';

const SYSTEM = `Jsi AstroAI, pomocník v Editoru kódu v systému AstroOS. Pomáháš začátečníkovi psát webové stránky a aplikace v HTML, CSS a JavaScriptu. Piš ve stejném jazyce, jakým píše uživatel (výchozí je čeština), stručně a srozumitelně.

PRAVIDLA PRO ZMĚNY V KÓDU:
- Když měníš nebo vytváříš soubor, napiš VŽDY jeho CELÝ nový obsah do bloku přesně v tomhle tvaru:
\`\`\`soubor:index.html
…celý obsah souboru…
\`\`\`
- Nikdy nepiš jen kus souboru, „…zbytek beze změny…“ ani vynechávky. Soubor, který neměníš, nevypisuj.
- Když měníš víc souborů (třeba HTML, CSS i JS), vypiš VŠECHNY hned za sebou, každý ve vlastním bloku. Nekonči, dokud nevypíšeš všechny, o kterých píšeš.
- Před bloky napiš 1–3 krátké věty, co a proč jsi změnil.
- Nový soubor pojmenuj krátce bez diakritiky a nezapomeň ho připojit v HTML (<link href> nebo <script src>).
- Na otázky („vysvětli“, „proč“, „co dělá“) odpověz textem bez bloků se soubory. Krátké ukázky můžeš dát do obyčejného bloku \`\`\`js.

O PROJEKTU: soubory leží v jedné složce, cesty v <link href> a <script src> jsou relativní. Náhled je obyčejná stránka v rámu. V aplikacích pro AstroOS existuje objekt window.astro (astro.fs.cti/zapis, astro.oznameni, astro.info) — používej ho, jen když už ho projekt používá.`;

const JAZYKY = { html: 'html', htm: 'html', css: 'css', js: 'js', mjs: 'js', json: 'json' };
const jazykZeJmena = (n) => JAZYKY[(n.split('.').pop() || '').toLowerCase()] || null;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const md = (t) => esc(t)
  .replace(/`([^`\n]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
  .replace(/\n/g, '<br>');

// ---------------------------------------------------------------- bloky kódu v odpovědi
/** Rozseká odpověď na text a bloky ```…```. Poslední blok může být nedokončený (ještě se píše). */
function rozsekej(text) {
  const casti = [];
  const re = /```([^\n`]*)\n?([\s\S]*?)(```|$)/g;
  let posledni = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > posledni) casti.push({ typ: 'text', text: text.slice(posledni, m.index) });
    let hlava = m[1].trim(), kod = m[2].replace(/\n$/, '');
    // malé modely píšou „soubor:x“ až na první řádek uvnitř bloku (i jako komentář)
    const prvni = kod.match(/^\s*(?:\/\/|<!--|\/\*|#)?\s*(?:soubor|file)\s*:\s*([^\s*>-]+)[^\n]*\n?/i);
    if (prvni && !/(?:soubor|file)\s*:/i.test(hlava)) { hlava = 'soubor:' + prvni[1]; kod = kod.slice(prvni[0].length); }
    casti.push({ typ: 'blok', hlava, kod, hotovy: m[3] === '```' });
    posledni = m.index + m[0].length;
    if (m[0].length === 0) break;
  }
  if (posledni < text.length) casti.push({ typ: 'text', text: text.slice(posledni) });
  return casti;
}

/** Ke kterému souboru blok patří: „soubor:x.css“, „css styl.css“, nebo jen „css“ a v projektu je jediné CSS. */
function souborBloku(hlava, projekt) {
  const s = hlava.match(/(?:soubor|file)\s*:\s*([^\s`]+)/i) || hlava.match(/([\w./-]+\.(?:html?|css|m?js|json))\b/i);
  if (s) return s[1].replace(/^\.\//, '');
  const jazyk = { javascript: 'js', js: 'js', css: 'css', html: 'html' }[hlava.toLowerCase()];
  if (!jazyk) return null;
  const stejne = projekt.soubory.filter((f) => f.jazyk === jazyk);
  return stejne.length === 1 ? stejne[0].nazev : null;
}

// ---------------------------------------------------------------- rozdíl po řádcích
/** Rozdíl dvou textů po řádcích (LCS). U velkých souborů jen hrubý odhad bez řádků. */
function rozdil(stary, novy) {
  const a = stary.split('\n'), b = novy.split('\n');
  if (a.length * b.length > 400000) {
    const sa = new Set(a), sb = new Set(b);
    return { plus: b.filter((x) => !sa.has(x)).length, minus: a.filter((x) => !sb.has(x)).length, radky: null };
  }
  const n = a.length, m = b.length;
  const t = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
    t[i][j] = a[i] === b[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
  }
  const radky = [];
  let i = 0, j = 0, plus = 0, minus = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { radky.push([' ', a[i]]); i++; j++; }
    else if (j < m && (i >= n || t[i][j + 1] >= t[i + 1][j])) { radky.push(['+', b[j]]); j++; plus++; }
    else { radky.push(['-', a[i]]); i++; minus++; }
  }
  return { plus, minus, radky };
}

function kresliRozdil(r) {
  const box = el('div.ceai-rozdil');
  if (!r.radky) { box.append(el('div.ceai-r.info', { text: 'Soubor je moc velký na zobrazení rozdílu.' })); return box; }
  // dlouhé úseky beze změny sbalíme, ať je vidět jen to podstatné
  const zmena = r.radky.map((x) => x[0] !== ' ');
  r.radky.forEach(([z, t], k) => {
    const blizko = zmena.slice(Math.max(0, k - 2), k + 3).some(Boolean);
    if (!blizko) {
      if (box.lastChild?.classList.contains('sbaleno')) { box.lastChild.dataset.n = +box.lastChild.dataset.n + 1; box.lastChild.textContent = `⋯ ${box.lastChild.dataset.n} stejných řádků`; }
      else box.append(el('div.ceai-r.sbaleno', { dataset: { n: 1 }, text: '⋯ 1 stejný řádek' }));
      return;
    }
    box.append(el('div.ceai-r' + (z === '+' ? '.plus' : z === '-' ? '.minus' : ''), { text: `${z} ${t}` }));
  });
  return box;
}

// ---------------------------------------------------------------- panel
/**
 * api: projekt() → { slozka, soubory: [{ path, nazev, jazyk, kod }] }, aktivni() → path | null,
 * vyber() → označený text, chyby() → poslední chyby z konzole, nastav(path, kod | null), vlozit(text)
 */
export function vytvorAiPanel(api) {
  const historie = [];         // { role, content } — odpovědi bez bloků kódu, ať nežerou kontext
  let rizeni = null;

  const vypis = el('div.ceai-vypis');
  const stav = el('div.ceai-stav');
  const vstup = el('textarea.ceai-vstup', { rows: 3, placeholder: 'Co mám udělat? Třeba „přidej počítadlo kliknutí“ nebo „proč nefunguje tlačítko?“', spellcheck: 'false' });
  const odeslat = el('button.ceai-odeslat', { title: 'Odeslat (Enter)' }, icon('send'));
  const mysleni = el('button.ceai-mysleni', { title: 'Přemýšlení — model si před odpovědí promyslí postup (pomalejší, ale chytřejší)' }, icon('bulb'));
  const premyslet = () => !!State.get('editorAiPremysleni');
  mysleni.classList.toggle('on', premyslet());
  mysleni.onclick = () => { State.set('editorAiPremysleni', !premyslet()); mysleni.classList.toggle('on', premyslet()); vstup.focus(); };
  const auto = el('input', { type: 'checkbox' });
  auto.checked = !!State.get('editorAiAuto');
  auto.onchange = () => State.set('editorAiAuto', auto.checked);

  const panel = el('div.ceai', {},
    el('div.ceai-hlava', {},
      el('div.ceai-logo', {}, icon('ai')),
      el('div', {}, el('b', { text: 'AstroAI' }), stav),
      el('div.ce-spacer'),
      el('button.ce-mini', { title: 'Nová konverzace', onclick: () => { historie.length = 0; vypis.replaceChildren(); uvod(); } }, icon('refresh')),
      el('button.ce-mini', { title: 'Zavřít panel', onclick: () => api.zavri() }, icon('x')),
    ),
    vypis,
    el('div.ceai-dole', {},
      el('div.ceai-vstup-obal', {}, vstup, mysleni, odeslat),
      el('label.ceai-auto', {}, auto, el('span', { text: 'Použít změny hned (bez potvrzení)' })),
    ),
  );

  const model = () => State.get('aiModel') || 'lokální model';
  async function obnovStav() {
    stav.textContent = 'zjišťuji model…';
    const r = await aktivniRezim().catch(() => ({ rezim: 'mistni' }));
    stav.textContent = r.rezim === 'server' ? (State.get('aiModel') || r.modely?.find((m) => !/embed/i.test(m)) || model()) : 'není v ukázkové verzi';
    stav.classList.toggle('vypnuto', r.rezim !== 'server');
  }

  // --- úvod s návrhy ---
  function navrhy() {
    const chyby = api.chyby();
    const vyber = api.vyber();
    const n = [
      chyby.length ? ['⚠ Oprav chybu z konzole', `V konzoli je chyba: ${chyby.at(-1)}\nNajdi příčinu a oprav ji.`, true] : null,
      vyber ? ['Vysvětli označený kód', 'Vysvětli mi jednoduše, co dělá označený kód.'] : ['Vysvětli mi tenhle kód', 'Vysvětli mi jednoduše, co dělá otevřený soubor.'],
      ['Najdi a oprav chyby', 'Projdi kód, najdi chyby nebo špatné návyky a oprav je.'],
      ['Udělej to hezčí', 'Vylepši vzhled stránky: hezčí barvy, rozestupy, písmo a jemné animace. Funkce nech stejné.'],
      ['Přidej tmavý a světlý režim', 'Přidej přepínač tmavého a světlého režimu, který si volbu pamatuje.'],
      ['Okomentuj kód', 'Přidej do kódu stručné české komentáře, ať je jasné, co která část dělá.'],
    ].filter(Boolean);
    return el('div.ceai-navrhy', {}, ...n.map(([t, prompt, dulezite]) => {
      const b = el('button.ceai-navrh' + (dulezite ? '.dulezite' : ''), { text: t });
      b.onclick = () => posli(prompt, t);
      return b;
    }));
  }
  function uvod() {
    vypis.append(el('div.ceai-uvod', {},
      el('p', { text: 'Napiš, co chceš na stránce změnit nebo čemu nerozumíš. Uvidím všechny soubory ve složce projektu, označený kód i chyby z konzole.' }),
      navrhy()));
  }

  // --- karta se souborem ---
  function kartaSouboru(nazev, kod, projekt) {
    const path = FS.normalize(projekt.slozka + '/' + nazev);
    const puvodni = projekt.soubory.find((f) => f.path === path)?.kod ?? null;
    if ((puvodni === null || puvodni.endsWith('\n')) && !kod.endsWith('\n')) kod += '\n';
    const r = puvodni === null ? null : rozdil(puvodni, kod);
    const kusSouboru = puvodni !== null && puvodni.split('\n').length > 15 && kod.split('\n').length < puvodni.split('\n').length * 0.5;
    let pouzito = false, predtim = puvodni;

    const stavK = el('span.ceai-k-stav', {},
      puvodni === null ? el('span.plus', { text: 'nový soubor' })
        : r.plus + r.minus === 0 ? el('span', { text: 'beze změny' })
          : [el('span.plus', { text: `+${r.plus}` }), ' ', el('span.minus', { text: `−${r.minus}` })]);
    const bRozdil = el('button.ceai-k-btn', { text: 'Rozdíl' });
    const bPouzit = el('button.ceai-k-btn.hlavni', { text: 'Použít' });
    const karta = el('div.ceai-karta', {},
      el('div.ceai-k-hlava', {}, icon('code'), el('b', { text: nazev }), stavK, el('div.ce-spacer'), puvodni !== null ? bRozdil : null, bPouzit),
      kusSouboru ? el('div.ceai-varovani', { text: 'Pozor: vypadá to jen jako kus souboru — po použití by zbytek zmizel. Zkontroluj rozdíl.' }) : null,
    );
    let rozdilEl = null;
    bRozdil.onclick = () => {
      if (rozdilEl) { rozdilEl.remove(); rozdilEl = null; return; }
      rozdilEl = kresliRozdil(r);
      karta.append(rozdilEl);
    };
    const pouzij = () => {
      if (pouzito) {
        api.nastav(path, predtim);
        pouzito = false;
        bPouzit.textContent = 'Použít';
        karta.classList.remove('pouzito');
        return;
      }
      predtim = api.projekt().soubory.find((f) => f.path === path)?.kod ?? null;
      api.nastav(path, kod);
      pouzito = true;
      bPouzit.textContent = 'Vrátit';
      karta.classList.add('pouzito');
    };
    bPouzit.onclick = pouzij;
    karta.pouzij = () => { if (!pouzito) pouzij(); };
    karta.automaticky = !kusSouboru;
    return karta;
  }

  function kartaUkazky(blok) {
    const b = el('button.ceai-k-btn', { text: 'Vložit na kurzor' });
    b.onclick = () => { api.vlozit(blok.kod); b.textContent = 'Vloženo ✓'; };
    return el('div.ceai-ukazka', {},
      el('div.ceai-k-hlava', {}, el('span', { text: blok.hlava || 'ukázka' }), el('div.ce-spacer'), b),
      el('pre', { text: blok.kod }));
  }

  // --- vykreslení odpovědi (i rozepsané) ---
  function vykresli(cil, text, projekt, hotovo) {
    cil.replaceChildren();
    const karty = [];
    for (const c of rozsekej(text)) {
      if (c.typ === 'text') {
        if (c.text.trim()) cil.append(el('div.ceai-text', { html: md(c.text.trim()) }));
        continue;
      }
      const nazev = souborBloku(c.hlava, projekt);
      if (!c.hotovy || !hotovo) {
        cil.append(el('div.ceai-pise', {}, el('i.ceai-tecky'), `Píšu ${nazev || 'kód'}… (${c.kod.split('\n').length} ř.)`));
        continue;
      }
      if (nazev) { const k = kartaSouboru(nazev, c.kod, projekt); karty.push(k); cil.append(k); }
      else cil.append(kartaUkazky(c));
    }
    if (hotovo && karty.length) {
      cil.append(el('button.ceai-dal', {
        text: 'Pokračuj (chybí soubor?)', title: 'Požádá o soubory, které model slíbil, ale nevypsal',
        onclick: (e) => { e.currentTarget.remove(); posli('Pokračuj: vypiš celé soubory, které jsi slíbil změnit a ještě jsi je nevypsal. Ty už vypsané znovu nepiš.', 'Pokračuj'); },
      }));
    }
    if (hotovo && karty.length > 1) {
      cil.append(el('button.ceai-vse', { text: `Použít všechny změny (${karty.length})`, onclick: (e) => { karty.forEach((k) => k.pouzij()); e.currentTarget.remove(); } }));
    }
    return karty;
  }

  // --- odeslání ---
  function kontext(projekt) {
    const casti = [`Projekt ve složce ${projekt.slozka.replace(FS.HOME, '~')}:`];
    for (const f of projekt.soubory) casti.push(`\n--- ${f.nazev} ---\n${f.kod}`);
    const akt = api.aktivni();
    if (akt) casti.push(`\nPrávě otevřený soubor: ${FS.basename(akt)}`);
    const vyber = api.vyber();
    if (vyber) casti.push(`\nOznačený kód:\n${vyber}`);
    const chyby = api.chyby();
    if (chyby.length) casti.push(`\nChyby v konzoli náhledu:\n${chyby.slice(-5).join('\n')}`);
    return casti.join('\n');
  }

  async function posli(text, popisek = text) {
    text = text.trim();
    if (!text || rizeni) return;
    vypis.querySelector('.ceai-uvod')?.remove();
    vypis.append(el('div.ceai-ja', { text: popisek }));
    const odpovedEl = el('div.ceai-ai', {}, el('div.ceai-pise', {}, el('i.ceai-tecky'), 'Přemýšlím…'));
    vypis.append(odpovedEl);
    vypis.scrollTop = vypis.scrollHeight;
    vstup.value = '';

    const r = await aktivniRezim().catch(() => ({ rezim: 'mistni' }));
    if (r.rezim !== 'server') {
      odpovedEl.replaceChildren(el('div.ceai-text.chyba', { html: md(NEBEZI) }));
      stav.textContent = 'není v ukázkové verzi';
      stav.classList.add('vypnuto');
      return;
    }

    const projekt = api.projekt();
    rizeni = new AbortController();
    odeslat.replaceChildren(icon('stop'));
    odeslat.title = 'Zastavit';
    let odpoved = '';
    let karty = [];
    // přemýšlení jde do rozbalovacího bloku nad odpovědí (stejný jako v chatu AstroAI)
    let blok = null, mysleniOd = 0;
    const telo = el('div.ceai-ai');
    const konecMysleni = () => {
      if (!blok || blok.hotovo) return;
      blok.hotovo = true;
      blok.node.open = false;
      blok.nadpis.textContent = `Přemýšlení · ${Math.max(1, Math.round((Date.now() - mysleniOd) / 1000))} s`;
    };
    try {
      const zpravy = [...historie.slice(-4), { role: 'user', content: `${kontext(projekt)}\n\nPožadavek: ${text}` }];
      const res = await send(zpravy, {
        zdroj: 'editor',
        system: SYSTEM,
        signal: rizeni.signal,
        premysleni: premyslet(),
        onThink: (k) => {
          if (!blok) {
            mysleniOd = Date.now();
            const obsah = el('div.ai-mysleni-text');
            const nadpis = el('span', { text: 'Přemýšlím…' });
            blok = { node: el('details.ai-mysleni-blok.ceai-mysleni-blok', {}, el('summary', {}, icon('chevronRight'), nadpis), obsah), obsah, nadpis };
            blok.node.open = true;
            odpovedEl.replaceChildren(blok.node, telo);
          }
          blok.obsah.textContent += k;
          blok.obsah.scrollTop = blok.obsah.scrollHeight;
          vypis.scrollTop = vypis.scrollHeight;
        },
        onToken: (k) => {
          konecMysleni();
          odpoved += k;
          vykresli(blok ? telo : odpovedEl, odpoved, projekt, false);
          vypis.scrollTop = vypis.scrollHeight;
        },
      });
      konecMysleni();
      odpoved = res.text || odpoved;
      karty = vykresli(blok ? telo : odpovedEl, odpoved, projekt, true);
      if (!odpoved.trim()) (blok ? telo : odpovedEl).replaceChildren(el('div.ceai-text.chyba', { text: blok ? 'Model jen přemýšlel a nic neodpověděl. Zkus to znovu, nebo vypni přemýšlení.' : 'Model nic neodpověděl. Zkus to znovu.' }));
      if (auto.checked) karty.filter((k) => k.automaticky).forEach((k) => k.pouzij());
      historie.push({ role: 'user', content: text });
      historie.push({ role: 'assistant', content: odpoved.replace(/```[^\n`]*\n[\s\S]*?```/g, (b) => `[${souborBloku(b.split('\n')[0].slice(3), projekt) || 'ukázka kódu'}]`) });
    } catch (e) {
      konecMysleni();
      if (e.name === 'AbortError') {
        vykresli(blok ? telo : odpovedEl, odpoved, projekt, true);
        odpovedEl.append(el('div.ceai-pise', { text: '— zastaveno —' }));
      } else (blok ? telo : odpovedEl).replaceChildren(el('div.ceai-text.chyba', { text: 'Chyba: ' + e.message }));
    } finally {
      rizeni = null;
      odeslat.replaceChildren(icon('send'));
      odeslat.title = 'Odeslat (Enter)';
      vypis.scrollTop = vypis.scrollHeight;
    }
  }

  odeslat.onclick = () => (rizeni ? rizeni.abort() : posli(vstup.value));
  vstup.onkeydown = (e) => {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); posli(vstup.value); }
  };

  uvod();
  panel.obnovNavrhy = () => { const u = vypis.querySelector('.ceai-uvod .ceai-navrhy'); if (u) u.replaceWith(navrhy()); };
  panel.otevreno = () => { obnovStav(); setTimeout(() => vstup.focus(), 50); };
  panel.zastav = () => rizeni?.abort();
  return panel;
}
