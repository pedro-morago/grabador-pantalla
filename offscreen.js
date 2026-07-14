"use strict";

// Documento offscreen: graba la PESTAÑA actual a partir del streamId de
// chrome.tabCapture. La grabación de pantalla/ventana vive en recorder.js.
// Requiere capture-common.js cargado antes.

const log = (...a) => console.log("[offscreen]", ...a);

let recorder = null;
let chunks = [];
let displayStream = null;
let micStream = null;
let audioCtx = null;
let blobUrl = null;

function toBackground(type, extra) {
  chrome.runtime.sendMessage({ target: "background", type, ...extra });
}

// ---------- Mensajes ----------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.target !== "offscreen") return false;

  if (msg.type === "off:start") {
    start(msg)
      .then(() => sendResponse({ ok: true }))
      .catch((e) => {
        log("error al iniciar:", e);
        cleanupStreams();
        sendResponse({ ok: false, error: humanError(e) });
      });
    return true; // respuesta asíncrona
  }

  if (msg.type === "off:stop") {
    stop();
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === "off:cleanup") {
    if (msg.url) {
      URL.revokeObjectURL(msg.url);
      if (msg.url === blobUrl) blobUrl = null;
      log("blob revocado tras la descarga");
    }
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

// ---------- Captura de pestaña ----------

async function start({ streamId, systemAudio, mic, quality }) {
  const q = QUALITY[quality] || QUALITY.medium;
  log("start", { systemAudio, mic, quality });

  // streamId de tabCapture: se consume como chromeMediaSource "tab".
  displayStream = await navigator.mediaDevices.getUserMedia({
    audio: systemAudio
      ? { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId } }
      : false,
    video: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId,
        maxFrameRate: q.frameRate,
      },
    },
  });
  log("captura obtenida:", displayStream.getTracks().map((t) => t.kind + " · " + t.label));

  // Micrófono, opcional. Si falla, se sigue grabando y se avisa.
  let micTrack = null;
  if (mic) {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      micTrack = micStream.getAudioTracks()[0];
      log("micrófono:", micTrack.label);
    } catch (e) {
      log("micrófono no disponible:", e.name, e.message);
      toBackground("sw:warn", {
        message:
          "Grabando sin micrófono: " +
          humanError(e) +
          " Concede el permiso desde el popup (interruptor de micrófono).",
      });
    }
  }

  const videoTrack = displayStream.getVideoTracks()[0];
  const sysTrack = displayStream.getAudioTracks()[0] || null;
  if (systemAudio && !sysTrack) {
    toBackground("sw:warn", {
      message: "Chrome no entregó la pista de audio de la pestaña; se graba sin ella.",
    });
  }

  // Chrome silencia la pestaña capturada: playthrough siempre.
  const graph = buildAudioGraph(sysTrack, micTrack, true);
  audioCtx = graph.audioCtx;
  const combined = new MediaStream(
    graph.audioTrack ? [videoTrack, graph.audioTrack] : [videoTrack]
  );

  videoTrack.addEventListener("ended", () => {
    log("captura finalizada por el usuario");
    stop();
  });

  const mimeType = pickMime();
  chunks = [];
  recorder = new MediaRecorder(
    combined,
    mimeType
      ? { mimeType, videoBitsPerSecond: q.videoBitsPerSecond }
      : { videoBitsPerSecond: q.videoBitsPerSecond }
  );
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };
  recorder.onstop = finalize;
  recorder.onerror = (e) => {
    const detail = (e.error && e.error.message) || "desconocido";
    log("MediaRecorder error:", detail);
    toBackground("sw:error", { message: "Error del grabador: " + detail });
    cleanupStreams();
  };
  recorder.start(1000);
  log("grabando con", recorder.mimeType || "codec por defecto");
}

function stop() {
  if (recorder && recorder.state !== "inactive") recorder.stop();
}

function finalize() {
  log("finalizando;", chunks.length, "fragmentos");
  const type = (recorder && recorder.mimeType) || "video/webm";
  const blob = new Blob(chunks, { type });
  chunks = [];
  if (blobUrl) URL.revokeObjectURL(blobUrl);
  blobUrl = URL.createObjectURL(blob);

  toBackground("sw:complete", {
    from: "offscreen",
    url: blobUrl,
    filename: `grabaciones-pantalla/grabacion-${stamp()}.webm`,
    bytes: blob.size,
  });
  cleanupStreams();
}

function cleanupStreams() {
  [displayStream, micStream].forEach(
    (s) => s && s.getTracks().forEach((t) => t.stop())
  );
  displayStream = micStream = null;
  if (audioCtx) {
    audioCtx.close().catch(() => {});
    audioCtx = null;
  }
  recorder = null;
}
