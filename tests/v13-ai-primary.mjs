import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CORS = { 'Access-Control-Allow-Origin': '*' };
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8'
};

const rect = (l, t, r, b) => [{ x: l, y: t }, { x: r, y: t }, { x: r, y: b }, { x: l, y: b }];

function mockLayoutJSON(image) {
  return JSON.stringify({
    schema_version: 1,
    image,
    plane_quad: [{ x: 0.04, y: 0.06 }, { x: 0.97, y: 0.04 }, { x: 0.95, y: 0.94 }, { x: 0.06, y: 0.96 }],
    lane_count: 4,
    lanes: [['active', 0.20], ['active', 0.42], ['uncertain', 0.64], ['active', 0.84]]
      .map(([status, x]) => ({ status, quad: rect(x - 0.04, 0.20, x + 0.04, 0.80) }))
  });
}

function mockMarkerJSON(image, meta) {
  const ladder = meta.catalogue[0];
  return JSON.stringify({
    schema_version: 1,
    image,
    gel_type: meta.selected_gel_type,
    markers: [{
      x: 0.20,
      ladder_id: ladder.id,
      candidates: [],
      bands: [0.22, 0.36, 0.50, 0.64, 0.78].map(y => ({ y, size: null }))
    }]
  });
}

export async function v13AiPrimaryChecks(browser, base, root = ROOT, engine = 'chromium') {
  const results = [];
  const check = async (name, fn) => {
    try { await fn(); results.push(['ok', 'v1.3: ' + name]); }
    catch (err) { results.push(['FAIL', 'v1.3: ' + name, err.stack || err.message]); }
  };
  const shotDir = path.join(root, 'test-results', 'v1.3');
  fs.mkdirSync(shotDir, { recursive: true });

  await check('W2 Welcome Page + A2 Offline AI Demo + A6 Review Checklist (zero network)', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 860 } });
    const page = await ctx.newPage();
    const errs = [];
    const extRequests = [];
    page.on('pageerror', e => errs.push(String(e)));
    page.on('request', r => { if (/^https:\/\//.test(r.url())) extRequests.push(r.url()); });

    try {
      await page.goto(`${base}/index.html?lang=zh`);
      await page.waitForFunction(() => !!document.getElementById('welcomeDrop') && !!window.WelcomeAI);
      await page.evaluate(() => { try { localStorage.setItem('gelfigure.tour.done.v1', '1'); } catch (e) {} });

      assert.equal(await page.locator('#welcomeView').isVisible(), true, 'Welcome page should be visible before image load');
      assert.equal(await page.locator('.welcome-card').count(), 3, 'Welcome page should show 3 action cards');
      if (engine === 'chromium') await page.screenshot({ path: path.join(shotDir, 'welcome.png') });

      // Run A2 Offline AI Demo
      await page.click('#btnDemo');
      await page.waitForFunction(() => window.App?.S?.lanes?.length === 11 && document.querySelectorAll('#reviewPanel .review-item').length >= 3, null, { timeout: 30000 });
      assert.equal(await page.locator('#reviewPanel').isVisible(), true, 'Right review checklist should be visible');
      assert.ok(await page.locator('#demoAIBanner').isVisible(), 'Demo completion CTA banner should be visible');
      assert.equal(extRequests.length, 0, 'Offline AI demo must make zero HTTPS requests');
      if (engine === 'chromium') await page.screenshot({ path: path.join(shotDir, 'editor-checklist.png') });

      // Confirm a checklist item & verify pending count decreases
      const beforePending = await page.evaluate(() => window.ReviewChecklist.pendingCount);
      assert.ok(beforePending >= 1, 'Demo checklist should have pending items');
      await page.locator('#reviewPanel .review-item:not(.confirmed) button').first().click();
      const afterPending = await page.evaluate(() => window.ReviewChecklist.pendingCount);
      assert.ok(afterPending < beforePending, 'Confirming item should reduce pending count');

      assert.equal(errs.length, 0, 'Page errors: ' + errs.join(' | '));
    } finally {
      await ctx.close();
    }
  });

  await check('A1 4-Step API Wizard, A3 Privacy Consent, W6 Settings Center 5 tabs', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));

    await ctx.route('https://dashscope.aliyuncs.com/**', async route => {
      await route.fulfill({
        status: 200,
        headers: CORS,
        contentType: 'application/json',
        body: JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '{"ok":true}' } }] })
      });
    });

    try {
      await page.goto(`${base}/index.html?lang=zh`);
      await page.waitForFunction(() => !!document.getElementById('btnWelcomeAIStatus'));
      await page.evaluate(() => { try { localStorage.setItem('gelfigure.tour.done.v1', '1'); } catch (e) {} });

      // Open A1 Wizard from Welcome status pill
      await page.click('#btnWelcomeAIStatus');
      await page.waitForFunction(() => document.getElementById('aiWizardDlg') && !document.getElementById('aiWizardDlg').classList.contains('hidden'));
      await page.click('#wizNext'); // Step 1 -> Step 2
      await page.click('#wizNext'); // Step 2 -> Step 3
      await page.fill('#wizKey', '  "Bearer sk-wizard-test-12345"  ');
      await page.click('#wizTestBtn');
      await page.waitForFunction(() => !!document.querySelector('.wizard-test-ok'));
      if (engine === 'chromium') await page.screenshot({ path: path.join(shotDir, 'wizard-step3.png') });

      await page.click('#wizNext'); // Step 3 -> Step 4 (Privacy consent)
      await page.click('#wizConfirm'); // Consent & enable
      await page.waitForFunction(() => document.getElementById('aiWizardDlg').classList.contains('hidden'));

      const consent = await page.evaluate(() => window.AIConsent.info);
      assert.equal(consent?.host, 'dashscope.aliyuncs.com', 'Consent should record destination host');
      assert.ok(consent?.acceptedAt, 'Consent should record timestamp');

      // Verify W6 Settings Center 5 tabs
      await page.click('#btnSettings');
      await page.waitForFunction(() => !document.getElementById('aiSettingsPanel').classList.contains('hidden'));
      const tabCount = await page.locator('#aiSettingsPanel .settings-tab').count();
      assert.equal(tabCount, 5, 'Settings Center should have 5 tabs');
      for (const tab of ['marker', 'layout', 'lang', 'data', 'ai']) {
        await page.click(`#aiSettingsPanel [data-stab="${tab}"]`);
        assert.equal(await page.locator(`#aiSettingsPanel [data-spane="${tab}"]`).isVisible(), true);
      }

      // Revoke consent in Settings Center -> welcome pill reflects unconsented state
      await page.click('#btnToggleAIConsent');
      assert.equal(await page.evaluate(() => window.AIConsent.info), null, 'Consent should be revocable');

      assert.equal(errs.length, 0, 'Page errors: ' + errs.join(' | '));
    } finally {
      await ctx.close();
    }
  });

  await check('A4 Drop-to-Start AI, A5 Progress, A7 Cache hit (0 calls), A8 1x retry on 429, A9 Error card (no retry on 401)', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));

    let mode = 'retry429'; // 'retry429' | 'err401'
    let callCount = 0;
    let first429Sent = false;
    const ladId = 'dl2000';

    await ctx.route('https://dashscope.aliyuncs.com/**', async route => {
      callCount++;
      if (mode === 'err401') {
        await route.fulfill({ status: 401, headers: CORS, contentType: 'application/json', body: '{"error":"unauthorized"}' });
        return;
      }
      const reqBody = JSON.parse(route.request().postData() || '{}');
      const meta = JSON.parse(reqBody.messages?.[1]?.content?.[0]?.text || '{}');
      const image = { width: meta.image?.width || 240, height: meta.image?.height || 160 };
      if (mode === 'retry429' && !first429Sent) {
        first429Sent = true;
        await route.fulfill({ status: 429, headers: CORS, contentType: 'application/json', body: '{"error":"rate_limit"}' });
        return;
      }
      const isLayout = !meta.catalogue;
      const content = isLayout ? mockLayoutJSON(image) : mockMarkerJSON(image, meta);
      await route.fulfill({
        status: 200,
        headers: CORS,
        contentType: 'application/json',
        body: JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content } }] })
      });
    });

    try {
      await page.goto(`${base}/index.html?lang=zh`);
      await page.waitForFunction(() => !!window.WelcomeAI && !!window.Ladders);
      await page.evaluate(async id => {
        try { localStorage.setItem('gelfigure.tour.done.v1', '1'); } catch (e) {}
        await window.AICache.clear();
        document.getElementById('aiEndpoint').value = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
        document.getElementById('aiModel').value = 'qwen3-vl-plus';
        document.getElementById('aiKey').value = 'sk-mock-valid-key';
        window.AIClient.saveSettings();
        window.AIConsent.grant('https://dashscope.aliyuncs.com/compatible-mode/v1');
        window.WelcomeAI.setDefaultLadderId(id);
      }, ladId);

      // Build a synthetic PNG file & trigger drop-to-start AI (A4)
      await page.evaluate(async () => {
        const c = document.createElement('canvas');
        c.width = 240; c.height = 160;
        const g = c.getContext('2d');
        g.fillStyle = '#0e1319'; g.fillRect(0, 0, 240, 160);
        g.fillStyle = '#e5eef8';
        for (const x of [48, 100, 154, 202]) {
          for (const y of [34, 58, 82, 106, 128]) g.fillRect(x - 9, y - 2, 18, 4);
        }
        const blob = await new Promise(r => c.toBlob(r, 'image/png'));
        window.__testFile = new File([blob], 'gel_auto_test.png', { type: 'image/png' });
        window.UI.load([window.__testFile]);
      });

      // Wait for AI flow to finish (after 429 -> 1x retry -> 200 layout -> 200 markers)
      await page.waitForFunction(() => window.App?.S?.file?.name === 'gel_auto_test.png' && !document.getElementById('aiProgressOverlay'), null, { timeout: 25000 });
      assert.equal(callCount, 3, 'Expected 3 calls: 429 + 1x retry layout + marker call');

      // Re-run with exact same image -> A7 IndexedDB cache hit (0 additional network calls!)
      const beforeCacheCalls = callCount;
      await page.evaluate(() => {
        window.WelcomeAI.runPrimaryAI(window.__testFile, 'dl2000');
      });
      await page.waitForFunction(() => document.getElementById('btnReviewRerunAI') !== null, null, { timeout: 15000 });
      assert.equal(callCount, beforeCacheCalls, 'A7 cache hit must make 0 additional API calls');

      // Now force refresh with HTTP 401 -> A8 must NOT retry 401 (exact +1 call), A9 renders structured error card
      mode = 'err401';
      const before401Calls = callCount;
      await page.click('#btnReviewRerunAI');
      await page.waitForFunction(() => !!document.querySelector('.ai-error-card[data-error-code="HTTP_401"]'), null, { timeout: 15000 });
      assert.equal(callCount, before401Calls + 1, 'HTTP 401 config error must NOT be retried');
      assert.ok(await page.locator('.ai-error-card [data-repair-action="use-local"]').isVisible(), 'A9 error card must offer local fallback action');

      // Click "Use local (offline)" on error card -> cleanly loads local editor
      await page.click('.ai-error-card [data-repair-action="use-local"]');
      await page.waitForFunction(() => !document.getElementById('aiProgressOverlay') && window.App?.S?.lanes?.length > 0, null, { timeout: 15000 });

      assert.equal(errs.length, 0, 'Page errors: ' + errs.join(' | '));
    } finally {
      await ctx.close();
    }
  });

  await check('Single-file dist/GelFigure.html supports W2 Welcome Page & A2 Offline AI Demo over file://', async () => {
    const distPath = path.join(root, 'dist', 'GelFigure.html');
    assert.ok(fs.existsSync(distPath), 'dist/GelFigure.html must exist');
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    try {
      await page.goto(pathToFileURL(distPath).href);
      await page.waitForFunction(() => !!window.WelcomeAI && !!window.AIWizard && !!window.ReviewChecklist && !!window.AICache);
      assert.equal(await page.locator('#welcomeView').isVisible(), true);
      await page.click('#btnDemo');
      await page.waitForFunction(() => window.App?.S?.lanes?.length === 11 && document.querySelectorAll('#reviewPanel .review-item').length >= 3, null, { timeout: 30000 });
      assert.equal(errs.length, 0, 'file:// errors: ' + errs.join(' | '));
    } finally {
      await ctx.close();
    }
  });

  return results;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(ROOT, rel === '/' ? 'index.html' : rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  try {
    const res = await v13AiPrimaryChecks(browser, base, ROOT, 'chromium');
    for (const [s, what, detail] of res) console.log(`  ${s === 'ok' ? '✓' : '✗'} ${what}${detail ? '\n      ' + detail : ''}`);
    if (res.some(r => r[0] !== 'ok')) process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
  }
}
