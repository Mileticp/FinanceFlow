const test=require('node:test'),assert=require('node:assert/strict'),C=require('../js/core.js'),I=require('../js/importer.js'),d=require('./fixtures/synthetic-history.json');
test('Ljubljana dates handle midnight, DST and impossible dates',()=>{assert.equal(C.today(new Date('2026-01-01T23:30:00Z')),'2026-01-02');assert.equal(C.today(new Date('2026-07-01T22:30:00Z')),'2026-07-02');assert.equal(C.validDate('2026-02-30'),false);assert.equal(C.validDate('2024-02-29'),true);assert.equal(C.shiftDay('2026-03-29',1),'2026-03-30');});
test('quantity scaling preserves unknown macros and incompatible units',()=>{assert.equal(C.scale(d.foods[0],25,'g').calories,50);assert.equal(C.scale(d.foods[2],25,'g').protein_g,null);assert.throws(()=>C.scale(d.foods[0],25,'ml'));assert.throws(()=>C.scale(d.foods[0],0,'g'));});
test('synthetic totals preserve unknowns and supplied uncertainty',()=>{const totals=C.totals(d.entries.filter(e=>e.logged_on==='2026-01-02'));assert.equal(totals.calories,300);assert.equal(totals.protein_g,10);assert.equal(totals.protein_g_unknown,1);assert.equal(totals.calories_low,250);assert.equal(totals.calories_high,350);assert.equal(C.totals([{calories:null,protein_g:null}]).calories,null);});
test('averages exclude days without data',()=>{const points=C.days(d.entries,d.daily,'2025-12-31','2026-01-02');assert.equal(points[0].calories,null);assert.equal(C.average(points,'calories'),200);});
test('recipe calculations report known subtotals and never create diary entries',()=>{const foods=d.foods.map(f=>({...f,id:f.key})),ingredients=[{food_id:'alpha',quantity:50,unit:'g'},{food_id:'beta',quantity:50,unit:'g'}];const totals=C.recipeTotals(ingredients,foods);assert.equal(totals.calories,150);assert.equal(totals.protein_g,15);assert.equal(C.recipeTotals([...ingredients,{food_id:null,quantity:null}],foods).calories_unknown,1);assert.equal(d.entries.length,3);});
test('weight smoothing uses actual observations in seven calendar days',()=>{assert.deepEqual(C.weightTrend([]),[]);const series=C.weightTrend([{logged_on:'2026-01-01',weight_kg:80},{logged_on:'2026-01-03',weight_kg:78},{logged_on:'2026-01-20',weight_kg:76}]);assert.equal(series[1].trend,79);assert.equal(series[2].trend,76);assert.equal(series[2].samples,1);});
test('cost needs compatible verified price and protein data',()=>{assert.equal(C.cost({confidence:'unverified',price_eur:2,price_quantity:100,basis_unit:'g',price_unit:'g'}),null);assert.deepEqual(C.cost({price_eur:2,price_quantity:100,price_unit:'g',basis_unit:'g',basis_quantity:100,protein_g:20,confidence:'user_label'}),{perBasis:2,per100Protein:10});});
test('ranges validate and CSV guards formulas and quotes',()=>{assert.throws(()=>C.validateEntry({logged_on:'2026-01-01',name:'Example',meal:'Other',calories:200,calories_low:300,calories_high:100}));const csv=C.csv([{name:'=SUM(A1)',protein:null,notes:'a,"b"'}]);assert.match(csv,/'=SUM/);assert.match(csv,/a,""b""/);assert.doesNotMatch(csv,/null/);});
test('private input rejects privileged fields and deterministic imports preserve conflicts',async()=>{assert.throws(()=>I.validateDataset({...d,profile:{...d.profile,user_id:'other'}}),/privileged/);const a=await I.manifest(d,'a'),b=await I.manifest(d,'a'),c=await I.manifest(d,'b');assert.deepEqual(a,b);assert.notEqual(a[0].row.id,c[0].row.id);assert.equal(a.filter(r=>r.table==='weight_logs').length,0);const existing={};for(const item of a)(existing[item.table]??=[]).push(item.row);assert.equal(I.preview(a,existing).every(r=>r.action==='skip'),true);existing.nutrition_entries[0]={...existing.nutrition_entries[0],calories:123};assert.equal(I.preview(a,existing).filter(r=>r.action==='flag').length,1);const legacy=[{logged_on:'2026-01-01',food_name:'Example food Alpha',calories:100,protein_g:10}];assert.equal(I.preview(a,{},legacy).find(r=>r.row.name==='Example food Alpha'&&r.table==='nutrition_entries').action,'flag');});
test('interrupted imports report completed rows and account changes stop writes',async()=>{const m=(await I.manifest(d,'a')).slice(0,3).map(item=>({...item,action:'create'}));let calls=0;await assert.rejects(()=>I.execute(m,{insert:async()=>{if(++calls===3)throw Error('offline');}},'a'),error=>error.report.created.length===2&&error.report.failed.length===1);await assert.rejects(()=>I.execute(m,{insert:async()=>{}},'a',()=>false),/Account changed/);});

test('legacy zeros remain numeric and unverified; missing protein stays unknown',()=>{
 for(const value of [0,'0']){const row=C.legacyEntry({food_name:'Synthetic oil',protein_g:value,notes:'Original'});assert.equal(row.protein_g,0);assert.match(row.notes,/older forms also used zero/);assert.equal(C.estimate(row),true);}
 for(const value of [null,undefined,'']){const row=C.legacyEntry({protein_g:value});assert.equal(row.protein_g,null);assert.doesNotMatch(row.notes,/recorded as 0/);}
 assert.equal(C.legacyEntry({protein_g:12}).protein_g,12);
});
test('same-day equal macros do not identify different meals',async()=>{
 const m=(await I.manifest(d,'a')).filter(x=>x.table==='nutrition_entries').slice(0,1),row=m[0].row;
 assert.equal(I.preview(m,{},[{...row,food_name:'Different food',id:'other',import_key:null}])[0].action,'create');
 assert.equal(I.preview(m,{},[{...row,food_name:' Example food ALPHA ',id:'other',import_key:null}])[0].action,'flag');
 assert.equal(I.preview(m,{},[{...row,food_name:row.name,meal:'Dinner',id:'other',import_key:null}])[0].action,'flag');
 const breakfast=structuredClone(m);breakfast[0].row.meal='Breakfast';assert.equal(I.preview(breakfast,{},[{...row,food_name:row.name,meal:'Dinner',id:'other',import_key:null}])[0].action,'create');
 assert.equal(I.preview(m,{},[{...row,food_name:row.name,unit:'ml',id:'other',import_key:null}])[0].action,'flag');
 assert.equal(I.preview(m,{},[{...row,food_name:row.name,quantity:75,id:'other',import_key:null}])[0].action,'create');
});
test('recipe ranges use the same serving divisor as central macros',()=>{
 const f={id:'f',basis_quantity:100,basis_unit:'g',calories:200,calories_low:180,calories_high:220,protein_g:20,protein_low:18,protein_high:22,confidence:'assistant_estimate'};
 const t=C.recipeTotals([{food_id:'f',quantity:100,unit:'g'}],[f],2);assert.equal(t.calories,100);assert.equal(t.calories_low,90);assert.equal(t.calories_high,110);assert.equal(t.protein_low,9);assert.equal(t.protein_high,11);
});
test('considered and rejected prices cannot become factual cost metrics',()=>{
 const f={price_eur:2,price_quantity:100,price_unit:'g',basis_unit:'g',basis_quantity:100,protein_g:20,confidence:'user_label'};
 for(const availability of ['considered','rejected'])assert.equal(C.cost({...f,availability}),null);
 assert.equal(C.cost({...f,availability:'purchased'}).perBasis,2);
});
test('invalid references fail before creating a manifest',async()=>{
 const broken=structuredClone(d);broken.entries[0].food_key='missing';await assert.rejects(()=>I.manifest(broken,'a'),/reference/);
 const recipe=structuredClone(d);recipe.recipes[0].ingredients[0][0]='missing';await assert.rejects(()=>I.manifest(recipe,'a'),/reference/);
 const basis=structuredClone(d);basis.foods[0].basis_quantity=0;await assert.rejects(()=>I.manifest(basis,'a'),/basis/);
});
test('conflicted recipe ingredients block dependent consumption, including concurrent conflicts',async()=>{
 const data=structuredClone(d);data.entries[0].food_key=null;data.entries[0].recipe_key=data.recipes[0].key;
 const m=await I.manifest(data,'a'),ingredient=m.find(x=>x.table==='nutrition_ingredients');
 const existing={nutrition_ingredients:[{...ingredient.row,quantity:999}]};
 const p=I.preview(m,existing);assert.equal(p.find(x=>x.row.import_key.endsWith(':entry-1')).action,'flag');
 const inserted=[];const report=await I.execute(I.preview(m,{}),{insert:async(table,row)=>{if(row.id===ingredient.row.id)throw Object.assign(Error('conflict'),{code:'23505'});inserted.push(row.id)},find:async()=>existing.nutrition_ingredients[0]},'a');
 const meal=m.find(x=>x.row.import_key.endsWith(':entry-1'));assert.equal(inserted.includes(meal.row.id),false);assert.ok(report.flagged.some(x=>x.row.id===meal.row.id));
});
test('lost insert response retries by deterministic identity without overwriting',async()=>{
 const m=(await I.manifest(d,'a')).slice(0,3),saved={},api={insert:async(table,row)=>{saved[row.id]=row;if(Object.keys(saved).length===2)throw Error('response lost')},find:async()=>null};
 await assert.rejects(()=>I.execute(I.preview(m,{}),api,'a'),e=>e.report.created.length===1&&e.report.failed.length===1);
 const existing={nutrition_foods:Object.values(saved)},retry=I.preview(m,existing);assert.equal(retry.filter(x=>x.action==='skip').length,2);
 const writes=[];await I.execute(retry,{insert:async(_t,r)=>writes.push(r.id)},'a');assert.equal(writes.length,1);
});
test('entire import owner plan is checked before any write',async()=>{
 const m=I.preview((await I.manifest(d,'a')).slice(0,2),{});m[1].row.user_id='b';let calls=0;await assert.rejects(()=>I.execute(m,{insert:async()=>calls++},'a'),/owner/);assert.equal(calls,0);
});
test('times reject out-of-range clock values',()=>{
 const row={name:'Synthetic meal',logged_on:'2026-01-01',meal:'Other'};
 for(const logged_time of ['24:00','12:60','99:99:99'])assert.throws(()=>C.validateEntry({...row,logged_time}),/time/);
 assert.doesNotThrow(()=>C.validateEntry({...row,logged_time:'23:59:59'}));
});
test('concurrent catalog conflict blocks the recipe ingredient and its consumed entries',async()=>{
 const data=structuredClone(d);data.entries[0].food_key=null;data.entries[0].recipe_key=data.recipes[0].key;
 const m=await I.manifest(data,'a'),food=m.find(x=>x.table==='nutrition_foods'),meal=m.find(x=>x.row.import_key.endsWith(':entry-1')),inserted=[];
 const report=await I.execute(I.preview(m,{}),{insert:async(_table,row)=>{if(row.id===food.row.id)throw Object.assign(Error('conflict'),{code:'23505'});inserted.push(row.id)},find:async()=>({...food.row,calories:999})},'a');
 assert.equal(inserted.includes(meal.row.id),false);assert.ok(report.flagged.some(x=>x.row.id===meal.row.id));
});
test('omitted optional recipe notes retain defaults and remain repeat-safe',async()=>{
 const data=structuredClone(d);delete data.recipes[0].notes;const m=await I.manifest(data,'a'),existing={};
 for(const item of m)(existing[item.table]??=[]).push(JSON.parse(JSON.stringify(item.row)));
 assert.equal(m.find(x=>x.table==='nutrition_recipes').row.notes,'');assert.equal(I.preview(m,existing).every(x=>x.action==='skip'),true);
});
test('account change during the final insert cannot return a previous owner report',async()=>{
 const m=I.preview((await I.manifest(d,'a')).slice(0,1),{});let current=true;
 await assert.rejects(()=>I.execute(m,{insert:async()=>{current=false}},'a',()=>current),e=>/Account changed/.test(e.message)&&e.report.created.length===1);
});
