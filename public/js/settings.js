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
    content.className = 'modal-content';

    const header = document.createElement('p');
    header.appendChild(document.createTextNode('Settings '));
    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close';
    closeBtn.textContent = '×';
    header.appendChild(closeBtn);

    const tabs = document.createElement('div');
    tabs.className = 'tabs';

    const tabNames = ['Filters', 'CSS', 'JS', 'Other'];
    tabNames.forEach((name) => {
      const tab = document.createElement('button');
      tab.textContent = name;
      tab.onclick = () => this.switchTab(name.toLowerCase());
      tabs.appendChild(tab);
      if (name === 'Filters') tab.classList.add('active');
    });

    const tabContents = document.createElement('div');
    tabContents.className = 'tab-contents';

    const filtersContent = document.createElement('div');
    filtersContent.id = 'filters-content';
    filtersContent.style.display = 'block';

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

    const regexContainer = document.createElement('span');
    const regexCheckbox = document.createElement('input');
    regexCheckbox.type = 'checkbox';
    regexCheckbox.id = 'filter-regex';
    const regexLabel = document.createElement('label');
    regexLabel.htmlFor = 'filter-regex';
    regexLabel.textContent = 'Regex';
    regexContainer.appendChild(regexCheckbox);
    regexContainer.appendChild(regexLabel);

    const addFilterButton = document.createElement('button');
    addFilterButton.textContent = 'Add filter';
    addFilterButton.onclick = () => this.addFilter();

    filterControls.appendChild(filterTypeSelect);
    filterControls.appendChild(filterInput);
    filterControls.appendChild(regexContainer);
    filterControls.appendChild(addFilterButton);

    const filtersList = document.createElement('div');
    filtersList.id = 'filters-list';
    filtersList.className = 'filters-list';

    filtersContent.appendChild(filterControls);
    filtersContent.appendChild(filtersList);

    const cssContent = document.createElement('div');
    cssContent.id = 'css-content';
    cssContent.style.display = 'none';
    cssContent.innerHTML = `
      <textarea id="custom-css" placeholder="Enter your custom CSS here..." 
        style="width: 350px; height: 300px; background-color: var(--bg-color); 
        color: var(--text-color); border: 1px solid var(--border-color); 
        padding: 10px; font-family: monospace;"></textarea>
    `;

    const jsContent = document.createElement('div');
    jsContent.id = 'js-content';
    jsContent.style.display = 'none';
    jsContent.innerHTML = `
      <textarea id="custom-js" placeholder="Enter your custom JavaScript here..." 
        style="width: 350px; height: 300px; background-color: var(--bg-color); 
        color: var(--text-color); border: 1px solid var(--border-color); 
        padding: 10px; font-family: monospace;"></textarea>
    `;

    const otherContent = document.createElement('div');
    otherContent.id = 'other-content';
    otherContent.style.display = 'none';

    const optionsList = document.createElement('div');
    optionsList.className = 'options-list';

    const disableYouOption = document.createElement('div');
    disableYouOption.className = 'option-item';

    const disableYouCheckbox = document.createElement('input');
    disableYouCheckbox.type = 'checkbox';
    disableYouCheckbox.id = 'disable-you-tag';
    disableYouCheckbox.checked = localStorage.getItem('disableYouTag') === 'true';

    const disableYouLabel = document.createElement('label');
    disableYouLabel.htmlFor = 'disable-you-tag';
    disableYouLabel.textContent = 'Disable (You) tags on posts';

    disableYouOption.appendChild(disableYouCheckbox);
    disableYouOption.appendChild(disableYouLabel);

    const imagePreviewOption = document.createElement('div');
    imagePreviewOption.className = 'option-item';

    const imagePreviewCheckbox = document.createElement('input');
    imagePreviewCheckbox.type = 'checkbox';
    imagePreviewCheckbox.id = 'image-preview-hover';
    imagePreviewCheckbox.checked = localStorage.getItem('imagePreviewHover') === 'true';

    const imagePreviewLabel = document.createElement('label');
    imagePreviewLabel.htmlFor = 'image-preview-hover';
    imagePreviewLabel.textContent = 'Image preview on hover';

    imagePreviewOption.appendChild(imagePreviewCheckbox);
    imagePreviewOption.appendChild(imagePreviewLabel);

    const disableAutoWatchOption = document.createElement('div');
    disableAutoWatchOption.className = 'option-item';

    const disableAutoWatchCheckbox = document.createElement('input');
    disableAutoWatchCheckbox.type = 'checkbox';
    disableAutoWatchCheckbox.id = 'disable-auto-watch';
    disableAutoWatchCheckbox.checked = localStorage.getItem('disableAutoWatch') === 'true';

    const disableAutoWatchLabel = document.createElement('label');
    disableAutoWatchLabel.htmlFor = 'disable-auto-watch';
    disableAutoWatchLabel.textContent = 'Disable auto-watching threads after posting';

    disableAutoWatchOption.appendChild(disableAutoWatchCheckbox);
    disableAutoWatchOption.appendChild(disableAutoWatchLabel);

    const hideFortunesOption = document.createElement('div');
    hideFortunesOption.className = 'option-item';

    const hideFortunesCheckbox = document.createElement('input');
    hideFortunesCheckbox.type = 'checkbox';
    hideFortunesCheckbox.id = 'hide-fortunes';
    hideFortunesCheckbox.checked = localStorage.getItem('hideFortunes') === 'true';

    const hideFortunesLabel = document.createElement('label');
    hideFortunesLabel.htmlFor = 'hide-fortunes';
    hideFortunesLabel.textContent = 'Hide fortunes in posts';

    hideFortunesOption.appendChild(hideFortunesCheckbox);
    hideFortunesOption.appendChild(hideFortunesLabel);

    const newPostSoundOption = document.createElement('div');
    newPostSoundOption.className = 'option-item';

    const newPostSoundCheckbox = document.createElement('input');
    newPostSoundCheckbox.type = 'checkbox';
    newPostSoundCheckbox.id = 'new-post-sound';
    newPostSoundCheckbox.checked = localStorage.getItem('newPostSound') === 'true';

    const newPostSoundLabel = document.createElement('label');
    newPostSoundLabel.htmlFor = 'new-post-sound';
    newPostSoundLabel.textContent = 'Play a sound when a thread gets a new post';

    newPostSoundOption.appendChild(newPostSoundCheckbox);
    newPostSoundOption.appendChild(newPostSoundLabel);

    optionsList.appendChild(disableYouOption);
    optionsList.appendChild(imagePreviewOption);
    optionsList.appendChild(disableAutoWatchOption);
    optionsList.appendChild(hideFortunesOption);
    optionsList.appendChild(newPostSoundOption);

    otherContent.appendChild(optionsList);

    tabContents.append(filtersContent, cssContent, jsContent, otherContent);

    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.onclick = () => this.saveSettings();
    saveButton.style.cssText = 'margin-top: 15px; padding: 5px 15px;';

    content.append(header, tabs, tabContents, saveButton);
    this.modal.appendChild(content);
    document.body.appendChild(this.modal);

    this.modal.querySelector('.modal-close').onclick = () => this.hide();
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

  switchTab(tabName) {
    const tabs = this.modal.querySelectorAll('button');
    tabs.forEach((tab) => tab.classList.remove('active'));
    const activeTab = Array.from(tabs).find((tab) => tab.textContent.toLowerCase() === tabName);
    if (activeTab) activeTab.classList.add('active');

    const contents = {
      filters: 'filters-content',
      css: 'css-content',
      js: 'js-content',
      other: 'other-content'
    };

    Object.values(contents).forEach((id) => {
      document.getElementById(id).style.display = 'none';
    });
    document.getElementById(contents[tabName]).style.display = 'block';
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

    localStorage.setItem('customCSS', customCSS);
    localStorage.setItem('customJS', customJS);
    localStorage.setItem('filters', JSON.stringify(this.filters));
    localStorage.setItem('disableYouTag', disableYouTag);
    localStorage.setItem('imagePreviewHover', imagePreviewHover);
    localStorage.setItem('disableAutoWatch', disableAutoWatch);
    localStorage.setItem('hideFortunes', hideFortunes);
    localStorage.setItem('newPostSound', newPostSound);

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
