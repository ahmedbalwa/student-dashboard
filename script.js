/**
 * Student Dashboard - Ultra Pro Edition
 * Enhanced JavaScript with advanced features
 */

// ============================================
// Configuration & Constants
// ============================================
const CONFIG = {
    STORAGE_KEY: 'students_ultra',
    COURSES: {
        Web: { label: 'Web Development', badgeClass: 'Web', color: '#4f46e5' },
        Data: { label: 'Data Science', badgeClass: 'Data', color: '#10b981' },
        UI: { label: 'UI/UX Design', badgeClass: 'UI', color: '#f59e0b' }
    },
    ANIMATION_DELAY: 300,
    COLORS: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']
};

// ============================================
// State Management
// ============================================
let state = {
    students: [],
    editingIndex: null,
    deleteIndex: null,
    searchTerm: '',
    filterCourse: 'all',
    sortBy: 'newest',
    selectedIds: [],
    sortColumn: null,
    sortDirection: 'asc'
};

// ============================================
// DOM Elements
// ============================================
const elements = {
    studentList: document.getElementById('studentList'),
    count: document.getElementById('count'),
    avgProgress: document.getElementById('avgProgress'),
    progressRing: document.getElementById('progressRing'),
    thisMonth: document.getElementById('thisMonth'),
    search: document.getElementById('search'),
    filter: document.getElementById('filter'),
    sort: document.getElementById('sort'),
    modal: document.getElementById('modal'),
    deleteModal: document.getElementById('deleteModal'),
    shortcutsModal: document.getElementById('shortcutsModal'),
    studentForm: document.getElementById('studentForm'),
    modalTitle: document.getElementById('modalTitle'),
    submitBtn: document.getElementById('submitBtn'),
    emptyState: document.getElementById('emptyState'),
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toastMessage'),
    bulkActions: document.getElementById('bulkActions'),
    selectedCount: document.getElementById('selectedCount'),
    selectAll: document.getElementById('selectAll'),
    skeletonLoader: document.getElementById('skeletonLoader'),
    themeToggle: document.getElementById('themeToggle'),
    avatarPreview: document.getElementById('avatarPreview'),
    avatarInitial: document.getElementById('avatarInitial'),
    progressLabel: document.getElementById('progressLabel')
};

let chartInstance = null;

// ============================================
// Utility Functions
// ============================================
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function generateAvatarColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return CONFIG.COLORS[Math.abs(hash) % CONFIG.COLORS.length];
}

function getInitials(name) {
    return name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

function showToast(message, type = 'success') {
    elements.toastMessage.textContent = message;
    elements.toast.className = `toast show ${type}`;
    
    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 3000);
}

function validateEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Confetti Effect
function launchConfetti() {
    const container = document.getElementById('confettiContainer');
    const colors = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 0.5 + 's';
        confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
        
        if (Math.random() > 0.5) {
            confetti.style.borderRadius = '50%';
        }
        
        container.appendChild(confetti);
        
        setTimeout(() => confetti.remove(), 3000);
    }
}

// Skeleton Loading
function showSkeleton() {
    elements.skeletonLoader.classList.add('active');
    elements.studentList.style.display = 'none';
    elements.emptyState.style.display = 'none';
    
    let skeletonHTML = '';
    for (let i = 0; i < 5; i++) {
        skeletonHTML += `
            <div class="skeleton-row">
                <div class="skeleton skeleton-avatar"></div>
                <div class="skeleton skeleton-text"></div>
                <div class="skeleton skeleton-text short"></div>
                <div class="skeleton skeleton-btn"></div>
            </div>
        `;
    }
    elements.skeletonLoader.innerHTML = skeletonHTML;
}

function hideSkeleton() {
    elements.skeletonLoader.classList.remove('active');
    elements.studentList.style.display = '';
}

// ============================================
// Theme Management
// ============================================
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    elements.themeToggle.checked = savedTheme === 'dark';
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Update chart colors
    if (chartInstance) {
        updateChartTheme();
    }
}

// ============================================
// IndexedDB Setup
// ============================================
let db;

function initIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('StudentDashboardDB', 1);
        
        request.onerror = () => reject(request.error);
        
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            if (!db.objectStoreNames.contains('students')) {
                const store = db.createObjectStore('students', { keyPath: 'id' });
                store.createIndex('course', 'course', { unique: false });
                store.createIndex('createdAt', 'createdAt', { unique: false });
            }
        };
    });
}

