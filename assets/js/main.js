// KINAM Energy | interacciones del sitio
// Datos de contacto: edita estos valores cuando estén confirmados.
const CONTACT = {
  email: "contacto@kinamenergy.com",
  whatsapp: "",      // Ej. "5215512345678" (solo dígitos, con código de país)
  agenda: ""         // Ej. enlace de Calendly o Google Calendar
};

const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

$("#year").textContent = new Date().getFullYear();

// Menú móvil
const toggle = $(".nav__toggle");
const menu = $("#menu");
toggle.addEventListener("click", () => {
  const open = menu.classList.toggle("is-open");
  toggle.setAttribute("aria-expanded", String(open));
});
menu.addEventListener("click", (e) => {
  if (e.target.closest("a")) {
    menu.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
  }
});

// Campo de partículas del hero: energía fluyendo en líneas horizontales
(function heroField() {
  const c = $(".hero__field");
  if (!c || reduce) return;
  const ctx = c.getContext("2d");
  let w, h, dpr, parts = [], running = true;
  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = c.clientWidth; h = c.clientHeight;
    c.width = w * dpr; c.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.min(70, w / 18));
    parts = Array.from({ length: n }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      v: .25 + Math.random() * .9, l: 20 + Math.random() * 70, a: .08 + Math.random() * .3
    }));
  }
  function frame() {
    if (!running) return;
    ctx.clearRect(0, 0, w, h);
    for (const p of parts) {
      p.x += p.v;
      if (p.x - p.l > w) { p.x = -10; p.y = Math.random() * h; }
      const g = ctx.createLinearGradient(p.x - p.l, 0, p.x, 0);
      g.addColorStop(0, "rgba(0,229,255,0)");
      g.addColorStop(1, `rgba(0,229,255,${p.a})`);
      ctx.strokeStyle = g; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(p.x - p.l, p.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    }
    requestAnimationFrame(frame);
  }
  size();
  window.addEventListener("resize", size);
  new IntersectionObserver(([e]) => {
    const was = running; running = e.isIntersecting;
    if (running && !was) requestAnimationFrame(frame);
  }).observe(c);
  requestAnimationFrame(frame);
})();

