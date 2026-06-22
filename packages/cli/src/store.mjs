import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

/**
 * 本地配置存储
 * 配置文件位于 ~/.quote/config.json，全局唯一，不受 cwd 影响
 */
export class Store {
  constructor() {
    // QUOTE_CONFIG_DIR allows tests to redirect storage without touching ~/.quote
    this.root       = process.env.QUOTE_CONFIG_DIR || join(homedir(), '.quote');
    this.configPath = join(this.root, 'config.json');
  }

  _ensureDir() {
    if (!existsSync(this.root)) {
      mkdirSync(this.root, { recursive: true });
    }
  }

  getConfig() {
    this._ensureDir();
    if (!existsSync(this.configPath)) return {};
    try {
      return JSON.parse(readFileSync(this.configPath, 'utf-8'));
    } catch {
      return {};
    }
  }

  /**
   * 合并更新配置
   * 值为 null 或 undefined 的 key 会从配置中删除
   */
  setConfig(updates) {
    this._ensureDir();
    const config = { ...this.getConfig() };
    for (const [k, v] of Object.entries(updates)) {
      if (v == null) {
        delete config[k];
      } else {
        config[k] = v;
      }
    }
    writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
    return config;
  }
}
