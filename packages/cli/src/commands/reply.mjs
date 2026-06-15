import { getAdapter } from '../adapter/index.mjs';

export function registerReplyCommands(program) {
  const reply = program.command('reply').description('报价管理');

  reply
    .command('create')
    .description('创建报价（对某询价单报价）')
    .requiredOption('-i, --inquiry <id>', '询价单 ID')
    .requiredOption('--price <amount>', '报价金额')
    .option('-s, --supplier <name>', '供应商名称')
    .option('-b, --brand <brand>', '品牌')
    .option('-d, --delivery <days>', '货期（天）')
    .option('-c, --currency <code>', '货币', 'CNY')
    .option('-n, --note <text>', '备注')
    .action(async (opts) => {
      const adapter = getAdapter();
      const record = await adapter.createReply({
        inquiryId: opts.inquiry,
        supplier: opts.supplier,
        price: opts.price,
        currency: opts.currency,
        brand: opts.brand,
        delivery: opts.delivery,
        note: opts.note,
      });
      if (!record) {
        console.error(`未找到询价单: ${opts.inquiry}`);
        process.exit(1);
      }
      console.log(`✓ 报价已创建: ${record.id}`);
      console.log(JSON.stringify(record, null, 2));
    });

  reply
    .command('list')
    .description('查看某询价单的所有报价')
    .requiredOption('-i, --inquiry <id>', '询价单 ID')
    .action(async (opts) => {
      const adapter = getAdapter();
      const items = await adapter.listReplies(opts.inquiry);
      if (items.length === 0) {
        console.log(`询价单 ${opts.inquiry} 暂无报价`);
        return;
      }
      console.log(`询价单 ${opts.inquiry} 共 ${items.length} 条报价:\n`);
      for (const item of items) {
        console.log(`  ${item.id} | ${item.supplier} | ${item.currency} ${item.price} | ${item.brand || '-'} | ${item.delivery || '?'}天 | ${item.note || ''}`);
      }
    });
}
