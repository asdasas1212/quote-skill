# API 接口映射文档

本文档记录 CLI 各功能与 `terminal-api-v2` 真实接口的对应关系。

Base URL: `https://ec-hwbeta.casstime.com/terminal-api-v2`

---

## 认证

所有业务接口需带 Header: `Authorization: bearer {accessToken}`

### 登录（用户名密码）

```
POST /public/auth/ecapp/login/password
```

**Request:**
```json
{
  "userLoginName": "账号",
  "password": "密码",
  "deviceId": "quote-cli"
}
```

**Response (errorCode=0):**
```json
{
  "errorCode": 0,
  "data": {
    "accessToken": "平台 access token",
    "tokenType": "bearer",
    "refreshToken": "刷新用 token",
    "expiresIn": 7200,
    "userLoginId": "用户ID"
  }
}
```

**错误码:**
| errorCode | 含义 |
|-----------|------|
| 702 | 账号或密码错误 |
| 703 | 帐号已失效 |
| 705 | 密码错误，剩余重试次数 |
| 706 | 账号已被锁定 |

---

### 登录（手机验证码）

```
POST /public/auth/ecapp/login/cellphone
```

**Request:**
```json
{
  "cellphone": "手机号",
  "verifyCode": "验证码",
  "deviceId": "quote-cli"
}
```

**Response:** 同上

---

### 刷新 Token

```
POST /public/auth/ecapp/refresh_token
```

**Request:**
```json
{
  "refreshToken": "当前 refreshToken",
  "clientId": "CASSAPP",
  "deviceId": "quote-cli"
}
```

**Response:** 同登录响应

**注意：** CLI 内部已实现自动续签逻辑：
- access token 过期时，自动调用此接口换取新 token 再重试请求
- 服务端返回 errorCode `401 / 652 / 653 / 654` 时同样触发续签+重试
- refresh token 本身失效（服务端返回以上错误码）时清空本地凭证，提示 `quote login`

---

## 询价单

### 创建询价（简易）

CLI 命令: `quote inquiry create`

```
POST /inquiries/simple_inquiry
```

**Request:**
```json
{
  "vin": "VIN码（可选）",
  "carBrandName": "品牌名称",
  "carModelName": "车型",
  "userName": "用户名",
  "source": "ANDROID",
  "qualities": ["BRAND"],
  "userNeeds": [
    {
      "originalNeed": "配件原始名称",
      "needsName": "配件名称",
      "quantity": 4,
      "oeCode": "OE编号",
      "remark": "备注",
      "inquirySource": "MANUALLY"
    }
  ]
}
```

**Response:**
```json
{
  "errorCode": 0,
  "data": {
    "inquiryId": "询价单ID",
    "isSimpleDemand": true
  }
}
```

**品质枚举 (qualities):**
| 值 | 含义 |
|----|------|
| ORIGINAL_BRAND | 原厂件 |
| BRAND | 品牌件 |
| EXTERNAL_BRAND | 外贸件 |
| INTERNAL_BRAND | 内贸件 |
| SECOND_HAND | 二手件 |
| EQUIVALENT_BRAND | 同质件 |

---

### 询价单列表

CLI 命令: `quote inquiry list`

```
POST /inquiries/list?page=1&size=20
```

**Request:**
```json
{
  "searchContext": "关键字（可选）",
  "statusIds": ["WAIT_QUOTATION"],
  "startDate": "2026-01-01",
  "endDate": "2026-06-15"
}
```

**状态映射:**
| CLI status | 平台 statusIds |
|------------|---------------|
| pending | WAIT_QUOTATION, QUOTING |
| quoted | QUOTED, PART_QUOTED |
| ordered | ORDERED |
| closed | CLOSED, EXPIRED |

**Response:**
```json
{
  "errorCode": 0,
  "data": {
    "content": [...],
    "totalElements": 100,
    "totalPages": 5,
    "number": 0,
    "size": 20,
    "isFirst": true,
    "isLast": false
  }
}
```

---

### 询价单详情

CLI 命令: `quote inquiry detail <id>`

```
GET /inquiries/{inquiryId}/detailV2?platform=ANDROID
```

**Response:** 包含车型信息、需求配件列表、报价状态等完整详情。

---

## 报价结果

### 获取商家报价

CLI 命令: `quote reply list -i <inquiryId>`

```
GET /inquiries/store/quotation?inquiryId={id}&storeId={storeId}
```

**Response:**
```json
{
  "errorCode": 0,
  "data": {
    "demandId": "询价单号",
    "consultingQuotationProducts": [
      {
        "quotationProductId": "报价结果ID",
        "originalItemName": "配件名称",
        "brandName": "品牌",
        "displayPrice": "280.00",
        "quality": "BRAND",
        "qualityDescription": "品牌件",
        "arrivalTime": 2,
        "productType": "FINISHED_GOODS",
        "remark": "备注"
      }
    ]
  }
}
```

---

### 获取导购方案

