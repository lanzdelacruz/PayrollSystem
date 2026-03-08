package com.reddamien.db;

import java.sql.*;
import com.reddamien.model.User;
import com.reddamien.util.PasswordUtil;

/**
 * Database Manager for handling all database operations
 */
public class DatabaseManager {
    
    private static final String DB_URL = "jdbc:mysql://localhost:3306/payroll_db";
    private static final String DB_USER = "root";
    private static final String DB_PASSWORD = "9261";
    
    /**
     * Get database connection
     */
    public static Connection getConnection() throws SQLException {
        try {
            Class.forName("com.mysql.cj.jdbc.Driver");
            return DriverManager.getConnection(DB_URL, DB_USER, DB_PASSWORD);
        } catch (ClassNotFoundException e) {
            System.err.println("MySQL JDBC driver not found!");
            throw new SQLException("MySQL driver not available", e);
        }
    }
    
    /**
     * Register a new user
     */
    public static boolean registerUser(String email, String username, String password, String firstName, String lastName, String userRole, String address, String cellphone, String skill) {
        Connection conn = null;
        try {
            conn = getConnection();

            // First registered account becomes the business owner automatically.
            boolean isFirstUser = false;
            try (PreparedStatement countStmt = conn.prepareStatement("SELECT COUNT(*) FROM users");
                 ResultSet countRs = countStmt.executeQuery()) {
                if (countRs.next()) {
                    isFirstUser = countRs.getInt(1) == 0;
                }
            }
            
            // Check if user already exists
            String checkQuery = "SELECT id, status FROM users WHERE email = ? OR username = ?";
            try (PreparedStatement checkStmt = conn.prepareStatement(checkQuery)) {
                checkStmt.setString(1, email);
                checkStmt.setString(2, username);
                
                try (ResultSet rs = checkStmt.executeQuery()) {
                    if (rs.next()) {
                        String existingStatus = rs.getString("status");
                        int existingId = rs.getInt("id");

                        // Allow re-registration if the account was removed or rejected
                        if ("removed".equals(existingStatus) || "rejected".equals(existingStatus)) {
                            String hashedPassword = PasswordUtil.hashPassword(password);
                            String updateQuery = "UPDATE users SET email = ?, username = ?, password_hash = ?, first_name = ?, last_name = ?, address = ?, cellphone = ?, skill = ?, user_role = 'pending', status = 'pending' WHERE id = ?";
                            try (PreparedStatement updateStmt = conn.prepareStatement(updateQuery)) {
                                updateStmt.setString(1, email);
                                updateStmt.setString(2, username);
                                updateStmt.setString(3, hashedPassword);
                                updateStmt.setString(4, firstName);
                                updateStmt.setString(5, lastName);
                                updateStmt.setString(6, address != null ? address : "");
                                updateStmt.setString(7, cellphone != null ? cellphone : "");
                                updateStmt.setString(8, skill != null ? skill : "");
                                updateStmt.setInt(9, existingId);
                                updateStmt.executeUpdate();
                                System.out.println("Removed/rejected user re-registered, pending approval.");
                                return true;
                            }
                        }

                        System.out.println("User with this email or username already exists");
                        return false;
                    }
                }
            }
            
            // Hash the password
            String hashedPassword = PasswordUtil.hashPassword(password);

            String finalRole = isFirstUser ? "business_owner" : "pending";
            String finalStatus = isFirstUser ? "approved" : "pending";
            
            // Insert user with computed role/status based on whether this is the first account.
            String insertQuery = "INSERT INTO users (email, username, password_hash, first_name, last_name, address, cellphone, skill, user_role, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
            try (PreparedStatement insertStmt = conn.prepareStatement(insertQuery)) {
                insertStmt.setString(1, email);
                insertStmt.setString(2, username);
                insertStmt.setString(3, hashedPassword);
                insertStmt.setString(4, firstName);
                insertStmt.setString(5, lastName);
                insertStmt.setString(6, address != null ? address : "");
                insertStmt.setString(7, cellphone != null ? cellphone : "");
                insertStmt.setString(8, skill != null ? skill : "");
                insertStmt.setString(9, finalRole);
                insertStmt.setString(10, finalStatus);
                
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
            String query = "SELECT id, username, email, first_name, last_name, user_role, password_hash, status FROM users WHERE email = ?";
            try (PreparedStatement stmt = conn.prepareStatement(query)) {
                stmt.setString(1, email);
                
                try (ResultSet rs = stmt.executeQuery()) {
                    if (rs.next()) {
                        String storedHash = rs.getString("password_hash");
                        String inputHash = PasswordUtil.hashPassword(password);
                        String status = rs.getString("status");
                        
                        // Compare hashes
                        if (storedHash.equals(inputHash)) {
                            // Check if user is approved
                            if (!"approved".equals(status)) {
                                System.out.println("User account is " + status + ", not approved");
                                // Return a special User object with role set to status for the servlet to check
                                User pendingUser = new User(
                                    rs.getInt("id"),
                                    rs.getString("username"),
                                    rs.getString("email"),
                                    rs.getString("first_name"),
                                    rs.getString("last_name"),
                                    rs.getString("user_role")
                                );
                                pendingUser.setStatus(status);
                                return pendingUser;
                            }
                            System.out.println("User authenticated successfully!");
                            User user = new User(
                                rs.getInt("id"),
                                rs.getString("username"),
                                rs.getString("email"),
                                rs.getString("first_name"),
                                rs.getString("last_name"),
                                rs.getString("user_role")
                            );
                            user.setStatus("approved");
                            return user;
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
            
            String query = "INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))";
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
            
            String query = "SELECT user_id FROM sessions WHERE token = ? AND expires_at > NOW()";
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

    /**
     * Insert an audit log entry.
     * @param userId     The ID of the user performing the action
     * @param userName   Display name of the user (first + last)
     * @param userRole   Role of the user
     * @param action     Action type: ADDED, EDITED, REMOVED, APPROVED, REJECTED, ROLE_CHANGED
     * @param targetType Target entity type: EMPLOYEE, USER
     * @param targetId   ID of the target entity (may be null)
     * @param targetName Display name of the target
     * @param details    Additional details about the action
     */
    public static void insertAuditLog(int userId, String userName, String userRole,
                                       String action, String targetType,
                                       Integer targetId, String targetName, String details) {
        try (Connection conn = getConnection()) {
            String sql = "INSERT INTO audit_log (user_id, user_name, user_role, action, target_type, target_id, target_name, details) VALUES (?,?,?,?,?,?,?,?)";
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setInt(1, userId);
                ps.setString(2, userName);
                ps.setString(3, userRole);
                ps.setString(4, action);
                ps.setString(5, targetType);
                if (targetId != null) {
                    ps.setInt(6, targetId);
                } else {
                    ps.setNull(6, java.sql.Types.INTEGER);
                }
                ps.setString(7, targetName);
                ps.setString(8, details);
                ps.executeUpdate();
            }
        } catch (Exception e) {
            System.err.println("Error inserting audit log: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
