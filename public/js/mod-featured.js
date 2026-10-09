// The front page's FEATURED THREADS box: the panel picks the threads and their
// order. `/mod/featured` is the only page this runs on; the routes are
// `be/routes/mod/featured.js` and the list is `koshi_featured_threads`.
//
// Two rules shape this screen, and both are enforced by the server as well:
//
//   * the box is four cards wide and is never narrower than four, so the list
//     cannot be saved shorter than four (`minFeatured`);
//   * only the first four are displayed, so a longer list is allowed but the
//     extra slots say so instead of quietly disappearing.
(() => {
  const data = document.getElementById('featured-data');
  const slotsBox = document.getElementById('featured-slots');
  if (!data || !slotsBox) return;

  const initial = JSON.parse(data.textContent);
  const boards = initial.boards || [];
  const SHOWN = Number(initial.shownOnFrontPage) || 4;
  const MIN = Number(initial.minFeatured) || 4;
  const MAX = Number(initial.maxFeatured) || 24;
  const template = document.getElementById('featured-slot-template');
  const status = document.getElementById('featured-status');
  const saveButton = document.getElementById('featured-save');
  const addButton = document.getElementById('featured-add');

  // `_query` / `_results` / `_error` are per-slot screen state: the list is
  // re-rendered from scratch on every change, and a search that was typed and
  // not used yet should not vanish because another slot moved.
  let slots = (initial.featured || []).map((thread) => ({
    boardUri: thread.boardUri,
    threadId: thread.threadId,
    boardName: thread.boardName,
    title: thread.title,
    message: thread.message,
    thumb: thread.thumb,
    postCount: thread.postCount,
    exists: thread.exists,
    _query: '',
    _results: null,
    _error: null
  }));

  const setStatus = (text, bad = false) => {
    status.textContent = text || '';
    status.classList.toggle('featured-bad', bad);
  };

  const api = async (url, body) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: csrfHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
      body: JSON.stringify(body)
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error || `Request failed (HTTP ${res.status})`);
    return payload;
  };

  const boardName = (uri) => (boards.find((board) => board.uri === uri) || {}).name || uri;

  // ------------------------------------------------------------------ the slots

  function fillBoards(select, selected) {
    select.textContent = '';
    for (const board of boards) {
      const option = document.createElement('option');
      option.value = board.uri;
      option.textContent = `/${board.uri}/ - ${board.name}`;
      select.appendChild(option);
    }
    select.value = boards.some((board) => board.uri === selected) ? selected : (boards[0] || {}).uri || '';
  }

  function renderSlot(slot, index) {
    const node = template.content.firstElementChild.cloneNode(true);
    node.dataset.index = String(index);

    node.querySelector('.featured-slot-number').textContent = `${index + 1}.`;
    if (index >= SHOWN) {
      // It is stored, and it is not drawn on the front page. Saying so here is
      // the only place anybody would find out.
      const warn = document.createElement('span');
      warn.className = 'featured-status';
      warn.textContent = `not shown (the front page draws the first ${SHOWN})`;
      node.querySelector('.featured-slot-number').appendChild(warn);
    }

    const thumb = node.querySelector('.featured-thumb');
    const emptyThumb = node.querySelector('.featured-thumb-empty');
    if (slot.thumb) {
      thumb.src = slot.thumb;
      thumb.hidden = false;
      emptyThumb.hidden = true;
    } else {
      thumb.hidden = true;
      emptyThumb.hidden = false;
    }

    const title = node.querySelector('.featured-title');
    const sub = node.querySelector('.featured-sub');
    if (slot.boardUri && slot.threadId) {
      title.textContent = slot.title || '(no subject - the post text is used)';
      if (!slot.exists) {
        title.classList.add('featured-missing');
        title.textContent = 'This thread no longer exists';
      }
      const bits = [`/${slot.boardUri}/thread/${slot.threadId}`, slot.boardName || boardName(slot.boardUri)];
      if (slot.postCount) bits.push(`${slot.postCount} replies`);
      sub.textContent = bits.join(' - ');
    } else {
      title.textContent = 'No thread chosen yet';
      sub.textContent = 'Pick a board and find a thread below.';
    }
    if (slot._error) {
      const error = document.createElement('div');
      error.className = 'featured-title featured-missing';
      error.textContent = slot._error;
      sub.after(error);
    }

    const select = node.querySelector('.featured-board');
    fillBoards(select, slot.boardUri);
    const idInput = node.querySelector('.featured-thread-id');
    idInput.value = slot.threadId || '';
    idInput.placeholder = 'thread #';

    // A slot with nothing in it follows the board the picker is on, so "Use this
    // thread" works without first choosing a thread.
    select.addEventListener('change', () => {
      if (!slot.threadId) slot.boardUri = select.value;
    });

    node.querySelector('[data-find-id]').addEventListener('click', () => {
      useThread(index, select.value, Number(idInput.value));
    });

    const query = node.querySelector('.featured-query');
    query.value = slot._query || '';
    const runSearch = () => {
      slot._query = query.value;
      search(index, select.value, query.value);
    };
    node.querySelector('[data-find-query]').addEventListener('click', runSearch);
    query.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        runSearch();
      }
    });

    const results = node.querySelector('.featured-results');
    for (const found of slot._results || []) {
      const row = document.createElement('div');
      row.className = 'featured-result';
      if (found.thumb) {
        const img = document.createElement('img');
        img.src = found.thumb;
        img.alt = '';
        row.appendChild(img);
      }
      const foundTitle = document.createElement('span');
      foundTitle.className = 'featured-result-title';
      // The thread's own text is written as text, never as markup.
      foundTitle.textContent = found.title || '(no subject)';
      const meta = document.createElement('span');
      meta.className = 'featured-result-meta';
      meta.textContent = `#${found.threadId} - ${found.postCount || 0} replies`;
      row.append(foundTitle, meta);
      row.addEventListener('click', () => useThread(index, found.boardUri, found.threadId));
      results.appendChild(row);
    }
    if (slot._results && !slot._results.length) {
      const none = document.createElement('div');
      none.className = 'featured-note';
      none.textContent = 'Nothing on that board matched.';
      results.appendChild(none);
    }

    const moveUp = node.querySelector('[data-move="-1"]');
    const moveDown = node.querySelector('[data-move="1"]');
    moveUp.disabled = index === 0;
    moveDown.disabled = index === slots.length - 1;
    moveUp.addEventListener('click', () => move(index, -1));
    moveDown.addEventListener('click', () => move(index, 1));

    const remove = node.querySelector('[data-remove]');
    // Four is the floor the front page needs; removing below it is not offered
    // rather than refused after the fact.
    remove.disabled = slots.length <= MIN;
    remove.title = remove.disabled ? `The front page shows ${SHOWN} featured threads, so ${MIN} is the fewest you can have` : 'Remove this thread';
    remove.addEventListener('click', () => {
      if (slots.length <= MIN) {
        setStatus(`The front page shows ${SHOWN} featured threads, so the list cannot be shorter than ${MIN}.`, true);
        return;
      }
      slots.splice(index, 1);
      render();
      setStatus('Removed - save to apply.');
    });

    return node;
  }

  function render() {
    slotsBox.textContent = '';
    slots.forEach((slot, index) => slotsBox.appendChild(renderSlot(slot, index)));
    addButton.disabled = slots.length >= MAX;
    addButton.title = addButton.disabled ? `At most ${MAX} threads can be listed` : 'Add another thread';
  }

  // ------------------------------------------------------------------ the edits

  function move(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= slots.length) return;
    const [slot] = slots.splice(index, 1);
    slots.splice(target, 0, slot);
    render();
    setStatus('Reordered - save to apply.');
  }

  function useThread(index, boardUri, threadId) {
    const slot = slots[index];
    slot._results = null;
    slot._error = null;
    if (!boardUri || !Number.isInteger(threadId) || threadId <= 0) {
      slot._error = 'Enter a thread number, or search for one.';
      render();
      setStatus('A thread number is needed.', true);
      return;
    }
    // The same thread twice would draw the same card twice.
    const clash = slots.findIndex((other, at) => at !== index && other.boardUri === boardUri && Number(other.threadId) === threadId);
    if (clash !== -1) {
      slot._error = `That thread is already in slot ${clash + 1}.`;
      render();
      setStatus('That thread is already featured.', true);
      return;
    }

    setStatus('Looking the thread up…');
    api('/mod/api/featured/find', { boardUri, threadId })
      .then((payload) => {
        const found = (payload.threads || [])[0];
        if (!found) {
          slot._error = `/${boardUri}/thread/${threadId} is not a thread on /${boardUri}/.`;
          render();
          setStatus(`No thread ${threadId} on /${boardUri}/.`, true);
          return;
        }
        Object.assign(slots[index], {
          boardUri: found.boardUri,
          threadId: found.threadId,
          boardName: found.boardName,
          title: found.title,
          message: found.message,
          thumb: found.thumb,
          postCount: found.postCount,
          exists: true,
          _error: null
        });
        render();
        setStatus('Changed - save to apply.');
      })
      .catch((err) => {
        slot._error = err.message;
        render();
        setStatus(err.message, true);
      });
  }

  function search(index, boardUri, query) {
    const slot = slots[index];
    slot._error = null;
    if (!query.trim()) {
      slot._results = null;
      render();
      return;
    }
    setStatus('Searching…');
    api('/mod/api/featured/find', { boardUri, query })
      .then((payload) => {
        slot._results = payload.threads || [];
        render();
        setStatus(`${slot._results.length} thread${slot._results.length === 1 ? '' : 's'} on /${boardUri}/.`);
      })
      .catch((err) => {
        slot._results = null;
        slot._error = err.message;
        render();
        setStatus(err.message, true);
      });
  }

  function save() {
    const threads = slots
      .filter((slot) => slot.boardUri && slot.threadId)
      .map((slot) => ({ boardUri: slot.boardUri, threadId: Number(slot.threadId) }));

    setStatus('Saving…');
    saveButton.disabled = true;
    api('/mod/api/featured', { threads })
      .then((payload) => {
        // The server's list is the truth from here on (it is what the front page
        // will draw), so the screen is rebuilt from it.
        slots = (payload.featured || []).map((thread) => ({
          boardUri: thread.boardUri,
          threadId: thread.threadId,
          boardName: thread.boardName,
          title: thread.title,
          message: thread.message,
          thumb: thread.thumb,
          postCount: thread.postCount,
          exists: thread.exists,
          _query: '',
          _results: null,
          _error: null
        }));
        render();
        setStatus('Saved.');
      })
      .catch((err) => setStatus(err.message, true))
      .finally(() => {
        saveButton.disabled = false;
      });
  }

  addButton.addEventListener('click', () => {
    if (slots.length >= MAX) return;
    slots.push({
      boardUri: (boards[0] || {}).uri || '',
      threadId: null,
      boardName: '',
      title: null,
      message: null,
      thumb: null,
      postCount: 0,
      exists: false,
      _query: '',
      _results: null,
      _error: null
    });
    render();
    if (slots.length > SHOWN) {
      setStatus(`Only the first ${SHOWN} are shown on the front page.`, true);
    } else {
      setStatus('Added - pick the thread, then save.');
    }
  });

  saveButton.addEventListener('click', save);
  render();
})();
