const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('image');
const previewContainer = document.getElementById('preview-container');
const form =
  document.getElementById('post-form') ||
  document.getElementById('submit-form') ||
  document.getElementById('reply-form') ||
  document.getElementById('quick-reply-form');

const maxFilesLimit = Math.max(
  1,
  parseInt(
    form?.getAttribute('data-max-files') ||
      document.getElementById('quick-reply-form')?.getAttribute('data-max-files') ||
      '3',
    10
  ) || 3
);

// Only set up QR drop zone if we're on a thread page (check for QR element)
const isThreadPage = document.getElementById('quick-reply') !== null;
const dropZone_QR = isThreadPage ? document.getElementById('qr-drop-zone') : null;
const previewContainer_QR = isThreadPage ? document.getElementById('qr-preview-container') : null;

let currentFiles = [];
let spoilerGroupSeq = 0;
// Maps a preview card back to its File so the server-side index of a file can
// be recomputed at submit time (removing a file shifts every later index).
const previewFileOf = new WeakMap();

Object.defineProperty(window, 'currentFiles', {
  get: function () {
    return currentFiles;
  },
  set: function (value) {
    currentFiles = value;
  }
});

fileInput.removeAttribute('required');
fileInput.setAttribute('multiple', 'true');
fileInput.setAttribute('max', String(maxFilesLimit));

// Set up main drop zone
dropZone.addEventListener('click', () => {
  fileInput.click();
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.style.backgroundColor = 'var(--small-button)';
});

dropZone.addEventListener('dragleave', () => {
  dropZone.style.backgroundColor = 'var(--background-gradient)';
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.style.backgroundColor = 'var(--background-gradient)';
  const files = Array.from(e.dataTransfer.files);
  handleFilesUpload(files);
});

// Set up QR drop zone only if it exists
if (dropZone_QR) {
  dropZone_QR.addEventListener('click', () => {
    fileInput.click();
  });

  dropZone_QR.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.backgroundColor = 'var(--small-button)';
  });

  dropZone_QR.addEventListener('dragleave', () => {
    dropZone.style.backgroundColor = 'var(--background-gradient)';
  });

  dropZone_QR.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.backgroundColor = 'var(--background-gradient)';
    const files = Array.from(e.dataTransfer.files);
    handleFilesUpload(files);
  });
}

fileInput.addEventListener('change', (e) => {
  const files = Array.from(e.target.files);
  if (files.length === 0) return;

  window.currentFiles = [];
  const previewItems = previewContainer.querySelectorAll('.preview-item');
  previewItems.forEach((item) => item.remove());
  if (previewContainer_QR) {
    const qrPreviews = previewContainer_QR.querySelectorAll('.preview-text');
    qrPreviews.forEach((item) => item.remove());
  }
  handleFilesUpload(files);
  updateFileInput();
});

document.addEventListener('paste', (e) => {
  const items = (e.clipboardData || e.originalEvent.clipboardData).items;
  const files = [];
  let hasFiles = false;

  for (const item of items) {
    if (item.kind === 'file') {
      hasFiles = true;
      const file = item.getAsFile();
      if (file) {
        files.push(file);
      }
    }
  }

  if (hasFiles) {
    e.preventDefault();
    handleFilesUpload(files);
  }
});

function isTegakiReplayFile(file) {
  return file.type === 'tegaki/replay' || (file.name || '').toLowerCase().endsWith('.tgkr');
}

function visibleFileCount() {
  return currentFiles.filter((f) => !isTegakiReplayFile(f)).length;
}

// The name a preview card shows: at most `window.fileNameMaxLength` characters with
// the extension kept - the same rule the server applies to a post's file names (see
// `truncateFileName` in `be/lib/formatting.js`), so every card is the same shape
// whatever the reader picked.
function displayFileName(name) {
  const value = String(name || '');
  const max = Number(window.fileNameMaxLength);
  if (!Number.isFinite(max) || max <= 0 || value.length <= max) return value;

  const dot = value.lastIndexOf('.');
  const ext = dot > 0 ? value.slice(dot) : '';
  const stem = dot > 0 ? value.slice(0, dot) : value;
  const room = Math.max(1, max - ext.length - 1);
  return `${stem.slice(0, room)}…${ext}`;
}

