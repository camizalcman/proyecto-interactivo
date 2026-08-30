// ─────────────────────────────────────────────────────────────
// PLANTILLAS
// Maneja el menú de selección y el dibujo de cada plantilla
// sobre el canvas. Las plantillas son guías visuales fijas
// que se dibujan debajo del trazo del usuario.
//
// Flujo:
// 1. El menú se muestra en un costado con los íconos
// 2. El usuario mantiene el dedo sobre un ícono 1 segundo (dwell time)
// 3. Se limpia el canvas, se dibuja la plantilla y se oculta el menú
// 4. El botón "sin plantilla" vuelve al modo libre y muestra el menú
// ─────────────────────────────────────────────────────────────


// ── Estado global de plantillas ───────────────────────────────
// plantillaActiva: cuál está dibujada ahora ('tateti', 'papa', 'laberinto', null)
// menuVisible: si el menú lateral se está mostrando
let plantillaActiva = null;
let menuVisible     = false;

// ── Dwell time ────────────────────────────────────────────────
// Para seleccionar una plantilla el usuario mantiene el dedo
// quieto sobre el ícono durante DWELL_MS milisegundos.
// dwellSlot guarda sobre qué ícono está el dedo ahora.
// dwellInicio guarda cuándo empezó a estar ahí.
const DWELL_MS    = 1000; // 1 segundo
let dwellSlot     = null; // índice del ícono bajo el dedo
let dwellInicio   = null; // timestamp de cuando empezó el dwell

// ── Definición del menú ───────────────────────────────────────
// Cada ítem tiene un id, un label visible y una función que
// dibuja la plantilla correspondiente en el canvas.
const MENU_X         = 30;  // posición horizontal del menú
const MENU_Y_INICIO  = 180; // posición vertical del primer ítem (debajo de la paleta)
const MENU_ANCHO     = 120;
const MENU_ALTO_ITEM = 70;  // alto de cada tarjeta del menú
const MENU_GAP       = 12;  // separación entre tarjetas

const itemsMenu = [
  { id: 'tateti',    label: 'Tateti'   },
  { id: 'papa',      label: 'La Papa'  },
  { id: 'laberinto', label: 'Laberinto'},
  { id: 'libre',     label: 'Libre'    }, // vuelve al modo sin plantilla
];

// Calcula la zona de cada ítem del menú
function zonaItem(i) {
  return {
    x:     MENU_X,
    y:     MENU_Y_INICIO + i * (MENU_ALTO_ITEM + MENU_GAP),
    ancho: MENU_ANCHO,
    alto:  MENU_ALTO_ITEM,
  };
}

// ── Dibujar el menú ───────────────────────────────────────────
// Se llama en cada frame desde onResults cuando menuVisible es true.
// Dibuja las tarjetas sobre el canvas encima de todo.
function dibujarMenu() {
  if (!menuVisible) return;

  itemsMenu.forEach((item, i) => {
    const z = zonaItem(i);
    const esActiva = item.id === plantillaActiva ||
                     (item.id === 'libre' && plantillaActiva === null);

    // Fondo de la tarjeta
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(z.x, z.y, z.ancho, z.alto, 10);
    ctx.fillStyle = esActiva
      ? 'rgba(255, 255, 255, 0.35)'  // activa: más visible
      : 'rgba(255, 255, 255, 0.12)'; // inactiva: sutil
    ctx.fill();

    // Borde: blanco si es la activa, gris si no
    ctx.strokeStyle = esActiva
      ? 'rgba(255, 255, 255, 0.9)'
      : 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = esActiva ? 2 : 1;
    ctx.stroke();
    ctx.restore();

    // Barra de progreso del dwell time
    // Aparece en la parte inferior de la tarjeta mientras el dedo espera
    if (dwellSlot === i && dwellInicio !== null) {
      const progreso = Math.min(1, (Date.now() - dwellInicio) / DWELL_MS);
      ctx.save();
      ctx.beginPath();
      // Fondo de la barra
      ctx.roundRect(z.x + 8, z.y + z.alto - 10, z.ancho - 16, 5, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fill();
      // Relleno proporcional al progreso
      if (progreso > 0) {
        ctx.beginPath();
        ctx.roundRect(z.x + 8, z.y + z.alto - 10, (z.ancho - 16) * progreso, 5, 3);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fill();
      }
      ctx.restore();
    }

    // Label de texto
    ctx.save();
    ctx.fillStyle = 'white';
    ctx.font      = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.label, z.x + z.ancho / 2, z.y + z.alto / 2 - 5);
    ctx.restore();
  });
}

