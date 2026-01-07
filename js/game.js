import * as THREE from 'three';
import { Player } from './player.js';
import { Mage } from './mage.js';
import { ThirdPersonCamera } from './camera.js';
import { InputManager } from './input.js';
import { SkeletonEnemy, createSkeletonEnemy } from './skeletonEnemy.js';
import { EffectsManager } from './effects.js';
import { ParticleSystem } from './particles.js';
import { DungeonBuilder } from './dungeonBuilder.js';

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.clock = new THREE.Clock();

        // Three.js core
        this.scene = new THREE.Scene();
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Sky gradient - create a simple gradient background
        this.scene.background = new THREE.Color(0x88bbee);
        this.scene.fog = new THREE.FogExp2(0x88bbee, 0.008);

        // Game state
        this.gameState = 'menu'; // 'menu' or 'playing'
        this.gameMode = null; // 'horde', 'dungeon', or 'boss'
        this.selectedClass = 'warrior'; // 'warrior' or 'mage'
        this.enemies = [];
        this.projectiles = [];
        this.particles = [];
        this.damageNumbers = [];
        this.groundHazards = [];

        // Dungeon builder
        this.dungeonBuilder = null;

        // Effects manager
        this.effects = new EffectsManager(this.scene);

        // Setup menu handlers
        this.setupMenu();

        // Handle window resize
        window.addEventListener('resize', () => this.onResize());
    }

    setupMenu() {
        const menuBtns = document.querySelectorAll('.menu-btn');
        menuBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                this.startGame(mode);
            });
        });

        // Character selection buttons
        const classBtns = document.querySelectorAll('.class-btn');
        classBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove selected from all
                classBtns.forEach(b => b.classList.remove('selected'));
                // Add selected to clicked
                btn.classList.add('selected');
                this.selectedClass = btn.dataset.class;
            });
        });

        const returnBtn = document.getElementById('return-menu-btn');
        returnBtn.addEventListener('click', () => {
            this.returnToMenu();
        });
    }

    async startGame(mode) {
        this.gameMode = mode;
        this.gameState = 'loading';

        // Hide menu, show loading text, hide canvas during load
        const menu = document.getElementById('main-menu');
        menu.innerHTML = '<h1>Loading...</h1>';
        this.canvas.style.opacity = '0';

        // Clear previous game state
        this.clearScene();

        // Setup fresh game
        await this.setupScene();
        this.setupLighting();
        this.setupPlayer();

        // Wait for character to load before continuing
        if (this.player && this.player.character) {
            // Wait for character loading to complete
            while (this.player.characterLoading) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }

        this.setupCamera();
        this.setupInput();
        this.spawnEnemies();

        // Create particle system
        this.particles = new ParticleSystem(this.scene);

        // Screen shake
        this.screenShake = { intensity: 0, decay: 0.9 };

        // Ambient particle timer
        this.ambientTimer = 0;

        // Now show UI and canvas
        this.gameState = 'playing';
        this.canvas.style.opacity = '1';
        menu.classList.add('hidden');
        menu.innerHTML = `
            <h1>TileGame 3D</h1>
            <div class="class-selection">
                <h3>Choose Class</h3>
                <div class="class-buttons">
                    <button class="class-btn selected" data-class="warrior">Warrior</button>
                    <button class="class-btn" data-class="mage">Mage</button>
                </div>
            </div>
            <div class="menu-options">
                <button class="menu-btn" data-mode="horde">Skeleton Horde</button>
                <button class="menu-btn" data-mode="dungeon">Dungeon</button>
                <button class="menu-btn" data-mode="boss">Skeleton Boss</button>
            </div>
        `;
        document.getElementById('ui').style.display = 'block';
        document.getElementById('return-menu-btn').style.display = 'block';

        // Update ability bar labels based on class
        this.updateAbilityLabels();

        // Re-attach menu handlers since we replaced innerHTML
        this.setupMenu();
    }

    updateAbilityLabels() {
        const sunderSlot = document.getElementById('ability-t');
        if (this.selectedClass === 'mage') {
            document.querySelector('#ability-q .name').textContent = 'Blizzard';
            document.querySelector('#ability-f .name').textContent = 'Flame Wave';
            document.querySelector('#ability-e .name').textContent = 'Burn Aura';
            document.querySelector('#ability-r .name').textContent = 'Backstep';
            // Hide Sunder for mage
            if (sunderSlot) sunderSlot.style.display = 'none';
        } else {
            document.querySelector('#ability-q .name').textContent = 'Cleave';
            document.querySelector('#ability-f .name').textContent = 'Whirlwind';
            document.querySelector('#ability-e .name').textContent = 'Parry';
            document.querySelector('#ability-r .name').textContent = 'Heroic Leap';
            document.querySelector('#ability-t .name').textContent = 'Sunder';
            // Show Sunder for warrior
            if (sunderSlot) sunderSlot.style.display = '';
        }
    }

    returnToMenu() {
        this.gameState = 'menu';
        this.gameMode = null;

        // Show menu, hide UI
        document.getElementById('main-menu').classList.remove('hidden');
        document.getElementById('ui').style.display = 'none';
        document.getElementById('return-menu-btn').style.display = 'none';
        document.getElementById('target-frame').style.display = 'none';

        // Clear the scene
        this.clearScene();
    }

    clearScene() {
        // Clean up dungeon builder if exists
        if (this.dungeonBuilder) {
            this.dungeonBuilder.dispose();
            this.dungeonBuilder = null;
        }

        // Remove all objects from scene
        while (this.scene.children.length > 0) {
            const obj = this.scene.children[0];
            this.scene.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(m => m.dispose());
                } else {
                    obj.material.dispose();
                }
            }
        }

        this.enemies = [];
        this.projectiles = [];
        this.groundHazards = [];
    }

    async setupScene() {
        if (this.gameMode === 'horde') {
            // Wide hallway horde mode
            this.scene.background = new THREE.Color(0x1a1a2e); // Dark dungeon
            this.scene.fog = new THREE.FogExp2(0x1a1a2e, 0.008);

            // Hallway dimensions
            const hallwayLength = 120;
            const hallwayWidth = 30;

            // Create stone floor
            const floorGeometry = new THREE.PlaneGeometry(hallwayWidth, hallwayLength);
            const floorMaterial = new THREE.MeshLambertMaterial({
                color: 0x4a4a5a // Stone gray
            });
            const floor = new THREE.Mesh(floorGeometry, floorMaterial);
            floor.rotation.x = -Math.PI / 2;
            floor.position.y = 0;
            floor.position.z = hallwayLength / 2 - 10; // Offset so spawn is at z=0
            floor.receiveShadow = true;
            this.scene.add(floor);

            // Safe spawn area - different colored floor
            const spawnGeometry = new THREE.PlaneGeometry(hallwayWidth - 2, 15);
            const spawnMaterial = new THREE.MeshLambertMaterial({
                color: 0x3a5a3a // Green-tinted safe zone
            });
            const spawnArea = new THREE.Mesh(spawnGeometry, spawnMaterial);
            spawnArea.rotation.x = -Math.PI / 2;
            spawnArea.position.y = 0.01;
            spawnArea.position.z = -5;
            spawnArea.receiveShadow = true;
            this.scene.add(spawnArea);

            // Left wall
            const wallGeometry = new THREE.BoxGeometry(2, 6, hallwayLength);
            const wallMaterial = new THREE.MeshLambertMaterial({ color: 0x3a3a4a });
            const leftWall = new THREE.Mesh(wallGeometry, wallMaterial);
            leftWall.position.set(-hallwayWidth / 2 - 1, 3, hallwayLength / 2 - 10);
            leftWall.castShadow = true;
            leftWall.receiveShadow = true;
            this.scene.add(leftWall);

            // Right wall
            const rightWall = new THREE.Mesh(wallGeometry, wallMaterial);
            rightWall.position.set(hallwayWidth / 2 + 1, 3, hallwayLength / 2 - 10);
            rightWall.castShadow = true;
            rightWall.receiveShadow = true;
            this.scene.add(rightWall);

            // Back wall (behind spawn)
            const backWallGeometry = new THREE.BoxGeometry(hallwayWidth + 4, 6, 2);
            const backWall = new THREE.Mesh(backWallGeometry, wallMaterial);
            backWall.position.set(0, 3, -12);
            backWall.castShadow = true;
            backWall.receiveShadow = true;
            this.scene.add(backWall);

            // Add torches along walls
            for (let z = 0; z < hallwayLength - 20; z += 15) {
                // Left wall torches
                const torchLight1 = new THREE.PointLight(0xff6633, 0.8, 12);
                torchLight1.position.set(-hallwayWidth / 2 + 1, 4, z);
                this.scene.add(torchLight1);

                // Right wall torches
                const torchLight2 = new THREE.PointLight(0xff6633, 0.8, 12);
                torchLight2.position.set(hallwayWidth / 2 - 1, 4, z);
                this.scene.add(torchLight2);
            }

            this.isOutdoorMap = false; // Use dungeon lighting
        } else {
            // Dungeon environment for dungeon and boss modes
            this.scene.background = new THREE.Color(0x1a1a2e);
            this.scene.fog = new THREE.FogExp2(0x1a1a2e, 0.025);

            // Create dungeon builder and build dungeon
            this.dungeonBuilder = new DungeonBuilder(this.scene);
            await this.dungeonBuilder.preloadAssets();

            if (this.gameMode === 'boss') {
                // Boss arena - larger room
                await this.dungeonBuilder.buildRoom(0, 0, 12, 12);
                await this.dungeonBuilder.addTorches(0, 0, 12, 12, 4);
            } else {
                // Standard dungeon room
                await this.dungeonBuilder.buildTestDungeon();
            }

            this.isOutdoorMap = false;
        }
    }

    setupLighting() {
        if (this.isOutdoorMap) {
            // Bright outdoor lighting
            const ambient = new THREE.AmbientLight(0xffffff, 0.5);
            this.scene.add(ambient);

            // Sun light
            const sunLight = new THREE.DirectionalLight(0xffffee, 1.2);
            sunLight.position.set(20, 40, 20);
            sunLight.castShadow = true;
            sunLight.shadow.mapSize.width = 2048;
            sunLight.shadow.mapSize.height = 2048;
            sunLight.shadow.camera.near = 0.5;
            sunLight.shadow.camera.far = 100;
            sunLight.shadow.camera.left = -40;
            sunLight.shadow.camera.right = 40;
            sunLight.shadow.camera.top = 40;
            sunLight.shadow.camera.bottom = -40;
            sunLight.shadow.bias = -0.0001;
            sunLight.shadow.normalBias = 0.02;
            this.scene.add(sunLight);

            // Sky hemisphere light
            const hemi = new THREE.HemisphereLight(0x87ceeb, 0x3d5c3d, 0.6);
            this.scene.add(hemi);
        } else {
            // Dungeon ambient light - dim and moody
            const ambient = new THREE.AmbientLight(0x332244, 0.4);
            this.scene.add(ambient);

            // Main light from above - dim moonlight through cracks
            const mainLight = new THREE.DirectionalLight(0x6688aa, 0.6);
            mainLight.position.set(10, 30, 10);
            mainLight.castShadow = true;
            mainLight.shadow.mapSize.width = 2048;
            mainLight.shadow.mapSize.height = 2048;
            mainLight.shadow.camera.near = 0.5;
            mainLight.shadow.camera.far = 100;
            mainLight.shadow.camera.left = -30;
            mainLight.shadow.camera.right = 30;
            mainLight.shadow.camera.top = 30;
            mainLight.shadow.camera.bottom = -30;
            mainLight.shadow.bias = -0.0001;
            mainLight.shadow.normalBias = 0.02;
            this.scene.add(mainLight);

            // Warm fill from torches
            const torchFill = new THREE.DirectionalLight(0xff6622, 0.3);
            torchFill.position.set(-10, 10, -10);
            this.scene.add(torchFill);

            // Hemisphere light for dungeon feel
            const hemi = new THREE.HemisphereLight(0x444466, 0x222211, 0.3);
            this.scene.add(hemi);

            // Central torch light for player area
            const playerLight = new THREE.PointLight(0xff8844, 0.8, 15);
            playerLight.position.set(0, 3, 0);
            this.scene.add(playerLight);
            this.playerLight = playerLight;
        }
    }

    setupPlayer() {
        // Create player based on selected class
        if (this.selectedClass === 'mage') {
            this.player = new Mage(this.scene, this);
        } else {
            this.player = new Player(this.scene, this);
        }
        this.player.position.set(0, 0, 0);
    }

    setupCamera() {
        this.camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.cameraController = new ThirdPersonCamera(this.camera, this.player);
    }

    setupInput() {
        this.input = new InputManager(this.canvas, this);
    }

    spawnEnemies() {
        if (this.gameMode === 'boss') {
            // Skeleton Boss fight - elite warrior with minion guards
            const boss = createSkeletonEnemy(this.scene, 0, 10, 'warrior');
            boss.name = 'Skeleton Champion';
            boss.maxHealth = 500;
            boss.health = boss.maxHealth;
            boss.attackDamage = 25;
            this.enemies.push(boss);

            // Guard minions
            const guardPositions = [
                { x: -5, z: 8, type: 'minion' },
                { x: 5, z: 8, type: 'minion' },
                { x: -3, z: 12, type: 'rogue' },
                { x: 3, z: 12, type: 'rogue' }
            ];
            for (const pos of guardPositions) {
                const guard = createSkeletonEnemy(this.scene, pos.x, pos.z, pos.type);
                this.enemies.push(guard);
            }
        } else if (this.gameMode === 'horde') {
            // Skeleton horde - many enemies spread through hallway
            // Safe zone is z < 5, so spawn enemies starting at z = 10
            const hallwayWidth = 30;
            const positions = [];

            // First wave - near safe zone
            positions.push(
                { x: -8, z: 15, type: 'warrior' },
                { x: 8, z: 15, type: 'warrior' },
                { x: 0, z: 18, type: 'mage' },
                { x: -4, z: 12, type: 'minion' },
                { x: 4, z: 12, type: 'minion' }
            );

            // Second wave
            positions.push(
                { x: -10, z: 30, type: 'warrior' },
                { x: 10, z: 30, type: 'warrior' },
                { x: 0, z: 35, type: 'mage' },
                { x: -6, z: 28, type: 'rogue' },
                { x: 6, z: 28, type: 'rogue' },
                { x: -3, z: 32, type: 'minion' },
                { x: 3, z: 32, type: 'minion' }
            );

            // Third wave
            positions.push(
                { x: -12, z: 50, type: 'warrior' },
                { x: 12, z: 50, type: 'warrior' },
                { x: 0, z: 55, type: 'mage' },
                { x: -8, z: 48, type: 'rogue' },
                { x: 8, z: 48, type: 'rogue' },
                { x: -5, z: 52, type: 'minion' },
                { x: 5, z: 52, type: 'minion' },
                { x: 0, z: 45, type: 'minion' }
            );

            // Fourth wave - further down
            positions.push(
                { x: -10, z: 70, type: 'warrior' },
                { x: 10, z: 70, type: 'warrior' },
                { x: -5, z: 75, type: 'mage' },
                { x: 5, z: 75, type: 'mage' },
                { x: -8, z: 68, type: 'rogue' },
                { x: 8, z: 68, type: 'rogue' },
                { x: 0, z: 72, type: 'minion' },
                { x: -3, z: 78, type: 'minion' },
                { x: 3, z: 78, type: 'minion' }
            );

            // Fifth wave - end of hallway
            positions.push(
                { x: -12, z: 90, type: 'warrior' },
                { x: 12, z: 90, type: 'warrior' },
                { x: 0, z: 95, type: 'mage' },
                { x: -6, z: 88, type: 'rogue' },
                { x: 6, z: 88, type: 'rogue' },
                { x: -9, z: 92, type: 'minion' },
                { x: 9, z: 92, type: 'minion' },
                { x: 0, z: 85, type: 'minion' }
            );

            for (const pos of positions) {
                const skeleton = createSkeletonEnemy(this.scene, pos.x, pos.z, pos.type);
                this.enemies.push(skeleton);
            }
        } else {
            // Dungeon mode - balanced skeleton group
            const positions = [
                { x: 5, z: 5, type: 'warrior' },
                { x: -5, z: 5, type: 'warrior' },
                { x: 0, z: 8, type: 'mage' },
                { x: 3, z: -3, type: 'minion' },
                { x: -3, z: -3, type: 'minion' },
                { x: 6, z: -2, type: 'rogue' }
            ];

            for (const pos of positions) {
                const skeleton = createSkeletonEnemy(this.scene, pos.x, pos.z, pos.type);
                this.enemies.push(skeleton);
            }
        }
    }

    targetClosestEnemy() {
        if (this.enemies.length === 0) return;

        const playerPos = this.player.position;
        let closest = null;
        let closestDist = Infinity;

        for (const enemy of this.enemies) {
            if (!enemy.isAlive) continue;
            if (this.player.targetEnemy === enemy) continue; // Skip current target

            const dist = playerPos.distanceTo(enemy.position);
            if (dist < closestDist) {
                closestDist = dist;
                closest = enemy;
            }
        }

        if (closest) {
            this.player.setTarget(closest);
        } else if (this.enemies.some(e => e.isAlive)) {
            // If we skipped current target and it's the only one, re-target it
            const aliveEnemy = this.enemies.find(e => e.isAlive);
            if (aliveEnemy) this.player.setTarget(aliveEnemy);
        }
    }

    clearTarget() {
        this.player.setTarget(null);
    }

    addProjectile(position, direction, damage, range, type, owner) {
        // Create visual mesh based on type
        let mesh;
        if (type === 'slash') {
            // Slash projectile - elongated glowing blade
            const geometry = new THREE.BoxGeometry(0.15, 0.6, 1.5);
            const material = new THREE.MeshBasicMaterial({
                color: 0xffaa44,
                transparent: true,
                opacity: 0.9
            });
            mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(position);
            mesh.rotation.y = Math.atan2(direction.x, direction.z);

            // Add glow trail
            const trailGeometry = new THREE.BoxGeometry(0.1, 0.4, 1.2);
            const trailMaterial = new THREE.MeshBasicMaterial({
                color: 0xffdd88,
                transparent: true,
                opacity: 0.6
            });
            const trail = new THREE.Mesh(trailGeometry, trailMaterial);
            trail.position.z = -0.3;
            mesh.add(trail);
        } else {
            // Default sphere projectile
            const geometry = new THREE.SphereGeometry(0.2, 8, 8);
            const material = new THREE.MeshBasicMaterial({ color: 0xff6600 });
            mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(position);
        }

        const projectile = {
            mesh: mesh,
            position: position.clone(),
            direction: direction.normalize(),
            speed: 18,
            damage: damage,
            range: range,
            traveled: 0,
            alive: true,
            owner: owner,
            update: function(dt) {
                const move = this.direction.clone().multiplyScalar(this.speed * dt);
                this.position.add(move);
                this.mesh.position.copy(this.position);
                this.traveled += this.speed * dt;
                if (this.traveled >= this.range) {
                    this.alive = false;
                }
            },
            checkHit: function(enemy) {
                const dist = this.position.distanceTo(enemy.position);
                return dist < 1.2;
            }
        };

        this.projectiles.push(projectile);
        this.scene.add(mesh);
    }

    addDamageNumber(position, damage, isHeal = false) {
        this.damageNumbers.push({
            position: position.clone(),
            damage,
            isHeal,
            life: 1.0,
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                5,
                (Math.random() - 0.5) * 2
            )
        });
    }

    update(deltaTime) {
        // Skip updates if not playing
        if (this.gameState !== 'playing') return;

        // Update player
        this.player.update(deltaTime, this.input, this.cameraController);

        // Update camera
        this.cameraController.update(deltaTime, this.input);

        // Update player light position to follow player
        if (this.playerLight) {
            this.playerLight.position.x = this.player.position.x;
            this.playerLight.position.z = this.player.position.z;
        }

        // Update enemies
        for (const enemy of this.enemies) {
            if (enemy.isAlive) {
                enemy.update(deltaTime, this.player, this.camera);
            }

            // Check for hit particles - skeleton bone particles
            if (enemy.lastHitPosition && this.particles) {
                const isBoss = enemy.name === 'Skeleton Champion';

                if (isBoss) {
                    // Boss hit - more intense
                    this.particles.deathExplosion(enemy.lastHitPosition, 0xddddaa, 0.3);
                    this.addScreenShake(Math.min(enemy.lastHitAmount / 20, 0.8));
                } else {
                    // Regular skeleton hit - bone dust
                    this.particles.deathExplosion(enemy.lastHitPosition, 0xccccaa, 0.15);
                    this.addScreenShake(Math.min(enemy.lastHitAmount / 40, 0.3));
                }

                enemy.lastHitPosition = null;
                enemy.lastHitAmount = null;
            }

            // Check for death particles - skeleton collapse
            if (enemy.justDied && this.particles) {
                const isBoss = enemy.name === 'Skeleton Champion';

                if (isBoss) {
                    this.particles.deathExplosion(enemy.deathPosition, 0xffddaa, 2.5);
                    this.addScreenShake(1.5);
                } else {
                    // Skeleton crumbles to dust
                    this.particles.deathExplosion(enemy.deathPosition, 0xddddcc, 1);
                    this.addScreenShake(0.4);
                }

                enemy.justDied = false;
            }
        }

        // Update projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            proj.update(deltaTime);

            // Check collision with enemies
            for (const enemy of this.enemies) {
                if (enemy.isAlive && proj.checkHit(enemy)) {
                    enemy.takeDamage(proj.damage, this.player);
                    this.effects.createDamageNumber(enemy.position, proj.damage);
                    proj.alive = false;
                }
            }

            if (!proj.alive) {
                this.scene.remove(proj.mesh);
                this.projectiles.splice(i, 1);
            }
        }

        // Update damage numbers
        for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
            const dn = this.damageNumbers[i];
            dn.life -= deltaTime * 1.5;
            dn.velocity.y -= deltaTime * 10; // Gravity
            dn.position.add(dn.velocity.clone().multiplyScalar(deltaTime));

            if (dn.life <= 0) {
                this.damageNumbers.splice(i, 1);
            }
        }

        // Check player collision with enemies
        this.checkPlayerEnemyCollision();

        // Update effects
        this.effects.update(deltaTime);

        // Update particles
        if (this.particles) {
            this.particles.update(deltaTime);

            // Ambient particles
            this.ambientTimer += deltaTime;
            if (this.ambientTimer > 0.1) {
                this.ambientTimer = 0;
                this.particles.ambientParticles(this.player.position, 30);
            }

            // Fire pool effects
            for (const hazard of this.groundHazards) {
                if (hazard.type === 'fire' && Math.random() < 0.3) {
                    this.particles.firePoolEffect(hazard.position);
                } else if (hazard.type === 'poison' && Math.random() < 0.2) {
                    this.particles.poisonPoolEffect(hazard.position);
                }
            }
        }

        // Update screen shake
        if (this.screenShake && this.screenShake.intensity > 0) {
            this.screenShake.intensity *= this.screenShake.decay;
            if (this.screenShake.intensity < 0.01) {
                this.screenShake.intensity = 0;
            }
        }

        // Update ground hazards
        this.updateGroundHazards(deltaTime);

        // Update UI
        this.updateUI();
    }

    updateGroundHazards(deltaTime) {
        for (let i = this.groundHazards.length - 1; i >= 0; i--) {
            const hazard = this.groundHazards[i];

            // Update duration
            hazard.duration -= deltaTime;

            // Fade out as duration decreases
            if (hazard.mesh && hazard.mesh.material) {
                const baseOpacity = hazard.type === 'fire' ? 0.6 : 0.5;
                hazard.mesh.material.opacity = Math.min(baseOpacity, hazard.duration * 0.3);
            }

            // Check for player damage (tick every 0.5s)
            hazard.tickTimer += deltaTime;
            if (hazard.tickTimer >= 0.5) {
                hazard.tickTimer = 0;

                const dist = this.player.position.distanceTo(hazard.position);
                if (dist < hazard.radius) {
                    this.player.takeDamage(hazard.damage);
                    this.effects.createDamageNumber(this.player.position, hazard.damage, false);
                }
            }

            // Remove expired hazards
            if (hazard.duration <= 0) {
                if (hazard.mesh) {
                    this.scene.remove(hazard.mesh);
                    if (hazard.mesh.geometry) hazard.mesh.geometry.dispose();
                    if (hazard.mesh.material) hazard.mesh.material.dispose();
                }
                this.groundHazards.splice(i, 1);
            }
        }
    }

    checkPlayerEnemyCollision() {
        for (const enemy of this.enemies) {
            if (!enemy.isAlive) continue;

            const dist = this.player.position.distanceTo(enemy.position);
            if (dist < enemy.attackRange || dist < 1.5) {
                enemy.tryAttack(this.player);
            }
        }
    }

    updateUI() {
        // Health bar
        const healthPercent = (this.player.health / this.player.maxHealth) * 100;
        document.getElementById('health-fill').style.width = `${healthPercent}%`;
        document.getElementById('health-text').textContent =
            `${Math.ceil(this.player.health)} / ${this.player.maxHealth}`;

        // Target frame
        const targetFrame = document.getElementById('target-frame');
        if (this.player.targetEnemy && this.player.targetEnemy.isAlive) {
            targetFrame.style.display = 'block';
            document.getElementById('target-name').textContent =
                this.player.targetEnemy.name || 'Skeleton';
            const targetHealthPercent =
                (this.player.targetEnemy.health / this.player.targetEnemy.maxHealth) * 100;
            document.getElementById('target-health-fill').style.width = `${targetHealthPercent}%`;
        } else {
            targetFrame.style.display = 'none';
        }

        // Ability cooldowns - different for each class
        if (this.selectedClass === 'mage') {
            this.updateAbilityCooldown('q', this.player.abilities.blizzard);
            this.updateAbilityCooldown('f', this.player.abilities.flameWave);
            this.updateAbilityCooldown('e', this.player.abilities.burnAura);
            this.updateAbilityCooldown('r', this.player.abilities.backstep);
            this.updateAbilityCooldown('1', this.player.abilities.potion);
        } else {
            this.updateAbilityCooldown('q', this.player.abilities.cleave);
            this.updateAbilityCooldown('f', this.player.abilities.whirlwind);
            this.updateAbilityCooldown('e', this.player.abilities.parry);
            this.updateAbilityCooldown('r', this.player.abilities.heroicLeap);
            this.updateAbilityCooldown('t', this.player.abilities.sunder);
            this.updateAbilityCooldown('1', this.player.abilities.potion);
        }
    }

    updateAbilityCooldown(key, ability) {
        const element = document.getElementById(`ability-${key}`);
        if (!element || !ability) return;

        const overlay = element.querySelector('.cooldown-overlay');
        if (ability.cooldownRemaining > 0) {
            element.classList.add('on-cooldown');
            const percent = (ability.cooldownRemaining / ability.cooldown) * 100;
            overlay.style.height = `${percent}%`;
        } else {
            element.classList.remove('on-cooldown');
            overlay.style.height = '0%';
        }

        if (ability.isActive) {
            element.classList.add('active');
        } else {
            element.classList.remove('active');
        }

        if (ability.isCharging) {
            element.classList.add('charging');
        } else {
            element.classList.remove('charging');
        }
    }

    render() {
        // Skip render if in menu or no camera
        if (this.gameState === 'menu' || !this.camera) return;

        // Apply screen shake (temporary offset, then restore)
        let shakeX = 0, shakeY = 0;
        if (this.screenShake && this.screenShake.intensity > 0.01) {
            shakeX = (Math.random() - 0.5) * this.screenShake.intensity;
            shakeY = (Math.random() - 0.5) * this.screenShake.intensity;
            this.camera.position.x += shakeX;
            this.camera.position.y += shakeY;
        }

        this.renderer.render(this.scene, this.camera);

        // Restore camera position
        if (shakeX !== 0 || shakeY !== 0) {
            this.camera.position.x -= shakeX;
            this.camera.position.y -= shakeY;
        }
    }

    addScreenShake(intensity) {
        if (this.screenShake) {
            // Reduce intensity significantly
            this.screenShake.intensity = Math.max(this.screenShake.intensity, intensity * 0.15);
        }
    }

    onResize() {
        if (this.camera) {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
        }
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    start() {
        const gameLoop = () => {
            const deltaTime = Math.min(this.clock.getDelta(), 0.1);
            this.update(deltaTime);
            this.render();
            requestAnimationFrame(gameLoop);
        };
        gameLoop();
    }
}
