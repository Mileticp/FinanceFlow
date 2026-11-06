/* Race regressions for the actual finance auth/load/queue functions. No network. */
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function harness(){
 const calls=[],pending=[],nodes={};
 const cloud={auth:{signOut:async()=>{calls.push({signOut:true});return {}}},from:table=>{const query={table,filters:[]};const b={select:()=>b,eq:(key,value)=>{query.filters.push([key,value]);return b},order:()=>b,maybeSingle:()=>b,upsert:row=>{query.row=row;return b},insert:row=>{query.row=row;return b},then:(resolve,reject)=>{calls.push(query);const task=deferred();pending.push({query,...task});return task.promise.then(resolve,reject)}};return b}};
 const context=vm.createContext({resetShiftEditor:()=>{},FFShift:require('../js/shift-time.js'),cloud,console,JSON,Date,Error,Promise,setTimeout,initial:()=>({transactions:[],shifts:[],budgets:{},paySettings:{}}),normalize:v=>v,render:()=>{},renderWork:()=>{},status:()=>{},cloudError:()=>{},confirm:()=>true,v2:{reset:()=>{},connect:()=>{}},$:id=>nodes[id]??=( {classList:{add(){},remove(){}},textContent:''})});
 const names=['save','loadCloud','shiftFromRow','refreshShifts','addShiftToCloud','signedIn'];
 const source=html.split('\n').filter(line=>names.some(name=>line.startsWith('function '+name+'(')||line.startsWith('async function '+name+'('))).join('\n');
 vm.runInContext("let currentUser=null,ready=false,writeQueue=Promise.resolve(),dirty=false,legacyShifts=[],authGeneration=0,data=initial();\n"+source,context);
 return {calls,pending,nodes,run:code=>vm.runInContext(code,context),context};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('late finance response from A cannot populate B dashboard',async()=>{
 const h=harness();const a=h.run("signedIn({id:'a'})");await tick();assert.equal(h.pending[0].query.filters[0][1],'a');
 const b=h.run("signedIn({id:'b'})");await tick();
 h.pending[1].resolve({data:{payload:{transactions:[{description:'B'}],shifts:[]}}});await tick();
 h.pending[2].resolve({data:[]});await b;
 h.pending[0].resolve({data:{payload:{transactions:[{description:'PRIVATE A'}],shifts:[]}}});await a;
 assert.equal(h.run('data.transactions[0].description'),'B');assert.equal(h.run('currentUser.id'),'b');assert.equal(h.run('ready'),true);
});
test('late shift response after signout cannot repopulate records',async()=>{
 const h=harness();h.run("currentUser={id:'a'};data={shifts:[]}");const load=h.run("refreshShifts()");await tick();
 h.run('authGeneration++;currentUser=null;ready=false;data=initial()');h.pending[0].resolve({data:[{id:'private',hours:8}]});await load;
 assert.equal(h.run('data.shifts.length'),0);
});
test('shift lookup cannot continue an insert under a newly selected account',async()=>{
 const h=harness();h.run("currentUser={id:'a'};ready=true");const insert=h.run("addShiftToCloud({date:'2026-01-01',hours:2})");await tick();
 h.run("authGeneration++;currentUser={id:'b'}");h.pending[0].resolve({data:[]});await assert.rejects(insert,/Account changed/);assert.equal(h.calls.length,1);
});
test('queued finance snapshot never writes into a switched account',async()=>{
 const h=harness(),gate=deferred();h.context.gate=gate.promise;
 h.run("currentUser={id:'a'};ready=true;writeQueue=gate;save();authGeneration++;currentUser={id:'b'}");
 gate.resolve();await h.run('writeQueue');assert.equal(h.calls.length,0);
});

test('explicit signout finishes queued owner saves before revoking auth',async()=>{
 const h=harness(),gate=deferred();h.context.gate=gate.promise;
 h.run("currentUser={id:'a'};ready=true;writeQueue=gate;save()");
 const line=html.split('\n').find(line=>line.startsWith("$('signOutBtn').onclick="));h.run(line);
 const signingOut=h.nodes.signOutBtn.onclick();gate.resolve();await tick();
 assert.equal(h.pending[0].query.row.user_id,'a');assert.equal(h.calls.some(c=>c.signOut),false);
 h.pending[0].resolve({error:null});await signingOut;assert.equal(h.calls.at(-1).signOut,true);assert.equal(h.run('currentUser'),null);assert.equal(h.run('ready'),false);
});
