import './backup-outputs.cjs';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';import {chromium} from 'playwright';
const root=fileURLToPath(new URL('..',import.meta.url)),out=path.join(root,'test-results','delivery-ui-'+Date.now());fs.mkdirSync(out,{recursive:true});
const b=await chromium.launch(),p=await b.newPage({viewport:{width:1440,height:1000}});
try{
  await p.goto(pathToFileURL(path.join(root,'dist/GelFigure.html')).href+'?demo=1&lang=zh');await p.waitForFunction(()=>window.App?.S);
  await p.waitForFunction(()=>document.querySelectorAll('#toasts .toast').length===0);
  await p.screenshot({path:path.join(out,'主界面.png')});await p.locator('#btnSettings').click();await p.screenshot({path:path.join(out,'右上角设置.png')});await p.locator('#aiSettingsClose').click();
  await p.evaluate(()=>{
    GelAIBeta.open();const image=GelAIBeta.session.image,q=(a,b,c,d)=>[{x:a,y:b},{x:c,y:b},{x:c,y:d},{x:a,y:d}],lanes=App.S.lanes.map((l,i)=>({status:i===3?'uncertain':'active',quad:q((l.x-22)/(image.width-1),.18,(l.x+22)/(image.width-1),.9)}));
    GelAIBeta.showPreview({schema_version:1,image:{width:image.width,height:image.height},plane_quad:q(0,0,1,1),lane_count:lanes.length,lanes});
  });await p.waitForFunction(()=>document.getElementById('layoutInput').width>200);await p.screenshot({path:path.join(out,'AI布局复核_桌面.png')});
  await p.setViewportSize({width:390,height:844});await p.locator('#layoutFit').click();await p.screenshot({path:path.join(out,'AI布局复核_手机.png')});await p.locator('#layoutClose').click();
  await p.evaluate(()=>{MarkerAI.open();MarkerAI.captureLocal();});await p.screenshot({path:path.join(out,'Marker复核_手机.png')});
  console.log(out);
}finally{await b.close();}
