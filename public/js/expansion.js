window.initializeExpansion = function () {
  const threadFooters = document.querySelectorAll('.thread-footer');
  const bulkSize = 250;

  threadFooters.forEach((footer) => {
    const threadId = footer.dataset.threadId;
    const expandButton = footer.querySelector('.expand-thread');
    const collapseButton = footer.querySelector('.collapse-thread');
    const omittedPosts = footer.querySelector('.omitted-posts');
    const expandedPosts = footer.querySelector('.expanded-posts');
    const additionalReplies = footer.nextElementSibling;
    let isExpanding = false;

    if (expandButton) {
      expandButton.addEventListener('click', async function (e) {
        e.preventDefault();
        if (isExpanding) return;

        try {
          isExpanding = true;
          const currentPath = location.pathname.split('/').filter((p) => p)[0];
          const threadRoot = footer.closest('.thread');
          const boardUri =
            threadRoot?.querySelector('[data-board]')?.getAttribute('data-board') ||
            (currentPath === 'all'
              ? footer
                  .closest('.thread')
                  .querySelector('a[href^="/"]')
                  .textContent.match(/\/(\w+)\//)[1]
              : currentPath);
          const modView = Boolean(window.modBoardUri);

          const response = await fetch(`/${boardUri}/thread/${threadId}.json`);
          if (!response.ok) throw new Error('Network response was not ok');
          const data = await response.json();

          const existingReplies = new Set(Array.from(footer.parentNode.querySelectorAll('.reply')).map((r) => r.dataset.postId));

          const lastFivePostIds = new Set(data.posts.slice(-5).map((post) => post.postId.toString()));
          const newReplies = data.posts.filter(
            (reply) => !existingReplies.has(reply.postId.toString()) && !lastFivePostIds.has(reply.postId.toString())
          );

          if (newReplies.length) {
            const positions = new Map();
            data.posts.forEach((post, index) => positions.set(String(post.postId), index + 1));

            const batches = [];
            for (let i = 0; i < newReplies.length; i += bulkSize) {
              batches.push(newReplies.slice(i, i + bulkSize));
            }

            const rendered = await Promise.all(
              batches.map(async (batch) => {
                const cellResponse = await fetch(`/${boardUri}/cells/replies`, {
                  method: 'POST',
                  headers: csrfHeaders({ 'Content-Type': 'application/json' }),
                  body: JSON.stringify({
                    replies: batch,
                    replyNumbers: batch.map((reply) => positions.get(String(reply.postId)) || 0),
                    thread: { threadId, boardUri },
                    modView
                  })
                });
                if (!cellResponse.ok) throw new Error(`HTTP ${cellResponse.status}`);
                return cellResponse.text();
              })
            );

            additionalReplies.innerHTML = rendered.join('');
          }

          additionalReplies.style.display = 'block';
          omittedPosts.style.display = 'none';
          expandedPosts.style.display = 'inline';

          if (window.initializePostMenus) window.initializePostMenus(additionalReplies);
          if (typeof window.initializeThumbnails === 'function') window.initializeThumbnails();
          if (window.backlinks?.init) window.backlinks.init();
        } catch (error) {
          console.error('Error fetching additional replies:', error);
          additionalReplies.textContent = '';
          const errEl = document.createElement('div');
          errEl.className = 'error';
          errEl.textContent = 'Failed to load replies';
          additionalReplies.appendChild(errEl);
        } finally {
          isExpanding = false;
        }
      });
    }

    if (collapseButton) {
      collapseButton.addEventListener('click', function (e) {
        e.preventDefault();
        additionalReplies.style.display = 'none';
        omittedPosts.style.display = 'inline';
        expandedPosts.style.display = 'none';
        additionalReplies.innerHTML = '';
      });
    }
  });
};

document.addEventListener('DOMContentLoaded', function () {
  window.initializeExpansion();
});
