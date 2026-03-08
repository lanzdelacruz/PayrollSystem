package com.reddamien.servlet;

import java.io.*;
import java.nio.file.*;
import java.sql.*;
import java.util.UUID;
import javax.servlet.ServletException;
import javax.servlet.annotation.MultipartConfig;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.*;
import org.json.JSONArray;
import org.json.JSONObject;
import com.reddamien.db.DatabaseManager;

@WebServlet("/api/employees/*")
@MultipartConfig(
    fileSizeThreshold = 1024 * 1024,      // 1 MB
    maxFileSize       = 5 * 1024 * 1024,   // 5 MB
    maxRequestSize    = 10 * 1024 * 1024    // 10 MB
)
public class EmployeeServlet extends HttpServlet {

    private static final String UPLOAD_DIR = "uploads/id-scans";

    private String getUploadPath() {
        String appPath = getServletContext().getRealPath("");
        String uploadPath = appPath + File.separator + UPLOAD_DIR;
        File dir = new File(uploadPath);
        if (!dir.exists()) dir.mkdirs();
        return uploadPath;
    }

    // GET /api/employees — list all
    // GET /api/employees/{id} — get one
    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        resp.setContentType("application/json;charset=UTF-8");
        String pathInfo = req.getPathInfo(); // null or "/{id}"