function saveToIndexedDB(student) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['students'], 'readwrite');
        const store = transaction.objectStore('students');
        const request = store.put(student);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

function deleteFromIndexedDB(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['students'], 'readwrite');
        const store = transaction.objectStore('students');
        const request = store.delete(id);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

function getAllFromIndexedDB() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['students'], 'readonly');
        const store = transaction.objectStore('students');
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// ============================================
// Data Management
// ============================================
async function loadStudents() {
    showSkeleton();
    
    // Simulate loading delay for skeleton animation
    await new Promise(resolve => setTimeout(resolve, 800));
    
    if (db) {
        state.students = await getAllFromIndexedDB();
    } else {
        const stored = localStorage.getItem(CONFIG.STORAGE_KEY);
        state.students = stored ? JSON.parse(stored) : [];
    }
    
    // Add sample data if empty
    if (state.students.length === 0) {
        await addSampleData();
    }
    
    hideSkeleton();
}

async function addSampleData() {
    const sampleStudents = [
        { id: generateId(), name: 'Alice Johnson', email: 'alice@example.com', course: 'Web', progress: 75, avatar: '#4f46e5', createdAt: new Date().toISOString() },
        { id: generateId(), name: 'Bob Smith', email: 'bob@example.com', course: 'Data', progress: 60, avatar: '#10b981', createdAt: new Date(Date.now() - 86400000).toISOString() },
        { id: generateId(), name: 'Carol Williams', email: 'carol@example.com', course: 'UI', progress: 90, avatar: '#f59e0b', createdAt: new Date(Date.now() - 172800000).toISOString() },
        { id: generateId(), name: 'David Brown', email: 'david@example.com', course: 'Web', progress: 45, avatar: '#8b5cf6', createdAt: new Date(Date.now() - 259200000).toISOString() },
        { id: generateId(), name: 'Eva Martinez', email: 'eva@example.com', course: 'Data', progress: 80, avatar: '#ec4899', createdAt: new Date(Date.now() - 345600000).toISOString() }
    ];
    
    for (const student of sampleStudents) {
        if (db) {
            await saveToIndexedDB(student);
        }
        state.students.push(student);
    }
    
    saveStudents();
}

function saveStudents() {
    if (!db) {
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(state.students));
    }
}

function getFilteredStudents() {
    let filtered = [...state.students];
    
    // Apply search filter
    if (state.searchTerm) {
        filtered = filtered.filter(s => 
            s.name.toLowerCase().includes(state.searchTerm.toLowerCase()) ||
            s.email.toLowerCase().includes(state.searchTerm.toLowerCase())
        );
    }
    
    // Apply course filter
    if (state.filterCourse !== 'all') {
        filtered = filtered.filter(s => s.course === state.filterCourse);
    }
    
    // Apply sorting
    if (state.sortBy) {
        switch (state.sortBy) {
            case 'newest':
                filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                break;
            case 'oldest':
                filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                break;
            case 'name-asc':
                filtered.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'name-desc':
                filtered.sort((a, b) => b.name.localeCompare(a.name));
                break;
        }
    }
    
    return filtered;
}

