// KINAM Energy | app instalable en Mac, PC, Android e iOS
(function () {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  }

  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const buttons = [...document.querySelectorAll("[data-install]")];
  if (standalone || !buttons.length) return;

  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const macSafari = !ios && /Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg\//.test(ua);
  let deferred = null;

  // Instrucciones para los navegadores que no tienen botón de instalación propio.
  const STEPS = ios
    ? ["Toca el botón <strong>Compartir</strong> (el cuadro con la flecha hacia arriba).", "Elige <strong>Agregar a pantalla de inicio</strong>.", "Toca <strong>Agregar</strong>. El ícono de KINAM queda junto a tus apps."]
    : macSafari
      ? ["En la barra de menú, abre <strong>Archivo</strong>.", "Elige <strong>Agregar al Dock</strong>.", "Confirma con <strong>Agregar</strong>. KINAM se abre como app desde el Dock."]
      : ["Abre el menú del navegador (⋮ o …).", "Elige <strong>Instalar KINAM</strong> o <strong>Agregar a pantalla de inicio</strong>.", "Si no aparece, abre el sitio en Chrome, Edge o Safari."];

  function dialog() {
    let d = document.getElementById("install-dialog");
    if (!d) {
      d = document.createElement("div");
      d.id = "install-dialog";
      d.className = "install";
      d.setAttribute("role", "dialog");
      d.setAttribute("aria-modal", "true");
      d.setAttribute("aria-labelledby", "install-title");
      d.innerHTML = `<div class="install__card"><h2 id="install-title">Instala la app de KINAM</h2><ol>${STEPS.map((s) => `<li>${s}</li>`).join("")}</ol><button class="btn btn--primary btn--block" type="button">Entendido</button></div>`;
      d.addEventListener("click", (e) => { if (e.target === d || e.target.closest("button")) d.hidden = true; });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") d.hidden = true; });
      document.body.appendChild(d);
    }
    d.hidden = false;
    d.querySelector("button").focus();
  }

  const show = () => buttons.forEach((b) => { b.hidden = false; });
  buttons.forEach((b) => b.addEventListener("click", async () => {
    if (deferred) {
      deferred.prompt();
      await deferred.userChoice;
      deferred = null;
    } else {
      dialog();
    }
  }));

  // Chrome y Edge (PC, Mac, Android) avisan cuando la app se puede instalar.
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; show(); });
  window.addEventListener("appinstalled", () => buttons.forEach((b) => { b.hidden = true; }));
  if (ios || macSafari) show();
})();
