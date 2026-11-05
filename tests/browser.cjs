// Run with Playwright available: node tests/browser.cjs
const {chromium} = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const http = require('node:http');
(async () => {
  const root = path.resolve(__dirname, '..');
  const server = http.createServer((req, res) => {
    const name = req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0].slice(1);
    if (!['index.html', 'nutrition.js', 'sw.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'].includes(name)) { res.writeHead(404); return res.end(); }
    res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name.endsWith('.png') ? 'image/png' : name.endsWith('.webmanifest') ? 'application/manifest+json' : 'text/html');
    res.end(fs.readFileSync(path.join(root, name)));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox']});
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('https://cdn.jsdelivr.net/**', route => route.fulfill({contentType: 'text/javascript', body: `
      window.rows={food_logs:[],weight_logs:[],work_shifts:[]}; window.calls=[];window.fail=false;
      const auth={getUser:async()=>({data:{user:{id:'account-a'}}}),signOut:async()=>({}),signInWithPassword:async()=>({data:{user:{id:'account-b'}}}),onAuthStateChange:()=>({})};
      window.supabase={createClient:()=>({auth,from(table){
        let op='read',payload,filters=[],start=0,end=499;
        const query={select(){return query},eq(k,v){filters.push([k,v]);return query},order(){return query},range(a,b){start=a;end=b;return query},maybeSingle(){return Promise.resolve({data:null})},insert(p){op='insert';payload=p;return query},delete(){op='delete';return query},upsert(p){op='upsert';payload=p;return query},then(resolve,reject){
          calls.push({table,op,payload,filters,start,end});
          if(fail && ['food_logs','weight_logs'].includes(table))return Promise.resolve({error:{message:'Network unavailable'}}).then(resolve,reject);
          let selected=(rows[table]||[]).filter(r=>filters.every(([k,v])=>r[k]===v));
          if(op==='insert'){const r={...payload,id:crypto.randomUUID(),created_at:new Date().toISOString()};rows[table].push(r);selected=[r]}
          if(op==='delete') rows[table]=rows[table].filter(r=>!selected.includes(r));
          return Promise.resolve({data:selected.slice(start,end+1),error:null}).then(resolve,reject);
        }};return query;
      }})};` }));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(() => document.querySelector('#syncStatus').textContent.includes('connected'));
    await page.click('#nutritionTab');
    await page.waitForFunction(() => document.querySelector('#nutritionStatus').textContent.includes('loaded'));
    await page.fill('#nutritionName', '<img src=x onerror=alert(1)>');
    await page.fill('#nutritionQuantity', '1 bowl'); await page.fill('#nutritionKcal', '420'); await page.fill('#nutritionGrams', '25');
    await page.click('#nutritionSavePreset');
    assert.equal(await page.locator('#nutritionPreset option').count(), 2);
    await page.locator('#nutritionFoodForm button[type=submit]').click();
    await page.waitForFunction(() => document.querySelector('#nutritionStatus').textContent === 'Meal saved.');
    assert.equal(await page.textContent('#nutritionCalories'), '420 kcal');
    assert.equal(await page.textContent('#nutritionProtein'), '25 g');
    assert.equal(await page.locator('#nutritionMeals img').count(), 0);
    await page.fill('#nutritionKg', '80.5'); await page.locator('#nutritionWeightForm button').click();
    await page.waitForFunction(() => document.querySelector('#nutritionStatus').textContent === 'Weight saved.');
    assert.equal(await page.textContent('#nutritionWeight'), '80.5 kg');
    await page.fill('#nutritionDay', '2026-01-01'); await page.locator('#nutritionDay').dispatchEvent('change');
    assert.equal(await page.textContent('#nutritionCalories'), '0 kcal');
    assert.match(await page.textContent('#nutritionHistory'), /420/);
    // Finance import and normal saves must not gain nutrition fields.
    await page.click('#financeTab'); await page.fill('#amount', '12.5'); await page.fill('#description', 'Groceries');
    await page.locator('#transactionForm button').click();
    await page.waitForFunction(() => calls.some(c=>c.table==='financeflow_data'&&c.op==='upsert'));
    assert.equal(await page.evaluate(() => calls.find(c=>c.table==='financeflow_data'&&c.op==='upsert').payload.payload.transactions.length), 1);
    assert.equal(await page.evaluate(() => 'food_logs' in calls.find(c=>c.table==='financeflow_data'&&c.op==='upsert').payload.payload), false);
    await page.click('#nutritionTab');
    await page.evaluate(() => window.fail=true); await page.click('#nutritionRefresh');
    await page.waitForFunction(() => document.querySelector('#nutritionStatus').textContent.includes('failed'));
    assert.match(await page.textContent('#nutritionHistory'), /420/);
    await page.evaluate(() => window.fail=false);
    // Export uses freshly paged results and contains both nutrition tables and presets.
    const downloadPromise=page.waitForEvent('download'); await page.click('#nutritionExport');
    const download=await downloadPromise; const backup=JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    assert.equal(backup.food_logs.length,1);assert.equal(backup.weight_logs.length,1);assert.equal(backup.presets.length,1);
    await page.waitForFunction(() => !document.querySelector('#nutritionRefresh').disabled);
    // A full page must request the next range, rather than silently truncating history.
    await page.evaluate(() => {rows.food_logs=Array.from({length:501},(_,i)=>({id:String(i),user_id:'account-a',logged_on:'2026-01-01',food_name:'Food',meal:'Lunch',calories:1,protein_g:1,quantity:'',notes:'',estimated:false}));});
    await page.click('#nutritionRefresh');
    await page.waitForFunction(() => document.querySelector('#nutritionCalories').textContent==='501 kcal');
    assert.equal(await page.evaluate(() => calls.some(c=>c.table==='food_logs'&&c.start===500)),true);
    // Confirmed deletes carry both owner and record filters.
    page.on('dialog', d=>d.accept()); await page.locator('#nutritionWeights button').first().click();
    await page.waitForFunction(() => document.querySelector('#nutritionStatus').textContent==='Record deleted.');
    assert.equal(await page.evaluate(() => calls.some(c=>c.op==='delete'&&c.filters.some(([k,v])=>k==='user_id'&&v==='account-a')&&c.filters.some(([k])=>k==='id'))),true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.click('#workTab'); assert.equal(await page.locator('#workView').isVisible(),true);
    await page.click('#signOutBtn');
    assert.equal(await page.textContent('#nutritionCalories'), '—');
    assert.equal(await page.locator('#nutritionPreset option').count(),1);
    // A second account must not inherit device presets or the prior account's rows.
    await page.fill('#loginEmail','second@example.com'); await page.fill('#loginPassword','test-password'); await page.click('#loginBtn');
    await page.waitForFunction(() => document.querySelector('#nutritionStatus').textContent.includes('loaded'));
    await page.click('#nutritionTab');
    assert.equal(await page.textContent('#nutritionCalories'),'0 kcal');
    assert.equal(await page.locator('#nutritionPreset option').count(),1);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('financeflow.nutrition.presets.v1.account-a')).length),1);
    await page.evaluate(() => navigator.serviceWorker.ready);
    assert.equal(await page.evaluate(async () => {const cache=await caches.open('financeflow-shell-v2');return Boolean(await cache.match('./nutrition.js'));}),true);
    await page.screenshot({path:'/workspace/FinanceFlow-preview.png',fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('Browser checks passed: meals, totals, presets, weight, history, export, pagination, failed requests, finance save, mobile layout, sign-out.');
  } finally { if(browser) await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
