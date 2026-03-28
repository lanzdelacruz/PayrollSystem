# Red Damien Payroll System - Setup Guide

## Overview
This project is a web-based payroll and attendance management system for Red Damien Entertainment, an event production company. It includes user authentication, role-based access control, employee management, event crew assignment, and attendance tracking.

## Architecture

### Frontend
- **HTML Pages**: index.html, login.html, registration.html, dashboard.html, employees.html, attendance.html, approvals.html, audit-log.html, payroll.html
- **CSS Files**: home.css, login.css, registration.css, employees.css, attendance.css, usermanagement.css
- **JavaScript**: login.js, registration.js, employees.js, attendance.js, usermanagement.js, auth.js, app-notice.js, payroll.js

### Backend
- **Servlets**: LoginServlet, RegistrationServlet, EmployeeServlet, EventServlet, EventAttendanceServlet, TimeLogServlet, UserManagementServlet, AuditLogServlet, PayrollServlet
- **Database Manager**: DatabaseManager (handles all database operations)
- **Models**: User class
- **Utilities**: PasswordUtil (password hashing and token generation)

### Database
- **MySQL 5.7+** for data persistence
- **Database**: payroll_db
- **Tables**: users, sessions, employees, events, event_crew_assignments, event_attendance, time_logs, monthly_attendance_summary, audit_log, event_payroll_departments, employee_payroll, cash_advances, cash_loans, cash_loan_payments, payroll_penalties

## Prerequisites
- Java 21
- Maven 3.9.6 or higher
- MySQL 5.7 or higher

## Installation Steps

### 1. Set Up MySQL Database
```bash
# Log into MySQL
mysql -u root -p

# Create the database and tables
source database/schema.sql
```

### 2. Build and Run
```bash
# Build and start the embedded Tomcat server
mvn clean compile war:war tomcat7:run
```

### 3. Verify Installation
1. Open browser: http://localhost:8080/payroll
2. Click "Sign Up" to create the first account (automatically becomes Business Owner)
3. Log in with your new account

## User Roles

| Role | Access |
|------|--------|
| Business Owner | All pages (auto-assigned to first registered account) |
| Operations Manager | Dashboard, Attendance (events + crew management) |
| Finance Staff | Dashboard, Attendance, Payroll, Reports |
| Admin Assistant | Dashboard, Employees, Attendance, Payroll, Reports, Audit Log |
| Full-Time Employee | Dashboard, Attendance (own records only) |

## User Registration Flow

1. User clicks "Sign Up" on login page
2. Registration form appears (registration.html)
3. User enters email, username, password, name, address, cellphone, skill
4. JavaScript validates the form
5. If valid, sends POST request to `/payroll/api/register`
6. RegistrationServlet saves user to database with hashed password
7. First user is auto-approved as Business Owner; others require approval
8. Returns success response and redirects to login page

## User Login Flow

1. User enters email and password
2. JavaScript validates the form
3. If valid, sends POST request to `/payroll/api/login`
4. LoginServlet receives request
5. Looks up user in database
6. Compares password hash
7. If match, creates session and returns token
8. Stores token in browser localStorage
9. Redirects to home page

## Security Features

1. **Password Hashing**: Passwords are hashed using SHA-256 before storage
2. **Session Tokens**: Random tokens generated and stored in sessions table
3. **SQL Injection Prevention**: Uses PreparedStatements
4. **CORS Support**: Allows cross-origin requests
5. **Token Expiration**: Sessions expire after 7 days

## API Endpoints

### POST /payroll/api/login
**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "token_string",
  "userId": 1,
  "username": "user",
  "email": "user@example.com"
}
```

**Response (Failure):**
```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

### POST /payroll/api/register
**Request Body:**
```json
{
  "email": "user@example.com",
  "username": "user",
  "password": "Password123"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "User registered successfully"
}
```

**Response (Failure):**
```json
{
  "success": false,
  "message": "User with this email or username already exists"
}
```

