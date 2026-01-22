// Shopping Lists JavaScript for Market Shopper Extension

// ============================================
// Global State & Initialization
// ============================================

// Global state
let shoppingLists = [];
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
    shoppingLists = result.shoppingLists || [];
    updateTabCounts();
    renderLists();
  });
}

// Save shopping lists to storage
function saveShoppingLists() {
  chrome.storage.local.set({ shoppingLists: shoppingLists }, () => {
    if (chrome.runtime.lastError) {
      console.error('Error saving shopping lists:', chrome.runtime.lastError);
    } else {
      updateTabCounts();
    }
  });
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
  const allCount = shoppingLists.length;
  const activeCount = shoppingLists.filter(list => !list.completed && !list.saved).length;
  const savedCount = shoppingLists.filter(list => list.saved).length;
  const completedCount = shoppingLists.filter(list => list.completed).length;

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
    const list = shoppingLists.find(l => l.id === listId);
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
    const listIndex = shoppingLists.findIndex(l => l.id === editingListId);
    if (listIndex !== -1) {
      // Update the existing list
      shoppingLists[listIndex].name = name;
      shoppingLists[listIndex].description = description;
      shoppingLists[listIndex].updatedDate = Date.now();
      
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
    

    shoppingLists.push(newList);
    

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
  
  // Find the current list
  const listIndex = shoppingLists.findIndex(l => l.id === currentListId);
  if (listIndex === -1) {
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
  
  if (!shoppingLists[listIndex].items) {
    shoppingLists[listIndex].items = [];
  }
  shoppingLists[listIndex].items.push(newItem);
  shoppingLists[listIndex].updatedDate = Date.now();
  
  saveShoppingLists();
  
  loadListDetail(currentListId);

  closeItemModal();
}