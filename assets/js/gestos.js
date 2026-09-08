// ─────────────────────────────────────────────────────────────
// GESTOS
// Interpreta qué está haciendo la mano a partir de los landmarks.
// No depende de ningún otro archivo: recibe landmarks y devuelve strings.
// Para agregar un gesto nuevo, solo tocás este archivo.
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// PUNTOS (landmarks de MediaPipe Hands):
//   0 = muñeca
//   Pulgar: 1 CMC, 2 MCP, 3 IP, 4 punta
//   Índice: 5 CMC, 6 MCP, 7 PIP, 8 punta
//   Medio:  9 CMC, 10 MCP, 11 PIP, 12 punta
//   Anular: 13 CMC, 14 MCP, 15 PIP, 16 punta
//   Meñique:17 CMC, 18 MCP, 19 PIP, 20 punta
// ─────────────────────────────────────────────────────────────

// Un dedo está extendido cuando la punta queda MÁS LEJOS de la muñeca que su
// articulación intermedia (PIP). Al doblarse, la punta se acerca a la palma y
// queda más cerca que el PIP, por lo que no hay ambigüedad aunque la mano
// esté cerrada o relajada.
// Las distancias se calculan en 3D (x, y, z): si un dedo apunta hacia la cámara,
// con solo x/y su punta se proyecta "pegada" a la palma y parecería doblado.
const MAPA_DEDOS = [
  { punta: 8,  pip: 7  },  // índice (8 punta, 7 articulación intermedia)
  { punta: 12, pip: 11 },  // medio
  { punta: 16, pip: 15 },  // anular
  { punta: 20, pip: 19 },  // meñique
];

// Distancia euclidiana 3D entre dos landmarks (MediaPipe provee x, y y z).
function dist3D(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function dedosExtendidos(landmarks) {
  const palma = landmarks[0]; // muñeca, referencia
  return MAPA_DEDOS.map(({ punta, pip }) => {
    const distPunta = dist3D(landmarks[punta], palma);
    const distPip   = dist3D(landmarks[pip], palma);
    // El dedo está EXTENDIDO si la punta queda más lejos de la muñeca que el PIP
    // (articulación intermedia). Al doblarse, la punta se acerca a la palma y
    // queda MÁS CERCA que el PIP -> se cuenta como doblado sin ambigüedad.
    return distPunta > distPip;
  });
}

// El pulgar está extendido cuando su punta (4) queda más lejos de la muñeca
// que su articulación IP (3). Mismo criterio que los demás dedos, en 3D.
function pulgarExtendido(landmarks) {
  const palma = landmarks[0]; // muñeca, referencia
  return dist3D(landmarks[4], palma) > dist3D(landmarks[3], palma);
}

// Determina el gesto de la mano según los dedos extendidos:
// - Solo el índice extendido (8-7-6)                  → 'dibuja'
// - Pulgar arriba (pulgar extendido, resto doblado)   → 'thumbsup'
// - Índice (8-7-6) + medio (12-11-10) extendidos      → 'pausa' (frena el trazo)
// - Mano abierta (los 5 dedos extendidos)             → 'borra'
// - Cualquier otra combinación (gesto ambiguo)         → 'pausa' (por seguridad)
function gesto(landmarks) {
  const [indice, medio, anular, meñique] = dedosExtendidos(landmarks);

  const soloIndice      = indice && !medio && !anular && !meñique;
  const indiceYMedio    = indice && medio && !anular && !meñique;
  const todosExtendidos = indice && medio && anular && meñique;

  // 1) Pulgar arriba se verifica primero.
  if (pulgarArriba(landmarks)) return 'thumbsup';
  // 2) Solo índice: dedo para dibujar.
  if (soloIndice)              return 'dibuja';
  // 3) Índice + medio: frenar el trazo.
  if (indiceYMedio)            return 'pausa';
  // 4) Mano abierta: borrador. Piden los 5 dedos estirados, EL PULGAR INCLUIDO.
  if (todosExtendidos && pulgarExtendido(landmarks)) return 'borra';

  return 'pausa';
}

// Detecta el gesto de "pulgar arriba": el pulgar extendido mientras
// los otros 4 dedos están doblados. Además de estar extendido, la punta del
// pulgar tiene que quedar DESPEGADA del índice: si el pulgar está apoyado contra
// el índice o la palma, el gesto es otro (p. ej. índice levantado), no pulgar arriba.
function pulgarArriba(landmarks) {
  const [indice, medio, anular, meñique] = dedosExtendidos(landmarks);

  // La punta del pulgar debe quedar más lejos del índice (MCP, 5) que la IP (3):
  // si quedó pegada al índice, es "dedo índice levantado", no pulgar arriba.
  const pulgarDespegado = dist3D(landmarks[4], landmarks[5]) > dist3D(landmarks[3], landmarks[5]);

  return pulgarExtendido(landmarks) && pulgarDespegado && !indice && !medio && !anular && !meñique;
}

// Detecta el gesto de "L" (dedo índice estirado + pulgar formando un ángulo
// recto con el índice: pulgar hacia arriba, índice horizontal, otros 3 dedos
// doblados). Se distingue del "solo índice" (dibuja) por la posición del
// pulgar: en la "L" el pulgar queda bien estirado y PERPENDICULAR al índice
// (cos ≈ 0). Si el pulgar está pegado o doblado, el ángulo no coincide y el
// gesto NO se cuenta como L.
function gestoL(landmarks) {
  if (!landmarks || landmarks.length < 21) return false;
  if (!landmarks.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z))) return false;

  const [indice, medio, anular, meñique] = dedosExtendidos(landmarks);
  // Índice estirado y los otros 3 doblados hacia adentro.
  if (!indice || medio || anular || meñique) return false;

  // Vector del índice: MCP (5) → punta (8)
  const vix = landmarks[8].x - landmarks[5].x;
  const viy = landmarks[8].y - landmarks[5].y;
  const viz = landmarks[8].z - landmarks[5].z;

  // Vector del pulgar: MCP (2) → punta (4)
  const vpx = landmarks[4].x - landmarks[2].x;
  const vpy = landmarks[4].y - landmarks[2].y;
  const vpz = landmarks[4].z - landmarks[2].z;

  const magIndice = Math.hypot(vix, viy, viz);
  const magPulgar = Math.hypot(vpx, vpy, vpz);
  if (magIndice < 1e-6 || magPulgar < 1e-6) return false;

  // El pulgar debe estar bien ESTIRADO: su vector no puede ser mucho más corto
  // que el del índice. Un pulgar doblado hacia la palma queda corto → no es L.
  if (magPulgar < magIndice * 0.5) return false;

  // Ángulo entre pulgar e índice: en la "L" son perpendiculares (cos ≈ 0).
  // Solo con el índice estirado, el pulgar doblado apunta en otra dirección y
  // no pasa el chequeo. COSENO_MAX_GESTO_L = 0.35 ≈ entre 70° y 110°.
  const cosAngulo = Math.abs((vix * vpx + viy * vpy + viz * vpz) / (magIndice * magPulgar));
  return cosAngulo < CONFIG.COSENO_MAX_GESTO_L;
}