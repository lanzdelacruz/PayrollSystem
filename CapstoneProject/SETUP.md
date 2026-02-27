# Red Damien Payroll System - Setup Guide

## Overview
This project is a web-based payroll management system for event production companies. It includes user authentication, registration, and database storage of user credentials.

## Architecture

### Frontend
- **HTML Files**: login.html, registration.html, index.html
- **CSS Files**: login.css, registration.css, home.css
- **JavaScript**: login.js, registration.js (handle form validation and API calls)

### Backend
- **Servlets**: LoginServlet, RegistrationServlet (handle HTTP requests)
- **Database Manager**: DatabaseManager (handles all database operations)
- **Models**: User class
- **Utilities**: PasswordUtil (password hashing and token generation)

### Database
- **SQLite** for data persistence
- **Schema**: users table, sessions table

## Prerequisites
- Java 8 or higher
- Maven 3.6 or higher
- Tomcat 9 or higher
- SQLite 3

## Installation Steps

### 1. Install Dependencies
Run Maven to download and install all required dependencies:
```bash
mvn clean install
```

### 2. Initialize Database
Before running the application, initialize the SQLite database:

```bash
# Navigate to the project directory
cd /Users/lanz/Downloads/CapstoneProject

# Create database directory if it doesn't exist
mkdir -p database

# Initialize the database with the schema
sqlite3 database/payroll.db < database/schema.sql
```

### 3. Build the Project
```bash
mvn clean package
```

This creates a WAR file at `target/payroll.war`

### 4. Deploy to Tomcat

#### Option 1: Copy WAR to Tomcat
```bash
cp target/payroll.war /path/to/tomcat/webapps/
```

#### Option 2: Use Tomcat Manager GUI
1. Go to http://localhost:8080/manager/html
2. Upload the `payroll.war` file
3. Click "Deploy"

#### Option 3: Run Maven Tomcat Plugin
```bash
mvn tomcat7:deploy
```
(Requires tomcat7-maven-plugin configuration in pom.xml)

### 5. Verify Installation
1. Open browser: http://localhost:8080/payroll
2. You should see the home page (index.html)
3. Click "Sign In" or "Sign Up" to test the application

## User Registration Flow

1. User clicks "Sign Up" on login page
2. Registration form appears (registration.html)
3. User enters email, password, and confirms password
4. JavaScript validates the form
5. If valid, sends POST request to `/api/register`
6. RegistrationServlet receives request
7. Saves user to database with hashed password
8. Returns success response and redirects to login page

## User Login Flow

1. User enters email and password
2. JavaScript validates the form
3. If valid, sends POST request to `/api/login`
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

### POST /api/login
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

### POST /api/register
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
├── pom.xml                          # Maven configuration
├── back-endCode.java               # Core backend logic
├── index.html                       # Home page
├── login.html                       # Login page
├── registration.html               # Registration page
├── database/
│   └── schema.sql                  # Database schema
├── scripts/
│   ├── login.js                    # Login form handler
│   └── registration.js             # Registration form handler
├── styles/
│   ├── login.css
│   ├── registration.css
│   └── home.css
├── src/java/com/reddamien/
│   ├── db/
│   │   └── DatabaseManager.java    # Database operations
│   ├── model/
│   │   └── User.java              # User model
│   ├── servlet/
│   │   ├── LoginServlet.java       # Login request handler
│   │   └── RegistrationServlet.java # Registration request handler
│   └── util/
│       └── PasswordUtil.java       # Password hashing utilities
├── WEB-INF/
│   └── web.xml                     # Servlet configuration
└── target/
    └── payroll.war                 # Compiled WAR file
```

## Troubleshooting

### Database Connection Issues
- Verify database file exists: `ls -la database/payroll.db`
- Check database permissions: `chmod 666 database/payroll.db`
- Ensure SQLite JDBC driver is in classpath

### Maven Build Failures
```bash
# Clear Maven cache
mvn clean install -U
```

### Servlet Not Found
- Ensure web.xml is in WEB-INF/
- Check @WebServlet annotations are correct
- Restart Tomcat after deployment

### Password Hashing Issues
- Ensure PasswordUtil class is in correct package
- Verify SHA-256 is available in Java runtime

## Password Requirements

Registration passwords must contain:
- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one digit (0-9)

## Next Steps

1. Implement user profile page
2. Add role-based access control
3. Create payroll calculation module
4. Add employee management features
5. Implement email verification
6. Add password reset functionality
7. Create admin dashboard

## Support

For issues or questions, please check the error logs:
- Tomcat logs: `$CATALINA_HOME/logs/catalina.out`
- Application logs: Check console output during deployment

## License

This project is proprietary to Red Damien Entertainment.
