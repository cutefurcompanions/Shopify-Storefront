/* Optional integrations: same-origin app proxies only; no provider credentials. */
(() => {
  'use strict';
  const C=window.CFC || {}, $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
  const base=(C.root || '/').replace(/\/?$/,'/');
  function proxy(value){try{if(!value)return null;const u=new URL(value,location.origin);return u.origin===location.origin && u.pathname.startsWith('/apps/') && !u.username && !u.password && !u.hash ? u.href:null;}catch(_){return null;}}
  function productLink(handle){return typeof handle==='string' && /^[a-z0-9][a-z0-9-]{0,199}$/.test(handle)?base+'products/'+handle:null;}
  function resultImage(value){try{const u=new URL(value,location.origin);return u.origin===location.origin && u.pathname.startsWith('/apps/') && !u.username && !u.password?u.href:null;}catch(_){return null;}}
  function initAssistant(widget){
    if(widget.dataset.ready)return;widget.dataset.ready='true';
    const toggle=$('[data-cfc-ai-toggle]',widget),panel=$('[data-cfc-ai-panel]',widget),messages=$('[data-cfc-ai-messages]',widget),form=$('[data-cfc-ai-form]',widget),input=$('input',form);
    let pending=false,drag=null,moved=false,history=[];
    function message(text,role,products=[]){
      const el=document.createElement('div');el.className='cfc-ai-message cfc-ai-message--'+role;
      const copy=document.createElement('p');copy.textContent=String(text).slice(0,6000);el.append(copy);
      if(Array.isArray(products))products.slice(0,5).forEach(p=>{const href=productLink(p?.handle);if(!href)return;const a=document.createElement('a');a.href=href;a.className='cfc-ai-link';a.textContent=String(p.title || 'View piece').slice(0,200);el.append(a);});
      messages.append(el);while(messages.children.length>40)messages.firstElementChild.remove();messages.scrollTop=messages.scrollHeight;return el;
    }
    function open(yes){panel.hidden=!yes;toggle.setAttribute('aria-expanded',String(yes));if(yes){widget.classList.remove('cfc-ai-obscured');input.focus();}else toggle.focus();}
    toggle.addEventListener('click',e=>{if(moved){e.preventDefault();moved=false;return;}open(panel.hidden);});
    $('[data-cfc-ai-close]',widget).addEventListener('click',()=>open(false));
    document.addEventListener('keydown',e=>{if(e.key==='Escape' && !panel.hidden && !$('dialog[open]')){e.stopPropagation();open(false);}});
    async function send(text){
      text=String(text || '').trim().slice(0,300);if(!text || pending)return;
      message(text,'user');input.value='';const endpoint=proxy(C.aiEndpoint);
      if(!endpoint || !C.aiEnabled){message('Live recommendations are currently unavailable. Search the shop for an animal, landscape or plant, or browse our collections.','assistant');const a=document.createElement('a');a.href=base+'search?q='+encodeURIComponent(text);a.textContent='Search the shop';a.className='cfc-ai-link';messages.lastElementChild.append(a);return;}
      pending=true;$$('button[type=submit],[data-cfc-ai-suggestion]',widget).forEach(b=>b.disabled=true);const loading=message('Finding your next piece…','assistant');
      try{
        const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},credentials:'same-origin',signal:AbortSignal.timeout(30000),body:JSON.stringify({message:text,history:history.slice(-10),context:{product:C.productHandle || null,collection:C.collectionHandle || null,page:C.pageType || 'storefront'}})});
        if(!r.ok)throw new Error();const data=await r.json();if(typeof data.reply!=='string' || !data.reply.trim())throw new Error();loading.remove();message(data.reply,'assistant',data.products);history.push({role:'user',content:text},{role:'assistant',content:data.reply.slice(0,6000)});history=history.slice(-10);
      }catch(_){loading.remove();message('The shopping assistant is unavailable right now. Please use the store search or navigation.','assistant');}
      finally{pending=false;$$('button[type=submit],[data-cfc-ai-suggestion]',widget).forEach(b=>b.disabled=false);}
    }
    form.addEventListener('submit',e=>{e.preventDefault();send(input.value);});$$('[data-cfc-ai-suggestion]',widget).forEach(b=>b.addEventListener('click',()=>send(b.dataset.cfcAiSuggestion)));
    function clamp(left,top){widget.style.left=Math.max(8,Math.min(innerWidth-66,left))+'px';widget.style.top=Math.max(72,Math.min(innerHeight-90,top))+'px';widget.style.right='auto';widget.style.bottom='auto';}
    toggle.addEventListener('pointerdown',e=>{if(e.button!==0)return;const r=widget.getBoundingClientRect();drag={x:e.clientX,y:e.clientY,left:r.left,top:r.top};moved=false;});
    toggle.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>6){moved=true;toggle.setPointerCapture(e.pointerId);}if(moved)clamp(drag.left+dx,drag.top+dy);});
    toggle.addEventListener('pointerup',()=>{drag=null;});toggle.addEventListener('pointercancel',()=>{drag=null;moved=false;});
    let scheduled=false;
    function avoidControls(){scheduled=false;const r=toggle.getBoundingClientRect();const obstructs=$$('main form button,main form input,main form select,main form textarea,.shopify-payment-button').some(el=>{const b=el.getBoundingClientRect();return b.width && r.left<b.right && r.right>b.left && r.top<b.bottom && r.bottom>b.top;});widget.classList.toggle('cfc-ai-obscured',panel.hidden && obstructs);}
    window.addEventListener('scroll',()=>{if(!scheduled){scheduled=true;requestAnimationFrame(avoidControls);}},{passive:true});window.addEventListener('resize',avoidControls);avoidControls();
    window.addEventListener('resize',()=>{if(widget.style.left){const r=widget.getBoundingClientRect();clamp(r.left,r.top);}});
  }
  function initTryOn(box){
    const form=$('[data-cfc-tryon-form]',box);if(!form || box.dataset.ready)return;box.dataset.ready='true';
    const fileInput=$('[data-cfc-tryon-file]',box),status=$('[data-cfc-tryon-status]',box),preview=$('[data-cfc-tryon-preview]',box),progress=$('progress',box),cancel=$('[data-cfc-tryon-cancel]',box),button=$('button[type=submit]',form);
    let active=null,objectURL=null,generation=0,validFile=null;
    function clearPreview(){if(objectURL){URL.revokeObjectURL(objectURL);objectURL=null;}preview.replaceChildren();}
    async function validate(file){
      if(!file || !['image/jpeg','image/png','image/webp'].includes(file.type) || file.size===0 || file.size>12*1024*1024)throw new Error('Choose a JPEG, PNG or WebP image up to 12 MB.');
      const bytes=new Uint8Array(await file.slice(0,16).arrayBuffer());
      const png=bytes[0]===137 && bytes[1]===80 && bytes[2]===78 && bytes[3]===71;
      const jpg=bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
      const webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF' && String.fromCharCode(...bytes.slice(8,12))==='WEBP';
      if(!(file.type==='image/png' && png || file.type==='image/jpeg' && jpg || file.type==='image/webp' && webp))throw new Error('This file is not a supported image.');
      let bitmap;try{bitmap=await createImageBitmap(file);if(!bitmap.width || !bitmap.height || bitmap.width*bitmap.height>40000000)throw new Error();}catch(_){throw new Error('This image is corrupted or too large to decode. Choose another photo.');}finally{bitmap?.close();}
    }
    fileInput.addEventListener('change',async()=>{const current=++generation;validFile=null;clearPreview();const file=fileInput.files[0];if(!file)return;status.textContent='Checking photo…';button.disabled=true;try{await validate(file);if(current!==generation)return;validFile=file;objectURL=URL.createObjectURL(file);const image=new Image();image.src=objectURL;image.alt='Selected photo, not an AI result';preview.append(image);status.textContent='Photo ready. Nothing has been uploaded yet.';}catch(e){if(current===generation){fileInput.value='';status.textContent=e.message;}}finally{if(current===generation)button.disabled=false;}});
    cancel.addEventListener('click',()=>active?.abort());
    form.addEventListener('submit',async e=>{
      e.preventDefault();if(active || !form.reportValidity())return;
      const endpoint=proxy(C.tryOnEndpoint);if(!endpoint || !C.tryOnEnabled){status.textContent='Try-on is currently unavailable.';return;}
      const file=fileInput.files[0];if(!file || file!==validFile){status.textContent='Choose a valid photo first.';return;}
      button.disabled=true;fileInput.disabled=true;cancel.hidden=false;progress.hidden=false;progress.value=0;status.textContent='Uploading your photo…';
      const data=new FormData();data.append('photo',file,'try-on.'+({ 'image/jpeg':'jpg','image/png':'png','image/webp':'webp' }[file.type]));data.append('product_handle',box.dataset.productHandle);data.append('variant_id',$('[data-cfc-product-form] input[name=id]')?.value || '');
      const xhr=new XMLHttpRequest();active=xhr;xhr.open('POST',endpoint);xhr.timeout=120000;xhr.responseType='json';xhr.setRequestHeader('Accept','application/json');
      xhr.upload.onprogress=e=>{if(e.lengthComputable)progress.value=e.loaded/e.total*100;};xhr.upload.onload=()=>{progress.removeAttribute('value');status.textContent='Generating your visualization…';};
      xhr.onload=()=>{const url=resultImage(xhr.response?.image_url);if(xhr.status<200 || xhr.status>=300 || !url){status.textContent='No visualization was returned. Please try again later.';return;}clearPreview();const image=new Image();image.alt='AI clothing visualization; actual fit and color may vary';image.onload=()=>status.textContent='Visualization ready. Actual garment fit and color may vary.';image.onerror=()=>status.textContent='The result image could not be loaded.';image.src=url;preview.append(image);};
      xhr.onerror=xhr.ontimeout=()=>status.textContent='Try-on is unavailable. Please try again later.';xhr.onabort=()=>status.textContent='Request cancelled. Processing may already have started; see the photo policy for deletion details.';
      xhr.onloadend=()=>{active=null;button.disabled=false;fileInput.disabled=false;cancel.hidden=true;progress.hidden=true;};xhr.send(data);
    });
    window.addEventListener('pagehide',()=>{active?.abort();if(objectURL)URL.revokeObjectURL(objectURL);});
  }
  function init(scope=document){$$('[data-cfc-ai-widget]',scope).forEach(initAssistant);$$('[data-cfc-tryon]',scope).forEach(initTryOn);}
  init();document.addEventListener('shopify:section:load',e=>init(e.target));
})();
