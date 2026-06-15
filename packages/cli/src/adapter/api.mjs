/**
 * API 远程接口适配器（骨架）
 * 后续对接真实后端时在此实现 HTTP 调用
 */
export class ApiAdapter {
  constructor(config = {}) {
    this.baseUrl = config.apiBase || '';
    this.token = config.apiToken || '';
  }

  _headers() {
    const h = { 'Content-Type': 'application/json' };
    if (this.token) h['Authorization'] = `Bearer ${this.token}`;
    return h;
  }

  async _request(method, path, body) {
    if (!this.baseUrl) {
      throw new Error('API 模式未配置 apiBase，请执行: quote config set --mode api --api-base <url>');
    }
    const url = `${this.baseUrl}${path}`;
    const opts = { method, headers: this._headers() };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API 请求失败 [${res.status}]: ${text}`);
    }
    return res.json();
  }

  // ─── Inquiry ─────────────────────────────────────────────

  async createInquiry(data) {
    return this._request('POST', '/inquiries', data);
  }

  async listInquiries(filter = {}) {
    const params = new URLSearchParams(filter).toString();
    return this._request('GET', `/inquiries${params ? '?' + params : ''}`);
  }

  async getInquiry(id) {
    return this._request('GET', `/inquiries/${id}`);
  }

  async closeInquiry(id) {
    return this._request('PATCH', `/inquiries/${id}`, { status: 'closed' });
  }

  // ─── Reply ───────────────────────────────────────────────

  async createReply(data) {
    return this._request('POST', '/replies', data);
  }

  async listReplies(inquiryId) {
    return this._request('GET', `/inquiries/${inquiryId}/replies`);
  }

  // ─── Compare ─────────────────────────────────────────────

  async compareReplies(inquiryId, sort = 'price') {
    return this._request('GET', `/inquiries/${inquiryId}/compare?sort=${sort}`);
  }

  // ─── Order ───────────────────────────────────────────────

  async confirmOrder(inquiryId, replyId) {
    return this._request('POST', '/orders', { inquiryId, replyId });
  }

  async listOrders() {
    return this._request('GET', '/orders');
  }

  // ─── Config ──────────────────────────────────────────────
  // config 始终本地存储（包含 apiBase 等连接信息）

  async getConfig() {
    // 由 index.mjs 在创建 adapter 前已读取，这里直接返回
    const { Store } = await import('../store.mjs');
    const store = new Store();
    return store.getConfig();
  }

  async setConfig(updates) {
    const { Store } = await import('../store.mjs');
    const store = new Store();
    return store.setConfig(updates);
  }
}
