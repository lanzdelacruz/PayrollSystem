package com.reddamien.servlet;

import java.io.IOException;
import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.text.SimpleDateFormat;
import java.util.Date;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
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
            if (pathInfo == null || pathInfo.equals("/")) {
                // List all payrolls
                String sql = "SELECT p.*, e.first_name, e.last_name FROM payrolls p JOIN employees e ON p.employee_id = e.id ORDER BY p.payroll_date DESC";
                try (PreparedStatement ps = conn.prepareStatement(sql);
                     ResultSet rs = ps.executeQuery()) {
                    JSONArray arr = new JSONArray();
                    while (rs.next()) {
                        arr.put(rowToJson(rs));
                    }
                    resp.getWriter().print(arr.toString());
                }
            } else {
                // Get one payroll by id
                int id = Integer.parseInt(pathInfo.substring(1));
                String sql = "SELECT p.*, e.first_name, e.last_name FROM payrolls p JOIN employees e ON p.employee_id = e.id WHERE p.id = ?";
                try (PreparedStatement ps = conn.prepareStatement(sql)) {
                    ps.setInt(1, id);
                    try (ResultSet rs = ps.executeQuery()) {
                        if (rs.next()) {
                            JSONObject json = rowToJson(rs);
                            // also get payroll items
                            String itemsSql = "SELECT * FROM payroll_items WHERE payroll_id = ?";
                            try (PreparedStatement itemsPs = conn.prepareStatement(itemsSql)) {
                                itemsPs.setInt(1, id);
                                try (ResultSet itemsRs = itemsPs.executeQuery()) {
                                    JSONArray itemsArr = new JSONArray();
                                    while (itemsRs.next()) {
                                        itemsArr.put(new JSONObject()
                                            .put("id", itemsRs.getInt("id"))
                                            .put("itemType", itemsRs.getString("item_type"))
                                            .put("description", itemsRs.getString("description"))
                                            .put("amount", itemsRs.getBigDecimal("amount"))
                                        );
                                    }
                                    json.put("items", itemsArr);
                                }
                            }
                            resp.getWriter().print(json.toString());
                        } else {
                            resp.setStatus(404);
                            resp.getWriter().print(new JSONObject().put("error", "Payroll not found").toString());
                        }
                    }
                }
            }
        } catch (SQLException e) {
            resp.setStatus(500);
            resp.getWriter().print(new JSONObject().put("error", e.getMessage()).toString());
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        resp.setContentType("application/json;charset=UTF-8");

        try (Connection conn = DatabaseManager.getConnection()) {
            int employeeId = Integer.parseInt(param(req, "employeeId"));
            String startDateStr = param(req, "startDate");
            String endDateStr = param(req, "endDate");

            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd");
            Date startDate = sdf.parse(startDateStr);
            Date endDate = sdf.parse(endDateStr);

            // Get employee type
            String employeeType = "";
            BigDecimal rate = BigDecimal.ZERO;
            String sqlEmployee = "SELECT employee_type, rate FROM employees WHERE id = ?";
            try (PreparedStatement ps = conn.prepareStatement(sqlEmployee)) {
                ps.setInt(1, employeeId);
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) {
                        employeeType = rs.getString("employee_type");
                        rate = rs.getBigDecimal("rate");
                    } else {
                        resp.setStatus(404);
                        resp.getWriter().print(new JSONObject().put("error", "Employee not found").toString());
                        return;
                    }
                }
            }

            BigDecimal grossPay = BigDecimal.ZERO;
            JSONArray earnings = new JSONArray();

            if ("full-time".equals(employeeType)) {
                grossPay = calculateFullTimeGrossPay(conn, employeeId, startDate, endDate, rate, earnings);
            } else if ("on-call".equals(employeeType)) {
                grossPay = calculateOnCallGrossPay(conn, employeeId, startDate, endDate, rate, earnings);
            }

            BigDecimal deductions = calculateDeductions(conn, employeeId, startDate, endDate, earnings);
            BigDecimal netPay = grossPay.subtract(deductions);

            // Create payroll record
            String sqlPayroll = "INSERT INTO payrolls (employee_id, payroll_date, start_date, end_date, gross_pay, net_pay, status) VALUES (?, CURDATE(), ?, ?, ?, ?, ?)";
            try (PreparedStatement ps = conn.prepareStatement(sqlPayroll, Statement.RETURN_GENERATED_KEYS)) {
                ps.setInt(1, employeeId);
                ps.setDate(2, new java.sql.Date(startDate.getTime()));
                ps.setDate(3, new java.sql.Date(endDate.getTime()));
                ps.setBigDecimal(4, grossPay);
                ps.setBigDecimal(5, netPay);
                ps.setString(6, "pending");
                ps.executeUpdate();

                try (ResultSet generatedKeys = ps.getGeneratedKeys()) {
                    if (generatedKeys.next()) {
                        int payrollId = generatedKeys.getInt(1);

                        // Insert payroll items
                        for (int i = 0; i < earnings.length(); i++) {
                            JSONObject item = earnings.getJSONObject(i);
                            String itemSql = "INSERT INTO payroll_items (payroll_id, item_type, description, amount) VALUES (?, ?, ?, ?)";
                            try (PreparedStatement itemPs = conn.prepareStatement(itemSql)) {
                                itemPs.setInt(1, payrollId);
                                itemPs.setString(2, item.getString("itemType"));
                                itemPs.setString(3, item.getString("description"));
                                itemPs.setBigDecimal(4, item.getBigDecimal("amount"));
                                itemPs.executeUpdate();
                            }
                        }
                        
                        resp.setStatus(201);
                        resp.getWriter().print(new JSONObject().put("payrollId", payrollId).toString());

                    } else {
                        throw new SQLException("Creating payroll failed, no ID obtained.");
                    }
                }
            }

        } catch (Exception e) {
            resp.setStatus(500);
            resp.getWriter().print(new JSONObject().put("error", e.getMessage()).toString());
        }
    }
    
    @Override
    protected void doPut(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        resp.setContentType("application/json;charset=UTF-8");
        String pathInfo = req.getPathInfo();
        if (pathInfo == null || pathInfo.equals("/")) {
            resp.setStatus(400);
            resp.getWriter().print(new JSONObject().put("error", "Payroll ID is required").toString());
            return;
        }

        try (Connection conn = DatabaseManager.getConnection()) {
            int id = Integer.parseInt(pathInfo.substring(1));
            String status = param(req, "status");

            if (status != null && !status.isEmpty()) {
                String sql = "UPDATE payrolls SET status = ? WHERE id = ?";
                try (PreparedStatement ps = conn.prepareStatement(sql)) {
                    ps.setString(1, status);
                    ps.setInt(2, id);
                    int rows = ps.executeUpdate();
                    if (rows > 0) {
                        resp.getWriter().print(new JSONObject().put("success", true).toString());
                    } else {
                        resp.setStatus(404);
                        resp.getWriter().print(new JSONObject().put("error", "Payroll not found").toString());
                    }
                }
            } else {
                resp.setStatus(400);
                resp.getWriter().print(new JSONObject().put("error", "Status is required").toString());
            }

        } catch (Exception e) {
            resp.setStatus(500);
            resp.getWriter().print(new JSONObject().put("error", e.getMessage()).toString());
        }
    }

    private BigDecimal calculateFullTimeGrossPay(Connection conn, int employeeId, Date startDate, Date endDate, BigDecimal dailyRate, JSONArray earnings) throws SQLException {
        BigDecimal grossPay = BigDecimal.ZERO;
        String sql = "SELECT COUNT(*) as days_worked FROM time_logs WHERE employee_id = ? AND log_date BETWEEN ? AND ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, employeeId);
            ps.setDate(2, new java.sql.Date(startDate.getTime()));
            ps.setDate(3, new java.sql.Date(endDate.getTime()));
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    int daysWorked = rs.getInt("days_worked");
                    grossPay = dailyRate.multiply(new BigDecimal(daysWorked));
                    earnings.put(new JSONObject()
                        .put("itemType", "earning")
                        .put("description", "Salary for " + daysWorked + " days")
                        .put("amount", grossPay)
                    );
                }
            }
        }
        return grossPay;
    }

    private BigDecimal calculateOnCallGrossPay(Connection conn, int employeeId, Date startDate, Date endDate, BigDecimal rate, JSONArray earnings) throws SQLException {
        BigDecimal grossPay = BigDecimal.ZERO;
        String sql = "SELECT e.event_name, e.contract_price FROM event_crew_assignments eca " +
                     "JOIN events e ON eca.event_id = e.id " +
                     "WHERE eca.employee_id = ? AND e.event_date BETWEEN ? AND ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, employeeId);
            ps.setDate(2, new java.sql.Date(startDate.getTime()));
            ps.setDate(3, new java.sql.Date(endDate.getTime()));
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    BigDecimal contractPrice = rs.getBigDecimal("contract_price");
                    BigDecimal pay = contractPrice.multiply(rate.divide(new BigDecimal(100)));
                    grossPay = grossPay.add(pay);
                    earnings.put(new JSONObject()
                        .put("itemType", "earning")
                        .put("description", "On-call pay for event: " + rs.getString("event_name"))
                        .put("amount", pay)
                    );
                }
            }
        }
        return grossPay;
    }

    private BigDecimal calculateDeductions(Connection conn, int employeeId, Date startDate, Date endDate, JSONArray earnings) throws SQLException {
        BigDecimal totalDeductions = BigDecimal.ZERO;

        // Cash Advances
        String sqlCashAdvance = "SELECT * FROM cash_advances WHERE employee_id = ? AND status = 'approved' AND advance_date BETWEEN ? AND ?";
        try (PreparedStatement ps = conn.prepareStatement(sqlCashAdvance)) {
            ps.setInt(1, employeeId);
            ps.setDate(2, new java.sql.Date(startDate.getTime()));
            ps.setDate(3, new java.sql.Date(endDate.getTime()));
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    BigDecimal amount = rs.getBigDecimal("amount");
                    totalDeductions = totalDeductions.add(amount);
                    earnings.put(new JSONObject()
                        .put("itemType", "deduction")
                        .put("description", "Cash Advance on " + rs.getDate("advance_date"))
                        .put("amount", amount.negate())
                    );
                    // Mark as paid
                    String updateSql = "UPDATE cash_advances SET status = 'paid' WHERE id = ?";
                    try (PreparedStatement updatePs = conn.prepareStatement(updateSql)) {
                        updatePs.setInt(1, rs.getInt("id"));
                        updatePs.executeUpdate();
                    }
                }
            }
        }

        // Cash Loans
        String sqlCashLoan = "SELECT * FROM cash_loans WHERE employee_id = ? AND status = 'approved' AND paid_installments < installments";
        try (PreparedStatement ps = conn.prepareStatement(sqlCashLoan)) {
            ps.setInt(1, employeeId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    BigDecimal loanAmount = rs.getBigDecimal("amount");
                    int installments = rs.getInt("installments");
                    BigDecimal installmentAmount = loanAmount.divide(new BigDecimal(installments), 2, BigDecimal.ROUND_HALF_UP);
                    totalDeductions = totalDeductions.add(installmentAmount);
                    earnings.put(new JSONObject()
                        .put("itemType", "deduction")
                        .put("description", "Cash Loan Installment (" + (rs.getInt("paid_installments") + 1) + "/" + installments + ")")
                        .put("amount", installmentAmount.negate())
                    );
                    // Update paid installments
                    String updateSql = "UPDATE cash_loans SET paid_installments = paid_installments + 1 WHERE id = ?";
                     try (PreparedStatement updatePs = conn.prepareStatement(updateSql)) {
                        updatePs.setInt(1, rs.getInt("id"));
                        updatePs.executeUpdate();
                    }
                }
            }
        }
        
        // Penalties
        String sqlPenalties = "SELECT * FROM penalties WHERE employee_id = ? AND penalty_date BETWEEN ? AND ?";
        try (PreparedStatement ps = conn.prepareStatement(sqlPenalties)) {
            ps.setInt(1, employeeId);
            ps.setDate(2, new java.sql.Date(startDate.getTime()));
            ps.setDate(3, new java.sql.Date(endDate.getTime()));
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    BigDecimal amount = rs.getBigDecimal("amount");
                    totalDeductions = totalDeductions.add(amount);
                    earnings.put(new JSONObject()
                        .put("itemType", "deduction")
                        .put("description", "Penalty: " + rs.getString("reason"))
                        .put("amount", amount.negate())
                    );
                }
            }
        }

        return totalDeductions;
    }

    private JSONObject rowToJson(ResultSet rs) throws SQLException {
        JSONObject o = new JSONObject();
        o.put("id", rs.getInt("id"));
        o.put("employeeId", rs.getInt("employee_id"));
        o.put("employeeName", rs.getString("first_name") + " " + rs.getString("last_name"));
        o.put("payrollDate", rs.getDate("payroll_date"));
        o.put("startDate", rs.getDate("start_date"));
        o.put("endDate", rs.getDate("end_date"));
        o.put("grossPay", rs.getBigDecimal("gross_pay"));
        o.put("netPay", rs.getBigDecimal("net_pay"));
        o.put("status", rs.getString("status"));
        return o;
    }

    private String param(HttpServletRequest req, String name) {
        String val = req.getParameter(name);
        return val != null ? val.trim() : "";
    }
}
