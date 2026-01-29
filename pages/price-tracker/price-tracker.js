// Price Tracker JavaScript for Market Shopper Extension

// Global state
let trackedProducts = [];
let currentFilter = 'all';
let currentView = 'grid';
let searchQuery = '';

// Bulk selection state (delete multiple)
let selectionMode = false;
let selectedProductIds = new Set();

// Fetched product image URL from "Fetch from URL" (Option 2/3 scrape)
let fetchedProductImageUrl = null;

// When set, the add-product modal is in edit mode for this product id
let editingProductId = null;

// Live price tracking backend (Option 2). Change for production.
const LIVE_TRACKING_BACKEND_URL = 'http://localhost:3000';

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initializePriceTracker();
});

// --- Live tracking API (Option 2 backend)
function getDeviceId() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['liveTrackingDeviceId'], (result) => {
      let id = result.liveTrackingDeviceId;
      if (!id) {
        id = 'dev-' + Date.now() + '-' + Math.random().toString(36).slice(2, 11);
        chrome.storage.local.set({ liveTrackingDeviceId: id });
      }
      resolve(id);
    });
  });
}

function syncTrackProduct(product) {
  if (!product || !product.url) return Promise.resolve();
  return getDeviceId().then((deviceId) => {
    return fetch(`${LIVE_TRACKING_BACKEND_URL}/api/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        productId: String(product.id),
        url: product.url,
        name: product.name,
        currentPrice: product.currentPrice != null ? parseFloat(product.currentPrice) : null,
      }),
    }).catch(() => {});
  });
}

function untrackProduct(product) {
  if (!product) return Promise.resolve();
  return getDeviceId().then((deviceId) => {
    return fetch(`${LIVE_TRACKING_BACKEND_URL}/api/untrack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, productId: String(product.id) }),
    }).catch(() => {});
  });
}

function fetchPricesFromBackend() {
  return getDeviceId()
    .then((deviceId) => fetch(`${LIVE_TRACKING_BACKEND_URL}/api/prices?deviceId=${encodeURIComponent(deviceId)}`))
    .then((res) => (res && res.ok ? res.json() : null))
    .catch(() => null)
    .then((data) => {
      if (!data || !Array.isArray(data.products)) return;
      const byId = {};
      data.products.forEach((p) => { byId[p.productId] = p; });
      let changed = false;
      trackedProducts.forEach((product) => {
        const remote = byId[String(product.id)];
        if (!remote) return;
        const newPrice = remote.currentPrice != null ? parseFloat(remote.currentPrice) : null;
        if (newPrice == null || Number.isNaN(newPrice)) return;
        const prev = parseFloat(product.currentPrice);
        if (prev !== newPrice || (remote.priceHistory && remote.priceHistory.length !== (product.priceHistory || []).length)) {
          product.currentPrice = newPrice;
          product.priceHistory = Array.isArray(remote.priceHistory) ? remote.priceHistory : product.priceHistory || [];
          changed = true;
        }
      });
      if (changed) {
        productsCache = trackedProducts;
        saveTrackedProducts();
        requestAnimationFrame(() => { updateStats(); renderProducts(); });
      }
    });
}

// Initialize all price tracker functionality
function initializePriceTracker() {
  setupEventListeners();
  setupProductCardDelegation();
  loadTrackedProducts();
  
  // Handle empty state add button clicks via delegation
  document.addEventListener('click', (e) => {
    if (e.target.closest('.empty-state-add-btn')) {
      openAddProductModal();
    }
  });
}

function getFilteredProducts() {
  // Filter products
  let filtered = [...trackedProducts];

  // Apply search filter
  if (searchQuery) {
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(searchQuery) ||
      (p.url && p.url.toLowerCase().includes(searchQuery))
    );
  }

  // Apply status filter
  if (currentFilter === 'active') {
    filtered = filtered.filter(p => {
      const priceHistory = p.priceHistory || [];
      return priceHistory.length > 0;
    });
  } else if (currentFilter === 'alert') {
    filtered = filtered.filter(p => {
      if (!p.targetPrice) return false;
      const currentPrice = parseFloat(p.currentPrice);
      const targetPrice = parseFloat(p.targetPrice);
      return currentPrice > targetPrice;
    });
  } else if (currentFilter === 'dropped') {
    filtered = filtered.filter(p => {
      const priceHistory = p.priceHistory || [];
      if (priceHistory.length < 2) return false;
      const latest = priceHistory[priceHistory.length - 1];
      const previous = priceHistory[priceHistory.length - 2];
      return latest.price < previous.price;
    });
  }

  return filtered;
}

