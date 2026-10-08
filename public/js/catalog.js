document.addEventListener('DOMContentLoaded', function () {
  const searchInput = document.getElementById('catalog-search-input');
  const threadContainer = document.getElementById('thread-container');
  const sortSelect = document.getElementById('sort-select');

  searchInput.addEventListener('input', function () {
    const searchTerm = this.value.toLowerCase();
    const threads = threadContainer.getElementsByClassName('catalog-thread');

    Array.from(threads).forEach((thread) => {
      const subject = thread.querySelector('.thread-subject')?.innerText.toLowerCase() || '';
      const text = thread.querySelector('.thread-text')?.innerText.toLowerCase() || '';
      const shouldShow = subject.includes(searchTerm) || text.includes(searchTerm);
      thread.style.display = shouldShow ? '' : 'none';
    });
  });

  function sortThreads(sortBy) {
    const threads = Array.from(threadContainer.getElementsByClassName('catalog-thread'));

    threads.sort((a, b) => {
      const aPinned = a.dataset.pinned === 'true';
      const bPinned = b.dataset.pinned === 'true';
      if (aPinned !== bPinned) return bPinned ? 1 : -1;

      switch (sortBy) {
        case 'bump':
          return new Date(b.dataset.bump) - new Date(a.dataset.bump);
        case 'reply':
          return parseInt(b.dataset.replies) - parseInt(a.dataset.replies);
        case 'creation':
          return new Date(b.dataset.creation) - new Date(a.dataset.creation);
        default:
          return 0;
      }
    });

    threads.forEach((thread) => threadContainer.appendChild(thread));
  }

  sortSelect.addEventListener('change', function () {
    sortThreads(this.value);
  });

  sortThreads('bump');
});

