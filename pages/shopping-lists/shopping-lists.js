// Shopping Lists JavaScript for Market Shopper Extension

// ============================================
// Global State & Initialization
// ============================================

// Global state
// Using Map for O(1) lookup performance instead of O(n) array.find()
let shoppingListsMap = new Map(); // Map<listId, listObject>
let currentFilter = 'all';
let currentListId = null; // ID of currently viewed list
let editingListId = null; // ID of list being edited (null for new list)

// Initialize when ready
document.addEventListener('DOMContentLoaded', () => {
  initializeShoppingLists();
});

// Listen for messages from parent (side panel navigation)
window.addEventListener('message', (event) => {
  // Handle filter changes from navigation
  if (event.data && event.data.type === 'pageReady' && event.data.pageType === 'shopping-lists') {
    if (event.data.filter) {
      setActiveFilter(event.data.filter);
    }
  }
});

// Initialize all shopping lists functionality
function initializeShoppingLists() {
  setupActionReceivers();
  loadShoppingLists();
}

// ============================================
// CHUNK 2: Action Receivers Setup
// ============================================

function setupActionReceivers() {
  // Create List Button
  const createListBtn = document.getElementById('createListBtn');
  if (createListBtn) {
    createListBtn.addEventListener('click', () => openListModal());
  }

  // Empty State Create Button
  document.addEventListener('click', (e) => {
    if (e.target.closest('.empty-state-create-btn')) {
      openListModal();
    }
  });

  // Filter Tab Buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const filter = e.currentTarget.dataset.filter;
      setActiveFilter(filter);
    });
  });

  // Modal Close Buttons
  const closeListModalBtn = document.getElementById('closeListModalBtn');
  const closeItemModalBtn = document.getElementById('closeItemModalBtn');
  const cancelListBtn = document.getElementById('cancelListBtn');
  const cancelItemBtn = document.getElementById('cancelItemBtn');

  if (closeListModalBtn) {
    closeListModalBtn.addEventListener('click', () => closeListModal());
  }
  if (closeItemModalBtn) {
    closeItemModalBtn.addEventListener('click', () => closeItemModal());
  }
  if (cancelListBtn) {
    cancelListBtn.addEventListener('click', () => closeListModal());
  }
  if (cancelItemBtn) {
    cancelItemBtn.addEventListener('click', () => closeItemModal());
  }

  // Close modals on overlay click
  const listModal = document.getElementById('listModal');
  const addItemModal = document.getElementById('addItemModal');

  if (listModal) {
    listModal.addEventListener('click', (e) => {
      if (e.target === listModal) {
        closeListModal();
      }
    });
  }

  if (addItemModal) {
    addItemModal.addEventListener('click', (e) => {
      if (e.target === addItemModal) {
        closeItemModal();
      }
    });
  }

  // Form Submissions
  const listForm = document.getElementById('listForm');
  const addItemForm = document.getElementById('addItemForm');

  if (listForm) {
    listForm.addEventListener('submit', handleListFormSubmit);
  }

  if (addItemForm) {
    addItemForm.addEventListener('submit', handleAddItemFormSubmit);
  }

  // Back to Lists Button
  const backToListBtn = document.getElementById('backToListBtn');
  if (backToListBtn) {
    backToListBtn.addEventListener('click', () => showListsView());
  }

  // Add Item Button (in detail view)
  const addItemBtn = document.getElementById('addItemBtn');
  if (addItemBtn) {
    addItemBtn.addEventListener('click', () => openItemModal());
  }
}

// ============================================
// CHUNK 3: Storage Functions
// ============================================

// Load shopping lists from storage
function loadShoppingLists() {
  chrome.storage.local.get(['shoppingLists'], (result) => {
    const listsArray = result.shoppingLists || [];
    
    // Convert array to Map for efficient lookups
    shoppingListsMap.clear();
    listsArray.forEach(list => {
      shoppingListsMap.set(list.id, list);
    });
    
    updateTabCounts();
    renderLists();
  });
}

