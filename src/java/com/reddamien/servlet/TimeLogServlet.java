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
    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        resp.setContentType("application/json;charset=UTF-8");

        String employeeId = req.getParameter("employeeId");
        String startDate  = req.getParameter("startDate");
        String endDate    = req.getParameter("endDate");

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

        String sql = "INSERT INTO time_logs (employee_id, log_date, time_in, time_out, total_hours, overtime_hours, status, notes) " +
                     "VALUES (?,?,?,?,?,?,?,?)";
        try (Connection conn = DatabaseManager.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setInt(1, body.getInt("employeeId"));
            ps.setString(2, body.getString("date"));
            ps.setString(3, body.optString("timeIn", null));
            ps.setString(4, body.optString("timeOut", null));
            ps.setDouble(5, body.optDouble("totalHours", 0));
            ps.setDouble(6, body.optDouble("overtimeHours", 0));
            ps.setString(7, body.optString("status", "Present"));
            ps.setString(8, body.optString("notes", ""));
            ps.executeUpdate();

            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (keys.next()) {
                    int id = keys.getInt(1);
                    resp.setStatus(201);
                    resp.getWriter().print(fetchById(conn, id).toString());
                    return;
                }
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
        int id = Integer.parseInt(pathInfo.substring(1));
        JSONObject body = readBody(req);

        String sql = "UPDATE time_logs SET employee_id=?, log_date=?, time_in=?, time_out=?, total_hours=?, overtime_hours=?, status=?, notes=? WHERE id=?";
        try (Connection conn = DatabaseManager.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, body.getInt("employeeId"));
            ps.setString(2, body.getString("date"));
            ps.setString(3, body.optString("timeIn", null));
            ps.setString(4, body.optString("timeOut", null));
            ps.setDouble(5, body.optDouble("totalHours", 0));
            ps.setDouble(6, body.optDouble("overtimeHours", 0));
            ps.setString(7, body.optString("status", "Present"));
            ps.setString(8, body.optString("notes", ""));
            ps.setInt(9, id);
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
             PreparedStatement ps = conn.prepareStatement("DELETE FROM time_logs WHERE id = ?")) {
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
        o.put("status", rs.getString("status"));
        o.put("notes", rs.getString("notes"));
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
