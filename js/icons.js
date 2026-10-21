// AstroOS — sada ikon (inline SVG, jednotný tah, barva z currentColor)

const P = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>',
  folder: '<path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2.5h7A1.5 1.5 0 0 1 19 10v7.5A1.5 1.5 0 0 1 17.5 19h-13A1.5 1.5 0 0 1 3 17.5z"/>',
  folderOpen: '<path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2.5h7A1.5 1.5 0 0 1 19 10v1"/><path d="m3 18 2.2-6.2A1.5 1.5 0 0 1 6.6 11h13.1a1 1 0 0 1 .95 1.3L18.9 18z"/>',
  terminal: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="m7 10 2.6 2.4L7 15"/><path d="M13 15.4h4"/>',
  notes: '<path d="M6 3.5h9L19 8v12.5H6z"/><path d="M14.5 3.6V8H19"/><path d="M9 12.5h7M9 16h5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 14.5a1.5 1.5 0 0 0 .3 1.7l.1.1a1.8 1.8 0 1 1-2.6 2.6l-.1-.1a1.5 1.5 0 0 0-2.6 1v.3a1.8 1.8 0 1 1-3.6 0v-.2a1.5 1.5 0 0 0-2.6-1l-.2.1a1.8 1.8 0 1 1-2.5-2.6l.1-.1a1.5 1.5 0 0 0-1-2.6h-.3a1.8 1.8 0 1 1 0-3.6h.2a1.5 1.5 0 0 0 1-2.6l-.1-.2a1.8 1.8 0 1 1 2.6-2.5l.1.1a1.5 1.5 0 0 0 2.6-1v-.3a1.8 1.8 0 1 1 3.6 0v.2a1.5 1.5 0 0 0 2.6 1l.2-.1a1.8 1.8 0 1 1 2.5 2.6l-.1.1a1.5 1.5 0 0 0 1 2.6h.3a1.8 1.8 0 1 1 0 3.6h-.2a1.5 1.5 0 0 0-1.4.9z"/>',
  ai: '<path d="M12 3.2 13.7 8 18.5 9.8 13.7 11.6 12 16.4 10.3 11.6 5.5 9.8 10.3 8z"/><path d="M18 15.6l.8 2.1 2.2.8-2.2.8-.8 2.1-.8-2.1-2.2-.8 2.2-.8z"/>',
  bulb: '<path d="M9 17.5h6M10 20.5h4"/><path d="M12 3.5a5.8 5.8 0 0 0-3.4 10.5c.6.5.9 1.1.9 1.8v.2h5v-.2c0-.7.3-1.3.9-1.8A5.8 5.8 0 0 0 12 3.5z"/>',
  computer: '<rect x="2.5" y="4.5" width="19" height="12" rx="2"/><path d="M8.5 20.5h7M12 16.5v4"/>',
  trash: '<path d="M4.5 7h15"/><path d="M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7"/><path d="M6.5 7.5 7.4 19a1.6 1.6 0 0 0 1.6 1.5h6a1.6 1.6 0 0 0 1.6-1.5l.9-11.5"/><path d="M10.5 11v5.5M13.5 11v5.5"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5a15 15 0 0 1 0 17 15 15 0 0 1 0-17z"/>',
  calc: '<rect x="4.5" y="3" width="15" height="18" rx="2.5"/><path d="M8 7h8"/><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01M8.5 15h.01M12 15h.01M15.5 15h.01M8.5 18h.01M12 18h.01M15.5 18h.01"/>',
  music: '<path d="M9 18V6.5l10-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  game: '<path d="M7.5 8h9a4.5 4.5 0 0 1 4.4 3.6l.7 4a3 3 0 0 1-5.3 2.4L15 16.5H9l-1.3 1.5a3 3 0 0 1-5.3-2.4l.7-4A4.5 4.5 0 0 1 7.5 8z"/><path d="M7 11.5v2.5M5.75 12.75h2.5"/><path d="M15.5 12h.01M17.5 14h.01"/>',
  image: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><circle cx="8.5" cy="10" r="1.8"/><path d="m4 17 4.6-4.2a2 2 0 0 1 2.7 0L20 19.5"/>',
  mail: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="m3.5 7 7.4 5.3a2 2 0 0 0 2.2 0L20.5 7"/>',
  store: '<path d="M4.5 8.5h15l-1 11h-13z"/><path d="M8.5 8.5V6.8a3.5 3.5 0 0 1 7 0v1.7"/>',
  wifi: '<path d="M2.5 9.2a14 14 0 0 1 19 0"/><path d="M6 12.7a9 9 0 0 1 12 0"/><path d="M9.3 16.2a4.3 4.3 0 0 1 5.4 0"/><path d="M12 19.6h.01"/>',
  letadlo: '<path d="M10.2 20.5 12 19l1.8 1.5V18l-1.3-1V13l7 3v-2l-7-4.6V4.6a1.5 1.5 0 0 0-3 0v4.8L2.5 14v2l7-3v4l-1.3 1z"/>',
  wifiOff: '<path d="M2.5 9.2a14 14 0 0 1 5.3-3.2M14 5.4a14 14 0 0 1 7.5 3.8"/><path d="M6 12.7a9 9 0 0 1 3.2-2.1M17.2 11.6a9 9 0 0 1 .8.7"/><path d="M9.3 16.2a4.3 4.3 0 0 1 3.5-1.2"/><path d="M12 19.6h.01"/><path d="m3 3 18 18"/>',
  volume: '<path d="M4 9.5h3.2L12 5.5v13L7.2 14.5H4z"/><path d="M15.5 9.6a3.4 3.4 0 0 1 0 4.8"/><path d="M18.2 7a7 7 0 0 1 0 10"/>',
  volumeOff: '<path d="M4 9.5h3.2L12 5.5v13L7.2 14.5H4z"/><path d="m16 10 4 4M20 10l-4 4"/>',
  battery: '<rect x="2.5" y="7.5" width="16" height="9" rx="2.5"/><path d="M21 10.5v3"/><rect x="5" y="10" width="7" height="4" rx="1" fill="currentColor" stroke="none"/>',
  bell: '<path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4 1.5 5.5 1.5 5.5H5S6.5 14 6.5 10z"/><path d="M10.2 19a2 2 0 0 0 3.6 0"/>',
  bellOff: '<path d="M8.6 5.6A5.5 5.5 0 0 1 17.5 10c0 2 .4 3.3.8 4.2"/><path d="M6.5 10c0 4-1.5 5.5-1.5 5.5h11.2"/><path d="M10.2 19a2 2 0 0 0 3.6 0"/><path d="m3 3 18 18"/>',
  power: '<path d="M12 3.5v8.5"/><path d="M17.5 6.8a8 8 0 1 1-11 0"/>',
  restart: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20.5 4v4.5H16"/>',
  lock: '<rect x="4.5" y="10" width="15" height="10.5" rx="2.5"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/>',
  logout: '<path d="M14.5 4.5h3A2.5 2.5 0 0 1 20 7v10a2.5 2.5 0 0 1-2.5 2.5h-3"/><path d="M4 12h11"/><path d="m11.5 8.5 3.5 3.5-3.5 3.5"/>',
  sleep: '<path d="M20 14.3A8 8 0 1 1 9.7 4a6.5 6.5 0 0 0 10.3 10.3z"/>',
  moon: '<path d="M20 14.3A8 8 0 1 1 9.7 4a6.5 6.5 0 0 0 10.3 10.3z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4"/>',
  night: '<path d="M20 14.3A8 8 0 1 1 9.7 4a6.5 6.5 0 0 0 10.3 10.3z"/><path d="m17 3 .7 1.8L19.5 5.5l-1.8.7L17 8l-.7-1.8L14.5 5.5l1.8-.7z"/>',
  bluetooth: '<path d="m7 7.5 10 9-5 4v-17l5 4-10 9"/>',
  brightness: '<circle cx="12" cy="12" r="4.2"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"/>',
  x: '<path d="m5 5 14 14M19 5 5 19"/>',
  minus: '<path d="M5 12h14"/>',
  square: '<rect x="5.5" y="5.5" width="13" height="13" rx="1.5"/>',
  restore: '<rect x="4.5" y="7.5" width="11" height="11" rx="1.5"/><path d="M8 7.5V6a1.5 1.5 0 0 1 1.5-1.5h9A1.5 1.5 0 0 1 20 6v9a1.5 1.5 0 0 1-1.5 1.5H17"/>',
  chevronDown: '<path d="m6 9.5 6 6 6-6"/>',
  chevronRight: '<path d="m9.5 6 6 6-6 6"/>',
  chevronLeft: '<path d="m14.5 6-6 6 6 6"/>',
  arrowRight: '<path d="M4.5 12h14"/><path d="m13 6.5 6 5.5-6 5.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M4 4.5S2.5 8 2.5 12c0 0 3.5 6.5 9.5 6.5 2 0 3.7-.7 5.1-1.7"/><path d="M9.9 6a9.9 9.9 0 0 1 2.1-.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.8 3.6"/><path d="M10 10a3 3 0 0 0 4 4"/><path d="m3 3 18 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><path d="M12 7.8h.01"/>',
  refresh: '<path d="M20 11.5A8 8 0 1 0 18 17"/><path d="M20.5 5.5V11H15"/>',
  palette: '<path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.4 0 2-.9 2-1.8 0-1.4-1.2-1.7-1.2-2.8 0-.8.7-1.4 1.6-1.4h1.9a4.2 4.2 0 0 0 4.2-4.2c0-3.7-3.8-6.8-8.5-6.8z"/><circle cx="8" cy="10.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="8" r="1.1" fill="currentColor" stroke="none"/><circle cx="16" cy="10" r="1.1" fill="currentColor" stroke="none"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.6"/><rect x="13" y="4" width="7" height="7" rx="1.6"/><rect x="4" y="13" width="7" height="7" rx="1.6"/><rect x="13" y="13" width="7" height="7" rx="1.6"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  star: '<path d="m12 4 2.4 5 5.6.8-4 3.9 1 5.5-5-2.6-5 2.6 1-5.5-4-3.9 5.6-.8z"/>',
  cpu: '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M9.5 3.5v3M14.5 3.5v3M9.5 17.5v3M14.5 17.5v3M3.5 9.5h3M3.5 14.5h3M17.5 9.5h3M17.5 14.5h3"/>',
  hdd: '<rect x="2.5" y="12.5" width="19" height="7" rx="2"/><path d="m4.8 12.5 2.4-6a2 2 0 0 1 1.9-1.3h5.8a2 2 0 0 1 1.9 1.3l2.4 6"/><path d="M17.5 16h.01M14 16h.01"/>',
  shield: '<path d="M12 3.5 19 6v5.5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z"/><path d="m9 12 2 2 4-4"/>',
  keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6.5 9.5h.01M10 9.5h.01M13.5 9.5h.01M17 9.5h.01M6.5 12.8h.01M10 12.8h.01M13.5 12.8h.01M17 12.8h.01M8.5 15.8h7"/>',
  mapa: '<path d="M3.5 6.5 9 4.5l6 2 5.5-2v13l-5.5 2-6-2-5.5 2z"/><path d="M9 4.5v13M15 6.5v13"/>',
  poloha: '<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>',
  vrstvy: '<path d="m12 3.5 8.5 4.5-8.5 4.5L3.5 8z"/><path d="m3.5 12 8.5 4.5 8.5-4.5"/><path d="m3.5 16 8.5 4.5 8.5-4.5"/>',
  trasa: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h7.5a3 3 0 0 0 0-6h-7a3 3 0 0 1 0-6H16"/>',
  pohar: '<path d="M8 4.5h8v5a4 4 0 0 1-8 0z"/><path d="M8 6.5H5a2.5 2.5 0 0 0 3 3.5M16 6.5h3a2.5 2.5 0 0 1-3 3.5"/><path d="M12 13.5v3.5M8.5 20h7M10 17h4v3h-4z"/>',
  access: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="7.8" r="1.2" fill="currentColor" stroke="none"/><path d="M8 10.2c2.6.8 5.4.8 8 0"/><path d="M12 10.5v4M12 14.5l-2 3.5M12 14.5l2 3.5"/>',
  pin: '<path d="M14.5 3.5 20.5 9.5l-2.6 1.2-1.3 4.1-5.4-5.4 4.1-1.3z"/><path d="m11.2 12.8-6.7 6.7"/>',
  monitor: '<rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 20.5h8M12 17v3.5"/>',
  book: '<path d="M4.5 5.5A2 2 0 0 1 6.5 3.5H19v17H6.5a2 2 0 0 0-2 2z"/><path d="M4.5 18.5h14.5"/>',
  code: '<path d="m8.5 8.5-4 3.5 4 3.5"/><path d="m15.5 8.5 4 3.5-4 3.5"/><path d="m13.5 5-3 14"/>',
  home: '<path d="m3.5 11 8.5-7 8.5 7"/><path d="M6 9.5v10h12v-10"/><path d="M10 19.5v-5.5h4v5.5"/>',
  weather: '<path d="M7.5 18.5a4 4 0 0 1-.4-8 5.5 5.5 0 0 1 10.5 1.2 3.4 3.4 0 0 1-.6 6.8z"/>',
  fileText: '<path d="M6 3.5h8L18.5 8v12.5H6z"/><path d="M13.6 3.6V8H18"/><path d="M9 12h6M9 15.5h4"/>',
  // --- Malování ---
  pencil: '<path d="m4.5 19.5 1-4 10-10a2.1 2.1 0 0 1 3 3l-10 10z"/><path d="m14 7 3 3"/>',
  brush: '<path d="M6 13.5 15.5 4a2.5 2.5 0 0 1 3.5 3.5L9.5 17"/><path d="M6 13.5 9.5 17"/><path d="M6.5 16.5c0 1.8-.7 3.3-3 4 1.5.9 3.3 1 4.6.3A3 3 0 0 0 9.5 17"/>',
  eraser: '<path d="m9 20.5-4.7-4.7a1.6 1.6 0 0 1 0-2.3l8.4-8.4a1.6 1.6 0 0 1 2.3 0l4.4 4.4a1.6 1.6 0 0 1 0 2.3l-8.7 8.7z"/><path d="M9.2 20.5H20"/><path d="m8 9.5 6.5 6.5"/>',
  fill: '<path d="M10 3.5 19 12.5a1.6 1.6 0 0 1 0 2.3l-5.2 5.2a1.6 1.6 0 0 1-2.3 0L4 12.5z"/><path d="m7.5 6 3 3"/><path d="M20.5 16.5c1 1.4 1.5 2.4 1.5 3a1.5 1.5 0 0 1-3 0c0-.6.5-1.6 1.5-3z"/>',
  pipette: '<path d="m14 4.8 1.4-1.4a2.4 2.4 0 0 1 3.4 3.4L17.4 8.2"/><path d="m13 5.8 5.2 5.2"/><path d="M15.8 8.6 8 16.4l-.6 3.4-3.4.6.6-3.4 7.8-7.8z"/>',
  line: '<path d="M5 19 19 5"/><circle cx="5" cy="19" r="1.8"/><circle cx="19" cy="5" r="1.8"/>',
  rect: '<rect x="4" y="6" width="16" height="12" rx="1.5"/>',
  circle: '<ellipse cx="12" cy="12" rx="8" ry="6.5"/>',
  undo: '<path d="M4 9.5h10.5a5 5 0 0 1 0 10H9"/><path d="M7.5 5.5 3.5 9.5l4 4"/>',
  redo: '<path d="M20 9.5H9.5a5 5 0 0 0 0 10H15"/><path d="m16.5 5.5 4 4-4 4"/>',
  save: '<path d="M5.5 4.5h10L19 8v11.5h-14z"/><path d="M8.5 4.5v5h6v-5"/><path d="M8 19.5v-5h8v5"/>',
  swap: '<path d="M7 7h11l-3-3"/><path d="M17 17H6l3 3"/>',
  play: '<path d="M8 5.5 19 12 8 18.5z"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  mic: '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0"/><path d="M12 18v2.5"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2"/>',
  // --- Astro Defender ---
  shieldAlert: '<path d="M12 3.5 19 6v5.5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z"/><path d="M12 8.5v4.2"/><path d="M12 15.8h.01"/>',
  shieldX: '<path d="M12 3.5 19 6v5.5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z"/><path d="m9.5 9.5 5 5M14.5 9.5l-5 5"/>',
  shieldEmpty: '<path d="M12 3.5 19 6v5.5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z"/>',
  bug: '<rect x="7.5" y="8" width="9" height="12" rx="4.5"/><path d="M9.5 8.3a2.5 2.5 0 0 1 5 0"/><path d="M12 12v8"/><path d="M4 12.5h3.5M16.5 12.5H20M4.5 18l3.2-1.5M19.5 18l-3.2-1.5M5 7l2.8 2M19 7l-2.8 2"/>',
  heart: '<path d="M12 19.5s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 6.6a4.3 4.3 0 0 1 7.5 2.9c0 5.6-7.5 10-7.5 10z"/><path d="M4.8 12h3.6l1.6-2.6 2.4 5 1.6-2.4h5.2"/>',
  folderLock: '<path d="M11 19H4.5A1.5 1.5 0 0 1 3 17.5v-10A1.5 1.5 0 0 1 4.5 6h4l2 2.5h7A1.5 1.5 0 0 1 19 10v1"/><rect x="13" y="14.5" width="8" height="6" rx="1.3"/><path d="M14.8 14.5v-1.3a2.2 2.2 0 0 1 4.4 0v1.3"/>',
  wall: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M3 9.5h18M3 14.5h18"/><path d="M9 4.5v5M15 9.5v5M9 14.5v5"/>',
  radar: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12 18 6"/>',
  box: '<path d="M3.5 7.5 12 3.5l8.5 4v9L12 20.5l-8.5-4z"/><path d="m3.5 7.5 8.5 4 8.5-4M12 11.5v9"/>',
  ban: '<circle cx="12" cy="12" r="8.5"/><path d="m6 6 12 12"/>',
  chip: '<rect x="6.5" y="6.5" width="11" height="11" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx=".8"/><path d="M9.5 3.5v3M14.5 3.5v3M9.5 17.5v3M14.5 17.5v3M3.5 9.5h3M3.5 14.5h3M17.5 9.5h3M17.5 14.5h3"/>',
  phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
  pinKod: '<rect x="3" y="6" width="18" height="12" rx="2.5"/><circle cx="7.5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="16.5" cy="12" r="1"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8.5-8.5M16.5 6.5 19 9M14.5 8.5l2 2"/>',
  // --- soubory a plocha ---
  copy: '<rect x="8.5" y="8.5" width="11" height="12" rx="2"/><path d="M15.5 8.5V5.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2"/>',
  cut: '<circle cx="6.5" cy="17.5" r="2.8"/><circle cx="17.5" cy="17.5" r="2.8"/><path d="M8.6 15.6 18 4M15.4 15.6 6 4"/>',
  paste: '<rect x="5" y="4.5" width="14" height="16.5" rx="2"/><rect x="9" y="3" width="6" height="3.5" rx="1"/><path d="M9 11.5h6M9 15h4"/>',
  sipkaZastupce: '<path d="M8 16.5V11a3 3 0 0 1 3-3h6"/><path d="m14 5 3 3-3 3"/>',
  trashFull: '<path d="M4.5 7h15"/><path d="M6.5 7.5 7.4 19a1.6 1.6 0 0 0 1.6 1.5h6a1.6 1.6 0 0 0 1.6-1.5l.9-11.5"/><path d="M8 7 9.5 3.8l3 1.4M12.5 7l2-3.6 2.8 1.6L16.3 7"/><path d="M10.5 11v5.5M13.5 11v5.5"/>',
  sort: '<path d="M4 6h10M4 12h7M4 18h4"/><path d="M17.5 5v14"/><path d="m14.5 16 3 3 3-3"/>',
  send: '<path d="M4 12 20 4l-4 16-4-6.5z"/><path d="m12 13.5 8-9.5"/>',
  // --- AstroPísmo ---
  pismo: '<path d="M10 3.5h7.5A1.5 1.5 0 0 1 19 5v14a1.5 1.5 0 0 1-1.5 1.5H10"/><path d="M13.5 8.5h3M13.5 12h3M13.5 15.5h3"/><rect x="3" y="6.5" width="9" height="11" rx="1.6" fill="currentColor" fill-opacity=".22"/><path d="M6 15V9h2.2a1.8 1.8 0 0 1 0 3.6H6"/>',
  tabulky: '<path d="M10 3.5h7.5A1.5 1.5 0 0 1 19 5v14a1.5 1.5 0 0 1-1.5 1.5H10"/><path d="M12 8.5h7M12 12h7M12 15.5h7M15.5 3.5v17"/><rect x="3" y="6.5" width="9" height="11" rx="1.6" fill="currentColor" fill-opacity=".22"/><path d="M5.2 9.2h5.6M8 9.2v5.6"/>',
  prezentace: '<path d="M10 3.5h7.5A1.5 1.5 0 0 1 19 5v14a1.5 1.5 0 0 1-1.5 1.5H10"/><path d="M15.5 8.2a3.8 3.8 0 1 1-3.3 5.7"/><path d="M15.5 8.2V12h3.8"/><rect x="3" y="6.5" width="9" height="11" rx="1.6" fill="currentColor" fill-opacity=".22"/><path d="M6.3 15V9h2a1.8 1.8 0 0 1 0 3.6h-2"/>',
  // --- AstroGPU ---
  gpu: '<rect x="2.5" y="6" width="19" height="10.5" rx="1.6"/><circle cx="8.3" cy="11.25" r="2.7"/><circle cx="15.7" cy="11.25" r="2.7"/><path d="M5 16.5v2.5M8 16.5v2.5M11 16.5v2.5M14 16.5v2.5"/>',
  download: '<path d="M12 4v11"/><path d="m7 10.5 5 5 5-5"/><path d="M4.5 19.5h15"/>',
  dots: '<circle cx="6" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  // --- aplikace z Obchodu ---
  piskvorky: '<path d="m4 4 6 6M10 4l-6 6"/><circle cx="17" cy="17" r="3.3"/><path d="M12 3v18M3 12h18" opacity=".45"/>',
  raketa: '<path d="M12 3c3 2 4.5 5.5 4.5 9l-1.8 3.5H9.3L7.5 12C7.5 8.5 9 5 12 3z"/><circle cx="12" cy="9.5" r="1.7"/><path d="M7.6 12.5 5 15.5l2.5 1M16.4 12.5l2.6 3-2.5 1"/><path d="M10.5 18.5 12 21l1.5-2.5"/>',
  pexeso: '<rect x="3.5" y="5" width="9" height="13" rx="1.6" transform="rotate(-8 8 11.5)"/><rect x="11.5" y="5" width="9" height="13" rx="1.6" transform="rotate(8 16 11.5)"/><path d="m16 9.5.8 1.7 1.8.2-1.3 1.3.3 1.8-1.6-.9-1.6.9.3-1.8-1.3-1.3 1.8-.2z"/>',
  sibenice: '<path d="M4 20.5h9M7 20.5V4h8v3"/><circle cx="15" cy="9" r="2"/><path d="M15 11v4.5M13 13h4M15 15.5l-1.8 2.5M15 15.5l1.8 2.5"/>',
  blesk: '<path d="M13.5 3 5.5 13.5h5.5L10 21l8.5-11h-5.5z"/>',
  diamant: '<path d="M7 4h10l3.5 5L12 20 3.5 9z"/><path d="M3.5 9h17M9.5 4 8 9l4 11 4-11-1.5-5"/>',
  simon: '<path d="M11 11V3.6A8.4 8.4 0 0 0 3.6 11z"/><path d="M13 11V3.6a8.4 8.4 0 0 1 7.4 7.4z"/><path d="M11 13H3.6a8.4 8.4 0 0 0 7.4 7.4z"/><path d="M13 13h7.4a8.4 8.4 0 0 1-7.4 7.4z"/>',
  cihly: '<rect x="3" y="4" width="8" height="3.5" rx=".8"/><rect x="13" y="4" width="8" height="3.5" rx=".8"/><rect x="8" y="9.5" width="8" height="3.5" rx=".8"/><circle cx="12" cy="16.5" r="1.3"/><path d="M8 20.5h8"/>',
  sudoku: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17"/>',
  kviz: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.6"/><path d="M12 16.8h.01"/>',
  pomodoro: '<circle cx="12" cy="13.5" r="7"/><path d="M12 6.5c-.5-1.8-2-2.8-3.5-3M12 6.5c1-1.4 2.6-2 4-1.6"/><path d="M12 10v3.5l2.2 1.6"/>',
  prevodnik: '<path d="M4 8h14.5M15 4.5 18.5 8 15 11.5"/><path d="M20 16H5.5M9 12.5 5.5 16 9 19.5"/>',
  kostka: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="8.5" cy="8.5" r="1.1" fill="currentColor"/><circle cx="12" cy="12" r="1.1" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.1" fill="currentColor"/>',
  piano: '<rect x="3" y="5" width="18" height="14" rx="1.8"/><path d="M7.5 5v14M12 5v14M16.5 5v14"/><path d="M6 5h3v7.5H6zM10.5 5h3v7.5h-3zM15 5h3v7.5h-3z" fill="currentColor" fill-opacity=".85"/>',
  buben: '<ellipse cx="12" cy="9" rx="8" ry="3"/><path d="M4 9v6.5c0 1.7 3.6 3 8 3s8-1.3 8-3V9"/><path d="M7 11.6v5.6M17 11.6v5.6M12 12v6.5"/><path d="m15 3 2.5 4.5M9 3 6.5 7.5"/>',
  ryba: '<path d="M3 12c3-4.5 9.5-6 14-2.5L21 6v12l-4-3.5C12.5 18 6 16.5 3 12z"/><circle cx="7.5" cy="11" r=".9" fill="currentColor"/>',
  mazlicek: '<path d="M5 15.5C5 10.5 8 6 12 6s7 4.5 7 9.5c0 2.6-3 4-7 4s-7-1.4-7-4z"/><path d="M9 6.8 7.5 3.5M15 6.8l1.5-3.3"/><circle cx="9.7" cy="13" r="1" fill="currentColor"/><circle cx="14.3" cy="13" r="1" fill="currentColor"/><path d="M10.5 16a2 2 0 0 0 3 0"/>',
  kaleidoskop: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17M4.6 7.8l14.8 8.4M4.6 16.2l14.8-8.4"/><circle cx="12" cy="12" r="3" fill="currentColor" fill-opacity=".25"/>',
  morse: '<circle cx="5" cy="12" r="1.6" fill="currentColor"/><path d="M9 12h5"/><circle cx="18" cy="12" r="1.6" fill="currentColor"/><path d="M3 6.5h4M10 6.5h1.5M15 6.5h6M3 17.5h7M13.5 17.5h1.5M18.5 17.5h2.5"/>',
  planeta: '<circle cx="12" cy="12" r="5.5"/><path d="M6.2 13.6C3.4 15.6 2.2 17.5 3 18.6c1.3 1.8 7.3-.3 13.4-4.8S23.3 6.4 22 4.6c-.8-1-3-.6-5.8.8"/>',
  // Astro 3D
  b3krychle: '<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>',
  b3koule: '<circle cx="12" cy="12" r="8.5"/><ellipse cx="12" cy="12" rx="8.5" ry="3.2"/><path d="M12 3.5c-2.4 2.3-3.6 5.1-3.6 8.5s1.2 6.2 3.6 8.5"/>',
  b3valec: '<ellipse cx="12" cy="6" rx="7" ry="2.6"/><path d="M5 6v12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6"/>',
  b3kuzel: '<path d="M12 3 5 18M12 3l7 15"/><ellipse cx="12" cy="18" rx="7" ry="2.6"/>',
  b3rovina: '<path d="M2.5 15.5 8.5 8h13l-6 7.5z"/>',
  b3torus: '<ellipse cx="12" cy="12" rx="9" ry="5.5"/><ellipse cx="12" cy="11.3" rx="4" ry="1.8"/>',
  b3drat: '<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9M4 16.5l8-4.5 8 4.5M12 3v9" stroke-dasharray="1.6 1.8"/>',
  b3vyber: '<path d="M5 3.5 18 11l-5.6 1.4L9.6 18z"/><path d="m12.4 12.4 4.6 6.1"/>',
  b3presun: '<path d="M12 3v18M3 12h18"/><path d="m9.5 5.5 2.5-2.5 2.5 2.5M9.5 18.5l2.5 2.5 2.5-2.5M5.5 9.5 3 12l2.5 2.5M18.5 9.5 21 12l-2.5 2.5"/>',
  b3otoceni: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.8 3.8v3.6h-3.6"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/>',
  b3meritko: '<rect x="3.5" y="10.5" width="10" height="10" rx="1"/><path d="M10 3.5h10.5V14"/><path d="m13.5 10.5 7-7M16 3.5h4.5V8" />',
  b3vrchol: '<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z" opacity=".45"/><circle cx="12" cy="12" r="2.6" fill="currentColor"/>',
  b3hrana: '<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z" opacity=".45"/><path d="M12 12v9" stroke-width="2.8"/>',
  b3plocha: '<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z" opacity=".45"/><path d="m4 7.5 8 4.5 8-4.5L12 3z" fill="currentColor" fill-opacity=".55"/>',
  b3uprava: '<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z"/><circle cx="12" cy="3" r="1.6" fill="currentColor"/><circle cx="20" cy="7.5" r="1.6" fill="currentColor"/><circle cx="4" cy="7.5" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/>',
  b3vytah: '<path d="M4 15.5 12 19l8-3.5-8-3.5z"/><path d="M12 12V3.5M8.8 6.5 12 3.3l3.2 3.2"/>',
  b3vsad: '<rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/><rect x="8" y="8" width="8" height="8" rx="1" fill="currentColor" fill-opacity=".35"/><path d="m3.5 3.5 4.5 4.5M20.5 3.5 16 8M3.5 20.5 8 16M20.5 20.5 16 16"/>',
  b3rez: '<rect x="3.5" y="5" width="17" height="14" rx="1.5"/><path d="M12 3v18" stroke-dasharray="2 2"/>',
  b3vyhlad: '<path d="M5 17V9a4 4 0 0 1 4-4h8"/><path d="M5 17h8a6 6 0 0 0 6-6V5" opacity=".55"/><circle cx="5" cy="17" r="1.4" fill="currentColor"/><circle cx="19" cy="5" r="1.4" fill="currentColor"/>',
  b3svetlo: '<circle cx="12" cy="10" r="5.5"/><path d="M10 15.5V18h4v-2.5M10.5 20.5h3"/>',
  b3slunce: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8"/>',
  b3reflektor: '<path d="M9.5 3.5h5l1 4h-7z"/><path d="M8.5 7.5 4 20.5h16l-4.5-13" stroke-dasharray="2 2"/>',
  b3render: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" fill-opacity=".45"/>',
  b3pro: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" fill-opacity=".35"/><path d="m17.5 2.5.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z" fill="currentColor"/>',
  b3film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9.5h4M3 14.5h4M17 9.5h4M17 14.5h4"/>',
  b3klic: '<path d="M12 3.5 20.5 12 12 20.5 3.5 12z"/>',
  b3hrat: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" fill-opacity=".25"/>',
  b3pauza: '<path d="M8 5.5v13M16 5.5v13" stroke-width="2.6"/>',
  b3naZacatek: '<path d="M6 5.5v13M18 5.5v13L9 12z"/>',
  b3naKonec: '<path d="M18 5.5v13M6 5.5v13L15 12z"/>',
  b3strecha: '<path d="M3 17.5 9 6.5h6l6 11z"/><path d="M9 6.5 3 17.5h12L9 6.5"/>',
  b3jehlan: '<path d="M12 3.5 4 17l8 3.5 8-3.5z"/><path d="M12 3.5v17"/>',
  upload:'<path d="M12 15.5V4.5"/><path d="m7 9 5-5 5 5"/><path d="M4.5 19.5h15"/>',
  b3scena:'<path d="M4 5.5h16M4 12h16M4 18.5h16"/><circle cx="4" cy="5.5" r=".6" fill="currentColor"/>',
};

