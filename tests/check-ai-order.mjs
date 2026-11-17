/* Selected-size order pairing on synthetic data; no provider request or real gel is used. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium,firefox,webkit} from 'playwright';
export async function aiOrderChecks(browser,root,engine){
  const ctx=await browser.newContext({viewport:{width:1440,height:1000}}),p=await ctx.newPage(),sent=[],errors=[],out=[];let failure=null;const previewDir=path.join(root,'test-results','ai-order-preview',engine+'-'+Date.now());fs.mkdirSync(previewDir,{recursive:true});
  p.on('request',r=>{if(/^https?:/.test(r.url()))sent.push(r.url());});p.on('pageerror',e=>errors.push(e.message));
  const check=async(name,fn)=>{await fn();out.push(name);console.log(engine,'PASS',name);};
  const row=i=>p.locator(`[data-method="ai"][data-row="${i||0}"]`),size=(value,i=0)=>row(i).locator(`[data-ai-order-size="${value}"]`);
  const setup=async(n=9,{unknown=false,multiple=false,kind='protein'}={})=>{
    await p.goto(pathToFileURL(path.join(root,'dist/GelFigure.html')).href+'?lang=zh');
    await p.evaluate(async({n,unknown,multiple,kind})=>{
      App.forceJsHash=true;await App.load({name:'synthetic-order.tif',buffer:Demo.encodeTiff16({width:100,height:600,data:new Float32Array(60000).fill(.15)})});
      App.setGelType(kind);App.setRotation(0);App.S.crop={x:0,y:0,w:100,h:600};App.S.lanes=[{x:20,name:'M',hidden:false},{x:80,name:'Sample',hidden:false}];App.S.markers=[];App.S.conditions=[];App.S.groups=[];App.S.lanePitch=60;App.commit();
      const sizes=kind==='protein'?[180,130,100,72,55,43,37,25,17,8]:[5000,3000,1000,500],lad=Ladders.saveCustom('Synthetic order catalogue',sizes,kind);MarkerAI.captureLocal();const img=MarkerAI.session.image;
      const ys=Array.from({length:n},(_,i)=>(i+1)*32+.125),marker=x=>({x:x/(img.width-1),ladder_id:unknown?null:lad.id,candidates:[],bands:ys.slice().reverse().map(y=>({y:y/(img.height-1),size:null}))});
      MarkerAI.session.ai=MarkerAI.validate({schema_version:1,gel_type:kind,image:{width:img.width,height:img.height},markers:multiple?[marker(20),marker(80)]:[marker(20)]},img,kind);window.orderFixture={ladder:lad.id,sizes,ys:MarkerAI.session.ai.rows[0].bands.map(b=>b.y).sort((a,b)=>a-b)};MarkerAI.open();
    },{n,unknown,multiple,kind});
  };
  const data=()=>p.evaluate(()=>MarkerAI.session.ai.rows[0]);
  const apply=async(overwrite=false)=>p.evaluate(o=>MarkerAI.apply('ai',o),overwrite);
  try{
    await check('all model sizes are selected by default and equal counts pair top-to-bottom / high-to-low',async()=>{
      await setup(10);assert.equal(await row().locator('[data-ai-order-size]').count(),10);assert.equal(await row().locator('[data-ai-order-size]:checked').count(),10);
      const r=await data(),f=await p.evaluate(()=>orderFixture);assert.deepEqual(r.bands.map(b=>b.size),f.sizes);assert.deepEqual(r.bands.map(b=>b.y),f.ys);assert(!await row().locator('.ai-order-status').evaluate(e=>e.classList.contains('is-mismatch')));
    });
    await check('fewer positions leave the smallest selected size unlocated and warn',async()=>{
      await setup(9);const r=await data();assert.equal(r.bands.length,10);assert.deepEqual(r.bands.at(-1),{y:null,size:8,show:false});assert(await row().locator('.ai-order-status').evaluate(e=>e.classList.contains('is-mismatch')));assert((await row().locator('.ai-order-status').textContent()).includes('9'));assert((await row().locator('.ai-order-status').textContent()).includes('10'));await row().locator('.ai-order-panel').scrollIntoViewIfNeeded();await p.screenshot({path:path.join(previewDir,'9positions-10sizes.png')});
    });
    await check('unchecking the run-off 8 kDa band automatically resolves the 9-to-9 match without changing the project',async()=>{
      const before=await p.evaluate(()=>App.snapshot());await size(8).uncheck();const r=await data();assert.equal(r.bands.length,9);assert.deepEqual(r.bands.map(b=>b.size),[180,130,100,72,55,43,37,25,17]);assert.equal(await p.evaluate(()=>App.snapshot()),before);assert(!await row().locator('.ai-order-status').evaluate(e=>e.classList.contains('is-mismatch')));await row().locator('.ai-order-panel').scrollIntoViewIfNeeded();await p.screenshot({path:path.join(previewDir,'9positions-9sizes.png')});
    });
    await check('apply uses the selected sizes exactly, never reads peaks, and records ordered assignment',async()=>{
      await p.evaluate(()=>{window.oldPeaks=App.lanePeaks;App.lanePeaks=()=>{throw new Error('Do not repair AI positions');};});let r;
      try{r=await apply();}finally{await p.evaluate(()=>App.lanePeaks=oldPeaks);}
      assert.equal(r.applied,1);const s=await p.evaluate(()=>({m:App.S.markers[0],ys:orderFixture.ys}));assert.deepEqual(s.m.bands.map(b=>b.y),s.ys);assert.equal(s.m.orderPairing.selectedCount,9);assert.equal(s.m.recognition.sizeAssignment,'selected-order');
    });
    await check('project restore retains the selected-size set instead of resetting it to all',async()=>{
      await p.evaluate(async()=>{await App.openProject(await (await App.projectBlob()).arrayBuffer());MarkerAI.editMarker(0);});assert(!await size(8).isChecked());assert.equal(await row().locator('[data-ai-order-size]:checked').count(),9);
    });
    await check('manual protection and one-step undo still apply to reordered size choices',async()=>{
      const markers=await p.evaluate(()=>JSON.stringify(App.S.markers));await size(17).uncheck();const skipped=await apply();assert.equal(skipped.skipped,1);assert.equal(await p.evaluate(()=>JSON.stringify(App.S.markers)),markers);const before=await p.evaluate(()=>App.snapshot());await apply(true);assert.equal(await p.evaluate(()=>App.S.markers[0].bands.length),8);await p.evaluate(()=>App.undo());assert.equal(await p.evaluate(()=>App.snapshot()),before);
    });
    await check('more AI positions hide only the surplus bottom positions and keep their exact coordinates',async()=>{
      await setup(12);const r=await data();assert.equal(r.bands.length,12);assert(r.bands.slice(10).every(b=>b.size===null&&b.show===false));const ys=await p.evaluate(()=>orderFixture.ys);assert.deepEqual(r.bands.map(b=>b.y),ys);await apply();const m=await p.evaluate(()=>App.S.markers[0]);assert.equal(m.bands.length,10);assert.deepEqual(m.unassignedBands.map(b=>b.y),ys.slice(10));assert.equal(m.orderPairing.extraCount,2);
    });
    await check('mismatch warning survives adoption and is included in the processing log',async()=>{
      await setup(9);await apply();const r=await p.evaluate(()=>({m:App.S.markers[0],log:Export.processingLog(App.S).markers[0]}));assert.equal(r.m.orderPairing.missingCount,1);assert.equal(r.log.sizeSelection.detectedCount,9);assert.equal(r.log.sizeSelection.selectedCount,10);assert((await p.locator('#aiStatus').textContent()).includes('10'));await p.locator('#aiClose').click();assert((await p.locator('#markerList').textContent()).includes('9/10'));
    });
    await check('non-consecutive selected sizes are sorted descending rather than matched by local spacing',async()=>{
      await setup(8);await size(130).uncheck();await size(8).uncheck();const r=await data();assert.deepEqual(r.bands.map(b=>b.size),[180,100,72,55,43,37,25,17]);assert.deepEqual(r.bands.map(b=>b.y),await p.evaluate(()=>orderFixture.ys));
    });
    await check('each marker lane has an independent selection',async()=>{
      await setup(9,{multiple:true});await size(8,0).uncheck();assert(!await size(8,0).isChecked());assert(await size(8,1).isChecked());assert.equal((await p.evaluate(()=>MarkerAI.session.ai.rows[1].bands)).length,10);
    });
    await check('unknown models are not guessed; selecting a model immediately fills the size order',async()=>{
      await setup(9,{unknown:true});assert.equal(await row().locator('[data-ai-order-size]').count(),0);assert((await data()).bands.every(b=>b.size===null));await p.locator('#aiMarkerModel').selectOption(await p.evaluate(()=>orderFixture.ladder));assert.equal(await row().locator('[data-ai-order-size]:checked').count(),10);assert.equal((await data()).bands.filter(b=>b.y!==null&&b.size!==null).length,9);
    });
    await check('select-none preserves every detected position and persists the empty selection',async()=>{
      await row().locator('[data-ai-order-all="none"]').click();assert.equal(await row().locator('[data-ai-order-size]:checked').count(),0);assert((await data()).bands.every(b=>b.size===null&&b.show===false));assert.deepEqual((await data()).bands.map(b=>b.y),await p.evaluate(()=>orderFixture.ys));await apply();await p.evaluate(async()=>{await App.openProject(await (await App.projectBlob()).arrayBuffer());MarkerAI.editMarker(0);});assert.equal(await row().locator('[data-ai-order-size]:checked').count(),0);await row().locator('[data-ai-order-all="all"]').click();assert.equal(await row().locator('[data-ai-order-size]:checked').count(),10);
    });
    await check('per-band label hiding remains a separate display choice and retains calibration',async()=>{
      await setup(9);const ys=(await data()).bands.map(b=>b.y);await row().locator('[data-ai-band-show="0"]').uncheck();assert.deepEqual((await data()).bands.map(b=>b.y),ys);assert.equal(await row().locator('[data-ai-order-size]:checked').count(),10);await apply();assert.equal(await p.evaluate(()=>App.S.markers[0].bands[0].show),false);assert(await p.evaluate(()=>App.estimateInfo(100)!==null));
    });
    await check('manual coordinate edits remain editable; explicit re-pairing keeps the edited coordinates',async()=>{
      await row().locator('[data-ai-band-y="0"]').fill('33.0625');await row().locator('[data-ai-band-y="0"]').dispatchEvent('change');assert.equal((await data()).bands[0].y,33.0625);assert((await data()).orderManual);await row().locator('[data-ai-order-pair]').click();assert.equal((await data()).bands[0].y,33.0625);assert.equal((await data()).orderManual,false);
    });
    await check('a new model resets its selection to all of that model, with surplus positions hidden',async()=>{
      const id=await p.evaluate(()=>Ladders.saveCustom('Synthetic second order',[200,100,50,20],'protein').id);await p.evaluate(()=>MarkerAI.open());await p.locator('#aiMarkerModel').selectOption(id);assert.equal(await row().locator('[data-ai-order-size]:checked').count(),4);const r=await data();assert.deepEqual(r.bands.slice(0,4).map(b=>b.size),[200,100,50,20]);assert(r.bands.slice(4).every(b=>b.size===null&&b.show===false));await p.locator('#aiMarkerModel').selectOption('');assert.equal(await row().locator('[data-ai-order-size]').count(),0);await p.locator('#aiMarkerModel').selectOption(id);assert.equal(await row().locator('[data-ai-order-size]:checked').count(),4);assert.equal((await data()).bands.filter(b=>b.size!==null).length,4);
    });
    await check('DNA uses the same descending rule in bp',async()=>{
      await setup(4,{kind:'dna'});assert.deepEqual((await data()).bands.map(b=>b.size),[5000,3000,1000,500]);assert((await row().locator('.ai-order-panel').textContent()).includes('bp'));
    });
    await check('opening old adopted calibration does not silently replace its existing manual sizes',async()=>{
      await setup(3,{kind:'dna'});await p.evaluate(()=>{const id=orderFixture.ladder;App.S.markers=[{lane:0,ladderId:id,unit:'bp',side:'auto',userAssigned:true,bandMode:'fixed',recognition:{method:'ai',edited:true},bands:orderFixture.ys.map((y,i)=>({bp:[3000,1000,500][i],y,show:true,matched:true,manual:true})),unassignedBands:[]}];App.commit();MarkerAI.editMarker(0);});assert.deepEqual((await data()).bands.map(b=>b.size),[3000,1000,500]);await row().locator('[data-ai-order-pair]').click();assert.deepEqual((await data()).bands.slice(0,3).map(b=>b.size),[5000,3000,1000]);
    });
    await check('stale results disable every size-selection control; phone layout stays within the viewport',async()=>{
      await p.evaluate(()=>{App.S.lanes[1].name='changed';App.commit();});assert(await row().locator('[data-ai-order-size]').first().isDisabled());assert(await row().locator('[data-ai-order-pair]').isDisabled());await p.setViewportSize({width:390,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),390);assert.deepEqual(sent,[]);assert.deepEqual(errors,[]);
      const dir=path.join(root,'test-results','ai-order',engine+'-'+Date.now());fs.mkdirSync(dir,{recursive:true});await p.screenshot({path:path.join(dir,'phone.png')});fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify({engine,checks:out.concat('stale results disable every size-selection control; phone layout stays within the viewport'),requests:sent.length},null,2));
    });
  }catch(e){failure=e;console.log(engine,'FAIL',e.stack);}finally{await ctx.close();}
  return out.map(name=>['ok','AI size order: '+name]).concat(failure?[['FAIL','AI size order',failure.stack]]:[]);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const root=fileURLToPath(new URL('..',import.meta.url));let ok=true;
  for(const engine of process.argv.slice(2).length?process.argv.slice(2):['chromium','firefox','webkit']){const b=await ({chromium,firefox,webkit}[engine]).launch();try{ok=(await aiOrderChecks(b,root,engine)).every(r=>r[0]==='ok')&&ok;}finally{await b.close();}}
  process.exitCode=ok?0:1;
}
