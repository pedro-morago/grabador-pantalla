# Grabador de pantalla (extensión Chrome MV3)

Extensión de grabación de pantalla sin límites de tiempo ni marca de agua.
JS plano, sin build: se carga descomprimida en Chrome.

## Arquitectura

- `background.js` (service worker): orquesta estado, mensajes y descargas.
  Estado en `chrome.storage.session` (el popup lo lee directamente).
- `offscreen.html/js`: graba la PESTAÑA actual a partir del streamId de
  `chrome.tabCapture.getMediaStreamId`. Invisible.
- `recorder.html/js`: ventana propia que graba PANTALLA o VENTANA. Abre el
  selector y consume el streamId en su MISMO frame. Se minimiza al grabar
  y se cierra sola al guardar. Si se cierra a mano, la grabación se pierde.
- `capture-common.js`: utilidades compartidas (calidad, mime, mezcla de audio).
- `popup.html/js`: UI de control. `permission.html/js`: concesión única del
  permiso de micrófono.
- Mensajería: `chrome.runtime.sendMessage` con campo `target`
  ("background" | "offscreen" | "recorder").

## Restricciones MV3 aprendidas (NO revertir)

1. `chrome.desktopCapture.chooseDesktopMedia` desde el service worker EXIGE
   `targetTab` ("A target tab is required when called from a service worker
   context"), y con `targetTab` el streamId queda ligado al origen de esa
   pestaña web, inconsumible desde contextos de la extensión. Por eso el
   selector vive en `recorder.html`, no en el SW.
2. El streamId del selector de escritorio solo se consume con fiabilidad en
   el MISMO frame que lo pidió. No transferirlo al documento offscreen.
3. Pestañas y escritorio usan fuentes distintas en getUserMedia:
   `chromeMediaSource: "tab"` para streamIds de tabCapture,
   `chromeMediaSource: "desktop"` para el selector de pantalla/ventana.
   Mezclarlos produce `AbortError: Error starting tab capture`.
4. Chrome silencia la pestaña mientras se captura: hay playthrough del audio
   via AudioContext SOLO en el flujo de pestaña (en pantalla completa
   duplicaría el sonido del sistema).
5. El documento offscreen no puede mostrar el aviso de permiso del
   micrófono: la concesión inicial se hace en `permission.html`.
6. La sintaxis `mandatory: { chromeMediaSource, chromeMediaSourceId }` es
   legacy pero es la requerida para este tipo de captura.

## Probar

1. `chrome://extensions` → Modo de desarrollador → "Cargar descomprimida"
   → esta carpeta.
2. Recargar la extensión tras cada cambio (no hay hot reload).
3. Logs: consola del service worker (`[SW]`) y, en "Inspeccionar vistas",
   `offscreen.html` (`[offscreen]`) y `recorder.html` (`[recorder]`).
4. Salida: `Descargas/grabaciones-pantalla/*.webm`.
   MP4: `ffmpeg -i entrada.webm -c:v libx264 -c:a aac salida.mp4`.
