import assert from 'node:assert/strict';
export async function feedbackChecks(browser,base,root,engine){
 const out=[],ctx=await browser.newContext({viewport:{width:1440,height:1000}}),p=await ctx.newPage(),errors=[],requests=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(base))requests.push(r.url());});
 const check=async(name,fn)=>{try{await fn();out.push(['ok','GitHub feedback: '+name]);}catch(e){out.push(['FAIL','GitHub feedback: '+name,e.stack]);}};
 try{
  await p.goto(base+'/index.html?lang=en');
  await check('persistent hub offers only this repository feedback and Star before import',async()=>{
   await p.locator('#btnCommunity').click();const links=await p.locator('#communityChoices a').evaluateAll(items=>items.map(a=>({href:a.href,rel:a.rel,target:a.target})));
   assert.deepEqual(links.map(a=>a.href),['https://github.com/BiosickQiuence/GelFigure/issues/new/choose','https://github.com/BiosickQiuence/GelFigure']);assert(links.every(a=>a.target==='_blank'&&a.rel.includes('noopener')&&a.rel.includes('noreferrer')));
   assert.equal(await p.locator('#feedbackForm,#feedbackDlg,#sponsorDlg,[data-support="sponsor"]').count(),0);
  });
  await check('feedback opens an issue composer only on click, without submitting any data',async()=>{
   await p.evaluate(()=>{window.openedLinks=[];window.open=(...args)=>{openedLinks.push(args);return null;};});
   await p.locator('#communityChoices [data-support="feedback"]').click();const opened=await p.evaluate(()=>openedLinks);assert.equal(opened.length,1);assert(await p.locator('#communityDlg').isHidden());assert.equal(opened[0][0],'https://github.com/BiosickQiuence/GelFigure/issues/new/choose');assert.equal(opened[0][1],'_blank');assert(opened[0][2].includes('noopener'));assert.deepEqual(requests,[]);await p.keyboard.press('Escape');assert(await p.locator('#communityDlg').isHidden());
  });
  await check('language changes and phone access keep the same destinations and preserve project state',async()=>{
   await p.evaluate(async()=>{App.forceJsHash=true;await App.load({name:'synthetic-feedback.tif',buffer:Demo.encodeTiff16({width:120,height:180,data:new Float32Array(21600).fill(.2)})});});const before=await p.evaluate(()=>App.snapshot());
   await p.setViewportSize({width:390,height:844});await p.evaluate(()=>I18N.set('zh'));await p.locator('#btnMore').click();await p.locator('[data-m="community"]').click();assert.equal(await p.locator('#communityChoices a').count(),2);await p.locator('#communityChoices [data-support="feedback"]').click();await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>App.snapshot()),before);assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);
  });
 }finally{await ctx.close();}return out;
}
