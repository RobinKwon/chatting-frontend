// Get API URL from environment variables or default to localhost
const API_URL = 'http://localhost:3000';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.querySelector('.form-signin');
    const submitButton = document.getElementById('login-button');
    const loginStatus = document.getElementById('login-status');

    if (!loginForm || !submitButton) {
        console.error('Required login elements not found');
        return;
    }
    
    const setLoading = (isLoading) => {
        submitButton.disabled = isLoading;
        submitButton.innerHTML = isLoading ? 'Logging in...' : 'Login';
        if (loginStatus) {
            loginStatus.style.display = isLoading ? 'block' : 'none';
        }
    };

    const showError = (message) => {
        const errorDiv = document.getElementById('error-message');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        } else {
            alert(message);
        }
    };

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        // Clear any previous error messages
        const errorDiv = document.getElementById('error-message');
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }

        // Get form elements
        const idInput = document.getElementById('id');
        const passwordInput = document.getElementById('password');

        // Validate elements exist
        if (!idInput || !passwordInput) {
            showError('Form elements not found. Please refresh the page.');
            return;
        }

        const id = idInput.value.trim();
        const password = passwordInput.value.trim();

        // Validate input
        if (!id || !password) {
            showError('Please fill in both ID and Password.');
            return;
        }

        try {
            setLoading(true);

            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ id, password })
                //credentials: 'same-origin' //include 대신 same-origin 사용
            });
            const data = await response.json();

            if (response.ok && data.status === 'OK') {
                // Store any necessary auth tokens
                if (data.token) {
                    localStorage.setItem('authToken', data.token);
                }
                sessionStorage.setItem('userId', id);
                window.location.href = './main.html';
            } else {
                const errorMessage = data.message || 
                    (response.status === 401 ? 'Invalid credentials' : 'Login failed');
                showError(errorMessage);
            }
        } catch (error) {
            console.error('Login error:', error);
            showError('Network error. Please check your connection and try again.');
        } finally {
            setLoading(false);
        }
    });

    /*submitButton.addEventListener('click', async (event) => {
        event.preventDefault(); // Prevent default form submission
        const id = document.getElementById('#id').value.trim();
        const password = document.getElementById('#password').value.trim();

        if (!id || !password) {
            alert('Please fill in both ID and Password.');
            return;
        }

        try {
            // Send ID and password to the server
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ id, password }),
            });

            if (response.ok) {
                const data = await response.json();

                if (data.status === 'OK') {
                    // Redirect to the main screen if login is successful
                    alert('Login successful!');
                    window.location.href = './main.html'; // Path to your main screen HTML file
                } else {
                    // Show error message if login failed
                    alert(data.message || 'Invalid credentials, please try again.');
                }
            } 
            else if (response.status === 401) {
                alert('Invalid ID or password. Please try again.');
            }
            else {
                alert('Failed to log in. Please check your credentials and try again.');
            }
        } catch (error) {
            console.error('Error connecting to the server:', error);
            alert('An error occurred while trying to log in. Please try again later.');
        }
    });*/
});
