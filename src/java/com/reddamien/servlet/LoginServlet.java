package com.reddamien.servlet;

import java.io.*;
import java.sql.SQLException;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.json.JSONObject;

import com.reddamien.db.DatabaseManager;
import com.reddamien.model.User;
import com.reddamien.util.PasswordUtil;

/**
 * Servlet for handling user login requests
 */
@WebServlet("/api/login")
public class LoginServlet extends HttpServlet {
    private static final long serialVersionUID = 1L;
    
    /**
     * Default constructor
     */
    public LoginServlet() {
        super();
    }

    /**
     * Handle POST requests for user authentication
     */
    protected void doPost(HttpServletRequest request, HttpServletResponse response) 
            throws ServletException, IOException {
        
        // Set response type to JSON
        response.setContentType("application/json;charset=UTF-8");
        PrintWriter out = response.getWriter();
        
        try {
            // Get JSON data from request body
            BufferedReader reader = request.getReader();
            StringBuilder sb = new StringBuilder();
            String line;
            
            while ((line = reader.readLine()) != null) {
                sb.append(line);
            }
            
            // Parse JSON
            JSONObject jsonRequest = new JSONObject(sb.toString());
            String email = jsonRequest.getString("email");
            String password = jsonRequest.getString("password");
            
            // Validate input
            if (email == null || email.isEmpty() || password == null || password.isEmpty()) {
                JSONObject jsonResponse = new JSONObject();
                jsonResponse.put("success", false);
                jsonResponse.put("message", "Email and password are required");
                out.println(jsonResponse.toString());
                response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                return;
            }
            
            // Authenticate user
            User user = DatabaseManager.authenticateUser(email, password);
            
            if (user != null) {
                // Create session
                String token = PasswordUtil.generateToken();
                DatabaseManager.createSession(user.getId(), token);
                
                JSONObject jsonResponse = new JSONObject();
                jsonResponse.put("success", true);
                jsonResponse.put("message", "Login successful");
                jsonResponse.put("token", token);
                jsonResponse.put("userId", user.getId());
                jsonResponse.put("username", user.getUsername());
                jsonResponse.put("email", user.getEmail());
                jsonResponse.put("firstName", user.getFirstName());
                jsonResponse.put("lastName", user.getLastName());
                jsonResponse.put("userRole", user.getUserRole());
                
                out.println(jsonResponse.toString());
                response.setStatus(HttpServletResponse.SC_OK);
            } else {
                JSONObject jsonResponse = new JSONObject();
                jsonResponse.put("success", false);
                jsonResponse.put("message", "Invalid email or password");
                out.println(jsonResponse.toString());
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            }
            
        } catch (Exception e) {
            e.printStackTrace();
            JSONObject jsonResponse = new JSONObject();
            jsonResponse.put("success", false);
            jsonResponse.put("message", "An error occurred: " + e.getMessage());
            out.println(jsonResponse.toString());
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Handle OPTIONS requests for CORS
     */
    protected void doOptions(HttpServletRequest request, HttpServletResponse response) 
            throws ServletException, IOException {
        response.setStatus(HttpServletResponse.SC_OK);
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    }
}