import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Enemy } from './enemy.js';
import { AssetManifest, getCharacterPath, getAnimationPath, getEquipmentPath } from './assetManifest.js';

// Shared model cache to prevent WebGL texture limit issues
// Each skeleton type shares the same loaded GLTF (textures, materials)
const modelCache = new Map();
const loaderInstance = new GLTFLoader();

// Skeleton enemy using KayKit skeleton models
export class SkeletonEnemy extends Enemy {
    constructor(scene, x, z, type = 'warrior') {
        super(scene, x, z);

        this.skeletonType = type; // 'warrior', 'mage', 'rogue', 'minion'
        this.modelLoaded = false;
        this.mixer = null;
        this.animations = {};
        this.currentAction = null;

        // Override stats based on type
        this.setupStats();

        // Load the skeleton model
        this.loadModel();
    }

    setupStats() {
        switch (this.skeletonType) {
            case 'warrior':
                this.name = 'Skeleton Warrior';
                this.maxHealth = 150;
                this.health = this.maxHealth;
                this.attackDamage = 12;
                this.moveSpeed = 3;
                this.attackRange = 2;
                break;
            case 'mage':
                this.name = 'Skeleton Mage';
                this.maxHealth = 80;
                this.health = this.maxHealth;
                this.attackDamage = 18;
                this.moveSpeed = 2.5;
                this.attackRange = 8;
                this.aggroRange = 15;
                break;
            case 'rogue':
                this.name = 'Skeleton Rogue';
                this.maxHealth = 100;
                this.health = this.maxHealth;
                this.attackDamage = 15;
                this.moveSpeed = 4;
                this.attackRange = 1.5;
                break;
            case 'minion':
            default:
                this.name = 'Skeleton Minion';
                this.maxHealth = 60;
                this.health = this.maxHealth;
                this.attackDamage = 8;
                this.moveSpeed = 3.5;
                this.attackRange = 1.5;
                break;
        }
    }

