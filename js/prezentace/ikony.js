// AstroPrezentace — ikony navíc k ikonám Písma a Tabulek (styl Fluent: obrys = currentColor, barevné akcenty)

import { pridejIkony } from '../pismo/ikony.js';

const R = '#c43e1c';   // PowerPoint
const O = '#ed6c47';
const M = '#0f6cbd';
const Z = '#f7b500';
const G = '#4ea72e';

const snimek32 = (x = 4, y = 7, w = 24, h = 16, vypln = '#fff') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="${vypln}" stroke="currentColor" stroke-width="1.3"/>`;
const hvezda = (cx, cy, r, barva) => {
  const b = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? r * 0.45 : r; b.push(`${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`); }
  return `<path d="M${b.join('L')}Z" fill="${barva}" stroke="${barva}" stroke-width=".6" stroke-linejoin="round"/>`;
};

const IK = {
  // ---------- velké (32)
  novySnimek: `${snimek32(3, 9, 22, 15)}<rect x="6" y="12" width="12" height="3" rx=".5" fill="${R}"/><path d="M6 18h10M6 20.5h8" stroke="currentColor" stroke-width="1"/><circle cx="25" cy="8" r="5.5" fill="${G}"/><path d="M25 5v6M22 8h6" stroke="#fff" stroke-width="1.6"/>`,
  designer: `<rect x="4" y="6" width="17" height="12" rx="1.5" fill="#fde6dc" stroke="${R}" stroke-width="1.2"/><rect x="11" y="14" width="17" height="12" rx="1.5" fill="#fff" stroke="currentColor" stroke-width="1.3"/><path d="M14 22l3-4 3 3 2-2 4 3" fill="none" stroke="${M}" stroke-width="1.2"/><path d="M26 3l1 2.2 2.2 1-2.2 1L26 9.4l-1-2.2-2.2-1 2.2-1z" fill="${Z}"/>`,
  usporadat: `<rect x="4" y="4" width="14" height="12" fill="${M}" opacity=".85"/><rect x="10" y="10" width="14" height="12" fill="#fff" stroke="currentColor" stroke-width="1.3"/><rect x="16" y="16" width="12" height="11" fill="${O}"/>`,
  rychleStyly: `<rect x="4" y="5" width="10" height="10" rx="1" fill="${R}"/><rect x="18" y="5" width="10" height="10" rx="1" fill="#fff" stroke="${M}" stroke-width="1.4"/><rect x="4" y="18" width="10" height="10" rx="1" fill="#dff1e3" stroke="${G}" stroke-width="1.2"/><rect x="18" y="18" width="10" height="10" rx="1" fill="${Z}"/>`,
  prezentaceZacatek: `${snimek32(3, 5, 26, 17)}<path d="M16 22v5M11 28h10" stroke="currentColor" stroke-width="1.3"/><path d="M13 9.5v8l6.5-4z" fill="${R}"/>`,
  prezentaceAktualni: `${snimek32(3, 5, 26, 17)}<path d="M16 22v5M11 28h10" stroke="currentColor" stroke-width="1.3"/><path d="M10 9.5v8l6.5-4z" fill="${R}"/><path d="M19 9.5v8" stroke="${R}" stroke-width="2"/>`,
  nastavitPrezentaci: `${snimek32(3, 5, 22, 15)}<circle cx="23" cy="22" r="6" fill="#fff" stroke="currentColor" stroke-width="1.2"/><circle cx="23" cy="22" r="2" fill="none" stroke="${M}" stroke-width="1.3"/><path d="M23 15v2M23 27v2M16 22h2M28 22h2" stroke="${M}" stroke-width="1.3"/>`,
  skrytSnimek: `${snimek32(3, 5, 22, 15)}<path d="M6 25l20-18" stroke="${R}" stroke-width="1.8"/><path d="M14 27h14" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 2"/>`,
  vyzkouset: `${snimek32(3, 5, 20, 14)}<circle cx="22" cy="21" r="7" fill="#fff" stroke="currentColor" stroke-width="1.3"/><path d="M22 17v4l3 2" fill="none" stroke="${R}" stroke-width="1.4"/><path d="M20 12.5h4" stroke="currentColor" stroke-width="1.3"/>`,
  nahrat: `${snimek32(3, 6, 22, 15)}<circle cx="24" cy="22" r="6" fill="${R}"/><circle cx="24" cy="22" r="2.4" fill="#fff"/>`,
  nahled: `<rect x="4" y="6" width="24" height="16" rx="1.5" fill="#fff" stroke="currentColor" stroke-width="1.3"/><path d="M13 10v8l7-4z" fill="${M}"/><path d="M10 26h12" stroke="currentColor" stroke-width="1.3"/>`,
  podoknoAnimaci: `<rect x="4" y="4" width="24" height="24" rx="1.5" fill="#fff" stroke="currentColor" stroke-width="1.3"/>${hvezda(10, 10, 3.6, G)}<path d="M15 10h9" stroke="currentColor" stroke-width="1.3"/>${hvezda(10, 17, 3.6, Z)}<path d="M15 17h9" stroke="currentColor" stroke-width="1.3"/>${hvezda(10, 24, 3.6, R)}<path d="M15 24h9" stroke="currentColor" stroke-width="1.3"/>`,
  pridatAnimaci: `${hvezda(14, 16, 11, G)}<circle cx="24" cy="24" r="6" fill="#fff" stroke="currentColor" stroke-width="1.2"/><path d="M24 20.5v7M20.5 24h7" stroke="currentColor" stroke-width="1.4"/>`,
  formatPozadi: `${snimek32(3, 6, 24, 17, '#fde6dc')}<path d="M3 20l8-7 6 5 4-3 6 5" fill="none" stroke="${R}" stroke-width="1.3"/><path d="M22 25l6-6 2 2-6 6h-2z" fill="${Z}" stroke="#9a6b00" stroke-width="1"/>`,
  velikostSnimku: `<rect x="3" y="8" width="20" height="14" rx="1" fill="#fff" stroke="currentColor" stroke-width="1.3"/><rect x="9" y="4" width="20" height="24" rx="1" fill="none" stroke="${M}" stroke-width="1.2" stroke-dasharray="2.5 2"/>`,
  smartart: `<rect x="3" y="12" width="8" height="8" rx="1.5" fill="${G}"/><rect x="12" y="12" width="8" height="8" rx="1.5" fill="${G}" opacity=".75"/><rect x="21" y="12" width="8" height="8" rx="1.5" fill="${G}" opacity=".5"/><path d="M11 16h1M20 16h1" stroke="currentColor"/>`,
  zvuk: `<path d="M5 12h5l7-6v20l-7-6H5z" fill="#fff" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M21 11a6 6 0 0 1 0 10M24.5 7.5a11 11 0 0 1 0 17" fill="none" stroke="${R}" stroke-width="1.6" stroke-linecap="round"/>`,
  cisloSnimku: `${snimek32(3, 6, 26, 18)}<text x="23" y="21" text-anchor="middle" font-size="8" font-weight="700" font-family="Segoe UI" fill="${R}">#</text>`,
  osnova: `<rect x="4" y="4" width="24" height="24" rx="1.5" fill="#fff" stroke="currentColor" stroke-width="1.3"/><rect x="7" y="8" width="5" height="3.5" fill="${R}"/><path d="M14 9.8h11M10 15h13M10 19h11M7 23.5h5" stroke="currentColor" stroke-width="1.2"/>`,
  razeni: `<rect x="3" y="5" width="11" height="8" rx="1" fill="#fff" stroke="currentColor" stroke-width="1.2"/><rect x="18" y="5" width="11" height="8" rx="1" fill="#fff" stroke="currentColor" stroke-width="1.2"/><rect x="3" y="18" width="11" height="8" rx="1" fill="#fde6dc" stroke="${R}" stroke-width="1.2"/><rect x="18" y="18" width="11" height="8" rx="1" fill="#fff" stroke="currentColor" stroke-width="1.2"/>`,
  strankaPoznamek: `<rect x="7" y="3" width="18" height="26" rx="1" fill="#fff" stroke="currentColor" stroke-width="1.3"/><rect x="10" y="6" width="12" height="8" fill="#fde6dc" stroke="${R}" stroke-width="1"/><path d="M10 18h12M10 21h12M10 24h8" stroke="currentColor" stroke-width="1.1"/>`,
  cteni: `<path d="M4 7c4-1.5 8-1.5 12 1 4-2.5 8-2.5 12-1v18c-4-1.5-8-1.5-12 1-4-2.5-8-2.5-12-1z" fill="#fff" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M16 8v18" stroke="currentColor" stroke-width="1.2"/><path d="M7 12h6M7 15h6M19 12h6M19 15h6" stroke="${R}" stroke-width="1.2"/>`,
  prizpusobitOknu: `<rect x="3" y="5" width="26" height="22" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="8" y="10" width="16" height="12" fill="#fde6dc" stroke="${R}" stroke-width="1.2"/><path d="M5 8l3 3M27 8l-3 3M5 24l3-3M27 24l-3-3" stroke="currentColor" stroke-width="1.2"/>`,
  predloha: `<rect x="3" y="4" width="18" height="13" rx="1" fill="#fde6dc" stroke="${R}" stroke-width="1.2"/><rect x="8" y="10" width="18" height="13" rx="1" fill="#fff" stroke="currentColor" stroke-width="1.2"/><rect x="13" y="16" width="16" height="12" rx="1" fill="#fff" stroke="currentColor" stroke-width="1.2"/>`,
  fotoalbum: `<rect x="5" y="4" width="22" height="24" rx="1.5" fill="#fff" stroke="currentColor" stroke-width="1.3"/><rect x="9" y="8" width="14" height="10" fill="#8bc3ea" stroke="${M}" stroke-width="1"/><circle cx="19" cy="11" r="1.6" fill="${Z}"/><path d="M9 16l4-4 3 3 2-2 5 4" fill="none" stroke="${M}" stroke-width="1"/><path d="M9 22h14M9 25h9" stroke="currentColor" stroke-width="1.1"/>`,
  efektyTvaru: `<rect x="5" y="5" width="18" height="18" rx="2" fill="${M}"/><rect x="9" y="9" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".5"/><path d="M26 3l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill="${Z}"/>`,
  prechodIk: `<rect x="3" y="8" width="17" height="13" rx="1" fill="#fff" stroke="currentColor" stroke-width="1.2"/><rect x="12" y="12" width="17" height="13" rx="1" fill="#fde6dc" stroke="${R}" stroke-width="1.2"/><path d="M15 5h8l-2-2M23 5l-2 2" fill="none" stroke="${M}" stroke-width="1.2"/>`,
  pouzitVse: `<rect x="3" y="4" width="12" height="9" rx="1" fill="#fde6dc" stroke="${R}" stroke-width="1.1"/><rect x="17" y="4" width="12" height="9" rx="1" fill="#fde6dc" stroke="${R}" stroke-width="1.1"/><rect x="3" y="18" width="12" height="9" rx="1" fill="#fde6dc" stroke="${R}" stroke-width="1.1"/><rect x="17" y="18" width="12" height="9" rx="1" fill="#fde6dc" stroke="${R}" stroke-width="1.1"/>`,
  moznostiEfektu: `<rect x="4" y="5" width="24" height="17" rx="1.5" fill="#fff" stroke="currentColor" stroke-width="1.3"/><path d="M9 14h14M18 10l5 4-5 4" fill="none" stroke="${M}" stroke-width="1.5"/><path d="M13 26h6l-3 3z" fill="currentColor"/>`,
  zvukPrechodu: `<path d="M5 12h5l7-6v20l-7-6H5z" fill="#fff" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M21 12a5 5 0 0 1 0 8" fill="none" stroke="${M}" stroke-width="1.5"/>`,
  prezentovatOnline: `${snimek32(3, 5, 26, 17)}<circle cx="16" cy="13.5" r="4.5" fill="none" stroke="${M}" stroke-width="1.2"/><path d="M11.5 13.5h9M16 9c2 2.5 2 6.5 0 9M16 9c-2 2.5-2 6.5 0 9" fill="none" stroke="${M}" stroke-width="1"/>`,
  vlastniPrezentace: `${snimek32(5, 3, 22, 13)}${snimek32(3, 9, 22, 13)}<path d="M20 26l2-5 5-5 3 3-5 5z" fill="${Z}" stroke="#9a6b00"/>`,
  kamera: `<rect x="3" y="9" width="19" height="15" rx="2" fill="#fff" stroke="currentColor" stroke-width="1.3"/><path d="M22 14l7-4v13l-7-4z" fill="${R}" stroke="${R}" stroke-linejoin="round"/>`,
  zaznamObrazovky: `${snimek32(3, 5, 26, 18)}<circle cx="16" cy="14" r="4" fill="${R}"/><path d="M10 27h12" stroke="currentColor" stroke-width="1.3"/>`,
  exportVidea: `<rect x="3" y="6" width="26" height="18" rx="2" fill="#fff" stroke="currentColor" stroke-width="1.3"/><path d="M13 10v10l8-5z" fill="${R}"/><path d="M10 28h12" stroke="currentColor" stroke-width="1.3"/>`,
  predlohaPoznamek: `<rect x="6" y="3" width="20" height="26" rx="1" fill="#fff" stroke="currentColor" stroke-width="1.3"/><path d="M9 8h14M9 12h14M9 16h10" stroke="${R}" stroke-width="1.2"/>`,
  barevne: `<circle cx="11" cy="12" r="6" fill="${R}" opacity=".85"/><circle cx="21" cy="12" r="6" fill="${M}" opacity=".85"/><circle cx="16" cy="20" r="6" fill="${G}" opacity=".85"/>`,
  stupneSedi: `<circle cx="11" cy="12" r="6" fill="#7a7a7a"/><circle cx="21" cy="12" r="6" fill="#b0b0b0"/><circle cx="16" cy="20" r="6" fill="#4a4a4a"/>`,
  cernobile: `<circle cx="16" cy="16" r="11" fill="#fff" stroke="currentColor" stroke-width="1.3"/><path d="M16 5a11 11 0 0 1 0 22z" fill="currentColor"/>`,
  opravy: `<circle cx="16" cy="16" r="11" fill="#fff" stroke="currentColor" stroke-width="1.3"/><path d="M16 5a11 11 0 0 1 0 22z" fill="${Z}"/><path d="M16 9v14" stroke="currentColor" stroke-width="1"/>`,
  barvaObrazku: `<rect x="4" y="5" width="24" height="20" rx="1.5" fill="#fff" stroke="currentColor" stroke-width="1.3"/><rect x="6" y="7" width="6" height="16" fill="${R}"/><rect x="13" y="7" width="6" height="16" fill="${G}"/><rect x="20" y="7" width="6" height="16" fill="${M}"/>`,
  umeleckeEfekty: `<rect x="4" y="5" width="24" height="20" rx="1.5" fill="#fff" stroke="currentColor" stroke-width="1.3"/><path d="M6 21c4-8 8-10 12-6s6 0 8-4" fill="none" stroke="${R}" stroke-width="2.2" stroke-linecap="round"/><circle cx="11" cy="11" r="2" fill="${Z}"/>`,
  pruhlednostObr: `<rect x="4" y="5" width="24" height="20" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M4 5h6v5H4zM16 5h6v5h-6zM10 10h6v5h-6zM22 10h6v5h-6zM4 15h6v5H4zM16 15h6v5h-6zM10 20h6v5h-6zM22 20h6v5h-6z" fill="currentColor" opacity=".25"/>`,
  stylyObrazku: `<rect x="4" y="5" width="24" height="20" rx="1.5" fill="#fff" stroke="currentColor" stroke-width="1.3"/><rect x="8" y="9" width="16" height="12" fill="#8bc3ea" stroke="#fff" stroke-width="2"/><path d="M8 21l5-5 3 3 3-2 5 4" fill="none" stroke="${M}"/>`,
  alternativniText: `<rect x="4" y="5" width="24" height="20" rx="1.5" fill="#fff" stroke="currentColor" stroke-width="1.3"/><text x="16" y="19.5" text-anchor="middle" font-size="10" font-weight="700" font-family="Segoe UI" fill="${M}">Alt</text>`,
  dopredu: `<rect x="3" y="3" width="15" height="15" fill="#fff" stroke="currentColor" stroke-width="1.2"/><rect x="11" y="11" width="18" height="18" fill="${M}"/>`,
  dozadu: `<rect x="11" y="11" width="18" height="18" fill="#fff" stroke="currentColor" stroke-width="1.2"/><rect x="3" y="3" width="15" height="15" fill="${M}"/><rect x="11" y="11" width="7" height="7" fill="#fff" stroke="currentColor" stroke-width="1.2"/>`,
  podoknoVyberu: `<rect x="4" y="4" width="24" height="24" rx="1.5" fill="#fff" stroke="currentColor" stroke-width="1.3"/><rect x="8" y="8" width="5" height="4" fill="${M}"/><path d="M15 10h9M8 16h16M8 22h16" stroke="currentColor" stroke-width="1.2"/>`,
  zarovnatObjekty: `<path d="M5 4v24" stroke="currentColor" stroke-width="1.5"/><rect x="7" y="7" width="18" height="6" fill="${M}"/><rect x="7" y="18" width="12" height="6" fill="${M}" opacity=".6"/>`,
  otocitObjekt: `<rect x="6" y="10" width="14" height="14" fill="#fff" stroke="currentColor" stroke-width="1.3"/><path d="M18 5a9 9 0 0 1 9 9" fill="none" stroke="${M}" stroke-width="1.5"/><path d="M27 10v4h-4" fill="none" stroke="${M}" stroke-width="1.5"/>`,
  vyplnTextu: `<text x="16" y="21" text-anchor="middle" font-size="18" font-weight="700" font-family="Segoe UI" fill="${M}">A</text><rect x="5" y="25" width="22" height="4" fill="${M}"/>`,
  obrysTextu: `<text x="16" y="21" text-anchor="middle" font-size="18" font-weight="700" font-family="Segoe UI" fill="#fff" stroke="${R}" stroke-width="1">A</text><rect x="5" y="25" width="22" height="4" fill="${R}"/>`,
  efektyTextu: `<text x="15" y="21" text-anchor="middle" font-size="18" font-weight="700" font-family="Segoe UI" fill="${M}" style="filter:drop-shadow(1.5px 1.5px 0 rgba(0,0,0,.35))">A</text><path d="M25 5l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill="${Z}"/>`,
  upravitData: `<rect x="4" y="5" width="18" height="16" fill="#fff" stroke="currentColor" stroke-width="1.2"/><path d="M4 10h18M4 15h18M10 5v16M16 5v16" stroke="currentColor"/><path d="M18 27l1-4 8-8 3 3-8 8z" fill="${Z}" stroke="#9a6b00"/>`,
  sloupceTextu: `<rect x="4" y="5" width="24" height="22" rx="1" fill="#fff" stroke="currentColor" stroke-width="1.3"/><path d="M7 9h8M7 12h8M7 15h8M7 18h8M17 9h8M17 12h8M17 15h8" stroke="${M}" stroke-width="1.1"/>`,

  // ---------- malé (20)
  rozvrzeni: `<rect x="2.5" y="4" width="15" height="12" rx="1" fill="#fff" stroke="currentColor" stroke-width="1.1"/><rect x="4.5" y="6" width="11" height="2.5" fill="${R}"/><rect x="4.5" y="10" width="5" height="4" fill="none" stroke="currentColor" stroke-width=".9"/><rect x="10.5" y="10" width="5" height="4" fill="none" stroke="currentColor" stroke-width=".9"/>`,
  obnovit: `<rect x="2.5" y="4" width="11" height="9" rx="1" fill="#fff" stroke="currentColor" stroke-width="1.1"/><path d="M17.5 12a4 4 0 1 1-1.2-2.8" fill="none" stroke="${M}" stroke-width="1.3"/><path d="M16.5 7v2.5H14" fill="none" stroke="${M}" stroke-width="1.3"/>`,
  oddil: `<rect x="2.5" y="3" width="9" height="6" rx=".8" fill="#fff" stroke="currentColor" stroke-width="1.1"/><rect x="2.5" y="11" width="9" height="6" rx=".8" fill="#fff" stroke="currentColor" stroke-width="1.1"/><path d="M13.5 6h4M13.5 14h4" stroke="${R}" stroke-width="1.4"/>`,
  stinTextu: `<text x="3" y="15" font-size="13" font-family="Segoe UI" fill="#b0b0b0">S</text><text x="2" y="14" font-size="13" font-family="Segoe UI" fill="currentColor">S</text>`,
  rozestupZnaku: `<text x="3" y="12" font-size="10" font-family="Segoe UI" fill="currentColor">AV</text><path d="M2 16h16M4 14.5 2 16l2 1.5M16 14.5l2 1.5-2 1.5" fill="none" stroke="${M}" stroke-width="1"/>`,
  smerTextu: `<text x="12" y="16" font-size="10" font-family="Segoe UI" fill="currentColor" transform="rotate(-90 10 10)">ab</text><path d="M4 3v14M2 15l2 2 2-2" fill="none" stroke="${M}" stroke-width="1.1"/>`,
  zarovnatText: `<rect x="2.5" y="2.5" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M5.5 8.5h9M5.5 11.5h9" stroke="${M}" stroke-width="1.3"/>`,
  prevestSmartArt: `<rect x="2" y="7" width="5" height="6" rx="1" fill="${G}"/><rect x="8" y="7" width="5" height="6" rx="1" fill="${G}" opacity=".75"/><rect x="14" y="7" width="4.5" height="6" rx="1" fill="${G}" opacity=".5"/>`,
  urovenDolu: `<path d="M3 5h14M8 10h9M8 15h9" stroke="currentColor" stroke-width="1.2"/><path d="M3 9l3 3-3 3" fill="none" stroke="${M}" stroke-width="1.2"/>`,
  urovenNahoru: `<path d="M3 5h14M8 10h9M8 15h9" stroke="currentColor" stroke-width="1.2"/><path d="M6 9l-3 3 3 3" fill="none" stroke="${M}" stroke-width="1.2"/>`,
  kopirovatAnimaci: `<path d="M4 3h9v4H4z" fill="${Z}" stroke="#9a6b00" stroke-width="1"/><path d="M13 5h2v4H9v3" fill="none" stroke="currentColor" stroke-width="1.1"/><rect x="7.7" y="12" width="2.6" height="6" rx="1" fill="#8a6d3b"/>${hvezda(16, 15, 3.5, G)}`,
  presunoutDrive: `<path d="M10 16V4M5 9l5-5 5 5" fill="none" stroke="currentColor" stroke-width="1.4"/>`,
  presunoutPozdeji: `<path d="M10 4v12M5 11l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.4"/>`,
  zacatek: `<circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M8 7v6l5-3z" fill="${G}"/>`,
  trvani: `<circle cx="10" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M10 7.5V11l2.5 1.5M8 2.5h4" fill="none" stroke="currentColor" stroke-width="1.2"/>`,
  zpozdeni: `<circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M10 6v4h4" fill="none" stroke="${R}" stroke-width="1.3"/>`,
  poznamky: `<rect x="3" y="3" width="14" height="14" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M6 7h8M6 10h8M6 13h5" stroke="currentColor" stroke-width="1.1"/>`,
  normalniMaly: `<rect x="2" y="3.5" width="16" height="13" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M6 3.5v13" stroke="currentColor" stroke-width="1.1"/><rect x="8" y="6" width="8" height="6" fill="none" stroke="currentColor" stroke-width="1"/>`,
  razeniMaly: `<rect x="2.5" y="3" width="6" height="5" fill="none" stroke="currentColor" stroke-width="1.1"/><rect x="11.5" y="3" width="6" height="5" fill="none" stroke="currentColor" stroke-width="1.1"/><rect x="2.5" y="12" width="6" height="5" fill="none" stroke="currentColor" stroke-width="1.1"/><rect x="11.5" y="12" width="6" height="5" fill="none" stroke="currentColor" stroke-width="1.1"/>`,
  cteniMaly: `<path d="M2.5 4.5c2.5-1 5-1 7.5.8 2.5-1.8 5-1.8 7.5-.8v11c-2.5-1-5-1-7.5.8-2.5-1.8-5-1.8-7.5-.8z" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/><path d="M10 5.3v11" stroke="currentColor" stroke-width="1"/>`,
  prezentaceMaly: `<rect x="2.5" y="3.5" width="15" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M10 13.5v3M6.5 17h7" stroke="currentColor" stroke-width="1.2"/><path d="M8.5 6.5v4l3.2-2z" fill="currentColor"/>`,
  prizpusobitMaly: `<rect x="2.5" y="3.5" width="15" height="13" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M5 7V5.5h2M15 7V5.5h-2M5 13v1.5h2M15 13v1.5h-2" fill="none" stroke="currentColor" stroke-width="1.1"/>`,
  sipkaVlevoMala: `<path d="M12 4 6 10l6 6" fill="none" stroke="currentColor" stroke-width="1.4"/>`,
  sipkaVpravoMala: `<path d="M8 4l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.4"/>`,
  skrytyMaly: `<rect x="2.5" y="4" width="15" height="11" rx="1" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M3 17 17 3" stroke="currentColor" stroke-width="1.2"/>`,
  duplikovat: `<rect x="2.5" y="6" width="10" height="8" rx="1" fill="#fff" stroke="currentColor" stroke-width="1.1"/><rect x="7.5" y="3" width="10" height="8" rx="1" fill="#fde6dc" stroke="${R}" stroke-width="1.1"/>`,
};

