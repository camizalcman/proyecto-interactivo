// ─────────────────────────────────────────────────────────────
// MEDIAPIPE
// Inicialización de MediaPipe Hands y la cámara.
// onResults conecta todos los módulos: recibe los datos de
// MediaPipe y llama a las funciones de manos.js, paleta.js,
// gestos.js y canvas.js para que cada uno haga su parte.
// Depende de: todos los archivos anteriores.
// ─────────────────────────────────────────────────────────────

/* FUNCIÓN onResults: MediaPipe la llama automáticamente en cada frame del video (aproximadamente 30 veces por segundo), recibe un objeto "results" con toda la información detectada */

// Estado por slot para detectar el "pulgar arriba" como flanco (disparo único):
// el cronómetro solo arranca si el gesto se mantiene varios frames seguidos
// (CONFIG.FRAMES_PULGAR_ARRIBA), así un falso positivo de un solo frame no lo activa
// y tampoco se reinicia continuamente mientras se mantiene el gesto.
const thumbsupFrames = [0, 0, 0, 0];

// Frames seguidos con el gesto de "L" (índice estirado + pulgar arriba) antes
// de frenar el cronómetro (CONFIG.FRAMES_FELICITACION). Mismo criterio
// anti-falsos-positivos.
let felicitacionesFrames = 0;

// Disparo único estilo "pulgar arriba": la celebración se dispara una sola vez
// y no se vuelve a disparar hasta que la mano vuelva a bajar (elemento
// rearmado). Si no, con la mano sostenida el mensaje nunca se iría.
let felicitacionDisparada = false;

// Para diagnóstico: sólo logueamos cuando cambia el estado de detección,
// no en cada frame.
let ultimoLogFinalizar = null;

// ─────────────────────────────────────────────────────────────
// DEBUG DE GESTOS (opcional)
// Abrí la página con ?debug al final (ej.: index.html?debug) y abajo a la
// izquierda aparece, en vivo, qué dedos ve extendidos MediaPipe y qué gesto
// queda detectado:  dedos 1010 pulgar 0 → tresDedos
// Sirve para ver POR QUÉ un gesto no se dispara, en vez de adivinar.
// Los mismos datos van a la consola (solo cuando cambian, no cada frame).
// ─────────────────────────────────────────────────────────────
const DEBUG_GESTOS = /(^|[?&])debug/.test(location.search);
let debugUltimaLinea = '';
let debugGestos = null;

if (DEBUG_GESTOS) {
  debugGestos = document.createElement('div');
  Object.assign(debugGestos.style, {
    position:      'fixed',
    left:          '10px',
    bottom:        '10px',
    padding:       '6px 10px',
    background:    'rgba(0, 0, 0, 0.75)',
    color:         '#7CFC00',
    font:          '12px monospace',
    whiteSpace:    'pre',
    pointerEvents: 'none',
    zIndex:        '2147483647',
  });
  document.body.appendChild(debugGestos);
}

function actualizarDebugGestos(landmarks, gestoActual) {
  if (!DEBUG_GESTOS) return;
  const d = dedosExtendidos(landmarks);
  const linea = `dedos ${d.map(v => v ? 1 : 0).join('')}  pulgar ${pulgarExtendido(landmarks) ? 1 : 0}  ->  ${gestoActual}`;
  if (linea === debugUltimaLinea) return; // sólo escribo si cambió algo
  debugUltimaLinea = linea;
  debugGestos.textContent = linea;
  console.log('[dedos]', linea);
}

