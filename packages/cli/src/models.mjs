/**
 * 数据模型定义与校验
 */

export function createInquiry({ product, oeNumber, vehicle, quantity, note }, createdBy) {
  if (!product) throw new Error('product 是必填项');
  return {
    product,
    oeNumber: oeNumber || '',
    vehicle: vehicle || '',
    quantity: quantity ? Number(quantity) : 1,
    note: note || '',
    status: 'pending', // pending | quoted | ordered | closed
    createdAt: new Date().toISOString(),
    createdBy: createdBy || 'anonymous',
  };
}

export function createReply({ inquiryId, supplier, price, currency, brand, delivery, note }) {
  if (!inquiryId) throw new Error('inquiryId 是必填项');
  if (!price) throw new Error('price 是必填项');
  return {
    inquiryId,
    supplier: supplier || 'unknown',
    price: Number(price),
    currency: currency || 'CNY',
    brand: brand || '',
    delivery: delivery ? Number(delivery) : null, // 货期（天）
    note: note || '',
    createdAt: new Date().toISOString(),
  };
}

export function createOrder({ inquiryId, replyId }) {
  if (!inquiryId) throw new Error('inquiryId 是必填项');
  if (!replyId) throw new Error('replyId 是必填项');
  return {
    inquiryId,
    replyId,
    status: 'confirmed',
    confirmedAt: new Date().toISOString(),
  };
}
