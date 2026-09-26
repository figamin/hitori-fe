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

document.getElementById('news-create-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const data = Object.fromEntries(fd);
  if (data.date) data.date = new Date(data.date).toISOString();
  try {
    const result = await modPost('/mod/api/news', data);
    location.href = '/mod/news?edit=' + result.newsPost.newsId;
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('news-edit-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const data = Object.fromEntries(fd);
  if (data.date) data.date = new Date(data.date).toISOString();
  try {
    await modPost('/mod/api/news/update', data);
    location.reload();
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('news-delete-btn')?.addEventListener('click', async (e) => {
  if (!confirm('Delete this news post?')) return;
  try {
    await modPost('/mod/api/news/delete', { newsId: Number(e.target.dataset.id) });
    location.href = '/mod/news';
  } catch (err) {
    alert(err.message);
  }
});

function updateNewsPreview() {
  const form = document.getElementById('news-create-form') || document.getElementById('news-edit-form');
  const preview = document.getElementById('news-preview-content');
  if (!form || !preview) return;
  const title = form.querySelector('[name=title]')?.value || '';
  const author = form.querySelector('[name=author]')?.value || '';
  const contents = form.querySelector('[name=contents]')?.value || '';
  const image = form.querySelector('[name=image]')?.value || '';
  let html = `<div class="news-title"><span style="text-transform: uppercase;">${escapeHtml(title)}</span> by ${escapeHtml(author)}</div>`;
  html += `<div class="news-content">${contents}`;
  if (image) html += `<p style="text-align:center;"><img src="${escapeHtml(image)}" width="400"></p>`;
  html += '</div>';
  preview.innerHTML = html;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

document.getElementById('news-create-form')?.addEventListener('input', updateNewsPreview);
document.getElementById('news-edit-form')?.addEventListener('input', updateNewsPreview);

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

document.addEventListener('click', async (e) => {
  const target = e.target instanceof Element ? e.target : e.target.parentElement;
  if (!target) return;

  const edit = target.closest('.mod-edit-post');
  if (edit) {
    e.preventDefault();
    const container = edit.closest('.reply, .op');
    const contentEl = container?.querySelector('.reply-content, .thread-content');
    const message = prompt('Edit message', contentEl?.textContent || '');
    if (message == null) return;
    try {
      await modPost('/mod/api/edit', {
        boardUri: edit.dataset.board,
        threadId: Number(edit.dataset.thread),
        postId: Number(edit.dataset.post),
        message,
        isThread: edit.dataset.threadPost === '1'
      });
      location.reload();
    } catch (err) {
      alert(err.message);
    }
    return;
  }

});

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
    alert('Saved');
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
      alert(`Uploaded ${data.count} banner(s).\nSkipped:\n${data.skipped.join('\n')}`);
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
