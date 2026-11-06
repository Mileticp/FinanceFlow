/* Real service-worker lifecycle, rooted at the GitHub Pages subdirectory. No production APIs. */
const {generate}=require('../scripts/build-shell.cjs'),os=require('node:os');
const release=require('../shell-release.json'),CACHE='financeflow-shell-'+release.version;
const {chromium,devices}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const mobile={isMobile:true,hasTouch:true,deviceScaleFactor:1,userAgent:devices['Pixel 5'].userAgent};
const root=path.resolve(__dirname,'..'),old=require('./fixtures/releases/v2.0.1.json'),broken=require('./fixtures/releases/v2.1.0.json');
const mock=`window.supabase={createClient:()=>({auth:{getUser:async()=>({data:{user:{id:'11111111-1111-4111-8111-111111111111',email:'synthetic@example.com'}}}),onAuthStateChange:()=>({}),signOut:async()=>({})},from:()=>{const b={select:()=>b,eq:()=>b,order:()=>b,range:()=>b,maybeSingle:()=>b,then:resolve=>Promise.resolve({data:[],error:null}).then(resolve)};b.maybeSingle=()=>({then:resolve=>Promise.resolve({data:null,error:null}).then(resolve)});return b}})};`;
(async()=>{
 let browser,server,phase='old',futureRoot;const requests=[],pageErrors=[];let future;
 const watch=page=>page.on('pageerror',error=>pageErrors.push({phase,message:error.message}));
 const current=file=>fs.existsSync(path.join(root,file))?fs.readFileSync(path.join(root,file)):null;
 try{
 server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost'),file=url.pathname.replace(/^\/FinanceFlow\//,'')||'index.html';
  requests.push({phase,file,search:url.search});
  if(!url.pathname.startsWith('/FinanceFlow/')){res.writeHead(404);res.end();return;}
  // A reachable new navigation plus failed/reused subresources is the old-worker failure mode.
  if(phase==='broken'&&['css/v2.css','js/app.js','sw.js'].includes(file)){req.socket.destroy();return;}
  if(phase==='next-offline'&&future&&file===future.css){req.socket.destroy();return;}
  if(phase==='mixed-v2.1'&&['css/v2.css','js/app.js'].includes(file)){res.setHeader('Content-Type',file.endsWith('.css')?'text/css':'text/javascript');res.end(old.files[file]);return;}
  if(phase==='next-broken'&&future&&file===future.css){res.setHeader('Content-Type','text/css');res.end('/* stale CDN response, deliberately wrong release */');return;}
  const fixture=phase==='old'?old:['broken','mixed-v2.1'].includes(phase)?broken:null;
  const body=fixture?.files[file]??(phase.startsWith('next')&&future?(future.outputs[file]??current(file)):current(file));
  if(body===null){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':file.endsWith('.webmanifest')?'application/manifest+json':'text/html');
  res.setHeader('Cache-Control','no-cache');res.end(body);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({...mobile,viewport:{width:320,height:844}}),page=await context.newPage();
 watch(page);
 await context.addInitScript({content:mock+"\nconst ffMock=window.supabase;Object.defineProperty(window,'supabase',{configurable:true,get:()=>ffMock,set:()=>{}});"});
 const base=`http://127.0.0.1:${server.address().port}/FinanceFlow/`;
 await page.goto(base);await page.waitForFunction(()=>document.querySelector('#appStatus').textContent.includes('Cloud connected'));await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();
 await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
 assert.ok(await page.evaluate(()=>caches.has('financeflow-shell-v2.0.1')));
 phase='broken';await page.reload();await page.waitForFunction(()=>document.querySelector('#overviewView').textContent.includes('Your day, in balance'));
 const reproduced=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>320,documentWidth:document.documentElement.scrollWidth,layoutViewport:innerWidth,icon:document.querySelector('.top svg.icon').getBoundingClientRect().width,oldHeading:document.querySelector('#overviewView').textContent.includes('Your day, in balance'),secondaryVisible:getComputedStyle(document.querySelector('[data-view=work]')).display!=='none'}));
 assert.equal(reproduced.oldHeading,true);assert.equal(reproduced.secondaryVisible,true);assert.ok(reproduced.icon>100);assert.equal(reproduced.overflow,true);
 fs.mkdirSync(path.join(root,'test-results/pwa'),{recursive:true});await page.screenshot({path:path.join(root,'test-results/pwa/reproduced-mixed-320.png')});
 console.log('Reproduced actual v2.0.1 worker fallback mixing new HTML with old CSS/JS:',reproduced);
 if(process.env.FF_REPRO_ONLY)return;
 // Keep representative private browser storage intact while shell caches migrate.
 await page.evaluate(async()=>{localStorage.setItem('ff-upgrade-sentinel','synthetic saved state');const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('ff-upgrade-test',1);r.onupgradeneeded=()=>r.result.createObjectStore('records');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});await new Promise(resolve=>{const t=db.transaction('records','readwrite');t.objectStore('records').put('synthetic record','saved');t.oncomplete=resolve});db.close();await caches.open('unrelated-test-cache');});
 phase='fixed';await page.reload();
 await page.waitForFunction(async CACHE=>(await caches.keys()).includes(CACHE)&&!(await caches.keys()).includes('financeflow-shell-v2.0.1'),CACHE);
 await page.reload();
 const waitReady=page=>page.waitForFunction(()=>document.querySelector('#appStatus')?.textContent.includes('Cloud connected')).catch(async error=>{console.error('PWA diagnostics',await page.evaluate(()=>({release:document.querySelector('meta[name=financeflow-release]')?.content,status:document.querySelector('#appStatus')?.textContent,authError:document.querySelector('#authError')?.textContent,scripts:[...document.scripts].map(s=>s.src),supabase:!!window.supabase})));throw error;});
 await waitReady(page);
 const layout=async page=>{
  for(const width of [320,360,390,430]){
   await page.setViewportSize({width,height:844});
   for(const view of ['overview','finance','work','nutrition','weight','statistics','settings']){
    await page.evaluate(view=>{location.hash=view;dispatchEvent(new HashChangeEvent('hashchange'))},view);
    await page.waitForFunction(view=>!document.getElementById(view+'View').classList.contains('hidden'),view);
    const state=await page.evaluate(width=>({overflow:document.documentElement.scrollWidth>width,icons:[...document.querySelectorAll('.top svg.icon,.tabs svg.icon')].map(el=>el.getBoundingClientRect().width).filter(Boolean),definition:document.querySelector('.icon-definitions').getBoundingClientRect().width,secondary:getComputedStyle(document.querySelector('[data-view=work]')).display}),width);
    assert.equal(state.overflow,false,`${width}px ${view}`);assert.ok(state.icons.every(size=>size<=28&&size>=20));assert.equal(state.definition,0);assert.equal(state.secondary,'none');
   }
  }
  await page.evaluate(()=>{location.hash='overview'});await page.waitForFunction(()=>document.querySelector('#overviewView').textContent.includes('Everything, in view.'));
 };
 await layout(page);await page.setViewportSize({width:320,height:844});await page.screenshot({path:path.join(root,'test-results/pwa/upgraded-320.png')});
 assert.equal(await page.evaluate(()=>localStorage.getItem('ff-upgrade-sentinel')),'synthetic saved state');
 assert.equal(await page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('ff-upgrade-test');r.onsuccess=()=>{const db=r.result,q=db.transaction('records').objectStore('records').get('saved');q.onsuccess=()=>{resolve(q.result);db.close()}}})),'synthetic record');
 assert.equal(await page.evaluate(()=>caches.has('unrelated-test-cache')),true);
 await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded',timeout:15000}).catch(async error=>{console.error('Offline diagnostic',await page.evaluate(()=>({state:document.readyState,release:document.querySelector('meta[name=financeflow-release]')?.content,status:document.querySelector('#appStatus')?.textContent,controller:!!navigator.serviceWorker.controller,resources:performance.getEntriesByType('resource').map(r=>r.name)})));throw error;});assert.equal(await page.locator('meta[name=financeflow-release]').getAttribute('content'),release.version);assert.equal(await page.locator('.top svg.icon').first().evaluate(el=>getComputedStyle(el).fill),'none');await context.setOffline(false);
 const keys=await page.evaluate(async CACHE=>(await (await caches.open(CACHE)).keys()).map(r=>new URL(r.url).pathname),CACHE);
 assert.ok(keys.every(key=>release.assets.some(asset=>'/FinanceFlow/'+asset.url.slice(2)===key)));assert.ok(!keys.some(key=>/mock-api|private|history.json/.test(key)));assert.ok(keys.some(key=>key.includes('/shell/supabase.min.')));
 // Same human version, changed content: generated hashes must invalidate a future deployment.
 futureRoot=fs.mkdtempSync(path.join(os.tmpdir(),'financeflow-next-'));
 for(const file of ['index.html','sw.js','package.json','css/v2.css','js/motion.js','js/shift-time.js','js/core.js','js/importer.js','js/app.js','js/sw-client.js','vendor/supabase.min.js','food.html','manifest.webmanifest','icon-192.png','icon-512.png']){const target=path.join(futureRoot,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,file),target);}
 fs.appendFileSync(path.join(futureRoot,'css/v2.css'),'\n/* Synthetic next deployment. */\n');
 const outputs=generate(futureRoot),nextRelease=JSON.parse(outputs['shell-release.json']);
 future={outputs,release:nextRelease,css:nextRelease.assets.find(a=>a.url.endsWith('.css')).url.slice(2)};
 assert.notEqual(nextRelease.version,release.version);
 const registrationUpdate=async(page,reject)=>page.evaluate(reject=>new Promise(async(resolve,fail)=>{
  const timer=setTimeout(()=>fail('Worker update did not reach expected state'),20000);const registration=await navigator.serviceWorker.getRegistration();
  registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker.addEventListener('statechange',()=>{if(worker.state===(reject?'redundant':'activated')){clearTimeout(timer);resolve()}})},{once:true});
  try{await registration.update()}catch(error){fail(error.message)}
 }),reject);
 for(const failedPhase of ['next-offline','next-broken']){phase=failedPhase;await registrationUpdate(page,true);assert.equal(await page.evaluate(CACHE=>caches.has(CACHE),CACHE),true);}
 assert.equal(await page.evaluate(()=>document.querySelector('meta[name=financeflow-release]').content),release.version);
 assert.equal(await page.evaluate(CACHE=>caches.has(CACHE),CACHE),true);
 assert.equal(await page.evaluate(name=>caches.has('financeflow-shell-'+name),nextRelease.version),false);
 await page.reload();await waitReady(page);assert.equal(await page.locator('meta[name=financeflow-release]').getAttribute('content'),release.version);
 await page.evaluate(()=>{location.hash='finance'});await page.locator('#description').fill('Unsaved synthetic edit');
 phase='next';await registrationUpdate(page,false);await page.waitForSelector('#shellUpdate');
 assert.equal(await page.inputValue('#description'),'Unsaved synthetic edit','Updating must not reload an open form');
 assert.equal(await page.locator('meta[name=financeflow-release]').getAttribute('content'),release.version);
 await page.click('#shellUpdate button');await waitReady(page);assert.equal(await page.locator('meta[name=financeflow-release]').getAttribute('content'),nextRelease.version);
 assert.equal(await page.evaluate(()=>localStorage.getItem('ff-upgrade-sentinel')),'synthetic saved state');
 // An already-installed v2.1.0 worker can itself hold a mixed precache.
 phase='mixed-v2.1';const mixed=await browser.newContext({...mobile,viewport:{width:320,height:844}}),mixedPage=await mixed.newPage();
 watch(mixedPage);await mixed.addInitScript({content:mock+"\nconst ffMock=window.supabase;Object.defineProperty(window,'supabase',{configurable:true,get:()=>ffMock,set:()=>{}});"});await mixedPage.goto(base);await mixedPage.evaluate(()=>navigator.serviceWorker.ready);await mixedPage.reload();
 assert.equal(await mixedPage.evaluate(()=>caches.has('financeflow-shell-v2.1.0')),true);assert.ok(await mixedPage.locator('.top svg.icon').first().evaluate(el=>el.getBoundingClientRect().width>100));
 phase='fixed';await mixedPage.reload();await mixedPage.waitForFunction(async CACHE=>(await caches.keys()).includes(CACHE)&&!(await caches.keys()).includes('financeflow-shell-v2.1.0'),CACHE);await mixedPage.reload();await waitReady(mixedPage);await layout(mixedPage);await mixed.close();
 phase='fixed';const fresh=await browser.newContext({...mobile,viewport:{width:320,height:844}}),freshPage=await fresh.newPage();
 watch(freshPage);await fresh.addInitScript({content:mock+"\nconst ffMock=window.supabase;Object.defineProperty(window,'supabase',{configurable:true,get:()=>ffMock,set:()=>{}});"});
 await freshPage.goto(base);await waitReady(freshPage);await freshPage.evaluate(()=>navigator.serviceWorker.ready);await layout(freshPage);
 await freshPage.evaluate(()=>{location.hash='finance'});await freshPage.locator('[data-action=focus-form]:visible').click();assert.ok(await freshPage.locator('#type').evaluate(el=>document.activeElement===el));
 await freshPage.goto(base+'#work');await waitReady(freshPage);assert.equal(await freshPage.locator('#workView').isVisible(),true);await fresh.close();
 // Even with the stylesheet absent, SVG presentation attributes must prevent 300px black icons.
 const bare=await browser.newContext({...mobile,viewport:{width:320,height:844},serviceWorkers:'block'}),barePage=await bare.newPage();
 watch(barePage);await bare.addInitScript({content:mock+"\nconst ffMock=window.supabase;Object.defineProperty(window,'supabase',{configurable:true,get:()=>ffMock,set:()=>{}});"});await bare.route('**/shell/*.css',route=>route.abort());await barePage.goto(base);
 const safe=await barePage.locator('.top svg.icon').first().evaluate(el=>({width:el.getBoundingClientRect().width,fill:getComputedStyle(el).fill}));assert.equal(safe.width,21);assert.equal(safe.fill,'none');assert.equal(await barePage.locator('.icon-definitions').evaluate(el=>el.getBoundingClientRect().width),0);await bare.close();
 assert.deepEqual(pageErrors,[],'No uncaught application errors on upgrade/reload');
 assert.equal(requests.filter(r=>r.phase==='fixed'&&['css/v2.css','js/app.js','js/motion.js','js/shift-time.js','js/core.js','js/importer.js'].includes(r.file)).length,0,'New HTML must never request ambiguous old asset URLs');
 console.log('PWA upgrade passed: real old-worker reproduction, fresh/upgraded layouts (320–430px), offline shell, preserved storage, integrity-rejected deployment, automatic next-release invalidation, and manual update without losing edits.');
 }finally{if(browser)await browser.close();if(server)server.close();if(futureRoot)fs.rmSync(futureRoot,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1});
