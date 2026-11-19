import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CORS = { 'Access-Control-Allow-Origin': '*' };

async function syntheticGelPng(page, w = 240, h = 160) {
  return Buffer.from(await page.evaluate(async ([W, H]) => {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0c1118'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#e5eef8';
    for (const x of [48, 120, 192]) {
      for (const y of [36, 68, 104, 132]) ctx.fillRect(x - 10, y - 2, 20, 4);
    }
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  }, [w, h]));
}

const qRect = (x0, y0, x1, y1) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 }
];

export async function uxOptimizationChecks(browser, base, root, engine = 'chromium') {
  const results = [];
  const check = async (name, fn) => {
    try { await fn(); results.push(['ok', 'ux: ' + name]); }
    catch (err) { results.push(['FAIL', 'ux: ' + name, err.stack || err.message]); }
  };

  // 1. AI Settings presets, paste sanitization, key toggle, and connection test
  await check('AI settings presets, paste sanitization, key show/hide, and connection test', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    let testStatus = 200;
    let lastAuth = '';
    await ctx.route('https://generativelanguage.googleapis.com/**', async route => {
      lastAuth = route.request().headers()['authorization'] || '';
      if (testStatus === 200) {
        await route.fulfill({
          status: 200,
          headers: CORS,
          contentType: 'application/json',
          body: JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: 'ok' } }] })
        });
      } else {
        await route.fulfill({ status: testStatus, headers: CORS, contentType: 'application/json', body: '{"error":"unauthorized"}' });
      }
    });
    try {
      await p.goto(base + '/index.html?demo=1&lang=en');
      await p.waitForFunction(() => window.App?.S?.lanes?.length > 0);
      await p.locator('#btnSettings').click();

      // Bailian preset & model chips
      await p.locator('#aiProvider').selectOption('bailian');
      assert.equal(await p.locator('#aiEndpoint').inputValue(), 'https://dashscope.aliyuncs.com/compatible-mode/v1');
      assert.equal(await p.locator('#aiModel').inputValue(), 'qwen3-vl-plus');
      await p.locator('#aiModelPresets button', { hasText: 'qwen4-max' }).click();
      assert.equal(await p.locator('#aiModel').inputValue(), 'qwen4-max');

      // OpenAI preset
      await p.locator('#aiProvider').selectOption('openai');
      assert.equal(await p.locator('#aiEndpoint').inputValue(), 'https://api.openai.com/v1');
      assert.equal(await p.locator('#aiModel').inputValue(), 'gpt-6.2-sol');

      // Gemini preset
      await p.locator('#aiProvider').selectOption('gemini');
      assert.equal(await p.locator('#aiEndpoint').inputValue(), 'https://generativelanguage.googleapis.com/v1beta/openai');
      assert.equal(await p.locator('#aiModel').inputValue(), 'gemini-4-hydrogen');

      // Key toggle + Bearer/quote paste sanitization
      assert.equal(await p.locator('#aiKey').getAttribute('type'), 'password');
      await p.locator('#aiKeyToggle').click();
      assert.equal(await p.locator('#aiKey').getAttribute('type'), 'text');
      await p.locator('#aiKeyToggle').click();
      assert.equal(await p.locator('#aiKey').getAttribute('type'), 'password');

      await p.locator('#aiKey').fill('  "Bearer sk-ux-clean-42"  ');
      await p.locator('#aiSaveSettings').click();
      assert.equal(await p.locator('#aiKey').inputValue(), 'sk-ux-clean-42');
      assert.equal(await p.locator('#btnAutoFlow').getAttribute('data-ready'), 'true');

      // Connection test 200 OK with latency
      await p.locator('#aiTestSettings').click();
      await p.waitForFunction(() => document.getElementById('aiSettingsStatus')?.classList.contains('ok'));
      const okMsg = await p.locator('#aiSettingsStatus').textContent();
      assert.match(okMsg, /\d+\s*ms/);
      assert.equal(lastAuth, 'Bearer sk-ux-clean-42');

      // Connection test 401 targeted message
      testStatus = 401;
      await p.locator('#aiTestSettings').click();
      await p.waitForFunction(() => document.getElementById('aiSettingsStatus')?.classList.contains('error'));
      const errMsg = await p.locator('#aiSettingsStatus').textContent();
      assert.match(errMsg, /HTTP 401/);
      assert.deepEqual(errs, []);
    } finally { await ctx.close(); }
  });

  // 2. Smart >1600px API downsampling + full-res normalized coordinate mapping
  await check('smart >1600px API downsampling keeps local full-res and maps coordinates accurately', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const p = await ctx.newPage();
    try {
      await p.goto(base + '/index.html?lang=en');
      await p.waitForFunction(() => !!window.AIClient && !!window.GelAIBeta && !!window.MarkerAI);
      const res = await p.evaluate(() => {
        function pngDims(dataUrl) {
          const b64 = dataUrl.split(',')[1];
          const bin = atob(b64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const dv = new DataView(bytes.buffer);
          return { w: dv.getUint32(16), h: dv.getUint32(20) };
        }
        const rect = (x0, y0, x1, y1) => [
          { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }
        ];
        const big = { w: 2000, h: 1200, px: new Float32Array(2000 * 1200).fill(0.5) };
        const encBig = AIClient.encodeImage(big, { maxEdge: 1600 });
        const small = { w: 400, h: 300, px: new Float32Array(400 * 300).fill(0.5) };
        const encSmall = AIClient.encodeImage(small, { maxEdge: 1600 });

        const layoutVal = GelAIBeta.validate({
          schema_version: 1,
          image: { width: encBig.apiWidth, height: encBig.apiHeight },
          lane_count: 1,
          plane_quad: rect(0.1, 0.1, 0.9, 0.9),
          lanes: [{ quad: rect(0.2, 0.2, 0.3, 0.8), status: 'active' }]
        }, encBig);

        const dl2000 = Ladders.get('dl2000');
        const markerVal = MarkerAI.validate({
          schema_version: 1,
          gel_type: 'dna',
          image: { width: encBig.apiWidth, height: encBig.apiHeight },
          markers: [{
            x: 0.5,
            ladder_id: 'dl2000',
            candidates: [],
            bands: [{ y: 0.25, size: 2000 }, { y: 0.5, size: 1000 }]
          }]
        }, encBig, 'dna', [dl2000], { lanes: [{ x: 1000, hidden: false }], lanePitch: 100 });

        return {
          bigFull: { w: encBig.width, h: encBig.height, png: pngDims(encBig.url) },
          bigApi: { w: encBig.apiWidth, h: encBig.apiHeight, downsampled: encBig.downsampled, png: pngDims(encBig.apiUrl) },
          small: { w: encSmall.apiWidth, h: encSmall.apiHeight, downsampled: encSmall.downsampled, sameUrl: encSmall.url === encSmall.apiUrl },
          planeTRx: layoutVal.plane[1].x,
          markerX: markerVal.rows[0].x,
          band0Y: markerVal.rows[0].bands[0].y
        };
      });
      assert.deepEqual(res.bigFull, { w: 2000, h: 1200, png: { w: 2000, h: 1200 } });
      assert.deepEqual(res.bigApi, { w: 1600, h: 960, downsampled: true, png: { w: 1600, h: 960 } });
      assert.deepEqual(res.small, { w: 400, h: 300, downsampled: false, sameUrl: true });
      assert(Math.abs(res.planeTRx - 0.9 * 1999) < 0.2, `expected ~1799.1 got ${res.planeTRx}`);
      assert(Math.abs(res.markerX - 0.5 * 1999) < 0.2, `expected ~999.5 got ${res.markerX}`);
      assert(Math.abs(res.band0Y - 0.25 * 1199) < 0.2, `expected ~299.8 got ${res.band0Y}`);
    } finally { await ctx.close(); }
  });

  // 3. Auto Flow: unconfigured banner, cancel mid-request, partial result adoption, quick-pick ladder chip
  await check('Auto Flow unconfigured guidance, mid-request cancel, partial adoption, and quick ladder chips', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    let step = 'hold-layout';
    let releaseHold = null;
    let holdReady = null;
    await ctx.route('https://api.ux-autoflow.test/**', async route => {
      const body = route.request().postDataJSON();
      const meta = JSON.parse(body.messages[1].content[0].text);
      const isLayout = !meta.catalogue;
      if (isLayout && step === 'hold-layout') {
        if (holdReady) holdReady();
        await new Promise(r => { releaseHold = r; });
        await route.fulfill({ status: 500, headers: CORS, contentType: 'application/json', body: '{}' }).catch(() => {});
        return;
      }
      if (isLayout) {
        await route.fulfill({
          status: 200,
          headers: CORS,
          contentType: 'application/json',
          body: JSON.stringify({
            choices: [{
              finish_reason: 'stop',
              message: {
                content: JSON.stringify({
                  schema_version: 1,
                  image: { width: meta.image.width, height: meta.image.height },
                  lane_count: 3,
                  plane_quad: qRect(0.08, 0.08, 0.92, 0.92),
                  lanes: [
                    { quad: qRect(0.14, 0.14, 0.28, 0.86), status: 'active' },
                    { quad: qRect(0.43, 0.14, 0.57, 0.86), status: 'active' },
                    { quad: qRect(0.72, 0.14, 0.86, 0.86), status: 'active' }
                  ]
                })
              }
            }]
          })
        });
      } else {
        await route.fulfill({ status: 500, headers: CORS, contentType: 'application/json', body: '{"error":"marker fail"}' });
      }
    });
    try {
      await p.goto(base + '/index.html?lang=en');
      await p.waitForFunction(() => !!window.AutoFlow);
      assert(await p.locator('#btnAutoFlow').isVisible());
      assert.equal(await p.locator('#btnAutoFlow').getAttribute('data-ready'), 'false');

      // Open unconfigured Auto Flow -> inline setup banner shown
      await p.locator('#btnAutoFlow').click();
      assert(await p.locator('#autoFlowSetup').isVisible());
      await p.locator('#autoFlowOpenSettings').click();
      await p.locator('#aiEndpoint').fill('https://api.ux-autoflow.test/v1');
      await p.locator('#aiModel').fill('ux-vl');
      await p.locator('#aiKey').fill('sk-ux-flow');
      await p.locator('#aiSaveSettings').click();
      await p.locator('#aiSettingsClose').click();
      assert(!await p.locator('#autoFlowSetup').isVisible());

      // Select model + image -> layout request held -> click Cancel mid-request
      await p.locator('#autoFlowLadder').selectOption('dl2000');
      const png = await syntheticGelPng(p);
      const waitHold = new Promise(r => { holdReady = r; });
      await p.locator('#autoFlowFile').setInputFiles({ name: 'ux_gel.png', mimeType: 'image/png', buffer: png });
      await waitHold;
      assert(await p.locator('#autoFlowCancel').isVisible());
      await p.locator('#autoFlowCancel').click();
      if (releaseHold) { releaseHold(); releaseHold = null; }
      assert.equal(await p.locator('#autoFlowPage').getAttribute('data-phase'), 'error');
      assert.equal(await p.locator('#autoFlowLadder').inputValue(), 'dl2000');

      // Now run with Step-1 OK, Step-2 500 -> Open Partial Result
      step = 'fail-markers';
      await p.locator('#autoFlowRetry').click();
      await p.waitForFunction(() => !document.getElementById('autoFlowOpenPartial')?.classList.contains('hidden'));
      assert(await p.locator('#autoFlowOpenPartial').isVisible());
      await p.locator('#autoFlowOpenPartial').click();
      await p.waitForFunction(() => document.getElementById('autoFlowPage')?.classList.contains('hidden'));
      assert.equal(await p.evaluate(() => App.S.lanes.length), 3);
      assert(await p.locator('#toasts .toast-action').first().isVisible());

      // Re-open Auto Flow -> quick-pick chip for last-used dl2000 is available
      await p.locator('#btnAutoFlow').click();
      assert.equal(await p.locator('#autoFlowLadder').inputValue(), '');
      const chip = p.locator('#autoFlowQuickLadders button[data-quick-ladder="dl2000"]');
      assert(await chip.isVisible());
      await chip.click();
      assert.equal(await p.locator('#autoFlowLadder').inputValue(), 'dl2000');
      assert.deepEqual(errs, []);
    } finally {
      if (releaseHold) releaseHold();
      await ctx.close();
    }
  });

  // 4. Interactive #aiPreview-ai canvas dragging and Shift+click band addition
  await check('interactive AI Marker preview canvas supports band drag and Shift+click band add', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    await ctx.route('https://api.ux-marker.test/**', async route => {
      const body = route.request().postDataJSON();
      const meta = JSON.parse(body.messages[1].content[0].text);
      await route.fulfill({
        status: 200,
        headers: CORS,
        contentType: 'application/json',
        body: JSON.stringify({
          choices: [{
            finish_reason: 'stop',
            message: {
              content: JSON.stringify({
                schema_version: 1,
                gel_type: meta.selected_gel_type,
                image: { width: meta.image.width, height: meta.image.height },
                markers: [{
                  x: 0.12,
                  ladder_id: 'dl2000',
                  candidates: [],
                  bands: [
                    { y: 0.25, size: 2000 },
                    { y: 0.45, size: 1000 },
                    { y: 0.65, size: 500 }
                  ]
                }]
              })
            }
          }]
        })
      });
    });
    try {
      await p.goto(base + '/index.html?demo=1&lang=en');
      await p.waitForFunction(() => window.App?.S?.lanes?.length > 0);
      await p.locator('#btnSettings').click();
      await p.locator('#aiEndpoint').fill('https://api.ux-marker.test/v1');
      await p.locator('#aiModel').fill('ux-vl');
      await p.locator('#aiKey').fill('sk-ux-marker');
      await p.locator('#aiSaveSettings').click();
      await p.locator('#aiSettingsClose').click();

      await p.locator('#btnAIMarker').click();
      await p.locator('#aiMarkerModel').selectOption('dl2000');
      await p.locator('#aiRecognize').click();
      await p.waitForFunction(() => document.querySelectorAll('[data-method="ai"] [data-ai-band-y]').length === 6);

      const y0Before = Number(await p.locator('[data-method="ai"] [data-ai-band-y="0"]').inputValue());
      const preview = p.locator('#aiPreview-ai');
      await preview.scrollIntoViewIfNeeded();
      const box = await preview.boundingBox();
      assert(box && box.width > 50 && box.height > 50);

      // Band 0 is at normalized x=0.12, y=0.25
      const sx = box.x + box.width * 0.12;
      const sy = box.y + box.height * 0.25;
      await p.mouse.move(sx, sy);
      await p.mouse.down();
      await p.mouse.move(sx, sy + 20, { steps: 5 });
      await p.mouse.up();

      const y0After = Number(await p.locator('[data-method="ai"] [data-ai-band-y="0"]').inputValue());
      assert(y0After > y0Before + 5, `expected band 0 y to increase after downward drag (${y0Before} -> ${y0After})`);

      // Shift+click on the same lane at normalized y=0.80 adds a new band row (6 -> 7)
      await preview.click({ position: { x: box.width * 0.12, y: box.height * 0.80 }, modifiers: ['Shift'] });
      await p.waitForFunction(() => document.querySelectorAll('[data-method="ai"] [data-ai-band-y]').length === 7);
      assert.deepEqual(errs, []);
    } finally { await ctx.close(); }
  });

  // 5. One-click #layoutAutoCover + undo + actionable toast handoff to AI Marker
  await check('one-click layout auto-cover expands corners with undo and apply toast opens AI Marker', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    await ctx.route('https://api.ux-layout.test/**', async route => {
      const body = route.request().postDataJSON();
      const meta = JSON.parse(body.messages[1].content[0].text);
      await route.fulfill({
        status: 200,
        headers: CORS,
        contentType: 'application/json',
        body: JSON.stringify({
          choices: [{
            finish_reason: 'stop',
            message: {
              content: JSON.stringify({
                schema_version: 1,
                image: { width: meta.image.width, height: meta.image.height },
                lane_count: 3,
                // Plane intentionally tighter than retained lanes so #layoutAutoCover activates
                plane_quad: qRect(0.25, 0.25, 0.75, 0.75),
                lanes: [
                  { quad: qRect(0.12, 0.15, 0.22, 0.82), status: 'active' },
                  { quad: qRect(0.45, 0.15, 0.55, 0.82), status: 'active' },
                  { quad: qRect(0.78, 0.15, 0.88, 0.82), status: 'active' }
                ]
              })
            }
          }]
        })
      });
    });
    try {
      await p.goto(base + '/index.html?demo=1&lang=en');
      await p.waitForFunction(() => window.App?.S?.lanes?.length > 0);
      await p.locator('#btnSettings').click();
      await p.locator('#aiEndpoint').fill('https://api.ux-layout.test/v1');
      await p.locator('#aiModel').fill('ux-vl');
      await p.locator('#aiKey').fill('sk-ux-layout');
      await p.locator('#aiSaveSettings').click();
      await p.locator('#aiSettingsClose').click();

      await p.locator('#btnGelAIBeta').click();
      await p.locator('#layoutSend').click();
      await p.waitForFunction(() => !document.getElementById('layoutAutoCover')?.classList.contains('hidden'));
      assert(await p.locator('#layoutApply').isDisabled());

      // One-click expand corners
      await p.locator('#layoutAutoCover').click();
      assert(await p.locator('#layoutApply').isEnabled());
      assert(await p.locator('#layoutAutoCover').isHidden());
      assert(await p.locator('#layoutUndo').isEnabled());

      // Local undo restores tight corners
      await p.locator('#layoutUndo').click();
      assert(await p.locator('#layoutAutoCover').isVisible());
      assert(await p.locator('#layoutApply').isDisabled());

      // Expand again and apply -> actionable toast handoff opens AI Marker review
      await p.locator('#layoutAutoCover').click();
      await p.locator('#layoutApply').click();
      await p.locator('#layoutConfirmApply').click();
      await p.waitForFunction(() => !!document.querySelector('#toasts .toast-action'));
      const cta = p.locator('#toasts .toast-action').last();
      assert(await cta.isVisible());
      await cta.click();
      await p.waitForFunction(() => !document.getElementById('aiMarkerDlg')?.classList.contains('hidden'));
      assert.deepEqual(errs, []);
    } finally { await ctx.close(); }
  });

  // 6. Searchable ladder pickers, Copy PNG + fallback, Section 1 collapsible hierarchy
  await check('searchable ladder pickers, Copy PNG + fallback toast, and Section 1 collapsible hierarchy', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    try {
      await p.goto(base + '/index.html?demo=1&lang=en');
      await p.waitForFunction(() => window.App?.S?.lanes?.length > 0);

      // Section 1 default collapsed state + displayModeSeg visible on monochrome demo
      const sec1 = await p.evaluate(() => ({
        detOpen: document.getElementById('gelDetectionDetails').open,
        conOpen: document.getElementById('contrastManual').open,
        gamOpen: document.getElementById('gammaControls').open,
        rotOpen: document.getElementById('rotationFine').open,
        dispVisible: !document.getElementById('displayModeSeg').closest('.hidden')
      }));
      assert.deepEqual(sec1, { detOpen: false, conOpen: false, gamOpen: false, rotOpen: false, dispVisible: true });

      // Closing #rotationFine auto-hides the alignment grid
      await p.evaluate(() => { document.getElementById('rotationFine').open = true; });
      await p.locator('#showGrid').check();
      assert.equal(await p.locator('#showGrid').isChecked(), true);
      await p.evaluate(() => {
        const d = document.getElementById('rotationFine');
        d.open = false;
        d.dispatchEvent(new Event('toggle'));
      });
      assert.equal(await p.locator('#showGrid').isChecked(), false);

      // Switch to Grayscale mode so #grayAdjustments is shown, then opening #contrastManual draws histogram pixels
      await p.locator('#displayModeSeg [data-display="gray"]').click();
      await p.locator('#contrastManual > summary').click();
      await p.waitForFunction(() => {
        const cv = document.getElementById('histo');
        if (!cv || !cv.width || !cv.height) return false;
        const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
        let nonZero = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 0) nonZero++;
        return nonZero > 100;
      });

      // Searchable #favSearch filters #favList
      await p.evaluate(() => { document.getElementById('favAdv').open = true; });
      const favTotal = await p.locator('#favList label').count();
      assert(favTotal > 3, `expected >3 favourite options, got ${favTotal}`);
      await p.locator('#favSearch').fill('DL2000');
      const favFiltered = await p.locator('#favList label').count();
      assert(favFiltered >= 1 && favFiltered < favTotal, `expected filtered favs between 1 and ${favTotal}, got ${favFiltered}`);
      await p.locator('#favSearch').fill('');
      assert.equal(await p.locator('#favList label').count(), favTotal);

      // Searchable ladder picker on marker card
      const cardSearch = p.locator('#markerList input.ladder-search').first();
      assert(await cardSearch.isVisible());
      const cardSelect = p.locator('#markerList input.ladder-search + select').first();
      const allOpts = await cardSelect.locator('option').count();
      await cardSearch.fill('DL2000');
      const filteredOpts = await cardSelect.locator('option').count();
      assert(filteredOpts >= 1 && filteredOpts < allOpts, `expected filtered opts between 1 and ${allOpts}, got ${filteredOpts}`);
      await cardSearch.fill('');
      assert.equal(await cardSelect.locator('option').count(), allOpts);

      // Copy PNG with mocked Clipboard API -> valid PNG blob
      await p.evaluate(() => {
        App.setPref('preflight', false);
        window.__copiedPng = null;
        window.__failClipboard = false;
        window.ClipboardItem = class ClipboardItem {
          constructor(items) { this.items = items; }
        };
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: {
            write: async items => {
              if (window.__failClipboard) throw new Error('blocked');
              const blob = items[0].items['image/png'];
              const buf = new Uint8Array(await blob.arrayBuffer());
              window.__copiedPng = { type: blob.type, size: buf.length, sig: Array.from(buf.slice(0, 4)) };
            }
          }
        });
      });
      await p.locator('#btnFigCopyPNG').click();
      await p.waitForFunction(() => !!window.__copiedPng);
      const copied = await p.evaluate(() => window.__copiedPng);
      assert.equal(copied.type, 'image/png');
      assert(copied.size > 1000);
      assert.deepEqual(copied.sig, [137, 80, 78, 71]);

      // Clipboard rejection via export menu #btnCopyPNG -> fallback download CTA toast appears
      await p.evaluate(() => {
        const thanks = document.getElementById('exportThanks');
        if (thanks) thanks.classList.add('hidden');
        window.__failClipboard = true;
      });
      await p.locator('#btnExportMenu').click();
      await p.locator('#btnCopyPNG').click();
      await p.waitForFunction(() => !!document.querySelector('#toasts .toast-action'));
      assert(await p.locator('#toasts .toast-action').last().isVisible());

      // v1.1.1 checks: Export Readiness badge, AI Marker back button, non-overlapping lane toolbar
      assert(await p.locator('#exportReadiness').isVisible());
      await p.locator('#exportReadiness').click();
      await p.waitForSelector('#preflightDlg:not(.hidden)');
      assert(await p.locator('#pfList .pf-item').count() >= 1);
      await p.locator('#pfBack').click();
      await p.waitForFunction(() => document.getElementById('preflightDlg')?.classList.contains('hidden'));

      await p.locator('#btnAIMarker').click();
      await p.waitForSelector('#aiClose');
      assert.match(await p.locator('#aiClose').textContent(), /Back to editor|返回编辑器/);
      await p.locator('#aiClose').click();

      const laneIdx = await p.evaluate(() => UI.figLanes()[1]);
      await p.evaluate(i => FigEdit.openEd('lane', i), laneIdx);
      await p.waitForSelector('#fedBar');
      const overlap = await p.evaluate(() => {
        const bar = document.getElementById('fedBar')?.getBoundingClientRect();
        const ed = document.getElementById('floatEd')?.getBoundingClientRect();
        if (!bar || !ed) return true;
        return !(bar.right <= ed.left || bar.left >= ed.right || bar.bottom <= ed.top || bar.top >= ed.bottom);
      });
      assert.equal(overlap, false, 'floating format bar must not overlap active lane input');
      await p.keyboard.press('Escape');

      assert.deepEqual(errs, []);
    } finally { await ctx.close(); }
  });

  return results;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const url = pathToFileURL(path.join(root, 'dist')).href;
  console.log('Run via tests/run.mjs (requires local HTTP server).', url);
}
