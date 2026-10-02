// ─────────────────────────────────────────────────────────────
// PALETA DE COLORES
// La paleta NO está fija en un borde de la pantalla: aparece como un
// anillo de colores ALREDEDOR DEL PUNTERO cuando se detecta el gesto
// de 3 dedos (índice + medio + anular). El centro del anillo queda
// clavado donde se hizo el gesto y no se mueve: el puntero es el que
// viaja hasta un color, lo elige y la paleta desaparece al instante.
//
// Flujo completo:
//   1) actualizarPaleta(gesto, x, y)  → cuenta los frames del gesto de
//      3 dedos y, si se mantienen, abre el anillo (una sola vez).
//   2) seleccionarColorPaleta(x, y)   → devuelve el color bajo el puntero.
//   3) cerrarPaleta()                  → lo esconde y DESARMA el gesto:
//      no se puede volver a abrir hasta que el gesto se suelte, así
//      elegir un color no genera una paleta atrás de otra.
//   4) dibujarPaleta()                 → lo dibuja en cada frame.
//
// Se dibuja en el canvas de INTERFAZ (octx), no en el de dibujo: esa capa
// se borra entera en cada frame, así la paleta nunca queda "pintada"
// encima del dibujo.
//
// Depende de: config.js (CONFIG), canvas.js (octx, canvasOverlay), manos.js
// ─────────────────────────────────────────────────────────────

// COLOR GLOBAL: un solo color compartido por TODAS las manos.
// Si cualquier mano elige un color, cambia el color para todas.
// Esto evita que el color "salte" de una mano a otra cuando
// MediaPipe reasigna los slots entre frames.
let colorActual = CONFIG.COLOR_INICIAL;

const colores = CONFIG.COLORES;

// Estado del anillo: dónde está clavado el centro y si se está mostrando.
const paletaCentro = { x: 0, y: 0 };
let paletaVisible  = false;

// Frames "buenos" con el gesto de 3 dedos (con tolerancia a parpadeos).
let paletaFrames = 0;
let paletaMiss   = 0;

// Progreso de la apertura (0 a 1), para dibujar el anillo de carga.
let paletaCarga = 0;

// Timestamp de apertura, para cerrar el anillo solo si no se elige nada.
let paletaAbiertaMs = null;

// ARMADA: ¿el gesto está "en condiciones" de abrir la paleta? Se pone en false
// al cerrar y solo vuelve a true cuando el gesto de 3 dedos se suelta. Es lo
// que impide que, si la mano sigue con los 3 dedos arriba, la paleta se
// vuelva a abrir una y otra vez.
let paletaArmada = true;

// ── Posiciones de los colores ────────────────────────────────
// No son fijas: se calculan cada frame alrededor del centro del anillo,
// repartidas en círculo y arrancando hacia arriba (como una rueda de reloj).
function posicionesPaleta() {
  const paso = (Math.PI * 2) / colores.length;
  return colores.map((color, i) => {
    const angulo = -Math.PI / 2 + i * paso;
    return {
      x:     paletaCentro.x + Math.cos(angulo) * CONFIG.PALETA_RADIO_ANILLO,
      y:     paletaCentro.y + Math.sin(angulo) * CONFIG.PALETA_RADIO_ANILLO,
      radio: CONFIG.PALETA_RADIO,
      color: color
    };
  });
}

// Radio válido para "agarrar" un color: el círculo más un margen de tolerancia.
function radioTocado() {
  return CONFIG.PALETA_RADIO + CONFIG.PALETA_TOLERANCIA;
}

// ── Abrir / cerrar ───────────────────────────────────────────
// El centro se acota contra los bordes para que el anillo completo
// (centro + radio del anillo + radio del color) entre siempre en pantalla.
function limitarCentro(x, y) {
  const margen = CONFIG.PALETA_RADIO_ANILLO + CONFIG.PALETA_RADIO + CONFIG.PALETA_MARGEN_BORDE;
  const limiteX = Math.max(margen, canvasOverlay.width  - margen);
  const limiteY = Math.max(margen, canvasOverlay.height - margen);
  return {
    x: Math.min(Math.max(x, margen), limiteX),
    y: Math.min(Math.max(y, margen), limiteY)
  };
}

function abrirPaleta(x, y) {
  const c = limitarCentro(x, y);
  paletaCentro.x = c.x;
  paletaCentro.y = c.y;

  paletaVisible   = true;
  paletaCarga     = 1;
  paletaAbiertaMs = performance.now();
}

