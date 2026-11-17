/* Synthetic geometric ground truth and intercepted responses; never a vision-accuracy benchmark. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium,firefox,webkit} from 'playwright';
export async function layoutBetaChecks(browser,root,engine){
  const ctx=await browser.newContext({viewport:{width:1440,height:1000}}),p=await ctx.newPage(),out=[],errors=[],sent=[];let failure,mode='ok',hold=null;
  const API='https://layout.synthetic.invalid/v1/chat/completions',KEY='synthetic-layout-only',MODEL='synthetic-layout-model';
  const quad=(a,b,c,d)=>[{x:a,y:b},{x:c,y:b},{x:c,y:d},{x:a,y:d}];
  const fixture=()=>({schema_version:1,image:{width:201,height:141},plane_quad:quad(0,0,1,1),lane_count:6,lanes:[{status:'empty',quad:quad(.02,.15,.08,.85)},{status:'active',quad:quad(.16,.20,.24,.75)},{status:'empty',quad:quad(.32,.20,.40,.75)},{status:'active',quad:quad(.48,.25,.56,.80)},{status:'uncertain',quad:quad(.64,.22,.72,.78)},{status:'empty',quad:quad(.84,.20,.92,.80)}]});
  const check=async(name,fn)=>{await fn();out.push(name);console.log(engine,'PASS',name);};
  p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(/^https?:/.test(r.url()))sent.push(r.url());});
  await p.route(API,async route=>{
    const req=route.request();if(req.method()!=='POST')throw new Error('Only a POST is expected');const body=req.postDataJSON();windowBody=body;requests.push({body,headers:req.headers()});if(hold)await hold;
    if(mode==='network'){await route.abort('failed');return;}if(mode.startsWith('http')){await route.fulfill({status:Number(mode.slice(4)),contentType:'application/json',body:JSON.stringify({error:{message:KEY}})});return;}
    if(mode==='badjson'){await route.fulfill({status:200,contentType:'text/plain',body:'invalid'});return;}
    const value=fixture();if(mode==='dimensions')value.image.width++;
    await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({choices:[{finish_reason:mode==='truncated'?'length':'stop',message:{content:mode==='badcontent'?'not JSON':JSON.stringify(value),...(mode==='refusal'?{refusal:'refused'}:{})}}]})});
  });
  let windowBody,requests=[];
  const setup=async(rgb=false)=>{
    mode='ok';hold=null;await p.goto(pathToFileURL(path.join(root,'dist/GelFigure.html')).href+'?lang=en');
    await p.evaluate(async rgb=>{
      App.forceJsHash=true;const w=201,h=141,data=Float32Array.from({length:w*h},(_,i)=>(i%w+2*Math.floor(i/w))/(w+2*h));
      let buffer;if(rgb){const pixels=new Uint8Array(w*h*3);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const j=(y*w+x)*3;pixels[j]=x;pixels[j+1]=y;pixels[j+2]=37;}buffer=Export.encodeTiffRGB(pixels,w,h,300,'Synthetic');}else buffer=Demo.encodeTiff16({width:w,height:h,data});
      await App.load({name:'PRIVATE_synthetic_layout.tif',buffer});App.setGelType('protein');App.setRotation(0);App.S.crop={x:0,y:0,w,h};App.S.lanes=[10,40,72,104,136,176].map((x,i)=>({x,name:'PRIVATE '+i,hidden:false}));App.S.groups=[{from:1,to:4,text:'PRIVATE group'}];App.S.conditions=[{name:'PRIVATE condition',values:['a','b','c','d','e','f']}];App.S.markers=[];App.S.lanePitch=32;if(rgb)App.setDisplayMode('colour');App.commit();GelAIBeta.open();window.beforeLayout=App.snapshot();
    },rgb);
  };
  const preview=async()=>{await p.evaluate(v=>GelAIBeta.showPreview(v),fixture());await p.locator('#layoutMargin').fill('0');await p.locator('#layoutMargin').dispatchEvent('change');};
  const configure=async()=>{
    await p.locator('#layoutSettings').click();await p.locator('#aiEndpoint').fill(API);await p.locator('#aiModel').fill(MODEL);await p.locator('#aiKey').fill(KEY);await p.locator('#aiSettingsClose').click();await p.evaluate(()=>GelAIBeta.open());
  };
  const send=async()=>{await p.locator('#layoutSend').click();await p.waitForFunction(()=>!GelAIBeta.pending);};
  try{
    await check('opening and editing beta preview do not call an API or mutate the project',async()=>{await setup();await preview();assert.equal(sent.length,0);assert.equal(await p.evaluate(()=>App.snapshot()),await p.evaluate(()=>beforeLayout));assert(await p.locator('#layoutApply').isEnabled());});
    await check('image encoding errors are explicit and do not request or modify the project',async()=>{
      const r=await p.evaluate(()=>{const old=MarkerAI.analysisImage,before=App.snapshot();GelAIBeta.session.invalid=true;MarkerAI.analysisImage=()=>{throw new Error('Synthetic image encoding failure');};try{GelAIBeta.open();return {same:before===App.snapshot(),status:document.getElementById('layoutStatus').textContent};}finally{MarkerAI.analysisImage=old;}});assert(r.same);assert(r.status.includes('encoding failure'));assert.equal(sent.length,0);await p.evaluate(()=>GelAIBeta.open());await preview();
    });
    await check('active-lane crop excludes outer gel, blank edge lanes and vertical blank margins',async()=>{
      const r=await p.evaluate(()=>{const q=GelAIBeta.plan(GelAIBeta.session.proposal,0);return {points:q.points,w:q.spec.w,h:q.spec.h,xs:q.lanes.map(l=>l.x),hidden:q.lanes.map(l=>l.hidden),meta:q.meta};});
      assert.equal(r.w,113);assert.equal(r.h,85);r.points.forEach((v,i)=>{assert(Math.abs(v.x-[32,144,144,32][i])<1e-8);assert(Math.abs(v.y-[28,28,112,112][i])<1e-8);});r.xs.forEach((x,i)=>assert(Math.abs(x-[8,40,72,104][i])<1e-8));assert.deepEqual(r.hidden,[false,true,false,false]);assert.equal(r.meta.visibleLanes,3);assert.equal(r.meta.removedEdgeLanes,2);assert.equal(r.meta.removedInternalLanes,1);assert.equal(r.meta.uncertainLanesKept,1);
    });
    await check('reviewing an uncertain lane as empty shrinks the actual crop and changes only the preview',async()=>{
      const before=await p.evaluate(()=>App.snapshot());await p.locator('[data-layout-status="4"]').selectOption('empty');const r=await p.evaluate(()=>GelAIBeta.plan(GelAIBeta.session.proposal,0));assert.equal(r.spec.w,81);assert.equal(r.meta.visibleLanes,2);assert.equal(r.meta.uncertainLanesKept,0);assert.equal(await p.evaluate(()=>App.snapshot()),before);await preview();
    });
    await check('homography inverse and trapezoidal signal boxes map without regularizing spacing',async()=>{
      const r=await p.evaluate(v=>{
        const pts=[{x:10,y:8},{x:180,y:13},{x:190,y:133},{x:4,y:126}],f=Perspective.mapping(pts),inv=Perspective.mapping(pts,true);let error=0;for(const u of [0,.2,.7,1])for(const w of [0,.3,.9,1]){const q=f(u,w),p=inv(q.x,q.y);error=Math.max(error,Math.abs(p.x-u),Math.abs(p.y-w));}
        const mapped={...v,plane_quad:pts.map(q=>({x:q.x/200,y:q.y/140})),lanes:v.lanes.map(l=>({...l,quad:l.quad.map(q=>{const z=f(q.x,q.y);return {x:z.x/200,y:z.y/140};})}))};
        const proposal=GelAIBeta.validate(mapped,GelAIBeta.session.image),q=GelAIBeta.plan(proposal,0),expect=[[.16,.2],[.72,.2],[.72,.8],[.16,.8]].map(([u,v])=>f(u,v));return {error,points:q.points,expect,xs:q.lanes.map(l=>l.x/(q.spec.w-1))};
      },fixture());assert(r.error<1e-8);r.points.forEach((q,i)=>assert(Math.hypot(q.x-r.expect[i].x,q.y-r.expect[i].y)<1e-8));r.xs.forEach((u,i)=>assert(Math.abs(u-[.04,.20,.36,.52][i]/.56)<1e-8));
    });
    await check('margin is explicit geometry, and invalid boxes/statuses/cuts are rejected before state changes',async()=>{
      const r=await p.evaluate(v=>{
        const q=GelAIBeta.plan(GelAIBeta.session.proposal,4),before=App.snapshot(),changes=[x=>x.image.width++,x=>x.schema_version=2,x=>x.lane_count=-1,x=>x.lanes[0].status='invalid',x=>x.lanes[1].quad[0].x=2,x=>{[x.plane_quad[1],x.plane_quad[2]]=[x.plane_quad[2],x.plane_quad[1]];}];let rejected=0;
        for(const f of changes){const x=structuredClone(v);f(x);try{GelAIBeta.validate(x,GelAIBeta.session.image);}catch(_){rejected++;}}
        for(const margin of [-1,NaN,51])try{GelAIBeta.plan(GelAIBeta.session.proposal,margin);}catch(_){rejected++;}
        const duplicate=structuredClone(GelAIBeta.session.proposal);duplicate.lanes.push(structuredClone(duplicate.lanes[1]));try{GelAIBeta.plan(duplicate,0);}catch(_){rejected++;}
        const outside=structuredClone(GelAIBeta.session.proposal);outside.plane[0].x=50;outside.plane[3].x=50;try{GelAIBeta.plan(outside,0);}catch(_){rejected++;}
        return {rejected,same:before===App.snapshot(),points:q.points};
      },fixture());assert.equal(r.rejected,11);assert(r.same);assert(Math.abs(r.points[0].x-28)<1e-8&&Math.abs(r.points[0].y-24)<1e-8);
    });
    await check('numeric corner editing keeps its disclosure open and updates only the proposal',async()=>{
      const details=p.locator('[data-layout-detail="corners"]');await details.locator('summary').click();const before=await p.evaluate(()=>App.snapshot());await p.locator('[data-layout-corner="0:x"]').fill('1');await p.locator('[data-layout-corner="0:x"]').dispatchEvent('change');assert(await details.evaluate(d=>d.open));await p.locator('[data-layout-corner="0:y"]').fill('1');await p.locator('[data-layout-corner="0:y"]').dispatchEvent('change');assert(await details.evaluate(d=>d.open));assert.equal(await p.evaluate(()=>GelAIBeta.session.proposal.plane[0].x),1);assert.equal(await p.evaluate(()=>App.snapshot()),before);await preview();
    });
    await check('empty or unrecognized planes never force a correction; declared count mismatch is visible',async()=>{
      const v=fixture();v.plane_quad=null;await p.evaluate(v=>GelAIBeta.showPreview(v),v);assert(await p.locator('#layoutApply').isDisabled());assert.equal(await p.evaluate(()=>App.snapshot()),await p.evaluate(()=>beforeLayout));
      v.plane_quad=fixture().plane_quad;v.lanes.forEach(l=>l.status='empty');await p.evaluate(v=>GelAIBeta.showPreview(v),v);assert(await p.locator('#layoutApply').isDisabled());
      const mismatch=fixture();mismatch.lane_count=7;await p.evaluate(v=>GelAIBeta.showPreview(v),mismatch);assert((await p.locator('#layoutDetails').textContent()).includes('differs'));await preview();
    });
    await check('applying uses AI centers only, removes internal blank columns with disclosed splices and one undo',async()=>{
      const r=await p.evaluate(()=>{
        const before=App.snapshot(),bytes=App.srcBuffer,raw=App.rawSrc.data,expected=[];for(let y=28;y<=112;y++)for(let x=32;x<=144;x++)expected.push(raw[y*201+x]);
        const a=App.autoLanes,b=App.autoMarkers;App.autoLanes=App.autoMarkers=()=>{throw new Error('No local count fallback');};let q;
        try{q=GelAIBeta.apply();}finally{App.autoLanes=a;App.autoMarkers=b;}
        const after=App.snapshot();let error=0;expected.forEach((v,i)=>error=Math.max(error,Math.abs(v-App.src.data[i])));App.buildFigure(false);const log=Export.processingLog(App.S),width=App.visibleWidthPx(),segments=App._lastGel.segs.length,original=App.rawSrc.data===raw&&App.srcBuffer===bytes;
        const reset=App.S.groups.length===0&&App.S.conditions.length===0&&App.S.markers.length===0&&App.S.lanes.every(l=>l.name===''),linked=App.S.laneLinked;
        App.undo();const undo=App.snapshot()===before;App.redo();return {error,original,reset,linked,undo,redo:App.snapshot()===after,w:App.src.w,h:App.src.h,width,segments,log,meta:q.meta};
      });assert(r.error<1e-6);assert(r.original&&r.reset&&r.undo&&r.redo);assert.equal(r.linked,false);assert.equal(r.w,113);assert.equal(r.h,85);assert(Math.abs(r.width-81)<1e-7);assert.equal(r.segments,2);assert.equal(r.log.aiLayoutRecognition.visibleLanes,3);assert(r.log.lanes.some(l=>l.removal?.reason==='ai-empty'));assert(r.log.legendHints.some(s=>s.includes('removed')));
    });
    await check('RGB pixels, projects and original bytes survive adoption/restoration without repeated raster warping',async()=>{
      await setup(true);await preview();const r=await p.evaluate(async()=>{const sha=await App.sha256(App.srcBuffer);GelAIBeta.apply();const state=App.snapshot(),rgb=App.sourceRGB.slice(),blob=await App.projectBlob();await App.openProject(await blob.arrayBuffer());return {state:App.snapshot()===state,rgb:rgb.every((v,i)=>v===App.sourceRGB[i]),sha:await App.sha256(App.srcBuffer)===sha,colour:App.isColour(),initial:App.projectData().initial,meta:App.S.gelAIBeta};});assert(r.state&&r.rgb&&r.sha&&r.colour);assert.equal(JSON.parse(r.initial).file.sha256,await p.evaluate(()=>App.S.file.sha256));assert.equal(JSON.parse(r.initial).gelAIBeta.visibleLanes,3);assert.equal(r.meta.visibleLanes,3);
    });
    await check('existing perspective, orientation and rotation map a beta crop back to decoded originals',async()=>{
      await setup(true);await p.evaluate(()=>{Perspective.apply([{x:15,y:12},{x:185,y:15},{x:181,y:130},{x:12,y:127}]);App.setOrient('h');App.setRotation(3);App.commit();GelAIBeta.open();});
      await p.evaluate(()=>{const image=GelAIBeta.session.image,q=(x0,y0,x1,y1)=>[{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}];GelAIBeta.showPreview({schema_version:1,image:{width:image.width,height:image.height},plane_quad:q(.03,.03,.97,.97),lane_count:2,lanes:[{status:'active',quad:q(.2,.25,.3,.8)},{status:'active',quad:q(.6,.22,.7,.78)}]});GelAIBeta.session.margin=0;});
      const r=await p.evaluate(()=>{const q=GelAIBeta.plan(GelAIBeta.session.proposal,0),expected=Perspective.warp({w:App.rawSrc.w,h:App.rawSrc.h,data:App.rawRGB},q.spec,true).data,before=App.snapshot();GelAIBeta.apply();const error=Math.max(...expected.map((v,i)=>Math.abs(v-App.sourceRGB[i])));App.undo();return {error,undo:App.snapshot()===before};});assert.equal(r.error,0);assert(r.undo);
    });
    await check('fit-view corner drag, cancellation and manual box creation edit only the draft',async()=>{
      await setup();await preview();await p.locator('#layoutFit').click();
      const move=async(x,y)=>{const q=await p.evaluate(({x,y})=>{const cv=document.getElementById('layoutInput'),r=cv.getBoundingClientRect(),im=GelAIBeta.session.image,s=Math.min((cv.width-32)/(im.width-1),(cv.height-32)/(im.height-1));return {x:r.x+(x*s+(cv.width-(im.width-1)*s)/2)*r.width/cv.width,y:r.y+(y*s+(cv.height-(im.height-1)*s)/2)*r.height/cv.height};},{x,y});await p.mouse.move(q.x,q.y);};
      let q=await p.evaluate(()=>GelAIBeta.session.proposal.plane[0]);const before=await p.evaluate(()=>App.snapshot());await move(q.x,q.y);await p.mouse.down();await move(q.x+6,q.y+3);await p.mouse.up();assert(await p.evaluate(q=>Math.hypot(GelAIBeta.session.proposal.plane[0].x-q.x,GelAIBeta.session.proposal.plane[0].y-q.y)>2,q));assert.equal(await p.evaluate(()=>App.snapshot()),before);
      const cancelled=await p.evaluate(()=>JSON.stringify(GelAIBeta.session.proposal.plane));q=await p.evaluate(()=>GelAIBeta.session.proposal.plane[0]);await p.locator('#layoutInput').evaluate(cv=>cv.addEventListener('pointerdown',e=>cv.dataset.testPointer=String(e.pointerId),{once:true}));await move(q.x,q.y);await p.mouse.down();await move(q.x+4,q.y+2);await p.locator('#layoutInput').evaluate(cv=>cv.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:Number(cv.dataset.testPointer),pointerType:'mouse'})));await p.mouse.up();assert.equal(await p.evaluate(()=>JSON.stringify(GelAIBeta.session.proposal.plane)),cancelled);
      await p.locator('#layoutAddLane').click();await move(155,40);await p.mouse.down();await move(167,100);await p.mouse.up();assert.equal(await p.evaluate(()=>GelAIBeta.session.proposal.lanes.length),7);assert.equal(await p.evaluate(()=>GelAIBeta.session.proposal.lanes.at(-1).sourceIndex),null);assert.equal(await p.evaluate(()=>App.snapshot()),before);
    });
    await check('request is explicit, reuses the configured vision API and sends no project/names/catalogue',async()=>{
      await setup(true);await configure();const before=await p.evaluate(()=>App.snapshot()),n=requests.length;await send();assert.equal(requests.length,n+1);assert.equal(windowBody.model,MODEL);assert.equal(requests.at(-1).headers.authorization,'Bearer '+KEY);const body=JSON.stringify(windowBody);assert(!body.includes('PRIVATE'));assert(!body.includes('catalogue'));assert(windowBody.messages[1].content[1].image_url.url.startsWith('data:image/png;base64,'));assert(await p.locator('#layoutApply').isEnabled());assert.equal(await p.evaluate(()=>App.snapshot()),before);
    });
    await check('failures report HTTP/network/JSON/refusal/truncation/coordinate errors without fallback or key echo',async()=>{
      const before=await p.evaluate(()=>App.snapshot());for(const m of ['http401','http429','http500','badjson','badcontent','refusal','truncated','dimensions','network']){mode=m;const n=requests.length;await send();assert.equal(requests.length,n+1);assert(await p.locator('#layoutStatus').evaluate(e=>e.classList.contains('error')),m);assert(!(await p.locator('#layoutStatus').textContent()).includes(KEY));assert.equal(await p.evaluate(()=>App.snapshot()),before);assert(await p.locator('#layoutApply').isDisabled());assert.equal(await p.locator('#layoutOutput').evaluate(c=>c.width),1);}mode='ok';
    });
    await check('late responses are discarded after a project change and after cancellation',async()=>{
      for(const action of ['change','cancel']){await setup();await configure();let release;hold=new Promise(r=>release=r);const observed=p.waitForRequest(API);await p.locator('#layoutSend').click();await observed;await p.waitForFunction(()=>GelAIBeta.pending);if(action==='change')await p.evaluate(()=>{App.S.lanes[0].name='new';App.commit();});else await p.locator('#layoutCancel').click();const state=await p.evaluate(()=>App.snapshot());release();hold=null;await p.waitForFunction(()=>!GelAIBeta.pending);await p.waitForTimeout(60);assert.equal(await p.evaluate(()=>App.snapshot()),state);assert(await p.evaluate(()=>!GelAIBeta.session.proposal));}
    });
    await check('timeout and duplicate clicks cause one request only; settings edits cancel old requests',async()=>{
      await setup();await configure();await p.clock.install();let release;hold=new Promise(r=>release=r);const n=requests.length,observed=p.waitForRequest(API);await p.locator('#layoutSend').click();await observed;await p.evaluate(()=>{GelAIBeta.request();GelAIBeta.request();});await p.clock.fastForward(90001);await p.waitForFunction(()=>!GelAIBeta.pending);assert((await p.locator('#layoutStatus').textContent()).includes('90'));assert.equal(requests.length,n+1);release();hold=null;
      await setup();await configure();hold=new Promise(r=>release=r);const observed2=p.waitForRequest(API);await p.locator('#layoutSend').click();await observed2;await p.locator('#layoutSettings').click();await p.locator('#aiModel').fill('changed-model');assert(await p.evaluate(()=>!GelAIBeta.pending));release();hold=null;
    });
    await check('UI confirmation protects current annotations; successful application returns to the main figure',async()=>{
      await setup();await preview();const before=await p.evaluate(()=>App.snapshot());await p.locator('#layoutApply').click();await p.locator('#layoutConfirmCancel').click();assert.equal(await p.evaluate(()=>App.snapshot()),before);assert(await p.locator('#gelLayoutDlg').isVisible());await p.locator('#layoutApply').click();await p.locator('#layoutConfirmApply').click();assert(!await p.locator('#gelLayoutDlg').isVisible());assert.equal(await p.evaluate(()=>App.S.gelAIBeta.visibleLanes),3);
    });
    await check('saved projects, logs, SVG and editable PowerPoint contain geometry provenance and no API credentials',async()=>{
      const r=await p.evaluate(async()=>{const P=JSON.stringify(App.projectData()),log=JSON.stringify(Export.processingLog(App.S)),svg=App.buildFigure(false).svg,pptx=await PPTX.build();return {P,log,svg,pptx:pptx.size};});for(const s of [r.P,r.log,r.svg])assert(!s.includes(KEY)&&!s.includes(API)&&!s.includes(MODEL));assert(r.P.includes('ai-layout-beta'));assert(r.log.includes('band-containing-lanes'));assert(r.pptx>1000);
    });
    await check('phone beta fits and applies to the figure; opening/preview/export add no recognition calls',async()=>{
      await setup();await p.setViewportSize({width:390,height:844});await preview();const n=requests.length;assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),390);const dir=path.join(root,'test-results','layout-beta',engine+'-'+Date.now());fs.mkdirSync(dir,{recursive:true});await p.screenshot({path:path.join(dir,'phone.png')});await p.locator('#layoutApply').click();await p.locator('#layoutConfirmApply').click();assert.equal(await p.evaluate(()=>Mobile.view()),'fig');assert(!await p.locator('#gelLayoutDlg').isVisible());assert.equal(requests.length,n);assert.deepEqual(errors,[]);fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify({engine,checks:out.concat('phone beta fits and applies to the figure; opening/preview/export add no recognition calls'),actualVisionAccuracyTested:false},null,2));
    });
  }catch(e){failure=e;console.log(engine,'FAIL',e.stack);}finally{await ctx.close();}
  return out.map(name=>['ok','layout beta: '+name]).concat(failure?[['FAIL','layout beta',failure.stack]]:[]);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const root=fileURLToPath(new URL('..',import.meta.url));let ok=true;for(const engine of process.argv.slice(2).length?process.argv.slice(2):['chromium','firefox','webkit']){const b=await ({chromium,firefox,webkit}[engine]).launch();try{ok=(await layoutBetaChecks(b,root,engine)).every(r=>r[0]==='ok')&&ok;}finally{await b.close();}}process.exitCode=ok?0:1;
}