CLI 命令: `quote compare -i <inquiryId>`

```
GET /inquiries/quotation_scheme?quotationId={id}
```

---

## 下单

### 完整下单流程

CLI 命令:
```bash
# 交互式（推荐）：引导选择地址和物流
quote order confirm -i <inquiryId> -r <replyId>

# 非交互：全部用 flag 指定
quote order confirm -i <inquiryId> -r <replyId> -a <addressId> -l <logisticsCode>

# 先查可用物流和 code（用于 -l 参数）
quote order logistics -i <inquiryId> -r <replyId>

# 查看收货地址（用于 -a 参数）
quote order addresses
```

已通过 beta 环境实测验证（成功创建订单 S2606180009597），完整 5 步流程如下：

---

**Step 1:** 采购确认
```
POST /inquiries/purchase_confirm
```

**Request:**
```json
{
  "inquiryId": "询价单号",
  "quotationProductIds": ["报价结果ID"]
}
```

**Response:** 返回询价单信息，忽略，继续下一步。

---

**Step 2:** 找报价所在 store

遍历 `detailV2.inquiryQuoteStores[]`，逐一调：
```
GET /inquiries/store/quotation?inquiryId={id}&storeId={storeId}
```
在 `consultingQuotationProducts` 中找到 `quotationProductId === replyId` 的条目，取：
- `quotationProductId` → `productId`（用于下单）
- `location` → `facilityId`（仓库 ID，如 `CN_GZ`）
- `storeId` → `sellerStoreId`

---

**Step 3:** 生成结算单
```
POST /buy/proxy_order_bff/tosettle
```

**Request:**
```json
{
  "application": "ANDROID",
  "businessGroup": "INQUIRY",
  "businessUnit": "COMMON_INQUIRY",
  "originSource": "INQUIRY_CONFIRM",
  "buyerUserLoginId": "来自登录缓存 userLoginId",
  "buyerCompanyId": "来自登录缓存 garageCompanyId（必须为字符串）",
  "terminal": "APP",
  "postalAddressId": "收货地址ID（必填，来自 GET /address/proxy_order_bff/post_addresses/{userLoginId}）",
  "toSettleItems": [
    {
      "productId": "quotationProductId（报价结果ID）",
      "facilityId": "仓库ID（item.location，如 CN_GZ）",
      "sellerStoreId": "店铺ID",
      "inquiryId": "询价单号（必填，缺少会报 500"询价单号不能为空"）",
      "quantity": 1,
      "needInvoice": "B",
      "itemInvoice": "N"
    }
  ]
}
```

**Response:**
```json
{ "settleId": "6a33670c..." }
```

> ⚠️ `POST /inquiry-cart/settle/v2` 在 beta 环境返回 999，不可用，改走 proxy_order_bff 路径。

---

**Step 4:** 获取结算单详情（含总价、商品条目、物流选项）
```
POST /buy/settle
```

**Request:**
```json
{
  "type": "INIT",
  "settlePayload": {
    "settleId": "结算单ID",
    "application": "ANDROID",
    "terminal": "APP"
  }
}
```

**Response 关键字段:**
```json
{
  "totalAmount": {
    "productTotalAmount": 29.0,
    "totalAmount": 23.2
  },
  "validGroups": [
    {
      "storeId": "GZYC0001",
      "inquiryItems": [
        {
          "productItems": [
            {
              "settleItemId": "6a338f05ef868400014e86f4",
              "productId": "6a32e1cef41487000145696b",
              "quantity": 1,
              "facilityId": "CN_GZ"
            }
          ]
        }
      ],
      "xiaomaLogisticsService": [
        {
          "storeId": "GZYC0001",
          "facilityId": "CN_GZ",
          "defaultLogisticsDTO": {
            "logisticsCompanyCode": "YJAA",
            "logisticsCompanyName": "粤俊物流",
            "transportationCode": "CAR_FREIGHT",
            "logisticsLocationCode": "YJAA066AA",
            "logisticsLocationName": "粤俊茂名站",
            "deliverType": "self_mention",
            "departureTime": "01:30发车",
            "lineShiftCode": "YJAA020AAYJAA066AA1301",
            "lineShiftName": "晚班"
          },
          "commonlyUsedLogistics": [
            {
              "displayLogisticsCompaniesCode": "HTAA",
              "displayLogisticsCompaniesName": "恒泰物流",
              "transportWayDTOS": [{ "transportationCode": "CAR_FREIGHT", "logisticsLocationDTOS": [...] }]
            }
          ]
        }
      ]
    }
  ]
}
```

**提取逻辑：**
- `totalAmount.totalAmount` = 含折扣实付金额（用于 settle_submit）
- `validGroups[].inquiryItems[].productItems[].settleItemId` = 提交下单的商品条目 ID
- 物流优先取 `defaultLogisticsDTO`，无则从 `commonlyUsedLogistics[0]` 构造
- `departureTime / lineShiftCode / lineShiftName` 无值时传空字符串（接口要求 string 不接受 null）

