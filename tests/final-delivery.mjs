import './backup-outputs.cjs';import assert from 'node:assert/strict';import path from 'node:path';import {pathToFileURL} from 'node:url';import {chromium,firefox,webkit} from 'playwright';
const file=path.resolve(process.argv[2]);
for(const engine of ['chromium','firefox','webkit']){
  const b=await ({chromium,firefox,webkit}[engine]).launch(),ctx=await b.newContext({offline:true,viewport:{width:1440,height:1000}}),p=await ctx.newPage(),external=[],errors=[];
  p.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url());});p.on('pageerror',e=>errors.push(e.message));
  try{
    await p.goto(pathToFileURL(file).href+'?lang=zh');await p.waitForFunction(()=>window.App?.BUILD==='v1.1.0');
    await p.locator('#btnSettings').click();assert(await p.locator('#aiEndpoint').isVisible());await p.keyboard.press('Escape');assert(!(await p.locator('#aiSettingsPanel').isVisible()));
    await p.locator('#btnDemo').click();await p.waitForFunction(()=>!!App.S);
    await p.locator('#btnGelAIBeta').click();assert.equal(await p.locator('#gelLayoutDlg').getAttribute('role'),'region');await p.locator('#layoutZoomIn').click();assert.notEqual(await p.locator('#layoutZoomLabel').textContent(),'100%');
    await p.setViewportSize({width:320,height:568});await p.locator('#layoutFit').click();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),320);
    const footer=await p.locator('.layout-footer').boundingBox();assert(footer.y>=0&&footer.y+footer.height<=568);await p.keyboard.press('Escape');
    await p.evaluate(()=>MarkerAI.open());assert(await p.locator('#aiMarkerDlg').isVisible());assert.equal(ctx.pages().length,1);await p.keyboard.press('Escape');
    const hash=await p.evaluate(async()=>{const expected=App.S.file.sha256;await App.openProject(await (await App.projectBlob()).arrayBuffer());return {expected,actual:await App.sha256(App.srcBuffer)};});assert.equal(hash.expected,hash.actual);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
    console.log(engine,'PASS delivered single HTML: offline settings, inline tasks, zoom, 320px footer, project round-trip, no external requests or page errors');
  }finally{await ctx.close();await b.close();}
}
