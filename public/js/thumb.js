const PLAYABLE_TYPES = new Set([
  'video/webm',
  'audio/mpeg',
  'video/mp4',
  'video/ogg',
  'audio/ogg',
  'audio/webm',
  'audio/mp4',
  'audio/wav',
  'audio/flac'
]);
const VIDEO_TYPES = new Set(['video/webm', 'video/mp4', 'video/ogg']);
const YT_RE = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i;

function isModifiedClick(e) {
  return e.which === 2 || e.ctrlKey;
}

function makeHideLink() {
  const a = document.createElement('a');
  a.textContent = '[ - ]';
  a.className = 'hide-link';
  a.style.cursor = 'pointer';
  a.style.display = 'none';
  return a;
}

function cloneThumbLink(link, mime) {
  const a = document.createElement('a');
  a.href = link.href;
  a.className = link.className;
  a.dataset.mime = mime;
  if (link.dataset.fileWidth) a.dataset.fileWidth = link.dataset.fileWidth;
  if (link.dataset.fileHeight) a.dataset.fileHeight = link.dataset.fileHeight;
  const img = link.querySelector('img');
  if (img) {
    const thumb = img.cloneNode(true);
    thumb.style.cursor = 'pointer';
    a.appendChild(thumb);
  }
  return a;
}

function wireToggle(parent, thumbLink, media, hideLink, onShow, onHide) {
  hideLink.onclick = () => {
    parent.classList.remove('expanded-cell');
    thumbLink.style.display = 'inline';
    media.style.display = 'none';
    hideLink.style.display = 'none';
    onHide?.();
  };
  thumbLink.onclick = (e) => {
    if (isModifiedClick(e)) return true;
    parent.classList.add('expanded-cell');
    thumbLink.style.display = 'none';
    media.style.display = 'inline';
    hideLink.style.display = 'inline';
    onShow?.();
    return false;
  };
}

const thumbs = {
  expandImage(e, link, mime) {
    if (isModifiedClick(e)) return true;

    const parent = link.parentNode;
    const thumb = link.querySelector('img');
    if (!thumb) return false;

    let expanded = link.querySelector('.img-expanded');

    if (thumb.style.display === 'none') {
      parent.classList.remove('expanded-cell');
      if (expanded) expanded.style.display = 'none';
      thumb.style.display = '';
      if (thumb.getBoundingClientRect().top < 0) thumb.scrollIntoView();
      return false;
    }

    parent.classList.add('expanded-cell');
    if (expanded) {
      thumb.style.display = 'none';
      expanded.style.display = '';
      return false;
    }

    if (thumb.src === link.href && mime !== 'image/svg+xml') return false;

    expanded = document.createElement('img');
    expanded.src = link.href;
    expanded.className = 'img-expanded';
    thumb.style.display = 'none';
    link.appendChild(expanded);
    return false;
  },

  setPlayer(link, mime, autoExpand) {
    const parent = link.parentNode;
    const isVideo = VIDEO_TYPES.has(mime);
    const media = document.createElement(isVideo ? 'video' : 'audio');
    if (isVideo) media.loop = localStorage.noAutoLoop !== 'true';
    media.controls = true;
    media.style.display = 'none';

    const container = document.createElement('span');
    const hideLink = makeHideLink();
    const thumbLink = cloneThumbLink(link, mime);
    const src = document.createElement('source');
    src.src = link.href;
    src.type = mime;

    wireToggle(
      parent,
      thumbLink,
      media,
      hideLink,
      () => {
        if (!media.querySelector('source')) media.appendChild(src);
        media.play();
      },
      () => media.pause()
    );

    container.append(hideLink, media, thumbLink);
    parent.replaceChild(container, link);
    if (autoExpand) thumbLink.onclick({ which: 1 });
  },

  setYoutube(link, autoExpand) {
    const match = link.href.match(YT_RE);
    if (!match) return;

    const parent = link.parentNode;
    const embedUrl = 'https://www.youtube.com/embed/' + match[1];
    const container = document.createElement('span');
    const hideLink = makeHideLink();
    const thumbLink = cloneThumbLink(link, 'youtube/video');

    const iframe = document.createElement('iframe');
    iframe.width = '640';
    iframe.height = '360';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    iframe.allowFullscreen = true;
    // The site sends `Referrer-Policy: no-referrer` on every page, and an iframe
    // with no policy of its own inherits that. YouTube refuses to play without a
    // referrer ("Video player configuration error 153"), so ask for the origin
    // here - the same thing the server-rendered [Embed] iframes set.
    iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    iframe.style.maxWidth = '100%';
    iframe.style.display = 'none';

    wireToggle(
      parent,
      thumbLink,
      iframe,
      hideLink,
      () => {
        if (!iframe.src) iframe.src = embedUrl;
      },
      () => {
        iframe.removeAttribute('src');
      }
    );

    container.append(hideLink, iframe, thumbLink);
    parent.replaceChild(container, link);
    if (autoExpand) thumbLink.onclick({ which: 1 });
  },

  processImageLink(link) {
    const mime = link.getAttribute('data-mime') || '';
    if (mime.startsWith('image/')) {
      link.addEventListener('click', (e) => {
        if (isModifiedClick(e)) return;
        e.preventDefault();
        this.expandImage(e, link, mime);
      });
    } else if (PLAYABLE_TYPES.has(mime)) {
      link.addEventListener(
        'click',
        (e) => {
          if (isModifiedClick(e)) return;
          e.preventDefault();
          this.setPlayer(link, mime, true);
        },
        { once: true }
      );
    } else if (mime === 'youtube/video') {
      link.addEventListener(
        'click',
        (e) => {
          if (isModifiedClick(e)) return;
          e.preventDefault();
          this.setYoutube(link, true);
        },
        { once: true }
      );
    }
  }
};