// Hover preview (as in 4chan X): putting the pointer on a catalog item opens a larger
// copy of it over the grid, with the whole opening post and the thread's last few
// replies - how long ago each was made and the start of what it says. The replies are
// fetched the first time a thread is previewed and kept for a minute.
(function () {
  // PC only: a mouse (no touch screens, which fire mouse events on tap too) and a
  // window wider than the mobile layout (global.css switches at 768px). Checked on
  // every hover, so it also stops when the window is narrowed.
  const desktop = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 769px)');

  const CACHE_MS = 60000;
  const WIDTH_EXTRA = 60;
  const cache = new Map(); // "board/threadId" -> { at, promise }
  let panel = null;

  function timeAgo(date) {
    const seconds = Math.max(0, (Date.now() - new Date(date).getTime()) / 1000);
    const units = [
      ['y', 31536000],
      ['mo', 2592000],
      ['d', 86400],
      ['h', 3600],
      ['m', 60]
    ];
    for (const [label, size] of units) {
      if (seconds >= size) return Math.floor(seconds / size) + label;
    }
    return Math.floor(seconds) + 's';
  }

  function latestReplies(board, threadId) {
    const key = board + '/' + threadId;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.promise;
    const promise = fetch('/' + encodeURIComponent(board) + '/thread/' + encodeURIComponent(threadId) + '/latest.json')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('HTTP ' + res.status))))
      .then((data) => data.replies || []);
    promise.catch(() => cache.delete(key));
    cache.set(key, { at: Date.now(), promise });
    return promise;
  }

  function formatSize(bytes) {
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB';
    return (bytes / 1024).toFixed(2) + ' KB';
  }

  // The file line a post shows above its thumbnail: name, download, size and size in
  // pixels. Embeds (YouTube and the like) have no size and get none.
  function fileInfo(fileEl) {
    const { name, path, size, dims } = fileEl.dataset;
    if (!path || !size) return null;
    const info = document.createElement('div');
    info.className = 'catalog-preview-fileinfo';
    const link = document.createElement('a');
    link.href = path;
    link.target = '_blank';
    // Not `.file-link`: posts expand that to the whole name on hover, which would
    // stretch the panel.
    link.className = 'catalog-preview-filename';
    link.title = name;
    link.textContent = name;
    const download = document.createElement('a');
    download.href = path;
    download.download = name;
    download.title = 'Download';
    const icon = document.createElement('img');
    icon.src = '/img/download.png';
    icon.width = 12;
    icon.alt = 'Download';
    download.appendChild(icon);
    const meta = document.createElement('span');
    meta.textContent = '(' + formatSize(Number(size)) + (dims ? ', ' + dims : '') + ')';
    info.append(link, ' ', download, ' ', meta);
    return info;
  }

  function close() {
    panel?.remove();
    panel = null;
  }

  // Fortunes (`be/lib/fortunes.js`) are stored in the post body; the preview leaves
  // them out. The class names after `.fortune` are those of fortunes written before
  // that shared class existed (as in the "Hide fortunes" setting, settings.js).
  const FORTUNES =
    '.fortune, .excellentLuck, .goodLuck, .averageLuck, .badLuck, .tellYouNow, .outlookGood, ' +
    '.veryBadLuck, .godlyLuck, .youAreBanned, .divFortune';

  // The reply's rendered body (greentext, spoilers, quotes...) on one line: line
  // breaks become spaces, media and fortunes are dropped, and inline handlers -
  // written for the thread page, where their functions exist - are removed.
  function bodyLine(html) {
    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    doc.body.querySelectorAll(FORTUNES).forEach((el) => el.remove());
    doc.body.querySelectorAll('br').forEach((br) => br.replaceWith(' '));
    doc.body.querySelectorAll('img, video, audio, iframe, script, style').forEach((el) => el.remove());
    doc.body.querySelectorAll('*').forEach((el) => {
      Array.from(el.attributes).forEach((attr) => {
        if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
      });
    });
    return doc.body.textContent.trim() ? doc.body.innerHTML : '';
  }

  function renderReplies(list, board, threadId, replies) {
    list.textContent = '';
    replies.forEach((reply) => {
      const href = '/' + board + '/thread/' + threadId + '#' + reply.postId;
      // Not a link itself, because the body can hold links (quotes); a click anywhere
      // else on the row opens the reply.
      const row = document.createElement('div');
      row.className = 'catalog-preview-reply';
      row.title = new Date(reply.creation).toLocaleString();
      row.addEventListener('click', (e) => {
        if (!e.target.closest('a')) window.location.href = href;
      });
      const age = document.createElement('a');
      age.className = 'catalog-preview-age';
      age.href = href;
      age.textContent = timeAgo(reply.creation) + ':';
      const text = document.createElement('span');
      text.className = 'catalog-preview-body';
      // `message` (the raw text) is what the endpoint sent before it sent `markdown`.
      const body = reply.markdown != null ? bodyLine(reply.markdown) : '';
      // It may be HTML-escaped (MariaDB stores it so); parsing it decodes the entities.
      const plain =
        reply.markdown == null
          ? new DOMParser().parseFromString(String(reply.message || ''), 'text/html').body.textContent.replace(/\s+/g, ' ').trim()
          : '';
      if (body) text.innerHTML = body;
      else if (plain) text.textContent = plain;
      else {
        text.textContent = reply.fileName || '(no text)';
        text.classList.add('catalog-preview-file');
      }
      row.append(age, ' ', text);
      list.appendChild(row);
    });
  }

  function open(item) {
    close();
    const rect = item.getBoundingClientRect();
    panel = document.createElement('div');
    panel.className = 'catalog-preview';
    panel.dataset.threadId = item.dataset.threadId;
    const fileEl = item.querySelector('.catalog-file');
    const info = fileEl && fileInfo(fileEl);
    if (info) panel.appendChild(info);
    Array.from(item.children).forEach((child) => panel.appendChild(child.cloneNode(true)));
    panel.querySelectorAll(FORTUNES).forEach((el) => el.remove());

    const replyCount = parseInt(item.dataset.replies, 10) || 0;
    let list = null;
    if (replyCount > 0) {
      list = document.createElement('div');
      list.className = 'catalog-preview-replies';
      list.textContent = 'Loading replies…';
      panel.appendChild(list);
    }

    // Centred on the item, a little wider, and kept on screen.
    const width = rect.width + WIDTH_EXTRA;
    const viewport = document.documentElement.clientWidth;
    const left = Math.min(Math.max(rect.left + rect.width / 2 - width / 2, 4), viewport - width - 4);
    panel.style.width = width + 'px';
    // Never shorter than the item, so leaving the panel never lands back on the item.
    panel.style.minHeight = rect.height + 12 + 'px';
    panel.style.left = left + window.scrollX + 'px';
    panel.style.top = rect.top + window.scrollY - 6 + 'px';
    panel.addEventListener('mouseleave', close);
    document.body.appendChild(panel);

    if (list) {
      const current = panel;
      const { board, threadId } = item.dataset;
      latestReplies(board, threadId)
        .then((replies) => {
          if (panel !== current) return;
          if (replies.length) renderReplies(list, board, threadId, replies);
          else list.remove();
        })
        .catch(() => {
          if (panel === current) list.textContent = 'Could not load replies.';
        });
    }
  }

  document.addEventListener('mouseover', (e) => {
    if (!desktop.matches || !(e.target instanceof Element) || e.target.closest('.catalog-preview')) return;
    const item = e.target.closest('.catalog-thread');
    if (!item) return;
    // Opens the moment the pointer is on an item; while it is open the panel covers
    // the item, so this does not fire again for it.
    if (panel?.dataset.threadId === item.dataset.threadId) return;
    open(item);
  });

  desktop.addEventListener('change', () => {
    if (!desktop.matches) close();
  });
  window.addEventListener('blur', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
})();