/** icon('wifi') → <svg class="i"> */
export function icon(name, cls = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('class', `i ${cls}`.trim());
  svg.innerHTML = P[name] || P.info;
  return svg;
}

export const hasIcon = (name) => !!P[name];

// Ikony aplikací jako obrázky (z macosicons.com, img/ikony/<id>.png, 256 px).
// Kdo obrázek nemá, dostane dál barevnou dlaždici s kreslenou ikonou.
const OBRAZKY = new Set(['astro3d', 'astroai','browser', 'calc', 'computer', 'defender', 'editor', 'files', 'games', 'jirka',
  'mail', 'malovani', 'mapy', 'monitor', 'monkeytype', 'music', 'notes', 'photos', 'pismo', 'prezentace', 'recorder',
  'settings', 'store', 'studio', 'tabulky', 'terminal', 'trash', 'trash-plny', 'weather', 'astrominecraft', 'mclauncher']);

/**
 * Dlaždice s ikonou aplikace: <div class="glyph"> s obrázkem, nebo s barvou a SVG.
 * sel = třída prvku ('div.glyph', 'div.ob-glyf'…), o = { ikona (jiná SVG/obrázek, např. trashFull), styl, deti }
 */
export function glyfAplikace(app, sel = 'div.glyph', o = {}) {
  const [tag, ...tridy] = sel.split('.');
  const d = document.createElement(tag || 'div');
  if (tridy.length) d.className = tridy.join(' ');
  const id = o.ikona === 'trashFull' ? 'trash-plny' : app.id;
  if (OBRAZKY.has(id)) {
    d.classList.add('ma-obrazek');
    const img = document.createElement('img');
    img.className = 'app-obr';
    img.src = `img/ikony/${id}.png`;
    img.alt = '';
    img.draggable = false;
    d.append(img);
  } else {
    d.style.background = app.color || 'var(--accent)';
    if (o.styl) Object.assign(d.style, o.styl);
    d.append(icon(o.ikona || app.icon));
  }
  for (const x of o.deti || []) if (x) d.append(x);
  return d;
}

/** Logo AstroOS — kosočtverec s oběžnou dráhou. */
export function logo(cls = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 48 48');
  svg.setAttribute('class', cls);
  svg.innerHTML = `
    <defs>
      <linearGradient id="lg-${cls.replace(/\s/g, '')}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="var(--accent)"/>
        <stop offset="1" stop-color="#2d7fb8"/>
      </linearGradient>
    </defs>
    <path class="stroke" d="M24 5 41 24 24 43 7 24z" fill="none"
          stroke="url(#lg-${cls.replace(/\s/g, '')})" stroke-width="3" stroke-linejoin="round"/>
    <path d="M24 14.5 32.5 31h-5.2L24 24.2 20.7 31h-5.2z" fill="var(--accent)"/>
    <ellipse cx="24" cy="24" rx="20.5" ry="7.6" fill="none"
             stroke="var(--accent)" stroke-width="1.3" opacity="0.5"
             transform="rotate(-28 24 24)"/>
    <circle cx="41.5" cy="15" r="2.3" fill="#2d7fb8"/>
  `;
  return svg;
}
