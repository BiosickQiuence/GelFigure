/* Current import policy and a single shared marker model; synthetic pixels and mocked HTTPS only. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium,firefox,webkit} from 'playwright';

export async function colourMarkerChecks(browser,root,engine,entry=path.join(root,'dist','GelFigure.html')) {
  const results=[],ctx=await browser.newContext({viewport:{width:1440,height:1000}}),p=await ctx.newPage(),errors=[],sent=[];
  const dir=path.join(root,'test-results','colour-marker',engine+'-'+Date.now());fs.mkdirSync(dir,{recursive:true});
  p.on('pageerror',e=>errors.push(e.message));
  const check=async(name,fn)=>{try{await fn();results.push(['ok','Colour/shared marker: '+name]);console.log(engine,'PASS',name);}catch(e){results.push(['FAIL','Colour/shared marker: '+name,e.stack]);console.log(engine,'FAIL',name,e.message);}};
  let hold=null;
  const api='https://colour-marker.gelfigure.invalid/v1/chat/completions';
  await p.route(api,async route=>{
    const body=route.request().postDataJSON(),meta=JSON.parse(body.messages[1].content[0].text);sent.push(meta);
    if(hold)await hold;
    const value={schema_version:1,gel_type:meta.selected_gel_type,image:{width:meta.image.width,height:meta.image.height},markers:[{x:.23,ladder_id:null,candidates:[],bands:[.2,.4,.6,.8].map(y=>({y,size:null}))}]};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}]})}).catch(()=>{});
  });
  const originalEntry=pathToFileURL(entry).href+'?lang=zh';
  const loadBlank=async(blue=false)=>p.evaluate(async blue=>{
    App.forceJsHash=true;const w=100,h=160,n=w*h,rgb=new Uint8Array(n*3);
    for(let i=0;i<n;i++){const value=blue?[55,80,160]:[61+(i%101),61+(i%101),61+(i%101)];rgb.set(value,i*3);}
    const buffer=Export.encodeTiffRGB(rgb,w,h,300,'Synthetic import policy');
    await App.load({name:blue?'synthetic-blue.tif':'synthetic-monochrome.tif',buffer});
    App.setRotation(0);App.renderFull();return {type:App.gelKind(),mode:App.S.displayMode};
  },blue);
  const sourcePixels=()=>p.evaluate(()=>{
    const rot=App.ensureRot(),expected=App.sourceRGB?Colour.toImageData(App.sourceRGB,rot.w,rot.h,App.S.rotation):Engine.toImageData(rot,{black:0,white:1,gamma:1,invert:false});
    App.renderFull();const shown=App.fullCanvas.getContext('2d').getImageData(0,0,rot.w,rot.h);let diff=0;
    for(let i=0;i<shown.data.length;i++)diff=Math.max(diff,Math.abs(shown.data[i]-expected.data[i]));return {diff,log:Export.processingLog(App.S).display};
  });
  try {
    await p.goto(originalEntry);
    await check('blue imports are protein even without detectable lanes, and start in original colour',async()=>{
      const r=await loadBlank(true);assert.equal(r.type,'protein');assert.equal(r.mode,'colour');assert.equal((await sourcePixels()).diff,0);
    });
    await check('a small blue region takes priority over mostly monochrome content',async()=>{
      const r=await p.evaluate(async()=>{
        const width=100,height=160,rgb=new Uint8Array(width*height*3).fill(120);
        for(let i=700;i<900;i++)rgb.set([40,65,140],i*3);
        await App.load({name:'synthetic-localized-blue.tif',buffer:Export.encodeTiffRGB(rgb,width,height,300,'Synthetic sparse blue')});
        return {kind:App.gelKind(),blue:App._colorStats.blueFrac,chroma:App._colorStats.chroma};
      });assert.equal(r.kind,'protein');assert(r.blue>=.005&&r.chroma<.06);
    });
    await check('black-and-white images remain DNA despite protein-like band geometry and protein favourites',async()=>{
      const r=await p.evaluate(async()=>{
        const id=Ladders.all('protein')[0].id;if(!Ladders.isFavorite(id))Ladders.toggleFavorite(id);
        await App.load({name:'synthetic-monochrome-rich.tif',buffer:Demo.encodeTiff16(Demo.makeProteinGel({tilt:0,crowded:true}))});
        const detected=App.gelKind();App.confirmGelType();return {detected,confirmed:App.gelKind(),mode:App.S.displayMode};
      });assert.equal(r.detected,'dna');assert.equal(r.confirmed,'dna');assert.equal(r.mode,'colour');
    });
    await check('original monochrome pixels ignore saved inversion, levels and gamma; gray mode stays opt-in',async()=>{
      await loadBlank(false);await p.evaluate(()=>{App.S.levels={black:.2,white:.7,gamma:2,invert:true};App.commit();});
      const r=await sourcePixels();assert.equal(r.diff,0);assert.equal(r.log.mode,'original-grayscale');assert.equal(r.log.grayscaleAdjustmentsApplied,false);
      assert(await p.locator('[data-display="colour"]').isEnabled());assert(await p.locator('#grayAdjustments').evaluate(e=>e.classList.contains('hidden')));
      await p.evaluate(()=>{App.setDisplayMode('gray');App.commit();});assert((await sourcePixels()).diff>0);
      await p.evaluate(()=>{App.setDisplayMode('colour');App.commit();});assert.equal((await sourcePixels()).diff,0);
    });
    await check('new imports ignore gray lab defaults while saved projects retain explicit gray choices',async()=>{
      await p.evaluate(()=>{const preset=App.styleTemplate('Synthetic gray default');preset.displayMode='gray';App.setPref('stylePreset',preset);});
      await loadBlank(true);assert.equal(await p.evaluate(()=>App.S.displayMode),'colour');
      assert(await p.evaluate(()=>App.hist.every(snapshot=>JSON.parse(snapshot).displayMode==='colour')),'Import undo snapshots must also retain original appearance');
      await p.evaluate(async()=>{App.setDisplayMode('gray');App.commit();await App.openProject(await (await App.projectBlob()).arrayBuffer());});
      assert.equal(await p.evaluate(()=>App.S.displayMode),'gray');
      await p.evaluate(()=>App.setPref('stylePreset',null));
    });
    await check('source pixels and original display survive project restore, rotation, and undo',async()=>{
      await loadBlank(false);const before=await p.evaluate(()=>App.S.file.sha256);
      await p.evaluate(async()=>{App.setRotation(1);App.commit();App.undo();await App.openProject(await (await App.projectBlob()).arrayBuffer());});
      assert.equal(await p.evaluate(()=>App.S.file.sha256),before);assert.equal((await sourcePixels()).diff,0);
    });
    await p.evaluate(async()=>{await App.load({name:'synthetic-dna-marker.tif',buffer:Demo.encodeTiff16(Demo.makeGel({tilt:0}))});MarkerAI.open();});
    await check('one model selector appears above both recognition buttons; result rows contain no duplicate selectors',async()=>{
      assert.equal(await p.locator('#aiMarkerModel').count(),1);
      const bounds=await p.evaluate(()=>['aiMarkerModel','aiLocal','aiRecognize'].map(id=>document.getElementById(id).getBoundingClientRect().top));
      assert(bounds[0]<bounds[1]&&bounds[0]<bounds[2]);assert.equal(await p.locator('[data-edit="ladderId"]').count(),0);
    });
    if(await p.locator('#aiMarkerModel').count()) {
      const model=await p.evaluate(()=>Ladders.saveCustom('Synthetic shared model',Ladders.get('gr1kbplus').sizes,'dna').id);
      await check('local detection uses the selected catalogue model without changing the project',async()=>{
        const snapshot=await p.evaluate(()=>App.snapshot());await p.locator('#aiMarkerModel').selectOption(model);await p.locator('#aiLocal').click();
        const r=await p.evaluate(()=>({rows:MarkerAI.session.local.rows,snapshot:App.snapshot(),model:MarkerAI.session.ladderId}));
        assert.equal(r.model,model);assert(r.rows.length>0,'Synthetic DNA marker must be detected with the selected model');assert(r.rows.every(row=>row.ladderId===model&&row.edited));assert.equal(r.snapshot,snapshot);assert.equal(sent.length,0);
      });
      await p.evaluate(()=>MarkerAI.openSettings());await p.locator('#aiEndpoint').fill(api);await p.locator('#aiModel').fill('synthetic-vision');await p.locator('#aiKey').fill('synthetic-test-only');await p.locator('#aiSettingsClose').click();
      await check('AI receives only the shared model, and unknown returned sizes pair with that same model',async()=>{
        await p.locator('#aiRecognize').click();await p.waitForFunction(()=>!MarkerAI.pending);
        assert.equal(sent.length,1);assert.deepEqual(sent[0].catalogue.map(l=>l.id),[model]);
        const r=await p.evaluate(()=>({local:MarkerAI.session.local.rows.map(row=>row.ladderId),ai:MarkerAI.session.ai?.rows,selected:document.getElementById('aiMarkerModel').value}));
        assert.equal(r.selected,model);assert(r.local.every(id=>id===model));assert(r.ai?.length===1);assert.equal(r.ai[0].ladderId,model);assert.deepEqual(r.ai[0].bands.slice(0,4).map(b=>b.size),[20000,10000,7000,5000]);
      });
      await check('changing the top model updates both drafts, preserves exact AI positions, and makes no request',async()=>{
        const next=await p.evaluate(()=>Ladders.saveCustom('Synthetic alternate model',[9000,6000,3000,1000],'dna').id),ys=await p.evaluate(()=>MarkerAI.session.ai.rows[0].bands.filter(b=>b.y!==null).map(b=>b.y)),count=sent.length;
        await p.locator('#aiMarkerModel').selectOption(next);
        const r=await p.evaluate(()=>({ai:MarkerAI.session.ai.rows[0],local:MarkerAI.session.local.rows}));
        assert.equal(sent.length,count);assert.equal(r.ai.ladderId,next);assert.deepEqual(r.ai.bands.filter(b=>b.y!==null).map(b=>b.y),ys);assert.deepEqual(r.ai.bands.map(b=>b.size),[9000,6000,3000,1000]);assert(r.local.every(row=>row.ladderId===next));
        await p.screenshot({path:path.join(dir,'desktop-shared-marker.png')});
      });
      await check('applying the shared model retains protection, provenance, one-step undo and original source bytes',async()=>{
        const before=await p.evaluate(()=>({snapshot:App.snapshot(),sha:App.S.file.sha256,model:MarkerAI.session.ladderId}));
        await p.evaluate(()=>MarkerAI.apply('ai',true));const adopted=await p.evaluate(()=>({model:App.S.markers[0].ladderId,mode:App.S.markers[0].bandMode,sha:App.S.file.sha256}));
        assert.equal(adopted.model,before.model);assert.equal(adopted.mode,'fixed');assert.equal(adopted.sha,before.sha);
        await p.evaluate(()=>App.undo());assert.equal(await p.evaluate(()=>App.snapshot()),before.snapshot);
      });
      await check('a model change cancels an in-flight AI response, and reruns keep the new shared choice',async()=>{
        await p.evaluate(()=>MarkerAI.captureLocal());let release;hold=new Promise(r=>{release=r;});
        await p.locator('#aiRecognize').click();await p.waitForFunction(()=>MarkerAI.pending);await p.locator('#aiMarkerModel').selectOption(model);release();hold=null;
        await p.waitForFunction(()=>!MarkerAI.pending);assert.equal(await p.evaluate(()=>MarkerAI.session.ladderId),model);assert.equal(await p.evaluate(()=>MarkerAI.session.ai),null);
        await p.locator('#aiRecognize').click();await p.waitForFunction(()=>!MarkerAI.pending);assert.deepEqual(sent.at(-1).catalogue.map(l=>l.id),[model]);
      });
      await check('phone layout and language changes retain the single top selection',async()=>{
        await p.setViewportSize({width:390,height:844});await p.evaluate(()=>I18N.set('en'));
        assert.equal(await p.locator('#aiMarkerModel').inputValue(),model);assert.equal(await p.locator('[data-edit="ladderId"]').count(),0);
        const bounds=await p.locator('#aiMarkerModel').boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=391);
        await p.screenshot({path:path.join(dir,'phone-shared-marker.png')});
      });
    }
    await check('no runtime errors or unmocked service calls',async()=>assert.deepEqual(errors,[]));
    fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify({engine,results,mockedRequests:sent.length},null,2));
  } finally {await ctx.close();}
  return results;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const root=fileURLToPath(new URL('..',import.meta.url)),engines=process.argv.slice(2).filter(a=>!a.startsWith('--'));
  const baseline=process.argv.find(a=>a.startsWith('--entry='))?.slice(8);let ok=true;
  for(const engine of engines.length?engines:['chromium','firefox','webkit']) {
    const browser=await ({chromium,firefox,webkit}[engine]).launch();
    try{const result=await colourMarkerChecks(browser,root,engine,baseline);ok&&=result.every(r=>r[0]==='ok');}finally{await browser.close();}
  }
  process.exitCode=ok?0:1;
}