## File Structure

```
CapstoneProject/
├── pom.xml                              # Maven configuration
├── SETUP.md                             # This file
├── database/
│   └── schema.sql                       # MySQL database schema (all tables)
├── src/
│   ├── java/com/reddamien/
│   │   ├── db/
│   │   │   └── DatabaseManager.java     # Database operations (MySQL)
│   │   ├── model/
│   │   │   └── User.java               # User model
│   │   ├── servlet/
│   │   │   ├── LoginServlet.java        # Login handler
│   │   │   ├── RegistrationServlet.java # Registration handler
│   │   │   ├── EmployeeServlet.java     # Employee CRUD
│   │   │   ├── EventServlet.java        # Event CRUD (incl. contract price, VAT, meal budget)
│   │   │   ├── EventAttendanceServlet.java # Crew attendance & assignments
│   │   │   ├── TimeLogServlet.java      # Full-time employee time logs
│   │   │   ├── PayrollServlet.java      # On-call payroll processing
│   │   │   ├── UserManagementServlet.java  # Approvals & roles
│   │   │   └── AuditLogServlet.java     # Audit log
│   │   └── util/
│   │       └── PasswordUtil.java        # Password hashing
│   └── main/webapp/
│       ├── index.html                   # Landing page
│       ├── login.html                   # Login page
│       ├── registration.html            # Registration page
│       ├── dashboard.html               # Dashboard
│       ├── employees.html               # Employee management
│       ├── attendance.html              # Attendance & events
│       ├── approvals.html               # User approvals
│       ├── audit-log.html               # Audit log viewer
│       ├── payroll.html                 # On-call payroll processing
│       ├── scripts/                     # JavaScript files
│       ├── styles/                      # CSS files
│       └── WEB-INF/web.xml             # Servlet configuration
```

## Troubleshooting

### MySQL Connection Issues
- Verify MySQL is running: `mysql -u root -p -e "SELECT 1"`
- Check database exists: `mysql -u root -p -e "SHOW DATABASES"`
- Ensure credentials in DatabaseManager.java match your MySQL setup

### Maven Build Failures
```bash
# Clear Maven cache and rebuild
mvn clean install -U
```

### Port 8080 Already in Use
```bash
# Kill process on port 8080
lsof -ti:8080 | xargs kill -9
```

### Servlet Not Found
- Ensure web.xml is in WEB-INF/
- Check @WebServlet annotations are correct
- Rebuild with `mvn clean compile`

### Password Hashing Issues
- Ensure PasswordUtil class is in correct package
- Verify SHA-256 is available in Java runtime

## Password Requirements

Registration passwords must contain:
- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one digit (0-9)

## Implemented Features

- User registration & login with password hashing
- Role-based access control (5 roles)
- First account auto-becomes Business Owner
- User approval/rejection system
- Employee management (full-time & on-call)
- Event creation with crew assignment (on-call employees)
- Event crew evaluation (role, assignment, arrival/departure, work performance)
- Full-time attendance tracking (time logs)
- Monthly attendance summary
- Audit logging
- **On-Call Payroll Module**
  - Department budget breakdown per event (allocated amounts, rate-per-person)
  - Auto-generate crew payroll from attendance records
  - Contract price with optional 12% VAT toggle (stores ex-VAT amount)
  - Crew meal budget with independent VAT toggle
  - Department allocation indicator when setting crew base rates
  - Cash advances, cash loans, and penalty deductions per employee
  - Cash loan payment tracking (installments, remaining balance)
  - Global deductions view across all employees
  - Full-time employee payroll with hourly rate and hours worked (TIMESTAMPDIFF)
  - Real-time deduction reflection in crew payroll totals

## Support

For issues or questions, please check the error logs:
- Tomcat logs: `$CATALINA_HOME/logs/catalina.out`
- Application logs: Check console output during deployment

## License

This project is proprietary to Red Damien Entertainment.