// ============================================
// UI Rendering
// ============================================
function renderStudents() {
    const filtered = getFilteredStudents();
    
    if (filtered.length === 0) {
        elements.studentList.innerHTML = '';
        elements.emptyState.style.display = 'block';
        return;
    }
    
    elements.emptyState.style.display = 'none';
    
    elements.studentList.innerHTML = filtered.map((student) => {
        const courseInfo = CONFIG.COURSES[student.course] || { badgeClass: '', label: student.course };
        const isSelected = state.selectedIds.includes(student.id);
        
        return `
            <tr data-id="${student.id}" class="${isSelected ? 'selected' : ''}">
                <td>
                    <input type="checkbox" 
                           class="student-checkbox" 
                           data-id="${student.id}"
                           ${isSelected ? 'checked' : ''}
                           onchange="toggleSelectStudent('${student.id}')">
                </td>
                <td>${String(state.students.indexOf(student) + 1).padStart(3, '0')}</td>
                <td>
                    <div class="student-cell">
                        <div class="student-avatar" style="background: ${student.avatar || generateAvatarColor(student.name)}">
                            ${getInitials(student.name)}
                        </div>
                        <span class="student-name">${escapeHtml(student.name)}</span>
                    </div>
                </td>
                <td>${escapeHtml(student.email)}</td>
                <td>
                    <span class="course-badge ${courseInfo.badgeClass}">
                        ${courseInfo.label}
                    </span>
                </td>
                <td>
                    <div class="progress-cell">
                        <div class="progress-bar">
                            <div class="progress-bar-fill" style="width: ${student.progress || 0}%"></div>
                        </div>
                        <span class="progress-text">${student.progress || 0}%</span>
                    </div>
                </td>
                <td>
                    <div class="action-btns">
                        <button class="action-btn edit" onclick="editStudent('${student.id}')">
                            ✏️ Edit
                        </button>
                        <button class="action-btn delete" onclick="confirmDelete('${student.id}')">
                            🗑️ Delete
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    // Update stats
    updateStats();
}

function updateStats() {
    const total = state.students.length;
    elements.count.textContent = total;
    
    // Calculate average progress
    const avgProgress = state.students.length > 0
        ? Math.round(state.students.reduce((sum, s) => sum + (s.progress || 0), 0) / state.students.length)
        : 0;
    elements.avgProgress.textContent = avgProgress + '%';
    elements.progressRing.setAttribute('stroke-dasharray', `${avgProgress}, 100`);
    
    // This month count
    const thisMonth = new Date().getMonth();
    const thisMonthCount = state.students.filter(s => {
        const created = new Date(s.createdAt);
        return created.getMonth() === thisMonth;
    }).length;
    elements.thisMonth.textContent = thisMonthCount;
}

// ============================================
// Chart
// ============================================
function initChart() {
    const ctx = document.getElementById('enrollmentChart');
    if (!ctx) return;
    
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#9ca3af' : '#6b7280';
    const gridColor = isDark ? '#374151' : '#e5e7eb';
    
    const data = {
       labels: [
                'Jan','Feb','Mar','Apr','May','Jun',
                'Jul','Aug','Sep','Oct','Nov','Dec',
                'Jan2','Feb2','Mar2','Apr2','May2','Jun2',
                'Jul2','Aug2','Sep2','Oct2','Nov2','Dec2'
], 
        datasets: [
            {
                label: 'Web Development',
                data: [12,19,15,25,22,30,28,26,24,27,29,31,33,35,32,30,28,27,29,31,34,36,38,40],
                borderColor: '#4f46e5',
                backgroundColor: 'rgba(79, 70, 229, 0.1)',
                tension: 0.4,
                fill: true
            },
            {
                label: 'Data Science',
                data: [8,12,18,20,25,28,26,24,23,25,27,29,31,33,30,28,27,26,28,30,32,34,36,38],
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4,
                fill: true
            },
            {
                label: 'UI/UX Design',
                data: [5,8,12,15,18,22,20,19,18,20,22,24,26,28,25,23,22,21,23,25,27,29,30,32],
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                tension: 0.4,
                fill: true
            },
            {
                label: 'Mobile Development',
                data: [6,10,14,18,21,25,23,22,21,23,25,27,29,31,28,26,25,24,26,28,30,32,34,36],
                borderColor: '#06b6d4',
                backgroundColor: 'rgba(6, 182, 212, 0.1)',
                tension: 0.4,
                fill: true
            },
            {
                label: 'App Development',    
                data: [4,7,11,14,17,20,19,18,17,18,20,22,24,26,23,21,20,19,21,23,25,27,29,31],
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                tension: 0.4,
                fill: true
         }
        ]
    };
    
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    grid: {
                        color: gridColor
                    },
                    ticks: {
                        color: textColor
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: gridColor
                    },
                    ticks: {
                        color: textColor
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
}

function updateChartTheme() {
    if (!chartInstance) return;
    
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#9ca3af' : '#6b7280';
    const gridColor = isDark ? '#374151' : '#e5e7eb';
    
    chartInstance.options.scales.x.grid.color = gridColor;
    chartInstance.options.scales.y.grid.color = gridColor;
    chartInstance.options.scales.x.ticks.color = textColor;
    chartInstance.options.scales.y.ticks.color = textColor;
    chartInstance.update();
}

// ============================================
// Modal Management
// ============================================
function openModal() {
    elements.modal.classList.add('active');
    elements.studentForm.reset();
    
    // Reset form validation
    document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
    document.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
    
    // Reset avatar
    elements.avatarInitial.textContent = '?';
    elements.avatarPreview.style.background = 'linear-gradient(135deg, var(--primary), var(--success))';
    elements.progressLabel.textContent = '0%';
    
    // Set mode
    state.editingIndex = null;
    elements.modalTitle.textContent = 'Add New Student';
    elements.submitBtn.textContent = 'Save Student';
    
    // Focus first input
    setTimeout(() => document.getElementById('name').focus(), 100);
}

function closeModal() {
    elements.modal.classList.remove('active');
    state.editingIndex = null;
}

function openDeleteModal() {
    elements.deleteModal.classList.add('active');
}

function closeDeleteModal() {
    elements.deleteModal.classList.remove('active');
    state.deleteIndex = null;
}

function showShortcuts() {
    elements.shortcutsModal.classList.add('active');
}

function closeShortcutsModal() {
    elements.shortcutsModal.classList.remove('active');
}

// ============================================
// CRUD Operations
// ============================================
function validateForm() {
    let isValid = true;
    const name = document.getElementById('name');
    const email = document.getElementById('email');
    const course = document.getElementById('course');
    
    // Reset errors
    [name, email, course].forEach(el => {
        if (el) {
            el.classList.remove('error');
            const errorEl = el.parentElement.querySelector('.error-message');
            if (errorEl) errorEl.textContent = '';
        }
    });
    
    // Validate name
    if (!name.value.trim()) {
        name.classList.add('error');
        document.getElementById('nameError').textContent = 'Name is required';
        isValid = false;
    } else if (name.value.trim().length < 2) {
        name.classList.add('error');
        document.getElementById('nameError').textContent = 'Name must be at least 2 characters';
        isValid = false;
    }
    
    // Validate email
    if (!email.value.trim()) {
        email.classList.add('error');
        document.getElementById('emailError').textContent = 'Email is required';
        isValid = false;
    } else if (!validateEmail(email.value)) {
        email.classList.add('error');
        document.getElementById('emailError').textContent = 'Please enter a valid email';
        isValid = false;
    }
    
    // Check for duplicate email
    const duplicateEmail = state.students.some((s, index) => 
        s.email.toLowerCase() === email.value.toLowerCase() && 
        index !== state.editingIndex
    );
    
    if (duplicateEmail) {
        email.classList.add('error');
        document.getElementById('emailError').textContent = 'This email already exists';
        isValid = false;
    }
    
    // Validate course
    if (!course.value) {
        course.classList.add('error');
        isValid = false;
    }
    
    return isValid;
}

async function handleSubmit(event) {
    event.preventDefault();
    
    if (!validateForm()) return;
    
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const course = document.getElementById('course').value;
    const progress = parseInt(document.getElementById('progress').value) || 0;
    const avatarColor = generateAvatarColor(name);
    
    if (state.editingIndex !== null) {
        // Update existing student
        const student = state.students[state.editingIndex];
        student.name = name;
        student.email = email;
        student.course = course;
        student.progress = progress;
        student.avatar = avatarColor;
        
        if (db) {
            await saveToIndexedDB(student);
        }
        saveStudents();
        showToast('Student updated successfully!');
    } else {
        // Add new student
        const newStudent = {
            id: generateId(),
            name,
            email,
            course,
            progress,
            avatar: avatarColor,
            createdAt: new Date().toISOString()
        };
        
        if (db) {
            await saveToIndexedDB(newStudent);
        }
        state.students.push(newStudent);
        saveStudents();
        
        // Launch confetti celebration!
        launchConfetti();
        showToast('Student added successfully! 🎉');
    }
    
    renderStudents();
    closeModal();
}

function editStudent(id) {
    const index = state.students.findIndex(s => s.id === id);
    if (index === -1) return;
    
    const student = state.students[index];
    state.editingIndex = index;
    
    // Populate form
    document.getElementById('name').value = student.name;
    document.getElementById('email').value = student.email;
    document.getElementById('course').value = student.course;
    document.getElementById('progress').value = student.progress || 0;
    document.getElementById('progressLabel').textContent = (student.progress || 0) + '%';
    
    // Update avatar
    const initial = getInitials(student.name);
    elements.avatarInitial.textContent = initial;
    elements.avatarPreview.style.background = student.avatar || generateAvatarColor(student.name);
    
    // Update modal
    elements.modalTitle.textContent = 'Edit Student';
    elements.submitBtn.textContent = 'Update Student';
    
    // Open modal
    elements.modal.classList.add('active');
    document.getElementById('name').focus();
}

function confirmDelete(id) {
    const student = state.students.find(s => s.id === id);
    if (!student) return;
    
    state.deleteIndex = id;
    
    // Show confirmation modal
    document.getElementById('deleteMessage').textContent = 
        `Are you sure you want to delete "${student.name}"? This action cannot be undone.`;
    
    openDeleteModal();
    
    // Set up confirm button
    document.getElementById('confirmDeleteBtn').onclick = () => {
        deleteStudent();
    };
}

async function deleteStudent() {
    if (!state.deleteIndex) return;
    
    const index = state.students.findIndex(s => s.id === state.deleteIndex);
    if (index === -1) return;
    
    state.students.splice(index, 1);
    
    if (db) {
        await deleteFromIndexedDB(state.deleteIndex);
    }
    saveStudents();
    renderStudents();
    closeDeleteModal();
    showToast('Student deleted successfully!', 'success');
}

// ============================================
// Bulk Operations
// ============================================
function toggleSelectStudent(id) {
    const index = state.selectedIds.indexOf(id);
    if (index === -1) {
        state.selectedIds.push(id);
    } else {
        state.selectedIds.splice(index, 1);
    }
    
    updateBulkActions();
    renderStudents();
}

function toggleSelectAll() {
    const filtered = getFilteredStudents();
    
    if (elements.selectAll.checked) {
        state.selectedIds = filtered.map(s => s.id);
    } else {
        state.selectedIds = [];
    }
    
    updateBulkActions();
    renderStudents();
}

function updateBulkActions() {
    if (state.selectedIds.length > 0) {
        elements.bulkActions.style.display = 'flex';
        elements.selectedCount.textContent = `${state.selectedIds.length} selected`;
    } else {
        elements.bulkActions.style.display = 'none';
    }
}

async function bulkDelete() {
    if (state.selectedIds.length === 0) return;
    
    const confirmDelete = window.confirm(
        `Are you sure you want to delete ${state.selectedIds.length} students? This action cannot be undone.`
    );
    
    if (!confirmDelete) return;
    
    for (const id of state.selectedIds) {
        const index = state.students.findIndex(s => s.id === id);
        if (index !== -1) {
            state.students.splice(index, 1);
            if (db) {
                await deleteFromIndexedDB(id);
            }
        }
    }
    
    saveStudents();
    state.selectedIds = [];
    updateBulkActions();
    renderStudents();
    showToast(`${state.selectedIds.length} students deleted!`, 'success');
}

function clearSelection() {
    state.selectedIds = [];
    elements.selectAll.checked = false;
    updateBulkActions();
    renderStudents();
}

// ============================================
// Export to CSV
// ============================================
function exportToCSV() {
    const headers = ['ID', 'Name', 'Email', 'Course', 'Progress', 'Created At'];
    const rows = state.students.map(s => [
        s.id,
        s.name,
        s.email,
        CONFIG.COURSES[s.course]?.label || s.course,
        s.progress || 0,
        new Date(s.createdAt).toLocaleDateString()
    ]);
    
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `students_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    showToast('CSV exported successfully!');
}

// ============================================
// Progress Label Update
// ============================================
function updateProgressLabel(value) {
    elements.progressLabel.textContent = value + '%';
    
    // Update avatar initial as user types name
    const nameInput = document.getElementById('name');
    if (nameInput.value) {
        const initial = getInitials(nameInput.value);
        elements.avatarInitial.textContent = initial;
        elements.avatarPreview.style.background = generateAvatarColor(nameInput.value);
    }
}

// ============================================
// Event Listeners
// ============================================
function initEventListeners() {
    // Search
    elements.search.addEventListener('input', (e) => {
        state.searchTerm = e.target.value;
        renderStudents();
    });
    
    // Filter
    elements.filter.addEventListener('change', (e) => {
        state.filterCourse = e.target.value;
        renderStudents();
    });
    
    // Sort
    elements.sort.addEventListener('change', (e) => {
        state.sortBy = e.target.value;
        renderStudents();
    });
    
    // Theme toggle
    elements.themeToggle.addEventListener('change', toggleTheme);
    
    // Avatar preview on name input
    document.getElementById('name').addEventListener('input', (e) => {
        if (e.target.value.length >= 2) {
            const initial = getInitials(e.target.value);
            elements.avatarInitial.textContent = initial;
            elements.avatarPreview.style.background = generateAvatarColor(e.target.value);
        }
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Escape to close modals
        if (e.key === 'Escape') {
            if (elements.deleteModal.classList.contains('active')) {
                closeDeleteModal();
            } else if (elements.modal.classList.contains('active')) {
                closeModal();
            } else if (elements.shortcutsModal.classList.contains('active')) {
                closeShortcutsModal();
            }
        }
        
        // Ctrl+N to open add modal
        if (e.ctrlKey && e.key === 'n') {
            e.preventDefault();
            openModal();
        }
        
        // Ctrl+F to focus search
        if (e.ctrlKey && e.key === 'f') {
            e.preventDefault();
            elements.search.focus();
        }
        
        // Ctrl+E to export
        if (e.ctrlKey && e.key === 'e') {
            e.preventDefault();
            exportToCSV();
        }
        
        // Ctrl+D to toggle dark mode
        if (e.ctrlKey && e.key === 'd') {
            e.preventDefault();
            toggleTheme();
        }
        
        // Delete to delete selected
        if (e.key === 'Delete' && state.selectedIds.length > 0) {
            bulkDelete();
        }
    });
    
    // Close modal on overlay click
    elements.modal.querySelector('.modal-overlay').addEventListener('click', closeModal);
    elements.deleteModal.querySelector('.modal-overlay').addEventListener('click', closeDeleteModal);
    elements.shortcutsModal.querySelector('.modal-overlay').addEventListener('click', closeShortcutsModal);
}

// ============================================
// PWA Installation
// ============================================
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    const installBtn = document.getElementById('installBtn');
    installBtn.style.display = 'block';
    
    installBtn.addEventListener('click', async () => {
        installBtn.style.display = 'none';
        deferredPrompt.prompt();
        
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            showToast('App installed successfully!');
        }
    });
});

