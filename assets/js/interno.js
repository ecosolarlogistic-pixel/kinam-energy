// KINAM Energy | panel Interno (solo equipo KINAM)
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const { client, ready, message, staffRole } = window.KinamAuth;
  const F = window.KinamFormatos;
  const CFG = window.KINAM_AUTH || {};
  const VIEWS = ["panel", "resumen", "expedientes", "formatos", "evaluaciones", "clientes", "equipo", "bitacora"];
  const ADMIN_VIEWS = ["equipo", "bitacora"];
  const STATUS = { recibida: "Recibida", revision: "En revisión", propuesta: "Con propuesta", cerrada: "Cerrada" };
  const FIELDS = [
    ["industry", "Industria"], ["location", "Ubicación"], ["peak_kw", "Demanda máxima", "kW"], ["monthly_kwh", "Consumo mensual", "kWh"],
    ["hours_per_day", "Horas de operación al día", "h"], ["monthly_cost_mxn", "Gasto mensual", "MXN"], ["phases", "Fases"], ["voltage", "Tensión"],
    ["frequency_hz", "Frecuencia", "Hz"], ["current_source", "Fuente actual"], ["backup_hours", "Respaldo requerido", "h"],
    ["criticality", "Criticidad"], ["container_space", "Espacio para contenedor"], ["business_model", "Modelo de interés"], ["notes", "Comentarios del cliente"]
  ];
  const AREAS = {
    direccion: ["Dirección", "Control total de Interno, incluida la gestión de usuarios, áreas y correos."],
    administracion: ["Administración", "Facturación, contratos y gestión administrativa de clientes y proyectos."],
    comercial: ["Comercial", "Atiende prospectos y clientes, da de alta clientes y da seguimiento a cartas compromiso."],
    tecnico: ["Ingeniería / Técnico", "Revisa evaluaciones técnicas y requisitos de instalación de cada proyecto."],
    operaciones: ["Operación", "Da seguimiento a instalación, puesta en marcha y operación de los proyectos."]
  };
  const FNAME = { requisitos: "Requisitos de instalación", carta: "Carta compromiso" };
  let user = null, role = null, evals = [], clients = new Map(), current = null;
  let empresas = [], proyectos = [], formatos = [], seguimiento = [], staff = [], team = [], contactos = [], cliente = null, openFm = null, director = false;

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
    if (!VIEWS.includes(view) || (ADMIN_VIEWS.includes(view) && role !== "admin")) view = "panel";
    $$(".view").forEach((s) => { s.hidden = s.id !== "view-" + view; });
    $$(".app__side a").forEach((a) => a.setAttribute("aria-current", a.dataset.view === view ? "page" : "false"));
    if (view === "equipo") loadTeam();
    if (view === "formatos") renderFormatos();
    document.dispatchEvent(new CustomEvent("kinam:view", { detail: view }));
    if (view === "bitacora") loadLog();
    window.scrollTo(0, 0);
  }

  // Datos
  async function loadData() {
    const [ev, pf, cl, pr, fm, sg, st, ct] = await Promise.all([
      client.from("evaluaciones").select("*").order("created_at", { ascending: false }),
      client.from("profiles").select("id, full_name, company, phone, email, created_at"),
      client.from("clientes").select("*").order("created_at", { ascending: false }),
      client.from("proyectos").select("*").order("created_at", { ascending: false }),
      client.from("formatos").select("*").order("updated_at", { ascending: false }),
      client.from("seguimiento").select("*").order("at", { ascending: false }).limit(1000),
      client.from("staff").select("user_id, role, area, supervisor_id"),
      client.from("contactos").select("*").eq("activo", true).order("nombre")
    ]);
    if (ev.error) throw ev.error;
    evals = ev.data || [];
    clients = new Map((pf.data || []).map((p) => [p.id, p]));
    empresas = cl.data || [];
    proyectos = pr.data || [];
    formatos = fm.data || [];
    seguimiento = sg.data || [];
    staff = st.data || [];
    contactos = ct.data || [];
    director = role === "admin" || (staff.find((s) => s.user_id === user.id) || {}).area === "direccion";
    renderSummary();
    renderEvals();
    renderClients();
    renderExpedientes();
    renderFormatos();
  }

  function renderSummary() {
    const count = (s) => evals.filter((e) => e.status === s).length;
    $("[data-stat=nuevas]").textContent = count("recibida");
    $("[data-stat=revision]").textContent = count("revision");
    $("[data-stat=propuesta]").textContent = count("propuesta");
    $("[data-stat=formatos]").textContent = formatos.filter((f) => f.status === "enviado").length;

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

  // Clientes y proyectos
  const empresa = (id) => empresas.find((c) => c.id === id) || {};
  const proyecto = (id) => proyectos.find((p) => p.id === id) || {};
  const staffName = (id) => (id ? who(id).full_name || who(id).email || "—" : "—");

  function filteredEmpresas() {
    const q = $("#ex-search").value.trim().toLowerCase();
    return empresas.filter((c) => !q || [c.razon_social, c.rfc, c.ciudad, c.estado, c.email, ...proyectos.filter((p) => p.cliente_id === c.id).map((p) => p.nombre)]
      .some((v) => String(v || "").toLowerCase().includes(q)));
  }

  function renderExpedientes() {
    const rows = filteredEmpresas();
    $("#ex-table").innerHTML = rows.length ? `<thead><tr><th>Alta</th><th>Cliente</th><th>Ciudad</th><th>Proyectos</th><th>Formatos por revisar</th><th>Responsable KINAM</th></tr></thead><tbody>${rows.map((c) => {
      const ps = proyectos.filter((p) => p.cliente_id === c.id);
      const pend = formatos.filter((f) => f.status === "enviado" && ps.some((p) => p.id === f.proyecto_id)).length;
      return `<tr data-cliente="${c.id}" tabindex="0"><td>${date(c.created_at)}</td><td><strong>${esc(c.razon_social)}</strong><br><span class="note">${esc(c.rfc || "")}</span></td><td>${esc([c.ciudad, c.estado].filter(Boolean).join(", ") || "—")}</td><td>${ps.length}</td><td>${pend ? `<span class="badge badge--enviado">${pend}</span>` : "0"}</td><td>${esc(staffName(c.responsable_kinam))}</td></tr>`;
    }).join("")}</tbody>` : '<tbody><tr><td class="note">Aún no hay clientes dados de alta.</td></tr></tbody>';
  }

  function openCliente(id) {
    cliente = id ? empresas.find((c) => c.id === id) : null;
    const f = $("#ex-form");
    const d = cliente || { pais: "México" };
    $("#ex-title").textContent = cliente ? cliente.razon_social : "Alta de cliente";
    $("#ex-cuenta").innerHTML = '<option value="">Sin cuenta en el sitio</option>' + [...clients.values()].filter((p) => p.id === d.user_id || !staff.some((s) => s.user_id === p.id))
      .map((p) => `<option value="${p.id}">${esc((p.full_name || "") + " · " + (p.email || ""))}</option>`).join("");
    $("#ex-resp").innerHTML = '<option value="">Sin asignar</option>' + staff.map((s) => `<option value="${s.user_id}">${esc(staffName(s.user_id))}</option>`).join("");
    ["razon_social", "rfc", "pais", "domicilio", "ciudad", "estado", "actividad", "representante", "cargo", "telefono", "email", "user_id", "responsable_kinam", "notas"].forEach((k) => { f[k].value = d[k] || ""; });
    $(".auth__msg", f).hidden = true;
    $("#ex-projects-wrap").hidden = !cliente;
    renderContactos();
    renderClienteProjects();
    $("#ex-detail").hidden = false;
    $("#ex-detail").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderClienteProjects() {
    if (!cliente) return;
    const ps = proyectos.filter((p) => p.cliente_id === cliente.id);
    $("#ex-projects").innerHTML = ps.length ? ps.map((p) => {
      const chips = ["requisitos", "carta"].map((t) => {
        const r = formatos.find((f) => f.proyecto_id === p.id && f.tipo === t);
        if (r) return `<button class="chip" type="button" data-formato="${r.id}">${FNAME[t]} ${badge2(r.status)}</button>`;
        return director ? `<button class="chip" type="button" data-crear="${t}" title="Llenar desde Interno">${FNAME[t]} <span class="badge badge--pendiente">Pendiente · llenar</span></button>` : `<span class="chip">${FNAME[t]} <span class="badge badge--pendiente">Pendiente</span></span>`;
      }).join("");
      const ev = evals.filter((e) => e.proyecto_id === p.id).map((e) => `<button class="chip" type="button" data-open="${e.id}">Evaluación técnica ${badge(e.status)}</button>`).join("");
      const log = seguimiento.filter((s) => s.proyecto_id === p.id).slice(0, 8);
      return `<article class="evcard" data-proyecto="${p.id}">
        <header><div><h2>${esc(p.nombre)}</h2><p class="note">${esc(p.ubicacion || "")}${p.ubicacion ? " · " : ""}desde ${date(p.created_at)}</p></div>
          <label class="sr-only" for="et-${p.id}">Etapa</label><select id="et-${p.id}" data-etapa>${Object.entries(F.ETAPAS).map(([k, v]) => `<option value="${k}"${k === p.etapa ? " selected" : ""}>${v}</option>`).join("")}</select></header>
        <div class="chips">${chips}${ev}</div>
        <label for="pn-${p.id}">Comentarios para el cliente</label>
        <textarea id="pn-${p.id}" rows="2" data-pnotes>${esc(p.kinam_notes || "")}</textarea>
        <div class="fm__actions"><button class="btn btn--ghost btn--sm" type="button" data-psave>Guardar etapa y comentarios</button></div>
        <h3 class="mono">SEGUIMIENTO</h3>
        <div class="toolbar toolbar--form"><div><label class="sr-only" for="sn-${p.id}">Nota</label><input id="sn-${p.id}" data-snote placeholder="Agregar nota de seguimiento (llamada, visita, acuerdo…)"></div><button class="btn btn--ghost btn--sm" type="button" data-sadd>Agregar</button></div>
        ${log.length ? `<ul class="timeline">${log.map((s) => `<li><span class="note">${date(s.at, true)} · ${esc(staffName(s.user_id))}</span> ${esc(s.accion)}${s.detalle ? ` · ${esc(s.detalle)}` : ""}</li>`).join("")}</ul>` : ""}
      </article>`;
    }).join("") : '<p class="note">Este cliente aún no tiene proyectos.</p>';
  }

  const badge2 = (s) => `<span class="badge badge--${esc(s)}">${esc(F.ESTADOS[s] || s)}</span>`;

  function renderFormatos() {
    const t = $("#fm-tipo").value, st = $("#fm-status").value;
    const rows = formatos.filter((f) => (!t || f.tipo === t) && (!st || f.status === st));
    $("#fm-table").innerHTML = rows.length ? `<thead><tr><th>Actualizado</th><th>Formato</th><th>Cliente</th><th>Proyecto</th><th>Avance</th><th>Estado</th></tr></thead><tbody>${rows.map((f) => {
      const p = proyecto(f.proyecto_id);
      return `<tr data-formato="${f.id}" tabindex="0"><td>${date(f.updated_at, true)}</td><td>${FNAME[f.tipo]}</td><td>${esc(empresa(p.cliente_id).razon_social || "—")}</td><td>${esc(p.nombre || "—")}</td><td>${F.progress(f.tipo === "carta" ? F.CARTA : F.REQUISITOS, f.data)}%</td><td>${badge2(f.status)}</td></tr>`;
    }).join("")}</tbody>` : '<tbody><tr><td class="note">No hay formatos con ese filtro.</td></tr></tbody>';
  }

  function formatoHTML(f) {
    const p = proyecto(f.proyecto_id);
    return f.tipo === "carta" ? F.cartaHTML(f.data, { por: f.firmado_at ? f.firmado_por : null, at: f.firmado_at }) : F.requisitosHTML(f.data, { proyecto: p.nombre });
  }

  function openFormato(id) {
    openFm = formatos.find((f) => f.id === id);
    if (!openFm) return;
    const p = proyecto(openFm.proyecto_id);
    $("#fmm-title").textContent = FNAME[openFm.tipo] + " · " + (p.nombre || "");
    $("#fmm-meta").textContent = `${empresa(p.cliente_id).razon_social || ""} · ${openFm.submitted_at ? "enviado el " + date(openFm.submitted_at, true) : "aún no enviado"}`;
    $("#fmm-status").value = openFm.status;
    $("#fmm-notes").value = openFm.kinam_notes || "";
    $(".auth__msg", $("#fmm-form")).hidden = true;
    $("#fmm-doc").innerHTML = formatoHTML(openFm);
    $("#fmm-edit").hidden = true;
    $("#fmm-doc").hidden = false;
    $("#fmm-edit-btn").hidden = !director;
    $("#fm-modal").hidden = false;
    $("#fmm-close").focus();
  }

  // Usuarios internos (función segura en Supabase, solo Dirección)
  async function fn(body) {
    const { data } = await client.auth.getSession();
    const r = await fetch(CFG.url + "/functions/v1/gestion-usuarios", {
      method: "POST",
      headers: { Authorization: "Bearer " + data.session.access_token, apikey: CFG.key, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const j = await r.json().catch(() => ({ error: "El servidor no respondió correctamente." }));
    if (!r.ok) throw Object.assign(new Error(j.error || "Error"), j);
    return j;
  }

  function genPassword() {
    const groups = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789", "!@#$%*-_+?"];
    const all = groups.join("");
    const rnd = (n) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
    const chars = groups.map((g) => g[rnd(g.length)]);
    while (chars.length < 14) chars.push(all[rnd(all.length)]);
    for (let i = chars.length - 1; i > 0; i--) { const j = rnd(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
    return chars.join("");
  }

  function fillTeamSelects() {
    $$("[data-areas]").forEach((s) => { const v = s.value; s.innerHTML = Object.entries(AREAS).map(([k, [l]]) => `<option value="${k}">${l}</option>`).join(""); s.value = v || "tecnico"; });
    $$("[data-supervisors]").forEach((s) => { const v = s.value; s.innerHTML = '<option value="">Sin supervisor</option>' + team.filter((m) => m.active).map((m) => `<option value="${m.id}">${esc(m.full_name || m.email)}</option>`).join(""); s.value = v; });
    $("[data-area-help]").textContent = AREAS[$("#tc-area").value][1];
  }

  async function loadTeam() {
    try { team = (await fn({ action: "list" })).users; }
    catch (err) { $("#tm-table").innerHTML = `<tbody><tr><td class="form__error">${esc(err.message)}</td></tr></tbody>`; return; }
    fillTeamSelects();
    const areaSel = (m) => `<select data-area="${m.id}" aria-label="Área de ${esc(m.full_name)}"${m.me ? " disabled" : ""}>${Object.entries(AREAS).map(([k, [l]]) => `<option value="${k}"${k === m.area ? " selected" : ""}>${l}</option>`).join("")}</select>`;
    $("#tm-table").innerHTML = `<thead><tr><th>Nombre</th><th>Correo</th><th>Área</th><th>Supervisor</th><th>Último acceso</th><th>Estado</th><th></th></tr></thead><tbody>${team.map((m) => `
      <tr><td>${esc(m.full_name || "—")}${m.me ? ' <span class="note">(tú)</span>' : ""}<br><span class="note">${phoneLink(m.phone)}</span></td>
        <td>${esc(m.email || "—")}<br><span class="note">${m.mailbox ? "Con correo Hostinger" : "Sin correo"}</span></td>
        <td>${areaSel(m)}</td>
        <td>${esc(m.supervisor_id ? (team.find((x) => x.id === m.supervisor_id) || {}).full_name || "—" : "—")}</td>
        <td>${m.last_sign_in_at ? date(m.last_sign_in_at, true) : "Nunca"}</td>
        <td>${m.active ? '<span class="badge badge--aprobado">Activo</span>' : '<span class="badge badge--cancelado">Bloqueado</span>'}</td>
        <td>${m.me ? "" : `<button class="link" type="button" data-pass="${m.id}">Nueva contraseña</button><br><button class="link" type="button" data-active="${m.id}" data-on="${m.active ? 0 : 1}">${m.active ? "Bloquear" : "Reactivar"}</button><br><button class="link" type="button" data-remove="${m.id}">Quitar acceso</button>`}</td></tr>`).join("")}</tbody>`;
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

  // Clientes y proyectos: eventos
  $("#ex-search").addEventListener("input", renderExpedientes);
  $("#ex-new").addEventListener("click", () => openCliente(null));
  $("#ex-close").addEventListener("click", () => { $("#ex-detail").hidden = true; cliente = null; });
  $("#ex-table").addEventListener("click", (e) => { const r = e.target.closest("[data-cliente]"); if (r) openCliente(r.dataset.cliente); });
  $("#ex-table").addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.dataset.cliente) openCliente(e.target.dataset.cliente); });
  $("#ex-export").addEventListener("click", () => {
    csv("clientes-proyectos-kinam.csv", ["Cliente", "RFC", "Ciudad", "Estado", "Representante", "Teléfono", "Correo", "Proyecto", "Etapa", "Requisitos", "Carta"],
      filteredEmpresas().flatMap((c) => {
        const ps = proyectos.filter((p) => p.cliente_id === c.id);
        const st = (p, t) => F.ESTADOS[(formatos.find((f) => f.proyecto_id === p.id && f.tipo === t) || {}).status] || "Pendiente";
        return (ps.length ? ps : [{}]).map((p) => [c.razon_social, c.rfc, c.ciudad, c.estado, c.representante, c.telefono, c.email, p.nombre, F.ETAPAS[p.etapa], p.id ? st(p, "requisitos") : "", p.id ? st(p, "carta") : ""]);
      }));
  });

  $("#ex-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const v = Object.fromEntries(new FormData(f));
    Object.keys(v).forEach((k) => { v[k] = v[k].trim() || null; });
    if (!v.razon_social) return say(f, "Escribe el nombre o razón social.");
    if (v.rfc) v.rfc = v.rfc.toUpperCase();
    const q = cliente ? client.from("clientes").update(v).eq("id", cliente.id).select().single() : client.from("clientes").insert(v).select().single();
    const { data, error } = await q;
    if (error) return say(f, message(error));
    empresas = [data, ...empresas.filter((c) => c.id !== data.id)];
    renderExpedientes();
    openCliente(data.id);
    say(f, "Cliente guardado.", true);
  });

  $("#ex-proj-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    if (!f.nombre.value.trim()) return say(f, "Escribe el nombre del proyecto.");
    const { error } = await client.from("proyectos").insert({ cliente_id: cliente.id, nombre: f.nombre.value.trim(), ubicacion: f.ubicacion.value.trim() || null });
    if (error) return say(f, message(error));
    f.reset();
    await loadData();
    openCliente(cliente.id);
  });

  $("#ex-projects").addEventListener("click", async (e) => {
    const card = e.target.closest("[data-proyecto]");
    const fb = e.target.closest("[data-formato]");
    if (fb) return openFormato(fb.dataset.formato);
    if (!card) return;
    const pid = card.dataset.proyecto;
    const nb = e.target.closest("[data-crear]");
    if (nb) return crearFormato(pid, nb.dataset.crear);
    if (e.target.closest("[data-psave]")) {
      const patch = { etapa: $("[data-etapa]", card).value, kinam_notes: $("[data-pnotes]", card).value.trim() || null };
      const { error } = await client.from("proyectos").update(patch).eq("id", pid);
      if (error) return alert(message(error));
      await loadData(); openCliente(cliente.id);
    }
    if (e.target.closest("[data-sadd]")) {
      const txt = $("[data-snote]", card).value.trim();
      if (!txt) return;
      const { error } = await client.from("seguimiento").insert({ proyecto_id: pid, user_id: user.id, accion: "Nota", detalle: txt });
      if (error) return alert(message(error));
      await loadData(); openCliente(cliente.id);
    }
  });

  // Responsables de la empresa abierta
  const contactosDe = (cid) => contactos.filter((c) => c.cliente_id === cid);
  function renderContactos() {
    if (cliente) $("#ex-contactos").innerHTML = F.contactosHTML(contactosDe(cliente.id), { prefix: "ex" });
  }
  async function saveContact(cid, perfil, nombre, extra = {}) {
    const { data, error } = await client.from("contactos").insert({ cliente_id: cid, perfil, nombre, ...extra }).select().single();
    if (error) { alert("No se pudo guardar: " + message(error)); return null; }
    contactos.push(data);
    renderContactos();
    return data;
  }
  $("#ex-contactos").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const v = Object.fromEntries(new FormData(f));
    if (!v.nombre.trim()) return say(f, "Escribe el nombre.");
    const row = await saveContact(cliente.id, v.perfil, v.nombre.trim(), { cargo: v.cargo.trim() || null, telefono: v.telefono.trim() || null, email: v.email.trim() || null });
    if (row) say($("[data-contacto-form]", $("#ex-contactos")), "Persona agregada al listado.", true);
  });
  $("#ex-contactos").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-contacto-off]");
    if (!b || !confirm("¿Quitar a esta persona del listado?")) return;
    const { error } = await client.from("contactos").update({ activo: false }).eq("id", b.dataset.contactoOff);
    if (error) return alert(message(error));
    contactos = contactos.filter((c) => c.id !== b.dataset.contactoOff);
    renderContactos();
  });

  // Dirección: llenar o corregir el contenido de un formato desde Interno.
  function prefillFormato(p, tipo) {
    const c = empresa(p.cliente_id);
    const d = tipo === "requisitos"
      ? { empresa: c.razon_social, tax_id: c.rfc, pais: c.pais, ciudad: c.ciudad, estado: c.estado, actividad: c.actividad, resp_proyecto: c.representante, telefono: c.telefono, email: c.email }
      : { consumidor: c.razon_social, rfc: c.rfc, domicilio: [c.domicilio, c.ciudad, c.estado].filter(Boolean).join(", "), representante: c.representante, cargo: c.cargo, ciudad: c.ciudad, estado: c.estado, fecha: new Date().toISOString().slice(0, 10), a_domicilio: p.ubicacion };
    return Object.fromEntries(Object.entries(d).filter(([, v]) => v));
  }
  async function crearFormato(pid, tipo) {
    const p = proyecto(pid);
    const { data, error } = await client.from("formatos").insert({ proyecto_id: pid, tipo, data: prefillFormato(p, tipo), status: "borrador" }).select().single();
    if (error) return alert(message(error));
    formatos = [data, ...formatos.filter((x) => x.id !== data.id)];
    renderFormatos(); renderExpedientes();
    if (cliente) renderClienteProjects();
    openFormato(data.id);
    editFormato();
  }
  function editFormato() {
    if (!openFm || !director) return;
    const form = $("#fmm-edit");
    const schema = openFm.tipo === "carta" ? F.CARTA : F.REQUISITOS;
    const box = $("[data-fields]", form);
    const cid = proyecto(openFm.proyecto_id).cliente_id;
    F.render(box, schema, openFm.data || {}, { prefix: "fmm" });
    F.enhance(box, { contactos: contactosDe(cid), saveContact: (perfil, nombre) => saveContact(cid, perfil, nombre) });
    $(".auth__msg", form).hidden = true;
    form.hidden = false;
    $("#fmm-doc").hidden = true;
    box.querySelector("input, textarea")?.focus();
  }
  $("#fmm-edit-btn").addEventListener("click", editFormato);
  $("#fmm-edit-cancel").addEventListener("click", () => { $("#fmm-edit").hidden = true; $("#fmm-doc").hidden = false; });
  $("#fmm-edit").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const schema = openFm.tipo === "carta" ? F.CARTA : F.REQUISITOS;
    const { data, error } = await client.from("formatos").update({ data: F.collect($("[data-fields]", f), schema) }).eq("id", openFm.id).select().single();
    if (error) return say(f, message(error));
    formatos = formatos.map((x) => (x.id === data.id ? data : x));
    openFm = data;
    $("#fmm-doc").innerHTML = formatoHTML(data);
    renderFormatos();
    say(f, "Cambios guardados. Quedó registrado en el seguimiento del proyecto.", true);
  });

  // Cambios en vivo: un formato guardado por el cliente aparece al momento.
  function live() {
    client.channel("formatos-interno").on("postgres_changes", { event: "*", schema: "public", table: "formatos" }, (ev) => {
      const row = ev.new;
      if (!row || !row.id) return;
      formatos = [row, ...formatos.filter((x) => x.id !== row.id)];
      renderFormatos(); renderSummary(); renderExpedientes();
      if (cliente) renderClienteProjects();
      if (openFm && openFm.id === row.id && $("#fmm-edit").hidden) { openFm = row; $("#fmm-doc").innerHTML = formatoHTML(row); }
    }).subscribe();
  }

  // Formatos: eventos
  $("#fm-tipo").addEventListener("change", renderFormatos);
  $("#fm-status").addEventListener("change", renderFormatos);
  $("#fm-table").addEventListener("click", (e) => { const r = e.target.closest("[data-formato]"); if (r) openFormato(r.dataset.formato); });
  $("#fm-table").addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.dataset.formato) openFormato(e.target.dataset.formato); });
  $("#fmm-close").addEventListener("click", () => { $("#fm-modal").hidden = true; openFm = null; });
  $("#fm-modal").addEventListener("click", (e) => { if (e.target.id === "fm-modal") $("#fmm-close").click(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#fm-modal").hidden) $("#fmm-close").click(); });
  // Reporte PDF del formato abierto: ver o enviar al cliente por WhatsApp / correo
  const reportArgs = () => {
    const p = proyecto(openFm.proyecto_id);
    return [openFm.tipo, openFm.data, { id: openFm.id, proyecto_id: p.id, proyecto: p.nombre, cliente: empresa(p.cliente_id).razon_social, estado: F.ESTADOS[openFm.status], enviado: openFm.submitted_at,
      firma: openFm.tipo === "carta" && openFm.firmado_at ? { por: openFm.firmado_por, at: openFm.firmado_at } : null }];
  };
  const busy = async (btn, label, job) => {
    const txt = btn.textContent;
    btn.disabled = true; btn.textContent = label;
    try { await job(); } catch (err) { say($("#fmm-form"), "No se pudo generar el PDF: " + message(err)); }
    finally { btn.disabled = false; btn.textContent = txt; }
  };
  $("#fmm-pdf").addEventListener("click", (e) => openFm && busy(e.currentTarget, "Generando…", () => window.KinamReporte.view(...reportArgs())));
  $$("[data-fsend]").forEach((b) => b.addEventListener("click", (e) => openFm && busy(e.currentTarget, "Preparando…", async () => {
    const c = empresa(proyecto(openFm.proyecto_id).cliente_id);
    const r = await window.KinamReporte.send(b.dataset.fsend, ...reportArgs(), { client, nombre: (c.representante || "").split(" ")[0], phone: c.telefono, email: c.email });
    if (r.link) say($("#fmm-form"), `Se abrió ${b.dataset.fsend === "whatsapp" ? "WhatsApp" : "el correo"} con la liga segura al PDF${c.razon_social ? " para " + c.razon_social : ""} (válida 30 días).`, true);
  })));
  $("#fmm-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const patch = { status: f.status.value, kinam_notes: f.kinam_notes.value.trim() || null };
    const { data, error } = await client.from("formatos").update(patch).eq("id", openFm.id).select().single();
    if (error) return say(f, message(error));
    formatos = formatos.map((x) => (x.id === data.id ? data : x));
    openFm = data;
    renderFormatos(); renderSummary(); renderExpedientes();
    if (cliente) renderClienteProjects();
    say(f, patch.status === "observado" ? "Guardado. El cliente ya puede corregir el formato." : "Guardado. El cliente ya ve el estado y los comentarios.", true);
  });

  // Usuarios internos: eventos
  $$("[data-tab]").forEach((b) => b.addEventListener("click", () => {
    $$("[data-tab]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    $("#tm-create").hidden = b.dataset.tab !== "tm-create";
    $("#tm-grant").hidden = b.dataset.tab !== "tm-grant";
  }));
  $("#tc-gen").addEventListener("click", () => { $("#tc-pass").value = genPassword(); });
  $("#tc-area").addEventListener("change", fillTeamSelects);
  $("#tc-name").addEventListener("change", (e) => {
    const em = $("#tc-email");
    if (em.value) return;
    const parts = e.target.value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/ñ/g, "n").replace(/[^a-z\s]/g, "").trim().split(/\s+/);
    if (parts[0]) em.value = parts[0] + (parts[1] ? "." + parts[1] : "") + "@kinamenergy.com";
  });
  $("#tc-email").addEventListener("input", (e) => { $("#tc-mail-wrap").hidden = !e.target.value.toLowerCase().endsWith("@kinamenergy.com"); });

  $("#tm-create").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const v = Object.fromEntries(new FormData(f));
    if (!v.full_name.trim()) return say(f, "Escribe el nombre completo.");
    if (!f.email.checkValidity() || !v.email.trim()) return say(f, "Escribe un correo válido.");
    if (!v.password) v.password = f.password.value = genPassword();
    const mailbox = $("#tc-mail").checked && !$("#tc-mail-wrap").hidden;
    const btn = $("button[type=submit]", f);
    btn.disabled = true;
    say(f, mailbox ? "Creando el correo y el acceso…" : "Creando el acceso…", true);
    try {
      const r = await fn({ action: "create", full_name: v.full_name.trim(), email: v.email.trim(), phone: v.phone.trim() || null, area: v.area, supervisor_id: v.supervisor_id || null, password: v.password, mailbox });
      const m = $(".auth__msg", f);
      m.classList.add("is-ok"); m.hidden = false;
      m.innerHTML = `Listo: ${esc(v.full_name)} ya puede entrar a Interno con <strong>${esc(v.email.trim().toLowerCase())}</strong> y la contraseña <span class="secret">${esc(v.password)}</span>. ${r.mail === "created" ? "También se creó su correo; entra en mail.hostinger.com con la misma contraseña." : r.mail === "existed" ? "El correo ya existía en Hostinger: conserva su contraseña anterior." : ""} Compártela por un medio seguro; no se volverá a mostrar.`;
      f.full_name.value = ""; f.email.value = ""; f.phone.value = ""; f.password.value = "";
      loadTeam();
    } catch (err) {
      say(f, err.setup ? err.message + " Mientras tanto, desmarca la casilla del correo para crear solo el acceso." : err.message);
    } finally { btn.disabled = false; }
  });

  $("#tm-grant").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    if (!f.email.checkValidity() || !f.email.value.trim()) return say(f, "Escribe un correo válido.");
    try {
      await fn({ action: "grant", email: f.email.value.trim(), area: f.area.value });
      f.reset(); fillTeamSelects();
      say(f, "Listo. La persona ya puede entrar a Interno con su correo y contraseña.", true);
      loadTeam();
    } catch (err) { say(f, err.message); }
  });

  $("#tm-table").addEventListener("change", async (e) => {
    const s = e.target.closest("[data-area]");
    if (!s) return;
    try { await fn({ action: "update", user_id: s.dataset.area, area: s.value, supervisor_id: (team.find((m) => m.id === s.dataset.area) || {}).supervisor_id || null }); loadTeam(); }
    catch (err) { alert(err.message); loadTeam(); }
  });
  $("#tm-table").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-remove], [data-active], [data-pass]");
    if (!b) return;
    const id = b.dataset.remove || b.dataset.active || b.dataset.pass;
    const m = team.find((x) => x.id === id) || {};
    const name = m.full_name || m.email || "esta persona";
    try {
      if (b.dataset.remove) {
        if (!confirm("¿Quitar el acceso interno a " + name + "? Su cuenta y su correo no se borran.")) return;
        await fn({ action: "remove", user_id: id });
      } else if (b.dataset.active) {
        const on = b.dataset.on === "1";
        if (!confirm((on ? "¿Reactivar a " : "¿Bloquear el acceso de ") + name + "?")) return;
        await fn({ action: "active", user_id: id, active: on });
      } else {
        const pw = genPassword();
        if (!confirm("¿Cambiar la contraseña de " + name + (m.mailbox ? " (Interno y correo)" : "") + "?")) return;
        const r = await fn({ action: "password", user_id: id, password: pw });
        prompt("Nueva contraseña de " + name + (r.mail ? " (también en su correo)" : "") + ". Cópiala y compártela por un medio seguro:", pw);
      }
      loadTeam();
    } catch (err) { alert(err.message); }
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
    try { await loadData(); live(); } catch (err) { $("#main").insertAdjacentHTML("afterbegin", `<p class="auth__msg">No se pudieron cargar los datos: ${esc(message(err))}</p>`); }
    // Mi panel (panel.js) arranca con este contexto; puede cargar antes o después que este archivo.
    window.KinamInterno = { client, user, role, staff, profiles: clients, proyectos, empresas, AREAS };
    document.dispatchEvent(new CustomEvent("kinam:interno", { detail: window.KinamInterno }));
    route();
  });
})();
