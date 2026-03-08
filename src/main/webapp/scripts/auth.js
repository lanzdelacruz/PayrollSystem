/* ============================================
   auth.js — Role-Based Access Control Module
   Red Damien Entertainment Payroll System
   
   Include this script BEFORE page-specific scripts.
   It checks login state, enforces page access,
   builds the sidebar, and exposes window.AUTH.
   ============================================ */

(function () {
    'use strict';

    // ============================================
    //  ROLE DEFINITIONS
    // ============================================
    //  Roles stored in DB / localStorage as:
    //    business_owner, operations_manager,
    //    finance_staff, admin_assistant, fulltime_employee
    //
    //  Pages: dashboard, employees, attendance, payroll, payslips, reports

    const ROLE_ACCESS = {
        business_owner: {
            pages: ['dashboard', 'employees', 'attendance', 'payroll', 'payslips', 'reports', 'approvals', 'audit-log'],
            attendanceTabs: ['event-attendance', 'fulltime-attendance', 'monthly-summary'],
            label: 'Business Owner'
        },
        operations_manager: {
            pages: ['dashboard', 'attendance'],
            attendanceTabs: ['event-attendance', 'fulltime-attendance', 'monthly-summary'],
            label: 'Operations Manager'
        },
        finance_staff: {
            pages: ['dashboard', 'attendance', 'payroll', 'payslips', 'reports'],
            attendanceTabs: ['event-attendance', 'fulltime-attendance', 'monthly-summary'],
            label: 'Finance Staff'
        },
        admin_assistant: {
            pages: ['dashboard', 'employees', 'attendance', 'payroll', 'payslips', 'reports', 'audit-log'],
            attendanceTabs: ['event-attendance', 'fulltime-attendance', 'monthly-summary'],
            label: 'Admin Assistant'
        },
        fulltime_employee: {
            pages: ['dashboard', 'attendance'],
            attendanceTabs: ['fulltime-attendance'],
            label: 'Full-Time Employee'
        }
    };

    // Map page filenames → page keys
    const PAGE_MAP = {
        'dashboard.html': 'dashboard',
        'employees.html': 'employees',
        'attendance.html': 'attendance',
        'payroll.html': 'payroll',
        'payslips.html': 'payslips',
        'reports.html': 'reports',
        'approvals.html': 'approvals',
        'usermanagement.html': 'approvals',
        'audit-log.html': 'audit-log'
    };

    // All sidebar items in order
    const SIDEBAR_ITEMS = [
        { key: 'dashboard',  icon: '📊', label: 'Dashboard',  href: 'dashboard.html'  },
        { key: 'employees',  icon: '👥', label: 'Employees',  href: 'employees.html'  },
        { key: 'attendance', icon: '📋', label: 'Attendance', href: 'attendance.html' },
        { key: 'payroll',    icon: '💰', label: 'Payroll',    href: '#'               },
        { key: 'payslips',   icon: '📄', label: 'Payslips',   href: '#'               },
        { key: 'reports',    icon: '📈', label: 'Reports',    href: '#'               },
        { key: 'approvals', icon: '✅', label: 'Approvals', href: 'approvals.html' },
        { key: 'audit-log', icon: '📝', label: 'Audit Log', href: 'audit-log.html' }
    ];

    // ============================================
    //  GET CURRENT USER
    // ============================================
    function getUserData() {
        try {
            return JSON.parse(localStorage.getItem('userData')) || null;
        } catch { return null; }
    }

    function getUserRole() {
        const u = getUserData();
        return u ? (u.userRole || '').toLowerCase() : '';
    }

    function getRoleConfig(role) {
        return ROLE_ACCESS[role] || null;
    }

    // ============================================
    //  PAGE-LEVEL ACCESS CHECK
    // ============================================
    function currentPageKey() {
        const path = window.location.pathname.split('/').pop() || 'dashboard.html';
        return PAGE_MAP[path] || null;
    }

    function enforceAccess() {
        const user = getUserData();
        if (!user) {
            window.location.href = 'login.html';
            return false;
        }
        const role = getUserRole();
        const cfg = getRoleConfig(role);
        if (!cfg) {
            alert('Unknown role. Please contact your administrator.');
            window.location.href = 'login.html';
            return false;
        }
        const page = currentPageKey();
        if (page && !cfg.pages.includes(page)) {
            alert('You do not have access to this page.');
            window.location.href = 'dashboard.html';
            return false;
        }
        return true;
    }

    // ============================================
    //  BUILD SIDEBAR
    // ============================================
    function buildSidebar() {
        const role = getUserRole();
        const cfg = getRoleConfig(role);
        if (!cfg) return;

        const nav = document.querySelector('.sidebar-nav');
        if (!nav) return;

        const page = currentPageKey();
        nav.innerHTML = '';

        SIDEBAR_ITEMS.forEach(item => {
            if (!cfg.pages.includes(item.key)) return; // skip items not in role
            const a = document.createElement('a');
            a.href = item.href;
            a.className = 'nav-item' + (item.key === page ? ' active' : '');
            a.innerHTML = `<span class="nav-icon">${item.icon}</span><span>${item.label}</span>`;
            nav.appendChild(a);
        });
    }

    // ============================================
    //  SET USER INFO IN TOP BAR
    // ============================================
    function setTopBarInfo() {
        const user = getUserData();
        if (!user) return;
        const role = getUserRole();
        const cfg = getRoleConfig(role);

        const nameEl = document.getElementById('currentUser');
        const roleEl = document.getElementById('currentRole');
        if (nameEl) nameEl.textContent = ((user.firstName || '') + ' ' + (user.lastName || '')).trim() || 'User';
        if (roleEl) roleEl.textContent = cfg ? cfg.label : role;
    }

    // ============================================
    //  FILTER ATTENDANCE TABS BY ROLE
    // ============================================
    function filterAttendanceTabs() {
        const role = getUserRole();
        const cfg = getRoleConfig(role);
        if (!cfg) return;

        const allowedTabs = cfg.attendanceTabs;

        // Hide tab buttons not in allowedTabs
        document.querySelectorAll('.tab[data-tab]').forEach(btn => {
            const tabKey = btn.getAttribute('data-tab');
            if (!allowedTabs.includes(tabKey)) {
                btn.style.display = 'none';
                btn.classList.remove('active');
            }
        });

        // Hide tab content not in allowedTabs
        document.querySelectorAll('.tab-content').forEach(section => {
            if (!allowedTabs.includes(section.id)) {
                section.style.display = 'none';
                section.classList.remove('active');
            }
        });

        // Make sure at least one allowed tab is active
        const activeTabs = document.querySelectorAll('.tab[data-tab].active');
        let hasActive = false;
        activeTabs.forEach(t => {
            if (allowedTabs.includes(t.getAttribute('data-tab'))) hasActive = true;
        });

        if (!hasActive && allowedTabs.length > 0) {
            const firstTab = document.querySelector(`.tab[data-tab="${allowedTabs[0]}"]`);
            const firstContent = document.getElementById(allowedTabs[0]);
            if (firstTab) firstTab.classList.add('active');
            if (firstContent) {
                firstContent.style.display = '';
                firstContent.classList.add('active');
            }
        }
    }

    // ============================================
    //  FILTER QUICK LINKS ON DASHBOARD
    // ============================================

    // ============================================
    //  BIND LOGOUT + SIDEBAR TOGGLE
    // ============================================
    function bindLogout() {
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function () {
                localStorage.removeItem('userData');
                localStorage.removeItem('sessionToken');
                window.location.href = 'index.html';
            });
        }

        const menuToggle = document.getElementById('menuToggle');
        const sidebar = document.getElementById('sidebar');
        if (menuToggle && sidebar) {
            menuToggle.addEventListener('click', () => sidebar.classList.toggle('open'));
        }
    }

    function filterQuickLinks() {
        const role = getUserRole();
        const cfg = getRoleConfig(role);
        if (!cfg) return;

        document.querySelectorAll('.quick-link').forEach(link => {
            const href = (link.getAttribute('href') || '').split('/').pop();
            const key = PAGE_MAP[href];
            if (key && !cfg.pages.includes(key)) {
                link.style.display = 'none';
            }
        });
    }

    // ============================================
    //  PUBLIC API
    // ============================================
    window.AUTH = {
        getUserData,
        getUserRole,
        getRoleConfig,
        currentPageKey,
        enforceAccess,
        buildSidebar,
        setTopBarInfo,
        filterAttendanceTabs,
        filterQuickLinks,
        ROLE_ACCESS,

        /** Call this on every page load */
        init() {
            if (!enforceAccess()) return false;
            buildSidebar();
            setTopBarInfo();
            bindLogout();
            return true;
        },

        /** Is the user a full-time employee (most restricted)? */
        isEmployee() { return getUserRole() === 'fulltime_employee'; },

        /** Is the user admin assistant (full-time attendance only)? */
        isAdminAssistant() { return getUserRole() === 'admin_assistant'; },

        /** Can this role manage employees? */
        canManageEmployees() {
            const cfg = getRoleConfig(getUserRole());
            return cfg ? cfg.pages.includes('employees') : false;
        },

        /** Can this role see event attendance? */
        canSeeEventAttendance() {
            const cfg = getRoleConfig(getUserRole());
            return cfg ? cfg.attendanceTabs.includes('event-attendance') : false;
        },

        /** Can this role see full-time attendance? */
        canSeeFullTimeAttendance() {
            const cfg = getRoleConfig(getUserRole());
            return cfg ? cfg.attendanceTabs.includes('fulltime-attendance') : false;
        },

        /** Get the employee ID linked to this user (for full-time employee role) */
        getLinkedEmployeeId() {
            const u = getUserData();
            return u ? (u.employeeId || null) : null;
        }
    };

    // Auto-init when DOM is ready (pages can also call AUTH.init() manually)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => window.AUTH.init());
    } else {
        window.AUTH.init();
    }

})();
