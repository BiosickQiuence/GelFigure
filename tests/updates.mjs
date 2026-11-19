import assert from 'node:assert/strict';import path from 'node:path';import fs from 'node:fs';import {pathToFileURL} from 'node:url';
export async function updateChecks(browser,base,root,engine){
 const out=[],ctx=await browser.newContext({viewport:{width:1440,height:960}}),p=await ctx.newPage(),errors=[],remote=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(base))remote.push(r.url());});
 const check=async(name,fn)=>{try{await fn();out.push(['ok','v1 release UI: '+name]);}catch(e){out.push(['FAIL','v1 release UI: '+name,e.stack]);}};
 try{
  await ctx.addInitScript(()=>localStorage.setItem('gelfig.updatesSeen.v1','0.6.12'));
  await p.goto(base+'/index.html?lang=zh');
  await check('current version is 1.1.0 without a legacy update popup or catalogue',async()=>{
   assert.equal(await p.evaluate(()=>App.VERSION),'1.1.0');assert.equal(await p.evaluate(()=>App.BUILD),'v1.1.0');
   assert.equal(await p.locator('#updatesDlg,#updateNotice,#btnUpdates,#btnUpdatesStart,#btnHelpUpdates').count(),0);
   assert.equal(await p.evaluate(()=>typeof window.Updates),'undefined');assert.equal(await p.evaluate(()=>typeof window.GelFigureReleases),'undefined');
   const versions=await p.locator('[data-app-version]').allTextContents();assert(versions.length>=2);assert(versions.every(v=>v==='v1.1.0'));
  });
  await check('both help languages and download links point to this v1 release',async()=>{
   for(const lang of ['zh','en']){
    await p.evaluate(lang=>I18N.set(lang),lang);await p.locator('#btnHelp').click();
    assert(!(await p.locator('#helpDlg').textContent()).includes('0.6.15'));
    const links=await p.locator('#helpDlg a[href*="/releases/download/"]').evaluateAll(items=>items.map(a=>a.href));assert(links.length);assert(links.every(url=>url.includes('BiosickQiuence/GelFigure/releases/download/v1.1.0/GelFigure-v1.1.0.html')));
    await p.evaluate(()=>document.getElementById('helpDlg').classList.add('hidden'));
   }
  });
  await check('phone menu has no history/payment entry and opens the owned repository hub',async()=>{
   await p.setViewportSize({width:390,height:844});await p.locator('#btnMore').click();assert.equal(await p.locator('[data-m="updates"]').count(),0);
   assert((await p.locator('#moreSheet .sheet-foot a').getAttribute('href')).includes('BiosickQiuence/GelFigure'));
   await p.locator('[data-m="community"]').click();assert.equal(await p.locator('#communityChoices a').count(),2);assert.equal(await p.locator('#sponsorDlg,[data-support="sponsor"]').count(),0);await p.keyboard.press('Escape');
  });
  await check('saved projects and processing records identify the new version',async()=>{
   await p.evaluate(async()=>{App.forceJsHash=true;await App.load({name:'synthetic-version.tif',buffer:Demo.encodeTiff16({width:120,height:180,data:new Float32Array(21600).fill(.2)})});});
   const r=await p.evaluate(()=>({project:App.projectData().app,log:Export.processingLog(App.S).app||Export.processingLog(App.S).software||JSON.stringify(Export.processingLog(App.S))}));
   assert(r.project.includes('1.1.0'));assert(String(r.log).includes('1.1.0'));
  });
  await check('the offline artifact contains neither retired UI nor legacy external destinations',async()=>{
   const html=fs.readFileSync(path.join(root,'dist','GelFigure.html'),'utf8');assert(!html.includes('poplarity.github.io'));assert(!html.includes('formsubmit.co'));assert(!html.includes('qr.alipay.com'));assert(!html.includes('0.6.15'));
   const q=await ctx.newPage();await q.goto(pathToFileURL(path.join(root,'dist','GelFigure.html')).href+'?lang=en');assert.equal(await q.evaluate(()=>App.VERSION),'1.1.0');assert.equal(await q.locator('#updatesDlg,#updateNotice,#sponsorDlg').count(),0);await q.close();
  });
  await check('startup and local editing send no external request or page error',async()=>{assert.deepEqual(remote,[]);assert.deepEqual(errors,[]);});
 }finally{await ctx.close();}return out;
}
