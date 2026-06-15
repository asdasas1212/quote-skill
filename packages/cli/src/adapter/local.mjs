import { Store } from '../store.mjs';
import { createInquiry, createReply, createOrder } from '../models.mjs';

/**
 * 本地 JSON 文件存储适配器
 * 将 Store 的底层操作包装为统一的业务接口
 */
export class LocalAdapter {
  constructor() {
    this.store = new Store();
  }

  // ─── Inquiry ─────────────────────────────────────────────

  async createInquiry(data) {
    const config = this.store.getConfig();
    const id = this.store.nextId('INQ');
    const record = { id, ...createInquiry(data, config.name) };
    return this.store.save('inquiries', record);
  }

  async listInquiries(filter = {}) {
    return this.store.list('inquiries', (item) => {
      if (filter.status && item.status !== filter.status) return false;
      return true;
    });
  }

  async getInquiry(id) {
    return this.store.get('inquiries', id);
  }

  async closeInquiry(id) {
    const record = this.store.get('inquiries', id);
    if (!record) return null;
    record.status = 'closed';
    return this.store.save('inquiries', record);
  }

  // ─── Reply ───────────────────────────────────────────────

  async createReply(data) {
    const inquiry = this.store.get('inquiries', data.inquiryId);
    if (!inquiry) return null;

    const id = this.store.nextId('QUO');
    const record = { id, ...createReply(data) };
    this.store.save('replies', record);

    // 更新询价单状态
    if (inquiry.status === 'pending') {
      inquiry.status = 'quoted';
      this.store.save('inquiries', inquiry);
    }

    return record;
  }

  async listReplies(inquiryId) {
    return this.store.list('replies', r => r.inquiryId === inquiryId);
  }

  // ─── Compare ─────────────────────────────────────────────

  async compareReplies(inquiryId, sort = 'price') {
    const inquiry = this.store.get('inquiries', inquiryId);
    if (!inquiry) return null;

    const replies = this.store.list('replies', r => r.inquiryId === inquiryId);
    if (replies.length === 0) return { inquiry, sorted: [], lowest: null, fastest: null };

    const sorted = [...replies].sort((a, b) => {
      switch (sort) {
        case 'price': return a.price - b.price;
        case 'delivery': return (a.delivery || 999) - (b.delivery || 999);
        case 'brand': return (a.brand || '').localeCompare(b.brand || '');
        default: return a.price - b.price;
      }
    });

    const lowest = sorted[0];
    const fastest = [...replies].sort((a, b) => (a.delivery || 999) - (b.delivery || 999))[0];

    return { inquiry, sorted, lowest, fastest };
  }

  // ─── Order ───────────────────────────────────────────────

  async confirmOrder(inquiryId, replyId) {
    const inquiry = this.store.get('inquiries', inquiryId);
    if (!inquiry) return null;

    const reply = this.store.get('replies', replyId);
    if (!reply) return null;
    if (reply.inquiryId !== inquiryId) return null;

    const id = this.store.nextId('ORD');
    const record = { id, ...createOrder({ inquiryId, replyId }) };
    this.store.save('orders', record);

    inquiry.status = 'ordered';
    this.store.save('inquiries', inquiry);

    return { order: record, inquiry, reply };
  }

  async listOrders() {
    const orders = this.store.list('orders');
    return orders.map(order => ({
      ...order,
      inquiry: this.store.get('inquiries', order.inquiryId),
      reply: this.store.get('replies', order.replyId),
    }));
  }

  // ─── Config ──────────────────────────────────────────────

  async getConfig() {
    return this.store.getConfig();
  }

  async setConfig(updates) {
    return this.store.setConfig(updates);
  }
}
