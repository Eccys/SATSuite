// Default value for animation (disabled by default)
let animationEnabled = false;

function syncStateFromStorage(callback) {
  chrome.storage.local.get('animationEnabled', (result) => {
    animationEnabled = Boolean(result && result.animationEnabled);
    updateIcon();
    if (callback) callback(result || {});
  });
}

// Sync state whenever the MV3 service worker wakes up
syncStateFromStorage();

if (chrome.runtime && chrome.runtime.onStartup) {
  chrome.runtime.onStartup.addListener(() => {
    syncStateFromStorage();
  });
}

// Initialize animation setting on extension install/update without overwriting existing user preference
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get('animationEnabled', (result) => {
    if (result && typeof result.animationEnabled === 'boolean') {
      animationEnabled = result.animationEnabled;
      updateIcon();
    } else {
      animationEnabled = false;
      chrome.storage.local.set({ animationEnabled: false }, () => {
        updateIcon();
      });
    }
  });
});

// Listen for clicks on the browser action icon
chrome.action.onClicked.addListener(() => {
  // Toggle the animation setting
  chrome.storage.local.get('animationEnabled', (result) => {
    animationEnabled = !(result && result.animationEnabled);
    
    // Save the new setting
    chrome.storage.local.set({ animationEnabled }, () => {
      // Update the icon to reflect the current state
      updateIcon();
      
      // Notify any open tabs about the change
      notifyContentScripts();
    });
  });
});

// Function to update the browser action icon based on current state
function updateIcon() {
  const iconPath = animationEnabled 
    ? { 
        48: 'icons/icon-enabled-48.png',
        96: 'icons/icon-enabled-96.png'
      }
    : { 
        48: 'icons/icon-48.png',
        96: 'icons/icon-96.png'  
      };
  
  chrome.action.setIcon({ path: iconPath });
  
  const title = animationEnabled 
    ? 'SAT Question Bank Answer Hider (Animation: ON)' 
    : 'SAT Question Bank Answer Hider (Animation: OFF)';
  
  chrome.action.setTitle({ title });
}

// Function to notify all content scripts about the setting change
function notifyContentScripts() {
  chrome.tabs.query({}, (tabs) => {
    if (!Array.isArray(tabs)) return;
    tabs.forEach((tab) => {
      if (!tab || typeof tab.id !== 'number') return;
      try {
        const maybePromise = chrome.tabs.sendMessage(tab.id, { 
          action: 'toggleAnimation', 
          animationEnabled 
        });
        if (maybePromise && typeof maybePromise.catch === 'function') {
          maybePromise.catch(() => {
            // Ignore errors for tabs where content script isn't loaded
          });
        }
      } catch (e) {
        // Ignore errors for tabs where content script isn't loaded
      }
    });
  });
}