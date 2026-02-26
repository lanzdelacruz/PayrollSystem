-- Create Roles table 
CREATE TABLE roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_name TEXT UNIQUE NOT NULL
);

-- Insert specific roles from registration.html
INSERT INTO roles (role_name) VALUES 
('business_owner'),
('finance_staff'),
('admin_assistant'),    
('operations_manager'),
('fulltime_employee');

-- Create Users table
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL, 
    role_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    is_active INTEGER DEFAULT 1, 
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- Index for faster login lookups
CREATE INDEX idx_users_email ON users(email);