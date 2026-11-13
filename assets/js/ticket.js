// ─────────────────────────────────────────────────────────────
// TICKET
// El botón "Imprimir" saca una foto de lo que se ve (cámara + dibujo), la pasa
// a blanco y negro y la manda a la impresora térmica como un ticket.
// El botón "Nueva palabra" imprime solo una palabra sorteada de CONFIG.PALABRAS.
// El envío lo hace servidor/servidor.js: el navegador no puede escribirle
// directamente a una impresora USB.
// Depende de: config.js, canvas.js (canvas, contenedor), manos.js (video).
// ─────────────────────────────────────────────────────────────

const botonImprimir     = document.getElementById('imprimir');
const botonNuevaPalabra = document.getElementById('nuevaPalabra');
const avisoTicket       = document.getElementById('avisoTicket');
let temporizadorAvisoTicket = null;

// Las palabras que todavía no salieron en esta vuelta.
let palabrasDisponibles = [...CONFIG.PALABRAS];

// La cámara espejada, recortada igual que el object-fit: cover del CSS.
function capturarCamara() {
  const foto = document.createElement('canvas');
  foto.width  = canvas.width;
  foto.height = canvas.height;
  const fctx = foto.getContext('2d');

  const escala = Math.max(foto.width / video.videoWidth, foto.height / video.videoHeight);
  const anchoRecorte = foto.width  / escala;
  const altoRecorte  = foto.height / escala;

  fctx.save();
  fctx.translate(foto.width, 0);
  fctx.scale(-1, 1);
  fctx.drawImage(video,
    (video.videoWidth  - anchoRecorte) / 2, (video.videoHeight - altoRecorte) / 2,
    anchoRecorte, altoRecorte,
    0, 0, foto.width, foto.height);
  fctx.restore();
  return foto;
}

// El dibujo del usuario a otro tamaño y todo de un solo color.
function trazosDeUnColor(ancho, alto, color) {
  const copia = document.createElement('canvas');
  copia.width  = ancho;
  copia.height = alto;
  const cctx = copia.getContext('2d');
  cctx.drawImage(canvas, 0, 0, ancho, alto);
  cctx.globalCompositeOperation = 'source-in';
  cctx.fillStyle = color;
  cctx.fillRect(0, 0, ancho, alto);
  return copia;
}

// En blanco y negro un trazo de color se pierde si su gris se parece al del
// fondo, así que se imprime en negro con un borde blanco: se ve sobre cualquier foto.
function dibujarTrazos(tctx, ancho, alto) {
  const borde = trazosDeUnColor(ancho, alto, '#fff');
  for (const dx of [-2, 0, 2]) {
    for (const dy of [-2, 0, 2]) tctx.drawImage(borde, dx, dy);
  }
  tctx.drawImage(trazosDeUnColor(ancho, alto, '#000'), 0, 0);
}

// Arma la imagen del ticket: la foto con el dibujo encima, al ancho del papel, y
// abajo el título y la fecha. El puntero, la paleta y el panel lateral no salen.
function dibujarTicket(foto) {
  const ancho    = CONFIG.TICKET_ANCHO_PUNTOS;
  const altoFoto = Math.round(foto.height * ancho / foto.width);
  const altoPie  = 62;

  const ticket = document.createElement('canvas');
  ticket.width  = ancho;
  ticket.height = altoFoto + altoPie;
  const tctx = ticket.getContext('2d', { willReadFrequently: true });

  tctx.fillStyle = '#fff';
  tctx.fillRect(0, 0, ticket.width, ticket.height);
  tctx.drawImage(foto, 0, 0, ancho, altoFoto);
  dibujarTrazos(tctx, ancho, altoFoto);

  tctx.fillStyle = '#000';
  tctx.textAlign = 'center';
  tctx.font = 'bold 22px "Noto Sans", sans-serif';
  tctx.fillText(CONFIG.TICKET_TITULO, ancho / 2, altoFoto + 28);
  tctx.font = '18px "Noto Sans", sans-serif';
  tctx.fillText(new Date().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }), ancho / 2, altoFoto + 52);

  return { ticket, tctx, altoFoto };
}

// Pasa la imagen a puntos negros (true) y blancos. La impresora no tiene grises:
// la foto se trama con Floyd-Steinberg para simularlos y el texto del pie se
// corta con un umbral para que quede nítido.
function aBlancoYNegro(imagen, altoFoto) {
  const { width: ancho, height: alto, data } = imagen;
  const grises = new Float32Array(ancho * alto);
  for (let i = 0; i < grises.length; i++) {
    grises[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }

  // Estira el contraste de la foto y la aclara: en papel térmico sale más oscura.
  let min = 255, max = 0;
  for (let i = 0; i < ancho * altoFoto; i++) {
    if (grises[i] < min) min = grises[i];
    if (grises[i] > max) max = grises[i];
  }
  const rango = Math.max(1, max - min);
  for (let i = 0; i < ancho * altoFoto; i++) {
    grises[i] = 255 * Math.pow((grises[i] - min) / rango, CONFIG.TICKET_GAMMA);
  }

  const puntos = new Uint8Array(ancho * alto);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const i = y * ancho + x;
      const negro = grises[i] < 128;
      puntos[i] = negro ? 1 : 0;
      if (y >= altoFoto) continue; // el pie no se trama

      // Reparte el error entre los vecinos que todavía no se procesaron
      const error = grises[i] - (negro ? 0 : 255);
      if (x + 1 < ancho) grises[i + 1] += error * 7 / 16;
      if (y + 1 < altoFoto) {
        if (x > 0) grises[i + ancho - 1] += error * 3 / 16;
        grises[i + ancho] += error * 5 / 16;
        if (x + 1 < ancho) grises[i + ancho + 1] += error / 16;
      }
    }
  }
  return puntos;
}

