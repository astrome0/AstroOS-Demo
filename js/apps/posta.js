// AstroOS — Pošta (falešná schránka nad virtuálním diskem)
//
// Zprávy leží v `~/.posta.json`, takže přežijí restart a jdou najít i v Souborech.
// Odeslaná pošta dostane odpověď: na adresu AstroAI odpovídá opravdu AstroAI,
// na ostatní přijde automatická odpověď podatelny.

import { el, cz, bus } from '../util.js';
import { icon } from '../icons.js';
import * as FS from '../fs.js';
import { State } from '../state.js';
import { toast, contextMenu } from '../ui.js';
import { send as aiSend } from '../ai.js';

const SOUBOR = FS.HOME + '/.posta.json';
const JA = () => `${(State.get('user')?.name || 'uzivatel').toLowerCase().split(' ')[0]}@astroos`;

const SLOZKY = [
  { id: 'dorucene', name: 'Doručené', ikona: 'mail' },
  { id: 'odeslane', name: 'Odeslané', ikona: 'arrowRight' },
  { id: 'kos', name: 'Koš', ikona: 'trash' },
];

const noveId = () => 'z' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

function uvodniPosta() {
  const ted = Date.now();
  return [
    {
      id: noveId(), slozka: 'dorucene', precteno: false, cas: ted - 1000 * 60 * 60 * 26,
      od: 'tym@astroos', odJmeno: 'Tým AstroOS', komu: JA(),
      predmet: 'Vítej v AstroOS',
      telo: 'Ahoj!\n\nTvůj systém je připravený. Zkus si projít plochu, nabídku Start a Nastavení — '
        + 'skoro všechno se dá přizpůsobit.\n\nPár tipů na začátek:\n'
        + '• Win otevře Start, Win+L zamkne obrazovku, Alt+Tab přepíná okna.\n'
        + '• V Souborech je celý virtuální disk, v Terminálu funguje 24 příkazů.\n'
        + '• Malování ukládá obrázky rovnou do složky Obrázky.\n\nAť slouží!',
    },
    {
      id: noveId(), slozka: 'dorucene', precteno: false, cas: ted - 1000 * 60 * 90,
      od: 'ai@astroos', odJmeno: 'AstroAI', komu: JA(),
      predmet: 'Můžeš mi napsat i sem',
      telo: 'Ahoj, tady AstroAI.\n\nBěžím lokálně na tvém počítači. Když mi napíšeš na adresu '
        + 'ai@astroos, odpovím ti rovnou do schránky — stačí kliknout na Odpovědět.\n\n'
        + 'Když model zrovna neběží, odpovím aspoň z hlavy podle toho, co vím o systému.',
    },
    {
      id: noveId(), slozka: 'dorucene', precteno: true, cas: ted - 1000 * 60 * 60 * 52,
      od: 'noviny@nova', odJmeno: 'Nova Prohlížeč', komu: JA(),
      predmet: 'Co je nového na astro://',
      telo: 'Přehled stránek, které v Nova Prohlížeči najdeš:\n\n'
        + 'astro://domu — rozcestník s hledáním\nastro://soubory — disk jako web\n'
        + 'astro://napoveda — klávesové zkratky\nastro://ai — okno do AstroAI\n\n'
        + 'Hledání prohledá stránky, disk a nechá odpovědět i AstroAI.',
    },
  ];
}

function nactiPostu() {
  try {
    const data = JSON.parse(FS.read(SOUBOR));
    if (Array.isArray(data?.zpravy)) return data.zpravy;
  } catch { /* poprvé, nebo poškozený soubor */ }
  const z = uvodniPosta();
  ulozPostu(z);
  return z;
}

function ulozPostu(zpravy) {
  try { FS.write(SOUBOR, JSON.stringify({ zpravy }, null, 1)); }
  catch (err) { toast({ title: 'Poštu nešlo uložit', body: err.message, icon: 'info' }); }
}

