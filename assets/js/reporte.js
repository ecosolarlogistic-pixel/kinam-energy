// KINAM Energy | reporte premium en PDF de los formatos del expediente y envío por WhatsApp o correo
// Genera el PDF en el navegador (pdfmake). Para compartir, lo sube al almacenamiento privado del
// proyecto en Supabase y manda una liga segura que vence en 30 días.
(function () {
  const F = window.KinamFormatos;
  const LIBS = [
    "https://cdn.jsdelivr.net/npm/pdfmake@0.2.10/build/pdfmake.min.js",
    "https://cdn.jsdelivr.net/npm/pdfmake@0.2.10/build/vfs_fonts.js"
  ];
  const C = { navy: "#07172A", navy2: "#0E2440", cyan: "#00B8D4", cyanSoft: "#E6FAFD", ink: "#1B2430", muted: "#5B6675", line: "#D5DCE4", zebra: "#F5F8FA", green: "#1E8E3E" };
  const BUCKET = "expedientes";
  const LINK_DAYS = 30;
  let ready = null, logo = null;

  function loadScript(src) {
    return new Promise((ok, fail) => {
      const s = document.createElement("script");
      s.src = src; s.onload = ok; s.onerror = () => fail(new Error("No se pudo cargar el generador de PDF. Revisa tu conexión."));
      document.head.appendChild(s);
    });
  }
  async function libs() {
    if (!ready) ready = (async () => { for (const src of LIBS) if (!(src.includes("vfs") ? window.pdfMake?.vfs : window.pdfMake)) await loadScript(src); })();
    await ready;
    if (!logo) logo = await toPng("/assets/img/logo-kinam.webp").catch(() => null);
  }
  // pdfmake solo acepta PNG/JPG: convierte el logo del sitio.
  function toPng(url) {
    return new Promise((ok, fail) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext("2d").drawImage(img, 0, 0);
        ok(c.toDataURL("image/png"));
      };
      img.onerror = fail;
      img.src = url;
    });
  }

  const fmtDate = (d, time) => new Date(d).toLocaleString("es-MX", time ? { dateStyle: "long", timeStyle: "short" } : { dateStyle: "long" });
  const slug = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "proyecto";
  const folio = (meta) => (meta.id ? "KIN-" + meta.id.slice(0, 8).toUpperCase() : "BORRADOR");

  // Piezas comunes del diseño
  function frame(meta, title) {
    return {
      pageSize: "LETTER",
      pageMargins: [54, 78, 54, 64],
      info: { title: `${title} · ${meta.proyecto || ""}`, author: "KINAM Energy", subject: title, creator: "kinamenergy.com" },
      defaultStyle: { font: "Roboto", fontSize: 9.5, color: C.ink, lineHeight: 1.25 },
      styles: {
        h1: { fontSize: 24, bold: true, color: "#FFFFFF", lineHeight: 1.1 },
        kicker: { fontSize: 8, bold: true, color: C.cyan, characterSpacing: 1.5 },
        h2: { fontSize: 13, bold: true, color: C.navy, margin: [0, 0, 0, 6] },
        label: { fontSize: 8.5, color: C.muted },
        value: { fontSize: 9.5, bold: true, color: C.ink },
        empty: { fontSize: 9.5, color: "#A9B3BE" },
        small: { fontSize: 8, color: C.muted },
        clause: { alignment: "justify", margin: [0, 0, 0, 7] }
      },
      header: (page) => page === 1 ? null : {
        margin: [54, 28, 54, 0],
        stack: [
          { columns: [
            { text: [{ text: "KINAM ENERGY  ", bold: true, color: C.navy }, { text: title.toUpperCase(), color: C.muted }], fontSize: 7.5, characterSpacing: 1 },
            { text: folio(meta), alignment: "right", fontSize: 7.5, color: C.muted, characterSpacing: 1 }
          ] },
          { canvas: [{ type: "line", x1: 0, y1: 6, x2: 504, y2: 6, lineWidth: 0.6, lineColor: C.cyan }] }
        ]
      },
      footer: (page, pages) => ({
        margin: [54, 18, 54, 0],
        columns: [
          { text: "KINAM Energy · Energía sin límites · Documento confidencial", fontSize: 7.5, color: C.muted },
          { text: `Página ${page} de ${pages}`, alignment: "right", fontSize: 7.5, color: C.muted }
        ]
      })
    };
  }

  function band(height) {
    return (page) => page === 1 ? { canvas: [
      { type: "rect", x: 0, y: 0, w: 612, h: height, color: C.navy },
      { type: "rect", x: 0, y: height, w: 612, h: 4, color: C.cyan }
    ] } : null;
  }

  const kv = (rows) => ({
    table: { widths: [170, "*"], body: rows.map(([l, v]) => [{ text: l, style: "label" }, v ? { text: v, style: "value" } : { text: "Sin dato", style: "empty" }]) },
    layout: { hLineWidth: (i, n) => (i === 0 || i === n.table.body.length ? 0 : 0.5), vLineWidth: () => 0, hLineColor: () => C.line, paddingTop: () => 5, paddingBottom: () => 5, paddingLeft: () => 0, paddingRight: () => 6 }
  });

  function kpis(items) {
    return {
      table: { widths: items.map(() => "*"), body: [items.map(([v, l]) => ({ stack: [{ text: v, fontSize: 17, bold: true, color: C.navy }, { text: l, style: "small", margin: [0, 2, 0, 0] }], fillColor: C.cyanSoft, margin: [10, 10, 10, 10] }))] },
      layout: { hLineWidth: () => 0, vLineWidth: (i, n) => (i === 0 || i === n.table.widths.length ? 0 : 6), vLineColor: () => "#FFFFFF", paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 }
    };
  }

  function cover(meta, title, subtitle) {
    return [
      logo ? { image: logo, width: 120, absolutePosition: { x: 54, y: 34 } } : { text: "KINAM ENERGY", color: "#FFFFFF", bold: true, absolutePosition: { x: 54, y: 40 } },
      { text: folio(meta), color: "#9FB3C8", fontSize: 8, characterSpacing: 1, absolutePosition: { x: 54, y: 40 }, alignment: "right" },
      { text: "EXPEDIENTE DEL PROYECTO", style: "kicker", margin: [0, 40, 0, 6] },
      { text: title, style: "h1" },
      { text: subtitle, color: "#C9D6E3", fontSize: 10.5, margin: [0, 6, 0, 18] },
      { columns: [
        { stack: [{ text: "CLIENTE", style: "kicker" }, { text: meta.cliente || "—", color: "#FFFFFF", bold: true, margin: [0, 3, 0, 0] }] },
        { stack: [{ text: "PROYECTO", style: "kicker" }, { text: meta.proyecto || "—", color: "#FFFFFF", bold: true, margin: [0, 3, 0, 0] }] },
        { stack: [{ text: "ESTADO", style: "kicker" }, { text: meta.estado || "Borrador", color: "#FFFFFF", bold: true, margin: [0, 3, 0, 0] }] },
        { stack: [{ text: "EMITIDO", style: "kicker" }, { text: fmtDate(new Date()), color: "#FFFFFF", bold: true, margin: [0, 3, 0, 0] }] }
      ], columnGap: 12 }
    ];
  }

  // Requisitos de instalación
  function requisitos(data, meta) {
    const d = data || {};
    const sections = F.REQUISITOS;
    const filled = sections.filter((s) => s.fields.some((x) => F.show(x, d))).length;
    const hz = String(d.frecuencia || "").startsWith("50") ? 50 : 60;
    const unit = hz === 50 ? 1.56 : 1.88;
    const need = Number(d.p_cubrir || d.p_max || 0);
    const units = need ? Math.ceil(need / unit) : null;
    const site = Array.isArray(d.site_ready) ? d.site_ready.length : 0;
    const get = (k) => { const x = F.fields(sections).find((f) => f.k === k); return x ? F.show(x, d) : ""; };
    const doc = frame(meta, "Requisitos de instalación");
    doc.background = band(250);
    doc.content = [
      ...cover(meta, "Requisitos preliminares de instalación", "Ficha de información técnica y Site Readiness · Suministro energético con contenedores de 40 pies"),
      { text: "RESUMEN EJECUTIVO", style: "kicker", margin: [0, 56, 0, 8] },
      kpis([
        [need ? need.toLocaleString("es-MX") + " MW" : "—", "Potencia a cubrir"],
        [units ? String(units) : "—", `Contenedores estimados (${unit.toLocaleString("es-MX")} MW a ${hz} Hz)`],
        [d.c_anual ? Number(d.c_anual).toLocaleString("es-MX") : "—", "Consumo anual (kWh)"],
        [`${F.progress(sections, d)}%`, `Ficha completa · ${filled} de ${sections.length} secciones`]
      ]),
      { margin: [0, 16, 0, 0], ...kv([
        ["Tipo de instalación", get("tipo_instalacion")],
        ["Situación de la instalación", get("situacion")],
        ["Punto de entrega propuesto", get("punto_entrega")],
        ["Tensión en el punto de entrega", get("pe_tension")],
        ["Horas de operación", get("horas_operacion")],
        ["Acceso para camión de 40 pies", get("log_camion")],
        ["Checklist Site Ready", `${site} de 15 puntos confirmados`]
      ]) },
      { text: units ? `La estimación de contenedores es preliminar: ${need.toLocaleString("es-MX")} MW ÷ ${unit.toLocaleString("es-MX")} MW nominales por unidad a ${hz} Hz. La potencia neta garantizada y la configuración final se definen en las especificaciones técnicas del proyecto.` : "Cuando el cliente indique la potencia a cubrir, este resumen estima el número de contenedores.", style: "small", margin: [0, 10, 0, 0] },
      ...sections.map((s, i) => ({
        stack: [
          { columns: [
            { text: String(i + 1).padStart(2, "0"), width: 28, fontSize: 13, bold: true, color: C.cyan },
            { text: s.t, style: "h2" }
          ] },
          s.note ? { text: s.note, style: "small", margin: [0, -2, 0, 6] } : "",
          kv(s.fields.map((x) => [x.l + (x.u ? ` (${x.u})` : ""), F.show(x, d)]))
        ],
        margin: [0, i === 0 ? 0 : 18, 0, 0],
        pageBreak: i === 0 ? "before" : undefined,
        unbreakable: s.fields.length <= 9
      })),
      { text: "Validación", style: "h2", margin: [0, 24, 0, 6] },
      { text: "Este documento recopila información preliminar del emplazamiento. Los valores técnicos definitivos (cargas estructurales, distancias mínimas, cimentación, puesta a tierra, protecciones, ventilación y espacios de mantenimiento) deberán ser validados por KINAM Energy y el fabricante antes del envío de los contenedores.", alignment: "justify" },
      meta.enviado ? { text: `Enviado por el cliente el ${fmtDate(meta.enviado, true)}.`, style: "small", margin: [0, 8, 0, 0] } : ""
    ];
    return doc;
  }

  // Carta compromiso
  function carta(data, meta) {
    const T = F.CARTA_TEXTO;
    const vals = F.cartaValues(data || {});
    const seg = (parts) => parts.map((x) => {
      if (typeof x === "string") return x;
      const v = vals[x.k];
      return v === undefined || v === "" ? { text: `[${x.ph}]`, background: "#FFF4C2" } : { text: typeof v === "number" ? v.toLocaleString("es-MX") : String(v), bold: true };
    });
    const firma = meta.firma || {};
    const doc = frame(meta, "Carta compromiso");
    doc.background = band(112);
    doc.pageMargins = [64, 78, 64, 64];
    doc.content = [
      logo ? { image: logo, width: 110, absolutePosition: { x: 64, y: 26 } } : "",
      { text: [{ text: folio(meta) + "\n", fontSize: 8, color: "#9FB3C8" }, { text: T.proveedor.domicilio, fontSize: 7.5, color: "#9FB3C8" }], alignment: "right", absolutePosition: { x: 64, y: 40 } },
      { text: T.titulo.toUpperCase(), fontSize: 14, bold: true, color: C.navy, alignment: "center", margin: [0, 48, 0, 2] },
      { text: T.subtitulo, alignment: "center", color: C.muted, margin: [0, 0, 0, 18] },
      { text: seg(T.lugar), alignment: "right", margin: [0, 0, 0, 14] },
      { text: T.saludo, margin: [0, 0, 0, 8] },
      { text: seg(T.intro), style: "clause" },
      { text: seg(T.compromiso), style: "clause" },
      { ol: T.clausulas.map(([t, parts]) => ({ text: [{ text: t + " ", bold: true }, ...seg(parts)], style: "clause" })), margin: [6, 2, 0, 4] },
      { text: T.cierre, style: "clause", margin: [0, 6, 0, 22] },
      { unbreakable: true, columns: [
        { stack: [
          { text: "POR EL CONSUMIDOR", style: "kicker", color: C.navy },
          { text: seg([{ k: "consumidor", ph: "NOMBRE O RAZÓN SOCIAL" }]), margin: [0, 4, 0, 0] },
          { text: ["RFC: ", ...seg([{ k: "rfc", ph: "RFC" }])] },
          firma.por ? { table: { widths: ["*"], body: [[{ stack: [
            { text: "ACEPTADA ELECTRÓNICAMENTE", fontSize: 7, bold: true, color: C.green, characterSpacing: 1 },
            { text: firma.por, bold: true, margin: [0, 2, 0, 0] },
            { text: fmtDate(firma.at, true), style: "small" },
            { text: "Folio " + folio(meta), style: "small" }
          ], margin: [8, 6, 8, 6] }]] }, layout: { hLineColor: () => C.green, vLineColor: () => C.green }, margin: [0, 14, 0, 4] } : { canvas: [{ type: "line", x1: 0, y1: 44, x2: 210, y2: 44, lineWidth: 0.8, lineColor: C.ink }], margin: [0, 0, 0, 4] },
          { text: "Nombre, cargo y firma", style: "small" },
          { text: ["Facultades: ", ...seg([{ k: "facultades", ph: "__________" }])], style: "small", margin: [0, 4, 0, 0] }
        ] },
        { stack: [
          { text: "POR KINAM ENERGY", style: "kicker", color: C.navy },
          { text: T.proveedor.nombre, margin: [0, 4, 0, 0] },
          { text: "RFC: " + T.proveedor.rfc },
          { canvas: [{ type: "line", x1: 0, y1: 44, x2: 210, y2: 44, lineWidth: 0.8, lineColor: C.ink }], margin: [0, firma.por ? 30 : 0, 0, 4] },
          { text: "Nombre, cargo y firma", style: "small" },
          { text: "Facultades: __________", style: "small", margin: [0, 4, 0, 0] }
        ] }
      ], columnGap: 28 },
      { text: "ANEXO A", style: "kicker", pageBreak: "before", margin: [0, 6, 0, 2] },
      { text: "Centros de carga y consumo estimado", style: "h2", margin: [0, 0, 0, 10] },
      { table: { widths: [190, "*"], body: T.anexo.map(([l, k], i) => [{ text: l, bold: true, fillColor: i % 2 ? "#FFFFFF" : C.zebra, margin: [6, 6, 6, 6] }, { text: seg([{ k, ph: "_____" }]), fillColor: i % 2 ? "#FFFFFF" : C.zebra, margin: [6, 6, 6, 6] }]) },
        layout: { hLineColor: () => C.line, vLineColor: () => C.line, hLineWidth: () => 0.5, vLineWidth: () => 0.5 } },
      { text: "Nota de uso: antes de la firma, complete los campos entre corchetes y verifique la denominación social, poderes de representación, modalidad de suministro y permisos aplicables.", style: "small", margin: [0, 12, 0, 0] }
    ];
    return doc;
  }

  // API pública
  async function build(tipo, data, meta) {
    await libs();
    const def = tipo === "carta" ? carta(data, meta) : requisitos(data, meta);
    const blob = await new Promise((ok) => window.pdfMake.createPdf(def).getBlob(ok));
    const name = `KINAM-${tipo === "carta" ? "Carta-compromiso" : "Requisitos-instalacion"}-${slug(meta.proyecto)}.pdf`;
    return { blob, name };
  }

  // Abre el PDF en otra pestaña. La pestaña se abre antes de generar para que el navegador no la bloquee.
  async function view(tipo, data, meta) {
    const w = window.open("", "_blank");
    if (w) w.document.write('<p style="font:16px system-ui;padding:24px">Generando el PDF…</p>');
    try {
      const { blob, name } = await build(tipo, data, meta);
      const url = URL.createObjectURL(blob);
      if (w) w.location.href = url;
      else { const a = document.createElement("a"); a.href = url; a.download = name; a.click(); }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) { if (w) w.close(); throw err; }
  }

  // Envía el PDF. En celular usa el menú de compartir del sistema (adjunta el archivo);
  // si no, sube el PDF y comparte una liga segura.
  async function send(channel, tipo, data, meta, ctx) {
    const mobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    const canFile = mobile && channel === "whatsapp" && navigator.canShare && navigator.canShare({ files: [new File(["x"], "x.pdf", { type: "application/pdf" })] });
    // En computadora, WhatsApp Web se abre en otra pestaña: se abre ya para que no la bloquee el navegador.
    const w = channel === "whatsapp" && !mobile ? window.open("", "_blank") : null;
    if (w) w.document.write('<p style="font:16px system-ui;padding:24px">Preparando el PDF para WhatsApp…</p>');
    try {
      const { blob, name } = await build(tipo, data, meta);
      const title = `${tipo === "carta" ? "Carta compromiso" : "Requisitos de instalación"} · ${meta.proyecto || ""}`;
      if (canFile) {
        try { await navigator.share({ files: [new File([blob], name, { type: "application/pdf" })], title, text: `${title} · KINAM Energy` }); return { shared: true }; }
        catch (err) { if (err.name === "AbortError") return { cancelled: true }; }
      }
      const path = `${meta.proyecto_id}/${Date.now()}-${name}`;
      const up = await ctx.client.storage.from(BUCKET).upload(path, blob, { contentType: "application/pdf", upsert: false });
      if (up.error) throw up.error;
      const signed = await ctx.client.storage.from(BUCKET).createSignedUrl(path, LINK_DAYS * 86400);
      if (signed.error) throw signed.error;
      const link = signed.data.signedUrl;
      const text = `Hola${ctx.nombre ? " " + ctx.nombre : ""}, te comparto el documento "${title}" de KINAM Energy (${folio(meta)}).\n\nVer PDF: ${link}\n\nLa liga es válida por ${LINK_DAYS} días.`;
      if (channel === "whatsapp") {
        const phone = String(ctx.phone || "").replace(/\D/g, "");
        const wa = phone ? (phone.length === 10 ? "52" + phone : phone) : "";
        const url = `https://wa.me/${wa}?text=${encodeURIComponent(text)}`;
        if (w) w.location.href = url; else location.href = url;
      } else {
        location.href = `mailto:${encodeURIComponent(ctx.email || "")}?subject=${encodeURIComponent(title + " · KINAM Energy")}&body=${encodeURIComponent(text)}`;
      }
      return { link };
    } catch (err) { if (w) w.close(); throw err; }
  }

  window.KinamReporte = { build, view, send };
})();