function setSelectionMode(enabled) {
  selectionMode = enabled;

  if (!selectionMode) {
    selectedProductIds = new Set();
  }

  updateBulkActionsUI();
  renderProducts();
}

function updateBulkActionsUI() {
  const selectModeBtn = document.getElementById('selectModeBtn');
  const selectAllBtn = document.getElementById('selectAllBtn');
  const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
  const cancelSelectionBtn = document.getElementById('cancelSelectionBtn');

  const selectedCount = selectedProductIds.size;

  if (deleteSelectedBtn) {
    deleteSelectedBtn.disabled = selectedCount === 0;
    deleteSelectedBtn.textContent = `Delete (${selectedCount})`;
  }

  if (selectionMode) {
    if (selectModeBtn) selectModeBtn.classList.add('hidden');
    if (selectAllBtn) selectAllBtn.classList.remove('hidden');
    if (deleteSelectedBtn) deleteSelectedBtn.classList.remove('hidden');
    if (cancelSelectionBtn) cancelSelectionBtn.classList.remove('hidden');

    // Toggle Select All label based on visible selection
    if (selectAllBtn) {
      const visible = getFilteredProducts();
      const allVisibleSelected = visible.length > 0 && visible.every(p => selectedProductIds.has(Number(p.id)));
      selectAllBtn.textContent = allVisibleSelected ? 'Unselect All' : 'Select All';
    }
  } else {
    if (selectModeBtn) selectModeBtn.classList.remove('hidden');
    if (selectAllBtn) selectAllBtn.classList.add('hidden');
    if (deleteSelectedBtn) deleteSelectedBtn.classList.add('hidden');
    if (cancelSelectionBtn) cancelSelectionBtn.classList.add('hidden');
  }
}

function toggleProductSelected(productId, forceSelected = null) {
  const id = Number(productId);
  const currentlySelected = selectedProductIds.has(id);
  const nextSelected = forceSelected === null ? !currentlySelected : Boolean(forceSelected);

  if (nextSelected) selectedProductIds.add(id);
  else selectedProductIds.delete(id);

  updateBulkActionsUI();
}

function selectAllVisibleProducts() {
  const visible = getFilteredProducts();
  if (visible.length === 0) return;

  const allVisibleSelected = visible.every(p => selectedProductIds.has(Number(p.id)));
  if (allVisibleSelected) {
    // Unselect visible
    visible.forEach(p => selectedProductIds.delete(Number(p.id)));
  } else {
    // Select visible
    visible.forEach(p => selectedProductIds.add(Number(p.id)));
  }

  updateBulkActionsUI();
  renderProducts();
}

function deleteSelectedProducts() {
  const idsToDelete = Array.from(selectedProductIds);
  if (idsToDelete.length === 0) return;

  if (!confirm(`Delete ${idsToDelete.length} selected product${idsToDelete.length === 1 ? '' : 's'}?`)) {
    return;
  }

  trackedProducts = trackedProducts.filter(p => !selectedProductIds.has(Number(p.id)));

  // Keep cache coherent
  productsCache = trackedProducts;
  lastLoadTime = Date.now();

  saveTrackedProducts();
  setSelectionMode(false);

  requestAnimationFrame(() => {
    updateStats();
    renderProducts();
  });
}

