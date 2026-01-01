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

// Function to extract product data from the page
function extractProductData() {
  const data = {
    title: '',
    price: '',
    image: '',
    description: '',
    url: window.location.href
  };

  // Try to find product title (common selectors)
  const titleSelectors = [
    'h1[data-testid="product-title"]',
    'h1.product-title',
    '#productTitle',
    'h1',
    '[data-product-title]'
  ];

  for (const selector of titleSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      data.title = element.textContent.trim();
      break;
    }
  }

  // Try to find price (common selectors)
  const priceSelectors = [
    '[data-testid="price"]',
    '.price',
    '#price',
    '[class*="price"]',
    '[id*="price"]'
  ];

  for (const selector of priceSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      const priceText = element.textContent.trim();
      // Extract price using regex
      const priceMatch = priceText.match(/[\d,]+\.?\d*/);
      if (priceMatch) {
        data.price = priceMatch[0];
      }
      break;
    }
  }

  // Try to find product image
  const imageSelectors = [
    'img[data-testid="product-image"]',
    '.product-image img',
    '#product-image',
    'img[alt*="product"]',
    'img[src*="product"]'
  ];

  for (const selector of imageSelectors) {
    const element = document.querySelector(selector);
    if (element && element.src) {
      data.image = element.src;
      break;
    }
  }

  // Try to find description
  const descSelectors = [
    '[data-testid="product-description"]',
    '.product-description',
    '#productDescription',
    '[class*="description"]'
  ];

  for (const selector of descSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      data.description = element.textContent.trim().substring(0, 500);
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

