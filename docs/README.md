# Документация проекта lovii

Полный корпус исследований, аудита аналогов и продуктовых спецификаций для создания ресторанной CRM/ERP-платформы полного цикла (заказ → чек → кухня → списание продуктов → курьер → отзыв гостя → франшиза).

## Карта документов

### 0. Резюме и аудит корпуса

| Файл | Содержание |
|---|---|
| [`research/executive-summary.md`](research/executive-summary.md) | Резюме исследования на одной странице — для руководства |
| [`research/audit-report.md`](research/audit-report.md) | Аудит корпуса документации: проверки, пробелы, оценки |

### 0.5. Академические разборы

| Файл | Содержание |
|---|---|
| [`research/terminology-crm-erp.md`](research/terminology-crm-erp.md) | CRM и ERP: академические определения, происхождение, граница классов, определитель «ситуация → термин» |
| [`research/terminology-franchise.md`](research/terminology-franchise.md) | Франшиза и франчайзинг: теории, правовой режим РФ, финансовая и операционная терминология |
| [`research/academic-research-agenda.md`](research/academic-research-agenda.md) | Программа дальнейших академических разборов с приоритетами |
| [`research/academic/01-management-accounting.md`](research/academic/01-management-accounting.md) | Терминология управленческого учёта общепита: фудкост, прайм-кост, P&L, EBITDA |
| [`research/academic/02-unit-economics.md`](research/academic/02-unit-economics.md) | Юнит-экономика точки: модель расходов, чувствительность, экономика доставки и франчайзи |
| [`research/academic/03-service-quality.md`](research/academic/03-service-quality.md) | Качество сервиса: модель Оливера, SERVQUAL → DINESERV, сервис-рекавери |
| [`research/academic/04-personal-data-loyalty.md`](research/academic/04-personal-data-loyalty.md) | Лояльность и ПДн: режим 152-ФЗ, сравнение с GDPR, чек-лист платформы |
| [`research/academic/05-franchising-economics.md`](research/academic/05-franchising-economics.md) | Экономика франчайзинга: структуры роялти, агентские издержки, выживаемость |

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