function cerrarPaleta() {
  paletaVisible   = false;
  paletaAbiertaMs = null;
  paletaCarga     = 0;
  paletaFrames    = 0;
  paletaMiss      = 0;
  paletaArmada    = false; // hay que soltar el gesto antes de volver a abrir
}

// ── Estado del gesto ─────────────────────────────────────────
// Se llama en cada frame con el gesto de la mano y la posición del puntero.
// Cuenta los frames del gesto de 3 dedos y abre el anillo una sola vez.
//
// El conteo TOLERA parpadeos: si un frame no leyó el gesto, el contador baja
// de a uno en vez de volver a cero (como MAX_FALTAS_DIBUJA con el dibujo).
// Sin esto, si MediaPipe titila entre "3 dedos" y "pausa" frame a frame, la
// paleta no abriría nunca aunque la mano esté bien hecha.
function actualizarPaleta(gestoActual, x, y) {
  if (gestoActual === 'tresDedos') {
    paletaMiss = 0;
    paletaFrames = Math.min(paletaFrames + 1, CONFIG.FRAMES_GESTO_PALETA);

    // Mientras carga, el anillo todavía no existe pero su centro sí sigue al
    // puntero: así el anillo de carga se ve donde va a aparecer el anillo.
    if (!paletaVisible) {
      const c = limitarCentro(x, y);
      paletaCentro.x = c.x;
      paletaCentro.y = c.y;
      if (paletaArmada && paletaFrames >= CONFIG.FRAMES_GESTO_PALETA) {
        abrirPaleta(x, y);
      }
    }
  } else {
    // Se soltó el gesto: rearma para la próxima apertura.
    paletaArmada = true;
    paletaMiss++;
    if (paletaMiss > CONFIG.MAX_FALTAS_PALETA) paletaFrames = 0;
  }

  paletaCarga = paletaFrames / CONFIG.FRAMES_GESTO_PALETA;

  // Autocierre: si nadie elige un color en un rato, el anillo se va solo.
  if (paletaVisible && paletaAbiertaMs !== null &&
      performance.now() - paletaAbiertaMs > CONFIG.PALETA_TIMEOUT_MS) {
    cerrarPaleta();
  }
}

// ── Elegir color ─────────────────────────────────────────────
// Devuelve el color que hay bajo el puntero (o null si no hay ninguno).
// Se consulta en CADA frame mientras la paleta está abierta: en cuanto el
// puntero pisa un color, ese color queda elegido y la paleta se cierra.
function seleccionarColorPaleta(x, y) {
  if (!paletaVisible) return null;

  const radio = radioTocado();
  for (const c of posicionesPaleta()) {
    if (Math.hypot(x - c.x, y - c.y) < radio) return c.color;
  }
  return null;
}

// ── Dibujar ──────────────────────────────────────────────────
// Se llama en cada frame. Si la paleta está cerrada no dibuja nada:
// no queda nada fijo en los bordes de la pantalla.
function dibujarPaleta() {
  // Antes de abrirse: se dibuja un anillo de carga alrededor del puntero. Sirve
  // para ver al instante que el gesto se está detectando (y si parpadea, se nota).
  if (!paletaVisible) {
    if (paletaCarga <= 0) return;
    octx.beginPath();
    octx.arc(paletaCentro.x, paletaCentro.y, 34,
             -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * paletaCarga);
    octx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    octx.lineWidth = 5;
    octx.lineCap = 'round';
    octx.stroke();
    return;
  }

  // Un CÍRCULO FINO que une los colores, para que se lea como un anillo.
  // Sin relleno: el dedo y el dibujo de abajo se siguen viendo en el centro.
  octx.beginPath();
  octx.arc(paletaCentro.x, paletaCentro.y, CONFIG.PALETA_RADIO_ANILLO, 0, Math.PI * 2);
  octx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  octx.lineWidth = 2;
  octx.stroke();

  posicionesPaleta().forEach(c => {
    const activo = c.color === colorActual;

    octx.beginPath();
    octx.arc(c.x, c.y, c.radio, 0, Math.PI * 2);
    octx.fillStyle = c.color;
    octx.fill();

    // El color con el que se está dibujando lleva un borde blanco más grueso,
    // así se sabe cuál está elegido sin tapar el color.
    if (activo) {
      octx.lineWidth = 4;
      octx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      octx.stroke();
    }
  });
}