/* Four-point rectification. Saved corners are in decoded-source pixels; every render resamples
 * the original data, never a previous corrected raster. No image bytes enter undo state. */
(function (G) {
  'use strict';
  const App = G.App, E = G.Engine, L = G.L, $ = id => document.getElementById(id);
  const P = { points: null, state: null };
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function valid(points, w, h) {
    if (!Array.isArray(points) || points.length !== 4) return false;
    if (points.some(p => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.y < 0 || p.x > w - 1 || p.y > h - 1)) return false;
    const crosses = points.map((a, i) => {
      const b = points[(i + 1) % 4], c = points[(i + 2) % 4];
      return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    });
    return (crosses.every(v => v > 1) || crosses.every(v => v < -1)) && points.every((p, i) => distance(p, points[(i + 1) % 4]) >= 2);
  }
  // Unit square -> quadrilateral homography (corners TL, TR, BR, BL).
  function mapping(points, inverse = false) {
    const [a, b, c, d] = points;
    const dx = a.x - b.x + c.x - d.x, dy = a.y - b.y + c.y - d.y;
    const bx = b.x - c.x, by = b.y - c.y, dx2 = d.x - c.x, dy2 = d.y - c.y;
    const det = bx * dy2 - dx2 * by;
    const g = (dx * dy2 - dx2 * dy) / det, h = (bx * dy - dx * by) / det;
    let m=[b.x-a.x+g*b.x,d.x-a.x+h*d.x,a.x,b.y-a.y+g*b.y,d.y-a.y+h*d.y,a.y,g,h,1];
    if(inverse){
      const [A,B,C,D,F,H,J,K,N]=m,adj=[F*N-H*K,C*K-B*N,B*H-C*F,H*J-D*N,A*N-C*J,C*D-A*H,D*K-F*J,B*J-A*K,A*F-B*D];
      const determinant=A*adj[0]+B*adj[3]+C*adj[6];
      if(!Number.isFinite(determinant)||Math.abs(determinant)<1e-10)throw new Error(L('校正矩阵不可逆，请调整四点','Correction matrix is singular; adjust the corners'));
      m=adj;
    }
    return (u,v)=>{const den=m[6]*u+m[7]*v+m[8];return {x:(m[0]*u+m[1]*v+m[2])/den,y:(m[3]*u+m[4]*v+m[5])/den};};
  }

  function validate(spec, w, h) {
    if (!spec || !valid(spec.points, w, h) || !Number.isInteger(spec.w) || !Number.isInteger(spec.h) || spec.w < 3 || spec.h < 3 || spec.w > 32767 || spec.h > 32767 || spec.w * spec.h > Math.max(w * h, 16777216))
      throw new Error(L('校正范围无效：四点须组成图内的凸四边形，输出尺寸不能过大。', 'Invalid correction: choose a convex quadrilateral inside the image with a supported output size.'));
  }
  function warp(img, spec, rgb) {
    validate(spec, img.w, img.h);
    const point = mapping(spec.points), channels = rgb ? 3 : 1;
    const out = rgb ? new Uint8Array(spec.w * spec.h * 3) : new Float32Array(spec.w * spec.h);
    for (let y = 0; y < spec.h; y++) for (let x = 0; x < spec.w; x++) {
      const p = point(x / (spec.w - 1), y / (spec.h - 1));
      // Only floating-point roundoff reaches outside a validated convex source region.
      const sx = Math.max(0, Math.min(img.w - 1, p.x)), sy = Math.max(0, Math.min(img.h - 1, p.y));
      const x0 = Math.floor(sx), y0 = Math.floor(sy), x1 = Math.min(img.w - 1, x0 + 1), y1 = Math.min(img.h - 1, y0 + 1), fx = sx - x0, fy = sy - y0;
      for (let k = 0; k < channels; k++) {
        const at = (xx, yy) => img.data[(yy * img.w + xx) * channels + k];
        out[(y * spec.w + x) * channels + k] = (at(x0, y0) * (1 - fx) + at(x1, y0) * fx) * (1 - fy) + (at(x0, y1) * (1 - fx) + at(x1, y1) * fx) * fy;
      }
    }
    return { w: spec.w, h: spec.h, data: out };
  }
  // Undo the current deskew and D4 orientation, then the previous correction, if any.
  function sourcePoint(x, y) {
    const S = App.S, a = -S.rotation * Math.PI / 180, cx = (App.src.w - 1) / 2, cy = (App.src.h - 1) / 2;
    const rx = Math.cos(a) * (x - cx) - Math.sin(a) * (y - cy) + cx, ry = Math.sin(a) * (x - cx) + Math.cos(a) * (y - cy) + cy;
    const w = S.perspective ? S.perspective.w : App.rawSrc.w, h = S.perspective ? S.perspective.h : App.rawSrc.h, code = E.orientCode(S.orient);
    const o = E.orientPoint(code, 0, 0, w, h), ex = E.orientPoint(code, 1, 0, w, h), ey = E.orientPoint(code, 0, 1, w, h);
    const p = { x: (rx - o.x) * (ex.x - o.x) + (ry - o.y) * (ex.y - o.y), y: (rx - o.x) * (ey.x - o.x) + (ry - o.y) * (ey.y - o.y) };
    return S.perspective ? mapping(S.perspective.points)(p.x / (w - 1), p.y / (h - 1)) : p;
  }
  function specification(points) {
    const r = App.ensureRot();
    if (!valid(points, r.w, r.h)) throw new Error(L('四点不能交叉、重合或凹陷，请按左上、右上、右下、左下调整。', 'Keep a convex quadrilateral in top-left, top-right, bottom-right, bottom-left order.'));
    const w = Math.round(Math.max(distance(points[0], points[1]), distance(points[3], points[2]))) + 1;
    const h = Math.round(Math.max(distance(points[0], points[3]), distance(points[1], points[2]))) + 1;
    const spec = { points: points.map(p => sourcePoint(p.x, p.y)), w, h };
    validate(spec, App.rawSrc.w, App.rawSrc.h);
    return spec;
  }
  function apply(points, layout = null) {
    const spec = specification(points), S = App.S;
    if(layout&&(!layout.meta||typeof layout.meta!=='object'||!Number.isFinite(layout.pitch)||layout.pitch<=0||!Number.isFinite(layout.halfWidth)||layout.halfWidth<=0||!Array.isArray(layout.lanes)||!layout.lanes.length||layout.lanes.length>200||!layout.lanes.some(l=>!l.hidden)||layout.lanes.some((l,i)=>!Number.isFinite(l.x)||l.x<0||l.x>spec.w-1||(i&&l.x-layout.lanes[i-1].x<1))))throw new Error(L('AI 泳道定位无效，未应用','Invalid AI lane positions; nothing applied'));
    // Compute against a candidate state and restore every derived cache on failure.
    const before = Object.assign({}, App);
    App.S = JSON.parse(JSON.stringify(S));
    const candidate = App.S;
    try {
    candidate.perspective = spec; candidate.orient = ''; candidate.rotation = 0; candidate.autoRotation = 0;
    candidate.crop = { x: 0, y: 0, w: spec.w, h: spec.h };
    ['lanes', 'markers', 'groups', 'conditions', 'arrows', 'boxes', 'brackets', 'labels', 'notes'].forEach(k => { candidate[k] = []; });
    App.selLane = App.selArrow = -1; App.selAnno = null;
    App.cropMeta = null; App._emptyKey = null; App.laneNotice = App.ladderNotice = null;
    App.ensureSrc(); App.ensureRot();
    if(layout){
      if(candidate.gelAIBeta)candidate.layoutHistory=(candidate.layoutHistory||[]).concat(candidate.gelAIBeta);
      candidate.lanes=JSON.parse(JSON.stringify(layout.lanes));candidate.lanePitch=layout.pitch;candidate.laneHalfW=layout.halfWidth;candidate.laneLinked=false;candidate.gelAIBeta=JSON.parse(JSON.stringify(layout.meta));
      if(layout.meta.removedInternalLanes){candidate.style.spliceStyle=candidate.style.spliceStyle==='line'?'line':'gap';candidate.style.spliceGapPt=Math.max(1.5,candidate.style.spliceGapPt||0);}
    }else{
      if(candidate.gelAIBeta)candidate.layoutHistory=(candidate.layoutHistory||[]).concat(candidate.gelAIBeta);
      delete candidate.gelAIBeta;App.autoLanes();App.autoMarkers();
    }
    App.updateSaturation();
    candidate.currentSources = Object.assign({}, candidate.currentSources, {lanes: layout ? 'ai-reviewed' : 'local', markers: 'local'});
    if (layout) App.setResetBaseline();
    } catch (error) { Object.keys(App).forEach(key=>{if(!(key in before))delete App[key];});Object.assign(App, before);throw error; }
    // Keep the existing state identity so open editors can observe one successful change.
    Object.keys(S).forEach(key => { delete S[key]; }); Object.assign(S, candidate); App.S = S;
    App.commit();
  }
  function stop() {
    P.points = null; P.state = null;
    $('perspectiveTools').classList.add('hidden');
    $('btnPerspective').disabled = false;
    G.Editor.draw();
  }
  function start() {
    if (!App.S) return;
    G.FigEdit.flush(); G.FigEdit.setMode(null);
    App.selLane = App.selArrow = -1; App.selAnno = null;
    P.state = App.S;
    const c = App.S.crop, r = App.ensureRot(), x = Math.max(0, c.x), y = Math.max(0, c.y), right = Math.min(r.w - 1, c.x + c.w - 1), bottom = Math.min(r.h - 1, c.y + c.h - 1);
    P.points = [{ x, y }, { x: right, y }, { x: right, y: bottom }, { x, y: bottom }];
    $('perspectiveTools').classList.remove('hidden'); $('btnPerspective').disabled = true;
    $('perspectiveError').textContent = '';
    if (G.Mobile) G.Mobile.setView('raw');
    G.Editor.fitFull();
  }
  function draw(ctx, toScr) {
    if (!P.points || P.state !== App.S) return false;
    const ps = P.points.map(p => toScr(p.x, p.y));
    ctx.save(); ctx.strokeStyle = '#ff4d4f'; ctx.fillStyle = 'rgba(255,77,79,.12)'; ctx.lineWidth = 2; ctx.setLineDash([]);
    ctx.beginPath(); ps.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.fill(); ctx.stroke();
    // Projected grid shows the plane that will become rectangular.
    if (valid(P.points, App.rot.w, App.rot.h)) {
      const at = mapping(P.points); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1;
      for (const t of [.25, .5, .75]) for (const ends of [[[t, 0], [t, 1]], [[0, t], [1, t]]]) {
        ctx.beginPath(); ends.forEach(([u, v], i) => { const p = at(u, v), s = toScr(p.x, p.y); i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y); }); ctx.stroke();
      }
    }
    ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ps.forEach((p, i) => { ctx.fillStyle = '#fff'; ctx.strokeStyle = '#ff4d4f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#9e2224'; ctx.fillText(String(i + 1), p.x, p.y); });
    ctx.restore(); return true;
  }
  function hit(sx, sy, toScr) {
    let index = -1, best = 24;
    P.points.forEach((p, i) => { const s = toScr(p.x, p.y), d = Math.hypot(sx - s.x, sy - s.y); if (d < best) { best = d; index = i; } });
    return index;
  }
  G.Perspective = Object.assign(P, { valid, mapping, validate, warp, sourcePoint, specification, apply, start, stop, draw, hit });
  $('btnPerspective').onclick = start;
  $('cancelPerspective').onclick = stop;
  $('applyPerspective').onclick = () => {
    if (!P.points || P.state !== App.S) return;
    try { specification(P.points); } catch (e) { $('perspectiveError').textContent = e.message; return; }
    if (!confirm(L('将所选四边形拉正为矩形，并重新识别泳道和 Marker。现有名称、标注、分组和剪除设置会清空；可撤销。原始文件保留。继续？', 'Rectify the selected quadrilateral and re-detect lanes and markers? Existing names, annotations, groups and removed-lane settings will be cleared. You can undo; the original file is retained.'))) return;
    const points = P.points; stop();
    try { apply(points); G.Editor.fitFull(); G.UI.toast(L('已完成透视校正，请核对泳道和 Marker（可撤销）', 'Perspective corrected; check lanes and markers (undo available)'), 5000); }
    catch (e) { G.UI.toast(e.message, 5000); }
  };
  App.on(what => { if (P.points && (P.state !== App.S || what === 'change' || what === 'loaded')) stop(); });
  window.addEventListener('keydown', e => { if (P.points && e.key === 'Escape') { e.preventDefault(); stop(); } });
})(window);
