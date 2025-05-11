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
let userId = null;

// --- Video Streaming Variables ---
let isVideoStreaming = false;
let mediaRecorder = null;
const VIDEO_CHUNK_INTERVAL = 10000; // ms 단위, 10초마다 청크 전송  //250419_2342:10초마다 청크 전송

// WebSocket 연결 설정
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsHost = window.location.hostname || 'localhost';
const wsPort = '3000';
const wsUrl = `${wsProtocol}//${wsHost}:${wsPort}/ws`;  // '/ws' 경로 추가 확인

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

// --- Blob to Base64 Helper ---
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]); // data:mime/type;base64, 에서 base64 부분만 추출
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// --- Video Streaming Functions ---
async function startVideoStreaming() {
    if (!mediaStream || !sessionId || !isWebSocketConnected() || isVideoStreaming) {
        console.log('Cannot start video streaming. Preconditions not met or already streaming.',
                    { hasStream: !!mediaStream, hasSession: !!sessionId, wsConnected: isWebSocketConnected(), isStreaming: isVideoStreaming });
        return;
    }

    const videoTracks = mediaStream.getVideoTracks();
    if (videoTracks.length === 0) {
        console.log('No video track available to stream.');
        return;
    }

    // Create a new stream with only video tracks for the recorder
    const videoStreamForRecorder = new MediaStream(videoTracks);

    try {
        // Check supported mime types
        const options = { 
            mimeType: 'video/webm;codecs=vp8,opus',
            videoBitsPerSecond: 2500000,    // 2.5 Mbps
            audioBitsPerSecond: 128000      // 128 kbps
        };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            console.log(`${options.mimeType} is not Supported. Trying default.`);
            delete options.mimeType; // 기본 설정 사용
        }

        mediaRecorder = new MediaRecorder(videoStreamForRecorder, options);
        console.log('MediaRecorder created with options:', options);

        let chunks = [];  // 청크를 저장할 배열

        mediaRecorder.ondataavailable = async (event) => {
            if (event.data && event.data.size > 0) {
                chunks.push(event.data);
                console.log(`Video chunk collected, size: ${event.data.size} bytes`);
            }
        };

        // 주기적으로 청크를 처리하고 전송
        const processChunks = async () => {
            if (chunks.length > 0) {
                const blob = new Blob(chunks, { type: 'video/webm' });
                chunks = []; // 청크 배열 초기화

                if (blob.size > 1000) {  // 최소 1KB
                    try {
                        const base64Data = await blobToBase64(blob);
                        sendVideoData(base64Data, true);
                        console.log(`Sending video blob, size: ${blob.size} bytes`);
                    } catch (error) {
                        console.error('Error converting video blob to Base64:', error);
                    }
                } else {
                    console.log('Skipping small video blob');
                }
            }
        };

        // 주기적으로 청크 처리
        const processInterval = setInterval(processChunks, VIDEO_CHUNK_INTERVAL);

        mediaRecorder.onstop = async () => {
            console.log('MediaRecorder stopped.');
            clearInterval(processInterval);
            await processChunks(); // 남은 청크 처리
            isVideoStreaming = false;
        };

        // 비디오 품질 설정
        const videoTrack = videoStreamForRecorder.getVideoTracks()[0];
        if (videoTrack) {
            await videoTrack.applyConstraints({
                width: { ideal: 640 },
                height: { ideal: 480 },
                frameRate: { ideal: 15 },
                aspectRatio: { ideal: 1.333333 }
            });
        }

        // 더 작은 간격으로 데이터 수집
        mediaRecorder.start(1000); // 1초마다 ondataavailable 이벤트 발생
        isVideoStreaming = true;
        console.log(`Video recording started. Processing chunks every ${VIDEO_CHUNK_INTERVAL}ms.`);
        showMessage('시스템', '비디오 녹화 시작.');

    } catch (error) {
        console.error('Failed to create or start MediaRecorder:', error);
        showMessage('에러', '비디오 녹화 시작에 실패했습니다.');
        mediaRecorder = null;
        isVideoStreaming = false;
    }
}

