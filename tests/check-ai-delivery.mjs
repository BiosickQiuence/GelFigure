/* Check the actual standalone deliverable, including credential isolation in encoded exports. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
const root=fileURLToPath(new URL('..',import.meta.url)),html=path.resolve(process.argv[2]||path.join(root,'dist/GelFigure.html'));
const dir=path.join(root,'test-results','ai-delivery',new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch(),context=await browser.newContext({locale:'zh-CN',viewport:{width:1440,height:1000}}),page=await context.newPage();
const API='https://delivery.gelfigure.invalid/v1/chat/completions',secret='delivery-test-only-credential',seen=[],errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))seen.push(r.url());});
await page.route(API,async route=>{
  const b=route.request().postDataJSON(),meta=JSON.parse(b.messages[1].content[0].text),lad=meta.catalogue[0];
  assert.equal(b.model,'delivery-mock');assert.equal(route.request().headers().authorization,'Bearer '+secret);
  const value={schema_version:1,gel_type:meta.selected_gel_type,image:{width:meta.image.width,height:meta.image.height},markers:[{x:.12,ladder_id:lad.id,candidates:[],bands:[{y:.21345,size:lad.sizes[0]},{y:.45123,size:lad.sizes[1]}]}]};
  await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}]})});
});
try{
  await page.goto(pathToFileURL(html).href+'?demo=1&lang=zh');await page.waitForFunction(()=>document.title.startsWith('READY '),null,{timeout:120000});
  await page.locator('#btnAIMarker').click();assert((await page.locator('#aiMarkerTitle').textContent()).includes('试用'));assert.deepEqual(seen,[]);checks.push('Chinese standalone UI starts without any HTTP request');
  await page.evaluate(()=>MarkerAI.openSettings());await page.locator('#aiEndpoint').fill(API.replace('/chat/completions',''));await page.locator('#aiModel').fill('delivery-mock');await page.locator('#aiKey').fill(secret);await page.locator('#aiSettingsClose').click();await page.locator('#aiRecognize').click();await page.waitForFunction(()=>!MarkerAI.pending);assert(await page.evaluate(()=>!!MarkerAI.session.ai));assert.deepEqual(seen,[API]);checks.push('Explicit single-file recognition sends one request to the configured base URL');
  await page.locator('[data-apply="ai"]').click();assert(await page.evaluate(()=>App.S.markers.some(m=>m.recognition?.method==='ai')));checks.push('Single-file validated AI preview applies successfully');
  const result=await page.evaluate(async()=>{
    const f=App.buildFigure(false),blobs=[],pending=[];
    Export.deliver=(blob,name)=>{pending.push(blob.arrayBuffer().then(b=>blobs.push({name,bytes:new Uint8Array(b)})));return true;};
    await Export.exportPNG(f.svg,f.w,f.h,150,'synthetic-ai.png',App.S);
    await Export.exportTIFF(f.svg,f.w,f.h,150,'synthetic-ai.tif',App.S);
    Export.exportSVG(f.svg,'synthetic-ai.svg');const pptx=await PPTX.build();pending.push(pptx.arrayBuffer().then(b=>blobs.push({name:'synthetic-ai.pptx',bytes:new Uint8Array(b)})));await Promise.all(pending);
    const artifacts=blobs.map(b=>({name:b.name,length:b.bytes.length,text:new TextDecoder().decode(b.bytes)}));
    const project=JSON.stringify(App.projectData()),log=JSON.stringify(Export.processingLog(App.S));
    return {artifacts,project,log,stored:localStorage.getItem('gelfig.ai-marker.key')};
  });
  assert.equal(result.artifacts.length,4);assert.equal(result.stored,null);
  for(const a of [...result.artifacts,{name:'project',text:result.project},{name:'log',text:result.log}]){
    assert(!a.text.includes(secret),a.name+' must not include key');assert(!a.text.includes('delivery.gelfigure.invalid'),a.name+' must not include endpoint');assert(!a.text.includes('delivery-mock'),a.name+' must not include model settings');
  }
  assert(result.artifacts.every(a=>a.length>100));checks.push('Encoded PNG, TIFF, SVG, PPTX, project and processing log contain no key or API settings');
  assert(!await page.locator('#aiMarkerDlg').isVisible());await page.locator('#btnLang').click();await page.evaluate(()=>MarkerAI.open());assert((await page.locator('#aiMarkerTitle').textContent()).includes('review'));assert(await page.evaluate(()=>!!MarkerAI.session.ai&&!!MarkerAI.session.local));checks.push('Language change retains both comparison drafts and translates the dialog');
  await page.screenshot({path:path.join(dir,'standalone-comparison.png'),fullPage:true});
  assert.deepEqual(errors,[]);assert.deepEqual(seen,[API]);checks.push('Exports, application and language change do not send further recognition requests');
  const report={html,browser:browser.version(),checks,artifacts:result.artifacts.map(({name,length})=>({name,bytes:length})),requestCount:seen.length,accuracyClaim:false};
  fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await context.close();await browser.close();}
