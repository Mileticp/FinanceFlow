/* Pure calculations shared by the UI, import preview and tests. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.FFCore=api;})(globalThis,()=>{
 'use strict';
 const TZ='Europe/Ljubljana',MACROS=['calories','protein_g','carbs_g','fat_g','fiber_g'];
 const numeric=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x));
 const nullable=x=>numeric(x)?Number(x):null;
 const round=x=>Math.round((x+Number.EPSILON)*100)/100;
 const today=(now=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
 const shiftDay=(s,n)=>{if(!validDate(s))throw Error('Invalid day');const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
 function scale(food,quantity,unit){
  if(!numeric(quantity)||Number(quantity)<=0||unit!==food.basis_unit||!numeric(food.basis_quantity)||Number(food.basis_quantity)<=0)throw Error('Use a positive quantity in the product basis unit.');
  const factor=Number(quantity)/Number(food.basis_quantity),out={};
  for(const k of [...MACROS,'calories_low','calories_high','protein_low','protein_high'])out[k]=numeric(food[k])?round(Number(food[k])*factor):null;
  return out;
 }
 function estimate(row){return !['user_label','user_supplied','user_label_rounded','verified_label'].includes(row.confidence);}
 function totals(rows){
  const active=rows.filter(r=>!r.deleted_at),result={count:active.length,estimatedCount:active.filter(estimate).length};
  for(const k of MACROS){const known=active.filter(r=>numeric(r[k]));result[k]=known.length?round(known.reduce((a,r)=>a+Number(r[k]),0)):null;result[k+'_unknown']=active.length-known.length;}
  for(const [key,lo,hi] of [['calories','calories_low','calories_high'],['protein_g','protein_low','protein_high']]){
   const complete=active.length&&active.every(r=>numeric(r[key])&&(!estimate(r)||(numeric(r[lo])&&numeric(r[hi]))));
   result[lo]=complete?round(active.reduce((a,r)=>a+Number(numeric(r[lo])?r[lo]:r[key]),0)):null;
   result[hi]=complete?round(active.reduce((a,r)=>a+Number(numeric(r[hi])?r[hi]:r[key]),0)):null;
  }
  result.labelCalories=round(active.filter(r=>!estimate(r)&&numeric(r.calories)).reduce((a,r)=>a+Number(r.calories),0));
  result.estimatedCalories=round(active.filter(r=>estimate(r)&&numeric(r.calories)).reduce((a,r)=>a+Number(r.calories),0));return result;
 }
 function recipeTotals(ingredients,foods,servings=1){
  if(!numeric(servings)||Number(servings)<=0)throw Error('Recipe servings must be positive.');
  const rows=ingredients.map(i=>{const food=foods.find(f=>f.id===i.food_id);if(!food||!numeric(i.quantity)||!i.unit)return {confidence:'unverified'};
   try{return {...scale(food,i.quantity,i.unit),confidence:food.confidence};}catch{return {confidence:'unverified'};}});
  const t=totals(rows);for(const k of MACROS)t[k]=t[k]===null?null:round(t[k]/Number(servings));return t;
 }
 function cost(food){
  if(!numeric(food.price_eur)||!numeric(food.price_quantity)||food.price_unit!==food.basis_unit||Number(food.price_quantity)<=0||['unverified','assistant_estimate'].includes(food.confidence))return null;
  const perBasis=Number(food.price_eur)*Number(food.basis_quantity)/Number(food.price_quantity);
  return {perBasis:round(perBasis),per100Protein:numeric(food.protein_g)&&Number(food.protein_g)>0?round(perBasis*100/Number(food.protein_g)):null};
 }
 function days(entries,statuses,start,end){
  if(!validDate(start)||!validDate(end)||start>end)throw Error('Choose a valid date range.');
  if((Date.parse(end)-Date.parse(start))/86400000>3660)throw Error('Choose a range of at most ten years.');
  const grouped=new Map();entries.filter(r=>!r.deleted_at).forEach(r=>{if(!grouped.has(r.logged_on))grouped.set(r.logged_on,[]);grouped.get(r.logged_on).push(r);});
  const out=[];for(let day=start;day<=end;day=shiftDay(day,1)){const rows=grouped.get(day)||[];out.push({day,...totals(rows),status:statuses.find(s=>s.logged_on===day)?.status||(rows.length?'partial':'unlogged')});}return out;
 }
 function average(points,key){const withData=points.filter(p=>p.count&&numeric(p[key]));return withData.length?round(withData.reduce((a,p)=>a+Number(p[key]),0)/withData.length):null;}
 function weightTrend(rows){return [...rows].sort((a,b)=>a.logged_on.localeCompare(b.logged_on)).map(r=>{const from=shiftDay(r.logged_on,-6),window=rows.filter(w=>w.logged_on>=from&&w.logged_on<=r.logged_on);return {...r,trend:round(window.reduce((a,w)=>a+Number(w.weight_kg),0)/window.length),samples:window.length};});}
 function validateEntry(row){
  if(!validDate(row.logged_on)||!row.name?.trim()||row.name.length>200||!['Breakfast','Lunch','Dinner','Snack','Other'].includes(row.meal))throw Error('Check the date, name and meal.');
  if(row.logged_time&&!/^\d{2}:\d{2}(:\d{2})?$/.test(row.logged_time))throw Error('Invalid time.');
  for(const k of [...MACROS,'calories_low','calories_high','protein_low','protein_high'])if(row[k]!==null&&row[k]!==undefined&&(!numeric(row[k])||Number(row[k])<0||Number(row[k])>100000))throw Error('Nutrition values must be positive or left unknown.');
  if(numeric(row.protein_g)&&Number(row.protein_g)>10000)throw Error('Protein value is too large.');
  for(const [key,lo,hi] of [['calories','calories_low','calories_high'],['protein_g','protein_low','protein_high']]){
   if(numeric(row[lo])&&numeric(row[hi])&&Number(row[lo])>Number(row[hi]))throw Error('Lower estimate exceeds upper estimate.');
   if(numeric(row[key])&&((numeric(row[lo])&&Number(row[lo])>Number(row[key]))||(numeric(row[hi])&&Number(row[hi])<Number(row[key]))))throw Error('The central estimate must be inside the range.');
  }return row;
 }
 const canonical=o=>JSON.stringify(o,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
 const matches=(actual,expected)=>Object.entries(expected).every(([k,v])=>canonical(typeof v==='number'&&numeric(actual[k])?Number(actual[k]):validDate(v)&&actual[k] instanceof Date?actual[k].toISOString().slice(0,10):actual[k]??null)===canonical(v??null));
 function csv(rows){const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))];const cell=v=>{let s=v===null||v===undefined?'':typeof v==='object'?JSON.stringify(v):String(v);if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};return [keys.map(cell).join(','),...rows.map(r=>keys.map(k=>cell(r[k])).join(','))].join('\r\n');}
 return {TZ,MACROS,numeric,nullable,round,today,validDate,shiftDay,scale,estimate,totals,recipeTotals,cost,days,average,weightTrend,validateEntry,canonical,matches,csv};
});
