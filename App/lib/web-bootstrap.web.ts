import { Alert, Share } from "react-native";

// React Native Web's Alert is a no-op. A native HTML dialog preserves every
// action (including cancel/destructive) and supplies keyboard focus trapping.
Alert.alert = (title, message, buttons = [{ text: "OK" }], options) => {
  const previousFocus = document.activeElement as HTMLElement | null;
  const dialog = document.createElement("dialog");
  dialog.className = "questlife-dialog";
  dialog.setAttribute("aria-label", title);
  const heading = document.createElement("h2");
  heading.textContent = title;
  dialog.append(heading);
  if (message) { const copy = document.createElement("p"); copy.textContent = message; dialog.append(copy); }
  const actions = document.createElement("div");
  actions.className = "questlife-dialog-actions";
  const close = () => { dialog.close(); dialog.remove(); previousFocus?.focus(); };
  for (const action of buttons) {
    const button = document.createElement("button");
    button.textContent = action.text ?? "OK";
    button.dataset.intent = action.style ?? "default";
    button.onclick = () => { close(); action.onPress?.(); };
    actions.append(button);
  }
  dialog.append(actions);
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    const cancel = buttons.find((button) => button.style === "cancel");
    if (options?.cancelable === false && !cancel) return;
    close(); cancel?.onPress?.(); options?.onDismiss?.();
  });
  document.body.append(dialog);
  dialog.showModal();
};

Share.share = async (content) => {
  const data = { title: content.title, text: "message" in content ? content.message : undefined, url: "url" in content ? content.url : undefined };
  if (navigator.share) {
    try { await navigator.share(data); return { action: Share.sharedAction }; }
    catch (error) { if (error instanceof DOMException && error.name === "AbortError") return { action: Share.dismissedAction }; }
  }
  const text = [data.text, data.url].filter(Boolean).join("\n");
  try { await navigator.clipboard.writeText(text); Alert.alert("Copied to clipboard", "Paste this into a message to share it."); }
  catch { Alert.alert("Share", text); }
  return { action: Share.sharedAction };
};

const style = document.createElement("style");
style.textContent = `
  html, body, #root { height: 100%; min-height: 100%; }
  body { margin: 0; overscroll-behavior: none; }
  * { box-sizing: border-box; }
  :focus-visible { outline: 3px solid #2581cb !important; outline-offset: 3px; }
  [role=button], [role=tab], [role=link], button, a { cursor: pointer; touch-action: manipulation; }
  [aria-disabled=true] { cursor: default; }
  input, textarea { min-width: 0; }
  [data-testid=web-sheet-body] { overflow-y: auto; overflow-x: hidden; }
  @media (hover:hover) { a:hover, [role=button]:not([aria-disabled=true]):hover { filter: brightness(.97); } }
  .questlife-dialog { max-width: min(460px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); overflow: auto; padding: 24px; border: 2px solid #e8dfd5; border-radius: 20px; background: #fffcf5; color: #3d3438; font-family: Rubik, sans-serif; }
  .questlife-dialog::backdrop { background: rgb(24 20 28 / .5); }
  .questlife-dialog h2 { margin: 0 0 12px; font-size: 21px; }
  .questlife-dialog p { line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; }
  .questlife-dialog-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 10px; margin-top: 24px; }
  .questlife-dialog button { min-height: 44px; padding: 10px 18px; border-radius: 12px; border: 1px solid #e8dfd5; color: #3d3438; background: white; font: inherit; font-weight: 700; }
  .questlife-dialog button[data-intent=destructive] { background: #b52e24; color: white; }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; transition-duration: .01ms !important; } }
  #main-content { container-type: inline-size; }
  @container (min-width: 780px) {
    #web-lobby-composition { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; gap: 24px; }
    #web-lobby-composition > :first-child { grid-column: 1 / -1; }
    [data-testid=web-settings-groups] { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; gap: 24px; }
    #web-quest-details { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; gap: 24px; }
    #web-quest-details > :first-child { grid-column: 1 / -1; }
    #web-profile-composition { display: grid; grid-template-columns: 340px minmax(0, 1fr); align-items: start; gap: 24px; }
  }
`;
document.head.append(style);
