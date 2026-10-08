/**
 * Mario Kart 64 Web - Virtual Gamepad & Controller Manager
 * Emulates 2 N64 Controllers via standard HTML5 Gamepad API proxy
 * Synchronizes Player 1 (Host keyboard, touch joystick, physical gamepad)
 * and Player 2 (Guest via WebRTC Netplay or local shared keyboard)
 */

(function() {
    function createGamepadObject(index, name) {
        return {
            id: name || `Virtual Gamepad ${index + 1}`,
            index: index,
            connected: true,
            timestamp: performance.now(),
            mapping: "standard",
            axes: [0, 0, 0, 0],
            buttons: Array.from({ length: 17 }, () => ({
                pressed: false,
                touched: false,
                value: 0
            }))
        };
    }

    const virtualGamepads = [
        createGamepadObject(0, "Virtual Controller 1 (Host)"),
        createGamepadObject(1, "Virtual Controller 2 (P2 Netplay)")
    ];
    window.virtualGamepads = virtualGamepads;

    const nativeGetGamepads = navigator.getGamepads ? navigator.getGamepads.bind(navigator) : null;

    // Helper: Apply abstract state {a, b, z, r, l, start, up, down, left, right, stickX, stickY} to gamepad
    function applyStateToGamepad(pad, state) {
        if (!pad || !state) return;

        // Button 0: A (Accelerate)
        pad.buttons[0].pressed = !!state.a;
        pad.buttons[0].value = state.a ? 1.0 : 0.0;

        // Button 2: B (Brake / Reverse)
        pad.buttons[2].pressed = !!state.b;
        pad.buttons[2].value = state.b ? 1.0 : 0.0;

        // Button 4: Z (Item trigger)
        pad.buttons[4].pressed = !!state.z;
        pad.buttons[4].value = state.z ? 1.0 : 0.0;

        // Button 5: R (Hop / Drift)
        pad.buttons[5].pressed = !!state.r;
        pad.buttons[5].value = state.r ? 1.0 : 0.0;

        // Button 6: L (Map toggle / horn)
        pad.buttons[6].pressed = !!state.l;
        pad.buttons[6].value = state.l ? 1.0 : 0.0;

        // Button 9: Start (Pause / Select)
        pad.buttons[9].pressed = !!state.start;
        pad.buttons[9].value = state.start ? 1.0 : 0.0;

        // D-Pad
        pad.buttons[12].pressed = !!state.up;
        pad.buttons[12].value = state.up ? 1.0 : 0.0;

        pad.buttons[13].pressed = !!state.down;
        pad.buttons[13].value = state.down ? 1.0 : 0.0;

        pad.buttons[14].pressed = !!state.left;
        pad.buttons[14].value = state.left ? 1.0 : 0.0;

        pad.buttons[15].pressed = !!state.right;
        pad.buttons[15].value = state.right ? 1.0 : 0.0;

        // Analog Stick axes (-1.0 to 1.0)
        let ax = 0;
        if (state.stickX !== undefined && Math.abs(state.stickX) > 0.01) {
            ax = state.stickX;
        } else if (state.left) {
            ax = -1.0;
        } else if (state.right) {
            ax = 1.0;
        }

        let ay = 0;
        if (state.stickY !== undefined && Math.abs(state.stickY) > 0.01) {
            ay = state.stickY;
        } else if (state.up) {
            ay = -1.0;
        } else if (state.down) {
            ay = 1.0;
        }

        pad.axes[0] = ax;
        pad.axes[1] = ay;
        pad.timestamp = performance.now();
    }

    // Merge physical gamepad inputs into virtual gamepad so both work concurrently
    function mergePhysicalPad(virtualPad, realPad) {
        if (!realPad || !realPad.connected) return;

        // Merge buttons (logical OR)
        for (let i = 0; i < Math.min(virtualPad.buttons.length, realPad.buttons.length); i++) {
            if (realPad.buttons[i] && realPad.buttons[i].pressed) {
                virtualPad.buttons[i].pressed = true;
                virtualPad.buttons[i].value = realPad.buttons[i].value;
            }
        }

        // Merge axes (override if physical stick is moved beyond deadzone)
        if (realPad.axes && realPad.axes.length >= 2) {
            if (Math.abs(realPad.axes[0]) > 0.15) {
                virtualPad.axes[0] = realPad.axes[0];
            }
            if (Math.abs(realPad.axes[1]) > 0.15) {
                virtualPad.axes[1] = realPad.axes[1];
            }
        }
    }

    let hasPhysicalGamepad = false;
    window._hasPhysicalGamepad = false;

    window.addEventListener("gamepadconnected", () => {
        hasPhysicalGamepad = true;
        window._hasPhysicalGamepad = true;
    });

    window.addEventListener("gamepaddisconnected", () => {
        try {
            const pads = nativeGetGamepads ? nativeGetGamepads() : [];
            hasPhysicalGamepad = false;
            for (let i = 0; i < pads.length; i++) {
                if (pads[i] && pads[i].connected) {
                    hasPhysicalGamepad = true;
                    break;
                }
            }
        } catch(e) {
            hasPhysicalGamepad = false;
        }
        window._hasPhysicalGamepad = hasPhysicalGamepad;
    });

    // Pre-allocated static array to avoid garbage collection overhead on every frame
    const staticGamepadList = [virtualGamepads[0], virtualGamepads[1], null, null];

    navigator.getGamepads = function() {
        const now = performance.now();
        virtualGamepads[0].timestamp = now;
        virtualGamepads[1].timestamp = now;

        // Only query native browser gamepad IPC if a physical gamepad is plugged in
        if (hasPhysicalGamepad && nativeGetGamepads) {
            const real = nativeGetGamepads();
            if (real && real[0] && real[0].connected) mergePhysicalPad(virtualGamepads[0], real[0]);
            if (real && real[1] && real[1].connected) mergePhysicalPad(virtualGamepads[1], real[1]);
            staticGamepadList[2] = (real && real[2]) ? real[2] : null;
            staticGamepadList[3] = (real && real[3]) ? real[3] : null;
        }

        return staticGamepadList;
    };

    // Player 1 Local State
    const player1State = {
        up: false, down: false, left: false, right: false,
        a: false, b: false, z: false, r: false, l: false, start: false,
        stickX: 0, stickY: 0
    };

    // Player 2 Local State
    const player2State = {
        up: false, down: false, left: false, right: false,
        a: false, b: false, z: false, r: false, l: false, start: false,
        stickX: 0, stickY: 0
    };

    function syncPlayer1ToEmulator(state) {
        try {
            if (window.myApp && window.myApp.rivetsData && window.myApp.rivetsData.inputController) {
                const ic = window.myApp.rivetsData.inputController;
                ic.Key_Action_A = !!state.a;
                ic.Key_Action_B = !!state.b;
                ic.Key_Action_Z = !!state.z;
                ic.Key_Action_R = !!state.r;
                ic.Key_Action_Start = !!state.start;
                ic.Key_Left = !!state.left;
                ic.Key_Right = !!state.right;
                ic.Key_Up = !!state.up;
                ic.Key_Down = !!state.down;
                if (state.stickX !== undefined) ic.VectorX = state.stickX;
                if (state.stickY !== undefined) ic.VectorY = state.stickY;
            }
        } catch (e) {}
    }

    window.ControllerManager = {
        virtualGamepads: virtualGamepads,
        local2PlayerEnabled: false,

        setPlayer1State: function(state) {
            if (!state) return;
            Object.assign(player1State, state);
            applyStateToGamepad(virtualGamepads[0], player1State);
            syncPlayer1ToEmulator(player1State);
        },

        setPlayer1Stick: function(x, y) {
            player1State.stickX = x;
            player1State.stickY = y;
            player1State.left = x < -0.3;
            player1State.right = x > 0.3;
            player1State.up = y < -0.3;
            player1State.down = y > 0.3;
            applyStateToGamepad(virtualGamepads[0], player1State);
            syncPlayer1ToEmulator(player1State);
        },

        setPlayer1Touch: function(buttonName, isPressed) {
            if (player1State.hasOwnProperty(buttonName)) {
                player1State[buttonName] = !!isPressed;
                applyStateToGamepad(virtualGamepads[0], player1State);
                syncPlayer1ToEmulator(player1State);
            }
        },

        setPlayer2State: function(state) {
            if (!state) return;
            Object.assign(player2State, state);
            applyStateToGamepad(virtualGamepads[1], player2State);
        },

        resetPlayer2: function() {
            this.setPlayer2State({
                a: false, b: false, z: false, r: false, l: false,
                start: false, up: false, down: false, left: false, right: false,
                stickX: 0, stickY: 0
            });
        },

        initKeyboard: function() {
            window.addEventListener('keydown', (e) => {
                if (window.isGuestMode) return; // Guest mode handled by Netplay

                const key = e.key;

                // If Local 2-Player keyboard mode is enabled, split keys:
                if (this.local2PlayerEnabled) {
                    // P1: WASD + Space/C/Q/E/Enter
                    if (key === 'w' || key === 'W') player1State.up = true;
                    if (key === 's' || key === 'S') player1State.down = true;
                    if (key === 'a' || key === 'A') player1State.left = true;
                    if (key === 'd' || key === 'D') player1State.right = true;
                    if (key === ' ' || key === 'x' || key === 'X') player1State.a = true;
                    if (key === 'c' || key === 'C' || key === 'z' || key === 'Z') player1State.b = true;
                    if (key === 'q' || key === 'Q') player1State.z = true;
                    if (key === 'e' || key === 'E') player1State.r = true;
                    if (key === 'Enter') player1State.start = true;

                    // P2: Arrows + I/O/U/P/Numpad Enter
                    if (key === 'ArrowUp') player2State.up = true;
                    if (key === 'ArrowDown') player2State.down = true;
                    if (key === 'ArrowLeft') player2State.left = true;
                    if (key === 'ArrowRight') player2State.right = true;
                    if (key === 'i' || key === 'I' || key === '1') player2State.a = true;
                    if (key === 'o' || key === 'O' || key === '3') player2State.b = true;
                    if (key === 'u' || key === 'U' || key === '0') player2State.z = true;
                    if (key === 'p' || key === 'P' || key === '5') player2State.r = true;
                    if (key === ']') player2State.start = true;

                    this.setPlayer1State(player1State);
                    this.setPlayer2State(player2State);
                    return;
                }

                // Standard Single Host / Netplay Host Mode:
                // Universal keys for Player 1:
                if (key === 'ArrowUp' || key === 'w' || key === 'W') player1State.up = true;
                if (key === 'ArrowDown' || key === 's' || key === 'S') player1State.down = true;
                if (key === 'ArrowLeft' || key === 'a' || key === 'A') player1State.left = true;
                if (key === 'ArrowRight' || key === 'd' || key === 'D') player1State.right = true;

                // Accelerate (A)
                if (key === ' ' || key === 'x' || key === 'X' || key === 'j' || key === 'J') player1State.a = true;

                // Brake (B)
                if (key === 'z' || key === 'Z' || key === 'c' || key === 'C' || key === 'k' || key === 'K') player1State.b = true;

                // Item (Z)
                if (key === 'Shift' || key === 'q' || key === 'Q' || key === 'u' || key === 'U') player1State.z = true;

                // Hop / Drift (R)
                if (key === 'e' || key === 'E' || key === 'r' || key === 'R' || key === 'i' || key === 'I') player1State.r = true;

                // Start
                if (key === 'Enter' || key === 'Escape') player1State.start = true;

                this.setPlayer1State(player1State);
            });

            window.addEventListener('keyup', (e) => {
                if (window.isGuestMode) return;

                const key = e.key;

                if (this.local2PlayerEnabled) {
                    if (key === 'w' || key === 'W') player1State.up = false;
                    if (key === 's' || key === 'S') player1State.down = false;
                    if (key === 'a' || key === 'A') player1State.left = false;
                    if (key === 'd' || key === 'D') player1State.right = false;
                    if (key === ' ' || key === 'x' || key === 'X') player1State.a = false;
                    if (key === 'c' || key === 'C' || key === 'z' || key === 'Z') player1State.b = false;
                    if (key === 'q' || key === 'Q') player1State.z = false;
                    if (key === 'e' || key === 'E') player1State.r = false;
                    if (key === 'Enter') player1State.start = false;

                    if (key === 'ArrowUp') player2State.up = false;
                    if (key === 'ArrowDown') player2State.down = false;
                    if (key === 'ArrowLeft') player2State.left = false;
                    if (key === 'ArrowRight') player2State.right = false;
                    if (key === 'i' || key === 'I' || key === '1') player2State.a = false;
                    if (key === 'o' || key === 'O' || key === '3') player2State.b = false;
                    if (key === 'u' || key === 'U' || key === '0') player2State.z = false;
                    if (key === 'p' || key === 'P' || key === '5') player2State.r = false;
                    if (key === ']') player2State.start = false;

                    this.setPlayer1State(player1State);
                    this.setPlayer2State(player2State);
                    return;
                }

                if (key === 'ArrowUp' || key === 'w' || key === 'W') player1State.up = false;
                if (key === 'ArrowDown' || key === 's' || key === 'S') player1State.down = false;
                if (key === 'ArrowLeft' || key === 'a' || key === 'A') player1State.left = false;
                if (key === 'ArrowRight' || key === 'd' || key === 'D') player1State.right = false;

                if (key === ' ' || key === 'x' || key === 'X' || key === 'j' || key === 'J') player1State.a = false;
                if (key === 'z' || key === 'Z' || key === 'c' || key === 'C' || key === 'k' || key === 'K') player1State.b = false;
                if (key === 'Shift' || key === 'q' || key === 'Q' || key === 'u' || key === 'U') player1State.z = false;
                if (key === 'e' || key === 'E' || key === 'r' || key === 'R' || key === 'i' || key === 'I') player1State.r = false;
                if (key === 'Enter' || key === 'Escape') player1State.start = false;

                this.setPlayer1State(player1State);
            });
        }
    };

    window.ControllerManager.initKeyboard();
})();
