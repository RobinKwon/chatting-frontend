// Get API URL from environment variables or default to localhost
const API_URL = 'http://localhost:3000';

document.addEventListener('DOMContentLoaded', () => {
    const submitButton = document.getElementById('submit-button');

    submitButton.addEventListener('click', async () => {
        const id = document.getElementById('id').value.trim();
        const password = document.getElementById('password').value.trim();

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
    });
});
