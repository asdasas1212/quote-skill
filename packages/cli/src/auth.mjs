/**
 * 认证模块 — 处理登录、token 存储与自动续期
 */
import { Store } from './store.mjs';
import { APP_USER_AGENT, API_BASE_DEFAULT, TOKEN_REFRESH_AHEAD_MS } from './constants.mjs';

function getStore() {
  return new Store();
}

/**
 * 用户名密码登录
 */
export async function loginWithPassword(apiBase, userLoginName, password) {
  const url = `${apiBase}/public/auth/ecapp/login/password`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': APP_USER_AGENT,
    },
    body: JSON.stringify({ userLoginName, password }),
  });

  const json = await res.json();
  if (json.errorCode !== 0 && !json.data?.accessToken) {
    throw new Error(json.message || `登录失败 [errorCode: ${json.errorCode}]`);
  }

  const tokenData = json.data || json;
  saveTokens(tokenData);
  await fetchAndCacheUserInfo(apiBase);
  return tokenData;
}

/**
 * 查询地区列表（根据父节点 geoId）
 * 根节点: CHN → 省 → 市 → 区县
 */
export async function fetchAreas(apiBase, geoId) {
  const config = getStore().getConfig();
  const url = new URL(`${apiBase}/public/area`);
  url.searchParams.set('geoId', geoId);

  const res = await fetch(url.toString(), {
    headers: {
      'Authorization': `bearer ${config.accessToken}`,
      'User-Agent': APP_USER_AGENT,
    },
  });

  const json = await res.json();
  if (json.errorCode !== 0) {
    throw new Error(json.message || '查询地区失败');
  }
  return json.data || [];
}

/**
 * 完善公司信息（注册后调用，设置 registerCompleted=true）
 */
export async function saveCompanyInfo(apiBase, { companyName, provinceId, provinceName, cityId, cityName, countyId, countyName, address }) {
  const config = getStore().getConfig();
  const res = await fetch(`${apiBase}/users/save_company_info`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `bearer ${config.accessToken}`,
      'User-Agent': APP_USER_AGENT,
    },
    body: JSON.stringify({
      companyName,
      provinceId,
      provinceName,
      cityId,
      cityName,
      countyId,
      countyName,
      address: address || '',
      isCustomerManagerValidated: false,
    }),
  });

  const json = await res.json();
  if (json.errorCode !== 0) {
    throw new Error(json.message || `完善公司信息失败 [errorCode: ${json.errorCode}]`);
  }

  // 更新本地缓存
  await fetchAndCacheUserInfo(apiBase);
  return json.data;
}

/**
 * 发送注册验证码
 */
export async function sendRegisterCode(apiBase, cellphone) {
  const url = new URL(`${apiBase}/public/verify_code`);
  url.searchParams.set('channelId', 'REGISTER');
  url.searchParams.set('cellphone', cellphone);

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { 'User-Agent': APP_USER_AGENT },
  });

  const json = await res.json();
  if (json.errorCode !== 0) {
    throw new Error(json.message || `发送验证码失败 [errorCode: ${json.errorCode}]`);
  }
}

/**
 * 注册新用户
 */
