document.addEventListener('DOMContentLoaded', () => {
    const loginButton = document.getElementById('login-button');

    if (loginButton) {
        loginButton.addEventListener('click', () => {
            window.location.href = './login.html'; // Navigate to login screen
        });
    }
});
