/* Synthetic gels + intercepted HTTPS responses test mechanics, never recognition accuracy. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

export async function aiMarkerChecks(browser,base,root,engine){
  const results=[],ctx=await browser.newContext({viewport:{width:1440,height:1000}}),p=await ctx.newPage(),errors=[],requests=[];
  const API='https://vision.gelfigure.invalid/v1/chat/completions',SECRET='synthetic-test-credential',MODEL='mock-vision-test';
  let mode='ok',mutate=null,hold=null,x=0.07,customId=null;
  const dir=path.join(root,'test-results','ai-marker',engine+'-'+Date.now());fs.mkdirSync(dir,{recursive:true});
  p.on('pageerror',e=>errors.push(e.message));
  const check=async(name,fn)=>{console.log(engine,'START',name);try{await fn();results.push(['ok','AI Marker: '+name]);console.log(engine,'PASS',name);}catch(e){results.push(['FAIL','AI Marker: '+name,e.stack]);console.log(engine,'FAIL',name,e.message);}};
  await p.route(API,async route=>{
    const body=route.request().postDataJSON(),meta=JSON.parse(body.messages[1].content[0].text);requests.push({body,meta,headers:route.request().headers()});
    const requestedX=x;if(hold)await hold;
    if(mode==='network'){await route.abort('failed');return;}
    if(/^http-/.test(mode)){await route.fulfill({status:Number(mode.slice(5)),contentType:'application/json',body:JSON.stringify({error:{message:SECRET+' private response'}})});return;}
    if(mode==='bad-wrapper'){await route.fulfill({status:200,contentType:'text/plain',body:'not JSON'});return;}
    const lad=meta.catalogue.find(l=>l.id===customId)||meta.catalogue[0];
    let value={schema_version:1,gel_type:meta.selected_gel_type,image:meta.image&&{width:meta.image.width,height:meta.image.height},markers:[{x:requestedX,ladder_id:lad.id,candidates:[{id:lad.id,confidence:0.7}],bands:lad.sizes.slice(0,3).map((size,i)=>({y:[.17345,.37812,.71891][i],size}))}]};
    if(mutate)value=mutate(value,meta);
    const response={choices:[{finish_reason:mode==='truncated'?'length':'stop',message:{role:'assistant',content:mode==='bad-content'?'unstructured answer':mode==='fenced'?'```json\n'+JSON.stringify(value)+'\n```':JSON.stringify(value)}}]};
    if(mode==='refusal')response.choices[0].message.refusal='refused';
    await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(response)});
  });
  const load=async()=>{
    mode='ok';mutate=null;hold=null;customId=null;
    await p.goto(base+'/index.html?demo=1&lang=en');await p.waitForFunction(()=>document.title.startsWith('READY '),null,{timeout:120000});
    x=await p.evaluate(()=>App.S.lanes[0].x/(App.ensureRot().w-1));
    await p.evaluate(()=>MarkerAI.open());
    await p.evaluate(()=>MarkerAI.openSettings());await p.locator('#aiEndpoint').fill(API);await p.evaluate(()=>MarkerAI.openSettings());await p.locator('#aiModel').fill(MODEL);await p.evaluate(()=>MarkerAI.openSettings());await p.locator('#aiKey').fill(SECRET);await p.locator('#aiSettingsClose').click();
  };
  const send=async()=>{if(await p.locator('#aiSettingsPanel').isVisible())await p.locator('#aiSettingsClose').click();await p.locator('#aiRecognize').click();await p.waitForFunction(()=>!MarkerAI.pending);};
  const apply=async(overwrite=false)=>p.evaluate(overwrite=>MarkerAI.apply('ai',overwrite),overwrite);
  try{
    await check('startup, settings, preview, editing, rotation and restoration send no recognition request',async()=>{
      await load();assert.equal(requests.length,0);
      await p.evaluate(()=>MarkerAI.openSettings());await p.locator('#aiSaveSettings').click();await p.locator('#aiLocal').click();
      await p.evaluate(()=>{App.S.lanes[1].name='PRIVATE sample name';App.commit();App.setRotation(.3);App.afterRotation();App.commit();});
      const project=await p.evaluate(async()=>Array.from(new Uint8Array(await (await App.projectBlob()).arrayBuffer())));
      await p.evaluate(async b=>App.openProject(new Uint8Array(b).buffer),project);
      assert.equal(requests.length,0);assert(await p.evaluate(()=>MarkerAI.session===null));
    });
    await check('single click sends configured Chat Completions vision payload and previews without mutation',async()=>{
      await load();const before=await p.evaluate(()=>App.snapshot()),n=requests.length;
      await send();assert(await p.evaluate(()=>!!MarkerAI.session.ai),'valid preview expected');
      assert.equal(requests.length,n+1);assert.equal(await p.evaluate(()=>App.snapshot()),before);
      const {body,meta,headers}=requests.at(-1);assert.equal(body.model,MODEL);assert.equal(body.stream,false);assert.equal(headers.authorization,'Bearer '+SECRET);
      assert(!headers.cookie);assert.equal(body.messages[1].content[1].type,'image_url');assert(body.messages[1].content[1].image_url.url.startsWith('data:image/png;base64,'));
      assert(!JSON.stringify(body).includes('PRIVATE'));assert(!('lanes' in meta));assert(!('state' in meta));assert(meta.catalogue.length>10);
      assert(await p.locator('#aiPreview-ai').isVisible());assert(await p.locator('#aiPreview-local').isVisible());
      await p.screenshot({path:path.join(dir,'comparison.png'),fullPage:true});
    });
    await check('normalized coordinates map directly to image pixels; no local matching on apply',async()=>{
      const before=await p.evaluate(()=>App.snapshot());
      const result=await p.evaluate(()=>{
        const original=App.lanePeaks;let calls=0;App.lanePeaks=()=>{calls++;throw new Error('AI must not read local peaks');};
        try{MarkerAI.apply('ai');const m=App.S.markers.find(m=>m.recognition?.method==='ai');return {calls,ys:m.bands.map(b=>b.y),h:App.ensureRot().h,x:App.S.lanes[m.lane].x,mode:m.bandMode,estimate:App.estimateInfo(m.bands[1].y)?.bp};}finally{App.lanePeaks=original;}
      });
      assert.equal(result.calls,0);assert.equal(result.mode,'fixed');assert.deepEqual(result.ys,[.17345,.37812,.71891].map(y=>y*(result.h-1)));assert(Number.isFinite(result.estimate));
      await p.evaluate(()=>App.undo());assert.equal(await p.evaluate(()=>App.snapshot()),before);assert(await p.evaluate(()=>MarkerAI.session.invalid));
    });
    await check('unknown model and missing band positions remain unassigned and cannot calibrate',async()=>{
      await load();mutate=v=>{v.markers[0].ladder_id=null;v.markers[0].bands=[{y:.25,size:null},{y:null,size:null}];return v;};
      await send();await apply();
      const r=await p.evaluate(()=>({m:App.S.markers[0],estimate:App.estimateInfo(200),svg:App.buildFigure(false).svg,log:Export.processingLog(App.S)}));
      assert.equal(r.m.ladderId,'');assert.equal(r.m.bands.length,0);assert.equal(r.m.unassignedBands.length,2);assert.equal(r.m.unassignedBands[1].y,null);assert.equal(r.estimate,null);assert.equal(r.log.markers[0].ladder,null);
      assert(await p.locator('[data-mi="0"] [data-f="ladder"]').inputValue()==='');
      await p.evaluate(()=>MarkerAI.editMarker(0));assert.equal(requests.at(-1).body.model,MODEL);
    });
    await check('complete schema rejects invalid types, bounds, models, sizes, duplicates and ordering atomically',async()=>{
      await load();
      const r=await p.evaluate(()=>{
        const img=MarkerAI.analysisImage(),lad=Ladders.all('dna')[0],s=lad.sizes;
        const good={schema_version:1,gel_type:'dna',image:{width:img.width,height:img.height},markers:[{x:.2,ladder_id:lad.id,candidates:[{id:lad.id}],bands:[{y:.2,size:s[0]},{y:.4,size:s[1]}]}]};
        const changes=[v=>v.image.width++,v=>v.schema_version=2,v=>v.gel_type='protein',v=>v.markers[0].x=1.1,v=>v.markers[0].x='0.5',v=>v.markers[0].bands[0].y=-.1,v=>v.markers[0].bands[0].y='0.2',v=>v.markers[0].ladder_id='nonexistent',v=>v.markers[0].bands[0].size=123456789,v=>v.markers[0].bands[0].size=s[1],v=>v.markers[0].bands[0].y=.6,v=>v.markers[0].candidates.push({id:'nonexistent'}),v=>v.markers.push(structuredClone(v.markers[0])),v=>delete v.markers[0].bands[0].size];
        return changes.map(f=>{const value=structuredClone(good);f(value);try{MarkerAI.validate(value,img,'dna');return false;}catch(_){return true;}});
      });assert(r.length>=14&&r.every(Boolean));
    });
    await check('HTTP and malformed, refused, truncated responses report errors with no fallback or secret echo',async()=>{
      await load();const before=await p.evaluate(()=>App.snapshot());
      for(const testMode of ['http-401','http-429','http-500','bad-wrapper','bad-content','refusal','truncated','network']){
        mode=testMode;const n=requests.length;await send();assert.equal(requests.length,n+1);assert(await p.locator('#aiStatus').evaluate(e=>e.classList.contains('error')),testMode);
        assert(!await p.locator('#aiStatus').textContent().then(t=>t.includes(SECRET)));assert.equal(await p.evaluate(()=>App.snapshot()),before);assert(await p.evaluate(()=>!MarkerAI.session.ai));
      }
      mode='ok';mutate=v=>{v.markers[0].x=2;return v;};await send();assert(await p.locator('#aiStatus').evaluate(e=>e.classList.contains('error')));assert.equal(await p.evaluate(()=>App.snapshot()),before);
    });
    await check('HTTPS validation rejects insecure URLs and embedded credentials before sending',async()=>{
      await load();const n=requests.length;
      for(const address of ['http://localhost:8080/v1','https://user:password@example.com/v1','https://example.com/v1?key=private','#bad']){
        await p.evaluate(()=>MarkerAI.openSettings());await p.locator('#aiEndpoint').fill(address);await send();assert(await p.locator('#aiStatus').evaluate(e=>e.classList.contains('error')));
      }assert.equal(requests.length,n);
    });
    await check('manual lane/model/band confirmation survives by default and explicit overwrite replaces it',async()=>{
      await load();await p.evaluate(()=>{const m=App.S.markers[0];m.userAssigned=true;m.ladderLocked=true;m.bands[0].manual=true;App.commit();});
      const original=await p.evaluate(()=>JSON.stringify(App.S.markers[0]));await send();let r=await apply();assert.equal(r.skipped,1);assert.equal(await p.evaluate(()=>JSON.stringify(App.S.markers[0])),original);
      r=await apply(true);assert.equal(r.applied,1);assert.equal(await p.evaluate(()=>App.S.markers[0].recognition.method),'ai');
    });
    await check('explicit sample exclusion is protected until overwrite is enabled',async()=>{
      await load();x=await p.evaluate(()=>{App.S.lanes[1].markerExcluded=true;App.commit();return App.S.lanes[1].x/(App.ensureRot().w-1);});
      await send();let r=await apply();assert.equal(r.skipped,1);assert(await p.evaluate(()=>App.S.lanes[1].markerExcluded));
      r=await apply(true);assert.equal(r.applied,1);assert(await p.evaluate(()=>App.S.markers.some(m=>m.lane===1)&&!App.S.lanes[1].markerExcluded));
    });
    await check('new lane insertion preserves names, rich text, conditions and group endpoints; one undo restores all',async()=>{
      await load();const before=await p.evaluate(()=>{
        const s=App.S;s.lanes.forEach((l,i)=>{l.name='Sample '+i;l.nameRuns=[{text:l.name,italic:true}];});
        s.conditions=[{name:'Treatment',values:s.lanes.map((_,i)=>'C'+i)}];s.groups=[{from:1,to:4,text:'Group'}];App.commit();return App.snapshot();
      });
      x=await p.evaluate(()=>(App.S.lanes[0].x+App.S.lanes[1].x)/2/(App.ensureRot().w-1));await send();
      assert(await p.evaluate(()=>MarkerAI.session.ai.rows[0].target===null));await apply();
      const r=await p.evaluate(()=>({names:App.S.lanes.map(l=>l.name),runs:App.S.lanes.filter(l=>l.name.startsWith('Sample')).every(l=>l.nameRuns[0].text===l.name),conds:App.S.lanes.map((l,i)=>[l.name,App.S.conditions[0].values[i]]),groups:App.S.groups}));
      assert.equal(r.names.length,12);assert.equal(r.names[1],'M');assert(r.runs);for(let i=0;i<11;i++)assert(r.conds.some(([name,c])=>name==='Sample '+i&&c==='C'+i));assert.deepEqual([r.groups[0].from,r.groups[0].to],[2,5]);
      await p.evaluate(()=>App.undo());assert.equal(await p.evaluate(()=>App.snapshot()),before);
    });
    await check('correcting a lane across other lanes uses one permutation for names, conditions, markers and groups',async()=>{
      await load();await p.evaluate(()=>{App.S.lanes.forEach((l,i)=>l.name='Well '+i);App.S.conditions=[{name:'C',values:App.S.lanes.map((_,i)=>'V'+i)}];App.S.groups=[{from:2,to:5,text:'G'}];App.commit();});
      await send();await p.evaluate(()=>{const r=MarkerAI.session.ai.rows[0];r.target=2;r.x=App.S.lanes[4].x+App.S.lanePitch*.3;r.edited=true;});await apply();
      const r=await p.evaluate(()=>{const s=App.S,m=s.markers[0],g=s.groups[0];return {marker:s.lanes[m.lane].name,conditions:s.lanes.map((l,i)=>[l.name,s.conditions[0].values[i]]),ends:[s.lanes[g.from].name,s.lanes[g.to].name]};});
      assert.equal(r.marker,'Well 2');assert.deepEqual(r.ends,['Well 2','Well 5']);for(let i=0;i<11;i++)assert(r.conditions.some(([name,c])=>name==='Well '+i&&c==='V'+i));
    });
    await check('local and AI drafts remain available when switching applied results in the same session',async()=>{
      await load();await send();const original=await p.evaluate(()=>({local:MarkerAI.session.local.rows.length,ai:MarkerAI.session.ai.rows.length}));
      await apply();await p.evaluate(()=>MarkerAI.apply('local'));assert(await p.evaluate(()=>App.S.markers.every(m=>m.recognition.method==='local')));
      await apply();assert(await p.evaluate(()=>App.S.markers.every(m=>m.recognition.method==='ai')));assert.deepEqual(await p.evaluate(()=>({local:MarkerAI.session.local.rows.length,ai:MarkerAI.session.ai.rows.length})),original);
    });
    await check('AI coordinates survive rotation, refinement, re-match and crop re-detection without peak changes',async()=>{
      await load();await send();await apply();
      const r=await p.evaluate(()=>{
        const m=App.S.markers[0],initial=structuredClone(m.bands),angle=App.S.rotation,lx=App.S.lanes[m.lane].x,rot=App.ensureRot(),old=App.lanePeaks;let calls=0;App.lanePeaks=()=>{calls++;throw new Error('No AI peak matching');};
        try{App.matchMarkers(true);App.refineMarkers();App.alignMarker(0);App.setRotation(1.3);const moved=JSON.stringify(m.bands);App.afterRotation();const unchanged=JSON.stringify(m.bands)===moved,a=(1.3-angle)*Math.PI/180,expected=initial.map(b=>Math.sin(a)*(lx-(rot.w-1)/2)+Math.cos(a)*(b.y-(rot.h-1)/2)+(rot.h-1)/2);return {calls,unchanged,error:Math.max(...m.bands.map((b,i)=>Math.abs(b.y-expected[i])))};}finally{App.lanePeaks=old;}
      });assert.equal(r.calls,0);assert(r.unchanged);assert(r.error<.1);
      assert(await p.evaluate(()=>{const ys=App.S.markers[0].bands.map(b=>b.y);App.redetectCrop();const m=App.S.markers.find(m=>m.recognition?.method==='ai');return m&&JSON.stringify(ys)===JSON.stringify(m.bands.map(b=>b.y));}));
    });
    await check('manual edits change only requested bands and do not cause AI peak matching',async()=>{
      await load();await send();await apply();await p.evaluate(()=>MarkerAI.editMarker(0));assert(await p.evaluate(()=>!!MarkerAI.session.local),'editing must retain the local comparison');
      const row=p.locator('[data-method="ai"][data-row="0"]');await row.locator('.ai-band-text summary').click();await row.locator('[data-edit="bands"]').fill('101.234, ?\n?, ?');await row.locator('[data-edit="bands"]').dispatchEvent('change');
      await p.locator('[data-apply="ai"]').click();assert(await p.evaluate(()=>{const m=App.S.markers[0];return m.userAssigned&&m.recognition.edited&&m.bands.length===0&&m.unassignedBands[0].y===101.234;}));
    });
    await check('manual reference placement resolves an unknown position; gel-type changes do not resurrect deleted marks',async()=>{
      await load();mutate=v=>{v.markers[0].bands[1].y=null;return v;};await send();await apply();
      const r=await p.evaluate(()=>{
        const m=App.S.markers[0],bp=m.unassignedBands[0].size,lx=App.S.lanes[m.lane].x,y=(Math.max(...m.bands.map(b=>b.y))+App.S.crop.y+App.S.crop.h)/2;
        const old=App.lanePeaks;App.lanePeaks=()=>{throw new Error('Manual AI point must not snap');};
        try{MarkerUI.open(0);document.querySelector('[data-size="'+bp+'"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));MarkerUI.point(lx,y,true);}finally{App.lanePeaks=old;}
        const resolved=m.bands.some(b=>b.bp===bp&&b.y===y&&b.manual)&&!m.unassignedBands.some(b=>b.size===bp);
        const removed=m.bands[0],removedY=removed.y;App.removeMarkerBand(0,removed.bp);App.setGelType('protein');
        return {resolved,deletedStillAbsent:!App.S.markers[0].unassignedBands.some(b=>b.y===removedY)&&document.getElementById('markerReference').classList.contains('hidden')};
      });assert(r.resolved&&r.deletedStillAbsent);
    });
    await check('late responses cannot apply after project mutation, undo, source change or cancellation',async()=>{
      for(const action of ['change','undo','source','cancel','settings']){
        await load();if(action==='undo')await p.evaluate(()=>{App.S.lanes[1].name='Before undo';App.commit();});
        let release;hold=new Promise(r=>release=r);const n=requests.length;await p.locator('#aiRecognize').click();await p.waitForFunction(()=>MarkerAI.pending);
        if(action==='change')await p.evaluate(()=>{App.S.lanes[1].name='New name';App.commit();});
        if(action==='undo')await p.evaluate(()=>App.undo());
        if(action==='source')await p.evaluate(async()=>App.load({name:'new-synthetic.tif',buffer:Demo.encodeTiff16(Demo.makeGel({lanes:9}))}));
        if(action==='cancel')await p.locator('#aiCancel').click();
        if(action==='settings'){await p.evaluate(()=>MarkerAI.openSettings());await p.locator('#aiModel').fill('changed-model');}
        const before=await p.evaluate(()=>App.snapshot());release();hold=null;await p.waitForFunction(()=>!MarkerAI.pending);await p.waitForTimeout(60);
        assert.equal(await p.evaluate(()=>App.snapshot()),before);assert(await p.evaluate(()=>!MarkerAI.session?.ai));assert(requests.length<=n+1);
      }
    });
    await check('duplicate clicks are ignored while pending; 90-second timeout has no retry',async()=>{
      await load();let release;hold=new Promise(r=>release=r);const n=requests.length;
      await p.clock.install();try{
        const observed=p.waitForRequest(API);await p.locator('#aiRecognize').click();await observed;await p.waitForFunction(()=>MarkerAI.pending);
        await p.evaluate(()=>{MarkerAI.recognize();MarkerAI.recognize();});
        await p.clock.fastForward(90001);await p.waitForFunction(()=>!MarkerAI.pending);
        assert((await p.locator('#aiStatus').textContent()).includes('90 seconds'));assert.equal(requests.length,n+1);assert(await p.evaluate(()=>!MarkerAI.session.ai));
      }finally{release();hold=null;}
    });
    await check('a cancelled response cannot replace a newer request result',async()=>{
      await load();let release;hold=new Promise(r=>release=r);const n=requests.length;await p.locator('#aiRecognize').click();await p.waitForFunction(()=>MarkerAI.pending);
      await p.waitForTimeout(50);await p.locator('#aiCancel').click();hold=null;x=.8;await send();
      const expected=await p.evaluate(()=>MarkerAI.session.ai.rows[0].x);release();await p.waitForTimeout(80);
      assert.equal(await p.evaluate(()=>MarkerAI.session.ai.rows[0].x),expected);assert.equal(requests.length,n+2);
    });
    await check('changing gel type preserves AI positions as unknown sizes without local inference',async()=>{
      await load();await send();await apply();
      const r=await p.evaluate(()=>{const before=App.S.markers[0].bands.map(b=>b.y);App.setGelType('protein');const m=App.S.markers[0];return {before,id:m.ladderId,ys:m.unassignedBands.filter(b=>b.y!==null).map(b=>b.y),sizes:m.unassignedBands.map(b=>b.size),bands:m.bands.length,unit:m.unit};});
      assert.equal(r.id,'');assert.deepEqual(r.ys,r.before);assert(r.sizes.every(v=>v===null));assert.equal(r.bands,0);assert.equal(r.unit,'kDa');
    });
    await check('project saves only adopted result/provenance; key and comparisons are isolated and restoration is offline',async()=>{
      await load();await send();await apply();
      const r=await p.evaluate(async()=>{
        const state=App.snapshot(),P=JSON.stringify(App.projectData()),log=JSON.stringify(Export.processingLog(App.S)),svg=App.buildFigure(false).svg,blob=await App.projectBlob();
        await App.openProject(await blob.arrayBuffer());return {state:App.snapshot()===state,session:MarkerAI.session,P,log,svg};
      });assert(r.state);assert.equal(r.session,null);
      for(const text of [r.P,r.log,r.svg]){assert(!text.includes(SECRET));assert(!text.includes(API));assert(!text.includes(MODEL));assert(!text.includes('catalogue'));assert(!text.includes('candidates'));}
      assert(r.P.includes('"method":"ai"'));assert(r.log.includes('"method":"ai"'));
    });
    await check('saved files and browser history omit superseded import recognition, including an empty adopted result',async()=>{
      await load();await send();await apply();
      const r=await p.evaluate(async()=>{
        const P=App.projectData();App.isDemo=false;await App.saveDraft();const current=App.snapshot();
        App.S.lanes[1].name='changed after save';await App.restoreDraft();
        return {initial:P.initial,adopted:P.state.markerRecognition.method,restored:App.snapshot()===current,resetBaseline:JSON.parse(App.initial).markerRecognition.method==='ai',emptySession:MarkerAI.session===null};
      });assert.equal(JSON.parse(r.initial).markerRecognition.method,'ai');assert.equal(r.adopted,'ai');assert(r.restored&&r.resetBaseline&&r.emptySession);
      await load();mutate=v=>{v.markers=[];return v;};await send();await apply();
      assert(await p.evaluate(()=>{const P=App.projectData();return P.state.markers.length===0&&JSON.parse(P.initial).markers.length===0&&P.state.markerRecognition.method==='ai';}));
    });
    await check('remembering is opt-in, survives reload, and uncheck/clear remove the stored key',async()=>{
      await load();await p.evaluate(()=>MarkerAI.openSettings());await p.locator('#aiSaveSettings').click();assert.equal(await p.evaluate(()=>localStorage.getItem('gelfig.ai-marker.key')),null);
      await p.evaluate(()=>MarkerAI.openSettings());await p.locator('#aiRemember').check();assert.equal(await p.evaluate(()=>localStorage.getItem('gelfig.ai-marker.key')),SECRET);
      await p.reload();await p.waitForFunction(()=>document.title.startsWith('READY '));await p.evaluate(()=>MarkerAI.open());assert.equal(await p.locator('#aiKey').inputValue(),SECRET);assert(await p.locator('#aiRemember').isChecked());
      await p.evaluate(()=>MarkerAI.openSettings());await p.locator('#aiRemember').uncheck();assert.equal(await p.evaluate(()=>localStorage.getItem('gelfig.ai-marker.key')),null);
      await p.evaluate(()=>MarkerAI.openSettings());await p.locator('#aiRemember').check();await p.evaluate(()=>MarkerAI.openSettings());await p.locator('#aiClearKey').click();assert.equal(await p.locator('#aiKey').inputValue(),'');assert.equal(await p.evaluate(()=>localStorage.getItem('gelfig.ai-marker.key')),null);
    });
    await check('protein mode includes custom and built-in kDa catalogue entries and preserves uncertain candidates',async()=>{
      await load();await p.evaluate(async()=>{await App.load({name:'synthetic-protein.tif',buffer:Demo.encodeTiff16(Demo.makeProteinGel())});App.setGelType('protein');});
      customId=await p.evaluate(()=>Ladders.saveCustom('Synthetic protein model',[200,100,50,25],'protein').id);await p.evaluate(()=>MarkerAI.open());
      x=await p.evaluate(()=>App.S.lanes[0].x/(App.ensureRot().w-1));await send();assert.equal(requests.at(-1).meta.selected_gel_type,'protein');assert(requests.at(-1).meta.catalogue.some(l=>l.id===customId));
      await apply();assert.equal(await p.evaluate(()=>App.S.markers[0].unit),'kDa');assert.equal(await p.evaluate(()=>App.S.markers[0].ladderId),customId);
      await p.evaluate(()=>{App.S.lanes[1].name='change';App.commit();});mutate=v=>{v.markers[0].ladder_id=null;v.markers[0].candidates=v.markers[0].candidates.concat([{id:'biorad_dual',confidence:.6}]);v.markers[0].bands.forEach(b=>b.size=null);return v;};await send();
      assert.equal(await p.evaluate(()=>MarkerAI.session.ai.rows[0].ladderId),null);assert.equal(await p.evaluate(()=>MarkerAI.session.ai.rows[0].candidates.length),2);
    });
    await check('full analysis PNG follows perspective/orientation/rotation, preserves original RGB and excludes overlays',async()=>{
      await load();const r=await p.evaluate(async()=>{
        const gel=Demo.makeGel(),rgb=new Uint8Array(gel.width*gel.height*3);for(let i=0;i<gel.data.length;i++){rgb[i*3]=Math.round(gel.data[i]*177);rgb[i*3+1]=Math.round(gel.data[i]*211);rgb[i*3+2]=Math.round(gel.data[i]*255);}
        await App.load({name:'synthetic-colour.tif',buffer:Export.encodeTiffRGB(rgb,gel.width,gel.height,300,'Synthetic')});
        const w=App.rawSrc.w,h=App.rawSrc.h;Perspective.apply([{x:40,y:30},{x:w-60,y:50},{x:w-30,y:h-40},{x:20,y:h-60}]);App.setOrient('h');App.setRotation(1.7);App.S.displayMode='gray';
        App.S.levels={black:.3,white:.7,gamma:2,invert:true};App.S.crop={x:50,y:50,w:100,h:100};App.S.notes.push({kind:'text',x:100,y:100,text:'PRIVATE OVERLAY'});
        const image=MarkerAI.analysisImage(),expected=Colour.toImageData(App.sourceRGB,App.src.w,App.src.h,App.S.rotation),c=document.createElement('canvas');c.width=image.width;c.height=image.height;const im=new Image();im.src=image.url;await im.decode();c.getContext('2d').drawImage(im,0,0);const actual=c.getContext('2d').getImageData(0,0,c.width,c.height);let diff=0;for(let i=0;i<actual.data.length;i++)diff=Math.max(diff,Math.abs(actual.data[i]-expected.data[i]));
        return {width:image.width,height:image.height,expectedW:App.ensureRot().w,expectedH:App.ensureRot().h,diff,colour:image.colour};
      });assert.equal(r.width,r.expectedW);assert.equal(r.height,r.expectedH);assert(r.width>100&&r.height>100);assert(r.colour);assert.equal(r.diff,0);
    });
    await check('responsive inline comparison fits phone and manual draft creation sends no request',async()=>{
      await load();await p.locator('#aiLocal').click();const n=requests.length;await p.setViewportSize({width:390,height:844});
      await p.locator('[data-add="local"]').click();assert.equal(requests.length,n);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),390);
      const b=await p.locator('.ai-body').boundingBox();assert(b.x>=0&&b.x+b.width<=390);await p.screenshot({path:path.join(dir,'phone.png')});await p.setViewportSize({width:1440,height:1000});
    });
    await check('no unhandled page exceptions',async()=>assert.deepEqual(errors,[]));
  }finally{await ctx.close();}
  await check('single-file works offline with local comparison, manual edits, undo and project restoration',async()=>{
    const c=await browser.newContext({offline:true});try{
      const q=await c.newPage(),sent=[];q.on('request',r=>{if(/^https?:/.test(r.url()))sent.push(r.url());});
      await q.goto(pathToFileURL(path.join(root,'dist/GelFigure.html')).href+'?demo=1&lang=en');await q.waitForFunction(()=>document.title.startsWith('READY '),null,{timeout:120000});
      await q.evaluate(()=>MarkerAI.open());await q.locator('#aiLocal').click();await q.locator('[data-apply="local"]').click();
      const b=await q.evaluate(async()=>{const before=App.snapshot();App.S.lanes[1].name='Offline';App.commit();App.undo();const undo=App.snapshot()===before;await App.openProject(await (await App.projectBlob()).arrayBuffer());return {undo,restored:App.snapshot()===before,empty:MarkerAI.session===null};});
      assert(b.undo&&b.restored&&b.empty);assert.deepEqual(sent,[]);
    }finally{await c.close();}
  });
  await check('single-file explicit recognition uses the configured HTTPS endpoint and keeps keys out of exports',async()=>{
    const c=await browser.newContext();try{
      const q=await c.newPage(),sent=[],API2='https://singlefile.gelfigure.invalid/v1/chat/completions';
      q.on('request',r=>{if(/^https?:/.test(r.url()))sent.push(r.url());});
      await q.route(API2,async route=>{
        const body=route.request().postDataJSON(),meta=JSON.parse(body.messages[1].content[0].text),lad=meta.catalogue[0];
        await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({schema_version:1,gel_type:meta.selected_gel_type,image:{width:meta.image.width,height:meta.image.height},markers:[{x:.1,ladder_id:lad.id,candidates:[],bands:[{y:.2,size:lad.sizes[0]},{y:.4,size:lad.sizes[1]}]}]})}}]})});
      });
      await q.goto(pathToFileURL(path.join(root,'dist/GelFigure.html')).href+'?demo=1&lang=en');await q.waitForFunction(()=>document.title.startsWith('READY '),null,{timeout:120000});
      await q.evaluate(()=>MarkerAI.open());await q.evaluate(()=>MarkerAI.openSettings());await q.locator('#aiEndpoint').fill(API2);await q.evaluate(()=>MarkerAI.openSettings());await q.locator('#aiModel').fill(MODEL);await q.evaluate(()=>MarkerAI.openSettings());await q.locator('#aiKey').fill(SECRET);assert.deepEqual(sent,[]);
      if(await q.locator('#aiSettingsPanel').isVisible())await q.locator('#aiSettingsClose').click();await q.locator('#aiRecognize').click();await q.waitForFunction(()=>!MarkerAI.pending);assert(await q.evaluate(()=>!!MarkerAI.session.ai),'single-file AI response validated');
      assert.deepEqual(sent,[API2]);await q.evaluate(()=>MarkerAI.apply('ai'));assert(!(await q.evaluate(()=>JSON.stringify(App.projectData()))).includes(SECRET));
    }finally{await c.close();}
  });
  return results;
}
