const ext = typeof browser !== 'undefined' ? browser : chrome;
const actionApi = ext.browserAction || ext.action;

// Default value for animation (disabled by default)
let animationEnabled = false;

function storageGet(key) {
  return new Promise((resolve) => {
    try {
      if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
        const p = browser.storage.local.get(key);
        if (p && typeof p.then === 'function') {
          p.then((res) => resolve(res || {})).catch(() => resolve({}));
          return;
        }
      }
      ext.storage.local.get(key, (res) => resolve(res || {}));
    } catch (e) {
      resolve({});
    }
  });
}

function storageSet(items) {
  return new Promise((resolve) => {
    try {
      if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
        const p = browser.storage.local.set(items);
        if (p && typeof p.then === 'function') {
          p.then(() => resolve()).catch(() => resolve());
          return;
        }
      }
      ext.storage.local.set(items, () => resolve());
    } catch (e) {
      resolve();
    }
  });
}

function queryTabs(queryInfo) {
  return new Promise((resolve) => {
    try {
      if (typeof browser !== 'undefined' && browser.tabs && browser.tabs.query) {
        const p = browser.tabs.query(queryInfo);
        if (p && typeof p.then === 'function') {
          p.then((tabs) => resolve(tabs || [])).catch(() => resolve([]));
          return;
        }
      }
      ext.tabs.query(queryInfo, (tabs) => resolve(tabs || []));
    } catch (e) {
      resolve([]);
    }
  });
}

// Sync initial state on script load
storageGet('animationEnabled').then((result) => {
  animationEnabled = Boolean(result.animationEnabled);
  updateIcon();
});

// Initialize animation setting on extension install/update
ext.runtime.onInstalled.addListener(async () => {
  const result = await storageGet('animationEnabled');
  if (typeof result.animationEnabled === 'boolean') {
    animationEnabled = result.animationEnabled;
  } else {
    animationEnabled = false;
    await storageSet({ animationEnabled: false });
  }
  updateIcon();
});

// Listen for clicks on the browser action icon
if (actionApi && actionApi.onClicked) {
  actionApi.onClicked.addListener(async () => {
    const result = await storageGet('animationEnabled');
    animationEnabled = !result.animationEnabled;

    // Save the new setting
    await storageSet({ animationEnabled });

    // Update the icon to reflect the current state
    updateIcon();

    // Notify any open tabs about the change
    await notifyContentScripts();
  });
}

// Function to update the browser action icon based on current state
function updateIcon() {
  if (!actionApi) return;

  const iconPath = animationEnabled
    ? {
        48: 'icons/icon-enabled-48.png',
        96: 'icons/icon-enabled-96.png'
      }
    : {
        48: 'icons/icon-48.png',
        96: 'icons/icon-96.png'
      };

  actionApi.setIcon({ path: iconPath });

  const title = animationEnabled
    ? 'SAT Question Bank Answer Hider (Animation: ON)'
    : 'SAT Question Bank Answer Hider (Animation: OFF)';

  actionApi.setTitle({ title });
}

// Function to notify all content scripts about the setting change
async function notifyContentScripts() {
  const tabs = await queryTabs({});
  tabs.forEach((tab) => {
    if (!tab || typeof tab.id !== 'number') return;
    try {
      const maybePromise = ext.tabs.sendMessage(tab.id, {
        action: 'toggleAnimation',
        animationEnabled
      });
      if (maybePromise && typeof maybePromise.catch === 'function') {
        maybePromise.catch(() => {});
      }
    } catch (e) {
      // Ignore errors for tabs where content script isn't loaded
    }
  });
}