// Setup event listeners
function setupEventListeners() {
  // Add Product Button
  const addProductBtn = document.getElementById('addProductBtn');
  const emptyStateAddBtn = document.getElementById('emptyStateAddBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const closeDetailModalBtn = document.getElementById('closeDetailModalBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const addProductModal = document.getElementById('addProductModal');
  const productDetailModal = document.getElementById('productDetailModal');

  if (addProductBtn) {
    addProductBtn.addEventListener('click', () => openAddProductModal());
  }

  if (emptyStateAddBtn) {
    emptyStateAddBtn.addEventListener('click', () => openAddProductModal());
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => closeAddProductModal());
  }

  if (closeDetailModalBtn) {
    closeDetailModalBtn.addEventListener('click', () => closeProductDetailModal());
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => closeAddProductModal());
  }

  // Close modal on overlay click
  if (addProductModal) {
    addProductModal.addEventListener('click', (e) => {
      if (e.target === addProductModal) {
        closeAddProductModal();
      }
    });
  }

  if (productDetailModal) {
    productDetailModal.addEventListener('click', (e) => {
      if (e.target === productDetailModal) {
        closeProductDetailModal();
      }
    });
  }

  // Add Product Form
  const addProductForm = document.getElementById('addProductForm');
  if (addProductForm) {
    addProductForm.addEventListener('submit', handleAddProduct);
  }

  // Thumbnail file input: show preview when user selects an image
  const productImageFile = document.getElementById('productImageFile');
  const thumbnailPreview = document.getElementById('thumbnailPreview');
  if (productImageFile && thumbnailPreview) {
    productImageFile.addEventListener('change', () => {
      fetchedProductImageUrl = null; // Clear fetched URL when user picks a file
      const file = productImageFile.files[0];
      thumbnailPreview.innerHTML = '';
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = document.createElement('img');
          img.src = e.target.result;
          img.alt = 'Thumbnail preview';
          thumbnailPreview.appendChild(img);
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Fetch from URL: scrape product (Option 2 then Option 3 fallback). Result comes via a second message to avoid "message port closed".
  const fetchProductUrlInput = document.getElementById('fetchProductUrl');
  const fetchProductUrlBtn = document.getElementById('fetchProductUrlBtn');
  const fetchProductStatus = document.getElementById('fetchProductStatus');
  if (fetchProductUrlBtn && fetchProductUrlInput) {
    fetchProductUrlBtn.addEventListener('click', () => {
      const url = fetchProductUrlInput.value.trim();
      if (!url || !url.startsWith('http')) {
        if (fetchProductStatus) {
          fetchProductStatus.textContent = 'Please enter a valid product URL.';
          fetchProductStatus.className = 'fetch-status error';
        }
        return;
      }
      const requestId = Date.now();
      if (fetchProductStatus) {
        fetchProductStatus.textContent = 'Fetching… (a tab may open briefly if needed)';
        fetchProductStatus.className = 'fetch-status loading';
      }
      const SCRAPE_RESULT_TIMEOUT_MS = 25000;
      const timeoutId = setTimeout(() => {
        chrome.runtime.onMessage.removeListener(onResult);
        if (fetchProductStatus && fetchProductStatus.textContent.indexOf('Product details filled') === -1) {
          fetchProductStatus.textContent = 'Request timed out. This site may block automated requests—try opening the product page in a tab, then Fetch again.';
          fetchProductStatus.className = 'fetch-status error';
        }
      }, SCRAPE_RESULT_TIMEOUT_MS);
      const onResult = (message) => {
        if (message.action !== 'scrapeProductFromUrlResult' || message.requestId !== requestId) return;
        clearTimeout(timeoutId);
        chrome.runtime.onMessage.removeListener(onResult);
        const response = { success: message.success, data: message.data };
        if (!response.success || !response.data) {
          if (fetchProductStatus) {
            fetchProductStatus.textContent = 'Could not get product details from this URL. Try opening the page in a tab first, then use Fetch again.';
            fetchProductStatus.className = 'fetch-status error';
          }
          return;
        }
        const d = response.data;
        const productNameEl = document.getElementById('productName');
        const productUrlEl = document.getElementById('productUrl');
        const currentPriceEl = document.getElementById('currentPrice');
        if (productNameEl) productNameEl.value = d.name || '';
        if (productUrlEl) productUrlEl.value = d.url || url;
        if (currentPriceEl && d.price) currentPriceEl.value = String(d.price).replace(/,/g, '');
        fetchedProductImageUrl = d.image || null;
        const thumb = document.getElementById('thumbnailPreview');
        if (thumb) {
          thumb.innerHTML = '';
          if (fetchedProductImageUrl) {
            const img = document.createElement('img');
            img.src = fetchedProductImageUrl;
            img.alt = 'Fetched thumbnail';
            thumb.appendChild(img);
          }
        }
        if (fetchProductStatus) {
          fetchProductStatus.textContent = 'Product details filled. You can edit and add to tracker.';
          fetchProductStatus.className = 'fetch-status';
        }
      };
      chrome.runtime.onMessage.addListener(onResult);
      chrome.runtime.sendMessage({ action: 'scrapeProductFromUrl', url, requestId }, (response) => {
        if (chrome.runtime.lastError) {
          chrome.runtime.onMessage.removeListener(onResult);
          if (fetchProductStatus) {
            fetchProductStatus.textContent = 'Error: ' + chrome.runtime.lastError.message;
            fetchProductStatus.className = 'fetch-status error';
          }
          return;
        }
        // Background replies immediately with { pending: true, requestId }; result will arrive via onResult
        if (!response || !response.pending) {
          chrome.runtime.onMessage.removeListener(onResult);
          if (response && response.success && response.data) {
            onResult({ action: 'scrapeProductFromUrlResult', requestId: response.requestId, success: response.success, data: response.data });
          } else if (fetchProductStatus) {
            fetchProductStatus.textContent = 'Could not get product details from this URL.';
            fetchProductStatus.className = 'fetch-status error';
          }
        }
      });
    });
  }

  // Search Input with debouncing
  const searchInput = document.getElementById('searchInput');
  let searchTimeout;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase();
      // Debounce search - wait 300ms before rendering
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        requestAnimationFrame(() => {
          renderProducts();
        });
      }, 300);
    }, { passive: true });
  }

  // Filter Buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentFilter = e.target.dataset.filter;
      renderProducts();
    });
  });

  // View Toggle Buttons
  const gridViewBtn = document.getElementById('gridViewBtn');
  const listViewBtn = document.getElementById('listViewBtn');
  const productsContainer = document.getElementById('productsContainer');

  if (gridViewBtn) {
    gridViewBtn.addEventListener('click', () => {
      currentView = 'grid';
      gridViewBtn.classList.add('active');
      listViewBtn.classList.remove('active');
      productsContainer.className = 'products-container grid-view';
      renderProducts();
    });
  }

  if (listViewBtn) {
    listViewBtn.addEventListener('click', () => {
      currentView = 'list';
      listViewBtn.classList.add('active');
      gridViewBtn.classList.remove('active');
      productsContainer.className = `products-container list-view${selectionMode ? ' selection-mode' : ''}`;
      renderProducts();
    });
  }

  // Bulk selection controls
  const selectModeBtn = document.getElementById('selectModeBtn');
  const selectAllBtn = document.getElementById('selectAllBtn');
  const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
  const cancelSelectionBtn = document.getElementById('cancelSelectionBtn');

  if (selectModeBtn) {
    selectModeBtn.addEventListener('click', () => {
      setSelectionMode(true);
    });
  }

  if (cancelSelectionBtn) {
    cancelSelectionBtn.addEventListener('click', () => {
      setSelectionMode(false);
    });
  }

  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', () => {
      if (!selectionMode) setSelectionMode(true);
      selectAllVisibleProducts();
    });
  }

  if (deleteSelectedBtn) {
    deleteSelectedBtn.addEventListener('click', () => {
      deleteSelectedProducts();
    });
  }

  // Checkbox selection handler (delegated)
  if (productsContainer) {
    productsContainer.addEventListener('change', (e) => {
      const checkbox = e.target.closest('.product-select-checkbox');
      if (!checkbox) return;
      const card = checkbox.closest('.product-card');
      if (!card) return;

      const id = Number(card.dataset.id);
      toggleProductSelected(id, checkbox.checked);

      if (checkbox.checked) card.classList.add('selected');
      else card.classList.remove('selected');
    });
  }
}

