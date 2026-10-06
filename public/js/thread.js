let markedPosting = null;

function markPost(id) {
  id = Number(id);
  if (isNaN(id)) return;

  if (markedPosting) {
    markedPosting.classList.remove('highlight');
    markedPosting = null;
  }

  if (document.querySelector(`.op[data-post-id="${id}"]`)) return;

  const container = document.querySelector(`.reply[data-post-id="${id}"]`);
  if (!container) return;

  container.classList.add('highlight');
  markedPosting = container;
}

function scrollToHash() {
  const hash = window.location.hash;
  if (!hash || hash.startsWith('#q')) return;
  const postId = hash.slice(1);
  if (!/^\d+$/.test(postId)) return;
  const el =
    document.querySelector(`.reply[data-post-id="${postId}"], .op[data-post-id="${postId}"]`) ||
    document.getElementById('p' + postId);
  if (el) {
    markPost(postId);
    el.scrollIntoView();
  }
}

window.markPost = markPost;
scrollToHash();
window.addEventListener('hashchange', scrollToHash);

let unreadCount = 0;
let originalTitle = document.title;
let lastPostedId = null;
let lastReplyId = 0;

function getRepliesContainer() {
  return document.getElementById('replies') || document.querySelector('.replies');
}

function isTextBoardPage() {
  return document.body.classList.contains('textboard');
}

function getLastReplyIdFromDom() {
  let max = 0;
  document.querySelectorAll('.reply[data-post-id]').forEach((el) => {
    const id = parseInt(el.dataset.postId, 10);
    if (id > max) max = id;
  });
  return max;
}

function nextReplyNumber() {
  const count = document.querySelectorAll('.reply[data-post-id]').length;
  return isTextBoardPage() ? count + 2 : count + 1;
}