/** Doručí zprávu do Doručených, i když Pošta není otevřená (používá ji třeba hra se sítěmi). */
export function dorucZpravu({ od, odJmeno, predmet, telo }) {
  const zpravy = nactiPostu();
  zpravy.push({ id: noveId(), slozka: 'dorucene', precteno: false, cas: Date.now(), od, odJmeno, komu: JA(), predmet, telo });
  ulozPostu(zpravy);
  bus.emit('posta:nova');
  toast({ title: odJmeno, body: predmet, icon: 'mail', onClick: () => import('../apps.js').then(({ openApp }) => openApp('mail')) });
}

/** Automatická odpověď podatelny, když adresát není AstroAI. */
function odpovedPodatelny(zprava) {
  const p = zprava.predmet.toLowerCase();
  if (p.includes('pomoc') || p.includes('problém') || p.includes('chyba')) {
    return 'Díky za hlášení. Tvůj případ jsme zařadili do fronty pod číslem '
      + Math.floor(Math.random() * 9000 + 1000) + '.\n\nZkusils to vypnout a zapnout? '
      + 'V nabídce napájení je i restart.';
  }
  if (p.includes('faktur') || p.includes('objedn')) {
    return 'Tohle je falešná schránka ve falešném systému, takže ti nic neúčtujeme.\n\nS pozdravem\nPodatelna AstroOS';
  }
  return 'Děkujeme za zprávu. Tohle je automatická odpověď — na adrese '
    + zprava.komu + ' nikdo doopravdy nesedí.\n\nZkus napsat na ai@astroos, tam ti odpoví AstroAI.';
}

