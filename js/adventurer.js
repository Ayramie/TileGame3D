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

            // Set abilities based on weapon type
            if (weaponType !== this.currentWeaponType) {
                this.currentWeaponType = weaponType;
                if (weaponType === 'sword' || weaponType === 'dagger') {
                    this.abilities = this.getWarriorAbilities();
                    console.log('Adventurer: Equipped melee weapon - Warrior abilities unlocked!');
                } else if (weaponType === 'staff') {
                    this.abilities = this.getMageAbilities();
                    console.log('Adventurer: Equipped staff - Mage abilities unlocked!');
                } else if (weaponType === 'bow') {
                    this.abilities = this.getHunterAbilities();
                    console.log('Adventurer: Equipped bow - Hunter abilities unlocked!');
                }
                // Notify game to update UI
                if (this.game && this.game.updateAbilityUI) {
                    this.game.updateAbilityUI();
                }
            }
        } else {
            this.attackRange = 2.5;
            this.autoAttackDamage = 20;
            // No weapon - disable all abilities
            if (this.currentWeaponType !== null) {
                this.currentWeaponType = null;
                this.abilities = this.getDisabledAbilities();
                console.log('Adventurer: Unequipped weapon - Abilities disabled');
                if (this.game && this.game.updateAbilityUI) {
                    this.game.updateAbilityUI();
                }
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
            blink: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            frozenOrb: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            arrowWave: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            spinDash: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            shotgun: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            trap: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            giantArrow: { cooldown: 999, cooldownRemaining: 999, isActive: false }
        };
    }

    // Get warrior abilities for melee weapons
    getWarriorAbilities() {
        return {
            cleave: { cooldown: 4, cooldownRemaining: 0, damage: 45, range: 8.0, angle: Math.PI * 0.6, isActive: false },
            whirlwind: { cooldown: 6, cooldownRemaining: 0, damage: 35, range: 3.5, dashDistance: 10, dashDuration: 0.5, isActive: false },
            parry: { cooldown: 5, cooldownRemaining: 0, damage: 50, range: 4, spinDuration: 0.4, isActive: false },
            heroicLeap: { cooldown: 8, cooldownRemaining: 0, damage: 60, range: 15, radius: 4, isActive: false },
            // Disable other class abilities
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
    }

    // Get mage abilities for staff weapons
    getMageAbilities() {
        return {
            blizzard: { cooldown: 6, cooldownRemaining: 0, damage: 15, range: 12, radius: 5, duration: 3, tickRate: 0.5, isActive: false },
            flameWave: { cooldown: 5, cooldownRemaining: 0, damage: 40, range: 10, width: 6, isActive: false },
            frostNova: { cooldown: 8, cooldownRemaining: 0, damage: 30, radius: 5, slowDuration: 3, isActive: false },
            blink: { cooldown: 4, cooldownRemaining: 0, distance: 8, isActive: false },
            frozenOrb: { cooldown: 10, cooldownRemaining: 0, damage: 25, range: 15, radius: 3, duration: 4, isActive: false },
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
            // Disable other class abilities
            cleave: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            whirlwind: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            parry: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            heroicLeap: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            blizzard: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            flameWave: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            frostNova: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            blink: { cooldown: 999, cooldownRemaining: 999, isActive: false },
            frozenOrb: { cooldown: 999, cooldownRemaining: 999, isActive: false }
        };
    }

    // Stub methods for abilities - will work when weapon is equipped
    useCleave() { return this.currentWeaponType === 'sword' && this.abilities.cleave.cooldownRemaining <= 0; }
    useWhirlwind() { return this.currentWeaponType === 'sword' && this.abilities.whirlwind.cooldownRemaining <= 0; }
    useParry() { return this.currentWeaponType === 'sword' && this.abilities.parry.cooldownRemaining <= 0; }
    useHeroicLeap() { return this.currentWeaponType === 'sword' && this.abilities.heroicLeap.cooldownRemaining <= 0; }
    useBlizzard() { return this.currentWeaponType === 'staff' && this.abilities.blizzard.cooldownRemaining <= 0; }
    useFlameWave() { return this.currentWeaponType === 'staff' && this.abilities.flameWave.cooldownRemaining <= 0; }
    useFrostNova() { return this.currentWeaponType === 'staff' && this.abilities.frostNova.cooldownRemaining <= 0; }
    useBlink() { return this.currentWeaponType === 'staff' && this.abilities.blink.cooldownRemaining <= 0; }
    useFrozenOrb() { return this.currentWeaponType === 'staff' && this.abilities.frozenOrb.cooldownRemaining <= 0; }
    useArrowWave() { return this.currentWeaponType === 'bow' && this.abilities.arrowWave.cooldownRemaining <= 0; }
    useSpinDash() { return this.currentWeaponType === 'bow' && this.abilities.spinDash.cooldownRemaining <= 0; }
    useShotgun() { return this.currentWeaponType === 'bow' && this.abilities.shotgun.cooldownRemaining <= 0; }
    useTrap() { return this.currentWeaponType === 'bow' && this.abilities.trap.cooldownRemaining <= 0; }
    useGiantArrow() { return this.currentWeaponType === 'bow' && this.abilities.giantArrow.cooldownRemaining <= 0; }
}
