// ─────────────────────────────────────────────────────────────
// CRONÓMETRO
// Un cronómetro de cuenta regresiva que se muestra debajo del
// botón "Limpiar". El valor inicial (en segundos) parte de
// CONFIG.CRONOMETRO_SEGUNDOS y arranca con el pulgar arriba
// (gesto 'thumbsup').
// Visualmente: un anillo (círculo) cuyo BORDE se va deshaciendo
// a medida que baja el número, con el número en el centro. En los
// últimos 10 segundos tanto el anillo como el número se ponen rojos.
// Depende de: config.js (CONFIG)
// ─────────────────────────────────────────────────────────────

const TIC_MS = 100; // actualizamos el render varias veces por segundo

// ── UI ───────────────────────────────────────────────────────
const TAMANO = 96;        // diámetro del cronómetro
const UMBRAL_ROJO = 10;   // últimos N segundos en rojo
const GROSOR_ANILLO = 8;  // grosor del borde del anillo
const R_CENTRO = TAMANO / 2;
const R_ANILLO = R_CENTRO - GROSOR_ANILLO;
const CIRCUNFERENCIA = 2 * Math.PI * R_ANILLO;

const cronometroCont = document.createElement('div');
cronometroCont.id = 'cronometro';
Object.assign(cronometroCont.style, {
  position:    'absolute',
  top:         '110px',    // debajo del botón Limpiar, con aire
  right:       '20px',
  zIndex:      '10',
  width:       TAMANO + 'px',
  height:      TAMANO + 'px',
  fontFamily:  'sans-serif',
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
  if (!corriendo) {
    segundosRestantes = segundosTotal;
  }
  corriendo = true;
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
      return;
    }
    renderizar();
  }, TIC_MS);
}

// Estado inicial
renderizar();