function stopVideoStreaming() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        console.log('Stopping video streaming...');
        mediaRecorder.stop(); // onstop 이벤트 핸들러가 호출됨
        // isVideoStreaming = false; 는 onstop 핸들러에서 설정
    } else {
        console.log('Video streaming is not active or recorder is null.');
    }
    // 명시적으로 null 설정하여 자원 해제 유도
    mediaRecorder = null;
}

function stopMediaStream() {
    console.log('Stopping all media streams...');
    stopVideoStreaming(); // Stop video streaming if active
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => {
            track.stop();
            console.log('Track stopped:', track.label);
        });
        mediaStream = null;
    }
    if (userVideo) userVideo.srcObject = null;
    cameraBtn.textContent = '카메라 켜기';
    cameraBtn.classList.remove('active');
    if (typeof micBtn !== 'undefined' && micBtn) {
        micBtn.textContent = '마이크 켜기';
        micBtn.classList.remove('active');
    }
    console.log('All media streams stopped.');
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
                        // Check if camera is already on and start streaming
                        if (userVideo.srcObject) {
                            console.log('Session started with camera already on. Starting video stream.');
                            startVideoStreaming();
                        }
                        break;

                    case 'session_ended':
                        showMessage('시스템', '세션이 종료되었습니다.');
                        stopVideoStreaming(); // Stop streaming on session end
                        stopMediaStream(); // Stop all media and reset UI
                        sessionId = null;
                        startBtn.disabled = false;
                        stopBtn.disabled = true;
                        break;

                    case 'audio_processed':
                        showMessage('사용자', data.transcription);
                        showMessage('AI', data.aiResponse);
                        break;

                    case 'video_processed':
                        showMessage('시스템', data.videoAnalysis);
                        // AI 비디오 영역에 프레임 이미지 표시
                        if (data.frameImage) {
                            aiVideo.poster = data.frameImage;
                            // poster 표시를 위해 비디오 일시정지
                            aiVideo.pause();
                        }
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
        userId = sessionStorage.getItem('userId');
        if (!userId) {
            alert('로그인이 필요합니다.');
            window.location.href = './login.html';
            return;
        }
        ws.send(JSON.stringify({ type: 'start_session', userId }));
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

micBtn.addEventListener('click', () => {
    showMessage('시스템', '마이크 기능은 아직 구현되지 않았습니다.');
});

