/* Run the actual entry, file chooser/drop and exported figure with synthetic pixels and a mock API. */
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {chromium, firefox, webkit} from 'playwright';

export async function autoFlowChecks(browser, url, engine) {
  const ctx = await browser.newContext({viewport:{width:1280, height:850}});
  const p = await ctx.newPage(), calls = [], errors = [], results = [];
  const api = 'https://auto-flow.synthetic.invalid/v1/chat/completions';
  const testKey = 'synthetic-auto-fixture', testModel = 'synthetic-vision';
  const rect = (l,t,r,b) => [{x:l,y:t},{x:r,y:t},{x:r,y:b},{x:l,y:b}];
  let mode = 'ok', release, held;
  p.on('pageerror', e => errors.push(e.message));
  await p.route(api, async route => {
    const body = route.request().postDataJSON(), content = body.messages[1].content;
    const meta = JSON.parse(content[0].text), image = {width:meta.image.width, height:meta.image.height};
    const layout = !meta.catalogue, stage = layout ? 'layout' : 'markers';
    const png = Buffer.from(content[1].image_url.url.split(',')[1], 'base64');
    assert.equal(png.readUInt32BE(16), image.width); assert.equal(png.readUInt32BE(20), image.height);
    assert(!JSON.stringify(body).includes('PRIVATE')); assert(!JSON.stringify(body).includes(testKey));
    assert.equal(body.model, testModel); assert.equal(route.request().headers().authorization, 'Bearer ' + testKey);
    calls.push({stage, meta, png});
    if (mode === 'hold-' + stage) { held(); await new Promise(resolve => { release = resolve; }); }
    const headers = {'Access-Control-Allow-Origin':'*'};
    if (mode === 'http-' + stage) { await route.fulfill({status:401, headers, body:'mock-only'}); return; }
    let value;
    if (layout) {
      value = {schema_version:1, image, plane_quad:[{x:.04,y:.06},{x:.97,y:.04},{x:.95,y:.94},{x:.06,y:.96}],
        lane_count:4, lanes:[['active',.18],['empty',.39],['uncertain',.59],['active',.80]]
          .map(([status,x]) => ({status,quad:rect(x-.04,.21,x+.04,.77)}))};
      if (mode === 'undercovered') {
        value.plane_quad=[{x:.23,y:.31},{x:.77,y:.24},{x:.75,y:.84},{x:.22,y:.87}];
        value.lanes[2].quad=rect(.55,.12,.63,.84);
        value.lanes.push({status:'empty',quad:rect(.94,.2,.98,.75)});
        value.lane_count=value.lanes.length;
      }
      if (mode === 'bad-layout') value.plane_quad = null;
    } else {
      const ladder = meta.catalogue[0];
      assert.equal(meta.catalogue.length, 1);
      value = {schema_version:1, image, gel_type:meta.selected_gel_type, markers:[.08,.90].map(x =>
        ({x, ladder_id:ladder.id, candidates:[], bands:[.16,.41,.75].map(y => ({y,size:null}))}))};
      if (mode === 'bad-markers') value.markers[0].x = 2;
      if (mode === 'empty-markers') value.markers = [];
    }
    await route.fulfill({headers, contentType:'application/json', body:JSON.stringify({
      choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}]})});
  });
  const check = async (name, fn) => { await fn(); results.push(['ok','automatic: ' + name]); };
  const open = () => p.locator('#btnAutoFlow').click();
  const choose = id => p.locator('#autoFlowLadder').selectOption(id);
  const drop = (name='PRIVATE_synthetic.tif', count=1) => p.evaluate(({name,count}) => {
    const data = new DataTransfer();
    for (let i=0;i<count;i++) data.items.add(new File([window.autoTestBytes],name,{type:'image/tiff'}));
    document.getElementById('autoFlowDrop').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:data}));
  },{name,count});
  const waitForHold = async start => {
    let timer;
    const arrived = new Promise((resolve,reject) => {
      held=resolve; timer=setTimeout(()=>reject(new Error('Mock request did not arrive')),15000);
    });
    try { await start(); await arrived; } finally { clearTimeout(timer); }
  };
  const error = async () => {
    await p.locator('#autoFlowPage[data-phase="error"]').waitFor();
    return p.locator('#autoFlowStatus').textContent();
  };
  const done = async () => {
    await p.waitForFunction(() => !AutoFlow.active && App.S?.markerRecognition?.workflow === 'automatic',null,{timeout:15000});
    assert(await p.locator('#preview svg [data-edit="marker"]').count() > 0);
  };
  try {
    await p.goto(url);
    await p.waitForFunction(() => window.AutoFlow);
    await p.evaluate(() => {
      const w=241,h=161, data=new Float32Array(w*h);
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const inLane = [.18,.59,.80].some(u => Math.abs(x/w-u)<.029);
        const dark = inLane && [.30,.45,.64].some(v => Math.abs(y/h-v)<.014);
        data[y*w+x] = dark ? .14 : .74+.15*y/h;
      }
      window.autoTestBytes=Demo.encodeTiff16({width:w,height:h,data});
    });
    await check('always-visible entry shows API setup before valid configuration without sending an image', async () => {
      assert.equal(await p.locator('#btnAutoFlow').count(),1);
      assert(await p.locator('#btnAutoFlow').isVisible());
      assert.equal(await p.locator('#btnAutoFlow').getAttribute('data-ready'),'false');
      await open();
      assert(await p.locator('#autoFlowSetup').isVisible());
      assert.equal(calls.length,0);
      await p.locator('#autoFlowBack').click();
      await p.locator('#btnSettings').click();
      await p.locator('#aiEndpoint').fill('http://synthetic.invalid/v1');
      await p.locator('#aiModel').fill(testModel); await p.locator('#aiKey').fill(testKey);
      await p.locator('#aiSaveSettings').click();
      assert.equal(await p.locator('#btnAutoFlow').getAttribute('data-ready'),'false');
      assert(await p.locator('#aiSettingsStatus.error').count());
      await p.locator('#aiEndpoint').fill(api); await p.locator('#aiSaveSettings').click();
      assert(await p.locator('#aiAutoSlot #btnAutoFlow').isVisible());
      assert.equal(await p.locator('#btnAutoFlow').getAttribute('data-ready'),'true');
      await p.locator('#aiSettingsClose').click(); assert(await p.locator('#autoFlowHome #btnAutoFlow').isVisible());
      await open(); assert(!await p.locator('#stage').isVisible());
      assert(!await p.locator('#autoFlowSetup').isVisible());
      assert.equal(calls.length,0);
    });
    await check('drop first, then select a protein ladder to rectify, label and open an editable figure', async () => {
      await drop(); assert.equal(await p.locator('#autoFlowPage').getAttribute('data-phase'),'model');
      assert.equal(await p.evaluate(() => App.S),null); assert.equal(calls.length,0);
      await choose('transgen_dm141'); await done();
      assert.deepEqual(calls.map(c=>c.stage),['layout','markers']);
      assert.equal(calls[0].meta.gel_type,'protein'); assert.equal(calls[1].meta.catalogue[0].id,'transgen_dm141');
      assert.notDeepEqual(calls[0].png,calls[1].png);
      const r=await p.evaluate(async () => {
        const s=App.S, analysis=MarkerAI.analysisImage(), log=JSON.stringify(App.projectData());
        return {visible:s.lanes.filter(l=>!l.hidden).length, hidden:s.lanes[1].hiddenReason,
          kind:s.gelType, labels:s.markers.map(m=>({lane:m.lane,unit:m.unit,model:m.ladderId,pairs:m.bands.map(b=>[b.bp,b.y,b.manual]),
            missing:m.unassignedBands.filter(b=>b.y===null).length})), height:s.perspective.h, source:s.currentSources,
          matchesSource:s.file.sha256===await App.sha256(window.autoTestBytes),
          png:analysis.url, privateConfig:log.includes('synthetic-auto-fixture')||log.includes('synthetic.invalid')};
      });
      assert.equal(r.visible,3); assert.equal(r.hidden,'ai-empty'); assert.equal(r.kind,'protein');
      assert.deepEqual(r.labels.map(m=>m.lane),[0,3]);
      for(const m of r.labels) {
        assert.equal(m.unit,'kDa'); assert.equal(m.model,'transgen_dm141'); assert(m.missing>0);
        assert.deepEqual(m.pairs.map(b=>b[0]),[190,140,95]);
        assert.deepEqual(m.pairs.map(b=>b[1]),[.16,.41,.75].map(y=>y*(r.height-1))); assert(m.pairs.every(b=>!b[2]));
      }
      assert.equal(r.source.lanes,'ai-automatic'); assert(r.matchesSource); assert(!r.privateConfig);
      assert(calls[1].png.equals(Buffer.from(r.png.split(',')[1],'base64')));
      await p.evaluate(() => {
        App.setPref('preflight',false);
        const previous=Export.deliver;
        Export.deliver=(blob,name)=>{ window.autoPng=blob; Export.deliver=previous; return true; };
      });
      await p.locator('#btnPNG').click(); await p.waitForFunction(()=>!!window.autoPng);
      const png=Buffer.from(await p.evaluate(async()=>Array.from(new Uint8Array(await window.autoPng.arrayBuffer()))));
      assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
      assert(png.includes(Buffer.from('ai-automatic'))); assert(!png.includes(Buffer.from(testKey)));
      const before=await p.evaluate(()=>App.snapshot());
      await p.locator('#btnUndo').click(); assert(!await p.evaluate(()=>App.S.perspective));
      await p.locator('#btnRedo').click(); assert.equal(await p.evaluate(()=>App.snapshot()),before);
      assert(await p.locator('#btnGelAIBeta').count()); assert(await p.locator('#btnAIMarker').count());
    });
    await check('an undersized plane expands around active and uncertain lanes and goes straight to marker labelling', async () => {
      mode='undercovered';
      await open(); await choose('dl2000'); const n=calls.length;
      await drop('PRIVATE_coverage.tif');
      await p.waitForFunction(()=>!AutoFlow.active || document.getElementById('autoFlowPage').dataset.phase==='error');
      assert(!await p.evaluate(()=>AutoFlow.active),await p.locator('#autoFlowStatus').textContent());
      await done(); assert.deepEqual(calls.slice(n).map(c=>c.stage),['layout','markers']);
      const q=await p.evaluate(()=>{
        const s=App.S, meta=s.gelAIBeta, inverse=Perspective.mapping(s.perspective.points,true);
        const vertices=[[.14,.21,.22,.77],[.55,.12,.63,.84],[.76,.21,.84,.77]].flatMap(([x0,y0,x1,y1])=>
          [[x0,y0],[x1,y0],[x1,y1],[x0,y1]].map(([x,y])=>inverse(x*(App.rawSrc.w-1),y*(App.rawSrc.h-1))));
        return {vertices, expanded:!!meta.automaticCoverage, kept:meta.uncertainLanesKept, edge:meta.removedEdgeLanes,
          cut:meta.removedInternalLanes, markers:s.markers.length, input:s.file.name};
      });
      assert(q.vertices.every(({x,y})=>x>=-1e-7&&y>=-1e-7&&x<=1+1e-7&&y<=1+1e-7));
      assert(q.expanded);assert.equal(q.kept,1);assert.equal(q.edge,1);assert.equal(q.cut,1);
      assert.equal(q.markers,2);assert.equal(q.input,'PRIVATE_coverage.tif');
      mode='ok';
    });
    await check('coverage respects source borders and preserves feasible perspective directions', async () => {
      const layouts=await p.evaluate(()=>{
        const raw={w:241,h:161}, size={width:241,height:161};
        const rect=(a,b,c,d)=>[{x:a,y:b},{x:c,y:b},{x:c,y:d},{x:a,y:d}];
        function inspect(plane,boxes) {
          const value={schema_version:1,image:size,plane_quad:plane,lane_count:boxes.length,
            lanes:boxes.map((quad,i)=>({status:i===1?'uncertain':'active',quad}))};
          const proposed=GelAIBeta.validate(value,size), before=JSON.stringify(proposed);
          const layout=GelAIBeta.plan(proposed,4,raw), q=layout.spec.points;
          const inverse=Perspective.mapping(q,true), original=Perspective.mapping(proposed.plane,true);
          const uv=proposed.lanes.flatMap(l=>l.quad.map(p=>inverse(p.x,p.y)));
          return {q, original:q.map(p=>original(p.x,p.y)), unchanged:before===JSON.stringify(proposed),
            fits:uv.every(p=>p.x>=-1e-7&&p.x<=1+1e-7&&p.y>=-1e-7&&p.y<=1+1e-7),
            valid:Perspective.valid(q,raw.w,raw.h), expanded:!!layout.meta.automaticCoverage};
        }
        const interior=inspect([{x:.24,y:.30},{x:.77,y:.28},{x:.80,y:.77},{x:.21,y:.80}],
          [rect(.14,.19,.22,.70),rect(.45,.13,.55,.81),rect(.77,.20,.87,.74)]);
        const slant=[{x:.20,y:.34},{x:.79,y:.17},{x:.73,y:.84},{x:.28,y:.94}];
        // For this plane only the top support line crosses the photograph. With the
        // steeper plane, extending to y=0 crosses both lateral borders as well.
        const edgeBoxes=[rect(.14,.19,.22,.70),rect(.45,0,.55,.81),rect(.77,.20,.87,.74)];
        const edge=inspect([{x:.23,y:.27},{x:.77,y:.23},{x:.74,y:.84},{x:.25,y:.80}],edgeBoxes);
        const steepEdge=inspect(slant,edgeBoxes);
        const corners=inspect(slant,[rect(0,0,.22,.70),rect(.45,0,.55,1),rect(.77,.20,1,1)]);
        const covered=inspect(rect(.02,.02,.98,.98),[rect(.14,.19,.22,.70),rect(.45,.13,.55,.81)]);
        return {interior,edge,steepEdge,corners,covered};
      });
      for(const l of Object.values(layouts)) assert(l.fits&&l.valid&&l.unchanged);
      assert(layouts.interior.expanded&&layouts.edge.expanded&&layouts.corners.expanded&&!layouts.covered.expanded);
      const [a,b,c,d]=layouts.interior.original;
      assert(Math.max(Math.abs(a.x-d.x),Math.abs(b.x-c.x),Math.abs(a.y-b.y),Math.abs(c.y-d.y))<1e-7);
      assert(layouts.edge.q[0].y===0 && layouts.edge.q[1].y===0);
      assert(Math.abs(layouts.edge.q[0].x-layouts.edge.q[3].x)>1,'the top border does not require straightening the left edge');
    });
    await check('failed, empty and cancelled responses preserve the preceding project and its undo stack', async () => {
      const old=await p.evaluate(()=>[App.snapshot(),App.projectId,App.hist.slice()]);
      await open(); await choose('dl2000'); const n=calls.length;
      await drop('PRIVATE_two.tif',2); assert.match(await error(),/one gel/); assert.equal(calls.length,n);
      mode='bad-layout'; await drop(); assert.match(await error(),/Lane correction/); assert.equal(calls.length,n+1);
      for(const [idx, m] of ['http-markers','bad-markers','empty-markers'].entries()) {
        mode=m; const start=calls.length; await p.locator('#autoFlowRetry').click(); assert.match(await error(),/Marker labelling/);
        assert.deepEqual(calls.slice(start).map(c=>c.stage), idx===0 ? ['layout','markers'] : ['markers']);
        assert(await p.locator('#autoFlowOpenPartial').isVisible());
        assert.deepEqual(await p.evaluate(()=>[App.snapshot(),App.projectId,App.hist.slice()]), old);
      }
      mode='hold-markers'; await waitForHold(()=>p.locator('#autoFlowRetry').click()); await p.locator('#autoFlowBack').click();
      mode='ok'; release(); await p.waitForFunction(()=>!AutoFlow.active);
      assert.deepEqual(await p.evaluate(()=>[App.snapshot(),App.projectId,App.hist.slice()]),old);
    });
    await check('changing the marker while layout is in flight discards the superseded run', async () => {
      await open(); await choose('transgen_dm141'); mode='hold-layout'; const n=calls.length;
      await waitForHold(()=>drop('PRIVATE_change.tif'));
      mode='ok'; await choose('dl2000'); release(); await done();
      assert.deepEqual(calls.slice(n).map(c=>c.stage),['layout','layout','markers']);
      assert.equal(calls.at(-1).meta.catalogue[0].id,'dl2000');
      assert.equal(await p.evaluate(()=>App.S.file.name),'PRIVATE_change.tif');
      assert(await p.evaluate(()=>App.S.markers.every(m=>m.ladderId==='dl2000')));
    });
    await check('model-first file chooser on a phone viewport supports custom ladders and project round-trip', async () => {
      const model=await p.evaluate(async () => { const m=Ladders.saveCustom('Synthetic three-band model',[800,400,200],'dna'); await Ladders.flush();return m.id; });
      await p.setViewportSize({width:390,height:844}); await p.locator('#btnSettings').click(); await open();
      assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),390);
      await choose(model); const n=calls.length; assert.equal(await p.locator('#autoFlowPage').getAttribute('data-phase'),'image');
      const bytes=Buffer.from(await p.evaluate(async()=>{
        const c=document.createElement('canvas');c.width=241;c.height=161;
        const ctx=c.getContext('2d');ctx.fillStyle='#edf2f5';ctx.fillRect(0,0,c.width,c.height);
        ctx.fillStyle='#36578a';
        for(const x of [43,142,193])for(const y of [48,72,103])ctx.fillRect(x-7,y-1,14,3);
        const blob=await new Promise(resolve=>c.toBlob(resolve,'image/png'));
        return Array.from(new Uint8Array(await blob.arrayBuffer()));
      }));
      await p.locator('#autoFlowFile').setInputFiles({name:'PRIVATE_phone.png',mimeType:'image/png',buffer:bytes});
      await done(); assert.equal(calls.length,n+2); assert.equal(calls.at(-1).meta.catalogue[0].id,model);
      assert.equal(await p.evaluate(()=>Mobile.view()),'fig');
      assert(calls.at(-2).meta.image.colour && calls.at(-1).meta.image.colour);
      assert(await p.evaluate(()=>App.isColour()));
      assert.equal(calls.at(-1).png.toString('base64'),await p.evaluate(()=>MarkerAI.analysisImage().url.split(',')[1]));
      const result=await p.evaluate(async () => {
        const before=App.snapshot(),svg=App.buildFigure(false).svg;
        await App.openProject(await App.projectBlob());
        return {same:before===App.snapshot(),svg:svg.includes('800'),unit:App.S.markers[0].unit,
          mismatch:App.S.markers[0].orderPairing.mismatch};
      });
      assert.deepEqual(result,{same:true,svg:true,unit:'bp',mismatch:false});
      await p.locator('#btnSettings').click(); await p.locator('#aiClearKey').click();
      assert(await p.locator('#btnAutoFlow').isVisible());
      assert.equal(await p.locator('#btnAutoFlow').getAttribute('data-ready'), 'false');
      assert.equal(calls.length,n+2);
    });
    assert.deepEqual(errors,[]);
  } catch (err) {
    results.push(['FAIL','automatic workflow',err.stack + '\n' + await p.locator('#autoFlowStatus').textContent({timeout:1000}).catch(()=> '')]);
  } finally { if(release) release(); await ctx.close(); }
  return results;
}

if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const url=pathToFileURL(fileURLToPath(new URL('../dist/GelFigure.html',import.meta.url))).href+'?lang=en';
  for(const engine of process.argv.slice(2).length?process.argv.slice(2):['chromium','firefox','webkit']){
    const browser=await ({chromium,firefox,webkit}[engine]).launch();
    try { const rows=await autoFlowChecks(browser,url,engine); rows.forEach(row=>console.log(engine,...row)); if(rows.some(r=>r[0]==='FAIL'))process.exitCode=1; }
    finally { await browser.close(); }
  }
}
