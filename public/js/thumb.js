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
const NICO_RE = /(?:nicovideo\.jp\/watch\/|nico\.ms\/)((?:sm|nm|so|lv)\d+)/i;
const TWEET_RE = /(?:twitter|x|fxtwitter|fixupx|twittpr|fixvx)\.com\/(?:i\/(?:web\/)?|[\w.]+\/)?status(?:es)?\/(\d+)/i;
const BSKY_RE = /(?:bsky\.app|fxbsky\.app|bsky\.social)\/profile\/([\w.:%-]+)\/post\/([a-z0-9]+)/i;
const BILI_BV_RE = /bilibili\.com\/video\/(BV[0-9A-Za-z]{10})/i;
const BILI_AV_RE = /bilibili\.com\/video\/[aA][vV](\d+)/;
const BILI_PAGE_RE = /[?&]p=(\d+)/i;
const BILI_PLAYER_RE = /^https:\/\/player\.bilibili\.com\/player\.html\?/i;
const CYTUBE_RE = /cytu\.be\/r\/([\w-]{1,30})/i;
// One path segment only, and the host anchored - so `/directory/game/x` and
// `clips.twitch.tv/<slug>` are not read as a channel.
const TWITCH_CHANNEL_RE = /(?:^|\/\/)(?:www\.|m\.)?twitch\.tv\/([A-Za-z0-9_]+)\/?(?:[?#]|$)/i;
const TWITCH_VOD_RE = /(?:^|\/\/)(?:www\.|m\.)?twitch\.tv\/videos\/(\d+)/i;
const TWITCH_CLIP_RE = /(?:^|\/\/)(?:www\.|m\.)?clips\.twitch\.tv\/([A-Za-z0-9_-]+)/i;
const TWITCH_CHANNEL_CLIP_RE = /(?:^|\/\/)(?:www\.|m\.)?twitch\.tv\/[A-Za-z0-9_]+\/clip\/([A-Za-z0-9_-]+)/i;
// A Vocaroo recording: the id in a share link (`vocaroo.com/<id>`, `voca.ro/<id>`),
// an `embed/` URL or the CDN's `mp3/` path. The id is opaque, so this is the same
// shape `be/lib/vocaroo.js` accepts - and a link that is not a recording (their
// `/about`) is not read as one.
const VOCAROO_RE =
  /(?:^|\/\/)(?:[a-z0-9-]+\.)?(?:vocaroo\.com|voca\.ro)\/(?:e(?:mbed)?\/|i\/|mp3\/)?([A-Za-z0-9_-]{8,32})(?:[/?#]|$)/i;
const VOCAROO_MP3_BASE = 'https://media.vocaroo.com/mp3/';
const VOCAROO_EMBED_BASE = 'https://vocaroo.com/embed/';

function vocarooIdFrom(href) {
  const match = String(href || '').match(VOCAROO_RE);
  return match ? match[1] : null;
}

// Vocaroo's own player, asked not to autoplay - the form their embed code uses.
// This is the fallback for a recording their CDN will not serve any more: without
// it the block could only ever show a silent 0:00.
function vocarooFrame(id) {
  const frame = document.createElement('iframe');
  frame.src = VOCAROO_EMBED_BASE + id + '?autoplay=0';
  frame.width = '640';
  frame.height = '150';
  frame.style.maxWidth = '100%';
  frame.style.marginTop = '3px';
  frame.setAttribute('frameborder', '0');
  frame.setAttribute('allow', 'autoplay; encrypted-media');
  frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  return frame;
}

// An `<audio>` element pointed at the recording, with their player standing in if
// the file cannot be fetched. A failed `<source>` fires `error` on the source, and
// only the media element hears about it when nothing else is left to try - so both
// are watched.
function vocarooAudio(id) {
  const media = document.createElement('audio');
  media.controls = true;
  media.preload = 'metadata';
  media.style.maxWidth = '100%';
  media.style.marginTop = '3px';
  const source = document.createElement('source');
  source.src = VOCAROO_MP3_BASE + id;
  source.type = 'audio/mpeg';
  media.appendChild(source);
  const fallback = () => {
    if (media.isConnected) media.replaceWith(vocarooFrame(id));
  };
  media.addEventListener('error', fallback, { once: true });
  source.addEventListener('error', fallback, { once: true });
  return media;
}

// A posted embed is stored as a file whose `path` is the watch URL; the player
// URL is derived from it here, so YouTube, nicovideo, bilibili and Twitch share
// one code path.
function embedUrlFor(href) {
  const url = String(href || '');
  const youtube = url.match(YT_RE);
  if (youtube) return 'https://www.youtube.com/embed/' + youtube[1];
  const nicovideo = url.match(NICO_RE);
  if (nicovideo) return 'https://embed.nicovideo.jp/watch/' + nicovideo[1].toLowerCase();

  const bilibili = url.match(BILI_BV_RE) || url.match(BILI_AV_RE);
  if (bilibili) {
    // bilibili addresses multi-part videos with `?p=N`.
    const page = (url.match(BILI_PAGE_RE) || [])[1] || '1';
    const id = bilibili[1].startsWith('BV') ? 'bvid=' + bilibili[1] : 'aid=' + bilibili[1];
    return 'https://player.bilibili.com/player.html?' + id + '&page=' + page + '&high_quality=1';
  }

  return twitchPlayerUrlFor(url);
}

// Twitch's player is only served to an https page or a loopback one. Asked with
// `parent=board.example.com` it answers `frame-ancestors https://board.example.com`,
// so an http page on a domain is refused outright ("player.twitch.tv refused to
// connect" in Chrome, a blank frame in Safari) and a LAN address is not accepted
// as a parent at all ("Whoops! This embed is misconfigured"). Checked in a real
// browser: http + localhost, http + 127.0.0.1, https + a domain and https + a
// hostname all play; http + a domain and http + an IP never do. Opening the player
// in its own tab always works, because nothing is framing it there.
const TWITCH_LOOPBACK_RE = /^(?:localhost|127\.0\.0\.1|\[::1\]|.*\.localhost)$/i;
const TWITCH_FRAME_RE = /^https:\/\/(?:player\.twitch\.tv\/\?|clips\.twitch\.tv\/embed\?)/i;

// Why this page cannot hold a Twitch player, in a few words, or null when it can.
// Twitch only frames its player for an https page or a loopback one; it will not
// take a port in `parent`, and a policy for a domain names the default port only,
// so a site on any other port is refused whatever we send (`https://host:2101` is
// "player.twitch.tv refused to connect"); and it does not accept an IP literal as
// an embedding site at all ("Whoops! This embed is misconfigured"). Checked in a
// real browser: http + localhost, http + 127.0.0.1, https + a domain and https + a
// hostname (all on the default port) play; http + a domain, an IP, and a
// non-default port never do. Opening the player in its own tab always works,
// because nothing is framing it there.
function twitchFrameRefusalReason() {
  const { protocol, hostname, port } = window.location;
  if (TWITCH_LOOPBACK_RE.test(hostname)) return null;
  if (/^[\d.]+$/.test(hostname) || hostname.startsWith('[')) return 'Twitch does not accept an IP address as an embedding site';
  if (protocol !== 'https:') return 'Twitch only embeds its player on an https page';
  if (port && port !== '443') return `Twitch only embeds its player on the standard https port, and this site is on :${port}`;
  return null;
}

function twitchCanBeFramed() {
  return twitchFrameRefusalReason() === null;
}

// Where a player URL's stream can be watched, so a frame that cannot be shown here
// is still offered as something to click.
function twitchWatchUrlFor(playerUrl) {
  try {
    const url = new URL(playerUrl);
    const channel = url.searchParams.get('channel');
    if (channel) return 'https://www.twitch.tv/' + channel;
    const video = url.searchParams.get('video');
    if (video) return 'https://www.twitch.tv/videos/' + video;
    const clip = url.searchParams.get('clip');
    if (clip) return 'https://clips.twitch.tv/' + clip;
  } catch {
    /* Not a player URL. */
  }
  return null;
}

// Shown instead of a Twitch player that could only come up blank or refused.
function twitchEmbedNote(watchUrl, reason) {
  const note = document.createElement('span');
  note.className = 'twitch-embed-note';
  note.textContent = `${reason || 'Twitch will not play in a frame on this page'} - `;
  const link = document.createElement('a');
  link.href = watchUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'watch on twitch.tv';
  note.appendChild(link);
  return note;
}

// Players the *server* rendered carry the host it was asked on, which is not
// necessarily the host the reader is on (port forwarding, a proxy or a tunnel can
// rewrite it) - and on a page Twitch will not frame at all, a frame would only ever
// be blank. Both are settled here, before the reader clicks anything; the server
// asks for `loading="lazy"` on these frames (see `be/lib/embeds.js`), which is what
// leaves time for it, and a frame that has already started loading simply reloads.
function fixTwitchFrames(root) {
  const hostname = window.location.hostname;
  const canFrame = twitchCanBeFramed();

  for (const iframe of (root || document).querySelectorAll('iframe[src]')) {
    const src = iframe.getAttribute('src') || '';
    if (!TWITCH_FRAME_RE.test(src)) continue;

    if (!canFrame) {
      const watchUrl = twitchWatchUrlFor(src);
      if (watchUrl) iframe.replaceWith(twitchEmbedNote(watchUrl, twitchFrameRefusalReason()));
      else iframe.remove();
      continue;
    }

    if (!hostname) continue;
    try {
      const url = new URL(src);
      // The reader's own host, whatever the server assumed it was ...
      url.searchParams.set('parent', hostname);
      // ... and no autoplay, whatever the frame was rendered with (Twitch's player
      // starts by itself otherwise, and a page that was rendered before this ran
      // could be carrying an older URL).
      url.searchParams.set('autoplay', 'false');
      const wanted = url.toString();
      // Only rewritten when it actually differs, so this stays idempotent.
      if (src !== wanted) iframe.setAttribute('src', wanted);
    } catch {
      /* Not a URL we can rewrite; leave the player as it was. */
    }
  }
}

// bilibili's player starts playing the moment its frame is loaded, and there is no
// way to ask it to wait: `autoplay=0`, `autoplay=false`, `isOutside=true` and
// leaving the `autoplay` permission off the frame all play anyway (measured in a
// real browser) - and a frame inside a *collapsed* <details> is loaded all the same,
// which is why a bilibili link in a post used to play before the reader expanded
// anything. The only thing that keeps it quiet is not loading it, so the server
// parks the URL in `data-src` (see `embedBlock` in `be/lib/embeds.js`) and it is
// handed over when the block is opened - the same thing the posted embed blocks do
// for themselves (`setEmbedVideo`). A closed block therefore holds no player, and
// closing one takes its player away again.
function loadDeferredEmbeds(root) {
  for (const iframe of (root || document).querySelectorAll('iframe[data-src], iframe[src]')) {
    const details = iframe.closest('details');
    const parked = iframe.getAttribute('data-src');
    // The parked players - and, for a page rendered by a server that did not park
    // them yet, a bilibili frame sitting in a shut block.
    if (!parked && !BILI_PLAYER_RE.test(iframe.getAttribute('src') || '')) continue;

    const load = () => {
      const src = iframe.getAttribute('data-src');
      if (!src) return;
      iframe.removeAttribute('data-src');
      iframe.setAttribute('src', src);
    };
    const unload = () => {
      const src = iframe.getAttribute('src');
      if (!src) return;
      iframe.setAttribute('data-src', src);
      iframe.removeAttribute('src');
    };

    // No block around it: nothing to wait for.
    if (!details) {
      load();
      continue;
    }

    const apply = () => (details.open ? load() : unload());
    if (details.dataset.embedToggle !== 'true') {
      details.dataset.embedToggle = 'true';
      details.addEventListener('toggle', apply);
    }
    apply();
  }
}

// Twitch's player has to be told which domain it is embedded on, and it only
// serves itself to a page on that domain (`frame-ancestors`, see
// `be/lib/twitch.js`) - so the domain is asked of the browser rather than of the
// server, because it is the page the reader actually has open that has to be
// named. A channel plays from player.twitch.tv, a video-on-demand from the same
// place, and a clip from clips.twitch.tv.
function twitchPlayerUrlFor(url) {
  const parent = encodeURIComponent(window.location.hostname);
  // Twitch's player starts playing on its own unless told not to, and nothing on
  // this site plays until the reader presses play (the server-rendered blocks ask
  // for the same - see `twitchEmbedUrl` in `be/lib/twitch.js`).
  const tail = `&parent=${parent}&autoplay=false`;

  const vod = url.match(TWITCH_VOD_RE);
  if (vod) return 'https://player.twitch.tv/?video=' + vod[1] + tail;

  // `clips.twitch.tv/embed` is the player itself, not a clip called "embed".
  const clip = url.match(TWITCH_CLIP_RE) || url.match(TWITCH_CHANNEL_CLIP_RE);
  if (clip && clip[1].toLowerCase() !== 'embed') {
    return 'https://clips.twitch.tv/embed?clip=' + clip[1] + tail;
  }

  const channel = url.match(TWITCH_CHANNEL_RE);
  if (channel) return 'https://player.twitch.tv/?channel=' + channel[1].toLowerCase() + tail;
  return null;
}

// Twitter/X and Bluesky embeds store the *post's* URL rather than a media URL,
// so the raw mp4 is asked of FxEmbed (the service that resolves it in the first
// place) when the player opens, along with the poster frame it hands out. The
// pending lookup is what gets cached, so a page showing the same post twice only
// asks once.
const postVideos = new Map();

function resolvePostVideo(key, apiUrl) {
  const cached = postVideos.get(key);
  if (cached) return cached;

  const pending = fetch(apiUrl)
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      const post = data && (data.tweet || data.status);
      const media = (post && post.media) || {};
      const videos =
        Array.isArray(media.videos) && media.videos.length
          ? media.videos
          : (media.all || []).filter((item) => item && item.type === 'video');
      const video = videos[0];
      return video ? { url: video.url || null, thumb: video.thumbnail_url || null } : null;
    })
    .catch(() => null)
    .then((media) => {
      // A lookup that failed is not remembered, so the next click retries.
      if (!media || !media.url) postVideos.delete(key);
      return media;
    });

  postVideos.set(key, pending);
  return pending;
}

function tweetVideoUrl(href) {
  const match = String(href || '').match(TWEET_RE);
  if (!match) return Promise.resolve(null);
  return resolvePostVideo('twitter:' + match[1], 'https://api.fxtwitter.com/i/status/' + match[1]);
}

function blueskyVideoUrl(href) {
  const match = String(href || '').match(BSKY_RE);
  if (!match) return Promise.resolve(null);
  const [handle, rkey] = [match[1], match[2]];
  return resolvePostVideo('bluesky:' + handle + '/' + rkey, 'https://api.fxbsky.app/2/status/' + handle + '/' + rkey);
}

// CyTube rooms need a different treatment again: cytu.be refuses to be framed
// (every page is served with `X-Frame-Options: DENY`, and its only frameable
// page is a player shell that never joins a channel), so there is no room to put
// in an iframe. Instead the room is asked what it is playing, and that item is
// played here. The question is asked when the reader presses play, so the answer
// is current, and it is remembered per channel for the life of the page.
const cytubeRooms = new Map();

// The last answer from each room, so a player can be put back at the point the
// room is at without being handed its block's state (see `dismissCytubeMoves`).
const cytubeRoomState = new Map();

function cytubeChannelOf(href) {
  const match = String(href || '').match(CYTUBE_RE);
  return match ? match[1].toLowerCase() : null;
}

function cytubeStreamInfo(channel, { refresh = false } = {}) {
  const cached = cytubeRooms.get(channel);
  if (cached && !refresh) return cached;

  // `live=1` asks the server to keep a client joined to the room, so this answer
  // is not just a snapshot and later ones can follow the room as it plays.
  const pending = fetch('/api/cytube/' + encodeURIComponent(channel) + '?live=1')
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null);

  cytubeRooms.set(channel, pending);
  return pending;
}

// Where the room is *now*. The position it reported is moved on by however long
// ago it reported it - an answer can sit in a cache for a few seconds, and the
// room keeps playing while it does - unless the room is paused.
function cytubePosition(info) {
  const at = Number(info.currentTime) || 0;
  if (info.paused || !info.positionAt) return at;
  return at + Math.max(0, Date.now() - Number(info.positionAt)) / 1000;
}

// The player URL, aimed at the point the room is at: the same place a reader
// lands in when they open the room itself. Returns the plain URL when the room is
// at the start (a sub-second offset is not worth asking for).
function cytubePlayerUrl(info) {
  if (!info.embedUrl) return null;
  const url = new URL(info.embedUrl, window.location.origin);
  const seconds = Math.floor(cytubePosition(info));
  if (info.offsetParam && seconds >= 1) url.searchParams.set(info.offsetParam, String(seconds));
  if (info.provider === 'youtube') {
    // So the player reports what it is doing and takes a nudge back into step
    // (see `seekCytubeMedia`); cytu.be's own embeds ask for the same.
    url.searchParams.set('enablejsapi', '1');
    url.searchParams.set('origin', window.location.origin);
  }
  // Nothing is asked for that would start it playing: every embed on this site
  // waits for the reader to press play (see `cytubePlayer`).
  return url.toString();
}

// "16:18" / "1:02:33", the way a player shows a position.
function clockText(seconds) {
  const pad = (value) => String(value).padStart(2, '0');
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return hours ? `${hours}:${pad(minutes)}:${pad(total % 60)}` : `${minutes}:${pad(total % 60)}`;
}

function cytubeTitleText(info) {
  return info.kind === 'none' ? 'Nothing is playing in this room right now' : 'Now playing: ' + (info.title || 'unknown');
}

// The room's position in the item, with its length, or '' when there is neither.
function cytubeTimeText(info) {
  if (info.kind === 'none' || !info.seconds) return '';
  return `${clockText(cytubePosition(info))} / ${clockText(info.seconds)}`;
}

// A note's clock counts up on its own rather than only stepping when the room is
// read again - every few seconds - which is what makes the time jump instead of
// run. Nothing is asked of the room for this: the position it last reported is
// moved on by the time since it reported it (`cytubePosition`), so a room that
// says it is playing reads like a player's clock, and one that says it is paused
// stands still.
const CYTUBE_CLOCK_MIN_MS = 250;
const CYTUBE_CLOCK_MAX_MS = 1000;
const cytubeNotes = new Set();
let cytubeClockTimer = null;

function setCytubeClock(note) {
  const time = note.querySelector('.cytube-time');
  if (!time) return;
  const text = note.cytubeInfo ? cytubeTimeText(note.cytubeInfo) : '';
  const shown = text ? ` \u00b7 ${text}` : '';
  // Written only when the second actually changed, so a paused room - and a note
  // that is collapsed or on a hidden tab - costs nothing.
  if (time.textContent !== shown) time.textContent = shown;
  time.hidden = !text;
}

// One timer for every note on the page, aimed at the next whole second of the
// room's own clock so the display flips when the second does rather than a
// fraction of one later every time, and stopped once the last note is gone.
function runCytubeClock() {
  cytubeClockTimer = null;
  let wait = null;

  for (const note of [...cytubeNotes]) {
    // A note taken off the page is done with (its block re-rendered, or went
    // away); one that is not on the page *yet* is a note still being built.
    if (note.isConnected) note.cytubeInPage = true;
    else if (note.cytubeInPage) {
      cytubeNotes.delete(note);
      continue;
    }

    const info = note.cytubeInfo;
    if (!info) continue;
    if (!document.hidden) setCytubeClock(note);
    const next = info.paused ? CYTUBE_CLOCK_MAX_MS : (1 - (cytubePosition(info) % 1)) * CYTUBE_CLOCK_MAX_MS;
    wait = wait === null ? next : Math.min(wait, next);
  }

  // Nothing measurable yet (a note that has not been put in the page): come back
  // for it, so the clock is running by the time a reader can see it.
  if (wait === null) wait = cytubeNotes.size ? CYTUBE_CLOCK_MIN_MS : null;
  if (wait !== null) {
    cytubeClockTimer = setTimeout(runCytubeClock, Math.max(CYTUBE_CLOCK_MIN_MS, Math.min(CYTUBE_CLOCK_MAX_MS, wait)));
  }
}

// Bring a note's title and clock up to date without touching the player beside
// it, which is what the live updates below change on every tick.
function updateCytubeNote(note, info) {
  note.cytubeInfo = info;
  const title = note.querySelector('.cytube-title');
  if (title) title.textContent = cytubeTitleText(info);

  setCytubeClock(note);
  // The clock runs on from here by itself (see `runCytubeClock`).
  cytubeNotes.add(note);
  if (cytubeClockTimer === null) runCytubeClock();
}

// How far the reader's copy may fall behind before it is pulled back: far enough
// that a pause or a buffer hiccup does not make it jump. A reader *moving* the
// player is a different matter and is put back at once (see below).
const CYTUBE_DRIFT_SECONDS = 15;

// How long a seek of ours is left alone: the player buffering straight afterwards
// is the move settling, not the reader having moved it again.
const YOUTUBE_SEEK_GRACE_MS = 2500;

// YouTube's player cannot be asked where it is, but it does report when it starts
// and stops playing, so its position can be followed from the point it was aimed
// at (see `cytubePlayerUrl`) for as long as it plays. `enablejsapi=1`, which that
// URL asks for, is what makes it report and accept the command below.
const YOUTUBE_ORIGIN = 'https://www.youtube.com';
const youtubePlayers = new WeakMap();

// A player only becomes worth watching once it is in the document: an iframe that
// has not been inserted yet has no content window to key it by.
function trackPlayer(media, info) {
  if (!media) return media;
  if (media.tagName === 'IFRAME' && info.provider === 'youtube') trackYouTube(media, info);
  else if (media.tagName === 'VIDEO') guardCytubePosition(media, info.channel);
  return media;
}

let youtubePlayerSeq = 0;

// A YouTube embed stays silent - it reports nothing and ignores commands - until
// it is told that somebody is listening. The IFrame API script sends this
// handshake for you; a plain embed has to send it itself, and without it a moved
// position looks like it is never put back.
function tellYouTubeListening(iframe) {
  if (!iframe || !iframe.contentWindow) return;
  iframe.contentWindow.postMessage(
    JSON.stringify({ event: 'listening', id: iframe.id, channel: 'widget' }),
    YOUTUBE_ORIGIN
  );
}

function trackYouTube(iframe, info) {
  const track = {
    channel: info.channel,
    seconds: Math.max(0, cytubePosition(info)),
    at: Date.now(),
    playing: false,
    // Whether the player has ever reported anything: until it has, there is no
    // way to know where it is (see `seekCytubeMedia`).
    reported: false,
    // Treated as if we had just aimed it, so the buffering that follows the player
    // loading is not mistaken for the reader moving it.
    seekAt: Date.now()
  };
  if (iframe.contentWindow) youtubePlayers.set(iframe.contentWindow, track);

  // Now, and again whenever the frame reloads itself - which is the moment the
  // player is actually ready to hear it.
  tellYouTubeListening(iframe);
  iframe.addEventListener('load', () => tellYouTubeListening(iframe));
}

window.addEventListener('message', (event) => {
  if (event.origin !== YOUTUBE_ORIGIN || !event.source) return;
  let message;
  try {
    message = JSON.parse(event.data);
  } catch {
    return;
  }
  const track = youtubePlayers.get(event.source);
  if (!track) return;
  // Anything at all from the player means the handshake took: from here on it can
  // be measured rather than guessed at (see `seekCytubeMedia`).
  track.reported = true;
  if (message.event !== 'onStateChange') return;
  // Fold in the time it has been playing, then follow the new state.
  const now = Date.now();
  if (track.playing) track.seconds += (now - track.at) / 1000;
  track.at = now;
  track.playing = message.info === 1;
  // A YouTube player reports nothing about being seeked, so a state change to
  // playing or buffering is read as the reader having moved it - a resumed or
  // scrubbed player is put back where the room is (see `dismissCytubeMoves`).
  if (message.info === 1 || message.info === 3) dismissYouTubeMove(track, event.source);
});

// Put a YouTube player back at the room's point. Nothing is asked of the player
// first, because a YouTube embed can be told to seek but never asked where it is.
function commandYouTubeSeek(track, source, target) {
  if (!source || !Number.isFinite(target) || target < 0) return;
  track.seekAt = Date.now();
  track.seconds = target;
  track.at = track.seekAt;
  source.postMessage(JSON.stringify({ event: 'command', func: 'seekTo', args: [Math.floor(target), true] }), YOUTUBE_ORIGIN);
}

// The room owns the position, and a YouTube player cannot be asked where it is -
// so whenever it says it started or is buffering, it is put back where the room
// is. A seek we have just sent makes the player buffer too, so that is ignored.
function dismissYouTubeMove(track, source) {
  if (!track || Date.now() - track.seekAt < YOUTUBE_SEEK_GRACE_MS) return;
  const room = cytubeRoomState.get(track.channel);
  if (room) commandYouTubeSeek(track, source, cytubePosition(room));
}

// A room's own file is a plain element, so the browser tells us exactly when the
// reader moved it: put it straight back, then let the room carry on from there.
function guardCytubePosition(media, channel) {
  media.addEventListener('seeked', () => {
    if (media.cytubeSeeking) {
      // Our own move landing, not the reader's.
      media.cytubeSeeking = false;
      return;
    }
    const room = cytubeRoomState.get(channel);
    if (room) restoreCytubePosition(media, room);
  });
  media.addEventListener('play', () => {
    // Starting our copy - after a pause, or after opening a block and pressing
    // play later - is a move like any other: the room carried on without the
    // reader while they were stopped, so they are put where it is *now*, however
    // short the pause was. (A stopped player is left alone otherwise, see
    // `seekCytubeMedia`, which is why nothing has been keeping it in step.)
    const room = cytubeRoomState.get(channel);
    if (room) restoreCytubePosition(media, room);
  });
}

function restoreCytubePosition(media, info) {
  const target = cytubePosition(info);
  if (!media || !Number.isFinite(target) || target < 0) return;
  media.cytubeSeeking = true;
  try {
    media.currentTime = target;
  } catch {
    // Not seekable yet; nothing to put back.
    media.cytubeSeeking = false;
    return;
  }
  // Cleared by our own `seeked`, and by a timer in case the browser decides the
  // move was too small to count as a seek at all.
  setTimeout(() => {
    if (media) media.cytubeSeeking = false;
  }, 500);
}

function youtubePosition(track) {
  return Math.max(0, track.seconds + (track.playing ? (Date.now() - track.at) / 1000 : 0));
}

// Pull a player back to where the room is, once it has drifted a long way. A
// player the reader has stopped is left alone: the room moving on is handled by
// mounting the new item instead (`apply` in `setCytubeStream`).
function seekCytubeMedia(media, info) {
  const target = cytubePosition(info);
  if (!media || target < 1) return;
  // A player that is no longer on the page has nobody watching it - a block that
  // was re-rendered or taken away between the room being read and this landing.
  if (!media.isConnected) return;

  if (media.tagName === 'VIDEO') {
    // A room's own file: the element knows exactly where it is.
    if (media.paused) return;
    if (Math.abs(media.currentTime - target) >= CYTUBE_DRIFT_SECONDS) restoreCytubePosition(media, info);
    return;
  }

  if (media.tagName !== 'IFRAME' || info.provider !== 'youtube') return;
  const track = media.contentWindow && youtubePlayers.get(media.contentWindow);
  if (!track || Date.now() - track.seekAt < YOUTUBE_SEEK_GRACE_MS) return;

  // A player that has never reported anything cannot be measured, so it is put
  // back at the room's point on every tick instead - reachable only when the
  // handshake above did not take.
  if (!track.reported) return commandYouTubeSeek(track, media.contentWindow, target);

  if (!track.playing) return;
  if (Math.abs(youtubePosition(track) - target) < CYTUBE_DRIFT_SECONDS) return;
  commandYouTubeSeek(track, media.contentWindow, target);
}

// Every cytu.be block on the page registers here. A room is read once per tick
// however many posts show it, and all of its blocks are updated together - which
// is what makes them follow the room as it switches item.
const cytubeWatchers = new Map();
const CYTUBE_POLL_MS = 5000;

function watchCytubeBlock(channel, block) {
  let watcher = cytubeWatchers.get(channel);
  if (!watcher) {
    watcher = { channel, blocks: new Set(), timer: null };
    cytubeWatchers.set(channel, watcher);
    watcher.timer = setInterval(() => pollCytubeRoom(watcher), CYTUBE_POLL_MS);
  }
  watcher.blocks.add(block);
  return block;
}

async function pollCytubeRoom(watcher) {
  // No point asking while the page is not being looked at (the server-side
  // session is shared, so leaving it alone costs nothing).
  if (document.hidden) return;

  const info = await cytubeStreamInfo(watcher.channel, { refresh: true });
  for (const block of [...watcher.blocks]) {
    if (!block.alive()) watcher.blocks.delete(block);
    else if (info) block.update(info);
  }

  // Nothing left on the page showing this room.
  if (!watcher.blocks.size) {
    clearInterval(watcher.timer);
    cytubeWatchers.delete(watcher.channel);
  }
}

// The room's current item plus a link to the room itself. `media` is null when
// the item cannot be played here (an HLS stream, a custom embed, ...) or when the
// room is idle. Nothing on this site plays on its own, so this is left paused -
// even when the room turns over to the next item - and the reader presses play.
function cytubePlayer(info) {
  const note = document.createElement('div');
  note.className = 'cytube-note';

  const title = document.createElement('span');
  title.className = 'cytube-title';
  note.appendChild(title);

  const time = document.createElement('span');
  time.className = 'cytube-time';
  note.appendChild(time);

  note.appendChild(document.createTextNode(' \u00b7 '));
  const join = document.createElement('a');
  join.href = info.roomUrl;
  join.target = '_blank';
  join.rel = 'noopener noreferrer';
  join.textContent = 'Join the room';
  note.appendChild(join);
  if (info.note) note.appendChild(document.createTextNode(' (' + info.note + ')'));
  updateCytubeNote(note, info);

  if (info.kind === 'embed' && info.embedUrl) {
    const iframe = document.createElement('iframe');
    // The player tags what it tells us with this, and the listening handshake
    // has to name it (see `tellYouTubeListening`).
    iframe.id = `cytube-player-${(youtubePlayerSeq += 1)}`;
    iframe.width = '640';
    iframe.height = '360';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    iframe.allowFullscreen = true;
    // The page sends `Referrer-Policy: no-referrer` and an iframe with no policy
    // of its own inherits it; YouTube refuses to play without a referrer.
    iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    iframe.style.maxWidth = '100%';
    iframe.src = cytubePlayerUrl(info) || info.embedUrl;
    return { note, media: iframe };
  }

  if (info.kind === 'video' && info.videoUrl) {
    // The room's own file, fetched by the reader's browser (see `media-src`).
    const video = document.createElement('video');
    video.controls = true;
    video.style.maxWidth = '100%';
    const source = document.createElement('source');
    source.src = info.videoUrl;
    if (info.mime) source.type = info.mime;
    video.appendChild(source);
    // Start where the room is, rather than at the beginning of the file.
    if (info.currentTime > 0) {
      const seek = () => {
        try {
          video.currentTime = cytubePosition(info);
        } catch {
          /* not seekable (yet) */
        }
      };
      if (video.readyState >= 1) seek();
      else video.addEventListener('loadedmetadata', seek, { once: true });
    }
    // Left paused, like every other embed on the site: starting playback before
    // the reader asks for it would be rude, and a browser that has not been
    // touched will refuse it anyway. (The controls are there.)
    return { note, media: video };
  }

  return { note, media: null };
}

// The title and cover stored on a `cytube/stream` row are what the room was
// showing when the post was made, which is usually stale by the time anyone
// reads it. The room has just been asked what it is playing, so put that in the
// file header - the label beside the room's URL, and the poster behind it (only
// when the item has a cover of its own; a room's plain file has none).
function refreshCytubeBlockMeta(container, info) {
  const block = container.closest('details');
  if (!block) return;

  const label = block.querySelector('.cytube-now-playing');
  if (label) label.textContent = info.kind === 'none' ? 'nothing playing now' : info.title || 'unknown';

  const poster = block.querySelector('.image-container img');
  if (poster && info.coverUrl && poster.getAttribute('src') !== info.coverUrl) {
    poster.setAttribute('src', info.coverUrl);
    poster.setAttribute('data-thumb', info.coverUrl);
  }
}

// A cytu.be link in a post's text is rendered by the server as a block holding
// nothing but the room's URL (see `be/lib/embeds.js`); it is filled in here as
// soon as it is on the page, so the block opens onto a player like every other
// provider's rather than onto something to click again. The room is live, so
// the item can only be resolved from the reader's side anyway, and the plain
// link is kept for a reader without scripts - and when the room cannot be read
// (unknown, private, socket server unreachable) or is playing something that
// cannot be played here.
function mountCytubeBlock(container) {
  const channel = (container.dataset.channel || '').toLowerCase();
  if (!channel) return;

  const fallback = container.querySelector('.cytube-play');
  container.dataset.cytubeMounted = 'true';
  container.textContent = 'Reading the room\u2026';

  let shown = null;
  let media = null;

  const render = (info) => {
    const player = cytubePlayer(info);
    container.textContent = '';
    container.appendChild(player.note);
    if (player.media) container.appendChild(player.media);
    else if (info.kind !== 'none' && fallback) container.appendChild(fallback);
    media = trackPlayer(player.media, info);
  };

  // Rendered when the block appears, and then re-rendered whenever the room moves
  // on to another item (`watchCytubeBlock`); while the item stays the same only
  // the note's clock is brought up to date and the player pulled back into step.
  // A re-render mounts the new item paused, and does not start it playing.
  const apply = (info) => {
    if (!info) {
      container.textContent = '';
      if (fallback) container.appendChild(fallback);
      return;
    }

    cytubeRoomState.set(channel, info);
    const key = info.kind === 'none' ? 'idle' : `${info.type}:${info.mediaId}`;
    if (key !== shown) {
      shown = key;
      return render(info);
    }

    const note = container.querySelector('.cytube-note');
    if (note) updateCytubeNote(note, info);
    seekCytubeMedia(media, info);
  };

  cytubeStreamInfo(channel).then(apply);
  watchCytubeBlock(channel, { alive: () => container.isConnected, update: apply });
}

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

  // A twitch.tv stream on a page Twitch will not frame (see `twitchCanBeFramed`):
  // the thumbnail stays, and opening the block offers the stream on twitch.tv
  // rather than a player that could only come up blank or refused.
  setTwitchLink(link, mime, autoExpand) {
    const parent = link.parentNode;
    const container = document.createElement('span');
    const hideLink = makeHideLink();
    const thumbLink = cloneThumbLink(link, mime);
    const panel = document.createElement('span');
    panel.style.display = 'none';
    panel.appendChild(twitchEmbedNote(twitchWatchUrlFor(embedUrlFor(link.href)) || link.href, twitchFrameRefusalReason()));

    wireToggle(parent, thumbLink, panel, hideLink);
    container.append(hideLink, panel, thumbLink);
    parent.replaceChild(container, link);
    if (autoExpand) thumbLink.onclick({ which: 1 });
  },

  setEmbedVideo(link, mime, autoExpand) {
    const embedUrl = embedUrlFor(link.href);
    if (!embedUrl) return;

    // Twitch refuses to be framed by an http page on a domain - or by an IP at
    // all - so there the stream is offered as a link instead of a dead frame.
    if (mime === 'twitch/video' && !twitchCanBeFramed()) return this.setTwitchLink(link, mime, autoExpand);

    const parent = link.parentNode;
    const container = document.createElement('span');
    const hideLink = makeHideLink();
    const thumbLink = cloneThumbLink(link, mime);
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

  // A Vocaroo recording is audio, so it plays in the site's own player - the same
  // `<audio controls>` an uploaded mp3 gets - rather than inside Vocaroo's iframe.
  // Their CDN serves the file with `audio/mpeg`, `Accept-Ranges` and
  // `Access-Control-Allow-Origin: *`, and the URL is one of the constants in
  // Vocaroo's own page config. The stored `path` stays the *share* URL (that is what
  // `[Embed]` shows and what a reader clicks), so the media URL is derived here - and
  // if that file is not served any more, their own player takes its place.
  //
  // Opening the block starts it, exactly like an uploaded audio file in the same
  // block: the click on the thumbnail is the play action.
  setVocarooAudio(link, mime, autoExpand) {
    const id = vocarooIdFrom(link.href);
    if (!id) return this.setEmbedVideo(link, mime, autoExpand);

    const parent = link.parentNode;
    const media = vocarooAudio(id);
    media.style.display = 'none';

    const container = document.createElement('span');
    const hideLink = makeHideLink();
    const thumbLink = cloneThumbLink(link, mime);

    wireToggle(
      parent,
      thumbLink,
      media,
      hideLink,
      () => media.play(),
      () => media.pause()
    );

    container.append(hideLink, media, thumbLink);
    parent.replaceChild(container, link);
    if (autoExpand) thumbLink.onclick({ which: 1 });
  },

  // Twitter/X and Bluesky embeds play the raw mp4 FxEmbed resolves, not an
  // iframe of the post. (video.twimg.com answers 403 when a request carries a
  // referrer, so the global `Referrer-Policy: no-referrer` header is what lets
  // those load - do not give this element a referrer policy of its own.)
  setPostVideo(link, mime, autoExpand) {
    const resolve = mime === 'bluesky/video' ? blueskyVideoUrl : tweetVideoUrl;
    const parent = link.parentNode;
    const media = document.createElement('video');
    media.controls = true;
    media.loop = localStorage.noAutoLoop !== 'true';
    media.style.display = 'none';

    const container = document.createElement('span');
    const hideLink = makeHideLink();
    const thumbLink = cloneThumbLink(link, mime);
    let loaded = false;

    wireToggle(
      parent,
      thumbLink,
      media,
      hideLink,
      () => {
        resolve(link.href).then((post) => {
          // Nothing to play: send the reader to the post itself.
          if (!post || !post.url) {
            if (!loaded) window.location.href = link.href;
            return;
          }
          if (!loaded) {
            const src = document.createElement('source');
            src.src = post.url;
            src.type = 'video/mp4';
            media.appendChild(src);
            loaded = true;
          }
          // Loaded, not started: the reader presses play (its controls are there),
          // the same as every other embed on the site.
        });
      },
      () => media.pause()
    );

    container.append(hideLink, media, thumbLink);
    parent.replaceChild(container, link);
    if (autoExpand) thumbLink.onclick({ which: 1 });
  },

  // A cytu.be room cannot be framed, so what plays is the item the room is
  // showing, resolved when the block is opened - and a posted room is opened
  // straight away, because a room is live: its frozen snapshot says what *was*
  // on when the post was made, which is rarely what a reader wants. The item
  // starts at the point the room is at, so pressing play puts the reader in the
  // same place as opening the room itself would (see `cytubePlayer`).
  // Collapsing the block falls back to that snapshot and stops our copy.
  setCytubeStream(link, mime, autoExpand) {
    const channel = cytubeChannelOf(link.href);
    if (!channel) return;

    const parent = link.parentNode;
    const container = document.createElement('span');
    const hideLink = makeHideLink();
    const thumbLink = cloneThumbLink(link, mime);
    const panel = document.createElement('div');
    panel.className = 'cytube-stream';
    panel.textContent = 'Reading the room\u2026';
    panel.style.display = 'none';

    let info = null;
    let media = null;
    // Whether the panel is the visible state of this block (rather than the
    // thumbnail it falls back to).
    let active = false;

    const mount = (data) => {
      const player = cytubePlayer(data);
      refreshCytubeBlockMeta(container, data);
      panel.textContent = '';
      panel.appendChild(player.note);
      media = player.media;
      if (media) panel.appendChild(media);
      trackPlayer(media, data);
    };

    // Nothing to play and nothing to fall back on: leave a plain link to the
    // room. The block opens by itself, so it must never navigate the reader away
    // on its own.
    const showRoomLink = () => {
      const fallback = document.createElement('a');
      fallback.href = link.href;
      fallback.target = '_blank';
      fallback.rel = 'noopener noreferrer';
      fallback.textContent = 'Open the room on cytu.be';
      panel.textContent = '';
      panel.appendChild(fallback);
    };

    // A fresh answer from the room. The header always follows it, and a new item
    // is mounted on the spot - a room switches video whenever it likes, and the
    // reader came here to watch the room, not the clip it happened to be on when
    // the post was written (`watchCytubeBlock`).
    const apply = (data, { remount = false } = {}) => {
      if (!data) return showRoomLink();
      const changed = !info || data.type !== info.type || data.mediaId !== info.mediaId;
      info = data;
      cytubeRoomState.set(channel, data);
      refreshCytubeBlockMeta(container, data);
      if (!active) return; // collapsed: the header is the whole block
      // A new item is mounted on the spot - a room switches video whenever it
      // likes - but nothing starts playing until the reader presses play.
      if (remount || changed) return mount(data);
      // Same item: the note catches up with the room (which is also what keeps the
      // clock it runs by itself (`runCytubeClock`) honest about the position),
      // and the player is pulled back only if it has drifted.
      const note = panel.querySelector('.cytube-note');
      if (note) updateCytubeNote(note, data);
      seekCytubeMedia(media, data);
    };

    wireToggle(
      parent,
      thumbLink,
      panel,
      hideLink,
      () => {
        // Opening the block re-reads the room rather than trusting whatever the
        // watcher last saw, because a page sitting in a hidden tab has not been
        // keeping up with it.
        active = true;
        cytubeStreamInfo(channel, { refresh: true }).then((data) => apply(data || info, { remount: true }));
      },
      () => {
        // Nothing to sync with: collapsing stops our copy of the item.
        active = false;
        if (!media) return;
        if (media.tagName === 'IFRAME') media.removeAttribute('src');
        else media.pause();
      }
    );

    container.append(hideLink, panel, thumbLink);
    parent.replaceChild(container, link);
    if (autoExpand) thumbLink.onclick({ which: 1 });
    watchCytubeBlock(channel, { alive: () => container.isConnected, update: apply });
  },

  // A Vocaroo link written in a post's text (see `vocarooBlock` in
  // `be/lib/embeds.js`): the same audio player as the file block, mounted when the
  // block is opened. It is not started there, though - the block is opened by
  // clicking a summary rather than a thumbnail, so the reader presses play in the
  // controls, exactly as for a Twitter/X or Bluesky video mounted by the function
  // above.
  mountVocarooBlock(container) {
    const id = vocarooIdFrom(container.dataset.url);
    if (!id) return;
    container.dataset.vocarooMounted = 'true';

    const details = container.closest('details');
    let mounted = false;
    const mount = () => {
      if (mounted) return;
      mounted = true;
      container.textContent = '';
      container.appendChild(vocarooAudio(id));
    };

    // Mounted when the block is opened rather than on page load: a thread can hold
    // several of these and nothing should be fetched for one nobody opened.
    if (!details) return mount();
    if (details.open) return mount();
    details.addEventListener('toggle', () => details.open && mount(), { once: true });
  },

  // A Twitter/X or Bluesky link written in a post's text (see `postVideoBlock` in
  // `be/lib/embeds.js`): the post's video is asked of FxEmbed when the reader opens
  // the block, and mounted here with the poster the API hands out - paused, like
  // every other player on the site. A post with no video, or an API that cannot be
  // reached, leaves the plain link the block was rendered with.
  mountPostVideoBlock(container) {
    const postUrl = container.dataset.url;
    if (!postUrl) return;
    container.dataset.postVideoMounted = 'true';

    const details = container.closest('details');
    let asked = false;
    const show = () => {
      if (asked) return;
      asked = true;
      const resolve = container.dataset.provider === 'bluesky' ? blueskyVideoUrl : tweetVideoUrl;
      resolve(postUrl).then((media) => {
        if (!media || !media.url) return; // the link the block came with stays
        const video = document.createElement('video');
        video.controls = true;
        video.preload = 'metadata';
        if (media.thumb) video.poster = media.thumb;
        const source = document.createElement('source');
        source.src = media.url;
        source.type = 'video/mp4';
        video.appendChild(source);
        container.textContent = '';
        container.appendChild(video);
      });
    };

    // Asked for when the block is opened rather than on page load: a thread can
    // hold a lot of these, and the API is somebody else's to rate-limit.
    if (!details) return show();
    if (details.open) return show();
    details.addEventListener('toggle', () => details.open && show(), { once: true });
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
    } else if (mime === 'twitter/video' || mime === 'bluesky/video') {
      link.addEventListener(
        'click',
        (e) => {
          if (isModifiedClick(e)) return;
          e.preventDefault();
          this.setPostVideo(link, mime, true);
        },
        { once: true }
      );
    } else if (mime === 'cytube/stream') {
      // Opened as soon as it is on the page; the room is read then (see
      // `setCytubeStream`).
      this.setCytubeStream(link, mime, true);
    } else if (mime === 'vocaroo/audio') {
      link.addEventListener(
        'click',
        (e) => {
          if (isModifiedClick(e)) return;
          e.preventDefault();
          this.setVocarooAudio(link, mime, true);
        },
        { once: true }
      );
    } else if (mime === 'youtube/video' || mime === 'nicovideo/video' || mime === 'bilibili/video' || mime === 'twitch/video') {
      link.addEventListener(
        'click',
        (e) => {
          if (isModifiedClick(e)) return;
          e.preventDefault();
          this.setEmbedVideo(link, mime, true);
        },
        { once: true }
      );
    }
  }
};

