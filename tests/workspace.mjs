/* Main-window interactions, bounded previews and portable review artifacts. Synthetic only. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium,firefox,webkit} from 'playwright';
const root=fileURLToPath(new URL('..',import.meta.url));
function unzip(bytes){
  const b=Buffer.from(bytes),files={};let i=0;
  while(b.readUInt32LE(i)===0x04034b50){const length=b.readUInt32LE(i+18),n=b.readUInt16LE(i+26),x=b.readUInt16LE(i+28),name=b.toString('utf8',i+30,i+30+n),start=i+30+n+x;files[name]=b.subarray(start,start+length);i=start+length;}
  return files;
}
export async function workspaceChecks(browser,projectRoot,engine){
  const ctx=await browser.newContext({viewport:{width:1440,height:1000}}),p=await ctx.newPage(),results=[],errors=[],out=path.join(projectRoot,'test-results','workspace',engine+'-'+Date.now());
  fs.mkdirSync(out,{recursive:true});p.on('pageerror',e=>errors.push(e.message));const external=[];p.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url());});
  const check=async(name,fn)=>{try{await fn();results.push(['ok',name]);console.log(engine,'PASS',name);}catch(e){results.push(['fail',name,e.stack]);console.error(engine,'FAIL',name,e.message);}};
  await p.goto(pathToFileURL(path.join(projectRoot,'dist/GelFigure.html')).href+'?lang=en');await p.waitForFunction(()=>window.App);
  const preview=async()=>p.evaluate(()=>{
    GelAIBeta.open();const {width,height}=GelAIBeta.session.image,q=(a,b,c,d)=>[{x:a,y:b},{x:c,y:b},{x:c,y:d},{x:a,y:d}];
    const v={schema_version:1,image:{width,height},plane_quad:q(0,0,1,1),lane_count:6,lanes:Array.from({length:6},(_,i)=>({status:i===2?'uncertain':'active',quad:q(.07+i*.145,.18,.14+i*.145,.82)}))};GelAIBeta.showPreview(v);
  });
  try{
    await check('settings open from the top right before importing or sending any image',async()=>{
      await p.locator('#btnSettings').click();assert(await p.locator('#aiSettingsPanel').isVisible());assert.equal(await p.locator('#aiEndpoint').evaluate(e=>e.closest('#aiMarkerDlg')),null);
      await p.locator('#aiEndpoint').fill('https://synthetic.invalid/v1');await p.locator('#aiModel').fill('synthetic');await p.locator('#aiKey').fill('synthetic-only-secret');await p.locator('#btnLang').click();assert.equal(await p.locator('#aiKey').inputValue(),'synthetic-only-secret');assert.equal(await p.locator('#aiEndpoint').inputValue(),'https://synthetic.invalid/v1');await p.locator('#btnLang').click();await p.locator('#aiSaveSettings').click();
      await p.screenshot({path:path.join(out,'settings.png')});await p.keyboard.press('Escape');assert(await p.locator('#btnSettings').evaluate(e=>e===document.activeElement));assert.equal(external.length,0);await p.evaluate(async()=>{App.forceJsHash=true;await App.load({name:'demo-synthetic.tif',buffer:Demo.encodeTiff16(Demo.makeGel())});});
    });
    await check('AI tasks are inline regions and keep navigation in the same window',async()=>{
      await preview();await p.waitForFunction(()=>document.getElementById('layoutInput').width>200);
      assert.equal(await p.locator('#gelLayoutDlg').getAttribute('role'),'region');assert.equal(await p.locator('#gelLayoutDlg').getAttribute('aria-modal'),null);assert(await p.locator('.topbar').isVisible());assert.equal(ctx.pages().length,1);
      await p.screenshot({path:path.join(out,'layout-desktop.png')});
    });
    await check('zoom and pan preserve source coordinates, project state and API call count',async()=>{
      const before=await p.evaluate(()=>({draft:JSON.stringify(GelAIBeta.session.proposal),state:App.snapshot()}));
      await p.locator('#layoutZoomIn').click();await p.locator('#layoutZoomIn').click();assert.notEqual(await p.locator('#layoutZoomLabel').textContent(),'100%');
      const r=await p.locator('#layoutInput').boundingBox();await p.locator('#layoutPan').click();await p.mouse.move(r.x+r.width/2,r.y+r.height/2);await p.mouse.down();await p.mouse.move(r.x+r.width/2+33,r.y+r.height/2+21,{steps:3});await p.mouse.up();
      assert.deepEqual(await p.evaluate(()=>({draft:JSON.stringify(GelAIBeta.session.proposal),state:App.snapshot()})),before);assert.equal(external.length,0);await p.locator('#layoutPan').click();await p.locator('#layoutFit').click();
    });
    await check('selected source corner nudges exactly one pixel after zoom, with local undo',async()=>{
      await p.locator('#layoutFit').click();
      const q=await p.evaluate(()=>{const cv=document.getElementById('layoutInput'),r=cv.getBoundingClientRect(),im=GelAIBeta.session.image,s=Math.min((cv.width-32)/(im.width-1),(cv.height-32)/(im.height-1));return {x:r.left+(cv.width-(im.width-1)*s)/2*r.width/cv.width,y:r.top+(cv.height-(im.height-1)*s)/2*r.height/cv.height};});
      const before=await p.evaluate(()=>GelAIBeta.session.proposal.plane[0].x);await p.mouse.click(q.x,q.y);await p.keyboard.press('ArrowRight');assert(Math.abs(await p.evaluate(()=>GelAIBeta.session.proposal.plane[0].x)-before-1)<1e-7);
      await p.locator('#layoutUndo').click();assert.equal(await p.evaluate(()=>GelAIBeta.session.proposal.plane[0].x),before);
    });
    await check('delete first, middle and last locations then edit remaining rows without index drift',async()=>{
      for(const position of ['first','middle','last']){
        await preview();const count=await p.locator('[data-layout-row]').count(),i=position==='first'?0:position==='last'?count-1:2;
        const ids=await p.evaluate(()=>GelAIBeta.session.proposal.lanes.map(l=>l.sourceIndex));await p.locator(`[data-layout-remove="${i}"]`).click();
        assert.equal(await p.locator('[data-layout-row]').count(),count-1);assert.deepEqual(await p.evaluate(()=>GelAIBeta.session.proposal.lanes.map(l=>l.sourceIndex)),ids.filter((_,k)=>k!==i));
        await p.locator('[data-layout-status]').last().selectOption('uncertain');assert.equal(await p.evaluate(()=>GelAIBeta.session.proposal.lanes.at(-1).status),'uncertain');
        await p.locator('#layoutUndo').click();await p.locator('#layoutUndo').click();assert.equal(await p.locator('[data-layout-row]').count(),count);
      }
    });
    await check('preview samples are bounded by display size and application confirmation stays inline',async()=>{
      await preview();const r=await p.evaluate(()=>{const warp=Perspective.warp,seen=[];Perspective.warp=(img,spec,rgb)=>{seen.push([spec.w,spec.h]);return warp(img,spec,rgb);};try{document.getElementById('layoutMargin').dispatchEvent(new Event('change'));}finally{Perspective.warp=warp;}return seen;});
      assert(r.length>0);assert(r.every(([w,h])=>w<=900&&h<=520));const state=await p.evaluate(()=>App.snapshot());await p.locator('#layoutApply').click();assert(await p.locator('#layoutConfirm').isVisible());assert.equal(await p.evaluate(()=>App.snapshot()),state);await p.locator('#layoutConfirmCancel').click();
    });
    await check('phone review retains a reachable footer, no page overflow and input/output switching',async()=>{
      await p.setViewportSize({width:390,height:844});await p.locator('#layoutFit').click();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),390);
      const r=await p.locator('#layoutApply').boundingBox();assert(r.y>=0&&r.y+r.height<=844);await p.locator('#layoutOutputTab').click();assert(await p.locator('#layoutOutput').isVisible());await p.locator('#layoutInputTab').click();await p.screenshot({path:path.join(out,'layout-phone.png')});
      await p.locator('#layoutClose').click();await p.evaluate(()=>MarkerAI.open());await p.locator('#aiLocal').click();assert.equal(await p.locator('#aiMarkerDlg').getAttribute('role'),'region');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),390);await p.screenshot({path:path.join(out,'marker-phone.png')});await p.locator('#aiClose').click();await p.setViewportSize({width:1440,height:1000});
    });
    await check('appearance presets contain no sample data and apply consistently to two images',async()=>{
      const r=await p.evaluate(async()=>{
        App.S.lanes[0].name='PRIVATE SAMPLE';App.S.style.fontFamily='Cambria';App.S.style.fontPt=8;App.S.style.lineWidthPt=.75;App.S.style.autoWidth=false;App.S.style.gelWidthMm=65;App.commit();
        const preset=App.styleTemplate('Lab A'),json=JSON.stringify(preset),records=[];
        for(const maker of [Demo.makeGel,Demo.makeProteinGel]){const gel=maker();await App.load({name:'synthetic.tif',buffer:Demo.encodeTiff16(gel)});const names=App.S.lanes.map(l=>l.name);App.applyStyleTemplate(preset);records.push({style:App.S.style,namesUnchanged:JSON.stringify(names)===JSON.stringify(App.S.lanes.map(l=>l.name))});}
        return {records,noPrivate:!json.includes('PRIVATE'),noPixels:!('lanes'in preset)&&!('source'in preset)};
      });assert(r.noPrivate&&r.noPixels);assert.deepEqual(r.records[0].style,r.records[1].style);assert(r.records.every(r=>r.namesUnchanged));
    });
    await check('review ZIP hashes original bytes, reopens its project and excludes API credentials',async()=>{
      const r=await p.evaluate(async()=>{const before=App.snapshot(),original=App.S.file.sha256,svg=App.buildFigure(false).svg;const b=await Export.reviewPackage(App.S,'svg');return {before,original,svg,same:before===App.snapshot(),bytes:[...new Uint8Array(await b.arrayBuffer())]};});
      assert(r.same);const files=unzip(r.bytes),manifest=JSON.parse(files['manifest.json']);assert.equal(manifest.sourceSha256,r.original);assert.equal(manifest.files.length,6);assert(String(files['cover.html']).includes('#C8962E'));
      for(const f of manifest.files)assert.equal(createHash('sha256').update(files[f.name]).digest('hex'),f.sha256);
      assert.equal(files['figure.svg'].toString(),r.svg);const project=files['project.gelfig'];await p.evaluate(async bytes=>App.openProject(Uint8Array.from(bytes).buffer),[...project]);assert.equal(await p.evaluate(()=>App.buildFigure(false).svg),r.svg);
      assert(!Buffer.from(r.bytes).includes(Buffer.from('synthetic-only-secret')));assert(!Buffer.from(r.bytes).includes(Buffer.from('https://synthetic.invalid')));fs.writeFileSync(path.join(out,'synthetic-review.zip'),Buffer.from(r.bytes));
    });
    await check('processing logs distinguish decoded, analysis and output dimensions after rotation',async()=>{
      const r=await p.evaluate(()=>{const raw=[App.rawSrc.w,App.rawSrc.h];App.setOrient('r90');const log=Export.processingLog(App.S);return {raw,source:[log.source.width,log.source.height],analysis:log.dimensions.analysis,actual:{width:App.rot.w,height:App.rot.h}};});assert.deepEqual(r.source,r.raw);assert.deepEqual(r.analysis,r.actual);
    });
    await check('no external requests or unhandled exceptions from local workflows',async()=>{assert.deepEqual(errors,[]);assert.deepEqual(external,[]);});
  }finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({engine,results,errors,external},null,2));await ctx.close();}
  return results;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  let good=true;for(const engine of process.argv.slice(2).length?process.argv.slice(2):['chromium','firefox','webkit']){
    const browser=await ({chromium,firefox,webkit}[engine]).launch();try{const r=await workspaceChecks(browser,root,engine);good&&=r.every(x=>x[0]==='ok');}finally{await browser.close();}
  }if(!good)process.exitCode=1;
}
