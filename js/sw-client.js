/* Public app-shell updates only. Never reload an open editor automatically. */
(() => {
 'use strict';
 if (!('serviceWorker' in navigator)) return;
 const documentVersion = document.querySelector('meta[name="financeflow-release"]')?.content;
 async function checkController() {
  const worker = navigator.serviceWorker.controller;
  if (!worker) return;
  const channel = new MessageChannel();
  const timer = setTimeout(() => channel.port1.close(), 1500);
  channel.port1.onmessage = ({data}) => {
   clearTimeout(timer); channel.port1.close();
   if (!data?.version || data.version === documentVersion || document.getElementById('shellUpdate')) return;
   const notice = document.createElement('div');
   notice.id = 'shellUpdate'; notice.className = 'notice shell-update'; notice.setAttribute('role', 'status');
   const text = document.createElement('p');
   text.textContent = 'A FinanceFlow update is ready. Save any edits, then reload.';
   const reload = document.createElement('button'); reload.type = 'button'; reload.className = 'btn secondary';
   reload.textContent = 'Reload app'; reload.onclick = () => location.reload();
   notice.append(text, reload); document.querySelector('.top').after(notice);
  };
  worker.postMessage({type:'GET_SHELL_VERSION'}, [channel.port2]);
 }
 navigator.serviceWorker.addEventListener('controllerchange', checkController);
 async function register() {
  try {
   const registration = await navigator.serviceWorker.register('./sw.js', {updateViaCache:'none'});
   let lastCheck = 0;
   const update = () => {
    if (Date.now() - lastCheck < 60000) return;
    lastCheck = Date.now(); registration.update().catch(() => {});
   };
   window.addEventListener('online', update);
   document.addEventListener('visibilitychange', () => {if (!document.hidden) update();});
   update(); checkController();
  } catch (error) {console.warn('FinanceFlow shell registration failed:', error);}
 }
 if (document.readyState === 'complete') register(); else window.addEventListener('load', register, {once:true});
})();
