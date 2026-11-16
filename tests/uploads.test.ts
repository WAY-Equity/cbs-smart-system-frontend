import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
function harness(){
 let next=0,fail=false;
 const iterator=(items:any[])=>{let i=0;return{hasNext:()=>i<items.length,next:()=>items[i++]}};
 class File{
  id=String(++next);name:string;body:any;constructor(name:string,body:any){this.name=name;this.body=body}getId(){return this.id}setContent(body:any){this.body=body;return this}getBlob(){return{getDataAsString:()=>String(this.body),getBytes:()=>Buffer.from(this.body)}}
 }
 class Folder{
  files:File[]=[];folders:Folder[]=[];name:string;constructor(name:string){this.name=name}getFolders(){return iterator(this.folders)}getFoldersByName(name:string){return iterator(this.folders.filter(f=>f.name===name))}createFolder(name:string){const f=new Folder(name);this.folders.push(f);return f}getFilesByName(name:string){return iterator(this.files.filter(f=>f.name===name))}createFile(name:any,body?:any){if(typeof name==='object'){if(fail){fail=false;throw Error('temporary Drive failure')}body=name.bytes;name=name.name;}const f=new File(name,body);this.files.push(f);return f}
 }
 const root=new Folder('root');let unlocks=0;
 const c:any=vm.createContext({DriveApp:{getFolderById:()=>root},PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'invitation'})},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>unlocks++})},Utilities:{base64Decode:(s:string)=>Buffer.from(s,'base64'),base64Encode:(b:any)=>Buffer.from(b).toString('base64'),computeDigest:(_:any,b:any)=>createHash('sha256').update(b).digest(),DigestAlgorithm:{SHA_256:1},newBlob:(bytes:any,_:any,name:string)=>({bytes,name})}});
 vm.runInContext(readFileSync(new URL('../uploads/Code.gs',import.meta.url),'utf8'),c);
 return{c,root,fail:()=>{fail=true},unlocks:()=>unlocks};
}
const data=()=>({id:'12345678-1234-4234-8234-123456789012',explanation:'神戸の作業仕様書と報告書',files:[{name:'仕様書.txt',base64:Buffer.from('sample A').toString('base64')},{name:'報告書.txt',base64:Buffer.from('sample B').toString('base64')}]});
test('saves files and explanation together; retry returns the same receipt',()=>{const{c,root}=harness();const d=data();assert.equal(c.saveSubmission('invitation',d).files.length,2);assert.equal(c.saveSubmission('invitation',d).files.length,2);assert.equal(root.folders.length,1);assert.equal(root.folders[0].files.length,4);assert.equal(c.listSubmissions('invitation')[0].explanation,d.explanation);assert.equal(c.listSubmissions('invitation')[0].files[0].id,undefined);});
test('partial failure is not listed; retry resumes without duplicate folders',()=>{const h=harness();h.fail();assert.throws(()=>h.c.saveSubmission('invitation',data()),/temporary/);assert.equal(h.c.listSubmissions('invitation').length,0);assert.equal(h.c.saveSubmission('invitation',data()).files.length,2);assert.equal(h.root.folders.length,1);assert.equal(h.unlocks(),2);});
test('rejects unauthorized reads/writes, changed retries and invalid files',()=>{const{c,root}=harness();assert.throws(()=>c.saveSubmission('bad',data()));assert.throws(()=>c.listSubmissions('bad'));for(const patch of [{explanation:' '},{files:[]},{files:[{name:'../bad.txt',base64:'YQ=='}]},{files:[{name:'x',base64:'not base64'}]},{files:[{name:'x',base64:''}]},{files:Array(21).fill(data().files[0])},{files:[{name:'big',base64:Buffer.alloc(10*1024*1024+1).toString('base64')}]}]){assert.throws(()=>c.saveSubmission('invitation',{...data(),...patch}));}assert.equal(root.folders.length,0);c.saveSubmission('invitation',data());assert.throws(()=>c.saveSubmission('invitation',{...data(),explanation:'changed'}));});