// Save shopping lists to storage
function saveShoppingLists() {
  // Convert Map to array for storage (Chrome storage doesn't support Maps)
  const listsArray = Array.from(shoppingListsMap.values());
  
  chrome.storage.local.set({ shoppingLists: listsArray }, () => {
    if (chrome.runtime.lastError) {
      console.error('Error saving shopping lists:', chrome.runtime.lastError);
    } else {
      updateTabCounts();
    }
  });
}

// Helper function to get all lists as array (for filtering/iteration)
function getAllLists() {
  return Array.from(shoppingListsMap.values());
}

// Helper function to get list by ID (O(1) lookup)
function getListById(listId) {
  return shoppingListsMap.get(listId);
}

// ============================================
// CHUNK 4: Filter Functions
// ============================================

// Set active filter and update UI
function setActiveFilter(filter) {
  currentFilter = filter;
  
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.filter === filter) {
      btn.classList.add('active');
    }
  });

  renderLists();
}

// Update tab counts
function updateTabCounts() {
  const allLists = getAllLists();
  const allCount = allLists.length;
  const activeCount = allLists.filter(list => !list.completed && !list.saved).length;
  const savedCount = allLists.filter(list => list.saved).length;
  const completedCount = allLists.filter(list => list.completed).length;

  const allCountEl = document.getElementById('allCount');
  const activeCountEl = document.getElementById('activeCount');
  const savedCountEl = document.getElementById('savedCount');
  const completedCountEl = document.getElementById('completedCount');

  if (allCountEl) allCountEl.textContent = allCount;
  if (activeCountEl) activeCountEl.textContent = activeCount;
  if (savedCountEl) savedCountEl.textContent = savedCount;
  if (completedCountEl) completedCountEl.textContent = completedCount;
}

// ============================================
// CHUNK 5: Modal Functions 
// ============================================

// Open list modal (for creating/editing)
function openListModal(listId = null) {
  editingListId = listId;
  const modal = document.getElementById('listModal');
  const modalTitle = document.getElementById('modalTitle');
  const listNameInput = document.getElementById('listName');
  const listDescriptionInput = document.getElementById('listDescription');
  const submitBtn = document.getElementById('submitListBtn');

  if (!modal) return;

  if (listId) {
    // Editing existing list
    const list = getListById(listId);
    if (list) {
      if (modalTitle) modalTitle.textContent = 'Edit Shopping List';
      if (listNameInput) listNameInput.value = list.name || '';
      if (listDescriptionInput) listDescriptionInput.value = list.description || '';
      if (submitBtn) submitBtn.textContent = 'Save Changes';
    }
  } else {
    // Creating new list
    if (modalTitle) modalTitle.textContent = 'Create Shopping List';
    if (listNameInput) listNameInput.value = '';
    if (listDescriptionInput) listDescriptionInput.value = '';
    if (submitBtn) submitBtn.textContent = 'Create List';
  }

  modal.classList.remove('hidden');
}

// Close list modal
function closeListModal() {
  const modal = document.getElementById('listModal');
  if (modal) {
    modal.classList.add('hidden');
    editingListId = null;
    
    // Reset form
    const form = document.getElementById('listForm');
    if (form) form.reset();
  }
}

// Open item modal
function openItemModal() {
  const modal = document.getElementById('addItemModal');
  if (modal) {
    modal.classList.remove('hidden');
  }
}

// Close item modal
function closeItemModal() {
  const modal = document.getElementById('addItemModal');
  if (modal) {
    modal.classList.add('hidden');
    
    // Reset form
    const form = document.getElementById('addItemForm');
    if (form) form.reset();
  }
}

// ============================================
// CHUNK 6: View Management
// ============================================

