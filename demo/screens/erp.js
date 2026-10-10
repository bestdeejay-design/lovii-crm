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
          (t.status !== "Готов"
            ? ' <button class="btn small ok" data-done="' + t.id + '">Готово</button> <button class="btn small" data-late="' + t.id + '">Задержка +5 мин</button>'
            : ' <button class="btn small" data-serve="' + t.id + '">Выдано</button>') +
          "</div>";
      }).join("");
      document.querySelectorAll("[data-late]").forEach((b) =>
        b.addEventListener("click", () => {
          const t = DS.tickets.find((x) => x.id === b.dataset.late);
          t.normSec += 300;
          emit("ПЛАТФОРМА", "Задержка по тикету " + t.id + ": +5 минут — гость получил уведомление, диспетчер сдвинул обещание доставки", "warn");
          toast("Гость уведомлён о задержке, обещание сдвинуто.");
          draw();
        }));
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
        }))) +
      '<div id="purch-cart" class="mt"></div></div>' +
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
    state.purchCart = state.purchCart || [];
    function drawCart() {
      const cc = document.getElementById("purch-cart");
      if (!state.purchCart.length) { cc.innerHTML = ""; return; }
      const bySup = {};
      state.purchCart.forEach((c) => { (bySup[c.sup] = bySup[c.sup] || []).push(c); });
      cc.innerHTML = "<h3>🧺 В заказе</h3>" +
        Object.keys(bySup).map((sup) =>
          '<div class="mb"><b>' + sup + "</b>: " + bySup[sup].map((c) => c.ing + " (" + c.need + ")").join(", ") + "</div>").join("") +
        '<button class="btn primary" id="po-create">Сформировать заказы поставщикам</button>';
      const pc = document.getElementById("po-create");
      if (pc) pc.addEventListener("click", () => {
        Object.keys(bySup).forEach((sup) => {
          const s = DS.suppliers.find((x) => x.name === sup) || DS.suppliers[0];
          const sum = bySup[sup].reduce((x, c) => x + c.qty * c.price, 0);
          DS.purchaseOrders.unshift({
            id: "PO-NEW-" + (DS.purchaseOrders.length + 1),
            supplier: s.id, loc: state.loc, created: DS.NOW, sum: Math.round(sum),
            status: "Ожидает подтверждения", auto: true
          });
          emit("ПЛАТФОРМА", "Заказ поставщику «" + sup + "» сформирован из автозаказа на " + fmt.money(sum) + " — отправлен в портал поставщика", "ok");
        });
        toast("Заказы отправлены поставщикам. Подтверждение — в их портале.");
        state.purchCart = [];
        nav("erp", "purchasing");
      });
    }
    drawCart();
    el.querySelectorAll("[data-sg]").forEach((b) =>
      b.addEventListener("click", () => {
        const a = autoSuggest[+b.dataset.sg];
        if (!state.purchCart.find((c) => c.ing === a.ing)) {
          state.purchCart.push({ ing: a.ing, need: a.need, sup: a.sup, price: a.price, qty: parseFloat(a.need.replace(",", ".")) || 1 });
        }
        emit("ПЛАТФОРМА", "Автозаказ: «" + a.ing + "» добавлен в заказ поставщику " + a.sup, "info");
        toast("Добавлено в заказ поставщику.");
        b.disabled = true; b.textContent = "✓";
        drawCart();
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
    const probs = window.__courierProblems || [];
    el.innerHTML =
      "<h1>🛵 Доставка — диспетчеризация</h1>" +
      '<p class="muted">Обещание времени = норматив кухни + упаковка + маршрут (единая формула для всех каналов).</p>' +
      (probs.length ? '<div class="card mb" style="border-left:4px solid var(--err)"><h3>⚠ Проблемы от курьеров (требуют реакции)</h3>' +
        probs.map((p, i) =>
          '<div class="rowline mt"><b>' + p.id + "</b> · " + p.reason + '<span class="small muted">' + p.addr + "</span>" +
          '<span class="spacer"></span><button class="btn small" data-callg="' + i + '">Позвонить гостю</button>' +
          '<button class="btn small ok" data-resolve="' + i + '">Решено</button></div>').join("") + "</div>" : "") +
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
    el.querySelectorAll("[data-callg]").forEach((b) =>
      b.addEventListener("click", () => toast("Звонок гостю через ВАТС платформы…")));
    el.querySelectorAll("[data-resolve]").forEach((b) =>
      b.addEventListener("click", () => {
        const p = window.__courierProblems.splice(+b.dataset.resolve, 1)[0];
        emit("ПЛАТФОРМА", "Проблема " + p.id + " решена диспетчером: " + p.reason + " — гость предупреждён, доставка продолжается", "ok");
        toast("Проблема закрыта.");
        nav("erp", "delivery");
      }));
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
        (o.st === "Проблема" ? UI.badge("диспетчер уведомлён", "warn") : ' <button class="btn small warn" data-prob="' + i + '">Проблема</button>') +
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
    el.querySelectorAll("[data-prob]").forEach((b) =>
      b.addEventListener("click", () => {
        document.getElementById("c-log-" + b.dataset.prob).innerHTML =
          '<div class="rowline"><select data-reason><option>Гостя нет дома</option><option>Адрес не найден</option><option>Не дозвониться до гостя</option><option>Повреждена упаковка</option></select>' +
          '<button class="btn small warn" data-sendprob="' + b.dataset.prob + '">Сообщить диспетчеру</button></div>';
        b.remove();
        // вставленная кнопка: привязываем обработчик сразу после вставки
        const sb = document.querySelector('[data-sendprob="' + b.dataset.prob + '"]');
        sb.addEventListener("click", () => {
          const i = +sb.dataset.sendprob;
          const wrap = sb.closest(".rowline");
          const reason = wrap.querySelector("[data-reason]").value;
          my[i].st = "Проблема";
          window.__courierProblems = window.__courierProblems || [];
          window.__courierProblems.push({ id: my[i].id, addr: my[i].addr, reason, courier: "демо-курьер", ts: Date.now() });
          emit("ПЛАТФОРМА", "⚠ Проблема на доставке " + my[i].id + ": " + reason + " — диспетчер видит алерт и свяжется с гостем", "err");
          toast("Диспетчер получил алерт.");
          nav("erp", "courier");
        });
      }));
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
        myPrices.slice(0, 14).map((pr, idx) => {
          const g = DS.ing.find((x) => x.id === pr.ing);
          const delta = Math.round((pr.price / g.price - 1) * 100);
          return {
            cells: {
              i: g.name + " <span class='muted small'>(" + g.unit + ")</span>",
              p: fmt.money(pr.price), c: fmt.money(g.price),
              d: delta > 8
                ? UI.badge("+" + delta + "% дороже рынка", "err") + ' <button class="btn small" data-cut="' + idx + '">Дешевле на 5%</button>'
                : delta < -3 ? UI.badge(delta + "% — выгодно", "ok") : UI.badge("в рынке", "gray")
            }
          };
        })) + "</div>";
    el.querySelectorAll("[data-cut]").forEach((b) =>
      b.addEventListener("click", () => {
        const pr = myPrices[+b.dataset.cut];
        const g = DS.ing.find((x) => x.id === pr.ing);
        pr.price = Math.round(pr.price * 0.95);
        emit("ПЛАТФОРМА", "«" + s.name + "» пересмотрел цену: " + g.name + " → " + fmt.money(pr.price) + ". Точки получили обновлённый прайс", "ok");
        toast("Цена снижена на 5% — прайс обновлён у всех точек.");
        nav("erp", "supplier");
      }));
    el.querySelectorAll("[data-conf]").forEach((b) =>
      b.addEventListener("click", () => {
        const p = DS.purchaseOrders.find((x) => x.id === b.dataset.conf);
        p.status = "Отправлен";
        emit("ЭДО", "УПД по заказу " + p.id + " отправлен через оператора ЭДО («" + supName(p.supplier) + "»)", "ok");
        toast("Подтверждено! УПД ушёл в точку.");
        nav("erp", "supplier");
      }));
  });

  // ---------- Инвентаризация (слепая) ----------
  route("erp/inventory", (el) => {
    const locLots = DS.lots.filter((l) => l.loc === state.loc).slice(0, 16);
    const preset = (i) => (i % 5 === 2 ? -0.4 : i % 7 === 3 ? 0.6 : 0);
    let blind = true;
    el.innerHTML =
      "<h1>🔍 Инвентаризация — " + locName(state.loc) + "</h1>" +
      '<p class="muted">Слепой пересчёт: счётчик вносит факт, система сравнивает с книжными остатками постфактум. Итоги идут в фудкост и журнал.</p>' +
      '<div class="grid cols-4 mb" id="inv-kpis"></div>' +
      '<div class="rowline mb"><label class="small"><input type="checkbox" id="inv-blind"' + (blind ? " checked" : "") + '> Слепой режим (скрыть книжный остаток)</label>' +
      '<span class="spacer"></span><button class="btn primary" id="inv-confirm">Утвердить итоги</button></div>' +
      '<div class="card pad0"><table class="tbl" id="inv-tbl"></table></div>' +
      '<div id="inv-result" class="mt"></div>';

    function readFact() {
      const res = [];
      locLots.forEach((l, i) => {
        const inp = document.querySelector('[data-inv="' + i + '"]');
        res.push(i % 5 === 2 || i % 7 === 3 ? l.qty + preset(i) : (inp ? +inp.value : l.qty + preset(i)));
      });
      return res;
    }
    function draw() {
      document.getElementById("inv-blind").checked = blind;
      const th = "<tr><th>Ингредиент</th><th>Ед.</th>" +
        (blind ? "" : "<th class='right'>Книжный остаток</th>") +
        "<th class='right'>Факт</th>" + (blind ? "" : "<th class='right'>Отклонение</th><th>Причина</th>") + "</tr>";
      let body = "";
      locLots.forEach((l, i) => {
        const g = DS.ing.find((x) => x.id === l.ing);
        const fact = l.qty + preset(i);
        body += "<tr><td><b>" + g.name + "</b></td><td>" + g.unit + "</td>" +
          (blind ? "" : "<td class='right muted'>" + l.qty + "</td>") +
          "<td class='right'><input type='number' step='0.1' style='width:80px' data-inv='" + i + "' value='" + fact.toFixed(1) + "'></td>" +
          (blind ? "" : "<td class='right'>" + devHtml(preset(i), g) + "</td><td>" + reasonSel(preset(i)) + "</td>") + "</tr>";
      });
      document.getElementById("inv-tbl").innerHTML = th + body;
      drawKpis();
    }
    function devHtml(d, g) {
      if (d === 0) return '<span class="muted">0</span>';
      return '<b style="color:var(--' + (d < 0 ? "err" : "warn") + ')">' + (d > 0 ? "+" : "") + d.toFixed(1) + " " + g.unit + "</b>";
    }
    function reasonSel(d) {
      if (d === 0) return "";
      return "<select class='small'>" +
        (d < 0 ? "<option>Недостача (разбор)</option><option>Списание без акта</option><option>Ошибка приёмки</option>" :
          "<option>Неучтённая приёмка</option><option>Излишек поставщика</option>") + "</select>";
    }
    function drawKpis() {
      const devSum = locLots.reduce((s, l, i) => {
        const g = DS.ing.find((x) => x.id === l.ing);
        return s + preset(i) * g.price;
      }, 0);
      const neg = locLots.filter((l, i) => preset(i) < 0).length;
      document.getElementById("inv-kpis").innerHTML =
        UI.kpi("Позиций в пересчёте", locLots.length, "зоны: склад, холод, заготовки") +
        UI.kpi("Отклонение, ₽", (devSum > 0 ? "+" : "") + fmt.money(devSum), "недостачи и излишки", false) +
        UI.kpi("Недостач", neg + " поз.", "требуют причины", false) +
        UI.kpi("Следующая инвентаризация", "через 3 дня", "слепая, по зонам");
    }
    draw();
    document.getElementById("inv-blind").addEventListener("change", (e) => { blind = e.target.checked; draw(); });
    document.getElementById("inv-confirm").addEventListener("click", () => {
      const facts = readFact();
      let devSum = 0, shortages = 0;
      locLots.forEach((l, i) => {
        const g = DS.ing.find((x) => x.id === l.ing);
        const d = facts[i] - l.qty;
        devSum += d * g.price;
        if (d < -0.05) shortages++;
      });
      emit("ПЛАТФОРМА", "Инвентаризация «" + locName(state.loc) + "» утверждена: отклонение " + (devSum > 0 ? "+" : "") + fmt.money(devSum) + ", недостач: " + shortages + " — итоги ушли в фудкост", devSum < 0 ? "warn" : "ok");
      document.getElementById("inv-result").innerHTML =
        '<div class="card" style="border-left:4px solid var(--' + (devSum < 0 ? "warn" : "ok") + ')"><b>Итоги утверждены.</b> ' +
        (devSum < 0 ? "Недостача " + fmt.money(-devSum) + " увеличит фактический фудкост точки — система предложит слепую перепроверку зон и сверку ТТК." :
          "Отклонения в пределах нормы. Корректировки остатков проведены, акты подписаны.") +
        " <a href='#/erp/foodcost'>Смотреть влияние на фудкост →</a></div>";
      toast("Итоги инвентаризации утверждены.");
    });
  });

  // ---------- Производство (фабрика-кухня) ----------
  route("erp/production", (el) => {
    const shopIds = ["l1", "l2", "l3", "l4"];
    const demand = (sf) => shopIds.reduce((s, id) => s + sf.per[id], 0);
    el.innerHTML =
      "<h1>🏗 Производство — фабрика-кухня</h1>" +
      '<p class="muted">Задания на день считаются из прогноза заказов точек. Готовый полуфабрикат уходит перемещением по ЭДО-накладной.</p>' +
      '<div class="grid cols-4 mb" id="prod-kpis"></div>' +
      '<div class="card pad0"><table class="tbl" id="prod-tbl"></table></div>' +
      '<div class="card mt2"><h3>Вчерашние перемещения</h3>' +
      UI.table(
        [{ k: "i", t: "Полуфабрикат" }, { k: "l", t: "Точка" }, { k: "q", t: "Кол-во", right: 1 }, { k: "s", t: "Статус" }],
        [
          { cells: { i: "Лосось порционированный", l: "Ловии Суши · Центральный", q: "6,0 кг", s: UI.badge("принято", "ok") } },
          { cells: { i: "Тесто для пиццы", l: "Ловии Суши · Северный", q: "60 шт", s: UI.badge("принято", "ok") } },
          { cells: { i: "Овощная нарезка микс", l: "Ловии Суши · Аэропорт", q: "4,2 кг", s: UI.badge("расхождение 0,3 кг", "warn") } }
        ]) + "</div>";
    function draw() {
      const list = DS.semifinished;
      const done = list.filter((s) => s.status === "Отгружено").length;
      document.getElementById("prod-kpis").innerHTML =
        UI.kpi("Заданий на день", list.length, "по прогнозу заказов") +
        UI.kpi("Выполнено", done + " из " + list.length, "", done === list.length) +
        UI.kpi("Общая потребность", fmt.num(list.reduce((s, x) => s + demand(x), 0)) + " ед.", "4 точки сети") +
        UI.kpi("Дедлайн отгрузки", "17:00", "до вечернего пика", true);
      document.getElementById("prod-tbl").innerHTML =
        "<tr><th>Полуфабрикат</th><th class='right'>Потребность точек</th><th class='right'>Произведено</th><th>Статус</th><th></th></tr>" +
        list.map((sf) => {
          const dem = demand(sf);
          const btns = sf.status === "Новое" ? '<button class="btn small primary" data-start="' + sf.id + '">Запустить</button>' :
            sf.status === "В работе" ? '<button class="btn small ok" data-finish="' + sf.id + '">Завершить партию</button>' :
              sf.status === "Произведено" ? '<button class="btn small primary" data-ship="' + sf.id + '">Переместить в точки</button>' :
                UI.badge("отгружено", "ok");
          return "<tr><td><b>" + sf.name + "</b><div class='small muted'>ТТК №" + (100 + +sf.id.slice(2)) + "</div></td>" +
            "<td class='right'>" + dem + " " + sf.unit + "<div class='small muted'>Ц " + sf.per.l1 + " · С " + sf.per.l2 + " · К " + sf.per.l3 + " · А " + sf.per.l4 + "</div></td>" +
            "<td class='right'>" + sf.produced + " " + sf.unit + "</td>" +
            "<td>" + UI.badge(sf.status.toLowerCase(), sf.status === "Отгружено" ? "ok" : sf.status === "В работе" ? "info" : "gray") + "</td>" +
            "<td class='right'>" + btns + "</td></tr>";
        }).join("");
      el.querySelectorAll("[data-start]").forEach((b) =>
        b.addEventListener("click", () => {
          const sf = DS.semifinished.find((x) => x.id === b.dataset.start);
          sf.status = "В работе";
          sf.produced = Math.round(demand(sf) * 0.6 * 10) / 10;
          emit("ПЛАТФОРМА", "Производство запущено: «" + sf.name + "» (фабрика-кухня)", "info");
          draw();
        }));
      el.querySelectorAll("[data-finish]").forEach((b) =>
        b.addEventListener("click", () => {
          const sf = DS.semifinished.find((x) => x.id === b.dataset.finish);
          sf.status = "Произведено";
          sf.produced = demand(sf);
          emit("ПЛАТФОРМА", "Партия произведена: «" + sf.name + "», " + sf.produced + " " + sf.unit + " — контроль качества пройден", "ok");
          draw();
        }));
      el.querySelectorAll("[data-ship]").forEach((b) =>
        b.addEventListener("click", () => {
          const sf = DS.semifinished.find((x) => x.id === b.dataset.ship);
          sf.status = "Отгружено";
          emit("ПЛАТФОРМА", "Перемещение «" + sf.name + "»: 4 точки, накладная через ЭДО, курьер фабрики выехал", "ok");
          toast("Перемещение оформлено, точки получили уведомление.");
          draw();
        }));
    }
    draw();
  });

  // ---------- Взаиморасчёты с поставщиками ----------
  route("erp/settlements", (el) => {
    const totalDebt = DS.settlements.reduce((s, x) => s + x.debt, 0);
    el.innerHTML =
      "<h1>💼 Взаиморасчёты с поставщиками</h1>" +
      '<p class="muted">Сверка по данным приёмки (ЭДО) и платежей: задолженность видна до дня оплаты, просрочка подсвечивается.</p>' +
      '<div class="grid cols-4 mb">' +
      UI.kpi("К оплате поставщикам", fmt.money(totalDebt), "по всем договорам", false) +
      UI.kpi("Платежей на этой неделе", "3", "на 1 240 000 ₽ по графику") +
      UI.kpi("Средняя отсрочка", "17 дней", "по договорам") +
      UI.kpi("Сверка актов", "ЭДО", "УПД по каждой поставке", true) +
      "</div>" +
      '<div class="card pad0"><table class="tbl" id="set-tbl"></table></div>';
    function draw() {
      document.getElementById("set-tbl").innerHTML =
        "<tr><th>Поставщик</th><th class='right'>Поставки 30 дней</th><th class='right'>Оплачено</th><th class='right'>Задолженность</th><th>Отсрочка</th><th></th></tr>" +
        DS.settlements.map((s) =>
          "<tr><td><b>" + supName(s.sup) + "</b></td><td class='right'>" + fmt.money(s.delivered) + "</td><td class='right'>" + fmt.money(s.paid) + "</td>" +
          "<td class='right'>" + (s.debt ? '<b style="color:var(--err)">' + fmt.money(s.debt) + "</b>" : UI.badge("0 ₽", "ok")) + "</td>" +
          "<td>" + s.terms + " дней</td>" +
          '<td class="right">' + (s.debt ? '<button class="btn small primary" data-pay="' + s.sup + '">Оплатить</button>' : UI.badge("рассчитано", "ok")) + "</td></tr>").join("");
      el.querySelectorAll("[data-pay]").forEach((b) =>
        b.addEventListener("click", () => {
          const s = DS.settlements.find((x) => x.sup === b.dataset.pay);
          emit("БАНК", "Платёж поставщику «" + supName(s.sup) + "»: " + fmt.money(s.debt) + ", платёжное поручение отправлено", "ok");
          s.paid = s.delivered;
          s.debt = 0;
          toast("Платёж отправлен в банк.");
          draw();
        }));
    }
    draw();
  });
})();
