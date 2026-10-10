# Документация проекта lovii

Полный корпус исследований, аудита аналогов и продуктовых спецификаций для создания ресторанной CRM/ERP-платформы полного цикла (заказ → чек → кухня → списание продуктов → курьер → отзыв гостя → франшиза).

## Карта документов

> Быстрый вход: [Каталог схем](research/diagram-catalog.md) — все диаграммы сайта со ссылками на страницы, где они находятся. Каталог генерируется скриптом `scripts/gen_diagram_catalog.py`.

### 0. Резюме и аудит корпуса

| Файл | Содержание |
|---|---|
| [`research/executive-summary.md`](research/executive-summary.md) | Резюме исследования на одной странице — для руководства |
| [`research/audit-report.md`](research/audit-report.md) | Аудит корпуса документации: проверки, пробелы, оценки |

### 0.5. Академические разборы

| Файл | Содержание |
|---|---|
| [`research/crm-vs-erp.md`](research/crm-vs-erp.md) | Сравнение CRM и ERP лоб в лоб: отличия, связка, два контура общепита |
| [`research/terminology-crm-erp.md`](research/terminology-crm-erp.md) | CRM и ERP: академические определения, происхождение, граница классов, определитель «ситуация → термин» |
| [`research/terminology-franchise.md`](research/terminology-franchise.md) | Франшиза и франчайзинг: теории, правовой режим РФ, финансовая и операционная терминология |
| [`research/academic-research-agenda.md`](research/academic-research-agenda.md) | Программа дальнейших академических разборов с приоритетами |
| [`research/academic/01-management-accounting.md`](research/academic/01-management-accounting.md) | Терминология управленческого учёта общепита: фудкост, прайм-кост, P&L, EBITDA |
| [`research/academic/02-unit-economics.md`](research/academic/02-unit-economics.md) | Юнит-экономика точки: модель расходов, чувствительность, экономика доставки и франчайзи |
| [`research/academic/03-service-quality.md`](research/academic/03-service-quality.md) | Качество сервиса: модель Оливера, SERVQUAL → DINESERV, сервис-рекавери |
| [`research/academic/04-personal-data-loyalty.md`](research/academic/04-personal-data-loyalty.md) | Лояльность и ПДн: режим 152-ФЗ, сравнение с GDPR, чек-лист платформы |
| [`research/academic/05-franchising-economics.md`](research/academic/05-franchising-economics.md) | Экономика франчайзинга: структуры роялти, агентские издержки, выживаемость |
| [`research/academic/06-food-safety-terminology.md`](research/academic/06-food-safety-terminology.md) | Пищевая безопасность: Кодекс Алиментариус, ХАССП, ККТ, прослеживаемость |
| [`research/academic/07-operations-terminology.md`](research/academic/07-operations-terminology.md) | Операционный менеджмент: теория ограничений, очереди, закон Литтла |
| [`research/academic/08-clv-models.md`](research/academic/08-clv-models.md) | Модели ценности гостя: когорты, RFM, Парето/НБД, Гамма-Гамма, прогнозный CLV |
| [`research/academic/09-menu-engineering.md`](research/academic/09-menu-engineering.md) | Инженерия меню: матрица Касаваны–Смита, поведенческая экономика меню |
| [`research/academic/10-waiting-psychology.md`](research/academic/10-waiting-psychology.md) | Психология ожидания: принципы Мэйстера и требования к статусам/обещаниям |
| [`research/academic/11-technology-adoption.md`](research/academic/11-technology-adoption.md) | Принятие технологий персоналом: TAM, UTAUT/UTAUT2 и требования к интерфейсам |
| [`research/academic/12-event-architecture-cqrs.md`](research/academic/12-event-architecture-cqrs.md) | Событийная архитектура и CQRS в мультитенантной платформе |
| [`research/academic/13-mdm-data-quality.md`](research/academic/13-mdm-data-quality.md) | Качество данных и MDM: мастер-данные сети, золотая запись, владение |
| [`research/academic/14-lean-kitchen.md`](research/academic/14-lean-kitchen.md) | Бережливая кухня: семь потерь, 5S, визуальный менеджмент |
| [`research/academic/15-staff-turnover.md`](research/academic/15-staff-turnover.md) | Текучесть линейного персонала: модели ухода и интервенции |
| [`research/academic/16-innovation-diffusion.md`](research/academic/16-innovation-diffusion.md) | Диффузия инноваций в сетях: механика раскатки изменений (Роджерс) |
| [`research/academic/17-franchise-law-comparative.md`](research/academic/17-franchise-law-comparative.md) | Сравнительное право франчайзинга: Россия, США (Правило ФТК), ЕС |

