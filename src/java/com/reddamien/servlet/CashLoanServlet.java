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

@WebServlet("/api/cash-loans/*")
public class CashLoanServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        resp.setContentType("application/json;charset=UTF-8");
        String pathInfo = req.getPathInfo();

        try (Connection conn = DatabaseManager.getConnection()) {
            if (pathInfo == null || pathInfo.equals("/")) {
                // List all cash loans
                String sql = "SELECT cl.*, e.first_name, e.last_name FROM cash_loans cl JOIN employees e ON cl.employee_id = e.id ORDER BY cl.loan_date DESC";
                try (PreparedStatement ps = conn.prepareStatement(sql);
                     ResultSet rs = ps.executeQuery()) {
                    JSONArray arr = new JSONArray();
                    while (rs.next()) {
                        arr.put(new JSONObject()
                            .put("id", rs.getInt("id"))
                            .put("employeeId", rs.getInt("employee_id"))
                            .put("employeeName", rs.getString("first_name") + " " + rs.getString("last_name"))
                            .put("loanDate", rs.getDate("loan_date"))
                            .put("amount", rs.getBigDecimal("amount"))
                            .put("installments", rs.getInt("installments"))
                            .put("paidInstallments", rs.getInt("paid_installments"))
                            .put("status", rs.getString("status"))
                        );
                    }
                    resp.getWriter().print(arr.toString());
                }
            } else {
                // Get one cash loan by id
                int id = Integer.parseInt(pathInfo.substring(1));
                String sql = "SELECT cl.*, e.first_name, e.last_name FROM cash_loans cl JOIN employees e ON cl.employee_id = e.id WHERE cl.id = ?";
                try (PreparedStatement ps = conn.prepareStatement(sql)) {
                    ps.setInt(1, id);
                    try (ResultSet rs = ps.executeQuery()) {
                        if (rs.next()) {
                            JSONObject json = new JSONObject()
                                .put("id", rs.getInt("id"))
                                .put("employeeId", rs.getInt("employee_id"))
                                .put("employeeName", rs.getString("first_name") + " " + rs.getString("last_name"))
                                .put("loanDate", rs.getDate("loan_date"))
                                .put("amount", rs.getBigDecimal("amount"))
                                .put("installments", rs.getInt("installments"))
                                .put("paidInstallments", rs.getInt("paid_installments"))
                                .put("status", rs.getString("status"));
                            resp.getWriter().print(json.toString());
                        } else {
                            resp.setStatus(404);
                            resp.getWriter().print(new JSONObject().put("error", "Cash loan not found").toString());
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
            String loanDateStr = param(req, "loanDate");
            BigDecimal amount = new BigDecimal(param(req, "amount"));
            int installments = Integer.parseInt(param(req, "installments"));

            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd");
            Date loanDate = sdf.parse(loanDateStr);

            String sql = "INSERT INTO cash_loans (employee_id, loan_date, amount, installments, status) VALUES (?, ?, ?, ?, ?)";
            try (PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
                ps.setInt(1, employeeId);
                ps.setDate(2, new java.sql.Date(loanDate.getTime()));
                ps.setBigDecimal(3, amount);
                ps.setInt(4, installments);
                ps.setString(5, "pending");
                ps.executeUpdate();

                try (ResultSet generatedKeys = ps.getGeneratedKeys()) {
                    if (generatedKeys.next()) {
                        int cashLoanId = generatedKeys.getInt(1);
                        resp.setStatus(201);
                        resp.getWriter().print(new JSONObject().put("cashLoanId", cashLoanId).toString());
                    } else {
                        throw new SQLException("Creating cash loan failed, no ID obtained.");
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
            resp.getWriter().print(new JSONObject().put("error", "Cash loan ID is required").toString());
            return;
        }

        try (Connection conn = DatabaseManager.getConnection()) {
            int id = Integer.parseInt(pathInfo.substring(1));
            String status = param(req, "status");

            if (status != null && !status.isEmpty()) {
                String sql = "UPDATE cash_loans SET status = ? WHERE id = ?";
                try (PreparedStatement ps = conn.prepareStatement(sql)) {
                    ps.setString(1, status);
                    ps.setInt(2, id);
                    int rows = ps.executeUpdate();
                    if (rows > 0) {
                        resp.getWriter().print(new JSONObject().put("success", true).toString());
                    } else {
                        resp.setStatus(404);
                        resp.getWriter().print(new JSONObject().put("error", "Cash loan not found").toString());
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

    private String param(HttpServletRequest req, String name) {
        String val = req.getParameter(name);
        return val != null ? val.trim() : "";
    }
}
