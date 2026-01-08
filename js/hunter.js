import * as THREE from 'three';
import { KayKitCharacter } from './kayKitCharacter.js';
import { WeaponFactory } from './weaponFactory.js';
import { Inventory } from './inventory.js';

export class Hunter {
    constructor(scene, game) {
        this.scene = scene;
        this.game = game;
        this.position = new THREE.Vector3(0, 0, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.rotation = 0;
        this.className = 'hunter';

        // Inventory system
        this.inventory = new Inventory(24);
        this.inventory.giveStarterItems(this.className);

        // Buff system
        this.buffs = {};

        // Stats - Hunter is mobile with medium health
        this.maxHealth = 400;
        this.health = this.maxHealth;
        this.moveSpeed = 8;
        this.jumpForce = 12;
        this.isGrounded = true;

        // Combat - Dual crossbow ranged
        this.targetEnemy = null;
        this.attackRange = 18;
        this.autoAttackCooldown = 0;
        this.autoAttackCooldownMax = 0.6; // Fast attacks
        this.autoAttackDamage = 15;
        this.currentCrossbow = 'left'; // Alternate between crossbows

        // Hunter Abilities
        this.abilities = {
            arrowWave: {
                cooldown: 6,
                cooldownRemaining: 0,
                damage: 20,
                arrowCount: 8,
                range: 15,
                angle: Math.PI * 0.5, // 90 degree spread
                isActive: false
            },
            spinDash: {
                cooldown: 8,
                cooldownRemaining: 0,
                damage: 25,
                dashDistance: 10,
                arrowsPerSpin: 12,
                radius: 4,
                isActive: false
            },
            shotgun: {
                cooldown: 5,
                cooldownRemaining: 0,
                damage: 40,
                range: 8,
                angle: Math.PI * 0.4, // 72 degree cone
                knockback: 5, // Push player back
                arrowCount: 6,
                isActive: false
            },
            trap: {
                cooldown: 12,
                cooldownRemaining: 0,
                damage: 60,
                radius: 4,
                armTime: 1.0, // Time before trap is active
                isActive: false
            },
            giantArrow: {
                cooldown: 10,
                cooldownRemaining: 0,
                damage: 50,
                range: 30,
                width: 1.5,
                speed: 25,
                piercing: true,
                isActive: false
            },
            potion: {
                cooldown: 10,
                cooldownRemaining: 0,
                healAmount: 100,
                isActive: false
            }
        };

        // Projectiles
        this.projectiles = [];
        this.giantArrows = [];
        this.traps = [];

        // KayKit character controller
        this.character = new KayKitCharacter(scene);
        this.useAnimatedCharacter = false;
        this.characterLoading = false;

        // Click-to-move target
        this.moveTarget = null;
        this.moveTargetThreshold = 0.5;

        // Ability indicators
        this.arrowWaveIndicator = null;
        this.shotgunIndicator = null;
        this.giantArrowIndicator = null;
        this.createAbilityIndicators();

        // Visual representation (fallback)
        this.createMesh();

        // Try to load animated character
        this.loadCharacter();
    }

    createAbilityIndicators() {
        // Arrow Wave cone indicator
        const waveAngle = this.abilities.arrowWave.angle;
        const waveRange = this.abilities.arrowWave.range;
        const segments = 32;

        const waveShape = new THREE.Shape();
        waveShape.moveTo(0, 0);
        for (let i = 0; i <= segments; i++) {
            const angle = -waveAngle / 2 + (waveAngle * i / segments);
            const x = Math.sin(angle) * waveRange;
            const y = Math.cos(angle) * waveRange;
            waveShape.lineTo(x, y);
        }
        waveShape.lineTo(0, 0);

        const waveGeometry = new THREE.ShapeGeometry(waveShape);
        const waveMaterial = new THREE.MeshBasicMaterial({
            color: 0x88ff44,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        this.arrowWaveIndicator = new THREE.Mesh(waveGeometry, waveMaterial);
        this.arrowWaveIndicator.rotation.x = -Math.PI / 2;
        this.arrowWaveIndicator.position.y = 0.1;
        this.arrowWaveIndicator.visible = false;
        this.scene.add(this.arrowWaveIndicator);

        // Shotgun cone indicator (smaller, more focused)
        const shotgunAngle = this.abilities.shotgun.angle;
        const shotgunRange = this.abilities.shotgun.range;

        const shotgunShape = new THREE.Shape();
        shotgunShape.moveTo(0, 0);
        for (let i = 0; i <= segments; i++) {
            const angle = -shotgunAngle / 2 + (shotgunAngle * i / segments);
            const x = Math.sin(angle) * shotgunRange;
            const y = Math.cos(angle) * shotgunRange;
            shotgunShape.lineTo(x, y);
        }
        shotgunShape.lineTo(0, 0);

        const shotgunGeometry = new THREE.ShapeGeometry(shotgunShape);
        const shotgunMaterial = new THREE.MeshBasicMaterial({
            color: 0xffaa44,
            transparent: true,
            opacity: 0.35,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        this.shotgunIndicator = new THREE.Mesh(shotgunGeometry, shotgunMaterial);
        this.shotgunIndicator.rotation.x = -Math.PI / 2;
        this.shotgunIndicator.position.y = 0.1;
        this.shotgunIndicator.visible = false;
        this.scene.add(this.shotgunIndicator);

        // Giant Arrow line indicator
        const lineLength = this.abilities.giantArrow.range;
        const lineWidth = this.abilities.giantArrow.width;

        const lineShape = new THREE.Shape();
        lineShape.moveTo(-lineWidth / 2, 0);
        lineShape.lineTo(-lineWidth / 2, lineLength);
        lineShape.lineTo(lineWidth / 2, lineLength);
        lineShape.lineTo(lineWidth / 2, 0);
        lineShape.lineTo(-lineWidth / 2, 0);

        const lineGeometry = new THREE.ShapeGeometry(lineShape);
        const lineMaterial = new THREE.MeshBasicMaterial({
            color: 0xff4444,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        this.giantArrowIndicator = new THREE.Mesh(lineGeometry, lineMaterial);
        this.giantArrowIndicator.rotation.x = -Math.PI / 2;
        this.giantArrowIndicator.position.y = 0.1;
        this.giantArrowIndicator.visible = false;
        this.scene.add(this.giantArrowIndicator);
    }

    showArrowWaveIndicator(show) {
        if (this.arrowWaveIndicator) {
            this.arrowWaveIndicator.visible = show;
        }
    }

    updateArrowWaveIndicator(mouseWorldPos) {
        if (!this.arrowWaveIndicator || !this.arrowWaveIndicator.visible) return;

        this.arrowWaveIndicator.position.x = this.position.x;
        this.arrowWaveIndicator.position.z = this.position.z;

        const dx = mouseWorldPos.x - this.position.x;
        const dz = mouseWorldPos.z - this.position.z;
        const angle = Math.atan2(dx, dz);
        this.arrowWaveIndicator.rotation.z = angle + Math.PI;
    }

    showShotgunIndicator(show) {
        if (this.shotgunIndicator) {
            this.shotgunIndicator.visible = show;
        }
    }

    updateShotgunIndicator(mouseWorldPos) {
        if (!this.shotgunIndicator || !this.shotgunIndicator.visible) return;

        this.shotgunIndicator.position.x = this.position.x;
        this.shotgunIndicator.position.z = this.position.z;

        const dx = mouseWorldPos.x - this.position.x;
        const dz = mouseWorldPos.z - this.position.z;
        const angle = Math.atan2(dx, dz);
        this.shotgunIndicator.rotation.z = angle + Math.PI;
    }

    showGiantArrowIndicator(show) {
        if (this.giantArrowIndicator) {
            this.giantArrowIndicator.visible = show;
        }
    }

    updateGiantArrowIndicator(mouseWorldPos) {
        if (!this.giantArrowIndicator || !this.giantArrowIndicator.visible) return;

        this.giantArrowIndicator.position.x = this.position.x;
        this.giantArrowIndicator.position.z = this.position.z;

        const dx = mouseWorldPos.x - this.position.x;
        const dz = mouseWorldPos.z - this.position.z;
        const angle = Math.atan2(dx, dz);
        this.giantArrowIndicator.rotation.z = angle + Math.PI;
    }

    async loadCharacter() {
        this.characterLoading = true;
        this.group.visible = false;

        try {
            // Load KayKit Ranger character for hunter
            const success = await this.character.load('adventurers', 'ranger');
            if (success) {
                this.useAnimatedCharacter = true;
                console.log('Using KayKit Ranger character model for Hunter');

                // Attach crossbow weapons to both hands
                const weaponR = WeaponFactory.createWeaponForClass('hunter');
                this.character.attachWeapon(weaponR.mesh, 'handR', weaponR.offset, weaponR.rotation);

                // Left hand crossbow (mirrored)
                const weaponL = WeaponFactory.createWeaponForClass('hunter');
                const mirroredOffset = new THREE.Vector3(0, 0, 0.15);
                const mirroredRotation = new THREE.Euler(0, 0, -Math.PI / 2);  // Mirror the Z rotation
                this.character.attachWeapon(weaponL.mesh, 'handL', mirroredOffset, mirroredRotation);
            } else {
                this.group.visible = true;
            }
        } catch (error) {
            console.warn('Failed to load KayKit ranger character, using fallback:', error);
            this.group.visible = true;
        }
        this.characterLoading = false;
    }

    createMesh() {
        // Hunter fallback mesh - hooded ranger with dual crossbows
        this.group = new THREE.Group();

        const leatherMaterial = new THREE.MeshStandardMaterial({
            color: 0x8B4513,
            roughness: 0.8
        });
        const clothMaterial = new THREE.MeshStandardMaterial({
            color: 0x2d5a27,
            roughness: 0.7
        });
        const skinMaterial = new THREE.MeshStandardMaterial({
            color: 0xffddaa,
            roughness: 0.7
        });
        const metalMaterial = new THREE.MeshStandardMaterial({
            color: 0x555555,
            roughness: 0.3,
            metalness: 0.8
        });

        // Body
        const bodyGeometry = new THREE.CylinderGeometry(0.35, 0.4, 1.2, 8);
        const body = new THREE.Mesh(bodyGeometry, clothMaterial);
        body.position.y = 0.9;
        this.group.add(body);

        // Head
        const headGeometry = new THREE.SphereGeometry(0.25, 16, 12);
        const head = new THREE.Mesh(headGeometry, skinMaterial);
        head.position.y = 1.7;
        this.group.add(head);

        // Hood
        const hoodGeometry = new THREE.SphereGeometry(0.32, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6);
        const hood = new THREE.Mesh(hoodGeometry, clothMaterial);
        hood.position.y = 1.75;
        hood.rotation.x = -0.2;
        this.group.add(hood);

        // Left crossbow
        const crossbow1 = this.createCrossbowMesh(metalMaterial, leatherMaterial);
        crossbow1.position.set(-0.5, 1.0, 0.2);
        crossbow1.rotation.y = Math.PI / 4;
        this.group.add(crossbow1);

        // Right crossbow
        const crossbow2 = this.createCrossbowMesh(metalMaterial, leatherMaterial);
        crossbow2.position.set(0.5, 1.0, 0.2);
        crossbow2.rotation.y = -Math.PI / 4;
        this.group.add(crossbow2);

        // Quiver on back
        const quiverGeometry = new THREE.CylinderGeometry(0.12, 0.15, 0.8, 8);
        const quiver = new THREE.Mesh(quiverGeometry, leatherMaterial);
        quiver.position.set(0, 1.2, -0.35);
        quiver.rotation.x = 0.2;
        this.group.add(quiver);

        this.scene.add(this.group);
    }

    createCrossbowMesh(metalMaterial, woodMaterial) {
        const crossbow = new THREE.Group();

        // Stock
        const stockGeometry = new THREE.BoxGeometry(0.08, 0.06, 0.5);
        const stock = new THREE.Mesh(stockGeometry, woodMaterial);
        crossbow.add(stock);

        // Bow arms
        const armGeometry = new THREE.BoxGeometry(0.4, 0.04, 0.04);
        const arm = new THREE.Mesh(armGeometry, metalMaterial);
        arm.position.z = 0.2;
        crossbow.add(arm);

        // String (thin line)
        const stringGeometry = new THREE.CylinderGeometry(0.005, 0.005, 0.4, 4);
        const stringMaterial = new THREE.MeshBasicMaterial({ color: 0xcccccc });
        const string = new THREE.Mesh(stringGeometry, stringMaterial);
        string.rotation.z = Math.PI / 2;
        string.position.z = 0.15;
        crossbow.add(string);

        return crossbow;
    }

    setTarget(enemy) {
        if (this.targetEnemy && this.targetEnemy.setTargeted) {
            this.targetEnemy.setTargeted(false);
        }
        this.targetEnemy = enemy;
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
        // Process movement
        const isMoving = this.handleMovement(deltaTime, input, cameraController, input.rightMouseDown);

        // Process abilities
        this.updateAbilities(deltaTime);

        // Update projectiles
        this.updateProjectiles(deltaTime);

        // Update giant arrows
        this.updateGiantArrows(deltaTime);

        // Update traps
        this.updateTraps(deltaTime);

        // Auto-attack cooldown
        if (this.autoAttackCooldown > 0) {
            this.autoAttackCooldown -= deltaTime;
        }

        // Automatically attack target if in range
        if (this.targetEnemy && this.targetEnemy.isAlive && this.autoAttackCooldown <= 0) {
            const dist = this.position.distanceTo(this.targetEnemy.position);
            if (dist <= this.attackRange) {
                this.performAutoAttack();
            }
        }

        // Update visual position
        if (this.useAnimatedCharacter) {
            this.character.setPosition(this.position.x, this.position.y, this.position.z);
            this.character.setRotation(this.rotation);
            this.character.update(deltaTime, isMoving, true, this.isGrounded);
        } else {
            this.group.position.copy(this.position);
            this.group.rotation.y = this.rotation;
        }
    }

    handleMovement(deltaTime, input, cameraController, isMouseTurning = false) {
        const forwardBack = new THREE.Vector3();
        if (input.keys.w || input.keys.arrowup) forwardBack.z -= 1;
        if (input.keys.s || input.keys.arrowdown) forwardBack.z += 1;

        const strafe = new THREE.Vector3();
        if (input.keys.a || input.keys.arrowleft) strafe.x -= 1;
        if (input.keys.d || input.keys.arrowright) strafe.x += 1;

        const usingKeyboard = forwardBack.length() > 0 || strafe.length() > 0;

        if (usingKeyboard && this.moveTarget) {
            this.clearMoveTarget();
        }

        const moveDir = new THREE.Vector3();
        const cameraYaw = -cameraController.yaw;
        const cos = Math.cos(cameraYaw);
        const sin = Math.sin(cameraYaw);

        if (forwardBack.length() > 0) {
            const rotatedZ = forwardBack.z * cos;
            const rotatedX = -forwardBack.z * sin;
            moveDir.x += rotatedX;
            moveDir.z += rotatedZ;
        }

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

        if (this.moveTarget && !usingKeyboard) {
            const dx = this.moveTarget.x - this.position.x;
            const dz = this.moveTarget.z - this.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist > this.moveTargetThreshold) {
                moveDir.x = dx / dist;
                moveDir.z = dz / dist;
                isMoving = true;

                this.position.x += moveDir.x * this.moveSpeed * deltaTime;
                this.position.z += moveDir.z * this.moveSpeed * deltaTime;

                this.rotation = Math.atan2(moveDir.x, moveDir.z);
            } else {
                this.clearMoveTarget();
            }
        } else if (moveDir.length() > 0) {
            isMoving = true;
            moveDir.normalize();

            this.position.x += moveDir.x * this.moveSpeed * deltaTime;
            this.position.z += moveDir.z * this.moveSpeed * deltaTime;

            this.rotation = Math.atan2(moveDir.x, moveDir.z);
        }

        // Wall collision check
        if (this.game && this.game.resolveWallCollision) {
            const resolved = this.game.resolveWallCollision(oldX, oldZ, this.position.x, this.position.z, 0.5);
            this.position.x = resolved.x;
            this.position.z = resolved.z;
        }

        // Jumping
        if (input.keys[' '] && this.isGrounded) {
            this.velocity.y = this.jumpForce;
            this.isGrounded = false;
            input.keys[' '] = false;

            if (this.useAnimatedCharacter) {
                this.character.playJump();
            }
        }

        // Gravity
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
        for (const key in this.abilities) {
            const ability = this.abilities[key];
            if (ability.cooldownRemaining > 0) {
                ability.cooldownRemaining -= deltaTime;
                if (ability.cooldownRemaining < 0) ability.cooldownRemaining = 0;
            }
        }
    }

    // Dual crossbow auto-attack - alternates between crossbows
    performAutoAttack() {
        if (this.autoAttackCooldown > 0) return false;
        if (!this.targetEnemy || !this.targetEnemy.isAlive) return false;

        const dist = this.position.distanceTo(this.targetEnemy.position);
        if (dist > this.attackRange) return false;

        this.autoAttackCooldown = this.autoAttackCooldownMax;

        // Face the target
        const dx = this.targetEnemy.position.x - this.position.x;
        const dz = this.targetEnemy.position.z - this.position.z;
        this.rotation = Math.atan2(dx, dz);

        // Play attack animation
        if (this.useAnimatedCharacter) {
            this.character.playAttack(1);
        }

        // Fire bolt from alternating crossbow
        this.createCrossbowBolt(this.targetEnemy, this.currentCrossbow);
        this.currentCrossbow = this.currentCrossbow === 'left' ? 'right' : 'left';

        return true;
    }

    createCrossbowBolt(target, side) {
        const startPos = this.position.clone();
        startPos.y += 1.0;
        startPos.x += side === 'left' ? -0.3 : 0.3;

        // Bolt visual
        const boltGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.4, 4);
        const boltMaterial = new THREE.MeshBasicMaterial({
            color: 0x8B4513
        });
        const bolt = new THREE.Mesh(boltGeometry, boltMaterial);
        bolt.rotation.x = Math.PI / 2;
        bolt.position.copy(startPos);
        this.scene.add(bolt);

        // Bolt tip
        const tipGeometry = new THREE.ConeGeometry(0.04, 0.1, 4);
        const tipMaterial = new THREE.MeshBasicMaterial({ color: 0x888888 });
        const tip = new THREE.Mesh(tipGeometry, tipMaterial);
        tip.rotation.x = -Math.PI / 2;
        tip.position.z = 0.25;
        bolt.add(tip);

        this.projectiles.push({
            mesh: bolt,
            target: target,
            speed: 30,
            damage: this.autoAttackDamage,
            type: 'bolt'
        });
    }

    // Q - Arrow Wave: Fan of arrows in a cone
    useArrowWave(direction = null) {
        const ability = this.abilities.arrowWave;
        if (ability.cooldownRemaining > 0) return false;

        ability.cooldownRemaining = ability.cooldown;

        let forward;
        if (direction) {
            forward = new THREE.Vector3(direction.x, 0, direction.z).normalize();
            this.rotation = Math.atan2(forward.x, forward.z);
        } else {
            forward = new THREE.Vector3(Math.sin(this.rotation), 0, Math.cos(this.rotation));
        }

        if (this.useAnimatedCharacter) {
            this.character.playAttack(2);
        }

        // Fire multiple arrows in a fan pattern
        const startAngle = this.rotation - ability.angle / 2;
        const angleStep = ability.angle / (ability.arrowCount - 1);

        for (let i = 0; i < ability.arrowCount; i++) {
            const angle = startAngle + angleStep * i;
            const dir = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
            this.createArrowWaveProjectile(dir, ability.damage, ability.range);
        }

        // Visual effect - green burst at player
        this.createArrowWaveBurst(forward);

        // Particle effect
        if (this.game && this.game.particles && this.game.particles.arrowWaveEffect) {
            this.game.particles.arrowWaveEffect(this.position, forward, ability.range);
        }

        return true;
    }

    createArrowWaveBurst(forward) {
        const burstPos = this.position.clone();
        burstPos.y = 1;

        // Create expanding ring
        const ringGeo = new THREE.RingGeometry(0.5, 1, 16);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x88ff44,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.copy(burstPos);
        ring.rotation.x = -Math.PI / 2;
        this.scene.add(ring);

        // Animate
        let elapsed = 0;
        const duration = 0.3;
        const animate = () => {
            elapsed += 0.016;
            const progress = elapsed / duration;
            ring.scale.setScalar(1 + progress * 3);
            ringMat.opacity = 0.8 * (1 - progress);
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.scene.remove(ring);
                ring.geometry.dispose();
                ring.material.dispose();
            }
        };
        animate();
    }

    createArrowWaveProjectile(direction, damage, range) {
        const startPos = this.position.clone();
        startPos.y = 1.2;

        const arrowGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 4);
        const arrowMaterial = new THREE.MeshBasicMaterial({ color: 0x88ff44 });
        const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
        arrow.position.copy(startPos);

        // Point arrow in direction
        const targetPos = startPos.clone().addScaledVector(direction, 1);
        arrow.lookAt(targetPos);
        arrow.rotation.x += Math.PI / 2;

        this.scene.add(arrow);

        this.projectiles.push({
            mesh: arrow,
            direction: direction.clone(),
            speed: 25,
            damage: damage,
            maxRange: range,
            distanceTraveled: 0,
            type: 'arrowWave',
            hitEnemies: new Set()
        });
    }

    // F - Spin Dash: Dash forward while shooting arrows in all directions
    useSpinDash(direction = null) {
        const ability = this.abilities.spinDash;
        if (ability.cooldownRemaining > 0) return false;

        ability.cooldownRemaining = ability.cooldown;

        let dashDir;
        if (direction) {
            dashDir = new THREE.Vector3(direction.x, 0, direction.z).normalize();
            this.rotation = Math.atan2(dashDir.x, dashDir.z);
        } else {
            dashDir = new THREE.Vector3(Math.sin(this.rotation), 0, Math.cos(this.rotation));
        }

        const startPos = this.position.clone();
        let endPos = startPos.clone().addScaledVector(dashDir, ability.dashDistance);

        // Keep in bounds
        const bounds = 95;
        endPos.x = Math.max(-bounds, Math.min(bounds, endPos.x));
        endPos.z = Math.max(-bounds, Math.min(bounds, endPos.z));

        // Validate endpoint - find valid position if endpoint is in wall
        if (this.game && this.game.checkWallCollision && this.game.checkWallCollision(endPos.x, endPos.z, 0.5)) {
            // Step back to find valid position
            let testDist = ability.dashDistance;
            while (testDist > 0.5) {
                testDist -= 0.5;
                const testPos = startPos.clone().addScaledVector(dashDir, testDist);
                if (!this.game.checkWallCollision(testPos.x, testPos.z, 0.5)) {
                    endPos = testPos;
                    break;
                }
            }
        }

        // Animate the dash and fire arrows
        const dashDuration = 0.4;
        let elapsed = 0;
        let arrowsFired = 0;
        const arrowInterval = dashDuration / ability.arrowsPerSpin;
        let lastPos = startPos.clone();

        const animateDash = () => {
            elapsed += 0.016;
            const progress = Math.min(elapsed / dashDuration, 1);

            // Move player - lerp to validated endpoint
            const targetPos = new THREE.Vector3().lerpVectors(startPos, endPos, progress);

            // Additional per-frame wall check for walls crossed during dash
            if (this.game && this.game.checkWallCollision && this.game.checkWallCollision(targetPos.x, targetPos.z, 0.5)) {
                // Stop at last valid position
                // Don't update position
            } else {
                this.position.copy(targetPos);
                lastPos.copy(targetPos);
            }

            // Spin the player
            this.rotation += 0.5;

            // Fire arrows at intervals
            const shouldFireArrows = Math.floor(elapsed / arrowInterval);
            while (arrowsFired < shouldFireArrows && arrowsFired < ability.arrowsPerSpin) {
                const angle = (arrowsFired / ability.arrowsPerSpin) * Math.PI * 2;
                const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
                this.createSpinArrow(dir, ability.damage);
                arrowsFired++;
            }

            // Update visual
            if (this.useAnimatedCharacter) {
                this.character.setPosition(this.position.x, this.position.y, this.position.z);
                this.character.setRotation(this.rotation);
            } else {
                this.group.position.copy(this.position);
                this.group.rotation.y = this.rotation;
            }

            if (progress < 1) {
                requestAnimationFrame(animateDash);
            }
        };

        if (this.useAnimatedCharacter) {
            this.character.playAttack(3);
        }

        animateDash();

        // Create spinning trail effect
        this.createSpinDashTrail(startPos, endPos);

        // Particle effect during dash
        if (this.game && this.game.particles && this.game.particles.spinDashEffect) {
            // Spawn particles at intervals along dash path
            const steps = 5;
            for (let i = 0; i < steps; i++) {
                const t = i / steps;
                const pos = new THREE.Vector3().lerpVectors(startPos, endPos, t);
                setTimeout(() => {
                    if (this.game && this.game.particles) {
                        this.game.particles.spinDashEffect(pos);
                    }
                }, t * dashDuration * 1000);
            }
        }

        // Screen shake
        if (this.game) {
            this.game.addScreenShake(0.4);
        }

        return true;
    }

    createSpinDashTrail(startPos, endPos) {
        const direction = new THREE.Vector3().subVectors(endPos, startPos);
        const distance = direction.length();
        direction.normalize();

        // Create multiple trail rings along path
        const ringCount = 6;
        for (let i = 0; i < ringCount; i++) {
            const delay = i * 0.05;
            setTimeout(() => {
                const t = i / (ringCount - 1);
                const pos = startPos.clone().lerp(endPos, t);
                pos.y = 0.5;

                const ringGeo = new THREE.RingGeometry(0.3, 0.8, 12);
                const ringMat = new THREE.MeshBasicMaterial({
                    color: 0xffff44,
                    transparent: true,
                    opacity: 0.7,
                    side: THREE.DoubleSide,
                    depthWrite: false
                });
                const ring = new THREE.Mesh(ringGeo, ringMat);
                ring.position.copy(pos);
                ring.rotation.x = -Math.PI / 2;
                this.scene.add(ring);

                // Animate ring expanding and fading
                let elapsed = 0;
                const duration = 0.4;
                const animate = () => {
                    elapsed += 0.016;
                    const progress = elapsed / duration;
                    ring.scale.setScalar(1 + progress * 2);
                    ring.rotation.z += 0.2;
                    ringMat.opacity = 0.7 * (1 - progress);
                    if (progress < 1) {
                        requestAnimationFrame(animate);
                    } else {
                        this.scene.remove(ring);
                        ring.geometry.dispose();
                        ring.material.dispose();
                    }
                };
                animate();
            }, delay * 1000);
        }
    }

    createSpinArrow(direction, damage) {
        const startPos = this.position.clone();
        startPos.y = 1.0;

        const arrowGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.35, 4);
        const arrowMaterial = new THREE.MeshBasicMaterial({ color: 0xffff44 });
        const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
        arrow.position.copy(startPos);

        const targetPos = startPos.clone().addScaledVector(direction, 1);
        arrow.lookAt(targetPos);
        arrow.rotation.x += Math.PI / 2;

        this.scene.add(arrow);

        this.projectiles.push({
            mesh: arrow,
            direction: direction.clone(),
            speed: 20,
            damage: damage,
            maxRange: this.abilities.spinDash.radius * 2,
            distanceTraveled: 0,
            type: 'spinArrow',
            hitEnemies: new Set()
        });
    }

    // E - Shotgun: Big cone blast that pushes you back
    useShotgun(direction = null) {
        const ability = this.abilities.shotgun;
        if (ability.cooldownRemaining > 0) return false;

        ability.cooldownRemaining = ability.cooldown;

        let forward;
        if (direction) {
            forward = new THREE.Vector3(direction.x, 0, direction.z).normalize();
            this.rotation = Math.atan2(forward.x, forward.z);
        } else {
            forward = new THREE.Vector3(Math.sin(this.rotation), 0, Math.cos(this.rotation));
        }

        if (this.useAnimatedCharacter) {
            this.character.playAttack(1);
        }

        // Fire shotgun spread
        const startAngle = this.rotation - ability.angle / 2;
        const angleStep = ability.angle / (ability.arrowCount - 1);

        for (let i = 0; i < ability.arrowCount; i++) {
            const angle = startAngle + angleStep * i;
            const dir = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
            this.createShotgunBolt(dir, ability.damage, ability.range);
        }

        // Knockback player backwards with wall collision check
        const backDir = forward.clone().multiplyScalar(-1);
        const startPos = this.position.clone();
        let knockbackDist = ability.knockback;

        // Find valid knockback endpoint
        if (this.game && this.game.checkWallCollision) {
            while (knockbackDist > 0.5) {
                const testPos = startPos.clone().addScaledVector(backDir, knockbackDist);
                if (!this.game.checkWallCollision(testPos.x, testPos.z, 0.5)) {
                    break;
                }
                knockbackDist -= 0.5;
            }
        }

        // Apply validated knockback
        this.position.addScaledVector(backDir, knockbackDist);

        // Keep in bounds
        const bounds = 95;
        this.position.x = Math.max(-bounds, Math.min(bounds, this.position.x));
        this.position.z = Math.max(-bounds, Math.min(bounds, this.position.z));

        // Visual effect - orange muzzle flash and smoke
        this.createShotgunBlastEffect(forward);

        // Particle effect
        if (this.game && this.game.particles && this.game.particles.shotgunBlast) {
            this.game.particles.shotgunBlast(this.position, forward);
        }

        // Screen shake
        if (this.game) {
            this.game.addScreenShake(0.6);
        }

        return true;
    }

    createShotgunBlastEffect(forward) {
        const blastPos = this.position.clone();
        blastPos.y = 1;
        blastPos.addScaledVector(forward, 0.5);

        // Muzzle flash - bright orange cone
        const flashGeo = new THREE.ConeGeometry(0.8, 1.5, 8);
        const flashMat = new THREE.MeshBasicMaterial({
            color: 0xffaa44,
            transparent: true,
            opacity: 0.9
        });
        const flash = new THREE.Mesh(flashGeo, flashMat);
        flash.position.copy(blastPos);
        flash.lookAt(blastPos.clone().addScaledVector(forward, 1));
        flash.rotation.x += Math.PI / 2;
        this.scene.add(flash);

        // Smoke puffs
        for (let i = 0; i < 5; i++) {
            const smokeGeo = new THREE.SphereGeometry(0.3 + Math.random() * 0.2, 8, 6);
            const smokeMat = new THREE.MeshBasicMaterial({
                color: 0x888888,
                transparent: true,
                opacity: 0.5
            });
            const smoke = new THREE.Mesh(smokeGeo, smokeMat);
            const offset = new THREE.Vector3(
                (Math.random() - 0.5) * 0.5,
                Math.random() * 0.3,
                (Math.random() - 0.5) * 0.5
            );
            smoke.position.copy(blastPos).add(offset);
            this.scene.add(smoke);

            // Animate smoke
            const smokeVel = forward.clone().multiplyScalar(2 + Math.random());
            smokeVel.y = 1 + Math.random();
            let elapsed = 0;
            const duration = 0.5;
            const animateSmoke = () => {
                elapsed += 0.016;
                const progress = elapsed / duration;
                smoke.position.addScaledVector(smokeVel, 0.016);
                smoke.scale.setScalar(1 + progress);
                smokeMat.opacity = 0.5 * (1 - progress);
                if (progress < 1) {
                    requestAnimationFrame(animateSmoke);
                } else {
                    this.scene.remove(smoke);
                    smoke.geometry.dispose();
                    smoke.material.dispose();
                }
            };
            animateSmoke();
        }

        // Animate flash
        let elapsed = 0;
        const duration = 0.15;
        const animate = () => {
            elapsed += 0.016;
            const progress = elapsed / duration;
            flash.scale.setScalar(1 + progress * 0.5);
            flashMat.opacity = 0.9 * (1 - progress);
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.scene.remove(flash);
                flash.geometry.dispose();
                flash.material.dispose();
            }
        };
        animate();
    }

    createShotgunBolt(direction, damage, range) {
        const startPos = this.position.clone();
        startPos.y = 1.0;

        const boltGeometry = new THREE.SphereGeometry(0.15, 6, 4);
        const boltMaterial = new THREE.MeshBasicMaterial({
            color: 0xffaa44,
            transparent: true,
            opacity: 0.9
        });
        const bolt = new THREE.Mesh(boltGeometry, boltMaterial);
        bolt.position.copy(startPos);
        this.scene.add(bolt);

        this.projectiles.push({
            mesh: bolt,
            direction: direction.clone(),
            speed: 35,
            damage: damage,
            maxRange: range,
            distanceTraveled: 0,
            type: 'shotgun',
            hitEnemies: new Set()
        });
    }

    // R - Trap: Throw trap to target position
    useTrap(targetPosition = null) {
        const ability = this.abilities.trap;
        if (ability.cooldownRemaining > 0) return false;

        ability.cooldownRemaining = ability.cooldown;

        // No animation - instant throw
        this.createTrap(targetPosition);

        return true;
    }

    createTrap(targetPosition = null) {
        const ability = this.abilities.trap;
        // If target position provided, throw to that location, otherwise place at player position
        const trapPos = targetPosition ? new THREE.Vector3(targetPosition.x, 0.1, targetPosition.z) : this.position.clone();
        trapPos.y = 0.1;

        // Trap visual - spiky bear trap look
        const trapGroup = new THREE.Group();
        trapGroup.position.copy(trapPos);

        // Base plate
        const baseGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 8);
        const baseMaterial = new THREE.MeshStandardMaterial({
            color: 0x444444,
            metalness: 0.8,
            roughness: 0.3
        });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        trapGroup.add(base);

        // Spikes
        const spikeCount = 8;
        for (let i = 0; i < spikeCount; i++) {
            const angle = (i / spikeCount) * Math.PI * 2;
            const spikeGeometry = new THREE.ConeGeometry(0.08, 0.3, 4);
            const spikeMaterial = new THREE.MeshStandardMaterial({
                color: 0x666666,
                metalness: 0.9,
                roughness: 0.2
            });
            const spike = new THREE.Mesh(spikeGeometry, spikeMaterial);
            spike.position.set(
                Math.cos(angle) * 0.35,
                0.2,
                Math.sin(angle) * 0.35
            );
            trapGroup.add(spike);
        }

        // Detection ring (starts invisible, fades in when armed)
        const ringGeometry = new THREE.RingGeometry(ability.radius - 0.2, ability.radius, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0xff4444,
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.05;
        trapGroup.add(ring);

        this.scene.add(trapGroup);

        this.traps.push({
            mesh: trapGroup,
            ring: ring,
            position: trapPos.clone(),
            radius: ability.radius,
            damage: ability.damage,
            armTime: ability.armTime,
            isArmed: false
        });

        // Placement effect - quick dust puff
        this.createTrapPlaceEffect(trapPos);

        // Particle effect
        if (this.game && this.game.particles && this.game.particles.trapPlace) {
            this.game.particles.trapPlace(trapPos);
        }
    }

    createTrapPlaceEffect(pos) {
        // Ground dust ring
        const dustGeo = new THREE.RingGeometry(0.2, 0.8, 12);
        const dustMat = new THREE.MeshBasicMaterial({
            color: 0x886644,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const dust = new THREE.Mesh(dustGeo, dustMat);
        dust.position.set(pos.x, 0.1, pos.z);
        dust.rotation.x = -Math.PI / 2;
        this.scene.add(dust);

        // Animate
        let elapsed = 0;
        const duration = 0.3;
        const animate = () => {
            elapsed += 0.016;
            const progress = elapsed / duration;
            dust.scale.setScalar(1 + progress * 2);
            dustMat.opacity = 0.6 * (1 - progress);
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.scene.remove(dust);
                dust.geometry.dispose();
                dust.material.dispose();
            }
        };
        animate();
    }

    updateTraps(deltaTime) {
        for (let i = this.traps.length - 1; i >= 0; i--) {
            const trap = this.traps[i];

            if (!trap.isArmed) {
                // Count down arm time
                trap.armTime -= deltaTime;
                if (trap.armTime <= 0) {
                    trap.isArmed = true;
                    // Fade in detection ring
                    trap.ring.material.opacity = 0.3;
                }
            } else {
                // Check for enemies
                if (this.game && this.game.enemies) {
                    for (const enemy of this.game.enemies) {
                        if (!enemy.isAlive) continue;

                        const dist = enemy.position.distanceTo(trap.position);
                        if (dist < trap.radius) {
                            // Explode the trap!
                            this.explodeTrap(trap);
                            this.traps.splice(i, 1);
                            break;
                        }
                    }
                }
            }
        }
    }

    explodeTrap(trap) {
        // Particle effect
        if (this.game && this.game.particles && this.game.particles.trapTrigger) {
            this.game.particles.trapTrigger(trap.position);
        }

        // Deal damage to all enemies in radius
        if (this.game && this.game.enemies) {
            for (const enemy of this.game.enemies) {
                if (!enemy.isAlive) continue;

                const dist = enemy.position.distanceTo(trap.position);
                if (dist < trap.radius) {
                    enemy.takeDamage(trap.damage, this);

                    if (this.game && this.game.effects) {
                        this.game.effects.createDamageNumber(enemy.position, trap.damage);
                    }

                    // Brief stun
                    if (enemy.stun) {
                        enemy.stun(0.5);
                    }
                }
            }
        }

        // Explosion visual
        const explosionPos = trap.position.clone();
        explosionPos.y = 0.5;

        const explosionGeo = new THREE.SphereGeometry(trap.radius, 16, 12);
        const explosionMat = new THREE.MeshBasicMaterial({
            color: 0xff6644,
            transparent: true,
            opacity: 0.7
        });
        const explosion = new THREE.Mesh(explosionGeo, explosionMat);
        explosion.position.copy(explosionPos);
        this.scene.add(explosion);

        // Animate explosion
        let elapsed = 0;
        const duration = 0.3;
        const animate = () => {
            elapsed += 0.016;
            const progress = elapsed / duration;

            explosion.scale.setScalar(1 + progress * 0.3);
            explosionMat.opacity = 0.7 * (1 - progress);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.scene.remove(explosion);
                explosion.geometry.dispose();
                explosion.material.dispose();
            }
        };
        animate();

        // Remove trap mesh (with proper child disposal)
        trap.mesh.traverse((child) => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            }
        });
        this.scene.remove(trap.mesh);

