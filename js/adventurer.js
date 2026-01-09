import * as THREE from 'three';
import { KayKitCharacter } from './kayKitCharacter.js';
import { WeaponFactory } from './weaponFactory.js';
import { Inventory } from './inventory.js';

// Classless character for adventure/tutorial mode
// Can equip any weapon type and has no class-specific abilities
export class Adventurer {
    constructor(scene, game) {
        this.scene = scene;
        this.game = game;
        this.position = new THREE.Vector3(0, 0, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.rotation = 0;

        // Special class name that bypasses weapon restrictions
        this.className = 'adventurer';

        // Inventory system
        this.inventory = new Inventory(24);
        this.inventory.giveStarterItems(this.className);

        // Set up equipment change callback
        this.inventory.onEquipmentChanged = () => {
            this.updateWeaponFromEquipment();
        };

        // Buff system
        this.buffs = {};

        // Balanced stats
        this.maxHealth = 400;
        this.health = this.maxHealth;
        this.moveSpeed = 7.5;
        this.jumpForce = 12;
        this.isGrounded = true;

        // Combat - Melee by default, adapts to equipped weapon
        this.targetEnemy = null;
        this.attackRange = 2.5;
        this.autoAttackCooldown = 0;
        this.autoAttackCooldownMax = 0.9;
        this.autoAttackDamage = 20;

        // Dynamic abilities based on equipped weapon
        // Start with no usable abilities (high cooldowns prevent activation)
        this.currentWeaponType = null;
        this.abilities = this.getDisabledAbilities();

        // Projectiles and effects tracking
        this.projectiles = [];
        this.groundEffects = [];
        this.frozenOrbs = [];
        this.giantArrows = [];
        this.traps = [];

        // Character model
        this.character = new KayKitCharacter(this.scene);
        this.useAnimatedCharacter = false;
        this.weapon = null;
        this.weaponMesh = null;

        // Load animated character
        this.loadCharacter();
    }

    async loadCharacter() {
        console.log('Adventurer: Starting character load...');
        try {
            const success = await this.character.load('adventurers', 'barbarian');
            console.log('Adventurer: load() returned:', success);
            if (success) {
                this.useAnimatedCharacter = true;
                console.log('Adventurer: Model loaded successfully, useAnimatedCharacter =', this.useAnimatedCharacter);
            } else {
                console.warn('Adventurer: load() returned false');
            }
        } catch (error) {
            console.error('Adventurer: Failed to load character:', error);
        }
    }

    updateWeaponFromEquipment() {
        const equipped = this.inventory.equipment.weapon;

        if (this.weaponMesh && this.useAnimatedCharacter) {
            this.character.detachWeapon();
            this.scene.remove(this.weaponMesh);
            this.weaponMesh = null;
        }

        if (equipped) {
            const weaponDef = equipped.definition;

            // Determine weapon type from classRestriction first (most reliable)
            let weaponType = 'sword'; // default
            const classRestriction = weaponDef.classRestriction;

            if (classRestriction && classRestriction.includes('hunter')) {
                weaponType = 'bow';
                this.attackRange = 12; // Ranged
            } else if (classRestriction && classRestriction.includes('mage')) {
                weaponType = 'staff';
                this.attackRange = 10; // Ranged magic
            } else if (classRestriction && classRestriction.includes('warrior')) {
                weaponType = 'sword';
                this.attackRange = 2.5; // Standard melee
            } else {
                // Fallback to name/id matching for unrestricted weapons
                const iconLower = (weaponDef.icon || '').toLowerCase();
                const idLower = (weaponDef.id || '').toLowerCase();
                const nameLower = (weaponDef.name || '').toLowerCase();

                if (iconLower.includes('bow') || idLower.includes('bow') ||
                    iconLower.includes('crossbow') || idLower.includes('crossbow') ||
                    nameLower.includes('bow') || nameLower.includes('crossbow')) {
                    weaponType = 'bow';
                    this.attackRange = 12;
                } else if (iconLower.includes('staff') || idLower.includes('staff') ||
                           iconLower.includes('scepter') || idLower.includes('scepter') ||
                           nameLower.includes('staff') || nameLower.includes('scepter')) {
                    weaponType = 'staff';
                    this.attackRange = 10;
                } else if (iconLower.includes('dagger') || idLower.includes('dagger') || nameLower.includes('dagger')) {
                    weaponType = 'dagger';
                    this.attackRange = 2.0;
                }
            }

            console.log('Adventurer weapon detection:', { classRestriction, detected: weaponType });

            this.weaponMesh = WeaponFactory.createWeapon(weaponType);
            if (this.weaponMesh && this.useAnimatedCharacter) {
                this.character.attachWeapon(this.weaponMesh);
            }

            // Update damage from weapon stats
            const baseDamage = 20;
            const weaponDamage = weaponDef.stats?.damage || 0;
            this.autoAttackDamage = baseDamage + weaponDamage;

            // Always set abilities based on weapon type (not just when type changes)
            this.currentWeaponType = weaponType;
            if (weaponType === 'sword' || weaponType === 'dagger') {
                this.abilities = this.getWarriorAbilities();
                console.log('Adventurer: Equipped melee weapon - Warrior abilities unlocked!');
                console.log('Warrior ability cooldowns:', {
                    cleave: this.abilities.cleave?.cooldownRemaining,
                    whirlwind: this.abilities.whirlwind?.cooldownRemaining,
                    parry: this.abilities.parry?.cooldownRemaining,
                    heroicLeap: this.abilities.heroicLeap?.cooldownRemaining
                });
            } else if (weaponType === 'staff') {
                this.abilities = this.getMageAbilities();
                console.log('Adventurer: Equipped staff - Mage abilities unlocked!');
                console.log('Mage ability cooldowns:', {
                    blizzard: this.abilities.blizzard?.cooldownRemaining,
                    flameWave: this.abilities.flameWave?.cooldownRemaining,
                    frostNova: this.abilities.frostNova?.cooldownRemaining,
                    backstep: this.abilities.backstep?.cooldownRemaining,
                    frozenOrb: this.abilities.frozenOrb?.cooldownRemaining
                });
            } else if (weaponType === 'bow') {
                this.abilities = this.getHunterAbilities();
                console.log('Adventurer: Equipped bow - Hunter abilities unlocked!');
                console.log('Hunter ability cooldowns:', {
                    arrowWave: this.abilities.arrowWave?.cooldownRemaining,
                    spinDash: this.abilities.spinDash?.cooldownRemaining,
                    shotgun: this.abilities.shotgun?.cooldownRemaining,
                    trap: this.abilities.trap?.cooldownRemaining,
                    giantArrow: this.abilities.giantArrow?.cooldownRemaining
                });
            }
            // Notify game to update UI
            if (this.game && this.game.updateAbilityUI) {
                this.game.updateAbilityUI();
            }
        } else {
            this.attackRange = 2.5;
            this.autoAttackDamage = 20;
            // No weapon - disable all abilities
            this.currentWeaponType = null;
            this.abilities = this.getDisabledAbilities();
            console.log('Adventurer: Unequipped weapon - Abilities disabled');
            if (this.game && this.game.updateAbilityUI) {
                this.game.updateAbilityUI();
            }
        }
    }

    update(deltaTime, input) {
        // Update cooldowns
        if (this.autoAttackCooldown > 0) {
            this.autoAttackCooldown -= deltaTime;
        }

        // Update ability cooldowns
        for (const key in this.abilities) {
            if (this.abilities[key].cooldownRemaining > 0) {
                this.abilities[key].cooldownRemaining -= deltaTime;
            }
        }

        // Update buffs
        this.updateBuffs(deltaTime);

        // Handle movement
        const isMoving = this.handleMovement(deltaTime, input);

        // Update character animation
        if (this.useAnimatedCharacter) {
            this.character.update(deltaTime, isMoving, true, this.isGrounded);
            this.character.setPosition(this.position.x, this.position.y, this.position.z);
            this.character.setRotation(this.rotation);
        }

        // Update projectiles and effects
        this.updateProjectiles(deltaTime);
        this.updateGroundEffects(deltaTime);
        this.updateFrozenOrbs(deltaTime);
        this.updateGiantArrows(deltaTime);
        this.updateTraps(deltaTime);

        // Auto-attack target if in range
        if (this.targetEnemy && this.targetEnemy.isAlive) {
            const dist = this.position.distanceTo(this.targetEnemy.position);
            if (dist <= this.attackRange && this.autoAttackCooldown <= 0) {
                this.performAutoAttack();
            }
        }
    }

    handleMovement(deltaTime, input) {
        const moveDir = new THREE.Vector3(0, 0, 0);
        let isMoving = false;

        if (input.keys.w) moveDir.z -= 1;
        if (input.keys.s) moveDir.z += 1;
        if (input.keys.a) moveDir.x -= 1;
        if (input.keys.d) moveDir.x += 1;

        // Apply movement speed modifiers from buffs
        let speedMult = 1;
        if (this.buffs.speed) speedMult *= this.buffs.speed.multiplier;

        if (moveDir.length() > 0) {
            moveDir.normalize();
            this.position.x += moveDir.x * this.moveSpeed * speedMult * deltaTime;
            this.position.z += moveDir.z * this.moveSpeed * speedMult * deltaTime;

            // Face movement direction
            this.rotation = Math.atan2(moveDir.x, moveDir.z);
            isMoving = true;
        }

        // Jump
        if (input.keys[' '] && this.isGrounded) {
            this.velocity.y = this.jumpForce;
            this.isGrounded = false;
            input.keys[' '] = false;

            if (this.useAnimatedCharacter) {
                this.character.playJump();
            }
        }

        // Apply gravity
        if (!this.isGrounded) {
            this.velocity.y -= 30 * deltaTime;
        }
        this.position.y += this.velocity.y * deltaTime;

        if (this.position.y <= 0) {
            this.position.y = 0;
            this.velocity.y = 0;
            this.isGrounded = true;
        }

        return isMoving;
    }

    performAutoAttack() {
        if (!this.targetEnemy || !this.targetEnemy.isAlive) return;

        this.autoAttackCooldown = this.autoAttackCooldownMax;

        // Apply damage modifiers from buffs
        let damage = this.autoAttackDamage;
        if (this.buffs.damage) damage *= this.buffs.damage.multiplier;

        // Apply equipment stats
        const equipStats = this.inventory.getEquipmentStats();
        damage += equipStats.damage || 0;

        // Face target
        const dx = this.targetEnemy.position.x - this.position.x;
        const dz = this.targetEnemy.position.z - this.position.z;
        this.rotation = Math.atan2(dx, dz);

        // Play attack animation
        if (this.useAnimatedCharacter) {
            this.character.playAnimation('attack', { once: true });
        }

        // Deal damage
        this.targetEnemy.takeDamage(damage, this);

        // Create attack effect based on weapon type
        const equipped = this.inventory.equipment.weapon;
        if (equipped) {
            const weaponDef = equipped.definition;
            if (weaponDef.icon?.includes('bow') || weaponDef.id?.includes('bow')) {
                // Ranged arrow projectile
                this.game.createProjectile(
                    this.position.clone().add(new THREE.Vector3(0, 1, 0)),
                    new THREE.Vector3(dx, 0, dz).normalize(),
                    'arrow',
                    damage,
                    20
                );
            } else if (weaponDef.icon?.includes('staff') || weaponDef.id?.includes('staff')) {
                // Magic bolt projectile
                this.game.createProjectile(
                    this.position.clone().add(new THREE.Vector3(0, 1.5, 0)),
                    new THREE.Vector3(dx, 0, dz).normalize(),
                    'fireball',
                    damage,
                    15
                );
            } else {
                // Melee slash effect
                this.game.createProjectile(
                    this.position.clone(),
                    new THREE.Vector3(dx, 0, dz).normalize(),
                    'slash',
                    0,
                    5
                );
            }
        }

        // Visual feedback
        if (this.game.effects) {
            this.game.effects.createDamageNumber(this.targetEnemy.position, damage);
        }
    }

    takeDamage(amount, source = null) {
        // Apply defense from equipment
        const equipStats = this.inventory.getEquipmentStats();
        const defense = equipStats.defense || 0;
        const damageReduction = defense / (defense + 100);
        const finalDamage = Math.max(1, Math.round(amount * (1 - damageReduction)));

        // Apply defense buff
        if (this.buffs.defense) {
            amount = Math.round(amount * this.buffs.defense.multiplier);
        }

        this.health = Math.max(0, this.health - finalDamage);

        // Screen flash
        if (this.game) {
            this.game.triggerDamageFlash();
        }

        return finalDamage;
    }

    heal(amount) {
        const oldHealth = this.health;
        this.health = Math.min(this.maxHealth, this.health + amount);
        return this.health - oldHealth;
    }

    applyBuff(type, config) {
        this.buffs[type] = {
            ...config,
            timeRemaining: config.duration
        };
    }

    updateBuffs(deltaTime) {
        for (const [type, buff] of Object.entries(this.buffs)) {
            buff.timeRemaining -= deltaTime;
            if (buff.timeRemaining <= 0) {
                delete this.buffs[type];
            }
        }
    }

    // Get disabled abilities (high cooldowns prevent use)
    getDisabledAbilities() {
        return {
            cleave: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            whirlwind: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            parry: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            heroicLeap: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            blizzard: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            flameWave: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            frostNova: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            backstep: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            frozenOrb: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            arrowWave: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            spinDash: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            shotgun: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            trap: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            giantArrow: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            potion: { cooldown: 999, cooldownRemaining: 999 }
        };
    }

    // Get warrior abilities for melee weapons
    getWarriorAbilities() {
        return {
            cleave: { cooldown: 4, cooldownRemaining: 0, damage: 45, range: 8.0, angle: Math.PI * 0.6, isActive: false },
            whirlwind: { cooldown: 6, cooldownRemaining: 0, damage: 35, range: 3.5, dashDistance: 10, dashDuration: 0.5, isActive: false },
            parry: { cooldown: 5, cooldownRemaining: 0, damage: 50, range: 4, spinDuration: 0.4, isActive: false },
            heroicLeap: { cooldown: 8, cooldownRemaining: 0, damage: 60, range: 15, radius: 4, isActive: false },
            potion: { cooldown: 30, cooldownRemaining: 0 },
            // Disable other class abilities
            blizzard: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            flameWave: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            frostNova: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            backstep: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            frozenOrb: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            arrowWave: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            spinDash: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            shotgun: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            trap: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            giantArrow: { cooldown: 999, cooldownRemaining: 999, isActive: false }
        };
    }

    // Get mage abilities for staff weapons
    getMageAbilities() {
        return {
            blizzard: { cooldown: 6, cooldownRemaining: 0, damage: 15, range: 12, radius: 5, duration: 3, tickRate: 0.5, isActive: false },
            flameWave: { cooldown: 5, cooldownRemaining: 0, damage: 40, range: 10, width: 6, isActive: false },
            frostNova: { cooldown: 8, cooldownRemaining: 0, damage: 30, radius: 5, slowDuration: 3, isActive: false },
            backstep: { cooldown: 4, cooldownRemaining: 0, distance: 8, isActive: false },
            frozenOrb: { cooldown: 10, cooldownRemaining: 0, damage: 25, range: 15, radius: 3, duration: 4, isActive: false },
            potion: { cooldown: 30, cooldownRemaining: 0 },
            // Disable other class abilities
            cleave: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            whirlwind: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            parry: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            heroicLeap: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            arrowWave: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            spinDash: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            shotgun: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            trap: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            giantArrow: { cooldown: 999, cooldownRemaining: 999, isActive: false }
        };
    }

    // Get hunter abilities for bow weapons
    getHunterAbilities() {
        return {
            arrowWave: { cooldown: 5, cooldownRemaining: 0, damage: 30, range: 15, count: 5, spread: Math.PI * 0.4, isActive: false },
            spinDash: { cooldown: 6, cooldownRemaining: 0, damage: 25, distance: 8, duration: 0.4, isActive: false },
            shotgun: { cooldown: 4, cooldownRemaining: 0, damage: 15, range: 8, count: 8, spread: Math.PI * 0.3, isActive: false },
            trap: { cooldown: 10, cooldownRemaining: 0, damage: 40, radius: 2, duration: 10, isActive: false },
            giantArrow: { cooldown: 12, cooldownRemaining: 0, damage: 100, range: 20, piercing: true, isActive: false },
            potion: { cooldown: 30, cooldownRemaining: 0 },
            // Disable other class abilities
            cleave: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            whirlwind: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            parry: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            heroicLeap: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            blizzard: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            flameWave: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            frostNova: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            backstep: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            frozenOrb: { cooldown: 999, cooldownRemaining: 999, isActive: false }
        };
    }

    // ============ UPDATE METHODS FOR PROJECTILES AND EFFECTS ============

    updateProjectiles(deltaTime) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];

