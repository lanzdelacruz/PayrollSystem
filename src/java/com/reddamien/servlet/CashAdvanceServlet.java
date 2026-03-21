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

@WebServlet("/api/cash-advances/*")
public class CashAdvanceServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        resp.setContentType("application/json;charset=UTF-8");
        String pathInfo = req.getPathInfo();

        try (Connection conn = DatabaseManager.getConnection()) {
            if (pathInfo == null || pathInfo.equals("/")) {
                // List all cash advances
                String sql = "SELECT ca.*, e.first_name, e.last_name FROM cash_advances ca JOIN employees e ON ca.employee_id = e.id ORDER BY ca.advance_date DESC";
                try (PreparedStatement ps = conn.prepareStatement(sql);
                     ResultSet rs = ps.executeQuery()) {
                    JSONArray arr = new JSONArray();
                    while (rs.next()) {
                        arr.put(new JSONObject()
                            .put("id", rs.getInt("id"))
                            .put("employeeId", rs.getInt("employee_id"))
                            .put("employeeName", rs.getString("first_name") + " " + rs.getString("last_name"))
                            .put("advanceDate", rs.getDate("advance_date"))
                            .put("amount", rs.getBigDecimal("amount"))
                            .put("reason", rs.getString("reason"))
                            .put("status", rs.getString("status"))
                        );
                    }
                    resp.getWriter().print(arr.toString());
                }
            } else {
                // Get one cash advance by id
                int id = Integer.parseInt(pathInfo.substring(1));
                String sql = "SELECT ca.*, e.first_name, e.last_name FROM cash_advances ca JOIN employees e ON ca.employee_id = e.id WHERE ca.id = ?";
                try (PreparedStatement ps = conn.prepareStatement(sql)) {
                    ps.setInt(1, id);
                    try (ResultSet rs = ps.executeQuery()) {
                        if (rs.next()) {
                            JSONObject json = new JSONObject()
                                .put("id", rs.getInt("id"))
                                .put("employeeId", rs.getInt("employee_id"))
                                .put("employeeName", rs.getString("first_name") + " " + rs.getString("last_name"))
                                .put("advanceDate", rs.getDate("advance_date"))
                                .put("amount", rs.getBigDecimal("amount"))
                                .put("reason", rs.getString("reason"))
                                .put("status", rs.getString("status"));
                            resp.getWriter().print(json.toString());
                        } else {
                            resp.setStatus(404);
                            resp.getWriter().print(new JSONObject().put("error", "Cash advance not found").toString());
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
            String advanceDateStr = param(req, "advanceDate");
            BigDecimal amount = new BigDecimal(param(req, "amount"));
            String reason = param(req, "reason");

            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd");
            Date advanceDate = sdf.parse(advanceDateStr);

            String sql = "INSERT INTO cash_advances (employee_id, advance_date, amount, reason, status) VALUES (?, ?, ?, ?, ?)";
            try (PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
                ps.setInt(1, employeeId);
                ps.setDate(2, new java.sql.Date(advanceDate.getTime()));
                ps.setBigDecimal(3, amount);
                ps.setString(4, reason);
                ps.setString(5, "pending");
                ps.executeUpdate();

                try (ResultSet generatedKeys = ps.getGeneratedKeys()) {
                    if (generatedKeys.next()) {
                        int cashAdvanceId = generatedKeys.getInt(1);
                        resp.setStatus(201);
                        resp.getWriter().print(new JSONObject().put("cashAdvanceId", cashAdvanceId).toString());
                    } else {
                        throw new SQLException("Creating cash advance failed, no ID obtained.");
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
            resp.getWriter().print(new JSONObject().put("error", "Cash advance ID is required").toString());
            return;
        }

        try (Connection conn = DatabaseManager.getConnection()) {
            int id = Integer.parseInt(pathInfo.substring(1));
            String status = param(req, "status");

            if (status != null && !status.isEmpty()) {
                String sql = "UPDATE cash_advances SET status = ? WHERE id = ?";
                try (PreparedStatement ps = conn.prepareStatement(sql)) {
                    ps.setString(1, status);
                    ps.setInt(2, id);
                    int rows = ps.executeUpdate();
                    if (rows > 0) {
                        resp.getWriter().print(new JSONObject().put("success", true).toString());
                    } else {
                        resp.setStatus(404);
                        resp.getWriter().print(new JSONObject().put("error", "Cash advance not found").toString());
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
