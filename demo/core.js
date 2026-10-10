/* lovii demo — ядро: состояние, роутер, интерфейс, журнал событий, мок-сервисы */
(function () {
  "use strict";

  // ---------- Форматирование ----------
  const fmt = {
    money: (v) => Math.round(v).toLocaleString("ru-RU") + " ₽",
    num: (v) => Math.round(v).toLocaleString("ru-RU"),
    dt: (ts) => new Date(ts).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
    d: (ts) => new Date(ts).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" }),
    t: (ts) => new Date(ts).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
    ago: (ts) => {
      const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
      if (s < 60) return s + " сек назад";
      if (s < 3600) return Math.floor(s / 60) + " мин назад";
      if (s < 86400) return Math.floor(s / 3600) + " ч назад";
      return Math.floor(s / 86400) + " дн назад";
    },
    timer: (sec) => {
      const m = Math.floor(sec / 60), s = sec % 60;
      return m + ":" + String(s).padStart(2, "0");
    }
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- Состояние ----------
  const ROLES = [
    { id: "guest", title: "Гость", entrance: "app", home: "shop" },
    { id: "cashier", title: "Кассир", entrance: "crm", home: "queue" },
    { id: "manager", title: "Управляющий точкой", entrance: "crm", home: "dashboard" },
    { id: "chef", title: "Повар", entrance: "erp", home: "kds" },
    { id: "courier", title: "Курьер", entrance: "erp", home: "courier" },
    { id: "buyer", title: "Закупщик", entrance: "erp", home: "purchasing" },
    { id: "supplier", title: "Поставщик (Рыбный Дом)", entrance: "erp", home: "supplier" },
    { id: "franchisee", title: "Франчайзи (Фуд Восток)", entrance: "crm", home: "franchisee" },
    { id: "uk", title: "Менеджер УК", entrance: "uk", home: "pulse" },
    { id: "owner", title: "Собственник бизнеса", entrance: "uk", home: "owner" }
  ];
  const ENTRANCES = [
    { id: "app", url: "app.lovii.ru", title: "Гость", home: "shop" },
    { id: "crm", url: "crm.lovii.ru", title: "CRM", home: "queue" },
    { id: "erp", url: "erp.lovii.ru", title: "ERP", home: "kds" },
    { id: "uk", url: "erp.lovii.ru/uk", title: "Кабинет УК", home: "pulse" }
  ];
  const state = {
    role: "guest",
    entrance: "app",
    loc: "l1",             // текущая точка контекста
    supplier: "s2",
    cart: [],              // корзина гостя
    myOrders: [],          // заказы гостя в демо-сессии
    cashShift: { opened: false, receipts: [] },
    theme: "light"
  };
  const roleOf = () => ROLES.find((r) => r.id === state.role);

  // ---------- Журнал событий ----------
  const eventLog = [];
  function emit(src, text, kind) {
    eventLog.unshift({ ts: Date.now(), src, text, kind: kind || "info" });
    if (eventLog.length > 400) eventLog.pop();
    renderDrawer();
  }
  // стартовые события
  [
    ["ОФД", "ККТ 00004512: пакет фискальных документов принят (17 чеков)"],
    ["ККТ", "Смена открыта: кассир Ольга Петрова, «Ловии Суши · Центральный»"],
    ["БАНК", "Зачисление по эквайрингу: 84 320 ₽ за 09.10"],
    ["ПЛАТФОРМА", "Автозаказ сформирован для «Ловии Суши · Северный»: 7 позиций"],
    ["ПЛАТФОРМА", "Новый отзыв: 2★ по заказу ORD-100214 — создана задача сервис-рекавери"],
    ["ЕГАИС", "Списание: водка «Царская» 0,05 л × 2, акт подтверждён"],
    ["ЧЗ", "Разрешительный режим: код 01046…6789 проверен, продажа разрешена"]
  ].forEach((e, i) => eventLog.push({ ts: Date.now() - (i + 1) * 190000, src: e[0], text: e[1], kind: "info" }));

  // ---------- Мок-сервисы ----------
  const MockBank = {
    authorize(payment) {
      emit("БАНК", "Авторизация " + payment.method + " на " + fmt.money(payment.sum) + "…", "info");
      return new Promise((resolve) => {
        setTimeout(() => {
          if (payment.method === "Карта" && payment.sum % 997 === 0) {
            emit("БАНК", "Отказ авторизации: недостаточно средств (код 51)", "err");
            resolve({ ok: false, code: "51", reason: "Недостаточно средств на карте" });
          } else {
            const rrn = String(Math.floor(Math.random() * 9e11 + 1e11));
            emit("БАНК", "Одобрено: " + fmt.money(payment.sum) + ", RRN " + rrn + ", комиссия " + (payment.method === "СБП" ? "0,7%" : "1,5%"), "ok");
            resolve({ ok: true, rrn, method: payment.method });
          }
        }, 700);
      });
    },
    refund(sum, reason) {
      emit("БАНК", "Возврат " + fmt.money(sum) + ": " + reason, "warn");
    }
  };
  const MockKKT = {
    printReceipt(order) {
      const fn = 9960440300123456;
      const fd = 100000 + state.cashShift.receipts.length;
      const rec = {
        fd, fn, num: 1200 + state.cashShift.receipts.length,
        ts: Date.now(), sum: order.sum, items: order.items, ofd: "ожидает"
      };
      state.cashShift.receipts.push(rec);
      emit("ККТ", "Чек прихода №" + rec.num + " на " + fmt.money(order.sum) + " записан в ФН (ФФД 1.2)", "ok");
      setTimeout(() => MockOFD.confirm(rec), 1200);
      return rec;
    }
  };
  const MockOFD = {
    confirm(rec) {
      rec.ofd = "принят";
      emit("ОФД", "Чек №" + rec.num + " (ФД " + rec.fd + ") принят и передан в ФНС", "ok");
      renderDrawer();
    },
    alert() {
      emit("ОФД", "⚠ ККТ 00004881 («Кировский»): чеки не уходят более 30 минут", "err");
    }
  };

  // ---------- Роутер ----------
  const screens = {};
  function route(id, fn) { screens[id] = fn; }
  function nav(entrance, screen) {
    const h = "#/" + entrance + "/" + screen;
    if (location.hash === h) render(); // повторный вход на тот же экран — перерисовать
    else location.hash = h;
  }
  function parseHash() {
    const m = (location.hash || "").replace(/^#\//, "").split("/");
    return { entrance: m[0] || null, screen: m[1] || null };
  }
  function render() {
    const h = parseHash();
    const el = document.getElementById("main");
    document.querySelectorAll("#entrance-tabs button").forEach((b) =>
      b.classList.toggle("active", b.dataset.e === h.entrance));
    if (!h.entrance) {
      document.getElementById("addr-label").innerHTML = '<span class="lock">🔒</span> https://<b>lovii.ru</b>/demo';
      document.querySelectorAll("#sidebar .nav-item").forEach((n) => n.classList.remove("active"));
      drawLanding(el);
      window.scrollTo(0, 0);
      return;
    }
    state.entrance = h.entrance;
    const key = h.entrance + "/" + h.screen;
    const ent = ENTRANCES.find((e) => e.id === h.entrance);
    document.getElementById("addr-label").innerHTML =
      '<span class="lock">🔒</span> https://<b>' + ent.url + '</b>/' + (h.screen || "");
    document.querySelectorAll("#sidebar .nav-item").forEach((n) =>
      n.classList.toggle("active", n.dataset.s === h.screen));
    el.innerHTML = "";
    if (screens[key]) screens[key](el);
    else el.innerHTML = '<div class="card"><h2>Экран «' + esc(h.screen || "") + '» в очереди сборки</h2><p class="muted">Демо собирается поэтапно — этот экран появится в следующей итерации.</p></div>';
    if (window.LOVII.guide) window.LOVII.guide.roleBanner(el);
    window.scrollTo(0, 0);
  }

  function drawLanding(el) {
    renderSidebarLanding();
    const intro = {
      guest: "Закажите и оплатите: банк → касса → ОФД → кухня → курьер → отзыв.",
      cashier: "Откройте смену, пробейте чек, оформите возврат, закройте смену.",
      manager: "Дашборд, отзывы, стоп-лист и кампании вашей точки.",
      chef: "Тикеты с таймерами: закройте тикет — спишутся ингредиенты по ТТК.",
      courier: "Заберите заказ и доставьте с фото — гость получит статус.",
      buyer: "Автозаказ по прогнозу, заказы поставщикам, контроль фудкоста.",
      supplier: "Ваш прайс, его конкурентность и заявки от точек сети.",
      franchisee: "Свои точки по договору: выручка, роялти, стандарты.",
      uk: "Пульс сети, аудиты, рекомендации и роялти по всем точкам.",
      owner: "Живые показатели, причины, песочница решений и шаги дня."
    };
    const roleCards = ROLES.map((r) => {
      const g = window.LOVII.guide ? window.LOVII.guide.GUIDES[r.id] : null;
      return '<div class="card role-card"><div class="rowline"><span class="rc-emoji">' + (g ? g.emoji : "▸") +
        "</span><span class='spacer'></span><span class='badge brand'>" + ENTRANCES.find((e) => e.id === r.entrance).url + "</span></div>" +
        "<h3 style='margin-top:6px'>" + r.title + "</h3>" +
        '<div class="rc-sub">' + intro[r.id] + "</div>" +
        '<div class="rowline"><button class="btn small primary" data-role="' + r.id + '">Войти в роль</button>' +
        '<button class="btn small" data-guide-role="' + r.id + '">Сценарий</button></div></div>';
    }).join("");
    el.innerHTML =
      '<div class="landing-hero"><div class="big">lovii<span>·</span>demo</div>' +
      '<p class="muted" style="max-width:700px;margin:10px auto">Это <b>полный интерактив</b>, а не макеты: все данные — вымышленный, но согласованный периметр сети (УК, 2 франчайзи, 4 точки, 5 поставщиков, 2 000 гостей), и каждое ваше действие меняет состояние платформы и пишется в общий журнал событий. Выберите роль — и пройдите свой рабочий день.</p></div>' +
      '<div class="card"><h3>Как пользоваться демо</h3><div class="steps-how">' +
      "<div><b>Выберите роль</b> — внизу или переключателем в шапке. Баннер сверху каждого экрана напомнит, кто вы и что делать дальше.</div>" +
      "<div><b>Идите по сценарию</b> — кнопка «🧭 Сценарий роли» ведёт по шагам; каждый шаг кликабелен и открывает нужный экран.</div>" +
      "<div><b>Смотрите журнал</b> — «⚡ События» в шапке показывает, как ваше действие разлетается по системе: кухня, склад, ОФД, УК.</div>" +
      "</div>" +
      '<div class="rowline"><button class="btn" id="land-events">⚡ Журнал событий</button>' +
      '<a class="btn" href="../research/saas/00-platform-map/">📚 Схема-цель платформы</a>' +
      '<a class="btn" href="../research/saas/02-demo-cabinet/">🎭 Спецификация демо</a></div></div>' +
      "<h2 class='mt2'>10 ролей — 10 рабочих мест одной платформы</h2>" +
      '<div class="grid cols-3">' + roleCards + "</div>";
    el.querySelectorAll("[data-role]").forEach((b) =>
      b.addEventListener("click", () => {
        const r = ROLES.find((x) => x.id === b.dataset.role);
        state.role = r.id;
        const sel = document.getElementById("role-select");
        if (sel) sel.value = r.id;
        emit("ПЛАТФОРМА", "Вход в демо под ролью: " + r.title, "info");
        nav(r.entrance, r.home);
        if (window.LOVII.guide) window.LOVII.guide.openGuide(r.id);
      }));
    el.querySelectorAll("[data-guide-role]").forEach((b) =>
      b.addEventListener("click", () => {
        if (window.LOVII.guide) window.LOVII.guide.openGuide(b.dataset.guideRole);
      }));
    const ev = document.getElementById("land-events");
    if (ev) ev.addEventListener("click", () => {
      document.getElementById("drawer").classList.add("open");
      renderDrawer();
    });
  }

  function renderSidebarLanding() {
    document.getElementById("sidebar").innerHTML =
      '<div class="nav-section">Входы платформы</div>' +
      ENTRANCES.map((e) => '<a class="nav-item" href="#/' + e.id + "/" + e.home + '"><span>▸</span><span>' + e.title + "</span></a>").join("") +
      '<div class="nav-section">Документация</div>' +
      '<a class="nav-item" href="../research/saas/00-platform-map/"><span>🗺</span><span>Карта платформы</span></a>' +
      '<a class="nav-item" href="../research/saas/01-information-flow/"><span>🔀</span><span>Движение информации</span></a>' +
      '<a class="nav-item" href="../research/saas/02-demo-cabinet/"><span>🎭</span><span>Спецификация демо</span></a>' +
      '<a class="nav-item" href="../research/diagram-catalog/"><span>📐</span><span>Каталог схем</span></a>';
  }
  window.addEventListener("hashchange", render);

  // ---------- UI-компоненты ----------
  const UI = {
    kpi(title, value, delta, good) {
      const d = delta ? '<span class="delta ' + (good ? "up" : "down") + '">' + delta + "</span>" : "";
      return '<div class="card kpi"><div class="d">' + title + '</div><div class="v">' + value + "</div>" + d + "</div>";
    },
    table(headers, rows, clickRoute) {
      let html = '<div class="card pad0"><table class="tbl"><tr>';
      headers.forEach((h) => { html += "<th" + (h.right ? ' class="right"' : "") + ">" + h.t + "</th>"; });
      html += "</tr>";
      rows.forEach((r) => {
        html += "<tr" + (clickRoute ? ' class="click" data-href="' + clickRoute + '" data-id="' + (r.id || "") + '"' : "") + ">";
        headers.forEach((h) => { html += "<td" + (h.right ? ' class="right"' : "") + ">" + r.cells[h.k] + "</td>"; });
        html += "</tr>";
      });
      html += "</table></div>";
      return html;
    },
    barsH(items, max) {
      const mx = max || Math.max.apply(null, items.map((i) => i.v));
      return items.map((i) =>
        '<div class="rowline mb" style="gap:8px"><div style="width:190px" class="small">' + i.label +
        '</div><div class="bar ' + (i.cls || "") + '" style="flex:1"><i style="width:' + Math.round(i.v / mx * 100) + '%"></i></div>' +
        '<div class="small right" style="width:80px">' + i.text + "</div></div>").join("");
    },
    svgBars(series, opts) {
      const W = opts.w || 560, H = opts.h || 130, pad = 6;
      const mx = Math.max.apply(null, series.map((s) => s.v)) || 1;
      const bw = (W - pad * 2) / series.length;
      let svg = '<svg viewBox="0 0 ' + W + " " + H + '" style="width:100%;height:auto">';
      series.forEach((s, i) => {
        const bh = Math.max(3, (s.v / mx) * (H - 26));
        svg += '<rect x="' + (pad + i * bw + 1) + '" y="' + (H - 18 - bh) + '" width="' + (bw - 2) + '" height="' + bh +
          '" rx="2" fill="' + (s.color || "#7c3aed") + '" opacity="0.85"><title>' + s.label + ": " + s.title + "</title></rect>";
        if (i % Math.ceil(series.length / 10) === 0) {
          svg += '<text x="' + (pad + i * bw + bw / 2) + '" y="' + (H - 4) + '" font-size="9" text-anchor="middle" fill="#8a90a5">' + s.label + "</text>";
        }
      });
      svg += "</svg>";
      return svg;
    },
    donut(parts) {
      const total = parts.reduce((s, p) => s + p.v, 0) || 1;
      let acc = 0, paths = "";
      const R1 = 40, R2 = 26, C = 50;
      parts.forEach((p) => {
        const a0 = acc / total * Math.PI * 2 - Math.PI / 2, a1 = (acc + p.v) / total * Math.PI * 2 - Math.PI / 2;
        acc += p.v;
        const large = a1 - a0 > Math.PI ? 1 : 0;
        paths += '<path d="M ' + (C + R1 * Math.cos(a0)) + " " + (C + R1 * Math.sin(a0)) +
          " A " + R1 + " " + R1 + " 0 " + large + " 1 " + (C + R1 * Math.cos(a1)) + " " + (C + R1 * Math.sin(a1)) +
          " L " + (C + R2 * Math.cos(a1)) + " " + (C + R2 * Math.sin(a1)) +
          " A " + R2 + " " + R2 + " 0 " + large + " 0 " + (C + R2 * Math.cos(a0)) + " " + (C + R2 * Math.sin(a0)) +
          ' Z" fill="' + p.color + '"><title>' + p.label + ": " + p.v + "</title></path>";
      });
      return '<svg viewBox="0 0 100 100" style="width:130px;height:130px">' + paths + "</svg>";
    },
    badge(text, cls) { return '<span class="badge ' + (cls || "gray") + '">' + text + "</span>"; },
    stars(n) { return '<span class="stars">' + "★".repeat(n) + "</span><span class='muted'>" + "★".repeat(5 - n) + "</span>"; }
  };

  // ---------- Тосты ----------
  function toast(text) {
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = text;
    document.getElementById("toasts").appendChild(t);
    setTimeout(() => t.remove(), 4200);
  }

  // ---------- Drawer журнала ----------
  function renderDrawer() {
    const body = document.getElementById("drawer-body");
    if (!body) return;
    body.innerHTML = eventLog.slice(0, 80).map((e) =>
      '<div class="ev"><span class="ts">' + fmt.t(e.ts) + '</span><span class="src badge ' +
      ({ ok: "ok", err: "err", warn: "warn" }[e.kind] || "brand") + '">' + e.src +
      "</span>" + esc(e.text) + "</div>").join("");
  }

  // ---------- Сайдбары входов ----------
  const NAV = {
    app: [
      { s: "shop", i: "🍣", t: "Витрина и заказ" },
      { s: "myorders", i: "📦", t: "Мои заказы" },
      { s: "profile", i: "👤", t: "Профиль и бонусы" }
    ],
    crm: [
      { s: "queue", i: "🧾", t: "Очередь заказов" },
      { s: "dashboard", i: "📊", t: "Дашборд точки" },
      { s: "guests", i: "👥", t: "Гости и сегменты" },
      { s: "campaigns", i: "🎯", t: "Кампании" },
      { s: "reviews", i: "⭐", t: "Отзывы" },
      { s: "stoplist", i: "🚫", t: "Стоп-лист" },
      { s: "shift", i: "💰", t: "Смена и чеки" },
      { s: "franchisee", i: "🤝", t: "Кабинет франчайзи" }
    ],
    erp: [
      { s: "kds", i: "🍳", t: "Кухня (KDS)" },
      { s: "warehouse", i: "📦", t: "Склад и партии" },
      { s: "purchasing", i: "🛒", t: "Закупки" },
      { s: "foodcost", i: "🧮", t: "Фудкост" },
      { s: "delivery", i: "🛵", t: "Доставка" },
      { s: "courier", i: "🏃", t: "Мои доставки" },
      { s: "supplier", i: "🏭", t: "Портал поставщика" }
    ],
    uk: [
      { s: "owner", i: "👑", t: "Собственник" },
      { s: "pulse", i: "🌐", t: "Пульс сети" },
      { s: "royalty", i: "💳", t: "Роялти" },
      { s: "audits", i: "📋", t: "Аудиты и стандарты" },
      { s: "recs", i: "💡", t: "Рекомендации" },
      { s: "templates", i: "🧩", t: "Шаблоны точек" }
    ]
  };

  // ---------- Каркас ----------
  function boot() {
    const top = document.getElementById("topbar");
    top.innerHTML =
      '<div class="logo">lovii<span>·</span>demo</div>' +
      '<div id="entrance-tabs">' + ENTRANCES.map((e) =>
        '<button data-e="' + e.id + '">' + e.title + "</button>").join("") + "</div>" +
      '<div class="addr" id="addr-label"></div>' +
      '<div class="grow"></div>' +
      '<select id="role-select" title="Роль">' +
      ROLES.map((r) => '<option value="' + r.id + '">' + r.title + "</option>").join("") + "</select>" +
      '<button class="btn small" id="guide-btn" title="Сценарий текущей роли">🧭 Гид</button>' +
      '<button class="btn small" id="ev-btn" title="Журнал событий платформы">⚡ События</button>' +
      '<button class="btn small" id="theme-btn" title="Тема">🌓</button>' +
      '<a class="btn small" href="../index.html" title="Документация">📚 Документы</a>';

    document.getElementById("layout").innerHTML =
      '<nav id="sidebar"></nav><main id="main"></main>';

    document.querySelectorAll("#entrance-tabs button").forEach((b) =>
      b.addEventListener("click", () => nav(b.dataset.e, ENTRANCES.find((e) => e.id === b.dataset.e).home)));

    const sel = document.getElementById("role-select");
    sel.value = state.role;
    sel.addEventListener("change", () => {
      state.role = sel.value;
      const r = roleOf();
      emit("ПЛАТФОРМА", "Вход в демо под ролью: " + r.title, "info");
      nav(r.entrance, r.home);
    });

    document.getElementById("ev-btn").addEventListener("click", () => {
      document.getElementById("drawer").classList.toggle("open");
      renderDrawer();
    });
    document.getElementById("guide-btn").addEventListener("click", () => {
      if (window.LOVII.guide) window.LOVII.guide.openGuide();
    });
    document.getElementById("theme-btn").addEventListener("click", () => {
      document.body.classList.toggle("dark");
    });

    const dw = document.getElementById("drawer");
    dw.innerHTML = '<div class="d-head"><b>⚡ Журнал событий платформы</b><button class="btn small" id="d-close">✕</button></div>' +
      '<div class="d-body" id="drawer-body"></div>' +
      '<div style="padding:8px 14px;border-top:1px solid var(--line)" class="small muted">Каждое действие гостя, кассы, кухни, склада и партнёров — одно событие в общем журнале (правила: <a href="../research/saas/01-information-flow/">движение информации</a>).</div>';
    document.getElementById("d-close").addEventListener("click", () => dw.classList.remove("open"));

    // делегирование кликов по строкам таблиц
    document.addEventListener("click", (e) => {
      const tr = e.target.closest("tr.click");
      if (tr && tr.dataset.href) location.hash = tr.dataset.href + (tr.dataset.id ? "/" + tr.dataset.id : "");
    });

    renderDrawer();
    render();
    // живой таймер тикетов
    setInterval(() => {
      document.querySelectorAll("[data-ticker]").forEach((el) => {
        const started = +el.dataset.ticker;
        const sec = Math.floor((Date.now() - started) / 1000);
        el.textContent = fmt.timer(sec);
        const card = el.closest(".ticket");
        if (card && sec > +el.dataset.norm) card.classList.add("late");
      });
    }, 1000);
    // редкие «входящие» события
    setInterval(() => {
      const pool = [
        ["ПЛАТФОРМА", "Заказ из Яндекс Еды принят в общую очередь (комиссия 29,17%)"],
        ["ОФД", "Пакет ФД принят: 4 документа, «Ловии Суши · Северный»"],
        ["БАНК", "Зачисление по СБП: 2 140 ₽"],
        ["ЧЗ", "Маркировка: выведено из оборота 3 ед. (вода)"],
        ["ПЛАТФОРМА", "Гость идентифицирован по номеру телефона: сегмент «Лояльный»"]
      ];
      const e = pool[Math.floor(Math.random() * pool.length)];
      emit(e[0], e[1]);
    }, 25000);
  }

  function renderSidebar() {
    const items = NAV[state.entrance] || [];
    document.getElementById("sidebar").innerHTML =
      '<div class="nav-section">' + (ENTRANCES.find((e) => e.id === state.entrance).title) + " · " +
      DS.locations.find((l) => l.id === state.loc).name + "</div>" +
      items.map((n) => '<a class="nav-item" data-s="' + n.s + '" href="#/' + state.entrance + "/" + n.s + '">' +
        '<span>' + n.i + "</span><span>" + n.t + "</span></a>").join("") +
      '<div class="nav-section">Контекст</div>' +
      '<select id="loc-select" style="width:100%;margin:0 2px">' +
      DS.locations.map((l) => '<option value="' + l.id + '"' + (l.id === state.loc ? " selected" : "") + ">" + l.name + "</option>").join("") +
      "</select>";
    const ls = document.getElementById("loc-select");
    if (ls) ls.addEventListener("change", () => { state.loc = ls.value; render(); });
  }

  window.LOVII = {
    state, fmt, esc, route, nav, render, renderSidebar, UI, toast, emit,
    MockBank, MockKKT, MockOFD, ROLES, ENTRANCES, roleOf
  };
  document.addEventListener("DOMContentLoaded", boot);
})();
