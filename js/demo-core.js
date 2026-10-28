(function () {
  "use strict";

  const STATUS_META = Object.freeze({
    BORRADOR: { label: "Borrador", color: "neutral" },
    PENDIENTE_VALIDACION_RPM: { label: "Pendiente validación RPM", color: "yellow" },
    CERRADA_CON_OBSERVACIONES: { label: "Cerrada con observaciones", color: "orange" }
  });

  const STOP_META = Object.freeze({
    EN_LIMPIEZA_Y_AJUSTE: { label: "Limpieza y ajuste", color: "blue" },
    LIMPIEZA_TERMINADA: { label: "Limpieza terminada", color: "green" }
  });

  const ORDER_REQUIRED = Object.freeze([
    ["date", "Fecha"],
    ["shift", "Turno"],
    ["supervisor", "Supervisor"],
    ["machineId", "Máquina"],
    ["fromNe", "De Ne (Antiguo)"],
    ["article", "Artículo (Nuevo)"],
    ["lot", "Lote (Nuevo)"],
    ["material", "Material"],
    ["composition", "Composición"],
    ["toNe", "A Ne (Nuevo)"],
    ["startTime", "Empezó el cambio"],
    ["mechanic", "Mecánico asignado"],
    ["productionControl", "Control de producción"],
    ["rpm", "RPM - Ficha Técnica"]
  ]);

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function pad(value, size) {
    return String(value).padStart(size, "0");
  }

  function nextCode(orders) {
    const max = orders.reduce((highest, order) => {
      const match = String(order.code || "").match(/(\d+)$/);
      return match ? Math.max(highest, Number(match[1])) : highest;
    }, 0);
    return `DEMO-OC-${pad(max + 1, 4)}`;
  }

  function nextId(prefix) {
    const stamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).slice(2, 7).toUpperCase();
    return `${prefix}-${stamp}-${random}`;
  }

  function emptyOrder(session, orders, now) {
    const date = now.toISOString().slice(0, 10);
    const time = `${pad(now.getHours(), 2)}:${pad(now.getMinutes(), 2)}`;
    return {
      id: nextId("DEMO-ORDER"),
      code: nextCode(orders),
      status: "BORRADOR",
      date,
      shift: session.shift,
      supervisor: session.supervisor,
      machineId: "",
      machine: "",
      process: "",
      machineNumber: "",
      fromNe: "",
      article: "",
      lot: "",
      material: "",
      composition: "",
      toNe: "",
      paraffin: "",
      observations: "",
      startTime: time,
      endTime: "",
      mechanic: "",
      productionControl: "",
      rpm: "",
      assistant: "Dependencia simulada",
      signedAt: "",
      closedAt: "",
      forcedCloseNote: "",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      signature: null
    };
  }

  function validateOrder(order) {
    return ORDER_REQUIRED
      .filter(([key]) => String(order[key] ?? "").trim() === "")
      .map(([, label]) => label);
  }

  // Mismas 9 etiquetas y el mismo orden que getCloseChecklist() de la
  // aplicación real (tab-fill.js) -- acá "Validación RPM aprobada" y "Firma
  // del validador RPM" quedan siempre en false a propósito: esta DEMO no
  // tiene perfil PCP, así que esos dos pendientes nunca se resuelven y el
  // cierre normal queda bloqueado siempre, igual que en la aplicación real
  // cuando ese paso no se completó. `soft:true` replica la misma marca real
  // (son los únicos 2 pendientes "blandos" -- la app real los deja pasar con
  // Forzar cierre en vez de impedirlo del todo); acá no cambia el
  // comportamiento (el cierre normal sigue bloqueado), pero sí el texto que
  // explica por qué.
  function closeChecklist(order) {
    return [
      { label: "Máquina seleccionada", ok: !!order.machineId },
      { label: "Mecánico seleccionado", ok: !!order.mechanic },
      { label: "Hora de inicio registrada", ok: !!order.startTime },
      { label: "Hora de término registrada", ok: !!order.endTime },
      { label: "RPM mecánico registrada", ok: Number(order.rpm) > 0 },
      { label: "Validación RPM aprobada", ok: false, soft: true },
      { label: "Firma del Mecánico", ok: !!order.signedAt },
      { label: "Firma del validador RPM", ok: false, soft: true },
      { label: "Firma del Supervisor", ok: !!order.signature }
    ];
  }

  function signOrder(order, supervisor, now) {
    const signed = clone(order);
    signed.status = "PENDIENTE_VALIDACION_RPM";
    signed.supervisor = supervisor;
    signed.signedAt = now.toISOString();
    signed.updatedAt = now.toISOString();
    signed.signature = {
      user: supervisor,
      code: `DEMO-SUP-${now.getTime().toString().slice(-8)}`,
      at: now.toISOString()
    };
    return signed;
  }

  function forceCloseOrder(order, note, now) {
    const closed = clone(order);
    closed.status = "CERRADA_CON_OBSERVACIONES";
    closed.forcedCloseNote = note.trim();
    closed.closedAt = now.toISOString();
    closed.endTime = closed.endTime || `${pad(now.getHours(), 2)}:${pad(now.getMinutes(), 2)}`;
    closed.updatedAt = now.toISOString();
    return closed;
  }

  function createStop(order, now) {
    return {
      id: nextId("DEMO-STOP"),
      orderId: order.id,
      code: order.code,
      status: "EN_LIMPIEZA_Y_AJUSTE",
      machine: order.machine,
      article: order.article,
      lot: order.lot,
      composition: order.composition,
      supervisor: order.supervisor,
      startedAt: order.signedAt || now.toISOString(),
      finishedAt: "",
      events: [
        {
          label: "Limpieza y ajuste de máquina",
          start: order.signedAt || now.toISOString(),
          end: "",
          user: order.supervisor,
          result: "En curso"
        }
      ]
    };
  }

  function finishCleaning(stop, supervisor, now) {
    const completed = clone(stop);
    completed.status = "LIMPIEZA_TERMINADA";
    completed.finishedAt = now.toISOString();
    completed.events[0].end = now.toISOString();
    completed.events[0].user = supervisor;
    completed.events[0].result = "Limpieza terminada";
    return completed;
  }

  function durationLabel(start, end, now) {
    const from = new Date(start).getTime();
    const to = end ? new Date(end).getTime() : now.getTime();
    if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return "—";
    const minutes = Math.max(0, Math.round((to - from) / 60000));
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return hours ? `${hours}h ${rest}min` : `${rest}min`;
  }

  window.DemoCore = Object.freeze({
    STATUS_META,
    STOP_META,
    ORDER_REQUIRED,
    clone,
    emptyOrder,
    validateOrder,
    closeChecklist,
    signOrder,
    forceCloseOrder,
    createStop,
    finishCleaning,
    durationLabel
  });
})();
