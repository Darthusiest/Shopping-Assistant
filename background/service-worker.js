// Background Service Worker for Market Shopper Extension
// SS capture
// Storage: search history, tracked products, shopping lists, wishlist, history
// Message passing: between content script and background script
// Extension icon: Market Shopper


// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Market Shopper extension installed');
    // Initialize default storage
    chrome.storage.local.set({
      searchHistory: [],
      trackedProducts: [],
      shoppingLists: [],
      wishlist: []
    });
  }
});

// Handle side panel opening
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// Listen for messages from content scripts and side panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureScreenshot') {
    // Capture screenshot of the current tab
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, imageData: dataUrl });
      }
    });
    return true; // Required for async response
  }

  if (request.action === 'saveSearch') {
    // Save search to history
    chrome.storage.local.get(['searchHistory'], (result) => {
      const history = result.searchHistory || [];
      history.unshift({
        timestamp: Date.now(),
        product: request.product,
        price: request.price,
        results: request.results
      });
      // Keep only last 50 searches
      const limitedHistory = history.slice(0, 50);
      chrome.storage.local.set({ searchHistory: limitedHistory });
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'trackProduct') {
    // Add product to tracking list
    chrome.storage.local.get(['trackedProducts'], (result) => {
      const tracked = result.trackedProducts || [];
      tracked.push({
        id: Date.now(),
        name: request.name,
        currentPrice: request.price,
        targetPrice: request.targetPrice,
        url: request.url,
        addedDate: Date.now()
      });
      chrome.storage.local.set({ trackedProducts: tracked });
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'getStorage') {
    // Get storage data
    chrome.storage.local.get([request.key], (result) => {
      sendResponse({ success: true, data: result[request.key] });
    });
    return true;
  }

  if (request.action === 'setStorage') {
    // Set storage data
    chrome.storage.local.set({ [request.key]: request.value }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// Handle tab updates to potentially inject content scripts
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Tab finished loading, content script will handle interaction
  }
});

