// The captcha in the post forms.
//
// A reader solves it once and posts freely for a while (`config.captcha.sessionMinutes`), so
// the widget's job is small: ask for a puzzle, send the answer, and say "Verified" once the
// server agrees - the server says the same thing to a reader who already holds the pass cookie,
// so later pages render straight into that state. The answer is checked by the captcha service
// (Koshi never knows it) and a correct one leaves the cookie behind - which is what
// `be/middleware/captcha.js` looks for on every post.
//
// A page can carry more than one form (a thread has the reply form *and* the quick reply), and
// they must not each generate a puzzle of their own: one challenge is fetched and shared, so
// both forms show the same picture and either box can answer it.
//
// The puzzle also starts **closed**, with a button to open it, and that state belongs to the
// page rather than to a widget - opening it in one form opens it in both, closing it in either
// closes both. Nothing is asked of the service until it is first opened.
(() => {
  const widgets = [...document.querySelectorAll('.captcha[data-captcha]')];
  const puzzles = widgets.filter((widget) => !widget.classList.contains('captcha-verified'));
  if (!puzzles.length) return;

  const CHALLENGE_MAX_AGE_MS = 15000; // the service's own challenge lives 20 seconds

  let token = null;
  let loadedAt = 0;
  let loading = null;

  const message = (text, bad = false) => {
    for (const widget of puzzles) {
      const el = widget.querySelector('.captcha-message');
      if (!el) continue;
      el.textContent = text || '';
      el.classList.toggle('captcha-bad', bad);
    }
  };

  // One solved captcha covers the whole page, so every widget - and every later page while the
  // cookie lasts - says the same thing rather than each form asking again. The puzzle (picture,
  // box, buttons) goes with it: there is nothing left to answer.
  const markVerified = () => {
    token = null;
    for (const widget of widgets) {
      widget.classList.add('captcha-verified');
      widget.dataset.verified = '1';
      delete widget.dataset.token;
      widget.querySelectorAll('.captcha-puzzle, .captcha-actions').forEach((el) => el.remove());
    }
    window.captchaSolved = true;
  };

  const removePuzzles = () => {
    for (const widget of puzzles) widget.remove();
  };

  const load = async () => {
    message('Loading a picture…');
    for (const widget of puzzles) {
      widget.querySelector('.captcha-answer')?.setAttribute('disabled', 'disabled');
      const image = widget.querySelector('.captcha-image');
      if (image) image.removeAttribute('src');
    }
    try {
      const res = await fetch('/captcha/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: '{}'
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) return message(data.error || `The captcha could not be loaded (HTTP ${res.status}).`, true);
      // Turned off while the page is open: nothing to solve, so nothing to show.
      if (!data.enabled) return removePuzzles();
      // Solved elsewhere in the meantime (another tab): the cookie is already here.
      if (data.solved) return markVerified();

      token = data.token;
      loadedAt = Date.now();
      for (const widget of puzzles) {
        widget.dataset.token = data.token;
        const image = widget.querySelector('.captcha-image');
        if (image) image.src = data.image;
        const answer = widget.querySelector('.captcha-answer');
        if (answer) {
          answer.value = '';
          answer.removeAttribute('disabled');
        }
      }
      message(data.instructions || 'Name the character in the picture.');
    } catch (err) {
      message(`The captcha could not be loaded: ${err.message}`, true);
    }
  };

  // The picture a reader is looking at has to be a live one: the service's challenges expire
  // after 20 seconds, so a puzzle that has been sitting closed for longer than that is fetched
  // again rather than handed over dead. Two clicks in a row reuse the one in hand.
  const ensurePuzzle = () => {
    if (loading) return loading;
    if (token && Date.now() - loadedAt < CHALLENGE_MAX_AGE_MS) return Promise.resolve();
    loading = load().finally(() => {
      loading = null;
    });
    return loading;
  };

  // One state for every widget on the page: the two forms are two views of one captcha.
  const setOpen = (open) => {
    for (const widget of widgets) widget.classList.toggle('captcha-collapsed', !open);
    if (open) ensurePuzzle();
  };

  const solve = async (answerBox) => {
    const text = String(answerBox?.value || '').trim();
    if (!text) return message('Type the character\'s name first.', true);

    message('Checking…');
    try {
      const res = await fetch('/captcha/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ token, answer: text })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        const error = data.error || 'That was not it.';
        // The new picture first, then the complaint: loading one resets the line under the
        // box to the instructions, which would wipe the error out again.
        await load();
        message(error, true);
        return;
      }
      markVerified();
    } catch (err) {
      message(`The answer could not be checked: ${err.message}`, true);
    }
  };

  // The widget is only collapsible with a script - without it the puzzle would be open with a
  // button that cannot do anything (see the stylesheet).
  for (const widget of widgets) widget.classList.add('captcha-scripted');
  setOpen(false);

  for (const widget of puzzles) {
    const answer = widget.querySelector('.captcha-answer');
    widget.querySelector('.captcha-open')?.addEventListener('click', () => setOpen(true));
    widget.querySelector('.captcha-hide')?.addEventListener('click', () => setOpen(false));
    widget.querySelector('.captcha-check')?.addEventListener('click', () => solve(answer));
    // Both forms show the same picture, so a fresh one is fetched for both at once.
    widget.querySelector('.captcha-refresh')?.addEventListener('click', () => load());
    answer?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      // Enter in the box checks the answer instead of submitting the form without one.
      event.preventDefault();
      solve(answer);
    });
  }
  // Nothing is fetched here: the puzzle is closed, and the challenge is asked for when the
  // reader opens it (and only if what is in hand has gone stale).
})();