const VELKE = `novySnimek designer usporadat rychleStyly prezentaceZacatek prezentaceAktualni nastavitPrezentaci skrytSnimek vyzkouset nahrat nahled
  podoknoAnimaci pridatAnimaci formatPozadi velikostSnimku smartart zvuk cisloSnimku osnova razeni strankaPoznamek cteni prizpusobitOknu predloha
  fotoalbum efektyTvaru prechodIk pouzitVse moznostiEfektu zvukPrechodu prezentovatOnline vlastniPrezentace kamera zaznamObrazovky exportVidea
  predlohaPoznamek barevne stupneSedi cernobile opravy barvaObrazku umeleckeEfekty pruhlednostObr stylyObrazku alternativniText dopredu dozadu
  podoknoVyberu zarovnatObjekty otocitObjekt vyplnTextu obrysTextu efektyTextu upravitData sloupceTextu`.split(/\s+/);

pridejIkony(IK, VELKE);

/** Náhledová ikona přechodu (malý snímek s naznačeným efektem). */
export function ikonaPrechodu(id) {
  const zaklad = '<rect x="5" y="9" width="30" height="22" rx="2" fill="#fff" stroke="#8a8a8a" stroke-width="1.2"/>';
  const n = {
    zadny: '<path d="M8 12l24 16" stroke="#8a8a8a" stroke-width="1.2"/>',
    premena: `<circle cx="14" cy="20" r="4" fill="${R}"/><rect x="21" y="15" width="9" height="9" rx="2" fill="${O}" opacity=".8"/><path d="M18 20h3" stroke="#8a8a8a" stroke-dasharray="1 1.5"/>`,
    zeslabit: `<rect x="5" y="9" width="30" height="22" rx="2" fill="url(#pz)"/><defs><linearGradient id="pz"><stop offset="0" stop-color="${O}" stop-opacity=".1"/><stop offset="1" stop-color="${R}"/></linearGradient></defs>`,
    posunuti: `<rect x="5" y="9" width="15" height="22" fill="${O}" opacity=".85"/><path d="M24 20h8M29 17l3 3-3 3" fill="none" stroke="${R}" stroke-width="1.4"/>`,
    setrit: `<rect x="5" y="9" width="18" height="22" fill="${O}" opacity=".8"/><rect x="23" y="9" width="4" height="22" fill="${O}" opacity=".35"/>`,
    rozdelit: `<rect x="14" y="9" width="12" height="22" fill="${O}" opacity=".85"/><path d="M11 20H7M29 20h4" stroke="${R}" stroke-width="1.3"/>`,
    odhalit: `<rect x="17" y="9" width="18" height="22" fill="${O}" opacity=".7"/><rect x="5" y="9" width="12" height="22" fill="#fde6dc"/>`,
    vyjmout: `<path d="M13 13l14 14M27 13 13 27" stroke="${R}" stroke-width="1.5"/>`,
    nahodnePruhy: [11, 15, 19, 25, 28].map((y, i) => `<rect x="5" y="${y}" width="30" height="${i % 2 ? 2 : 3}" fill="${O}"/>`).join(''),
    tvar: `<circle cx="20" cy="20" r="8" fill="${O}"/>`,
    odkryt: `<rect x="5" y="9" width="30" height="22" fill="#fde6dc"/><rect x="5" y="9" width="12" height="22" fill="${O}" opacity=".85"/><path d="M14 20H8M11 17l-3 3 3 3" fill="none" stroke="#fff" stroke-width="1.3"/>`,
    pokryt: `<rect x="17" y="9" width="18" height="22" fill="${O}" opacity=".9"/><path d="M26 20h-6M23 17l-3 3 3 3" fill="none" stroke="#fff" stroke-width="1.3"/>`,
    blesk: `<path d="M22 11l-6 10h5l-3 9 8-12h-5l3-7z" fill="${Z}" stroke="#9a6b00" stroke-width=".8"/>`,
    opony: `<path d="M5 9h12c-2 8-2 14 0 22H5zM35 9H23c2 8 2 14 0 22h12z" fill="${R}" opacity=".85"/>`,
    vitr: `<path d="M8 15h16a3 3 0 1 0-3-3M8 20h20a3 3 0 1 1-3 3M8 25h10" fill="none" stroke="${M}" stroke-width="1.4" stroke-linecap="round"/>`,
    prestiz: `<path d="M10 28l5-12h10l5 12z" fill="${O}" opacity=".85"/><rect x="14" y="11" width="12" height="5" fill="${O}" opacity=".4"/>`,
    rozdrtit: `<path d="M14 14l5 3-2 5 6 1-3 5 7-2" fill="none" stroke="${R}" stroke-width="1.4"/><circle cx="26" cy="15" r="2" fill="${O}"/>`,
    odloupnout: `<path d="M5 9h30v22H5z" fill="${O}" opacity=".85"/><path d="M35 9v12c-5-2-10-6-12-12z" fill="#fff" stroke="#8a8a8a"/>`,
    zaluzie: [10, 16, 22, 28].map((x) => `<rect x="${x - 3}" y="9" width="3.5" height="22" fill="${O}"/>`).join(''),
    hodiny: `<path d="M20 20V9a11 11 0 0 1 11 11z" fill="${O}"/><path d="M20 20L28 12" stroke="${R}" stroke-width="1.3"/>`,
    vlneni: `<circle cx="20" cy="20" r="3" fill="${O}"/><circle cx="20" cy="20" r="7" fill="none" stroke="${O}" stroke-width="1.2"/><circle cx="20" cy="20" r="10.5" fill="none" stroke="${O}" stroke-width="1" opacity=".6"/>`,
    trpyt: `<path d="M14 14l1.5 3 3 1.5-3 1.5-1.5 3-1.5-3-3-1.5 3-1.5zM26 18l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM20 24l.8 1.6 1.6.8-1.6.8L20 29l-.8-1.8-1.6-.8 1.6-.8z" fill="${Z}"/>`,
    vir: `<path d="M20 20a3 3 0 1 1 3 3 6 6 0 1 1-6-6 9 9 0 1 1 9 9" fill="none" stroke="${R}" stroke-width="1.4"/>`,
    prepnout: `<rect x="8" y="12" width="14" height="16" fill="${O}" opacity=".5" transform="rotate(-10 15 20)"/><rect x="18" y="12" width="14" height="16" fill="${O}" transform="rotate(10 25 20)"/>`,
    preklopit: `<path d="M20 9v22" stroke="#8a8a8a" stroke-dasharray="2 1.5"/><path d="M20 11l12 3v12l-12 3z" fill="${O}"/>`,
    galerie: `<rect x="4" y="13" width="12" height="14" fill="${O}" opacity=".5" transform="skewY(8)"/><rect x="18" y="12" width="17" height="16" fill="${O}"/>`,
    krychle: `<path d="M8 13l10-3v20l-10-3zM18 10l14 3v14l-14 3z" fill="${O}" opacity=".85"/><path d="M18 10v20" stroke="#fff" stroke-width="1"/>`,
    krabice: `<path d="M8 12h24v16H8z" fill="${O}" opacity=".3"/><path d="M12 15h16v10H12z" fill="${O}"/>`,
    dvere: `<path d="M5 9l12 3v16l-12 3zM35 9l-12 3v16l12 3z" fill="${O}" opacity=".85"/>`,
    lupa: `<rect x="14" y="15" width="12" height="10" fill="${O}"/><path d="M10 12l3 3M30 12l-3 3M10 28l3-3M30 28l-3-3" stroke="${R}" stroke-width="1.3"/>`,
    nahodny: `<text x="20" y="25.5" text-anchor="middle" font-size="14" font-weight="700" font-family="Segoe UI" fill="${R}">?</text>`,
    posun: `<rect x="5" y="9" width="30" height="22" fill="#fde6dc"/><path d="M12 20h16M24 16l4 4-4 4" fill="none" stroke="${R}" stroke-width="1.4"/>`,
    dopravnik: `<rect x="5" y="15" width="12" height="10" fill="${O}" opacity=".5"/><rect x="21" y="15" width="12" height="10" fill="${O}"/><path d="M5 28h30" stroke="#8a8a8a" stroke-width="1.5"/>`,
    otocit: `<rect x="12" y="13" width="16" height="14" fill="${O}" transform="rotate(20 20 20)"/>`,
    okno: `<rect x="8" y="12" width="10" height="16" fill="${O}" transform="skewY(-8)"/><rect x="22" y="12" width="10" height="16" fill="${O}" transform="skewY(8)"/>`,
    obeznaDraha: `<ellipse cx="20" cy="20" rx="12" ry="5" fill="none" stroke="${R}" stroke-width="1.2"/><rect x="15" y="15" width="10" height="10" fill="${O}"/>`,
    prulet: `<rect x="10" y="13" width="20" height="14" fill="${O}" opacity=".35"/><rect x="15" y="16" width="10" height="8" fill="${O}"/>`,
  }[id] || `<rect x="10" y="14" width="20" height="12" fill="${O}"/>`;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 40 40');
  svg.setAttribute('class', 'psi pr-ik-prechod');
  svg.innerHTML = zaklad + n;
  return svg;
}

