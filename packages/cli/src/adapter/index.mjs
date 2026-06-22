import { Store } from '../store.mjs';
import { ApiAdapter } from './api.mjs';
import { API_BASE_DEFAULT } from '../constants.mjs';

let _adapter = null;

/**
 * 获取 API 适配器（单例）
 */
export function getAdapter() {
  if (_adapter) return _adapter;
  const config = new Store().getConfig();
  _adapter = new ApiAdapter({ apiBase: config.apiBase || API_BASE_DEFAULT });
  return _adapter;
}

/** 重置单例（供测试使用） */
export function resetAdapter() {
  _adapter = null;
}
