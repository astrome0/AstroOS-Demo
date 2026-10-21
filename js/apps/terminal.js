// AstroOS — Terminál (příkazová řádka nad virtuálním diskem)

import { el, cz, plural } from '../util.js';
import * as FS from '../fs.js';
import { State } from '../state.js';
import { tt } from '../i18n.js';
import { nazevOS, verzeOS } from '../aktualizace.js';

const verse = () => `${nazevOS()} — astro-shell 1.0`;

export const terminalApp = {
  id: 'terminal', name: 'Terminál', icon: 'terminal', color: 'linear-gradient(145deg,#2c3338,#14181b)',
  cat: 'tools', width: 780, height: 480,

  mount(body, win) {
    const out = el('div.tm-out');
    const input = el('input.tm-in', { spellcheck: 'false', autocomplete: 'off' });
    const promptEl = el('span.tm-prompt');
    const line = el('div.tm-line', {}, promptEl, input);
    const screen = el('div.tm', {}, out, line);
    body.append(screen);

    const st = { cwd: win.opts?.cwd || FS.HOME, hist: [], hi: -1 };
    win.tm = st;

    const user = () => State.get('user').name.toLowerCase();
    const pc = () => State.get('jmenoPc') || 'astro';
    const shortCwd = () => (st.cwd.startsWith(FS.HOME) ? '~' + st.cwd.slice(FS.HOME.length) : st.cwd);

    function drawPrompt() {
      promptEl.innerHTML = '';
      promptEl.append(
        el('span.p-user', { text: `${user()}@${pc()}` }),
        el('span.p-sep', { text: ':' }),
        el('span.p-path', { text: shortCwd() }),
        el('span.p-sep', { text: '$ ' }),
      );
    }

    function print(text = '', cls = '') {
      const row = el('div.tm-row' + (cls ? '.' + cls : ''), { text });
      out.append(row);
      screen.scrollTop = screen.scrollHeight;
      return row;
    }
    function printHtml(html, cls = '') {
      out.append(el('div.tm-row' + (cls ? '.' + cls : ''), { html }));
      screen.scrollTop = screen.scrollHeight;
    }

    const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

    // ---------------------------------------------------------------- příkazy
    const CMD = {
      help() {
        printHtml('<b>' + tt('Dostupné příkazy:') + '</b>');
        const list = [
          ['help', 'tenhle seznam'],
          ['ls [-l] [cesta]', 'výpis složky'],
          ['cd [cesta]', 'změna složky (cd .. nahoru, cd ~ domů)'],
          ['pwd', 'kde jsem'],
          ['cat soubor', 'vypíše soubor'],
          ['echo text [> soubor]', 'vypíše text nebo ho zapíše'],
          ['touch soubor', 'vytvoří prázdný soubor'],
          ['mkdir [-p] složka', 'vytvoří složku'],
          ['rm [-r] cesta', 'vyhodí do koše (-f natrvalo)'],
          ['mv zdroj cíl', 'přesune nebo přejmenuje'],
          ['cp zdroj cíl', 'zkopíruje'],
          ['tree [cesta]', 'strom složek'],
          ['find vzorek', 'hledá v názvech'],
          ['edit soubor', 'otevře v Poznámkách'],
          ['open aplikace', 'spustí aplikaci'],
          ['df', 'místo na disku'],
          ['neofetch', 'info o systému'],
          ['date, whoami, uname', 'drobnosti'],
          ['clear', 'vyčistí obrazovku'],
          ['reboot, poweroff, lock', 'napájení'],
        ];
        for (const [c, d] of list) printHtml(`  <span class="c-cmd">${esc(tt(c).padEnd(22))}</span><span class="c-dim">${esc(tt(d))}</span>`);
      },

      ls(args) {
        const long = args.includes('-l');
        const all = args.includes('-a');
        const target = args.find((a) => !a.startsWith('-')) || '.';
        const path = FS.normalize(target, st.cwd);
        const node = FS.get(path);
        if (!node) return err(tt(`ls: ${target}: cesta neexistuje`));
        if (FS.isFile(node)) return print(FS.basename(path));
        const items = FS.list(path, { hidden: all });
        if (!items.length) return;
        if (long) {
          for (const i of items) {
            const size = i.dir ? '-' : FS.humanSize(i.size);
            const d = new Date(i.modified);
            printHtml(`<span class="c-dim">${i.dir ? 'd' : '-'}rw-r--r--</span>  ` +
              `<span class="c-dim">${esc(size.padStart(9))}</span>  ` +
              `<span class="c-dim">${esc(cz.datumKratky(d).padStart(11))} ${esc(cz.cas(d).padStart(5))}</span>  ` +
              `<span class="${i.dir ? 'c-dir' : 'c-file'}">${esc(i.name)}</span>`);
          }
        } else {
          printHtml(items.map((i) => `<span class="${i.dir ? 'c-dir' : 'c-file'}">${esc(i.name)}</span>`).join('   '));
        }
      },

      cd(args) {
        const t = args[0] || '~';
        const path = FS.normalize(t === '~' ? FS.HOME : t.replace(/^~/, FS.HOME), st.cwd);
        const node = FS.get(path);
        if (!node) return err(tt(`cd: ${t}: cesta neexistuje`));
        if (!FS.isDir(node)) return err(tt(`cd: ${t}: není složka`));
        st.cwd = path;
        drawPrompt();
      },

      pwd() { print(st.cwd); },

      cat(args) {
        if (!args[0]) return err(tt('cat: chybí soubor'));
        for (const a of args) {
          try { print(FS.read(FS.normalize(a, st.cwd))); }
          catch (e) { err(tt(`cat: ${e.message}`)); }
        }
      },

      echo(args, raw) {
        const m = raw.match(/^(.*?)\s*(>>?)\s*(\S+)\s*$/);
        if (m) {
          const path = FS.normalize(m[3], st.cwd);
          const text = m[1].replace(/^["']|["']$/g, '');
          try {
            const old = m[2] === '>>' && FS.exists(path) ? FS.read(path) : '';
            FS.write(path, old + text + '\n');
          } catch (e) { return err(tt(`echo: ${e.message}`)); }
          return;
        }
        print(raw.replace(/^["']|["']$/g, ''));
      },

      touch(args) {
        if (!args[0]) return err(tt('touch: chybí název'));
        for (const a of args) {
          const p = FS.normalize(a, st.cwd);
          try { if (!FS.exists(p)) FS.write(p, ''); else FS.write(p, FS.read(p)); }
          catch (e) { err(tt(`touch: ${e.message}`)); }
        }
      },

      mkdir(args) {
        const parents = args.includes('-p');
        const names = args.filter((a) => !a.startsWith('-'));
        if (!names.length) return err(tt('mkdir: chybí název'));
        for (const n of names) {
          try { FS.mkdir(FS.normalize(n, st.cwd), { parents }); }
          catch (e) { err(tt(`mkdir: ${e.message}`)); }
        }
      },

      rm(args) {
        const rec = args.some((a) => /^-\w*r/.test(a));
        const force = args.some((a) => /^-\w*f/.test(a));
        const names = args.filter((a) => !a.startsWith('-'));
        if (!names.length) return err(tt('rm: chybí cesta'));
        for (const n of names) {
          const p = FS.normalize(n, st.cwd);
          const node = FS.get(p);
          if (!node) { err(tt(`rm: ${n}: neexistuje`)); continue; }
          if (FS.isDir(node) && Object.keys(node.d).length && !rec) { err(tt(`rm: ${n}: složka není prázdná (použij -r)`)); continue; }
          try { FS.remove(p, { toTrash: !force }); }
          catch (e) { err(tt(`rm: ${e.message}`)); }
        }
      },

      mv(args) {
        if (args.length < 2) return err(tt('mv: potřebuju zdroj a cíl'));
        const from = FS.normalize(args[0], st.cwd);
        const to = FS.normalize(args[1], st.cwd);
        try {
          if (FS.isDir(FS.get(to))) FS.move(from, to);
          else FS.rename(from, FS.basename(to));
        } catch (e) { err(tt(`mv: ${e.message}`)); }
      },

      cp(args) {
        if (args.length < 2) return err(tt('cp: potřebuju zdroj a cíl'));
        try { FS.copy(FS.normalize(args[0], st.cwd), FS.normalize(args[1], st.cwd)); }
        catch (e) { err(tt(`cp: ${e.message}`)); }
      },

      tree(args) {
        const start = FS.normalize(args[0] || '.', st.cwd);
        if (!FS.isDir(FS.get(start))) return err(tt(`tree: ${args[0] || '.'}: není složka`));
        printHtml(`<span class="c-dir">${esc(start)}</span>`);
        let dirs = 0, files = 0;
        const walk = (path, prefix, depth) => {
          if (depth > 4) return;
          const items = FS.list(path);
          items.forEach((it, i) => {
            const last = i === items.length - 1;
            printHtml(`<span class="c-dim">${esc(prefix + (last ? '└── ' : '├── '))}</span>` +
              `<span class="${it.dir ? 'c-dir' : 'c-file'}">${esc(it.name)}</span>`);
            if (it.dir) { dirs++; walk(it.path, prefix + (last ? '    ' : '│   '), depth + 1); }
            else files++;
          });
        };
        walk(start, '', 0);
        printHtml(`<span class="c-dim">${tt(plural(dirs, ['složka', 'složky', 'složek']))}, ${tt(plural(files, ['soubor', 'soubory', 'souborů']))}</span>`);
      },

      find(args) {
        if (!args[0]) return err(tt('find: chybí vzorek'));
        const q = args[0].toLowerCase();
        let n = 0;
        const walk = (path) => {
          for (const it of FS.list(path, { hidden: true })) {
            if (it.name.toLowerCase().includes(q)) { printHtml(`<span class="${it.dir ? 'c-dir' : 'c-file'}">${esc(it.path)}</span>`); n++; }
            if (it.dir) walk(it.path);
          }
        };
        walk('/');
        if (!n) print(tt('nic nenalezeno'), 'dim');
      },

      edit(args) {
        if (!args[0]) return err(tt('edit: chybí soubor'));
        const p = FS.normalize(args[0], st.cwd);
        if (!FS.exists(p)) FS.write(p, '');
        import('../apps.js').then(({ openApp }) => openApp('notes', { path: p }));
      },

      open(args) {
        if (!args[0]) return err(tt('open: která aplikace?'));
        import('../apps.js').then(({ APPS, openApp }) => {
          if (!APPS[args[0]]) return err(tt(`open: aplikace „${args[0]}“ neexistuje`));
          openApp(args[0], args[1] ? { path: FS.normalize(args[1], st.cwd) } : undefined);
        });
      },

      df() {
        const u = FS.usage();
        printHtml('<span class="c-dim">' + tt('Souborový systém      Využito     Celkem   Použito') + '</span>');
        print(`/dev/nvme0            ${FS.humanSize(u.used).padStart(8)}       2 TB      ${u.percent.toFixed(1)}%`);
      },

      neofetch() {
        const u = State.get('user');
        const info = [
          [tt('Uživatel'), `${u.name.toLowerCase()}@${pc()}`],
          [tt('Systém'), nazevOS()],
          [tt('Jádro'), `nova ${verzeOS().jadro}`],
          [tt('Prostředí'), 'Astro Shell'],
          [tt('Procesor'), 'Astro Core X7-9900'],
          [tt('Paměť'), '32 GB'],
          ['Disk', `${FS.humanSize(FS.usage().used)} / 2 TB`],
          ['Shell', 'astro-shell 1.0'],
        ];
        const logo = [
          '      /\\      ',
          '     /  \\     ',
          '    / /\\ \\    ',
          '   / /__\\ \\   ',
          '  /________\\  ',
        ];
        for (let i = 0; i < Math.max(logo.length, info.length); i++) {
          const l = (logo[i] || '              ');
          const d = info[i] ? `<span class="c-cmd">${esc(info[i][0])}</span><span class="c-dim">: </span>${esc(info[i][1])}` : '';
          printHtml(`<span class="c-logo">${esc(l)}</span>  ${d}`);
        }
      },

      date() { print(`${cz.datumDlouhy()} ${new Date().getFullYear()}, ${cz.casS()}`); },
      whoami() { print(user()); },
      uname() { print(verse()); },
      clear() { out.innerHTML = ''; },
      reboot() { import('../util.js').then(({ bus }) => bus.emit('power', 'restart')); },
      poweroff() { import('../util.js').then(({ bus }) => bus.emit('power', 'shutdown')); },
      lock() { import('../util.js').then(({ bus }) => bus.emit('power', 'lock')); },
      exit() { win.close(); },
    };
    CMD.dir = CMD.ls;
    CMD.cls = CMD.clear;
    CMD.shutdown = CMD.poweroff;

    const err = (msg) => print(msg, 'err');

    // ---------------------------------------------------------------- běh
    function run(raw) {
      const text = raw.trim();
      printHtml(`<span class="c-dim">${esc(`${user()}@${pc()}:${shortCwd()}$`)}</span> ${esc(text)}`);
      if (!text) return;
      st.hist.push(text);
      st.hi = st.hist.length;

      const parts = text.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
      const cmd = parts[0];
      const args = parts.slice(1).map((a) => a.replace(/^["']|["']$/g, ''));
      const rest = text.slice(cmd.length).trim();

      if (!CMD[cmd]) return err(tt(`${cmd}: příkaz nenalezen — zkus „help“`));
      try { CMD[cmd](args, rest); }
      catch (e) { err(tt(`${cmd}: ${e.message}`)); }
    }

    input.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        const v = input.value;
        input.value = '';
        run(v);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (st.hi > 0) input.value = st.hist[--st.hi] || '';
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (st.hi < st.hist.length - 1) input.value = st.hist[++st.hi] || '';
        else { st.hi = st.hist.length; input.value = ''; }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        complete();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        CMD.clear();
      }
    };

    /** Doplňování názvů a příkazů tabulátorem. */
    function complete() {
      const v = input.value;
      const parts = v.split(' ');
      const last = parts[parts.length - 1];
      let opts;
      if (parts.length === 1) {
        opts = Object.keys(CMD).filter((c) => c.startsWith(last));
      } else {
        const dir = last.includes('/') ? FS.dirname(FS.normalize(last, st.cwd)) : st.cwd;
        const frag = FS.basename(last) === '/' ? '' : last.split('/').pop();
        try {
          opts = FS.list(dir, { hidden: frag.startsWith('.') })
            .filter((i) => i.name.startsWith(frag))
            .map((i) => last.slice(0, last.length - frag.length) + i.name + (i.dir ? '/' : ''));
        } catch { opts = []; }
      }
      if (!opts.length) return;
      if (opts.length === 1) {
        parts[parts.length - 1] = opts[0];
        input.value = parts.join(' ') + (opts[0].endsWith('/') ? '' : ' ');
      } else {
        printHtml(`<span class="c-dim">${esc(`${user()}@${pc()}:${shortCwd()}$`)}</span> ${esc(v)}`);
        printHtml(opts.map((o) => `<span class="c-file">${esc(o.split('/').pop() || o)}</span>`).join('   '));
      }
    }

    screen.onpointerdown = (e) => { if (!getSelection().toString()) setTimeout(() => input.focus(), 0); };

    // uvítání
    drawPrompt();
    print(verse(), 'hl');
    print(tt('Napiš „help“ pro seznam příkazů. Tabulátor doplňuje, šipky listují historii.'), 'dim');
    print('');
    setTimeout(() => input.focus(), 60);

    win.tmRun = (line) => run(line);
    win.tmCd = (p) => { st.cwd = FS.normalize(p); drawPrompt(); };
  },

  reopen(win, opts) { if (opts?.cwd) win.tmCd?.(opts.cwd); },
};
