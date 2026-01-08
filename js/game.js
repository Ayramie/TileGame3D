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
import { WorldItemManager } from './worldItem.js';
import { InventoryUI } from './inventoryUI.js';

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
        this.respawnQueue = []; // Queue for enemy respawns
        this.respawnDelay = 10; // Seconds before respawn
        this.worldItems = null; // World item manager for loot drops
        this.fishingLake = null; // Fishing lake position and state

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
        this.setupInventoryUI();

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

        // Create world item manager for loot drops
        this.worldItems = new WorldItemManager(this.scene, this);

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
        this.respawnQueue = [];

        // Clean up world items
        if (this.worldItems) {
            this.worldItems.dispose();
            this.worldItems = null;
        }
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
                { x: 80, z: 120, width: 40, length: 40, rot: 0 },
                // Fishing lake corridor (branches off starting area to the left)
                { x: -22, z: -5, width: 10, length: 15, rot: Math.PI / 2 },
                // Fishing lake shore
                { x: -35, z: -5, width: 18, length: 18, rot: 0 }
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

            // Fishing lake water surface
            const waterGeo = new THREE.PlaneGeometry(12, 12);
            const waterMat = new THREE.MeshStandardMaterial({
                color: 0x2266aa,
                roughness: 0.2,
                metalness: 0.3,
                transparent: true,
                opacity: 0.85
            });
            const waterMesh = new THREE.Mesh(waterGeo, waterMat);
            waterMesh.rotation.x = -Math.PI / 2;
            waterMesh.position.set(-35, 0.05, -5);
            waterMesh.receiveShadow = true;
            this.scene.add(waterMesh);

            // Store fishing lake info
            this.fishingLake = {
                position: { x: -35, z: -5 },
                waterMesh: waterMesh,
                interactionRange: 6,
                isFishing: false,
                bobberMesh: null
            };

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

    setupInventoryUI() {
        this.inventoryUI = new InventoryUI(this);
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
                skeleton.spawnData = { x: pos.x, z: pos.z, type: pos.type };
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
                skeleton.spawnData = { x: pos.x, z: pos.z, type: pos.type };
                this.enemies.push(skeleton);
            }
        }
    }

    updateRespawns(deltaTime) {
        for (let i = this.respawnQueue.length - 1; i >= 0; i--) {
            const respawn = this.respawnQueue[i];
            respawn.timer -= deltaTime;

            if (respawn.timer <= 0) {
                // Respawn the enemy
                const data = respawn.spawnData;
                const skeleton = createSkeletonEnemy(this.scene, data.x, data.z, data.type);
                skeleton.spawnData = { x: data.x, z: data.z, type: data.type };
                this.enemies.push(skeleton);

                // Remove from queue
                this.respawnQueue.splice(i, 1);
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

                    // Queue respawn (not for bosses)
                    if (enemy.spawnData) {
                        this.respawnQueue.push({
                            spawnData: enemy.spawnData,
                            timer: this.respawnDelay
                        });
                    }
                }

                // Spawn loot drops
                if (this.worldItems) {
                    const lootType = isBoss ? 'skeleton_boss' : `skeleton_${enemy.skeletonType || 'minion'}`;
                    this.worldItems.spawnLoot(enemy.deathPosition, lootType);
                }

                enemy.justDied = false;
            }
        }

        // Process respawn queue
        this.updateRespawns(deltaTime);

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

        // Update world items (loot pickups)
        if (this.worldItems) {
            this.worldItems.update(deltaTime);
        }

        // Update player inventory cooldowns
        if (this.player && this.player.inventory) {
            this.player.inventory.update(deltaTime);
        }

        // Update player buffs
        if (this.player && this.player.updateBuffs) {
            this.player.updateBuffs(deltaTime);
        }

        // Update hotbar display
        if (this.inventoryUI) {
            this.inventoryUI.updateHotbarDisplay();
        }

        // Update fishing lake interaction
        this.updateFishing(deltaTime);

        // Update UI
        this.updateUI();
    }

    // Check proximity to fishing lake and show/hide prompt
    updateFishing(deltaTime) {
        if (!this.fishingLake || !this.player) return;

        const dx = this.player.position.x - this.fishingLake.position.x;
        const dz = this.player.position.z - this.fishingLake.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        const fishingPrompt = document.getElementById('fishing-prompt');
        const fishingStatus = document.getElementById('fishing-status');

        // Check if near lake
        this.fishingLake.isNearLake = distance < this.fishingLake.interactionRange;

        // Cancel fishing if player moves
        if (this.fishingLake.isFishing) {
            const lastPos = this.fishingLake.playerStartPos;
            if (lastPos) {
                const moved = Math.abs(this.player.position.x - lastPos.x) > 0.1 ||
                             Math.abs(this.player.position.z - lastPos.z) > 0.1;
                if (moved) {
                    this.stopFishing('You moved!');
                    return;
                }
            }
        }

        const fishingPopup = document.getElementById('fishing-popup');

        if (this.fishingLake.isFishing) {
            // Currently fishing - show popup and update minigame
            fishingPrompt?.classList.remove('visible');
            fishingStatus?.classList.remove('visible');
            fishingPopup?.classList.add('visible');

            // Update minigame
            this.updateFishingMinigame(deltaTime);

            // Animate water while fishing (simple wobble)
            if (this.fishingLake.waterMesh) {
                const time = this.clock.getElapsedTime();
                this.fishingLake.waterMesh.position.y = 0.05 + Math.sin(time * 2) * 0.02;
            }
        } else if (this.fishingLake.isNearLake) {
            // Near lake, show prompt
            fishingPrompt?.classList.add('visible');
            fishingStatus?.classList.remove('visible');
            fishingPopup?.classList.remove('visible');
        } else {
            // Not near lake
            fishingPrompt?.classList.remove('visible');
            fishingStatus?.classList.remove('visible');
            fishingPopup?.classList.remove('visible');
        }
    }

    // Fishing minigame states: 'waiting', 'bite', 'qte'
    updateFishingMinigame(deltaTime) {
        const mg = this.fishingLake.minigame;
        if (!mg) return;

        const statusText = document.getElementById('fishing-status-text');
        const qteContainer = document.getElementById('qte-container');
        const qteKey = document.getElementById('qte-current-key');
        const qteTimerFill = document.getElementById('qte-timer-fill');
        const qteComboValue = document.getElementById('qte-combo-value');
        const qteScoreValue = document.getElementById('qte-score-value');
        const qteProgressFill = document.getElementById('qte-progress-fill');
        const qteKeysRemaining = document.getElementById('qte-keys-remaining');

        switch (mg.state) {
            case 'waiting':
                // Waiting for a bite
                mg.biteTimer -= deltaTime;
                statusText.textContent = 'Waiting for a bite...';
                statusText.className = '';

                // Hide QTE elements during waiting
                if (qteContainer) qteContainer.style.opacity = '0.3';

                if (mg.biteTimer <= 0) {
                    // Fish bites!
                    mg.state = 'bite';
                    mg.biteWindow = 2.0; // 2 seconds to react
                    statusText.textContent = '!! FISH ON !! Press F!';
                    statusText.className = 'alert';

                    // Play splash effect
                    if (this.particles) {
                        this.particles.splashEffect(this.fishingLake.waterMesh.position);
                    }
                }
                break;

            case 'bite':
                // Player must press F quickly
                mg.biteWindow -= deltaTime;
                statusText.textContent = `!! FISH ON !! Press F! (${mg.biteWindow.toFixed(1)}s)`;

                if (mg.biteWindow <= 0) {
                    this.stopFishing('The fish got away!');
                }
                break;

            case 'qte':
                // Active QTE minigame
                if (qteContainer) qteContainer.style.opacity = '1';
                statusText.textContent = 'Press the keys!';
                statusText.className = '';

                // Update game timer (60 second countdown)
                mg.gameTimer -= deltaTime;
                const timeRemaining = document.getElementById('qte-time-remaining');
                if (timeRemaining) {
                    const seconds = Math.ceil(mg.gameTimer);
                    timeRemaining.textContent = seconds;
                    timeRemaining.classList.remove('warning', 'danger');
                    if (seconds <= 10) {
                        timeRemaining.classList.add('danger');
                    } else if (seconds <= 20) {
                        timeRemaining.classList.add('warning');
                    }
                }

                // Check if game time is up
                if (mg.gameTimer <= 0) {
                    this.finishQTEMinigame();
                    break;
                }

                // Update key timer
                mg.keyTimer -= deltaTime;
                const timerPercent = Math.max(0, mg.keyTimer / mg.keyTimeLimit);

                // Update timer ring (stroke-dashoffset: 0 = full, 283 = empty)
                if (qteTimerFill) {
                    qteTimerFill.style.strokeDashoffset = (1 - timerPercent) * 283;

                    // Change color based on time remaining
                    qteTimerFill.classList.remove('warning', 'danger');
                    if (timerPercent < 0.3) {
                        qteTimerFill.classList.add('danger');
                    } else if (timerPercent < 0.5) {
                        qteTimerFill.classList.add('warning');
                    }
                }

                // Check if key time ran out
                if (mg.keyTimer <= 0) {
                    this.qteKeyMiss();
                }

                // Update displays
                if (qteComboValue) {
                    qteComboValue.textContent = mg.combo;
                    if (mg.combo >= 5) {
                        qteComboValue.classList.add('high');
                    } else {
                        qteComboValue.classList.remove('high');
                    }
                }
                if (qteScoreValue) qteScoreValue.textContent = mg.score;

                // Update fish caught display
                const fishValue = document.getElementById('qte-fish-value');
                if (fishValue) fishValue.textContent = mg.fishCaught;

                break;
        }
    }

    // Start QTE sequence after bite
    startQTEMinigame() {
        const mg = this.fishingLake.minigame;
        if (!mg) return;

        mg.state = 'qte';
        mg.keys = ['W', 'A', 'S', 'D'];
        mg.gameTimer = 60; // 60 second game
        mg.keysCompleted = 0;
        mg.score = 0;
        mg.combo = 0;
        mg.maxCombo = 0;
        mg.fishCaught = 0;
        mg.keysForFish = 0; // Track keys toward next fish
        mg.keyTimeLimit = 1.2; // Seconds per key
        mg.keyTimer = mg.keyTimeLimit;
        mg.lastKeyTime = performance.now();

        // Initialize key queue (current + next 5)
        mg.keyQueue = [];
        for (let i = 0; i < 6; i++) {
            mg.keyQueue.push(this.getRandomQTEKey(mg));
        }
        mg.currentKey = mg.keyQueue[0];

        // Update UI
        this.updateQTEKeyDisplay();

        const feedback = document.getElementById('qte-feedback');
        if (feedback) feedback.textContent = '';

        // Reset timer display
        const timeRemaining = document.getElementById('qte-time-remaining');
        if (timeRemaining) {
            timeRemaining.textContent = '60';
            timeRemaining.classList.remove('warning', 'danger');
        }

        // Reset fish count display
        const fishValue = document.getElementById('qte-fish-value');
        if (fishValue) fishValue.textContent = '0';
    }

    getRandomQTEKey(mg) {
        return mg.keys[Math.floor(Math.random() * mg.keys.length)];
    }

    // Update the key display and queue
    updateQTEKeyDisplay() {
        const mg = this.fishingLake?.minigame;
        if (!mg) return;

        // Update current key
        const qteKey = document.getElementById('qte-current-key');
        if (qteKey) {
            qteKey.textContent = mg.keyQueue[0];
            qteKey.className = '';
        }

        // Update queue display (next 5 keys)
        const queueContainer = document.getElementById('qte-key-queue');
        if (queueContainer) {
            const queueKeys = queueContainer.querySelectorAll('.queue-key');
            for (let i = 0; i < queueKeys.length; i++) {
                if (mg.keyQueue[i + 1]) {
                    queueKeys[i].textContent = mg.keyQueue[i + 1];
                }
            }
        }
    }

    // Handle QTE key press
    handleQTEKeyPress(key) {
        const mg = this.fishingLake?.minigame;
        if (!mg || mg.state !== 'qte') return false;

        const pressedKey = key.toUpperCase();
        const qteKey = document.getElementById('qte-current-key');
        const feedback = document.getElementById('qte-feedback');

        if (pressedKey === mg.keyQueue[0]) {
            // Correct key!
            const reactionTime = (performance.now() - mg.lastKeyTime) / 1000;
            const timeBonus = Math.max(0, (mg.keyTimeLimit - reactionTime) / mg.keyTimeLimit);

            // Score based on speed
            let points = 100;
            let rating = 'good';

            if (timeBonus > 0.7) {
                points = 200;
                rating = 'perfect';
            } else if (timeBonus > 0.4) {
                points = 150;
                rating = 'great';
            }

            // Combo multiplier
            mg.combo++;
            mg.maxCombo = Math.max(mg.maxCombo, mg.combo);
            const comboMultiplier = 1 + (mg.combo * 0.1);
            points = Math.floor(points * comboMultiplier);
            mg.score += points;
            mg.keysCompleted++;

            // Track keys toward fish (every 10 correct = 1 fish)
            mg.keysForFish++;
            if (mg.keysForFish >= 10) {
                mg.fishCaught++;
                mg.keysForFish = 0;
                // Visual feedback for catching a fish
                if (this.particles) {
                    this.particles.splashEffect(this.fishingLake.waterMesh.position);
                }
            }

            // Visual feedback
            if (qteKey) {
                qteKey.classList.remove('wrong');
                qteKey.classList.add('correct');
                setTimeout(() => qteKey.classList.remove('correct'), 150);
            }
            if (feedback) {
                feedback.textContent = rating === 'perfect' ? 'PERFECT!' : rating === 'great' ? 'Great!' : 'Good';
                feedback.className = rating;
            }

            // Advance the queue
            mg.keyQueue.shift();
            mg.keyQueue.push(this.getRandomQTEKey(mg));
            mg.keyTimer = mg.keyTimeLimit;
            mg.lastKeyTime = performance.now();

            // Update display
            this.updateQTEKeyDisplay();

            return true;
        } else {
            // Wrong key!
            this.qteKeyMiss();
            return true;
        }
    }

    qteKeyMiss() {
        const mg = this.fishingLake?.minigame;
        if (!mg || mg.state !== 'qte') return;

        mg.combo = 0;
        mg.keysForFish = 0; // Reset progress toward next fish
        mg.score = Math.max(0, mg.score - 50);

        const qteKey = document.getElementById('qte-current-key');
        const feedback = document.getElementById('qte-feedback');

        if (qteKey) {
            qteKey.classList.remove('correct');
            qteKey.classList.add('wrong');
            setTimeout(() => qteKey.classList.remove('wrong'), 300);
        }
        if (feedback) {
            feedback.textContent = 'Miss!';
            feedback.className = 'miss';
        }

        // Advance the queue (move to next key)
        mg.keyQueue.shift();
        mg.keyQueue.push(this.getRandomQTEKey(mg));
        mg.keyTimer = mg.keyTimeLimit;
        mg.lastKeyTime = performance.now();

        // Update display
        this.updateQTEKeyDisplay();
    }

    finishQTEMinigame() {
        const mg = this.fishingLake?.minigame;
        if (!mg) return;

        // Calculate final results
        const finalScore = mg.score;
        const fishCaught = mg.fishCaught;
        const maxCombo = mg.maxCombo;

        this.stopFishing();

        // Show summary message
        this.showFishingMessage(`Time's up! Fish: ${fishCaught} | Score: ${finalScore} | Max Combo: ${maxCombo}`,
            fishCaught >= 5 ? 'epic' : fishCaught >= 3 ? 'rare' : fishCaught >= 1 ? 'uncommon' : 'common');

        // Splash effect
        if (this.particles && fishCaught > 0) {
            this.particles.splashEffect(this.fishingLake.waterMesh.position);
        }

        // Add gold based on fish caught (will be RNG fish types later)
        if (this.player.inventory && fishCaught > 0) {
            const goldAmount = fishCaught * 10;
            this.player.inventory.addGold(goldAmount);
        }
    }

    // Called when F is pressed during fishing
    fishingAction() {
        if (!this.fishingLake?.isFishing) return;

        const mg = this.fishingLake.minigame;
        if (!mg) return;

        if (mg.state === 'bite') {
            // Successfully hooked the fish - start QTE minigame!
            this.startQTEMinigame();
        }
    }

    // Toggle fishing state
    toggleFishing() {
        if (!this.fishingLake) return;

        if (this.fishingLake.isFishing) {
            this.stopFishing();
        } else if (this.fishingLake.isNearLake) {
            this.startFishing();
        }
    }

    startFishing() {
        if (!this.fishingLake || this.fishingLake.isFishing) return;

        this.fishingLake.isFishing = true;
        this.fishingLake.playerStartPos = {
            x: this.player.position.x,
            z: this.player.position.z
        };

        // Initialize minigame state
        this.fishingLake.minigame = {
            state: 'waiting',
            biteTimer: 2 + Math.random() * 3, // 2-5 seconds until bite
            biteWindow: 0,
            fishPos: 50,
            fishDirection: 1,
            fishSpeed: 40,
            tension: 0,
            progress: 0,
            isReeling: false
        };

        // Face the water
        const dx = this.fishingLake.position.x - this.player.position.x;
        const dz = this.fishingLake.position.z - this.player.position.z;
        this.player.rotation = Math.atan2(dx, dz);
    }

    stopFishing(message = null) {
        if (!this.fishingLake || !this.fishingLake.isFishing) return;

        this.fishingLake.isFishing = false;
        this.fishingLake.minigame = null;
        this.fishingLake.playerStartPos = null;

        // Hide popup
        const popup = document.getElementById('fishing-popup');
        popup?.classList.remove('visible');

        if (message) {
            this.showFishingMessage(message);
        }

        // Reset water position
        if (this.fishingLake.waterMesh) {
            this.fishingLake.waterMesh.position.y = 0.05;
        }
    }

    showFishingMessage(message, rarity = 'common') {
        const msgEl = document.getElementById('fishing-message');
        if (msgEl) {
            msgEl.textContent = message;
            msgEl.className = `rarity-${rarity}`;
            msgEl.classList.add('visible');
            // Longer display time for summary messages
            const displayTime = message.includes('Time') ? 4000 : 2000;
            setTimeout(() => msgEl.classList.remove('visible'), displayTime);
        }
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
            // Winding dungeon bounds (extended for fishing lake)
            this.minimapBounds = { minX: -50, maxX: 110, minZ: -20, maxZ: 150 };
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
                { x: 80, z: 120, w: 40, h: 40 },
                // Fishing lake corridor and shore
                { x: -22, z: -5, w: 15, h: 10 },
                { x: -35, z: -5, w: 18, h: 18 }
            ];
            for (const f of floors) {
                const p = toMinimap(f.x - f.w/2, f.z - f.h/2);
                ctx.fillRect(p.x, p.y, f.w * scale, f.h * scale);
            }

            // Draw fishing lake water area (blue)
            if (this.fishingLake) {
                ctx.fillStyle = 'rgba(34, 102, 170, 0.7)';
                const lakePos = toMinimap(this.fishingLake.position.x - 6, this.fishingLake.position.z - 6);
                ctx.fillRect(lakePos.x, lakePos.y, 12 * scale, 12 * scale);

                // Draw fishing icon (small fish shape)
                ctx.fillStyle = '#00ccff';
                const fishPos = toMinimap(this.fishingLake.position.x, this.fishingLake.position.z);
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('~', fishPos.x, fishPos.y);
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
        // Store for collision detection
        // Floor layout reference:
        // 1. Starting: x[-12,12] z[-15,5]
        // 2. First corridor: x[-10,10] z[0,50]
        // 3. Turn: x[5,35] z[40,70]
        // 4. Right corridor: x[25,75] z[45,65]
        // 5. Large room: x[63,98] z[13,48]
        // 6. Forward corridor: x[70,90] z[60,100]
        // 7. Final chamber: x[60,100] z[100,140]
        this.wallSegments = [
            // Starting area walls (left wall split for fishing lake corridor)
            { x1: -12, z1: -15, x2: -12, z2: -12 },    // Left wall bottom section
            { x1: -12, z1: 3, x2: -12, z2: 0 },        // Left wall top section (gap from z=-12 to z=3)
            { x1: 12, z1: -15, x2: 12, z2: 0 },        // Right wall
            { x1: -12, z1: -15, x2: 12, z2: -15 },     // Back wall

            // Fishing lake area walls
            { x1: -12, z1: -12, x2: -27, z2: -12 },    // Corridor bottom wall
            { x1: -12, z1: 3, x2: -27, z2: 3 },        // Corridor top wall
            { x1: -27, z1: -14, x2: -44, z2: -14 },    // Lake bottom wall
            { x1: -27, z1: 4, x2: -44, z2: 4 },        // Lake top wall
            { x1: -44, z1: -14, x2: -44, z2: 4 },      // Lake back wall

            // First corridor walls (x=-10 to 10, z=0 to 50)
            { x1: -10, z1: 0, x2: -10, z2: 50 },       // Left wall
            { x1: 10, z1: 0, x2: 10, z2: 40 },         // Right wall (ends at turn)

            // Turn section (x=5 to 35, z=40 to 70)
            { x1: -10, z1: 50, x2: 5, z2: 50 },        // Close gap at corridor end
            { x1: 5, z1: 50, x2: 5, z2: 70 },          // Left wall of turn
            { x1: 5, z1: 70, x2: 35, z2: 70 },         // Top wall of turn
            { x1: 10, z1: 40, x2: 35, z2: 40 },        // Bottom wall of turn

            // Right corridor (x=25 to 75, z=45 to 65)
            { x1: 35, z1: 70, x2: 75, z2: 70 },        // Top wall continues
            { x1: 35, z1: 40, x2: 75, z2: 40 },        // Bottom wall continues

            // Large room (x=63 to 98, z=13 to 48)
            { x1: 63, z1: 13, x2: 63, z2: 40 },        // Left wall
            { x1: 98, z1: 13, x2: 98, z2: 48 },        // Right wall
            { x1: 63, z1: 13, x2: 98, z2: 13 },        // Bottom wall

            // Forward corridor (x=70 to 90, z=60 to 100)
            { x1: 70, z1: 48, x2: 70, z2: 100 },       // Left wall
            { x1: 90, z1: 65, x2: 90, z2: 100 },       // Right wall

            // Final chamber (x=60 to 100, z=100 to 140)
            { x1: 60, z1: 100, x2: 60, z2: 140 },      // Left wall
            { x1: 100, z1: 100, x2: 100, z2: 140 },    // Right wall
            { x1: 60, z1: 140, x2: 100, z2: 140 },     // End wall
        ];

        for (const seg of this.wallSegments) {
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

    // Check if a position collides with walls
    checkWallCollision(x, z, radius = 0.5) {
        if (!this.wallSegments) return false;

        const wallThickness = 2;

        for (const seg of this.wallSegments) {
            // Get wall center and dimensions
            const wallCenterX = (seg.x1 + seg.x2) / 2;
            const wallCenterZ = (seg.z1 + seg.z2) / 2;
            const dx = seg.x2 - seg.x1;
            const dz = seg.z2 - seg.z1;
            // Don't add wallThickness to collision length - only use actual segment length
            const wallLength = Math.sqrt(dx * dx + dz * dz);
            const angle = Math.atan2(dx, dz);

            // Transform point to wall's local space
            const localX = (x - wallCenterX) * Math.cos(-angle) - (z - wallCenterZ) * Math.sin(-angle);
            const localZ = (x - wallCenterX) * Math.sin(-angle) + (z - wallCenterZ) * Math.cos(-angle);

            // Check if point is inside wall AABB (with radius)
            const halfWidth = wallThickness / 2 + radius;
            const halfLength = wallLength / 2 + radius;

            if (Math.abs(localX) < halfWidth && Math.abs(localZ) < halfLength) {
                return true;
            }
        }

        return false;
    }

    // Get corrected position that doesn't collide with walls
    resolveWallCollision(oldX, oldZ, newX, newZ, radius = 0.5) {
        if (!this.wallSegments) return { x: newX, z: newZ };

        // If no collision, return new position
        if (!this.checkWallCollision(newX, newZ, radius)) {
            return { x: newX, z: newZ };
        }

        // Try moving only in X
        if (!this.checkWallCollision(newX, oldZ, radius)) {
            return { x: newX, z: oldZ };
        }

        // Try moving only in Z
        if (!this.checkWallCollision(oldX, newZ, radius)) {
            return { x: oldX, z: newZ };
        }

        // Can't move at all
        return { x: oldX, z: oldZ };
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