// Firma: la onda bruta se vuelve onda digital al hacer scroll
(function signatureWave() {
  const sec = $("#onda");
  const c = $("#wave-canvas");
  const steps = $$(".wave__steps li");
  const meter = $(".wave__meter i");
  const ctx = c.getContext("2d");
  let w, h, dpr, target = reduce ? 1 : 0, shown = target, phase = 0, visible = false;

  // Ruido determinista para que la onda bruta no tiemble entre cuadros
  const noise = Array.from({ length: 512 }, (_, i) =>
    Math.sin(i * 12.9898) * 43758.5453 % 1);

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = c.clientWidth; h = c.clientHeight;
    c.width = w * dpr; c.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function progress() {
    const r = sec.getBoundingClientRect();
    const total = sec.offsetHeight - window.innerHeight;
    return Math.min(1, Math.max(0, -r.top / Math.max(total, 1)));
  }

  function draw(p) {
    ctx.clearRect(0, 0, w, h);
    const mid = h / 2, amp = h * 0.24, cycles = 3.2;
    const clean = Math.min(1, Math.max(0, (p - 0.08) / 0.8));
    const split = w * (0.88 - clean * 0.76); // frontera: avanza hacia la izquierda y la onda limpia gana terreno

    // Rejilla de muestreo: aparece en la etapa 2
    const sampleA = Math.max(0, Math.min(1, (p - .25) / .2)) * (1 - Math.max(0, (p - .8) / .2));
    if (sampleA > 0) {
      ctx.strokeStyle = `rgba(0,229,255,${0.12 * sampleA})`;
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 10) { ctx.beginPath(); ctx.moveTo(x, mid - amp * 1.3); ctx.lineTo(x, mid + amp * 1.3); ctx.stroke(); }
    }

    // Eje
    ctx.strokeStyle = "rgba(157,178,199,.18)";
    ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(w, mid); ctx.stroke();

    function y(x, rough) {
      const t = (x / w) * Math.PI * 2 * cycles + phase;
      const base = Math.sin(t);
      if (!rough) return mid - base * amp;
      const n = noise[Math.floor((x / w) * 511 + phase * 20) & 511];
      const jag = Math.sin(t * 7.3) * .22 + Math.sin(t * 13.1) * .12 + (n - .5) * .55;
      return mid - (base * (0.8 + .2 * Math.sin(t * .5)) + jag) * amp;
    }

    // Tramo bruto
    ctx.beginPath();
    for (let x = 0; x <= split; x += 2) { const yy = y(x, true); x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }
    ctx.strokeStyle = "rgba(200,212,225,.55)"; ctx.lineWidth = 1.6; ctx.shadowBlur = 0; ctx.stroke();

    // Tramo digital
    ctx.beginPath();
    for (let x = split; x <= w; x += 2) { const yy = y(x, false); x === split ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); }
    ctx.strokeStyle = "#00E5FF"; ctx.lineWidth = 2.6; ctx.shadowColor = "#00E5FF"; ctx.shadowBlur = 14; ctx.stroke();
    ctx.shadowBlur = 0;

    // Convertidor en la frontera
    const cw = 34;
    ctx.fillStyle = "#07172A"; ctx.strokeStyle = "#00E5FF"; ctx.lineWidth = 1.5;
    ctx.fillRect(split - cw / 2, mid - cw / 2, cw, cw);
    ctx.strokeRect(split - cw / 2, mid - cw / 2, cw, cw);
    ctx.fillStyle = "rgba(0,229,255,.9)";
    ctx.fillRect(split - 5, mid - 5, 10, 10);

    // Puntos de muestreo sobre la onda limpia en la etapa 3
    if (p > .5 && p < .9) {
      ctx.fillStyle = "rgba(255,255,255,.8)";
      for (let x = split + 8; x < w; x += 16) ctx.fillRect(x - 1.5, y(x, false) - 1.5, 3, 3);
    }
  }

  function setStep(p) {
    const i = Math.min(3, Math.floor(p * 4.2));
    steps.forEach((s, k) => s.classList.toggle("is-on", reduce ? true : k === i));
    meter.style.width = `${(p * 100).toFixed(1)}%`;
  }

  function loop() {
    if (!visible) return;
    if (!reduce) target = progress();
    shown += (target - shown) * 0.12;
    if (Math.abs(target - shown) < 0.0005) shown = target;
    if (!reduce) phase += 0.012;
    draw(shown);
    setStep(shown);
    requestAnimationFrame(loop);
  }

  size();
  window.addEventListener("resize", () => { size(); draw(shown); });
  new IntersectionObserver(([e]) => {
    const was = visible; visible = e.isIntersecting;
    if (visible && !was) requestAnimationFrame(loop);
  }).observe(sec);
  draw(shown); setStep(shown);
})();

