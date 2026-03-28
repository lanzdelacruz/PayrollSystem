package com.reddamien.servlet;

import java.io.*;
import java.sql.*;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.*;
import org.json.JSONArray;
import org.json.JSONObject;
import com.reddamien.db.DatabaseManager;

@WebServlet("/api/payroll/*")
public class PayrollServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        resp.setContentType("application/json;charset=UTF-8");
        String pathInfo = req.getPathInfo();

        try (Connection conn = DatabaseManager.getConnection()) {

            // GET /api/payroll/departments?eventId=X
            if (pathInfo != null && pathInfo.equals("/departments")) {
                String eventId = req.getParameter("eventId");
                if (eventId == null) { resp.setStatus(400); resp.getWriter().print(err("eventId required")); return; }
                String sql = "SELECT * FROM event_payroll_departments WHERE event_id = ? ORDER BY id";
                try (PreparedStatement ps = conn.prepareStatement(sql)) {
                    ps.setInt(1, Integer.parseInt(eventId));
                    try (ResultSet rs = ps.executeQuery()) {
                        JSONArray arr = new JSONArray();
                        while (rs.next()) {
                            JSONObject o = new JSONObject();
                            o.put("id", rs.getInt("id"));
                            o.put("eventId", rs.getInt("event_id"));
                            o.put("departmentName", rs.getString("department_name"));
                            o.put("allocatedAmount", rs.getDouble("allocated_amount"));
                            arr.put(o);
                        }
                        resp.getWriter().print(arr.toString());
                    }
                }
                return;
            }

            // GET /api/payroll/employee-payroll?eventId=X
            if (pathInfo != null && pathInfo.equals("/employee-payroll")) {
                String eventId = req.getParameter("eventId");
                if (eventId == null) { resp.setStatus(400); resp.getWriter().print(err("eventId required")); return; }
                String sql = "SELECT ep.*, e.first_name, e.last_name, e.position, " +
                             "COALESCE(ea.role, '') AS crew_role, COALESCE(ea.assignment, '') AS crew_assignment " +
                             "FROM employee_payroll ep " +
                             "JOIN employees e ON ep.employee_id = e.id " +
                             "LEFT JOIN event_attendance ea ON ea.event_id = ep.event_id AND ea.employee_id = ep.employee_id " +
                             "WHERE ep.event_id = ? ORDER BY e.last_name, e.first_name";
                try (PreparedStatement ps = conn.prepareStatement(sql)) {
                    ps.setInt(1, Integer.parseInt(eventId));
                    try (ResultSet rs = ps.executeQuery()) {
                        JSONArray arr = new JSONArray();
                        while (rs.next()) {
                            arr.put(employeePayrollToJson(rs));
                        }
                        resp.getWriter().print(arr.toString());
                    }
                }
                return;
            }

            // GET /api/payroll/cash-advances?employeeId=X[&activeOnly=true]
            if (pathInfo != null && pathInfo.equals("/cash-advances")) {
                String employeeId = req.getParameter("employeeId");
                String activeOnly = req.getParameter("activeOnly");
                StringBuilder sql = new StringBuilder("SELECT * FROM cash_advances WHERE 1=1 ");
                if (employeeId != null) sql.append("AND employee_id = ? ");
                if ("true".equals(activeOnly)) sql.append("AND deducted = FALSE ");
                sql.append("ORDER BY date_given DESC");
                try (PreparedStatement ps = conn.prepareStatement(sql.toString())) {
                    int idx = 1;
                    if (employeeId != null) ps.setInt(idx++, Integer.parseInt(employeeId));
                    try (ResultSet rs = ps.executeQuery()) {
                        JSONArray arr = new JSONArray();
                        while (rs.next()) {
                            JSONObject o = new JSONObject();
                            o.put("id", rs.getInt("id"));
                            o.put("employeeId", rs.getInt("employee_id"));
                            o.put("amount", rs.getDouble("amount"));
                            o.put("dateGiven", rs.getString("date_given"));
                            o.put("deducted", rs.getBoolean("deducted"));
                            o.put("deductedFromEventId", rs.getInt("deducted_from_event_id"));
                            o.put("notes", rs.getString("notes"));
                            arr.put(o);
                        }
                        resp.getWriter().print(arr.toString());
                    }
                }
                return;
            }

            // GET /api/payroll/cash-loans?employeeId=X[&activeOnly=true]
            if (pathInfo != null && pathInfo.equals("/cash-loans")) {
                String employeeId = req.getParameter("employeeId");
                String activeOnly = req.getParameter("activeOnly");
                StringBuilder sql = new StringBuilder("SELECT * FROM cash_loans WHERE 1=1 ");
                if (employeeId != null) sql.append("AND employee_id = ? ");
                if ("true".equals(activeOnly)) sql.append("AND status = 'active' ");
                sql.append("ORDER BY date_given DESC");
                try (PreparedStatement ps = conn.prepareStatement(sql.toString())) {
                    int idx = 1;
                    if (employeeId != null) ps.setInt(idx++, Integer.parseInt(employeeId));
                    try (ResultSet rs = ps.executeQuery()) {
                        JSONArray arr = new JSONArray();
                        while (rs.next()) {
                            JSONObject o = new JSONObject();
                            o.put("id", rs.getInt("id"));
                            o.put("employeeId", rs.getInt("employee_id"));
                            o.put("totalAmount", rs.getDouble("total_amount"));
                            o.put("remainingBalance", rs.getDouble("remaining_balance"));
                            o.put("installmentAmount", rs.getDouble("installment_amount"));
                            o.put("dateGiven", rs.getString("date_given"));
                            o.put("notes", rs.getString("notes"));
                            o.put("status", rs.getString("status"));
                            arr.put(o);
                        }
                        resp.getWriter().print(arr.toString());
                    }
                }
                return;
            }

            // GET /api/payroll/penalties?employeeId=X&eventId=Y
            if (pathInfo != null && pathInfo.equals("/penalties")) {
                String employeeId = req.getParameter("employeeId");
                String eventId = req.getParameter("eventId");
                StringBuilder sql = new StringBuilder("SELECT * FROM payroll_penalties WHERE 1=1 ");
                if (employeeId != null) sql.append("AND employee_id = ? ");
                if (eventId != null) sql.append("AND event_id = ? ");
                sql.append("ORDER BY created_at DESC");
                try (PreparedStatement ps = conn.prepareStatement(sql.toString())) {
                    int idx = 1;
                    if (employeeId != null) ps.setInt(idx++, Integer.parseInt(employeeId));
                    if (eventId != null) ps.setInt(idx++, Integer.parseInt(eventId));
                    try (ResultSet rs = ps.executeQuery()) {
                        JSONArray arr = new JSONArray();
                        while (rs.next()) {
                            JSONObject o = new JSONObject();
                            o.put("id", rs.getInt("id"));
                            o.put("employeeId", rs.getInt("employee_id"));
                            o.put("eventId", rs.getInt("event_id"));
                            o.put("penaltyType", rs.getString("penalty_type"));
                            o.put("amount", rs.getDouble("amount"));
                            o.put("reason", rs.getString("reason"));
                            o.put("createdAt", rs.getString("created_at") != null ? rs.getString("created_at").substring(0, 10) : null);
                            arr.put(o);
                        }
                        resp.getWriter().print(arr.toString());
                    }
                }
                return;
            }

            // GET /api/payroll/ft-summary?employeeId=X
            if (pathInfo != null && pathInfo.equals("/ft-summary")) {
                String empId = req.getParameter("employeeId");
                if (empId == null) { resp.setStatus(400); resp.getWriter().print(err("employeeId required")); return; }
                String empSql = "SELECT id, first_name, last_name, position, daily_rate FROM employees WHERE id = ?";
                try (PreparedStatement ps = conn.prepareStatement(empSql)) {
                    ps.setInt(1, Integer.parseInt(empId));
                    try (ResultSet rs = ps.executeQuery()) {
                        if (!rs.next()) { resp.setStatus(404); resp.getWriter().print(err("Employee not found")); return; }
                        JSONObject o = new JSONObject();
                        o.put("employeeId", rs.getInt("id"));
                        o.put("employeeName", rs.getString("first_name") + " " + rs.getString("last_name"));
                        o.put("position", rs.getString("position"));
                        o.put("hourlyRate", rs.getDouble("daily_rate"));
                        String logSql = "SELECT COALESCE(SUM(TIMESTAMPDIFF(MINUTE, time_in, time_out)) / 60.0, 0) AS hours FROM time_logs WHERE employee_id = ? AND time_in IS NOT NULL AND time_out IS NOT NULL";
                        try (PreparedStatement ps2 = conn.prepareStatement(logSql)) {
                            ps2.setInt(1, Integer.parseInt(empId));
                            try (ResultSet rs2 = ps2.executeQuery()) {
                                double hours = rs2.next() ? rs2.getDouble("hours") : 0;
                                o.put("hoursWorked", hours);
                                o.put("grossPay", rs.getDouble("daily_rate") * hours);
                            }
                        }
                        resp.getWriter().print(o.toString());
                    }
                }
                return;
            }

            resp.setStatus(400);
            resp.getWriter().print(err("Unknown endpoint"));

        } catch (Exception e) {
            e.printStackTrace();
            resp.setStatus(500);
            resp.getWriter().print(err(e.getMessage()));
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        resp.setContentType("application/json;charset=UTF-8");
        String pathInfo = req.getPathInfo();
        JSONObject body = readBody(req);

        try (Connection conn = DatabaseManager.getConnection()) {

            // POST /api/payroll/departments
            if ("/departments".equals(pathInfo)) {
                String sql = "INSERT INTO event_payroll_departments (event_id, department_name, allocated_amount) VALUES (?,?,?)";
                try (PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
                    ps.setInt(1, body.getInt("eventId"));
                    ps.setString(2, body.getString("departmentName"));
                    ps.setDouble(3, body.getDouble("allocatedAmount"));
                    ps.executeUpdate();
                    try (ResultSet keys = ps.getGeneratedKeys()) {
                        int id = keys.next() ? keys.getInt(1) : 0;
                        resp.setStatus(201);
                        resp.getWriter().print(new JSONObject().put("success", true).put("id", id).toString());
                    }
                }
                return;
            }

            // POST /api/payroll/employee-payroll
            if ("/employee-payroll".equals(pathInfo)) {
                String sql = "INSERT INTO employee_payroll (event_id, employee_id, department, base_rate, " +
                             "cash_advance_deduction, loan_deduction, penalty_deduction, net_pay, status) " +
                             "VALUES (?,?,?,?,?,?,?,?,?) " +
                             "ON DUPLICATE KEY UPDATE department=VALUES(department), base_rate=VALUES(base_rate), " +
                             "cash_advance_deduction=VALUES(cash_advance_deduction), loan_deduction=VALUES(loan_deduction), " +
                             "penalty_deduction=VALUES(penalty_deduction), net_pay=VALUES(net_pay), status=VALUES(status)";
                try (PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
                    double baseRate = body.optDouble("baseRate", 0);
                    double caDeduction = body.optDouble("cashAdvanceDeduction", 0);
                    double loanDeduction = body.optDouble("loanDeduction", 0);
                    double penaltyDeduction = body.optDouble("penaltyDeduction", 0);
                    double netPay = baseRate - caDeduction - loanDeduction - penaltyDeduction;

                    ps.setInt(1, body.getInt("eventId"));
                    ps.setInt(2, body.getInt("employeeId"));
                    ps.setString(3, body.optString("department", ""));
                    ps.setDouble(4, baseRate);
                    ps.setDouble(5, caDeduction);
                    ps.setDouble(6, loanDeduction);
                    ps.setDouble(7, penaltyDeduction);
                    ps.setDouble(8, netPay);
                    ps.setString(9, body.optString("status", "pending"));
                    ps.executeUpdate();
                    try (ResultSet keys = ps.getGeneratedKeys()) {
                        int id = keys.next() ? keys.getInt(1) : 0;
                        resp.setStatus(201);
                        resp.getWriter().print(new JSONObject().put("success", true).put("id", id).put("netPay", netPay).toString());
                    }
                }
                return;
            }

            // POST /api/payroll/cash-advances
            if ("/cash-advances".equals(pathInfo)) {
                String sql = "INSERT INTO cash_advances (employee_id, amount, date_given, notes) VALUES (?,?,?,?)";
                try (PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
                    ps.setInt(1, body.getInt("employeeId"));
                    ps.setDouble(2, body.getDouble("amount"));
                    ps.setString(3, body.optString("dateGiven", new java.text.SimpleDateFormat("yyyy-MM-dd").format(new java.util.Date())));
                    ps.setString(4, body.optString("notes", ""));
                    ps.executeUpdate();
                    try (ResultSet keys = ps.getGeneratedKeys()) {
                        int id = keys.next() ? keys.getInt(1) : 0;
                        resp.setStatus(201);
                        resp.getWriter().print(new JSONObject().put("success", true).put("id", id).toString());
                    }
                }
                return;
            }

            // POST /api/payroll/cash-loans
            if ("/cash-loans".equals(pathInfo)) {
                double total = body.getDouble("totalAmount");
                double installment = body.getDouble("installmentAmount");
                String sql = "INSERT INTO cash_loans (employee_id, total_amount, remaining_balance, installment_amount, date_given, notes) VALUES (?,?,?,?,?,?)";
                try (PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
                    ps.setInt(1, body.getInt("employeeId"));
                    ps.setDouble(2, total);
                    ps.setDouble(3, total);
                    ps.setDouble(4, installment);
                    ps.setString(5, body.optString("dateGiven", new java.text.SimpleDateFormat("yyyy-MM-dd").format(new java.util.Date())));
                    ps.setString(6, body.optString("notes", ""));
                    ps.executeUpdate();
                    try (ResultSet keys = ps.getGeneratedKeys()) {
                        int id = keys.next() ? keys.getInt(1) : 0;
                        resp.setStatus(201);
                        resp.getWriter().print(new JSONObject().put("success", true).put("id", id).toString());
                    }
                }
                return;
            }

            // POST /api/payroll/cash-loans/{id}/payment — record a loan payment
            if (pathInfo != null && pathInfo.matches("/cash-loans/\\d+/payment")) {
                int loanId = Integer.parseInt(pathInfo.replaceAll("/cash-loans/(\\d+)/payment", "$1"));
                double amountPaid = body.getDouble("amountPaid");
                // Fetch current remaining
                double remaining = 0;
                try (PreparedStatement ps = conn.prepareStatement("SELECT remaining_balance FROM cash_loans WHERE id=?")) {
                    ps.setInt(1, loanId);
                    try (ResultSet rs = ps.executeQuery()) {
                        if (rs.next()) remaining = rs.getDouble("remaining_balance");
                    }
                }
                double newRemaining = Math.max(0, remaining - amountPaid);
                String newStatus = newRemaining <= 0 ? "paid" : "active";
                try (PreparedStatement ps = conn.prepareStatement("UPDATE cash_loans SET remaining_balance=?, status=? WHERE id=?")) {
                    ps.setDouble(1, newRemaining);
                    ps.setString(2, newStatus);
                    ps.setInt(3, loanId);
                    ps.executeUpdate();
                }
                resp.getWriter().print(new JSONObject().put("success", true).put("remainingBalance", newRemaining).put("status", newStatus).toString());
                return;
            }

            // POST /api/payroll/penalties
            if ("/penalties".equals(pathInfo)) {
                String sql = "INSERT INTO payroll_penalties (employee_id, event_id, penalty_type, amount, reason) VALUES (?,?,?,?,?)";
                try (PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
                    ps.setInt(1, body.getInt("employeeId"));
                    if (body.has("eventId") && !body.isNull("eventId") && body.optInt("eventId", 0) != 0) {
                        ps.setInt(2, body.getInt("eventId"));
                    } else {
                        ps.setNull(2, java.sql.Types.INTEGER);
                    }
                    ps.setString(3, body.getString("penaltyType"));
                    ps.setDouble(4, body.getDouble("amount"));
                    ps.setString(5, body.optString("reason", ""));
                    ps.executeUpdate();
                    try (ResultSet keys = ps.getGeneratedKeys()) {
                        int id = keys.next() ? keys.getInt(1) : 0;
                        resp.setStatus(201);
                        resp.getWriter().print(new JSONObject().put("success", true).put("id", id).toString());
                    }
                }
                return;
            }

            // POST /api/payroll/generate — auto-generate payroll for all crew in event
            if ("/generate".equals(pathInfo)) {
                int eventId = body.getInt("eventId");
                // Get all crew from event_attendance for this event
                String crewSql = "SELECT ea.employee_id, ea.role, ea.assignment FROM event_attendance ea WHERE ea.event_id = ?";
                // Get departments
                String deptSql = "SELECT * FROM event_payroll_departments WHERE event_id = ?";

                JSONArray depts = new JSONArray();
                try (PreparedStatement ps = conn.prepareStatement(deptSql)) {
                    ps.setInt(1, eventId);
                    try (ResultSet rs = ps.executeQuery()) {
                        while (rs.next()) {
                            JSONObject d = new JSONObject();
                            d.put("departmentName", rs.getString("department_name"));
                            d.put("allocatedAmount", rs.getDouble("allocated_amount"));
                            depts.put(d);
                        }
                    }
                }

                // Count crew per department (matched by assignment)
                JSONArray crew = new JSONArray();
                try (PreparedStatement ps = conn.prepareStatement(crewSql)) {
                    ps.setInt(1, eventId);
                    try (ResultSet rs = ps.executeQuery()) {
                        while (rs.next()) {
                            JSONObject c = new JSONObject();
                            c.put("employeeId", rs.getInt("employee_id"));
                            c.put("role", rs.getString("role"));
                            c.put("assignment", rs.getString("assignment"));
                            crew.put(c);
                        }
                    }
                }

                // For each crew member, calculate rate from their department
                String upsertSql = "INSERT INTO employee_payroll (event_id, employee_id, department, base_rate, " +
                                   "cash_advance_deduction, loan_deduction, penalty_deduction, net_pay, status) " +
                                   "VALUES (?,?,?,?,0,0,0,?,?) " +
                                   "ON DUPLICATE KEY UPDATE department=VALUES(department), base_rate=VALUES(base_rate), net_pay=VALUES(net_pay)";

                int generated = 0;
                try (PreparedStatement ps = conn.prepareStatement(upsertSql)) {
                    for (int i = 0; i < crew.length(); i++) {
                        JSONObject c = crew.getJSONObject(i);
                        String assignment = c.optString("assignment", "").toLowerCase().trim();

                        // Match crew assignment to department
                        double rate = 0;
                        String deptName = "";
                        for (int j = 0; j < depts.length(); j++) {
                            JSONObject d = depts.getJSONObject(j);
                            String dn = d.getString("departmentName").toLowerCase().trim();
                            if (assignment.contains(dn) || dn.contains(assignment)) {
                                // Count how many crew in same department
                                int countInDept = 0;
                                for (int k = 0; k < crew.length(); k++) {
                                    String ca = crew.getJSONObject(k).optString("assignment", "").toLowerCase().trim();
                                    if (ca.contains(dn) || dn.contains(ca)) countInDept++;
                                }
                                if (countInDept > 0) {
                                    rate = d.getDouble("allocatedAmount") / countInDept;
                                }
                                deptName = d.getString("departmentName");
                                break;
                            }
                        }

                        ps.setInt(1, eventId);
                        ps.setInt(2, c.getInt("employeeId"));
                        ps.setString(3, deptName);
                        ps.setDouble(4, rate);
                        ps.setDouble(5, rate); // net_pay = rate initially
                        ps.setString(6, "pending");
                        ps.addBatch();
                        generated++;
                    }
                    ps.executeBatch();
                }

                resp.getWriter().print(new JSONObject().put("success", true).put("generated", generated).toString());
                return;
            }

            resp.setStatus(400);
            resp.getWriter().print(err("Unknown endpoint"));

        } catch (Exception e) {
            e.printStackTrace();
            resp.setStatus(500);
            resp.getWriter().print(err(e.getMessage()));
        }
    }

    @Override
    protected void doPut(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        resp.setContentType("application/json;charset=UTF-8");
        String pathInfo = req.getPathInfo();
        JSONObject body = readBody(req);

        try (Connection conn = DatabaseManager.getConnection()) {

            // PUT /api/payroll/departments/{id}
            if (pathInfo != null && pathInfo.startsWith("/departments/")) {
                int id = Integer.parseInt(pathInfo.substring("/departments/".length()));
                String sql = "UPDATE event_payroll_departments SET department_name=?, allocated_amount=? WHERE id=?";
                try (PreparedStatement ps = conn.prepareStatement(sql)) {
                    ps.setString(1, body.getString("departmentName"));
                    ps.setDouble(2, body.getDouble("allocatedAmount"));
                    ps.setInt(3, id);
                    ps.executeUpdate();
                    resp.getWriter().print(new JSONObject().put("success", true).toString());
                }
                return;
            }

            // PUT /api/payroll/employee-payroll/{id}
            if (pathInfo != null && pathInfo.startsWith("/employee-payroll/")) {
                int id = Integer.parseInt(pathInfo.substring("/employee-payroll/".length()));
                double baseRate = body.optDouble("baseRate", 0);
                double caDeduction = body.optDouble("cashAdvanceDeduction", 0);
                double loanDeduction = body.optDouble("loanDeduction", 0);
                double penaltyDeduction = body.optDouble("penaltyDeduction", 0);
                double netPay = baseRate - caDeduction - loanDeduction - penaltyDeduction;

                String sql = "UPDATE employee_payroll SET department=?, base_rate=?, cash_advance_deduction=?, " +
                             "loan_deduction=?, penalty_deduction=?, net_pay=?, status=? WHERE id=?";
                try (PreparedStatement ps = conn.prepareStatement(sql)) {
                    ps.setString(1, body.optString("department", ""));
                    ps.setDouble(2, baseRate);
                    ps.setDouble(3, caDeduction);
                    ps.setDouble(4, loanDeduction);
                    ps.setDouble(5, penaltyDeduction);
                    ps.setDouble(6, netPay);
                    ps.setString(7, body.optString("status", "pending"));
                    ps.setInt(8, id);
                    ps.executeUpdate();
                    resp.getWriter().print(new JSONObject().put("success", true).put("netPay", netPay).toString());
                }
                return;
            }

            // PUT /api/payroll/cash-advances/{id}
            if (pathInfo != null && pathInfo.startsWith("/cash-advances/")) {
                int id = Integer.parseInt(pathInfo.substring("/cash-advances/".length()));
                String sql = "UPDATE cash_advances SET amount=?, notes=?, deducted=?, deducted_from_event_id=? WHERE id=?";
                try (PreparedStatement ps = conn.prepareStatement(sql)) {
                    ps.setDouble(1, body.getDouble("amount"));
                    ps.setString(2, body.optString("notes", ""));
                    ps.setBoolean(3, body.optBoolean("deducted", false));
                    ps.setInt(4, body.optInt("deductedFromEventId", 0));
                    ps.setInt(5, id);
                    ps.executeUpdate();
                    resp.getWriter().print(new JSONObject().put("success", true).toString());
                }
                return;
            }

            // PUT /api/payroll/cash-loans/{id}
            if (pathInfo != null && pathInfo.startsWith("/cash-loans/")) {
                int id = Integer.parseInt(pathInfo.substring("/cash-loans/".length()));
                double remaining = body.getDouble("remainingBalance");
                String status = remaining <= 0 ? "paid" : "active";
                String sql = "UPDATE cash_loans SET remaining_balance=?, installment_amount=?, notes=?, status=? WHERE id=?";
                try (PreparedStatement ps = conn.prepareStatement(sql)) {
                    ps.setDouble(1, remaining);
                    ps.setDouble(2, body.optDouble("installmentAmount", 0));
                    ps.setString(3, body.optString("notes", ""));
                    ps.setString(4, status);
                    ps.setInt(5, id);
                    ps.executeUpdate();
                    resp.getWriter().print(new JSONObject().put("success", true).toString());
                }
                return;
            }

            // PUT /api/payroll/contract-price — update event contract price
            if ("/contract-price".equals(pathInfo)) {
                int eventId = body.getInt("eventId");
                double price = body.getDouble("contractPrice");
                boolean vatIncluded = body.optBoolean("vatIncluded", false);
                String sql = "UPDATE events SET contract_price = ?, vat_included = ? WHERE id = ?";
                try (PreparedStatement ps = conn.prepareStatement(sql)) {
                    ps.setDouble(1, price);
                    ps.setBoolean(2, vatIncluded);
                    ps.setInt(3, eventId);
                    ps.executeUpdate();
                    resp.getWriter().print(new JSONObject().put("success", true).toString());
                }
                return;
            }

            // PUT /api/payroll/meal-budget — update event meal budget
            if ("/meal-budget".equals(pathInfo)) {
                int eventId = body.getInt("eventId");
                double budget = body.getDouble("mealBudget");
                boolean mealVatIncluded = body.optBoolean("mealVatIncluded", false);
                String sql = "UPDATE events SET meal_budget = ?, meal_vat_included = ? WHERE id = ?";
                try (PreparedStatement ps = conn.prepareStatement(sql)) {
                    ps.setDouble(1, budget);
                    ps.setBoolean(2, mealVatIncluded);
                    ps.setInt(3, eventId);
                    ps.executeUpdate();
                    resp.getWriter().print(new JSONObject().put("success", true).toString());
                }
                return;
            }

            // PUT /api/payroll/daily-rate — update employee hourly rate
            if ("/daily-rate".equals(pathInfo)) {
                int empId = body.getInt("employeeId");
                double rate = body.has("hourlyRate") ? body.getDouble("hourlyRate") : body.getDouble("dailyRate");
                String sql = "UPDATE employees SET daily_rate = ? WHERE id = ?";
                try (PreparedStatement ps = conn.prepareStatement(sql)) {
                    ps.setDouble(1, rate);
                    ps.setInt(2, empId);
                    ps.executeUpdate();
                    resp.getWriter().print(new JSONObject().put("success", true).toString());
                }
                return;
            }

            resp.setStatus(400);
            resp.getWriter().print(err("Unknown endpoint"));

        } catch (Exception e) {
            e.printStackTrace();
            resp.setStatus(500);
            resp.getWriter().print(err(e.getMessage()));
        }
    }

    @Override
    protected void doDelete(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        resp.setContentType("application/json;charset=UTF-8");
        String pathInfo = req.getPathInfo();

        try (Connection conn = DatabaseManager.getConnection()) {

            if (pathInfo != null && pathInfo.startsWith("/departments/")) {
                int id = Integer.parseInt(pathInfo.substring("/departments/".length()));
                try (PreparedStatement ps = conn.prepareStatement("DELETE FROM event_payroll_departments WHERE id=?")) {
                    ps.setInt(1, id);
                    ps.executeUpdate();
                    resp.getWriter().print(new JSONObject().put("success", true).toString());
                }
                return;
            }

            if (pathInfo != null && pathInfo.startsWith("/employee-payroll/")) {
                int id = Integer.parseInt(pathInfo.substring("/employee-payroll/".length()));
                try (PreparedStatement ps = conn.prepareStatement("DELETE FROM employee_payroll WHERE id=?")) {
                    ps.setInt(1, id);
                    ps.executeUpdate();
                    resp.getWriter().print(new JSONObject().put("success", true).toString());
                }
                return;
            }

            if (pathInfo != null && pathInfo.startsWith("/cash-advances/")) {
                int id = Integer.parseInt(pathInfo.substring("/cash-advances/".length()));
                try (PreparedStatement ps = conn.prepareStatement("DELETE FROM cash_advances WHERE id=?")) {
                    ps.setInt(1, id);
                    ps.executeUpdate();
                    resp.getWriter().print(new JSONObject().put("success", true).toString());
                }
                return;
            }

            if (pathInfo != null && pathInfo.startsWith("/cash-loans/")) {
                int id = Integer.parseInt(pathInfo.substring("/cash-loans/".length()));
                try (PreparedStatement ps = conn.prepareStatement("DELETE FROM cash_loans WHERE id=?")) {
                    ps.setInt(1, id);
                    ps.executeUpdate();
                    resp.getWriter().print(new JSONObject().put("success", true).toString());
                }
                return;
            }

            if (pathInfo != null && pathInfo.startsWith("/penalties/")) {
                int id = Integer.parseInt(pathInfo.substring("/penalties/".length()));
                try (PreparedStatement ps = conn.prepareStatement("DELETE FROM payroll_penalties WHERE id=?")) {
                    ps.setInt(1, id);
                    ps.executeUpdate();
                    resp.getWriter().print(new JSONObject().put("success", true).toString());
                }
                return;
            }

            resp.setStatus(400);
            resp.getWriter().print(err("Unknown endpoint"));

        } catch (Exception e) {
            e.printStackTrace();
            resp.setStatus(500);
            resp.getWriter().print(err(e.getMessage()));
        }
    }

    private JSONObject employeePayrollToJson(ResultSet rs) throws SQLException {
        JSONObject o = new JSONObject();
        o.put("id", rs.getInt("id"));
        o.put("eventId", rs.getInt("event_id"));
        o.put("employeeId", rs.getInt("employee_id"));
        o.put("employeeName", rs.getString("first_name") + " " + rs.getString("last_name"));
        o.put("position", rs.getString("position"));
        o.put("crewRole", rs.getString("crew_role"));
        o.put("crewAssignment", rs.getString("crew_assignment"));
        o.put("department", rs.getString("department"));
        o.put("baseRate", rs.getDouble("base_rate"));
        o.put("cashAdvanceDeduction", rs.getDouble("cash_advance_deduction"));
        o.put("loanDeduction", rs.getDouble("loan_deduction"));
        o.put("penaltyDeduction", rs.getDouble("penalty_deduction"));
        o.put("netPay", rs.getDouble("net_pay"));
        o.put("status", rs.getString("status"));
        return o;
    }

    private JSONObject readBody(HttpServletRequest req) throws IOException {
        BufferedReader r = req.getReader();
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = r.readLine()) != null) sb.append(line);
        return new JSONObject(sb.toString());
    }

    private String err(String msg) {
        return new JSONObject().put("error", msg).toString();
    }
}
