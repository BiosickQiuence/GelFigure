import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';import {chromium,firefox,webkit} from 'playwright';
const root=fileURLToPath(new URL('..',import.meta.url));
for(const engine of process.argv.slice(2).length?process.argv.slice(2):['chromium','firefox','webkit']){
  const b=await ({chromium,firefox,webkit}[engine]).launch(),p=await b.newPage();
  try{
    await p.goto(pathToFileURL(path.join(root,'dist/GelFigure.html')).href+'?lang=en');
    const results=await p.evaluate(async()=>{
      App.forceJsHash=true;const results=[],ok=(name,pass)=>{if(!pass)throw new Error(name);results.push(name);};
      const setup=async()=>{
        await App.load({name:'known-synthetic.tif',buffer:Demo.encodeTiff16({width:201,height:141,data:Float32Array.from({length:201*141},(_,i)=>.1+.7*(i%201)/201)})});
        App.setGelType('protein');App.setRotation(0);App.S.crop={x:0,y:0,w:201,h:141};App.S.lanes=[40,100,160].map(x=>({x,name:'Sample',hidden:false}));App.S.markers=[];App.S.lanePitch=60;App.commit();
      };
      await setup();MarkerAI.open();MarkerAI.captureLocal();
      MarkerAI.session.ai={method:'ai',scope:null,rows:[{x:40,target:0,ladderId:'biorad_dual',candidates:[],selected:true,edited:true,bands:[{y:25,size:250},{y:65,size:150},{y:110,size:100}]}]};MarkerAI.apply('ai',true);
      const adopted=App.S.markers[0].bands.map(b=>[b.bp,b.y]),adoptedState=App.snapshot();
      App.resetAll();App.resetAll();ok('repeated live resets preserve the explicit adopted baseline',App.snapshot()===adoptedState);
      Perspective.apply([{x:4,y:4},{x:196,y:4},{x:196,y:136},{x:4,y:136}]);
      let log=Export.processingLog(App.S);
      ok('manual rectification reports current local markers and preserves the historical AI adoption',log.lastMarkerAdoption.method==='ai'&&App.S.currentSources.markers==='local'&&log.currentSources.markers.every(m=>m.method==='local'));
      await App.openProject(await (await App.projectBlob()).arrayBuffer());App.resetAll();
      ok('save, reopen and reset use the explicit adopted source-bound baseline',JSON.stringify(App.S.markers[0].bands.map(b=>[b.bp,b.y]))===JSON.stringify(adopted)&&App.S.markers[0].recognition.method==='ai');
      const extra=Demo.encodeTiff16({width:201,height:141,data:Float32Array.from({length:201*141},(_,i)=>.1+.6*(i%201)/201)}),first={name:App.S.file.name,buffer:App.srcBuffer};
      await App.loadMany([first,{name:'exposure-B.tif',buffer:extra}]);MarkerAI.open();MarkerAI.captureLocal();MarkerAI.session.ai={method:'ai',scope:null,rows:[]};MarkerAI.apply('ai',true);
      await App.switchExposure(1-App.expIdx);const sha=App.S.file.sha256;await App.openProject(await (await App.projectBlob()).arrayBuffer());App.resetAll();
      ok('an adopted baseline follows exposure replacement and never resets to missing bytes',App.S.file.sha256===sha&&await App.sha256(App.srcBuffer)===sha);
      await setup();GelAIBeta.open();const q=(a,b,c,d)=>[{x:a,y:b},{x:c,y:b},{x:c,y:d},{x:a,y:d}];
      GelAIBeta.showPreview({schema_version:1,image:{width:201,height:141},plane_quad:q(0,0,1,1),lane_count:3,lanes:[.15,.45,.75].map(x=>({status:'active',quad:q(x,.2,x+.1,.8)}))});GelAIBeta.apply();
      const before=App.snapshot();App.setOrient('r90');const after=App.snapshot();log=Export.processingLog(App.S);
      ok('quarter turn distinguishes the AI crop adoption from freshly detected current lanes',log.aiLayoutRecognition.adoptionSnapshot&&log.currentSources.lanes==='local'&&log.currentSources.visibleLanes===App.figureLanes().filter(i=>!App.S.lanes[i].hidden).length);
      App.undo();ok('undo restores the complete AI layout state',App.snapshot()===before);App.redo();ok('redo restores the rebuilt lane state',App.snapshot()===after);
      const saved=App.snapshot();await App.openProject(await (await App.projectBlob()).arrayBuffer());ok('transformed AI geometry survives project reopening',App.snapshot()===saved);
      await setup();const baseline=App.snapshot(),state=App.S,cache=App.src,keys=Object.keys(App).sort().join(),detect=App.autoMarkers;
      App.autoMarkers=()=>{App.syntheticTransientCache=123;throw new Error('injected marker failure');};
      try{Perspective.apply([{x:4,y:4},{x:196,y:4},{x:196,y:136},{x:4,y:136}]);}catch(e){}finally{App.autoMarkers=detect;}
      ok('failed marker detection also removes newly created transient caches',baseline===App.snapshot()&&state===App.S&&cache===App.src&&keys===Object.keys(App).sort().join());
      const preset=App.styleTemplate('Shared');App.setPref('stylePreset',preset);await setup();ok('lab default applies to the next image without sample text',App.S.style.fontPt===preset.style.fontPt&&!('panelLetter'in preset.style)&&!('lanes'in preset));App.setPref('stylePreset',null);
      const small=App.styleTemplate('Safe DPI width');small.style.autoWidth=false;small.style.gelWidthMm=6;App.applyStyleTemplate(small);ok('positive safe widths below 10 mm round-trip through appearance presets',App.S.style.gelWidthMm===6);
      App.S.style.autoWidth=false;App.S.style.gelWidthMm=25;App.S.style.dpi=300;App.commit();
      const kinds={};
      for(const format of ['png','tiff','pptx','svg']){const before=App.snapshot(),blob=await Export.reviewPackage(App.S,format);ok(format+' package preserves the project',before===App.snapshot());kinds[format]=[...new Uint8Array(await blob.arrayBuffer())];}
      return {results,kinds};
    });
    const unzip=bytes=>{const b=Buffer.from(bytes),out={};let pos=0;while(b.readUInt32LE(pos)===0x04034b50){const n=b.readUInt16LE(pos+26),x=b.readUInt16LE(pos+28),length=b.readUInt32LE(pos+18),start=pos+30+n+x;out[b.toString('utf8',pos+30,pos+30+n)]=b.subarray(start,start+length);pos=start+length;}return out;};
    for(const [kind,bytes] of Object.entries(results.kinds)){
      const zip=unzip(bytes),name='figure.'+(kind==='tiff'?'tif':kind);assert(zip[name]?.length>0);
      if(kind==='png'){assert.equal(zip[name].toString('ascii',1,4),'PNG');assert(zip[name].includes(Buffer.from('pHYs')));}
      if(kind==='tiff')assert.equal(zip[name].toString('ascii',0,2),'II');
      if(kind==='pptx')assert(unzip(zip[name])['ppt/slides/slide1.xml']);
      if(kind==='svg')assert(zip[name].toString().includes('<svg'));
    }
    for(const name of results.results)console.log(engine,'PASS',name);
  }finally{await b.close();}
}
