/* lovii demo — мок-датасет корпоративного уровня (детерминированный) */
(function () {
  "use strict";

  // --- PRNG (mulberry32) ---
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const R = rng(20261010);
  const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(R() * arr.length)];
  const chance = (p) => R() < p;

  // --- Время ---
  const NOW = new Date(); NOW.setHours(14, 32, 0, 0);
  const DAY = 86400000;
  const fmtDay = (ts) => new Date(ts).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });

  // --- Тенанты и точки ---
  const tenants = {
    uk: { id: "uk", type: "УК", name: "УК «Ловии»" },
    fr1: { id: "fr1", type: "Франчайзи", name: "ООО «Фуд Восток»", royaltyPct: 5, marketingPct: 2 },
    fr2: { id: "fr2", type: "Франчайзи", name: "ИП Смирнова А.В.", royaltyPct: 5, marketingPct: 2 },
    ind: { id: "ind", type: "Пилот", name: "Собственное производство" }
  };
  const locations = [
    { id: "l1", tenant: "fr1", name: "Ловии Суши · Центральный", type: "Зал + доставка", factor: 1.25 },
    { id: "l2", tenant: "fr1", name: "Ловии Суши · Северный", type: "Дарк китчен", factor: 0.9 },
    { id: "l3", tenant: "fr2", name: "Ловии Суши · Кировский", type: "Зал + доставка", factor: 1.05 },
    { id: "l4", tenant: "fr2", name: "Ловии Суши · Аэропорт", type: "Фудкорт", factor: 0.75 },
    { id: "l5", tenant: "ind", name: "Фабрика-кухня «Ловии»", type: "Производство", factor: 0.6 }
  ];

  // --- Меню и ТТК ---
  const cats = [
    { id: "rolls", name: "Роллы", base: ["Филадельфия", "Калифорния", "Дракон", "Запечённый лосось", "Унаги маки", "Спайси тунец", "Вегетарианский", "Темпура"], price: [320, 620] },
    { id: "pizza", name: "Пицца", base: ["Маргарита", "Пепперони", "Четыре сыра", "Цыплёнок барбекю", "Морская", "Дьябло"], price: [390, 690] },
    { id: "wok", name: "Вок", base: ["Удон с говядиной", "Соба с курицей", "Фунчоза с креветкой", "Рис с овощами"], price: [290, 460] },
    { id: "salads", name: "Салаты", base: ["Цезарь", "Греческий", "Чука", "С лососем"], price: [240, 420] },
    { id: "drinks", name: "Напитки", base: ["Лимонад юдзу", "Морс клюквенный", "Кола", "Чай жасмин", "Капучино"], price: [90, 220] },
    { id: "desserts", name: "Десерты", base: ["Чизкейк", "Моти", "Тирамису"], price: [180, 320] }
  ];
  const menu = [];
  cats.forEach((c) => {
    c.base.forEach((n, i) => {
      const price = ri(c.price[0], c.price[1]);
      const costPct = c.id === "drinks" ? ri(14, 22) : c.id === "desserts" ? ri(20, 28) : ri(24, 36);
      menu.push({
        id: c.id + "-" + i, cat: c.id, catName: c.name, name: n,
        price, cost: Math.round(price * costPct / 100),
        prepNormSec: c.id === "drinks" ? ri(60, 120) : c.id === "pizza" ? ri(600, 780) : ri(300, 540),
        stop: false, hit: chance(0.18)
      });
    });
  });

  // --- Ингредиенты ---
  const ing = [
    ["Рис для суши", "кг", 165], ["Нори", "уп", 520], ["Лосось", "кг", 1390], ["Угорь", "кг", 2100],
    ["Огурец", "кг", 140], ["Авокадо", "кг", 380], ["Сыр сливочный", "кг", 620], ["Икра тобико", "кг", 1450],
    ["Мука", "кг", 62], ["Сыр моцарелла", "кг", 780], ["Колбаса пепперони", "кг", 890], ["Томатный соус", "кг", 240],
    ["Куриное филе", "кг", 360], ["Говядина", "кг", 720], ["Креветка", "кг", 1150], ["Лапша удон", "кг", 210],
    ["Салат романо", "кг", 290], ["Помидоры", "кг", 220], ["Молоко", "л", 82], ["Кофе зерно", "кг", 1400],
    ["Сахар", "кг", 74], ["Лимон", "кг", 190], ["Клюква", "кг", 410], ["Соевый соус", "л", 190],
    ["Упаковка ролл-бокс", "шт", 18], ["Упаковка пицца-коробка", "шт", 22], ["Стакан 0.4", "шт", 7],
    ["Палочки/приборы", "компл", 9], ["Майонез", "кг", 210], ["Тунец", "кг", 1250]
  ].map((x, i) => ({ id: "i" + i, name: x[0], unit: x[1], price: x[2] }));

  // ТТК: 3–6 ингредиентов на блюдо
  const ttk = {};
  menu.forEach((m) => {
    const lines = [];
    const n = ri(3, 6);
    const used = new Set();
    for (let i = 0; i < n; i++) {
      const g = pick(ing);
      if (used.has(g.id)) continue;
      used.add(g.id);
      lines.push({ ing: g.id, qty: +(R() * 0.25 + 0.02).toFixed(3) });
    }
    ttk[m.id] = lines;
  });

  // --- Поставщики и прайсы ---
  const suppliers = [
    { id: "s1", name: "Агро-Маркет", cat: "Овощи и фрукты", discount: 0 },
    { id: "s2", name: "Рыбный Дом", cat: "Рыба и морепродукты", discount: 0, alert: "Лосось подорожал на 12% с 01.10" },
    { id: "s3", name: "МилкПро", cat: "Молочные продукты", discount: 2 },
    { id: "s4", name: "МясоТрейд", cat: "Мясо и птица", discount: 0 },
    { id: "s5", name: "УпаковкаСервис", cat: "Упаковка и расходники", discount: 5 }
  ];
  const prices = {}; // supplierId -> [{ing, price}]
  suppliers.forEach((s) => {
    prices[s.id] = ing.filter(() => chance(0.42)).map((g) => ({
      ing: g.id,
      price: Math.round(g.price * (1 - s.discount / 100) * (s.id === "s2" && g.name === "Лосось" ? 1.12 : 1) * (0.94 + R() * 0.12))
    }));
  });
  // Для демо-сценария поставщика гарантируем у «Рыбного Дома» позиции вне рынка:
  // лосось и ещё одна позиция заведомо дороже рынка — их можно «пересмотреть».
  (function ensureOverpriced() {
    const s2 = prices.s2;
    const los = ing.find((g) => g.name === "Лосось");
    const other = ing.find((g) => g.id !== los.id);
    if (!s2.find((p) => p.ing === los.id)) s2.unshift({ ing: los.id, price: 0 });
    s2.find((p) => p.ing === los.id).price = Math.round(los.price * 1.12);
    if (!s2.find((p) => p.ing === other.id)) s2.unshift({ ing: other.id, price: 0 });
    s2.find((p) => p.ing === other.id).price = Math.round(other.price * 1.15);
  })();

  // --- Склад: партии и остатки ---
  const lots = [];
  const stock = {}; // locId+ingId -> qty
  locations.forEach((l) => {
    ing.forEach((g) => {
      const key = l.id + ":" + g.id;
      const qty = +(R() * 25 + 2).toFixed(1);
      stock[key] = qty;
      const daysToExpire = ri(1, 21);
      lots.push({
        id: "LOT-" + l.id + "-" + g.id, loc: l.id, ing: g.id,
        qty, receivedAt: NOW.getTime() - ri(0, 9) * DAY,
        expiresAt: NOW.getTime() + daysToExpire * DAY,
        soon: daysToExpire <= 2
      });
    });
  });

  // --- Персонал и курьеры ---
  const firstM = ["Алексей", "Дмитрий", "Сергей", "Иван", "Максим", "Артём"];
  const firstF = ["Анна", "Мария", "Ольга", "Елена", "Дарья", "Ксения"];
  const last = ["Иванов", "Петров", "Сидоров", "Кузнецов", "Смирнов", "Волков", "Фёдоров", "Морозов"];
  const staff = [];
  locations.forEach((l) => {
    if (l.type === "Производство") return;
    ["Кассир", "Кассир", "Повар", "Повар", "Повар", "Су-шеф", "Управляющий"].forEach((role, i) => {
      staff.push({
        id: l.id + "-st" + i, loc: l.id, role,
        name: pick(chance(0.5) ? firstM : firstF) + " " + pick(last),
        rate: role === "Управляющий" ? 0 : ri(220, 340)
      });
    });
  });
  const couriers = [];
  locations.forEach((l) => {
    if (l.type === "Производство") return;
    for (let i = 0; i < 5; i++) {
      couriers.push({
        id: l.id + "-c" + i, loc: l.id,
        name: pick(firstM) + " " + pick(last),
        vehicle: pick(["Пеший", "Вело", "Авто"]),
        deliveredToday: ri(2, 9), rating: (4 + R()).toFixed(1),
        status: i < 2 ? "Свободен" : i < 4 ? "В пути" : "Смена закрыта"
      });
    }
  });

  // --- Гости ---
  const segments = ["VIP", "Лояльный", "Регулярный", "Новый", "Спящий"];
  const guests = [];
  for (let i = 0; i < 2000; i++) {
    const visits = ri(1, 60);
    const total = visits * ri(500, 1900);
    const lastDaysAgo = ri(0, 120);
    const seg = visits > 30 ? "VIP" : lastDaysAgo > 60 ? "Спящий" : visits <= 2 ? "Новый" : visits > 12 ? "Лояльный" : "Регулярный";
    guests.push({
      id: "g" + i,
      name: pick(firstM.concat(firstF)) + " " + pick(last),
      phone: "+7 9" + ri(10, 99) + " ***-" + String(ri(10, 99)) + "-" + String(ri(10, 99)),
      visits, total, lastDaysAgo, seg,
      points: ri(0, 3400), nps: ri(6, 10)
    });
  }

  // --- Заказы: 30 дней истории + активные тикеты ---
  const channels = [
    { id: "hall", name: "Зал", w: 34 }, { id: "site", name: "Сайт", w: 18 },
    { id: "app", name: "Приложение", w: 14 }, { id: "agg", name: "Агрегаторы", w: 27 },
    { id: "phone", name: "Телефон", w: 7 }
  ];
  function pickChannel() {
    let x = R() * 100;
    for (const c of channels) { if (x < c.w) return c; x -= c.w; }
    return channels[0];
  }
  const orders = [];       // последние ~500 детально
  const dailyByLoc = {};   // locId -> [{ts, revenue, orders}]
  locations.forEach((l) => { dailyByLoc[l.id] = []; });
  let seq = 100000;
  for (let d = 30; d >= 1; d--) {
    const ts0 = NOW.getTime() - d * DAY;
    const dow = new Date(ts0).getDay();
    const weekend = dow === 5 || dow === 6 ? 1.35 : 1;
    locations.forEach((l) => {
      const n = Math.round(ri(55, 85) * l.factor * weekend);
      let rev = 0;
      for (let i = 0; i < n; i++) rev += ri(450, 1800);
      rev = Math.round(rev * (l.id === "l5" ? 0.4 : 1));
      dailyByLoc[l.id].push({ ts: ts0, revenue: rev, orders: n });
      // детальные заказы — только за последние 3 дня и не все
      if (d <= 3) {
        const keep = Math.min(n, d === 1 ? 60 : 26);
        for (let i = 0; i < keep; i++) {
          const ch = pickChannel();
          const items = [];
          const cnt = ri(1, 4);
          let sum = 0;
          for (let k = 0; k < cnt; k++) {
            const m = pick(menu);
            const q = chance(0.2) ? 2 : 1;
            items.push({ menu: m.id, name: m.name, qty: q, price: m.price });
            sum += m.price * q;
          }
          const delivery = ch.id !== "hall" && chance(0.8);
          const isToday = d === 1;
          const h = ri(11, 22);
          orders.push({
            id: "ORD-" + (++seq), loc: l.id, channel: ch.id, channelName: ch.name,
            ts: ts0 + h * 3600000 + ri(0, 59) * 60000,
            items, sum, guest: chance(0.62) ? pick(guests).id : null,
            delivery,
            status: isToday ? pick(["Выполнен", "Выполнен", "Выполнен", "Доставляется"]) : "Выполнен",
            inWindow: delivery ? chance(0.91) : true,
            pay: pick(["Карта", "Карта", "СБП", "Наличные", "Бонусы+карта"])
          });
        }
      }
    });
  }
  orders.sort((a, b) => b.ts - a.ts);

  // Активные тикеты кухни (сейчас)
  const tickets = [];
  locations.forEach((l) => {
    if (l.type === "Производство") return;
    for (let i = 0; i < ri(3, 5); i++) {
      const m1 = pick(menu.filter((x) => x.cat !== "drinks"));
      const items = [{ name: m1.name, qty: 1, note: chance(0.3) ? "Без лука" : "" }];
      if (chance(0.6)) items.push({ name: pick(menu).name, qty: 1, note: "" });
      tickets.push({
        id: "T-" + l.id + "-" + i, loc: l.id,
        startedAt: NOW.getTime() - ri(40, 900) * 1000,
        normSec: ri(300, 720), items,
        status: i === 0 ? "Готов" : "Готовится",
        station: pick(["Горячий цех", "Холодный цех", "Гриль", "Суши-станция"])
      });
    }
  });

  // --- Отзывы ---
  const revTexts = {
    5: ["Всё супер, роллы свежие!", "Лучшая доставка в городе, курьер молодец.", "Очень вкусно, заказываем каждую пятницу."],
    4: ["Хорошо, но чуть долго ждали.", "Вкусно, упаковка аккуратная.", "Пицца отличная, соус можно получше."],
    3: ["Средне: рис переварен.", "Заказ собрали, но забыли палочки.", "Нормально, но не вау."],
    2: ["Привезли холодное.", "Перепутали позиции в заказе.", "Долго, больше часа."],
    1: ["Ужасно, всё развалилось.", "Не привезли половину заказа."]
  };
  const reviews = [];
  for (let i = 0; i < 130; i++) {
    const r = chance(0.55) ? 5 : chance(0.55) ? 4 : chance(0.5) ? 3 : chance(0.6) ? 2 : 1;
    const o = pick(orders);
    reviews.push({
      id: "RV-" + i, order: o.id, loc: o.loc, guest: o.guest,
      src: pick(["Яндекс Карты", "2ГИС", "Приложение", "Google Maps"]),
      rating: r, text: pick(revTexts[r]),
      ts: o.ts + ri(40, 200) * 60000,
      dish: pick(o.items).name,
      courier: o.delivery ? (couriers.filter((c) => c.loc === o.loc).length ? pick(couriers.filter((c) => c.loc === o.loc)).name : null) : null,
      answered: chance(0.7)
    });
  }

  // --- Закупки ---
  const purchaseOrders = [];
  for (let i = 0; i < 14; i++) {
    const s = pick(suppliers);
    const st = pick(["Подтверждён", "Отправлен", "Принят", "Ожидает подтверждения"]);
    purchaseOrders.push({
      id: "PO-" + (2400 + i), supplier: s.id, loc: pick(locations.filter((l) => l.type !== "Производство")).id,
      created: NOW.getTime() - ri(0, 12) * DAY,
      status: st,
      sum: ri(8000, 64000),
      auto: chance(0.7),
      lines: Array.from({ length: ri(3, 7) }, () => ({ ing: pick(prices[s.id]).ing, qty: +(R() * 12 + 1).toFixed(1) }))
    });
  }

  // --- Аудиты и чек-листы ---
  const auditTemplates = [
    { id: "a1", name: "Открытие и закрытие смены", items: ["Касса открыта по регламенту", "Размен проверен", "Стоп-лист сверен", "Чистота зала по чек-листу", "Закрытие смены с Z-отчётом", "Инкассация оформлена"] },
    { id: "a2", name: "ХАССП: температуры и сроки", items: ["Температуры холодильников в норме", "Маркировка заготовок", "Ротация ФИФО", "Бракераж журнала", "Сроки годности проверены", "Дефростация по графику"] },
    { id: "a3", name: "Санитария и персонал", items: ["Медкнижки актуальны", "Форма и гигиена", "Уборка по зонам", "Дезсредства в наличии"] },
    { id: "a4", name: "Касса и деньги", items: ["Скидки по правам", "Возвраты с основаниями", "Сверка эквайринга", "Открытые чеки отсутствуют"] }
  ];
  const audits = [];
  locations.forEach((l) => {
    if (l.type === "Производство") return;
    auditTemplates.forEach((t) => {
      const results = t.items.map((it) => ({ item: it, ok: chance(l.id === "l3" ? 0.72 : 0.9), photo: chance(0.4) }));
      const score = Math.round(results.filter((r) => r.ok).length / results.length * 100);
      audits.push({
        id: "AUD-" + l.id + "-" + t.id, loc: l.id, template: t.id, name: t.name,
        date: NOW.getTime() - ri(0, 6) * DAY, results, score,
        tasks: results.filter((r) => !r.ok).map((r) => ({ text: r.item, due: NOW.getTime() + ri(1, 4) * DAY, done: chance(0.4) }))
      });
    });
  });

  // --- Роялти (текущий месяц) ---
  const royalty = locations.filter((l) => l.tenant === "fr1" || l.tenant === "fr2").map((l) => {
    const rev = dailyByLoc[l.id].slice(-28).reduce((s, x) => s + x.revenue, 0);
    const t = tenants[l.tenant];
    return {
      loc: l.id, tenant: l.tenant, revenue: rev,
      royalty: Math.round(rev * t.royaltyPct / 100),
      marketing: Math.round(rev * t.marketingPct / 100),
      paid: chance(0.75)
    };
  });

  // --- Заявки точек и франчайзи в УК ---
  const requests = [
    { id: "REQ-101", from: "l2", tenant: "fr1", subject: "Оборудование", text: "Холодильный стол на горячем цехе перестал держать температуру", ts: NOW - 1.2 * DAY, status: "В работе", slaH: 24 },
    { id: "REQ-102", from: "l3", tenant: "fr2", subject: "Маркетинг", text: "Согласовать локальную акцию: ролл месяца по спеццене", ts: NOW - 2.6 * DAY, status: "Новая", slaH: 48 },
    { id: "REQ-103", from: "l1", tenant: "uk", subject: "Зона доставки", text: "Расширить зону доставки на микрорайон «Северный парк»", ts: NOW - 3.4 * DAY, status: "Выполнена", slaH: 72 },
    { id: "REQ-104", from: "l4", tenant: "fr2", subject: "Онбординг", text: "Обучить двух новых поваров работе с ТТК и KDS", ts: NOW - 0.4 * DAY, status: "Новая", slaH: 48 },
    { id: "REQ-105", from: "l3", tenant: "fr2", subject: "ИТ", text: "KDS-планшет на горячем цехе зависает в пиковые часы", ts: NOW - 4.8 * DAY, status: "Просрочена", slaH: 24 }
  ];

  // --- Взаиморасчёты с поставщиками ---
  const settlements = suppliers.map((s, i) => {
    const delivered = ri(380, 940) * 1000;
    const debtShare = [0.18, 0.32, 0, 0.11, 0.07][i];
    const debt = Math.round(delivered * debtShare / 1000) * 1000;
    return { sup: s.id, delivered, paid: delivered - debt, debt, terms: [14, 7, 14, 21, 30][i] };
  });

  // --- Полуфабрикаты фабрики-кухни ---
  const semifinished = [
    { id: "sf1", name: "Лосось порционированный", unit: "кг", per: { l1: 6, l2: 4.5, l3: 4, l4: 3.5 }, produced: 0, status: "Новое" },
    { id: "sf2", name: "Угорь жареный", unit: "кг", per: { l1: 3, l2: 2, l3: 2.5, l4: 1.5 }, produced: 0, status: "Новое" },
    { id: "sf3", name: "Сыр сливочный, фасовка 180 г", unit: "шт", per: { l1: 60, l2: 45, l3: 40, l4: 30 }, produced: 0, status: "Новое" },
    { id: "sf4", name: "Омлет тамаго", unit: "шт", per: { l1: 40, l2: 30, l3: 25, l4: 20 }, produced: 0, status: "Новое" },
    { id: "sf5", name: "Соус цезарь", unit: "л", per: { l1: 5, l2: 4, l3: 3, l4: 2 }, produced: 0, status: "Новое" },
    { id: "sf6", name: "Тесто для пиццы", unit: "шт", per: { l1: 80, l2: 60, l3: 55, l4: 45 }, produced: 0, status: "Новое" },
    { id: "sf7", name: "Овощная нарезка микс", unit: "кг", per: { l1: 9, l2: 7, l3: 6, l4: 5 }, produced: 0, status: "Новое" }
  ];

  // --- Стоп-лист ---
  const stopList = menu.filter((m) => m.stop);

  // --- Фудкост по точкам (план/факт) ---
  const menuCostPct = menu.reduce((s, m) => s + m.cost, 0) / menu.reduce((s, m) => s + m.price, 0) * 100;
  function foodcostPct(locId) {
    const adj = { l1: 1.4, l2: -0.6, l3: 3.8, l4: 0.4, l5: -1.6 }[locId] || 0;
    return Math.round((menuCostPct + adj) * 10) / 10;
  }

  // =====================================================================
  // Обогащение ERP: история, динамика и аналитика (детерминированное).
  // Отдельный PRNG R2 — существующие последовательности не сдвигаются.
  // =====================================================================
  const R2 = rng(771771);
  const ri2 = (a, b) => a + Math.floor(R2() * (b - a + 1));

  // 1) Динамика цен ключевых позиций: 12 недель, рынок и каждый поставщик
  const priceHistory = {};
  ["Лосось", "Рис для суши", "Сыр сливочный", "Говядина", "Креветка",
    "Авокадо", "Мука", "Сыр моцарелла", "Кофе зерно", "Нори"].forEach((nm) => {
    const g = ing.find((x) => x.name === nm);
    if (!g) return;
    const sups = suppliers.filter((s) => prices[s.id].some((p) => p.ing === g.id)).map((s) => s.id);
    const weeks = [], market = [], bySup = {};
    sups.forEach((sid) => { bySup[sid] = []; });
    let p = g.price * (nm === "Лосось" ? 0.93 : 0.97);
    for (let w = 11; w >= 0; w--) {
      let drift;
      if (nm === "Лосось") drift = w <= 2 ? 1.045 : 1.006;      // скачок последних недель (+12% с 01.10)
      else if (nm === "Сыр сливочный") drift = 1.005;            // медленный рост
      else if (nm === "Говядина") drift = w > 6 ? 1.008 : 0.994; // сезонное снижение
      else drift = 0.996 + R2() * 0.012;                          // лёгкий шум
      p = p * drift * (0.995 + R2() * 0.01);
      weeks.push(NOW.getTime() - w * 7 * DAY);
      market.push(Math.round(p));
      sups.forEach((sid) => {
        const base = prices[sid].find((x) => x.ing === g.id);
        const k = base ? base.price / g.price : 1; // относительная позиция прайса поставщика
        bySup[sid].push(Math.round(p * k * (0.99 + R2() * 0.02)));
      });
    }
    priceHistory[g.id] = { weeks, market, bySup };
  });

  // 2) Загрузка кухни по часам + среднее время по цехам
  const kitchenLoad = {};
  locations.forEach((l) => {
    if (l.type === "Производство") return;
    kitchenLoad[l.id] = [];
    for (let h = 10; h <= 23; h++) {
      let base = 4 + R2() * 5;
      if (h >= 12 && h <= 14) base *= 2.1; // обеденный пик
      if (h >= 18 && h <= 20) base *= 2.4; // вечерний пик
      if (h === 23) base *= 0.5;
      kitchenLoad[l.id].push({ h, v: Math.max(1, Math.round(base * (l.factor || 1))) });
    }
  });
  const stationAvg = { "Горячий цех": 640, "Холодный цех": 380, "Гриль": 720, "Суши-станция": 460 };

  // 3) Движения склада — ответ на вопрос «почему −3 кг сыра?»
  const stockMoves = {};
  locations.forEach((l) => {
    if (l.type === "Производство") return;
    const ms = [];
    // концентрируем движения на часто используемых позициях, чтобы журнал был содержательным
    const hot = ["Лосось", "Рис для суши", "Сыр сливочный", "Куриное филе", "Помидоры", "Мука", "Сыр моцарелла", "Креветка"]
      .map((n) => ing.find((g) => g.name === n)).filter(Boolean);
    for (let i = 0; i < 40; i++) {
      const g = R2() < 0.55 ? hot[ri2(0, hot.length - 1)] : ing[ri2(0, ing.length - 1)];
      const r = R2();
      const kind = r < 0.3 ? "Приход" : r < 0.75 ? "Расход" : r < 0.85 ? "Списание" : "Перемещение";
      const qty = +(R2() * 8 + 0.5).toFixed(1);
      const doc = kind === "Приход" ? "УПД-" + (2400 + ri2(10, 89))
        : kind === "Расход" ? "Тикет KDS T-" + ri2(100, 999)
          : kind === "Списание" ? "Акт списания А-" + ri2(10, 59)
            : "Накладная ФК-" + ri2(10, 39);
      ms.push({ ts: NOW.getTime() - ri2(1, 40) * 3600000, ing: g.id, kind, qty, doc });
    }
    ms.sort((a, b) => b.ts - a.ts);
    stockMoves[l.id] = ms;
  });

  // 4) История инвентаризаций — 8 еженедельных пересчётов
  const invHistory = {};
  locations.forEach((l) => {
    if (l.type === "Производство") return;
    const bad = l.id === "l3"; // точка с проблемным фудкостом
    invHistory[l.id] = Array.from({ length: 8 }, (_, i) => {
      const varPct = bad ? +(1.4 + R2() * 2.4).toFixed(1) : +(0.3 + R2() * 1.1).toFixed(1);
      const sign = R2() < 0.8 ? -1 : 1; // чаще недостача, реже излишек
      return { ts: NOW.getTime() - (7 - i) * 7 * DAY, varPct, devRub: sign * Math.round(varPct * (bad ? 900 : 520)) };
    });
  });

  // 5) Надёжность поставщиков (90 дней)
  const supplierKpi = {};
  suppliers.forEach((s) => {
    supplierKpi[s.id] = {
      onTime: s.id === "s2" ? 87 : ri2(91, 99),
      leadDays: +(0.8 + R2() * 1.6).toFixed(1),
      vol30: settlements.find((x) => x.sup === s.id).delivered,
      quality: +(96 + R2() * 3.5).toFixed(1)
    };
  });

  // 6) Зоны доставки
  const zoneNames = {
    l1: ["Центральный", "Заречье", "Старый город", "Вокзальный"],
    l2: ["Северный", "Северный парк", "Ивушка", "Снегирь"],
    l3: ["Кировский", "Слобода", "Ботаника", "Соловьи"],
    l4: ["Аэропорт", "Аэродром", "Полевой", "Южный"]
  };
  const deliveryZones = {};
  locations.forEach((l) => {
    if (!zoneNames[l.id]) return;
    deliveryZones[l.id] = zoneNames[l.id].map((z, i) => ({
      name: z,
      orders: ri2(6, 26),
      avgMin: ri2(24, 52),
      inWin: i === 0 ? ri2(92, 98) : ri2(78, 96),
      couriers: ri2(1, 3)
    }));
  });

  // 7) Маржинальность блюд (ТТК-себестоимость уже в menu; продажи — 30 дней)
  const dishAnalytics = menu.map((m) => ({
    dish: m.id, name: m.name, cat: m.catName, cost: m.cost, price: m.price,
    margin: Math.round((1 - m.cost / m.price) * 1000) / 10,
    sales30: Math.round((m.hit ? 380 : 60) + R2() * (m.hit ? 220 : 180)),
    trend: +(R2() * 24 - 9).toFixed(1)
  }));

  // 8) Фудкост сети по неделям (8 недель, тренд вверх из-за роста цен)
  const foodcostWeeks = Array.from({ length: 8 }, (_, i) => ({
    ts: NOW.getTime() - (7 - i) * 7 * DAY,
    pct: +(27.2 + i * 0.22 + (R2() * 0.8 - 0.4)).toFixed(1)
  }));

  window.DS = {
    NOW: NOW.getTime(), DAY, fmtDay, tenants, locations, cats, menu, ing, ttk,
    suppliers, prices, lots, stock, staff, couriers, guests,
    channels, orders, dailyByLoc, tickets, reviews, purchaseOrders,
    auditTemplates, audits, royalty, stopList, foodcostPct,
    requests, settlements, semifinished,
    priceHistory, kitchenLoad, stationAvg, stockMoves, invHistory,
    supplierKpi, deliveryZones, dishAnalytics, foodcostWeeks,
    helpers: { pick, ri, chance }
  };
})();
