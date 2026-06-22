# Inquiry API Guide — Casstime terminal-api-v2

Base URL: `https://ec-hwbeta.casstime.com/terminal-api-v2`

All requests require:
```
Authorization: bearer {accessToken}
User-Agent: cassapp/7.9.0.0 iOS/26.5 Apple/iPhone 13
Content-Type: application/json
```

---

## 1. Account Requirements & Permissions

The platform distinguishes three tiers of users for inquiry creation:

| Condition | Can Create Inquiry? | Route |
|-----------|-------------------|-------|
| `authenticated: Y` (认证用户) | Yes, unlimited | `POST /inquiries` (full) or `POST /inquiries/simple_inquiry` |
| `authenticated: N`, `remaining > 0` | Yes, limited quota | Same endpoints; quota tracked via `remain_inquiry_number` |
| `authenticated: N`, `remaining = 0` | No — must authenticate | Returns error 654 |
| `isSimpleInquiryAllowed: false` | Simple inquiry blocked | Must use full `POST /inquiries` |

The current test account has:
- `authenticated: N` (未认证)
- `remaining inquiries: 5` (有剩余次数，可以询价)
- `isSimpleInquiryAllowed: false` (简易询价不允许，需要使用完整询价接口)
- `registerCompleted: true`

**Key insight:** `isSimpleInquiryAllowed: false` means `POST /inquiries/simple_inquiry` will likely return `654` ("当前账号未认证，需补充相关资料认证后才可继续询价"). The correct path for this account is the full `POST /inquiries` endpoint, which uses a different required fields schema and also needs a valid `carBrandId`.

---

## 2. Endpoint Reference

### 2.1 Check Remaining Inquiry Count

```
GET /inquiries/remain_inquiry_number
```

No parameters required. Returns remaining quota for unauthenticated users.

**Response schema:**
```json
{
  "errorCode": 0,
  "data": {
    "inquiryRemainNumber": 5,
    "isCanShare": false
  }
}
```

**Error codes:**
| Code | Meaning |
|------|---------|
| 605 | 非法入参 |
| 999 | 询价服务异常 |

---

### 2.2 Get All Brand Qualities (品质列表)

```
GET /inquiries/all_brand_qualities
```

No parameters. Returns full list of quality codes and names.

**Response:**
```json
{
  "errorCode": 0,
  "data": {
    "qualities": [
      { "qualityId": "ORIGINAL_BRAND", "qualityName": "原厂件" },
      { "qualityId": "ORIGINAL_CURRENCY", "qualityName": "原厂通货" },
      { "qualityId": "ORIGINAL_INLAND_4S", "qualityName": "原厂4S" },
      { "qualityId": "EXTERNAL_BRAND", "qualityName": "外贸件" },
      { "qualityId": "INTERNAL_BRAND", "qualityName": "内贸件" },
      { "qualityId": "BRAND", "qualityName": "品牌件" },
      { "qualityId": "ORIGINAL_OTHERS", "qualityName": "其他原厂" },
      { "qualityId": "SECOND_HAND", "qualityName": "拆车件" },
      { "qualityId": "EQUIVALENT_BRAND", "qualityName": "同质件" },
      { "qualityId": "OTHER_BRAND", "qualityName": "其他品牌件" }
    ]
  }
}
```

**Error codes:**
| Code | Meaning |
|------|---------|
| 605 | 非法入参 |
| 999 | 询价服务异常 |

---

### 2.3 Get User Default Qualities

```
GET /inquiries/brand_qualities
```

Returns the user's saved default quality preferences.

**Response:** Same schema as `all_brand_qualities` but filtered to user defaults.

**POST variant** — set default qualities:
```
POST /inquiries/brand_qualities
```
Body: array of quality IDs (string[])

---

### 2.4 Get Supported Car Brands

```
GET /inquiries/support_brands
```

Returns brands the garage's company is authorized to inquire on. `carBrandCode` from this response maps to `carBrandId` in create inquiry.

