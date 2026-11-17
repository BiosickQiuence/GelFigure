/* Synthetic fixed-coordinate data tests visibility/editing; no vision service is called. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium,firefox,webkit} from 'playwright';
export async function aiBandControlChecks(browser,root,engine){
  let failure=null;const ctx=await browser.newContext({viewport:{width:1440,height:1000}}),p=await ctx.newPage(),sent=[],errors=[],results=[];
  p.on('request',r=>{if(/^https?:/.test(r.url()))sent.push(r.url());});p.on('pageerror',e=>errors.push(e.message));
  const check=async(name,fn)=>{await fn();results.push(name);console.log(engine,'PASS',name);};
  const setup=async(unknown=false)=>{
    await p.goto(pathToFileURL(path.join(root,'dist/GelFigure.html')).href+'?lang=en');
    await p.evaluate(async unknown=>{
      App.forceJsHash=true;await App.load({name:'synthetic-band-controls.tif',buffer:Demo.encodeTiff16({width:100,height:500,data:new Float32Array(50000).fill(.15)})});
      App.setGelType('protein');App.setRotation(0);App.S.crop={x:0,y:0,w:100,h:500};App.S.lanes=[{x:20,name:'M',hidden:false},{x:80,name:'Sample',hidden:false}];App.S.markers=[];App.S.groups=[];App.S.conditions=[];App.S.lanePitch=60;App.commit();
      const sizes=[180,130,100,72,55,43,37,25,17,8],lad=Ladders.saveCustom('Synthetic 10 band protein',sizes,'protein');
      MarkerAI.captureLocal();const img=MarkerAI.session.image,ys=[20.125,40.25,65.375,100.5,145.625,190.75,245.875,320.0625,410.1875];
      MarkerAI.session.ai=MarkerAI.validate({schema_version:1,gel_type:'protein',image:{width:img.width,height:img.height},markers:[{x:20/(img.width-1),ladder_id:unknown?null:lad.id,candidates:[],bands:ys.map((y,i)=>({y:y/(img.height-1),size:unknown?null:sizes[i]})).concat(unknown?[]:[{y:null,size:8}])}]},img,'protein');
      window.fixtureLadder=lad.id;window.fixtureYs=MarkerAI.session.ai.rows[0].bands.map(b=>b.y);MarkerAI.open();
    },unknown);
  };
  const row=()=>p.locator('[data-method="ai"][data-row="0"]');
  const summary=()=>row().locator('.ai-band-summary');
  const show=i=>row().locator(`[data-ai-band-show="${i}"]`);
  const size=i=>row().locator(`[data-ai-band-size="${i}"]`);
  try{
    await setup();
    await check('known sizes have checkboxes; an unlocated missing band stays disabled',async()=>{
      assert.equal(await row().locator('[data-ai-band-show]').count(),10);for(let i=0;i<9;i++){assert(await show(i).isChecked());assert(!await show(i).isDisabled());}assert(await show(9).isDisabled());assert(!await show(9).isChecked());
    });
    const before=await p.evaluate(()=>App.snapshot()),ys=await p.evaluate(()=>fixtureYs);
    await check('visibility preview does not mutate the project or move AI positions',async()=>{
      await show(0).uncheck();assert.equal(await p.evaluate(()=>App.snapshot()),before);assert.deepEqual(await p.evaluate(()=>MarkerAI.session.ai.rows[0].bands.map(b=>b.y)),ys);assert((await summary().textContent()).includes('8'));
    });
    let estimate;
    await check('application hides only the label, retains calibration and never calls peak matching',async()=>{
      await p.evaluate(()=>{window.savedPeaks=App.lanePeaks;App.lanePeaks=()=>{throw new Error('Fixed bands must not match local peaks');};});
      try{await p.locator('[data-apply="ai"]').click();await p.evaluate(()=>MarkerAI.open());}finally{await p.evaluate(()=>App.lanePeaks=savedPeaks);}
      const r=await p.evaluate(()=>{const m=App.S.markers[0],svg=App.buildFigure(false).svg,doc=new DOMParser().parseFromString(svg,'image/svg+xml');return {show:m.bands.find(b=>b.bp===180).show,bands:m.bands.length,ys:m.bands.map(b=>b.y),texts:[...doc.querySelectorAll('text')].map(t=>t.textContent),estimate:App.estimateInfo(100)?.bp};});
      assert.equal(r.show,false);assert.equal(r.bands,9);assert.deepEqual(r.ys,ys.slice(0,9));assert(!r.texts.includes('180'));assert(r.texts.includes('130'));assert(Number.isFinite(r.estimate));estimate=r.estimate;
    });
    await check('one undo restores the pre-application project; redo restores the visibility choice',async()=>{
      await p.evaluate(()=>App.undo());assert.equal(await p.evaluate(()=>App.snapshot()),before);await p.evaluate(()=>App.redo());assert.equal(await p.evaluate(()=>App.S.markers[0].bands.find(b=>b.bp===180).show),false);
    });
    await check('project restoration and reopening the editor retain unchecked sizes',async()=>{
      await p.evaluate(async()=>{App.S.markers[0].bands[1].color='red';App.commit();await App.openProject(await (await App.projectBlob()).arrayBuffer());MarkerAI.editMarker(0);});assert(!await show(0).isChecked());assert(await show(9).isDisabled());
    });
    await check('show-all and hide-all keep missing bands unresolved and all calibration points intact',async()=>{
      await row().locator('[data-ai-band-all="show"]').click();for(let i=0;i<9;i++)assert(await show(i).isChecked());assert(!await show(9).isChecked());
      await row().locator('[data-ai-band-all="hide"]').click();for(let i=0;i<9;i++)assert(!await show(i).isChecked());await p.locator('#aiOverwrite').check();await p.locator('[data-apply="ai"]').click();await p.evaluate(()=>MarkerAI.open());
      const r=await p.evaluate(()=>({allHidden:App.S.markers[0].bands.every(b=>!b.show),n:App.S.markers[0].bands.length,e:App.estimateInfo(100)?.bp,color:App.S.markers[0].bands[1].color}));assert(r.allHidden);assert.equal(r.n,9);assert.equal(r.e,estimate);assert.equal(r.color,'red');
    });
    await check('unknown model stays unresolved; selecting a model automatically orders its sizes',async()=>{
      await setup(true);for(let i=0;i<9;i++)assert(await show(i).isDisabled());const id=await p.evaluate(()=>fixtureLadder);await p.locator('#aiMarkerModel').selectOption(id);
      assert.deepEqual(await p.evaluate(()=>MarkerAI.session.ai.rows[0].bands.map(b=>b.size)),[180,130,100,72,55,43,37,25,17,8]);assert(await show(0).isChecked());assert(!await show(0).isDisabled());assert(!await show(1).isDisabled());assert(await show(9).isDisabled());
    });
    await check('editing a size or coordinate preserves visibility and leaves other positions unchanged',async()=>{
      await show(0).uncheck();await row().locator('[data-ai-band-y="0"]').fill('21.0625');await row().locator('[data-ai-band-y="0"]').dispatchEvent('change');assert(!await show(0).isChecked());assert.equal(await p.evaluate(()=>MarkerAI.session.ai.rows[0].bands[0].y),21.0625);assert.deepEqual(await p.evaluate(()=>MarkerAI.session.ai.rows[0].bands.slice(1).map(b=>b.y)),ys.slice(1));
    });
    await check('advanced text editing preserves unchanged visibility choices and keeps the table synchronized',async()=>{
      await row().locator('.ai-band-text summary').click();const input=row().locator('[data-edit="bands"]'),text=await input.inputValue();await input.fill(text+'\n?, ?');await input.dispatchEvent('change');assert(!await show(0).isChecked());assert.equal(await row().locator('[data-ai-band-show]').count(),11);assert(await show(10).isDisabled());
    });
    await check('manual protection still blocks overwrite until explicitly enabled',async()=>{
      await p.locator('[data-apply="ai"]').click();await p.evaluate(()=>MarkerAI.open());await show(0).check();await p.locator('[data-apply="ai"]').click();await p.evaluate(()=>MarkerAI.open());assert.equal(await p.evaluate(()=>App.S.markers[0].bands[0].show),false);await p.locator('#aiOverwrite').check();await p.locator('[data-apply="ai"]').click();await p.evaluate(()=>MarkerAI.open());assert.equal(await p.evaluate(()=>App.S.markers[0].bands[0].show),true);
    });
    await check('stale comparison disables its visibility and size controls',async()=>{
      await p.evaluate(()=>{App.S.lanes[1].name='changed';App.commit();});assert(await show(0).isDisabled());assert(await size(0).isDisabled());assert(await p.locator('[data-apply="ai"]').isDisabled());
    });
    await check('phone layout fits and all work stays local with no page exceptions',async()=>{
      await p.setViewportSize({width:390,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),390);assert.deepEqual(sent,[]);assert.deepEqual(errors,[]);
      const dir=path.join(root,'test-results','ai-band-controls',engine+'-'+Date.now());fs.mkdirSync(dir,{recursive:true});await p.screenshot({path:path.join(dir,'phone.png')});await p.setViewportSize({width:1440,height:1000});await p.screenshot({path:path.join(dir,'desktop.png')});fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify({engine,checks:results.concat('phone layout fits and all work stays local with no page exceptions'),requests:sent.length},null,2));
    });
  }catch(e){failure=e;console.log(engine,'FAIL',e.stack);}finally{await ctx.close();}
  return results.map(name=>['ok','AI band controls: '+name]).concat(failure?[['FAIL','AI band controls',failure.stack]]:[]);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const root=fileURLToPath(new URL('..',import.meta.url));let ok=true;
  for(const engine of process.argv.slice(2).length?process.argv.slice(2):['chromium','firefox','webkit']){
    const browser=await ({chromium,firefox,webkit}[engine]).launch();try{const out=await aiBandControlChecks(browser,root,engine);ok&&=out.every(r=>r[0]==='ok');}finally{await browser.close();}
  }process.exitCode=ok?0:1;
}
