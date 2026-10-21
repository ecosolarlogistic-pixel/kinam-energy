// KINAM Energy | alta y gestión del equipo interno (solo Dirección)
// Crea cuentas ya confirmadas con su área y, si se pide, su correo @kinamenergy.com en Hostinger.
// La llave de servicio y el token de Hostinger viven solo en los secretos de Supabase.
import { createClient } from "jsr:@supabase/supabase-js@2";

const DOMAIN = "kinamenergy.com";
const AREAS = ["direccion", "administracion", "comercial", "tecnico", "operaciones"];
const ORIGINS = ["https://www.kinamenergy.com", "https://kinamenergy.com", "http://localhost:8080"];
const HOSTINGER = "https://developers.hostinger.com";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

function cors(req: Request) {
  const o = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ORIGINS.includes(o) ? o : ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

class Fail extends Error {
  constructor(msg: string, public status = 400, public extra: Record<string, unknown> = {}) { super(msg); }
}

const strong = (p: string) => p.length >= 8 && p.length <= 50 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9]/.test(p);

// Hostinger Email
async function hostinger(path: string, init: RequestInit = {}) {
  const token = Deno.env.get("HOSTINGER_API_TOKEN");
  if (!token) throw new Fail("Falta configurar el token de Hostinger en Supabase (secreto HOSTINGER_API_TOKEN).", 400, { setup: true });
  const res = await fetch(HOSTINGER + path, {
    ...init,
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", Accept: "application/json", ...(init.headers || {}) },
  });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const m = (body && (body.message || body.error)) || text || res.statusText;
    throw new Fail("Hostinger respondió: " + (typeof m === "string" ? m : JSON.stringify(m)), 502, { hostinger_status: res.status });
  }
  return body;
}
const list = (b: any) => (Array.isArray(b) ? b : b?.data ?? []);

async function mailOrder() {
  const orders = list(await hostinger("/api/mail/v1/orders"));
  const o = orders.find((x: any) => JSON.stringify(x).toLowerCase().includes(DOMAIN));
  if (!o) throw new Fail(`No encontré el plan de correo de ${DOMAIN} en Hostinger.`, 404);
  return o.resource_id || o.resourceId || o.id;
}
async function mailboxes() {
  const order = await mailOrder();
  return { order, items: list(await hostinger(`/api/mail/v1/orders/${order}/mailboxes`)) };
}
async function createMailbox(localPart: string, password: string) {
  const { order, items } = await mailboxes();
  const address = `${localPart}@${DOMAIN}`;
  if (items.some((m: any) => String(m.address || m.email || "").toLowerCase() === address)) return "existed";
  await hostinger(`/api/mail/v1/orders/${order}/mailboxes`, { method: "POST", body: JSON.stringify({ local_part: localPart, password }) });
  return "created";
}
async function mailboxPassword(address: string, password: string) {
  const { items } = await mailboxes();
  const m = items.find((x: any) => String(x.address || x.email || "").toLowerCase() === address);
  if (!m) return false;
  await hostinger(`/api/mail/v1/mailboxes/${m.resource_id || m.resourceId || m.id}/password`, { method: "PUT", body: JSON.stringify({ password }) });
  return true;
}

