// AstroPísmo — ikony ve stylu Office (Fluent): šedý obrys = currentColor, barevné akcenty napevno

const M = '#0f6cbd';   // modrá Office
const C = '#c42b1c';   // červená
const Z = '#f7b500';   // žlutá
const S = '#13a10e';   // zelená

const I = {
  // --- schránka
  vlozit: `<rect x="7" y="5" width="18" height="23" rx="2" fill="#f4e4c4" stroke="#8a6d3b" stroke-width="1.2"/><rect x="11" y="3" width="10" height="5" rx="1.5" fill="#fff" stroke="currentColor" stroke-width="1.2"/><rect x="14" y="12" width="13" height="16" rx="1" fill="#fff" stroke="currentColor" stroke-width="1.2"/><path d="M17 17h7M17 20.5h7M17 24h5" stroke="currentColor" stroke-width="1.1"/>`,
  vyjmout: `<circle cx="6" cy="15" r="2.6" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="14" cy="15" r="2.6" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M7.6 13 13.5 3M12.4 13 6.5 3" stroke="currentColor" stroke-width="1.2"/>`,
  kopirovat: `<rect x="7" y="6" width="9" height="11" rx="1.2" fill="#fff" stroke="currentColor" stroke-width="1.1"/><path d="M13 6V4.2A1.2 1.2 0 0 0 11.8 3H5.2A1.2 1.2 0 0 0 4 4.2v9.6A1.2 1.2 0 0 0 5.2 15H7" fill="none" stroke="currentColor" stroke-width="1.1"/>`,
  stetec: `<path d="M4 3h9v4H4z" fill="${Z}" stroke="#9a6b00" stroke-width="1"/><path d="M13 5h2v4H9v3" fill="none" stroke="currentColor" stroke-width="1.1"/><rect x="7.7" y="12" width="2.6" height="6" rx="1" fill="#8a6d3b"/>`,

  // --- písmo
  zvetsit: `<text x="1" y="16" font-size="14" font-family="Segoe UI" fill="currentColor">A</text><path d="M13 7l2.5-3L18 7" fill="none" stroke="currentColor" stroke-width="1.2"/>`,
  zmensit: `<text x="2" y="16" font-size="11" font-family="Segoe UI" fill="currentColor">A</text><path d="M12 4l2.5 3L17 4" fill="none" stroke="currentColor" stroke-width="1.2"/>`,
  velikostPismen: `<text x="0" y="15" font-size="12.5" font-family="Segoe UI" fill="currentColor">Aa</text>`,
  vymazatFormat: `<text x="1" y="14" font-size="13" font-family="Segoe UI" fill="currentColor">A</text><path d="M10 17.5l5-7 3 2.2-5 7h-3z" fill="#e8a2c8" stroke="#b1447a" stroke-width="1"/>`,
  tucne: `<text x="4.5" y="15.5" font-size="14" font-weight="700" font-family="Segoe UI" fill="currentColor">B</text>`,
  kurziva: `<text x="6" y="15.5" font-size="14" font-style="italic" font-family="Georgia" fill="currentColor">I</text>`,
  podtrzeni: `<text x="4.5" y="14" font-size="13" font-family="Segoe UI" fill="currentColor">U</text><path d="M4 17.5h11" stroke="currentColor" stroke-width="1.2"/>`,
  preskrtnuti: `<text x="1.5" y="14.5" font-size="11.5" font-family="Segoe UI" fill="currentColor">ab</text><path d="M1 11h15" stroke="currentColor" stroke-width="1.1"/>`,
  dolniIndex: `<text x="2" y="13" font-size="12" font-family="Segoe UI" fill="currentColor">x</text><text x="10" y="17.5" font-size="7.5" font-family="Segoe UI" fill="${M}">2</text>`,
  horniIndex: `<text x="2" y="16" font-size="12" font-family="Segoe UI" fill="currentColor">x</text><text x="10" y="8" font-size="7.5" font-family="Segoe UI" fill="${M}">2</text>`,
  efekty: `<text x="3" y="16" font-size="15" font-weight="700" font-family="Segoe UI" fill="#fff" stroke="${M}" stroke-width="1.1">A</text>`,
  zvyraznovac: `<path d="M5 12.5 12.5 5l3 3L8 15.5H5z" fill="#fff" stroke="currentColor" stroke-width="1.1"/><path d="M11 6.5l3 3" stroke="currentColor" stroke-width="1.1"/>`,
  barvaPisma: `<text x="3.5" y="14.5" font-size="14" font-family="Segoe UI" fill="currentColor">A</text>`,

  // --- odstavec
  odrazky: `<circle cx="4" cy="5" r="1.4" fill="currentColor"/><circle cx="4" cy="10" r="1.4" fill="currentColor"/><circle cx="4" cy="15" r="1.4" fill="currentColor"/><path d="M8 5h9M8 10h9M8 15h9" stroke="currentColor" stroke-width="1.2"/>`,
  cislovani: `<text x="1.5" y="7" font-size="5.5" font-family="Segoe UI" fill="${M}">1</text><text x="1.5" y="12" font-size="5.5" font-family="Segoe UI" fill="${M}">2</text><text x="1.5" y="17" font-size="5.5" font-family="Segoe UI" fill="${M}">3</text><path d="M8 5h9M8 10h9M8 15h9" stroke="currentColor" stroke-width="1.2"/>`,
  viceurovnovy: `<text x="1" y="7" font-size="5.5" font-family="Segoe UI" fill="${M}">1</text><text x="5" y="12" font-size="5.5" font-family="Segoe UI" fill="${M}">a</text><text x="9" y="17" font-size="5.5" font-family="Segoe UI" fill="${M}">i</text><path d="M6 5h11M10 10h7M14 15h3" stroke="currentColor" stroke-width="1.2"/>`,
  zmensitOdsazeni: `<path d="M3 4h14M9 8h8M9 12h8M3 16h14" stroke="currentColor" stroke-width="1.2"/><path d="M6 8 3 10l3 2" fill="none" stroke="${M}" stroke-width="1.2"/>`,
  zvetsitOdsazeni: `<path d="M3 4h14M9 8h8M9 12h8M3 16h14" stroke="currentColor" stroke-width="1.2"/><path d="M3 8l3 2-3 2" fill="none" stroke="${M}" stroke-width="1.2"/>`,
  seradit: `<text x="1" y="8.5" font-size="7" font-weight="600" font-family="Segoe UI" fill="currentColor">A</text><text x="1" y="17.5" font-size="7" font-weight="600" font-family="Segoe UI" fill="currentColor">Z</text><path d="M13.5 3v14M10.5 14l3 3 3-3" fill="none" stroke="${M}" stroke-width="1.2"/>`,
  znacky: `<path d="M11 17V3M14.5 17V3M15.5 3H9a3.2 3.2 0 0 0 0 6.4h2" fill="none" stroke="currentColor" stroke-width="1.2"/>`,
  zarovnatVlevo: `<path d="M3 4h14M3 8h9M3 12h14M3 16h9" stroke="currentColor" stroke-width="1.2"/>`,
  zarovnatNaStred: `<path d="M3 4h14M5.5 8h9M3 12h14M5.5 16h9" stroke="currentColor" stroke-width="1.2"/>`,
  zarovnatVpravo: `<path d="M3 4h14M8 8h9M3 12h14M8 16h9" stroke="currentColor" stroke-width="1.2"/>`,
  zarovnatDoBloku: `<path d="M3 4h14M3 8h14M3 12h14M3 16h14" stroke="currentColor" stroke-width="1.2"/>`,
  radkovani: `<path d="M9 5h9M9 10h9M9 15h9" stroke="currentColor" stroke-width="1.2"/><path d="M4.5 3v14M2.5 5l2-2 2 2M2.5 15l2 2 2-2" fill="none" stroke="${M}" stroke-width="1.1"/>`,
  stinovani: `<path d="M4 10.5 9.5 5l5.5 5.5-5.5 5.5z" fill="#fff" stroke="currentColor" stroke-width="1.1"/><path d="M15.5 12.5s1.5 1.8 1.5 2.8a1.5 1.5 0 0 1-3 0c0-1 1.5-2.8 1.5-2.8z" fill="currentColor"/>`,
  ohraniceni: `<rect x="3" y="3" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="1.5 1.5"/><path d="M3 17h14" stroke="currentColor" stroke-width="1.8"/>`,

  // --- úpravy, hlas, editor
  najit: `<circle cx="13" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m18.5 17.5 8 8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`,
  najitMaly: `<circle cx="8" cy="8" r="4.8" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="m11.5 11.5 5 5" stroke="currentColor" stroke-width="1.4"/>`,
  nahradit: `<text x="1" y="8.5" font-size="7.5" font-family="Segoe UI" fill="currentColor">ab</text><text x="9" y="17.5" font-size="7.5" font-family="Segoe UI" fill="${M}">ac</text><path d="M13 3.5h3v4.5M14.5 6.5 16 8l1.5-1.5" fill="none" stroke="currentColor" stroke-width="1"/>`,
  vybrat: `<path d="M5 3v13l3.5-3.5 2.5 5.5 2-1-2.5-5.2H15z" fill="#fff" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/>`,
  diktovat: `<rect x="11.5" y="3" width="9" height="16" rx="4.5" fill="#fff" stroke="currentColor" stroke-width="1.6"/><path d="M7.5 14a8.5 8.5 0 0 0 17 0M16 22.5V28M11.5 28h9" fill="none" stroke="currentColor" stroke-width="1.6"/>`,
  editor: `<path d="M7 27 9 19 22 6l4 4L13 23z" fill="#dbe9f9" stroke="${M}" stroke-width="1.6" stroke-linejoin="round"/><path d="m19 9 4 4" stroke="${M}" stroke-width="1.6"/><path d="M5 29.5h22" stroke="${M}" stroke-width="1.6"/>`,
  doplnky: `<rect x="4" y="4" width="10" height="10" rx="2" fill="none" stroke="${C}" stroke-width="1.6"/><rect x="18" y="4" width="10" height="10" rx="2" fill="none" stroke="${C}" stroke-width="1.6"/><rect x="4" y="18" width="10" height="10" rx="2" fill="none" stroke="${C}" stroke-width="1.6"/><rect x="18" y="18" width="10" height="10" rx="2" fill="${C}" opacity=".85"/>`,
  astroai: `<defs><linearGradient id="psai" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2fd6a0"/><stop offset=".5" stop-color="#3a8df0"/><stop offset="1" stop-color="#b44be1"/></linearGradient></defs><path d="M16 3.5 18.8 12 27.5 15 18.8 18 16 26.5 13.2 18 4.5 15 13.2 12z" fill="url(#psai)"/><path d="M25 22.5l1 2.8 2.8 1-2.8 1-1 2.8-1-2.8-2.8-1 2.8-1z" fill="url(#psai)"/>`,

  // --- titulek
  ulozit: `<path d="M4 3h9.5L17 6.5V17H4z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M7 3v4h6V3M7 17v-5h7v5" fill="none" stroke="currentColor" stroke-width="1.2"/>`,
  zpet: `<path d="M8 4 4 8l4 4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M4.5 8H12a4.5 4.5 0 0 1 0 9H8" fill="none" stroke="currentColor" stroke-width="1.3"/>`,
  znovu: `<path d="M12 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M15.5 8H8a4.5 4.5 0 0 0 0 9h4" fill="none" stroke="currentColor" stroke-width="1.3"/>`,
  sipkaDolu: `<path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.3"/>`,
  sipkaVlevo: `<path d="M12 4 6 10l6 6" fill="none" stroke="currentColor" stroke-width="1.5"/>`,
  kruhZpet: `<circle cx="10" cy="10" r="8.5" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M14.5 10h-9M9 6.5 5.5 10 9 13.5" fill="none" stroke="currentColor" stroke-width="1.2"/>`,
  komentar: `<path d="M3 4.5A1.5 1.5 0 0 1 4.5 3h11A1.5 1.5 0 0 1 17 4.5v8a1.5 1.5 0 0 1-1.5 1.5H9l-4 3.5V14h-.5A1.5 1.5 0 0 1 3 12.5z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>`,
  komentarNovy: `<path d="M4 7a2 2 0 0 1 2-2h20a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H14l-7 5v-5H6a2 2 0 0 1-2-2z" fill="#fff8d6" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M16 9.5v9M11.5 14h9" stroke="${S}" stroke-width="1.8"/>`,
  tuzka: `<path d="M4 16l1-4L13.5 3.5l3 3L8 15z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="m11.5 5.5 3 3" stroke="currentColor" stroke-width="1.2"/>`,
  oko: `<path d="M1.5 10S5 4.5 10 4.5 18.5 10 18.5 10 15 15.5 10 15.5 1.5 10 1.5 10z" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="10" cy="10" r="2.6" fill="none" stroke="currentColor" stroke-width="1.2"/>`,
  sdilet: `<path d="M10 3v10M6.5 6.5 10 3l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M6 9H4.5v8h11V9H14" fill="none" stroke="currentColor" stroke-width="1.3"/>`,
  zavrit: `<path d="M5 5l10 10M15 5 5 15" stroke="currentColor" stroke-width="1.3"/>`,

  // --- stavový řádek
  kontrola: `<path d="M3 3h11l3 3v11H3z" fill="#fff" stroke="currentColor" stroke-width="1.1"/><path d="m6 10.5 2.5 2.5 5-5.5" fill="none" stroke="currentColor" stroke-width="1.3"/>`,
  kontrolaChyba: `<path d="M3 3h11l3 3v11H3z" fill="#fff" stroke="currentColor" stroke-width="1.1"/><path d="M7 7l6 6M13 7l-6 6" stroke="${C}" stroke-width="1.3"/>`,
  pristupnost: `<circle cx="10" cy="4" r="1.6" fill="currentColor"/><path d="M4 7.5h12M10 7.5v4.5l-3 5.5M10 12l3 5.5" fill="none" stroke="currentColor" stroke-width="1.3"/>`,
  zamereni: `<path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="7" y="7" width="6" height="6" fill="none" stroke="currentColor" stroke-width="1.1"/>`,
  rezimCteni: `<path d="M2.5 4.5h6a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 0-1.5-1.5h-6zM17.5 4.5h-6A1.5 1.5 0 0 0 10 6v10a1.5 1.5 0 0 1 1.5-1.5h6z" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/>`,
  rozlozeniTisk: `<rect x="4.5" y="2.5" width="11" height="15" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M7 6h6M7 9h6M7 12h6" stroke="currentColor" stroke-width="1"/>`,
  rozlozeniWeb: `<rect x="2.5" y="3.5" width="15" height="13" rx="1" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M2.5 6.5h15" stroke="currentColor" stroke-width="1.1"/><circle cx="12.5" cy="12" r="2.6" fill="none" stroke="currentColor" stroke-width="1"/><path d="M9.9 12h5.2" stroke="currentColor" stroke-width=".9"/>`,

  // --- vložení
  titulniStrana: `<rect x="7" y="3" width="18" height="26" fill="#fff" stroke="currentColor" stroke-width="1.4"/><rect x="7" y="3" width="18" height="9" fill="${M}"/><path d="M10 17h12M10 20.5h9" stroke="currentColor" stroke-width="1.2"/>`,
  prazdnaStrana: `<path d="M8 3h12l5 5v21H8z" fill="#fff" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M20 3v5h5" fill="none" stroke="currentColor" stroke-width="1.4"/>`,
  koneStranky: `<path d="M8 3h16v9M8 3v9M8 20v9h16v-9" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M4 16h24" stroke="${M}" stroke-width="1.4" stroke-dasharray="3 2"/>`,
  tabulka: `<rect x="4" y="5" width="24" height="22" rx="1" fill="#fff" stroke="currentColor" stroke-width="1.4"/><path d="M4 11h24" stroke="${M}" stroke-width="5" opacity=".85"/><path d="M4 16.5h24M4 22h24M12 8.5V27M20 8.5V27" stroke="currentColor" stroke-width="1.1"/>`,
  obrazky: `<rect x="3" y="6" width="26" height="20" rx="2" fill="#fff" stroke="currentColor" stroke-width="1.4"/><circle cx="10" cy="12" r="2.6" fill="${Z}"/><path d="m4 24 8-8 5 5 4-4 7 7" fill="#8fd18a" stroke="${S}" stroke-width="1.3" stroke-linejoin="round"/>`,
  tvary: `<circle cx="11" cy="12" r="7" fill="#dbe9f9" stroke="${M}" stroke-width="1.4"/><rect x="14" y="15" width="13" height="12" fill="#fde7c4" stroke="#c77b00" stroke-width="1.4"/>`,
  ikonyVlozit: `<circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="12" cy="13" r="1.4" fill="currentColor"/><circle cx="20" cy="13" r="1.4" fill="currentColor"/><path d="M11 19a6 6 0 0 0 10 0" fill="none" stroke="${M}" stroke-width="1.5"/>`,
  odkaz: `<path d="M13.5 18.5a5 5 0 0 0 7 0l4-4a5 5 0 0 0-7-7l-1.5 1.5" fill="none" stroke="${M}" stroke-width="1.8" stroke-linecap="round"/><path d="M18.5 13.5a5 5 0 0 0-7 0l-4 4a5 5 0 0 0 7 7l1.5-1.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
  zahlavi: `<rect x="6" y="3" width="20" height="26" fill="#fff" stroke="currentColor" stroke-width="1.4"/><rect x="6" y="3" width="20" height="6" fill="${M}" opacity=".85"/><path d="M10 14h12M10 18h12M10 22h8" stroke="currentColor" stroke-width="1.1"/>`,
  zapati: `<rect x="6" y="3" width="20" height="26" fill="#fff" stroke="currentColor" stroke-width="1.4"/><rect x="6" y="23" width="20" height="6" fill="${M}" opacity=".85"/><path d="M10 8h12M10 12h12M10 16h8" stroke="currentColor" stroke-width="1.1"/>`,
  cisloStranky: `<rect x="6" y="3" width="20" height="26" fill="#fff" stroke="currentColor" stroke-width="1.4"/><text x="16" y="26" text-anchor="middle" font-size="7" font-family="Segoe UI" font-weight="700" fill="${M}">#</text><path d="M10 8h12M10 12h12M10 16h8" stroke="currentColor" stroke-width="1.1"/>`,
  textovePole: `<rect x="4" y="6" width="24" height="20" fill="#fff" stroke="currentColor" stroke-width="1.4"/><text x="9" y="21" font-size="12" font-family="Segoe UI" fill="${M}">A</text><path d="M18 12h6M18 16h6M18 20h4" stroke="currentColor" stroke-width="1.1"/>`,
  symbol: `<text x="16" y="25" text-anchor="middle" font-size="22" font-family="Segoe UI" fill="currentColor">Ω</text>`,
  rovnice: `<text x="16" y="25" text-anchor="middle" font-size="22" font-family="Cambria, Georgia" fill="currentColor">π</text>`,
  datumCas: `<rect x="4" y="6" width="24" height="21" rx="2" fill="#fff" stroke="currentColor" stroke-width="1.4"/><path d="M4 11.5h24" stroke="${C}" stroke-width="3"/><path d="M10 4v4M22 4v4" stroke="currentColor" stroke-width="1.4"/><circle cx="21" cy="20" r="4.5" fill="#fff" stroke="${M}" stroke-width="1.3"/><path d="M21 17.5V20h2" fill="none" stroke="${M}" stroke-width="1.2"/>`,
  cara: `<path d="M4 16h24" stroke="currentColor" stroke-width="2"/><path d="M6 10h20M6 22h20" stroke="currentColor" stroke-width="1" opacity=".35"/>`,
  wordart: `<text x="16" y="24" text-anchor="middle" font-size="20" font-style="italic" font-weight="700" font-family="Georgia" fill="${M}" stroke="#0a3a73" stroke-width=".6">A</text>`,

  // --- rozložení, návrh
  okraje: `<rect x="6" y="3" width="20" height="26" fill="#fff" stroke="currentColor" stroke-width="1.4"/><rect x="10" y="7" width="12" height="18" fill="#dbe9f9" stroke="${M}" stroke-width="1" stroke-dasharray="2 1.5"/>`,
  orientace: `<rect x="4" y="3" width="15" height="21" fill="#fff" stroke="currentColor" stroke-width="1.4"/><rect x="10" y="15" width="19" height="13" fill="#dbe9f9" stroke="${M}" stroke-width="1.4"/>`,
  velikost: `<rect x="5" y="3" width="17" height="24" fill="#fff" stroke="currentColor" stroke-width="1.4"/><rect x="11" y="10" width="17" height="19" fill="none" stroke="${M}" stroke-width="1.3" stroke-dasharray="2.5 1.5"/>`,
  sloupce: `<rect x="5" y="3" width="22" height="26" fill="#fff" stroke="currentColor" stroke-width="1.4"/><path d="M8 8h6M8 11h6M8 14h6M8 17h6M8 20h6M18 8h6M18 11h6M18 14h6M18 17h6" stroke="${M}" stroke-width="1.3"/>`,
  konce: `<rect x="6" y="3" width="20" height="26" fill="#fff" stroke="currentColor" stroke-width="1.4"/><path d="M3 16h26" stroke="${M}" stroke-width="1.4" stroke-dasharray="2.5 1.5"/><path d="M10 8h12M10 11h12M10 21h12M10 24h8" stroke="currentColor" stroke-width="1.1"/>`,
  motivy: `<rect x="4" y="4" width="24" height="24" rx="2" fill="#fff" stroke="currentColor" stroke-width="1.4"/><text x="8" y="21" font-size="13" font-family="Georgia" fill="currentColor">Aa</text><path d="M4 25h6" stroke="${M}" stroke-width="3"/><path d="M10 25h6" stroke="#e97132" stroke-width="3"/><path d="M16 25h6" stroke="#196b24" stroke-width="3"/><path d="M22 25h6" stroke="#a02b93" stroke-width="3"/>`,
  barvaStranky: `<rect x="6" y="3" width="20" height="26" fill="#fff" stroke="currentColor" stroke-width="1.4"/><path d="M11 18.5 16 13.5l5 5-5 5z" fill="#fff" stroke="currentColor" stroke-width="1.2"/><rect x="6" y="26" width="20" height="3" fill="${Z}"/>`,
  ohraniceniStranky: `<rect x="6" y="3" width="20" height="26" fill="#fff" stroke="currentColor" stroke-width="1.4"/><rect x="9" y="6" width="14" height="20" fill="none" stroke="${M}" stroke-width="1.6"/>`,
  vodoznak: `<rect x="6" y="3" width="20" height="26" fill="#fff" stroke="currentColor" stroke-width="1.4"/><text x="16" y="20" text-anchor="middle" font-size="9" font-family="Segoe UI" fill="#9aa4ad" transform="rotate(-40 16 16)">A</text><path d="M10 25 23 7" stroke="#b7c0c8" stroke-width="1.6"/>`,

  // --- reference, korespondence, revize, zobrazení
  obsah: `<rect x="5" y="3" width="22" height="26" fill="#fff" stroke="currentColor" stroke-width="1.4"/><path d="M9 9h8M9 14h11M9 19h9M9 24h11" stroke="currentColor" stroke-width="1.2"/><path d="M20 9h3M22 14h1M21 19h2M22 24h1" stroke="${M}" stroke-width="1.2" stroke-dasharray="1 1.3"/>`,
  aktualizovat: `<path d="M16 4a6 6 0 1 1-5.6 3.8" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M9 4.5l1.6 3.5 3.5-1.4" fill="none" stroke="${S}" stroke-width="1.2"/>`,
  poznamkaPodCarou: `<rect x="6" y="3" width="20" height="26" fill="#fff" stroke="currentColor" stroke-width="1.4"/><text x="17" y="12" font-size="7" font-family="Segoe UI" fill="${M}">1</text><path d="M9 11h7M9 15h14M9 22h5" stroke="currentColor" stroke-width="1.1"/><text x="9" y="27" font-size="5.5" font-family="Segoe UI" fill="${M}">1</text><path d="M12 25.5h10" stroke="currentColor" stroke-width="1"/>`,
  obalka: `<rect x="3" y="7" width="26" height="18" rx="1.5" fill="#fff" stroke="currentColor" stroke-width="1.4"/><path d="m4 8 12 9 12-9" fill="none" stroke="currentColor" stroke-width="1.4"/>`,
  stitky: `<rect x="5" y="3" width="22" height="26" fill="#fff" stroke="currentColor" stroke-width="1.4"/><rect x="8" y="6" width="7" height="5" rx="1" fill="#dbe9f9" stroke="${M}"/><rect x="17" y="6" width="7" height="5" rx="1" fill="#dbe9f9" stroke="${M}"/><rect x="8" y="13" width="7" height="5" rx="1" fill="#dbe9f9" stroke="${M}"/><rect x="17" y="13" width="7" height="5" rx="1" fill="#dbe9f9" stroke="${M}"/>`,
  hromadna: `<rect x="3" y="9" width="18" height="13" rx="1" fill="#fff" stroke="currentColor" stroke-width="1.4"/><path d="m4 10 8 6 8-6" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="11" y="14" width="18" height="13" rx="1" fill="#fff" stroke="currentColor" stroke-width="1.4"/><path d="m12 15 8 6 8-6" fill="none" stroke="${M}" stroke-width="1.2"/>`,
  prijemci: `<circle cx="12" cy="11" r="4.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M4 26a8 8 0 0 1 16 0" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="22" cy="12" r="3.5" fill="none" stroke="${M}" stroke-width="1.3"/><path d="M20 19.5a6.5 6.5 0 0 1 8.5 6" fill="none" stroke="${M}" stroke-width="1.3"/>`,
  pravopis: `<text x="3" y="15" font-size="10.5" font-weight="700" font-family="Segoe UI" fill="currentColor">ABC</text><path d="m15 22 4 4 9-11" fill="none" stroke="${S}" stroke-width="2"/>`,
  pocetSlov: `<text x="4" y="14" font-size="9.5" font-weight="600" font-family="Segoe UI" fill="currentColor">ABC</text><text x="4" y="27" font-size="9.5" font-weight="600" font-family="Segoe UI" fill="${M}">123</text>`,
  predcitat: `<text x="3" y="23" font-size="17" font-family="Segoe UI" fill="currentColor">A</text><path d="M18 11c2 1.3 2 8.7 0 10M22 8c3.5 2.5 3.5 13.5 0 16M26 5c5 3.5 5 18.5 0 22" fill="none" stroke="${M}" stroke-width="1.4" stroke-linecap="round"/>`,
  prelozit: `<rect x="3" y="4" width="15" height="15" rx="2" fill="#fff" stroke="currentColor" stroke-width="1.4"/><text x="10.5" y="15.5" text-anchor="middle" font-size="10" font-family="Segoe UI" fill="currentColor">A</text><rect x="14" y="13" width="15" height="15" rx="2" fill="${M}"/><text x="21.5" y="24.5" text-anchor="middle" font-size="10" font-family="Segoe UI" fill="#fff">文</text>`,
  jazyk: `<circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5 16h22M16 5c4 3 4 19 0 22M16 5c-4 3-4 19 0 22" fill="none" stroke="currentColor" stroke-width="1.2"/>`,
  smazatKomentar: `<path d="M4 7a2 2 0 0 1 2-2h20a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H14l-7 5v-5H6a2 2 0 0 1-2-2z" fill="#fff8d6" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="m12 10 8 8M20 10l-8 8" stroke="${C}" stroke-width="1.8"/>`,
  sledovat: `<rect x="5" y="3" width="22" height="26" fill="#fff" stroke="currentColor" stroke-width="1.4"/><path d="M9 9h14M9 14h6" stroke="currentColor" stroke-width="1.2"/><path d="M16 14h7" stroke="${C}" stroke-width="1.2"/><path d="M9 19h14" stroke="${C}" stroke-width="1.2"/><path d="M5 17v6" stroke="${C}" stroke-width="2"/>`,
  lupa: `<circle cx="14" cy="14" r="9" fill="#fff" stroke="currentColor" stroke-width="1.6"/><path d="m21 21 7 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M10 14h8M14 10v8" stroke="${M}" stroke-width="1.6"/>`,
  sto: `<rect x="4" y="4" width="24" height="24" rx="2" fill="#fff" stroke="currentColor" stroke-width="1.4"/><text x="16" y="20.5" text-anchor="middle" font-size="9" font-weight="600" font-family="Segoe UI" fill="${M}">100</text>`,
  jednaStrana: `<rect x="9" y="3" width="14" height="20" fill="#fff" stroke="currentColor" stroke-width="1.4"/><path d="M12 7h8M12 10h8M12 13h8" stroke="currentColor" stroke-width="1"/><path d="M5 27h22" stroke="${M}" stroke-width="1.4"/>`,
  viceStran: `<rect x="3" y="5" width="12" height="17" fill="#fff" stroke="currentColor" stroke-width="1.4"/><rect x="17" y="5" width="12" height="17" fill="#fff" stroke="currentColor" stroke-width="1.4"/><path d="M5 27h22" stroke="${M}" stroke-width="1.4"/>`,
  sirkaStranky: `<rect x="6" y="3" width="20" height="21" fill="#fff" stroke="currentColor" stroke-width="1.4"/><path d="M3 28h26M3 28l3-2.5M3 28l3 2.5M29 28l-3-2.5M29 28l-3 2.5" fill="none" stroke="${M}" stroke-width="1.3"/>`,
  pravitko: `<rect x="2" y="6" width="16" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M5 6v3M8 6v2M11 6v3M14 6v2" stroke="currentColor" stroke-width="1"/>`,
  navigace: `<rect x="2.5" y="3.5" width="15" height="13" rx="1" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M7.5 3.5v13" stroke="currentColor" stroke-width="1.1"/><path d="M4 7h2M4 9.5h2M4 12h2" stroke="${M}" stroke-width="1"/>`,
  mrizka: `<rect x="3" y="3" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M7.7 3v14M12.3 3v14M3 7.7h14M3 12.3h14" stroke="currentColor" stroke-width=".7"/>`,
  noveOkno: `<rect x="3" y="7" width="20" height="18" rx="1.5" fill="#fff" stroke="currentColor" stroke-width="1.4"/><rect x="9" y="3" width="20" height="18" rx="1.5" fill="#fff" stroke="currentColor" stroke-width="1.4"/><path d="M9 7h20" stroke="${M}" stroke-width="2.5"/>`,
  cteckaTextu: `<path d="M4 6h10a2 2 0 0 1 2 2v19a2 2 0 0 0-2-2H4zM28 6H18a2 2 0 0 0-2 2v19a2 2 0 0 1 2-2h10z" fill="#fff" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M7 11h6M7 15h6M19 11h6M19 15h6" stroke="${M}" stroke-width="1.2"/>`,
  prepnoutRezimy: `<circle cx="16" cy="16" r="10" fill="#fff" stroke="currentColor" stroke-width="1.4"/><path d="M16 6a10 10 0 0 1 0 20z" fill="currentColor"/>`,

  // --- kreslení
  pero: `<path d="M9 27 7 21 19 6l4 3-12 15z" fill="#fff" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M7 21l2 6" stroke="currentColor" stroke-width="1.4"/><path d="M20 7l3 2.5" stroke="#222" stroke-width="3"/>`,
  zvyraznovacKresleni: `<path d="M9 27 7 21 19 6l4 3-12 15z" fill="${Z}" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>`,
  guma: `<path d="M5 21 16 9l9 8-9 10H11z" fill="#f5b7c8" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M11 15.5l8.5 7.5" stroke="currentColor" stroke-width="1.2"/>`,
  kresleni: `<path d="M4 24c4-8 7 4 11-4s6 2 10-6" fill="none" stroke="${M}" stroke-width="2" stroke-linecap="round"/>`,

  // --- nápověda
  napoveda: `<circle cx="16" cy="16" r="11" fill="#fff" stroke="currentColor" stroke-width="1.4"/><path d="M12.5 12.5a3.5 3.5 0 1 1 5 3.2c-1 .5-1.5 1.2-1.5 2.3v1" fill="none" stroke="${M}" stroke-width="1.7" stroke-linecap="round"/><circle cx="16" cy="22.5" r="1.2" fill="${M}"/>`,
  podpora: `<path d="M6 17v-3a10 10 0 0 1 20 0v3" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="4" y="16" width="5" height="8" rx="1.5" fill="${M}"/><rect x="23" y="16" width="5" height="8" rx="1.5" fill="${M}"/><path d="M26 24c0 3-3 4-7 4" fill="none" stroke="currentColor" stroke-width="1.3"/>`,
  nazory: `<circle cx="16" cy="16" r="11" fill="#fff" stroke="currentColor" stroke-width="1.4"/><circle cx="12" cy="13.5" r="1.3" fill="currentColor"/><circle cx="20" cy="13.5" r="1.3" fill="currentColor"/><path d="M11 19.5a6 6 0 0 0 10 0" fill="none" stroke="currentColor" stroke-width="1.4"/>`,
  skoleni: `<rect x="3" y="6" width="26" height="18" rx="2" fill="#fff" stroke="currentColor" stroke-width="1.4"/><path d="m13.5 11 7 4-7 4z" fill="${M}"/><path d="M11 28h10" stroke="currentColor" stroke-width="1.4"/>`,
  coNoveho: `<path d="M16 4l3 7.5 8 .5-6 5.2 2 7.8-7-4.3-7 4.3 2-7.8-6-5.2 8-.5z" fill="${Z}" stroke="#b88600" stroke-width="1.1" stroke-linejoin="round"/>`,

  // --- zákulisí
  domu: `<path d="M3 9.5 10 3.5l7 6V17h-4.5v-4.5h-5V17H3z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>`,
  novy: `<path d="M5 2.5h7l3.5 3.5v11.5H5z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M12 2.5V6h3.5" fill="none" stroke="currentColor" stroke-width="1.2"/>`,
  otevrit: `<path d="M2.5 5A1.5 1.5 0 0 1 4 3.5h3.5l1.8 2H15A1.5 1.5 0 0 1 16.5 7v1" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M2.5 16 4.6 9.2A1 1 0 0 1 5.6 8.5h12a.7.7 0 0 1 .7.9L16.3 16z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>`,
  informace: `<circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M10 9v5" stroke="currentColor" stroke-width="1.3"/><circle cx="10" cy="6.3" r=".9" fill="currentColor"/>`,
  ulozitJako: `<path d="M4 3h9.5L17 6.5V17H4z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M7 3v4h6V3" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="m9 15 1-2.6 4.5-4.5 1.6 1.6-4.5 4.5z" fill="none" stroke="currentColor" stroke-width="1.1"/>`,
  tisk: `<path d="M6 7V3h8v4" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="3" y="7" width="14" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M6 12h8v5H6z" fill="none" stroke="currentColor" stroke-width="1.2"/>`,
  export: `<path d="M4 3h7l4 4v10H4z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M9 14V9M7 11l2-2 2 2" fill="none" stroke="currentColor" stroke-width="1.2"/>`,
  zavritDok: `<path d="M4 3h7l4 4v10H4z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="m7.5 10.5 4 4M11.5 10.5l-4 4" stroke="currentColor" stroke-width="1.2"/>`,
  ucet: `<circle cx="10" cy="7" r="3.5" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M3.5 17a6.5 6.5 0 0 1 13 0" fill="none" stroke="currentColor" stroke-width="1.2"/>`,
  moznosti: `<circle cx="10" cy="10" r="2.5" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" stroke="currentColor" stroke-width="1.2"/>`,
  slozka: `<path d="M2.5 5A1.5 1.5 0 0 1 4 3.5h3.5l1.8 2H16A1.5 1.5 0 0 1 17.5 7v8.5A1.5 1.5 0 0 1 16 17H4a1.5 1.5 0 0 1-1.5-1.5z" fill="#f5bf45" stroke="#c7922a" stroke-width="1"/>`,
  pocitac: `<rect x="2.5" y="3.5" width="15" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M7 17h6M10 13.5V17" stroke="currentColor" stroke-width="1.2"/>`,
  hodiny: `<circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M10 5.5V10l3 2" fill="none" stroke="currentColor" stroke-width="1.2"/>`,
  pripnout: `<path d="M12 2.5 17.5 8l-2 .5-3.5 3.5-.5 3.5-7-7 3.5-.5L11.5 4.5z" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/><path d="M7.5 12.5 3 17" stroke="currentColor" stroke-width="1.1"/>`,
  zamek: `<rect x="4.5" y="9" width="11" height="8.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9" fill="none" stroke="currentColor" stroke-width="1.2"/>`,
  lupaKontrola: `<circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="m13 13 4.5 4.5" stroke="currentColor" stroke-width="1.4"/><path d="m6.5 9 2 2 3.5-4" fill="none" stroke="${S}" stroke-width="1.2"/>`,
  verze: `<circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M10 5.5V10l3 2" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M2.5 6V2.5M2.5 6H6" fill="none" stroke="currentColor" stroke-width="1.2"/>`,
  pdf: `<path d="M5 2.5h7l3.5 3.5v11.5H5z" fill="#fff" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><rect x="2.5" y="9" width="11" height="6" rx="1" fill="${C}"/><text x="8" y="13.7" text-anchor="middle" font-size="4.6" font-weight="700" font-family="Segoe UI" fill="#fff">PDF</text>`,
  zmenitTyp: `<path d="M5 2.5h7l3.5 3.5v11.5H5z" fill="#fff" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M8 9h5M11 7l2 2-2 2M12 13H7M9 11l-2 2 2 2" fill="none" stroke="${M}" stroke-width="1.1"/>`,

  // --- tabulka a obrázek (kontextové karty)
  vlozitNad: `<rect x="4" y="14" width="24" height="14" fill="#fff" stroke="currentColor" stroke-width="1.4"/><path d="M4 21h24M12 14v14M20 14v14" stroke="currentColor" stroke-width="1"/><rect x="4" y="4" width="24" height="7" fill="#dbe9f9" stroke="${M}" stroke-width="1.3"/>`,
  vlozitPod: `<rect x="4" y="4" width="24" height="14" fill="#fff" stroke="currentColor" stroke-width="1.4"/><path d="M4 11h24M12 4v14M20 4v14" stroke="currentColor" stroke-width="1"/><rect x="4" y="21" width="24" height="7" fill="#dbe9f9" stroke="${M}" stroke-width="1.3"/>`,
  vlozitVlevo: `<rect x="14" y="4" width="14" height="24" fill="#fff" stroke="currentColor" stroke-width="1.4"/><path d="M21 4v24M14 12h14M14 20h14" stroke="currentColor" stroke-width="1"/><rect x="4" y="4" width="7" height="24" fill="#dbe9f9" stroke="${M}" stroke-width="1.3"/>`,
  vlozitVpravo: `<rect x="4" y="4" width="14" height="24" fill="#fff" stroke="currentColor" stroke-width="1.4"/><path d="M11 4v24M4 12h14M4 20h14" stroke="currentColor" stroke-width="1"/><rect x="21" y="4" width="7" height="24" fill="#dbe9f9" stroke="${M}" stroke-width="1.3"/>`,
  odstranit: `<rect x="4" y="4" width="24" height="24" fill="#fff" stroke="currentColor" stroke-width="1.4"/><path d="M4 12h24M4 20h24M12 4v24M20 4v24" stroke="currentColor" stroke-width="1"/><circle cx="23" cy="23" r="6.5" fill="${C}"/><path d="m20.5 20.5 5 5M25.5 20.5l-5 5" stroke="#fff" stroke-width="1.6"/>`,
  sloucit: `<rect x="4" y="4" width="24" height="24" fill="#fff" stroke="currentColor" stroke-width="1.4"/><path d="M4 16h24" stroke="currentColor" stroke-width="1"/><rect x="6" y="6" width="20" height="8" fill="#dbe9f9" stroke="${M}" stroke-width="1.2"/>`,
  obtekani: `<rect x="11" y="10" width="10" height="10" fill="#dbe9f9" stroke="${M}" stroke-width="1.3"/><path d="M4 5h24M4 10h5M23 10h5M4 15h5M23 15h5M4 20h5M23 20h5M4 25h24" stroke="currentColor" stroke-width="1.2"/>`,
  oriznout: `<path d="M9 3v20h20M3 9h20v20" fill="none" stroke="currentColor" stroke-width="1.8"/>`,
  zavritZahlavi: `<rect x="5" y="5" width="22" height="22" rx="2" fill="${C}"/><path d="m11 11 10 10M21 11 11 21" stroke="#fff" stroke-width="2"/>`,
};

