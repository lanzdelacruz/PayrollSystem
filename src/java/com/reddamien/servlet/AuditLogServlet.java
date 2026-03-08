package com.reddamien.servlet;

import java.io.*;
import java.sql.*;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.json.JSONArray;
import org.json.JSONObject;
import com.reddamien.db.DatabaseManager;

/**
 * Servlet for reading audit log entries.
 * Only business_owner and admin_assistant should access (enforced on front-end + optional backend check).
 */
@WebServlet("/api/audit-log")
public class AuditLogServlet extends HttpServlet {
    private static final long serialVersionUID = 1L;

    /**
     * GET — list audit log entries (newest first)
     * Optional query params: limit (default 200), action, targetType
     */
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json;charset=UTF-8");
        PrintWriter out = response.getWriter();

        try (Connection conn = DatabaseManager.getConnection()) {
            // Build query with optional filters
            StringBuilder sql = new StringBuilder(
                "SELECT id, user_id, user_name, user_role, action, target_type, target_id, target_name, details, created_at FROM audit_log WHERE 1=1 ");

            String actionFilter = request.getParameter("action");
            String targetTypeFilter = request.getParameter("targetType");
            String limitParam = request.getParameter("limit");
            int limit = 200;
            try { if (limitParam != null) limit = Integer.parseInt(limitParam); } catch (NumberFormatException ignored) {}

            if (actionFilter != null && !actionFilter.isEmpty()) {
                sql.append("AND action = ? ");
            }
            if (targetTypeFilter != null && !targetTypeFilter.isEmpty()) {
                sql.append("AND target_type = ? ");
            }
            sql.append("ORDER BY created_at DESC LIMIT ?");

            try (PreparedStatement ps = conn.prepareStatement(sql.toString())) {
                int idx = 1;
                if (actionFilter != null && !actionFilter.isEmpty()) {
                    ps.setString(idx++, actionFilter);
                }
                if (targetTypeFilter != null && !targetTypeFilter.isEmpty()) {
                    ps.setString(idx++, targetTypeFilter);
                }
                ps.setInt(idx, limit);

                try (ResultSet rs = ps.executeQuery()) {
                    JSONArray arr = new JSONArray();
                    while (rs.next()) {
                        JSONObject entry = new JSONObject();
                        entry.put("id", rs.getInt("id"));
                        entry.put("userId", rs.getInt("user_id"));
                        entry.put("userName", rs.getString("user_name"));
                        entry.put("userRole", rs.getString("user_role"));
                        entry.put("action", rs.getString("action"));
                        entry.put("targetType", rs.getString("target_type"));
                        entry.put("targetId", rs.getObject("target_id") != null ? rs.getInt("target_id") : JSONObject.NULL);
                        entry.put("targetName", rs.getString("target_name"));
                        entry.put("details", rs.getString("details"));
                        entry.put("createdAt", rs.getTimestamp("created_at") != null ? rs.getTimestamp("created_at").getTime() : JSONObject.NULL);
                        arr.put(entry);
                    }
                    out.println(arr.toString());
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            JSONObject err = new JSONObject();
            err.put("success", false);
            err.put("message", "Error fetching audit log: " + e.getMessage());
            out.println(err.toString());
        }
    }
}
