/**
 * API 远程接口适配器
 * 对接 terminal-api-v2 真实后端
 */
import { randomUUID } from 'crypto';
import { getValidToken, refreshToken } from '../auth.mjs';
import { APP_USER_AGENT } from '../constants.mjs';
import { Store } from '../store.mjs';

// 服务端认证失败的 errorCode 集合（token 失效、过期、被踢等）
const AUTH_ERROR_CODES = new Set([401, 652, 653, 654]);

export class ApiAdapter {
  constructor(config = {}) {
    this.baseUrl = config.apiBase || '';
    this._store  = new Store();   // reads QUOTE_CONFIG_DIR when set, otherwise ~/.quote
  }

  async _headers() {
    const token = await getValidToken(this.baseUrl);
    return {
      'Content-Type': 'application/json',
      'Authorization': `bearer ${token}`,
      'User-Agent': APP_USER_AGENT,
    };
  }

  async _request(method, path, body, query = {}) {
    if (!this.baseUrl) {
      throw new Error('未配置 apiBase，请执行: quote config set --api-base <url>');
    }

    const base = this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`;
    const url = new URL(path.replace(/^\//, ''), base);
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    }

    const makeOpts = async () => {
      const opts = { method, headers: await this._headers() };
      if (body && method !== 'GET') opts.body = JSON.stringify(body);
      return opts;
    };

    const parseResponse = (json) => {
      if (json.errorCode !== undefined && json.errorCode !== 0) {
        const err = new Error(json.message || `API 错误 [${json.errorCode}]`);
        err.errorCode = json.errorCode;
        throw err;
      }
      return json.data !== undefined ? json.data : json;
    };

    // 首次请求
    const res = await fetch(url.toString(), await makeOpts());
    const json = await res.json();

    // 服务端返回认证错误时，尝试刷新 token 后重试一次
    if (
      json.errorCode !== undefined &&
      (AUTH_ERROR_CODES.has(json.errorCode) || res.status === 401)
    ) {
      await refreshToken(this.baseUrl);   // 失败则向上抛出（提示重新登录）
      const retryRes = await fetch(url.toString(), await makeOpts());
      const retryJson = await retryRes.json();
      return parseResponse(retryJson);
    }

    return parseResponse(json);
  }

  // ─── Inquiry ─────────────────────────────────────────────

  /**
   * 获取支持的品牌列表
   * carBrandCode 即为 carBrandId
   */
  async listSupportBrands() {
    try {
      const result = await this._request('GET', '/inquiries/support_brands');
      return Array.isArray(result) ? result : [];
    } catch {
      return [];
    }
  }

  /**
   * 根据 VIN 获取车型品牌信息
   */
  async getCarModelByVin(vin) {
    try {
      const result = await this._request('GET', '/inquiries/car_models', null, { vin });
      const model = Array.isArray(result) ? result[0] : null;
      if (!model) return null;
      // carBrandId 可能为空，用 carBrandCode 兜底
      return {
        ...model,
        carBrandId:   model.carBrandId   || model.carBrandCode || '',
        carModelName: model.model        || model.epcModelName  || model.saleModelName || '',
      };
    } catch {
      return null;
    }
  }

  /**
   * 创建询价
   * isSimpleInquiryAllowed=true 走 simple_inquiry（自由文本）
   * 否则走 POST /inquiries（标准流程）
   */
  async createInquiry(data) {
    const config = this._store.getConfig();

    let carBrandId   = data.carBrandId   || '';
    let carBrandName = data.carBrandName || data.vehicle || '';
    let carModelName = data.carModelName || data.vehicle || '';

    if (data.vin && !carBrandId) {
      const model = await this.getCarModelByVin(data.vin);
      if (model) {
        carBrandId   = model.carBrandId   || carBrandId;
        carBrandName = model.carBrandName || carBrandName;
        carModelName = model.carModelName || carModelName;
      }
    }

    // 支持多配件
    const products = data.products && data.products.length > 0
      ? data.products
      : [data.product];

    let result;

    if (config.isSimpleInquiryAllowed) {
      const simpleBody = {
        vin:              data.vin || '',
        carBrandId,
        carBrandName,
        carModelName,
        userName:         config.userLoginId || '',
        source:           'ANDROID',
        qualities:        data.qualities || ['BRAND'],
        isOpenInvoice:    false,
        isAnonymous:      false,
        provinceGeoId:    config.provinceGeoId   || '',
        cityGeoId:        config.cityGeoId       || '',
        countyGeoId:      config.countyGeoId     || '',
        provinceGeoName:  config.provinceGeoName || '',
        cityGeoName:      config.cityGeoName     || '',
        countyGeoName:    config.countyGeoName   || '',
        garageCompanyName: config.companyName    || '',
        simpleInquiryBatchItems: products.map((name, i) => ({
          content:   name,
          mediaType: 'TEXT',
          itemNum:   i + 1,
          description: i === 0 ? [
            data.oeNumber ? `OE: ${data.oeNumber}` : '',
            data.note || '',
          ].filter(Boolean).join(' ') : '',
        })),
      };
      result = await this._request('POST', '/inquiries/simple_inquiry', simpleBody);
    } else {
      const fullBody = {
        vin:              data.vin || 'UNKNOWN00000000000',
        carBrandId,
        carBrandName,
        carModelName,
        userName:         config.userLoginId || '',
        contactNumber:    config.cellphone   || '',
        isOpenInvoice:    false,
        source:           'ANDROID',
        isSelectBrandFlag: false,
        isAnonymous:      false,
        qualities:        data.qualities || ['BRAND'],
        provinceGeoId:    config.provinceGeoId   || '',
        cityGeoId:        config.cityGeoId       || '',
        countyGeoId:      config.countyGeoId     || '',
        provinceGeoName:  config.provinceGeoName || '',
        cityGeoName:      config.cityGeoName     || '',
        countyGeoName:    config.countyGeoName   || '',
        userNeeds: products.map((name, i) => ({
          needsName:     name,
          quantity:      i === 0 ? (Number(data.quantity) || 1) : 1,
          isFastOe:      false,
          isSuggest:     false,
          imageUrls:     [],
          originalNeed:  name,
          inquirySource: 'MANUALLY',
          oeCode:        i === 0 ? (data.oeNumber || '') : '',
          remark:        i === 0 ? (data.note     || '') : '',
        })),
      };
      result = await this._request('POST', '/inquiries', fullBody);
    }

    return {
      id:        result.inquiryId || result,
      product:   products.join('、'),
      oeNumber:  data.oeNumber || '',
      vehicle:   carBrandName + (carModelName ? ` ${carModelName}` : ''),
      quantity:  Number(data.quantity) || 1,
      note:      data.note || '',
      status:    'pending',
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * 获取询价单列表
   */
  async listInquiries(filter = {}) {
    const statusMap = {
      pending:  ['UNQUOTE', 'WAIT_QUOTATION', 'QUOTING'],
      quoted:   ['QUOTE', 'QUOTED', 'PART_QUOTED'],
      ordered:  ['ORDERED'],
      closed:   ['IS_CLOSED', 'CLOSED', 'EXPIRED', 'ABATE'],
    };

    const body = {};
    if (filter.status && statusMap[filter.status]) {
      body.statusIds = statusMap[filter.status];
    }
    if (filter.keyword) {
      body.searchContext = filter.keyword;
    }

    const result = await this._request('POST', '/inquiries/list', body, {
      page: filter.page || 1,
      size: filter.size || 20,
    });

    const items = result.content || result || [];
    if (!Array.isArray(items) || items.length === 0) return [];

    return items.map(item => this._mapInquiryItem(item));
  }

  /**
   * 获取询价单详情
   */
  async getInquiry(id) {
    const result = await this._request('GET', `/inquiries/${id}/detailV2`, null, {
      platform: 'ANDROID',
    });
    return this._mapInquiryDetail(id, result);
  }

  /**
   * 关闭询价单
   * 平台未提供关闭 API，暂不支持
   */
  async closeInquiry(_id) {
    throw new Error('平台暂不支持通过 API 关闭询价单，请前往 casstime APP 或网页端操作');
  }

  /**
   * 批量查询询价单状态（比 detailV2 更轻量，用于 watch 阶段一）
   * 返回 { inquiryId, status, rawStatusId }
   */
  async pollInquiryStatus(inquiryId) {
    const result = await this._request('POST', '/inquiries/status',
      [{ inquiryId }]
    );
    const item = Array.isArray(result) ? result[0] : null;
    if (!item) return null;
    return {
      inquiryId,
      status:      mapStatus(item.inquiryStatus || ''),
      rawStatusId: item.inquiryStatus || '',
    };
  }

  // ─── Reply（报价结果）────────────────────────────────────

  /**
   * 从 detailV2 原始数据中提取报价列表（避免重复请求）
   * 每条报价会带上 storeId / storeName，供后续加购物车使用
   */
  async _fetchRepliesFromDetail(inquiryId, detail) {
    const stores = detail.inquiryQuoteStores || [];
    if (stores.length === 0) return [];

    const results = await Promise.all(
      stores.map(async (store) => {
        try {
          const result = await this._request('GET', '/inquiries/store/quotation', null, {
            inquiryId,
            storeId: store.storeId,
          });
          return (result.consultingQuotationProducts || []).map(
            item => this._mapQuotationProduct(item, store.storeId, store.storeName)
          );
        } catch {
          return [];
        }
      })
    );
    return results.flat();
  }

  /**
   * 获取某询价单的报价列表
   */
  async listReplies(inquiryId) {
    try {
      const detail = await this._request('GET', `/inquiries/${inquiryId}/detailV2`, null, {
        platform: 'ANDROID',
      });
      const all = await this._fetchRepliesFromDetail(inquiryId, detail);
      // 过滤掉 price=0 的占坑槽位，只返回供应商已填实价的报价
      return all.filter(r => r.priced);
    } catch {
      return [];
    }
  }

  /**
   * 创建报价 — 平台模式下买方不手动创建报价，由供应商在平台上操作
   */
  async createReply(_data) {
    throw new Error('API 模式下报价由供应商在平台上提交，买方无需手动创建');
  }

  // ─── Compare ─────────────────────────────────────────────

  /**
   * 比价 — 一次 detailV2 同时拿询价信息和报价列表，避免重复请求
   */
  async compareReplies(inquiryId, sort = 'price') {
    const detail = await this._request('GET', `/inquiries/${inquiryId}/detailV2`, null, {
      platform: 'ANDROID',
    });
    const inquiry = this._mapInquiryDetail(inquiryId, detail);
    const replies = (await this._fetchRepliesFromDetail(inquiryId, detail)).filter(r => r.priced);

    const sorted = [...replies].sort((a, b) => {
      if (sort === 'price')    return a.price - b.price;
      if (sort === 'delivery') return (a.delivery || 999) - (b.delivery || 999);
      if (sort === 'brand')    return (a.brand || '').localeCompare(b.brand || '');
      return 0;
    });

    const lowest  = sorted[0] || null;
    const fastest = [...replies].sort((a, b) => (a.delivery || 999) - (b.delivery || 999))[0] || null;

    return { inquiry, sorted, lowest, fastest };
  }

  // ─── Order ───────────────────────────────────────────────

  /**
   * 获取用户收货地址列表
   * 先尝试 GET /address/proxy_order_bff/post_addresses/{userLoginId}（完整列表），
   * 失败则回退到 GET /address（仅默认地址）。
   */
  async listAddresses() {
    const config = this._store.getConfig();
    const userLoginId = config.userLoginId || '';

    try {
      const result = await this._request(
        'GET', `/address/proxy_order_bff/post_addresses/${userLoginId}`
      );
      const items = Array.isArray(result) ? result : (result ? [result] : []);
      if (items.length > 0) {
        return items.map(addr => ({
          id:            addr.id || '',
          receiverName:  addr.receiverName || '',
          address:       [
            addr.provinceGeoName, addr.cityGeoName,
            addr.countyGeoName,   addr.villageGeoName,
            addr.address,
          ].filter(Boolean).join(' '),
          contactNumber: addr.contactNumber || addr.contactTel || '',
        }));
      }
    } catch { /* fall through */ }

    // 回退：只拿默认地址
    try {
      const addr = await this._request('GET', '/address');
      if (addr) {
        return [{
          id:            addr.addressId || addr.id || '',
          receiverName:  addr.receiverName || '',
          address:       [
            addr.provinceGeoName, addr.cityGeoName,
            addr.countyGeoName,   addr.address,
          ].filter(Boolean).join(' '),
          contactNumber: addr.contactNumber || addr.contactTel || '',
        }];
      }
    } catch { /* fall through */ }

    return [];
  }

  /**
   * 为"结算单预览"阶段暴露物流选项——在 tosettle + INIT 之后调用。
   * 返回结构化的物流列表，供 CLI 展示给用户选择。
   *
   * @param {string} inquiryId
   * @param {string} replyId
   * @param {string} addressId
   * @returns {{ settleId, totalPrice, settleProducts, logisticsOptions, validGroups }}
   */
  async previewSettle(inquiryId, replyId, addressId) {
    const config = this._store.getConfig();

    // Step 1: purchase_confirm
    await this._request('POST', '/inquiries/purchase_confirm', {
      inquiryId,
      quotationProductIds: [replyId],
    });

    // Step 2: 找报价
    const detail = await this._request('GET', `/inquiries/${inquiryId}/detailV2`, null, {
      platform: 'ANDROID',
    });
    const inquiry = this._mapInquiryDetail(inquiryId, detail);
    const stores  = detail.inquiryQuoteStores || [];

    let matched = null;
    for (const store of stores) {
      const res = await this._request('GET', '/inquiries/store/quotation', null, {
        inquiryId, storeId: store.storeId,
      }).catch(() => null);
      if (!res) continue;
      const product = (res.consultingQuotationProducts || [])
        .find(p => p.quotationProductId === replyId);
      if (product) {
        matched = this._mapQuotationProduct(product, store.storeId, store.storeName);
        break;
      }
    }
    if (!matched) throw new Error(`未找到报价 ${replyId}`);

    // Step 3: tosettle
    const settleRes = await this._request('POST', '/buy/proxy_order_bff/tosettle', {
      application: 'ANDROID', businessGroup: 'INQUIRY', businessUnit: 'COMMON_INQUIRY',
      originSource: 'INQUIRY_CONFIRM',
      buyerUserLoginId: config.userLoginId  || '',
      buyerCompanyId:   String(config.garageCompanyId || ''),
      terminal: 'APP', postalAddressId: addressId,
      toSettleItems: [{
        productId:     matched.id,
        facilityId:    matched.facilityId,
        sellerStoreId: matched.storeId,
        inquiryId,
        quantity:      inquiry.quantity || 1,
        needInvoice:   'B',
        itemInvoice:   'N',
      }],
    });
    const settleId = settleRes.settleId;
    if (!settleId) throw new Error('生成结算单失败：响应中未包含 settleId');

    // Step 4: INIT
    const settleDetail = await this._request('POST', '/buy/settle', {
      type: 'INIT',
      settlePayload: { settleId, application: 'ANDROID', terminal: 'APP' },
    });

    const totalPrice = settleDetail.totalAmount?.totalAmount
      ?? settleDetail.totalAmount?.productTotalAmount ?? 0;

    const validGroups = settleDetail.validGroups || [];
    const settleProducts = [];
    // 将每个 store 的所有物流选项扁平化，加上 storeId 标识
    const logisticsOptions = [];

    for (const group of validGroups) {
      for (const inqItem of (group.inquiryItems || [])) {
        for (const product of (inqItem.productItems || [])) {
          settleProducts.push({
            settleItemId: product.settleItemId,
            productId:    product.productId,
            quantity:     product.quantity,
            storeId:      group.storeId,
            facilityId:   product.facilityId || matched.facilityId,
          });
        }
      }

      for (const svc of (group.xiaomaLogisticsService || [])) {
        // 默认推荐
        const dl = svc.defaultLogisticsDTO;
        if (dl) {
          logisticsOptions.push({
            storeId:   svc.storeId,
            facilityId: svc.facilityId,
            code:      dl.logisticsCompanyCode,
            name:      dl.logisticsCompanyName,
            transport: dl.transportationName || '汽运',
            location:  dl.logisticsLocationName || '',
            deliver:   dl.deliverType === 'arrive_home' ? '送货上门' : `${dl.logisticsLocationName || ''}自提`,
            shift:     dl.displayShiftName ? `${dl.displayShiftName} ${dl.departureTime || ''}` : '',
            _raw:      dl,
            isDefault: true,
          });
        }
        // 常用物流（去重 code）
        const seenCodes = new Set(dl ? [dl.logisticsCompanyCode] : []);
        for (const c of (svc.commonlyUsedLogistics || [])) {
          if (seenCodes.has(c.displayLogisticsCompaniesCode)) continue;
          seenCodes.add(c.displayLogisticsCompaniesCode);
          const way = (c.transportWayDTOS || [])[0];
          const loc = (way?.logisticsLocationDTOS || [])[0];
          logisticsOptions.push({
            storeId:   svc.storeId,
            facilityId: svc.facilityId,
            code:      c.displayLogisticsCompaniesCode,
            name:      c.displayLogisticsCompaniesName,
            transport: way?.transportationName || '汽运',
            location:  loc?.logisticsLocationName || '',
            deliver:   loc?.deliverType === 'arrive_home' ? '送货上门'
              : `${loc?.logisticsLocationName || ''}自提`,
            shift:     '',
            _raw:      { storeId: svc.storeId, facilityId: svc.facilityId, ...c, way, loc },
            isDefault: false,
          });
        }
      }
    }

    if (settleProducts.length === 0) {
      settleProducts.push({
        settleItemId: matched.id, productId: matched.id,
        quantity: inquiry.quantity || 1,
        storeId: matched.storeId, facilityId: matched.facilityId,
      });
    }

    return { settleId, totalPrice, settleProducts, logisticsOptions, matched, inquiry, validGroups };
  }

  /**
   * 确认下单 — 完整下单流程（采购确认 → 生成结算单 → 提交结算）
   *
   * 流程：
   *   0. 解析收货地址（优先 opts.addressId，否则取用户第一条地址）
   *   1. POST /inquiries/purchase_confirm           — 采购确认
   *   2. 从 detailV2 + store/quotation 找目标报价的 storeId / facilityId
   *   3. POST /buy/proxy_order_bff/tosettle         — 生成结算单（需传 postalAddressId）
   *   4. POST /buy/settle { type: INIT }            — 拉结算详情（含 totalAmount / settleItemId）
   *   5. POST /buy/proxy_order_bff/settle_submit    — 提交下单，返回 orderIds
   *
   * @param {string} inquiryId
   * @param {string} replyId       quotationProductId
   * @param {object} opts
   * @param {string} opts.addressId        收货地址 ID
   * @param {string} [opts.logisticsCode]  物流公司 code（不传则取推荐；'default' 同不传）
   * @param {object} [opts._preview]       已有 previewSettle 结果时直接复用，跳过重复请求
   */
  async confirmOrder(inquiryId, replyId, opts = {}) {
    const config = this._store.getConfig();

    // ── Step 0: 解析收货地址 ─────────────────────────────────
    const addressId = opts.addressId || '';
    if (!addressId) throw new Error('addressId 不能为空');

    // ── Steps 1-4: 复用 previewSettle，或重新计算 ────────────
    const preview = opts._preview || await this.previewSettle(inquiryId, replyId, addressId);
    const { settleId, totalPrice, settleProducts, logisticsOptions, matched } = preview;

    // ── 选择物流 ────────────────────────────────────────────
    let xiaomaLogistics = [];
    const targetCode = opts.logisticsCode || '';

    for (const opt of logisticsOptions) {
      const pick = targetCode
        ? opt.code === targetCode
        : opt.isDefault;
      if (!pick) continue;

      const raw = opt._raw;
      // raw 有两种形状：来自 defaultLogisticsDTO 的直接字段，或来自 commonlyUsedLogistics 的嵌套结构
      if (raw.logisticsCompanyCode) {
        // defaultLogisticsDTO 形状
        xiaomaLogistics.push({
          storeId:                      raw.storeId,
          facilityId:                   raw.facilityId,
          logisticsCompanyCode:         raw.logisticsCompanyCode,
          logisticsCompanyName:         raw.logisticsCompanyName,
          transportationCode:           raw.transportationCode,
          transportationName:           raw.transportationName,
          logisticsLocationCode:        raw.logisticsLocationCode,
          logisticsLocationName:        raw.logisticsLocationName,
          landingLogisticsLocationCode: raw.landingLogisticsLocationCode,
          landingLogisticsLocationName: raw.landingLogisticsLocationName,
          deliverType:                  raw.deliverType,
          departureTime:                raw.departureTime  || '',
          lineShiftCode:                raw.lineShiftCode  || '',
          lineShiftName:                raw.lineShiftName  || '',
        });
      } else {
        // commonlyUsedLogistics 形状（_raw = { storeId, facilityId, ...c, way, loc }）
        const way = raw.way;
        const loc = raw.loc;
        xiaomaLogistics.push({
          storeId:                      opt.storeId,
          facilityId:                   opt.facilityId,
          logisticsCompanyCode:         raw.displayLogisticsCompaniesCode,
          logisticsCompanyName:         raw.displayLogisticsCompaniesName,
          transportationCode:           way?.transportationCode  || 'CAR_FREIGHT',
          transportationName:           way?.transportationName  || '汽运',
          logisticsLocationCode:        loc?.logisticsLocationCode || 'arrive_home',
          logisticsLocationName:        loc?.logisticsLocationName || '送货上门',
          landingLogisticsLocationCode: loc?.landingLogisticCompanyCode || raw.displayLogisticsCompaniesCode,
          landingLogisticsLocationName: loc?.landingLogisticCompanyName || raw.displayLogisticsCompaniesName,
          deliverType:                  loc?.deliverType || 'arrive_home',
          departureTime:                '',
          lineShiftCode:                '',
          lineShiftName:                '',
        });
      }
      break;
    }

    // 兜底：没有任何物流选项时用 _pickLogisticsEntry 提取
    if (xiaomaLogistics.length === 0) {
      for (const group of (preview.validGroups || [])) {
        for (const svc of (group.xiaomaLogisticsService || [])) {
          const entry = _pickLogisticsEntry(svc);
          if (entry) { xiaomaLogistics.push(entry); break; }
        }
        if (xiaomaLogistics.length) break;
      }
    }

    // ── Step 5: 提交结算下单 ────────────────────────────────
    const submitBody = {
      settleId,
      clientRequestId:  randomUUID(),
      application:      'ANDROID',
      businessGroup:    'INQUIRY',
      businessUnit:     'COMMON_INQUIRY',
      buyerUserLoginId: config.userLoginId || '',
      buyerCompanyId:   String(config.garageCompanyId || ''),
      postalAddressId:  addressId,
      terminal:         'APP',
      goldCoinUsed:     false,
      totalAmount:      totalPrice,
      invoices: [{
        storeId:     matched.storeId,
        inquiryId,
        needInvoice: 'B',
      }],
      logistics: { xiaomaLogistics },
      products:   settleProducts,
    };

    let submitRes;
    try {
      submitRes = await this._request('POST', '/buy/proxy_order_bff/settle_submit', submitBody);
    } catch (err) {
      // beta 环境已知问题：订单成功入库但后续通知步骤异常，服务端返回 errorCode=999。
      // 此时兜底查最新订单：若 30 秒内出现本 inquiryId 对应的新订单，视为下单成功。
      process.stderr.write(`[DBG] settle_submit catch: errorCode=${err.errorCode} type=${typeof err.errorCode}\n`);
      if (err.errorCode === 999) {
        process.stderr.write(`[DBG] entering fallback poll\n`);
        const fallback = await this._findRecentOrder(inquiryId, 30_000);
        process.stderr.write(`[DBG] fallback result: ${fallback ? fallback.orderId : 'null'}\n`);
        if (fallback) return this._buildConfirmResult(fallback, settleId, inquiryId, replyId, matched, preview);
      }
      throw err;
    }

    if (!submitRes.isSuccess) {
      const msg = (typeof submitRes.message === 'object'
        ? submitRes.message?.content
        : submitRes.message) || submitRes.code || '未知错误';
      throw new Error(`下单提交失败：${msg}`);
    }

    const orderId = Array.isArray(submitRes.orderIds) && submitRes.orderIds.length > 0
      ? submitRes.orderIds[0]
      : settleId;

    return {
      order: {
        id:          orderId,
        settleId,
        inquiryId,
        replyId,
        status:      'pending_payment',
        confirmedAt: new Date().toISOString(),
        totalPrice,
        currency:    'CNY',
      },
      inquiry: preview.inquiry,
      reply: {
        id:       matched.id,
        supplier: matched.supplier,
        price:    matched.price,
        currency: 'CNY',
        partNum:  matched.partNum  || '',
        brand:    matched.brand    || '',
        location: matched.location || '',
      },
    };
  }

  async listOrders({ createdBy } = {}) {
    try {
      const body = { pageNumber: 1, pageSize: 20 };
      if (createdBy) body.createdBy = createdBy;
      const result = await this._request('POST', '/orders', body);
      const items = result.orders || result.content || [];
      return Array.isArray(items) ? items.map(i => this._mapOrderItem(i)) : [];
    } catch {
      return [];
    }
  }

  /**
   * settle_submit errorCode=999 兜底：轮询订单列表，找到 submitTime 之后出现的
   * 最新订单（orderDate >= submitTime）。返回 raw order item 或 null。
   * 原始订单列表不含 inquiryId 顶层字段，改用时间戳识别。
   */
  async _findRecentOrder(_inquiryId, windowMs = 30_000) {
    const submitTime = Date.now();
    const deadline   = submitTime + windowMs;
    let attempt = 0;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 2000));
      attempt++;
      try {
        const result = await this._request('POST', '/orders', { pageNumber: 1, pageSize: 5 });
        const items  = result.orders || result.content || [];
        process.stderr.write(`[DBG] poll#${attempt} got ${items.length} orders, submitTime=${submitTime}\n`);
        for (const i of items.slice(0, 3)) {
          process.stderr.write(`  orderId=${i.orderId} orderDate=${i.orderDate} diff=${i.orderDate - submitTime}\n`);
        }
        // 找 orderDate 在本次提交之后（>= submitTime - 10s 容差）的最新条目
        const found  = items.find(i => (i.orderDate || 0) >= submitTime - 10_000);
        if (found) return found;
      } catch (e) {
        process.stderr.write(`[DBG] poll#${attempt} error: ${e.message}\n`);
      }
    }
    return null;
  }

  /** 从原始订单条目 + settle 上下文组装 confirmOrder 的返回结构 */
  _buildConfirmResult(rawOrder, settleId, inquiryId, replyId, matched, preview) {
    const mapped = this._mapOrderItem(rawOrder);
    return {
      order: {
        id:          mapped.id || settleId,
        settleId,
        inquiryId,
        replyId,
        status:      'pending_payment',
        confirmedAt: mapped.confirmedAt || new Date().toISOString(),
        totalPrice:  rawOrder.actualCurrencyAmount ?? matched.price,
        currency:    'CNY',
      },
      inquiry: preview.inquiry,
      reply: {
        id:       matched.id,
        supplier: rawOrder.productStoreName || matched.supplier,
        price:    rawOrder.actualCurrencyAmount ?? matched.price,
        currency: 'CNY',
        partNum:  matched.partNum  || '',
        brand:    matched.brand    || '',
        location: matched.location || '',
      },
    };
  }

  // ─── 数据映射 ────────────────────────────────────────────

  _mapInquiryItem(item) {
    const brand = item.carBrandName || '';
    const model = item.carModelName || item.saleModelName || '';
    // 合并成 "大众 朗逸" 格式；若只有其中一项则只显示一项
    const vehicle = brand && model ? `${brand} ${model}` : (brand || model);
    return {
      id:        item.inquiryId || item.id || '',
      product:   item.userNeed || '询价单',
      vehicle,
      carBrand:  brand,
      carModel:  model,
      vin:       item.vin || '',
      quantity:  1,
      status:    mapStatus(item.statusId || ''),
      createdAt: item.createdStamp ? new Date(item.createdStamp).toISOString() : '',
    };
  }

  _mapInquiryDetail(id, detail) {
    // needs 是配件需求数组，取第一条作为主产品名
    const needs = detail.needs || [];
    const firstNeed = needs[0] || {};
    return {
      id,
      product:   firstNeed.needsName || detail.userNeed || '询价单',
      oeNumber:  firstNeed.oeResults?.[0]?.oeCode || '',
      vehicle:   detail.carModelName || detail.saleModelName || '',
      vin:       detail.vin || '',
      quantity:  firstNeed.quantity || 1,
      status:    mapStatus(detail.statusId || ''),
      statusDesc: detail.statusDesc || '',
      createdAt: detail.createdStamp ? new Date(detail.createdStamp).toISOString() : '',
      carBrand:  detail.carBrandName || '',
      needs:     needs.map(n => ({
        id:       n.needId || '',
        name:     n.needsName || '',
        quantity: n.quantity || 1,
        remark:   n.remark || '',
        status:   n.statusDesc || '',
      })),
    };
  }

  _mapQuotationProduct(item, storeId = '', storeName = '') {
    return {
      id:         item.quotationProductId || '',
      storeId:    storeId,
      storeName:  storeName,
      supplier:   item.displayName || item.brandName || '',
      price:      parseFloat(item.displayPrice) || 0,
      priced:     parseFloat(item.displayPrice) > 0,   // false = 供应商占坑未报实价
      currency:   'CNY',
      brand:      item.brandName || '',
      partNum:    item.partsNum || '',
      delivery:   item.arrivalTime || null,
      note:       item.remark || '',
      quality:    item.qualityDescription || '',
      facilityId:   item.location     || '',   // 仓库 ID（用于下单）
      location:     item.locationName || '',   // 仓库名称（用于展示）
    };
  }

  _mapOrderItem(item) {
    const brand = item.carBrandName || '';
    const model = item.carModelInfo || item.carModelName || item.saleModelName || '';
    const vehicle = brand && model ? `${brand} ${model}` : (brand || model);
    return {
      id:          item.orderId || '',
      inquiryId:   item.inquiryId || '',
      status:      item.statusId || '',
      statusDesc:  item.statusIdDesc || '',
      confirmedAt: item.orderDate ? new Date(item.orderDate).toISOString() : '',
      inquiry:     { product: item.orderName || item.userNeed || '?' },
      reply:       {
        supplier: item.productStoreName || '',
        price:    item.actualCurrencyAmount || 0,
        currency: 'CNY',
      },
      vehicle,
      carBrand:    brand,
    };
  }
}

