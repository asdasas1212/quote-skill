#!/usr/bin/env node
/**
 * API 流程比对测试脚本
 * 逐一对比浏览器抓到的接口 vs CLI 当前使用的接口，打印原始响应摘要
 *
 * 用法：node scripts/compare-apis.mjs [inquiryId]
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

// ── 读取本地 token ────────────────────────────────────────────────────
const config = JSON.parse(readFileSync(join(homedir(), '.quote/config.json'), 'utf-8'));
const { accessToken, userLoginId, garageCompanyId } = config;

if (!accessToken) {
  console.error('✗ 未登录，请先执行: quote login');
  process.exit(1);
}

const BASE      = 'https://ec-hwbeta.casstime.com';
const CLI_BASE  = `${BASE}/terminal-api-v2`;

// 从命令行拿 inquiryId（可选，用于测试下单相关流程）
const inquiryId = process.argv[2] || null;

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `bearer ${accessToken}`,
  'User-Agent': 'cassapp/7.9.0.0 iOS/26.5 Apple/iPhone 13',
};

// ── 工具函数 ─────────────────────────────────────────────────────────

async function req(method, url, body) {
  const opts = { method, headers };
  if (body && method !== 'GET') opts.body = JSON.stringify(body);
  try {
    const res  = await fetch(url, opts);
    const json = await res.json();
    return { status: res.status, ok: res.ok, json };
  } catch (e) {
    return { status: -1, ok: false, json: null, error: e.message };
  }
}

function summarize(json) {
  if (!json) return '(null)';
  const ec  = json.errorCode;
  const msg = json.message;
  const d   = json.data;

  let dataDesc = '';
  if (d === null || d === undefined) {
    dataDesc = 'data=undefined';
  } else if (Array.isArray(d)) {
    dataDesc = `data=[${d.length} items]`;
  } else if (typeof d === 'object') {
    const keys = Object.keys(d).slice(0, 6);
    dataDesc = `data={${keys.join(', ')}${Object.keys(d).length > 6 ? '...' : ''}}`;
  } else {
    dataDesc = `data=${JSON.stringify(d).slice(0, 80)}`;
  }
  return `errorCode=${ec}  message=${msg || '(none)'}  ${dataDesc}`;
}

function printRow(label, url, result) {
  const ok = result.ok ? '✓' : '✗';
  console.log(`\n  ${ok} [${result.status}] ${label}`);
  console.log(`    URL : ${url}`);
  console.log(`    Resp: ${summarize(result.json)}`);
  if (result.error) console.log(`    Error: ${result.error}`);
}

// ── 1. 订单列表：浏览器 vs CLI ────────────────────────────────────────

async function testOrderList() {
  console.log('\n══════════════════════════════════════════');
  console.log('  1. 订单列表');
  console.log('══════════════════════════════════════════');

  const body20 = { pageNumber: 1, pageSize: 20 };

  // 浏览器接口 — /order-api/orders/userOrders
  const browserUrl = `${BASE}/order-api/orders/userOrders`;
  const browserRes = await req('POST', browserUrl, body20);
  printRow('浏览器  POST /order-api/orders/userOrders', browserUrl, browserRes);

  // CLI 当前接口 — /terminal-api-v2/orders
  const cliUrl = `${CLI_BASE}/orders`;
  const cliRes  = await req('POST', cliUrl, body20);
  printRow('CLI     POST /terminal-api-v2/orders', cliUrl, cliRes);

  // 补充：带 userOrders 路径的变体
  const variantUrl = `${CLI_BASE}/orders/userOrders`;
  const variantRes = await req('POST', variantUrl, body20);
  printRow('变体    POST /terminal-api-v2/orders/userOrders', variantUrl, variantRes);
}

// ── 2. 地址相关：浏览器 vs CLI ────────────────────────────────────────

async function testAddress() {
  console.log('\n══════════════════════════════════════════');
  console.log('  2. 收货地址');
  console.log('══════════════════════════════════════════');

  // CLI 当前接口：列出所有地址
  const listUrl = `${CLI_BASE}/address/proxy_order_bff/post_addresses/${userLoginId}`;
  const listRes = await req('GET', listUrl, null);
  printRow('CLI     GET /address/proxy_order_bff/post_addresses/{uid}', listUrl, listRes);

  // 如果拿到了地址 ID，测试地址确认接口
  const addrs = listRes.json?.data;
  const addrId = Array.isArray(addrs) ? addrs[0]?.id : null;

  if (addrId) {
    console.log(`\n  首条地址 ID: ${addrId}`);

    // 浏览器接口：确认邮寄地址（POST /orders/market/postal-address/whether-confirmed/v2）
    const confirmUrl = `${BASE}/orders/market/postal-address/whether-confirmed/v2`;
    const confirmBody = { postalAddressId: addrId };
    const confirmRes = await req('POST', confirmUrl, confirmBody);
    printRow('浏览器  POST /orders/market/postal-address/whether-confirmed/v2', confirmUrl, confirmRes);

    // 同路径带 terminal-api-v2 前缀变体
    const confirmVariantUrl = `${CLI_BASE}/orders/market/postal-address/whether-confirmed/v2`;
    const confirmVariantRes = await req('POST', confirmVariantUrl, confirmBody);
    printRow('变体    POST /terminal-api-v2/orders/market/postal-address/whether-confirmed/v2', confirmVariantUrl, confirmVariantRes);
  } else {
    console.log('\n  ⚠ 未取到地址 ID，跳过地址确认测试');
  }

  return addrId;
}

// ── 3. 询价详情与结算预览（需要 inquiryId）────────────────────────────

async function testSettleFlow(addrId) {
  if (!inquiryId) {
    console.log('\n══════════════════════════════════════════');
    console.log('  3. 结算流程（跳过：未传 inquiryId）');
    console.log('  用法: node scripts/compare-apis.mjs <inquiryId>');
    console.log('══════════════════════════════════════════');
    return;
  }

  console.log('\n══════════════════════════════════════════');
  console.log(`  3. 结算流程  inquiryId=${inquiryId}`);
  console.log('══════════════════════════════════════════');

  // 3a. detailV2
  const detailUrl = `${CLI_BASE}/inquiries/${inquiryId}/detailV2?platform=ANDROID`;
  const detailRes = await req('GET', detailUrl, null);
  printRow('CLI     GET /inquiries/{id}/detailV2', detailUrl, detailRes);

  // 取第一个报价 storeId
  const detail   = detailRes.json?.data;
  const storeId  = detail?.inquiryQuoteStores?.[0]?.storeId;
  if (!storeId) {
    console.log('\n  ⚠ 无 inquiryQuoteStores，跳过报价查询');
    return;
  }
  console.log(`\n  首个 storeId: ${storeId}`);

  // 3b. store/quotation
  const quotationUrl = `${CLI_BASE}/inquiries/store/quotation?inquiryId=${inquiryId}&storeId=${storeId}`;
  const quotationRes = await req('GET', quotationUrl, null);
  printRow('CLI     GET /inquiries/store/quotation', quotationUrl, quotationRes);

  const products = quotationRes.json?.data?.consultingQuotationProducts || [];
  const priced   = products.filter(p => parseFloat(p.displayPrice) > 0);
  if (priced.length === 0) {
    console.log('\n  ⚠ 无报价（或全为 0 价占坑），跳过后续结算流程');
    return;
  }

  const reply       = priced[0];
  const replyId     = reply.quotationProductId;
  const facilityId  = reply.location || '';
  console.log(`\n  首条有效报价: replyId=${replyId}  price=${reply.displayPrice}  facilityId=${facilityId}`);

  if (!addrId) {
    console.log('\n  ⚠ 无地址 ID，跳过结算');
    return;
  }

  // 3c. purchase_confirm
  const pcUrl = `${CLI_BASE}/inquiries/purchase_confirm`;
  const pcRes = await req('POST', pcUrl, { inquiryId, quotationProductIds: [replyId] });
  printRow('CLI     POST /inquiries/purchase_confirm', pcUrl, pcRes);

  // 3d. tosettle
  const tsBody = {
    application: 'ANDROID', businessGroup: 'INQUIRY', businessUnit: 'COMMON_INQUIRY',
    originSource: 'INQUIRY_CONFIRM',
    buyerUserLoginId: userLoginId,
    buyerCompanyId:   String(garageCompanyId || ''),
    terminal: 'APP', postalAddressId: addrId,
    toSettleItems: [{
      productId:     replyId,
      facilityId,
      sellerStoreId: storeId,
      inquiryId,
      quantity:      1,
      needInvoice:   'B',
      itemInvoice:   'N',
    }],
  };
  const tsUrl = `${CLI_BASE}/buy/proxy_order_bff/tosettle`;
  const tsRes = await req('POST', tsUrl, tsBody);
  printRow('CLI     POST /buy/proxy_order_bff/tosettle', tsUrl, tsRes);

  const settleId = tsRes.json?.data?.settleId;
  if (!settleId) {
    console.log('\n  ⚠ 未取到 settleId，跳过 INIT');
    return;
  }
  console.log(`\n  settleId: ${settleId}`);

  // 3e. settle INIT
  const siUrl  = `${CLI_BASE}/buy/settle`;
  const siBody = { type: 'INIT', settlePayload: { settleId, application: 'ANDROID', terminal: 'APP' } };
  const siRes  = await req('POST', siUrl, siBody);
  printRow('CLI     POST /buy/settle {type:INIT}', siUrl, siRes);

  // 浏览器地址确认 — 在 tosettle 之前 or 之后都可能调
  const addrConfirmUrl  = `${BASE}/orders/market/postal-address/whether-confirmed/v2`;
  const addrConfirmRes2 = await req('POST', addrConfirmUrl, { postalAddressId: addrId });
  printRow('浏览器  POST /orders/market/postal-address/whether-confirmed/v2', addrConfirmUrl, addrConfirmRes2);
}

// ── 4. Feature toggle（只读，了解用途）────────────────────────────────

async function testFeatureToggle() {
  console.log('\n══════════════════════════════════════════');
  console.log('  4. Feature toggle');
  console.log('══════════════════════════════════════════');

  const ftUrl = `${BASE}/featuretoggles/feature-toggles/feature/INQUIRY_ORDER_GROUP_APPROVAL`;
  const ftRes = await req('GET', ftUrl, null);
  printRow('浏览器  GET /featuretoggles/.../INQUIRY_ORDER_GROUP_APPROVAL', ftUrl, ftRes);
}

// ── 5. 审批计数 ───────────────────────────────────────────────────────

async function testApprovalCount() {
  console.log('\n══════════════════════════════════════════');
  console.log('  5. 审批计数');
  console.log('══════════════════════════════════════════');

  const url = `${BASE}/approvalform/inquiryorder/approval/count/approving`;
  const res = await req('GET', url, null);
  printRow('浏览器  GET /approvalform/.../count/approving', url, res);
}

// ── 主入口 ────────────────────────────────────────────────────────────

(async () => {
  console.log('API 流程对比测试');
  console.log(`Base       : ${BASE}`);
  console.log(`CLI Base   : ${CLI_BASE}`);
  console.log(`userLoginId: ${userLoginId}`);
  console.log(`inquiryId  : ${inquiryId || '(未传，结算流程将跳过)'}`);

  await testOrderList();
  const addrId = await testAddress();
  await testSettleFlow(addrId);
  await testFeatureToggle();
  await testApprovalCount();

  console.log('\n══════════════════════════════════════════');
  console.log('  测试完成');
  console.log('══════════════════════════════════════════\n');
})();
