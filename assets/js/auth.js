// KINAM Energy | sesión compartida entre acceso.html y el área de trabajo
(function () {
  const cfg = window.KINAM_AUTH || {};
  const ready = Boolean(cfg.url && cfg.key && window.supabase);
  const client = ready
    ? window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
    : null;

  // Áreas protegidas: clientes en /area/ y el equipo KINAM en /interno/.
  const AREAS = {
    evaluacion: { label: "Evaluación técnica", path: "/area/#evaluacion" },
    interno: { label: "Interno", path: "/interno/" }
  };

  // Rol de la cuenta en el equipo KINAM ("admin", "equipo") o null si es cliente.
  async function staffRole(userId) {
    if (!client) return null;
    const { data } = await client.from("staff").select("role").eq("user_id", userId).maybeSingle();
    return data ? data.role || "equipo" : null;
  }

  // Traduce los errores más comunes de Supabase a mensajes claros.
  function message(err) {
    const m = (err && (err.message || err.error_description)) || "";
    if (/invalid login credentials/i.test(m)) return "Correo o contraseña incorrectos.";
    if (/email not confirmed/i.test(m)) return "Primero confirma tu correo con el enlace que te enviamos.";
    if (/already registered|already been registered/i.test(m)) return "Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.";
    if (/password should be at least/i.test(m)) return "La contraseña debe tener al menos 8 caracteres.";
    if (/rate limit|too many/i.test(m)) return "Demasiados intentos. Espera un minuto y vuelve a intentar.";
    if (/failed to fetch|network/i.test(m)) return "No hay conexión con el servidor. Revisa tu internet.";
    return m || "Algo salió mal. Intenta de nuevo.";
  }

  window.KinamAuth = { client, ready, AREAS, message, staffRole };
})();