// Load tracked products from storage with caching
let productsCache = null;
let lastLoadTime = 0;
const CACHE_DURATION = 1000; // Cache for 1 second

function loadTrackedProducts(force = false) {
  const now = Date.now();
  
  // Return cached data if available and recent
  if (!force && productsCache && (now - lastLoadTime) < CACHE_DURATION) {
    trackedProducts = productsCache;
    requestAnimationFrame(() => {
      updateStats();
      renderProducts();
    });
    return;
  }

  chrome.storage.local.get(['trackedProducts'], (result) => {
    trackedProducts = (result.trackedProducts || []).map((p) => ({
      ...p,
      trackLive: p.trackLive === true,
    }));
    productsCache = trackedProducts;
    lastLoadTime = Date.now();

    requestAnimationFrame(() => {
      updateStats();
      renderProducts();
      fetchPricesFromBackend();
    });
  });
}

// Update statistics
function updateStats() {
  const totalTracked = trackedProducts.length;
  const priceDrops = trackedProducts.filter(p => {
    const priceHistory = p.priceHistory || [];
    if (priceHistory.length < 2) return false;
    const latest = priceHistory[priceHistory.length - 1];
    const previous = priceHistory[priceHistory.length - 2];
    return latest.price < previous.price;
  }).length;

  const activeAlerts = trackedProducts.filter(p => {
    if (!p.targetPrice) return false;
    const currentPrice = parseFloat(p.currentPrice);
    const targetPrice = parseFloat(p.targetPrice);
    return currentPrice > targetPrice;
  }).length;

  const totalSavings = trackedProducts.reduce((sum, p) => {
    const priceHistory = p.priceHistory || [];
    if (priceHistory.length < 2) return sum;
    const original = priceHistory[0].price;
    const latest = priceHistory[priceHistory.length - 1].price;
    if (latest < original) {
      return sum + (original - latest);
    }
    return sum;
  }, 0);

  const avgSavings = trackedProducts.length > 0 ? totalSavings / trackedProducts.length : 0;

  // Update DOM
  const totalTrackedEl = document.getElementById('totalTracked');
  const priceDropsEl = document.getElementById('priceDrops');
  const activeAlertsEl = document.getElementById('activeAlerts');
  const avgSavingsEl = document.getElementById('avgSavings');

  if (totalTrackedEl) totalTrackedEl.textContent = totalTracked;
  if (priceDropsEl) priceDropsEl.textContent = priceDrops;
  if (activeAlertsEl) activeAlertsEl.textContent = activeAlerts;
  if (avgSavingsEl) avgSavingsEl.textContent = `$${avgSavings.toFixed(2)}`;
}

