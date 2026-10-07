// The captcha panel (Mod -> Captcha). Everything here is admin-only on the server side too;
// this script only talks to those endpoints and keeps the page in step with the answers.
(() => {
  const post = async (url, body, { form } = {}) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: form ? csrfHeaders() : csrfHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
      body: form ? body : JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  };

  const say = (id, text, ok = true) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('captcha-bad', !ok);
  };

  const number = (form, name) => {
    const raw = new FormData(form).get(name);
    return raw === null || raw === '' ? undefined : Number(raw);
  };
  const checked = (form, name) => form.querySelector(`[name="${name}"]`)?.checked === true;

  // ------------------------------------------------------------------ the service itself
  const stateOf = (status) => {
    if (status.running && status.managed) return `running (started by Koshi, pid ${status.pid || '?'})`;
    if (status.running) return 'running (started outside Koshi)';
    return `not running${status.error ? ` - ${status.error}` : ''}`;
  };

  document.querySelectorAll('.captcha-service-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      say('captcha-service-message', 'Working…');
      try {
        const data = await post('/mod/api/captcha/service', { action: button.dataset.action });
        const state = document.getElementById('captcha-service-state');
        if (state) state.textContent = stateOf(data.status);
        say('captcha-service-message', data.message || 'ok');
      } catch (err) {
        say('captcha-service-message', err.message, false);
      } finally {
        button.disabled = false;
      }
    });
  });

  document.getElementById('captcha-log-btn')?.addEventListener('click', async () => {
    try {
      const res = await fetch('/mod/api/captcha/log?lines=60', { headers: csrfHeaders({ Accept: 'application/json' }) });
      const data = await res.json();
      const pre = document.getElementById('captcha-log');
      if (!pre) return;
      pre.textContent = data.lines || '(the log is empty)';
      pre.hidden = false;
    } catch (err) {
      say('captcha-service-message', err.message, false);
    }
  });

  // ------------------------------------------------------------- when it is asked for
  document.getElementById('captcha-settings-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target;
    try {
      const data = await post('/mod/api/captcha/settings', {
        enabled: checked(form, 'enabled'),
        autostart: checked(form, 'autostart'),
        sessionMinutes: number(form, 'sessionMinutes'),
        bypassMinRole: number(form, 'bypassMinRole'),
        url: new FormData(form).get('url')
      });
      say('captcha-settings-message', `${data.message} Solving is good for ${data.settings.sessionMinutes} minutes.`);
    } catch (err) {
      say('captcha-settings-message', err.message, false);
    }
  });

  // ---------------------------------------------------------------- pictures (config.toml)
  document.getElementById('captcha-create-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target;
    const numberNames = ['noise_min', 'noise_max', 'aspect_min', 'aspect_max', 'blur', 'rotation', 'brightness', 'saturation', 'hue_min', 'hue_max', 'compress'];
    try {
      const data = await post('/mod/api/captcha/config', {
        captcha: {
          use_local: new FormData(form).get('use_local') === 'true',
          other_tags: new FormData(form).get('other_tags')
        },
        image: {
          ...Object.fromEntries(numberNames.map((name) => [name, number(form, name)])),
          enable_xyz_transform: checked(form, 'enable_xyz_transform')
        }
      });
      say('captcha-create-message', data.message);
    } catch (err) {
      say('captcha-create-message', err.message, false);
    }
  });

  document.getElementById('captcha-characters-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target;
    try {
      const data = await post('/mod/api/captcha/characters', {
        pool: new FormData(form).get('pool'),
        text: new FormData(form).get('text')
      });
      say('captcha-characters-message', data.message);
    } catch (err) {
      say('captcha-characters-message', err.message, false);
    }
  });

  // ------------------------------------------------------------------ pictures per category
  const rowOf = (category) => document.querySelector(`#captcha-images-table tr[data-category="${CSS.escape(category)}"]`);

  const setCount = (category, count) => {
    const row = rowOf(category);
    if (!row) return;
    const countEl = row.querySelector('.captcha-count');
    if (countEl) countEl.textContent = String(count);
    const button = row.querySelector('.captcha-show-images');
    if (button) button.disabled = count === 0;
  };

  const showImages = async (category) => {
    const row = rowOf(category);
    if (!row) return;
    const cell = row.querySelector('.captcha-image-list');
    const list = cell.querySelector('.captcha-files');
    if (list) {
      list.remove();
      return;
    }
    const res = await fetch(`/mod/api/captcha/images?category=${encodeURIComponent(category)}`, { headers: csrfHeaders({ Accept: 'application/json' }) });
    const data = await res.json();
    const box = document.createElement('div');
    box.className = 'captcha-files';
    for (const image of data.images || []) {
      const item = document.createElement('span');
      item.className = 'captcha-file';
      item.innerHTML = `<span class="captcha-file-name">${image.name}</span> <span class="captcha-file-size">${Math.round(image.size / 1024)} KB</span> `;
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'delete';
      button.addEventListener('click', async () => {
        if (!confirm(`Delete ${image.name} from ${category}?`)) return;
        try {
          const result = await post('/mod/api/captcha/images/delete', { category, name: image.name });
          item.remove();
          setCount(category, (result.images || []).length);
          say('captcha-images-message', result.message);
        } catch (err) {
          say('captcha-images-message', err.message, false);
        }
      });
      item.appendChild(button);
      box.appendChild(item);
    }
    if (!box.childElementCount) box.textContent = 'no pictures';
    cell.appendChild(box);
  };

  document.querySelectorAll('.captcha-show-images').forEach((button) => {
    button.addEventListener('click', () => showImages(button.dataset.category).catch((err) => say('captcha-images-message', err.message, false)));
  });

  document.getElementById('captcha-images-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target;
    const category = new FormData(form).get('category');
    try {
      const data = await post('/mod/api/captcha/images', new FormData(form), { form: true });
      say('captcha-images-message', data.message);
      form.querySelector('input[type="file"]').value = '';
      setCount(category, (data.images || []).length);
      const label = document.querySelector(`#captcha-categories option[value="${CSS.escape(category)}"]`);
      if (label) label.textContent = `${(data.images || []).length} picture(s)`;
    } catch (err) {
      say('captcha-images-message', err.message, false);
    }
  });
})();
