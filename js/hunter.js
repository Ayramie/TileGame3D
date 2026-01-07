import * as THREE from 'three';
import { KayKitCharacter } from './kayKitCharacter.js';

export class Hunter {
    constructor(scene, game) {
        this.scene = scene;
        this.game = game;
        this.position = new THREE.Vector3(0, 0, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.rotation = 0;
        this.className = 'Hunter';

        // Stats - Hunter is mobile with medium health
        this.maxHealth = 200;
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
        this.arrowWaveIndicator.rotation.z = -angle;
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
        this.shotgunIndicator.rotation.z = -angle;
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
        this.giantArrowIndicator.rotation.z = -angle;
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

    updateProjectiles(deltaTime) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];

            if (!proj.target || !proj.target.isAlive) {
                this.scene.remove(proj.mesh);
                proj.mesh.geometry.dispose();
                proj.mesh.material.dispose();
                this.projectiles.splice(i, 1);
                continue;
            }

            const targetPos = proj.target.position.clone();
            targetPos.y += 1;

            const dir = new THREE.Vector3().subVectors(targetPos, proj.mesh.position);
            const dist = dir.length();
            dir.normalize();

            proj.mesh.position.addScaledVector(dir, proj.speed * deltaTime);

            // Point bolt toward target
            proj.mesh.lookAt(targetPos);
            proj.mesh.rotation.x += Math.PI / 2;

            if (dist < 0.5) {
                proj.target.takeDamage(proj.damage, this);

                if (this.game && this.game.effects) {
                    this.game.effects.createDamageNumber(proj.target.position, proj.damage);
                }

                if (this.game && this.game.particles) {
                    this.game.particles.arrowHit(proj.mesh.position);
                }

                this.scene.remove(proj.mesh);
                proj.mesh.geometry.dispose();
                proj.mesh.material.dispose();
                this.projectiles.splice(i, 1);
            }
        }
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

        // Visual effect
        if (this.game && this.game.particles) {
            this.game.particles.arrowWave(this.position, forward);
        }

        return true;
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
        const endPos = startPos.clone().addScaledVector(dashDir, ability.dashDistance);

        // Keep in bounds
        const bounds = 95;
        endPos.x = Math.max(-bounds, Math.min(bounds, endPos.x));
        endPos.z = Math.max(-bounds, Math.min(bounds, endPos.z));

        // Animate the dash and fire arrows
        const dashDuration = 0.4;
        let elapsed = 0;
        let arrowsFired = 0;
        const arrowInterval = dashDuration / ability.arrowsPerSpin;

        const animateDash = () => {
            elapsed += 0.016;
            const progress = Math.min(elapsed / dashDuration, 1);

            // Move player
            this.position.lerpVectors(startPos, endPos, progress);

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

        // Trail effect
        if (this.game && this.game.particles) {
            this.game.particles.spinDashTrail(startPos, endPos);
        }

        // Screen shake
        if (this.game) {
            this.game.addScreenShake(0.4);
        }

        return true;
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

        // Knockback player backwards
        const backDir = forward.clone().multiplyScalar(-1);
        this.position.addScaledVector(backDir, ability.knockback);

        // Keep in bounds
        const bounds = 95;
        this.position.x = Math.max(-bounds, Math.min(bounds, this.position.x));
        this.position.z = Math.max(-bounds, Math.min(bounds, this.position.z));

        // Visual effect
        if (this.game && this.game.particles) {
            this.game.particles.shotgunBlast(this.position, forward);
        }

        // Screen shake
        if (this.game) {
            this.game.addScreenShake(0.6);
        }

        return true;
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

    // R - Trap: Place trap that explodes when enemy gets close
    useTrap() {
        const ability = this.abilities.trap;
        if (ability.cooldownRemaining > 0) return false;

        ability.cooldownRemaining = ability.cooldown;

        if (this.useAnimatedCharacter) {
            this.character.playAttack(2);
        }

        this.createTrap();

        return true;
    }

    createTrap() {
        const ability = this.abilities.trap;
        const trapPos = this.position.clone();
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

        // Placement sound/particle
        if (this.game && this.game.particles) {
            this.game.particles.trapPlace(trapPos);
        }
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

        // Remove trap mesh
        this.scene.remove(trap.mesh);

        // Particles
        if (this.game && this.game.particles) {
            this.game.particles.trapExplosion(trap.position, trap.radius);
        }

        // Screen shake
        if (this.game) {
            this.game.addScreenShake(0.5);
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

        // Cast particles
        if (this.game && this.game.particles) {
            this.game.particles.giantArrowCharge(this.position);
        }

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

                        // Impact particles
                        if (this.game && this.game.particles) {
                            this.game.particles.giantArrowHit(enemy.position);
                        }
                    }
                }
            }

            // Trail particles
            if (this.game && this.game.particles && Math.random() < 0.3) {
                this.game.particles.giantArrowTrail(arrow.mesh.position);
            }

            // Check max range
            if (arrow.distanceTraveled >= arrow.maxRange) {
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
                    this.scene.remove(proj.mesh);
                    proj.mesh.geometry.dispose();
                    proj.mesh.material.dispose();
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

                if (dist < 0.5) {
                    proj.target.takeDamage(proj.damage, this);

                    if (this.game && this.game.effects) {
                        this.game.effects.createDamageNumber(proj.target.position, proj.damage);
                    }

                    this.scene.remove(proj.mesh);
                    proj.mesh.geometry.dispose();
                    proj.mesh.material.dispose();
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

                        const dist = enemy.position.distanceTo(proj.mesh.position);
                        if (dist < 1.0) {
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

        if (this.game && this.game.particles) {
            this.game.particles.healEffect(this.position);
        }

        return true;
    }

    takeDamage(amount) {
        this.health -= amount;

        if (this.useAnimatedCharacter) {
            this.character.playImpact();
        }

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

    // Cleanup
    dispose() {
        // Remove projectiles
        for (const proj of this.projectiles) {
            this.scene.remove(proj.mesh);
            proj.mesh.geometry.dispose();
            proj.mesh.material.dispose();
        }
        this.projectiles = [];

        // Remove giant arrows
        for (const arrow of this.giantArrows) {
            this.scene.remove(arrow.mesh);
        }
        this.giantArrows = [];

        // Remove traps
        for (const trap of this.traps) {
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
