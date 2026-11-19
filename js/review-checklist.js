// @ts-check
/* A6 Persistent Right Review Checklist (待核对清单) & Canvas #8B6CF0/#A78BFA Highlight Overlay
 * Surfaces low-confidence AI items, empty lanes, edge lanes, unpaired/mismatched marker bands,
 * default marker confirmation, gel type, perspective corners, and export readiness issues. */
(function (G) {
  'use strict';
  /** @type {any} */
  const win = G;
  const L = (zh, en) => (win.L ? win.L(zh, en) : zh);
  const esc = s => (win.UI?.esc ? win.UI.esc(s) : String(s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])));

  /** @type {Set<string>} */
  const confirmedIds = new Set();
  /** @type {string | null} */
  let activeId = null;
  /** @type {any} */
  let aiMeta = null; // { fromCache?: boolean, isDemoAI?: boolean, onRerun?: () => void, laneConf?: Record<number, number>, elapsedSec?: number }
  /** @type {HTMLElement | null} */
  let panel = null;
  /** @type {HTMLElement | null} */
  let overlayLayer = null;
  let lastProjectKey = '';

  function projectKey() {
    const S = win.App?.S;
    if (!S) return '';
    return (S.file?.sha256 || '') + ':' + (win.App?.projectId || '');
  }

  /**
   * Build live checklist items from App.S, App.preflight(), and optional AI confidence metadata.
   */
  function buildItems() {
    const A = win.App;
    const S = A?.S;
    if (!S) return [];
    const items = [];
    const figLanes = A.figureLanes ? A.figureLanes() : [];
    const crop = S.crop || { x: 0, y: 0, w: 100, h: 100 };

    // 1. Empty / low-confidence lanes
    const emptyLanes = S.lanes.map((l, idx) => ({ l, idx })).filter(({ l, idx }) => {
      if (l.removed || !figLanes.includes(idx)) return false;
      if (S.markers.some(m => m.lane === idx)) return false;
      const conf = aiMeta?.laneConf?.[idx];
      return !!l.empty || (typeof conf === 'number' && conf < 0.72);
    });
    for (const { l, idx } of emptyLanes) {
      const conf = aiMeta?.laneConf?.[idx];
      const disp = l.name ? `${L('泳道', 'Lane')} ${idx + 1} (${l.name})` : `${L('泳道', 'Lane')} ${idx + 1}`;
      items.push({
        id: 'empty-lane-' + idx,
        title: `${disp} ${L('可能是空道', 'may be empty')}`,
        desc: L('几乎检测不到条带。剪除会加拼接标记并记录。', 'Very weak or no band detected. Hiding inserts a splice mark.'),
        conf: typeof conf === 'number' ? Math.round(conf * 100) : 62,
        target: { kind: 'lane', laneIdx: idx, dashed: false },
        actions: [
          { label: L('保留', 'Keep'), primary: true, run: () => { confirmItem('empty-lane-' + idx); } },
          {
            label: L('剪除', 'Cut'),
            run: () => {
              l.removed = true;
              A.commit();
              confirmItem('empty-lane-' + idx);
            }
          },
          { label: L('定位', 'Locate'), ghost: true, run: () => locateItem('empty-lane-' + idx, idx) }
        ]
      });
    }

    // 2. Edge lanes close to crop boundary
    const edgeIdx = figLanes.length ? figLanes[figLanes.length - 1] : -1;
    if (edgeIdx >= 0) {
      const el = S.lanes[edgeIdx];
      const rightGap = (crop.x + crop.w) - el.x;
      const avgGap = figLanes.length > 1
        ? (S.lanes[figLanes[figLanes.length - 1]].x - S.lanes[figLanes[0]].x) / (figLanes.length - 1)
        : crop.w / 8;
      if (rightGap < avgGap * 0.62 || aiMeta?.isDemoAI) {
        const id = 'edge-lane-' + edgeIdx;
        items.push({
          id,
          title: `${L('泳道', 'Lane')} ${edgeIdx + 1} ${L('贴近裁切边缘', 'near crop edge')}`,
          desc: L('右侧可能有未框入的泳道或裁切偏紧。', 'Check whether the right edge clips an adjacent lane.'),
          conf: 74,
          target: { kind: 'lane', laneIdx: edgeIdx, dashed: true },
          actions: [
            {
              label: L('扩大裁切', 'Expand crop'),
              run: () => {
                const imgW = A.ensureRot ? A.ensureRot().w : crop.x + crop.w + 20;
                S.crop.w = Math.min(imgW - S.crop.x, S.crop.w + Math.round(avgGap * 0.35));
                A.commit();
                confirmItem(id);
              }
            },
            { label: L('没问题', 'Looks good'), run: () => confirmItem(id) }
          ]
        });
      }
    }

    // 3. Unpaired / mismatched marker bands
    S.markers.forEach((m, mi) => {
      const mismatch = !!m.orderPairing?.mismatch;
      const unlocated = (m.bands || []).filter(b => b.y == null || b.excluded).length;
      if (mismatch || unlocated > 0) {
        const id = 'marker-mismatch-' + mi;
        items.push({
          id,
          title: L('Marker 条带配对需核对', 'Check Marker band pairing'),
          desc: mismatch
            ? L('检出条带数与所选型号不一致，请检查缺失或多余条带。', 'Detected band count differs from selected ladder; check pairing.')
            : L(`有 ${unlocated} 条 Marker 条带未定位或已隐藏。`, `${unlocated} marker band(s) unlocated or excluded.`),
          conf: 78,
          target: { kind: 'lane', laneIdx: m.lane, dashed: true },
          actions: [
            {
              label: L('核对 Marker', 'Review Marker'),
              primary: true,
              run: () => {
                if (win.MarkerUI?.open) win.MarkerUI.open(mi);
                confirmItem(id);
              }
            },
            { label: L('忽略', 'Ignore'), run: () => confirmItem(id) }
          ]
        });
      }

      // 4. Default Marker model confirmation
      const lad = win.Ladders?.get ? win.Ladders.get(m.ladderId) : null;
      const idModel = 'marker-model-' + mi;
      items.push({
        id: idModel,
        title: L('Marker 型号按默认值', 'Confirm Marker model'),
        desc: `${lad ? lad.name : (m.ladderId || L('未指定', 'Unspecified'))} · ${m.bands?.length || 0} ${L('条带', 'bands')}`,
        target: { kind: 'lane', laneIdx: m.lane, dashed: false },
        actions: [
          { label: L('确认', 'Confirm'), primary: true, run: () => confirmItem(idModel) },
          {
            label: L('换型号', 'Change model'),
            run: () => {
              if (win.MarkerUI?.open) win.MarkerUI.open(mi);
            }
          }
        ]
      });
    });

    // 5. Gel type confirmation (auto-confirmed unless user toggles)
    const kindLabel = A.gelKind && A.gelKind() === 'protein' ? L('蛋白胶 (kDa)', 'Protein (kDa)') : L('DNA 胶 (bp)', 'DNA (bp)');
    items.push({
      id: 'gel-type',
      title: `${L('胶的类型：', 'Gel type: ')}${kindLabel}`,
      desc: L('基于图像颜色特征自动判断；黑白蛋白胶请手动切换。', 'Estimated from image colour; switch manually for monochrome protein gels.'),
      defaultConfirmed: true,
      actions: [
        {
          label: L('切换胶种', 'Switch type'),
          run: () => {
            const next = A.gelKind() === 'protein' ? 'dna' : 'protein';
            if (A.setGelType) A.setGelType(next);
            confirmItem('gel-type');
          }
        }
      ]
    });

    // 6. Perspective corners / straightening
    items.push({
      id: 'perspective-check',
      title: S.perspective ? L('透视校正四角', 'Perspective corners') : L('图像方向与转正', 'Orientation & deskew'),
      desc: S.perspective ? L('已完成四点透视校正。', 'Four-corner perspective correction applied.') : L(`当前转正角度 ${(S.rotation || 0).toFixed(1)}°`, `Deskew angle ${(S.rotation || 0).toFixed(1)}°`),
      defaultConfirmed: true,
      actions: []
    });

    // 7. Export readiness issues (preflight)
    const pf = A.preflight ? A.preflight() : [];
    pf.forEach((p, idx) => {
      if (p.level === 'info') return;
      const id = 'preflight-' + idx;
      const acts = [];
      if (p.fix) {
        acts.push({
          label: p.fix.label,
          primary: true,
          run: () => { p.fix.run(); confirmItem(id); }
        });
      }
      acts.push({ label: L('知道了', 'Acknowledge'), run: () => confirmItem(id) });
      items.push({
        id,
        title: p.level === 'block' ? L('导出阻塞项', 'Export blocker') : L('导出质量提醒', 'Export check'),
        desc: p.text,
        severity: p.level,
        actions: acts
      });
    });

    return items;
  }

  function isConfirmed(item) {
    return confirmedIds.has(item.id) || (!!item.defaultConfirmed && !confirmedIds.has('un:' + item.id));
  }

  function confirmItem(id) {
    confirmedIds.add(id);
    if (activeId === id) activeId = null;
    render();
  }

  function locateItem(id, laneIdx) {
    activeId = id;
    if (typeof laneIdx === 'number' && win.App) {
      win.App.selLane = laneIdx;
      win.App.emit('refresh');
    }
    render();
  }

  function renderCanvasPins(pendingItems) {
    const pvBox = document.getElementById('previewBox');
    if (!pvBox) return;
    if (!overlayLayer) {
      overlayLayer = document.createElement('div');
      overlayLayer.id = 'reviewCanvasLayer';
      overlayLayer.className = 'review-canvas-layer';
      pvBox.style.position = 'relative';
      pvBox.appendChild(overlayLayer);
    }
    overlayLayer.innerHTML = '';
    const svg = pvBox.querySelector('#preview svg');
    const A = win.App;
    const S = A?.S;
    if (!svg || !S || !pendingItems.length) return;

    const pvRect = pvBox.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();
    if (svgRect.width < 20 || svgRect.height < 20) return;
    const figLanes = A.figureLanes ? A.figureLanes() : [];
    if (!figLanes.length) return;

    // Approximate gel image region inside preview SVG
    const imgEl = svg.querySelector('image');
    const gelRect = imgEl ? imgEl.getBoundingClientRect() : svgRect;
    const crop = S.crop || { x: 0, y: 0, w: 1, h: 1 };

    let badgeNum = 0;
    for (const item of pendingItems) {
      badgeNum++;
      if (!item.target || item.target.kind !== 'lane') continue;
      const lane = S.lanes[item.target.laneIdx];
      if (!lane) continue;
      const fracX = Math.max(0.02, Math.min(0.98, (lane.x - crop.x) / Math.max(1, crop.w)));
      const laneW = Math.max(16, (gelRect.width / Math.max(1, figLanes.length)) * 0.72);
      const cx = (gelRect.left - pvRect.left) + fracX * gelRect.width;
      const top = (gelRect.top - pvRect.top) - 4;
      const h = gelRect.height + 8;

      const box = document.createElement('div');
      box.className = 'review-pin-box' + (item.target.dashed ? ' dashed' : '');
      box.style.left = Math.round(cx - laneW / 2) + 'px';
      box.style.top = Math.round(top) + 'px';
      box.style.width = Math.round(laneW) + 'px';
      box.style.height = Math.round(h) + 'px';
      if (activeId === item.id) box.style.boxShadow = '0 0 0 2px rgba(139,108,240,0.45)';
      overlayLayer.appendChild(box);

      const pin = document.createElement('button');
      pin.type = 'button';
      pin.className = 'review-pin';
      pin.textContent = String(badgeNum);
      pin.title = item.title;
      pin.style.left = Math.round(cx) + 'px';
      pin.style.top = Math.round(top) + 'px';
      pin.onclick = () => {
        activeId = item.id;
        render();
        const row = panel?.querySelector(`[data-review-id="${item.id}"]`);
        if (row) row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      };
      overlayLayer.appendChild(pin);
    }
  }

  function render() {
    if (!panel) return;
    const A = win.App;
    const S = A?.S;
    if (!S) {
      panel.innerHTML = '';
      if (overlayLayer) overlayLayer.innerHTML = '';
      return;
    }

    const pk = projectKey();
    if (pk !== lastProjectKey) {
      lastProjectKey = pk;
      confirmedIds.clear();
      activeId = null;
    }

    const items = buildItems();
    const pending = items.filter(it => !isConfirmed(it));
    const done = items.filter(it => isConfirmed(it));
    const total = items.length;
    const pct = total ? Math.round((done.length / total) * 100) : 100;

    const pf = A.preflight ? A.preflight() : [];
    const warnCount = pf.filter(p => p.level === 'warn' || p.level === 'block').length;
    const firstWarn = pf.find(p => p.level === 'block' || p.level === 'warn');

    const cacheBanner = aiMeta?.fromCache
      ? `<div class="review-cache-banner">
          <span>${L('使用缓存结果（未计费）', 'Cached AI result (no billing)')}</span>
          <button type="button" class="btn sm ghost" id="btnReviewRerunAI">${L('重新识别', 'Re-run AI')}</button>
        </div>`
      : '';

    const pendingHtml = pending.map((it, idx) => `
      <div class="review-item${activeId === it.id ? ' active' : ''}" data-review-id="${esc(it.id)}">
        <div class="review-item-head">
          <span class="review-badge-num">${idx + 1}</span>
          <div class="review-item-title">${esc(it.title)}</div>
          ${it.conf ? `<span class="review-conf">${it.conf}%</span>` : ''}
        </div>
        <div class="review-item-desc">${esc(it.desc)}</div>
        <div class="review-item-actions">
          ${it.actions.map((a, ai) => `<button type="button" class="btn sm${a.primary ? ' primary' : a.ghost ? ' ghost' : ''}" data-rev-act="${esc(it.id)}:${ai}">${esc(a.label)}</button>`).join('')}
        </div>
      </div>`).join('');

    const doneHtml = done.map(it => `
      <div class="review-item confirmed" data-review-id="${esc(it.id)}">
        <div class="review-item-head">
          <span class="review-badge-num">✓</span>
          <div class="review-item-title">${esc(it.title)}</div>
        </div>
      </div>`).join('');

    panel.innerHTML = `
      <div class="review-head">
        <div class="review-head-top">
          <h3>${L('待核对', 'Review')}</h3>
          <span class="review-count-pill${pending.length === 0 ? ' all-ok' : ''}" id="reviewPendingCount">${pending.length === 0 ? L('全部已确认', 'All checked') : L(`${pending.length} 项`, `${pending.length} left`)}</span>
          <span class="review-progress-text">${done.length}/${total} ${L('已确认', 'checked')}</span>
        </div>
        <div class="review-bar"><div class="review-bar-fill" style="width:${pct}%"></div></div>
      </div>
      ${cacheBanner}
      <div class="review-list" id="reviewList">
        ${pendingHtml}
        ${doneHtml}
      </div>
      <div class="review-foot">
        <div class="review-readiness-line ${warnCount ? 'warn' : 'ok'}">
          <span>${warnCount ? `⚠ ${esc(firstWarn?.text || L(`导出就绪度：${warnCount} 项注意`, `Export checks: ${warnCount} notice(s)`))}` : `✓ ${L('导出就绪度：通过', 'Export readiness: OK')}`}</span>
        </div>
        <div class="review-foot-btns">
          <button type="button" class="btn primary" id="btnReviewConfirmExport">${pending.length ? L('全部确认并导出', 'Confirm all & export') : L('导出 PNG', 'Export PNG')}</button>
        </div>
      </div>`;

    // Wire action buttons
    const itemMap = new Map(items.map(it => [it.id, it]));
    panel.querySelectorAll('[data-rev-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        const [id, idxStr] = (/** @type {HTMLElement} */ (btn).dataset.revAct || '').split(':');
        const it = itemMap.get(id);
        const act = it?.actions?.[Number(idxStr)];
        if (act && act.run) act.run();
      });
    });

    const rerunBtn = panel.querySelector('#btnReviewRerunAI');
    if (rerunBtn && aiMeta?.onRerun) rerunBtn.addEventListener('click', () => aiMeta.onRerun());

    const confirmAllBtn = panel.querySelector('#btnReviewConfirmExport');
    if (confirmAllBtn) {
      confirmAllBtn.addEventListener('click', () => {
        for (const it of items) confirmedIds.add(it.id);
        render();
        const exportBtn = document.getElementById('btnPNG');
        if (exportBtn) exportBtn.click();
      });
    }

    requestAnimationFrame(() => renderCanvasPins(pending));
  }

  function setAIMeta(meta) {
    aiMeta = meta || null;
    render();
  }

  function init() {
    const appEl = document.getElementById('app');
    if (!appEl) return;
    panel = document.getElementById('reviewPanel');
    if (!panel) {
      panel = document.createElement('aside');
      panel.id = 'reviewPanel';
      panel.className = 'review-panel';
      panel.setAttribute('aria-label', L('待核对清单', 'Review checklist'));
      appEl.appendChild(panel);
    }
    if (win.App?.on) {
      win.App.on(w => {
        if (w === 'loaded' || w === 'change' || w === 'refresh') render();
      });
    }
    if (win.I18N?.onChange) win.I18N.onChange(render);
    window.addEventListener('resize', () => { if (win.App?.S) render(); });
    if (win.App?.S) render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  win.ReviewChecklist = {
    render,
    setAIMeta,
    confirmItem,
    get items() { return buildItems(); },
    get pendingCount() { return buildItems().filter(it => !isConfirmed(it)).length; }
  };
})(window);
