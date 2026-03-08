// Login Form Functionality

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const togglePasswordBtn = document.getElementById('togglePassword');
    const rememberMe = document.getElementById('rememberMe');

    // Toggle Password Visibility
    togglePasswordBtn.addEventListener('click', function(e) {
        e.preventDefault();
        const type = passwordInput.type === 'password' ? 'text' : 'password';
        passwordInput.type = type;
        togglePasswordBtn.textContent = type === 'password' ? '👁️' : '👁️‍🗨️';
    });

    // Form Validation & Submission
    form.addEventListener('submit', function(e) {
        e.preventDefault();

        // Clear previous errors
        clearError('emailError');
        clearError('passwordError');
        clearError('loginError');

        // Validate email
        const email = emailInput.value.trim();
        if (!email) {
            showError('emailError', 'Email is required');
            return;
        }
        if (!isValidEmail(email)) {
            showError('emailError', 'Please enter a valid email address');
            return;
        }

        // Validate password
        const password = passwordInput.value;
        if (!password) {
            showError('passwordError', 'Password is required');
            return;
        }
        if (password.length < 8) {
            showError('passwordError', 'Password must be at least 8 characters');
            return;
        }

        // If validation passes, send login request to backend
        handleLogin(email, password);
    });

    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    function showError(elementId, message) {
        const errorElement = document.getElementById(elementId);
        errorElement.textContent = message;
        errorElement.classList.add('show');

        // Add error state to input if applicable
        if (elementId === 'emailError') {
            emailInput.classList.add('error');
        } else if (elementId === 'passwordError') {
            passwordInput.classList.add('error');
        }
    }

    function clearError(elementId) {
        const errorElement = document.getElementById(elementId);
        errorElement.textContent = '';
        errorElement.classList.remove('show');

        if (elementId === 'emailError') {
            emailInput.classList.remove('error');
        } else if (elementId === 'passwordError') {
            passwordInput.classList.remove('error');
        }
    }

    function handleLogin(email, password) {
        // Disable button during submission
        const submitBtn = form.querySelector('.btn-submit');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing in...';

        // Send login request to backend
        fetch('/payroll/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: email,
                password: password
            })
        })
        .then(response => {
            const status = response.status;
            return response.json().then(data => ({ status, data }));
        })
        .then(({ status, data }) => {
            if (data.success) {
                // Save remember me preference
                if (rememberMe.checked) {
                    localStorage.setItem('rememberEmail', email);
                } else {
                    localStorage.removeItem('rememberEmail');
                }

                // Store session token and user data
                if (data.token) {
                    localStorage.setItem('sessionToken', data.token);
                }
                
                // Store user data for dashboard
                localStorage.setItem('userData', JSON.stringify({
                    userId: data.userId,
                    email: data.email,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    userRole: data.userRole,
                    username: data.username
                }));
                
                // Show success and redirect to dashboard
                if (window.AppNotice && typeof window.AppNotice.show === 'function') {
                    window.AppNotice.show('Welcome back! Login successful.', {
                        title: 'Sign In Successful',
                        buttonText: 'Go to Dashboard',
                        onConfirm: function () {
                            window.location.href = 'dashboard.html';
                        }
                    });
                } else {
                    window.location.href = 'dashboard.html';
                }
            } else if (status === 403 && window.AppNotice) {
                // Account not approved — show branded modal
                var msg = data.message || 'Your account is not yet approved.';
                var title = 'Account Not Approved';
                if (msg.indexOf('rejected') !== -1) {
                    title = 'Account Rejected';
                } else if (msg.indexOf('removed') !== -1) {
                    title = 'Account Removed';
                } else if (msg.indexOf('pending') !== -1) {
                    title = 'Pending Approval';
                }
                window.AppNotice.show(msg, {
                    title: title,
                    buttonText: 'OK'
                });
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            } else {
                showError('loginError', data.message || 'Login failed. Please try again.');
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showError('loginError', 'An error occurred. Please try again.');
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        });
    }

    // Load remember email if saved
    const savedEmail = localStorage.getItem('rememberEmail');
    if (savedEmail) {
        emailInput.value = savedEmail;
        rememberMe.checked = true;
    }

    // Clear email input errors on input
    emailInput.addEventListener('input', function() {
        if (this.classList.contains('error')) {
            this.classList.remove('error');
            document.getElementById('emailError').classList.remove('show');
        }
    });

    // Clear password input errors on input
    passwordInput.addEventListener('input', function() {
        if (this.classList.contains('error')) {
            this.classList.remove('error');
            document.getElementById('passwordError').classList.remove('show');
        }
    });

    // Email validation on blur
    emailInput.addEventListener('blur', function() {
        const email = this.value.trim();
        if (email && !isValidEmail(email)) {
            showError('emailError', 'Please enter a valid email address');
        }
    });
});
