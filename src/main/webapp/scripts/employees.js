/* ============================================
   employees.js — Employee Management Module
   Red Damien Entertainment Payroll System
   Database-backed via REST API
   ============================================ */

(function () {
    'use strict';

    // ============================================
    // API HELPER
    // ============================================
    const API = '/payroll/api/employees';

    async function apiFetch(url, options = {}) {
        // If body is FormData, do NOT set Content-Type (browser sets boundary)
        const isFormData = options.body instanceof FormData;
        const headers = isFormData ? {} : { 'Content-Type': 'application/json' };

        // Attach audit user info from localStorage
        try {
            const ud = JSON.parse(localStorage.getItem('userData') || '{}');
            if (ud.userId) headers['X-User-Id'] = String(ud.userId);
            if (ud.firstName || ud.lastName) headers['X-User-Name'] = ((ud.firstName || '') + ' ' + (ud.lastName || '')).trim();
            if (ud.userRole) headers['X-User-Role'] = ud.userRole;
        } catch (e) { /* ignore */ }

        const resp = await fetch(url, { headers, ...options });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'Request failed');
        return data;
    }

    // ============================================
    // UTILITY HELPERS
    // ============================================
    function $(sel) { return document.querySelector(sel); }
    function $$(sel) { return document.querySelectorAll(sel); }

    function initials(first, last) {
        return ((first?.[0] || '') + (last?.[0] || '')).toUpperCase();
    }

    function showToast(msg, type) {
        const toast = $('#toast');
        const icon = $('#toastIcon');
        const message = $('#toastMessage');
        icon.textContent = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
        message.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    let confirmCallback = null;

    function showConfirm(msg, onOk) {
        $('#confirmMessage').textContent = msg;
        confirmCallback = onOk;
        $('#confirmModal').classList.add('show');
    }

    function formatDate(iso) {
        if (!iso) return '—';
        return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    function esc(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    // ============================================
    // DOM REFERENCES
    // ============================================
    const employeeBody = $('#employeeBody');
    const employeeTable = $('#employeeTable');
    const noEmployees = $('#noEmployees');
    const recordCount = $('#recordCount');

    const searchInput = $('#searchInput');

    const employeeModal = $('#employeeModal');
    const employeeForm = $('#employeeForm');
    const employeeModalTitle = $('#employeeModalTitle');

    const viewModal = $('#viewModal');
    const viewModalBody = $('#viewModalBody');

    // ============================================
    // SORT & FILTER STATE
    // ============================================
    let sortColumn = 'name';   // 'name' | 'type'
    let sortAsc = true;
    let activeFilter = 'all';  // 'all' | 'full-time' | 'on-call'

    // ============================================
    // IN-MEMORY CACHE  (loaded from DB)
    // ============================================
    let allEmployees = [];
    let editingId = null;

    async function loadEmployees() {
        try {
            allEmployees = await apiFetch(API);
        } catch (e) {
            console.error('Failed to load employees:', e);
            showToast('Failed to load employees from server', 'error');
            allEmployees = [];
        }
    }

    // ============================================
    // RENDER TABLE
    // ============================================
    function getFilteredEmployees() {
        let list = [...allEmployees];

        // Type filter
        if (activeFilter !== 'all') {
            list = list.filter(e => e.employeeType === activeFilter);
        }

        // Search filter
        const q = (searchInput.value || '').toLowerCase().trim();
        if (q) {
            list = list.filter(e =>
                (e.firstName + ' ' + e.lastName).toLowerCase().includes(q) ||
                (e.skill || '').toLowerCase().includes(q) ||
                (e.cellphone || '').toLowerCase().includes(q)
            );
        }

        // Sort
        list.sort((a, b) => {
            let cmp = 0;
            if (sortColumn === 'name') {
                const nameA = (a.firstName + ' ' + a.lastName).toLowerCase();
                const nameB = (b.firstName + ' ' + b.lastName).toLowerCase();
                cmp = nameA.localeCompare(nameB);
            } else if (sortColumn === 'type') {
                cmp = (a.employeeType || '').localeCompare(b.employeeType || '');
            }
            return sortAsc ? cmp : -cmp;
        });

        return list;
    }

    function formatRole(position) {
        if (!position) return '—';
        return position.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    function buildRowHtml(emp) {
        const typeLabel = emp.employeeType === 'full-time' ? 'Full-Time' : 'On-Call';
        const typeClass = emp.employeeType === 'full-time' ? 'full-time' : 'on-call';
        const role = window.AUTH ? AUTH.getUserRole() : '';
        const isBusinessOwner = role === 'business_owner';
        // Only business owner can edit/delete full-time employees
        const canEdit = isBusinessOwner || emp.employeeType !== 'full-time';
        const canDelete = canEdit && emp.position !== 'business owner';
        return `
            <tr>
                <td>
                    <div class="employee-cell">
                        <div class="emp-avatar">${initials(emp.firstName, emp.lastName)}</div>
                        <div class="emp-name-group">
                            <span class="emp-fullname">${esc(emp.firstName)} ${esc(emp.lastName)}</span>
                            <span class="emp-id-text">ID: ${emp.id}</span>
                        </div>
                    </div>
                </td>
                <td><span class="type-badge ${typeClass}">${typeLabel}</span></td>
                <td>${emp.employeeType === 'full-time' ? `<span class="role-badge">${formatRole(emp.position)}</span>` : '—'}</td>
                <td>
                    <div class="action-btns">
                        <button class="text-action-btn view-btn" onclick="EMP.view(${emp.id})">View</button>
                        ${canEdit ? `<button class="text-action-btn edit-btn" onclick="EMP.edit(${emp.id})">Edit</button>` : ''}
                        ${canDelete ? `<button class="text-action-btn delete-btn" onclick="EMP.remove(${emp.id})">Delete</button>` : ''}
                    </div>
                </td>
            </tr>`;
    }

    function updateSortIndicators() {
        $$('.sortable-header .sort-indicator').forEach(el => el.textContent = '');
        const activeHeader = $(`[data-sort="${sortColumn}"] .sort-indicator`);
        if (activeHeader) {
            activeHeader.textContent = sortAsc ? ' ▲' : ' ▼';
        }
    }

    function renderTable() {
        const list = getFilteredEmployees();
        const all = allEmployees;

        // update stats
        const ftAll = all.filter(e => e.employeeType === 'full-time');
        const ocAll = all.filter(e => e.employeeType === 'on-call');
        $('#statTotal').textContent = all.length;
        $('#statFullTime').textContent = ftAll.length;
        $('#statOnCall').textContent = ocAll.length;

        // record count
        recordCount.textContent = list.length + (list.length === 1 ? ' employee' : ' employees');

        // Render unified table
        if (list.length === 0) {
            employeeTable.style.display = 'none';
            noEmployees.style.display = 'block';
        } else {
            employeeTable.style.display = '';
            noEmployees.style.display = 'none';
            employeeBody.innerHTML = list.map(buildRowHtml).join('');
        }

        updateSortIndicators();
    }

    // ============================================
    // MODAL MANAGEMENT
    // ============================================
    function openModal(modal) { modal.classList.add('show'); }
    function closeModal(modal) { modal.classList.remove('show'); }

    function resetFileUpload() {
        const input = $('#empIdScan');
        input.value = '';
        $('#uploadPreview').style.display = 'none';
        $('#uploadPlaceholder').style.display = '';
        $('#previewImg').src = '';
    }

    function showFilePreview(src) {
        $('#previewImg').src = src;
        $('#uploadPreview').style.display = '';
        $('#uploadPlaceholder').style.display = 'none';
    }

    function openAddModal() {
        editingId = null;
        employeeModalTitle.textContent = 'Add On-Call Employee';
        employeeForm.reset();
        // Show email field for on-call add
        $('#empEmail').closest('.form-group').style.display = '';
        // Hide role dropdown for add modal (on-call only)
        const roleGroup = $('#empRoleGroup');
        if (roleGroup) roleGroup.style.display = 'none';
        resetFileUpload();
        openModal(employeeModal);
    }

    function openEditModal(id) {
        const emp = allEmployees.find(e => e.id === id);
        if (!emp) return;
        editingId = id;
        employeeModalTitle.textContent = emp.employeeType === 'full-time' ? 'Edit Employee' : 'Edit On-Call Employee';
        $('#empFirstName').value = emp.firstName || '';
        $('#empLastName').value = emp.lastName || '';
        // Email field only visible for on-call employees
        const emailGroup = $('#empEmail').closest('.form-group');
        if (emp.employeeType === 'on-call') {
            emailGroup.style.display = '';
            $('#empEmail').value = emp.email || '';
        } else {
            emailGroup.style.display = 'none';
            $('#empEmail').value = '';
        }
        $('#empAddress').value = emp.address || '';
        $('#empCellphone').value = emp.cellphone || '';
        $('#empSkill').value = emp.skill || '';

        // Role dropdown: show only for full-time employees (not business owner)
        const roleGroup = $('#empRoleGroup');
        if (roleGroup) {
            if (emp.employeeType === 'full-time' && (emp.position || '').toLowerCase().replace(/\s+/g, '_') !== 'business_owner') {
                roleGroup.style.display = '';
                const roleSelect = $('#empRole');
                // Map position to select value
                const currentRole = (emp.position || '').toLowerCase().replace(/\s+/g, '_');
                roleSelect.value = currentRole || '';
            } else {
                roleGroup.style.display = 'none';
                $('#empRole').value = '';
            }
        }

        // Show existing ID scan if present
        resetFileUpload();
        if (emp.idScanPath) {
            showFilePreview('/payroll/' + emp.idScanPath);
        }
        openModal(employeeModal);
    }

    function openViewModal(id) {
        const emp = allEmployees.find(e => e.id === id);
        if (!emp) return;

        const idScanHtml = emp.idScanPath
            ? `<div class="detail-item detail-item-full">
                   <span class="detail-label">Valid ID Scan</span>
                   <img class="detail-id-scan" src="/payroll/${esc(emp.idScanPath)}" alt="ID Scan" onclick="window.open(this.src)">
               </div>`
            : '';

        viewModalBody.innerHTML = `
            <div class="detail-grid">
                <div class="detail-avatar">
                    <div class="emp-avatar">${initials(emp.firstName, emp.lastName)}</div>
                    <div>
                        <div class="emp-fullname">${esc(emp.firstName)} ${esc(emp.lastName)}</div>
                        <span class="type-badge ${emp.employeeType}">${emp.employeeType === 'full-time' ? 'Full-Time' : 'On-Call'}</span>
                    </div>
                </div>
                <hr class="detail-divider">
                <div class="detail-item">
                    <span class="detail-label">Employee ID</span>
                    <span class="detail-value">${emp.id}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Email</span>
                    <span class="detail-value">${esc(emp.email || '—')}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Address</span>
                    <span class="detail-value">${esc(emp.address || '—')}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Cellphone Number</span>
                    <span class="detail-value">${esc(emp.cellphone || '—')}</span>
                </div>
                ${emp.employeeType === 'full-time' ? `<div class="detail-item">
                    <span class="detail-label">Role</span>
                    <span class="detail-value">${formatRole(emp.position)}</span>
                </div>` : ''}
                <div class="detail-item">
                    <span class="detail-label">Skill</span>
                    <span class="detail-value">${esc(emp.skill || '—')}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Added On</span>
                    <span class="detail-value">${formatDate(emp.createdAt)}</span>
                </div>
                ${idScanHtml}
            </div>
        `;

        $('#editFromViewBtn').dataset.id = id;
        openModal(viewModal);
    }

    // ============================================
    // FORM SUBMIT — ADD / UPDATE  (async)
    // ============================================
    employeeForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const firstName  = $('#empFirstName').value.trim();
        const lastName   = $('#empLastName').value.trim();
        const email      = $('#empEmail').value.trim();
        const address    = $('#empAddress').value.trim();
        const cellphone  = $('#empCellphone').value.trim();
        const skill      = $('#empSkill').value.trim();

        if (!firstName || !lastName || !address || !cellphone || !skill) {
            showToast('Please fill in all required fields', 'error');
            return;
        }

        // Build FormData (supports file upload)
        const fd = new FormData();
        fd.append('firstName',    firstName);
        fd.append('lastName',     lastName);
        fd.append('email',        email);
        fd.append('address',      address);
        fd.append('cellphone',    cellphone);
        fd.append('skill',        skill);
        // Preserve employee type when editing; default to on-call for new
        const editingEmp = editingId ? allEmployees.find(e => e.id === editingId) : null;
        fd.append('employeeType', editingEmp ? editingEmp.employeeType : 'on-call');

        // Include position/role if editing a full-time employee
        const roleSelect = $('#empRole');
        if (editingId && roleSelect && roleSelect.value) {
            fd.append('position', roleSelect.value.replace(/_/g, ' '));
        }

        // Attach ID scan file if selected
        const fileInput = $('#empIdScan');
        if (fileInput.files.length > 0) {
            fd.append('idScan', fileInput.files[0]);
        }

        try {
            if (editingId) {
                await apiFetch(`${API}/${editingId}`, { method: 'PUT', body: fd });
                showToast(`Employee ${firstName} ${lastName} updated`, 'success');
            } else {
                await apiFetch(API, { method: 'POST', body: fd });
                showToast(`Employee ${firstName} ${lastName} added`, 'success');
            }
            closeModal(employeeModal);
            await loadEmployees();
            renderTable();
        } catch (err) {
            showToast(err.message || 'Save failed', 'error');
        }
    });

    // ============================================
    // DELETE  (async)
    // ============================================
    function removeEmployee(id) {
        const emp = allEmployees.find(e => e.id === id);
        if (!emp) return;
        showConfirm(
            `Delete ${emp.firstName} ${emp.lastName}? This action cannot be undone.`,
            async function () {
                try {
                    await apiFetch(`${API}/${id}`, { method: 'DELETE' });
                    showToast(`Employee ${emp.firstName} ${emp.lastName} removed`, 'success');
                    await loadEmployees();
                    renderTable();
                } catch (err) {
                    showToast(err.message || 'Delete failed', 'error');
                }
            }
        );
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================

    // Add button
    $('#addEmployeeBtn').addEventListener('click', openAddModal);

    // Close modals
    $('#closeEmployeeModal').addEventListener('click', () => closeModal(employeeModal));
    $('#cancelEmployeeModal').addEventListener('click', () => closeModal(employeeModal));
    $('#closeViewModal').addEventListener('click', () => closeModal(viewModal));
    $('#closeViewBtn').addEventListener('click', () => closeModal(viewModal));
    $('#closeConfirmModal').addEventListener('click', () => closeModal($('#confirmModal')));
    $('#confirmCancel').addEventListener('click', () => closeModal($('#confirmModal')));

    // Confirm OK
    $('#confirmOk').addEventListener('click', () => {
        closeModal($('#confirmModal'));
        if (confirmCallback) { confirmCallback(); confirmCallback = null; }
    });

    // Edit from view
    $('#editFromViewBtn').addEventListener('click', function () {
        const id = parseInt(this.dataset.id);
        closeModal(viewModal);
        openEditModal(id);
    });

    // Close on overlay click
    $$('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', function (e) {
            if (e.target === this) closeModal(this);
        });
    });

    // --- File upload interactions ---
    const fileUploadArea = $('#fileUploadArea');
    const fileInput = $('#empIdScan');

    fileUploadArea.addEventListener('click', () => {
        if ($('#uploadPreview').style.display === 'none' || !$('#uploadPreview').style.display) {
            fileInput.click();
        }
    });

    fileUploadArea.addEventListener('dragover', (e) => { e.preventDefault(); fileUploadArea.classList.add('dragover'); });
    fileUploadArea.addEventListener('dragleave', () => fileUploadArea.classList.remove('dragover'));
    fileUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        fileUploadArea.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            fileInput.files = e.dataTransfer.files;
            previewSelectedFile();
        }
    });

    fileInput.addEventListener('change', previewSelectedFile);

    function previewSelectedFile() {
        if (fileInput.files.length > 0) {
            const reader = new FileReader();
            reader.onload = (e) => showFilePreview(e.target.result);
            reader.readAsDataURL(fileInput.files[0]);
        }
    }

    $('#removeFileBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        resetFileUpload();
    });

    // Filters
    searchInput.addEventListener('input', renderTable);

    // Type filter buttons
    $$('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            $$('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            activeFilter = this.dataset.filter;
            renderTable();
        });
    });

    // Sortable headers
    $$('.sortable-header').forEach(th => {
        th.addEventListener('click', function () {
            const col = this.dataset.sort;
            if (sortColumn === col) {
                sortAsc = !sortAsc;
            } else {
                sortColumn = col;
                sortAsc = true;
            }
            renderTable();
        });
    });

    // Sidebar toggle
    const menuToggle = $('#menuToggle');
    const sidebar = $('#sidebar');
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => sidebar.classList.toggle('open'));
    }

    // Logout (auth.js handles sidebar + user info display)
    const logoutBtn = $('#logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('userData');
            localStorage.removeItem('sessionToken');
            window.location.href = 'index.html';
        });
    }

    // ============================================
    // PUBLIC API (for inline onclick)
    // ============================================
    window.EMP = {
        view: openViewModal,
        edit: openEditModal,
        remove: removeEmployee
    };

    // ============================================
    // INIT — load from database
    // ============================================
    (async function init() {
        await loadEmployees();
        renderTable();
    })();

})();
