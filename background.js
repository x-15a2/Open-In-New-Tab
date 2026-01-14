// ==================== background.js ====================
// 1️⃣  Guarded injection – only run on allowed sites *and* on pages that are NOT
//     part of the Chrome Web Store or any chrome:// URL.
const BLOCKED_PATTERNS = [
  '*://chrome.google.com/webstore/*',
  'chrome://*/*'               // chrome://extensions, chrome://settings, …
];
const BLOCKED_REGEXES = BLOCKED_PATTERNS.map(p =>
  new RegExp('^' + p.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$')
);
function canInject(url) {
  return !BLOCKED_REGEXES.some(r => r.test(url));
}

// ---------------------------------------------------
// 1️⃣ Inject content script on pages that are enabled (safe version)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab?.url) return;

  // Skip protected Chrome pages – prevents the “gallery cannot be scripted” error
  if (!canInject(tab.url)) {
    console.log('Skipping script injection on protected page:', tab.url);
    return;
  }

  const origin = new URL(tab.url).origin;

  chrome.storage.sync.get(['enabledSites'], ({ enabledSites = [] }) => {
    if (!enabledSites.includes(origin)) return;

    // Verify the tab is still on the same URL before injecting
    chrome.tabs.get(tabId, current => {
      if (chrome.runtime.lastError || current?.url !== tab.url) return;

      chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      }).catch(err => console.warn('Injection failed:', err.message));
    });
  });
});

// ---------------------------------------------------
// 2️⃣ Handle messages from content.js (open‑link logic)
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.action !== 'openLink') return false;

  const isBackground = !!msg.background; // default to foreground if missing

  chrome.tabs.create(
    {
      url: msg.url,
      active: !isBackground // true → foreground, false → background
    },
    newTab => {
      if (!isBackground) return; // foreground case – nothing else to do

      // Re‑focus the original tab so it stays on top
      const originalTabId = sender.tab?.id;
      if (originalTabId) {
        chrome.tabs.update(originalTabId, { active: true }, () => {
          // Ensure the newly created tab stays inactive
          if (newTab?.id) chrome.tabs.update(newTab.id, { active: false });
        });
      } else if (newTab?.id) {
        // Fallback – just make sure the new tab is inactive
        chrome.tabs.update(newTab.id, { active: false });
      }
    }
  );

  return false; // no async response needed
});

// ---------------------------------------------------
// 3️⃣ Refresh request coming from popup or toolbar click
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.action !== 'refreshCurrentTab') return false;

  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const tab = tabs[0];
    if (!tab?.url) return;

    const origin = new URL(tab.url).origin;
    chrome.storage.sync.get(['enabledSites'], ({ enabledSites = [] }) => {
      if (enabledSites.includes(origin)) {
        chrome.tabs.reload(tab.id);
      } else {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'Refresh not allowed',
          message: `Site ${origin} is not enabled for “Open In New Tab”.`
        });
      }
    });
  });

  return true; // keep channel open (not strictly needed)
});

// ---------------------------------------------------
// 4️⃣ Toolbar button – reuse the same refresh logic
chrome.action.onClicked.addListener(tab => {
  if (!tab?.url) return;

  const origin = new URL(tab.url).origin;
  chrome.storage.sync.get(['enabledSites'], ({ enabledSites = [] }) => {
    if (enabledSites.includes(origin)) {
      chrome.tabs.reload(tab.id);
    } else {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Refresh not allowed',
        message: `Site ${origin} is not enabled for “Open In New Tab”.`
      });
    }
  });
});
