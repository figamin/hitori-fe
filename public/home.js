(function () {
  'use strict';

  // Horizontal scrolling for the Recent Images gallery.
  document.querySelectorAll('[data-gallery]').forEach(function (button) {
    button.addEventListener('click', function () {
      var gallery = document.getElementById('galleryScroll');
      if (!gallery) return;
      var direction = Number(button.dataset.gallery) || 1;
      gallery.scrollBy({ left: direction * 120, behavior: 'smooth' });
    });
  });

  // Relative timestamps for active threads.
  function timeAgo(unixTimestamp) {
    var now = Math.floor(Date.now() / 1000);
    var diff = now - unixTimestamp;
    if (diff < 0) return 'In the future';

    var days = Math.floor(diff / 86400);
    var hours = Math.floor((diff % 86400) / 3600);
    var minutes = Math.floor((diff % 3600) / 60);
    var parts = [];

    if (days > 0) parts.push(days + ' day' + (days > 1 ? 's' : ''));
    if (hours > 0) parts.push(hours + ' hour' + (hours > 1 ? 's' : ''));
    if (minutes > 0) parts.push(minutes + ' minute' + (minutes > 1 ? 's' : ''));
    if (parts.length === 0) return 'Just now';
    return parts.join(', ') + ' ago';
  }

  function updateTimestamps() {
    document.querySelectorAll('.time-ago[data-timestamp]').forEach(function (element) {
      var timestamp = parseInt(element.dataset.timestamp, 10);
      if (isNaN(timestamp)) return;
      element.textContent = timeAgo(timestamp);
    });
  }

  updateTimestamps();
  setInterval(updateTimestamps, 30000);

  // Random quote, typed out one character at a time.
  var texts = [
    "Eh, whatever. If I use this Yin-Yang orb well enough, it'll all work out, right?",
    "Genocide is just another game. It doesn't matter if it's humans or Makai residents.",
    "I'll cryo-freeze you together with some English beef!",
    'The books here are worth all the donations your shrine has received over the past five years.',
    "I've been in the basement. For about 495 years.",
    'Silly shrine maiden, your two-colored powers are a mere twenty-eight-point-five-seven-one-four percent as powerful as mine!',
    '90% alcohol, just like a right angle.',
    'If I was the one in charge of judging you, ripping out your tongue would be your sentence.',
    'Who said I was going to eat you? But is that delicious smell coming from you?',
    'Peaches? Hmmm, it`s nostalgic.',
    "Once again I've been falsely accused of being a youkai. I don't mean today, ze.",
    "I can't keep away from my beloved, my precious. Although, if he's shagged her... I'LL KILL HIM!",
    "You've got... a bun in your oven???",
    'HARATAMA! KIYOTAMA!',
    'Hey Ran. It\'s a call from your "treacherous snake".',
    'Ran-chan shiawase!',
    'Darling! Shinobu can go to hell!',
    'WAAA! KURAI YO! SEMAI YO! KOWAI YO!!! ',
    'OTOKO NAN TE!',
    'ORE WA ONNA DA!!!!',
    "Besides, she's a widow, remember? She can't compete against a high school girl."
  ];

  var element = document.getElementById('randomQuote');
  if (!element) return;

  var isAnimating = false;
  var blinking = false;
  var blinkTimer = null;

  function blink() {
    if (blinking) {
      element.textContent = element.textContent.slice(0, -1);
      blinking = false;
    } else {
      element.textContent += '|';
      blinking = true;
    }
  }

  function nextChar(index, text, current) {
    current += text.charAt(index);
    element.textContent = '>' + current + '|';
    index += 1;
    if (index < text.length) {
      setTimeout(function () {
        nextChar(index, text, current);
      }, 50);
    } else {
      element.textContent = '>' + current;
      isAnimating = false;
      blinkTimer = setInterval(blink, 500);
    }
  }

  function newQuote() {
    if (isAnimating) return;
    isAnimating = true;
    var next = texts[Math.floor(Math.random() * texts.length)];
    nextChar(0, next, '');
  }

  element.addEventListener('click', function () {
    newQuote();
    blinking = false;
    clearInterval(blinkTimer);
  });

  newQuote();
})();
