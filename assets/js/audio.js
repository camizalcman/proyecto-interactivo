// ─────────────────────────────────────────────────────────────
// AUDIOS
// Reproduce sonidos del proyecto. Los archivos viven en la carpeta
// CONFIG.AUDIO_CARPETA (por defecto assets/audio/).
// Uso: reproducirAudio('countdown') → assets/audio/countdown.mp3
// ─────────────────────────────────────────────────────────────

// Se cargan todos al arrancar (Audio pre-carga lo que puede).
const audios = {};
Object.entries(CONFIG.AUDIOS).forEach(([evento, archivo]) => {
  audios[evento] = new Audio(CONFIG.AUDIO_CARPETA + archivo);
});

// Reproduce el audio "evento". Si el archivo no existe o el navegador
// bloquea el autoplay, no rompe nada: simplemente no suena.
function reproducirAudio(evento) {
  const audio = audios[evento];
  if (!audio) return;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}