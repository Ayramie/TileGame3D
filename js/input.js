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

        // Mouse velocity tracking for cooking flicks
        this.mouseVelocityY = 0;
        this.lastMouseMoveTime = 0;
        this.prevMouseY = 0;

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

        // Check for QTE minigame input first (fishing)
        if (this.game.fishingLake?.minigame?.state === 'qte') {
            if (['w', 'a', 's', 'd'].includes(key)) {
                e.preventDefault();
                this.game.handleQTEKeyPress(key);
                return;
            }
        }

        // Check for mining minigame input (SPACE to swing)
        if (this.game.mine?.minigame && key === ' ') {
            e.preventDefault();
            this.game.handleMiningSwing();
            return;
        }

        // Check for chopping minigame input (SPACE to swing)
        if (this.game.trees?.minigame && key === ' ') {
            e.preventDefault();
            this.game.handleChoppingSwing();
            return;
        }

        // Movement keys (only if not in QTE)
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
                // Q ability - Cleave (Warrior) / Blizzard (Mage) / Arrow Wave (Hunter)
                if (this.game.selectedClass === 'mage') {
                    if (this.game.player.abilities.blizzard?.cooldownRemaining <= 0) {
                        this.aimingAbility = 'q';
                        if (this.game.player.showBlizzardIndicator) {
                            this.game.player.showBlizzardIndicator(true);
                        }
                    }
                } else if (this.game.selectedClass === 'hunter') {
                    if (this.game.player.abilities.arrowWave?.cooldownRemaining <= 0) {
                        this.aimingAbility = 'q';
                        if (this.game.player.showArrowWaveIndicator) {
                            this.game.player.showArrowWaveIndicator(true);
                        }
                    }
                } else if (this.game.selectedClass === 'adventurer') {
                    // Fire directly without cooldown pre-checks - abilities handle their own cooldowns
                    const weaponType = this.game.player.currentWeaponType;
                    const direction = {
                        x: this.mouseWorldPos.x - this.game.player.position.x,
                        z: this.mouseWorldPos.z - this.game.player.position.z
                    };
                    if (weaponType === 'staff') {
                        this.game.player.useBlizzard(this.mouseWorldPos.clone());
                    } else if (weaponType === 'bow') {
                        this.game.player.useArrowWave(direction);
                    } else if (weaponType === 'sword' || weaponType === 'dagger') {
                        this.game.player.useCleave(this.game.enemies, direction);
                    }
                } else {
                    if (this.game.player.abilities.cleave.cooldownRemaining <= 0) {
                        this.aimingAbility = 'q';
                        if (this.game.player.showCleaveIndicator) {
                            this.game.player.showCleaveIndicator(true);
                        }
                    }
                }
                break;

            case 'f':
                // Check for NPC interaction first (adventure mode)
                if (this.game.nearbyNPC && !this.game.isDialogOpen()) {
                    this.game.interactWithNPC();
                    break;
                }

                // Check for fishing interactions first
                if (this.game.fishingLake?.isNearLake && !this.game.fishingLake?.isFishing) {
                    // Start fishing
                    this.game.startFishing();
                    break;
                } else if (this.game.fishingLake?.minigame?.state === 'bite') {
                    // Hook the fish on bite - starts QTE minigame
                    this.game.fishingAction();
                    break;
                } else if (this.game.fishingLake?.minigame?.state === 'qte') {
                    // Ignore F during QTE (use WASD)
                    break;
                }

                // Check for campfire cooking interaction
                if (this.game.campfire?.isNearCampfire && !this.game.campfire?.isCooking) {
                    this.game.startCooking();
                    break;
                } else if (this.game.campfire?.isCooking) {
                    // Ignore F during cooking
                    break;
                }

                // Check for mine interaction
                if (this.game.mine?.isNearMine && !this.game.mine?.isMining) {
                    this.game.startMining();
                    break;
                } else if (this.game.mine?.isMining) {
                    // Ignore F during mining
                    break;
                }

                // Check for tree chopping interaction
                if (this.game.trees?.isNearTrees && !this.game.trees?.isChopping) {
                    this.game.startChopping();
                    break;
                } else if (this.game.trees?.isChopping) {
                    // Ignore F during chopping
                    break;
                }

                // Check for crafting bench interaction
                if (this.game.craftingBench?.isNearBench && !this.game.craftingBench?.isCrafting) {
                    this.game.startCrafting();
                    break;
                } else if (this.game.craftingBench?.isCrafting) {
                    // Ignore F during crafting
                    break;
                }

                // Check for smelter interaction
                if (this.game.smelter?.isNearSmelter && !this.game.smelter?.isSmelting) {
                    this.game.startSmelting();
                    break;
                } else if (this.game.smelter?.isSmelting) {
                    // Ignore F during smelting
                    break;
                }

                // Check for anvil interaction
                if (this.game.anvil?.isNearAnvil && !this.game.anvil?.isForging) {
                    this.game.startAnvilCrafting();
                    break;
                } else if (this.game.anvil?.isForging) {
                    // Ignore F during forging
                    break;
                }

                // F ability - Whirlwind (Warrior) / Flame Wave (Mage) / Spin Dash (Hunter)
                if (this.game.selectedClass === 'mage') {
                    this.aimingAbility = 'f';
                    if (this.game.player.showFlameWaveIndicator) {
                        this.game.player.showFlameWaveIndicator(true);
                    }
                } else if (this.game.selectedClass === 'hunter') {
                    // Spin dash toward mouse direction
                    const direction = {
                        x: this.mouseWorldPos.x - this.game.player.position.x,
                        z: this.mouseWorldPos.z - this.game.player.position.z
                    };
                    this.game.player.useSpinDash(direction);
                } else if (this.game.selectedClass === 'adventurer') {
                    const weaponType = this.game.player.currentWeaponType;
                    const direction = {
                        x: this.mouseWorldPos.x - this.game.player.position.x,
                        z: this.mouseWorldPos.z - this.game.player.position.z
                    };
                    if (weaponType === 'staff') {
                        this.aimingAbility = 'f';
                    } else if (weaponType === 'bow') {
                        this.game.player.useSpinDash(direction);
                    } else if (weaponType === 'sword' || weaponType === 'dagger') {
                        this.game.player.useWhirlwind(direction);
                    }
                } else {
                    const direction = {
                        x: this.mouseWorldPos.x - this.game.player.position.x,
                        z: this.mouseWorldPos.z - this.game.player.position.z
                    };
                    this.game.player.useWhirlwind(direction);
                }
                break;

            case 'e':
                // E ability - Parry (Warrior) / Frost Nova (Mage) / Shotgun (Hunter)
                if (this.game.selectedClass === 'mage') {
                    this.game.player.useFrostNova();
                } else if (this.game.selectedClass === 'hunter') {
                    if (this.game.player.abilities.shotgun?.cooldownRemaining <= 0) {
                        this.aimingAbility = 'e';
                        if (this.game.player.showShotgunIndicator) {
                            this.game.player.showShotgunIndicator(true);
                        }
                    }
                } else if (this.game.selectedClass === 'adventurer') {
                    // Fire directly without cooldown pre-checks
                    const weaponType = this.game.player.currentWeaponType;
                    const direction = {
                        x: this.mouseWorldPos.x - this.game.player.position.x,
                        z: this.mouseWorldPos.z - this.game.player.position.z
                    };
                    if (weaponType === 'staff') {
                        this.game.player.useFrostNova();
                    } else if (weaponType === 'bow') {
                        this.game.player.useShotgun(direction);
                    } else if (weaponType === 'sword' || weaponType === 'dagger') {
                        this.game.player.useParry();
                    }
                } else {
                    this.game.player.useParry();
                }
                break;

            case 'r':
                // R ability - Heroic Leap (Warrior) / Blink (Mage) / Trap (Hunter)
                if (this.game.selectedClass === 'mage') {
                    const direction = {
                        x: this.mouseWorldPos.x - this.game.player.position.x,
                        z: this.mouseWorldPos.z - this.game.player.position.z
                    };
                    this.game.player.useBackstep(direction);
                } else if (this.game.selectedClass === 'hunter') {
                    // Throw trap instantly to mouse position
                    this.game.player.useTrap(this.mouseWorldPos.clone());
                } else if (this.game.selectedClass === 'adventurer') {
                    // Fire directly without cooldown pre-checks
                    const weaponType = this.game.player.currentWeaponType;
                    const direction = {
                        x: this.mouseWorldPos.x - this.game.player.position.x,
                        z: this.mouseWorldPos.z - this.game.player.position.z
                    };
                    if (weaponType === 'staff') {
                        this.game.player.useBackstep(direction);
                    } else if (weaponType === 'bow') {
                        this.game.player.useTrap(this.mouseWorldPos.clone());
                    } else if (weaponType === 'sword' || weaponType === 'dagger') {
                        this.game.player.useHeroicLeap(this.mouseWorldPos.clone());
                    }
                } else {
                    if (this.game.player.abilities.heroicLeap.cooldownRemaining <= 0) {
                        this.aimingAbility = 'r';
                        if (this.game.player.showHeroicLeapIndicator) {
                            this.game.player.showHeroicLeapIndicator(true);
                        }
                    }
                }
                break;

            case 'c':
                // C ability - Sunder (Warrior) / Frozen Orb (Mage) / Giant Arrow (Hunter)
                if (this.game.selectedClass === 'mage') {
                    if (this.game.player.abilities.frozenOrb.cooldownRemaining <= 0) {
                        const direction = {
                            x: this.mouseWorldPos.x - this.game.player.position.x,
                            z: this.mouseWorldPos.z - this.game.player.position.z
                        };
                        this.game.player.useFrozenOrb(direction);
                    }
                } else if (this.game.selectedClass === 'hunter') {
                    if (this.game.player.abilities.giantArrow?.cooldownRemaining <= 0) {
                        this.aimingAbility = 'c';
                        if (this.game.player.showGiantArrowIndicator) {
                            this.game.player.showGiantArrowIndicator(true);
                        }
                    }
                } else if (this.game.selectedClass === 'adventurer') {
                    // Fire directly without cooldown pre-checks
                    const weaponType = this.game.player.currentWeaponType;
                    const direction = {
                        x: this.mouseWorldPos.x - this.game.player.position.x,
                        z: this.mouseWorldPos.z - this.game.player.position.z
                    };
                    if (weaponType === 'staff') {
                        this.game.player.useFrozenOrb(direction);
                    } else if (weaponType === 'bow') {
                        this.game.player.useGiantArrow(direction);
                    }
                    // Sword/dagger has no 5th ability for Adventurer
                } else {
                    if (this.game.player.abilities.sunder.cooldownRemaining <= 0) {
                        this.aimingAbility = 'c';
                        if (this.game.player.showSunderIndicator) {
                            this.game.player.showSunderIndicator(true);
                        }
                    }
                }
                break;

            // Inventory toggle
            case 'i':
                if (this.game.inventoryUI) {
                    this.game.inventoryUI.toggle();
                }
                break;

            // Hotbar slots (1-5)
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
                if (this.game.inventoryUI) {
                    const slotIndex = parseInt(key) - 1;
                    this.game.inventoryUI.useHotbarSlot(slotIndex);
                }
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

        // For adventurer, get weapon type to determine which ability to use
        const isAdventurer = this.game.selectedClass === 'adventurer';
        const weaponType = isAdventurer ? this.game.player.currentWeaponType : null;

        switch (key) {
            case 'q':
                if (this.game.selectedClass === 'mage' || (isAdventurer && weaponType === 'staff')) {
                    if (this.game.player.showBlizzardIndicator) {
                        this.game.player.showBlizzardIndicator(false);
                    }
                    this.game.player.useBlizzard(this.mouseWorldPos.clone());
                } else if (this.game.selectedClass === 'hunter' || (isAdventurer && weaponType === 'bow')) {
                    if (this.game.player.showArrowWaveIndicator) {
                        this.game.player.showArrowWaveIndicator(false);
                    }
                    this.game.player.useArrowWave(direction);
                } else if (!isAdventurer || weaponType === 'sword' || weaponType === 'dagger') {
                    if (this.game.player.showCleaveIndicator) {
                        this.game.player.showCleaveIndicator(false);
                    }
                    this.game.player.useCleave(this.game.enemies, direction);
                }
                break;

            case 'f':
                if (this.game.selectedClass === 'mage' || (isAdventurer && weaponType === 'staff')) {
                    if (this.game.player.showFlameWaveIndicator) {
                        this.game.player.showFlameWaveIndicator(false);
                    }
                    this.game.player.useFlameWave(this.game.enemies, direction);
                }
                break;

            case 'e':
                if (this.game.selectedClass === 'hunter' || (isAdventurer && weaponType === 'bow')) {
                    if (this.game.player.showShotgunIndicator) {
                        this.game.player.showShotgunIndicator(false);
                    }
                    this.game.player.useShotgun(direction);
                }
                break;

            case 'r':
                if (this.game.selectedClass === 'warrior' || (isAdventurer && (weaponType === 'sword' || weaponType === 'dagger'))) {
                    if (this.game.player.showHeroicLeapIndicator) {
                        this.game.player.showHeroicLeapIndicator(false);
                    }
                    this.game.player.useHeroicLeap(this.mouseWorldPos.clone());
                }
                break;

            case 'c':
                if (this.game.selectedClass === 'hunter' || (isAdventurer && weaponType === 'bow')) {
                    if (this.game.player.showGiantArrowIndicator) {
                        this.game.player.showGiantArrowIndicator(false);
                    }
                    this.game.player.useGiantArrow(direction);
                } else if (this.game.selectedClass === 'warrior') {
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

        if (e.button === 0) { // Left click - attack or click-to-move
            this.leftMouseDown = true;
            this.leftClickStartX = e.clientX;
            this.leftClickStartY = e.clientY;
        } else if (e.button === 2) { // Right click - camera rotation or target enemy
            this.rightMouseDown = true;
            this.rightClickStartX = e.clientX;
            this.rightClickStartY = e.clientY;
            this.game.cameraController.startDrag(e.clientX);
        }
    }

    onMouseUp(e) {
        if (e.button === 0) {
            // Left click - attack or click-to-move
            if (this.leftMouseDown && !this.wasDragging) {
                // Check if clicked on an enemy first
                const clickedEnemy = this.raycastEnemy(e);
                if (clickedEnemy) {
                    // Attack the clicked enemy (if in range) or target it
                    if (this.game.player.targetEnemy !== clickedEnemy) {
                        this.game.player.setTarget(clickedEnemy);
                    }
                    this.game.player.performAutoAttack();
                } else {
                    // Click-to-move to ground position
                    this.updateMouseWorldPosition(e);
                    if (this.mouseWorldPos && this.game.player.setMoveTarget) {
                        this.game.player.setMoveTarget(this.mouseWorldPos.clone());
                    }
                }
            }
            this.leftMouseDown = false;
        } else if (e.button === 2) {
            // Right click - check if it was a click (not drag) to target enemy
            if (!this.wasDragging) {
                const clickedEnemy = this.raycastEnemy(e);
                if (clickedEnemy) {
                    this.game.player.setTarget(clickedEnemy);
                }
            }
            this.rightMouseDown = false;
            this.game.cameraController.endDrag();
        }
        this.wasDragging = false;
    }

    // Raycast to find enemy under mouse cursor
    raycastEnemy(e) {
        if (!this.game.camera || !this.game.enemies) return null;

        // Update mouse NDC
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), this.game.camera);

        // Collect all enemy meshes
        const enemyMeshes = [];
        for (const enemy of this.game.enemies) {
            if (enemy.isAlive && enemy.mesh) {
                enemyMeshes.push(enemy.mesh);
            }
        }

        // Raycast against enemy meshes
        const intersects = this.raycaster.intersectObjects(enemyMeshes, true);

        if (intersects.length > 0) {
            // Find which enemy this mesh belongs to
            const hitObject = intersects[0].object;
            for (const enemy of this.game.enemies) {
                if (!enemy.isAlive || !enemy.mesh) continue;

                // Check if the hit object is part of this enemy's mesh
                let isMatch = enemy.mesh === hitObject;
                if (!isMatch) {
                    enemy.mesh.traverse((child) => {
                        if (child === hitObject) isMatch = true;
                    });
                }

                if (isMatch) return enemy;
            }
        }

        return null;
    }

    onMouseMove(e) {
        const deltaX = e.clientX - this.lastMouseX;
        const deltaY = e.clientY - this.lastMouseY;

        // Track mouse velocity for cooking flicks
        const now = performance.now();
        const dt = now - this.lastMouseMoveTime;
        if (dt > 0) {
            // Velocity is negative when moving up (clientY decreases going up)
            this.mouseVelocityY = (e.clientY - this.prevMouseY) / Math.max(dt, 1);
        }
        this.prevMouseY = e.clientY;
        this.lastMouseMoveTime = now;

        // Handle cooking minigame mouse movement
        if (this.game.campfire?.isCooking && this.game.campfire?.minigame) {
            this.game.handleCookingMouseMove(e.clientX, e.clientY);

            // Check for upward flick (fast upward mouse movement)
            // velocityY negative = upward movement
            if (this.mouseVelocityY < -1.5) {
                this.game.handleCookingFlick(-this.mouseVelocityY);
            }
        }

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
                } else if (this.game.selectedClass === 'hunter') {
                    if (this.game.player.updateArrowWaveIndicator) {
                        this.game.player.updateArrowWaveIndicator(this.mouseWorldPos);
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
            } else if (this.aimingAbility === 'e') {
                if (this.game.selectedClass === 'hunter') {
                    if (this.game.player.updateShotgunIndicator) {
                        this.game.player.updateShotgunIndicator(this.mouseWorldPos);
                    }
                }
            } else if (this.aimingAbility === 'r') {
                if (this.game.player.updateHeroicLeapIndicator) {
                    this.game.player.updateHeroicLeapIndicator(this.mouseWorldPos);
                }
            } else if (this.aimingAbility === 'c') {
                if (this.game.selectedClass === 'hunter') {
                    if (this.game.player.updateGiantArrowIndicator) {
                        this.game.player.updateGiantArrowIndicator(this.mouseWorldPos);
                    }
                } else {
                    if (this.game.player.updateSunderIndicator) {
                        this.game.player.updateSunderIndicator(this.mouseWorldPos);
                    }
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