**Response:**
```json
{
  "errorCode": 0,
  "data": [
    {
      "carBrandCode": "BYD",
      "carBrandName": "比亚迪",
      "placeId": "place-001",
      "placeName": "国产",
      "brandLogo": "https://...",
      "initialLetter": "B",
      "isNewBrand": false
    }
  ]
}
```

**Error codes:**
| Code | Meaning |
|------|---------|
| 605 | 公司ID为空 |
| 999 | 服务异常 |

---

### 2.5 Get Car Model Info by VIN

```
GET /inquiries/car_models?vin={vin}
```

Required: `vin` (string). Decodes VIN and returns brand + model data needed for inquiry creation.

**Response:** Array of `CarModel` objects, each with:
- `carBrandId` — **the ID to use in `CreateInquiry.carBrandId`**
- `carBrandCode` — brand code string
- `carBrandName` — brand name
- `carModelName` — model name
- `seriesId`, `seriesZh`, `seriesEn` — series info
- `locationId`, `locationName` — origin (国产/进口)
- `saleModelCode`, `saleModelName` — sales model
- `isDefaultBrand` — whether pre-selected

**Error codes:**
| Code | Meaning |
|------|---------|
| 605 | VIN码/userID/companyID为空 |
| 701 | 不支持该VIN码对应的品牌 |
| 775 | VIN码格式有误 |
| 999 | 询价服务异常 |

---

### 2.6 Get Filter Conditions for List

```
GET /inquiries/filter_conditions
```

No parameters. Returns inquiry users, status list, inquiry types, and brand list — used for populating search filters on the list screen.

**Response:**
```json
{
  "errorCode": 0,
  "data": {
    "inquiryUsers": [...],
    "inquiryStatus": [...],
    "inquiryTypes": [...],
    "classifiedBrands": { "supportedBrands": [...] }
  }
}
```

---

### 2.7 Get Anonymous Setting

```
GET /inquiries/anonymous
```

Returns whether the user defaults to anonymous inquiry.

**POST variant** — update setting:
```
POST /inquiries/anonymous?anonymousType=YES|NO
```

---

### 2.8 Get Inquiry Example

```
GET /inquiries/example?key={key}
```

`key` values: `INQUIRY`, `EPC`, `INQUIRYLIST`

Returns example data for onboarding/tutorial purposes.

---

### 2.9 Create Simple Inquiry (简易询价)

```
POST /inquiries/simple_inquiry
```

**IMPORTANT for this account:** `isSimpleInquiryAllowed: false` means this endpoint will return `654`. Use `POST /inquiries` (section 2.10) instead.

**Required body fields:**
```json
{
  "carBrandId": "string (required)",
  "carBrandName": "string (required)",
  "userName": "string (required)",
  "isOpenInvoice": false,
  "qualities": ["BRAND"],
  "source": "ANDROID",
  "isAnonymous": false,
  "provinceGeoId": "string (required)",
  "cityGeoId": "string (required)",
  "countyGeoId": "string (required)",
  "provinceGeoName": "string (required)",
  "cityGeoName": "string (required)",
  "countyGeoName": "string (required)",
  "garageCompanyName": "string (required)",
  "simpleInquiryBatchItems": [
    {
      "mediaType": "TEXT",
      "content": "配件名称",
      "itemNum": 1,
      "description": "附加描述/OE号等"
    }
  ]
}
```

**Optional fields:**
- `vin` — VIN码
- `carModelName` — 车型名称
- `contactNumber` — 联系电话
- `storeIds` — 指定供应商ID数组
- `isSelectBrandFlag` — 是否选择品牌
- `vinPicture` — VIN扫描图片URL
- `isRequireItemInvoice` — 是否需要对项发票
- `garageCompanyName` — 公司名称
- `locationId`/`locationName` — 产地ID/名称
- `seriesId`, `seriesZh`, `seriesEn` — 车系
- `saleModelCode`, `saleModelName` — 销售车型
- `epcModelCode`, `epcModelName` — EPC车型
- `picDemand` — 图片需求类型数组 (`NAMEPLATE`, `HEADSTOCK`, `TAILSTOCK`, `NONE`)
- `picDemandUrls` — 图片URL数组

