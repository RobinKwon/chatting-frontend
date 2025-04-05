// 상수 정의
//const API_URL = 'https://your-api-gateway-url.amazonaws.com/prod';
const API_URL = 'http://localhost:3000';

// DOM 요소
const chatBox = document.getElementById('chat-box');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const voiceBtn = document.getElementById('voice-btn');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const micBtn = document.getElementById('mic-btn');
const cameraBtn = document.getElementById('camera-btn');
const userVideo = document.getElementById('user-video');
const aiVideo = document.getElementById('ai-video');
const loadingIndicator = document.getElementById('loading');

// 상태 변수
let mediaRecorder;
let audioChunks = [];
let videoChunks = [];
let isRecordingAudio = false;
let isRecordingVideo = false;
let userStream = null;
let sessionId = null;
let micEnabled = false;
let cameraEnabled = false;

// 웹소켓 연결
let socket = null;

//wsUrl = `wss://your-websocket-url.amazonaws.com?sessionId=${sessionId}`
// WebSocket 연결 설정
const wsUrl = 'ws://localhost:3000/ws';  // 고정된 WebSocket 주소 사용

// 초기화 함수
async function initialize() {
    try {
        // 세션 생성
        const response = await axios.post(`${API_URL}/session`);
        sessionId = response.data.sessionId;
        
        // 웹소켓 연결
        connectWebSocket();
        
        // 버튼 상태 업데이트
        startBtn.disabled = true;
        stopBtn.disabled = false;
        
        // 시작 메시지 표시
        addAIMessage("안녕하세요! 저는 당신의 AI 채팅 친구입니다. 어떻게 도와드릴까요?");
    } catch (error) {
        console.error('초기화 오류:', error);
        alert('서비스 연결 중 오류가 발생했습니다.');
    }
}

// 웹소켓 연결 함수
function connectWebSocket() {
    socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
        console.log('웹소켓 연결 성공');
    };
    
    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'text') {
            addAIMessage(data.content);
        } else if (data.type === 'audio') {
            playAudio(data.url);
        } else if (data.type === 'video') {
            updateAIVideo(data.url);
        }
        
        loadingIndicator.style.display = 'none';
    };
    
    socket.onclose = () => {
        console.log('웹소켓 연결 종료');
    };
    
    socket.onerror = (error) => {
        console.error('웹소켓 오류:', error);
    };
}

// 메시지 전송 함수
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;
    
    // 사용자 메시지 표시
    addUserMessage(message);
    
    // 로딩 표시
    loadingIndicator.style.display = 'block';
    
    try {
        // 메시지 전송
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'text',
                content: message,
                sessionId: sessionId
            }));
        } else {
            await axios.post(`${API_URL}/message`, {
                type: 'text',
                content: message,
                sessionId: sessionId
            });
        }
        
        // 입력 필드 초기화
        messageInput.value = '';
    } catch (error) {
        console.error('메시지 전송 오류:', error);
        loadingIndicator.style.display = 'none';
        alert('메시지 전송 중 오류가 발생했습니다.');
    }
}

// 음성 메시지 녹음 시작/종료 함수
function toggleVoiceRecording() {
    if (isRecordingAudio) {
        stopAudioRecording();
    } else {
        startAudioRecording();
    }
}

