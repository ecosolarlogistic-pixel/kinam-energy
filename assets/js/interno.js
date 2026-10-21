// KINAM Energy | panel Interno (solo equipo KINAM)
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const { client, ready, message, staffRole } = window.KinamAuth;
  const VIEWS = ["resumen", "evaluaciones", "clientes", "equipo", "bitacora"];
  const ADMIN_VIEWS = ["equipo", "bitacora"];
  const STATUS = { recibida: "Recibida", revision: "En revisión", propuesta: "Con propuesta", cerrada: "Cerrada" };
  const FIELDS = [
    ["industry", "Industria"], ["location", "Ubicación"], ["peak_kw", "Demanda máxima", "kW"], ["monthly_kwh", "Consumo mensual", "kWh"],
    ["hours_per_day", "Horas de operación al día", "h"], ["monthly_cost_mxn", "Gasto mensual", "MXN"], ["phases", "Fases"], ["voltage", "Tensión"],
    ["frequency_hz", "Frecuencia", "Hz"], ["current_source", "Fuente actual"], ["backup_hours", "Respaldo requerido", "h"],
    ["criticality", "Criticidad"], ["container_space", "Espacio para contenedor"], ["business_model", "Modelo de interés"], ["notes", "Comentarios del cliente"]
  ];
  let user = null, role = null, evals = [], clients = new Map(), current = null;

  if (!ready) return location.replace("/acceso.html?area=interno");

  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const date = (d, time) => new Date(d).toLocaleString("es-MX", time ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" });
  const num = (n, unit) => (n == null || n === "" ? "—" : (typeof n === "number" ? n.toLocaleString("es-MX") : esc(n)) + (unit ? " " + unit : ""));
  const badge = (s) => `<span class="badge badge--${esc(s)}">${esc(STATUS[s] || s)}</span>`;
  const who = (id) => clients.get(id) || {};
  const phoneLink = (p) => {
    const d = String(p || "").replace(/\D/g, "");
    if (!d) return "—";
    const wa = d.length === 10 ? "52" + d : d;
    return `<a href="https://wa.me/${wa}" target="_blank" rel="noopener">${esc(p)}</a>`;
  };

  function say(form, text, ok) {
    const m = $(".auth__msg", form);
    m.textContent = text;
    m.classList.toggle("is-ok", Boolean(ok));
    m.hidden = false;
  }

  function csv(name, header, rows) {
    const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const text = "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // Navegación
  function route() {
    let view = location.hash.slice(1);
    if (!VIEWS.includes(view) || (ADMIN_VIEWS.includes(view) && role !== "admin")) view = "resumen";
    $$(".view").forEach((s) => { s.hidden = s.id !== "view-" + view; });
    $$(".app__side a").forEach((a) => a.setAttribute("aria-current", a.dataset.view === view ? "page" : "false"));
    if (view === "equipo") loadTeam();
    if (view === "bitacora") loadLog();
    window.scrollTo(0, 0);
  }

  // Datos
  async function loadData() {
    const [ev, pf] = await Promise.all([
      client.from("evaluaciones").select("*").order("created_at", { ascending: false }),
      client.from("profiles").select("id, full_name, company, phone, email, created_at")
    ]);
    if (ev.error) throw ev.error;
    evals = ev.data || [];
    clients = new Map((pf.data || []).map((p) => [p.id, p]));
    renderSummary();
    renderEvals();
    renderClients();
  }

  function renderSummary() {
    const count = (s) => evals.filter((e) => e.status === s).length;
    $("[data-stat=nuevas]").textContent = count("recibida");
    $("[data-stat=revision]").textContent = count("revision");
    $("[data-stat=propuesta]").textContent = count("propuesta");
    $("[data-stat=clientes]").textContent = clients.size;

    $("#latest-table").innerHTML = evals.length
      ? `<thead><tr><th>Fecha</th><th>Proyecto</th><th>Cliente</th><th>Estado</th></tr></thead><tbody>${evals.slice(0, 6).map((e) => `
        <tr><td>${date(e.created_at)}</td><td><a href="#evaluaciones" data-open="${e.id}">${esc(e.project_name)}</a></td><td>${esc(who(e.user_id).company || who(e.user_id).full_name || "—")}</td><td>${badge(e.status)}</td></tr>`).join("")}</tbody>`
      : '<tbody><tr><td class="note">Aún no hay evaluaciones.</td></tr></tbody>';

    const byInd = {};
    evals.forEach((e) => { byInd[e.industry] = (byInd[e.industry] || 0) + (Number(e.peak_kw) || 0); });
    const list = Object.entries(byInd).sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...list.map((x) => x[1]));
    $("#industry-bars").innerHTML = list.length
      ? list.map(([k, v]) => `<li><span>${esc(k)}</span><span class="bars__track"><span style="width:${(v / max) * 100}%"></span></span><strong>${num(Math.round(v), "kW")}</strong></li>`).join("")
      : '<li class="note">Sin datos todavía.</li>';
  }

  function filteredEvals() {
    const q = $("#ev-search").value.trim().toLowerCase();
    const st = $("#ev-status").value;
    return evals.filter((e) => {
      if (st && e.status !== st) return false;
      if (!q) return true;
      const c = who(e.user_id);
      return [e.project_name, e.location, e.industry, c.full_name, c.company, c.email].some((v) => String(v || "").toLowerCase().includes(q));
    });
  }

  function renderEvals() {
    const rows = filteredEvals();
    $("#ev-empty").hidden = rows.length > 0;
    $("#ev-table").innerHTML = rows.length ? `<thead><tr><th>Fecha</th><th>Proyecto</th><th>Cliente</th><th>Industria</th><th>Demanda</th><th>Estado</th></tr></thead><tbody>${rows.map((e) => {
      const c = who(e.user_id);
      return `<tr data-open="${e.id}" tabindex="0"><td>${date(e.created_at)}</td><td><strong>${esc(e.project_name)}</strong><br><span class="note">${esc(e.location)}</span></td><td>${esc(c.full_name || "—")}<br><span class="note">${esc(c.company || "")}</span></td><td>${esc(e.industry)}</td><td>${num(e.peak_kw, "kW")}</td><td>${badge(e.status)}</td></tr>`;
    }).join("")}</tbody>` : "";
  }

  function openEval(id) {
    current = evals.find((e) => e.id === id);
    if (!current) return;
    const c = who(current.user_id);
    $("#dt-title").textContent = current.project_name;
    $("#dt-client").innerHTML = `
      <dt>Nombre</dt><dd>${esc(c.full_name || "—")}</dd>
      <dt>Empresa</dt><dd>${esc(c.company || "—")}</dd>
      <dt>Correo</dt><dd>${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : "—"}</dd>
      <dt>WhatsApp</dt><dd>${phoneLink(c.phone)}</dd>
      <dt>Enviada</dt><dd>${date(current.created_at, true)}</dd>`;
    $("#dt-data").innerHTML = FIELDS.map(([k, label, unit]) => `<dt>${label}</dt><dd>${num(current[k], unit)}</dd>`).join("");
    $("#dt-status").value = current.status;
    $("#dt-notes").value = current.kinam_notes || "";
    $(".auth__msg", $("#dt-form")).hidden = true;
    $("#ev-detail").hidden = false;
    $("#ev-detail").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderClients() {
    const q = $("#cl-search").value.trim().toLowerCase();
    const counts = {};
    evals.forEach((e) => { counts[e.user_id] = (counts[e.user_id] || 0) + 1; });
    const rows = [...clients.values()]
      .filter((c) => !q || [c.full_name, c.company, c.email, c.phone].some((v) => String(v || "").toLowerCase().includes(q)))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    $("#cl-table").innerHTML = rows.length ? `<thead><tr><th>Nombre</th><th>Empresa</th><th>Correo</th><th>WhatsApp</th><th>Registro</th><th>Evaluaciones</th></tr></thead><tbody>${rows.map((c) => `
      <tr><td>${esc(c.full_name || "—")}</td><td>${esc(c.company || "—")}</td><td>${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : "—"}</td><td>${phoneLink(c.phone)}</td><td>${date(c.created_at)}</td><td>${counts[c.id] || 0}</td></tr>`).join("")}</tbody>` : '<tbody><tr><td class="note">Sin clientes con ese filtro.</td></tr></tbody>';
  }

  async function loadTeam() {
    const { data, error } = await client.from("staff").select("user_id, role, created_at");
    if (error) { $("#tm-table").innerHTML = `<tbody><tr><td class="form__error">${esc(message(error))}</td></tr></tbody>`; return; }
    $("#tm-table").innerHTML = `<thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Desde</th><th></th></tr></thead><tbody>${data.map((m) => {
      const p = who(m.user_id);
      const me = m.user_id === user.id;
      return `<tr><td>${esc(p.full_name || "—")}${me ? ' <span class="note">(tú)</span>' : ""}</td><td>${esc(p.email || "—")}</td><td>${m.role === "admin" ? "Dirección" : "Equipo"}</td><td>${date(m.created_at)}</td><td>${me ? "" : `<button class="link" type="button" data-remove="${m.user_id}">Quitar acceso</button>`}</td></tr>`;
    }).join("")}</tbody>`;
  }

  async function loadLog() {
    const { data, error } = await client.from("access_log").select("user_id, at, user_agent").order("at", { ascending: false }).limit(200);
    if (error) { $("#log-table").innerHTML = `<tbody><tr><td class="form__error">${esc(message(error))}</td></tr></tbody>`; return; }
    const device = (ua) => {
      ua = ua || "";
      const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Otro";
      const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "";
      return os + (br ? " · " + br : "");
    };
    $("#log-table").innerHTML = data.length ? `<thead><tr><th>Fecha y hora</th><th>Persona</th><th>Dispositivo</th></tr></thead><tbody>${data.map((l) => `
      <tr><td>${date(l.at, true)}</td><td>${esc(who(l.user_id).full_name || who(l.user_id).email || "—")}</td><td>${esc(device(l.user_agent))}</td></tr>`).join("")}</tbody>` : '<tbody><tr><td class="note">Sin registros todavía.</td></tr></tbody>';
  }

  // Eventos
  $("#ev-search").addEventListener("input", renderEvals);
  $("#ev-status").addEventListener("change", renderEvals);
  $("#cl-search").addEventListener("input", renderClients);
  document.addEventListener("click", (e) => {
    const row = e.target.closest("[data-open]");
    if (row) { e.preventDefault(); if (location.hash !== "#evaluaciones") location.hash = "#evaluaciones"; setTimeout(() => openEval(row.dataset.open), 0); }
  });
  $("#ev-table").addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.dataset.open) openEval(e.target.dataset.open); });
  $("#dt-close").addEventListener("click", () => { $("#ev-detail").hidden = true; current = null; });

  $("#dt-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!current) return;
    const f = e.currentTarget;
    const patch = { status: f.status.value, kinam_notes: f.kinam_notes.value.trim() || null };
    const { error } = await client.from("evaluaciones").update(patch).eq("id", current.id);
    if (error) return say(f, message(error));
    Object.assign(current, patch);
    renderSummary(); renderEvals();
    say(f, "Guardado. El cliente ya ve el estado y los comentarios.", true);
  });

  $("#ev-export").addEventListener("click", () => {
    csv("evaluaciones-kinam.csv",
      ["Fecha", "Proyecto", "Estado", "Cliente", "Empresa", "Correo", "WhatsApp", ...FIELDS.map((f) => f[1]), "Comentarios KINAM"],
      filteredEvals().map((e) => { const c = who(e.user_id); return [date(e.created_at, true), e.project_name, STATUS[e.status], c.full_name, c.company, c.email, c.phone, ...FIELDS.map((f) => e[f[0]]), e.kinam_notes]; }));
  });
  $("#cl-export").addEventListener("click", () => {
    csv("clientes-kinam.csv", ["Nombre", "Empresa", "Correo", "WhatsApp", "Registro"],
      [...clients.values()].map((c) => [c.full_name, c.company, c.email, c.phone, date(c.created_at)]));
  });

  $("#team-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    if (!f.email.checkValidity() || !f.email.value.trim()) return say(f, "Escribe un correo válido.");
    const { error } = await client.rpc("add_staff", { p_email: f.email.value.trim(), p_role: f.role.value });
    if (error) return say(f, message(error));
    f.reset();
    say(f, "Listo. La persona ya puede entrar a Interno con su correo y contraseña.", true);
    loadTeam();
  });
  $("#tm-table").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-remove]");
    if (!b) return;
    const name = who(b.dataset.remove).full_name || who(b.dataset.remove).email || "esta persona";
    if (!confirm("¿Quitar el acceso interno a " + name + "?")) return;
    const { error } = await client.rpc("remove_staff", { p_user: b.dataset.remove });
    if (error) return alert(message(error));
    loadTeam();
  });

  $("#logout").addEventListener("click", async () => {
    await client.auth.signOut();
    location.replace("/acceso.html?area=interno");
  });
  client.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT") location.replace("/acceso.html?area=interno"); });

  // Arranque: solo el equipo KINAM pasa de aquí.
  client.auth.getSession().then(async ({ data }) => {
    if (!data.session) return location.replace("/acceso.html?area=interno");
    user = data.session.user;
    role = await staffRole(user.id);
    document.body.classList.remove("is-loading");
    $("#user-name").textContent = user.user_metadata?.full_name || user.email;
    if (!role) {
      $(".app__side").hidden = true;
      $(".app__layout").classList.add("app__layout--single");
      $$(".view").forEach((s) => { s.hidden = s.id !== "view-denied"; });
      return;
    }
    $$("[data-admin]").forEach((a) => { a.hidden = role !== "admin"; });
    try { if (!sessionStorage.getItem("kinam-log")) { await client.from("access_log").insert({ user_agent: navigator.userAgent }); sessionStorage.setItem("kinam-log", "1"); } } catch (_) { /* la bitácora no bloquea el panel */ }
    window.addEventListener("hashchange", route);
    try { await loadData(); } catch (err) { $("#main").insertAdjacentHTML("afterbegin", `<p class="auth__msg">No se pudieron cargar los datos: ${esc(message(err))}</p>`); }
    route();
  });
})();
