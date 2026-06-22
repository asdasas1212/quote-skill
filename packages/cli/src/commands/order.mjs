import { createInterface } from 'readline';
import { getAdapter } from '../adapter/index.mjs';
import { Store } from '../store.mjs';

// ── 交互工具 ────────────────────────────────────────────────

function makeRl() {
  return createInterface({ input: process.stdin, output: process.stdout });
}

/** 展示列表并让用户输入序号，返回选中项（序号从 1 开始）*/
async function selectFromList(items, renderFn, prompt) {
  items.forEach((item, i) => {
    process.stdout.write(`  ${String(i + 1).padStart(2)}. ${renderFn(item, i)}\n`);
  });
  const rl  = makeRl();
  const ask = (q) => new Promise((r) => rl.question(q, r));
  const idx = parseInt(await ask(prompt), 10) - 1;
  rl.close();
  const selected = items[idx];
  if (!selected) { console.error('✗ 无效选择'); process.exit(1); }
  return selected;
}

// ── 命令注册 ─────────────────────────────────────────────────

export function registerOrderCommands(program) {
  const order = program.command('order').description('订单管理');

  // ── order confirm ────────────────────────────────────────
  order
    .command('confirm')
    .description('确认下单（选择某个报价下单）')
    .requiredOption('-i, --inquiry <id>', '询价单 ID')
    .option('-r, --reply <id>', '报价 ID（quotationProductId）；不传则从报价列表中交互式选择')
    .option('-a, --address-id <id>', '收货地址 ID（不传则交互式选择）')
    .option('-l, --logistics <code>', '物流公司 code（不传则交互式选择；传 default 自动用推荐物流）')
    .action(async (opts) => {
      const adapter = getAdapter();

      // ── 0. 确定报价 ────────────────────────────────────
      let replyId = opts.reply || '';
      if (!replyId) {
        console.log('\n正在获取报价列表...');
        const replies = await adapter.listReplies(opts.inquiry);
        if (replies.length === 0) {
          console.error('✗ 该询价单暂无报价，请等待供应商报价后再下单');
          process.exit(1);
        }
        if (replies.length === 1) {
          replyId = replies[0].id;
          console.log(`  已选报价: ${replies[0].supplier}  CNY ${replies[0].price}  ${replies[0].partNum || ''}`);
        } else {
          console.log('\n可用报价:');
          const chosen = await selectFromList(
            replies,
            (r) => {
              const supplier = r.supplier.padEnd(14);
              const price    = `CNY ${String(r.price).padEnd(8)}`;
              const part     = r.partNum ? r.partNum.padEnd(16) : ''.padEnd(16);
              const brand    = r.brand   ? `${r.brand}  `       : '';
              const loc      = r.location || r.facilityId || '';
              return `${supplier} ${price} ${part} ${brand}${loc}`;
            },
            `选择报价 (1-${replies.length}): `
          );
          replyId = chosen.id;
        }
      }

      // ── 1. 确定收货地址 ────────────────────────────────
      let addressId = opts.addressId || '';
      if (!addressId) {
        const addresses = await adapter.listAddresses();
        if (addresses.length === 0) {
          console.error('✗ 未找到收货地址，请先在 casstime App / 网页端添加，或用 --address-id 指定');
          process.exit(1);
        }
        if (addresses.length === 1) {
          addressId = addresses[0].id;
          console.log(`  收货地址: ${addresses[0].receiverName}  ${addresses[0].address}`);
        } else {
          console.log('\n收货地址:');
          const chosen = await selectFromList(
            addresses,
            (a) => `${a.receiverName.padEnd(10)} ${a.contactNumber.padEnd(13)} ${a.address}`,
            `选择地址 (1-${addresses.length}): `
          );
          addressId = chosen.id;
        }
      }

      // ── 2. 生成结算预览（purchase_confirm + tosettle + INIT）──
      console.log('\n正在生成结算单，请稍候...');
      let preview;
      try {
        preview = await adapter.previewSettle(opts.inquiry, replyId, addressId);
      } catch (err) {
        console.error(`✗ 生成结算单失败：${err.message}`);
        process.exit(1);
      }

      const { logisticsOptions, totalPrice } = preview;

      // ── 3. 确定物流 ─────────────────────────────────────
      let logisticsCode = opts.logistics || '';

      if (!logisticsCode && logisticsOptions.length === 0) {
        // 没有物流选项，直接静默使用空（服务端兜底）
        logisticsCode = '';
      } else if (!logisticsCode) {
        // 交互式选择
        console.log('\n可用物流:');
        const defaultIdx = logisticsOptions.findIndex(o => o.isDefault);
        const chosen = await selectFromList(
          logisticsOptions,
          (o, i) => {
            const tag = o.isDefault ? '★推荐 ' : '      ';
            const shift = o.shift ? `  ${o.shift}` : '';
            return `${tag}${o.name.padEnd(12)} ${o.deliver}${shift}`;
          },
          `选择物流 (1-${logisticsOptions.length})${defaultIdx >= 0 ? `，直接回车使用推荐 [${defaultIdx + 1}]` : ''}: `
        );
        logisticsCode = chosen.code;
      }

      // ── 4. 提交下单 ────────────────────────────────────
      console.log('\n正在提交订单...');
      let result;
      try {
        result = await adapter.confirmOrder(opts.inquiry, replyId, {
          addressId,
          logisticsCode: logisticsCode === 'default' ? '' : logisticsCode,
          _preview: preview,   // 把已经计算好的预览直接传进去，避免重复请求
        });
      } catch (err) {
        console.error(`✗ 下单失败：${err.message}`);
        process.exit(1);
      }

      const { order: record, reply } = result;
      console.log(`\n✓ 下单成功`);
      console.log(`  订单号:   ${record.id}`);
      console.log(`  供应商:   ${reply.supplier}${reply.brand ? ' / ' + reply.brand : ''}`);
      console.log(`  单价:     CNY ${reply.price}${reply.partNum ? '  零件号: ' + reply.partNum : ''}`);
      console.log(`  应付合计: CNY ${record.totalPrice}`);
      console.log(`  状态:     待付款（请前往 casstime App 或网页端完成支付）`);
    });

  // ── order addresses ──────────────────────────────────────
  order
    .command('addresses')
    .description('查看当前账号的收货地址列表')
    .action(async () => {
      const adapter = getAdapter();
      const items = await adapter.listAddresses();
      if (items.length === 0) {
        console.log('暂无收货地址，请先在 casstime App 或网页端添加');
        return;
      }
      console.log(`共 ${items.length} 条收货地址:\n`);
      for (const addr of items) {
        console.log(`  ${addr.id}`);
        console.log(`    ${addr.receiverName}  ${addr.contactNumber}`);
        console.log(`    ${addr.address}\n`);
      }
    });

  // ── order logistics ──────────────────────────────────────
  order
    .command('logistics')
    .description('查询某报价的可用物流选项（用于 --logistics 参数参考）')
    .requiredOption('-i, --inquiry <id>', '询价单 ID')
    .option('-r, --reply <id>', '报价 ID（quotationProductId）；不传则从报价列表中选第一条有效报价')
    .option('-a, --address-id <id>', '收货地址 ID（不传则使用第一条地址）')
    .action(async (opts) => {
      const adapter = getAdapter();

      // 未传 -r，自动取第一条有效报价
      let replyId = opts.reply || '';
      if (!replyId) {
        const replies = await adapter.listReplies(opts.inquiry);
        const first   = replies[0];
        if (!first) {
          console.error('✗ 该询价单暂无报价');
          process.exit(1);
        }
        replyId = first.id;
        console.log(`  使用报价: ${first.supplier}  CNY ${first.price}  ${first.partNum || ''}`);
      }

      let addressId = opts.addressId || '';
      if (!addressId) {
        const addresses = await adapter.listAddresses();
        if (!addresses.length) {
          console.error('✗ 未找到收货地址');
          process.exit(1);
        }
        addressId = addresses[0].id;
      }

      console.log('正在生成结算单以获取物流选项...');
      let preview;
      try {
        preview = await adapter.previewSettle(opts.inquiry, replyId, addressId);
      } catch (err) {
        console.error(`✗ ${err.message}`);
        process.exit(1);
      }

      const { logisticsOptions, totalPrice } = preview;
      console.log(`\n应付合计: CNY ${totalPrice}\n`);

      if (logisticsOptions.length === 0) {
        console.log('该报价暂无可选物流（将由平台自动分配）');
        return;
      }

      console.log(`共 ${logisticsOptions.length} 个物流选项:\n`);
      for (const o of logisticsOptions) {
        const tag  = o.isDefault ? ' ★推荐' : '';
        const shift = o.shift ? `  ${o.shift}` : '';
        console.log(`  ${o.code.padEnd(16)} ${o.name.padEnd(12)} ${o.deliver}${shift}${tag}`);
      }
      console.log(`\n使用方法: quote order confirm -i ${opts.inquiry} -r ${replyId} -a ${addressId} -l <code>`);
    });

  // ── order list ───────────────────────────────────────────
  order
    .command('list')
    .description('查看订单列表')
    .option('--mine', '只显示当前登录账号的订单')
    .action(async (opts) => {
      const adapter = getAdapter();
      const filters = {};
      if (opts.mine) {
        const config = new Store().getConfig();
        if (config.userLoginId) filters.createdBy = config.userLoginId;
      }
      const items = await adapter.listOrders(filters);
      if (items.length === 0) {
        console.log('暂无订单');
        return;
      }
      console.log(`共 ${items.length} 条订单:\n`);
      for (const item of items) {
        const product  = item.inquiry?.product  ?? '?';
        const supplier = item.reply?.supplier   ?? '?';
        const price    = item.reply ? `CNY ${item.reply.price}` : '?';
        console.log(`  ${item.id}  ${product}  ${supplier}  ${price}  ${item.statusDesc || item.status}  ${item.confirmedAt}`);
      }
    });
}
