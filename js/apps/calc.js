// AstroOS — Kalkulačka

import { el } from '../util.js';
import { icon } from '../icons.js';

const fmt = (n) => {
  if (!isFinite(n)) return 'nelze dělit nulou';
  const zaokrouhleno = Math.round(n * 1e10) / 1e10;
  const s = String(zaokrouhleno);
  if (s.includes('e')) return s.replace('.', ',');
  const [cela, des] = s.split('.');
  return cela.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (des ? ',' + des : '');
};

const spocti = (a, op, b) => ({
  '+': a + b, '−': a - b, '×': a * b, '÷': b === 0 ? Infinity : a / b,
}[op] ?? b);

export const calcApp = {
  id: 'calc', name: 'Kalkulačka', icon: 'calc', color: 'linear-gradient(145deg,#3fd0c8,#1e8f92)',
  cat: 'tools', width: 360, height: 560,

  mount(body, win) {
    // vstup drží text, ať jde psát „0,5“ i mazat po znacích
    const st = { vstup: '0', ulozene: null, op: null, novy: true, historie: [] };

    const radek = el('div.ca-expr');
    const displej = el('div.ca-display', { text: '0' });
    const hist = el('div.ca-hist');

    const cislo = () => parseFloat(st.vstup.replace(/\s/g, '').replace(',', '.')) || 0;

    function ukaz() {
      displej.textContent = st.vstup;
      radek.textContent = st.ulozene !== null ? `${fmt(st.ulozene)} ${st.op}` : '';
      displej.style.fontSize = st.vstup.length > 12 ? '26px' : st.vstup.length > 9 ? '32px' : '40px';
    }

    function zadejCislici(c) {
      if (st.novy) { st.vstup = c === ',' ? '0,' : c; st.novy = false; }
      else if (c === ',') { if (!st.vstup.includes(',')) st.vstup += ','; }
      else if (st.vstup === '0') st.vstup = c;
      else if (st.vstup.replace(/[^0-9]/g, '').length < 14) st.vstup += c;
      ukaz();
    }

    function operace(op) {
      if (st.op !== null && !st.novy) vysledek(false);
      st.ulozene = cislo();
      st.op = op;
      st.novy = true;
      ukaz();
    }

    function vysledek(zapis = true) {
      if (st.op === null) return;
      const a = st.ulozene, b = cislo();
      const r = spocti(a, st.op, b);
      if (zapis) {
        st.historie.unshift(`${fmt(a)} ${st.op} ${fmt(b)} = ${fmt(r)}`);
        st.historie = st.historie.slice(0, 20);
        kresliHistorii();
      }
      st.vstup = fmt(r);
      st.ulozene = null;
      st.op = null;
      st.novy = true;
      ukaz();
    }

    function kresliHistorii() {
      hist.innerHTML = '';
      if (!st.historie.length) {
        hist.append(el('div.ca-hist-empty', { text: 'Historie výpočtů je prázdná' }));
        return;
      }
      st.historie.forEach((h) => {
        const b = el('button.ca-hist-i', { text: h });
        b.onclick = () => {
          st.vstup = h.split('=').pop().trim();
          st.novy = true;
          ukaz();
        };
        hist.append(b);
      });
    }

    const akce = {
      C: () => { st.vstup = '0'; st.ulozene = null; st.op = null; st.novy = true; ukaz(); },
      CE: () => { st.vstup = '0'; st.novy = true; ukaz(); },
      '⌫': () => {
        if (st.novy) return;
        st.vstup = st.vstup.length > 1 ? st.vstup.slice(0, -1) : '0';
        if (st.vstup === '-' || st.vstup === '') st.vstup = '0';
        ukaz();
      },
      '±': () => { st.vstup = st.vstup.startsWith('-') ? st.vstup.slice(1) : '-' + st.vstup; ukaz(); },
      // jako ve Windows: u sčítání je to procento z prvního čísla (200 + 15 % = 230),
      // u násobení jen setina (200 × 15 % = 30)
      '%': () => {
        const b = cislo();
        const zProcent = st.op === '+' || st.op === '−';
        st.vstup = fmt(zProcent && st.ulozene !== null ? (st.ulozene * b) / 100 : b / 100);
        st.novy = true;
        ukaz();
      },
      '√': () => { st.vstup = fmt(Math.sqrt(Math.abs(cislo()))); st.novy = true; ukaz(); },
      '1/x': () => { st.vstup = fmt(cislo() === 0 ? Infinity : 1 / cislo()); st.novy = true; ukaz(); },
      'x²': () => { st.vstup = fmt(cislo() ** 2); st.novy = true; ukaz(); },
    };

    // rozložení jako v běžné kalkulačce
    const KLAVESY = [
      ['%', 'fn'], ['CE', 'fn'], ['C', 'fn'], ['⌫', 'fn'],
      ['1/x', 'fn'], ['x²', 'fn'], ['√', 'fn'], ['÷', 'op'],
      ['7', ''], ['8', ''], ['9', ''], ['×', 'op'],
      ['4', ''], ['5', ''], ['6', ''], ['−', 'op'],
      ['1', ''], ['2', ''], ['3', ''], ['+', 'op'],
      ['±', ''], ['0', ''], [',', ''], ['=', 'eq'],
    ];

    const mrizka = el('div.ca-keys');
    const tlacitka = new Map();
    for (const [znak, typ] of KLAVESY) {
      const b = el('button.ca-key' + (typ ? '.' + typ : ''), { text: znak });
      b.onclick = () => stiskni(znak);
      tlacitka.set(znak, b);
      mrizka.append(b);
    }

    function stiskni(znak) {
      const b = tlacitka.get(znak);
      if (b) { b.classList.add('hit'); setTimeout(() => b.classList.remove('hit'), 120); }
      if (/^[0-9]$/.test(znak) || znak === ',') return zadejCislici(znak);
      if (['+', '−', '×', '÷'].includes(znak)) return operace(znak);
      if (znak === '=') return vysledek();
      akce[znak]?.();
    }

    const KLAVESNICE = {
      '*': '×', 'x': '×', '/': '÷', '-': '−', '+': '+', '.': ',', ',': ',',
      'Enter': '=', '=': '=', 'Backspace': '⌫', 'Escape': 'C', 'Delete': 'CE', '%': '%',
    };

    body.tabIndex = 0;
    body.onkeydown = (e) => {
      const z = /^[0-9]$/.test(e.key) ? e.key : KLAVESNICE[e.key];
      if (!z) return;
      e.preventDefault();
      e.stopPropagation();
      stiskni(z);
    };

    const bSmaz = el('button.ca-hist-clear', { title: 'Vymazat historii' }, icon('trash'));
    bSmaz.onclick = () => { st.historie = []; kresliHistorii(); };

    body.append(el('div.ca', {},
      el('div.ca-out', {}, radek, displej),
      mrizka,
      el('div.ca-hist-head', {}, el('span', { text: 'Historie' }), bSmaz),
      hist,
    ));

    ukaz();
    kresliHistorii();
    setTimeout(() => body.focus(), 50);
    win.title = 'Kalkulačka';
  },
};