### 1. Рынок и архитектура

| Файл | Содержание |
|---|---|
| [`research/00-market-landscape.md`](research/00-market-landscape.md) | Рынок общепита РФ в цифрах, сегменты автоматизации, глобальный контекст |
| [`research/01-reference-architecture.md`](research/01-reference-architecture.md) | Референс-модель: 13 доменов, сквозной процесс, модель данных, роли |
| [`research/02-personas-cjm.md`](research/02-personas-cjm.md) | Персоны и сценарии: гость, курьер, франчайзи, УК, повар |
| [`research/glossary.md`](research/glossary.md) | Глоссарий отраслевых и регуляторных терминов |

### 2. Компоненты (детальные спецификации)

| Файл | Домен |
|---|---|
| [`components/01-pos-fiscal.md`](research/components/01-pos-fiscal.md) | Касса, чеки, фискализация (54-ФЗ, ФФД 1.2, ОФД) |
| [`components/02-order-channels.md`](research/components/02-order-channels.md) | Каналы приёма заказов: зал, киоск, бронь/банкеты, сайт, приложение, агрегаторы |
| [`components/03-kitchen-kds.md`](research/components/03-kitchen-kds.md) | Кухня: KDS, цеха, тайминги, ТТК на экране |
| [`components/04-inventory-procurement.md`](research/components/04-inventory-procurement.md) | Склад, техкарты, фудкост, закупки, поставщики, ЭДО |
| [`components/05-delivery-couriers.md`](research/components/05-delivery-couriers.md) | Доставка: свои курьеры, маршрутизация, агрегаторы |
| [`components/06-crm-loyalty-feedback.md`](research/components/06-crm-loyalty-feedback.md) | CRM гостя, лояльность, отзывы, NPS |
| [`components/07-hr-staff.md`](research/components/07-hr-staff.md) | Персонал: смены, табель, ФОТ, мотивация, обучение |
| [`components/08-finance-analytics.md`](research/components/08-finance-analytics.md) | Финансы, P&L, BI, видеоконтроль, антифрод |
| [`components/09-franchise-network.md`](research/components/09-franchise-network.md) | Франшиза и управляющая компания: роялти, стандарты, онбординг точек |
| [`components/10-compliance-safety.md`](research/components/10-compliance-safety.md) | Пищевая безопасность, ХАССП, ЕГАИС, Честный ЗНАК, Меркурий |
| [`components/11-integration-platform.md`](research/components/11-integration-platform.md) | Платформа: API, события, офлайн-режим, мультитенантность, безопасность |
| [`components/12-data-model.md`](research/components/12-data-model.md) | Модель данных: сущности, атрибуты, контракты |

### 2.5. Технические спецификации (схемы Mermaid)

| Файл | Содержание |
|---|---|
| [`research/specs/00-overview.md`](research/specs/00-overview.md) | Контекст системы и контейнерная схема |
| [`research/specs/01-domain-model.md`](research/specs/01-domain-model.md) | ER-схемы доменов и стейт-машины заказов/доставки |
| [`research/specs/02-processes.md`](research/specs/02-processes.md) | Последовательности: зал, онлайн-доставка, агрегаторы, закупки, офлайн, отзывы, роялти, инвентаризация |
| [`research/specs/03-api-contracts.md`](research/specs/03-api-contracts.md) | Ресурсы REST, контракт заказа, каталог событий, вебхуки, надёжность |
| [`research/specs/04-deployment-offline.md`](research/specs/04-deployment-offline.md) | Топология деплоя, мультитенантность, офлайн-синхронизация, безопасность |

