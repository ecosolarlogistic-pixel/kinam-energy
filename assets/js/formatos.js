// KINAM Energy | formatos del expediente: Requisitos de instalación y Carta compromiso
// El mismo esquema sirve para llenar (área de cliente), revisar (Interno) e imprimir.
(function () {
  const YN = ["Sí", "No"];
  const YND = ["Sí", "No", "Por determinar"];
  const YNE = ["Sí", "No", "Requiere estudio"];
  const f = (k, l, t = "text", extra = {}) => ({ k, l, t, ...extra });
  const n = (k, l, u) => f(k, l, "num", { u });
  const yn = (k, l, o = YN) => f(k, l, "radio", { o });
  const ch = (k, l, o, other = true) => f(k, l, "checks", { o, other });
  const rd = (k, l, o, other = true) => f(k, l, "radio", { o, other });

  const REQUISITOS = [
    { t: "Identificación del cliente y del proyecto", fields: [
      f("empresa", "Empresa / Grupo"), f("tax_id", "RFC / CIF / Tax ID"), f("pais", "País"), f("direccion", "Dirección del proyecto"),
      f("gps", "Coordenadas GPS"), f("actividad", "Actividad industrial"), f("resp_proyecto", "Persona responsable del proyecto"),
      f("resp_tecnico", "Responsable técnico"), f("resp_electrico", "Responsable eléctrico"), f("telefono", "Teléfono", "tel"), f("email", "Correo", "email"),
      ch("tipo_instalacion", "Tipo de instalación", ["Data Center", "Minería", "Cementera", "Cerámica", "Industria pesada", "Industria manufacturera", "Telecomunicaciones", "Hospital / infraestructura crítica", "Instalación aislada"]),
      ch("situacion", "Situación de la instalación", ["Existente y operativa", "Existente en ampliación", "Nueva construcción", "Proyecto en fase de diseño", "Instalación aislada de red", "Conectada a red eléctrica"], false)
    ] },
    { t: "Necesidad energética", note: "Este apartado es esencial para dimensionar correctamente la solución.", fields: [
      n("p_instalada", "Potencia eléctrica total instalada", "MW"), n("p_contratada", "Potencia contratada con la red", "MW"),
      n("p_max", "Potencia máxima demandada registrada", "MW"), n("p_media", "Potencia media consumida", "MW"),
      n("p_base", "Potencia mínima / base permanente", "MW"), n("p_critica", "Potencia crítica que no puede interrumpirse", "MW"),
      n("p_ampliacion", "Potencia adicional prevista en ampliaciones", "MW"), n("p_cubrir", "Potencia que desea cubrir con nuestra solución", "MW"),
      n("c_diario", "Consumo medio diario", "kWh/día"), n("c_mensual", "Consumo mensual", "kWh/mes"), n("c_anual", "Consumo anual", "kWh/año"),
      rd("horas_operacion", "Horas de operación", ["24/7/365", "24/7 con paradas programadas", "2 turnos", "1 turno", "Estacional"]),
      ch("perfil_carga", "Perfil de carga disponible", ["Curva de carga horaria últimos 12 meses", "Curva de carga 15 minutos", "Facturas eléctricas últimos 12 meses", "Máximos de demanda", "Consumo punta/valle", "Previsión de crecimiento 5 años"], false),
      yn("variaciones", "¿Existen variaciones bruscas de carga?"), n("var_magnitud", "Magnitud aproximada de la variación", "MW"), f("var_tiempo", "Tiempo de variación (segundos/minutos)")
    ] },
    { t: "Suministro eléctrico actual", fields: [
      rd("frecuencia", "Frecuencia de la instalación", ["50 Hz", "60 Hz"], false), n("tension_cia", "Tensión de suministro de la compañía eléctrica", "kV"),
      n("potencia_contratada", "Potencia contratada", "MW/MVA"), n("acometidas", "Número de acometidas eléctricas"),
      yn("doble_acometida", "¿Existe doble acometida?"), yn("redundancia", "¿Existe redundancia N+1 / N+N?"), f("distribuidora", "Empresa distribuidora eléctrica"),
      yn("gen_propia", "¿Existe generación propia actualmente?"), ch("gen_tipo", "Tipo de generación propia", ["Diésel", "Gas", "Solar", "Eólica", "Baterías/BESS", "Cogeneración"]),
      n("gen_potencia", "Potencia instalada de generación propia", "MW")
    ] },
    { t: "Punto de entrega de nuestra energía", note: "Una de las partes más importantes de la ficha.", fields: [
      ch("punto_entrega", "¿Dónde propone recibir nuestra energía?", ["Subestación principal", "Subestación secundaria", "Transformador existente", "Centro de transformación", "Cuadro General de Baja Tensión (CGBT)", "Cuadro de Media Tensión", "Barra eléctrica / Busbar", "Línea dedicada"]),
      f("pe_tension", "Tensión requerida en el punto de entrega (V / kV)"), n("pe_potencia", "Potencia máxima admisible en ese punto", "MW/MVA"),
      n("pe_corriente", "Corriente nominal", "A"), n("pe_corriente_max", "Corriente máxima", "A"), n("pe_cc", "Capacidad de cortocircuito", "kA"),
      f("pe_esquema", "Esquema de conexión"), n("pe_distancia", "Distancia de los contenedores al punto de entrega", "m"),
      ch("pe_docs", "Documentación disponible", ["Diagrama unifilar existente", "Planos eléctricos", "Plano de subestación", "Plano de transformadores", "Esquema CGBT", "Esquema MT", "Estudios de cortocircuito/protecciones"], false)
    ] },
    { t: "Transformadores", fields: [
      yn("trafo_existe", "¿Existen transformadores disponibles para integrar la nueva generación?"), n("trafo_cantidad", "Cantidad"), f("trafo_fabricante", "Fabricante"),
      n("trafo_potencia", "Potencia", "kVA/MVA"), f("trafo_primaria", "Tensión primaria"), f("trafo_secundaria", "Tensión secundaria"), f("trafo_vectorial", "Grupo vectorial"),
      n("trafo_impedancia", "Impedancia", "%"), n("trafo_anio", "Año de fabricación"), n("trafo_carga_media", "Carga media actual", "%"), n("trafo_carga_max", "Carga máxima", "%"),
      n("trafo_libre", "Capacidad libre estimada", "MVA"), yn("trafo_nuevos", "¿Es necesario instalar nuevos transformadores?", YND)
    ] },
    { t: "Subestación / centro de transformación", fields: [
      yn("sub_existe", "¿Existe subestación propia del cliente?"), n("sub_entrada", "Tensión de entrada", "kV"), f("sub_salida", "Tensión de salida (kV/V)"),
      n("sub_potencia", "Potencia instalada", "MVA"), n("sub_disponible", "Capacidad disponible", "MVA"), n("sub_trafos", "Número de transformadores"),
      yn("sub_espacio", "Espacio disponible para nuevas celdas"), yn("sub_reserva", "¿Dispone de celdas de reserva?"),
      yn("sub_acometida", "¿Es posible incorporar nueva acometida desde los generadores?", YNE)
    ] },
    { t: "Protecciones eléctricas", fields: [
      ch("protecciones", "Protecciones disponibles", ["Sobretensión", "Subtensión", "Sobrefrecuencia", "Subfrecuencia", "Sobrecorriente", "Cortocircuito", "Diferencial", "Falla a tierra", "Protección direccional", "Protección de transformador", "Relés digitales", "Protección de barras", "Sincronismo", "Anti-isla"]),
      f("reles", "Fabricante / modelo de relés principales"), yn("selectividad", "¿Coordinación/selectividad de protecciones actualizada?"),
      yn("estudio_cc", "¿Existe estudio de cortocircuito?"), yn("estudio_coord", "¿Existe estudio de coordinación de protecciones?")
    ] },
    { t: "Calidad de la energía", fields: [
      f("ce_tension", "Tensión nominal"), n("ce_frecuencia", "Frecuencia", "Hz"), n("ce_fp", "Factor de potencia actual"), n("ce_thd_v", "THD tensión", "%"), n("ce_thd_i", "THD corriente", "%"),
      yn("ce_no_lineales", "¿Existen cargas altamente no lineales?"), yn("ce_motores", "¿Existen grandes motores?"), n("ce_motor_max", "Potencia del mayor motor", "MW"),
      yn("ce_vfd", "¿Existen variadores de frecuencia (VFD)?"), yn("ce_ups", "¿Existen UPS?"), n("ce_ups_p", "Potencia total UPS", "MW"),
      yn("ce_bess", "¿Existen BESS/baterías?"), f("ce_bess_p", "Potencia / capacidad (MW / MWh)")
    ] },
    { t: "Ubicación de los contenedores", fields: [
      n("cont_numero", "Número preliminar de contenedores"), n("cont_superficie", "Superficie disponible", "m²"),
      rd("cont_emplazamiento", "Tipo de emplazamiento", ["Exterior", "Interior/nave", "Cubierta", "Plataforma industrial", "Terreno natural", "Mina", "Zona portuaria"]),
      rd("cont_terreno", "Condiciones del terreno", ["Hormigón existente", "Asfalto", "Grava compactada", "Terreno natural", "Forjado estructural"]),
      n("cont_portante", "Capacidad portante del terreno/forjado", "kN/m²"), yn("cont_geotecnico", "¿Existe estudio geotécnico?"), yn("cont_memoria", "¿Existe memoria estructural del forjado?"),
      n("cont_pendiente", "Pendiente del terreno", "%"), yn("cont_inundacion", "Riesgo de inundación"), yn("cont_drenaje", "Drenaje disponible")
    ] },
    { t: "Cimentación / forjados", fields: [
      ch("cim_tipo", "El cliente dispone de", ["Losa de hormigón", "Zapatas", "Bancada estructural", "Forjado industrial", "Plataforma metálica", "Sin infraestructura existente"], false),
      n("cim_carga", "Carga máxima admisible (sobre forjado)", "kg/m²"), yn("cim_informe", "Informe estructural disponible"), f("cim_ingeniero", "Ingeniero estructural responsable")
    ] },
    { t: "Acceso y logística", fields: [
      yn("log_camion", "¿Puede acceder un camión con contenedor de 40 pies?", YNE), n("log_ancho", "Anchura mínima de acceso", "m"), n("log_altura", "Altura libre", "m"),
      n("log_giro", "Radio mínimo de giro", "m"), n("log_peso", "Restricciones de peso", "toneladas"), f("log_restricciones", "Puentes / túneles / restricciones"),
      n("log_distancia", "Distancia del punto de descarga a la ubicación final", "m"), rd("log_descarga", "Descarga", ["Grúa móvil", "Reach stacker", "Carretilla pesada"]),
      yn("log_grua", "¿Espacio suficiente para posicionar una grúa?"), yn("log_horarios", "¿Restricciones horarias/logísticas?"), yn("log_permisos", "¿Permisos especiales de transporte?", YND)
    ] },
    { t: "Puesta a tierra", fields: [
      yn("tierra_existe", "Sistema de puesta a tierra existente"), f("tierra_tipo", "Tipo"), n("tierra_resistencia", "Resistencia medida", "Ω"), f("tierra_fecha", "Fecha de última medición", "date"),
      yn("tierra_malla", "¿Existe malla de tierra industrial?"), yn("tierra_ampliar", "¿Puede ampliarse para integrar los contenedores?"),
      ch("tierra_docs", "Documentación disponible", ["Plano de tierras", "Medición reciente", "Memoria de cálculo"], false)
    ] },
    { t: "Protección contra rayos", fields: [
      yn("rayos_existe", "¿Existe sistema de protección contra rayos?"), f("rayos_nivel", "Nivel de protección"), yn("rayos_cubierta", "¿La zona prevista está cubierta?"),
      yn("rayos_ampliar", "¿Será necesario ampliar el sistema?", YND)
    ] },
    { t: "Canalizaciones y cableado", fields: [
      n("can_distancia", "Distancia contenedor → punto de entrega", "m"), yn("can_existe", "Canalización existente"),
      ch("can_tipo", "Tipo", ["Bandeja", "Canal subterráneo", "Galería", "Tubo", "Aérea"]), yn("can_espacio", "Espacio disponible"), yn("can_nueva", "¿Debe construirse nueva canalización?")
    ] },
    { t: "Comunicaciones y monitorización", note: "El proveedor contempla monitorización y control remoto.", fields: [
      ch("com_conectividad", "Conectividad disponible", ["Fibra óptica", "Ethernet", "Internet dedicado", "4G", "5G", "Satélite", "Ninguna"], false),
      yn("com_redundancia", "Redundancia disponible"), yn("com_ip", "Dirección IP fija posible"), yn("com_firewall", "Firewall corporativo"), yn("com_vpn", "VPN permitida"),
      yn("com_scada", "Centro de control / SCADA existente"), f("com_protocolo", "Protocolo SCADA"), yn("com_bms", "¿Se requiere integración con BMS/EMS/DCIM?"), f("com_sistema", "Sistema utilizado")
    ] },
    { t: "Condiciones ambientales", fields: [
      n("amb_altitud", "Altitud", "m s.n.m."), n("amb_tmin", "Temperatura mínima", "°C"), n("amb_tmax", "Temperatura máxima", "°C"), n("amb_humedad", "Humedad", "%"),
      ch("amb_ambiente", "Ambiente", ["Normal", "Salino", "Costero", "Desértico", "Polvoriento", "Minero", "Corrosivo", "Alta humedad", "Atmósfera industrial"]),
      n("amb_viento", "Viento máximo", "km/h"), yn("amb_nieve", "Nieve"), f("amb_sismica", "Zona sísmica"), f("amb_inundacion", "Riesgo de inundación")
    ] },
    { t: "Seguridad y protección contra incendios", fields: [
      yn("pci_existe", "Sistema PCI existente"), yn("pci_deteccion", "Detección automática"), yn("pci_extincion", "Extinción"), yn("pci_hidrantes", "Hidrantes"),
      n("pci_distancia", "Distancia al sistema PCI", "m"), yn("pci_bomberos", "Acceso de bomberos"), yn("pci_plan", "Plan de emergencia existente"),
      yn("pci_atex", "Zona ATEX / atmósfera explosiva"), f("pci_clasificacion", "Clasificación ATEX")
    ] },
    { t: "Permisos y normativa local", fields: [
      ch("permisos", "El cliente dispone o deberá tramitar", ["Licencia de obra", "Autorización industrial", "Autorización eléctrica", "Medioambiental", "Protección contra incendios", "Urbanística", "Transporte especial", "Aduanas/importación"]),
      f("permisos_autoridad", "Autoridad competente"), yn("permisos_ingenieria", "Ingeniería local designada"), yn("permisos_instaladora", "Empresa instaladora autorizada")
    ] },
    { t: "Condiciones específicas del cliente", fields: [
      yn("cc_normas", "¿Existen normas internas de ingeniería?"), yn("cc_fabricantes", "¿Lista de fabricantes homologados?"), yn("cc_proveedores", "¿Procedimiento propio de aprobación de proveedores?"),
      yn("cc_homologacion", "¿Requiere homologación previa del equipo?"), yn("cc_fat", "¿Requiere FAT presencial?"), yn("cc_sat", "¿Requiere SAT específico?"),
      yn("cc_auditoria", "¿Requiere auditoría técnica?"), yn("cc_tercero", "¿Requiere certificación de tercero independiente?"), f("cc_entidad", "Entidad preferida")
    ] },
    { t: "Requisitos específicos según sector", fields: [
      ch("sector_dc", "Data center", ["Tier requerido", "N+1 / 2N", "UPS", "BESS", "Generadores de emergencia existentes", "ATS/STS", "PUE", "DCIM/BMS", "Calidad de energía requerida", "Tiempo máximo de interrupción", "Requisitos Uptime Institute"], false),
      ch("sector_mineria", "Minería", ["Operación remota", "Altitud", "Polvo", "Vibraciones", "Temperatura extrema", "Grandes motores", "Trituradoras/molinos", "Variaciones bruscas de carga", "Movilidad futura de la instalación"], false),
      ch("sector_industria", "Cerámica / cemento / industria", ["Hornos", "Molinos", "Motores de gran potencia", "Variadores", "Compresores", "Ciclos productivos", "Paradas programadas", "Recuperación después de corte"], false),
      f("sector_detalle", "Detalle de los requisitos marcados", "area")
    ] },
    { t: "Información económica del suministro actual", note: "Nos permite preparar la propuesta comercial y comparar el ahorro.", fields: [
      f("eco_precio", "Precio actual medio de la energía (USD/EUR/MXN por kWh)"), f("eco_peajes", "Peajes / cargos"), f("eco_coste_kwh", "Coste total efectivo por kWh"),
      n("eco_consumo", "Consumo anual", "kWh"), f("eco_coste_anual", "Coste energético anual"), f("eco_generacion", "Costes de generación propia"),
      f("eco_combustible", "Coste diésel/gas cuando proceda"), f("eco_interrupciones", "Costes por interrupciones conocidos"), n("eco_crecimiento", "Previsión de incremento de consumo próximos 5 años", "%")
    ] },
    { t: "Documentación que el cliente adjuntará", note: "No se pide todo para firmar; indica qué documentación tienes disponible en cada nivel.", fields: [
      ch("docs_n1", "Nivel 1 · Evaluación preliminar", ["Últimas 12 facturas eléctricas", "Curva de carga disponible", "Diagrama unifilar", "Plano general del emplazamiento", "Fotografías de ubicación prevista", "Localización/coordenadas", "Potencia instalada y contratada"], false),
      ch("docs_n2", "Nivel 2 · Ingeniería preliminar", ["Planos eléctricos", "Datos transformadores", "Datos subestación", "Protecciones", "Estudio de cortocircuito", "Plano de tierras", "Datos estructurales/geotécnicos", "Plano de accesos"], false),
      ch("docs_n3", "Nivel 3 · Previo a instalación", ["Ingeniería aprobada", "Obra civil finalizada", "Plataforma/cimentación preparada", "Canalizaciones terminadas", "Puesta a tierra", "Protecciones", "Comunicaciones", "Permisos", "Accesos y medios de descarga preparados"], false)
    ] },
    { t: "Checklist final “Site Ready”", note: "Antes de autorizar el envío de los contenedores, cliente y fabricante confirman que el emplazamiento puede recibirlos.", fields: [
      ch("site_ready", "Confirmación", ["Ubicación preparada", "Cimentación/forjado aprobado", "Accesos disponibles", "Descarga prevista", "Acometidas preparadas", "Punto de entrega identificado", "Transformadores disponibles", "Protecciones instaladas", "Puesta a tierra terminada", "Canalizaciones preparadas", "Comunicaciones disponibles", "Seguridad/PCI preparada", "Permisos obtenidos", "Ingeniería aprobada", "Fecha de recepción confirmada"], false),
      f("comentarios", "Comentarios adicionales", "area")
    ] }
  ];

  const CARTA = [
    { t: "Datos de la carta", fields: [
      f("ciudad", "Ciudad"), f("estado", "Estado"), f("fecha", "Fecha", "date"),
      f("consumidor", "Nombre o razón social del consumidor"), f("rfc", "RFC"), f("domicilio", "Domicilio"),
      f("representante", "Nombre del representante"), f("cargo", "Cargo del representante"), f("facultades", "Facultades (poder notarial)"),
      n("volumen_mwh", "Volumen estimado", "MWh anuales"), n("demanda_mw", "Demanda máxima estimada", "MW"),
      rd("vigencia", "Vigencia de la carta", ["90 días naturales", "120 días naturales", "180 días naturales"], false),
      f("jurisdiccion", "Jurisdicción (ciudad y estado)")
    ] },
    { t: "Anexo A · Centros de carga y consumo estimado", fields: [
      f("a_domicilio", "Domicilio del centro de carga"), f("a_rpu", "Número de servicio, RPU o identificador"), f("a_tarifa", "Tensión y tarifa aplicable"),
      n("a_historico", "Consumo histórico anual", "MWh"), n("a_demanda", "Demanda máxima", "MW"), n("a_volumen", "Volumen anual comprometido", "MWh"),
      f("a_inicio", "Fecha estimada de inicio de suministro"), f("a_observaciones", "Observaciones técnicas", "area")
    ] }
  ];

  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fields = (schema) => schema.flatMap((s) => s.fields);

  // Formulario editable o de solo lectura.
  function render(el, schema, data = {}, { readonly = false, prefix = "fm" } = {}) {
    el.innerHTML = schema.map((s, i) => `
      <fieldset class="fm__sec">
        <legend><span class="mono">${String(i + 1).padStart(2, "0")}</span> ${esc(s.t)}</legend>
        ${s.note ? `<p class="note">${esc(s.note)}</p>` : ""}
        <div class="form__grid">${s.fields.map((x) => field(x, data, readonly, prefix)).join("")}</div>
      </fieldset>`).join("");
  }

  function field(x, data, ro, prefix) {
    const id = `${prefix}-${x.k}`;
    const v = data[x.k];
    const dis = ro ? " disabled" : "";
    if (x.t === "radio" || x.t === "checks") {
      const type = x.t === "radio" ? "radio" : "checkbox";
      const sel = x.t === "radio" ? [v] : (Array.isArray(v) ? v : []);
      const wide = x.o.length > 3 ? " full" : "";
      return `<div class="fm__choice${wide}" role="group" aria-labelledby="${id}-l">
        <span class="fm__label" id="${id}-l">${esc(x.l)}</span>
        <div class="fm__opts">${x.o.map((o, j) => `<label class="fm__opt"><input type="${type}" name="${x.k}" value="${esc(o)}"${sel.includes(o) ? " checked" : ""}${dis}> ${esc(o)}</label>`).join("")}
        ${x.other ? `<label class="fm__opt fm__opt--other">Otro: <input type="text" name="${x.k}__otro" value="${esc(data[x.k + "__otro"])}"${dis}></label>` : ""}</div>
      </div>`;
    }
    const full = x.t === "area" || x.l.length > 46 ? " class=\"full\"" : "";
    const label = `<label for="${id}">${esc(x.l)}${x.u ? ` <span class="note">(${esc(x.u)})</span>` : ""}</label>`;
    if (x.t === "area") return `<div${full}>${label}<textarea id="${id}" name="${x.k}" rows="3"${dis}>${esc(v)}</textarea></div>`;
    const type = x.t === "num" ? "number\" step=\"any\" inputmode=\"decimal" : x.t;
    return `<div${full}>${label}<input id="${id}" name="${x.k}" type="${type}" value="${esc(v)}"${dis}></div>`;
  }

  function collect(el, schema) {
    const out = {};
    fields(schema).forEach((x) => {
      if (x.t === "checks") {
        const vals = [...el.querySelectorAll(`input[name="${x.k}"]:checked`)].map((i) => i.value);
        if (vals.length) out[x.k] = vals;
      } else if (x.t === "radio") {
        const c = el.querySelector(`input[name="${x.k}"]:checked`);
        if (c) out[x.k] = c.value;
      } else {
        const i = el.querySelector(`[name="${x.k}"]`);
        const val = i ? i.value.trim() : "";
        if (val !== "") out[x.k] = x.t === "num" ? Number(val) : val;
      }
      if (x.other) {
        const o = el.querySelector(`[name="${x.k}__otro"]`);
        if (o && o.value.trim()) out[x.k + "__otro"] = o.value.trim();
      }
    });
    return out;
  }

  // Avance: cuántos campos tienen respuesta.
  function progress(schema, data = {}) {
    const all = fields(schema);
    const done = all.filter((x) => { const v = data[x.k]; return Array.isArray(v) ? v.length : v !== undefined && v !== ""; }).length;
    return Math.round((done / all.length) * 100);
  }

  // Valor legible de un campo.
  function show(x, data) {
    let v = data[x.k];
    if (Array.isArray(v)) v = v.join(", ");
    if (data[x.k + "__otro"]) v = (v ? v + ", " : "") + "Otro: " + data[x.k + "__otro"];
    if (v === undefined || v === "") return "";
    return typeof v === "number" ? v.toLocaleString("es-MX") + (x.u ? " " + x.u : "") : String(v);
  }

  // Ficha imprimible de los requisitos.
  function requisitosHTML(data, meta = {}) {
    return `<header class="doc__head"><p class="mono">KINAM ENERGY · FICHA DE INFORMACIÓN TÉCNICA Y SITE READINESS</p>
      <h1>Requisitos preliminares de instalación del cliente</h1>
      <p>Proyecto de suministro energético · Contenedores de 40 pies${meta.proyecto ? " · " + esc(meta.proyecto) : ""}</p></header>
      ${REQUISITOS.map((s, i) => `<section><h2>${i + 1}. ${esc(s.t)}</h2><dl class="kv">${s.fields.map((x) => `<dt>${esc(x.l)}</dt><dd>${esc(show(x, data)) || "—"}</dd>`).join("")}</dl></section>`).join("")}`;
  }

  // Texto de la carta (plantilla Carta Compromiso Kinam). Cada párrafo es una lista de partes:
  // texto fijo o { k, ph } = dato capturado o, si falta, su marcador entre corchetes.
  // Lo usan la vista previa (HTML) y el reporte PDF.
  function cartaValues(d) {
    const v = { ...d };
    if (d.fecha) v.fecha_txt = new Date(d.fecha + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
    const rep = [d.representante, d.cargo].filter(Boolean).join(", ");
    if (rep) v.repr = rep;
    return v;
  }
  const P = (k, ph) => ({ k, ph });
  const CARTA_TEXTO = {
    titulo: "Carta compromiso para la adquisición de energía eléctrica",
    subtitulo: "Vigencia comercial propuesta de diez años",
    lugar: [P("ciudad", "Ciudad"), ", ", P("estado", "Estado"), ", a ", P("fecha_txt", "día de mes de año"), "."],
    saludo: "A quien corresponda:",
    intro: ["Por medio de la presente, ", P("consumidor", "NOMBRE O RAZÓN SOCIAL DEL CONSUMIDOR"), ", con RFC ", P("rfc", "RFC"), ", domicilio en ", P("domicilio", "DOMICILIO"), ", representada en este acto por ", P("repr", "NOMBRE Y CARGO"), ", en lo sucesivo el “Consumidor”, manifiesta su interés y compromiso para celebrar el instrumento contractual definitivo de suministro y adquisición de energía eléctrica con Kinam Energy, representada en México por Eco Solar Logist Mx, RFC ESL2310027M9, en lo sucesivo el “Proveedor”."],
    compromiso: ["El Consumidor se compromete a adquirir la energía eléctrica requerida para los centros de carga descritos en el Anexo A, por un plazo de diez (10) años, contado a partir de la fecha de inicio de suministro que se establezca en el contrato definitivo, sujeto a las siguientes condiciones:"],
    clausulas: [
      ["Objeto.", ["El Proveedor suministrará y el Consumidor adquirirá energía eléctrica bajo la modalidad jurídicamente aplicable, incluidos, en su caso, los atributos ambientales, productos asociados y Certificados de Energías Limpias que se pacten en el contrato definitivo."]],
      ["Volumen comprometido.", ["El volumen estimado será de ", P("volumen_mwh", "_____"), " MWh anuales, con una demanda máxima estimada de ", P("demanda_mw", "_____"), " MW, para el o los centros de carga indicados en el Anexo A. El perfil de consumo, las tolerancias, los mecanismos de ajuste y las consecuencias por desviaciones se definirán en el contrato definitivo y sus anexos técnicos."]],
      ["Precio y contraprestación.", ["Las partes acordarán el precio de la energía, moneda, indexación, cargos regulados, impuestos, garantías, facturación y forma de pago. Esta carta no fija una tarifa definitiva ni sustituye las condiciones que correspondan a las autoridades competentes."]],
      ["Condiciones regulatorias.", ["La eficacia del suministro estará sujeta a que el Proveedor, sus afiliadas o terceros autorizados mantengan los permisos, autorizaciones y registros exigibles; a la viabilidad de interconexión y acceso a las redes; y al cumplimiento de las disposiciones aplicables."]],
      ["Cumplimiento normativo.", ["Las partes observarán la Constitución Política de los Estados Unidos Mexicanos, la Ley del Sector Eléctrico, la Ley de Planeación y Transición Energética, la Ley de la Comisión Nacional de Energía, sus reglamentos, disposiciones administrativas, el Código de Red, las reglas del Mercado Eléctrico Mayorista y demás normativa aplicable durante la relación contractual."]],
      ["Autoridades competentes.", ["Nada de lo previsto en esta carta constituye una autorización, permiso, garantía de despacho, interconexión, transmisión, distribución o suministro otorgada por autoridad alguna. Permanecen a salvo las atribuciones de la Secretaría de Energía, la Comisión Nacional de Energía, el Centro Nacional de Control de Energía, la Comisión Federal de Electricidad y demás autoridades competentes."]],
      ["Información y colaboración.", ["El Consumidor proporcionará la información técnica, de consumo, titularidad de los centros de carga y documentación razonablemente necesaria. El Proveedor proporcionará evidencia razonable de su capacidad legal, técnica y operativa para la modalidad de suministro propuesta."]],
      ["Confidencialidad.", ["Las partes mantendrán confidencial la información técnica, comercial, financiera y documental intercambiada con motivo de esta carta, salvo requerimiento legal o de autoridad competente."]],
      ["Vigencia y formalización.", ["Esta carta tendrá vigencia de ", P("vigencia", "90/120/180 días naturales"), " a partir de su firma. Durante dicho plazo, las partes negociarán y procurarán formalizar el contrato definitivo. Las obligaciones económicas y de suministro nacerán únicamente con la firma de ese contrato, salvo las obligaciones de confidencialidad, colaboración y cumplimiento expresamente previstas en esta carta."]],
      ["Legislación y jurisdicción.", ["Para la interpretación y cumplimiento de esta carta, las partes se someten a las leyes federales de los Estados Unidos Mexicanos y a la jurisdicción de los tribunales competentes de ", P("jurisdiccion", "CIUDAD Y ESTADO"), ", renunciando a cualquier otro fuero que pudiera corresponderles."]]
    ],
    cierre: "Leída la presente carta y enteradas las partes de su contenido y alcance, la suscriben en dos tantos de igual contenido.",
    anexo: [["Domicilio del centro de carga", "a_domicilio"], ["Número de servicio, RPU o identificador", "a_rpu"], ["Tensión y tarifa aplicable", "a_tarifa"], ["Consumo histórico anual (MWh)", "a_historico"], ["Demanda máxima (MW)", "a_demanda"], ["Volumen anual comprometido (MWh)", "a_volumen"], ["Fecha estimada de inicio de suministro", "a_inicio"], ["Observaciones técnicas", "a_observaciones"]],
    proveedor: { nombre: "Representada en México por Eco Solar Logist Mx", rfc: "ESL2310027M9", domicilio: "Niebla 406, Colonia Jardines del Moral, León, Guanajuato" }
  };
  const val = (vals, k) => { const x = vals[k]; return x === undefined || x === "" ? null : typeof x === "number" ? x.toLocaleString("es-MX") : String(x); };

  function cartaHTML(d, firma = {}) {
    const vals = cartaValues(d);
    const T = CARTA_TEXTO;
    const seg = (parts) => parts.map((x) => typeof x === "string" ? esc(x) : (val(vals, x.k) ? `<strong>${esc(val(vals, x.k))}</strong>` : `<span class="doc__blank">[${esc(x.ph)}]</span>`)).join("");
    return `<header class="doc__head"><h1>${T.titulo}</h1><p>${T.subtitulo}</p></header>
      <p class="doc__right">${seg(T.lugar)}</p>
      <p>${T.saludo}</p>
      <p>${seg(T.intro)}</p>
      <p>${seg(T.compromiso)}</p>
      <ol class="doc__list">${T.clausulas.map(([t, parts]) => `<li><strong>${t}</strong> ${seg(parts)}</li>`).join("")}</ol>
      <p>${T.cierre}</p>
      <div class="doc__sign">
        <div><p class="mono">POR EL CONSUMIDOR</p><p>${seg([P("consumidor", "NOMBRE O RAZÓN SOCIAL DEL CONSUMIDOR")])}<br>RFC: ${seg([P("rfc", "RFC")])}</p>
          <p class="doc__line">${firma.por ? `Aceptada electrónicamente por <strong>${esc(firma.por)}</strong>${firma.at ? " el " + esc(new Date(firma.at).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" })) : ""}` : "&nbsp;"}</p>
          <p class="note">Nombre, cargo y firma</p><p>Facultades: ${seg([P("facultades", "__________")])}</p></div>
        <div><p class="mono">POR KINAM ENERGY</p><p>${T.proveedor.nombre}<br>RFC: ${T.proveedor.rfc}</p>
          <p class="doc__line">&nbsp;</p><p class="note">Nombre, cargo y firma</p><p>Facultades: __________</p></div>
      </div>
      <h2 class="doc__annex">Anexo A · Centros de carga y consumo estimado</h2>
      <table class="table doc__table"><tbody>${T.anexo.map(([l, k]) => `<tr><th>${esc(l)}</th><td>${seg([P(k, "_____")])}</td></tr>`).join("")}</tbody></table>
      <p class="doc__foot">${T.proveedor.domicilio}</p>`;
  }

  const ESTADOS = { borrador: "Borrador", enviado: "Enviado", revision: "En revisión", observado: "Con observaciones", aprobado: "Aprobado" };
  const ETAPAS = { evaluacion: "Evaluación", requisitos: "Requisitos de instalación", carta: "Carta compromiso", contrato: "Contrato", instalacion: "Instalación", operacion: "Operación", cancelado: "Cancelado" };

  window.KinamFormatos = { REQUISITOS, CARTA, CARTA_TEXTO, ESTADOS, ETAPAS, render, collect, progress, show, requisitosHTML, cartaHTML, cartaValues, fields };
})();
