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

  // --- Стоп-лист ---
  const stopList = menu.filter((m) => m.stop);

  // --- Фудкост по точкам (план/факт) ---
  const menuCostPct = menu.reduce((s, m) => s + m.cost, 0) / menu.reduce((s, m) => s + m.price, 0) * 100;
  function foodcostPct(locId) {
    const adj = { l1: 1.4, l2: -0.6, l3: 3.8, l4: 0.4, l5: -1.6 }[locId] || 0;
    return Math.round((menuCostPct + adj) * 10) / 10;
  }

  window.DS = {
    NOW: NOW.getTime(), DAY, fmtDay, tenants, locations, cats, menu, ing, ttk,
    suppliers, prices, lots, stock, staff, couriers, guests,
    channels, orders, dailyByLoc, tickets, reviews, purchaseOrders,
    auditTemplates, audits, royalty, stopList, foodcostPct,
    helpers: { pick, ri, chance }
  };
})();
