import { getAdapter } from '../adapter/index.mjs';

export function registerConfigCommands(program) {
  const config = program.command('config').description('配置管理');

  config
    .command('set')
    .description('设置配置项')
    .option('-r, --role <role>', '角色 (buyer|supplier)')
    .option('-n, --name <name>', '姓名/联系人')
    .option('-c, --company <company>', '公司名称')
    .option('--phone <phone>', '联系电话')
    .option('-m, --mode <mode>', '数据模式 (local|api)')
    .option('--api-base <url>', 'API 基础地址 (api 模式)')
    .option('--api-token <token>', 'API Token (api 模式)')
    .action(async (opts) => {
      const adapter = getAdapter();
      const updates = {};
      if (opts.role) updates.role = opts.role;
      if (opts.name) updates.name = opts.name;
      if (opts.company) updates.company = opts.company;
      if (opts.phone) updates.phone = opts.phone;
      if (opts.mode) updates.mode = opts.mode;
      if (opts.apiBase) updates.apiBase = opts.apiBase;
      if (opts.apiToken) updates.apiToken = opts.apiToken;

      if (Object.keys(updates).length === 0) {
        console.error('请至少指定一个配置项');
        process.exit(1);
      }

      const result = await adapter.setConfig(updates);
      console.log('✓ 配置已更新:');
      console.log(JSON.stringify(result, null, 2));
    });

  config
    .command('show')
    .description('查看当前配置')
    .action(async () => {
      const adapter = getAdapter();
      const cfg = await adapter.getConfig();
      if (Object.keys(cfg).length === 0) {
        console.log('暂无配置，使用 quote config set 进行设置');
        return;
      }
      console.log(JSON.stringify(cfg, null, 2));
    });
}
