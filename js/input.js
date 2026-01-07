import * as THREE from 'three';

export class InputManager {
    constructor(canvas, game) {
        this.canvas = canvas;
        this.game = game;

        // Key states
        this.keys = {
            w: false,
            a: false,
            s: false,
            d: false,
            ' ': false, // spacebar
            shift: false,
            arrowup: false,
            arrowdown: false,
            arrowleft: false,
            arrowright: false
        };

        // Mouse state
        this.mouseX = 0;
        this.mouseY = 0;
        this.leftMouseDown = false;
        this.rightMouseDown = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        // Mouse world position (for ability aiming)
        this.mouseWorldPos = new THREE.Vector3();
        this.raycaster = new THREE.Raycaster();
        this.mouseNDC = new THREE.Vector2();

        // Ability aiming state
        this.aimingAbility = null; // 'q', 'f', etc.

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Keyboard events
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));

        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        document.addEventListener('mouseup', (e) => this.onMouseUp(e));
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        document.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });

        // Prevent context menu on right click
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    onKeyDown(e) {
        const key = e.key.toLowerCase();

        // Movement keys
        if (key in this.keys) {
            this.keys[key] = true;
        }

        // Handle special keys
        switch (key) {
            case 'tab':
                e.preventDefault();
                this.game.targetClosestEnemy();
                break;

            case 'escape':
                this.game.clearTarget();
                break;

            case 'q':
                // Q ability - Cleave (Warrior) / Blizzard (Mage) - hold to aim
                if (this.game.selectedClass === 'mage') {
                    // Start aiming blizzard (check cooldown)
                    if (this.game.player.abilities.blizzard?.cooldownRemaining <= 0) {
                        this.aimingAbility = 'q';
                        if (this.game.player.showBlizzardIndicator) {
                            this.game.player.showBlizzardIndicator(true);
                        }
                    }
                } else {
                    // Start aiming cleave (check cooldown)
                    if (this.game.player.abilities.cleave.cooldownRemaining <= 0) {
                        this.aimingAbility = 'q';
                        if (this.game.player.showCleaveIndicator) {
                            this.game.player.showCleaveIndicator(true);
                        }
                    }
                }
                break;

            case 'f':
                // F ability - Whirlwind (Warrior) / Flame Wave (Mage)
                if (this.game.selectedClass === 'mage') {
                    // Start aiming flame wave
                    this.aimingAbility = 'f';
                    if (this.game.player.showFlameWaveIndicator) {
                        this.game.player.showFlameWaveIndicator(true);
                    }
                } else {
                    // Whirlwind uses direction to mouse
                    const direction = {
                        x: this.mouseWorldPos.x - this.game.player.position.x,
                        z: this.mouseWorldPos.z - this.game.player.position.z
                    };
                    this.game.player.useWhirlwind(direction);
                }
                break;

            case 'e':
                // E ability - Parry (Warrior) / Burn Aura (Mage)
                if (this.game.selectedClass === 'mage') {
                    this.game.player.toggleBurnAura();
                } else {
                    this.game.player.useParry();
                }
                break;

            case 'r':
                // R ability - Heroic Leap (Warrior) / Backstep (Mage)
                if (this.game.selectedClass === 'mage') {
                    this.game.player.useBackstep();
                } else {
                    // Start aiming heroic leap (check cooldown)
                    if (this.game.player.abilities.heroicLeap.cooldownRemaining <= 0) {
                        this.aimingAbility = 'r';
                        if (this.game.player.showHeroicLeapIndicator) {
                            this.game.player.showHeroicLeapIndicator(true);
                        }
                    }
                }
                break;

            case 'c':
                // C ability - Sunder (Warrior only) - hold to aim
                if (this.game.selectedClass !== 'mage') {
                    // Only show indicator if not on cooldown
                    if (this.game.player.abilities.sunder.cooldownRemaining <= 0) {
                        this.aimingAbility = 'c';
                        if (this.game.player.showSunderIndicator) {
                            this.game.player.showSunderIndicator(true);
                        }
                    }
                }
                break;

            case '1':
                this.game.player.usePotion();
                break;
        }
    }

    onKeyUp(e) {
        const key = e.key.toLowerCase();

        if (key in this.keys) {
            this.keys[key] = false;
        }

        // Fire aimed abilities on key release
        if (this.aimingAbility === key) {
            this.fireAimedAbility(key);
            this.aimingAbility = null;
        }
    }

    fireAimedAbility(key) {
        if (!this.game.player) return;

        // Calculate direction from player to mouse
        const direction = {
            x: this.mouseWorldPos.x - this.game.player.position.x,
            z: this.mouseWorldPos.z - this.game.player.position.z
        };

        switch (key) {
            case 'q':
                if (this.game.selectedClass === 'mage') {
                    // Fire blizzard at mouse position
                    if (this.game.player.showBlizzardIndicator) {
                        this.game.player.showBlizzardIndicator(false);
                    }
                    this.game.player.useBlizzard(this.mouseWorldPos.clone());
                } else {
                    // Fire cleave toward mouse
                    if (this.game.player.showCleaveIndicator) {
                        this.game.player.showCleaveIndicator(false);
                    }
                    this.game.player.useCleave(this.game.enemies, direction);
                }
                break;

            case 'f':
                if (this.game.selectedClass === 'mage') {
                    // Fire flame wave toward mouse
                    if (this.game.player.showFlameWaveIndicator) {
                        this.game.player.showFlameWaveIndicator(false);
                    }
                    this.game.player.useFlameWave(this.game.enemies, direction);
                }
                break;

            case 'r':
                if (this.game.selectedClass !== 'mage') {
                    // Fire heroic leap to mouse position
                    if (this.game.player.showHeroicLeapIndicator) {
                        this.game.player.showHeroicLeapIndicator(false);
                    }
                    this.game.player.useHeroicLeap(this.mouseWorldPos.clone());
                }
                break;

            case 'c':
                if (this.game.selectedClass !== 'mage') {
                    // Fire sunder toward mouse
                    if (this.game.player.showSunderIndicator) {
                        this.game.player.showSunderIndicator(false);
                    }
                    this.game.player.useSunder(direction);
                }
                break;
        }
    }

    onMouseDown(e) {
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;

        if (e.button === 0) { // Left click - attack
            this.leftMouseDown = true;
        } else if (e.button === 2) { // Right click - camera rotation
            this.rightMouseDown = true;
            this.game.cameraController.startDrag(e.clientX);
        }
    }

    onMouseUp(e) {
        if (e.button === 0) {
            // Left click attack
            if (this.leftMouseDown && !this.wasDragging) {
                this.game.player.performAutoAttack();
            }
            this.leftMouseDown = false;
        } else if (e.button === 2) {
            this.rightMouseDown = false;
            this.game.cameraController.endDrag();
        }
        this.wasDragging = false;
    }

    onMouseMove(e) {
        const deltaX = e.clientX - this.lastMouseX;
        const deltaY = e.clientY - this.lastMouseY;

        // Track if we're dragging
        if ((this.leftMouseDown || this.rightMouseDown) && (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2)) {
            this.wasDragging = true;
        }

        // Right click drag: rotate camera horizontally (pitch is locked)
        if (this.rightMouseDown) {
            this.game.cameraController.updateDrag(e.clientX);
        }

        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;

        // Update mouse world position for ability aiming
        this.updateMouseWorldPosition(e);

        // Update ability indicators while aiming
        if (this.aimingAbility && this.game.player) {
            if (this.aimingAbility === 'q') {
                if (this.game.selectedClass === 'mage') {
                    if (this.game.player.updateBlizzardIndicator) {
                        this.game.player.updateBlizzardIndicator(this.mouseWorldPos);
                    }
                } else {
                    if (this.game.player.updateCleaveIndicator) {
                        this.game.player.updateCleaveIndicator(this.mouseWorldPos);
                    }
                }
            } else if (this.aimingAbility === 'f') {
                if (this.game.player.updateFlameWaveIndicator) {
                    this.game.player.updateFlameWaveIndicator(this.mouseWorldPos);
                }
            } else if (this.aimingAbility === 'r') {
                if (this.game.player.updateHeroicLeapIndicator) {
                    this.game.player.updateHeroicLeapIndicator(this.mouseWorldPos);
                }
            } else if (this.aimingAbility === 'c') {
                if (this.game.player.updateSunderIndicator) {
                    this.game.player.updateSunderIndicator(this.mouseWorldPos);
                }
            }
        }
    }

    updateMouseWorldPosition(e) {
        if (!this.game.camera) return;

        // Convert mouse to NDC
        const rect = this.canvas.getBoundingClientRect();
        this.mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        // Raycast to ground plane (y = 0)
        this.raycaster.setFromCamera(this.mouseNDC, this.game.camera);
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this.raycaster.ray.intersectPlane(groundPlane, this.mouseWorldPos);
    }

    onWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 1 : -1;
        this.game.cameraController.handleScroll(delta);
    }

    // Check if any mouse button is held for camera rotation
    isRotating() {
        return this.leftMouseDown || this.rightMouseDown;
    }
}
