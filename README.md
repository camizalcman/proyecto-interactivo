# Proyecto Interactivo

Aplicación web de **dibujo por gestos de la mano**: usás la cámara como entrada y dibujás en un canvas sin tocar la pantalla. Incluye paleta de colores, cronómetro con cuenta regresiva y sonidos.

## Cómo se usa

1. Abrí `index.html` con un servidor local (requiere internet para los CDN y la cámara).
2. Parate frente a la cámara y mostrá la mano.
3. Usá los gestos de la tabla para dibujar, borrar, arrancar el cronómetro y celebrar.

## Gestos

| Gesto | Acción |
| ----- | ------ |
| ☝️ Solo índice extendido | Dibujar (mantener ~0,5 s para activar el puntero) |
| ✌️ Índice + medio | Pausa del trazo |
| ✋ Mano abierta (5 dedos) | Borrador (mantener ~0,5 s para activarlo) |
| 👍 Pulgar arriba | Arranca el cronómetro (3-2-1-¡A dibujar!) |
| 🇱 Índice + pulgar en forma de "L" | Frena el cronómetro y muestra "¡Felicitaciones!" |
| Tocando la paleta lateral | Cambia el color de dibujo |
| Mantener el dedo sobre un ícono del menú (1 s) | Selecciona una plantilla |

Al llegar el cronómetro a 0 aparece "¡Se terminó el tiempo!". El botón **Limpiar** borra el canvas y **Reglas** abre un video con las instrucciones.

## Funciones principales

- **Detección de manos** con MediaPipe Hands (una sola mano) a ~30 fps.
- **Dibujo estilizado**: puntero con tiempo de carga, trazo suavizado y tolerancia a cortes (no se parte la línea ante parpadeos).
- **Borrador** con anillo de carga progresivo.
- **Paleta de 8 colores** con feedback visual (círculo + ✓) al cambiar de color.
- **Cronómetro** con anillo de progreso, cuenta regresiva 3-2-1, aviso a los 10 s, aviso de fin de tiempo y celebración.
- **Plantillas guía**: Ta Te Ti (grilla 3×3), La Papa (números 1–10) y Laberinto, seleccionables por *dwell time* (mantener el dedo 1 s).
- **Audios** para eventos: countdown a 10 s, ¡A dibujar!, felicitaciones y tiempo terminado.
- **Video de reglas** desde un botón en pantalla.

## Tecnologías

- **HTML5 + CSS3 + JavaScript** (vanilla, sin frameworks).
- **MediaPipe Hands** (CDN): detección y tracking de los 21 landmarks de la mano.
- **MediaPipe Camera Utils**: loop de frames de la cámara.
- **Canvas 2D API**: render de trazos, borrador, paleta y plantillas.
- **Google Fonts · Noto Sans**: tipografía de la interfaz.
- Archivos multimedia locales: `mp3` (audios) y `mp4` (video de reglas).

## Estructura del proyecto

```
proyecto-interactivo/
├── index.html                  # Punto de entrada: carga CDNs, fuentes y scripts
├── assets/
│   ├── css/
│   │   └── styles.css          # Estilos: layout, botones, overlay de reglas
│   ├── audio/                  # Sonidos del juego (mp3)
│   │   ├── countdown.mp3       # Faltan 10 segundos
│   │   ├── dibujar.mp3         # Texto "¡A dibujar!"
│   │   ├── gameOver.mp3        # Se terminó el tiempo
│   │   └── win.mp3             # "¡Felicitaciones!"
│   ├── video/
│   │   └── reglas.mp4          # Video instructivo del botón Reglas
│   └── js/
│       ├── config.js           # Todas las constantes configurables
│       ├── canvas.js           # Canvas, tamaño, limpiar
│       ├── paleta.js           # Colores y zona de la paleta
│       ├── gestos.js           # Reconocimiento puro de gestos (landmarks → string)
│       ├── manos.js            # Estado persistente por mano, suavizado, cursors, anillos de carga
│       ├── plantillas.js       # Menú + plantillas (tateti, papa, laberinto)
│       ├── cronometro.js       # Cronómetro, countdown, overlays, audios
│       ├── audio.js            # Carga y reproduce los sonidos
│       ├── reglas.js           # Botón y video de reglas
│       └── mediapipe.js        # Inicializa MediaPipe, cámara y orquesta todo
└── README.md
```

El **orden de carga importa** (index.html): `config` primero porque todos lo usan, `mediapipe` último porque necesita todo lo demás.

## Configuración

Todo se ajusta desde un solo lugar: `assets/js/config.js`. Algunos ejemplos:

- `MAX_MANOS: 1` → cantidad de manos rastreadas.
- `COLORES` / `PALETA_*` → paleta y disposición.
- `CRONOMETRO_SEGUNDOS` → duración por defecto del cronómetro.
- `GROSOR_TRAZO`, `RADIO_BORRADO`, `FACTOR_SUAVIZADO` → dibujo.
- `TIEMPO_CARGA_*_MS` → tiempo de carga del puntero/borrador.
- `FRAMES_PULGAR_ARRIBA`, `FRAMES_FELICITACION`, `COSENO_MAX_GESTO_L` → sensibilidad de los gestos.
- `AUDIOS` → mapa de eventos de sonido (agregar uno nuevo = poner el archivo + sumarlo acá).

## Requisitos y notas

- *Requiere internet* la primera vez que cargan los CDN de MediaPipe y Google Fonts (luego el navegador los cachea).
- Cámara/webcam habilitada y permisos concedidos al navegador.
- Para servir el proyecto usá un servidor local (ej.: `python -m http.server` o la extensión Live Server de VS Code).
- Los archivos de audio y video no están incluidos como código: están en `assets/audio/` y `assets/video/`.