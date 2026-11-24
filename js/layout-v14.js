// @ts-check
/* v1.4.0 Layout Refactor & Mobile Lite:
 * - W3 Figure-First Main View + Top Segmented View Switcher (StageView)
 * - W4 Left Stepped Accordion (Steps 1-4 + Collapsible Advanced) (StepAccordion)
 * - W5 Unified AI Assistant Modal + Searchable Marker Combobox (AIAssistant)
 * - 4.6 Mobile Lite (Review bar + 4-tab bottom nav + Names editor + Review sheet) (MobileLite) */
(function (G) {
  'use strict';
  /** @type {any} */
  const win = G;
  const L = (zh, en) => (win.L ? win.L(zh, en) : zh);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));

  /* ======================================================================
   * W3: Figure-First Main View + Segmented Stage Switcher
   * ====================================================================== */
  /** @type {'fig' | 'raw'} */
  let stageMode = 'fig';
  let autoRawReturn = false;
  /** @type {HTMLElement | null} */
  let switcherEl = null;

  const RAW_ONLY_MODES = new Set(['marker-band', 'marker-lane', 'box', 'bracket', 'lane']);

  function setStageMode(mode, opts) {
    const next = mode === 'raw' ? 'raw' : 'fig';
    const prev = stageMode;
    const changed = prev !== next || !document.body.classList.contains('stage-' + next);
    if (opts?.autoFromMode && next === 'raw' && prev === 'fig') {
      autoRawReturn = true;
    } else if (!opts?.autoFromMode) {
      autoRawReturn = false;
    }
    stageMode = next;
    document.body.classList.toggle('stage-fig', next === 'fig');
    document.body.classList.toggle('stage-raw', next === 'raw');
    if (switcherEl) {
      switcherEl.querySelectorAll('[data-stage-view]').forEach(btn => {
        btn.classList.toggle('on', /** @type {HTMLElement} */ (btn).dataset.stageView === next);
      });
      const figCtrl = switcherEl.querySelector('#stageFigControls');
      if (figCtrl) figCtrl.classList.toggle('hidden', next !== 'fig');
    }
    if (win.App?.S && !win.UI?.isPhone?.()) {
      if (next === 'raw') {
        // Resize synchronously so MarkerUI.open / fitMarker / bandPicker read real visible canvas bounds immediately
        win.Editor?.resize?.();
        requestAnimationFrame(() => {
          win.Editor?.resize?.();
          if (opts?.fitCrop !== false) win.Editor?.fitCrop?.();
        });
      } else if (changed || opts?.refit) {
        requestAnimationFrame(() => {
          win.UI?.updatePreview?.();
          win.ReviewChecklist?.render?.();
        });
      }
    }
  }

  /** @param {string | null} mode */
  function onModeChange(mode) {
    if (!win.App?.S || win.UI?.isPhone?.()) return;
    if (mode && RAW_ONLY_MODES.has(mode)) {
      setStageMode('raw', { fitCrop: mode !== 'marker-band', autoFromMode: true });
    } else if (mode === 'group') {
      setStageMode('fig');
    } else if (!mode && autoRawReturn) {
      autoRawReturn = false;
      setStageMode('fig');
    }
  }

  function updateStageMeta() {
    if (!switcherEl || !win.App?.S) return;
    const zPct = switcherEl.querySelector('#stageZoomPct');
    if (zPct && win.UI?.figZoom) {
      zPct.textContent = Math.round(win.UI.figZoom() * 100) + '%';
    }
    const dimEl = switcherEl.querySelector('#stageDimPill');
    if (dimEl) {
      const f = win.UI?.lastFig?.();
      const mm = v => (v / (win.Render?.MM || (72 / 25.4))).toFixed(1);
      const eff = win.App.effectiveDpi ? Math.round(win.App.effectiveDpi()) : 0;
      if (f) {
        dimEl.textContent = L(
          `${mm(f.w)} × ${mm(f.h)} mm · 胶图有效 ${eff} dpi`,
          `${mm(f.w)} × ${mm(f.h)} mm · effective ${eff} dpi`
        );
      } else {
        dimEl.textContent = '';
      }
    }
  }

  function buildStageSwitcher() {
    const stageEl = document.getElementById('stage');
    if (!stageEl) return;
    switcherEl = document.getElementById('stageSwitcher');
    if (!switcherEl) {
      switcherEl = document.createElement('div');
      switcherEl.id = 'stageSwitcher';
      switcherEl.className = 'stage-switcher';
      stageEl.insertBefore(switcherEl, stageEl.firstChild);
    }
    switcherEl.innerHTML = `
      <div class="stage-seg" role="tablist" aria-label="${L('主画布视图', 'Main canvas view')}">
        <button type="button" class="stage-seg-btn${stageMode === 'fig' ? ' on' : ''}" data-stage-view="fig" role="tab">${L('成图', 'Figure')}</button>
        <button type="button" class="stage-seg-btn${stageMode === 'raw' ? ' on' : ''}" data-stage-view="raw" role="tab">${L('原图（调泳道 / 裁切）', 'Raw image (lanes / crop)')}</button>
      </div>
      <div class="stage-meta-controls${stageMode === 'fig' ? '' : ' hidden'}" id="stageFigControls">
        <div class="stage-zoom-group">
          <button type="button" class="stage-zoom-btn" id="stageZoomOut" title="${L('缩小成图', 'Zoom out')}">−</button>
          <span class="stage-zoom-pct" id="stageZoomPct">100%</span>
          <button type="button" class="stage-zoom-btn" id="stageZoomIn" title="${L('放大成图', 'Zoom in')}">+</button>
        </div>
        <button type="button" class="stage-fit-btn" id="stageZoomFit">${L('适应', 'Fit')}</button>
        <span class="stage-dim-pill" id="stageDimPill"></span>
      </div>`;

    switcherEl.querySelectorAll('[data-stage-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        const v = /** @type {HTMLElement} */ (btn).dataset.stageView;
        setStageMode(v === 'raw' ? 'raw' : 'fig');
      });
    });
    switcherEl.querySelector('#stageZoomOut')?.addEventListener('click', () => {
      const z = win.UI?.figZoom?.() || 1;
      win.UI?.setFigZoom?.(Math.max(0.5, +(z - 0.15).toFixed(2)));
      updateStageMeta();
    });
    switcherEl.querySelector('#stageZoomIn')?.addEventListener('click', () => {
      const z = win.UI?.figZoom?.() || 1;
      win.UI?.setFigZoom?.(Math.min(3, +(z + 0.15).toFixed(2)));
      updateStageMeta();
    });
    switcherEl.querySelector('#stageZoomFit')?.addEventListener('click', () => {
      win.UI?.setFigZoom?.(1);
      updateStageMeta();
    });
    updateStageMeta();
  }

  /* ======================================================================
   * W4: Left Stepped Accordion (Steps 1–4 + Collapsible Advanced)
   * ====================================================================== */
  let activeStep = 3; // Default to Step 3 (命名与标注) after import, matching mockups/editor.png
  /** @type {HTMLElement | null} */
  let accRoot = null;

  function setActiveStep(stepNum, opts) {
    activeStep = Math.max(1, Math.min(4, stepNum));
    if (accRoot) {
      accRoot.querySelectorAll('.step-card').forEach(card => {
        const n = Number(/** @type {HTMLElement} */ (card).dataset.step);
        card.classList.toggle('open', n === activeStep);
        card.classList.toggle('done', n < activeStep);
        const badge = card.querySelector('.step-badge');
        if (badge) badge.textContent = n < activeStep ? '✓' : String(n);
      });
    }
    if (!opts?.noSwitch && win.App?.S && !win.UI?.isPhone?.()) {
      // W3 rule: entering Step 1 switches to Raw image; leaving switches back to Figure
      setStageMode(activeStep === 1 ? 'raw' : 'fig');
    }
    if (activeStep === 3) renderStep3LaneInputs();
  }

  function renderStep3LaneInputs() {
    const list = document.getElementById('step3LaneList');
    const S = win.App?.S;
    if (!list || !S) return;
    const figLanes = win.UI?.figLanes ? win.UI.figLanes() : [];
    const markerSet = new Set((S.markers || []).map(m => m.lane));
    // Avoid rebuilding while the user is actively typing in one of our inputs
    if (document.activeElement && list.contains(document.activeElement) && list.childElementCount === figLanes.length) {
      return;
    }
    list.innerHTML = '';
    figLanes.forEach((li, idx) => {
      const lane = S.lanes[li];
      if (!lane) return;
      const row = document.createElement('div');
      row.className = 'step3-lane-row';
      const num = document.createElement('span');
      num.className = 'step3-lane-num';
      num.textContent = String(idx + 1);
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'step3-lane-input' + (markerSet.has(li) ? ' is-marker' : '');
      inp.value = lane.name || '';
      inp.placeholder = markerSet.has(li) ? 'M' : L('输入泳道名…', 'Lane name…');
      inp.dataset.laneIdx = String(li);
      inp.setAttribute('aria-label', L(`泳道 ${idx + 1} 名称`, `Lane ${idx + 1} name`));
      inp.addEventListener('input', () => {
        if (!win.App?.S?.lanes?.[li]) return;
        win.App.S.lanes[li].name = inp.value;
        win.App.refresh?.();
      });
      inp.addEventListener('change', () => {
        win.App?.commit?.();
      });
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.isComposing) {
          e.preventDefault();
          const next = list.querySelectorAll('.step3-lane-input')[idx + 1];
          if (next) /** @type {HTMLElement} */ (next).focus();
        }
      });
      row.appendChild(num);
      row.appendChild(inp);
      list.appendChild(row);
    });
  }

  function updateStepSummaries() {
    if (!accRoot || !win.App?.S) return;
    const S = win.App.S;
    const figLanes = win.UI?.figLanes ? win.UI.figLanes() : [];
    const rot = (S.rotation || 0).toFixed(1);
    const s1 = accRoot.querySelector('[data-step-sum="1"]');
    if (s1) {
      s1.textContent = L(`${figLanes.length} 泳道 · 转正 ${rot}°`, `${figLanes.length} lanes · ${rot}°`);
    }
    const s2 = accRoot.querySelector('[data-step-sum="2"]');
    if (s2) {
      const m0 = S.markers?.[0];
      const lad = m0 && win.Ladders?.get ? win.Ladders.get(m0.ladderId) : null;
      const shown = m0 ? (m0.bands || []).filter(b => b.show !== false).length : 0;
      const total = lad?.sizes?.length || (m0?.bands?.length || 0);
      s2.textContent = lad
        ? `${lad.name.replace(/\s*\(.*\)$/, '')} · ${shown}/${total}`
        : L('未选 Marker', 'No marker');
    }
    const s3 = accRoot.querySelector('[data-step-sum="3"]');
    if (s3) {
      const named = figLanes.filter(li => (S.lanes[li]?.name || '').trim().length > 0).length;
      s3.textContent = L(`已填 ${named}/${figLanes.length}`, `${named}/${figLanes.length} named`);
    }
    const s4 = accRoot.querySelector('[data-step-sum="4"]');
    if (s4) {
      const wMm = Math.round(S.style?.gelW || 85);
      const font = S.style?.fontFamily || 'Arial';
      const pt = S.style?.fontPt || 7;
      const dpi = S.style?.dpi || 600;
      s4.textContent = `${wMm} mm · ${font} ${pt} pt · ${dpi} dpi`;
    }
    renderStep3LaneInputs();
  }

  function initStepAccordion() {
    const sectionsEl = document.getElementById('sections');
    if (!sectionsEl || document.getElementById('stepAccordion')) return;

    const secs = Array.from(sectionsEl.querySelectorAll(':scope > section.sec'));
    const imgSec = document.getElementById('imageSection') || secs[0];
    const laneSec = document.getElementById('laneSection') || secs[1];
    const markerSec = document.getElementById('markerSection') || secs[2];
    const annoSec = document.getElementById('annoSection') || secs[3];
    const layoutSec = document.getElementById('layoutSection') || secs[4];
    const legendHints = document.getElementById('legendHints');
    if (!imgSec || !laneSec || !markerSec || !annoSec || !layoutSec) return;
    if (!laneSec.id) laneSec.id = 'laneSection';
    if (!markerSec.id) markerSec.id = 'markerSection';
    if (!annoSec.id) annoSec.id = 'annoSection';

    accRoot = document.createElement('div');
    accRoot.id = 'stepAccordion';
    accRoot.className = 'step-accordion';

    const makeStep = (num, zh, en) => {
      const card = document.createElement('div');
      card.className = 'step-card';
      card.dataset.step = String(num);
      card.innerHTML = `
        <button type="button" class="step-card-head" data-step-toggle="${num}">
          <span class="step-badge">${num}</span>
          <span class="step-title" data-step-title="${num}">${esc(L(zh, en))}</span>
          <span class="step-summary" data-step-sum="${num}"></span>
        </button>
        <div class="step-card-body" data-step-body="${num}"></div>`;
      card.querySelector('[data-step-toggle]')?.addEventListener('click', () => setActiveStep(num));
      return card;
    };

    const st1 = makeStep(1, '校正', 'Correct');
    const st2 = makeStep(2, 'Marker', 'Marker');
    const st3 = makeStep(3, '命名与标注', 'Names & Labels');
    const st4 = makeStep(4, '版式与导出', 'Layout & Export');

    st1.querySelector('[data-step-body="1"]')?.append(imgSec, laneSec);
    st2.querySelector('[data-step-body="2"]')?.append(markerSec);

    const step3Body = st3.querySelector('[data-step-body="3"]');
    if (step3Body) {
      const namesBox = document.createElement('div');
      namesBox.className = 'step3-names-box';
      namesBox.id = 'step3NamesBox';
      namesBox.innerHTML = `
        <div class="step3-names-head">
          <strong>${L('泳道名', 'Lane names')}</strong>
          <div style="display:flex;gap:5px;" id="step3NamesActions">
            <button type="button" class="btn sm" id="btnStep3Paste">${L('批量粘贴', 'Paste')}</button>
          </div>
        </div>
        <div id="step3LaneList" class="step3-lane-list"></div>`;
      namesBox.querySelector('#btnStep3Paste')?.addEventListener('click', () => {
        document.getElementById('btnBulkNames')?.click();
      });
      step3Body.append(namesBox, annoSec);
    }

    const step4Body = st4.querySelector('[data-step-body="4"]');
    if (step4Body) {
      step4Body.append(layoutSec);
      const qExp = document.createElement('div');
      qExp.className = 'step4-quick-export';
      qExp.innerHTML = `
        <button type="button" class="btn sm primary" id="btnStep4ExportPNG">${L('导出高清 PNG', 'Export PNG')}</button>
        <button type="button" class="btn sm" id="btnStep4ExportReview">${L('导出审阅包 (ZIP)', 'Export Review Package (ZIP)')}</button>`;
      qExp.querySelector('#btnStep4ExportPNG')?.addEventListener('click', () => document.getElementById('btnPNG')?.click());
      qExp.querySelector('#btnStep4ExportReview')?.addEventListener('click', () => document.getElementById('btnReviewPackage')?.click());
      step4Body.appendChild(qExp);
    }

    // Bottom collapsible Advanced section (processing log, review package, densitometry hook for v1.6)
    const adv = document.createElement('details');
    adv.id = 'advancedStep';
    adv.className = 'step-advanced';
    adv.innerHTML = `
      <summary><svg class="ic ic-14"><use href="#i-settings"/></svg> <span id="advSummaryLabel">${L('高级：处理日志 · 审阅包 · 灰度定量', 'Advanced: Log · Review ZIP · Densitometry')}</span></summary>
      <div class="step-advanced-body">
        <div id="densitometrySlot"></div>
        <button type="button" class="btn sm step-adv-btn" id="btnAdvLog">${L('导出处理日志 (JSON)', 'Export processing log (JSON)')}</button>
        <button type="button" class="btn sm step-adv-btn" id="btnAdvReview">${L('一键导出审阅包 (ZIP)', 'Export review package (ZIP)')}</button>
        <button type="button" class="btn sm step-adv-btn" id="btnAdvLabTpl">${L('实验室默认版式设置', 'Lab default layout settings')}</button>
      </div>`;
    adv.querySelector('#btnAdvLog')?.addEventListener('click', () => document.getElementById('btnLog')?.click());
    adv.querySelector('#btnAdvReview')?.addEventListener('click', () => document.getElementById('btnReviewPackage')?.click());
    adv.querySelector('#btnAdvLabTpl')?.addEventListener('click', () => win.AIClient?.openSettings?.('layout'));

    accRoot.append(st1, st2, st3, st4, adv);
    if (legendHints) accRoot.appendChild(legendHints);
    const storageNote = imgSec.querySelector('.storage-note');
    if (storageNote) sectionsEl.appendChild(storageNote);
    sectionsEl.appendChild(accRoot);

    // Clicking non-mode raw-image tools automatically switches stage to 'raw'
    ['btnPerspective', 'btnRedetectCrop', 'btnAutoLanes'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', () => {
        if (!win.UI?.isPhone?.() && win.App?.S) {
          setStageMode('raw', { fitCrop: id !== 'btnPerspective' });
          if (id === 'btnPerspective') requestAnimationFrame(() => win.Editor?.fitFull?.());
        }
      });
    });

    setActiveStep(3, { noSwitch: true });
  }

  function refreshAccordionLabels() {
    if (!accRoot) return;
    const labels = [
      [1, L('校正', 'Correct')],
      [2, L('Marker', 'Marker')],
      [3, L('命名与标注', 'Names & Labels')],
      [4, L('版式与导出', 'Layout & Export')]
    ];
    for (const [n, text] of labels) {
      const el = accRoot.querySelector(`[data-step-title="${n}"]`);
      if (el) el.textContent = String(text);
    }
    const advLbl = document.getElementById('advSummaryLabel');
    if (advLbl) advLbl.textContent = L('高级：处理日志 · 审阅包 · 灰度定量', 'Advanced: Log · Review ZIP · Densitometry');
    updateStepSummaries();
  }

  /* ======================================================================
   * W5: Unified AI Assistant + Searchable Marker Combobox
   * ====================================================================== */
  /** @type {HTMLElement | null} */
  let hubDlg = null;
  let hubQuery = '';

  function allLaddersList() {
    const out = [];
    if (!win.Ladders?.ordered) return out;
    for (const kind of ['dna', 'protein']) {
      for (const lad of win.Ladders.ordered(kind)) {
        out.push({ ...lad, kind, fav: !!win.Ladders.isFavorite?.(lad.id) });
      }
    }
    // Pin favorites to top
    out.sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0));
    return out;
  }

  function renderAIAssistant() {
    if (!hubDlg) return;
    const configured = !!win.AIClient?.configured;
    const ep = /** @type {HTMLInputElement | null} */ (document.getElementById('aiEndpoint'))?.value?.trim() || '';
    const consented = !!win.AIConsent?.isConsented(ep);
    const activeProfile = win.AIClient?.activeProfile || null;
    const savedProfiles = Array.isArray(win.AIClient?.profiles) ? win.AIClient.profiles : [];
    const hasImg = !!win.App?.S;
    const selectedId = win.WelcomeAI?.defaultLadderId?.() || win.App?.S?.markers?.[0]?.ladderId || '';
    const q = hubQuery.trim().toLowerCase();
    const filtered = allLaddersList().filter(l => !q || l.name.toLowerCase().includes(q) || l.id.toLowerCase().includes(q));
    const statusSub = configured
      ? [activeProfile?.name, win.AIConsent?.hostOf(ep) || ''].filter((v, i, a) => v && a.indexOf(v) === i).join(' · ')
      : L('3 分钟向导，支持阿里云百炼 / OpenAI / Gemini / 自定义', '3-min wizard for Bailian / OpenAI / Gemini / Custom');

    hubDlg.innerHTML = `
      <div class="ai-hub-card" role="dialog" aria-modal="true" aria-label="${L('AI 助手', 'AI Assistant')}">
        <div class="ai-hub-head">
          <h2><svg class="ic"><use href="#i-sparkle"/></svg> ${L('AI 助手', 'AI Assistant')}</h2>
          <button type="button" class="btn sm" id="aiHubClose">${L('关闭', 'Close')}</button>
        </div>
        <div class="ai-hub-body">
          <div class="ai-hub-status">
            <div class="ai-hub-status-main">
              <strong>${configured ? (consented ? L('AI 接口已就绪', 'AI API ready') : L('AI 已填 Key（待隐私确认）', 'Key saved (consent pending)')) : L('尚未配置 AI 接口', 'AI API not configured')}</strong>
              <div style="color:var(--muted);margin-top:2px;">${esc(statusSub)}</div>
            </div>
            <div class="ai-hub-status-actions">
              ${savedProfiles.length > 1 ? `<select id="aiHubProfileSelect" class="ai-hub-profile-select" aria-label="${L('切换已保存的 API 配置', 'Switch saved API profile')}">${savedProfiles.map(pr => `<option value="${esc(pr.id)}"${pr.active ? ' selected' : ''}>${esc(pr.name)}</option>`).join('')}</select>` : ''}
              <button type="button" class="btn sm${configured && consented ? '' : ' primary'}" id="aiHubSetupBtn">${configured ? L('管理配置', 'Settings') : L('配置向导', 'Setup wizard')}</button>
            </div>
          </div>

          <div class="ai-hub-combo">
            <label for="aiUnifiedLadderSearch">${L('统一 Marker 型号选择（支持搜索，实验室常用置顶 ★）', 'Unified Marker model combobox (searchable, favorites pinned ★)')}</label>
            <input type="search" id="aiUnifiedLadderSearch" value="${esc(hubQuery)}" placeholder="${L('搜索型号，如 DL2000、1 kb Plus、PageRuler…', 'Search e.g. DL2000, 1 kb Plus, PageRuler…')}">
            <div class="ai-hub-combo-list" id="aiUnifiedLadderList">
              ${filtered.slice(0, 30).map(l => `
                <button type="button" class="ai-hub-combo-item${l.id === selectedId ? ' on' : ''}" data-hub-lad="${esc(l.id)}">
                  <span>${l.fav ? '★ ' : ''}${esc(l.name)}</span>
                  <span style="font-size:11px;color:var(--muted);">${l.kind === 'protein' ? 'kDa' : 'bp'}</span>
                </button>`).join('') || `<div style="padding:10px;font-size:12px;color:var(--muted);">${L('未找到匹配型号', 'No matching models')}</div>`}
            </div>
          </div>

          <div class="ai-hub-actions">
            <button type="button" class="ai-hub-action-card" id="aiHubAutoFlow">
              <strong>${L('AI 全自动处理', 'AI Auto-Flow')}</strong>
              <span>${L('导入新图自动完成透视、泳道与 Marker 标注', 'Import a gel for full perspective, lane & Marker detection')}</span>
            </button>
            <button type="button" class="ai-hub-action-card" id="aiHubLayout" ${hasImg ? '' : 'disabled'}>
              <strong>${L('AI 泳道校正与透视', 'AI Lane & Perspective')}</strong>
              <span>${L('左图右复核、底部应用；可微调四角与空道', 'Side-by-side review & apply for lanes and corners')}</span>
            </button>
            <button type="button" class="ai-hub-action-card" id="aiHubMarker" ${hasImg ? '' : 'disabled'}>
              <strong>${L('AI Marker 复核', 'AI Marker Review')}</strong>
              <span>${L('AI 与本地识别（离线）并排对比并微调条带', 'Compare AI vs Local detection (offline) & tune bands')}</span>
            </button>
          </div>
        </div>
      </div>`;

    hubDlg.querySelector('#aiHubClose')?.addEventListener('click', closeAIAssistant);
    const hubProfSel = /** @type {HTMLSelectElement | null} */ (hubDlg.querySelector('#aiHubProfileSelect'));
    if (hubProfSel) {
      hubProfSel.addEventListener('change', () => {
        if (win.AIClient?.selectProfile) {
          win.AIClient.selectProfile(hubProfSel.value);
          renderAIAssistant();
        }
      });
    }
    hubDlg.querySelector('#aiHubSetupBtn')?.addEventListener('click', () => {
      closeAIAssistant();
      if (configured || savedProfiles.length) win.AIClient?.openSettings?.('ai');
      else if (win.AIWizard) win.AIWizard.open(1);
      else win.AIClient?.openSettings?.('ai');
    });
    const searchEl = /** @type {HTMLInputElement | null} */ (hubDlg.querySelector('#aiUnifiedLadderSearch'));
    if (searchEl) {
      searchEl.addEventListener('input', () => {
        hubQuery = searchEl.value;
        const listEl = hubDlg?.querySelector('#aiUnifiedLadderList');
        if (!listEl) return;
        const ql = hubQuery.trim().toLowerCase();
        const fl = allLaddersList().filter(l => !ql || l.name.toLowerCase().includes(ql) || l.id.toLowerCase().includes(ql));
        const curSel = win.WelcomeAI?.defaultLadderId?.() || win.App?.S?.markers?.[0]?.ladderId || '';
        listEl.innerHTML = fl.slice(0, 30).map(l => `
          <button type="button" class="ai-hub-combo-item${l.id === curSel ? ' on' : ''}" data-hub-lad="${esc(l.id)}">
            <span>${l.fav ? '★ ' : ''}${esc(l.name)}</span>
            <span style="font-size:11px;color:var(--muted);">${l.kind === 'protein' ? 'kDa' : 'bp'}</span>
          </button>`).join('') || `<div style="padding:10px;font-size:12px;color:var(--muted);">${L('未找到匹配型号', 'No matching models')}</div>`;
        bindLadderItems();
      });
    }
    const bindLadderItems = () => {
      hubDlg?.querySelectorAll('[data-hub-lad]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = /** @type {HTMLElement} */ (btn).dataset.hubLad || '';
          if (!id) return;
          win.WelcomeAI?.setDefaultLadderId?.(id);
          if (win.App?.S) {
            const lad = win.Ladders?.get?.(id);
            const targetKind = lad && win.Ladders?.kindOf ? win.Ladders.kindOf(lad) : null;
            if (targetKind && win.App.gelKind?.() !== targetKind && win.App.setGelType) {
              win.App.setGelType(targetKind);
            }
            if (win.App.S.markers?.[0]) {
              const sel = /** @type {HTMLSelectElement | null} */ (document.querySelector('[data-mi="0"] [data-f="ladder"]'));
              if (sel && Array.from(sel.options).some(o => o.value === id)) {
                sel.value = id;
                sel.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }
          }
          renderAIAssistant();
        });
      });
    };
    bindLadderItems();

    hubDlg.querySelector('#aiHubAutoFlow')?.addEventListener('click', () => {
      closeAIAssistant();
      document.getElementById('btnAutoFlow')?.click();
    });
    hubDlg.querySelector('#aiHubLayout')?.addEventListener('click', () => {
      closeAIAssistant();
      if (win.GelAIBeta?.open) win.GelAIBeta.open();
      else document.getElementById('btnLayoutBeta')?.click();
    });
    hubDlg.querySelector('#aiHubMarker')?.addEventListener('click', () => {
      closeAIAssistant();
      if (win.MarkerAI?.open) win.MarkerAI.open();
      else document.getElementById('btnMarkerAI')?.click();
    });
  }

  function openAIAssistant() {
    if (!hubDlg) {
      hubDlg = document.createElement('div');
      hubDlg.id = 'aiAssistantModal';
      hubDlg.className = 'ai-hub-dlg';
      hubDlg.addEventListener('click', e => { if (e.target === hubDlg) closeAIAssistant(); });
      document.body.appendChild(hubDlg);
    }
    hubDlg.classList.remove('hidden');
    renderAIAssistant();
  }

  function closeAIAssistant() {
    if (hubDlg) hubDlg.classList.add('hidden');
  }

  /* ======================================================================
   * 4.6 Mobile Lite: Top Review Bar + Names Editor + Desktop Hint + Review Sheet
   * ====================================================================== */
  /** @type {HTMLElement | null} */
  let mReviewBar = null;
  /** @type {HTMLElement | null} */
  let mDesktopHint = null;
  /** @type {HTMLElement | null} */
  let mNamesView = null;
  /** @type {HTMLElement | null} */
  let mReviewSheet = null;

  function renderMobileReviewBar() {
    if (!mReviewBar) return;
    const S = win.App?.S;
    if (!S || !win.ReviewChecklist) {
      mReviewBar.classList.remove('has-items');
      mReviewBar.innerHTML = '';
      return;
    }
    const items = win.ReviewChecklist.pendingItems || win.ReviewChecklist.items || [];
    const pending = win.ReviewChecklist.pendingCount || 0;
    if (pending <= 0 || !items.length) {
      mReviewBar.classList.remove('has-items');
      mReviewBar.innerHTML = '';
      return;
    }
    const first = items[0];
    mReviewBar.classList.add('has-items');
    mReviewBar.innerHTML = `
      <span class="m-review-badge">${L(`待核对 ${pending}`, `Review ${pending}`)}</span>
      <span class="m-review-title">${esc(first ? first.title : L('有待核对项目', 'Items need review'))}</span>
      <button type="button" class="m-review-btn" id="btnMobileReviewOpen">${L('查看', 'View')}</button>`;
    mReviewBar.querySelector('#btnMobileReviewOpen')?.addEventListener('click', openMobileReviewSheet);
  }

  function openMobileReviewSheet() {
    if (!mReviewSheet) {
      mReviewSheet = document.createElement('div');
      mReviewSheet.id = 'mobileReviewSheet';
      mReviewSheet.className = 'sheet-wrap hidden';
      mReviewSheet.setAttribute('role', 'dialog');
      mReviewSheet.setAttribute('aria-modal', 'true');
      mReviewSheet.addEventListener('click', e => {
        if (e.target === mReviewSheet || /** @type {HTMLElement} */ (e.target).closest('[data-close]')) {
          mReviewSheet?.classList.add('hidden');
        }
      });
      document.body.appendChild(mReviewSheet);
    }
    const items = win.ReviewChecklist?.pendingItems || win.ReviewChecklist?.items || [];
    mReviewSheet.innerHTML = `
      <div class="sheet">
        <div class="sheet-grip"></div>
        <div class="sheet-head"><h3>${L('待核对清单', 'Review Checklist')}</h3><button type="button" class="sheet-x" data-close aria-label="${L('关闭', 'Close')}">×</button></div>
        <div id="mobileReviewList">
          ${items.map((it, idx) => `
            <div class="m-rev-item">
              <h4>${esc(it.title)}</h4>
              <p>${esc(it.desc)}</p>
              <div class="m-rev-actions">
                ${(it.actions || []).map((a, ai) => `<button type="button" class="btn sm${a.primary ? ' primary' : ''}" data-mrev-it="${idx}" data-mrev-ac="${ai}">${esc(a.label)}</button>`).join('')}
              </div>
            </div>`).join('') || `<p class="hint">${L('全部项目已确认。', 'All items confirmed.')}</p>`}
        </div>
      </div>`;
    mReviewSheet.querySelectorAll('[data-mrev-it]').forEach(btn => {
      btn.addEventListener('click', () => {
        const itIdx = Number(/** @type {HTMLElement} */ (btn).dataset.mrevIt);
        const acIdx = Number(/** @type {HTMLElement} */ (btn).dataset.mrevAc);
        const act = items[itIdx]?.actions?.[acIdx];
        if (act?.run) act.run();
        renderMobileReviewBar();
        if ((win.ReviewChecklist?.pendingCount || 0) <= 0) mReviewSheet?.classList.add('hidden');
        else openMobileReviewSheet();
      });
    });
    mReviewSheet.classList.remove('hidden');
  }

  function renderMobileNamesView() {
    if (!mNamesView || !win.App?.S) return;
    const S = win.App.S;
    const figLanes = win.UI?.figLanes ? win.UI.figLanes() : [];
    const markerSet = new Set((S.markers || []).map(m => m.lane));
    mNamesView.innerHTML = `
      <div class="m-names-head">
        <h3>${L('填写泳道名', 'Lane Names')} (${figLanes.length})</h3>
        <button type="button" class="btn sm" id="btnMobileBulkPaste">${L('批量粘贴', 'Paste')}</button>
      </div>
      <div class="m-names-list" id="mNamesList"></div>`;
    const list = mNamesView.querySelector('#mNamesList');
    if (list) {
      figLanes.forEach((li, idx) => {
        const lane = S.lanes[li];
        if (!lane) return;
        const row = document.createElement('div');
        row.className = 'm-names-row';
        const span = document.createElement('span');
        span.className = 'm-names-idx';
        span.textContent = String(idx + 1);
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.className = 'm-names-input';
        inp.value = lane.name || '';
        inp.placeholder = markerSet.has(li) ? 'M' : L(`泳道 ${idx + 1}`, `Lane ${idx + 1}`);
        inp.addEventListener('input', () => {
          if (!win.App?.S?.lanes?.[li]) return;
          win.App.S.lanes[li].name = inp.value;
          win.App.refresh?.();
        });
        inp.addEventListener('change', () => win.App?.commit?.());
        row.append(span, inp);
        list.appendChild(row);
      });
    }
    mNamesView.querySelector('#btnMobileBulkPaste')?.addEventListener('click', () => {
      win.Mobile?.setView?.('fig');
      document.getElementById('btnBulkNames')?.click();
    });
  }

  function initMobileLite() {
    const appEl = document.getElementById('app');
    if (!appEl) return;
    if (!mReviewBar) {
      mReviewBar = document.createElement('div');
      mReviewBar.id = 'mobileReviewBar';
      mReviewBar.className = 'm-review-bar';
      appEl.parentNode?.insertBefore(mReviewBar, appEl);
    }
    const figCol = document.getElementById('figCol');
    if (figCol && !mDesktopHint) {
      mDesktopHint = document.createElement('div');
      mDesktopHint.id = 'mobileDesktopHint';
      mDesktopHint.className = 'm-desktop-hint';
      mDesktopHint.textContent = L('调泳道、裁切、标注等精细编辑请在电脑上打开同一项目', 'For fine lane, crop & annotation edits, open this project on desktop');
      figCol.appendChild(mDesktopHint);
    }
    if (!mNamesView) {
      mNamesView = document.createElement('section');
      mNamesView.id = 'mobileNamesView';
      mNamesView.className = 'm-names-view';
      mNamesView.setAttribute('aria-label', L('泳道名编辑', 'Edit lane names'));
      appEl.appendChild(mNamesView);
    }
  }

  /* ======================================================================
   * Init & Event Wiring
   * ====================================================================== */
  function init() {
    buildStageSwitcher();
    initStepAccordion();
    initMobileLite();
    setStageMode('fig', { refit: false });

    // Upgrade topbar AI Assistant button to open the W5 Unified AI Assistant
    const topAiBtn = document.getElementById('btnAutoFlowTop');
    if (topAiBtn) {
      topAiBtn.onclick = () => openAIAssistant();
    }

    if (win.App?.on) {
      win.App.on(w => {
        if (w === 'loaded') {
          setActiveStep(3, { noSwitch: true });
          setStageMode('fig', { refit: true });
          updateStepSummaries();
          updateStageMeta();
          renderMobileReviewBar();
          renderMobileNamesView();
        } else if (w === 'change' || w === 'refresh') {
          updateStepSummaries();
          updateStageMeta();
          renderMobileReviewBar();
        }
      });
    }

    if (win.I18N?.onChange) {
      win.I18N.onChange(() => {
        buildStageSwitcher();
        refreshAccordionLabels();
        if (mDesktopHint) {
          mDesktopHint.textContent = L('调泳道、裁切、标注等精细编辑请在电脑上打开同一项目', 'For fine lane, crop & annotation edits, open this project on desktop');
        }
        renderMobileReviewBar();
        renderMobileNamesView();
        if (hubDlg && !hubDlg.classList.contains('hidden')) renderAIAssistant();
      });
    }

    window.addEventListener('keydown', e => {
      if (e.key === 'Escape' && hubDlg && !hubDlg.classList.contains('hidden')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        closeAIAssistant();
      }
    }, true);

    if (win.App?.S) {
      updateStepSummaries();
      updateStageMeta();
      renderMobileReviewBar();
      renderMobileNamesView();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  win.StageView = {
    get mode() { return stageMode; },
    set: setStageMode,
    onModeChange,
    sync: updateStageMeta
  };
  win.StepAccordion = {
    get active() { return activeStep; },
    set: setActiveStep,
    sync: updateStepSummaries
  };
  win.AIAssistant = {
    open: openAIAssistant,
    close: closeAIAssistant
  };
  win.MobileLite = {
    renderReviewBar: renderMobileReviewBar,
    renderNamesView: renderMobileNamesView,
    openReviewSheet: openMobileReviewSheet
  };
})(window);
