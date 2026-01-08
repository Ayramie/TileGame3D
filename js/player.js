import * as THREE from 'three';
import { KayKitCharacter } from './kayKitCharacter.js';
import { WeaponFactory } from './weaponFactory.js';

export class Player {
    constructor(scene, game) {
        this.scene = scene;
        this.game = game; // Reference to game for effects
        this.position = new THREE.Vector3(0, 0, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.rotation = 0; // Y-axis rotation

        // Stats
        this.maxHealth = 500;
        this.health = this.maxHealth;
        this.moveSpeed = 8;
        this.jumpForce = 12;
        this.isGrounded = true;

        // Combat
        this.targetEnemy = null;
        this.attackRange = 2.5;
        this.autoAttackCooldown = 0;
        this.autoAttackCooldownMax = 0.8; // Faster attacks
        this.autoAttackDamage = 25;

        // Abilities - Warrior kit:
        // Q: Cleave (cone damage)
        // F: Whirlwind (360° spin + forward dash)
        // E: Parry (block + counter)
        // R: Heroic Leap (jump to location + AoE)
        // 1: Potion (heal)
        this.abilities = {
            cleave: {
                cooldown: 4,
                cooldownRemaining: 0,
                damage: 45,
                range: 8.0,
                angle: Math.PI * 0.6, // 108 degrees
                isCharging: false,
                isActive: false
            },
            whirlwind: {
                cooldown: 6,
                cooldownRemaining: 0,
                damage: 35,
                range: 3.5,
                dashDistance: 10,
                dashDuration: 0.5,
                isActive: false,
                activeTime: 0,
                dashDirection: null
            },
            parry: {
                cooldown: 5,
                cooldownRemaining: 0,
                damage: 50,
                range: 4, // AoE radius
                spinDuration: 0.4,
                isActive: false,
                activeTime: 0
            },
            heroicLeap: {
                cooldown: 10,
                cooldownRemaining: 0,
                damage: 50,
                stunDuration: 0.8,
                range: 20,
                aoeRadius: 4,
                isActive: false,
                activeTime: 0,
                leapDuration: 0.5,
                targetPos: null,
                startPos: null
            },
            sunder: {
                cooldown: 5,
                cooldownRemaining: 0,
                damage: 40,
                range: 16,
                width: 3.5, // Width of spike wave
                spikeCount: 8, // Number of spikes
                isActive: false,
                activeTime: 0
            },
            potion: {
                cooldown: 12,
                cooldownRemaining: 0,
                healAmount: 100,
                isActive: false
            }
        };

        // KayKit character controller for animated model
        this.character = new KayKitCharacter(scene);
        this.useAnimatedCharacter = false;
        this.characterLoading = false;

        // Click-to-move target
        this.moveTarget = null;
        this.moveTargetThreshold = 0.5; // Distance at which we consider target reached

        // Ability indicators
        this.cleaveIndicator = null;
        this.createAbilityIndicators();

        // Visual representation (fallback)
        this.createMesh();

        // Try to load animated character
        this.loadCharacter();
    }

    createAbilityIndicators() {
        // Cleave cone indicator - use CircleGeometry with theta offset like TileGame-3D
        const ability = this.abilities.cleave;
        const group = new THREE.Group();

        // Offset by -90 degrees so the cone points forward (+Z) when rotation.y = 0
        const angleOffset = -Math.PI / 2;
        const geometry = new THREE.CircleGeometry(ability.range, 32, -ability.angle / 2 + angleOffset, ability.angle);
        const material = new THREE.MeshBasicMaterial({
            color: 0xff6600,
            transparent: true,
            opacity: 0.35,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const cone = new THREE.Mesh(geometry, material);
        cone.rotation.x = -Math.PI / 2;
        cone.position.y = 0.1;
        group.add(cone);

        // Edge highlight
        const edgeGeo = new THREE.RingGeometry(ability.range - 0.15, ability.range, 32, 1, -ability.angle / 2 + angleOffset, ability.angle);
        const edgeMat = new THREE.MeshBasicMaterial({
            color: 0xffaa00,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const edge = new THREE.Mesh(edgeGeo, edgeMat);
        edge.rotation.x = -Math.PI / 2;
        edge.position.y = 0.12;
        group.add(edge);

        group.visible = false;
        this.cleaveIndicator = group;
        this.scene.add(this.cleaveIndicator);

        // Sunder line indicator
        this.createSunderIndicator();
    }

    createSunderIndicator() {
        const ability = this.abilities.sunder;
        const range = ability.range;
        const startWidth = 0.5;
        const endWidth = ability.width * 2; // Gets wider at the end

        const group = new THREE.Group();

        // Create trapezoid shape pointing +Y in 2D, will rotate mesh to lay flat
        const shape = new THREE.Shape();
        shape.moveTo(-startWidth / 2, 0);
        shape.lineTo(-endWidth / 2, range);
        shape.lineTo(endWidth / 2, range);
        shape.lineTo(startWidth / 2, 0);
        shape.lineTo(-startWidth / 2, 0);

        const geometry = new THREE.ShapeGeometry(shape);
        const material = new THREE.MeshBasicMaterial({
            color: 0x886644,
            transparent: true,
            opacity: 0.35,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        const trapezoid = new THREE.Mesh(geometry, material);
        trapezoid.rotation.x = Math.PI / 2; // Lay flat, +Y becomes +Z (forward)
        trapezoid.position.y = 0.1;
        group.add(trapezoid);

        // Edge outline
        const edgeShape = new THREE.Shape();
        edgeShape.moveTo(-startWidth / 2, 0);
        edgeShape.lineTo(-endWidth / 2, range);
        edgeShape.lineTo(endWidth / 2, range);
        edgeShape.lineTo(startWidth / 2, 0);
        edgeShape.lineTo(-startWidth / 2, 0);
        const edgeGeo = new THREE.ShapeGeometry(edgeShape);
        const edgeMat = new THREE.MeshBasicMaterial({
            color: 0xaa8866,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide,
            depthWrite: false,
            wireframe: true
        });
        const edge = new THREE.Mesh(edgeGeo, edgeMat);
        edge.rotation.x = Math.PI / 2;
        edge.position.y = 0.12;
        group.add(edge);

        group.visible = false;
        this.sunderIndicator = group;
        this.scene.add(this.sunderIndicator);

        // Heroic Leap indicator
        this.createHeroicLeapIndicator();
    }

    createHeroicLeapIndicator() {
        const ability = this.abilities.heroicLeap;

        // Range circle (shows max jump range)
        const rangeGeometry = new THREE.RingGeometry(ability.range - 0.2, ability.range, 48);
        const rangeMaterial = new THREE.MeshBasicMaterial({
            color: 0x4488ff,
            transparent: true,
            opacity: 0.2,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        this.leapRangeIndicator = new THREE.Mesh(rangeGeometry, rangeMaterial);
        this.leapRangeIndicator.rotation.x = -Math.PI / 2;
        this.leapRangeIndicator.position.y = 0.1;
        this.leapRangeIndicator.visible = false;
        this.scene.add(this.leapRangeIndicator);

        // Target circle (shows where you'll land and AoE radius)
        const targetGeometry = new THREE.RingGeometry(ability.aoeRadius - 0.2, ability.aoeRadius, 32);
        const targetMaterial = new THREE.MeshBasicMaterial({
            color: 0xff4444,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        this.leapTargetIndicator = new THREE.Mesh(targetGeometry, targetMaterial);
        this.leapTargetIndicator.rotation.x = -Math.PI / 2;
        this.leapTargetIndicator.position.y = 0.12;
        this.leapTargetIndicator.visible = false;
        this.scene.add(this.leapTargetIndicator);

        // Inner target circle (landing spot)
        const innerGeometry = new THREE.CircleGeometry(0.8, 16);
        const innerMaterial = new THREE.MeshBasicMaterial({
            color: 0xffaa00,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        this.leapInnerIndicator = new THREE.Mesh(innerGeometry, innerMaterial);
        this.leapInnerIndicator.rotation.x = -Math.PI / 2;
        this.leapInnerIndicator.position.y = 0.13;
        this.leapInnerIndicator.visible = false;
        this.scene.add(this.leapInnerIndicator);
    }

    showSunderIndicator(show) {
        if (this.sunderIndicator) {
            this.sunderIndicator.visible = show;
        }
    }

    updateSunderIndicator(mouseWorldPos) {
        if (!this.sunderIndicator || !this.sunderIndicator.visible) return;

        // Position at player
        this.sunderIndicator.position.x = this.position.x;
        this.sunderIndicator.position.z = this.position.z;

        // Point toward mouse
        const dx = mouseWorldPos.x - this.position.x;
        const dz = mouseWorldPos.z - this.position.z;
        this.sunderIndicator.rotation.y = -Math.atan2(dx, dz) + Math.PI;
    }

    showHeroicLeapIndicator(show) {
        if (this.leapRangeIndicator) this.leapRangeIndicator.visible = show;
        if (this.leapTargetIndicator) this.leapTargetIndicator.visible = show;
        if (this.leapInnerIndicator) this.leapInnerIndicator.visible = show;
    }

    updateHeroicLeapIndicator(mouseWorldPos) {
        if (!this.leapRangeIndicator || !this.leapRangeIndicator.visible) return;

        const ability = this.abilities.heroicLeap;

        // Position range indicator at player
        this.leapRangeIndicator.position.x = this.position.x;
        this.leapRangeIndicator.position.z = this.position.z;

        // Calculate target position (clamped to range)
        const dx = mouseWorldPos.x - this.position.x;
        const dz = mouseWorldPos.z - this.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        let targetX, targetZ;
        if (dist > ability.range) {
            // Clamp to max range
            const dir = new THREE.Vector3(dx, 0, dz).normalize();
            targetX = this.position.x + dir.x * ability.range;
            targetZ = this.position.z + dir.z * ability.range;
        } else {
            targetX = mouseWorldPos.x;
            targetZ = mouseWorldPos.z;
        }

        // Position target indicators at landing spot
        this.leapTargetIndicator.position.x = targetX;
        this.leapTargetIndicator.position.z = targetZ;
        this.leapInnerIndicator.position.x = targetX;
        this.leapInnerIndicator.position.z = targetZ;
    }

    showCleaveIndicator(show) {
        if (this.cleaveIndicator) {
            this.cleaveIndicator.visible = show;
        }
    }

    updateCleaveIndicator(mouseWorldPos) {
        if (!this.cleaveIndicator || !this.cleaveIndicator.visible) return;

        // Position at player
        this.cleaveIndicator.position.x = this.position.x;
        this.cleaveIndicator.position.z = this.position.z;

        // Point toward mouse (same as TileGame-3D)
        const dx = mouseWorldPos.x - this.position.x;
        const dz = mouseWorldPos.z - this.position.z;
        this.cleaveIndicator.rotation.y = Math.atan2(dx, dz);
    }

    async loadCharacter() {
        this.characterLoading = true;
        // Hide fallback mesh immediately while loading
        this.group.visible = false;

        try {
            // Load KayKit Knight character
            const success = await this.character.load('adventurers', 'knight');
            if (success) {
                this.useAnimatedCharacter = true;
                console.log('Using KayKit Knight character model');

                // Attach sword weapon
                const weapon = WeaponFactory.createWeaponForClass('warrior');
                this.character.attachWeapon(weapon.mesh, 'handR', weapon.offset, weapon.rotation);
            } else {
                // Show fallback if loading failed
                this.group.visible = true;
            }
        } catch (error) {
            console.warn('Failed to load KayKit character, using fallback:', error);
            this.group.visible = true;
        }
        this.characterLoading = false;
    }

    createMesh() {
        this.group = new THREE.Group();

        // Materials
        const skinMaterial = new THREE.MeshStandardMaterial({
            color: 0xffddaa,
            roughness: 0.7
        });
        const armorMaterial = new THREE.MeshStandardMaterial({
            color: 0x4488ff,
            roughness: 0.5,
            metalness: 0.3
        });
        const darkArmorMaterial = new THREE.MeshStandardMaterial({
            color: 0x2255aa,
            roughness: 0.5,
            metalness: 0.3
        });
        const bootMaterial = new THREE.MeshStandardMaterial({
            color: 0x4a3728,
            roughness: 0.8
        });

        // === TORSO ===
        const torsoGeometry = new THREE.BoxGeometry(0.6, 0.7, 0.35);
        const torso = new THREE.Mesh(torsoGeometry, armorMaterial);
        torso.position.y = 1.15;
        torso.castShadow = true;
        this.group.add(torso);

        // Chest plate detail
        const chestGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.1);
        const chest = new THREE.Mesh(chestGeometry, darkArmorMaterial);
        chest.position.set(0, 1.2, 0.2);
        this.group.add(chest);

        // === LEGS ===
        // Left leg
        this.leftLeg = new THREE.Group();
        const leftThighGeometry = new THREE.CapsuleGeometry(0.12, 0.3, 4, 8);
        const leftThigh = new THREE.Mesh(leftThighGeometry, darkArmorMaterial);
        leftThigh.position.y = -0.25;
        this.leftLeg.add(leftThigh);

        const leftShinGeometry = new THREE.CapsuleGeometry(0.1, 0.3, 4, 8);
        const leftShin = new THREE.Mesh(leftShinGeometry, darkArmorMaterial);
        leftShin.position.y = -0.55;
        this.leftLeg.add(leftShin);

        const leftBootGeometry = new THREE.BoxGeometry(0.15, 0.15, 0.25);
        const leftBoot = new THREE.Mesh(leftBootGeometry, bootMaterial);
        leftBoot.position.set(0, -0.78, 0.05);
        this.leftLeg.add(leftBoot);

        this.leftLeg.position.set(-0.15, 0.8, 0);
        this.group.add(this.leftLeg);

        // Right leg
        this.rightLeg = new THREE.Group();
        const rightThighGeometry = new THREE.CapsuleGeometry(0.12, 0.3, 4, 8);
        const rightThigh = new THREE.Mesh(rightThighGeometry, darkArmorMaterial);
        rightThigh.position.y = -0.25;
        this.rightLeg.add(rightThigh);

        const rightShinGeometry = new THREE.CapsuleGeometry(0.1, 0.3, 4, 8);
        const rightShin = new THREE.Mesh(rightShinGeometry, darkArmorMaterial);
        rightShin.position.y = -0.55;
        this.rightLeg.add(rightShin);

        const rightBootGeometry = new THREE.BoxGeometry(0.15, 0.15, 0.25);
        const rightBoot = new THREE.Mesh(rightBootGeometry, bootMaterial);
        rightBoot.position.set(0, -0.78, 0.05);
        this.rightLeg.add(rightBoot);

        this.rightLeg.position.set(0.15, 0.8, 0);
        this.group.add(this.rightLeg);

        // === ARMS ===
        // Left arm (shield arm)
        this.leftArm = new THREE.Group();
        const leftShoulderGeometry = new THREE.SphereGeometry(0.12, 8, 8);
        const leftShoulder = new THREE.Mesh(leftShoulderGeometry, armorMaterial);
        this.leftArm.add(leftShoulder);

        const leftUpperArmGeometry = new THREE.CapsuleGeometry(0.08, 0.25, 4, 8);
        const leftUpperArm = new THREE.Mesh(leftUpperArmGeometry, skinMaterial);
        leftUpperArm.position.y = -0.2;
        this.leftArm.add(leftUpperArm);

        const leftForearmGeometry = new THREE.CapsuleGeometry(0.07, 0.2, 4, 8);
        const leftForearm = new THREE.Mesh(leftForearmGeometry, skinMaterial);
        leftForearm.position.y = -0.42;
        this.leftArm.add(leftForearm);

        // Small shield
        const shieldGeometry = new THREE.BoxGeometry(0.35, 0.45, 0.05);
        const shieldMaterial = new THREE.MeshStandardMaterial({
            color: 0x666688,
            roughness: 0.3,
            metalness: 0.7
        });
        const shield = new THREE.Mesh(shieldGeometry, shieldMaterial);
        shield.position.set(0, -0.45, 0.15);
        this.leftArm.add(shield);

        this.leftArm.position.set(-0.42, 1.35, 0);
        this.leftArm.rotation.z = 0.2;
        this.group.add(this.leftArm);

        // Right arm (sword arm)
        this.rightArm = new THREE.Group();
        const rightShoulderGeometry = new THREE.SphereGeometry(0.12, 8, 8);
        const rightShoulder = new THREE.Mesh(rightShoulderGeometry, armorMaterial);
        this.rightArm.add(rightShoulder);

        const rightUpperArmGeometry = new THREE.CapsuleGeometry(0.08, 0.25, 4, 8);
        const rightUpperArm = new THREE.Mesh(rightUpperArmGeometry, skinMaterial);
        rightUpperArm.position.y = -0.2;
        this.rightArm.add(rightUpperArm);

        const rightForearmGeometry = new THREE.CapsuleGeometry(0.07, 0.2, 4, 8);
        const rightForearm = new THREE.Mesh(rightForearmGeometry, skinMaterial);
        rightForearm.position.y = -0.42;
        this.rightArm.add(rightForearm);

        this.rightArm.position.set(0.42, 1.35, 0);
        this.rightArm.rotation.z = -0.2;
        this.group.add(this.rightArm);

        // === HEAD ===
        const headGeometry = new THREE.SphereGeometry(0.25, 16, 12);
        this.headMesh = new THREE.Mesh(headGeometry, skinMaterial);
        this.headMesh.position.y = 1.7;
        this.headMesh.castShadow = true;
        this.group.add(this.headMesh);

        // Helmet
        const helmetGeometry = new THREE.SphereGeometry(0.28, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6);
        const helmetMaterial = new THREE.MeshStandardMaterial({
            color: 0x4488ff,
            roughness: 0.3,
            metalness: 0.5
        });
        const helmet = new THREE.Mesh(helmetGeometry, helmetMaterial);
        helmet.position.y = 1.75;
        this.group.add(helmet);

        // Eyes (to show facing direction)
        const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const eyeGeometry = new THREE.SphereGeometry(0.04, 8, 8);

        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.08, 1.72, 0.22);
        this.group.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.08, 1.72, 0.22);
        this.group.add(rightEye);

        // === SWORD ===
        const swordGroup = new THREE.Group();

        const bladeGeometry = new THREE.BoxGeometry(0.06, 1.0, 0.02);
        const bladeMaterial = new THREE.MeshStandardMaterial({
            color: 0xdddddd,
            roughness: 0.2,
            metalness: 0.9
        });
        const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
        blade.position.y = 0.5;
        swordGroup.add(blade);

        // Blade tip
        const tipGeometry = new THREE.ConeGeometry(0.03, 0.15, 4);
        const tip = new THREE.Mesh(tipGeometry, bladeMaterial);
        tip.position.y = 1.05;
        swordGroup.add(tip);

        const hiltGeometry = new THREE.BoxGeometry(0.25, 0.06, 0.06);
        const hiltMaterial = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            roughness: 0.4,
            metalness: 0.6
        });
        const hilt = new THREE.Mesh(hiltGeometry, hiltMaterial);
        swordGroup.add(hilt);

        const handleGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8);
        const handleMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const handle = new THREE.Mesh(handleGeometry, handleMaterial);
        handle.position.y = -0.12;
        swordGroup.add(handle);

        // Attach sword to right hand
        swordGroup.position.set(0, -0.55, 0.1);
        swordGroup.rotation.x = -0.3;
        this.swordMesh = swordGroup;
        this.rightArm.add(swordGroup);

        // Animation state
        this.walkCycle = 0;

        this.scene.add(this.group);
    }

    setTarget(enemy) {
        // Clear previous target highlight
        if (this.targetEnemy && this.targetEnemy.setTargeted) {
            this.targetEnemy.setTargeted(false);
        }

        this.targetEnemy = enemy;

        // Set new target highlight
        if (enemy && enemy.setTargeted) {
            enemy.setTargeted(true);
        }
    }

    setMoveTarget(position) {
        this.moveTarget = position;
    }

    clearMoveTarget() {
        this.moveTarget = null;
    }

    update(deltaTime, input, cameraController) {
        // Process movement (pass input to check if mouse turning)
        const isMoving = this.handleMovement(deltaTime, input, cameraController, input.rightMouseDown);

        // Process abilities
        this.updateAbilities(deltaTime);

        // Auto-attack cooldown
        if (this.autoAttackCooldown > 0) {
            this.autoAttackCooldown -= deltaTime;
        }

        // Automatically attack target if in range (unless in movement ability)
        const inMovementAbility = this.abilities.whirlwind.isActive || this.abilities.heroicLeap.isActive;
        if (this.targetEnemy && this.targetEnemy.isAlive && this.autoAttackCooldown <= 0 && !inMovementAbility) {
            const dx = this.targetEnemy.position.x - this.position.x;
            const dz = this.targetEnemy.position.z - this.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist <= this.attackRange) {
                this.performAutoAttack();
            }
        }

        // Update visual position - use animated character if loaded
        if (this.useAnimatedCharacter) {
            this.character.setPosition(this.position.x, this.position.y, this.position.z);
            this.character.setRotation(this.rotation);
            this.character.update(deltaTime, isMoving, true, this.isGrounded);
        } else {
            // Fallback to procedural mesh
            this.group.position.copy(this.position);
            this.group.rotation.y = this.rotation;

            // Walk animation for fallback
            if (isMoving && this.isGrounded) {
                this.walkCycle += deltaTime * 12;
                const legSwing = Math.sin(this.walkCycle) * 0.5;
                const armSwing = Math.sin(this.walkCycle) * 0.3;

                this.leftLeg.rotation.x = legSwing;
                this.rightLeg.rotation.x = -legSwing;
                this.leftArm.rotation.x = -armSwing;
                this.rightArm.rotation.x = armSwing;
            } else {
                this.walkCycle = 0;
                this.leftLeg.rotation.x *= 0.9;
                this.rightLeg.rotation.x *= 0.9;
                this.leftArm.rotation.x *= 0.9;
                this.rightArm.rotation.x *= 0.9;
            }
        }
    }

    handleMovement(deltaTime, input, cameraController, isMouseTurning = false) {
        // Forward/backward movement (W/S)
        const forwardBack = new THREE.Vector3();
        if (input.keys.w || input.keys.arrowup) forwardBack.z -= 1;
        if (input.keys.s || input.keys.arrowdown) forwardBack.z += 1;

        // Strafe movement (A/D) - sideways, no turning
        const strafe = new THREE.Vector3();
        if (input.keys.a || input.keys.arrowleft) strafe.x -= 1;
        if (input.keys.d || input.keys.arrowright) strafe.x += 1;

        // Check if using keyboard movement
        const usingKeyboard = forwardBack.length() > 0 || strafe.length() > 0;

        // Clear move target if using keyboard
        if (usingKeyboard && this.moveTarget) {
            this.clearMoveTarget();
        }

        // Calculate final movement direction
        const moveDir = new THREE.Vector3();
        const cameraYaw = -cameraController.yaw;
        const cos = Math.cos(cameraYaw);
        const sin = Math.sin(cameraYaw);

        // Rotate forward/back by camera yaw
        if (forwardBack.length() > 0) {
            const rotatedZ = forwardBack.z * cos;
            const rotatedX = -forwardBack.z * sin;
            moveDir.x += rotatedX;
            moveDir.z += rotatedZ;
        }

        // Rotate strafe by camera yaw (perpendicular)
        if (strafe.length() > 0) {
            const rotatedX = strafe.x * cos;
            const rotatedZ = strafe.x * sin;
            moveDir.x += rotatedX;
            moveDir.z += rotatedZ;
        }

        let isMoving = false;

        // Save old position for collision resolution
        const oldX = this.position.x;
        const oldZ = this.position.z;

        // Click-to-move: if we have a move target and not using keyboard, move toward it
        if (this.moveTarget && !usingKeyboard) {
            const dx = this.moveTarget.x - this.position.x;
            const dz = this.moveTarget.z - this.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist > this.moveTargetThreshold) {
                // Move toward target
                moveDir.x = dx / dist;
                moveDir.z = dz / dist;
                isMoving = true;

                // Apply movement
                this.position.x += moveDir.x * this.moveSpeed * deltaTime;
                this.position.z += moveDir.z * this.moveSpeed * deltaTime;

                // Face movement direction
                this.rotation = Math.atan2(moveDir.x, moveDir.z);
            } else {
                // Reached target
                this.clearMoveTarget();
            }
        } else if (moveDir.length() > 0) {
            isMoving = true;
            moveDir.normalize();

            // Apply movement
            this.position.x += moveDir.x * this.moveSpeed * deltaTime;
            this.position.z += moveDir.z * this.moveSpeed * deltaTime;

            // Character faces the direction they're moving
            this.rotation = Math.atan2(moveDir.x, moveDir.z);
        }

        // Wall collision check
        if (this.game && this.game.resolveWallCollision) {
            const resolved = this.game.resolveWallCollision(oldX, oldZ, this.position.x, this.position.z, 0.5);
            this.position.x = resolved.x;
            this.position.z = resolved.z;
        }

        // Jumping (spacebar is ' ' key)
        if (input.keys[' '] && this.isGrounded) {
            this.velocity.y = this.jumpForce;
            this.isGrounded = false;
            input.keys[' '] = false; // Consume jump input

            // Play jump animation
            if (this.useAnimatedCharacter) {
                this.character.playJump();
            }
        }

        // Apply gravity
        if (!this.isGrounded) {
            this.velocity.y -= 30 * deltaTime;
            this.position.y += this.velocity.y * deltaTime;

            if (this.position.y <= 0) {
                this.position.y = 0;
                this.velocity.y = 0;
                this.isGrounded = true;
            }
        }

        // Keep in bounds
        const bounds = 95;
        this.position.x = Math.max(-bounds, Math.min(bounds, this.position.x));
        this.position.z = Math.max(-bounds, Math.min(bounds, this.position.z));

        return isMoving;
    }

    updateAbilities(deltaTime) {
        // Update cooldowns
        for (const key in this.abilities) {
            const ability = this.abilities[key];
            if (ability.cooldownRemaining > 0) {
                ability.cooldownRemaining -= deltaTime;
                if (ability.cooldownRemaining < 0) ability.cooldownRemaining = 0;
            }
        }

        // Spin Attack duration
        if (this.abilities.parry.isActive) {
            const ability = this.abilities.parry;
            ability.activeTime += deltaTime;

            // Spin the player during the attack
            const spinSpeed = Math.PI * 4; // 2 rotations during spin
            this.rotation += spinSpeed * deltaTime;

            if (ability.activeTime >= ability.spinDuration) {
                ability.isActive = false;
                ability.activeTime = 0;
            }
        }

        // Whirlwind dash
        if (this.abilities.whirlwind.isActive) {
            this.updateWhirlwind(deltaTime);
        }

        // Heroic Leap arc
        if (this.abilities.heroicLeap.isActive) {
            this.updateHeroicLeap(deltaTime);
        }
    }

    // Target-based auto attack
    performAutoAttack() {
        if (this.autoAttackCooldown > 0) return false;
        if (!this.targetEnemy || !this.targetEnemy.isAlive) return false;

        // Check range (horizontal distance so jumping doesn't affect range)
        const dx = this.targetEnemy.position.x - this.position.x;
        const dz = this.targetEnemy.position.z - this.position.z;
        const horizontalDist = Math.sqrt(dx * dx + dz * dz);

        if (horizontalDist > this.attackRange) return false;

        this.autoAttackCooldown = this.autoAttackCooldownMax;

        // Face the target
        this.rotation = Math.atan2(dx, dz);

        // Play attack animation
        if (this.useAnimatedCharacter) {
            // Cycle through attack animations
            this.attackAnimIndex = ((this.attackAnimIndex || 0) % 4) + 1;
            this.character.playAttack(this.attackAnimIndex);
        }

        // Visual swing effect toward target
        if (this.game && this.game.effects) {
            this.game.effects.createSwingEffect(this.position, this.rotation, 0xffffff);
        }

        // Swing trail particles
        if (this.game && this.game.particles) {
            const startPos = this.position.clone();
            startPos.y += 1;
            const endPos = this.targetEnemy.position.clone();
            endPos.y += 1;
            this.game.particles.swingTrail(startPos, endPos);
        }

        // Deal damage and show damage number
        this.targetEnemy.takeDamage(this.autoAttackDamage, this);
        if (this.game && this.game.effects) {
            this.game.effects.createDamageNumber(this.targetEnemy.position, this.autoAttackDamage);
        }

        return true;
    }

    // Ability: Cleave - fires toward specified direction
    useCleave(enemies, direction = null) {
        const ability = this.abilities.cleave;
        if (ability.cooldownRemaining > 0) return false;

        ability.cooldownRemaining = ability.cooldown;

        // Use provided direction or default to player facing
        let forward;
        if (direction) {
            forward = new THREE.Vector3(direction.x, 0, direction.z).normalize();
            // Face the cleave direction
            this.rotation = Math.atan2(forward.x, forward.z);
        } else {
            forward = new THREE.Vector3(
                Math.sin(this.rotation),
                0,
                Math.cos(this.rotation)
            );
        }

        // Play attack animation for cleave
        if (this.useAnimatedCharacter) {
            this.character.playAttack(2);
        }

        // Visual effect
        if (this.game && this.game.effects) {
            this.game.effects.createCleaveEffect(this.position, this.rotation);
        }

        // Particle effect - cleave wave
        if (this.game && this.game.particles) {
            this.game.particles.cleaveWave(this.position, forward, ability.range);
        }

        // Hit enemies in front cone
        let hitCount = 0;
        for (const enemy of enemies) {
            if (!enemy.isAlive) continue;

            const dx = enemy.position.x - this.position.x;
            const dz = enemy.position.z - this.position.z;
            const horizontalDist = Math.sqrt(dx * dx + dz * dz);

            if (horizontalDist > ability.range) continue;

            // Check if in cone
            const toEnemy = new THREE.Vector3(dx, 0, dz).normalize();
            const dot = forward.dot(toEnemy);
            const angleToEnemy = Math.acos(Math.min(1, Math.max(-1, dot)));

            if (angleToEnemy <= ability.angle / 2) {
                enemy.takeDamage(ability.damage, this);
                if (this.game && this.game.effects) {
                    this.game.effects.createDamageNumber(enemy.position, ability.damage);
                }
                hitCount++;
            }
        }

        return hitCount > 0;
    }

    // Ability: Whirlwind - 360° spin attack with forward dash
    useWhirlwind(direction = null) {
        const ability = this.abilities.whirlwind;
        if (ability.cooldownRemaining > 0) return false;
        if (ability.isActive) return false;

        ability.isActive = true;
        ability.activeTime = 0;
        ability.cooldownRemaining = ability.cooldown;

        // Set dash direction (forward by default, or toward cursor)
        if (direction) {
            ability.dashDirection = new THREE.Vector3(direction.x, 0, direction.z).normalize();
            this.rotation = Math.atan2(direction.x, direction.z);
        } else {
            ability.dashDirection = new THREE.Vector3(
                Math.sin(this.rotation),
                0,
                Math.cos(this.rotation)
            );
        }

        // Store start position
        ability.startPos = this.position.clone();

        // Play attack animation (spin)
        if (this.useAnimatedCharacter) {
            this.character.playAttack(2);
        }

        // Create whirlwind visual effect
        if (this.game && this.game.effects) {
            this.game.effects.createWhirlwindEffect(this.position, ability.range);
        }

        // Emit spin particles
        if (this.game && this.game.particles) {
            this.game.particles.whirlwindSpin(this.position, ability.range);
        }

        // Deal damage to all nearby enemies immediately
        if (this.game) {
            for (const enemy of this.game.enemies) {
                if (!enemy.isAlive) continue;
                const dx = enemy.position.x - this.position.x;
                const dz = enemy.position.z - this.position.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                if (dist <= ability.range) {
                    enemy.takeDamage(ability.damage, this);
                    if (this.game.effects) {
                        this.game.effects.createDamageNumber(enemy.position, ability.damage);
                    }
                }
            }
        }

        return true;
    }

    updateWhirlwind(deltaTime) {
        const ability = this.abilities.whirlwind;
        ability.activeTime += deltaTime;

        // Progress through dash
        const progress = ability.activeTime / ability.dashDuration;

        if (progress < 1) {
            // Move player forward during dash
            const moveAmount = (ability.dashDistance / ability.dashDuration) * deltaTime;
            const oldX = this.position.x;
            const oldZ = this.position.z;
            this.position.add(ability.dashDirection.clone().multiplyScalar(moveAmount));

            // Wall collision check for dash
            if (this.game && this.game.resolveWallCollision) {
                const resolved = this.game.resolveWallCollision(oldX, oldZ, this.position.x, this.position.z, 0.5);
                this.position.x = resolved.x;
                this.position.z = resolved.z;
            }

            // Spin the player rapidly while dashing (3 full rotations during dash)
            const spinSpeed = Math.PI * 6; // 3 rotations per dashDuration
            this.rotation += spinSpeed * deltaTime;

            // Update character rotation for spinning effect
            if (this.useAnimatedCharacter) {
                this.character.setRotation(this.rotation);
            }

            // Spin particles during dash
            if (this.game && this.game.particles && Math.random() < 0.7) {
                this.game.particles.dashTrail(this.position, ability.dashDirection);
                // Add whirlwind spin particles around player
                this.game.particles.whirlwindSpin(this.position);
            }

            // Damage enemies we pass through during spin
            if (this.game && this.game.enemies) {
                for (const enemy of this.game.enemies) {
                    if (!enemy.isAlive) continue;
                    if (enemy.whirlwindHit) continue; // Already hit this spin

                    const dx = enemy.position.x - this.position.x;
                    const dz = enemy.position.z - this.position.z;
                    const dist = Math.sqrt(dx * dx + dz * dz);

                    if (dist <= ability.range) {
                        enemy.takeDamage(ability.damage, this);
                        enemy.whirlwindHit = true; // Mark as hit

                        if (this.game.effects) {
                            this.game.effects.createDamageNumber(enemy.position, ability.damage, false, false);
                        }
                    }
                }
            }
        } else {
            // End whirlwind - reset hit flags
            if (this.game && this.game.enemies) {
                for (const enemy of this.game.enemies) {
                    enemy.whirlwindHit = false;
                }
            }

            ability.isActive = false;
            ability.activeTime = 0;
            ability.dashDirection = null;

            // Face the direction we were dashing
            this.rotation = Math.atan2(ability.dashDirection?.x || 0, ability.dashDirection?.z || 1);
        }
    }

    // Ability: Spin Attack (E) - AoE spin damage around player
    useParry() {
        const ability = this.abilities.parry;
        if (ability.cooldownRemaining > 0) return false;
        if (ability.isActive) return false;

        ability.isActive = true;
        ability.activeTime = 0;
        ability.cooldownRemaining = ability.cooldown;
        ability.startRotation = this.rotation;

        // Play attack animation
        if (this.useAnimatedCharacter) {
            this.character.playAttack(2);
        }

        // Create spin visual effect
        if (this.game && this.game.effects) {
            this.game.effects.createSpinAttackEffect(this.position, ability.range);
        }

        // Damage all enemies in range
        if (this.game && this.game.enemies) {
            for (const enemy of this.game.enemies) {
                if (enemy.isAlive) {
                    const dx = enemy.position.x - this.position.x;
                    const dz = enemy.position.z - this.position.z;
                    const dist = Math.sqrt(dx * dx + dz * dz);

                    if (dist <= ability.range) {
                        enemy.takeDamage(ability.damage, this);
                        if (this.game.effects) {
                            this.game.effects.createDamageNumber(enemy.position, ability.damage, false, false);
                        }
                    }
                }
            }
        }

        return true;
    }

    // Legacy tryParry kept for compatibility but now does nothing
    tryParry(attacker) {
        return false;
    }

    // Ability: Heroic Leap - jump to target location with AoE damage
    useHeroicLeap(targetPos) {
        const ability = this.abilities.heroicLeap;
        if (ability.cooldownRemaining > 0) return false;
        if (ability.isActive) return false;

        // Validate target position
        if (!targetPos) return false;

        // Check range
        const dx = targetPos.x - this.position.x;
        const dz = targetPos.z - this.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // Clamp to max range
        let finalTarget = targetPos.clone();
        if (dist > ability.range) {
            const dir = new THREE.Vector3(dx, 0, dz).normalize();
            finalTarget = this.position.clone().add(dir.multiplyScalar(ability.range));
        }

        // Check if target position is inside a wall - if so, find valid landing spot
        if (this.game && this.game.checkWallCollision && this.game.checkWallCollision(finalTarget.x, finalTarget.z, 0.5)) {
            // Try to find a valid position by stepping back toward player
            const dir = new THREE.Vector3(dx, 0, dz).normalize();
            let testDist = Math.min(dist, ability.range);
            let found = false;
            while (testDist > 1) {
                testDist -= 1;
                const testPos = this.position.clone().add(dir.clone().multiplyScalar(testDist));
                if (!this.game.checkWallCollision(testPos.x, testPos.z, 0.5)) {
                    finalTarget = testPos;
                    found = true;
                    break;
                }
            }
            if (!found) {
                // Can't find valid landing spot
                return false;
            }
        }

        ability.isActive = true;
        ability.activeTime = 0;
        ability.cooldownRemaining = ability.cooldown;
        ability.startPos = this.position.clone();
        ability.targetPos = finalTarget;

        // Face target direction
        this.rotation = Math.atan2(dx, dz);

        // Play jump animation
        if (this.useAnimatedCharacter) {
            this.character.playJump();
        }

        // Create leap trail effect
        if (this.game && this.game.effects) {
            this.game.effects.createLeapTrailEffect(this.position);
        }

        return true;
    }

    updateHeroicLeap(deltaTime) {
        const ability = this.abilities.heroicLeap;
        ability.activeTime += deltaTime;

        const progress = Math.min(ability.activeTime / ability.leapDuration, 1);

        // Parabolic arc - higher jump at midpoint
        const arcHeight = 5;
        const t = progress;
        const heightOffset = 4 * arcHeight * t * (1 - t); // Parabola peaking at t=0.5

        // Interpolate position
        this.position.x = ability.startPos.x + (ability.targetPos.x - ability.startPos.x) * progress;
        this.position.z = ability.startPos.z + (ability.targetPos.z - ability.startPos.z) * progress;
        this.position.y = heightOffset;

        // Trail particles during leap
        if (this.game && this.game.particles && Math.random() < 0.8) {
            this.game.particles.leapTrail(this.position);
        }

        // Land
        if (progress >= 1) {
            this.position.y = 0;
            ability.isActive = false;
            ability.activeTime = 0;

            // AoE damage and stun on landing
            if (this.game) {
                // Ground slam effect
                if (this.game.effects) {
                    this.game.effects.createGroundSlamEffect(this.position, ability.aoeRadius);
                }

                // Shockwave particles
                if (this.game.particles) {
                    this.game.particles.groundSlam(this.position, ability.aoeRadius);
                }

                // Screen shake
                this.game.addScreenShake(0.8);

                // Damage and stun enemies in AoE
                for (const enemy of this.game.enemies) {
                    if (!enemy.isAlive) continue;
                    const dx = enemy.position.x - this.position.x;
                    const dz = enemy.position.z - this.position.z;
                    const dist = Math.sqrt(dx * dx + dz * dz);
                    if (dist <= ability.aoeRadius) {
                        enemy.takeDamage(ability.damage, this);
                        enemy.stun(ability.stunDuration);
                        if (this.game.effects) {
                            this.game.effects.createDamageNumber(enemy.position, ability.damage);
                        }
                    }
                }
            }

            ability.startPos = null;
            ability.targetPos = null;
        }
    }

    // Ability: Health Potion
    usePotion() {
        const ability = this.abilities.potion;
        if (ability.cooldownRemaining > 0) return false;

        ability.cooldownRemaining = ability.cooldown;
        this.health = Math.min(this.maxHealth, this.health + ability.healAmount);

        // Healing effect
        if (this.game && this.game.effects) {
            this.game.effects.createPotionEffect(this.position);
            this.game.effects.createDamageNumber(this.position, ability.healAmount, true);
        }

        // Heal particles
        if (this.game && this.game.particles) {
            this.game.particles.healEffect(this.position);
        }

        return true;
    }

    // Ability: Sunder - shoot a wave of ground spikes
    useSunder(direction = null) {
        const ability = this.abilities.sunder;
        if (ability.cooldownRemaining > 0) return false;

        ability.cooldownRemaining = ability.cooldown;

        // Use provided direction or default to player facing
        let forward;
        if (direction) {
            forward = new THREE.Vector3(direction.x, 0, direction.z).normalize();
            this.rotation = Math.atan2(forward.x, forward.z);
        } else {
            forward = new THREE.Vector3(
                Math.sin(this.rotation),
                0,
                Math.cos(this.rotation)
            );
        }

        // Play attack animation
        if (this.useAnimatedCharacter) {
            this.character.playAttack(3);
        }

        // Create spike wave visual effect
        if (this.game && this.game.effects) {
            this.game.effects.createSunderEffect(this.position, forward, ability.range, ability.spikeCount);
        }

        // Particle effect
        if (this.game && this.game.particles) {
            this.game.particles.sunderWave(this.position, forward, ability.range);
        }

        // Damage enemies in line (widening cone)
        if (this.game && this.game.enemies) {
            const perp = new THREE.Vector3(-forward.z, 0, forward.x);
            const startWidth = 0.5;
            const endWidth = ability.width * 2;

            for (const enemy of this.game.enemies) {
                if (!enemy.isAlive) continue;

                const toEnemy = new THREE.Vector3(
                    enemy.position.x - this.position.x,
                    0,
                    enemy.position.z - this.position.z
                );

                // Check if enemy is in front (within range)
                const forwardDist = toEnemy.dot(forward);
                if (forwardDist < 0.5 || forwardDist > ability.range) continue;

                // Width increases with distance (trapezoid shape)
                const distRatio = forwardDist / ability.range;
                const widthAtDist = startWidth + (endWidth - startWidth) * distRatio;

                // Check if enemy is within width at that distance
                const perpDist = Math.abs(toEnemy.dot(perp));
                if (perpDist > widthAtDist) continue;

                // Hit this enemy!
                enemy.takeDamage(ability.damage, this);

                // Damage number
                if (this.game.effects) {
                    this.game.effects.createDamageNumber(enemy.position, ability.damage, false, false);
                }
            }
        }

        return true;
    }

    takeDamage(amount) {
        // Invulnerable during spin attack
        if (this.abilities.parry.isActive) {
            return;
        }

        this.health -= amount;

        // Play impact animation
        if (this.useAnimatedCharacter) {
            this.character.playImpact();
        }

        // Hit particles
        if (this.game && this.game.particles) {
            this.game.particles.playerHit(this.position);
            this.game.addScreenShake(Math.min(amount / 20, 0.5));
        }

        if (this.health <= 0) {
            this.health = 0;
            this.die();
        }
    }

    die() {
        console.log('Player died!');

        // Play death animation
        if (this.useAnimatedCharacter) {
            this.character.playDeath();
        }

        // Reset for now
        setTimeout(() => {
            this.health = this.maxHealth;
            this.position.set(0, 0, 0);
            // Reset to idle after respawn
            if (this.useAnimatedCharacter) {
                this.character.playAnimation('idle', true);
            }
        }, 2000);
    }
}
