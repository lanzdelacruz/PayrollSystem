// Registration Form Functionality

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('registrationForm');
    const firstNameInput = document.getElementById('firstName');
    const lastNameInput = document.getElementById('lastName');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const togglePasswordBtn = document.getElementById('togglePassword');
    const toggleConfirmPasswordBtn = document.getElementById('toggleConfirmPassword');
    const agreementCheckbox = document.getElementById('agreement');

    // Toggle Password Visibility
    togglePasswordBtn.addEventListener('click', function(e) {
        e.preventDefault();
        const type = passwordInput.type === 'password' ? 'text' : 'password';
        passwordInput.type = type;
    });

    toggleConfirmPasswordBtn.addEventListener('click', function(e) {
        e.preventDefault();
        const type = confirmPasswordInput.type === 'password' ? 'text' : 'password';
        confirmPasswordInput.type = type;
    });

    // Password strength indicator
    passwordInput.addEventListener('input', function() {
        updatePasswordStrength(this.value);
    });

    function updatePasswordStrength(password) {
        const strengthFill = document.getElementById('strengthFill');
        const strengthText = document.getElementById('strengthText');
        let strength = 0;
        let strengthLevel = 'weak';
        let strengthClass = 'weak';

        // Check requirements
        document.getElementById('req-length').classList.toggle('met', password.length >= 8);
        document.getElementById('req-uppercase').classList.toggle('met', /[A-Z]/.test(password));
        document.getElementById('req-lowercase').classList.toggle('met', /[a-z]/.test(password));
        document.getElementById('req-digit').classList.toggle('met', /\d/.test(password));

        // Calculate strength
        if (password.length >= 8) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[a-z]/.test(password)) strength++;
        if (/\d/.test(password)) strength++;

        if (strength <= 2) {
            strengthLevel = 'weak';
            strengthClass = 'weak';
        } else if (strength === 3) {
            strengthLevel = 'medium';
            strengthClass = 'medium';
        } else {
            strengthLevel = 'strong';
            strengthClass = 'strong';
        }

        strengthFill.className = 'strength-fill ' + strengthClass;
        strengthText.textContent = 'Password strength: ' + strengthLevel;
    }

    // Form Validation & Submission
    form.addEventListener('submit', function(e) {
        e.preventDefault();

        // Clear previous errors
        clearAllErrors();

        // Validate first name
        const firstName = firstNameInput.value.trim();
        if (!firstName) {
            showError('firstNameError', 'First name is required');
            return;
        }
        if (firstName.length < 2) {
            showError('firstNameError', 'First name must be at least 2 characters');
            return;
        }

        // Validate last name
        const lastName = lastNameInput.value.trim();
        if (!lastName) {
            showError('lastNameError', 'Last name is required');
            return;
        }
        if (lastName.length < 2) {
            showError('lastNameError', 'Last name must be at least 2 characters');
            return;
        }

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
        if (!/[A-Z]/.test(password)) {
            showError('passwordError', 'Password must contain at least one uppercase letter');
            return;
        }
        if (!/[a-z]/.test(password)) {
            showError('passwordError', 'Password must contain at least one lowercase letter');
            return;
        }
        if (!/\d/.test(password)) {
            showError('passwordError', 'Password must contain at least one digit');
            return;
        }

        // Validate password confirmation
        const confirmPassword = confirmPasswordInput.value;
        if (password !== confirmPassword) {
            showError('confirmPasswordError', 'Passwords do not match');
            return;
        }

        // Validate user role
        const userRole = document.getElementById('userRole').value;
        if (!userRole) {
            showError('roleError', 'Please select a user role');
            return;
        }

        // Validate agreement
        if (!agreementCheckbox.checked) {
            showError('agreementError', 'You must agree to the terms and conditions');
            return;
        }

        // All validation passed, proceed with registration
        handleRegistration(firstName, lastName, email, password, userRole);
    });

    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    function showError(elementId, message) {
        const errorElement = document.getElementById(elementId);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.add('show');
        }
    }

    function clearError(elementId) {
        const errorElement = document.getElementById(elementId);
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.classList.remove('show');
        }
    }

    function clearAllErrors() {
        clearError('firstNameError');
        clearError('lastNameError');
        clearError('emailError');
        clearError('roleError');
        clearError('passwordError');
        clearError('confirmPasswordError');
        clearError('agreementError');
        clearError('registrationError');
    }

    function handleRegistration(firstName, lastName, email, password, userRole) {
        // Disable button during submission
        const submitBtn = form.querySelector('.btn-submit');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating Account...';

        // Send registration request to backend
        fetch('/payroll/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: email,
                username: email.split('@')[0], // Use email prefix as username
                password: password,
                firstName: firstName,
                lastName: lastName,
                userRole: userRole
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Sign up complete! Welcome to Red Damien Entertainment Payroll System.');
                window.location.href = 'index.html';
            } else {
                showError('registrationError', data.message || 'Registration failed. Please try again.');
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showError('registrationError', 'An error occurred. Please try again.');
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        });
    }

    // Clear email input errors on input
    emailInput.addEventListener('input', function() {
        clearError('emailError');
    });

    // Clear password input errors on input
    passwordInput.addEventListener('input', function() {
        clearError('passwordError');
    });

    // Clear confirm password input errors on input
    confirmPasswordInput.addEventListener('input', function() {
        clearError('confirmPasswordError');
    });

    // Email validation on blur
    emailInput.addEventListener('blur', function() {
        const email = this.value.trim();
        if (email && !isValidEmail(email)) {
            showError('emailError', 'Please enter a valid email address');
        }
    });
});
