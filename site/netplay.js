/**
 * Mario Kart 64 Web - Netplay Module (WebRTC P2P via PeerJS)
 * Ultra-low latency video/audio streaming (Host -> Guest)
 * Real-time 60Hz controller input channel (Guest -> Host -> Controller 2)
 */

window.Netplay = (function() {
    let peer = null;
    let activeConn = null;
    let activeCall = null;
    let isHost = false;
    let roomCode = null;
    let localStream = null;
    let pingInterval = null;
    let lastPing = 0;

    // Helper: generate 4-character room code (e.g., A7F2)
    function generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 4; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    function getPeerIdForRoom(code) {
        return 'mk64-room-' + code.toUpperCase();
    }

    // Guest local input tracker
    const guestInput = {
        up: false, down: false, left: false, right: false,
        a: false, b: false, z: false, r: false, l: false, start: false,
        stickX: 0, stickY: 0
    };

    let guestInputLoopRunning = false;

    function startGuestInputLoop() {
        if (guestInputLoopRunning) return;
        guestInputLoopRunning = true;

        function loop() {
            if (!activeConn || !activeConn.open) {
                guestInputLoopRunning = false;
                return;
            }

            // Check if Guest has a physical gamepad plugged in
            const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
            const gp = gamepads && gamepads[0] ? gamepads[0] : null;

            let finalState = { ...guestInput };

            if (gp && gp.connected) {
                // Map standard physical gamepad buttons
                if (gp.buttons[0] && gp.buttons[0].pressed) finalState.a = true;
                if (gp.buttons[2] && gp.buttons[2].pressed) finalState.b = true;
                if (gp.buttons[4] && gp.buttons[4].pressed) finalState.z = true; // LB
                if (gp.buttons[6] && gp.buttons[6].pressed) finalState.z = true; // LT
                if (gp.buttons[5] && gp.buttons[5].pressed) finalState.r = true; // RB
                if (gp.buttons[7] && gp.buttons[7].pressed) finalState.r = true; // RT
                if (gp.buttons[9] && gp.buttons[9].pressed) finalState.start = true;
                if (gp.buttons[12] && gp.buttons[12].pressed) finalState.up = true;
                if (gp.buttons[13] && gp.buttons[13].pressed) finalState.down = true;
                if (gp.buttons[14] && gp.buttons[14].pressed) finalState.left = true;
                if (gp.buttons[15] && gp.buttons[15].pressed) finalState.right = true;

                // Analog stick
                if (Math.abs(gp.axes[0]) > 0.15) finalState.stickX = gp.axes[0];
                if (Math.abs(gp.axes[1]) > 0.15) finalState.stickY = gp.axes[1];
            }

            try {
                activeConn.send({
                    type: 'INPUT',
                    state: finalState
                });
            } catch (e) {
                console.warn('Failed sending input', e);
            }

            requestAnimationFrame(loop);
        }

        requestAnimationFrame(loop);
    }

    return {
        isHost: function() { return isHost; },
        getRoomCode: function() { return roomCode; },

        // ==========================================
        // HOST MODE
        // ==========================================
        createRoom: function(onReady, onGuestJoin, onGuestLeave) {
            isHost = true;
            roomCode = generateRoomCode();
            const hostPeerId = getPeerIdForRoom(roomCode);

            if (peer) {
                try { peer.destroy(); } catch (e) {}
            }

            peer = new Peer(hostPeerId, {
                debug: 1,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:global.stun.twilio.com:3478' }
                    ]
                }
            });

            peer.on('open', (id) => {
                console.log('Host peer ready with ID:', id);
                if (onReady) onReady(roomCode, id);
            });

            peer.on('error', (err) => {
                console.error('PeerJS Host Error:', err);
                if (err.type === 'unavailable-id') {
                    // Try another code
                    Netplay.createRoom(onReady, onGuestJoin, onGuestLeave);
                }
            });

            peer.on('connection', (conn) => {
                console.log('Guest connected data channel:', conn.peer);
                activeConn = conn;

                conn.on('open', () => {
                    console.log('Data connection open with Guest!');
                    conn.send({ type: 'WELCOME', room: roomCode, game: 'Mario Kart 64' });

                    // Prepare media stream to send to guest
                    const canvas = document.getElementById('canvas');
                    if (canvas) {
                        try {
                            const videoStream = canvas.captureStream ? canvas.captureStream(60) : canvas.mozCaptureStream(60);
                            const tracks = [...videoStream.getVideoTracks()];

                            // Add audio track if audioContext is initialized
                            if (window.myApp && window.myApp.audioDestination && window.myApp.audioDestination.stream) {
                                const audioTracks = window.myApp.audioDestination.stream.getAudioTracks();
                                if (audioTracks.length > 0) {
                                    tracks.push(audioTracks[0]);
                                }
                            }

                            localStream = new MediaStream(tracks);
                            console.log('Calling guest with MediaStream (tracks: ' + tracks.length + ')');
                            const call = peer.call(conn.peer, localStream);
                            activeCall = call;
                        } catch (err) {
                            console.error('Error capturing stream:', err);
                        }
                    }

                    if (onGuestJoin) onGuestJoin(conn.peer);
                });

                conn.on('data', (data) => {
                    if (data.type === 'INPUT') {
                        if (window.ControllerManager) {
                            window.ControllerManager.setPlayer2State(data.state);
                        }
                    } else if (data.type === 'PING') {
                        conn.send({ type: 'PONG', t: data.t });
                    }
                });

                conn.on('close', () => {
                    console.log('Guest disconnected');
                    activeConn = null;
                    if (window.ControllerManager) {
                        window.ControllerManager.resetPlayer2();
                    }
                    if (onGuestLeave) onGuestLeave();
                });
            });
        },

        // ==========================================
        // GUEST MODE
        // ==========================================
        joinRoom: function(code, onConnected, onStreamReady, onDisconnected, onPingUpdate) {
            isHost = false;
            roomCode = code.toUpperCase();
            const hostPeerId = getPeerIdForRoom(roomCode);

            if (peer) {
                try { peer.destroy(); } catch (e) {}
            }

            peer = new Peer({
                debug: 1,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:global.stun.twilio.com:3478' }
                    ]
                }
            });

            peer.on('open', (guestId) => {
                console.log('Guest peer opened with ID:', guestId);
                console.log('Connecting to host:', hostPeerId);

                activeConn = peer.connect(hostPeerId, { reliable: false });

                activeConn.on('open', () => {
                    console.log('Connected to host data channel!');
                    if (onConnected) onConnected();
                    startGuestInputLoop();

                    // Start ping interval
                    if (pingInterval) clearInterval(pingInterval);
                    pingInterval = setInterval(() => {
                        if (activeConn && activeConn.open) {
                            activeConn.send({ type: 'PING', t: performance.now() });
                        }
                    }, 1000);
                });

                activeConn.on('data', (data) => {
                    if (data.type === 'PONG') {
                        const rtt = Math.round(performance.now() - data.t);
                        lastPing = rtt;
                        if (onPingUpdate) onPingUpdate(rtt);
                    }
                });

                activeConn.on('close', () => {
                    console.log('Disconnected from host');
                    if (pingInterval) clearInterval(pingInterval);
                    if (onDisconnected) onDisconnected();
                });
            });

            peer.on('call', (call) => {
                console.log('Received media call from host');
                activeCall = call;
                call.answer(); // Answer without outgoing stream

                call.on('stream', (remoteStream) => {
                    console.log('Received remote stream from host! Tracks:', remoteStream.getTracks().length);
                    if (onStreamReady) onStreamReady(remoteStream);
                });
            });

            peer.on('error', (err) => {
                console.error('PeerJS Guest Error:', err);
                if (err.type === 'peer-unavailable') {
                    alert('No se encontró la sala ' + roomCode + '. Asegúrate de que el Anfitrión tenga el juego abierto.');
                }
            });

            // Set up guest keyboard listeners
            this.initGuestKeyboard();
        },

        initGuestKeyboard: function() {
            window.addEventListener('keydown', (e) => {
                if (isHost) return;
                const key = e.key;
                if (key === 'ArrowUp' || key === 'w' || key === 'W') guestInput.up = true;
                if (key === 'ArrowDown' || key === 's' || key === 'S') guestInput.down = true;
                if (key === 'ArrowLeft' || key === 'a' || key === 'A') guestInput.left = true;
                if (key === 'ArrowRight' || key === 'd' || key === 'D') guestInput.right = true;
                if (key === ' ' || key === 'x' || key === 'X') guestInput.a = true; // A (Accel)
                if (key === 'z' || key === 'Z' || key === 'c' || key === 'C') guestInput.b = true; // B (Brake)
                if (key === 'Shift' || key === 'q' || key === 'Q') guestInput.z = true; // Z (Item)
                if (key === 'e' || key === 'E' || key === 'r' || key === 'R') guestInput.r = true; // R (Drift)
                if (key === 'Enter') guestInput.start = true; // Start
            });

            window.addEventListener('keyup', (e) => {
                if (isHost) return;
                const key = e.key;
                if (key === 'ArrowUp' || key === 'w' || key === 'W') guestInput.up = false;
                if (key === 'ArrowDown' || key === 's' || key === 'S') guestInput.down = false;
                if (key === 'ArrowLeft' || key === 'a' || key === 'A') guestInput.left = false;
                if (key === 'ArrowRight' || key === 'd' || key === 'D') guestInput.right = false;
                if (key === ' ' || key === 'x' || key === 'X') guestInput.a = false;
                if (key === 'z' || key === 'Z' || key === 'c' || key === 'C') guestInput.b = false;
                if (key === 'Shift' || key === 'q' || key === 'Q') guestInput.z = false;
                if (key === 'e' || key === 'E' || key === 'r' || key === 'R') guestInput.r = false;
                if (key === 'Enter') guestInput.start = false;
            });
        },

        // Helper for Guest Touch Buttons
        setGuestTouch: function(buttonName, isPressed) {
            if (guestInput.hasOwnProperty(buttonName)) {
                guestInput[buttonName] = !!isPressed;
            }
        },

        setGuestStick: function(x, y) {
            guestInput.stickX = x;
            guestInput.stickY = y;
        }
    };
})();
