# Спецификация 01. Доменная модель (схемы сущностей)

> Атрибутные схемы по доменам. Полное описание атрибутов — в [`../components/12-data-model.md`](../components/12-data-model.md); здесь — визуальные связи. Имена сущностей на английском (код), подписи связей — по смыслу.

## 1. Ядро: заказы, оплаты, чеки

```mermaid
erDiagram
    ORDER ||--o{ ORDER_ITEM : "содержит"
    ORDER ||--o{ PAYMENT : "оплачен"
    ORDER ||--o| FISCAL_RECEIPT : "фискализируется"
    ORDER }o--|| LOCATION : "исполняется точкой"
    ORDER }o--o| GUEST : "принадлежит гостю"
    ORDER_ITEM }o--|| MENU_ITEM : "позиция меню"
    ORDER_ITEM ||--o{ ORDER_ITEM_MODIFIER : "модификаторы"
    ORDER_ITEM_MODIFIER }o--|| MODIFIER : "вариант"
    ORDER ||--o| DELIVERY_ASSIGNMENT : "доставка"
    ORDER ||--o{ KITCHEN_TICKET : "кухонные тикеты"

    ORDER {
        string id
        string location_id
        string channel
        string status
        string guest_id
        string promised_at
        decimal total
    }
    ORDER_ITEM {
        string id
        string menu_item_id
        int qty
        decimal price
        string station_routing
    }
    PAYMENT {
        string id
        string order_id
        string method
        decimal amount
        string status
    }
    FISCAL_RECEIPT {
        string id
        string order_id
        string kkt_id
        string fiscal_document_no
        string fiscal_sign
        string ffd_version
        string ofd_status
    }
```

## 2. Меню и производство

```mermaid
erDiagram
    MENU_ITEM ||--o{ RECIPE : "версии ТТК"
    RECIPE ||--o{ RECIPE_LINE : "строки состава"
    RECIPE_LINE }o--o| INGREDIENT : "сырьё"
    RECIPE_LINE }o--o| RECIPE : "полуфабрикат"
    MENU_ITEM ||--o{ MODIFIER_GROUP : "группы модификаторов"
    MODIFIER_GROUP ||--o{ MODIFIER : "варианты"
    INGREDIENT ||--o{ LOT : "партии"
    PRODUCTION_BATCH }o--|| RECIPE : "выпуск по ТТК"
    PRODUCTION_BATCH ||--o{ STOCK_MOVEMENT : "движения сырья"

    MENU_ITEM {
        string id
        string name
        decimal base_price
        string tax_group
        bool is_alcohol
        bool is_marked
    }
    RECIPE {
        string id
        string menu_item_id
        string version
        int prep_time_norm_sec
        string status
    }
    RECIPE_LINE {
        string id
        decimal qty
        decimal loss_cold_pct
        decimal loss_hot_pct
    }
    INGREDIENT {
        string id
        string name
        string unit
        int default_shelf_life
    }
    LOT {
        string id
        string ingredient_id
        decimal qty_received
        decimal price_unit
        date expires_at
    }
```

## 3. Склад и закупки

```mermaid
erDiagram
    INGREDIENT ||--o{ STOCK_MOVEMENT : "движения"
    LOT ||--o{ STOCK_MOVEMENT : "партийность"
    PURCHASE_ORDER ||--o{ PURCHASE_ORDER_LINE : "строки"
    PURCHASE_ORDER_LINE }o--|| INGREDIENT : "позиция"
    SUPPLIER ||--o{ PURCHASE_ORDER : "поставки"
    SUPPLIER }o--|| TENANT : "допущен УК"

    STOCK_MOVEMENT {
        string id
        string location_id
        string ingredient_id
        string type
        decimal qty
        string doc_ref
        string author_id
        datetime created_at
    }
    PURCHASE_ORDER {
        string id
        string supplier_id
        string status
        datetime expected_at
        string edo_doc_id
    }
```

