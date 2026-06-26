const video  = document.getElementById('video');   
const canvas = document.getElementById('canvas');  
const ctx    = canvas.getContext('2d');            
const cursor = document.getElementById('cursor');  // ya no se usa solo, ahora creamos un cursor por mano
const estado = document.getElementById('estado');  


/* VARIABLES DE DIBUJO: guardan la posición del dedo en el frame anterior y se usan para dibujar una línea desde ahí hasta la posición actual. Cuando son null significa que no hay trazo activo */
const last = [
  { x: null, y: null },  // mano 0
  { x: null, y: null },  // mano 1
  { x: null, y: null },  // mano 2
  { x: null, y: null },  // mano 3
];

// COLOR POR MANO: cada mano guarda su propio color elegido, en vez de un solo color global
const colorPorMano = ['blue', 'red', 'green', 'orange'];

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
const FACTOR_SUAVIZADO = 0.5; // 0 = sin suavizado (crudo), 1 = muy suavizado (más lag)

// CONTADOR DE FRAMES PERDIDOS POR MANO: si una mano deja de detectarse
// por culpa de una oclusión momentánea (ej: se cruza con otra mano),
// no queremos olvidarla enseguida -> le damos un margen de unos frames
// antes de borrar su posición y "soltar" su slot.
const framesPerdidos = [0, 0, 0, 0];
const MAX_FRAMES_PERDIDOS = 8; // ~250ms a 30fps de tolerancia

// ──────────────────────────────────────────────────────────────
// EMPAREJAMIENTO DE MANOS ENTRE FRAMES
// MediaPipe no garantiza que el índice de una mano se mantenga
// igual entre un frame y el siguiente. Esta función asigna cada
// mano detectada al "slot" (0-3) cuya posición anterior esté más
// cerca, para que last/suavizado/color no se mezclen entre manos.
// ──────────────────────────────────────────────────────────────
const UMBRAL_MAX_DISTANCIA = 250; // px. Si nada quedó tan cerca, se considera mano nueva

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

  const slotsUsados = new Set();
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

const colores = ['red', '#e88802', 'yellow', '#65d72b', 'blue', '#50e8eb', '#f66c9c', '#9605d5'];
const espaciado = 80;

const paleta = colores.map((color, i) => ({
  x: 60,
  y: 60 + i * espaciado,
  radio: 30,
  color: color
}));

const zonaPaleta = {
  x: 60 - 40,   // un margen alrededor del primer círculo
  y: 60 - 40,
  ancho: 120,
  alto: colores.length * espaciado + 20
};

function dentroDeZona(x, y, zona) {
  return x >= zona.x && x <= zona.x + zona.ancho &&
         y >= zona.y && y <= zona.y + zona.alto;
}

// ──────────────────────────────────────────────────────────────
// GROSOR DEL BORRADO: este es el número que controla qué tan grande
// es el círculo que borra cuando hacés el gesto de puño cerrado.
// Cuanto más grande, más "ancho" borra de un solo pase.
// ──────────────────────────────────────────────────────────────
const RADIO_BORRADO = 50;

// AJUSTAR EL CANVAS AL TAMAÑO REAL DE LA PANTALLA
function ajustarCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}

ajustarCanvas();
window.addEventListener('resize', ajustarCanvas);

// BOTÓN LIMPIAR
document.getElementById('limpiar').addEventListener('click', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

//PALETA DE COLORES
function dibujarPaleta() {
  paleta.forEach(c => {
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.radio, 0, Math.PI * 2);
    ctx.fillStyle = c.color;
    ctx.fill();
  });
}


/* FUNCIÓN onResults: MediaPipe la llama automáticamente en cada frame del video (aproximadamente 30 veces por segundo), recibe un objeto "results" con toda la información detectada */

