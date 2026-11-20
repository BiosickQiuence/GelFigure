// @ts-check
/* v1.6.0 Basic Grayscale Densitometry (off by default, mounted in Advanced -> #densitometrySlot)
 * + Web-only PWA Service Worker registration (strictly disabled in single-file / file:// mode).
 *
 * Scientific integrity guarantees:
 * - Reads strictly from unclipped linear rotated grayscale pixels (App.rot.data in [0..1]),
 *   NEVER from display-stretched contrast / gamma / inversion pixels.
 * - Background subtraction options: 'rolling_ball' (1D morphological opening), 'lane_edge' (local flanking median), 'none'.
 * - Overexposed / saturated bands (raw linear pixel >= 0.995 on dark-bg or <= 0.005 on light-bg)
 *   are flagged red and strictly BLOCKED from quantification & reference normalization.
 * - Results & parameters are exported to CSV and recorded in Export.processingLog(S). */
(function (G) {
  'use strict';

  const win = /** @type {any} */ (G);
  const L = (zh, en) => (win.L ? win.L(zh, en) : zh);
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const SAT_HIGH = 0.995;
  const SAT_LOW = 0.005;

  let enabled = false;
  /** @type {'rolling_ball'|'lane_edge'|'none'} */
  let bgMethod = 'rolling_ball';
  let roiTopPct = 8;
  let roiBotPct = 94;
  let refLaneIdx = -1;
  /** @type {any | null} */
  let lastResult = null;

  /**
   * 1D morphological opening (rolling-ball baseline) on a 1D signal profile.
   * @param {Float64Array} profile
   * @param {number} radius
   * @returns {Float64Array}
   */
  function rollingBall1D(profile, radius) {
    const n = profile.length;
    const r = Math.max(2, Math.min(radius, Math.floor(n / 3)));
    const eroded = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let mn = Infinity;
      const a = Math.max(0, i - r);
      const b = Math.min(n - 1, i + r);
      for (let j = a; j <= b; j++) if (profile[j] < mn) mn = profile[j];
      eroded[i] = mn;
    }
    const opened = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let mx = -Infinity;
      const a = Math.max(0, i - r);
      const b = Math.min(n - 1, i + r);
      for (let j = a; j <= b; j++) if (eroded[j] > mx) mx = eroded[j];
      opened[i] = mx;
    }
    return opened;
  }

  /** @param {number[]} arr */
  function median(arr) {
    if (!arr.length) return 0;
    const s = arr.slice().sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) * 0.5;
  }

  /**
   * Compute basic grayscale densitometry directly on unclipped linear rotated pixels (App.rot).
   */
  function compute() {
    const A = win.App;
    const S = A?.S;
    if (!S || !A.ensureRot) {
      lastResult = null;
      return null;
    }
    A.ensureRot();
    const rot = A.rot;
    if (!rot || !rot.data || !rot.w || !rot.h) {
      lastResult = null;
      return null;
    }

    const w = rot.w;
    const h = rot.h;
    const data = rot.data;
    const crop = S.crop || { x: 0, y: 0, w, h };
    const figLanes = A.figureLanes ? A.figureLanes() : S.lanes.map((_, i) => i).filter(i => !S.lanes[i].hidden);
    if (!figLanes.length) {
      lastResult = null;
      return null;
    }

    // Determine polarity from unclipped linear crop median (never display inversion!)
    const sampleVals = [];
    const stepX = Math.max(1, Math.floor(crop.w / 32));
    const stepY = Math.max(1, Math.floor(crop.h / 32));
    for (let y = Math.max(0, Math.floor(crop.y)); y < Math.min(h, Math.ceil(crop.y + crop.h)); y += stepY) {
      for (let x = Math.max(0, Math.floor(crop.x)); x < Math.min(w, Math.ceil(crop.x + crop.w)); x += stepX) {
        sampleVals.push(data[y * w + x]);
      }
    }
    const bgMedian = median(sampleVals);
    const brightBandsOnDark = bgMedian < 0.5;

    if (h < 2 || w < 2) return null;
    const topF = Math.max(0, Math.min(0.95, Math.min(roiTopPct, roiBotPct) / 100));
    const botF = Math.max(topF + 0.03, Math.min(1, Math.max(roiTopPct, roiBotPct) / 100));
    const y0 = Math.max(0, Math.min(h - 2, Math.round(crop.y + crop.h * topF)));
    const y1 = Math.min(h, Math.max(y0 + 1, Math.round(crop.y + crop.h * botF)));
    const roiH = y1 - y0;
    const cropMinX = Math.max(0, Math.min(w - 1, Math.floor(crop.x)));
    const cropMaxX = Math.max(cropMinX, Math.min(w - 1, Math.ceil(crop.x + crop.w) - 1));

    // Inter-lane spacing for strip half-width
    const xs = figLanes.map(li => S.lanes[li].x).sort((a, b) => a - b);
    let spacing = crop.w / Math.max(1, figLanes.length);
    if (xs.length >= 2) {
      const diffs = [];
      for (let i = 1; i < xs.length; i++) diffs.push(xs[i] - xs[i - 1]);
      spacing = Math.max(6, median(diffs));
    }
    const halfW = Math.max(2, Math.round(spacing * 0.30));
    const edgeOffset = Math.max(halfW + 1, Math.round(spacing * 0.44));
    const markerSet = new Set((S.markers || []).map(m => m.lane));
    const ballRadius = Math.max(8, Math.round(roiH * 0.14));

    const rows = figLanes.map((li, visIdx) => {
      const lane = S.lanes[li];
      const cx = Math.max(cropMinX, Math.min(cropMaxX, Math.round(lane.x)));
      const x0 = Math.max(cropMinX, cx - halfW);
      const x1 = Math.min(cropMaxX, cx + halfW);
      const stripW = Math.max(1, x1 - x0 + 1);

      const profile = new Float64Array(roiH);
      const edgeBg = new Float64Array(roiH);
      let rawIntegrated = 0;
      let peakRaw = brightBandsOnDark ? 0 : 1;
      let saturatedPixels = 0;
      let totalPixels = 0;

      for (let r = 0; r < roiH; r++) {
        const y = y0 + r;
        const rowOff = y * w;
        let rowSigSum = 0;
        for (let x = x0; x <= x1; x++) {
          const raw = data[rowOff + x];
          totalPixels++;
          if (brightBandsOnDark) {
            if (raw > peakRaw) peakRaw = raw;
            if (raw >= SAT_HIGH) saturatedPixels++;
            rowSigSum += raw;
          } else {
            if (raw < peakRaw) peakRaw = raw;
            if (raw <= SAT_LOW) saturatedPixels++;
            rowSigSum += (1 - raw);
          }
        }
        profile[r] = rowSigSum / stripW;
        rawIntegrated += rowSigSum;

        // Flanking lane-edge pixels for local background (stay within crop)
        const lx = Math.max(cropMinX, cx - edgeOffset);
        const rx = Math.min(cropMaxX, cx + edgeOffset);
        const lRaw = data[rowOff + lx];
        const rRaw = data[rowOff + rx];
        const lSig = brightBandsOnDark ? lRaw : (1 - lRaw);
        const rSig = brightBandsOnDark ? rRaw : (1 - rRaw);
        edgeBg[r] = Math.min(lSig, rSig);
      }

      const saturated = saturatedPixels > 0 || (brightBandsOnDark ? peakRaw >= SAT_HIGH : peakRaw <= SAT_LOW);

      const baseline = bgMethod === 'rolling_ball'
        ? rollingBall1D(profile, ballRadius)
        : (bgMethod === 'lane_edge' ? edgeBg : new Float64Array(roiH));

      let netIntegrated = 0;
      for (let r = 0; r < roiH; r++) {
        const net = Math.max(0, profile[r] - baseline[r]);
        netIntegrated += net * stripW;
      }

      return {
        laneIndex: li,
        visibleIndex: visIdx + 1,
        name: (lane.name || '').trim() || (markerSet.has(li) ? 'M' : `Lane ${visIdx + 1}`),
        isMarker: markerSet.has(li),
        peakRaw: Math.round(peakRaw * 10000) / 10000,
        saturatedPixels,
        totalPixels,
        saturated,
        status: saturated ? 'BLOCKED_SATURATED' : 'OK',
        rawIntegrated: saturated ? null : Math.round(rawIntegrated * 100) / 100,
        netIntegrated: saturated ? null : Math.round(netIntegrated * 100) / 100,
        relative: /** @type {number | null} */ (null)
      };
    });

    // Pick or validate reference lane (must be visible and NOT saturated!)
    const validRef = rows.find(r => r.laneIndex === refLaneIdx && !r.saturated && (r.netIntegrated || 0) > 0);
    if (!validRef) {
      const autoRef = rows.find(r => !r.isMarker && !r.saturated && (r.netIntegrated || 0) > 0)
        || rows.find(r => !r.saturated && (r.netIntegrated || 0) > 0)
        || null;
      refLaneIdx = autoRef ? autoRef.laneIndex : -1;
    }

    const refRow = rows.find(r => r.laneIndex === refLaneIdx && !r.saturated);
    const refVal = refRow && refRow.netIntegrated ? refRow.netIntegrated : 0;

    for (const row of rows) {
      if (row.saturated || row.netIntegrated == null || refVal <= 0) {
        row.relative = null;
      } else {
        row.relative = Math.round((row.netIntegrated / refVal) * 1000) / 1000;
      }
    }

    const saturatedBlockedCount = rows.filter(r => r.saturated).length;
    lastResult = {
      enabled,
      algorithm: 'linear-unclipped-lane-integration',
      sourcePixels: 'App.rot linear float [0..1] (pre-contrast/pre-gamma)',
      polarity: brightBandsOnDark ? 'bright-on-dark' : 'dark-on-light',
      backgroundMethod: bgMethod,
      rollingBallRadiusPx: bgMethod === 'rolling_ball' ? ballRadius : null,
      roiYRangePercent: [Math.round(topF * 100), Math.round(botF * 100)],
      referenceLane: refRow ? { well: refRow.laneIndex + 1, name: refRow.name } : null,
      saturatedThreshold: brightBandsOnDark ? `>= ${SAT_HIGH}` : `<= ${SAT_LOW}`,
      saturatedBlockedCount,
      rows,
      disclaimer: 'Basic relative grayscale densitometry from unclipped linear pixels. Verify imaging linear dynamic range independently; saturated/overexposed bands are strictly excluded from quantification.'
    };
    return lastResult;
  }

  function buildCsv() {
    const res = compute();
    if (!res) return '';
    const lines = [
      `# GelFigure ${win.App?.VERSION || '2.0.0'} Basic Grayscale Densitometry`,
      `# SourceFile,${csvCell(win.App?.S?.file?.name || '')}`,
      `# Algorithm,${res.algorithm}`,
      `# SourcePixels,${csvCell(res.sourcePixels)}`,
      `# BackgroundMethod,${res.backgroundMethod}`,
      `# RoiYPercent,${res.roiYRangePercent[0]}-${res.roiYRangePercent[1]}`,
      `# ReferenceLane,${csvCell(res.referenceLane ? `${res.referenceLane.well}:${res.referenceLane.name}` : 'None')}`,
      `# SaturatedBlockedCount,${res.saturatedBlockedCount}`,
      `# Disclaimer,${csvCell(res.disclaimer)}`,
      'LaneIndex,LaneName,RawPeak,SaturatedPixels,Status,RawIntegrated,NetIntegrated,RelativeToRef'
    ];
    for (const r of res.rows) {
      lines.push([
        r.visibleIndex,
        csvCell(r.name),
        r.peakRaw,
        r.saturatedPixels,
        r.status,
        r.saturated ? 'BLOCKED' : (r.rawIntegrated == null ? 'N/A' : r.rawIntegrated),
        r.saturated ? 'BLOCKED' : (r.netIntegrated == null ? 'N/A' : r.netIntegrated),
        r.saturated ? 'BLOCKED' : (r.relative == null ? 'N/A' : r.relative.toFixed(3))
      ].join(','));
    }
    return '\uFEFF' + lines.join('\r\n') + '\r\n';
  }

  /** @param {any} v */
  function csvCell(v) {
    const s = String(v == null ? '' : v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function exportCsv() {
    if (!enabled) return;
    const csv = buildCsv();
    if (!csv) return;
    const base = (win.App?.S?.file?.name || 'gel').replace(/\.[^.]+$/, '');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const filename = `${base}_densitometry.csv`;
    if (win.Export?.deliver) win.Export.deliver(blob, filename);
    else win.Export?.download?.(blob, filename);
    win.UI?.toast?.(L('已导出灰度定量 CSV', 'Exported densitometry CSV'));
  }

  function renderPanel() {
    const slot = document.getElementById('densitometrySlot');
    if (!slot) return;
    const hasImg = !!win.App?.S;
    if (!hasImg) {
      slot.innerHTML = '';
      return;
    }

    const res = enabled ? compute() : null;
    const bgLabel = bgMethod === 'rolling_ball'
      ? L('滚球背景扣除', 'Rolling ball')
      : bgMethod === 'lane_edge'
        ? L('泳道边缘背景', 'Lane edge')
        : L('无背景扣除', 'None');

    const bodyHtml = enabled && res ? `
      <div class="dens-notice">
        ${L('直接基于未拉伸线性灰度像素计算相对积分强度；请自行验证曝光与成像线性范围。过曝条带将自动标红并禁止定量。', 'Computed from unclipped linear grayscale pixels (pre-contrast/pre-gamma). Verify linear dynamic range independently; saturated bands are flagged red and blocked.')}
      </div>
      <div class="dens-controls">
        <div class="dens-field">
          <label for="densBgMethod">${L('背景扣除方式', 'Background subtraction')}</label>
          <select id="densBgMethod">
            <option value="rolling_ball"${bgMethod === 'rolling_ball' ? ' selected' : ''}>${L('滚球法（Rolling ball）', 'Rolling ball (1D opening)')}</option>
            <option value="lane_edge"${bgMethod === 'lane_edge' ? ' selected' : ''}>${L('泳道边缘背景', 'Lane edge')}</option>
            <option value="none"${bgMethod === 'none' ? ' selected' : ''}>${L('不扣除背景（无）', 'None')}</option>
          </select>
        </div>
        <div class="dens-field">
          <label for="densRefLane">${L('相对归一化参考泳道（= 1.000）', 'Normalization reference lane (= 1.000)')}</label>
          <select id="densRefLane">
            ${res.rows.map(r => `<option value="${r.laneIndex}"${r.laneIndex === refLaneIdx ? ' selected' : ''}${r.saturated ? ' disabled' : ''}>#${r.visibleIndex} ${esc(r.name)}${r.saturated ? L('（过曝 · 不可选）', ' (Saturated · blocked)') : ''}</option>`).join('')}
          </select>
        </div>
        <div class="dens-field">
          <label>${L('纵向定量窗口（裁切区 %）', 'Vertical ROI (% of crop)')}</label>
          <div class="dens-roi-pair">
            <input type="number" id="densRoiTop" min="0" max="90" step="1" value="${roiTopPct}" aria-label="${L('顶部 %', 'Top %')}">
            <input type="number" id="densRoiBot" min="10" max="100" step="1" value="${roiBotPct}" aria-label="${L('底部 %', 'Bottom %')}">
          </div>
        </div>
      </div>
      ${res.saturatedBlockedCount > 0 ? `
        <div class="dens-sat-alert" id="densSatAlert">
          ${L(`检测到 ${res.saturatedBlockedCount} 条泳道存在过曝/饱和像素，已标红并禁止定量（不可作为参考泳道）。请改用较短曝光原图。`,
              `${res.saturatedBlockedCount} lane(s) contain overexposed/saturated pixels and are strictly blocked from quantification. Use a shorter exposure.`)}
        </div>` : ''}
      <div class="dens-table-wrap">
        <table class="dens-tbl" id="densTable">
          <thead>
            <tr>
              <th>${L('泳道', 'Lane')}</th>
              <th style="text-align:right;">${L('净积分', 'Net Int.')}</th>
              <th style="text-align:right;">${L('相对值', 'Rel.')}</th>
            </tr>
          </thead>
          <tbody>
            ${res.rows.map(r => `
              <tr class="dens-row${r.saturated ? ' saturated' : ''}" data-dens-lane="${r.laneIndex}">
                <td>
                  #${r.visibleIndex} ${esc(r.name)}
                  ${r.saturated ? `<span class="dens-badge-sat">${L('过曝', 'Sat.')}</span>` : (r.laneIndex === refLaneIdx ? `<span class="dens-badge-ref">${L('参考', 'Ref')}</span>` : '')}
                </td>
                ${r.saturated
                  ? `<td class="num" colspan="2">${L('过曝·禁止定量', 'BLOCKED')}</td>`
                  : `<td class="num">${r.netIntegrated != null ? r.netIntegrated.toFixed(1) : '—'}</td><td class="num">${r.relative != null ? r.relative.toFixed(3) : '—'}</td>`}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="dens-actions">
        <button type="button" class="btn sm primary" id="btnDensExportCsv">${L('导出定量 CSV', 'Export CSV')}</button>
      </div>
      <div style="font-size:10.8px;color:var(--muted);">${L(`当前算法：${bgLabel} · 已同步写入处理日志`, `Method: ${bgLabel} · Included in processing log`)}</div>
    ` : `<div style="font-size:11.3px;color:var(--muted);">${L('默认关闭。开启后按未拉伸线性灰度计算各泳道相对积分强度，过曝条带自动标红并禁止定量。', 'Disabled by default. Computes relative integrated intensity from unclipped linear pixels; saturated bands are blocked.')}</div>`;

    slot.innerHTML = `
      <div class="dens-card" id="densCard">
        <label class="dens-toggle-row">
          <span>${L('基础灰度定量（相对强度）', 'Basic Grayscale Densitometry')}</span>
          <input type="checkbox" id="densEnableToggle"${enabled ? ' checked' : ''}>
        </label>
        ${bodyHtml}
      </div>`;

    slot.querySelector('#densEnableToggle')?.addEventListener('change', e => {
      enabled = !!(/** @type {HTMLInputElement} */ (e.target)).checked;
      renderPanel();
    });
    slot.querySelector('#densBgMethod')?.addEventListener('change', e => {
      const v = (/** @type {HTMLSelectElement} */ (e.target)).value;
      if (v === 'rolling_ball' || v === 'lane_edge' || v === 'none') bgMethod = v;
      renderPanel();
    });
    slot.querySelector('#densRefLane')?.addEventListener('change', e => {
      refLaneIdx = Number((/** @type {HTMLSelectElement} */ (e.target)).value);
      renderPanel();
    });
    slot.querySelector('#densRoiTop')?.addEventListener('change', e => {
      roiTopPct = Math.max(0, Math.min(90, Number((/** @type {HTMLInputElement} */ (e.target)).value) || 0));
      renderPanel();
    });
    slot.querySelector('#densRoiBot')?.addEventListener('change', e => {
      roiBotPct = Math.max(10, Math.min(100, Number((/** @type {HTMLInputElement} */ (e.target)).value) || 100));
      renderPanel();
    });
    slot.querySelector('#btnDensExportCsv')?.addEventListener('click', exportCsv);
  }

  function logEntry() {
    if (!enabled) return undefined;
    return compute() || undefined;
  }

  function summaryZh() {
    if (!enabled) return '';
    const res = compute();
    if (!res) return '';
    const bgName = res.backgroundMethod === 'rolling_ball' ? '滚球背景扣除' : res.backgroundMethod === 'lane_edge' ? '泳道边缘背景扣除' : '无背景扣除';
    return `相对灰度定量基于未拉伸线性像素（${bgName}），过曝泳道已排除定量；请自行验证成像线性动态范围。`;
  }

  function summaryEn() {
    if (!enabled) return '';
    const res = compute();
    if (!res) return '';
    return `Basic relative grayscale densitometry was performed on unclipped linear pixels (${res.backgroundMethod} background subtraction); overexposed lanes were excluded and linear dynamic range must be verified independently.`;
  }

  /* ======================================================================
   * PWA Service Worker Registration (Web / GitHub Pages ONLY)
   * ====================================================================== */
  function registerWebPWA() {
    if (win.__GELFIGURE_SINGLEFILE__) return;
    if (typeof location === 'undefined') return;
    const isWebHost = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (!isWebHost || !('serviceWorker' in navigator)) return;
    const doRegister = () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
    };
    if (document.readyState === 'complete') doRegister();
    else window.addEventListener('load', doRegister, { once: true });
  }

  function init() {
    renderPanel();
    registerWebPWA();
    if (win.App?.on) {
      win.App.on(w => {
        if (w === 'loaded') {
          refLaneIdx = -1;
          lastResult = null;
          renderPanel();
        } else if (w === 'change' || w === 'refresh') {
          renderPanel();
        }
      });
    }
    if (win.I18N?.onChange) win.I18N.onChange(renderPanel);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  win.DensitometryV16 = {
    get enabled() { return enabled; },
    setEnabled(val) { enabled = !!val; renderPanel(); },
    setBackground(method) { if (method === 'rolling_ball' || method === 'lane_edge' || method === 'none') { bgMethod = method; renderPanel(); } },
    setReferenceLane(idx) { refLaneIdx = Number(idx); renderPanel(); },
    setRoi(top, bot) { roiTopPct = Number(top); roiBotPct = Number(bot); renderPanel(); },
    compute,
    buildCsv,
    exportCsv,
    logEntry,
    summaryZh,
    summaryEn,
    render: renderPanel
  };
})(window);
