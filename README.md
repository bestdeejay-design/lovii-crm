# lovii-crm

Платформа полного цикла для ресторанного бизнеса и пищевых производств: **от заказа и чека — до кухни, списания продуктов, курьера и отзыва гостя**. Продукт создаётся под запуск собственного производства и франшизы [lovii.ru](https://lovii.ru) с расчётом на то, что каждый подключающийся партнёр получает готовый комплекс: касса, чеки, кухня, склад, закупки, поставщики, доставка, лояльность, контроль стандартов.

Целевой уровень качества — **микробизнес по функциональности, корпоративный класс по надёжности и контролю**.

Документация публикуется на GitHub Pages: [bestdeejay-design.github.io/lovii-crm](https://bestdeejay-design.github.io/lovii-crm/) (сборка MkDocs Material, workflow `.github/workflows/pages.yml`).

## Структура репозитория

| Раздел | Что внутри |
|---|---|
| [`docs/README.md`](docs/README.md) | Навигация по всей документации |
| `docs/research/` | Исследование рынка и референс-архитектура |
| `docs/research/components/` | Детальные спецификации компонентов системы (11 доменов) |
| `docs/research/competitors/` | Аудиты аналогов: РФ и мировых |
| `docs/research/gap-analysis.md` | Матрица покрытия рынка и найденные разрывы |
| `docs/research/product-blueprint.md` | Целевая архитектура платформы lovii и дорожная карта |

## Ключевые документы (читать в этом порядке)

1. [Обзор рынка](docs/research/00-market-landscape.md) — цифры, сегменты, игроки.
2. [Референс-архитектура](docs/research/01-reference-architecture.md) — из каких компонентов состоит CRM/ERP «от заказа до клиента» и как они связаны.
3. [Компоненты](docs/research/components/) — 11 детальных спецификаций доменов.
4. [Аудиты аналогов](docs/research/competitors/) — iiko, r_keeper, Poster, Quick Resto, Saby Presto, 1С, Tillypad, Fusion POS, Toast, Lightspeed, Square, TouchBistro/Revel, middleware доставки, CRM/лояльность, аудиты стандартов.
5. [Разрывы рынка](docs/research/gap-analysis.md) — что не закрывает никто и где наше окно возможностей.
6. [Продуктовый blueprint](docs/research/product-blueprint.md) — как это всё собирается в платформу lovii.

## Статус

- 2026-10-09 — завершена фаза исследования и аудита аналогов; начинается разработка платформы.
