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

// --- Product scraping: parse HTML for JSON-LD and meta (Option 2)
function parseProductFromHtml(html, pageUrl) {
  const result = { name: '', price: '', image: '', url: pageUrl || '' };

  // Resolve relative URLs against page origin
  const baseUrl = pageUrl ? new URL(pageUrl).origin : '';

  function resolveUrl(url) {
    if (!url || url.startsWith('data:')) return url;
    if (url.startsWith('http')) return url;
    if (url.startsWith('//')) return 'https:' + url;
    try {
      return new URL(url, baseUrl).href;
    } catch {
      return url;
    }
  }

  // 1. JSON-LD (schema.org Product)
  const ldJsonRegex = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = ldJsonRegex.exec(html)) !== null) {
    try {
      const raw = match[1].replace(/<!--[\s\S]*?-->/g, '').trim();
      const json = JSON.parse(raw);
      const items = Array.isArray(json) ? json : json['@graph'] ? json['@graph'] : [json];
      for (const item of items) {
        if (!item || item['@type'] !== 'Product') continue;
        if (item.name && !result.name) result.name = String(item.name).trim();
        if (item.image) {
          const img = Array.isArray(item.image) ? item.image[0] : item.image;
          if (img && typeof img === 'string' && !result.image) result.image = resolveUrl(img);
          else if (img && img.url && !result.image) result.image = resolveUrl(img.url);
        }
        const offers = item.offers;
        if (offers) {
          const offer = Array.isArray(offers) ? offers[0] : offers;
          if (offer && offer.price !== undefined && !result.price) {
            result.price = String(offer.price).trim().replace(/,/g, '');
          }
          if (offer && offer.lowPrice !== undefined && !result.price) {
            result.price = String(offer.lowPrice).trim().replace(/,/g, '');
          }
        }
        if (result.name && result.price && result.image) break;
      }
    } catch (_) {}
  }

  // 2. Meta tags (Open Graph, product)
  const metaRegex = /<meta[^>]+(?:property|name)=["']([^"']+)["'][^>]+content=["']([^"']*)["']/gi;
  const metaByProp = {};
  while ((match = metaRegex.exec(html)) !== null) {
    metaByProp[match[1].toLowerCase()] = (match[2] || '').trim();
  }
  if (!result.name && metaByProp['og:title']) result.name = metaByProp['og:title'];
  if (!result.image && metaByProp['og:image']) result.image = resolveUrl(metaByProp['og:image']);
  if (!result.price && metaByProp['product:price:amount']) result.price = metaByProp['product:price:amount'].replace(/,/g, '');
  if (!result.price && metaByProp['twitter:data1']) {
    const priceMatch = metaByProp['twitter:data1'].match(/[\d,]+\.?\d*/);
    if (priceMatch) result.price = priceMatch[0].replace(/,/g, '');
  }

  return result;
}

// Check if we have at least name, price, and image
function hasRequiredProductData(data) {
  return !!(data && data.name && data.price && data.image);
}

// Send scrape result to extension pages (avoids "message port closed" when SW is killed during long work)
function sendScrapeResult(requestId, success, data) {
  try {
    chrome.runtime.sendMessage({ action: 'scrapeProductFromUrlResult', requestId, success, data }).catch(() => {});
  } catch (_) {}
}

// Scrape product: Option 2 (fetch + parse) then Option 3 (open tab + content script) on failure.
// Result is sent via a second message so we don't hold the message port open (fixes "port closed" error).
function scrapeProductFromUrl(url, requestId) {
  fetch(url, { credentials: 'omit', redirect: 'follow' })
    .then((res) => (res.ok ? res.text() : Promise.reject(new Error('Fetch failed'))))
    .then((html) => {
      const data = parseProductFromHtml(html, url);
      if (hasRequiredProductData(data)) {
        sendScrapeResult(requestId, true, { name: data.name, price: data.price, image: data.image, url });
        return;
      }
      // Option 3: open tab, run content script, send result when done
      chrome.tabs.create({ url }, (tab) => {
        const tabId = tab.id;
        const onUpdated = (tid, changeInfo) => {
          if (tid !== tabId || changeInfo.status !== 'complete') return;
          chrome.tabs.onUpdated.removeListener(onUpdated);
          setTimeout(() => {
            chrome.tabs.sendMessage(tabId, { action: 'extractProductInfo' }, (response) => {
              chrome.tabs.remove(tabId);
              if (chrome.runtime.lastError || !response || !response.success) {
                sendScrapeResult(requestId, false, null);
                return;
              }
              const d = response.data || {};
              const name = (d.title || d.name || '').trim();
              const price = typeof d.price === 'string' ? d.price.replace(/,/g, '') : String(d.price || '');
              const image = (d.image || '').trim();
              sendScrapeResult(requestId, !!(name && price && image), { name, price, image, url });
            });
          }, 800);
        };
        chrome.tabs.onUpdated.addListener(onUpdated);
      });
    })
    .catch(() => {
      sendScrapeResult(requestId, false, null);
    });
}

// Listen for messages from content scripts and side panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scrapeProductFromUrl') {
    const url = request.url;
    const requestId = request.requestId || Date.now();
    if (!url || !url.startsWith('http')) {
      sendResponse({ success: false, data: null });
      return true;
    }
    // Reply immediately so the message port doesn't close while we fetch/open tab (MV3 service worker can be killed)
    sendResponse({ pending: true, requestId });
    scrapeProductFromUrl(url, requestId);
    return true;
  }

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

