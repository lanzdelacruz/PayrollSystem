CREATE DATABASE IF NOT EXISTS payroll_db;
USE payroll_db;

-- ============================================
-- USERS & SESSIONS
-- ============================================

CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    address VARCHAR(255) DEFAULT '',
    cellphone VARCHAR(20) DEFAULT '',
    skill VARCHAR(200) DEFAULT '',
    user_role VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- EMPLOYEES
-- ============================================

CREATE TABLE IF NOT EXISTS employees (
    id INT PRIMARY KEY AUTO_INCREMENT,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    employee_type ENUM('full-time', 'on-call') NOT NULL DEFAULT 'full-time',
    position VARCHAR(100) NOT NULL,
    department VARCHAR(100) NOT NULL DEFAULT 'Operations',
    phone VARCHAR(20),
    address VARCHAR(255),
    cellphone VARCHAR(20),
    skill VARCHAR(200),
    id_scan_path VARCHAR(500),
    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================
-- EVENTS
-- ============================================

CREATE TABLE IF NOT EXISTS events (
    id INT PRIMARY KEY AUTO_INCREMENT,
    event_name VARCHAR(200) NOT NULL,
    event_date DATE NOT NULL,
    venue VARCHAR(200),
    client VARCHAR(200),
    contract_price DECIMAL(12,2) DEFAULT 0.00,
    status ENUM('upcoming', 'ongoing', 'completed', 'cancelled') NOT NULL DEFAULT 'upcoming',
    submitted BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================
-- EVENT CREW ASSIGNMENT
-- Links on-call employees to a specific event
-- ============================================

CREATE TABLE IF NOT EXISTS event_crew_assignments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    event_id INT NOT NULL,
    employee_id INT NOT NULL,
    role VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    UNIQUE KEY unique_event_crew (event_id, employee_id)
);

-- ============================================
-- EVENT ATTENDANCE
-- Tracks attendance per crew member per event
-- ============================================

CREATE TABLE IF NOT EXISTS event_attendance (
    id INT PRIMARY KEY AUTO_INCREMENT,
    event_id INT NOT NULL,
    employee_id INT NOT NULL,
    role VARCHAR(100),
    assignment VARCHAR(200) DEFAULT '',
    status ENUM('Present', 'Late', 'Absent') NOT NULL DEFAULT 'Present',
    call_time TIME,
    pack_up_time TIME,
    hours_worked DECIMAL(5,2) DEFAULT 0.00,
    overtime_hours DECIMAL(5,2) DEFAULT 0.00,
    notes TEXT,
    work_performance VARCHAR(100) DEFAULT '',
    evaluation_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    UNIQUE KEY unique_event_employee (event_id, employee_id)
);

-- ============================================
-- TIME LOGS (Full-Time Daily Attendance)
-- ============================================

CREATE TABLE IF NOT EXISTS time_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    employee_id INT NOT NULL,
    log_date DATE NOT NULL,
    time_in TIME,
    time_out TIME,
    total_hours DECIMAL(5,2) DEFAULT 0.00,
    overtime_hours DECIMAL(5,2) DEFAULT 0.00,
    remarks TEXT,
    submitted TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    INDEX idx_employee_id (employee_id)
);

-- ============================================
-- MONTHLY ATTENDANCE SUMMARY
-- ============================================

CREATE TABLE IF NOT EXISTS monthly_attendance_summary (
    id INT PRIMARY KEY AUTO_INCREMENT,
    employee_id INT NOT NULL,
    summary_month INT NOT NULL,
    summary_year INT NOT NULL,
    total_days_present INT DEFAULT 0,
    total_days_absent INT DEFAULT 0,
    total_days_late INT DEFAULT 0,
    total_hours DECIMAL(7,2) DEFAULT 0.00,
    total_overtime DECIMAL(7,2) DEFAULT 0.00,
    attendance_rate DECIMAL(5,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    UNIQUE KEY unique_emp_month_year (employee_id, summary_month, summary_year)
);

-- ============================================
-- AUDIT LOG
-- Tracks user actions in the system
-- ============================================

CREATE TABLE IF NOT EXISTS audit_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    user_name VARCHAR(200) NOT NULL,
    user_role VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id INT,
    target_name VARCHAR(200),
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