            if (proj.direction) {
                const moveAmount = proj.speed * deltaTime;
                proj.mesh.position.addScaledVector(proj.direction, moveAmount);
                proj.distanceTraveled += moveAmount;

                // Check enemy hits
                if (this.game && this.game.enemies) {
                    for (const enemy of this.game.enemies) {
                        if (!enemy.isAlive || proj.hitEnemies.has(enemy)) continue;

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

    updateGroundEffects(deltaTime) {
        for (let i = this.groundEffects.length - 1; i >= 0; i--) {
            const effect = this.groundEffects[i];
            effect.duration -= deltaTime;

            if (effect.duration <= 0) {
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

                if (this.game && this.game.enemies) {
                    for (const enemy of this.game.enemies) {
                        if (!enemy.isAlive) continue;

                        const dist = enemy.position.distanceTo(effect.position);
                        if (dist < effect.radius) {
                            enemy.takeDamage(effect.damage, this);

                            if (this.game.effects) {
                                this.game.effects.createDamageNumber(enemy.position, effect.damage);
                            }

                            if (!enemy.originalMoveSpeed) {
                                enemy.originalMoveSpeed = enemy.moveSpeed;
                            }
                            enemy.moveSpeed = enemy.originalMoveSpeed * effect.slowAmount;
                            enemy.slowTimer = 1.0;
                        }
                    }
                }
            }

            if (effect.duration < 1) {
                effect.mesh.material.opacity = effect.duration * 0.4;
                effect.border.material.opacity = effect.duration * 0.7;
            }
        }
    }

    updateFrozenOrbs(deltaTime) {
        for (let i = this.frozenOrbs.length - 1; i >= 0; i--) {
            const orb = this.frozenOrbs[i];

            const moveAmount = orb.speed * deltaTime;
            orb.mesh.position.addScaledVector(orb.direction, moveAmount);
            orb.distanceTraveled += moveAmount;
            orb.mesh.rotation.y += deltaTime * 2;

            if (orb.swirlGroup) {
                orb.swirlGroup.rotation.y -= deltaTime * 5;
            }

            orb.tickTimer += deltaTime;
            if (orb.tickTimer >= orb.tickInterval) {
                orb.tickTimer = 0;
                orb.hitEnemies.clear();

                if (this.game && this.game.enemies) {
                    const orbPos = orb.mesh.position;
                    for (const enemy of this.game.enemies) {
                        if (!enemy.isAlive) continue;

                        const dist = new THREE.Vector3(
                            enemy.position.x - orbPos.x, 0, enemy.position.z - orbPos.z
                        ).length();

                        if (dist < orb.aoeRadius && !orb.hitEnemies.has(enemy)) {
                            enemy.takeDamage(orb.damage, this);
                            orb.hitEnemies.add(enemy);

                            if (this.game && this.game.effects) {
                                this.game.effects.createDamageNumber(enemy.position, orb.damage);
                            }

                            if (!enemy.originalMoveSpeed) {
                                enemy.originalMoveSpeed = enemy.moveSpeed;
                            }
                            enemy.moveSpeed = enemy.originalMoveSpeed * 0.7;
                            enemy.slowTimer = 0.5;
                        }
                    }
                }
            }

            if (orb.distanceTraveled >= orb.maxRange) {
                this.explodeFrozenOrb(orb);
                this.frozenOrbs.splice(i, 1);
            }
        }
    }

    explodeFrozenOrb(orb) {
        const explosionPos = orb.mesh.position.clone();

        if (this.game && this.game.enemies) {
            for (const enemy of this.game.enemies) {
                if (!enemy.isAlive) continue;

                const dist = new THREE.Vector3(
                    enemy.position.x - explosionPos.x, 0, enemy.position.z - explosionPos.z
                ).length();

                if (dist < orb.aoeRadius * 1.5) {
                    enemy.takeDamage(orb.explosionDamage, this);

                    if (this.game && this.game.effects) {
                        this.game.effects.createDamageNumber(enemy.position, orb.explosionDamage);
                    }

                    if (enemy.stun) {
                        enemy.stun(0.5);
                    }
                }
            }
        }

        if (this.game) {
            this.game.addScreenShake(0.4);
        }

        orb.mesh.traverse((child) => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            }
        });
        this.scene.remove(orb.mesh);
    }

    updateGiantArrows(deltaTime) {
        for (let i = this.giantArrows.length - 1; i >= 0; i--) {
            const arrow = this.giantArrows[i];

            const moveAmount = arrow.speed * deltaTime;
            arrow.mesh.position.addScaledVector(arrow.direction, moveAmount);
            arrow.distanceTraveled += moveAmount;

            if (this.game && this.game.enemies) {
                const arrowPos = arrow.mesh.position;
                for (const enemy of this.game.enemies) {
                    if (!enemy.isAlive || arrow.hitEnemies.has(enemy)) continue;

                    const dist = new THREE.Vector3(
                        enemy.position.x - arrowPos.x, 0, enemy.position.z - arrowPos.z
                    ).length();

                    if (dist < arrow.width + 0.5) {
                        enemy.takeDamage(arrow.damage, this);
                        arrow.hitEnemies.add(enemy);

                        if (this.game && this.game.effects) {
                            this.game.effects.createDamageNumber(enemy.position, arrow.damage);
                        }
                    }
                }
            }

            if (arrow.distanceTraveled >= arrow.maxRange) {
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

    updateTraps(deltaTime) {
        for (let i = this.traps.length - 1; i >= 0; i--) {
            const trap = this.traps[i];

            if (!trap.isArmed) {
                trap.armTime -= deltaTime;
                if (trap.armTime <= 0) {
                    trap.isArmed = true;
                    trap.ring.material.opacity = 0.3;
                }
            } else {
                if (this.game && this.game.enemies) {
                    for (const enemy of this.game.enemies) {
                        if (!enemy.isAlive) continue;

                        const dist = enemy.position.distanceTo(trap.position);
                        if (dist < trap.radius) {
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
        if (this.game && this.game.enemies) {
            for (const enemy of this.game.enemies) {
                if (!enemy.isAlive) continue;

                const dist = enemy.position.distanceTo(trap.position);
                if (dist < trap.radius) {
                    enemy.takeDamage(trap.damage, this);

                    if (this.game && this.game.effects) {
                        this.game.effects.createDamageNumber(enemy.position, trap.damage);
                    }

                    if (enemy.stun) {
                        enemy.stun(0.5);
                    }
                }
            }
        }

        trap.mesh.traverse((child) => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            }
        });
        this.scene.remove(trap.mesh);

        if (this.game) {
            this.game.addScreenShake(0.5);
        }
    }

    // ============ WARRIOR ABILITIES (Sword/Dagger) ============

    useCleave(enemies, direction = null) {
        const ability = this.abilities.cleave;
        if (ability.cooldownRemaining > 0) return false;
        if (this.currentWeaponType !== 'sword' && this.currentWeaponType !== 'dagger') return false;

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

        if (this.game && this.game.effects) {
            this.game.effects.createCleaveEffect(this.position, this.rotation);
        }

        let hitCount = 0;
        for (const enemy of enemies) {
            if (!enemy.isAlive) continue;

            const dx = enemy.position.x - this.position.x;
            const dz = enemy.position.z - this.position.z;
            const horizontalDist = Math.sqrt(dx * dx + dz * dz);

            if (horizontalDist > ability.range) continue;

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

    useWhirlwind(direction = null) {
        const ability = this.abilities.whirlwind;
        if (ability.cooldownRemaining > 0) return false;
        if (this.currentWeaponType !== 'sword' && this.currentWeaponType !== 'dagger') return false;

        ability.cooldownRemaining = ability.cooldown;

        let dashDir;
        if (direction) {
            dashDir = new THREE.Vector3(direction.x, 0, direction.z).normalize();
            this.rotation = Math.atan2(direction.x, direction.z);
        } else {
            dashDir = new THREE.Vector3(Math.sin(this.rotation), 0, Math.cos(this.rotation));
        }

        if (this.useAnimatedCharacter) {
            this.character.playAttack(2);
        }

        // Deal damage to all nearby enemies
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

        // Dash forward
        this.position.addScaledVector(dashDir, ability.dashDistance);

        // Keep in bounds
        const bounds = 95;
        this.position.x = Math.max(-bounds, Math.min(bounds, this.position.x));
        this.position.z = Math.max(-bounds, Math.min(bounds, this.position.z));

        if (this.game) {
            this.game.addScreenShake(0.4);
        }

        return true;
    }

    useParry() {
        const ability = this.abilities.parry;
        if (ability.cooldownRemaining > 0) return false;
        if (this.currentWeaponType !== 'sword' && this.currentWeaponType !== 'dagger') return false;

        ability.cooldownRemaining = ability.cooldown;

        if (this.useAnimatedCharacter) {
            this.character.playAttack(2);
        }

        if (this.game && this.game.enemies) {
            for (const enemy of this.game.enemies) {
                if (enemy.isAlive) {
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
        }

        if (this.game) {
            this.game.addScreenShake(0.3);
        }

        return true;
    }

    useHeroicLeap(targetPos) {
        const ability = this.abilities.heroicLeap;
        if (ability.cooldownRemaining > 0) return false;
        if (this.currentWeaponType !== 'sword' && this.currentWeaponType !== 'dagger') return false;
        if (!targetPos) return false;

        ability.cooldownRemaining = ability.cooldown;

        const dx = targetPos.x - this.position.x;
        const dz = targetPos.z - this.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        let finalTarget = targetPos.clone();
        if (dist > ability.range) {
            const dir = new THREE.Vector3(dx, 0, dz).normalize();
            finalTarget = this.position.clone().add(dir.multiplyScalar(ability.range));
        }

        this.rotation = Math.atan2(dx, dz);

        if (this.useAnimatedCharacter) {
            this.character.playJump();
        }

        // Teleport to target
        this.position.x = finalTarget.x;
        this.position.z = finalTarget.z;

        // AoE damage on landing
        if (this.game) {
            if (this.game.effects) {
                this.game.effects.createGroundSlamEffect(this.position, ability.radius);
            }

            this.game.addScreenShake(0.8);

            for (const enemy of this.game.enemies) {
                if (!enemy.isAlive) continue;
                const edx = enemy.position.x - this.position.x;
                const edz = enemy.position.z - this.position.z;
                const edist = Math.sqrt(edx * edx + edz * edz);
                if (edist <= ability.radius) {
                    enemy.takeDamage(ability.damage, this);
                    if (enemy.stun) enemy.stun(0.8);
                    if (this.game.effects) {
                        this.game.effects.createDamageNumber(enemy.position, ability.damage);
                    }
                }
            }
        }

        return true;
    }

    // ============ MAGE ABILITIES (Staff) ============

    useBlizzard(targetPosition) {
        const ability = this.abilities.blizzard;
        if (ability.cooldownRemaining > 0) return false;
        if (this.currentWeaponType !== 'staff') return false;

        ability.cooldownRemaining = ability.cooldown;

        if (this.useAnimatedCharacter) {
            this.character.playAttack(2);
        }

        // Create blizzard zone
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
        zone.position.copy(targetPosition);
        zone.position.y = 0.35;
        this.scene.add(zone);

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
        border.position.copy(targetPosition);
        border.position.y = 0.36;
        this.scene.add(border);

        this.groundEffects.push({
            type: 'blizzard',
            mesh: zone,
            border: border,
            position: targetPosition.clone(),
            radius: ability.radius,
            damage: ability.damage,
            slowAmount: 0.5,
            duration: ability.duration,
            tickTimer: 0
        });

        return true;
    }

    useFlameWave(enemies, direction = null) {
        const ability = this.abilities.flameWave;
        if (ability.cooldownRemaining > 0) return false;
        if (this.currentWeaponType !== 'staff') return false;

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

        if (this.game && this.game.effects) {
            this.game.effects.createFlameWaveEffect(this.position, this.rotation);
        }

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

            if (angleToEnemy <= ability.width / 2) {
                enemy.takeDamage(ability.damage, this);

                if (this.game && this.game.effects) {
                    this.game.effects.createDamageNumber(enemy.position, ability.damage);
                }
                hitCount++;
            }
        }

        return hitCount > 0;
    }

    useFrostNova() {
        const ability = this.abilities.frostNova;
        if (ability.cooldownRemaining > 0) return false;
        if (this.currentWeaponType !== 'staff') return false;

        ability.cooldownRemaining = ability.cooldown;

        if (this.useAnimatedCharacter) {
            this.character.playAttack(2);
        }

        if (this.game && this.game.enemies) {
            for (const enemy of this.game.enemies) {
                if (!enemy.isAlive) continue;

                const dist = this.position.distanceTo(enemy.position);
                if (dist < ability.radius) {
                    enemy.takeDamage(ability.damage, this);

                    if (this.game && this.game.effects) {
                        this.game.effects.createDamageNumber(enemy.position, ability.damage);
                    }

                    if (enemy.stun) {
                        enemy.stun(ability.slowDuration);
                    }
                }
            }
        }

        if (this.game) {
            this.game.addScreenShake(0.5);
        }

        return true;
    }

    useBackstep(direction = null) {
        const ability = this.abilities.blink;
        if (ability.cooldownRemaining > 0) return false;
        if (this.currentWeaponType !== 'staff') return false;

        ability.cooldownRemaining = ability.cooldown;

        let dashDir;
        if (direction) {
            dashDir = new THREE.Vector3(direction.x, 0, direction.z).normalize();
            this.rotation = Math.atan2(dashDir.x, dashDir.z);
        } else {
            dashDir = new THREE.Vector3(-Math.sin(this.rotation), 0, -Math.cos(this.rotation));
        }

        this.position.addScaledVector(dashDir, ability.distance);

        const bounds = 95;
        this.position.x = Math.max(-bounds, Math.min(bounds, this.position.x));
        this.position.z = Math.max(-bounds, Math.min(bounds, this.position.z));

        if (this.useAnimatedCharacter) {
            this.character.playJump();
        }

        if (this.game) {
            this.game.addScreenShake(0.3);
        }

        return true;
    }

    useFrozenOrb(direction) {
        const ability = this.abilities.frozenOrb;
        if (ability.cooldownRemaining > 0) return false;
        if (this.currentWeaponType !== 'staff') return false;

        ability.cooldownRemaining = ability.cooldown;

        let dir;
        if (direction) {
            dir = new THREE.Vector3(direction.x, 0, direction.z).normalize();
            this.rotation = Math.atan2(dir.x, dir.z);
        } else {
            dir = new THREE.Vector3(Math.sin(this.rotation), 0, Math.cos(this.rotation));
        }

        if (this.useAnimatedCharacter) {
            this.character.playAttack(1);
        }

        const startPos = this.position.clone();
        startPos.y = 1.5;

        const orbGeometry = new THREE.SphereGeometry(0.5, 16, 12);
        const orbMaterial = new THREE.MeshBasicMaterial({
            color: 0x44ddff,
            transparent: true,
            opacity: 0.8
        });
        const orb = new THREE.Mesh(orbGeometry, orbMaterial);
        orb.position.copy(startPos);
        this.scene.add(orb);

        const swirlGroup = new THREE.Group();
        orb.add(swirlGroup);

        this.frozenOrbs.push({
            mesh: orb,
            swirlGroup: swirlGroup,
            direction: dir.clone(),
            startPos: startPos.clone(),
            speed: 6,
            maxRange: ability.range,
            damage: ability.damage,
            explosionDamage: 40,
            aoeRadius: 3,
            tickInterval: 0.3,
            tickTimer: 0,
            distanceTraveled: 0,
            hitEnemies: new Set()
        });

        return true;
    }

    // ============ HUNTER ABILITIES (Bow) ============

    useArrowWave(direction = null) {
        const ability = this.abilities.arrowWave;
        if (ability.cooldownRemaining > 0) return false;
        if (this.currentWeaponType !== 'bow') return false;

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

        const startAngle = this.rotation - ability.spread / 2;
        const angleStep = ability.spread / (ability.count - 1);

        for (let i = 0; i < ability.count; i++) {
            const angle = startAngle + angleStep * i;
            const dir = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
            this.createArrowProjectile(dir, ability.damage, ability.range, 0x88ff44);
        }

        if (this.game) {
            this.game.addScreenShake(0.3);
        }

        return true;
    }

    useSpinDash(direction = null) {
        const ability = this.abilities.spinDash;
        if (ability.cooldownRemaining > 0) return false;
        if (this.currentWeaponType !== 'bow') return false;

        ability.cooldownRemaining = ability.cooldown;

        let dashDir;
        if (direction) {
            dashDir = new THREE.Vector3(direction.x, 0, direction.z).normalize();
            this.rotation = Math.atan2(dashDir.x, dashDir.z);
        } else {
            dashDir = new THREE.Vector3(Math.sin(this.rotation), 0, Math.cos(this.rotation));
        }

        // Fire arrows in all directions
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
            this.createArrowProjectile(dir, ability.damage, 8, 0xffff44);
        }

        // Dash forward
        this.position.addScaledVector(dashDir, ability.distance);

        const bounds = 95;
        this.position.x = Math.max(-bounds, Math.min(bounds, this.position.x));
        this.position.z = Math.max(-bounds, Math.min(bounds, this.position.z));

        if (this.game) {
            this.game.addScreenShake(0.4);
        }

        return true;
    }

    useShotgun(direction = null) {
        const ability = this.abilities.shotgun;
        if (ability.cooldownRemaining > 0) return false;
        if (this.currentWeaponType !== 'bow') return false;

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

        const startAngle = this.rotation - ability.spread / 2;
        const angleStep = ability.spread / (ability.count - 1);

        for (let i = 0; i < ability.count; i++) {
            const angle = startAngle + angleStep * i;
            const dir = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));

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
                direction: dir.clone(),
                speed: 35,
                damage: ability.damage,
                maxRange: ability.range,
                distanceTraveled: 0,
                type: 'shotgun',
                hitEnemies: new Set()
            });
        }

        // Knockback player backwards
        const backDir = forward.clone().multiplyScalar(-1);
        this.position.addScaledVector(backDir, 3);

        const bounds = 95;
        this.position.x = Math.max(-bounds, Math.min(bounds, this.position.x));
        this.position.z = Math.max(-bounds, Math.min(bounds, this.position.z));

        if (this.game) {
            this.game.addScreenShake(0.6);
        }

        return true;
    }

    useTrap(targetPosition = null) {
        const ability = this.abilities.trap;
        if (ability.cooldownRemaining > 0) return false;
        if (this.currentWeaponType !== 'bow') return false;

        ability.cooldownRemaining = ability.cooldown;

        const trapPos = targetPosition ? new THREE.Vector3(targetPosition.x, 0.1, targetPosition.z) : this.position.clone();
        trapPos.y = 0.1;

        const trapGroup = new THREE.Group();
        trapGroup.position.copy(trapPos);

        const baseGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 8);
        const baseMaterial = new THREE.MeshStandardMaterial({
            color: 0x444444,
            metalness: 0.8,
            roughness: 0.3
        });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        trapGroup.add(base);

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
            armTime: 1.0,
            isArmed: false
        });

        return true;
    }

    useGiantArrow(direction = null) {
        const ability = this.abilities.giantArrow;
        if (ability.cooldownRemaining > 0) return false;
        if (this.currentWeaponType !== 'bow') return false;

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

        const startPos = this.position.clone();
        startPos.y = 1.2;

        const arrowGroup = new THREE.Group();
        arrowGroup.position.copy(startPos);

        const shaftGeometry = new THREE.CylinderGeometry(0.1, 0.1, 2, 8);
        const shaftMaterial = new THREE.MeshBasicMaterial({ color: 0x8B4513 });
        const shaft = new THREE.Mesh(shaftGeometry, shaftMaterial);
        shaft.rotation.x = Math.PI / 2;
        arrowGroup.add(shaft);

        const headGeometry = new THREE.ConeGeometry(0.25, 0.6, 6);
        const headMaterial = new THREE.MeshBasicMaterial({ color: 0xaaaaaa });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.rotation.x = -Math.PI / 2;
        head.position.z = 1.3;
        arrowGroup.add(head);

        const targetPos = startPos.clone().addScaledVector(forward, 5);
        arrowGroup.lookAt(targetPos);

        this.scene.add(arrowGroup);

        this.giantArrows.push({
            mesh: arrowGroup,
            direction: forward.clone(),
            speed: 25,
            damage: ability.damage,
            maxRange: ability.range,
            width: 1.5,
            distanceTraveled: 0,
            hitEnemies: new Set()
        });

        return true;
    }

    // Helper method for creating arrow projectiles
    createArrowProjectile(direction, damage, range, color) {
        const startPos = this.position.clone();
        startPos.y = 1.2;

        const arrowGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 4);
        const arrowMaterial = new THREE.MeshBasicMaterial({ color: color });
        const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
        arrow.position.copy(startPos);

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
            type: 'arrow',
            hitEnemies: new Set()
        });
    }
}