// Render products with performance optimizations
function renderProducts() {
  const container = document.getElementById('productsContainer');
  if (!container) return;

  const filtered = getFilteredProducts();

  // Use requestAnimationFrame for smooth rendering
  requestAnimationFrame(() => {
    // Render empty state or products
    if (filtered.length === 0) {
      if (trackedProducts.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">📊</div>
            <h3>No products tracked yet</h3>
            <p>Start tracking products to monitor their prices and get alerts when prices drop.</p>
            <button class="primary-btn empty-state-add-btn">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <line x1="8" y1="2" x2="8" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
              <span>Add Your First Product</span>
            </button>
          </div>
        `;
      } else {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🔍</div>
            <h3>No products found</h3>
            <p>Try adjusting your search or filter criteria.</p>
          </div>
        `;
      }
      return;
    }

    // Use document fragment for batch DOM operations
    const fragment = document.createDocumentFragment();
    const tempDiv = document.createElement('div');
    const viewClass = currentView === 'grid' ? 'grid-view' : 'list-view';
    tempDiv.className = `products-container ${viewClass}${selectionMode ? ' selection-mode' : ''}`;
    
    // Build HTML string efficiently
    tempDiv.innerHTML = filtered.map(product => createProductCard(product)).join('');
    
    // Move nodes to fragment
    while (tempDiv.firstChild) {
      fragment.appendChild(tempDiv.firstChild);
    }

    // Clear and append in one operation
    container.innerHTML = '';
    container.className = `products-container ${viewClass}${selectionMode ? ' selection-mode' : ''}`;
    container.appendChild(fragment);

    updateBulkActionsUI();
  });
}

// Set up event delegation once at initialization (singleton pattern)
let delegationSetup = false;

function setupProductCardDelegation() {
  if (delegationSetup) return; // Already set up
  
  const container = document.getElementById('productsContainer');
  if (container) {
    container.addEventListener('click', handleProductCardClick, true);
    delegationSetup = true;
  }
}

// Event delegation for product cards (better performance)
function handleProductCardClick(e) {
  const card = e.target.closest('.product-card');
  if (!card) return;

  // In selection mode: click anywhere on card toggles selection (except the checkbox itself)
  if (selectionMode) {
    // Let checkbox change handler handle checkbox interactions
    if (e.target.closest('.product-select')) {
      e.stopPropagation();
      return;
    }

    e.stopPropagation();
    const productId = Number(card.dataset.id);
    toggleProductSelected(productId);

    const checkbox = card.querySelector('.product-select-checkbox');
    const isSelected = selectedProductIds.has(productId);
    if (checkbox) checkbox.checked = isSelected;
    card.classList.toggle('selected', isSelected);
    return;
  }

  const trackLiveCheckbox = e.target.closest('.track-live-checkbox');
  if (trackLiveCheckbox) {
    e.stopPropagation();
    const productId = trackLiveCheckbox.dataset.id;
    const product = trackedProducts.find((p) => p.id === parseInt(productId, 10));
    if (!product) return;
    product.trackLive = !!trackLiveCheckbox.checked;
    saveTrackedProducts();
    if (product.trackLive && product.url) {
      syncTrackProduct(product);
    } else {
      untrackProduct(product);
    }
    requestAnimationFrame(() => renderProducts());
    return;
  }

  if (e.target.closest('.product-actions')) {
    e.stopPropagation();
    const deleteBtn = e.target.closest('.action-btn.delete');
    if (deleteBtn) {
      const productId = card.dataset.id;
      deleteProduct(productId);
    } else {
      const editBtn = e.target.closest('.action-btn');
      if (editBtn) {
        const productId = card.dataset.id;
        openEditProductModal(productId);
      }
    }
  } else {
    const productId = card.dataset.id;
    showProductDetail(productId);
  }
}

