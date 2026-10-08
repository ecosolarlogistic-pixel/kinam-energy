// KINAM Energy — interacciones del sitio
// Datos de contacto: edita estos valores cuando estén confirmados.
const CONTACT = {
  email: "contacto@kinamenergy.com",
  whatsapp: "",      // Ej. "5215512345678" (solo dígitos, con código de país)
  agenda: ""         // Ej. enlace de Calendly o Google Calendar
};

document.getElementById("year").textContent = new Date().getFullYear();

// Menú móvil
const toggle = document.querySelector(".nav__toggle");
const menu = document.getElementById("menu");
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

// Pestañas de capas (patrón ARIA tabs con flechas)
const tabs = [...document.querySelectorAll('[role="tab"]')];
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

// Calculadora conceptual
const calc = document.getElementById("calc");
const fmt = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 });
function updateCalc() {
  const kw = parseFloat(calc.kw.value) || 0;
  const hours = Math.min(parseFloat(calc.hours.value) || 0, 24);
  const tariff = parseFloat(calc.tariff.value) || 0;
  const kwh = kw * hours * 365;
  document.getElementById("out-kwh").textContent = `${fmt.format(kwh)} kWh`;
  document.getElementById("out-cost").textContent = `$${fmt.format(kwh * tariff)}`;
}
calc.addEventListener("input", updateCalc);
calc.addEventListener("submit", (e) => e.preventDefault());
updateCalc();

// Enlaces de contacto
const links = document.getElementById("contact-links");
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
const form = document.getElementById("lead");
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const err = document.getElementById("lead-error");
  const required = ["nombre", "empresa", "industria"];
  const missing = required.filter((n) => !form[n].value.trim());
  required.forEach((n) => form[n].setAttribute("aria-invalid", String(missing.includes(n))));
  if (missing.length) { err.hidden = false; form[missing[0]].focus(); return; }
  err.hidden = true;
  const d = Object.fromEntries(new FormData(form));
  const body = [
    `Nombre: ${d.nombre}`, `Empresa: ${d.empresa}`, `Industria: ${d.industria}`,
    `Consumo estimado: ${d.consumo}`, `Ubicación: ${d.ubicacion}`, "", `Reto energético:`, d.reto
  ].join("\n");
  const subject = `Diagnóstico energético: ${d.empresa}`;
  window.location.href = `mailto:${CONTACT.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
});

// Aparición suave al hacer scroll
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const items = document.querySelectorAll(".reveal");
if (reduce || !("IntersectionObserver" in window)) {
  items.forEach((el) => el.classList.add("is-visible"));
} else {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("is-visible"); io.unobserve(en.target); }
    });
  }, { threshold: 0.15 });
  items.forEach((el) => io.observe(el));
}
