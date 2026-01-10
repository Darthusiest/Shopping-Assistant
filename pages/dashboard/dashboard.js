// Dashboard JavaScript for Market Shopper Extension

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initializeDashboard();
});

// Initialize all dashboard functionality
function initializeDashboard() {
  loadStats();
  loadRecentActivity();
  loadTrackedProducts();
  setupQuickActions();
  checkPendingActions();
}

// Load and display statistics
function loadStats() {
  chrome.storage.local.get(['trackedProducts', 'searchHistory', 'wishlist', 'deals'], (result) => {
    // Tracked Products Count
    const tracked = result.trackedProducts || [];
    const trackedCountEl = document.getElementById('trackedCount');
    if (trackedCountEl) {
      trackedCountEl.textContent = tracked.length;
    }

    // Total Searches Count
    const history = result.searchHistory || [];
    const searchesCountEl = document.getElementById('searchesCount');
    if (searchesCountEl) {
      searchesCountEl.textContent = history.length;
    }

    // Wishlist Count
    const wishlist = result.wishlist || [];
    const wishlistCountEl = document.getElementById('wishlistCount');
    if (wishlistCountEl) {
      wishlistCountEl.textContent = wishlist.length;
    }

    // Deals Count
    const deals = result.deals || [];
    const dealsCount = deals.length || history.filter(item => item.hasDeals).length;
    const dealsCountEl = document.getElementById('dealsCount');
    if (dealsCountEl) {
      dealsCountEl.textContent = dealsCount;
    }
  });
}

