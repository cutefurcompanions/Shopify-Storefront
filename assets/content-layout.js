/* Product and policy presentation; Shopify remains the source of product and policy text. */
(() => {
  const labels = new Map([
    ['product features', 'Product features'], ['key features', 'Product features'],
    ['fabric composition', 'Materials'], ['material composition', 'Materials'], ['materials', 'Materials'], ['material', 'Materials'], ['fabric', 'Materials'], ['materials & construction', 'Materials'],
    ['washing instructions', 'Care instructions'], ['care instructions', 'Care instructions'], ['care', 'Care instructions'],
    ['size guide', 'Size guide'], ['size chart', 'Size guide'], ['sizing', 'Size guide'],
    ['product description', 'Description'], ['description', 'Description'],
    ['product information', 'Product details'], ['product details', 'Product details'],
    ['gpsr information', 'Product safety'], ['safety information', 'Product safety'], ['warnings, hazard', 'Product safety'], ['warning', 'Product safety'], ['hazard', 'Product safety'],
    ['eu representative', 'Compliance contact'], ['responsible person', 'Compliance contact'], ['manufacturer', 'Manufacturer information']
  ]);
  const normalized = value => value.trim().toLowerCase().replace(/[:：]\s*$/, '').trim();

  function cleanProductBody(body) {
    if (body.firstChild?.nodeType === Node.TEXT_NODE) body.firstChild.nodeValue = body.firstChild.nodeValue.replace(/^\s*[:·]\s*/, '');
    body.querySelectorAll('p').forEach(paragraph => {
      const lines = paragraph.innerHTML.split(/<br\s*\/?>(?:\s*\n)?|\n/gi);
      if (!lines.some(line => /^\s*(?:-|•|·|:)\s+/.test(line))) return;
      const fragment = document.createDocumentFragment();
      let list;
      lines.forEach(line => {
        if (!line.trim()) return;
        if (/^\s*(?:-|•|·|:)\s+/.test(line)) {
          if (!list) { list = document.createElement('ul'); fragment.append(list); }
          const item = document.createElement('li');
          item.innerHTML = line.replace(/^\s*(?:-|•|·|:)\s+/, '');
          list.append(item);
        } else {
          list = null;
          const next = document.createElement('p');
          next.innerHTML = line;
          fragment.append(next);
        }
      });
      paragraph.replaceWith(fragment);
    });
    body.querySelectorAll('p,strong,b').forEach(element => {
      if (!element.textContent.trim() && !element.querySelector('img,table')) element.remove();
    });
  }

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

    copy.querySelectorAll('table').forEach(table => {
      const text = [...table.querySelectorAll('th,td')].map(cell => cell.textContent).join(' ');
      if (/\b(width|length|chest|waist|height|diameter|circumference|size)\b/i.test(text) && /\b(cm|inches|inch|mm)\b|\bin\./i.test(text)) {
        const fragment = document.createDocumentFragment();
        fragment.append(table);
        add('Size guide', fragment);
      }
    });

    const names = [...labels.keys()].sort((a, b) => b.length - a.length).map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const pattern = new RegExp('(^|\\n|[.;]\\s+)\\s*(' + names + ')\\s*(?::|(?=\\n|$))', 'gi');
    const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
    const texts = [];
    while (walker.nextNode()) texts.push(walker.currentNode);
    texts.forEach(node => {
      if (node.parentElement.closest('table,script,style')) return;
      const matches = [...node.textContent.matchAll(pattern)];
      if (!matches.length) return;
      const fragment = document.createDocumentFragment();
      let cursor = 0;
      matches.forEach(match => {
        fragment.append(document.createTextNode(node.textContent.slice(cursor, match.index)));
        const marker = document.createElement('span');
        marker.dataset.cfcLabel = labels.get(normalized(match[2]));
        marker.textContent = match[0];
        fragment.append(marker);
        cursor = match.index + match[0].length;
      });
      fragment.append(document.createTextNode(node.textContent.slice(cursor)));
      node.replaceWith(fragment);
    });

    copy.querySelectorAll('h1,h2,h3,h4,h5,h6,strong,b,p').forEach(node => {
      if (node.querySelector('[data-cfc-label]') || node.closest('table')) return;
      const label = labels.get(normalized(node.textContent));
      if (label) node.dataset.cfcLabel = label;
    });
    const markers = [...copy.querySelectorAll('[data-cfc-label]')].filter(element => !element.parentElement.closest('[data-cfc-label]'));
    let previous = null;
    let label = 'Description';
    [...markers, null].forEach(marker => {
      const range = document.createRange();
      if (previous) range.setStartAfter(previous); else range.setStart(copy, 0);
      if (marker) range.setEndBefore(marker); else range.setEnd(copy, copy.childNodes.length);
      add(label, range.cloneContents());
      if (marker) { label = marker.dataset.cfcLabel; previous = marker; }
    });

    const panels = document.createDocumentFragment();
    groups.forEach((group, name) => {
      if (name === 'Description') return;
      const details = document.createElement('details');
      details.className = 'cfc-product-details';
      const summary = document.createElement('summary');
      summary.textContent = name;
      const body = document.createElement('div');
      body.className = 'cfc-richtext';
      body.append(group);
      cleanProductBody(body);
      details.append(summary, body);
      panels.append(details);
    });
    source.replaceChildren(groups.get('Description') || document.createDocumentFragment());
    source.hidden = !source.textContent.trim() && !source.querySelector('img,video,table');
    target.replaceChildren(panels);
    source.dataset.organized = 'true';
  }

  function animateDetails(details) {
    if (details.dataset.cfcAnimated) return;
    details.dataset.cfcAnimated = 'true';
    const summary = details.querySelector(':scope > summary');
    if (!summary) return;
    let animation = null;
    let closing = false;
    summary.addEventListener('click', event => {
      if (!details.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      event.preventDefault();
      const start = details.getBoundingClientRect().height;
      const willOpen = !details.open || closing;
      if (animation) { animation.onfinish = null; animation.cancel(); }
      details.style.height = '';
      details.style.overflow = 'hidden';
      details.open = true;
      const end = willOpen ? details.getBoundingClientRect().height : summary.getBoundingClientRect().height;
      closing = !willOpen;
      animation = details.animate({height:[start+'px',end+'px']}, {duration:240,easing:'cubic-bezier(.2,.8,.2,1)'});
      animation.onfinish = () => { details.open = willOpen; details.style.overflow = ''; animation = null; closing = false; };
    });
  }

  function enhanceDocumentMeta(body) {
    const item = [...body.children].find(element => /^last updated\s*:/i.test(element.textContent.trim()));
    if (!item) return;
    const value = item.textContent.trim().replace(/^last updated\s*:\s*/i, '');
    const meta = document.createElement('p');
    meta.className = 'cfc-document-meta';
    const label = document.createElement('span');
    label.textContent = 'Last updated';
    const time = document.createElement('time');
    time.textContent = value;
    meta.append(label, time);
    item.replaceWith(meta);
  }

  function documentNavigation(body) {
    if (body.dataset.cfcIndexed) return;
    body.dataset.cfcIndexed = 'true';
    enhanceDocumentMeta(body);
    body.querySelectorAll('p').forEach(paragraph => {
      const bold = paragraph.querySelector(':scope > strong,:scope > b');
      if (bold && paragraph.textContent.trim() === bold.textContent.trim() && paragraph.textContent.trim().length < 140 && paragraph.textContent.trim().length > 0) {
        const heading = document.createElement('h2');
        heading.append(...paragraph.childNodes);
        if (paragraph.id) heading.id = paragraph.id;
        paragraph.replaceWith(heading);
      }
    });
    const headings = [...body.querySelectorAll('h2,h3')].filter(heading => heading.textContent.trim());
    if (headings.length < 2) return;
    const nav = document.createElement('nav');
    nav.className = 'cfc-document-contents';
    nav.setAttribute('aria-label', 'On this page');
    const title = document.createElement('p');
    title.className = 'cfc-eyebrow';
    title.textContent = 'On this page';
    nav.append(title);
    headings.forEach((heading, index) => {
      if (!heading.id) {
        let id = 'cfc-topic-' + index;
        while (document.getElementById(id)) id += '-x';
        heading.id = id;
      }
      const link = document.createElement('a');
      link.href = '#' + heading.id;
      link.textContent = heading.textContent.trim();
      nav.append(link);
    });
    const blocks = [...body.children];
    let current = null;
    blocks.forEach(node => {
      if (node.tagName === 'H2') {
        current = document.createElement('section');
        current.className = 'cfc-reading-section';
        current.setAttribute('aria-labelledby', node.id);
        node.before(current);
      }
      if (current) current.append(node);
    });
    const sidebar = body.closest('.cfc-document-layout')?.querySelector('.cfc-document-sidebar');
    if (sidebar) sidebar.prepend(nav); else body.before(nav);
  }

  function init(scope = document) {
    scope.querySelectorAll('[data-cfc-product-details-root]').forEach(root => {
      try { organizeProduct(root); } catch (_) { /* The untouched Shopify content remains visible. */ }
    });
    scope.querySelectorAll('.cfc-product-details').forEach(animateDetails);
    scope.querySelectorAll('[data-cfc-document],.shopify-policy__body').forEach(documentNavigation);
    scope.querySelectorAll('.cfc-richtext table,.shopify-policy__body table').forEach(table => {
      if (table.parentElement.classList.contains('cfc-table-scroll')) return;
      const wrap = document.createElement('div');
      wrap.className = 'cfc-table-scroll';
      wrap.tabIndex = 0;
      wrap.setAttribute('role', 'region');
      wrap.setAttribute('aria-label', 'Scrollable product or information table');
      table.before(wrap);
      wrap.append(table);
    });
  }
  init();
  document.addEventListener('shopify:section:load', event => init(event.target));
})();