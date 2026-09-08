// ─────────────────────────────────────────────────────────────
// CRONÓMETRO
// Un cronómetro de cuenta regresiva que se muestra debajo del
// botón "Limpiar". El valor inicial (en segundos) parte de
// CONFIG.CRONOMETRO_SEGUNDOS y arranca con el pulgar arriba
// (gesto 'thumbsup').
// Visualmente: un anillo (círculo) cuyo BORDE se va deshaciendo
// a medida que baja el número, con el número en el centro. En los
// últimos 15 segundos tanto el anillo como el número se ponen rojos.
// Antes de arrancar la cuenta regresiva se muestra un countdown
// (3, 2, 1, ¡A dibujar!) en pantalla completa.
// Depende de: config.js (CONFIG)
// ─────────────────────────────────────────────────────────────

const TIC_MS = 100; // actualizamos el render varias veces por segundo

// ── UI ───────────────────────────────────────────────────────
const TAMANO = 108;       // diámetro del cronómetro
const UMBRAL_ROJO = 15;   // últimos N segundos en rojo
const GROSOR_ANILLO = 8;  // grosor del borde del anillo
const R_CENTRO = TAMANO / 2;
const R_ANILLO = R_CENTRO - GROSOR_ANILLO;
const CIRCUNFERENCIA = 2 * Math.PI * R_ANILLO;

const cronometroCont = document.createElement('div');
cronometroCont.id = 'cronometro';
Object.assign(cronometroCont.style, {
  position:    'absolute',
  top:         '20px',     // pegado al borde superior
  right:       '20px',
  zIndex:      '10',
  width:       TAMANO + 'px',
  height:      TAMANO + 'px',
  fontFamily:  "'Noto Sans', sans-serif",
  userSelect:  'none',
});

// SVG del anillo que se va deshaciendo
const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
Object.assign(svg.style, {
  position: 'absolute',
  left:     '0',
  top:      '0',
});
svg.setAttribute('width', TAMANO);
svg.setAttribute('height', TAMANO);
svg.setAttribute('viewBox', `0 0 ${TAMANO} ${TAMANO}`);

// Fondo tenue (referencia del círculo completo)
const anilloFondo = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
anilloFondo.setAttribute('cx', R_CENTRO);
anilloFondo.setAttribute('cy', R_CENTRO);
anilloFondo.setAttribute('r', R_ANILLO);
anilloFondo.setAttribute('fill', 'none');
anilloFondo.setAttribute('stroke', 'rgba(255,255,255,0.35)');
anilloFondo.setAttribute('stroke-width', GROSOR_ANILLO);

// Borde activo que se va deshaciendo (se depleta con dashoffset)
const anilloActivo = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
anilloActivo.setAttribute('cx', R_CENTRO);
anilloActivo.setAttribute('cy', R_CENTRO);
anilloActivo.setAttribute('r', R_ANILLO);
anilloActivo.setAttribute('fill', 'none');
anilloActivo.setAttribute('stroke', '#ffffff');
anilloActivo.setAttribute('stroke-width', GROSOR_ANILLO);
anilloActivo.setAttribute('stroke-linecap', 'round');
anilloActivo.setAttribute('transform', `rotate(-90 ${R_CENTRO} ${R_CENTRO})`); // arranca arriba
anilloActivo.setAttribute('stroke-dasharray', CIRCUNFERENCIA);
anilloActivo.setAttribute('stroke-dashoffset', 0); // comienza lleno

svg.appendChild(anilloFondo);
svg.appendChild(anilloActivo);
cronometroCont.appendChild(svg);

// Número central (siempre centrado y legible)
const cronometroValor = document.createElement('div');
Object.assign(cronometroValor.style, {
  position:     'absolute',
  left:         '0',
  top:          '0',
  width:        '100%',
  height:       '100%',
  display:      'flex',
  alignItems:   'center',
  justifyContent: 'center',
  fontSize:     '32px',
  fontWeight:   'bold',
  lineHeight:   '1',
  color:        '#ffffff',
  fontVariantNumeric: 'tabular-nums',
  transition:   'color 0.2s',
  zIndex:       '1',
  textShadow:   '0 1px 3px rgba(0,0,0,0.5)',
});

cronometroCont.appendChild(cronometroValor);
document.body.appendChild(cronometroCont);

