// Popup JavaScript for Market Shopper Extension

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initializePopup();
});

// Initialize all popup functionality
function initializePopup() {
  setupScreenshotCapture();
  setupImageUpload();
  setupQuickSearch();
  setupSidePanelButton();
  loadRecentSearches();
  loadStatusCounts();
}

// Setup screenshot capture button
function setupScreenshotCapture() {
  const captureBtn = document.getElementById('captureBtn');
  if (captureBtn) {
    captureBtn.addEventListener('click', async () => {
      try {
        captureBtn.disabled = true;
        captureBtn.textContent = 'Capturing...';
        
        // Get current active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Request screenshot from background script
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
              // Open side panel with screenshot data
              openSidePanelWithImage(response.imageData);
              resetButton(captureBtn, 'Capture Screenshot');
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
}

// Setup image upload button
function setupImageUpload() {
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
          openSidePanelWithImage(imageData);
        };
        reader.readAsDataURL(file);
      } else {
        showError('Please select a valid image file');
      }
      // Reset file input
      fileInput.value = '';
    });
  }
}

// Setup quick search input
function setupQuickSearch() {
  const searchInput = document.getElementById('quickSearch');
  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const query = searchInput.value.trim();
        if (query) {
          openSidePanelWithSearch(query);
          searchInput.value = '';
        }
      }
    });
  }
}

// Setup side panel button
function setupSidePanelButton() {
  const sidePanelBtn = document.getElementById('openSidePanelBtn');
  if (sidePanelBtn) {
    sidePanelBtn.addEventListener('click', async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.sidePanel.open({ tabId: tab.id });
        window.close(); // Close popup after opening side panel
      } catch (error) {
        console.error('Error opening side panel:', error);
        showError('Failed to open side panel');
      }
    });
  }
}

// Load recent searches from storage
function loadRecentSearches() {
  chrome.storage.local.get(['searchHistory'], (result) => {
    const history = result.searchHistory || [];
    const recentList = document.getElementById('recentSearches');
    
    if (!recentList) return;
    
    if (history.length === 0) {
      recentList.innerHTML = '<div class="empty-state">No recent searches</div>';
      return;
    }
    
    // Show last 5 searches
    const recent = history.slice(0, 5);
    recentList.innerHTML = recent.map((item, index) => {
      const productName = item.product || 'Unknown Product';
      const price = item.price ? `$${item.price}` : 'Price N/A';
      const date = new Date(item.timestamp);
      const timeAgo = getTimeAgo(date);
      
      return `
        <div class="recent-item" data-index="${index}">
          <div class="recent-item-info">
            <div class="recent-item-name">${escapeHtml(productName)}</div>
            <div class="recent-item-price">${price} • ${timeAgo}</div>
          </div>
        </div>
      `;
    }).join('');
    
    // Add click handlers to recent items
    recentList.querySelectorAll('.recent-item').forEach((item, index) => {
      item.addEventListener('click', () => {
        const searchItem = recent[index];
        if (searchItem.product) {
          openSidePanelWithSearch(searchItem.product);
        }
      });
    });
  });
}

// Load status counts (tracked products, deals)
function loadStatusCounts() {
  chrome.storage.local.get(['trackedProducts', 'searchHistory'], (result) => {
    const tracked = result.trackedProducts || [];
    const history = result.searchHistory || [];
    
    // Count active tracked products
    const trackedCount = tracked.length;
    const trackedCountEl = document.getElementById('trackedCount');
    if (trackedCountEl) {
      trackedCountEl.textContent = trackedCount;
    }
    
    // Count recent deals (searches with price drops - simplified)
    const dealsCount = history.filter(item => item.results && item.results.length > 0).length;
    const dealsCountEl = document.getElementById('dealsCount');
    if (dealsCountEl) {
      dealsCountEl.textContent = dealsCount > 0 ? dealsCount : '0';
    }
  });
}

// Open side panel with image data
async function openSidePanelWithImage(imageData) {
  try {
    // Save image to storage temporarily
    await chrome.storage.local.set({ 
      pendingImage: imageData,
      pendingAction: 'processImage'
    });
    
    // Get current tab and open side panel
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.sidePanel.open({ tabId: tab.id });
    
    // Close popup
    window.close();
  } catch (error) {
    console.error('Error opening side panel:', error);
    showError('Failed to open side panel');
  }
}

// Open side panel with search query
async function openSidePanelWithSearch(query) {
  try {
    // Save search query to storage
    await chrome.storage.local.set({ 
      pendingSearch: query,
      pendingAction: 'search'
    });
    
    // Get current tab and open side panel
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.sidePanel.open({ tabId: tab.id });
    
    // Close popup
    window.close();
  } catch (error) {
    console.error('Error opening side panel:', error);
    showError('Failed to open side panel');
  }
}

// Helper function to reset button state
function resetButton(button, originalText) {
  button.disabled = false;
  const icon = button.querySelector('.btn-icon');
  const span = button.querySelector('span');
  if (span) {
    span.textContent = originalText;
  } else {
    button.textContent = originalText;
  }
}

// Helper function to show error message
function showError(message) {
  // Simple error notification (can be enhanced with a toast)
  console.error(message);
  // You could add a toast notification here
}

// Helper function to get time ago string
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// Helper function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

