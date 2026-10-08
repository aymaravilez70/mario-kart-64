/**
 * Mario Kart 64 Web - Virtual Gamepad & Controller Manager
 * Emulates 2 N64 Controllers via standard HTML5 Gamepad API proxy
 * Allows Player 1 (Host keyboard/gamepad) and Player 2 (Guest via WebRTC or local P2)
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

    navigator.getGamepads = function() {
        const result = [null, null, null, null];
        const real = nativeGetGamepads ? Array.from(nativeGetGamepads()) : [];

        // Player 1: If user has a real physical gamepad connected, use it; otherwise provide virtual pad 0
        if (real[0] && real[0].connected) {
            result[0] = real[0];
        } else {
            virtualGamepads[0].timestamp = performance.now();
            result[0] = virtualGamepads[0];
        }

        // Player 2: Virtual Gamepad 1 (receives inputs from WebRTC guest or local P2 keyboard)
        virtualGamepads[1].timestamp = performance.now();
        result[1] = virtualGamepads[1];

        // Players 3 and 4 (if real physical controllers exist)
        if (real[2]) result[2] = real[2];
        if (real[3]) result[3] = real[3];

        return result;
    };

    window.ControllerManager = {
        virtualGamepads: virtualGamepads,
        local2PlayerEnabled: false,

        setPlayer2State: function(state) {
            if (!state) return;
            const pad = virtualGamepads[1];

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
            if (state.stickX !== undefined) {
                ax = state.stickX;
            } else if (state.left) {
                ax = -1.0;
            } else if (state.right) {
                ax = 1.0;
            }

            let ay = 0;
            if (state.stickY !== undefined) {
                ay = state.stickY;
            } else if (state.up) {
                ay = -1.0;
            } else if (state.down) {
                ay = 1.0;
            }

            pad.axes[0] = ax;
            pad.axes[1] = ay;
            pad.timestamp = performance.now();
        },

        resetPlayer2: function() {
            this.setPlayer2State({
                a: false, b: false, z: false, r: false, l: false,
                start: false, up: false, down: false, left: false, right: false,
                stickX: 0, stickY: 0
            });
        },

        // Local 2-Player keyboard state tracker
        localP2State: {
            up: false, down: false, left: false, right: false,
            a: false, b: false, z: false, r: false, start: false,
            stickX: 0, stickY: 0
        },

        initLocal2PlayerKeyboard: function() {
            window.addEventListener('keydown', (e) => {
                if (!this.local2PlayerEnabled) return;
                let changed = false;

                // Player 2 Local Keys:
                // Arrows = Steer
                // Numpad 1 or I = A (Accel)
                // Numpad 2 or O = B (Brake)
                // Numpad 0 or U = Z (Item)
                // Numpad 3 or P = R (Drift)
                // Numpad Enter or ] = Start
                const key = e.key;
                if (key === 'ArrowUp' || key === '8') { this.localP2State.up = true; changed = true; }
                if (key === 'ArrowDown' || key === '2') { this.localP2State.down = true; changed = true; }
                if (key === 'ArrowLeft' || key === '4') { this.localP2State.left = true; changed = true; }
                if (key === 'ArrowRight' || key === '6') { this.localP2State.right = true; changed = true; }
                if (key === '1' || key === 'i' || key === 'I') { this.localP2State.a = true; changed = true; }
                if (key === '3' || key === 'o' || key === 'O') { this.localP2State.b = true; changed = true; }
                if (key === '0' || key === 'u' || key === 'U') { this.localP2State.z = true; changed = true; }
                if (key === '5' || key === 'p' || key === 'P') { this.localP2State.r = true; changed = true; }
                if (key === 'Enter' && e.location === 3 /* Numpad Enter */ || key === ']') { this.localP2State.start = true; changed = true; }

                if (changed) {
                    this.setPlayer2State(this.localP2State);
                }
            });

            window.addEventListener('keyup', (e) => {
                if (!this.local2PlayerEnabled) return;
                let changed = false;

                const key = e.key;
                if (key === 'ArrowUp' || key === '8') { this.localP2State.up = false; changed = true; }
                if (key === 'ArrowDown' || key === '2') { this.localP2State.down = false; changed = true; }
                if (key === 'ArrowLeft' || key === '4') { this.localP2State.left = false; changed = true; }
                if (key === 'ArrowRight' || key === '6') { this.localP2State.right = false; changed = true; }
                if (key === '1' || key === 'i' || key === 'I') { this.localP2State.a = false; changed = true; }
                if (key === '3' || key === 'o' || key === 'O') { this.localP2State.b = false; changed = true; }
                if (key === '0' || key === 'u' || key === 'U') { this.localP2State.z = false; changed = true; }
                if (key === '5' || key === 'p' || key === 'P') { this.localP2State.r = false; changed = true; }
                if (key === 'Enter' && e.location === 3 || key === ']') { this.localP2State.start = false; changed = true; }

                if (changed) {
                    this.setPlayer2State(this.localP2State);
                }
            });
        }
    };

    window.ControllerManager.initLocal2PlayerKeyboard();
})();
