import { getAdapter } from '../adapter/index.mjs';

// API 支持的品质 qualityId 合法值（来自 GET /inquiries/{id}/detailV2 的 qualities 列表）
const VALID_QUALITY_IDS = new Set([
  'ORIGINAL_BRAND', 'ORIGINAL_CURRENCY', 'ORIGINAL_INLAND_4S', 'ORIGINAL_OTHERS',
  'EXTERNAL_BRAND', 'INTERNAL_BRAND',
  'SECOND_HAND', 'EQUIVALENT_BRAND', 'OTHER_BRAND',
]);

export function registerCompareCommand(program) {
  program
    .command('compare')
    .description('比价分析（对某询价单的所有报价进行对比）')
    .requiredOption('-i, --inquiry <id>', '询价单 ID')
    .option('-s, --sort <field>', '排序字段 (price|delivery|brand|quality)', 'price')
    .option(
      '-q, --quality <ids...>',
      [
        '按品质过滤，传 qualityId，可多个。可选值：',
        '  ORIGINAL_BRAND      原厂',
        '  ORIGINAL_CURRENCY   原厂(非国内4S)',
        '  ORIGINAL_INLAND_4S  原厂(国内4S)',
        '  ORIGINAL_OTHERS     原厂再制造',
        '  EXTERNAL_BRAND      国际品牌',
        '  INTERNAL_BRAND      其他品牌',
        '  SECOND_HAND         拆车件',
        '  EQUIVALENT_BRAND    同质件',
        '  OTHER_BRAND         其他',
      ].join('\n')
    )
    .action(async (opts) => {
      // 校验品质参数
      const invalid = (opts.quality || []).filter(q => !VALID_QUALITY_IDS.has(q));
      if (invalid.length > 0) {
        console.error(`✗ 无效的品质 ID: ${invalid.join(', ')}`);
        console.error(`  可选值: ${[...VALID_QUALITY_IDS].join(' | ')}`);
        process.exit(1);
      }

      const adapter = getAdapter();
      const result = await adapter.compareReplies(opts.inquiry, opts.sort, opts.quality || null);

      if (!result) {
        console.error(`未找到询价单: ${opts.inquiry}`);
        process.exit(1);
      }

      const { inquiry, sorted, lowest, fastest } = result;

      if (sorted.length === 0) {
        const filterTip = opts.quality
          ? `（品质过滤: ${opts.quality.join(' ')}，可尝试去掉 --quality 查看全部报价）`
          : '';
        console.log(`该询价单暂无报价，无法比较${filterTip}`);
        return;
      }

      const filterDesc = opts.quality ? `  品质: ${opts.quality.join(' ')}` : '';
      console.log(`\n询价: ${inquiry.product} (${inquiry.id})`);
      console.log(`车型: ${inquiry.vehicle || '-'} | OE: ${inquiry.oeNumber || '-'} | 数量: ${inquiry.quantity}`);
      console.log(`排序: ${opts.sort}${filterDesc}\n`);
      console.log('─'.repeat(100));
      console.log(`${'排名'.padEnd(4)} | ${'供应商'.padEnd(12)} | ${'价格'.padEnd(10)} | ${'品牌'.padEnd(10)} | ${'品质'.padEnd(16)} | ${'货期'.padEnd(6)} | 备注`);
      console.log('─'.repeat(100));

      sorted.forEach((r, i) => {
        const rank     = `#${i + 1}`.padEnd(4);
        const supplier = (r.supplier || '-').padEnd(12).slice(0, 12);
        const price    = `${r.currency} ${r.price}`.padEnd(10);
        const brand    = (r.brand || '-').padEnd(10).slice(0, 10);
        // 优先展示中文描述，没有则退回 qualityId
        const quality  = (r.quality || r.qualityId || '-').padEnd(16).slice(0, 16);
        const delivery = r.delivery ? `${r.delivery}天`.padEnd(6) : '未知'.padEnd(6);
        console.log(`${rank} | ${supplier} | ${price} | ${brand} | ${quality} | ${delivery} | ${r.note || ''}`);
      });

      console.log('─'.repeat(100));

      if (lowest) console.log(`\n💰 最低价: ${lowest.supplier} — ${lowest.currency} ${lowest.price}${lowest.quality ? `（${lowest.quality}）` : ''}`);
      if (fastest && fastest.delivery) console.log(`🚚 最快货期: ${fastest.supplier} — ${fastest.delivery}天${fastest.quality ? `（${fastest.quality}）` : ''}`);
    });
}
