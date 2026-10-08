document.addEventListener('DOMContentLoaded', () => {
  const getHiddenBoards = () => {
    const hidden = localStorage.getItem('hiddenBoards');
    return hidden ? JSON.parse(hidden) : [];
  };

  const saveHiddenBoards = (boards) => {
    localStorage.setItem('hiddenBoards', JSON.stringify(boards));
  };

  const hideBoard = (boardUri) => {
    const hiddenBoards = getHiddenBoards();
    if (!hiddenBoards.includes(boardUri)) {
      hiddenBoards.push(boardUri);
      saveHiddenBoards(hiddenBoards);
    }

    document.querySelectorAll(`.thread[data-board="${boardUri}"]`).forEach((thread) => {
      thread.style.display = 'none';
      const hr = thread.nextElementSibling;
      if (hr && hr.tagName === 'HR') {
        hr.style.display = 'none';
      }
    });
  };

  const showBoard = (boardUri) => {
    const hiddenBoards = getHiddenBoards().filter((b) => b !== boardUri);
    saveHiddenBoards(hiddenBoards);

    document.querySelectorAll(`.thread[data-board="${boardUri}"]`).forEach((thread) => {
      thread.style.display = 'block';
      const hr = thread.nextElementSibling;
      if (hr && hr.tagName === 'HR') {
        hr.style.display = 'block';
      }
    });
  };

  // Use event delegation for hide board buttons
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('hide-board-btn')) {
      const boardUri = e.target.dataset.board;
      hideBoard(boardUri);
      location.reload();
    }
  });

  // Hide boards on page load and when new content is added
  const hideHiddenBoards = () => {
    const hiddenBoards = getHiddenBoards();
    hiddenBoards.forEach(hideBoard);
  };

  // /h/ used to be hidden for everyone by default; the board does not exist, so the
  // entry this left in every reader's list (and its "unhidden on purpose" flag) is
  // cleared out.
  const initializeHiddenBoards = () => {
    const hiddenBoards = getHiddenBoards();
    if (hiddenBoards.includes('h')) saveHiddenBoards(hiddenBoards.filter((b) => b !== 'h'));
    localStorage.removeItem('hBoardExplicitlyUnhidden');
  };

  initializeHiddenBoards();
  hideHiddenBoards();

  // Listen for new content being added via infinite scroll
  document.addEventListener('contentAdded', hideHiddenBoards);

  const addHiddenBoardsList = () => {
    const hiddenBoards = getHiddenBoards();
    if (hiddenBoards.length > 0) {
      // Remove existing list if present
      const existingList = document.querySelector('.hidden-boards-list');
      if (existingList) {
        existingList.remove();
      }

      const listContainer = document.createElement('div');
      listContainer.className = 'hidden-boards-list';
      listContainer.style.margin = '10px 0';
      listContainer.style.padding = '10px';
      listContainer.style.borderRadius = '4px';

      const title = document.createElement('div');
      title.textContent = 'Hidden Boards:';
      title.style.marginBottom = '5px';
      title.style.fontWeight = 'bold';
      listContainer.appendChild(title);

      hiddenBoards.forEach((board) => {
        const boardItem = document.createElement('div');
        boardItem.style.margin = '5px 0';

        const boardText = document.createElement('span');
        boardText.textContent = `/${board}/`;
        boardItem.appendChild(boardText);

        const unhideButton = document.createElement('button');
        unhideButton.textContent = 'Unhide';
        unhideButton.style.marginLeft = '10px';
        unhideButton.style.padding = '2px 8px';
        unhideButton.style.fontSize = '12px';
        unhideButton.onclick = () => {
          showBoard(board);
          addHiddenBoardsList(); // Refresh the list
        };
        boardItem.appendChild(unhideButton);

        listContainer.appendChild(boardItem);
      });

      const pageNav = document.querySelector('.page-nav');
      if (pageNav) {
        pageNav.parentNode.insertBefore(listContainer, pageNav.nextSibling);
      }
    }
  };

  addHiddenBoardsList();
});
