(function () {
  const DISABLE_KEY = 'disablePostInlining';

  const LOADING = 'Loading…';

  function enabled() {
    return localStorage.getItem(DISABLE_KEY) !== 'true';
  }

  function targetOf(link) {
    const url = link.getAttribute('href') || link.href || '';
    const parts = window.tooltips?.parseQuoteUrl?.(url);
    if (!parts || !parts.postId) return null;
    return parts;
  }

  function isModified(event) {
    return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || (typeof event.button === 'number' && event.button !== 0);
  }

  function hostOf(link) {
    return link.closest('.post-inline') || link.closest('.post[data-post-id]') || link.closest('.post-container') || null;
  }

  function contentOf(host) {
    if (!host) return null;
    if (host.classList.contains('post-inline')) {
      return host.querySelector(':scope > .preview-content > .reply-content, :scope > .preview-content > .thread-content');
    }
    return host.querySelector(':scope > .reply-content, :scope > .thread-content');
  }

  function referenceIndex(host, postId) {
    const row = host?.querySelector('.backlinks, .inline-backlinks');
    if (!row) return -1;
    const ids = [...row.querySelectorAll('a')].map((link) => (link.getAttribute('href') || '').split('#')[1] || (link.textContent || '').replace(/\D/g, ''));
    return ids.indexOf(String(postId));
  }

  function insertBox(box, link) {
    const host = hostOf(link);
    const kind = link.classList.contains('backlink') ? 'backlink' : 'quote';
    box.__host = host;
    box.__kind = kind;

    const content = kind === 'backlink' ? contentOf(host) : null;
    if (!content || !content.parentNode) {
      link.after(box);
      return;
    }

    const indent = getComputedStyle(content);
    box.style.marginLeft = indent.marginLeft;
    box.style.marginRight = indent.marginRight;

    const parent = content.parentNode;
    const index = referenceIndex(host, box.dataset.inlinePost);
    const siblings = [...parent.children].filter((el) => el.classList?.contains('post-inline') && el.__host === host && el.__kind === 'backlink');
    const before =
      index === -1
        ? null
        : siblings.find((sibling) => {
            const other = referenceIndex(host, sibling.dataset.inlinePost);
            return other === -1 || other > index;
          });
    parent.insertBefore(box, before || content);
  }

  async function postData(parts) {
    const key = `${parts.boardUri}/${parts.postId}`;
    const known = window.tooltips?.knownData?.[key];
    if (known) return known;

    const archivePrefix = parts.archive ? 'archive/' : '';
    const res = await fetch(`/${parts.boardUri}/${archivePrefix}thread/${parts.threadId}.json`);
    if (!res.ok) throw new Error('Post not found');
    const data = await res.json();
    window.tooltips?.cacheThreadData?.(data, parts.boardUri);
    return window.tooltips?.knownData?.[key] || null;
  }

  function quotedBy(box) {
    const parts = box.__parts || {};
    const postId = String(box.dataset.inlinePost);
    const ids = [];

    document.querySelectorAll('a.quoteLink').forEach((link) => {
      if (box.contains(link)) return;
      const target = targetOf(link);
      if (!target || String(target.postId) !== postId) return;
      if (parts.boardUri && target.boardUri !== parts.boardUri) return;
      if (parts.threadId && String(target.threadId) !== String(parts.threadId)) return;

      const quotingBox = link.closest('.post-inline');
      const id = quotingBox ? quotingBox.dataset.inlinePost : link.closest('.post[data-post-id]')?.getAttribute('data-post-id');
      if (id && id !== postId && !ids.includes(id)) ids.push(id);
    });

    return ids;
  }

  function addBacklinks(box) {
    const ids = quotedBy(box);
    if (!ids.length) return;

    const parts = box.__parts || {};
    const base = `/${parts.boardUri}/${parts.archive ? 'archive/' : ''}thread/${parts.threadId}`;
    const row = document.createElement('span');
    row.className = 'inline-backlinks';

    ids.forEach((id, i) => {
      if (i) row.append(' ');
      const backlink = document.createElement('a');
      backlink.className = 'backlink';
      backlink.href = `${base}#${id}`;
      backlink.textContent = `>>${id}`;
      row.append(backlink);
      window.tooltips?.processQuote?.(backlink);
    });

    const info = box.querySelector(':scope > .preview-content > .post-info');
    if (info) info.appendChild(row);
    else box.insertBefore(row, box.firstChild);
  }

  function markForwardLinks(box) {
    const hostId = box.__host?.getAttribute?.('data-post-id') || box.__host?.dataset?.inlinePost;
    if (!hostId) return;
    box.querySelectorAll(':scope > .preview-content > .reply-content a.quoteLink').forEach((link) => {
      if (String(targetOf(link)?.postId) === String(hostId)) link.classList.add('forwardlink');
    });
  }

  function decorate(box) {
    const info = box.querySelector(':scope > .preview-content > .post-info');
    const number = info?.querySelector('.post-num');
    const parts = box.__parts || {};
    if (number && parts.boardUri && parts.threadId) {
      const base = `/${parts.boardUri}/${parts.archive ? 'archive/' : ''}thread/${parts.threadId}`;
      const id = box.dataset.inlinePost;
      const link = document.createElement('a');
      link.className = 'linkQuote';
      link.title = 'Link to this post';
      link.href = `${base}#${id}`;
      link.textContent = 'No.';
      const quote = document.createElement('a');
      quote.className = 'linkQuote';
      quote.title = 'Reply to this post';
      quote.href = `${base}#q${id}`;
      quote.textContent = id;
      number.replaceChildren(link, quote);
    }

    if (box.dataset.inlinePost) addBacklinks(box);
    markForwardLinks(box);
  }


  function close(box) {
    box.remove();
  }

  function openBoxFor(link, parts) {
    const host = hostOf(link);
    const kind = link.classList.contains('backlink') ? 'backlink' : 'quote';
    return (
      [...document.querySelectorAll('.post-inline')].find(
        (box) => box.__host === host && box.__kind === kind && box.dataset.inlinePost === String(parts.postId)
      ) || null
    );
  }

  function closeAll() {
    document.querySelectorAll('.post-inline').forEach(close);
  }

  function open(link, parts) {
    const box = document.createElement('div');
    box.className = 'post-inline';
    box.dataset.inlinePost = parts.postId;
    box.__parts = parts;
    box.innerHTML = `<div class="inline-note">${LOADING}</div>`;
    insertBox(box, link);

    (async () => {
      try {
        const data = await postData(parts);
        if (!data) throw new Error('Post not found');
        const res = await fetch('/cells/post-preview?post=' + encodeURIComponent(JSON.stringify(data)), {
          headers: csrfHeaders()
        });
        if (!res.ok) throw new Error('Post could not be rendered');
        box.innerHTML = await res.text();
        decorate(box);
        window.tooltips?.refreshQuotes?.(box);
      } catch (err) {
        box.innerHTML = `<div class="inline-note">${err.message}</div>`;
      }
    })();

    return box;
  }

  function toggle(link) {
    const parts = targetOf(link);
    const existing = parts ? openBoxFor(link, parts) : null;
    if (existing) close(existing);
    if (!enabled()) return false;
    if (existing) return true;

    if (!parts) return false;
    open(link, parts);
    return true;
  }

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || isModified(event)) return;
    const element = event.target instanceof Element ? event.target : null;
    const link = element?.closest?.('a.quoteLink, a.backlink');
    if (!link) return;

    if (toggle(link)) {
      event.preventDefault();
      return;
    }

    const parts = targetOf(link);
    const onPage =
      parts &&
      document.querySelector(
        `.post[data-board="${parts.boardUri}"][data-thread-id="${parts.threadId}"][data-post-id="${parts.postId}"]`
      );
    if (onPage && window.markPost) {
      window.markPost(parts.postId);
    }
  });

  window.postInline = { enabled, closeAll, toggle, targetOf, DISABLE_KEY };
})();
