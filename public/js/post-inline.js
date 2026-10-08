// Post inlining, the way the 4chanX userscript does it: clicking a quote link or a
// backlink renders the post it points at *inside* the post that mentions it, and those
// boxes nest - an inlined post shows its own quote links and backlinks, and clicking those
// opens further boxes inside it, to any depth.
//
// Where a box goes is what kind of link was clicked (the reader's rule):
//   a quote link  is part of the text  -> the quoted post opens right under that text
//   a backlink    is "who replied to me" -> the reply opens above all of the post's text
//
// Clicking the same link again closes the box. An inlined post's number works like any
// post's: clicking it quotes the post in the quick reply.
//
// The post itself comes from `/cells/post-preview`, the same cell the hover previews use,
// so an inlined post has its real name, capcode, files and text - and its own quote links
// are the real ones, which is what makes the nesting work.
//
// It is off unless the reader turns it on in Settings -> Posts & Threads; off, a click
// does what it always did - jump to the post and highlight it (`markPost`). The setting
// used to be on by default under `disablePostInlining`; that key is no longer read, so
// everyone starts with it off.
(function () {
  const ENABLE_KEY = 'enablePostInlining';

  // What the reader sees under a box while it loads, or when the post cannot be shown.
  const LOADING = 'Loading…';

  function enabled() {
    return localStorage.getItem(ENABLE_KEY) === 'true';
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

    // Lined up with the text it sits above: a page post's text is a <blockquote>, indented
    // by the browser on both sides, and the box takes the same indents - on the right too,
    // or the reply (a shrink-to-fit table) grows to exactly the box and it meets its border.
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

    // In the header after the number, as a real post shows them.
    const info = box.querySelector(':scope > .preview-content > .post-info');
    if (info) info.appendChild(row);
    else box.insertBefore(row, box.firstChild);
  }

  // The quote, inside the box, of the post the box is opened in: drawn dimmed (4chan X's
  // "forward link"), since that post is right there around it.
  function markForwardLinks(box) {
    const hostId = box.__host?.getAttribute?.('data-post-id') || box.__host?.dataset?.inlinePost;
    if (!hostId) return;
    box.querySelectorAll(':scope > .preview-content > .reply-content a.quoteLink').forEach((link) => {
      if (String(targetOf(link)?.postId) === String(hostId)) link.classList.add('forwardlink');
    });
  }

  // The number of an inlined post works like a real post's: "No." links to the post and
  // the number quotes it (`#q<id>`, which the quick reply picks up - qr.js).
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

  // ---------------------------------------------------------------- the boxes

  function close(box) {
    box.remove();
  }

  // The box this link has open, if any. It is found by what it shows - the post it was
  // opened in, the post it holds and the kind of link - not by the anchor: `quote.js`
  // rebuilds a post's backlink row on every change to the page (opening a box is one), so
  // by the second click the anchor is a new element, and a box remembered on the old one
  // was never found again - every click opened another copy.
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

    // Turned off, or nothing to inline: the post is marked (jumped to) the way it always
    // was, and only when it is on this page - a link into another thread still navigates.
    const parts = targetOf(link);
    if (parts && document.querySelector(`[data-post-id="${parts.postId}"]`) && window.markPost) {
      window.markPost(parts.postId);
    }
  });

  window.postInline = { enabled, closeAll, toggle, targetOf, ENABLE_KEY };
})();
