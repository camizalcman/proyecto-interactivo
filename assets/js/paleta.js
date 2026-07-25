// ─────────────────────────────────────────────────────────────
// PALETA DE COLORES
// Genera los círculos, los dibuja en pantalla en cada frame,
// y detecta si alguna mano está tocando un color.
// Depende de: config.js (CONFIG) y canvas.js (ctx)
// ─────────────────────────────────────────────────────────────

// COLOR GLOBAL: un solo color compartido por TODAS las manos.
// Si cualquier mano toca la paleta, cambia el color para todas.
// Esto evita que el color "salte" de una mano a otra cuando
// MediaPipe reasigna los slots entre frames.
let colorActual = CONFIG.COLOR_INICIAL;

const colores   = CONFIG.COLORES;
const espaciado = CONFIG.PALETA_ESPACIADO;

const paleta = colores.map((color, i) => ({
  x: CONFIG.PALETA_X,
  y: CONFIG.PALETA_Y_INICIO + i * espaciado,
  radio: CONFIG.PALETA_RADIO,
  color: color
}));

const zonaPaleta = {
  x: CONFIG.PALETA_X - 40,   // un margen alrededor del primer círculo
  y: CONFIG.PALETA_Y_INICIO - 40,
  ancho: 120,
  alto: colores.length * espaciado + 20
};

function dentroDeZona(x, y, zona) {
  return x >= zona.x && x <= zona.x + zona.ancho &&
         y >= zona.y && y <= zona.y + zona.alto;
}

//PALETA DE COLORES
function dibujarPaleta() {
  paleta.forEach(c => {
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.radio, 0, Math.PI * 2);
    ctx.fillStyle = c.color;
    ctx.fill();
  });
}