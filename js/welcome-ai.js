// @ts-check
/* v1.3.0 W2 Welcome Page, A2 Offline AI Demo, A4 Drop-to-Start AI Auto-Flow, and A5 Progress Overlay. */
(function (G) {
  'use strict';
  /** @type {any} */
  const win = G;
  const L = (zh, en) => (win.L ? win.L(zh, en) : zh);
  const esc = s => (win.UI?.esc ? win.UI.esc(s) : String(s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])));

  /** @type {HTMLElement | null} */
  let welcomeEl = null;
  /** @type {HTMLElement | null} */
  let overlayEl = null;
  /** @type {HTMLElement | null} */
  let bgPillEl = null;
  /** @type {HTMLElement | null} */
  let demoBannerEl = null;
  /** @type {File | null} */
  let pendingDropFile = null;
  let pickerOpen = false;
  /** @type {any} */
  let activeRun = null;

  function defaultLadderId() {
    const prefs = win.App?.prefs ? win.App.prefs() : {};
    const id = prefs.autoFlowLadder || '';
    return id && win.Ladders?.get?.(id) ? id : '';
  }

  function setDefaultLadderId(id) {
    if (win.App?.setPref) win.App.setPref('autoFlowLadder', id || '');
    renderWelcome();
  }

  function currentEndpoint() {
    const el = /** @type {HTMLInputElement | null} */ (document.getElementById('aiEndpoint'));
    return el ? el.value.trim() : '';
  }

  function currentModel() {
    const el = /** @type {HTMLInputElement | null} */ (document.getElementById('aiModel'));
    return el ? el.value.trim() : '';
  }

  function isAIPrimaryReady() {
    const ep = currentEndpoint();
    return !!(win.AIClient?.configured && win.AIConsent?.isConsented(ep));
  }

  function providerShortName(ep) {
    const h = win.AIConsent?.hostOf(ep) || '';
    if (h.includes('dashscope')) return L('阿里云百炼', 'Bailian');
    if (h.includes('openai.com')) return 'OpenAI';
    if (h.includes('googleapis.com')) return 'Gemini';
    return h || L('自定义接口', 'Custom API');
  }

  function fmtDateShort(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    if (d.toDateString() === now.toDateString()) return L(`今天 ${pad(d.getHours())}:${pad(d.getMinutes())}`, `Today ${pad(d.getHours())}:${pad(d.getMinutes())}`);
    const yest = new Date(now.getTime() - 86400000);
    if (d.toDateString() === yest.toDateString()) return L('昨天', 'Yesterday');
    return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
  }

  /** @type {any[]} */
  let cachedRecentList = [];
  let recentReqId = 0;

  function renderRecentSection(list) {
    if (!welcomeEl) return;
    const slot = welcomeEl.querySelector('#welcomeRecentSlot');
    if (!slot) return;
    const topRecent = list.slice(0, 4);
    if (!topRecent.length) {
      slot.innerHTML = '';
      return;
    }
    slot.innerHTML = `
      <section class="welcome-recent">
        <div class="welcome-recent-head">
          <h3>${L('最近项目', 'Recent projects')} <small>${L('保存在本浏览器 · 同一原图自动合并', 'Saved in this browser · duplicates merged by SHA-256')}</small></h3>
          <button type="button" class="welcome-recent-all" id="btnWelcomeHistoryAll">${L(`全部 ${list.length} 个 →`, `All ${list.length} →`)}</button>
        </div>
        <div class="welcome-recent-grid">
          ${topRecent.map(p => `
            <button type="button" class="welcome-proj-card" data-open-hist="${esc(p.projectId)}">
              <div class="welcome-proj-thumb">${p.thumb ? `<img src="${p.thumb}" alt="">` : ''}</div>
              <div class="welcome-proj-meta">
                <strong>${esc(p.projectName || p.name)}</strong>
                <span>${esc(fmtDateShort(p.savedAt))} · ${p.summary?.gelType === 'protein' ? L('蛋白', 'Protein') : 'DNA'} · ${p.summary?.lanes || 0} ${L('泳道', 'lanes')}</span>
              </div>
            </button>`).join('')}
        </div>
      </section>`;
    slot.querySelectorAll('[data-open-hist]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = /** @type {HTMLElement} */ (btn).dataset.openHist;
        if (id && win.App?.restoreHistory) {
          try { await win.App.restoreHistory(id); }
          catch (err) { if (win.UI?.toast) win.UI.toast(err.message, 5000); }
        }
      });
    });
    const histAll = slot.querySelector('#btnWelcomeHistoryAll');
    if (histAll) {
      histAll.addEventListener('click', () => {
        const hBtn = document.getElementById('btnHistory') || document.getElementById('cacheStatus');
        if (hBtn) hBtn.click();
      });
    }
  }

  function refreshRecentAsync() {
    if (!win.App?.listHistory) return;
    const req = ++recentReqId;
    Promise.race([
      win.App.listHistory().catch(() => []),
      new Promise(r => setTimeout(() => r(null), 2000))
    ]).then(list => {
      if (req !== recentReqId || !Array.isArray(list)) return;
      cachedRecentList = list;
      renderRecentSection(cachedRecentList);
    });
  }

  /* ---------- W2 Welcome Page ---------- */
  function renderWelcome() {
    if (!welcomeEl) return;
    const ep = currentEndpoint();
    const model = currentModel();
    const configured = !!win.AIClient?.configured;
    const consented = !!win.AIConsent?.isConsented(ep);
    const ready = configured && consented;
    const ladId = defaultLadderId();
    const lad = ladId && win.Ladders?.get ? win.Ladders.get(ladId) : null;
    const consentRec = win.AIConsent?.info;

    let aiPillClass = 'setup';
    let aiPillText = L('未配置 AI · 点击 3 分钟配置向导', 'AI not set up · 3-min setup wizard');
    if (ready) {
      aiPillClass = 'ready';
      aiPillText = `✓ ${L('AI 已就绪', 'AI ready')} · ${providerShortName(ep)} ${model}`;
    } else if (configured && !consented) {
      aiPillClass = 'warn';
      aiPillText = L('AI 已填 Key · 点击完成隐私确认', 'API key saved · confirm privacy to enable');
    }

    const favs = [];
    if (win.Ladders?.favoritesOf) {
      for (const k of ['dna', 'protein']) {
        for (const f of win.Ladders.favoritesOf(k)) if (favs.length < 6) favs.push(f);
      }
    }

    const pickerHtml = pickerOpen ? `
      <div class="welcome-inline-picker" id="welcomeMarkerPicker">
        <h4>${pendingDropFile ? L(`为「${pendingDropFile.name}」选择 Marker 型号以开始 AI 全自动`, `Choose Marker model for "${pendingDropFile.name}"`) : L('设置默认 Marker 型号（拖图即自动使用）', 'Choose default Marker model')}</h4>
        ${favs.length ? `<div class="welcome-inline-favs">${favs.map(f => `<button type="button" class="btn sm ghost" data-pick-fav="${esc(f.id)}">★ ${esc(f.name)}</button>`).join('')}</div>` : ''}
        <div class="picker-row">
          <select id="welcomeMarkerSelect">
            <option value="">${L('选择 Marker 型号…', 'Select a marker model…')}</option>
            ${['dna', 'protein'].map(kind => {
              const list = win.Ladders?.ordered ? win.Ladders.ordered(kind) : [];
              return `<optgroup label="${kind === 'dna' ? 'DNA (bp)' : L('蛋白 (kDa)', 'Protein (kDa)')}">${list.map(x => `<option value="${esc(x.id)}"${x.id === ladId ? ' selected' : ''}>${win.Ladders.isFavorite(x.id) ? '★ ' : ''}${esc(x.name)}</option>`).join('')}</optgroup>`;
            }).join('')}
          </select>
          <button type="button" class="btn sm primary" id="welcomeMarkerApply">${pendingDropFile ? L('开始 AI 处理', 'Start AI') : L('设为默认', 'Save default')}</button>
          <button type="button" class="btn sm ghost" id="welcomeMarkerCancel">${L('取消', 'Cancel')}</button>
        </div>
      </div>` : '';

    // Detach shared live nodes before re-rendering welcomeEl innerHTML so their DOM listeners stay intact
    const autoHome = document.getElementById('autoFlowHome');
    const panelEl = document.getElementById('panel');
    if (autoHome && welcomeEl.contains(autoHome) && panelEl) {
      panelEl.insertBefore(autoHome, panelEl.firstChild);
    }
    const draftBox = document.getElementById('draftBox');
    const emptyEl = document.getElementById('emptyState');
    if (draftBox && welcomeEl.contains(draftBox) && emptyEl) {
      emptyEl.appendChild(draftBox);
    }

    const consentDate = consentRec ? fmtDateShort(Date.parse(consentRec.acceptedAt)) : '';
    const histFooterBtn = ` · <button type="button" id="btnHistoryStart">${L('打开历史项目', 'Open recent projects')}</button>`;
    const footerHtml = ready
      ? `${L(`编辑与导出都在本地完成；AI 全自动会把分析图发送到 ${win.AIConsent.hostOf(ep)}（你已于 ${consentDate} 同意，`, `Editing & export run locally; AI sends analysis images to ${win.AIConsent.hostOf(ep)} (consented ${consentDate}, `)}<button type="button" id="btnWelcomePrivacySettings">${L('可在设置中关闭', 'change in Settings')}</button>${L('）', ')')}${histFooterBtn}`
      : `${L('图像编辑与导出全程在本地完成；未配置 AI 时拖入胶图将自动使用浏览器本地识别。', 'Editing & export run locally. Without AI configured, dropped gels use offline local detection.')} <button type="button" id="btnWelcomeSetupFooter">${L('配置 AI →', 'Set up AI →')}</button>${histFooterBtn}`;

    welcomeEl.innerHTML = `
      <div class="welcome-shell">
        <header class="welcome-hero">
          <h1 class="heading-rule">${L('把胶图变成可发表的实验图', 'Turn raw gel images into publication-ready figures')}</h1>
          <p>${L('拖入 DNA 胶或蛋白胶，AI 自动完成透视校正、泳道定位与 Marker 标注；你只需核对并填写泳道名。', 'Drop a DNA or protein gel for automatic perspective correction, lane detection, and Marker labelling — then review and export.')}</p>
        </header>

        <div id="welcomeDraftSlot"></div>

        <div class="welcome-drop" id="welcomeDrop" role="button" tabindex="0">
          <span class="welcome-auto-badge">${ready ? L('拖图即开始 AI 全自动（默认型号）', 'Drop to start AI auto-flow') : L('支持 AI 全自动 · 也可离线本地识别', 'AI auto-flow or offline local mode')}</span>
          <div class="welcome-drop-icon"><svg class="ic"><use href="#i-upload"/></svg></div>
          <h2>${L('拖入胶图，或点击选择 / Ctrl+V 粘贴', 'Drop a gel image, click to choose, or Ctrl+V paste')}</h2>
          <p class="welcome-drop-sub">${L('TIFF（8/16 位）· PNG · JPG · 同一块胶的多张曝光可一起拖入', 'TIFF (8/16-bit) · PNG · JPG · Drop multiple exposures together')}</p>
          <div class="welcome-status-row">
            <div id="welcomeAutoSlot" class="welcome-auto-slot"></div>
            <button type="button" class="welcome-ai-pill ${aiPillClass}" id="btnWelcomeAIStatus">${esc(aiPillText)}</button>
            <span class="welcome-marker-chip" id="welcomeMarkerChip">
              <span>Marker:</span>
              <strong>${esc(lad ? lad.name : L('未设置默认', 'Not selected'))}</strong>
              <button type="button" id="btnWelcomeChangeMarker">${L('更改', 'Change')}</button>
            </span>
          </div>
          ${pickerHtml}
        </div>

        <div class="welcome-cards">
          <button type="button" class="welcome-card" id="btnDemo">
            <span class="welcome-card-ic"><svg class="ic"><use href="#i-sparkle"/></svg></span>
            <span class="welcome-card-tx">
              <strong>${L('体验示例', 'Try AI demo')}</strong>
              <span>${L('用示例胶看 AI 全自动的完整效果，无需 API、不联网', 'Experience the full AI workflow offline with a sample gel, no key needed')}</span>
            </span>
          </button>
          <button type="button" class="welcome-card" id="btnWelcomeLocal">
            <span class="welcome-card-ic"><svg class="ic"><use href="#i-crop"/></svg></span>
            <span class="welcome-card-tx">
              <strong>${L('本地处理（离线）', 'Local processing (offline)')}</strong>
              <span>${L('不上传图片，用浏览器内算法识别，可手动校正', 'Never uploads images; runs built-in browser detection & manual editing')}</span>
            </span>
          </button>
          <button type="button" class="welcome-card" id="btnWelcomeProject">
            <span class="welcome-card-ic"><svg class="ic"><use href="#i-folder"/></svg></span>
            <span class="welcome-card-tx">
              <strong>${L('打开项目 / 批量处理', 'Open project / Batch')}</strong>
              <span>${L('.gelfig 项目文件；或一次选多张胶继续整理', 'Open a .gelfig project file or select multiple exposures')}</span>
            </span>
          </button>
        </div>

        <div id="welcomeRecentSlot"></div>

        <footer class="welcome-footer">
          <svg class="ic ic-14"><use href="#i-info"/></svg>
          <span>${footerHtml}</span>
        </footer>
      </div>`;

    syncSharedMounts();
    renderRecentSection(cachedRecentList);
    refreshRecentAsync();

    // Wire welcome controls
    const dropEl = welcomeEl.querySelector('#welcomeDrop');
    if (dropEl) {
      const openDropFile = e => {
        const target = /** @type {HTMLElement} */ (e.target);
        if (target.closest('button, select, input, .welcome-inline-picker, #autoFlowHome')) return;
        const fi = document.getElementById('fileInput');
        if (fi) fi.click();
      };
      dropEl.addEventListener('click', openDropFile);
      dropEl.addEventListener('keydown', /** @param {KeyboardEvent} e */ e => {
        if (e.key === 'Enter' || e.key === ' ') {
          const target = /** @type {HTMLElement} */ (e.target);
          if (target !== dropEl) return;
          e.preventDefault();
          openDropFile(e);
        }
      });
    }
    const aiBtn = welcomeEl.querySelector('#btnWelcomeAIStatus');
    if (aiBtn) {
      aiBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (win.AIWizard) win.AIWizard.open(configured && !consented ? 4 : 1, () => renderWelcome());
        else if (win.AIClient) win.AIClient.openSettings();
      });
    }
    const chMarker = welcomeEl.querySelector('#btnWelcomeChangeMarker');
    if (chMarker) {
      chMarker.addEventListener('click', e => {
        e.stopPropagation();
        pendingDropFile = null;
        pickerOpen = !pickerOpen;
        renderWelcome();
      });
    }

    // Inline picker bindings
    welcomeEl.querySelectorAll('[data-pick-fav]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = /** @type {HTMLElement} */ (btn).dataset.pickFav || '';
        const f = pendingDropFile;
        pendingDropFile = null;
        pickerOpen = false;
        setDefaultLadderId(id);
        if (f) runPrimaryAI(f, id);
      });
    });
    const applyPick = welcomeEl.querySelector('#welcomeMarkerApply');
    if (applyPick) {
      applyPick.addEventListener('click', e => {
        e.stopPropagation();
        const sel = /** @type {HTMLSelectElement | null} */ (welcomeEl?.querySelector('#welcomeMarkerSelect'));
        const id = sel ? sel.value : '';
        if (!id) {
          if (win.UI?.toast) win.UI.toast(L('请先选择一个 Marker 型号', 'Select a marker model first'));
          return;
        }
        const f = pendingDropFile;
        pendingDropFile = null;
        pickerOpen = false;
        setDefaultLadderId(id);
        if (f) runPrimaryAI(f, id);
      });
    }
    const cancelPick = welcomeEl.querySelector('#welcomeMarkerCancel');
    if (cancelPick) {
      cancelPick.addEventListener('click', e => {
        e.stopPropagation();
        const f = pendingDropFile;
        pendingDropFile = null;
        pickerOpen = false;
        renderWelcome();
        if (f && win.UI?.load) win.UI.load([f], { localOnly: true });
      });
    }

    // Card 1: A2 Offline AI Demo (#btnDemo)
    const demoBtn = welcomeEl.querySelector('#btnDemo');
    if (demoBtn) demoBtn.addEventListener('click', () => runDemoAI());

    // Card 2: Local Processing (offline)
    const localBtn = welcomeEl.querySelector('#btnWelcomeLocal');
    if (localBtn) {
      localBtn.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.tif,.tiff,.png,.jpg,.jpeg,.bmp,image/*';
        input.multiple = true;
        input.onchange = () => {
          const fs = Array.from(input.files || []);
          if (fs.length && win.UI?.load) win.UI.load(fs, { localOnly: true });
        };
        input.click();
      });
    }

    // Card 3: Open project
    const projBtn = welcomeEl.querySelector('#btnWelcomeProject');
    if (projBtn) {
      projBtn.addEventListener('click', () => {
        const pi = document.getElementById('projInput');
        if (pi) pi.click();
      });
    }

    const histAll = welcomeEl.querySelector('#btnHistoryStart');
    if (histAll) {
      histAll.addEventListener('click', () => {
        const hBtn = document.getElementById('btnHistory') || document.getElementById('cacheStatus');
        if (hBtn) hBtn.click();
      });
    }
    const privSet = welcomeEl.querySelector('#btnWelcomePrivacySettings');
    if (privSet) privSet.addEventListener('click', () => win.AIClient?.openSettings());
    const footWiz = welcomeEl.querySelector('#btnWelcomeSetupFooter');
    if (footWiz) footWiz.addEventListener('click', () => win.AIWizard?.open(1, () => renderWelcome()));
  }

  /* ---------- A5 AI Progress Overlay ---------- */
  function removeProgressOverlay() {
    if (overlayEl) { overlayEl.remove(); overlayEl = null; }
    if (bgPillEl) { bgPillEl.remove(); bgPillEl = null; }
  }

  function showDemoBanner() {
    if (demoBannerEl) demoBannerEl.remove();
    if (isAIPrimaryReady()) return;
    demoBannerEl = document.createElement('div');
    demoBannerEl.id = 'demoAIBanner';
    demoBannerEl.className = 'demo-ai-banner';
    demoBannerEl.innerHTML = `
      <span>${L('示例体验完成（离线预录 AI 结果，未联网）。想对自己的胶图使用 AI 全自动？', 'Offline AI demo complete (pre-recorded result, zero network). Want AI auto-flow on your own gels?')}</span>
      <button type="button" class="btn sm primary" id="btnDemoSetupAI">${L('3 分钟配置 API →', 'Set up API →')}</button>
      <button type="button" class="btn sm ghost" id="btnDemoBannerClose" aria-label="${L('关闭', 'Close')}">×</button>`;
    document.body.appendChild(demoBannerEl);
    demoBannerEl.querySelector('#btnDemoSetupAI')?.addEventListener('click', () => {
      demoBannerEl?.remove();
      demoBannerEl = null;
      win.AIWizard?.open(1, () => renderWelcome());
    });
    demoBannerEl.querySelector('#btnDemoBannerClose')?.addEventListener('click', () => {
      demoBannerEl?.remove();
      demoBannerEl = null;
    });
  }

  /**
   * Render / update the A5 3-step AI Progress Overlay
   * @param {any} state
   */
  function renderProgressOverlay(state) {
    if (state.minimized) {
      if (overlayEl) overlayEl.classList.add('hidden');
      if (!bgPillEl) {
        bgPillEl = document.createElement('button');
        bgPillEl.setAttribute('type', 'button');
        bgPillEl.id = 'aiBgPill';
        bgPillEl.className = 'ai-bg-pill';
        bgPillEl.onclick = () => {
          state.minimized = false;
          renderProgressOverlay(state);
        };
        document.body.appendChild(bgPillEl);
      }
      bgPillEl.textContent = L(`AI 后台处理中 (${state.elapsed.toFixed(1)} s) · 点击查看进度`, `AI running in background (${state.elapsed.toFixed(1)} s) · Click to view`);
      return;
    }
    if (bgPillEl) { bgPillEl.remove(); bgPillEl = null; }
    if (!overlayEl) {
      overlayEl = document.createElement('div');
      overlayEl.id = 'aiProgressOverlay';
      overlayEl.className = 'ai-progress-overlay';
      document.body.appendChild(overlayEl);
    }
    overlayEl.classList.remove('hidden');

    const pct = state.step === 1 ? 30 : state.step === 2 ? 68 : state.step === 3 ? 94 : 100;
    const stepRow = (n, title, sub, sec) => {
      const cls = state.errorStep === n ? 'error' : state.step > n ? 'done' : state.step === n ? 'active' : '';
      const dot = cls === 'done' ? '✓' : cls === 'error' ? '!' : String(n);
      const tStr = sec != null ? `${sec.toFixed(1)} s` : '';
      return `<div class="ai-pstep ${cls}" data-pstep="${n}">
        <span class="ai-pstep-dot">${dot}</span>
        <div class="ai-pstep-body"><strong>${esc(title)}</strong><small>${esc(sub)}</small></div>
        <span class="ai-pstep-time">${tStr}</span>
      </div>`;
    };

    overlayEl.innerHTML = `
      <div class="ai-progress-card" role="dialog" aria-modal="true" aria-label="${L('AI 正在处理', 'AI processing')}">
        <div class="ai-progress-head">
          <h3>${state.isDemo ? L('AI 示例体验（离线）', 'AI Demo (Offline)') : L('AI 正在处理', 'AI Processing')}</h3>
          <span class="ai-progress-marker-pill">
            <span>Marker: ${esc(state.ladderName || '')}</span>
            ${!state.isDemo && !state.error ? `<button type="button" id="aiProgChangeMarker">${L('改', 'Edit')}</button>` : ''}
          </span>
          <span class="ai-progress-elapsed">${state.elapsed.toFixed(1)} s</span>
        </div>
        <div class="ai-progress-bar"><div class="ai-progress-bar-fill" style="width:${pct}%"></div></div>
        <div class="ai-progress-steps">
          ${stepRow(1, L('定位胶面与泳道', 'Locate gel & lanes'), state.step1Sub, state.step1Sec)}
          ${stepRow(2, L('标记 Marker 条带', 'Label Marker bands'), state.step2Sub, state.step2Sec)}
          ${stepRow(3, L('生成成图与待核对清单', 'Build figure & review checklist'), state.step3Sub, state.step3Sec)}
        </div>
        <div id="aiProgErrorHost"></div>
        <div class="ai-progress-actions">
          ${!state.isDemo ? `<button type="button" class="btn sm" id="aiProgUseLocal">${L('改用本地处理', 'Use local')}</button>` : ''}
          <button type="button" class="btn sm ghost" id="aiProgCancel">${L('取消', 'Cancel')}</button>
          <span class="flex"></span>
          ${!state.isDemo && !state.error ? `<button type="button" class="btn sm ghost" id="aiProgBg">${L('后台运行，先看原图', 'Run in background')}</button>` : ''}
        </div>
        <div class="ai-progress-foot">
          <svg class="ic ic-14"><use href="#i-info"/></svg>
          <span>${state.isDemo
            ? L('离线示例模式：使用预录 AI 响应演示完整流程，不发送网络请求、不计费。', 'Offline demo: uses a pre-recorded AI response, zero network calls or billing.')
            : L(`分析图发送至 ${state.host || ''} · 原图字节不变 · 同一张图的结果会缓存，重复打开不再计费`, `Analysis image sent to ${state.host || ''} · Original bytes unchanged · Cached by SHA-256 to prevent repeat billing`)}</span>
        </div>
      </div>`;

    if (state.error && win.AIError) {
      const host = overlayEl.querySelector('#aiProgErrorHost');
      if (host) {
        host.appendChild(win.AIError.renderCard(state.error, {
          onRetry: () => {
            if (state.onRetry) state.onRetry();
          },
          onLocal: () => {
            if (state.onUseLocal) state.onUseLocal();
          },
          onWizard: () => {
            if (state.onCancel) state.onCancel();
            win.AIWizard?.open(3, () => renderWelcome());
          },
          onSettings: () => {
            if (state.onCancel) state.onCancel();
            win.AIClient?.openSettings();
          }
        }));
      }
    }

    overlayEl.querySelector('#aiProgUseLocal')?.addEventListener('click', () => state.onUseLocal?.());
    overlayEl.querySelector('#aiProgCancel')?.addEventListener('click', () => state.onCancel?.());
    overlayEl.querySelector('#aiProgBg')?.addEventListener('click', () => state.onBackground?.());
    overlayEl.querySelector('#aiProgChangeMarker')?.addEventListener('click', () => {
      state.onCancel?.();
      if (win.App?.S && win.AIAssistant?.open) {
        win.AIAssistant.open();
        return;
      }
      pendingDropFile = state.file || null;
      pickerOpen = true;
      renderWelcome();
    });
  }

  /* ---------- A2 Offline AI Demo Experience ---------- */
  async function runDemoAI() {
    if (activeRun) return;
    let cancelled = false;
    const state = {
      isDemo: true,
      ladderName: 'GeneRuler 1 kb Plus',
      step: 1,
      elapsed: 0.1,
      step1Sub: L('读取预录透视校正与 11 条泳道…', 'Loading pre-recorded perspective & 11 lanes…'),
      step2Sub: L('等待上一步完成…', 'Waiting…'),
      step3Sub: L('本地完成，不再上传', 'Local only, no upload'),
      step1Sec: null,
      step2Sec: null,
      step3Sec: null,
      minimized: false,
      error: null,
      errorStep: 0,
      onCancel: () => { cancelled = true; activeRun = null; removeProgressOverlay(); }
    };
    activeRun = state;
    renderProgressOverlay(state);

    const delay = ms => new Promise(r => setTimeout(r, ms));
    try {
      const f = new File([win.Demo.encodeTiff16(win.Demo.makeGel())], 'demo_gel.tif', { type: 'image/tiff' });
      /** @type {any} */ (f)._isDemo = true;
      await delay(140);
      if (cancelled) return;
      state.step1Sec = 0.2;
      state.step1Sub = L('识别到 11 条泳道，四角已透视校正（本地扩框 +4%）', '11 lanes located, perspective corrected');
      state.step = 2;
      state.elapsed = 0.3;
      state.step2Sub = L('已应用预录 GeneRuler 1 kb Plus 条带标注…', 'Applying pre-recorded GeneRuler 1 kb Plus bands…');
      renderProgressOverlay(state);

      await delay(140);
      if (cancelled) return;
      state.step2Sec = 0.2;
      state.step2Sub = L('已匹配 15 条 Marker 条带（离线预录）', 'Matched 15 Marker bands (offline pre-recorded)');
      state.step = 3;
      state.elapsed = 0.5;
      state.step3Sub = L('正在生成成图与待核对清单…', 'Building figure & review checklist…');
      renderProgressOverlay(state);

      if (win.UI?.load) await win.UI.load([f], { localOnly: true });
      if (cancelled) return;

      // Mark lane 4 (index 4, lane 5) low-confidence metadata so Review Checklist showcases confidence badges
      if (win.ReviewChecklist?.setAIMeta) {
        win.ReviewChecklist.setAIMeta({
          isDemoAI: true,
          fromCache: false,
          laneConf: { 4: 0.62 }
        });
      }
      removeProgressOverlay();
      activeRun = null;
      showDemoBanner();
    } catch (err) {
      removeProgressOverlay();
      activeRun = null;
      if (win.UI?.toast) win.UI.toast(String(err?.message || err), 5000);
    }
  }

  /* ---------- A4 Drop-to-Start AI Auto-Flow with A5/A7/A8/A9 ---------- */
  /**
   * @param {File} file
   * @param {string} ladderId
   * @param {{ forceRefresh?: boolean }} [opts]
   */
  async function runPrimaryAI(file, ladderId, opts) {
    if (activeRun) {
      if (win.UI?.toast) {
        win.UI.toast(L('上一张胶图仍在 AI 处理中，请等待完成或先取消后再导入新图。', 'Another gel is currently running in AI mode. Wait for it to finish or cancel it first.'), 4500);
      }
      return;
    }
    const ladder = win.Ladders?.get ? win.Ladders.get(ladderId) : null;
    if (!ladder) {
      pendingDropFile = file;
      pickerOpen = true;
      renderWelcome();
      return;
    }
    if (win.App?.setPref) win.App.setPref('autoFlowLadder', ladder.id);
    if (demoBannerEl) { demoBannerEl.remove(); demoBannerEl = null; }

    const ctrl = new AbortController();
    const t0 = performance.now();
    const ep = currentEndpoint();
    const model = currentModel();
    const host = win.AIConsent?.hostOf(ep) || '';
    const kind = win.Ladders.kindOf(ladder);

    const state = {
      isDemo: false,
      file,
      ladderName: ladder.name,
      host,
      step: 1,
      elapsed: 0,
      step1Sub: L('正在读取原图并定位胶面与泳道…', 'Reading image and locating gel & lanes…'),
      step2Sub: L('等待校正完成…', 'Waiting for perspective correction…'),
      step3Sub: L('本地完成，不再上传', 'Local only, no upload'),
      step1Sec: null,
      step2Sec: null,
      step3Sec: null,
      minimized: false,
      error: null,
      errorStep: 0,
      onCancel: () => {
        ctrl.abort();
        clearInterval(tick);
        activeRun = null;
        removeProgressOverlay();
      },
      onUseLocal: async () => {
        ctrl.abort();
        clearInterval(tick);
        activeRun = null;
        removeProgressOverlay();
        if (win.UI?.load) await win.UI.load([file], { localOnly: true });
      },
      onBackground: async () => {
        state.minimized = true;
        renderProgressOverlay(state);
        if (!win.App?.S && win.UI?.load) {
          await win.UI.load([file], { localOnly: true });
        }
      },
      onRetry: () => {
        clearInterval(tick);
        activeRun = null;
        removeProgressOverlay();
        runPrimaryAI(file, ladderId, { forceRefresh: true });
      }
    };
    activeRun = state;
    renderProgressOverlay(state);

    const tick = setInterval(() => {
      if (activeRun !== state || state.error) return;
      state.elapsed = (performance.now() - t0) / 1000;
      renderProgressOverlay(state);
    }, 200);

    try {
      const input = await win.App.readInput(file);
      if (ctrl.signal.aborted) return;

      // A7 Check IndexedDB cache
      const cacheKey = win.AICache ? win.AICache.key({ sha256: input.sha256, ladderId: ladder.id, model, endpoint: ep }) : '';
      const cached = (!opts?.forceRefresh && cacheKey && win.AICache) ? await win.AICache.get(cacheKey) : null;
      if (ctrl.signal.aborted) return;

      const img = input.img;
      const raw = { w: img.width, h: img.height, data: img.data };

      let layout, corrected, markers;
      if (cached && cached.proposal && cached.markers) {
        layout = win.GelAIBeta.plan(cached.proposal, 4, raw);
        corrected = win.Perspective.warp(raw, layout.spec, false);
        markers = cached.markers;
        state.step1Sec = 0.0;
        state.step2Sec = 0.0;
        state.step1Sub = L('命中本地缓存（未计费）', 'Loaded from local cache (no billing)');
        state.step2Sub = L('命中本地缓存（未计费）', 'Loaded from local cache (no billing)');
        state.step = 3;
        renderProgressOverlay(state);
      } else {
        const sourceImage = win.AIClient.encodeImage(raw, img.rgb);
        const s1Start = performance.now();
        const proposal = await win.AIRetry.runWithRetry(
          async () => {
            const reqCtrl = new AbortController();
            const onAbort = () => reqCtrl.abort();
            ctrl.signal.addEventListener('abort', onAbort, { once: true });
            const tm = setTimeout(() => { reqCtrl.abort(); }, 90000);
            try {
              return await win.GelAIBeta.detectLayout(sourceImage, kind, reqCtrl.signal);
            } catch (e) {
              if (!ctrl.signal.aborted && reqCtrl.signal.aborted) {
                /** @type {any} */ const te = new Error(L('接口超过 90 秒未返回', 'API timed out after 90s'));
                te.isTimeout = true;
                throw te;
              }
              throw e;
            } finally {
              clearTimeout(tm);
              ctrl.signal.removeEventListener('abort', onAbort);
            }
          },
          {
            retryOnce: true,
            backoffMs: 600,
            signal: ctrl.signal,
            onRetry: () => {
              state.step1Sub = L('连接异常或限流，正在自动重试（1/1）…', 'Transient error, retrying automatically (1/1)…');
              renderProgressOverlay(state);
            }
          }
        );
        if (ctrl.signal.aborted) return;
        layout = win.GelAIBeta.plan(proposal, 4, raw);
        corrected = win.Perspective.warp(raw, layout.spec, false);
        const rgb = img.rgb && win.Perspective.warp({ w: raw.w, h: raw.h, data: img.rgb }, layout.spec, true).data;
        const markerImage = win.AIClient.encodeImage(corrected, rgb);

        state.step1Sec = (performance.now() - s1Start) / 1000;
        state.step1Sub = L(`识别到 ${layout.meta.visibleLanes} 条泳道，四角已透视校正`, `${layout.meta.visibleLanes} lanes located & perspective corrected`);
        state.step = 2;
        state.step2Sub = L('已发送校正图，等待模型返回…（超时自动重试 1 次）', 'Sent corrected gel, waiting… (1x auto-retry on timeout)');
        renderProgressOverlay(state);

        const s2Start = performance.now();
        markers = await win.AIRetry.runWithRetry(
          async () => {
            const reqCtrl = new AbortController();
            const onAbort = () => reqCtrl.abort();
            ctrl.signal.addEventListener('abort', onAbort, { once: true });
            const tm = setTimeout(() => { reqCtrl.abort(); }, 90000);
            try {
              return await win.MarkerAI.detectAutomaticMarkers(markerImage, ladder, layout, reqCtrl.signal);
            } catch (e) {
              if (!ctrl.signal.aborted && reqCtrl.signal.aborted) {
                /** @type {any} */ const te = new Error(L('接口超过 90 秒未返回', 'API timed out after 90s'));
                te.isTimeout = true;
                throw te;
              }
              throw e;
            } finally {
              clearTimeout(tm);
              ctrl.signal.removeEventListener('abort', onAbort);
            }
          },
          {
            retryOnce: true,
            backoffMs: 600,
            signal: ctrl.signal,
            onRetry: () => {
              state.step2Sub = L('请求超时或限流，正在自动重试（1/1）…', 'Retrying Marker detection automatically (1/1)…');
              renderProgressOverlay(state);
            }
          }
        );
        if (ctrl.signal.aborted) return;
        state.step2Sec = (performance.now() - s2Start) / 1000;
        state.step2Sub = L(`已标记 ${markers.length} 个 Marker 泳道`, `Labelled ${markers.length} Marker lane(s)`);
        state.step = 3;
        renderProgressOverlay(state);

        if (cacheKey && win.AICache) {
          await win.AICache.set(cacheKey, { proposal, markers, kind, ladderId: ladder.id, model });
        }
      }

      if (ctrl.signal.aborted) return;
      win.App.adoptAutomatic(input, layout, corrected, markers, kind);
      if (win.UI?.isPhone?.()) win.Mobile?.setView?.('fig');
      win.Editor?.fitCrop?.();

      clearInterval(tick);
      activeRun = null;
      removeProgressOverlay();

      if (win.ReviewChecklist?.setAIMeta) {
        win.ReviewChecklist.setAIMeta({
          fromCache: !!cached,
          isDemoAI: false,
          elapsedSec: (performance.now() - t0) / 1000,
          onRerun: () => runPrimaryAI(file, ladder.id, { forceRefresh: true })
        });
      }

      const secStr = ((performance.now() - t0) / 1000).toFixed(1);
      if (win.UI?.toast) {
        win.UI.toast(
          cached
            ? L('已加载缓存的 AI 结果（未计费），请按右侧清单核对。', 'Loaded cached AI result (no billing). Review checklist on the right.')
            : L(`AI 全自动完成（${secStr} s），请按右侧清单核对。`, `AI automatic processing done (${secStr} s). Review checklist on the right.`),
          6000
        );
      }
    } catch (err) {
      clearInterval(tick);
      if (ctrl.signal.aborted) return;
      state.error = err;
      state.errorStep = state.step;
      state.minimized = false;
      renderProgressOverlay(state);
    }
  }

  /**
   * Intercept single-image drop / paste / pick when AI primary path is ready & consented.
   * Returns true if intercepted by AI flow (or inline Marker picker), false to continue local loading.
   * @param {File} file
   */
  function maybeInterceptDrop(file) {
    if (!file) return false;
    if (/** @type {any} */ (file)._isDemo) return false;
    if (/\.gelfig$|\.json$/i.test(file.name || '')) return false;
    if (activeRun) {
      if (win.UI?.toast) {
        win.UI.toast(L('上一张胶图仍在 AI 处理中，请等待完成或先取消后再导入新图。', 'Another gel is currently running in AI mode. Wait for it to finish or cancel it first.'), 4500);
      }
      return true;
    }
    if (!isAIPrimaryReady()) return false;

    const ladId = defaultLadderId();
    if (!ladId) {
      if (win.App?.S) {
        // User already has an image open: do not mutate hidden welcome picker state
        if (win.UI?.toast) {
          win.UI.toast(L('请先选择默认 Marker 型号，或点击「AI 助手」处理新图。', 'Select a default Marker model or use AI Assistant.'), 4500);
        }
        return false;
      }
      pendingDropFile = file;
      pickerOpen = true;
      renderWelcome();
      return true;
    }
    runPrimaryAI(file, ladId);
    return true;
  }

  function syncSharedMounts() {
    const hasImg = !!win.App?.S;
    const autoHome = document.getElementById('autoFlowHome');
    const panelEl = document.getElementById('panel');
    const autoSlot = document.getElementById('welcomeAutoSlot');
    if (autoHome) {
      if (!hasImg && autoSlot) {
        if (!autoSlot.contains(autoHome)) autoSlot.appendChild(autoHome);
      } else if (panelEl && !panelEl.contains(autoHome)) {
        panelEl.insertBefore(autoHome, panelEl.firstChild);
      }
    }
    const draftBox = document.getElementById('draftBox');
    const emptyEl = document.getElementById('emptyState');
    const draftSlot = document.getElementById('welcomeDraftSlot');
    if (draftBox) {
      if (!hasImg && draftSlot) {
        if (!draftSlot.contains(draftBox)) draftSlot.appendChild(draftBox);
      } else if (emptyEl && !emptyEl.contains(draftBox)) {
        emptyEl.appendChild(draftBox);
      }
    }
  }

  function init() {
    const appEl = document.getElementById('app');
    if (!appEl) return;
    welcomeEl = document.getElementById('welcomeView');
    if (!welcomeEl) {
      welcomeEl = document.createElement('section');
      welcomeEl.id = 'welcomeView';
      welcomeEl.className = 'welcome-view';
      welcomeEl.setAttribute('aria-label', L('欢迎页', 'Welcome'));
      appEl.insertBefore(welcomeEl, appEl.firstChild);
    }
    // Rename legacy #emptyState buttons so #welcomeView owns the single visible #btnDemo & #btnHistoryStart
    const oldDemo = document.querySelector('#emptyState #btnDemo');
    if (oldDemo) oldDemo.id = 'btnDemoLegacy';
    const oldHist = document.querySelector('#emptyState #btnHistoryStart');
    if (oldHist) oldHist.id = 'btnHistoryStartLegacy';

    if (win.App?.on) {
      win.App.on(w => {
        if (w === 'loaded') {
          if (demoBannerEl && !win.App.isDemo) { demoBannerEl.remove(); demoBannerEl = null; }
          syncSharedMounts();
          if (!win.App.S) renderWelcome();
        }
      });
    }
    win.addEventListener('gelfigure-ai-settings-saved', renderWelcome);
    win.addEventListener('gelfigure-ai-settings-changed', renderWelcome);
    win.addEventListener('gelfigure-ai-consent-changed', renderWelcome);
    win.addEventListener('gelfigure-ladders', renderWelcome);
    if (win.I18N?.onChange) win.I18N.onChange(renderWelcome);
    if (win.Ladders?.ready) win.Ladders.ready.then(renderWelcome);
    renderWelcome();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  win.WelcomeAI = {
    render: renderWelcome,
    runDemoAI,
    runPrimaryAI,
    maybeInterceptDrop,
    isAIPrimaryReady,
    defaultLadderId,
    setDefaultLadderId
  };
})(window);
