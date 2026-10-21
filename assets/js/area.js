// KINAM Energy | área de trabajo del cliente (requiere sesión)
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const { client, ready, message, staffRole } = window.KinamAuth;
  const F = window.KinamFormatos;
  const VIEWS = ["inicio", "gestion", "evaluacion", "requisitos", "carta", "cuenta"];
  const STATUS = { recibida: "Recibida", revision: "En revisión", propuesta: "Con propuesta", cerrada: "Cerrada" };
  const FORMS = {
    requisitos: { schema: F.REQUISITOS, name: "Requisitos de instalación", form: "#rq-form", view: "#view-requisitos" },
    carta: { schema: F.CARTA, name: "Carta compromiso", form: "#ct-form", view: "#view-carta" }
  };
  let user = null, profile = {}, cliente = null, proyectos = [], formatos = [], seguimiento = [], evals = [];
  const selected = {};

  if (!ready) return location.replace("/acceso.html");

  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v) => (v === "" || v == null ? null : Number(v));
  const fmt = (n, unit) => (n == null ? "—" : Number(n).toLocaleString("es-MX") + " " + unit);
  const day = (d) => new Date(d).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
  const badge = (s, label) => `<span class="badge badge--${esc(s)}">${esc(label || s)}</span>`;
  const formato = (pid, tipo) => formatos.find((x) => x.proyecto_id === pid && x.tipo === tipo);
  const editable = (row) => !row || row.status === "borrador" || row.status === "observado";

  function say(form, text, ok) {
    const m = $(".auth__msg", form);
    m.textContent = text;
    m.classList.toggle("is-ok", Boolean(ok));
    m.hidden = false;
  }

  // Navegación: #vista o #vista?p=<proyecto>
  function route() {
    const [v, q] = location.hash.slice(1).split("?");
    const alias = { "mis-evaluaciones": "gestion" };
    const view = VIEWS.includes(alias[v] || v) ? (alias[v] || v) : "inicio";
    const p = new URLSearchParams(q || "").get("p");
    $$(".view").forEach((s) => { s.hidden = s.id !== "view-" + view; });
    $$(".app__side a").forEach((a) => a.setAttribute("aria-current", a.dataset.view === view ? "page" : "false"));
    if (FORMS[view]) { if (p) selected[view] = p; openForm(view); }
    window.scrollTo(0, 0);
  }

  // Datos
  async function loadProfile() {
    const { data } = await client.from("profiles").select("full_name, company, phone").eq("id", user.id).maybeSingle();
    const meta = user.user_metadata || {};
    profile = { full_name: data?.full_name || meta.full_name || "", company: data?.company || meta.company || "", phone: data?.phone || meta.phone || "" };
    $("#user-name").textContent = profile.full_name || user.email;
    $$("[data-first-name]").forEach((el) => { el.textContent = (profile.full_name || "").split(" ")[0] || "bienvenido"; });
    $("#pf-email").value = user.email;
    $("#pf-name").value = profile.full_name;
    $("#pf-company").value = profile.company;
    $("#pf-phone").value = profile.phone;
  }

  async function loadAll() {
    const c = await client.from("clientes").select("*").eq("user_id", user.id).order("created_at").limit(1).maybeSingle();
    cliente = c.data || null;
    proyectos = []; formatos = []; seguimiento = [];
    if (cliente) {
      const p = await client.from("proyectos").select("*").eq("cliente_id", cliente.id).order("created_at", { ascending: false });
      proyectos = p.data || [];
      const ids = proyectos.map((x) => x.id);
      if (ids.length) {
        const [fm, sg] = await Promise.all([
          client.from("formatos").select("*").in("proyecto_id", ids),
          client.from("seguimiento").select("proyecto_id, at, accion, detalle").in("proyecto_id", ids).order("at", { ascending: false }).limit(100)
        ]);
        formatos = fm.data || [];
        seguimiento = sg.data || [];
      }
    }
    const ev = await client.from("evaluaciones").select("id, created_at, project_name, industry, location, peak_kw, monthly_kwh, status, kinam_notes, proyecto_id").order("created_at", { ascending: false });
    evals = ev.data || [];
    renderAll();
  }

  function renderAll() {
    renderCliente();
    renderProjects();
    renderEvaluations();
    renderSteps();
    $$("select[data-project], #ev-proyecto").forEach((s) => {
      const keep = s.id === "ev-proyecto" ? '<option value="">Nuevo proyecto con el nombre de abajo</option>' : "";
      s.innerHTML = keep + proyectos.map((p) => `<option value="${p.id}">${esc(p.nombre)}</option>`).join("");
    });
    const open = location.hash.slice(1).split("?")[0];
    if (FORMS[open]) openForm(open);
  }

  function renderSteps() {
    const sent = (t) => formatos.some((x) => x.tipo === t && x.status !== "borrador");
    const steps = [
      ["Alta de cliente", Boolean(cliente), "#gestion"],
      ["Primer proyecto", proyectos.length > 0, "#gestion"],
      ["Evaluación técnica", evals.length > 0, "#evaluacion"],
      ["Requisitos de instalación", sent("requisitos"), "#requisitos"],
      ["Carta compromiso", sent("carta"), "#carta"]
    ];
    $("#steps").innerHTML = steps.map(([l, ok, href], i) => `<li class="${ok ? "is-done" : ""}"><a href="${href}"><span class="mono">${ok ? "✓" : String(i + 1).padStart(2, "0")}</span> ${esc(l)}</a></li>`).join("");
    $("#stat-total").textContent = evals.length;
    $("#stat-projects").textContent = proyectos.length;
    $("#stat-forms").textContent = formatos.filter((x) => x.status !== "borrador").length;
  }

  function renderCliente() {
    const f = $("#cliente-form");
    const d = cliente || { razon_social: profile.company, telefono: profile.phone, email: user.email, representante: profile.full_name, pais: "México" };
    ["razon_social", "rfc", "pais", "domicilio", "ciudad", "estado", "actividad", "representante", "cargo", "telefono", "email"].forEach((k) => { f[k].value = d[k] || ""; });
    $("#cl-hint").textContent = cliente ? "Tu empresa ya está dada de alta. Puedes actualizar sus datos cuando quieras." : "Registra los datos de tu empresa. Con ellos se llenan automáticamente tus formatos.";
    $("#proyecto-form").hidden = !cliente;
  }

  function renderProjects() {
    const list = $("#project-list");
    if (!cliente) { list.innerHTML = '<p class="note">Guarda primero los datos de tu empresa para agregar proyectos.</p>'; return; }
    if (!proyectos.length) { list.innerHTML = '<p class="note">Aún no tienes proyectos. Agrega el primero arriba.</p>'; return; }
    list.innerHTML = proyectos.map((p) => {
      const chip = (t) => {
        const r = formato(p.id, t);
        return `<a class="chip" href="#${t}?p=${p.id}">${esc(FORMS[t].name)} ${r ? badge(r.status, F.ESTADOS[r.status]) : badge("pendiente", "Pendiente")}</a>`;
      };
      const log = seguimiento.filter((s) => s.proyecto_id === p.id).slice(0, 3);
      return `<article class="evcard">
        <header><div><h2>${esc(p.nombre)}</h2><p class="note">${esc(p.ubicacion || "")}${p.ubicacion ? " · " : ""}desde ${day(p.created_at)}</p></div>${badge(p.etapa, F.ETAPAS[p.etapa])}</header>
        <div class="chips">${chip("requisitos")}${chip("carta")}</div>
        ${p.kinam_notes ? `<p class="evcard__notes"><strong>Comentarios de KINAM:</strong> ${esc(p.kinam_notes)}</p>` : ""}
        ${log.length ? `<ul class="timeline">${log.map((s) => `<li><span class="note">${day(s.at)}</span> ${esc(s.accion)}${s.detalle ? ` · ${esc(s.detalle)}` : ""}</li>`).join("")}</ul>` : ""}
      </article>`;
    }).join("");
  }

  function renderEvaluations() {
    const list = $("#eval-list");
    $("#eval-empty").hidden = evals.length > 0;
    list.innerHTML = evals.map((e) => `
      <article class="evcard">
        <header>
          <h2>${esc(e.project_name)}</h2>
          ${badge(e.status, STATUS[e.status] || e.status)}
        </header>
        <p class="note">${esc(e.industry)} · ${esc(e.location)} · ${day(e.created_at)}</p>
        <dl><div><dt>Demanda máxima</dt><dd>${fmt(e.peak_kw, "kW")}</dd></div><div><dt>Consumo mensual</dt><dd>${fmt(e.monthly_kwh, "kWh")}</dd></div></dl>
        ${e.kinam_notes ? `<p class="evcard__notes"><strong>Comentarios de KINAM:</strong> ${esc(e.kinam_notes)}</p>` : ""}
      </article>`).join("");
  }

  // Formatos (Requisitos de instalación y Carta compromiso)
  function prefill(tipo) {
    const c = cliente || {};
    const p = proyectos.find((x) => x.id === selected[tipo]) || {};
    if (tipo === "requisitos") {
      return { empresa: c.razon_social, tax_id: c.rfc, pais: c.pais, direccion: p.ubicacion, actividad: c.actividad, resp_proyecto: c.representante, telefono: c.telefono, email: c.email };
    }
    return { consumidor: c.razon_social, rfc: c.rfc, domicilio: [c.domicilio, c.ciudad, c.estado].filter(Boolean).join(", "), representante: c.representante, cargo: c.cargo,
      ciudad: c.ciudad, estado: c.estado, fecha: new Date().toISOString().slice(0, 10), a_domicilio: p.ubicacion };
  }

  function openForm(tipo) {
    const cfg = FORMS[tipo];
    const view = $(cfg.view);
    const form = $(cfg.form);
    const has = Boolean(cliente && proyectos.length);
    $("[data-need]", view).hidden = has;
    form.hidden = !has;
    $(".fm__bar", view).hidden = !has;
    if (!has) return;
    if (!proyectos.some((p) => p.id === selected[tipo])) selected[tipo] = proyectos[0].id;
    $("[data-project]", view).value = selected[tipo];
    const row = formato(selected[tipo], tipo);
    const data = row ? row.data : Object.fromEntries(Object.entries(prefill(tipo)).filter(([, v]) => v));
    const ro = !editable(row);
    F.render($("[data-fields]", form), cfg.schema, data, { readonly: ro, prefix: tipo });
    $("[data-status]", view).innerHTML = row ? badge(row.status, F.ESTADOS[row.status]) : badge("pendiente", "Sin empezar");
    $("[data-progress]", view).textContent = F.progress(cfg.schema, data) + "% completado";
    const notes = $("[data-notes]", view);
    notes.hidden = !row?.kinam_notes;
    notes.innerHTML = row?.kinam_notes ? `<strong>Comentarios de KINAM:</strong> ${esc(row.kinam_notes)}` : "";
    $$("[data-save], button[type=submit]", form).forEach((b) => { b.hidden = ro; });
    $(".auth__msg", form).hidden = true;
    if (tipo === "carta") {
      $("#ct-firmante").value = row?.firmado_por || profile.full_name || "";
      $("#ct-firmante").disabled = ro;
      $("#ct-acepto").checked = Boolean(row?.firmado_at);
      $("#ct-acepto").disabled = ro;
      $(".fm__sign").hidden = false;
      preview();
    }
    if (ro) say(form, row.status === "aprobado" ? "KINAM aprobó este formato." : "Enviado a KINAM. Podrás editarlo de nuevo si el equipo te pide cambios.", true);
  }

  function preview() {
    const row = formato(selected.carta, "carta");
    const data = editable(row) ? F.collect($("#ct-form"), F.CARTA) : row.data;
    $("#ct-preview").innerHTML = F.cartaHTML(data, { por: row?.firmado_at ? row.firmado_por : null, at: row?.firmado_at });
  }

  async function save(tipo, send) {
    const cfg = FORMS[tipo];
    const form = $(cfg.form);
    const data = F.collect(form, cfg.schema);
    const row = { proyecto_id: selected[tipo], tipo, data, status: send ? "enviado" : "borrador" };
    if (tipo === "carta") {
      const by = $("#ct-firmante").value.trim();
      if (send) {
        if (!data.consumidor || !data.rfc || !data.representante) return say(form, "Completa al menos razón social, RFC y representante.");
        if (!by) return say(form, "Escribe el nombre de quien firma.");
        if (!$("#ct-acepto").checked) return say(form, "Marca la casilla de aceptación para firmar.");
        Object.assign(row, { firmado_por: by, firmado_at: new Date().toISOString() });
      } else {
        Object.assign(row, { firmado_por: by || null, firmado_at: null });
      }
    }
    if (send && tipo === "requisitos" && F.progress(cfg.schema, data) < 15 && !confirm("La ficha está casi vacía. ¿Enviarla de todos modos?")) return;
    $$("button", form).forEach((b) => { b.disabled = true; });
    const { data: saved, error } = await client.from("formatos").upsert(row, { onConflict: "proyecto_id,tipo" }).select().single();
    $$("button", form).forEach((b) => { b.disabled = false; });
    if (error) return say(form, "No se pudo guardar: " + message(error));
    formatos = formatos.filter((x) => !(x.proyecto_id === row.proyecto_id && x.tipo === tipo)).concat(saved);
    renderProjects(); renderSteps();
    openForm(tipo);
    say(form, send ? "¡Enviado! El equipo de KINAM lo revisará y te avisará aquí." : "Borrador guardado. Puedes continuar cuando quieras.", true);
  }

  Object.entries(FORMS).forEach(([tipo, cfg]) => {
    const view = $(cfg.view), form = $(cfg.form);
    $("[data-project]", view).addEventListener("change", (e) => { selected[tipo] = e.target.value; openForm(tipo); });
    $("[data-save]", form).addEventListener("click", () => save(tipo, false));
    form.addEventListener("submit", (e) => { e.preventDefault(); save(tipo, true); });
    $("[data-print]", form).addEventListener("click", () => {
      const row = formato(selected[tipo], tipo);
      const data = editable(row) ? F.collect(form, cfg.schema) : row.data;
      const p = proyectos.find((x) => x.id === selected[tipo]) || {};
      F.print(cfg.name + " · " + (p.nombre || ""), tipo === "carta"
        ? F.cartaHTML(data, { por: row?.firmado_at ? row.firmado_por : null, at: row?.firmado_at })
        : F.requisitosHTML(data, { proyecto: p.nombre }));
    });
    form.addEventListener("input", () => {
      $("[data-progress]", view).textContent = F.progress(cfg.schema, F.collect(form, cfg.schema)) + "% completado";
      if (tipo === "carta") preview();
    });
  });

  // Alta de cliente y proyectos
  $("#cliente-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const v = Object.fromEntries(new FormData(f));
    Object.keys(v).forEach((k) => { v[k] = v[k].trim() || null; });
    if (!v.razon_social) { f.razon_social.focus(); return say(f, "Escribe el nombre o razón social."); }
    if (v.rfc) v.rfc = v.rfc.toUpperCase();
    const q = cliente
      ? client.from("clientes").update(v).eq("id", cliente.id).select().single()
      : client.from("clientes").insert({ ...v, user_id: user.id }).select().single();
    const { data, error } = await q;
    if (error) return say(f, message(error));
    const first = !cliente;
    cliente = data;
    renderAll();
    say(f, first ? "Empresa dada de alta. Ahora agrega tu primer proyecto." : "Datos de la empresa guardados.", true);
  });

  $("#proyecto-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    if (!f.nombre.value.trim()) { f.nombre.focus(); return say(f, "Escribe el nombre del proyecto."); }
    const { error } = await client.from("proyectos").insert({ cliente_id: cliente.id, nombre: f.nombre.value.trim(), ubicacion: f.ubicacion.value.trim() || null });
    if (error) return say(f, message(error));
    f.reset();
    await loadAll();
    say(f, "Proyecto agregado. Ya puedes llenar sus formatos.", true);
  });

  // Evaluación técnica
  $("#eval-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    let bad = null;
    $$("[required]", f).forEach((i) => { const ok = i.value.trim() !== ""; i.setAttribute("aria-invalid", String(!ok)); if (!ok && !bad) bad = i; });
    if (bad) { bad.focus(); return say(f, "Completa nombre del proyecto, industria y ubicación."); }
    if (!cliente) return say(f, "Primero da de alta tu empresa en Gestión.");
    const v = Object.fromEntries(new FormData(f));
    const btn = $("button[type=submit]", f);
    btn.disabled = true;
    let proyecto_id = v.proyecto_id || null;
    if (!proyecto_id) {
      const { data: p, error: pe } = await client.from("proyectos").insert({ cliente_id: cliente.id, nombre: v.project_name.trim(), ubicacion: v.location.trim() || null }).select("id").single();
      if (pe) { btn.disabled = false; return say(f, "No se pudo crear el proyecto: " + message(pe)); }
      proyecto_id = p.id;
    }
    const row = {
      user_id: user.id, proyecto_id,
      project_name: v.project_name.trim(), industry: v.industry, location: v.location.trim(),
      peak_kw: num(v.peak_kw), monthly_kwh: num(v.monthly_kwh), hours_per_day: num(v.hours_per_day), monthly_cost_mxn: num(v.monthly_cost_mxn),
      phases: v.phases || null, voltage: v.voltage.trim() || null, frequency_hz: num(v.frequency_hz), current_source: v.current_source || null,
      backup_hours: num(v.backup_hours), criticality: v.criticality || null, container_space: v.container_space || null,
      business_model: v.business_model || null, notes: v.notes.trim() || null
    };
    const { error } = await client.from("evaluaciones").insert(row);
    btn.disabled = false;
    if (error) return say(f, "No se pudo enviar: " + message(error));
    f.reset();
    await loadAll();
    say(f, "¡Evaluación enviada! El equipo técnico de KINAM la revisará y te contactará.", true);
    setTimeout(() => { location.hash = "#gestion"; }, 1600);
  });
  $("#ev-proyecto").addEventListener("change", (e) => {
    const p = proyectos.find((x) => x.id === e.target.value);
    if (p) { $("#ev-name").value = p.nombre; $("#ev-location").value = p.ubicacion || ""; }
  });

  $("#profile-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    if (!f.full_name.value.trim()) return say(f, "Escribe tu nombre.");
    const { error } = await client.from("profiles").upsert({ id: user.id, full_name: f.full_name.value.trim(), company: f.company.value.trim(), phone: f.phone.value.trim() });
    if (error) return say(f, message(error));
    say(f, "Datos guardados.", true);
    loadProfile();
  });

  $("#logout").addEventListener("click", async () => {
    await client.auth.signOut();
    location.replace("/acceso.html");
  });

  client.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT") location.replace("/acceso.html"); });

  client.auth.getSession().then(async ({ data }) => {
    if (!data.session) {
      return location.replace("/acceso.html?area=evaluacion");
    }
    user = data.session.user;
    document.body.classList.remove("is-loading");
    window.addEventListener("hashchange", route);
    await loadProfile();
    try { await loadAll(); } catch (err) { $("#main").insertAdjacentHTML("afterbegin", `<p class="auth__msg">No se pudieron cargar tus datos: ${esc(message(err))}</p>`); }
    route();
    if (await staffRole(user.id)) $("#to-interno").hidden = false;
  });
})();