function onResults(results) {
  // La capa de interfaz (paleta) se borra entera en cada frame y se vuelve a
  // dibujar: así no queda "pintada" encima del dibujo de los frames anteriores.
  limpiarOverlay();

  redibujarPlantillaActiva(); 
  dibujarMenu();              

  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    last.forEach(l => { l.x = null; l.y = null; });
    suavizado.forEach(s => { s.x = null; s.y = null; });
    cursores.forEach(c => c.style.display = 'none');
    cursorBorrador.style.display = 'none'; // ← ACÁ
    cerrarPaleta(); // sin mano no hay puntero: el anillo tampoco queda colgado
    felicitacionesFrames = 0;
    felicitacionDisparada = false;
    estado.textContent = 'Mostrá tu mano a la cámara';
    if (DEBUG_GESTOS) debugGestos.textContent = 'sin manos';
    return;
  }

  // GESTO DE FINALIZAR: el gesto de "L" (índice estirado + pulgar arriba,
  // resto doblado) frenan el cronómetro, borran el dibujo y muestran
  // "¡Felicitaciones!". El contador tolera parpadeos: si un frame no se lee
  // el gesto, baja de a uno en vez de resetear a cero (mismo criterio que las
  // "faltas" de dibujar/borrar).
  const gestoLDetectado = results.multiHandLandmarks.some(gestoL);

  const logFinalizar = `${results.multiHandLandmarks.length}:${gestoLDetectado}`;
  if (ultimoLogFinalizar !== logFinalizar) {
    ultimoLogFinalizar = logFinalizar;
    console.log('[finalizar] manos detectadas:', results.multiHandLandmarks.length,
      '| gesto L detectado:', gestoLDetectado);
  }

  if (gestoLDetectado) {
    // Solo se dispara con el flanco (gesto recién levantado), una sola vez.
    // Mientras se mantenga el gesto no se vuelve a activar ni reinicia los 5 s.
    if (!felicitacionDisparada) {
      felicitacionesFrames = Math.min(felicitacionesFrames + 1, CONFIG.FRAMES_FELICITACION * 2);
      if (felicitacionesFrames === CONFIG.FRAMES_FELICITACION) {
        felicitacionDisparada = true;
        console.log('[finalizar] gesto L detectado: freno el cronómetro');
        frenarCronometro();
      }
    }
  } else {
    // Mano bajada (o gesto distinto): se rearma el disparo y el contador.
    felicitacionesFrames = 0;
    felicitacionDisparada = false;
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
      faltasBorra[slot] = 0;
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

    // Si hay un gesto de "L" (finalizar), ningún dedo acciona dibujar/borrar:
    // es el momento de celebración, no de limpiar el canvas.
    const gestoActual = gestoLDetectado ? 'pausa' : gesto(landmarks);

    // Muestra (solo con ?debug) qué dedos se ven extendidos y qué se detectó.
    actualizarDebugGestos(landmarks, gestoActual);

// ── PALETA DE COLORES ALREDEDOR DEL PUNTERO ────────────────
    // Con el gesto de 3 dedos (índice + medio + anular) aparece un anillo
    // de colores clavado en el punto donde se hizo el gesto. Después elige
    // el mismo puntero: en cuanto pisa un color, lo elige, el anillo
    // desaparece y el dibujo sigue (sin volver a esperar la carga).
    actualizarPaleta(gestoActual, x, y);

    if (paletaVisible) {
      // Con la paleta abierta la mano no dibuja ni borra: solo elige color.
      cursorBorrador.style.display = 'none';
      anillosCarga[slot].svg.style.display  = 'none';
      anillosDibujo[slot].svg.style.display = 'none';
      cargaBorrador[slot].start    = null; // el borrador no queda a medio cargar
      cargaBorrador[slot].progreso = 0;

      // El puntero queda blanco y visible: es el cursor de la paleta.
      cursores[slot].style.borderColor = 'white';
      cursores[slot].style.opacity = '1';

      // En cuanto el puntero pisa un color: se elige y se cierra la paleta.
      const elegido = seleccionarColorPaleta(x, y);
      if (elegido) {
        cerrarPaleta();
        if (elegido !== colorActual) {
          colorActual = elegido;
          mostrarCambioColor(x, y); // círculo relleno + ✓ en la posición de la mano
        }
      }

      // Cortamos el trazo para que al volver a dibujar no aparezca un
      // garabato largo desde el punto anterior hasta el actual.
      last[slot].x = null;
      last[slot].y = null;
return; // este frame la mano se dedicó a la paleta
    }

    // PULGAR ARRIBA → arranca el cronómetro. Solo arranca si el gesto se
    // mantiene FRAMES_PULGAR_ARRIBA frames seguidos; al soltarlo el contador
    // vuelve a cero y queda listo para volver a arrancarlo.
    if (gestoActual === 'thumbsup') {
      thumbsupFrames[slot]++;
      if (thumbsupFrames[slot] === CONFIG.FRAMES_PULGAR_ARRIBA) {
        iniciarCronometro();
      }
    } else {
      thumbsupFrames[slot] = 0;
    }

    // Si el gesto NO es de borrar, cancelamos la carga del borrador:
    // toleramos unos frames de fluctuación (faltasBorra) antes de resetear,
    // así un parpadeo del reconocimiento no corta la carga.
    if (gestoActual !== 'borra') {
      faltasBorra[slot]++;
      if (faltasBorra[slot] > MAX_FALTAS_BORRA) {
        anillosCarga[slot].svg.style.display = 'none';
        cargaBorrador[slot].start    = null;
        cargaBorrador[slot].progreso = 0;
      }
    } else {
      faltasBorra[slot] = 0; // volvió el borrador, resetea el contador de faltas
    }

    // El anillo de carga del DIBUJO solo se muestra mientras se dibuja.
    // No reseteamos su progreso acá: eso pasa recién cuando la mano dejó
    // de dibujar de verdad (tras la tolerancia de cortes, en el else), así
    // un parpadeo de un frame no obliga a recargar todo el tiempo.
    if (gestoActual !== 'dibuja') {
      anillosDibujo[slot].svg.style.display = 'none';
    }

    if (gestoActual === 'dibuja') {
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
      // La mano abierta no borra al instante: hay que mantenerla abierta hasta que
      // el anillo se llene (TIEMPO_CARGA_BORRADO_MS). Si se cierra antes,
      // se cancela la carga y no se borra nada.
      cursores[slot].style.display = 'none'; // en borrador no se muestra el puntero
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

      // Movemos el anillo de carga con la mano y actualizamos el relleno
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
      anillosDibujo[slot].svg.style.display = 'none'; // p. ej. con gesto de pausa

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

    // La selección de color la maneja la paleta radial de más arriba
  // (se abre con el gesto de 3 dedos y se elige con el puntero).

  verificarDwellMenu(x, y); 
  });

  // La paleta se dibuja sobre la capa de interfaz, que ya quedó limpia arriba:
  // así queda por encima de los trazos y nunca se acumula.
  dibujarPaleta();

  estado.textContent = paletaVisible ? 'Elegí un color' : 'Dibujando...';
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