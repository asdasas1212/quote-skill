import { getAdapter } from '../adapter/index.mjs';

export function registerInquiryCommands(program) {
  const inquiry = program.command('inquiry').description('询价单管理');

  inquiry
    .command('create')
    .description('创建询价单')
    .requiredOption('-p, --product <names...>', '配件名称，支持多个（如 -p 刹车片 机油 雨刷）')
    .option('-o, --oe <number>', 'OE 编号（单配件时使用）')
    .option('-b, --brand <code>', '品牌代码（如 VW、TOYOTA），不传则列出可选品牌')
    .option('--brand-name <name>', '品牌名称（配合 --brand 使用）')
    .option('--vin <vin>', 'VIN 码（自动解析品牌车型）')
    .option('-m, --model <model>', '车型（如 朗逸）')
    .option('-q, --quantity <n>', '数量（单配件时使用）', '1')
    .option('-n, --note <text>', '备注')
    .action(async (opts) => {
      const adapter = getAdapter();

      let carBrandId   = opts.brand    || '';
      let carBrandName = opts.brandName || '';
      let carModelName = opts.model    || '';

      // 有 VIN 时先尝试自动解析品牌车型
      if (opts.vin && !carBrandId) {
        process.stdout.write(`正在解析 VIN: ${opts.vin} ...`);
        const model = await adapter.getCarModelByVin(opts.vin);
        if (model) {
          carBrandId   = model.carBrandId   || '';
          carBrandName = model.carBrandName || '';
          carModelName = model.carModelName || carModelName;
          console.log(` ${carBrandName} ${carModelName}`);
        } else {
          console.log(' 无法识别，请手动选择品牌');
        }
      }

      // 没有品牌时列出可选品牌让用户选
      if (!carBrandId) {
        const brands = await adapter.listSupportBrands();
        if (brands.length === 0) {
          console.error('✗ 无法获取品牌列表，请使用 --brand 手动指定（如 --brand VW --brand-name 大众）');
          process.exit(1);
        }
        console.log('\n支持的品牌:');
        brands.forEach((b, i) => {
          process.stdout.write(`  ${String(i + 1).padStart(2)}. ${b.carBrandCode.padEnd(12)} ${b.carBrandName}\n`);
        });

        const { createInterface } = await import('readline');
        const rl  = createInterface({ input: process.stdin, output: process.stdout });
        const ask = (q) => new Promise((r) => rl.question(q, r));
        const idx = parseInt(await ask(`选择品牌 (1-${brands.length}): `), 10) - 1;
        rl.close();

        const selected = brands[idx];
        if (!selected) { console.error('✗ 无效选择'); process.exit(1); }
        carBrandId   = selected.carBrandCode;
        carBrandName = selected.carBrandName;
      }

      // 多配件：每个 product 对应一个 need
      const products = Array.isArray(opts.product) ? opts.product : [opts.product];

      const record = await adapter.createInquiry({
        products,                               // 多配件数组
        product:  products[0],                  // 兼容单配件展示
        oeNumber: products.length === 1 ? (opts.oe || '') : '',
        vehicle:  carModelName,
        carBrandId,
        carBrandName,
        vin:      opts.vin    || '',
        quantity: products.length === 1 ? opts.quantity : '1',
        note:     opts.note   || '',
      });

      console.log(`✓ 询价单已创建: ${record.id}`);
      console.log(`  车型: ${record.vehicle || '-'}  配件: ${products.join('、')}  数量: ${products.length > 1 ? '各1' : record.quantity}`);
    });

  inquiry
    .command('list')
    .description('查看询价单列表')
    .option('-s, --status <status>', '按状态筛选 (pending|quoted|ordered|closed)')
    .option('-v, --verbose', '显示更多字段（创建时间）')
    .action(async (opts) => {
      const adapter = getAdapter();
      const items = await adapter.listInquiries({ status: opts.status });
      if (items.length === 0) {
        console.log('暂无询价单');
        return;
      }
      console.log(`共 ${items.length} 条询价单:\n`);
      for (const item of items) {
        const replies = await adapter.listReplies(item.id);
        const vehicleStr = item.vehicle ? ` | 车型:${item.vehicle}` : '';
        const verboseStr = opts.verbose
          ? [
              item.createdAt ? `创建:${item.createdAt.slice(0, 10)}` : '',
              item.vin       ? `VIN:${item.vin}`                     : '',
            ].filter(Boolean).map(s => ` | ${s}`).join('')
          : '';
        console.log(`  ${item.id} | ${item.product}${vehicleStr} | 数量:${item.quantity} | 状态:${item.status} | 报价:${replies.length}条${verboseStr}`);
      }
    });

  inquiry
    .command('detail')
    .description('查看询价单详情')
    .argument('<id>', '询价单 ID')
    .action(async (id) => {
      const adapter = getAdapter();
      const record = await adapter.getInquiry(id);
      if (!record) {
        console.error(`未找到询价单: ${id}`);
        process.exit(1);
      }
      console.log(JSON.stringify(record, null, 2));

      const replies = await adapter.listReplies(id);
      if (replies.length > 0) {
        console.log(`\n关联报价 (${replies.length} 条):`);
        for (const r of replies) {
          console.log(`  ${r.id} | ${r.supplier} | ¥${r.price} | ${r.brand} | ${r.delivery || '?'}天`);
        }
      }
    });

  inquiry
    .command('watch')
    .description('监听询价单报价状态（有新报价时提醒）')
    .argument('<id>', '询价单 ID')
    .option('-i, --interval <seconds>', '轮询间隔（秒）', '30')
    .option('--timeout <seconds>', '最长等待时间（秒），超时后退出，0=不限制', '0')
    .option('--exit-on-quotes <n>', '收到 n 条报价后自动退出', '0')
    .option('--json', '以 JSON 格式输出结果（适合脚本/AI 调用）')
    .action(async (id, opts) => {
      const adapter      = getAdapter();
      const interval     = Math.max(10, parseInt(opts.interval, 10)) * 1000;
      const timeout      = parseInt(opts.timeout, 10) * 1000;
      const exitOnQuotes = parseInt(opts.exitOnQuotes, 10);
      const startTime    = Date.now();

      if (!opts.json) {
        console.log(`监听询价单 ${id}，每 ${interval / 1000} 秒检查一次，Ctrl+C 退出\n`);
      }

      // 阶段一：记录上一次的状态和报价数，用于判断是否需要进入阶段二
      // isFirstCheck=true 时只建立基准，不输出报价
      let lastRawStatusId = '';
      let lastQuoteCount  = -1;  // -1 表示尚未初始化
      let pollCount       = 0;   // 累计轮询次数，用于兜底定期拉报价

      /**
       * 阶段二：调 detailV2 拉完整报价，输出给用户
       * 返回本次报价数量
       *
       * 状态接口和报价数据存在短暂不一致，最多重试 5 次（间隔 3s）
       */
      const fetchAndReport = async (silent = false) => {
        const record = await adapter.getInquiry(id);
        let replies = [];
        for (let attempt = 0; attempt < 5; attempt++) {
          replies = await adapter.listReplies(id);
          if (replies.length > 0) break;   // silent 只控制输出，不跳过重试
          if (attempt < 4) await new Promise(r => setTimeout(r, 3000));
        }
        const count   = replies.length;
        const time    = new Date().toLocaleTimeString();

        if (!silent) {
          if (opts.json) {
            console.log(JSON.stringify({ inquiryId: id, status: record.status, quotes: replies }));
          } else {
            console.log(`\n[${time}] 🔔 新报价！共 ${count} 条`);
            replies.slice(Math.max(0, lastQuoteCount)).forEach(r => {
              console.log(`  ${r.supplier} | ¥${r.price} | ${r.brand || '-'} | ${r.delivery ? r.delivery + '天' : '货期未知'}`);
            });
          }
        }
        return count;
      };

      /**
       * 检查是否达到退出条件（exitOnQuotes 或 json 模式首次即退）
       * 满足条件则输出结果并退出
       */
      const checkExitCondition = async (count, fromFirstCheck = false) => {
        const shouldExit = (exitOnQuotes > 0 && count >= exitOnQuotes)
          || (opts.json && count > 0 && fromFirstCheck);
        if (!shouldExit) return false;
        await fetchAndReport(false);
        if (!opts.json) console.log(`\n已收到 ${count} 条报价，退出监听`);
        process.exit(0);
      };

      /**
       * 阶段一：轻量轮询，只查状态
       */
      const check = async () => {
        try {
          // 超时退出
          if (timeout > 0 && Date.now() - startTime >= timeout) {
            if (!opts.json) console.log(`\n等待超时，共 ${Math.max(0, lastQuoteCount)} 条报价`);
            else console.log(JSON.stringify({ inquiryId: id, timedOut: true, quoteCount: Math.max(0, lastQuoteCount) }));
            process.exit(0);
          }

          const poll = await adapter.pollInquiryStatus(id);
          if (!poll) return;

          const time         = new Date().toLocaleTimeString();
          const isFirstCheck = lastQuoteCount === -1;
          const statusChanged = poll.rawStatusId !== lastRawStatusId;

          if (isFirstCheck) {
            // 首次：静默拉一次，建立基准值（会重试直到有数据或 5 次用完）
            const count = await fetchAndReport(true);
            lastQuoteCount  = count;
            lastRawStatusId = poll.rawStatusId;
            pollCount = 1;
            // JSON 模式或 exit-on-quotes 已满足：首次有报价直接退出
            await checkExitCondition(count, true);
            if (!opts.json) {
              if (count > 0) {
                console.log(`[${time}] 初始状态: ${poll.rawStatusId}，已有 ${count} 条报价，继续监听新报价...`);
              } else {
                console.log(`[${time}] 初始状态: ${poll.rawStatusId}，等待报价中...`);
              }
            }
          } else if (poll.status !== 'pending' || pollCount % 3 === 0) {
            // 状态离开 pending，或每 3 轮强制拉一次（兜底：防止状态接口与报价接口不同步）
            pollCount++;
            const count = await fetchAndReport(false);
            if (count > lastQuoteCount && count > 0) {
              lastQuoteCount = count;
              if (!opts.json) console.log(`\n已收到 ${count} 条报价，退出监听`);
              process.exit(0);
            }
            // 报价数未增加，更新状态记录继续轮询
            if (statusChanged) lastRawStatusId = poll.rawStatusId;
          } else {
            pollCount++;
            if (statusChanged) {
              if (!opts.json) console.log(`\n[${time}] 状态变更: ${lastRawStatusId || '-'} → ${poll.rawStatusId}`);
              lastRawStatusId = poll.rawStatusId;
            } else {
              if (!opts.json) process.stdout.write(`\r[${time}] 等待报价... 状态: ${poll.rawStatusId}  已有: ${lastQuoteCount} 条`);
            }
          }
        } catch (e) {
          if (!opts.json) console.error(`\n[错误] ${e.message}`);
        }
      };

      await check();
      setInterval(check, interval);
    });

  inquiry
    .command('close')
    .description('关闭询价单')
    .argument('<id>', '询价单 ID')
    .action(async (id) => {
      const adapter = getAdapter();
      const record = await adapter.closeInquiry(id);
      if (!record) {
        console.error(`未找到询价单: ${id}`);
        process.exit(1);
      }
      console.log(`✓ 询价单已关闭: ${id}`);
    });
}