    async loadModel() {
        try {
            // Get skeleton path from manifest
            const charPath = getCharacterPath('skeletons', this.skeletonType);
            if (!charPath) {
                console.warn(`Skeleton type not found: ${this.skeletonType}, falling back to procedural`);
                this.createFallbackMesh();
                return;
            }

            // Check if model is already cached
            let gltf;
            if (modelCache.has(charPath)) {
                gltf = modelCache.get(charPath);
            } else {
                console.log(`Loading skeleton: ${charPath}`);
                gltf = await this.loadGLTF(loaderInstance, charPath);
                modelCache.set(charPath, gltf);
            }

            // Remove fallback mesh if it exists
            if (this.mesh) {
                this.scene.remove(this.mesh);
            }

            // Clone the scene but share materials/textures
            this.mesh = gltf.scene.clone();
            this.mesh.scale.setScalar(1.0);
            this.mesh.position.copy(this.position);

            // Share materials from the original to avoid texture duplication
            const originalMeshes = [];
            gltf.scene.traverse((child) => {
                if (child.isMesh) originalMeshes.push(child);
            });

            let meshIndex = 0;
            this.mesh.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;

                    // Share material from original (keeps same texture reference)
                    if (originalMeshes[meshIndex]) {
                        child.material = originalMeshes[meshIndex].material;
                    }
                    meshIndex++;
                }
            });

            // Setup animations with cloned mixer
            this.mixer = new THREE.AnimationMixer(this.mesh);

            // Use animations from cached GLTF
            if (gltf.animations && gltf.animations.length > 0) {
                for (const clip of gltf.animations) {
                    const action = this.mixer.clipAction(clip);
                    this.animations[clip.name.toLowerCase()] = action;
                }
            }

            // Load animations from rig files if no embedded animations
            if (Object.keys(this.animations).length === 0) {
                await this.loadRigAnimations(loaderInstance);
            }

            // Play idle animation
            this.playAnimation('idle');

            // Load weapon if applicable
            await this.loadWeapon(loader);

            this.scene.add(this.mesh);
            this.modelLoaded = true;
            this.healthBarHeight = 2.5;

            console.log(`Skeleton ${this.skeletonType} loaded successfully`);
        } catch (error) {
            console.warn(`Failed to load skeleton model, using fallback:`, error);
            this.createFallbackMesh();
        }
    }

    loadGLTF(loader, path) {
        return new Promise((resolve, reject) => {
            loader.load(
                path,
                (gltf) => resolve(gltf),
                undefined,
                (error) => reject(error)
            );
        });
    }

    async loadWeapon(loader) {
        // Ensure mesh exists before loading weapon
        if (!this.mesh) {
            console.warn('Cannot load weapon - mesh not loaded');
            return;
        }

        // Load appropriate weapon based on type
        let weaponPath;
        switch (this.skeletonType) {
            case 'warrior':
                weaponPath = getEquipmentPath('skeleton', 'blade');
                break;
            case 'mage':
                weaponPath = getEquipmentPath('skeleton', 'staff');
                break;
            case 'rogue':
                weaponPath = getEquipmentPath('skeleton', 'axe');
                break;
            default:
                return; // Minions don't have weapons
        }

        if (!weaponPath) return;

        try {
            const weaponGltf = await this.loadGLTF(loader, weaponPath);
            const weapon = weaponGltf.scene;

            // Find hand bone and attach weapon
            let weaponAttached = false;
            this.mesh.traverse((child) => {
                if (!weaponAttached && child.isBone && child.name &&
                    child.name.toLowerCase().includes('hand') &&
                    child.name.toLowerCase().includes('r')) {
                    weapon.scale.setScalar(1.0);
                    child.add(weapon);
                    weaponAttached = true;
                }
            });

            if (!weaponAttached) {
                console.warn(`No hand bone found for ${this.skeletonType}, weapon not attached`);
            }
        } catch (error) {
            console.warn(`Could not load weapon for ${this.skeletonType}:`, error.message || error);
        }
    }

    async loadRigAnimations(loader) {
        // Load animations from KayKit rig files
        const animFiles = AssetManifest.animations.rigMedium;
        if (!animFiles) return;

        // Animation name mappings
        const animMappings = {
            'Idle': 'idle',
            'Idle_A': 'idle',
            'Walk': 'walk',
            'Walking_A': 'walk',
            'Run': 'run',
            'Running_A': 'run',
            'Death': 'death',
            'Death_A': 'death',
            'Hit_A': 'hit',
            'Hit_B': 'hit',
            '1H_Melee_Attack_Slice_Diagonal': 'attack',
            '1H_Melee_Attack_Stab': 'attack',
            'Block': 'block'
        };

        // Load movement and combat packs
        const packsToLoad = ['movementBasic', 'general', 'combatMelee'];

        for (const packName of packsToLoad) {
            const path = animFiles[packName];
            if (!path) continue;

            try {
                const gltf = await this.loadGLTF(loader, path);

                for (const clip of gltf.animations) {
                    let mappedName = animMappings[clip.name];

                    // Fuzzy match if no direct mapping
                    if (!mappedName) {
                        const lowerName = clip.name.toLowerCase();
                        if (lowerName.includes('idle')) mappedName = 'idle';
                        else if (lowerName.includes('walk')) mappedName = 'walk';
                        else if (lowerName.includes('run')) mappedName = 'run';
                        else if (lowerName.includes('death')) mappedName = 'death';
                        else if (lowerName.includes('hit')) mappedName = 'hit';
                        else if (lowerName.includes('attack') || lowerName.includes('slice')) mappedName = 'attack';
                        else if (lowerName.includes('block')) mappedName = 'block';
                    }

                    if (mappedName && !this.animations[mappedName]) {
                        // Retarget the clip
                        const retargetedClip = this.retargetClip(clip);
                        const action = this.mixer.clipAction(retargetedClip);

                        // Configure looping
                        if (['idle', 'walk', 'run'].includes(mappedName)) {
                            action.setLoop(THREE.LoopRepeat);
                        } else {
                            action.setLoop(THREE.LoopOnce);
                            action.clampWhenFinished = true;
                        }

                        this.animations[mappedName] = action;
                    }
                }
            } catch (error) {
                console.warn(`Could not load animation pack ${packName}:`, error.message);
            }
        }

        console.log(`Skeleton animations loaded: ${Object.keys(this.animations).join(', ')}`);
    }

    retargetClip(clip) {
        // Clone clip and simplify track names for compatibility
        const newTracks = [];

        for (const track of clip.tracks) {
            const match = track.name.match(/^(.+?)\.(.+)$/);
            if (match) {
                const bonePath = match[1];
                const property = match[2];
                const boneName = bonePath.split('/').pop();

                // Try simplified bone name
                const newTrack = track.clone();
                newTrack.name = `${boneName}.${property}`;
                newTracks.push(newTrack);
            } else {
                newTracks.push(track.clone());
            }
        }

        return new THREE.AnimationClip(clip.name, clip.duration, newTracks, clip.blendMode);
    }

    createFallbackMesh() {
        // Procedural skeleton-like mesh as fallback
        this.mesh = new THREE.Group();

        const boneMaterial = new THREE.MeshStandardMaterial({
            color: 0xddddcc,
            roughness: 0.8,
            emissive: new THREE.Color(0x110000),
            emissiveIntensity: 0.1
        });

        // Skull
        const skullGeometry = new THREE.SphereGeometry(0.25, 8, 6);
        const skull = new THREE.Mesh(skullGeometry, boneMaterial);
        skull.position.y = 1.8;
        skull.scale.set(1, 1.1, 0.9);
        this.mesh.add(skull);

        // Eye sockets
        const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xff2200 });
        const eyeGeometry = new THREE.SphereGeometry(0.06, 6, 4);

        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.08, 1.82, 0.18);
        this.mesh.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.08, 1.82, 0.18);
        this.mesh.add(rightEye);

        // Ribcage
        const ribGeometry = new THREE.CylinderGeometry(0.25, 0.2, 0.6, 8);
        const ribcage = new THREE.Mesh(ribGeometry, boneMaterial);
        ribcage.position.y = 1.3;
        this.mesh.add(ribcage);

        // Spine
        const spineGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.8, 6);
        const spine = new THREE.Mesh(spineGeometry, boneMaterial);
        spine.position.y = 0.8;
        this.mesh.add(spine);

        // Pelvis
        const pelvisGeometry = new THREE.BoxGeometry(0.35, 0.15, 0.15);
        const pelvis = new THREE.Mesh(pelvisGeometry, boneMaterial);
        pelvis.position.y = 0.5;
        this.mesh.add(pelvis);

        // Arms
        const armGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.5, 4);

        // Left arm
        const leftArm = new THREE.Mesh(armGeometry, boneMaterial);
        leftArm.position.set(-0.35, 1.3, 0);
        leftArm.rotation.z = 0.3;
        this.mesh.add(leftArm);

        // Right arm
        const rightArm = new THREE.Mesh(armGeometry, boneMaterial);
        rightArm.position.set(0.35, 1.3, 0);
        rightArm.rotation.z = -0.3;
        this.mesh.add(rightArm);

        // Legs
        const legGeometry = new THREE.CylinderGeometry(0.05, 0.04, 0.6, 4);

        // Left leg
        const leftLeg = new THREE.Mesh(legGeometry, boneMaterial);
        leftLeg.position.set(-0.12, 0.15, 0);
        this.mesh.add(leftLeg);

        // Right leg
        const rightLeg = new THREE.Mesh(legGeometry, boneMaterial);
        rightLeg.position.set(0.12, 0.15, 0);
        this.mesh.add(rightLeg);

        this.mesh.position.copy(this.position);
        this.mesh.castShadow = true;
        this.scene.add(this.mesh);

        this.healthBarHeight = 2.2;
    }

    playAnimation(name) {
        if (!this.mixer || !this.animations[name]) return;

        const action = this.animations[name];

        if (this.currentAction === action) return;

        if (this.currentAction) {
            action.reset();
            action.crossFadeFrom(this.currentAction, 0.2, true);
            action.play();
        } else {
            action.reset();
            action.play();
        }

        this.currentAction = action;
    }

    update(deltaTime, player, camera) {
        if (!this.isAlive) return;

        // Update animation mixer
        if (this.mixer) {
            this.mixer.update(deltaTime);
        }

        // Stun
        if (this.stunTime > 0) {
            this.stunTime -= deltaTime;
            this.updateHealthBar(camera);
            return;
        }

        // Attack cooldown
        if (this.attackCooldown > 0) {
            this.attackCooldown -= deltaTime;
        }

        // Check aggro
        const distToPlayer = this.position.distanceTo(player.position);
        if (distToPlayer < this.aggroRange) {
            this.isAggro = true;
        }

        // Move toward player if aggro
        if (this.isAggro && distToPlayer > this.attackRange) {
            const dir = new THREE.Vector3()
                .subVectors(player.position, this.position)
                .normalize();
            dir.y = 0;

            this.position.add(dir.multiplyScalar(this.moveSpeed * deltaTime));

            // Face player
            if (this.mesh) {
                this.mesh.rotation.y = Math.atan2(dir.x, dir.z);
            }

            // Play walk/run animation
            if (this.modelLoaded) {
                this.playAnimation('walk');
            }
        } else if (this.modelLoaded && !this.isAttacking) {
            this.playAnimation('idle');
        }

        // Update mesh position
        if (this.mesh) {
            this.mesh.position.copy(this.position);
        }

        // Update target ring position
        if (this.targetRing) {
            this.targetRing.position.x = this.position.x;
            this.targetRing.position.z = this.position.z;
        }

        // Update health bar
        this.updateHealthBar(camera);
    }

    tryAttack(player) {
        if (this.attackCooldown > 0 || this.stunTime > 0) return false;

        // Play attack animation
        if (this.modelLoaded) {
            this.playAnimation('attack');
            this.isAttacking = true;

            // Reset attacking state after animation
            setTimeout(() => {
                this.isAttacking = false;
            }, 500);
        }

        // Check if player can parry
        if (player.tryParry && player.tryParry(this)) {
            this.attackCooldown = this.attackCooldownMax;
            return false;
        }

        player.takeDamage(this.attackDamage);
        this.attackCooldown = this.attackCooldownMax;
        return true;
    }

    takeDamage(amount, source) {
        this.health -= amount;
        this.isAggro = true;

        // Play hit animation
        if (this.modelLoaded && this.animations.hit) {
            this.playAnimation('hit');
        }

        // Flash red
        if (this.mesh) {
            this.mesh.traverse((child) => {
                if (child.isMesh && child.material && !Array.isArray(child.material)) {
                    const originalColor = child.material.color.getHex();
                    child.material.color.setHex(0xff0000);
                    setTimeout(() => {
                        if (child.material) {
                            child.material.color.setHex(originalColor);
                        }
                    }, 100);
                }
            });
        }

        // Store for particle effects
        this.lastHitPosition = this.position.clone();
        this.lastHitPosition.y += 1;
        this.lastHitAmount = amount;

        if (this.health <= 0) {
            this.die();
        }
    }

    die() {
        this.isAlive = false;

        // Play death animation if available
        if (this.modelLoaded && this.animations.death) {
            this.playAnimation('death');
            // Remove after animation
            setTimeout(() => this.cleanup(), 2000);
        } else {
            this.cleanup();
        }

        // Store death position for particles
        this.deathPosition = this.position.clone();
        this.deathPosition.y += 1;
        this.justDied = true;
    }

    cleanup() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
        }
        if (this.healthBarGroup) {
            this.scene.remove(this.healthBarGroup);
        }
        if (this.targetRing) {
            this.scene.remove(this.targetRing);
        }
    }
}

// Factory function to create different skeleton types
export function createSkeletonEnemy(scene, x, z, type = 'warrior') {
    return new SkeletonEnemy(scene, x, z, type);
}