// Show lists view (hide detail view)
function showListsView() {
  const listsContainer = document.querySelector('.shopping-lists-container');
  const listDetailView = document.getElementById('listDetailView');
  
  if (listsContainer) listsContainer.classList.remove('hidden');
  if (listDetailView) listDetailView.classList.add('hidden');
  
  currentListId = null;
}

// Show detail view (hide lists view)
function showDetailView(listId) {
  const listsContainer = document.querySelector('.shopping-lists-container');
  const listDetailView = document.getElementById('listDetailView');
  
  if (listsContainer) listsContainer.classList.add('hidden');
  if (listDetailView) listDetailView.classList.remove('hidden');
  
  currentListId = listId;
  loadListDetail(listId);
}

// ============================================
// CHUNK 7: Form Submission Handlers
// ============================================

// Handle list form submission (create or edit)
function handleListFormSubmit(e) {
  e.preventDefault(); // Prevent default form submission (page reload)
  
  // Step 1: Get form input values
  const listNameInput = document.getElementById('listName');
  const listDescriptionInput = document.getElementById('listDescription');
  
  if (!listNameInput) return;
  
  const name = listNameInput.value.trim();
  const description = listDescriptionInput ? listDescriptionInput.value.trim() : '';
  
  // Step 2: Validate input
  if (!name) {
    alert('Please enter a list name');
    return;
  }
  
  // Step 3: Check if we're editing or creating
  if (editingListId) {
    // EDITING EXISTING LIST
    const list = getListById(editingListId);
    if (list) {
      // Update the existing list
      list.name = name;
      list.description = description;
      list.updatedDate = Date.now();
      
      // Save to storage
      saveShoppingLists();
      
      // Refresh the display
      renderLists();
      
      // Close modal
      closeListModal();
    }
  } else {
    // CREATING NEW LIST
    const newList = {
      id: Date.now(), // Unique ID based on timestamp
      name: name,
      description: description,
      items: [], // Start with empty items array
      createdDate: Date.now(),
      updatedDate: Date.now(),
      completed: false,
      saved: false
    };
    
    // Add to Map (O(1) operation)
    shoppingListsMap.set(newList.id, newList);
    

    saveShoppingLists();
    

    renderLists();
    

    closeListModal();
  }
}

// Handle add item form submission
function handleAddItemFormSubmit(e) {
  e.preventDefault(); // Prevent default form submission
  
  // Step 1: Check if we have a current list
  if (!currentListId) {
    alert('Please select a list first');
    closeItemModal();
    return;
  }
  
  // Step 2: Get form input values
  const itemNameInput = document.getElementById('itemName');
  const itemQuantityInput = document.getElementById('itemQuantity');
  const itemUnitInput = document.getElementById('itemUnit');
  const itemPriceInput = document.getElementById('itemPrice');
  const itemNotesInput = document.getElementById('itemNotes');
  
  if (!itemNameInput) return;
  
  const name = itemNameInput.value.trim();
  const quantity = itemQuantityInput ? parseInt(itemQuantityInput.value) || 1 : 1;
  const unit = itemUnitInput ? itemUnitInput.value : '';
  const price = itemPriceInput ? parseFloat(itemPriceInput.value) || null : null;
  const notes = itemNotesInput ? itemNotesInput.value.trim() : '';
  
  // Step 3: Validate input
  if (!name) {
    alert('Please enter an item name');
    return;
  }
  
  // Find the current list (O(1) lookup with Map)
  const list = getListById(currentListId);
  if (!list) {
    alert('List not found');
    closeItemModal();
    return;
  }
  
  const newItem = {
    id: Date.now(), // Unique ID
    name: name,
    quantity: quantity,
    unit: unit || null,
    price: price,
    notes: notes || null,
    completed: false,
    addedDate: Date.now()
  };
  
  if (!list.items) {
    list.items = [];
  }
  list.items.push(newItem);
  list.updatedDate = Date.now();
  
  saveShoppingLists();
  
  loadListDetail(currentListId);

  closeItemModal();
}

