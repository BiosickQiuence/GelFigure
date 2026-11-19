import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium, devices } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8'
};

export async function v14LayoutMobileChecks(browser, base, root = ROOT, engine = 'chromium') {
  const results = [];
  const check = async (name, fn) => {
    try { await fn(); results.push(['ok', 'v1.4: ' + name]); }
    catch (err) { results.push(['FAIL', 'v1.4: ' + name, err.stack || err.message]); }
  };
  const shotDir = path.join(root, 'test-results', 'v1.4');
  fs.mkdirSync(shotDir, { recursive: true });

  await check('W3 Figure-First Main View + Switcher & W4 4-Step Accordion + Advanced drawer', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 860 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));

    try {
      await page.goto(`${base}/index.html?demo=1&lang=zh`);
      await page.waitForFunction(() => document.title.startsWith('READY ') && !!window.StageView && !!window.StepAccordion, null, { timeout: 60000 });
      await page.evaluate(() => { try { localStorage.setItem('gelfigure.tour.done.v1', '1'); } catch (e) {} });

      // Default view is Figure-First (W3) and Step 3 expanded (W4)
      assert.equal(await page.evaluate(() => window.StageView.mode), 'fig', 'Default stage mode must be fig');
      assert.equal(await page.locator('#figCol').isVisible(), true, 'Figure pane must be visible by default');
      assert.equal(await page.locator('#rawCol').isVisible(), false, 'Raw pane must be hidden in figure-first mode');
      assert.equal(await page.locator('#stepAccordion .step-card').count(), 4, 'Accordion must have 4 steps');
      assert.equal(await page.locator('#stepAccordion .step-card.open').count(), 1, 'Exactly 1 step expanded at a time');
      assert.equal(await page.evaluate(() => window.StepAccordion.active), 3, 'Step 3 expanded by default');
      assert.ok((await page.textContent('#stageDimPill')).includes('dpi'), 'Stage header must show mm & effective DPI');

      // Test zoom controls in Stage Switcher
      const z0 = await page.evaluate(() => window.UI.figZoom());
      await page.click('#stageZoomIn');
      assert.ok(await page.evaluate(() => window.UI.figZoom()) > z0, 'Zoom in must increase figure zoom');
      await page.click('#stageZoomFit');
      assert.equal(await page.evaluate(() => window.UI.figZoom()), 1, 'Fit button must reset zoom to 1');

      // Type in Step 3 inline lane-name input & verify sync with App.S
      const laneInput = page.locator('#step3LaneList .step3-lane-input').nth(1);
      await laneInput.fill('WT-v14');
      await laneInput.dispatchEvent('change');
      assert.equal(await page.evaluate(() => window.App.S.lanes[window.UI.figLanes()[1]].name), 'WT-v14');

      if (engine === 'chromium') await page.screenshot({ path: path.join(shotDir, 'desktop-editor-fig.png') });

      // W3 auto-switch: entering Step 1 switches to Raw image
      await page.click('[data-step-toggle="1"]');
      assert.equal(await page.evaluate(() => window.StageView.mode), 'raw', 'Step 1 must auto-switch to raw view');
      assert.equal(await page.locator('#rawCol').isVisible(), true, 'Raw canvas must become visible');
      assert.equal(await page.locator('#figCol').isVisible(), false, 'Figure canvas must hide in raw view');
      if (engine === 'chromium') await page.screenshot({ path: path.join(shotDir, 'desktop-editor-raw.png') });

      // Leaving Step 1 to Step 4 switches back to Figure
      await page.click('[data-step-toggle="4"]');
      assert.equal(await page.evaluate(() => window.StageView.mode), 'fig', 'Step 4 must switch back to figure view');
      assert.equal(await page.locator('#figCol').isVisible(), true);
      assert.ok(await page.locator('#advancedStep').isVisible(), 'Collapsible Advanced section must exist');

      assert.equal(errs.length, 0, 'Page errors: ' + errs.join(' | '));
    } finally {
      await ctx.close();
    }
  });

  await check('W5 Unified AI Assistant + Searchable Marker Combobox + Local detection rename', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));

    try {
      await page.goto(`${base}/index.html?demo=1&lang=zh`);
      await page.waitForFunction(() => document.title.startsWith('READY ') && !!window.AIAssistant, null, { timeout: 60000 });

      await page.click('#btnAutoFlowTop');
      await page.waitForSelector('#aiAssistantModal:not(.hidden)');
      await page.fill('#aiUnifiedLadderSearch', 'DL2000');
      const items = await page.locator('#aiUnifiedLadderList .ai-hub-combo-item').count();
      assert.ok(items >= 1, 'Searchable combobox must filter ladders');
      if (engine === 'chromium') await page.screenshot({ path: path.join(shotDir, 'ai-assistant.png') });

      // Open Marker AI from Unified Assistant and verify renamed "本地识别（离线" label
      await page.click('#aiHubMarker');
      await page.waitForSelector('#aiMarkerDlg:not(.hidden)');
      const bodyText = await page.textContent('#aiMarkerDlg');
      assert.ok(bodyText.includes('本地识别（离线'), 'Marker review must use renamed 本地识别（离线） label');
      assert.ok(!bodyText.includes('原代码本地算法'), 'Old 原代码本地算法 label must be removed');

      assert.equal(errs.length, 0, 'Page errors: ' + errs.join(' | '));
    } finally {
      await ctx.close();
    }
  });

  await check('4.6 Mobile Lite: 4-tab nav, top review summary bar + sheet, desktop hint & Names editor', async () => {
    const dev = { ...devices['iPhone 13'] };
    if (engine === 'firefox') delete dev.isMobile;
    const ctx = await browser.newContext({ ...dev, locale: 'zh-CN' });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));

    try {
      await page.goto(`${base}/index.html?demo=1&lang=zh`);
      await page.waitForFunction(() => document.title.startsWith('READY ') && !!window.MobileLite, null, { timeout: 60000 });
      await page.evaluate(() => { try { localStorage.setItem('gelfigure.tour.done.v1', '1'); } catch (e) {} });

      assert.equal(await page.locator('#mobileReviewBar').isVisible(), true, 'Top mobile review bar must be visible');
      assert.equal(await page.locator('#mobileDesktopHint').isVisible(), true, 'Desktop hint must be visible on phone figure view');
      assert.equal(await page.locator('#mNav > button').count(), 4, 'Mobile nav must have 4 tabs');
      if (engine === 'chromium') await page.screenshot({ path: path.join(shotDir, 'mobile-lite.png') });

      // Open review sheet from top bar
      await page.click('#btnMobileReviewOpen');
      assert.equal(await page.locator('#mobileReviewSheet').isVisible(), true, 'Mobile review sheet must open');
      await page.click('#mobileReviewSheet [data-close]');

      // Switch to Names tab and edit lane name
      await page.click('#mNav [data-view="names"]');
      assert.equal(await page.locator('#mobileNamesView').isVisible(), true, 'Names tab must open lane-name editor');
      await page.locator('#mobileNamesView .m-names-input').nth(1).fill('KO-Phone');
      await page.locator('#mobileNamesView .m-names-input').nth(1).dispatchEvent('change');
      assert.equal(await page.evaluate(() => window.App.S.lanes[window.UI.figLanes()[1]].name), 'KO-Phone');

      assert.equal(errs.length, 0, 'Page errors: ' + errs.join(' | '));
    } finally {
      await ctx.close();
    }
  });

  await check('Single-file dist/GelFigure.html supports v1.4 W3/W4 layout over file://', async () => {
    const distPath = path.join(root, 'dist', 'GelFigure.html');
    assert.ok(fs.existsSync(distPath), 'dist/GelFigure.html must exist');
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    try {
      await page.goto(pathToFileURL(distPath).href + '?demo=1&lang=zh');
      await page.waitForFunction(() => document.title.startsWith('READY ') && !!window.StageView && !!window.StepAccordion, null, { timeout: 60000 });
      assert.equal(await page.evaluate(() => window.StageView.mode), 'fig');
      assert.equal(await page.locator('#stepAccordion .step-card').count(), 4);
      assert.equal(errs.length, 0, 'Single-file page errors: ' + errs.join(' | '));
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
    const res = await v14LayoutMobileChecks(browser, base, ROOT, 'chromium');
    res.forEach(([s, what, detail]) => console.log(`  ${s === 'ok' ? '✓' : '✗'} ${what}${detail ? `\n      ${detail}` : ''}`));
    process.exitCode = res.some(r => r[0] !== 'ok') ? 1 : 0;
  } finally {
    await browser.close();
    server.close();
  }
}
