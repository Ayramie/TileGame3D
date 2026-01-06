import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

export class CharacterController {
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

        // Model scale (Mixamo models are usually huge)
        this.scale = 0.01;
    }

    async load() {
        const loader = new FBXLoader();

        // Load main character model
        try {
            this.model = await this.loadFBX(loader, './models/character.fbx');
            this.model.scale.setScalar(this.scale);

            // Setup materials for the character
            this.model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    // Make materials less shiny
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => this.fixMaterial(m));
                        } else {
                            this.fixMaterial(child.material);
                        }
                    }
                }
            });

            // Create animation mixer
            this.mixer = new THREE.AnimationMixer(this.model);

            // Load animations
            await this.loadAnimations(loader);

            this.scene.add(this.model);
            this.isLoaded = true;

            // Start with idle animation
            this.playAnimation('idle', true);

            console.log('Character loaded successfully');
            return true;
        } catch (error) {
            console.error('Failed to load character:', error);
            return false;
        }
    }

    fixMaterial(material) {
        // Fix transparency - FBX models often come with unwanted transparency
        material.transparent = false;
        material.opacity = 1.0;
        material.alphaTest = 0;

        if (material.isMeshPhongMaterial || material.isMeshStandardMaterial) {
            material.shininess = 10;
            material.roughness = 0.8;
            material.metalness = 0.1;
        }
    }

    loadFBX(loader, path) {
        return new Promise((resolve, reject) => {
            loader.load(
                path,
                (object) => resolve(object),
                (xhr) => {
                    this.loadProgress = (xhr.loaded / xhr.total) * 100;
                },
                (error) => reject(error)
            );
        });
    }

    // Remove root motion from animation clips to prevent character moving on its own
    removeRootMotion(clip) {
        // Filter out position tracks on root/hips bones
        const filteredTracks = clip.tracks.filter(track => {
            // Remove position tracks on root bones (Mixamo uses "mixamorigHips")
            const isPositionTrack = track.name.endsWith('.position');
            const isRootBone = track.name.includes('Hips') ||
                track.name.includes('Root') ||
                track.name.startsWith('mixamorig');

            // Keep the track unless it's a position track on a root bone
            // But allow Y position for jumps (vertical movement)
            if (isPositionTrack && isRootBone) {
                // Check if this is specifically the hips position
                if (track.name.includes('Hips.position')) {
                    return false; // Remove hips position track entirely
                }
            }
            return true;
        });

        // Create new clip with filtered tracks
        return new THREE.AnimationClip(clip.name, clip.duration, filteredTracks);
    }

    async loadAnimations(loader) {
        const animationFiles = {
            idle: './models/animations/sword and shield idle.fbx',
            run: './models/animations/sword and shield run.fbx',
            walk: './models/animations/sword and shield walk.fbx',
            attack1: './models/animations/sword and shield slash.fbx',
            attack2: './models/animations/sword and shield slash (2).fbx',
            attack3: './models/animations/sword and shield slash (3).fbx',
            attack4: './models/animations/sword and shield attack.fbx',
            block: './models/animations/sword and shield block.fbx',
            blockIdle: './models/animations/sword and shield block idle.fbx',
            death: './models/animations/sword and shield death.fbx',
            impact: './models/animations/sword and shield impact.fbx',
            jump: './models/animations/sword and shield jump.fbx',
            strafe: './models/animations/sword and shield strafe.fbx',
            powerUp: './models/animations/sword and shield power up.fbx'
        };

        // Load all animations in parallel for faster loading
        const loadPromises = Object.entries(animationFiles).map(async ([name, path]) => {
            try {
                const anim = await this.loadFBX(loader, path);
                return { name, anim };
            } catch (error) {
                console.warn(`Could not load animation ${name}:`, error.message);
                return { name, anim: null };
            }
        });

        const results = await Promise.all(loadPromises);

        // Process loaded animations
        for (const { name, anim } of results) {
            if (anim && anim.animations && anim.animations.length > 0) {
                let clip = anim.animations[0];

                // Remove root motion (position tracks on hips) to prevent rubberbanding
                clip = this.removeRootMotion(clip);

                clip.name = name;
                this.animations[name] = this.mixer.clipAction(clip);

                // Configure animation properties
                if (name === 'idle' || name === 'run' || name === 'walk' || name === 'blockIdle' || name === 'strafe') {
                    this.animations[name].setLoop(THREE.LoopRepeat);
                } else if (name.startsWith('attack') || name === 'impact') {
                    this.animations[name].setLoop(THREE.LoopOnce);
                    this.animations[name].clampWhenFinished = true;
                } else if (name === 'death') {
                    this.animations[name].setLoop(THREE.LoopOnce);
                    this.animations[name].clampWhenFinished = true;
                } else if (name === 'jump' || name === 'block') {
                    this.animations[name].setLoop(THREE.LoopOnce);
                    this.animations[name].clampWhenFinished = false;
                }
            }
        }

        // Setup animation finished callback
        this.mixer.addEventListener('finished', (e) => {
            this.onAnimationFinished(e.action);
        });
    }

    onAnimationFinished(action) {
        const animName = action.getClip().name;

        if (animName.startsWith('attack') || animName === 'impact') {
            this.isAttacking = false;
            this.attackStartTime = null;

            // Check if there's a queued attack
            if (this.attackQueue.length > 0) {
                const nextAttack = this.attackQueue.shift();
                this.playAttack(nextAttack);
            } else {
                // Return to idle or movement
                this.returnToDefaultAnimation();
            }
        } else if (animName === 'jump' || animName === 'block' || animName === 'powerUp') {
            // Return to idle or movement after these animations
            this.returnToDefaultAnimation();
        }
    }

    returnToDefaultAnimation() {
        this.isAttacking = false;
        this.attackStartTime = null;
        if (this.animationState === 'run' || this.animationState === 'walk' || this.animationState === 'strafe') {
            this.playAnimation(this.animationState, true);
        } else {
            this.playAnimation('idle', true);
        }
    }

    // Force cancel current animation and return to default
    cancelAnimation() {
        this.isAttacking = false;
        this.attackStartTime = null;
        this.attackQueue = [];
        this.returnToDefaultAnimation();
    }

    playAnimation(name, loop = false, crossfadeDuration = 0.2) {
        if (!this.animations[name]) {
            console.warn(`Animation ${name} not found`);
            return;
        }

        const newAction = this.animations[name];

        if (this.currentAction === newAction) {
            return; // Already playing
        }

        if (this.currentAction) {
            // Crossfade from current to new
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

        if (!name.startsWith('attack') && name !== 'impact' && name !== 'death') {
            this.animationState = name;
        }
    }

    playAttack(attackNum = 1) {
        if (this.isAttacking) {
            // Queue the attack
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
        if (this.animations.impact && !this.isAttacking) {
            this.playAnimation('impact', false, 0.05);
            this.isAttacking = true; // Prevent movement during impact
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

    playPowerUp() {
        if (this.animations.powerUp) {
            this.playAnimation('powerUp', false, 0.2);
        }
    }

    // Called every frame
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

        // Allow movement to interrupt non-critical animations
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

    // Position and rotation setters
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

    // Cleanup
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