window.initializeThumbnails = function () {
  document.querySelectorAll('.image-container:not([data-initialized])').forEach((container) => {
    const link = container.querySelector('.media-toggle');
    if (!link) return;
    container.dataset.initialized = 'true';
    thumbs.processImageLink(link);
  });
};

window.thumbs = thumbs;

(function () {
  const MARGIN = 13.3333;

  let hoverPreview = null;
  let hoverPreviewParams = null;
  let bound = false;
  let enabled = false;
  let follow = false;
  let restrict = false;

  function refreshFlags() {
    enabled = localStorage.getItem('imagePreviewHover') === 'true';
    follow = localStorage.getItem('imagePreviewFollowCursor') === 'true';
    restrict = localStorage.getItem('imagePreviewRestrictSize') === 'true';
  }

  function headerHeight() {
    const header = document.querySelector('.header');
    return header ? header.offsetHeight : 24;
  }

  function getHoverTarget(el) {
    if (!(el instanceof Element)) return null;
    const img = el.closest('.thread-image, .reply-image, .catalog-image');
    if (!img || img.style.display === 'none') return null;
    const link = img.closest('.media-toggle');
    if (!link) return null;
    const mime = link.getAttribute('data-mime') || '';
    if (!mime.startsWith('image/')) return null;
    const expanded = link.querySelector('.img-expanded');
    if (expanded && expanded.style.display !== 'none' && expanded.src) return null;
    const full = img.dataset.full || link.getAttribute('href');
    if (!full || full === img.getAttribute('src')) return null;
    return { link, img, full };
  }

  function getFileDimensions(link, img) {
    let fileWidth = parseInt(link.dataset.fileWidth, 10);
    let fileHeight = parseInt(link.dataset.fileHeight, 10);
    if (fileWidth > 0 && fileHeight > 0) return { fileWidth, fileHeight };
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      return { fileWidth: img.naturalWidth, fileHeight: img.naturalHeight };
    }
    return {
      fileWidth: parseInt(img.getAttribute('width'), 10) || 200,
      fileHeight: parseInt(img.getAttribute('height'), 10) || 200
    };
  }

  function updateHoverPreviewPosition(clientX, clientY) {
    if (!hoverPreview || !hoverPreviewParams) return;

    const { thumb, rect, fileWidth, fileHeight, headerH } = hoverPreviewParams;
    const margin = MARGIN * (clientX === undefined ? 1 : 2);
    const { clientWidth, clientHeight } = document.documentElement;

    const startLeft = clientX === undefined ? rect.left : clientX;
    const startRight = clientX === undefined ? rect.right : clientX;
    const spaceLeft = startLeft - margin * 2;
    const spaceRight = clientWidth - startRight - margin * 2;
    const appearLeft = spaceLeft > spaceRight;
    const maxHoverW = restrict ? (appearLeft ? spaceLeft : spaceRight) : clientWidth - margin * 2;
    const maxHoverH = clientHeight - headerH - margin * 2;
    const scale = Math.min(1, maxHoverW / fileWidth, maxHoverH / fileHeight);

    hoverPreview.style.maxWidth = `${maxHoverW}px`;
    hoverPreview.style.maxHeight = `${maxHoverH}px`;
    hoverPreview.style.left = '';
    hoverPreview.style.right = '';

    if (appearLeft) {
      if (restrict || fileWidth * scale < spaceLeft) {
        hoverPreview.style.right = `${clientWidth - startLeft + margin}px`;
      } else {
        hoverPreview.style.left = `${margin}px`;
      }
    } else if (restrict || fileWidth * scale < spaceRight) {
      hoverPreview.style.left = `${startRight + margin}px`;
    } else {
      hoverPreview.style.right = `${clientWidth - maxHoverW - margin}px`;
    }

    const hoverHeight = fileHeight * scale;
    const wantedTop =
      clientY !== undefined ? clientY - hoverHeight / 2 : rect.top + thumb.offsetHeight / 2 - hoverHeight / 2;
    const minTop = headerH + margin;
    const maxTop = clientHeight - hoverHeight - margin;
    hoverPreview.style.top = `${wantedTop < minTop ? minTop : wantedTop > maxTop ? maxTop : wantedTop}px`;
  }

  function hideHoverPreview() {
    hoverPreview?.remove();
    hoverPreview = null;
    hoverPreviewParams = null;
    document.removeEventListener('pointermove', onHoverMove);
  }

  function onHoverMove(e) {
    const { clientX, clientY } = e;
    if (hoverPreview && hoverPreviewParams?.thumb?.contains(document.elementFromPoint(clientX, clientY))) {
      if (follow) updateHoverPreviewPosition(clientX, clientY);
      return;
    }
    hideHoverPreview();
  }

  function onImgLinkHover(data) {
    const { link, img, full } = data;
    const { fileWidth, fileHeight } = getFileDimensions(link, img);
    if (!fileWidth || !fileHeight) return;

    hideHoverPreview();

    hoverPreviewParams = {
      thumb: img,
      link,
      rect: img.getBoundingClientRect(),
      fileWidth,
      fileHeight,
      headerH: headerHeight()
    };

    hoverPreview = document.createElement('img');
    hoverPreview.className = 'hover-preview';
    hoverPreview.onerror = () => hideHoverPreview();
    hoverPreview.src = full;
    document.body.append(hoverPreview);
    updateHoverPreviewPosition();
    document.addEventListener('pointermove', onHoverMove);
  }

  function onPointerEnter(e) {
    if (!enabled) return;
    const data = getHoverTarget(e.target);
    if (data) onImgLinkHover(data);
  }

  function onDocumentPointerLeave(e) {
    if (e.relatedTarget === null) hideHoverPreview();
  }

  function bind() {
    if (bound) return;
    bound = true;
    document.addEventListener('pointerenter', onPointerEnter, true);
    document.addEventListener('click', hideHoverPreview, true);
    document.documentElement.addEventListener('pointerleave', onDocumentPointerLeave);
  }

  function unbind() {
    if (!bound) return;
    bound = false;
    document.removeEventListener('pointerenter', onPointerEnter, true);
    document.removeEventListener('click', hideHoverPreview, true);
    document.documentElement.removeEventListener('pointerleave', onDocumentPointerLeave);
    hideHoverPreview();
  }

  window.imagePreview = {
    update() {
      refreshFlags();
      if (enabled) bind();
      else unbind();
    }
  };
})();

function initThumbPage() {
  initializeThumbnails();
  window.imagePreview.update();
}

document.addEventListener('DOMContentLoaded', initThumbPage);
document.addEventListener('contentAdded', initializeThumbnails);
