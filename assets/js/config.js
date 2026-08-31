// ─────────────────────────────────────────────────────────────
// CONFIGURACIÓN GLOBAL
// Todas las constantes del proyecto en un solo lugar.
// Si necesitás ajustar algo (colores, grosor, sensibilidad),
// lo cambiás acá y afecta a todo el proyecto automáticamente.
// ─────────────────────────────────────────────────────────────

const CONFIG = {

  // ── Cámara ───────────────────────────────────────────────────
  CAMARA_ANCHO: 1280,  // resolución del stream de la cámara
  CAMARA_ALTO: 720,    // 720p es suficiente para esta etapa

  // ── MediaPipe ────────────────────────────────────────────────
  MAX_MANOS: 1, // prueba con una sola mano (para dibujar y para borrar)
  MODEL_COMPLEXITY: 1,           // 0 = más rápido pero menos preciso
                                 // 1 = más preciso pero más lento
  MIN_DETECTION_CONFIDENCE: 0.7, // confianza mínima para considerar
                                 // que detectó una mano (0 a 1)
  MIN_TRACKING_CONFIDENCE: 0.5,  // confianza mínima para seguir
                                 // trackeando una mano ya detectada

  // ── Dibujo ───────────────────────────────────────────────────
  GROSOR_TRAZO: 6, // grosor fi‍jo del trazo (siempre el mismo)

  // ──────────────────────────────────────────────────────────────
  // GROSOR DEL BORRADO: este es el número que controla qué tan grande
  // es el círculo que borra cuando hacés el gesto de puño cerrado.
  // Cuanto más grande, más "ancho" borra de un solo pase.
  // ──────────────────────────────────────────────────────────────
  RADIO_BORRADO: 60,

  // TIEMPO DE CARGA DEL BORRADOR: para borrar hay que mantener el puño cerrado
  // este tiempo (en milisegundos). Mientras carga se ve el anillo rellenándose;
  // si se abre la mano antes, no borra y sigue como si nada.
  TIEMPO_CARGA_BORRADO_MS: 500,

  // TIEMPO DE CARGA DEL DIBUJO: lo mismo para el puntero de dibujo. Hay que
  // mantener el dedo índice extendido este tiempo (en ms) para que el puntero
  // se "active"; mientras carga se ve el anillo llenándose. Si se baja el dedo
  // antes, no dibuja.
  TIEMPO_CARGA_DIBUJO_MS: 500, // 0.5 segundos

  // SUAVIZADO: 0 = sin suavizado (crudo, más preciso pero tembloroso),
  // 1 = muy suavizado (más estable pero con lag).
  FACTOR_SUAVIZADO: 0.4,

  // CONTADOR DE FRAMES PERDIDOS POR MANO: si una mano deja de detectarse
  // por culpa de una oclusión momentánea (ej: se cruza con otra mano),
  // no queremos olvidarla enseguida -> le damos un margen de unos frames
  // antes de borrar su posición y "soltar" su slot.
  MAX_FRAMES_PERDIDOS: 8, // ~250ms a 30fps de tolerancia

  // Tolerancia a cortes del trazo: cuántos frames seguidos puede estar la mano
  // presente pero sin gesto de dibujo antes de cortar la línea. Evita que un
  // parpadeo del reconocimiento de gestos corte el trazo.
  MAX_FALTAS_DIBUJA: 6,

  // Distancia máxima (px) entre el último punto y el nuevo para "empalmar" el
  // trazo cuando la mano se perdió y reapareció. Si reaparece más lejos, se
  // empieza una línea nueva en vez de unir con un garabato largo.
  GAP_MAX: 90,

  UMBRAL_MAX_DISTANCIA: 250, // px. Si nada quedó tan cerca, se considera mano nueva

  // ── Paleta de colores ─────────────────────────────────────────
  COLORES: ['red', '#e88802', 'yellow', '#65d72b', 'blue', '#50e8eb', '#f66c9c', '#9605d5'],
  PALETA_X: 60,
  PALETA_Y_INICIO: 60,
  PALETA_ESPACIADO: 80,
  PALETA_RADIO: 30,

  // ── Color inicial ─────────────────────────────────────────────
  COLOR_INICIAL: 'blue',

  // ── Cronómetro ───────────────────────────────────────────────
  // Cantidad de segundos por defecto del cronómetro (editable en pantalla).
  CRONOMETRO_SEGUNDOS: 60,
};