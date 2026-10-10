/* lovii pilot — SPA-оболочка и экраны среза:
   #/guest — гостевое приложение (меню, корзина, заказ, статусы)
   #/pos   — касса: очередь заказов, оплаты, чеки, смена
   #/biz   — мини-кабинет B2B: выручка, меню, стоп-лист, настройки */
(function () {
  const S = window.PilotStore;
  let cart = []; // [{menuId, qty}]

  const TABS = [
    { id: "guest", title: "Гость · приложение", cls: "cab-app" },
    { id: "pos", title: "Касса", cls: "cab-crm" },
    { id: "biz", title: "Бизнес · мини-кабинет", cls: "cab-erp" }
  ];

  // ---------- Утилиты ----------
  function h(html) { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content; }
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c])); }
  function fmtKop(kop) { return S.fmtRub(kop); }
  function timeShort(iso) { return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }); }
  function dtFull(iso) { return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }
  function toast(text, kind) {
    const box = document.getElementById("toasts");
    const el = document.createElement("div");
    el.className = "toast " + (kind || "");
    el.textContent = text;
    box.appendChild(el);
    window.setTimeout(() => el.remove(), 3500);
  }

  const ORDER_LABEL = { new: "Новый", accepted: "Принят", kitchen: "На кухне", ready: "Готов", served: "Выдан", cancelled: "Отменён" };
  const ORDER_BADGE = { new: "info", accepted: "brand", kitchen: "warn", ready: "ok", served: "gray", cancelled: "err" };

  // ---------- Оболочка ----------
  function route() {
    const hash = (location.hash || "#/guest").replace("#/", "");
    const tab = TABS.find((t) => t.id === hash) ? hash : "guest";
    document.body.className = TABS.find((t) => t.id === tab).cls;
    document.querySelectorAll("#entrance-tabs button").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === tab);
    });
    const main = document.getElementById("main");
    main.classList.remove("screen-in"); void main.offsetWidth; main.classList.add("screen-in");
    if (tab === "guest") renderGuest(main);
    if (tab === "pos") renderPos(main);
    if (tab === "biz") renderBiz(main);
  }

  function buildShell() {
    document.getElementById("topbar").innerHTML =
      '<div class="logo">lovii<span>.pilot</span></div>' +
      '<div class="addr"><b id="tb-location">' + esc(S.getState().settings.locationName) + '</b></div>' +
      '<div id="entrance-tabs">' + TABS.map((t) =>
        '<button data-tab="' + t.id + '"><span class="cab-dot dot-' + t.id + '"></span>' + t.title + '</button>').join("") + '</div>' +
      '<div class="grow"></div><div class="muted small" id="tb-clock"></div>';
    document.querySelectorAll("#entrance-tabs button").forEach((b) => {
      b.addEventListener("click", () => { location.hash = "#/" + b.dataset.tab; });
    });
    window.setInterval(() => {
      const c = document.getElementById("tb-clock");
      if (c) c.textContent = new Date().toLocaleTimeString("ru-RU");
    }, 1000);
  }

  // ---------- Экран «Гость» ----------
  function renderGuest(main) {
    const st = S.getState();
    const cats = [];
    st.menu.forEach((m) => { if (!m.stop && cats.indexOf(m.cat) === -1) cats.push(m.cat); });
    const lastOrder = st.orders.find((o) => o.channel === "miniapp");

    let html = '<div class="guest-wrap"><div class="guest-main">';
    html += '<h1>Меню</h1><p class="muted">Заказ в зал или самовывоз — оплата на кассе после подачи.</p>';
    cats.forEach((cat) => {
      html += '<h3 class="cat">' + esc(cat) + '</h3><div class="grid cols-3">';
      st.menu.filter((m) => m.cat === cat && !m.stop).forEach((m) => {
        const inCart = (cart.find((c) => c.menuId === m.id) || {}).qty || 0;
        html += '<div class="card menu-card" data-id="' + m.id + '">' +
          '<div class="card-head"><b>' + esc(m.name) + '</b></div>' +
          '<div class="muted small">готовим ~' + m.cookMin + ' мин</div>' +
          '<div class="menu-foot"><b>' + m.price.toLocaleString("ru-RU") + ' ₽</b>' +
          (inCart
            ? '<span class="qty-ctl"><button class="btn small" data-dec="' + m.id + '">−</button><b>' + inCart + '</b><button class="btn small" data-inc="' + m.id + '">+</button></span>'
            : '<button class="btn primary small" data-inc="' + m.id + '">В корзину</button>') +
          '</div></div>';
      });
      html += '</div>';
    });
    html += '</div><aside class="guest-cart card"><div class="card-head"><b>Корзина</b><span class="muted small" id="cart-count"></span></div><div id="cart-box"></div></aside></div>';

    if (lastOrder) html += renderOrderStatus(lastOrder);
    main.innerHTML = html;

    main.querySelectorAll("[data-inc]").forEach((b) => b.addEventListener("click", () => {
      const it = cart.find((c) => c.menuId === b.dataset.inc);
      if (it) it.qty += 1; else cart.push({ menuId: b.dataset.inc, qty: 1 });
      renderGuest(main);
    }));
    main.querySelectorAll("[data-dec]").forEach((b) => b.addEventListener("click", () => {
      const it = cart.find((c) => c.menuId === b.dataset.dec);
      if (it) { it.qty -= 1; if (it.qty <= 0) cart = cart.filter((c) => c !== it); }
      renderGuest(main);
    }));
    renderCart(main);
  }

  function renderCart(main) {
    const box = main.querySelector("#cart-box");
    const count = main.querySelector("#cart-count");
    const st = S.getState();
    const items = cart.map((c) => ({ c, m: st.menu.find((m) => m.id === c.menuId) })).filter((x) => x.m);
    const totalKop = items.reduce((s, x) => s + x.m.price * 100 * x.c.qty, 0);
    count.textContent = items.length ? items.reduce((s, x) => s + x.c.qty, 0) + " поз." : "";
    if (!items.length) { box.innerHTML = '<p class="muted small">Пока пусто — добавьте что-нибудь из меню.</p>'; return; }
    let html = "";
    items.forEach((x) => {
      html += '<div class="cart-line"><span>' + esc(x.m.name) + ' × ' + x.c.qty + '</span><b>' + fmtKop(x.m.price * 100 * x.c.qty) + '</b></div>';
    });
    html += '<div class="cart-line total"><span>Итого</span><b>' + fmtKop(totalKop) + '</b></div>';
    html += '<label class="field">Телефон (для программы лояльности)<input type="text" id="g-phone" placeholder="+7 900 000-00-00"></label>';
    html += '<label class="chk"><input type="checkbox" id="g-consent" checked> Согласие на обработку персональных данных <span class="muted">(152-ФЗ)</span></label>';
    html += '<button class="btn primary wide" id="g-submit">Отправить заказ</button>';
    box.innerHTML = html;
    box.querySelector("#g-submit").addEventListener("click", () => {
      const phone = box.querySelector("#g-phone").value.trim();
      const consent = box.querySelector("#g-consent").checked;
      if (phone && !consent) { toast("Для заказа с телефоном нужно согласие на обработку данных", "err"); return; }
      const items = items2order(items);
      try {
        const o = S.createOrder(items, { channel: "miniapp", guest: phone ? { phone, consent } : null });
        cart = [];
        toast("Заказ №" + o.num + " отправлен на кассу");
        route();
      } catch (err) { toast(err.message, "err"); }
    });
  }
  function items2order(items) {
    return items.map((x) => ({ menuId: x.m.id, name: x.m.name, priceKop: Math.round(x.m.price * 100), qty: x.c.qty }));
  }

  function renderOrderStatus(o) {
    const steps = ["new", "accepted", "kitchen", "ready", "served"];
    const idx = steps.indexOf(o.status);
    let html = '<div class="card mt2 order-track"><div class="card-head"><b>Ваш заказ №' + o.num + '</b><span class="badge ' + ORDER_BADGE[o.status] + '">' + ORDER_LABEL[o.status] + '</span></div><ul class="tl">';
    steps.forEach((s, i) => {
      const done = idx >= i && o.status !== "cancelled";
      const nowStep = i === idx && o.status !== "cancelled";
      html += '<li class="' + (done ? "done" : "") + ' ' + (nowStep ? "now" : "") + '">' + ORDER_LABEL[s] + '</li>';
    });
    html += '</ul>';
    if (o.status === "cancelled") html += '<p class="err-t">Заказ отменён. Обратитесь к кассиру.</p>';
    html += '</div>';
    return html;
  }

  // ---------- Экран «Касса» ----------
  function renderPos(main) {
    const st = S.getState();
    const shift = st.shift;
    let html = '<div class="card mb shift-bar"><div class="card-head"><b>Смена</b>';
    if (shift) {
      html += '<span>открыта в ' + timeShort(shift.openedAt) + ' · ' + shift.count + ' чеков · <b>' + fmtKop(shift.totalKop) + '</b></span>' +
        '<button class="btn small warn" id="p-close-shift">Закрыть смену (Z-отчёт)</button>';
    } else {
      html += '<span class="muted">не открыта — чеки пробить нельзя</span><button class="btn small primary" id="p-open-shift">Открыть смену</button>';
    }
    html += '</div></div>';

    const cols = [
      { key: "new", title: "Новые заказы", filter: (o) => o.status === "new" },
      { key: "cooking", title: "В работе", filter: (o) => o.status === "accepted" || o.status === "kitchen" },
      { key: "ready", title: "Готовы / оплата", filter: (o) => o.status === "ready" || (o.status === "served" && !o.paidAt) }
    ];
    html += '<div class="grid cols-3">';
    cols.forEach((col) => {
      const list = st.orders.filter(col.filter).slice(0, 8);
      html += '<div class="card pad0 queue"><h3 class="q-title">' + col.title + ' <span class="badge gray">' + list.length + '</span></h3>';
      if (!list.length) html += '<p class="muted small q-empty">пусто</p>';
      list.forEach((o) => { html += renderOrderCard(o); });
      html += '</div>';
    });
    html += '</div>';

    html += '<div class="card mt2"><div class="card-head"><b>Чеки за смену</b><span class="muted small">' + st.receipts.length + ' всего</span></div>' +
      '<table class="tbl"><thead><tr><th>ФД</th><th>Время</th><th>Заказ</th><th>Сумма</th><th>Оплата</th><th>ОФД</th></tr></thead><tbody>';
    st.receipts.slice(0, 8).forEach((r) => {
      html += '<tr><td>№' + r.fd + '</td><td>' + dtFull(r.createdAt) + '</td><td>№' + r.orderNum + '</td><td><b>' + fmtKop(r.totalKop) + '</b></td><td>' +
        (r.payMethod === "card" ? "карта" : "наличные") + '</td><td>' +
        (r.ofd === "ok" ? '<span class="badge ok">в ФНС</span>' : '<span class="badge warn">идёт в ОФД…</span>') + '</td></tr>';
    });
    html += '</tbody></table></div>';

    main.innerHTML = html;
    const openB = main.querySelector("#p-open-shift");
    if (openB) openB.addEventListener("click", () => { try { S.openShift(); toast("Смена открыта"); } catch (e) { toast(e.message, "err"); } });
    const closeB = main.querySelector("#p-close-shift");
    if (closeB) closeB.addEventListener("click", () => {
      try { const z = S.closeShift(); toast("Z-отчёт: " + z.count + " чеков на " + fmtKop(z.totalKop)); } catch (e) { toast(e.message, "err"); }
    });

    main.querySelectorAll("[data-accept]").forEach((b) => b.addEventListener("click", () => {
      S.moveOrder(b.dataset.accept, "accepted"); S.moveOrder(b.dataset.accept, "kitchen"); toast("Заказ принят и ушёл на кухню");
    }));
    main.querySelectorAll("[data-ready]").forEach((b) => b.addEventListener("click", () => { S.moveOrder(b.dataset.ready, "ready"); toast("Заказ готов"); }));
    main.querySelectorAll("[data-serve]").forEach((b) => b.addEventListener("click", () => { S.moveOrder(b.dataset.serve, "served"); toast("Выдано гостю"); }));
    main.querySelectorAll("[data-cancel]").forEach((b) => b.addEventListener("click", () => { S.moveOrder(b.dataset.cancel, "cancelled"); }));
    main.querySelectorAll("[data-pay]").forEach((b) => b.addEventListener("click", async () => {
      const btn = b; btn.disabled = true; btn.textContent = "Авторизация…";
      try {
        const res = await S.payOrder(b.dataset.pay, b.dataset.method);
        if (res.ok) { toast("Оплата одобрена, чек пробит"); }
        else { toast("Отказ банка: код " + res.code + " («" + res.reason + "»). Предложите другой способ оплаты", "err"); btn.disabled = false; btn.textContent = b.dataset.method === "card" ? "Оплатить картой" : "Оплатить наличными"; }
      } catch (err) { toast(err.message, "err"); btn.disabled = false; }
    }));
    main.querySelectorAll("[data-show-receipt]").forEach((b) => b.addEventListener("click", () => {
      const r = st.receipts.find((x) => x.orderId === b.dataset.showReceipt);
      if (r) showReceiptModal(r);
    }));
  }

  function renderOrderCard(o) {
    let html = '<div class="ticket ' + (o.status === "ready" ? "ready" : "") + '"><div class="t-head"><span>№' + o.num + '</span><span class="badge ' + ORDER_BADGE[o.status] + '">' + ORDER_LABEL[o.status] + '</span></div>';
    html += '<ul>' + o.items.map((i) => '<li>' + esc(i.name) + ' × ' + i.qty + '</li>').join("") + '</ul>';
    html += '<div class="t-foot"><span class="muted small">' + timeShort(o.createdAt) + ' · ' + (o.channel === "pos" ? "касса" : "приложение") + '</span><b>' + fmtKop(o.totalKop) + '</b></div>';
    html += '<div class="t-actions">';
    if (o.status === "new") html += '<button class="btn small primary" data-accept="' + o.id + '">Принять</button><button class="btn small" data-cancel="' + o.id + '">Отмена</button>';
    if (o.status === "kitchen" || o.status === "accepted") html += '<button class="btn small ok" data-ready="' + o.id + '">Готово</button>';
    if (o.status === "ready") html += '<button class="btn small" data-serve="' + o.id + '">Выдать</button>';
    if ((o.status === "ready" || o.status === "served") && !o.paidAt) {
      html += '<button class="btn small primary" data-pay="' + o.id + '" data-method="card">Оплатить картой</button>' +
        '<button class="btn small" data-pay="' + o.id + '" data-method="cash">Наличными</button>';
    }
    if (o.paidAt) html += '<span class="badge ok">оплачен</span> <button class="btn small" data-show-receipt="' + o.id + '">Чек</button>';
    html += '</div></div>';
    return html;
  }

  function showReceiptModal(r) {
    const st = S.getState();
    const ov = document.getElementById("receipt-modal");
    let txt = '';
    txt += pad(st.settings.orgName, 32) + '\n';
    txt += pad(st.settings.locationName, 32) + '\n';
    txt += 'ИНН ' + st.settings.inn + '\n\n';
    txt += 'КАССОВЫЙ ЧЕК  ПРИХОД  (ФФД 1.2)\n';
    txt += 'Смена ' + r.shiftId + '  Чек №' + r.fd + '\n';
    txt += dtFull(r.createdAt) + '\n\n';
    r.items.forEach((i) => {
      txt += left(i.name + ' x' + i.qty, 24) + right(fmtKop(i.sumKop), 8) + '\n';
    });
    txt += '--------------------------------\n';
    txt += left('ИТОГО', 24) + right(fmtKop(r.totalKop), 8) + '\n';
    txt += left('Оплата: ' + (r.payMethod === "card" ? 'карта' : 'наличные'), 24) + right(fmtKop(r.totalKop), 8) + '\n';
    txt += left(st.settings.tax, 32) + '\n\n';
    txt += 'ФН ' + r.fn + '\nФД ' + r.fd + '  ФП ' + r.fp + '\n';
    txt += (r.ofd === "ok" ? 'ОФД: передан в ФНС' : 'ОФД: ожидает подтверждения') + '\n';
    ov.innerHTML = '<div class="rm-body"><pre class="receipt">' + esc(txt) + '</pre><button class="btn primary wide" id="rm-close">Закрыть</button></div>';
    ov.classList.add("show");
    ov.querySelector("#rm-close").addEventListener("click", () => ov.classList.remove("show"));
  }
  function pad(s, n) { s = String(s); return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length); }
  function left(s, n) { s = String(s).slice(0, n); return s; }
  function right(s, n) { s = String(s); return " ".repeat(Math.max(0, n - s.length)) + s; }

  // ---------- Экран «Бизнес» ----------
  function renderBiz(main) {
    const st = S.getState();
    const stats = S.todayStats();
    let html = '<div class="grid cols-4 mb">';
    html += kpi("Выручка сегодня", fmtKop(stats.revenueKop), stats.receipts + " чеков");
    html += kpi("Средний чек", stats.receipts ? fmtKop(stats.avgKop) : "—", stats.receipts + " оплат");
    html += kpi("Заказов сегодня", String(stats.ordersToday), "все каналы");
    html += kpi("Отказов оплаты", String(stats.declined), "код 51 мок-банка");
    html += '</div>';

    html += '<div class="grid cols-2 mb"><div class="card"><div class="card-head"><b>Заказы по каналам сегодня</b></div>';
    const chans = Object.keys(stats.byChannel);
    if (!chans.length) html += '<p class="muted small">Заказов пока нет.</p>';
    else {
      const max = Math.max.apply(null, chans.map((c) => stats.byChannel[c]));
      chans.forEach((c) => {
        html += '<div class="bar-line"><span class="bl-name">' + channelName(c) + '</span>' +
          '<span class="bar"><i style="width:' + Math.round(stats.byChannel[c] / max * 100) + '%"></i></span>' +
          '<b>' + stats.byChannel[c] + '</b></div>';
      });
    }
    html += '</div><div class="card"><div class="card-head"><b>События (шина пилота)</b></div><div class="evlist">';
    st.events.slice(0, 9).forEach((e) => {
      html += '<div class="ev"><span class="muted small">' + timeShort(e.ts) + '</span> ' + esc(e.text) + '</div>';
    });
    if (!st.events.length) html += '<p class="muted small">Журнал пуст.</p>';
    html += '</div></div></div>';

    html += '<div class="card mb"><div class="card-head"><b>Меню и стоп-лист</b><span class="muted small">цены и наличие видны гостю мгновенно</span></div>' +
      '<table class="tbl"><thead><tr><th>Позиция</th><th>Категория</th><th>Цена, ₽</th><th>Статус</th></tr></thead><tbody>';
    st.menu.forEach((m) => {
      html += '<tr><td>' + esc(m.name) + '</td><td class="muted">' + esc(m.cat) + '</td>' +
        '<td><input type="number" class="price-in" data-price="' + m.id + '" value="' + m.price + '" step="1" min="0"></td>' +
        '<td>' + (m.stop
          ? '<span class="badge err">стоп-лист</span> <button class="btn small ok" data-stop-off="' + m.id + '">В продажу</button>'
          : '<span class="badge ok">в продаже</span> <button class="btn small warn" data-stop-on="' + m.id + '">В стоп</button>') + '</td></tr>';
    });
    html += '</tbody></table></div>';

    html += '<div class="grid cols-2"><div class="card"><div class="card-head"><b>Настройки точки</b></div>' +
      '<label class="field">Название точки<input type="text" id="b-name" value="' + esc(st.settings.locationName) + '"></label>' +
      '<label class="field">Организация<input type="text" id="b-org" value="' + esc(st.settings.orgName) + '"></label>' +
      '<label class="field">Режим налогообложения на чеке<input type="text" id="b-tax" value="' + esc(st.settings.tax) + '"></label>' +
      '<button class="btn primary" id="b-save">Сохранить</button></div>' +
      '<div class="card"><div class="card-head"><b>Смены (закрытые)</b></div><table class="tbl"><thead><tr><th>Открыта</th><th>Закрыта</th><th>Чеков</th><th>Итог</th></tr></thead><tbody>';
    (st.closedShifts || []).slice(0, 5).forEach((z) => {
      html += '<tr><td>' + dtFull(z.openedAt) + '</td><td>' + dtFull(z.closedAt) + '</td><td>' + z.count + '</td><td><b>' + fmtKop(z.totalKop) + '</b></td></tr>';
    });
    html += '</tbody></table><p class="small muted mt">Пилотные данные хранятся в браузере. <button class="btn small" id="b-reset">Сбросить пилот</button></p></div></div>';

    main.innerHTML = html;
    main.querySelectorAll("[data-stop-on]").forEach((b) => b.addEventListener("click", () => S.setStop(b.dataset.stopOn, true)));
    main.querySelectorAll("[data-stop-off]").forEach((b) => b.addEventListener("click", () => S.setStop(b.dataset.stopOff, false)));
    main.querySelectorAll("[data-price]").forEach((inp) => inp.addEventListener("change", () => {
      const v = parseFloat(inp.value);
      if (!isNaN(v) && v >= 0) S.setPrice(inp.dataset.price, v);
    }));
    main.querySelector("#b-save").addEventListener("click", () => {
      S.setSettings({
        locationName: main.querySelector("#b-name").value.trim() || st.settings.locationName,
        orgName: main.querySelector("#b-org").value.trim() || st.settings.orgName,
        tax: main.querySelector("#b-tax").value.trim() || st.settings.tax
      });
      document.getElementById("tb-location").textContent = S.getState().settings.locationName;
      toast("Настройки сохранены");
    });
    main.querySelector("#b-reset").addEventListener("click", () => {
      if (window.confirm("Сбросить пилот к исходным данным? Все заказы и чеки будут удалены.")) S.resetDemo();
    });
  }
  function kpi(label, value, sub) {
    return '<div class="card kpi"><span class="d">' + label + '</span><span class="v">' + value + '</span><span class="d">' + sub + '</span></div>';
  }
  function channelName(c) {
    return { miniapp: "Приложение гостя", pos: "Касса", site: "Сайт", phone: "Телефон" }[c] || c;
  }

  // ---------- Запуск ----------
  function boot() {
    document.body.insertAdjacentHTML("beforeend", '<div id="receipt-modal"></div>');
    buildShell();
    window.addEventListener("hashchange", route);
    S.subscribe(() => {
      const tab = (location.hash || "#/guest").replace("#/", "");
      const loc = document.getElementById("tb-location");
      if (loc) loc.textContent = S.getState().settings.locationName;
      if (tab === "guest") renderGuest(document.getElementById("main"));
      if (tab === "pos") renderPos(document.getElementById("main"));
      if (tab === "biz") renderBiz(document.getElementById("main"));
    });
    route();
  }
  document.addEventListener("DOMContentLoaded", boot);
})();
