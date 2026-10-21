/**
 * Fotos de los espacios del seed: una ilustración por tipo de espacio, para que lo que se ve en el
 * catálogo coincida con el tipo (una cocina se ve como cocina). Son SVG generados aquí, sin descargar
 * nada ni guardar archivos binarios en el repo. `variant` cambia los colores entre espacios del mismo tipo.
 */

const W = 800;
const H = 600;

interface Palette {
  wall: string;
  floor: string;
  accent: string;
  wood: string;
}

const PALETTES: Palette[] = [
  { wall: '#eef2f6', floor: '#c9b8a3', accent: '#2f7d6d', wood: '#8a5a3c' },
  { wall: '#f6efe6', floor: '#b9c3cf', accent: '#d9822b', wood: '#6b4a32' },
  { wall: '#e8eef0', floor: '#d2c4b0', accent: '#4a6fa5', wood: '#9a6b45' },
];

type Scene = (p: Palette) => string;

const rect = (x: number, y: number, w: number, h: number, fill: string, rx = 0) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"/>`;
const circle = (cx: number, cy: number, r: number, fill: string) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;
const ellipse = (cx: number, cy: number, rx: number, ry: number, fill: string) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"/>`;
const poly = (points: string, fill: string) => `<polygon points="${points}" fill="${fill}"/>`;
const line = (x1: number, y1: number, x2: number, y2: number, stroke: string, width = 4) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round"/>`;

/** Pared al fondo y piso al frente. */
const room = (p: Palette, horizon = 380) =>
  rect(0, 0, W, horizon, p.wall) + rect(0, horizon, W, H - horizon, p.floor) + rect(0, horizon - 8, W, 8, 'rgba(0,0,0,.08)');

const chair = (x: number, y: number, fill: string) =>
  rect(x, y, 46, 40, fill, 10) + rect(x + 6, y - 34, 34, 38, fill, 8) + rect(x + 20, y + 40, 6, 30, '#444');

const plant = (x: number, y: number) =>
  rect(x - 22, y, 44, 50, '#b5651d', 6) + ellipse(x - 14, y - 22, 16, 34, '#3f8f4f') + ellipse(x + 14, y - 26, 16, 38, '#2f7a42') + ellipse(x, y - 34, 14, 40, '#4aa05c');

