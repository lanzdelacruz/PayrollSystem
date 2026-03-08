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
 * Servlet for user management (list, approve, reject, change role).
 * Only accessible by business_owner role (enforced on front-end).
 */
@WebServlet("/api/users")
public class UserManagementServlet extends HttpServlet {
    private static final long serialVersionUID = 1L;

    /**
     * GET — list all users
     */
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json;charset=UTF-8");
        PrintWriter out = response.getWriter();

        try (Connection conn = DatabaseManager.getConnection()) {
            String query = "SELECT id, username, email, first_name, last_name, user_role, status, created_at FROM users ORDER BY CASE status WHEN 'pending' THEN 1 WHEN 'approved' THEN 2 WHEN 'rejected' THEN 3 ELSE 4 END, created_at DESC";
            try (PreparedStatement stmt = conn.prepareStatement(query);
                 ResultSet rs = stmt.executeQuery()) {

                JSONArray arr = new JSONArray();
                while (rs.next()) {
                    JSONObject u = new JSONObject();
                    u.put("id", rs.getInt("id"));
                    u.put("username", rs.getString("username"));
                    u.put("email", rs.getString("email"));
                    u.put("firstName", rs.getString("first_name"));
                    u.put("lastName", rs.getString("last_name"));
                    u.put("userRole", rs.getString("user_role"));
                    u.put("status", rs.getString("status"));
                    u.put("createdAt", rs.getTimestamp("created_at") != null ? rs.getTimestamp("created_at").getTime() : JSONObject.NULL);
                    arr.put(u);
                }
                out.println(arr.toString());
            }
        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            JSONObject err = new JSONObject();
            err.put("success", false);
            err.put("message", "Error fetching users: " + e.getMessage());
            out.println(err.toString());
        }
    }

    /**
     * PUT — approve/reject a user or change their role
     * Body: { userId, status?, userRole? }
     */
    @Override
    protected void doPut(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json;charset=UTF-8");
        PrintWriter out = response.getWriter();

        try {
            BufferedReader reader = request.getReader();
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) sb.append(line);

            JSONObject body = new JSONObject(sb.toString());
            int userId = body.getInt("userId");
            String newStatus = body.optString("status", null);
            String newRole   = body.optString("userRole", null);

            if (newStatus == null && newRole == null) {
                response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                JSONObject r = new JSONObject();
                r.put("success", false);
                r.put("message", "Nothing to update");
                out.println(r.toString());
                return;
            }

            try (Connection conn = DatabaseManager.getConnection()) {
                // Fetch the target user's name for audit logging
                String targetUserName = "User #" + userId;
                try (PreparedStatement nameSt = conn.prepareStatement("SELECT first_name, last_name FROM users WHERE id = ?")) {
                    nameSt.setInt(1, userId);
                    try (ResultSet nameRs = nameSt.executeQuery()) {
                        if (nameRs.next()) {
                            targetUserName = nameRs.getString("first_name") + " " + nameRs.getString("last_name");
                        }
                    }
                }

                // Fetch old role for role-change detection
                String oldRole = null;
                try (PreparedStatement oldRoleSt = conn.prepareStatement("SELECT user_role FROM users WHERE id = ?")) {
                    oldRoleSt.setInt(1, userId);
                    try (ResultSet oldRoleRs = oldRoleSt.executeQuery()) {
                        if (oldRoleRs.next()) {
                            oldRole = oldRoleRs.getString("user_role");
                        }
                    }
                }

                // Build dynamic update
                StringBuilder sql = new StringBuilder("UPDATE users SET ");
                boolean first = true;
                if (newStatus != null) { sql.append("status = ?"); first = false; }
                if (newRole != null) {
                    if (!first) sql.append(", ");
                    sql.append("user_role = ?");
                }
                sql.append(" WHERE id = ?");

                try (PreparedStatement stmt = conn.prepareStatement(sql.toString())) {
                    int idx = 1;
                    if (newStatus != null) stmt.setString(idx++, newStatus);
                    if (newRole != null) stmt.setString(idx++, newRole);
                    stmt.setInt(idx, userId);

                    int rows = stmt.executeUpdate();
                    JSONObject r = new JSONObject();
                    if (rows > 0) {
                        // If this user is now approved, make sure they exist in employees table.
                        ensureEmployeeForApprovedUser(conn, userId);

                        // Audit logging
                        String auditAction;
                        String auditDetails;
                        if ("approved".equals(newStatus)) {
                            auditAction = "APPROVED";
                            auditDetails = "Approved user and assigned role: " + (newRole != null ? newRole.replace("_", " ") : "unchanged");
                        } else if ("rejected".equals(newStatus)) {
                            auditAction = "REJECTED";
                            auditDetails = "Rejected user registration";
                        } else if (newRole != null && !newRole.equals(oldRole)) {
                            auditAction = "ROLE_CHANGED";
                            auditDetails = "Changed role from " + (oldRole != null ? oldRole.replace("_", " ") : "none") + " to " + newRole.replace("_", " ");
                        } else {
                            auditAction = "EDITED";
                            auditDetails = "Updated user status/role";
                        }
                        logAudit(request, auditAction, "USER", userId, targetUserName, auditDetails);

                        r.put("success", true);
                        r.put("message", "User updated successfully.");
                    } else {
                        r.put("success", false);
                        r.put("message", "User not found.");
                    }
                    out.println(r.toString());
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            JSONObject r = new JSONObject();
            r.put("success", false);
            r.put("message", "Error: " + e.getMessage());
            out.println(r.toString());
        }
    }

    @Override
    protected void doOptions(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setStatus(HttpServletResponse.SC_OK);
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    }

    /**
     * Log an audit trail entry using headers set by the frontend.
     */
    private void logAudit(HttpServletRequest req, String action, String targetType, int targetId, String targetName, String details) {
        try {
            String userIdStr = req.getHeader("X-User-Id");
            String userName  = req.getHeader("X-User-Name");
            String userRole  = req.getHeader("X-User-Role");
            if (userIdStr != null && userName != null && userRole != null) {
                int userId = Integer.parseInt(userIdStr);
                DatabaseManager.insertAuditLog(userId, userName, userRole, action, targetType, targetId, targetName, details);
            }
        } catch (Exception e) {
            System.err.println("Audit log failed: " + e.getMessage());
        }
    }

    /**
     * Creates an employee row for an approved user if it does not exist yet.
     * Uses user email as uniqueness key to prevent duplicates.
     */
    private void ensureEmployeeForApprovedUser(Connection conn, int userId) throws SQLException {
        String insertQuery =
            "INSERT INTO employees (first_name, last_name, email, employee_type, position, department, address, cellphone, skill, status) " +
            "SELECT " +
            "COALESCE(u.first_name, 'User'), " +
            "COALESCE(u.last_name, CONCAT('User ', u.id)), " +
            "u.email, " +
            "'full-time', " +
            "REPLACE(COALESCE(u.user_role, 'staff'), '_', ' '), " +
            "'Operations', " +
            "COALESCE(u.address, ''), " +
            "COALESCE(u.cellphone, ''), " +
            "COALESCE(u.skill, ''), " +
            "'active' " +
            "FROM users u " +
            "WHERE u.id = ? " +
            "AND u.status = 'approved' " +
            "AND u.user_role IS NOT NULL " +
            "AND u.user_role <> 'pending' " +
            "AND NOT EXISTS (SELECT 1 FROM employees e WHERE e.email = u.email)";

        try (PreparedStatement stmt = conn.prepareStatement(insertQuery)) {
            stmt.setInt(1, userId);
            stmt.executeUpdate();
        }
    }
}
