package com.reddamien.servlet;

import java.io.*;
import java.sql.*;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.*;
import org.json.JSONArray;
import org.json.JSONObject;
import com.reddamien.db.DatabaseManager;

@WebServlet("/api/timelogs/*")
public class TimeLogServlet extends HttpServlet {

    // GET /api/timelogs?employeeId=X&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
    // GET /api/timelogs        — list all
    // GET /api/timelogs/submitted-employees — list employees who have submitted
    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        resp.setContentType("application/json;charset=UTF-8");

        String pathInfo = req.getPathInfo();

        // GET /api/timelogs/submitted-employees
        if (pathInfo != null && pathInfo.equals("/submitted-employees")) {
            try (Connection conn = DatabaseManager.getConnection()) {
                String sql = "SELECT DISTINCT e.id, e.first_name, e.last_name, e.position, e.employee_type, " +
                             "COUNT(t.id) AS log_count, MIN(t.log_date) AS earliest, MAX(t.log_date) AS latest, " +
                             "COALESCE(SUM(t.total_hours), 0) AS sum_hours " +
                             "FROM time_logs t JOIN employees e ON t.employee_id = e.id " +
                             "WHERE t.submitted = 1 GROUP BY e.id ORDER BY e.last_name";
                try (PreparedStatement ps = conn.prepareStatement(sql);
                     ResultSet rs = ps.executeQuery()) {
                    JSONArray arr = new JSONArray();
                    while (rs.next()) {
                        JSONObject o = new JSONObject();
                        o.put("employeeId", rs.getInt("id"));
                        o.put("employeeName", rs.getString("first_name") + " " + rs.getString("last_name"));
                        o.put("position", rs.getString("position"));
                        o.put("employeeType", rs.getString("employee_type"));
                        o.put("logCount", rs.getInt("log_count"));
                        o.put("earliest", rs.getString("earliest"));
                        o.put("latest", rs.getString("latest"));
                        o.put("totalHours", rs.getDouble("sum_hours"));
                        arr.put(o);
                    }
                    resp.getWriter().print(arr.toString());
                }
            } catch (Exception e) {
                resp.setStatus(500);
                resp.getWriter().print(err(e.getMessage()));
            }
            return;
        }

        String employeeId = req.getParameter("employeeId");
        String startDate  = req.getParameter("startDate");
        String endDate    = req.getParameter("endDate");
        String submittedOnly = req.getParameter("submittedOnly");