---

**Step 5:** 提交结算下单
```
POST /buy/proxy_order_bff/settle_submit
```

**Request:**
```json
{
  "settleId": "结算单ID",
  "clientRequestId": "前端生成的 UUID（幂等防重复提交）",
  "application": "ANDROID",
  "businessGroup": "INQUIRY",
  "businessUnit": "COMMON_INQUIRY",
  "buyerCompanyId": "garageCompanyId（字符串）",
  "postalAddressId": "收货地址ID",
  "terminal": "APP",
  "goldCoinUsed": false,
  "totalAmount": 23.2,
  "invoices": [
    { "storeId": "店铺ID", "inquiryId": "询价单号", "needInvoice": "B" }
  ],
  "logistics": {
    "xiaomaLogistics": [
      {
        "storeId": "GZYC0001",
        "facilityId": "CN_GZ",
        "logisticsCompanyCode": "YJAA",
        "logisticsCompanyName": "粤俊物流",
        "transportationCode": "CAR_FREIGHT",
        "transportationName": "汽运",
        "logisticsLocationCode": "YJAA066AA",
        "logisticsLocationName": "粤俊茂名站",
        "landingLogisticsLocationCode": "YJAA",
        "landingLogisticsLocationName": "粤俊物流",
        "deliverType": "self_mention",
        "departureTime": "01:30发车",
        "lineShiftCode": "YJAA020AAYJAA066AA1301",
        "lineShiftName": "晚班"
      }
    ]
  },
  "products": [
    {
      "settleItemId": "6a338f05ef868400014e86f4",
      "productId": "6a32e1cef41487000145696b",
      "quantity": 1,
      "storeId": "GZYC0001",
      "facilityId": "CN_GZ"
    }
  ]
}
```

**Response:**
```json
{
  "isSuccess": true,
  "orderIds": ["S2606180009597"]
}
```

**注意：**
- `logistics` 为必填字段（传空对象 `{}` 会报"物流信息不能为空"）
- `products[].settleItemId` 来自 Step 4 的 `validGroups[].inquiryItems[].productItems[].settleItemId`
- 返回 `errorCode: 999, teamCode: 3000` 表示订单服务内部错误（beta 环境对已下过单的报价重复下单会触发）

---

### 收货地址

```
GET /address/proxy_order_bff/post_addresses/{userLoginId}
```

返回用户地址列表。每条地址字段：`id`, `receiverName`, `contactNumber`, `provinceGeoName`, `cityGeoName`, `countyGeoName`, `address`。

fallback：`GET /address` 返回单条默认地址（字段名为 `addressId` 而非 `id`）。

---

### 订单列表

CLI 命令: `quote order list`

```
POST /orders
```

> ⚠️ 注意：`POST /inquiries/order/list` 是"工单询价"场景的询价单列表，不是真实订单列表，不可混用。

**Request:**
```json
{
  "pageNumber": 1,
  "pageSize": 20
}
```

**可选过滤字段:**
| 字段 | 类型 | 说明 |
|------|------|------|
| `statusId` | string | `ORDER_WAIT_PAYED` / `ORDER_APPROVED` / `ORDER_SENT` / `ORDER_COMPLETED` / `ORDER_CANCELLED` |
| `partInfo` | string | 配件名称或零件号 |
| `orderTimeBegin` / `orderTimeEnd` | string | 下单时间范围 |
| `createdName` | string | 下单人名称 |

**Response:**
```json
{
  "errorCode": 0,
  "data": {
    "orders": [
      {
        "orderId": "订单ID",
        "productStoreName": "店铺名称",
        "actualCurrencyAmount": 280.00,
        "orderName": "配件名称拼接",
        "statusId": "ORDER_WAIT_PAYED",
        "statusIdDesc": "等待付款",
        "carBrandName": "大众",
        "carModelInfo": "朗逸",
        "orderDate": 1718000000000
      }
    ],
    "totalElements": 50,
    "pageNumber": 1
  }
}
```

**订单状态枚举 (statusId):**
| 值 | 含义 |
|----|------|
| ORDER_WAIT_PAYED | 待付款 |
| ORDER_APPROVED | 待发货 |
| ORDER_SENT | 待收货 |
| ORDER_COMPLETED | 已完成 |
| ORDER_CANCELLED | 已取消 |

---

## 通用响应格式

所有接口响应均遵循：

```json
{
  "errorCode": 0,
  "data": { ... }
}
```

| errorCode | 含义 |
|-----------|------|
| 0 | 成功 |
| 401 | 认证失败（token 无效或已过期） |
| 605 | 参数格式校验失败 |
| 652 | 账号在其它设备登录，当前 token 已失效 |
| 653 | token 已过期 |
| 654 | token 校验失败 |
| 999 | 系统繁忙 |

---

## Token 校验

```
GET /users/check_token
Authorization: bearer {accessToken}
```

**Response:**
```json
{
  "errorCode": 0,
  "data": { "isSuccess": true }
}
```