**simpleInquiryBatchItems item schema:**
```json
{
  "mediaType": "TEXT | PICTURE | AUDIO",
  "content": "文本内容（TEXT类型必填）",
  "url": "图片/语音URL（非TEXT类型使用）",
  "itemNum": 1,
  "description": "描述"
}
```

**Response:**
```json
{
  "errorCode": 0,
  "data": {
    "inquiryId": "询价单ID"
  }
}
```

**Error codes:**
| Code | Meaning |
|------|---------|
| 654 | 账号未认证，无法继续询价 |
| 711 | 生成询价单失败 |
| 999 | 询价服务异常 |

---

### 2.10 Create Full Inquiry (完整询价)

```
POST /inquiries
```

Use this for authenticated users or when `isSimpleInquiryAllowed: false`.

**Required body fields:**
```json
{
  "vin": "string",
  "carBrandId": "string",
  "carBrandName": "string",
  "userName": "string",
  "contactNumber": "string",
  "isOpenInvoice": false,
  "source": "ANDROID",
  "isSelectBrandFlag": false,
  "isAnonymous": false,
  "qualities": ["BRAND"],
  "userNeeds": [
    {
      "needsName": "配件名称 (required)",
      "quantity": 1,
      "isFastOe": false,
      "isSuggest": false,
      "imageUrls": [],
      "originalNeed": "原始名称（可选）",
      "inquirySource": "MANUALLY",
      "oeCode": "OE号（可选）",
      "remark": "备注（可选）"
    }
  ]
}
```

**Optional but commonly used:**
- `carModelName` — 车型名称
- `noReplacement` — `N` (需要替换件) | `Y` (不需要)
- `quotedType` — `SYSTEMHANDLER` | `MANHANDLER` | `COMBINATIONHANDLER`
- `storeIds` — 指定供应商ID数组
- `provinceGeoId`, `cityGeoId`, `countyGeoId` — 地址省市区ID
- `provinceGeoName`, `cityGeoName`, `countyGeoName` — 地址省市区名称
- `locationId`, `locationName` — 产地
- `seriesId`, `seriesZh`, `seriesEn` — 车系
- `saleModelCode`, `saleModelName` — 销售车型
- `isAccidentInquiry` — 是否事故车
- `remarks` — 事故车备注
- `tagValue` — 业务规则 (`QUICK_REPAIR`, `REPAIR`, `CUSTOMIZE`)
- `isInsuranceDirect` — 是否保险直供
- `type` — `WHOLE_CAR_PARTS` | `TYRE` | `HK_MC_TW_INQUIRY`

**userNeeds item required fields:** `needsName`, `quantity`, `isFastOe`, `isSuggest`, `imageUrls`

**inquirySource enum:**
`SELECT`, `ADD`, `MANUALLY`, `ELECTRONIC_CATALOG`, `MANUAL_ENTRY`, `UPDATE_DECODE_ERROR`, `MANUALLY_DECODE_COPY`, `USER_ADD`, `AUXILIARY`

**qualities enum:**
`ORIGINAL_BRAND`, `ORIGINAL_CURRENCY`, `ORIGINAL_INLAND_4S`, `EXTERNAL_BRAND`, `INTERNAL_BRAND`, `BRAND`, `ORIGINAL_OTHERS`, `SECOND_HAND`, `EQUIVALENT_BRAND`, `OTHER_BRAND`

**Response:**
```json
{
  "errorCode": 0,
  "data": {
    "inquiryId": "询价单ID",
    "isSimpleDemand": false
  }
}
```

**Error codes:**
| Code | Meaning |
|------|---------|
| 711 | 生成询价单失败（系统繁忙[1711]） |
| 838 | 不支持7位宝马VIN码 |
| 999 | 询价服务异常 |

---

### 2.11 Get Inquiry List

```
POST /inquiries/list?page={page}&size={size}
```

Required query params: `page` (number), `size` (number)

