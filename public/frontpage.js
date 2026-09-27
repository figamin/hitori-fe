(function () {
    'use strict';

    function updateClock() {
        var now = new Date();

        var dateStr = 'Today is ' + now.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });

        var timeStr = now.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });

        document.querySelectorAll('.clock-date').forEach(function (el) {
            el.textContent = dateStr;
        });
        document.querySelectorAll('.clock-time').forEach(function (el) {
            el.textContent = timeStr;
        });

        var currentHour = now.getHours();
        var iconSrc = (currentHour >= 6 && currentHour < 18) 
            ? 'items/icons/daytime.gif' 
            : 'items/icons/nighttime.gif';

        document.querySelectorAll('.clock-icon').forEach(function (el) {
            if (el.getAttribute('src') !== iconSrc) {
                el.setAttribute('src', iconSrc);
            }
        });
    }

    updateClock();
    setInterval(updateClock, 1000);

    var navQuotes = [
        "No AiDee required to post!.",
        "One more time! One more time!.",
        "World is ours.",
        "I'll Miku-Miku the hell outta you.",
        "Rettou Joutou, Bring it on!.",
        "Control your range and pitch.",
        "The first sound of the future.",
        "When darkness surrounds us, where do we go?.",
        "Thank you riipah.",
        "That's still a lot of Miku.",
        "For the freaks, the weirdos, the crazies.",
        "In Hatsune Miku we trust.",
        "Oi Anon! Welcome to 39chan!.",
        "We know how to spell paradichlorobenzene.",
        "Tako Luka Maguro Fever!.",
    ];

    var navQuoteEl = document.getElementById('navQuote');
    if (navQuoteEl) {
        var randomQuote = navQuotes[Math.floor(Math.random() * navQuotes.length)];
        navQuoteEl.textContent = '\u201C' + randomQuote + '\u201D';
    }

    var body = document.body;
    var backdrop = document.getElementById('backdrop');
    var sidebar = document.querySelector('.sidebar');
    var panel = document.querySelector('.panel');
    var menuBtn = document.getElementById('menuBtn');
    var dock = document.getElementById('dock');
    var dockButtons = dock ? dock.querySelectorAll('.nav-item[data-nav]') : [];
    var homeBtn = dock ? dock.querySelector('.nav-item[data-nav="home"]') : null;

    function setActiveDockButton(activeNav) {
        dockButtons.forEach(function (btn) {
            btn.classList.toggle('active', btn.dataset.nav === activeNav);
        });
    }

    function openDrawer(drawer, activeNav) {
        if (!drawer) return;
        [sidebar, panel].forEach(function (d) {
            if (d) d.classList.remove('drawer-open');
        });
        drawer.classList.add('drawer-open');
        if (backdrop) backdrop.classList.add('active');
        body.classList.add('drawer-locked');
        if (menuBtn) menuBtn.setAttribute('aria-expanded', drawer === sidebar ? 'true' : 'false');
        if (activeNav) setActiveDockButton(activeNav);
    }

    function closeDrawers() {
        [sidebar, panel].forEach(function (d) {
            if (d) d.classList.remove('drawer-open');
        });
        if (backdrop) backdrop.classList.remove('active');
        body.classList.remove('drawer-locked');
        if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
        setActiveDockButton('home');
    }

    if (menuBtn) {
        menuBtn.addEventListener('click', function () {
            var isOpen = sidebar && sidebar.classList.contains('drawer-open');
            if (isOpen) {
                closeDrawers();
            } else {
                openDrawer(sidebar, 'info');
            }
        });
    }

    dockButtons.forEach(function (btn) {
        btn.addEventListener('click', function () {
            var nav = btn.dataset.nav;
            if (nav === 'info') {
                openDrawer(sidebar, 'info');
            } else if (nav === 'threads') {
                openDrawer(panel, 'threads');
            } else if (nav === 'search') {
                closeDrawers();
                if (topbar) topbar.classList.add('search-active');
                var input = document.getElementById('searchInput');
                if (input) input.focus();
                setActiveDockButton('search');
            } else if (nav === 'home') {
                closeDrawers();
                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
            }
        });
    });

    document.querySelectorAll('[data-drawer-close]').forEach(function (btn) {
        btn.addEventListener('click', closeDrawers);
    });

    if (backdrop) {
        backdrop.addEventListener('click', closeDrawers);
    }

    var topbar = document.getElementById('topbar');
    var searchBtn = document.getElementById('searchBtn');
    var searchCancel = document.getElementById('searchCancel');

    if (searchBtn && topbar) {
        searchBtn.addEventListener('click', function () {
            topbar.classList.add('search-active');
            var input = document.getElementById('searchInput');
            if (input) input.focus();
        });
    }

    if (searchCancel && topbar) {
        searchCancel.addEventListener('click', function () {
            topbar.classList.remove('search-active');
        });
    }

    var scroller = document.getElementById('scroller');
    if (scroller) {
        var isPointerDown = false;
        var dragMoved = false;
        var startX = 0;
        var startScrollLeft = 0;

        function dragStart(x) {
            isPointerDown = true;
            dragMoved = false;
            startX = x;
            startScrollLeft = scroller.scrollLeft;
            scroller.classList.add('dragging');
        }

        function dragMove(x) {
            if (!isPointerDown) return;
            var delta = x - startX;
            if (Math.abs(delta) > 5) dragMoved = true;
            scroller.scrollLeft = startScrollLeft - delta;
        }

        function dragEnd() {
            isPointerDown = false;
            scroller.classList.remove('dragging');
        }

        scroller.addEventListener('mousedown', function (e) {
            e.preventDefault();
            dragStart(e.pageX);
        });
        window.addEventListener('mousemove', function (e) {
            if (isPointerDown) {
                dragMove(e.pageX);
            }
        });
        window.addEventListener('mouseup', dragEnd);

        scroller.addEventListener('touchstart', function (e) {
            dragStart(e.touches[0].pageX);
        }, {
            passive: true
        });
        scroller.addEventListener('touchmove', function (e) {
            dragMoved = Math.abs(e.touches[0].pageX - startX) > 5 || dragMoved;
        }, {
            passive: true
        });
        scroller.addEventListener('touchend', dragEnd);

        scroller.addEventListener('click', function (e) {
            if (dragMoved) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, true);

        scroller.addEventListener('wheel', function (e) {
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                scroller.scrollLeft += e.deltaY;
                e.preventDefault();
            }
        }, {
            passive: false
        });
    }

    if (localStorage.getItem('hideNsfw') === 'true') {
        body.classList.add('nsfw-hidden');
    }

    var nsfwBtn = document.getElementById('toggleNsfw');
    if (nsfwBtn) {
        nsfwBtn.textContent = body.classList.contains('nsfw-hidden') ? 'Show NSFW Boards' : 'Hide NSFW Boards';

        nsfwBtn.addEventListener('click', function () {
            var hidden = body.classList.toggle('nsfw-hidden');
            nsfwBtn.textContent = hidden ? 'Show NSFW Boards' : 'Hide NSFW Boards';
            localStorage.setItem('hideNsfw', hidden);
        });
    }

    document.querySelectorAll('.board[data-href]').forEach(function (boardEl) {
        boardEl.addEventListener('click', function (e) {
            if (e.target.closest('a')) return;
            window.location.href = boardEl.dataset.href;
        });
        boardEl.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                window.location.href = boardEl.dataset.href;
            }
        });
    });

    document.querySelectorAll('.clock-icon').forEach(function (iconEl) {
        iconEl.addEventListener('click', function () {
            var num = Math.floor(Math.random() * 4) + 1;
            var sfx = new Audio('items/miku' + num + '.wav');
            sfx.play().catch(function () {});
        });
    });

    var konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    var tetoCode = konamiCode.slice().reverse();
    var adamCode = ['a', 'd', 'a', 'm', 's', 'a', 'n'];
    var konamiProgress = 0;
    var tetoProgress = 0;
    var adamProgress = 0;

    var selectSfx = new Audio('items/select.wav');
    var selectTetoSfx = new Audio('items/select_teto.wav');

    function playSelectSfx() {
        selectSfx.currentTime = 0;
        selectSfx.play().catch(function () {});
    }

    function playSelectTetoSfx() {
        selectTetoSfx.currentTime = 0;
        selectTetoSfx.play().catch(function () {});
    }

    function showSecretToast(message, iconSrc) {
        var toast = document.createElement('div');
        toast.className = 'miku-toast';

        var icon = document.createElement('img');
        icon.src = iconSrc;
        icon.alt = '';
        icon.className = 'miku-toast-icon';
        toast.appendChild(icon);

        var text = document.createElement('span');
        text.textContent = message;
        toast.appendChild(text);

        document.body.appendChild(toast);

        requestAnimationFrame(function () {
            toast.classList.add('visible');
        });

        setTimeout(function () {
            toast.classList.remove('visible');
            setTimeout(function () {
                toast.remove();
            }, 300);
        }, 5000);
    }

    if (localStorage.getItem('mikuMode') === 'true') {
        document.body.classList.add('miku-mode');
    } else if (localStorage.getItem('tetoMode') === 'true') {
        document.body.classList.add('teto-mode');
    }

    var logoImgs = document.querySelectorAll('.logo img, .brand img');

    function applyAdamLogos(active) {
        logoImgs.forEach(function (img) {
            if (!img.dataset.originalSrc) {
                img.dataset.originalSrc = img.getAttribute('src');
            }
            img.src = active ? 'items/adam.png' : img.dataset.originalSrc;
        });
    }

    var adamActive = false;

    document.addEventListener('keydown', function (e) {
        var pressedKey = e.key.length === 1 ? e.key.toLowerCase() : e.key;

        var expectedKonamiKey = konamiCode[konamiProgress];
        if (pressedKey === expectedKonamiKey) {
            konamiProgress++;
            if (konamiProgress === konamiCode.length) {
                document.body.classList.remove('teto-mode');
                localStorage.removeItem('tetoMode');

                var isActive = document.body.classList.toggle('miku-mode');
                localStorage.setItem('mikuMode', isActive);

                playSelectSfx();

                if (isActive && localStorage.getItem('mikuModeSeen') !== 'true') {
                    localStorage.setItem('mikuModeSeen', 'true');
                    showSecretToast('Congratulations! You found the secret Miku theme, to disable it simply enter the konami code again.', 'items/dayosecret.png');
                }

                konamiProgress = 0;
                tetoProgress = 0;
            }
        } else {
            konamiProgress = (pressedKey === konamiCode[0]) ? 1 : 0;
        }

        var expectedTetoKey = tetoCode[tetoProgress];
        if (pressedKey === expectedTetoKey) {
            tetoProgress++;
            if (tetoProgress === tetoCode.length) {
                document.body.classList.remove('miku-mode');
                localStorage.removeItem('mikuMode');

                var tetoActive = document.body.classList.toggle('teto-mode');
                localStorage.setItem('tetoMode', tetoActive);

                playSelectTetoSfx();

                if (tetoActive && localStorage.getItem('tetoModeSeen') !== 'true') {
                    localStorage.setItem('tetoModeSeen', 'true');
                    showSecretToast('Congratulations! You found the secret Teto theme, to disable it simply enter the konami code backwards again.', 'items/dayosecret.png');
                }

                tetoProgress = 0;
                konamiProgress = 0;
            }
        } else {
            tetoProgress = (pressedKey === tetoCode[0]) ? 1 : 0;
        }

        var expectedAdamKey = adamCode[adamProgress];
        if (pressedKey === expectedAdamKey) {
            adamProgress++;
            if (adamProgress === adamCode.length) {
                adamActive = !adamActive;
                applyAdamLogos(adamActive);

                playSelectSfx();

                if (adamActive && localStorage.getItem('adamModeSeen') !== 'true') {
                    localStorage.setItem('adamModeSeen', 'true');
                    showSecretToast('You are now ready to rock n roll this house', 'items/dayosecret.png');
                }

                adamProgress = 0;
            }
        } else {
            adamProgress = (pressedKey === adamCode[0]) ? 1 : 0;
        }
    });
})();

