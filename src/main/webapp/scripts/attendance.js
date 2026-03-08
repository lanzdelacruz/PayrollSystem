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
    let cachedTimeLogs = [];

    async function loadEmployees() {
        try { cachedEmployees = await apiFetch(API_EMPLOYEES); }
        catch(e) { console.error('Load employees failed:', e); cachedEmployees = []; }
    }
    async function loadEvents() {
        try { cachedEvents = await apiFetch(API_EVENTS); }
        catch(e) { console.error('Load events failed:', e); cachedEvents = []; }
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
    const eventSelect = $('eventSelect');
    const addEventBtn = $('addEventBtn');
    const eventDetailsCard = $('eventDetailsCard');
    const eventAttendanceCard = $('eventAttendanceCard');
    const editEventBtn = $('editEventBtn');
    const deleteEventBtn = $('deleteEventBtn');
    const addCrewAttendanceBtn = $('addCrewAttendanceBtn');
    const eventAttendanceBody = $('eventAttendanceBody');
    const noEventAttendance = $('noEventAttendance');

    // Full-Time Tab
    const ftEmployeeSelect = $('ftEmployeeSelect');
    const ftDateFilter = $('ftDateFilter');
    const addTimeLogBtn = $('addTimeLogBtn');
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

    function showConfirm(message, callback) {
        confirmMessage.textContent = message;
        confirmCallback = callback;
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

    function getTimeDiffStatus(timeIn) {
        if (!timeIn) return 'On Time';
        const [h] = timeIn.split(':').map(Number);
        // Assume 8 AM is start time for full-time employees
        return h > 8 ? 'Late' : (h === 8 ? 'On Time' : 'On Time');
    }

    function formatCurrency(amount) {
        return '₱' + Number(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
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
    function populateEventSelect() {
        eventSelect.innerHTML = '<option value="">— Choose Event —</option>';
        cachedEvents.forEach(evt => {
            eventSelect.innerHTML += `<option value="${evt.id}">${evt.eventName} (${formatDate(evt.eventDate)})</option>`;
        });
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
            $('timeLogEmployee').innerHTML += `<option value="${e.id}">${empName(e)} (${e.position})</option>`;
        });

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

    // Open Add Event Modal
    addEventBtn.addEventListener('click', () => {
        editingEventId = null;
        eventModalTitle.textContent = 'Add New Event';
        eventForm.reset();
        openModal(eventModal);
    });

    // Edit Event
    editEventBtn.addEventListener('click', () => {
        if (!selectedEventId) return;
        const evt = getEventById(selectedEventId);
        if (!evt) return;
        editingEventId = selectedEventId;
        eventModalTitle.textContent = 'Edit Event';
        $('eventNameInput').value = evt.eventName;
        $('eventDateInput').value = evt.eventDate;
        openModal(eventModal);
    });

    // Delete Event
    deleteEventBtn.addEventListener('click', () => {
        if (!selectedEventId) return;
        showConfirm('Delete this event and all its attendance records?', async () => {
            try {
                await apiFetch(`${API_EVENTS}/${selectedEventId}`, { method: 'DELETE' });
                selectedEventId = null;
                await loadEvents();
                populateEventSelect();
                eventDetailsCard.style.display = 'none';
                eventAttendanceCard.style.display = 'none';
                showToast('Event deleted successfully');
            } catch(err) { showToast(err.message || 'Delete failed', 'error'); }
        });
    });

    // Save Event Form
    eventForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            eventName: $('eventNameInput').value.trim(),
            eventDate: $('eventDateInput').value,
            eventVenue: '',
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
            await loadEvents();
            populateEventSelect();
            if (selectedEventId) {
                eventSelect.value = selectedEventId;
                await loadEventDetails(selectedEventId);
            }
        } catch(err) { showToast(err.message || 'Save failed', 'error'); }
    });

    // Cancel / close event modal
    $('cancelEventModal').addEventListener('click', () => closeModal(eventModal));
    $('closeEventModal').addEventListener('click', () => closeModal(eventModal));

    // Event selection change
    eventSelect.addEventListener('change', async function () {
        selectedEventId = this.value ? parseInt(this.value) : null;
        if (selectedEventId) {
            await loadEventDetails(selectedEventId);
        } else {
            eventDetailsCard.style.display = 'none';
            eventAttendanceCard.style.display = 'none';
        }
    });

    async function loadEventDetails(eventId) {
        const evt = getEventById(eventId);
        if (!evt) return;

        $('eventDetailTitle').textContent = evt.eventName;
        $('eventDate').textContent = formatDate(evt.eventDate);

        eventDetailsCard.style.display = 'block';
        eventAttendanceCard.style.display = 'block';

        await renderEventAttendance(eventId);
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

        const arrivalTime = $('arrivalTimeInput').value;
        const departureTime = $('departureTimeInput').value;

        const data = {
            eventId: selectedEventId,
            employeeId: parseInt($('crewMemberSelect').value),
            role: $('crewRoleInput').value.trim(),
            assignment: $('crewAssignmentInput').value.trim(),
            arrivalTime: arrivalTime || null,
            departureTime: departureTime || null,
            status: 'Present',
            hoursWorked: calcHours(arrivalTime, departureTime),
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
                <td>${formatTime(rec.arrivalTime)}</td>
                <td>${formatTime(rec.departureTime)}</td>
                <td>${perfBadge}</td>
                <td>${rec.evaluationReason || '—'}</td>
                <td>
                    <div class="action-group">
                        <button class="action-btn edit-crew-btn" data-id="${rec.id}" title="Edit">✏️</button>
                        <button class="action-btn delete-btn delete-crew-btn" data-id="${rec.id}" title="Delete">🗑️</button>
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
                        showToast('Attendance record deleted');
                    } catch(err) { showToast(err.message || 'Delete failed', 'error'); }
                });
            });
        });

        // Hide edit/delete for restricted roles on event attendance
        if (window.AUTH) {
            const role = AUTH.getUserRole();
            const canManageCrew = (role === 'operations_manager' || role === 'business_owner');
            if (!canManageCrew) {
                document.querySelectorAll('.edit-crew-btn, .delete-crew-btn').forEach(btn => {
                    btn.style.display = 'none';
                });
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
        $('arrivalTimeInput').value = rec.arrivalTime || '';
        $('departureTimeInput').value = rec.departureTime || '';
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
        openModal(timeLogModal);
    });

    timeLogForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const timeIn = $('timeLogIn').value;
        const timeOut = $('timeLogOut').value;

        const data = {
            employeeId: parseInt($('timeLogEmployee').value),
            date: $('timeLogDate').value,
            timeIn: timeIn,
            timeOut: timeOut,
            totalHours: calcHours(timeIn, timeOut),
            status: getTimeDiffStatus(timeIn),
            notes: $('timeLogRemarks').value.trim()
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
        // Build query params for server-side filtering
        const params = {};
        const empFilter = ftEmployeeSelect.value;
        const dateFilter = ftDateFilter.value;
        if (empFilter) params.employeeId = empFilter;
        if (dateFilter) { params.startDate = dateFilter; params.endDate = dateFilter; }

        await loadTimeLogs(params);
        let logs = cachedTimeLogs;

        // Sort by date desc, then time in desc
        logs.sort((a, b) => {
            if (b.date !== a.date) return b.date.localeCompare(a.date);
            return (b.timeIn || '').localeCompare(a.timeIn || '');
        });

        timeLogBody.innerHTML = '';
        timeLogCount.textContent = `${logs.length} record${logs.length !== 1 ? 's' : ''}`;

        if (logs.length === 0) {
            noTimeLogs.style.display = 'flex';
            $('timeLogTable').style.display = 'none';
            return;
        }

        noTimeLogs.style.display = 'none';
        $('timeLogTable').style.display = 'table';

        logs.forEach(log => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${log.employeeName || 'Unknown'}</strong></td>
                <td>${formatDate(log.date)}</td>
                <td>${formatTime(log.timeIn)}</td>
                <td>${formatTime(log.timeOut)}</td>
                <td>${log.totalHours} hrs</td>
                <td>${statusBadge(log.status)}</td>
                <td>${log.notes || '—'}</td>
                <td>
                    <div class="action-group">
                        <button class="action-btn edit-log-btn" data-id="${log.id}" title="Edit">✏️</button>
                        <button class="action-btn delete-btn delete-log-btn" data-id="${log.id}" title="Delete">🗑️</button>
                    </div>
                </td>
            `;
            timeLogBody.appendChild(tr);
        });

        // Attach event listeners
        document.querySelectorAll('.edit-log-btn').forEach(btn => {
            btn.addEventListener('click', () => editTimeLog(parseInt(btn.dataset.id)));
        });
        document.querySelectorAll('.delete-log-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                showConfirm('Delete this time log?', async () => {
                    try {
                        await apiFetch(`${API_TIMELOGS}/${btn.dataset.id}`, { method: 'DELETE' });
                        await renderTimeLogs();
                        showToast('Time log deleted');
                    } catch(err) { showToast(err.message || 'Delete failed', 'error'); }
                });
            });
        });

        // Hide edit/delete for full-time employees (view-only)
        if (window.AUTH && AUTH.isEmployee()) {
            document.querySelectorAll('.edit-log-btn, .delete-log-btn').forEach(btn => {
                btn.style.display = 'none';
            });
        }
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
        openModal(timeLogModal);
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
    [eventModal, crewModal, timeLogModal, confirmModal].forEach(modal => {
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

        // Only operations_manager and business_owner can manage events/crew
        const canManageEvents = (role === 'operations_manager' || role === 'business_owner');

        // Full-time employee: can only view their own logs, no event tab, no add/edit/delete
        if (isEmployee) {
            if (addEventBtn) addEventBtn.style.display = 'none';
            if (editEventBtn) editEventBtn.style.display = 'none';
            if (deleteEventBtn) deleteEventBtn.style.display = 'none';
            if (addCrewAttendanceBtn) addCrewAttendanceBtn.style.display = 'none';

            const myEmpId = AUTH.getLinkedEmployeeId();
            if (myEmpId && ftEmployeeSelect) {
                ftEmployeeSelect.value = myEmpId;
                ftEmployeeSelect.disabled = true;
            }

            if (addTimeLogBtn) addTimeLogBtn.style.display = 'none';
        }

        // Admin assistant & finance: can view but not manage events/crew
        if (isAdmin || isFinance) {
            if (addEventBtn) addEventBtn.style.display = 'none';
            if (editEventBtn) editEventBtn.style.display = 'none';
            if (deleteEventBtn) deleteEventBtn.style.display = 'none';
            if (addCrewAttendanceBtn) addCrewAttendanceBtn.style.display = 'none';
        }
    }

    // ============================================
    //  INITIAL RENDER — load from database
    // ============================================
    (async function init() {
        await loadEmployees();
        await loadEvents();
        populateEventSelect();
        populateEmployeeSelects();
        applyRoleRestrictions();
        await renderTimeLogs();
    })();
});
