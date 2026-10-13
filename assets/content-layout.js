/* Presentation only: source content and commerce data remain Shopify-owned. */
(() => {
  const labels = new Map([
    ['product features', 'Product features'], ['key features', 'Product features'],
    ['fabric composition', 'Materials & construction'], ['material composition', 'Materials & construction'], ['materials', 'Materials & construction'], ['material', 'Materials & construction'],
    ['materials & construction', 'Materials & construction'], ['fabric', 'Materials & construction'],
    ['washing instructions', 'Care instructions'], ['care instructions', 'Care instructions'], ['care', 'Care instructions'],
    ['size guide', 'Size guide'], ['size chart', 'Size guide'], ['sizing', 'Size guide'],
    ['product description', 'Description'], ['description', 'Description'],
    ['product information', 'Product information'], ['safety information', 'Safety information'],
    ['gpsr information', 'Product information']
  ]);
  const normalized = text => text.trim().toLowerCase().replace(/[:：]\s*$/, '').trim();
  function organizeProduct(root) {
    const source = root.querySelector('[data-cfc-product-description]');
    const target = root.querySelector('[data-cfc-description-sections]');
    if (!source || !target || source.dataset.organized) return;
    const copy = source.cloneNode(true);
    const groups = new Map();
    const add = (label, fragment) => {
      if (!fragment.textContent.trim() && !fragment.querySelector?.('img,table,video')) return;
      if (!groups.has(label)) groups.set(label, document.createDocumentFragment());
      groups.get(label).append(fragment);
    };
    // Move only recognisable measurement tables, never arbitrary product tables.
    copy.querySelectorAll('table').forEach(table => {
      const text = [...table.querySelectorAll("th,td")].map(cell=>cell.textContent).join(" ");
      if (/\b(width|length|chest|waist|height|diameter|circumference|size)\b/i.test(text) && /\b(cm|inches|inch|mm)\b|\bin\./i.test(text)) {
        const fragment = document.createDocumentFragment();
        fragment.append(table);
        add('Size guide', fragment);
      }
    });
    // Printify commonly uses a single paragraph with BRs/newlines. Recognise
    // explicit labels only; do not infer specifications from ordinary prose.
    const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
    const texts = []; while (walker.nextNode()) texts.push(walker.currentNode);
    const names = [...labels.keys()].sort((a,b) => b.length-a.length).map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
    const pattern = new RegExp('(^|\\n|[.;]\\s+)\\s*(' + names + ')\\s*(?::|(?=\\n|$))', 'gi');
    texts.forEach(node => {
      if (node.parentElement.closest('table,script,style')) return;
      const text = node.textContent; const matches = [...text.matchAll(pattern)];
      if (!matches.length) return;
      const fragment = document.createDocumentFragment(); let cursor = 0;
      for (const match of matches) {
        fragment.append(document.createTextNode(text.slice(cursor,match.index)));
        const marker = document.createElement('span'); marker.dataset.cfcLabel = labels.get(normalized(match[2]));
        marker.textContent = match[0]; fragment.append(marker); cursor = match.index + match[0].length;
      }
      fragment.append(document.createTextNode(text.slice(cursor))); node.replaceWith(fragment);
    });
    // Styled headings are also allowed, including vendor headings without BRs.
    copy.querySelectorAll('h1,h2,h3,h4,h5,h6,strong,b,p').forEach(node => {
      if (node.querySelector('[data-cfc-label]') || node.closest('table')) return;
      const label = labels.get(normalized(node.textContent));
      if (label) node.dataset.cfcLabel = label;
      // Unrecognised headings stay with the description; never classify by guesswork.
    });
    const markers = [...copy.querySelectorAll('[data-cfc-label]')].filter(el=>!el.parentElement.closest('[data-cfc-label]'));
    let previous = null; let label = 'Description';
    for (const marker of [...markers, null]) {
      const range = document.createRange();
      if (previous) range.setStartAfter(previous); else range.setStart(copy,0);
      if (marker) range.setEndBefore(marker); else range.setEnd(copy,copy.childNodes.length);
      add(label,range.cloneContents());
      if (marker) { label=marker.dataset.cfcLabel; previous=marker; }
    }
    const panels = document.createDocumentFragment();
    for (const [name,content] of groups) {
      if (name === 'Description') continue;
      const details = document.createElement('details'); details.className='cfc-product-details';
      const summary=document.createElement('summary'); summary.textContent=name;
      const body=document.createElement('div'); body.className='cfc-richtext'; body.append(content); cleanProductBody(body);
      details.append(summary,body); panels.append(details);
    }
    source.replaceChildren(groups.get('Description') || document.createDocumentFragment());
    source.hidden = !source.textContent.trim() && !source.querySelector('img,video,table');
    target.replaceChildren(panels); source.dataset.organized='true';
  }
  function cleanProductBody(body) {
    // Reformat only explicit supplier bullet lines; do not rewrite their wording.
    body.querySelectorAll('p').forEach(p=>{
      const lines=p.innerHTML.split(/<br\s*\/?>(?:\s*\n)?|\n/gi);
      if(!lines.some(line=>/^\s*(?:-|•|\.:)\s+/.test(line)))return;
      const fragment=document.createDocumentFragment();let list=null;
      lines.forEach(line=>{
        if(!line.trim())return;
        if(/^\s*(?:-|•|\.:)\s+/.test(line)){
          if(!list){list=document.createElement('ul');fragment.append(list);}
          const li=document.createElement('li');li.innerHTML=line.replace(/^\s*(?:-|•|\.:)\s+/,'');list.append(li);
        }else{list=null;const paragraph=document.createElement('p');paragraph.innerHTML=line;fragment.append(paragraph);}
      });p.replaceWith(fragment);
    });
    body.querySelectorAll('p,strong,b').forEach(p=>{if(!p.textContent.trim()&&!p.querySelector('img,table'))p.remove();});
  }
  function animateDetails(details) {
    if(details.dataset.cfcAnimated)return;details.dataset.cfcAnimated='true';
    const summary=details.querySelector(':scope > summary');if(!summary)return;
    let animation=null,closing=false;
    summary.addEventListener('click',event=>{
      if(!details.animate || matchMedia('(prefers-reduced-motion: reduce)').matches)return;
      event.preventDefault();
      const start=details.getBoundingClientRect().height;
      const willOpen=!details.open || closing;
      if(animation){animation.onfinish=null;animation.cancel();}
      details.style.height='';details.style.overflow='hidden';details.open=true;
      const end=willOpen?details.getBoundingClientRect().height:summary.getBoundingClientRect().height;
      closing=!willOpen;
      animation=details.animate({height:[start+'px',end+'px']},{duration:240,easing:'cubic-bezier(.2,.8,.2,1)'});
      animation.onfinish=()=>{details.open=willOpen;details.style.overflow='';animation=null;closing=false;};
    });
  }
  function documentNavigation(body) {
    if (body.dataset.cfcIndexed) return;
    body.dataset.cfcIndexed='true';
    body.querySelectorAll('p').forEach(p=>{ const bold=p.querySelector(':scope > strong,:scope > b'); if(bold && p.textContent.trim()===bold.textContent.trim() && p.textContent.trim().length<140 && p.textContent.trim().length>0){const h=document.createElement('h2');h.append(...p.childNodes);if(p.id)h.id=p.id;p.replaceWith(h);} });
    const headings=[...body.querySelectorAll('h2,h3')].filter(h=>h.textContent.trim());
    if (headings.length < 2) return;
    const nav=document.createElement('nav'); nav.className='cfc-document-contents'; nav.setAttribute('aria-label','On this page');
    const title=document.createElement('p'); title.className='cfc-eyebrow'; title.textContent='On this page'; nav.append(title);
    headings.forEach((heading,i)=>{
      if(!heading.id) {let id='cfc-topic-'+i;while(document.getElementById(id))id+='-x';heading.id=id;}
      const a=document.createElement('a');a.href='#'+heading.id;a.textContent=heading.textContent.trim();nav.append(a);
    });
    // Keep all legal text visible; present sections as distinct reading blocks.
    const blocks=[...body.children]; let current=null;
    blocks.forEach(node=>{
      if(node.tagName==='H2'){
        current=document.createElement('section');current.className='cfc-reading-section';
        current.setAttribute('aria-labelledby',node.id);node.before(current);
      }
      if(current)current.append(node);
    });
    const sidebar=body.closest('.cfc-document-layout')?.querySelector('.cfc-document-sidebar');
    if(sidebar)sidebar.prepend(nav);else body.before(nav);
  }
  function init(scope=document) {
    scope.querySelectorAll('[data-cfc-product-details-root]').forEach(root=>{
      try{organizeProduct(root);}catch(error){/* Keep the complete server-rendered source on unsupported markup. */}
    });
    scope.querySelectorAll('.cfc-product-details').forEach(animateDetails);
    scope.querySelectorAll('[data-cfc-document],.shopify-policy__body').forEach(documentNavigation);
    scope.querySelectorAll('.cfc-richtext table,.shopify-policy__body table').forEach(table=>{
      if(table.parentElement.classList.contains('cfc-table-scroll'))return;
      const wrap=document.createElement('div'); wrap.className='cfc-table-scroll';wrap.tabIndex=0;
      wrap.setAttribute('role','region');wrap.setAttribute('aria-label','Scrollable product or information table');
      table.before(wrap);wrap.append(table);
    });
  }
  init();document.addEventListener('shopify:section:load',event=>init(event.target));
})();
