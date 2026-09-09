// ─────────────────────────────────────────────────────────────
// GESTOS
// Botón "Gestos" (abajo a la derecha) que abre una imagen con
// la guía de gestos. La imagen va en: assets/img/gestos.png
// ─────────────────────────────────────────────────────────────

// ├─ OVERLAY (fondo oscuro que tapa toda la pantalla)
const overlayGestos = document.createElement('div');
overlayGestos.id = 'overlayGestos';

// ├─ Marco: contiene la imagen y el botón de cierre
const marcoGestos = document.createElement('div');
marcoGestos.id = 'marcoGestos';

// ├─ Imagen de gestos
const imagenGestos = document.createElement('img');
imagenGestos.id = 'imagenGestos';
imagenGestos.src = 'assets/img/gestos.png';
imagenGestos.alt = 'Guía de gestos';

// ├─ Botón de cierre (× en la esquina de la imagen)
const cerrarGestos = document.createElement('button');
cerrarGestos.id = 'cerrarGestos';
cerrarGestos.type = 'button';
cerrarGestos.textContent = '×';
cerrarGestos.setAttribute('aria-label', 'Cerrar imagen de gestos');

marcoGestos.append(imagenGestos, cerrarGestos);
overlayGestos.appendChild(marcoGestos);
document.body.appendChild(overlayGestos);

function abrirGestos() {
  overlayGestos.classList.add('visible');
}

function cerrarGestosImg() {
  overlayGestos.classList.remove('visible');
}

// Abrir al tocar el botón "Gestos"
document.getElementById('gestos').addEventListener('click', abrirGestos);
// Cerrar con la × o tocando el fondo oscuro alrededor de la imagen
cerrarGestos.addEventListener('click', cerrarGestosImg);
overlayGestos.addEventListener('click', (e) => {
  if (e.target === overlayGestos) cerrarGestosImg();
});
