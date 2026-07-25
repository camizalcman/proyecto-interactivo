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
  MAX_MANOS: 4,
  MODEL_COMPLEXITY: 1,           // 0 = más rápido pero menos preciso
                                 // 1 = más preciso pero más lento
  MIN_DETECTION_CONFIDENCE: 0.7, // confianza mínima para considerar
                                 // que detectó una mano (0 a 1)
  MIN_TRACKING_CONFIDENCE: 0.5,  // confianza mínima para seguir
                                 // trackeando una mano ya detectada

  // ── Dibujo ───────────────────────────────────────────────────
  GROSOR_TRAZO: 6,

  // ──────────────────────────────────────────────────────────────
  // GROSOR DEL BORRADO: este es el número que controla qué tan grande
  // es el círculo que borra cuando hacés el gesto de puño cerrado.
  // Cuanto más grande, más "ancho" borra de un solo pase.
  // ──────────────────────────────────────────────────────────────
  RADIO_BORRADO: 50,

  // SUAVIZADO: 0 = sin suavizado (crudo), 1 = muy suavizado (más lag)
  FACTOR_SUAVIZADO: 0.5,

  // CONTADOR DE FRAMES PERDIDOS POR MANO: si una mano deja de detectarse
  // por culpa de una oclusión momentánea (ej: se cruza con otra mano),
  // no queremos olvidarla enseguida -> le damos un margen de unos frames
  // antes de borrar su posición y "soltar" su slot.
  MAX_FRAMES_PERDIDOS: 8, // ~250ms a 30fps de tolerancia

  UMBRAL_MAX_DISTANCIA: 250, // px. Si nada quedó tan cerca, se considera mano nueva

  // ── Paleta de colores ─────────────────────────────────────────
  COLORES: ['red', '#e88802', 'yellow', '#65d72b', 'blue', '#50e8eb', '#f66c9c', '#9605d5'],
  PALETA_X: 60,
  PALETA_Y_INICIO: 60,
  PALETA_ESPACIADO: 80,
  PALETA_RADIO: 30,

  // ── Color inicial ─────────────────────────────────────────────
  COLOR_INICIAL: 'blue',
};