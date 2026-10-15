// Cross-browser extension API reference (supports Firefox `browser` and Chromium `chrome`)
const ext = typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null);

// Global variables
let globalObserver = null;
let urlChangeObserver = null;
let urlChangeTimer = null;
let answerVisible = false;
let animationEnabled = false;
const answerButtonMap = typeof WeakMap !== 'undefined' ? new WeakMap() : null;

function syncVisibleAnswersAnimationClass() {
  if (typeof document === 'undefined' || !document.querySelectorAll) return;
  const answerElements = document.querySelectorAll('.answer-content');
  answerElements.forEach((el) => {
    if (!el.classList.contains('sat-answer-hidden')) {
      if (animationEnabled) {
        el.classList.add('sat-answer-visible');
      } else {
        el.classList.remove('sat-answer-visible');
      }
    }
  });
}

function getStorageValue(key, callback) {
  if (!ext || !ext.storage || !ext.storage.local) {
    callback({});
    return;
  }
  try {
    // Use 1-arg call if Promise-based (Firefox `browser.storage`), or callback for `chrome.storage`
    if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
      const maybePromise = browser.storage.local.get(key);
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.then((result) => callback(result || {})).catch(() => callback({}));
        return;
      }
    }
    ext.storage.local.get(key, (result) => {
      callback(result || {});
    });
  } catch (e) {
    callback({});
  }
}

// Check animation preference on load
getStorageValue('animationEnabled', (result) => {
  animationEnabled = Boolean(result.animationEnabled);
  syncVisibleAnswersAnimationClass();
  console.log('Animation enabled:', animationEnabled);
});

// Listen for messages from the background script
if (ext && ext.runtime && ext.runtime.onMessage) {
  ext.runtime.onMessage.addListener((message) => {
    if (message && message.action === 'toggleAnimation') {
      animationEnabled = Boolean(message.animationEnabled);
      syncVisibleAnswersAnimationClass();
      console.log('Animation setting updated:', animationEnabled);
    }
    return false;
  });
}

// Also keep animationEnabled in sync if storage changes directly
if (ext && ext.storage && ext.storage.onChanged) {
  ext.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.animationEnabled) {
      animationEnabled = Boolean(changes.animationEnabled.newValue);
      syncVisibleAnswersAnimationClass();
    }
  });
}

// Wait for the page to fully load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
}
function resetAndHideAllAnswers() {
  answerVisible = false;
  const answerElements = document.querySelectorAll('.answer-content');
  answerElements.forEach((answerContent) => {
    hideAnswer(answerContent);
  });
}

// Run when navigating between questions via history API
window.addEventListener('popstate', () => {
  resetAndHideAllAnswers();
  initializeExtension();
});

function initializeExtension() {
  // Set up URL change detection
  setupUrlChangeDetection();
  // Initialize the answer hider
  initializeHider();
}

function setupUrlChangeDetection() {
  // Clear any existing observers
  if (urlChangeObserver) {
    urlChangeObserver.disconnect();
  }
  
  // Keep track of the last URL
  let lastUrl = location.href;
  
  // Create an observer instance to monitor URL changes
  urlChangeObserver = new MutationObserver(() => {
    // If the URL has changed
    if (lastUrl !== location.href) {
      lastUrl = location.href;
      console.log('URL changed to:', lastUrl);
      
      // Reset answer visibility state and re-hide any reused answer elements immediately
      resetAndHideAllAnswers();
      
      if (urlChangeTimer) {
        clearTimeout(urlChangeTimer);
        urlChangeTimer = null;
      }

      // If we're on a question page
      if (lastUrl.includes('/digital/results') || lastUrl.includes('questionbank.collegeboard')) {
        // Small delay to ensure any newly mounted DOM nodes are processed without re-hiding answers the user already opened
        urlChangeTimer = setTimeout(() => {
          urlChangeTimer = null;
          initializeHider();
        }, 500);
      }
    }
  });
  
  // Start observing
  const observeTarget = document.documentElement || document;
  urlChangeObserver.observe(observeTarget, {
    subtree: true,
    childList: true
  });
}

function processAnswerElements() {
  const answerElements = document.querySelectorAll('.answer-content');
  answerElements.forEach((answerContent) => {
    if (!answerContent.classList.contains('sat-answer-processed')) {
      console.log('Answer content found, processing...');
      answerContent.classList.add('sat-answer-processed');
      addToggleButtons(answerContent);
      
      // Newly discovered answer blocks always start hidden until the user clicks "Show Answer"
      hideAnswer(answerContent);
      
      // Prevent scroll behavior on click
      preventScrollOnClick(answerContent);
    }
  });
}

function initializeHider() {
  // Clear any existing observers
  if (globalObserver) {
    globalObserver.disconnect();
  }
  
  // Setup the observer to watch for dynamic content
  globalObserver = new MutationObserver(() => {
    processAnswerElements();
  });

  const targetNode = document.body || document.documentElement;
  if (targetNode) {
    // Start observing - keep observing for the entire session
    globalObserver.observe(targetNode, {
      childList: true,
      subtree: true,
      attributes: true
    });
  }
  
  // Also check if the answer content is already there
  processAnswerElements();
}

