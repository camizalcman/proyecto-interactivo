// ─────────────────────────────────────────────────────────────
// REGLAS
// Botón "Reglas" (abajo a la derecha) que abre un video con las
// reglas del proyecto. El video va en: assets/videos/reglas.mp4
// ─────────────────────────────────────────────────────────────

// ├─ OVERLAY (fondo oscuro que tapa toda la pantalla)
const overlayReglas = document.createElement('div');
overlayReglas.id = 'overlayReglas';

// ├─ Marco: contiene el video y el botón de cierre
const marcoReglas = document.createElement('div');
marcoReglas.id = 'marcoReglas';

// ├─ Video de las reglas
const videoReglas = document.createElement('video');
videoReglas.id = 'videoReglas';
videoReglas.src = 'assets/video/reglas.mp4';
videoReglas.controls = true;
videoReglas.playsInline = true;
videoReglas.preload = 'metadata';

// ├─ Botón de cierre (× en la esquina del video)
const cerrarReglas = document.createElement('button');
cerrarReglas.id = 'cerrarReglas';
cerrarReglas.type = 'button';
cerrarReglas.textContent = '×';
cerrarReglas.setAttribute('aria-label', 'Cerrar video de reglas');

marcoReglas.append(videoReglas, cerrarReglas);
overlayReglas.appendChild(marcoReglas);
document.body.appendChild(overlayReglas);

function abrirReglas() {
  overlayReglas.classList.add('visible');
  videoReglas.play().catch(() => {});
}

function cerrarVideoReglas() {
  videoReglas.pause();
  videoReglas.currentTime = 0;
  overlayReglas.classList.remove('visible');
}

// Abrir al tocar el botón "Reglas"
document.getElementById('reglas').addEventListener('click', abrirReglas);
// Cerrar con la × o tocando el fondo oscuro alrededor del video
cerrarReglas.addEventListener('click', cerrarVideoReglas);
overlayReglas.addEventListener('click', (e) => {
  if (e.target === overlayReglas) cerrarVideoReglas();
});