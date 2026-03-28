// ============================================
// PAYROLL MODULE — On-Call Payroll Processing
// Red Damien Entertainment Payroll System
// ============================================

document.addEventListener('DOMContentLoaded', function () {

    const API_EMPLOYEES = '/payroll/api/employees';
    const API_EVENTS    = '/payroll/api/events';
    const API_EVENT_ATT = '/payroll/api/event-attendance';
    const API_TIMELOGS  = '/payroll/api/timelogs';
    const API_PAYROLL   = '/payroll/api/payroll';

    async function apiFetch(url, options = {}) {
        const resp = await fetch(url, {
            headers: { 'Content-Type': 'application/json' },
            ...options
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'Request failed');
        return data;
    }

    const $ = id => document.getElementById(id);

    // ─── Views ───
    const payrollMainView          = $('payrollMainView');
    const submittedAttendancesView = $('submittedAttendancesView');
    const submittedListView        = $('submittedListView');
    const submittedDetailView      = $('submittedDetailView');
    const ftSubmittedView          = $('ftSubmittedView');
    const ftSubmittedListView      = $('ftSubmittedListView');
    const ftSubmittedDetailView    = $('ftSubmittedDetailView');

    // ─── Buttons ───
    const viewSubmittedBtn      = $('viewSubmittedBtn');
    const viewFtSubmittedBtn    = $('viewFtSubmittedBtn');
    const backToPayrollBtn      = $('backToPayrollBtn');
    const backToPayrollFromFt   = $('backToPayrollFromFt');
    const backToSubmittedList   = $('backToSubmittedList');
    const backToFtSubmittedList = $('backToFtSubmittedList');

    // ─── Tables ───
    const payrollEventsBody  = $('payrollEventsBody');
    const payrollEventsTable = $('payrollEventsTable');
    const noPayrollEvents    = $('noPayrollEvents');
    const payrollEventCount  = $('payrollEventCount');

    // ─── Toast ───
    const toast        = $('toast');
    const toastIcon    = $('toastIcon');
    const toastMessage = $('toastMessage');

    // ─── Modals ───
    const confirmModal       = $('payrollConfirmModal');
    const contractPriceModal = $('contractPriceModal');
    const deptModal          = $('deptModal');
    const empPayrollModal    = $('empPayrollModal');
    const cashAdvanceModal   = $('cashAdvanceModal');
    const cashLoanModal      = $('cashLoanModal');
    const penaltyModal       = $('penaltyModal');
    const timeLogModal       = $('payrollTimeLogModal');

    let submittedEvents = [];
    let allAttendance = [];
    let cachedEmployees = [];
    let selectedEventId = null;
    let selectedEvent = null;
    let departments = [];
    let employeePayroll = [];
    let eventCrewIds = [];
    let editingDeptId = null;
    let editingEmpPayrollId = null;
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
        okBtn.className = okText === 'Delete' ? 'btn btn-danger' : 'btn btn-primary';
        confirmModal.classList.add('show');
    }

    function hideConfirm() { confirmModal.classList.remove('show'); confirmCallback = null; }
    function openModal(m)  { m.classList.add('show'); }
    function closeModal(m) { m.classList.remove('show'); }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    function peso(n) {
        return '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function formatTime(t) {
        if (!t) return '—';
        const [h, m] = t.split(':');
        const hr = parseInt(h);
        const ampm = hr >= 12 ? 'PM' : 'AM';
        return `${hr % 12 || 12}:${m} ${ampm}`;
    }

    function formatPosition(pos) {
        if (!pos) return '—';
        return pos.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    // ============================================
    //  INIT
    // ============================================
    async function init() {
        if (!window.AUTH || !AUTH.init()) return;
        try { cachedEmployees = await apiFetch(API_EMPLOYEES); } catch(e) { cachedEmployees = []; }
    }

    function canEditPayroll() {
        const role = window.AUTH ? AUTH.getUserRole() : '';
        return role === 'business_owner' || role === 'finance_staff' || role === 'admin_assistant';
    }

    // Search listeners
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
        selectedEvent = null;
    });

    backToFtSubmittedList.addEventListener('click', () => {
        ftSubmittedDetailView.style.display = 'none';
        ftSubmittedListView.style.display = '';
        selectedFtEmployeeId = null;
    });

    // ============================================
    //  LOAD SUBMITTED EVENTS
    // ============================================
    async function loadSubmittedEvents() {
        try { submittedEvents = await apiFetch(`${API_EVENTS}?submittedOnly=true`); } catch(e) { submittedEvents = []; }
        try { allAttendance = await apiFetch(API_EVENT_ATT); } catch(e) { allAttendance = []; }
    }

    function renderEventsTable() {
        payrollEventsBody.innerHTML = '';
        const search = ($('payrollEventSearch') ? $('payrollEventSearch').value : '').toLowerCase().trim();
        const filtered = submittedEvents.filter(evt => {
            if (!search) return true;
            return (evt.eventName || '').toLowerCase().includes(search) ||
                   (evt.eventVenue || '').toLowerCase().includes(search);
        });

        if (filtered.length === 0) {
            noPayrollEvents.style.display = 'flex';
            payrollEventsTable.style.display = 'none';
            payrollEventCount.textContent = '0 events';
            return;
        }

        noPayrollEvents.style.display = 'none';
        payrollEventsTable.style.display = 'table';
        payrollEventCount.textContent = `${filtered.length} event${filtered.length !== 1 ? 's' : ''}`;

        filtered.forEach(evt => {
            const crewCount = allAttendance.filter(a => a.eventId === evt.id).length;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${evt.eventName}</strong></td>
                <td>${evt.eventVenue || '—'}</td>
                <td>${formatDate(evt.eventDate)}</td>
                <td>${crewCount}</td>
                <td><div class="action-btns">
                    <button class="text-action-btn view-btn view-payroll-event" data-id="${evt.id}">Process Payroll</button>
                </div></td>`;
            payrollEventsBody.appendChild(tr);
        });

        document.querySelectorAll('.view-payroll-event').forEach(btn => {
            btn.addEventListener('click', async () => { await showEventDetail(parseInt(btn.dataset.id)); });
        });
    }

    // ============================================
    //  SHOW EVENT DETAIL — PAYROLL VIEW
    // ============================================
    async function showEventDetail(eventId) {
        selectedEventId = eventId;
        selectedEvent = submittedEvents.find(e => e.id === eventId);
        if (!selectedEvent) return;

        // Load crew for this event
        let crewRecords = [];
        try { crewRecords = await apiFetch(`${API_EVENT_ATT}?eventId=${eventId}`); } catch(e) {}
        eventCrewIds = crewRecords.map(c => c.employeeId);

        $('payrollDetailTitle').textContent = selectedEvent.eventName;
        $('payrollEventVenue').textContent = selectedEvent.eventVenue || '—';
        $('payrollEventDate').textContent = formatDate(selectedEvent.eventDate);
        $('payrollCrewCount').textContent = crewRecords.length;
        $('payrollContractPrice').textContent = peso(selectedEvent.contractPrice);
        $('vatBadge').style.display = selectedEvent.vatIncluded ? 'inline-block' : 'none';
        updateMealBudgetDisplay();

        submittedListView.style.display = 'none';
        submittedDetailView.style.display = '';

        // Load departments & employee payroll
        await loadDepartments();
        await loadEmployeePayroll();
        renderDeptTable();
        renderPayrollTable();
        await loadDeductions();
    }

    // ============================================
    //  MEAL BUDGET DISPLAY HELPER
    // ============================================
    function updateMealBudgetDisplay() {
        if (!selectedEvent) return;
        const budget = selectedEvent.mealBudget || 0;
        const mealVatIncluded = selectedEvent.mealVatIncluded;
        $('payrollMealBudget').textContent = peso(budget);
        $('mealVatBadge').style.display = (mealVatIncluded && budget > 0) ? 'inline-block' : 'none';
    }

    // ============================================
    //  CONTRACT PRICE
    // ============================================
    $('editContractPriceBtn').addEventListener('click', () => {
        $('contractPriceInput').value = selectedEvent ? selectedEvent.contractPrice : 0;
        const vatIncluded = selectedEvent ? selectedEvent.vatIncluded : false;
        $('vatYes').checked = vatIncluded;
        $('vatNo').checked = !vatIncluded;
        $('vatPreview').textContent = '';
        openModal(contractPriceModal);
    });

    // Real-time preview as user types contract price
    $('contractPriceInput').addEventListener('input', updateVatPreview);
    document.querySelectorAll('input[name="vatChoice"]').forEach(r => r.addEventListener('change', updateVatPreview));

    function updateVatPreview() {
        const rawPrice = parseFloat($('contractPriceInput').value) || 0;
        const vatIncluded = $('vatYes').checked;
        const effectivePrice = vatIncluded ? rawPrice / 1.12 : rawPrice;
        if (rawPrice > 0 && vatIncluded) {
            $('vatPreview').textContent = `Effective (ex-VAT): ${peso(effectivePrice)}`;
        } else {
            $('vatPreview').textContent = '';
        }
        const totalAllocated = departments.reduce((s, d) => s + d.allocatedAmount, 0);
        const remaining = effectivePrice - totalAllocated;
        if ($('deptAllocatedTotal')) $('deptAllocatedTotal').textContent = `Allocated: ${peso(totalAllocated)}`;
        if ($('deptRemainingTotal')) {
            $('deptRemainingTotal').textContent = `Remaining: ${peso(remaining)}`;
            $('deptRemainingTotal').style.color = remaining < 0 ? 'var(--danger)' : remaining === 0 ? 'var(--success)' : 'var(--warning)';
        }
    }

    $('contractPriceForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const rawPrice = parseFloat($('contractPriceInput').value);
        const vatIncluded = $('vatYes').checked;
        const effectivePrice = vatIncluded ? rawPrice / 1.12 : rawPrice;
        try {
            await apiFetch(`${API_PAYROLL}/contract-price`, {
                method: 'PUT',
                body: JSON.stringify({ eventId: selectedEventId, contractPrice: effectivePrice, vatIncluded: vatIncluded })
            });
            selectedEvent.contractPrice = effectivePrice;
            selectedEvent.vatIncluded = vatIncluded;
            $('payrollContractPrice').textContent = peso(effectivePrice);
            $('vatBadge').style.display = vatIncluded ? 'inline-block' : 'none';
            updateMealBudgetDisplay();
            closeModal(contractPriceModal);
            renderDeptTable();
            showToast('Contract price updated');
        } catch(err) { showToast(err.message, 'error'); }
    });

    $('cancelContractPriceModal').addEventListener('click', () => closeModal(contractPriceModal));
    $('closeContractPriceModal').addEventListener('click', () => closeModal(contractPriceModal));

    // ============================================
    //  MEAL BUDGET
    // ============================================
    const mealBudgetModal = $('mealBudgetModal');

    $('editMealBudgetBtn').addEventListener('click', () => {
        $('mealBudgetInput').value = selectedEvent ? selectedEvent.mealBudget || 0 : 0;
        const mealVatIncluded = selectedEvent ? !!selectedEvent.mealVatIncluded : false;
        $('mealVatYes').checked = mealVatIncluded;
        $('mealVatNo').checked = !mealVatIncluded;
        $('mealVatPreview').textContent = '';
        openModal(mealBudgetModal);
    });

    $('mealBudgetInput').addEventListener('input', updateMealVatPreview);
    document.querySelectorAll('input[name="mealVatChoice"]').forEach(r => r.addEventListener('change', updateMealVatPreview));

    function updateMealVatPreview() {
        const rawBudget = parseFloat($('mealBudgetInput').value) || 0;
        const mealVatIncluded = $('mealVatYes').checked;
        if (rawBudget > 0 && mealVatIncluded) {
            $('mealVatPreview').textContent = `Effective (ex-VAT): ${peso(rawBudget / 1.12)}`;
        } else {
            $('mealVatPreview').textContent = '';
        }
    }

    $('mealBudgetForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const rawBudget = parseFloat($('mealBudgetInput').value) || 0;
        const mealVatIncluded = $('mealVatYes').checked;
        const effectiveBudget = mealVatIncluded ? rawBudget / 1.12 : rawBudget;
        try {
            await apiFetch(`${API_PAYROLL}/meal-budget`, {
                method: 'PUT',
                body: JSON.stringify({ eventId: selectedEventId, mealBudget: effectiveBudget, mealVatIncluded: mealVatIncluded })
            });
            selectedEvent.mealBudget = effectiveBudget;
            selectedEvent.mealVatIncluded = mealVatIncluded;
            updateMealBudgetDisplay();
            closeModal(mealBudgetModal);
            showToast('Meal budget updated');
        } catch(err) { showToast(err.message, 'error'); }
    });

    $('cancelMealBudgetModal').addEventListener('click', () => closeModal(mealBudgetModal));
    $('closeMealBudgetModal').addEventListener('click', () => closeModal(mealBudgetModal));
    if (mealBudgetModal) mealBudgetModal.addEventListener('click', e => { if (e.target === mealBudgetModal) closeModal(mealBudgetModal); });

    // ============================================
    //  DEPARTMENTS
    // ============================================
    async function loadDepartments() {
        try { departments = await apiFetch(`${API_PAYROLL}/departments?eventId=${selectedEventId}`); } catch(e) { departments = []; }
    }

    function renderDeptTable() {
        const body = $('deptBody');
        const table = $('deptTable');
        const empty = $('noDepts');
        body.innerHTML = '';

        const totalAllocated = departments.reduce((s, d) => s + d.allocatedAmount, 0);
        const contractPrice = selectedEvent ? selectedEvent.contractPrice : 0;
        const remaining = contractPrice - totalAllocated;

        $('deptAllocatedTotal').textContent = `Allocated: ${peso(totalAllocated)}`;
        $('deptRemainingTotal').textContent = `Remaining: ${peso(remaining)}`;
        $('deptRemainingTotal').style.color = remaining < 0 ? 'var(--danger)' : remaining === 0 ? 'var(--success)' : 'var(--warning)';

        if (departments.length === 0) {
            empty.style.display = 'flex';
            table.style.display = 'none';
            return;
        }

        empty.style.display = 'none';
        table.style.display = 'table';

        departments.forEach(dept => {
            // Count crew in this department
            const crewInDept = employeePayroll.filter(ep => ep.department === dept.departmentName).length;
            const ratePerPerson = crewInDept > 0 ? dept.allocatedAmount / crewInDept : dept.allocatedAmount;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${dept.departmentName}</strong></td>
                <td>${peso(dept.allocatedAmount)}</td>
                <td>${crewInDept}</td>
                <td>${peso(ratePerPerson)}</td>
                <td><div class="action-btns">
                    <button class="text-action-btn edit-btn edit-dept" data-id="${dept.id}">Edit</button>
                    <button class="text-action-btn delete-btn delete-dept" data-id="${dept.id}">Delete</button>
                </div></td>`;
            body.appendChild(tr);
        });

        document.querySelectorAll('.edit-dept').forEach(btn => {
            btn.addEventListener('click', () => {
                const dept = departments.find(d => d.id === parseInt(btn.dataset.id));
                if (!dept) return;
                editingDeptId = dept.id;
                $('deptModalTitle').textContent = 'Edit Department';
                $('deptNameInput').value = dept.departmentName;
                $('deptAmountInput').value = dept.allocatedAmount;
                openModal(deptModal);
            });
        });

        document.querySelectorAll('.delete-dept').forEach(btn => {
            btn.addEventListener('click', () => {
                showConfirm('Delete this department?', async () => {
                    try {
                        await apiFetch(`${API_PAYROLL}/departments/${btn.dataset.id}`, { method: 'DELETE' });
                        showToast('Department deleted');
                        await loadDepartments();
                        renderDeptTable();
                    } catch(err) { showToast(err.message, 'error'); }
                }, 'Delete');
            });
        });
    }

    $('addDeptBtn').addEventListener('click', () => {
        editingDeptId = null;
        $('deptModalTitle').textContent = 'Add Department';
        $('deptForm').reset();
        if ($('deptRatePreview')) $('deptRatePreview').textContent = '';
        openModal(deptModal);
    });

    // Real-time rate preview as user types allocated amount
    $('deptAmountInput').addEventListener('input', () => {
        const amount = parseFloat($('deptAmountInput').value) || 0;
        const deptName = $('deptNameInput').value.trim();
        const crewInDept = employeePayroll.filter(ep => ep.department === deptName).length;
        const preview = $('deptRatePreview');
        if (preview && amount > 0) {
            if (crewInDept > 0) {
                preview.textContent = `Rate per crew: ${peso(amount / crewInDept)} (${crewInDept} crew)`;
            } else {
                preview.textContent = `Allocated: ${peso(amount)} — assign crew to see rate per person`;
            }
        } else if (preview) {
            preview.textContent = '';
        }
    });

    $('deptForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            eventId: selectedEventId,
            departmentName: $('deptNameInput').value.trim(),
            allocatedAmount: parseFloat($('deptAmountInput').value)
        };
        try {
            if (editingDeptId) {
                await apiFetch(`${API_PAYROLL}/departments/${editingDeptId}`, { method: 'PUT', body: JSON.stringify(data) });
                showToast('Department updated');
            } else {
                await apiFetch(`${API_PAYROLL}/departments`, { method: 'POST', body: JSON.stringify(data) });
                showToast('Department added');
            }
            closeModal(deptModal);
            await loadDepartments();
            renderDeptTable();
        } catch(err) { showToast(err.message, 'error'); }
    });

    $('cancelDeptModal').addEventListener('click', () => closeModal(deptModal));
    $('closeDeptModal').addEventListener('click', () => closeModal(deptModal));

    // ============================================
    //  EMPLOYEE PAYROLL
    // ============================================
    async function loadEmployeePayroll() {
        try { employeePayroll = await apiFetch(`${API_PAYROLL}/employee-payroll?eventId=${selectedEventId}`); } catch(e) { employeePayroll = []; }
    }

    function renderPayrollTable() {
        const body = $('payrollCrewBody');
        const table = $('payrollCrewTable');
        const empty = $('noPayrollCrew');
        const summary = $('payrollSummary');
        body.innerHTML = '';

        if (employeePayroll.length === 0) {
            empty.style.display = 'flex';
            table.style.display = 'none';
            summary.style.display = 'none';
            return;
        }

        empty.style.display = 'none';
        table.style.display = 'table';
        summary.style.display = '';

        let totalBase = 0, totalDeductions = 0, totalNet = 0;

        employeePayroll.forEach(ep => {
            // Compute live deductions from loaded deduction arrays
            const liveCA = cashAdvances
                .filter(ca => ca.employeeId === ep.employeeId)
                .reduce((s, ca) => s + ca.amount, 0);
            const liveLoan = cashLoansData
                .filter(cl => cl.employeeId === ep.employeeId && cl.status !== 'paid')
                .reduce((s, cl) => s + cl.installmentAmount, 0);
            const livePenalty = penaltiesData
                .filter(p => p.employeeId === ep.employeeId)
                .reduce((s, p) => s + p.amount, 0);

            // Use live values if deductions are loaded, otherwise fall back to stored
            const hasLiveData = cashAdvances.length > 0 || cashLoansData.length > 0 || penaltiesData.length > 0
                || (ep.cashAdvanceDeduction === 0 && ep.loanDeduction === 0 && ep.penaltyDeduction === 0);
            const caDisplay   = hasLiveData ? liveCA      : ep.cashAdvanceDeduction;
            const loanDisplay = hasLiveData ? liveLoan    : ep.loanDeduction;
            const penDisplay  = hasLiveData ? livePenalty : ep.penaltyDeduction;
            const netDisplay  = ep.baseRate - caDisplay - loanDisplay - penDisplay;

            const deductions = caDisplay + loanDisplay + penDisplay;
            totalBase += ep.baseRate;
            totalDeductions += deductions;
            totalNet += netDisplay;

            const statusCls = ep.status === 'paid' ? 'status-approved' : 'status-pending';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${ep.employeeName}</strong></td>
                <td>${ep.department || '—'}</td>
                <td>${peso(ep.baseRate)}</td>
                <td>${caDisplay > 0 ? '-' + peso(caDisplay) : '—'}</td>
                <td>${loanDisplay > 0 ? '-' + peso(loanDisplay) : '—'}</td>
                <td>${penDisplay > 0 ? '-' + peso(penDisplay) : '—'}</td>
                <td><strong>${peso(netDisplay)}</strong></td>
                <td><span class="status-badge ${statusCls}">${ep.status}</span></td>
                <td><div class="action-btns">
                    <button class="text-action-btn edit-btn edit-emp-payroll" data-id="${ep.id}">Edit</button>
                    <button class="text-action-btn delete-btn delete-emp-payroll" data-id="${ep.id}">Delete</button>
                </div></td>`;
            body.appendChild(tr);
        });

        $('summaryBaseRate').textContent = peso(totalBase);
        $('summaryDeductions').textContent = peso(totalDeductions);
        $('summaryNetPay').textContent = peso(totalNet);

        // Edit handlers
        document.querySelectorAll('.edit-emp-payroll').forEach(btn => {
            btn.addEventListener('click', () => {
                const ep = employeePayroll.find(r => r.id === parseInt(btn.dataset.id));
                if (!ep) return;
                editingEmpPayrollId = ep.id;
                $('empPayrollModalTitle').textContent = 'Edit Payroll — ' + ep.employeeName;
                $('empPayrollName').value = ep.employeeName;
                // Populate department dropdown
                const sel = $('empPayrollDept');
                sel.innerHTML = '<option value="">— None —</option>';
                departments.forEach(d => {
                    sel.innerHTML += `<option value="${d.departmentName}" ${d.departmentName === ep.department ? 'selected' : ''}>${d.departmentName}</option>`;
                });
                $('empPayrollRate').value = ep.baseRate;
                // Auto-fill deductions from live arrays (read-only inputs)
                const liveCA = cashAdvances.filter(ca => ca.employeeId === ep.employeeId).reduce((s, ca) => s + ca.amount, 0);
                const liveLoan = cashLoansData.filter(cl => cl.employeeId === ep.employeeId && cl.status !== 'paid').reduce((s, cl) => s + cl.installmentAmount, 0);
                const livePen = penaltiesData.filter(p => p.employeeId === ep.employeeId).reduce((s, p) => s + p.amount, 0);
                $('empPayrollCA').value = liveCA || ep.cashAdvanceDeduction;
                $('empPayrollLoan').value = liveLoan || ep.loanDeduction;
                $('empPayrollPenalty').value = livePen || ep.penaltyDeduction;
                updateNetPayPreview();
                updateDeptBudgetIndicator();
                openModal(empPayrollModal);
            });
        });

        // Delete handlers
        document.querySelectorAll('.delete-emp-payroll').forEach(btn => {
            btn.addEventListener('click', () => {
                showConfirm('Delete this payroll record?', async () => {
                    try {
                        await apiFetch(`${API_PAYROLL}/employee-payroll/${btn.dataset.id}`, { method: 'DELETE' });
                        showToast('Payroll record deleted');
                        await loadEmployeePayroll();
                        renderPayrollTable();
                        renderDeptTable();
                    } catch(err) { showToast(err.message, 'error'); }
                }, 'Delete');
            });
        });
    }

    // Department budget indicator in emp payroll modal
    function updateDeptBudgetIndicator() {
        const indicator = $('deptBudgetIndicator');
        if (!indicator) return;
        const deptName = $('empPayrollDept').value;
        if (!deptName) { indicator.style.display = 'none'; return; }
        const dept = departments.find(d => d.departmentName === deptName);
        if (!dept) { indicator.style.display = 'none'; return; }
        const currentRate = parseFloat($('empPayrollRate').value) || 0;
        const othersTotal = employeePayroll
            .filter(ep => ep.department === deptName && ep.id !== editingEmpPayrollId)
            .reduce((s, ep) => s + ep.baseRate, 0);
        const totalUsed = othersTotal + currentRate;
        const remaining = dept.allocatedAmount - totalUsed;
        const isOver = remaining < 0;
        indicator.style.display = 'block';
        indicator.style.borderLeft = `3px solid ${isOver ? 'var(--danger)' : 'var(--success)'}`;
        indicator.innerHTML = `<span style="color:${isOver ? 'var(--danger)' : 'var(--success)'};font-weight:600;">${isOver ? '⚠ Over budget by ' + peso(Math.abs(remaining)) : '✓ Within budget — ' + peso(remaining) + ' remaining'}</span><br><span style="color:var(--text-secondary,#666);">Dept allocated: ${peso(dept.allocatedAmount)} | Others: ${peso(othersTotal)} | This rate: ${peso(currentRate)}</span>`;
    }

    $('empPayrollDept').addEventListener('change', updateDeptBudgetIndicator);
    $('empPayrollRate').addEventListener('input', () => { updateNetPayPreview(); updateDeptBudgetIndicator(); });

    // Net pay preview in edit modal (only rate changes; deductions are read-only auto-filled)
    function updateNetPayPreview() {
        const base = parseFloat($('empPayrollRate').value) || 0;
        const ca = parseFloat($('empPayrollCA').value) || 0;
        const loan = parseFloat($('empPayrollLoan').value) || 0;
        const pen = parseFloat($('empPayrollPenalty').value) || 0;
        $('empPayrollNetPay').value = peso(base - ca - loan - pen);
    }

    $('empPayrollForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!editingEmpPayrollId) return;
        const data = {
            department: $('empPayrollDept').value,
            baseRate: parseFloat($('empPayrollRate').value) || 0,
            cashAdvanceDeduction: parseFloat($('empPayrollCA').value) || 0,
            loanDeduction: parseFloat($('empPayrollLoan').value) || 0,
            penaltyDeduction: parseFloat($('empPayrollPenalty').value) || 0,
            status: 'pending'
        };
        try {
            await apiFetch(`${API_PAYROLL}/employee-payroll/${editingEmpPayrollId}`, { method: 'PUT', body: JSON.stringify(data) });
            showToast('Payroll updated');
            closeModal(empPayrollModal);
            await loadEmployeePayroll();
            renderPayrollTable();
            renderDeptTable();
        } catch(err) { showToast(err.message, 'error'); }
    });

    $('cancelEmpPayrollModal').addEventListener('click', () => closeModal(empPayrollModal));
    $('closeEmpPayrollModal').addEventListener('click', () => closeModal(empPayrollModal));

    // Auto-generate payroll
    $('generatePayrollBtn').addEventListener('click', () => {
        if (departments.length === 0) {
            showToast('Add department breakdown first before generating payroll', 'error');
            return;
        }
        showConfirm('Auto-generate payroll for all crew based on department breakdown? This will create/update payroll records.', async () => {
            try {
                await apiFetch(`${API_PAYROLL}/generate`, {
                    method: 'POST',
                    body: JSON.stringify({ eventId: selectedEventId })
                });
                showToast('Payroll generated successfully');
                await loadEmployeePayroll();
                renderPayrollTable();
                renderDeptTable();
            } catch(err) { showToast(err.message, 'error'); }
        });
    });

    // ============================================
    //  DEDUCTIONS TABS
    // ============================================
    document.querySelectorAll('.deduction-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.deduction-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.deduction-panel').forEach(p => p.style.display = 'none');
            tab.classList.add('active');
            $(tab.dataset.tab).style.display = '';
        });
    });

    // ============================================
    //  CASH ADVANCES
    // ============================================
    let cashAdvances = [];
    let cashLoansData = [];
    let penaltiesData = [];

    async function loadDeductions() {
        cashAdvances = [];
        cashLoansData = [];
        penaltiesData = [];
        // Load cash advances & loans for all crew
        for (const empId of eventCrewIds) {
            try {
                const ca = await apiFetch(`${API_PAYROLL}/cash-advances?employeeId=${empId}`);
                cashAdvances.push(...ca);
            } catch(e) {}
            try {
                const cl = await apiFetch(`${API_PAYROLL}/cash-loans?employeeId=${empId}`);
                cashLoansData.push(...cl);
            } catch(e) {}
        }
        // Load penalties for event
        try {
            penaltiesData = await apiFetch(`${API_PAYROLL}/penalties?eventId=${selectedEventId}`);
        } catch(e) {}

        renderCashAdvances();
        renderCashLoans();
        renderPenalties();
        // Refresh crew payroll to reflect live deduction totals
        renderPayrollTable();
    }

    function getEmployeeName(empId) {
        const emp = cachedEmployees.find(e => e.id === empId);
        return emp ? `${emp.firstName} ${emp.lastName}` : `Employee #${empId}`;
    }

    function populateCrewSelect(selectId) {
        const sel = $(selectId);
        sel.innerHTML = '<option value="">— Select Employee —</option>';
        eventCrewIds.forEach(empId => {
            sel.innerHTML += `<option value="${empId}">${getEmployeeName(empId)}</option>`;
        });
    }

    // --- Cash Advance ---
    function renderCashAdvances() {
        const body = $('cashAdvanceBody');
        const table = $('cashAdvanceTable');
        const empty = $('noCashAdvances');
        if (!body) return;
        body.innerHTML = '';

        if (cashAdvances.length === 0) {
            empty.style.display = 'flex'; table.style.display = 'none'; return;
        }
        empty.style.display = 'none'; table.style.display = 'table';

        cashAdvances.forEach(ca => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${getEmployeeName(ca.employeeId)}</td>
                <td>${peso(ca.amount)}</td>
                <td>${formatDate(ca.dateGiven)}</td>
                <td>${ca.notes || '—'}</td>
                <td><span class="status-badge ${ca.deducted ? 'status-approved' : 'status-pending'}">${ca.deducted ? 'Yes' : 'No'}</span></td>
                <td><div class="action-btns">
                    <button class="text-action-btn delete-btn delete-ca" data-id="${ca.id}">Delete</button>
                </div></td>`;
            body.appendChild(tr);
        });

        document.querySelectorAll('.delete-ca').forEach(btn => {
            btn.addEventListener('click', () => {
                showConfirm('Delete this cash advance?', async () => {
                    try {
                        await apiFetch(`${API_PAYROLL}/cash-advances/${btn.dataset.id}`, { method: 'DELETE' });
                        showToast('Cash advance deleted');
                        await loadDeductions();
                    } catch(err) { showToast(err.message, 'error'); }
                }, 'Delete');
            });
        });
    }

    if ($('addCashAdvanceBtn')) $('addCashAdvanceBtn').addEventListener('click', () => {
        ftDeductionMode = false;
        globalDeductionMode = false;
        $('cashAdvanceForm').reset();
        $('caDate').value = new Date().toISOString().split('T')[0];
        populateCrewSelect('caEmployee');
        openModal(cashAdvanceModal);
    });

    $('cashAdvanceForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await apiFetch(`${API_PAYROLL}/cash-advances`, {
                method: 'POST',
                body: JSON.stringify({
                    employeeId: parseInt($('caEmployee').value),
                    amount: parseFloat($('caAmount').value),
                    dateGiven: $('caDate').value,
                    notes: $('caNotes').value.trim()
                })
            });
            showToast('Cash advance added');
            closeModal(cashAdvanceModal);
            if (globalDeductionMode) { await loadGlobalDeductions(); }
            else if (ftDeductionMode) { await loadFtDeductions(); }
            else { await loadDeductions(); }
        } catch(err) { showToast(err.message, 'error'); }
    });

    $('cancelCashAdvanceModal').addEventListener('click', () => closeModal(cashAdvanceModal));
    $('closeCashAdvanceModal').addEventListener('click', () => closeModal(cashAdvanceModal));

    // --- Cash Loans ---
    function renderCashLoans() {
        const body = $('cashLoanBody');
        const table = $('cashLoanTable');
        const empty = $('noCashLoans');
        if (!body) return;
        body.innerHTML = '';

        if (cashLoansData.length === 0) {
            empty.style.display = 'flex'; table.style.display = 'none'; return;
        }
        empty.style.display = 'none'; table.style.display = 'table';

        cashLoansData.forEach(cl => {
            const statusCls = cl.status === 'paid' ? 'status-approved' : 'status-pending';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${getEmployeeName(cl.employeeId)}</td>
                <td>${peso(cl.totalAmount)}</td>
                <td>${peso(cl.remainingBalance)}</td>
                <td>${peso(cl.installmentAmount)}</td>
                <td><span class="status-badge ${statusCls}">${cl.status}</span></td>
                <td><div class="action-btns">
                    ${cl.status !== 'paid' ? `<button class="text-action-btn edit-btn pay-loan" data-id="${cl.id}" data-emp="${cl.employeeId}" data-remaining="${cl.remainingBalance}">Pay</button>` : ''}
                    <button class="text-action-btn delete-btn delete-cl" data-id="${cl.id}">Delete</button>
                </div></td>`;
            body.appendChild(tr);
        });

        document.querySelectorAll('.pay-loan').forEach(btn => {
            btn.addEventListener('click', () => openLoanPaymentModal(btn.dataset.id, getEmployeeName(parseInt(btn.dataset.emp)), parseFloat(btn.dataset.remaining), false));
        });

        document.querySelectorAll('.delete-cl').forEach(btn => {
            btn.addEventListener('click', () => {
                showConfirm('Delete this cash loan?', async () => {
                    try {
                        await apiFetch(`${API_PAYROLL}/cash-loans/${btn.dataset.id}`, { method: 'DELETE' });
                        showToast('Cash loan deleted');
                        await loadDeductions();
                    } catch(err) { showToast(err.message, 'error'); }
                }, 'Delete');
            });
        });
    }

    if ($('addCashLoanBtn')) $('addCashLoanBtn').addEventListener('click', () => {
        ftDeductionMode = false;
        globalDeductionMode = false;
        $('cashLoanForm').reset();
        $('clDate').value = new Date().toISOString().split('T')[0];
        populateCrewSelect('clEmployee');
        openModal(cashLoanModal);
    });

    $('cashLoanForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await apiFetch(`${API_PAYROLL}/cash-loans`, {
                method: 'POST',
                body: JSON.stringify({
                    employeeId: parseInt($('clEmployee').value),
                    totalAmount: parseFloat($('clTotal').value),
                    installmentAmount: parseFloat($('clInstallment').value),
                    dateGiven: $('clDate').value,
                    notes: $('clNotes').value.trim()
                })
            });
            showToast('Cash loan added');
            closeModal(cashLoanModal);
            if (globalDeductionMode) { await loadGlobalDeductions(); }
            else if (ftDeductionMode) { await loadFtDeductions(); }
            else { await loadDeductions(); }
        } catch(err) { showToast(err.message, 'error'); }
    });

    $('cancelCashLoanModal').addEventListener('click', () => closeModal(cashLoanModal));
    $('closeCashLoanModal').addEventListener('click', () => closeModal(cashLoanModal));

    // --- Penalties ---
    function renderPenalties() {
        const body = $('penaltyBody');
        const table = $('penaltyTable');
        const empty = $('noPenalties');
        if (!body) return;
        body.innerHTML = '';

        if (penaltiesData.length === 0) {
            empty.style.display = 'flex'; table.style.display = 'none'; return;
        }
        empty.style.display = 'none'; table.style.display = 'table';

        penaltiesData.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${getEmployeeName(p.employeeId)}</td>
                <td><span class="status-badge status-pending">${p.penaltyType}</span></td>
                <td>${peso(p.amount)}</td>
                <td>${formatDate(p.createdAt)}</td>
                <td>${p.reason || '—'}</td>
                <td><div class="action-btns">
                    <button class="text-action-btn delete-btn delete-pen" data-id="${p.id}">Delete</button>
                </div></td>`;
            body.appendChild(tr);
        });

        document.querySelectorAll('.delete-pen').forEach(btn => {
            btn.addEventListener('click', () => {
                showConfirm('Delete this penalty?', async () => {
                    try {
                        await apiFetch(`${API_PAYROLL}/penalties/${btn.dataset.id}`, { method: 'DELETE' });
                        showToast('Penalty deleted');
                        await loadDeductions();
                    } catch(err) { showToast(err.message, 'error'); }
                }, 'Delete');
            });
        });
    }

    if ($('addPenaltyBtn')) $('addPenaltyBtn').addEventListener('click', () => {
        ftDeductionMode = false;
        $('penaltyForm').reset();
        $('penDate').value = new Date().toISOString().split('T')[0];
        populateCrewSelect('penEmployee');
        openModal(penaltyModal);
    });

    $('penaltyForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const penData = {
                employeeId: parseInt($('penEmployee').value),
                penaltyType: $('penType').value,
                amount: parseFloat($('penAmount').value),
                reason: $('penReason').value.trim(),
                date: $('penDate').value || new Date().toISOString().split('T')[0]
            };
            if (!ftDeductionMode && !globalDeductionMode) penData.eventId = selectedEventId;
            await apiFetch(`${API_PAYROLL}/penalties`, {
                method: 'POST',
                body: JSON.stringify(penData)
            });
            showToast('Penalty added');
            closeModal(penaltyModal);
            if (globalDeductionMode) { await loadGlobalDeductions(); }
            else if (ftDeductionMode) { await loadFtDeductions(); }
            else { await loadDeductions(); }
        } catch(err) { showToast(err.message, 'error'); }
    });

    $('cancelPenaltyModal').addEventListener('click', () => closeModal(penaltyModal));
    $('closePenaltyModal').addEventListener('click', () => closeModal(penaltyModal));

    // ============================================
    //  FULL-TIME SECTION
    // ============================================
    let ftSubmittedEmployees = [];
    let ftDeductionMode = false; // true = using modals for FT employees, not on-call crew
    let ftCaData = [], ftLoanData = [], ftPenData = [];

    function getFtEmployeeName(empId) {
        const emp = ftSubmittedEmployees.find(e => e.employeeId === empId || e.employeeId === parseInt(empId));
        return emp ? emp.employeeName : `Employee #${empId}`;
    }

    function populateFtSelect(selectId) {
        const sel = $(selectId);
        sel.innerHTML = '<option value="">— Select Employee —</option>';
        ftSubmittedEmployees.forEach(emp => {
            sel.innerHTML += `<option value="${emp.employeeId}">${emp.employeeName}</option>`;
        });
    }

    async function loadFtDeductions() {
        ftCaData = []; ftLoanData = []; ftPenData = [];
        for (const emp of ftSubmittedEmployees) {
            try {
                const ca = await apiFetch(`${API_PAYROLL}/cash-advances?employeeId=${emp.employeeId}`);
                ftCaData.push(...ca);
            } catch(e) {}
            try {
                const cl = await apiFetch(`${API_PAYROLL}/cash-loans?employeeId=${emp.employeeId}`);
                ftLoanData.push(...cl);
            } catch(e) {}
            try {
                const p = await apiFetch(`${API_PAYROLL}/penalties?employeeId=${emp.employeeId}`);
                // Only include penalties without an eventId (FT-only)
                ftPenData.push(...p.filter(x => !x.eventId || x.eventId === 0));
            } catch(e) {}
        }
        renderFtCa(); renderFtLoan(); renderFtPen();
    }

    function renderFtCa() {
        const body = $('ftCaBody'), table = $('ftCaTable'), empty = $('noFtCa');
        body.innerHTML = '';
        if (ftCaData.length === 0) { empty.style.display = 'flex'; table.style.display = 'none'; return; }
        empty.style.display = 'none'; table.style.display = 'table';
        ftCaData.forEach(ca => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${getFtEmployeeName(ca.employeeId)}</td>
                <td>${peso(ca.amount)}</td>
                <td>${formatDate(ca.dateGiven)}</td>
                <td>${ca.notes || '—'}</td>
                <td><span class="status-badge ${ca.deducted ? 'status-approved' : 'status-pending'}">${ca.deducted ? 'Yes' : 'No'}</span></td>
                <td><button class="text-action-btn delete-btn delete-ft-ca" data-id="${ca.id}">Delete</button></td>`;
            body.appendChild(tr);
        });
        document.querySelectorAll('.delete-ft-ca').forEach(btn => {
            btn.addEventListener('click', () => {
                showConfirm('Delete this cash advance?', async () => {
                    try { await apiFetch(`${API_PAYROLL}/cash-advances/${btn.dataset.id}`, { method: 'DELETE' }); showToast('Deleted'); await loadFtDeductions(); } catch(e) { showToast(e.message, 'error'); }
                }, 'Delete');
            });
        });
    }

    function renderFtLoan() {
        const body = $('ftLoanBody'), table = $('ftLoanTable'), empty = $('noFtLoan');
        body.innerHTML = '';
        if (ftLoanData.length === 0) { empty.style.display = 'flex'; table.style.display = 'none'; return; }
        empty.style.display = 'none'; table.style.display = 'table';
        ftLoanData.forEach(cl => {
            const tr = document.createElement('tr');
            const statusCls = cl.status === 'paid' ? 'status-approved' : 'status-pending';
            tr.innerHTML = `
                <td>${getFtEmployeeName(cl.employeeId)}</td>
                <td>${peso(cl.totalAmount)}</td>
                <td>${peso(cl.remainingBalance)}</td>
                <td>${peso(cl.installmentAmount)}</td>
                <td><span class="status-badge ${statusCls}">${cl.status}</span></td>
                <td>
                    ${cl.status !== 'paid' ? `<button class="text-action-btn edit-btn pay-ft-loan" data-id="${cl.id}" data-emp="${cl.employeeId}" data-remaining="${cl.remainingBalance}">Pay</button>` : ''}
                    <button class="text-action-btn delete-btn delete-ft-loan" data-id="${cl.id}">Delete</button>
                </td>`;
            body.appendChild(tr);
        });
        document.querySelectorAll('.pay-ft-loan').forEach(btn => {
            btn.addEventListener('click', () => openLoanPaymentModal(btn.dataset.id, getFtEmployeeName(parseInt(btn.dataset.emp)), parseFloat(btn.dataset.remaining), true));
        });
        document.querySelectorAll('.delete-ft-loan').forEach(btn => {
            btn.addEventListener('click', () => {
                showConfirm('Delete this cash loan?', async () => {
                    try { await apiFetch(`${API_PAYROLL}/cash-loans/${btn.dataset.id}`, { method: 'DELETE' }); showToast('Deleted'); await loadFtDeductions(); } catch(e) { showToast(e.message, 'error'); }
                }, 'Delete');
            });
        });
    }

    function renderFtPen() {
        const body = $('ftPenBody'), table = $('ftPenTable'), empty = $('noFtPen');
        body.innerHTML = '';
        if (ftPenData.length === 0) { empty.style.display = 'flex'; table.style.display = 'none'; return; }
        empty.style.display = 'none'; table.style.display = 'table';
        ftPenData.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${getFtEmployeeName(p.employeeId)}</td>
                <td><span class="status-badge status-pending">${p.penaltyType}</span></td>
                <td>${peso(p.amount)}</td>
                <td>${formatDate(p.createdAt)}</td>
                <td>${p.reason || '—'}</td>
                <td><button class="text-action-btn delete-btn delete-ft-pen" data-id="${p.id}">Delete</button></td>`;
            body.appendChild(tr);
        });
        document.querySelectorAll('.delete-ft-pen').forEach(btn => {
            btn.addEventListener('click', () => {
                showConfirm('Delete this penalty?', async () => {
                    try { await apiFetch(`${API_PAYROLL}/penalties/${btn.dataset.id}`, { method: 'DELETE' }); showToast('Deleted'); await loadFtDeductions(); } catch(e) { showToast(e.message, 'error'); }
                }, 'Delete');
            });
        });
    }

    // FT deductions tab switching
    document.querySelectorAll('#ftDeductionsView .deduction-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('#ftDeductionsView .deduction-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('#ftDeductionsView .deduction-panel').forEach(p => p.style.display = 'none');
            $( tab.dataset.tab ).style.display = '';
        });
    });

    // FT deductions navigation (view only accessible via the standalone global deductions card)
    $('backToFtFromDeductions').addEventListener('click', () => {
        $('ftDeductionsView').style.display = 'none';
        ftSubmittedListView.style.display = '';
    });

    // FT add buttons (reuse existing modals in FT mode)
    $('ftAddCaBtn').addEventListener('click', () => {
        ftDeductionMode = true;
        globalDeductionMode = false;
        $('cashAdvanceForm').reset();
        $('caDate').value = new Date().toISOString().split('T')[0];
        populateFtSelect('caEmployee');
        openModal(cashAdvanceModal);
    });

    $('ftAddLoanBtn').addEventListener('click', () => {
        ftDeductionMode = true;
        globalDeductionMode = false;
        $('cashLoanForm').reset();
        $('clDate').value = new Date().toISOString().split('T')[0];
        populateFtSelect('clEmployee');
        openModal(cashLoanModal);
    });

    $('ftAddPenBtn').addEventListener('click', () => {
        ftDeductionMode = true;
        globalDeductionMode = false;
        $('penaltyForm').reset();
        $('penDate').value = new Date().toISOString().split('T')[0];
        populateFtSelect('penEmployee');
        openModal(penaltyModal);
    });

    async function loadFtSubmittedEmployees() {
        try { ftSubmittedEmployees = await apiFetch(`${API_TIMELOGS}/submitted-employees`); } catch(e) { ftSubmittedEmployees = []; }
    }

    function renderFtSubmittedTable() {
        const body = $('ftSubmittedBody');
        const table = $('ftSubmittedTable');
        const empty = $('noFtSubmitted');
        const count = $('ftSubmittedCount');
        body.innerHTML = '';

        const search = ($('ftSubmittedSearch') ? $('ftSubmittedSearch').value : '').toLowerCase().trim();
        const filtered = ftSubmittedEmployees.filter(emp => {
            if (!search) return true;
            return (emp.employeeName || '').toLowerCase().includes(search) || (emp.position || '').toLowerCase().includes(search);
        });

        if (filtered.length === 0) {
            empty.style.display = 'flex'; table.style.display = 'none';
            count.textContent = '0 submitted employees';
            return;
        }

        empty.style.display = 'none'; table.style.display = 'table';
        count.textContent = `${filtered.length} submitted employee${filtered.length !== 1 ? 's' : ''}`;

        filtered.forEach(emp => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${emp.employeeName}</strong></td>
                <td>${formatPosition(emp.position)}</td>
                <td><div class="action-btns">
                    <button class="text-action-btn view-btn view-ft-employee" data-id="${emp.employeeId}">View</button>
                </div></td>`;
            body.appendChild(tr);
        });

        document.querySelectorAll('.view-ft-employee').forEach(btn => {
            btn.addEventListener('click', async () => { await showFtEmployeeDetail(parseInt(btn.dataset.id)); });
        });
    }

    async function showFtEmployeeDetail(employeeId) {
        selectedFtEmployeeId = employeeId;
        const emp = ftSubmittedEmployees.find(e => e.employeeId === employeeId);
        if (!emp) return;

        let logs = [];
        let summary = null;
        try { logs = await apiFetch(`${API_TIMELOGS}?employeeId=${employeeId}&submittedOnly=true`); } catch(e) {}
        try { summary = await apiFetch(`${API_PAYROLL}/ft-summary?employeeId=${employeeId}`); } catch(e) {}

        $('ftDetailTitle').textContent = emp.employeeName;

        // Populate payroll summary
        if (summary) {
            $('ftDailyRateDisplay').textContent = peso(summary.hourlyRate);
            const hrs = Math.round((summary.hoursWorked || 0) * 100) / 100;
            $('ftDaysWorkedDisplay').textContent = hrs + (hrs === 1 ? ' hr' : ' hrs');
            $('ftGrossPayDisplay').textContent = peso(summary.grossPay);
        }

        ftSubmittedListView.style.display = 'none';
        ftSubmittedDetailView.style.display = '';
        renderFtDetailLogs(logs, employeeId);
    }

    // ============================================
    //  LOAN PAYMENT MODAL
    // ============================================
    let loanPaymentLoanId = null;
    let loanPaymentContext = null; // false = crew, true = ft, 'global' = global
    const loanPaymentModal = $('loanPaymentModal');

    function openLoanPaymentModal(loanId, empName, remaining, context) {
        loanPaymentLoanId = loanId;
        loanPaymentContext = context;
        $('loanPaymentEmployeeName').value = empName;
        $('loanPaymentRemaining').value = peso(remaining);
        $('loanPaymentAmount').value = '';
        openModal(loanPaymentModal);
    }

    $('loanPaymentForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const amountPaid = parseFloat($('loanPaymentAmount').value);
        try {
            await apiFetch(`${API_PAYROLL}/cash-loans/${loanPaymentLoanId}/payment`, {
                method: 'POST',
                body: JSON.stringify({ amountPaid: amountPaid })
            });
            showToast('Payment recorded');
            closeModal(loanPaymentModal);
            if (loanPaymentContext === 'global') { await loadGlobalDeductions(); }
            else if (loanPaymentContext === true) { await loadFtDeductions(); }
            else { await loadDeductions(); }
        } catch(err) { showToast(err.message, 'error'); }
    });

    $('cancelLoanPaymentModal').addEventListener('click', () => closeModal(loanPaymentModal));
    $('closeLoanPaymentModal').addEventListener('click', () => closeModal(loanPaymentModal));
    if (loanPaymentModal) loanPaymentModal.addEventListener('click', e => { if (e.target === loanPaymentModal) closeModal(loanPaymentModal); });

    // ============================================
    //  DAILY RATE MODAL
    // ============================================
    const dailyRateModal = $('dailyRateModal');

    $('editDailyRateBtn').addEventListener('click', () => {
        const currentRate = parseFloat($('ftDailyRateDisplay').textContent.replace(/[^0-9.]/g, '')) || 0;
        $('dailyRateInput').value = currentRate || '';
        $('dailyRatePreview').textContent = '';
        openModal(dailyRateModal);
    });

    $('dailyRateInput').addEventListener('input', () => {
        const rate = parseFloat($('dailyRateInput').value) || 0;
        const hoursText = $('ftDaysWorkedDisplay').textContent;
        const hours = parseFloat(hoursText) || 0;
        $('dailyRatePreview').textContent = rate > 0
            ? `Gross Pay: ${peso(rate * hours)} (${hours} hr${hours !== 1 ? 's' : ''} × ${peso(rate)})`
            : '';
    });

    $('dailyRateForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const rate = parseFloat($('dailyRateInput').value);
        try {
            await apiFetch(`${API_PAYROLL}/daily-rate`, {
                method: 'PUT',
                body: JSON.stringify({ employeeId: selectedFtEmployeeId, hourlyRate: rate })
            });
            $('ftDailyRateDisplay').textContent = peso(rate);
            const hoursText = $('ftDaysWorkedDisplay').textContent;
            const hours = parseFloat(hoursText) || 0;
            $('ftGrossPayDisplay').textContent = peso(rate * hours);
            closeModal(dailyRateModal);
            showToast('Hourly rate updated');
        } catch(err) { showToast(err.message, 'error'); }
    });

    $('cancelDailyRateModal').addEventListener('click', () => closeModal(dailyRateModal));
    $('closeDailyRateModal').addEventListener('click', () => closeModal(dailyRateModal));

    if (dailyRateModal) dailyRateModal.addEventListener('click', (e) => { if (e.target === dailyRateModal) closeModal(dailyRateModal); });

    function calcHours(timeIn, timeOut) {
        if (!timeIn || !timeOut) return 0;
        const [hIn, mIn] = timeIn.split(':').map(Number);
        const [hOut, mOut] = timeOut.split(':').map(Number);
        const diff = (hOut * 60 + mOut) - (hIn * 60 + mIn);
        return diff > 0 ? Math.round(diff / 60 * 100) / 100 : 0;
    }

    function renderFtDetailLogs(logs, employeeId) {
        const body = $('ftDetailLogsBody');
        const table = $('ftDetailLogsTable');
        const empty = $('noFtDetailLogs');
        const editable = canEditPayroll();
        body.innerHTML = '';

        logs.sort((a, b) => b.date.localeCompare(a.date));

        if (logs.length === 0) { empty.style.display = 'flex'; table.style.display = 'none'; return; }
        empty.style.display = 'none'; table.style.display = 'table';

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
                ${editable ? `<td><div class="action-btns">
                    <button class="text-action-btn edit-btn edit-ft-log" data-id="${log.id}">Edit</button>
                    <button class="text-action-btn delete-btn delete-ft-log" data-id="${log.id}">Delete</button>
                </div></td>` : '<td></td>'}`;
            body.appendChild(tr);
        });

        document.querySelectorAll('.edit-ft-log').forEach(btn => {
            btn.addEventListener('click', () => {
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

        document.querySelectorAll('.delete-ft-log').forEach(btn => {
            btn.addEventListener('click', () => {
                showConfirm('Delete this time log?', async () => {
                    try {
                        await apiFetch(`${API_TIMELOGS}/${btn.dataset.id}`, { method: 'DELETE' });
                        showToast('Time log deleted');
                        await showFtEmployeeDetail(selectedFtEmployeeId);
                    } catch(err) { showToast(err.message, 'error'); }
                }, 'Delete');
            });
        });
    }

    $('payrollTimeLogForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!editingTimeLogId || !selectedFtEmployeeId) return;
        const timeIn = $('payrollTimeLogIn').value;
        const timeOut = $('payrollTimeLogOut').value;
        try {
            await apiFetch(`${API_TIMELOGS}/${editingTimeLogId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    employeeId: selectedFtEmployeeId,
                    date: $('payrollTimeLogDate').value,
                    timeIn, timeOut,
                    totalHours: calcHours(timeIn, timeOut),
                    notes: $('payrollTimeLogRemarks').value.trim(),
                    notesOut: $('payrollTimeLogRemarksOut').value.trim()
                })
            });
            showToast('Time log updated');
            closeModal(timeLogModal);
            await showFtEmployeeDetail(selectedFtEmployeeId);
        } catch(err) { showToast(err.message, 'error'); }
    });

    $('cancelPayrollTimeLogModal').addEventListener('click', () => closeModal(timeLogModal));
    $('closePayrollTimeLogModal').addEventListener('click', () => closeModal(timeLogModal));

    // ============================================
    //  GLOBAL DEDUCTIONS (no event required)
    // ============================================
    let globalDeductionMode = false;
    let globalCaData = [], globalLoanData = [], globalPenData = [];
    let globalFilterEmpId = null; // null = show all

    const globalDeductionsView = $('globalDeductionsView');

    function getGlobalEmployeeName(empId) {
        const emp = cachedEmployees.find(e => e.id === empId || e.id === parseInt(empId));
        return emp ? `${emp.firstName} ${emp.lastName}` : `Employee #${empId}`;
    }

    function populateGlobalEmployeeSelect() {
        const sel = $('globalDeductionEmployeeSelect');
        sel.innerHTML = '<option value="">— All Employees —</option>';
        cachedEmployees.forEach(emp => {
            sel.innerHTML += `<option value="${emp.id}">${emp.firstName} ${emp.lastName}</option>`;
        });
    }

    async function loadGlobalDeductions() {
        const empId = globalFilterEmpId;
        const empParam = empId ? `?employeeId=${empId}` : '';
        try { globalCaData   = await apiFetch(`${API_PAYROLL}/cash-advances${empParam}`); } catch(e) { globalCaData = []; }
        try { globalLoanData = await apiFetch(`${API_PAYROLL}/cash-loans${empParam}`);    } catch(e) { globalLoanData = []; }
        try {
            const allPen = await apiFetch(`${API_PAYROLL}/penalties${empParam}`);
            globalPenData = allPen; // show all (event-related or not)
        } catch(e) { globalPenData = []; }
        renderGlobalCa(); renderGlobalLoan(); renderGlobalPen();
        // Refresh event-specific crew payroll if in event context
        if (selectedEventId && eventCrewIds.length > 0) {
            await loadDeductions();
        }
    }

    function renderGlobalCa() {
        const body = $('globalCaBody'), table = $('globalCaTable'), empty = $('noGlobalCa');
        body.innerHTML = '';
        if (globalCaData.length === 0) { empty.style.display = 'flex'; table.style.display = 'none'; return; }
        empty.style.display = 'none'; table.style.display = 'table';
        globalCaData.forEach(ca => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${getGlobalEmployeeName(ca.employeeId)}</td>
                <td>${peso(ca.amount)}</td>
                <td>${formatDate(ca.dateGiven)}</td>
                <td>${ca.notes || '—'}</td>
                <td><span class="status-badge ${ca.deducted ? 'status-approved' : 'status-pending'}">${ca.deducted ? 'Yes' : 'No'}</span></td>
                <td><button class="text-action-btn delete-btn delete-global-ca" data-id="${ca.id}">Delete</button></td>`;
            body.appendChild(tr);
        });
        document.querySelectorAll('.delete-global-ca').forEach(btn => {
            btn.addEventListener('click', () => {
                showConfirm('Delete this cash advance?', async () => {
                    try { await apiFetch(`${API_PAYROLL}/cash-advances/${btn.dataset.id}`, { method: 'DELETE' }); showToast('Deleted'); await loadGlobalDeductions(); } catch(e) { showToast(e.message, 'error'); }
                }, 'Delete');
            });
        });
    }

    function renderGlobalLoan() {
        const body = $('globalLoanBody'), table = $('globalLoanTable'), empty = $('noGlobalLoan');
        body.innerHTML = '';
        if (globalLoanData.length === 0) { empty.style.display = 'flex'; table.style.display = 'none'; return; }
        empty.style.display = 'none'; table.style.display = 'table';
        globalLoanData.forEach(cl => {
            const tr = document.createElement('tr');
            const statusCls = cl.status === 'paid' ? 'status-approved' : 'status-pending';
            tr.innerHTML = `
                <td>${getGlobalEmployeeName(cl.employeeId)}</td>
                <td>${peso(cl.totalAmount)}</td>
                <td>${peso(cl.remainingBalance)}</td>
                <td>${peso(cl.installmentAmount)}</td>
                <td>${formatDate(cl.dateGiven)}</td>
                <td><span class="status-badge ${statusCls}">${cl.status}</span></td>
                <td>
                    ${cl.status !== 'paid' ? `<button class="text-action-btn edit-btn pay-global-loan" data-id="${cl.id}" data-emp="${cl.employeeId}" data-remaining="${cl.remainingBalance}">Pay</button>` : ''}
                    <button class="text-action-btn delete-btn delete-global-loan" data-id="${cl.id}">Delete</button>
                </td>`;
            body.appendChild(tr);
        });
        document.querySelectorAll('.pay-global-loan').forEach(btn => {
            btn.addEventListener('click', () => openLoanPaymentModal(btn.dataset.id, getGlobalEmployeeName(parseInt(btn.dataset.emp)), parseFloat(btn.dataset.remaining), 'global'));
        });
        document.querySelectorAll('.delete-global-loan').forEach(btn => {
            btn.addEventListener('click', () => {
                showConfirm('Delete this cash loan?', async () => {
                    try { await apiFetch(`${API_PAYROLL}/cash-loans/${btn.dataset.id}`, { method: 'DELETE' }); showToast('Deleted'); await loadGlobalDeductions(); } catch(e) { showToast(e.message, 'error'); }
                }, 'Delete');
            });
        });
    }

    function renderGlobalPen() {
        const body = $('globalPenBody'), table = $('globalPenTable'), empty = $('noGlobalPen');
        body.innerHTML = '';
        if (globalPenData.length === 0) { empty.style.display = 'flex'; table.style.display = 'none'; return; }
        empty.style.display = 'none'; table.style.display = 'table';
        globalPenData.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${getGlobalEmployeeName(p.employeeId)}</td>
                <td><span class="status-badge status-pending">${p.penaltyType}</span></td>
                <td>${peso(p.amount)}</td>
                <td>${formatDate(p.createdAt)}</td>
                <td>${p.reason || '—'}</td>
                <td><button class="text-action-btn delete-btn delete-global-pen" data-id="${p.id}">Delete</button></td>`;
            body.appendChild(tr);
        });
        document.querySelectorAll('.delete-global-pen').forEach(btn => {
            btn.addEventListener('click', () => {
                showConfirm('Delete this penalty?', async () => {
                    try { await apiFetch(`${API_PAYROLL}/penalties/${btn.dataset.id}`, { method: 'DELETE' }); showToast('Deleted'); await loadGlobalDeductions(); } catch(e) { showToast(e.message, 'error'); }
                }, 'Delete');
            });
        });
    }

    // Global deductions tab switching
    document.querySelectorAll('#globalDeductionsView .deduction-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('#globalDeductionsView .deduction-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('#globalDeductionsView .deduction-panel').forEach(p => p.style.display = 'none');
            $(tab.dataset.tab).style.display = '';
        });
    });

    // Employee filter dropdown — realtime reload
    $('globalDeductionEmployeeSelect').addEventListener('change', async function() {
        globalFilterEmpId = this.value ? parseInt(this.value) : null;
        await loadGlobalDeductions();
    });

    // Navigation: main view → global deductions
    $('viewGlobalDeductionsBtn').addEventListener('click', async () => {
        payrollMainView.style.display = 'none';
        globalDeductionsView.style.display = '';
        populateGlobalEmployeeSelect();
        await loadGlobalDeductions();
    });

    $('backToPayrollFromGlobal').addEventListener('click', () => {
        globalDeductionsView.style.display = 'none';
        payrollMainView.style.display = '';
        globalFilterEmpId = null;
    });

    // Global add buttons (reuse modals in global mode)
    $('globalAddCaBtn').addEventListener('click', () => {
        globalDeductionMode = true;
        $('cashAdvanceForm').reset();
        $('caDate').value = new Date().toISOString().split('T')[0];
        // Populate with all employees
        const sel = $('caEmployee');
        sel.innerHTML = '<option value="">— Select Employee —</option>';
        cachedEmployees.forEach(emp => {
            sel.innerHTML += `<option value="${emp.id}">${emp.firstName} ${emp.lastName}</option>`;
        });
        if (globalFilterEmpId) sel.value = globalFilterEmpId;
        openModal(cashAdvanceModal);
    });

    $('globalAddLoanBtn').addEventListener('click', () => {
        globalDeductionMode = true;
        $('cashLoanForm').reset();
        $('clDate').value = new Date().toISOString().split('T')[0];
        const sel = $('clEmployee');
        sel.innerHTML = '<option value="">— Select Employee —</option>';
        cachedEmployees.forEach(emp => {
            sel.innerHTML += `<option value="${emp.id}">${emp.firstName} ${emp.lastName}</option>`;
        });
        if (globalFilterEmpId) sel.value = globalFilterEmpId;
        openModal(cashLoanModal);
    });

    $('globalAddPenBtn').addEventListener('click', () => {
        globalDeductionMode = true;
        $('penaltyForm').reset();
        $('penDate').value = new Date().toISOString().split('T')[0];
        const sel = $('penEmployee');
        sel.innerHTML = '<option value="">— Select Employee —</option>';
        cachedEmployees.forEach(emp => {
            sel.innerHTML += `<option value="${emp.id}">${emp.firstName} ${emp.lastName}</option>`;
        });
        if (globalFilterEmpId) sel.value = globalFilterEmpId;
        openModal(penaltyModal);
    });

    // ============================================
    //  CONFIRM DIALOG
    // ============================================
    $('payrollConfirmOk').addEventListener('click', () => { if (confirmCallback) confirmCallback(); hideConfirm(); });
    $('payrollConfirmCancel').addEventListener('click', hideConfirm);
    $('closePayrollConfirm').addEventListener('click', hideConfirm);

    // Close modals on overlay click
    [confirmModal, contractPriceModal, deptModal, empPayrollModal, cashAdvanceModal, cashLoanModal, penaltyModal, timeLogModal].forEach(m => {
        if (m) m.addEventListener('click', (e) => { if (e.target === m) closeModal(m); });
    });

    // ============================================
    //  START
    // ============================================
    init();
});
