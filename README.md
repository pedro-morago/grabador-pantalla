# Grabador de pantalla

Extensión de Chrome (Manifest V3) para grabar pantalla, ventana o pestaña. Sin límites de tiempo, sin marca de agua, sin cuenta.

## Qué hace

- Graba la pestaña actual con un clic, audio incluido automáticamente
- Graba pantalla completa o una ventana, con el selector nativo de Chrome
- Micrófono opcional, mezclado con el audio capturado
- Tres niveles de calidad (bitrate/fps)
- Exporta a `.webm`; conversión a MP4 documentada más abajo

## Por qué existe

Ejercicio de portfolio: reproducir la mecánica de herramientas como Nimbus o Loom usando solo APIs nativas del navegador, sin dependencias externas. El mercado de grabadores de pantalla está saturado y hay alternativas gratuitas mejores (Screenity, por ejemplo), así que el interés no es competir con eso. Es entender cómo se comporta Manifest V3 cuando la captura tiene que sobrevivir en segundo plano, y depurarlo con el mismo método que uso en QA: aislar el síntoma, mirar la consola, no dar nada por sentado.

## Decisiones y callejones sin salida

Manifest V3 impone restricciones de seguridad que no están bien documentadas hasta que las rompes. Tres de las que más costaron:

**1. El service worker no puede abrir el selector de escritorio sin `targetTab`, y con `targetTab` el resultado es inservible.**
`chrome.desktopCapture.chooseDesktopMedia` exige una pestaña de destino si se llama desde un service worker (`A target tab is required when called from a service worker context`). Pero pasar esa pestaña ata el `streamId` resultante al origen de esa pestaña web, y ningún contexto de la extensión puede consumirlo después. La salida: el selector no vive en el service worker, vive en una ventana propia de la extensión (`recorder.html`), que además consume el `streamId` en el mismo frame que lo pidió — el único punto donde Chrome garantiza que funcione.

**2. Pestañas y escritorio no comparten tubería.**
Un `streamId` de `chrome.tabCapture` solo es válido con `chromeMediaSource: "tab"`; uno del selector de escritorio, solo con `"desktop"`. Mezclarlos da `AbortError: Error starting tab capture`, sin más contexto. Son dos flujos separados: pestaña por `tabCapture.getMediaStreamId` (documento offscreen, invisible), escritorio por el selector (ventana visible que se minimiza sola mientras graba).

**3. Chrome silencia la pestaña que capturas.**
Sin corregirlo, grabas vídeo con audio pero dejas de oír la pestaña mientras grabas. La solución reinyecta el audio capturado a los altavoces vía `AudioContext`, solo en el flujo de pestaña (en pantalla completa duplicaría el sonido del sistema).

El detalle técnico completo, pensado para que una sesión de Claude Code lo lea antes de tocar código, está en [`CLAUDE.md`](./CLAUDE.md).

## Instalar

1. Clona el repo
2. `chrome://extensions` → activa **Modo de desarrollador**
3. **Cargar descomprimida** → selecciona la carpeta del repo

## Roadmap

La versión actual es un grabador genérico. La siguiente iteración, con más valor real, es un grabador orientado a reportes de bugs de QA: adjuntar automáticamente logs de consola, peticiones de red fallidas y metadatos del navegador a cada grabación, con exportación directa a Jira o Linear.

## Licencia

MIT. Ver [`LICENSE`](./LICENSE).
