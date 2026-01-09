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

        // Stub abilities with high cooldowns (adventurer has no real abilities)
        // These prevent errors from input.js accessing ability cooldowns
        this.abilities = {
            cleave: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            whirlwind: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            parry: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            heroicLeap: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            blizzard: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            flameWave: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            frostNova: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            blink: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            frozenOrb: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            arrowWave: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            spinDash: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            shotgun: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            trap: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            giantArrow: { cooldown: 999, cooldownRemaining: 999, isActive: false }
        };

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

            // Determine weapon type from icon/id
            let weaponType = 'sword'; // default
            if (weaponDef.icon?.includes('bow') || weaponDef.id?.includes('bow')) {
                weaponType = 'bow';
                this.attackRange = 12; // Ranged
            } else if (weaponDef.icon?.includes('staff') || weaponDef.id?.includes('staff') || weaponDef.id?.includes('scepter')) {
                weaponType = 'staff';
                this.attackRange = 10; // Ranged magic
            } else if (weaponDef.icon?.includes('dagger') || weaponDef.id?.includes('dagger')) {
                weaponType = 'dagger';
                this.attackRange = 2.0; // Short melee
            } else {
                weaponType = 'sword';
                this.attackRange = 2.5; // Standard melee
            }

            this.weaponMesh = WeaponFactory.createWeapon(weaponType);
            if (this.weaponMesh && this.useAnimatedCharacter) {
                this.character.attachWeapon(this.weaponMesh);
            }

            // Update damage from weapon stats
            const baseDamage = 20;
            const weaponDamage = weaponDef.stats?.damage || 0;
            this.autoAttackDamage = baseDamage + weaponDamage;
        } else {
            this.attackRange = 2.5;
            this.autoAttackDamage = 20;
        }
    }

    update(deltaTime, input) {
        // Update cooldowns
        if (this.autoAttackCooldown > 0) {
            this.autoAttackCooldown -= deltaTime;
        }

        // Update buffs
        this.updateBuffs(deltaTime);

        // Handle movement
        this.handleMovement(deltaTime, input);

        // Update character animation
        if (this.useAnimatedCharacter) {
            this.character.update(deltaTime);
            this.character.setPosition(this.position);
            this.character.setRotation(this.rotation);
        }

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

            if (this.useAnimatedCharacter) {
                this.character.playAnimation('run');
            }
        } else {
            if (this.useAnimatedCharacter) {
                this.character.playAnimation('idle');
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

    // Stub methods for abilities (adventurer has none)
    useCleave() { return false; }
    useWhirlwind() { return false; }
    useParry() { return false; }
    useHeroicLeap() { return false; }
    useBlizzard() { return false; }
    useFlameWave() { return false; }
    useFrostNova() { return false; }
    useBlink() { return false; }
    useFrozenOrb() { return false; }
    useArrowWave() { return false; }
    useSpinDash() { return false; }
    useShotgun() { return false; }
    useTrap() { return false; }
    useGiantArrow() { return false; }
}
