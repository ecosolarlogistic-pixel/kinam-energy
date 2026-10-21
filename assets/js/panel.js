// KINAM Energy | Mi panel: actividades, calendario y correo de cada persona del equipo
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const WEBMAIL = "https://mail.hostinger.com/";
  const DOMAIN = "kinamenergy.com";
  const TIPOS = { tarea: "Tarea", reunion: "Reunión", llamada: "Llamada", visita: "Visita", instalacion: "Instalación", otro: "Otro" };
  const ESTADOS = { pendiente: "Pendiente", en_curso: "En curso", terminada: "Terminada", cancelada: "Cancelada" };
  const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  let ctx = null, acts = [], month = startOfMonth(new Date()), current = null, myArea = null;

  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  const name = (id) => { const p = ctx.profiles.get(id) || {}; return p.full_name || p.email || "—"; };
  const open = (a) => a.estado === "pendiente" || a.estado === "en_curso";
  const late = (a) => open(a) && new Date(a.fin || a.inicio) < new Date() && ymd(new Date(a.inicio)) !== ymd(new Date());
  const when = (a) => {
    const d = new Date(a.inicio);
    const day = d.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" });
    return a.todo_el_dia ? day : `${day} · ${hm(d)}`;
  };

  function say(form, text, ok) {
    const m = $(".auth__msg", form);
    m.textContent = text;
    m.classList.toggle("is-ok", Boolean(ok));
    m.hidden = false;
  }

  async function load() {
    const { data, error } = await ctx.client.from("actividades").select("*").order("inicio");
    if (error) { $("#pn-todo").innerHTML = `<li class="form__error">${esc(error.message)}</li>`; return; }
    acts = data || [];
    render();
  }

  // Qué actividades se ven en el calendario según el filtro.
  function visible() {
    const v = $("#cal-who").value;
    if (v === "mias") return acts.filter((a) => a.asignado_a === ctx.user.id);
    if (v === "enviadas") return acts.filter((a) => a.creado_por === ctx.user.id && a.asignado_a !== ctx.user.id);
    if (v === "todas") return acts;
    return acts.filter((a) => a.asignado_a === v);
  }

  function render() {
    const me = ctx.user.id;
    const today = ymd(new Date());
    const week = Date.now() + 7 * 864e5;
    const mine = acts.filter((a) => a.asignado_a === me && open(a));
    const sent = acts.filter((a) => a.creado_por === me && a.asignado_a !== me && a.estado !== "cancelada");
    $("#pn-today").textContent = mine.filter((a) => ymd(new Date(a.inicio)) === today).length;
    $("#pn-late").textContent = mine.filter(late).length;
    $("#pn-week").textContent = mine.filter((a) => new Date(a.inicio) >= new Date() && new Date(a.inicio) <= week).length;
    $("#pn-mine").textContent = sent.filter(open).length;
    const badge = $("#pn-count");
    badge.textContent = mine.length;
    badge.hidden = !mine.length;

    const item = (a, who) => `<li class="act act--${a.estado}${late(a) ? " act--late" : ""}" data-act="${a.id}" tabindex="0">
      <span class="act__when">${esc(when(a))}${late(a) ? " · atrasada" : ""}</span>
      <strong>${esc(a.titulo)}</strong>
      <span class="note">${esc(TIPOS[a.tipo])} · ${who}${a.prioridad === "alta" ? ' · <span class="act__hi">Alta</span>' : ""}</span></li>`;
    $("#pn-todo").innerHTML = mine.length ? mine.map((a) => item(a, a.creado_por === me ? "Propia" : "De " + esc(name(a.creado_por)))).join("") : '<li class="note">Sin pendientes. 🎉</li>';
    $("#pn-sent").innerHTML = sent.length ? sent.slice(-12).reverse().map((a) => item(a, "Para " + esc(name(a.asignado_a)) + " · " + esc(ESTADOS[a.estado]))).join("") : '<li class="note">No has asignado actividades.</li>';
    renderCal();
  }

  function renderCal() {
    const title = month.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
    $("#cal-title").textContent = title.charAt(0).toUpperCase() + title.slice(1);
    const first = new Date(month);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
    const list = visible().filter((a) => a.estado !== "cancelada");
    const byDay = {};
    list.forEach((a) => { (byDay[ymd(new Date(a.inicio))] ||= []).push(a); });
    const today = ymd(new Date());
    let html = DIAS.map((d) => `<div class="cal__dow" role="columnheader">${d}</div>`).join("");
    for (let i = 0; i < 42; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const key = ymd(d);
      const items = byDay[key] || [];
      const out = d.getMonth() !== month.getMonth();
      html += `<div class="cal__day${out ? " is-out" : ""}${key === today ? " is-today" : ""}" role="gridcell" data-day="${key}">
        <button class="cal__num" type="button" data-day-new="${key}" aria-label="Agendar el ${d.toLocaleDateString("es-MX", { day: "numeric", month: "long" })}">${d.getDate()}</button>
        ${items.slice(0, 3).map((a) => `<button type="button" class="cal__ev cal__ev--${a.tipo} is-${a.estado}" data-act="${a.id}" title="${esc(a.titulo)} · ${esc(name(a.asignado_a))}">${a.todo_el_dia ? "" : hm(new Date(a.inicio)) + " "}${esc(a.titulo)}</button>`).join("")}
        ${items.length > 3 ? `<span class="cal__more">+${items.length - 3} más</span>` : ""}
      </div>`;
    }
    $("#cal").innerHTML = html;
  }

  // Formulario de actividad
  function fillSelects() {
    const people = [...ctx.staff].sort((a, b) => name(a.user_id).localeCompare(name(b.user_id)));
    const groups = Object.entries(ctx.AREAS).map(([k, [label]]) => {
      const opts = people.filter((s) => s.area === k).map((s) => `<option value="${s.user_id}">${esc(name(s.user_id))}${s.user_id === ctx.user.id ? " (yo)" : ""}</option>`).join("");
      return opts ? `<optgroup label="${esc(label)}">${opts}</optgroup>` : "";
    }).join("");
    $("#ac-asignado").innerHTML = groups;
    $("#ac-proyecto").innerHTML = '<option value="">Sin proyecto</option>' + ctx.proyectos.map((p) => {
      const c = ctx.empresas.find((e) => e.id === p.cliente_id) || {};
      return `<option value="${p.id}">${esc(p.nombre)}${c.razon_social ? " · " + esc(c.razon_social) : ""}</option>`;
    }).join("");
    const opts = [["mias", "Mis actividades"], ["enviadas", "Asignadas por mí"]];
    if (ctx.role === "admin" || ctx.staff.some((s) => s.supervisor_id === ctx.user.id)) opts.push(["todas", ctx.role === "admin" ? "Todo el equipo" : "Mi equipo"]);
    const others = people.filter((s) => s.user_id !== ctx.user.id).map((s) => [s.user_id, "Agenda de " + name(s.user_id)]);
    $("#cal-who").innerHTML = opts.concat(ctx.role === "admin" ? others : []).map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join("");
  }

  function openAct(a, day) {
    current = a || null;
    const f = $("#act-form");
    f.reset();
    $(".auth__msg", f).hidden = true;
    const mineToEdit = !a || a.creado_por === ctx.user.id || ctx.role === "admin";
    $("#act-title").textContent = a ? a.titulo : "Agendar actividad";
    $("#act-meta").textContent = a ? `${TIPOS[a.tipo]} · para ${name(a.asignado_a)} · creada por ${name(a.creado_por)}` : "Se notifica en el panel de la persona asignada.";
    if (a) {
      const ini = new Date(a.inicio), fin = a.fin ? new Date(a.fin) : null;
      f.titulo.value = a.titulo; f.asignado_a.value = a.asignado_a; f.tipo.value = a.tipo; f.prioridad.value = a.prioridad;
      f.fecha.value = ymd(ini); f.hini.value = hm(ini); f.hfin.value = fin ? hm(fin) : "";
      f.todo_el_dia.checked = a.todo_el_dia; f.proyecto_id.value = a.proyecto_id || ""; f.ubicacion.value = a.ubicacion || "";
      f.descripcion.value = a.descripcion || ""; f.estado.value = a.estado; f.nota_cierre.value = a.nota_cierre || "";
    } else {
      f.asignado_a.value = ctx.user.id;
      f.fecha.value = day || ymd(new Date());
    }
    $$("input, select, textarea", f).forEach((el) => {
      const closing = el.closest("[data-close-only]");
      el.disabled = closing ? false : !mineToEdit;
    });
    $$("[data-close-only]", f).forEach((el) => { el.hidden = !a; });
    $("#ac-ics").hidden = !a;
    toggleHours();
    $("#act-modal").hidden = false;
    (mineToEdit ? f.titulo : f.estado).focus();
  }

  function toggleHours() {
    const all = $("#ac-dia").checked;
    $("#ac-hini").closest("div").hidden = all;
    $("#ac-hfin").closest("div").hidden = all;
  }

  function closeAct() { $("#act-modal").hidden = true; current = null; }

  async function saveAct(e) {
    e.preventDefault();
    const f = e.currentTarget;
    if (!f.titulo.disabled && !f.titulo.value.trim()) return say(f, "Escribe la actividad.");
    if (!f.titulo.disabled && !f.fecha.value) return say(f, "Elige la fecha.");
    let row;
    if (f.titulo.disabled) {
      row = { estado: f.estado.value, nota_cierre: f.nota_cierre.value.trim() || null };
    } else {
      const all = f.todo_el_dia.checked;
      const inicio = new Date(`${f.fecha.value}T${all ? "00:00" : f.hini.value || "09:00"}`);
      let fin = all ? null : (f.hfin.value ? new Date(`${f.fecha.value}T${f.hfin.value}`) : null);
      if (fin && fin < inicio) return say(f, "La hora de fin debe ser después de la de inicio.");
      row = {
        titulo: f.titulo.value.trim(), asignado_a: f.asignado_a.value, tipo: f.tipo.value, prioridad: f.prioridad.value,
        inicio: inicio.toISOString(), fin: fin ? fin.toISOString() : null, todo_el_dia: all,
        proyecto_id: f.proyecto_id.value || null, ubicacion: f.ubicacion.value.trim() || null, descripcion: f.descripcion.value.trim() || null
      };
      if (current) Object.assign(row, { estado: f.estado.value, nota_cierre: f.nota_cierre.value.trim() || null });
    }
    const q = current ? ctx.client.from("actividades").update(row).eq("id", current.id) : ctx.client.from("actividades").insert(row);
    const { error } = await q;
    if (error) return say(f, error.message);
    const target = row.asignado_a && row.asignado_a !== ctx.user.id ? " Ya aparece en el panel de " + name(row.asignado_a) + "." : "";
    await load();
    if (!current) { say(f, "Actividad agendada." + target, true); setTimeout(closeAct, 1200); }
    else closeAct();
  }

  // Exportar a calendario (.ics), compatible con Google Calendar, Outlook y Apple.
  function ics(list) {
    const e = (t) => String(t || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
    const utc = (d) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const date = (d) => ymd(new Date(d)).replace(/-/g, "");
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//KINAM Energy//Interno//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
    list.forEach((a) => {
      const end = a.todo_el_dia ? date(new Date(new Date(a.inicio).getTime() + 864e5)) : utc(a.fin || new Date(new Date(a.inicio).getTime() + 3600e3));
      lines.push("BEGIN:VEVENT", `UID:${a.id}@${DOMAIN}`, `DTSTAMP:${utc(new Date())}`,
        a.todo_el_dia ? `DTSTART;VALUE=DATE:${date(a.inicio)}` : `DTSTART:${utc(a.inicio)}`,
        a.todo_el_dia ? `DTEND;VALUE=DATE:${end}` : `DTEND:${end}`,
        `SUMMARY:${e(a.titulo)}`, `DESCRIPTION:${e([TIPOS[a.tipo], a.descripcion, "Asignada por " + name(a.creado_por)].filter(Boolean).join("\n"))}`,
        a.ubicacion ? `LOCATION:${e(a.ubicacion)}` : "", `STATUS:${a.estado === "cancelada" ? "CANCELLED" : "CONFIRMED"}`, "END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    return lines.filter(Boolean).join("\r\n");
  }
  function download(name, text) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/calendar;charset=utf-8" }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // Arranque: interno.js avisa cuando la sesión es del equipo.
  function start(detail) {
    if (ctx) return;
    ctx = detail;
    const p = ctx.profiles.get(ctx.user.id) || {};
    const me = ctx.staff.find((s) => s.user_id === ctx.user.id) || {};
    myArea = ctx.AREAS[me.area];
    $("#pn-first").textContent = (p.full_name || ctx.user.user_metadata?.full_name || "").split(" ")[0] || "equipo";
    $("#pn-area").textContent = myArea ? `${myArea[0]}. ${myArea[1]}` : "";
    const email = (ctx.user.email || "").toLowerCase();
    const corp = email.endsWith("@" + DOMAIN);
    $("#pn-mail").href = corp ? WEBMAIL + "?_user=" + encodeURIComponent(email) : WEBMAIL;
    $("#pn-mail-addr").textContent = corp ? `Abre ${email} en el correo de Hostinger. Usa la misma contraseña de Interno.` : "Tu cuenta no tiene correo @kinamenergy.com. Dirección puede crearlo en Usuarios internos.";
    fillSelects();
    load();
  }
  document.addEventListener("kinam:interno", (ev) => start(ev.detail));
  if (window.KinamInterno) start(window.KinamInterno);
  document.addEventListener("kinam:view", (ev) => { if (ev.detail === "panel" && ctx) load(); });

  document.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]");
    if (act && ctx) return openAct(acts.find((a) => a.id === act.dataset.act));
    const nd = e.target.closest("[data-day-new]");
    if (nd && ctx) return openAct(null, nd.dataset.dayNew);
    if (e.target.closest("[data-new-act]") && ctx) return openAct(null);
    const nav = e.target.closest("[data-cal]");
    if (nav) {
      const n = Number(nav.dataset.cal);
      month = n === 0 ? startOfMonth(new Date()) : new Date(month.getFullYear(), month.getMonth() + n, 1);
      renderCal();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.matches("li[data-act]")) openAct(acts.find((a) => a.id === e.target.dataset.act));
    if (e.key === "Escape" && !$("#act-modal").hidden) closeAct();
  });
  $("#cal-who").addEventListener("change", renderCal);
  $("#ac-dia").addEventListener("change", toggleHours);
  $("#act-close").addEventListener("click", closeAct);
  $("#act-modal").addEventListener("click", (e) => { if (e.target.id === "act-modal") closeAct(); });
  $("#act-form").addEventListener("submit", saveAct);
  $("#ac-ics").addEventListener("click", () => current && download("actividad-kinam.ics", ics([current])));
  $("#pn-ics").addEventListener("click", () => {
    const list = acts.filter((a) => a.asignado_a === ctx.user.id && a.estado !== "cancelada");
    if (!list.length) return alert("Aún no tienes actividades para exportar.");
    download("mi-calendario-kinam.ics", ics(list));
  });
})();
