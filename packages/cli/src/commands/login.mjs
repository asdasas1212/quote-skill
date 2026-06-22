/**
 * 登录/登出命令
 */
import { loginWithPassword, loginWithCellphone, sendLoginCode, sendRegisterCode, registerUser, saveCompanyInfo, fetchAreas, checkAccountExists, isLoggedIn, logout } from '../auth.mjs';
import { Store } from '../store.mjs';
import { createInterface } from 'readline';
import { API_BASE_DEFAULT } from '../constants.mjs';

export function registerLoginCommands(program) {
  program
    .command('login')
    .description('登录平台（获取 API 访问令牌）')
    .option('-u, --username <name>', '用户名/手机号')
    .option('-p, --password <pwd>', '密码')
    .option('--sms', '使用短信验证码登录')
    .option('-c, --code <code>', '验证码（配合 --sms 非交互登录：先 --send-code 发码，再带 --code 传入）')
    .option('--send-code', '仅发送登录验证码，不等待输入（配合 --sms -u 使用）')
    .option('--api-base <url>', 'API 地址', API_BASE_DEFAULT)
    .action(async (opts) => {
      const store = new Store();
      const config = store.getConfig();

      const apiBase = opts.apiBase || config.apiBase || API_BASE_DEFAULT;
      store.setConfig({ apiBase });

      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

      try {
        let tokenData;

        if (opts.sms) {
          // 短信验证码登录
          const savedPhone = config.cellphone || '';
          const cellphone = opts.username
              || await ask(savedPhone ? `手机号 [${savedPhone}]: ` : '手机号: ').then(v => v.trim() || savedPhone);

          if (!cellphone) { console.error('✗ 请输入手机号'); rl.close(); process.exit(1); }          process.stdout.write('正在检查账号...');
          const exists = await checkAccountExists(apiBase, cellphone);
          if (!exists) {
            console.log('');
            console.error(`✗ 该手机号尚未注册，请前往 casstime APP 完成注册后再使用 CLI`);
            rl.close();
            process.exit(1);
          }
          console.log(' 已确认');

          // 仅发码模式：发完直接退出，不开 readline 等待
          if (opts.sendCode) {
            process.stdout.write('正在发送验证码...');
            await sendLoginCode(apiBase, cellphone);
            console.log(' 已发送，收到后执行:');
            console.log(`  quote login --sms -u ${cellphone} --code <验证码>`);
            rl.close();
            return;
          }

          // 非交互模式：已提供 --code，跳过发码+输入步骤
          let verifyCode;
          if (opts.code) {
            verifyCode = opts.code;
          } else {
            process.stdout.write('正在发送验证码...');
            await sendLoginCode(apiBase, cellphone);
            console.log(' 已发送');

            verifyCode = await ask('验证码: ');
          }
          rl.close();

          tokenData = await loginWithCellphone(apiBase, cellphone, verifyCode);
        } else {
          // 账号密码登录
          const savedAccount = config.cellphone || config.userLoginId || '';
          const username = opts.username
            || await ask(savedAccount ? `账号 [${savedAccount}]: ` : '账号: ').then(v => v.trim() || savedAccount);

          if (!username) { console.error('✗ 请输入账号'); rl.close(); process.exit(1); }

          process.stdout.write('正在检查账号...');
          const exists = await checkAccountExists(apiBase, username);
          if (!exists) {
            console.log('');
            console.error(`✗ 该账号尚未注册，请前往 casstime APP 完成注册后再使用 CLI`);
            rl.close();
            process.exit(1);
          }
          console.log(' 已确认');

          const password = opts.password || await ask('密码: ');
          rl.close();

          tokenData = await loginWithPassword(apiBase, username, password);
        }

        console.log(`✓ 登录成功`);
        console.log(`  用户: ${tokenData.userLoginId || opts.username}`);
        console.log(`  Token 有效期: ${Math.round((tokenData.expiresIn || 7200) / 60)} 分钟`);
        console.log(`  模式已切换为: api`);
      } catch (err) {
        rl.close();
        console.error(`✗ 登录失败: ${err.message}`);
        process.exit(1);
      }
    });

  program
    .command('register')
    .description('注册新账号')
    .option('-u, --username <name>', '用户名')
    .option('--phone <phone>', '手机号')
    .option('-p, --password <pwd>', '密码')
    .option('--code <code>', '验证码（非交互：先用 --send-code 发送）')
    .option('--send-code', '仅发送注册验证码，不完成注册')
    .option('--company <name>', '公司/门店名称')
    .option('--province-id <id>', '省级 geoId（如 CN-11）')
    .option('--province-name <name>', '省名称（如 北京市）')
    .option('--city-id <id>', '市级 geoId（如 1351）')
    .option('--city-name <name>', '市名称')
    .option('--county-id <id>', '区县 geoId（如 9629）')
    .option('--county-name <name>', '区县名称')
    .option('--api-base <url>', 'API 地址', API_BASE_DEFAULT)
    .action(async (opts) => {
      const store = new Store();
      const config = store.getConfig();
      const apiBase = opts.apiBase || config.apiBase || API_BASE_DEFAULT;

      // 仅发送验证码模式
      if (opts.sendCode) {
        if (!opts.phone) { console.error('✗ 请提供 --phone <手机号>'); process.exit(1); }
        process.stdout.write('正在发送验证码...');
        await sendRegisterCode(apiBase, opts.phone);
        console.log(' 已发送，请查收短信后带 --code 完成注册');
        return;
      }

      const isNonInteractive = opts.phone && opts.password && opts.username && opts.code;

      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const ask = (q) => new Promise((resolve) => rl.question(q, resolve));
      const askHidden = (q) => new Promise((resolve) => {
        process.stdout.write(q);
        process.stdin.setRawMode?.(true);
        let input = '';
        const onData = (ch) => {
          ch = ch.toString();
          if (ch === '\n' || ch === '\r') {
            process.stdin.setRawMode?.(false);
            process.stdin.removeListener('data', onData);
            process.stdout.write('\n');
            resolve(input);
          } else if (ch === '') { process.exit(); }
          else if (ch === '') { input = input.slice(0, -1); }
          else { input += ch; process.stdout.write('*'); }
        };
        process.stdin.resume();
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', onData);
      });

      try {
        const cellphone = opts.phone || await ask('手机号: ');

        process.stdout.write('正在检查账号...');
        const exists = await checkAccountExists(apiBase, cellphone);
        console.log(exists ? ' 已注册' : ' 未注册');
        if (exists) {
          console.error('✗ 该手机号已注册，请直接登录: quote login');
          rl.close(); process.exit(1);
        }

        if (!isNonInteractive) {
          process.stdout.write('正在发送验证码...');
          await sendRegisterCode(apiBase, cellphone);
          console.log(' 已发送');
        }

        const verifyCode = opts.code     || await ask('验证码: ');
        const username   = opts.username || await ask('用户名: ');
        const password   = opts.password || await askHidden('密码: ');

        if (!isNonInteractive) rl.close();

        await registerUser(apiBase, { cellphone, password, username, verificationCode: verifyCode });
        console.log('✓ 注册成功，正在自动登录...');

        store.setConfig({ apiBase });
        const tokenData = await loginWithPassword(apiBase, cellphone, password);
        console.log(`✓ 登录成功  用户: ${tokenData.userLoginId || username}`);

        // 公司信息 —— 有 flag 则非交互
        if (opts.company && opts.provinceId && opts.cityId && opts.countyId) {
          await saveCompanyInfo(apiBase, {
            companyName:  opts.company,
            provinceId:   opts.provinceId,   provinceName: opts.provinceName || '',
            cityId:       opts.cityId,       cityName:     opts.cityName     || '',
            countyId:     opts.countyId,     countyName:   opts.countyName   || '',
          });
          console.log('✓ 公司信息已保存，使用 quote inquiry create 发布询价');
          rl.close();
          return;
        }

        console.log('\n完善公司/门店信息（发布询价必须）:');
        const companyName = await ask('公司/门店名称: ');

        const provinces = await fetchAreas(apiBase, 'CHN');
        provinces.forEach((p, i) => process.stdout.write(`  ${String(i + 1).padStart(2)}. ${p.geoName}\n`));
        const province = provinces[parseInt(await ask(`选择省份 (1-${provinces.length}): `), 10) - 1];

        const cities = await fetchAreas(apiBase, province.geoId);
        cities.forEach((c, i) => process.stdout.write(`  ${String(i + 1).padStart(2)}. ${c.geoName}\n`));
        const city = cities[parseInt(await ask(`选择城市 (1-${cities.length}): `), 10) - 1];

        const counties = await fetchAreas(apiBase, city.geoId);
        counties.forEach((d, i) => process.stdout.write(`  ${String(i + 1).padStart(2)}. ${d.geoName}\n`));
        const county = counties[parseInt(await ask(`选择区县 (1-${counties.length}): `), 10) - 1];

        rl.close();
        await saveCompanyInfo(apiBase, {
          companyName,
          provinceId: province.geoId, provinceName: province.geoName,
          cityId:     city.geoId,     cityName:     city.geoName,
          countyId:   county.geoId,   countyName:   county.geoName,
        });
        console.log('✓ 公司信息已保存，使用 quote inquiry create 发布询价');
      } catch (err) {
        rl.close();
        console.error(`✗ 注册失败: ${err.message}`);
        process.exit(1);
      }
    });

  program
    .command('logout')
    .description('登出（清除本地令牌）')
    .action(() => {
      if (!isLoggedIn()) { console.log('当前未登录'); return; }
      logout();
      console.log('✓ 已登出，令牌已清除');
    });

  program
    .command('whoami')
    .description('查看当前登录状态')
    .action(() => {
      const store = new Store();
      const config = store.getConfig();

      if (!isLoggedIn()) {
        console.log('未登录。执行 quote login 登录平台。');
        return;
      }

      const expiresAt = config.tokenExpiresAt;
      const now = Date.now();
      const remaining = expiresAt ? Math.max(0, Math.round((expiresAt - now) / 60_000)) : '?';

      console.log(`  用户: ${config.userLoginId || '未知'}`);
      console.log(`  模式: ${config.mode || 'local'}`);
      console.log(`  API:  ${config.apiBase || '未配置'}`);
      console.log(`  Token 剩余: ${remaining} 分钟`);
    });
}
