# 询价流程文档

## 命令流程

```
quote login           → 登录
quote inquiry create  → 创建询价单
quote inquiry list    → 查看询价单列表
quote inquiry detail  → 查看询价单详情
quote reply list      → 查看报价结果
quote compare         → 比价分析
```

---

## 完整流程与对应 API

### 1. 登录

**命令：** `quote login`

| 步骤 | API | 说明 |
|------|-----|------|
| 检查账号 | `GET /public/users/{account}/account_info` | 702 = 未注册 |
| 密码登录 | `POST /public/auth/ecapp/login/password` | 返回 accessToken |
| 短信登录 | `POST /public/auth/ecapp/login/cellphone` | 需先发验证码 |
| 发验证码 | `GET /public/verify_code?channelId=LOGIN&cellphone=` | |
| 拉用户信息 | `GET /users/_current` | 缓存手机号、地址、公司名到 `~/.quote/config.json` |

**登录后缓存字段：** `accessToken`, `refreshToken`, `userLoginId`, `cellphone`, `companyName`, `provinceGeoId/Name`, `cityGeoId/Name`, `countyGeoId/Name`

---

### 2. 创建询价单

**命令：** `quote inquiry create -p "刹车片" --brand VW --brand-name 大众 -m 朗逸 -q 2`

| 步骤 | API | 说明 |
|------|-----|------|
| （可选）查品牌列表 | `GET /inquiries/support_brands` | 不传 `--brand` 时弹出交互选择 |
| （可选）VIN 解析品牌 | `GET /inquiries/car_models?vin=` | 传 `--vin` 时自动获取 `carBrandId` |
| 创建询价 | `POST /inquiries` | 走完整询价接口 |

**`POST /inquiries` 关键请求字段：**
```json
{
  "vin": "车架号（必填，不知道填 UNKNOWN00000000000）",
  "carBrandId": "VW",
  "carBrandName": "大众",
  "carModelName": "朗逸",
  "userName": "用户ID（来自登录缓存）",
  "contactNumber": "手机号（来自登录缓存）",
  "isOpenInvoice": false,
  "source": "ANDROID",
  "isSelectBrandFlag": false,
  "isAnonymous": false,
  "qualities": ["BRAND"],
  "provinceGeoId": "来自登录缓存",
  "cityGeoId": "来自登录缓存",
  "countyGeoId": "来自登录缓存",
  "provinceGeoName": "来自登录缓存",
  "cityGeoName": "来自登录缓存",
  "countyGeoName": "来自登录缓存",
  "userNeeds": [{
    "needsName": "刹车片",
    "quantity": 2,
    "isFastOe": false,
    "isSuggest": false,
    "imageUrls": [],
    "originalNeed": "刹车片",
    "inquirySource": "MANUALLY",
    "oeCode": "",
    "remark": ""
  }]
}
```

**响应：**
```json
{ "inquiryId": "B26061605224", "isSimpleDemand": false }
```

---

### 3. 查看询价单列表

**命令：** `quote inquiry list [--status pending|quoted|ordered|closed]`

| API | `POST /inquiries/list?page=1&size=20` |
|-----|---------------------------------------|

**请求体（可选过滤）：**
```json
{
  "statusIds": ["UNQUOTE"],
  "searchContext": "关键字"
}
```

**状态映射：**
| CLI | 平台 statusIds |
|-----|---------------|
| pending | UNQUOTE, WAIT_QUOTATION, QUOTING, IN_THE_DECODING, DECODED |
| quoted | QUOTE, QUOTED, PART_QUOTED |
| ordered | ORDERED |
| closed | IS_CLOSED, CLOSED, EXPIRED, ABATE, CANCELED |

---

### 4. 查看询价单详情

**命令：** `quote inquiry detail <id>`

| API | `GET /inquiries/{inquiryId}/detailV2?platform=ANDROID` |
|-----|-------------------------------------------------------|

返回车型信息、配件需求列表（`needs[]`）、报价状态等。

---

### 5. 查看报价结果

**命令：** `quote reply list -i <inquiryId>`

| API | `GET /inquiries/store/quotation?inquiryId=&storeId=` |
|-----|-----------------------------------------------------|

**注意：** `storeId` 可选，不传则返回所有供应商报价。

**响应中的关键字段：**
```json
{
  "consultingQuotationProducts": [{
    "quotationProductId": "报价ID",
    "brandName": "品牌",
    "displayPrice": "280.00",
    "qualityDescription": "品牌件",
    "arrivalTime": 2,
    "partsNum": "OE号",
    "locationName": "仓库"
  }]
}
```

---

### 6. 比价

**命令：** `quote compare -i <inquiryId> [-s price|delivery|brand]`

调用 `listReplies` 后本地排序，无额外 API 调用。

---

## 账号权限说明

| 条件 | 说明 |
|------|------|
| `registerCompleted: false` | 需先完善公司信息（`POST /users/save_company_info`），注册流程自动引导 |
| `authenticated: N` | 未认证用户，有 5 次免费询价额度（`GET /inquiries/remain_inquiry_number`） |
| `isSimpleInquiryAllowed: false` | 不能用 `POST /inquiries/simple_inquiry`，必须用 `POST /inquiries` |
| `authenticated: Y` | 认证用户，无次数限制，可用简易询价接口 |

**当前测试账号（18162213812）状态：**
- `registerCompleted: true` ✅
- `authenticated: N`，剩余 5 次询价
- `isSimpleInquiryAllowed: false` → 走 `POST /inquiries`

---

## 已验证可用的接口（beta 环境）

| API | 状态 |
|-----|------|
| `POST /public/auth/ecapp/login/password` | ✅ 正常 |
| `POST /public/auth/ecapp/login/cellphone` | ✅ 正常 |
| `GET /public/verify_code` | ✅ 正常 |
| `GET /public/users/{account}/account_info` | ✅ 正常 |
| `POST /public/users/register` | ✅ 正常 |
| `POST /users/save_company_info` | ✅ 正常 |
| `GET /users/_current` | ✅ 正常 |
| `GET /public/area` | ✅ 正常（根节点 `geoId=CHN`） |
| `GET /inquiries/support_brands` | ✅ 正常 |
| `GET /inquiries/remain_inquiry_number` | ✅ 正常 |
| `POST /inquiries` | ✅ 正常 |
| `POST /inquiries/list` | ✅ 正常 |
| `GET /inquiries/{id}/detailV2` | ✅ 正常 |
| `GET /inquiries/store/quotation` | ✅ 正常（无报价时返回空） |
| `POST /inquiries/simple_inquiry` | ❌ 999 系统繁忙（beta 环境问题） |
| `GET /inquiries/car_models` | ❌ 需要完整 VIN |
| `GET /maindata/brand_info` | ❌ beta 环境 500 |
