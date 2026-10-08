const watchedThreads = {
  init() {
    const pathMatch = location.pathname.match(/^\/([^/]+)\/thread\/(\d+)/);
    this.isInThread = !!pathMatch;
    this.pageBoard = pathMatch ? pathMatch[1] : null;
    this.pageThread = pathMatch ? pathMatch[2] : null;
    this.watcherAlertCounter = 0;
    this.showingWatched = false;

    document.querySelectorAll('.watch-list-btn').forEach((btn) => {
      if (!btn.querySelector('.watcher-counter')) {
        const counter = document.createElement('span');
        counter.className = 'watcher-counter';
        btn.appendChild(counter);
      }
    });

    document.querySelectorAll('.op').forEach((op) => this.processOP(op));

    this.bindEvents();
    this.createWatchList();

    const stored = this.getStoredWatchedData();
    if (this.isInThread && stored[this.pageBoard] && stored[this.pageBoard][this.pageThread]) {
      stored[this.pageBoard][this.pageThread].lastSeen = Date.now();
      stored[this.pageBoard][this.pageThread].unreadCount = 0;
      this.saveWatchedData(stored);
    }

    this.updateWatchListDisplay();
    this.updateWatcherCounter();
    this.scheduleWatchedThreadsCheck();

    try {
      if (localStorage.getItem('watchListOpen') === 'true') {
        this.showWatchList();
      }
    } catch (e) {}
  },

  // On a phone a floating window would cover the page, so there the watcher is part of
  // the page instead: under the banner, board title and description (#banner-container),
  // above the post form - or at the top of the content on a page without a banner. It
  // moves back to its floating place when the window is widened past the stylesheet's
  // 768px line.
  placeWatchList() {
    const modal = document.querySelector('.watch-list-modal');
    if (!modal) return;
    const inline = window.matchMedia('(max-width: 768px)').matches;
    modal.classList.toggle('watch-list-inline', inline);
    if (!inline) {
      if (modal.parentNode !== document.body) document.body.appendChild(modal);
      return;
    }
    const banner = document.getElementById('banner-container');
    if (banner) {
      banner.after(modal);
    } else {
      const content = document.querySelector('main.content') || document.body;
      content.prepend(modal);
    }
  },

  bindEvents() {
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('watch-thread-off') || e.target.classList.contains('watch-thread-on')) {
        this.toggleThreadWatch(e.target);
      }
    });

    document.addEventListener('click', (e) => {
      if (e.target.closest('.watch-list-btn')) {
        e.preventDefault();
        if (this.showingWatched) {
          this.closeWatchList();
        } else {
          this.showWatchList();
        }
      }
    });

    window.matchMedia('(max-width: 768px)').addEventListener('change', () => this.placeWatchList());
  },

  processOP(op) {
    if (op.querySelector('.watch-thread-off, .watch-thread-on')) return;

    const info = op.querySelector('.post-info');
    if (!info) return;

    const checkBox = info.querySelector('.post-checkbox, .mod-select');
    if (!checkBox) return;

    const board = op.dataset.board;
    const thread = String(op.dataset.threadId || op.dataset.postId || '');
    if (!board || !thread) return;

    const watchButton = document.createElement('i');
    watchButton.title = 'Watch Thread';
    watchButton.className = this.isWatched(board, thread) ? 'watch-thread-on' : 'watch-thread-off';
    info.insertBefore(watchButton, checkBox);
  },

  isWatched(board, thread) {
    const stored = this.getStoredWatchedData();
    return !!(stored[board] && stored[board][thread]);
  },

  toggleThreadWatch(heartIcon) {
    const threadElement = heartIcon.closest('.op');
    if (!threadElement) return;

    const threadId = String(threadElement.dataset.postId || threadElement.dataset.threadId);
    const boardUri = threadElement.dataset.board || location.pathname.split('/')[1];

    if (heartIcon.classList.contains('watch-thread-off')) {
      const subject = threadElement.querySelector('.subject')?.textContent?.trim();
      const message = threadElement.querySelector('.thread-content, .reply-content, .message')?.textContent?.trim();
      this.addThreadToWatch(threadId, boardUri, subject, message);
    } else {
      this.removeThreadFromWatch(threadId, boardUri);
    }
  },

  // Label for a watched thread: its subject when it has one, otherwise the
  // start of the post text (`:name:` style markup and files are not part of it,
  // they render outside .thread-content).
  threadLabel(op, subject, message) {
    const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();

    // `'No subject'` is the placeholder older callers stored; treat it as none.
    for (const candidate of [subject, op ? op.querySelector('.subject')?.textContent : '']) {
      const value = clean(candidate);
      if (value && value !== 'No subject') return value.substring(0, 50);
    }

    const text =
      clean(message) ||
      clean(
        op
          ? op.querySelector('.thread-content, .reply-content, .message')?.textContent || op.querySelector('.divMessage')?.textContent
          : ''
      );
    if (!text) return '';
    return text.length > 20 ? `${text.substring(0, 20)}...` : text;
  },

  addThreadToWatch(threadId, boardUri, subject, message) {
    threadId = String(threadId);
    const stored = this.getStoredWatchedData();
    const boardThreads = stored[boardUri] || {};
    if (boardThreads[threadId]) return;

    const op = document.querySelector(`.op[data-post-id="${threadId}"], .op[data-thread-id="${threadId}"]`);
    const now = Date.now();
    boardThreads[threadId] = {
      lastSeen: now,
      lastReplied: now,
      label: this.threadLabel(op, subject, message) || null,
      unreadCount: 0
    };
    stored[boardUri] = boardThreads;
    this.saveWatchedData(stored);
    this.setWatchButtonState(boardUri, threadId, true);
    this.updateWatchListDisplay();
  },

  removeThreadFromWatch(threadId, boardUri) {
    threadId = String(threadId);
    const stored = this.getStoredWatchedData();
    if (stored[boardUri]) {
      delete stored[boardUri][threadId];
      if (!Object.keys(stored[boardUri]).length) delete stored[boardUri];
      this.saveWatchedData(stored);
    }
    this.setWatchButtonState(boardUri, threadId, false);
    this.updateWatchListDisplay();
    this.updateWatcherCounter();
  },

  setWatchButtonState(boardUri, threadId, watched) {
    document.querySelectorAll(`.op[data-board="${boardUri}"][data-post-id="${threadId}"], .op[data-board="${boardUri}"][data-thread-id="${threadId}"]`).forEach((op) => {
      const heart = op.querySelector('.watch-thread-off, .watch-thread-on');
      if (!heart) return;
      heart.classList.toggle('watch-thread-on', watched);
      heart.classList.toggle('watch-thread-off', !watched);
    });
  },

  migrateOldWatchedThreads() {
    let old;
    try {
      old = JSON.parse(localStorage.getItem('watchedThreads') || '{}');
    } catch (e) {
      return {};
    }
    const migrated = {};
    Object.values(old).forEach((thread) => {
      if (!thread || !thread.boardUri || thread.threadId == null) return;
      const board = thread.boardUri;
      const id = String(thread.threadId);
      migrated[board] = migrated[board] || {};
      migrated[board][id] = {
        lastSeen: thread.unreadCount > 0 ? 0 : Date.now(),
        lastReplied: Date.now(),
        label: (thread.subject || thread.message || '').substring(0, 50).trim() || null,
        unreadCount: thread.unreadCount || 0
      };
    });
    return migrated;
  },

  getStoredWatchedData() {
    try {
      if (localStorage.watchedData) return JSON.parse(localStorage.watchedData);
    } catch (e) {}
    const migrated = this.migrateOldWatchedThreads();
    if (Object.keys(migrated).length) this.saveWatchedData(migrated);
    return migrated;
  },

  saveWatchedData(data) {
    localStorage.watchedData = JSON.stringify(data);
  },

  updateWatcherCounter() {
    const text = this.watcherAlertCounter ? ` (${this.watcherAlertCounter})` : '';
    document.querySelectorAll('.watcher-counter').forEach((el) => {
      el.textContent = text;
    });
  },

  createWatchList() {
    if (document.querySelector('.watch-list-modal')) return;

    const modal = document.createElement('div');
    modal.className = 'watch-list-modal';
    modal.style.display = 'none';
    modal.innerHTML = `
      <div class="watch-list-content">
        <div class="watch-list-header">
          Watched Threads
          <button type="button" class="close-watch-list" title="Close" aria-label="Close">&times;</button>
        </div>
        <div class="watch-list-body"></div>
      </div>
    `;
    document.body.appendChild(modal);
    this.placeWatchList();

    modal.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-watch')) {
        this.removeThreadFromWatch(e.target.dataset.thread, e.target.dataset.board);
      }
    });

    const titleBar = modal.querySelector('.watch-list-header');
    let isDragging = false;
    let currentX = 0;
    let currentY = 0;
    let initialX = 0;
    let initialY = 0;
    let xOffset = 0;
    let yOffset = 0;

    const setTranslate = (xPos, yPos) => {
      modal.style.transform = `translate(${xPos}px, ${yPos}px)`;
    };

    const savePosition = (xPos, yPos) => {
      try {
        localStorage.setItem('watchListPosition', JSON.stringify({ x: xPos, y: yPos }));
      } catch (e) {}
    };

    titleBar.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('close-watch-list')) return;
      initialX = e.clientX - xOffset;
      initialY = e.clientY - yOffset;
      isDragging = true;
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      xOffset = currentX;
      yOffset = currentY;
      setTranslate(currentX, currentY);
    });

    document.addEventListener('mouseup', () => {
      if (!isDragging) return;
      initialX = currentX;
      initialY = currentY;
      isDragging = false;
      savePosition(xOffset, yOffset);
    });

    modal.querySelector('.close-watch-list').addEventListener('click', () => {
      savePosition(xOffset, yOffset);
      this.closeWatchList();
    });

    try {
      const savedPosition = JSON.parse(localStorage.getItem('watchListPosition') || '{"x":0,"y":0}');
      setTranslate(savedPosition.x, savedPosition.y);
      xOffset = savedPosition.x;
      yOffset = savedPosition.y;
    } catch (e) {}
  },

  showWatchList() {
    const modal = document.querySelector('.watch-list-modal');
    if (!modal || this.showingWatched) return;
    this.showingWatched = true;
    this.updateWatchListDisplay();
    modal.style.display = 'block';

    try {
      localStorage.setItem('watchListOpen', 'true');
    } catch (e) {}
  },

  closeWatchList() {
    const modal = document.querySelector('.watch-list-modal');
    if (modal) modal.style.display = 'none';
    this.showingWatched = false;

    try {
      localStorage.setItem('watchListOpen', 'false');
    } catch (e) {}
  },

  watchListEntries() {
    const stored = this.getStoredWatchedData();
    const entries = [];
    Object.keys(stored).forEach((board) => {
      Object.keys(stored[board]).forEach((thread) => {
        entries.push({ board, thread, data: stored[board][thread] });
      });
    });
    return entries;
  },

  updateWatchListDisplay() {
    const watchListBody = document.querySelector('.watch-list-body');
    if (!watchListBody) return;

    // Re-read the store so a label derived below can be written back.
    const stored = this.getStoredWatchedData();
    const entries = [];
    Object.keys(stored).forEach((board) => {
      Object.keys(stored[board]).forEach((thread) => {
        entries.push({ board, thread, data: stored[board][thread] });
      });
    });

    watchListBody.textContent = '';
    if (!entries.length) {
      const empty = document.createElement('div');
      empty.className = 'no-watched-threads';
      empty.textContent = 'No watched threads';
      watchListBody.appendChild(empty);
      return;
    }

    let labelAdded = false;
    entries.forEach(({ board, thread, data }) => {
      // Threads watched before labels carried the post text (or without a
      // subject) get their label from the OP when that thread is on screen.
      let label = data.label && data.label !== 'No subject' ? data.label : null;
      if (!label) {
        const op = document.querySelector(`.op[data-post-id="${thread}"], .op[data-thread-id="${thread}"]`);
        const derived = this.threadLabel(op);
        if (derived) {
          label = derived;
          data.label = derived;
          labelAdded = true;
        }
      }
      label = label || `${board}/${thread}`;
      const unread = data.unreadCount > 0 || data.lastSeen < data.lastReplied;
      const item = document.createElement('div');
      item.className = 'watch-list-item';

      const link = document.createElement('a');
      link.href = `/${encodeURIComponent(board)}/thread/${encodeURIComponent(thread)}`;
      link.textContent = `/${board}/ - ${label}`;
      if (unread) {
        const span = document.createElement('span');
        span.className = 'unread-count';
        span.textContent = `[${data.unreadCount}]`;
        link.appendChild(document.createTextNode(' '));
        link.appendChild(span);
      }

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'remove-watch';
      btn.title = 'Unwatch';
      btn.setAttribute('aria-label', `Unwatch /${board}/ - ${label}`);
      btn.dataset.board = board;
      btn.dataset.thread = thread;
      btn.textContent = '×';

      item.appendChild(link);
      item.appendChild(btn);
      watchListBody.appendChild(item);
    });

    if (labelAdded) this.saveWatchedData(stored);
  },

  autoWatchThread(threadId, boardUri, subject, message) {
    if (localStorage.getItem('disableAutoWatch') === 'true') return;
    this.addThreadToWatch(threadId, boardUri, subject, message);
  },

  scheduleWatchedThreadsCheck() {
    const lastCheck = localStorage.lastWatchCheck;
    if (!lastCheck) {
      this.runWatchedThreadsCheck();
      return;
    }
    const next = new Date(+lastCheck);
    next.setUTCSeconds(next.getUTCSeconds() + 10);
    setTimeout(() => this.runWatchedThreadsCheck(), next.getTime() - Date.now());
  },

  runWatchedThreadsCheck() {
    this.watcherAlertCounter = 0;
    localStorage.lastWatchCheck = Date.now();

    const stored = this.getStoredWatchedData();
    const urls = [];

    Object.keys(stored).forEach((board) => {
      Object.keys(stored[board]).forEach((thread) => {
        if (this.isInThread && board === this.pageBoard && thread === this.pageThread) {
          stored[board][thread].lastSeen = Date.now();
          stored[board][thread].unreadCount = 0;
          this.saveWatchedData(stored);
        }
        urls.push({ board, thread });
      });
    });

    this.iterateWatchedThreads(urls);
  },

  iterateWatchedThreads(urls, index) {
    index = index || 0;
    if (index >= urls.length) {
      this.updateWatcherCounter();
      this.updateWatchListDisplay();
      this.scheduleWatchedThreadsCheck();
      return;
    }

    const url = urls[index];
    fetch(`/${url.board}/thread/${url.thread}.json`)
      .then((r) => {
        if (!r.ok) throw new Error('missing');
        return r.text();
      })
      .then((data) => this.processThread(urls, index, data))
      .catch(() => this.iterateWatchedThreads(urls, index + 1));
  },

  processThread(urls, index, raw) {
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      this.iterateWatchedThreads(urls, index + 1);
      return;
    }

    const url = urls[index];
    const posts = data.posts || [];
    const stored = this.getStoredWatchedData();
    if (!stored[url.board] || !stored[url.board][url.thread]) {
      this.iterateWatchedThreads(urls, index + 1);
      return;
    }

    const watchData = stored[url.board][url.thread];
    const lastPost = posts.length ? posts[posts.length - 1] : data.thread;
    const parsedCreation = new Date(lastPost && (lastPost.creation || lastPost.lastBump));

    if (!isNaN(parsedCreation.getTime()) && parsedCreation.getTime() > watchData.lastReplied) {
      watchData.lastReplied = parsedCreation.getTime();
    }

    if (this.isInThread && url.board === this.pageBoard && url.thread === this.pageThread) {
      watchData.lastSeen = Date.now();
      watchData.unreadCount = 0;
    } else {
      watchData.unreadCount = posts.filter((p) => new Date(p.creation).getTime() > watchData.lastSeen).length;
    }

    if (watchData.lastSeen >= watchData.lastReplied) {
      watchData.unreadCount = 0;
    } else {
      this.watcherAlertCounter++;
      if (!watchData.unreadCount) watchData.unreadCount = 1;
    }

    this.saveWatchedData(stored);
    this.iterateWatchedThreads(urls, index + 1);
  }
};

document.addEventListener('DOMContentLoaded', () => watchedThreads.init());