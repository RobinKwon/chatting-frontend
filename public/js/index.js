document.addEventListener('DOMContentLoaded', () => {
    const loginButton = document.getElementById('login-button');
    
    if (loginButton) {
        loginButton.addEventListener('click', () => {
            window.location.href = './login.html';
        });
    } else {
        console.log('Login button not found'); // 디버깅을 위한 콘솔 로그 추가
    }
});