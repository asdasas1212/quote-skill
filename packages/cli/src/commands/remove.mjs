/**
 * remove 向导 —— 一条命令卸载 Skill + 全局 CLI
 *
 * 用法：npx @dalehkx/quote-cli@latest remove
 */
import { execFileSync, execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const PKG = '@dalehkx/quote-cli';
const SKILL_NAME = 'cass-quote';
const isWindows = process.platform === 'win32';

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

async function stepRemoveSkill() {
  process.stdout.write('  正在卸载 Skill...');
  try {
    await runAsync('npx', ['skills', 'remove', SKILL_NAME, '-g', '-y'], { timeout: 30000 });
    console.log(' 完成');
    return;
  } catch { /* 回退到手动删除 */ }

  // 回退：直接删除 Claude Code 的 skill 目录
  const candidates = [
    path.join(os.homedir(), '.claude', 'skills', SKILL_NAME),
    path.join(os.homedir(), '.agents', 'skills', SKILL_NAME),
  ];
  const removed = candidates.filter(p => {
    if (fs.existsSync(p)) { fs.rmSync(p, { recursive: true, force: true }); return true; }
    return false;
  });

  if (removed.length > 0) {
    console.log(' 完成');
  } else {
    console.log('');
    console.log(`  ℹ Skill 未找到，可能已卸载`);
  }
}

async function stepUninstallCli() {
  process.stdout.write(`  正在卸载 ${PKG}...`);
  try {
    await runAsync('npm', ['uninstall', '-g', PKG], { timeout: 60000 });
    console.log(' 完成');
  } catch {
    console.log('');
    console.error(`  ✗ 卸载失败，请手动执行: npm uninstall -g ${PKG}`);
  }
}

export function registerRemoveCommand(program) {
  program
    .command('remove')
    .description('卸载 Skill 和全局 CLI')
    .action(async () => {
      console.log('\ncass-quote 卸载向导\n');

      console.log('1/2  Skill');
      await stepRemoveSkill();

      console.log('\n2/2  CLI');
      await stepUninstallCli();

      console.log('\n卸载完成！\n');
    });
}