export async function registerUser(apiBase, { cellphone, password, username, verificationCode }) {
  const res = await fetch(`${apiBase}/public/users/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': APP_USER_AGENT,
    },
    body: JSON.stringify({
      cellphone,
      password,
      username,
      verificationCode,
      registerSource: 'ANDROID',
    }),
  });

  const json = await res.json();
  if (json.errorCode !== 0) {
    throw new Error(json.message || `注册失败 [errorCode: ${json.errorCode}]`);
  }

  return json.data || json;
}

/**
 * 检查账号是否已注册
 * 返回 true 表示已注册，false 表示未注册
 */
export async function checkAccountExists(apiBase, account) {
  const res = await fetch(`${apiBase}/public/users/${encodeURIComponent(account)}/account_info`, {
    headers: { 'User-Agent': APP_USER_AGENT },
  });
  const json = await res.json();
  // 702 = 账号不存在
  return json.errorCode !== 702;
}

/**
 * 发送登录验证码
 */
export async function sendLoginCode(apiBase, cellphone) {
  const url = new URL(`${apiBase}/public/verify_code`);
  url.searchParams.set('channelId', 'LOGIN');
  url.searchParams.set('cellphone', cellphone);

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': APP_USER_AGENT,
    },
  });

  const json = await res.json();
  if (json.errorCode !== 0) {
    throw new Error(json.message || `发送验证码失败 [errorCode: ${json.errorCode}]`);
  }
}

/**
 * 手机号验证码登录
 */
export async function loginWithCellphone(apiBase, cellphone, verifyCode) {
  const url = `${apiBase}/public/auth/ecapp/login/cellphone`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': APP_USER_AGENT,
    },
    body: JSON.stringify({ cellphone, verifyCode }),
  });

  const json = await res.json();
  if (json.errorCode !== 0 && !json.data?.accessToken) {
    throw new Error(json.message || `登录失败 [errorCode: ${json.errorCode}]`);
  }

  const tokenData = json.data || json;
  saveTokens(tokenData);
  await fetchAndCacheUserInfo(apiBase);
  return tokenData;
}

/**
 * 刷新 token
 */
export async function refreshToken(apiBase) {
  const config = getStore().getConfig();
  if (!config.refreshToken) {
    throw new Error('无 refreshToken，请重新登录: quote login');
  }

  const url = `${apiBase}/public/auth/ecapp/refresh_token`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': APP_USER_AGENT,
    },
    body: JSON.stringify({
      refreshToken: config.refreshToken,
      clientId: 'CASSAPP',
    }),
  });

  const json = await res.json();
  if (json.errorCode !== 0 && !json.data?.accessToken) {
    // 只有明确的认证失效错误码才清空本地凭证
    // 网络抖动、服务端临时错误等不清空，保留 token 让用户重试
    const authErrorCodes = new Set([401, 652, 653, 654]);
    if (authErrorCodes.has(json.errorCode) || res.status === 401) {
      logout();
      throw new Error('登录已过期，请重新执行: quote login');
    }
    throw new Error(json.message || `续签失败 [${json.errorCode}]，请稍后重试`);
  }

  const tokenData = json.data || json;
  saveTokens(tokenData);
  return tokenData;
}

// 并发续签锁：同一时刻只允许一个 refreshToken 调用在飞
let _refreshPromise = null;

/**
 * 获取有效的 accessToken（过期自动续期，带并发锁防止重复刷新）
 */
export async function getValidToken(apiBase) {
  const config = getStore().getConfig();

  if (!config.accessToken) {
    throw new Error('未登录，请先执行: quote login');
  }

  const now = Date.now();

  // 已过期，阻塞等刷新完才能继续（加锁防并发）
  if (config.tokenExpiresAt && now > config.tokenExpiresAt) {
    if (!_refreshPromise) {
      _refreshPromise = refreshToken(apiBase).finally(() => { _refreshPromise = null; });
    }
    const tokenData = await _refreshPromise;
    return tokenData.accessToken;
  }

  // 进入预刷新窗口，同步等待刷新完成后继续（CLI 进程生命期短，不能只触发后台任务）
  if (config.tokenExpiresAt && now > config.tokenExpiresAt - TOKEN_REFRESH_AHEAD_MS) {
    if (!_refreshPromise) {
      _refreshPromise = refreshToken(apiBase)
        .catch(() => {})
        .finally(() => { _refreshPromise = null; });
    }
    await _refreshPromise;
    // 刷新成功后从磁盘读取最新 token；失败时静默继续使用旧 token（_request 层会兜底重试）
    return getStore().getConfig().accessToken || config.accessToken;
  }

  return config.accessToken;
}

/**
 * 检查是否已登录
 */
export function isLoggedIn() {
  const config = getStore().getConfig();
  return !!(config.accessToken && config.refreshToken);
}

/**
 * 登出（仅清除认证 token，保留账号信息用于下次登录预填）
 */
export function logout() {
  getStore().setConfig({
    accessToken:    null,
    refreshToken:   null,
    tokenType:      null,
    tokenExpiresAt: null,
    // 保留 cellphone / userLoginId，方便下次登录时预填账号
  });
}

// ─── 内部 ──────────────────────────────────────────────

async function fetchAndCacheUserInfo(apiBase) {
  try {
    const config = getStore().getConfig();
    const res = await fetch(`${apiBase}/users/_current`, {
      headers: {
        'Authorization': `bearer ${config.accessToken}`,
        'User-Agent': APP_USER_AGENT,
      },
    });
    const json = await res.json();
    if (json.errorCode !== 0) return;
    const u = json.data || json;
    getStore().setConfig({
      companyName:            u.companyName || u.displayName || '',
      garageCompanyId:        u.garageCompanyId || '',
      cellphone:              u.cellphone || '',
      provinceGeoId:          u.provinceGeoId  || '',
      cityGeoId:              u.cityGeoId      || '',
      countyGeoId:            u.countyGeoId    || '',
      provinceGeoName:        u.provinceGeoName || '',
      cityGeoName:            u.cityGeoName    || '',
      countyGeoName:          u.countyGeoName  || '',
      isSimpleInquiryAllowed: u.isSimpleInquiryAllowed === true,
    });
  } catch {
    // 拉取失败不影响登录流程
  }
}

function saveTokens(tokenData) {
  const expiresAt = Date.now() + (tokenData.expiresIn || 7200) * 1000;
  getStore().setConfig({
    accessToken: tokenData.accessToken,
    refreshToken: tokenData.refreshToken,
    tokenType: tokenData.tokenType || 'bearer',
    tokenExpiresAt: expiresAt,
    userLoginId: tokenData.userLoginId || '',
  });
}
