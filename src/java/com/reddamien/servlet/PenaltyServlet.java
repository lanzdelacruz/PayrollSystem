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

@WebServlet("/api/penalties/*")
public class PenaltyServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        resp.setContentType("application/json;charset=UTF-8");
        String pathInfo = req.getPathInfo();

        try (Connection conn = DatabaseManager.getConnection()) {
            if (pathInfo == null || pathInfo.equals("/")) {
                // List all penalties
                String sql = "SELECT p.*, e.first_name, e.last_name FROM penalties p JOIN employees e ON p.employee_id = e.id ORDER BY p.penalty_date DESC";
                try (PreparedStatement ps = conn.prepareStatement(sql);
                     ResultSet rs = ps.executeQuery()) {
                    JSONArray arr = new JSONArray();
                    while (rs.next()) {
                        arr.put(new JSONObject()
                            .put("id", rs.getInt("id"))
                            .put("employeeId", rs.getInt("employee_id"))
                            .put("employeeName", rs.getString("first_name") + " " + rs.getString("last_name"))
                            .put("penaltyDate", rs.getDate("penalty_date"))
                            .put("amount", rs.getBigDecimal("amount"))
                            .put("reason", rs.getString("reason"))
                        );
                    }
                    resp.getWriter().print(arr.toString());
                }
            } else {
                // Get one penalty by id
                int id = Integer.parseInt(pathInfo.substring(1));
                String sql = "SELECT p.*, e.first_name, e.last_name FROM penalties p JOIN employees e ON p.employee_id = e.id WHERE p.id = ?";
                try (PreparedStatement ps = conn.prepareStatement(sql)) {
                    ps.setInt(1, id);
                    try (ResultSet rs = ps.executeQuery()) {
                        if (rs.next()) {
                            JSONObject json = new JSONObject()
                                .put("id", rs.getInt("id"))
                                .put("employeeId", rs.getInt("employee_id"))
                                .put("employeeName", rs.getString("first_name") + " " + rs.getString("last_name"))
                                .put("penaltyDate", rs.getDate("penalty_date"))
                                .put("amount", rs.getBigDecimal("amount"))
                                .put("reason", rs.getString("reason"));
                            resp.getWriter().print(json.toString());
                        } else {
                            resp.setStatus(404);
                            resp.getWriter().print(new JSONObject().put("error", "Penalty not found").toString());
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
            String penaltyDateStr = param(req, "penaltyDate");
            BigDecimal amount = new BigDecimal(param(req, "amount"));
            String reason = param(req, "reason");

            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd");
            Date penaltyDate = sdf.parse(penaltyDateStr);

            String sql = "INSERT INTO penalties (employee_id, penalty_date, amount, reason) VALUES (?, ?, ?, ?)";
            try (PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
                ps.setInt(1, employeeId);
                ps.setDate(2, new java.sql.Date(penaltyDate.getTime()));
                ps.setBigDecimal(3, amount);
                ps.setString(4, reason);
                ps.executeUpdate();

                try (ResultSet generatedKeys = ps.getGeneratedKeys()) {
                    if (generatedKeys.next()) {
                        int penaltyId = generatedKeys.getInt(1);
                        resp.setStatus(201);
                        resp.getWriter().print(new JSONObject().put("penaltyId", penaltyId).toString());
                    } else {
                        throw new SQLException("Creating penalty failed, no ID obtained.");
                    }
                }
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
