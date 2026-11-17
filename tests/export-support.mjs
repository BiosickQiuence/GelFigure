import assert from 'node:assert/strict';
export async function exportSupportChecks(browser,base){
 const out=[],ctx=await browser.newContext({viewport:{width:1440,height:960}}),p=await ctx.newPage(),errors=[],requests=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(base))requests.push(r.url());});
 const check=async(name,fn)=>{try{await fn();out.push(['ok','export GitHub links: '+name]);}catch(e){out.push(['FAIL','export GitHub links: '+name,e.stack]);}};
 try{
  await p.goto(base+'/index.html?lang=en');await p.evaluate(async()=>{App.forceJsHash=true;await App.load({name:'synthetic-export.tif',buffer:Demo.encodeTiff16({width:160,height:240,data:new Float32Array(38400).fill(.2)})});App.setPref('preflight',false);});
  await check('a failed export does not show a success reminder',async()=>{
   const r=await p.evaluate(async()=>{const old=Export.exportSVG,alert=window.alert;let caught=false;window.alert=()=>{};Export.exportSVG=()=>{throw new Error('Synthetic export failure');};try{await document.getElementById('btnSVG').onclick();}catch(_){caught=true;}finally{Export.exportSVG=old;window.alert=alert;}return {caught,hidden:document.getElementById('exportThanks').classList.contains('hidden')};});assert(r.caught&&r.hidden);
  });
  await check('successful export downloads normally and offers owned GitHub links without payments',async()=>{
   const download=p.waitForEvent('download');await p.evaluate(()=>document.getElementById('btnSVG').click());assert((await download).suggestedFilename().endsWith('.svg'));await p.waitForSelector('#exportThanks:not(.hidden)');
   const links=await p.locator('#exportThanks [data-support]').evaluateAll(items=>items.map(a=>a.href));assert.deepEqual(links,['https://github.com/BiosickQiuence/GelFigure/issues/new/choose','https://github.com/BiosickQiuence/GelFigure']);assert.equal(await p.locator('#sponsorDlg,[data-support="sponsor"]').count(),0);
   await p.locator('#exportThanks .support-close').click();assert(await p.locator('#exportThanks').isHidden());
  });
  await check('phone export retains save controls and the two explicit GitHub links',async()=>{
   const before=await p.evaluate(()=>App.snapshot());await p.setViewportSize({width:390,height:844});await p.waitForFunction(()=>UI.isPhone());await p.evaluate(()=>document.getElementById('btnSVG').click());await p.waitForSelector('#resultSheet:not(.hidden)');assert(await p.locator('#rsSave').isVisible());assert.equal(await p.locator('#exportThanksMobile [data-support]').count(),2);assert.equal(await p.locator('#exportThanksMobile [data-support="sponsor"]').count(),0);assert.equal(await p.evaluate(()=>App.snapshot()),before);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),390);assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);
  });
 }finally{await ctx.close();}return out;
}
