(function () {
  const BULK_SIZE = 250;

  function announce(container) {
    if (window.initializePostMenus) window.initializePostMenus(container);
    if (window.initializeThumbnails) window.initializeThumbnails();
    if (window.initializePolls) window.initializePolls();
    if (window.backlinks?.init) window.backlinks.init();
    document.dispatchEvent(new CustomEvent('contentAdded'));
  }

  function initialize() {
    const notice = document.getElementById('omitted-notice');
    const replies = document.getElementById('replies');
    if (!notice || !replies) return;

    const expandLink = notice.querySelector('.expand-omitted');
    const collapseLink = notice.querySelector('.collapse-omitted');
    const omittedLine = notice.querySelector('.omitted-posts');
    const expandedLine = notice.querySelector('.expanded-posts');
    const sentence = expandLink.textContent;
    const { board, threadId, before } = notice.dataset;

    let loading = false;
    let earlier = null;
    let container = null;

    async function fetchEarlier() {
      const response = await fetch(`/${board}/thread/${threadId}.json`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const posts = data.posts || [];
      const position = new Map(posts.map((post, index) => [String(post.postId), index]));
      return posts
        .filter((post) => Number(post.postId) < Number(before))
        .map((post) => ({ post, position: position.get(String(post.postId)) }));
    }

    async function expand() {
      if (loading) return;
      loading = true;
      expandLink.textContent = 'Loading the earlier replies…';

      container = document.createElement('div');
      container.className = 'earlier-replies';
      notice.parentNode.insertBefore(container, notice);

      try {
        if (!earlier) earlier = await fetchEarlier();

        if (!earlier.length) {
          container.remove();
          container = null;
          notice.remove();
          return;
        }

        const batches = [];
        for (let i = 0; i < earlier.length; i += BULK_SIZE) {
          batches.push(earlier.slice(i, i + BULK_SIZE));
        }

        const rendered = await Promise.all(
          batches.map((batch) =>
            fetch(`/${board}/cells/replies`, {
              method: 'POST',
              headers: csrfHeaders({ 'Content-Type': 'application/json' }),
              body: JSON.stringify({
                replies: batch.map(({ post }) => ({ ...post, sage: Boolean(post.sage) })),
                replyNumbers: batch.map(({ position }) => position + 1),
                thread: { threadId, boardUri: board }
              })
            }).then((response) => {
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              return response.text();
            })
          )
        );

        container.innerHTML = rendered.join('');

        announce(container);
        omittedLine.style.display = 'none';
        expandedLine.style.display = 'inline';
      } catch (error) {
        console.error('Error loading the earlier replies:', error);
        if (container) container.remove();
        container = null;
        earlier = null;
        const message = document.createElement('div');
        message.className = 'error';
        message.textContent = 'Failed to load the earlier replies';
        notice.parentNode.insertBefore(message, notice);
        setTimeout(() => message.remove(), 5000);
      } finally {
        loading = false;
        expandLink.textContent = sentence;
      }
    }

    expandLink.addEventListener('click', (event) => {
      event.preventDefault();
      expand();
    });

    collapseLink.addEventListener('click', (event) => {
      event.preventDefault();
      if (container) container.remove();
      container = null;
      expandedLine.style.display = 'none';
      omittedLine.style.display = 'inline';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
  else initialize();
})();