window.initializeThumbnails = function () {
  // Before anything else: the players the *server* rendered carry the host it
  // was asked on, which is not necessarily the host the reader is on - and a page
  // Twitch will not frame must not be left holding a dead frame either (see
  // `fixTwitchFrames`).
  fixTwitchFrames(document);

  // Then the players that must not be loaded until the reader opens the block they
  // are in: bilibili's starts playing by itself (see `loadDeferredEmbeds`).
  loadDeferredEmbeds(document);

  document.querySelectorAll('.image-container:not([data-initialized])').forEach((container) => {
    const link = container.querySelector('.media-toggle');
    if (!link) return;
    container.dataset.initialized = 'true';
    thumbs.processImageLink(link);
  });

  // cytu.be links in a post's text carry only the room's URL: read the room and
  // mount whatever it is playing now (see `mountCytubeBlock`).
  document.querySelectorAll('.cytube-stream:not([data-cytube-mounted])').forEach((container) => {
    if (container.querySelector('.cytube-play')) mountCytubeBlock(container);
  });

  // A Twitter/X or Bluesky link in a post's text: ask FxEmbed for the post's video
  // when the block is opened (see `mountPostVideoBlock`).
  document.querySelectorAll('.post-video:not([data-post-video-mounted])').forEach((container) => {
    if (container.querySelector('.post-video-play')) thumbs.mountPostVideoBlock(container);
  });

  // A Vocaroo link in a post's text: mount the audio player when the block is
  // opened (see `mountVocarooBlock`).
  document.querySelectorAll('.vocaroo-embed:not([data-vocaroo-mounted])').forEach((container) => {
    if (container.querySelector('.vocaroo-embed-play')) thumbs.mountVocarooBlock(container);
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
