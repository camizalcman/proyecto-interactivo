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