cameraBtn.addEventListener('click', async () => {
    console.log('Camera button clicked. Current userVideo.srcObject:', userVideo.srcObject);
    if (!userVideo.srcObject) { // Turn camera ON
        try {
            // Stop any existing video tracks before getting a new stream
            console.log('Attempting to stop existing video tracks...');
            mediaStream?.getVideoTracks().forEach(track => {
                console.log(`Stopping track: ${track.label}`);
                track.stop();
            });
            console.log('Existing video tracks stopped (if any).');
            
            console.log('Requesting media devices (video)...');
            mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            console.log('Media stream obtained:', mediaStream);

            if (userVideo && mediaStream) {
                userVideo.srcObject = mediaStream;
                console.log('Assigning stream to userVideo. srcObject is now:', userVideo.srcObject);

                // Explicitly play the video, although autoplay should handle it
                await userVideo.play().catch(e => console.error('Error playing video:', e)); // await 추가

                cameraBtn.textContent = '카메라 끄기';
                cameraBtn.classList.add('active');
                showMessage('시스템', '카메라가 켜졌습니다.');
                console.log('Camera turned on successfully.');

                // Start video streaming if session is active
                if (sessionId) {
                    console.log('Camera turned on during active session. Starting video stream.');
                    startVideoStreaming();
                }
            } else {
               throw new Error('userVideo element or mediaStream not available after getUserMedia');
            }

        } catch (error) {
            console.error('카메라 접근 또는 스트림 할당 오류:', error); // Log combined error
            let errorMessage = '카메라 접근에 실패했습니다.';
            // Add specific check for AbortError
            if (error.name === 'AbortError') { 
                errorMessage = '카메라 시작 시간이 초과되었습니다. 카메라 드라이버를 확인하거나 다른 앱에서 사용 중인지 확인해보세요.';
            } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                errorMessage = '카메라 접근 권한이 거부되었습니다. 브라우저 설정을 확인해주세요.';
            } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                errorMessage = '카메라 장치를 찾을 수 없습니다. 카메라가 연결되어 있는지 확인해주세요.';
            } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
                errorMessage = '카메라를 사용할 수 없습니다. 다른 앱에서 사용 중이거나 하드웨어 오류일 수 있습니다.';
            } else if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
                errorMessage = '사용 가능한 카메라 해상도 또는 설정을 찾을 수 없습니다.';
            } else if (error.name === 'SecurityError') {
                errorMessage = '카메라 접근은 HTTPS 또는 localhost 환경에서만 가능합니다.';
            } else {
               // Include error name for better debugging
               errorMessage = `카메라 오류 (${error.name}): ${error.message}`;
            }
            showMessage('에러', errorMessage);
            // Reset UI
            cameraBtn.textContent = '카메라 켜기';
            cameraBtn.classList.remove('active');
            if (userVideo) userVideo.srcObject = null;
            mediaStream = null; // Ensure stream is nullified on error
            stopVideoStreaming(); // Ensure streaming stops on error
            console.log('Camera failed to turn on or stream assignment failed.');
        }
    } else { // Turn camera OFF
        console.log('Turning camera off...');
        stopVideoStreaming(); // Stop streaming when camera is turned off
        if (mediaStream) {
            mediaStream.getVideoTracks().forEach(track => {
                track.stop();
                console.log('Video track stopped:', track.label);
            });
            // Do not nullify mediaStream here if audio might still be active
            // If audio tracks are managed separately, this is fine.
        }
        if (userVideo) userVideo.srcObject = null;
        cameraBtn.textContent = '카메라 켜기';
        cameraBtn.classList.remove('active');
        showMessage('시스템', '카메라가 꺼졌습니다.');
        console.log('Camera turned off.');
    }
});

messageInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        sendBtn.click();
    }
});

sendBtn.addEventListener('click', () => {
    const message = messageInput.value.trim();
    if (message && isWebSocketConnected()) {
        userId = sessionStorage.getItem('userId');
        if (!userId) {
            alert('로그인이 필요합니다.');
            window.location.href = './login.html';
            return;
        }

        ws.send(JSON.stringify({ type: 'text_message', message, userId }));
        showMessage('나', message);
        messageInput.value = '';
    } else if (!isWebSocketConnected()) {
        showMessage('에러', 'WebSocket이 연결되어 있지 않습니다.');
    }
});

voiceBtn.addEventListener('click', () => {
    showMessage('시스템', '음성 메시지 기능은 아직 구현되지 않았습니다.');
});

// 오디오 데이터 전송 함수
function sendAudioData(audioData, isComplete = false) {
    if (userId && sessionId && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'audio_data',
            userId,
            sessionId,
            data: audioData,
            isComplete
        }));
    }
}

// 비디오 데이터 전송 함수
function sendVideoData(videoData, isComplete = false) {
    if (userId && sessionId && ws && ws.readyState === WebSocket.OPEN) {
        // console.log(`Sending video data chunk, size: ${videoData.length}`); // 로그 추가 (주의: 매우 빈번할 수 있음)
        ws.send(JSON.stringify({
            type: 'video_data',
            userId,
            sessionId,
            data: videoData, // Base64 encoded data
            isComplete
        }));
    } else {
        console.log('Cannot send video data. Session not active or WebSocket not open.');
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