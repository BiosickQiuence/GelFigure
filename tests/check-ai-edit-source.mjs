/* Focused provenance regression on tiny synthetic images; no vision requests are made. */
import assert from 'node:assert/strict';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
import {chromium,firefox,webkit} from 'playwright';
const root=fileURLToPath(new URL('..',import.meta.url)),engines=process.argv.slice(2).length?process.argv.slice(2):['chromium','firefox','webkit'];
let ok=true;
for(const name of engines){
  const b=await ({chromium,firefox,webkit}[name]).launch();try{
    const p=await b.newPage(),requests=[],errors=[];p.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});p.on('pageerror',e=>errors.push(e.message));
    await p.goto(pathToFileURL(path.join(root,'dist/GelFigure.html')).href+'?lang=en');
    const r=await p.evaluate(async()=>{
      App.forceJsHash=true;await App.load({name:'synthetic-tiny.tif',buffer:Demo.encodeTiff16({width:60,height:100,data:new Float32Array(6000).fill(.15)})});
      App.setGelType('dna');App.S.crop={x:0,y:0,w:60,h:100};App.S.lanes=[{x:15,name:'A',hidden:false},{x:45,name:'B',hidden:false}];App.S.markers=[];App.S.lanePitch=30;App.commit();
      const lad=Ladders.all('dna')[0],checks=[];
      for(const method of ['local','ai']){
        MarkerAI.captureLocal();MarkerAI.session[method]={method,scope:null,rows:[{x:15,target:0,ladderId:lad.id,candidates:[],bands:[{y:20,size:lad.sizes[0]},{y:80,size:lad.sizes[1]}],selected:true,edited:true}]};
        MarkerAI.apply(method,true);await App.openProject(await (await App.projectBlob()).arrayBuffer());
        const original=App.lanePeaks;let peaks=0;App.lanePeaks=()=>{peaks++;throw new Error('Fixed editing must not peak-match');};
        try{
          MarkerAI.editMarker(0);const draft=MarkerAI.session[method];
          checks.push({case:method+' editor preserves originating source',pass:!!draft&&draft.rows[0].edited&&draft.rows[0].target===0});
          if(!draft)continue;
          draft.rows[0].bands[0].y=21.25;MarkerAI.apply(method,true);
          checks.push({case:method+' manual application keeps exact coordinates and provenance',pass:App.S.markers[0].bands[0].y===21.25&&App.S.markers[0].recognition.method===method&&App.S.markers[0].recognition.edited&&peaks===0});
          const saved=App.projectData();checks.push({case:method+' persistence keeps only adopted source',pass:JSON.parse(saved.initial).markerRecognition.method===method&&saved.state.markerRecognition.method===method});
        }finally{App.lanePeaks=original;}
      }
      return checks;
    });
    for(const c of r)console.log(name,c.pass?'PASS':'FAIL',c.case);assert(r.length===6&&r.every(c=>c.pass));assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);console.log(name,'PASS no recognition requests or page exceptions');
  }catch(e){ok=false;console.log(name,'FAIL',e.message);}finally{await b.close();}
}
process.exitCode=ok?0:1;
