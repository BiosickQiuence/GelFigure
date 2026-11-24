/* Shared AI API settings, provider presets, connection testing, image encoding (with optional >1600px API downsampling),
 * and OpenAI-compatible Vision transport. API credentials never enter App.S, projects, logs, or exported images. */
(function (G) {
  'use strict';
  const A = G.App, L = G.L, $ = id => document.getElementById(id), esc = G.UI.esc;
  const CONFIG = 'gelfig.ai-marker.config', KEY = 'gelfig.ai-marker.key';
  const PROFILES_CONFIG = 'gelfig.ai-marker.profiles', PROFILES_KEYS = 'gelfig.ai-marker.profile-keys';
  const API_MAX_EDGE = 1600;

  const PRESETS = [
    {
      id: 'bailian',
      zh: '阿里云百炼（北京）',
      en: 'Alibaba Cloud Bailian (Beijing)',
      endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      models: ['qwen3-vl-plus', 'qwen4-max']
    },
    {
      id: 'openai',
      zh: 'OpenAI',
      en: 'OpenAI',
      endpoint: 'https://api.openai.com/v1',
      models: ['gpt-6.2-sol', 'gpt-6.2-astra', 'gpt-6.1-terra', 'gpt-6-luna']
    },
    {
      id: 'gemini',
      zh: 'Google Gemini',
      en: 'Google Gemini',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai',
      models: ['gemini-4-hydrogen', 'gemini-3.5-flash-lite']
    },
    {
      id: 'custom',
      zh: '自定义 OpenAI 兼容接口',
      en: 'Custom OpenAI-compatible API',
      endpoint: '',
      models: []
    }
  ];

  let profiles = [];
  let activeProfileId = null;
  let previousProfileId = null;
  let profileSeq = 0;
  let settings = { name: '', endpoint: '', model: '', key: '', remember: false };
  let configured = false;
  let keyVisible = false;
  let testing = null;
  let testPngUrl = null;

  const autoEntry = $('btnAutoFlow');

  function makeProfileId() {
    return 'p_' + Date.now().toString(36) + '_' + (++profileSeq).toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  }

  function hostOf(url) {
    try { return new URL(String(url || '').trim()).host.toLowerCase(); }
    catch (_) { return ''; }
  }

  function sanitizeName(raw) {
    return String(raw || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 80);
  }

  function maskKey(k) {
    const s = String(k || '');
    if (!s) return '';
    if (s.length <= 8) return '••••';
    return s.slice(0, 3) + '…' + s.slice(-4);
  }

  function normalizeBase(url) {
    return String(url || '').trim().replace(/\/+$/, '').replace(/\/chat\/completions$/i, '').replace(/\/+$/, '').toLowerCase();
  }

  function matchPreset(url) {
    const base = normalizeBase(url);
    if (!base) return 'custom';
    const hit = PRESETS.find(p => p.endpoint && normalizeBase(p.endpoint) === base);
    return hit ? hit.id : 'custom';
  }

  function presetById(id) {
    return PRESETS.find(p => p.id === id) || PRESETS[PRESETS.length - 1];
  }

  function providerShortLabel(url) {
    const id = matchPreset(url);
    if (id === 'bailian') return L('阿里云百炼', 'Bailian');
    if (id === 'openai') return 'OpenAI';
    if (id === 'gemini') return 'Gemini';
    return hostOf(url) || L('自定义接口', 'Custom API');
  }

  function uniqueProfileName(base, excludeId = null) {
    const clean = sanitizeName(base) || L('配置', 'Profile');
    const taken = new Set(profiles.filter(p => p.id !== excludeId).map(p => p.name.toLowerCase()));
    if (!taken.has(clean.toLowerCase())) return clean;
    let n = 2;
    while (taken.has(`${clean} (${n})`.toLowerCase())) n++;
    return `${clean} (${n})`.slice(0, 80);
  }

  function defaultProfileName(ep, model, excludeId = null) {
    const m = String(model || '').trim();
    const base = (ep || m)
      ? (m ? `${providerShortLabel(ep)} · ${m}` : providerShortLabel(ep))
      : L('配置', 'Profile');
    return uniqueProfileName(base.slice(0, 72), excludeId);
  }

  function profileById(id) {
    return profiles.find(p => p.id === id) || null;
  }

  function profileSummary(p) {
    return {
      id: p.id,
      name: p.name,
      endpoint: p.endpoint,
      model: p.model,
      remember: !!p.remember,
      hasKey: !!p.key,
      maskedKey: maskKey(p.key),
      active: p.id === activeProfileId
    };
  }

  try {
    const rawProfiles = localStorage.getItem(PROFILES_CONFIG);
    const saved = JSON.parse(localStorage.getItem(CONFIG) || '{}');
    const legacyEp = typeof saved.endpoint === 'string' ? saved.endpoint : '';
    const legacyModel = typeof saved.model === 'string' ? saved.model : '';
    const legacyKey = localStorage.getItem(KEY) || '';
    let storedKeys = {};
    try {
      const parsedKeys = JSON.parse(localStorage.getItem(PROFILES_KEYS) || '{}');
      if (parsedKeys && typeof parsedKeys === 'object' && !Array.isArray(parsedKeys)) storedKeys = parsedKeys;
    } catch (_) { storedKeys = {}; }

    if (rawProfiles) {
      const parsed = JSON.parse(rawProfiles);
      if (parsed && Array.isArray(parsed.items)) {
        const seen = new Set();
        profiles = parsed.items
          .filter(it => it && typeof it === 'object' && typeof it.id === 'string' && it.id && !seen.has(it.id))
          .map(it => {
            seen.add(it.id);
            const ep = typeof it.endpoint === 'string' ? it.endpoint : '';
            const model = typeof it.model === 'string' ? it.model : '';
            const wantRemember = !!it.remember;
            let key = '';
            if (wantRemember) {
              if (typeof storedKeys[it.id] === 'string' && storedKeys[it.id]) key = storedKeys[it.id];
              else if (it.id === parsed.activeId && legacyKey) key = legacyKey;
            }
            return {
              id: it.id,
              name: sanitizeName(it.name) || defaultProfileName(ep, model),
              endpoint: ep,
              model,
              key,
              remember: wantRemember && !!key
            };
          });
        const hit = profiles.find(p => p.id === parsed.activeId) || profiles[0] || null;
        if (hit) {
          activeProfileId = hit.id;
          settings = { name: hit.name, endpoint: hit.endpoint, model: hit.model, key: hit.key, remember: hit.remember };
        }
      }
    } else if (legacyEp || legacyModel || legacyKey) {
      const id = makeProfileId();
      const first = {
        id,
        name: defaultProfileName(legacyEp, legacyModel),
        endpoint: legacyEp,
        model: legacyModel,
        key: legacyKey,
        remember: !!legacyKey
      };
      profiles = [first];
      activeProfileId = id;
      settings = { name: first.name, endpoint: first.endpoint, model: first.model, key: first.key, remember: first.remember };
    }
  } catch (_) { /* Credentials stay in memory when browser storage is unavailable. */ }

  function stripQuotes(s) {
    let out = String(s || '').trim();
    if ((out.startsWith('"') && out.endsWith('"')) || (out.startsWith("'") && out.endsWith("'"))) {
      out = out.slice(1, -1).trim();
    }
    return out;
  }

  function sanitizeKey(raw) {
    const original = String(raw || '');
    let value = original.trim();
    value = stripQuotes(value);
    if (/^bearer\s+/i.test(value)) value = value.replace(/^bearer\s+/i, '').trim();
    value = stripQuotes(value);
    return { value, cleaned: value !== original.trim() };
  }

  function sanitizeEndpoint(raw) {
    const original = String(raw || '');
    const value = stripQuotes(original);
    return { value, cleaned: value !== original.trim() };
  }

  function endpoint(value) {
    let u;
    try { u = new URL(String(value || '').trim()); }
    catch (_) { throw new Error(L('请填写有效的 HTTPS 接口地址', 'Enter a valid HTTPS API address')); }
    if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash) {
      throw new Error(L('接口必须是 HTTPS，且不含用户名、密码、查询参数或片段', 'Use HTTPS without username, password, query parameters or fragment'));
    }
    u.pathname = u.pathname.replace(/\/+$/, '');
    if (!u.pathname.endsWith('/chat/completions')) u.pathname += '/chat/completions';
    return u.href;
  }

  function validateSettings(value) {
    const url = endpoint(value.endpoint);
    if (!value.model || value.model.length > 200 || /[\r\n]/.test(value.model) || !value.key || /[\r\n]/.test(value.key)) {
      throw new Error(L('请填写模型名称和有效密钥', 'Enter a model name and valid key'));
    }
    return { url, model: value.model, key: value.key };
  }

  function updateAutoEntryState() {
    if (!autoEntry) return;
    autoEntry.classList.remove('hidden');
    autoEntry.dataset.ready = configured ? 'true' : 'false';
    const badge = $('autoFlowBadge');
    if (badge) {
      badge.textContent = configured ? L('已就绪', 'Ready') : L('需配置 API', 'API setup');
      badge.classList.toggle('is-ready', configured);
    }
  }

  function setAutoAvailable(available) {
    configured = !!available;
    updateAutoEntryState();
  }

  function settingsStatus(text, error = false, ok = false) {
    const el = $('aiSettingsStatus');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('error', !!error);
    el.classList.toggle('ok', !!ok && !error);
  }

  function persistStorage() {
    // Remove the active legacy secret first: unchecking Remember must never retain an old value.
    localStorage.removeItem(KEY);

    const active = activeProfileId ? profileById(activeProfileId) : null;
    const activeEp = active ? active.endpoint : settings.endpoint;
    const activeModel = active ? active.model : settings.model;
    const activeKey = active ? active.key : settings.key;
    const activeRemember = active ? active.remember : settings.remember;

    if (activeEp || activeModel) {
      localStorage.setItem(CONFIG, JSON.stringify({ endpoint: activeEp, model: activeModel }));
    } else {
      localStorage.removeItem(CONFIG);
    }

    if (profiles.length) {
      const meta = {
        version: 1,
        activeId: activeProfileId,
        items: profiles.map(p => ({
          id: p.id,
          name: p.name,
          endpoint: p.endpoint,
          model: p.model,
          remember: !!(p.remember && p.key)
        }))
      };
      localStorage.setItem(PROFILES_CONFIG, JSON.stringify(meta));
    } else {
      localStorage.removeItem(PROFILES_CONFIG);
    }

    const keyMap = {};
    for (const p of profiles) {
      if (p.remember && p.key) keyMap[p.id] = p.key;
    }
    if (Object.keys(keyMap).length) {
      const serialized = JSON.stringify(keyMap);
      localStorage.setItem(PROFILES_KEYS, serialized);
      if (localStorage.getItem(PROFILES_KEYS) !== serialized) throw new Error('storage');
    } else {
      localStorage.removeItem(PROFILES_KEYS);
      if (localStorage.getItem(PROFILES_KEYS) !== null) throw new Error('storage');
    }

    if (activeRemember && activeKey) {
      localStorage.setItem(KEY, activeKey);
      if (localStorage.getItem(KEY) !== activeKey) throw new Error('storage');
    } else if (localStorage.getItem(KEY) !== null) {
      throw new Error('storage');
    }
  }

  function applySettingsToInputs() {
    if ($('aiProfileName')) $('aiProfileName').value = settings.name || '';
    if ($('aiEndpoint')) $('aiEndpoint').value = settings.endpoint || '';
    if ($('aiModel')) $('aiModel').value = settings.model || '';
    if ($('aiKey')) {
      $('aiKey').value = settings.key || '';
      $('aiKey').type = keyVisible ? 'text' : 'password';
    }
    if ($('aiKeyToggle')) {
      $('aiKeyToggle').setAttribute('aria-pressed', String(keyVisible));
      $('aiKeyToggle').textContent = keyVisible ? L('隐藏', 'Hide') : L('显示', 'Show');
    }
    if ($('aiRemember')) $('aiRemember').checked = !!settings.remember;
    if ($('aiProvider')) $('aiProvider').value = matchPreset(settings.endpoint);
    renderModelChips();
  }

  function saveSettings(opts) {
    const asNew = !!(opts && opts.saveAsNew);
    const cleanEp = sanitizeEndpoint($('aiEndpoint') ? $('aiEndpoint').value : settings.endpoint);
    const cleanKey = sanitizeKey($('aiKey') ? $('aiKey').value : settings.key);
    const model = ($('aiModel') ? $('aiModel').value : settings.model).trim();
    const remember = $('aiRemember') ? $('aiRemember').checked : !!settings.remember;
    const rawName = sanitizeName($('aiProfileName') ? $('aiProfileName').value : settings.name);
    if (cleanEp.cleaned && $('aiEndpoint')) $('aiEndpoint').value = cleanEp.value;
    if (cleanKey.cleaned && $('aiKey')) $('aiKey').value = cleanKey.value;

    const target = (!asNew && activeProfileId) ? profileById(activeProfileId) : null;
    const hasAnyField = !!(rawName || cleanEp.value || model || cleanKey.value);
    let name = rawName;
    if (target) {
      name = rawName || defaultProfileName(cleanEp.value, model, target.id);
      target.name = name;
      target.endpoint = cleanEp.value;
      target.model = model;
      target.key = cleanKey.value;
      target.remember = remember;
    } else if (hasAnyField) {
      name = rawName ? uniqueProfileName(rawName) : defaultProfileName(cleanEp.value, model);
      const created = {
        id: makeProfileId(),
        name,
        endpoint: cleanEp.value,
        model,
        key: cleanKey.value,
        remember
      };
      profiles.push(created);
      activeProfileId = created.id;
      previousProfileId = null;
    }

    const v = { name, endpoint: cleanEp.value, model, key: cleanKey.value, remember };
    settings = v;
    if ($('aiProfileName')) $('aiProfileName').value = name;
    let invalid;
    try { validateSettings(v); } catch (e) { invalid = e.message; }
    setAutoAvailable(!invalid);
    if ($('aiProvider')) {
      $('aiProvider').value = matchPreset(v.endpoint);
      renderModelChips();
    }
    const cleanNote = cleanKey.cleaned || cleanEp.cleaned
      ? L('（已自动清理多余的 Bearer 前缀或引号）', ' (trimmed extra Bearer prefix or quotes)') : '';
    try {
      persistStorage();
      const baseMsg = asNew
        ? (v.remember && v.key
          ? L(`已另存为新配置「${name}」；密钥已记住在当前浏览器`, `Saved as new profile "${name}"; key remembered in this browser`)
          : L(`已另存为新配置「${name}」；密钥仅在当前页面内存中`, `Saved as new profile "${name}"; key stays in this page memory`))
        : (v.remember && v.key
          ? L('配置已保存；密钥已记住在当前浏览器', 'Configuration saved; key remembered in this browser')
          : L('配置已保存；密钥仅在当前页面内存中', 'Configuration saved; key stays in this page memory'));
      settingsStatus(baseMsg + cleanNote, false, !invalid);
    } catch (_) {
      settingsStatus(L('浏览器未能保存配置或密钥；请检查浏览器存储设置。当前页面仍可使用。', 'Browser could not persist configuration or key; check storage settings. This page can still use it.'), true);
    }
    if (invalid) settingsStatus(invalid, true);
    renderProfiles();
    renderConsentBox();
    refreshDataTabInfo();
    G.dispatchEvent(new Event('gelfigure-ai-settings-saved'));
  }

  function saveAsNewProfile() {
    saveSettings({ saveAsNew: true });
    return activeProfileId;
  }

  function saveProfile(opts) {
    if (!opts || typeof opts !== 'object') return null;
    const asNew = !!opts.saveAsNew;
    if (asNew) {
      if (activeProfileId && profileById(activeProfileId)) previousProfileId = activeProfileId;
      activeProfileId = null;
    } else if (opts.id && profileById(opts.id)) {
      activeProfileId = opts.id;
    }
    if (typeof opts.name === 'string') {
      settings.name = opts.name;
      if ($('aiProfileName')) $('aiProfileName').value = opts.name;
    }
    if (typeof opts.endpoint === 'string') {
      settings.endpoint = opts.endpoint;
      if ($('aiEndpoint')) $('aiEndpoint').value = opts.endpoint;
    }
    if (typeof opts.model === 'string') {
      settings.model = opts.model;
      if ($('aiModel')) $('aiModel').value = opts.model;
    }
    if (typeof opts.key === 'string') {
      settings.key = opts.key;
      if ($('aiKey')) $('aiKey').value = opts.key;
    }
    if (typeof opts.remember === 'boolean') {
      settings.remember = opts.remember;
      if ($('aiRemember')) $('aiRemember').checked = opts.remember;
    }
    saveSettings({ saveAsNew: asNew });
    return activeProfileId;
  }

  function selectProfile(id, opts) {
    const target = profileById(id);
    if (!target) return false;
    const changing = activeProfileId !== target.id;
    abortTest();
    if (changing) G.dispatchEvent(new Event('gelfigure-ai-settings-changed'));
    activeProfileId = target.id;
    previousProfileId = null;
    keyVisible = false;
    settings = {
      name: target.name,
      endpoint: target.endpoint,
      model: target.model,
      key: target.key,
      remember: !!target.remember
    };
    applySettingsToInputs();
    let invalid;
    try { validateSettings(settings); } catch (e) { invalid = e.message; }
    setAutoAvailable(!invalid);
    try { persistStorage(); } catch (_) { /* keep in-memory state */ }
    renderProfiles();
    renderConsentBox();
    refreshDataTabInfo();
    if (!opts?.silent) {
      if (!settings.key) {
        settingsStatus(L(`已切换到「${target.name}」；该配置未记住密钥，请填写 API 密钥后保存`, `Switched to "${target.name}"; key is not remembered — enter it and save`), true);
      } else if (invalid) {
        settingsStatus(L(`已切换到「${target.name}」：${invalid}`, `Switched to "${target.name}": ${invalid}`), true);
      } else {
        settingsStatus(L(`已切换到配置「${target.name}」`, `Switched to profile "${target.name}"`), false, true);
      }
    }
    G.dispatchEvent(new Event('gelfigure-ai-settings-saved'));
    return true;
  }

  function startNewProfile() {
    abortTest();
    if (activeProfileId && profileById(activeProfileId)) {
      previousProfileId = activeProfileId;
    }
    activeProfileId = null;
    keyVisible = false;
    settings = { name: '', endpoint: '', model: '', key: '', remember: false };
    applySettingsToInputs();
    renderProfiles();
    renderConsentBox();
    settingsStatus(L('正在新建 API 配置：选择服务商或填写地址、模型与密钥后点击「保存接口配置」。', 'New API profile: pick a provider or enter endpoint, model and key, then click "Save API settings".'));
    ($('aiProfileName') || $('aiEndpoint'))?.focus();
  }

  function cancelNewProfile() {
    const fallbackId = (previousProfileId && profileById(previousProfileId))
      ? previousProfileId
      : (profiles[0]?.id || null);
    previousProfileId = null;
    if (fallbackId) {
      selectProfile(fallbackId, { silent: true });
      settingsStatus(L('已取消新建，返回原配置', 'Cancelled new profile; restored active profile'));
    }
  }

  function deleteProfile(id) {
    const idx = profiles.findIndex(p => p.id === id);
    if (idx < 0) return false;
    const removed = profiles[idx];
    const wasActive = activeProfileId === id;
    profiles.splice(idx, 1);
    if (previousProfileId === id) previousProfileId = null;

    if (wasActive) {
      abortTest();
      G.dispatchEvent(new Event('gelfigure-ai-settings-changed'));
      const next = profiles[Math.min(idx, profiles.length - 1)] || null;
      keyVisible = false;
      if (next) {
        activeProfileId = next.id;
        settings = { name: next.name, endpoint: next.endpoint, model: next.model, key: next.key, remember: !!next.remember };
      } else {
        activeProfileId = null;
        settings = { name: '', endpoint: '', model: '', key: '', remember: false };
      }
      applySettingsToInputs();
      let invalid;
      try { validateSettings(settings); } catch (e) { invalid = e.message; }
      setAutoAvailable(!invalid);
    }
    try { persistStorage(); } catch (_) { /* ignore */ }
    renderProfiles();
    renderConsentBox();
    refreshDataTabInfo();
    settingsStatus(
      wasActive && activeProfileId
        ? L(`已删除配置「${removed.name}」，已切换到「${settings.name}」`, `Deleted profile "${removed.name}"; switched to "${settings.name}"`)
        : L(`已删除配置「${removed.name}」`, `Deleted profile "${removed.name}"`)
    );
    G.dispatchEvent(new Event('gelfigure-ai-settings-saved'));
    return true;
  }

  function abortTest() {
    if (!testing) return;
    testing.controller.abort();
    clearTimeout(testing.timer);
    testing = null;
    if ($('aiTestSettings')) $('aiTestSettings').disabled = false;
  }

  function clearKey() {
    abortTest();
    setAutoAvailable(false);
    G.dispatchEvent(new Event('gelfigure-ai-settings-changed'));
    settings.key = '';
    settings.remember = false;
    const active = activeProfileId ? profileById(activeProfileId) : null;
    if (active) {
      active.key = '';
      active.remember = false;
    }
    if ($('aiKey')) $('aiKey').value = '';
    if ($('aiRemember')) $('aiRemember').checked = false;
    try {
      persistStorage();
      if (localStorage.getItem(KEY) !== null) throw new Error('storage');
      settingsStatus(L('已清除当前配置在此页面和此浏览器保存的密钥', 'Key cleared for this profile from this page and browser'));
    } catch (_) {
      settingsStatus(L('当前页面密钥已清除；无法确认浏览器存储已清除，请在浏览器设置中清除此页面的数据', 'Page key cleared; browser storage removal could not be verified. Clear this page’s data in browser settings.'), true);
    }
    renderProfiles();
    refreshDataTabInfo();
  }

  function clearAllKeys() {
    abortTest();
    setAutoAvailable(false);
    G.dispatchEvent(new Event('gelfigure-ai-settings-changed'));
    for (const p of profiles) {
      p.key = '';
      p.remember = false;
    }
    settings.key = '';
    settings.remember = false;
    if ($('aiKey')) $('aiKey').value = '';
    if ($('aiRemember')) $('aiRemember').checked = false;
    try {
      persistStorage();
      localStorage.removeItem(KEY);
      localStorage.removeItem(PROFILES_KEYS);
      if (localStorage.getItem(KEY) !== null || localStorage.getItem(PROFILES_KEYS) !== null) throw new Error('storage');
      settingsStatus(L('已清除所有配置的页面及本地保存密钥', 'Cleared all remembered and in-memory API keys'));
      G.UI?.toast?.(L('已清除所有本地保存的 API 密钥', 'Cleared all locally stored API keys'));
    } catch (_) {
      settingsStatus(L('当前页面密钥已清除；无法确认浏览器存储已全部清除', 'Page keys cleared; full browser storage removal could not be verified'), true);
    }
    renderProfiles();
    refreshDataTabInfo();
    G.dispatchEvent(new Event('gelfigure-ai-settings-saved'));
  }

  function checkedAPISettings() {
    saveSettings();
    return validateSettings(settings);
  }

  function describeHttpError(status) {
    if (status === 401) return L('HTTP 401：API 密钥无效或已过期，请检查密钥（无需手写 Bearer 前缀）。未重试。', 'HTTP 401: invalid or expired API key (no Bearer prefix needed). No retry was made.');
    if (status === 403) return L('HTTP 403：无权访问该模型或所在地区受限，请核对账号权限与模型名。未重试。', 'HTTP 403: access denied or region restricted; check account permissions and model name. No retry was made.');
    if (status === 404) return L('HTTP 404：接口路径或模型名称不存在，请检查基址与视觉模型名。未重试。', 'HTTP 404: endpoint path or model name not found; check base URL and vision model name. No retry was made.');
    if (status === 429) return L('HTTP 429：请求过于频繁或账号余额不足，请检查额度后稍后再试。未重试。', 'HTTP 429: rate limited or insufficient quota; check billing and try again later. No retry was made.');
    if (status >= 500) return L(`HTTP ${status}：服务商接口暂时异常，请稍后再试。未重试。`, `HTTP ${status}: provider server error; try again later. No retry was made.`);
    return L(`接口返回 HTTP ${status}；请检查地址、权限、额度和模型。未重试。`, `API returned HTTP ${status}; check address, access, quota and model. No retry was made.`);
  }

  async function responseJSON(res) {
    if (!res.body || typeof res.body.getReader !== 'function') {
      const text = await res.text();
      if (text.length > 2 * 1024 * 1024) throw new Error(L('接口响应超过 2 MB', 'API response exceeds 2 MB'));
      try { return JSON.parse(text); }
      catch (_) { throw new Error(L('接口未返回有效 JSON', 'API did not return valid JSON')); }
    }
    const reader = res.body.getReader(), chunks = [];
    let n = 0;
    try {
      while (true) {
        const r = await reader.read();
        if (r.done) break;
        n += r.value.length;
        if (n > 2 * 1024 * 1024) { await reader.cancel(); throw new Error('size'); }
        chunks.push(r.value);
      }
    } catch (err) {
      if (err && (err.name === 'AbortError' || err.isTimeout)) throw err;
      throw new Error(L('接口响应读取失败或超过 2 MB', 'API response could not be read or exceeds 2 MB'));
    }
    const bytes = new Uint8Array(n);
    let p = 0;
    for (const chunk of chunks) { bytes.set(chunk, p); p += chunk.length; }
    try { return JSON.parse(new TextDecoder().decode(bytes)); }
    catch (_) { throw new Error(L('接口未返回有效 JSON', 'API did not return valid JSON')); }
  }

  async function callVision(body, signal, cfg) {
    const res = await fetch(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.key },
      body: JSON.stringify({ ...body, model: cfg.model }),
      signal,
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
      referrerPolicy: 'no-referrer'
    });
    if (!res.ok) {
      const err = new Error(describeHttpError(res.status));
      err.httpStatus = res.status;
      throw err;
    }
    const data = await responseJSON(res), choice = data?.choices?.[0];
    if (choice?.finish_reason !== 'stop' || choice?.message?.refusal || typeof choice?.message?.content !== 'string') {
      throw new Error(L('接口拒绝、截断或未返回完整文本结果', 'API refused, truncated or did not return a complete text result'));
    }
    const raw = choice.message.content.trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/, '$1');
    try { return JSON.parse(raw); }
    catch (_) { throw new Error(L('AI 返回的内容不是约定的 JSON 对象', 'AI content is not the required JSON object')); }
  }

  function requestVision(spec, signal) {
    const cfg = checkedAPISettings();
    const imgUrl = spec.image.apiUrl || spec.image.url;
    return callVision({
      stream: false,
      messages: [
        { role: 'system', content: spec.instruction },
        {
          role: 'user',
          content: [
            { type: 'text', text: JSON.stringify(spec.input) },
            { type: 'image_url', image_url: { url: imgUrl, detail: 'high' } }
          ]
        }
      ]
    }, signal, cfg);
  }

  function tinyTestPng() {
    if (testPngUrl) return testPngUrl;
    const c = document.createElement('canvas');
    c.width = 16; c.height = 16;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(3, 6, 10, 4);
    testPngUrl = c.toDataURL('image/png');
    return testPngUrl;
  }

  async function testConnection() {
    abortTest();
    let cfg;
    try { cfg = checkedAPISettings(); }
    catch (e) { settingsStatus(e.message, true); return; }
    const controller = new AbortController();
    const currentTest = { controller, timedOut: false, timer: 0 };
    currentTest.timer = setTimeout(() => { currentTest.timedOut = true; controller.abort(); }, 20000);
    testing = currentTest;
    if ($('aiTestSettings')) $('aiTestSettings').disabled = true;
    settingsStatus(L('正在发送 16×16 测试图验证连通性…', 'Sending a 16×16 test image to verify connectivity…'));
    const t0 = performance.now();
    try {
      const res = await fetch(cfg.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.key },
        body: JSON.stringify({
          model: cfg.model,
          stream: false,
          max_tokens: 32,
          messages: [
            { role: 'system', content: 'Reply with {"ok":true} only.' },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Connection check' },
                { type: 'image_url', image_url: { url: tinyTestPng(), detail: 'low' } }
              ]
            }
          ]
        }),
        signal: controller.signal,
        credentials: 'omit',
        redirect: 'error',
        cache: 'no-store',
        referrerPolicy: 'no-referrer'
      });
      if (testing !== currentTest) return;
      if (!res.ok) throw new Error(describeHttpError(res.status));
      const data = await responseJSON(res);
      if (testing !== currentTest) return;
      if (!data?.choices?.length) {
        throw new Error(L('接口已响应，但返回结构不符合 OpenAI 兼容格式', 'API responded, but the response does not match OpenAI-compatible format'));
      }
      const ms = Math.max(1, Math.round(performance.now() - t0));
      settingsStatus(L(`连接成功（${ms} ms），视觉接口与模型可用。`, `Connected (${ms} ms); vision API and model responded.`), false, true);
    } catch (err) {
      if (testing !== currentTest) return;
      const msg = currentTest.timedOut
        ? L('连接测试超时（20 秒），请检查网络或接口地址。', 'Connection test timed out after 20 seconds; check network or endpoint.')
        : err instanceof TypeError || err?.name === 'AbortError'
          ? L('连接失败：网络、CORS 跨域或证书受阻（离线单文件来源为 null，接口须允许跨域）。', 'Connection failed: network, CORS or certificate error (offline HTML has a null origin; API must allow CORS).')
          : err.message;
      settingsStatus(msg, true);
    } finally {
      clearTimeout(currentTest.timer);
      if (testing === currentTest) testing = null;
      if ($('aiTestSettings')) $('aiTestSettings').disabled = false;
    }
  }

  function encodeImage(rot, rgb, rotation = 0) {
    if (rot.w < 2 || rot.h < 2) throw new Error(L('图像尺寸过小', 'Image is too small'));
    const c = document.createElement('canvas');
    c.width = rot.w; c.height = rot.h;
    const pixels = rgb ? G.Colour.toImageData(rgb, rot.w, rot.h, rotation) : G.Engine.toImageData(rot, { black: 0, white: 1, gamma: 1, invert: false });
    c.getContext('2d').putImageData(pixels, 0, 0);
    const url = c.toDataURL('image/png');
    const urlBytes = Math.floor((url.length - url.indexOf(',') - 1) * 3 / 4);
    if (!url.startsWith('data:image/png;base64,') || urlBytes > 32 * 1024 * 1024) {
      throw new Error(L('完整分析图无法编码或超过 32 MB；请使用尺寸较小的输入图后重试', 'Full analysis image could not be encoded or exceeds 32 MB; use a smaller input image'));
    }
    const maxEdge = Math.max(c.width, c.height);
    let apiWidth = c.width, apiHeight = c.height, apiUrl = url, downsampled = false;
    if (maxEdge > API_MAX_EDGE) {
      const scale = API_MAX_EDGE / maxEdge;
      apiWidth = Math.max(2, Math.round(c.width * scale));
      apiHeight = Math.max(2, Math.round(c.height * scale));
      const small = document.createElement('canvas');
      small.width = apiWidth; small.height = apiHeight;
      const ctx = small.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(c, 0, 0, apiWidth, apiHeight);
      const smallUrl = small.toDataURL('image/png');
      if (smallUrl.startsWith('data:image/png;base64,')) {
        apiUrl = smallUrl;
        downsampled = true;
      } else {
        apiWidth = c.width; apiHeight = c.height;
      }
    }
    return { width: c.width, height: c.height, url, apiWidth, apiHeight, apiUrl, downsampled, colour: !!rgb };
  }

  function analysisImage() {
    if (!A.S) throw new Error(L('请先导入胶图', 'Import a gel first'));
    return encodeImage(A.ensureRot(), A.sourceRGB, A.S.rotation);
  }

  /* ---------- Settings panel UI ---------- */
  const settingsPanel = document.createElement('aside');
  settingsPanel.id = 'aiSettingsPanel';
  settingsPanel.className = 'ai-settings hidden';
  settingsPanel.setAttribute('role', 'region');
  settingsPanel.setAttribute('aria-labelledby', 'aiSettingsTitle');
  document.body.appendChild(settingsPanel);

  function placeAutoEntry() {
    if (!autoEntry) return;
    const home = settingsPanel.classList.contains('hidden') ? $('autoFlowHome') : $('aiAutoSlot');
    if (home) home.appendChild(autoEntry);
  }

  function renderModelChips() {
    const host = $('aiModelPresets');
    if (!host) return;
    const providerId = $('aiProvider') ? $('aiProvider').value : matchPreset($('aiEndpoint')?.value || '');
    const preset = presetById(providerId);
    const currentModel = $('aiModel') ? $('aiModel').value.trim() : '';
    if (!preset.models.length) {
      host.innerHTML = '';
      host.classList.add('hidden');
      return;
    }
    host.classList.remove('hidden');
    host.innerHTML = `<span class="ai-chip-label">${L('推荐模型：', 'Recommended:')}</span>` +
      preset.models.map(m => `<button type="button" class="ai-model-chip${currentModel === m ? ' on' : ''}" data-model-chip="${esc(m)}">${esc(m)}</button>`).join('');
    host.querySelectorAll('[data-model-chip]').forEach(btn => {
      btn.onclick = () => {
        $('aiModel').value = btn.dataset.modelChip;
        $('aiModel').dispatchEvent(new Event('input', { bubbles: true }));
        renderModelChips();
      };
    });
  }

  function onSettingsInput() {
    abortTest();
    setAutoAvailable(false);
    G.dispatchEvent(new Event('gelfigure-ai-settings-changed'));
  }

  function renderProfiles() {
    const host = $('aiProfilesSection');
    if (!host) return;
    const isNewDraft = activeProfileId === null && profiles.length > 0;
    const listHtml = profiles.length
      ? `<div id="aiProfilesList" class="ai-profiles-list" role="list">${profiles.map(p => {
          const isAct = p.id === activeProfileId;
          const badgeClass = p.remember && p.key ? 'is-saved' : p.key ? 'is-session' : 'is-missing';
          const badgeText = p.remember && p.key
            ? `${L('已记住', 'Saved')} · ${maskKey(p.key)}`
            : p.key
              ? `${L('仅本次页面', 'Session')} · ${maskKey(p.key)}`
              : L('未填密钥', 'No key');
          const epMeta = hostOf(p.endpoint) || p.endpoint || L('未填地址', 'No endpoint');
          const metaText = p.model ? `${epMeta} · ${p.model}` : epMeta;
          return `<div class="ai-profile-item${isAct ? ' is-active' : ''}" role="listitem" data-profile-id="${esc(p.id)}">
            <button type="button" class="ai-profile-select" data-profile-select="${esc(p.id)}" aria-pressed="${isAct}">
              <span class="ai-profile-dot" aria-hidden="true"></span>
              <span class="ai-profile-main">
                <span class="ai-profile-top">
                  <strong class="ai-profile-name">${esc(p.name)}</strong>
                  <span class="ai-profile-badge ${badgeClass}">${esc(badgeText)}</span>
                </span>
                <span class="ai-profile-meta">${esc(metaText)}</span>
              </span>
            </button>
            <button type="button" class="btn sm ghost ai-profile-del" data-profile-delete="${esc(p.id)}" title="${L('删除此配置', 'Delete this profile')}" aria-label="${esc(L(`删除配置 ${p.name}`, `Delete profile ${p.name}`))}">${L('删除', 'Delete')}</button>
          </div>`;
        }).join('')}</div>`
      : `<div class="ai-profiles-empty">${L('尚未保存配置；填写下方信息保存后，可随时新建并一键切换多个服务商或 API 密钥。', 'No saved profiles yet. Save below, then add and switch between multiple providers or API keys anytime.')}</div>`;

    host.innerHTML = `<div class="ai-profiles-head">
        <span class="ai-profiles-title">${L(`已保存的 API 配置（${profiles.length}）`, `Saved API profiles (${profiles.length})`)}</span>
        <div class="ai-profiles-head-actions">
          ${isNewDraft ? `<button type="button" id="aiProfileCancelNew" class="btn sm ghost">${L('取消新建', 'Cancel')}</button>` : ''}
          <button type="button" id="aiProfileNew" class="btn sm${isNewDraft ? ' on' : ''}">${L('+ 新建配置', '+ New profile')}</button>
        </div>
      </div>
      ${listHtml}
      ${isNewDraft ? `<div class="ai-profile-draft-note">${L('正在新建配置：填写下方信息并点击「保存接口配置」后将添加到列表。', 'Creating a new profile: fill in the form below and click "Save API settings" to add it.')}</div>` : ''}`;

    const newBtn = $('aiProfileNew');
    if (newBtn) newBtn.onclick = startNewProfile;
    const cancelBtn = $('aiProfileCancelNew');
    if (cancelBtn) cancelBtn.onclick = cancelNewProfile;
    host.querySelectorAll('[data-profile-select]').forEach(btn => {
      btn.onclick = () => selectProfile(btn.dataset.profileSelect);
    });
    host.querySelectorAll('[data-profile-delete]').forEach(btn => {
      btn.onclick = e => {
        e.stopPropagation();
        deleteProfile(btn.dataset.profileDelete);
      };
    });

    const saveAsNewBtn = $('aiSaveAsNew');
    if (saveAsNewBtn) saveAsNewBtn.classList.toggle('hidden', activeProfileId === null);
  }

  function renderConsentBox() {
    const box = $('settingsConsentBox');
    if (!box) return;
    const ep = ($('aiEndpoint') ? $('aiEndpoint').value : settings.endpoint).trim();
    const consentRec = G.AIConsent?.infoFor ? G.AIConsent.infoFor(ep) : G.AIConsent?.info;
    const consentedForEp = !!G.AIConsent?.isConsented(ep);
    box.innerHTML = `<div>
        <strong>${L('拖图自动 AI 隐私同意', 'Drop-to-start AI privacy consent')}</strong>
        <div style="color:var(--muted);margin-top:2px;">
          ${consentedForEp && consentRec
            ? L(`已同意向 ${esc(consentRec.host)} 发送 ≤1600 px 分析图（${esc(consentRec.acceptedAt.slice(0, 10))}）`, `Consented to send ≤1600 px analysis PNG to ${esc(consentRec.host)} (${esc(consentRec.acceptedAt.slice(0, 10))})`)
            : L('尚未同意向当前接口自动上传；拖入胶图时将默认使用本地识别。', 'Not consented for this endpoint; dropped images use offline local detection.')}
        </div>
      </div>
      <button type="button" class="btn sm${consentedForEp ? '' : ' primary'}" id="btnToggleAIConsent">
        ${consentedForEp ? L('撤回同意', 'Revoke') : L('同意并启用', 'Consent & enable')}
      </button>`;
    const toggleBtn = $('btnToggleAIConsent');
    if (toggleBtn) {
      toggleBtn.onclick = () => {
        const curEp = ($('aiEndpoint') ? $('aiEndpoint').value : settings.endpoint).trim();
        if (G.AIConsent?.isConsented(curEp)) {
          G.AIConsent.revoke(curEp);
        } else {
          saveSettings();
          const savedEp = ($('aiEndpoint') ? $('aiEndpoint').value : settings.endpoint).trim();
          if (!savedEp) { settingsStatus(L('请先填写 HTTPS 接口地址', 'Enter an HTTPS endpoint first'), true); return; }
          G.AIConsent?.grant(savedEp);
        }
        renderConsentBox();
      };
    }
  }

  function refreshDataTabInfo() {
    const info = $('settingsProfilesInfo');
    const clearBtn = $('btnClearAllAIKeys');
    const rememberedCount = profiles.filter(p => p.remember && p.key).length;
    const anyKeyCount = profiles.filter(p => !!p.key).length + (!activeProfileId && settings.key ? 1 : 0);
    if (info) {
      info.textContent = L(
        `已保存 ${profiles.length} 个配置，其中 ${rememberedCount} 个已在本浏览器记住密钥。`,
        `${profiles.length} saved profile(s), ${rememberedCount} key(s) remembered in this browser.`
      );
    }
    if (clearBtn) clearBtn.disabled = anyKeyCount === 0 && rememberedCount === 0;
  }

  let activeSettingsTab = 'ai';

  function buildSettings() {
    if ($('aiEndpoint')) {
      settings = {
        name: $('aiProfileName')?.value ?? settings.name,
        endpoint: $('aiEndpoint').value,
        model: $('aiModel')?.value ?? settings.model,
        key: $('aiKey')?.value ?? settings.key,
        remember: $('aiRemember')?.checked ?? settings.remember
      };
    }
    if (autoEntry && $('autoFlowHome')) $('autoFlowHome').appendChild(autoEntry);
    const matched = matchPreset(settings.endpoint);
    const curDefaultLadder = A.prefs().autoFlowLadder || '';
    const hasLabTpl = !!A.prefs().stylePreset;
    settingsPanel.classList.add('settings-center');
    settingsPanel.innerHTML = `<div class="dlg-head" style="padding:14px 18px;margin:0;border-bottom:1px solid var(--line);">
        <h2 id="aiSettingsTitle" style="margin:0;font-size:16px;">${L('设置中心', 'Settings Center')}</h2>
        <div style="display:flex;gap:8px;align-items:center;">
          <button type="button" class="btn sm ghost" id="btnOpenWizardFromSettings">${L('打开 4 步配置向导', 'Open 4-step wizard')}</button>
          <button class="btn sm" id="aiSettingsClose">${L('收起', 'Close')}</button>
        </div>
      </div>
      <div class="settings-tabs" role="tablist">
        <button type="button" class="settings-tab${activeSettingsTab === 'ai' ? ' on' : ''}" data-stab="ai" role="tab">${L('AI 接口与隐私', 'AI API & Privacy')}</button>
        <button type="button" class="settings-tab${activeSettingsTab === 'marker' ? ' on' : ''}" data-stab="marker" role="tab">${L('默认 Marker', 'Default Marker')}</button>
        <button type="button" class="settings-tab${activeSettingsTab === 'layout' ? ' on' : ''}" data-stab="layout" role="tab">${L('实验室默认版式', 'Lab Layout')}</button>
        <button type="button" class="settings-tab${activeSettingsTab === 'lang' ? ' on' : ''}" data-stab="lang" role="tab">${L('语言', 'Language')}</button>
        <button type="button" class="settings-tab${activeSettingsTab === 'data' ? ' on' : ''}" data-stab="data" role="tab">${L('数据与缓存', 'Data & Cache')}</button>
      </div>
      <div class="settings-body">
        <div class="settings-pane${activeSettingsTab === 'ai' ? '' : ' hidden'}" data-spane="ai">
          <div id="aiProfilesSection" class="ai-profiles-section"></div>
          <div class="ai-config">
            <label>${L('配置名称（可选，便于多配置切换）', 'Profile name (optional, for quick switching)')}<input id="aiProfileName" type="text" maxlength="80" placeholder="${L('例如：阿里云百炼主力 / 课题组 OpenAI', 'e.g. Bailian Main / Lab OpenAI')}" autocomplete="off" spellcheck="false"></label>
            <label>${L('服务商预设', 'Provider preset')}<select id="aiProvider">${PRESETS.map(p => `<option value="${p.id}"${p.id === matched ? ' selected' : ''}>${esc(L(p.zh, p.en))}</option>`).join('')}</select></label>
            <label>${L('接口地址（HTTPS 基址或完整 /chat/completions）', 'API address (HTTPS base or full /chat/completions)')}<input id="aiEndpoint" type="text" placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1" autocomplete="off" spellcheck="false"></label>
            <label>${L('视觉模型名称', 'Vision model name')}<input id="aiModel" type="text" placeholder="qwen3-vl-plus" autocomplete="off" spellcheck="false"></label>
            <div id="aiModelPresets" class="ai-model-chips hidden"></div>
            <label>${L('API 密钥', 'API key')}<div class="ai-key-wrap"><input id="aiKey" type="${keyVisible ? 'text' : 'password'}" autocomplete="off" spellcheck="false"><button type="button" id="aiKeyToggle" class="btn sm ghost" aria-pressed="${keyVisible}" title="${L('显示或隐藏密钥', 'Show or hide key')}">${keyVisible ? L('隐藏', 'Hide') : L('显示', 'Show')}</button></div></label>
          </div>
          <div class="actions">
            <label><input type="checkbox" id="aiRemember">${L('在当前浏览器记住此配置的密钥（本地明文存储）', 'Remember this profile’s key in this browser (local plaintext storage)')}</label>
            <button id="aiSaveSettings" class="btn sm primary">${L('保存接口配置', 'Save API settings')}</button>
            <button type="button" id="aiSaveAsNew" class="btn sm${activeProfileId === null ? ' hidden' : ''}">${L('另存为新配置', 'Save as new')}</button>
            <button id="aiTestSettings" class="btn sm">${L('测试连接', 'Test connection')}</button>
            <button id="aiClearKey" class="btn sm">${L('清除密钥', 'Clear key')}</button>
          </div>
          <div class="settings-consent-box" id="settingsConsentBox"></div>
          <p class="hint">${L('仅在你点击“测试连接”、复核发送或同意启用拖图 AI 时才联网；大图分析副本会自动等比缩放到长边 ≤ 1600 px 以提速，本地出图仍保持 100% 原始分辨率。', 'Network calls happen only on explicit Test, Review Send, or consented Auto Flow. Large images scale to ≤ 1600 px for API speed while local exports remain full resolution.')}</p>
          <p id="aiSettingsStatus" role="status"></p>
          <div id="aiAutoSlot"></div>
        </div>

        <div class="settings-pane${activeSettingsTab === 'marker' ? '' : ' hidden'}" data-spane="marker">
          <label style="display:block;font-size:12.5px;font-weight:600;margin-bottom:6px;">${L('默认 AI Marker 型号（拖图即用）', 'Default AI Marker model (used on drop)')}</label>
          <select id="settingsDefaultLadder" style="width:100%;margin-bottom:10px;">
            <option value="">${L('每次拖图时询问', 'Ask on drop')}</option>
            ${['dna', 'protein'].map(kind => {
              const list = G.Ladders?.ordered ? G.Ladders.ordered(kind) : [];
              return `<optgroup label="${kind === 'dna' ? 'DNA (bp)' : L('蛋白 (kDa)', 'Protein (kDa)')}">${list.map(l => `<option value="${esc(l.id)}"${l.id === curDefaultLadder ? ' selected' : ''}>${G.Ladders.isFavorite(l.id) ? '★ ' : ''}${esc(l.name)}</option>`).join('')}</optgroup>`;
            }).join('')}
          </select>
          <p class="hint">${L('设置默认型号后，拖入胶图可直接启动 AI 全自动；也可以在欢迎页随时点击「更改」切换。', 'With a default model set, dropping a gel starts AI auto-flow immediately.')}</p>
        </div>

        <div class="settings-pane${activeSettingsTab === 'layout' ? '' : ' hidden'}" data-spane="layout">
          <p style="font-size:13px;margin:0 0 10px;">${hasLabTpl ? L('已保存本实验室默认版式模板（新导入的胶图会自动套用字号、字体与栏宽）。', 'A lab default appearance template is active for new imports.') : L('尚未设置实验室默认版式。编辑好一张图后可点击下方按钮保存当前版式。', 'No lab default appearance saved yet.')}</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button type="button" class="btn sm primary" id="btnSettingsSaveLabTpl" ${A.S ? '' : 'disabled'}>${L('将当前图版式设为实验室默认', 'Save current appearance as lab default')}</button>
            <button type="button" class="btn sm" id="btnSettingsClearLabTpl" ${hasLabTpl ? '' : 'disabled'}>${L('清除默认版式', 'Clear lab default')}</button>
          </div>
        </div>

        <div class="settings-pane${activeSettingsTab === 'lang' ? '' : ' hidden'}" data-spane="lang">
          <p style="font-size:13px;margin:0 0 10px;">${L('界面语言 / Interface language', 'Interface language / 界面语言')}</p>
          <div style="display:flex;gap:8px;">
            <button type="button" class="btn sm${G.I18N.lang === 'zh' ? ' primary' : ''}" id="btnSetLangZh">简体中文</button>
            <button type="button" class="btn sm${G.I18N.lang === 'en' ? ' primary' : ''}" id="btnSetLangEn">English</button>
          </div>
        </div>

        <div class="settings-pane${activeSettingsTab === 'data' ? '' : ' hidden'}" data-spane="data">
          <div class="settings-consent-box" style="margin-top:0;">
            <div>
              <strong>${L('AI 识别结果缓存 (IndexedDB)', 'AI Result Cache (IndexedDB)')}</strong>
              <div id="settingsCacheInfo" style="color:var(--muted);margin-top:2px;">${L('正在读取缓存统计…', 'Checking cache…')}</div>
            </div>
            <button type="button" class="btn sm" id="btnClearAICache">${L('清空 AI 缓存', 'Clear AI cache')}</button>
          </div>
          <div class="settings-consent-box">
            <div>
              <strong>${L('已保存的 API 密钥配置', 'Saved API Key Profiles')}</strong>
              <div id="settingsProfilesInfo" style="color:var(--muted);margin-top:2px;"></div>
            </div>
            <button type="button" class="btn sm" id="btnClearAllAIKeys">${L('清除全部本地密钥', 'Clear all local keys')}</button>
          </div>
          <div class="settings-consent-box">
            <div>
              <strong>${L('本机历史项目', 'Local Project History')}</strong>
              <div style="color:var(--muted);margin-top:2px;">${L('按原图 SHA-256 自动合并；示例图不写入历史。', 'Merged by original SHA-256; demo gels excluded.')}</div>
            </div>
            <button type="button" class="btn sm" id="btnSettingsOpenHistory">${L('管理历史项目', 'Manage history')}</button>
          </div>
        </div>
      </div>`;
    $('aiProfileName').value = settings.name || '';
    $('aiEndpoint').value = settings.endpoint;
    $('aiModel').value = settings.model;
    $('aiKey').value = settings.key;
    $('aiRemember').checked = settings.remember;
    renderProfiles();
    renderConsentBox();
    renderModelChips();
    refreshDataTabInfo();
    placeAutoEntry();
    updateAutoEntryState();

    const refreshCacheInfo = () => {
      if (!G.AICache) return;
      G.AICache.count().then(n => {
        const info = $('settingsCacheInfo');
        if (info) info.textContent = L(`当前缓存 ${n} 条 AI 结果（按原图 SHA-256 + 型号 + 模型 + 提示词版本索引）`, `${n} cached AI result(s) (indexed by SHA-256 + ladder + model + prompt version)`);
      });
    };
    if (activeSettingsTab === 'data') { refreshCacheInfo(); refreshDataTabInfo(); }

    // Tab switching
    settingsPanel.querySelectorAll('[data-stab]').forEach(tab => {
      tab.onclick = () => {
        activeSettingsTab = tab.dataset.stab;
        settingsPanel.querySelectorAll('[data-stab]').forEach(t => t.classList.toggle('on', t.dataset.stab === activeSettingsTab));
        settingsPanel.querySelectorAll('[data-spane]').forEach(p => p.classList.toggle('hidden', p.dataset.spane !== activeSettingsTab));
        if (activeSettingsTab === 'data') { refreshCacheInfo(); refreshDataTabInfo(); }
      };
    });

    $('btnOpenWizardFromSettings').onclick = () => { closeSettings(); G.AIWizard?.open(1); };
    const defLadSel = $('settingsDefaultLadder');
    if (defLadSel) defLadSel.onchange = () => {
      A.setPref('autoFlowLadder', defLadSel.value);
      G.WelcomeAI?.render?.();
    };
    const saveLabBtn = $('btnSettingsSaveLabTpl');
    if (saveLabBtn) saveLabBtn.onclick = () => { $('btnLabDefault')?.click(); buildSettings(); };
    const clrLabBtn = $('btnSettingsClearLabTpl');
    if (clrLabBtn) clrLabBtn.onclick = () => { $('btnClearLabDefault')?.click(); buildSettings(); };
    if ($('btnSetLangZh')) $('btnSetLangZh').onclick = () => G.I18N.set('zh');
    if ($('btnSetLangEn')) $('btnSetLangEn').onclick = () => G.I18N.set('en');
    if ($('btnClearAICache')) $('btnClearAICache').onclick = async () => {
      if (G.AICache) await G.AICache.clear();
      const info = $('settingsCacheInfo');
      if (info) info.textContent = L('已清空全部 AI 缓存（0 条）', 'AI cache cleared (0 entries)');
      G.UI?.toast?.(L('已清空 AI 结果缓存', 'AI result cache cleared'));
    };
    if ($('btnClearAllAIKeys')) $('btnClearAllAIKeys').onclick = clearAllKeys;
    if ($('btnSettingsOpenHistory')) $('btnSettingsOpenHistory').onclick = () => {
      closeSettings();
      ($('btnHistory') || $('cacheStatus'))?.click();
    };

    $('aiProvider').onchange = () => {
      const preset = presetById($('aiProvider').value);
      if (preset.endpoint) {
        $('aiEndpoint').value = preset.endpoint;
        const curModel = $('aiModel').value.trim();
        const isOtherPresetModel = PRESETS.some(p => p.models.includes(curModel));
        if (preset.models.length && (!curModel || isOtherPresetModel)) {
          $('aiModel').value = preset.models[0];
        }
        onSettingsInput();
        renderConsentBox();
      }
      renderModelChips();
    };
    $('aiSaveSettings').onclick = () => saveSettings();
    if ($('aiSaveAsNew')) $('aiSaveAsNew').onclick = () => saveAsNewProfile();
    $('aiTestSettings').onclick = testConnection;
    $('aiClearKey').onclick = clearKey;
    $('aiRemember').onchange = () => saveSettings();
    $('aiKeyToggle').onclick = () => {
      keyVisible = !keyVisible;
      $('aiKey').type = keyVisible ? 'text' : 'password';
      $('aiKeyToggle').setAttribute('aria-pressed', String(keyVisible));
      $('aiKeyToggle').textContent = keyVisible ? L('隐藏', 'Hide') : L('显示', 'Show');
    };
    $('aiProfileName').addEventListener('input', () => {
      settings.name = $('aiProfileName').value;
    });
    $('aiEndpoint').addEventListener('input', () => {
      $('aiProvider').value = matchPreset($('aiEndpoint').value);
      renderModelChips();
      renderConsentBox();
      onSettingsInput();
    });
    $('aiModel').addEventListener('input', () => {
      renderModelChips();
      onSettingsInput();
    });
    $('aiKey').addEventListener('input', onSettingsInput);
    $('aiSettingsClose').onclick = closeSettings;
  }

  function closeSettings() {
    abortTest();
    if (activeProfileId === null && previousProfileId && profileById(previousProfileId)) {
      const hasTyped = !!($('aiProfileName')?.value?.trim() || $('aiEndpoint')?.value?.trim() || $('aiModel')?.value?.trim() || $('aiKey')?.value?.trim());
      if (!hasTyped) selectProfile(previousProfileId, { silent: true });
    }
    settingsPanel.classList.add('hidden');
    placeAutoEntry();
    $('btnSettings').setAttribute('aria-expanded', 'false');
    $('btnSettings').focus();
  }

  function openSettings(tab) {
    const alreadyOpen = !settingsPanel.classList.contains('hidden');
    const targetTab = tab || 'ai';
    if (alreadyOpen) {
      if (targetTab !== activeSettingsTab) {
        activeSettingsTab = targetTab;
        settingsPanel.querySelectorAll('[data-stab]').forEach(t => t.classList.toggle('on', t.dataset.stab === activeSettingsTab));
        settingsPanel.querySelectorAll('[data-spane]').forEach(p => p.classList.toggle('hidden', p.dataset.spane !== activeSettingsTab));
        if (activeSettingsTab === 'data') refreshDataTabInfo();
      }
      return;
    }
    activeSettingsTab = targetTab;
    buildSettings();
    settingsPanel.classList.remove('hidden');
    placeAutoEntry();
    $('btnSettings').setAttribute('aria-expanded', 'true');
    if (activeSettingsTab === 'ai') $('aiEndpoint')?.focus();
  }

  buildSettings();
  try { validateSettings(settings); setAutoAvailable(true); }
  catch (_) { setAutoAvailable(false); }

  if (autoEntry) {
    autoEntry.onclick = () => {
      if (!settingsPanel.classList.contains('hidden')) closeSettings();
      G.AutoFlow.open();
    };
  }
  $('btnSettings').onclick = () => settingsPanel.classList.contains('hidden') ? openSettings() : closeSettings();
  $('btnSettings').setAttribute('aria-expanded', 'false');
  settingsPanel.addEventListener('keydown', e => e.stopPropagation());
  G.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !e.isComposing && !settingsPanel.classList.contains('hidden')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      closeSettings();
    }
  }, true);

  G.I18N.onChange(() => {
    settings = {
      name: $('aiProfileName')?.value ?? settings.name,
      endpoint: $('aiEndpoint').value,
      model: $('aiModel').value,
      key: $('aiKey').value,
      remember: $('aiRemember').checked
    };
    const wasStatus = $('aiSettingsStatus')?.textContent || '';
    const wasErr = $('aiSettingsStatus')?.classList.contains('error');
    const wasOk = $('aiSettingsStatus')?.classList.contains('ok');
    buildSettings();
    if (wasStatus) settingsStatus(wasStatus, wasErr, wasOk);
  });

  G.AIClient = {
    PRESETS,
    API_MAX_EDGE,
    get configured() { return configured; },
    get profiles() { return profiles.map(profileSummary); },
    get activeProfileId() { return activeProfileId; },
    get activeProfile() {
      const p = activeProfileId ? profileById(activeProfileId) : null;
      return p ? profileSummary(p) : null;
    },
    openSettings,
    closeSettings,
    saveSettings,
    saveProfile,
    saveAsNewProfile,
    selectProfile,
    startNewProfile,
    cancelNewProfile,
    deleteProfile,
    clearKey,
    clearAllKeys,
    testConnection,
    checkedAPISettings,
    validateSettings,
    endpoint,
    sanitizeKey,
    describeHttpError,
    responseJSON,
    callVision,
    requestVision,
    encodeImage,
    analysisImage,
    placeAutoEntry,
    settingsPanel
  };
})(window);