// ── Verificar dwell sobre el menú ─────────────────────────────
// Se llama desde onResults con la posición (x, y) de cada mano.
// Si el dedo estuvo 1 segundo sobre un ítem, activa esa plantilla.
function verificarDwellMenu(x, y) {
  if (!menuVisible) return;

  let sobreAlgun = false;

  itemsMenu.forEach((item, i) => {
    const z = zonaItem(i);
    const dentro = x >= z.x && x <= z.x + z.ancho &&
                   y >= z.y && y <= z.y + z.alto;

    if (dentro) {
      sobreAlgun = true;

      if (dwellSlot !== i) {
        // El dedo se movió a un ítem distinto, reiniciar el dwell
        dwellSlot   = i;
        dwellInicio = Date.now();
      } else {
        // Sigue sobre el mismo ítem, verificar si ya pasó el tiempo
        if (Date.now() - dwellInicio >= DWELL_MS) {
          activarPlantilla(item.id);
          dwellSlot   = null;
          dwellInicio = null;
        }
      }
    }
  });

  // Si el dedo no está sobre ningún ítem, resetear el dwell
  if (!sobreAlgun) {
    dwellSlot   = null;
    dwellInicio = null;
  }
}

// ── Activar una plantilla ─────────────────────────────────────
// Limpia el canvas, dibuja la plantilla elegida y oculta el menú.
// Si el id es 'libre', vuelve al modo sin plantilla y muestra el menú.
function activarPlantilla(id) {
  // Limpiar todo el canvas antes de dibujar la plantilla
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (id === 'libre') {
    plantillaActiva = null;
    menuVisible     = true;
    return;
  }

  plantillaActiva = id;
  menuVisible     = false; // ocultar el menú mientras se dibuja

  // Dibujar la plantilla correspondiente
  if (id === 'tateti')    dibujarTateti();
  if (id === 'papa')      dibujarPapa();
  if (id === 'laberinto') dibujarLaberinto();
}

// ── Redibujar la plantilla activa ─────────────────────────────
// Se llama en cada frame para que la plantilla no desaparezca
// cuando el canvas se limpia por otras operaciones.
// IMPORTANTE: se llama ANTES de que el usuario dibuje encima,
// así los trazos quedan siempre por arriba de la plantilla.
function redibujarPlantillaActiva() {
  if (!plantillaActiva) return;
  if (plantillaActiva === 'tateti')    dibujarTateti();
  if (plantillaActiva === 'papa')      dibujarPapa();
  if (plantillaActiva === 'laberinto') dibujarLaberinto();
}


// ═════════════════════════════════════════════════════════════
// PLANTILLAS — cada función dibuja su contenido centrado
// en el canvas usando canvas.width y canvas.height.
// Usamos colores con opacidad para que se vea como guía,
// no como parte del dibujo del usuario.
// ═════════════════════════════════════════════════════════════

// ── Tateti ────────────────────────────────────────────────────
// Una grilla de 3x3 centrada en pantalla.
// El tamaño de cada celda se calcula según el alto de la pantalla.
function dibujarTateti() {
  const tamCelda = Math.min(canvas.width, canvas.height) * 0.22;
  const grilla   = tamCelda * 3;
  const offsetX  = (canvas.width  - grilla) / 2;
  const offsetY  = (canvas.height - grilla) / 2;

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth   = 4;
  ctx.lineCap     = 'round';

  // Líneas verticales interiores (2 líneas forman la grilla de 3 columnas)
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(offsetX + i * tamCelda, offsetY);
    ctx.lineTo(offsetX + i * tamCelda, offsetY + grilla);
    ctx.stroke();
  }

  // Líneas horizontales interiores (2 líneas forman la grilla de 3 filas)
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(offsetX,         offsetY + i * tamCelda);
    ctx.lineTo(offsetX + grilla, offsetY + i * tamCelda);
    ctx.stroke();
  }

  ctx.restore();
}

