import * as THREE from 'three';
import { Player } from './player.js';
import { Mage } from './mage.js';
import { Hunter } from './hunter.js';
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

        // Hide menu, show loading screen with spinner
        const menu = document.getElementById('main-menu');
        menu.innerHTML = `
            <div class="loading-container">
                <h1>Loading</h1>
                <div class="loading-spinner"></div>
                <div class="loading-text">Preparing dungeon...</div>
            </div>
        `;
        this.canvas.style.opacity = '0';

        // Allow the loading screen to render before heavy work
        await new Promise(resolve => setTimeout(resolve, 50));

        const loadingText = menu.querySelector('.loading-text');
        const updateLoadingText = (text) => {
            if (loadingText) loadingText.textContent = text;
        };

        // Clear previous game state
        updateLoadingText('Clearing scene...');
        this.clearScene();
        await new Promise(resolve => setTimeout(resolve, 10));

        // Setup fresh game
        updateLoadingText('Building environment...');
        await this.setupScene();
        await new Promise(resolve => setTimeout(resolve, 10));

        updateLoadingText('Setting up lighting...');
        this.setupLighting();
        await new Promise(resolve => setTimeout(resolve, 10));

        updateLoadingText('Loading player...');
        this.setupPlayer();

        // Wait for character to load before continuing
        if (this.player && this.player.character) {
            while (this.player.characterLoading) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }
        await new Promise(resolve => setTimeout(resolve, 10));

        this.setupCamera();
        this.setupInput();

        updateLoadingText('Spawning enemies...');
        this.spawnEnemies();
        await new Promise(resolve => setTimeout(resolve, 10));

        // Wait for all enemy models to load
        updateLoadingText('Loading enemy models...');
        await this.waitForEnemyModels();

        updateLoadingText('Finishing up...');
        await new Promise(resolve => setTimeout(resolve, 50));

        // Create particle system
        this.particles = new ParticleSystem(this.scene);

        // Screen shake
        this.screenShake = { intensity: 0, decay: 0.9 };

        // Ambient particle timer
        this.ambientTimer = 0;

        // Setup minimap
        this.setupMinimap();

        // Now show UI and canvas
        this.gameState = 'playing';
        this.canvas.style.opacity = '1';
        menu.classList.add('hidden');
        document.getElementById('minimap').style.display = 'block';
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
        const cSlot = document.getElementById('ability-c');
        if (this.selectedClass === 'mage') {
            document.querySelector('#ability-q .name').textContent = 'Blizzard';
            document.querySelector('#ability-f .name').textContent = 'Flame Wave';
            document.querySelector('#ability-e .name').textContent = 'Frost Nova';
            document.querySelector('#ability-r .name').textContent = 'Blink';
            document.querySelector('#ability-c .name').textContent = 'Frozen Orb';
            if (cSlot) cSlot.style.display = '';
        } else if (this.selectedClass === 'hunter') {
            document.querySelector('#ability-q .name').textContent = 'Arrow Wave';
            document.querySelector('#ability-f .name').textContent = 'Spin Dash';
            document.querySelector('#ability-e .name').textContent = 'Shotgun';
            document.querySelector('#ability-r .name').textContent = 'Trap';
            document.querySelector('#ability-c .name').textContent = 'Giant Arrow';
            if (cSlot) cSlot.style.display = '';
        } else {
            document.querySelector('#ability-q .name').textContent = 'Cleave';
            document.querySelector('#ability-f .name').textContent = 'Whirlwind';
            document.querySelector('#ability-e .name').textContent = 'Parry';
            document.querySelector('#ability-r .name').textContent = 'Heroic Leap';
            document.querySelector('#ability-c .name').textContent = 'Sunder';
            if (cSlot) cSlot.style.display = '';
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
        document.getElementById('minimap').style.display = 'none';

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
            // Winding dungeon hallway horde mode
            this.scene.background = new THREE.Color(0x1a1a2e);
            this.scene.fog = new THREE.FogExp2(0x1a1a2e, 0.006);

            const wallMaterial = new THREE.MeshLambertMaterial({ color: 0x3a3a4a });
            const floorMaterial = new THREE.MeshLambertMaterial({ color: 0x4a4a5a });
            const accentMaterial = new THREE.MeshLambertMaterial({ color: 0x2a2a3a });

            // Define hallway segments: { x, z, width, length, rotation }
            // Rotation 0 = along Z axis, PI/2 = along X axis
            const segments = [
                // Starting area (safe zone)
                { x: 0, z: -5, width: 25, length: 20, rot: 0 },
                // First straight section
                { x: 0, z: 25, width: 20, length: 50, rot: 0 },
                // Turn right - connecting piece
                { x: 20, z: 55, width: 30, length: 30, rot: 0 },
                // Right corridor
                { x: 50, z: 55, width: 50, length: 20, rot: Math.PI / 2 },
                // Turn left - large room
                { x: 80, z: 30, width: 35, length: 35, rot: 0 },
                // Continue forward
                { x: 80, z: 80, width: 20, length: 40, rot: 0 },
                // Final chamber
                { x: 80, z: 120, width: 40, length: 40, rot: 0 }
            ];

            // Build floor segments
            for (const seg of segments) {
                const floorGeo = new THREE.PlaneGeometry(seg.width, seg.length);
                const floor = new THREE.Mesh(floorGeo, floorMaterial);
                floor.rotation.x = -Math.PI / 2;
                floor.rotation.z = seg.rot;
                floor.position.set(seg.x, 0, seg.z);
                floor.receiveShadow = true;
                this.scene.add(floor);
            }

            // Safe spawn area overlay
            const spawnGeo = new THREE.PlaneGeometry(20, 15);
            const spawnMat = new THREE.MeshLambertMaterial({ color: 0x3a5a3a });
            const spawnArea = new THREE.Mesh(spawnGeo, spawnMat);
            spawnArea.rotation.x = -Math.PI / 2;
            spawnArea.position.set(0, 0.01, -5);
            this.scene.add(spawnArea);

            // Build walls around the dungeon perimeter
            this.buildDungeonWalls(wallMaterial);

            // Add pillars in large rooms
            this.addPillars(accentMaterial);

            // Add torches with lights
            this.addTorchLights();

            // Add environmental props
            this.addEnvironmentProps();

            this.isOutdoorMap = false;
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
        } else if (this.selectedClass === 'hunter') {
            this.player = new Hunter(this.scene, this);
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
            // Skeleton horde - spread through winding dungeon
            const positions = [];

            // First corridor (x=0, z=10-45)
            positions.push(
                { x: -5, z: 15, type: 'minion' },
                { x: 5, z: 15, type: 'minion' },
                { x: 0, z: 22, type: 'warrior' },
                { x: -6, z: 30, type: 'rogue' },
                { x: 6, z: 30, type: 'rogue' },
                { x: 0, z: 38, type: 'mage' },
                { x: -4, z: 42, type: 'minion' },
                { x: 4, z: 42, type: 'minion' }
            );

            // Turn section (around x=20, z=55)
            positions.push(
                { x: 15, z: 55, type: 'warrior' },
                { x: 25, z: 55, type: 'warrior' },
                { x: 20, z: 60, type: 'mage' },
                { x: 10, z: 58, type: 'minion' },
                { x: 30, z: 52, type: 'rogue' }
            );

            // Right corridor (x=35-70, z=45-65)
            positions.push(
                { x: 40, z: 50, type: 'minion' },
                { x: 50, z: 55, type: 'warrior' },
                { x: 45, z: 60, type: 'rogue' },
                { x: 55, z: 48, type: 'minion' },
                { x: 60, z: 55, type: 'mage' },
                { x: 65, z: 50, type: 'rogue' }
            );

            // Large room (x=65-95, z=18-42)
            positions.push(
                { x: 70, z: 25, type: 'warrior' },
                { x: 90, z: 25, type: 'warrior' },
                { x: 80, z: 20, type: 'mage' },
                { x: 75, z: 35, type: 'rogue' },
                { x: 85, z: 35, type: 'rogue' },
                { x: 80, z: 30, type: 'minion' },
                { x: 72, z: 18, type: 'minion' },
                { x: 88, z: 18, type: 'minion' }
            );

            // Corridor to final chamber (x=75-85, z=55-95)
            positions.push(
                { x: 78, z: 60, type: 'minion' },
                { x: 82, z: 65, type: 'minion' },
                { x: 80, z: 72, type: 'warrior' },
                { x: 76, z: 80, type: 'rogue' },
                { x: 84, z: 80, type: 'rogue' },
                { x: 80, z: 88, type: 'mage' },
                { x: 78, z: 95, type: 'minion' },
                { x: 82, z: 95, type: 'minion' }
            );

            // Final chamber (x=65-95, z=105-135) - boss room
            positions.push(
                { x: 70, z: 110, type: 'warrior' },
                { x: 90, z: 110, type: 'warrior' },
                { x: 75, z: 118, type: 'rogue' },
                { x: 85, z: 118, type: 'rogue' },
                { x: 70, z: 125, type: 'mage' },
                { x: 90, z: 125, type: 'mage' },
                { x: 80, z: 130, type: 'warrior' }, // Mini-boss position
                { x: 75, z: 132, type: 'minion' },
                { x: 85, z: 132, type: 'minion' }
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

        // Update minimap
        this.updateMinimap();

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
            this.updateAbilityCooldown('e', this.player.abilities.frostNova);
            this.updateAbilityCooldown('r', this.player.abilities.backstep);
            this.updateAbilityCooldown('c', this.player.abilities.frozenOrb);
            this.updateAbilityCooldown('1', this.player.abilities.potion);
        } else if (this.selectedClass === 'hunter') {
            this.updateAbilityCooldown('q', this.player.abilities.arrowWave);
            this.updateAbilityCooldown('f', this.player.abilities.spinDash);
            this.updateAbilityCooldown('e', this.player.abilities.shotgun);
            this.updateAbilityCooldown('r', this.player.abilities.trap);
            this.updateAbilityCooldown('c', this.player.abilities.giantArrow);
            this.updateAbilityCooldown('1', this.player.abilities.potion);
        } else {
            this.updateAbilityCooldown('q', this.player.abilities.cleave);
            this.updateAbilityCooldown('f', this.player.abilities.whirlwind);
            this.updateAbilityCooldown('e', this.player.abilities.parry);
            this.updateAbilityCooldown('r', this.player.abilities.heroicLeap);
            this.updateAbilityCooldown('c', this.player.abilities.sunder);
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

    // Wait for all enemy models to finish loading
    async waitForEnemyModels() {
        const maxWaitTime = 10000; // 10 second timeout
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitTime) {
            // Check if all enemies have loaded their models
            let allLoaded = true;
            let loadedCount = 0;

            for (const enemy of this.enemies) {
                if (enemy.modelLoaded) {
                    loadedCount++;
                } else {
                    allLoaded = false;
                }
            }

            if (allLoaded || this.enemies.length === 0) {
                console.log(`All ${this.enemies.length} enemy models loaded`);
                return;
            }

            // Update loading text with progress
            const menu = document.getElementById('main-menu');
            const loadingText = menu?.querySelector('.loading-text');
            if (loadingText) {
                loadingText.textContent = `Loading enemies... (${loadedCount}/${this.enemies.length})`;
            }

            // Wait a bit before checking again
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.warn('Enemy model loading timed out, continuing anyway');
    }

    // Setup minimap canvas
    setupMinimap() {
        this.minimapCanvas = document.getElementById('minimap-canvas');
        this.minimapCtx = this.minimapCanvas.getContext('2d');

        // Minimap settings based on game mode
        if (this.gameMode === 'horde') {
            // Winding dungeon bounds
            this.minimapBounds = { minX: -20, maxX: 110, minZ: -20, maxZ: 150 };
        } else {
            // Standard dungeon/boss bounds
            this.minimapBounds = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };
        }
    }

    // Update minimap each frame
    updateMinimap() {
        if (!this.minimapCtx || !this.minimapCanvas) return;

        const ctx = this.minimapCtx;
        const canvas = this.minimapCanvas;
        const bounds = this.minimapBounds;

        // Clear
        ctx.fillStyle = 'rgba(20, 20, 35, 0.9)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Calculate scale
        const worldWidth = bounds.maxX - bounds.minX;
        const worldHeight = bounds.maxZ - bounds.minZ;
        const scale = Math.min(canvas.width / worldWidth, canvas.height / worldHeight) * 0.9;
        const offsetX = canvas.width / 2;
        const offsetY = canvas.height / 2;
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerZ = (bounds.minZ + bounds.maxZ) / 2;

        // Helper to convert world coords to minimap coords
        const toMinimap = (x, z) => ({
            x: offsetX + (x - centerX) * scale,
            y: offsetY + (z - centerZ) * scale
        });

        // Draw floor areas (simplified rectangles)
        ctx.fillStyle = 'rgba(60, 60, 80, 0.5)';
        if (this.gameMode === 'horde') {
            // Draw approximate floor areas
            const floors = [
                { x: 0, z: -5, w: 25, h: 20 },
                { x: 0, z: 25, w: 20, h: 50 },
                { x: 20, z: 55, w: 30, h: 30 },
                { x: 50, z: 55, w: 50, h: 20 },
                { x: 80, z: 30, w: 35, h: 35 },
                { x: 80, z: 80, w: 20, h: 40 },
                { x: 80, z: 120, w: 40, h: 40 }
            ];
            for (const f of floors) {
                const p = toMinimap(f.x - f.w/2, f.z - f.h/2);
                ctx.fillRect(p.x, p.y, f.w * scale, f.h * scale);
            }
        } else {
            // Simple square for other modes
            const p = toMinimap(-15, -15);
            ctx.fillRect(p.x, p.y, 30 * scale, 30 * scale);
        }

        // Draw enemies (red dots)
        ctx.fillStyle = '#ff4444';
        for (const enemy of this.enemies) {
            if (!enemy.isAlive) continue;
            const pos = toMinimap(enemy.position.x, enemy.position.z);
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw player (white dot with direction indicator)
        const playerPos = toMinimap(this.player.position.x, this.player.position.z);

        // Player direction line
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(playerPos.x, playerPos.y);
        const dirX = Math.sin(this.player.rotation) * 8;
        const dirZ = Math.cos(this.player.rotation) * 8;
        ctx.lineTo(playerPos.x + dirX, playerPos.y + dirZ);
        ctx.stroke();

        // Player dot
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(playerPos.x, playerPos.y, 5, 0, Math.PI * 2);
        ctx.fill();

        // Player outline
        ctx.strokeStyle = '#88aaff';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // Build walls for the winding dungeon
    buildDungeonWalls(wallMaterial) {
        const wallHeight = 6;
        const wallThickness = 2;

        // Wall segments: { x1, z1, x2, z2 } - start and end points
        const wallSegments = [
            // Starting area walls
            { x1: -12, z1: -15, x2: -12, z2: 5 },      // Left back
            { x1: 12, z1: -15, x2: 12, z2: 5 },        // Right back
            { x1: -12, z1: -15, x2: 12, z2: -15 },     // Back wall

            // First corridor left wall
            { x1: -10, z1: 5, x2: -10, z2: 50 },
            // First corridor right wall
            { x1: 10, z1: 5, x2: 10, z2: 40 },

            // Turn section
            { x1: -10, z1: 50, x2: 5, z2: 70 },        // Left wall continues
            { x1: 10, z1: 40, x2: 35, z2: 40 },        // Inner corner

            // Right corridor walls
            { x1: 5, z1: 70, x2: 75, z2: 70 },         // Top wall
            { x1: 35, z1: 40, x2: 75, z2: 40 },        // Bottom wall continues

            // Large room walls
            { x1: 60, z1: 12, x2: 60, z2: 40 },        // Left wall
            { x1: 100, z1: 12, x2: 100, z2: 48 },      // Right wall
            { x1: 60, z1: 12, x2: 100, z2: 12 },       // Bottom wall

            // Corridor to final chamber
            { x1: 70, z1: 48, x2: 70, z2: 100 },       // Left wall
            { x1: 90, z1: 70, x2: 90, z2: 100 },       // Right wall

            // Final chamber
            { x1: 60, z1: 100, x2: 60, z2: 140 },      // Left wall
            { x1: 100, z1: 100, x2: 100, z2: 140 },    // Right wall
            { x1: 60, z1: 140, x2: 100, z2: 140 },     // End wall
        ];

        for (const seg of wallSegments) {
            const dx = seg.x2 - seg.x1;
            const dz = seg.z2 - seg.z1;
            const length = Math.sqrt(dx * dx + dz * dz);
            const angle = Math.atan2(dx, dz);

            const wallGeo = new THREE.BoxGeometry(wallThickness, wallHeight, length + wallThickness);
            const wall = new THREE.Mesh(wallGeo, wallMaterial);
            wall.position.set(
                (seg.x1 + seg.x2) / 2,
                wallHeight / 2,
                (seg.z1 + seg.z2) / 2
            );
            wall.rotation.y = angle;
            wall.castShadow = true;
            wall.receiveShadow = true;
            this.scene.add(wall);
        }
    }

    // Add decorative pillars
    addPillars(material) {
        const pillarPositions = [
            // Large room pillars
            { x: 68, z: 22 }, { x: 92, z: 22 },
            { x: 68, z: 38 }, { x: 92, z: 38 },
            // Final chamber pillars
            { x: 68, z: 108 }, { x: 92, z: 108 },
            { x: 68, z: 132 }, { x: 92, z: 132 },
            // Corridor accent pillars
            { x: -8, z: 20 }, { x: 8, z: 20 },
            { x: -8, z: 35 }, { x: 8, z: 35 },
        ];

        for (const pos of pillarPositions) {
            // Pillar base
            const baseGeo = new THREE.CylinderGeometry(1.2, 1.4, 0.5, 8);
            const base = new THREE.Mesh(baseGeo, material);
            base.position.set(pos.x, 0.25, pos.z);
            base.castShadow = true;
            this.scene.add(base);

            // Pillar shaft
            const shaftGeo = new THREE.CylinderGeometry(0.8, 1.0, 5, 8);
            const shaft = new THREE.Mesh(shaftGeo, material);
            shaft.position.set(pos.x, 3, pos.z);
            shaft.castShadow = true;
            this.scene.add(shaft);

            // Pillar capital
            const capGeo = new THREE.CylinderGeometry(1.3, 0.8, 0.6, 8);
            const cap = new THREE.Mesh(capGeo, material);
            cap.position.set(pos.x, 5.8, pos.z);
            cap.castShadow = true;
            this.scene.add(cap);
        }
    }

    // Add torch lights throughout the dungeon
    addTorchLights() {
        const torchPositions = [
            // Starting area
            { x: -10, z: -10 }, { x: 10, z: -10 },
            // First corridor
            { x: -8, z: 10 }, { x: 8, z: 10 },
            { x: -8, z: 30 }, { x: 8, z: 30 },
            { x: -8, z: 45 },
            // Turn area
            { x: 20, z: 55 }, { x: 40, z: 55 },
            // Right corridor
            { x: 55, z: 42 }, { x: 55, z: 68 },
            // Large room
            { x: 62, z: 15 }, { x: 98, z: 15 },
            { x: 62, z: 35 }, { x: 98, z: 35 },
            { x: 80, z: 25 }, // Center
            // Corridor
            { x: 72, z: 60 }, { x: 88, z: 60 },
            { x: 72, z: 85 }, { x: 88, z: 85 },
            // Final chamber
            { x: 62, z: 105 }, { x: 98, z: 105 },
            { x: 62, z: 135 }, { x: 98, z: 135 },
            { x: 80, z: 120 }, // Center
        ];

        const torchMaterial = new THREE.MeshLambertMaterial({ color: 0x4a3020 });
        const flameMaterial = new THREE.MeshBasicMaterial({ color: 0xff6622 });

        for (const pos of torchPositions) {
            // Torch holder
            const holderGeo = new THREE.CylinderGeometry(0.1, 0.15, 0.8, 6);
            const holder = new THREE.Mesh(holderGeo, torchMaterial);
            holder.position.set(pos.x, 3.5, pos.z);
            this.scene.add(holder);

            // Flame visual
            const flameGeo = new THREE.ConeGeometry(0.2, 0.4, 6);
            const flame = new THREE.Mesh(flameGeo, flameMaterial);
            flame.position.set(pos.x, 4.1, pos.z);
            this.scene.add(flame);

            // Point light
            const light = new THREE.PointLight(0xff6633, 0.8, 15);
            light.position.set(pos.x, 4.2, pos.z);
            this.scene.add(light);
        }
    }

    // Add environmental props like barrels, crates, bones, etc.
    addEnvironmentProps() {
        const woodMaterial = new THREE.MeshLambertMaterial({ color: 0x6b4423 });
        const metalMaterial = new THREE.MeshLambertMaterial({ color: 0x555555 });
        const boneMaterial = new THREE.MeshLambertMaterial({ color: 0xddddcc });
        const clothMaterial = new THREE.MeshLambertMaterial({ color: 0x443322 });

        // Barrel positions
        const barrels = [
            { x: -8, z: -8 }, { x: -7, z: -9 },
            { x: 8, z: 15 }, { x: 9, z: 14 },
            { x: 25, z: 60 }, { x: 26, z: 58 },
            { x: 65, z: 18 }, { x: 66, z: 20 },
            { x: 95, z: 130 }, { x: 93, z: 132 },
        ];

        for (const pos of barrels) {
            const barrelGeo = new THREE.CylinderGeometry(0.6, 0.7, 1.2, 12);
            const barrel = new THREE.Mesh(barrelGeo, woodMaterial);
            barrel.position.set(pos.x, 0.6, pos.z);
            barrel.rotation.y = Math.random() * Math.PI;
            barrel.castShadow = true;
            this.scene.add(barrel);

            // Metal bands
            const bandGeo = new THREE.TorusGeometry(0.65, 0.05, 8, 16);
            const band1 = new THREE.Mesh(bandGeo, metalMaterial);
            band1.position.set(pos.x, 0.3, pos.z);
            band1.rotation.x = Math.PI / 2;
            this.scene.add(band1);

            const band2 = new THREE.Mesh(bandGeo, metalMaterial);
            band2.position.set(pos.x, 0.9, pos.z);
            band2.rotation.x = Math.PI / 2;
            this.scene.add(band2);
        }

        // Crate positions
        const crates = [
            { x: 7, z: -7 }, { x: 6, z: -8 },
            { x: -6, z: 25 },
            { x: 45, z: 45 }, { x: 46, z: 43 },
            { x: 75, z: 110 }, { x: 77, z: 112 },
        ];

        for (const pos of crates) {
            const size = 0.8 + Math.random() * 0.4;
            const crateGeo = new THREE.BoxGeometry(size, size, size);
            const crate = new THREE.Mesh(crateGeo, woodMaterial);
            crate.position.set(pos.x, size / 2, pos.z);
            crate.rotation.y = Math.random() * Math.PI / 4;
            crate.castShadow = true;
            this.scene.add(crate);
        }

        // Bone piles
        const bonePiles = [
            { x: -5, z: 40 }, { x: 30, z: 65 },
            { x: 70, z: 30 }, { x: 85, z: 125 },
        ];

        for (const pos of bonePiles) {
            // Skull
            const skullGeo = new THREE.SphereGeometry(0.25, 8, 6);
            const skull = new THREE.Mesh(skullGeo, boneMaterial);
            skull.position.set(pos.x, 0.2, pos.z);
            skull.scale.set(1, 0.9, 0.8);
            this.scene.add(skull);

            // Scattered bones
            for (let i = 0; i < 4; i++) {
                const boneGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.4 + Math.random() * 0.3, 6);
                const bone = new THREE.Mesh(boneGeo, boneMaterial);
                bone.position.set(
                    pos.x + (Math.random() - 0.5) * 1.5,
                    0.1,
                    pos.z + (Math.random() - 0.5) * 1.5
                );
                bone.rotation.x = Math.PI / 2;
                bone.rotation.z = Math.random() * Math.PI;
                this.scene.add(bone);
            }
        }

        // Weapon racks / stands
        const weaponRacks = [
            { x: -9, z: 0 }, { x: 9, z: 0 },
            { x: 80, z: 14 },
        ];

        for (const pos of weaponRacks) {
            // Rack frame
            const frameGeo = new THREE.BoxGeometry(2, 2, 0.3);
            const frame = new THREE.Mesh(frameGeo, woodMaterial);
            frame.position.set(pos.x, 1.5, pos.z);
            frame.castShadow = true;
            this.scene.add(frame);

            // Weapons on rack (simple shapes)
            const swordGeo = new THREE.BoxGeometry(0.1, 1.2, 0.05);
            const sword = new THREE.Mesh(swordGeo, metalMaterial);
            sword.position.set(pos.x - 0.4, 1.5, pos.z + 0.2);
            sword.rotation.z = 0.1;
            this.scene.add(sword);

            const axeGeo = new THREE.BoxGeometry(0.15, 0.8, 0.05);
            const axe = new THREE.Mesh(axeGeo, metalMaterial);
            axe.position.set(pos.x + 0.4, 1.5, pos.z + 0.2);
            axe.rotation.z = -0.1;
            this.scene.add(axe);
        }

        // Tattered banners
        const bannerPositions = [
            { x: -9, z: 15 }, { x: 9, z: 15 },
            { x: 80, z: 105 },
        ];

        for (const pos of bannerPositions) {
            // Banner pole
            const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 3, 6);
            const pole = new THREE.Mesh(poleGeo, woodMaterial);
            pole.position.set(pos.x, 4, pos.z);
            this.scene.add(pole);

            // Banner cloth
            const bannerGeo = new THREE.PlaneGeometry(1.2, 1.8);
            const banner = new THREE.Mesh(bannerGeo, clothMaterial);
            banner.position.set(pos.x, 3.5, pos.z + 0.1);
            banner.rotation.y = Math.random() * 0.3 - 0.15;
            this.scene.add(banner);
        }

        // Chains hanging from ceiling
        const chainPositions = [
            { x: 0, z: 45 }, { x: 50, z: 55 },
            { x: 80, z: 90 },
        ];

        for (const pos of chainPositions) {
            const chainLength = 2 + Math.random() * 2;
            for (let i = 0; i < chainLength * 3; i++) {
                const linkGeo = new THREE.TorusGeometry(0.1, 0.03, 6, 8);
                const link = new THREE.Mesh(linkGeo, metalMaterial);
                link.position.set(pos.x, 6 - i * 0.15, pos.z);
                link.rotation.x = (i % 2) * Math.PI / 2;
                this.scene.add(link);
            }
        }
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
