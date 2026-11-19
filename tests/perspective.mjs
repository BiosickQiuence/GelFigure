import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function perspectiveChecks(browser, base, root, engine) {
  const results = [], errors = [], ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } }), p = await ctx.newPage();
  const dir = path.join(root, 'test-results', 'perspective', engine); fs.mkdirSync(dir, { recursive: true });
  p.on('pageerror', e => errors.push(e.message));
  const check = async (name, fn) => { try { await fn(); results.push(['ok', 'perspective: ' + name]); } catch (e) { results.push(['FAIL', 'perspective: ' + name, e.stack]); } };
  const load = async () => { await p.goto(base + '/index.html?demo=1&lang=en'); await p.waitForFunction(() => document.title.startsWith('READY '), null, { timeout: 120000 }); };
  try {
    await load();
    await check('analytic trapezoid sampling, identity and matching RGB/float geometry', async () => {
      const r = await p.evaluate(() => {
        const w = 65, h = 49, data = Float32Array.from({ length: w * h }, (_, i) => ((i % w) + 2 * Math.floor(i / w)) / 200);
        const points = [{ x: 10, y: 8 }, { x: 50, y: 8 }, { x: 58, y: 40 }, { x: 2, y: 40 }], spec = { points, w: 57, h: 33 };
        const out = Perspective.warp({ w, h, data }, spec, false);
        // For this trapezoid the middle maps analytically to (30, 64/3), not a bilinear quad's (30,24).
        const expected = (30 + 128 / 3) / 200, center = out.data[16 * 57 + 28];
        const identity = Perspective.warp({ w, h, data }, { w, h, points: [{ x: 0, y: 0 }, { x: 64, y: 0 }, { x: 64, y: 48 }, { x: 0, y: 48 }] }, false);
        const rgb = new Uint8Array(w * h * 3); for (let i = 0; i < w * h; i++) { rgb[i * 3] = i % w; rgb[i * 3 + 1] = Math.floor(i / w); rgb[i * 3 + 2] = 37; }
        const colour = Perspective.warp({ w, h, data: rgb }, spec, true), j = (16 * 57 + 28) * 3;
        let maxDiff = 0; data.forEach((v, i) => { maxDiff = Math.max(maxDiff, Math.abs(v - identity.data[i])); });
        return { center, expected, maxDiff, colour: [...colour.data.slice(j, j + 3)], corners: [out.data[0], out.data[56], out.data[32 * 57 + 56], out.data[32 * 57]] };
      });
      assert(Math.abs(r.center - r.expected) < 1e-6, JSON.stringify(r)); assert(r.maxDiff < 1e-7); assert.deepEqual(r.colour, [30, 21, 37]);
      [26, 66, 138, 82].forEach((v, i) => assert(Math.abs(r.corners[i] - v / 200) < 1e-6));
    });
    await check('rejects crossing, concave, coincident, outside and oversized selections without editing state', async () => {
      const r = await p.evaluate(() => {
        const before = App.snapshot(), quads = [
          [{ x: 10, y: 10 }, { x: 80, y: 80 }, { x: 80, y: 10 }, { x: 10, y: 80 }],
          [{ x: 10, y: 10 }, { x: 80, y: 10 }, { x: 30, y: 20 }, { x: 10, y: 80 }],
          Array(4).fill({ x: 10, y: 10 }),
          [{ x: -1, y: 10 }, { x: 80, y: 10 }, { x: 80, y: 80 }, { x: 10, y: 80 }]
        ];
        let rejected = 0; for (const ps of quads) try { Perspective.apply(ps); } catch { rejected++; }
        try { Perspective.warp(App.rawSrc, { points: [{ x: 0, y: 0 }, { x: 80, y: 0 }, { x: 80, y: 80 }, { x: 0, y: 80 }], w: 100000, h: 100000 }); } catch { rejected++; }
        return { rejected, same: before === App.snapshot() };
      }); assert.deepEqual(r, { rejected: 5, same: true });
    });
    await check('four actual mouse drags, cancel, confirmation, undo/redo and processing disclosure', async () => {
      await p.evaluate(() => { App.setRotation(0); App.commit(); window.beforePerspective = App.snapshot(); });
      await p.locator('[data-step-toggle="1"]').click();
      await p.locator('#btnPerspective').click(); await p.locator('#perspectiveTools').waitFor({ state: 'visible' });
      const old = await p.evaluate(() => Perspective.points.map(p => ({ ...p })));
      const rect = await p.locator('#editor').boundingBox();
      for (let i = 0; i < 4; i++) {
        const point = await p.evaluate(i => Editor.toScr(Perspective.points[i].x, Perspective.points[i].y), i);
        await p.mouse.move(rect.x + point.x, rect.y + point.y); await p.mouse.down();
        await p.mouse.move(rect.x + point.x + (i === 0 || i === 3 ? 12 : -12), rect.y + point.y + (i < 2 ? 10 : -10), { steps: 5 }); await p.mouse.up();
      }
      const changed = await p.evaluate(old => Perspective.points.every((p, i) => Math.hypot(p.x - old[i].x, p.y - old[i].y) > 2), old); assert(changed);
      await p.screenshot({ path: path.join(dir, 'selecting.png') });
      await p.locator('#cancelPerspective').click(); assert(await p.evaluate(() => App.snapshot() === beforePerspective));
      await p.locator('#btnPerspective').click();
      p.once('dialog', d => d.dismiss()); await p.locator('#applyPerspective').click(); assert(await p.evaluate(() => !App.S.perspective && !!Perspective.points));
      p.once('dialog', d => d.accept()); await p.locator('#applyPerspective').click();
      const r = await p.evaluate(() => {
        const snap = App.snapshot(), hash = App.S.file.sha256, original = App.rawSrc.data;
        const log = Export.processingLog(App.S), hints = Export.legendHints(App.S), after = App.src;
        App.undo(); const undo = App.snapshot() === beforePerspective && !App.S.perspective;
        App.redo(); const redo = App.snapshot() === snap && App.src.w === after.w && App.src.h === after.h;
        return { undo, redo, original: original === App.rawSrc.data && hash === App.S.file.sha256, spec: log.perspectiveCorrection, hint: hints.some(s => s.includes('projective transform')), detected: App.S.lanes.length > 0, closed: !Perspective.points };
      }); assert(r.undo && r.redo && r.original && r.hint && r.detected && r.closed, JSON.stringify(r)); assert.equal(r.spec.interpolation, 'bilinear');
      await p.screenshot({ path: path.join(dir, 'corrected.png') });
    });
    await check('all D4 orientations/deskew map back to source; repeated correction avoids raster accumulation', async () => {
      const r = await p.evaluate(() => {
        const S = App.S, saved = JSON.parse(App.snapshot()); let error = 0;
        for (const orient of Engine.orientList()) {
          App.S = { ...saved, orient: orient.id, rotation: 7 }; App.ensureRot();
          const w = saved.perspective.w, h = saved.perspective.h, x = w * .4, y = h * .6, o = Engine.orientPoint(Engine.orientCode(orient.id), x, y, w, h);
          const a = 7 * Math.PI / 180, cx = (App.src.w - 1) / 2, cy = (App.src.h - 1) / 2;
          const sx = Math.cos(a) * (o.x - cx) - Math.sin(a) * (o.y - cy) + cx, sy = Math.sin(a) * (o.x - cx) + Math.cos(a) * (o.y - cy) + cy;
          const back = Perspective.sourcePoint(sx, sy), expected = Perspective.mapping(saved.perspective.points)(x / (w - 1), y / (h - 1));
          error = Math.max(error, Math.hypot(back.x - expected.x, back.y - expected.y));
        }
        App.S = S; App.ensureRot();
        const w = App.src.w, h = App.src.h; Perspective.apply([{ x: 5, y: 5 }, { x: w - 6, y: 9 }, { x: w - 9, y: h - 6 }, { x: 8, y: h - 9 }]);
        const direct = Perspective.warp(App.rawSrc, App.S.perspective, false); let diff = 0;
        direct.data.forEach((v, i) => { diff = Math.max(diff, Math.abs(v - App.src.data[i])); }); return { error, diff };
      }); assert(r.error < 1e-8, JSON.stringify(r)); assert.equal(r.diff, 0);
    });
    await check('project and original-byte round trip, exports, reset and gesture cancellation on undo', async () => {
      const r = await p.evaluate(async () => {
        const snap = App.snapshot(), data = App.src.data.slice(), bytes = await App.sha256(App.srcBuffer), file = await App.projectBlob(), fig = App.buildFigure(false);
        const pptx = await PPTX.build();
        await App.openProject(await file.arrayBuffer()); let diff = 0; data.forEach((v, i) => { diff = Math.max(diff, Math.abs(v - App.src.data[i])); });
        const restored = App.snapshot() === snap, original = bytes === await App.sha256(App.srcBuffer);
        Perspective.start(); App.S.levels.gamma = 1.1; App.commit(); Perspective.start(); App.undo(); const cancelled = !Perspective.points;
        App.resetAll(); return { restored, original, diff, pptx: pptx.size > 1000, svg: fig.svg.includes('data:image/png'), reset: !App.S.perspective && App.src.w === App.rawSrc.w, cancelled };
      }); assert(r.restored && r.original && r.pptx && r.svg && r.reset && r.cancelled, JSON.stringify(r)); assert.equal(r.diff, 0);
    });
    await check('RGB projects, post-correction quarter turns and same-size exposures retain the correction', async () => {
      const r = await p.evaluate(async () => {
        const gel = Demo.makeGel(), rgb = new Uint8Array(gel.width * gel.height * 3);
        for (let i = 0; i < gel.data.length; i++) { rgb[i * 3] = Math.round(gel.data[i] * 180); rgb[i * 3 + 1] = Math.round(gel.data[i] * 220); rgb[i * 3 + 2] = Math.round(gel.data[i] * 255); }
        const source = { name: 'synthetic-colour.tif', buffer: Export.encodeTiffRGB(rgb, gel.width, gel.height, 300, 'Synthetic') };
        const other = { name: 'synthetic-exposure.tif', buffer: Export.encodeTiffRGB(rgb.map(v => Math.round(v * .8)), gel.width, gel.height, 300, 'Synthetic') };
        await App.loadMany([source, other]); App.setRotation(0); App.setDisplayMode('colour'); App.commit();
        const w = App.src.w, h = App.src.h;
        Perspective.apply([{ x: 80, y: 30 }, { x: w - 90, y: 60 }, { x: w - 35, y: h - 30 }, { x: 30, y: h - 70 }]);
        const spec = JSON.stringify(App.S.perspective), file = await App.projectBlob(), pixels = App.sourceRGB.slice();
        await App.openProject(await file.arrayBuffer()); const project = App.isColour() && pixels.every((v, i) => v === App.sourceRGB[i]);
        // Reinstall the exposure set, which .gelfig deliberately does not carry.
        App.exposures = [source, other]; App.expIdx = 0; await App.switchExposure(1);
        const exposure = JSON.stringify(App.S.perspective) === spec && App.isColour();
        const expected = Perspective.warp({ w: App.rawSrc.w, h: App.rawSrc.h, data: App.rawRGB }, App.S.perspective, true);
        const samePixels = expected.data.every((v, i) => v === App.sourceRGB[i]);
        App.setOrient('r90'); const turned = App.src.w === App.S.perspective.h && App.src.h === App.S.perspective.w;
        const f = App.buildFigure(false); return { project, exposure, samePixels, turned, figure: f.svg.includes('data:image/png') };
      }); assert(Object.values(r).every(Boolean), JSON.stringify(r));
    });
    await check('offline Chinese phone: touch corner drag, pointer cancellation, apply and no external requests', async () => {
      const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
      try {
        const q = await mobile.newPage(), external = []; q.on('request', r => { if (/^https?:/.test(r.url())) external.push(r.url()); });
        await q.route(/^https?:/, r => r.abort()); await q.goto(pathToFileURL(path.join(root, 'dist', 'GelFigure.html')).href + '?demo=1&lang=zh');
        await q.waitForFunction(() => document.title.startsWith('READY '), null, { timeout: 120000 });
        await q.locator('#btnMore').tap(); await q.locator('#moreSheet [data-m="panel"]').tap();
        await q.locator('[data-step-toggle="1"]').tap(); await q.locator('#btnPerspective').tap();
        assert.equal(await q.evaluate(() => Mobile.view()), 'raw');
        const moved = await q.evaluate(() => {
          const cv = document.getElementById('editor'), box = cv.getBoundingClientRect(), old = { ...Perspective.points[0] }, p = Editor.toScr(old.x, old.y);
          const event = (type, dx, dy) => cv.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 7, pointerType: 'touch', clientX: box.x + p.x + dx, clientY: box.y + p.y + dy }));
          event('pointerdown', 0, 0); event('pointermove', 16, 12); event('pointercancel', 16, 12);
          const cancelled = Perspective.points[0].x === old.x && Perspective.points[0].y === old.y;
          event('pointerdown', 0, 0); event('pointermove', 16, 12); event('pointerup', 16, 12);
          return cancelled && Math.hypot(Perspective.points[0].x - old.x, Perspective.points[0].y - old.y) > 1;
        }); assert(moved);
        await q.screenshot({ path: path.join(dir, 'phone.png') });
        q.once('dialog', d => d.accept()); await q.locator('#applyPerspective').tap(); assert(await q.evaluate(() => !!App.S.perspective));
        assert(await q.evaluate(() => document.documentElement.scrollWidth === innerWidth)); assert.deepEqual(external, []);
      } finally { await mobile.close(); }
      assert.deepEqual(errors, []);
    });
  } catch (e) { results.push(['FAIL', 'perspective runner', e.stack]); } finally { await ctx.close(); }
  return results;
}
