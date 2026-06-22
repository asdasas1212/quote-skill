/**
 * install 向导 —— 一条命令完成 CLI 全局安装 + Skill 安装 + 登录
 *
 * 用法：npx cass-quote install
 */
import { execFileSync, execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json');

const PKG = '@dalehkx/quote-cli';
const isWindows = process.platform === 'win32';

function execCmd(cmd, args, opts) {
  if (isWindows) return execFileSync('cmd.exe', ['/c', cmd, ...args], opts);
  return execFileSync(cmd, args, opts);
}

function runSilent(cmd, args, opts = {}) {
  return execCmd(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
}

function runAsync(cmd, args, opts = {}) {
  const actualCmd = isWindows ? 'cmd.exe' : cmd;
  const actualArgs = isWindows ? ['/c', cmd, ...args] : args;
  return new Promise((resolve, reject) => {
    execFile(actualCmd, actualArgs, { stdio: ['ignore', 'pipe', 'pipe'], ...opts }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout.toString().trim());
    });
  });
}

function fmt(str, ...vals) {
  let i = 0;
  return str.replace(/%s/g, () => vals[i++] ?? '');
}

function getGlobalVersion() {
  try {
    const out = runSilent('npm', ['list', '-g', PKG], { timeout: 15000 });
    const match = out.toString().match(/@(\d+\.\d+\.\d+[^\s]*)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function semverLt(a, b) {
  const pa = a.replace(/-.*$/, '').split('.').map(Number);
  const pb = b.replace(/-.*$/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) < (pb[i] || 0)) return true;
    if ((pa[i] || 0) > (pb[i] || 0)) return false;
  }
  return false;
}

async function stepInstallCli() {
  const installed = getGlobalVersion();

  if (installed && !semverLt(installed, version)) {
    console.log(`  ✓ CLI 已是最新版本 (v${installed})，跳过`);
    return;
  }

  if (installed) {
    process.stdout.write(fmt('  正在升级 %s (v%s → v%s)...', PKG, installed, version));
  } else {
    process.stdout.write(fmt('  正在全局安装 %s...', PKG));
  }

  try {
    await runAsync('npm', ['install', '-g', '--ignore-scripts', PKG], { timeout: 120000 });
    console.log(' 完成');
  } catch {
    console.log('');
    console.error(fmt('  ✗ 安装失败，请手动执行: npm install -g %s', PKG));
    process.exit(1);
  }
}

function installSkill() {
  // 找到全局安装包内的 skill 目录（不同平台路径不同）
  let skillSrc;
  try {
    const prefix = execFileSync('npm', ['prefix', '-g'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    }).toString().trim();
    // 尝试两种常见路径：标准 npm 和 Homebrew/nvm 等
    const candidates = [
      path.join(prefix, 'lib', 'node_modules', PKG, 'skill'),
      path.join(prefix, 'node_modules', PKG, 'skill'),
    ];
    skillSrc = candidates.find(p => fs.existsSync(p));
  } catch { /* ignore */ }

  if (!skillSrc) {
    console.log('  ✗ 未找到 skill 目录，跳过');
    return;
  }

  const skillDest = path.join(os.homedir(), '.claude', 'skills', 'cass-quote');
  copyDir(skillSrc, skillDest);
  console.log(`  ✓ Skill 已安装到 ${skillDest}`);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}

async function stepLogin() {
  try {
    runSilent('quote', ['whoami'], { timeout: 5000 });
    console.log('  ✓ 已登录，跳过');
    return;
  } catch {
    // 未登录，继续
  }

  console.log('');
  console.log('  请登录 casstime 账号（执行 quote login）');
  try {
    execCmd('quote', ['login'], { stdio: 'inherit', timeout: 120000 });
  } catch {
    console.error('  ✗ 登录失败，稍后可手动执行: quote login');
  }
}

export function registerInstallCommand(program) {
  program
    .command('install')
    .description('安装向导：全局安装 CLI + Skill + 登录（推荐首次使用）')
    .option('--skip-login', '跳过登录步骤')
    .action(async (opts) => {
      console.log('\ncass-quote 安装向导\n');

      console.log('1/3  CLI');
      await stepInstallCli();

      console.log('\n2/3  Skill（Claude Code 集成）');
      installSkill();

      if (!opts.skipLogin) {
        console.log('\n3/3  登录');
        await stepLogin();
      }

      console.log('\n安装完成！');
      console.log('   现在可以对 Claude Code 说：「帮我创建一条询价单」\n');
    });
}
