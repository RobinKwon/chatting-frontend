const API_URL = 'http://localhost:3000';
const chatBox = document.querySelector('.chat-box');
const chatInput = document.querySelector('.chat-input input');
const sendButton = document.querySelector('.chat-input button');
let userMessages = [];
let assistantMessages = [];
let userId = '';
let myDateTime = '';

function spinner() {
    const loader = document.getElementById('loader');
    loader.style.display = 'block';
    loader.style.animation = "fa-spin 2s infinite linear"; // 애니메이션 적용
}

function pageScroll() {
    window.scrollBy(0,1);
    scrolldelay = setTimeout(pageScroll, 10);
}

async function handleSend() {
    console.log("handleSend!");

    // 사용자 ID 가져오기 (예제: sessionStorage 사용)
    userId = sessionStorage.getItem('userId');
    if (!userId) {
        alert('로그인이 필요합니다.');
        window.location.href = './login.html';
        return;
    }
    console.log(`Logged in user ID: ${userId}`);

    // read birth
    const response = await fetch(`${API_URL}/GetBirth`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId })
    });
    const data = await response.json();
    console.log(`GetBirth info: ${data.success}`);
    if (data.success) {
        //const data = response.json();
        myDateTime = data.message;

        // HTML 요소 업데이트
        //const userDisplay = document.getElementById('userDisplay');
        //if (userDisplay) {
        //    userDisplay.textContent = `Welcome, ${userId}`;
        //}

        spinner();
        sendMessage();
    }
    else {
        alert('Failed to read birth. ${response}');
    }
}

function start() {
    const date = document.getElementById('date').value;
    const hour = document.getElementById('hour').value;
    if (date === '') {
        alert('생년월일을 입력해주세요.');
        return;
    }
    myDateTime = date + hour;

    document.getElementById('intro').style.display = 'none';
    document.getElementById('chat').style.display = 'block';
}

const sendMessage = async () => {
    try {
        const chatMessage = document.createElement('div');
        chatMessage.classList.add('chat-message');
        chatMessage.innerHTML = `<p>${chatInput.value}</p>`;
        chatBox.appendChild(chatMessage);

        userMessages.push(chatInput.value);
        chatInput.value = '';

        const response = await fetch(`${API_URL}/ChildhoodFriend`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                id: userId,
                myDateTime: myDateTime,
                userMessages: userMessages,
                assistantMessages: assistantMessages,
            }),
        });

        const data = await response.json();
        document.getElementById('loader').style.display = 'none';

        assistantMessages.push(data.assistant);

        if (typeof data.assistant === 'string') {
            const astrologerMessage = document.createElement('div');
            astrologerMessage.classList.add('chat-message');
            astrologerMessage.innerHTML = `
                <p class='assistant'>${data.assistant}</p>
            `;
            //<p class='assistant'>추가로 링크를 눌러 작은 정성 배풀어주시면 더욱 좋은 운이 있으실겁니다. => <a href='https://toss.me/jocoding'>복채 보내기</a></p>
            chatBox.appendChild(astrologerMessage);
        } else {
            throw new Error('Invalid assistant message');
        }
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('loader').style.display = 'none';
        const errorMessage = document.createElement('div');
        errorMessage.classList.add('chat-message');
        errorMessage.innerHTML = `<p class='assistant'>죄송합니다. 오류가 발생했습니다. 잠시 후 다시 시도해주세요.</p>`;
        chatBox.appendChild(errorMessage);
    }
};

sendButton.addEventListener('click', handleSend);
chatInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        handleSend();
    }
});
