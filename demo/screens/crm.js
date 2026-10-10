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

  // ---------- Отзывы и сервис-рекавери ----------
  route("crm/reviews", (el) => {
    const revs = DS.reviews;
    const avg = (revs.reduce((s, r) => s + r.rating, 0) / revs.length).toFixed(1);
    const neg = revs.filter((r) => r.rating <= 2);
    const nps = Math.round((revs.filter((r) => r.rating >= 4).length - neg.length) / revs.length * 100);
    el.innerHTML =
      "<h1>⭐ Отзывы и сервис-рекавери</h1>" +
      '<p class="muted">Все площадки в одной ленте: Яндекс, 2ГИС, приложение. Каждый отзыв привязан к заказу, смене и курьеру — есть с кого спросить и кому помочь.</p>' +
      '<div class="grid cols-4 mb">' +
      UI.kpi("Средняя оценка", avg + " ★", "за 30 дней") +
      UI.kpi("NPS", nps, "цель ≥ 50", nps >= 50) +
      UI.kpi("Негативных", neg.length, "требуют ответа за 24 ч", false) +
      UI.kpi("Закрыто рекавери", "7 из 9", "гостей возвращено", true) +
      "</div>" +
      '<div class="rowline mb">Фильтр: ' +
      '<select id="rev-filter"><option value="all">Все отзывы</option><option value="neg">Только негатив (1–2★)</option><option value="pos">Только позитив (4–5★)</option></select>' +
      '<select id="rev-loc"><option value="all">Все точки</option>' +
      DS.locations.filter((l) => l.type !== "Производство").map((l) => '<option value="' + l.id + '">' + l.name + "</option>").join("") + "</select></div>" +
      '<div id="rev-list"></div>';
    function draw() {
      const f = document.getElementById("rev-filter").value;
      const l = document.getElementById("rev-loc").value;
      const rows = revs.filter((r) =>
        (f === "all" || (f === "neg" ? r.rating <= 2 : r.rating >= 4)) &&
        (l === "all" || r.loc === l)).slice(0, 30);
      document.getElementById("rev-list").innerHTML = rows.map((r) =>
        '<div class="card mb" style="border-left:4px solid var(--' + (r.rating <= 2 ? "err" : r.rating === 3 ? "warn" : "ok") + ')">' +
        '<div class="rowline"><b>' + r.src + "</b> " + UI.stars(r.rating) +
        '<span class="spacer"></span><span class="small muted">' + locName(r.loc) + " · " + DS.fmtDay(r.ts) + "</span></div>" +
        '<div class="small mt">🍽 ' + esc(r.dish) + (r.courier ? ' · 🛵 ' + esc(r.courier) : "") + (r.order ? ' · ' + r.order : "") + "</div>" +
        '<div class="mt">' + esc(r.text) + "</div>" +
        '<div class="rowline mt">' +
        (r.answered ? UI.badge("ответ опубликован", "ok") :
          '<button class="btn small primary" data-ans="' + r.id + '">Ответить</button>') +
        (r.rating <= 2 && !r.recovery ? '<button class="btn small warn" data-rec="' + r.id + '">Сервис-рекавери</button>' : "") +
        (r.recovery ? UI.badge("рекавери: задача создана", "warn") : "") +
        "</div><div id='ans-" + r.id + "'></div></div>").join("");
      document.querySelectorAll("[data-ans]").forEach((b) =>
        b.addEventListener("click", () => {
          const box = document.getElementById("ans-" + b.dataset.ans);
          box.innerHTML = '<div class="rowline mt"><input type="text" style="flex:1" placeholder="Текст ответа гостю…" value="Спасибо за отзыв! Проработали смену, следующий заказ — комплимент от заведения.">' +
            '<button class="btn small ok" data-pub="' + b.dataset.ans + '">Опубликовать</button></div>';
          b.remove();
        }));
      document.querySelectorAll("[data-pub]").forEach((b) =>
        b.addEventListener("click", () => {
          const r = revs.find((x) => x.id === b.dataset.pub);
          r.answered = true;
          emit("ПЛАТФОРМА", "Ответ на отзыв " + r.src + " (" + r.rating + "★) опубликован, гость уведомлён", "ok");
          toast("Ответ опубликован.");
          draw();
        }));
      document.querySelectorAll("[data-rec]").forEach((b) =>
        b.addEventListener("click", () => {
          const r = revs.find((x) => x.id === b.dataset.rec);
          r.recovery = true;
          emit("ПЛАТФОРМА", "Сервис-рекавери по отзыву " + r.rating + "★: создана задача управляющему, бонус 300 ₽ гостю", "warn");
          toast("Задача сервис-рекавери создана.");
          draw();
        }));
    }
    document.getElementById("rev-filter").addEventListener("change", draw);
    document.getElementById("rev-loc").addEventListener("change", draw);
    draw();
  });

  // ---------- Задачи точки ----------
  route("crm/tasks", (el) => {
    const base = [];
    DS.audits.filter((a) => a.loc === state.loc).forEach((a) =>
      a.tasks.filter((t) => !t.done).forEach((t) =>
        base.push({ id: "T-" + base.length, src: "Аудит", title: t.title, due: "48 ч", sev: "warn", status: "Новая" })));
    DS.reviews.filter((r) => r.loc === state.loc && r.rating <= 2 && !r.recovery).slice(0, 2).forEach((r) =>
      base.push({ id: "T-" + base.length, src: "Отзыв", title: "Сервис-рекавери: отзыв " + r.rating + "★ по заказу " + r.order, due: "24 ч", sev: "err", status: "Новая" }));
    [
      { title: "Слепая инвентаризация по зонам (склад, холод)", src: "Регулярная", due: "3 дня", sev: "info" },
      { title: "Санитарный день: генеральная уборка цехов", src: "Регулярная", due: "5 дней", sev: "info" },
      { title: "ТО кассы: проверка ФН и чековой ленты", src: "Регулярная", due: "7 дней", sev: "info" }
    ].forEach((t) => base.push({ id: "T-" + base.length, src: t.src, title: t.title, due: t.due, sev: t.sev, status: "Новая" }));
    if (state.loc === "l3") base.push({ id: "T-" + base.length, src: "УК", title: "Тендер по лососю: запросить цены у двух альтернативных поставщиков", due: "просрочено", sev: "err", status: "Новая" });

    el.innerHTML =
      "<h1>✅ Задачи точки — " + locName(state.loc) + "</h1>" +
      '<p class="muted">Единый борд: аудиты, отзывы, поручения УК и регулярные работы. Источники задач видны — ничего не теряется между системами.</p>' +
      '<div class="grid cols-4 mb" id="task-kpis"></div>' +
      '<div class="card pad0"><table class="tbl" id="task-tbl"></table></div>';
    function draw() {
      const open = base.filter((t) => t.status !== "Выполнена");
      document.getElementById("task-kpis").innerHTML =
        UI.kpi("Открытых задач", open.length, "по этой точке") +
        UI.kpi("В работе", base.filter((t) => t.status === "В работе").length) +
        UI.kpi("Просрочено", base.filter((t) => t.due === "просрочено" && t.status !== "Выполнена").length, "контроль УК", false) +
        UI.kpi("Закрыто за неделю", "12", "среднее время 1,8 дня", true);
      document.getElementById("task-tbl").innerHTML =
        "<tr><th>Задача</th><th>Источник</th><th>Срок</th><th>Статус</th><th></th></tr>" +
        base.map((t, i) =>
          "<tr><td><b>" + t.title + "</b></td><td>" + UI.badge(t.src, t.src === "Аудит" ? "warn" : t.src === "Отзыв" ? "err" : t.src === "УК" ? "brand" : "gray") + "</td>" +
          "<td>" + (t.due === "просрочено" ? UI.badge("просрочено", "err") : '<span class="small">' + t.due + "</span>") + "</td>" +
          "<td>" + UI.badge(t.status, t.status === "Выполнена" ? "ok" : t.status === "В работе" ? "info" : "gray") + "</td>" +
          '<td class="right">' +
          (t.status === "Новая" ? '<button class="btn small" data-take="' + i + '">Взять в работу</button>' :
            t.status === "В работе" ? '<button class="btn small ok" data-done="' + i + '">Завершить</button>' : UI.badge("✓", "ok")) +
          "</td></tr>").join("");
      el.querySelectorAll("[data-take]").forEach((b) =>
        b.addEventListener("click", () => {
          base[+b.dataset.take].status = "В работе";
          emit("ПЛАТФОРМА", "Задача взята в работу: «" + base[+b.dataset.take].title + "»", "info");
          draw();
        }));
      el.querySelectorAll("[data-done]").forEach((b) =>
        b.addEventListener("click", () => {
          const t = base[+b.dataset.done];
          t.status = "Выполнена";
          emit("ПЛАТФОРМА", "Задача выполнена: «" + t.title + "» — УК видит закрытие в реальном времени", "ok");
          toast("Задача закрыта.");
          draw();
        }));
    }
    draw();
  });

  // ---------- Планирование смен ----------
  route("crm/schedule", (el) => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(DS.NOW + i * DS.DAY);
      const wd = d.getDay();
      const peak = wd === 5 || wd === 6 || wd === 0;
      days.push({
        label: ["вс", "пн", "вт", "ср", "чт", "пт", "сб"][wd] + " " + d.getDate(),
        peak,
        need: { hall: peak ? 3 : 2, kitchen: peak ? 4 : 3, delivery: peak ? 4 : 3 }
      });
    }
    const lines = [{ id: "hall", t: "Зал", staff: "Анна К., Виктор Л., Мария С., Тимур А." },
      { id: "kitchen", t: "Кухня", staff: "Дмитрий В., Ольга П., Ренат Х., Иван Ч." },
      { id: "delivery", t: "Доставка", staff: "5 курьеров на линии" }];
    const plan = {};
    days.forEach((d, di) => lines.forEach((l) => {
      const gap = (di === 3 && l.id === "kitchen") || (di === 5 && l.id === "delivery") ? 1 : 0;
      plan[di + "-" + l.id] = { have: d.need[l.id] - gap, filled: gap === 0 };
    }));
    const SHIFT_COST = 2400;
    el.innerHTML =
      "<h1>🗓 Планирование смен — " + locName(state.loc) + "</h1>" +
      '<p class="muted">Потребность считается из прогноза заказов; разрывы на пиковые дни подсвечены. ФОТ обновляется автоматически.</p>' +
      '<div class="grid cols-4 mb" id="sch-kpis"></div>' +
      '<div class="card pad0" style="overflow-x:auto"><table class="tbl" id="sch-tbl"></table></div>';
    function draw() {
      let gaps = 0, shifts = 0;
      days.forEach((d, di) => lines.forEach((l) => {
        const c = plan[di + "-" + l.id];
        shifts += c.have;
        if (c.have < d.need[l.id]) gaps += d.need[l.id] - c.have;
      }));
      document.getElementById("sch-kpis").innerHTML =
        UI.kpi("Покрытие недели", Math.round(shifts / (shifts + gaps) * 100) + "%", "цель 100%", gaps === 0) +
        UI.kpi("Разрывов", gaps, gaps ? "нужно закрыть" : "график укомплектован", gaps === 0) +
        UI.kpi("Смен за неделю", fmt.num(shifts)) +
        UI.kpi("ФОТ недели", fmt.money(shifts * SHIFT_COST), "ставка 2 400 ₽/смена");
      document.getElementById("sch-tbl").innerHTML =
        "<tr><th>Линия</th>" + days.map((d) => "<th>" + d.label + (d.peak ? " 🔥" : "") + "</th>").join("") + "</tr>" +
        lines.map((l) =>
          "<tr><td><b>" + l.t + "</b><div class='small muted'>" + l.staff + "</div></td>" +
          days.map((d, di) => {
            const c = plan[di + "-" + l.id];
            const gap = d.need[l.id] - c.have;
            return "<td class='center'>" + (gap > 0
              ? '<b style="color:var(--err)">' + c.have + "/" + d.need[l.id] + "</b><br><button class='btn small warn' data-fill='" + di + "-" + l.id + "'>Закрыть</button>"
              : '<b style="color:var(--ok)">' + c.have + "/" + d.need[l.id] + "</b>") + "</td>";
          }).join("") + "</tr>").join("");
      el.querySelectorAll("[data-fill]").forEach((b) =>
        b.addEventListener("click", () => {
          const c = plan[b.dataset.fill];
          c.have += 1;
          const l = lines.find((x) => x.id === b.dataset.fill.split("-")[1]);
          emit("ПЛАТФОРМА", "Разрыв закрыт: " + l.t + " — выведен сотрудник из резерва, смена согласована", "ok");
          toast("Разрыв закрыт.");
          draw();
        }));
    }
    draw();
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
    const zBlock = sh.lastZ ?
      '<div class="card mb" style="border-left:4px solid var(--ok)"><h3>🧾 Z-отчёт закрытой смены</h3>' +
      '<div class="rowline"><span>Чеков: <b>' + sh.lastZ.receipts + "</b></span><span>Выручка: <b>" + fmt.money(sh.lastZ.sum) + "</b></span>" +
      "<span>ОФД: <b>" + (sh.lastZ.ofdOk ? "все чеки ушли ✓" : "есть неотправленные") + "</b></span>" +
      "<span>Закрыта: <b>" + fmt.t(sh.lastZ.ts) + "</b></span></div>" +
      '<p class="small muted mt">Итоги автоматически ушли в дашборд точки, отчёт УК и расчёт роялти франчайзи.</p></div>' : "";
    el.innerHTML =
      "<h1>💰 Смена и чеки</h1>" +
      '<p class="muted">ККТ: ' + (sh.opened ? "смена открыта" : "смена не открыта") + " · ОФД-мониторинг активен.</p>" + zBlock +
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
      (sh.opened ? '<div class="rowline mt"><button class="btn warn" id="close-shift">Закрыть смену (Z-отчёт)</button></div>' : "") +
      '<div class="card mt2"><h3>Мониторинг «чеки не уходят»</h3>' +
      '<p class="small muted">По сети одна касса в зоне риска: ККТ 00004881 («Ловии Суши · Кировский») — 34 минуты без передачи.</p>' +
      '<button class="btn warn" id="ofd-alert">Симулировать алерт ОФД</button></div>';
    if (!sh.opened) document.getElementById("open-shift").addEventListener("click", () => {
      sh.opened = true;
      emit("ККТ", "Смена открыта: кассир " + (state.role === "cashier" ? "демо-пользователь" : "Ольга Петрова") + ", ККТ 00004512", "ok");
      nav("crm", "shift");
    });
    const cs = document.getElementById("close-shift");
    if (cs) cs.addEventListener("click", () => {
      sh.lastZ = {
        ts: Date.now(), receipts: sh.receipts.length,
        sum: sh.receipts.reduce((s, r) => s + r.sum, 0),
        ofdOk: sh.receipts.every((r) => r.ofd === "принят")
      };
      sh.opened = false;
      emit("ККТ", "Смена закрыта: Z-отчёт — " + sh.lastZ.receipts + " чеков на " + fmt.money(sh.lastZ.sum) + ", сверка с ОФД " + (sh.lastZ.ofdOk ? "без расхождений" : "есть расхождения"), "ok");
      toast("Смена закрыта, Z-отчёт сформирован.");
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
        }))) + "</div>" +
      '<div class="card mt2"><h3>Заявки в УК</h3>' +
      UI.table(
        [{ k: "id", t: "№" }, { k: "s", t: "Тема" }, { k: "l", t: "Точка" }, { k: "a", t: "Возраст" }, { k: "st", t: "Статус" }],
        DS.requests.filter((q) => q.tenant === "fr1").map((q) => ({
          cells: {
            id: q.id, s: "<b>" + q.subject + "</b><div class='small muted'>" + q.text + "</div>",
            l: locName(q.from), a: fmt.ago(q.ts),
            st: UI.badge(q.status, q.status === "Выполнена" ? "ok" : q.status === "Просрочена" ? "err" : q.status === "В работе" ? "info" : "gray")
          }
        }))) +
      '<div class="rowline mt"><select id="req-subj"><option>Оборудование</option><option>Маркетинг</option><option>Обучение</option><option>ИТ</option><option>Снабжение</option></select>' +
      '<input type="text" id="req-text" style="flex:1" placeholder="Опишите проблему или запрос для УК…">' +
      '<button class="btn primary" id="req-create">Отправить в УК</button></div>' +
      '<p class="small muted mt">Заявка уходит менеджеру УК с таймером SLA; вы видите статусы в реальном времени.</p></div>';
    el.querySelectorAll("[data-pay]").forEach((b) =>
      b.addEventListener("click", () => {
        DS.royalty.find((r) => r.loc === b.dataset.pay).paid = true;
        emit("БАНК", "Роялти оплачен: «" + locName(b.dataset.pay) + "»", "ok");
        toast("Оплата проведена.");
        nav("crm", "franchisee");
      }));
    const rc = document.getElementById("req-create");
    if (rc) rc.addEventListener("click", () => {
      const text = document.getElementById("req-text").value || "Запрос от франчайзи (демо)";
      DS.requests.unshift({
        id: "REQ-" + (106 + DS.requests.length), from: "l1", tenant: "fr1",
        subject: document.getElementById("req-subj").value, text,
        ts: Date.now(), status: "Новая", slaH: 48
      });
      emit("ПЛАТФОРМА", "Новая заявка в УК от «Фуд Восток»: " + text, "warn");
      toast("Заявка отправлена в УК. Таймер SLA запущен.");
      nav("crm", "franchisee");
    });
  });
})();