// ── La Papa ───────────────────────────────────────────────────
// Números del 1 al 10 distribuidos aleatoriamente en pantalla,
// con suficiente separación para que no se pisen.
// Los números son grandes y fáciles de leer proyectados.
function dibujarPapa() {
  // Posiciones fijas (no aleatorias) para que siempre queden bien
  // distribuidos sin importar el tamaño de pantalla.
  // Expresadas como porcentaje del ancho/alto del canvas.
  const posiciones = [
    { px: 0.15, py: 0.20 },
    { px: 0.50, py: 0.15 },
    { px: 0.82, py: 0.22 },
    { px: 0.25, py: 0.50 },
    { px: 0.70, py: 0.45 },
    { px: 0.10, py: 0.75 },
    { px: 0.40, py: 0.78 },
    { px: 0.65, py: 0.80 },
    { px: 0.88, py: 0.65 },
    { px: 0.50, py: 0.50 },
  ];

  ctx.save();
  ctx.font         = 'bold 80px sans-serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle    = 'rgba(255, 255, 255, 0.55)';
  ctx.strokeStyle  = 'rgba(0, 0, 0, 0.3)';
  ctx.lineWidth    = 3;

  posiciones.forEach((pos, i) => {
    const x = pos.px * canvas.width;
    const y = pos.py * canvas.height;
    // Sombra para que sea legible sobre cualquier fondo
    ctx.strokeText(i + 1, x, y);
    ctx.fillText(i + 1, x, y);
  });

  ctx.restore();
}

// ── Laberinto ─────────────────────────────────────────────────
// Un laberinto simple dibujado con líneas.
// Centrado en pantalla, tamaño proporcional al canvas.
// Las paredes son líneas blancas semitransparentes.
function dibujarLaberinto() {
  const tam    = Math.min(canvas.width, canvas.height) * 0.7;
  const ox     = (canvas.width  - tam) / 2; // offset X para centrar
  const oy     = (canvas.height - tam) / 2; // offset Y para centrar
  const u      = tam / 8; // unidad base: divide el laberinto en 8 celdas

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth   = 4;
  ctx.lineCap     = 'square';

  // Función auxiliar para dibujar una línea usando unidades relativas
  // en lugar de píxeles absolutos, así escala con el canvas
  function linea(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(ox + x1 * u, oy + y1 * u);
    ctx.lineTo(ox + x2 * u, oy + y2 * u);
    ctx.stroke();
  }

  // Borde exterior del laberinto (4 paredes, con entrada y salida)
  linea(0, 0, 8, 0); // pared superior completa
  linea(0, 8, 8, 8); // pared inferior completa
  linea(0, 0, 0, 3); // pared izquierda superior (entrada en y=3)
  linea(0, 4, 0, 8); // pared izquierda inferior
  linea(8, 0, 8, 5); // pared derecha superior (salida en y=5)
  linea(8, 6, 8, 8); // pared derecha inferior

  // Paredes internas del laberinto
  // Estas paredes forman un camino único desde la entrada hasta la salida
  linea(1, 0, 1, 2);
  linea(1, 3, 1, 5);
  linea(2, 1, 4, 1);
  linea(2, 3, 2, 6);
  linea(3, 2, 3, 4);
  linea(4, 2, 6, 2);
  linea(4, 4, 4, 6);
  linea(5, 1, 5, 2);
  linea(5, 4, 7, 4);
  linea(5, 6, 5, 8);
  linea(6, 0, 6, 1);
  linea(6, 3, 6, 4);
  linea(6, 6, 7, 6);
  linea(7, 2, 7, 3);
  linea(7, 5, 7, 6);
  linea(1, 6, 3, 6);
  linea(3, 7, 5, 7);

  // Etiquetas de entrada y salida
  ctx.fillStyle    = 'rgba(255, 255, 255, 0.7)';
  ctx.font         = 'bold 16px sans-serif';
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('ENTRADA', ox - 5, oy + 3.5 * u);
  ctx.textAlign = 'right';
  ctx.fillText('SALIDA', ox + tam + 5, oy + 5.5 * u);

  ctx.restore();
}