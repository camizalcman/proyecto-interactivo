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
  redibujarPlantillaActiva(); 
  dibujarMenu();              

  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    last.forEach(l => { l.x = null; l.y = null; });
    suavizado.forEach(s => { s.x = null; s.y = null; });
    cursores.forEach(c => c.style.display = 'none');
    cursorBorrador.style.display = 'none'; // ← ACÁ
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
      // Sacamos los anillos de carga (borrador y dibujo) y cancelamos sus cargas
      // si la mano dejó de verse antes de completarlas.
      anillosCarga[slot].svg.style.display = 'none';
      cargaBorrador[slot].start    = null;
      cargaBorrador[slot].progreso = 0;
      anillosDibujo[slot].svg.style.display = 'none';
      cargaDibujo[slot].start    = null;
      cargaDibujo[slot].progreso = 0;

      framesPerdidos[slot]++;
      // Solo si pasó MUCHO tiempo sin verla, recién ahí cortamos el trazo y
      // la "olvidamos" de verdad (así su slot queda libre para otra mano).
      // Por unos frames no cortamos: así un parpadeo del modelo no parte la línea.
      if (framesPerdidos[slot] > MAX_FRAMES_PERDIDOS) {
        last[slot].x = null;
        last[slot].y = null;
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

    // Si el gesto NO es puño, cancelamos la carga del borrador de inmediato:
    // se oculta el anillo (para que no quede "frenado" en pantalla) y se
    // resetea el progreso (así la próxima vez arranca de cero).
    if (gestoActual !== 'borra') {
      anillosCarga[slot].svg.style.display = 'none';
      cargaBorrador[slot].start    = null;
      cargaBorrador[slot].progreso = 0;
    }

    // El anillo de carga del DIBUJO solo se muestra mientras se dibuja.
    // No reseteamos su progreso acá: eso pasa recién cuando la mano dejó
    // de dibujar de verdad (tras la tolerancia de cortes, en el else), así
    // un parpadeo de un frame no obliga a recargar todo el tiempo.
    if (gestoActual !== 'dibuja') {
      anillosDibujo[slot].svg.style.display = 'none';
    }

    if (gestoActual === 'dibuja' && fueraDeZonaPaleta) {
      // Al volver a dibujar nos aseguramos de ocultar el cursor del borrador
      // (si veníamos de borrar), para no confundir los dos modos.
      cursorBorrador.style.display = 'none';
      faltasDibuja[slot] = 0; // está dibujando, reseteamos el contador de faltas

      // ── CARGA DEL PUNTERO DE DIBUJO ──────────────────────────
      // El puntero también "carga" antes de activarse, como el borrador:
      // hay que mantener el índice extendido TIEMPO_CARGA_DIBUJO_MS.
      const ahoraD = performance.now();
      if (cargaDibujo[slot].start === null) {
        cargaDibujo[slot].start = ahoraD;
      }
      const TD = CONFIG.TIEMPO_CARGA_DIBUJO_MS;
      cargaDibujo[slot].progreso = Math.min(1, (ahoraD - cargaDibujo[slot].start) / TD);

      // Anillo de carga (más chico que el del borrador), con el color actual
      const anilloD = anillosDibujo[slot];
      anilloD.svg.style.display = 'block';
      anilloD.svg.style.left = (x - anilloD.R) + 'px';
      anilloD.svg.style.top  = (y - anilloD.R) + 'px';
      anilloD.progreso.setAttribute('stroke', colorActual);
      anilloD.progreso.setAttribute('stroke-dashoffset', anilloD.C * (1 - cargaDibujo[slot].progreso));

      if (cargaDibujo[slot].progreso >= 1) {
        // Activado: ya se puede dibujar
        anilloD.svg.style.display = 'none';
        cursores[slot].style.borderColor = colorActual;
        cursores[slot].style.opacity = '1';
        if (last[slot].x !== null) {
          const salto = Math.hypot(last[slot].x - x, last[slot].y - y);
          // Si la mano reapareció MUY lejos de donde estaba, no unimos con un
          // garabato largo: empezamos una línea nueva donde está ahora.
          if (salto <= GAP_MAX) {
            ctx.beginPath();
            ctx.moveTo(last[slot].x, last[slot].y);
            ctx.lineTo(x, y);
            ctx.strokeStyle = colorActual;
            ctx.lineWidth   = CONFIG.GROSOR_TRAZO; // grosor fijo
            ctx.lineCap     = 'round';
            ctx.lineJoin    = 'round';
            ctx.stroke();
          }
        }
        last[slot].x = x;
        last[slot].y = y;
      } else {
        // Cargando: NO dibuja todavía y corta el trazo para no unir puntos.
        cursores[slot].style.opacity = '0.5';
        last[slot].x = null;
        last[slot].y = null;
      }

    } else if (gestoActual === 'borra') {
      // ── BORRAR CON CARGA ─────────────────────────────────────
      // El puño no borra al instante: hay que mantenerlo cerrado hasta que
      // el anillo se llene (TIEMPO_CARGA_BORRADO_MS). Si se suelta antes,
      // se cancela la carga y no se borra nada.
      cursores[slot].style.display = 'none'; // en puño no se muestra el puntero
      // Al pasar a borrador, el puntero de dibujo vuelve a necesitar cargar
      // la próxima vez que se quiera dibujar.
      cargaDibujo[slot].start    = null;
      cargaDibujo[slot].progreso = 0;
      const ahora = performance.now();
      if (cargaBorrador[slot].start === null) {
        cargaBorrador[slot].start = ahora;
      }
      const T = CONFIG.TIEMPO_CARGA_BORRADO_MS;
      cargaBorrador[slot].progreso = Math.min(1, (ahora - cargaBorrador[slot].start) / T);

      // Movemos el anillo de carga con el puño y actualizamos el relleno
      const anillo = anillosCarga[slot];
      anillo.svg.style.display = 'block';
      anillo.svg.style.left = (x - CONFIG.RADIO_BORRADO) + 'px';
      anillo.svg.style.top  = (y - CONFIG.RADIO_BORRADO) + 'px';
      anillo.progreso.setAttribute('stroke-dashoffset', anillo.C * (1 - cargaBorrador[slot].progreso));

      // ¿Se completó la carga? Recién acá se vuelve borrador de verdad
      if (cargaBorrador[slot].progreso >= 1) {
        anillo.svg.style.display = 'none';
        cursores[slot].style.display = 'none';
        cursorBorrador.style.display = 'block';
        cursorBorrador.style.left    = x + 'px';
        cursorBorrador.style.top     = y + 'px';

        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(x, y, CONFIG.RADIO_BORRADO, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        last[slot].x = x;
        last[slot].y = y;
      } else {
        // Todavía cargando: NO borra y cortamos el trazo.
        last[slot].x = null;
        last[slot].y = null;
      }

    } else {
      cursorBorrador.style.display = 'none';
      // (La cancelación del anillo de cargas ya se hizo arriba)
      anillosDibujo[slot].svg.style.display = 'none'; // p. ej. si el dedo está sobre la paleta

      // Puntero INACTIVO: cuando la mano está extendida (o el gesto no es
      // dibujar/borrar), el puntero se ve blanco y casi transparente.
      cursores[slot].style.borderColor = 'white';
      cursores[slot].style.opacity = '0.3';

      // No cortamos la línea de golpe: toleramos unos frames con otro gesto
      // (parpadeo del reconocimiento). Recién tras MAX_FALTAS_DIBUJA cortamos
      // y, además, reseteamos la carga del puntero.
      faltasDibuja[slot]++;
      if (faltasDibuja[slot] > MAX_FALTAS_DIBUJA) {
        last[slot].x = null;
        last[slot].y = null;
        cargaDibujo[slot].start    = null;
        cargaDibujo[slot].progreso = 0;
      }
    }

    // Si CUALQUIER mano toca un color de la paleta, cambia el color GLOBAL
    // (afecta a todas las manos al mismo tiempo).
    paleta.forEach(c => {
      const distanciaColor = Math.hypot(x - c.x, y - c.y);
      if (distanciaColor < c.radio) {
        colorActual = c.color;
      }
    });

    verificarDwellMenu(x, y); 
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