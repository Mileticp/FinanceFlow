(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.FFShift=api;})(globalThis,()=>{
 const minutes=time=>{if(typeof time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('Enter both times in 24-hour HH:MM format.');return Number(time.slice(0,2))*60+Number(time.slice(3));};
 const elapsed=(from,to)=>{const a=minutes(from),b=minutes(to);if(a===b)throw Error('Start and end must differ; a 24-hour shift is not assumed.');return (b-a+1440)%1440;};
 const formatMinutes=n=>{if(!Number.isFinite(n)||n<0)return 'Unavailable';n=Math.round(n);return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');};
 const formatHours=hours=>hours===null||hours===undefined||hours===''?'Unavailable':formatMinutes(Math.round(Number(hours)*60));
 const total=shifts=>formatMinutes(shifts.reduce((sum,s)=>sum+Math.round(s.hours*60),0));
 const time=value=>value?value.slice(0,5):'';
 const row=s=>[s.date.split('-').reverse().join('.'),time(s.startTime),time(s.endTime),formatHours(s.hours)].join('\t');
 async function copy(text){try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return true;}}catch{}const area=document.createElement('textarea');area.value=text;area.setAttribute('readonly','');area.style.cssText='position:fixed;top:0;left:0;opacity:0';document.body.append(area);area.select();area.setSelectionRange(0,text.length);let ok=false;try{ok=document.execCommand('copy');}catch{}area.remove();if(!ok){const dialog=document.createElement('dialog');dialog.setAttribute('aria-label','Copy timesheet text');const label=document.createElement('label');label.textContent='Select and copy this timesheet text';area.style.cssText='width:100%;min-height:120px';label.append(area);const close=document.createElement('button');close.type='button';close.className='btn';close.textContent='Close';close.onclick=()=>dialog.close();dialog.append(label,close);dialog.onclose=()=>dialog.remove();document.body.append(dialog);dialog.showModal();area.focus();area.select();}return ok;}
 return {minutes,elapsed,formatMinutes,formatHours,total,time,row,copy};
});
