// @ts-check
/* 5-step interactive onboarding tour highlighting real controls (4.4).
 * Skippable anytime, stored in PrefStorage, and replayable from Help. */
(function (G) {
  'use strict';
  /** @type {any} */
  const win = G;
  const DONE_KEY = 'gelfig.tourDone.v1';

  /** @type {HTMLElement | null} */
  let rootEl = null;
  let stepIdx = 0;

  function steps() {
    const L = win.L || ((zh, en) => zh);
    const t = (k, zh, en) => (win.I18N && win.I18N.t ? win.I18N.t(k) : '') || L(zh, en);
    return [
      {
        selector: '#emptyState, #imgChip',
        title: t('tour.step1.title', '拖入胶图或试用示例', 'Drop a gel or try the example'),
        body: t('tour.step1.body', '把 TIFF/PNG/JPG 胶图拖进窗口即可开始，也可先用内置示例胶体验完整流程。', 'Drop any TIFF/PNG/JPG gel image into the window to start, or try the built-in example gel first.')
      },
      {
        selector: '#btnAutoFlowTop, #btnAutoFlow',
        title: t('tour.step2.title', 'AI 助手全自动处理', 'AI automatic processing'),
        body: t('tour.step2.body', '配置好视觉 API 后，拖图即可自动完成透视校正、泳道定位与 Marker 条带标注；本地识别始终离线可用。', 'With a vision API configured, dropping a gel runs perspective correction, lane detection and marker labelling automatically; local offline detection is always available.')
      },
      {
        selector: '#previewBox, #figCol',
        title: t('tour.step3.title', '直接点击填写泳道名', 'Click lane names directly'),
        body: t('tour.step3.body', '点击成图上的泳道名即可输入，按回车跳到下一条，也支持批量粘贴整行名称。', 'Click any lane name on the figure to type, press Enter for the next lane, or paste a whole row at once.')
      },
      {
        selector: '#btnPNG, #exportReadiness',
        title: t('tour.step4.title', '导出就绪度与多格式导出', 'Export readiness & formats'),
        body: t('tour.step4.body', '随时查看分辨率、过曝与字号检查，一键导出 PNG、TIFF、SVG、可编辑 PPTX 或审阅包。', 'Inspect resolution, saturation and font-size checks anytime, then export PNG, TIFF, SVG, editable PPTX or a review ZIP.')
      },
      {
        selector: '#btnStarTop, #btnCommunity',
        title: t('tour.step5.title', '觉得好用？点个 Star', 'Find it useful? Star on GitHub'),
        body: t('tour.step5.body', 'GelFigure 完全开源免费，欢迎在 GitHub 点 Star 支持或反馈遇到的问题。', 'GelFigure is free and open-source. Star the repository or open an issue to share feedback.')
      }
    ];
  }

  /** @param {string} sel */
  function findVisibleTarget(sel) {
    for (const part of sel.split(',')) {
      const el = /** @type {HTMLElement | null} */ (document.querySelector(part.trim()));
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 4 && r.height > 4) return el;
    }
    return null;
  }

  function close(markDone) {
    if (rootEl) { rootEl.remove(); rootEl = null; }
    if (markDone && win.PrefStorage) win.PrefStorage.setItem(DONE_KEY, '1');
  }

  function renderStep() {
    const list = steps();
    if (stepIdx >= list.length) { close(true); return; }
    const s = list[stepIdx];
    const L = win.L || ((zh, en) => zh);
    const target = findVisibleTarget(s.selector);
    if (!rootEl) {
      rootEl = document.createElement('div');
      rootEl.id = 'onboardingTour';
      rootEl.innerHTML = '<div class="tour-ring" id="tourRing"></div><div class="tour-card" id="tourCard" role="dialog" aria-modal="true"></div>';
      document.body.appendChild(rootEl);
    }
    const ring = /** @type {HTMLElement} */ (rootEl.querySelector('#tourRing'));
    const card = /** @type {HTMLElement} */ (rootEl.querySelector('#tourCard'));
    const isLast = stepIdx === list.length - 1;
    card.innerHTML = `
      <div class="tour-step-meta">${L(`引导 ${stepIdx + 1} / ${list.length}`, `Tour ${stepIdx + 1} / ${list.length}`)}</div>
      <h4>${s.title}</h4>
      <p>${s.body}</p>
      <div class="tour-actions">
        <button type="button" class="btn sm ghost" id="tourSkip">${L('跳过', 'Skip')}</button>
        <span class="flex"></span>
        ${stepIdx > 0 ? `<button type="button" class="btn sm" id="tourPrev">${L('上一步', 'Back')}</button>` : ''}
        <button type="button" class="btn sm primary" id="tourNext">${isLast ? L('开始使用', 'Get started') : L('下一步', 'Next')}</button>
      </div>`;

    const pad = 6;
    const cw = Math.min(330, window.innerWidth - 24);
    const ch = card.offsetHeight || 170;
    if (target) {
      const r = target.getBoundingClientRect();
      ring.style.display = 'block';
      ring.style.left = Math.max(4, r.left - pad) + 'px';
      ring.style.top = Math.max(4, r.top - pad) + 'px';
      ring.style.width = Math.min(window.innerWidth - 8, r.width + pad * 2) + 'px';
      ring.style.height = Math.min(window.innerHeight - 8, r.height + pad * 2) + 'px';
      const below = r.bottom + 14 + ch < window.innerHeight - 12;
      const top = below ? (r.bottom + 14) : Math.max(12, r.top - ch - 14);
      const left = Math.max(12, Math.min(r.left, window.innerWidth - cw - 12));
      card.style.left = left + 'px';
      card.style.top = top + 'px';
    } else {
      ring.style.display = 'none';
      card.style.left = Math.max(12, (window.innerWidth - cw) / 2) + 'px';
      card.style.top = Math.max(60, (window.innerHeight - ch) / 2) + 'px';
    }

    const skipBtn = /** @type {HTMLButtonElement} */ (card.querySelector('#tourSkip'));
    const nextBtn = /** @type {HTMLButtonElement} */ (card.querySelector('#tourNext'));
    const prevBtn = /** @type {HTMLButtonElement | null} */ (card.querySelector('#tourPrev'));
    skipBtn.onclick = () => close(true);
    nextBtn.onclick = () => { stepIdx++; renderStep(); };
    if (prevBtn) prevBtn.onclick = () => { stepIdx = Math.max(0, stepIdx - 1); renderStep(); };
  }

  /** @param {boolean} [force] */
  function start(force) {
    if (!force && win.PrefStorage && win.PrefStorage.getItem(DONE_KEY) === '1') return;
    stepIdx = 0;
    renderStep();
  }

  function maybeStart() {
    const qs = new URLSearchParams(location.search);
    if (qs.get('demo') || qs.get('src') || qs.get('uitest')) return;
    if (qs.get('tour') === '1') { start(true); return; }
    if (navigator.webdriver) return;
    start(false);
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && rootEl) close(true);
  });
  window.addEventListener('resize', () => { if (rootEl) renderStep(); });

  win.Onboarding = { start, close, maybeStart };
})(window);