// Function to prevent scroll behavior when clicking on the answer container
function preventScrollOnClick(element) {
  if (!element) return;
  
  // Get the answer container's parent
  const parentElement = element.parentElement;
  if (parentElement) {
    // Prevent scrolling on the element and its parent
    element.addEventListener('click', function(e) {
      e.preventDefault();
      // Only stop propagation if not clicking a button
      if (!e.target || typeof e.target.closest !== 'function' || !e.target.closest('button')) {
        e.stopPropagation();
      }
      return false;
    });
    
    // Also add this to the parent container to be sure
    parentElement.addEventListener('click', function(e) {
      // Only prevent default if clicking directly on the container, not buttons
      if (e.target === parentElement || e.target === element) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    });
    
    // Fix for any scrollable elements
    element.style.scrollBehavior = 'auto';
    parentElement.style.scrollBehavior = 'auto';
    
    // Disable focus behavior that could cause scrolling
    element.style.outline = 'none';
    parentElement.style.outline = 'none';
  }
}

function addToggleButtons(answerContent) {
  if (!answerContent) return;

  const parentElement = answerContent.parentElement;
  if (!parentElement) return;

  // Remove any existing button container previously created for this specific answerContent
  const previousEntry = answerButtonMap ? answerButtonMap.get(answerContent) : null;
  if (previousEntry && previousEntry.container && typeof previousEntry.container.remove === 'function') {
    previousEntry.container.remove();
  } else if (parentElement.querySelectorAll('.answer-content').length <= 1) {
    const existingContainers = parentElement.querySelectorAll('.sat-button-container');
    existingContainers.forEach((el) => el.remove());
  }

  // Create the container for buttons
  const container = document.createElement('div');
  container.className = 'sat-button-container';
  
  // Create the show button (primary/blue style)
  const showButton = document.createElement('button');
  if (!document.getElementById('sat-show-answer-btn')) {
    showButton.id = 'sat-show-answer-btn';
  }
  showButton.type = 'button';
  showButton.textContent = 'Show Answer';
  showButton.className = 'sat-toggle-btn-primary';
  showButton.setAttribute('data-action', 'show');
  
  // Create the hide button (secondary/white style)
  const hideButton = document.createElement('button');
  if (!document.getElementById('sat-hide-answer-btn')) {
    hideButton.id = 'sat-hide-answer-btn';
  }
  hideButton.type = 'button';
  hideButton.textContent = 'Hide Answer';
  hideButton.className = 'sat-toggle-btn-secondary';
  hideButton.setAttribute('data-action', 'hide');
  hideButton.style.display = 'none'; // Hide initially
  
  // Add click handlers with direct function references
  showButton.addEventListener('click', function(e) {
    e.stopPropagation(); // Prevent event from bubbling up
    showAnswer(answerContent);
  });
  
  hideButton.addEventListener('click', function(e) {
    e.stopPropagation(); // Prevent event from bubbling up
    hideAnswer(answerContent);
  });

  // Add buttons to container
  container.appendChild(showButton);
  container.appendChild(hideButton);
  
  // Make sure the parent has position relative for proper button positioning
  if (window.getComputedStyle(parentElement).position === 'static') {
    parentElement.style.position = 'relative';
  }
  
  // Add the button container to the parent element of the answer content
  parentElement.appendChild(container);
  if (answerButtonMap) {
    answerButtonMap.set(answerContent, { container, showButton, hideButton });
  }
}

function getButtonsForAnswer(answerContent) {
  if (answerButtonMap && answerContent) {
    const mapped = answerButtonMap.get(answerContent);
    if (mapped) {
      return { showButton: mapped.showButton, hideButton: mapped.hideButton };
    }
  }
  const parent = answerContent && answerContent.parentElement;
  const showButton = parent ? parent.querySelector('[data-action="show"]') : null;
  const hideButton = parent ? parent.querySelector('[data-action="hide"]') : null;
  return { showButton, hideButton };
}

function showAnswer(answerContent) {
  if (answerContent) {
    // Update global state
    answerVisible = true;
    
    // Update DOM
    answerContent.classList.remove('sat-answer-hidden');
    
    // Only add animation class if animation is enabled
    if (animationEnabled) {
      answerContent.classList.add('sat-answer-visible');
    } else {
      answerContent.classList.remove('sat-answer-visible');
    }
    
    // Toggle button visibility
    const { showButton, hideButton } = getButtonsForAnswer(answerContent);
    
    if (showButton) showButton.style.display = 'none';
    if (hideButton) hideButton.style.display = 'block';
  }
}

function hideAnswer(answerContent) {
  if (answerContent) {
    // Update global state
    answerVisible = false;
    
    // Always remove visible animation class when hiding
    answerContent.classList.remove('sat-answer-visible');
    answerContent.classList.add('sat-answer-hidden');
    
    // Toggle button visibility
    const { showButton, hideButton } = getButtonsForAnswer(answerContent);
    
    if (showButton) showButton.style.display = 'block';
    if (hideButton) hideButton.style.display = 'none';
  }
}