// ── ESTADO ───────────────────────────────────────────────────
let segundosTotal = CONFIG.CRONOMETRO_SEGUNDOS;
let segundosRestantes = CONFIG.CRONOMETRO_SEGUNDOS;
let corriendo = false;
let intervaloId = null;
let countdownActivo = false;
let temporizadorFelicitaciones = null;
let temporizadorTiempoTerminado = null;
let avisoDiezDisparado = false; // el audio de "countdown" suena una sola vez al llegar a 10

// ── OVERLAY DE COUNTDOWN ─────────────────────────────────────
// Se muestra en el centro de la pantalla antes de arrancar la
// cuenta regresiva: 3, 2, 1, ¡A dibujar!
const overlay = document.createElement('div');
Object.assign(overlay.style, {
  position:        'fixed',
  inset:           '0',
  display:         'none',
  alignItems:      'center',
  justifyContent:  'center',
  zIndex:          '9999',
  pointerEvents:   'none',
  fontFamily:      "'Noto Sans', sans-serif",
  fontSize:        '120px',
  fontWeight:      'bold',
  color:           '#ffffff',
  textShadow:      '0 4px 20px rgba(0,0,0,0.6)',
  background:      'rgba(0,0,0,0.35)',
  transition:      'opacity 0.25s',
});
document.body.appendChild(overlay);

// ── OVERLAY DE FELICITACIONES ────────────────────────────────
// Se muestra al frenar el cronómetro cuando se detectan las DOS manos
// abiertas y completas (todos los puntos, todos los dedos estirados).
const felicitaciones = document.createElement('div');
Object.assign(felicitaciones.style, {
  position:        'fixed',
  inset:           '0',
  display:         'none',
  alignItems:      'center',
  justifyContent: 'center',
  zIndex:          '9999',
  pointerEvents:   'none',
  fontFamily:      "'Noto Sans', sans-serif",
  fontSize:        '100px',
  fontWeight:      'bold',
  color:           '#ffffff',
  textShadow:      '0 4px 20px rgba(0,0,0,0.6)',
  background:      'rgba(0,0,0,0.35)',
  transition:      'opacity 0.25s',
});
felicitaciones.textContent = '¡Felicitaciones!';
document.body.appendChild(felicitaciones);

// ── OVERLAY DE TIEMPO TERMINADO ───────────────────────────────
// Se muestra cuando el cronómetro llega a 0: avisa que se acabó el tiempo.
const tiempoTerminado = document.createElement('div');
Object.assign(tiempoTerminado.style, {
  position:        'fixed',
  inset:           '0',
  display:         'none',
  alignItems:      'center',
  justifyContent: 'center',
  zIndex:          '9999',
  pointerEvents:   'none',
  fontFamily:      "'Noto Sans', sans-serif",
  fontSize:        '100px',
  fontWeight:      'bold',
  color:           '#ffffff',
  textShadow:      '0 4px 20px rgba(0,0,0,0.6)',
  background:      'rgba(0,0,0,0.35)',
  transition:      'opacity 0.25s',
});
tiempoTerminado.textContent = '¡Se terminó el tiempo!';
document.body.appendChild(tiempoTerminado);

function mostrarCountdown(callback) {
  countdownActivo = true;
  overlay.style.display = 'flex';
  overlay.style.opacity = '1';

  const pasos = ['3', '2', '1', '¡A dibujar!'];
  let i = 0;

  function mostrarPaso() {
    if (!countdownActivo) return; // la celebración frenó el countdown: no continuar
    if (i >= pasos.length) {
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.style.display = 'none';
        countdownActivo = false;
        callback();
      }, 250);
      return;
    }
    overlay.textContent = pasos[i];
    if (overlay.textContent === '¡A dibujar!') reproducirAudio('dibujar');
    i++;
    setTimeout(mostrarPaso, 1000);
  }

  mostrarPaso();
}

// Cambia programáticamente la duración inicial (sin mostrar editor en pantalla)
function setCronometroSegundos(segundos) {
  const v = Math.max(1, parseInt(segundos, 10) || CONFIG.CRONOMETRO_SEGUNDOS);
  segundosTotal = v;
  if (!corriendo) {
    segundosRestantes = v;
    renderizar();
  }
}

