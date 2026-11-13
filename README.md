# Proyecto Interactivo

Juego tipo **Pictionary con dibujo por gestos de la mano**: usás la cámara como entrada y dibujás en un canvas sin tocar la pantalla. Incluye paleta de colores, cronómetro con cuenta regresiva, sonidos, un panel lateral con la guía de gestos y una **impresora de tickets física** que entrega las palabras a dibujar y una foto de recuerdo.

## Modo de juego

Se juega por equipos, como un Pictionary:

1. Un jugador pasa al frente y saca una **palabra** de la impresora de tickets (botón **Nueva palabra**). Solo esa persona la ve.
2. Con el 👍 pulgar arriba arranca el cronómetro (3-2-1-¡A dibujar!).
3. Dibuja la palabra en el aire usando los gestos, y su equipo tiene que **adivinarla antes de que termine el tiempo**.
4. Si el equipo adivina, el jugador hace el gesto de la "L": se frena el cronómetro y aparece "¡Felicitaciones!". Si el cronómetro llega a 0, aparece "¡Se terminó el tiempo!".
5. En algún momento de la partida se puede sacar una **foto** (cámara + dibujo, botón **Imprimir**), que sale por la misma impresora de tickets para que el jugador se la lleve como **recuerdo del juego**.

## Cómo se usa

1. Conectá la impresora de tickets por USB.
2. Ejecutá `node servidor/servidor.js` y abrí http://localhost:3000 (requiere internet para los CDN y la cámara).
3. Parate frente a la cámara y mostrá la mano.
4. Usá los gestos para dibujar, cambiar de color, borrar y manejar el cronómetro. La guía de gestos queda siempre visible en el panel lateral.
5. Tocá **Nueva palabra** para imprimir una palabra al azar, o **Imprimir** para sacar la foto e imprimirla como ticket.

## Impresora de tickets

Al juego se le incorpora de manera física una **impresora térmica de tickets** (XPrinter), que cumple dos funciones:

- **Palabras:** imprime la palabra que el jugador tiene que dibujar. Reemplaza a las tarjetas del Pictionary: cada jugador saca su ticket antes de arrancar el cronómetro.
- **Foto de recuerdo:** imprime una foto de la cámara con el dibujo encima, para que el jugador se la lleve.

Funciona en Windows con una impresora térmica USB compatible con ESC/POS (XPrinter) y solo necesita Node.js: no hay que instalar drivers ni crear una cola de impresión. El navegador arma el ticket (`assets/js/ticket.js`) y el servidor local se lo pasa a la impresora (`servidor/`).

- **Papel:** `TICKET_ANCHO_PUNTOS` en `config.js`: `384` para 58 mm, `576` para 80 mm.
- **Palabras:** la lista está en `PALABRAS` en `config.js`. Salen al azar sin repetirse hasta que salieron todas; al recargar la página la lista vuelve a empezar.
- **Otra impresora:** cambiá `IMPRESORA_USB` en `servidor/servidor.js` por su VID y PID (Administrador de dispositivos → Detalles → Id. de hardware).
- Con otro servidor (Live Server, `python -m http.server`) la página funciona, pero los botones **Imprimir** y **Nueva palabra** no.

## Gestos

| Gesto | Acción |
| ----- | ------ |
| ☝️ Solo índice extendido | Dibujar (mantener ~0,5 s para activar el puntero) |
| ✌️ Índice + medio (2 dedos) | No dibujar: pausa el trazo para mover la mano sin marcar |
| 🤟 Índice + medio + anular (3 dedos) | Cambiar de color: abre la paleta **alrededor del puntero**; en cuanto el dedo pisa un color, lo elige, la paleta desaparece y seguís dibujando |
| ✋ Mano abierta (5 dedos) | Borrador (mantener ~0,5 s para activarlo) |
| 👍 Pulgar arriba | Arranca el cronómetro (3-2-1-¡A dibujar!) |
| 🇱 Índice + pulgar en forma de "L" | Finaliza el cronómetro y muestra "¡Felicitaciones!" |

