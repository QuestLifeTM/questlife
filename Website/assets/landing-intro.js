(() => {
  const page = document.documentElement;

  page.classList.add('is-loading');

  const startIntro = () => {
    window.requestAnimationFrame(() => page.classList.add('is-rotating'));
    window.setTimeout(() => page.classList.replace('is-loading', 'is-ready'), 2800);
  };

  const setUpMemoryCard = () => {
    const card = document.querySelector('[data-memory-card]');
    const photos = [...document.querySelectorAll('[data-memory-photo]')];
    const dates = [...document.querySelectorAll('[data-memory-date]')];
    const memories = [
      ['coffee-cake.jpg', 'October 14'],
      ['city-sunset.jpg', 'September 28'],
      ['cafe-window.jpg', 'August 17'],
      ['trail-marker.jpg', 'July 06'],
      ['pool-night.jpg', 'June 22'],
      ['moon-lines.jpg', 'May 10'],
    ];
    let memoryIndex = 0;

    if (!card || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    card.addEventListener('animationiteration', () => {
      memoryIndex = (memoryIndex + 1) % memories.length;
      const [fileName, date] = memories[memoryIndex];

      photos.forEach((photo) => {
        photo.src = `/assets/moments/${fileName}`;
      });
      dates.forEach((dateLabel) => {
        dateLabel.textContent = date;
      });
    });
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