// ikony kreslené na mřížce 32×32 (velká tlačítka pásu karet); ostatní jsou 20×20
const VELKE = new Set(`vlozit najit diktovat editor doplnky astroai komentarNovy titulniStrana prazdnaStrana
  koneStranky tabulka obrazky tvary ikonyVlozit odkaz zahlavi zapati cisloStranky textovePole symbol rovnice
  datumCas cara wordart okraje orientace velikost sloupce konce motivy barvaStranky ohraniceniStranky vodoznak
  obsah poznamkaPodCarou obalka stitky hromadna prijemci pravopis pocetSlov predcitat prelozit jazyk
  smazatKomentar sledovat lupa sto jednaStrana viceStran sirkaStranky noveOkno cteckaTextu prepnoutRezimy pero
  zvyraznovacKresleni guma kresleni napoveda podpora nazory skoleni coNoveho vlozitNad vlozitPod vlozitVlevo
  vlozitVpravo odstranit sloucit obtekani oriznout zavritZahlavi`.split(/\s+/));

/** ik('tucne') → <svg>; velikost na obrazovce určuje CSS */
export function ik(nazev, cls = '') {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const vb = VELKE.has(nazev) ? 32 : 20;
  s.setAttribute('viewBox', `0 0 ${vb} ${vb}`);
  s.setAttribute('class', ('psi ' + cls).trim());
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = I[nazev] || I.informace;
  return s;
}

export const maIkonu = (n) => !!I[n];

/** Další aplikace Office (AstroTabulky) si sem přidají vlastní ikony. velke = názvy s viewBox 32. */
export function pridejIkony(mapa, velke = []) {
  Object.assign(I, mapa);
  for (const n of velke) VELKE.add(n);
}