Durante la cuenta 3-2-1 quedan bloqueados dibujar, borrar, la paleta y finalizar, para que nadie arranque antes de tiempo.

### Panel lateral de gestos

En el costado de la pantalla hay un **panel fijo** que muestra los seis gestos principales con su imagen y su nombre (Dibujar, No dibujar, Cambiar de color, Borrar, Arranca el cronómetro, Finaliza el cronómetro). Está visible **todo el tiempo durante el juego**, así los jugadores no tienen que memorizarlos ni abrir ninguna ayuda. Las imágenes están en `assets/img/panel/`.

Como la guía ya está siempre a la vista, los botones **Limpiar**, **Reglas** y **Gestos** están ocultos (siguen en el código, escondidos desde `styles.css`).

## Funciones principales

- **Detección de manos** con MediaPipe Hands (una sola mano) a ~30 fps.
- **Dibujo estilizado**: puntero con tiempo de carga, trazo suavizado y tolerancia a cortes (no se parte la línea ante parpadeos).
- **Borrador** con anillo de carga progresivo.
- **Paleta de 8 colores alrededor del puntero**: aparece con el gesto de 3 dedos (sin fondo, solo un círculo fino), se dibuja en una capa de interfaz aparte que se limpia cada frame (así no se acumula encima del dibujo), se elige con el mismo puntero y desaparece al elegir (con feedback visual: círculo + ✓).
- **Cronómetro** con anillo de progreso, cuenta regresiva 3-2-1, aviso a los 10 s, aviso de fin de tiempo y celebración.
- **Audios** para eventos: countdown a 10 s, ¡A dibujar!, felicitaciones y tiempo terminado.
- **Panel lateral de gestos** siempre visible.
- **Impresión de tickets**: palabra al azar para dibujar y foto de recuerdo (cámara + dibujo).

## Juegos propuestos (deshabilitados por ahora)

Además del modo Pictionary, el proyecto tiene desarrollados tres **juegos con plantilla guía** que se dibujan sobre el canvas:

- **Ta Te Ti**: grilla de 3×3.
- **La Papa**: números del 1 al 10.
- **Laberinto**.

Se eligen desde un menú en pantalla por *dwell time* (mantener el dedo 1 s sobre la opción). **Hoy ese menú está deshabilitado**, para que el juego se concentre en el modo Pictionary. El código no se eliminó a propósito: la idea es **profundizar en estos juegos e incorporarlos a futuro** como opciones adicionales de juego.

## Tecnologías

**Software**

- **HTML5 + CSS3 + JavaScript** (vanilla, sin frameworks).
- **MediaPipe Hands** (CDN): detección y tracking de los 21 landmarks de la mano.
- **MediaPipe Camera Utils**: loop de frames de la cámara.
- **Canvas 2D API**: render de trazos, borrador, paleta y plantillas, y armado de la imagen del ticket.
- **Node.js**: servidor local que sirve la página y recibe los tickets (sin dependencias externas).
- **ESC/POS**: lenguaje de comandos de la impresora térmica; el ticket se arma en el navegador.
- **PowerShell**: script que escribe el ticket directo en la impresora USB (Windows).
- **Google Fonts · Noto Sans**: tipografía de la interfaz.
- Archivos multimedia locales: `mp3` (audios), `mp4` (video de reglas) y `png` (imágenes del panel de gestos).

**Hardware**

- **Cámara web**: entrada para detectar la mano.
- **Impresora térmica de tickets USB** compatible con ESC/POS (XPrinter, papel de 58 u 80 mm): imprime las palabras y la foto de recuerdo.

## Estructura del proyecto