**Request body** (all optional):
```json
{
  "searchContext": "关键字",
  "inquiryType": "CUSTOMIZE_INQUIRY",
  "startDate": "2026-01-01",
  "endDate": "2026-06-15",
  "statusIds": ["WAIT_QUOTATION"],
  "createdBys": ["userId1"],
  "carBrandIds": ["brandId1"],
  "isSentry": false,
  "isExclusiveCustomer": false
}
```

**Status IDs mapping:**
| CLI status | Platform statusIds |
|------------|-------------------|
| pending | `UNQUOTE`, `WAIT_QUOTATION`, `QUOTING`, `IN_THE_DECODING`, `DECODED` |
| quoted | `QUOTE`, `QUOTED`, `PART_QUOTED` |
| ordered | `ORDERED` |
| closed | `IS_CLOSED`, `CLOSED`, `EXPIRED`, `ABATE`, `CANCELED` |

**Response:**
```json
{
  "errorCode": 0,
  "data": {
    "content": [
      {
        "inquiryId": "IQ-XXXX",
        "carBrandId": "...",
        "carBrandName": "丰田",
        "carModelName": "卡罗拉",
        "userNeed": "前挡风玻璃, 雨刷...",
        "statusId": "WAIT_QUOTATION",
        "statusDesc": "待报价",
        "vin": "LXXXXX",
        "createdName": "张三",
        "createdBy": "userId",
        "createdStamp": 1718000000000,
        "isSimpleInquiry": false,
        "hasNewQuote": false,
        "inquiryDataType": "HOT"
      }
    ],
    "totalElements": 50,
    "totalPages": 3,
    "number": 1,
    "size": 20
  }
}
```

**GET variant** (for supplier side):
```
GET /inquiries/list?storeId={storeId}&pageSize={n}&page={n}
```

---

### 2.12 Get Inquiry Detail

```
GET /inquiries/{inquiryId}/detailV2?platform=ANDROID
```

Path param: `inquiryId`
Query params: `platform` (required: `IOS`|`ANDROID`|`PC`), `fromPage` (optional), `isSentry` (optional, default false)

Returns comprehensive inquiry detail including vehicle info, needs, quote results.

**Simpler variant:**
```
GET /inquiries/{inquiryId}/basic_info
```

Returns basic info without full quote result data.

**Error codes:**
| Code | Meaning |
|------|---------|
| 999 | 询价服务异常 |

---

### 2.13 Get Inquiry Detail (Simple/Middle-tier Cars)

For inquiries where `isSimpleDemand: true` (中端车):

```
GET /simple_inquiry/{inquiryId}/detail?platform=ANDROID
```

or the older route:
```
GET /inquiries/simple_inquiry/{inquiryId}?platform=ANDROID
```

**Check inquiry type first:**
```
GET /simple_inquiry/{inquiryId}/type
```

Returns whether the inquiry is a middle-tier ("中端车") type — used to decide which detail endpoint to call.

---

### 2.14 Get Quotation Progress

```
GET /inquiries/progress_info?inquiryId={id}&platform=ANDROID
```

For simple inquiries (中端车):
```
GET /simple_inquiry/progress_info?inquiryId={id}
```

Returns quote progress including per-supplier quotation status.

---

### 2.15 Get Store Quotation

```
GET /inquiries/store/quotation?inquiryId={id}&storeId={storeId}
```

Returns the quotation from a specific store for a given inquiry.

---

### 2.16 Get Quotation Scheme (导购单)

```
GET /inquiries/quotation_scheme?quotationId={id}
```

Returns purchase recommendation scheme list.

**Error codes:**
| Code | Meaning |
|------|---------|
| 651 | 无权限查看 |
| 784 | 导购单不存在 |

---

### 2.17 Get Parts List (Common Parts)

```
GET /inquiries/parts_new?vin={vin}&carBrandCode={code}
```

Returns commonly requested parts for a given VIN/brand. Useful for pre-populating inquiry UI.

Older variant (no VIN):
```
GET /inquiries/parts
```

---