// ============================================
// CHUNK 8: List Rendering
// ============================================

// Render all shopping lists based on current filter
function renderLists() {
  const container = document.getElementById('listsContainer');
  if (!container) return;

  // Filter lists based on currentFilter
  let filteredLists = getAllLists();

  if (currentFilter === 'active') {
    filteredLists = filteredLists.filter(list => !list.completed && !list.saved);
  } else if (currentFilter === 'saved') {
    filteredLists = filteredLists.filter(list => list.saved);
  } else if (currentFilter === 'completed') {
    filteredLists = filteredLists.filter(list => list.completed);
  }
  // 'all' shows everything, no filtering needed

  // Use requestAnimationFrame for smooth rendering
  requestAnimationFrame(() => {
    // Show empty state if no lists
    if (filteredLists.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📝</div>
          <h3>No shopping lists yet</h3>
          <p>Create your first shopping list to get started</p>
          <button class="primary-btn empty-state-create-btn">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <line x1="8" y1="2" x2="8" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <span>Create Your First List</span>
          </button>
        </div>
      `;
      return;
    }

    // Create lists grid container
    const listsGrid = document.createElement('div');
    listsGrid.className = 'lists-grid';

    // Render each list card
    filteredLists.forEach(list => {
      listsGrid.appendChild(createListCard(list));
    });

    // Clear container and add grid
    container.innerHTML = '';
    container.appendChild(listsGrid);
  });
}

// Create a list card element
function createListCard(list) {
  const card = document.createElement('div');
  card.className = `list-card ${list.completed ? 'completed' : ''}`;
  card.dataset.id = list.id;

  const items = list.items || [];
  const completedItems = items.filter(item => item.completed).length;
  const totalItems = items.length;
  const estimatedTotal = items.reduce((sum, item) => {
    return sum + (item.price || 0) * (item.quantity || 1);
  }, 0);

  // Determine status badge
  let statusBadge = '';
  if (list.completed) {
    statusBadge = '<span class="list-status-badge completed">Completed</span>';
  } else if (list.saved) {
    statusBadge = '<span class="list-status-badge saved">Saved</span>';
  } else {
    statusBadge = '<span class="list-status-badge active">Active</span>';
  }

  card.innerHTML = `
    <div class="list-card-header">
      <div>
        <div class="list-card-title">${escapeHtml(list.name)}</div>
        ${list.description ? `<div class="list-card-description">${escapeHtml(list.description)}</div>` : ''}
      </div>
      ${statusBadge}
    </div>
    
    <div class="list-card-stats">
      <div class="list-stat">
        <div class="list-stat-label">Items</div>
        <div class="list-stat-value">${totalItems}</div>
      </div>
      <div class="list-stat">
        <div class="list-stat-label">Completed</div>
        <div class="list-stat-value">${completedItems}/${totalItems}</div>
      </div>
      <div class="list-stat">
        <div class="list-stat-label">Est. Total</div>
        <div class="list-stat-value">$${estimatedTotal.toFixed(2)}</div>
      </div>
    </div>

    <div class="list-card-actions">
      <button class="list-action-btn" data-action="edit" data-id="${list.id}">Edit</button>
      <button class="list-action-btn delete" data-action="delete" data-id="${list.id}">Delete</button>
    </div>
  `;

  // Add click handler to open list detail (except when clicking action buttons)
  card.addEventListener('click', (e) => {
    if (!e.target.closest('.list-card-actions')) {
      showDetailView(list.id);
    }
  });

  // Add action button handlers
  const editBtn = card.querySelector('[data-action="edit"]');
  const deleteBtn = card.querySelector('[data-action="delete"]');

  if (editBtn) {
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openListModal(list.id);
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteList(list.id);
    });
  }

  return card;
}

// ============================================
// CHUNK 9: List Detail Rendering
// ============================================

// Load and display list detail view
function loadListDetail(listId) {
  const list = getListById(listId); // O(1) lookup with Map
  if (!list) {
    console.error('List not found:', listId);
    return;
  }

  // Update detail view header
  const detailListName = document.getElementById('detailListName');
  const detailListDescription = document.getElementById('detailListDescription');
  
  if (detailListName) detailListName.textContent = list.name;
  if (detailListDescription) {
    detailListDescription.textContent = list.description || '';
    detailListDescription.style.display = list.description ? 'block' : 'none';
  }

  // Update stats
  const items = list.items || [];
  const completedItems = items.filter(item => item.completed).length;
  const totalItems = items.length;
  const estimatedTotal = items.reduce((sum, item) => {
    return sum + (item.price || 0) * (item.quantity || 1);
  }, 0);

  const totalItemsEl = document.getElementById('totalItems');
  const completedItemsEl = document.getElementById('completedItems');
  const estimatedTotalEl = document.getElementById('estimatedTotal');

  if (totalItemsEl) totalItemsEl.textContent = totalItems;
  if (completedItemsEl) completedItemsEl.textContent = completedItems;
  if (estimatedTotalEl) estimatedTotalEl.textContent = `$${estimatedTotal.toFixed(2)}`;

  // Render items
  renderListItems(items);
}

// Render items in the list detail view
function renderListItems(items) {
  const container = document.getElementById('itemsContainer');
  if (!container) return;

  requestAnimationFrame(() => {
    if (items.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📦</div>
          <h3>No items in this list</h3>
          <p>Add your first item to get started</p>
        </div>
      `;
      return;
    }

    // Use document fragment for batch DOM operations
    const fragment = document.createDocumentFragment();

    items.forEach(item => {
      fragment.appendChild(createItemCard(item));
    });

    // Clear and append
    container.innerHTML = '';
    container.appendChild(fragment);
  });
}