const SCENES: Record<string, Scene> = {
  'Sala de reuniones': (p) =>
    room(p) +
    rect(70, 70, 150, 190, '#bfe3f5', 6) + line(145, 70, 145, 260, '#fff', 6) + line(70, 165, 220, 165, '#fff', 6) +
    rect(300, 90, 330, 190, '#222c36', 8) +
    rect(335, 210, 36, 50, p.accent) + rect(390, 170, 36, 90, '#e8b34a') + rect(445, 140, 36, 120, '#5aa9e6') + rect(500, 190, 36, 70, p.accent) +
    plant(700, 320) +
    chair(235, 400, p.accent) + chair(345, 400, p.accent) + chair(455, 400, p.accent) + chair(565, 400, p.accent) +
    rect(180, 340, 440, 70, p.wood, 16) + rect(200, 410, 14, 90, '#3b2a1c') + rect(586, 410, 14, 90, '#3b2a1c') +
    rect(330, 352, 70, 20, '#2b2b2b', 3) + rect(420, 356, 40, 24, '#fff', 2),

  'Oficina o cowork': (p) =>
    room(p, 360) +
    line(150, 0, 150, 100, '#555', 3) + poly('105,100 195,100 175,140 125,140', p.accent) +
    line(400, 0, 400, 100, '#555', 3) + poly('355,100 445,100 425,140 375,140', p.accent) +
    line(650, 0, 650, 100, '#555', 3) + poly('605,100 695,100 675,140 625,140', p.accent) +
    [60, 300, 540].map((x) =>
      rect(x, 340, 200, 18, p.wood, 4) + rect(x + 14, 358, 12, 90, '#444') + rect(x + 174, 358, 12, 90, '#444') +
      rect(x + 50, 250, 100, 70, '#1d2630', 6) + rect(x + 94, 320, 12, 20, '#444') +
      rect(x + 70, 440, 60, 36, '#2b3a4a', 12) + rect(x + 92, 476, 16, 46, '#444'),
    ).join('') +
    plant(745, 330),

  'Estudio fotográfico o audiovisual': (p) =>
    rect(0, 0, W, H, '#d9dde2') +
    `<path d="M 80 0 L 720 0 L 720 360 Q 400 470 80 360 Z" fill="#f5f5f2"/>` +
    rect(0, 400, W, 200, '#8d8f94') +
    // luces de estudio con difusor
    [150, 650].map((x) =>
      line(x, 300, x, 540, '#333', 6) + line(x - 50, 540, x + 50, 540, '#333', 6) +
      poly(`${x - 70},120 ${x + 70},120 ${x + 40},300 ${x - 40},300`, '#2a2a2a') + poly(`${x - 58},132 ${x + 58},132 ${x + 32},290 ${x - 32},290`, '#fff7dd'),
    ).join('') +
    // cámara en trípode
    line(400, 390, 340, 540, '#333', 6) + line(400, 390, 460, 540, '#333', 6) + line(400, 390, 400, 540, '#333', 6) +
    rect(350, 320, 100, 66, '#202428', 10) + circle(400, 353, 24, '#0b0d10') + circle(400, 353, 14, p.accent) + rect(360, 308, 30, 14, '#202428', 3) +
    ellipse(400, 560, 120, 18, 'rgba(0,0,0,.18)'),

  'Sala de ensayo': (p) =>
    rect(0, 0, W, 400, '#2b2f36') + rect(0, 400, W, 200, '#5b4636') +
    [0, 1, 2, 3, 4].map((i) => rect(30 + i * 150, 40, 120, 150, '#3a3f48', 6) + rect(30 + i * 150, 210, 120, 150, '#343841', 6)).join('') +
    // batería
    ellipse(400, 470, 120, 24, 'rgba(0,0,0,.3)') +
    rect(350, 360, 100, 90, p.accent, 8) + ellipse(400, 360, 50, 12, '#eee') +
    ellipse(300, 410, 46, 14, '#eee') + rect(254, 410, 92, 50, '#c4452d', 6) +
    ellipse(500, 410, 46, 14, '#eee') + rect(454, 410, 92, 50, '#c4452d', 6) +
    ellipse(260, 330, 50, 8, '#e8c34a') + line(260, 330, 260, 460, '#999', 4) +
    ellipse(540, 310, 50, 8, '#e8c34a') + line(540, 310, 540, 460, '#999', 4) +
    // amplificador y guitarra
    rect(610, 380, 130, 120, '#1a1a1a', 8) + circle(675, 440, 38, '#444') + circle(675, 440, 14, '#222') +
    rect(80, 300, 24, 200, p.wood, 6) + ellipse(92, 470, 44, 38, p.accent) + circle(92, 470, 10, '#222') +
    // micrófono
    line(175, 330, 175, 520, '#bbb', 5) + circle(175, 322, 14, '#ddd'),

  'Cocina equipada': (p) =>
    rect(0, 0, W, 400, '#f1ede4') + rect(0, 400, W, 200, '#b9a98f') +
    // azulejos
    [0, 1, 2, 3, 4, 5, 6, 7].map((i) => line(i * 100, 160, i * 100, 330, 'rgba(0,0,0,.07)', 2)).join('') +
    [160, 200, 240, 280, 320].map((y) => line(0, y, W, y, 'rgba(0,0,0,.07)', 2)).join('') +
    // muebles altos y campana
    rect(40, 40, 230, 120, p.accent, 8) + rect(530, 40, 230, 120, p.accent, 8) +
    poly('300,60 500,60 530,160 270,160', '#9aa0a6') + rect(380, 20, 40, 40, '#9aa0a6') +
    // cocina a gas con ollas
    rect(40, 330, 720, 150, p.accent, 6) + rect(40, 318, 720, 18, '#e9e4d8') +
    rect(310, 320, 180, 12, '#222') + circle(350, 326, 14, '#555') + circle(450, 326, 14, '#555') +
    rect(322, 278, 56, 42, '#c0c4c9', 4) + rect(422, 290, 56, 30, '#c0c4c9', 4) +
    rect(310, 390, 180, 70, '#222', 8) + rect(330, 410, 140, 8, '#777') +
    // isla
    rect(100, 500, 600, 40, p.wood, 8) + rect(120, 540, 20, 50, '#3b2a1c') + rect(660, 540, 20, 50, '#3b2a1c'),

  Cancha: (p) =>
    rect(0, 0, W, 230, '#9fd3f2') + circle(660, 100, 44, '#ffe27a') +
    rect(0, 200, W, 40, '#6d7b6c') + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => rect(i * 70, 200, 8, 40, '#505a50')).join('') +
    poly('0,240 800,240 800,600 0,600', '#3f9a58') +
    poly('120,270 680,270 780,570 20,570', p.accent) +
    `<path d="M 120 270 L 680 270 L 780 570 L 20 570 Z" fill="none" stroke="#fff" stroke-width="6"/>` +
    line(70, 420, 730, 420, '#fff', 6) +
    `<ellipse cx="400" cy="420" rx="90" ry="44" fill="none" stroke="#fff" stroke-width="6"/>` +
    rect(330, 252, 140, 18, '#fff') +
    `<rect x="300" y="520" width="200" height="50" fill="none" stroke="#fff" stroke-width="6"/>` +
    `<rect x="340" y="290" width="120" height="30" fill="none" stroke="#fff" stroke-width="5"/>` +
    circle(400, 420, 12, '#fff'),

  'Salón de eventos': (p) =>
    rect(0, 0, W, 360, '#2a2436') + rect(0, 360, W, 240, '#6a5a48') +
    // escenario
    rect(180, 250, 440, 120, '#4a2f3c', 6) + rect(180, 360, 440, 14, '#2b1d25') + rect(200, 140, 400, 110, '#1e1a28', 6) + rect(220, 155, 360, 80, p.accent, 6) +
    // guirnalda de luces
    `<path d="M 0 40 Q 200 130 400 40 T 800 40" fill="none" stroke="#444" stroke-width="3"/>` +
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => circle(30 + i * 61, 62 + Math.sin(i * 0.9) * 22, 8, '#ffd76a')).join('') +
    // mesas redondas con mantel y sillas
    [[160, 480], [400, 520], [640, 480]].map(([x, y]) =>
      [0, 1, 2, 3, 4, 5].map((i) => circle(x + Math.cos(i * 1.047) * 78, y + Math.sin(i * 1.047) * 34 - 6, 15, '#d8d2c4')).join('') +
      ellipse(x, y + 12, 62, 24, '#c8c2b4') + ellipse(x, y, 62, 24, '#fafafa') + circle(x, y - 8, 10, p.accent) + line(x, y - 8, x, y - 30, '#3f8f4f', 3),
    ).join(''),

  Taller: (p) =>
    rect(0, 0, W, 400, '#d8d2c6') + rect(0, 400, W, 200, '#8c8c8c') +
    // panel de herramientas
    rect(60, 60, 320, 230, '#9a6b45', 6) +
    [0, 1, 2, 3, 4, 5].map((i) => circle(90 + i * 48, 90, 4, 'rgba(0,0,0,.4)')).join('') +
    rect(90, 110, 14, 100, '#777', 3) + rect(80, 100, 34, 20, p.accent, 3) +
    rect(150, 110, 90, 12, '#999') + rect(150, 122, 90, 6, '#555') +
    `<circle cx="300" cy="140" r="30" fill="none" stroke="#333" stroke-width="8"/>` +
    rect(90, 230, 90, 14, '#333', 3) + rect(210, 220, 120, 10, '#c4452d', 3) + rect(330, 210, 14, 60, '#333', 3) +
    // estante
    rect(470, 70, 260, 10, p.wood) + rect(470, 170, 260, 10, p.wood) + rect(470, 270, 260, 10, p.wood) +
    rect(490, 20, 70, 50, '#c9a15a', 4) + rect(580, 30, 80, 40, p.accent, 4) +
    rect(490, 120, 90, 50, '#c9a15a', 4) + rect(620, 130, 90, 40, '#6a8fa8', 4) +
    rect(500, 220, 60, 50, '#7a8a5a', 4) + rect(590, 215, 110, 55, '#c9a15a', 4) +
    // banco de trabajo con tornillo de banco
    rect(120, 390, 560, 30, p.wood, 4) + rect(140, 420, 22, 130, '#3b2a1c') + rect(638, 420, 22, 130, '#3b2a1c') +
    rect(180, 360, 70, 30, '#555', 4) + rect(160, 348, 24, 42, '#333', 3) +
    rect(380, 368, 120, 22, '#c4452d', 3) + rect(500, 372, 60, 14, '#aaa', 3) +
    ellipse(400, 560, 260, 20, 'rgba(0,0,0,.15)'),
};

/** SVG de la foto de un espacio según su tipo. `variant` (0, 1, 2…) cambia la paleta. */
export function seedPhotoSvg(typeName: string, variant = 0): string {
  const palette = PALETTES[variant % PALETTES.length];
  const scene = SCENES[typeName];
  if (!scene) throw new Error(`No hay foto de seed para el tipo "${typeName}"`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${typeName}">${scene(palette)}</svg>`;
}