### 2.18 Archive Endpoints (Cold Storage)

For older/archived inquiries:

```
GET /inquiry-archive/{inquiryId}/type      — 判断是否冷库/是否轮胎
GET /inquiry-archive/{inquiryId}/head      — 冷库询价单表头
GET /inquiry-archive/{inquiryId}/detail    — 冷库询价单明细
GET /inquiry-archive/{inquiryId}/spd       — 冷库 SPD 信息
```

---

### 2.19 Inquiry Cart

```
GET  /inquiry-cart/count               — 购物车配件数量
POST /inquiry-cart                     — 加入购物车
GET  /inquiry-cart/coupons/{settleId}  — 结算优惠券
GET  /inquiry-cart/promotions/{cartId} — 购物车促销
GET  /inquiry-cart/settle/{settleId}   — 结算单详情
```

---

### 2.20 Tyre Inquiry Endpoints

```
GET  /tyre_inquiry/brands              — 轮胎品牌列表
GET  /tyre_inquiry/condition           — 当前VIN+规格询价状态
GET  /tyre_inquiry/tyre_feature        — 轮胎特性
GET  /tyre_inquiry/header              — 轮胎询价页表头
GET  /tyre_inquiry/number              — 询价次数
GET  /tyre_inquiry/demand              — 需求信息
GET  /tyre_inquiry/tyre_switch         — 功能开关
GET  /tyre_inquiry/tyre_switch_config  — 功能开关配置
GET  /tyre_inquiry/inquiry/limit       — 询价限制
GET  /tyre_inquiry/{vin}/check         — 轮胎询价VIN校验
GET  /tyre_inquiry/tyre/specifications/{vin} — 轮胎规格
GET  /tyre_inquiry/vehicle/models/{vin}      — 车型列表
```

---

## 3. Complete CLI Flow

### Step 1: Lookup Vehicle Info
```
GET /inquiries/car_models?vin=<VIN>
```
Extract `carBrandId`, `carBrandName`, `carModelName`, `seriesId`, `locationId` etc.

### Step 2: Get Available Qualities
```
GET /inquiries/all_brand_qualities
GET /inquiries/brand_qualities   (user defaults)
```

### Step 3: Create Inquiry
For authenticated users or accounts with `isSimpleInquiryAllowed: true`:
```
POST /inquiries/simple_inquiry
```
For all other accounts (including this test account):
```
POST /inquiries
```
Both return `{ inquiryId, isSimpleDemand }`.

### Step 4: Check Inquiry Status
```
POST /inquiries/list?page=1&size=20    (list all)
GET  /inquiries/{id}/detailV2?platform=ANDROID   (single)
```
If `isSimpleDemand: true`, use `GET /simple_inquiry/{id}/detail?platform=ANDROID` instead.

### Step 5: Get Quotes
```
GET /inquiries/progress_info?inquiryId={id}&platform=ANDROID
GET /inquiries/store/quotation?inquiryId={id}&storeId={storeId}
GET /inquiries/quotation_scheme?quotationId={id}
```

### Step 6: Add to Cart and Order
```
POST /inquiry-cart
POST /inquiry-cart/settle/{settleId}  (finalize order)
```

---

## 4. carBrandId Discovery

`carBrandId` is not a static enum — it's dynamically resolved per garage/user. Two methods:

**Method A:** Use VIN decode (returns exact value for the inquiry)
```
GET /inquiries/car_models?vin=<VIN>
→ CarModel[].carBrandId
```

**Method B:** Get supported brands list
```
GET /inquiries/support_brands
→ supportBrand[].carBrandCode  (this IS the carBrandId for most brands)
```

**Method C:** Filter conditions (also returns brand list)
```
GET /inquiries/filter_conditions
→ data.classifiedBrands.supportedBrands
```

Note: The `supportBrand` schema returns `carBrandCode` as the identifier. In `CreateInquiry`, this maps to `carBrandId`. Common values based on industry data: `TOYOTA` (丰田), `VW` (大众), `BMW` (宝马), `BENZ` (奔驰), `AUDI` (奥迪), `HONDA` (本田). Exact IDs must be looked up via `/support_brands` or `/car_models`.