async function staffList(me: string) {
  const [{ data: staff, error }, { data: users }] = await Promise.all([
    admin.from("staff").select("user_id, role, area, supervisor_id, mailbox, created_at"),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);
  if (error) throw new Fail(error.message, 500);
  const ids = (staff || []).map((s) => s.user_id);
  const { data: profiles } = await admin.from("profiles").select("id, full_name, phone").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const pf = new Map((profiles || []).map((p) => [p.id, p]));
  const au = new Map((users?.users || []).map((u) => [u.id, u]));
  return (staff || []).map((s) => {
    const u: any = au.get(s.user_id) || {};
    const p: any = pf.get(s.user_id) || {};
    const banned = u.banned_until && new Date(u.banned_until) > new Date();
    return { id: s.user_id, email: u.email, full_name: p.full_name || u.user_metadata?.full_name || "", phone: p.phone || "", role: s.role, area: s.area,
      supervisor_id: s.supervisor_id, mailbox: s.mailbox, active: !banned, last_sign_in_at: u.last_sign_in_at || null, created_at: s.created_at, me: s.user_id === me };
  });
}

async function handle(body: any, me: string) {
  const area = body.area;
  if (area !== undefined && !AREAS.includes(area)) throw new Fail("Área no válida.");
  const role = area === "direccion" ? "admin" : "equipo";

  switch (body.action) {
    case "list":
      return { users: await staffList(me) };

    case "create": {
      const email = String(body.email || "").trim().toLowerCase();
      const full_name = String(body.full_name || "").trim();
      const password = String(body.password || "");
      if (!full_name) throw new Fail("Escribe el nombre completo.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Fail("Escribe un correo válido.");
      if (!area) throw new Fail("Elige el área.");
      if (password.length < 8) throw new Fail("La contraseña debe tener al menos 8 caracteres.");
      const wantsMail = Boolean(body.mailbox) && email.endsWith("@" + DOMAIN);
      let mail: string | null = null;
      if (wantsMail) {
        if (!strong(password)) throw new Fail("Para crear también el correo, la contraseña debe tener de 8 a 50 caracteres con mayúscula, minúscula, número y símbolo.");
        const local = email.split("@")[0];
        if (!/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/.test(local)) throw new Fail("La parte antes de @ solo puede tener letras, números, punto, guion y guion bajo.");
        mail = await createMailbox(local, password);
      }
      const { data, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { full_name, phone: body.phone || null, company: "KINAM Energy" },
      });
      if (error) {
        if (/already|registered|exists/i.test(error.message)) throw new Fail("Ya existe una cuenta con ese correo. Usa Dar acceso a cuenta existente.", 409, { mail });
        throw new Fail(error.message, 400, { mail });
      }
      const id = data.user.id;
      await admin.from("profiles").upsert({ id, full_name, phone: body.phone || null, company: "KINAM Energy", email });
      const { error: e2 } = await admin.from("staff").upsert({ user_id: id, role, area, supervisor_id: body.supervisor_id || null, mailbox: Boolean(mail) });
      if (e2) throw new Fail("Se creó la cuenta pero no su acceso interno: " + e2.message, 500, { id, mail });
      return { ok: true, id, mail };
    }

    case "grant": {
      const email = String(body.email || "").trim().toLowerCase();
      if (!area) throw new Fail("Elige el área.");
      const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const u = users?.users.find((x) => x.email?.toLowerCase() === email);
      if (!u) throw new Fail("No existe una cuenta con ese correo. Créala con Nuevo usuario.", 404);
      const { error } = await admin.from("staff").upsert({ user_id: u.id, role, area, supervisor_id: body.supervisor_id || null });
      if (error) throw new Fail(error.message, 500);
      return { ok: true, id: u.id };
    }

    case "update": {
      const id = String(body.user_id || "");
      if (id === me && area && area !== "direccion") throw new Fail("No puedes quitarte a ti mismo el rol de Dirección.");
      if (body.supervisor_id && body.supervisor_id === id) throw new Fail("Una persona no puede ser su propio supervisor.");
      const patch: Record<string, unknown> = { supervisor_id: body.supervisor_id || null };
      if (area) Object.assign(patch, { area, role });
      const { error } = await admin.from("staff").update(patch).eq("user_id", id);
      if (error) throw new Fail(error.message, 500);
      if (body.full_name !== undefined || body.phone !== undefined) {
        await admin.from("profiles").update({ full_name: body.full_name, phone: body.phone || null }).eq("id", id);
      }
      return { ok: true };
    }

    case "active": {
      const id = String(body.user_id || "");
      if (id === me) throw new Fail("No puedes bloquearte a ti mismo.");
      const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: body.active ? "none" : "876000h" });
      if (error) throw new Fail(error.message, 500);
      return { ok: true };
    }

    case "password": {
      const id = String(body.user_id || "");
      const password = String(body.password || "");
      if (password.length < 8) throw new Fail("La contraseña debe tener al menos 8 caracteres.");
      const { data: s } = await admin.from("staff").select("mailbox").eq("user_id", id).maybeSingle();
      const { data: u } = await admin.auth.admin.getUserById(id);
      if (s?.mailbox && !strong(password)) throw new Fail("Esta persona tiene correo: la contraseña debe tener de 8 a 50 caracteres con mayúscula, minúscula, número y símbolo.");
      const { error } = await admin.auth.admin.updateUserById(id, { password });
      if (error) throw new Fail(error.message, 500);
      let mail = false;
      if (s?.mailbox && u?.user?.email) {
        try { mail = await mailboxPassword(u.user.email.toLowerCase(), password); }
        catch (e) { throw new Fail("Se cambió la contraseña del panel, pero no la del correo. " + (e as Error).message, 502); }
      }
      return { ok: true, mail };
    }

    case "remove": {
      const id = String(body.user_id || "");
      if (id === me) throw new Fail("No puedes quitarte a ti mismo.");
      const { error } = await admin.from("staff").delete().eq("user_id", id);
      if (error) throw new Fail(error.message, 500);
      return { ok: true };
    }

    case "mail_list": {
      const { items } = await mailboxes();
      return { mailboxes: items.map((m: any) => ({ address: m.address || m.email, status: m.status })) };
    }

    default:
      throw new Fail("Acción no válida.");
  }
}

Deno.serve(async (req) => {
  const h = { ...cors(req), "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  try {
    if (req.method !== "POST") throw new Fail("Método no permitido.", 405);
    const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: who } = await admin.auth.getUser(jwt);
    if (!who?.user) throw new Fail("Inicia sesión de nuevo.", 401);
    const { data: me } = await admin.from("staff").select("role").eq("user_id", who.user.id).maybeSingle();
    if (me?.role !== "admin") throw new Fail("Solo Dirección puede gestionar usuarios.", 403);
    const out = await handle(await req.json().catch(() => ({})), who.user.id);
    return new Response(JSON.stringify(out), { headers: h });
  } catch (e) {
    const f = e instanceof Fail ? e : new Fail((e as Error).message || "Error inesperado.", 500);
    return new Response(JSON.stringify({ error: f.message, ...f.extra }), { status: f.status, headers: h });
  }
});
