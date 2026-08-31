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
const MAPA_DEDOS = [
  { punta: 8,  pip: 7  },  // índice (8 punta, 7 articulación intermedia)
  { punta: 12, pip: 11 },  // medio
  { punta: 16, pip: 15 },  // anular
  { punta: 20, pip: 19 },  // meñique
];

function dedosExtendidos(landmarks) {
  const palma = landmarks[0]; // muñeca, referencia
  return MAPA_DEDOS.map(({ punta, pip }) => {
    const distPunta = Math.hypot(landmarks[punta].x - palma.x, landmarks[punta].y - palma.y);
    const distPip   = Math.hypot(landmarks[pip].x - palma.x, landmarks[pip].y - palma.y);
    // El dedo está EXTENDIDO si la punta queda más lejos de la muñeca que el PIP
    // (articulación intermedia). Al doblarse, la punta se acerca a la palma y
    // queda MÁS CERCA que el PIP -> se cuenta como doblado sin ambigüedad.
    return distPunta > distPip;
  });
}

// Determina el gesto de la mano según los dedos extendidos:
// - Solo el índice extendido (8-7-6)                  → 'dibuja'
// - Pulgar arriba (pulgar extendido, resto doblado)   → 'thumbsup'
// - Índice (8-7-6) + medio (12-11-10) extendidos      → 'pausa' (frena el trazo)
// - Mano abierta (4 dedos extendidos)                 → 'borra'
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
  // 4) Mano abierta (los dedos por encima de la palma): borrador.
  if (todosExtendidos)         return 'borra';

  return 'pausa';
}

// Detecta el gesto de "pulgar arriba": el pulgar extendido mientras
// los otros 4 dedos están doblados.
function pulgarArriba(landmarks) {
  const palma = landmarks[0]; // muñeca, referencia
  const [indice, medio, anular, meñique] = dedosExtendidos(landmarks);

  // Pulgar extendido: la punta (4) más lejos de la muñeca que la punta IP (3)
  const distPulgarPunta = Math.hypot(landmarks[4].x - palma.x, landmarks[4].y - palma.y);
  const distPulgarIP    = Math.hypot(landmarks[3].x - palma.x, landmarks[3].y - palma.y);
  const pulgarExtendido = distPulgarPunta > distPulgarIP;

  return pulgarExtendido && !indice && !medio && !anular && !meñique;
}