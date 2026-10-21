// AstroOS — Poznámky (jednoduchý textový editor nad virtuálním diskem)

import { el, bus } from '../util.js';
import { icon } from '../icons.js';
import * as FS from '../fs.js';
import { toast } from '../ui.js';

export const notesApp = {
  id: 'notes', name: 'Poznámky', icon: 'notes', color: 'linear-gradient(145deg,#f0b95c,#c47f26)',
  cat: 'office', width: 720, height: 520,

  mount(body, win) {
    const area = el('textarea.ed-area', { spellcheck: 'false', placeholder: 'Piš…' });
    const nameEl = el('div.ed-name');
    const stat = el('div.ed-stat');
    const bSave = el('button.ed-btn', { title: 'Uložit (Ctrl+S)' }, icon('check'), el('span', { text: 'Uložit' }));
    const bNew = el('button.ed-btn', { title: 'Nový soubor' }, icon('plus'), el('span', { text: 'Nový' }));
    const bOpen = el('button.ed-btn', { title: 'Otevřít v Souborech' }, icon('folderOpen'), el('span', { text: 'Složka' }));

    const st = { path: null, dirty: false };
    win.ed = st;

    function setTitle() {
      const n = st.path ? FS.basename(st.path) : 'Bez názvu';
      nameEl.textContent = (st.dirty ? '• ' : '') + n;
      nameEl.title = st.path || '';
      win.title = (st.dirty ? '• ' : '') + n + ' — Poznámky';
    }

    function updateStat() {
      const t = area.value;
      const slova = t.trim() ? t.trim().split(/\s+/).length : 0;
      stat.textContent = `${t.length} znaků · ${slova} slov · ${t.split('\n').length} řádků`;
    }

    function load(path) {
      try {
        area.value = FS.read(path);
        st.path = FS.normalize(path);
        st.dirty = false;
        setTitle();
        updateStat();
      } catch (err) {
        toast({ title: 'Nešlo otevřít', body: err.message, icon: 'info' });
      }
    }

    function save() {
      if (!st.path) st.path = FS.normalize(FS.HOME + '/Dokumenty/' + FS.freeName(FS.HOME + '/Dokumenty', 'poznámka.txt'));
      try {
        FS.write(st.path, area.value);
        st.dirty = false;
        setTitle();
        toast({ title: 'Uloženo', body: st.path, icon: 'check', timeout: 2200 });
      } catch (err) {
        toast({ title: 'Uložení selhalo', body: err.message, icon: 'info' });
      }
    }

    bSave.onclick = save;
    bNew.onclick = () => { area.value = ''; st.path = null; st.dirty = false; setTitle(); updateStat(); area.focus(); };
    bOpen.onclick = () => import('../apps.js').then(({ openApp }) =>
      openApp('files', { path: st.path ? FS.dirname(st.path) : FS.HOME + '/Dokumenty' }));

    area.oninput = () => { if (!st.dirty) { st.dirty = true; setTitle(); } updateStat(); };
    area.onkeydown = (e) => {
      e.stopPropagation();
      if (e.ctrlKey && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
      if (e.key === 'Tab') {
        e.preventDefault();
        const s = area.selectionStart;
        area.setRangeText('  ', s, area.selectionEnd, 'end');
        area.dispatchEvent(new Event('input'));
      }
    };

    body.append(el('div.ed', {},
      el('div.ed-bar', {}, nameEl, el('div.ed-spacer'), bNew, bOpen, bSave),
      area,
      el('div.ed-foot', {}, stat),
    ));

    if (win.opts?.path) load(win.opts.path);
    else { setTitle(); updateStat(); }
    setTimeout(() => area.focus(), 50);

    win.loadFile = (p) => { if (st.dirty && st.path) FS.write(st.path, area.value); load(p); };
  },

  reopen(win, opts) { if (opts?.path) win.loadFile?.(opts.path); },
};
