import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AssetManifest, getCharacterPath, getAnimationPath } from './assetManifest.js';

// KayKit character controller - supports GLB models with separate animation files
export class KayKitCharacter {
    constructor(scene) {
        this.scene = scene;
        this.model = null;
        this.mixer = null;
        this.animations = {};
        this.currentAction = null;
        this.isLoaded = false;
        this.loadProgress = 0;

        // Animation state
        this.animationState = 'idle';
        this.isAttacking = false;
        this.attackQueue = [];

        // Model scale (KayKit models are properly scaled)
        this.scale = 1.0;

        // Bone references for attachments
        this.bones = {
            handR: null,
            handL: null,
            head: null,
            spine: null
        };

        // Animation clip name mappings (KayKit clip names to our names)
        // KayKit uses various naming conventions
        this.animationMappings = {
            // Movement - various KayKit naming styles
            'Idle': 'idle',
            'Idle_A': 'idle',
            'Idle_B': 'idle',
            '1H_Melee_Idle': 'idle',
            '2H_Melee_Idle': 'idle',
            'Unarmed_Idle': 'idle',
            'Walk': 'walk',
            'Walk_A': 'walk',
            'Walking_A': 'walk',
            'Walking_B': 'walk',
            '1H_Melee_Walk': 'walk',
            'Run': 'run',
            'Run_A': 'run',
            'Running_A': 'run',
            'Running_B': 'run',
            '1H_Melee_Run': 'run',
            'Run_Fast': 'runFast',
            // Combat Melee - KayKit styles
            'Attack_Slash': 'attack1',
            '1H_Melee_Attack_Slice_Diagonal': 'attack1',
            '1H_Melee_Attack_Slice_Horizontal': 'attack2',
            '1H_Melee_Attack_Stab': 'attack3',
            '1H_Melee_Attack_Chop': 'attack4',
            '2H_Melee_Attack_Slice': 'attack1',
            '2H_Melee_Attack_Spin': 'attack2',
            'Unarmed_Melee_Attack_Punch_A': 'attack1',
            'Unarmed_Melee_Attack_Punch_B': 'attack2',
            'Unarmed_Melee_Attack_Kick': 'attack3',
            'Block': 'block',
            'Block_Idle': 'blockIdle',
            'Blocking_Idle': 'blockIdle',
            '1H_Melee_Block_Idle': 'blockIdle',
            // General
            'Death': 'death',
            'Death_A': 'death',
            'Death_A_Pose': 'death',
            'Death_B': 'death',
            'Death_B_Pose': 'death',
            'Hit': 'impact',
            'Hit_A': 'impact',
            'Hit_B': 'impact',
            'Interact': 'interact',
            'Jump': 'jump',
            'Jump_Full_Long': 'jump',
            'Jump_Full_Short': 'jump',
            'Jump_Start': 'jumpStart',
            'Jump_Idle': 'jumpIdle',
            'Jump_Land': 'jumpLand',
            'Roll': 'dodge',
            'Dodge_Right': 'dodge',
            'Dodge_Left': 'dodge',
            'Dodge_Backward': 'dodge',
            // Strafe
            'Strafe_Left': 'strafeLeft',
            'Strafe_Right': 'strafeRight',
            'Running_Strafe_Left': 'strafeLeft',
            'Running_Strafe_Right': 'strafeRight'
        };
    }

