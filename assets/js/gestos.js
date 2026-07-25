// ─────────────────────────────────────────────────────────────
// GESTOS
// Interpreta qué está haciendo la mano a partir de los landmarks.
// No depende de ningún otro archivo: recibe landmarks y devuelve strings.
// Para agregar un gesto nuevo, solo tocás este archivo.
// ─────────────────────────────────────────────────────────────

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

  const soloIndice      = indice && !medio && !anular && !meñique;
  const todosExtendidos = indice && medio && anular && meñique;
  const todosDoblados   = !indice && !medio && !anular && !meñique;

  if (soloIndice)    return 'dibuja';
  if (todosDoblados) return 'borra';
  if (todosExtendidos) return 'pausa';

  return 'pausa'; // gesto intermedio/ambiguo → no hace nada, por seguridad
}