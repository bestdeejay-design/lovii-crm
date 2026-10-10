/* lovii demo — erp.lovii.ru: операционный контур */
(function () {
  "use strict";
  const { state, fmt, esc, route, nav, UI, toast, emit } = window.LOVII;
  const locName = (id) => DS.locations.find((l) => l.id === id).name;
  const ingName = (id) => DS.ing.find((g) => g.id === id).name;
  const supName = (id) => DS.suppliers.find((s) => s.id === id).name;

  // ---------- KDS ----------
  route("erp/kds", (el) => {
    el.innerHTML =
      "<h1>🍳 Кухня (KDS) — " + locName(state.loc) + "</h1>" +
      '<p class="muted">Тикеты из всех каналов в одну очередь; норматив из ТТК; просрочка подсвечивается. Статус «Готов» спишет ингредиенты по ТТК.</p>' +
      '<div class="kanban" id="kds"></div>';
    function draw() {
      const list = DS.tickets.filter((t) => t.loc === state.loc);
      document.getElementById("kds").innerHTML = list.map((t) => {
        const sec = Math.floor((Date.now() - t.startedAt) / 1000);
        const late = sec > t.normSec;
        return '<div class="ticket ' + (t.status === "Готов" ? "ready" : late ? "late" : "") + '">' +
          '<div class="t-head"><span>' + t.id + "</span><span data-ticker='" + t.startedAt + "' data-norm='" + t.normSec + "'>" + fmt.timer(sec) + "</span></div>" +
          '<div class="small muted">' + t.station + " · норматив " + fmt.timer(t.normSec) + "</div>" +
          "<ul>" + t.items.map((i) => "<li>" + esc(i.name) + (i.note ? ' <span class="badge warn">' + esc(i.note) + "</span>" : "") + "</li>").join("") + "</ul>" +
          UI.badge(t.status, t.status === "Готов" ? "ok" : late ? "err" : "info") +
          (t.status !== "Готов" ? ' <button class="btn small ok" data-done="' + t.id + '">Готово</button>' : ' <button class="btn small" data-serve="' + t.id + '">Выдано</button>') +
          "</div>";
      }).join("");
      document.querySelectorAll("[data-done]").forEach((b) =>
        b.addEventListener("click", () => {
          const t = DS.tickets.find((x) => x.id === b.dataset.done);
          t.status = "Готов";
          emit("ПЛАТФОРМА", "Тикет " + t.id + " готов: списание ингредиентов по ТТК проведено", "ok");
          toast("Готово! Списание по ТТК проведено.");
          draw();
        }));
      document.querySelectorAll("[data-serve]").forEach((b) =>
        b.addEventListener("click", () => {
          DS.tickets = DS.tickets.filter((x) => x.id !== b.dataset.serve);
          emit("ПЛАТФОРМА", "Тикет " + b.dataset.serve + " выдан/упакован", "ok");
          draw();
        }));
    }
    draw();
  });

  // ---------- Склад ----------
  route("erp/warehouse", (el) => {
    const locLots = DS.lots.filter((l) => l.loc === state.loc);
    const soon = locLots.filter((l) => l.soon);
    el.innerHTML =
      "<h1>📦 Склад — " + locName(state.loc) + "</h1>" +
      '<p class="muted">Остаток — проекция журнала движений; партии с ФИФО и сроками. «Почему −3 кг сыра?» — вот события.</p>' +
      '<div class="grid cols-4 mb">' +
      UI.kpi("Позиций на складе", locLots.length) +
      UI.kpi("Партий с истекающим сроком", soon.length, "≤ 2 дня", soon.length > 0 ? false : true) +
      UI.kpi("Движений за сутки", "47", "приёмки, списания, акты") +
      UI.kpi("Инвентаризация", "через 3 дня", "слепая, по зонам") +
      "</div>" +
      (soon.length ? '<div class="card mb" style="border-left:4px solid var(--warn)"><b>⚠ Срочно в заготовки/списание:</b> ' +
        soon.slice(0, 6).map((l) => '<span class="tag">' + ingName(l.ing) + " · " + l.qty + " ед.</span>").join("") + "</div>" : "") +
      '<div class="card pad0"><table class="tbl"><tr><th>Ингредиент</th><th>Партия</th><th class="right">Остаток</th><th>Срок</th><th class="right">Стоимость</th></tr>' +
      locLots.slice(0, 22).map((l) => {
        const g = DS.ing.find((x) => x.id === l.ing);
        const days = Math.round((l.expiresAt - DS.NOW) / DS.DAY);
        return "<tr><td><b>" + g.name + "</b></td><td class='small muted'>" + l.id + "</td><td class='right'>" + l.qty + " " + g.unit + "</td>" +
          "<td>" + (days <= 2 ? UI.badge(days + " дн — риск", "err") : days <= 5 ? UI.badge(days + " дн", "warn") : UI.badge(days + " дн", "ok")) + "</td>" +
          "<td class='right'>" + fmt.money(l.qty * g.price) + "</td></tr>";
      }).join("") + "</table></div>";
  });

  // ---------- Закупки ----------
  route("erp/purchasing", (el) => {
    const pos = DS.purchaseOrders;
    const autoSuggest = [
      { ing: "Лосось", need: "8,4 кг", why: "прогноз выходных + остаток 2,1 кг", sup: "Рыбный Дом", price: 1557 },
      { ing: "Рис для суши", need: "22 кг", why: "норма закладки × 6 дней", sup: "Агро-Маркет", price: 165 },
      { ing: "Сыр сливочный", need: "6 кг", why: "минимальный остаток", sup: "МилкПро", price: 608 }
    ];
    el.innerHTML =
      "<h1>🛒 Закупки и поставщики</h1>" +
      '<p class="muted">Автозаказ по прогнозу продаж → подтверждение закупщика → приёмка по ЭДО со сверкой цен.</p>' +
      '<div class="card mb"><h3>💡 Предложения автозаказа (прогноз + остатки)</h3>' +
      UI.table(
        [{ k: "i", t: "Ингредиент" }, { k: "n", t: "Потребность" }, { k: "w", t: "Основание" }, { k: "s", t: "Поставщик" }, { k: "p", t: "Цена", right: 1 }, { k: "a", t: "" }],
        autoSuggest.map((a, i) => ({
          id: i,
          cells: {
            i: "<b>" + a.ing + "</b>", n: a.need, w: '<span class="small muted">' + a.why + "</span>",
            s: a.sup, p: fmt.money(a.price),
            a: '<button class="btn small primary" data-sg="' + i + '">В заказ</button>'
          }
        }))) + "</div>" +
      '<div class="card"><h3>Заказы поставщикам</h3>' +
      UI.table(
        [{ k: "id", t: "Заказ" }, { k: "s", t: "Поставщик" }, { k: "l", t: "Точка" }, { k: "d", t: "Создан" }, { k: "sum", t: "Сумма", right: 1 }, { k: "st", t: "Статус" }],
        pos.map((p) => ({
          cells: {
            id: "<b>" + p.id + "</b>" + (p.auto ? ' <span class="tag">авто</span>' : ""),
            s: supName(p.supplier), l: locName(p.loc), d: DS.fmtDay(p.created), sum: fmt.money(p.sum),
            st: UI.badge(p.status, p.status === "Принят" ? "ok" : p.status === "Ожидает подтверждения" ? "warn" : "info")
          }
        }))) + "</div>";
    el.querySelectorAll("[data-sg]").forEach((b) =>
      b.addEventListener("click", () => {
        const a = autoSuggest[+b.dataset.sg];
        emit("ПЛАТФОРМА", "Автозаказ: «" + a.ing + "» добавлен в заказ поставщику " + a.sup, "ok");
        toast("Добавлено в заказ поставщику.");
        b.disabled = true; b.textContent = "✓";
      }));
  });

  // ---------- Фудкост ----------
  route("erp/foodcost", (el) => {
    const rows = DS.locations.filter((l) => l.type !== "Производство").map((l) => {
      const pct = DS.foodcostPct(l.id);
      return { l, pct, dev: +(pct - 28).toFixed(1) };
    });
    el.innerHTML =
      "<h1>🧮 Фудкост: план против факта</h1>" +
      '<p class="muted">Теоретический расход по ТТК против факта инвентаризаций. Отклонение > 2 п.п. — сигнал на разбор.</p>' +
      '<div class="grid cols-4 mb">' +
      UI.kpi("Целевой фудкост", "≤ 30%", "по сети") +
      UI.kpi("Средний по сети", (rows.reduce((s, r) => s + r.pct, 0) / rows.length).toFixed(1) + "%") +
      UI.kpi("Точек вне цели", rows.filter((r) => r.pct > 30).length, "", false) +
      UI.kpi("Экономия за квартал", "312 тыс ₽", "от контроля цен поставщиков", true) +
      "</div>" +
      '<div class="card"><h3>Фудкост по точкам (факт 30 дней)</h3>' +
      UI.barsH(rows.map((r) => ({ label: r.l.name, v: r.pct, text: r.pct + "%", cls: r.pct > 30 ? "err" : "ok" })), 40) + "</div>" +
      '<div class="card mt2"><h3>Отклонения и действия</h3>' +
      UI.table(
        [{ k: "l", t: "Точка" }, { k: "d", t: "Отклонение", right: 1 }, { k: "c", t: "Вероятная причина" }, { k: "a", t: "Рекомендация" }],
        rows.filter((r) => r.dev > 0).map((r) => ({
          cells: {
            l: r.l.name, d: '<span class="badge ' + (r.dev > 2 ? "err" : "warn") + '">+' + r.dev + " п.п.</span>",
            c: r.dev > 2 ? "Рост закупочных цен + недостача по инвентаризации" : "Рост цен поставщика",
            a: r.dev > 2 ? "Внеплановая слепая инвентаризация + сверка ТТК" : "Тендер по позициям у других поставщиков"
          }
        }))) + "</div>";
  });

  // ---------- Доставка (диспетчер) ----------
  route("erp/delivery", (el) => {
    const cs = DS.couriers.filter((c) => c.loc === state.loc);
    const recent = DS.orders.filter((o) => o.loc === state.loc && o.delivery).slice(0, 10);
    const inWin = Math.round(recent.filter((o) => o.inWindow).length / recent.length * 100);
    el.innerHTML =
      "<h1>🛵 Доставка — диспетчеризация</h1>" +
      '<p class="muted">Обещание времени = норматив кухни + упаковка + маршрут (единая формула для всех каналов).</p>' +
      '<div class="grid cols-4 mb">' +
      UI.kpi("В обещанное окно", inWin + "%", "цель ≥ 90%", inWin >= 90) +
      UI.kpi("Курьеров на линии", cs.filter((c) => c.status === "В пути").length, "из " + cs.length) +
      UI.kpi("Доставок сегодня", cs.reduce((s, c) => s + c.deliveredToday, 0)) +
      UI.kpi("Средний рейтинг", (cs.reduce((s, c) => s + +c.rating, 0) / cs.length).toFixed(1) + " ★") +
      "</div>" +
      '<div class="grid cols-2">' +
      '<div class="card"><h3>Курьеры</h3>' +
      UI.table(
        [{ k: "n", t: "Курьер" }, { k: "v", t: "Транспорт" }, { k: "d", t: "Доставок", right: 1 }, { k: "r", t: "Рейтинг", right: 1 }, { k: "s", t: "Статус" }],
        cs.map((c) => ({
          cells: {
            n: "<b>" + c.name + "</b>", v: c.vehicle, d: c.deliveredToday, r: c.rating + " ★",
            s: UI.badge(c.status, c.status === "Свободен" ? "ok" : c.status === "В пути" ? "info" : "gray")
          }
        }))) + "</div>" +
      '<div class="card"><h3>Последние доставки</h3>' +
      UI.table(
        [{ k: "id", t: "Заказ" }, { k: "sum", t: "Сумма", right: 1 }, { k: "w", t: "Окно" }, { k: "s", t: "Статус" }],
        recent.map((o) => ({
          cells: {
            id: o.id, sum: fmt.money(o.sum),
            w: o.inWindow ? UI.badge("вовремя", "ok") : UI.badge("опоздание", "err"),
            s: UI.badge(o.status, "info")
          }
        }))) + "</div>" +
      "</div>";
  });

  // ---------- Мои доставки (курьер) ----------
  route("erp/courier", (el) => {
    const my = [
      { id: "ORD-100231", addr: "ул. Ленина, 12, кв. 45", sum: 1840, st: "Везу", eta: "14:48" },
      { id: "ORD-100236", addr: "пр. Мира, 8 (офис 214)", sum: 990, st: "Назначен", eta: "15:20" },
      { id: "ORD-100242", addr: "ул. Садовая, 3", sum: 2410, st: "Назначен", eta: "15:45" }
    ];
    el.innerHTML =
      "<h1>🏃 Мои доставки</h1>" +
      '<p class="muted">Смена с 11:00 · точка: ' + locName(state.loc) + " · пакетирование 2–3 заказов по пути.</p>" +
      my.map((o, i) =>
        '<div class="card mb"><div class="rowline"><b>' + o.id + "</b>" +
        UI.badge(o.st, o.st === "Везу" ? "info" : "gray") +
        '<span class="spacer"></span><span class="small muted">к ' + o.eta + '</span><b>' + fmt.money(o.sum) + "</b></div>" +
        '<div class="small muted mt">📍 ' + o.addr + "</div>" +
        '<div class="rowline mt">' +
        (o.st === "Везу"
          ? '<button class="btn small ok" data-deliv="' + i + '">Доставлено (фото)</button> <button class="btn small" data-call="' + i + '">Позвонить гостю</button>'
          : '<button class="btn small primary" data-pick="' + i + '">Забрал заказ</button>') +
        "</div><div id='c-log-" + i + "' class='mt'></div></div>").join("") +
      '<div class="card"><h3>Итог смены</h3><div class="rowline"><span>Доставок: <b>7</b></span><span>Чаевые: <b>420 ₽</b></span><span>Рейтинг: <b>4.9 ★</b></span></div></div>';
    el.querySelectorAll("[data-deliv]").forEach((b) =>
      b.addEventListener("click", () => {
        my[+b.dataset.deliv].st = "Доставлен";
        emit("ПЛАТФОРМА", "Доставка " + my[+b.dataset.deliv].id + " завершена: фото вручения, оплата получена", "ok");
        toast("Доставлено! Гостю уходит запрос отзыва.");
        nav("erp", "courier");
      }));
    el.querySelectorAll("[data-pick]").forEach((b) =>
      b.addEventListener("click", () => {
        my[+b.dataset.pick].st = "Везу";
        emit("ПЛАТФОРМА", "Курьер забрал заказ " + my[+b.dataset.pick].id, "info");
        nav("erp", "courier");
      }));
    el.querySelectorAll("[data-call]").forEach((b) =>
      b.addEventListener("click", () => toast("Звонок гостю через ВАТС платформы…")));
  });

  // ---------- Портал поставщика ----------
  route("erp/supplier", (el) => {
    const s = DS.suppliers.find((x) => x.id === state.supplier);
    const myPrices = DS.prices[s.id];
    const myPos = DS.purchaseOrders.filter((p) => p.supplier === s.id);
    el.innerHTML =
      "<h1>🏭 Портал поставщика — " + s.name + "</h1>" +
      '<p class="muted">' + s.cat + " · прайс виден только точкам с договором; приёмка идёт через ЭДО.</p>" +
      (s.alert ? '<div class="card mb" style="border-left:4px solid var(--warn)"><b>⚠ ' + s.alert + '</b><div class="small muted">Система рекомендовала трём точкам пересмотреть закупки — ожидается падение объёма по позиции.</div></div>' : "") +
      '<div class="grid cols-3 mb">' +
      UI.kpi("Позиций в прайсе", myPrices.length) +
      UI.kpi("Заявок за 2 недели", myPos.length, "от точек сети") +
      UI.kpi("Оборот за месяц", fmt.money(myPos.reduce((x, p) => x + p.sum, 0)), "+8% к прошлому", true) +
      "</div>" +
      '<div class="card mb"><h3>Заявки от точек</h3>' +
      UI.table(
        [{ k: "id", t: "Заказ" }, { k: "l", t: "Точка" }, { k: "d", t: "Дата" }, { k: "sum", t: "Сумма", right: 1 }, { k: "st", t: "Статус" }, { k: "a", t: "" }],
        myPos.map((p) => ({
          cells: {
            id: "<b>" + p.id + "</b>", l: locName(p.loc), d: DS.fmtDay(p.created), sum: fmt.money(p.sum),
            st: UI.badge(p.status, p.status === "Принят" ? "ok" : "info"),
            a: p.status === "Ожидает подтверждения" ? '<button class="btn small ok" data-conf="' + p.id + '">Подтвердить и отправить УПД</button>' : ""
          }
        }))) + "</div>" +
      '<div class="card"><h3>Мой прайс-лист</h3>' +
      UI.table(
        [{ k: "i", t: "Позиция" }, { k: "p", t: "Цена", right: 1 }, { k: "c", t: "Рыночная", right: 1 }, { k: "d", t: "Конкурентность" }],
        myPrices.slice(0, 14).map((pr) => {
          const g = DS.ing.find((x) => x.id === pr.ing);
          const delta = Math.round((pr.price / g.price - 1) * 100);
          return {
            cells: {
              i: g.name + " <span class='muted small'>(" + g.unit + ")</span>",
              p: fmt.money(pr.price), c: fmt.money(g.price),
              d: delta > 8 ? UI.badge("+" + delta + "% дороже рынка", "err") : delta < -3 ? UI.badge(delta + "% — выгодно", "ok") : UI.badge("в рынке", "gray")
            }
          };
        })) + "</div>";
    el.querySelectorAll("[data-conf]").forEach((b) =>
      b.addEventListener("click", () => {
        const p = DS.purchaseOrders.find((x) => x.id === b.dataset.conf);
        p.status = "Отправлен";
        emit("ЭДО", "УПД по заказу " + p.id + " отправлен через оператора ЭДО («" + supName(p.supplier) + "»)", "ok");
        toast("Подтверждено! УПД ушёл в точку.");
        nav("erp", "supplier");
      }));
  });
})();
