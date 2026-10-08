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

function selectedKeys() {
  return [...document.querySelectorAll('.mod-select:checked')].map((el) => el.value);
}

document.getElementById('emergency-toggle')?.addEventListener('click', async () => {
  if (!confirm('Toggle emergency mode?')) return;
  try {
    const data = await modPost('/mod/api/emergency', {});
    location.reload();
  } catch (err) {
    alert(err.message);
  }
});

// The news editor (`/mod/news`) has its own script: public/js/mod-news.js.

document.getElementById('mod-login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    const data = await modPost('/mod/api/login', Object.fromEntries(fd));
    location.href = data.redirect || '/mod';
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('mod-logout')?.addEventListener('click', async () => {
  await modPost('/mod/api/logout', {});
  location.href = '/mod/login';
});

function banPayload(action) {
  const selections = selectedKeys();
  if (!selections.length) throw new Error('Select posts');
  return {
    action,
    selections,
    reason: document.getElementById('mod-ban-reason')?.value,
    duration: document.getElementById('mod-ban-duration')?.value,
    banMessage: document.getElementById('mod-ban-message')?.value,
    banType: document.getElementById('mod-ban-type')?.value
      ? Number(document.getElementById('mod-ban-type').value)
      : undefined,
    globalBan: document.getElementById('mod-ban-global')?.checked,
    nonBypassable: document.getElementById('mod-ban-non-bypass')?.checked
  };
}

document.getElementById('mod-ban')?.addEventListener('click', async () => {
  try {
    await modPost('/mod/api/content', banPayload('ban'));
    location.reload();
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('mod-ban-delete')?.addEventListener('click', async () => {
  try {
    await modPost('/mod/api/content', banPayload('ban-delete'));
    location.reload();
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('mod-spoil-files')?.addEventListener('click', async () => {
  const selections = selectedKeys();
  if (!selections.length) return alert('Select posts');
  try {
    await modPost('/mod/api/content', { action: 'spoil', selections });
    location.reload();
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('mod-ip-delete-board')?.addEventListener('click', async () => {
  const selections = selectedKeys();
  if (!selections.length) return alert('Select posts');
  if (!document.getElementById('mod-ip-delete-confirm')?.checked) return alert('Confirm ip deletion');
  try {
    await modPost('/mod/api/content', { action: 'ip-deletion', selections, confirmation: true, threadOnly: false });
    location.reload();
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('mod-ip-delete-thread')?.addEventListener('click', async () => {
  const selections = selectedKeys();
  if (!selections.length) return alert('Select posts');
  if (!document.getElementById('mod-ip-delete-confirm')?.checked) return alert('Confirm ip deletion');
  if (!window.modThreadId) return alert('Open a thread to delete by IP on thread');
  try {
    await modPost('/mod/api/content', { action: 'ip-deletion', selections, confirmation: true, threadOnly: true });
    location.reload();
  } catch (err) {
    alert(err.message);
  }
});

// `[Edit]` is handled by `public/js/edit-post.js` (a popup with the post's markup, a
// raw-HTML switch and a live preview under the post).

document.getElementById('mod-save-settings')?.addEventListener('click', async () => {
  try {
    await modPost('/mod/api/thread-settings', {
      boardUri: window.modBoardUri,
      threadId: window.modThreadId,
      pinned: document.getElementById('set-pinned').checked,
      locked: document.getElementById('set-locked').checked,
      cyclic: document.getElementById('set-cyclic').checked
    });
    alert('Saved');
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('mod-close-reports')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const ids = [...document.querySelectorAll('.report-select:checked')].flatMap((el) => el.dataset.ids.split(','));
  if (!ids.length) return alert('Select reports');
  const fd = new FormData(e.target);
  try {
    await modPost('/mod/api/reports/close', {
      reportIds: ids,
      banTarget: fd.get('banTarget'),
      duration: fd.get('banDuration'),
      banReason: fd.get('banReason'),
      deleteContent: !!fd.get('deleteContent')
    });
    location.reload();
  } catch (err) {
    alert(err.message);
  }
});

document.querySelectorAll('.lift-ban').forEach((btn) => {
  btn.addEventListener('click', async () => {
    try {
      await modPost('/mod/api/bans/lift', { banId: btn.dataset.id });
      location.reload();
    } catch (err) {
      alert(err.message);
    }
  });
});

document.querySelectorAll('.appeal-action').forEach((btn) => {
  btn.addEventListener('click', async () => {
    try {
      await modPost('/mod/api/bans/appeal', { banId: btn.dataset.id, action: btn.dataset.action });
      location.reload();
    } catch (err) {
      alert(err.message);
    }
  });
});

document.getElementById('mass-ban-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    await modPost('/mod/api/bans/mass', Object.fromEntries(fd));
    location.reload();
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('range-ban-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    await modPost('/mod/api/bans/range', Object.fromEntries(fd));
    location.reload();
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('hash-ban-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    await modPost('/mod/api/bans/hash', Object.fromEntries(fd));
    location.reload();
  } catch (err) {
    alert(err.message);
  }
});

document.querySelectorAll('.lift-hash-ban').forEach((btn) => {
  btn.addEventListener('click', async () => {
    try {
      await modPost('/mod/api/bans/hash', { action: 'lift', sha256: btn.dataset.sha, boardUri: btn.dataset.board || null });
      location.reload();
    } catch (err) {
      alert(err.message);
    }
  });
});

document.getElementById('asn-ban-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    await modPost('/mod/api/bans/asn', Object.fromEntries(fd));
    location.reload();
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('restore-selected')?.addEventListener('click', async () => {
  const selections = selectedKeys();
  if (!selections.length) return alert('Select items');
  try {
    await modPost('/mod/api/trash/restore', { selections });
    location.reload();
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('media-mass-delete-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const identifiers = [...document.querySelectorAll('.media-select:checked')].map((el) => el.value);
  const text = fd.get('identifiers');
  if (!identifiers.length && !text?.trim()) return alert('Select files or paste identifiers');
  try {
    await modPost('/mod/api/media/delete', {
      identifiers,
      text,
      ban: fd.get('ban') ? '1' : '',
      reason: fd.get('reason')
    });
    location.reload();
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('change-password-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    await modPost('/mod/api/account/password', Object.fromEntries(fd));
    alert('Password changed');
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('board-create-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    const data = await modPost('/mod/api/board/create', Object.fromEntries(fd));
    location.href = '/mod/board/' + data.boardUri + '/settings';
  } catch (err) {
    alert(err.message);
  }
});

// Deleting a board takes every thread, post and uploaded file of it and cannot be
// undone, so it goes through a popup that names the board first. The link is only
// rendered for admins (`be/lib/mod/boards.js#deleteBoard`, the endpoint behind it is
// `requireAdmin` too).
let boardDeleteModal = null;
let boardDeleteUri = null;

function buildBoardDeleteModal() {
  if (boardDeleteModal) return boardDeleteModal;

  const modal = document.createElement('div');
  modal.id = 'board-delete-modal';
  modal.innerHTML =
    '<div class="modal-content">' +
    '<div class="box-outer">' +
    '<div class="boxbar"><h2>Delete board</h2></div>' +
    '<div class="boxcontent">' +
    '<p><strong id="board-delete-question"></strong></p>' +
    '<p class="file-info">Every thread, post, quote and uploaded file of this board is deleted. This cannot be undone.</p>' +
    '<button type="button" id="board-delete-confirm">Delete board</button>' +
    '<button type="button" id="board-delete-cancel">Cancel</button>' +
    '<p class="file-info" id="board-delete-status"></p>' +
    '</div></div></div>';

  document.body.appendChild(modal);
  modal.querySelector('#board-delete-cancel').addEventListener('click', () => {
    modal.style.display = 'none';
    boardDeleteUri = null;
  });
  modal.querySelector('#board-delete-confirm').addEventListener('click', async () => {
    if (!boardDeleteUri) return;
    const confirmButton = modal.querySelector('#board-delete-confirm');
    const status = modal.querySelector('#board-delete-status');
    confirmButton.disabled = true;
    status.textContent = 'Deleting…';
    try {
      await modPost('/mod/api/board/delete', { boardUri: boardDeleteUri });
      location.href = '/mod';
    } catch (err) {
      status.textContent = err.message;
      confirmButton.disabled = false;
    }
  });

  boardDeleteModal = modal;
  return modal;
}

document.addEventListener('click', (e) => {
  const target = e.target instanceof Element ? e.target : e.target.parentElement;
  const link = target?.closest?.('.board-delete');
  if (!link) return;
  e.preventDefault();

  const modal = buildBoardDeleteModal();
  boardDeleteUri = link.dataset.board;
  // textContent, not innerHTML: a board name is whatever somebody typed into it.
  modal.querySelector('#board-delete-question').textContent = `Delete /${link.dataset.board}/ - ${link.dataset.name}?`;
  modal.querySelector('#board-delete-status').textContent = '';
  modal.querySelector('#board-delete-confirm').disabled = false;
  modal.style.display = 'block';
});

document.getElementById('board-settings-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const data = Object.fromEntries(fd);
  for (const key of [
    'disableIds',
    'forceAnonymity',
    'textBoard',
    'blockDeletion',
    'requireThreadFile'
  ]) {
    data[key] = fd.get(key) ? '1' : '';
  }
  try {
    await modPost('/mod/api/board/settings', data);
    await alert('Saved');
    location.reload();
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('volunteer-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const submitter = e.submitter;
  try {
    await modPost('/mod/api/board/volunteer', {
      boardUri: fd.get('boardUri'),
      login: fd.get('login'),
      add: submitter?.value === '1'
    });
    location.reload();
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('filter-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const data = Object.fromEntries(fd);
  if (fd.get('caseInsensitive')) data.caseInsensitive = true;
  try {
    await modPost('/mod/api/filters', data);
    location.reload();
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('global-filter-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const data = Object.fromEntries(fd);
  if (fd.get('caseInsensitive')) data.caseInsensitive = true;
  try {
    await modPost('/mod/api/filters', data);
    location.reload();
  } catch (err) {
    alert(err.message);
  }
});

document.querySelectorAll('.delete-global-filter').forEach((btn) => {
  btn.addEventListener('click', async () => {
    if (!confirm('Delete this filter?')) return;
    try {
      await modPost('/mod/api/filters', { action: 'delete', filterId: btn.dataset.id });
      location.reload();
    } catch (err) {
      alert(err.message);
    }
  });
});

const bannerInput = document.querySelector('#banner-upload-form input[type="file"]');
bannerInput?.addEventListener('change', () => {
  const status = document.getElementById('banner-upload-status');
  if (!status) return;
  const count = bannerInput.files ? bannerInput.files.length : 0;
  status.textContent = count ? `${count} file${count === 1 ? '' : 's'} selected` : '';
});

document.getElementById('banner-upload-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const files = [...((e.target.querySelector('input[type="file"]') || {}).files || [])];
  if (!files.length) return alert('Select at least one banner');
  try {
    const res = await fetch('/mod/api/global/banners', { method: 'POST', headers: csrfHeaders(), body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    if (data.skipped?.length) {
      await alert(`Uploaded ${data.count} banner(s).\nSkipped:\n${data.skipped.join('\n')}`);
    }
    location.reload();
  } catch (err) {
    alert(err.message);
  }
});

document.querySelectorAll('.delete-banner').forEach((btn) => {
  btn.addEventListener('click', async () => {
    if (!confirm('Delete this banner?')) return;
    try {
      await modPost('/mod/api/global/banners/delete', { fileId: btn.dataset.id });
      location.reload();
    } catch (err) {
      alert(err.message);
    }
  });
});

document.querySelectorAll('.delete-filter').forEach((btn) => {
  btn.addEventListener('click', async () => {
    try {
      await modPost('/mod/api/filters', { action: 'delete', filterId: btn.dataset.id });
      location.reload();
    } catch (err) {
      alert(err.message);
    }
  });
});

document.getElementById('add-account-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    await modPost('/mod/api/global/account', Object.fromEntries(fd));
    location.reload();
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('clear-ip-role-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    await modPost('/mod/api/global/clear-ip-role', Object.fromEntries(fd));
    location.reload();
  } catch (err) {
    alert(err.message);
  }
});

// The captcha switch lives here as well as on its own page (Mod -> Captcha), where the
// picture, the character names and the ImageMagick settings are.
document.getElementById('captcha-global-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    const data = await modPost('/mod/api/captcha/settings', { enabled: fd.get('enabled') === 'true' });
    await alert(data.message || 'Saved.');
    location.reload();
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('site-announcement-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    await modPost('/mod/api/global/announcement', Object.fromEntries(fd));
    location.reload();
  } catch (err) {
    alert(err.message);
  }
});

document.querySelectorAll('.apply-role').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const select = document.querySelector(`.set-role[data-login="${btn.dataset.login}"]`);
    try {
      await modPost('/mod/api/global/role', { login: btn.dataset.login, role: select.value });
      location.reload();
    } catch (err) {
      alert(err.message);
    }
  });
});

document.getElementById('thumb-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    const res = await fetch('/mod/api/thumbs', { method: 'POST', headers: csrfHeaders(), body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    location.reload();
  } catch (err) {
    alert(err.message);
  }
});

document.querySelectorAll('.delete-thumb').forEach((btn) => {
  btn.addEventListener('click', async () => {
    if (!confirm('Delete this thumb?')) return;
    try {
      await modPost('/mod/api/thumbs/delete', { thumbId: btn.dataset.id });
      location.reload();
    } catch (err) {
      alert(err.message);
    }
  });
});
