// ─────────────────────────────────────────────────────────────
// MANOS
// Maneja el estado persistente de cada mano entre frames:
// posición anterior, suavizado, cursores visuales y emparejamiento.
// Depende de: config.js (CONFIG)
// ─────────────────────────────────────────────────────────────

const video  = document.getElementById('video');
const cursor = document.getElementById('cursor');  // ya no se usa solo, ahora creamos un cursor por mano
const estado = document.getElementById('estado');

/* VARIABLES DE DIBUJO: guardan la posición del dedo en el frame anterior y se usan para dibujar una línea desde ahí hasta la posición actual. Cuando son null significa que no hay trazo activo */
const last = [
  { x: null, y: null },  // mano 0
  { x: null, y: null },  // mano 1
  { x: null, y: null },  // mano 2
  { x: null, y: null },  // mano 3
];

// CURSORES POR MANO: en vez de un solo div #cursor, creamos uno por cada mano posible (hasta 4)
const cursores = [];
for (let i = 0; i < 4; i++) {
  const div = document.createElement('div');
  div.className = 'cursor-mano';
  div.style.position = 'fixed';
  div.style.width = '20px';
  div.style.height = '20px';
  div.style.borderRadius = '50%';
  div.style.border = '3px solid white';
  div.style.transform = 'translate(-50%, -50%)';
  div.style.pointerEvents = 'none';
  div.style.display = 'none';
  div.style.zIndex = '999';
  document.body.appendChild(div);
  cursores.push(div);
}

// SUAVIZADO: guarda la posición filtrada anterior de cada mano para reducir el jitter (temblor) del modelo
const suavizado = [
  { x: null, y: null },
  { x: null, y: null },
  { x: null, y: null },
  { x: null, y: null },
];
const FACTOR_SUAVIZADO = CONFIG.FACTOR_SUAVIZADO; // 0 = sin suavizado (crudo), 1 = muy suavizado (más lag)

// CONTADOR DE FRAMES PERDIDOS POR MANO: si una mano deja de detectarse
// por culpa de una oclusión momentánea (ej: se cruza con otra mano),
// no queremos olvidarla enseguida -> le damos un margen de unos frames
// antes de borrar su posición y "soltar" su slot.
const framesPerdidos = [0, 0, 0, 0];
const MAX_FRAMES_PERDIDOS = CONFIG.MAX_FRAMES_PERDIDOS; // ~250ms a 30fps de tolerancia

// CONTADOR DE "FALTAS" DE DIBUJO por mano: cada frame que la mano está presente
// pero NO con el gesto de dibujo se suma; si vuelve a dibujar se resetea. Sirve
// para no cortar el trazo ante un parpadeo del reconocimiento de gestos.
const faltasDibuja = [0, 0, 0, 0];
const MAX_FALTAS_DIBUJA = CONFIG.MAX_FALTAS_DIBUJA;

// Distancia máxima (px) entre el último punto y el nuevo para empalmar el trazo
// cuando la mano se perdió y reapareció (GAP_MAX en config.js).
const GAP_MAX = CONFIG.GAP_MAX;

// ──────────────────────────────────────────────────────────────
// EMPAREJAMIENTO DE MANOS ENTRE FRAMES
// MediaPipe no garantiza que el índice de una mano se mantenga
// igual entre un frame y el siguiente. Esta función asigna cada
// mano detectada al "slot" (0-3) cuya posición anterior esté más
// cerca, para que last/suavizado no se mezclen entre manos.
// ──────────────────────────────────────────────────────────────
const UMBRAL_MAX_DISTANCIA = CONFIG.UMBRAL_MAX_DISTANCIA; // px. Si nada quedó tan cerca, se considera mano nueva

function emparejarManos(deteccionesCrudas) {
  // deteccionesCrudas: array de {x, y} en píxeles, en el orden que vino este frame
  const asignacion = new Array(deteccionesCrudas.length).fill(-1);

  // Generamos todos los pares posibles (detección, slot-vivo) con su distancia
  const candidatos = [];
  deteccionesCrudas.forEach((det, idxDet) => {
    for (let slot = 0; slot < 4; slot++) {
      if (suavizado[slot].x !== null) {
        const dist = Math.hypot(det.x - suavizado[slot].x, det.y - suavizado[slot].y);
        candidatos.push({ idxDet, slot, dist });
      }
    }
  });

  // Ordenamos por distancia ascendente: primero emparejamos lo más obvio
  candidatos.sort((a, b) => a.dist - b.dist);

  const slotsUsados       = new Set();
  const deteccionesUsadas = new Set();

  candidatos.forEach(c => {
    if (slotsUsados.has(c.slot) || deteccionesUsadas.has(c.idxDet)) return;
    if (c.dist > UMBRAL_MAX_DISTANCIA) return; // muy lejos, no es la misma mano
    asignacion[c.idxDet] = c.slot;
    slotsUsados.add(c.slot);
    deteccionesUsadas.add(c.idxDet);
  });

  // Las detecciones sin pareja (manos nuevas, o que reaparecieron lejos) reciben el primer slot libre
  deteccionesCrudas.forEach((det, idxDet) => {
    if (asignacion[idxDet] === -1) {
      for (let slot = 0; slot < 4; slot++) {
        if (!slotsUsados.has(slot)) {
          asignacion[idxDet] = slot;
          slotsUsados.add(slot);
          break;
        }
      }
    }
  });

  return { asignacion, slotsUsados };
}

