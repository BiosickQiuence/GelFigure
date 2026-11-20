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
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8'
};

function parseRgb(str) {
  const m = String(str || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  return m ? [+m[1], +m[2], +m[3]] : null;
}

function relLum([r, g, b]) {
  const lin = c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(c1, c2) {
  const l1 = relLum(c1), l2 = relLum(c2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

export async function v12VisualChecks(browser, base, root = ROOT, engine = 'chromium') {
  const results = [];
  const check = async (name, fn) => {
    try { await fn(); results.push(['ok', 'v1.2: ' + name]); }
    catch (err) { results.push(['FAIL', 'v1.2: ' + name, err.stack || err.message]); }
  };

  const shotDir = path.join(root, 'test-results', 'v1.2');
  fs.mkdirSync(shotDir, { recursive: true });

  await check('Scheme C tokens, dark canvas, brand-only gold, zero emoji chrome, WCAG AA contrast, 1280x720 layout', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    page.on('console', m => { if (m.type() === 'error' && /Content.Security.Policy|Refused to/i.test(m.text())) errs.push(m.text()); });

    try {
      await page.goto(`${base}/index.html?demo=1&lang=zh`);
      await page.waitForFunction(() => window.App?.S?.lanes?.length > 0 && document.querySelector('#preview svg'), null, { timeout: 60000 });
      await page.evaluate(() => { try { localStorage.setItem('gelfigure.tour.done.v1', '1'); } catch (e) {} });
      if (engine === 'chromium') await page.screenshot({ path: path.join(shotDir, 'desktop-1280-zh.png') });

      const audit = await page.evaluate(() => {
        const cs = el => getComputedStyle(el);
        const rootStyle = cs(document.documentElement);
        const topbar = document.querySelector('.topbar');
        const edBox = document.getElementById('editorBox');
        const pvBox = document.getElementById('previewBox');
        const body = document.body;

        // 1. Check Unicode glyph icons in chrome
        const badGlyphs = /[\u21A9\u21AA\u2699\u2728\u2B50\u{1F300}-\u{1FAFF}]/u;
        const chromeSelectors = ['.topbar button', '.topbar a', '.stage-head .col-title', '.panel .sec-h', '.sheet-item'];
        const emojiHits = [];
        for (const sel of chromeSelectors) {
          for (const el of document.querySelectorAll(sel)) {
            const txt = (el.textContent || '').trim();
            if (badGlyphs.test(txt)) emojiHits.push(`${sel}: ${txt}`);
          }
        }

        // 2. Check Amber Gold rgb(200, 150, 46) only on authorized brand elements
        const goldHits = [];
        for (const el of document.querySelectorAll('body *')) {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) continue;
          const st = cs(el);
          const usesGold = [st.color, st.backgroundColor, st.borderColor, st.fill, st.stroke].some(v => /200,\s*150,\s*46/.test(v || ''));
          if (usesGold) {
            const ok = el.closest('.brand-mark, #btnStarTop, .star-btn, .heading-rule') !== null;
            if (!ok) goldHits.push(el.tagName + (el.id ? '#' + el.id : '') + '.' + (el.className || ''));
          }
        }

        // 3. Check 1280x720 topbar overflow & col-title wrapping
        const tbRect = topbar.getBoundingClientRect();
        const topbarOverflow = topbar.scrollWidth > topbar.clientWidth + 2;
        const colTitleWrapped = Array.from(document.querySelectorAll('.col-title')).some(el => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 28;
        });
        const dpiInMenu = !!document.querySelector('#exportMenu #dpiTop');

        // 4. Collect color pairs for WCAG AA check
        const brandEl = topbar.querySelector('.brand span') || topbar.querySelector('.brand');
        const btnExport = document.getElementById('btnPNG');
        const colors = {
          brandBg: cs(topbar).backgroundColor,
          brandFg: cs(brandEl).color,
          bodyBg: cs(body).backgroundColor,
          bodyFg: cs(body).color,
          mutedFg: rootStyle.getPropertyValue('--muted').trim(),
          primaryBg: cs(btnExport).backgroundColor,
          primaryFg: cs(btnExport).color,
          editorBg: cs(edBox).backgroundColor,
          previewBg: cs(pvBox).backgroundColor,
          tokenBrand: rootStyle.getPropertyValue('--brand').trim(),
          tokenCanvas: rootStyle.getPropertyValue('--canvas').trim(),
          tokenAccent: rootStyle.getPropertyValue('--accent').trim()
        };

        return {
          emojiHits,
          goldHits,
          topbarOverflow,
          topbarRight: Math.round(tbRect.right),
          colTitleWrapped,
          dpiInMenu,
          svgIcons: document.querySelectorAll('svg.ic use').length,
          colors,
          stNames: document.getElementById('stNames')?.textContent?.trim() || '',
          dnaUnit: window.App?.S?.markers?.[0]?.unit || ''
        };
      });

      assert.equal(audit.emojiHits.length, 0, 'Unexpected emoji/Unicode icons in chrome: ' + audit.emojiHits.join(', '));
      assert.equal(audit.goldHits.length, 0, 'Amber Gold used outside brand targets: ' + audit.goldHits.join(', '));
      assert.equal(audit.topbarOverflow, false, 'Topbar overflowed at 1280x720');
      assert.equal(audit.colTitleWrapped, false, '.col-title wrapped onto multiple lines');
      assert.equal(audit.dpiInMenu, true, '#dpiTop should live inside #exportMenu');
      assert.ok(audit.svgIcons >= 10, 'Expected SVG sprite icons in chrome, got ' + audit.svgIcons);
      assert.equal(audit.colors.tokenBrand.toUpperCase(), '#002147');
      assert.equal(audit.colors.tokenCanvas.toUpperCase(), '#15181C');
      assert.equal(audit.colors.tokenAccent.toUpperCase(), '#C8962E');
      assert.equal(audit.colors.editorBg, 'rgb(21, 24, 28)', 'Editor canvas must be #15181C');
      assert.equal(audit.colors.previewBg, 'rgb(21, 24, 28)', 'Preview canvas must be #15181C');
      assert.equal(audit.colors.brandBg, 'rgb(0, 33, 71)', 'Topbar must be Oxford Blue #002147');

      // WCAG AA >= 4.5:1 checks
      assert.ok(contrastRatio(parseRgb(audit.colors.brandFg), parseRgb(audit.colors.brandBg)) >= 4.5, 'Topbar brand text contrast < 4.5');
      assert.ok(contrastRatio(parseRgb(audit.colors.bodyFg), parseRgb(audit.colors.bodyBg)) >= 4.5, 'Body text contrast < 4.5');
      assert.ok(contrastRatio(parseRgb(audit.colors.primaryFg), parseRgb(audit.colors.primaryBg)) >= 4.5, 'Primary button contrast < 4.5');
      assert.ok(contrastRatio([82, 91, 102], [255, 255, 255]) >= 4.5, '--muted (#525B66) on white must be >= 4.5');
      assert.ok(contrastRatio([82, 91, 102], [246, 244, 239]) >= 4.5, '--muted (#525B66) on warm paper must be >= 4.5');

      // V6 DNA default unit & lane naming count
      assert.equal(audit.dnaUnit, 'auto', 'DNA marker should default to auto (kb shorthand)');
      assert.match(audit.stNames, /已填\s+\d+\/\d+\s+个泳道名/, 'ZH lane name status should say 已填 X/Y 个泳道名, got: ' + audit.stNames);

      // Marker popover 3-option preview check
      await page.evaluate(() => {
        window.MarkerUI.labelPopover(0, 0);
      });
      const previewBtns = await page.locator('.marker-unit-preview button').count();
      assert.equal(previewBtns, 3, 'Marker popover should show 3 quick unit preview options');
      await page.click('#markerPopClose');

      // Single active toast (non-stacking)
      const toastCount = await page.evaluate(() => {
        window.UI.toast('First message');
        window.UI.toast('Second message');
        window.UI.toast('Third message');
        return document.querySelectorAll('#toasts .toast').length;
      });
      assert.equal(toastCount, 1, 'Notifications must never stack; expected 1 active toast');

      // Searchable Help + ? shortcuts + 5-step onboarding tour
      await page.click('#btnHelp');
      await page.waitForFunction(() => !document.getElementById('helpDlg').classList.contains('hidden'));
      const totalHelp = await page.locator('#helpDlg li').count();
      await page.fill('#helpSearch', 'Marker');
      const visibleHelp = await page.evaluate(() => Array.from(document.querySelectorAll('#helpDlg li')).filter(el => !el.classList.contains('hidden')).length);
      assert.ok(visibleHelp >= 1 && visibleHelp < totalHelp, `Help search for Marker should filter items (${visibleHelp}/${totalHelp})`);
      if (engine === 'chromium') await page.screenshot({ path: path.join(shotDir, 'help-search.png') });

      await page.click('#btnReplayTour');
      await page.waitForFunction(() => !!document.querySelector('.tour-card'));
      const tourMeta = await page.textContent('.tour-step-meta');
      assert.match(tourMeta || '', /1\s*\/\s*5/, 'Tour should start at step 1/5');
      if (engine === 'chromium') await page.screenshot({ path: path.join(shotDir, 'tour-step1.png') });
      await page.click('#tourNext');
      const tourMeta2 = await page.textContent('.tour-step-meta');
      assert.match(tourMeta2 || '', /2\s*\/\s*5/, 'Tour should advance to step 2/5');
      await page.click('#tourSkip');
      await page.waitForFunction(() => !document.querySelector('.tour-card'));

      // Press '?' to open shortcuts modal
      await page.keyboard.press('Shift+?');
      await page.waitForFunction(() => !document.getElementById('shortcutsDlg').classList.contains('hidden'));
      const kbdCount = await page.locator('#shortcutsDlg kbd').count();
      assert.ok(kbdCount >= 6, 'Shortcuts modal should list keyboard shortcuts');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.getElementById('shortcutsDlg').classList.contains('hidden'));

      // English UI check for V6 lane naming copy
      await page.click('#btnLang');
      await page.waitForFunction(() => window.I18N?.lang === 'en');
      const enNames = await page.textContent('#stNames');
      assert.match(enNames || '', /\d+\/\d+\s+lanes named/, 'EN lane name status should say X/Y lanes named, got: ' + enNames);

      assert.equal(errs.length, 0, 'Page errors: ' + errs.join(' | '));
    } finally {
      await ctx.close();
    }
  });

  await check('dev/components.html design system showcase renders cleanly', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    try {
      await page.goto(`${base}/dev/components.html`);
      await page.waitForFunction(() => document.querySelectorAll('.swatch').length >= 6);
      if (engine === 'chromium') await page.screenshot({ path: path.join(shotDir, 'components-showcase.png'), fullPage: true });
      assert.equal(errs.length, 0, 'dev/components.html errors: ' + errs.join(' | '));
    } finally {
      await ctx.close();
    }
  });

  await check('dist/GelFigure.html works offline over file:// with inlined tokens, font & i18n', async () => {
    const distPath = path.join(root, 'dist', 'GelFigure.html');
    assert.ok(fs.existsSync(distPath), 'dist/GelFigure.html must exist');
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    page.on('console', m => { if (m.type() === 'error' && /Content.Security.Policy|Refused to/i.test(m.text())) errs.push(m.text()); });
    try {
      await page.goto(pathToFileURL(distPath).href);
      await page.waitForFunction(() => !!window.App && !!window.GelFigureI18N && !!window.Notify);
      const info = await page.evaluate(() => ({
        version: window.App.VERSION,
        zhKeys: Object.keys(window.GelFigureI18N?.zh || {}).length,
        enKeys: Object.keys(window.GelFigureI18N?.en || {}).length,
        topbarBg: getComputedStyle(document.querySelector('.topbar')).backgroundColor,
        editorBg: getComputedStyle(document.getElementById('editorBox')).backgroundColor
      }));
      assert.match(info.version, /^(?:1\.[2-9]|[2-9]\.\d+)\.\d+$/);
      assert.ok(info.zhKeys >= 5 && info.enKeys >= 5, 'Inlined i18n dictionaries missing');
      assert.equal(info.topbarBg, 'rgb(0, 33, 71)');
      assert.equal(info.editorBg, 'rgb(21, 24, 28)');
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
    const res = await v12VisualChecks(browser, base, ROOT, 'chromium');
    for (const [s, what, detail] of res) console.log(`  ${s === 'ok' ? '✓' : '✗'} ${what}${detail ? '\n      ' + detail : ''}`);
    if (res.some(r => r[0] !== 'ok')) process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
  }
}
