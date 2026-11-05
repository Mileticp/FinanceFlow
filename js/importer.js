(function(root,factory){if(typeof module==='object')module.exports=factory(require('./core.js'));else root.FFImport=factory(root.FFCore);})(globalThis,C=>{
 'use strict';
 const TABLES=['nutrition_foods','nutrition_recipes','nutrition_ingredients','nutrition_entries','nutrition_days','nutrition_profiles','nutrition_goals','nutrition_history'];

 function validateDataset(d){
  if(!d||d.version!==1||typeof d.source_key!=='string'||!d.source_key.trim()||d.source_key.length>200)throw Error('Invalid source version or identifier.');
  for(const key of ['foods','recipes','entries','notes','daily'])if(!Array.isArray(d[key])||d[key].length>10000)throw Error('Invalid historical '+key+' list.');
  if(!d.profile||typeof d.profile!=='object'||!d.goals||typeof d.goals!=='object')throw Error('Profile and goals objects are required.');
  const allowed={foods:['key','name','brand','basis_quantity','basis_unit','calories','protein_g','carbs_g','fat_g','fiber_g','price_eur','price_quantity','price_unit','availability','confidence','source','notes','calories_low','calories_high','protein_low','protein_high'],recipes:['key','name','ingredients','reported_calories','reported_protein_g','notes'],entries:['key','logged_on','logged_time','name','food_key','recipe_key','quantity','unit','meal','calories','protein_g','carbs_g','fat_g','fiber_g','calories_low','calories_high','protein_low','protein_high','confidence','notes','source'],notes:['key','kind','logged_on','reported_calories','reported_protein_g','notes'],daily:['logged_on','status','notes']};
  for(const [type,keys] of Object.entries(allowed)){const seen=new Set();for(const row of d[type]){if(!row||typeof row!=='object'||Object.keys(row).some(k=>!keys.includes(k)))throw Error('Unknown or privileged field in '+type);const key=type==='daily'?row.logged_on:row.key;if(typeof key!=='string'||!key||seen.has(key))throw Error('Missing or duplicate '+type+' source key.');seen.add(key);}}
  for(const [type,keys] of Object.entries({profile:['sex','height_cm','starting_weight_kg','recent_reference_kg','notes'],goals:['protein_g','weight_min_kg','weight_max_kg','milestone_kg','walking_km','maintenance_low','maintenance_high','calorie_goal','notes']}))if(Object.keys(d[type]).some(k=>!keys.includes(k)))throw Error('Unknown or privileged '+type+' field.');
  for(const row of d.entries)C.validateEntry(row);
  for(const row of d.daily)if(!C.validDate(row.logged_on)||!['partial','complete','unlogged'].includes(row.status))throw Error('Invalid daily status.');
  for(const row of d.notes)if(row.logged_on!==null&&row.logged_on!==undefined&&!C.validDate(row.logged_on))throw Error('Invalid reference date.');
  return d;
 }
 async function deterministicId(uid,table,key){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${uid}|${table}|${key}`));const h=[...new Uint8Array(bytes)].slice(0,16);h[6]=(h[6]&15)|80;h[8]=(h[8]&63)|128;const s=h.map(x=>x.toString(16).padStart(2,'0')).join('');return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`;}
 async function manifest(dataset,uid){
  validateDataset(dataset);
  if(!uid)throw Error('An authenticated user is required.');
  const rows=[],ids={};
  async function add(table,key,fields,evidence){const import_key=dataset.source_key+':'+key,id=await deterministicId(uid,table,import_key);ids[table+':'+key]=id;const row={id,user_id:uid,import_key,source:dataset.source_description||'User-supplied private historical input',confidence:'historical_estimate',notes:'',...fields,evidence};rows.push({table,row});return id;}
  for(const food of dataset.foods){const {key,...fields}=food;await add('nutrition_foods',key,fields,food);}
  for(const recipe of dataset.recipes){await add('nutrition_recipes',recipe.key,{name:recipe.name,servings:1,notes:recipe.notes,confidence:'historical_recipe'},recipe);}
  for(const recipe of dataset.recipes){
   for(let i=0;i<recipe.ingredients.length;i++){const [food,quantity,unit]=recipe.ingredients[i];await add('nutrition_ingredients',recipe.key+':'+i,{recipe_id:ids['nutrition_recipes:'+recipe.key],food_id:food?ids['nutrition_foods:'+food]:null,ingredient_name:food?dataset.foods.find(f=>f.key===food).name:'Cocoa — label unspecified',quantity,unit,notes:food?'':'No label variant selected; macros unknown.'},recipe.ingredients[i]);}
   await add('nutrition_ingredients',recipe.key+':unquantified',{recipe_id:ids['nutrition_recipes:'+recipe.key],food_id:null,ingredient_name:'Water / flavourings / sweetener; see original notes',quantity:null,unit:null,notes:recipe.notes},recipe.notes);
  }
  for(const entry of dataset.entries){const {key,food_key,recipe_key,...fields}=entry;await add('nutrition_entries',key,{...fields,food_id:food_key?ids['nutrition_foods:'+food_key]:null,recipe_id:recipe_key?ids['nutrition_recipes:'+recipe_key]:null,deleted_at:null},entry);}
  for(const day of dataset.daily)await add('nutrition_days',day.logged_on,day,day);
  await add('nutrition_profiles','profile',dataset.profile,dataset.profile);
  await add('nutrition_goals','goals',dataset.goals,dataset.goals);
  for(const note of dataset.notes){const {key,...fields}=note;await add('nutrition_history',key,fields,note);}
  return rows;
 }
 function preview(manifest,existing,legacy=[]){
  const results=[];
  for(const item of manifest){const same=(existing[item.table]||[]).find(r=>r.import_key===item.row.import_key||r.id===item.row.id);
   const singleton=['nutrition_profiles','nutrition_goals'].includes(item.table)&&(existing[item.table]||[]).length;
   const dayCollision=item.table==='nutrition_days'&&(existing[item.table]||[]).some(r=>r.logged_on===item.row.logged_on);
   const duplicate=item.table==='nutrition_entries'&&legacy.concat(existing.nutrition_entries||[]).filter(r=>!r.deleted_at).some(r=>r.logged_on===item.row.logged_on&&(String(r.food_name||r.name).toLowerCase()===item.row.name.toLowerCase()||(C.numeric(r.calories)&&Number(r.calories)===item.row.calories&&Number(r.protein_g)===item.row.protein_g)));
   let action=same?(C.matches(same,item.row)?'skip':'flag'):(singleton||dayCollision||duplicate?'flag':'create');
   // Do not create an entry or ingredient when its parent has a conflicting import identifier.
   const refs=[item.row.food_id,item.row.recipe_id].filter(Boolean);
   if(action==='create'&&results.some(r=>r.action==='flag'&&refs.includes(r.row.id)))action='flag';
   results.push({...item,action,reason:same?(action==='skip'?'Identical imported record':'Import identifier exists with different or edited data; preserved'):(singleton||dayCollision?'Existing user profile, goals or daily status preserved':duplicate?'Possible duplicate legacy meal; manual review required':action==='flag'?'Related catalog / recipe conflict':'New record')});
  }return results;
 }
 async function execute(items,api,uid,isCurrent=()=>true){
  const report={created:[],skipped:[],flagged:[],failed:[]};
  for(const item of items){if(!isCurrent())throw Object.assign(Error('Account changed; import stopped.'),{report});
   if(item.row.user_id!==uid)throw Error('Import owner mismatch.');
   if(item.action!=='create'){report[item.action==='skip'?'skipped':'flagged'].push(item);continue;}
   if(report.failed.concat(report.flagged).some(r=>[item.row.food_id,item.row.recipe_id].includes(r.row.id))){report.flagged.push({...item,reason:'Related record failed or conflicted'});continue;}
   try{await api.insert(item.table,item.row);report.created.push(item);}catch(error){
    if(error.code==='23505'){let actual;try{actual=await api.find(item.table,item.row.import_key);}catch(lookupError){report.failed.push({...item,reason:lookupError.message});throw Object.assign(Error('Conflict verification interrupted; preview again before retrying.'),{report});}const identical=actual&&C.matches(actual,item.row);report[identical?'skipped':'flagged'].push({...item,reason:identical?'Already inserted concurrently':'Concurrent conflict; existing record preserved'});}
    else {report.failed.push({...item,reason:error.message});throw Object.assign(Error('Import interrupted; completed inserts are safe to preview again.'),{report});}
   }
  }return report;
 }
 return {TABLES,validateDataset,deterministicId,manifest,preview,execute};
});
