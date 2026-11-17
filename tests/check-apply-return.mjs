import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium,firefox,webkit} from 'playwright';
export async function applyReturnChecks(browser,root,engine){
  const ctx=await browser.newContext({viewport:{width:1440,height:1000}}),p=await ctx.newPage(),results=[],errors=[],sent=[];let failure;
  p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(/^https?:/.test(r.url()))sent.push(r.url());});
  const check=async(name,fn)=>{await fn();results.push(['ok','apply return: '+name]);console.log(engine,'PASS',name);};
  const setup=async(method='ai',phone=false)=>{
    await p.setViewportSize(phone?{width:390,height:844}:{width:1440,height:1000});await p.goto(pathToFileURL(path.join(root,'dist/GelFigure.html')).href+'?lang=en');
    await p.evaluate(async method=>{
      App.forceJsHash=true;await App.load({name:'synthetic-return.tif',buffer:Demo.encodeTiff16({width:100,height:120,data:new Float32Array(12000).fill(.15)})});App.setGelType('protein');App.setRotation(0);App.S.crop={x:0,y:0,w:100,h:120};App.S.lanes=[{x:20,name:'M',hidden:false},{x:80,name:'Sample',hidden:false}];App.S.markers=[];App.S.conditions=[];App.S.groups=[];App.S.lanePitch=60;App.commit();const l=Ladders.saveCustom('Synthetic return model',[180,130,100],'protein');
      MarkerAI.captureLocal();MarkerAI.session[method]={method,scope:null,rows:[{x:20,target:0,ladderId:l.id,candidates:[],bands:[{y:20,size:180},{y:60,size:130},{y:100,size:100}],selected:true,edited:true}]};MarkerAI.open();window.preReturn=App.snapshot();
    },method);
  };
  try{
    for(const method of ['ai','local'])await check(method+' application closes comparison and preserves undo',async()=>{
      await setup(method);await p.locator(`[data-apply="${method}"]`).click();assert(!await p.locator('#aiMarkerDlg').isVisible());assert.equal(await p.evaluate(()=>App.S.markers[0].recognition.method),method);await p.evaluate(()=>App.undo());assert.equal(await p.evaluate(()=>App.snapshot()),await p.evaluate(()=>preReturn));
    });
    for(const method of ['ai','local'])await check('phone '+method+' application returns to the figure',async()=>{
      await setup(method,true);await p.locator(`[data-apply="${method}"]`).click();assert(!await p.locator('#aiMarkerDlg').isVisible());assert.equal(await p.evaluate(()=>Mobile.view()),'fig');assert(await p.locator('#preview svg').isVisible());
    });
    await check('validation failures stay visible and do not change the project',async()=>{
      await setup();await p.evaluate(()=>{MarkerAI.session.ai.rows[0].x=-1;});await p.locator('[data-apply="ai"]').click();assert(await p.locator('#aiMarkerDlg').isVisible());assert(await p.locator('#aiStatus').evaluate(e=>e.classList.contains('error')));assert.equal(await p.evaluate(()=>App.snapshot()),await p.evaluate(()=>preReturn));
    });
    await check('stale results remain disabled; reopening retains both drafts without requests',async()=>{
      await setup();await p.evaluate(()=>{App.S.lanes[1].name='changed';App.commit();});assert(await p.locator('[data-apply="ai"]').isDisabled());assert(await p.locator('#aiMarkerDlg').isVisible());await p.locator('#aiClose').click();await p.evaluate(()=>MarkerAI.open());assert(await p.evaluate(()=>!!MarkerAI.session.ai&&!!MarkerAI.session.local));assert.deepEqual(sent,[]);assert.deepEqual(errors,[]);
    });
  }catch(e){failure=e;console.log(engine,'FAIL',e.stack);}finally{await ctx.close();}
  return results.concat(failure?[['FAIL','apply return',failure.stack]]:[]);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const root=fileURLToPath(new URL('..',import.meta.url));let ok=true;
  for(const engine of process.argv.slice(2).length?process.argv.slice(2):['chromium','firefox','webkit']){const b=await ({chromium,firefox,webkit}[engine]).launch();try{ok=(await applyReturnChecks(b,root,engine)).every(r=>r[0]==='ok')&&ok;}finally{await b.close();}}process.exitCode=ok?0:1;
}