    async load(characterType = 'adventurers', characterName = 'knight') {
        const loader = new GLTFLoader();

        try {
            // Get character path from manifest
            const charPath = getCharacterPath(characterType, characterName);
            if (!charPath) {
                throw new Error(`Character not found: ${characterType}/${characterName}`);
            }

            // Load character model
            console.log(`Loading character: ${charPath}`);
            const gltf = await this.loadGLTF(loader, charPath);
            this.model = gltf.scene;
            this.model.scale.setScalar(this.scale);

            // Setup materials and shadows
            this.model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    this.fixMaterial(child.material);
                }
                // Find bones for attachments
                if (child.isBone) {
                    this.findBone(child);
                }
            });

            // Create animation mixer
            this.mixer = new THREE.AnimationMixer(this.model);

            // Load animations from rig files
            await this.loadAnimations(loader, characterType);

            this.scene.add(this.model);
            this.isLoaded = true;

            // Start with idle animation
            this.playAnimation('idle', true);

            console.log('KayKit character loaded successfully');
            return true;
        } catch (error) {
            console.error('Failed to load KayKit character:', error);
            return false;
        }
    }

    findBone(bone) {
        const name = bone.name.toLowerCase();
        if (name.includes('hand') && name.includes('r')) {
            this.bones.handR = bone;
        } else if (name.includes('hand') && name.includes('l')) {
            this.bones.handL = bone;
        } else if (name.includes('head')) {
            this.bones.head = bone;
        } else if (name.includes('spine')) {
            this.bones.spine = bone;
        }
    }

    fixMaterial(material) {
        if (!material) return;

        if (Array.isArray(material)) {
            material.forEach(m => this.fixMaterial(m));
            return;
        }

        // Ensure proper rendering
        material.transparent = false;
        material.opacity = 1.0;
        material.side = THREE.FrontSide;

        if (material.isMeshStandardMaterial) {
            material.roughness = Math.max(0.4, material.roughness || 0.5);
            material.metalness = Math.min(0.3, material.metalness || 0.0);
        }
    }

    loadGLTF(loader, path) {
        return new Promise((resolve, reject) => {
            loader.load(
                path,
                (gltf) => resolve(gltf),
                (xhr) => {
                    if (xhr.lengthComputable) {
                        this.loadProgress = (xhr.loaded / xhr.total) * 100;
                    }
                },
                (error) => reject(error)
            );
        });
    }

    async loadAnimations(loader, characterType) {
        // Determine rig type from character
        const charInfo = AssetManifest.characters[characterType];
        const rigType = charInfo?.knight?.rig || 'medium';
        const rigKey = rigType === 'large' ? 'rigLarge' : 'rigMedium';

        // Animation files to load
        const animFiles = AssetManifest.animations[rigKey];
        if (!animFiles) {
            console.warn(`No animations found for rig type: ${rigKey}`);
            return;
        }

        // Find the skeleton root in our model for retargeting
        let skeletonRoot = null;
        this.model.traverse((child) => {
            if (child.isSkinnedMesh && child.skeleton) {
                skeletonRoot = child.skeleton.bones[0]?.parent || this.model;
            }
        });

        console.log(`Loading ${Object.keys(animFiles).length} animation packs for ${rigKey}...`);

        // Load each animation file
        const loadPromises = Object.entries(animFiles).map(async ([name, path]) => {
            try {
                const gltf = await this.loadGLTF(loader, path);
                console.log(`  Pack "${name}": ${gltf.animations.length} clips found`);
                // Log first few clip names for debugging
                gltf.animations.slice(0, 5).forEach(clip => {
                    console.log(`    - ${clip.name}`);
                });
                if (gltf.animations.length > 5) {
                    console.log(`    ... and ${gltf.animations.length - 5} more`);
                }
                return { name, clips: gltf.animations };
            } catch (error) {
                console.warn(`Could not load animation pack ${name}:`, error.message);
                return { name, clips: [] };
            }
        });

        const results = await Promise.all(loadPromises);

        // Process all loaded clips
        let loadedCount = 0;
        for (const { name: packName, clips } of results) {
            for (const clip of clips) {
                // Map KayKit clip name to our animation name
                let mappedName = this.animationMappings[clip.name];

                // If no direct mapping, try fuzzy matching
                if (!mappedName) {
                    const lowerName = clip.name.toLowerCase();
                    // Try to infer animation type from name
                    if (lowerName.includes('idle')) mappedName = 'idle';
                    else if (lowerName.includes('walk')) mappedName = 'walk';
                    else if (lowerName.includes('run')) mappedName = 'run';
                    else if (lowerName.includes('attack') || lowerName.includes('slice') || lowerName.includes('chop')) {
                        if (!this.animations.attack1) mappedName = 'attack1';
                        else if (!this.animations.attack2) mappedName = 'attack2';
                        else if (!this.animations.attack3) mappedName = 'attack3';
                        else mappedName = 'attack4';
                    }
                    else if (lowerName.includes('death')) mappedName = 'death';
                    else if (lowerName.includes('hit') || lowerName.includes('damage')) mappedName = 'impact';
                    else if (lowerName.includes('block')) mappedName = 'block';
                    else if (lowerName.includes('jump')) mappedName = 'jump';
                    else if (lowerName.includes('roll') || lowerName.includes('dodge')) mappedName = 'dodge';
                    else mappedName = lowerName.replace(/[^a-z0-9]/g, '_');
                }

                // Create action if not already exists for this mapped name
                if (!this.animations[mappedName]) {
                    // Retarget the clip to work with our model's skeleton
                    const retargetedClip = this.retargetClip(clip);
                    const action = this.mixer.clipAction(retargetedClip);

                    // Configure animation properties
                    if (this.isLoopingAnimation(mappedName)) {
                        action.setLoop(THREE.LoopRepeat);
                    } else {
                        action.setLoop(THREE.LoopOnce);
                        action.clampWhenFinished = true;
                    }

                    this.animations[mappedName] = action;
                    loadedCount++;
                }
            }
        }

        console.log(`Loaded ${loadedCount} unique animations. Available: ${Object.keys(this.animations).join(', ')}`);

        // Setup animation finished callback
        this.mixer.addEventListener('finished', (e) => {
            this.onAnimationFinished(e.action);
        });
    }

    retargetClip(clip) {
        // KayKit animations use track names like "Armature/Bone.property"
        // We need to ensure these match our model's structure
        // Clone the clip and modify track names if needed
        const newTracks = [];

        for (const track of clip.tracks) {
            // Parse track name: "Armature/BoneName.property" or just "BoneName.property"
            let trackName = track.name;

            // Try to find the bone in our model
            const match = trackName.match(/^(.+?)\.(.+)$/);
            if (match) {
                const bonePath = match[1];
                const property = match[2];
                const boneName = bonePath.split('/').pop(); // Get just the bone name

                // Check if bone exists in model
                let boneFound = false;
                this.model.traverse((child) => {
                    if (child.name === boneName || child.name === bonePath) {
                        boneFound = true;
                    }
                });

                // If the full path doesn't work, try just the bone name
                if (!boneFound) {
                    // Create new track with simplified name
                    const newTrack = track.clone();
                    newTrack.name = `${boneName}.${property}`;
                    newTracks.push(newTrack);
                    continue;
                }
            }

            newTracks.push(track.clone());
        }

        return new THREE.AnimationClip(clip.name, clip.duration, newTracks, clip.blendMode);
    }

    isLoopingAnimation(name) {
        return ['idle', 'run', 'walk', 'runfast', 'blockidle', 'strafeleft', 'straferight'].includes(name.toLowerCase());
    }

    onAnimationFinished(action) {
        const animName = action.getClip().name.toLowerCase();

        if (animName.includes('attack') || animName === 'impact' || animName === 'hit') {
            this.isAttacking = false;
            this.attackStartTime = null;

            // Check if there's a queued attack
            if (this.attackQueue.length > 0) {
                const nextAttack = this.attackQueue.shift();
                this.playAttack(nextAttack);
            } else {
                this.returnToDefaultAnimation();
            }
        } else if (['jump', 'block', 'roll', 'dodge'].includes(animName)) {
            this.returnToDefaultAnimation();
        }
    }

    returnToDefaultAnimation() {
        this.isAttacking = false;
        this.attackStartTime = null;
        if (['run', 'walk', 'strafeleft', 'straferight'].includes(this.animationState)) {
            this.playAnimation(this.animationState, true);
        } else {
            this.playAnimation('idle', true);
        }
    }

    cancelAnimation() {
        this.isAttacking = false;
        this.attackStartTime = null;
        this.attackQueue = [];
        this.returnToDefaultAnimation();
    }

    playAnimation(name, loop = false, crossfadeDuration = 0.2) {
        if (!this.animations[name]) {
            // Try lowercase version
            const lowerName = name.toLowerCase();
            if (!this.animations[lowerName]) {
                console.warn(`Animation ${name} not found`);
                return;
            }
            name = lowerName;
        }

        const newAction = this.animations[name];

        if (this.currentAction === newAction) {
            return; // Already playing
        }

        if (this.currentAction) {
            newAction.reset();
            newAction.setEffectiveTimeScale(1);
            newAction.setEffectiveWeight(1);
            newAction.crossFadeFrom(this.currentAction, crossfadeDuration, true);
            newAction.play();
        } else {
            newAction.reset();
            newAction.play();
        }

        this.currentAction = newAction;

        if (!name.includes('attack') && name !== 'impact' && name !== 'death' && name !== 'hit') {
            this.animationState = name;
        }
    }

    playAttack(attackNum = 1) {
        if (this.isAttacking) {
            if (this.attackQueue.length < 2) {
                this.attackQueue.push(attackNum);
            }
            return;
        }

        this.isAttacking = true;
        this.attackStartTime = Date.now();

        const attackName = `attack${attackNum}`;
        if (this.animations[attackName]) {
            this.playAnimation(attackName, false, 0.1);
        } else if (this.animations.attack1) {
            this.playAnimation('attack1', false, 0.1);
        }
    }

    playBlock() {
        if (!this.isAttacking) {
            this.playAnimation('block', false, 0.1);
        }
    }

    playImpact() {
        const impactAnim = this.animations.impact || this.animations.hit;
        if (impactAnim && !this.isAttacking) {
            this.playAnimation(impactAnim === this.animations.impact ? 'impact' : 'hit', false, 0.05);
            this.isAttacking = true;
        }
    }

    playDeath() {
        this.playAnimation('death', false, 0.2);
    }

    playJump() {
        if (this.animations.jump) {
            this.playAnimation('jump', false, 0.1);
        }
    }

    playDodge() {
        const dodgeAnim = this.animations.dodge || this.animations.roll;
        if (dodgeAnim) {
            this.playAnimation(dodgeAnim === this.animations.dodge ? 'dodge' : 'roll', false, 0.1);
        }
    }

    playPowerUp() {
        // Play a special animation for power-up abilities
        // Use interact or a combat animation if available
        if (this.animations.interact) {
            this.playAnimation('interact', false, 0.1);
        } else if (this.animations.attack1) {
            this.playAnimation('attack1', false, 0.1);
        }
    }

    playSpellCast() {
        // Play spell casting animation
        if (this.animations.interact) {
            this.playAnimation('interact', false, 0.1);
        } else if (this.animations.attack1) {
            this.playAnimation('attack1', false, 0.1);
        }
    }

    update(deltaTime, isMoving, isRunning = true, isGrounded = true) {
        if (!this.isLoaded) return;

        // Update animation mixer
        if (this.mixer) {
            this.mixer.update(deltaTime);
        }

        // Don't change animation if dead
        if (this.currentAction === this.animations.death) return;

        // Clear stuck attacking state after timeout
        if (this.isAttacking && this.attackStartTime) {
            if (Date.now() - this.attackStartTime > 2000) {
                this.isAttacking = false;
                this.attackStartTime = null;
            }
        }

        // Handle movement animations
        if (isMoving && !this.isAttacking) {
            if (isRunning && this.animations.run) {
                this.playAnimation('run', true);
            } else if (this.animations.walk) {
                this.playAnimation('walk', true);
            }
        } else if (!isMoving && !this.isAttacking) {
            this.playAnimation('idle', true);
        }
    }

    setPosition(x, y, z) {
        if (this.model) {
            this.model.position.set(x, y, z);
        }
    }

    setRotation(yRotation) {
        if (this.model) {
            this.model.rotation.y = yRotation;
        }
    }

    getPosition() {
        return this.model ? this.model.position : new THREE.Vector3();
    }

    getBone(boneName) {
        return this.bones[boneName] || null;
    }

    dispose() {
        if (this.mixer) {
            this.mixer.stopAllAction();
        }
        if (this.model) {
            this.scene.remove(this.model);
            this.model.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
        }
    }
}
