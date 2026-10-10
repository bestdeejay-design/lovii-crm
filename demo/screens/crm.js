/* lovii demo — crm.lovii.ru: клиентский контур */
(function () {
  "use strict";
  const { state, fmt, esc, route, nav, UI, toast, emit, MockKKT, MockOFD } = window.LOVII;

  const locName = (id) => DS.locations.find((l) => l.id === id).name;
  const locOrders = () => DS.orders.filter((o) => o.loc === state.loc);

  // ---------- Очередь заказов ----------
  route("crm/queue", (el) => {
    const list = locOrders().slice(0, 40);
    el.innerHTML =
      "<h1>🧾 Очередь заказов — все каналы в одном окне</h1>" +
      '<p class="muted">Зал, сайт, приложение, агрегаторы и телефон — один контракт заказа. Точка: <b>' + locName(state.loc) + "</b></p>" +
      '<div class="grid cols-4 mb">' +
      UI.kpi("Заказов за 3 дня", fmt.num(list.length), "по этой точке") +
      UI.kpi("Средний чек", fmt.money(list.reduce((s, o) => s + o.sum, 0) / (list.length || 1))) +
      UI.kpi("Доля агрегаторов", Math.round(list.filter((o) => o.channel === "agg").length / (list.length || 1) * 100) + "%", "комиссия 29,17%", false) +
      UI.kpi("Опознано гостей", Math.round(list.filter((o) => o.guest).length / (list.length || 1) * 100) + "%", "цель ≥ 60%", true) +
      "</div>" +
      '<div class="card pad0"><table class="tbl" id="q-tbl"></table></div>' +
      '<div id="order-modal"></div>';

    const tbl = document.getElementById("q-tbl");
    tbl.innerHTML = "<tr><th>Заказ</th><th>Канал</th><th>Позиции</th><th class='right'>Сумма</th><th>Гость</th><th>Статус</th><th></th></tr>" +
      list.map((o) => {
        const g = o.guest ? DS.guests.find((x) => x.id === o.guest) : null;
        return "<tr><td><b>" + o.id + '</b><div class="small muted">' + fmt.dt(o.ts) + "</div></td>" +
          "<td>" + UI.badge(o.channelName, o.channel === "agg" ? "warn" : o.channel === "hall" ? "gray" : "info") + "</td>" +
          "<td class='small'>" + o.items.map((i) => i.name + " ×" + i.qty).join(", ") + "</td>" +
          "<td class='right'><b>" + fmt.money(o.sum) + "</b></td>" +
          "<td class='small'>" + (g ? esc(g.name) + "<div class='muted'>" + g.phone + "</div>" : '<span class="muted">не опознан</span>') + "</td>" +
          "<td>" + UI.badge(o.status, o.status === "Выполнен" ? "ok" : "brand") + "</td>" +
          '<td><button class="btn small" data-open="' + o.id + '">Открыть</button></td></tr>';
      }).join("");
    tbl.querySelectorAll("[data-open]").forEach((b) =>
      b.addEventListener("click", () => openOrder(b.dataset.open)));

    function openOrder(id) {
      const o = DS.orders.find((x) => x.id === id);
      const modal = document.getElementById("order-modal");
      modal.innerHTML =
        '<div class="card mt2" style="border:2px solid var(--brand)"><div class="rowline"><h3 style="margin:0">' + o.id + "</h3>" +
        UI.badge(o.channelName, "info") + UI.badge(o.delivery ? "Доставка" : "Зал", "gray") +
        '<span class="spacer"></span><button class="btn small" id="m-close">✕ Закрыть</button></div>' +
        UI.table([{ k: "n", t: "Позиция" }, { k: "q", t: "Кол-во", right: 1 }, { k: "p", t: "Цена", right: 1 }],
          o.items.map((i) => ({ cells: { n: esc(i.name), q: i.qty, p: fmt.money(i.price) } }))) +
        '<div class="rowline mt"><b>Итого: ' + fmt.money(o.sum) + "</b><span class='muted small'>Оплата: " + o.pay + "</span>" +
        '<span class="spacer"></span>' +
        '<button class="btn primary" id="m-fiscal">Пробить чек (мок ККТ)</button> ' +
        '<button class="btn warn" id="m-refund">Возврат</button></div>' +
        '<div id="m-log" class="mt"></div></div>';
      document.getElementById("m-close").addEventListener("click", () => { modal.innerHTML = ""; });
      document.getElementById("m-fiscal").addEventListener("click", () => {
        const rec = MockKKT.printReceipt(o);
        document.getElementById("m-log").innerHTML =
          UI.badge("ККТ: чек №" + rec.num + " в ФН", "ok") + " " + UI.badge("ОФД: " + rec.ofd + " (обновится через секунду)", "info");
        setTimeout(() => {
          document.getElementById("m-log").innerHTML =
            UI.badge("ККТ: чек №" + rec.num + " в ФН", "ok") + " " + UI.badge("ОФД: принят, передан в ФНС", "ok");
        }, 1400);
      });
      document.getElementById("m-refund").addEventListener("click", () => {
        emit("ПЛАТФОРМА", "Возврат по " + o.id + " на " + fmt.money(o.sum) + " — основание: ошибка кассира, права подтверждены", "warn");
        toast("Возврат оформлен.");
      });
      modal.scrollIntoView({ behavior: "smooth" });
    }
  });

  // ---------- Дашборд точки ----------
  route("crm/dashboard", (el) => {
    const daily = DS.dailyByLoc[state.loc];
    const today = daily[daily.length - 1];
    const yest = daily[daily.length - 2];
    const revs = locOrders();
    const chMix = DS.channels.map((c, i) => ({
      label: c.name, color: ["#7c3aed", "#2563eb", "#0ea5e9", "#f59e0b", "#94a3b8"][i],
      v: revs.filter((o) => o.channel === c.id).length
    })).filter((x) => x.v > 0);
    const locReviews = DS.reviews.filter((r) => r.loc === state.loc);
    const nps = Math.round((locReviews.filter((r) => r.rating >= 4).length - locReviews.filter((r) => r.rating <= 2).length) / locReviews.length * 100);
    el.innerHTML =
      "<h1>📊 Дашборд — " + locName(state.loc) + "</h1>" +
      '<p class="muted">Выручка — из фискальных данных, гости — из чеков, скорость — из кухни: всё из одного журнала событий.</p>' +
      '<div class="grid cols-4">' +
      UI.kpi("Выручка сегодня", fmt.money(today.revenue), (today.revenue >= yest.revenue ? "+" : "") + Math.round((today.revenue / yest.revenue - 1) * 100) + "% к вчера", today.revenue >= yest.revenue) +
      UI.kpi("Заказов сегодня", fmt.num(today.orders), "все каналы") +
      UI.kpi("NPS точки", nps, "цель ≥ 50", nps >= 50) +
      UI.kpi("Фудкост", DS.foodcostPct(state.loc) + "%", "цель ≤ 30%", DS.foodcostPct(state.loc) <= 30) +
      "</div>" +
      '<div class="grid cols-2 mt2">' +
      '<div class="card"><h3>Выручка за 30 дней</h3>' +
      UI.svgBars(daily.map((d) => ({ label: DS.fmtDay(d.ts), v: d.revenue, title: fmt.money(d.revenue) })), {}) + "</div>" +
      '<div class="card"><h3>Каналы заказов (3 дня)</h3><div class="rowline">' +
      UI.donut(chMix) + '<div style="flex:1">' + chMix.map((c) => '<div class="rowline small" style="gap:6px"><span style="width:10px;height:10px;border-radius:3px;background:' + c.color + ';display:inline-block"></span>' + c.label + '<span class="spacer"></span>' + c.v + "</div>").join("") + "</div></div></div>" +
      "</div>" +
      '<div class="card mt2"><h3>Топ блюд за 3 дня</h3>' +
      UI.barsH(topDishes(state.loc), null) + "</div>";
  });

  function topDishes(loc) {
    const cnt = {};
    DS.orders.filter((o) => o.loc === loc).forEach((o) => o.items.forEach((i) => { cnt[i.name] = (cnt[i.name] || 0) + i.qty; }));
    return Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 7)
      .map(([label, v]) => ({ label, v, text: v + " шт" }));
  }

  // ---------- Гости ----------
  route("crm/guests", (el) => {
    const seg = ["VIP", "Лояльный", "Регулярный", "Новый", "Спящий"];
    const counts = seg.map((s) => ({ s, n: DS.guests.filter((g) => g.seg === s).length }));
    el.innerHTML =
      "<h1>👥 Гости и сегменты</h1>" +
      '<p class="muted">Единый профиль склеен по телефону/карте из всех каналов: зал, сайт, агрегаторы. Всего в базе: <b>' + fmt.num(DS.guests.length) + "</b>.</p>" +
      '<div class="grid cols-4 mb">' + counts.slice(0, 4).map((c) => UI.kpi(c.s, fmt.num(c.n), "гостей")).join("") + "</div>" +
      '<div class="rowline mb"><input type="text" id="g-search" placeholder="Поиск по имени или телефону" style="min-width:280px">' +
      '<select id="g-seg"><option value="all">Все сегменты</option>' + seg.map((s) => "<option>" + s + "</option>").join("") + "</select></div>" +
      '<div id="g-list"></div>';
    function draw() {
      const q = document.getElementById("g-search").value.toLowerCase();
      const s = document.getElementById("g-seg").value;
      const rows = DS.guests.filter((g) => (s === "all" || g.seg === s) && (g.name.toLowerCase().includes(q) || g.phone.includes(q))).slice(0, 25);
      document.getElementById("g-list").innerHTML = UI.table(
        [{ k: "n", t: "Гость" }, { k: "p", t: "Телефон" }, { k: "s", t: "Сегмент" }, { k: "v", t: "Визиты", right: 1 }, { k: "t", t: "Потрачено", right: 1 }, { k: "b", t: "Бонусы", right: 1 }],
        rows.map((g) => ({
          cells: {
            n: esc(g.name), p: g.phone, s: UI.badge(g.seg, g.seg === "VIP" ? "warn" : g.seg === "Спящий" ? "err" : "brand"),
            v: g.visits, t: fmt.money(g.total), b: fmt.num(g.points)
          }
        })));
    }
    document.getElementById("g-search").addEventListener("input", draw);
    document.getElementById("g-seg").addEventListener("change", draw);
    draw();
  });

  // ---------- Кампании ----------
  route("crm/campaigns", (el) => {
    const camps = [
      { n: "Реактивация «Спящих»", trg: "не приходил 45+ дней", ch: "Пуш + СМС", res: "312 гостей, конверсия 11%", st: "Активна" },
      { n: "Именинники недели", trg: "день рождения ±3 дня", ch: "Мессенджер", res: "48 гостей, конверсия 24%", st: "Активна" },
      { n: "Вторая пицца −50%", trg: "сегмент «Регулярный», пятница", ch: "Пуш", res: "запущена вчера", st: "Активна" },
      { n: "Отзыв → бонус 300", trg: "оценка 1–2★ в течение 7 дней", ch: "Сервис-рекавери", res: "9 обращений, 7 возвращены", st: "Активна" }
    ];
    el.innerHTML =
      "<h1>🎯 Кампании и триггеры</h1>" +
      '<p class="muted">Сегменты строятся из журнала заказов (RFM), коммуникации уходят автоматически, результат — в отчёт канала.</p>' +
      UI.table(
        [{ k: "n", t: "Кампания" }, { k: "t", t: "Триггер" }, { k: "c", t: "Канал" }, { k: "r", t: "Результат" }, { k: "s", t: "Статус" }],
        camps.map((c) => ({ cells: { n: "<b>" + c.n + "</b>", t: c.trg, c: c.ch, r: c.r, s: UI.badge(c.st, "ok") } }))) +
      '<div class="card mt2"><h3>Новая кампания (демо-конструктор)</h3><div class="rowline">' +
      '<select><option>Сегмент: Спящие</option><option>Сегмент: Именинники</option><option>Сегмент: VIP</option></select>' +
      '<select><option>Канал: Пуш</option><option>Канал: СМС</option><option>Канал: Мессенджер</option></select>' +
      '<button class="btn primary" id="camp-create">Запустить</button></div></div>';
    document.getElementById("camp-create").addEventListener("click", () => {
      emit("ПЛАТФОРМА", "Кампания запущена: сегмент × канал, рассылка поставлена в очередь", "ok");
      toast("Кампания запущена.");
    });
  });

  // ---------- Стоп-лист ----------
  route("crm/stoplist", (el) => {
    el.innerHTML =
      "<h1>🚫 Стоп-лист</h1>" +
      '<p class="muted">Объявление с кухни мгновенно снимает блюдо со всех каналов: витрина, приложение, агрегаторы.</p>' +
      '<div class="card pad0"><table class="tbl" id="sl-tbl"></table></div>';
    function draw() {
      document.getElementById("sl-tbl").innerHTML = "<tr><th>Блюдо</th><th>Категория</th><th class='right'>Цена</th><th>Статус</th><th></th></tr>" +
        DS.menu.slice(0, 24).map((m) =>
          "<tr><td><b>" + esc(m.name) + "</b></td><td>" + m.catName + "</td><td class='right'>" + fmt.money(m.price) + "</td><td>" +
          (m.stop ? UI.badge("в стоп-листе", "err") : UI.badge("в продаже", "ok")) + "</td>" +
          '<td class="right"><button class="btn small ' + (m.stop ? "ok" : "warn") + '" data-t="' + m.id + '">' + (m.stop ? "Вернуть" : "В стоп-лист") + "</button></td></tr>").join("");
      document.querySelectorAll("[data-t]").forEach((b) =>
        b.addEventListener("click", () => {
          const m = DS.menu.find((x) => x.id === b.dataset.t);
          m.stop = !m.stop;
          emit("ПЛАТФОРМА", "Стоп-лист: «" + m.name + "» " + (m.stop ? "снят со всех каналов" : "возвращён в продажу"), m.stop ? "warn" : "ok");
          toast("Стоп-лист обновлён во всех каналах.");
          draw();
        }));
    }
    draw();
  });

  // ---------- Смена и чеки ----------
  route("crm/shift", (el) => {
    const sh = state.cashShift;
    el.innerHTML =
      "<h1>💰 Смена и чеки</h1>" +
      '<p class="muted">ККТ: ' + (sh.opened ? "смена открыта" : "смена не открыта") + " · ОФД-мониторинг активен.</p>" +
      '<div class="grid cols-3 mb">' +
      UI.kpi("Чеков в смене", sh.receipts.length, "пробито в демо") +
      UI.kpi("Выручка смены", fmt.money(sh.receipts.reduce((s, r) => s + r.sum, 0))) +
      UI.kpi("ОФД", sh.receipts.every((r) => r.ofd === "принят") && sh.receipts.length ? "все ушли ✓" : "есть в очереди", "", sh.receipts.every((r) => r.ofd === "принят")) +
      "</div>" +
      (!sh.opened ? '<button class="btn primary" id="open-shift">Открыть смену</button>' :
        UI.table(
          [{ k: "n", t: "Чек №" }, { k: "fd", t: "ФД" }, { k: "t", t: "Время" }, { k: "s", t: "Сумма", right: 1 }, { k: "o", t: "ОФД" }],
          sh.receipts.map((r) => ({
            cells: { n: r.num, fd: r.fd, t: fmt.t(r.ts), s: fmt.money(r.sum), o: UI.badge(r.ofd, r.ofd === "принят" ? "ok" : "warn") }
          })))) +
      '<div class="card mt2"><h3>Мониторинг «чеки не уходят»</h3>' +
      '<p class="small muted">По сети одна касса в зоне риска: ККТ 00004881 («Ловии Суши · Кировский») — 34 минуты без передачи.</p>' +
      '<button class="btn warn" id="ofd-alert">Симулировать алерт ОФД</button></div>';
    if (!sh.opened) document.getElementById("open-shift").addEventListener("click", () => {
      sh.opened = true;
      emit("ККТ", "Смена открыта: кассир " + (state.role === "cashier" ? "демо-пользователь" : "Ольга Петрова") + ", ККТ 00004512", "ok");
      nav("crm", "shift");
    });
    const al = document.getElementById("ofd-alert");
    if (al) al.addEventListener("click", () => { MockOFD.alert(); toast("Алерт отправлен владельцу и УК."); });
  });

  // ---------- Кабинет франчайзи ----------
  route("crm/franchisee", (el) => {
    const my = DS.locations.filter((l) => l.tenant === "fr1");
    const myRoy = DS.royalty.filter((r) => r.tenant === "fr1");
    el.innerHTML =
      "<h1>🤝 Кабинет франчайзи — ООО «Фуд Восток»</h1>" +
      '<p class="muted">Видны только свои точки по договору; данные УК — агрегированные бенчмарки.</p>' +
      '<div class="grid cols-4 mb">' +
      UI.kpi("Точек", my.length, "по договору №Ф-14 от 02.2026") +
      UI.kpi("Выручка 28 дней", fmt.money(myRoy.reduce((s, r) => s + r.revenue, 0))) +
      UI.kpi("Роялти к оплате", fmt.money(myRoy.reduce((s, r) => s + r.royalty + r.marketing, 0)), "5% + 2% маркетинг") +
      UI.kpi("Индекс стандарта", "87%", "по последним аудитам", true) +
      "</div>" +
      '<div class="card"><h3>Мои точки</h3>' +
      UI.barsH(my.map((l) => {
        const d = DS.dailyByLoc[l.id];
        const rev = d.slice(-28).reduce((s, x) => s + x.revenue, 0);
        return { label: l.name, v: rev, text: fmt.money(rev) };
      }), null) + "</div>" +
      '<div class="card mt2"><h3>Роялти за месяц</h3>' +
      UI.table(
        [{ k: "l", t: "Точка" }, { k: "r", t: "Выручка (фиск.)", right: 1 }, { k: "p", t: "Роялти 5%", right: 1 }, { k: "m", t: "Маркетинг 2%", right: 1 }, { k: "s", t: "Статус" }],
        myRoy.map((r) => ({
          cells: {
            l: locName(r.loc), r: fmt.money(r.revenue), p: fmt.money(r.royalty), m: fmt.money(r.marketing),
            s: r.paid ? UI.badge("оплачено", "ok") : '<button class="btn small primary" data-pay="' + r.loc + '">Оплатить</button>'
          }
        }))) + "</div>";
    el.querySelectorAll("[data-pay]").forEach((b) =>
      b.addEventListener("click", () => {
        DS.royalty.find((r) => r.loc === b.dataset.pay).paid = true;
        emit("БАНК", "Роялти оплачен: «" + locName(b.dataset.pay) + "»", "ok");
        toast("Оплата проведена.");
        nav("crm", "franchisee");
      }));
  });
})();
