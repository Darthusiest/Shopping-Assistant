// Price Tracker JavaScript for Market Shopper Extension

// Global state
let trackedProducts = [];
let currentFilter = 'all';
let currentView = 'grid';
let searchQuery = '';

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initializePriceTracker();
});

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
      productsContainer.className = 'products-container list-view';
      renderProducts();
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
    trackedProducts = result.trackedProducts || [];
    productsCache = trackedProducts;
    lastLoadTime = Date.now();
    
    requestAnimationFrame(() => {
      updateStats();
      renderProducts();
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
    tempDiv.className = `products-container ${viewClass}`;
    
    // Build HTML string efficiently
    tempDiv.innerHTML = filtered.map(product => createProductCard(product)).join('');
    
    // Move nodes to fragment
    while (tempDiv.firstChild) {
      fragment.appendChild(tempDiv.firstChild);
    }

    // Clear and append in one operation
    container.innerHTML = '';
    container.className = `products-container ${viewClass}`;
    container.appendChild(fragment);
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

  if (e.target.closest('.product-actions')) {
    const deleteBtn = e.target.closest('.action-btn.delete');
    if (deleteBtn) {
      e.stopPropagation();
      const productId = card.dataset.id;
      deleteProduct(productId);
    }
    // Handle edit button if needed
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

  const cardClass = hasPriceDrop ? 'product-card price-dropped' : 
                   hasAlert ? 'product-card alert-active' : 
                   'product-card';

  return `
    <div class="${cardClass}" data-id="${product.id}">
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
      </div>
      <div class="product-actions">
        <button class="action-btn">Edit</button>
        <button class="action-btn delete">Delete</button>
      </div>
    </div>
  `;
}

// Open add product modal
function openAddProductModal() {
  const modal = document.getElementById('addProductModal');
  if (modal) {
    modal.classList.remove('hidden');
  }
}

// Close add product modal
function closeAddProductModal() {
  const modal = document.getElementById('addProductModal');
  if (modal) {
    modal.classList.add('hidden');
    // Reset form
    const form = document.getElementById('addProductForm');
    if (form) form.reset();
  }
}

// Handle add product form submission with optimistic UI update
function handleAddProduct(e) {
  e.preventDefault();

  const name = document.getElementById('productName').value.trim();
  const url = document.getElementById('productUrl').value.trim();
  const currentPrice = parseFloat(document.getElementById('currentPrice').value);
  const targetPrice = document.getElementById('targetPrice').value ? 
    parseFloat(document.getElementById('targetPrice').value) : null;
  const image = document.getElementById('productImage').value.trim();
  const notes = document.getElementById('productNotes').value.trim();

  if (!name || isNaN(currentPrice)) {
    alert('Please fill in all required fields (Product Name and Current Price)');
    return;
  }

  const newProduct = {
    id: Date.now(),
    name: name,
    url: url || null,
    currentPrice: currentPrice,
    targetPrice: targetPrice,
    image: image || null,
    notes: notes || null,
    addedDate: Date.now(),
    priceHistory: [{
      price: currentPrice,
      date: Date.now()
    }]
  };

  // Optimistic UI update - add immediately
  trackedProducts.push(newProduct);
  
  // Close modal immediately for better UX
  closeAddProductModal();
  
  // Update UI optimistically
  requestAnimationFrame(() => {
    updateStats();
    renderProducts();
  });

  // Save to storage asynchronously (non-blocking)
  saveTrackedProducts();
}

// Delete product
function deleteProduct(productId) {
  if (confirm('Are you sure you want to delete this product from tracking?')) {
    trackedProducts = trackedProducts.filter(p => p.id !== parseInt(productId));
    saveTrackedProducts();
    loadTrackedProducts();
  }
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

