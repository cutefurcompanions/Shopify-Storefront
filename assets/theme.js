/* CuteFurCompanions: native forms remain usable without JavaScript. */
(() => {
  'use strict';
  const C = window.CFC || {}, root = document.documentElement;
  const $ = (s,p=document) => p.querySelector(s);
  const $$ = (s,p=document) => [...p.querySelectorAll(s)];
  const base = (C.root || '/').replace(/\/?$/, '/');
  // AbortSignal.timeout is not available in a few browsers that Shopify still
  // supports. Keep requests bounded without making cart and search unusable.
  function timedFetch(url, options = {}, timeout = 20000) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeout);
    const upstream = options.signal;
    if (upstream) {
      if (upstream.aborted) controller.abort();
      else upstream.addEventListener('abort', () => controller.abort(), { once: true });
    }
    return fetch(url, { ...options, signal: controller.signal }).finally(() => window.clearTimeout(timer));
  }
  // Only a non-sensitive palette identifier is persisted; never chat text or photos.
  const brand = root.dataset.cfcBrandPage === 'true';
  try {
    if (brand) root.dataset.cfcTheme = 'brand';
    else if (C.themeExplicit) localStorage.setItem('cfc-collection-theme', C.theme);
    else { const saved=localStorage.getItem('cfc-collection-theme'); if (saved === 'arctic') root.dataset.cfcTheme=saved; }
  } catch (_) { /* Private browsing must not affect commerce. */ }
  document.addEventListener('click', e => { if (e.target.closest('[data-cfc-region="arctic"]')) { try { localStorage.setItem('cfc-collection-theme','arctic'); } catch (_) {} } });
  document.addEventListener('keydown', e => { if (e.key==='Escape') $$('details[open]').forEach(d => { d.open=false; $('summary',d)?.focus(); }); });
  $$('[data-cfc-mobile-nav]').forEach(nav => {
    nav.addEventListener('toggle', () => document.body.classList.toggle('cfc-no-scroll', nav.open));
    nav.addEventListener('click', event => { if (event.target.closest('a')) nav.open = false; });
  });
  document.addEventListener('click', e => {
    const thumb=e.target.closest('[data-cfc-gallery-thumb]');
    if (thumb) {
      const gallery=thumb.closest('.cfc-product-gallery');
      $$('[data-cfc-media]',gallery).forEach(m => { m.classList.toggle('is-active',m.dataset.cfcMedia===thumb.dataset.cfcGalleryThumb); $$('video',m).forEach(v=>v.pause()); });
      $$('[data-cfc-gallery-thumb]',gallery).forEach(t=>{ t.classList.toggle('is-active',t===thumb);t.setAttribute('aria-pressed',String(t===thumb)); });
    }
  });
  $('[data-cfc-sort]')?.addEventListener('change',e=>{const u=new URL(location.href);u.searchParams.set('sort_by',e.target.value);u.searchParams.delete('page');location.assign(u.href);});
  const drawer=$('[data-cfc-cart-drawer]');
  let busy=false, opener=null;
  const status = text => { const el=$('[data-cfc-cart-status]'); if(el) el.textContent=text; };
  const lock = yes => { busy=yes; if(drawer){drawer.setAttribute('aria-busy',String(yes)); $$('input,textarea,button[type="submit"]',drawer).forEach(el=>el.disabled=yes);} };
  async function request(url,options={}) {
    const r=await timedFetch(url,{...options,headers:{Accept:'application/json',...options.headers}});
    let data={}; try { data=await r.json(); } catch (_) { /* Shopify may return an empty error response. */ }
    if(!r.ok) throw new Error(typeof data.description==='string'?data.description:(typeof data.message==='string'?data.message:'Please try again.'));
    return data;
  }
  async function refresh() {
    const u=new URL(base,location.origin);u.searchParams.set('sections','cart-drawer');u.searchParams.set('_',Date.now());
    const result=await request(u);
    if(typeof result['cart-drawer']!=='string') throw new Error('Could not refresh your bag.');
    const doc=new DOMParser().parseFromString(result['cart-drawer'],'text/html');
    const fresh=$('[data-cfc-cart-content]',doc);if(!fresh)throw new Error('Could not refresh your bag.');
    // Markup comes only from Shopify's same-origin Section Rendering API.
    $$('[data-cfc-cart-content]').forEach(el=>el.replaceWith(fresh.cloneNode(true)));
    $$('[data-cfc-cart-count]').forEach(el=>el.textContent=fresh.dataset.count);
  }
  async function openCart(trigger) {
    if(!drawer || !drawer.showModal) { location.assign(C.cartUrl || base+'cart');return; }
    opener=trigger || document.activeElement;if(!drawer.open)drawer.showModal();status('Loading your bag…');lock(true);
    try {await refresh();status('');} catch(_){status('Could not load your bag. Open the cart page to review it.');$('.cfc-cart-drawer__items',drawer).replaceChildren(Object.assign(document.createElement('a'),{href:C.cartUrl || base+'cart',textContent:'Open cart page'}));}
    finally{lock(false);}
  }
  drawer?.addEventListener('close',()=>opener?.focus());
  drawer?.addEventListener('click',event=>{if(event.target===drawer)drawer.close();});
  document.addEventListener('click',async e=>{
    const open=e.target.closest('[data-cfc-cart-open]');if(open){e.preventDefault();if(!busy)openCart(open);return;}
    if(e.target.closest('[data-cfc-cart-close]')){drawer?.close();return;}
    const remove=e.target.closest('[data-cfc-remove]');
    if(remove && drawer?.contains(remove)){e.preventDefault();if(!busy)await change(remove.dataset.cfcRemove,0);}
  });
  async function change(key,quantity) {
    if(busy)return;lock(true);status('Updating…');let error='';
    try{await request(base+'cart/change.js',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:key,quantity})});}
    catch(e){error=e.message;}
    try{await refresh();status(error || 'Bag updated.');}
    catch(_){status('Unable to confirm the cart. Please open the cart page before checkout.');$('.cfc-cart-drawer__items',drawer).replaceChildren(Object.assign(document.createElement('a'),{href:C.cartUrl || base+'cart',textContent:'Review cart'}));}
    finally{lock(false);}
  }
  document.addEventListener('change',e=>{if(e.target.matches('[data-cfc-cart-key]') && drawer?.contains(e.target)){if(e.target.checkValidity())change(e.target.dataset.cfcCartKey,Number(e.target.value));else e.target.reportValidity();}});
  document.addEventListener('submit',async e=>{
    const form=e.target;
    if(!form.matches('[data-cfc-product-form],[data-cfc-quick-add]'))return;
    if(!drawer?.showModal)return;
    e.preventDefault();if(busy || !form.reportValidity())return;
    const data=new FormData(form), button=$('button[type="submit"]',form);if(!data.get('id'))return;
    let message=$('[data-cfc-form-status]',form);if(!message){message=document.createElement('p');message.setAttribute('role','status');form.append(message);}
    busy=true;if(button)button.disabled=true;message.textContent='Adding…';
    try{await request(base+'cart/add.js',{method:'POST',body:data});message.textContent='Added to your bag.';busy=false;await openCart(button);}
    catch(err){message.textContent='Could not confirm the addition. '+err.message+' Review your bag before trying again.';}
    finally{busy=false;if(button)button.disabled=false;}
  });
  // Real Shopify recommendations; absence or failure leaves no empty grid.
  async function recommendations(container) {
    if(!container || container.dataset.loaded)return;container.dataset.loaded='true';
    try{const r=await timedFetch(container.dataset.url,{},10000);if(!r.ok)return;const doc=new DOMParser().parseFromString(await r.text(),'text/html');const content=$('[data-cfc-recommendations]',doc);if(content?.querySelector('.cfc-product-card'))container.innerHTML=content.innerHTML;}catch(_){}
  }
  $$('[data-cfc-recommendations]').forEach(recommendations);
  document.addEventListener('shopify:section:load',e=>{$$('[data-cfc-recommendations]',e.target).forEach(recommendations);});
})();
// Predictive search includes real products, collections and content from Shopify.
(() => {
  const form=document.querySelector('[data-cfc-predictive]'),list=document.querySelector('[data-cfc-suggestions]');if(!form || !list)return;
  const input=form.querySelector('[name=q]');let timer,controller;
  input.addEventListener('input',()=>{clearTimeout(timer);controller?.abort();list.replaceChildren();const q=input.value.trim();if(q.length<2)return;timer=setTimeout(async()=>{controller=new AbortController();try{const root=(window.CFC?.root || '/').replace(/\/?$/,'/');const u=new URL(root+'search/suggest.json',location.origin);u.searchParams.set('q',q);u.searchParams.set('resources[type]','product');u.searchParams.set('resources[limit]','4');const r=await timedFetch(u,{signal:controller.signal},10000);if(!r.ok)return;const data=await r.json();if(input.value.trim()!==q)return;for(const [type,items] of Object.entries(data.resources?.results || {})){if(!Array.isArray(items))continue;for(const item of items){const url=new URL(item.url,location.origin);if(url.origin!==location.origin || !/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:products|collections|pages|blogs)\//i.test(url.pathname))continue;const a=document.createElement('a');a.href=url.href;a.textContent=String(item.title);a.className='cfc-search-suggestion';list.append(a);}}}catch(_){/* Normal search remains available. */}},250);});
  input.addEventListener('keydown',e=>{if(e.key==='Escape'){controller?.abort();clearTimeout(timer);list.replaceChildren();}});
})();