function onResults(results) {
  dibujarPaleta();

  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    last.forEach(l => { l.x = null; l.y = null; });
    suavizado.forEach(s => { s.x = null; s.y = null; });
    cursores.forEach(c => c.style.display = 'none');
    estado.textContent = 'Mostrá tu mano a la cámara';
    return;
  }

  // 1) Calculamos la posición cruda (en píxeles) de cada mano detectada este frame
  const deteccionesCrudas = results.multiHandLandmarks.map(landmarks => {
    const indice = landmarks[8];
    return {
      x: (1 - indice.x) * canvas.width,
      y: indice.y * canvas.height
    };
  });

  // 2) Emparejamos cada detección con el slot (mano persistente) correspondiente
  const { asignacion, slotsUsados } = emparejarManos(deteccionesCrudas);

    // 3) Slots que NO recibieron detección este frame
  for (let slot = 0; slot < 4; slot++) {
    if (!slotsUsados.has(slot)) {
      cursores[slot].style.display = 'none';
      // Cortamos el trazo apenas se pierde, para no dibujar una línea
      // larga y fea si la mano reaparece lejos de donde estaba.
      last[slot].x = null;
      last[slot].y = null;

      framesPerdidos[slot]++;
      // Solo si pasó MUCHO tiempo sin verla, recién ahí la "olvidamos"
      // de verdad (se borra su posición y queda libre para otra mano nueva).
      if (framesPerdidos[slot] > MAX_FRAMES_PERDIDOS) {
        suavizado[slot].x = null;
        suavizado[slot].y = null;
      }
    } else {
      framesPerdidos[slot] = 0; // se la volvió a ver, resetea el contador
    }
  }

  // 4) Procesamos cada mano detectada usando su SLOT, no su índice crudo de MediaPipe
  results.multiHandLandmarks.forEach((landmarks, idxDet) => {
    const slot = asignacion[idxDet];
    const { x: xCrudo, y: yCrudo } = deteccionesCrudas[idxDet];

    // SUAVIZADO
    if (suavizado[slot].x === null) {
      suavizado[slot].x = xCrudo;
      suavizado[slot].y = yCrudo;
    } else {
      suavizado[slot].x = suavizado[slot].x * FACTOR_SUAVIZADO + xCrudo * (1 - FACTOR_SUAVIZADO);
      suavizado[slot].y = suavizado[slot].y * FACTOR_SUAVIZADO + yCrudo * (1 - FACTOR_SUAVIZADO);
    }

    const x = suavizado[slot].x;
    const y = suavizado[slot].y;

    cursores[slot].style.display = 'block';
    cursores[slot].style.left = x + 'px';
    cursores[slot].style.top  = y + 'px';
    cursores[slot].style.borderColor = colorPorMano[slot];

    const gestoActual = gesto(landmarks);
    const fueraDeZonaPaleta = !dentroDeZona(x, y, zonaPaleta);

    if (gestoActual === 'dibuja' && fueraDeZonaPaleta) {
      if (last[slot].x !== null) {
        ctx.beginPath();
        ctx.moveTo(last[slot].x, last[slot].y);
        ctx.lineTo(x, y);
        ctx.strokeStyle = colorPorMano[slot];
        ctx.lineWidth   = 6;
        ctx.lineCap     = 'round';
        ctx.lineJoin    = 'round';
        ctx.stroke();
      }
      last[slot].x = x;
      last[slot].y = y;

    } else if (gestoActual === 'borra') {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x, y, RADIO_BORRADO, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      last[slot].x = x;
      last[slot].y = y;

    } else {
      last[slot].x = null;
      last[slot].y = null;
    }

    paleta.forEach(c => {
      const distanciaColor = Math.hypot(x - c.x, y - c.y);
      if (distanciaColor < c.radio) {
        colorPorMano[slot] = c.color;
      }
    });
  });

  estado.textContent = 'Dibujando...';
}

// Cuenta cuántos de los 4 dedos (índice, medio, anular, meñique) están EXTENDIDOS,
// comparando qué tan lejos está la punta de la palma respecto a la base del dedo.
function dedosExtendidos(landmarks) {
  const palma = landmarks[0]; // base de la muñeca, referencia de la palma

  const puntas = [8, 12, 16, 20]; // puntas de índice, medio, anular, meñique
  const bases  = [5, 9, 13, 17];  // nudillos de cada dedo

  return puntas.map((punta, idx) => {
    const distPunta = Math.hypot(landmarks[punta].x - palma.x, landmarks[punta].y - palma.y);
    const distBase  = Math.hypot(landmarks[bases[idx]].x - palma.x, landmarks[bases[idx]].y - palma.y);
    // Si la punta está MÁS LEJOS de la palma que la base, el dedo está extendido
    return distPunta > distBase;
  });
}

// Determina el gesto de la mano según cuántos dedos están extendidos:
// - Solo el índice extendido (los otros 3 doblados)  → 'dibuja'
// - Los 4 dedos extendidos (mano abierta)             → 'pausa'
// - Los 4 dedos doblados (puño cerrado)               → 'borra'
// - Cualquier otra combinación (gesto ambiguo)         → 'pausa' (por seguridad)
function gesto(landmarks) {
  const [indice, medio, anular, meñique] = dedosExtendidos(landmarks);

  const soloIndice = indice && !medio && !anular && !meñique;
  const todosExtendidos = indice && medio && anular && meñique;
  const todosDoblados = !indice && !medio && !anular && !meñique;

  if (soloIndice) return 'dibuja';
  if (todosDoblados) return 'borra';
  if (todosExtendidos) return 'pausa';

  return 'pausa'; // gesto intermedio/ambiguo → no hace nada, por seguridad
}

// INICIALIZAR MEDIAPIPE HANDS
const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
  maxNumHands: 4,               // cuántas manos detectar a la vez
  modelComplexity: 1,           // 0 = más rápido pero menos preciso
                                // 1 = más preciso pero más lento
  minDetectionConfidence: 0.7,  // confianza mínima para considerar
                                // que detectó una mano (0 a 1)
  minTrackingConfidence: 0.5    // confianza mínima para seguir
                                // trackeando una mano ya detectada
});

hands.onResults(onResults);

// INICIALIZAR LA CÁMARA CON CAMERA UTILS
const camera = new Camera(video, {
  onFrame: async () => {
    await hands.send({ image: video });
  },
  width: 1280,   // resolución del stream de la cámara
  height: 720    // 720p es suficiente para esta etapa
});

camera.start()
  .then(() => {
    estado.textContent = 'Mostrá tu mano a la cámara';
  })
  .catch((err) => {
    estado.textContent = 'Error: ' + err.message;
    console.error('Error al iniciar la cámara:', err);
  });