### 2.6. Платёжная инфраструктура

| Файл | Содержание |
|---|---|
| [`research/infrastructure/banks-kassa-ofd.md`](research/infrastructure/banks-kassa-ofd.md) | Банки-эквайеры, онлайн-кассы и ОФД: роли, экономика (сколько съедают от выручки), лучшие примеры 2026, контракт мок-сервисов |

### 2.7. SaaS-платформа и демо

| Файл | Содержание |
|---|---|
| [`research/saas/00-platform-map.md`](research/saas/00-platform-map.md) | Карта-цель: `app.lovii.ru`, `crm.lovii.ru`, `erp.lovii.ru` — три входа одной платформы, роли и принципы единства |
| [`research/saas/01-information-flow.md`](research/saas/01-information-flow.md) | Семь правил движения информации; схемы «источники → журнал → контуры», путь заказа и путь поставки |
| [`research/saas/02-demo-cabinet.md`](research/saas/02-demo-cabinet.md) | Спецификация демо-кабинета: роли, периметр мок-данных, отчёты и рекомендации, аудиты. **Демо собрано** → [открыть демо-кабинет](https://bestdeejay-design.github.io/lovii-crm/demo/) |

### 3. Аудиты аналогов

**Россия**

| Файл | Системы |
|---|---|
| [`competitors/iiko.md`](research/competitors/iiko.md) | iiko (лидер рынка РФ) |
| [`competitors/rkeeper.md`](research/competitors/rkeeper.md) | r_keeper |
| [`competitors/poster.md`](research/competitors/poster.md) | Poster POS |
| [`competitors/quick-resto.md`](research/competitors/quick-resto.md) | Quick Resto |
| [`competitors/saby-presto.md`](research/competitors/saby-presto.md) | Saby Presto (СБИС) |
| [`competitors/1c.md`](research/competitors/1c.md) | 1С:Общепит / 1С:Ресторан / 1С:Фастфуд |
| [`competitors/ru-smaller.md`](research/competitors/ru-smaller.md) | Tillypad, Fusion POS, Yuma, Эвотор-решения |

**Мир**

| Файл | Системы |
|---|---|
| [`competitors/toast.md`](research/competitors/toast.md) | Toast (США, эталон вертикальной платформы) |
| [`competitors/lightspeed.md`](research/competitors/lightspeed.md) | Lightspeed Restaurant |
| [`competitors/square-touchbistro-revel.md`](research/competitors/square-touchbistro-revel.md) | Square for Restaurants, TouchBistro, Revel |
| [`competitors/middleware-delivery.md`](research/competitors/middleware-delivery.md) | Deliverect, Otter, Checkmate + RU-сервисы доставки |
| [`competitors/loyalty-crm-vendors.md`](research/competitors/loyalty-crm-vendors.md) | ReMarked, Loona.ai, getMeBack, PremiumBonus и др. |
| [`competitors/audit-standards-vendors.md`](research/competitors/audit-standards-vendors.md) | MD Audit, CheckOffice, Service Inspector, Mozg |

### 4. Выводы и план продукта

| Файл | Содержание |
|---|---|
| [`research/gap-analysis.md`](research/gap-analysis.md) | Матрица «компонент × система», разрывы, окно возможностей |
| [`research/product-blueprint.md`](research/product-blueprint.md) | Архитектура платформы lovii, фазы, MVP, метрики, риски |

### 5. План реализации и систематизация

| Файл | Содержание |
|---|---|
| [`research/plan/01-implementation-plan.md`](research/plan/01-implementation-plan.md) | Фазы с гейтами, план первых 90 дней, команда, риски |
| [`research/plan/02-systems-roadmap.md`](research/plan/02-systems-roadmap.md) | Какие системы нужны по фазам: строить / покупать / интегрировать |
| [`research/plan/03-backbone-stack.md`](research/plan/03-backbone-stack.md) | Опорный стек до выхода на целевые показатели, правила миграций, бюджет |
