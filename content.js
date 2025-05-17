// Global variables
let globalObserver = null;
let urlChangeObserver = null;
let answerVisible = false;
let animationEnabled = false;

// Check animation preference on load
browser.storage.local.get('animationEnabled', (result) => {
  animationEnabled = result.animationEnabled || false;
  console.log('Animation enabled:', animationEnabled);
});

// Listen for messages from the background script
browser.runtime.onMessage.addListener((message) => {
  if (message.action === 'toggleAnimation') {
    animationEnabled = message.animationEnabled;
    console.log('Animation setting updated:', animationEnabled);
  }
  return true;
});

// Wait for the page to fully load
document.addEventListener('DOMContentLoaded', initializeExtension);
// Run when navigating between questions via history API
window.addEventListener('popstate', initializeExtension);
// Run immediately in case the DOM is already loaded
initializeExtension();

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
      
      // Reset answer visibility state
      answerVisible = false;
      
      // If we're on a question page
      if (lastUrl.includes('/digital/results') || lastUrl.includes('questionbank.collegeboard')) {
        // Small delay to ensure DOM is updated
        setTimeout(() => {
          initializeHider();
        }, 500);
      }
    }
  });
  
  // Start observing
  urlChangeObserver.observe(document, {
    subtree: true,
    childList: true
  });
}

function initializeHider() {
  // Clear any existing observers
  if (globalObserver) {
    globalObserver.disconnect();
  }
  
  // Setup the observer to watch for dynamic content
  globalObserver = new MutationObserver((mutations) => {
    const answerContent = document.querySelector('.answer-content');
    if (answerContent && !answerContent.classList.contains('sat-answer-processed')) {
      console.log('Answer content found, processing...');
      answerContent.classList.add('sat-answer-processed');
      addToggleButtons(answerContent);
      
      // Set initial visibility state based on global state
      if (answerVisible) {
        showAnswer(answerContent);
      } else {
        hideAnswer(answerContent);
      }
      
      // Prevent scroll behavior on click
      preventScrollOnClick(answerContent);
    }
  });

  // Start observing - keep observing for the entire session
  globalObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true
  });
  
  // Also check if the answer content is already there
  const answerContent = document.querySelector('.answer-content');
  if (answerContent && !answerContent.classList.contains('sat-answer-processed')) {
    console.log('Answer content already present, processing...');
    answerContent.classList.add('sat-answer-processed');
    addToggleButtons(answerContent);
    
    // Set initial visibility state based on global state
    if (answerVisible) {
      showAnswer(answerContent);
    } else {
      hideAnswer(answerContent);
    }
    
    // Prevent scroll behavior on click
    preventScrollOnClick(answerContent);
  }
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
      if (!e.target.closest('button')) {
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
  // Remove any existing buttons
  const existingContainer = document.querySelector('.sat-button-container');
  if (existingContainer) {
    existingContainer.remove();
  }

  if (!answerContent) return;

  // Create the container for buttons
  const container = document.createElement('div');
  container.className = 'sat-button-container';
  
  // Create the show button (primary/blue style)
  const showButton = document.createElement('button');
  showButton.id = 'sat-show-answer-btn';
  showButton.textContent = 'Show Answer';
  showButton.className = 'sat-toggle-btn-primary';
  showButton.setAttribute('data-action', 'show');
  
  // Create the hide button (secondary/white style)
  const hideButton = document.createElement('button');
  hideButton.id = 'sat-hide-answer-btn';
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
  const parentElement = answerContent.parentElement;
  if (parentElement) {
    if (window.getComputedStyle(parentElement).position === 'static') {
      parentElement.style.position = 'relative';
    }
  }
  
  // Add the button container to the parent element of the answer content
  parentElement.appendChild(container);
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
    }
    
    // Toggle button visibility
    const showButton = document.getElementById('sat-show-answer-btn');
    const hideButton = document.getElementById('sat-hide-answer-btn');
    
    if (showButton) showButton.style.display = 'none';
    if (hideButton) hideButton.style.display = 'block';
  }
}

function hideAnswer(answerContent) {
  if (answerContent) {
    // Update global state
    answerVisible = false;
    
    // Update DOM
    if (animationEnabled) {
      answerContent.classList.remove('sat-answer-visible');
    }
    answerContent.classList.add('sat-answer-hidden');
    
    // Toggle button visibility
    const showButton = document.getElementById('sat-show-answer-btn');
    const hideButton = document.getElementById('sat-hide-answer-btn');
    
    if (showButton) showButton.style.display = 'block';
    if (hideButton) hideButton.style.display = 'none';
  }
} 