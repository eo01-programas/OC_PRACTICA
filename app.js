(function () {
  "use strict";

  const DATA = window.DEMO_DATA;
  const Core = window.DemoCore;
  const $ = (id) => document.getElementById(id);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));

  let state = freshState();
  let draftOrder = null;
  let activeStopId = null;
  let forceCloseIsCorrection = false;

  function freshState() {
    return {
      session: null,
      orders: Core.clone(DATA.initialOrders),
      stops: Core.clone(DATA.initialStops),
      notifications: [],
      unread: 0,
      section: "orders"
    };
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function option(value, label) {
    return `<option value="${escapeHtml(value)}">${escapeHtml(label ?? value)}</option>`;
  }

  function localDate(value) {
    if (!value) return "—";
    const raw = String(value).slice(0, 10).split("-");
    return raw.length === 3 ? `${raw[2]}/${raw[1]}/${raw[0]}` : value;
  }

  function localDateTime(value) {
    if (!value) return "—";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "—";
    return parsed.toLocaleString("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function timeOnly(value) {
    if (!value) return "—";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "—";
    return parsed.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
  }

  function statusBadge(status) {
    const meta = Core.STATUS_META[status] || { label: status, color: "neutral" };
    return `<span class="status-badge status-${meta.color}">${escapeHtml(meta.label)}</span>`;
  }

  function stopBadge(status) {
    const meta = Core.STOP_META[status] || { label: status, color: "neutral" };
    return `<span class="status-badge status-${meta.color}">${escapeHtml(meta.label)}</span>`;
  }

  function openModal(id) {
    $(id).classList.remove("hidden");
    const target = $(id).querySelector("textarea, input, button");
    if (target) setTimeout(() => target.focus(), 0);
  }

  function closeModal(id) {
    $(id).classList.add("hidden");
  }

  function showMessage(title, bodyHtml) {
    $("messageTitle").textContent = title;
    $("messageBody").innerHTML = bodyHtml;
    openModal("messageModal");
  }

  function notify(title, message) {
    const entry = {
      id: `NOTIF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      message,
      at: new Date().toISOString()
    };
    state.notifications.unshift(entry);
    state.unread += 1;
    renderNotificationBadge();
    renderNotificationPanel();

    const card = document.createElement("article");
    card.className = "toast-card";
    card.dataset.toastId = entry.id;
    card.innerHTML = `
      <div class="toast-accent"></div>
      <div class="toast-content">
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(message)}</p>
      </div>
      <button class="toast-close" type="button" aria-label="Cerrar notificación">×</button>`;
    card.querySelector("button").addEventListener("click", () => card.remove());
    $("toastRegion").prepend(card);
  }

  function renderNotificationBadge() {
    const badge = $("notificationBadge");
    badge.textContent = String(state.unread);
    badge.classList.toggle("hidden", state.unread === 0);
  }

  function renderNotificationPanel() {
    const list = $("notificationList");
    if (!state.notifications.length) {
      list.innerHTML = '<p class="muted">No hay tarjetas en esta práctica.</p>';
      return;
    }
    list.innerHTML = state.notifications.map((item) => `
      <article class="notification-entry">
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.message)}</p>
        <small>${escapeHtml(localDateTime(item.at))}</small>
      </article>`).join("");
  }

  function setSection(section) {
    state.section = section;
    $$("[data-section]").forEach((button) => button.classList.toggle("active", button.dataset.section === section));
    $("ordersSection").classList.toggle("active", section === "orders");
    $("stopsSection").classList.toggle("active", section === "stops");
    if (section === "orders") showOrdersList();
    if (section === "stops") {
      showStopsList();
      renderStops();
    }
  }

  function populateStaticOptions() {
    $("loginSupervisor").innerHTML = '<option value="">Seleccione...</option>' + DATA.supervisors.map((name) => option(name)).join("");
    $("supervisorName").innerHTML = DATA.supervisors.map((name) => option(name)).join("");
    $("machineSelect").innerHTML = '<option value="">Seleccione...</option>' + DATA.machines.map((machine) => option(machine.id, machine.name)).join("");

    const listValues = {
      articleOptions: DATA.articles.map((item) => item.article),
      lotOptions: DATA.articles.map((item) => item.lot),
      materialOptions: DATA.articles.map((item) => item.material),
      compositionOptions: DATA.articles.map((item) => item.composition),
      titleOptions: DATA.articles.map((item) => item.toNe),
      paraffinOptions: DATA.articles.map((item) => item.paraffin),
      mechanicOptions: DATA.mechanics,
      productionOptions: DATA.articles.map((item) => item.productionControl)
    };

    Object.entries(listValues).forEach(([id, values]) => {
      $(id).innerHTML = [...new Set(values)].map((value) => option(value)).join("");
    });
  }

  function login(event) {
    event.preventDefault();
    const supervisor = $("loginSupervisor").value;
    const shift = $("loginShift").value;
    if (!supervisor || !shift) return;
    state.session = { supervisor, shift, profile: "SUPERVISOR" };
    $("sessionMeta").textContent = `${supervisor} · Supervisor · Turno ${shift}`;
    $("loginView").classList.add("hidden");
    $("mainView").classList.remove("hidden");
    renderAll();
    setSection("orders");
    notify("Sesión de práctica iniciada", `${supervisor} ingresó en el turno ${shift}.`);
  }

  function logout() {
    state.session = null;
    draftOrder = null;
    activeStopId = null;
    $("mainView").classList.add("hidden");
    $("loginView").classList.remove("hidden");
    $("toastRegion").innerHTML = "";
  }

  function resetPractice() {
    if (!window.confirm("¿Reiniciar la práctica? Se perderán todas las órdenes y acciones temporales.")) return;
    state = freshState();
    draftOrder = null;
    activeStopId = null;
    $("toastRegion").innerHTML = "";
    $("loginForm").reset();
    $("loginShift").value = "Mañana";
    closeAllModals();
    logout();
    renderAll();
  }

  function renderAll() {
    renderOrders();
    renderStops();
    renderNotificationBadge();
    renderNotificationPanel();
    $("stopsCount").textContent = String(state.stops.length);
  }

  function renderOrders() {
    const closed = state.orders.filter((order) => order.status === "CERRADA_CON_OBSERVACIONES").length;
    const open = state.orders.length - closed;
    $("orderSummary").innerHTML = `
      <article class="summary-card"><span>Total en esta sesión</span><strong>${state.orders.length}</strong></article>
      <article class="summary-card"><span>Órdenes abiertas</span><strong>${open}</strong></article>
      <article class="summary-card"><span>Cerradas con observaciones</span><strong>${closed}</strong></article>`;

    const orders = [...state.orders].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    $("ordersBody").innerHTML = orders.length ? orders.map((order) => `
      <tr>
        <td><button class="btn btn-ghost btn-sm" type="button" data-open-order="${escapeHtml(order.id)}">Abrir</button></td>
        <td><strong>${escapeHtml(order.code)}</strong></td>
        <td>${escapeHtml(localDate(order.date))}<div class="muted">${escapeHtml(order.shift)}</div></td>
        <td><div class="cell-stack"><strong>${escapeHtml(order.machine || "—")}</strong><small>${escapeHtml(order.process || "—")}</small></div></td>
        <td><div class="cell-stack"><strong>${escapeHtml(order.article || "—")}</strong><small>${escapeHtml(order.lot || "—")}</small></div></td>
        <td>${statusBadge(order.status)}</td>
        <td>${escapeHtml(order.supervisor || "—")}</td>
      </tr>`).join("") : '<tr><td colspan="7" class="empty-row">No hay órdenes en esta práctica.</td></tr>';

    $$('[data-open-order]').forEach((button) => button.addEventListener("click", () => openOrder(button.dataset.openOrder)));
  }

  function showOrdersList() {
    draftOrder = null;
    $("orderEditorView").classList.add("hidden");
    $("ordersListView").classList.remove("hidden");
    renderOrders();
  }

  function showOrderEditor() {
    $("ordersListView").classList.add("hidden");
    $("orderEditorView").classList.remove("hidden");
  }

  function newOrder() {
    draftOrder = Core.emptyOrder(state.session, state.orders, new Date());
    loadOrderForm(draftOrder);
    showOrderEditor();
  }

  function openOrder(id) {
    const order = state.orders.find((item) => item.id === id);
    if (!order) return;
    draftOrder = Core.clone(order);
    loadOrderForm(draftOrder);
    showOrderEditor();
  }

  function loadOrderForm(order) {
    const values = {
      orderDate: order.date,
      orderShift: order.shift,
      supervisorName: order.supervisor,
      machineSelect: order.machineId,
      machineProcess: order.process,
      machineNumber: order.machineNumber,
      fromNe: order.fromNe,
      article: order.article,
      lot: order.lot,
      material: order.material,
      composition: order.composition,
      toNe: order.toNe,
      paraffin: order.paraffin,
      observations: order.observations,
      startTime: order.startTime,
      endTime: order.endTime,
      mechanic: order.mechanic,
      visualStatus: Core.STATUS_META[order.status]?.label || order.status,
      productionControl: order.productionControl,
      rpm: order.rpm,
      assistant: order.assistant || "Dependencia simulada"
    };
    Object.entries(values).forEach(([id, value]) => { $(id).value = value ?? ""; });
    $("editorTitle").textContent = order.status === "BORRADOR" ? `${order.code} · Nueva orden` : order.code;
    renderOrderState(order);
    clearInvalidFields();
  }

  function renderOrderState(order) {
    const meta = Core.STATUS_META[order.status] || Core.STATUS_META.BORRADOR;
    $("orderBadge").textContent = `${order.code} · ${meta.label}`;
    $("orderBadge").className = `status-badge status-${meta.color}`;
    $("visualStatus").value = meta.label;

    const isClosed = order.status === "CERRADA_CON_OBSERVACIONES";
    const isSigned = !!order.signature;
    $("closedOrderNotice").classList.toggle("hidden", !isClosed);
    $("closedOrderNotice").innerHTML = isClosed
      ? `<strong>Orden cerrada.</strong> Puede revisar sus datos. Si modifica algo, use <strong>Corregir datos cerrados</strong> e ingrese una aclaración.`
      : "";
    $("saveSignBtn").disabled = isClosed;
    $("normalCloseBtn").disabled = isClosed;
    $("forceCloseBtn").textContent = isClosed ? "Corregir datos cerrados" : "Forzar cierre";

    $("signaturePanel").innerHTML = isSigned ? `
      <div class="signature-card">
        <span class="signature-seal">✓</span>
        <div><strong>Supervisor: ${escapeHtml(order.signature.user)}</strong><small>${escapeHtml(order.signature.code)} · ${escapeHtml(localDateTime(order.signature.at))}</small></div>
      </div>` : "La orden todavía no tiene la firma del Supervisor.";

    const steps = [
      { label: "Creación", done: isSigned || isClosed, active: !isSigned && !isClosed },
      { label: "Envío directo", done: isSigned || isClosed, active: false },
      { label: "Validación RPM", done: false, active: isSigned && !isClosed },
      { label: "Cierre", done: isClosed, active: false },
      { label: "Finalizada", done: isClosed, active: false }
    ];
    $("flowSteps").innerHTML = steps.map((step) => `<div class="flow-step ${step.done ? "done" : step.active ? "active" : ""}">${escapeHtml(step.label)}</div>`).join("");
  }

  function machineChanged() {
    const machine = DATA.machines.find((item) => item.id === $("machineSelect").value);
    $("machineProcess").value = machine?.process || "";
    $("machineNumber").value = machine?.number || "";
  }

  function articleChanged() {
    const selected = DATA.articles.find((item) => item.article.toLocaleLowerCase() === $("article").value.trim().toLocaleLowerCase());
    if (!selected) return;
    $("lot").value = selected.lot;
    $("material").value = selected.material;
    $("composition").value = selected.composition;
    $("fromNe").value = selected.fromNe;
    $("toNe").value = selected.toNe;
    $("paraffin").value = selected.paraffin;
    $("rpm").value = selected.rpm;
    $("productionControl").value = selected.productionControl;
  }

  function collectOrderForm() {
    if (!draftOrder) return null;
    const machine = DATA.machines.find((item) => item.id === $("machineSelect").value);
    return {
      ...draftOrder,
      date: $("orderDate").value,
      shift: $("orderShift").value,
      supervisor: $("supervisorName").value,
      machineId: $("machineSelect").value,
      machine: machine?.name || $("machineSelect").value,
      process: machine?.process || $("machineProcess").value,
      machineNumber: machine?.number || $("machineNumber").value,
      fromNe: $("fromNe").value.trim(),
      article: $("article").value.trim(),
      lot: $("lot").value.trim(),
      material: $("material").value.trim(),
      composition: $("composition").value.trim(),
      toNe: $("toNe").value.trim(),
      paraffin: $("paraffin").value.trim(),
      observations: $("observations").value.trim(),
      startTime: $("startTime").value,
      endTime: $("endTime").value,
      mechanic: $("mechanic").value.trim(),
      productionControl: $("productionControl").value.trim(),
      rpm: $("rpm").value,
      assistant: "Dependencia simulada",
      updatedAt: new Date().toISOString()
    };
  }

  function clearInvalidFields() {
    $$(".field.invalid", $("orderForm")).forEach((field) => field.classList.remove("invalid"));
  }

  function markMissing(missing) {
    clearInvalidFields();
    const labelToId = {
      "Fecha": "orderDate", "Turno": "orderShift", "Supervisor": "supervisorName", "Máquina": "machineSelect",
      "De Ne (Antiguo)": "fromNe", "Artículo (Nuevo)": "article", "Lote (Nuevo)": "lot", "Material": "material",
      "Composición": "composition", "A Ne (Nuevo)": "toNe", "Empezó el cambio": "startTime", "Mecánico asignado": "mechanic",
      "Control de producción": "productionControl", "RPM - Ficha Técnica": "rpm"
    };
    missing.forEach((label) => $(labelToId[label])?.closest(".field")?.classList.add("invalid"));
  }

  function validateCollected(order) {
    const missing = Core.validateOrder(order);
    markMissing(missing);
    if (!missing.length) return true;
    showMessage("Complete los datos obligatorios", `<div class="alert alert-danger"><strong>Faltan los siguientes campos:</strong><br>${missing.map((label) => `• ${escapeHtml(label)}`).join("<br>")}</div>`);
    return false;
  }

  function upsertOrder(order) {
    const index = state.orders.findIndex((item) => item.id === order.id);
    if (index === -1) state.orders.unshift(order);
    else state.orders[index] = order;
    draftOrder = Core.clone(order);
  }

  function ensureStop(order) {
    let stop = state.stops.find((item) => item.orderId === order.id);
    if (!stop) {
      stop = Core.createStop(order, new Date());
      state.stops.unshift(stop);
    }
    return stop;
  }

  function saveSignAndSend() {
    const collected = collectOrderForm();
    if (!collected || !validateCollected(collected)) return;
    const now = new Date();
    const signed = Core.signOrder(collected, state.session.supervisor, now);
    upsertOrder(signed);
    ensureStop(signed);
    loadOrderForm(signed);
    renderAll();
    notify("Orden firmada y enviada", `${signed.code} quedó pendiente de validación RPM. La firma mecánica fue simulada.`);
    showMessage("Orden enviada", `<div class="alert alert-success"><strong>${escapeHtml(signed.code)}</strong> fue guardada, firmada y enviada.</div><p>La dependencia mecánica se resolvió automáticamente. El cierre normal continuará bloqueado; puede practicar <strong>Forzar cierre</strong>.</p>`);
  }

  function tryNormalClose() {
    const collected = collectOrderForm();
    if (!collected || !validateCollected(collected)) return;
    const missing = Core.closeChecklist(collected).filter((item) => !item.ok);
    const hard = missing.filter((item) => !item.soft);
    const soft = missing.filter((item) => item.soft);
    const hardHtml = hard.length ? `<strong>Registros sin completar:</strong><br>${hard.map((item) => `• ${escapeHtml(item.label)}`).join("<br>")}` : "";
    const softHtml = soft.length ? `${hard.length ? "<br><br>" : ""}<strong>Esta DEMO no puede resolverlos</strong> (no existe el perfil PCP):<br>${soft.map((item) => `• ${escapeHtml(item.label)}`).join("<br>")}` : "";
    showMessage("No es posible el cierre normal", `<div class="alert alert-warning">${hardHtml}${softHtml}</div><p>Use <strong>Forzar cierre</strong> si corresponde, igual que en la aplicación real.</p>`);
  }

  function openForceClose() {
    const collected = collectOrderForm();
    if (!collected || !validateCollected(collected)) return;
    draftOrder = collected;
    forceCloseIsCorrection = collected.status === "CERRADA_CON_OBSERVACIONES";
    $("forceCloseTitle").textContent = forceCloseIsCorrection ? "Corregir datos de la orden cerrada" : "Forzar cierre de orden";
    $("confirmForceCloseBtn").textContent = forceCloseIsCorrection ? "Guardar corrección" : "Cerrar con observaciones";
    $("forceCloseNote").placeholder = forceCloseIsCorrection ? "Explique qué se corrige y por qué..." : "Explique por qué se cerrará la orden incompleta...";
    $("forceCloseNote").value = "";
    $("forceCloseError").classList.add("hidden");

    if (forceCloseIsCorrection) {
      $("forceCloseMissing").className = "alert alert-info";
      $("forceCloseMissing").innerHTML = "La orden ya está cerrada. Los cambios del formulario se guardarán únicamente durante esta práctica y la aclaración quedará visible en la orden.";
    } else {
      const missing = Core.closeChecklist(collected).filter((item) => !item.ok);
      const hard = missing.filter((item) => !item.soft);
      const soft = missing.filter((item) => item.soft);
      const hardHtml = hard.length ? `<strong>Registros pendientes:</strong><br>${hard.map((item) => `• ${escapeHtml(item.label)}`).join("<br>")}` : "";
      const softHtml = soft.length ? `${hard.length ? "<br><br>" : ""}<strong>No disponibles en esta DEMO:</strong><br>${soft.map((item) => `• ${escapeHtml(item.label)}`).join("<br>")}` : "";
      $("forceCloseMissing").className = "alert alert-danger";
      $("forceCloseMissing").innerHTML = hardHtml || softHtml ? `${hardHtml}${softHtml}` : "No se detectaron pendientes.";
    }
    openModal("forceCloseModal");
  }

  function confirmForceClose() {
    const note = $("forceCloseNote").value.trim();
    if (!note) {
      $("forceCloseError").classList.remove("hidden");
      $("forceCloseNote").focus();
      return;
    }
    const now = new Date();
    let source = collectOrderForm();
    if (!source) return;
    if (!source.signature) source = Core.signOrder(source, state.session.supervisor, now);
    const closed = Core.forceCloseOrder(source, note, now);
    upsertOrder(closed);
    ensureStop(closed);
    loadOrderForm(closed);
    renderAll();
    closeModal("forceCloseModal");
    notify(forceCloseIsCorrection ? "Corrección registrada" : "Orden cerrada con observaciones", `${closed.code}: ${note}`);
    showMessage(forceCloseIsCorrection ? "Corrección guardada" : "Orden cerrada", `<div class="alert alert-success"><strong>${escapeHtml(closed.code)}</strong> ${forceCloseIsCorrection ? "fue corregida" : "quedó cerrada con observaciones"}.</div><p>Esta acción existe únicamente durante la sesión actual.</p>`);
  }

  function renderStops() {
    $("stopsCount").textContent = String(state.stops.length);
    const stops = [...state.stops].sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
    $("stopsBody").innerHTML = stops.length ? stops.map((stop) => {
      const order = state.orders.find((item) => item.id === stop.orderId);
      return `<tr>
        <td><button class="btn btn-ghost btn-sm" type="button" data-open-stop="${escapeHtml(stop.id)}">Abrir</button></td>
        <td><strong>${escapeHtml(stop.code)}</strong></td>
        <td>${escapeHtml(stop.machine || order?.machine || "—")}</td>
        <td><div class="cell-stack"><strong>${escapeHtml(stop.article || "—")}</strong><small>${escapeHtml(stop.lot || "—")}</small></div></td>
        <td>${stopBadge(stop.status)}</td>
        <td>${escapeHtml(localDateTime(stop.startedAt))}</td>
        <td>${escapeHtml(Core.durationLabel(stop.startedAt, stop.finishedAt, new Date()))}</td>
      </tr>`;
    }).join("") : '<tr><td colspan="7" class="empty-row">No hay controles de paro en esta práctica.</td></tr>';
    $$('[data-open-stop]').forEach((button) => button.addEventListener("click", () => openStop(button.dataset.openStop)));
  }

  function showStopsList() {
    activeStopId = null;
    $("stopDetailView").classList.add("hidden");
    $("stopsListView").classList.remove("hidden");
  }

  function openStop(id) {
    activeStopId = id;
    $("stopsListView").classList.add("hidden");
    $("stopDetailView").classList.remove("hidden");
    renderStopDetail();
  }

  function renderStopDetail() {
    const stop = state.stops.find((item) => item.id === activeStopId);
    if (!stop) return showStopsList();
    const meta = Core.STOP_META[stop.status] || { label: stop.status, color: "neutral" };
    $("stopTitle").textContent = stop.code;
    $("stopBadge").textContent = meta.label;
    $("stopBadge").className = `status-badge status-${meta.color}`;
    $("stopHero").innerHTML = `
      <div><h3>${escapeHtml(stop.machine)}</h3><p>${escapeHtml(stop.article)} · ${escapeHtml(stop.composition)}</p><p class="muted">Lote ${escapeHtml(stop.lot)} · Supervisor ${escapeHtml(stop.supervisor)}</p></div>
      <div class="cell-stack"><span class="muted">Inicio</span><strong>${escapeHtml(localDateTime(stop.startedAt))}</strong><small>${escapeHtml(Core.durationLabel(stop.startedAt, stop.finishedAt, new Date()))}</small></div>`;

    if (stop.status === "EN_LIMPIEZA_Y_AJUSTE") {
      $("stopActionCard").innerHTML = `
        <div class="stop-action-row">
          <div><h3>Limpieza y ajuste de máquina</h3><p class="muted">Caso ideal: las dependencias necesarias ya están resueltas para el Supervisor.</p></div>
          <button id="finishCleaningBtn" class="btn btn-primary" type="button">Limpieza terminada</button>
        </div>`;
      $("finishCleaningBtn").addEventListener("click", finishCleaning);
    } else {
      $("stopActionCard").innerHTML = '<div class="alert alert-success"><strong>Limpieza terminada.</strong> La práctica de Control de Paros finaliza en este punto.</div>';
    }

    $("stopTimeline").innerHTML = stop.events.map((event) => `
      <tr>
        <td><strong>${escapeHtml(event.label)}</strong></td>
        <td>${escapeHtml(timeOnly(event.start))}</td>
        <td>${escapeHtml(timeOnly(event.end))}</td>
        <td>${escapeHtml(event.user || "—")}</td>
        <td>${escapeHtml(event.result)}</td>
      </tr>`).join("");
  }

  function finishCleaning() {
    const index = state.stops.findIndex((item) => item.id === activeStopId);
    if (index === -1) return;
    const completed = Core.finishCleaning(state.stops[index], state.session.supervisor, new Date());
    state.stops[index] = completed;
    renderStops();
    renderStopDetail();
    notify("Limpieza terminada", `${completed.code} completó el alcance de Control de Paros de la DEMO.`);
  }

  function closeAllModals() {
    $$(".modal-backdrop").forEach((modal) => modal.classList.add("hidden"));
  }

  function wireEvents() {
    $("loginForm").addEventListener("submit", login);
    $("logoutBtn").addEventListener("click", logout);
    $("resetBtn").addEventListener("click", resetPractice);
    $$("[data-section]").forEach((button) => button.addEventListener("click", () => setSection(button.dataset.section)));
    $("newOrderBtn").addEventListener("click", newOrder);
    $("backToOrdersBtn").addEventListener("click", showOrdersList);
    $("backToStopsBtn").addEventListener("click", showStopsList);
    $("machineSelect").addEventListener("change", machineChanged);
    $("article").addEventListener("change", articleChanged);
    $("saveSignBtn").addEventListener("click", saveSignAndSend);
    $("normalCloseBtn").addEventListener("click", tryNormalClose);
    $("forceCloseBtn").addEventListener("click", openForceClose);
    $("confirmForceCloseBtn").addEventListener("click", confirmForceClose);
    $("messageAcceptBtn").addEventListener("click", () => closeModal("messageModal"));
    $("notificationBtn").addEventListener("click", () => {
      state.unread = 0;
      renderNotificationBadge();
      renderNotificationPanel();
      openModal("notificationModal");
    });
    $("clearNotificationsBtn").addEventListener("click", () => {
      state.notifications = [];
      state.unread = 0;
      $("toastRegion").innerHTML = "";
      renderNotificationBadge();
      renderNotificationPanel();
    });
    $$('[data-close-modal]').forEach((button) => button.addEventListener("click", () => closeModal(button.dataset.closeModal)));
    $$(".modal-backdrop").forEach((modal) => modal.addEventListener("click", (event) => {
      if (event.target === modal) closeModal(modal.id);
    }));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeAllModals();
    });
  }

  function init() {
    populateStaticOptions();
    wireEvents();
    renderAll();
  }

  window.DemoApp = Object.freeze({
    snapshot: () => Core.clone(state),
    resetInMemory: () => { state = freshState(); renderAll(); },
    isMemoryOnly: true
  });

  init();
})();
