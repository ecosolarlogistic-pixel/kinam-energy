// KINAM Energy | service worker: la app abre rápido y muestra un aviso si no hay internet.
// Cambia VERSION al publicar cambios de diseño para que los dispositivos se actualicen.
const VERSION = "kinam-2026-10-22a";
const CORE = [
  "/", "/acceso.html", "/area/", "/interno/", "/offline.html",
  "/assets/css/styles.css", "/assets/css/portal.css", "/assets/css/doc.css",
  "/assets/js/main.js", "/assets/js/config.js", "/assets/js/auth.js", "/assets/js/acceso.js", "/assets/js/formatos.js", "/assets/js/reporte.js", "/assets/js/area.js", "/assets/js/interno.js", "/assets/js/panel.js", "/assets/js/pwa.js",
  "/assets/img/logo-kinam.webp", "/assets/icons/icon-192.png", "/favicon.ico"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Datos y sesión (Supabase) siempre en vivo; los videos se piden por partes y no se guardan.
  if (url.hostname.endsWith("supabase.co") || url.pathname.endsWith(".mp4")) return;

  // Páginas: primero la red (contenido fresco), si no hay conexión la copia guardada.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; })
        .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match("/offline.html")))
    );
    return;
  }

  // Archivos del sitio, fuentes y librería de acceso: copia guardada y actualización en segundo plano.
  const ours = url.origin === location.origin;
  const cdn = /(^|\.)(jsdelivr\.net|googleapis\.com|gstatic\.com)$/.test(url.hostname);
  if (!ours && !cdn) return;
  e.respondWith(
    caches.open(VERSION).then((c) => c.match(req).then((hit) => {
      const net = fetch(req).then((res) => { if (res.ok || res.type === "opaque") c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }))
  );
});