        try (Connection conn = DatabaseManager.getConnection()) {
            StringBuilder sql = new StringBuilder(
                "SELECT t.*, e.first_name, e.last_name, e.position AS emp_position " +
                "FROM time_logs t JOIN employees e ON t.employee_id = e.id WHERE 1=1 ");
            java.util.List<Object> params = new java.util.ArrayList<>();

            if (employeeId != null && !employeeId.isEmpty()) {
                sql.append("AND t.employee_id = ? ");
                params.add(Integer.parseInt(employeeId));
            }
            if (startDate != null && !startDate.isEmpty()) {
                sql.append("AND t.log_date >= ? ");
                params.add(startDate);
            }
            if (endDate != null && !endDate.isEmpty()) {
                sql.append("AND t.log_date <= ? ");
                params.add(endDate);
            }
            if ("true".equals(submittedOnly)) {
                sql.append("AND t.submitted = 1 ");
            }
            sql.append("ORDER BY t.log_date DESC, e.last_name");

            try (PreparedStatement ps = conn.prepareStatement(sql.toString())) {
                for (int i = 0; i < params.size(); i++) {
                    Object p = params.get(i);
                    if (p instanceof Integer) ps.setInt(i + 1, (Integer) p);
                    else ps.setString(i + 1, (String) p);
                }
                try (ResultSet rs = ps.executeQuery()) {
                    JSONArray arr = new JSONArray();
                    while (rs.next()) arr.put(rowToJson(rs));
                    resp.getWriter().print(arr.toString());
                }
            }
        } catch (Exception e) {
            resp.setStatus(500);
            resp.getWriter().print(err(e.getMessage()));
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        resp.setContentType("application/json;charset=UTF-8");
        JSONObject body = readBody(req);

        String sql = "INSERT INTO time_logs (employee_id, log_date, time_in, time_out, total_hours, overtime_hours, remarks, remarks_out) " +
                     "VALUES (?,?,?,?,?,?,?,?)";
        try (Connection conn = DatabaseManager.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            int empId = body.getInt("employeeId");
            ps.setInt(1, empId);
            ps.setString(2, body.getString("date"));
            ps.setString(3, body.optString("timeIn", null));
            ps.setString(4, body.optString("timeOut", null));
            ps.setDouble(5, body.optDouble("totalHours", 0));
            ps.setDouble(6, body.optDouble("overtimeHours", 0));
            ps.setString(7, body.optString("notes", ""));
            ps.setString(8, body.optString("notesOut", ""));
            ps.executeUpdate();

            int newId = 0;
            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (keys.next()) newId = keys.getInt(1);
            }

            // Audit log for non-fulltime roles
            auditIfNeeded(body, "ADDED", "TIME_LOG", newId, empId, conn, body.getString("date"));

            if (newId > 0) {
                resp.setStatus(201);
                resp.getWriter().print(fetchById(conn, newId).toString());
                return;
            }
            resp.setStatus(201);
            resp.getWriter().print(new JSONObject().put("success", true).toString());
        } catch (Exception e) {
            resp.setStatus(500);
            resp.getWriter().print(err(e.getMessage()));
        }
    }

    @Override
    protected void doPut(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        resp.setContentType("application/json;charset=UTF-8");
        String pathInfo = req.getPathInfo();
        if (pathInfo == null || pathInfo.equals("/")) { resp.setStatus(400); return; }

        // PUT /api/timelogs/submit?employeeId=X — mark all unsubmitted logs for this employee as submitted
        if (pathInfo.equals("/submit")) {
            String empIdParam = req.getParameter("employeeId");
            if (empIdParam == null || empIdParam.isEmpty()) {
                resp.setStatus(400);
                resp.getWriter().print(err("employeeId is required"));
                return;
            }
            int empId = Integer.parseInt(empIdParam);
            try (Connection conn = DatabaseManager.getConnection();
                 PreparedStatement ps = conn.prepareStatement(
                     "UPDATE time_logs SET submitted = 1 WHERE employee_id = ? AND submitted = 0")) {
                ps.setInt(1, empId);
                int rows = ps.executeUpdate();
                resp.getWriter().print(new JSONObject()
                    .put("success", true)
                    .put("message", "Attendance submitted to finance")
                    .put("count", rows).toString());
            } catch (Exception e) {
                resp.setStatus(500);
                resp.getWriter().print(err(e.getMessage()));
            }
            return;
        }

        int id = Integer.parseInt(pathInfo.substring(1));
        JSONObject body = readBody(req);

        String sql = "UPDATE time_logs SET employee_id=?, log_date=?, time_in=?, time_out=?, total_hours=?, overtime_hours=?, remarks=?, remarks_out=? WHERE id=?";
        try (Connection conn = DatabaseManager.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            int empId = body.getInt("employeeId");
            ps.setInt(1, empId);
            ps.setString(2, body.getString("date"));
            ps.setString(3, body.optString("timeIn", null));
            ps.setString(4, body.optString("timeOut", null));
            ps.setDouble(5, body.optDouble("totalHours", 0));
            ps.setDouble(6, body.optDouble("overtimeHours", 0));
            ps.setString(7, body.optString("notes", ""));
            ps.setString(8, body.optString("notesOut", ""));
            ps.setInt(9, id);
            int rows = ps.executeUpdate();
            if (rows == 0) {
                resp.setStatus(404);
                resp.getWriter().print(err("Record not found"));
            } else {
                // Audit log for non-fulltime roles
                auditIfNeeded(body, "EDITED", "TIME_LOG", id, empId, conn, body.getString("date"));
                resp.getWriter().print(fetchById(conn, id).toString());
            }
        } catch (Exception e) {
            resp.setStatus(500);
            resp.getWriter().print(err(e.getMessage()));
        }
    }

    @Override
    protected void doDelete(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        resp.setContentType("application/json;charset=UTF-8");
        String pathInfo = req.getPathInfo();
        if (pathInfo == null || pathInfo.equals("/")) { resp.setStatus(400); return; }
        int id = Integer.parseInt(pathInfo.substring(1));

        try (Connection conn = DatabaseManager.getConnection()) {
            // Fetch record before deleting for audit info
            JSONObject existing = fetchById(conn, id);
            try (PreparedStatement ps = conn.prepareStatement("DELETE FROM time_logs WHERE id = ?")) {
                ps.setInt(1, id);
                int rows = ps.executeUpdate();
                if (rows == 0) {
                    resp.setStatus(404);
                    resp.getWriter().print(err("Record not found"));
                } else {
                    // Audit log from query params for delete
                    String userRole = req.getParameter("userRole");
                    if (userRole != null && !userRole.equals("fulltime_employee")) {
                        int userId = 0;
                        try { userId = Integer.parseInt(req.getParameter("userId")); } catch (Exception ignored) {}
                        String userName = req.getParameter("userName");
                        String empName = existing.optString("employeeName", "Unknown");
                        String logDate = existing.optString("date", "");
                        DatabaseManager.insertAuditLog(userId, userName != null ? userName : "Unknown", userRole,
                            "REMOVED", "TIME_LOG", id, empName, "Deleted time log for " + logDate);
                    }
                    resp.getWriter().print(new JSONObject().put("success", true).toString());
                }
            }
        } catch (Exception e) {
            resp.setStatus(500);
            resp.getWriter().print(err(e.getMessage()));
        }
    }

    private JSONObject fetchById(Connection conn, int id) throws SQLException {
        String sql = "SELECT t.*, e.first_name, e.last_name, e.position AS emp_position " +
                     "FROM time_logs t JOIN employees e ON t.employee_id = e.id WHERE t.id = ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return rowToJson(rs);
            }
        }
        return new JSONObject().put("id", id);
    }

    private JSONObject rowToJson(ResultSet rs) throws SQLException {
        JSONObject o = new JSONObject();
        o.put("id", rs.getInt("id"));
        o.put("employeeId", rs.getInt("employee_id"));
        o.put("employeeName", rs.getString("first_name") + " " + rs.getString("last_name"));
        o.put("position", rs.getString("emp_position"));
        o.put("date", rs.getString("log_date"));
        String ti = rs.getString("time_in");
        String to2 = rs.getString("time_out");
        o.put("timeIn", ti != null ? ti : JSONObject.NULL);
        o.put("timeOut", to2 != null ? to2 : JSONObject.NULL);
        o.put("totalHours", rs.getDouble("total_hours"));
        o.put("overtimeHours", rs.getDouble("overtime_hours"));
        o.put("notes", rs.getString("remarks"));
        String remarksOut = rs.getString("remarks_out");
        o.put("notesOut", remarksOut != null ? remarksOut : "");
        o.put("submitted", rs.getBoolean("submitted"));
        return o;
    }

    private JSONObject readBody(HttpServletRequest req) throws IOException {
        BufferedReader r = req.getReader();
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = r.readLine()) != null) sb.append(line);
        return new JSONObject(sb.toString());
    }

    /**
     * Log to audit_log if the user is NOT a fulltime_employee.
     * Body must contain: _userId, _userName, _userRole (sent from frontend).
     */
    private void auditIfNeeded(JSONObject body, String action, String targetType, int targetId, int empId, Connection conn, String logDate) {
        String userRole = body.optString("_userRole", "");
        if (userRole.isEmpty() || "fulltime_employee".equals(userRole)) return;
        int userId = body.optInt("_userId", 0);
        String userName = body.optString("_userName", "Unknown");
        // Look up employee name for the target
        String empName = "Employee #" + empId;
        try (PreparedStatement ps = conn.prepareStatement("SELECT first_name, last_name FROM employees WHERE id = ?")) {
            ps.setInt(1, empId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) empName = rs.getString("first_name") + " " + rs.getString("last_name");
            }
        } catch (Exception ignored) {}
        String details = action.equals("ADDED") ? "Added time log for " + logDate
                       : action.equals("EDITED") ? "Edited time log for " + logDate
                       : "Modified time log for " + logDate;
        DatabaseManager.insertAuditLog(userId, userName, userRole, action, targetType, targetId, empName, details);
    }

    private String err(String msg) { return new JSONObject().put("error", msg).toString(); }
}
