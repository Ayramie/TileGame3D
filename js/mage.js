import * as THREE from 'three';
import { KayKitCharacter } from './kayKitCharacter.js';

export class Mage {
    constructor(scene, game) {
        this.scene = scene;
        this.game = game;
        this.position = new THREE.Vector3(0, 0, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.rotation = 0;
        this.className = 'Mage';

        // Stats - Mage has less health but ranged attacks
        this.maxHealth = 300;
        this.health = this.maxHealth;
        this.moveSpeed = 7;
        this.jumpForce = 12;
        this.isGrounded = true;

        // Combat - Ranged
        this.targetEnemy = null;
        this.attackRange = 15; // Much longer range
        this.autoAttackCooldown = 0;
        this.autoAttackCooldownMax = 1.0; // Slower but ranged
        this.autoAttackDamage = 20;

        // Mage Abilities
        this.abilities = {
            blizzard: {
                cooldown: 8,
                cooldownRemaining: 0,
                damage: 10, // per tick
                slowAmount: 0.5, // 50% slow
                duration: 4,
                radius: 5,
                isActive: false
            },
            flameWave: {
                cooldown: 6,
                cooldownRemaining: 0,
                damage: 35,
                range: 8,
                angle: Math.PI * 0.6, // 108 degrees
                isActive: false
            },
            frostNova: {
                cooldown: 8,
                cooldownRemaining: 0,
                damage: 25,
                radius: 6,
                freezeDuration: 2.5, // How long enemies stay frozen
                isActive: false
            },
            frozenOrb: {
                cooldown: 10,
                cooldownRemaining: 0,
                damage: 15, // per tick as it passes
                explosionDamage: 40, // on final explosion
                speed: 6, // Slower, more menacing
                range: 25,
                aoeRadius: 3,
                tickInterval: 0.3,
                isActive: false
            },
            backstep: {
                cooldown: 5,
                cooldownRemaining: 0,
                distance: 6,
                isActive: false
            },
            potion: {
                cooldown: 10,
                cooldownRemaining: 0,
                healAmount: 100,
                isActive: false
            }
        };

        // Frozen orb projectiles (separate from auto-attack projectiles)
        this.frozenOrbs = [];

        // Projectiles for auto-attack
        this.projectiles = [];

        // Active ground effects (blizzard zones)
        this.groundEffects = [];

        // KayKit character controller for animated model
        this.character = new KayKitCharacter(scene);
        this.useAnimatedCharacter = false;
        this.characterLoading = false;

        // Click-to-move target
        this.moveTarget = null;
        this.moveTargetThreshold = 0.5;

        // Ability indicators
        this.blizzardIndicator = null;
        this.flameWaveIndicator = null;
        this.createAbilityIndicators();

        // Visual representation (fallback)
        this.createMesh();

        // Try to load animated character
        this.loadCharacter();
    }

    createAbilityIndicators() {
        // Blizzard circle indicator
        const blizzardGeometry = new THREE.RingGeometry(0.1, this.abilities.blizzard.radius, 32);
        const blizzardMaterial = new THREE.MeshBasicMaterial({
            color: 0x44aaff,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        this.blizzardIndicator = new THREE.Mesh(blizzardGeometry, blizzardMaterial);
        this.blizzardIndicator.rotation.x = -Math.PI / 2;
        this.blizzardIndicator.position.y = 0.1;
        this.blizzardIndicator.visible = false;
        this.scene.add(this.blizzardIndicator);

        // Flame Wave cone indicator
        const coneAngle = this.abilities.flameWave.angle;
        const coneRange = this.abilities.flameWave.range;
        const segments = 32;

        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        for (let i = 0; i <= segments; i++) {
            const angle = -coneAngle / 2 + (coneAngle * i / segments);
            const x = Math.sin(angle) * coneRange;
            const y = Math.cos(angle) * coneRange;
            shape.lineTo(x, y);
        }
        shape.lineTo(0, 0);

        const flameGeometry = new THREE.ShapeGeometry(shape);
        const flameMaterial = new THREE.MeshBasicMaterial({
            color: 0xff4400,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        this.flameWaveIndicator = new THREE.Mesh(flameGeometry, flameMaterial);
        this.flameWaveIndicator.rotation.x = -Math.PI / 2;
        this.flameWaveIndicator.position.y = 0.1;
        this.flameWaveIndicator.visible = false;
        this.scene.add(this.flameWaveIndicator);
    }

    showBlizzardIndicator(show) {
        if (this.blizzardIndicator) {
            this.blizzardIndicator.visible = show;
        }
    }

    updateBlizzardIndicator(mouseWorldPos) {
        if (!this.blizzardIndicator || !this.blizzardIndicator.visible) return;
        this.blizzardIndicator.position.x = mouseWorldPos.x;
        this.blizzardIndicator.position.z = mouseWorldPos.z;
    }

    showFlameWaveIndicator(show) {
        if (this.flameWaveIndicator) {
            this.flameWaveIndicator.visible = show;
        }
    }

    updateFlameWaveIndicator(mouseWorldPos) {
        if (!this.flameWaveIndicator || !this.flameWaveIndicator.visible) return;

        // Position at player
        this.flameWaveIndicator.position.x = this.position.x;
        this.flameWaveIndicator.position.z = this.position.z;

        // Point toward mouse (add PI to flip direction)
        const dx = mouseWorldPos.x - this.position.x;
        const dz = mouseWorldPos.z - this.position.z;
        const angle = Math.atan2(dx, dz);
        this.flameWaveIndicator.rotation.z = -angle + Math.PI;
    }

    async loadCharacter() {
        this.characterLoading = true;
        this.group.visible = false;

        try {
            // Load KayKit Mage character
            const success = await this.character.load('adventurers', 'mage');
            if (success) {
                this.useAnimatedCharacter = true;
                console.log('Using KayKit Mage character model');
            } else {
                this.group.visible = true;
            }
        } catch (error) {
            console.warn('Failed to load KayKit mage character, using fallback:', error);
            this.group.visible = true;
        }
        this.characterLoading = false;
    }

    createMesh() {
        // Simple mage fallback mesh - robed figure
        this.group = new THREE.Group();

        const robeMaterial = new THREE.MeshStandardMaterial({
            color: 0x4422aa,
            roughness: 0.7
        });
        const skinMaterial = new THREE.MeshStandardMaterial({
            color: 0xffddaa,
            roughness: 0.7
        });

        // Robe body
        const robeGeometry = new THREE.ConeGeometry(0.5, 1.5, 8);
        const robe = new THREE.Mesh(robeGeometry, robeMaterial);
        robe.position.y = 0.75;
        this.group.add(robe);

        // Head
        const headGeometry = new THREE.SphereGeometry(0.25, 16, 12);
        const head = new THREE.Mesh(headGeometry, skinMaterial);
        head.position.y = 1.7;
        this.group.add(head);

        // Wizard hat
        const hatGeometry = new THREE.ConeGeometry(0.3, 0.6, 8);
        const hatMaterial = new THREE.MeshStandardMaterial({ color: 0x2211aa });
        const hat = new THREE.Mesh(hatGeometry, hatMaterial);
        hat.position.y = 2.1;
        this.group.add(hat);

        // Staff
        const staffGeometry = new THREE.CylinderGeometry(0.03, 0.03, 1.8, 8);
        const staffMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const staff = new THREE.Mesh(staffGeometry, staffMaterial);
        staff.position.set(0.4, 1, 0);
        staff.rotation.z = -0.2;
        this.group.add(staff);

        // Staff orb
        const orbGeometry = new THREE.SphereGeometry(0.12, 8, 6);
        const orbMaterial = new THREE.MeshStandardMaterial({
            color: 0x44aaff,
            emissive: 0x2266ff,
            emissiveIntensity: 0.5
        });
        const orb = new THREE.Mesh(orbGeometry, orbMaterial);
        orb.position.set(0.55, 1.9, 0);
        this.group.add(orb);

        this.scene.add(this.group);
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

        // Update ground effects
        this.updateGroundEffects(deltaTime);

        // Update frozen orbs
        this.updateFrozenOrbs(deltaTime);

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

        // Check if using keyboard movement
        const usingKeyboard = forwardBack.length() > 0 || strafe.length() > 0;

        // Clear move target if using keyboard
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

    // Ranged auto-attack - fires magic bolt at target
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

        // Play cast animation
        if (this.useAnimatedCharacter) {
            this.character.playAttack(1);
        }

        // Create magic bolt projectile
        this.createMagicBolt(this.targetEnemy);

        return true;
    }

    createMagicBolt(target) {
        const startPos = this.position.clone();
        startPos.y += 1.5;

        // Projectile visual
        const boltGeometry = new THREE.SphereGeometry(0.2, 8, 6);
        const boltMaterial = new THREE.MeshBasicMaterial({
            color: 0x44aaff,
            transparent: true,
            opacity: 0.9
        });
        const bolt = new THREE.Mesh(boltGeometry, boltMaterial);
        bolt.position.copy(startPos);
        this.scene.add(bolt);

        // Glow effect
        const glowGeometry = new THREE.SphereGeometry(0.35, 8, 6);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x88ccff,
            transparent: true,
            opacity: 0.4
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        bolt.add(glow);

        this.projectiles.push({
            mesh: bolt,
            target: target,
            speed: 20,
            damage: this.autoAttackDamage,
            type: 'magicBolt'
        });

        // Cast particles
        if (this.game && this.game.particles && this.game.particles.magicCast) {
            this.game.particles.magicCast(startPos);
        }
    }

    updateProjectiles(deltaTime) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];

            if (!proj.target || !proj.target.isAlive) {
                // Target died, remove projectile (with glow child disposal)
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

            // Move toward target
            const targetPos = proj.target.position.clone();
            targetPos.y += 1;

            const dir = new THREE.Vector3().subVectors(targetPos, proj.mesh.position);
            const dist = dir.length();
            dir.normalize();

            proj.mesh.position.addScaledVector(dir, proj.speed * deltaTime);

            // Check hit
            if (dist < 0.5) {
                // Deal damage
                proj.target.takeDamage(proj.damage, this);

                // Damage number
                if (this.game && this.game.effects) {
                    this.game.effects.createDamageNumber(proj.target.position, proj.damage);
                }

                // Impact particles
                if (this.game && this.game.particles && this.game.particles.magicImpact) {
                    this.game.particles.magicImpact(proj.mesh.position);
                }

                // Remove projectile (with glow child disposal)
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
    }

    // Q - Blizzard: AoE slow zone at target location
    useBlizzard(targetPosition) {
        const ability = this.abilities.blizzard;
        if (ability.cooldownRemaining > 0) return false;

        ability.cooldownRemaining = ability.cooldown;

        // Play cast animation
        if (this.useAnimatedCharacter) {
            this.character.playAttack(2);
        }

        // Create blizzard zone
        this.createBlizzardZone(targetPosition);

        return true;
    }

    createBlizzardZone(position) {
        const ability = this.abilities.blizzard;

        // Visual - icy circle on ground
        const zoneGeometry = new THREE.CircleGeometry(ability.radius, 32);
        const zoneMaterial = new THREE.MeshBasicMaterial({
            color: 0x88ccff,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const zone = new THREE.Mesh(zoneGeometry, zoneMaterial);
        zone.rotation.x = -Math.PI / 2;
        zone.position.copy(position);
        zone.position.y = 0.35;
        this.scene.add(zone);

        // Border ring
        const borderGeometry = new THREE.RingGeometry(ability.radius - 0.15, ability.radius, 32);
        const borderMaterial = new THREE.MeshBasicMaterial({
            color: 0xaaddff,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const border = new THREE.Mesh(borderGeometry, borderMaterial);
        border.rotation.x = -Math.PI / 2;
        border.position.copy(position);
        border.position.y = 0.36;
        this.scene.add(border);

        this.groundEffects.push({
            type: 'blizzard',
            mesh: zone,
            border: border,
            position: position.clone(),
            radius: ability.radius,
            damage: ability.damage,
            slowAmount: ability.slowAmount,
            duration: ability.duration,
            tickTimer: 0
        });

        // Initial burst particles
        if (this.game && this.game.particles && this.game.particles.blizzardBurst) {
            this.game.particles.blizzardBurst(position);
        }
    }

    updateGroundEffects(deltaTime) {
        for (let i = this.groundEffects.length - 1; i >= 0; i--) {
            const effect = this.groundEffects[i];
            effect.duration -= deltaTime;

            if (effect.duration <= 0) {
                // Remove effect
                this.scene.remove(effect.mesh);
                this.scene.remove(effect.border);
                effect.mesh.geometry.dispose();
                effect.mesh.material.dispose();
                effect.border.geometry.dispose();
                effect.border.material.dispose();
                this.groundEffects.splice(i, 1);
                continue;
            }

            // Tick damage and slow
            effect.tickTimer += deltaTime;
            if (effect.tickTimer >= 0.5) {
                effect.tickTimer = 0;

                // Apply to enemies in range
                if (this.game && this.game.enemies) {
                    for (const enemy of this.game.enemies) {
                        if (!enemy.isAlive) continue;

                        const dist = enemy.position.distanceTo(effect.position);
                        if (dist < effect.radius) {
                            // Damage
                            enemy.takeDamage(effect.damage, this);

                            if (this.game.effects) {
                                this.game.effects.createDamageNumber(enemy.position, effect.damage);
                            }

                            // Apply slow
                            if (!enemy.originalMoveSpeed) {
                                enemy.originalMoveSpeed = enemy.moveSpeed;
                            }
                            enemy.moveSpeed = enemy.originalMoveSpeed * effect.slowAmount;
                            enemy.slowTimer = 1.0; // Reset slow timer
                        }
                    }
                }

                // Spawn ice particles
                if (this.game && this.game.particles && this.game.particles.blizzardTick) {
                    this.game.particles.blizzardTick(effect.position);
                }
            }

            // Fade out near end
            if (effect.duration < 1) {
                effect.mesh.material.opacity = effect.duration * 0.4;
                effect.border.material.opacity = effect.duration * 0.7;
            }
        }
    }

    // W - Flame Wave: Cone fire attack toward direction
    useFlameWave(enemies, direction = null) {
        const ability = this.abilities.flameWave;
        if (ability.cooldownRemaining > 0) return false;

        ability.cooldownRemaining = ability.cooldown;

        // Use provided direction or default to player facing
        let forward;
        if (direction) {
            forward = new THREE.Vector3(direction.x, 0, direction.z).normalize();
            // Face the flame wave direction
            this.rotation = Math.atan2(forward.x, forward.z);
        } else {
            forward = new THREE.Vector3(
                Math.sin(this.rotation),
                0,
                Math.cos(this.rotation)
            );
        }

        // Play cast animation
        if (this.useAnimatedCharacter) {
            this.character.playAttack(3);
        }

        // Visual effect
        if (this.game && this.game.effects) {
            this.game.effects.createFlameWaveEffect(this.position, this.rotation);
        }

        // Particle effect
        if (this.game && this.game.particles && this.game.particles.flameWave) {
            this.game.particles.flameWave(this.position, forward, ability.range);
        }

        // Hit enemies in cone
        let hitCount = 0;
        for (const enemy of enemies) {
            if (!enemy.isAlive) continue;

            const dx = enemy.position.x - this.position.x;
            const dz = enemy.position.z - this.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist > ability.range) continue;

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

    // E - Frost Nova: AoE freeze around player
    useFrostNova() {
        const ability = this.abilities.frostNova;
        if (ability.cooldownRemaining > 0) return false;

        ability.cooldownRemaining = ability.cooldown;

        // Play cast animation
        if (this.useAnimatedCharacter) {
            this.character.playAttack(2);
        }

        // Create frost nova visual effect
        this.createFrostNovaEffect();

        // Freeze and damage all enemies in radius
        if (this.game && this.game.enemies) {
            for (const enemy of this.game.enemies) {
                if (!enemy.isAlive) continue;

                const dist = this.position.distanceTo(enemy.position);
                if (dist < ability.radius) {
                    // Deal damage
                    enemy.takeDamage(ability.damage, this);

                    if (this.game && this.game.effects) {
                        this.game.effects.createDamageNumber(enemy.position, ability.damage);
                    }

                    // Freeze the enemy (stun them)
                    if (enemy.stun) {
                        enemy.stun(ability.freezeDuration);
                    }

                    // Visual freeze effect on enemy
                    this.applyFreezeVisual(enemy);
                }
            }
        }

        // Screen shake
        if (this.game) {
            this.game.addScreenShake(0.5);
        }

        return true;
    }

    createFrostNovaEffect() {
        const ability = this.abilities.frostNova;

        // Expanding ring effect
        const ringGeometry = new THREE.RingGeometry(0.5, ability.radius, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0x88ddff,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = -Math.PI / 2;
        ring.position.copy(this.position);
        ring.position.y = 0.2;
        this.scene.add(ring);

        // Ice spikes around the ring
        const spikeCount = 12;
        const spikes = [];
        for (let i = 0; i < spikeCount; i++) {
            const angle = (i / spikeCount) * Math.PI * 2;
            const spikeGeo = new THREE.ConeGeometry(0.3, 1.5, 4);
            const spikeMat = new THREE.MeshBasicMaterial({
                color: 0xaaeeff,
                transparent: true,
                opacity: 0.8
            });
            const spike = new THREE.Mesh(spikeGeo, spikeMat);
            spike.position.set(
                this.position.x + Math.cos(angle) * ability.radius * 0.8,
                0.75,
                this.position.z + Math.sin(angle) * ability.radius * 0.8
            );
            spike.rotation.x = Math.PI; // Point up
            this.scene.add(spike);
            spikes.push(spike);
        }

        // Animate and remove
        let elapsed = 0;
        const duration = 0.5;
        const animate = () => {
            elapsed += 0.016;
            const progress = elapsed / duration;

            // Fade out ring
            ringMaterial.opacity = 0.7 * (1 - progress);

            // Sink spikes
            for (const spike of spikes) {
                spike.position.y = 0.75 * (1 - progress);
                spike.material.opacity = 0.8 * (1 - progress);
            }

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Cleanup
                this.scene.remove(ring);
                ring.geometry.dispose();
                ring.material.dispose();
                for (const spike of spikes) {
                    this.scene.remove(spike);
                    spike.geometry.dispose();
                    spike.material.dispose();
                }
            }
        };
        animate();

        // Particle effect
        if (this.game && this.game.particles && this.game.particles.frostNova) {
            this.game.particles.frostNova(this.position, ability.radius);
        }
    }

    applyFreezeVisual(enemy) {
        // Add a blue tint to frozen enemy
        if (enemy.mesh) {
            enemy.mesh.traverse((child) => {
                if (child.isMesh && child.material) {
                    // Store original color
                    if (!child.userData.originalColor) {
                        child.userData.originalColor = child.material.color.getHex();
                    }
                    child.material.color.setHex(0x88ccff);
                }
            });

            // Remove freeze visual after duration
            setTimeout(() => {
                if (enemy.mesh) {
                    enemy.mesh.traverse((child) => {
                        if (child.isMesh && child.material && child.userData.originalColor) {
                            child.material.color.setHex(child.userData.originalColor);
                        }
                    });
                }
            }, this.abilities.frostNova.freezeDuration * 1000);
        }
    }

    // C - Frozen Orb: Shoots orb that damages as it travels then explodes
    useFrozenOrb(direction) {
        const ability = this.abilities.frozenOrb;
        if (ability.cooldownRemaining > 0) return false;

        ability.cooldownRemaining = ability.cooldown;

        // Calculate direction
        let dir;
        if (direction) {
            dir = new THREE.Vector3(direction.x, 0, direction.z).normalize();
            this.rotation = Math.atan2(dir.x, dir.z);
        } else {
            dir = new THREE.Vector3(
                Math.sin(this.rotation),
                0,
                Math.cos(this.rotation)
            );
        }

        // Play cast animation
        if (this.useAnimatedCharacter) {
            this.character.playAttack(1);
        }

        // Create the frozen orb projectile
        this.createFrozenOrbProjectile(dir);

        return true;
    }

    createFrozenOrbProjectile(direction) {
        const ability = this.abilities.frozenOrb;
        const startPos = this.position.clone();
        startPos.y = 1.5;

        // Main orb
        const orbGeometry = new THREE.SphereGeometry(0.5, 16, 12);
        const orbMaterial = new THREE.MeshBasicMaterial({
            color: 0x44ddff,
            transparent: true,
            opacity: 0.8
        });
        const orb = new THREE.Mesh(orbGeometry, orbMaterial);
        orb.position.copy(startPos);
        this.scene.add(orb);

        // Inner glow
        const glowGeometry = new THREE.SphereGeometry(0.7, 16, 12);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xaaeeff,
            transparent: true,
            opacity: 0.3
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        orb.add(glow);

        // Swirling ice shards around the orb
        const swirlGroup = new THREE.Group();
        const shardCount = 8;
        const shardMaterial = new THREE.MeshBasicMaterial({
            color: 0xccffff,
            transparent: true,
            opacity: 0.8
        });

        for (let i = 0; i < shardCount; i++) {
            const shardGeo = new THREE.ConeGeometry(0.08, 0.4, 4);
            const shard = new THREE.Mesh(shardGeo, shardMaterial);
            const angle = (i / shardCount) * Math.PI * 2;
            const radius = 0.9;
            const heightOffset = (i % 2 === 0) ? 0.2 : -0.2;
            shard.position.set(
                Math.cos(angle) * radius,
                heightOffset,
                Math.sin(angle) * radius
            );
            // Point shards outward
            shard.rotation.z = Math.PI / 2;
            shard.rotation.y = -angle;
            swirlGroup.add(shard);
        }
        orb.add(swirlGroup);

        // Outer aura ring showing AoE
        const auraGeometry = new THREE.RingGeometry(ability.aoeRadius - 0.2, ability.aoeRadius, 32);
        const auraMaterial = new THREE.MeshBasicMaterial({
            color: 0x88ccff,
            transparent: true,
            opacity: 0.2,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const aura = new THREE.Mesh(auraGeometry, auraMaterial);
        aura.rotation.x = -Math.PI / 2;
        aura.position.y = -1.4; // At ground level relative to orb
        orb.add(aura);

        this.frozenOrbs.push({
            mesh: orb,
            swirlGroup: swirlGroup,
            direction: direction.clone(),
            startPos: startPos.clone(),
            speed: ability.speed,
            maxRange: ability.range,
            damage: ability.damage,
            explosionDamage: ability.explosionDamage,
            aoeRadius: ability.aoeRadius,
            tickInterval: ability.tickInterval,
            tickTimer: 0,
            distanceTraveled: 0,
            hitEnemies: new Set() // Track enemies hit this tick to avoid double damage
        });

        // Cast particles
        if (this.game && this.game.particles && this.game.particles.frostCast) {
            this.game.particles.frostCast(startPos);
        }
    }

    updateFrozenOrbs(deltaTime) {
        for (let i = this.frozenOrbs.length - 1; i >= 0; i--) {
            const orb = this.frozenOrbs[i];

            // Move the orb
            const moveAmount = orb.speed * deltaTime;
            orb.mesh.position.addScaledVector(orb.direction, moveAmount);
            orb.distanceTraveled += moveAmount;

            // Rotate the orb for visual effect
            orb.mesh.rotation.y += deltaTime * 2;

            // Rotate the swirl faster in opposite direction
            if (orb.swirlGroup) {
                orb.swirlGroup.rotation.y -= deltaTime * 5;
            }

            // AoE damage tick
            orb.tickTimer += deltaTime;
            if (orb.tickTimer >= orb.tickInterval) {
                orb.tickTimer = 0;
                orb.hitEnemies.clear(); // Reset hit tracking each tick

                // Damage enemies in AoE
                if (this.game && this.game.enemies) {
                    const orbPos = orb.mesh.position;
                    for (const enemy of this.game.enemies) {
                        if (!enemy.isAlive) continue;

                        const dist = new THREE.Vector3(
                            enemy.position.x - orbPos.x,
                            0,
                            enemy.position.z - orbPos.z
                        ).length();

                        if (dist < orb.aoeRadius && !orb.hitEnemies.has(enemy)) {
                            enemy.takeDamage(orb.damage, this);
                            orb.hitEnemies.add(enemy);

                            if (this.game && this.game.effects) {
                                this.game.effects.createDamageNumber(enemy.position, orb.damage);
                            }

                            // Small slow effect
                            if (!enemy.originalMoveSpeed) {
                                enemy.originalMoveSpeed = enemy.moveSpeed;
                            }
                            enemy.moveSpeed = enemy.originalMoveSpeed * 0.7;
                            enemy.slowTimer = 0.5;
                        }
                    }
                }

                // Spawn ice particles as it travels
                if (this.game && this.game.particles && this.game.particles.frozenOrbTrail) {
                    this.game.particles.frozenOrbTrail(orb.mesh.position);
                }
            }

            // Check if reached max range - explode
            if (orb.distanceTraveled >= orb.maxRange) {
                this.explodeFrozenOrb(orb);
                this.frozenOrbs.splice(i, 1);
            }
        }
    }

    explodeFrozenOrb(orb) {
        const explosionPos = orb.mesh.position.clone();

        // Deal explosion damage to all enemies in range
        if (this.game && this.game.enemies) {
            for (const enemy of this.game.enemies) {
                if (!enemy.isAlive) continue;

                const dist = new THREE.Vector3(
                    enemy.position.x - explosionPos.x,
                    0,
                    enemy.position.z - explosionPos.z
                ).length();

                if (dist < orb.aoeRadius * 1.5) { // Slightly larger explosion radius
                    enemy.takeDamage(orb.explosionDamage, this);

                    if (this.game && this.game.effects) {
                        this.game.effects.createDamageNumber(enemy.position, orb.explosionDamage);
                    }

                    // Brief freeze on explosion
                    if (enemy.stun) {
                        enemy.stun(0.5);
                    }
                }
            }
        }

        // Explosion visual
        const explosionGeo = new THREE.SphereGeometry(orb.aoeRadius * 1.5, 16, 12);
        const explosionMat = new THREE.MeshBasicMaterial({
            color: 0x88eeff,
            transparent: true,
            opacity: 0.6
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

            explosion.scale.setScalar(1 + progress * 0.5);
            explosionMat.opacity = 0.6 * (1 - progress);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.scene.remove(explosion);
                explosion.geometry.dispose();
                explosion.material.dispose();
            }
        };
        animate();

        // Explosion particles
        if (this.game && this.game.particles && this.game.particles.frozenOrbExplosion) {
            this.game.particles.frozenOrbExplosion(explosionPos, orb.aoeRadius);
        }

        // Screen shake
        if (this.game) {
            this.game.addScreenShake(0.4);
        }

        // Remove orb mesh (with proper child disposal)
        orb.mesh.traverse((child) => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            }
        });
        this.scene.remove(orb.mesh);
    }

    // R - Blink: Dash toward mouse direction
    useBackstep(direction = null) {
        const ability = this.abilities.backstep;
        if (ability.cooldownRemaining > 0) return false;

        ability.cooldownRemaining = ability.cooldown;

        // Calculate dash direction - toward mouse if provided, else backward
        let dashDir;
        if (direction) {
            dashDir = new THREE.Vector3(direction.x, 0, direction.z).normalize();
            // Face the dash direction
            this.rotation = Math.atan2(dashDir.x, dashDir.z);
        } else {
            // Fallback to backward
            dashDir = new THREE.Vector3(
                -Math.sin(this.rotation),
                0,
                -Math.cos(this.rotation)
            );
        }

        const startPos = this.position.clone();

        // Move in dash direction
        this.position.addScaledVector(dashDir, ability.distance);

        // Keep in bounds
        const bounds = 95;
        this.position.x = Math.max(-bounds, Math.min(bounds, this.position.x));
        this.position.z = Math.max(-bounds, Math.min(bounds, this.position.z));

        // Play jump animation
        if (this.useAnimatedCharacter) {
            this.character.playJump();
        }

        // Trail effect
        if (this.game && this.game.particles && this.game.particles.backstepTrail) {
            this.game.particles.backstepTrail(startPos, this.position);
        }

        // Screen shake
        if (this.game) {
            this.game.addScreenShake(0.3);
        }

        return true;
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

        if (this.game && this.game.particles && this.game.particles.healEffect) {
            this.game.particles.healEffect(this.position);
        }

        return true;
    }

    takeDamage(amount) {
        this.health -= amount;

        if (this.useAnimatedCharacter) {
            this.character.playImpact();
        }

        if (this.game && this.game.particles && this.game.particles.playerHit) {
            this.game.particles.playerHit(this.position);
        }
        if (this.game) {
            this.game.addScreenShake(Math.min(amount / 20, 0.5));
        }

        if (this.health <= 0) {
            this.health = 0;
            this.die();
        }
    }

    die() {
        console.log('Mage died!');

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
        // Remove projectiles (with proper child disposal for glow effects)
        for (const proj of this.projectiles) {
            proj.mesh.traverse((child) => {
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                }
            });
            this.scene.remove(proj.mesh);
        }
        this.projectiles = [];

        // Remove frozen orbs (with proper child disposal for swirl/glow)
        for (const orb of this.frozenOrbs) {
            orb.mesh.traverse((child) => {
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                }
            });
            this.scene.remove(orb.mesh);
        }
        this.frozenOrbs = [];

        // Remove ground effects
        for (const effect of this.groundEffects) {
            this.scene.remove(effect.mesh);
            this.scene.remove(effect.border);
            effect.mesh.geometry.dispose();
            effect.mesh.material.dispose();
            effect.border.geometry.dispose();
            effect.border.material.dispose();
        }
        this.groundEffects = [];

        // Remove ability indicators
        if (this.blizzardIndicator) {
            this.scene.remove(this.blizzardIndicator);
            this.blizzardIndicator.geometry.dispose();
            this.blizzardIndicator.material.dispose();
        }
        if (this.flameWaveIndicator) {
            this.scene.remove(this.flameWaveIndicator);
            this.flameWaveIndicator.geometry.dispose();
            this.flameWaveIndicator.material.dispose();
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
