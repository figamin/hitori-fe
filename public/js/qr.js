// Put `>>id` into the quick reply, on a line of its own at the cursor, and open it. Every
// click quotes - the same post again too, as 4chan X does. The textarea's input event is
// fired so the reply form's copy and the character count follow.
function insertQuote(id) {
  const quickreplydiv = document.getElementById('quickReply');
  const msg = document.getElementById('message-qr');
  quickreplydiv.classList.add('show-quickreply');

  const quote = `>>${id}\n`;
  const value = msg.value;
  const start = msg.selectionStart ?? value.length;
  const end = msg.selectionEnd ?? value.length;
  const before = value.slice(0, start);
  const prefix = before && !before.endsWith('\n') ? '\n' : '';
  msg.value = before + prefix + quote + value.slice(end);
  const caret = start + prefix.length + quote.length;
  msg.focus();
  msg.setSelectionRange(caret, caret);
  msg.dispatchEvent(new Event('input', { bubbles: true }));
}

// A page opened with `#q<id>` (a "Reply to this post" link followed from another page)
// opens the quick reply with that quote; any other hash closes it.
function quickReply() {
  const quickreplydiv = document.getElementById('quickReply');
  const hash = window.location.hash;
  if (hash && hash.startsWith('#q')) {
    insertQuote(hash.substring(2));
  } else {
    quickreplydiv.classList.remove('show-quickreply');
  }
}

