import { getAdapter } from '../adapter/index.mjs';

export function registerInquiryCommands(program) {
  const inquiry = program.command('inquiry').description('询价单管理');

  inquiry
    .command('create')
    .description('创建询价单')
    .requiredOption('-p, --product <name>', '零件/产品名称')
    .option('-o, --oe <number>', 'OE 编号')
    .option('-v, --vehicle <model>', '车型/适用型号')
    .option('-q, --quantity <n>', '数量', '1')
    .option('-n, --note <text>', '备注')
    .action(async (opts) => {
      const adapter = getAdapter();
      const record = await adapter.createInquiry({
        product: opts.product,
        oeNumber: opts.oe || '',
        vehicle: opts.vehicle || '',
        quantity: opts.quantity,
        note: opts.note || '',
      });
      console.log(`✓ 询价单已创建: ${record.id}`);
      console.log(JSON.stringify(record, null, 2));
    });

  inquiry
    .command('list')
    .description('查看询价单列表')
    .option('-s, --status <status>', '按状态筛选 (pending|quoted|ordered|closed)')
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
        console.log(`  ${item.id} | ${item.product} | 数量:${item.quantity} | 状态:${item.status} | 报价:${replies.length}条`);
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
