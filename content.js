// content.js – runs on every site that the user has enabled
// ---------------------------------------------------------------
// 1️⃣ Get the stored opening mode (foreground or background)
function getOpenMode(callback) {
  chrome.storage.sync.get(['defaultMode'], (data) => {
    // Fallback to foreground if nothing is stored yet
    callback(data.defaultMode || 'foreground');
  });
}

// ---------------------------------------------------------------
// 2️⃣ Click handler that works for *any* <a> element, regardless of
//    its target attribute (_blank, _top, _self, etc.).
function handleLinkClick(event) {
  // ---------------------------------------------------------
  // Only act on a plain left‑click without modifier keys.
  // Let Ctrl/⌘/Shift/Alt clicks behave normally (they already
  // open a new tab/window the way the user expects).
  if (event.button !== 0 ||
      event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
    return;
  }

  // ---------------------------------------------------------
  // Find the nearest <a> that actually has an href attribute.
  const anchor = event.target.closest('a[href]');
  if (!anchor) return; // not a link we care about

  // ---------------------------------------------------------
  // Prevent the browser’s default navigation, which also stops
  // it from honoring any target attribute (e.g. _top, _blank).
  event.preventDefault();
  event.stopPropagation();

  // ---------------------------------------------------------
  // Ask the background script to open the URL with the chosen mode.
  const url = anchor.href;
  getOpenMode((mode) => {
    chrome.runtime.sendMessage({
      action: 'openLink',
      url,
      background: mode === 'background'   // true → open in background tab
    });
  });
}

// ---------------------------------------------------------------
// 3️⃣ Attach the listener as early as possible (capture phase)
//    so it runs before the browser processes the link.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('click', handleLinkClick, true);
  });
} else {
  document.addEventListener('click', handleLinkClick, true);
}
