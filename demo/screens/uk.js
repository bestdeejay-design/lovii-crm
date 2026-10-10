/* lovii demo — кабинет УК: контроль сети */
(function () {
  "use strict";
  const { state, fmt, esc, route, nav, UI, toast, emit } = window.LOVII;
  const locName = (id) => DS.locations.find((l) => l.id === id).name;

  function stdIndex(loc) {
    const a = DS.audits.filter((x) => x.loc === loc);
    return Math.round(a.reduce((s, x) => s + x.score, 0) / (a.length || 1));
  }
  function nps(loc) {
    const r = DS.reviews.filter((x) => x.loc === loc);
    return Math.round((r.filter((x) => x.rating >= 4).length - r.filter((x) => x.rating <= 2).length) / (r.length || 1) * 100);
  }

  // ---------- Собственник ----------
  let ownerTimer = null;
  route("erp/owner", (el) => {
    const shops = DS.locations.filter((l) => l.type !== "Производство");
    const rev28 = shops.reduce((s, l) => s + DS.dailyByLoc[l.id].slice(-28).reduce((a, d) => a + d.revenue, 0), 0);
    const revM = Math.round(rev28 / 28 * 30); // месячная проекция
    const fcBase = +(shops.reduce((s, l) => s + DS.foodcostPct(l.id), 0) / shops.length).toFixed(1);
    const LABOR = 30, RENT = 9, OTHER = 5, ROY = 7; // % выручки
    const winPct = Math.round(DS.orders.filter((o) => o.delivery && o.inWindow).length / (DS.orders.filter((o) => o.delivery).length || 1) * 100);
    const revsAll = DS.reviews;
    const nps = Math.round((revsAll.filter((r) => r.rating >= 4).length - revsAll.filter((r) => r.rating <= 2).length) / revsAll.length * 100);
    const stdAvg = Math.round(shops.reduce((s, l) => s + stdIndex(l.id), 0) / shops.length);

    const owner = window.__ownerLive || { today: 0, orders: 0, tickTs: Date.now() };
    if (!owner.today) {
      owner.today = shops.reduce((s, l) => s + DS.dailyByLoc[l.id][29].revenue, 0);
      owner.orders = 236;
    }
    window.__ownerLive = owner;

    function profit(fc, labor, rev) {
      return Math.round(rev * (1 - fc / 100 - labor / 100 - RENT / 100 - OTHER / 100 - ROY / 100));
    }
    const baseProfit = profit(fcBase, LABOR, revM);

    el.innerHTML =
      "<h1>👑 Кабинет собственника</h1>" +
      '<p class="muted"><span class="owner-live"></span>Данные обновляются в реальном времени. Ваша задача — не разбирать инциденты, а <b>влиять на систему</b>: показатель → причина → рычаг.</p>' +
      '<div class="grid cols-4" id="owner-kpis"></div>' +
      '<div class="grid cols-2 mt2">' +
      '<div class="card"><h3>Показатель → причина → как повлиять</h3><div id="owner-levers"></div></div>' +
      '<div class="card"><h3>🧪 Песочница решений</h3><p class="small muted">Подвигайте рычаги — система пересчитает прибыль месяца. Это модель на фактических данных сети.</p>' +
      '<div id="owner-sandbox"></div><div class="mt" id="sandbox-out"></div></div>' +
      "</div>" +
      '<div class="card mt2"><h3>✅ Ваши решения на сегодня</h3><p class="small muted">Одобренное решение мгновенно становится задачей исполнителю (УК, точка, поставщик) и фиксируется в журнале.</p><div id="owner-decisions"></div></div>' +
      '<div class="card mt2"><h3>🗂 Журнал решений — последние 5 дней</h3>' +
      UI.table(
        [{ k: "d", t: "Когда" }, { k: "t", t: "Решение" }, { k: "w", t: "Исполнитель" }, { k: "e", t: "Эффект" }, { k: "s", t: "Статус" }],
        DS.ownerDecisions.map((d) => ({
          cells: {
            d: fmt.ago(d.ts), t: "<b>" + d.text + "</b>", w: d.who,
            e: '<span class="small muted">' + d.eff + "</span>",
            s: UI.badge(d.st, d.st === "Выполнено" ? "ok" : "info")
          }
        }))) +
      '<div class="small muted mt">Каждое одобренное решение становится задачей с исполнителем и попадает в этот журнал — история решений собственника является юридически значимой для сети.</div></div>' +
      '<div class="card mt2"><h3>Куда смотреть дальше</h3><div class="rowline">' +
      '<a class="btn" href="#/erp/recs">💡 Все рекомендации по сети</a><a class="btn" href="#/erp/pulse">🌐 Пульс сети</a><a class="btn" href="#/erp/audits">📋 Аудиты</a></div></div>';

    function drawKpis() {
      document.getElementById("owner-kpis").innerHTML =
        UI.kpi("Выручка сегодня", fmt.money(owner.today), "заказов: " + owner.orders + " · обновлено " + fmt.ago(owner.tickTs), true) +
        UI.kpi("Выручка 28 дней", fmt.money(rev28), "+9% к прошлому периоду", true) +
        UI.kpi("Прибыль месяца (прогноз)", fmt.money(profit(fcBase, LABOR, revM)), "маржа " + (baseProfit / revM * 100).toFixed(1) + "% · цель ≥ 15%", true) +
        UI.kpi("Фудкост сети", fcBase + "%", "цель ≤ 30% · Кировский тянет вверх", fcBase <= 30);
    }
    drawKpis();

    // Рычаги влияния
    const fcL3 = DS.foodcostPct("l3").toFixed(1);
    const levers = [
      { m: "Фудкост «Кировский»: " + fcL3 + "%", bad: true, why: "Лосось +12% у «Рыбного Дома» и недостача 2,4 кг сыра по инвентаризации.", act: "Одобрить тендер по лососю + слепая инвентаризация", ev: "Собственник одобрил: тендер по лососю и внеплановая инвентаризация «Кировский» — задачи ушли закупщику и управляющему" },
      { m: "Доставка в окно: " + winPct + "%", bad: winPct < 90, why: "Просрочка кухонных тикетов 11% на вечерних пиках 19:00–21:00.", act: "Одобрить второго повара 18:30–21:30 (Северный)", ev: "Собственник одобрил усиление вечернего слота — график передан управляющему" },
      { m: "ККТ 00004881 не передаёт чеки", bad: true, why: "Риск штрафов по 54-ФЗ: 34 минуты без передачи в ОФД.", act: "Вызвать техника сегодня", ev: "Собственник вызвал техника на «Кировский» — заявка в сервис, контроль через 2 часа" },
      { m: "NPS: " + nps, bad: nps < 50, why: "Негатив по скорости доставки и одному сорванному заказу.", act: "Одобрить сервис-рекавери: бонус 300 ₽ за негативный отзыв", ev: "Программа сервис-рекавери одобрена собственником — кампании запущены" },
      { m: "Роялти: " + DS.royalty.filter((r) => !r.paid).length + " точка не оплатила", bad: DS.royalty.some((r) => !r.paid), why: "Задолженность тянет больше 2 недель; риск кассового разрыва по маркетинговому фонду.", act: "Поручить УК переговоры + график платежей", ev: "Собственник поручил УК переговоры по задолженности роялти" }
    ];
    document.getElementById("owner-levers").innerHTML = levers.map((l, i) =>
      '<div class="mb" style="border:1px solid var(--line);border-left:4px solid var(--' + (l.bad ? "err" : "ok") + ');border-radius:10px;padding:10px 12px">' +
      '<div class="rowline"><b>' + l.m + "</b>" + UI.badge(l.bad ? "вне цели" : "в цели", l.bad ? "err" : "ok") + "</div>" +
      '<div class="small muted mt"><b>Причина:</b> ' + l.why + "</div>" +
      '<div class="rowline mt"><span class="small"><b>Рычаг:</b> ' + l.act + '</span><span class="spacer"></span>' +
      '<button class="btn small primary" data-lever="' + i + '">Одобрить</button></div></div>').join("");
    el.querySelectorAll("[data-lever]").forEach((b) =>
      b.addEventListener("click", () => {
        emit("РЕШЕНИЕ", levers[+b.dataset.lever].ev, "ok");
        toast("Решение зафиксировано, задачи ушли исполнителям.");
        b.disabled = true; b.textContent = "✓ Решение принято";
        b.classList.remove("primary"); b.classList.add("ok");
      }));

    // Песочница
    const sb = document.getElementById("owner-sandbox");
    sb.innerHTML =
      '<div class="slider-row"><span class="small">Средний чек (цены)</span><input type="range" id="sl-price" min="0" max="10" step="0.5" value="0"><b class="small right" id="v-price">+0%</b></div>' +
      '<div class="slider-row"><span class="small">Поток заказов</span><input type="range" id="sl-orders" min="0" max="20" step="1" value="0"><b class="small right" id="v-orders">+0%</b></div>' +
      '<div class="slider-row"><span class="small">Фудкост (снижение)</span><input type="range" id="sl-fc" min="0" max="4" step="0.5" value="0"><b class="small right" id="v-fc">−0 п.п.</b></div>' +
      '<div class="slider-row"><span class="small">ФОТ (оптимизация)</span><input type="range" id="sl-labor" min="0" max="5" step="0.5" value="0"><b class="small right" id="v-labor">−0 п.п.</b></div>';
    function calcSandbox() {
      const p = +document.getElementById("sl-price").value / 100;
      const o = +document.getElementById("sl-orders").value / 100;
      const z = +document.getElementById("sl-fc").value;
      const w = +document.getElementById("sl-labor").value;
      document.getElementById("v-price").textContent = "+" + (p * 100) + "%";
      document.getElementById("v-orders").textContent = "+" + (o * 100) + "%";
      document.getElementById("v-fc").textContent = "−" + z + " п.п.";
      document.getElementById("v-labor").textContent = "−" + w + " п.п.";
      const demand = 1 - p * 0.9; // эластичность: рост цен съедает часть заказов
      const newRev = Math.round(revM * (1 + p) * demand * (1 + o));
      const newProfit = profit(fcBase - z, LABOR - w, newRev);
      const delta = newProfit - baseProfit;
      document.getElementById("sandbox-out").innerHTML =
        '<div class="rowline"><span>Выручка: <b>' + fmt.money(newRev) + "</b></span>" +
        '<span class="spacer"></span><span>Прибыль: <b>' + fmt.money(newProfit) + "</b></span></div>" +
        '<div class="rowline mt"><span class="small muted">Маржа: ' + (newProfit / newRev * 100).toFixed(1) + "%</span>" +
        '<span class="spacer"></span><b style="color:var(--' + (delta >= 0 ? "ok" : "err") + ')">' + (delta >= 0 ? "+" : "") + fmt.money(delta) + " к прибыли месяца</b></div>" +
        (p > 0 ? '<p class="small muted mt">Модель учитывает эластичность: +10% цен ≈ −9% заказов.</p>' : "");
    }
    ["sl-price", "sl-orders", "sl-fc", "sl-labor"].forEach((id) =>
      document.getElementById(id).addEventListener("input", calcSandbox));
    calcSandbox();

    // Решения дня
    const decisions = [
      "Тендер по лососю среди альтернативных поставщиков (экономия ~86 тыс ₽/мес)",
      "Усиление вечернего слота вторым поваром на «Северном»",
      "Выезд техника к ККТ 00004881 («Кировский»)",
      "Кампания реактивации «Спящих»: 312 гостей, прогноз +7% заказов",
      "Переговоры с должниками по роялти: график платежей"
    ];
    const decBox = document.getElementById("owner-decisions");
    decBox.innerHTML = decisions.map((d, i) =>
      '<div class="rowline mt" style="gap:10px;border-bottom:1px dashed var(--line);padding-bottom:10px"><span style="flex:1">' + d + "</span>" +
      '<button class="btn small ok" data-dec-ok="' + i + '">Одобрить</button>' +
      '<button class="btn small" data-dec-del="' + i + '">Делегировать УК</button>' +
      '<button class="btn small warn" data-dec-no="' + i + '">Отклонить</button></div>').join("");
    decBox.querySelectorAll("[data-dec-ok]").forEach((b) =>
      b.addEventListener("click", () => {
        emit("РЕШЕНИЕ", "Собственник одобрил: " + decisions[+b.dataset.decOk], "ok");
        mark(b, "✓ Одобрено — задача создана");
      }));
    decBox.querySelectorAll("[data-dec-del]").forEach((b) =>
      b.addEventListener("click", () => {
        emit("РЕШЕНИЕ", "Собственник делегировал УК: " + decisions[+b.dataset.decDel], "info");
        mark(b, "✓ Делегировано УК");
      }));
    decBox.querySelectorAll("[data-dec-no]").forEach((b) =>
      b.addEventListener("click", () => {
        emit("РЕШЕНИЕ", "Собственник отклонил: " + decisions[+b.dataset.decNo], "warn");
        mark(b, "Отклонено");
      }));
    function mark(b, text) {
      const row = b.closest(".rowline");
      row.querySelectorAll("button").forEach((x) => x.remove());
      row.insertAdjacentHTML("beforeend", UI.badge(text, text.startsWith("Отклонено") ? "warn" : "ok"));
    }

    // Живое обновление выручки
    if (ownerTimer) clearInterval(ownerTimer);
    ownerTimer = setInterval(() => {
      if (!document.getElementById("owner-kpis")) { clearInterval(ownerTimer); ownerTimer = null; return; }
      const inc = 900 + Math.floor(Math.random() * 3300);
      owner.today += inc;
      owner.orders += Math.random() > 0.4 ? 1 : 0;
      owner.tickTs = Date.now();
      drawKpis();
    }, 6000);
  });

  // ---------- Пульс сети ----------
  route("erp/pulse", (el) => {
    const rev = DS.locations.filter((l) => l.type !== "Производство")
      .map((l) => ({ l, rev: DS.dailyByLoc[l.id].slice(-28).reduce((s, d) => s + d.revenue, 0) }));
    const totalRev = rev.reduce((s, x) => s + x.rev, 0);
    el.innerHTML =
      "<h1>🌐 Пульс сети — УК «Ловии»</h1>" +
      '<p class="muted">Агрегаты по всем точкам в реальном времени; данные франчайзи — только по договорам.</p>' +
      '<div class="grid cols-4">' +
      UI.kpi("Выручка сети 28 дней", fmt.money(totalRev), "+9% к прошлому периоду", true) +
      UI.kpi("Точек", DS.locations.length, "4 франшизных + производство") +
      UI.kpi("Средний индекс стандарта", Math.round(DS.locations.filter((l) => l.type !== "Производство").reduce((s, l) => s + stdIndex(l.id), 0) / 4) + "%", "цель ≥ 85%", true) +
      UI.kpi("Собираемость роялти", Math.round(DS.royalty.filter((r) => r.paid).length / DS.royalty.length * 100) + "%", "за месяц") +
      "</div>" +
      '<div class="card mt2"><h3>Выручка точек за 28 дней</h3>' +
      UI.barsH(rev.map((x) => ({ label: x.l.name, v: x.rev, text: fmt.money(x.rev), cls: x.l.id === "l3" ? "warn" : "ok" })), null) + "</div>" +
      '<div class="grid cols-2 mt2">' +
      '<div class="card"><h3>Индекс стандарта сети — 8 недель</h3>' +
      UI.svgBars(DS.stdWeeks.map((w) => ({
        label: DS.fmtDay(w.ts), v: w.net,
        title: "Неделя от " + DS.fmtDay(w.ts) + ": сеть " + w.net + "% («Кировский» " + w.per.l3 + "%, «Центральный» " + w.per.l1 + "%)",
        color: w.net >= 85 ? "#16a34a" : "#d97706"
      })), { h: 150 }) +
      '<div class="small muted">Цель ≥ 85%. Рост последних недель — эффект автозадач по нарушениям. Наведите столбец — разбивка по точкам.</div></div>' +
      '<div class="card"><h3>Бенчмаркинг франчайзи</h3>' +
      UI.table(
        [{ k: "n", t: "Партнёр" }, { k: "l", t: "Точек", right: 1 }, { k: "r", t: "Выручка 28 дн", right: 1 }, { k: "s", t: "Стандарт", right: 1 }, { k: "p", t: "NPS", right: 1 }, { k: "d", t: "Долг роялти", right: 1 }],
        DS.franchBench.map((f) => ({
          cells: {
            n: "<b>" + f.name + "</b>", l: f.locs, r: fmt.money(f.rev),
            s: UI.badge(f.std + "%", f.std >= 85 ? "ok" : "err"),
            p: f.nps,
            d: f.debt ? '<b style="color:var(--err)">' + fmt.money(f.debt) + "</b>" : UI.badge("нет", "ok")
          }
        }))) +
      '<div class="small muted mt">Сравнение партнёров на одних данных — основа тарифной политики и планов развития сети.</div></div>' +
      "</div>" +
      '<div class="card mt2"><h3>Сравнение точек</h3>' +
      UI.table(
        [{ k: "l", t: "Точка" }, { k: "t", t: "Франчайзи" }, { k: "rh", t: "Выр./час", right: 1 }, { k: "lb", t: "ФОТ", right: 1 }, { k: "fc", t: "Фудкост", right: 1 }, { k: "n", t: "NPS", right: 1 }, { k: "s", t: "Стандарт", right: 1 }, { k: "w", t: "Доставка в окно", right: 1 }, { k: "z", t: "Зона" }],
        DS.locations.filter((l) => l.type !== "Производство").map((l) => {
          const fc = DS.foodcostPct(l.id);
          const std = stdIndex(l.id);
          const b = DS.locBench[l.id];
          const win = Math.round(DS.orders.filter((o) => o.loc === l.id && o.delivery && o.inWindow).length / (DS.orders.filter((o) => o.loc === l.id && o.delivery).length || 1) * 100);
          const red = fc > 30 || std < 85;
          return {
            cells: {
              l: "<b>" + l.name + "</b><div class='small muted'>доставка " + b.deliveryShare + "% заказов</div>",
              t: DS.tenants[l.tenant].name,
              rh: fmt.money(b.revPerHour),
              lb: b.labor + "%",
              fc: fc + "%", n: nps(l.id), s: std + "%", w: win + "%",
              z: red ? UI.badge("красная", "err") : UI.badge("зелёная", "ok")
            }
          };
        })) + "</div>";
  });

  // ---------- Роялти ----------
  route("erp/royalty", (el) => {
    const lastW = DS.royaltyWeeks[DS.royaltyWeeks.length - 1];
    const totalDebtAging = DS.debtAging.reduce((s, d) => s + d.cur + d.d14 + d.d30 + d.d60, 0);
    el.innerHTML =
      "<h1>💳 Роялти — автоматический расчёт</h1>" +
      '<p class="muted">База расчёта — фискальная выручка из ОФД: юридически достоверный источник, без участия бухгалтера. Расчётный период — <b>понедельный</b>, закрытие месяца — до 5-го числа.</p>' +
      '<div class="grid cols-4 mb">' +
      UI.kpi("Начислено за месяц", fmt.money(DS.royalty.reduce((s, r) => s + r.royalty + r.marketing, 0)), "5% + 2%") +
      UI.kpi("Оплачено", fmt.money(DS.royalty.filter((r) => r.paid).reduce((s, r) => s + r.royalty + r.marketing, 0))) +
      UI.kpi("Просрочено", DS.royalty.filter((r) => !r.paid).length + " точки", "", false) +
      UI.kpi("Собираемость (неделя)", lastW.share + "%", "цель ≥ 95%", lastW.share >= 95) +
      "</div>" +
      '<div class="grid cols-2 mb">' +
      '<div class="card"><h3>Собираемость роялти — 8 недель</h3>' +
      UI.svgBars(DS.royaltyWeeks.map((w) => ({
        label: DS.fmtDay(w.ts), v: w.share,
        title: "Неделя от " + DS.fmtDay(w.ts) + ": начислено " + fmt.money(w.accrued) + ", собрано " + fmt.money(w.paid) + " (" + w.share + "%)",
        color: w.share >= 95 ? "#16a34a" : w.share >= 88 ? "#d97706" : "#dc2626"
      })), { h: 150 }) +
      '<div class="small muted">Столбец — процент сбора от начисленного. Наведите — суммы недели.</div></div>' +
      '<div class="card"><h3>Старение задолженности</h3>' +
      UI.table(
        [{ k: "f", t: "Франчайзи" }, { k: "c", t: "Текущий", right: 1 }, { k: "d14", t: "1–14 дн", right: 1 }, { k: "d30", t: "15–30 дн", right: 1 }, { k: "d60", t: "30+ дн", right: 1 }],
        DS.debtAging.map((d) => ({
          cells: {
            f: "<b>" + DS.tenants[d.tenant].name + "</b>",
            c: d.cur ? fmt.money(d.cur) : "—",
            d14: d.d14 ? fmt.money(d.d14) : "—",
            d30: d.d30 ? '<b style="color:var(--warn)">' + fmt.money(d.d30) + "</b>" : "—",
            d60: d.d60 ? '<b style="color:var(--err)">' + fmt.money(d.d60) + "</b>" : "—"
          }
        }))) +
      '<div class="small muted mt">Всего к взысканию: <b>' + fmt.money(totalDebtAging) + "</b>. Долг старше 30 дней — автоматическая эскалация собственнику и остановка маркетингового фонда партнёра.</div></div>" +
      "</div>" +
      '<div class="card"><h3>Расчёт по точкам</h3>' +
      UI.table(
        [{ k: "l", t: "Точка" }, { k: "fr", t: "Франчайзи" }, { k: "r", t: "Выручка (ОФД)", right: 1 }, { k: "p", t: "Роялти", right: 1 }, { k: "m", t: "Маркетинг", right: 1 }, { k: "s", t: "Статус" }, { k: "a", t: "" }],
        DS.royalty.map((r) => ({
          cells: {
            l: locName(r.loc), fr: DS.tenants[r.tenant].name,
            r: fmt.money(r.revenue), p: fmt.money(r.royalty), m: fmt.money(r.marketing),
            s: r.paid ? UI.badge("оплачено", "ok") : UI.badge("ожидает", "warn"),
            a: !r.paid ? '<button class="btn small" data-remind="' + r.loc + '">Напомнить</button>' : ""
          }
        }))) + "</div>";
    el.querySelectorAll("[data-remind]").forEach((b) =>
      b.addEventListener("click", () => {
        emit("ПЛАТФОРМА", "Напоминание о роялти отправлено: " + locName(b.dataset.remind), "warn");
        toast("Напоминание отправлено франчайзи.");
      }));
  });

  // ---------- Заявки точек и франчайзи ----------
  route("erp/requests", (el) => {
    const avgHNow = DS.reqWeeks[DS.reqWeeks.length - 1].avgH;
    el.innerHTML =
      "<h1>📨 Заявки точек и франчайзи</h1>" +
      '<p class="muted">Оборудование, маркетинг, обучение, ИТ. У каждой заявки — таймер SLA; просрочки видны собственнику в пульсе.</p>' +
      '<div class="grid cols-4 mb" id="req-kpis"></div>' +
      '<div class="grid cols-2 mb">' +
      '<div class="card"><h3>SLA по темам (30 дней)</h3>' +
      UI.table(
        [{ k: "t", t: "Тема" }, { k: "n", t: "Заявок", right: 1 }, { k: "a", t: "Ср. время", right: 1 }, { k: "s", t: "SLA соблюдён", right: 1 }],
        DS.reqTopics.map((t) => ({
          cells: {
            t: "<b>" + t.t + "</b>", n: t.n, a: t.avgH + " ч",
            s: UI.badge(t.slaOk + "%", t.slaOk >= 90 ? "ok" : t.slaOk >= 80 ? "warn" : "err")
          }
        }))) + "</div>" +
      '<div class="card"><h3>Время решения — 8 недель</h3>' +
      UI.svgBars(DS.reqWeeks.map((r) => ({
        label: DS.fmtDay(r.ts), v: r.avgH,
        title: "Неделя от " + DS.fmtDay(r.ts) + ": закрыто " + r.closed + ", среднее время " + r.avgH + " ч",
        color: r.avgH <= 16 ? "#16a34a" : "#d97706"
      })), { h: 140 }) +
      '<div class="small muted">Среднее время решения снижается: автоназначение ответственных и эскалация просрочек. Цель ≤ 24 ч.</div></div>' +
      "</div>" +
      '<div class="card pad0"><table class="tbl" id="req-tbl"></table></div>';
    function draw() {
      const open = DS.requests.filter((q) => q.status !== "Выполнена");
      const overdue = DS.requests.filter((q) => q.status === "Просрочена" ||
        (q.status !== "Выполнена" && (DS.NOW - q.ts) / 3600000 > q.slaH));
      document.getElementById("req-kpis").innerHTML =
        UI.kpi("Открытых заявок", open.length) +
        UI.kpi("Просрочено", overdue.length, "SLA нарушен", overdue.length === 0) +
        UI.kpi("Новых за сутки", DS.requests.filter((q) => DS.NOW - q.ts < DS.DAY).length) +
        UI.kpi("Среднее время решения", avgHNow + " ч", "цель ≤ 24 ч", avgHNow <= 24);
      document.getElementById("req-tbl").innerHTML =
        "<tr><th>№</th><th>Точка / франчайзи</th><th>Заявка</th><th>SLA</th><th>Статус</th><th></th></tr>" +
        DS.requests.map((q) => {
          const ageH = (DS.NOW - q.ts) / 3600000;
          const late = q.status !== "Выполнена" && ageH > q.slaH;
          return "<tr><td><b>" + q.id + "</b></td>" +
            "<td>" + locName(q.from) + "<div class='small muted'>" + DS.tenants[q.tenant].name + "</div></td>" +
            "<td><b>" + q.subject + "</b><div class='small muted'>" + esc(q.text) + "</div></td>" +
            "<td>" + (late ? UI.badge("просрочен " + Math.round(ageH - q.slaH) + " ч", "err") :
              q.status === "Выполнена" ? UI.badge("соблюдён", "ok") : UI.badge(fmt.ago(q.ts) + " · лимит " + q.slaH + " ч", "gray")) + "</td>" +
            "<td>" + UI.badge(q.status, q.status === "Выполнена" ? "ok" : q.status === "Просрочена" ? "err" : q.status === "В работе" ? "info" : "gray") + "</td>" +
            '<td class="right">' +
            (q.status === "Новая" ? '<button class="btn small" data-take="' + q.id + '">Взять в работу</button>' :
              q.status === "В работе" || q.status === "Просрочена" ? '<button class="btn small ok" data-close="' + q.id + '">Выполнено</button>' : UI.badge("✓", "ok")) +
            "</td></tr>";
        }).join("");
      el.querySelectorAll("[data-take]").forEach((b) =>
        b.addEventListener("click", () => {
          const q = DS.requests.find((x) => x.id === b.dataset.take);
          q.status = "В работе";
          emit("ПЛАТФОРМА", "Заявка " + q.id + " («" + q.subject + "») взята УК в работу, назначен ответственный", "info");
          draw();
        }));
      el.querySelectorAll("[data-close]").forEach((b) =>
        b.addEventListener("click", () => {
          const q = DS.requests.find((x) => x.id === b.dataset.close);
          q.status = "Выполнена";
          emit("ПЛАТФОРМА", "Заявка " + q.id + " выполнена: франчайзи получил уведомление и оценку качества", "ok");
          toast("Заявка закрыта, франчайзи уведомлён.");
          draw();
        }));
    }
    draw();
  });

  // ---------- Аудиты ----------
  route("erp/audits", (el) => {
    el.innerHTML =
      "<h1>📋 Аудиты и стандарты</h1>" +
      '<p class="muted">Чек-листы с фотофиксацией; нарушение → автозадача с дедлайном; индекс стандарта — в пульс сети.</p>' +
      '<div class="card mb"><h3>Индекс стандарта по точкам</h3>' +
      UI.barsH(DS.locations.filter((l) => l.type !== "Производство").map((l) => {
        const s = stdIndex(l.id);
        return { label: l.name, v: s, text: s + "%", cls: s < 85 ? "err" : s < 92 ? "warn" : "ok" };
      }), 100) + "</div>" +
      '<div class="grid cols-2 mb">' +
      '<div class="card"><h3>Категории нарушений (последние аудиты)</h3>' +
      UI.barsH(DS.violCats.map((v) => ({
        label: v.cat, v: v.n, text: v.n + " наруш.",
        cls: v.cat === "Кухня и ТТК" || v.cat === "Маркировка и сроки" ? "err" : "warn"
      })), null) +
      '<div class="small muted mt">Категория «Кухня и ТТК» связана с фудкостом: каждая недостача по инвентаризации уходит в отклонение точки.</div></div>' +
      '<div class="card"><h3>Динамика стандарта по точкам (4 недели)</h3>' +
      UI.table(
        [{ k: "w", t: "Неделя от" }].concat(DS.locations.filter((l) => l.type !== "Производство").map((l) => ({ k: l.id, t: l.name.split("·")[1].trim(), right: 1 }))),
        DS.stdWeeks.slice(-4).map((w) => {
          const cells = { w: DS.fmtDay(w.ts) };
          DS.locations.filter((l) => l.type !== "Производство").forEach((l) => {
            const v = w.per[l.id];
            cells[l.id] = '<span style="color:var(--' + (v >= 85 ? "ok" : "err") + ')"><b>' + v + "%</b></span>";
          });
          return { cells };
        })) +
      '<div class="small muted mt">«Кировский» стабильно ниже цели — там назначены внеплановые проверки и задачи по ТТК.</div></div>' +
      "</div>" +
      '<div id="audit-detail"></div>';
    const latest = DS.audits.slice(0, 6);
    document.getElementById("audit-detail").innerHTML =
      '<div class="card"><h3>Последние проверки</h3>' +
      UI.table(
        [{ k: "n", t: "Чек-лист" }, { k: "l", t: "Точка" }, { k: "d", t: "Дата" }, { k: "s", t: "Балл", right: 1 }, { k: "t", t: "Задачи" }, { k: "a", t: "" }],
        latest.map((a, i) => ({
          id: a.id,
          cells: {
            n: "<b>" + a.name + "</b>", l: locName(a.loc), d: DS.fmtDay(a.date),
            s: UI.badge(a.score + "%", a.score >= 92 ? "ok" : a.score >= 85 ? "warn" : "err"),
            t: a.tasks.length ? a.tasks.filter((t) => !t.done).length + " открыто" : "нет",
            a: '<button class="btn small" data-aud="' + i + '">Открыть</button>'
          }
        }))) + "</div>";
    el.querySelectorAll("[data-aud]").forEach((b) =>
      b.addEventListener("click", () => openAudit(latest[+b.dataset.aud])));

    function openAudit(a) {
      const box = document.getElementById("audit-detail");
      box.innerHTML =
        '<div class="card mt2" style="border:2px solid var(--brand)"><div class="rowline"><h3 style="margin:0">' + a.name + " — " + locName(a.loc) + "</h3>" +
        UI.badge(a.score + "%", a.score >= 85 ? "ok" : "err") + '<span class="spacer"></span><button class="btn small" id="aud-close">✕</button></div>' +
        a.results.map((r) =>
          '<div class="rowline mt" style="gap:8px">' + (r.ok ? "✅" : "❌") + " " + r.item +
          (r.photo ? ' <span class="tag">📷 фото</span>' : "") +
          (!r.ok ? ' <button class="btn small warn" data-task="' + esc(r.item) + '">Задача на устранение</button>' : "") +
          "</div>").join("") + "</div>";
      document.getElementById("aud-close").addEventListener("click", () => nav("erp", "audits"));
      box.querySelectorAll("[data-task]").forEach((tb) =>
        tb.addEventListener("click", () => {
          emit("ПЛАТФОРМА", "Аудит: задача на устранение «" + tb.dataset.task + "» назначена управляющему, дедлайн 48 ч", "warn");
          toast("Задача создана и видна точке.");
          tb.disabled = true; tb.textContent = "✓ Создана";
        }));
      box.scrollIntoView({ behavior: "smooth" });
    }
  });

  // ---------- Рекомендации ----------
  route("erp/recs", (el) => {
    const fcL3 = DS.foodcostPct("l3").toFixed(1);
    const recs = [
      { sev: "err", t: "«Кировский»: фудкост " + fcL3 + "% (цель ≤ 30%)", d: "Рост цен «Рыбный Дом» на 12% + недостача 2,4 кг сыра по последней инвентаризации.", a: "Назначить слепую инвентаризацию; тендер по лососю среди 2 альтернативных поставщиков", eff: "экономия ~86 тыс ₽/мес" },
      { sev: "err", t: "ККТ 00004881: чеки не уходят в ОФД", d: "34 минуты без передачи фискальных документов — риск штрафов по 54-ФЗ.", a: "Проверить связь на точке; при недоступности — выезд техника сегодня", eff: "предотвращение штрафа до 100 тыс ₽" },
      { sev: "warn", t: "«Северный»: просрочка кухонных тикетов 11%", d: "Пики 19:00–21:00; нормативы превышаются на горячем цехе.", a: "Вывести второго повара в слот 18:30–21:30; пересмотреть норматив пиццы", eff: "+4% заказов в пик ≈ 120 тыс ₽/мес" },
      { sev: "warn", t: "Партии с истекающим сроком: 14 позиций по сети", d: "Наибольшее — «Аэропорт»: авокадо и сливочный сыр (2 дня).", a: "Акционная стоп-позиция «недельное меню» + приоритет в заготовки", eff: "списания −38% ≈ 45 тыс ₽/мес" },
      { sev: "info", t: "Доля прямых заказов растёт: 34% (+4 п.п. за месяц)", d: "Витрина и приложение обгоняют агрегаторов по марже в 3,1 раза.", a: "Масштабировать промо «бонус за прямой заказ» на все точки", eff: "+2 п.п. прямых ≈ 150 тыс ₽/мес маржи" }
    ];
    el.innerHTML =
      "<h1>💡 Рекомендации по сети</h1>" +
      '<p class="muted">Правила считаются на витринах журнала событий: фудкост, скорость, сроки, фискальный мониторинг, каналы. У каждой рекомендации — оценка эффекта.</p>' +
      '<div class="grid cols-3 mb">' +
      UI.kpi("Рекомендаций открыто", recs.length, "по всей сети") +
      UI.kpi("Потенциал эффекта", "≈ 400 тыс ₽/мес", "сумма оценок", true) +
      UI.kpi("Внедрено за месяц", "6 из 9", "эффект подтверждён журналом", true) +
      "</div>" +
      recs.map((r) =>
        '<div class="card mb" style="border-left:4px solid var(--' + (r.sev === "err" ? "err" : r.sev === "warn" ? "warn" : "info") + ')">' +
        '<div class="rowline"><b>' + r.t + "</b>" + UI.badge(r.eff, r.sev === "err" ? "err" : r.sev === "warn" ? "warn" : "ok") + "</div>" +
        "<div class='small mt'>" + r.d + "</div>" +
        '<div class="small mt"><b>Действие:</b> ' + r.a + '</div><div class="rowline mt">' +
        '<button class="btn small primary" data-ok>Взять в работу</button>' +
        (r.sev === "err" ? ' <button class="btn small" data-esc="' + esc(r.t) + '">Эскалировать собственнику</button>' : "") +
        ' <button class="btn small" data-snooze>Отложить</button></div></div>').join("");
    el.querySelectorAll("[data-ok]").forEach((b) =>
      b.addEventListener("click", () => {
        emit("ПЛАТФОРМА", "Рекомендация взята в работу, задача назначена ответственному", "ok");
        toast("Задача создана.");
        b.disabled = true; b.textContent = "✓ В работе";
      }));
    el.querySelectorAll("[data-snooze]").forEach((b) =>
      b.addEventListener("click", () => { toast("Отложено на 3 дня."); b.closest(".card").style.opacity = .45; }));
    el.querySelectorAll("[data-esc]").forEach((b) =>
      b.addEventListener("click", () => {
        emit("РЕШЕНИЕ", "Эскалация собственнику: «" + b.dataset.esc + "» — добавлено в «Решения дня» в кабинете собственника", "warn");
        toast("Эскалировано: собственник увидит в «Решениях дня».");
        b.disabled = true; b.textContent = "✓ Эскалировано";
      }));
  });

  // ---------- Шаблоны точек ----------
  route("erp/templates", (el) => {
    el.innerHTML =
      "<h1>🧩 Шаблоны точек</h1>" +
      '<p class="muted">Версионируемый шаблон: меню, ТТК, цены, права, чек-листы, оборудование. Клонирование новой точки — часы, а не недели.</p>' +
      '<div class="grid cols-3 mb">' +
      UI.kpi("Шаблон", "«Суши-доставка»", "версия 2.7 от 01.10") +
      UI.kpi("Блюд в шаблоне", "48", "библиотека ТТК бренда") +
      UI.kpi("Последний запуск", "2 дня", "«Ловии Суши · Аэропорт»", true) +
      "</div>" +
      '<div class="card"><h3>Состав шаблона</h3>' +
      '<div class="small">' +
      "<div>🍣 Меню и ТТК: 48 блюд, 25 полуфабрикатов, сезонные позиции</div>" +
      "<div>💰 Цены: базовые с допустимой вилкой ±7% по договору</div>" +
      "<div>👥 Права и роли: кассир, повар, управляющий, курьер</div>" +
      "<div>📋 Чек-листы: 4 шаблона аудитов, ХАССП-журналы</div>" +
      "<div>🖥 Оборудование: ККТ АТОЛ 30Ф, KDS-планшеты, принтеры этикеток</div></div>" +
      '<div class="rowline mt"><button class="btn primary" id="clone-tpl">Склонировать точку новому франчайзи</button></div>' +
      '<div id="clone-log" class="mt"></div></div>' +
      '<div class="card mt2"><h3>Последние запуски из шаблона</h3>' +
      UI.table(
        [{ k: "n", t: "Точка" }, { k: "f", t: "Франчайзи" }, { k: "d", t: "Запуск до открытия", right: 1 }, { k: "h", t: "Онбординг" }, { k: "w", t: "Когда" }],
        DS.launchHistory.map((l) => ({
          cells: {
            n: "<b>" + l.name + "</b>", f: l.fr,
            d: l.days + " дн", h: UI.badge(l.h, "ok"), w: DS.fmtDay(l.ts)
          }
        }))) +
      '<div class="small muted mt">«Запуск до открытия» — календарные дни от подписания договора до первой продажи; онбординг — время клонирования шаблона и настройки (часы, не недели).</div></div>';
    document.getElementById("clone-tpl").addEventListener("click", () => {
      const log = document.getElementById("clone-log");
      log.innerHTML = UI.badge("Клонирование…", "info");
      setTimeout(() => {
        log.innerHTML =
          UI.badge("✓ Точка создана", "ok") + " " + UI.badge("✓ Меню и ТТК применены", "ok") + " " + UI.badge("✓ Права выданы", "ok") + " " + UI.badge("✓ Чек-листы назначены", "ok") +
          '<div class="small muted mt">Новая точка «Ловии Суши · Речной» готова к запуску: онбординг занял 12 минут (цель ≤ 3 дня).</div>';
        emit("ПЛАТФОРМА", "Шаблон «Суши-доставка» в2.7 склонирован: новая точка франчайзи готова за 12 минут", "ok");
        toast("Точка клонирована!");
      }, 1200);
    });
  });
})();
