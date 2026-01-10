// Page Router - Maps page names to their HTML files
const pageRoutes = {
    'dashboard': 'pages/dashboard/dashboard.html',
    'price-tracker': 'pages/price-tracker/price-tracker.html',
    'deals': 'pages/deals/deals.html',
    'wishlist': 'pages/wishlist/wishlist.html',
    'history': 'pages/history/history.html',
    'settings': 'pages/settings/settings.html',
    'shopping-lists-all': 'pages/shopping-lists/shopping-lists.html',
    'shopping-lists-saved': 'pages/shopping-lists/shopping-lists.html',
    'shopping-lists-active': 'pages/shopping-lists/shopping-lists.html'
};

// Get page frame element
const pageFrame = document.getElementById('pageFrame');

// Function to load a page
function loadPage(pageName) {
    const pagePath = pageRoutes[pageName];
    if (pagePath && pageFrame) {
        // Use chrome.runtime.getURL() for proper extension URL
        const fullUrl = chrome.runtime.getURL(pagePath);
        pageFrame.src = fullUrl;
        
        // Handle iframe load errors
        pageFrame.onload = () => {
            console.log(`Page loaded: ${pageName}`);
        };
        
        pageFrame.onerror = () => {
            console.warn(`Page ${pageName} not found, loading dashboard`);
            if (pageName !== 'dashboard') {
                loadPage('dashboard');
            }
        };
    } else {
        console.warn(`Page route not found for: ${pageName}`);
        // Fallback to dashboard if page not found
        if (pageName !== 'dashboard') {
            loadPage('dashboard');
        }
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
        
        const submenu = this.nextElementSibling;
        if (submenu && submenu.classList.contains('submenu')) {
            submenu.classList.toggle('hidden');
            this.classList.toggle('expanded');
            const expandIcon = this.querySelector('.expand-icon');
            if (expandIcon) {
                expandIcon.textContent = submenu.classList.contains('hidden') ? '▼' : '▲';
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
        if (pageName) {
            // Update active state
            document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            
            // Load the page
            loadPage(pageName);
        }
    });
});

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
        }
        
        // Load the page
        const pageName = this.getAttribute('data-page');
        if (pageName) {
            loadPage(pageName);
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

