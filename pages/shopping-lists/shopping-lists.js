// Shopping Lists JavaScript for Market Shopper Extension

// ============================================
// Global State & Initialization
// ============================================

// Global state
let shoppingLists = [];
let currentFilter = 'all';
let currentListId = null; // ID of currently viewed list
let editingListId = null; // ID of list being edited (null for new list)

// Initialize when DOM is ready
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
  setupEventListeners();
  loadShoppingLists();
}

// ============================================
// CHUNK 2: Event Listeners Setup
// ============================================

function setupEventListeners() {
  // Create List Button
  const createListBtn = document.getElementById('createListBtn');
  if (createListBtn) {
    createListBtn.addEventListener('click', () => openListModal());
  }

  // Empty State Create Button (via delegation)
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
// CHUNK 5: Modal Functions (Basic)
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
// TODO: More chunks to be added:
// - Form submission handlers
// - List rendering
// - List detail rendering
// - Item management
// - List actions (delete, complete, save)
// - Item actions (check, delete, edit)
// ============================================

