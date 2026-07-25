// ─────────────────────────────────────────────────────────────
// CANVAS
// Maneja el elemento canvas: tamaño, dibujo de trazos y borrado.
// ctx (contexto 2D) se declara acá y lo usan paleta.js y mediapipe.js
// porque todos dibujan sobre el mismo canvas.
// ─────────────────────────────────────────────────────────────

const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');

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