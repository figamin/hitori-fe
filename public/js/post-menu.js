let shownMenuDropdown = null;

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

function getPostPassword(postId, isThread) {
  try {
    const storedPasswords = localStorage.getItem('postingPasswords');
    if (storedPasswords) {
      const passwords = JSON.parse(storedPasswords);
      const boardUri = window.location.pathname.split('/')[1];

      if (isThread) {
        const key = `${boardUri}/${postId}`;
        if (passwords[key]) return passwords[key];
      } else {
        const pathParts = window.location.pathname.split('/');
        if (pathParts.length >= 4 && pathParts[2] === 'thread') {
          const threadId = pathParts[3];
          const key = `${boardUri}/${threadId}/${postId}`;
          if (passwords[key]) return passwords[key];
        } else {
          const replyElement = document.querySelector(`.reply[data-post-id="${postId}"]`);
          if (replyElement) {
            const threadElement = replyElement.closest('.thread');
            if (threadElement) {
              const threadId = threadElement.id || threadElement.dataset.postId;
              if (threadId) {
                const key = `${boardUri}/${threadId}/${postId}`;
                if (passwords[key]) return passwords[key];
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.error('Error getting password from localStorage:', e);
  }

  return null;
}

function getHiddenPosts() {
  const hidden = localStorage.getItem('hiddenPosts');
  return hidden ? JSON.parse(hidden) : {};
}

function setHiddenPosts(hiddenPosts) {
  localStorage.setItem('hiddenPosts', JSON.stringify(hiddenPosts));
}

function closePostMenus() {
  document.querySelectorAll('.dropdown-menu').forEach((menu) => menu.remove());
  document.querySelectorAll('.dropdown-toggle.active').forEach((t) => t.classList.remove('active'));
  shownMenuDropdown = null;
}

function positionMenu(menu, button) {
  const mWidth = menu.offsetWidth;
  const mHeight = menu.offsetHeight;
  const bRect = button.getBoundingClientRect();
  const cHeight = document.documentElement.clientHeight;
  const cWidth = document.documentElement.clientWidth;
  if (bRect.top + bRect.height + mHeight < cHeight) {
    menu.style.top = bRect.bottom + 'px';
    menu.style.bottom = '';
  } else {
    menu.style.top = '';
    menu.style.bottom = cHeight - bRect.top + 'px';
  }
  if (bRect.left + mWidth < cWidth) {
    menu.style.left = bRect.left + 'px';
    menu.style.right = '';
  } else {
    menu.style.left = '';
    menu.style.right = cWidth - bRect.right + 'px';
  }
}

function getPostContext(dropdown) {
  const replyElement = dropdown.closest('.reply');
  const threadElement = dropdown.closest('.op');
  if (replyElement) {
    const parentThread = replyElement.closest('.thread, article');
    const threadId = Number(replyElement.dataset.threadId || parentThread?.id || parentThread?.dataset?.postId);
    const boardUri =
      replyElement.dataset.board ||
      replyElement.querySelector('.name')?.dataset?.board ||
      parentThread?.querySelector('.name')?.dataset?.board ||
      window.location.pathname.split('/')[1];
    return {
      boardUri,
      threadId,
      postId: Number(replyElement.dataset.postId),
      isThread: false,
      postEl: replyElement,
      hasFiles: !!replyElement.querySelector('.file-info, .op-upload-cell')
    };
  }
  if (threadElement) {
    const boardUri =
      threadElement.dataset.board ||
      threadElement.querySelector('.name')?.dataset?.board ||
      window.location.pathname.split('/')[1];
    return {
      boardUri,
      threadId: Number(threadElement.dataset.postId),
      postId: Number(threadElement.dataset.postId),
      isThread: true,
      postEl: threadElement,
      hasFiles: !!threadElement.querySelector('.file-info, .op-upload-cell'),
      pinned: threadElement.dataset.pinned === '1',
      locked: threadElement.dataset.locked === '1',
      autoSage: threadElement.dataset.autosage === '1',
      cyclic: threadElement.dataset.cyclic === '1'
    };
  }
  return null;
}

function createMenuButton(label, action, mod) {
  const btn = document.createElement('a');
  btn.href = 'javascript:;';
  btn.className = mod ? 'dropdown-item mod-menu-item' : 'dropdown-item';
  if (mod) btn.dataset.modAction = action;
  else btn.dataset.action = action;
  btn.textContent = label;
  return btn;
}

function buildPostMenu(ctx) {
  const menu = document.createElement('div');
  menu.className = 'dropdown-menu';

  menu.appendChild(createMenuButton('Report', 'report', false));
  menu.appendChild(createMenuButton('Delete', 'delete', false));
  menu.appendChild(createMenuButton('Hide', 'hide', false));

  if (window.modUser) {
    menu.appendChild(createMenuButton('Spoil Files', 'spoil', true));
    menu.appendChild(createMenuButton('Delete Post and Media', 'delete-media', true));
    menu.appendChild(createMenuButton('Trash Post', 'trash', true));
    if (ctx.hasFiles) menu.appendChild(createMenuButton('Unlink Files', 'unlink', true));
    if (window.modShowIp) menu.appendChild(createMenuButton('Delete by IP/bypass', 'ip-delete', true));
    menu.appendChild(createMenuButton('Ban', 'ban', true));
    menu.appendChild(createMenuButton('Edit', 'edit', true));
    if (ctx.isThread) {
      if (window.modIsGlobalMod) menu.appendChild(createMenuButton('Transfer Thread', 'transfer', true));
      menu.appendChild(createMenuButton('Toggle Lock', 'toggle-lock', true));
      menu.appendChild(createMenuButton('Toggle Autosage', 'toggle-autosage', true));
      menu.appendChild(createMenuButton('Toggle Pin', 'toggle-pin', true));
      menu.appendChild(createMenuButton('Toggle Cyclic', 'toggle-cyclic', true));
      menu.appendChild(createMenuButton('Merge', 'merge', true));
      menu.appendChild(createMenuButton('Archive Thread', 'archive', true));
    }
  }

  return menu;
}

function openPostMenu(toggle, e) {
  e.preventDefault();
  e.stopPropagation();
  const dropdown = toggle.closest('.dropdown');
  if (!dropdown) return;
  if (shownMenuDropdown === dropdown) {
    closePostMenus();
    return;
  }
  closePostMenus();
  const ctx = getPostContext(dropdown);
  if (!ctx) return;
  const menu = buildPostMenu(ctx);
  document.body.appendChild(menu);
  toggle.classList.add('active');
  positionMenu(menu, toggle);
  shownMenuDropdown = dropdown;
  menu.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const modBtn = ev.target.closest('[data-mod-action]');
    const userBtn = ev.target.closest('[data-action]');
    if (modBtn) {
      closePostMenus();
      handleModAction(modBtn.dataset.modAction, dropdown);
    } else if (userBtn) {
      closePostMenus();
      handleAction(userBtn.dataset.action, dropdown);
    }
  });
}

function ensurePostMenuToggle(postEl) {
  if (!postEl || postEl.classList.contains('collapsed-post')) return;
  const postInfo = postEl.querySelector(':scope > .post-info');
  if (!postInfo || postInfo.querySelector('.dropdown')) return;
  const dropdown = document.createElement('div');
  dropdown.className = 'dropdown';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'dropdown-toggle';
  toggle.title = 'Post Menu';
  toggle.textContent = '▶';
  dropdown.appendChild(toggle);
  const postNum = postInfo.querySelector('.post-num');
  if (postNum) {
    postNum.insertAdjacentElement('afterend', dropdown);
  } else {
    postInfo.appendChild(dropdown);
  }
  toggle.dataset.postMenuBound = '1';
  toggle.addEventListener('click', (e) => openPostMenu(toggle, e));
}

function bindPostMenuToggle(toggle) {
  if (toggle.dataset.postMenuBound) return;
  toggle.dataset.postMenuBound = '1';
  toggle.addEventListener('click', (e) => openPostMenu(toggle, e));
}

window.initializePostMenus = function (root) {
  const scope = root || document;
  scope.querySelectorAll('.post.op, .post.reply').forEach(ensurePostMenuToggle);
  scope.querySelectorAll('.dropdown .dropdown-toggle').forEach(bindPostMenuToggle);
};

window.initializeDropdowns = window.initializePostMenus;

document.addEventListener('DOMContentLoaded', function () {
  window.initializePostMenus();
  createModal();
  createBanModal();
  initializeHiddenPosts();
});

document.addEventListener('click', closePostMenus);
window.addEventListener('scroll', closePostMenus, true);
window.addEventListener('resize', closePostMenus);

async function modPost(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: csrfHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function selectionKey(ctx) {
  return ctx.isThread ? `${ctx.boardUri}-${ctx.threadId}` : `${ctx.boardUri}-${ctx.threadId}-${ctx.postId}`;
}

function removePostFromDom(ctx) {
  if (ctx.isThread) {
    const threadContainer =
      document.querySelector(`article.thread[id="${ctx.postId}"], article.textthread[id="${ctx.postId}"]`) ||
      ctx.postEl?.closest('article');
    if (threadContainer) {
      const nextElement = threadContainer.nextElementSibling;
      if (nextElement?.tagName?.toLowerCase() === 'hr') nextElement.remove();
      threadContainer.remove();
    }
  } else {
    ctx.postEl?.remove();
  }
}

window.modStaffDeletePost = async function (postId, isThread, boardUri, threadId) {
  if (!confirm('Delete this post?')) return;
  const selections = isThread ? [`${boardUri}-${threadId}`] : [`${boardUri}-${threadId}-${postId}`];
  try {
    await modPost('/mod/api/content', { action: 'delete', selections });
    if (isThread) {
      const threadContainer = document.querySelector(`article.thread[id="${postId}"], article.textthread[id="${postId}"]`);
      if (threadContainer) {
        const nextElement = threadContainer.nextElementSibling;
        if (nextElement?.tagName?.toLowerCase() === 'hr') nextElement.remove();
        threadContainer.remove();
      }
    } else {
      document.querySelector(`.reply[data-post-id="${postId}"]`)?.remove();
    }
  } catch (err) {
    alert(err.message);
  }
};

let banModalContext = null;

function createBanModal() {
  if (document.getElementById('mod-ban-modal')) return;
  const modal = document.createElement('div');
  modal.id = 'mod-ban-modal';
  modal.style.display = 'none';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="box-outer">
        <div class="boxbar"><h2>Ban</h2></div>
        <div class="boxcontent">
          <p>Duration <input type="text" id="mod-menu-ban-duration" value="5y"></p>
          <p>Ban Message <input type="text" id="mod-menu-ban-message"></p>
          <p>Ban Reason <input type="text" id="mod-menu-ban-reason"></p>
          <p>Ban type
            <select id="mod-menu-ban-type">
              <option value="">IP/Bypass ban</option>
              <option value="1">/16 range</option>
              <option value="2">/24 range</option>
              <option value="3">ASN</option>
              <option value="4">Warning</option>
            </select>
          </p>
          <p><label><input type="checkbox" id="mod-menu-ban-non-bypass"> Non-Bypassable</label> <label><input type="checkbox" id="mod-menu-ban-global"> Global</label></p>
          <button type="button" id="mod-menu-ban-submit">Ban</button>
          <button type="button" id="mod-menu-ban-delete-submit">Ban and delete</button>
          <button type="button" id="mod-menu-ban-cancel">Cancel</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('mod-menu-ban-cancel').addEventListener('click', () => {
    modal.style.display = 'none';
    banModalContext = null;
  });
  document.getElementById('mod-menu-ban-submit').addEventListener('click', () => runBanFromModal('ban'));
  document.getElementById('mod-menu-ban-delete-submit').addEventListener('click', () => runBanFromModal('ban-delete'));
}

function banPayload(action) {
  if (!banModalContext) throw new Error('No post selected');
  const banTypeVal = document.getElementById('mod-menu-ban-type').value;
  return {
    action,
    selections: [selectionKey(banModalContext)],
    reason: document.getElementById('mod-menu-ban-reason')?.value,
    duration: document.getElementById('mod-menu-ban-duration')?.value,
    banMessage: document.getElementById('mod-menu-ban-message')?.value,
    banType: banTypeVal ? Number(banTypeVal) : undefined,
    globalBan: document.getElementById('mod-menu-ban-global')?.checked,
    nonBypassable: document.getElementById('mod-menu-ban-non-bypass')?.checked
  };
}

async function runBanFromModal(action) {
  try {
    await modPost('/mod/api/content', banPayload(action));
    document.getElementById('mod-ban-modal').style.display = 'none';
    if (action === 'ban-delete') removePostFromDom(banModalContext);
    banModalContext = null;
    if (action === 'ban-delete') return;
    location.reload();
  } catch (err) {
    alert(err.message);
  }
}

function showBanModal(ctx) {
  createBanModal();
  banModalContext = ctx;
  document.getElementById('mod-ban-modal').style.display = 'block';
}

async function runContentAction(ctx, action) {
  await modPost('/mod/api/content', { action, selections: [selectionKey(ctx)] });
}

async function unlinkAllFiles(ctx) {
  const count = ctx.postEl.querySelectorAll('.file-info').length;
  if (!count) return;
  for (let i = count - 1; i >= 0; i--) {
    await modPost('/mod/api/file/unlink', {
      boardUri: ctx.boardUri,
      threadId: ctx.threadId,
      postId: ctx.postId,
      fileIndex: i
    });
  }
}

async function handleModAction(action, dropdown) {
  const ctx = getPostContext(dropdown);
  if (!ctx) return;

  try {
    switch (action) {
      case 'spoil':
        if (!confirm('Spoil files on this post?')) return;
        await runContentAction(ctx, 'spoil');
        location.reload();
        break;
      case 'delete-media':
        if (!confirm('Delete this post and media?')) return;
        await runContentAction(ctx, 'delete');
        removePostFromDom(ctx);
        break;
      case 'trash':
        if (!confirm('Trash this post?')) return;
        await runContentAction(ctx, 'trash');
        removePostFromDom(ctx);
        break;
      case 'unlink':
        if (!confirm('Unlink all files from this post?')) return;
        await unlinkAllFiles(ctx);
        location.reload();
        break;
      case 'ip-delete': {
        const threadOnly = confirm('OK = delete by IP on this thread only\nCancel = delete by IP on entire board');
        if (!confirm('Confirm IP deletion?')) return;
        await modPost('/mod/api/content', {
          action: 'ip-deletion',
          selections: [selectionKey(ctx)],
          confirmation: true,
          threadOnly
        });
        location.reload();
        break;
      }
      case 'ban':
        showBanModal(ctx);
        break;
      case 'edit': {
        const contentEl = ctx.postEl.querySelector('.reply-content, .thread-content');
        const message = prompt('Edit message', contentEl?.textContent || '');
        if (message == null) return;
        await modPost('/mod/api/edit', {
          boardUri: ctx.boardUri,
          threadId: ctx.threadId,
          postId: ctx.postId,
          message,
          isThread: ctx.isThread
        });
        location.reload();
        break;
      }
      case 'transfer': {
        const targetBoard = prompt('Transfer thread to board (uri):');
        if (!targetBoard) return;
        await modPost('/mod/api/thread/transfer', {
          boardUri: ctx.boardUri,
          threadId: ctx.threadId,
          targetBoard: targetBoard.trim()
        });
        location.reload();
        break;
      }
      case 'toggle-lock':
        await modPost('/mod/api/thread-settings', {
          boardUri: ctx.boardUri,
          threadId: ctx.threadId,
          locked: !ctx.locked
        });
        location.reload();
        break;
      case 'toggle-autosage':
        await modPost('/mod/api/thread-settings', {
          boardUri: ctx.boardUri,
          threadId: ctx.threadId,
          autoSage: !ctx.autoSage
        });
        location.reload();
        break;
      case 'toggle-pin':
        await modPost('/mod/api/thread-settings', {
          boardUri: ctx.boardUri,
          threadId: ctx.threadId,
          pinned: !ctx.pinned
        });
        location.reload();
        break;
      case 'toggle-cyclic':
        await modPost('/mod/api/thread-settings', {
          boardUri: ctx.boardUri,
          threadId: ctx.threadId,
          cyclic: !ctx.cyclic
        });
        location.reload();
        break;
      case 'merge': {
        const targetThreadId = prompt('Merge into thread ID:');
        if (!targetThreadId) return;
        if (!confirm(`Merge thread ${ctx.threadId} into ${targetThreadId}?`)) return;
        await modPost('/mod/api/thread/merge', {
          boardUri: ctx.boardUri,
          threadId: ctx.threadId,
          targetThreadId: Number(targetThreadId)
        });
        location.reload();
        break;
      }
      case 'archive':
        if (!confirm(`Archive thread ${ctx.threadId}?`)) return;
        await modPost('/mod/api/thread/archive', {
          boardUri: ctx.boardUri,
          threadId: ctx.threadId
        });
        if (/\/thread\//.test(window.location.pathname)) {
          location.href = `/${ctx.boardUri}/`;
        } else {
          removePostFromDom(ctx);
        }
        break;
      default:
        break;
    }
  } catch (err) {
    alert(err.message);
  }
}

function createModal() {
  const modal = document.createElement('div');
  modal.id = 'delete-modal';
  modal.style.display = 'none';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="box-outer">
        <div class="boxbar"><h2>Delete Post</h2></div>
        <div class="boxcontent">
          <div class="error-message" style="display: block; color: red; margin: 10px 0px; font-weight: bold;margin-top: 0;"></div>
          <input id="delete-password" placeholder="Enter post password">
          <button id="confirm-delete">Delete</button>
          <button id="cancel-delete">Cancel</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const reportModal = document.createElement('div');
  reportModal.id = 'report-modal';
  reportModal.style.display = 'none';
  reportModal.innerHTML = `
    <div class="modal-content">
      <div class="box-outer">
        <div class="boxbar"><h2>Report Post</h2></div>
        <div class="boxcontent">
          <div class="error-message" style="display: none; color: red; margin-bottom: 10px;"></div>
          <select id="report-category" style="margin-bottom: 10px; width: 100%;">
            <option value="">Select a category...</option>
          </select>
          <textarea id="report-reason" placeholder="Enter reason (max 256 characters)" 
            maxlength="256" style="width: 100%; margin-bottom: 10px;"></textarea>
          <button id="confirm-report">Submit Report</button>
          <button id="cancel-report">Cancel</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(reportModal);

  const categorySelect = reportModal.querySelector('#report-category');
  (window.reportCategories || []).forEach((cat) => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    categorySelect.appendChild(opt);
  });
}

function handleAction(action, dropdown) {
  const ctx = getPostContext(dropdown);
  if (!ctx) return;

  const { postId, isThread, boardUri, threadId } = ctx;

  switch (action) {
    case 'delete':
      if (window.modUser && typeof window.modStaffDeletePost === 'function') {
        window.modStaffDeletePost(postId, isThread, boardUri, threadId);
        break;
      }
      {
        const savedPassword = getPostPassword(postId, isThread);
        if (savedPassword) {
          deletePost(postId, savedPassword, isThread, boardUri);
        } else {
          showDeleteModal(postId, isThread);
        }
      }
      break;
    case 'report':
      showReportModal(postId, boardUri, isThread);
      break;
    case 'hide':
      hidePost(postId, isThread);
      break;
  }
}

function showDeleteModal(postId, isThread, errorMessage = '') {
  const modal = document.getElementById('delete-modal');
  const passwordInput = document.getElementById('delete-password');
  const confirmButton = document.getElementById('confirm-delete');
  const cancelButton = document.getElementById('cancel-delete');
  const errorDisplay =
    modal.querySelector('.error-message') ||
    (() => {
      const err = document.createElement('div');
      err.className = 'error-message';
      modal.querySelector('.boxcontent').appendChild(err);
      return err;
    })();

  modal.style.display = 'block';
  passwordInput.value = '';
  passwordInput.focus();
  errorDisplay.textContent = errorMessage;
  errorDisplay.style.display = errorMessage ? 'block' : 'none';

  const handleDelete = () => {
    const password = passwordInput.value;
    const boardUri = window.location.pathname.split('/')[1];
    deletePost(postId, password, isThread, boardUri);
  };

  const handleCancel = () => {
    modal.style.display = 'none';
  };

  confirmButton.onclick = handleDelete;
  cancelButton.onclick = handleCancel;

  passwordInput.onkeyup = (e) => {
    if (e.key === 'Enter') handleDelete();
    if (e.key === 'Escape') handleCancel();
  };
}

async function deletePost(postId, password, isThread, boardUri) {
  try {
    const response = await fetch('/api/delete-post', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ postId, password, isThread, boardUri })
    });

    const result = await response.json();

    if (result.success) {
      if (isThread) {
        const threadContainer = document.querySelector(`article.thread[id="${postId}"]`);
        if (threadContainer) {
          const nextElement = threadContainer.nextElementSibling;
          if (nextElement && nextElement.tagName.toLowerCase() === 'hr') {
            nextElement.remove();
          }
          threadContainer.remove();
        }
      } else {
        const replyElement = document.querySelector(`.reply[data-post-id="${postId}"]`);
        if (replyElement) {
          replyElement.remove();
        }
      }

      const modal = document.getElementById('delete-modal');
      if (modal) {
        modal.style.display = 'none';
      }
    } else {
      showDeleteModal(postId, isThread, result.message);
    }
  } catch (error) {
    console.error('Delete error:', error);
    showError(postId, 'An error occurred while deleting the post');
  }
}

function showError(postId, message) {
  const postElement = document.querySelector(`[data-post-id="${postId}"]`);
  if (postElement) {
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.textContent = message;
    postElement.appendChild(errorElement);
    setTimeout(() => errorElement.remove(), 3000);
  }
}

function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 3000);
}

function showReportModal(postId, boardUri, isThread) {
  const modal = document.getElementById('report-modal');
  const reasonInput = document.getElementById('report-reason');
  const categorySelect = document.getElementById('report-category');
  const confirmButton = document.getElementById('confirm-report');
  const cancelButton = document.getElementById('cancel-report');
  const errorDisplay = modal.querySelector('.error-message');

  modal.style.display = 'block';
  reasonInput.value = '';
  categorySelect.value = '';
  errorDisplay.style.display = 'none';

  const handleReport = () => {
    const reason = reasonInput.value.trim();
    const category = categorySelect.value;

    if (!category) {
      errorDisplay.textContent = 'Please select a category';
      errorDisplay.style.display = 'block';
      return;
    }

    if (!reason) {
      errorDisplay.textContent = 'Please enter a reason';
      errorDisplay.style.display = 'block';
      return;
    }

    submitReport(postId, boardUri, reason, category, isThread, modal);
  };

  const handleCancel = () => {
    modal.style.display = 'none';
  };

  confirmButton.onclick = handleReport;
  cancelButton.onclick = handleCancel;
}

async function submitReport(postId, boardUri, reason, category, isThread, modal) {
  try {
    const response = await fetch('/api/report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        postId,
        boardUri,
        reason,
        category,
        isThread,
        global: false
      })
    });

    const result = await response.json();

    if (result.success) {
      modal.style.display = 'none';
      showNotification('Report submitted successfully');
    } else {
      const errorDisplay = modal.querySelector('.error-message');
      errorDisplay.textContent = result.message;
      errorDisplay.style.display = 'block';
    }
  } catch (error) {
    console.error('Report error:', error);
    showError(postId, 'An error occurred while submitting the report');
  }
}

function hidePost(postId, isThread) {
  const hiddenPosts = getHiddenPosts();
  const postElement = isThread
    ? document.querySelector(`.thread[id="${postId}"]`)
    : document.querySelector(`.reply[data-post-id="${postId}"]`);

  if (!postElement) return;

  const postInfo = postElement.querySelector('.post-info');
  const name = postInfo.querySelector('.name')?.textContent || 'Anonymous';
  const time = postInfo.querySelector('.time-info')?.textContent || '';
  const originalContent = postElement.outerHTML;

  hiddenPosts[postId] = {
    isThread,
    name,
    time,
    hidden: true,
    originalContent
  };

  setHiddenPosts(hiddenPosts);
  replaceWithCollapsed(postElement, postId, name, time, isThread);
}

function replaceWithCollapsed(postElement, postId, name, time, isThread) {
  const collapsedDiv = document.createElement('div');
  collapsedDiv.className = isThread ? 'thread collapsed-post' : 'reply collapsed-post';
  collapsedDiv.setAttribute('data-post-id', postId);

  collapsedDiv.innerHTML = `
    <div class="post-info">
      <span class="name">${name}</span>
      <span class="time-info">${time}</span>
      <a href="#" class="expand-post">[+]</a>
    </div>
  `;

  collapsedDiv.querySelector('.expand-post').addEventListener('click', (e) => {
    e.preventDefault();
    unhidePost(postId, isThread);
  });

  if (isThread) {
    const nextHr = postElement.nextElementSibling;
    if (nextHr && nextHr.tagName.toLowerCase() === 'hr') {
      nextHr.remove();
    }
  }

  postElement.replaceWith(collapsedDiv);
}

function unhidePost(postId, isThread) {
  const hiddenPosts = getHiddenPosts();
  const postData = hiddenPosts[postId];

  if (!postData) return;

  const collapsedElement = document.querySelector(`.collapsed-post[data-post-id="${postId}"]`);
  if (!collapsedElement) return;

  const tempContainer = document.createElement('div');
  tempContainer.innerHTML = postData.originalContent;
  const originalPost = tempContainer.firstChild;

  collapsedElement.replaceWith(originalPost);

  delete hiddenPosts[postId];
  setHiddenPosts(hiddenPosts);

  window.initializePostMenus(originalPost);

  document.dispatchEvent(new CustomEvent('contentAdded', { detail: originalPost }));
}

function initializeHiddenPosts() {
  const hiddenPosts = getHiddenPosts();

  Object.entries(hiddenPosts).forEach(([postId, data]) => {
    if (!data.hidden) return;

    const postElement = data.isThread
      ? document.querySelector(`.thread[id="${postId}"]`)
      : document.querySelector(`.reply[data-post-id="${postId}"]`);

    if (postElement) {
      replaceWithCollapsed(postElement, postId, data.name, data.time, data.isThread);
    }
  });
}