// 음성 녹음 시작 함수
async function startAudioRecording() {
    try {
        if (!userStream) {
            userStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        
        mediaRecorder = new MediaRecorder(userStream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            await uploadAudio(audioBlob);
        };
        
        mediaRecorder.start();
        isRecordingAudio = true;
        voiceBtn.textContent = '녹음 중지';
    } catch (error) {
        console.error('음성 녹음 시작 오류:', error);
        alert('음성 녹음을 시작할 수 없습니다.');
    }
}

// 음성 녹음 중지 함수
function stopAudioRecording() {
    if (mediaRecorder && isRecordingAudio) {
        mediaRecorder.stop();
        isRecordingAudio = false;
        voiceBtn.textContent = '음성 메시지';
    }
}

// 오디오 업로드 함수
async function uploadAudio(audioBlob) {
    try {
        // 로딩 표시
        loadingIndicator.style.display = 'block';
        
        // 파일 이름 생성
        const fileName = `audio_${sessionId}_${Date.now()}.wav`;
        
        // 오디오 파일 업로드 요청
        const presignedUrl = await getPresignedUrl(fileName, 'audio/wav');
        
        // S3에 업로드
        await axios.put(presignedUrl, audioBlob, {
            headers: {
                'Content-Type': 'audio/wav'
            }
        });
        
        // 메시지 전송
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'audio',
                fileName: fileName,
                sessionId: sessionId
            }));
        } else {
            await axios.post(`${API_URL}/message`, {
                type: 'audio',
                fileName: fileName,
                sessionId: sessionId
            });
        }
        
        // 사용자 메시지 표시
        addUserMessage('🎤 음성 메시지를 보냈습니다.');
    } catch (error) {
        console.error('오디오 업로드 오류:', error);
        loadingIndicator.style.display = 'none';
        alert('음성 메시지 전송 중 오류가 발생했습니다.');
    }
}

// presigned URL 요청 함수
async function getPresignedUrl(fileName, contentType) {
    const response = await axios.post(`${API_URL}/upload-url`, {
        fileName: fileName,
        contentType: contentType,
        sessionId: sessionId
    });
    return response.data.url;
}

// 비디오 스트림 시작/중지 함수
async function toggleCamera() {
    try {
        if (cameraEnabled) {
            // 카메라 끄기
            if (userStream) {
                userStream.getTracks().forEach(track => {
                    if (track.kind === 'video') {
                        track.stop();
                    }
                });
            }
            userVideo.srcObject = null;
            cameraEnabled = false;
            cameraBtn.textContent = '카메라 켜기';
        } else {
            // 카메라 켜기
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            
            if (!userStream) {
                userStream = stream;
            } else {
                // 기존 비디오 트랙 교체
                const videoTrack = stream.getVideoTracks()[0];
                const senders = userStream.getTracks();
                
                // 비디오 트랙 추가
                const hasVideo = senders.some(sender => sender.kind === 'video');
                if (!hasVideo) {
                    userStream.addTrack(videoTrack);
                } else {
                    // 기존 트랙 교체
                    senders.forEach(sender => {
                        if (sender.kind === 'video') {
                            sender.stop();
                        }
                    });
                    
                    // 새 트랙으로 스트림 업데이트
                    const newTracks = userStream.getTracks().filter(track => track.kind !== 'video');
                    newTracks.push(videoTrack);
                    userStream = new MediaStream(newTracks);
                }
            }
            
            userVideo.srcObject = userStream;
            cameraEnabled = true;
            cameraBtn.textContent = '카메라 끄기';
            
            // 비디오 스트림 전송 시작
            startVideoStream();
        }
    } catch (error) {
        console.error('카메라 전환 오류:', error);
        alert('카메라를 제어할 수 없습니다.');
    }
}

// 마이크 켜기/끄기 함수
async function toggleMic() {
    try {
        if (micEnabled) {
            // 마이크 끄기
            if (userStream) {
                userStream.getTracks().forEach(track => {
                    if (track.kind === 'audio') {
                        track.stop();
                    }
                });
            }
            micEnabled = false;
            micBtn.textContent = '마이크 켜기';
        } else {
            // 마이크 켜기
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            if (!userStream) {
                userStream = stream;
            } else {
                // 기존 오디오 트랙 교체
                const audioTrack = stream.getAudioTracks()[0];
                const senders = userStream.getTracks();
                
                // 오디오 트랙 추가
                const hasAudio = senders.some(sender => sender.kind === 'audio');
                if (!hasAudio) {
                    userStream.addTrack(audioTrack);
                } else {
                    // 기존 트랙 교체
                    senders.forEach(sender => {
                        if (sender.kind === 'audio') {
                            sender.stop();
                        }
                    });
                    
                    // 새 트랙으로 스트림 업데이트
                    const newTracks = userStream.getTracks().filter(track => track.kind !== 'audio');
                    newTracks.push(audioTrack);
                    userStream = new MediaStream(newTracks);
                }
            }
            
            micEnabled = true;
            micBtn.textContent = '마이크 끄기';
        }
    } catch (error) {
        console.error('마이크 전환 오류:', error);
        alert('마이크를 제어할 수 없습니다.');
    }
}

