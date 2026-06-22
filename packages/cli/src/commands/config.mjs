import { Store } from '../store.mjs';

// token 类字段脱敏显示
const SENSITIVE_KEYS = new Set(['accessToken', 'refreshToken', 'tokenType', 'tokenExpiresAt']);

export function registerConfigCommands(program) {
  const config = program.command('config').description('配置管理');

  config
    .command('set')
    .description('设置配置项')
    .option('-r, --role <role>', '角色 (buyer|supplier)')
    .option('-n, --name <name>', '姓名/联系人')
    .option('-c, --company <company>', '公司名称')
    .option('--phone <phone>', '联系电话')
    .option('--api-base <url>', 'API 基础地址')
    .action((opts) => {
      const store = new Store();
      const updates = {};
      if (opts.role)    updates.role    = opts.role;
      if (opts.name)    updates.name    = opts.name;
      if (opts.company) updates.company = opts.company;
      if (opts.phone)   updates.phone   = opts.phone;
      if (opts.apiBase) updates.apiBase = opts.apiBase;

      if (Object.keys(updates).length === 0) {
        console.error('请至少指定一个配置项');
        process.exit(1);
      }

      store.setConfig(updates);
      console.log('✓ 配置已更新');
    });

  config
    .command('show')
    .description('查看当前配置')
    .action(() => {
      const store = new Store();
      const cfg = store.getConfig();
      if (Object.keys(cfg).length === 0) {
        console.log('暂无配置，执行 quote login 登录后自动初始化');
        return;
      }
      // token 类字段只显示是否已设置，避免泄露
      const display = Object.fromEntries(
        Object.entries(cfg).map(([k, v]) => [
          k,
          SENSITIVE_KEYS.has(k) ? (v ? '[已设置]' : '[未设置]') : v,
        ])
      );
      console.log(JSON.stringify(display, null, 2));
    });
}