Типы движений: `receive` (приёмка), `sale_writeoff` (продажа по ТТК), `production_in` / `production_out` (заготовки), `transfer` (перемещение), `writeoff_spoilage` (порча), `inventory_adjust` (инвентаризация), `return` (возврат).

## 4. Доставка

```mermaid
erDiagram
    LOCATION ||--o{ DELIVERY_ZONE : "зоны"
    COURIER ||--o{ DELIVERY_ASSIGNMENT : "назначения"
    ORDER ||--o| DELIVERY_ASSIGNMENT : "заказ"
    DELIVERY_ASSIGNMENT ||--o{ DELIVERY_INCIDENT : "инциденты"

    DELIVERY_ZONE {
        string id
        string polygon
        decimal min_order
        decimal delivery_fee
        int max_promise_min
    }
    COURIER {
        string id
        string employment
        string transport
        decimal rating
    }
    DELIVERY_ASSIGNMENT {
        string id
        string order_id
        string courier_id
        string status
        datetime assigned_at
        datetime delivered_at
        string proof_photo
    }
```

Статусы назначения:

```mermaid
stateDiagram-v2
    [*] --> assigned : "назначен"
    assigned --> picked : "забрал заказ"
    picked --> delivering : "в пути"
    delivering --> delivered : "вручён (фото)"
    assigned --> failed : "не удалось"
    picked --> failed : "не удалось"
    failed --> [*]
    delivered --> [*]
```

## 5. Гости, лояльность, отзывы

```mermaid
erDiagram
    GUEST ||--|| LOYALTY_ACCOUNT : "бонусный счёт"
    LOYALTY_ACCOUNT ||--o{ LOYALTY_TX : "операции"
    GUEST ||--o{ REVIEW : "отзывы"
    GUEST ||--o{ ORDER : "заказы"
    CAMPAIGN ||--o{ CAMPAIGN_EVENT : "отправки"
    CAMPAIGN_EVENT }o--|| GUEST : "гость"

    GUEST {
        string id
        string phones
        string birthday
        datetime consent_152fz_at
    }
    LOYALTY_TX {
        string id
        string type
        decimal amount
        string order_id
        string reason
    }
    REVIEW {
        string id
        string order_id
        int rating
        string source
        string response
    }
```

## 6. Франшиза и контроль

```mermaid
erDiagram
    TENANT ||--o{ LOCATION : "точки"
    TENANT ||--o{ FRANCHISE_AGREEMENT : "договоры"
    FRANCHISE_AGREEMENT ||--o{ ROYALTY_INVOICE : "счета роялти"
    LOCATION }o--o| LOCATION_TEMPLATE : "клон шаблона"
    TENANT ||--o{ CHECKLIST : "чек-листы"
    CHECKLIST ||--o{ AUDIT : "проверки"
    AUDIT ||--o{ REMEDIATION_TASK : "задачи"

    TENANT {
        string id
        string type
        string status
    }
    FRANCHISE_AGREEMENT {
        string id
        string number
        decimal royalty_pct
        decimal marketing_fee_pct
        date date_start
        date date_end
    }
    LOCATION_TEMPLATE {
        string id
        string version
        string menu_ref
        string rights_matrix
    }
    ROYALTY_INVOICE {
        string id
        string period
        decimal gross_revenue
        decimal royalty_amount
        string status
    }
```

## 7. Жизненный цикл заказа (единый для всех каналов)

```mermaid
stateDiagram-v2
    [*] --> new : "создан каналом"
    new --> accepted : "зона/стоп/цена ок"
    accepted --> kitchen : "маршрутизация позиций"
    kitchen --> ready : "все тикеты готовы"
    ready --> served : "зал: подан"
    ready --> packed : "доставка: упакован"
    packed --> delivered : "курьер вручил"
    new --> cancelled : "отмена"
    accepted --> cancelled : "отмена"
    served --> [*]
    delivered --> [*]
    cancelled --> [*]
```