// ─── 物流辅助 ──────────────────────────────────────────────

/**
 * 从结算单返回的 xiaomaLogisticsService 条目中提取最优物流配置。
 * 优先使用 defaultLogisticsDTO（平台推荐），否则从 commonlyUsedLogistics[0] 构造。
 * departureTime / lineShiftCode / lineShiftName 无值时传空字符串（接口要求 string 类型）。
 */
function _pickLogisticsEntry(svc) {
  if (!svc) return null;

  const dl = svc.defaultLogisticsDTO;
  if (dl) {
    return {
      storeId:                      dl.storeId,
      facilityId:                   dl.facilityId,
      logisticsCompanyCode:         dl.logisticsCompanyCode,
      logisticsCompanyName:         dl.logisticsCompanyName,
      transportationCode:           dl.transportationCode,
      transportationName:           dl.transportationName,
      logisticsLocationCode:        dl.logisticsLocationCode,
      logisticsLocationName:        dl.logisticsLocationName,
      landingLogisticsLocationCode: dl.landingLogisticsLocationCode,
      landingLogisticsLocationName: dl.landingLogisticsLocationName,
      deliverType:                  dl.deliverType,
      departureTime:                dl.departureTime  || '',
      lineShiftCode:                dl.lineShiftCode  || '',
      lineShiftName:                dl.lineShiftName  || '',
    };
  }

  // 没有推荐物流，从常用物流第一条取最简配置
  const common = (svc.commonlyUsedLogistics || [])[0];
  if (!common) return null;
  const way = (common.transportWayDTOS || [])[0];
  const loc = (way?.logisticsLocationDTOS || [])[0];
  return {
    storeId:                      svc.storeId,
    facilityId:                   svc.facilityId,
    logisticsCompanyCode:         common.displayLogisticsCompaniesCode,
    logisticsCompanyName:         common.displayLogisticsCompaniesName,
    transportationCode:           way?.transportationCode  || 'CAR_FREIGHT',
    transportationName:           way?.transportationName  || '汽运',
    logisticsLocationCode:        loc?.logisticsLocationCode || 'arrive_home',
    logisticsLocationName:        loc?.logisticsLocationName || '送货上门',
    landingLogisticsLocationCode: loc?.landingLogisticCompanyCode || common.displayLogisticsCompaniesCode,
    landingLogisticsLocationName: loc?.landingLogisticCompanyName || common.displayLogisticsCompaniesName,
    deliverType:                  loc?.deliverType || 'arrive_home',
    departureTime:                '',
    lineShiftCode:                '',
    lineShiftName:                '',
  };
}

// ─── 状态映射 ──────────────────────────────────────────────

function mapStatus(platformStatus) {
  const map = {
    UNQUOTE:       'pending',
    WAIT_QUOTATION: 'pending',
    QUOTING:       'pending',
    IN_THE_DECODING: 'pending',
    DECODED:       'pending',
    QUOTE:         'quoted',
    QUOTED:        'quoted',
    PART_QUOTED:   'quoted',
    ORDERED:       'ordered',
    IS_CLOSED:     'closed',
    CLOSED:        'closed',
    EXPIRED:       'closed',
    ABATE:         'closed',
    CANCELED:      'closed',
  };
  return map[platformStatus] || platformStatus || 'pending';
}
