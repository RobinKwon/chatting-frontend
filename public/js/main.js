const chatBox = document.querySelector('.chat-box');
const chatInput = document.querySelector('.chat-input input');
const sendButton = document.querySelector('.chat-input button');
const chatMessage = document.createElement('div');
const astrologerMessage = document.createElement('div');
let userMessages = [];
let assistantMessages = [];
let myDateTime = '';

function spinner() {
    document.getElementById('loader').style.display = 'block';
}

function handleSend() {
    spinner();
    sendMessage();
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
        chatMessage.classList.add('chat-message');
        chatMessage.innerHTML = `<p>${chatInput.value}</p>`;
        chatBox.appendChild(chatMessage);

        userMessages.push(chatInput.value);
        chatInput.value = '';

        const response = await fetch('http://localhost:3000/ChildhoodFriend', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                myDateTime: myDateTime,
                userMessages: userMessages,
                assistantMessages: assistantMessages,
            }),
        });

        const data = await response.json();
        document.getElementById('loader').style.display = 'none';

        assistantMessages.push(data.assistant);

        if (typeof data.assistant === 'string') {
            astrologerMessage.classList.add('chat-message');
            astrologerMessage.innerHTML = `
                <p class='assistant'>${data.assistant}</p>
                <p class='assistant'>추가로 링크를 눌러 작은 정성 배풀어주시면 더욱 좋은 운이 있으실겁니다. => <a href='https://toss.me/jocoding'>복채 보내기</a></p>
            `;
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
