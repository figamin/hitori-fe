/*
 * Framed browsing.
 *
 * A board or a thread can be read in a frame of its own, the way 39chan served its boards
 * as a frameset: a menu column down the left (15% of the window, as `frames/index.html`
 * has it) and the page in the rest, with the sidebar styled like `frames/left.html` and
 * `frames/hachunedark.css` - the site's logo, pink section bars with +/- buttons, and link
 * rows with a line under each.
 *
 * The sections are the frameset sidebar's own (General Vocal-Synth, Artwork, Miscellaneous,
 * and an Archive it kept closed), but the boards in them come from `window.frameBoards`,
 * which the layout fills with every board the site actually has - so a board that is added,
 * renamed or removed appears here without this file changing, and a board that matches no
 * section is listed under "Other Boards" rather than being dropped.
 *
 * The information the site's own top and bottom bars carry - the search box, the links, the
 * pager, the thread's refresh control, the footer's links - is put in the sidebar too. Those
 * are the site's own nodes, *moved* rather than copied, so everything bound to them keeps
 * working; turning the setting off puts every one of them back where it came from.
 *
 * It is off unless the reader turns it on in Settings, and it only ever applies to board
 * and thread pages: the front page, search, the news page and the moderation pages keep
 * the normal bars.
 */
(() => {
  'use strict';

  const KEY = 'framedBrowsing';
  const COLLAPSED_KEY = 'framedCollapsed';

  // The sections the boards are grouped into. The labels are the frameset sidebar's own;
  // which boards belong to which is decided here, and `window.frameBoards` decides whether
  // a board exists to be listed at all.
  const BOARD_SECTIONS = [
    { key: 'vocal-synths', label: 'General Vocal-Synth Boards', boards: ['leek', 'mmd', 'live', 'negi'] },
    { key: 'artwork', label: 'Artwork Sharing Boards', boards: ['c', 'o', 'brs'] },
    { key: 'off-topic', label: 'Miscellaneous Boards', boards: ['g', 'j', 'meta'] }
  ];

  // First path segments that are pages of their own, never a board.
  const RESERVED = new Set([
    'search', 'news', 'mod', 'login', 'logout', 'register', 'account', 'settings',
    'watcher', 'appeal', 'banned', 'warned', 'report', 'api', 'files', 'thumb', 'css',
    'js', 'img'
  ]);

  // Something that board and thread pages have and the front page (which also has
  // `.thread`, for a link in its "latest posts" list) and the search results do not.
  const BOARD_CONTENT = [
    '.reply-form-container', '.threads', '.catalog-threads', '.catalog-controls',
    '.page-nav', '.thread-refresh-controls', '.outerbox', '.board-top'
  ].join(', ');

  let moved = [];
  let enabled = false;

  const isBoardPage = () => {
    const path = window.location.pathname;
    const main = document.querySelector('main.content');
    if (path === '/' || !main || main.classList.contains('mod-page')) return false;
    if (document.querySelector('.search-page')) return false;
    const segment = path.split('/')[1] || '';
    if (!segment || segment.includes('.') || RESERVED.has(segment.toLowerCase())) return false;
    return !!document.querySelector(BOARD_CONTENT);
  };

  // The board a page belongs to, as a path prefix, for the [Index] and [Catalog]
  // links. The overboard has no catalog of its own, so it gets no links.
  const boardRoot = () => {
    const segment = window.location.pathname.split('/')[1] || '';
    if (!segment || segment.toLowerCase() === 'all') return null;
    return `/${segment}/`;
  };

  const borrow = (target, selector, last = false) => {
    const nodes = document.querySelectorAll(selector);
    const node = last ? nodes[nodes.length - 1] : nodes[0];
    if (!node || target.contains(node)) return null;
    moved.push({ node, parent: node.parentNode, next: node.nextSibling });
    target.appendChild(node);
    return node;
  };

  const link = (href, text, title) => {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = text;
    if (title) a.title = title;
    return a;
  };

  const jump = (to) => (event) => {
    event.preventDefault();
    window.scrollTo({ top: to === 'top' ? 0 : document.documentElement.scrollHeight, behavior: 'smooth' });
  };

  const collapsedSections = () => {
    try {
      return JSON.parse(localStorage.getItem(COLLAPSED_KEY) || '{}') || {};
    } catch {
      return {};
    }
  };

  // A section of the sidebar: the frameset sidebar's pink bar with its +/- button, and the
  // block that button opens and closes. Which ones are closed is remembered: the frameset's
  // own sidebar stayed loaded, while this one is built again on every page.
  const section = (sidebar, key, label) => {
    const collapsed = collapsedSections()[key] === true;
    const header = document.createElement('div');
    header.className = 'section-header';
    const toggle = document.createElement('span');
    toggle.className = 'plus';
    toggle.textContent = collapsed ? '+' : '\u2212';
    header.append(toggle, document.createTextNode(` ${label}`));
    const body = document.createElement('div');
    body.className = collapsed ? 'submenu hidden' : 'submenu';
    toggle.addEventListener('click', () => {
      const hidden = body.classList.toggle('hidden');
      toggle.textContent = hidden ? '+' : '\u2212';
      const state = collapsedSections();
      state[key] = hidden;
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify(state));
    });
    sidebar.append(header, body);
    return body;
  };

  // One section's worth of boards, in the frameset sidebar's own markup: a `ul` of `li a`,
  // each row carrying the board's name rather than its uri.
  const boardList = (boards) => {
    const ul = document.createElement('ul');
    for (const board of boards) {
      const li = document.createElement('li');
      li.appendChild(link(`/${board.uri}/`, board.name));
      ul.appendChild(li);
    }
    return ul;
  };

  const build = () => {
    const container = document.querySelector('.container');
    const content = document.querySelector('main.content');
    if (!container || !content) return false;

    const sidebar = document.createElement('div');
    sidebar.className = 'frame-sidebar';
    sidebar.id = 'frameSidebar';

    // The frameset sidebar opens with the site's logo.
    const logo = document.createElement('img');
    logo.id = 'logo';
    logo.src = '/img/frames-logo.png';
    logo.alt = 'Front page';
    sidebar.appendChild(logo);

    // The front page, and the way back out of the frames.
    const top = document.createElement('ul');
    const frontLi = document.createElement('li');
    frontLi.appendChild(link('/', 'Front Page', 'The front page'));
    const removeLi = document.createElement('li');
    const removeLink = link('#', '[Remove Frames]', 'Read the boards without the sidebar');
    removeLink.id = 'frame-remove';
    removeLink.addEventListener('click', (event) => {
      event.preventDefault();
      disable();
    });
    removeLi.appendChild(removeLink);
    top.append(frontLi, removeLi);
    sidebar.appendChild(top);

    // The boards, grouped. `window.frameBoards` is every board the site has, so a board
    // that is added, renamed or removed turns up here without this list changing - and one
    // that matches no section still gets listed under "Other Boards".
    const boards = (Array.isArray(window.frameBoards) ? window.frameBoards : []).filter((board) => board && board.uri);
    const listed = new Set();
    for (const group of BOARD_SECTIONS) {
      const members = group.boards.map((uri) => boards.find((board) => board.uri === uri)).filter(Boolean);
      members.forEach((board) => listed.add(board.uri));
      if (members.length) section(sidebar, group.key, group.label).appendChild(boardList(members));
    }
    const rest = boards.filter((board) => !listed.has(board.uri));
    if (rest.length) section(sidebar, 'other', 'Other Boards').appendChild(boardList(rest));
    // With no board data at all (a stale cached page, say) fall back to the site's own
    // board list, which the header still holds even while it is hidden.
    if (!boards.length) borrow(section(sidebar, 'boards', 'Boards'), 'header .board-list');

    // Then what the site's own top and bottom bars carry. These are the site's nodes, moved
    // rather than copied, so the search form, the Settings and Thread Watcher buttons, the
    // pager's links and the footer's links all keep working.
    borrow(section(sidebar, 'search', 'Search'), '.navtopright .header-search-form');
    const site = section(sidebar, 'site', 'Site');
    // The top bar says who is logged in, written as text with the brackets the site puts
    // around it. In the column those brackets would each land on a line of their own, so
    // it is taken as text and given a row before the links.
    const who = document.querySelector('header .navtopright')?.textContent.match(/\[\s*Logged in as[^\]]*\]/);
    if (who) {
      const note = document.createElement('div');
      note.className = 'frame-note';
      note.textContent = who[0].trim();
      site.appendChild(note);
    }
    borrow(site, 'header .navtopright');
    const pages = section(sidebar, 'pages', 'Pages');
    // The pager is `.pagelist` (`views/partials/pagelist.ejs`); `.pagination` is the older
    // wrapper of the same thing.
    const pager = borrow(pages, '.pagination, .pagelist', true);
    borrow(pages, '.thread-refresh-controls');
    const root = boardRoot();
    const links = [
      link('#top', '[Top]', 'Back to the top of the page'),
      link('#bottom', '[Bottom]', 'Down to the bottom of the page')
    ];
    links[0].addEventListener('click', jump('top'));
    links[1].addEventListener('click', jump('bottom'));
    // A board's pager already ends with its own Catalog link, so these are only added
    // where the page carries no such navigation of its own.
    if (root && !pager) {
      links.push(link(root, '[Index]', 'The board index'));
      links.push(link(`${root}catalog`, '[Catalog]', 'The board catalog'));
    }
    pages.append(...links);
    borrow(section(sidebar, 'links', 'Links'), '#footer-links');

    container.insertBefore(sidebar, content);
    document.body.classList.add('framed-browsing');
    return true;
  };

  const destroy = () => {
    for (const { node, parent, next } of moved.reverse()) {
      if (next && next.parentNode === parent) parent.insertBefore(node, next);
      else parent.appendChild(node);
    }
    moved = [];
    document.getElementById('frameSidebar')?.remove();
    document.body.classList.remove('framed-browsing');
  };

  const apply = () => {
    if (enabled || !isBoardPage()) return false;
    enabled = build();
    return enabled;
  };

  const remove = () => {
    if (!enabled) return false;
    destroy();
    enabled = false;
    return true;
  };

  // What the sidebar's [Remove Frames] does - the same thing as unticking the box in
  // Settings, so the setting and that checkbox both follow.
  const disable = () => {
    localStorage.setItem(KEY, 'false');
    const box = document.getElementById('framed-browsing');
    if (box) box.checked = false;
    return remove();
  };

  window.framedBrowsing = {
    get enabled() {
      return enabled;
    },
    isBoardPage,
    setEnabled(value) {
      if (value) apply();
      else remove();
    },
    disable,
    toggle() {
      if (enabled) remove();
      else apply();
    }
  };

  // Applied once the document is parsed, not while it is still being: the layout writes
  // `window.frameBoards` (the boards the sidebar lists) in an inline script near the end
  // of the body, which runs *after* this file.
  const boot = () => {
    if (localStorage.getItem(KEY) === 'true') apply();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
