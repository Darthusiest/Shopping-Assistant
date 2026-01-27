// Page Router - Maps page names to their HTML files
const pageRoutes = {
    'dashboard': 'pages/dashboard/dashboard.html',
    'price-tracker': 'pages/price-tracker/price-tracker.html',
    'deals': 'pages/deals/deals.html',
    'wishlist': 'pages/wishlist/wishlist.html',
    'history': 'pages/history/history.html',
    'settings': 'pages/settings/settings.html',
    'shopping-lists': 'pages/shopping-lists/shopping-lists.html',
    'shopping-lists-all': 'pages/shopping-lists/shopping-lists.html',
    'shopping-lists-active': 'pages/shopping-lists/shopping-lists.html'
};

// Get page frame element
const pageFrame = document.getElementById('pageFrame');

// Page cache to avoid reloading
const pageCache = new Map();
let currentPageName = null;

// Function to load a page with loading state and caching
function loadPage(pageName) {
    // Don't reload if already on this page (unless it's a shopping list filter change)
    if (currentPageName === pageName && pageFrame && pageFrame.src && !pageName.startsWith('shopping-lists-')) {
        return;
    }

    const pagePath = pageRoutes[pageName];
    if (!pagePath || !pageFrame) {
        console.warn(`Page route not found for: ${pageName}`);
        if (pageName !== 'dashboard') {
            loadPage('dashboard');
        }
        return;
    }

    // Show loading indicator
    showLoadingIndicator();

    // Use chrome.runtime.getURL() for proper extension URL
    const fullUrl = chrome.runtime.getURL(pagePath);
    
    // Set src - this will trigger load
    pageFrame.src = fullUrl;
    currentPageName = pageName;

    // Handle iframe load
    pageFrame.onload = () => {
        hideLoadingIndicator();
        console.log(`Page loaded: ${pageName}`);
        
        // Cache the page
        pageCache.set(pageName, true);
        
        // Post message to page when it loads to optimize communication
        try {
            const message = { type: 'pageReady' };
            
            // If it's a shopping list page, include filter information
            if (pageName.startsWith('shopping-lists')) {
                const filter = pageName === 'shopping-lists-all' ? 'all' :
                              pageName === 'shopping-lists-active' ? 'active' : 'all';
                message.filter = filter;
                message.pageType = 'shopping-lists';
            }
            
            pageFrame.contentWindow.postMessage(message, '*');
        } catch (e) {
            // Cross-origin or not ready
        }
    };
    
    // Handle iframe load errors
    pageFrame.onerror = () => {
        hideLoadingIndicator();
        console.warn(`Page ${pageName} not found, loading dashboard`);
        if (pageName !== 'dashboard') {
            loadPage('dashboard');
        }
    };

    // Timeout fallback if page doesn't load within 3 seconds
    setTimeout(() => {
        if (pageFrame.src === fullUrl && !pageCache.has(pageName)) {
            hideLoadingIndicator();
        }
    }, 3000);
}

// Show loading indicator
function showLoadingIndicator() {
    let loader = document.getElementById('pageLoader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'pageLoader';
        loader.className = 'page-loader';
        loader.innerHTML = `
            <div class="loader-content">
                <div class="loader-spinner"></div>
                <div class="loader-text">Loading...</div>
            </div>
        `;
        const contentArea = document.querySelector('.content-area');
        if (contentArea) {
            contentArea.appendChild(loader);
        }
    }
    loader.classList.remove('hidden');
}

// Hide loading indicator
function hideLoadingIndicator() {
    const loader = document.getElementById('pageLoader');
    if (loader) {
        loader.classList.add('hidden');
    }
}

// Initialize - load dashboard by default
document.addEventListener('DOMContentLoaded', () => {
    // Check if there's a pending action from popup
    checkPendingAction();
    
    // Load dashboard by default
    loadPage('dashboard');
});

// Check for pending actions from popup
function checkPendingAction() {
    chrome.storage.local.get(['pendingAction', 'pendingImage', 'pendingSearch'], (result) => {
        if (result.pendingAction) {
            // Clear pending action after checking
            chrome.storage.local.remove(['pendingAction', 'pendingImage', 'pendingSearch']);
        }
    });
}

// Toggle sidebar collapse
const collapseBtn = document.querySelector('.collapse-btn');
if (collapseBtn) {
    collapseBtn.addEventListener('click', function() {
        document.querySelector('.sidebar').classList.toggle('collapsed');
        const icon = this.querySelector('.collapse-icon');
        icon.textContent = document.querySelector('.sidebar').classList.contains('collapsed') ? '»' : '«';
    });
}