// Create an item card element
function createItemCard(item) {
  const card = document.createElement('div');
  card.className = `item-card ${item.completed ? 'completed' : ''}`;
  card.dataset.id = item.id;

  const quantityText = item.quantity > 1 ? `${item.quantity}${item.unit ? ' ' + item.unit : ''}` : '';
  const priceText = item.price ? `$${item.price.toFixed(2)}` : '';

  card.innerHTML = `
    <div class="item-checkbox ${item.completed ? 'checked' : ''}" data-action="toggle">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 8 L6 11 L13 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    
    <div class="item-info">
      <div class="item-name">${escapeHtml(item.name)}</div>
      <div class="item-details">
        ${quantityText ? `<span class="item-quantity">${quantityText}</span>` : ''}
        ${priceText ? `<span class="item-price">${priceText}</span>` : ''}
      </div>
      ${item.notes ? `<div class="item-notes">${escapeHtml(item.notes)}</div>` : ''}
    </div>

    <div class="item-actions">
      <button class="item-action-btn" data-action="edit" title="Edit item">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M11 2 L14 5 L8 11 L5 11 L5 8 Z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <button class="item-action-btn delete" data-action="delete" title="Delete item">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <line x1="4" y1="4" x2="12" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="12" y1="4" x2="4" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  `;

  // Add event handlers
  const checkbox = card.querySelector('[data-action="toggle"]');
  const editBtn = card.querySelector('[data-action="edit"]');
  const deleteBtn = card.querySelector('[data-action="delete"]');

  if (checkbox) {
    checkbox.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleItemComplete(item.id);
    });
  }

  if (editBtn) {
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      editItem(item.id);
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteItem(item.id);
    });
  }

  return card;
}

// Helper function to escape HTML (prevent XSS)
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Placeholder functions for item actions (to be implemented in next chunks)
function toggleItemComplete(itemId) {

  console.log('Toggle item complete:', itemId);
}

function editItem(itemId) {

  console.log('Edit item:', itemId);
}

function deleteItem(itemId) {

  console.log('Delete item:', itemId);
}

function deleteList(listId) {

  console.log('Delete list:', listId);
}