import { Store } from '../store.mjs';
import { LocalAdapter } from './local.mjs';
import { ApiAdapter } from './api.mjs';

let _adapter = null;

/**
 * 获取数据适配器（单例）
 * 根据 config.mode 决定使用本地存储还是远程 API
 */
export function getAdapter() {
  if (_adapter) return _adapter;

  const store = new Store();
  const config = store.getConfig();

  if (config.mode === 'api') {
    _adapter = new ApiAdapter(config);
  } else {
    _adapter = new LocalAdapter();
  }

  return _adapter;
}