// 비디오 스트림 시작 함수
function startVideoStream() {
    if (!isRecordingVideo && cameraEnabled) {
        const videoTrack = userStream.getVideoTracks()[0];
        if (videoTrack) {
            mediaRecorder = new MediaRecorder(new MediaStream([videoTrack]), {
                mimeType: 'video/webm'
            });
            videoChunks = [];
            
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    videoChunks.push(event.data);
                    
                    // 일정 크기가 쌓이면 전송
                    if (videoChunks.length > 5) {
                        const videoBlob = new Blob(videoChunks, { type: 'video/webm' });
                        uploadVideo(videoBlob);
                        videoChunks = [];
                    }
                }
            };
            
            mediaRecorder.start(1000); // 1초마다 데이터 수집
            isRecordingVideo = true;
        }
    }
}

// 비디오 업로드 함수
async function uploadVideo(videoBlob) {
    try {
        // 파일 이름 생성
        const fileName = `video_${sessionId}_${Date.now()}.webm`;
        
        // 비디오 파일 업로드 요청
        const presignedUrl = await getPresignedUrl(fileName, 'video/webm');
        
        // S3에 업로드
        await axios.put(presignedUrl, videoBlob, {
            headers: {
                'Content-Type': 'video/webm'
            }
        });
        
        // 비디오 스트림 업데이트 알림
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'video',
                fileName: fileName,
                sessionId: sessionId
            }));
        }
    } catch (error) {
        console.error('비디오 업로드 오류:', error);
    }
}

// 세션 종료 함수
async function endSession() {
    try {
        // 녹음 중지
        if (isRecordingAudio || isRecordingVideo) {
            if (mediaRecorder) {
                mediaRecorder.stop();
            }
            isRecordingAudio = false;
            isRecordingVideo = false;
        }
        
        // 미디어 스트림 정리
        if (userStream) {
            userStream.getTracks().forEach(track => track.stop());
            userStream = null;
        }
        
        // 웹소켓 연결 종료
        if (socket) {
            socket.close();
            socket = null;
        }
        
        // 세션 종료 요청
        if (sessionId) {
            await axios.post(`${API_URL}/end-session`, {
                sessionId: sessionId
            });
            sessionId = null;
        }
        
        // 버튼 상태 업데이트
        startBtn.disabled = false;
        stopBtn.disabled = true;
        micBtn.textContent = '마이크 켜기';
        cameraBtn.textContent = '카메라 켜기';
        micEnabled = false;
        cameraEnabled = false;
        
        // 비디오 초기화
        userVideo.srcObject = null;
        aiVideo.src = '';
        
        // 채팅창 초기화
        chatBox.innerHTML = '';
        
        // 종료 메시지
        alert('세션이 종료되었습니다.');
    } catch (error) {
        console.error('세션 종료 오류:', error);
        alert('세션 종료 중 오류가 발생했습니다.');
    }
}

// AI 오디오 재생 함수
function playAudio(url) {
    const audio = new Audio(url);
    audio.play();
}

// AI 비디오 업데이트 함수
function updateAIVideo(url) {
    aiVideo.src = url;
    aiVideo.play();
}

// 채팅창에 사용자 메시지 추가 함수
function addUserMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', 'user-message');
    messageElement.textContent = message;
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// 채팅창에 AI 메시지 추가 함수
function addAIMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', 'ai-message');
    messageElement.textContent = message;
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// 이벤트 리스너 등록
startBtn.addEventListener('click', initialize);
stopBtn.addEventListener('click', endSession);
sendBtn.addEventListener('click', sendMessage);
voiceBtn.addEventListener('click', toggleVoiceRecording);
micBtn.addEventListener('click', toggleMic);
cameraBtn.addEventListener('click', toggleCamera);

messageInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        sendMessage();
    }
});

// 페이지 언로드 시 세션 정리
window.addEventListener('beforeunload', () => {
    if (userStream) {
        userStream.getTracks().forEach(track => track.stop());
    }
    
    if (socket) {
        socket.close();
    }
});