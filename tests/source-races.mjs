import './backup-outputs.cjs';import assert from 'node:assert/strict';import fs from 'node:fs';import http from 'node:http';import path from 'node:path';import {fileURLToPath} from 'node:url';import {chromium,firefox,webkit} from 'playwright';
const root=path.resolve(process.env.GELFIG_TEST_ROOT||fileURLToPath(new URL('..',import.meta.url))),server=http.createServer((req,res)=>{const name=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!name.startsWith(root+path.sep)||!fs.existsSync(name)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.css')?'text/css':'text/javascript');fs.createReadStream(name).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let good=true;
try{for(const engine of process.argv.slice(2).length?process.argv.slice(2):['chromium','firefox','webkit']){
  const b=await ({chromium,firefox,webkit}[engine]).launch(),p=await b.newPage();
  try{
    await p.goto('http://127.0.0.1:'+server.address().port+'/index.html?lang=en');await p.waitForFunction(()=>window.App);
    for(const kind of ['load','openProject','restoreHistory','current-exposure','out-of-order','busy-owner']){
      const r=await p.evaluate(async kind=>{
        App.forceJsHash=true;const make=(name,shift)=>({name,buffer:Demo.encodeTiff16({width:80,height:100,data:Float32Array.from({length:8000},(_,i)=>(i%80)/160+shift)})});
        const capture=async()=>({state:App.snapshot(),sha:await App.sha256(App.srcBuffer),pixel:App.rawSrc.data[0],id:App.projectId,hist:JSON.stringify(App.hist),exposures:App.exposures?.map(e=>e.sha256)||null,index:App.expIdx});
        await App.load(make('new-project.tif',.45));await App.saveDraft();const newId=App.projectId,project=await (await App.projectBlob()).arrayBuffer();
        await App.loadMany([make('old-A.tif',.1),make('old-B.tif',.3),make('old-C.tif',.2)]);
        const targets=[0,1,2].filter(i=>i!==App.expIdx),firstTarget=targets[0],secondTarget=targets[1],decode=TIFF.decodeBuffer,barriers=new Map();
        for(const k of targets){let release,entered;const gate=new Promise(r=>release=r),inside=new Promise(r=>entered=r);barriers.set(App.exposures[k].name,{gate,inside,release,entered});}
        TIFF.decodeBuffer=async(buffer,name)=>{const barrier=barriers.get(name);if(barrier){barrier.entered();await barrier.gate;}return decode(buffer,name);};
        let result,before,after,busy;
        try{
          const first=App.switchExposure(firstTarget);await barriers.get(App.exposures[firstTarget].name).inside;
          if(kind==='out-of-order'||kind==='busy-owner'){
            const name=App.exposures[secondTarget].name,second=App.switchExposure(secondTarget);await barriers.get(name).inside;
            if(kind==='busy-owner'){
              barriers.get(App.exposures[firstTarget].name).release();result=await first;busy=!document.getElementById('busy').classList.contains('hidden');barriers.get(name).release();await second;before=after=await capture();
            }else{barriers.get(name).release();await second;before=await capture();barriers.get(App.exposures[firstTarget].name).release();result=await first;after=await capture();}
          }else if(kind==='current-exposure'){
            before=await capture();await App.switchExposure(App.expIdx);for(const barrier of barriers.values())barrier.release();result=await first;after=await capture();
          }else{
            if(kind==='load')await App.load(make('fresh-new.tif',.45));
            else if(kind==='openProject')await App.openProject(project);
            else await App.restoreHistory(newId);
            before=await capture();for(const barrier of barriers.values())barrier.release();result=await first;after=await capture();
          }
        }finally{for(const barrier of barriers.values())barrier.release();TIFF.decodeBuffer=decode;}
        return {before,after,result,busy,expectedIndex:secondTarget};
      },kind);
      try{assert.deepEqual(r.after,r.before);assert.equal(r.result.ok,false);assert.equal(r.result.stale,true);if(kind==='out-of-order'||kind==='busy-owner')assert.equal(r.after.index,r.expectedIndex);if(kind==='busy-owner')assert(r.busy);console.log(engine,'PASS','source generation: '+kind);}catch(e){good=false;console.error(engine,'FAIL','source generation: '+kind,e.message);}
    }
  }finally{await b.close();}
}}finally{server.close();}
if(!good)process.exitCode=1;
