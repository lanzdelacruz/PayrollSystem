package com.reddamien.servlet;

import java.io.*;
import java.sql.*;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.*;
import org.json.JSONArray;
import org.json.JSONObject;
import com.reddamien.db.DatabaseManager;

@WebServlet("/api/events/*")
public class EventServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        resp.setContentType("application/json;charset=UTF-8");
        String pathInfo = req.getPathInfo();

        try (Connection conn = DatabaseManager.getConnection()) {
            if (pathInfo == null || pathInfo.equals("/")) {
                String sql = "SELECT * FROM events ORDER BY event_date DESC";
                try (PreparedStatement ps = conn.prepareStatement(sql);
                     ResultSet rs = ps.executeQuery()) {
                    JSONArray arr = new JSONArray();
                    while (rs.next()) arr.put(rowToJson(rs));
                    resp.getWriter().print(arr.toString());
                }
            } else {
                int id = Integer.parseInt(pathInfo.substring(1));
                try (PreparedStatement ps = conn.prepareStatement("SELECT * FROM events WHERE id = ?")) {
                    ps.setInt(1, id);
                    try (ResultSet rs = ps.executeQuery()) {
                        if (rs.next()) {
                            resp.getWriter().print(rowToJson(rs).toString());
                        } else {
                            resp.setStatus(404);
                            resp.getWriter().print(err("Event not found"));
                        }
                    }
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

        String sql = "INSERT INTO events (event_name, event_date, venue, client, contract_price, status, notes) VALUES (?,?,?,?,?,?,?)";
        try (Connection conn = DatabaseManager.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, body.getString("eventName"));
            ps.setString(2, body.getString("eventDate"));
            ps.setString(3, body.optString("eventVenue", ""));
            ps.setString(4, body.optString("eventClient", ""));
            ps.setDouble(5, body.optDouble("contractPrice", 0));
            ps.setString(6, body.optString("status", "upcoming"));
            ps.setString(7, body.optString("notes", ""));
            ps.executeUpdate();

            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (keys.next()) {
                    int newId = keys.getInt(1);
                    try (PreparedStatement ps2 = conn.prepareStatement("SELECT * FROM events WHERE id = ?")) {
                        ps2.setInt(1, newId);
                        try (ResultSet rs = ps2.executeQuery()) {
                            if (rs.next()) {
                                resp.setStatus(201);
                                resp.getWriter().print(rowToJson(rs).toString());
                                return;
                            }
                        }
                    }
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

        String sql = "UPDATE events SET event_name=?, event_date=?, venue=?, client=?, contract_price=?, status=?, notes=? WHERE id=?";
        try (Connection conn = DatabaseManager.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, body.getString("eventName"));
            ps.setString(2, body.getString("eventDate"));
            ps.setString(3, body.optString("eventVenue", ""));
            ps.setString(4, body.optString("eventClient", ""));
            ps.setDouble(5, body.optDouble("contractPrice", 0));
            ps.setString(6, body.optString("status", "upcoming"));
            ps.setString(7, body.optString("notes", ""));
            ps.setInt(8, id);
            int rows = ps.executeUpdate();
            if (rows == 0) {
                resp.setStatus(404);
                resp.getWriter().print(err("Event not found"));
            } else {
                try (PreparedStatement ps2 = conn.prepareStatement("SELECT * FROM events WHERE id = ?")) {
                    ps2.setInt(1, id);
                    try (ResultSet rs = ps2.executeQuery()) {
                        if (rs.next()) { resp.getWriter().print(rowToJson(rs).toString()); return; }
                    }
                }
                resp.getWriter().print(new JSONObject().put("success", true).toString());
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
             PreparedStatement ps = conn.prepareStatement("DELETE FROM events WHERE id = ?")) {
            ps.setInt(1, id);
            int rows = ps.executeUpdate();
            if (rows == 0) {
                resp.setStatus(404);
                resp.getWriter().print(err("Event not found"));
            } else {
                resp.getWriter().print(new JSONObject().put("success", true).toString());
            }
        } catch (Exception e) {
            resp.setStatus(500);
            resp.getWriter().print(err(e.getMessage()));
        }
    }

    private JSONObject rowToJson(ResultSet rs) throws SQLException {
        JSONObject o = new JSONObject();
        o.put("id", rs.getInt("id"));
        o.put("eventName", rs.getString("event_name"));
        o.put("eventDate", rs.getString("event_date"));
        o.put("eventVenue", rs.getString("venue"));
        o.put("eventClient", rs.getString("client"));
        o.put("contractPrice", rs.getDouble("contract_price"));
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
