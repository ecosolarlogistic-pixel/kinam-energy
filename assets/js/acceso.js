// KINAM Energy | registro, inicio de sesión y recuperación de contraseña
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const { client, ready, AREAS, message } = window.KinamAuth;

  $("#year").textContent = new Date().getFullYear();

  const params = new URLSearchParams(location.search);
  const area = AREAS[params.get("area")] ? params.get("area") : "evaluacion";
  const target = "/area/" + AREAS[area].hash;
  if (params.get("area")) $("#auth-title").textContent = "Entra a " + AREAS[area].label;

  const panels = { login: $("#panel-login"), signup: $("#panel-signup"), forgot: $("#panel-forgot"), reset: $("#panel-reset") };
  const tabs = $(".auth__tabs");

  function show(name) {
    Object.entries(panels).forEach(([k, el]) => { el.hidden = k !== name; });
    tabs.hidden = name === "forgot" || name === "reset";
    $$("[role=tab]").forEach((t) => {
      const on = t.getAttribute("aria-controls") === "panel-" + name;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
    });
    $$(".auth__msg").forEach((m) => { m.hidden = true; });
  }

  function say(form, text, ok) {
    const m = $(".auth__msg", form);
    m.textContent = text;
    m.classList.toggle("is-ok", Boolean(ok));
    m.hidden = false;
  }

  function busy(form, on) {
    const b = $("button[type=submit]", form);
    if (!b.dataset.label) b.dataset.label = b.textContent;
    b.disabled = on;
    b.textContent = on ? "Un momento…" : b.dataset.label;
  }

  $$("[role=tab]").forEach((t) => t.addEventListener("click", () => show(t.id === "tab-signup" ? "signup" : "login")));
  tabs.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = $("[role=tab][aria-selected=false]");
    next.click(); next.focus();
  });
  $$("[data-go]").forEach((b) => b.addEventListener("click", () => show(b.dataset.go)));
  $$(".pass__toggle").forEach((b) => b.addEventListener("click", () => {
    const i = document.getElementById(b.getAttribute("aria-controls"));
    const hidden = i.type === "password";
    i.type = hidden ? "text" : "password";
    b.textContent = hidden ? "Ocultar" : "Ver";
  }));
  if (params.get("modo") === "registro") show("signup");

  if (!ready) {
    $("#auth-offline").hidden = false;
    $$(".auth__card button[type=submit]").forEach((b) => { b.disabled = true; });
    return;
  }

  // Si ya hay sesión, directo al área de trabajo. Si llega desde el enlace de
  // recuperación, pide la nueva contraseña.
  client.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") show("reset");
  });
  client.auth.getSession().then(({ data }) => {
    if (data.session && !/type=recovery/.test(location.hash)) location.replace(target);
  });

  function invalid(form) {
    let bad = null;
    $$("input[required]", form).forEach((i) => {
      const ok = i.type === "checkbox" ? i.checked : i.checkValidity() && i.value.trim() !== "";
      i.setAttribute("aria-invalid", String(!ok));
      if (!ok && !bad) bad = i;
    });
    if (bad) bad.focus();
    return bad;
  }

  panels.login.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    if (invalid(f)) return say(f, "Escribe tu correo y tu contraseña.");
    busy(f, true);
    const { error } = await client.auth.signInWithPassword({ email: f.email.value.trim().toLowerCase(), password: f.password.value });
    busy(f, false);
    if (error) return say(f, message(error));
    location.replace(target);
  });

  panels.signup.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    if (invalid(f)) return say(f, "Completa todos los campos. La contraseña necesita al menos 8 caracteres.");
    busy(f, true);
    const { data, error } = await client.auth.signUp({
      email: f.email.value.trim().toLowerCase(),
      password: f.password.value,
      options: {
        emailRedirectTo: location.origin + target,
        data: { full_name: f.full_name.value.trim(), company: f.company.value.trim(), phone: f.phone.value.trim() }
      }
    });
    busy(f, false);
    if (error) return say(f, message(error));
    if (data.session) return location.replace(target);
    f.reset();
    say(f, "¡Listo! Te enviamos un correo para confirmar tu cuenta. Ábrelo y después inicia sesión.", true);
  });

  panels.forgot.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    if (invalid(f)) return say(f, "Escribe un correo válido.");
    busy(f, true);
    const { error } = await client.auth.resetPasswordForEmail(f.email.value.trim().toLowerCase(), { redirectTo: location.origin + "/acceso.html" });
    busy(f, false);
    if (error) return say(f, message(error));
    say(f, "Si el correo está registrado, recibirás un enlace en unos minutos.", true);
  });

  panels.reset.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    if (invalid(f)) return say(f, "La contraseña necesita al menos 8 caracteres.");
    busy(f, true);
    const { error } = await client.auth.updateUser({ password: f.password.value });
    busy(f, false);
    if (error) return say(f, message(error));
    location.replace(target);
  });
})();
