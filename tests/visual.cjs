/* Visual fixtures are synthetic and run only against the disposable browser-test DB. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),I=require('../js/importer.js'),C=require('../js/core.js');
module.exports=async({page,db,api,root,A,errors})=>{
 const phase=process.env.FF_VISUAL==='before'?'before':'after',out=path.join(root,'test-results/visual',phase);fs.mkdirSync(out,{recursive:true});
 const dataset=require('./fixtures/synthetic-history.json');
 for(const item of await I.manifest(dataset,A))await api({uid:A,table:item.table,op:'insert',payload:item.row});
 await db.query("update nutrition_entries set calories=110 where import_key=$1",[dataset.source_key+':entry-1']);
 await db.query('delete from nutrition_history where import_key=$1',[dataset.source_key+':example-undated']);
 for(let i=0;i<7;i++){
  const date=C.shiftDay('2026-11-05',-i);
  await db.query('insert into weight_logs(user_id,logged_on,weight_kg) values($1,$2,$3)',[A,date,76+i*.2]);
  await db.query("insert into nutrition_entries(user_id,logged_on,name,meal,calories,protein_g,confidence,source) values($1,$2,'Sample oat bowl with yogurt & berries','Breakfast',420,28,'user_supplied','Synthetic visual fixture')",[A,date]);
  await db.query("insert into nutrition_entries(user_id,logged_on,name,meal,calories,protein_g,calories_low,calories_high,confidence,source) values($1,$2,'Sample vegetable & rice bowl','Lunch',540,null,480,600,'assistant_estimate','Synthetic visual fixture')",[A,date]);
 }
 await db.query("update nutrition_goals set protein_g=120,weight_min_kg=72,weight_max_kg=75,milestone_kg=75 where user_id=$1",[A]);
 await db.query("update financeflow_data set payload=jsonb_set(jsonb_set(payload,'{transactions}',$2::jsonb),'{budgets}', $3::jsonb) where user_id=$1",[A,JSON.stringify([
 {id:'income',date:'2026-11-01',type:'income',amount:1850,category:'Salary',description:'Sample monthly salary'},
 {id:'rent',date:'2026-11-02',type:'expense',amount:620,category:'Bills',description:'Sample apartment rent'},
 {id:'market',date:'2026-11-04',type:'expense',amount:48.5,category:'Food',description:'Sample weekly groceries'},
 {id:'coffee',date:'2026-11-05',type:'expense',amount:3.8,category:'Food',description:'Sample coffee'}]),JSON.stringify({'2026-11':950})]);
 await page.reload();await page.waitForFunction(()=>document.querySelector('#appStatus').textContent.includes('Cloud connected'));
 const go=async view=>{await page.evaluate(view=>{location.hash=view},view);await page.waitForFunction(view=>!document.getElementById(view+'View').classList.contains('hidden'),view);await page.evaluate(()=>{scrollTo(0,0);document.activeElement?.blur()});};
 const failures=[];
 const widths=phase==='before'?[320,390,1440]:[320,360,390,430,768,1440];
 for(const width of widths){
  await page.setViewportSize({width,height:width>=768?1000:844});
  for(const view of ['overview','finance','work','nutrition','weight','statistics','settings']){
   await go(view);
   if(view==='settings'){
    await page.setInputFiles('#historyFile',path.join(root,'tests/fixtures/synthetic-history.json'));await page.click('[data-action=preview-import]:visible');await page.waitForFunction(()=>document.querySelector('#importPreview').textContent.includes('to create'));
   }
   await page.evaluate(()=>scrollTo(0,0));await page.mouse.move(0,0);
   await page.waitForFunction(()=>!document.querySelector('[data-action=refresh]')?.disabled);
   const overflow=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));
   if(overflow.document>width)failures.push({width,view,overflow});
   {
    const issues=await page.evaluate(view=>{
     const root=document.getElementById(view+'View'),issues=[];
     for(const el of root.querySelectorAll('button,input,select,textarea,summary')){
      const r=el.getBoundingClientRect();if(!r.width||!r.height)continue;
      if(r.height<43||r.width<43)issues.push({type:'target',element:el.id||el.textContent.slice(0,35),width:r.width,height:r.height});
      if(r.left<0||r.right>innerWidth+1)issues.push({type:'control overflow',element:el.id||el.textContent.slice(0,35)});
     }
     for(const svg of root.querySelectorAll('.compact-chart,.workgraph'))for(const text of svg.querySelectorAll('text')){
      const size=parseFloat(getComputedStyle(text).fontSize)*text.getScreenCTM().a;if(size<10)issues.push({type:'chart text',size});
     }
     return issues;
    },view);if(issues.length)failures.push({width,view,issues});
   }
   await page.screenshot({path:path.join(out,`${view}-${width}.png`),fullPage:true});
   if([390,1440].includes(width))await page.screenshot({path:path.join(out,`${view}-${width}-viewport.png`)});
   if(phase==='before'&&width===390&&view==='settings')await page.locator('#settingsView section').filter({has:page.getByRole('heading',{name:'Historical import',exact:true})}).screenshot({path:path.join(out,'import-390.png'),style:'.tabs { visibility: hidden !important; }'});
  }
 }
 fs.writeFileSync(path.join(out,'audit.json'),JSON.stringify({phase,failures,errors},null,2));
 if(phase==='after'){
  assert.deepEqual(failures,[],'Pages must fit every requested viewport');assert.deepEqual(errors,[]);
  // Inspect important states and real navigation, without production transport.
  await page.setViewportSize({width:390,height:844});await go('settings');
  const beforeCount=(await db.query('select count(*) from nutrition_entries')).rows[0].count;
  await page.setInputFiles('#historyFile',path.join(root,'tests/fixtures/synthetic-history.json'));await page.click('[data-action=preview-import]');await page.waitForFunction(()=>document.querySelectorAll('.import-record').length>0);
  assert.equal(await page.locator('#historyFile').evaluate(el=>el.files[0]?.name),'synthetic-history.json');
  for(const action of ['create','skip','flag']){
   await page.click(`[data-filter=${action}]`);assert.ok(await page.locator('.import-record').count()>0);
   assert.equal(await page.locator(`.import-record:not([data-import-action=${action}])`).count(),0);
  }
  await page.locator('.import-section').screenshot({path:path.join(out,'import-conflicts-390.png'),style:'.tabs { visibility: hidden !important; }'});
  assert.equal((await db.query('select count(*) from nutrition_entries')).rows[0].count,beforeCount,'Filtering is presentation only');
  await page.click('[data-filter=all]');await page.click('#moreNav');assert.equal(await page.locator('#moreDialog').evaluate(el=>el.open),true);
  await page.screenshot({path:path.join(out,'navigation-390.png')});
  for(let i=0;i<8;i++){await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.querySelector('#moreDialog').contains(document.activeElement)),true);}
  await page.keyboard.press('Escape');assert.equal(await page.locator('#moreDialog').evaluate(el=>el.open),false);assert.equal(await page.evaluate(()=>document.activeElement.id),'moreNav');
  for(const destination of ['work','weight','settings']){await page.click('#moreNav');await page.click(`[data-destination=${destination}]`);assert.equal(await page.locator(`#${destination}View`).isVisible(),true);assert.equal(await page.evaluate(()=>document.activeElement.tagName),'H1');}
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('#moreNav').evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
  // Contrast of system text, muted text, primary button and state tokens.
  const contrast=await page.evaluate(()=>{
   const rgb=hex=>hex.match(/[a-f0-9]{2}/gi).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4),lum=c=>{const [r,g,b]=rgb(c);return .2126*r+.7152*g+.0722*b},ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
   const css=getComputedStyle(document.documentElement),token=n=>css.getPropertyValue(n).trim();
   return [['text',token('--text'),token('--surface')],['muted',token('--muted'),token('--surface')],['primary',token('--accent-ink'),token('--accent-fill')],['success','#a5e3c9','#203a2f'],['warning','#f5d3a1','#403124']].map(([name,a,b])=>({name,ratio:ratio(a,b)}));
  });for(const result of contrast)assert.ok(result.ratio>=4.5,JSON.stringify(result));
  // Empty account, large values/long labels, validation and loading/error displays.
  await page.evaluate(()=>{testUid='22222222-2222-4222-8222-222222222222';authListeners.forEach(cb=>cb('SIGNED_IN',{user:{id:testUid,email:'empty@example.com'}}))});await page.waitForFunction(()=>document.querySelector('#appStatus').textContent.includes('Cloud connected'));
  await go('nutrition');assert.match(await page.textContent('#nutritionView'),/No meals logged/);await page.screenshot({path:path.join(out,'empty-390.png')});
  await page.click('[data-action=new-entry]:visible');assert.equal(await page.locator('#editorDialog').evaluate(el=>el.open),true);await page.fill('#entryName','A deliberately long synthetic meal label to verify wrapping and comfortable editing on a narrow phone screen');
  for(const width of [320,430]){await page.setViewportSize({width,height:640});await page.screenshot({path:path.join(out,`editor-${width}.png`)});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);const box=await page.locator('#editorDialog').boundingBox();assert.ok(box.width<=width);}
  await page.keyboard.press('Escape');assert.equal(await page.locator('#editorDialog').evaluate(el=>el.open),false);
  await page.setViewportSize({width:320,height:844});await go('finance');
  await db.query('insert into financeflow_data(user_id,payload) values($1,$2)', ['22222222-2222-4222-8222-222222222222',JSON.stringify({transactions:[{id:'stress',date:'2026-11-05',type:'income',amount:99999999.99,category:'Salary',description:'A long synthetic transaction description testing wrapping and readable amounts on a narrow screen'}],budgets:{},goal:null,shifts:[],paySettings:{hourlyRate:8.98,kmRate:.1725}})]);
  await page.evaluate(()=>authListeners.forEach(cb=>cb('SIGNED_OUT')));await page.evaluate(()=>authListeners.forEach(cb=>cb('SIGNED_IN',{user:{id:testUid,email:'empty@example.com'}})));await page.waitForFunction(()=>document.querySelector('#appStatus').textContent.includes('Cloud connected'));await go('finance');await page.screenshot({path:path.join(out,'large-values-320.png')});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await go('settings');await page.evaluate(()=>testFail=true);await page.click('[data-action=refresh]');await page.waitForFunction(()=>document.querySelector('#appStatus').textContent.includes('offline'));assert.equal(await page.locator('#appStatus').isVisible(),true);await page.screenshot({path:path.join(out,'error-320.png')});await page.evaluate(()=>testFail=false);
  // Capture an actual pending transport state, then release it.
  await page.route('**/mock-api',async route=>{await new Promise(r=>setTimeout(r,250));await route.continue()});await page.click('[data-action=refresh]');await page.waitForFunction(()=>document.querySelector('#appStatus').textContent.includes('Working'));await page.screenshot({path:path.join(out,'loading-320.png')});assert.equal(await page.locator('[data-action=refresh]').isDisabled(),true);await page.waitForFunction(()=>!document.querySelector('[data-action=refresh]').disabled);
  await go('finance');await page.fill('#description','Unsaved keyboard check');await page.locator('#description').focus();
  await page.evaluate(()=>{Object.defineProperty(visualViewport,'height',{configurable:true,value:innerHeight-250});visualViewport.dispatchEvent(new Event('resize'));});
  assert.equal(await page.locator('.tabs').isVisible(),false);assert.equal(await page.inputValue('#description'),'Unsaved keyboard check');
  await page.evaluate(()=>{delete visualViewport.height;visualViewport.dispatchEvent(new Event('resize'));});assert.equal(await page.locator('.tabs').isVisible(),true);
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'contrast.json'),JSON.stringify(contrast,null,2));
 }
 console.log(`Visual ${phase}: ${widths.length*7} section/viewport captures; ${failures.length} overflow/target/chart findings. Extended states and accessibility checks ${phase==='after'?'passed':'pending redesign'}.`);
};
