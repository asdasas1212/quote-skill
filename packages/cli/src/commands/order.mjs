import { getAdapter } from '../adapter/index.mjs';

export function registerOrderCommands(program) {
  const order = program.command('order').description('订单管理');

  order
    .command('confirm')
    .description('确认下单（选择某个报价下单）')
    .requiredOption('-i, --inquiry <id>', '询价单 ID')
    .requiredOption('-r, --reply <id>', '报价 ID')
    .action(async (opts) => {
      const adapter = getAdapter();
      const result = await adapter.confirmOrder(opts.inquiry, opts.reply);

      if (!result) {
        console.error(`下单失败：请检查询价单 ${opts.inquiry} 和报价 ${opts.reply} 是否存在且匹配`);
        process.exit(1);
      }

      const { order: record, inquiry, reply } = result;
      console.log(`✓ 订单已确认: ${record.id}`);
      console.log(`  询价: ${inquiry.product} (${inquiry.id})`);
      console.log(`  供应商: ${reply.supplier} | 价格: ${reply.currency} ${reply.price}`);
      console.log(JSON.stringify(record, null, 2));
    });

  order
    .command('list')
    .description('查看所有订单')
    .action(async () => {
      const adapter = getAdapter();
      const items = await adapter.listOrders();
      if (items.length === 0) {
        console.log('暂无订单');
        return;
      }
      console.log(`共 ${items.length} 条订单:\n`);
      for (const item of items) {
        const product = item.inquiry ? item.inquiry.product : '?';
        const supplier = item.reply ? item.reply.supplier : '?';
        const price = item.reply ? `${item.reply.currency} ${item.reply.price}` : '?';
        console.log(`  ${item.id} | ${product} | ${supplier} | ${price} | ${item.confirmedAt}`);
      }
    });
}