//hail vocadb

(function () {
  "use strict";

  var API_BASE = "https://vocadb.net/api";
  var VOCADB_SITE = "https://vocadb.net";

  var WEEK_HOURS = 24 * 7;
  var MONTH_HOURS = 24 * 30;

  var SONGS_LIMIT = 8;
  var PRODUCERS_LIMIT = 8;

  var ORIGINAL_SONG_TYPE = "Original";

  function whenReady(ids, callback, attemptsLeft) {
    attemptsLeft = attemptsLeft === undefined ? 50 : attemptsLeft;
    var elements = ids.map(function (id) {
      return document.getElementById(id);
    });

    if (elements.every(Boolean)) {
      callback.apply(null, elements);
      return;
    }

    if (attemptsLeft <= 0) {
      return;
    }

    window.setTimeout(function () {
      whenReady(ids, callback, attemptsLeft - 1);
    }, 100);
  }

  function fetchJson(url) {
    return fetch(url, {
      headers: { Accept: "application/json" },
    }).then(function (response) {
      if (!response.ok) {
        throw new Error("VocaDB request failed (" + response.status + ")");
      }
      return response.json();
    });
  }

  function buildTopRatedUrl(durationHours, maxResults) {
    var params = new URLSearchParams({
      durationHours: String(durationHours),
      filterBy: "PublishDate",
      maxResults: String(maxResults),
      fields: "Artists,ThumbUrl",
      sort: "RatingScore",
      lang: "English",
    });
    return API_BASE + "/songs/top-rated?" + params.toString();
  }

  function isOriginalSong(song) {
    return song && song.songType === ORIGINAL_SONG_TYPE;
  }

  function isProducerArtist(artistLink) {
    var categories = (artistLink.categories || "").toLowerCase();
    var roles = (artistLink.effectiveRoles || artistLink.roles || "").toLowerCase();
    return (
      categories.indexOf("producer") !== -1 ||
      roles.indexOf("composer") !== -1 ||
      roles.indexOf("arranger") !== -1
    );
  }

  function getProducerName(song) {
    var artists = (song && song.artists) || [];
    for (var i = 0; i < artists.length; i++) {
      if (isProducerArtist(artists[i]) && artists[i].artist) {
        return artists[i].name || artists[i].artist.name;
      }
    }
    return null;
  }

  function buildArtistUrl(artistId) {
    var params = new URLSearchParams({
      fields: "MainPicture",
      lang: "English",
    });
    return API_BASE + "/artists/" + artistId + "?" + params.toString();
  }

  function fetchArtistIconUrl(artistId) {
    return fetchJson(buildArtistUrl(artistId))
      .then(function (artist) {
        var pic = artist && artist.mainPicture;
        if (!pic) {
          return null;
        }
        return pic.urlSmallThumb || pic.urlTinyThumb || pic.urlThumb || pic.urlOriginal || null;
      })
      .catch(function (err) {
        console.error("Failed to load artist icon:", err);
        return null;
      });
  }

  function renderMessage(listEl, message, className) {
    listEl.innerHTML = "";
    var li = document.createElement("li");
    li.className = className || "dim";
    li.textContent = message;
    listEl.appendChild(li);
  }

  function renderLoading(listEl) {
    listEl.innerHTML = "";
    var li = document.createElement("li");
    li.className = "ranklist-loading";

    var img = document.createElement("img");
    img.src = "items/icons/loading.gif";
    img.alt = "Loading...";

    li.appendChild(img);
    listEl.appendChild(li);
  }

  function renderSongs(listEl) {
    renderLoading(listEl);

    fetchJson(buildTopRatedUrl(WEEK_HOURS, 40))
      .then(function (songs) {
        var originals = (songs || []).filter(isOriginalSong).slice(0, SONGS_LIMIT);

        if (!originals.length) {
          renderMessage(listEl, "No trending original songs found this week.", "dim");
          return;
        }

        listEl.innerHTML = "";
        originals.forEach(function (song, index) {
          var li = document.createElement("li");

          var rankBadge = document.createElement("span");
          rankBadge.className = "rank";
          rankBadge.textContent = String(index + 1);

          if (index === 0) {
            li.className = "featured-row";

            var featuredLink = document.createElement("a");
            featuredLink.className = "featured-link";
            featuredLink.href = VOCADB_SITE + "/S/" + song.id;
            featuredLink.target = "_blank";
            featuredLink.rel = "noopener";
            featuredLink.title = song.name || "Untitled";

            var top = document.createElement("div");
            top.className = "rank-featured-top";
            top.appendChild(rankBadge);

            var titleSpan = document.createElement("span");
            titleSpan.className = "rank-title";
            titleSpan.textContent = song.name || "Untitled";
            top.appendChild(titleSpan);

            featuredLink.appendChild(top);

            if (song.thumbUrl) {
              var thumb = document.createElement("img");
              thumb.className = "thumb-icon";
              thumb.alt = "";
              thumb.src = song.thumbUrl;
              featuredLink.appendChild(thumb);
            }

            var producerName = getProducerName(song);
            if (producerName) {
              var sub = document.createElement("span");
              sub.className = "rank-featured-sub";
              sub.textContent = producerName;
              featuredLink.appendChild(sub);
            }

            li.appendChild(featuredLink);
          } else {
            var link = document.createElement("a");
            link.href = VOCADB_SITE + "/S/" + song.id;
            link.target = "_blank";
            link.rel = "noopener";
            link.textContent = song.name || "Untitled";
            link.title = song.name || "Untitled";

            li.appendChild(rankBadge);
            li.appendChild(link);
          }

          listEl.appendChild(li);
        });
      })
      .catch(function (err) {
        console.error("Failed to load songs:", err);
        renderMessage(listEl, "Couldn't load songs from VocaDB right now.", "error");
      });
  }

  function renderProducers(listEl) {
    renderLoading(listEl);

    fetchJson(buildTopRatedUrl(MONTH_HOURS, 50))
      .then(function (songs) {
        var originals = (songs || []).filter(isOriginalSong);

        if (!originals.length) {
          renderMessage(listEl, "No trending producers found this month.", "dim");
          return;
        }

        var producers = {};

        originals.forEach(function (song) {
          var artists = song.artists || [];
          artists.forEach(function (artistLink) {
            if (!isProducerArtist(artistLink) || !artistLink.artist) {
              return;
            }

            var artist = artistLink.artist;
            var id = artist.id;
            if (!producers[id]) {
              producers[id] = {
                id: id,
                name: artistLink.name || artist.name,
                score: 0
              };
            }
            producers[id].score += song.ratingScore || 0;
          });
        });

        var ranked = Object.keys(producers)
          .map(function (id) {
            return producers[id];
          })
          .sort(function (a, b) {
            return b.score - a.score;
          })
          .slice(0, PRODUCERS_LIMIT);

        if (!ranked.length) {
          renderMessage(listEl, "No trending producers found this month.", "dim");
          return;
        }

        listEl.innerHTML = "";
        ranked.forEach(function (producer, index) {
          var li = document.createElement("li");

          var rankBadge = document.createElement("span");
          rankBadge.className = "rank";
          rankBadge.textContent = String(index + 1);

          if (index === 0) {
            li.className = "featured-row";

            var featuredLink = document.createElement("a");
            featuredLink.className = "featured-link";
            featuredLink.href = VOCADB_SITE + "/Ar/" + producer.id;
            featuredLink.target = "_blank";
            featuredLink.rel = "noopener";
            featuredLink.title = producer.name;

            var top = document.createElement("div");
            top.className = "rank-featured-top";
            top.appendChild(rankBadge);

            var titleSpan = document.createElement("span");
            titleSpan.className = "rank-title";
            titleSpan.textContent = producer.name;
            top.appendChild(titleSpan);

            featuredLink.appendChild(top);
            li.appendChild(featuredLink);

            fetchArtistIconUrl(producer.id).then(function (iconUrl) {
              if (!iconUrl) {
                return;
              }
              var icon = document.createElement("img");
              icon.className = "rank-icon";
              icon.alt = "";
              icon.src = iconUrl;
              featuredLink.appendChild(icon);
            });
          } else {
            var link = document.createElement("a");
            link.href = VOCADB_SITE + "/Ar/" + producer.id;
            link.target = "_blank";
            link.rel = "noopener";
            link.textContent = producer.name;
            link.title = producer.name;

            li.appendChild(rankBadge);
            li.appendChild(link);
          }

          listEl.appendChild(li);
        });
      })
      .catch(function (err) {
        console.error("Failed to load producers:", err);
        renderMessage(listEl, "Couldn't load producers from VocaDB right now.", "error");
      });
  }

  function init() {
    whenReady(["producersList", "songsList"], function (producersList, songsList) {
      renderProducers(producersList);
      renderSongs(songsList);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.addEventListener("vocadb-rankings-refresh", init);
})();

(function () {
    'use strict';

    var STORAGE_KEY = 'colapse';

    function readState() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
        } catch (e) {
            return {};
        }
    }

    function writeState(state) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) {}
    }

    var state = readState();

    document.querySelectorAll('.box[data-collapse-key]').forEach(function (box) {
        var key = box.dataset.collapseKey;
        var btn = box.querySelector('.collapse-toggle');
        var content = box.querySelector('.collapsible');
        if (!btn) return;

        if (state[key]) {
            if (content) content.classList.add('no-anim');
            box.classList.add('collapsed');
            btn.setAttribute('aria-expanded', 'false');
            btn.innerHTML = '&plus;';
            if (content) {
                requestAnimationFrame(function () {
                    requestAnimationFrame(function () {
                        content.classList.remove('no-anim');
                    });
                });
            }
        }

        btn.addEventListener('click', function () {
            var collapsed = box.classList.toggle('collapsed');
            btn.setAttribute('aria-expanded', String(!collapsed));
            btn.innerHTML = collapsed ? '&plus;' : '&minus;';
            state[key] = collapsed;
            writeState(state);
        });
    });
})();

