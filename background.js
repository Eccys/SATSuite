// Default value for animation (disabled by default)
let animationEnabled = false;

// Initialize animation setting on extension load
browser.runtime.onInstalled.addListener(() => {
  // Set default to no animation
  browser.storage.local.set({ animationEnabled: false });
  updateIcon();
});

// Listen for clicks on the browser action icon
browser.browserAction.onClicked.addListener(() => {
  // Toggle the animation setting
  browser.storage.local.get('animationEnabled', (result) => {
    animationEnabled = !result.animationEnabled;
    
    // Save the new setting
    browser.storage.local.set({ animationEnabled });
    
    // Update the icon to reflect the current state
    updateIcon();
    
    // Notify any open tabs about the change
    notifyContentScripts();
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
  
  browser.browserAction.setIcon({ path: iconPath });
  
  const title = animationEnabled 
    ? 'SAT Question Bank Answer Hider (Animation: ON)' 
    : 'SAT Question Bank Answer Hider (Animation: OFF)';
  
  browser.browserAction.setTitle({ title });
}

// Function to notify all content scripts about the setting change
function notifyContentScripts() {
  browser.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      browser.tabs.sendMessage(tab.id, { 
        action: 'toggleAnimation', 
        animationEnabled 
      }).catch(() => {
        // Ignore errors for tabs where content script isn't loaded
      });
    });
  });
} 