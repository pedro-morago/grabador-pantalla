"use strict";

// Utilidades compartidas por offscreen.js (grabación de pestaña) y
// recorder.js (grabación de pantalla/ventana). Se carga antes que ellos.

const QUALITY = {
  high: { frameRate: 30, videoBitsPerSecond: 8_000_000 },
  medium: { frameRate: 30, videoBitsPerSecond: 4_000_000 },
  light: { frameRate: 15, videoBitsPerSecond: 1_500_000 },
};

const pad = (n) => String(n).padStart(2, "0");

function stamp() {
  const d = new Date();
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`
  );
}

function pickMime() {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || "";
}

function humanError(e) {
  const name = e && e.name;
  if (name === "NotAllowedError") return "permiso denegado (NotAllowedError).";
  if (name === "NotFoundError") return "no se encontró la fuente (NotFoundError).";
  if (name === "NotReadableError") return "la fuente está en uso o no se puede leer (NotReadableError).";
  return (name ? name + ": " : "") + (e && e.message ? e.message : String(e));
}

// Combina audio del sistema y micrófono en una pista. Con playthrough,
// reinyecta el audio del sistema a los altavoces (necesario al capturar
// pestañas, porque Chrome las silencia mientras se capturan).
function buildAudioGraph(sysTrack, micTrack, playthrough) {
  if (!sysTrack && !micTrack) return { audioTrack: null, audioCtx: null };
  if (!sysTrack) return { audioTrack: micTrack, audioCtx: null }; // solo micro

  const ctx = new AudioContext();
  const dest = ctx.createMediaStreamDestination();

  const sys = ctx.createMediaStreamSource(new MediaStream([sysTrack]));
  sys.connect(dest);
  if (playthrough) sys.connect(ctx.destination);

  if (micTrack) {
    ctx.createMediaStreamSource(new MediaStream([micTrack])).connect(dest);
  }
  return { audioTrack: dest.stream.getAudioTracks()[0], audioCtx: ctx };
}
