// @ts-check
/* v1.5.0 Productivity Features:
 * 1. Sample Table (Excel TSV paste / .csv upload, zero external lib, column mapping + preview)
 * 2. Historical Lane Name Autocomplete (from IndexedDB history + PrefStorage frequency index)
 * 3. One-Click Copy Figure Legend (ZH / EN)
 * 4. Batch Processing (multi-file -> N*2 AI call disclosure -> sequential queue -> per-gel Review Checklist -> unified style template + ZIP) */
(function (G) {
  'use strict';

  const win = /** @type {any} */ (G);
  const L = (zh, en) => (win.L ? win.L(zh, en) : zh);
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const NAME_STORE_KEY = 'gelfigure.laneNames.v1';

  /* ======================================================================
   * 1. Pure-JS RFC-4180 CSV & Excel TSV Parser + Sample Table Modal
   * ====================================================================== */
  /**
   * Detect delimiter ('\t' or ',') and parse text into rows of strings.
   * @param {string} raw
   * @returns {{ delimiter: string, rows: string[][] }}
   */
  function parseTable(raw) {
    const text = String(raw || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const nonEmptyLines = text.split('\n').filter(l => l.trim().length > 0);
    if (!nonEmptyLines.length) return { delimiter: '\t', rows: [] };
    const sample = nonEmptyLines.slice(0, 5);
    const tabs = sample.reduce((s, l) => s + (l.match(/\t/g) || []).length, 0);
    const commas = sample.reduce((s, l) => s + (l.match(/,/g) || []).length, 0);
    const delimiter = tabs >= commas && tabs > 0 ? '\t' : (commas > 0 ? ',' : '\t');

    /** @type {string[][]} */
    const rows = [];
    /** @type {string[]} */
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else {
          field += ch;
        }
      } else if (ch === '"' && field === '') {
        inQuotes = true;
      } else if (ch === delimiter) {
        row.push(field.trim());
        field = '';
      } else if (ch === '\n') {
        row.push(field.trim());
        if (row.some(c => c !== '')) rows.push(row);
        row = [];
        field = '';
      } else {
        field += ch;
      }
    }
    row.push(field.trim());
    if (row.some(c => c !== '')) rows.push(row);

    const maxCols = rows.reduce((m, r) => Math.max(m, r.length), 0);
    for (const r of rows) {
      while (r.length < maxCols) r.push('');
    }
    return { delimiter, rows };
  }

  /** @param {string} header @param {string[]} values @param {number} idx */
  function guessColumnRole(header, values, idx) {
    const h = (header || '').toLowerCase();
    if (/^(#|no\.?|lane|泳道号|序号|编号)$/.test(h)) return 'ignore';
    if (/(group|分组|组别|treatment|cohort)/.test(h)) return 'group';
    if (/(name|sample|泳道名|样本|样品|label)/.test(h)) return 'name';
    const nonEmpty = values.filter(Boolean);
    if (nonEmpty.length && nonEmpty.every(v => /^[+\-−±✓✗]|^(yes|no|0|1)$/i.test(v))) return 'cond';
    if (idx === 0) return 'name';
    return 'cond';
  }

  /** @param {string} v */
  function normalizeCondVal(v) {
    const t = String(v || '').trim().toLowerCase();
    if (!t) return '';
    if (t === '+' || t === 'yes' || t === 'true' || t === '1' || t === '✓') return '+';
    if (t === '-' || t === '−' || t === 'no' || t === 'false' || t === '0' || t === '✗') return '−';
    return v.trim();
  }

  /** @type {HTMLElement | null} */
  let stDlg = null;
  let stRaw = '';
  let stHasHeader = true;
  let stSkipMarker = true;
  /** @type {string[]} */
  let stRoles = [];

  function ensureSampleTableModal() {
    if (stDlg) return stDlg;
    stDlg = document.createElement('div');
    stDlg.id = 'sampleTableModal';
    stDlg.className = 'v15-modal hidden';
    stDlg.addEventListener('click', e => { if (e.target === stDlg) closeSampleTable(); });
    stDlg.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); closeSampleTable(); }
    });
    document.body.appendChild(stDlg);
    return stDlg;
  }

  function renderSampleTable(keepTextarea) {
    const dlg = ensureSampleTableModal();
    const parsed = parseTable(stRaw);
    const rows = parsed.rows;
    const colCount = rows[0]?.length || 0;
    const headers = stHasHeader && rows.length
      ? rows[0].map((h, i) => h || L(`列 ${i + 1}`, `Col ${i + 1}`))
      : Array.from({ length: colCount }, (_, i) => L(`列 ${i + 1}`, `Col ${i + 1}`));
    const dataRows = stHasHeader ? rows.slice(1) : rows;

    if (stRoles.length !== colCount) {
      stRoles = headers.map((h, i) => guessColumnRole(h, dataRows.map(r => r[i] || ''), i));
      // Guarantee at least one 'name' column if available
      if (colCount > 0 && !stRoles.includes('name')) stRoles[0] = 'name';
    }

    const S = win.App?.S;
    const figLanes = win.UI?.figLanes ? win.UI.figLanes() : [];
    const markerSet = new Set((S?.markers || []).map(m => m.lane));
    const targetLanes = stSkipMarker ? figLanes.filter(li => !markerSet.has(li)) : figLanes.slice();

    const mapHtml = colCount ? `
      <div class="st-map-grid">
        ${headers.map((h, ci) => `
          <div class="st-map-col">
            <strong title="${esc(h)}">${esc(h)}</strong>
            <select data-st-role="${ci}" aria-label="${esc(h)}">
              <option value="name"${stRoles[ci] === 'name' ? ' selected' : ''}>${L('泳道名', 'Lane name')}</option>
              <option value="group"${stRoles[ci] === 'group' ? ' selected' : ''}>${L('分组横线', 'Group')}</option>
              <option value="cond"${stRoles[ci] === 'cond' ? ' selected' : ''}>${L('条件行 (+/-)', 'Condition row')}</option>
              <option value="ignore"${stRoles[ci] === 'ignore' ? ' selected' : ''}>${L('忽略', 'Ignore')}</option>
            </select>
          </div>`).join('')}
      </div>` : '';

    const nameCol = stRoles.indexOf('name');
    const groupCol = stRoles.indexOf('group');
    const condCols = stRoles.map((r, i) => (r === 'cond' ? i : -1)).filter(i => i >= 0);

    const previewHtml = colCount && dataRows.length ? `
      <div class="st-preview-wrap">
        <table class="st-preview-tbl">
          <thead>
            <tr>
              <th>${L('目标泳道', 'Target lane')}</th>
              ${nameCol >= 0 ? `<th>${L('泳道名', 'Lane name')}</th>` : ''}
              ${groupCol >= 0 ? `<th>${L('分组', 'Group')}</th>` : ''}
              ${condCols.map(ci => `<th>${esc(headers[ci])}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${dataRows.slice(0, 24).map((r, ri) => {
              const li = targetLanes[ri];
              const laneLabel = li != null ? `#${figLanes.indexOf(li) + 1}` : L('超出泳道数', 'Extra');
              return `<tr>
                <td>${esc(laneLabel)}</td>
                ${nameCol >= 0 ? `<td><strong>${esc(r[nameCol] || '')}</strong></td>` : ''}
                ${groupCol >= 0 ? `<td>${esc(r[groupCol] || '')}</td>` : ''}
                ${condCols.map(ci => `<td>${esc(normalizeCondVal(r[ci] || ''))}</td>`).join('')}
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>` : `<div style="font-size:12px;color:var(--muted);">${L('从 Excel / WPS / Google Sheets 复制多列直接粘贴，或上传 .csv 文件（列可包含：泳道名、分组、+/- 条件行）。', 'Paste columns from Excel/Sheets or upload a .csv file (columns: Lane name, Group, +/- Conditions).')}</div>`;

    const statsText = colCount ? L(`已识别 ${dataRows.length} 行 × ${colCount} 列（${parsed.delimiter === '\t' ? 'TSV' : 'CSV'}）`, `${dataRows.length} rows × ${colCount} cols (${parsed.delimiter === '\t' ? 'TSV' : 'CSV'})`) : '';

    if (keepTextarea && dlg.querySelector('#stRawInput') && dlg.querySelector('#stDynamicRegion')) {
      const statsEl = dlg.querySelector('#stStatsText');
      if (statsEl) statsEl.textContent = statsText;
      const dynEl = dlg.querySelector('#stDynamicRegion');
      if (dynEl) dynEl.innerHTML = mapHtml + previewHtml;
      const applyBtn = /** @type {HTMLButtonElement | null} */ (dlg.querySelector('#stApply'));
      if (applyBtn) {
        applyBtn.disabled = !dataRows.length;
        applyBtn.onclick = () => {
          applySampleTable(headers, dataRows, targetLanes);
          closeSampleTable();
        };
      }
      dlg.querySelectorAll('[data-st-role]').forEach(sel => {
        sel.addEventListener('change', () => {
          const ci = Number((/** @type {HTMLElement} */ (sel)).dataset.stRole);
          stRoles[ci] = (/** @type {HTMLSelectElement} */ (sel)).value;
          renderSampleTable(true);
        });
      });
      return;
    }

    dlg.innerHTML = `
      <div class="v15-card" role="dialog" aria-modal="true" aria-label="${L('粘贴样本表', 'Sample table')}">
        <div class="v15-head">
          <h2>${L('粘贴样本表（Excel TSV / CSV）', 'Sample Table (Excel TSV / CSV)')}</h2>
          <button type="button" class="btn sm" id="stClose">${L('关闭', 'Close')}</button>
        </div>
        <div class="v15-body">
          <div class="v15-row">
            <label class="btn sm" for="stCsvFile">${L('导入 .csv / .tsv 文件', 'Import .csv / .tsv')}</label>
            <input type="file" id="stCsvFile" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values" class="hidden">
            <label style="font-size:12px;display:inline-flex;align-items:center;gap:5px;cursor:pointer;">
              <input type="checkbox" id="stHasHeader"${stHasHeader ? ' checked' : ''}> ${L('首行是表头', 'First row is header')}
            </label>
            <label style="font-size:12px;display:inline-flex;align-items:center;gap:5px;cursor:pointer;">
              <input type="checkbox" id="stSkipMarker"${stSkipMarker ? ' checked' : ''}> ${L('跳过 Marker 泳道', 'Skip Marker lane')}
            </label>
            <span id="stStatsText" style="margin-left:auto;font-size:11.5px;color:var(--muted);">${esc(statsText)}</span>
          </div>
          <textarea id="stRawInput" class="st-textarea" placeholder="${esc(L('示例（直接从 Excel 复制粘贴）：\n样本\t分组\t处理\t对照\nWT\tCtrl\t-\t+\nKO-1\tMutant\t+\t-\nKO-2\tMutant\t+\t-', 'Example (paste from Excel):\nSample\tGroup\tDrug\tCtrl\nWT\tCtrl\t-\t+\nKO-1\tMutant\t+\t-\nKO-2\tMutant\t+\t-'))}">${esc(stRaw)}</textarea>
          <div id="stDynamicRegion">${mapHtml}${previewHtml}</div>
        </div>
        <div class="v15-foot">
          <span style="font-size:11.8px;color:var(--muted);">${L(`当前可填充 ${targetLanes.length} 条泳道`, `${targetLanes.length} target lanes available`)}</span>
          <div class="v15-row">
            <button type="button" class="btn sm" id="stCancel">${L('取消', 'Cancel')}</button>
            <button type="button" class="btn sm primary" id="stApply"${dataRows.length ? '' : ' disabled'}>${L('应用到泳道', 'Apply to lanes')}</button>
          </div>
        </div>
      </div>`;

    dlg.querySelector('#stClose')?.addEventListener('click', closeSampleTable);
    dlg.querySelector('#stCancel')?.addEventListener('click', closeSampleTable);
    const rawEl = /** @type {HTMLTextAreaElement | null} */ (dlg.querySelector('#stRawInput'));
    if (rawEl) {
      rawEl.addEventListener('input', () => {
        stRaw = rawEl.value;
        stRoles = [];
        renderSampleTable(true);
      });
    }
    const fileEl = /** @type {HTMLInputElement | null} */ (dlg.querySelector('#stCsvFile'));
    if (fileEl) {
      fileEl.addEventListener('change', async () => {
        const f = fileEl.files?.[0];
        if (!f) return;
        stRaw = await f.text();
        stRoles = [];
        renderSampleTable();
      });
    }
    dlg.querySelector('#stHasHeader')?.addEventListener('change', e => {
      stHasHeader = !!(/** @type {HTMLInputElement} */ (e.target)).checked;
      stRoles = [];
      renderSampleTable(true);
    });
    dlg.querySelector('#stSkipMarker')?.addEventListener('change', e => {
      stSkipMarker = !!(/** @type {HTMLInputElement} */ (e.target)).checked;
      renderSampleTable(true);
    });
    dlg.querySelectorAll('[data-st-role]').forEach(sel => {
      sel.addEventListener('change', () => {
        const ci = Number((/** @type {HTMLElement} */ (sel)).dataset.stRole);
        stRoles[ci] = (/** @type {HTMLSelectElement} */ (sel)).value;
        renderSampleTable(true);
      });
    });
    const applyBtn = /** @type {HTMLButtonElement | null} */ (dlg.querySelector('#stApply'));
    if (applyBtn) {
      applyBtn.onclick = () => {
        applySampleTable(headers, dataRows, targetLanes);
        closeSampleTable();
      };
    }
  }

  /**
   * @param {string[]} headers
   * @param {string[][]} dataRows
   * @param {number[]} targetLanes
   */
  function applySampleTable(headers, dataRows, targetLanes) {
    const A = win.App;
    const S = A?.S;
    if (!S || !dataRows.length) return;

    const nameCol = stRoles.indexOf('name');
    const groupCol = stRoles.indexOf('group');
    const condCols = stRoles.map((r, i) => (r === 'cond' ? i : -1)).filter(i => i >= 0);

    const n = Math.min(dataRows.length, targetLanes.length);
    const appliedNames = [];
    if (nameCol >= 0) {
      for (let i = 0; i < n; i++) {
        const li = targetLanes[i];
        const v = (dataRows[i][nameCol] || '').trim();
        if (S.lanes[li]) {
          S.lanes[li].name = v;
          if (v) appliedNames.push(v);
        }
      }
    }

    if (groupCol >= 0) {
      const figLanes = win.UI?.figLanes ? win.UI.figLanes() : [];
      const figPos = new Map(figLanes.map((li, idx) => [li, idx]));
      /** @type {{ from: number, to: number, text: string }[]} */
      const groups = [];
      let curText = '';
      let curFrom = -1;
      let curTo = -1;
      for (let i = 0; i < n; i++) {
        const li = targetLanes[i];
        const g = (dataRows[i][groupCol] || '').trim();
        const prevPos = figPos.get(curTo);
        const curPos = figPos.get(li);
        const adjacent = prevPos != null && curPos != null ? curPos === prevPos + 1 : curTo === targetLanes[i - 1];
        if (g && g === curText && adjacent) {
          curTo = li;
        } else {
          if (curText && curFrom >= 0) groups.push({ from: curFrom, to: curTo, text: curText });
          curText = g;
          curFrom = g ? li : -1;
          curTo = g ? li : -1;
        }
      }
      if (curText && curFrom >= 0) groups.push({ from: curFrom, to: curTo, text: curText });
      S.groups = groups;
    }

    if (condCols.length) {
      S.conditions = condCols.map(ci => {
        const vals = S.lanes.map(() => '');
        for (let i = 0; i < n; i++) {
          const li = targetLanes[i];
          vals[li] = normalizeCondVal(dataRows[i][ci] || '');
        }
        return { name: headers[ci] || L('条件', 'Condition'), values: vals };
      });
    }

    recordLaneNames(appliedNames);
    A.commit();
    win.UI?.toast?.(L(`已应用样本表到 ${n} 条泳道`, `Applied sample table to ${n} lanes`));
  }

  function openSampleTable(prefill) {
    if (typeof prefill === 'string') {
      stRaw = prefill;
      stRoles = [];
    }
    const dlg = ensureSampleTableModal();
    dlg.classList.remove('hidden');
    renderSampleTable();
    /** @type {HTMLElement | null} */ (dlg.querySelector('#stRawInput'))?.focus();
  }

  function closeSampleTable() {
    if (stDlg) stDlg.classList.add('hidden');
  }

  function injectSampleTableButtons() {
    const actions = document.getElementById('step3NamesActions');
    if (actions && !document.getElementById('btnSampleTable')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn sm';
      btn.id = 'btnSampleTable';
      btn.textContent = L('粘贴样本表', 'Sample table');
      btn.addEventListener('click', () => openSampleTable());
      actions.insertBefore(btn, actions.firstChild);
    }
    const figTools = document.getElementById('figureTools');
    if (figTools && !document.getElementById('btnFigSampleTable')) {
      const bulkBtn = document.getElementById('btnBulkNames');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn sm';
      btn.id = 'btnFigSampleTable';
      btn.textContent = L('粘贴样本表', 'Sample table');
      btn.addEventListener('click', () => openSampleTable());
      if (bulkBtn && bulkBtn.parentElement) bulkBtn.parentElement.insertBefore(btn, bulkBtn.nextSibling);
      else figTools.appendChild(btn);
    }
  }

  /* ======================================================================
   * 2. Historical Lane Name Autocomplete
   * ====================================================================== */
  /** @type {{ name: string, count: number, lastProject: boolean, updatedAt: number }[]} */
  let acPool = [];
  /** @type {HTMLElement | null} */
  let acMenu = null;
  /** @type {HTMLInputElement | null} */
  let acInput = null;
  let acIdx = -1;
  /** @type {{ name: string, count: number, lastProject: boolean }[]} */
  let acMatches = [];

  /** @param {string[]} names */
  function recordLaneNames(names) {
    const clean = (names || []).map(s => String(s || '').trim()).filter(s => s.length >= 2 && s !== 'M');
    if (!clean.length) return;
    /** @type {Record<string, { count: number, lastAt: number }>} */
    let map = {};
    try {
      const raw = win.PrefStorage?.getItem?.(NAME_STORE_KEY);
      if (raw) map = JSON.parse(raw) || {};
    } catch (_) { map = {}; }
    const now = Date.now();
    for (const nm of new Set(clean)) {
      const prev = map[nm] || { count: 0, lastAt: 0 };
      map[nm] = { count: prev.count + 1, lastAt: now };
    }
    try { win.PrefStorage?.setItem?.(NAME_STORE_KEY, JSON.stringify(map)); } catch (_) {}
    refreshAutocompletePool();
  }

  let acRev = 0;

  async function refreshAutocompletePool() {
    const rev = ++acRev;
    /** @type {Map<string, { name: string, count: number, lastProject: boolean, updatedAt: number }>} */
    const merged = new Map();
    try {
      const raw = win.PrefStorage?.getItem?.(NAME_STORE_KEY);
      if (raw) {
        const map = JSON.parse(raw) || {};
        for (const [name, rec] of Object.entries(map)) {
          if (!name || name === 'M') continue;
          const r = /** @type {any} */ (rec);
          merged.set(name, { name, count: Number(r.count) || 1, lastProject: false, updatedAt: Number(r.lastAt) || 0 });
        }
      }
    } catch (_) {}

    const sortPool = map => Array.from(map.values()).sort((a, b) =>
      (b.lastProject ? 1 : 0) - (a.lastProject ? 1 : 0) || b.count - a.count || b.updatedAt - a.updatedAt
    );
    // Apply PrefStorage names synchronously so autocomplete never waits on IndexedDB (especially WebKit)
    acPool = sortPool(merged);

    try {
      if (win.App?.listHistory) {
        const list = await Promise.race([
          win.App.listHistory().catch(() => []),
          new Promise(r => setTimeout(() => r([]), 1500))
        ]);
        if (rev !== acRev) return;
        const arr = Array.isArray(list) ? list : [];
        arr.forEach((proj, idx) => {
          const lns = Array.isArray(proj?.summary?.laneNames) ? proj.summary.laneNames : [];
          for (const rawName of new Set(lns)) {
            const name = String(rawName || '').trim();
            if (!name || name === 'M') continue;
            const prev = merged.get(name);
            merged.set(name, {
              name,
              count: (prev ? prev.count : 0) + 1,
              lastProject: idx === 0 || !!prev?.lastProject,
              updatedAt: Math.max(prev?.updatedAt || 0, Number(proj.savedAt) || 0)
            });
          }
        });
      }
    } catch (_) {}

    if (rev !== acRev) return;
    acPool = sortPool(merged);
  }

  function ensureAcMenu() {
    if (acMenu) return acMenu;
    acMenu = document.createElement('div');
    acMenu.id = 'laneAutocompleteMenu';
    acMenu.className = 'lane-ac-menu hidden';
    acMenu.setAttribute('role', 'listbox');
    document.body.appendChild(acMenu);
    return acMenu;
  }

  function hideAcMenu() {
    if (acMenu) acMenu.classList.add('hidden');
    acInput = null;
    acIdx = -1;
    acMatches = [];
  }

  /** @param {string} val */
  function commitAcValue(val) {
    const target = acInput;
    if (!target) return;
    hideAcMenu();
    target.value = val;
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
    hideAcMenu();
  }

  /** @param {HTMLInputElement} inp */
  function showAcForInput(inp) {
    const q = (inp.value || '').trim().toLowerCase();
    const curLanes = (win.App?.S?.lanes || []).map(l => (l.name || '').trim()).filter(Boolean);
    const localExtra = curLanes.filter(n => n !== 'M' && n.toLowerCase() !== q);
    /** @type {Map<string, { name: string, count: number, lastProject: boolean }>} */
    const candMap = new Map();
    for (const item of acPool) {
      if (item.name.toLowerCase() !== q) candMap.set(item.name, item);
    }
    for (const n of localExtra) {
      if (!candMap.has(n)) candMap.set(n, { name: n, count: 1, lastProject: false });
    }
    const all = Array.from(candMap.values());
    const matches = all.filter(it => !q || it.name.toLowerCase().includes(q));
    matches.sort((a, b) => {
      const ap = q && a.name.toLowerCase().startsWith(q) ? 1 : 0;
      const bp = q && b.name.toLowerCase().startsWith(q) ? 1 : 0;
      return bp - ap || (b.lastProject ? 1 : 0) - (a.lastProject ? 1 : 0) || b.count - a.count;
    });

    if (!matches.length || (!q && !acPool.length)) {
      hideAcMenu();
      return;
    }

    acInput = inp;
    acMatches = matches.slice(0, 8);
    acIdx = -1;

    const menu = ensureAcMenu();
    const rect = inp.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.round(rect.left)) + 'px';
    menu.style.top = Math.round(rect.bottom + 4) + 'px';
    menu.style.width = Math.max(185, Math.round(rect.width)) + 'px';
    menu.innerHTML = acMatches.map((m, i) => {
      const tag = m.lastProject ? L('上次项目', 'Last project') : L(`历史 ${m.count} 次`, `Used ${m.count}×`);
      return `<button type="button" class="lane-ac-item${i === acIdx ? ' active' : ''}" data-ac-idx="${i}" role="option">
        <span class="lane-ac-name">${esc(m.name)}</span>
        <span class="lane-ac-meta">${esc(tag)}</span>
      </button>`;
    }).join('');
    menu.classList.remove('hidden');

    menu.querySelectorAll('[data-ac-idx]').forEach(btn => {
      btn.addEventListener('mousedown', e => {
        e.preventDefault();
        const i = Number((/** @type {HTMLElement} */ (btn)).dataset.acIdx);
        if (acMatches[i]) commitAcValue(acMatches[i].name);
      });
    });
  }

  function updateAcHighlight() {
    if (!acMenu) return;
    acMenu.querySelectorAll('.lane-ac-item').forEach((el, i) => el.classList.toggle('active', i === acIdx));
  }

  function initAutocomplete() {
    document.addEventListener('input', e => {
      const t = /** @type {HTMLElement | null} */ (e.target);
      if (t && t.matches && (t.matches('.step3-lane-input') || t.id === 'floatEd')) {
        showAcForInput(/** @type {HTMLInputElement} */ (t));
      }
    }, true);

    document.addEventListener('focusin', e => {
      const t = /** @type {HTMLElement | null} */ (e.target);
      if (t && t.matches && t.matches('.step3-lane-input')) {
        if ((/** @type {HTMLInputElement} */ (t)).value.trim().length > 0) {
          showAcForInput(/** @type {HTMLInputElement} */ (t));
        }
      }
    }, true);

    document.addEventListener('keydown', e => {
      if (!acInput || !acMenu || acMenu.classList.contains('hidden')) return;
      if (document.activeElement !== acInput) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        acIdx = acIdx < 0 ? 0 : (acIdx + 1) % acMatches.length;
        updateAcHighlight();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        acIdx = acIdx < 0 ? acMatches.length - 1 : (acIdx - 1 + acMatches.length) % acMatches.length;
        updateAcHighlight();
      } else if (e.key === 'Tab' && !e.shiftKey && !e.isComposing && acMatches.length) {
        e.preventDefault();
        e.stopImmediatePropagation();
        commitAcValue(acMatches[acIdx >= 0 ? acIdx : 0].name);
      } else if (e.key === 'Enter' && !e.isComposing) {
        if (acIdx >= 0 && acMatches[acIdx]) {
          e.preventDefault();
          e.stopImmediatePropagation();
          commitAcValue(acMatches[acIdx].name);
        } else {
          hideAcMenu();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        hideAcMenu();
      }
    }, true);

    document.addEventListener('focusout', e => {
      const t = /** @type {HTMLElement | null} */ (e.target);
      if (t && t === acInput) {
        setTimeout(() => {
          if (document.activeElement !== acInput) hideAcMenu();
        }, 120);
      }
    }, true);

    document.addEventListener('change', e => {
      const t = /** @type {HTMLElement | null} */ (e.target);
      if (t && t.matches && t.matches('.step3-lane-input')) {
        const val = (/** @type {HTMLInputElement} */ (t)).value.trim();
        if (val) recordLaneNames([val]);
      }
    }, true);
  }

  /* ======================================================================
   * 3. One-Click Copy Figure Legend (ZH / EN)
   * ====================================================================== */
  /** @type {HTMLElement | null} */
  let legendDlg = null;
  let legendLang = 'en';

  /** @param {any} S @param {'zh'|'en'} lang */
  function buildLegend(S, lang) {
    const A = win.App;
    if (!S || !A) return '';
    const isProtein = A.gelKind?.() === 'protein';
    const figLanes = A.figureLanes ? A.figureLanes() : S.lanes.map((_, i) => i).filter(i => !S.lanes[i].hidden);
    const laneDesc = figLanes.map((li, idx) => {
      const nm = (S.lanes[li]?.name || '').trim() || (lang === 'zh' ? `泳道 ${idx + 1}` : `Lane ${idx + 1}`);
      return `${idx + 1}: ${nm}`;
    }).join(lang === 'zh' ? '；' : '; ');

    const enHints = win.Export?.legendHints ? win.Export.legendHints(S) : [];
    const lv = A.displayLevels ? A.displayLevels(S) : { invert: false, gamma: 1 };
    const cut = S.lanes.map((l, i) => (l.hidden ? i + 1 : null)).filter(v => v != null);
    const shownMarkers = (S.markers || []).filter(m => !S.lanes[m.lane]?.hidden && win.Ladders?.get?.(m.ladderId));
    const ladNames = [...new Set(shownMarkers.map(m => win.Ladders.get(m.ladderId).name.replace(/\s*\(.*\)/, '')))];

    if (lang === 'zh') {
      const parts = [];
      parts.push(`${isProtein ? '蛋白电泳胶图' : 'DNA 琼脂糖凝胶电泳图'}。各泳道依次为：${laneDesc}。`);
      if (ladNames.length) parts.push(`M，${isProtein ? '蛋白分子量标准' : 'DNA Marker'}（${ladNames.join('；')}）。`);
      if (S.perspective) parts.push('图像经四点透视投影校正（双线性插值），原始未裁剪图像已另行留存。');
      if (cut.length) parts.push(`同一块胶中剪除了第 ${cut.join('、')} 泳道，拼接处以${S.style?.spliceStyle === 'line' ? '竖线' : '白色间隙'}标示。`);
      if (lv.invert) parts.push('图像灰度经整体反色显示。');
      if (lv.gamma !== 1) parts.push(`全图应用了非线性 Gamma 调整（γ = ${lv.gamma}）。`);
      else parts.push('亮度与对比度调整为全图线性调节，未进行局部修饰。');
      if (win.DensitometryV16?.summaryZh?.()) parts.push(win.DensitometryV16.summaryZh());
      return parts.join('');
    }

    const parts = [];
    parts.push(`${isProtein ? 'Protein gel electrophoresis' : 'DNA agarose gel electrophoresis'}. Lanes: ${laneDesc}.`);
    if (enHints.length) parts.push(enHints.join(' '));
    else parts.push('Brightness and contrast were adjusted linearly across the entire image.');
    if (win.DensitometryV16?.summaryEn?.()) parts.push(win.DensitometryV16.summaryEn());
    return parts.join(' ');
  }

  /** @param {string} text */
  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {}
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (_) {
      return false;
    }
  }

  function renderLegendModal() {
    if (!legendDlg) return;
    const S = win.App?.S;
    const text = buildLegend(S, /** @type {'zh'|'en'} */ (legendLang));
    legendDlg.innerHTML = `
      <div class="v15-card narrow" role="dialog" aria-modal="true" aria-label="${L('一键复制图注', 'Copy Figure Legend')}">
        <div class="v15-head">
          <h2>${L('图注草稿（中英文可选）', 'Figure Legend Draft (ZH / EN)')}</h2>
          <button type="button" class="btn sm" id="legendClose">${L('关闭', 'Close')}</button>
        </div>
        <div class="v15-body">
          <div class="v15-row" style="justify-content:space-between;">
            <div class="legend-lang-seg" role="tablist">
              <button type="button" class="legend-lang-btn${legendLang === 'zh' ? ' on' : ''}" data-leg-lang="zh">中文图注</button>
              <button type="button" class="legend-lang-btn${legendLang === 'en' ? ' on' : ''}" data-leg-lang="en">English Legend</button>
            </div>
            <span style="font-size:11.5px;color:var(--muted);">${L('投稿前请核对样本信息与处理披露', 'Verify sample details & disclosures before submission')}</span>
          </div>
          <textarea id="legendText" class="legend-textarea">${esc(text)}</textarea>
        </div>
        <div class="v15-foot">
          <span id="legendCopyStatus" style="font-size:12px;color:var(--ok);"></span>
          <div class="v15-row">
            <button type="button" class="btn sm" id="legendCancel">${L('关闭', 'Close')}</button>
            <button type="button" class="btn sm primary" id="legendCopyBtn">${L('一键复制到剪贴板', 'Copy to clipboard')}</button>
          </div>
        </div>
      </div>`;

    legendDlg.querySelector('#legendClose')?.addEventListener('click', closeLegendModal);
    legendDlg.querySelector('#legendCancel')?.addEventListener('click', closeLegendModal);
    legendDlg.querySelectorAll('[data-leg-lang]').forEach(btn => {
      btn.addEventListener('click', () => {
        legendLang = (/** @type {HTMLElement} */ (btn)).dataset.legLang === 'zh' ? 'zh' : 'en';
        renderLegendModal();
      });
    });
    legendDlg.querySelector('#legendCopyBtn')?.addEventListener('click', async () => {
      const ta = /** @type {HTMLTextAreaElement | null} */ (legendDlg?.querySelector('#legendText'));
      const ok = await copyText(ta ? ta.value : text);
      const st = legendDlg?.querySelector('#legendCopyStatus');
      if (st) st.textContent = ok ? L('✓ 已复制到剪贴板', '✓ Copied to clipboard') : L('请手动全选复制上方文本', 'Select and copy the text above');
      win.UI?.toast?.(ok ? L('图注已复制到剪贴板', 'Legend copied to clipboard') : L('请手动复制图注文本', 'Copy legend manually'));
    });
  }

  function openLegendModal() {
    if (!win.App?.S) return;
    if (!legendDlg) {
      legendDlg = document.createElement('div');
      legendDlg.id = 'legendModal';
      legendDlg.className = 'v15-modal hidden';
      legendDlg.addEventListener('click', e => { if (e.target === legendDlg) closeLegendModal(); });
      legendDlg.addEventListener('keydown', e => {
        e.stopPropagation();
        if (e.key === 'Escape') { e.preventDefault(); closeLegendModal(); }
      });
      document.body.appendChild(legendDlg);
    }
    legendLang = win.I18N?.lang === 'en' ? 'en' : 'zh';
    legendDlg.classList.remove('hidden');
    renderLegendModal();
  }

  function closeLegendModal() {
    if (legendDlg) legendDlg.classList.add('hidden');
  }

  /* ======================================================================
   * 4. Batch Processing (Sequential Queue + Per-Gel Review Strip + Unified ZIP)
   * ====================================================================== */
  /**
   * @typedef {{
   *   name: string,
   *   buffer: ArrayBuffer,
   *   snapshot: string,
   *   initial: any,
   *   projectId?: string | null,
   *   projectName?: string,
   *   autoRotation: number,
   *   hist?: string[] | null,
   *   future?: string[],
   *   reviewed: boolean,
   *   mode: 'ai'|'local'
   * }} BatchEntry
   */
  /** @type {HTMLElement | null} */
  let batchDlg = null;
  /** @type {HTMLElement | null} */
  let batchStrip = null;
  /** @type {File[]} */
  let batchPendingFiles = [];
  let batchUseAI = true;
  let batchFormat = 'png';
  let batchLadderId = '';
  let batchRunning = false;
  let batchCancelled = false;
  let batchProgress = { done: 0, total: 0, current: '' };
  /** @type {BatchEntry[]} */
  let batchItems = [];
  let batchActiveIdx = -1;

  function ensureBatchModal() {
    if (batchDlg) return batchDlg;
    batchDlg = document.createElement('div');
    batchDlg.id = 'batchModal';
    batchDlg.className = 'v15-modal hidden';
    batchDlg.addEventListener('click', e => { if (e.target === batchDlg && !batchRunning) closeBatchModal(); });
    batchDlg.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Escape' && !batchRunning) { e.preventDefault(); closeBatchModal(); }
    });
    document.body.appendChild(batchDlg);
    return batchDlg;
  }

  function allLadderOptionsHtml(selectedId) {
    const out = [`<option value="">${L('自动匹配默认型号', 'Auto / default marker')}</option>`];
    if (win.Ladders?.ordered) {
      for (const kind of ['dna', 'protein']) {
        for (const lad of win.Ladders.ordered(kind)) {
          out.push(`<option value="${esc(lad.id)}"${lad.id === selectedId ? ' selected' : ''}>${esc(lad.name)}</option>`);
        }
      }
    }
    return out.join('');
  }

  function renderBatchModal() {
    const dlg = ensureBatchModal();
    const configured = !!win.AIClient?.configured;
    const ep = /** @type {HTMLInputElement | null} */ (document.getElementById('aiEndpoint'))?.value?.trim() || '';
    const consented = !!win.AIConsent?.isConsented?.(ep);
    const aiReady = configured && consented;
    if (!aiReady) batchUseAI = false;

    const n = batchPendingFiles.length;
    const callCount = batchUseAI ? n * 2 : 0;
    const pct = batchProgress.total ? Math.round((batchProgress.done / batchProgress.total) * 100) : 0;

    const costLine = n > 0
      ? (batchUseAI
          ? L(`将调用 AI ${n}×2 次（共 ${callCount} 次视觉 API 请求，发送至 ${win.AIConsent?.hostOf?.(ep) || '已配置接口'}）`,
              `Will call AI ${n}×2 times (${callCount} vision API requests to ${win.AIConsent?.hostOf?.(ep) || 'configured endpoint'})`)
          : L(`离线本地批量处理：将处理 ${n} 张胶图（0 次 AI API 请求）`,
              `Offline local batch: will process ${n} gel images (0 AI API requests)`))
      : L('请先选择 2 张及以上胶图文件（支持 TIFF / PNG / JPG）', 'Select 2 or more gel image files (TIFF / PNG / JPG)');

    dlg.innerHTML = `
      <div class="v15-card" role="dialog" aria-modal="true" aria-label="${L('批量处理多张胶图', 'Batch Processing')}">
        <div class="v15-head">
          <h2>${L('批量处理多张胶图', 'Batch Process Multiple Gels')}</h2>
          <button type="button" class="btn sm" id="batchClose"${batchRunning ? ' disabled' : ''}>${L('关闭', 'Close')}</button>
        </div>
        <div class="v15-body">
          <div class="batch-drop" id="batchDropZone">
            <strong>${L('点击选择多张胶图（可一次多选）', 'Click to select multiple gel images')}</strong>
            <div style="font-size:11.8px;color:var(--muted);margin-top:4px;">${L('逐张串行处理，自动控制内存占用；完成后每张进入待核对清单逐一确认，最后统一套用版式打包 ZIP', 'Processed sequentially to keep memory low; review each gel in the Checklist, then export a unified ZIP')}</div>
            <input type="file" id="batchFileInput" multiple accept=".tif,.tiff,.png,.jpg,.jpeg,.bmp,image/*" class="hidden">
          </div>

          <div class="batch-cost-box" id="batchCostDisclosure">
            <strong>${esc(costLine)}</strong>
            <label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;margin-top:2px;">
              <input type="checkbox" id="batchUseAIChk"${batchUseAI ? ' checked' : ''}${aiReady ? '' : ' disabled'}>
              ${aiReady
                ? L('使用 AI 全自动逐张识别（透视 + 泳道 + Marker）', 'Run AI Auto-Flow per image (perspective + lanes + Marker)')
                : L('AI 接口未就绪（当前将使用离线本地识别；可在设置中配置 AI）', 'AI not configured (will run offline local detection; configure in Settings)')}
            </label>
          </div>

          <div class="batch-opts">
            <div class="batch-opt">
              <label for="batchLadderSel">${L('统一 Marker 型号', 'Marker model')}${batchUseAI && !batchLadderId ? ` <span style="color:var(--danger,#c62828);font-weight:500;">${L('（AI 模式必选）', '(required for AI)')}</span>` : ''}</label>
              <select id="batchLadderSel">${allLadderOptionsHtml(batchLadderId)}</select>
            </div>
            <div class="batch-opt">
              <label for="batchFmtSel">${L('打包导出格式', 'ZIP export format')}</label>
              <select id="batchFmtSel">
                <option value="png"${batchFormat === 'png' ? ' selected' : ''}>PNG (600 dpi)</option>
                <option value="tiff"${batchFormat === 'tiff' ? ' selected' : ''}>TIFF (lossless)</option>
                <option value="svg"${batchFormat === 'svg' ? ' selected' : ''}>SVG (vector)</option>
                <option value="pptx"${batchFormat === 'pptx' ? ' selected' : ''}>PPTX (editable)</option>
              </select>
            </div>
          </div>

          ${n ? `<div class="batch-file-list" id="batchFileList">
            ${batchPendingFiles.map((f, i) => `
              <div class="batch-file-item">
                <span>${i + 1}. ${esc(f.name)}</span>
                <button type="button" class="btn sm" data-batch-rm="${i}"${batchRunning ? ' disabled' : ''}>${L('移除', 'Remove')}</button>
              </div>`).join('')}
          </div>` : ''}

          ${batchRunning ? `
            <div>
              <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px;">
                <span>${L('正在处理：', 'Processing: ')}${esc(batchProgress.current)}</span>
                <span>${batchProgress.done} / ${batchProgress.total}</span>
              </div>
              <div class="batch-progress-bar"><div class="batch-progress-fill" style="width:${pct}%"></div></div>
            </div>` : ''}
        </div>
        <div class="v15-foot">
          <span style="font-size:11.8px;color:var(--muted);">${n ? L(`已选 ${n} 张胶图`, `${n} files selected`) : ''}${batchUseAI && !batchLadderId ? L(' · 请先选择统一 Marker 型号', ' · Select a Marker model first') : ''}</span>
          <div class="v15-row">
            ${batchRunning
              ? `<button type="button" class="btn sm" id="batchCancelRun">${L('中止队列', 'Stop queue')}</button>`
              : `<button type="button" class="btn sm" id="batchCancel">${L('取消', 'Cancel')}</button>
                 <button type="button" class="btn sm primary" id="batchStartBtn"${n > 0 && (!batchUseAI || !!batchLadderId) ? '' : ' disabled'}>${batchUseAI ? L(`确认并开始（AI ${n}×2 次）`, `Start (${n}×2 AI calls)`) : L(`开始离线批量处理（${n} 张）`, `Start offline batch (${n})`)}</button>`}
          </div>
        </div>
      </div>`;

    dlg.querySelector('#batchClose')?.addEventListener('click', closeBatchModal);
    dlg.querySelector('#batchCancel')?.addEventListener('click', closeBatchModal);
    dlg.querySelector('#batchCancelRun')?.addEventListener('click', () => {
      batchCancelled = true;
      batchAbortCtrl?.abort();
    });
    const fileInput = /** @type {HTMLInputElement | null} */ (dlg.querySelector('#batchFileInput'));
    dlg.querySelector('#batchDropZone')?.addEventListener('click', () => { if (!batchRunning) fileInput?.click(); });
    if (fileInput) {
      fileInput.addEventListener('change', () => {
        const fs = Array.from(fileInput.files || []);
        if (fs.length) {
          batchPendingFiles = batchPendingFiles.concat(fs);
          renderBatchModal();
        }
      });
    }
    dlg.querySelector('#batchUseAIChk')?.addEventListener('change', e => {
      batchUseAI = !!(/** @type {HTMLInputElement} */ (e.target)).checked;
      renderBatchModal();
    });
    dlg.querySelector('#batchLadderSel')?.addEventListener('change', e => {
      batchLadderId = (/** @type {HTMLSelectElement} */ (e.target)).value;
      renderBatchModal();
    });
    dlg.querySelector('#batchFmtSel')?.addEventListener('change', e => {
      batchFormat = (/** @type {HTMLSelectElement} */ (e.target)).value;
    });
    dlg.querySelectorAll('[data-batch-rm]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number((/** @type {HTMLElement} */ (btn)).dataset.batchRm);
        batchPendingFiles.splice(idx, 1);
        renderBatchModal();
      });
    });
    dlg.querySelector('#batchStartBtn')?.addEventListener('click', () => runBatchQueue());
  }

  /** @type {AbortController | null} */
  let batchAbortCtrl = null;

  async function runBatchQueue() {
    if (batchRunning || !batchPendingFiles.length) return;
    if (batchUseAI && !batchLadderId) {
      win.UI?.toast?.(L('AI 批量模式请先选择一个统一 Marker 型号', 'Select a Marker model first for AI batch mode'), 4000);
      return;
    }
    batchRunning = true;
    batchCancelled = false;
    batchAbortCtrl = new AbortController();
    batchItems = [];
    batchActiveIdx = -1;
    const files = batchPendingFiles.slice();
    batchProgress = { done: 0, total: files.length, current: '' };
    renderBatchModal();

    const A = win.App;
    for (let i = 0; i < files.length; i++) {
      if (batchCancelled) break;
      const f = files[i];
      batchProgress = { done: i, total: files.length, current: f.name };
      renderBatchModal();
      try {
        const buffer = await f.arrayBuffer();
        let mode = /** @type {'ai'|'local'} */ ('local');
        let aiSucceeded = false;

        if (batchUseAI && win.AutoFlow?.run && batchLadderId) {
          try {
            await win.AutoFlow.run({
              file: { name: f.name, buffer: buffer.slice(0) },
              ladderId: batchLadderId,
              silent: true,
              signal: batchAbortCtrl.signal
            });
            mode = 'ai';
            aiSucceeded = !!A.S;
          } catch (aiErr) {
            if (batchCancelled || batchAbortCtrl.signal.aborted) break;
            console.warn('Batch AI failed, falling back to local:', f.name, aiErr);
            mode = 'local';
          }
        }

        if (!aiSucceeded) {
          if (batchCancelled) break;
          const loaded = await A.loadMany([{ name: f.name, buffer: buffer.slice(0) }]);
          if (!loaded || !A.S) continue;
          if (batchLadderId && A.S.markers?.[0] && win.Ladders?.get?.(batchLadderId)) {
            A.S.markers[0].ladderId = batchLadderId;
            A.matchMarker?.(0);
            A.commit();
          }
        }

        batchItems.push({
          name: f.name,
          buffer,
          projectId: A.projectId || null,
          projectName: A.projectName || f.name,
          snapshot: A.snapshot(),
          initial: A.projectInitial ? A.projectInitial() : null,
          autoRotation: A.autoRotation || 0,
          hist: Array.isArray(A.hist) ? A.hist.slice() : null,
          future: Array.isArray(A.future) ? A.future.slice() : [],
          reviewed: false,
          mode
        });
      } catch (err) {
        console.warn('Batch item failed:', f.name, err);
      }
      batchProgress = { done: i + 1, total: files.length, current: f.name };
      renderBatchModal();
    }

    batchRunning = false;
    batchAbortCtrl = null;
    batchPendingFiles = [];
    closeBatchModal();

    if (batchItems.length) {
      batchActiveIdx = batchItems.length - 1;
      await switchBatchItem(0);
      renderBatchStrip();
      win.UI?.toast?.(L(`批量处理完成（${batchItems.length} 张），请逐张核对后导出 ZIP`, `Batch finished (${batchItems.length} gels); review each and export ZIP`));
    }
  }

  function saveCurrentBatchSnapshot() {
    if (batchActiveIdx < 0 || !batchItems[batchActiveIdx] || !win.App?.S) return;
    const item = batchItems[batchActiveIdx];
    item.snapshot = win.App.snapshot();
    if (Array.isArray(win.App.hist)) item.hist = win.App.hist.slice();
    if (Array.isArray(win.App.future)) item.future = win.App.future.slice();
  }

  /** @param {any} item @param {any} [styleOverride] */
  async function loadBatchItemState(item, styleOverride) {
    const A = win.App;
    const parsed = JSON.parse(item.snapshot);
    if (styleOverride) parsed.style = { ...(parsed.style || {}), ...styleOverride };
    if (A.readInput && A.restoreSnapshot) {
      const input = await A.readInput({ name: item.name, buffer: item.buffer.slice(0) });
      if (item.projectId && A.newCachedProject) A.newCachedProject(item.projectId, item.projectName || item.name);
      A.restoreSnapshot(input, parsed, item.initial, item.autoRotation);
      if (Array.isArray(item.hist) && item.hist.length) {
        A.hist = item.hist.slice();
        A.future = Array.isArray(item.future) ? item.future.slice() : [];
        A.emit?.('refresh');
      }
    } else {
      await A.loadMany([{ name: item.name, buffer: item.buffer.slice(0) }]);
      A.S = parsed;
      A.ensureRot?.();
      A.commit?.();
    }
  }

  /** @param {number} idx */
  async function switchBatchItem(idx) {
    if (idx < 0 || idx >= batchItems.length) return;
    if (batchActiveIdx >= 0 && batchActiveIdx !== idx) saveCurrentBatchSnapshot();
    const item = batchItems[idx];
    batchActiveIdx = idx;
    await loadBatchItemState(item);
    item.reviewed = true;
    win.ReviewChecklist?.render?.();
    renderBatchStrip();
  }

  function applyCurrentStyleToAllBatch() {
    if (!batchItems.length || !win.App?.template) return;
    saveCurrentBatchSnapshot();
    const tpl = JSON.parse(JSON.stringify(win.App.template()));
    for (const item of batchItems) {
      try {
        const s = JSON.parse(item.snapshot);
        s.style = { ...(s.style || {}), ...(tpl.style || {}) };
        item.snapshot = JSON.stringify(s);
      } catch (_) {}
    }
    win.UI?.toast?.(L(`已将当前版式模板套用到全部 ${batchItems.length} 张胶图`, `Applied current style template to all ${batchItems.length} gels`));
  }

  async function exportBatchZip() {
    if (!batchItems.length || !win.App || !win.Export || !win.PPTX?.zip) return;
    saveCurrentBatchSnapshot();
    const A = win.App;
    const tpl = JSON.parse(JSON.stringify(A.template()));
    const origIdx = batchActiveIdx;
    /** @type {[string, string | Uint8Array][]} */
    const entries = [];
    const manifestItems = [];

    A.busy?.(true, L('正在统一套用版式并打包批量 ZIP…', 'Applying style & building batch ZIP…'));
    try {
      for (let i = 0; i < batchItems.length; i++) {
        const item = batchItems[i];
        await loadBatchItemState(item, tpl.style || {});

        const safeStem = item.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]+/g, '_').slice(0, 48) || `gel_${i + 1}`;
        const folder = `${String(i + 1).padStart(2, '0')}_${safeStem}`;
        const fig = A.buildFigure(false);
        const dpi = A.S.style?.dpi || 600;
        let figBytes;
        let figExt = batchFormat === 'tiff' ? 'tif' : batchFormat;

        if (batchFormat === 'svg') {
          figBytes = new TextEncoder().encode(fig.svg);
        } else if (batchFormat === 'pptx') {
          figBytes = new Uint8Array(await (await win.PPTX.build()).arrayBuffer());
        } else {
          const canvas = await win.Export.svgToCanvas(fig.svg, fig.w, fig.h, dpi);
          if (batchFormat === 'tiff') {
            const px = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
            const rgb = new Uint8Array(canvas.width * canvas.height * 3);
            for (let p = 0, q = 0; p < px.length; p += 4) { rgb[q++] = px[p]; rgb[q++] = px[p + 1]; rgb[q++] = px[p + 2]; }
            figBytes = win.Export.encodeTiffRGB(rgb, canvas.width, canvas.height, dpi, `GelFigure batch: ${item.name}`);
          } else {
            const pngBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            const dec = await win.Export.pngDecorate(pngBlob, dpi, { Software: 'GelFigure ' + A.VERSION, Description: item.name });
            figBytes = new Uint8Array(await dec.arrayBuffer());
          }
        }

        const log = win.Export.processingLog(A.S);
        const legend = buildLegend(A.S, win.I18N?.lang === 'en' ? 'en' : 'zh');
        const projBlob = await A.projectBlob();
        entries.push([`${folder}/figure.${figExt}`, figBytes]);
        entries.push([`${folder}/processing-log.json`, JSON.stringify(log, null, 2)]);
        entries.push([`${folder}/legend-draft.txt`, legend + '\n']);
        entries.push([`${folder}/project.gelfig`, new Uint8Array(await projBlob.arrayBuffer())]);
        manifestItems.push({ index: i + 1, source: item.name, folder, format: figExt, reviewed: item.reviewed, mode: item.mode, sha256: A.S.file?.sha256 || '' });
      }

      entries.push(['batch-manifest.json', JSON.stringify({
        tool: 'GelFigure',
        version: A.VERSION,
        createdAt: new Date().toISOString(),
        format: batchFormat,
        count: manifestItems.length,
        items: manifestItems
      }, null, 2)]);

      const zipBlob = win.PPTX.zip(entries, 'application/zip');
      const zipName = `GelFigure_batch_${manifestItems.length}gels.zip`;
      if (win.Export.deliver) win.Export.deliver(zipBlob, zipName);
      else win.Export.download(zipBlob, zipName);

      win.UI?.toast?.(L(`已打包下载 ${manifestItems.length} 张胶图 ZIP`, `Downloaded batch ZIP (${manifestItems.length} gels)`));
      return zipBlob;
    } finally {
      try {
        if (origIdx >= 0 && origIdx < batchItems.length) {
          batchActiveIdx = -1;
          await switchBatchItem(origIdx);
        }
      } finally {
        A.busy?.(false);
      }
    }
  }

  function renderBatchStrip() {
    const stage = document.getElementById('stage');
    if (!stage) return;
    if (!batchStrip) {
      batchStrip = document.createElement('div');
      batchStrip.id = 'batchStrip';
      batchStrip.className = 'batch-strip hidden';
      stage.insertBefore(batchStrip, stage.firstChild);
    }
    if (!batchItems.length) {
      batchStrip.classList.add('hidden');
      batchStrip.innerHTML = '';
      return;
    }
    batchStrip.classList.remove('hidden');
    batchStrip.innerHTML = `
      <strong style="white-space:nowrap;">${L(`批量核对 ${batchActiveIdx + 1}/${batchItems.length}`, `Batch ${batchActiveIdx + 1}/${batchItems.length}`)}</strong>
      <div class="batch-strip-chips">
        ${batchItems.map((it, i) => `
          <button type="button" class="batch-chip${i === batchActiveIdx ? ' on' : ''}${it.reviewed ? ' done' : ''}" data-batch-idx="${i}">${i + 1}. ${esc(it.name)}</button>`).join('')}
      </div>
      <div class="batch-strip-actions">
        <button type="button" class="btn sm" id="btnBatchApplyTpl">${L('套用版式到全部', 'Apply style to all')}</button>
        <button type="button" class="btn sm primary" id="btnBatchExportZip">${L('打包下载 ZIP', 'Download ZIP')}</button>
        <button type="button" class="btn sm" id="btnBatchExit">${L('退出批量', 'Exit')}</button>
      </div>`;

    batchStrip.querySelectorAll('[data-batch-idx]').forEach(btn => {
      btn.addEventListener('click', () => switchBatchItem(Number((/** @type {HTMLElement} */ (btn)).dataset.batchIdx)));
    });
    batchStrip.querySelector('#btnBatchApplyTpl')?.addEventListener('click', applyCurrentStyleToAllBatch);
    batchStrip.querySelector('#btnBatchExportZip')?.addEventListener('click', () => exportBatchZip());
    batchStrip.querySelector('#btnBatchExit')?.addEventListener('click', () => {
      batchItems = [];
      batchActiveIdx = -1;
      renderBatchStrip();
    });
  }

  function openBatchModal(files) {
    if (Array.isArray(files) && files.length) batchPendingFiles = files.slice();
    batchLadderId = win.WelcomeAI?.defaultLadderId?.() || win.App?.S?.markers?.[0]?.ladderId || '';
    const dlg = ensureBatchModal();
    dlg.classList.remove('hidden');
    renderBatchModal();
  }

  function closeBatchModal() {
    if (batchDlg) batchDlg.classList.add('hidden');
  }

  function injectBatchEntries() {
    const moreMenu = document.getElementById('tplMenu') || document.getElementById('moreMenu');
    if (moreMenu && !document.getElementById('btnBatchMenu')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'btnBatchMenu';
      btn.textContent = L('批量处理多张胶图…', 'Batch process gels…');
      btn.addEventListener('click', () => {
        moreMenu.classList.add('hidden');
        openBatchModal();
      });
      moreMenu.insertBefore(btn, moreMenu.firstChild);
    }
    const card3 = document.getElementById('btnWelcomeProject');
    if (card3 && !card3.querySelector('#btnWelcomeBatch')) {
      const tx = card3.querySelector('.welcome-card-tx');
      if (tx) {
        const pill = document.createElement('span');
        pill.id = 'btnWelcomeBatch';
        pill.className = 'welcome-card-sub-btn';
        pill.setAttribute('role', 'button');
        pill.setAttribute('tabindex', '0');
        pill.textContent = L('进入批量处理 →', 'Open batch mode →');
        const triggerBatch = e => {
          e.stopPropagation();
          e.preventDefault();
          openBatchModal();
        };
        pill.addEventListener('click', triggerBatch);
        pill.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') triggerBatch(e);
        });
        tx.appendChild(pill);
      }
    }
  }

  /* ======================================================================
   * Bootstrap
   * ====================================================================== */
  function init() {
    injectSampleTableButtons();
    injectBatchEntries();
    initAutocomplete();
    refreshAutocompletePool();

    if (win.App?.on) {
      win.App.on(w => {
        if (w === 'loaded' || w === 'change' || w === 'refresh') {
          injectSampleTableButtons();
          injectBatchEntries();
        }
        if (w === 'loaded' || w === 'change') {
          refreshAutocompletePool();
        }
      });
    }
    if (win.I18N?.onChange) {
      win.I18N.onChange(() => {
        const b1 = document.getElementById('btnSampleTable');
        if (b1) b1.textContent = L('粘贴样本表', 'Sample table');
        const b2 = document.getElementById('btnFigSampleTable');
        if (b2) b2.textContent = L('粘贴样本表', 'Sample table');
        const b3 = document.getElementById('btnBatchMenu');
        if (b3) b3.textContent = L('批量处理多张胶图…', 'Batch process gels…');
        const b4 = document.getElementById('btnWelcomeBatch');
        if (b4) b4.textContent = L('进入批量处理 →', 'Open batch mode →');
        if (batchItems.length) renderBatchStrip();
      });
    }
    // Re-inject welcome batch pill whenever WelcomeView re-renders
    const welcomeEl = document.getElementById('welcomeView');
    if (welcomeEl && typeof MutationObserver !== 'undefined') {
      new MutationObserver(() => injectBatchEntries()).observe(welcomeEl, { childList: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  win.SampleTable = { open: openSampleTable, close: closeSampleTable, parseTable };
  win.LaneAutocomplete = { refresh: refreshAutocompletePool, record: recordLaneNames, get pool() { return acPool.slice(); } };
  win.LegendCopy = { open: openLegendModal, close: closeLegendModal, buildLegend };
  win.BatchProcessor = {
    open: openBatchModal,
    close: closeBatchModal,
    exportZip: exportBatchZip,
    switchTo: switchBatchItem,
    get items() { return batchItems; },
    get activeIndex() { return batchActiveIdx; }
  };
})(window);