---

## 5. Known Beta Environment Limitations

| Endpoint | Issue |
|----------|-------|
| `POST /inquiries/simple_inquiry` | Returns `999` ("系统繁忙") in beta; also blocked by `isSimpleInquiryAllowed: false` for this account |
| `POST /inquiries` | Should work in beta; is the correct path for this account |
| General | Beta environment may have intermittent `999` responses — retry once before treating as fatal |
| `isSimpleInquiryAllowed: false` | Account cannot use simple inquiry path; must use full `POST /inquiries` |

---

## 6. Error Code Reference

| Code | Meaning | Common context |
|------|---------|----------------|
| 0 | 成功 | All |
| 605 | 非法入参 (invalid params) | Missing required fields |
| 651 | 无权限查看 | Quotation scheme, detail |
| 652 | 账号在其它设备登录 | Auth |
| 654 | 账号未认证，需认证才可继续询价 | Simple inquiry creation |
| 701 | 不支持该VIN品牌 | car_models |
| 702 | 账号或密码错误 | Login |
| 711 | 生成询价单失败 | Inquiry creation |
| 775 | VIN码有误 | car_models |
| 784 | 导购单不存在 | quotation_scheme |
| 838 | 不支持7位宝马VIN码 | Inquiry creation |
| 999 | 系统繁忙 | All; especially beta env |

---

## 7. Current Account Summary

Based on the known account state (`user: 6a30adc4d644930001c0e687`):

- **Authentication status:** N (未认证)
- **Remaining inquiries:** 5 (can create up to 5 more without authenticating)
- **isSimpleInquiryAllowed:** false → must use `POST /inquiries` not `POST /inquiries/simple_inquiry`
- **registerCompleted:** true → basic registration done

**Recommended flow for this account:**
1. Call `GET /inquiries/remain_inquiry_number` to confirm quota
2. Call `GET /inquiries/car_models?vin=<VIN>` to get `carBrandId`
3. Call `POST /inquiries` with full body including `userNeeds` array
4. Poll `POST /inquiries/list?page=1&size=20` to track status
5. When status moves to `QUOTED`, call `GET /inquiries/{id}/detailV2?platform=ANDROID`

**Note:** To unlock unlimited inquiries and `isSimpleInquiryAllowed: true`, the account needs to complete company authentication (企业认证) through the platform.

---

## 8. Live Test Results

> Note: Bash and file read access to `~/.quote/config.json` were denied in this session, preventing live API testing. All results below are derived from swagger.json schema analysis and existing source code in `packages/cli/src/adapter/api.mjs`.

**What swagger.json confirms:**
- `POST /inquiries/simple_inquiry` requires `carBrandId`, `carBrandName`, `userName`, address geo fields, `simpleInquiryBatchItems`, and returns `654` for unauthenticated accounts
- `POST /inquiries` is the full-featured path, requires `vin`, `carBrandId`, `carBrandName`, `userName`, `contactNumber`, `isOpenInvoice`, `source`, `isSelectBrandFlag`, `isAnonymous`
- `POST /inquiries/list` uses page/size as query params, filter body is optional
- `GET /inquiries/remain_inquiry_number` requires no params and directly returns remaining count
- `GET /inquiries/all_brand_qualities` returns all 10 quality codes including `BRAND`, `ORIGINAL_BRAND`, `SECOND_HAND` etc.

**Current CLI implementation gap:**
The `api.mjs` `createInquiry()` method calls `POST /inquiries/simple_inquiry` but the account has `isSimpleInquiryAllowed: false`. The method should either:
1. Fall back to `POST /inquiries` when `isSimpleInquiryAllowed: false`
2. Always use `POST /inquiries` with the `userNeeds` array format

The `POST /inquiries` format differs from `simple_inquiry`: it uses `userNeeds` (structured array with `needsName`, `quantity`, etc.) instead of `simpleInquiryBatchItems` (free-form text/media items).