export const postaApp = {
  id: 'mail', name: 'Pošta', icon: 'mail', color: 'linear-gradient(145deg,#4aa3e8,#2563a8)',
  cat: 'net', width: 980, height: 660,

  mount(body, win) {
    const st = { zpravy: nactiPostu(), slozka: 'dorucene', vybrana: null, pise: false, cekaji: [] };
    win.posta = st;

    const slozkyEl = el('div.po-slozky');
    const seznamEl = el('div.po-seznam');
    const ctenar = el('div.po-ctenar');

    const vSlozce = (id) => st.zpravy
      .filter((z) => z.slozka === id)
      .sort((a, b) => b.cas - a.cas);

    const neprectene = () => st.zpravy.filter((z) => z.slozka === 'dorucene' && !z.precteno).length;

    // ---------------------------------------------------------------- seznamy
    function kresliSlozky() {
      slozkyEl.replaceChildren(
        el('button.po-napsat', { onclick: () => pisNovou() }, icon('plus'), el('span', { text: 'Napsat' })),
        ...SLOZKY.map((s) => {
          const pocet = s.id === 'dorucene' ? neprectene() : vSlozce(s.id).length;
          const b = el('button.po-slozka' + (s.id === st.slozka ? '.on' : ''), {},
            icon(s.ikona),
            el('span', { text: s.name }),
            pocet ? el('span.po-pocet', { text: String(pocet) }) : null,
          );
          b.onclick = () => { st.slozka = s.id; st.vybrana = null; kresliVse(); };
          return b;
        }),
      );
      win.title = neprectene() ? `Pošta (${neprectene()})` : 'Pošta';
    }

    function kresliSeznam() {
      const zpravy = vSlozce(st.slozka);
      if (!zpravy.length) {
        seznamEl.replaceChildren(el('div.po-prazdno', {}, icon('mail'), el('div', { text: 'Tady nic není.' })));
        return;
      }
      seznamEl.replaceChildren(...zpravy.map((z) => {
        const r = el('button.po-radek' + (z.id === st.vybrana ? '.on' : '') + (z.precteno ? '' : '.nove'), {},
          el('div.po-kdo', { text: st.slozka === 'odeslane' ? `komu: ${z.komu}` : z.odJmeno }),
          el('div.po-predmet', { text: z.predmet || '(bez předmětu)' }),
          el('div.po-uryvek', { text: z.telo.replace(/\s+/g, ' ').slice(0, 64) }),
          el('div.po-kdy', { text: kdy(z.cas) }),
        );
        r.onclick = () => otevri(z);
        r.oncontextmenu = (e) => {
          e.preventDefault();
          contextMenu([
            { icon: 'arrowRight', label: 'Otevřít', onClick: () => otevri(z) },
            z.slozka === 'dorucene' ? { icon: 'check', label: z.precteno ? 'Označit jako nepřečtené' : 'Označit jako přečtené', onClick: () => { z.precteno = !z.precteno; uloz(); } } : null,
            '-',
            { icon: 'trash', label: z.slozka === 'kos' ? 'Smazat natrvalo' : 'Vyhodit do koše', danger: true, onClick: () => smaz(z) },
          ].filter(Boolean), { x: e.clientX, y: e.clientY });
        };
        return r;
      }));
    }

    function kdy(cas) {
      const d = new Date(cas);
      const dnes = new Date();
      if (d.toDateString() === dnes.toDateString()) return cz.cas(d);
      return cz.datumKratky(d);
    }

    function kresliCtenar() {
      if (st.pise) return;
      const z = st.zpravy.find((x) => x.id === st.vybrana);
      if (!z) {
        ctenar.replaceChildren(el('div.po-prazdno', {}, icon('mail'),
          el('div', { text: 'Vyber zprávu vlevo, nebo napiš novou.' })));
        return;
      }
      ctenar.replaceChildren(
        el('div.po-hlavicka', {},
          el('h2', { text: z.predmet || '(bez předmětu)' }),
          el('div.po-meta', {},
            el('div.po-avatar', { text: (z.odJmeno || z.od)[0].toUpperCase() }),
            el('div', {},
              el('div.po-od', { text: `${z.odJmeno || z.od} <${z.od}>` }),
              el('div.po-komu', { text: `komu: ${z.komu} · ${cz.datumKratky(new Date(z.cas))} ${cz.cas(new Date(z.cas))}` }),
            ),
            el('div.po-spacer'),
            el('button.po-akce', { title: 'Odpovědět', onclick: () => pisNovou(z) }, icon('arrowRight'), el('span', { text: 'Odpovědět' })),
            el('button.po-akce.ic', { title: 'Vyhodit do koše', onclick: () => smaz(z) }, icon('trash')),
          ),
        ),
        el('div.po-telo', { text: z.telo }),
      );
    }

    const kresliVse = () => { kresliSlozky(); kresliSeznam(); kresliCtenar(); };
    const uloz = () => { ulozPostu(st.zpravy); kresliVse(); };

    function otevri(z) {
      st.pise = false;
      st.vybrana = z.id;
      if (!z.precteno) { z.precteno = true; ulozPostu(st.zpravy); }
      kresliVse();
    }

    function smaz(z) {
      if (z.slozka === 'kos') st.zpravy = st.zpravy.filter((x) => x.id !== z.id);
      else z.slozka = 'kos';
      if (st.vybrana === z.id) st.vybrana = null;
      uloz();
    }

    // ---------------------------------------------------------------- psaní
    function pisNovou(odpovedNa = null) {
      st.pise = true;
      const komu = el('input.po-pole', { value: odpovedNa ? odpovedNa.od : 'ai@astroos', placeholder: 'komu@astroos' });
      const predmet = el('input.po-pole', {
        value: odpovedNa ? (odpovedNa.predmet.startsWith('Re:') ? odpovedNa.predmet : `Re: ${odpovedNa.predmet}`) : '',
        placeholder: 'Předmět',
      });
      // textarea se neplní atributem, obsah se musí nastavit vlastností
      const telo = el('textarea.po-telo-pole', { spellcheck: 'false', placeholder: 'Piš…' });
      if (odpovedNa) {
        telo.value = `\n\n— — —\n${odpovedNa.odJmeno} napsal(a):\n`
          + odpovedNa.telo.split('\n').map((r) => '> ' + r).join('\n');
      }
      telo.onkeydown = (e) => {
        e.stopPropagation();
        if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); posli(); }
      };
      komu.onkeydown = predmet.onkeydown = (e) => e.stopPropagation();

      const posli = () => {
        const z = {
          id: noveId(), slozka: 'odeslane', precteno: true, cas: Date.now(),
          od: JA(), odJmeno: State.get('user')?.name || 'Já',
          komu: komu.value.trim() || 'nikam@astroos',
          predmet: predmet.value.trim(),
          telo: telo.value.trim(),
        };
        st.zpravy.push(z);
        st.pise = false;
        st.slozka = 'odeslane';
        st.vybrana = z.id;
        uloz();
        toast({ title: 'Odesláno', body: z.komu, icon: 'mail', timeout: 2200 });
        naplanujOdpoved(z);
      };

      ctenar.replaceChildren(el('div.po-psani', {},
        el('div.po-hlavicka', {}, el('h2', { text: odpovedNa ? 'Odpověď' : 'Nová zpráva' })),
        el('label.po-radka', {}, el('span', { text: 'Komu' }), komu),
        el('label.po-radka', {}, el('span', { text: 'Předmět' }), predmet),
        telo,
        el('div.po-patka', {},
          el('button.po-akce', { onclick: posli }, icon('arrowRight'), el('span', { text: 'Odeslat (Ctrl+Enter)' })),
          el('button.po-akce.ic', { title: 'Zahodit', onclick: () => { st.pise = false; kresliCtenar(); } }, icon('x')),
        ),
      ));
      setTimeout(() => (odpovedNa ? telo : komu).focus(), 40);
      kresliSlozky();
      kresliSeznam();
    }

    // ---------------------------------------------------------------- odpovědi
    function naplanujOdpoved(odeslana) {
      const doAI = /(^|[@.])ai@|astroai/i.test(odeslana.komu);
      const cekac = setTimeout(async () => {
        let telo;
        let odJmeno = 'Podatelna AstroOS';
        let od = 'podatelna@astroos';

        if (doAI) {
          od = 'ai@astroos';
          odJmeno = 'AstroAI';
          try {
            const { text } = await aiSend([{
              role: 'user',
              content: `Přišel ti e-mail. Odpověz ve stejném jazyce, v jakém je napsaný, stručně a lidsky, bez uvozovek a bez podpisu.\n\n`
                + `Předmět: ${odeslana.predmet || '(bez předmětu)'}\n\n${odeslana.telo}`,
            }], { zdroj: 'posta' });
            telo = text.trim();
          } catch (err) {
            telo = `Teď se mi nedaří odpovědět — model neběží.\n\n(${err.message})`;
          }
        } else {
          telo = odpovedPodatelny(odeslana);
        }

        if (!body.isConnected) return;                 // okno se mezitím zavřelo
        const z = {
          id: noveId(), slozka: 'dorucene', precteno: false, cas: Date.now(),
          od, odJmeno, komu: JA(),
          predmet: odeslana.predmet.startsWith('Re:') ? odeslana.predmet : `Re: ${odeslana.predmet || '(bez předmětu)'}`,
          telo,
        };
        st.zpravy.push(z);
        uloz();
        toast({ title: `Nová zpráva od ${odJmeno}`, body: z.predmet, icon: 'mail' });
      }, doAI ? 900 : 4000);
      st.cekaji.push(cekac);
    }

    // ---------------------------------------------------------------- složení
    body.append(el('div.po', {}, slozkyEl, seznamEl, ctenar));
    kresliVse();

    const offPosta = bus.on('posta:nova', () => { st.zpravy = nactiPostu(); kresliSlozky(); kresliSeznam(); });
    win.onClose = () => { st.cekaji.forEach(clearTimeout); offPosta(); };
  },

  unmount(win) { win.onClose?.(); },
};
