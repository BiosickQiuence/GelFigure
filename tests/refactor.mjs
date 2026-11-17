/* Independent TIFF values and continuous user actions, without live API requests. */
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium,firefox,webkit} from 'playwright';
const root=process.argv.find(a=>a.startsWith('--root='))?.slice(7)||fileURLToPath(new URL('..',import.meta.url));
const engine=process.argv.find(a=>a.startsWith('--browser='))?.slice(10)||'chromium';
const browser=await ({chromium,firefox,webkit}[engine]).launch();
const page=await browser.newPage({viewport:{width:1440,height:1000}}),failures=[];
const check=async(name,fn)=>{try{await fn();console.log('PASS',engine,name);}catch(e){failures.push(name);console.error('FAIL',engine,name,e.message);}};
function tiff32(le,format=1,predictor=2){
  const values=[0x10000000,0x30000000,0x60000000,0xf0000000,0x10000000,0x70000000],raw=Buffer.alloc(24);
  values.forEach((v,i)=>raw[le?'writeUInt32LE':'writeUInt32BE'](predictor===2&&i%3?(v-values[i-1])>>>0:v,i*4));
  const compressed=deflateSync(raw),offset=8+2+11*12+4,out=Buffer.alloc(offset+compressed.length);
  const u16=(p,v)=>out[le?'writeUInt16LE':'writeUInt16BE'](v,p),u32=(p,v)=>out[le?'writeUInt32LE':'writeUInt32BE'](v,p);
  out.write(le?'II':'MM');u16(2,42);u32(4,8);u16(8,11);
  [[256,4,3],[257,4,2],[258,3,32],[259,3,8],[262,3,1],[273,4,offset],[277,3,1],[278,4,2],[279,4,compressed.length],[317,3,predictor],[339,3,format]].forEach(([tag,type,v],i)=>{const p=10+i*12;u16(p,tag);u16(p+2,type);u32(p+4,1);(type===3?u16:u32)(p+8,v);});
  compressed.copy(out,offset);return [...out];
}
try{
  await page.goto(pathToFileURL(path.join(root,'index.html')).href+'?demo=1&lang=en');
  await page.waitForFunction(()=>window.App?.S);
  await check('32-bit horizontal predictor restores independent little/big-endian pixels',async()=>{
    for(const le of [true,false]){
      const data=await page.evaluate(async bytes=>[...(await TIFF.decodeBuffer(Uint8Array.from(bytes).buffer,'known.tif')).data],tiff32(le));
      [1/16,3/16,6/16,15/16,1/16,7/16].forEach((v,i)=>assert(Math.abs(data[i]-v)<1e-7,`${le} pixel ${i}: ${data[i]} vs ${v}`));
    }
  });
  await check('unsupported float/predictor combinations are explicitly rejected',async()=>{
    const rejected=await page.evaluate(async bytes=>{try{await TIFF.decodeBuffer(Uint8Array.from(bytes).buffer,'bad.tif');return false;}catch(e){return /predictor/i.test(e.message);}},tiff32(true,3));assert(rejected);
  });
  await check('exposure switch → undo → save → reopen preserves bytes, pixels and identity',async()=>{
    const result=await page.evaluate(async()=>{
      App.forceJsHash=true;
      const make=(name,shift)=>({name,buffer:Demo.encodeTiff16({width:80,height:100,data:Float32Array.from({length:8000},(_,i)=>(i%80)/160+shift)})});
      await App.loadMany([make('A.tif',.1),make('B.tif',.3)]);
      const first=App.expIdx,next=1-first,sha=App.S.file.sha256,pixel=App.rawSrc.data[0];
      await App.switchExposure(next);App.undo();
      const undone={sha:App.S.file.sha256,bytes:await App.sha256(App.srcBuffer),index:App.expIdx,pixel:App.rawSrc.data[0]};
      App.redo();const redone=App.expIdx;App.undo();
      const data=await App.projectBlob();let opened=true;try{await App.openProject(await data.arrayBuffer());}catch(e){opened=e.message;}
      return {first,next,sha,pixel,undone,redone,opened};
    });
    assert.equal(result.undone.bytes,result.sha);assert.equal(result.undone.index,result.first);assert.equal(result.undone.pixel,result.pixel);assert.equal(result.redone,result.next);assert.equal(result.opened,true);
  });
  await check('failed perspective application leaves state, source caches and undo intact',async()=>{
    const r=await page.evaluate(()=>{
      const before=App.snapshot(),state=App.S,raw=App.srcBuffer,hist=JSON.stringify(App.hist),src=App.src,old=App.autoLanes;
      App.autoLanes=()=>{throw new Error('injected detection failure');};
      const c=App.S.crop,points=[{x:c.x,y:c.y},{x:c.x+c.w-1,y:c.y},{x:c.x+c.w-1,y:c.y+c.h-1},{x:c.x,y:c.y+c.h-1}];
      try{Perspective.apply(points);}catch(e){}finally{App.autoLanes=old;}
      return {same:before===App.snapshot(),identity:state===App.S,bytes:raw===App.srcBuffer,cache:src===App.src,history:hist===JSON.stringify(App.hist)};
    });assert.deepEqual(r,{same:true,identity:true,bytes:true,cache:true,history:true});
  });
}finally{await browser.close();}
if(failures.length)process.exitCode=1;
