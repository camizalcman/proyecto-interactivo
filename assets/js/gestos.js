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

// El meñique casi nunca queda 100% doblado cuando los otros tres dedos están
// arriba (la mano tiembla, el meñique se queda a medio camino, o el modelo lo
// lee "extendido"). Por eso acá exigimos que esté CLARAMENTE extendido: si la
// punta apenas le pasa a la articulación, lo contamos como doblado.
function meñiqueClaro(landmarks) {
  const palma = landmarks[0];
  const punta = dist3D(landmarks[20], palma);
  const pip   = dist3D(landmarks[19], palma);
  return punta > pip * 1.15;
}

// El pulgar está extendido cuando su punta (4) queda más lejos de la muñeca
// que su articulación IP (3). Mismo criterio que los demás dedos, en 3D.
function pulgarExtendido(landmarks) {
  const palma = landmarks[0]; // muñeca, referencia
  return dist3D(landmarks[4], palma) > dist3D(landmarks[3], palma);
}

// Un dedo está CLARAMENTE doblado cuando su punta queda bastante más cerca de la
// muñeca que su PIP. Con el criterio laxo de dedosExtendidos ("más cerca y
// listo") un dedo a medio extender ya cuenta como doblado, y por eso una mano en
// reposo o un puño medio cerrado se confundían con el gesto de pulgar arriba.
function dedosClaramenteDoblados(landmarks) {
  const palma = landmarks[0];
  return MAPA_DEDOS.map(({ punta, pip }) => {
    return dist3D(landmarks[punta], palma) < dist3D(landmarks[pip], palma) * 0.9;
  });
}

// El pulgar está BIEN ESTIRADO (no doblado sobre la palma) cuando:
//  a) la punta queda claramente más lejos de la muñeca que la IP, y
//  b) el tramo punta→IP es largo: si el pulgar está doblado, ese tramo se
//     encoge y queda mucho más corto que el tramo nudillo→IP.
function pulgarEstirado(landmarks) {
  const palma = landmarks[0];
  const cMC   = landmarks[1];
  const IP    = landmarks[3];
  const punta = landmarks[4];

  if (dist3D(punta, palma) <= dist3D(IP, palma) * 1.15) return false;
  if (dist3D(punta, IP) < dist3D(IP, cMC) * 0.7) return false;
  return true;
}

// El pulgar tiene que apuntar HACIA ARRIBA en la pantalla. Esta es la condición
// que se estaba FALTANDO y la causa de los falsos positivos: las distancias no
// dicen hacia dónde apunta el pulgar, así que el puño cerrado (con el pulgar
// cruzado sobre los dedos), el pulgar hacia un lado o hacia abajo, o una mano
// cualquiera relajada, también pasaban el chequeo de "pulgar extendido".
function pulgarApuntaArriba(landmarks) {
  const muñeca    = landmarks[0];
  const mcIndice = landmarks[5]; // nudillo del índice
  const ipIndice = landmarks[7]; // articulación del índice
  const punta    = landmarks[4];

  // Alto de la mano (en la imagen) para normalizar: los márgenes valen igual si
  // la mano está cerca o lejos de la cámara.
  const altoMano = Math.abs(muñeca.y - mcIndice.y) || 1e-6;

  // 1) La punta del pulgar tiene que quedar claramente POR ENCIMA de la muñeca.
  //    Si el pulgar apunta al costado o hacia abajo, la punta queda a la altura
  //    del nudillo del índice o más abajo → no cuenta.
  if (muñeca.y - punta.y < altoMano * 0.4) return false;

  // 2) Y claramente por encima de la articulación del índice. En un pulgar arriba
  //    de verdad la punta llega a la altura del nudillo del índice o más arriba;
  //    en el puño cerrado la punta queda a la altura de las articulaciones, más
  //    abajo. Acá se cae el puño cerrado.
  if (ipIndice.y - punta.y < altoMano * 0.5) return false;

  return true;
}

// Determina el gesto de la mano según los dedos extendidos:
// - Pulgar arriba (pulgar extendido, resto doblado)   → 'thumbsup'
// - Solo el índice extendido (8-7-6)                  → 'dibuja'
// - Índice (8-7-6) + medio (12-11-10) extendidos      → 'pausa' (frena el trazo)
// - Índice + medio + anular extendidos                → 'tresDedos' (abre la paleta)
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
  //    Va antes que la paleta para que la mano abierta nunca abra la paleta.
  if (todosExtendidos && pulgarExtendido(landmarks)) return 'borra';
  // 5) Los tres dedos del medio levantados (índice + medio + anular) abren la
  //    paleta. Al meñique no le exigimos que esté doblado: si está claramente
  //    arriba pero el pulgar NO lo está, también lo tomamos como gesto de la
  //    paleta (así no importa cómo el modelo lea ese dedo, tan dudoso).
  if (indice && medio && anular && !(meñiqueClaro(landmarks) && pulgarExtendido(landmarks))) {
    return 'tresDedos';
  }

  return 'pausa';
}

// Detecta el gesto de "pulgar arriba". Exige las CUATRO condiciones a la vez:
//   1) los otros 4 dedos CLARAMENTE doblados (puño cerrado, no a medio extender),
//   2) el pulgar bien ESTIRADO (no apoyado ni doblado sobre la palma),
//   3) el pulgar apuntando HACIA ARRIBA en la pantalla,
//   4) la punta del pulgar DESPEGADA del índice.
// Las cuatro juntas son lo que evita que arranque el cronómetro sin que el gesto
// sea un pulgar arriba de verdad: con menos condiciones, el puño cerrado, el
// pulgar hacia un lado o una mano en reposo contaban igual.
function pulgarArriba(landmarks) {
  if (!landmarks || landmarks.length < 21) return false;
  if (!landmarks.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z))) return false;

  // 1) Los 4 dedos bien doblados.
  if (!dedosClaramenteDoblados(landmarks).every(Boolean)) return false;

  // 2) El pulgar estirado.
  if (!pulgarEstirado(landmarks)) return false;

  // 3) El pulgar hacia arriba en la pantalla.
  if (!pulgarApuntaArriba(landmarks)) return false;

  // 4) La punta del pulgar debe quedar más lejos del nudillo del índice (5) que
  //    la IP (3): si quedó pegada al índice, es "índice levantado", no pulgar arriba.
  return dist3D(landmarks[4], landmarks[5]) > dist3D(landmarks[3], landmarks[5]) * 1.15;
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