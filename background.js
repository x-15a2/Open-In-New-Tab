 // background.js – core extension logic

// ---------------------------------------------------
// 1️⃣ Inject content script on pages that are enabled
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab?.url) return;

  const origin = new URL(tab.url).origin;

  chrome.storage.sync.get(['enabledSites'], ({ enabledSites = [] }) => {
    if (!enabledSites.includes(origin)) return;

    // Verify the tab is still on the same URL before injecting
    chrome.tabs.get(tabId, (current) => {
      if (chrome.runtime.lastError || current?.url !== tab.url) return;

      chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      });
    });
  });
});

// ---------------------------------------------------
// 2️⃣ Handle messages from content.js (open‑link logic)
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.action !== 'openLink') return false;

  // Ensure we have a boolean – default to foreground if missing
  const isBackground = !!msg.background;

  // -------------------------------------------------
  // Create the tab (inactive when background requested)
  chrome.tabs.create(
    {
      url: msg.url,
      active: !isBackground               // true → foreground, false → background
    },
    (newTab) => {
      // If foreground, nothing else to do
      if (!isBackground) return;

      // -------------------------------------------------
      // Re‑focus the original tab to guarantee it stays on top
      const originalTabId = sender.tab?.id;
      if (originalTabId) {
        chrome.tabs.update(originalTabId, { active: true }, () => {
          // Safety net: make sure the newly created tab stays inactive
          if (newTab?.id) {
            chrome.tabs.update(newTab.id, { active: false });
          }
        });
      } else {
        // If for some reason we don't have the sender tab, just ensure the new tab is inactive
        if (newTab?.id) {
          chrome.tabs.update(newTab.id, { active: false });
        }
      }
    }
  );

  return false; // no async response needed
});

// ---------------------------------------------------
// 3️⃣ Refresh request coming from popup or toolbar click
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.action !== 'refreshCurrentTab') return false;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
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
chrome.action.onClicked.addListener((tab) => {
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
