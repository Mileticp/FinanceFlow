/* Presentation only: canonical numbers, native dialogs and navigation remain immediate. */
(() => {
 'use strict';
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),seen=new Set(),scroll=new Map();
 let previous=new WeakMap(),running=new Map(),active=null;
 const tokens=getComputedStyle(document.documentElement),slow=parseFloat(tokens.getPropertyValue('--motion-slow'))||280;
 const timing={duration:parseFloat(tokens.getPropertyValue('--motion-normal'))||220,easing:tokens.getPropertyValue('--motion-ease').trim()||'ease-out'};
 const cancelNumbers=()=>{for(const [el,id] of running){cancelAnimationFrame(id);el.classList.remove('motion-number');el.removeAttribute('data-motion-number');}running.clear();};
 function reset(){cancelNumbers();previous=new WeakMap();seen.clear();scroll.clear();active=null;}
 function leave(next){if(active&&active!==next)scroll.set(active,window.scrollY);cancelNumbers();}
 function enter(name){
  cancelNumbers();
  const switching=active!==null;
  const node=document.getElementById(name+'View');if(!node)return;
  if(active===name)return;active=name;
  if(switching)window.scrollTo({top:scroll.get(name)||0,behavior:'instant'});
  if(reduced.matches)return;
  node.querySelectorAll('.compact-chart,.workgraph').forEach(chart=>chart.animate([{opacity:.9},{opacity:1}],timing));
  node.getAnimations().forEach(a=>a.cancel());
  node.animate([{opacity:.88,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],timing);
  if(!seen.has(name)){
   seen.add(name);
   [...node.querySelectorAll('.card')].slice(0,8).forEach((card,i)=>card.animate([{opacity:.9,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}],{...timing,duration:slow,delay:Math.min(i*22,110)}));
  }
 }
 const currency=new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR'});
 const decode=text=>{
  if(/^-?€[\d,]+\.\d{2}$/.test(text))return {value:Number(text.replace(/[€,]/g,'')),format:n=>currency.format(n)};
  if(/^\d{2,}:\d{2}$/.test(text))return {value:Number(text.split(':')[0])*60+Number(text.split(':')[1]),format:n=>{n=Math.round(n);return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}};
  return null;
 };
 function numbers(){
  document.querySelectorAll('#balance,#income,#expenses,#workHours,#workWages,#workMileage,#workTotal').forEach(el=>{
   const text=el.textContent.trim(),old=previous.get(el);previous.set(el,text);
   if(old===text||!old||!CSS.supports('content','attr(data-motion-number) / ""')||reduced.matches||!el.getClientRects().length)return;
   const from=decode(old),to=decode(text);if(!from||!to||from.value===0||old.includes('€')!==text.includes('€'))return;
   if(running.has(el))cancelAnimationFrame(running.get(el));el.classList.remove('motion-number');
   el.style.setProperty('--number-color',getComputedStyle(el).color);el.dataset.motionNumber=old;el.classList.add('motion-number');
   const start=performance.now();
   const frame=now=>{const t=Math.min(1,(now-start)/slow);if(!el.isConnected||reduced.matches){el.classList.remove('motion-number');running.delete(el);return;}el.dataset.motionNumber=to.format(from.value+(to.value-from.value)*(1-(1-t)**3));if(t<1)running.set(el,requestAnimationFrame(frame));else{el.classList.remove('motion-number');el.removeAttribute('data-motion-number');running.delete(el);}};
   running.set(el,requestAnimationFrame(frame));
  });
 }
 // Only text/child changes are observed; animation attributes cannot retrigger this observer.
 new MutationObserver(numbers).observe(document.getElementById('main-content'),{subtree:true,childList:true,characterData:true});
 reduced.addEventListener('change',()=>{cancelNumbers();document.getAnimations().forEach(a=>a.cancel());});
 const widths=new WeakMap();
 function progress(){document.querySelectorAll('.progress>div').forEach(fill=>{const value=parseFloat(fill.style.width),old=widths.get(fill);widths.set(fill,value);if(!reduced.matches&&Number.isFinite(old)&&value>0&&old!==value)fill.animate([{transform:`scaleX(${old/value})`},{transform:'scaleX(1)'}],timing);});}
 new MutationObserver(records=>{if(records.some(r=>r.type==='childList'||r.target.parentElement?.classList.contains('progress')))progress();}).observe(document.getElementById('main-content'),{subtree:true,childList:true,attributes:true,attributeFilter:['style']});
 window.FFMotion={enter,leave,reset};numbers();progress();const initial=document.querySelector('.active-view');if(initial)enter(initial.id.replace(/View$/,''));
})();
