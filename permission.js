"use strict";

const statusEl = document.getElementById("status");
const retryBtn = document.getElementById("retry");

async function ask() {
  statusEl.className = "";
  statusEl.textContent = "Solicitando permiso…";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    statusEl.className = "ok";
    statusEl.textContent = "Micrófono permitido. Esta pestaña se cerrará sola.";
    setTimeout(() => {
      chrome.tabs.getCurrent((tab) => tab && chrome.tabs.remove(tab.id));
    }, 1500);
  } catch (e) {
    statusEl.className = "fail";
    statusEl.textContent =
      "No se concedió el permiso (" +
      (e.name || "error") +
      "). Pulsa el icono del candado o de la cámara en la barra de direcciones, permite el micrófono y reintenta.";
  }
}

retryBtn.addEventListener("click", ask);
ask();