// Create product card HTML
function createProductCard(product) {
  const priceHistory = product.priceHistory || [];
  const hasPriceDrop = priceHistory.length >= 2 && 
    priceHistory[priceHistory.length - 1].price < priceHistory[priceHistory.length - 2].price;
  
  const currentPrice = parseFloat(product.currentPrice || 0);
  const targetPrice = product.targetPrice ? parseFloat(product.targetPrice) : null;
  const hasAlert = targetPrice && currentPrice > targetPrice;

  // Calculate price change
  let priceChange = null;
  if (priceHistory.length >= 2) {
    const latest = priceHistory[priceHistory.length - 1].price;
    const previous = priceHistory[priceHistory.length - 2].price;
    const change = latest - previous;
    priceChange = {
      value: Math.abs(change),
      isPositive: change < 0,
      percentage: ((change / previous) * 100).toFixed(1)
    };
  }

  const isSelected = selectionMode && selectedProductIds.has(Number(product.id));
  const cardClass = hasPriceDrop ? 'product-card price-dropped' :
                   hasAlert ? 'product-card alert-active' :
                   'product-card';
  const selectedClass = isSelected ? ' selected' : '';

  return `
    <div class="${cardClass}${selectedClass}" data-id="${product.id}">
      <div class="product-select">
        <input class="product-select-checkbox" type="checkbox" ${isSelected ? 'checked' : ''} aria-label="Select product">
      </div>
      <div class="product-image-container">
        ${product.image ? 
          `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" class="product-image" onerror="this.parentElement.innerHTML='<svg class=\\'product-image-placeholder\\' width=\\'80\\' height=\\'80\\' viewBox=\\'0 0 16 16\\' fill=\\'none\\' xmlns=\\'http://www.w3.org/2000/svg\\'><rect x=\\'2\\' y=\\'3\\' width=\\'12\\' height=\\'10\\' rx=\\'1\\' stroke=\\'currentColor\\' stroke-width=\\'1.5\\' fill=\\'none\\'/></svg>'">` :
          `<svg class="product-image-placeholder" width="80" height="80" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/>
          </svg>`
        }
      </div>
      <div class="product-info">
        <div class="product-name">${escapeHtml(product.name)}</div>
        <div class="product-price-section">
          <span class="current-price">$${currentPrice.toFixed(2)}</span>
          ${priceChange ? `
            <span class="price-change ${priceChange.isPositive ? 'positive' : 'negative'}">
              ${priceChange.isPositive ? '↓' : '↑'} $${priceChange.value.toFixed(2)} (${priceChange.percentage}%)
            </span>
          ` : ''}
        </div>
        ${targetPrice ? `
          <div class="target-price-info">
            <span>Target: $${targetPrice.toFixed(2)}</span>
            ${hasAlert ? '<span style="color: #f59e0b;">⚠️ Alert Active</span>' : ''}
          </div>
        ` : ''}
        <div class="product-meta">
          <span>Tracked ${getTimeAgo(new Date(product.addedDate || Date.now()))}</span>
          ${product.url ? `<a href="${escapeHtml(product.url)}" target="_blank" onclick="event.stopPropagation()" style="color: #8b5cf6;">View Product</a>` : ''}
        </div>
        <label class="track-live-toggle" onclick="event.stopPropagation()">
          <input type="checkbox" class="track-live-checkbox" data-id="${product.id}" ${product.trackLive ? 'checked' : ''} aria-label="Track price automatically">
          <span>Track live</span>
        </label>
      </div>
      <div class="product-actions">
        <button class="action-btn">Edit</button>
        <button class="action-btn delete">Delete</button>
      </div>
    </div>
  `;
}

// Open add product modal (add mode)
function openAddProductModal() {
  editingProductId = null;
  setAddProductModalMode('add');
  const trackLiveCheckbox = document.getElementById('productTrackLive');
  if (trackLiveCheckbox) trackLiveCheckbox.checked = false;
  const modal = document.getElementById('addProductModal');
  if (modal) {
    modal.classList.remove('hidden');
  }
}

// Open add product modal in edit mode with product data pre-filled
function openEditProductModal(productId) {
  const product = trackedProducts.find(p => p.id === parseInt(productId, 10));
  if (!product) return;
  editingProductId = product.id;
  setAddProductModalMode('edit');
  const productNameEl = document.getElementById('productName');
  const productUrlEl = document.getElementById('productUrl');
  const currentPriceEl = document.getElementById('currentPrice');
  const targetPriceEl = document.getElementById('targetPrice');
  const productNotesEl = document.getElementById('productNotes');
  const thumbnailPreview = document.getElementById('thumbnailPreview');
  const fetchProductUrl = document.getElementById('fetchProductUrl');
  const fetchProductStatus = document.getElementById('fetchProductStatus');
  if (productNameEl) productNameEl.value = product.name || '';
  if (productUrlEl) productUrlEl.value = product.url || '';
  if (currentPriceEl) currentPriceEl.value = product.currentPrice != null ? String(product.currentPrice) : '';
  if (targetPriceEl) targetPriceEl.value = product.targetPrice != null ? String(product.targetPrice) : '';
  if (productNotesEl) productNotesEl.value = product.notes || '';
  fetchedProductImageUrl = product.image || null;
  if (thumbnailPreview) {
    thumbnailPreview.innerHTML = '';
    if (product.image) {
      const img = document.createElement('img');
      img.src = product.image;
      img.alt = 'Product thumbnail';
      thumbnailPreview.appendChild(img);
    }
  }
  if (fetchProductUrl) fetchProductUrl.value = '';
  if (fetchProductStatus) {
    fetchProductStatus.textContent = '';
    fetchProductStatus.className = 'fetch-status';
  }
  const trackLiveCheckbox = document.getElementById('productTrackLive');
  if (trackLiveCheckbox) trackLiveCheckbox.checked = !!product.trackLive;
  const modal = document.getElementById('addProductModal');
  if (modal) modal.classList.remove('hidden');
}

function setAddProductModalMode(mode) {
  const titleEl = document.getElementById('addProductModalTitle');
  const submitBtn = document.getElementById('addProductSubmitBtn');
  if (titleEl) titleEl.textContent = mode === 'edit' ? 'Edit Product' : 'Add Product to Track';
  if (submitBtn) submitBtn.textContent = mode === 'edit' ? 'Save Changes' : 'Add Product';
}

// Close add product modal
function closeAddProductModal() {
  const modal = document.getElementById('addProductModal');
  if (modal) {
    modal.classList.add('hidden');
    editingProductId = null;
    setAddProductModalMode('add');
    // Reset form
    const form = document.getElementById('addProductForm');
    if (form) form.reset();
    // Clear file input and thumbnail preview
    const productImageFile = document.getElementById('productImageFile');
    const thumbnailPreview = document.getElementById('thumbnailPreview');
    if (productImageFile) productImageFile.value = '';
    if (thumbnailPreview) thumbnailPreview.innerHTML = '';
    fetchedProductImageUrl = null;
    const fetchProductStatus = document.getElementById('fetchProductStatus');
    if (fetchProductStatus) {
      fetchProductStatus.textContent = '';
      fetchProductStatus.className = 'fetch-status';
    }
  }
}

// Resize image for thumbnail (keeps storage small). Returns a Promise<string> (data URL).
function resizeImageForThumbnail(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      resolve(null);
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 400;
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w <= MAX && h <= MAX) {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
        return;
      }
      if (w > h) {
        h = Math.round((h * MAX) / w);
        w = MAX;
      } else {
        w = Math.round((w * MAX) / h);
        h = MAX;
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      try {
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

// Handle add product form submission (create or update)
function handleAddProduct(e) {
  e.preventDefault();

  const name = document.getElementById('productName').value.trim();
  const url = document.getElementById('productUrl').value.trim();
  const currentPrice = parseFloat(document.getElementById('currentPrice').value);
  const targetPrice = document.getElementById('targetPrice').value ?
    parseFloat(document.getElementById('targetPrice').value) : null;
  const imageFileInput = document.getElementById('productImageFile');
  const imageFile = imageFileInput && imageFileInput.files[0] ? imageFileInput.files[0] : null;
  const notes = document.getElementById('productNotes').value.trim();

  if (!name || isNaN(currentPrice)) {
    alert('Please fill in all required fields (Product Name and Current Price)');
    return;
  }

  const imageToUse = imageFile ? null : (fetchedProductImageUrl || null);

  function applyImageAndFinish(imageDataUrl) {
    const finalImage = imageDataUrl !== null ? imageDataUrl : imageToUse;

    if (editingProductId != null) {
      const product = trackedProducts.find(p => p.id === editingProductId);
      if (!product) {
        closeAddProductModal();
        return;
      }
      const trackLiveCheckbox = document.getElementById('productTrackLive');
      const trackLive = trackLiveCheckbox ? trackLiveCheckbox.checked : false;
      product.name = name;
      product.url = url || null;
      product.targetPrice = targetPrice;
      product.image = finalImage !== undefined && finalImage !== null ? finalImage : product.image;
      product.notes = notes || null;
      product.trackLive = !!trackLive;
      const prevPrice = parseFloat(product.currentPrice);
      if (currentPrice !== prevPrice) {
        product.currentPrice = currentPrice;
        if (!product.priceHistory) product.priceHistory = [];
        product.priceHistory.push({ price: currentPrice, date: Date.now() });
      }
      closeAddProductModal();
      requestAnimationFrame(() => {
        updateStats();
        renderProducts();
      });
      saveTrackedProducts();
      if (product.trackLive && product.url) syncTrackProduct(product);
      else untrackProduct(product);
      return;
    }

    const newProduct = {
      id: Date.now(),
      name: name,
      url: url || null,
      currentPrice: currentPrice,
      targetPrice: targetPrice,
      image: finalImage || null,
      notes: notes || null,
      addedDate: Date.now(),
      trackLive: false,
      priceHistory: [{
        price: currentPrice,
        date: Date.now()
      }]
    };
    trackedProducts.push(newProduct);
    closeAddProductModal();
    requestAnimationFrame(() => {
      updateStats();
      renderProducts();
    });
    saveTrackedProducts();
  }

  if (imageFile) {
    resizeImageForThumbnail(imageFile)
      .then((dataUrl) => applyImageAndFinish(dataUrl))
      .catch(() => {
        alert('Could not process the image. Try a different file.');
      });
  } else {
    applyImageAndFinish(null);
  }
}

// Delete product
function deleteProduct(productId) {
  if (!confirm('Are you sure you want to delete this product from tracking?')) return;
  const product = trackedProducts.find(p => p.id === parseInt(productId, 10));
  if (product && product.trackLive) untrackProduct(product);
  trackedProducts = trackedProducts.filter(p => p.id !== parseInt(productId, 10));
  selectedProductIds.delete(Number(productId));
  saveTrackedProducts();
  loadTrackedProducts();
}

// Show product detail modal
function showProductDetail(productId) {
  const product = trackedProducts.find(p => p.id === parseInt(productId));
  if (!product) return;

  const modal = document.getElementById('productDetailModal');
  const content = document.getElementById('productDetailContent');
  const title = document.getElementById('detailProductName');

  if (!modal || !content || !title) return;

  title.textContent = product.name;

  const priceHistory = product.priceHistory || [];
  const priceHistoryHtml = priceHistory.map((entry, index) => {
    const date = new Date(entry.date);
    const prevPrice = index > 0 ? priceHistory[index - 1].price : null;
    const change = prevPrice ? entry.price - prevPrice : 0;
    const changeClass = change < 0 ? 'positive' : change > 0 ? 'negative' : '';

    return `
      <div style="display: flex; justify-content: space-between; padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">
        <div>
          <div style="font-weight: 600;">$${entry.price.toFixed(2)}</div>
          <div style="font-size: 12px; color: #9ca3af;">${date.toLocaleDateString()}</div>
        </div>
        ${prevPrice ? `
          <div class="price-change ${changeClass}">
            ${change < 0 ? '↓' : '↑'} $${Math.abs(change).toFixed(2)}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  content.innerHTML = `
    <div style="margin-bottom: 24px;">
      ${product.image ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" style="width: 100%; max-height: 300px; object-fit: contain; border-radius: 12px; background: rgba(255,255,255,0.05); padding: 20px; margin-bottom: 20px;">` : ''}
      <div style="margin-bottom: 16px;">
        <div style="font-size: 32px; font-weight: 700; color: #8b5cf6; margin-bottom: 8px;">
          $${parseFloat(product.currentPrice).toFixed(2)}
        </div>
        ${product.targetPrice ? `
          <div style="color: #9ca3af; margin-bottom: 8px;">
            Target Price: $${parseFloat(product.targetPrice).toFixed(2)}
          </div>
        ` : ''}
        ${product.url ? `
          <a href="${escapeHtml(product.url)}" target="_blank" style="color: #8b5cf6; text-decoration: none;">
            View Product Page →
          </a>
        ` : ''}
      </div>
      ${product.notes ? `
        <div style="padding: 16px; background: rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 24px;">
          <div style="font-weight: 600; margin-bottom: 8px;">Notes</div>
          <div style="color: #d1d5db;">${escapeHtml(product.notes)}</div>
        </div>
      ` : ''}
      <div>
        <div style="font-weight: 600; margin-bottom: 16px;">Price History</div>
        <div style="background: rgba(255,255,255,0.05); border-radius: 8px; overflow: hidden;">
          ${priceHistoryHtml || '<div style="padding: 24px; text-align: center; color: #9ca3af;">No price history available</div>'}
        </div>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
}

// Close product detail modal
function closeProductDetailModal() {
  const modal = document.getElementById('productDetailModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

// Save tracked products to storage
function saveTrackedProducts() {
  chrome.storage.local.set({ trackedProducts: trackedProducts }, () => {
    if (chrome.runtime.lastError) {
      console.error('Error saving tracked products:', chrome.runtime.lastError);
    }
  });
}

// Helper function to get time ago
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return `${Math.floor(seconds / 604800)}w ago`;
}

// Helper function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

