// ─────────────────────────────────────────────────────────────
// MEDIAPIPE
// Inicialización de MediaPipe Hands y la cámara.
// onResults conecta todos los módulos: recibe los datos de
// MediaPipe y llama a las funciones de manos.js, paleta.js,
// gestos.js y canvas.js para que cada uno haga su parte.
// Depende de: todos los archivos anteriores.
// ─────────────────────────────────────────────────────────────

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
    cursores[slot].style.borderColor = colorActual;

    const gestoActual       = gesto(landmarks);
    const fueraDeZonaPaleta = !dentroDeZona(x, y, zonaPaleta);

    if (gestoActual === 'dibuja' && fueraDeZonaPaleta) {
      if (last[slot].x !== null) {
        ctx.beginPath();
        ctx.moveTo(last[slot].x, last[slot].y);
        ctx.lineTo(x, y);
        ctx.strokeStyle = colorActual;
        ctx.lineWidth   = CONFIG.GROSOR_TRAZO;
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
      ctx.arc(x, y, CONFIG.RADIO_BORRADO, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      last[slot].x = x;
      last[slot].y = y;

    } else {
      last[slot].x = null;
      last[slot].y = null;
    }

    // Si CUALQUIER mano toca un color de la paleta, cambia el color GLOBAL
    // (afecta a todas las manos al mismo tiempo).
    paleta.forEach(c => {
      const distanciaColor = Math.hypot(x - c.x, y - c.y);
      if (distanciaColor < c.radio) {
        colorActual = c.color;
      }
    });
  });

  estado.textContent = 'Dibujando...';
}

// INICIALIZAR MEDIAPIPE HANDS
const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
  maxNumHands: CONFIG.MAX_MANOS,
  modelComplexity: CONFIG.MODEL_COMPLEXITY,           // 0 = más rápido pero menos preciso
                                                      // 1 = más preciso pero más lento
  minDetectionConfidence: CONFIG.MIN_DETECTION_CONFIDENCE,  // confianza mínima para considerar
                                                            // que detectó una mano (0 a 1)
  minTrackingConfidence: CONFIG.MIN_TRACKING_CONFIDENCE     // confianza mínima para seguir
                                                            // trackeando una mano ya detectada
});

hands.onResults(onResults);

// INICIALIZAR LA CÁMARA CON CAMERA UTILS
const camera = new Camera(video, {
  onFrame: async () => {
    await hands.send({ image: video });
  },
  width: CONFIG.CAMARA_ANCHO,   // resolución del stream de la cámara
  height: CONFIG.CAMARA_ALTO    // 720p es suficiente para esta etapa
});

camera.start()
  .then(() => {
    estado.textContent = 'Mostrá tu mano a la cámara';
  })
  .catch((err) => {
    estado.textContent = 'Error: ' + err.message;
    console.error('Error al iniciar la cámara:', err);
  });