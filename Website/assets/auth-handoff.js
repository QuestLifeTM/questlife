(() => {
  const main = document.querySelector("main[data-app-path]");
  const button = document.getElementById("open-app");
  const help = document.getElementById("help");
  const appPath = main?.dataset.appPath;

  if (!button || !help || !appPath) return;

  const code = new URLSearchParams(window.location.search).get("code");
  if (!code) {
    help.textContent = main.dataset.missingMessage || "This link is incomplete or has already been used. Return to QuestLife and request a new link.";
    help.classList.add("error");
    return;
  }

  button.href = `questlife://${appPath}?code=${encodeURIComponent(code)}`;
  button.setAttribute("aria-disabled", "false");
  help.textContent = main.dataset.readyMessage || "If the app does not open, launch QuestLife and try again.";

  // Remove the one-time code from browser history immediately. It stays only
  // on the user-initiated deep-link target, where the app exchanges it once.
  window.history.replaceState({}, document.title, window.location.pathname);
})();
