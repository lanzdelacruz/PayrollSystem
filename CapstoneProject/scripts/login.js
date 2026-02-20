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

        // If validation passes, simulate login (in real app, send to backend)
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

        // Simulate API call (replace with actual backend call)
        setTimeout(() => {
            // For demo purposes, show success message
            // In real app, this would authenticate with backend
            
            // Save remember me preference
            if (rememberMe.checked) {
                localStorage.setItem('rememberEmail', email);
            } else {
                localStorage.removeItem('rememberEmail');
            }

            // Show success and redirect
            alert(`Welcome back, ${email.split('@')[0]}! Login successful.`);
            
            // In a real application, you would redirect to dashboard here
            // window.location.href = 'dashboard.html';
            
            // Reset button
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }, 1000);
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