// Pestañas de capas (patrón ARIA tabs con flechas)
const tabs = $$('[role="tab"]');
function selectTab(tab) {
  tabs.forEach((t) => {
    const on = t === tab;
    t.setAttribute("aria-selected", String(on));
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
  });
}
tabs.forEach((tab, i) => {
  tab.addEventListener("click", () => selectTab(tab));
  tab.addEventListener("keydown", (e) => {
    let next = null;
    if (e.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
    if (e.key === "ArrowLeft") next = tabs[(i - 1 + tabs.length) % tabs.length];
    if (e.key === "Home") next = tabs[0];
    if (e.key === "End") next = tabs[tabs.length - 1];
    if (next) { e.preventDefault(); selectTab(next); next.focus(); }
  });
});

// Escalabilidad interactiva
const units = $("#units");
const unitEls = $$(".unit");
function updateUnits() {
  const n = Number(units.value);
  unitEls.forEach((u, i) => u.classList.toggle("is-on", i < n));
  $("#units-out").textContent = n;
  $("#mw-out").textContent = `${(n * 1.8).toFixed(1)} MW`;
}
units.addEventListener("input", updateUnits);
updateUnits();

// Calculadora conceptual
const calc = $("#calc");
const fmt = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 });
function updateCalc() {
  const kw = Math.max(parseFloat(calc.kw.value) || 0, 0);
  const hours = Math.min(Math.max(parseFloat(calc.hours.value) || 0, 0), 24);
  const tariff = Math.max(parseFloat(calc.tariff.value) || 0, 0);
  const kwh = kw * hours * 365;
  $("#out-kwh").textContent = `${fmt.format(kwh)} kWh`;
  $("#out-cost").textContent = `$${fmt.format(kwh * tariff)}`;
  $("#out-units").textContent = Math.max(1, Math.ceil(kw / 1880));
}
calc.addEventListener("input", updateCalc);
calc.addEventListener("submit", (e) => e.preventDefault());
updateCalc();

// Enlaces de contacto
const links = $("#contact-links");
const addLink = (label, href) => {
  const li = document.createElement("li");
  const a = document.createElement("a");
  a.href = href; a.textContent = label;
  if (href.startsWith("http")) { a.target = "_blank"; a.rel = "noopener"; }
  li.appendChild(a); links.appendChild(li);
};
if (CONTACT.email) addLink(`Correo: ${CONTACT.email}`, `mailto:${CONTACT.email}`);
if (CONTACT.whatsapp) addLink("WhatsApp", `https://wa.me/${CONTACT.whatsapp}`);
if (CONTACT.agenda) addLink("Agendar asesoría ejecutiva", CONTACT.agenda);

// Formulario: sitio estático, se envía por correo
const form = $("#lead");
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const err = $("#lead-error");
  const required = ["nombre", "empresa", "industria"];
  const missing = required.filter((n) => !form[n].value.trim());
  required.forEach((n) => form[n].setAttribute("aria-invalid", String(missing.includes(n))));
  if (missing.length) { err.hidden = false; form[missing[0]].focus(); return; }
  err.hidden = true;
  const d = Object.fromEntries(new FormData(form));
  const body = [
    `Nombre: ${d.nombre}`, `Empresa: ${d.empresa}`, `Industria: ${d.industria}`,
    `Consumo estimado: ${d.consumo}`, `Ubicación: ${d.ubicacion}`, "", "Reto energético:", d.reto
  ].join("\n");
  const subject = `Diagnóstico energético: ${d.empresa}`;
  window.location.href = `mailto:${CONTACT.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
});

// Contadores de cifras
function countUp(el) {
  const end = parseFloat(el.dataset.count);
  const dec = Number(el.dataset.decimals || 0);
  const f = new Intl.NumberFormat("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  if (reduce || end === 0) { el.textContent = f.format(end); return; }
  const t0 = performance.now(), dur = 1600;
  (function step(t) {
    const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = f.format(end * e);
    if (k < 1) requestAnimationFrame(step);
  })(t0);
}

// Trazos SVG: medir longitud para dibujarlos al entrar
$$(".draw").forEach((p) => { if (p.getTotalLength) p.style.setProperty("--len", Math.ceil(p.getTotalLength())); });

// Entradas al hacer scroll
const items = $$(".reveal, .draw, .figure__num");
if (reduce || !("IntersectionObserver" in window)) {
  items.forEach((el) => el.classList.add("is-visible", "is-drawn"));
} else {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      if (el.classList.contains("figure__num")) countUp(el);
      else el.classList.add("is-visible", "is-drawn");
      io.unobserve(el);
    });
  }, { threshold: 0.2, rootMargin: "0px 0px -6% 0px" });
  items.forEach((el) => io.observe(el));
}