// Load and display recent activity
function loadRecentActivity() {
  chrome.storage.local.get(['searchHistory'], (result) => {
    const history = result.searchHistory || [];
    const activityList = document.getElementById('recentActivity');
    
    if (!activityList) return;

    if (history.length === 0) {
      activityList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <p>No recent activity</p>
          <p class="empty-subtitle">Start by capturing a screenshot or searching for a product</p>
        </div>
      `;
      return;
    }

    // Show last 5 activities
    const recent = history.slice(0, 5);
    activityList.innerHTML = recent.map((item, index) => {
      const productName = item.product || 'Unknown Product';
      const price = item.price ? `$${item.price}` : 'Price N/A';
      const date = new Date(item.timestamp);
      const timeAgo = getTimeAgo(date);
      const icon = item.action === 'screenshot' ? '📸' : item.action === 'search' ? '🔍' : '📦';

      return `
        <div class="activity-item" data-index="${index}">
          <div class="activity-icon">${icon}</div>
          <div class="activity-info">
            <div class="activity-title">${escapeHtml(productName)}</div>
            <div class="activity-subtitle">${price} • ${timeAgo}</div>
          </div>
          <div class="activity-meta">View</div>
        </div>
      `;
    }).join('');

    // Add click handlers
    activityList.querySelectorAll('.activity-item').forEach((item, index) => {
      item.addEventListener('click', () => {
        const activity = recent[index];
        if (activity.product) {
          // Navigate to product details or search
          console.log('View activity:', activity);
        }
      });
    });
  });
}

// Load and display tracked products
function loadTrackedProducts() {
  chrome.storage.local.get(['trackedProducts'], (result) => {
    const tracked = result.trackedProducts || [];
    const trackedList = document.getElementById('trackedProducts');
    
    if (!trackedList) return;

    if (tracked.length === 0) {
      trackedList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📊</div>
          <p>No tracked products yet</p>
          <p class="empty-subtitle">Add products to track their prices</p>
        </div>
      `;
      return;
    }

    // Show last 5 tracked products
    const recent = tracked.slice(0, 5);
    trackedList.innerHTML = recent.map((item, index) => {
      const name = item.name || 'Unknown Product';
      const currentPrice = item.currentPrice ? `$${item.currentPrice}` : 'N/A';
      const targetPrice = item.targetPrice ? `Target: $${item.targetPrice}` : '';
      const status = getPriceStatus(item.currentPrice, item.targetPrice);
      const image = item.image || '';

      return `
        <div class="tracked-item" data-id="${item.id}">
          ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(name)}" class="tracked-image" onerror="this.style.display='none'">` : '<div class="tracked-image"></div>'}
          <div class="tracked-info">
            <div class="tracked-name">${escapeHtml(name)}</div>
            <div class="tracked-price">${currentPrice}</div>
            <div class="tracked-status">${targetPrice} • ${status}</div>
          </div>
        </div>
      `;
    }).join('');

    // Add click handlers
    trackedList.querySelectorAll('.tracked-item').forEach((item) => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        // Navigate to price tracker page
        console.log('View tracked product:', id);
      });
    });
  });
}

// Setup quick action buttons
function setupQuickActions() {
  // Capture Screenshot Button
  const captureBtn = document.getElementById('captureBtn');
  if (captureBtn) {
    captureBtn.addEventListener('click', async () => {
      try {
        captureBtn.disabled = true;
        captureBtn.querySelector('span').textContent = 'Capturing...';
        
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        chrome.runtime.sendMessage(
          { action: 'captureScreenshot' },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error('Error:', chrome.runtime.lastError);
              showError('Failed to capture screenshot');
              resetButton(captureBtn, 'Capture Screenshot');
              return;
            }
            
            if (response && response.success) {
              // Save to storage and reload
              saveActivity({
                action: 'screenshot',
                product: 'Screenshot captured',
                timestamp: Date.now(),
                imageData: response.imageData
              });
              resetButton(captureBtn, 'Capture Screenshot');
              loadRecentActivity();
              loadStats();
            } else {
              showError('Failed to capture screenshot');
              resetButton(captureBtn, 'Capture Screenshot');
            }
          }
        );
      } catch (error) {
        console.error('Screenshot error:', error);
        showError('Failed to capture screenshot');
        resetButton(captureBtn, 'Capture Screenshot');
      }
    });
  }

  // Upload Image Button
  const uploadBtn = document.getElementById('uploadBtn');
  const fileInput = document.getElementById('fileInput');
  
  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', () => {
      fileInput.click();
    });
    
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const imageData = event.target.result;
          saveActivity({
            action: 'upload',
            product: 'Image uploaded',
            timestamp: Date.now(),
            imageData: imageData
          });
          loadRecentActivity();
          loadStats();
        };
        reader.readAsDataURL(file);
      } else {
        showError('Please select a valid image file');
      }
      fileInput.value = '';
    });
  }

  // Quick Search Button
  const quickSearchBtn = document.getElementById('quickSearchBtn');
  if (quickSearchBtn) {
    quickSearchBtn.addEventListener('click', () => {
      // Open search interface or prompt
      const query = prompt('Enter product name to search:');
      if (query && query.trim()) {
        performSearch(query.trim());
      }
    });
  }

  // Price Alert Button
  const priceAlertBtn = document.getElementById('priceAlertBtn');
  if (priceAlertBtn) {
    priceAlertBtn.addEventListener('click', () => {
      // Navigate to price tracker page
      console.log('Navigate to price alerts');
      // This will be implemented when navigation is set up
    });
  }

  // View All Buttons
  const viewHistoryBtn = document.getElementById('viewHistoryBtn');
  if (viewHistoryBtn) {
    viewHistoryBtn.addEventListener('click', () => {
      // Navigate to history page
      console.log('Navigate to history');
    });
  }

  const viewTrackerBtn = document.getElementById('viewTrackerBtn');
  if (viewTrackerBtn) {
    viewTrackerBtn.addEventListener('click', () => {
      // Navigate to price tracker page
      console.log('Navigate to tracker');
    });
  }
}

// Check for pending actions (from popup)
function checkPendingActions() {
  chrome.storage.local.get(['pendingAction', 'pendingImage', 'pendingSearch'], (result) => {
    if (result.pendingAction === 'processImage' && result.pendingImage) {
      // Handle pending image
      saveActivity({
        action: 'screenshot',
        product: 'Screenshot processed',
        timestamp: Date.now(),
        imageData: result.pendingImage
      });
      
      // Clear pending action
      chrome.storage.local.remove(['pendingAction', 'pendingImage']);
      loadRecentActivity();
      loadStats();
    }

    if (result.pendingAction === 'search' && result.pendingSearch) {
      // Handle pending search
      performSearch(result.pendingSearch);
      
      // Clear pending action
      chrome.storage.local.remove(['pendingAction', 'pendingSearch']);
    }
  });
}

// Save activity to history
function saveActivity(activity) {
  chrome.storage.local.get(['searchHistory'], (result) => {
    const history = result.searchHistory || [];
    history.unshift(activity);
    const limitedHistory = history.slice(0, 50);
    chrome.storage.local.set({ searchHistory: limitedHistory });
  });
}

// Perform search
function performSearch(query) {
  saveActivity({
    action: 'search',
    product: query,
    timestamp: Date.now()
  });
  
  loadRecentActivity();
  loadStats();
  
  // TODO: Implement actual search functionality
  console.log('Searching for:', query);
}

// Helper function to get price status
function getPriceStatus(currentPrice, targetPrice) {
  if (!targetPrice || !currentPrice) return 'Tracking';
  
  const current = parseFloat(currentPrice);
  const target = parseFloat(targetPrice);
  
  if (current <= target) {
    return 'Target reached! 🎉';
  }
  
  const difference = current - target;
  return `$${difference.toFixed(2)} above target`;
}

// Helper function to get time ago string
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// Helper function to reset button
function resetButton(button, originalText) {
  button.disabled = false;
  const span = button.querySelector('span');
  if (span) {
    span.textContent = originalText;
  }
}

// Helper function to show error
function showError(message) {
  console.error(message);
  // TODO: Add toast notification UI
}

// Helper function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

