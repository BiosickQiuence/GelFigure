import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

export async function v16DensitometryPwaChecks(browser, base, root = ROOT, engine = 'chromium') {
  const results = [];
  const check = async (name, fn) => {
    try { await fn(); results.push(['ok', 'v1.6: ' + name]); }
    catch (err) { results.push(['FAIL', 'v1.6: ' + name, err.stack || err.message]); }
  };
  const shotDir = path.join(root, 'test-results', 'v1.6');
  fs.mkdirSync(shotDir, { recursive: true });

  await check('Densitometry is off by default and reads strictly unclipped linear pixels (display-stretch invariant)', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 860 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    try {
      await page.goto(`${base}/index.html?demo=1&lang=zh`);
      await page.waitForFunction(() => document.title.startsWith('READY ') && !!window.DensitometryV16, null, { timeout: 60000 });
      await page.evaluate(() => { try { localStorage.setItem('gelfigure.tour.done.v1', '1'); } catch (e) {} });

      // Open Advanced drawer if collapsed
      const advOpen = await page.evaluate(() => !!document.getElementById('advancedStep')?.open);
      if (!advOpen) await page.click('#advancedStep > summary');

      const initState = await page.evaluate(() => ({
        enabled: window.DensitometryV16.enabled,
        checked: !!document.getElementById('densEnableToggle')?.checked,
        logDens: window.Export.processingLog(window.App.S).densitometry
      }));
      assert.equal(initState.enabled, false, 'Densitometry must be disabled by default');
      assert.equal(initState.checked, false, 'Toggle must be unchecked by default');
      assert.equal(initState.logDens, undefined, 'Disabled densitometry must not enter processing log');

      await page.click('#densEnableToggle');
      await page.waitForSelector('#densTable tbody tr');

      const r1 = await page.evaluate(() => {
        const res = window.DensitometryV16.compute();
        return {
          bg: res.backgroundMethod,
          rows: res.rows.map(r => ({
            laneIndex: r.laneIndex,
            peakRaw: r.peakRaw,
            saturated: r.saturated,
            netIntegrated: r.netIntegrated,
            relative: r.relative
          }))
        };
      });
      assert.equal(r1.bg, 'rolling_ball');
      assert.ok(r1.rows.length >= 6);
      assert.ok(r1.rows.some(r => r.saturated), 'Built-in demo gel has a saturating band that must be blocked');

      // Drastically alter display contrast, gamma, and inversion
      const r2 = await page.evaluate(() => {
        const S = window.App.S;
        S.levels.black = 0.22;
        S.levels.white = 0.68;
        S.levels.gamma = 2.4;
        S.levels.invert = !S.levels.invert;
        window.App.commit();
        const res = window.DensitometryV16.compute();
        return res.rows.map(r => ({
          laneIndex: r.laneIndex,
          peakRaw: r.peakRaw,
          saturated: r.saturated,
          netIntegrated: r.netIntegrated,
          relative: r.relative
        }));
      });
      assert.deepEqual(r2, r1.rows, 'Display contrast/gamma/inversion must NEVER affect linear densitometry values');

      // Switch background subtraction methods
      await page.selectOption('#densBgMethod', 'lane_edge');
      const bgEdge = await page.evaluate(() => {
        const res = window.DensitometryV16.compute();
        const ref = res.rows.find(r => r.relative === 1);
        return { method: res.backgroundMethod, hasRef: !!ref };
      });
      assert.equal(bgEdge.method, 'lane_edge');
      assert.equal(bgEdge.hasRef, true);

      await page.selectOption('#densBgMethod', 'none');
      const bgNone = await page.evaluate(() => window.DensitometryV16.compute().backgroundMethod);
      assert.equal(bgNone, 'none');

      assert.equal(errs.length, 0, 'Page errors: ' + errs.join(' | '));
    } finally {
      await ctx.close();
    }
  });

  await check('Linear 1:2 ratio accuracy, strict overexposed band blocking, CSV export & processing log', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 860 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    try {
      await page.goto(`${base}/index.html?demo=1&lang=zh`);
      await page.waitForFunction(() => document.title.startsWith('READY ') && !!window.DensitometryV16 && !!window.Demo, null, { timeout: 60000 });
      await page.evaluate(() => { try { localStorage.setItem('gelfigure.tour.done.v1', '1'); } catch (e) {} });

      // Synthesize a deterministic 16-bit dark-bg gel with 4 lanes: M, 1x (net 0.25), 2x (net 0.50), Overexp (clipped 1.0)
      await page.evaluate(async () => {
        const w = 640, h = 440;
        const data = new Float32Array(w * h);
        const bg = 0.05;
        data.fill(bg);
        const laneXs = [140, 260, 380, 500];
        const laneW = 44;
        const drawBand = (cx, cy, amp, sigma) => {
          const hw = laneW / 2;
          for (let y = Math.max(0, Math.floor(cy - sigma * 4)); y < Math.min(h, Math.ceil(cy + sigma * 4)); y++) {
            for (let x = Math.max(0, Math.floor(cx - hw)); x <= Math.min(w - 1, Math.ceil(cx + hw)); x++) {
              const dy = y - cy;
              const v = data[y * w + x] + amp * Math.exp(-(dy * dy) / (2 * sigma * sigma));
              data[y * w + x] = Math.min(1, v);
            }
          }
        };
        // Marker lane (moderate bands)
        [110, 180, 250, 330].forEach(y => drawBand(laneXs[0], y, 0.35, 5));
        // 1x linear target band
        drawBand(laneXs[1], 220, 0.25, 6);
        // 2x linear target band (exact 2.0x signal above flat background)
        drawBand(laneXs[2], 220, 0.50, 6);
        // Overexposed / saturated band (clipped to 1.0)
        drawBand(laneXs[3], 220, 1.35, 6);

        const buf = window.Demo.encodeTiff16({ width: w, height: h, data });
        await window.App.load({ name: 'linear_ratio_test.tif', buffer: buf });
        const S = window.App.S;
        S.angle = 0;
        S.crop = { x: 40, y: 20, w: 560, h: 400 };
        S.lanes = [
          { x: laneXs[0], name: 'M', hidden: false },
          { x: laneXs[1], name: 'Ctrl 1x', hidden: false },
          { x: laneXs[2], name: 'Treat 2x', hidden: false },
          { x: laneXs[3], name: 'Overexp', hidden: false }
        ];
        S.markers = [{ lane: 0, ladderId: 'gr1kbplus', bands: [] }];
        window.App.commit();
      });

      const advOpen = await page.evaluate(() => !!document.getElementById('advancedStep')?.open);
      if (!advOpen) await page.click('#advancedStep > summary');

      await page.evaluate(() => {
        window.DensitometryV16.setEnabled(true);
        window.DensitometryV16.setBackground('rolling_ball');
        window.DensitometryV16.setReferenceLane(1); // Ctrl 1x
      });
      await page.waitForSelector('#densSatAlert');

      if (engine === 'chromium') {
        await page.locator('#densCard').scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(shotDir, 'densitometry-saturated.png') });
      }

      const checkData = await page.evaluate(() => {
        const res = window.DensitometryV16.compute();
        const csv = window.DensitometryV16.buildCsv();
        const log = window.Export.processingLog(window.App.S);
        const legZh = window.LegendCopy?.buildLegend?.(window.App.S, 'zh') || '';
        const legEn = window.LegendCopy?.buildLegend?.(window.App.S, 'en') || '';
        const satRowClass = document.querySelector('tr.dens-row[data-dens-lane="3"]')?.classList.contains('saturated');
        const satOptDisabled = document.querySelector('#densRefLane option[value="3"]')?.disabled;
        return { res, csv, logDens: log.densitometry, legZh, legEn, satRowClass, satOptDisabled };
      });

      const row1x = checkData.res.rows.find(r => r.laneIndex === 1);
      const row2x = checkData.res.rows.find(r => r.laneIndex === 2);
      const rowSat = checkData.res.rows.find(r => r.laneIndex === 3);

      assert.equal(row1x.saturated, false);
      assert.equal(row1x.relative, 1);
      assert.equal(row2x.saturated, false);
      assert.ok(row2x.relative >= 1.9 && row2x.relative <= 2.1, `Expected ~2.0 relative intensity, got ${row2x.relative}`);

      assert.equal(rowSat.saturated, true, 'Overexposed lane must be detected as saturated');
      assert.equal(rowSat.status, 'BLOCKED_SATURATED');
      assert.equal(rowSat.netIntegrated, null, 'Saturated lane must return null netIntegrated');
      assert.equal(rowSat.relative, null, 'Saturated lane must return null relative');
      assert.equal(checkData.satRowClass, true, 'Saturated table row must carry .saturated red class');
      assert.equal(checkData.satOptDisabled, true, 'Saturated lane must be disabled in reference selector');

      assert.ok(checkData.csv.startsWith('\uFEFF'), 'CSV must carry UTF-8 BOM for Excel');
      assert.ok(checkData.csv.includes('# Disclaimer,'), 'CSV must include linear-range disclaimer');
      assert.ok(checkData.csv.includes('BLOCKED_SATURATED,BLOCKED,BLOCKED,BLOCKED'), 'CSV must mark saturated lane BLOCKED');
      assert.ok(checkData.csv.includes(',1.000'), 'CSV must include reference lane 1.000');

      assert.ok(checkData.logDens, 'Processing log must include densitometry record');
      assert.equal(checkData.logDens.saturatedBlockedCount, 1);
      assert.equal(checkData.logDens.rows.length, 4);
      assert.ok(/线性|未拉伸/.test(checkData.legZh), 'ZH legend must mention linear densitometry');
      assert.ok(/densitometry/i.test(checkData.legEn), 'EN legend must mention densitometry');

      assert.equal(errs.length, 0, 'Page errors: ' + errs.join(' | '));
    } finally {
      await ctx.close();
    }
  });

  await check('Web PWA manifest, L1 icon, and same-origin-only Service Worker work cleanly', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    try {
      await page.goto(`${base}/index.html?lang=zh`);
      await page.waitForFunction(() => !!window.DensitometryV16, null, { timeout: 30000 });

      const pwa = await page.evaluate(async () => {
        const link = document.querySelector('link[rel="manifest"]');
        const manifestResp = await fetch('./manifest.webmanifest');
        const manifestJson = await manifestResp.json();
        const iconResp = await fetch('./icons/icon-l1.svg');
        const iconText = await iconResp.text();
        const swResp = await fetch('./sw.js');
        const swText = await swResp.text();
        return {
          manifestHref: link?.getAttribute('href') || '',
          manifestStatus: manifestResp.status,
          manifestJson,
          iconStatus: iconResp.status,
          iconText,
          swStatus: swResp.status,
          swText
        };
      });

      assert.equal(pwa.manifestHref, 'manifest.webmanifest');
      assert.equal(pwa.manifestStatus, 200);
      assert.equal(pwa.manifestJson.name, 'GelFigure');
      assert.equal(pwa.manifestJson.display, 'standalone');
      assert.equal(pwa.manifestJson.theme_color, '#002147');
      assert.equal(pwa.manifestJson.icons[0].src, './icons/icon-l1.svg');
      assert.equal(pwa.iconStatus, 200);
      assert.ok(pwa.iconText.includes('<svg') && pwa.iconText.includes('#002147') && pwa.iconText.includes('#C8962E'));
      assert.equal(pwa.swStatus, 200);
      assert.ok(pwa.swText.includes('gelfigure-v1.6.0'));
      assert.ok(pwa.swText.includes('url.origin !== self.location.origin'), 'SW must skip external origins');
      assert.ok(pwa.swText.includes("req.method !== 'GET'"), 'SW must skip non-GET requests');

      // On Chromium, verify live Service Worker registration & full APP_SHELL precache (zero 404s!)
      if (engine === 'chromium') {
        const swReady = await page.evaluate(async () => {
          if (!('serviceWorker' in navigator)) return { supported: false };
          const reg = await Promise.race([
            navigator.serviceWorker.ready,
            new Promise((_, rej) => setTimeout(() => rej(new Error('SW ready timeout')), 15000))
          ]);
          const hasCache = await caches.has('gelfigure-v1.6.0');
          const cache = hasCache ? await caches.open('gelfigure-v1.6.0') : null;
          const keys = cache ? (await cache.keys()).length : 0;
          await reg.unregister();
          return { supported: true, active: !!reg.active, hasCache, keys };
        });
        assert.equal(swReady.supported, true);
        assert.equal(swReady.active, true, 'SW must activate cleanly');
        assert.equal(swReady.hasCache, true, 'SW must create gelfigure-v1.6.0 cache');
        assert.ok(swReady.keys >= 40, `Expected >=40 precached app shell assets, got ${swReady.keys}`);
      }

      assert.equal(errs.length, 0, 'Page errors: ' + errs.join(' | '));
    } finally {
      await ctx.close();
    }
  });

  await check('Single-file dist/GelFigure.html over file:// strips manifest, disables SW, and runs densitometry offline', async () => {
    const onefile = path.join(root, 'dist', 'GelFigure.html');
    assert.ok(fs.existsSync(onefile), 'dist/GelFigure.html must exist');
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const errs = [];
    const extReqs = [];
    page.on('pageerror', e => errs.push(String(e)));
    page.on('request', req => {
      if (/^https?:\/\//i.test(req.url())) extReqs.push(req.url());
    });
    try {
      await page.goto(pathToFileURL(onefile).href);
      await page.waitForFunction(() => !!window.DensitometryV16 && !!window.App, null, { timeout: 30000 });
      const info = await page.evaluate(async () => {
        const hasManifest = !!document.querySelector('link[rel="manifest"]');
        const isSingle = !!window.__GELFIGURE_SINGLEFILE__;
        const buf = window.Demo.encodeTiff16(window.Demo.makeGel());
        await window.App.load({ name: 'demo_gel.tif', buffer: buf, _isDemo: true });
        window.DensitometryV16.setEnabled(true);
        const res = window.DensitometryV16.compute();
        const csv = window.DensitometryV16.buildCsv();
        return {
          hasManifest,
          isSingle,
          rows: res?.rows?.length || 0,
          satCount: res?.saturatedBlockedCount || 0,
          csvOk: csv.includes('# Disclaimer,')
        };
      });
      assert.equal(info.hasManifest, false, 'Single-file HTML must strip manifest link');
      assert.equal(info.isSingle, true, 'Single-file HTML must set __GELFIGURE_SINGLEFILE__');
      assert.ok(info.rows >= 6, 'Densitometry must work offline in single-file HTML');
      assert.ok(info.satCount >= 1, 'Demo gel saturation blocking must work offline');
      assert.equal(info.csvOk, true);
      assert.equal(extReqs.length, 0, 'Single-file HTML must make zero external requests: ' + extReqs.join(', '));
      assert.equal(errs.length, 0, 'Page errors: ' + errs.join(' | '));
    } finally {
      await ctx.close();
    }
  });

  await check('README documentation reflects v1.6.0 opt-in densitometry & linear-range disclaimer', async () => {
    const en = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
    const zh = fs.readFileSync(path.join(root, 'README.zh-CN.md'), 'utf8');
    assert.ok(en.includes('1.6.0'), 'README.md should reference 1.6.0');
    assert.ok(/densitometry/i.test(en) && /linear/i.test(en) && /saturated/i.test(en), 'README.md must describe densitometry, linear range, and saturation blocking');
    assert.ok(!/not a quantitative-analysis tool/i.test(en), 'README.md must update old "not a quantitative-analysis tool" sentence');
    assert.ok(zh.includes('1.6.0'), 'README.zh-CN.md should reference 1.6.0');
    assert.ok(zh.includes('灰度定量') && zh.includes('线性') && zh.includes('过曝'), 'README.zh-CN.md must describe densitometry, linear range, and saturation blocking');
    assert.ok(!zh.includes('不提供定量分析'), 'README.zh-CN.md must update old "不提供定量分析" sentence');
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
    const out = await v16DensitometryPwaChecks(browser, base, ROOT, 'chromium');
    for (const [st, msg, err] of out) console.log(`${st === 'ok' ? '✓' : '✗'} ${msg}${err ? '\n  ' + err : ''}`);
    if (out.some(r => r[0] === 'FAIL')) process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
  }
}
