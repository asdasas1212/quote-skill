# 数据结构定义

所有数据以 JSON 文件形式存储在 `.quote-data/` 目录下。

## 目录结构

```
.quote-data/
├── config.json       # 用户配置
├── inquiries/        # 询价单（每条一个文件）
│   └── INQ-YYYYMMDD-NNN.json
├── replies/          # 报价（每条一个文件）
│   └── QUO-YYYYMMDD-NNN.json
└── orders/           # 订单（每条一个文件）
    └── ORD-YYYYMMDD-NNN.json
```

## ID 格式

`{PREFIX}-{YYYYMMDD}-{SEQ}`

- PREFIX: INQ（询价）、QUO（报价）、ORD（订单）
- YYYYMMDD: 创建日期
- SEQ: 当日序号，三位补零

## Config

```json
{
  "role": "buyer",
  "name": "张三",
  "company": "XX修理厂",
  "phone": "138xxxx1234"
}
```

## Inquiry (询价单)

```json
{
  "id": "INQ-20260615-001",
  "product": "前刹车片",
  "oeNumber": "04465-33471",
  "vehicle": "丰田凯美瑞 2020",
  "quantity": 4,
  "note": "",
  "status": "pending",
  "createdAt": "2026-06-15T10:00:00.000Z",
  "createdBy": "张三"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 自动 | 唯一标识 |
| product | string | 是 | 产品/零件名称 |
| oeNumber | string | 否 | OE 编号 / 型号 |
| vehicle | string | 否 | 适用车型 / 设备型号 |
| quantity | number | 否 | 数量，默认 1 |
| note | string | 否 | 备注 |
| status | string | 自动 | pending / quoted / ordered / closed |
| createdAt | string | 自动 | ISO 时间戳 |
| createdBy | string | 自动 | 创建人（取自 config） |

## Reply (报价)

```json
{
  "id": "QUO-20260615-001",
  "inquiryId": "INQ-20260615-001",
  "supplier": "深圳XX汽配",
  "price": 280,
  "currency": "CNY",
  "brand": "天合TRW",
  "delivery": 2,
  "note": "原厂件",
  "createdAt": "2026-06-15T11:00:00.000Z"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 自动 | 唯一标识 |
| inquiryId | string | 是 | 关联询价单 ID |
| supplier | string | 否 | 供应商名称 |
| price | number | 是 | 报价金额 |
| currency | string | 否 | 货币，默认 CNY |
| brand | string | 否 | 品牌 |
| delivery | number | 否 | 货期（天） |
| note | string | 否 | 备注 |
| createdAt | string | 自动 | ISO 时间戳 |

## Order (订单)

```json
{
  "id": "ORD-20260615-001",
  "inquiryId": "INQ-20260615-001",
  "replyId": "QUO-20260615-001",
  "status": "confirmed",
  "confirmedAt": "2026-06-15T12:00:00.000Z"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 自动 | 唯一标识 |
| inquiryId | string | 是 | 关联询价单 |
| replyId | string | 是 | 选中的报价 |
| status | string | 自动 | confirmed |
| confirmedAt | string | 自动 | ISO 时间戳 |
