import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 本地 JSON 文件存储层
 * 数据存放在 cwd/.quote-data/ 下
 */
export class Store {
  constructor(baseDir = process.cwd()) {
    this.root = join(baseDir, '.quote-data');
    this.dirs = {
      inquiries: join(this.root, 'inquiries'),
      replies: join(this.root, 'replies'),
      orders: join(this.root, 'orders'),
    };
    this.configPath = join(this.root, 'config.json');
  }

  /** 确保数据目录存在 */
  init() {
    for (const dir of Object.values(this.dirs)) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
  }

  // ─── 通用 CRUD ───────────────────────────────────────────

  _filePath(collection, id) {
    return join(this.dirs[collection], `${id}.json`);
  }

  save(collection, record) {
    this.init();
    const filePath = this._filePath(collection, record.id);
    writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf-8');
    return record;
  }

  get(collection, id) {
    const filePath = this._filePath(collection, id);
    if (!existsSync(filePath)) return null;
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  }

  list(collection, filterFn = () => true) {
    this.init();
    const dir = this.dirs[collection];
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(readFileSync(join(dir, f), 'utf-8')))
      .filter(filterFn)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  // ─── Config ──────────────────────────────────────────────

  getConfig() {
    this.init();
    if (!existsSync(this.configPath)) return {};
    return JSON.parse(readFileSync(this.configPath, 'utf-8'));
  }

  setConfig(updates) {
    this.init();
    const config = { ...this.getConfig(), ...updates };
    writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
    return config;
  }

  // ─── ID 生成 ─────────────────────────────────────────────

  nextId(prefix) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const existing = readdirSync(this.dirs[this._collectionForPrefix(prefix)] || this.root)
      .filter(f => f.startsWith(prefix))
      .length;
    const seq = String(existing + 1).padStart(3, '0');
    return `${prefix}-${date}-${seq}`;
  }

  _collectionForPrefix(prefix) {
    const map = { INQ: 'inquiries', QUO: 'replies', ORD: 'orders' };
    return map[prefix] || 'inquiries';
  }
}