(function () {
    'use strict';

    // you already know what this does
    var currentYear = new Date().getFullYear();
    var yearRangePattern = /(©\s*\d{4}-)\d{4}/;

    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
        if (yearRangePattern.test(node.nodeValue)) {
            node.nodeValue = node.nodeValue.replace(yearRangePattern, function (match, prefix) {
                return prefix + currentYear;
            });
        }
    }
})();

(function () {
    'use strict';

    // Topbar search: pressing Enter submits to the Express /search route.
    var input = document.getElementById('searchInput');
    if (!input) return;

    input.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        var query = input.value.trim();
        window.location.href = '/search' + (query ? '?general=' + encodeURIComponent(query) : '');
    });
})();

(function () {
    'use strict';

    // Keeps two kinds of timestamp fresh without a page reload:
    //  - ACTIVE THREADS ".relative-time"  -> "X minutes/hours/days ago"
    //    (mirrors activeTimeLabel() in index.ejs)
    //  - per-board RECENT ".board-time"   -> "Today, 11:37 AM" / "Yesterday, ..."
    //    (mirrors boardTimeLabel() in index.ejs)
    var relativeNodes = document.querySelectorAll('.relative-time[data-ts]');
    var boardNodes = document.querySelectorAll('.board-time[data-ts]');
    if (!relativeNodes.length && !boardNodes.length) return;

    function formatRelativeTime(ts) {
        var diffMin = Math.floor((Date.now() - ts) / 60000);
        if (diffMin < 1) return 'Just now';
        if (diffMin < 60) return diffMin + ' minute' + (diffMin === 1 ? '' : 's') + ' ago';

        var hours = Math.floor(diffMin / 60);
        var mins = diffMin % 60;
        if (hours < 24) {
            var hourStr = hours + ' hour' + (hours === 1 ? '' : 's');
            return mins === 0 ? hourStr + ' ago' : hourStr + ', ' + mins + ' minute' + (mins === 1 ? '' : 's') + ' ago';
        }

        var days = Math.floor(hours / 24);
        if (days < 30) return days + ' day' + (days === 1 ? '' : 's') + ' ago';

        var months = Math.floor(days / 30);
        if (months < 12) return months + ' month' + (months === 1 ? '' : 's') + ' ago';

        var years = Math.floor(months / 12);
        return years + ' year' + (years === 1 ? '' : 's') + ' ago';
    }

    function formatBoardTime(ts) {
        var diffMin = Math.floor((Date.now() - ts) / 60000);
        if (diffMin < 1) return 'Just now';

        var d = new Date(ts);
        var now = new Date();
        var timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        var startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        var startOfThat = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        var dayDiff = Math.round((startOfToday - startOfThat) / 86400000);

        if (dayDiff === 0) return 'Today, ' + timeStr;
        if (dayDiff === 1) return 'Yesterday, ' + timeStr;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + timeStr;
    }

    function tick() {
        relativeNodes.forEach(function (el) {
            var ts = Number(el.dataset.ts);
            if (!ts) return;
            el.textContent = formatRelativeTime(ts);
        });
        boardNodes.forEach(function (el) {
            var ts = Number(el.dataset.ts);
            if (!ts) return;
            el.textContent = formatBoardTime(ts);
        });
    }

    tick();
    // Every 30s is plenty for labels whose smallest unit is one minute.
    setInterval(tick, 30000);
})();