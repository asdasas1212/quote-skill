import { getAdapter } from '../adapter/index.mjs';

export function registerCompareCommand(program) {
  program
    .command('compare')
    .description('比价分析（对某询价单的所有报价进行对比）')
    .requiredOption('-i, --inquiry <id>', '询价单 ID')
    .option('-s, --sort <field>', '排序字段 (price|delivery|brand)', 'price')
    .action(async (opts) => {
      const adapter = getAdapter();
      const result = await adapter.compareReplies(opts.inquiry, opts.sort);

      if (!result) {
        console.error(`未找到询价单: ${opts.inquiry}`);
        process.exit(1);
      }

      const { inquiry, sorted, lowest, fastest } = result;

      if (sorted.length === 0) {
        console.log('该询价单暂无报价，无法比较');
        return;
      }

      console.log(`\n询价: ${inquiry.product} (${inquiry.id})`);
      console.log(`车型: ${inquiry.vehicle || '-'} | OE: ${inquiry.oeNumber || '-'} | 数量: ${inquiry.quantity}`);
      console.log(`排序: ${opts.sort}\n`);
      console.log('─'.repeat(80));
      console.log(`${'排名'.padEnd(4)} | ${'供应商'.padEnd(12)} | ${'价格'.padEnd(10)} | ${'品牌'.padEnd(10)} | ${'货期'.padEnd(6)} | 备注`);
      console.log('─'.repeat(80));

      sorted.forEach((r, i) => {
        const rank = `#${i + 1}`.padEnd(4);
        const supplier = (r.supplier || '-').padEnd(12).slice(0, 12);
        const price = `${r.currency} ${r.price}`.padEnd(10);
        const brand = (r.brand || '-').padEnd(10).slice(0, 10);
        const delivery = r.delivery ? `${r.delivery}天`.padEnd(6) : '未知'.padEnd(6);
        console.log(`${rank} | ${supplier} | ${price} | ${brand} | ${delivery} | ${r.note || ''}`);
      });

      console.log('─'.repeat(80));

      if (lowest) console.log(`\n💰 最低价: ${lowest.supplier} — ${lowest.currency} ${lowest.price}`);
      if (fastest && fastest.delivery) console.log(`🚚 最快货期: ${fastest.supplier} — ${fastest.delivery}天`);
    });
}