        // Extra explosion debris
        this.createTrapExplosionDebris(trap.position, trap.radius);

        // Screen shake
        if (this.game) {
            this.game.addScreenShake(0.5);
        }
    }

    createTrapExplosionDebris(pos, radius) {
        // Scatter metal shards flying outward
        const shardCount = 12;
        for (let i = 0; i < shardCount; i++) {
            const angle = (i / shardCount) * Math.PI * 2;
            const shardGeo = new THREE.BoxGeometry(0.1, 0.05, 0.2);
            const shardMat = new THREE.MeshBasicMaterial({
                color: 0x666666,
                transparent: true,
                opacity: 1
            });
            const shard = new THREE.Mesh(shardGeo, shardMat);
            shard.position.set(pos.x, 0.5, pos.z);
            shard.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            this.scene.add(shard);

            const vel = new THREE.Vector3(
                Math.cos(angle) * (3 + Math.random() * 2),
                2 + Math.random() * 3,
                Math.sin(angle) * (3 + Math.random() * 2)
            );

            let elapsed = 0;
            const duration = 0.6;
            const animate = () => {
                elapsed += 0.016;
                const progress = elapsed / duration;

                // Gravity
                vel.y -= 0.3;

                shard.position.addScaledVector(vel, 0.016);
                shard.rotation.x += 0.2;
                shard.rotation.z += 0.15;
                shardMat.opacity = 1 - progress;

                if (progress < 1 && shard.position.y > 0) {
                    requestAnimationFrame(animate);
                } else {
                    this.scene.remove(shard);
                    shard.geometry.dispose();
                    shard.material.dispose();
                }
            };
            animate();
        }

        // Fire sparks
        for (let i = 0; i < 8; i++) {
            const sparkGeo = new THREE.SphereGeometry(0.08, 4, 4);
            const sparkMat = new THREE.MeshBasicMaterial({
                color: 0xff6644,
                transparent: true,
                opacity: 1
            });
            const spark = new THREE.Mesh(sparkGeo, sparkMat);
            spark.position.set(
                pos.x + (Math.random() - 0.5) * radius,
                0.3 + Math.random() * 0.5,
                pos.z + (Math.random() - 0.5) * radius
            );
            this.scene.add(spark);

            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * 4,
                3 + Math.random() * 2,
                (Math.random() - 0.5) * 4
            );

            let elapsed = 0;
            const duration = 0.4;
            const animate = () => {
                elapsed += 0.016;
                const progress = elapsed / duration;
                vel.y -= 0.2;
                spark.position.addScaledVector(vel, 0.016);
                sparkMat.opacity = 1 - progress;
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    this.scene.remove(spark);
                    spark.geometry.dispose();
                    spark.material.dispose();
                }
            };
            animate();
        }
    }

    // C - Giant Arrow: Piercing shot in a line
    useGiantArrow(direction = null) {
        const ability = this.abilities.giantArrow;
        if (ability.cooldownRemaining > 0) return false;

        ability.cooldownRemaining = ability.cooldown;

        let forward;
        if (direction) {
            forward = new THREE.Vector3(direction.x, 0, direction.z).normalize();
            this.rotation = Math.atan2(forward.x, forward.z);
        } else {
            forward = new THREE.Vector3(Math.sin(this.rotation), 0, Math.cos(this.rotation));
        }

        if (this.useAnimatedCharacter) {
            this.character.playAttack(3);
        }

        this.createGiantArrowProjectile(forward);

        // Charge effect - red energy gathering
        this.createGiantArrowChargeEffect();

        return true;
    }

    createGiantArrowProjectile(direction) {
        const ability = this.abilities.giantArrow;
        const startPos = this.position.clone();
        startPos.y = 1.2;

        // Giant arrow mesh
        const arrowGroup = new THREE.Group();
        arrowGroup.position.copy(startPos);

        // Shaft
        const shaftGeometry = new THREE.CylinderGeometry(0.1, 0.1, 2, 8);
        const shaftMaterial = new THREE.MeshBasicMaterial({ color: 0x8B4513 });
        const shaft = new THREE.Mesh(shaftGeometry, shaftMaterial);
        shaft.rotation.x = Math.PI / 2;
        arrowGroup.add(shaft);

        // Arrowhead
        const headGeometry = new THREE.ConeGeometry(0.25, 0.6, 6);
        const headMaterial = new THREE.MeshBasicMaterial({ color: 0xaaaaaa });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.rotation.x = -Math.PI / 2;
        head.position.z = 1.3;
        arrowGroup.add(head);

        // Glow effect
        const glowGeometry = new THREE.SphereGeometry(0.4, 8, 6);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xff4444,
            transparent: true,
            opacity: 0.4
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.z = 1;
        arrowGroup.add(glow);

        // Point in direction
        const targetPos = startPos.clone().addScaledVector(direction, 5);
        arrowGroup.lookAt(targetPos);

        this.scene.add(arrowGroup);

        this.giantArrows.push({
            mesh: arrowGroup,
            direction: direction.clone(),
            speed: ability.speed,
            damage: ability.damage,
            maxRange: ability.range,
            width: ability.width,
            distanceTraveled: 0,
            hitEnemies: new Set()
        });
    }

    updateGiantArrows(deltaTime) {
        for (let i = this.giantArrows.length - 1; i >= 0; i--) {
            const arrow = this.giantArrows[i];

            // Move the arrow
            const moveAmount = arrow.speed * deltaTime;
            arrow.mesh.position.addScaledVector(arrow.direction, moveAmount);
            arrow.distanceTraveled += moveAmount;

            // Check for enemy hits (piercing - hits all in path)
            if (this.game && this.game.enemies) {
                const arrowPos = arrow.mesh.position;
                for (const enemy of this.game.enemies) {
                    if (!enemy.isAlive || arrow.hitEnemies.has(enemy)) continue;

                    const dist = new THREE.Vector3(
                        enemy.position.x - arrowPos.x,
                        0,
                        enemy.position.z - arrowPos.z
                    ).length();

                    if (dist < arrow.width + 0.5) {
                        enemy.takeDamage(arrow.damage, this);
                        arrow.hitEnemies.add(enemy);

                        if (this.game && this.game.effects) {
                            this.game.effects.createDamageNumber(enemy.position, arrow.damage);
                        }

                        // Impact effect
                        this.createGiantArrowHitEffect(enemy.position.clone());
                    }
                }
            }

            // Trail effect - occasional red sparks
            if (Math.random() < 0.3) {
                this.createGiantArrowTrailSpark(arrow.mesh.position.clone());
            }

            // Particle trail effect
            if (this.game && this.game.particles && this.game.particles.giantArrowTrail) {
                this.game.particles.giantArrowTrail(arrow.mesh.position);
            }

            // Check max range
            if (arrow.distanceTraveled >= arrow.maxRange) {
                // End-of-range impact explosion
                if (this.game && this.game.particles && this.game.particles.giantArrowImpact) {
                    this.game.particles.giantArrowImpact(arrow.mesh.position);
                }
                // Dispose all child meshes properly
                arrow.mesh.traverse((child) => {
                    if (child.isMesh) {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) child.material.dispose();
                    }
                });
                this.scene.remove(arrow.mesh);
                this.giantArrows.splice(i, 1);
            }
        }
    }

    // Also need to update general projectiles for arrow wave, shotgun, spin arrows
    updateProjectiles(deltaTime) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];

            // Homing bolts (auto-attack)
            if (proj.type === 'bolt') {
                if (!proj.target || !proj.target.isAlive) {
                    // Dispose bolt and tip child
                    proj.mesh.traverse((child) => {
                        if (child.isMesh) {
                            if (child.geometry) child.geometry.dispose();
                            if (child.material) child.material.dispose();
                        }
                    });
                    this.scene.remove(proj.mesh);
                    this.projectiles.splice(i, 1);
                    continue;
                }

                const targetPos = proj.target.position.clone();
                targetPos.y += 1;

                const dir = new THREE.Vector3().subVectors(targetPos, proj.mesh.position);
                const dist = dir.length();
                dir.normalize();

                proj.mesh.position.addScaledVector(dir, proj.speed * deltaTime);
                proj.mesh.lookAt(targetPos);
                proj.mesh.rotation.x += Math.PI / 2;

                // Arrow trail particles
                if (this.game && this.game.particles && this.game.particles.arrowTrail) {
                    this.game.particles.arrowTrail(proj.mesh.position);
                }

                if (dist < 0.5) {
                    proj.target.takeDamage(proj.damage, this);

                    if (this.game && this.game.effects) {
                        this.game.effects.createDamageNumber(proj.target.position, proj.damage);
                    }

                    // Impact spark
                    this.createArrowHitSpark(proj.mesh.position.clone());

                    // Dispose bolt and tip child
                    proj.mesh.traverse((child) => {
                        if (child.isMesh) {
                            if (child.geometry) child.geometry.dispose();
                            if (child.material) child.material.dispose();
                        }
                    });
                    this.scene.remove(proj.mesh);
                    this.projectiles.splice(i, 1);
                }
            }
            // Directional projectiles (arrow wave, shotgun, spin)
            else if (proj.direction) {
                const moveAmount = proj.speed * deltaTime;
                proj.mesh.position.addScaledVector(proj.direction, moveAmount);
                proj.distanceTraveled += moveAmount;

                // Check enemy hits
                if (this.game && this.game.enemies) {
                    for (const enemy of this.game.enemies) {
                        if (!enemy.isAlive || proj.hitEnemies.has(enemy)) continue;

                        // Use XZ distance only (ignore height difference)
                        const dx = enemy.position.x - proj.mesh.position.x;
                        const dz = enemy.position.z - proj.mesh.position.z;
                        const dist = Math.sqrt(dx * dx + dz * dz);
                        if (dist < 1.5) {
                            enemy.takeDamage(proj.damage, this);
                            proj.hitEnemies.add(enemy);

                            if (this.game && this.game.effects) {
                                this.game.effects.createDamageNumber(enemy.position, proj.damage);
                            }

                            // Non-piercing projectiles stop on hit
                            if (proj.type === 'shotgun') {
                                this.scene.remove(proj.mesh);
                                proj.mesh.geometry.dispose();
                                proj.mesh.material.dispose();
                                this.projectiles.splice(i, 1);
                                break;
                            }
                        }
                    }
                }

                // Check max range
                if (proj.distanceTraveled >= proj.maxRange) {
                    this.scene.remove(proj.mesh);
                    proj.mesh.geometry.dispose();
                    proj.mesh.material.dispose();
                    this.projectiles.splice(i, 1);
                }
            }
        }
    }

    // Health Potion
    usePotion() {
        const ability = this.abilities.potion;
        if (ability.cooldownRemaining > 0) return false;

        ability.cooldownRemaining = ability.cooldown;
        this.health = Math.min(this.maxHealth, this.health + ability.healAmount);

        if (this.game && this.game.effects) {
            this.game.effects.createPotionEffect(this.position);
            this.game.effects.createDamageNumber(this.position, ability.healAmount, true);
        }

        // Green heal sparkles
        this.createHealEffect();

        return true;
    }

    takeDamage(amount) {
        this.health -= amount;

        if (this.useAnimatedCharacter) {
            this.character.playImpact();
        }

        // Red hit flash
        this.createPlayerHitEffect();

        if (this.game) {
            this.game.addScreenShake(Math.min(amount / 20, 0.5));
        }

        if (this.health <= 0) {
            this.health = 0;
            this.die();
        }
    }

    die() {
        console.log('Hunter died!');

        if (this.useAnimatedCharacter) {
            this.character.playDeath();
        }

        setTimeout(() => {
            this.health = this.maxHealth;
            this.position.set(0, 0, 0);
            if (this.useAnimatedCharacter) {
                this.character.playAnimation('idle', true);
            }
        }, 2000);
    }

    // Buff system
    applyBuff(buffType, duration, value) {
        const baseValue = this.getBuffBaseValue(buffType);

        this.buffs[buffType] = {
            duration: duration,
            value: value,
            baseValue: baseValue
        };

        this.applyBuffEffect(buffType, value);

        // Visual effect
        if (this.game && this.game.particles && this.game.particles.buffApplied) {
            this.game.particles.buffApplied(this.position, this.getBuffColor(buffType));
        }
    }

    getBuffBaseValue(buffType) {
        switch (buffType) {
            case 'speed': return this.moveSpeed;
            case 'damage': return this.autoAttackDamage;
            case 'defense': return 0;
            default: return 0;
        }
    }

    getBuffColor(buffType) {
        switch (buffType) {
            case 'speed': return 0x44ff44;
            case 'damage': return 0xff4444;
            case 'defense': return 0x4444ff;
            default: return 0xffffff;
        }
    }

    applyBuffEffect(buffType, value) {
        switch (buffType) {
            case 'speed':
                this.moveSpeed *= (1 + value);
                break;
            case 'damage':
                this.autoAttackDamage = Math.floor(this.autoAttackDamage * (1 + value));
                break;
        }
    }

    removeBuffEffect(buffType, buff) {
        switch (buffType) {
            case 'speed':
                this.moveSpeed = buff.baseValue;
                break;
            case 'damage':
                this.autoAttackDamage = buff.baseValue;
                break;
        }
    }

    updateBuffs(deltaTime) {
        for (const buffType in this.buffs) {
            const buff = this.buffs[buffType];
            buff.duration -= deltaTime;

            if (buff.duration <= 0) {
                this.removeBuffEffect(buffType, buff);
                delete this.buffs[buffType];
            }
        }
    }

    getStats() {
        const baseStats = {
            damage: this.autoAttackDamage,
            defense: 0,
            health: this.maxHealth,
            speed: this.moveSpeed
        };

        // Add equipment bonuses
        if (this.inventory) {
            const equipStats = this.inventory.getEquipmentStats();
            baseStats.damage += equipStats.damage || 0;
            baseStats.defense += equipStats.defense || 0;
            baseStats.health += equipStats.health || 0;
            baseStats.speed += equipStats.speed || 0;
        }

        return baseStats;
    }

    // Effect helper methods
    createArrowHitSpark(pos) {
        const sparkGeo = new THREE.SphereGeometry(0.15, 6, 4);
        const sparkMat = new THREE.MeshBasicMaterial({
            color: 0xffff88,
            transparent: true,
            opacity: 1
        });
        const spark = new THREE.Mesh(sparkGeo, sparkMat);
        spark.position.copy(pos);
        this.scene.add(spark);

        let elapsed = 0;
        const duration = 0.15;
        const animate = () => {
            elapsed += 0.016;
            const progress = elapsed / duration;
            spark.scale.setScalar(1 + progress);
            sparkMat.opacity = 1 - progress;
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.scene.remove(spark);
                spark.geometry.dispose();
                spark.material.dispose();
            }
        };
        animate();
    }

    createGiantArrowChargeEffect() {
        const pos = this.position.clone();
        pos.y = 1;

        // Red energy particles converging
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const startPos = pos.clone();
            startPos.x += Math.cos(angle) * 2;
            startPos.z += Math.sin(angle) * 2;

            const particleGeo = new THREE.SphereGeometry(0.1, 4, 4);
            const particleMat = new THREE.MeshBasicMaterial({
                color: 0xff4444,
                transparent: true,
                opacity: 0.8
            });
            const particle = new THREE.Mesh(particleGeo, particleMat);
            particle.position.copy(startPos);
            this.scene.add(particle);

            let elapsed = 0;
            const duration = 0.25;
            const animate = () => {
                elapsed += 0.016;
                const progress = elapsed / duration;
                particle.position.lerpVectors(startPos, pos, progress);
                particle.scale.setScalar(1 - progress * 0.5);
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    this.scene.remove(particle);
                    particle.geometry.dispose();
                    particle.material.dispose();
                }
            };
            animate();
        }
    }

    createGiantArrowHitEffect(pos) {
        pos.y = 1;

        // Red burst
        const burstGeo = new THREE.SphereGeometry(0.5, 8, 6);
        const burstMat = new THREE.MeshBasicMaterial({
            color: 0xff4444,
            transparent: true,
            opacity: 0.8
        });
        const burst = new THREE.Mesh(burstGeo, burstMat);
        burst.position.copy(pos);
        this.scene.add(burst);

        let elapsed = 0;
        const duration = 0.2;
        const animate = () => {
            elapsed += 0.016;
            const progress = elapsed / duration;
            burst.scale.setScalar(1 + progress * 2);
            burstMat.opacity = 0.8 * (1 - progress);
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.scene.remove(burst);
                burst.geometry.dispose();
                burst.material.dispose();
            }
        };
        animate();
    }

    createGiantArrowTrailSpark(pos) {
        const sparkGeo = new THREE.SphereGeometry(0.08, 4, 4);
        const sparkMat = new THREE.MeshBasicMaterial({
            color: 0xff6644,
            transparent: true,
            opacity: 0.8
        });
        const spark = new THREE.Mesh(sparkGeo, sparkMat);
        spark.position.copy(pos);
        spark.position.y += (Math.random() - 0.5) * 0.3;
        this.scene.add(spark);

        let elapsed = 0;
        const duration = 0.3;
        const animate = () => {
            elapsed += 0.016;
            const progress = elapsed / duration;
            spark.position.y -= 0.02;
            sparkMat.opacity = 0.8 * (1 - progress);
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.scene.remove(spark);
                spark.geometry.dispose();
                spark.material.dispose();
            }
        };
        animate();
    }

    createHealEffect() {
        const pos = this.position.clone();

        // Rising green sparkles
        for (let i = 0; i < 8; i++) {
            const sparkGeo = new THREE.SphereGeometry(0.08, 4, 4);
            const sparkMat = new THREE.MeshBasicMaterial({
                color: 0x44ff44,
                transparent: true,
                opacity: 1
            });
            const spark = new THREE.Mesh(sparkGeo, sparkMat);
            spark.position.set(
                pos.x + (Math.random() - 0.5) * 1,
                0.5 + Math.random() * 0.5,
                pos.z + (Math.random() - 0.5) * 1
            );
            this.scene.add(spark);

            let elapsed = 0;
            const duration = 0.6;
            const animate = () => {
                elapsed += 0.016;
                const progress = elapsed / duration;
                spark.position.y += 0.03;
                sparkMat.opacity = 1 - progress;
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    this.scene.remove(spark);
                    spark.geometry.dispose();
                    spark.material.dispose();
                }
            };
            animate();
        }
    }

    createPlayerHitEffect() {
        const pos = this.position.clone();
        pos.y = 1;

        // Red flash ring
        const ringGeo = new THREE.RingGeometry(0.3, 0.8, 12);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xff4444,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.copy(pos);
        ring.rotation.x = -Math.PI / 2;
        this.scene.add(ring);

        let elapsed = 0;
        const duration = 0.2;
        const animate = () => {
            elapsed += 0.016;
            const progress = elapsed / duration;
            ring.scale.setScalar(1 + progress * 2);
            ringMat.opacity = 0.8 * (1 - progress);
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.scene.remove(ring);
                ring.geometry.dispose();
                ring.material.dispose();
            }
        };
        animate();
    }

    // Cleanup
    dispose() {
        // Remove projectiles
        for (const proj of this.projectiles) {
            this.scene.remove(proj.mesh);
            proj.mesh.geometry.dispose();
            proj.mesh.material.dispose();
        }
        this.projectiles = [];

        // Remove giant arrows (with proper child disposal)
        for (const arrow of this.giantArrows) {
            arrow.mesh.traverse((child) => {
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                }
            });
            this.scene.remove(arrow.mesh);
        }
        this.giantArrows = [];

        // Remove traps (with proper child disposal)
        for (const trap of this.traps) {
            trap.mesh.traverse((child) => {
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                }
            });
            this.scene.remove(trap.mesh);
        }
        this.traps = [];

        // Remove indicators
        if (this.arrowWaveIndicator) {
            this.scene.remove(this.arrowWaveIndicator);
            this.arrowWaveIndicator.geometry.dispose();
            this.arrowWaveIndicator.material.dispose();
        }
        if (this.shotgunIndicator) {
            this.scene.remove(this.shotgunIndicator);
            this.shotgunIndicator.geometry.dispose();
            this.shotgunIndicator.material.dispose();
        }
        if (this.giantArrowIndicator) {
            this.scene.remove(this.giantArrowIndicator);
            this.giantArrowIndicator.geometry.dispose();
            this.giantArrowIndicator.material.dispose();
        }

        // Remove character
        if (this.character) {
            this.character.dispose();
        }

        // Remove fallback mesh
        if (this.group) {
            this.scene.remove(this.group);
        }
    }
}
