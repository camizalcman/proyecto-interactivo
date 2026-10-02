// ─────────────────────────────────────────────────────────────
// CANVAS
// Maneja el elemento canvas: tamaño, dibujo de trazos y borrado.
// Hay DOS capas:
//   - ctx  → el dibujo del usuario (persiste entre frames)
//   - octx → la capa de interfaz (la paleta), que se borra y se dibuja
//            de cero en cada frame. Por eso la paleta no se va "pintando"
//            encima del dibujo cada vez que se abre.
// Depende de nada; lo usan paleta.js y mediapipe.js.
// ─────────────────────────────────────────────────────────────

const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');

// CANVAS SUPERPUESTO: capa de interfaz para la paleta de colores. Está
// arriba del canvas de dibujo pero no intercepta el mouse.
// OJO con el nombre: cronometro.js ya usa una variable global "overlay"
// para su contador, así que esta se llama canvasOverlay para no chocar.
const canvasOverlay = document.getElementById('overlay');
const octx          = canvasOverlay.getContext('2d');

// AJUSTAR LOS CANVAS AL TAMAÑO REAL DE LA PANTALLA
function ajustarCanvas() {
  [canvas, canvasOverlay].forEach(c => {
    c.width  = window.innerWidth;
    c.height = window.innerHeight;
  });
}

ajustarCanvas();
window.addEventListener('resize', ajustarCanvas);

// Borra la capa de interfaz. Se llama en cada frame, antes de dibujar la paleta.
function limpiarOverlay() {
  octx.clearRect(0, 0, canvasOverlay.width, canvasOverlay.height);
}

// BOTÓN LIMPIAR
document.getElementById('limpiar').addEventListener('click', limpiarCanvas);

// Borra todo el dibujo del canvas. También lo usa cronometro.js al celebrar.
function limpiarCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}