function handleFilesUpload(files) {
  const incomingVisible = Array.from(files).filter((f) => !isTegakiReplayFile(f)).length;
  if (visibleFileCount() + incomingVisible > maxFilesLimit) {
    alert(`Maximum ${maxFilesLimit} files allowed`);
    return;
  }

  files.forEach((file) => {
    if (isTegakiReplayFile(file)) {
      currentFiles.push(file);
      window.currentFiles = currentFiles;
      updateFileInput();
      return;
    }

    if (visibleFileCount() >= maxFilesLimit) return;

    const reader = new FileReader();
    const previewDiv = document.createElement('div');
    previewDiv.className = 'preview-item';

    const previewImage = document.createElement('img');
    const fileInfo = document.createElement('div');
    fileInfo.className = 'preview-text';
    const removeButton = document.createElement('button');
    removeButton.textContent = '×';
    removeButton.className = 'remove-file';
    removeButton.type = 'button';

    reader.onload = function (e) {
      if (file.type.startsWith('image/')) {
        previewImage.src = e.target.result;
      } else {
        previewImage.src = '/genericThumb.webp';
      }
    };

    reader.readAsDataURL(file);

    // Name and size on a line each, with the name truncated (the full one stays in
    // the tooltip), so cards in a row line up instead of each being its own height.
    const nameSpan = document.createElement('span');
    nameSpan.className = 'preview-name';
    nameSpan.textContent = displayFileName(file.name);
    nameSpan.title = file.name;
    const sizeSpan = document.createElement('span');
    sizeSpan.className = 'preview-size';
    sizeSpan.textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
    fileInfo.append(nameSpan, sizeSpan);

    // One radio group per file: the chosen value decides which placeholder image
    // replaces the thumbnail. Each group needs its own name, otherwise a single
    // choice would clear the others (radios with the same name form one group).
    const spoilerGroup = document.createElement('div');
    spoilerGroup.className = 'spoiler-options';
    spoilerGroup.style.marginTop = '5px';
    spoilerGroup.style.display = 'flex';
    spoilerGroup.style.flexWrap = 'wrap';
    spoilerGroup.style.gap = '8px';
    spoilerGroup.style.color = 'var(--file-info-color)';
    const groupName = `spoiler_${spoilerGroupSeq++}`;
    spoilerGroup.innerHTML = `
      <label style="display: inline-flex; align-items: center; gap: 2px;"><input type="radio" name="${groupName}" value="none" checked>None</label>
      <label style="display: inline-flex; align-items: center; gap: 2px;"><input type="radio" name="${groupName}" value="spoiler">Spoiler</label>
      <label style="display: inline-flex; align-items: center; gap: 2px;"><input type="radio" name="${groupName}" value="nsfw">NSFW</label>
    `;

    previewDiv.appendChild(previewImage);
    previewDiv.appendChild(fileInfo);
    previewDiv.appendChild(spoilerGroup);
    previewDiv.appendChild(removeButton);
    previewContainer.appendChild(previewDiv);
    previewFileOf.set(previewDiv, file);

    if (previewContainer_QR) {
      const qrAppend = document.createElement('div');
      qrAppend.className = 'preview-text';
      qrAppend.textContent = `${displayFileName(file.name)} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
      qrAppend.title = file.name;
      previewContainer_QR.appendChild(qrAppend);
    }

    currentFiles.push(file);
    window.currentFiles = currentFiles;

    removeButton.addEventListener('click', () => {
      previewDiv.remove();
      if (previewContainer_QR) {
        const qrPreviews = previewContainer_QR.querySelectorAll('.preview-text');
        qrPreviews[currentFiles.filter((f) => !isTegakiReplayFile(f)).indexOf(file)]?.remove();
      }
      const removeSet = new Set([file]);
      if ((file.name || '').endsWith('-tegaki.png')) {
        const stem = file.name.slice(0, -3);
        currentFiles.forEach((f) => {
          if (isTegakiReplayFile(f) && f.name.slice(0, -4) === stem) removeSet.add(f);
        });
      }
      currentFiles = currentFiles.filter((f) => !removeSet.has(f));
      window.currentFiles = currentFiles;
      updateFileInput();
    });

    updateFileInput();
  });
}

function updateFileInput() {
  const dataTransfer = new DataTransfer();
  currentFiles.forEach((file) => dataTransfer.items.add(file));
  fileInput.files = dataTransfer.files;
}

window.updateFileInput = updateFileInput;

// Recompute the index each selected file has in the upload, so a spoiler choice
// still points at the right file after another one was removed.
function refreshSpoilerIndexes(root) {
  root.querySelectorAll('.preview-item').forEach((card) => {
    const file = previewFileOf.get(card);
    const index = file ? currentFiles.indexOf(file) : -1;
    card.querySelectorAll('input[type="radio"][name^="spoiler_"]').forEach((radio) => {
      if (index >= 0) radio.dataset.index = String(index);
      else radio.removeAttribute('data-index');
    });
  });
}

// Spoiler/NSFW selections of the files picked in `root` (the main post form, or
// the quick reply form when its own preview copies are used), as form fields.
window.getSpoilerFields = function (root) {
  const scope = root || document;
  refreshSpoilerIndexes(scope);
  const fields = [];
  scope.querySelectorAll('input[type="radio"][name^="spoiler_"]:checked').forEach((radio) => {
    const index = radio.dataset.index;
    if (index === undefined || index === '' || index === '-1') return;
    if (radio.value === 'nsfw') fields.push({ name: 'nsfw', value: index });
    else if (radio.value === 'spoiler') fields.push({ name: 'spoiler', value: index });
  });
  return fields;
};

if (form) {
  form.addEventListener('submit', (e) => {
  // Skip validation if the clicked button has data-no-upload-check="true"
  if (e.submitter && e.submitter.getAttribute('data-no-upload-check') === 'true') {
    return; // Allow the form to submit without validation
  }

  updateFileInput();

  const requiresFile =
    form.id !== 'reply-form' &&
    form.id !== 'quick-reply-form' &&
    form.getAttribute('data-requires-file') !== 'false';

  if (!fileInput.files.length && requiresFile) {
    e.preventDefault();
    alert('Please select at least one file before submitting.');
    return;
  }

  // One hidden field per selected file so the server knows which of them is
  // spoilered and which is tagged NSFW.
  form.querySelectorAll('input[data-spoiler-field]').forEach((input) => input.remove());
  window.getSpoilerFields(form).forEach(({ name, value }) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    input.setAttribute('data-spoiler-field', 'true');
    form.appendChild(input);
  });
  });
}
