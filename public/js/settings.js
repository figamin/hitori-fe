const settings = {
  init() {
    this.createModal();
    this.loadSavedSettings();
    this.filters = JSON.parse(localStorage.getItem('filters') || '[]');

    // Apply filters immediately after initialization
    setTimeout(() => this.applyFilters(), 100);
  },

  createModal() {
    this.modal = document.createElement('div');
    this.modal.id = 'settings-modal';

    const content = document.createElement('div');
    content.className = 'modal-content settings-panel';

    const header = document.createElement('div');
    header.className = 'settings-header';
    const title = document.createElement('span');
    title.className = 'settings-title';
    title.textContent = 'Settings';
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'modal-close';
    closeBtn.title = 'Close';
    closeBtn.textContent = '×';
    header.append(title, closeBtn);

    // One link opens or closes every section at once; its label follows whatever the
    // sections are doing, however they got that way.
    const expandAll = document.createElement('div');
    expandAll.className = 'settings-expand-all';
    const expandLink = document.createElement('a');
    expandLink.href = '#';
    expandAll.append('[', expandLink, ']');

    const body = document.createElement('div');
    body.className = 'settings-body';

    const section = (name, open) => {
      const details = document.createElement('details');
      details.className = 'settings-section';
      details.open = open;
      const summary = document.createElement('summary');
      summary.textContent = name;
      const inner = document.createElement('div');
      inner.className = 'settings-section-body';
      details.append(summary, inner);
      body.appendChild(details);
      return inner;
    };

    // Filters
    const filtersContent = section('Filters & Post Hiding', true);

    const filterControls = document.createElement('div');
    filterControls.className = 'filter-controls';

    const filterTypeSelect = document.createElement('select');
    filterTypeSelect.id = 'filter-type';
    ['Name', 'Tripcode', 'Subject', 'Message'].forEach((type) => {
      const option = document.createElement('option');
      option.value = type.toLowerCase();
      option.textContent = type;
      filterTypeSelect.appendChild(option);
    });

    const filterInput = document.createElement('input');
    filterInput.type = 'text';
    filterInput.id = 'filter-input';
    filterInput.placeholder = 'filter';

    const regexContainer = document.createElement('label');
    const regexCheckbox = document.createElement('input');
    regexCheckbox.type = 'checkbox';
    regexCheckbox.id = 'filter-regex';
    regexContainer.append(regexCheckbox, ' Regex');

    const addFilterButton = document.createElement('button');
    addFilterButton.type = 'button';
    addFilterButton.textContent = 'Add filter';
    addFilterButton.onclick = () => this.addFilter();

    filterControls.append(filterTypeSelect, filterInput, regexContainer, addFilterButton);

    const filtersList = document.createElement('div');
    filtersList.id = 'filters-list';
    filtersList.className = 'filters-list';

    filtersContent.append(filterControls, filtersList);

    // Options. Each is a checkbox with its name, and a line under it saying what it does.
    const optionsContent = section('Posts & Threads', false);

    const options = [
      { id: 'disable-you-tag', label: 'Disable (You) tags', desc: 'Stop marking your own posts and the replies to them with (You)', checked: localStorage.getItem('disableYouTag') === 'true' },
      { id: 'image-preview-hover', label: 'Image preview on hover', desc: 'Show the full image while the pointer is over a thumbnail', checked: localStorage.getItem('imagePreviewHover') === 'true' },
      { id: 'disable-auto-watch', label: 'Disable auto-watching', desc: 'Stop automatically adding threads you post in to the Thread Watcher', checked: localStorage.getItem('disableAutoWatch') === 'true' },
      { id: 'hide-fortunes', label: 'Hide fortunes', desc: 'Hide fortunes on posts that contain it', checked: localStorage.getItem('hideFortunes') === 'true' },
      { id: 'new-post-sound', label: 'New post sound', desc: 'Play a sound when an open thread gets a new post', checked: localStorage.getItem('newPostSound') === 'true' },
      // On by default: absent means enabled, only an explicit "true" turns it off.
      { id: 'post-inlining', label: 'Inline quoted posts', desc: 'Clicking a quote opens the quoted post inside the reply', checked: localStorage.getItem('disablePostInlining') !== 'true' },
      // Off by default: the frame is an alternative to the site's own bars, not the
      // way the site looks to everyone.
      { id: 'framed-browsing', label: 'Framed browsing', desc: 'Read boards and threads in a frame with its own top and bottom bars, instead of under the site header and footer', checked: localStorage.getItem('framedBrowsing') === 'true' }
    ];

    options.forEach((opt) => {
      const item = document.createElement('label');
      item.className = 'settings-option';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = opt.id;
      checkbox.checked = opt.checked;
      const name = document.createElement('span');
      name.className = 'settings-option-name';
      name.textContent = opt.label;
      const desc = document.createElement('span');
      desc.className = 'settings-option-desc';
      desc.textContent = opt.desc;
      item.append(checkbox, name, desc);
      optionsContent.appendChild(item);
    });

    // Custom CSS / JS
    const cssContent = section('Custom CSS', false);
    cssContent.innerHTML = `
      <p class="settings-option-desc">Your own CSS rules, added to every page.</p>
      <textarea id="custom-css" class="settings-code" placeholder="Enter your custom CSS here..." spellcheck="false"></textarea>
    `;

    const jsContent = section('Custom JavaScript', false);
    jsContent.innerHTML = `
      <p class="settings-option-desc">Your own script, run on every page.</p>
      <textarea id="custom-js" class="settings-code" placeholder="Enter your custom JavaScript here..." spellcheck="false"></textarea>
    `;

    const sections = Array.from(body.querySelectorAll('.settings-section'));
    const syncExpandLabel = () => {
      expandLink.textContent = sections.every((d) => d.open) ? 'Collapse All Settings' : 'Expand All Settings';
    };
    sections.forEach((d) => d.addEventListener('toggle', syncExpandLabel));
    expandLink.onclick = (e) => {
      e.preventDefault();
      const open = !sections.every((d) => d.open);
      sections.forEach((d) => (d.open = open));
      syncExpandLabel();
    };
    syncExpandLabel();

    const footer = document.createElement('div');
    footer.className = 'settings-footer';

    const saveButton = document.createElement('button');
    saveButton.type = 'button';
    saveButton.textContent = 'Save Settings';
    saveButton.onclick = () => this.saveSettings();

    footer.appendChild(saveButton);

    content.append(header, expandAll, body, footer);
    this.modal.appendChild(content);
    document.body.appendChild(this.modal);

    closeBtn.onclick = () => this.hide();
    this.modal.onclick = (e) => {
      if (e.target === this.modal) this.hide();
    };
  },

  addFilter() {
    const type = document.getElementById('filter-type').value;
    const pattern = document.getElementById('filter-input').value.trim();
    const isRegex = document.getElementById('filter-regex').checked;

    if (!pattern) return;

    // Check if trying to filter "Anonymous"
    if (type === 'name' && pattern.toLowerCase() === 'anonymous') {
      alert("Cannot create name filter on 'Anonymous'");
      return;
    }

    this.filters.push({
      id: Date.now(),
      type,
      pattern,
      isRegex
    });

    localStorage.setItem('filters', JSON.stringify(this.filters));

    this.updateFiltersList();

    this.applyFilters();

    document.getElementById('filter-input').value = '';
  },

  removeFilter(id) {
    this.filters = this.filters.filter((filter) => filter.id !== id);

    localStorage.setItem('filters', JSON.stringify(this.filters));

    this.updateFiltersList();

    this.applyFilters();
  },

  updateFiltersList() {
    const filtersList = document.getElementById('filters-list');
    filtersList.innerHTML = '';

    if (this.filters.length === 0) {
      filtersList.innerHTML = '<p>No filters added yet.</p>';
      return;
    }

    this.filters.forEach((filter) => {
      const filterItem = document.createElement('div');
      filterItem.className = 'filter-item';

      const filterInfo = document.createElement('span');
      filterInfo.textContent = `${filter.type}: ${filter.pattern} ${filter.isRegex ? '(regex)' : ''}`;

      const removeButton = document.createElement('button');
      removeButton.textContent = 'Remove';
      removeButton.onclick = () => this.removeFilter(filter.id);

      filterItem.appendChild(filterInfo);
      filterItem.appendChild(removeButton);
      filtersList.appendChild(filterItem);
    });
  },

  show() {
    this.modal.style.display = 'flex';
    this.updateFiltersList();
  },

  hide() {
    this.modal.style.display = 'none';
  },

  loadSavedSettings() {
    const customCSS = localStorage.getItem('customCSS') || '';
    const customJS = localStorage.getItem('customJS') || '';
    this.filters = JSON.parse(localStorage.getItem('filters') || '[]');

    document.getElementById('custom-css').value = customCSS;
    document.getElementById('custom-js').value = customJS;

    this.applySettings();
    this.updateFiltersList();
  },

  saveSettings() {
    const customCSS = document.getElementById('custom-css').value;
    const customJS = document.getElementById('custom-js').value;

    const disableYouTag = document.getElementById('disable-you-tag').checked;
    const imagePreviewHover = document.getElementById('image-preview-hover').checked;
    const disableAutoWatch = document.getElementById('disable-auto-watch').checked;
    const hideFortunes = document.getElementById('hide-fortunes').checked;
    // Nothing has to be applied for this one: `thread.js` reads it when a new post
    // actually arrives.
    const newPostSound = document.getElementById('new-post-sound').checked;
    // The inliner (`post-inline.js`) reads this when a quote is clicked, so nothing has to
    // be applied here either - but a reader who turns it off sees the boxes that are open
    // right now go away, rather than a mix of both behaviours.
    const postInlining = document.getElementById('post-inlining').checked;
    if (!postInlining) window.postInline?.closeAll();
    // `framed-browsing.js` builds or takes apart the frame; on a page it does not
    // apply to (the front page, search, the moderation pages) it does nothing but
    // remember the choice.
    const framedBrowsing = document.getElementById('framed-browsing').checked;
    window.framedBrowsing?.setEnabled(framedBrowsing);

    localStorage.setItem('customCSS', customCSS);
    localStorage.setItem('customJS', customJS);
    localStorage.setItem('filters', JSON.stringify(this.filters));
    localStorage.setItem('disableYouTag', disableYouTag);
    localStorage.setItem('imagePreviewHover', imagePreviewHover);
    localStorage.setItem('disableAutoWatch', disableAutoWatch);
    localStorage.setItem('hideFortunes', hideFortunes);
    localStorage.setItem('newPostSound', newPostSound);
    localStorage.setItem('disablePostInlining', String(!postInlining));
    localStorage.setItem('framedBrowsing', String(framedBrowsing));

    this.applySettings();
    this.hide();
  },

  applySettings() {
    const customCSS = localStorage.getItem('customCSS') || '';
    const disableYouTag = localStorage.getItem('disableYouTag') === 'true';
    const hideFortunes = localStorage.getItem('hideFortunes') === 'true';

    let styleElement = document.getElementById('custom-style');
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = 'custom-style';
      document.head.appendChild(styleElement);
    }

    let combinedCSS = customCSS;

    if (disableYouTag) {
      combinedCSS += `
        .youName::after,
        .you::after,
        .you.opReply::after {
          display: none !important;
        }
        
        .you.opReply::after {
          content: ' (OP)' !important;
          display: inline !important;
        }
      `;
    }

    if (hideFortunes) {
      // A fortune is part of the post's stored markdown (`be/lib/fortunes.js`) and
      // always sits in a div of its own, so hiding it is a CSS job. The shared
      // `fortune` class covers new ones; the class names below belong to the ones
      // written before that class existed, which are still in the boards' posts.
      combinedCSS += `
        .fortune,
        .excellentLuck,
        .goodLuck,
        .averageLuck,
        .badLuck,
        .tellYouNow,
        .outlookGood,
        .veryBadLuck,
        .godlyLuck,
        .youAreBanned,
        .divFortune {
          display: none !important;
        }
      `;
    }

    styleElement.textContent = combinedCSS;

    // Apply JS
    const customJS = localStorage.getItem('customJS');
    if (customJS) {
      try {
        eval(customJS);
      } catch (error) {
        console.error('Error in custom JavaScript:', error);
      }
    }

    this.setupImagePreview();

    this.applyFilters();
  },

  setupImagePreview() {
    if (window.imagePreview) window.imagePreview.update();
  },

  applyFilters() {
    const posts = document.querySelectorAll('.post, .reply, .op, .thread');

    posts.forEach((post) => {
      const existingButton = post.previousElementSibling;
      if (existingButton && existingButton.classList.contains('filter-unhide-button')) {
        existingButton.remove();
        post.classList.remove('filtered-post');
      }

      const shouldFilter = this.filters.some((filter) => {
        let content = '';

        if (filter.type === 'name') {
          const nameElement = post.querySelector('.name') || post.querySelector('.post-name') || post.querySelector('.author');
          content = nameElement ? nameElement.textContent.trim() : '';
        } else if (filter.type === 'tripcode') {
          const nameElement = post.querySelector('.name') || post.querySelector('.post-name') || post.querySelector('.author');

          if (nameElement) {
            const fullNameText = nameElement.innerHTML;

            if (fullNameText.includes('!!')) {
              const tripcodeMatch = fullNameText.match(/([^<]+)<span[^>]*>!!([^<]+)<\/span>/);
              if (tripcodeMatch) {
                content = tripcodeMatch[1] + '!!' + tripcodeMatch[2];
              }
            }
          }
        } else if (filter.type === 'subject') {
          const subjectElement = post.querySelector('.subject') || post.querySelector('.post-subject') || post.querySelector('.thread-subject');
          content = subjectElement ? subjectElement.textContent.trim() : '';
        } else if (filter.type === 'message') {
          const messageElement =
            post.querySelector('.thread-content') ||
            post.querySelector('.reply-content') ||
            post.querySelector('.message') ||
            post.querySelector('.post-content');
          content = messageElement ? messageElement.textContent.trim() : '';
        }

        console.log(`Checking filter: ${filter.type}="${filter.pattern}" against "${content.substring(0, 50)}..."`);

        if (filter.isRegex) {
          try {
            const regex = new RegExp(filter.pattern, 'i');
            return regex.test(content);
          } catch (e) {
            console.error('Invalid regex:', filter.pattern);
            return false;
          }
        } else {
          return content.toLowerCase().includes(filter.pattern.toLowerCase());
        }
      });

      if (shouldFilter) {
        console.log('Filtering post:', post);

        const boardUri = window.location.pathname.split('/')[1] || 'unknown';
        const postId = post.dataset.postId || post.id || 'unknown';

        const unhideButton = document.createElement('button');
        unhideButton.className = 'filter-unhide-button';
        unhideButton.textContent = `[Unhide post /${boardUri}/${postId} (Filtered)]`;
        unhideButton.onclick = function () {
          post.classList.toggle('filtered-post');
        };

        post.classList.add('filtered-post');
        post.parentNode.insertBefore(unhideButton, post);
      }
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  settings.init();

  document.querySelectorAll('.settings-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      settings.show();
    });
  });

  document.addEventListener('contentAdded', () => {
    settings.applyFilters();
  });

  setTimeout(() => settings.applyFilters(), 500);
});
