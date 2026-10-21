// AstroOS — zamykací obrazovka a přihlášení

import { $, el, sleep, cz } from './util.js';
import { icon } from './icons.js';
import { State } from './state.js';
import * as Sit from './sit.js';
import * as Ucty from './ucty.js';
import * as Hesla from './hesla.js';

let clockTimer = null;

/**
 * Zobrazí zámek. Vrací příslib, který se splní po správném heslu
 * ('unlock') nebo po volbě z nabídky napájení ('shutdown' | 'restart').
 */
export function showLock({ greeting = 'Vítejte' } = {}) {
  return new Promise((resolve) => {
    const lock = $('#lock');
    const user = State.get('user');
    let odemknuto = false;   // fáze 1 → 2
    let hotovo = false;
    Hesla.zamkni();          // zámek obrazovky zamyká i uložená hesla Novy
    $('#wallpaper').classList.add('blurred');
    $('#wallpaper-dim').classList.add('on');

    // ----- fáze 1: hodiny -----
    const time = el('div.time', { text: cz.cas() });
    const date = el('div.date', { text: cz.datumDlouhy() });
    // Skutečné počasí pro město z aplikace Počasí — hned poslední známé, pak čerstvé z internetu.
    const posledni = State.get('pocasiPosledni');
    const pocasiText = el('span', { text: posledni?.text || 'Praha…' });
    const pocasi = el('span', { title: 'Město se mění hledáním v aplikaci Počasí' }, icon('weather'), pocasiText);
    import('./apps/pocasi.js')
      .then(({ aktualniPocasi }) => aktualniPocasi())
      .then((z) => { pocasiText.textContent = z.text; })
      .catch(() => { if (!posledni) pocasi.remove(); });   // bez internetu a bez uložené hodnoty widget schováme
    const clock = el('div.lock-clock', {},
      time, date,
      el('div.widgets', {},
        el('span', {}, icon(Sit.letadlo() && !Sit.wifiZapnuta() ? 'letadlo' : Sit.online() ? 'wifi' : 'wifiOff'), Sit.popis()),
        pocasi,
      ),
    );
    const hint = el('div.lock-hint', { text: 'Stiskni libovolnou klávesu nebo klikni' });

    // ----- fáze 2: přihlášení -----
    const input = el('input', {
      type: 'password', placeholder: user.pin ? 'Heslo nebo PIN' : 'Heslo', spellcheck: 'false',
      onkeydown: (e) => {
        if (e.key === 'Enter') submit();
        e.stopPropagation();
      },
      oninput: () => { err.classList.remove('on'); row.classList.remove('bad'); },
    });
    const eye = el('button.eye', { title: 'Zobrazit heslo' }, icon('eye'));
    eye.onclick = () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      eye.replaceChildren(icon(show ? 'eyeOff' : 'eye'));
      input.focus();
    };
    // účet bez hesla (ucty.js) → jen tlačítko, jako ve Windows
    const row = user.password
      ? el('div.pwd-row', {}, input, eye, el('button.go', { title: 'Přihlásit', onclick: () => submit() }, icon('arrowRight')))
      : el('button.lock-prihlasit', { text: 'Přihlásit se', onclick: () => submit() });
    const err = el('div.err', { text: '' });
    const hintLink = el('button.hint-link', {
      text: 'Nevzpomínám si na heslo',
      onclick: () => {
        const u = State.get('user');
        if (u.otazky?.length) return obnovaOtazkami(u);
        if (u.email) return obnovaKodem(u);
        err.textContent = `Nápověda: ${u.hint}`;
        err.style.color = '#cfe6d6';
        err.classList.add('on');
      },
    });

    const login = el('div.login', {},
      el('div.avatar', { text: user.avatar || user.name[0] }),
      el('div.who', { text: user.name }),
      row, err, user.password ? hintLink : null,
    );

    // ----- další uživatelé (vlevo dole) -----
    const ucty = Ucty.vsichni();
    const uzivatele = ucty.length > 1 ? el('div.lock-users', {}, ucty.map((u) => {
      const b = el('button.lock-user' + (u.aktivni ? '.on' : ''), {},
        el('span.lock-user-av', { text: Ucty.avatarPismeno(u) }), el('span', { text: u.jmeno, 'data-no-i18n': true }));
      b.onclick = (e) => { e.stopPropagation(); if (!u.aktivni) Ucty.prepni(u.id); else odemkni(); };
      return b;
    })) : null;

    // ----- spodní lišta -----
    const bar = el('div.lock-bar', {},
      el('button', { title: 'Dostupnost' }, icon('access')),
      el('button', { title: 'Síť: ' + Sit.popis() }, icon(Sit.letadlo() && !Sit.wifiZapnuta() ? 'letadlo' : Sit.online() ? 'wifi' : 'wifiOff')),
      el('button', { title: 'Napájení', onclick: (e) => powerMenu(e.currentTarget) }, icon('power')),
    );

    lock.className = 'lock';
    lock.replaceChildren(...[clock, hint, login, uzivatele, bar].filter(Boolean));

    clearInterval(clockTimer);
    clockTimer = setInterval(() => {
      time.textContent = cz.cas();
      date.textContent = cz.datumDlouhy();
    }, 1000);

    // ----- přechod mezi fázemi -----
    function odemkni() {
      if (odemknuto) return;
      odemknuto = true;
      lock.classList.add('unlocked-step');
      hint.remove();
      setTimeout(() => input.focus(), 380);
    }
    const onKey = (e) => {
      if (hotovo) return;
      if (e.key === 'Escape' && odemknuto) return;
      odemkni();
    };
    const onClick = (e) => {
      if (hotovo || e.target.closest('.lock-bar') || e.target.closest('.lock-users') || e.target.closest('.ctx')) return;
      odemkni();
    };
    lock.addEventListener('pointerdown', onClick);
    window.addEventListener('keydown', onKey);

    // ----- zapomenuté heslo: bezpečnostní otázky (místní účet) nebo kód e-mailem (Astro účet) -----
    const bezDiak = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
    let puvodni = null;
    function obnovaForm(nadpis, pole, overit, popis) {
      puvodni ||= [...login.children];
      const ch = el('div.err');
      const odeslat = () => {
        if (overit()) {
          finish('unlock');
          setTimeout(() => import('./ui.js').then(({ toast }) => toast({
            title: 'Přihlášeno bez hesla', body: 'Nové heslo si nastav v Nastavení → Účet.', icon: 'key', timeout: 9000,
          })), 2600);
          return;
        }
        ch.textContent = 'Odpověď nesouhlasí. Zkus to znovu.';
        ch.classList.add('on');
      };
      pole.forEach((p) => {
        p.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') odeslat(); };
        p.oninput = () => ch.classList.remove('on');
      });
      login.replaceChildren(
        el('div.avatar', { text: user.avatar || user.name[0] }),
        el('div.who', { text: nadpis }),
        popis ? el('div.obnova-popis', { text: popis }) : null,
        el('div.obnova', {}, ...pole),
        ch,
        el('div.obnova-tl', {},
          el('button.hint-link', { text: 'Zpět', onclick: () => { login.replaceChildren(...puvodni); input.focus(); } }),
          el('button.obnova-ok', { text: 'Odeslat', onclick: odeslat }),
        ),
      );
      setTimeout(() => pole[0].focus(), 50);
    }
    function obnovaOtazkami(u) {
      const pole = u.otazky.map((o) => el('input', { placeholder: o.q, title: o.q, spellcheck: 'false' }));
      obnovaForm('Bezpečnostní otázky', pole,
        () => u.otazky.every((o, i) => bezDiak(pole[i].value) === bezDiak(o.a)),
        u.otazky.map((o, i) => `${i + 1}. ${o.q}`).join('\n'));
    }
    function obnovaKodem(u) {
      const kod = String(1000 + Math.floor(Math.random() * 9000));
      const pole = [el('input', { placeholder: 'Čtyřmístný kód', maxlength: 4, inputmode: 'numeric' })];
      obnovaForm('Obnovení hesla', pole, () => pole[0].value.trim() === kod, `Poslali jsme kód na ${u.email}.`);
      setTimeout(() => import('./oobe.js').then(({ upozorneni }) => upozorneni('Astro účet', `Kód pro obnovení hesla: ${kod}`)), 1800);
    }

    let pokusy = 0;
    function submit() {
      if (hotovo) return;
      const u = State.get('user');
      const ok = input.value === u.password || (!!u.pin && input.value === u.pin);
      if (!ok) {
        pokusy++;
        row.classList.add('shake', 'bad');
        setTimeout(() => row.classList.remove('shake'), 460);
        err.style.color = '';
        err.textContent = pokusy >= 2
          ? `Heslo není správné. Zkus nápovědu: ${State.get('user').hint}`
          : 'Heslo není správné. Zkus to znovu.';
        err.classList.add('on');
        input.focus();
        input.select();
        return;
      }
      // trezor hesel Novy je zašifrovaný heslem účtu — s PINem zůstane zamčený (Nova si o heslo řekne)
      if (input.value === u.password) Hesla.odemkni(u.password);
      finish('unlock');
    }

    async function finish(vysledek) {
      if (hotovo) return;
      hotovo = true;
      clearInterval(clockTimer);
      window.removeEventListener('keydown', onKey);
      lock.removeEventListener('pointerdown', onClick);

      if (vysledek === 'unlock') {
        login.replaceChildren(el('div.signing', {},
          el('div.spinner', {}, el('i'), el('i'), el('i'), el('i'), el('i')),
          el('div.txt', { text: greeting }),
        ));
        bar.remove();
        uzivatele?.remove();
        await sleep(1350);
        $('#wallpaper').classList.remove('blurred');
        $('#wallpaper-dim').classList.remove('on');
      }
      lock.classList.add('leaving');
      await sleep(vysledek === 'unlock' ? 420 : 120);
      lock.classList.add('hidden');
      lock.innerHTML = '';
      resolve(vysledek);
    }

    function powerMenu(anchor) {
      import('./ui.js').then(({ contextMenu }) => {
        const r = anchor.getBoundingClientRect();
        contextMenu([
          { icon: 'sleep', label: 'Uspat', onClick: () => finish('restart') },
          { icon: 'restart', label: 'Restartovat', onClick: () => finish('restart') },
          { icon: 'power', label: 'Vypnout', onClick: () => finish('shutdown') },
        ], { x: r.right, y: r.top, align: 'br' });
      });
    }
  });
}

export function hideLockClock() {
  clearInterval(clockTimer);
}