/** Ikona animace: hvězda v barvě druhu (zelená vstup, žlutá zdůraznění, červená ukončení) s naznačeným efektem. */
export function ikonaAnimace(druh, efekt) {
  const barva = { vstup: '#4EA72E', zduraz: '#E8A202', vystup: '#C43E1C', cesta: '#7A7A7A' }[druh] || '#8a8a8a';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 40 40');
  svg.setAttribute('class', 'psi pr-ik-animace');
  let doplnek = '';
  if (/priletet|odletet|ploutDovnitr|ploutVen|odrazit/.test(efekt)) doplnek = `<path d="M8 32l6-6" stroke="${barva}" stroke-width="1.6" stroke-linecap="round"/>`;
  if (/setrit|rozdelit|nahodnePruhy/.test(efekt)) doplnek = `<path d="M5 14h30M5 20h30M5 26h30" stroke="#fff" stroke-width="${efekt === 'nahodnePruhy' ? 1.6 : 0}"/>`;
  if (/kolo|otaceni|otocit|zvetsitOtocit|zmensitOtocit/.test(efekt)) doplnek = `<path d="M31 11a13 13 0 0 1 0 18" fill="none" stroke="${barva}" stroke-width="1.6"/>`;
  if (/pulz|zvetsitZmensit|lupa/.test(efekt)) doplnek = `<circle cx="20" cy="21" r="15" fill="none" stroke="${barva}" stroke-width="1" stroke-dasharray="2 2"/>`;
  if (druh === 'cesta') {
    svg.innerHTML = `<circle cx="9" cy="28" r="3" fill="#4EA72E"/><path d="M9 28C12 10 24 34 31 12" fill="none" stroke="#7a7a7a" stroke-width="1.4" stroke-dasharray="2.5 2"/><circle cx="31" cy="12" r="3" fill="#C43E1C"/>`;
    return svg;
  }
  if (efekt === 'zadne') { svg.innerHTML = '<path d="M20 5l4.4 9 9.9 1.4-7.2 7 1.7 9.8L20 27.6l-8.8 4.6 1.7-9.8-7.2-7 9.9-1.4z" fill="none" stroke="#8a8a8a" stroke-width="1.3" stroke-linejoin="round"/><path d="M8 32 32 8" stroke="#8a8a8a" stroke-width="1.3"/>'; return svg; }
  svg.innerHTML = `${hvezda(20, 21, 14, barva)}${doplnek}`;
  return svg;
}
