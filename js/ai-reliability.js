// @ts-check
/* v1.3.0 AI Reliability Core:
 * - A3 Per-browser privacy consent (timestamp + host, revocable)
 * - A7 IndexedDB AI result cache (key = sha256 + ladderId + model + promptVersion)
 * - A8 Automatic 1x retry with backoff for timeout / HTTP 429 / network errors (never 4xx config)
 * - A9 Structured error diagnosis & clickable repair cards */
(function (G) {
  'use strict';
  /** @type {any} */
  const win = G;
  const L = (zh, en) => (win.L ? win.L(zh, en) : zh);

  const CONSENT_KEY = 'gelfig.ai.consent.v1';
  const PROMPT_VERSION = 'v1.3.0';
  const CACHE_DB = 'gelfigure-ai-cache-v1';
  const CACHE_STORE = 'results';

  /* ---------- A3 Per-Browser Privacy Consent ---------- */
  function hostOf(url) {
    try { return new URL(String(url || '').trim()).host.toLowerCase(); }
    catch (_) { return ''; }
  }

  /** @returns {{ acceptedAt: string, host: string } | null} */
  function readConsent() {
    try {
      const raw = win.PrefStorage ? win.PrefStorage.getItem(CONSENT_KEY) : localStorage.getItem(CONSENT_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (obj && typeof obj.acceptedAt === 'string' && typeof obj.host === 'string' && obj.host) return obj;
    } catch (_) { /* storage blocked */ }
    return null;
  }

  /** @param {string} endpointUrl */
  function grantConsent(endpointUrl) {
    const host = hostOf(endpointUrl);
    if (!host) return null;
    const record = { acceptedAt: new Date().toISOString(), host };
    try {
      const json = JSON.stringify(record);
      if (win.PrefStorage) win.PrefStorage.setItem(CONSENT_KEY, json);
      else localStorage.setItem(CONSENT_KEY, json);
    } catch (_) { /* fallback in-memory below */ }
    memConsent = record;
    win.dispatchEvent(new CustomEvent('gelfigure-ai-consent-changed', { detail: record }));
    return record;
  }

  function revokeConsent() {
    memConsent = null;
    try {
      if (win.PrefStorage) win.PrefStorage.removeItem(CONSENT_KEY);
      else localStorage.removeItem(CONSENT_KEY);
    } catch (_) { /* ignore */ }
    win.dispatchEvent(new CustomEvent('gelfigure-ai-consent-changed', { detail: null }));
  }

  /** @type {{ acceptedAt: string, host: string } | null} */
  let memConsent = null;

  function getConsent() {
    return readConsent() || memConsent;
  }

  /** @param {string} [endpointUrl] */
  function isConsented(endpointUrl) {
    const rec = getConsent();
    if (!rec) return false;
    if (!endpointUrl) return true;
    const h = hostOf(endpointUrl);
    return !!h && rec.host === h;
  }

  win.AIConsent = {
    get info() { return getConsent(); },
    hostOf,
    isConsented,
    grant: grantConsent,
    revoke: revokeConsent
  };

  /* ---------- A7 IndexedDB AI Result Cache ---------- */
  /** @type {Map<string, any>} */
  const memCache = new Map();

  function openCacheDB() {
    return new Promise((resolve, reject) => {
      try {
        if (!win.indexedDB) { reject(new Error('no-idb')); return; }
        const req = win.indexedDB.open(CACHE_DB, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(CACHE_STORE)) db.createObjectStore(CACHE_STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('idb-open'));
      } catch (e) { reject(e); }
    });
  }

  /**
   * Build deterministic cache key per spec: sha256 + ladderId + model + promptVersion
   * @param {{ sha256: string, ladderId: string, model: string, promptVersion?: string }} parts
   */
  function cacheKey(parts) {
    return [
      String(parts.sha256 || '').trim(),
      String(parts.ladderId || '').trim(),
      String(parts.model || '').trim(),
      String(parts.promptVersion || PROMPT_VERSION).trim()
    ].join('::');
  }

  /** @param {string} key */
  async function cacheGet(key) {
    if (!key) return null;
    if (memCache.has(key)) return memCache.get(key);
    try {
      const db = await openCacheDB();
      return await new Promise(resolve => {
        const tx = db.transaction(CACHE_STORE, 'readonly');
        const req = tx.objectStore(CACHE_STORE).get(key);
        req.onsuccess = () => {
          const val = req.result || null;
          if (val) memCache.set(key, val);
          resolve(val);
        };
        req.onerror = () => resolve(null);
      });
    } catch (_) { return null; }
  }

  /** @param {string} key @param {any} value */
  async function cacheSet(key, value) {
    if (!key) return false;
    const entry = { ...value, cachedAt: Date.now(), promptVersion: PROMPT_VERSION };
    memCache.set(key, entry);
    try {
      const db = await openCacheDB();
      return await new Promise(resolve => {
        const tx = db.transaction(CACHE_STORE, 'readwrite');
        tx.objectStore(CACHE_STORE).put(entry, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch (_) { return false; }
  }

  async function cacheClear() {
    memCache.clear();
    try {
      const db = await openCacheDB();
      await new Promise(resolve => {
        const tx = db.transaction(CACHE_STORE, 'readwrite');
        tx.objectStore(CACHE_STORE).clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch (_) { /* ignore */ }
  }

  async function cacheCount() {
    try {
      const db = await openCacheDB();
      return await new Promise(resolve => {
        const tx = db.transaction(CACHE_STORE, 'readonly');
        const req = tx.objectStore(CACHE_STORE).count();
        req.onsuccess = () => resolve(req.result || 0);
        req.onerror = () => resolve(memCache.size);
      });
    } catch (_) { return memCache.size; }
  }

  win.AICache = {
    PROMPT_VERSION,
    key: cacheKey,
    get: cacheGet,
    set: cacheSet,
    clear: cacheClear,
    count: cacheCount
  };

  /* ---------- A8 Automatic 1x Retry with Backoff ---------- */
  /**
   * Returns true ONLY for transient retryable errors: timeout, HTTP 429, or network failure.
   * Never retries 400/401/403/404 config errors or explicit user abort.
   * @param {any} err
   */
  function isRetryable(err) {
    if (!err) return false;
    if (err.userCancelled) return false;
    if (err.isTimeout) return true;
    const status = Number(err.httpStatus || 0);
    if (status === 429) return true;
    if (status >= 400 && status < 500) return false;
    const msg = String(err.message || err);
    if (/HTTP\s*429/i.test(msg)) return true;
    if (/HTTP\s*4\d\d/i.test(msg)) return false;
    if (err instanceof TypeError || /network|failed to fetch|timed?\s*out|超时/i.test(msg)) return true;
    return false;
  }

  /**
   * @param {(attempt: number) => Promise<any>} fn
   * @param {{ retryOnce?: boolean, backoffMs?: number, signal?: AbortSignal, onRetry?: (err: any) => void }} [opts]
   */
  async function runWithRetry(fn, opts) {
    const o = opts || {};
    const maxRetries = o.retryOnce ? 1 : 0;
    let attempt = 0;
    while (true) {
      try {
        return await fn(attempt);
      } catch (err) {
        if (attempt >= maxRetries || (o.signal && o.signal.aborted) || !isRetryable(err)) {
          throw err;
        }
        attempt++;
        if (o.onRetry) o.onRetry(err);
        const delay = typeof o.backoffMs === 'number' ? o.backoffMs : 700;
        await new Promise((resolve, reject) => {
          const t = setTimeout(resolve, delay);
          if (o.signal) {
            o.signal.addEventListener('abort', () => { clearTimeout(t); reject(new Error(L('请求已取消', 'Request cancelled'))); }, { once: true });
          }
        });
      }
    }
  }

  win.AIRetry = { isRetryable, runWithRetry };

  /* ---------- A9 Structured Error Diagnosis & Repair Cards ---------- */
  /**
   * Classify an AI error into structured diagnosis + 1-3 actionable repair buttons.
   * @param {any} err
   */
  function classifyError(err) {
    const msg = String(err?.message || err || '');
    const status = Number(err?.httpStatus || (msg.match(/HTTP\s*(\d{3})/i)?.[1] || 0));

    if (status === 401) {
      return {
        code: 'HTTP_401',
        title: L('API 密钥无效或已过期 (HTTP 401)', 'Invalid or expired API key (HTTP 401)'),
        detail: L('请核对服务商控制台中的完整 API Key（无需手动输入 Bearer 前缀或引号）。', 'Check your complete API key in the provider console (no Bearer prefix or quotes needed).'),
        actions: ['open-wizard-key', 'open-settings', 'use-local']
      };
    }
    if (status === 403) {
      return {
        code: 'HTTP_403',
        title: L('账号无权访问该模型或地域不匹配 (HTTP 403)', 'Model access denied or region mismatch (HTTP 403)'),
        detail: L('请确认该 API Key 所在地域与接口地址一致，且已开通视觉模型调用权限。', 'Ensure the API key region matches the endpoint and vision model access is enabled.'),
        actions: ['open-wizard-key', 'use-local']
      };
    }
    if (status === 404) {
      return {
        code: 'HTTP_404',
        title: L('接口地址或视觉模型名不存在 (HTTP 404)', 'Endpoint path or vision model not found (HTTP 404)'),
        detail: L('请检查是否为 OpenAI 兼容 /v1 基址，并核对大小写准确的视觉模型 ID（如 qwen3-vl-plus）。', 'Verify the OpenAI-compatible /v1 base URL and exact vision model ID.'),
        actions: ['open-wizard-key', 'use-local']
      };
    }
    if (status === 429) {
      return {
        code: 'HTTP_429',
        title: L('请求限流或账户余额不足 (HTTP 429)', 'Rate limited or quota exhausted (HTTP 429)'),
        detail: L('系统已自动重试 1 次仍受限。请检查 API 控制台余额/额度，或先改用本地处理。', 'Automatic retry also hit HTTP 429. Check API quota/billing or switch to local processing.'),
        actions: ['retry', 'use-local', 'open-settings']
      };
    }
    if (status >= 500) {
      return {
        code: 'HTTP_5XX',
        title: L(`服务商接口暂时异常 (HTTP ${status})`, `Provider server error (HTTP ${status})`),
        detail: L('这是服务商侧临时故障，可稍后重试，或立即改用本地离线处理。', 'Temporary provider-side failure. Retry shortly or continue offline locally.'),
        actions: ['retry', 'use-local']
      };
    }
    if (err?.isTimeout || /超时|timed?\s*out/i.test(msg)) {
      return {
        code: 'TIMEOUT',
        title: L('AI 响应超时', 'AI request timed out'),
        detail: L('已自动重试 1 次仍未返回。可切换更快的视觉模型，或立即改用本地处理。', 'Timed out even after 1 automatic retry. Try a faster vision model or use local processing.'),
        actions: ['retry', 'use-local', 'open-settings']
      };
    }
    if (err instanceof TypeError || /CORS|跨域|network|failed to fetch/i.test(msg)) {
      return {
        code: 'NETWORK_CORS',
        title: L('网络连接失败或被跨域 (CORS) 拦截', 'Network or CORS connection blocked'),
        detail: L('请检查网络/代理；离线单 HTML 打开时来源为 null，部分中转站不支持浏览器跨域，建议换用支持 CORS 的官方接口或改用本地处理。', 'Check network/proxy. Offline HTML uses a null origin; ensure the endpoint allows browser CORS or switch to local processing.'),
        actions: ['open-wizard-key', 'retry', 'use-local']
      };
    }
    if (/JSON|拒绝|截断|refused|truncated/i.test(msg)) {
      return {
        code: 'BAD_RESPONSE',
        title: L('模型未返回约定的视觉 JSON 格式', 'Model did not return valid vision JSON'),
        detail: L('部分纯文本模型或弱视觉模型无法稳定输出坐标，建议更换推荐的视觉模型后重试。', 'Switch to a recommended vision model or fall back to local processing.'),
        actions: ['open-wizard-key', 'retry', 'use-local']
      };
    }
    return {
      code: 'UNKNOWN',
      title: L('AI 自动处理未完成', 'AI automatic processing did not complete'),
      detail: msg || L('请检查 API 配置，或改用本地离线处理。', 'Check API settings or switch to local offline processing.'),
      actions: ['retry', 'use-local', 'open-settings']
    };
  }

  /**
   * Render structured error card with clickable repair actions.
   * @param {any} err
   * @param {{ onRetry?: () => void, onLocal?: () => void, onWizard?: () => void, onSettings?: () => void }} handlers
   */
  function renderErrorCard(err, handlers) {
    const info = classifyError(err);
    const h = handlers || {};
    const wrap = document.createElement('div');
    wrap.className = 'ai-error-card';
    wrap.dataset.errorCode = info.code;

    const title = document.createElement('div');
    title.className = 'ai-error-card-title';
    title.textContent = info.title;
    wrap.appendChild(title);

    const detail = document.createElement('div');
    detail.className = 'ai-error-card-detail';
    detail.textContent = info.detail;
    wrap.appendChild(detail);

    const actRow = document.createElement('div');
    actRow.className = 'ai-error-card-actions';
    const labels = {
      'open-wizard-key': L('打开配置向导检查', 'Fix in API wizard'),
      'open-settings': L('打开设置', 'Open Settings'),
      'retry': L('立即重试', 'Retry now'),
      'use-local': L('改用本地处理（离线）', 'Use local (offline)')
    };
    for (const act of info.actions) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn sm' + (act === 'use-local' ? ' primary' : '');
      btn.dataset.repairAction = act;
      btn.textContent = labels[act] || act;
      btn.onclick = () => {
        if (act === 'open-wizard-key') {
          if (h.onWizard) h.onWizard();
          else if (win.AIWizard) win.AIWizard.open(3);
        } else if (act === 'open-settings') {
          if (h.onSettings) h.onSettings();
          else if (win.AIClient) win.AIClient.openSettings();
        } else if (act === 'retry' && h.onRetry) {
          h.onRetry();
        } else if (act === 'use-local' && h.onLocal) {
          h.onLocal();
        }
      };
      actRow.appendChild(btn);
    }
    wrap.appendChild(actRow);
    return wrap;
  }

  win.AIError = { classify: classifyError, renderCard: renderErrorCard };
})(window);
