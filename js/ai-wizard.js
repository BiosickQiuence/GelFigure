// @ts-check
/* A1 4-Step API Configuration Wizard (mockups/api-wizard.png)
 * Step 1: Select provider -> Step 2: Obtain API Key guide -> Step 3: Paste, clean, model & 16x16 test -> Step 4: Privacy Consent (A3) */
(function (G) {
  'use strict';
  /** @type {any} */
  const win = G;
  const L = (zh, en) => (win.L ? win.L(zh, en) : zh);
  const esc = s => (win.UI?.esc ? win.UI.esc(s) : String(s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])));

  const PROVIDERS = [
    {
      id: 'bailian',
      zh: '阿里云百炼 · 华北 2（北京）',
      en: 'Alibaba Cloud Bailian (Beijing)',
      descZh: '国内直连、支持 qwen3-vl-plus 视觉模型，新账号通常有免费试用额度。',
      descEn: 'Low-latency Mainland China access; supports qwen3-vl-plus vision model.',
      endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      models: ['qwen3-vl-plus', 'qwen4-max'],
      consoleUrl: 'https://bailian.console.aliyun.com/',
      guideUrl: 'https://help.aliyun.com/zh/model-studio/get-api-key',
      stepsZh: [
        '点击下方按钮打开阿里云百炼控制台并登录，确认右上角地域为「华北 2（北京）」。',
        '进入左侧「API-KEY 管理」，点击「创建我的 API-KEY」。',
        '复制完整的 sk-... 密钥，回到本页进入下一步粘贴。'
      ],
      stepsEn: [
        'Sign in to Alibaba Cloud Model Studio and select China North 2 (Beijing).',
        'Open API-KEY Management and click Create API Key.',
        'Copy the full sk-... key and continue to Step 3.'
      ]
    },
    {
      id: 'openai',
      zh: 'OpenAI API',
      en: 'OpenAI API',
      descZh: '海外直连或代理环境，支持 gpt-6.2-sol / gpt-6.2-astra 等视觉模型。',
      descEn: 'Official OpenAI API platform supporting vision-capable GPT models.',
      endpoint: 'https://api.openai.com/v1',
      models: ['gpt-6.2-sol', 'gpt-6.2-astra', 'gpt-6.1-terra'],
      consoleUrl: 'https://platform.openai.com/api-keys',
      guideUrl: 'https://developers.openai.com/api/docs/quickstart',
      stepsZh: [
        '打开 OpenAI API Platform（非 ChatGPT 网页版），在 API Keys 页面创建项目密钥。',
        '确认 Billing 中已有可用 API 余额（ChatGPT Plus 订阅不包含 API 额度）。',
        '复制完整 sk-... 密钥，回到本页粘贴并测试。'
      ],
      stepsEn: [
        'Open OpenAI API Platform (separate from ChatGPT subscription) and create a project API key.',
        'Verify API billing/credit balance is active.',
        'Copy the complete key and paste it in Step 3.'
      ]
    },
    {
      id: 'gemini',
      zh: 'Google Gemini API',
      en: 'Google Gemini API',
      descZh: '使用 Google AI Studio OpenAI 兼容端点，免费层即可测试视觉能力。',
      descEn: 'Google AI Studio OpenAI-compatible endpoint with vision support.',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai',
      models: ['gemini-4-hydrogen', 'gemini-3.5-flash-lite'],
      consoleUrl: 'https://aistudio.google.com/apikey',
      guideUrl: 'https://aistudio.google.com/docs/api-key',
      stepsZh: [
        '打开 Google AI Studio API Key 页面并登录 Google 账号。',
        '点击「Create API key」创建密钥并复制。',
        '回到本页进入下一步粘贴，接口地址已自动填好 OpenAI 兼容基址。'
      ],
      stepsEn: [
        'Open Google AI Studio API Keys and sign in.',
        'Click Create API key and copy it.',
        'Return here for Step 3 — the OpenAI-compatible base URL is pre-filled.'
      ]
    },
    {
      id: 'custom',
      zh: '自定义 OpenAI 兼容接口',
      en: 'Custom OpenAI-compatible API',
      descZh: '适用于高校内网部署、自建 vLLM/Ollama 网关或第三方 OpenAI 兼容服务。',
      descEn: 'For institutional gateways or third-party OpenAI-compatible vision endpoints.',
      endpoint: '',
      models: [],
      consoleUrl: '',
      guideUrl: 'https://github.com/BiosickQiuence/GelFigure#api-setup',
      stepsZh: [
        '向你的服务商或课题组管理员确认 HTTPS 的 OpenAI 兼容 /v1 接口基址。',
        '确认接口允许浏览器跨域（CORS），并准备一个支持图像输入的视觉模型 ID。',
        '取得对应 API Key 后进入下一步填写并测试。'
      ],
      stepsEn: [
        'Obtain an HTTPS OpenAI-compatible /v1 base URL from your provider or lab admin.',
        'Confirm the endpoint permits browser CORS and provides a vision-capable model ID.',
        'Proceed to Step 3 to paste your endpoint, model, and key.'
      ]
    }
  ];

  /** @type {HTMLElement | null} */
  let dlg = null;
  let step = 1;
  let providerId = 'bailian';
  let profileNameVal = '';
  let endpointVal = PROVIDERS[0].endpoint;
  let modelVal = PROVIDERS[0].models[0];
  let keyVal = '';
  let rememberVal = false;
  let saveAsNewVal = false;
  /** @type {string | null} */
  let initialActiveId = null;
  let initialEndpoint = '';
  /** @type {string | null} */
  let wizardCreatedId = null;
  let keyVisible = false;
  let cleanedNote = false;
  /** @type {{ ok: boolean, ms?: number, err?: any } | null} */
  let testState = null;
  let testing = false;
  /** @type {(() => void) | null} */
  let onCompleteCb = null;

  function curProvider() {
    return PROVIDERS.find(p => p.id === providerId) || PROVIDERS[0];
  }

  function syncFromClient() {
    const nmEl = /** @type {HTMLInputElement | null} */ (document.getElementById('aiProfileName'));
    const epEl = /** @type {HTMLInputElement | null} */ (document.getElementById('aiEndpoint'));
    const mdEl = /** @type {HTMLInputElement | null} */ (document.getElementById('aiModel'));
    const kyEl = /** @type {HTMLInputElement | null} */ (document.getElementById('aiKey'));
    const rmEl = /** @type {HTMLInputElement | null} */ (document.getElementById('aiRemember'));
    initialActiveId = win.AIClient?.activeProfileId || null;
    wizardCreatedId = null;
    saveAsNewVal = false;
    keyVisible = false;
    profileNameVal = nmEl ? nmEl.value.trim() : '';
    if (epEl && epEl.value.trim()) {
      endpointVal = epEl.value.trim();
      const matched = PROVIDERS.find(p => p.endpoint && endpointVal.toLowerCase().startsWith(p.endpoint.toLowerCase()));
      providerId = matched ? matched.id : 'custom';
    } else {
      providerId = 'bailian';
      endpointVal = PROVIDERS[0].endpoint;
    }
    initialEndpoint = epEl ? epEl.value.trim() : '';
    modelVal = (mdEl && mdEl.value.trim()) ? mdEl.value.trim() : (curProvider().models[0] || '');
    keyVal = kyEl ? kyEl.value : '';
    rememberVal = rmEl ? rmEl.checked : false;
  }

  function pushToClient() {
    if (win.AIClient?.saveProfile) {
      const createNew = saveAsNewVal && !wizardCreatedId;
      const targetId = wizardCreatedId || (saveAsNewVal ? undefined : (initialActiveId || undefined));
      const savedId = win.AIClient.saveProfile({
        id: targetId,
        name: profileNameVal.trim(),
        endpoint: endpointVal.trim(),
        model: modelVal.trim(),
        key: keyVal.trim(),
        remember: rememberVal,
        saveAsNew: createNew
      });
      if (createNew && savedId) wizardCreatedId = savedId;
      return;
    }
    const nmEl = /** @type {HTMLInputElement | null} */ (document.getElementById('aiProfileName'));
    const epEl = /** @type {HTMLInputElement | null} */ (document.getElementById('aiEndpoint'));
    const mdEl = /** @type {HTMLInputElement | null} */ (document.getElementById('aiModel'));
    const kyEl = /** @type {HTMLInputElement | null} */ (document.getElementById('aiKey'));
    const rmEl = /** @type {HTMLInputElement | null} */ (document.getElementById('aiRemember'));
    if (nmEl) nmEl.value = profileNameVal.trim();
    if (epEl) epEl.value = endpointVal.trim();
    if (mdEl) mdEl.value = modelVal.trim();
    if (kyEl) kyEl.value = keyVal.trim();
    if (rmEl) rmEl.checked = rememberVal;
    if (win.AIClient?.saveSettings) win.AIClient.saveSettings();
  }

  async function runWizardTest() {
    if (testing) return;
    const clean = win.AIClient?.sanitizeKey ? win.AIClient.sanitizeKey(keyVal) : { value: keyVal.trim(), cleaned: false };
    keyVal = clean.value;
    cleanedNote = clean.cleaned;
    pushToClient();
    let cfg;
    try {
      cfg = win.AIClient.validateSettings({ endpoint: endpointVal.trim(), model: modelVal.trim(), key: keyVal.trim() });
    } catch (e) {
      testState = { ok: false, err: e };
      render();
      return;
    }
    testing = true;
    testState = null;
    render();
    const t0 = performance.now();
    const ctrl = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, 20000);
    try {
      const c = document.createElement('canvas');
      c.width = 16; c.height = 16;
      const ctx = c.getContext('2d');
      if (ctx) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 16, 16); ctx.fillStyle = '#1e293b'; ctx.fillRect(3, 6, 10, 4); }
      const png = c.toDataURL('image/png');
      const res = await fetch(cfg.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.key },
        body: JSON.stringify({
          model: cfg.model,
          stream: false,
          max_tokens: 32,
          messages: [
            { role: 'system', content: 'Reply with {"ok":true} only.' },
            { role: 'user', content: [{ type: 'text', text: 'Connection check' }, { type: 'image_url', image_url: { url: png, detail: 'low' } }] }
          ]
        }),
        signal: ctrl.signal,
        credentials: 'omit',
        redirect: 'error',
        cache: 'no-store',
        referrerPolicy: 'no-referrer'
      });
      if (!res.ok) {
        /** @type {any} */
        const e = new Error(win.AIClient.describeHttpError(res.status));
        e.httpStatus = res.status;
        throw e;
      }
      const data = await win.AIClient.responseJSON(res);
      if (!data?.choices?.length) throw new Error(L('接口返回结构不符合 OpenAI 兼容格式', 'Response does not match OpenAI-compatible format'));
      testState = { ok: true, ms: Math.max(1, Math.round(performance.now() - t0)) };
    } catch (err) {
      if (timedOut) {
        /** @type {any} */
        const te = new Error(L('连接测试超过 20 秒未返回', 'Connection test timed out after 20s'));
        te.isTimeout = true;
        testState = { ok: false, err: te };
      } else {
        testState = { ok: false, err };
      }
    } finally {
      clearTimeout(timer);
      testing = false;
      render();
    }
  }

  function render() {
    if (!dlg) return;
    const p = curProvider();
    const stepTitles = [
      L('选择服务商', 'Choose provider'),
      L('获取 API Key', 'Get API Key'),
      L('粘贴并测试', 'Paste & test'),
      L('隐私确认', 'Privacy consent')
    ];
    const railHtml = `
      <div class="wizard-rail">
        <h3>${L('连接 AI 看图服务', 'Connect Vision AI')}</h3>
        <div class="wizard-steps">
          ${stepTitles.map((label, i) => {
            const n = i + 1;
            const cls = n === step ? 'active' : n < step ? 'done' : '';
            return `<button type="button" class="wizard-step-item ${cls}" data-wstep="${n}"><span class="wizard-step-num">${n < step ? '✓' : n}</span><span>${esc(label)}</span></button>`;
          }).join('')}
        </div>
        <div class="wizard-rail-foot">
          ${L('约 3 分钟，不会编程也能完成。', 'Takes ~3 minutes, no coding needed.')}<br>
          <a href="${esc(p.guideUrl)}" target="_blank" rel="noopener noreferrer">${L('图文教程 ↗', 'Official guide ↗')}</a>
        </div>
      </div>`;

    let bodyHtml = '';
    if (step === 1) {
      bodyHtml = `
        <h2>${L('第 1 步：选择一家 AI 服务商', 'Step 1: Choose an AI provider')}</h2>
        <div class="wizard-provider-grid">
          ${PROVIDERS.map(pr => `
            <button type="button" class="wizard-provider-card${pr.id === providerId ? ' on' : ''}" data-wprov="${pr.id}">
              <strong>${esc(L(pr.zh, pr.en))}</strong>
              <span>${esc(L(pr.descZh, pr.descEn))}</span>
            </button>`).join('')}
        </div>
        <div class="wizard-box">
          ${L('只需选择一家你已有或准备注册的服务商；GelFigure 直接从浏览器向该服务商发请求，不经过任何第三方中转服务器。',
            'Pick one provider you have or plan to register. GelFigure talks directly from your browser to that provider with no relay server.')}
        </div>
        <div class="wizard-actions">
          <button type="button" class="btn ghost" id="wizClose">${L('稍后再说，先用本地处理', 'Skip, use local for now')}</button>
          <span class="flex"></span>
          <button type="button" class="btn primary" id="wizNext">${L('下一步：获取 API Key', 'Next: Get API Key')}</button>
        </div>`;
    } else if (step === 2) {
      const list = L(p.stepsZh.join('|||'), p.stepsEn.join('|||')).split('|||');
      bodyHtml = `
        <h2>${L('第 2 步：获取 API Key', 'Step 2: Obtain your API Key')}</h2>
        <div class="wizard-box">
          <strong>${esc(L(p.zh, p.en))}</strong>
          <ol style="margin:8px 0 6px;padding-left:18px;">
            ${list.map(s => `<li style="margin:5px 0;">${esc(s)}</li>`).join('')}
          </ol>
          ${p.consoleUrl ? `<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
            <a class="btn sm primary" href="${esc(p.consoleUrl)}" target="_blank" rel="noopener noreferrer">${L('打开服务商控制台 ↗', 'Open provider console ↗')}</a>
            <a class="btn sm" href="${esc(p.guideUrl)}" target="_blank" rel="noopener noreferrer">${L('查看官方 Key 教程 ↗', 'Key creation guide ↗')}</a>
          </div>` : ''}
        </div>
        <p class="hint">${L('提示：聊天网页订阅（如 ChatGPT Plus）与 API 余额分开计费；请从 API 控制台创建密钥。',
          'Note: Chat subscriptions are billed separately from API credits; create your key in the API console.')}</p>
        <div class="wizard-actions">
          <button type="button" class="btn" id="wizPrev">${L('上一步', 'Back')}</button>
          <span class="flex"></span>
          <button type="button" class="btn ghost" id="wizClose">${L('先用本地处理', 'Use local')}</button>
          <button type="button" class="btn primary" id="wizNext">${L('已拿到 Key，下一步', 'I have a key, next')}</button>
        </div>`;
    } else if (step === 3) {
      bodyHtml = `
        <h2>${L('粘贴 Key 并测试连接', 'Paste Key & test connection')}</h2>
        <div class="wizard-box" style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
          <div>
            <strong>${esc(L(p.zh, p.en))}</strong>
            <div style="font-size:12px;color:var(--muted);margin-top:2px;">
              ${p.id === 'custom'
                ? L('请在下方填写 HTTPS OpenAI 兼容接口地址', 'Enter your HTTPS OpenAI-compatible base URL below')
                : L('接口地址已自动填写：', 'Endpoint pre-filled: ') + esc(endpointVal)}
            </div>
          </div>
          <button type="button" class="btn sm ghost" id="wizChangeProv">${L('更换', 'Change')}</button>
        </div>
        ${p.id === 'custom' ? `<label style="display:block;margin-bottom:10px;font-size:12.5px;font-weight:600;">${L('接口地址 (HTTPS)', 'API endpoint (HTTPS)')}<input id="wizEndpoint" type="text" value="${esc(endpointVal)}" placeholder="https://example.com/v1" style="width:100%;margin-top:4px;"></label>` : ''}
        <label style="display:block;margin-bottom:10px;font-size:12.5px;font-weight:600;">${L('配置名称（可选，便于多配置切换）', 'Profile name (optional, for multi-profile switching)')}<input id="wizProfileName" type="text" maxlength="80" value="${esc(profileNameVal)}" placeholder="${L('留空自动按服务商与模型命名', 'Leave blank to auto-name')}" style="width:100%;margin-top:4px;"></label>
        <label style="display:block;margin-bottom:4px;font-size:12.5px;font-weight:600;">API Key</label>
        <div class="ai-key-wrap" style="margin-bottom:4px;">
          <input id="wizKey" type="${keyVisible ? 'text' : 'password'}" value="${esc(keyVal)}" placeholder="sk-..." autocomplete="off" spellcheck="false" style="flex:1;">
          <button type="button" class="btn sm" id="wizKeyToggle">${keyVisible ? L('隐藏', 'Hide') : L('显示', 'Show')}</button>
        </div>
        <div style="font-size:11.5px;color:var(--muted);margin-bottom:10px;">
          ${cleanedNote
            ? L('✓ 已自动去除粘贴时带入的空格、引号或 "Bearer "', '✓ Cleaned extra whitespace, quotes, or "Bearer " prefix')
            : L('粘贴时将自动去除多余的空格、引号和 "Bearer "', 'Extra spaces, quotes, and "Bearer " prefixes are trimmed automatically')}
        </div>
        <label style="display:block;margin-bottom:6px;font-size:12.5px;font-weight:600;">${L('视觉模型', 'Vision model')}</label>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;">
          ${p.models.map((m, idx) => `<button type="button" class="ai-model-chip${modelVal === m ? ' on' : ''}" data-wmodel="${esc(m)}">${esc(m)}${idx === 0 ? ' ' + L('推荐', 'Rec') : ''}</button>`).join('')}
        </div>
        <input id="wizModel" type="text" value="${esc(modelVal)}" placeholder="qwen3-vl-plus" style="width:100%;margin-bottom:10px;">
        <div style="display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:8px;">
          <button type="button" class="btn sm" id="wizTestBtn" ${testing ? 'disabled' : ''}>${testing ? L('正在测试连接…', 'Testing…') : L('发送 16×16 测试图验证连接', 'Test with 16×16 sample')}</button>
          <label style="font-size:12px;color:var(--muted);display:inline-flex;align-items:center;gap:5px;cursor:pointer;">
            <input type="checkbox" id="wizRemember" ${rememberVal ? 'checked' : ''}>
            ${L('在本浏览器记住 Key（共享电脑请勿勾选）', 'Remember key in this browser (skip on shared PCs)')}
          </label>
          ${initialActiveId ? `<label style="font-size:12px;color:var(--muted);display:inline-flex;align-items:center;gap:5px;cursor:pointer;">
            <input type="checkbox" id="wizSaveAsNew" ${saveAsNewVal ? 'checked' : ''}>
            ${L('保存为新的 API 配置（保留现有配置）', 'Save as a new API profile (keep existing)')}
          </label>` : ''}
        </div>
        <div id="wizTestResult">
          ${testState?.ok ? `<div class="wizard-test-ok"><strong>✓ ${L(`连接成功（${(testState.ms / 1000).toFixed(2)} s）`, `Connected (${(testState.ms / 1000).toFixed(2)} s)`)}</strong><br>${L('模型可接收图片并返回 JSON。只发送了一张 16×16 测试图，未发送你的胶图。', 'Model accepted an image and returned JSON. Only a 16×16 test image was sent.')}</div>` : ''}
        </div>
        <div class="wizard-actions">
          <button type="button" class="btn" id="wizPrev">${L('上一步', 'Back')}</button>
          <span class="flex"></span>
          <button type="button" class="btn ghost" id="wizClose">${L('稍后再说，先用本地处理', 'Skip, use local')}</button>
          <button type="button" class="btn primary" id="wizNext">${L('下一步：隐私确认', 'Next: Privacy consent')}</button>
        </div>`;
    } else {
      const host = win.AIConsent?.hostOf(endpointVal) || endpointVal;
      bodyHtml = `
        <h2>${L('第 4 步：隐私与发送说明确认', 'Step 4: Privacy & upload consent')}</h2>
        <div class="wizard-box">
          <p style="margin:0 0 8px;"><strong>${L('开启 AI 主路径后，拖入胶图时将发生什么：', 'What happens when you drop a gel with AI enabled:')}</strong></p>
          <ul style="margin:0;padding-left:18px;">
            <li style="margin:5px 0;"><strong>${L('发送内容', 'What is sent')}</strong>：${L('仅发送缩放到长边 ≤ 1600 px 的分析图与 Marker 型号目录；绝不发送泳道名、项目记录或其它文件。', 'Only a ≤1600 px analysis PNG and the ladder catalogue. Never lane names, notes, or other files.')}</li>
            <li style="margin:5px 0;"><strong>${L('发送目标', 'Destination')}</strong>：<code>${esc(host)}</code>${L('（直接由本浏览器发出，无中转）', ' (direct from your browser, no relay)')}</li>
            <li style="margin:5px 0;"><strong>${L('本地处理', 'Local-only parts')}</strong>：${L('原图字节保持不变，裁切、标注与高清导出全部在本地完成；同一张图的结果会缓存，重复打开不再计费。', 'Original bytes stay untouched; editing and exports run locally; results are cached by SHA-256 to avoid repeat billing.')}</li>
            <li style="margin:5px 0;"><strong>${L('随时撤回', 'Revocable anytime')}</strong>：${L('每个浏览器只需确认一次；随时可在「设置 → AI 接口与隐私」撤回同意或改用本地处理。', 'Confirmed once per browser; revoke anytime in Settings → AI & Privacy or pick Local (offline).')}</li>
          </ul>
        </div>
        <div class="wizard-actions">
          <button type="button" class="btn" id="wizPrev">${L('上一步', 'Back')}</button>
          <span class="flex"></span>
          <button type="button" class="btn ghost" id="wizClose">${L('暂不同意（继续本地模式）', 'Not now (stay local)')}</button>
          <button type="button" class="btn primary" id="wizConfirm">${L('同意并启用 AI 主路径', 'Agree & enable AI primary path')}</button>
        </div>`;
    }

    dlg.innerHTML = `<div class="wizard-shell" role="dialog" aria-modal="true" aria-label="${L('API 配置向导', 'API setup wizard')}">${railHtml}<div class="wizard-main">${bodyHtml}</div></div>`;

    // Bind test error card if failed
    if (step === 3 && testState && !testState.ok && testState.err && win.AIError) {
      const host = dlg.querySelector('#wizTestResult');
      if (host) {
        host.innerHTML = '';
        host.appendChild(win.AIError.renderCard(testState.err, {
          onRetry: () => runWizardTest(),
          onLocal: () => close(),
          onWizard: () => { step = 2; render(); },
          onSettings: () => { close(); win.AIClient?.openSettings(); }
        }));
      }
    }

    // Bind rail navigation
    dlg.querySelectorAll('[data-wstep]').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = Number(/** @type {HTMLElement} */ (btn).dataset.wstep);
        if (target === 4) {
          const clean = win.AIClient?.sanitizeKey ? win.AIClient.sanitizeKey(keyVal) : { value: keyVal.trim(), cleaned: false };
          keyVal = clean.value;
          pushToClient();
          try {
            win.AIClient.validateSettings({ endpoint: endpointVal.trim(), model: modelVal.trim(), key: keyVal.trim() });
          } catch (e) {
            step = 3;
            testState = { ok: false, err: e };
            render();
            return;
          }
        }
        if (target >= 1 && target <= 4) { step = target; render(); }
      });
    });

    // Step 1 provider cards
    dlg.querySelectorAll('[data-wprov]').forEach(btn => {
      btn.addEventListener('click', () => {
        providerId = /** @type {HTMLElement} */ (btn).dataset.wprov || 'bailian';
        const pr = curProvider();
        const prevEpNorm = initialEndpoint.trim().replace(/\/+$/, '').toLowerCase();
        const nextEpNorm = (pr.endpoint || '').trim().replace(/\/+$/, '').toLowerCase();
        if (pr.endpoint) endpointVal = pr.endpoint;
        else endpointVal = '';
        modelVal = pr.models.length ? pr.models[0] : '';
        if (initialActiveId && (!nextEpNorm || nextEpNorm !== prevEpNorm)) {
          saveAsNewVal = true;
          keyVal = '';
          profileNameVal = '';
        }
        testState = null;
        render();
      });
    });

    // Step 3 inputs
    const nmIn = /** @type {HTMLInputElement | null} */ (dlg.querySelector('#wizProfileName'));
    if (nmIn) nmIn.oninput = () => { profileNameVal = nmIn.value; };
    const epIn = /** @type {HTMLInputElement | null} */ (dlg.querySelector('#wizEndpoint'));
    if (epIn) epIn.oninput = () => { endpointVal = epIn.value; testState = null; };
    const kyIn = /** @type {HTMLInputElement | null} */ (dlg.querySelector('#wizKey'));
    if (kyIn) {
      kyIn.oninput = () => {
        const clean = win.AIClient?.sanitizeKey ? win.AIClient.sanitizeKey(kyIn.value) : { value: kyIn.value.trim(), cleaned: false };
        keyVal = clean.value;
        cleanedNote = clean.cleaned;
        if (clean.cleaned) kyIn.value = clean.value;
        testState = null;
      };
    }
    const mdIn = /** @type {HTMLInputElement | null} */ (dlg.querySelector('#wizModel'));
    if (mdIn) mdIn.oninput = () => { modelVal = mdIn.value; testState = null; };
    const rmIn = /** @type {HTMLInputElement | null} */ (dlg.querySelector('#wizRemember'));
    if (rmIn) rmIn.onchange = () => { rememberVal = rmIn.checked; };
    const newIn = /** @type {HTMLInputElement | null} */ (dlg.querySelector('#wizSaveAsNew'));
    if (newIn) newIn.onchange = () => { saveAsNewVal = newIn.checked; };
    const tgBtn = dlg.querySelector('#wizKeyToggle');
    if (tgBtn) tgBtn.addEventListener('click', () => { keyVisible = !keyVisible; render(); });
    const chProv = dlg.querySelector('#wizChangeProv');
    if (chProv) chProv.addEventListener('click', () => { step = 1; render(); });
    dlg.querySelectorAll('[data-wmodel]').forEach(btn => {
      btn.addEventListener('click', () => {
        modelVal = /** @type {HTMLElement} */ (btn).dataset.wmodel || '';
        testState = null;
        render();
      });
    });
    const testBtn = dlg.querySelector('#wizTestBtn');
    if (testBtn) testBtn.addEventListener('click', runWizardTest);

    // Navigation buttons
    const prevBtn = dlg.querySelector('#wizPrev');
    if (prevBtn) prevBtn.addEventListener('click', () => { step = Math.max(1, step - 1); render(); });
    const closeBtn = dlg.querySelector('#wizClose');
    if (closeBtn) closeBtn.addEventListener('click', close);
    const nextBtn = dlg.querySelector('#wizNext');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (step === 3) {
          const clean = win.AIClient?.sanitizeKey ? win.AIClient.sanitizeKey(keyVal) : { value: keyVal.trim(), cleaned: false };
          keyVal = clean.value;
          pushToClient();
          try {
            win.AIClient.validateSettings({ endpoint: endpointVal.trim(), model: modelVal.trim(), key: keyVal.trim() });
          } catch (e) {
            testState = { ok: false, err: e };
            render();
            return;
          }
        }
        step = Math.min(4, step + 1);
        render();
      });
    }
    const confirmBtn = dlg.querySelector('#wizConfirm');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        const clean = win.AIClient?.sanitizeKey ? win.AIClient.sanitizeKey(keyVal) : { value: keyVal.trim(), cleaned: false };
        keyVal = clean.value;
        pushToClient();
        try {
          win.AIClient.validateSettings({ endpoint: endpointVal.trim(), model: modelVal.trim(), key: keyVal.trim() });
        } catch (e) {
          step = 3;
          testState = { ok: false, err: e };
          render();
          return;
        }
        if (win.AIConsent) win.AIConsent.grant(endpointVal.trim());
        const cb = onCompleteCb;
        close();
        if (win.UI?.toast) win.UI.toast(L('AI 已就绪！现在拖入胶图即可自动校正与标记。', 'AI is ready! Drop a gel image to start automatic processing.'), 4000);
        if (cb) cb();
      });
    }
  }

  /** @param {number} [startStep] @param {() => void} [onComplete] */
  function open(startStep, onComplete) {
    syncFromClient();
    step = startStep || 1;
    testState = null;
    onCompleteCb = onComplete || null;
    if (!dlg) {
      dlg = document.createElement('div');
      dlg.id = 'aiWizardDlg';
      dlg.className = 'wizard-dlg';
      dlg.addEventListener('click', e => { if (e.target === dlg) close(); });
      document.body.appendChild(dlg);
    }
    dlg.classList.remove('hidden');
    render();
  }

  function close() {
    if (dlg) dlg.classList.add('hidden');
    onCompleteCb = null;
  }

  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && dlg && !dlg.classList.contains('hidden')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      close();
    }
  }, true);

  win.AIWizard = { open, close, PROVIDERS };
})(window);
