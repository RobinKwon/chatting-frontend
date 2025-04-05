// DOM 요소 초기화
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const micBtn = document.getElementById('mic-btn');
const cameraBtn = document.getElementById('camera-btn');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const voiceBtn = document.getElementById('voice-btn');
const chatBox = document.getElementById('chat-box');
const loading = document.getElementById('loading');
const userVideo = document.getElementById('user-video');
const aiVideo = document.getElementById('ai-video');

let mediaStream = null;
let isRecording = false;
let sessionId = null;

// WebSocket 연결 설정
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsHost = window.location.hostname || 'localhost';
const wsPort = '3000';
const wsUrl = `${wsProtocol}//${wsHost}:${wsPort}/ws`;  // '/ws' 엔드포인트 추가

let ws = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectInterval = 2000; // 2초마다 재연결 시도

// 유틸리티 함수
function showMessage(sender, message) {
    if (!chatBox) return; // chatBox가 없으면 함수 종료
    const messageElement = document.createElement('div');
    messageElement.className = 'message';
    messageElement.innerHTML = `<strong>${sender}:</strong> ${message}`;
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function stopMediaStream() {
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
        userVideo.srcObject = null;
    }
}

// WebSocket 연결 상태 확인
function isWebSocketConnected() {
    return ws && ws.readyState === WebSocket.OPEN;
}

function connectWebSocket() {
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
        console.log('WebSocket이 이미 연결되어 있거나 연결 중입니다.');
        return;
    }

    try {
        console.log(`WebSocket 연결 시도: ${wsUrl}`);
        ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
            console.log('WebSocket 연결 성공');
            reconnectAttempts = 0;
            showMessage('시스템', 'WebSocket 연결이 설정되었습니다.');
            
            // 연결 성공 시 버튼 상태 업데이트
            startBtn.disabled = false;
            stopBtn.disabled = true;
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('서버로부터 메시지 수신:', data);

                switch (data.type) {
                    case 'session_started':
                        sessionId = data.sessionId;
                        startBtn.disabled = true;
                        stopBtn.disabled = false;
                        showMessage('시스템', '세션이 시작되었습니다.');
                        break;

                    case 'session_ended':
                        sessionId = null;
                        startBtn.disabled = false;
                        stopBtn.disabled = true;
                        showMessage('시스템', '세션이 종료되었습니다.');
                        stopMediaStream();
                        break;

                    case 'audio_processed':
                        showMessage('사용자', data.transcription);
                        showMessage('AI', data.aiResponse);
                        break;

                    case 'video_processed':
                        showMessage('시스템', data.videoAnalysis);
                        break;

                    case 'error':
                        showMessage('에러', data.message);
                        break;
                }
            } catch (error) {
                console.error('메시지 처리 중 오류:', error);
                showMessage('에러', '메시지 처리 중 오류가 발생했습니다.');
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket 에러:', error);
            showMessage('에러', 'WebSocket 연결 오류가 발생했습니다.');
        };

        ws.onclose = (event) => {
            console.log(`WebSocket 연결 종료 (코드: ${event.code})`);
            showMessage('시스템', 'WebSocket 연결이 종료되었습니다.');
            
            // 버튼 상태 업데이트
            startBtn.disabled = true;
            stopBtn.disabled = true;
            
            // 재연결 시도
            if (reconnectAttempts < maxReconnectAttempts) {
                reconnectAttempts++;
                console.log(`재연결 시도 ${reconnectAttempts}/${maxReconnectAttempts}`);
                setTimeout(connectWebSocket, reconnectInterval);
            } else {
                showMessage('에러', '서버 연결에 실패했습니다. 페이지를 새로고침해주세요.');
            }
        };
    } catch (error) {
        console.error('WebSocket 연결 실패:', error);
        showMessage('에러', 'WebSocket 연결에 실패했습니다.');
        
        // 연결 실패 시 재시도
        if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            setTimeout(connectWebSocket, reconnectInterval);
        }
    }
}

// 버튼 이벤트 핸들러
startBtn.addEventListener('click', () => {
    if (isWebSocketConnected()) {
        ws.send(JSON.stringify({ type: 'start_session' }));
    } else {
        showMessage('에러', 'WebSocket이 연결되어 있지 않습니다.');
        connectWebSocket(); // 연결 재시도
    }
});

stopBtn.addEventListener('click', () => {
    if (isWebSocketConnected()) {
        ws.send(JSON.stringify({ type: 'end_session' }));
    }
});

micBtn.addEventListener('click', async () => {
    if (!mediaStream) {
        try {
            mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            micBtn.textContent = '마이크 끄기';
            // 오디오 스트림 처리 로직 추가
        } catch (error) {
            console.error('마이크 접근 오류:', error);
            showMessage('에러', '마이크 접근에 실패했습니다.');
        }
    } else {
        stopMediaStream();
        micBtn.textContent = '마이크 켜기';
    }
});

cameraBtn.addEventListener('click', async () => {
    if (!mediaStream) {
        try {
            mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
            userVideo.srcObject = mediaStream;
            cameraBtn.textContent = '카메라 끄기';
        } catch (error) {
            console.error('카메라 접근 오류:', error);
            showMessage('에러', '카메라 접근에 실패했습니다.');
        }
    } else {
        stopMediaStream();
        cameraBtn.textContent = '카메라 켜기';
    }
});

sendBtn.addEventListener('click', () => {
    const message = messageInput.value.trim();
    if (message && sessionId && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'message',
            sessionId,
            message
        }));
        messageInput.value = '';
    }
});

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendBtn.click();
    }
});

// 오디오 데이터 전송 함수
function sendAudioData(audioData, isComplete = false) {
    if (sessionId && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'audio_data',
            sessionId,
            data: audioData,
            isComplete
        }));
    }
}

// 비디오 데이터 전송 함수
function sendVideoData(videoData, isComplete = false) {
    if (sessionId && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'video_data',
            sessionId,
            data: videoData,
            isComplete
        }));
    }
}

// 페이지 로드가 완료된 후 WebSocket 연결 시도
window.addEventListener('load', () => {
    // 초기 버튼 상태 설정
    startBtn.disabled = true;
    stopBtn.disabled = true;
    
    // WebSocket 연결 시작
    connectWebSocket();
}); 