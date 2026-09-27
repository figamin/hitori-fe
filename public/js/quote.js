const tooltips = {
  margin: 8,
  gap: 10,
  loadingPreviews: {},
  loadedContent: {},
  knownData: {},
  activeTooltip: null,
  activeQuote: null,
  lastPointer: null,
  watchTimer: null,

  init() {
    document.querySelectorAll('.post.op, .post.reply').forEach((post) => {
      this.cachePostData(post);
    });

    document.querySelectorAll('.quoteLink, .backlink').forEach((quote) => {
      this.processQuote(quote);
    });
  },

  refreshQuotes(root) {
    root.querySelectorAll('.post.op, .post.reply').forEach((post) => {
      this.cachePostData(post);
    });
    root.querySelectorAll('.quoteLink, .backlink').forEach((quote) => {
      this.processQuote(quote);
    });
  },

  parseQuoteUrl(url) {
    let match = url.match(/\/([^/]+)\/(?:archive\/)?thread\/(\d+)(?:\/replies)?#(\d+)/);
    if (!match) match = url.match(/\/([^/]+)\/res\/(\d+)\.html#(\d+)/);
    if (!match) return null;
    return {
      boardUri: match[1],
      threadId: match[2],
      postId: match[3],
      archive: url.includes('/archive/')
    };
  },

  parsePostDate(text) {
    if (!text) return null;
    const m = text.match(/^(\d{2})\/(\d{2})\/(\d{2})\(\w+\)(\d{2}):(\d{2}):(\d{2})$/);
    if (m) {
      const d = new Date(2000 + +m[3], +m[1] - 1, +m[2], +m[4], +m[5], +m[6]);
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
    const d = new Date(text);
    return isNaN(d.getTime()) ? null : d.toISOString();
  },

  trimPreviewMessage(html) {
    if (!html) return '';
    return html
      .replace(/(<p>\s*(<br\s*\/?>)?\s*<\/p>|<br\s*\/?>\s*)+$/gi, '')
      .replace(/[\s\u00a0\n\r]+$/g, '')
      .trim();
  },

  extractPostData(post) {
    const timeInfo = post.querySelector('.time-info');
    const dateText = timeInfo?.textContent?.trim();
    const contentEl = post.querySelector('.reply-content, .thread-content');

    return {
      name: post.querySelector('.name')?.innerHTML,
      subject: post.querySelector('.subject')?.innerHTML,
      postId: post.getAttribute('data-post-id'),
      creation: this.parsePostDate(dateText),
      signedRole: post.querySelector('.admin-name')
        ? 'Admin'
        : post.querySelector('.mod-name')
          ? 'Global volunteer'
          : null,
      message: this.trimPreviewMessage(contentEl?.innerHTML),
      files: Array.from(post.querySelectorAll('.file-info'))
        .map((fileInfo) => {
          const fileLink = fileInfo.querySelector('.file-link');
          const href = fileLink?.getAttribute('href') || fileLink?.href || '';
          const path = href.startsWith('http') ? new URL(href).pathname : href;
          const sizeMatch = fileInfo.textContent.match(/- ([\d.]+) KB/);
          const dimMatch = fileInfo.textContent.match(/\((\d+)x(\d+)\)/);

          return {
            path,
            originalName: fileLink?.textContent?.trim(),
            size: sizeMatch ? parseFloat(sizeMatch[1]) * 1024 : 0,
            width: dimMatch ? parseInt(dimMatch[1], 10) : null,
            height: dimMatch ? parseInt(dimMatch[2], 10) : null,
            thumb: fileInfo.querySelector('.image-container img')?.getAttribute('src') || fileInfo.querySelector('.image-container img')?.src,
            mime: fileInfo.querySelector('.media-toggle')?.getAttribute('data-mime') || ''
          };
        })
        .filter((file) => file.path),
      banMessage: post.querySelector('.ban-message')?.innerHTML,
      warningMessage: post.querySelector('.warning-message')?.innerHTML,
      poll: post.querySelector('.poll')?.outerHTML
    };
  },

  normalizePostData(post, boardUri) {
    return {
      name: post.name || 'Anonymous',
      creation: post.creation,
      postId: post.postId || post.threadId,
      subject: post.subject,
      message: this.trimPreviewMessage(post.markdown || post.message || ''),
      files: post.files?.map((file) => ({
        path: file.path,
        originalName: file.originalName,
        size: file.size,
        width: file.width,
        height: file.height,
        thumb: file.thumb,
        mime: file.mime || ''
      })),
      boardUri
    };
  },

  cachePostData(post) {
    const boardUri = post.dataset.board;
    const postId = post.getAttribute('data-post-id');
    if (!boardUri || !postId) return;
    this.knownData[`${boardUri}/${postId}`] = this.extractPostData(post);
  },

  cacheThreadData(data, boardUri) {
    if (data.thread) {
      const postData = this.normalizePostData(data.thread, boardUri);
      this.knownData[`${boardUri}/${data.thread.threadId}`] = postData;
    }
    if (data.posts) {
      data.posts.forEach((post) => {
        this.knownData[`${boardUri}/${post.postId}`] = this.normalizePostData(post, boardUri);
      });
    }
  },

  hideTooltip() {
    this.stopPointerWatch();
    if (this.activeTooltip) {
      this.activeTooltip.remove();
      this.activeTooltip = null;
    }
  },

  // Close the preview and forget the anchor it belonged to. Used when the
  // anchor moves out from under the cursor without a mouseout being fired.
  dismiss() {
    this.activeQuote = null;
    this.hideTooltip();
  },

  stopPointerWatch() {
    if (this.watchTimer) {
      clearInterval(this.watchTimer);
      this.watchTimer = null;
    }
  },

  // The preview belongs to a specific quote. Scrolling (or any reflow) can move
  // that quote out from under a stationary cursor without firing mouseout,
  // which would otherwise leave the preview stranded. Keep checking that the
  // pointer is still over the anchor until the preview is closed.
  startPointerWatch() {
    if (this.watchTimer) return;
    this.watchTimer = setInterval(() => {
      if (!this.activeQuote || !this.activeTooltip) {
        this.stopPointerWatch();
        return;
      }
      const rect = this.activeQuote.getBoundingClientRect();
      const pointer = this.lastPointer;
      const overAnchor =
        pointer &&
        pointer.x >= rect.left &&
        pointer.x <= rect.right &&
        pointer.y >= rect.top &&
        pointer.y <= rect.bottom;
      if (!overAnchor) this.dismiss();
    }, 150);
  },

  fitTooltip(tooltip, anchorRect) {
    const { margin, gap } = this;
    const maxW = window.innerWidth - margin * 2;
    const maxH = window.innerHeight - margin * 2;

    tooltip.style.position = 'fixed';
    tooltip.style.maxWidth = `${maxW}px`;
    tooltip.style.maxHeight = `${maxH}px`;
    tooltip.style.visibility = 'hidden';
    tooltip.style.left = `${margin}px`;
    tooltip.style.top = `${margin}px`;

    const width = tooltip.offsetWidth;
    const height = tooltip.offsetHeight;

    let left = anchorRect.right + gap;
    if (left + width > window.innerWidth - margin) {
      left = anchorRect.left - gap - width;
    }
    left = Math.max(margin, Math.min(left, window.innerWidth - margin - width));

    let top = anchorRect.top;
    if (top + height > window.innerHeight - margin) {
      top = window.innerHeight - margin - height;
    }
    top = Math.max(margin, Math.min(top, window.innerHeight - margin - height));

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.visibility = '';
  },

  renderPreview(postData, tooltip, quoteUrl) {
    return fetch('/cells/post-preview?post=' + encodeURIComponent(JSON.stringify(postData)))
      .then((r) => {
        if (!r.ok) throw new Error('Preview request failed');
        return r.text();
      })
      .then((html) => {
        this.loadedContent[quoteUrl] = html;
        if (this.activeTooltip && this.activeQuote?.href === quoteUrl) {
          this.activeTooltip.innerHTML = html;
          this.fitTooltip(this.activeTooltip, this.activeQuote.getBoundingClientRect());
        }
      })
      .catch(() => {
        if (this.activeTooltip && this.activeQuote?.href === quoteUrl) {
          this.activeTooltip.textContent = 'Error loading post';
        }
      });
  },

  loadQuote(tooltip, quoteUrl) {
    const parts = this.parseQuoteUrl(quoteUrl);
    if (!parts) {
      tooltip.textContent = 'Post not found';
      return;
    }

    const dataKey = `${parts.boardUri}/${parts.postId}`;
    const cached = this.knownData[dataKey];
    if (cached) {
      this.renderPreview(cached, tooltip, quoteUrl);
      return;
    }

    this.loadingPreviews[quoteUrl] = true;

    const archivePrefix = parts.archive ? 'archive/' : '';
    fetch(`/${parts.boardUri}/${archivePrefix}thread/${parts.threadId}.json`)
      .then((r) => {
        if (!r.ok) throw new Error('Thread not found');
        return r.json();
      })
      .then((data) => {
        this.cacheThreadData(data, parts.boardUri);
        const postData = this.knownData[dataKey];
        if (postData) {
          return this.renderPreview(postData, tooltip, quoteUrl);
        }
        if (this.activeTooltip && this.activeQuote?.href === quoteUrl) {
          this.activeTooltip.textContent = 'Post not found';
        }
      })
      .catch(() => {
        if (this.activeTooltip && this.activeQuote?.href === quoteUrl) {
          this.activeTooltip.textContent = 'Post not found';
        }
      })
      .finally(() => {
        delete this.loadingPreviews[quoteUrl];
      });
  },

  processQuote(quote) {
    if (quote.dataset.quoteBound) return;
    quote.dataset.quoteBound = '1';

    quote.onmouseenter = (event) => {
      const quoteUrl = quote.href;
      if (!quoteUrl || quoteUrl.endsWith('#')) return;

      this.lastPointer = { x: event.clientX, y: event.clientY };
      this.hideTooltip();
      this.activeQuote = quote;

      const tooltip = document.createElement('div');
      tooltip.className = 'quote-preview';
      const rect = quote.getBoundingClientRect();
      document.body.appendChild(tooltip);

      this.activeTooltip = tooltip;
      this.startPointerWatch();

      if (this.loadedContent[quoteUrl]) {
        tooltip.innerHTML = this.loadedContent[quoteUrl];
        this.fitTooltip(tooltip, rect);
        return;
      }

      tooltip.textContent = 'Loading...';
      this.fitTooltip(tooltip, rect);

      if (!this.loadingPreviews[quoteUrl]) {
        this.loadQuote(tooltip, quoteUrl);
      }
    };

    quote.onmouseout = () => {
      if (this.activeQuote !== quote) return;
      this.hideTooltip();
      this.activeQuote = null;
    };

    if (document.querySelector('.thread')) {
      const matches = quote.href.match(/#(\d+)/);
      if (matches) {
        quote.onclick = () => {
          if (window.markPost) window.markPost(matches[1]);
        };
      }
    }
  }
};

const backlinks = {
  init() {
    const quoteLinks = document.querySelectorAll('.quoteLink');
    const backlinkMap = new Map();
    const userPostIds = new Set();

    document.querySelectorAll('.name.youName').forEach((nameElement) => {
      const post = nameElement.closest('[data-post-id]');
      if (post) userPostIds.add(post.getAttribute('data-post-id'));
    });

    try {
      const cookieValue = document.cookie.split('; ').find((row) => row.startsWith('postPasswords='));
      if (cookieValue) {
        const passwords = JSON.parse(decodeURIComponent(cookieValue.split('=')[1]));
        Object.keys(passwords).forEach((key) => {
          const parts = key.split('_');
          if (parts.length >= 2) {
            userPostIds.add(parts.length === 3 ? parts[2] : parts[1]);
          }
        });
      }
    } catch (e) {
      console.error('Error parsing postPasswords cookie:', e);
    }

    document.querySelectorAll('[data-post-id]').forEach((post) => {
      const postId = post.getAttribute('data-post-id');
      if (document.cookie.includes(`post_${postId}_password=`)) {
        userPostIds.add(postId);
      }
    });

    const threadId = document.querySelector('.thread')?.getAttribute('data-thread-id') || document.querySelector('.op')?.getAttribute('data-post-id');

    quoteLinks.forEach((link) => {
      const fullUrl = link.getAttribute('href');
      const sourcePost = link.closest('[data-post-id]');
      if (!sourcePost || !fullUrl) return;

      const sourceId = sourcePost.getAttribute('data-post-id');
      const quotedId = fullUrl.split('#')[1];

      if (userPostIds.has(quotedId)) link.classList.add('you');
      if (quotedId === threadId) link.classList.add('opReply');

      if (!backlinkMap.has(quotedId)) backlinkMap.set(quotedId, new Map());
      backlinkMap.get(quotedId).set(sourceId, fullUrl.split('#')[0]);
    });

    backlinkMap.forEach((sourceMap, quotedId) => {
      const quotedPost = document.querySelector(`[data-post-id="${quotedId}"]`);
      if (!quotedPost) return;

      const backlinksDiv = quotedPost.querySelector('.backlinks');
      if (!backlinksDiv) return;

      const links = Array.from(sourceMap.entries()).map(([id, baseUrl]) => {
        let classes = ['backlink'];
        if (userPostIds.has(id)) classes.push('you');
        if (id === threadId) classes.push('opReply');
        const a = document.createElement('a');
        a.className = classes.join(' ');
        a.href = `${baseUrl}#${id}`;
        a.textContent = `>>${id}`;
        return a;
      });

      if (links.length) {
        backlinksDiv.textContent = '';
        links.forEach((a, i) => {
          if (i) backlinksDiv.appendChild(document.createTextNode(' '));
          backlinksDiv.appendChild(a);
          tooltips.processQuote(a);
        });
      }
    });
  }
};

const observer = new MutationObserver((mutations) => {
  clearTimeout(observer.timeout);
  observer.timeout = setTimeout(() => {
    let hasNewNodes = false;
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length) hasNewNodes = true;
    });
    if (!hasNewNodes) return;

    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        tooltips.refreshQuotes(node);
      });
    });
    backlinks.init();
  }, 250);
});