```
proyecto-interactivo/
├── index.html                  # Punto de entrada: carga CDNs, fuentes, scripts y el panel de gestos
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
│   ├── img/
│   │   ├── gestos.png          # Guía de gestos del botón Gestos (oculto)
│   │   └── panel/              # Imágenes del panel lateral (una por gesto)
│   └── js/
│       ├── config.js           # Todas las constantes configurables
│       ├── canvas.js           # Canvas de dibujo + capa de interfaz (paleta)
│       ├── paleta.js           # Paleta radial: apertura, selección y dibujo del anillo
│       ├── gestos.js           # Reconocimiento puro de gestos (landmarks → string)
│       ├── manos.js            # Estado persistente por mano, suavizado, cursors, anillos de carga
│       ├── plantillas.js       # Menú + plantillas (tateti, papa, laberinto), deshabilitado por ahora
│       ├── cronometro.js       # Cronómetro, countdown, overlays, audios
│       ├── audio.js            # Carga y reproduce los sonidos
│       ├── reglas.js           # Botón y video de reglas (botón oculto)
│       ├── mostrar-gestos.js   # Botón Gestos y su imagen (botón oculto)
│       ├── ticket.js           # Botones Imprimir y Nueva palabra: arma el ticket en ESC/POS
│       └── mediapipe.js        # Inicializa MediaPipe, cámara y orquesta todo
├── servidor/
│   ├── servidor.js             # Sirve la página y recibe los tickets
│   └── enviar-a-impresora.ps1  # Escribe el ticket en la impresora USB
└── README.md
```

El **orden de carga importa** (index.html): `config` primero porque todos lo usan, `mediapipe` último porque necesita todo lo demás.

## Configuración

Todo se ajusta desde un solo lugar: `assets/js/config.js`. Algunos ejemplos:

- `MAX_MANOS: 1` → cantidad de manos rastreadas.
- `COLORES` / `PALETA_*` → paleta (radio de cada color, distancia al puntero, tolerancia, margen contra los bordes).
- `CRONOMETRO_SEGUNDOS` → duración por defecto del cronómetro.
- `GROSOR_TRAZO`, `RADIO_BORRADO`, `FACTOR_SUAVIZADO` → dibujo.
- `TIEMPO_CARGA_*_MS` → tiempo de carga del puntero/borrador.
- `FRAMES_PULGAR_ARRIBA`, `FRAMES_FELICITACION`, `FRAMES_GESTO_PALETA`, `MAX_FALTAS_PALETA`, `COSENO_MAX_GESTO_L` → sensibilidad de los gestos.
- `PALETA_TIMEOUT_MS` → cuánto tiempo queda abierta la paleta sin elegir color.
- `PALABRAS` / `TICKET_ANCHO_PUNTOS` → palabras del juego y ancho del papel de la impresora.
- `AUDIOS` → mapa de eventos de sonido (agregar uno nuevo = poner el archivo + sumarlo acá).

## Modo debug

Abrí la página con `?debug` al final de la URL (ej.: `index.html?debug`). Abajo a la izquierda aparece en vivo qué dedos ve extendidos MediaPipe y qué gesto queda detectado:

```
dedos 1110  pulgar 0  ->  tresDedos
dedos 0111  pulgar 1  ->  borra
```

Los primeros 4 números son índice, medio, anular y meñique (`1` = extendido). También se escribe en la consola. Sirve para ver por qué un gesto no se dispara en vez de adivinar; el overlay no existe si no usás el parámetro.

## Requisitos y notas

- *Requiere internet* la primera vez que cargan los CDN de MediaPipe y Google Fonts (luego el navegador los cachea).
- Cámara/webcam habilitada y permisos concedidos al navegador.
- Para servir el proyecto usá `node servidor/servidor.js` (requiere Node.js instalado).
- La impresión de tickets funciona en Windows con la impresora térmica conectada por USB.
- Los archivos de audio y video no están incluidos como código: están en `assets/audio/` y `assets/video/`.