package com.reddamien.servlet;

import java.io.*;
import java.sql.*;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.*;
import org.json.JSONArray;
import org.json.JSONObject;
import com.reddamien.db.DatabaseManager;

@WebServlet("/api/event-attendance/*")
public class EventAttendanceServlet extends HttpServlet {

    // GET /api/event-attendance?eventId=X — list by event
    // GET /api/event-attendance       — list all
    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        resp.setContentType("application/json;charset=UTF-8");
        String eventIdParam = req.getParameter("eventId");

        try (Connection conn = DatabaseManager.getConnection()) {
            String sql;
            PreparedStatement ps;
            if (eventIdParam != null && !eventIdParam.isEmpty()) {
                sql = "SELECT ea.*, e.first_name, e.last_name, e.position AS emp_position " +
                      "FROM event_attendance ea JOIN employees e ON ea.employee_id = e.id " +
                      "WHERE ea.event_id = ? ORDER BY e.last_name";
                ps = conn.prepareStatement(sql);
                ps.setInt(1, Integer.parseInt(eventIdParam));
            } else {
                sql = "SELECT ea.*, e.first_name, e.last_name, e.position AS emp_position " +
                      "FROM event_attendance ea JOIN employees e ON ea.employee_id = e.id " +
                      "ORDER BY ea.event_id, e.last_name";
                ps = conn.prepareStatement(sql);
            }
            try (ResultSet rs = ps.executeQuery()) {
                JSONArray arr = new JSONArray();
                while (rs.next()) arr.put(rowToJson(rs));
                resp.getWriter().print(arr.toString());
            }
            ps.close();
        } catch (Exception e) {
            resp.setStatus(500);
            resp.getWriter().print(err(e.getMessage()));
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        resp.setContentType("application/json;charset=UTF-8");
        JSONObject body = readBody(req);

        String sql = "INSERT INTO event_attendance (event_id, employee_id, role, assignment, status, call_time, pack_up_time, hours_worked, overtime_hours, notes, work_performance, evaluation_reason) " +
                     "VALUES (?,?,?,?,?,?,?,?,?,?,?,?)";
        try (Connection conn = DatabaseManager.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setInt(1, body.getInt("eventId"));
            ps.setInt(2, body.getInt("employeeId"));
            ps.setString(3, body.optString("role", ""));
            ps.setString(4, body.optString("assignment", ""));
            ps.setString(5, body.optString("status", "Present"));
            ps.setString(6, body.optString("arrivalTime", null));
            ps.setString(7, body.optString("departureTime", null));
            ps.setDouble(8, body.optDouble("hoursWorked", 0));
            ps.setDouble(9, body.optDouble("overtimeHours", 0));
            ps.setString(10, body.optString("notes", ""));
            ps.setString(11, body.optString("workPerformance", ""));
            ps.setString(12, body.optString("evaluationReason", ""));
            ps.executeUpdate();

            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (keys.next()) {
                    int newId = keys.getInt(1);
                    resp.setStatus(201);
                    resp.getWriter().print(fetchById(conn, newId).toString());
                    return;
                }
            }
            resp.setStatus(201);
            resp.getWriter().print(new JSONObject().put("success", true).toString());
        } catch (SQLIntegrityConstraintViolationException e) {
            resp.setStatus(409);
            resp.getWriter().print(err("Attendance record already exists for this employee and event"));
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
        int id = Integer.parseInt(pathInfo.substring(1));
        JSONObject body = readBody(req);

        String sql = "UPDATE event_attendance SET event_id=?, employee_id=?, role=?, assignment=?, status=?, call_time=?, pack_up_time=?, hours_worked=?, overtime_hours=?, notes=?, work_performance=?, evaluation_reason=? WHERE id=?";
        try (Connection conn = DatabaseManager.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, body.getInt("eventId"));
            ps.setInt(2, body.getInt("employeeId"));
            ps.setString(3, body.optString("role", ""));
            ps.setString(4, body.optString("assignment", ""));
            ps.setString(5, body.optString("status", "Present"));
            ps.setString(6, body.optString("arrivalTime", null));
            ps.setString(7, body.optString("departureTime", null));
            ps.setDouble(8, body.optDouble("hoursWorked", 0));
            ps.setDouble(9, body.optDouble("overtimeHours", 0));
            ps.setString(10, body.optString("notes", ""));
            ps.setString(11, body.optString("workPerformance", ""));
            ps.setString(12, body.optString("evaluationReason", ""));
            ps.setInt(13, id);
            int rows = ps.executeUpdate();
            if (rows == 0) {
                resp.setStatus(404);
                resp.getWriter().print(err("Record not found"));
            } else {
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

        try (Connection conn = DatabaseManager.getConnection();
             PreparedStatement ps = conn.prepareStatement("DELETE FROM event_attendance WHERE id = ?")) {
            ps.setInt(1, id);
            int rows = ps.executeUpdate();
            if (rows == 0) {
                resp.setStatus(404);
                resp.getWriter().print(err("Record not found"));
            } else {
                resp.getWriter().print(new JSONObject().put("success", true).toString());
            }
        } catch (Exception e) {
            resp.setStatus(500);
            resp.getWriter().print(err(e.getMessage()));
        }
    }

    private JSONObject fetchById(Connection conn, int id) throws SQLException {
        String sql = "SELECT ea.*, e.first_name, e.last_name, e.position AS emp_position " +
                     "FROM event_attendance ea JOIN employees e ON ea.employee_id = e.id WHERE ea.id = ?";
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
        o.put("eventId", rs.getInt("event_id"));
        o.put("employeeId", rs.getInt("employee_id"));
        o.put("employeeName", rs.getString("first_name") + " " + rs.getString("last_name"));
        o.put("role", rs.getString("role"));
        o.put("assignment", rs.getString("assignment"));
        o.put("status", rs.getString("status"));
        String ct = rs.getString("call_time");
        String pt = rs.getString("pack_up_time");
        o.put("arrivalTime", ct != null ? ct : JSONObject.NULL);
        o.put("departureTime", pt != null ? pt : JSONObject.NULL);
        o.put("hoursWorked", rs.getDouble("hours_worked"));
        o.put("overtimeHours", rs.getDouble("overtime_hours"));
        o.put("notes", rs.getString("notes"));
        o.put("workPerformance", rs.getString("work_performance"));
        o.put("evaluationReason", rs.getString("evaluation_reason"));
        return o;
    }

    private JSONObject readBody(HttpServletRequest req) throws IOException {
        BufferedReader r = req.getReader();
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = r.readLine()) != null) sb.append(line);
        return new JSONObject(sb.toString());
    }

    private String err(String msg) { return new JSONObject().put("error", msg).toString(); }
}