const threadAutoRefresh = {
  autoRefresh: true,
  refreshTimer: null,
  refreshing: false,
  pendingRefresh: false,
  manualRefresh: false,
  lastRefresh: 5,
  currentRefresh: 5,
  boardUri: null,
  threadId: null,
  isArchive: false,
  refreshLabel: null,
  refreshButton: null,
  autoCheckbox: null,
  sound: null,

  init() {
    const threadElement = document.querySelector('.thread');
    if (!threadElement || !document.getElementById('thread-refresh-btn')) return;

    this.boardUri = location.pathname.split('/')[1];
    this.threadId = threadElement.id;
    this.isArchive = location.pathname.includes('/archive/');
    lastReplyId = getLastReplyIdFromDom();

    this.refreshLabel = document.getElementById('thread-refresh-label');
    this.refreshButton = document.getElementById('thread-refresh-btn');
    this.autoCheckbox = document.getElementById('thread-auto-refresh');

    const savedAuto = localStorage.getItem('threadAutoRefresh');
    if (savedAuto === 'false') {
      this.autoCheckbox.checked = false;
    }

    this.refreshButton.onclick = () => this.refreshPosts(true);
    this.autoCheckbox.onchange = () => this.changeRefresh();

    this.changeRefresh();
  },

  startTimer(time) {
    if (time > 600) time = 600;
    this.currentRefresh = time;
    this.lastRefresh = time;
    if (this.refreshLabel) this.refreshLabel.textContent = String(this.currentRefresh);
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.refreshTimer = setInterval(() => {
      this.currentRefresh--;
      if (!this.currentRefresh) {
        clearInterval(this.refreshTimer);
        this.refreshTimer = null;
        if (this.refreshLabel) this.refreshLabel.textContent = '';
        this.refreshPosts();
      } else if (this.refreshLabel) {
        this.refreshLabel.textContent = String(this.currentRefresh);
      }
    }, 1000);
  },

  changeRefresh() {
    this.autoRefresh = this.autoCheckbox.checked;
    localStorage.setItem('threadAutoRefresh', this.autoRefresh ? 'true' : 'false');
    if (!this.autoRefresh) {
      if (this.refreshLabel) this.refreshLabel.textContent = '';
      if (this.refreshTimer) {
        clearInterval(this.refreshTimer);
        this.refreshTimer = null;
      }
      return;
    }
    this.startTimer(5);
  },

  scheduleNextTimer(foundPosts) {
    if (!this.autoRefresh) return;
    this.startTimer(this.manualRefresh || foundPosts ? 5 : this.lastRefresh * 2);
  },

  refreshPosts(manual) {
    if (this.refreshing) {
      if (manual) this.pendingRefresh = true;
      return;
    }
    this.manualRefresh = !!manual;
    if (this.autoRefresh && manual && this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.refreshing = true;
    if (this.refreshButton) this.refreshButton.disabled = true;

    fetch(`/${this.boardUri}/thread/${this.threadId}.json`)
      .then((r) => {
        if (!r.ok) throw new Error('refresh failed');
        return r.json();
      })
      .then((data) => {
        const posts = data.posts || [];
        let foundPosts = false;
        // Only posts the reader did not write on this page are worth a sound; their
        // own reply landing is already handled by `lastPostedId` below.
        let foundOthersPost = false;
        let replyNum = nextReplyNumber();
        for (let i = 0; i < posts.length; i++) {
          const post = posts[i];
          if (post.postId > lastReplyId) {
            foundPosts = true;
            if (post.postId !== lastPostedId) foundOthersPost = true;
            this.appendPost(post, replyNum++);
            lastReplyId = post.postId;
          }
        }
        // The reader asked for this setting, so the sound is only for the thing they
        // asked about: the *automatic* refresh bringing in somebody else's post. A
        // manual refresh is their own click (nothing arrives that they did not ask
        // for) and their own post needs no announcing either.
        if (foundOthersPost && !manual) this.playNewPostSound();
        if (!this.pendingRefresh) this.scheduleNextTimer(foundPosts);
      })
      .catch((err) => {
        console.error('Thread refresh error:', err);
        if (!this.pendingRefresh) this.scheduleNextTimer(false);
      })
      .finally(() => {
        this.refreshing = false;
        if (this.refreshButton) this.refreshButton.disabled = false;
        this.manualRefresh = false;
        if (this.pendingRefresh) {
          this.pendingRefresh = false;
          this.refreshPosts(true);
        }
      });
  },

  // The reader turned on "play a sound when a thread gets a new post": say so when
  // the auto refresh brings one in. The sound is made on first use, so a reader who
  // never turns the setting on never downloads it; `/sound/new-post.mp3` is a
  // placeholder - replace the file, or change the name here.
  playNewPostSound() {
    if (localStorage.getItem('newPostSound') !== 'true') return;
    if (!this.sound) this.sound = new Audio('/sound/mikudayo.mp3');
    this.sound.currentTime = 0;
    // A page the reader has not interacted with yet is not allowed to play audio at
    // all; that is the browser's decision, not something to report.
    const played = this.sound.play();
    if (played && played.catch) played.catch(() => {});
  },

  appendPost(post, replyNumber) {
    const threadReplies = getRepliesContainer();
    if (!threadReplies) return;

    const thread = { threadId: this.threadId, boardUri: this.boardUri };
    const cellPath = isTextBoardPage() ? 'textreply' : 'reply';

    fetch(`/${this.boardUri}/cells/${cellPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reply: { ...post, sage: Boolean(post.sage) },
        thread,
        replyNumber,
        isArchive: this.isArchive
      })
    })
      .then((response) => {
        if (!response.ok) throw response;
        return response.text();
      })
      .then((replyHtml) => {
        const temp = document.createElement('div');
        temp.innerHTML = replyHtml.trim();
        const reply = temp.firstElementChild;
        if (!reply) return;

        threadReplies.appendChild(reply);
        document.dispatchEvent(new CustomEvent('contentAdded'));
        if (window.backlinks?.init) window.backlinks.init();
        if (window.initializeThumbnails) window.initializeThumbnails();
        if (window.initializePostMenus) window.initializePostMenus(reply);
        if (window.initializePolls) window.initializePolls();
        if (window.settings?.applyFilters) window.settings.applyFilters();

        const isAtBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 100;
        if (!isAtBottom && post.postId !== lastPostedId) {
          unreadCount++;
          updateTitle();
        }

        // Our own post just landed at the end of the thread: take the page down
        // to it. Posting from the quick reply leaves you looking at the bottom
        // already (its panel sits there), but a post from the main reply form -
        // which lives at the top of the thread - left the page where it was, so
        // the new post was out of sight. Posts pulled in by the auto refresh are
        // deliberately left alone.
        if (post.postId === lastPostedId) {
          window.scrollTo(0, document.documentElement.scrollHeight);
        }
      })
      .catch((err) => {
        console.error('Error loading reply cells:', err, post);
      });
  }
};

window.threadAutoRefresh = threadAutoRefresh;

function getPostPasswords() {
  try {
    const storedPasswords = localStorage.getItem('postingPasswords');
    if (storedPasswords) {
      return JSON.parse(storedPasswords);
    }
  } catch (e) {
    console.error('Error parsing postingPasswords from localStorage:', e);
  }
  return {};
}

function savePostPasswords(passwords) {
  try {
    localStorage.setItem('postingPasswords', JSON.stringify(passwords));
  } catch (e) {
    console.error('Error saving postingPasswords to localStorage:', e);
  }
}

function generateRandomPassword() {
  return Math.random().toString(36).substring(2, 10);
}

function updateTitle() {
  document.title = unreadCount > 0 ? `(${unreadCount}) ${originalTitle}` : originalTitle;
}


document.addEventListener('DOMContentLoaded', () => {
  threadAutoRefresh.init();
});

document.addEventListener('DOMContentLoaded', () => {
  const mainReplyForm = document.getElementById('reply-form');

  if (mainReplyForm) {
    mainReplyForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const fileInput = document.getElementById('image');
      if (window.updateFileInput && typeof window.updateFileInput === 'function') {
        window.updateFileInput();
      }

      const formData = new FormData(mainReplyForm);

      // The box is pre-filled with the reader's remembered password (see
      // `post-password.js`), so post what is in it; only invent one if it is empty.
      const typedPassword = String(formData.get('post-password') || '').trim();
      const postPassword = typedPassword || generateRandomPassword();
      formData.set('post-password', postPassword);

      formData.delete('image');
      if (fileInput && fileInput.files && fileInput.files.length > 0) {
        for (let i = 0; i < fileInput.files.length; i++) {
          formData.append('image', fileInput.files[i]);
        }
      }

      try {
        const response = await fetch(mainReplyForm.action, {
          method: 'POST',
          body: formData,
          headers: {
            'X-Requested-With': 'XMLHttpRequest'
          },
          credentials: 'omit'
        });

        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const result = await response.json();

          if (result.success) {
            mainReplyForm.reset();

            globalFormState = {
              name: '',
              sage: false,
              message: '',
              files: []
            };

            const fileInput = document.getElementById('image');
            const previewContainer = document.getElementById('preview-container');
            const previewContainer_QR = document.getElementById('qr-preview-container');

            if (previewContainer) previewContainer.innerHTML = '';
            if (previewContainer_QR) previewContainer_QR.innerHTML = '';

            if (fileInput) {
              const dt = new DataTransfer();
              fileInput.files = dt.files;
            }

            if (window.currentFiles !== undefined) {
              window.currentFiles = [];
            }

            if (result.post.nonoko) {
              try {
                const postKey = `${result.post.boardUri}/${result.post.threadId}/${result.post.postId}`;
                const postPasswords = getPostPasswords();
                postPasswords[postKey] = result.postPassword || postPassword;
                savePostPasswords(postPasswords);
              } catch (e) {
                console.error('Error directly saving to localStorage:', e);
              }

              window.location.href = `/${result.post.boardUri}/`;
              return;
            }

            if (result.postPassword && result.postKey) {
              const postPasswords = getPostPasswords();
              postPasswords[result.postKey] = result.postPassword;
              savePostPasswords(postPasswords);

              try {
                const savedPasswords = JSON.parse(localStorage.getItem('postingPasswords') || '{}');
              } catch (e) {
                console.error('Error directly saving to localStorage:', e);
              }
            }

            lastPostedId = result.post.postId;
            threadAutoRefresh.refreshPosts(true);
            if (typeof watchedThreads !== 'undefined') {
              // The reply has no subject of its own; the watcher falls back to
              // the thread's OP (or its message) for the label.
              watchedThreads.autoWatchThread(result.post.threadId, result.post.boardUri, result.post.subject, result.post.message);
            }
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
              const errorMsg = result.error.message || result.error || result.message || 'Unknown error';
              alert(errorMsg);
            }
          }
        } else if (!response.ok) {
          // Handle non-JSON error responses
          const errorText = await response.text();

          if (errorText.includes('/banned?id=')) {
            const banIdMatch = errorText.match(/\/banned\?id=([a-f0-9]+)/i);
            if (banIdMatch && banIdMatch[1]) {
              window.location.href = `/banned?id=${banIdMatch[1]}`;
              return;
            }
          }

          let errorMessage = errorText;

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
          } else {
            const errorMatch =
              errorText.match(/<p[^>]*>(.*?)<\/p>/i) ||
              errorText.match(/<div[^>]*>(.*?)<\/div>/i) ||
              errorText.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/i);
            if (errorMatch && errorMatch[1]) {
              errorMessage = errorMatch[1].replace(/<[^>]*>/g, '').trim();
            }
            if (!errorMessage || errorMessage.length === 0) {
              errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            }
          }

          alert(errorMessage);
        }
      } catch (error) {
        console.error('Error posting reply:', error);
        alert(error.message || error.toString() || 'Unknown error');
      }
    });
  }
});

// Reset unread count when user scrolls to bottom
window.addEventListener('scroll', () => {
  const isAtBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 100;
  if (isAtBottom) {
    unreadCount = 0;
    updateTitle();
  }
});

document.addEventListener('DOMContentLoaded', function () {
  const quoteButton = document.createElement('button');
  quoteButton.textContent = 'Quote';
  quoteButton.className = 'quote-button';
  quoteButton.style.cssText = `
    position: absolute;
    display: none;
    z-index: 1000;
    padding: 5px 10px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  `;
  document.body.appendChild(quoteButton);

  document.addEventListener('mouseup', function (e) {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (selectedText) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      const x = e.pageX;
      const y = e.pageY - 40;

      quoteButton.style.left = `${x}px`;
      quoteButton.style.top = `${y}px`;
      quoteButton.style.display = 'block';

      quoteButton.onclick = function () {
        const messageBox = document.getElementById('message');
        if (messageBox) {
          const quotedText = selectedText
            .split('\n')
            .map((line) => `>${line}`)
            .join('\n');

          const currentText = messageBox.value;
          const cursorPos = messageBox.selectionStart;

          const beforeCursor = currentText.substring(0, cursorPos);
          const afterCursor = currentText.substring(cursorPos);

          messageBox.value =
            beforeCursor +
            (beforeCursor && !beforeCursor.endsWith('\n') ? '\n' : '') +
            quotedText +
            (!afterCursor.startsWith('\n') ? '\n' : '') +
            afterCursor;

          quoteButton.style.display = 'none';

          messageBox.focus();
        }
      };
    } else {
      quoteButton.style.display = 'none';
    }
  });

  document.addEventListener('mousedown', function (e) {
    if (e.target !== quoteButton) {
      quoteButton.style.display = 'none';
    }
  });
});
