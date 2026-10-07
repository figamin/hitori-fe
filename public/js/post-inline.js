// Post inlining, the way the 4chanX userscript does it: clicking a quote link or a
// backlink renders the post it points at *inside* the post that mentions it, and those
// boxes nest - an inlined post shows its own quote links and backlinks, and clicking those
// opens further boxes inside it, to any depth.
//
// Where a box goes is what kind of link was clicked (the reader's rule):
//   a quote link  is part of the text  -> the quoted post opens right under that text
//   a backlink    is "who replied to me" -> the reply opens above all of the post's text
//
// Clicking the same link again closes the box. The number of an inlined post is drawn in a
// different shade and is the switch for the boxes nested inside it: one click closes them
// all (exactly how they were is remembered), the next puts them back.
//
// The post itself comes from `/cells/post-preview`, the same cell the hover previews use,
// so an inlined post has its real name, capcode, files and text - and its own quote links
// are the real ones, which is what makes the nesting work.
//
// A reader who does not want this turns it off in Settings -> Other; then a click does
// what it always did - jump to the post and highlight it (`markPost`).
(function () {
  const ENABLE_KEY = 'disablePostInlining';

  // What the reader sees under a box while it loads, or when the post cannot be shown.
  const LOADING = 'Loading…';

  function enabled() {
    return localStorage.getItem(ENABLE_KEY) !== 'true';
  }

  // The post a link points at. The hover previews already parse these urls - including
  // vichan's `/o/res/111.html#297` form - so the same parser is reused here.
  function targetOf(link) {
    const url = link.getAttribute('href') || link.href || '';
    const parts = window.tooltips?.parseQuoteUrl?.(url);
    if (!parts || !parts.postId) return null;
    return parts;
  }

  function isModified(event) {
    return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || (typeof event.button === 'number' && event.button !== 0);
  }

  // The post the link was written in: the box it is drawn inside, or a post of the page.
  // Every box opened here becomes a child of *that* post - never a child of another box
  // that happens to be open in it.
  function hostOf(link) {
    return link.closest('.post-inline') || link.closest('.post[data-post-id]') || link.closest('.post-container') || null;
  }

  // The host's own text. `querySelector` would not do: an open box carries a
  // `.reply-content` of its own (the preview cell), and that one can come first in the
  // document - which is how a post's second backlink used to be rendered *inside* the
  // first one instead of under it.
  function contentOf(host) {
    if (!host) return null;
    if (host.classList.contains('post-inline')) {
      return host.querySelector(':scope > .preview-content > .reply-content, :scope > .preview-content > .thread-content');
    }
    return host.querySelector(':scope > .reply-content, :scope > .thread-content');
  }

  // Which link is written first, as the reader sees it: the position of a post's `>>` link
  // in the host's own backlink row. The row *is* the reference order (`>>A >>B` written in
  // that order), and its ids are what is stable - `quote.js` rebuilds the row on every DOM
  // change, so an anchor that was clicked a moment ago may already be replaced, which is
  // why the order cannot be read off the stored anchors.
  function referenceIndex(host, postId) {
    const row = host?.querySelector('.backlinks, .inline-backlinks');
    if (!row) return -1;
    const ids = [...row.querySelectorAll('a')].map((link) => (link.getAttribute('href') || '').split('#')[1] || (link.textContent || '').replace(/\D/g, ''));
    return ids.indexOf(String(postId));
  }

  // Where the box goes. A quote link is part of a sentence, so its box sits right under the
  // text in question; a backlink is not, so its box goes in front of the host's text (above
  // all of it). Boxes opened from the same host are stacked there in the order their links
  // are *written* - `>>A >>B` shows A above B however they were clicked - never nested one
  // in the next; nesting is for a link written inside an already open box (the tree).
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

  // The post's data: already known if it is on this page, otherwise the thread's JSON
  // (which the hover previews also fetch, and cache here for everyone to share).
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

  // The ids of the posts that quote this one, so the box can show the same "who replied
  // to me" row a real post shows - and the chain can be followed from inside the box.
  //
  // Every quote of it written in a post on the page says it: the post the link was written
  // in quotes this one. That post is a box when the quote was written *by* an inlined post
  // (`>>1234` inside the text of a box), and a post of the page otherwise. Quotes from
  // another board or thread are left out: their ids mean nothing here.
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
    const row = document.createElement('div');
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

    box.insertBefore(row, box.firstChild);
  }

  // The number of an inlined post: drawn in its own shade, and the switch for the boxes
  // nested inside this one.
  function decorate(box) {
    const info = box.querySelector('.preview-content > .post-info') || box.querySelector('.post-info');
    const number =
      info?.querySelector('.post-num') ||
      [...(info?.children || [])].find((el) => /^No\.\d+$/.test((el.textContent || '').trim()));

    if (number) {
      number.classList.add('inline-number');
      number.title = 'Close or reopen the posts opened inside this one';
      number.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleChildren(box);
      });
    }

    if (box.dataset.inlinePost) addBacklinks(box);
  }

  // ---------------------------------------------------------------- the boxes

  const childrenOf = (box) => [...box.querySelectorAll('.post-inline')].filter((child) => child.parentElement?.closest('.post-inline') === box);

  // Closing the box does not throw its contents away: where each child was is remembered,
  // so reopening puts the same posts back in the same places.
  function toggleChildren(box) {
    if (box.classList.contains('inline-collapsed')) {
      (box.__inlineChildren || []).forEach(({ child, parent, next }) => {
        parent.insertBefore(child, next && next.parentNode === parent ? next : null);
      });
      box.__inlineChildren = null;
      box.classList.remove('inline-collapsed');
      return;
    }

    box.__inlineChildren = childrenOf(box).map((child) => ({ child, parent: child.parentNode, next: child.nextSibling }));
    box.__inlineChildren.forEach(({ child }) => child.remove());
    box.classList.add('inline-collapsed');
  }

  function close(box) {
    if (box.__anchor) box.__anchor.__inlineBox = null;
    box.remove();
  }

  function closeAll() {
    document.querySelectorAll('.post-inline').forEach(close);
  }

  function open(link, parts) {
    const box = document.createElement('div');
    box.className = 'post-inline';
    box.dataset.inlinePost = parts.postId;
    box.__anchor = link;
    box.__parts = parts;
    box.innerHTML = `<div class="inline-note">${LOADING}</div>`;
    link.__inlineBox = box;
    insertBox(box, link);

    (async () => {
      try {
        const data = await postData(parts);
        if (!data) throw new Error('Post not found');
        const res = await fetch('/cells/post-preview?post=' + encodeURIComponent(JSON.stringify(data)));
        if (!res.ok) throw new Error('Post could not be rendered');
        box.innerHTML = await res.text();
        decorate(box);
        // The links inside the box are new to the page: give them the hover previews too
        // (the page's own observer usually gets there first, and this is a no-op then).
        window.tooltips?.refreshQuotes?.(box);
      } catch (err) {
        box.innerHTML = `<div class="inline-note">${err.message}</div>`;
      }
    })();

    return box;
  }

  // Is this click the inliner's? Returns false when the reader has it turned off (or the
  // link cannot be resolved), which leaves the click to the browser and `markPost`.
  function toggle(link) {
    const existing = link.__inlineBox;
    if (existing) close(existing);
    if (!enabled()) return false;
    if (existing) return true;

    const parts = targetOf(link);
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

    // Turned off, or nothing to inline: the post is marked (jumped to) the way it always
    // was, and only when it is on this page - a link into another thread still navigates.
    const parts = targetOf(link);
    if (parts && document.querySelector(`[data-post-id="${parts.postId}"]`) && window.markPost) {
      window.markPost(parts.postId);
    }
  });

  window.postInline = { enabled, closeAll, toggle, targetOf, ENABLE_KEY };
})();
