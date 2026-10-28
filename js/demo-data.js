(function () {
  "use strict";

  const supervisors = [
    "Andrea Campos",
    "Bruno Medina",
    "Carla Ríos",
    "Diego Valverde"
  ];

  const machines = [
    { id: "CONTINUA-DEMO-01", name: "CONTINUA-DEMO-01", process: "CONTINUA", number: "01" },
    { id: "MECHERA-DEMO-01", name: "MECHERA-DEMO-01", process: "MECHERA", number: "01" },
    { id: "CONERA-DEMO-01", name: "CONERA-DEMO-01", process: "CONERA", number: "01" },
    { id: "RETORCEDORA-DEMO-01", name: "RETORCEDORA-DEMO-01", process: "RETORCEDORA", number: "01" }
  ];

  const articles = [
    {
      article: "HILO DEMO ALGODÓN 30/1",
      lot: "LOTE-ALG-101",
      material: "ALGODÓN PEINADO",
      composition: "100% ALGODÓN",
      fromNe: "24/1",
      toNe: "30/1",
      paraffin: "PARAFINA ESTÁNDAR",
      rpm: 14800,
      productionControl: "CP-DEMO-101"
    },
    {
      article: "HILO DEMO POLIÉSTER 24/1",
      lot: "LOTE-POL-202",
      material: "POLIÉSTER",
      composition: "100% POLIÉSTER",
      fromNe: "20/1",
      toNe: "24/1",
      paraffin: "PARAFINA SUAVE",
      rpm: 14200,
      productionControl: "CP-DEMO-202"
    },
    {
      article: "HILO DEMO VISCOSA 20/1",
      lot: "LOTE-VIS-303",
      material: "VISCOSA",
      composition: "100% VISCOSA",
      fromNe: "18/1",
      toNe: "20/1",
      paraffin: "PARAFINA MEDIA",
      rpm: 13600,
      productionControl: "CP-DEMO-303"
    },
    {
      article: "HILO DEMO MEZCLA 28/1",
      lot: "LOTE-MEZ-404",
      material: "MEZCLA ALGODÓN/POLIÉSTER",
      composition: "60% ALGODÓN / 40% POLIÉSTER",
      fromNe: "24/1",
      toNe: "28/1",
      paraffin: "PARAFINA FIRME",
      rpm: 14500,
      productionControl: "CP-DEMO-404"
    }
  ];

  const mechanics = ["Mario Demo", "Nora Demo", "Óscar Demo", "Rosa Demo"];

  const initialOrder = {
    id: "DEMO-ORDER-0001",
    code: "DEMO-OC-0001",
    status: "CERRADA_CON_OBSERVACIONES",
    date: "2026-10-27",
    shift: "Mañana",
    supervisor: supervisors[0],
    machineId: machines[0].id,
    machine: machines[0].name,
    process: machines[0].process,
    machineNumber: machines[0].number,
    fromNe: articles[0].fromNe,
    article: articles[0].article,
    lot: articles[0].lot,
    material: articles[0].material,
    composition: articles[0].composition,
    toNe: articles[0].toNe,
    paraffin: articles[0].paraffin,
    observations: "Orden ficticia incluida para practicar la consulta de un cierre.",
    startTime: "08:10",
    endTime: "09:05",
    mechanic: mechanics[0],
    productionControl: articles[0].productionControl,
    rpm: articles[0].rpm,
    assistant: "Dependencia simulada",
    signedAt: "2026-10-27T08:20:00",
    closedAt: "2026-10-27T09:05:00",
    forcedCloseNote: "Ejemplo inicial cerrado con observaciones para la práctica.",
    createdAt: "2026-10-27T08:00:00",
    updatedAt: "2026-10-27T09:05:00",
    signature: { user: supervisors[0], code: "DEMO-SUP-0001", at: "2026-10-27T08:20:00" }
  };

  const initialStop = {
    id: "DEMO-STOP-0001",
    orderId: initialOrder.id,
    code: initialOrder.code,
    status: "LIMPIEZA_TERMINADA",
    machine: initialOrder.machine,
    article: initialOrder.article,
    lot: initialOrder.lot,
    composition: initialOrder.composition,
    supervisor: initialOrder.supervisor,
    startedAt: "2026-10-27T08:20:00",
    finishedAt: "2026-10-27T08:45:00",
    events: [
      { label: "Limpieza y ajuste de máquina", start: "2026-10-27T08:20:00", end: "2026-10-27T08:45:00", user: initialOrder.supervisor, result: "Limpieza terminada" }
    ]
  };

  window.DEMO_DATA = Object.freeze({
    supervisors,
    shifts: ["Mañana", "Tarde", "Noche"],
    machines,
    articles,
    mechanics,
    initialOrders: [initialOrder],
    initialStops: [initialStop]
  });
})();
