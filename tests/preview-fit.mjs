/* Review-workspace transitions must refit the visible figure without a DPI workaround. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium,firefox,webkit} from 'playwright';

export async function previewFitChecks(browser,root,engine,entry=path.join(root,'dist','GelFigure.html')) {
  const ctx=await browser.newContext({viewport:{width:1440,height:1000}}),p=await ctx.newPage(),results=[],errors=[],requests=[],observations=[];
  const dir=path.join(root,'test-results','preview-fit',engine+'-'+Date.now());fs.mkdirSync(dir,{recursive:true});
  const api='https://preview-fit.gelfigure.invalid/v1/chat/completions';let empty=false;
  p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  await p.route(api,async route=>{
    const meta=JSON.parse(route.request().postDataJSON().messages[1].content[0].text),lad=meta.catalogue[0];
    const value={schema_version:1,gel_type:meta.selected_gel_type,image:{width:meta.image.width,height:meta.image.height},markers:empty?[]:[{x:40/(meta.image.width-1),ladder_id:lad.id,candidates:[],bands:[.2,.4,.6,.8].map((y,i)=>({y,size:lad.sizes[i]}))}]};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}]})});
  });
  const check=async(name,fn)=>{try{await fn();results.push(['ok','Preview fit: '+name]);console.log(engine,'PASS',name);}catch(e){results.push(['FAIL','Preview fit: '+name,e.stack]);console.log(engine,'FAIL',name,e.message);}};
  const settle=()=>p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const metrics=()=>p.evaluate(()=>{
    const svg=document.querySelector('#preview svg'),r=svg.getBoundingClientRect(),box=document.getElementById('previewBox').getBoundingClientRect();
    return {width:r.width,height:r.height,boxWidth:box.width,boxHeight:box.height,dpi:App.S.style.dpi,zoom:UI.figZoom(),snapshot:App.snapshot(),historyLength:App.hist.length,svg:App.buildFigure(false).svg};
  });
  const assertFitted=async(name)=>{
    await settle();const immediate=await metrics();assert(immediate.boxWidth>100&&immediate.boxHeight>100,'The main preview must be visible');
    await p.screenshot({path:path.join(dir,name+'-returned.png')});
    // The user's workaround: reselect the current DPI. It must not change preview geometry.
    await p.evaluate(()=>document.getElementById('dpiTop').dispatchEvent(new Event('change')));await settle();const afterDpi=await metrics();
    observations.push({name,immediate:{width:immediate.width,height:immediate.height,dpi:immediate.dpi,zoom:immediate.zoom},afterDpi:{width:afterDpi.width,height:afterDpi.height,dpi:afterDpi.dpi,zoom:afterDpi.zoom}});
    await p.screenshot({path:path.join(dir,name+'-after-dpi.png')});
    assert.equal(immediate.snapshot,afterDpi.snapshot,'Reselecting the current DPI must not modify the project');
    assert.equal(immediate.svg,afterDpi.svg,'Preview refitting must not alter exported geometry');
    assert(Math.abs(immediate.width-afterDpi.width)<1&&Math.abs(immediate.height-afterDpi.height)<1,`Returned preview ${immediate.width.toFixed(1)} x ${immediate.height.toFixed(1)} px must already match the DPI-refreshed ${afterDpi.width.toFixed(1)} x ${afterDpi.height.toFixed(1)} px`);
  };
  const setup=async()=>{
    empty=false;await p.setViewportSize({width:1440,height:1000});await p.goto(pathToFileURL(entry).href+'?lang=en');
    await p.evaluate(async()=>{
      App.forceJsHash=true;await App.load({name:'synthetic-preview.tif',buffer:Demo.encodeTiff16({width:200,height:400,data:new Float32Array(80000).fill(.18)})});
      App.setRotation(0);App.S.crop={x:0,y:0,w:200,h:400};App.S.lanes=[{x:40,name:'M',hidden:false},{x:140,name:'Sample',hidden:false}];App.S.lanePitch=100;App.S.laneHalfW=20;App.S.markers=[];App.S.style.autoWidth=false;App.S.style.gelWidthMm=45;App.commit();
    });await settle();
  };
  const send=async()=>{
    await p.evaluate(()=>MarkerAI.open());await p.locator('#aiMarkerModel').selectOption('gr1kbplus');
    await p.evaluate(()=>MarkerAI.openSettings());await p.locator('#aiEndpoint').fill(api);await p.locator('#aiModel').fill('synthetic-vision');await p.locator('#aiKey').fill('synthetic-test-only');await p.locator('#aiSettingsClose').click();
    await p.locator('#aiRecognize').click();await p.waitForFunction(()=>!MarkerAI.pending);
    assert(await p.evaluate(()=>!!MarkerAI.session.ai),'Mock recognition must produce a valid result');
  };
  try {
    await check('AI recognition and application immediately restore the full figure without changing DPI',async()=>{
      await setup();await send();await p.locator('[data-apply="ai"]').click();assert(await p.locator('#aiMarkerDlg').isHidden());await assertFitted('ai-apply');
    });
    await check('applying an empty AI result also restores a fitted figure',async()=>{
      await setup();empty=true;await send();await p.locator('[data-apply="ai"]').click();await assertFitted('empty-ai-apply');
    });
    await check('local comparison application uses the same fitted return path',async()=>{
      await setup();await p.evaluate(()=>{MarkerAI.open();MarkerAI.captureLocal();});await p.locator('[data-apply="local"]').click();await assertFitted('local-apply');
    });
    await check('closing Marker review after a hidden-stage refresh refits without committing state',async()=>{
      await setup();await p.evaluate(()=>{MarkerAI.open();App.S.lanes[1].name='Edited while reviewing';App.commit();});
      const before=await metrics();await p.locator('#aiClose').click();await settle();const after=await metrics();assert.equal(after.snapshot,before.snapshot);assert.equal(after.historyLength,before.historyLength);await assertFitted('marker-close');
    });
    await check('Escape after resizing inside review restores the current viewport fit',async()=>{
      await setup();await p.evaluate(()=>MarkerAI.open());await p.setViewportSize({width:1100,height:800});await p.keyboard.press('Escape');await assertFitted('escape-resize');
    });
    await check('the chosen preview zoom and export DPI survive return from review',async()=>{
      await setup();await p.locator('#btnExportMenu').click();await p.locator('#dpiTop').selectOption('300');await p.locator('#btnExportMenu').click();await p.evaluate(()=>UI.setFigZoom(1.5));await send();await p.locator('[data-apply="ai"]').click();
      assert.equal(await p.evaluate(()=>UI.figZoom()),1.5);assert.equal(await p.evaluate(()=>App.S.style.dpi),300);await assertFitted('zoom-and-dpi');
    });
    await check('layout review also refits on return from its shared workspace',async()=>{
      await setup();await p.locator('#btnGelAIBeta').click();await p.evaluate(()=>{App.S.lanes[1].name='Layout refresh';App.commit();});await p.keyboard.press('Escape');await assertFitted('layout-close');
    });
    await check('no page errors or unmocked requests occur',async()=>{assert.deepEqual(errors,[]);assert(requests.every(url=>url===api));});
    fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify({engine,results,observations,mockedRequests:requests.length},null,2));
  } finally {await ctx.close();}
  return results;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const root=fileURLToPath(new URL('..',import.meta.url)),entry=process.argv.find(arg=>arg.startsWith('--entry='))?.slice(8),engines=process.argv.slice(2).filter(arg=>!arg.startsWith('--'));let ok=true;
  for(const engine of engines.length?engines:['chromium','firefox','webkit']) {
    const browser=await ({chromium,firefox,webkit}[engine]).launch();
    try{const checks=await previewFitChecks(browser,root,engine,entry);ok&&=checks.every(row=>row[0]==='ok');}finally{await browser.close();}
  }process.exitCode=ok?0:1;
}
