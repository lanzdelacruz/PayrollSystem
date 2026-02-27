package com.reddamien.db;

import java.sql.*;
import com.reddamien.model.User;
import com.reddamien.util.PasswordUtil;

/**
 * Database Manager for handling all database operations
 */
public class DatabaseManager {
    
    private static final String DB_URL = "jdbc:sqlite:/Users/lanz/Downloads/CapstoneProject/database/payroll.db";
    
    /**
     * Get database connection
     */
    public static Connection getConnection() throws SQLException {
        try {
            Class.forName("org.sqlite.JDBC");
            return DriverManager.getConnection(DB_URL);
        } catch (ClassNotFoundException e) {
            System.err.println("SQLite JDBC driver not found!");
            throw new SQLException("SQLite driver not available", e);
        }
    }
    
    /**
     * Register a new user
     */
    public static boolean registerUser(String email, String username, String password, String firstName, String lastName, String userRole) {
        Connection conn = null;
        try {
            conn = getConnection();
            
            // Check if user already exists
            String checkQuery = "SELECT id FROM users WHERE email = ? OR username = ?";
            try (PreparedStatement checkStmt = conn.prepareStatement(checkQuery)) {
                checkStmt.setString(1, email);
                checkStmt.setString(2, username);
                
                try (ResultSet rs = checkStmt.executeQuery()) {
                    if (rs.next()) {
                        System.out.println("User with this email or username already exists");
                        return false;
                    }
                }
            }
            
            // Hash the password
            String hashedPassword = PasswordUtil.hashPassword(password);
            
            // Insert new user
            String insertQuery = "INSERT INTO users (email, username, password_hash, first_name, last_name, user_role) VALUES (?, ?, ?, ?, ?, ?)";
            try (PreparedStatement insertStmt = conn.prepareStatement(insertQuery)) {
                insertStmt.setString(1, email);
                insertStmt.setString(2, username);
                insertStmt.setString(3, hashedPassword);
                insertStmt.setString(4, firstName);
                insertStmt.setString(5, lastName);
                insertStmt.setString(6, userRole);
                
                int result = insertStmt.executeUpdate();
                if (result > 0) {
                    System.out.println("User registered successfully!");
                    return true;
                }
            }
            
            return false;
            
        } catch (Exception e) {
            System.err.println("Error registering user: " + e.getMessage());
            e.printStackTrace();
            return false;
        } finally {
            if (conn != null) {
                try {
                    conn.close();
                } catch (SQLException e) {
                    e.printStackTrace();
                }
            }
        }
    }
    
    /**
     * Authenticate user
     */
    public static User authenticateUser(String email, String password) {
        Connection conn = null;
        try {
            conn = getConnection();
            
            // Query user by email
            String query = "SELECT id, username, email, first_name, last_name, user_role, password_hash FROM users WHERE email = ?";
            try (PreparedStatement stmt = conn.prepareStatement(query)) {
                stmt.setString(1, email);
                
                try (ResultSet rs = stmt.executeQuery()) {
                    if (rs.next()) {
                        String storedHash = rs.getString("password_hash");
                        String inputHash = PasswordUtil.hashPassword(password);
                        
                        // Compare hashes
                        if (storedHash.equals(inputHash)) {
                            System.out.println("User authenticated successfully!");
                            return new User(
                                rs.getInt("id"),
                                rs.getString("username"),
                                rs.getString("email"),
                                rs.getString("first_name"),
                                rs.getString("last_name"),
                                rs.getString("user_role")
                            );
                        } else {
                            System.out.println("Incorrect password");
                            return null;
                        }
                    } else {
                        System.out.println("User not found");
                        return null;
                    }
                }
            }
            
        } catch (Exception e) {
            System.err.println("Error authenticating user: " + e.getMessage());
            e.printStackTrace();
            return null;
        } finally {
            if (conn != null) {
                try {
                    conn.close();
                } catch (SQLException e) {
                    e.printStackTrace();
                }
            }
        }
    }
    
    /**
     * Create a session for authenticated user
     */
    public static boolean createSession(int userId, String token) {
        Connection conn = null;
        try {
            conn = getConnection();
            
            String query = "INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, datetime('now', '+7 days'))";
            try (PreparedStatement stmt = conn.prepareStatement(query)) {
                stmt.setInt(1, userId);
                stmt.setString(2, token);
                
                int result = stmt.executeUpdate();
                return result > 0;
            }
            
        } catch (Exception e) {
            System.err.println("Error creating session: " + e.getMessage());
            e.printStackTrace();
            return false;
        } finally {
            if (conn != null) {
                try {
                    conn.close();
                } catch (SQLException e) {
                    e.printStackTrace();
                }
            }
        }
    }
    
    /**
     * Get user by ID
     */
    public static User getUserById(int userId) {
        Connection conn = null;
        try {
            conn = getConnection();
            
            String query = "SELECT id, username, email, first_name, last_name, user_role FROM users WHERE id = ?";
            try (PreparedStatement stmt = conn.prepareStatement(query)) {
                stmt.setInt(1, userId);
                
                try (ResultSet rs = stmt.executeQuery()) {
                    if (rs.next()) {
                        return new User(
                            rs.getInt("id"),
                            rs.getString("username"),
                            rs.getString("email"),
                            rs.getString("first_name"),
                            rs.getString("last_name"),
                            rs.getString("user_role")
                        );
                    }
                }
            }
            
        } catch (Exception e) {
            System.err.println("Error getting user: " + e.getMessage());
            e.printStackTrace();
        } finally {
            if (conn != null) {
                try {
                    conn.close();
                } catch (SQLException e) {
                    e.printStackTrace();
                }
            }
        }
        
        return null;
    }
    
    /**
     * Verify session token
     */
    public static Integer verifySession(String token) {
        Connection conn = null;
        try {
            conn = getConnection();
            
            String query = "SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')";
            try (PreparedStatement stmt = conn.prepareStatement(query)) {
                stmt.setString(1, token);
                
                try (ResultSet rs = stmt.executeQuery()) {
                    if (rs.next()) {
                        return rs.getInt("user_id");
                    }
                }
            }
            
        } catch (Exception e) {
            System.err.println("Error verifying session: " + e.getMessage());
            e.printStackTrace();
        } finally {
            if (conn != null) {
                try {
                    conn.close();
                } catch (SQLException e) {
                    e.printStackTrace();
                }
            }
        }
        
        return null;
    }
}
