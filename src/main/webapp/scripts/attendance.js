// ============================================
// ATTENDANCE MODULE - Full JavaScript
// Red Damien Entertainment Payroll System
// Database-backed via REST API
// ============================================

document.addEventListener('DOMContentLoaded', function () {

    // ============================================
    //  API HELPERS
    // ============================================
    const API_EMPLOYEES = '/payroll/api/employees';
    const API_EVENTS    = '/payroll/api/events';
    const API_EVENT_ATT = '/payroll/api/event-attendance';
    const API_TIMELOGS  = '/payroll/api/timelogs';

    async function apiFetch(url, options = {}) {
        const resp = await fetch(url, {
            headers: { 'Content-Type': 'application/json' },
            ...options
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'Request failed');
        return data;
    }

    // ============================================
    //  IN-MEMORY CACHES (loaded from DB)
    // ============================================
    let cachedEmployees = [];
    let cachedEvents = [];
    let cachedEventAttendance = [];
    let allEventAttendance = [];
    let cachedTimeLogs = [];

    async function loadEmployees() {
        try { cachedEmployees = await apiFetch(API_EMPLOYEES); }
        catch(e) { console.error('Load employees failed:', e); cachedEmployees = []; }
    }
    async function loadEvents() {
        try {
            // Finance staff only sees submitted events
            const role = window.AUTH ? AUTH.getUserRole() : '';
            const isFinance = (role === 'finance_staff');
            const url = isFinance ? `${API_EVENTS}?submittedOnly=true` : API_EVENTS;
            cachedEvents = await apiFetch(url);
        } catch(e) { console.error('Load events failed:', e); cachedEvents = []; }
    }
    async function loadEventAttendance(eventId) {
        try {
            const url = eventId ? `${API_EVENT_ATT}?eventId=${eventId}` : API_EVENT_ATT;
            cachedEventAttendance = await apiFetch(url);
        } catch(e) { console.error('Load event attendance failed:', e); cachedEventAttendance = []; }
    }
    async function loadTimeLogs(params = {}) {
        try {
            const qs = new URLSearchParams(params).toString();
            cachedTimeLogs = await apiFetch(qs ? `${API_TIMELOGS}?${qs}` : API_TIMELOGS);
        } catch(e) { console.error('Load time logs failed:', e); cachedTimeLogs = []; }
    }

    // Helper lookups on cache
    function getEmployeeById(id) { return cachedEmployees.find(e => e.id === id) || null; }
    function getEventById(id)    { return cachedEvents.find(e => e.id === id) || null; }

    // ============================================
    //  DOM REFERENCES
    // ============================================
    const $ = id => document.getElementById(id);

    // Sidebar
    const sidebar = $('sidebar');
    const menuToggle = $('menuToggle');
    const logoutBtn = $('logoutBtn');

    // Tabs
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    // Event Attendance Tab
    const eventsListView = $('eventsListView');
    const eventDetailView = $('eventDetailView');
    const eventsBody = $('eventsBody');
    const eventsTable = $('eventsTable');
    const noEvents = $('noEvents');
    const eventCount = $('eventCount');
    const addEventBtn = $('addEventBtn');
    const eventDetailPanel = $('eventDetailPanel');
    const eventAttendanceCard = $('eventAttendanceCard');
    const closeDetailBtn = $('closeDetailBtn');
    const submitToFinanceBtn = $('submitToFinanceBtn');
    const submittedBadge = $('submittedBadge');
    const addCrewAttendanceBtn = $('addCrewAttendanceBtn');
    const eventAttendanceBody = $('eventAttendanceBody');
    const noEventAttendance = $('noEventAttendance');

    // Full-Time Tab
    const ftEmployeeSelect = $('ftEmployeeSelect');
    const ftDateFilter = $('ftDateFilter');
    const addTimeLogBtn = $('addTimeLogBtn');
    const clockInBtn = $('clockInBtn');
    const clockOutBtn = $('clockOutBtn');
    const submitFtToFinanceBtn = $('submitFtToFinanceBtn');
    const timeLogBody = $('timeLogBody');
    const timeLogCount = $('timeLogCount');
    const noTimeLogs = $('noTimeLogs');

    // Summary Tab
    const summaryMonth = $('summaryMonth');
    const summaryYear = $('summaryYear');
    const generateSummaryBtn = $('generateSummaryBtn');
    const summaryBody = $('summaryBody');
    const noSummary = $('noSummary');

    // Event Modal
    const eventModal = $('eventModal');
    const eventForm = $('eventForm');
    const eventModalTitle = $('eventModalTitle');

    // Crew Modal
    const crewModal = $('crewModal');
    const crewForm = $('crewForm');
    const crewModalTitle = $('crewModalTitle');

    // TimeLog Modal
    const timeLogModal = $('timeLogModal');
    const timeLogForm = $('timeLogForm');
    const timeLogModalTitle = $('timeLogModalTitle');

    // Confirm Modal
    const confirmModal = $('confirmModal');
    const confirmMessage = $('confirmMessage');
    const confirmOk = $('confirmOk');
    const confirmCancel = $('confirmCancel');

    // Toast
    const toast = $('toast');
    const toastIcon = $('toastIcon');
    const toastMessage = $('toastMessage');

    // Tracking state
    let editingEventId = null;
    let editingCrewId = null;
    let editingTimeLogId = null;
    let selectedEventId = null;
    let confirmCallback = null;

    // ============================================
    //  UTILITY FUNCTIONS
    // ============================================
    function showToast(message, type = 'success') {
        toastIcon.textContent = type === 'success' ? '✅' : type === 'error' ? '❌' : '⚠️';
        toastMessage.textContent = message;
        toast.className = 'toast show ' + type;
        setTimeout(() => { toast.className = 'toast'; }, 3000);
    }

    function showConfirm(message, callback, okText = 'Confirm') {
        confirmMessage.textContent = message;
        confirmCallback = callback;
        confirmOk.textContent = okText;
        if (okText === 'Delete') {
            confirmOk.className = 'btn btn-danger';
        } else {
            confirmOk.className = 'btn btn-primary';
        }
        confirmModal.classList.add('show');
    }

    function hideConfirm() {
        confirmModal.classList.remove('show');
        confirmCallback = null;
    }

    function openModal(modal)  { modal.classList.add('show'); }
    function closeModal(modal) { modal.classList.remove('show'); }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    function formatTime(timeStr) {
        if (!timeStr) return '—';
        const [h, m] = timeStr.split(':');
        const hour = parseInt(h);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const h12 = hour % 12 || 12;
        return `${h12}:${m} ${ampm}`;
    }

    function calcHours(timeIn, timeOut) {
        if (!timeIn || !timeOut) return 0;
        const [hIn, mIn] = timeIn.split(':').map(Number);
        const [hOut, mOut] = timeOut.split(':').map(Number);
        let mins = (hOut * 60 + mOut) - (hIn * 60 + mIn);
        if (mins < 0) mins += 24 * 60; // overnight
        return Math.round(mins / 60 * 100) / 100;
    }

    function formatPosition(pos) {
        if (!pos) return '—';
        return pos
            .replace(/_/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase())
            .replace(/Fulltime/i, 'Full-Time')
            .replace(/On Call/i, 'On-Call');
    }

    function getTimeDiffStatus(timeIn) {
        if (!timeIn) return 'On Time';
        const [h] = timeIn.split(':').map(Number);
        // Assume 8 AM is start time for full-time employees
        return h > 8 ? 'Late' : (h === 8 ? 'On Time' : 'On Time');
    }

    function formatCurrency(amount) {
        return '₱' + Number(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
    }

    /** Get user context for audit logging */
    function getUserContext() {
        const u = window.AUTH ? AUTH.getUserData() : null;
        if (!u) return {};
        return { _userId: u.userId || u.id || 0, _userName: (u.firstName || '') + ' ' + (u.lastName || ''), _userRole: u.userRole || '' };
    }

    function empName(emp) {
        if (!emp) return 'Unknown';
        return emp.firstName + ' ' + emp.lastName;
    }

    function statusBadge(status) {
        const cls = {
            'Present': 'status-present',
            'Late': 'status-late',
            'Absent': 'status-absent',
            'On Time': 'status-on-time'
        }[status] || 'status-present';
        return `<span class="status-badge ${cls}">${status}</span>`;
    }

    // ============================================
    //  SIDEBAR & NAVIGATION
    // ============================================
    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
            if (!sidebar.contains(e.target) && e.target !== menuToggle) {
                sidebar.classList.remove('open');
            }
        }
    });

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('userData');
        localStorage.removeItem('sessionToken');
        window.location.href = 'index.html';
    });

    // ============================================
    //  TAB SWITCHING
    // ============================================
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(tc => tc.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });

    // ============================================
    //  POPULATE DROPDOWNS
    // ============================================
    function renderEventsTable() {
        const searchTerm = ($('eventSearchInput') ? $('eventSearchInput').value : '').toLowerCase().trim();
        const events = cachedEvents.filter(evt => {
            if (!searchTerm) return true;
            return (evt.eventName || '').toLowerCase().includes(searchTerm) ||
                   (evt.eventVenue || '').toLowerCase().includes(searchTerm) ||
                   (evt.eventDate || '').toLowerCase().includes(searchTerm);
        });
        eventsBody.innerHTML = '';

        if (events.length === 0) {
            noEvents.style.display = 'flex';
            eventsTable.style.display = 'none';
            eventCount.textContent = '0 events';
            return;
        }

        noEvents.style.display = 'none';
        eventsTable.style.display = 'table';
        eventCount.textContent = `${events.length} event${events.length !== 1 ? 's' : ''}`;

        events.forEach(evt => {
            const crewCount = allEventAttendance.filter(a => a.eventId === evt.id).length;
            const statusHtml = evt.submitted
                ? '<span class="status-badge status-approved">Submitted</span>'
                : '<span class="status-badge status-pending">Pending</span>';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${evt.eventName}</strong></td>
                <td>${evt.eventVenue || '—'}</td>
                <td>${formatDate(evt.eventDate)}</td>
                <td>${crewCount}</td>
                <td>${statusHtml}</td>
                <td>
                    <div class="action-btns">
                        <button class="text-action-btn view-btn view-event-btn" data-id="${evt.id}">View</button>
                    </div>
                </td>
            `;
            eventsBody.appendChild(tr);
        });

        // Attach view handlers
        document.querySelectorAll('.view-event-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                selectedEventId = parseInt(btn.dataset.id);
                await loadEventDetails(selectedEventId);
            });
        });
    }

    async function reloadEventData() {
        await loadEvents();
        try { allEventAttendance = await apiFetch(API_EVENT_ATT); } catch(e) { allEventAttendance = []; }
        renderEventsTable();
    }

    function populateEmployeeSelects() {
        const employees = cachedEmployees;
        const ftEmployees = employees.filter(e => e.employeeType === 'full-time');
        const isEmpRole = window.AUTH && AUTH.isEmployee();
        const myEmpId = isEmpRole && window.AUTH ? AUTH.getLinkedEmployeeId() : null;

        // Full-time employee filter
        ftEmployeeSelect.innerHTML = '<option value="">— All Employees —</option>';
        ftEmployees.forEach(e => {
            ftEmployeeSelect.innerHTML += `<option value="${e.id}">${empName(e)}</option>`;
        });

        // If fulltime_employee role, lock selector to own ID
        if (isEmpRole && myEmpId) {
            ftEmployeeSelect.value = myEmpId;
            ftEmployeeSelect.disabled = true;
        }

        // Time log employee dropdown
        $('timeLogEmployee').innerHTML = '<option value="">— Select Employee —</option>';
        ftEmployees.forEach(e => {
            $('timeLogEmployee').innerHTML += `<option value="${e.id}">${empName(e)} (${formatPosition(e.position)})</option>`;
        });

        // If fulltime_employee role, auto-select in time log dropdown too
        if (isEmpRole && myEmpId) {
            $('timeLogEmployee').value = myEmpId;
        }

        // Crew member dropdown (on-call employees only)
        const oncallEmployees = employees.filter(e => e.employeeType === 'on-call' && e.status === 'active');
        $('crewMemberSelect').innerHTML = '<option value="">— Select On-Call Employee —</option>';
        oncallEmployees.forEach(e => {
            $('crewMemberSelect').innerHTML += `<option value="${e.id}">${empName(e)}</option>`;
        });
    }

    // ============================================
    //  EVENT MANAGEMENT (CRUD)
    // ============================================

    // Event search filter
    const eventSearchInput = $('eventSearchInput');
    if (eventSearchInput) {
        eventSearchInput.addEventListener('input', () => renderEventsTable());
    }

    // Open Add Event Modal
    addEventBtn.addEventListener('click', () => {
        editingEventId = null;
        eventModalTitle.textContent = 'Add New Event';
        eventForm.reset();
        openModal(eventModal);
    });

    // Save Event Form
    eventForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            eventName: $('eventNameInput').value.trim(),
            eventDate: $('eventDateInput').value,
            eventVenue: $('eventVenueInput').value.trim(),
            eventClient: '',
            contractPrice: 0
        };

        try {
            if (editingEventId) {
                await apiFetch(`${API_EVENTS}/${editingEventId}`, { method: 'PUT', body: JSON.stringify(data) });
                showToast('Event updated successfully');
            } else {
                const newEvt = await apiFetch(API_EVENTS, { method: 'POST', body: JSON.stringify(data) });
                selectedEventId = newEvt.id;
                showToast('Event created successfully');
            }

            closeModal(eventModal);
            await reloadEventData();
            if (selectedEventId) {
                await loadEventDetails(selectedEventId);
            }
        } catch(err) { showToast(err.message || 'Save failed', 'error'); }
    });

    // Cancel / close event modal
    $('cancelEventModal').addEventListener('click', () => closeModal(eventModal));
    $('closeEventModal').addEventListener('click', () => closeModal(eventModal));

    // Close detail panel — go back to events list
    closeDetailBtn.addEventListener('click', () => {
        selectedEventId = null;
        eventDetailView.style.display = 'none';
        eventsListView.style.display = '';
    });

    async function loadEventDetails(eventId) {
        const evt = getEventById(eventId);
        if (!evt) return;

        $('eventDetailTitle').textContent = evt.eventName;
        $('eventVenue').textContent = evt.eventVenue || '—';
        $('eventDate').textContent = formatDate(evt.eventDate);

        // Show/hide submit button and submitted badge based on role and state
        const role = window.AUTH ? AUTH.getUserRole() : '';
        const canSubmit = (role === 'operations_manager' || role === 'business_owner');

        if (submittedBadge) {
            submittedBadge.style.display = evt.submitted ? '' : 'none';
        }
        if (submitToFinanceBtn) {
            submitToFinanceBtn.style.display = (canSubmit && !evt.submitted) ? '' : 'none';
        }

        // Show/hide Edit Event and Delete Event buttons
        const isOpsManager = (role === 'operations_manager');
        const canEditEvent = (role === 'operations_manager' || role === 'business_owner' || role === 'admin_assistant') && !(isOpsManager && evt.submitted);
        const editEvtBtn = $('editEventDetailBtn');
        const deleteEvtBtn = $('deleteEventDetailBtn');
        if (editEvtBtn) editEvtBtn.style.display = canEditEvent ? '' : 'none';
        if (deleteEvtBtn) deleteEvtBtn.style.display = canEditEvent ? '' : 'none';

        // Switch from list view to detail view
        eventsListView.style.display = 'none';
        eventDetailView.style.display = '';
        eventAttendanceCard.style.display = 'block';

        await renderEventAttendance(eventId);

        // Update crew count in detail panel
        const crewCount = cachedEventAttendance.length;
        $('eventCrewCount').textContent = crewCount;
    }

    // Submit to Finance handler
    if (submitToFinanceBtn) {
        submitToFinanceBtn.addEventListener('click', () => {
            if (!selectedEventId) return;
            showConfirm('Submit this event attendance to finance? This cannot be undone.', async () => {
                try {
                    await apiFetch(`${API_EVENTS}/${selectedEventId}/submit`, { method: 'PUT' });
                    showToast('Attendance submitted to finance successfully');
                    // Update local cache
                    const evt = getEventById(selectedEventId);
                    if (evt) evt.submitted = true;
                    // Refresh the table and detail view
                    renderEventsTable();
                    await loadEventDetails(selectedEventId);
                } catch (err) {
                    showToast(err.message || 'Submit failed', 'error');
                }
            });
        });
    }

    // Edit Event from detail view
    if ($('editEventDetailBtn')) {
        $('editEventDetailBtn').addEventListener('click', () => {
            if (!selectedEventId) return;
            const evt = getEventById(selectedEventId);
            if (!evt) return;
            editingEventId = selectedEventId;
            eventModalTitle.textContent = 'Edit Event';
            $('eventNameInput').value = evt.eventName;
            $('eventVenueInput').value = evt.eventVenue || '';
            $('eventDateInput').value = evt.eventDate;
            openModal(eventModal);
        });
    }

    // Delete Event from detail view
    if ($('deleteEventDetailBtn')) {
        $('deleteEventDetailBtn').addEventListener('click', () => {
            if (!selectedEventId) return;
            showConfirm('Delete this event and all its attendance records?', async () => {
                try {
                    await apiFetch(`${API_EVENTS}/${selectedEventId}`, { method: 'DELETE' });
                    selectedEventId = null;
                    eventDetailView.style.display = 'none';
                    eventsListView.style.display = '';
                    await reloadEventData();
                    showToast('Event deleted successfully');
                } catch(err) { showToast(err.message || 'Delete failed', 'error'); }
            }, 'Delete');
        });
    }

    // ============================================
    //  EVENT CREW ATTENDANCE (CRUD)
    // ============================================

    addCrewAttendanceBtn.addEventListener('click', () => {
        editingCrewId = null;
        crewModalTitle.textContent = 'Add Crew Member';
        crewForm.reset();
        populateEmployeeSelects();
        openModal(crewModal);
    });

    crewForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedEventId) return;

        const data = {
            eventId: selectedEventId,
            employeeId: parseInt($('crewMemberSelect').value),
            role: $('crewRoleInput').value.trim(),
            assignment: $('crewAssignmentInput').value.trim(),
            arrivalTime: null,
            departureTime: null,
            status: 'Present',
            hoursWorked: 0,
            overtimeHours: 0,
            notes: '',
            workPerformance: $('workPerformanceSelect').value,
            evaluationReason: $('evaluationReasonInput').value.trim()
        };

        try {
            if (editingCrewId) {
                await apiFetch(`${API_EVENT_ATT}/${editingCrewId}`, { method: 'PUT', body: JSON.stringify(data) });
                showToast('Crew member updated');
            } else {
                await apiFetch(API_EVENT_ATT, { method: 'POST', body: JSON.stringify(data) });
                showToast('Crew member added');
            }

            closeModal(crewModal);
            await renderEventAttendance(selectedEventId);
            // Refresh crew counts in events table
            try { allEventAttendance = await apiFetch(API_EVENT_ATT); } catch(e) { /* keep old */ }
            renderEventsTable();
        } catch(err) { showToast(err.message || 'Save failed', 'error'); }
    });

    $('cancelCrewModal').addEventListener('click', () => closeModal(crewModal));
    $('closeCrewModal').addEventListener('click', () => closeModal(crewModal));

    async function renderEventAttendance(eventId) {
        await loadEventAttendance(eventId);
        const records = cachedEventAttendance;
        eventAttendanceBody.innerHTML = '';

        if (records.length === 0) {
            noEventAttendance.style.display = 'flex';
            document.querySelector('#eventAttendanceTable').style.display = 'none';
            return;
        }

        noEventAttendance.style.display = 'none';
        document.querySelector('#eventAttendanceTable').style.display = 'table';

        records.forEach(rec => {
            const tr = document.createElement('tr');
            const perfBadge = rec.workPerformance
                ? `<span class="perf-badge perf-${(rec.workPerformance || '').toLowerCase().replace(/\s+/g, '-')}">${rec.workPerformance}</span>`
                : '—';
            tr.innerHTML = `
                <td><strong>${rec.employeeName || 'Unknown'}</strong></td>
                <td>${rec.role || '—'}</td>
                <td>${rec.assignment || '—'}</td>
                <td>${perfBadge}</td>
                <td>${rec.evaluationReason || '—'}</td>
                <td>
                    <div class="action-btns">
                        <button class="text-action-btn edit-btn edit-crew-btn" data-id="${rec.id}">Edit</button>
                        <button class="text-action-btn delete-btn delete-crew-btn" data-id="${rec.id}">Delete</button>
                    </div>
                </td>
            `;
            eventAttendanceBody.appendChild(tr);
        });

        // Attach event listeners
        document.querySelectorAll('.edit-crew-btn').forEach(btn => {
            btn.addEventListener('click', () => editCrewAttendance(parseInt(btn.dataset.id)));
        });
        document.querySelectorAll('.delete-crew-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                showConfirm('Delete this attendance record?', async () => {
                    try {
                        await apiFetch(`${API_EVENT_ATT}/${btn.dataset.id}`, { method: 'DELETE' });
                        await renderEventAttendance(selectedEventId);
                        // Refresh crew counts in events table
                        try { allEventAttendance = await apiFetch(API_EVENT_ATT); } catch(e) { /* keep old */ }
                        renderEventsTable();
                        showToast('Attendance record deleted');
                    } catch(err) { showToast(err.message || 'Delete failed', 'error'); }
                }, 'Delete');
            });
        });

        // Hide edit/delete based on role and submitted status
        if (window.AUTH) {
            const role = AUTH.getUserRole();
            const canManageCrew = (role === 'business_owner' || role === 'admin_assistant' || role === 'operations_manager');
            const isOpsManager = (role === 'operations_manager');
            const isFinanceRole = (role === 'finance_staff');
            const evt = getEventById(eventId);
            const isSubmitted = evt && evt.submitted;
            // Hide if no manage permission OR if ops manager and submitted OR if finance staff
            if (!canManageCrew || (isOpsManager && isSubmitted) || isFinanceRole) {
                document.querySelectorAll('.edit-crew-btn, .delete-crew-btn').forEach(btn => {
                    btn.style.display = 'none';
                });
            }
            // Also hide "Add Crew Member" accordingly
            if (addCrewAttendanceBtn) {
                const canAdd = canManageCrew && !(isOpsManager && isSubmitted) && !isFinanceRole;
                addCrewAttendanceBtn.style.display = canAdd ? '' : 'none';
            }
        }
    }

    function editCrewAttendance(id) {
        const rec = cachedEventAttendance.find(r => r.id === id);
        if (!rec) return;
        editingCrewId = id;
        crewModalTitle.textContent = 'Edit Crew Member';
        populateEmployeeSelects();
        $('crewMemberSelect').value = rec.employeeId;
        $('crewRoleInput').value = rec.role || '';
        $('crewAssignmentInput').value = rec.assignment || '';
        $('workPerformanceSelect').value = rec.workPerformance || '';
        $('evaluationReasonInput').value = rec.evaluationReason || '';
        openModal(crewModal);
    }

    // ============================================
    //  FULL-TIME TIME LOGS (CRUD)
    // ============================================

    addTimeLogBtn.addEventListener('click', () => {
        editingTimeLogId = null;
        timeLogModalTitle.textContent = 'New Time Log';
        timeLogForm.reset();
        // Default date to today
        $('timeLogDate').value = new Date().toISOString().slice(0, 10);
        populateEmployeeSelects();

        // If fulltime_employee, auto-select and hide the employee field entirely
        const isEmpRole = window.AUTH && AUTH.isEmployee();
        const myEmpId = isEmpRole ? AUTH.getLinkedEmployeeId() : null;
        const empFormGroup = $('timeLogEmployee').closest('.form-group');
        if (isEmpRole) {
            if (myEmpId) $('timeLogEmployee').value = myEmpId;
            $('timeLogEmployee').disabled = true;
            if (empFormGroup) empFormGroup.style.display = 'none';
        } else {
            $('timeLogEmployee').disabled = false;
            if (empFormGroup) empFormGroup.style.display = '';
        }

        openModal(timeLogModal);
    });

    timeLogForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const timeIn = $('timeLogIn').value;
        const timeOut = $('timeLogOut').value || null;

        // For fulltime_employee, use their linked employee ID (dropdown is hidden)
        const isEmpRole = window.AUTH && AUTH.isEmployee();
        const empIdFromSelect = parseInt($('timeLogEmployee').value);
        const empIdLinked = isEmpRole && window.AUTH ? AUTH.getLinkedEmployeeId() : null;
        const employeeId = (isEmpRole && empIdLinked) ? empIdLinked : empIdFromSelect;

        const data = {
            employeeId: employeeId,
            date: $('timeLogDate').value,
            timeIn: timeIn,
            timeOut: timeOut,
            totalHours: calcHours(timeIn, timeOut),
            notes: $('timeLogRemarks').value.trim(),
            notesOut: $('timeLogRemarksOut').value.trim(),
            ...getUserContext()
        };

        try {
            if (editingTimeLogId) {
                await apiFetch(`${API_TIMELOGS}/${editingTimeLogId}`, { method: 'PUT', body: JSON.stringify(data) });
                showToast('Time log updated');
            } else {
                await apiFetch(API_TIMELOGS, { method: 'POST', body: JSON.stringify(data) });
                showToast('Time log recorded');
            }

            closeModal(timeLogModal);
            await renderTimeLogs();
        } catch(err) { showToast(err.message || 'Save failed', 'error'); }
    });

    $('cancelTimeLogModal').addEventListener('click', () => closeModal(timeLogModal));
    $('closeTimeLogModal').addEventListener('click', () => closeModal(timeLogModal));

    // Filter listeners
    ftEmployeeSelect.addEventListener('change', () => renderTimeLogs());
    ftDateFilter.addEventListener('change', () => renderTimeLogs());

    async function renderTimeLogs() {
        const isEmpRole = window.AUTH && AUTH.isEmployee();
        const myEmpId = isEmpRole && window.AUTH ? AUTH.getLinkedEmployeeId() : null;

        // Build query params
        const params = {};
        if (isEmpRole && myEmpId) {
            params.employeeId = myEmpId;
        } else {
            const empFilter = ftEmployeeSelect.value;
            if (empFilter) params.employeeId = empFilter;
        }
        const dateFilter = ftDateFilter.value;
        if (dateFilter) { params.startDate = dateFilter; params.endDate = dateFilter; }

        await loadTimeLogs(params);
        let logs = cachedTimeLogs;

        // Sort by date desc, then time_in asc within day
        logs.sort((a, b) => {
            if (b.date !== a.date) return b.date.localeCompare(a.date);
            return (a.timeIn || '').localeCompare(b.timeIn || '');
        });

        timeLogCount.textContent = `${logs.length} record${logs.length !== 1 ? 's' : ''}`;

        // Hide/show Employee column for employees
        const thEmp = $('thEmployee');
        if (thEmp) thEmp.style.display = isEmpRole ? 'none' : '';

        if (logs.length === 0) {
            noTimeLogs.style.display = 'flex';
            $('timeLogTable').style.display = 'none';
            if (submitFtToFinanceBtn) submitFtToFinanceBtn.style.display = 'none';
            if (isEmpRole) {
                if (clockInBtn) clockInBtn.disabled = false;
                if (clockOutBtn) clockOutBtn.disabled = true;
            }
            return;
        }

        noTimeLogs.style.display = 'none';
        $('timeLogTable').style.display = 'table';
        timeLogBody.innerHTML = '';

        // Check unsubmitted / open log for employee buttons
        const hasUnsubmitted = logs.some(l => !l.submitted);
        if (submitFtToFinanceBtn) {
            submitFtToFinanceBtn.style.display = (isEmpRole && hasUnsubmitted) ? '' : 'none';
        }
        const hasOpenLog = logs.some(l => l.timeIn && !l.timeOut && !l.submitted);
        if (isEmpRole) {
            if (clockInBtn) clockInBtn.disabled = hasOpenLog;
            if (clockOutBtn) clockOutBtn.disabled = !hasOpenLog;
        }

        // Group by date (and optionally by employee for managers)
        const grouped = {};
        logs.forEach(log => {
            const key = isEmpRole ? log.date : `${log.employeeId}||${log.date}`;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(log);
        });

        // Sort keys by date desc
        const keys = Object.keys(grouped).sort((a, b) => {
            const dateA = a.includes('||') ? a.split('||')[1] : a;
            const dateB = b.includes('||') ? b.split('||')[1] : b;
            return dateB.localeCompare(dateA);
        });

        keys.forEach(key => {
            const dayLogs = grouped[key];
            const totalHrs = dayLogs.reduce((sum, l) => sum + (l.totalHours || 0), 0);
            const roundedHrs = Math.round(totalHrs * 100) / 100;
            const allSubmitted = dayLogs.every(l => l.submitted);
            const firstLog = dayLogs[0];
            const hasOpen = dayLogs.some(l => l.timeIn && !l.timeOut);

            // Summary row
            const summaryTr = document.createElement('tr');
            summaryTr.className = 'tl-summary-row';
            const empTd = isEmpRole ? '' : `<td><strong>${firstLog.employeeName || 'Unknown'}</strong></td>`;
            const statusHtml = allSubmitted
                ? '<span class="status-badge status-approved">Submitted</span>'
                : '<span class="status-badge status-pending">Not Submitted</span>';
            // Delete button for managers on summary row
            const tlRole = window.AUTH ? AUTH.getUserRole() : '';
            const canDeleteRow = !isEmpRole && tlRole !== 'finance_staff' && tlRole !== 'operations_manager';
            const delGroupHtml = canDeleteRow
                ? `<button class="text-action-btn delete-btn tl-delete-group-btn">Delete</button>`
                : '';

            summaryTr.innerHTML = `
                ${empTd}
                <td>${formatDate(firstLog.date)}</td>
                <td><span class="tl-hours-pill">${roundedHrs} hrs</span></td>
                <td>${dayLogs.length} entr${dayLogs.length !== 1 ? 'ies' : 'y'}</td>
                <td>${statusHtml}</td>
                <td class="tl-expand-cell">
                    <div class="action-btns">
                        <button class="text-action-btn view-btn tl-view-btn">View</button>
                        ${delGroupHtml}
                    </div>
                </td>
            `;

            // Attach delete-group handler
            const delGroupBtn = summaryTr.querySelector('.tl-delete-group-btn');
            if (delGroupBtn) {
                delGroupBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const empName = firstLog.employeeName || 'this employee';
                    const date = formatDate(firstLog.date);
                    showConfirm(`Delete all ${dayLogs.length} time log(s) for ${empName} on ${date}?`, async () => {
                        try {
                            for (const log of dayLogs) {
                                await apiFetch(`${API_TIMELOGS}/${log.id}`, { method: 'DELETE' });
                            }
                            showToast('Time logs deleted successfully');
                            await renderTimeLogs();
                        } catch(err) { showToast(err.message || 'Delete failed', 'error'); }
                    }, 'Delete');
                });
            }

            // Detail row (hidden initially)
            const detailTr = document.createElement('tr');
            detailTr.className = 'tl-detail-row';
            detailTr.style.display = 'none';
            const colspan = isEmpRole ? 5 : 6;

            let detailHtml = '<div class="tl-detail-wrap">';
            detailHtml += `<table class="tl-inner-table">
                <thead><tr>
                    <th>Time In</th><th>Time Out</th><th>Hours</th><th>Remarks (In)</th><th>Remarks (Out)</th><th></th>
                </tr></thead><tbody>`;
            dayLogs.forEach(log => {
                const isOpen = log.timeIn && !log.timeOut;
                const canEdit = isEmpRole ? !log.submitted : true;
                let actionHtml = '';
                if (canEdit) {
                    if (isEmpRole) {
                        actionHtml = `<div class="action-btns"><button class="text-action-btn delete-btn delete-log-btn" data-id="${log.id}">Delete</button></div>`;
                    } else {
                        actionHtml = `<div class="action-btns"><button class="text-action-btn edit-btn edit-log-btn" data-id="${log.id}">Edit</button><button class="text-action-btn delete-btn delete-log-btn" data-id="${log.id}">Delete</button></div>`;
                    }
                }
                detailHtml += `<tr class="${isOpen ? 'tl-row-open' : ''}">
                    <td>${formatTime(log.timeIn)}</td>
                    <td>${isOpen ? '<em class="tl-pending-text">Pending</em>' : formatTime(log.timeOut)}</td>
                    <td>${log.totalHours ? log.totalHours + ' hrs' : '—'}</td>
                    <td>${log.notes || '—'}</td>
                    <td>${log.notesOut || '—'}</td>
                    <td>${actionHtml}</td>
                </tr>`;
            });
            detailHtml += '</tbody></table></div>';

            detailTr.innerHTML = `<td colspan="${colspan}" class="tl-detail-cell">${detailHtml}</td>`;

            // Toggle expand on click
            summaryTr.querySelector('.tl-view-btn').addEventListener('click', () => {
                const isOpen = detailTr.style.display !== 'none';
                detailTr.style.display = isOpen ? 'none' : 'table-row';
                summaryTr.querySelector('.tl-view-btn').textContent = isOpen ? 'View' : 'Hide';
                summaryTr.classList.toggle('tl-summary-expanded', !isOpen);
            });

            timeLogBody.appendChild(summaryTr);
            timeLogBody.appendChild(detailTr);
        });

        // Operations manager: hide all View/Edit/Delete on FT logs
        if (window.AUTH && AUTH.getUserRole() === 'operations_manager') {
            document.querySelectorAll('.tl-view-btn, .edit-log-btn, .delete-log-btn').forEach(btn => {
                btn.style.display = 'none';
            });
        }

        // Finance staff: hide all Edit/Delete on FT logs (view-only)
        if (window.AUTH && AUTH.getUserRole() === 'finance_staff') {
            document.querySelectorAll('.edit-log-btn, .delete-log-btn').forEach(btn => {
                btn.style.display = 'none';
            });
        }

        attachLogListeners();
    }

    function attachLogListeners() {
        document.querySelectorAll('.edit-log-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                editTimeLog(parseInt(btn.dataset.id));
            });
        });
        document.querySelectorAll('.delete-log-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                showConfirm('Delete this time log?', async () => {
                    try {
                        const uc = getUserContext();
                        const params = new URLSearchParams({ userId: uc._userId || '', userName: uc._userName || '', userRole: uc._userRole || '' });
                        await apiFetch(`${API_TIMELOGS}/${btn.dataset.id}?${params}`, { method: 'DELETE' });
                        await renderTimeLogs();
                        showToast('Time log deleted');
                    } catch(err) { showToast(err.message || 'Delete failed', 'error'); }
                }, 'Delete');
            });
        });
    }

    function editTimeLog(id) {
        const log = cachedTimeLogs.find(l => l.id === id);
        if (!log) return;
        editingTimeLogId = id;
        timeLogModalTitle.textContent = 'Edit Time Log';
        populateEmployeeSelects();
        $('timeLogEmployee').value = log.employeeId;
        $('timeLogDate').value = log.date;
        $('timeLogIn').value = log.timeIn || '';
        $('timeLogOut').value = log.timeOut || '';
        $('timeLogRemarks').value = log.notes || '';
        $('timeLogRemarksOut').value = log.notesOut || '';

        // If fulltime_employee, hide the employee field
        const isEmpRole = window.AUTH && AUTH.isEmployee();
        const myEmpId = isEmpRole ? AUTH.getLinkedEmployeeId() : null;
        const empFG = $('timeLogEmployee').closest('.form-group');
        if (isEmpRole) {
            $('timeLogEmployee').disabled = true;
            if (empFG) empFG.style.display = 'none';
        } else {
            $('timeLogEmployee').disabled = false;
            if (empFG) empFG.style.display = '';
        }

        openModal(timeLogModal);
    }

    // ============================================
    //  SUBMIT FT ATTENDANCE TO FINANCE
    // ============================================
    if (submitFtToFinanceBtn) {
        submitFtToFinanceBtn.addEventListener('click', () => {
            const myEmpId = window.AUTH ? AUTH.getLinkedEmployeeId() : null;
            if (!myEmpId) return;
            showConfirm('Submit your attendance to finance? You will not be able to edit submitted logs.', async () => {
                try {
                    await apiFetch(`${API_TIMELOGS}/submit?employeeId=${myEmpId}`, { method: 'PUT' });
                    showToast('Attendance submitted to finance successfully');
                    await renderTimeLogs();
                } catch (err) {
                    showToast(err.message || 'Submit failed', 'error');
                }
            }, 'Submit');
        });
    }

    // ============================================
    //  CLOCK IN / CLOCK OUT (for fulltime_employee)
    // ============================================
    const clockModal = $('clockModal');
    const clockForm = $('clockForm');
    let clockMode = null; // 'in' or 'out'

    if (clockInBtn) {
        clockInBtn.addEventListener('click', () => {
            clockMode = 'in';
            $('clockModalTitle').textContent = 'Clock In';
            $('clockSubmitBtn').textContent = 'Clock In';
            $('clockRemarks').value = '';
            openModal(clockModal);
        });
    }

    if (clockOutBtn) {
        clockOutBtn.addEventListener('click', () => {
            const openLog = cachedTimeLogs.find(l => l.timeIn && !l.timeOut && !l.submitted);
            if (!openLog) {
                showToast('No open clock-in found', 'error');
                return;
            }
            clockMode = 'out';
            $('clockModalTitle').textContent = 'Clock Out';
            $('clockSubmitBtn').textContent = 'Clock Out';
            $('clockRemarks').value = '';
            openModal(clockModal);
        });
    }

    if (clockForm) {
        clockForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const empId = window.AUTH ? AUTH.getLinkedEmployeeId() : null;
            if (!empId) {
                showToast('Your account is not linked to an employee record. Please contact the administrator.', 'error');
                return;
            }
            const now = new Date();
            const timeVal = now.toTimeString().slice(0, 5);
            const remarks = $('clockRemarks').value.trim();

            if (clockMode === 'in') {
                const data = {
                    employeeId: empId,
                    date: now.toISOString().slice(0, 10),
                    timeIn: timeVal,
                    timeOut: null,
                    totalHours: 0,
                    notes: remarks
                };
                try {
                    await apiFetch(API_TIMELOGS, { method: 'POST', body: JSON.stringify(data) });
                    showToast('Clocked in successfully');
                    closeModal(clockModal);
                    await renderTimeLogs();
                } catch(err) { showToast(err.message || 'Clock in failed', 'error'); }
            } else {
                const openLog = cachedTimeLogs.find(l => l.timeIn && !l.timeOut && !l.submitted);
                if (!openLog) { showToast('No open clock-in found', 'error'); return; }
                const data = {
                    employeeId: openLog.employeeId,
                    date: openLog.date,
                    timeIn: openLog.timeIn,
                    timeOut: timeVal,
                    totalHours: calcHours(openLog.timeIn, timeVal),
                    notes: openLog.notes || '',
                    notesOut: remarks
                };
                try {
                    await apiFetch(`${API_TIMELOGS}/${openLog.id}`, { method: 'PUT', body: JSON.stringify(data) });
                    showToast('Clocked out successfully');
                    closeModal(clockModal);
                    await renderTimeLogs();
                } catch(err) { showToast(err.message || 'Clock out failed', 'error'); }
            }
        });

        $('cancelClockModal').addEventListener('click', () => closeModal(clockModal));
        $('closeClockModal').addEventListener('click', () => closeModal(clockModal));
    }

    // ============================================
    //  MONTHLY SUMMARY
    // ============================================

    // Default month/year to current
    summaryMonth.value = new Date().getMonth() + 1;
    summaryYear.value = new Date().getFullYear();

    generateSummaryBtn.addEventListener('click', generateMonthlySummary);

    async function generateMonthlySummary() {
        const month = parseInt(summaryMonth.value);
        const year = parseInt(summaryYear.value);

        // Reload all data for the summary
        await loadEmployees();
        await loadTimeLogs();
        await loadEventAttendance();
        await loadEvents();

        // Get full-time employees
        const ftEmployees = cachedEmployees.filter(e => e.employeeType === 'full-time');
        const logs = cachedTimeLogs;

        // Filter logs for the selected month/year
        const monthLogs = logs.filter(l => {
            const d = new Date(l.date + 'T00:00:00');
            return d.getMonth() + 1 === month && d.getFullYear() === year;
        });

        // Build summary per employee
        const summaryData = [];
        let totalPresent = 0, totalAbsent = 0, totalHours = 0;

        // Get working days in the month (Mon-Sat, excluding Sun)
        const daysInMonth = new Date(year, month, 0).getDate();
        let workingDays = 0;
        for (let d = 1; d <= daysInMonth; d++) {
            const day = new Date(year, month - 1, d).getDay();
            if (day !== 0) workingDays++; // Exclude Sunday
        }

        ftEmployees.forEach(emp => {
            const empLogs = monthLogs.filter(l => l.employeeId === emp.id);
            const daysPresent = empLogs.length;
            const daysAbsent = Math.max(0, workingDays - daysPresent);
            const daysLate = empLogs.filter(l => l.status === 'Late').length;
            const hoursWorked = empLogs.reduce((sum, l) => sum + (l.totalHours || 0), 0);
            const overtimeHours = Math.max(0, hoursWorked - (workingDays * 8));
            const attendanceRate = workingDays > 0 ? Math.round((daysPresent / workingDays) * 100) : 0;

            totalPresent += daysPresent;
            totalAbsent += daysAbsent;
            totalHours += hoursWorked;

            summaryData.push({
                employee: empName(emp),
                daysPresent,
                daysAbsent,
                daysLate,
                hoursWorked: Math.round(hoursWorked * 100) / 100,
                overtimeHours: Math.round(overtimeHours * 100) / 100,
                attendanceRate
            });
        });

        // Also add on-call/event data for the month
        const events = cachedEvents.filter(evt => {
            const d = new Date(evt.eventDate + 'T00:00:00');
            return d.getMonth() + 1 === month && d.getFullYear() === year;
        });
        const eventAttendance = cachedEventAttendance;

        const oncallEmployees = cachedEmployees.filter(e => e.employeeType === 'on-call');
        oncallEmployees.forEach(emp => {
            const myAttendance = eventAttendance.filter(a => {
                const evt = getEventById(a.eventId);
                if (!evt) return false;
                const d = new Date(evt.eventDate + 'T00:00:00');
                return a.employeeId === emp.id && d.getMonth() + 1 === month && d.getFullYear() === year;
            });
            if (myAttendance.length > 0) {
                const daysPresent = myAttendance.filter(a => a.status === 'Present' || a.status === 'Late').length;
                const daysAbsent = myAttendance.filter(a => a.status === 'Absent').length;
                const daysLate = myAttendance.filter(a => a.status === 'Late').length;
                const hoursWorked = myAttendance.reduce((sum, a) => sum + (a.hoursWorked || 0), 0);
                const overtimeHours = myAttendance.reduce((sum, a) => sum + (a.overtimeHours || 0), 0);
                const totalAssigned = myAttendance.length;
                const attendanceRate = totalAssigned > 0 ? Math.round((daysPresent / totalAssigned) * 100) : 0;

                totalPresent += daysPresent;
                totalAbsent += daysAbsent;
                totalHours += hoursWorked;

                summaryData.push({
                    employee: empName(emp) + ' (On-Call)',
                    daysPresent,
                    daysAbsent,
                    daysLate,
                    hoursWorked: Math.round(hoursWorked * 100) / 100,
                    overtimeHours: Math.round(overtimeHours * 100) / 100,
                    attendanceRate
                });
            }
        });

        // Update stats
        $('statTotalEmployees').textContent = summaryData.length;
        $('statTotalPresent').textContent = totalPresent;
        $('statTotalAbsent').textContent = totalAbsent;
        $('statTotalHours').textContent = Math.round(totalHours * 100) / 100;

        // Render table
        summaryBody.innerHTML = '';

        if (summaryData.length === 0) {
            noSummary.style.display = 'flex';
            $('summaryTable').style.display = 'none';
            return;
        }

        noSummary.style.display = 'none';
        $('summaryTable').style.display = 'table';

        summaryData.forEach(row => {
            const tr = document.createElement('tr');
            const rateColor = row.attendanceRate >= 90 ? 'var(--success)' :
                              row.attendanceRate >= 70 ? 'var(--warning)' : 'var(--error)';
            tr.innerHTML = `
                <td><strong>${row.employee}</strong></td>
                <td>${row.daysPresent}</td>
                <td>${row.daysAbsent}</td>
                <td>${row.daysLate}</td>
                <td>${row.hoursWorked} hrs</td>
                <td>${row.overtimeHours} hrs</td>
                <td><span style="color:${rateColor}; font-weight:700;">${row.attendanceRate}%</span></td>
            `;
            summaryBody.appendChild(tr);
        });

        showToast('Summary generated for ' + summaryMonth.options[summaryMonth.selectedIndex].text + ' ' + year);
    }

    // ============================================
    //  CONFIRM DIALOG LOGIC
    // ============================================
    confirmOk.addEventListener('click', () => {
        if (confirmCallback) confirmCallback();
        hideConfirm();
    });
    confirmCancel.addEventListener('click', hideConfirm);
    $('closeConfirmModal').addEventListener('click', hideConfirm);

    // Close modals on overlay click
    [eventModal, crewModal, timeLogModal, confirmModal, clockModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal);
        });
    });

    // ============================================
    //  ROLE-BASED RESTRICTIONS
    // ============================================
    function applyRoleRestrictions() {
        // Filter attendance tabs based on role
        if (window.AUTH) {
            AUTH.filterAttendanceTabs();
        }

        const isEmployee = window.AUTH && AUTH.isEmployee();
        const isAdmin = window.AUTH && AUTH.isAdminAssistant();
        const role = window.AUTH ? AUTH.getUserRole() : '';
        const isFinance = role === 'finance_staff';

        // Full-time employee: can only view/add their own logs, no event tab management
        if (isEmployee) {
            if (addEventBtn) addEventBtn.style.display = 'none';
            if (addCrewAttendanceBtn) addCrewAttendanceBtn.style.display = 'none';
            if (submitToFinanceBtn) submitToFinanceBtn.style.display = 'none';

            // Hide the employee dropdown entirely — they only see their own data
            const myEmpId = AUTH.getLinkedEmployeeId();
            if (ftEmployeeSelect) {
                if (myEmpId) ftEmployeeSelect.value = myEmpId;
                ftEmployeeSelect.closest('.form-inline').style.display = 'none';
            }

            // Hide date filter too — employee sees all their own logs
            if (ftDateFilter) {
                ftDateFilter.closest('.form-inline').style.display = 'none';
            }

            // Show today's date
            const todayEl = $('ftTodayDate');
            if (todayEl) {
                const now = new Date();
                const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
                todayEl.textContent = now.toLocaleDateString('en-US', options);
                todayEl.style.display = '';
            }

            // Show Clock In / Clock Out buttons, hide + New Time Log
            if (addTimeLogBtn) addTimeLogBtn.style.display = 'none';
            if (clockInBtn) clockInBtn.style.display = '';
            if (clockOutBtn) clockOutBtn.style.display = '';
        }

        // Finance staff: view-only mode — no add/edit/delete on both event & FT
        if (isFinance) {
            if (addEventBtn) addEventBtn.style.display = 'none';
            if (addCrewAttendanceBtn) addCrewAttendanceBtn.style.display = 'none';
            if (submitToFinanceBtn) submitToFinanceBtn.style.display = 'none';
            if (addTimeLogBtn) addTimeLogBtn.style.display = 'none';
            if (submitFtToFinanceBtn) submitFtToFinanceBtn.style.display = 'none';
        }

        // Admin assistant: can manage events/crew and FT attendance
        // (no special restrictions — they have full edit access like business_owner)

        // Operations manager: hide FT-related controls entirely (on-call only)
        if (role === 'operations_manager') {
            if (addTimeLogBtn) addTimeLogBtn.style.display = 'none';
            if (clockInBtn) clockInBtn.style.display = 'none';
            if (clockOutBtn) clockOutBtn.style.display = 'none';
            if (submitFtToFinanceBtn) submitFtToFinanceBtn.style.display = 'none';
        }
    }

    // ============================================
    //  INITIAL RENDER — load from database
    // ============================================
    (async function init() {
        await loadEmployees();
        await loadEvents();
        try { allEventAttendance = await apiFetch(API_EVENT_ATT); } catch(e) { allEventAttendance = []; }
        renderEventsTable();
        populateEmployeeSelects();
        applyRoleRestrictions();
        await renderTimeLogs();

        // Show warning popup if there's a pending clock-out
        const isEmpRole = window.AUTH && AUTH.isEmployee();
        if (isEmpRole) {
            const openLog = cachedTimeLogs.find(l => l.timeIn && !l.timeOut && !l.submitted);
            if (openLog) {
                const warningModal = $('clockOutWarningModal');
                const warningMsg = $('clockOutWarningMessage');
                if (warningModal && warningMsg) {
                    warningMsg.textContent = `You clocked in at ${formatTime(openLog.timeIn)} and have not yet clocked out. Please clock out before leaving.`;
                    warningModal.classList.add('show');
                }
            }
        }
        // Close warning modal handler
        const warnOkBtn = $('clockOutWarningOk');
        if (warnOkBtn) {
            warnOkBtn.addEventListener('click', () => {
                $('clockOutWarningModal').classList.remove('show');
            });
        }
        // Prevent closing tab if there's a pending clock-out
        window.addEventListener('beforeunload', function (e) {
            if (window.AUTH && AUTH.isEmployee()) {
                const pending = cachedTimeLogs.find(l => l.timeIn && !l.timeOut && !l.submitted);
                if (pending) {
                    e.preventDefault();
                    e.returnValue = '';
                }
            }
        });
    })();
});
