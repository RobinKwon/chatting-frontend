// Get API URL from environment variables or default to localhost
const API_URL = 'http://localhost:3000';

document.addEventListener('DOMContentLoaded', () => {
    const submitButton = document.getElementById('regist-button');

    submitButton.addEventListener('click', async () => {
        const id = document.getElementById('id').value.trim();
        const name = document.getElementById('name').value.trim();
        const password = document.getElementById('password').value.trim();
        const date = document.getElementById('date').value.trim();
        const hour = document.getElementById('hour').value.trim();

        if (!id || !password) {
            alert('Please fill in both ID and Password.');
            return;
        }
        if (!name) {
            alert('Please fill in name.');
            return;
        }
        if (date && hour) {
            const birth = new Date(`${date}T${hour}:00`); // Convert to Date object
            console.log("Birth DateTime:", birth);
            //alert("Birth DateTime: " + birth.toISOString()); // Display in ISO format

            try {
                // Send ID and password to the server
                const response = await fetch(`${API_URL}/register`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ id, password, name, birth }),
                });
    
                if (response.ok) {
                    const data = await response.json();
                    if (data.status === 'OK') {
                        alert('register successful!');
                        window.location.href = './login.html'; // Path to your login screen HTML file
                    } else {
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
        } else {
            alert("Please select both a date and time.");
            return;
        }
    });
});
