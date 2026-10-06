// The post password ("for deletion") is remembered, the way a half-written post is.
//
// The server pre-fills each form with a fresh random password; the first one a
// reader sees is kept in localStorage and every later form shows *that* value
// instead of a new one, so a reader has a single password for all their posts and
// threads. Editing either box (the reply form's or the quick reply's - `qr.js` keeps
// the two in step) stores the new value. Nothing here is cleared after posting: the
// point is to reuse it.
//
// `postingPasswords` (per post, written by `board.js`/`thread.js`/`qr.js` on a
// successful post) is separate: it is what the delete menu and the delete form use
// to know which password belongs to which post.
(function () {
  const KEY = 'postPassword';
  const IDS = ['post-password', 'post-password-qr'];

  const read = () => {
    try {
      return localStorage.getItem(KEY) || '';
    } catch (e) {
      return '';
    }
  };

  const write = (value) => {
    try {
      if (value) localStorage.setItem(KEY, value);
    } catch (e) {
      // Private mode or a full quota: the box still works for this page.
    }
  };

  const boxes = () =>
    IDS.map((id) => document.getElementById(id)).filter(Boolean);

  const apply = (value) => {
    boxes().forEach((el) => {
      if (el.value !== value) el.value = value;
    });
  };

  // Deferred load, so both forms are parsed by the time this runs.
  const saved = read();
  const present = boxes();
  if (!present.length) return;

  if (saved) {
    apply(saved);
  } else {
    // First sight of a generated password - keep it for every later post.
    write(present[0].value);
  }

  boxes().forEach((el) => {
    // `addEventListener`, not `oninput`: `qr.js` owns `oninput` on these two boxes
    // for its own mirroring and would be overwritten.
    el.addEventListener('input', () => {
      if (el.value) write(el.value);
    });
  });

  // A successful post resets its form, which puts the server's fresh value back in
  // the box. Restore the remembered one instead (the reset is applied after the
  // event, hence the deferral).
  document.addEventListener(
    'reset',
    () => {
      const value = read();
      if (value) setTimeout(() => apply(value), 0);
    },
    true
  );
})();