// ============================================
// Service Worker Registration
// ============================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('service-worker.js');
            console.log('ServiceWorker registered:', registration.scope);
        } catch (error) {
            console.log('ServiceWorker registration failed:', error);
        }
    });
}

// ============================================
// Initialize
// ============================================
async function init() {
    try {
        await initIndexedDB();
    } catch (e) {
        console.log('IndexedDB not available, using localStorage');
    }
    
    initTheme();
    await loadStudents();
    initEventListeners();
    renderStudents();
    
    // Initialize chart after a short delay
    setTimeout(initChart, 100);
}

// Cursor Trail Effect
function initCursorTrail() {
    const canvas = document.getElementById('cursorTrail');
    const ctx = canvas.getContext('2d');
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    let mouseX = 0;
    let mouseY = 0;
    let particles = [];
    
    class Particle {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.size = Math.random() * 8 + 2;
            this.speedX = (Math.random() - 0.5) * 2;
            this.speedY = (Math.random() - 0.5) * 2;
            this.opacity = 1;
            this.life = 100;
        }
        
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            this.opacity -= 0.02;
            this.life--;
        }
        
        draw() {
            ctx.save();
            ctx.globalAlpha = this.opacity;
            ctx.fillStyle = `hsl(240, 100%, ${50 + Math.random() * 20}%)`;
            ctx.shadowBlur = 20;
            ctx.shadowColor = 'rgba(79, 70, 229, 0.8)';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
    
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (mouseX !== 0 && mouseY !== 0 && particles.length < 30) {
            for (let i = 0; i < 3; i++) {
                particles.push(new Particle(mouseX, mouseY));
            }
        }
        
        particles = particles.filter(p => p.life > 0);
        particles.forEach(p => {
            p.update();
            p.draw();
        });
        
        requestAnimationFrame(animate);
    }
    
    canvas.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });
    
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
    
    animate();
}

// Floating Particles
function initFloatingParticles() {
    const container = document.getElementById('floatingParticles');
    
    for (let i = 0; i < 12; i++) {
        const particle = document.createElement('div');
        particle.className = 'floating-particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.width = Math.random() * 60 + 20 + 'px';
        particle.style.height = particle.style.width;
        particle.style.animationDelay = Math.random() * 15 + 's';
        particle.style.animationDuration = (Math.random() * 10 + 15) + 's';
        container.appendChild(particle);
    }
}

// Start the application
document.addEventListener('DOMContentLoaded', () => {
    init();
    initCursorTrail();
    initFloatingParticles();
});


