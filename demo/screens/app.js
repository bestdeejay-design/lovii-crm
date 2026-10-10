/* lovii demo — app.lovii.ru: гостевой контур */
(function () {
  "use strict";
  const { state, fmt, esc, route, UI, toast, emit, MockBank, MockKKT } = window.LOVII;

  function cartSum() { return state.cart.reduce((s, c) => s + c.price * c.qty, 0); }
  function cartCount() { return state.cart.reduce((s, c) => s + c.qty, 0); }
  function addToCart(m) {
    const ex = state.cart.find((c) => c.id === m.id);
    if (ex) ex.qty++; else state.cart.push({ id: m.id, name: m.name, price: m.price, qty: 1 });
    emit("ПЛАТФОРМА", "Гость: в корзину добавлено «" + m.name + "»", "info");
    toast("Добавлено: " + m.name);
  }

  // ---------- Витрина ----------
  route("app/shop", (el) => {
    const stop = new Set(DS.stopList.map((m) => m.id));
    el.innerHTML =
      "<h1>🍣 Ловии Суши — доставка и самовывоз</h1>" +
      '<p class="muted">Меню синхронизировано со всеми каналами; стоп-лист точки применяется мгновенно. ' +
      'Рабочий прототип гостевого контура живёт на <a href="http://lovii.mobiap.com" target="_blank" rel="noopener">lovii.mobiap.com</a>.</p>' +
      '<div class="rowline mb" id="cat-filter"></div>' +
      '<div class="grid cols-3" id="menu-grid"></div>' +
      '<div class="card mt2" id="cart-card"></div>';

    const cf = document.getElementById("cat-filter");
    cf.innerHTML = '<button class="btn small primary" data-c="all">Все</button>' +
      DS.cats.map((c) => '<button class="btn small" data-c="' + c.id + '">' + c.name + "</button>").join("");

    function grid(cat) {
      const items = DS.menu.filter((m) => (cat === "all" || m.cat === cat));
      document.getElementById("menu-grid").innerHTML = items.map((m) =>
        '<div class="card"><div class="rowline"><b>' + esc(m.name) + '</b><span class="spacer"></span>' +
        (m.hit ? UI.badge("хит", "warn") : "") + (stop.has(m.id) ? UI.badge("стоп-лист", "err") : "") +
        '</div><div class="small muted">' + m.catName + (stop.has(m.id) ? "" : " · ~" + Math.round(m.prepNormSec / 60) + " мин") +
        '</div><div class="rowline mt"><b>' + fmt.money(m.price) + '</b><span class="spacer"></span>' +
        (stop.has(m.id) ? '<button class="btn small" disabled>Недоступно</button>' :
          '<button class="btn small primary" data-add="' + m.id + '">В корзину</button>') +
        "</div></div>").join("");
      document.querySelectorAll("[data-add]").forEach((b) =>
        b.addEventListener("click", () => { addToCart(DS.menu.find((m) => m.id === b.dataset.add)); drawCart(); }));
    }
    cf.querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => {
        cf.querySelectorAll("button").forEach((x) => x.classList.remove("primary"));
        b.classList.add("primary");
        grid(b.dataset.c);
      }));
    grid("all");

    function drawCart() {
      const cc = document.getElementById("cart-card");
      if (!state.cart.length) {
        cc.innerHTML = "<h3>🛒 Корзина</h3><p class='muted'>Пока пусто — добавьте что-нибудь с витрины.</p>";
        return;
      }
      const bonuses = Math.floor(cartSum() * 0.05);
      cc.innerHTML = "<h3>🛒 Корзина · " + cartCount() + " шт</h3>" +
        UI.table([{ k: "n", t: "Позиция" }, { k: "q", t: "Кол-во", right: 1 }, { k: "s", t: "Сумма", right: 1 }],
          state.cart.map((c) => ({
            cells: {
              n: esc(c.name) + ' <button class="btn small" data-rm="' + c.id + '">убрать</button>',
              q: c.qty, s: fmt.money(c.price * c.qty)
            }
          }))) +
        '<div class="rowline mt"><div class="muted small">Начислим бонусы: <b>+' + bonuses + '</b> · Оплата: ' +
        '<select id="pay-method"><option>Карта</option><option>СБП</option><option>Бонусы+карта</option></select></div>' +
        '<span class="spacer"></span><b>' + fmt.money(cartSum()) + '</b> ' +
        '<button class="btn primary" id="checkout">Оплатить</button></div>' +
        '<div id="checkout-log" class="mt"></div>';
      cc.querySelectorAll("[data-rm]").forEach((b) =>
        b.addEventListener("click", () => { state.cart = state.cart.filter((c) => c.id !== b.dataset.rm); drawCart(); }));
      document.getElementById("checkout").addEventListener("click", checkout);
    }

    function checkout() {
      const method = document.getElementById("pay-method").value;
      const log = document.getElementById("checkout-log");
      const btn = document.getElementById("checkout");
      btn.disabled = true;
      const sum = cartSum();
      log.innerHTML = UI.badge("БАНК: авторизация…", "info");
      MockBank.authorize({ method, sum }).then((res) => {
        if (!res.ok) {
          log.innerHTML = UI.badge("БАНК: отказ — " + res.reason, "err") +
            ' <button class="btn small" onclick="location.reload()">Попробовать снова</button>';
          btn.disabled = false;
          return;
        }
        const order = {
          id: "ORD-NEW-" + (state.myOrders.length + 1), sum,
          items: state.cart.map((c) => ({ name: c.name, qty: c.qty, price: c.price })),
          pay: method, ts: Date.now(), status: "Принят"
        };
        const rec = MockKKT.printReceipt(order);
        state.myOrders.unshift(order);
        emit("ПЛАТФОРМА", "Заказ " + order.id + " создан из витрины: " + fmt.money(sum) + ", канал «Сайт»", "ok");
        state.cart = [];
        drawCart(); // корзина снова пуста
        const cc = document.getElementById("cart-card");
        cc.innerHTML +=
          '<div class="receipt" id="checkout-log">ООО «ФУД ВОСТОК»\nЛовии Суши · Центральный\nЧек прихода №' + rec.num +
          "  ФД " + rec.fd + "\n" + order.items.map((i) => i.name + " x" + i.qty + "  " + fmt.money(i.price * i.qty)).join("\n") +
          "\nИТОГО  " + fmt.money(sum) + "\nОплата: " + method + "  RRN " + res.rrn + "\nФН " + rec.fn + "\nОФД: " + rec.ofd + "</div>" +
          '<p class="small muted">Статусы заказа и бонусы — в «Мои заказы» и «Профиль». Через секунду чек подтвердит ОФД.</p>';
        toast("Заказ оформлен! Чек уходит в ОФД…");
        btn.disabled = false;
      });
    }
    drawCart();
  });

  // ---------- Мои заказы ----------
  route("app/myorders", (el) => {
    const flow = ["Принят", "Готовится", "Упакован", "Курьер в пути", "Доставлен"];
    el.innerHTML = "<h1>📦 Мои заказы</h1><p class='muted'>Статусы приходят из единого журнала событий — те же, что видит кухня и диспетчер.</p><div id='list'></div>";
    const box = document.getElementById("list");
    if (!state.myOrders.length) {
      box.innerHTML = '<div class="card"><p class="muted">В этой демо-сессии заказов пока нет — оформите на витрине. История прошлых заказов гостя видна в профиле.</p></div>';
      return;
    }
    box.innerHTML = state.myOrders.map((o) => {
      const step = Math.min(flow.length - 1, Math.floor((Date.now() - o.ts) / 15000));
      if (flow[step] !== o.status) {
        o.status = flow[step];
        emit("ПЛАТФОРМА", "Статус " + o.id + ": " + o.status, "info");
      }
      return '<div class="card mb"><div class="rowline"><b>' + o.id + "</b>" + UI.badge(o.status, step === flow.length - 1 ? "ok" : "brand") +
        '<span class="spacer"></span><span class="muted small">' + fmt.t(o.ts) + " · " + o.pay + '</span><b>' + fmt.money(o.sum) + "</b></div>" +
        '<ul class="tl mt">' + flow.map((f, i) =>
          '<li class="' + (i < step ? "done" : i === step ? "now" : "") + '">' + f + "</li>").join("") + "</ul>" +
        (step === flow.length - 1 ? '<button class="btn small primary" data-rev="' + o.id + '">Оставить отзыв</button><div id="rev-' + o.id + '"></div>' : "") +
        "</div>";
    }).join("");
    box.querySelectorAll("[data-rev]").forEach((b) =>
      b.addEventListener("click", () => {
        document.getElementById("rev-" + b.dataset.rev).innerHTML =
          '<div class="rowline mt">Оценка: <select data-stars><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option></select>' +
          '<input type="text" placeholder="Комментарий" style="flex:1" data-comment><button class="btn small ok" data-send="' + b.dataset.rev + '">Отправить</button></div>';
        b.remove();
      }));
    box.querySelectorAll("[data-send]").forEach((b) =>
      b.addEventListener("click", () => {
        const wrap = b.closest(".rowline");
        const stars = +wrap.querySelector("[data-stars]").value;
        emit("ПЛАТФОРМА", "Отзыв на " + b.dataset.send + ": " + stars + "★ — привязан к заказу, смене и курьеру", stars >= 4 ? "ok" : "warn");
        toast("Спасибо! Отзыв привязан к заказу.");
        wrap.innerHTML = UI.badge("Отзыв принят ✓", "ok");
      }));
  });

  // ---------- Профиль ----------
  route("app/profile", (el) => {
    const g = DS.guests[41];
    const history = DS.orders.filter((o) => o.guest).slice(0, 8);
    el.innerHTML =
      "<h1>👤 Профиль гостя</h1>" +
      '<div class="grid cols-4">' +
      UI.kpi("Гость", esc(g.name), g.phone) +
      UI.kpi("Сегмент", UI.badge(g.seg, "brand"), "по RFM-модели") +
      UI.kpi("Бонусы", fmt.num(g.points + state.myOrders.reduce((s, o) => s + Math.floor(o.sum * 0.05), 0)), "начислено за сессию +" + state.myOrders.reduce((s, o) => s + Math.floor(o.sum * 0.05), 0), true) +
      UI.kpi("Визитов", g.visits, "за всё время", true) +
      "</div>" +
      '<div class="card mt2"><h3>История заказов (из общего журнала)</h3>' +
      UI.table(
        [{ k: "id", t: "Заказ" }, { k: "ts", t: "Когда" }, { k: "ch", t: "Канал" }, { k: "sum", t: "Сумма", right: 1 }],
        history.map((o) => ({
          cells: { id: o.id, ts: fmt.dt(o.ts), ch: o.channelName, sum: fmt.money(o.sum) }
        }))) + "</div>" +
      '<div class="card mt2"><h3>Согласия и ПДн (152-ФЗ)</h3><p class="small muted">Обработка персональных данных — по согласию от 12.08.2026; хранение на территории РФ; выгрузка и удаление по запросу доступны из этого экрана.</p>' +
      '<button class="btn small" id="export-gdpr">Запросить выгрузку данных</button> <button class="btn small" id="revoke">Отозвать согласие</button></div>';
    document.getElementById("export-gdpr").addEventListener("click", () => {
      emit("ПЛАТФОРМА", "Запрос выгрузки ПДн гостя " + g.id + " принят в работу (152-ФЗ)", "info");
      toast("Запрос зарегистрирован, ответ в течение 30 дней.");
    });
    document.getElementById("revoke").addEventListener("click", () => {
      emit("ПЛАТФОРМА", "Гость " + g.id + " отозвал согласие на обработку ПДн", "warn");
      toast("Согласие отозвано.");
    });
  });
})();
