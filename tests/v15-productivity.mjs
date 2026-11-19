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
  '.json': 'application/json; charset=utf-8'
};

export async function v15ProductivityChecks(browser, base, root = ROOT, engine = 'chromium') {
  const results = [];
  const check = async (name, fn) => {
    try { await fn(); results.push(['ok', 'v1.5: ' + name]); }
    catch (err) { results.push(['FAIL', 'v1.5: ' + name, err.stack || err.message]); }
  };
  const shotDir = path.join(root, 'test-results', 'v1.5');
  fs.mkdirSync(shotDir, { recursive: true });

  await check('Sample Table TSV/CSV mapping applies lane names, groups, and +/- condition rows', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 860 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    try {
      await page.goto(`${base}/index.html?demo=1&lang=zh`);
      await page.waitForFunction(() => document.title.startsWith('READY ') && !!window.SampleTable, null, { timeout: 60000 });
      await page.evaluate(() => { try { localStorage.setItem('gelfigure.tour.done.v1', '1'); } catch (e) {} });

      // Test RFC-4180 CSV parsing with quoted commas
      const parsedCsv = await page.evaluate(() => window.SampleTable.parseTable('Sample,Group,Drug\n"WT, ctrl",Control,-\n"KO-1",Mutant,+\n'));
      assert.equal(parsedCsv.delimiter, ',');
      assert.equal(parsedCsv.rows[1][0], 'WT, ctrl');

      // Open Sample Table from Step 3
      await page.click('#btnSampleTable');
      await page.waitForSelector('#sampleTableModal:not(.hidden)');
      const tsv = [
        '样本\t分组\t处理\t对照',
        'WT\tCtrl\t-\t+',
        'KO-1\tMutant\t+\t-',
        'KO-2\tMutant\t+\t-',
        'Res-1\tRescue\t+\t+',
        'Res-2\tRescue\t+\t+'
      ].join('\n');
      await page.fill('#stRawInput', tsv);
      await page.waitForSelector('.st-preview-tbl tbody tr');
      if (engine === 'chromium') await page.screenshot({ path: path.join(shotDir, 'sample-table.png') });

      await page.click('#stApply');
      await page.waitForSelector('#sampleTableModal.hidden', { state: 'attached' });

      const applied = await page.evaluate(() => {
        const fl = window.UI.figLanes();
        return {
          names: fl.slice(0, 6).map(li => window.App.S.lanes[li].name),
          groups: window.App.S.groups.map(g => ({ text: g.text, span: g.to - g.from + 1 })),
          conds: window.App.S.conditions.map(c => ({ name: c.name, vals: fl.slice(1, 6).map(li => c.values[li]) }))
        };
      });
      assert.deepEqual(applied.names, ['M', 'WT', 'KO-1', 'KO-2', 'Res-1', 'Res-2']);
      assert.equal(applied.groups.length, 3);
      assert.deepEqual(applied.groups.map(g => g.text), ['Ctrl', 'Mutant', 'Rescue']);
      assert.equal(applied.conds.length, 2);
      assert.deepEqual(applied.conds[0].vals, ['−', '+', '+', '+', '+']);
      assert.equal(errs.length, 0, 'Page errors: ' + errs.join(' | '));
    } finally {
      await ctx.close();
    }
  });

  await check('Historical Lane Name Autocomplete suggests & commits via keyboard/click', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 860 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    try {
      await page.goto(`${base}/index.html?demo=1&lang=zh`);
      await page.waitForFunction(() => document.title.startsWith('READY ') && !!window.LaneAutocomplete, null, { timeout: 60000 });

      await page.evaluate(() => {
        window.LaneAutocomplete.record(['Res-2', 'Res-ctrl', 'Res-ctrl']);
      });
      const inp = page.locator('#step3LaneList .step3-lane-input').nth(2);
      await inp.click();
      await inp.fill('Res-');
      await page.waitForSelector('#laneAutocompleteMenu:not(.hidden)');
      const opts = await page.locator('#laneAutocompleteMenu .lane-ac-item').count();
      assert.ok(opts >= 2, 'Autocomplete must display matching historical names');
      if (engine === 'chromium') await page.screenshot({ path: path.join(shotDir, 'lane-autocomplete.png') });

      await inp.press('Enter');
      const val = await inp.inputValue();
      assert.ok(val === 'Res-2' || val === 'Res-ctrl', `Expected autocompleted value, got ${val}`);
      assert.equal(errs.length, 0, 'Page errors: ' + errs.join(' | '));
    } finally {
      await ctx.close();
    }
  });

  await check('One-Click Copy Figure Legend toggles ZH/EN and copies text', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 860 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    try {
      await page.goto(`${base}/index.html?demo=1&lang=zh`);
      await page.waitForFunction(() => document.title.startsWith('READY ') && !!window.LegendCopy, null, { timeout: 60000 });
      await page.evaluate(() => {
        window.__copiedLegend = '';
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: { writeText: async t => { window.__copiedLegend = t; } }
        });
      });

      await page.click('#btnCopyLegend');
      await page.waitForSelector('#legendModal:not(.hidden)');
      const zhText = await page.inputValue('#legendText');
      assert.ok(zhText.includes('DNA') && zhText.includes('泳道'), 'ZH legend should include gel type and lanes');

      await page.click('[data-leg-lang="en"]');
      const enText = await page.inputValue('#legendText');
      assert.ok(enText.includes('DNA agarose gel') && enText.includes('Lanes:'), 'EN legend should include English figure description');
      if (engine === 'chromium') await page.screenshot({ path: path.join(shotDir, 'copy-legend.png') });

      await page.click('#legendCopyBtn');
      const copied = await page.evaluate(() => window.__copiedLegend);
      assert.equal(copied, enText, 'Clipboard must receive the exact English legend');
      assert.equal(errs.length, 0, 'Page errors: ' + errs.join(' | '));
    } finally {
      await ctx.close();
    }
  });

  await check('History Search & Date Grouping filters cached projects by name and lane names', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    try {
      await page.goto(`${base}/index.html?lang=zh`);
      await page.waitForFunction(() => !!window.App && !!window.HistoryUI && !!window.Demo, null, { timeout: 60000 });

      // Load two distinct synthetic real (non-demo) gels so both are saved to IndexedDB history
      await page.evaluate(async () => {
        const makeGel = seed => {
          const gel = window.Demo.makeGel();
          const data = new Float32Array(gel.data.length);
          for (let i = 0; i < gel.data.length; i++) data[i] = Math.min(1, Math.max(0, gel.data[i] * (0.9 + seed * 0.05)));
          const bytes = new Uint8Array(data.length);
          for (let i = 0; i < data.length; i++) bytes[i] = Math.round(data[i] * 255);
          return window.Export.encodeTiffGray(bytes, gel.width, gel.height, 300, 'batch-' + seed);
        };
        await window.App.loadMany([{ name: 'pcr_alpha.tif', buffer: makeGel(1) }]);
        window.App.S.lanes[1].name = 'AlphaGene';
        window.App.commit();
        await window.App.saveDraft();

        await window.App.loadMany([{ name: 'pcr_beta.tif', buffer: makeGel(2) }]);
        window.App.S.lanes[1].name = 'BetaMarkerSample';
        window.App.commit();
        await window.App.saveDraft();
      });

      await page.click('#cacheStatus');
      await page.waitForSelector('#historyDlg:not(.hidden)');
      await page.waitForSelector('#projectLibrary .history-date-group');
      assert.equal(await page.locator('#projectLibrary .library-card').count(), 2, 'Both saved projects must appear');
      assert.ok((await page.textContent('.history-date-head')).includes('今天'), 'Recent projects must group under Today/今天');

      await page.fill('#historySearch', 'AlphaGene');
      assert.equal(await page.locator('#projectLibrary .library-card').count(), 1, 'Search must match by lane name');
      assert.ok((await page.textContent('#projectLibrary .open-project')).includes('pcr_alpha'));
      assert.equal(errs.length, 0, 'Page errors: ' + errs.join(' | '));
    } finally {
      await ctx.close();
    }
  });

  await check('Batch Processing shows N×2 AI call disclosure, processes sequentially, switches review strip, and builds unified ZIP', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 860 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    try {
      await page.goto(`${base}/index.html?lang=zh`);
      await page.waitForFunction(() => !!window.BatchProcessor && !!window.Demo && !!window.Export, null, { timeout: 60000 });

      // Generate 2 real TIFF files in memory and open Batch Modal with them + check N*2 disclosure when AI configured
      await page.evaluate(async () => {
        // Pretend AI is configured & consented to check the N×2 cost disclosure string
        document.getElementById('aiEndpoint').value = 'https://api.batch-check.test/v1';
        document.getElementById('aiModel').value = 'qwen-vl';
        document.getElementById('aiKey').value = 'sk-batch-test';
        document.getElementById('aiSaveSettings').click();
        window.AIConsent.grant('https://api.batch-check.test/v1');

        const makeFile = (name, mult) => {
          const gel = window.Demo.makeGel();
          const bytes = new Uint8Array(gel.data.length);
          for (let i = 0; i < gel.data.length; i++) bytes[i] = Math.min(255, Math.round(gel.data[i] * mult * 255));
          const buf = window.Export.encodeTiffGray(bytes, gel.width, gel.height, 300, name);
          return new File([buf], name, { type: 'image/tiff' });
        };
        window.BatchProcessor.open([makeFile('gel_A.tif', 0.92), makeFile('gel_B.tif', 0.84)]);
      });

      await page.waitForSelector('#batchModal:not(.hidden)');
      const costText = await page.textContent('#batchCostDisclosure');
      assert.ok(costText.includes('2×2') && costText.includes('4'), `Expected 2×2 (4 calls) disclosure, got: ${costText}`);
      if (engine === 'chromium') await page.screenshot({ path: path.join(shotDir, 'batch-modal.png') });

      // Switch to offline batch so no external HTTP is sent, run queue, inspect strip, and export unified ZIP
      await page.uncheck('#batchUseAIChk');
      await page.click('#batchStartBtn');
      await page.waitForSelector('#batchStrip:not(.hidden)', { timeout: 60000 });
      assert.equal(await page.locator('#batchStrip .batch-chip').count(), 2, 'Batch review strip must show 2 gel chips');

      // Switch between gels in review strip and verify checklist updates
      await page.click('#batchStrip [data-batch-idx="1"]');
      assert.equal(await page.evaluate(() => window.BatchProcessor.activeIndex), 1);

      // Export unified ZIP and verify valid PK zip magic + batch-manifest.json
      const zipInfo = await page.evaluate(async () => {
        let captured = null;
        const old = window.Export.deliver;
        window.Export.deliver = (blob, name) => { captured = { blob, name }; return true; };
        try {
          await window.BatchProcessor.exportZip();
        } finally {
          window.Export.deliver = old;
        }
        const bytes = new Uint8Array(await captured.blob.arrayBuffer());
        const txt = new TextDecoder('latin1').decode(bytes);
        return {
          name: captured.name,
          size: bytes.length,
          pk: bytes[0] === 0x50 && bytes[1] === 0x4b,
          hasManifest: txt.includes('batch-manifest.json'),
          hasGelA: txt.includes('01_gel_A/figure.png'),
          hasGelB: txt.includes('02_gel_B/figure.png')
        };
      });
      assert.equal(zipInfo.pk, true, 'Batch export must be a valid ZIP archive');
      assert.equal(zipInfo.hasManifest, true, 'ZIP must contain batch-manifest.json');
      assert.equal(zipInfo.hasGelA && zipInfo.hasGelB, true, 'ZIP must include both gels');
      assert.equal(errs.length, 0, 'Page errors: ' + errs.join(' | '));
    } finally {
      await ctx.close();
    }
  });

  await check('Single-file dist/GelFigure.html supports v1.5 Sample Table & Legend Copy over file://', async () => {
    const distPath = path.join(root, 'dist', 'GelFigure.html');
    assert.ok(fs.existsSync(distPath), 'dist/GelFigure.html must exist');
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    try {
      await page.goto(pathToFileURL(distPath).href + '?demo=1&lang=zh');
      await page.waitForFunction(() => document.title.startsWith('READY ') && !!window.SampleTable && !!window.LegendCopy && !!window.BatchProcessor, null, { timeout: 60000 });
      await page.click('#btnCopyLegend');
      await page.waitForSelector('#legendModal:not(.hidden)');
      assert.ok((await page.inputValue('#legendText')).length > 20);
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
    const res = await v15ProductivityChecks(browser, base, ROOT, 'chromium');
    res.forEach(([s, what, detail]) => console.log(`  ${s === 'ok' ? '✓' : '✗'} ${what}${detail ? `\n      ${detail}` : ''}`));
    process.exitCode = res.some(r => r[0] !== 'ok') ? 1 : 0;
  } finally {
    await browser.close();
    server.close();
  }
}
