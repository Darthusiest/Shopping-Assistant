// Content Script for Market Shopper Extension
// This script runs on web pages and can interact with the page content

//extracts product info from web page
//highlights price elements on the page
// sends product info to side panel or background

// watch for messages from side panel or background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractProductInfo') {
    // Extract product information from the current page
    const productInfo = extractProductData();
    sendResponse({ success: true, data: productInfo });
  }

  if (request.action === 'highlightPrice') {
    // Highlight price elements on the page
    highlightPrices();
    sendResponse({ success: true });
  }
});

// Function to extract product data from the page (JSON-LD / meta first, then DOM)
function extractProductData() {
  const data = {
    title: '',
    price: '',
    image: '',
    description: '',
    url: window.location.href
  };

  // 1. JSON-LD (schema.org Product) – most reliable when present
  const ldScripts = document.querySelectorAll('script[type="application/ld+json"]');
  ldScripts.forEach((script) => {
    try {
      const raw = script.textContent.replace(/<!--[\s\S]*?-->/g, '').trim();
      const json = JSON.parse(raw);
      const items = Array.isArray(json) ? json : json['@graph'] ? json['@graph'] : [json];
      for (const item of items) {
        if (!item || item['@type'] !== 'Product') continue;
        if (item.name && !data.title) data.title = String(item.name).trim();
        if (item.image) {
          const img = Array.isArray(item.image) ? item.image[0] : item.image;
          if (img && typeof img === 'string' && !data.image) data.image = img;
          else if (img && img.url && !data.image) data.image = img.url;
        }
        const offers = item.offers;
        if (offers) {
          const offer = Array.isArray(offers) ? offers[0] : offers;
          if (offer && offer.price !== undefined && !data.price) {
            data.price = String(offer.price).trim().replace(/,/g, '');
          }
          if (offer && offer.lowPrice !== undefined && !data.price) {
            data.price = String(offer.lowPrice).trim().replace(/,/g, '');
          }
        }
      }
    } catch (_) {}
  });

  // 2. Meta tags (Open Graph, product)
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle && ogTitle.content && !data.title) data.title = ogTitle.content.trim();
  const ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage && ogImage.content && !data.image) data.image = ogImage.content.trim();
  const priceMeta = document.querySelector('meta[property="product:price:amount"], meta[name="product:price:amount"]');
  if (priceMeta && priceMeta.content && !data.price) data.price = priceMeta.content.replace(/,/g, '');

  // 3. DOM fallbacks
  const titleSelectors = [
    'h1[data-testid="product-title"]',
    'h1.product-title',
    '#productTitle',
    '#title',
    'h1',
    '[data-product-title]'
  ];
  for (const selector of titleSelectors) {
    const el = document.querySelector(selector);
    if (el && el.textContent && !data.title) {
      data.title = el.textContent.trim();
      break;
    }
  }

  const priceSelectors = [
    '[data-testid="price"]',
    '.a-price .a-offscreen',
    '.price',
    '#price',
    '[class*="price"]',
    '[id*="price"]'
  ];
  for (const selector of priceSelectors) {
    const el = document.querySelector(selector);
    if (el) {
      const text = el.textContent.trim();
      const priceMatch = text.match(/[\d,]+\.?\d*/);
      if (priceMatch && !data.price) {
        data.price = priceMatch[0].replace(/,/g, '');
        break;
      }
    }
  }

  const imageSelectors = [
    'img[data-testid="product-image"]',
    '#landingImage',
    '.product-image img',
    '#product-image img',
    'img[alt*="product"]',
    'img[src*="product"]',
    'img[src*="images"]'
  ];
  for (const selector of imageSelectors) {
    const el = document.querySelector(selector);
    if (el && (el.src || el.dataset.src) && !data.image) {
      data.image = (el.src || el.dataset.src || '').trim();
      break;
    }
  }

  const descSelectors = [
    '[data-testid="product-description"]',
    '.product-description',
    '#productDescription',
    '[class*="description"]'
  ];
  for (const selector of descSelectors) {
    const el = document.querySelector(selector);
    if (el && !data.description) {
      data.description = el.textContent.trim().substring(0, 500);
      break;
    }
  }

  return data;
}

// Function to highlight price elements on the page
function highlightPrices() {
  const priceSelectors = [
    '[data-testid="price"]',
    '.price',
    '#price',
    '[class*="price"]'
  ];

  priceSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      el.style.backgroundColor = 'yellow';
      el.style.transition = 'background-color 0.3s';
      setTimeout(() => {
        el.style.backgroundColor = '';
      }, 2000);
    });
  });
}

// Inject a button or UI element if needed (optional)
function injectShoppingAssistantButton() {
  // This can be used to add a floating button or UI element
  // to trigger the extension from the page
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('Market Shopper content script loaded');
  });
} else {
  console.log('Market Shopper content script loaded');
}

