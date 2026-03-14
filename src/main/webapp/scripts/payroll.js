// ============================================
// PAYROLL MODULE — View Submitted Attendances
// Red Damien Entertainment Payroll System
// ============================================

document.addEventListener('DOMContentLoaded', function () {

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

    // DOM references
    const $ = id => document.getElementById(id);

    // Views
    const payrollMainView        = $('payrollMainView');
    const submittedAttendancesView = $('submittedAttendancesView');
    const submittedListView      = $('submittedListView');
    const submittedDetailView    = $('submittedDetailView');
    const ftSubmittedView        = $('ftSubmittedView');
    const ftSubmittedListView    = $('ftSubmittedListView');
    const ftSubmittedDetailView  = $('ftSubmittedDetailView');

    // Buttons
    const viewSubmittedBtn       = $('viewSubmittedBtn');
    const viewFtSubmittedBtn     = $('viewFtSubmittedBtn');
    const backToPayrollBtn       = $('backToPayrollBtn');
    const backToPayrollFromFt    = $('backToPayrollFromFt');
    const backToSubmittedList    = $('backToSubmittedList');
    const backToFtSubmittedList  = $('backToFtSubmittedList');

    // Table
    const payrollEventsBody      = $('payrollEventsBody');
    const payrollEventsTable     = $('payrollEventsTable');
    const noPayrollEvents        = $('noPayrollEvents');
    const payrollEventCount      = $('payrollEventCount');

    // Toast
    const toast       = $('toast');
    const toastIcon   = $('toastIcon');
    const toastMessage = $('toastMessage');

    // Modals
    const eventModal   = $('payrollEventModal');
    const crewModal    = $('payrollCrewModal');
    const timeLogModal = $('payrollTimeLogModal');
    const confirmModal = $('payrollConfirmModal');

    let submittedEvents = [];
    let allAttendance = [];
    let cachedEmployees = [];
    let selectedEventId = null;
    let editingCrewId = null;
    let editingTimeLogId = null;
    let selectedFtEmployeeId = null;
    let confirmCallback = null;

    // ============================================
    //  UTILITY
    // ============================================
    function showToast(message, type = 'success') {
        toastIcon.textContent = type === 'success' ? '✅' : '❌';
        toastMessage.textContent = message;
        toast.className = 'toast show ' + type;
        setTimeout(() => { toast.className = 'toast'; }, 3000);
    }

    function showConfirm(message, callback, okText = 'Confirm') {
        $('payrollConfirmMessage').textContent = message;
        confirmCallback = callback;
        const okBtn = $('payrollConfirmOk');
        okBtn.textContent = okText;
        if (okText === 'Delete') {
            okBtn.className = 'btn btn-danger';
        } else {
            okBtn.className = 'btn btn-primary';
        }
        confirmModal.classList.add('show');
    }

    function hideConfirm() {
        confirmModal.classList.remove('show');
        confirmCallback = null;
    }

    function openModal(m)  { m.classList.add('show'); }
    function closeModal(m) { m.classList.remove('show'); }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    // ============================================
    //  INIT
    // ============================================
    async function init() {
        if (!window.AUTH || !AUTH.init()) return;
        try { cachedEmployees = await apiFetch(API_EMPLOYEES); } catch(e) { cachedEmployees = []; }
    }

    // ============================================
    //  ROLE CHECK
    // ============================================
    function canEditPayroll() {
        const role = window.AUTH ? AUTH.getUserRole() : '';
        return role === 'business_owner' || role === 'finance_staff' || role === 'admin_assistant';
    }

    // Search input listeners
    const payrollEventSearchInput = $('payrollEventSearch');
    if (payrollEventSearchInput) payrollEventSearchInput.addEventListener('input', () => renderEventsTable());
    const ftSubmittedSearchInput = $('ftSubmittedSearch');
    if (ftSubmittedSearchInput) ftSubmittedSearchInput.addEventListener('input', () => renderFtSubmittedTable());

    // ============================================
    //  NAVIGATION
    // ============================================
    viewSubmittedBtn.addEventListener('click', async () => {
        payrollMainView.style.display = 'none';
        submittedAttendancesView.style.display = '';
        submittedListView.style.display = '';
        submittedDetailView.style.display = 'none';
        await loadSubmittedEvents();
        renderEventsTable();
    });

    viewFtSubmittedBtn.addEventListener('click', async () => {
        payrollMainView.style.display = 'none';
        ftSubmittedView.style.display = '';
        ftSubmittedListView.style.display = '';
        ftSubmittedDetailView.style.display = 'none';
        await loadFtSubmittedEmployees();
        renderFtSubmittedTable();
    });

    backToPayrollBtn.addEventListener('click', () => {
        submittedAttendancesView.style.display = 'none';
        payrollMainView.style.display = '';
    });

    backToPayrollFromFt.addEventListener('click', () => {
        ftSubmittedView.style.display = 'none';
        payrollMainView.style.display = '';
    });

    backToSubmittedList.addEventListener('click', () => {
        submittedDetailView.style.display = 'none';
        submittedListView.style.display = '';
        selectedEventId = null;
    });

    backToFtSubmittedList.addEventListener('click', () => {
        ftSubmittedDetailView.style.display = 'none';
        ftSubmittedListView.style.display = '';
        selectedFtEmployeeId = null;
    });

    // ============================================
    //  LOAD DATA
    // ============================================
    async function loadSubmittedEvents() {
        try {
            submittedEvents = await apiFetch(`${API_EVENTS}?submittedOnly=true`);
        } catch (e) {
            console.error('Load submitted events failed:', e);
            submittedEvents = [];
        }
        try {
            allAttendance = await apiFetch(API_EVENT_ATT);
        } catch (e) {
            allAttendance = [];
        }
    }

    // ============================================
    //  RENDER SUBMITTED EVENTS TABLE
    // ============================================
    function renderEventsTable() {
        payrollEventsBody.innerHTML = '';

        const searchTerm = ($('payrollEventSearch') ? $('payrollEventSearch').value : '').toLowerCase().trim();
        const filtered = submittedEvents.filter(evt => {
            if (!searchTerm) return true;
            return (evt.eventName || '').toLowerCase().includes(searchTerm) ||
                   (evt.eventVenue || '').toLowerCase().includes(searchTerm) ||
                   (evt.eventDate || '').toLowerCase().includes(searchTerm);
        });

        if (filtered.length === 0) {
            noPayrollEvents.style.display = 'flex';
            payrollEventsTable.style.display = 'none';
            payrollEventCount.textContent = '0 submitted events';
            return;
        }

        noPayrollEvents.style.display = 'none';
        payrollEventsTable.style.display = 'table';
        payrollEventCount.textContent = `${filtered.length} submitted event${filtered.length !== 1 ? 's' : ''}`;

        filtered.forEach(evt => {
            const crewCount = allAttendance.filter(a => a.eventId === evt.id).length;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${evt.eventName}</strong></td>
                <td>${evt.eventVenue || '—'}</td>
                <td>${formatDate(evt.eventDate)}</td>
                <td>${crewCount}</td>
                <td>
                    <div class="action-btns">
                        <button class="text-action-btn view-btn view-payroll-event" data-id="${evt.id}">View</button>
                    </div>
                </td>
            `;
            payrollEventsBody.appendChild(tr);
        });

        document.querySelectorAll('.view-payroll-event').forEach(btn => {
            btn.addEventListener('click', async () => {
                await showEventDetail(parseInt(btn.dataset.id));
            });
        });
    }

    // ============================================
    //  SHOW EVENT DETAIL + CREW ATTENDANCE
    // ============================================
    async function showEventDetail(eventId) {
        selectedEventId = eventId;
        const evt = submittedEvents.find(e => e.id === eventId);
        if (!evt) return;

        let crewRecords = [];
        try {
            crewRecords = await apiFetch(`${API_EVENT_ATT}?eventId=${eventId}`);
        } catch (e) {
            crewRecords = [];
        }

        $('payrollDetailTitle').textContent = evt.eventName;
        $('payrollEventVenue').textContent = evt.eventVenue || '—';
        $('payrollEventDate').textContent = formatDate(evt.eventDate);
        $('payrollCrewCount').textContent = crewRecords.length;

        // Show/hide edit controls based on role
        const editable = canEditPayroll();
        const editBtn = $('editPayrollEventBtn');
        const deleteBtn = $('deletePayrollEventBtn');
        const addCrewBtn = $('addPayrollCrewBtn');
        if (editBtn) editBtn.style.display = editable ? '' : 'none';
        if (deleteBtn) deleteBtn.style.display = editable ? '' : 'none';
        if (addCrewBtn) addCrewBtn.style.display = editable ? '' : 'none';

        // Switch views
        submittedListView.style.display = 'none';
        submittedDetailView.style.display = '';

        // Render crew table
        renderCrewTable(crewRecords, editable);
    }

    function renderCrewTable(crewRecords, editable) {
        const crewBody = $('payrollCrewBody');
        const noPayrollCrew = $('noPayrollCrew');
        const crewTable = $('payrollCrewTable');
        crewBody.innerHTML = '';

        if (crewRecords.length === 0) {
            noPayrollCrew.style.display = 'flex';
            crewTable.style.display = 'none';
            return;
        }

        noPayrollCrew.style.display = 'none';
        crewTable.style.display = 'table';

        crewRecords.forEach(rec => {
            const perfBadge = rec.workPerformance
                ? `<span class="perf-badge perf-${(rec.workPerformance || '').toLowerCase().replace(/\s+/g, '-')}">${rec.workPerformance}</span>`
                : '—';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${rec.employeeName || 'Unknown'}</strong></td>
                <td>${rec.role || '—'}</td>
                <td>${rec.assignment || '—'}</td>
                <td>${perfBadge}</td>
                <td>${rec.evaluationReason || '—'}</td>
                <td>
                    ${editable ? `<div class="action-btns">
                        <button class="text-action-btn edit-btn edit-payroll-crew" data-id="${rec.id}">Edit</button>
                        <button class="text-action-btn delete-btn delete-payroll-crew" data-id="${rec.id}">Delete</button>
                    </div>` : '—'}
                </td>
            `;
            crewBody.appendChild(tr);
        });

        // Attach edit handlers
        document.querySelectorAll('.edit-payroll-crew').forEach(btn => {
            btn.addEventListener('click', () => {
                const rec = crewRecords.find(r => r.id === parseInt(btn.dataset.id));
                if (!rec) return;
                editingCrewId = rec.id;
                $('payrollCrewModalTitle').textContent = 'Edit Crew Member';
                populateCrewSelect();
                $('payrollCrewMember').value = rec.employeeId;
                $('payrollCrewRole').value = rec.role || '';
                $('payrollCrewAssignment').value = rec.assignment || '';
                $('payrollCrewPerformance').value = rec.workPerformance || '';
                $('payrollCrewEvaluation').value = rec.evaluationReason || '';
                openModal(crewModal);
            });
        });

        // Attach delete handlers
        document.querySelectorAll('.delete-payroll-crew').forEach(btn => {
            btn.addEventListener('click', () => {
                showConfirm('Delete this attendance record?', async () => {
                    try {
                        await apiFetch(`${API_EVENT_ATT}/${btn.dataset.id}`, { method: 'DELETE' });
                        showToast('Attendance record deleted');
                        await refreshDetail();
                    } catch(err) { showToast(err.message || 'Delete failed', 'error'); }
                }, 'Delete');
            });
        });
    }

    // ============================================
    //  EDIT EVENT
    // ============================================
    if ($('editPayrollEventBtn')) {
        $('editPayrollEventBtn').addEventListener('click', () => {
            if (!selectedEventId) return;
            const evt = submittedEvents.find(e => e.id === selectedEventId);
            if (!evt) return;
            $('payrollEventModalTitle').textContent = 'Edit Event';
            $('payrollEventName').value = evt.eventName;
            $('payrollEventVenueInput').value = evt.eventVenue || '';
            $('payrollEventDateInput').value = evt.eventDate;
            openModal(eventModal);
        });
    }

    $('payrollEventForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedEventId) return;
        const data = {
            eventName: $('payrollEventName').value.trim(),
            eventDate: $('payrollEventDateInput').value,
            eventVenue: $('payrollEventVenueInput').value.trim(),
            eventClient: '',
            contractPrice: 0
        };
        try {
            await apiFetch(`${API_EVENTS}/${selectedEventId}`, { method: 'PUT', body: JSON.stringify(data) });
            showToast('Event updated successfully');
            closeModal(eventModal);
            await loadSubmittedEvents();
            renderEventsTable();
            await showEventDetail(selectedEventId);
        } catch(err) { showToast(err.message || 'Save failed', 'error'); }
    });

    $('cancelPayrollEventModal').addEventListener('click', () => closeModal(eventModal));
    $('closePayrollEventModal').addEventListener('click', () => closeModal(eventModal));

    // Delete Event from payroll detail
    if ($('deletePayrollEventBtn')) {
        $('deletePayrollEventBtn').addEventListener('click', () => {
            if (!selectedEventId) return;
            showConfirm('Delete this event and all its attendance records?', async () => {
                try {
                    await apiFetch(`${API_EVENTS}/${selectedEventId}`, { method: 'DELETE' });
                    selectedEventId = null;
                    submittedDetailView.style.display = 'none';
                    submittedListView.style.display = '';
                    await loadSubmittedEvents();
                    renderEventsTable();
                    showToast('Event deleted successfully');
                } catch(err) { showToast(err.message || 'Delete failed', 'error'); }
            }, 'Delete');
        });
    }

    // ============================================
    //  ADD/EDIT CREW
    // ============================================
    function populateCrewSelect() {
        const sel = $('payrollCrewMember');
        const oncall = cachedEmployees.filter(e => e.employeeType === 'on-call' && e.status === 'active');
        sel.innerHTML = '<option value="">— Select On-Call Employee —</option>';
        oncall.forEach(e => {
            sel.innerHTML += `<option value="${e.id}">${e.firstName} ${e.lastName}</option>`;
        });
    }

    if ($('addPayrollCrewBtn')) {
        $('addPayrollCrewBtn').addEventListener('click', () => {
            editingCrewId = null;
            $('payrollCrewModalTitle').textContent = 'Add Crew Member';
            $('payrollCrewForm').reset();
            populateCrewSelect();
            openModal(crewModal);
        });
    }

    $('payrollCrewForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedEventId) return;
        const data = {
            eventId: selectedEventId,
            employeeId: parseInt($('payrollCrewMember').value),
            role: $('payrollCrewRole').value.trim(),
            assignment: $('payrollCrewAssignment').value.trim(),
            arrivalTime: null,
            departureTime: null,
            status: 'Present',
            hoursWorked: 0,
            overtimeHours: 0,
            notes: '',
            workPerformance: $('payrollCrewPerformance').value,
            evaluationReason: $('payrollCrewEvaluation').value.trim()
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
            await refreshDetail();
        } catch(err) { showToast(err.message || 'Save failed', 'error'); }
    });

    $('cancelPayrollCrewModal').addEventListener('click', () => closeModal(crewModal));
    $('closePayrollCrewModal').addEventListener('click', () => closeModal(crewModal));

    // ============================================
    //  FT SUBMITTED: LOAD DATA
    // ============================================
    let ftSubmittedEmployees = [];

    async function loadFtSubmittedEmployees() {
        try {
            ftSubmittedEmployees = await apiFetch(`${API_TIMELOGS}/submitted-employees`);
        } catch (e) {
            console.error('Load FT submitted employees failed:', e);
            ftSubmittedEmployees = [];
        }
    }

    // ============================================
    //  FT SUBMITTED: RENDER EMPLOYEE TABLE
    // ============================================
    function renderFtSubmittedTable() {
        const body = $('ftSubmittedBody');
        const table = $('ftSubmittedTable');
        const empty = $('noFtSubmitted');
        const count = $('ftSubmittedCount');
        body.innerHTML = '';

        const searchTerm = ($('ftSubmittedSearch') ? $('ftSubmittedSearch').value : '').toLowerCase().trim();
        const filtered = ftSubmittedEmployees.filter(emp => {
            if (!searchTerm) return true;
            return (emp.employeeName || '').toLowerCase().includes(searchTerm) ||
                   (emp.position || '').toLowerCase().includes(searchTerm);
        });

        if (filtered.length === 0) {
            empty.style.display = 'flex';
            table.style.display = 'none';
            count.textContent = '0 submitted employees';
            return;
        }

        empty.style.display = 'none';
        table.style.display = 'table';
        count.textContent = `${filtered.length} submitted employee${filtered.length !== 1 ? 's' : ''}`;

        const editable = canEditPayroll();

        filtered.forEach(emp => {
            const delBtn = editable
                ? `<button class="text-action-btn delete-btn delete-ft-employee" data-id="${emp.employeeId}">Delete</button>`
                : '';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${emp.employeeName}</strong></td>
                <td>${formatPosition(emp.position)}</td>
                <td>
                    <div class="action-btns">
                        <button class="text-action-btn view-btn view-ft-employee" data-id="${emp.employeeId}">View</button>
                        ${delBtn}
                    </div>
                </td>
            `;
            body.appendChild(tr);
        });

        document.querySelectorAll('.view-ft-employee').forEach(btn => {
            btn.addEventListener('click', async () => {
                await showFtEmployeeDetail(parseInt(btn.dataset.id));
            });
        });

        document.querySelectorAll('.delete-ft-employee').forEach(btn => {
            btn.addEventListener('click', () => {
                const empId = parseInt(btn.dataset.id);
                const emp = ftSubmittedEmployees.find(e => e.employeeId === empId);
                const name = emp ? emp.employeeName : 'this employee';
                showConfirm(`Delete all submitted time logs for ${name}?`, async () => {
                    try {
                        const logs = await apiFetch(`${API_TIMELOGS}?employeeId=${empId}&submittedOnly=true`);
                        for (const log of logs) {
                            await apiFetch(`${API_TIMELOGS}/${log.id}`, { method: 'DELETE' });
                        }
                        showToast('Employee time logs deleted successfully');
                        await loadFtSubmittedEmployees();
                        renderFtSubmittedTable();
                    } catch(err) { showToast(err.message || 'Delete failed', 'error'); }
                }, 'Delete');
            });
        });
    }

    // ============================================
    //  FT SUBMITTED: SHOW EMPLOYEE DETAIL
    // ============================================
    async function showFtEmployeeDetail(employeeId) {
        selectedFtEmployeeId = employeeId;
        const emp = ftSubmittedEmployees.find(e => e.employeeId === employeeId);
        if (!emp) return;

        let logs = [];
        try {
            logs = await apiFetch(`${API_TIMELOGS}?employeeId=${employeeId}&submittedOnly=true`);
        } catch (e) {
            logs = [];
        }

        $('ftDetailTitle').textContent = emp.employeeName;

        // Switch views
        ftSubmittedListView.style.display = 'none';
        ftSubmittedDetailView.style.display = '';

        // Render flat time logs table
        renderFtDetailLogs(logs, employeeId);
    }

    function calcHours(timeIn, timeOut) {
        if (!timeIn || !timeOut) return 0;
        const [hIn, mIn] = timeIn.split(':').map(Number);
        const [hOut, mOut] = timeOut.split(':').map(Number);
        const diff = (hOut * 60 + mOut) - (hIn * 60 + mIn);
        return diff > 0 ? Math.round(diff / 60 * 100) / 100 : 0;
    }

    function getTimeDiffStatus(timeIn) {
        if (!timeIn) return 'Present';
        const [h, m] = timeIn.split(':').map(Number);
        return (h > 8 || (h === 8 && m > 0)) ? 'Late' : 'Present';
    }

    function formatTime(t) {
        if (!t) return '—';
        const [h, m] = t.split(':');
        const hr = parseInt(h);
        const ampm = hr >= 12 ? 'PM' : 'AM';
        const hr12 = hr % 12 || 12;
        return `${hr12}:${m} ${ampm}`;
    }

    function statusBadge(s) {
        const cls = s === 'Late' ? 'status-pending' : s === 'Absent' ? 'status-rejected' : 'status-approved';
        return `<span class="status-badge ${cls}">${s}</span>`;
    }

    function formatPosition(pos) {
        if (!pos) return '—';
        return pos
            .replace(/_/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase())
            .replace(/Fulltime/i, 'Full-Time')
            .replace(/On Call/i, 'On-Call');
    }

    function renderFtDetailLogs(logs, employeeId) {
        const body = $('ftDetailLogsBody');
        const table = $('ftDetailLogsTable');
        const empty = $('noFtDetailLogs');
        const editable = canEditPayroll();
        body.innerHTML = '';

        logs.sort((a, b) => {
            if (b.date !== a.date) return b.date.localeCompare(a.date);
            return (a.timeIn || '').localeCompare(b.timeIn || '');
        });

        if (logs.length === 0) {
            empty.style.display = 'flex';
            table.style.display = 'none';
            return;
        }

        empty.style.display = 'none';
        table.style.display = 'table';

        logs.forEach(log => {
            const isOpen = log.timeIn && !log.timeOut;
            const tr = document.createElement('tr');
            if (isOpen) tr.className = 'tl-row-open';
            tr.innerHTML = `
                <td>${formatDate(log.date)}</td>
                <td>${formatTime(log.timeIn)}</td>
                <td>${isOpen ? '<em class="tl-pending-text">Pending</em>' : formatTime(log.timeOut)}</td>
                <td>${log.totalHours ? log.totalHours + ' hrs' : '—'}</td>
                <td>${log.notes || '—'}</td>
                <td>${log.notesOut || '—'}</td>
                ${editable ? `<td><div class="action-btns"><button class="text-action-btn edit-btn edit-ft-log" data-id="${log.id}">Edit</button><button class="text-action-btn delete-btn delete-ft-log" data-id="${log.id}">Delete</button></div></td>` : '<td></td>'}
            `;
            body.appendChild(tr);
        });

        // Attach edit handlers
        document.querySelectorAll('.edit-ft-log').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const log = logs.find(l => l.id === parseInt(btn.dataset.id));
                if (!log) return;
                editingTimeLogId = log.id;
                $('payrollTimeLogModalTitle').textContent = 'Edit Time Log';
                $('payrollTimeLogDate').value = log.date;
                $('payrollTimeLogIn').value = log.timeIn || '';
                $('payrollTimeLogOut').value = log.timeOut || '';
                $('payrollTimeLogRemarks').value = log.notes || '';
                $('payrollTimeLogRemarksOut').value = log.notesOut || '';
                openModal(timeLogModal);
            });
        });

        // Attach delete handlers
        document.querySelectorAll('.delete-ft-log').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                showConfirm('Delete this time log?', async () => {
                    try {
                        await apiFetch(`${API_TIMELOGS}/${btn.dataset.id}`, { method: 'DELETE' });
                        showToast('Time log deleted');
                        await showFtEmployeeDetail(selectedFtEmployeeId);
                    } catch(err) { showToast(err.message || 'Delete failed', 'error'); }
                }, 'Delete');
            });
        });
    }

    // ============================================
    //  FT SUBMITTED: TIME LOG EDIT MODAL
    // ============================================
    $('payrollTimeLogForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!editingTimeLogId || !selectedFtEmployeeId) return;

        const timeIn = $('payrollTimeLogIn').value;
        const timeOut = $('payrollTimeLogOut').value;

        const data = {
            employeeId: selectedFtEmployeeId,
            date: $('payrollTimeLogDate').value,
            timeIn: timeIn,
            timeOut: timeOut,
            totalHours: calcHours(timeIn, timeOut),
            notes: $('payrollTimeLogRemarks').value.trim(),
            notesOut: $('payrollTimeLogRemarksOut').value.trim()
        };
        try {
            await apiFetch(`${API_TIMELOGS}/${editingTimeLogId}`, { method: 'PUT', body: JSON.stringify(data) });
            showToast('Time log updated');
            closeModal(timeLogModal);
            await showFtEmployeeDetail(selectedFtEmployeeId);
        } catch(err) { showToast(err.message || 'Save failed', 'error'); }
    });

    $('cancelPayrollTimeLogModal').addEventListener('click', () => closeModal(timeLogModal));
    $('closePayrollTimeLogModal').addEventListener('click', () => closeModal(timeLogModal));

    // ============================================
    //  CONFIRM DIALOG
    // ============================================
    $('payrollConfirmOk').addEventListener('click', () => {
        if (confirmCallback) confirmCallback();
        hideConfirm();
    });
    $('payrollConfirmCancel').addEventListener('click', hideConfirm);
    $('closePayrollConfirm').addEventListener('click', hideConfirm);

    // Close modals on overlay click
    [eventModal, crewModal, timeLogModal, confirmModal].forEach(m => {
        m.addEventListener('click', (e) => {
            if (e.target === m) closeModal(m);
        });
    });

    // ============================================
    //  REFRESH DETAIL VIEW
    // ============================================
    async function refreshDetail() {
        if (!selectedEventId) return;
        await loadSubmittedEvents();
        renderEventsTable();
        await showEventDetail(selectedEventId);
    }

    // ============================================
    //  START
    // ============================================
    init();
});
