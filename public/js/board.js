// Store original thread list on page load
document.addEventListener('DOMContentLoaded', function () {
  const threads = document.querySelector('#thread-container .threads');
  if (!threads) return;
  const store = document.createElement('div');
  store.id = 'original-threads';
  store.style.display = 'none';
  store.innerHTML = threads.innerHTML;
  document.body.appendChild(store);
});

const searchBox = document.getElementById('search-op');
if (searchBox) {
  let debounceTimeout;

  searchBox.addEventListener('input', function (e) {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => performSearch(e.target.value), 300);
  });
}

async function performSearch(query) {
  const boardUri = window.location.pathname.split('/')[1];

  const threadsEl = document.querySelector('#thread-container .threads');

  try {
    if (query.trim() === '') {
      const store = document.getElementById('original-threads');
      threadsEl.innerHTML = store ? store.innerHTML : '';
      reinitializeScripts();
      return;
    }

    const searchRes = await fetch('/api/search-threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, boardUri })
    });
    const data = await searchRes.json();
    if (!data.success) return;

    const listRes = await fetch(`/${boardUri}/cells/thread-list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threads: data.threads, boardUri, isOverboard: false })
    });
    threadsEl.innerHTML = await listRes.text();
    reinitializeScripts();
  } catch (error) {
    console.error('Search error:', error);
  }
}

function reinitializeScripts() {
  if (window.initializeDropdowns) window.initializeDropdowns();
  if (window.initializeThumbnails) window.initializeThumbnails();
  if (window.backlinks?.init) window.backlinks.init();
  if (window.initializeExpansion) window.initializeExpansion();
}

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

document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('form[action*="/thread"]').forEach((form) => {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const fileInput = document.getElementById('image') || document.getElementById('standard-image');

      if (document.getElementById('image') && window.updateFileInput) {
        window.updateFileInput();
      }

      try {
        const formData = new FormData(form);
        const boardUri = window.location.pathname.split('/')[1];
        const postPassword = generateRandomPassword();

        formData.delete('image');
        if (fileInput && fileInput.files && fileInput.files.length > 0) {
          for (let i = 0; i < fileInput.files.length; i++) {
            formData.append('image', fileInput.files[i]);
          }
        }

        // Always set a new random password
        formData.set('post-password', postPassword);

        const response = await fetch(form.getAttribute('action'), {
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
            const postPasswords = getPostPasswords();
            const postKey = result.postKey || `${boardUri}/${result.threadId}`;
            postPasswords[postKey] = result.postPassword || postPassword;
            savePostPasswords(postPasswords);

            try {
              const savedPasswords = JSON.parse(localStorage.getItem('postingPasswords') || '{}');
              savedPasswords[postKey] = result.postPassword || postPassword;
              localStorage.setItem('postingPasswords', JSON.stringify(savedPasswords));
            } catch (e) {
              console.error('Error directly saving to localStorage:', e);
            }

            if (typeof watchedThreads !== 'undefined') {
              watchedThreads.autoWatchThread(
                result.threadId,
                boardUri,
                formData.get('subject') || '',
                formData.get('message') || ''
              );
            }

            window.location.href = `/${boardUri}/thread/${result.threadId}`;
          } else if (result.error === 'flood') {
            alert(result.message || 'Posting too quickly. Please wait a moment.');
          } else if (result.error === 'banned') {
            if (result.redirectUrl) {
              window.location.href = result.redirectUrl;
            } else {
              alert('You are banned from posting.');
            }
          } else {
            alert(result.error || 'Error creating thread');
          }
        } else if (!response.ok) {
          const errorText = await response.text();

          if (errorText.includes('/banned?id=')) {
            const banIdMatch = errorText.match(/\/banned\?id=([a-f0-9]+)/i);
            if (banIdMatch && banIdMatch[1]) {
              window.location.href = `/banned?id=${banIdMatch[1]}`;
              return;
            }
          }

          let errorMessage = 'Error creating thread';

          if (response.status === 429) {
            errorMessage = 'Posting too quickly. Please wait a moment.';
          } else if (response.status === 403) {
            errorMessage = 'You may be banned from posting.';
          } else {
            const errorMatch = errorText.match(/<p[^>]*>(.*?)<\/p>/i);
            if (errorMatch && errorMatch[1]) {
              errorMessage = errorMatch[1].replace(/<[^>]*>/g, '');
            }
          }

          alert(errorMessage);
        }
      } catch (error) {
        console.error('Error submitting form:', error);
        alert('Error submitting form: ' + (error.message || 'Unknown error'));
      }
    });
  });
});
