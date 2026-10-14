(() => {
  const page = document.documentElement;

  page.classList.add('is-loading');

  const startIntro = () => {
    window.requestAnimationFrame(() => page.classList.add('is-rotating'));
    window.setTimeout(() => page.classList.replace('is-loading', 'is-ready'), 2800);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startIntro, { once: true });
  } else {
    startIntro();
  }
})();
