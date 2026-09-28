const themes = {
  list: [
    { label: 'Yotsuba', id: 'yotsuba' },
    { label: 'Yotsuba B', id: 'yotsuba-b' },
    { label: 'Mikuchong', id: 'mikuchong20' }
  ],
  defaultId: 'hachunedark20',

  ids() {
    return this.list.map((t) => t.id);
  },

  href(id) {
    return '/css/' + (id || this.defaultId) + '.css';
  },

  apply(id) {
    const link = document.getElementById('theme-css');
    if (link) link.href = this.href(id);
  },

  init() {
    const tools = document.querySelector('.footer-nav-tools');
    if (!tools || document.getElementById('themeSelector')) return;

    const sel = document.createElement('select');
    sel.id = 'themeSelector';

    const def = document.createElement('option');
    def.value = '';
    def.textContent = 'Hachune Dark';
    sel.appendChild(def);

    this.list.forEach((theme) => {
      const option = document.createElement('option');
      option.value = theme.id;
      option.textContent = theme.label;
      sel.appendChild(option);
    });

    const saved = this.ids().indexOf(localStorage.selectedTheme) !== -1 ? localStorage.selectedTheme : '';
    sel.value = saved;
    if (localStorage.selectedTheme && saved !== localStorage.selectedTheme) {
      delete localStorage.selectedTheme;
      this.apply('');
    }

    sel.addEventListener('change', () => {
      const id = sel.value;
      if (!id) {
        delete localStorage.selectedTheme;
        this.apply('');
        return;
      }
      localStorage.selectedTheme = id;
      this.apply(id);
    });

    tools.insertBefore(sel, tools.firstChild);
  }
};

const savedTheme = themes.ids().indexOf(localStorage.selectedTheme) !== -1 ? localStorage.selectedTheme : '';
themes.apply(savedTheme);

window.themes = themes;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => themes.init());
} else {
  themes.init();
}
