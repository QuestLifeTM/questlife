(() => {
  const page = document.documentElement;

  page.classList.add('is-loading');

  const startIntro = () => {
    window.requestAnimationFrame(() => page.classList.add('is-rotating'));
    window.setTimeout(() => page.classList.replace('is-loading', 'is-ready'), 2800);
  };

  const setUpMemoryCard = () => {
    const card = document.querySelector('[data-memory-card]');
    const front = card?.querySelector('.memory-card__face--front');
    const back = card?.querySelector('.memory-card__face--back');
    const memories = [
      ['coffee-cake.jpg', 'October 14'],
      ['city-sunset.jpg', 'September 28'],
      ['cafe-window.jpg', 'August 17'],
      ['trail-marker.jpg', 'July 06'],
      ['pool-night.jpg', 'June 22'],
      ['moon-lines.jpg', 'May 10'],
    ];
    let memoryIndex = 0;
    let showingBack = false;

    if (!card || !front || !back || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const updateFace = (face, index) => {
      const [fileName, date] = memories[index];
      face.querySelector('[data-memory-photo]').src = `/assets/moments/${fileName}`;
      face.querySelector('[data-memory-date]').textContent = date;
    };

    const flipToNextMemory = () => {
      const nextIndex = (memoryIndex + 1) % memories.length;
      const hiddenFace = showingBack ? front : back;

      updateFace(hiddenFace, nextIndex);
      card.classList.toggle('is-flipped');
      showingBack = !showingBack;
      memoryIndex = nextIndex;

      window.setTimeout(flipToNextMemory, 5000);
    };

    window.setTimeout(flipToNextMemory, 3400);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      startIntro();
      setUpMemoryCard();
    }, { once: true });
  } else {
    startIntro();
    setUpMemoryCard();
  }
})();
