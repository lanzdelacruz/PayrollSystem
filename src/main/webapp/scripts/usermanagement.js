// User Management Page Logic
// Only accessible by business_owner role

document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    /** Build headers with audit user info */
    function auditHeaders() {
        const h = { 'Content-Type': 'application/json' };
        try {
            const ud = JSON.parse(localStorage.getItem('userData') || '{}');
            if (ud.userId) h['X-User-Id'] = String(ud.userId);
            if (ud.firstName || ud.lastName) h['X-User-Name'] = ((ud.firstName || '') + ' ' + (ud.lastName || '')).trim();
            if (ud.userRole) h['X-User-Role'] = ud.userRole;
        } catch (e) { /* ignore */ }
        return h;
    }

    function showNotice(message, options = {}) {
        if (window.AppNotice && typeof window.AppNotice.show === 'function') {
            window.AppNotice.show(message, {
                title: options.title || 'Approvals',
                buttonText: options.buttonText || 'OK',
                onConfirm: options.onConfirm
            });
            return;
        }

        alert(message);
        if (typeof options.onConfirm === 'function') options.onConfirm();
    }

    function showConfirm(message, onConfirm) {
        if (window.AppNotice && typeof window.AppNotice.confirm === 'function') {
            window.AppNotice.confirm(message, {
                title: 'Confirm Action',
                confirmText: 'Yes, Continue',
                cancelText: 'Cancel',
                onConfirm
            });
            return;
        }

        if (confirm(message) && typeof onConfirm === 'function') {
            onConfirm();
        }
    }

    // ── DOM refs ──
    const tableBody    = document.getElementById('usersTableBody');
    const searchInput  = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    const logoutBtn    = document.getElementById('logoutBtn');
    const menuToggle   = document.getElementById('menuToggle');
    const sidebar      = document.getElementById('sidebar');

    // Modal refs
    const roleModal       = document.getElementById('roleModal');
    const closeRoleModal  = document.getElementById('closeRoleModal');
    const cancelRoleModal = document.getElementById('cancelRoleModal');
    const confirmApprove  = document.getElementById('confirmApprove');
    const assignRoleSelect = document.getElementById('assignRole');
    const roleModalUser   = document.getElementById('roleModalUser');
    const roleModalTitle  = document.getElementById('roleModalTitle');

    let allUsers = [];
    let selectedUserId = null;

    // ── Sidebar toggle ──
    if (menuToggle) {
        menuToggle.addEventListener('click', () => sidebar.classList.toggle('collapsed'));
    }

    // ── Logout ──
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('sessionToken');
            localStorage.removeItem('userData');
            window.location.href = 'login.html';
        });
    }

    // ── Fetch all users ──
    function loadUsers() {
        fetch('/payroll/api/users')
            .then(r => r.json())
            .then(data => {
                allUsers = data;
                updateStats();
                renderTable();
            })
            .catch(err => {
                console.error('Error loading users:', err);
                tableBody.innerHTML = '<tr><td colspan="6" class="empty-state">Failed to load users.</td></tr>';
            });
    }

    // ── Stats ──
    function updateStats() {
        document.getElementById('statTotal').textContent   = allUsers.length;
        document.getElementById('statPending').textContent  = allUsers.filter(u => u.status === 'pending').length;
        document.getElementById('statApproved').textContent = allUsers.filter(u => u.status === 'approved').length;
        document.getElementById('statRejected').textContent = allUsers.filter(u => u.status === 'rejected').length;
    }

    // ── Render ──
    function renderTable() {
        const search = (searchInput.value || '').toLowerCase();
        const status = statusFilter.value;

        const filtered = allUsers.filter(u => {
            const name = ((u.firstName || '') + ' ' + (u.lastName || '')).toLowerCase();
            const email = (u.email || '').toLowerCase();
            const matchSearch = !search || name.includes(search) || email.includes(search);
            const matchStatus = !status || u.status === status;
            return matchSearch && matchStatus;
        });

        if (filtered.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="empty-state">No users found.</td></tr>';
            return;
        }

        tableBody.innerHTML = filtered.map(u => {
            const name = ((u.firstName || '') + ' ' + (u.lastName || '')).trim() || u.username;
            const roleBadge = formatRole(u.userRole);
            const statusBadge = formatStatus(u.status);
            const date = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—';
            const actions = buildActions(u);

            return `<tr>
                <td><strong>${escapeHtml(name)}</strong></td>
                <td>${escapeHtml(u.email)}</td>
                <td>${roleBadge}</td>
                <td>${statusBadge}</td>
                <td>${date}</td>
                <td class="actions-cell">${actions}</td>
            </tr>`;
        }).join('');
    }

    function formatRole(role) {
        const labels = {
            business_owner: 'Business Owner',
            operations_manager: 'Operations Manager',
            finance_staff: 'Finance Staff',
            admin_assistant: 'Admin Assistant',
            fulltime_employee: 'Full-Time Employee',
            pending: 'Not Assigned'
        };
        return `<span class="role-badge role-${role || 'pending'}">${labels[role] || role || 'Not Assigned'}</span>`;
    }

    function formatStatus(status) {
        const classes = { pending: 'status-pending', approved: 'status-approved', rejected: 'status-rejected' };
        const labels = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' };
        return `<span class="status-badge ${classes[status] || ''}">${labels[status] || status}</span>`;
    }

    function buildActions(user) {
        const btns = [];
        if (user.userRole === 'business_owner') return '—';
        if (user.status === 'pending') {
            btns.push(`<button class="btn btn-sm btn-approve" onclick="openApproveModal(${user.id}, '${escapeHtml((user.firstName || '') + ' ' + (user.lastName || ''))}')">Approve</button>`);
            btns.push(`<button class="btn btn-sm btn-reject" onclick="rejectUser(${user.id})">Reject</button>`);
        } else if (user.status === 'approved') {
            // View-only — role changes are done via Employee Management
            return '—';
        } else if (user.status === 'rejected') {
            btns.push(`<button class="btn btn-sm btn-approve" onclick="openApproveModal(${user.id}, '${escapeHtml((user.firstName || '') + ' ' + (user.lastName || ''))}')">Approve</button>`);
        }
        return btns.join(' ');
    }

    // ── Modal helpers ──
    window.openApproveModal = function (userId, name) {
        selectedUserId = userId;
        roleModalTitle.textContent = 'Approve & Assign Role';
        roleModalUser.textContent = `Approve user: ${name}`;
        assignRoleSelect.value = '';
        confirmApprove.textContent = 'Approve & Assign';
        roleModal.classList.add('show');
    };

    window.openChangeRoleModal = function (userId, name, currentRole) {
        selectedUserId = userId;
        roleModalTitle.textContent = 'Change User Role';
        roleModalUser.textContent = `Change role for: ${name}`;
        assignRoleSelect.value = currentRole || '';
        confirmApprove.textContent = 'Save Role';
        roleModal.classList.add('show');
    };

    function closeModal() {
        roleModal.classList.remove('show');
        selectedUserId = null;
    }

    closeRoleModal.addEventListener('click', closeModal);
    cancelRoleModal.addEventListener('click', closeModal);
    roleModal.addEventListener('click', e => { if (e.target === roleModal) closeModal(); });

    // ── Approve / Change Role ──
    confirmApprove.addEventListener('click', function () {
        const role = assignRoleSelect.value;
        if (!role) {
            showNotice('Please select a role.');
            return;
        }
        if (!selectedUserId) return;

        fetch('/payroll/api/users', {
            method: 'PUT',
            headers: auditHeaders(),
            body: JSON.stringify({ userId: selectedUserId, userRole: role, status: 'approved' })
        })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                showNotice(data.message || 'User updated successfully.', {
                    title: 'Approval Updated'
                });
                closeModal();
                loadUsers();
            } else {
                showNotice(data.message || 'Failed to update user.', {
                    title: 'Update Failed'
                });
            }
        })
        .catch(err => {
            console.error('Error:', err);
            showNotice('An error occurred.', {
                title: 'Request Failed'
            });
        });
    });

    // ── Reject ──
    window.rejectUser = function (userId) {
        showConfirm('Are you sure you want to reject this user?', function () {
            fetch('/payroll/api/users', {
                method: 'PUT',
                headers: auditHeaders(),
                body: JSON.stringify({ userId: userId, status: 'rejected' })
            })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    showNotice('User rejected.', {
                        title: 'Rejected'
                    });
                    loadUsers();
                } else {
                    showNotice(data.message || 'Failed to reject user.', {
                        title: 'Reject Failed'
                    });
                }
            })
            .catch(err => {
                console.error('Error:', err);
                showNotice('An error occurred.', {
                    title: 'Request Failed'
                });
            });
        });
    };

    // ── Filters ──
    searchInput.addEventListener('input', renderTable);
    statusFilter.addEventListener('change', renderTable);

    // ── Escape helper ──
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }

    // ── Init ──
    loadUsers();
});