// Traduce los puntos a comandos ESC/POS, el lenguaje de la impresora.
function comandosEscPos(puntos, ancho, alto) {
  const bytesFila = Math.ceil(ancho / 8);
  const raster = new Uint8Array(bytesFila * alto);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      if (puntos[y * ancho + x]) raster[y * bytesFila + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }

  return new Blob([
    new Uint8Array([
      0x1b, 0x40,                  // ESC @: reinicia la impresora
      0x1b, 0x61, 1,               // ESC a: centrado
      0x1d, 0x76, 0x30, 0,         // GS v 0: imagen de puntos, de este tamaño:
      bytesFila & 0xff, bytesFila >> 8,
      alto & 0xff, alto >> 8,
    ]),
    raster,
    new Uint8Array([
      0x1b, 0x64, 4,               // ESC d: avanza el papel
      0x1d, 0x56, 66, 0,           // GS V: corta
    ]),
  ], { type: 'application/octet-stream' });
}

function generarTicket() {
  const { ticket, tctx, altoFoto } = dibujarTicket(capturarCamara());
  const imagen = tctx.getImageData(0, 0, ticket.width, ticket.height);
  return comandosEscPos(aBlancoYNegro(imagen, altoFoto), ticket.width, ticket.height);
}

// Un ticket con la palabra sola, lo más grande que entre en el ancho del papel.
// Se dibuja como imagen porque así los acentos salen bien en cualquier impresora.
function generarTicketPalabra(palabra) {
  const ancho = CONFIG.TICKET_ANCHO_PUNTOS;
  const margen = 12;

  const ticket = document.createElement('canvas');
  ticket.width  = ancho;
  ticket.height = Math.round(ancho * 0.4);
  const tctx = ticket.getContext('2d', { willReadFrequently: true });

  tctx.fillStyle = '#fff';
  tctx.fillRect(0, 0, ticket.width, ticket.height);

  const fuente = tamano => `${tamano}px "Noto Sans", sans-serif`;
  const tamanoMax = Math.round(ancho / 5);
  tctx.font = fuente(tamanoMax);
  const anchoTexto = tctx.measureText(palabra).width;
  tctx.font = fuente(Math.floor(tamanoMax * Math.min(1, (ancho - margen * 2) / anchoTexto)));

  tctx.fillStyle = '#000';
  tctx.textAlign = 'center';
  tctx.textBaseline = 'middle';
  tctx.fillText(palabra, ancho / 2, ticket.height / 2);

  const imagen = tctx.getImageData(0, 0, ticket.width, ticket.height);
  return comandosEscPos(aBlancoYNegro(imagen, 0), ticket.width, ticket.height); // 0: no hay foto que tramar
}

function mostrarAvisoTicket(texto, duracionMs) {
  clearTimeout(temporizadorAvisoTicket);
  avisoTicket.textContent = texto;
  avisoTicket.style.display = 'block';
  if (duracionMs) {
    temporizadorAvisoTicket = setTimeout(() => { avisoTicket.style.display = 'none'; }, duracionMs);
  }
}

// Manda el ticket a la impresora y devuelve si salió bien.
async function enviarTicket(generar) {
  // Evita imprimir dos veces con un doble toque o mezclar los dos botones
  botonImprimir.disabled = true;
  botonNuevaPalabra.disabled = true;
  mostrarAvisoTicket('Imprimiendo...');
  try {
    const respuesta = await fetch('/imprimir', {
      method:  'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body:    generar(),
    });
    if (!respuesta.ok) throw new Error(await respuesta.text());
    mostrarAvisoTicket('¡Listo! Retirá tu ticket', 3000);
    return true;
  } catch (error) {
    console.error('[ticket]', error);
    // fetch tira TypeError cuando no llega al servidor (por ejemplo, con Live Server)
    mostrarAvisoTicket(error instanceof TypeError
      ? 'No hay conexión con la impresora: abrí la página con "node servidor/servidor.js"'
      : error.message, 6000);
    return false;
  } finally {
    botonImprimir.disabled = false;
    botonNuevaPalabra.disabled = false;
  }
}

async function imprimirTicket() {
  if (!video.videoWidth) {
    mostrarAvisoTicket('La cámara todavía no arrancó', 3000);
    return;
  }
  await enviarTicket(generarTicket);
}

// Sortea entre las que faltan. La palabra se saca de la lista recién cuando se
// imprimió: si la impresora falla, no se pierde. Nunca se muestra en pantalla,
// así solo la ve quien retira el ticket.
async function imprimirPalabra() {
  if (palabrasDisponibles.length === 0) palabrasDisponibles = [...CONFIG.PALABRAS];

  const indice = Math.floor(Math.random() * palabrasDisponibles.length);
  const salio = await enviarTicket(() => generarTicketPalabra(palabrasDisponibles[indice]));
  if (salio) palabrasDisponibles.splice(indice, 1);
}

botonImprimir.addEventListener('click', imprimirTicket);
botonNuevaPalabra.addEventListener('click', imprimirPalabra);