        try (Connection conn = DatabaseManager.getConnection()) {
            if (pathInfo == null || pathInfo.equals("/")) {
                // List all employees
                String sql = "SELECT * FROM employees ORDER BY last_name, first_name";
                try (PreparedStatement ps = conn.prepareStatement(sql);
                     ResultSet rs = ps.executeQuery()) {
                    JSONArray arr = new JSONArray();
                    while (rs.next()) arr.put(rowToJson(rs));
                    resp.getWriter().print(arr.toString());
                }
            } else {
                int id = Integer.parseInt(pathInfo.substring(1));
                String sql = "SELECT * FROM employees WHERE id = ?";
                try (PreparedStatement ps = conn.prepareStatement(sql)) {
                    ps.setInt(1, id);
                    try (ResultSet rs = ps.executeQuery()) {
                        if (rs.next()) {
                            resp.getWriter().print(rowToJson(rs).toString());
                        } else {
                            resp.setStatus(404);
                            resp.getWriter().print(new JSONObject().put("error", "Employee not found").toString());
                        }
                    }
                }
            }
        } catch (Exception e) {
            resp.setStatus(500);
            resp.getWriter().print(new JSONObject().put("error", e.getMessage()).toString());
        }
    }

    // POST /api/employees — create (multipart/form-data)
    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        resp.setContentType("application/json;charset=UTF-8");

        // Handle file upload
        String idScanPath = saveUploadedFile(req);

        // Auto-generate a unique email placeholder (DB requires unique non-null)
        String autoEmail = param(req, "firstName").toLowerCase() + "." + param(req, "lastName").toLowerCase() + "." + System.currentTimeMillis() + "@reddamien.local";

        String sql = "INSERT INTO employees (first_name, last_name, email, employee_type, position, department, phone, address, cellphone, skill, id_scan_path, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)";
        try (Connection conn = DatabaseManager.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1,  param(req, "firstName"));
            ps.setString(2,  param(req, "lastName"));
            ps.setString(3,  autoEmail);
            ps.setString(4,  paramOrDefault(req, "employeeType", "on-call"));
            ps.setString(5,  paramOrDefault(req, "skill", ""));
            ps.setString(6,  "Operations");
            ps.setString(7,  paramOrDefault(req, "cellphone", ""));
            ps.setString(8,  paramOrDefault(req, "address", ""));
            ps.setString(9,  paramOrDefault(req, "cellphone", ""));
            ps.setString(10, paramOrDefault(req, "skill", ""));
            ps.setString(11, idScanPath != null ? idScanPath : "");
            ps.setString(12, "active");
            ps.executeUpdate();

            int newId = 0;
            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (keys.next()) {
                    newId = keys.getInt(1);
                    try (PreparedStatement ps2 = conn.prepareStatement("SELECT * FROM employees WHERE id = ?")) {
                        ps2.setInt(1, newId);
                        try (ResultSet rs = ps2.executeQuery()) {
                            if (rs.next()) {
                                resp.setStatus(201);
                                resp.getWriter().print(rowToJson(rs).toString());

                                // Audit log
                                String empName = param(req, "firstName") + " " + param(req, "lastName");
                                logAudit(req, "ADDED", "EMPLOYEE", newId, empName,
                                    "Added employee (" + paramOrDefault(req, "employeeType", "on-call") + ")");
                                return;
                            }
                        }
                    }
                }
            }

            // Audit log (fallback if no generated key retrieval)
            String empName = param(req, "firstName") + " " + param(req, "lastName");
            logAudit(req, "ADDED", "EMPLOYEE", newId, empName,
                "Added employee (" + paramOrDefault(req, "employeeType", "full-time") + ")");

            resp.setStatus(201);
            resp.getWriter().print(new JSONObject().put("success", true).toString());
        } catch (SQLIntegrityConstraintViolationException e) {
            resp.setStatus(409);
            resp.getWriter().print(new JSONObject().put("error", "An employee with that email already exists").toString());
        } catch (Exception e) {
            resp.setStatus(500);
            resp.getWriter().print(new JSONObject().put("error", e.getMessage()).toString());
        }
    }

    // PUT /api/employees/{id} — update (multipart/form-data)
    @Override
    protected void doPut(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        resp.setContentType("application/json;charset=UTF-8");
        String pathInfo = req.getPathInfo();
        if (pathInfo == null || pathInfo.equals("/")) { resp.setStatus(400); return; }
        int id = Integer.parseInt(pathInfo.substring(1));

        // Handle optional file upload
        String idScanPath = saveUploadedFile(req);

        // If no new file uploaded, keep existing path
        String sql;
        boolean hasNewFile = (idScanPath != null);
        if (hasNewFile) {
            sql = "UPDATE employees SET first_name=?, last_name=?, employee_type=?, email=?, address=?, cellphone=?, skill=?, id_scan_path=? WHERE id=?";
        } else {
            sql = "UPDATE employees SET first_name=?, last_name=?, employee_type=?, email=?, address=?, cellphone=?, skill=? WHERE id=?";
        }

        try (Connection conn = DatabaseManager.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1,  param(req, "firstName"));
            ps.setString(2,  param(req, "lastName"));
            ps.setString(3,  paramOrDefault(req, "employeeType", "on-call"));
            ps.setString(4,  paramOrDefault(req, "email", ""));
            ps.setString(5,  paramOrDefault(req, "address", ""));
            ps.setString(6,  paramOrDefault(req, "cellphone", ""));
            ps.setString(7,  paramOrDefault(req, "skill", ""));
            if (hasNewFile) {
                ps.setString(8, idScanPath);
                ps.setInt(9, id);
            } else {
                ps.setInt(8, id);
            }

            int rows = ps.executeUpdate();
            if (rows == 0) {
                resp.setStatus(404);
                resp.getWriter().print(new JSONObject().put("error", "Employee not found").toString());
            } else {
                // Audit log
                String empName = param(req, "firstName") + " " + param(req, "lastName");
                logAudit(req, "EDITED", "EMPLOYEE", id, empName, "Edited employee details");

                try (PreparedStatement ps2 = conn.prepareStatement("SELECT * FROM employees WHERE id = ?")) {
                    ps2.setInt(1, id);
                    try (ResultSet rs = ps2.executeQuery()) {
                        if (rs.next()) {
                            resp.getWriter().print(rowToJson(rs).toString());
                            return;
                        }
                    }
                }
                resp.getWriter().print(new JSONObject().put("success", true).toString());
            }
        } catch (Exception e) {
            resp.setStatus(500);
            resp.getWriter().print(new JSONObject().put("error", e.getMessage()).toString());
        }
    }

    // DELETE /api/employees/{id}
    @Override
    protected void doDelete(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        resp.setContentType("application/json;charset=UTF-8");
        String pathInfo = req.getPathInfo();
        if (pathInfo == null || pathInfo.equals("/")) { resp.setStatus(400); return; }
        int id = Integer.parseInt(pathInfo.substring(1));

        try (Connection conn = DatabaseManager.getConnection()) {
            // Look up the employee email and name before deleting so we can deactivate their user account
            String employeeEmail = null;
            String employeeName = null;

            // Delete stored ID scan file if present & grab the email
            try (PreparedStatement sel = conn.prepareStatement("SELECT first_name, last_name, email, id_scan_path FROM employees WHERE id = ?")) {
                sel.setInt(1, id);
                try (ResultSet rs = sel.executeQuery()) {
                    if (rs.next()) {
                        employeeName = rs.getString("first_name") + " " + rs.getString("last_name");
                        employeeEmail = rs.getString("email");
                        String scanPath = rs.getString("id_scan_path");
                        if (scanPath != null && !scanPath.isEmpty()) {
                            String fullPath = getServletContext().getRealPath("") + File.separator + scanPath;
                            new File(fullPath).delete();
                        }
                    }
                }
            }

            try (PreparedStatement ps = conn.prepareStatement("DELETE FROM employees WHERE id = ?")) {
                ps.setInt(1, id);
                int rows = ps.executeUpdate();
                if (rows == 0) {
                    resp.setStatus(404);
                    resp.getWriter().print(new JSONObject().put("error", "Employee not found").toString());
                } else {
                    // Deactivate the matching user account so they can no longer log in
                    if (employeeEmail != null && !employeeEmail.isEmpty()) {
                        try (PreparedStatement up = conn.prepareStatement(
                                "UPDATE users SET status = 'removed' WHERE email = ?")) {
                            up.setString(1, employeeEmail);
                            up.executeUpdate();
                        }
                        // Also invalidate any active sessions for this user
                        try (PreparedStatement ds = conn.prepareStatement(
                                "DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email = ?)")) {
                            ds.setString(1, employeeEmail);
                            ds.executeUpdate();
                        }
                    }

                    // Audit log
                    logAudit(req, "REMOVED", "EMPLOYEE", id,
                        employeeName != null ? employeeName : "Employee #" + id,
                        "Removed employee from system");

                    resp.getWriter().print(new JSONObject().put("success", true).toString());
                }
            }
        } catch (Exception e) {
            resp.setStatus(500);
            resp.getWriter().print(new JSONObject().put("error", e.getMessage()).toString());
        }
    }

    // -- helpers --

    /** Log an audit trail entry using headers set by the frontend */
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

    /** Extract a form-data parameter (works for both multipart and url-encoded) */
    private String param(HttpServletRequest req, String name) {
        String val = req.getParameter(name);
        return val != null ? val.trim() : "";
    }

    private String paramOrDefault(HttpServletRequest req, String name, String def) {
        String val = req.getParameter(name);
        return (val != null && !val.trim().isEmpty()) ? val.trim() : def;
    }

    /** Saves the uploaded 'idScan' file part. Returns relative path or null. */
    private String saveUploadedFile(HttpServletRequest req) {
        try {
            Part filePart = req.getPart("idScan");
            if (filePart == null || filePart.getSize() == 0) return null;

            String origName = Paths.get(filePart.getSubmittedFileName()).getFileName().toString();
            String ext = "";
            int dot = origName.lastIndexOf('.');
            if (dot >= 0) ext = origName.substring(dot);
            String uniqueName = UUID.randomUUID().toString() + ext;

            String uploadPath = getUploadPath();
            filePart.write(uploadPath + File.separator + uniqueName);

            return UPLOAD_DIR + "/" + uniqueName;
        } catch (Exception e) {
            // No file part or not a multipart request — that's OK
            return null;
        }
    }

    private JSONObject rowToJson(ResultSet rs) throws SQLException {
        JSONObject o = new JSONObject();
        o.put("id", rs.getInt("id"));
        o.put("firstName", rs.getString("first_name"));
        o.put("lastName", rs.getString("last_name"));
        o.put("email", rs.getString("email"));
        o.put("employeeType", rs.getString("employee_type"));
        o.put("position", rs.getString("position"));
        o.put("department", rs.getString("department"));
        o.put("phone", rs.getString("phone"));
        o.put("address", rs.getString("address"));
        o.put("cellphone", rs.getString("cellphone"));
        o.put("skill", rs.getString("skill"));
        o.put("idScanPath", rs.getString("id_scan_path"));
        o.put("status", rs.getString("status"));
        o.put("createdAt", rs.getTimestamp("created_at").toString());
        o.put("updatedAt", rs.getTimestamp("updated_at").toString());
        return o;
    }
}
