// AstroOS — okno Historie verzí (Soubory ▸ pravý klik ▸ Historie verzí…)
// Vlevo verze (aktuální + uložené), vpravo náhled: u textu rozdíly proti aktuální verzi, u obrázku obrázek.
// Obnovit = současný obsah se nejdřív uloží jako verze (verze.js obnov), takže jde vrátit.

import { el, bus, cz, pred, plural } from '../util.js';
import { icon } from '../icons.js';
import * as FS from '../fs.js';
import * as Verze from '../verze.js';
import { toast } from '../ui.js';
import { glyfSouboru } from '../soubory.js';

const textovy = (jm, c) => FS.isText(jm) && !String(c).startsWith('data:');

export const historieApp = {
  id: 'historie', name: 'Historie verzí', icon: 'clock', color: 'linear-gradient(145deg,#4aa3e8,#6a43c0)',
  cat: 'tools', width: 860, height: 560, hidden: true,

  async mount(body, win) {
    const cesta = win.opts?.path;
    const st = { vybrana: null, celyText: false };
    const obal = el('div.hv');
    body.append(obal);

    async function kresli() {
      const uzel = FS.get(cesta);
      if (!FS.isFile(uzel)) {
        obal.replaceChildren(el('div.fm-empty', {}, icon('clock'), el('div', { text: 'Soubor už neexistuje.' })));
        return;
      }
      const jm = FS.basename(cesta);
      win.title = `Historie verzí — ${jm}`;
      const verze = await Verze.seznam(uzel.id);
      const aktualni = { aktualni: true, c: uzel.c, m: uzel.m, velikost: uzel.c.length };
      const vse = [aktualni, ...verze];
      if (!st.vybrana || !vse.some((v) => v.klic === st.vybrana.klic && !v.aktualni === !st.vybrana.aktualni)) st.vybrana = verze[0] || aktualni;
      const vybrana = vse.find((v) => (v.aktualni ? st.vybrana.aktualni : v.klic === st.vybrana.klic)) || aktualni;

      const seznam = el('div.hv-seznam', {}, vse.map((v, i) => {
        const predchozi = vse[i + 1];
        const zmena = predchozi ? v.velikost - predchozi.velikost : 0;
        const b = el('button.hv-verze' + (v === vybrana ? '.on' : ''), {},
          el('div.hv-verze-t', {},
            el('b', { text: v.aktualni ? 'Aktuální verze' : `${cz.datumKratky(new Date(v.m))} ${cz.cas(new Date(v.m))}` }),
            el('small', { text: `${pred(v.m)} · ${FS.humanSize(v.velikost)}${zmena ? ` · ${zmena > 0 ? '+' : '−'}${FS.humanSize(Math.abs(zmena))}` : ''}` })),
          v.aktualni ? el('span.hv-stitek', { text: 'teď' }) : null);
        b.onclick = () => { st.vybrana = v; kresli(); };
        return b;
      }));

      // náhled vybrané verze
      let nahled;
      const src = FS.isImage(jm) && String(vybrana.c).startsWith('data:') ? vybrana.c
        : FS.isImage(jm) && String(vybrana.c).trimStart().startsWith('<svg') ? 'data:image/svg+xml;utf8,' + encodeURIComponent(vybrana.c) : null;
      if (src) nahled = el('div.hv-obr', {}, el('img', { src, alt: '' }));
      else if (textovy(jm, vybrana.c)) {
        const r = !vybrana.aktualni && !st.celyText ? Verze.rozdil(vybrana.c, uzel.c) : null;
        if (r) {
          const pridano = r.filter((x) => x.typ === '+').length, odebrano = r.filter((x) => x.typ === '-').length;
          nahled = el('div.hv-text', {},
            el('div.hv-souhrn', { text: pridano || odebrano
              ? `Od téhle verze přibylo ${plural(pridano, ['řádek', 'řádky', 'řádků'])}, ubylo ${plural(odebrano, ['řádek', 'řádky', 'řádků'])}.`
              : 'Obsah je stejný jako aktuální verze.' }),
            el('pre.hv-diff', { 'data-no-i18n': true }, r.map((x) => el('div.hv-r.' + ({ '=': 'stejne', '+': 'plus', '-': 'minus' }[x.typ]), {},
              el('span.hv-znak', { text: x.typ === '=' ? ' ' : x.typ === '+' ? '+' : '−' }), x.t || ' '))));
        } else {
          nahled = el('div.hv-text', {}, el('pre.hv-diff', { 'data-no-i18n': true, text: String(vybrana.c).slice(0, 200000) }));
        }
      } else {
        nahled = el('div.fm-empty', {}, el('div.hv-glyf', {}, glyfSouboru(cesta, uzel)),
          el('div', { text: `${FS.fileInfo(jm).kind} · ${FS.humanSize(vybrana.velikost)}` }));
      }

      const akce = vybrana.aktualni ? [] : [
        el('button.btn.primary', { onclick: () => {
          try {
            Verze.obnov(cesta, vybrana);
            toast({ title: 'Verze obnovena', body: `${jm} je zase ve verzi z ${cz.datumKratky(new Date(vybrana.m))}. Předchozí obsah zůstal v historii.`, icon: 'clock' });
            st.vybrana = null;
          } catch (err) { toast({ title: 'Obnovení se nepovedlo', body: err.message, icon: 'x' }); }
        } }, icon('refresh'), el('span', { text: 'Obnovit' })),
        el('button.btn', { onclick: () => {
          try {
            const c = Verze.ulozJakoKopii(cesta, vybrana);
            toast({ title: 'Uloženo jako kopie', body: FS.basename(c), icon: 'copy' });
          } catch (err) { toast({ title: 'Uložení se nepovedlo', body: err.message, icon: 'x' }); }
        } }, icon('copy'), el('span', { text: 'Uložit jako kopii' })),
        el('button.btn.hv-smazat', { title: 'Smazat tuhle verzi', onclick: async (e) => {
          const b = e.currentTarget;   // nevratné → potvrzení druhým klikem
          if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.replaceChildren(icon('trash'), el('span', { text: 'Opravdu?' })); setTimeout(() => { if (b.isConnected) { b.dataset.sure = '0'; b.replaceChildren(icon('trash')); } }, 3000); return; }
          await Verze.smazVerzi(vybrana.klic); st.vybrana = null;
        } }, icon('trash')),
      ];
      const prepinac = !vybrana.aktualni && textovy(jm, vybrana.c)
        ? el('div.set-volby', {}, ...[[false, 'Rozdíly'], [true, 'Celý text']].map(([v, t]) =>
          el('button.set-volba' + (st.celyText === v ? '.on' : ''), { text: t, onclick: () => { st.celyText = v; kresli(); } })))
        : null;

      obal.replaceChildren(
        el('div.hv-hlava', {},
          el('div.hv-glyf-m', {}, glyfSouboru(cesta, uzel)),
          el('div', { style: { flex: '1', minWidth: '0' } },
            el('b', { text: jm, 'data-no-i18n': true }),
            el('small', { text: `${cesta.replace(FS.HOME, '~')} · ${verze.length ? plural(verze.length, ['uložená verze', 'uložené verze', 'uložených verzí']) : 'zatím bez uložených verzí'}`, 'data-no-i18n': false })),
          prepinac),
        el('div.hv-telo', {},
          seznam,
          el('div.hv-prava', {}, nahled, akce.length ? el('div.hv-akce', {}, ...akce) : null)),
        verze.length ? '' : el('div.hv-pata', { text: `Verze se ukládají samy, když soubor změníš — nejvýš jednou za ${Math.round(Verze.INTERVAL / 60e3)} minut.${Verze.zapnuto() ? '' : ' Historie je teď vypnutá (Nastavení ▸ Úložiště).'}` }),
      );
    }

    const odhlas = [bus.on('verze', () => body.isConnected && kresli()), bus.on('fs:change', () => body.isConnected && kresli())];
    win.onClose = () => odhlas.forEach((f) => f());
    kresli();
  },
  unmount(win) { win.onClose?.(); },
  reopen(win, opts) {
    if (!opts?.path || opts.path === win.opts?.path) return;
    win.onClose?.();
    win.opts = opts;
    win.body.innerHTML = '';
    historieApp.mount(win.body, win);
  },
};
