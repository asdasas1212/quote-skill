/**
 * 全局常量
 */

export const API_BASE_DEFAULT = 'https://ec-hwbeta.casstime.com/terminal-api-v2';

// 模拟移动端 UA，用于通过 API 网关版本校验
export const APP_USER_AGENT = 'cassapp/7.9.0.0 iOS/26.5 Apple/iPhone 13';

// token 刷新策略
// 距过期不足此时间（毫秒）时触发后台预刷新，本次请求仍使用旧 token
export const TOKEN_REFRESH_AHEAD_MS = 5 * 60 * 1000; // 5 分钟
