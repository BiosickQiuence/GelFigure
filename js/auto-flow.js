/* Two explicit inputs start an isolated run. Only a complete result enters the editor. */
(function (G) {
  'use strict';
  const A = G.App, L = G.L, $ = id => document.getElementById(id);
  const panel = $('autoFlowPage'), select = $('autoFlowLadder'), thumb = $('autoFlowThumb');
  G.AIWorkspace.host.appendChild(panel);
  let active = false, file = null, task = null, phase = 'idle', error = '';

  function showStatus(next, message = '') {
    phase = next;
    error = message;
    const progress = {
      idle: '', image: L('请选择一张胶图。', 'Choose a gel image.'),
      model: L('请选择这张胶图使用的 Marker 型号。', 'Select the marker model used on this gel.'),
      reading: L('正在读取图片…', 'Reading the image…'),
      layout: L('正在识别胶面四角和泳道…', 'Locating the gel corners and lanes…'),
      markers: L('正在校正图上识别并标记 Marker 条带…', 'Locating and labelling marker bands on the corrected image…'),
      saving: L('正在打开标记后的成图…', 'Opening the labelled figure…')
    };
    panel.dataset.phase = phase;
    $('autoFlowStatus').textContent = error || progress[phase] || '';
    $('autoFlowStatus').classList.toggle('error', !!error);
    $('autoFlowRetry').classList.toggle('hidden', !(error && file && select.value));
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
  }

  function stop() {
    const previous = task;
    task = null;
    if (previous) previous.controller.abort();
  }
  function clearFile() {
    file = null;
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

  async function processInputs() {
    stop();
    const ladder = G.Ladders.get(select.value);
    if (!active) return;
    if (!file || !ladder) {
      showStatus(file ? 'model' : ladder ? 'image' : 'idle');
      return;
    }
    if (!G.MarkerAI.configured) {
      showStatus('error', L('请先在设置中保存有效的接口配置。', 'Save a valid API configuration in Settings first.'));
      return;
    }
    const kind = G.Ladders.kindOf(ladder);
    const run = {controller:new AbortController(), generation:A.sourceGeneration,
      project:A.S, snapshot:A.snapshot(), ladder:JSON.stringify(ladder)};
    task = run;
    try {
      showStatus('reading');
      const input = await A.readInput(file);
      if (!current(run)) return;
      const img = input.img;
      const raw = {w:img.width, h:img.height, data:img.data};
      const sourceImage = G.MarkerAI.encodeImage(raw, img.rgb);
      thumb.src = sourceImage.url;
      thumb.classList.remove('hidden');

      showStatus('layout');
      const proposal = await timedRequest(run, signal => G.GelAIBeta.detectLayout(sourceImage, kind, signal));
      if (!current(run)) return;
      const layout = G.GelAIBeta.plan(proposal, 4, raw);
      const corrected = G.Perspective.warp(raw, layout.spec, false);
      const rgb = img.rgb && G.Perspective.warp({w:raw.w, h:raw.h, data:img.rgb}, layout.spec, true).data;
      const markerImage = G.MarkerAI.encodeImage(corrected, rgb);

      showStatus('markers');
      const markers = await timedRequest(run, signal => G.MarkerAI.detectAutomaticMarkers(markerImage, ladder, layout, signal));
      if (!current(run)) return;
      showStatus('saving');
      if (!await G.UI.archiveCurrent()) throw new Error(L('已取消切换项目。', 'Project switch cancelled.'));
      if (!current(run)) return;
      run.installing = true;
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
      showStatus('error', stage + reason);
    } finally {
      if (task === run) task = null;
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
    if (active || !G.MarkerAI.configured) return;
    G.UI.flushPending();
    clearFile(); select.value = ''; syncModels(); showStatus('idle');
    active = true;
    const entry = $('btnAutoFlow');
    const returnTarget = entry.getClientRects().length ? entry : $('btnSettings');
    returnTarget.focus();
    document.body.classList.add('auto-flow-active');
    G.AIWorkspace.show(panel, $('autoFlowDrop'));
    G.Ladders.ready.then(() => { if (active) syncModels(); });
  }
  $('autoFlowBack').onclick = G.AIWorkspace.close;
  $('autoFlowDrop').onclick = () => $('autoFlowFile').click();
  $('autoFlowFile').onchange = e => {
    const files = Array.from(e.target.files);
    if (files.length) selectFiles(files);
  };
  select.onchange = processInputs;
  $('autoFlowRetry').onclick = processInputs;
  G.addEventListener('gelfigure-ai-task-close', e => {
    if (!active || e.detail === panel.id) return;
    stop(); active = false; clearFile(); select.value = '';
    document.body.classList.remove('auto-flow-active');
  });
  G.addEventListener('gelfigure-ai-settings-changed', () => {
    if (!active || !task) return;
    stop(); showStatus('error', L('接口配置已更改，请保存配置后重试。', 'API settings changed. Save your configuration and retry.'));
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
  G.I18N.onChange(() => { if (active) { syncModels(); showStatus(phase, error); } });
  G.AutoFlow = {open, selectFiles, get active() { return active; }};
})(window);
