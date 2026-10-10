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

  // ---------- Пульс сети ----------
  route("uk/pulse", (el) => {
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
      '<div class="card mt2"><h3>Сравнение точек</h3>' +
      UI.table(
        [{ k: "l", t: "Точка" }, { k: "t", t: "Франчайзи" }, { k: "fc", t: "Фудкост", right: 1 }, { k: "n", t: "NPS", right: 1 }, { k: "s", t: "Стандарт", right: 1 }, { k: "w", t: "Доставка в окно", right: 1 }, { k: "z", t: "Зона" }],
        DS.locations.filter((l) => l.type !== "Производство").map((l) => {
          const fc = DS.foodcostPct(l.id);
          const std = stdIndex(l.id);
          const win = Math.round(DS.orders.filter((o) => o.loc === l.id && o.delivery && o.inWindow).length / (DS.orders.filter((o) => o.loc === l.id && o.delivery).length || 1) * 100);
          const red = fc > 30 || std < 85;
          return {
            cells: {
              l: "<b>" + l.name + "</b>",
              t: DS.tenants[l.tenant].name,
              fc: fc + "%", n: nps(l.id), s: std + "%", w: win + "%",
              z: red ? UI.badge("красная", "err") : UI.badge("зелёная", "ok")
            }
          };
        })) + "</div>";
  });

  // ---------- Роялти ----------
  route("uk/royalty", (el) => {
    el.innerHTML =
      "<h1>💳 Роялти — автоматический расчёт</h1>" +
      '<p class="muted">База расчёта — фискальная выручка из ОФД: юридически достоверный источник, без участия бухгалтера.</p>' +
      '<div class="grid cols-3 mb">' +
      UI.kpi("Начислено за месяц", fmt.money(DS.royalty.reduce((s, r) => s + r.royalty + r.marketing, 0)), "5% + 2%") +
      UI.kpi("Оплачено", fmt.money(DS.royalty.filter((r) => r.paid).reduce((s, r) => s + r.royalty + r.marketing, 0))) +
      UI.kpi("Просрочено", DS.royalty.filter((r) => !r.paid).length + " точки", "", false) +
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

  // ---------- Аудиты ----------
  route("uk/audits", (el) => {
    el.innerHTML =
      "<h1>📋 Аудиты и стандарты</h1>" +
      '<p class="muted">Чек-листы с фотофиксацией; нарушение → автозадача с дедлайном; индекс стандарта — в пульс сети.</p>' +
      '<div class="card mb"><h3>Индекс стандарта по точкам</h3>' +
      UI.barsH(DS.locations.filter((l) => l.type !== "Производство").map((l) => {
        const s = stdIndex(l.id);
        return { label: l.name, v: s, text: s + "%", cls: s < 85 ? "err" : s < 92 ? "warn" : "ok" };
      }), 100) + "</div>" +
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
      document.getElementById("aud-close").addEventListener("click", () => nav("uk", "audits"));
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
  route("uk/recs", (el) => {
    const recs = [
      { sev: "err", t: "«Кировский»: фудкост 31,8% (+3,8 п.п. к цели)", d: "Рост цен «Рыбный Дом» на 12% + недостача 2,4 кг сыра по последней инвентаризации.", a: "Назначить слепую инвентаризацию; тендер по лососю среди 2 альтернативных поставщиков" },
      { sev: "err", t: "ККТ 00004881: чеки не уходят в ОФД", d: "34 минуты без передачи фискальных документов — риск штрафов по 54-ФЗ.", a: "Проверить связь на точке; при недоступности — выезд техника сегодня" },
      { sev: "warn", t: "«Северный»: просрочка кухонных тикетов 11%", d: "Пики 19:00–21:00; нормативы превышаются на горячем цехе.", a: "Вывести второго повара в слот 18:30–21:30; пересмотреть норматив пиццы" },
      { sev: "warn", t: "Партии с истекающим сроком: 14 позиций по сети", d: "Наибольшее — «Аэропорт»: авокадо и сливочный сыр (2 дня).", a: "Акционная стоп-позиция «недельное меню» + приоритет в заготовки" },
      { sev: "info", t: "Доля прямых заказов растёт: 34% (+4 п.п. за месяц)", d: "Витрина и приложение обгоняют агрегаторов по марже в 3,1 раза.", a: "Масштабировать промо «бонус за прямой заказ» на все точки" }
    ];
    el.innerHTML =
      "<h1>💡 Рекомендации по сети</h1>" +
      '<p class="muted">Правила считаются на витринах журнала событий: фудкост, скорость, сроки, фискальный мониторинг, каналы.</p>' +
      recs.map((r) =>
        '<div class="card mb" style="border-left:4px solid var(--' + (r.sev === "err" ? "err" : r.sev === "warn" ? "warn" : "info") + ')">' +
        "<b>" + r.t + "</b><div class='small mt'>" + r.d + "</div>" +
        '<div class="small mt"><b>Действие:</b> ' + r.a + '</div><div class="rowline mt">' +
        '<button class="btn small primary" data-ok>Взять в работу</button> <button class="btn small" data-snooze>Отложить</button></div></div>').join("");
    el.querySelectorAll("[data-ok]").forEach((b) =>
      b.addEventListener("click", () => {
        emit("ПЛАТФОРМА", "Рекомендация взята в работу, задача назначена ответственному", "ok");
        toast("Задача создана.");
        b.disabled = true; b.textContent = "✓ В работе";
      }));
    el.querySelectorAll("[data-snooze]").forEach((b) =>
      b.addEventListener("click", () => { toast("Отложено на 3 дня."); b.closest(".card").style.opacity = .45; }));
  });

  // ---------- Шаблоны точек ----------
  route("uk/templates", (el) => {
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
      '<div id="clone-log" class="mt"></div></div>';
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