document.addEventListener('DOMContentLoaded', () => {
  tooltips.init();
  backlinks.init();

  // Keep the last known pointer position up to date so the preview can tell
  // when its anchor has slid out from under a (mostly) stationary cursor.
  document.addEventListener('mousemove', (event) => {
    tooltips.lastPointer = { x: event.clientX, y: event.clientY };
  }, { passive: true });

  // Scrolling moves the hovered quote/backlink away from a stationary cursor
  // without firing mouseout, which would otherwise leave the preview stranded.
  // Capture catches scrolling inside nested containers as well as the window.
  window.addEventListener('scroll', () => tooltips.dismiss(), { passive: true, capture: true });

  const thread = document.querySelector('.thread');
  if (thread) {
    observer.observe(thread.parentNode, { childList: true, subtree: true });
  }
});

function getPostPasswords() {
  try {
    const storedPasswords = localStorage.getItem('postingPasswords');
    if (storedPasswords) return JSON.parse(storedPasswords);
  } catch (e) {
    console.error('Error getting passwords from localStorage:', e);
  }
  return {};
}

function savePostPasswords(passwords) {
  try {
    localStorage.setItem('postingPasswords', JSON.stringify(passwords));
  } catch (e) {
    console.error('Error saving passwords to localStorage:', e);
  }
}
