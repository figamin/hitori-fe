// The post editor. `[Edit]` opens a floating panel shaped like the quick reply
// (`views/partials/quick-reply.ejs`): the post's source text, a button that switches the
// box to the post's raw HTML, and — underneath the post being edited — a live preview of
// what the post will look like, following every keystroke.
//
// The preview is a copy of the post's own markup with the new body dropped into it, so it
// shows the real name, capcode, files and quotes around the text being written. Nothing in
// it is live: its ids and `data-post-id`s are dropped, because the page's own scripts
// (live reply refresh, reply renumbering, backlinks) walk exactly those selectors, and a
// second copy of the post must not look like a post.
//
// Two modes, as vichan's editor has:
//   markup — the box holds what the poster would type, and saving stores it the way
//            posting does (escaped, filtered, converted to HTML)
//   raw    — the box holds the post's HTML and is saved verbatim
(function () {
  const PREVIEW_DELAY = 250;

  const state = {
    popup: null,
    textarea: null,
    modeButton: null,
    status: null,
    saveButton: null,
    previewLabel: null,
    link: null,
    container: null,
    previewWrapper: null,
    previewBody: null,
    mode: 'markup',
    values: { markup: '', raw: '' },
    timer: null,
    seq: 0
  };

  function postParams(editLink) {
    return {
      boardUri: editLink.dataset.board,
      threadId: Number(editLink.dataset.thread),
      postId: Number(editLink.dataset.post),
      isThread: editLink.dataset.threadPost === '1'
    };
  }

  async function api(url, { method = 'GET', body } = {}) {
    const res = await fetch(url, {
      method,
      headers: csrfHeaders(body ? { 'Content-Type': 'application/json', Accept: 'application/json' } : {}),
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  // ---------------------------------------------------------------- the popup

  function buildPopup() {
    const popup = document.createElement('div');
    popup.id = 'editPost';
    popup.innerHTML =
      '<div id="editPostHeader"><p>Edit post <span id="editPostNumber"></span><button id="editPostClose" type="button">×</button></p></div>' +
      '<div id="editPostBody">' +
      '<textarea id="editPostMessage" rows="7" spellcheck="false"></textarea>' +
      '<div id="editPostTools"><button id="editPostMode" type="button">Edit raw HTML</button></div>' +
      '<p class="file-info" id="editPostHint"></p>' +
      '<div id="editPostActions"><button id="editPostSave" type="button">Save</button><button id="editPostCancel" type="button">Cancel</button></div>' +
      '<p class="file-info" id="editPostStatus"></p>' +
      '</div>';

    state.popup = popup;
    state.textarea = popup.querySelector('#editPostMessage');
    state.modeButton = popup.querySelector('#editPostMode');
    state.status = popup.querySelector('#editPostStatus');
    state.saveButton = popup.querySelector('#editPostSave');
    state.hint = popup.querySelector('#editPostHint');

    popup.querySelector('#editPostClose').addEventListener('click', close);
    popup.querySelector('#editPostCancel').addEventListener('click', close);
    state.saveButton.addEventListener('click', save);
    state.modeButton.addEventListener('click', () => switchMode(state.mode === 'markup' ? 'raw' : 'markup'));
    state.textarea.addEventListener('input', schedulePreview);

    initDragging(popup, popup.querySelector('#editPostHeader'));
    document.body.appendChild(popup);
    return popup;
  }

  // Same drag behaviour as the quick reply: the header is the handle.
  function initDragging(element, handle) {
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    const startDrag = (e) => {
      e.preventDefault();
      const rect = element.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      const move = (moveEvent) => {
        element.style.left = `${startLeft + (moveEvent.clientX - startX)}px`;
        element.style.top = `${startTop + (moveEvent.clientY - startY)}px`;
        element.style.right = 'auto';
      };
      const stop = () => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', stop);
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', stop);
    };

    handle.addEventListener('mousedown', startDrag);
  }

  // ------------------------------------------------------------- the preview

  // A copy of the post, inserted right after it and marked as a preview. Built once per
  // open editor; only its body is replaced afterwards.
  function buildPreview() {
    removePreview();

    const wrapper = document.createElement('div');
    wrapper.className = 'edit-preview';
    wrapper.innerHTML = '<p class="edit-preview-label">Preview</p>';

    const clone = state.container.cloneNode(true);
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
    // The live refresh, the reply numbering and the backlinks all key on these.
    clone.querySelectorAll('[data-post-id]').forEach((node) => node.removeAttribute('data-post-id'));
    clone.querySelectorAll('input[type="checkbox"]').forEach((node) => node.remove());
    wrapper.appendChild(clone);

    state.previewLabel = wrapper.querySelector('.edit-preview-label');
    state.previewBody = clone.querySelector('.reply-content, .thread-content') || clone;
    state.previewWrapper = wrapper;
    state.container.parentNode.insertBefore(wrapper, state.container.nextSibling);
  }

  function removePreview() {
    if (state.previewWrapper) state.previewWrapper.remove();
    state.previewWrapper = null;
    state.previewBody = null;
    state.previewLabel = null;
  }

  function schedulePreview() {
    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(renderPreview, PREVIEW_DELAY);
  }

  async function renderPreview() {
    if (!state.link || !state.previewBody) return;
    const seq = ++state.seq;
    const params = postParams(state.link);
    try {
      const { html } = await api('/mod/api/edit/preview', {
        method: 'POST',
        body: { ...params, message: state.textarea.value, mode: state.mode }
      });
      // A later keystroke may already have answered; only the newest one may paint.
      if (seq !== state.seq || !state.previewBody) return;
      state.previewBody.innerHTML = html;
      if (state.previewLabel) state.previewLabel.textContent = state.mode === 'raw' ? 'Preview (raw HTML)' : 'Preview';
    } catch (err) {
      if (seq === state.seq) state.status.textContent = `Preview failed: ${err.message}`;
    }
  }

  // ---------------------------------------------------------------- the editor

  function applyMode() {
    if (state.mode === 'raw') {
      state.modeButton.textContent = 'Edit raw markup';
      state.hint.textContent = 'Raw HTML is stored exactly as written.';
    } else {
      state.modeButton.textContent = 'Edit raw HTML';
      state.hint.textContent = 'Markup is rendered like a new post (styling, quotes, links).';
    }
  }

  function switchMode(next) {
    // Keep what is in the box for the mode being left, so switching back and forth does
    // not lose an edit (the other mode's value is what the server just handed over).
    state.values[state.mode] = state.textarea.value;
    state.mode = next;
    state.textarea.value = state.values[next] ?? '';
    applyMode();
    schedulePreview();
  }

  async function open(editLink) {
    const reopen = state.link !== editLink;
    state.link = editLink;
    if (!state.popup) buildPopup();
    state.popup.style.display = 'block';

    if (reopen) {
      state.container = editLink.closest('.post-container') || editLink.closest('.reply, .op') || editLink.closest('.post');
      state.status.textContent = 'Loading…';
      state.textarea.value = '';
      state.values = { markup: '', raw: '' };
      state.mode = 'markup';
      applyMode();
      state.hint.textContent = '';
      // Nothing may be typed into a box that is about to be filled from the server, and
      // the answer is dropped if the mod has moved on to another post meanwhile.
      state.textarea.disabled = true;
      state.saveButton.disabled = true;

      state.popup.querySelector('#editPostNumber').textContent = `No.${editLink.dataset.post}`;
      buildPreview();

      const params = postParams(editLink);
      try {
        const data = await api(
          `/mod/api/edit/source?boardUri=${encodeURIComponent(params.boardUri)}&threadId=${params.threadId}&postId=${params.postId}&isThread=${params.isThread ? '1' : '0'}`
        );
        if (state.link !== editLink) return;
        state.values.markup = data.source ?? '';
        state.values.raw = data.raw ?? '';
        // A post with no source of its own (an imported one) has nothing but its HTML, so
        // it can only be edited as raw HTML.
        state.mode = state.values.markup ? 'markup' : 'raw';
        state.textarea.value = state.values[state.mode];
        applyMode();
        state.status.textContent = '';
        renderPreview();
      } catch (err) {
        if (state.link !== editLink) return;
        state.status.textContent = `Could not load the post: ${err.message}`;
      } finally {
        state.textarea.disabled = false;
        state.saveButton.disabled = false;
      }
    }

    state.container.scrollIntoView({ block: 'center' });
    state.textarea.focus();
  }

  function close() {
    if (state.timer) clearTimeout(state.timer);
    state.timer = null;
    state.seq += 1;
    removePreview();
    if (state.popup) state.popup.style.display = 'none';
    state.link = null;
  }

  async function save() {
    if (!state.link) return;
    const params = postParams(state.link);
    state.saveButton.disabled = true;
    state.status.textContent = 'Saving…';
    try {
      await api('/mod/api/edit', {
        method: 'POST',
        body: { ...params, message: state.textarea.value, mode: state.mode }
      });
      location.reload();
    } catch (err) {
      state.status.textContent = err.message;
      state.saveButton.disabled = false;
    }
  }

  document.addEventListener('click', (e) => {
    const target = e.target instanceof Element ? e.target : e.target.parentElement;
    const editLink = target?.closest?.('.mod-edit-post');
    if (!editLink) return;
    e.preventDefault();
    open(editLink);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.popup && state.popup.style.display === 'block') close();
  });
})();