// Handle expandable menu items
document.querySelectorAll('.menu-item.expandable').forEach(item => {
    item.addEventListener('click', function(e) {
        // Don't toggle if clicking on badge
        if (e.target.classList.contains('badge')) return;
        
        // Check if it has a data-page attribute (should navigate)
        const pageName = this.getAttribute('data-page');
        const submenu = this.nextElementSibling;
        
        // If clicking on the expand icon area, just toggle submenu
        if (e.target.closest('.expand-icon')) {
            if (submenu && submenu.classList.contains('submenu')) {
                submenu.classList.toggle('hidden');
                this.classList.toggle('expanded');
                const expandIcon = this.querySelector('.expand-icon');
                if (expandIcon) {
                    expandIcon.textContent = submenu.classList.contains('hidden') ? '▼' : '▲';
                }
            }
        } else if (pageName) {
            // If it has a page, navigate to it (and expand submenu)
            if (submenu && submenu.classList.contains('submenu')) {
                submenu.classList.remove('hidden');
                this.classList.add('expanded');
                const expandIcon = this.querySelector('.expand-icon');
                if (expandIcon) {
                    expandIcon.textContent = '▲';
                }
            }
            
            // Update active state
            document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            
            // Load the page
            requestAnimationFrame(() => {
                loadPage(pageName);
            });
        } else {
            // Just toggle submenu if no page
            if (submenu && submenu.classList.contains('submenu')) {
                submenu.classList.toggle('hidden');
                this.classList.toggle('expanded');
                const expandIcon = this.querySelector('.expand-icon');
                if (expandIcon) {
                    expandIcon.textContent = submenu.classList.contains('hidden') ? '▼' : '▲';
                }
            }
        }
    });
});

// Handle menu item selection and navigation (excluding expandable items)
document.querySelectorAll('.menu-item:not(.expandable)').forEach(item => {
    item.addEventListener('click', function(e) {
        // Don't navigate if clicking on badge
        if (e.target.classList.contains('badge')) return;
        
        const pageName = this.getAttribute('data-page');
        if (pageName && currentPageName !== pageName) {
            // Update active state immediately for instant feedback
            document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            
            // Use requestAnimationFrame for smooth transition
            requestAnimationFrame(() => {
                loadPage(pageName);
            });
        }
    });
}, { passive: true });

// Handle submenu item selection and navigation
document.querySelectorAll('.submenu-item').forEach(item => {
    item.addEventListener('click', function() {
        // Update active state
        document.querySelectorAll('.submenu-item').forEach(i => i.classList.remove('active'));
        this.classList.add('active');
        
        // Get parent menu item and activate it
        const parentMenuItem = this.closest('.sidebar-section').querySelector('.menu-item.expandable');
        if (parentMenuItem) {
            document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
            parentMenuItem.classList.add('active');
            
            // Expand the submenu if not already expanded
            const submenu = parentMenuItem.nextElementSibling;
            if (submenu && submenu.classList.contains('submenu')) {
                submenu.classList.remove('hidden');
                parentMenuItem.classList.add('expanded');
                const expandIcon = parentMenuItem.querySelector('.expand-icon');
                if (expandIcon) {
                    expandIcon.textContent = '▲';
                }
            }
        }
        
        // Load the page
        const pageName = this.getAttribute('data-page');
        if (pageName) {
            requestAnimationFrame(() => {
                loadPage(pageName);
            });
        }
    });
});

// Listen for messages from pages (for cross-frame communication)
window.addEventListener('message', (event) => {
    // Verify origin if needed (for security)
    // if (event.origin !== window.location.origin) return;
    
    if (event.data && event.data.type === 'navigate') {
        const pageName = event.data.page;
        if (pageName) {
            loadPage(pageName);
            // Update active menu item
            updateActiveMenuItem(pageName);
        }
    }
});

// Function to update active menu item based on current page
function updateActiveMenuItem(pageName) {
    // Remove all active states
    document.querySelectorAll('.menu-item, .submenu-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Find and activate the corresponding menu item
    const menuItem = document.querySelector(`[data-page="${pageName}"]`);
    if (menuItem) {
        menuItem.classList.add('active');
        
        // If it's a submenu item, expand parent and activate it
        if (menuItem.classList.contains('submenu-item')) {
            const parentMenuItem = menuItem.closest('.sidebar-section').querySelector('.menu-item.expandable');
            if (parentMenuItem) {
                parentMenuItem.classList.add('active');
                parentMenuItem.classList.add('expanded');
                const submenu = parentMenuItem.nextElementSibling;
                if (submenu && submenu.classList.contains('submenu')) {
                    submenu.classList.remove('hidden');
                    const expandIcon = parentMenuItem.querySelector('.expand-icon');
                    if (expandIcon) {
                        expandIcon.textContent = '▲';
                    }
                }
            }
        }
    }
}

