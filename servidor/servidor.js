// ─────────────────────────────────────────────────────────────
// SERVIDOR LOCAL
// Sirve la página y le pasa los tickets a la impresora USB, porque el
// navegador no puede escribirle directamente. No necesita instalar nada.
// Uso: node servidor/servidor.js  → después abrir http://localhost:3000
// ─────────────────────────────────────────────────────────────

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');

const PUERTO = 3000;

// Identifica a la XPrinter entre los dispositivos USB (así un ticket nunca va a
// parar a otra impresora, como la Brother). Si se cambia de impresora hay que
// actualizarlo: es el VID y PID que muestra el Administrador de dispositivos.
const IMPRESORA_USB = 'vid_0483&pid_070b';

const RAIZ = path.join(__dirname, '..');
const SCRIPT_IMPRESORA = path.join(__dirname, 'enviar-a-impresora.ps1');
const MAX_BYTES_TICKET = 2 * 1024 * 1024;
const TIMEOUT_IMPRESION_MS = 30000;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.png':  'image/png',
  '.mp3':  'audio/mpeg',
  '.mp4':  'video/mp4',
};

// De a un ticket por vez: si se escribieran dos a la vez saldrían mezclados.
let colaImpresion = Promise.resolve();

function imprimir(ticket) {
  const trabajo = colaImpresion.then(() => enviarAImpresora(ticket));
  colaImpresion = trabajo.catch(() => {});
  return trabajo;
}

async function enviarAImpresora(ticket) {
  const archivo = path.join(os.tmpdir(), `ticket-${crypto.randomUUID()}.bin`);
  await fs.promises.writeFile(archivo, ticket);
  try {
    await new Promise((resolve, reject) => {
      execFile('powershell', [
        '-NoProfile', '-ExecutionPolicy', 'Bypass',
        '-File', SCRIPT_IMPRESORA, archivo, IMPRESORA_USB,
      ], { timeout: TIMEOUT_IMPRESION_MS, windowsHide: true }, (error, stdout, stderr) => {
        if (!error) return resolve();
        reject(new Error(error.killed
          ? 'La impresora no responde: revisá que tenga papel y la tapa cerrada.'
          : (stderr.trim() || error.message)));
      });
    });
  } finally {
    await fs.promises.rm(archivo, { force: true });
  }
}

// Solo se aceptan tickets de la propia página: si no, cualquier sitio abierto
// en el navegador podría mandar cosas a la impresora.
function pedidoLocal(req) {
  const hostsValidos = [`localhost:${PUERTO}`, `127.0.0.1:${PUERTO}`];
  const origenValido = hostsValidos.map(h => `http://${h}`).includes(req.headers.origin);
  return hostsValidos.includes(req.headers.host) && origenValido;
}

function responder(res, codigo, texto) {
  res.writeHead(codigo, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(texto);
}

function recibirTicket(req, res) {
  if (!pedidoLocal(req) || req.headers['content-type'] !== 'application/octet-stream') {
    return responder(res, 403, 'Pedido no permitido');
  }

  const partes = [];
  let total = 0;
  req.on('data', parte => {
    total += parte.length;
    if (total > MAX_BYTES_TICKET) {
      responder(res, 413, 'El ticket es demasiado grande');
      req.destroy();
      return;
    }
    partes.push(parte);
  });
  req.on('end', async () => {
    try {
      await imprimir(Buffer.concat(partes));
      responder(res, 200, 'Impreso');
    } catch (error) {
      console.error('[impresora]', error.message);
      responder(res, 500, error.message);
    }
  });
}

// Solo se publican index.html y assets/ (nunca .git ni el servidor).
function servirArchivo(req, res) {
  const ruta = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const relativa = ruta === '/' ? 'index.html' : path.normalize(ruta).replace(/^[\\/]+/, '');
  const permitida = relativa === 'index.html' || relativa.startsWith(`assets${path.sep}`);
  if (!permitida) return responder(res, 404, 'No encontrado');

  const archivo = path.join(RAIZ, relativa);
  fs.stat(archivo, (error, datos) => {
    if (error || !datos.isFile()) return responder(res, 404, 'No encontrado');
    res.writeHead(200, {
      'Content-Type': TIPOS[path.extname(archivo).toLowerCase()] || 'application/octet-stream',
      'Content-Length': datos.size,
    });
    fs.createReadStream(archivo).pipe(res);
  });
}

http.createServer((req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/imprimir') return recibirTicket(req, res);
    if (req.method === 'GET') return servirArchivo(req, res);
    responder(res, 405, 'Método no permitido');
  } catch {
    responder(res, 400, 'Pedido inválido');
  }
}).listen(PUERTO, '127.0.0.1', () => {
  console.log(`Proyecto listo en http://localhost:${PUERTO}`);
});