// "Reply to this post" links on this page are handled here rather than through the
// hash: clicking one whose hash is already in the address bar changes nothing, so the
// browser would never say it was clicked.
document.addEventListener('click', (e) => {
  const link = e.target instanceof Element && e.target.closest('a.linkQuote[href*="#q"]');
  if (!link || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
  const url = new URL(link.href, window.location.href);
  if (url.pathname !== window.location.pathname || !url.hash.startsWith('#q')) return;
  e.preventDefault();
  insertQuote(url.hash.substring(2));
});

function initDragging(element, handle) {
  let pos1 = 0,
    pos2 = 0,
    pos3 = 0,
    pos4 = 0;
  let startLeft, startTop;

  const rightPos = parseInt(getComputedStyle(element).right);
  const leftPos = window.innerWidth - (element.offsetWidth + rightPos);
  element.style.left = leftPos + 'px';
  element.style.right = 'auto';

  handle.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;

    startLeft = parseInt(getComputedStyle(element).left);
    startTop = parseInt(getComputedStyle(element).top);

    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();

    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;

    const newLeft = startLeft - pos1;
    const newTop = startTop - pos2;

    element.style.left = newLeft + 'px';
    element.style.top = newTop + 'px';

    startLeft = newLeft;
    startTop = newTop;
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

initDragging(document.getElementById('quickReply'), document.getElementById('quickReplyHeader'));
window.onhashchange = quickReply;

// Add character counter for quick reply
document.getElementById('message-qr').addEventListener('input', function () {
  document.getElementById('qr-charCount').textContent = this.value.length;
});

// Mirror one form control onto the other. A missing side must not abort the script
// - everything after this point (the AJAX submit handler included) would never be
// registered.
function syncText(a, b) {
  if (!a || !b) return;
  a.oninput = function () {
    b.value = this.value;
  };
  b.oninput = function () {
    a.value = this.value;
  };
}

function syncClick(a, b) {
  if (!a || !b) return;
  a.onchange = function () {
    b.checked = this.checked;
  };
  b.onchange = function () {
    a.checked = this.checked;
  };
}

// Sync textareas
let qr_ta = document.getElementById('message-qr');
let st_ta = document.getElementById('message');
syncText(qr_ta, st_ta);

// Sync names
let qr_nm = document.getElementById('name-qr');
let st_nm = document.getElementById('name');
syncText(qr_nm, st_nm);

// Sync the deletion password. The server pre-fills the same random password in both
// forms, and whichever one is submitted becomes the post's password, so an edit to
// either box has to show up in the other.
syncText(document.getElementById('post-password-qr'), document.getElementById('post-password'));

// Sync the post options. Each is a checkbox in both forms (the reply form and the
// quick reply), so they mirror one for one and a reader can combine them - sage and
// fortune together, say. Both post `fortune`/`sage`/`nonoko` = "true".
for (const name of ['fortune', 'sage', 'nonoko']) {
  syncClick(document.getElementById(`${name}-qr`), document.getElementById(name));
}

document.addEventListener('DOMContentLoaded', () => {
  const mainPreviewContainer = document.getElementById('preview-container');
  const qrFileSection = document.getElementById('qr-file-section');
  const mainForm = document.querySelector('.reply-form:not(#quick-reply-form)');
  const qrForm = document.getElementById('quick-reply-form');

  function syncSpoilerRadios() {
    const qrSpoilerRadios = qrFileSection.querySelectorAll('input[type="radio"][name^="spoiler_"]');
    const mainSpoilerRadios = mainForm.querySelectorAll('input[type="radio"][name^="spoiler_"]');

    mainSpoilerRadios.forEach((radio, index) => {
      if (qrSpoilerRadios[index]) {
        qrSpoilerRadios[index].checked = radio.checked;
      }
    });
  }

  // Files: the quick reply has no file input of its own. Its drop zone opens the reply
  // form's picker and a drop anywhere on the panel goes to the reply form's upload code
  // (upload.js), so both forms always hold the same files.
  const quickReplyEl = document.getElementById('quickReply');
  const mainFileInput = mainForm && mainForm.querySelector('#image');
  const qrDropZone = document.getElementById('qr-dropzone');

  if (!mainFileInput || !mainPreviewContainer) {
    if (qrDropZone) qrDropZone.hidden = true;
  } else {
    qrDropZone.addEventListener('click', () => {
      if (!mainFileInput.disabled) mainFileInput.click();
    });

    let dragDepth = 0;
    quickReplyEl.addEventListener('dragenter', (e) => {
      if (!e.dataTransfer?.types?.includes('Files') || mainFileInput.disabled) return;
      dragDepth++;
      quickReplyEl.classList.add('qr-dragover');
    });
    quickReplyEl.addEventListener('dragover', (e) => {
      if (e.dataTransfer?.types?.includes('Files')) e.preventDefault();
    });
    quickReplyEl.addEventListener('dragleave', () => {
      if (--dragDepth <= 0) {
        dragDepth = 0;
        quickReplyEl.classList.remove('qr-dragover');
      }
    });
    quickReplyEl.addEventListener('drop', (e) => {
      if (!e.dataTransfer?.files?.length) return;
      e.preventDefault();
      dragDepth = 0;
      quickReplyEl.classList.remove('qr-dragover');
      if (mainFileInput.disabled) return;
      if (typeof window.handleFilesUpload === 'function') window.handleFilesUpload(Array.from(e.dataTransfer.files));
    });
  }

  // File / Embed / Poll / Tegaki. The reply form owns the mode (its "Select" row shows and
  // hides its fields, and Tegaki opens the drawing board), so these links click its
  // buttons and then follow whichever one is active.
  const mainModeButtons = mainForm ? Array.from(mainForm.querySelectorAll('.mode-select-btn')) : [];
  const qrModes = document.getElementById('qr-modes');
  const qrModeLinks = [];

  function activeMode() {
    const active = mainModeButtons.find((btn) => btn.classList.contains('active'));
    return active ? active.dataset.mode : 'file';
  }

  function updateMode() {
    const mode = activeMode();
    qrModeLinks.forEach((link) => link.classList.toggle('active', link.dataset.mode === mode));
    if (qrDropZone && mainFileInput) qrDropZone.hidden = mode === 'youtube' || mode === 'poll';
    qrFileSection.hidden = mode === 'youtube';
  }

  if (qrModes && mainModeButtons.length > 1) {
    mainModeButtons.forEach((btn, index) => {
      if (index > 0) qrModes.append(' / ');
      const link = document.createElement('span');
      link.className = 'qr-mode';
      link.dataset.mode = btn.dataset.mode;
      link.textContent = btn.textContent.trim();
      link.addEventListener('click', () => {
        btn.click();
        updateMode();
      });
      qrModeLinks.push(link);
      qrModes.appendChild(link);
    });
    qrModes.hidden = false;
    mainModeButtons.forEach((btn) => btn.addEventListener('click', () => setTimeout(updateMode)));
    updateMode();
  }

  // While the quick reply is open, the reply form's embed and poll fields live in it (the
  // same elements, so they are posted with it and the poll's "+ Add Option" keeps
  // working); closing it puts them back where they were.
  const borrowed = [
    { el: document.getElementById('embed-mode-content'), slot: document.getElementById('qr-embed-slot') },
    { el: document.getElementById('poll-details'), slot: document.getElementById('qr-poll-slot') }
  ].filter((b) => b.el && b.slot);

  function syncBorrowed() {
    const open = quickReplyEl.classList.contains('show-quickreply');
    borrowed.forEach((b) => {
      if (open && b.el.parentNode !== b.slot) {
        b.home = { parent: b.el.parentNode, next: b.el.nextSibling };
        b.slot.appendChild(b.el);
      } else if (!open && b.home && b.el.parentNode === b.slot) {
        b.home.parent.insertBefore(b.el, b.home.next);
      }
    });
    updateMode();
  }

  new MutationObserver(syncBorrowed).observe(quickReplyEl, { attributes: true, attributeFilter: ['class'] });
  syncBorrowed();

  function reattachEventListeners() {
    // Remove button event listeners
    const qrRemoveButtons = qrFileSection.querySelectorAll('.remove-file');
    const mainRemoveButtons = mainForm.querySelectorAll('.remove-file');

    qrRemoveButtons.forEach((button, index) => {
      button.onclick = () => {
        if (mainRemoveButtons[index]) {
          mainRemoveButtons[index].click();
        }
      };
    });

    // Spoiler / NSFW radio listeners (the QR file section is a copy of the
    // main form's preview cards, so the two lists line up one to one).
    const qrSpoilerRadios = qrFileSection.querySelectorAll('input[type="radio"][name^="spoiler_"]');
    const mainSpoilerRadios = mainForm.querySelectorAll('input[type="radio"][name^="spoiler_"]');

    qrSpoilerRadios.forEach((radio, index) => {
      radio.onchange = () => {
        const mainRadio = mainSpoilerRadios[index];
        if (mainRadio) {
          mainRadio.checked = true;
          mainRadio.dispatchEvent(new Event('change', { bubbles: true }));
        }
      };
    });

    // Also listen to main form spoiler changes
    mainSpoilerRadios.forEach((radio, index) => {
      radio.addEventListener('change', () => {
        const qrRadios = qrFileSection.querySelectorAll('input[type="radio"][name^="spoiler_"]');
        if (qrRadios[index]) {
          qrRadios[index].checked = true;
        }
      });
    });
  }

  // Add AJAX submission for quick reply form
  qrForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Create a new FormData object
    const formData = new FormData();

    // Add all form fields except file
    const formFields = new FormData(qrForm);
    for (let [key, value] of formFields.entries()) {
      if (key !== 'image') {
        formData.append(key, value);
      }
    }

    // Add files from main form
    // An embed is posted without files, as the reply form does (it disables its input).
    if (mainFileInput && !mainFileInput.disabled && mainFileInput.files.length > 0) {
      for (let i = 0; i < mainFileInput.files.length; i++) {
        formData.append('image', mainFileInput.files[i]);
      }
    }

    // Add spoiler / NSFW states (the index of each file is resolved by upload.js)
    if (window.getSpoilerFields) {
      window.getSpoilerFields(mainForm).forEach(({ name, value }) => formData.append(name, value));
    }

    try {
      const response = await fetch(qrForm.action, {
        method: 'POST',
        body: formData,
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const result = await response.json();

        if (result.success) {
          qrForm.reset();
          mainForm.reset();

          const qrPreviewContainer = qrFileSection.querySelector('#qr-preview-container');
          if (qrPreviewContainer) qrPreviewContainer.innerHTML = '';
          if (mainPreviewContainer) mainPreviewContainer.innerHTML = '';

          if (typeof globalFormState !== 'undefined') {
            globalFormState = {
              name: '',
              sage: false,
              message: '',
              files: []
            };
          }

          if (result.postPassword && result.postKey) {
            savePostPassword(result.postKey, result.postPassword);
          } else if (result.post) {
            const boardUri = result.post.boardUri;
            const threadId = result.post.threadId;
            const postId = result.post.postId;
            const postKey = `${boardUri}/${threadId}/${postId}`;
            savePostPassword(postKey, formData.get('post-password') || '');
          }

          // Handle nonoko redirect
          if (result.post.nonoko) {
            window.location.href = `/${result.post.boardUri}/`;
            return;
          }

          if (typeof lastPostedId !== 'undefined') {
            lastPostedId = result.post.postId;
          }

          if (window.threadAutoRefresh) {
            window.threadAutoRefresh.refreshPosts(true);
          }

          if (typeof watchedThreads !== 'undefined') {
            // The reply has no subject of its own; the watcher falls back to the
            // thread's OP (or its message) for the label.
            watchedThreads.autoWatchThread(result.post.threadId, result.post.boardUri, result.post.subject, result.post.message);
          }

          // Hide quick reply after successful post
          document.getElementById('quickReply').classList.remove('show-quickreply');
        } else if (result.error) {
          if (result.error === 'flood') {
            alert(result.message || 'Posting too quickly. Please wait a moment.');
          } else if (result.error === 'banned') {
            if (result.redirectUrl) {
              window.location.href = result.redirectUrl;
            } else {
              alert('You are banned from posting.');
            }
          } else {
            alert(result.error.message || result.error || 'Error posting reply');
          }
        }
      } else if (!response.ok) {
        const errorText = await response.text();

        let errorMessage = 'Error posting reply';

        if (response.status === 429) {
          errorMessage = 'Posting too quickly. Please wait a moment.';
        } else if (response.status === 403) {
          errorMessage = 'Your post was blocked. This may be due to spam prevention measures.';
        } else if (errorText.includes('Posting Restricted') || errorText.includes('Posting not allowed')) {
          const errorMatch = errorText.match(/<p[^>]*>(.*?)<\/p>/i);
          if (errorMatch && errorMatch[1]) {
            errorMessage = errorMatch[1].replace(/<[^>]*>/g, '');
          } else {
            errorMessage = 'Posting is restricted from your IP address due to spam prevention measures.';
          }
        }

        alert(errorMessage);
      }
    } catch (error) {
      console.error('Error posting reply:', error);
      alert('Error posting reply');
    }
  });

  // The file cards are a copy of the reply form's (with their spoiler/NSFW choice), under
  // an id of their own so the page never holds two #preview-container.
  function syncContent() {
    if (mainPreviewContainer) {
      const copy = mainPreviewContainer.cloneNode(true);
      copy.id = 'qr-preview-container';
      copy.removeAttribute('style');
      qrFileSection.replaceChildren(copy);
      reattachEventListeners();
      syncSpoilerRadios(); // Sync radio states after content update
    }
  }

  // Initial sync
  syncContent();

  // Keep synced with main form
  const observer = new MutationObserver(syncContent);

  if (mainPreviewContainer) {
    observer.observe(mainPreviewContainer, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true
    });
  }
});

document.getElementById('qr-close').addEventListener('click', function () {
  document.getElementById('quickReply').classList.remove('show-quickreply');
  if (window.location.hash.startsWith('#q')) {
    history.pushState('', document.title, window.location.pathname + window.location.search);
  }
});

function savePostPassword(postKey, password) {
  try {
    const postPasswords = JSON.parse(localStorage.getItem('postingPasswords') || '{}');
    postPasswords[postKey] = password;
    localStorage.setItem('postingPasswords', JSON.stringify(postPasswords));
    console.log('QR: Saved password to localStorage:', {
      key: postKey,
      password: password
    });
  } catch (e) {
    console.error('QR: Error saving password to localStorage:', e);
  }
}

// Last, so the character count and the reply form's copy are already listening when a
// page opened with `#q<id>` puts its quote in.
quickReply();
