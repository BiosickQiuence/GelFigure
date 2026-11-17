/* Preserve generated evidence before any test overwrites it. Does not change application code. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),archive=path.resolve(root,'..','generated-backups');
const writeSync=fs.writeFileSync.bind(fs),mkdir=fs.mkdirSync.bind(fs);let serial=0;
function preserve(file){
  if(typeof file!=='string'&&!(file instanceof URL)&&!Buffer.isBuffer(file))return;
  const target=path.resolve(file instanceof URL?require('node:url').fileURLToPath(file):String(file));
  if(!target.startsWith(root+path.sep)||!fs.existsSync(target)||!fs.statSync(target).isFile())return;
  const before=fs.readFileSync(target),name=path.join(archive,Date.now()+'-'+process.pid+'-'+serial+++'-'+path.relative(root,target).replace(/[\\/]/g,'__'));
  mkdir(archive,{recursive:true});writeSync(name,before,{flag:'wx'});
  const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
  if(hash(fs.readFileSync(name))!==hash(before)||hash(fs.readFileSync(target))!==hash(before))throw new Error('Test output backup mismatch: '+target);
}
fs.writeFileSync=function(file,...args){preserve(file);return writeSync(file,...args);};
const write=fs.writeFile.bind(fs);fs.writeFile=function(file,...args){preserve(file);return write(file,...args);};
const promise=fs.promises.writeFile.bind(fs.promises);fs.promises.writeFile=async function(file,...args){preserve(file);return promise(file,...args);};
