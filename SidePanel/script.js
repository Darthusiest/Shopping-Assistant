// Toggle sidebar collapse
document.querySelector('.collapse-btn').addEventListener('click', function() {
    document.querySelector('.sidebar').classList.toggle('collapsed');
    const icon = this.querySelector('.collapse-icon');
    icon.textContent = document.querySelector('.sidebar').classList.contains('collapsed') ? '»' : '«';
});

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


// Handle menu item selection (excluding expandable items)
document.querySelectorAll('.menu-item:not(.expandable)').forEach(item => {
    item.addEventListener('click', function() {
        document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
        this.classList.add('active');
    });
});

// Handle submenu item selection
document.querySelectorAll('.submenu-item').forEach(item => {
    item.addEventListener('click', function() {
        document.querySelectorAll('.submenu-item').forEach(i => i.classList.remove('active'));
        this.classList.add('active');
    });
});