function renderizar() {
  const seg = Math.max(0, Math.ceil(segundosRestantes));
  cronometroValor.textContent = String(seg);

  // El borde del anillo se va deshaciendo: a menor tiempo, menos borde visible.
  // (Al revés que el anillo de carga del borrador: este arranca lleno y se vacía).
  const factor = segundosTotal > 0 ? Math.max(0, segundosRestantes / segundosTotal) : 0;
  const offset = CIRCUNFERENCIA * (1 - factor);
  anilloActivo.setAttribute('stroke-dashoffset', offset);

  // En los últimos segundos, rojo (anillo + número)
  const enRojo = seg <= UMBRAL_ROJO && seg > 0;
  const color = enRojo ? '#ff3b30' : '#ffffff';
  anilloActivo.setAttribute('stroke', color);
  cronometroValor.style.color = enRojo ? '#ff3b30' : '#ffffff';
}

function iniciarCronometro() {
  if (corriendo || countdownActivo) return;

  // Ocultamos un "¡Felicitaciones!" o "¡Se terminó el tiempo!" previos
  // antes de arrancar una nueva cuenta.
  clearTimeout(temporizadorTiempoTerminado);
  tiempoTerminado.style.display = 'none';
  tiempoTerminado.style.opacity = '0';
  felicitaciones.style.display = 'none';
  felicitaciones.style.opacity = '0';

  mostrarCountdown(() => {
    segundosRestantes = segundosTotal;
    corriendo = true;
    avisoDiezDisparado = false;
    renderizar();

    clearInterval(intervaloId);
    intervaloId = setInterval(() => {
      segundosRestantes -= TIC_MS / 1000;
      if (segundosRestantes <= 0) {
        segundosRestantes = 0;
        corriendo = false;
        clearInterval(intervaloId);
        intervaloId = null;
        renderizar();
        mostrarTiempoTerminado();
        return;
      }
      // Al llegar a 10 segundos suena el audio "countdown" una sola vez.
      if (Math.ceil(segundosRestantes) === 10 && !avisoDiezDisparado) {
        avisoDiezDisparado = true;
        reproducirAudio('countdown');
      }
      renderizar();
    }, TIC_MS);
  });
}

// Frena el cronómetro (sea la cuenta regresiva o el countdown previo), borra
// todo el dibujo y muestra "¡Felicitaciones!". Se llama desde mediapipe.js
// cuando se detectan las DOS manos abiertas y completas.
function frenarCronometro() {
  if (!corriendo && !countdownActivo) return;

  corriendo = false;
  countdownActivo = false;
  clearInterval(intervaloId);
  intervaloId = null;

  limpiarCanvas();

  // Ante la celebración, cancelamos cualquier aviso de "tiempo terminado"
  // pendiente y ocultamos ese overlay.
  clearTimeout(temporizadorTiempoTerminado);
  tiempoTerminado.style.display = 'none';
  tiempoTerminado.style.opacity = '0';

  felicitaciones.style.display = 'flex';
  felicitaciones.style.opacity = '1';
  reproducirAudio('win');

  // El mensaje se mantiene 5 segundos y después todo vuelve a la normalidad:
  // se oculta y el cronómetro muestra de nuevo el valor inicial completo.
  clearTimeout(temporizadorFelicitaciones);
  temporizadorFelicitaciones = setTimeout(volverALaNormalidad, 5000);
}

// Restaura el estado idle después del "¡Felicitaciones!".
function volverALaNormalidad() {
  felicitaciones.style.opacity = '0';
  setTimeout(() => {
    felicitaciones.style.display = 'none';
  }, 250); // esperamos la transición de opacidad (0.25s)

  segundosRestantes = segundosTotal;
  renderizar();
}

// Muestra "¡Se terminó el tiempo!" cuando el cronómetro llega a 0.
function mostrarTiempoTerminado() {
  clearTimeout(temporizadorFelicitaciones);
  felicitaciones.style.display = 'none';
  felicitaciones.style.opacity = '0';

  tiempoTerminado.style.display = 'flex';
  tiempoTerminado.style.opacity = '1';
  reproducirAudio('gameOver');

  clearTimeout(temporizadorTiempoTerminado);
  temporizadorTiempoTerminado = setTimeout(volverALaTiempo, 5000);
}

// Oculta el aviso de tiempo terminado y vuelve al estado idle.
function volverALaTiempo() {
  tiempoTerminado.style.opacity = '0';
  setTimeout(() => {
    tiempoTerminado.style.display = 'none';
  }, 250); // esperamos la transición de opacidad (0.25s)

  segundosRestantes = segundosTotal;
  renderizar();
}

// Estado inicial
renderizar();
