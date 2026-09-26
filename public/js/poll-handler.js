// Poll option builder (post form) + poll voting.
//
// Voting is delegated from the document instead of binding to each poll as it
// arrives, so it also works for polls inside threads pulled in later by
// infinite scroll and on pages that have no post form (the /all overboard).
document.addEventListener('DOMContentLoaded', function () {
  const addOptionBtn = document.getElementById('add-option');
  const pollOptions = document.getElementById('poll-options');
  // Maximum number of poll options, supplied by the server (config.maxPollOptions).
  const maxOptions = Number(pollOptions && pollOptions.dataset.maxOptions) || 10;
  let optionCount = pollOptions ? pollOptions.querySelectorAll('input[name="poll_options[]"]').length : 2;

  if (addOptionBtn && pollOptions) {
    if (optionCount >= maxOptions) {
      addOptionBtn.style.display = 'none';
    }

    addOptionBtn.addEventListener('click', function () {
      if (optionCount >= maxOptions) return;

      optionCount++;
      const input = document.createElement('input');
      input.type = 'text';
      input.autocomplete = 'off';
      input.name = 'poll_options[]';
      input.placeholder = `Option ${optionCount}`;
      input.style.width = '90%';
      input.style.marginBottom = '5px';
      pollOptions.appendChild(input);

      if (optionCount >= maxOptions) {
        addOptionBtn.style.display = 'none';
      }
    });
  }
});

document.addEventListener('click', async function (event) {
  const voteButton = event.target?.closest ? event.target.closest('.vote-button') : null;
  if (!voteButton) return;

  const container = voteButton.closest('.poll-container');
  if (!container) return;
  event.preventDefault();

  const pollId = container.dataset.pollId;
  if (!pollId) {
    alert('This poll could not be identified. Please reload the page and try again.');
    return;
  }

  const options = container.querySelectorAll('input[type="radio"]');
  const selectedIndexes = [];
  options.forEach((opt, index) => {
    if (opt.checked) selectedIndexes.push(index);
  });

  if (selectedIndexes.length !== 1) {
    alert('Please select an option');
    return;
  }

  if (voteButton.disabled) return;
  voteButton.disabled = true;

  try {
    const response = await fetch('/api/poll/vote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pollId,
        optionIndexes: selectedIndexes
      })
    });

    const raw = await response.text();
    let data = {};
    try {
      data = JSON.parse(raw);
    } catch {
      data = {};
    }
    if (response.ok && data.success) {
      location.reload(); // Refresh to show updated results
    } else {
      alert(data.error || `Vote failed (HTTP ${response.status})`);
    }
  } catch (error) {
    console.error('Vote error:', error);
    alert('Error submitting vote');
  } finally {
    voteButton.disabled = false;
  }
});