// CURSOR DEL BORRADOR: un div separado que se mueve con la mano
// cuando el gesto es 'borra'. No se dibuja en el canvas,
// así no deja rastro. Se muestra/oculta desde mediapipe.js
const cursorBorrador = document.createElement('div');
cursorBorrador.id = 'cursor-borrador';
Object.assign(cursorBorrador.style, {
  position:        'fixed',
  width:           (CONFIG.RADIO_BORRADO * 2) + 'px',
  height:          (CONFIG.RADIO_BORRADO * 2) + 'px',
  borderRadius:    '50%',
  background:      'rgba(255, 255, 255, 0.4)',
  border:          '2px solid rgba(255, 255, 255, 0.9)',
  transform:       'translate(-50%, -50%)',
  pointerEvents:   'none',
  display:         'none',
  zIndex:          '999',
});
document.body.appendChild(cursorBorrador);

// ANILLO DE CARGA DEL BORRADOR: cuando hacés puño no borrás al instante.
// Se muestra un anillo alrededor del puño que se va "rellenando" (se dibuja
// su borde) durante TIEMPO_CARGA_BORRADO_MS. Recién cuando el borde está
// completo, el puño se vuelve borrador. Si soltás antes, no borra nada.
// Hay uno por mano (slot), como los cursores.
const anillosCarga = [];

// Estado de la carga de la PINZA/BORRADOR por slot: start = timestamp del
// inicio de la carga, progreso = 0 (recién arrancó) a 1 (listo).
const cargaBorrador = [
  { start: null, progreso: 0 },
  { start: null, progreso: 0 },
  { start: null, progreso: 0 },
  { start: null, progreso: 0 },
];

// ANILLO DE CARGA DEL DIBUJO: el puntero de dibujo también "carga" antes de
// activarse (TIEMPO_CARGA_DIBUJO_MS), igual que el borrador pero más chico.
const anillosDibujo = [];
const RADIO_ANILLO_DIBUJO = 18; // px, un poco más grande que el cursor

// Estado de la carga del DIBUJO por slot.
const cargaDibujo = [
  { start: null, progreso: 0 },
  { start: null, progreso: 0 },
  { start: null, progreso: 0 },
  { start: null, progreso: 0 },
];

// Crea un anillo de carga SVG genérico. R = radio del anillo,
// grosor = ancho del borde. Devuelve el svg, el círculo de progreso
// y su circunferencia (para animar con dashoffset).
function crearAnillo(R, grosor) {
  const d = R * 2;
  const r = R - 4;
  const C = 2 * Math.PI * r; // circunferencia del círculo de progreso

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  Object.assign(svg.style, {
    position:      'fixed',
    pointerEvents: 'none',
    display:       'none',
    zIndex:        '999',
  });
  svg.setAttribute('width', d);
  svg.setAttribute('height', d);
  svg.setAttribute('viewBox', `0 0 ${d} ${d}`);

  // Borde de fondo (tenue) para saber dónde va a quedar el anillo completo
  const fondo = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  fondo.setAttribute('cx', R);
  fondo.setAttribute('cy', R);
  fondo.setAttribute('r', r);
  fondo.setAttribute('fill', 'none');
  fondo.setAttribute('stroke', 'rgba(255, 255, 255, 0.3)');
  fondo.setAttribute('stroke-width', grosor);

  // Borde de progreso: con dasharray/dashoffset se va "rellenando"
  const progreso = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  progreso.setAttribute('cx', R);
  progreso.setAttribute('cy', R);
  progreso.setAttribute('r', r);
  progreso.setAttribute('fill', 'none');
  progreso.setAttribute('stroke', '#ffffff');
  progreso.setAttribute('stroke-width', grosor);
  progreso.setAttribute('stroke-linecap', 'round');
  progreso.setAttribute('transform', `rotate(-90 ${R} ${R})`); // arranca arriba
  progreso.setAttribute('stroke-dasharray', C);
  progreso.setAttribute('stroke-dashoffset', C); // comienza vacío

  svg.appendChild(fondo);
  svg.appendChild(progreso);
  document.body.appendChild(svg);

  return { svg, progreso, C, R };
}

for (let i = 0; i < 4; i++) {
  anillosCarga.push(crearAnillo(CONFIG.RADIO_BORRADO, 6));
  anillosDibujo.push(crearAnillo(RADIO_ANILLO_DIBUJO, 4));
}