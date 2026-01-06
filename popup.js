// popup.js – UI logic and communication with background.js

// -------------------------------------------------------------------
// Helper: obtain the origin (and tab id) of the currently active tab
function getCurrentTabInfo(callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab?.url) return callback(null, null);
    try {
      const origin = new URL(tab.url).origin;
      callback(origin, tab.id);
    } catch (e) {
      callback(null, null);
    }
  });
}

// -------------------------------------------------------------------
// Initialise UI based on stored settings
function initPopup() {
  getCurrentTabInfo((origin) => {
    if (!origin) return;

    chrome.storage.sync.get(['enabledSites', 'defaultMode'], (data) => {
      const sites = data.enabledSites || [];
      const isEnabled = sites.includes(origin);
      document.getElementById('siteToggle').checked = isEnabled;

      const mode = data.defaultMode || 'foreground';
      document.getElementById(mode).checked = true;
    });
  });
}

// -------------------------------------------------------------------
// Checkbox: enable/disable the current site
document.getElementById('siteToggle').addEventListener('change', (e) => {
  const enable = e.target.checked;
  getCurrentTabInfo((origin) => {
    if (!origin) return;

    chrome.storage.sync.get(['enabledSites'], ({ enabledSites = [] }) => {
      const set = new Set(enabledSites);
      enable ? set.add(origin) : set.delete(origin);
      chrome.storage.sync.set({ enabledSites: Array.from(set) });
    });
  });
});

// -------------------------------------------------------------------
// Radio buttons: store the chosen mode for content.js
document.querySelectorAll('input[name="mode"]').forEach((radio) => {
  radio.addEventListener('change', (e) => {
    if (e.target.checked) {
      chrome.storage.sync.set({ defaultMode: e.target.value });
    }
  });
});

// -------------------------------------------------------------------
// Refresh button – ask background to reload the tab (only if enabled)
document.getElementById('refreshBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'refreshCurrentTab' });
});

// -------------------------------------------------------------------
// Run when the popup opens
document.addEventListener('DOMContentLoaded', initPopup);
