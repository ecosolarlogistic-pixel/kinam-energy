// KINAM Energy | área de trabajo (requiere sesión)
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const { client, ready, message } = window.KinamAuth;
  const VIEWS = ["inicio", "evaluacion", "portal", "cuenta"];
  const STATUS = { recibida: "Recibida", revision: "En revisión", propuesta: "Con propuesta", cerrada: "Cerrada" };
  let user = null;

  if (!ready) return location.replace("/acceso.html");

  function route() {
    const v = location.hash.slice(1);
    const view = VIEWS.includes(v) ? v : "inicio";
    $$(".view").forEach((s) => { s.hidden = s.id !== "view-" + view; });
    $$(".app__side a").forEach((a) => a.setAttribute("aria-current", a.dataset.view === view ? "page" : "false"));
    if (view === "portal" || view === "inicio") loadEvaluations();
    window.scrollTo(0, 0);
  }

  function say(form, text, ok) {
    const m = $(".auth__msg", form);
    m.textContent = text;
    m.classList.toggle("is-ok", Boolean(ok));
    m.hidden = false;
  }

  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v) => (v === "" || v == null ? null : Number(v));
  const fmt = (n, unit) => (n == null ? "—" : Number(n).toLocaleString("es-MX") + " " + unit);

  async function loadProfile() {
    const { data } = await client.from("profiles").select("full_name, company, phone").eq("id", user.id).maybeSingle();
    const meta = user.user_metadata || {};
    const p = { full_name: data?.full_name || meta.full_name || "", company: data?.company || meta.company || "", phone: data?.phone || meta.phone || "" };
    $("#user-name").textContent = p.full_name || user.email;
    $$("[data-first-name]").forEach((el) => { el.textContent = (p.full_name || "").split(" ")[0] || "bienvenido"; });
    $("#pf-email").value = user.email;
    $("#pf-name").value = p.full_name;
    $("#pf-company").value = p.company;
    $("#pf-phone").value = p.phone;
  }

  async function loadEvaluations() {
    const { data, error } = await client.from("evaluaciones")
      .select("id, created_at, project_name, industry, location, peak_kw, monthly_kwh, status, kinam_notes")
      .order("created_at", { ascending: false });
    const list = $("#eval-list");
    if (error) { list.innerHTML = '<p class="form__error">No pudimos cargar tus evaluaciones. ' + esc(message(error)) + "</p>"; return; }
    $("#stat-total").textContent = data.length;
    $("#stat-review").textContent = data.filter((e) => e.status === "revision").length;
    $("#stat-proposal").textContent = data.filter((e) => e.status === "propuesta").length;
    $("#eval-empty").hidden = data.length > 0;
    list.innerHTML = data.map((e) => `
      <article class="evcard">
        <header>
          <h2>${esc(e.project_name)}</h2>
          <span class="badge badge--${esc(e.status)}">${esc(STATUS[e.status] || e.status)}</span>
        </header>
        <p class="note">${esc(e.industry)} · ${esc(e.location)} · ${new Date(e.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}</p>
        <dl><div><dt>Demanda máxima</dt><dd>${fmt(e.peak_kw, "kW")}</dd></div><div><dt>Consumo mensual</dt><dd>${fmt(e.monthly_kwh, "kWh")}</dd></div></dl>
        ${e.kinam_notes ? `<p class="evcard__notes"><strong>Comentarios de KINAM:</strong> ${esc(e.kinam_notes)}</p>` : ""}
      </article>`).join("");
  }

  $("#eval-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    let bad = null;
    $$("[required]", f).forEach((i) => { const ok = i.value.trim() !== ""; i.setAttribute("aria-invalid", String(!ok)); if (!ok && !bad) bad = i; });
    if (bad) { bad.focus(); return say(f, "Completa nombre del proyecto, industria y ubicación."); }
    const v = Object.fromEntries(new FormData(f));
    const row = {
      user_id: user.id,
      project_name: v.project_name.trim(), industry: v.industry, location: v.location.trim(),
      peak_kw: num(v.peak_kw), monthly_kwh: num(v.monthly_kwh), hours_per_day: num(v.hours_per_day), monthly_cost_mxn: num(v.monthly_cost_mxn),
      phases: v.phases || null, voltage: v.voltage.trim() || null, frequency_hz: num(v.frequency_hz), current_source: v.current_source || null,
      backup_hours: num(v.backup_hours), criticality: v.criticality || null, container_space: v.container_space || null,
      business_model: v.business_model || null, notes: v.notes.trim() || null
    };
    const btn = $("button[type=submit]", f);
    btn.disabled = true;
    const { error } = await client.from("evaluaciones").insert(row);
    btn.disabled = false;
    if (error) return say(f, "No se pudo enviar: " + message(error));
    f.reset();
    say(f, "¡Evaluación enviada! El equipo técnico de KINAM la revisará y te contactará.", true);
    setTimeout(() => { location.hash = "#portal"; }, 1600);
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
      const area = location.hash === "#portal" ? "portal" : "evaluacion";
      return location.replace("/acceso.html?area=" + area);
    }
    user = data.session.user;
    document.body.classList.remove("is-loading");
    window.addEventListener("hashchange", route);
    await loadProfile();
    route();
  });
})();
