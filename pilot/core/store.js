/* lovii pilot — событийное хранилище (единый источник истины среза).
   Дизайн по корпусу: журнал событий — шина; статусы — канонический словарь
   (12-data-model, §0); чек — реквизиты ФФД 1.2; отказы банка — контракт моков
   (инфраструктура, §7: сумма кратна 997 ₽ → код 51).
   Хранение: localStorage + BroadcastChannel (синхронные вкладки одного
   устройства). Для запуска на нескольких устройствах сюда подставляется
   сетевой адаптер с тем же интерфейсом — контракт не меняется. */
window.PilotStore = (function () {
  const KEY = "lovii.pilot.v1";
  const CHANNEL = "lovii-pilot-sync";
  const FN = "9960440301234567"; // номер ФН пилотной кассы (эмуляция)

  const MENU_SEED = [
    { id: "m1",  name: "Ролл Филадельфия",   cat: "Роллы",    price: 429, cookMin: 12, stop: false },
    { id: "m2",  name: "Ролл Калифорния",    cat: "Роллы",    price: 389, cookMin: 10, stop: false },
    { id: "m3",  name: "Запечённый ролл",    cat: "Роллы",    price: 449, cookMin: 14, stop: false },
    { id: "m4",  name: "Пицца Маргарита",    cat: "Горячее",  price: 459, cookMin: 15, stop: false },
    { id: "m5",  name: "Пицца Пепперони",    cat: "Горячее",  price: 529, cookMin: 15, stop: false },
    { id: "m6",  name: "Вок с курицей",      cat: "Горячее",  price: 379, cookMin: 12, stop: false },
    { id: "m7",  name: "Салат Цезарь",       cat: "Салаты",   price: 349, cookMin: 8,  stop: false },
    { id: "m8",  name: "Том Ям с креветкой", cat: "Супы",     price: 419, cookMin: 10, stop: false },
    { id: "m9",  name: "Кофе капучино",      cat: "Напитки",  price: 189, cookMin: 3,  stop: false },
    { id: "m10", name: "Морс клюквенный",    cat: "Напитки",  price: 129, cookMin: 2,  stop: false },
    { id: "m11", name: "Чизкейк Нью-Йорк",   cat: "Десерты",  price: 259, cookMin: 3,  stop: false },
    { id: "m12", name: "Картофель фри",      cat: "Гарниры",  price: 149, cookMin: 6,  stop: false }
  ];

  function seed() {
    return {
      v: 1,
      settings: {
        locationName: "Пилотная точка «Центральная»",
        orgName: "ООО «Фуд Восток»",
        inn: "4345123456",
        tax: "УСН (без НДС)",
        cashier: "Кассир смены"
      },
      menu: JSON.parse(JSON.stringify(MENU_SEED)),
      orders: [],
      receipts: [],
      shift: null,
      seq: { orderNum: 1000, fd: 0 },
      events: []
    };
  }

  let state = load();
  const subs = new Set();
  let chan = null;
  try {
    if ("BroadcastChannel" in window) {
      chan = new BroadcastChannel(CHANNEL);
      chan.onmessage = (e) => {
        if (e && e.data && e.data.type === "pilot-sync") {
          state = e.data.state;
          save(false);
          emit();
        }
      };
    }
  } catch (err) { /* среда без BroadcastChannel — работаем в одной вкладке */ }

  function load() {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return seed();
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.v !== 1) return seed();
      return parsed;
    } catch (err) {
      return seed();
    }
  }

  function save(broadcast) {
    try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch (err) { /* квота */ }
    if (broadcast !== false && chan) {
      try { chan.postMessage({ type: "pilot-sync", state }); } catch (err) { /* clone error */ }
    }
  }

  function emit() { subs.forEach((fn) => { try { fn(); } catch (err) { console.error(err); } }); }

  function now() { return new Date().toISOString(); }

  function log(type, text) {
    state.events.unshift({ ts: now(), type, text });
    if (state.events.length > 300) state.events.length = 300;
  }

  function money(kop) { return (kop / 100).toFixed(2); }
  function fmtRub(kop) {
    return (kop / 100).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₽";
  }

  function commit() { save(); emit(); }

  // ---------- Действия (контракт = спецификация 03, срез пилота) ----------

  function createOrder(items, opts) {
    if (!items || !items.length) throw new Error("Корзина пуста");
    const num = ++state.seq.orderNum;
    const order = {
      id: "ord_" + num + "_" + Math.random().toString(36).slice(2, 8),
      num,
      channel: (opts && opts.channel) || "miniapp",
      status: "new",
      items,                       // [{menuId, name, priceKop, qty}]
      totalKop: items.reduce((s, i) => s + i.priceKop * i.qty, 0),
      guest: (opts && opts.guest) || null, // {phone, consent}
      createdAt: now(),
      history: [{ status: "new", ts: now() }]
    };
    state.orders.unshift(order);
    log("order.created", "Заказ №" + num + " из канала «" + order.channel + "» на " + fmtRub(order.totalKop));
    commit();
    return order;
  }

  function moveOrder(id, status) {
    const o = state.orders.find((x) => x.id === id);
    if (!o) throw new Error("Заказ не найден");
    o.status = status;
    o.history.push({ status, ts: now() });
    const labels = {
      accepted: "принят", kitchen: "на кухне", ready: "готов",
      served: "выдан гостю", cancelled: "отменён"
    };
    log("order.status", "Заказ №" + o.num + ": " + (labels[status] || status));
    commit();
    return o;
  }

  // Оплата: мок-банк по контракту инфраструктуры §7.
  // Возвращает промис: {ok} или {ok:false, code, reason}.
  function payOrder(id, method) {
    const o = state.orders.find((x) => x.id === id);
    if (!o) return Promise.reject(new Error("Заказ не найден"));
    if (o.paidAt) return Promise.resolve({ ok: true, already: true });
    if (!state.shift) return Promise.reject(new Error("Кассовая смена не открыта — чек пробить нельзя"));
    const rub = o.totalKop / 100;
    return new Promise((resolve) => {
      window.setTimeout(() => {
        if (method === "card" && rub > 0 && Math.round(rub) % 997 === 0) {
          log("payment.declined", "Заказ №" + o.num + ": отказ банка, код 51 (недостаточно средств)");
          commit();
          resolve({ ok: false, code: 51, reason: "Недостаточно средств" });
          return;
        }
        o.paidAt = now();
        o.payMethod = method;
        const r = issueReceipt(o, method);
        log("payment.approved", "Заказ №" + o.num + ": оплата («" + (method === "card" ? "карта" : "наличные") + "»), чек №" + r.fd);
        commit();
        resolve({ ok: true, receipt: r });
      }, 700); // авторизация ~0,7 с — как в мок-контракте
    });
  }

  function issueReceipt(o, method) {
    const fd = ++state.seq.fd;
    const fp = String(Math.floor(1000000000 + Math.random() * 9000000000));
    const r = {
      id: "rcp_" + fd,
      fd, fn: FN, fp,
      shiftId: state.shift.id,
      orderNum: o.num,
      orderId: o.id,
      items: o.items.map((i) => ({ name: i.name, qty: i.qty, priceKop: i.priceKop, sumKop: i.priceKop * i.qty })),
      totalKop: o.totalKop,
      payMethod: method,
      tax: state.settings.tax,
      createdAt: now(),
      ofd: "pending"
    };
    state.receipts.unshift(r);
    if (state.shift) {
      state.shift.count += 1;
      state.shift.totalKop += o.totalKop;
      if (method === "card") state.shift.cardKop += o.totalKop; else state.shift.cashKop += o.totalKop;
    }
    // мок-ОФД: подтверждение приёма фискального документа через 2–4 с
    const delay = 2000 + Math.random() * 2000;
    window.setTimeout(() => {
      const rec = state.receipts.find((x) => x.id === r.id);
      if (rec && rec.ofd === "pending") {
        rec.ofd = "ok";
        log("ofd.confirmed", "Чек №" + rec.fd + " подтверждён ОФД (ушёл в ФНС)");
        commit();
      }
    }, delay);
    return r;
  }

  function openShift() {
    if (state.shift) throw new Error("Смена уже открыта");
    state.shift = {
      id: "sh_" + Date.now(),
      openedAt: now(),
      count: 0, totalKop: 0, cardKop: 0, cashKop: 0
    };
    log("shift.opened", "Кассовая смена открыта");
    commit();
    return state.shift;
  }

  function closeShift() {
    if (!state.shift) throw new Error("Смена не открыта");
    const s = state.shift;
    s.closedAt = now();
    const z = { id: s.id, openedAt: s.openedAt, closedAt: s.closedAt, count: s.count, totalKop: s.totalKop, cardKop: s.cardKop, cashKop: s.cashKop };
    state.closedShifts = state.closedShifts || [];
    state.closedShifts.unshift(z);
    state.shift = null;
    log("shift.closed", "Z-отчёт: " + z.count + " чеков на " + fmtRub(z.totalKop));
    commit();
    return z;
  }

  function setStop(menuId, stop) {
    const m = state.menu.find((x) => x.id === menuId);
    if (!m) return;
    m.stop = !!stop;
    log("menu.stop", m.name + (stop ? " — в стоп-листе" : " — снова в продаже"));
    commit();
  }

  function setPrice(menuId, priceRub) {
    const m = state.menu.find((x) => x.id === menuId);
    if (!m) return;
    m.price = Math.round(priceRub * 100) / 100;
    log("menu.price", m.name + ": новая цена " + m.price.toLocaleString("ru-RU") + " ₽");
    commit();
  }

  function setSettings(patch) {
    Object.assign(state.settings, patch || {});
    log("settings.updated", "Обновлены настройки точки");
    commit();
  }

  function resetDemo() {
    state = seed();
    log("system.reset", "Пилот сброшен к исходным данным");
    commit();
  }

  // ---------- Чтение ----------

  function getState() { return state; }

  function menuAvailable() { return state.menu.filter((m) => !m.stop); }

  function todayReceipts() {
    const d = new Date().toDateString();
    return state.receipts.filter((r) => new Date(r.createdAt).toDateString() === d);
  }

  function todayStats() {
    const rs = todayReceipts();
    const totalKop = rs.reduce((s, r) => s + r.totalKop, 0);
    const ordersToday = state.orders.filter((o) => new Date(o.createdAt).toDateString() === d2str());
    const byChannel = {};
    ordersToday.forEach((o) => { byChannel[o.channel] = (byChannel[o.channel] || 0) + 1; });
    return {
      revenueKop: totalKop,
      receipts: rs.length,
      avgKop: rs.length ? Math.round(totalKop / rs.length) : 0,
      declined: state.events.filter((e) => e.type === "payment.declined" && new Date(e.ts).toDateString() === d2str()).length,
      byChannel,
      ordersToday: ordersToday.length
    };
  }
  function d2str() { return new Date().toDateString(); }

  function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }

  return {
    getState, subscribe, createOrder, moveOrder, payOrder,
    openShift, closeShift, setStop, setPrice, setSettings, resetDemo,
    menuAvailable, todayStats, todayReceipts,
    fmtRub, money
  };
})();
