const video  = document.getElementById('video');   
const canvas = document.getElementById('canvas');  
const ctx    = canvas.getContext('2d');            
const cursor = document.getElementById('cursor');  
const estado = document.getElementById('estado');  


/* VARIABLES DE DIBUJO: guardan la posición del dedo en el frame anterior y se usan para dibujar una línea desde ahí hasta la posición actual. Cuando son null significa que no hay trazo activo */
const last = [
  { x: null, y: null },  // mano 0
  { x: null, y: null },  // mano 1
  { x: null, y: null },  // mano 2
  { x: null, y: null },  // mano 3
];

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


/* FUNCIÓN onResults: MediaPipe la llama automáticamente en cada frame del video (aproximadamente 30 veces por segundo), recibe un objeto "results" con toda la información detectada */

function onResults(results) {

  // Si MediaPipe no encuentra ninguna mano en el frame
  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    last.forEach(l => { l.x = null; l.y = null; }); // resetear todas las manos para cortar el trazo activo
    cursor.style.display = 'none';   // ocultar el cursor visual
    estado.textContent = 'Mostrá tu mano a la cámara';   // actualizar el mensaje de estado
    return; 
  }

  // Recorrer todas las manos detectadas 
  // multiHandLandmarks es un array de manos.
  // Cada mano es un array de 21 landmarks.
  // forEach nos da el índice i para saber qué mano es (0, 1, 2, 3)
  results.multiHandLandmarks.forEach((landmarks, i) => {

    // Landmark 8: punta del dedo índice 
    // Cada landmark tiene tres valores: x, y, z
    // x e y van de 0 a 1 (porcentaje del ancho/alto del frame)
    // z es profundidad relativa 
    const indice = landmarks[8];

    // Convertir coordenadas a píxeles del canvas 
    // MediaPipe devuelve x entre 0 (izquierda) y 1 (derecha).
    // Como el video está en espejo (transform: scaleX(-1) en CSS),
    // tenemos que invertir el x: usamos (1 - indice.x).
    // Luego multiplicamos por el ancho/alto del canvas para obtener píxeles.
    const x = (1 - indice.x) * canvas.width;
    const y = indice.y * canvas.height;

    // Mover el cursor visual 
    // Posicionamos el div #cursor en las coordenadas del dedo.
    // El CSS ya tiene transform: translate(-50%, -50%) para centrarlo.
    cursor.style.display = 'block';
    cursor.style.left = x + 'px';
    cursor.style.top  = y + 'px';

    // Dibujar el trazo 
    // Solo dibujamos si tenemos una posición anterior guardada para esta mano.
    // En el primer frame después de aparecer la mano, last[i].x es null,
    // así que solo guardamos la posición sin dibujar nada.
    if (last[i].x !== null) {

      // Calcular la distancia recorrida desde el frame anterior.
      // Math.hypot calcula la distancia entre dos puntos (Pitágoras).
      // A mayor distancia = movimiento más rápido.
      const distancia = Math.hypot(x - last[i].x, y - last[i].y);

      // Grosor dinámico basado en la velocidad del movimiento.
      // Movimiento lento (distancia chica) → trazo grueso.
      // Movimiento rápido (distancia grande) → trazo fino.
      // Math.max(2, ...) asegura que el trazo nunca sea menor a 2px.
      const grosor = Math.max(2, 26 - distancia * 0.4);

      // Dibujar la línea en el canvas
      ctx.beginPath();               // empezar un nuevo trazo
      ctx.moveTo(last[i].x, last[i].y); // punto de inicio (frame anterior)
      ctx.lineTo(x, y);              // punto final (frame actual)
      ctx.strokeStyle = 'blue';      // color del trazo
      ctx.lineWidth   = grosor;      // grosor calculado arriba
      ctx.lineCap     = 'round';     // punta redondeada, más orgánica
      ctx.lineJoin    = 'round';     // unión redondeada entre segmentos
      ctx.globalAlpha = 0.9;         // leve transparencia para suavizar
      ctx.stroke();                  // ejecutar el dibujo
      ctx.globalAlpha = 1;           // resetear la transparencia para próximos dibujos
    }

    // Guardar posición actual para el próximo frame 
    // En el siguiente frame, esta posición va a ser el last[i] de esta mano
    last[i].x = x;
    last[i].y = y;
  });

  estado.textContent = 'Dibujando...';
}


// INICIALIZAR MEDIAPIPE HANDS
// Creamos la instancia principal de MediaPipe Hands.
// locateFile le dice a MediaPipe dónde buscar sus archivos internos
// (modelos de ML, workers, etc.) — en este caso desde el CDN.

const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

// Configuración del modelo
hands.setOptions({
  maxNumHands: 4,               // cuántas manos detectar a la vez
  modelComplexity: 1,           // 0 = más rápido pero menos preciso
                                // 1 = más preciso pero más lento
  minDetectionConfidence: 0.7,  // confianza mínima para considerar
                                // que detectó una mano (0 a 1)
  minTrackingConfidence: 0.5    // confianza mínima para seguir
                                // trackeando una mano ya detectada
});

// Registrar la función que se llama en cada frame
// Cada vez que MediaPipe procesa un frame llama a onResults
hands.onResults(onResults);


// INICIALIZAR LA CÁMARA CON CAMERA UTILS
// Camera Utils maneja el loop de frames automáticamente.
// En cada frame llama a onFrame, que le manda la imagen a MediaPipe.
// Esto reemplaza al getUserMedia manual: Camera Utils lo hace por dentro.

const camera = new Camera(video, {
  onFrame: async () => {
    // Le mandamos el frame actual del video a MediaPipe para que lo procese.
    // MediaPipe analiza la imagen, detecta manos, y llama a onResults.
    await hands.send({ image: video });
  },
  width: 1280,   // resolución del stream de la cámara
  height: 720    // 720p es suficiente para esta etapa
});

// Arrancar la cámara
// .then() se ejecuta si arranca correctamente
// .catch() se ejecuta si hay algún error (por ejemplo, sin permiso de cámara)
camera.start()
  .then(() => {
    estado.textContent = 'Mostrá tu mano a la cámara';
  })
  .catch((err) => {
    estado.textContent = 'Error: ' + err.message;
    console.error('Error al iniciar la cámara:', err);
  });