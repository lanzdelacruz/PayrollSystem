package com.reddamien.servlet;

import java.io.*;
import java.sql.SQLException;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.json.JSONObject;
import com.reddamien.db.DatabaseManager;
import com.reddamien.util.PasswordUtil;

/**
 * Servlet for handling user registration requests
 */
@WebServlet("/api/register")
public class RegistrationServlet extends HttpServlet {
    private static final long serialVersionUID = 1L;
    
    /**
     * Default constructor
     */
    public RegistrationServlet() {
        super();
    }

    /**
     * Handle POST requests for user registration
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
            String username = jsonRequest.getString("username");
            String password = jsonRequest.getString("password");
            String firstName = jsonRequest.getString("firstName");
            String lastName = jsonRequest.getString("lastName");
            String address = jsonRequest.optString("address", "");
            String cellphone = jsonRequest.optString("cellphone", "");
            String skill = jsonRequest.optString("skill", "");
            // Role is no longer chosen by user — defaults to 'pending' until approved
            String userRole = "pending";
            
            // Validate input
            if (email == null || email.isEmpty() || username == null || username.isEmpty() || 
                password == null || password.isEmpty() || firstName == null || firstName.isEmpty() ||
                lastName == null || lastName.isEmpty()) {
                JSONObject jsonResponse = new JSONObject();
                jsonResponse.put("success", false);
                jsonResponse.put("message", "All fields are required");
                out.println(jsonResponse.toString());
                response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                return;
            }
            
            // Validate password strength
            if (password.length() < 8) {
                JSONObject jsonResponse = new JSONObject();
                jsonResponse.put("success", false);
                jsonResponse.put("message", "Password must be at least 8 characters");
                out.println(jsonResponse.toString());
                response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                return;
            }
            
            // Register user with pending status
            boolean success = DatabaseManager.registerUser(email, username, password, firstName, lastName, userRole, address, cellphone, skill);
            
            if (success) {
                JSONObject jsonResponse = new JSONObject();
                jsonResponse.put("success", true);
                jsonResponse.put("message", "User registered successfully");
                out.println(jsonResponse.toString());
                response.setStatus(HttpServletResponse.SC_CREATED);
            } else {
                JSONObject jsonResponse = new JSONObject();
                jsonResponse.put("success", false);
                jsonResponse.put("message", "User with this email or username already exists");
                out.println(jsonResponse.toString());
                response.setStatus(HttpServletResponse.SC_CONFLICT);
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
