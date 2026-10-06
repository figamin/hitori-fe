// Update the textarea value and visibility based on the URL
function quickReply() {
  const quickreplydiv = document.getElementById('quickReply');
  const msg = document.getElementById('message-qr');
  const hash = window.location.hash;
  if (hash && hash.startsWith('#q')) {
    quickreplydiv.className = 'show-quickreply';

    const currentValue = msg.value.trim();
    const newQuote = `>>${hash.substring(2)}`;

    if (currentValue) {
      if (!currentValue.includes(newQuote)) {
        msg.value = currentValue + '\n' + newQuote + '\n';
      }
    } else {
      msg.value = newQuote + '\n';
    }
  } else {
    quickreplydiv.className = '';
  }
}

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

quickReply();
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
  const mainDropZone = document.getElementById('drop-zone');
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

  function reattachEventListeners() {
    const qrDropZone = qrFileSection.querySelector('#drop-zone');
    const qrFileInput = qrFileSection.querySelector('input[type="file"]');
    const mainFileInput = mainForm.querySelector('input[type="file"]');

    // File upload event listeners
    if (qrDropZone && qrFileInput) {
      // Click to upload
      qrDropZone.onclick = () => qrFileInput.click();

      // File input change
      qrFileInput.onchange = (e) => {
        if (mainFileInput) {
          mainFileInput.files = e.target.files;
          mainFileInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      };

      // Drag and drop
      qrDropZone.ondragover = (e) => {
        e.preventDefault();
        qrDropZone.style.backgroundColor = 'var(--small-button)';
      };

      qrDropZone.ondragleave = () => {
        qrDropZone.style.backgroundColor = 'var(--background-gradient)';
      };

      qrDropZone.ondrop = (e) => {
        e.preventDefault();
        qrDropZone.style.backgroundColor = 'var(--background-gradient)';
        if (mainFileInput) {
          const dt = new DataTransfer();
          Array.from(e.dataTransfer.files).forEach((file) => dt.items.add(file));
          mainFileInput.files = dt.files;
          mainFileInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      };
    }

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
    const mainFileInput = mainForm.querySelector('input[type="file"]');
    if (mainFileInput && mainFileInput.files.length > 0) {
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

          const qrPreviewContainer = qrFileSection.querySelector('#preview-container');
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

  function syncContent() {
    if (mainDropZone && mainPreviewContainer) {
      qrFileSection.innerHTML = mainDropZone.outerHTML + mainPreviewContainer.outerHTML;
      reattachEventListeners();
      syncSpoilerRadios(); // Sync radio states after content update
    }
  }

  // Initial sync
  syncContent();

  // Keep synced with main form
  const observer = new MutationObserver(syncContent);

  observer.observe(mainDropZone, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true
  });
  observer.observe(mainPreviewContainer, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true
  });
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
