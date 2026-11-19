/* Two explicit inputs start an isolated run. Only a complete result (or explicit user partial adopt) enters the editor. */
(function (G) {
  'use strict';
  const A = G.App, L = G.L, $ = id => document.getElementById(id);
  const panel = $('autoFlowPage'), select = $('autoFlowLadder'), thumb = $('autoFlowThumb');
  G.AIWorkspace.host.appendChild(panel);
  let active = false, file = null, task = null, phase = 'idle', error = '';
  let cachedLayout = null, timerId = 0, runStartedAt = 0;

  const fileKeyOf = f => f ? `${f.name}:${f.size}:${f.lastModified}` : '';
  function hasValidCache(kind) {
    return !!(cachedLayout && file && cachedLayout.fileKey === fileKeyOf(file) && cachedLayout.kind === kind);
  }
  function clearCache() { cachedLayout = null; }

  function syncSetupBanner() {
    const setup = $('autoFlowSetup');
    if (setup) setup.classList.toggle('hidden', G.AIClient.configured);
  }

  function stopTimer() {
    if (timerId) { clearInterval(timerId); timerId = 0; }
    const el = $('autoFlowElapsed');
    if (el) { el.textContent = ''; el.classList.add('hidden'); }
  }
  function startTimer() {
    stopTimer();
    runStartedAt = Date.now();
    const el = $('autoFlowElapsed');
    if (!el) return;
    const tick = () => {
      const sec = Math.max(0, Math.floor((Date.now() - runStartedAt) / 1000));
      el.textContent = L(`已耗时 ${sec}s`, `${sec}s elapsed`);
      el.classList.remove('hidden');
    };
    tick();
    timerId = setInterval(tick, 500);
  }

  function updateSteps(next) {
    const steps = $('autoFlowSteps');
    if (!steps) return;
    const running = ['reading', 'layout', 'markers', 'saving'].includes(next);
    const kind = G.Ladders.get(select.value) ? G.Ladders.kindOf(G.Ladders.get(select.value)) : null;
    const cached = !!(kind && hasValidCache(kind));
    const showSteps = running || (next === 'error' && cached);
    steps.classList.toggle('hidden', !showSteps);
    const stepState = {
      layout: next === 'reading' || next === 'layout' ? 'active'
        : (next === 'markers' || next === 'saving' || (next === 'error' && cached)) ? 'done' : '',
      markers: next === 'markers' ? 'active' : next === 'saving' ? 'done' : '',
      saving: next === 'saving' ? 'active' : ''
    };
    steps.querySelectorAll('[data-step]').forEach(el => {
      const st = stepState[el.dataset.step] || '';
      el.classList.toggle('is-active', st === 'active');
      el.classList.toggle('is-done', st === 'done');
    });
  }

  function showStatus(next, message = '') {
    phase = next;
    error = message;
    const progress = {
      idle: G.AIClient.configured ? '' : L('请先完成上方 API 配置，也可先选好胶图和 Marker 型号。', 'Configure your API above first, or pick your gel image and marker model now.'),
      image: L('请选择一张胶图（支持拖拽、点击或 Ctrl+V 粘贴）。', 'Choose a gel image (drop, click, or paste with Ctrl+V).'),
      model: L('请选择这张胶图使用的 Marker 型号。', 'Select the marker model used on this gel.'),
      reading: L('正在读取图片…', 'Reading the image…'),
      layout: L('正在识别胶面四角和泳道…', 'Locating the gel corners and lanes…'),
      markers: L('正在校正图上识别并标记 Marker 条带…', 'Locating and labelling marker bands on the corrected image…'),
      saving: L('正在打开标记后的成图…', 'Opening the labelled figure…')
    };
    panel.dataset.phase = phase;
    $('autoFlowStatus').textContent = error || progress[phase] || '';
    $('autoFlowStatus').classList.toggle('error', !!error);
    const ladder = G.Ladders.get(select.value);
    const kind = ladder ? G.Ladders.kindOf(ladder) : null;
    const canCacheRetry = !!(error && file && ladder && hasValidCache(kind));
    const running = !!task;
    const cancelBtn = $('autoFlowCancel');
    if (cancelBtn) cancelBtn.classList.toggle('hidden', !running);
    const retryBtn = $('autoFlowRetry');
    retryBtn.classList.toggle('hidden', !(error && file && select.value && !running));
    retryBtn.textContent = canCacheRetry
      ? L('仅重试 Marker 标记（复用校正结果）', 'Retry Marker labelling only (reuse layout)')
      : L('用当前图片和型号重试', 'Retry with these inputs');
    const partialBtn = $('autoFlowOpenPartial');
    if (partialBtn) partialBtn.classList.toggle('hidden', !(canCacheRetry && !running));
    const restartBtn = $('autoFlowRestart');
    if (restartBtn) restartBtn.classList.toggle('hidden', !(canCacheRetry && !running));
    updateSteps(next);
    if (!running) stopTimer();
  }

  function renderQuickLadders() {
    const host = $('autoFlowQuickLadders');
    if (!host) return;
    const picks = [];
    const seen = new Set();
    const push = (id, recent) => {
      if (!id || seen.has(id)) return;
      const lad = G.Ladders.get(id);
      if (!lad) return;
      seen.add(id);
      picks.push({ lad, recent });
    };
    const lastId = A.prefs().autoFlowLadder;
    if (lastId) push(lastId, true);
    for (const kind of ['dna', 'protein']) {
      for (const lad of G.Ladders.favoritesOf(kind)) {
        if (picks.length >= 6) break;
        push(lad.id, false);
      }
    }
    if (!picks.length) {
      host.classList.add('hidden');
      host.innerHTML = '';
      return;
    }
    host.classList.remove('hidden');
    host.innerHTML = `<span class="quick-ladders-label">${L('常用 / 最近：', 'Quick pick:')}</span>` +
      picks.map(({ lad, recent }) => {
        const on = select.value === lad.id;
        const badge = recent ? L('最近 · ', 'Recent · ') : '★ ';
        return `<button type="button" class="btn sm ghost quick-ladder-chip${on ? ' on' : ''}" data-quick-ladder="${G.UI.esc(lad.id)}">${badge}${G.UI.esc(lad.name)}</button>`;
      }).join('');
    host.querySelectorAll('[data-quick-ladder]').forEach(btn => {
      btn.onclick = () => {
        select.value = btn.dataset.quickLadder;
        if (select._clearSearch) select._clearSearch();
        renderQuickLadders();
        processInputs();
      };
    });
  }

  function syncModels() {
    const selected = select.value;
    select.replaceChildren(new Option(L('选择 Marker 型号', 'Select a marker model'), ''));
    for (const kind of ['dna', 'protein']) {
      const group = document.createElement('optgroup');
      group.label = kind === 'dna' ? 'DNA (bp)' : L('蛋白质 (kDa)', 'Protein (kDa)');
      for (const ladder of G.Ladders.ordered(kind)) {
        const star = G.Ladders.isFavorite(ladder.id) ? '★ ' : '';
        group.appendChild(new Option(star + ladder.name, ladder.id));
      }
      select.appendChild(group);
    }
    select.value = G.Ladders.get(selected) ? selected : '';
    if (G.UI.attachLadderSearch) G.UI.attachLadderSearch(select, { id: 'autoFlowLadderSearch' });
    if (select._refreshSearch) select._refreshSearch();
    renderQuickLadders();
  }

  function stop() {
    const previous = task;
    task = null;
    stopTimer();
    if (previous) previous.controller.abort();
  }
  function clearFile() {
    file = null;
    clearCache();
    $('autoFlowFile').value = '';
    $('autoFlowFileName').textContent = 'TIFF · PNG · JPEG · BMP';
    thumb.removeAttribute('src');
    thumb.classList.add('hidden');
  }
  function sameProject(run) {
    return A.sourceGeneration === run.generation && A.S === run.project && A.snapshot() === run.snapshot;
  }
  function current(run) {
    if (task !== run) return false;
    if (run.controller.signal.aborted) throw new Error(L('请求已取消', 'Request cancelled'));
    if (!sameProject(run)) throw new Error(L('当前项目已切换或修改，请重新处理。', 'The current project changed. Run again.'));
    return true;
  }
  async function timedRequest(run, send) {
    const timer = setTimeout(() => { run.timedOut = true; run.controller.abort(); }, 90000);
    try { return await send(run.controller.signal); }
    finally { clearTimeout(timer); }
  }

  async function openPartialResult() {
    const ladder = G.Ladders.get(select.value);
    const kind = ladder ? G.Ladders.kindOf(ladder) : cachedLayout?.kind;
    if (!cachedLayout || !hasValidCache(kind)) return;
    stop();
    try {
      showStatus('saving');
      if (!await G.UI.archiveCurrent()) { showStatus('error', L('已取消切换项目。', 'Project switch cancelled.')); return; }
      const c = cachedLayout;
      clearCache();
      A.adoptAutomatic(c.input, c.layout, c.corrected, [], c.kind);
      G.AIWorkspace.close();
      if (G.UI.isPhone()) G.Mobile.setView('fig');
      G.Editor.fitCrop();
      G.UI.toast(L('已导入校正后的泳道图（暂未标注 Marker），可在左侧 Marker 区继续识别或手调。',
        'Opened the corrected gel (without markers). Use the Marker section on the left to detect or calibrate.'), 7500, {
        label: L('AI Marker 复核 →', 'AI Marker review →'),
        onClick: () => G.MarkerAI.open()
      });
    } catch (err) {
      showStatus('error', err.message);
    }
  }

  async function processInputs(forceFull = false) {
    stop();
    const ladder = G.Ladders.get(select.value);
    renderQuickLadders();
    if (!active) return;
    if (ladder) A.setPref('autoFlowLadder', ladder.id);
    if (!file || !ladder) {
      showStatus(file ? 'model' : ladder ? 'image' : 'idle');
      return;
    }
    if (!G.AIClient.configured) {
      syncSetupBanner();
      showStatus('error', L('请先在设置中保存有效的接口配置。', 'Save a valid API configuration in Settings first.'));
      return;
    }
    const kind = G.Ladders.kindOf(ladder);
    if (forceFull) clearCache();
    const run = {controller:new AbortController(), generation:A.sourceGeneration,
      project:A.S, snapshot:A.snapshot(), ladder:JSON.stringify(ladder)};
    task = run;
    startTimer();
    try {
      let input, layout, corrected, markerImage;
      if (!forceFull && hasValidCache(kind)) {
        ({ input, layout, corrected, markerImage } = cachedLayout);
      } else {
        clearCache();
        showStatus('reading');
        input = await A.readInput(file);
        if (!current(run)) return;
        const img = input.img;
        const raw = {w:img.width, h:img.height, data:img.data};
        const sourceImage = G.AIClient.encodeImage(raw, img.rgb);
        thumb.src = sourceImage.url;
        thumb.classList.remove('hidden');

        showStatus('layout');
        const proposal = await timedRequest(run, signal => G.GelAIBeta.detectLayout(sourceImage, kind, signal));
        if (!current(run)) return;
        layout = G.GelAIBeta.plan(proposal, 4, raw);
        corrected = G.Perspective.warp(raw, layout.spec, false);
        const rgb = img.rgb && G.Perspective.warp({w:raw.w, h:raw.h, data:img.rgb}, layout.spec, true).data;
        markerImage = G.AIClient.encodeImage(corrected, rgb);
        cachedLayout = { fileKey: fileKeyOf(file), kind, input, layout, corrected, markerImage };
      }

      showStatus('markers');
      const markers = await timedRequest(run, signal => G.MarkerAI.detectAutomaticMarkers(markerImage, ladder, layout, signal));
      if (!current(run)) return;
      showStatus('saving');
      if (!await G.UI.archiveCurrent()) throw new Error(L('已取消切换项目。', 'Project switch cancelled.'));
      if (!current(run)) return;
      run.installing = true;
      clearCache();
      A.adoptAutomatic(input, layout, corrected, markers, kind);
      G.AIWorkspace.close();
      if (G.UI.isPhone()) G.Mobile.setView('fig');
      G.Editor.fitCrop();
      const n = layout.meta.visibleLanes, bands = markers.reduce((total, m) => total + m.bands.length, 0);
      let summary = L('已校正 ' + n + ' 条泳道，标记 ' + markers.length + ' 个 Marker、' + bands + ' 条条带。',
        'Corrected ' + n + ' lanes and labelled ' + bands + ' bands across ' + markers.length + ' marker lane(s).');
      if (layout.meta.automaticCoverage)
        summary += L(' 已自动扩大校正范围，保留所有有带和不确定泳道。', ' The correction area was automatically expanded to cover all active and uncertain lanes.');
      if (markers.some(m => m.orderPairing.mismatch))
        summary += L(' 检出条带数与型号不一致，请在 Marker 面板核对顺序配对。', ' Band counts differ from the selected model. Check the sequential pairing in the Marker panel.');
      G.UI.toast(summary, 8500);
    } catch (err) {
      if (task !== run) return;
      const reason = run.timedOut ? L('接口超过 90 秒未返回。', 'The API timed out after 90 seconds.')
        : err instanceof TypeError && (phase === 'layout' || phase === 'markers')
          ? L('网络请求失败，请检查接口地址和跨域（CORS）设置。', 'Network request failed. Check the API address and CORS settings.')
          : err.message;
      const stage = phase === 'layout' ? L('泳道校正未完成。', 'Lane correction did not finish. ')
        : phase === 'markers' ? L('Marker 标记未完成。', 'Marker labelling did not finish. ') : '';
      task = null;
      showStatus('error', stage + reason);
    } finally {
      if (task === run) { task = null; stopTimer(); }
    }
  }

  function selectFiles(files) {
    if (!active) return;
    stop();
    clearFile();
    if (files.length !== 1) {
      showStatus('error', L('请一次选择一张胶图。', 'Choose one gel image at a time.'));
      return;
    }
    const next = files[0];
    if (!/^image\//i.test(next.type) && !/\.(tiff?|png|jpe?g|bmp|webp|gif)$/i.test(next.name)) {
      showStatus('error', L('请选择胶图图片文件。', 'Choose a gel image file.'));
      return;
    }
    file = next;
    $('autoFlowFileName').textContent = file.name;
    processInputs();
  }

  function open() {
    if (active) return;
    G.UI.flushPending();
    clearFile(); select.value = ''; syncModels(); syncSetupBanner(); showStatus('idle');
    active = true;
    const entry = $('btnAutoFlow');
    const returnTarget = entry && entry.getClientRects().length ? entry : $('btnSettings');
    returnTarget.focus();
    document.body.classList.add('auto-flow-active');
    G.AIWorkspace.show(panel, G.AIClient.configured ? $('autoFlowDrop') : ($('autoFlowOpenSettings') || $('autoFlowDrop')));
    G.Ladders.ready.then(() => { if (active) syncModels(); });
  }
  $('autoFlowBack').onclick = G.AIWorkspace.close;
  $('autoFlowDrop').onclick = () => $('autoFlowFile').click();
  if ($('autoFlowOpenSettings')) $('autoFlowOpenSettings').onclick = () => G.AIClient.openSettings();
  $('autoFlowFile').onchange = e => {
    const files = Array.from(e.target.files);
    if (files.length) selectFiles(files);
  };
  select.onchange = () => processInputs();
  $('autoFlowRetry').onclick = () => processInputs(false);
  if ($('autoFlowCancel')) $('autoFlowCancel').onclick = () => {
    if (!task) return;
    stop();
    showStatus('error', L('已取消本次处理。你可以更换图片、切换型号或点击重试。', 'Processing cancelled. Change the image/model or retry when ready.'));
  };
  if ($('autoFlowOpenPartial')) $('autoFlowOpenPartial').onclick = openPartialResult;
  if ($('autoFlowRestart')) $('autoFlowRestart').onclick = () => processInputs(true);
  G.addEventListener('gelfigure-ai-task-close', e => {
    if (!active || e.detail === panel.id) return;
    stop(); active = false; clearFile(); select.value = '';
    if (select._clearSearch) select._clearSearch();
    document.body.classList.remove('auto-flow-active');
  });
  G.addEventListener('gelfigure-ai-settings-changed', () => {
    if (!active) return;
    syncSetupBanner();
    if (!task) return;
    stop(); showStatus('error', L('接口配置已更改，请保存配置后重试。', 'API settings changed. Save your configuration and retry.'));
  });
  G.addEventListener('gelfigure-ai-settings-saved', () => {
    if (!active) return;
    syncSetupBanner();
    if (!task) {
      if (G.AIClient.configured && file && select.value) {
        showStatus('ready', L('接口配置已就绪，点击下方按钮开始自动处理。', 'API configuration saved. Click below to start automatic processing.'));
        $('autoFlowStatus').classList.remove('error');
        $('autoFlowRetry').classList.remove('hidden');
        $('autoFlowRetry').textContent = L('开始 AI 全自动处理', 'Start AI automatic processing');
      } else {
        showStatus(file ? (select.value ? 'idle' : 'model') : select.value ? 'image' : 'idle');
      }
    }
  });
  G.addEventListener('gelfigure-ladders', () => {
    if (!active) return;
    if (task && JSON.stringify(G.Ladders.get(select.value)) !== task.ladder) {
      stop(); syncModels();
      showStatus('error', L('所选型号的定义已变化，请核对后重新处理。', 'The selected model changed. Check the selection and run again.'));
    } else syncModels();
  });
  A.on(what => {
    if (task && !task.installing && (what === 'loaded' || what === 'change') && !sameProject(task)) {
      stop(); showStatus('error', L('项目已切换或修改，本次处理已取消。', 'The project changed. Automatic processing was cancelled.'));
    }
  });
  // Editor shortcuts on window must not edit a project hidden behind this page.
  document.addEventListener('keydown', e => { if (active) e.stopPropagation(); });
  G.I18N.onChange(() => { if (active) { syncModels(); syncSetupBanner(); showStatus(phase, error); } });
  G.AutoFlow = {open, selectFiles, get active() { return active; }, get hasCachedLayout() { return !!cachedLayout; }};
})(window);
