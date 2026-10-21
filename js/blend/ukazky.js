// Astro 3D — ukázkové scény
//
// Scény se popisují stejným „předpisem“, jaký vrací AstroAI: objekty z tvarů (střed, měřítko,
// otočení ve stupních, materiál), světla (poloha + kam míří) a svět. Tvary mají rozměr 2 m
// (od −1 do 1), takže krychle s měřítkem sz = 0.5 je vysoká 1 m a na zemi stojí se z = 0.5.

const o = (nazev, tvar, [x, y, z], [sx, sy, sz], barva, extra = {}) => ({
  nazev, tvar, x, y, z, sx, sy, sz, rx: 0, ry: 0, rz: 0, barva, drsnost: 0.5, kov: 0, zare: 0, ...extra,
});
const svetlo = (druh, [x, y, z], sila, barva = '#ffffff', cil = [0, 0, 0]) => ({ druh, x, y, z, sila, barva, cil_x: cil[0], cil_y: cil[1], cil_z: cil[2] });

export const UKAZKY = [
  {
    id: 'domek', nazev: 'Domek se stromem', klice: ['dom', 'chat', 'chalup', 'strom'],
    postav: () => ({
      objekty: [
        o('Tráva', 'rovina', [0, 0, 0], [7, 7, 1], '#5f9e45', { drsnost: 0.9 }),
        o('Zdi', 'krychle', [0, 0, 1.1], [1.6, 1.2, 1.1], '#e9dcc4', { drsnost: 0.8 }),
        o('Střecha', 'strecha', [0, 0, 2.85], [1.8, 1.4, 0.65], '#a8442e', { drsnost: 0.7 }),
        o('Komín', 'krychle', [0.9, 0.5, 3.1], [0.18, 0.18, 0.5], '#7a4b3a'),
        o('Dveře', 'krychle', [0, -1.21, 0.75], [0.35, 0.03, 0.75], '#6b3f22'),
        o('Okno L', 'krychle', [-0.95, -1.21, 1.35], [0.3, 0.03, 0.3], '#ffd98a', { zare: 3 }),
        o('Okno P', 'krychle', [0.95, -1.21, 1.35], [0.3, 0.03, 0.3], '#ffd98a', { zare: 3 }),
        o('Kmen', 'valec', [3.2, 1.2, 0.8], [0.18, 0.18, 0.8], '#6e4a2f', { drsnost: 0.9 }),
        o('Koruna', 'ikokoule', [3.2, 1.2, 2.2], [0.95, 0.95, 1.05], '#3f8a3a', { drsnost: 0.8 }),
        o('Koruna 2', 'ikokoule', [3.5, 0.9, 2.9], [0.6, 0.6, 0.6], '#4c9c44', { drsnost: 0.8 }),
        o('Keř', 'koule', [-2.4, -1.4, 0.35], [0.5, 0.45, 0.4], '#3e7f35', { drsnost: 0.9 }),
      ],
      svetla: [svetlo('slunce', [-5, -4, 8], 2.5, '#fff3dc')],
      svet: { barva: '#9cc4ec', sila: 0.6 },
    }),
  },
  {
    id: 'snehulak', nazev: 'Sněhulák', klice: ['sněh', 'snih', 'snehul', 'zim'],
    postav: () => ({
      objekty: [
        o('Sníh', 'rovina', [0, 0, 0], [6, 6, 1], '#eef3fb', { drsnost: 0.95 }),
        o('Spodní koule', 'koule', [0, 0, 0.9], [1, 1, 0.95], '#f7f9fc', { drsnost: 0.9 }),
        o('Prostřední koule', 'koule', [0, 0, 2.3], [0.72, 0.72, 0.68], '#f7f9fc', { drsnost: 0.9 }),
        o('Hlava', 'koule', [0, 0, 3.35], [0.5, 0.5, 0.48], '#f7f9fc', { drsnost: 0.9 }),
        o('Oko L', 'koule', [-0.17, -0.44, 3.48], [0.06, 0.06, 0.06], '#151515', { drsnost: 0.3 }),
        o('Oko P', 'koule', [0.17, -0.44, 3.48], [0.06, 0.06, 0.06], '#151515', { drsnost: 0.3 }),
        o('Mrkev', 'kuzel', [0, -0.68, 3.32], [0.07, 0.07, 0.25], '#f07a1a', { rx: 90 }),
        o('Krempa', 'valec', [0, 0, 3.78], [0.5, 0.5, 0.03], '#222222'),
        o('Klobouk', 'valec', [0, 0, 4.08], [0.33, 0.33, 0.3], '#222222'),
        o('Šála', 'torus', [0, 0, 2.95], [0.55, 0.55, 0.9], '#c8323a', { drsnost: 0.85 }),
        o('Knoflík 1', 'koule', [0, -0.71, 2.45], [0.07, 0.07, 0.07], '#151515'),
        o('Knoflík 2', 'koule', [0, -0.72, 2.15], [0.07, 0.07, 0.07], '#151515'),
      ],
      svetla: [svetlo('slunce', [-4, -5, 6], 1.8, '#fff6ea'), svetlo('bod', [3, -3, 4], 600, '#9fc3ff')],
      svet: { barva: '#7f9cc4', sila: 0.7 },
    }),
  },
  {
    id: 'planeta', nazev: 'Planeta s prstencem', klice: ['planet', 'vesmír', 'vesmir', 'saturn', 'měsíc', 'mesic'],
    postav: () => ({
      objekty: [
        o('Planeta', 'koule', [0, 0, 0], [1.6, 1.6, 1.6], '#d9a066', { drsnost: 0.75 }),
        o('Prstenec', 'torus', [0, 0, 0], [2.5, 2.5, 0.12], '#cdb796', { rx: 18, ry: -12, drsnost: 0.6 }),
        o('Měsíc', 'ikokoule', [3.6, -1.2, 1.1], [0.38, 0.38, 0.38], '#b8b8b8', { drsnost: 0.9 }),
        // hvězda kousek mimo směr slunce, ať nevrhá stín na planetu
        o('Hvězda', 'koule', [-9, 6, 7.5], [0.7, 0.7, 0.7], '#ffe7a8', { zare: 12 }),
      ],
      svetla: [svetlo('slunce', [-9, 6, 4], 3, '#fff0d0')],
      svet: { barva: '#06070d', sila: 0.4 },
    }),
  },
  {
    id: 'stul', nazev: 'Stůl s lampou', klice: ['stůl', 'stul', 'lamp', 'hrnek', 'pokoj'],
    postav: () => ({
      objekty: [
        o('Podlaha', 'rovina', [0, 0, 0], [5, 5, 1], '#8a6a4d', { drsnost: 0.7 }),
        o('Deska', 'krychle', [0, 0, 1.5], [1.6, 0.9, 0.05], '#b07a46', { drsnost: 0.45 }),
        o('Noha 1', 'valec', [-1.45, -0.75, 0.73], [0.06, 0.06, 0.73], '#5b3d24'),
        o('Noha 2', 'valec', [1.45, -0.75, 0.73], [0.06, 0.06, 0.73], '#5b3d24'),
        o('Noha 3', 'valec', [-1.45, 0.75, 0.73], [0.06, 0.06, 0.73], '#5b3d24'),
        o('Noha 4', 'valec', [1.45, 0.75, 0.73], [0.06, 0.06, 0.73], '#5b3d24'),
        o('Podstavec lampy', 'valec', [0.9, 0.35, 1.58], [0.22, 0.22, 0.03], '#2b2b2b', { kov: 1, drsnost: 0.3 }),
        o('Tyč lampy', 'valec', [0.9, 0.35, 2.05], [0.03, 0.03, 0.45], '#2b2b2b', { kov: 1, drsnost: 0.3 }),
        o('Stínidlo', 'kuzel', [0.9, 0.35, 2.55], [0.35, 0.35, 0.25], '#e8e0cf', { drsnost: 0.8 }),
        o('Žárovka', 'koule', [0.9, 0.35, 2.38], [0.09, 0.09, 0.09], '#fff1c4', { zare: 15 }),
        o('Hrnek', 'valec', [-0.5, -0.2, 1.7], [0.16, 0.16, 0.15], '#3f7dd6', { drsnost: 0.25 }),
        o('Ucho hrnku', 'torus', [-0.32, -0.2, 1.7], [0.1, 0.1, 0.35], '#3f7dd6', { rx: 90, drsnost: 0.25 }),
        o('Kniha', 'krychle', [-0.9, 0.35, 1.6], [0.35, 0.25, 0.05], '#2f8f6b', { rz: 15 }),
        o('Míč', 'koule', [-2.2, 1.2, 0.35], [0.35, 0.35, 0.35], '#e04545', { drsnost: 0.35 }),
      ],
      // reflektor těsně pod žárovkou a stínidlem — jinak by si je sám zastínil
      svetla: [svetlo('reflektor', [0.9, 0.35, 2.25], 220, '#ffd9a0', [0.4, 0, 1.5]), svetlo('bod', [-3, -3, 4], 500, '#cfe0ff')],
      svet: { barva: '#2a2830', sila: 0.6 },
    }),
  },
  {
    id: 'robot', nazev: 'Robot', klice: ['robot', 'android'],
    postav: () => ({
      objekty: [
        o('Podlaha', 'rovina', [0, 0, 0], [5, 5, 1], '#3a3f47', { drsnost: 0.6 }),
        o('Trup', 'krychle', [0, 0, 2.1], [0.75, 0.5, 0.8], '#c9ced6', { kov: 0.8, drsnost: 0.35 }),
        o('Hlava', 'krychle', [0, 0, 3.4], [0.5, 0.42, 0.42], '#c9ced6', { kov: 0.8, drsnost: 0.35 }),
        o('Oko L', 'koule', [-0.2, -0.43, 3.45], [0.1, 0.05, 0.1], '#36e0ff', { zare: 8 }),
        o('Oko P', 'koule', [0.2, -0.43, 3.45], [0.1, 0.05, 0.1], '#36e0ff', { zare: 8 }),
        o('Anténa', 'valec', [0, 0, 4.05], [0.03, 0.03, 0.25], '#888888', { kov: 1 }),
        o('Světýlko', 'koule', [0, 0, 4.35], [0.08, 0.08, 0.08], '#ff3b3b', { zare: 10 }),
        o('Ruka L', 'valec', [-0.95, 0, 2.05], [0.14, 0.14, 0.65], '#8d949e', { kov: 0.9, drsnost: 0.3, ry: -12 }),
        o('Ruka P', 'valec', [0.95, 0, 2.05], [0.14, 0.14, 0.65], '#8d949e', { kov: 0.9, drsnost: 0.3, ry: 12 }),
        o('Noha L', 'valec', [-0.35, 0, 0.65], [0.17, 0.17, 0.65], '#8d949e', { kov: 0.9, drsnost: 0.3 }),
        o('Noha P', 'valec', [0.35, 0, 0.65], [0.17, 0.17, 0.65], '#8d949e', { kov: 0.9, drsnost: 0.3 }),
        o('Panel', 'krychle', [0, -0.51, 2.2], [0.35, 0.02, 0.25], '#1f2a36', { drsnost: 0.2 }),
        o('Tlačítko', 'koule', [0.12, -0.54, 2.25], [0.06, 0.03, 0.06], '#7dff7a', { zare: 6 }),
      ],
      svetla: [svetlo('slunce', [-4, -5, 7], 2, '#ffffff'), svetlo('bod', [3, 2, 3], 400, '#7ab8ff')],
      svet: { barva: '#30343c', sila: 0.8 },
    }),
  },
];

/** Ukázka, která sedí na zadání (pro chvíle, kdy AstroAI neběží). */
export function ukazkaPodle(text) {
  const t = String(text || '').toLowerCase();
  return UKAZKY.find((u) => u.klice.some((k) => t.includes(k))) || null;
}
