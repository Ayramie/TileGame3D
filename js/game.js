import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Player } from './player.js';
import { Mage } from './mage.js';
import { Hunter } from './hunter.js';
import { Adventurer } from './adventurer.js';
import { ThirdPersonCamera } from './camera.js';
import { InputManager } from './input.js';
import { SkeletonEnemy, createSkeletonEnemy } from './skeletonEnemy.js';
import { EffectsManager } from './effects.js';
import { ParticleSystem } from './particles.js';
import { DungeonBuilder } from './dungeonBuilder.js';
import { WorldItemManager } from './worldItem.js';
import { InventoryUI } from './inventoryUI.js';
import { ITEMS, getItemIcon } from './itemDatabase.js';
import { SoundManager } from './sound.js';

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
        this.campfire = null; // Campfire position and state
        this.mine = null; // Mining area position and state
        this.trees = null; // Chopping area position and state
        this.smelter = null; // Smelter forge station
        this.anvil = null; // Blacksmith anvil station
        this.craftingBench = null; // Crafting station position and state

        // Anvil recipes (metal crafting)
        this.anvilRecipes = [
            {
                id: 'copper_shortsword',
                name: 'Copper Shortsword',
                materials: [{ itemId: 'bar_copper', amount: 3 }],
                craftTime: 4.0
            },
            {
                id: 'copper_dagger',
                name: 'Copper Dagger',
                materials: [{ itemId: 'bar_copper', amount: 2 }],
                craftTime: 3.0
            },
            {
                id: 'iron_longsword',
                name: 'Iron Longsword',
                materials: [{ itemId: 'bar_iron', amount: 5 }],
                craftTime: 5.0
            },
            {
                id: 'gold_scepter',
                name: 'Gold Scepter',
                materials: [{ itemId: 'bar_gold', amount: 4 }],
                craftTime: 6.0
            }
        ];

        // Crafting recipes
        this.craftingRecipes = [
            {
                id: 'oak_shortbow',
                name: 'Oak Shortbow',
                materials: [{ itemId: 'wood_oak', amount: 5 }],
                craftTime: 2.0
            },
            {
                id: 'short_staff',
                name: 'Short Staff',
                materials: [{ itemId: 'wood_oak', amount: 4 }],
                craftTime: 2.0
            }
        ];

        // Adventure mode - NPCs and Quests
        this.npcs = [];
        this.quests = {};
        this.activeQuests = [];
        this.nearbyNPC = null; // NPC player is near for interaction

        // Dungeon builder
        this.dungeonBuilder = null;

        // Effects manager
        this.effects = new EffectsManager(this.scene);

        // Sound manager
        this.sound = new SoundManager();

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

        // Clear save button
        const clearSaveBtn = document.getElementById('clear-save-btn');
        if (clearSaveBtn) {
            clearSaveBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to clear your save data? This cannot be undone.')) {
                    localStorage.removeItem('tileGame3D_save');
                    clearSaveBtn.textContent = 'Save Cleared!';
                    clearSaveBtn.style.color = '#44ff88';
                    clearSaveBtn.style.borderColor = '#44ff88';
                    setTimeout(() => {
                        clearSaveBtn.textContent = 'Clear Save Data';
                        clearSaveBtn.style.color = '';
                        clearSaveBtn.style.borderColor = '';
                    }, 2000);
                }
            });
        }
    }

    async startGame(mode) {
        this.gameMode = mode;
        this.gameState = 'loading';

        // Initialize sound manager (requires user interaction)
        await this.sound.init();

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

        // Load saved game data for adventure mode
        if (this.gameMode === 'adventure') {
            if (this.loadGame()) {
                updateLoadingText('Restoring save...');
                await new Promise(resolve => setTimeout(resolve, 50));
                this.applySaveData();
            }
        }

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
                    <button class="class-btn" data-class="hunter">Hunter</button>
                </div>
            </div>
            <div class="menu-options">
                <button class="menu-btn" data-mode="adventure">Adventure</button>
                <button class="menu-btn" data-mode="horde">Skeleton Horde</button>
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
        document.getElementById('quest-tracker').style.display = 'none';
        document.getElementById('npc-dialog').style.display = 'none';
        document.getElementById('npc-prompt').style.display = 'none';

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

        // Clear NPCs and quests
        this.npcs = [];
        this.quests = {};
        this.activeQuests = [];
        this.nearbyNPC = null;

        // Clean up world items
        if (this.worldItems) {
            this.worldItems.dispose();
            this.worldItems = null;
        }
    }

    async setupScene() {
        if (this.gameMode === 'adventure') {
            // Adventure mode - outdoor starting zone
            this.scene.background = new THREE.Color(0x87ceeb);
            this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.008);

            const grassMaterial = new THREE.MeshLambertMaterial({ color: 0x3d6b3d });
            const pathMaterial = new THREE.MeshLambertMaterial({ color: 0x6b5a3d });
            const rockMaterial = new THREE.MeshLambertMaterial({ color: 0x555555 });

            // Main grassy area (expanded)
            const groundGeo = new THREE.PlaneGeometry(100, 100);
            const ground = new THREE.Mesh(groundGeo, grassMaterial);
            ground.rotation.x = -Math.PI / 2;
            ground.position.set(0, 0, 0);
            ground.receiveShadow = true;
            this.scene.add(ground);

            // Dirt path from spawn to NPC area (north)
            const pathGeo = new THREE.PlaneGeometry(4, 20);
            const path = new THREE.Mesh(pathGeo, pathMaterial);
            path.rotation.x = -Math.PI / 2;
            path.position.set(0, 0.01, 5);
            path.receiveShadow = true;
            this.scene.add(path);

            // Path to mine area (northeast)
            const minePathGeo = new THREE.PlaneGeometry(4, 15);
            const minePath = new THREE.Mesh(minePathGeo, pathMaterial);
            minePath.rotation.x = -Math.PI / 2;
            minePath.position.set(15, 0.01, 20);
            minePath.rotation.z = Math.PI / 4;
            minePath.receiveShadow = true;
            this.scene.add(minePath);

            // Path going south/west to woodworking area
            const woodPathGeo = new THREE.PlaneGeometry(4, 25);
            const woodPath = new THREE.Mesh(woodPathGeo, pathMaterial);
            woodPath.rotation.x = -Math.PI / 2;
            woodPath.position.set(-15, 0.01, -15);
            woodPath.rotation.z = Math.PI / 6;
            woodPath.receiveShadow = true;
            this.scene.add(woodPath);

            // Add some decorative rocks
            for (let i = 0; i < 8; i++) {
                const rockGeo = new THREE.DodecahedronGeometry(0.5 + Math.random() * 0.5, 0);
                const rock = new THREE.Mesh(rockGeo, rockMaterial);
                const angle = Math.random() * Math.PI * 2;
                const dist = 15 + Math.random() * 10;
                rock.position.set(Math.cos(angle) * dist, 0.3, Math.sin(angle) * dist);
                rock.rotation.set(Math.random() * 0.5, Math.random() * Math.PI, 0);
                rock.castShadow = true;
                this.scene.add(rock);
            }

            // Create NPC - Miner Tom (with model)
            await this.createNPC({
                id: 'miner_tom',
                name: 'Miner Tom',
                position: { x: 0, z: 12 },
                color: 0x8b4513,
                modelPath: 'assets/kaykit/characters/adventurers/Barbarian.glb',
                dialog: {
                    default: "Thanks for your help, adventurer!",
                    questAvailable: "I need 10 copper ore to repair my tools. There's a copper vein just up the hill!",
                    questInProgress: "How's the mining going? I need 10 copper ore total.",
                    questComplete: "Excellent work! That's all the copper I need. Here's your reward!"
                },
                quests: [
                    {
                        id: 'gather_copper',
                        name: 'Copper for Tom',
                        description: 'Gather 10 copper ore for Miner Tom',
                        objectives: [
                            { type: 'collect', itemId: 'ore_copper', target: 10, current: 0 }
                        ],
                        rewards: { gold: 50, items: [] },
                        keepItems: true,
                        nextQuestId: 'smelt_copper'
                    },
                    {
                        id: 'smelt_copper',
                        name: 'Smelt Some Bars',
                        description: 'Smelt 5 copper bars at the forge',
                        dialog: {
                            questAvailable: "Great job on the mining! Now I need you to smelt 5 copper bars at the forge over there.",
                            questInProgress: "Use the forge to smelt copper ore into bars. I need 5 copper bars.",
                            questComplete: "Perfect! Those bars look great. Here's your reward!"
                        },
                        objectives: [
                            { type: 'collect', itemId: 'bar_copper', target: 5, current: 0 }
                        ],
                        rewards: { gold: 75, items: [] },
                        keepItems: true,
                        nextQuestId: 'forge_sword'
                    },
                    {
                        id: 'forge_sword',
                        name: 'Forge a Weapon',
                        description: 'Craft a copper shortsword at the anvil',
                        dialog: {
                            questAvailable: "Now you're getting the hang of it! The next step is to forge a weapon. Use the anvil to craft a Copper Shortsword.",
                            questInProgress: "Use the anvil near the forge to craft a Copper Shortsword. You'll need 3 copper bars.",
                            questComplete: "A fine blade! You've learned the basics of smithing. Keep that sword - you've earned it!"
                        },
                        objectives: [
                            { type: 'collect', itemId: 'copper_shortsword', target: 1, current: 0 }
                        ],
                        rewards: { gold: 100, items: [] },
                        keepItems: true
                    }
                ]
            });

            // Create copper ore node
            this.createOreNode({
                position: { x: 20, z: 25 },
                type: 'copper',
                respawnTime: 30
            });

            // Create smelting forge
            this.createSmelter({
                position: { x: -15, z: 18 }
            });

            // Create blacksmith anvil
            this.createAnvil({
                position: { x: -10, z: 22 }
            });

            // Add decorative trees near spawn
            this.addTree(-20, 8);
            this.addTree(-22, 12);
            this.addTree(18, -5);
            this.addTree(22, -8);

            // ========== WOODWORKING AREA (Southwest) ==========

            // Create NPC - Woodworker Wendy
            await this.createNPC({
                id: 'woodworker_wendy',
                name: 'Woodworker Wendy',
                position: { x: -20, z: -20 },
                color: 0x228b22,
                modelPath: 'assets/kaykit/characters/adventurers/Rogue.glb',
                dialog: {
                    default: "Thanks for your help! The forest provides.",
                    questAvailable: "Hello there! I need 10 oak logs to finish my latest project. The grove is just over there!",
                    questInProgress: "How's the chopping going? I need 10 oak wood total.",
                    questComplete: "Excellent work! That's lovely oak. Here's your reward!"
                },
                quests: [
                    {
                        id: 'gather_wood',
                        name: 'Oak for Wendy',
                        description: 'Gather 10 oak wood for Woodworker Wendy',
                        objectives: [
                            { type: 'collect', itemId: 'wood_oak', target: 10, current: 0 }
                        ],
                        rewards: { gold: 50, items: [] },
                        keepItems: true,
                        nextQuestId: 'craft_bow'
                    },
                    {
                        id: 'craft_bow',
                        name: 'Craft a Bow',
                        description: 'Craft an Oak Shortbow at the crafting bench',
                        dialog: {
                            questAvailable: "Great job on the logging! Now, use that wood to craft an Oak Shortbow at my workbench.",
                            questInProgress: "Use the crafting bench to make an Oak Shortbow. You'll need 5 oak wood.",
                            questComplete: "A fine bow! That'll serve a hunter well. Here's your reward!"
                        },
                        objectives: [
                            { type: 'collect', itemId: 'oak_shortbow', target: 1, current: 0 }
                        ],
                        rewards: { gold: 75, items: [] },
                        keepItems: true,
                        nextQuestId: 'craft_staff'
                    },
                    {
                        id: 'craft_staff',
                        name: 'Craft a Staff',
                        description: 'Craft a Short Staff at the crafting bench',
                        dialog: {
                            questAvailable: "You're getting the hang of this! Now try crafting a Short Staff for any aspiring mages.",
                            questInProgress: "Use the crafting bench to make a Short Staff. You'll need 4 oak wood.",
                            questComplete: "Wonderful craftsmanship! You've mastered the basics of woodworking. Keep those items - you've earned them!"
                        },
                        objectives: [
                            { type: 'collect', itemId: 'short_staff', target: 1, current: 0 }
                        ],
                        rewards: { gold: 100, items: [] },
                        keepItems: true
                    }
                ]
            });

            // Create tree chopping area for Wendy's quests
            this.createTreeArea({
                position: { x: -30, z: -25 }
            });

            // Create crafting bench for Wendy's area
            this.createCraftingBench({
                position: { x: -25, z: -15 }
            });

            this.isOutdoorMap = true;

            // Show quest tracker for adventure mode
            document.getElementById('quest-tracker').style.display = 'block';

        } else if (this.gameMode === 'horde') {
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
                { x: -35, z: -5, width: 18, length: 18, rot: 0 },
                // Campfire corridor (branches off starting area to the right)
                { x: 22, z: -5, width: 10, length: 15, rot: Math.PI / 2 },
                // Campfire clearing
                { x: 35, z: -5, width: 16, length: 16, rot: 0 },
                // Mine corridor (branches off starting area backward)
                { x: 0, z: -25, width: 12, length: 15, rot: 0 },
                // Mine chamber
                { x: 0, z: -42, width: 20, length: 20, rot: 0 }
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

            // Campfire setup
            const campfireGroup = new THREE.Group();
            campfireGroup.position.set(35, 0, -5);

            // Stone ring around fire
            const ringGeo = new THREE.TorusGeometry(1.2, 0.3, 8, 16);
            const ringMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = -Math.PI / 2;
            ring.position.y = 0.15;
            campfireGroup.add(ring);

            // Logs
            const logGeo = new THREE.CylinderGeometry(0.15, 0.15, 1.5, 8);
            const logMat = new THREE.MeshLambertMaterial({ color: 0x4a3525 });
            for (let i = 0; i < 4; i++) {
                const log = new THREE.Mesh(logGeo, logMat);
                log.rotation.z = Math.PI / 2;
                log.rotation.y = (i * Math.PI) / 4;
                log.position.y = 0.2;
                campfireGroup.add(log);
            }

            // Fire glow (emissive sphere)
            const fireGeo = new THREE.SphereGeometry(0.6, 8, 8);
            const fireMat = new THREE.MeshBasicMaterial({
                color: 0xff6622,
                transparent: true,
                opacity: 0.8
            });
            const fireMesh = new THREE.Mesh(fireGeo, fireMat);
            fireMesh.position.y = 0.5;
            campfireGroup.add(fireMesh);

            // Fire light
            const fireLight = new THREE.PointLight(0xff6622, 2, 15);
            fireLight.position.y = 1;
            campfireGroup.add(fireLight);

            this.scene.add(campfireGroup);

            // Store campfire info
            this.campfire = {
                position: { x: 35, z: -5 },
                mesh: campfireGroup,
                fireMesh: fireMesh,
                fireLight: fireLight,
                interactionRange: 5,
                isCooking: false
            };

            // Mine setup - ore rocks
            const mineGroup = new THREE.Group();
            mineGroup.position.set(0, 0, -42);

            // Create ore rocks around the mine chamber
            const orePositions = [
                { x: -6, z: -6, type: 'copper' },
                { x: -7, z: 0, type: 'copper' },
                { x: -6, z: 5, type: 'iron' },
                { x: 6, z: -5, type: 'iron' },
                { x: 7, z: 2, type: 'copper' },
                { x: 5, z: 6, type: 'gold' },
                { x: 0, z: -7, type: 'iron' },
                { x: -3, z: 7, type: 'gold' }
            ];

            const oreColors = {
                copper: 0xb87333,
                iron: 0x808080,
                gold: 0xffd700
            };

            for (const ore of orePositions) {
                // Rock base
                const rockGeo = new THREE.DodecahedronGeometry(1.2, 0);
                const rockMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
                const rock = new THREE.Mesh(rockGeo, rockMat);
                rock.position.set(ore.x, 0.8, ore.z);
                rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
                rock.scale.set(1 + Math.random() * 0.3, 0.8 + Math.random() * 0.4, 1 + Math.random() * 0.3);
                rock.castShadow = true;
                mineGroup.add(rock);

                // Ore vein highlights
                const veinGeo = new THREE.DodecahedronGeometry(0.4, 0);
                const veinMat = new THREE.MeshStandardMaterial({
                    color: oreColors[ore.type],
                    roughness: 0.3,
                    metalness: 0.7,
                    emissive: oreColors[ore.type],
                    emissiveIntensity: 0.1
                });
                for (let i = 0; i < 3; i++) {
                    const vein = new THREE.Mesh(veinGeo, veinMat);
                    vein.position.set(
                        ore.x + (Math.random() - 0.5) * 1.5,
                        0.5 + Math.random() * 0.8,
                        ore.z + (Math.random() - 0.5) * 1.5
                    );
                    vein.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
                    vein.scale.setScalar(0.5 + Math.random() * 0.5);
                    mineGroup.add(vein);
                }
            }

            // Mine lantern for lighting
            const lanternLight = new THREE.PointLight(0xffaa44, 1.5, 20);
            lanternLight.position.set(0, 3, 0);
            mineGroup.add(lanternLight);

            this.scene.add(mineGroup);

            // Store mine info
            this.mine = {
                position: { x: 0, z: -42 },
                mesh: mineGroup,
                interactionRange: 8,
                isMining: false,
                ores: {
                    copper: 99,
                    iron: 99,
                    gold: 99
                }
            };

            // Create tree chopping area
            const treeGroup = new THREE.Group();

            // Create multiple trees
            const treePositions = [
                { x: -3, z: 0 },
                { x: 3, z: 0 },
                { x: 0, z: -3 },
                { x: -2, z: 3 },
                { x: 2, z: 3 }
            ];

            for (const treePos of treePositions) {
                // Tree trunk
                const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.4, 3, 8);
                const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
                const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
                trunk.position.set(treePos.x, 1.5, treePos.z);
                trunk.castShadow = true;
                treeGroup.add(trunk);

                // Tree foliage (cone shape)
                const foliageGeometry = new THREE.ConeGeometry(1.5, 3, 8);
                const foliageMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 });
                const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
                foliage.position.set(treePos.x, 4, treePos.z);
                foliage.castShadow = true;
                treeGroup.add(foliage);

                // Second layer of foliage
                const foliage2Geometry = new THREE.ConeGeometry(1.2, 2.5, 8);
                const foliage2 = new THREE.Mesh(foliage2Geometry, foliageMaterial);
                foliage2.position.set(treePos.x, 5.5, treePos.z);
                foliage2.castShadow = true;
                treeGroup.add(foliage2);
            }

            // Stump for visual variety
            const stumpGeometry = new THREE.CylinderGeometry(0.5, 0.6, 0.5, 8);
            const stumpMaterial = new THREE.MeshStandardMaterial({ color: 0x654321 });
            const stump = new THREE.Mesh(stumpGeometry, stumpMaterial);
            stump.position.set(0, 0.25, 0);
            stump.castShadow = true;
            treeGroup.add(stump);

            // Wood pile
            for (let i = 0; i < 5; i++) {
                const logGeometry = new THREE.CylinderGeometry(0.15, 0.15, 1.2, 6);
                const logMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
                const log = new THREE.Mesh(logGeometry, logMaterial);
                log.rotation.z = Math.PI / 2;
                log.position.set(-4 + Math.random() * 0.3, 0.15 + (i * 0.15), Math.random() * 0.5 - 0.25);
                log.castShadow = true;
                treeGroup.add(log);
            }

            // Position tree area
            treeGroup.position.set(42, 0, 0);
            this.scene.add(treeGroup);

            // Store tree info
            this.trees = {
                position: { x: 42, z: 0 },
                mesh: treeGroup,
                interactionRange: 8,
                isChopping: false,
                wood: {
                    oak: 99,
                    birch: 99,
                    mahogany: 99
                }
            };

            // Create crafting bench
            const craftingGroup = new THREE.Group();

            // Workbench table
            const tableTopGeometry = new THREE.BoxGeometry(3, 0.3, 2);
            const benchWoodMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
            const tableTop = new THREE.Mesh(tableTopGeometry, benchWoodMaterial);
            tableTop.position.set(0, 1.1, 0);
            tableTop.castShadow = true;
            craftingGroup.add(tableTop);

            // Table legs
            const legGeometry = new THREE.BoxGeometry(0.2, 1, 0.2);
            const legPositions = [
                { x: -1.2, z: -0.7 },
                { x: 1.2, z: -0.7 },
                { x: -1.2, z: 0.7 },
                { x: 1.2, z: 0.7 }
            ];
            for (const legPos of legPositions) {
                const leg = new THREE.Mesh(legGeometry, benchWoodMaterial);
                leg.position.set(legPos.x, 0.5, legPos.z);
                leg.castShadow = true;
                craftingGroup.add(leg);
            }

            // Tools on the bench - hammer
            const hammerHandleGeom = new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6);
            const hammerHandle = new THREE.Mesh(hammerHandleGeom, benchWoodMaterial);
            hammerHandle.rotation.z = Math.PI / 6;
            hammerHandle.position.set(-0.5, 1.4, 0.3);
            craftingGroup.add(hammerHandle);

            const hammerHeadGeom = new THREE.BoxGeometry(0.15, 0.25, 0.15);
            const benchMetalMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 });
            const hammerHead = new THREE.Mesh(hammerHeadGeom, benchMetalMaterial);
            hammerHead.position.set(-0.7, 1.55, 0.3);
            craftingGroup.add(hammerHead);

            // Some wood planks on the bench
            for (let i = 0; i < 3; i++) {
                const plankGeom = new THREE.BoxGeometry(0.8, 0.1, 0.15);
                const plank = new THREE.Mesh(plankGeom, benchWoodMaterial);
                plank.position.set(0.5, 1.3 + i * 0.1, -0.3 + i * 0.2);
                plank.rotation.y = Math.random() * 0.3 - 0.15;
                craftingGroup.add(plank);
            }

            // Lantern for visibility
            const craftLight = new THREE.PointLight(0xffdd88, 1.2, 15);
            craftLight.position.set(0, 2.5, 0);
            craftingGroup.add(craftLight);

            // Position crafting bench (opposite side from trees)
            craftingGroup.position.set(-42, 0, 0);
            this.scene.add(craftingGroup);

            // Store crafting bench info
            this.craftingBench = {
                position: { x: -42, z: 0 },
                mesh: craftingGroup,
                interactionRange: 6,
                isCrafting: false
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
        // In adventure mode, use classless Adventurer for tutorial
        if (this.gameMode === 'adventure') {
            this.player = new Adventurer(this.scene, this);
        } else if (this.selectedClass === 'mage') {
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
        // No enemies in adventure mode (peaceful starting zone)
        if (this.gameMode === 'adventure') {
            return;
        }

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

        // Update campfire interaction
        this.updateCampfire(deltaTime);

        // Update mine interaction
        this.updateMine(deltaTime);

        // Update tree chopping interaction
        this.updateTrees(deltaTime);

        // Update smelter interaction
        this.updateSmelter(deltaTime);

        // Update crafting bench interaction
        this.updateCraftingBench(deltaTime);

        // Update anvil interaction
        this.updateAnvil(deltaTime);

        // Update NPC proximity (adventure mode)
        if (this.gameMode === 'adventure') {
            this.updateNPCProximity();
            this.updateQuestTrackerUI();
        }

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
        mg.gameTimer = 30; // 30 second game
        mg.keysCompleted = 0;
        mg.score = 0;
        mg.combo = 0;
        mg.maxCombo = 0;
        mg.fishCaught = 0;
        mg.keysForFish = 0; // Track keys toward next fish
        mg.caughtFishList = []; // Track which fish were caught
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
            timeRemaining.textContent = '30';
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

                // RNG fish type based on current score/combo
                const fishId = this.rollFishType(mg.score, mg.combo);
                mg.caughtFishList.push(fishId);

                // Add fish to inventory immediately
                if (this.player.inventory) {
                    this.player.inventory.addItemById(fishId, 1);
                }

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
        const caughtFishList = mg.caughtFishList || [];

        this.stopFishing();

        // Count fish by type for summary
        const fishCounts = {};
        caughtFishList.forEach(fishId => {
            fishCounts[fishId] = (fishCounts[fishId] || 0) + 1;
        });

        // Build fish summary string
        let fishSummary = '';
        const fishNames = {
            'fish_small_trout': 'Trout',
            'fish_bass': 'Bass',
            'fish_golden_carp': 'G.Carp',
            'fish_rainbow_trout': 'R.Trout',
            'fish_legendary_koi': 'L.Koi'
        };
        for (const [fishId, count] of Object.entries(fishCounts)) {
            if (fishSummary) fishSummary += ', ';
            fishSummary += `${count}x ${fishNames[fishId] || fishId}`;
        }

        // Show summary message
        const message = fishCaught > 0
            ? `Time's up! Caught: ${fishSummary} | Score: ${finalScore}`
            : `Time's up! No fish caught | Score: ${finalScore}`;

        this.showFishingMessage(message,
            fishCaught >= 5 ? 'epic' : fishCaught >= 3 ? 'rare' : fishCaught >= 1 ? 'uncommon' : 'common');

        // Splash effect
        if (this.particles && fishCaught > 0) {
            this.particles.splashEffect(this.fishingLake.waterMesh.position);
        }
    }

    // Roll for fish type based on score and combo
    rollFishType(score, combo) {
        // Higher score/combo = better chance at rare fish
        const roll = Math.random() * 100;
        const bonusChance = Math.min(30, score / 100 + combo * 2); // Up to 30% bonus

        if (roll < 2 + bonusChance * 0.1) {
            return 'fish_legendary_koi'; // ~2-5% chance
        } else if (roll < 8 + bonusChance * 0.3) {
            return 'fish_rainbow_trout'; // ~6-17% chance
        } else if (roll < 25 + bonusChance * 0.5) {
            return 'fish_golden_carp'; // ~17-40% chance
        } else if (roll < 55) {
            return 'fish_bass'; // ~30% chance
        } else {
            return 'fish_small_trout'; // ~45% base chance
        }
    }

    // ==================== CAMPFIRE / COOKING ====================

    updateCampfire(deltaTime) {
        if (!this.campfire || !this.player) return;

        const dx = this.player.position.x - this.campfire.position.x;
        const dz = this.player.position.z - this.campfire.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        // Check if near campfire
        this.campfire.isNearCampfire = distance < this.campfire.interactionRange;

        // Cancel cooking if player moves away
        if (this.campfire.isCooking) {
            const startPos = this.campfire.playerStartPos;
            const movedDistance = Math.sqrt(
                Math.pow(this.player.position.x - startPos.x, 2) +
                Math.pow(this.player.position.z - startPos.z, 2)
            );
            if (movedDistance > 1.5) {
                this.stopCooking('Moved away from campfire');
            }
        }

        // Show/hide prompt
        const cookingPrompt = document.getElementById('cooking-prompt');
        const cookingPopup = document.getElementById('cooking-popup');

        if (this.campfire.isCooking) {
            cookingPrompt?.classList.remove('visible');

            // Update auto-cooking
            this.updateAutoCook(deltaTime);

            // Animate fire
            const time = performance.now() / 1000;
            if (this.campfire.fireMesh) {
                this.campfire.fireMesh.scale.y = 1 + Math.sin(time * 5) * 0.2;
                this.campfire.fireLight.intensity = 2 + Math.sin(time * 7) * 0.5;
            }
        } else if (this.campfire.isNearCampfire) {
            // Check if player has raw fish
            const hasRawFish = this.playerHasRawFish();
            if (hasRawFish) {
                cookingPrompt?.classList.add('visible');
            } else {
                cookingPrompt?.classList.remove('visible');
            }
            cookingPopup?.classList.remove('visible');

            // Animate fire gently
            const time = performance.now() / 1000;
            if (this.campfire.fireMesh) {
                this.campfire.fireMesh.scale.y = 1 + Math.sin(time * 3) * 0.1;
            }
        } else {
            cookingPrompt?.classList.remove('visible');
            cookingPopup?.classList.remove('visible');
        }
    }

    playerHasRawFish() {
        if (!this.player.inventory) return false;
        const rawFishIds = ['fish_small_trout', 'fish_bass', 'fish_golden_carp', 'fish_rainbow_trout', 'fish_legendary_koi'];
        for (const fishId of rawFishIds) {
            if (this.player.inventory.getItemCount(fishId) > 0) {
                return true;
            }
        }
        return false;
    }

    getRawFishInInventory() {
        if (!this.player.inventory) return [];
        const rawFishIds = ['fish_small_trout', 'fish_bass', 'fish_golden_carp', 'fish_rainbow_trout', 'fish_legendary_koi'];
        const result = [];
        for (const fishId of rawFishIds) {
            const count = this.player.inventory.getItemCount(fishId);
            if (count > 0) {
                result.push({ id: fishId, count: count });
            }
        }
        return result;
    }

    startCooking() {
        if (!this.campfire || this.campfire.isCooking) return;
        if (!this.playerHasRawFish()) return;

        // Show food selection popup
        this.showFoodSelection();
    }

    showFoodSelection() {
        const selectionPopup = document.getElementById('cooking-selection');
        const selectionGrid = document.getElementById('cooking-selection-grid');
        const closeBtn = document.getElementById('cooking-selection-close');
        if (!selectionPopup || !selectionGrid) return;

        // Clear existing options
        selectionGrid.innerHTML = '';

        // Add fish options with icons
        const fishInInventory = this.getRawFishInInventory();
        const fishIcons = {
            'fish_small_trout': '🐟',
            'fish_bass': '🐟',
            'fish_golden_carp': '🐠',
            'fish_rainbow_trout': '🐡',
            'fish_legendary_koi': '🎏'
        };
        const fishRarities = {
            'fish_small_trout': 'common',
            'fish_bass': 'common',
            'fish_golden_carp': 'uncommon',
            'fish_rainbow_trout': 'rare',
            'fish_legendary_koi': 'epic'
        };

        for (const fish of fishInInventory) {
            const div = document.createElement('div');
            div.className = `cooking-fish-option rarity-${fishRarities[fish.id] || 'common'}`;
            div.dataset.fishId = fish.id;
            div.innerHTML = `
                <span class="fish-icon">${fishIcons[fish.id] || '🐟'}</span>
                <span class="fish-qty">${fish.count}</span>
            `;
            div.onclick = () => this.selectFishToCook(fish.id);
            selectionGrid.appendChild(div);
        }

        // Setup close button
        if (closeBtn) {
            closeBtn.onclick = () => {
                selectionPopup.classList.remove('visible');
            };
        }

        selectionPopup.classList.add('visible');
    }

    selectFishToCook(fishId) {
        // Hide selection popup
        const selectionPopup = document.getElementById('cooking-selection');
        selectionPopup?.classList.remove('visible');

        // Count how many of this fish we have
        const fishCount = this.player.inventory.getItemCount(fishId);
        if (fishCount <= 0) return;

        // Start auto-cooking
        this.campfire.isCooking = true;
        this.campfire.playerStartPos = {
            x: this.player.position.x,
            z: this.player.position.z
        };
        this.campfire.autoCook = {
            fishId: fishId,
            remaining: fishCount,
            total: fishCount,
            timer: 0,
            cookTime: 2.0 // 2 seconds per fish
        };

        // Face the fire
        const dx = this.campfire.position.x - this.player.position.x;
        const dz = this.campfire.position.z - this.player.position.z;
        this.player.rotation = Math.atan2(dx, dz);

        // Show cooking popup with progress
        const cookingPopup = document.getElementById('cooking-popup');
        cookingPopup?.classList.add('visible');

        this.updateAutoCookUI();
    }

    updateAutoCook(deltaTime) {
        const ac = this.campfire?.autoCook;
        if (!ac) return;

        ac.timer += deltaTime;

        // Update progress bar
        const progress = ac.timer / ac.cookTime;
        const qualityFill = document.getElementById('cooking-quality-fill');
        if (qualityFill) {
            qualityFill.style.width = `${progress * 100}%`;
        }

        // Check if current fish is done
        if (ac.timer >= ac.cookTime) {
            ac.timer = 0;

            // Remove raw fish and add cooked fish
            const cookedFishMap = {
                'fish_small_trout': 'cooked_small_trout',
                'fish_bass': 'cooked_bass',
                'fish_golden_carp': 'cooked_golden_carp',
                'fish_rainbow_trout': 'cooked_rainbow_trout',
                'fish_legendary_koi': 'cooked_legendary_koi'
            };

            if (this.player.inventory.removeItemById(ac.fishId, 1)) {
                const cookedId = cookedFishMap[ac.fishId];
                if (cookedId) {
                    this.player.inventory.addItemById(cookedId, 1);
                }
            }

            ac.remaining--;
            this.updateAutoCookUI();

            // Check if all done
            if (ac.remaining <= 0) {
                const total = ac.total;
                this.stopCooking();
                this.showCookingMessage(`Cooked ${total} fish!`, 'uncommon');
            }
        }
    }

    updateAutoCookUI() {
        const ac = this.campfire?.autoCook;
        if (!ac) return;

        const flipsValue = document.getElementById('cooking-flips-value');
        if (flipsValue) {
            const cooked = ac.total - ac.remaining;
            flipsValue.textContent = `${cooked} / ${ac.total}`;
        }

        const statusText = document.getElementById('cooking-status-text');
        if (statusText) {
            statusText.textContent = `Cooking... ${ac.remaining} remaining`;
        }

        const ratingEl = document.getElementById('cooking-rating-value');
        if (ratingEl) {
            ratingEl.textContent = 'Cooking...';
            ratingEl.className = '';
        }
    }

    finishCooking() {
        // Not used in auto-cook mode
    }

    stopCooking(message = null) {
        if (!this.campfire) return;

        this.campfire.isCooking = false;
        this.campfire.autoCook = null;
        this.campfire.playerStartPos = null;

        // Hide popups
        const cookingPopup = document.getElementById('cooking-popup');
        const selectionPopup = document.getElementById('cooking-selection');
        cookingPopup?.classList.remove('visible');
        selectionPopup?.classList.remove('visible');

        // Reset progress bar
        const qualityFill = document.getElementById('cooking-quality-fill');
        if (qualityFill) {
            qualityFill.style.width = '0%';
        }

        if (message) {
            this.showCookingMessage(message);
        }
    }

    showCookingMessage(message, rarity = 'common') {
        const msgEl = document.getElementById('cooking-message');
        if (msgEl) {
            msgEl.textContent = message;
            msgEl.className = `rarity-${rarity}`;
            msgEl.classList.add('visible');
            setTimeout(() => msgEl.classList.remove('visible'), 2500);
        }
    }

    // ==================== MINING ====================

    updateMine(deltaTime) {
        if (!this.mine || !this.player) return;

        const dx = this.player.position.x - this.mine.position.x;
        const dz = this.player.position.z - this.mine.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        // Check if near mine
        this.mine.isNearMine = distance < this.mine.interactionRange;

        // Cancel mining if player moves away
        if (this.mine.isMining) {
            const startPos = this.mine.playerStartPos;
            const movedDistance = Math.sqrt(
                Math.pow(this.player.position.x - startPos.x, 2) +
                Math.pow(this.player.position.z - startPos.z, 2)
            );
            if (movedDistance > 1.5) {
                this.stopMining('Moved away from mine');
            }
        }

        // Show/hide prompt
        const miningPrompt = document.getElementById('mining-prompt');
        const miningPopup = document.getElementById('mining-popup');

        if (this.mine.isMining) {
            miningPrompt?.classList.remove('visible');

            // Update mining minigame
            this.updateMiningMinigame(deltaTime);
        } else if (this.mine.isNearMine) {
            miningPrompt?.classList.add('visible');
            miningPopup?.classList.remove('visible');
        } else {
            miningPrompt?.classList.remove('visible');
            miningPopup?.classList.remove('visible');
        }
    }

    startMining() {
        if (!this.mine || this.mine.isMining) return;

        // Show ore selection popup
        this.showOreSelection();
    }

    showOreSelection() {
        const selectionPopup = document.getElementById('mining-selection');
        const selectionGrid = document.getElementById('mining-selection-grid');
        const closeBtn = document.getElementById('mining-selection-close');
        if (!selectionPopup || !selectionGrid) return;

        // Clear existing options
        selectionGrid.innerHTML = '';

        // Add ore options
        const oreTypes = [
            { id: 'copper', name: 'Copper', icon: '🟤', rarity: 'common' },
            { id: 'iron', name: 'Iron', icon: '⚫', rarity: 'uncommon' },
            { id: 'gold', name: 'Gold', icon: '🟡', rarity: 'rare' }
        ];

        for (const ore of oreTypes) {
            if (this.mine.ores[ore.id] > 0) {
                const div = document.createElement('div');
                div.className = `mining-ore-option rarity-${ore.rarity}`;
                div.dataset.oreId = ore.id;
                div.innerHTML = `
                    <span class="ore-icon">${ore.icon}</span>
                    <span class="ore-name">${ore.name}</span>
                `;
                div.onclick = () => this.selectOreToMine(ore.id);
                selectionGrid.appendChild(div);
            }
        }

        // Setup close button
        if (closeBtn) {
            closeBtn.onclick = () => {
                selectionPopup.classList.remove('visible');
            };
        }

        selectionPopup.classList.add('visible');
    }

    selectOreToMine(oreId) {
        // Hide selection popup
        const selectionPopup = document.getElementById('mining-selection');
        selectionPopup?.classList.remove('visible');

        // Check available ore
        const oreCount = this.mine.ores[oreId] || 0;
        if (oreCount <= 0) return;

        // Start mining minigame
        this.mine.isMining = true;
        this.mine.playerStartPos = {
            x: this.player.position.x,
            z: this.player.position.z
        };

        // Initialize minigame state
        this.mine.minigame = {
            oreId: oreId,
            gameTimer: 20, // 20 second game
            indicatorPos: 10, // Position as percentage (10-90)
            indicatorSpeed: 80, // Speed (percentage per second)
            indicatorDirection: 1, // 1 = right, -1 = left
            score: 0,
            combo: 0,
            maxCombo: 0,
            oreMined: 0,
            hitsForOre: 0, // Track hits toward next ore (5 good hits = 1 ore)
            minedOreList: [] // Track mined ore
        };

        // Show mining popup
        const miningPopup = document.getElementById('mining-popup');
        miningPopup?.classList.add('visible');

        // Reset UI
        this.updateMiningUI();

        const feedback = document.getElementById('mining-feedback');
        if (feedback) feedback.textContent = '';

        const timeRemaining = document.getElementById('mining-time-remaining');
        if (timeRemaining) {
            timeRemaining.textContent = '20';
            timeRemaining.classList.remove('warning', 'danger');
        }
    }

    updateMiningMinigame(deltaTime) {
        const mg = this.mine?.minigame;
        if (!mg) return;

        // Update game timer
        mg.gameTimer -= deltaTime;

        // Update timer display
        const timeEl = document.getElementById('mining-time-remaining');
        if (timeEl) {
            const seconds = Math.ceil(mg.gameTimer);
            timeEl.textContent = Math.max(0, seconds).toString();

            if (seconds <= 5) {
                timeEl.classList.add('danger');
                timeEl.classList.remove('warning');
            } else if (seconds <= 10) {
                timeEl.classList.add('warning');
                timeEl.classList.remove('danger');
            } else {
                timeEl.classList.remove('warning', 'danger');
            }
        }

        // Check if game over
        if (mg.gameTimer <= 0) {
            this.endMiningMinigame();
            return;
        }

        // Move indicator back and forth
        mg.indicatorPos += mg.indicatorSpeed * mg.indicatorDirection * deltaTime;

        // Bounce off edges
        if (mg.indicatorPos >= 90) {
            mg.indicatorPos = 90;
            mg.indicatorDirection = -1;
        } else if (mg.indicatorPos <= 10) {
            mg.indicatorPos = 10;
            mg.indicatorDirection = 1;
        }

        // Update indicator position
        const indicator = document.getElementById('mining-indicator');
        if (indicator) {
            indicator.style.left = `${mg.indicatorPos}%`;
        }
    }

    // Handle mining swing (SPACE key)
    handleMiningSwing() {
        const mg = this.mine?.minigame;
        if (!mg || mg.gameTimer <= 0) return;

        // Calculate distance from center (sweet spot is at 50%)
        const distanceFromCenter = Math.abs(mg.indicatorPos - 50);

        const feedback = document.getElementById('mining-feedback');
        let rating = '';
        let points = 0;

        // Determine hit quality based on distance from center
        if (distanceFromCenter <= 8) {
            // Perfect hit (within 8% of center)
            rating = 'PERFECT!';
            points = 200;
            mg.combo++;
            mg.hitsForOre += 2; // Perfect counts as 2 hits
            if (feedback) {
                feedback.textContent = rating;
                feedback.className = 'perfect';
            }
        } else if (distanceFromCenter <= 15) {
            // Great hit
            rating = 'Great!';
            points = 150;
            mg.combo++;
            mg.hitsForOre += 1.5;
            if (feedback) {
                feedback.textContent = rating;
                feedback.className = 'great';
            }
        } else if (distanceFromCenter <= 25) {
            // Good hit
            rating = 'Good';
            points = 100;
            mg.combo++;
            mg.hitsForOre += 1;
            if (feedback) {
                feedback.textContent = rating;
                feedback.className = 'good';
            }
        } else {
            // Miss
            rating = 'Miss!';
            points = 0;
            mg.combo = 0;
            if (feedback) {
                feedback.textContent = rating;
                feedback.className = 'miss';
            }
        }

        // Apply combo multiplier
        mg.maxCombo = Math.max(mg.maxCombo, mg.combo);
        const comboMultiplier = 1 + (mg.combo * 0.1);
        points = Math.floor(points * comboMultiplier);
        mg.score += points;

        // Check if earned an ore (every 5 hits worth)
        if (mg.hitsForOre >= 5) {
            mg.oreMined++;
            mg.hitsForOre -= 5;

            // Add ore to inventory immediately
            const oreItemMap = {
                'copper': 'ore_copper',
                'iron': 'ore_iron',
                'gold': 'ore_gold'
            };
            const oreItemId = oreItemMap[mg.oreId];
            if (oreItemId && this.player.inventory) {
                this.player.inventory.addItemById(oreItemId, 1);
            }

            // Decrease mine ore count
            if (this.mine.ores[mg.oreId] > 0) {
                this.mine.ores[mg.oreId]--;
            }

            mg.minedOreList.push(mg.oreId);
        }

        // Speed up indicator slightly with each hit (makes it harder)
        if (points > 0) {
            mg.indicatorSpeed = Math.min(150, mg.indicatorSpeed + 2);
        }

        // Update UI
        this.updateMiningUI();

        // Clear feedback after a moment
        setTimeout(() => {
            if (feedback && feedback.textContent === rating) {
                feedback.textContent = '';
            }
        }, 400);
    }

    updateMiningUI() {
        const mg = this.mine?.minigame;
        if (!mg) return;

        const oreValue = document.getElementById('mining-ore-value');
        if (oreValue) {
            oreValue.textContent = mg.oreMined.toString();
        }

        const comboValue = document.getElementById('mining-combo-value');
        if (comboValue) {
            comboValue.textContent = mg.combo.toString();
            if (mg.combo >= 10) {
                comboValue.classList.add('high');
            } else {
                comboValue.classList.remove('high');
            }
        }

        const scoreValue = document.getElementById('mining-score-value');
        if (scoreValue) {
            scoreValue.textContent = mg.score.toString();
        }

        const statusText = document.getElementById('mining-status-text');
        if (statusText) {
            const oreName = mg.oreId.charAt(0).toUpperCase() + mg.oreId.slice(1);
            statusText.textContent = `Mining ${oreName}...`;
        }
    }

    endMiningMinigame() {
        const mg = this.mine?.minigame;
        if (!mg) return;

        const oreMined = mg.oreMined;
        const finalScore = mg.score;
        const maxCombo = mg.maxCombo;
        const oreId = mg.oreId;
        const oreName = oreId.charAt(0).toUpperCase() + oreId.slice(1);

        // Stop mining
        this.mine.isMining = false;
        this.mine.minigame = null;
        this.mine.playerStartPos = null;

        // Hide popup
        const miningPopup = document.getElementById('mining-popup');
        miningPopup?.classList.remove('visible');

        // Show summary message
        const rarity = oreId === 'gold' ? 'rare' : oreId === 'iron' ? 'uncommon' : 'common';
        const message = oreMined > 0
            ? `Time's up! Mined: ${oreMined} ${oreName} Ore | Score: ${finalScore}`
            : `Time's up! No ore mined | Score: ${finalScore}`;

        this.showMiningMessage(message, oreMined >= 5 ? 'rare' : oreMined >= 3 ? 'uncommon' : 'common');

        // Auto-save after mining
        if (oreMined > 0) {
            this.autoSave();
        }
    }

    stopMining(message = null) {
        if (!this.mine) return;

        this.mine.isMining = false;
        this.mine.minigame = null;
        this.mine.playerStartPos = null;

        // Hide popups
        const miningPopup = document.getElementById('mining-popup');
        const selectionPopup = document.getElementById('mining-selection');
        miningPopup?.classList.remove('visible');
        selectionPopup?.classList.remove('visible');

        if (message) {
            this.showMiningMessage(message);
        }
    }

    showMiningMessage(message, rarity = 'common') {
        const msgEl = document.getElementById('mining-message');
        if (msgEl) {
            msgEl.textContent = message;
            msgEl.className = `rarity-${rarity}`;
            msgEl.classList.add('visible');
            const displayTime = message.includes('Time') ? 4000 : 2500;
            setTimeout(() => msgEl.classList.remove('visible'), displayTime);
        }
    }

    // ==================== SMELTING ====================

    createSmelter(config) {
        const { position } = config;
        const smelterGroup = new THREE.Group();
        smelterGroup.position.set(position.x, 0, position.z);

        // Forge base - stone structure
        const baseGeo = new THREE.BoxGeometry(3, 1.5, 2);
        const baseMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.y = 0.75;
        base.castShadow = true;
        base.receiveShadow = true;
        smelterGroup.add(base);

        // Forge opening (dark)
        const openingGeo = new THREE.BoxGeometry(1.5, 1, 0.5);
        const openingMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
        const opening = new THREE.Mesh(openingGeo, openingMat);
        opening.position.set(0, 0.7, 1.05);
        smelterGroup.add(opening);

        // Forge chimney
        const chimneyGeo = new THREE.CylinderGeometry(0.4, 0.5, 2, 8);
        const chimneyMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
        const chimney = new THREE.Mesh(chimneyGeo, chimneyMat);
        chimney.position.set(0, 2.5, -0.5);
        chimney.castShadow = true;
        smelterGroup.add(chimney);

        // Fire glow inside forge
        const fireGeo = new THREE.SphereGeometry(0.5, 8, 8);
        const fireMat = new THREE.MeshBasicMaterial({
            color: 0xff4400,
            transparent: true,
            opacity: 0.8
        });
        const fireMesh = new THREE.Mesh(fireGeo, fireMat);
        fireMesh.position.set(0, 0.7, 0.5);
        smelterGroup.add(fireMesh);

        // Fire light
        const fireLight = new THREE.PointLight(0xff4400, 1.5, 10);
        fireLight.position.set(0, 1, 0.5);
        smelterGroup.add(fireLight);

        // Anvil nearby
        const anvilBaseGeo = new THREE.BoxGeometry(0.8, 0.4, 0.5);
        const anvilMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
        const anvilBase = new THREE.Mesh(anvilBaseGeo, anvilMat);
        anvilBase.position.set(2.5, 0.2, 0);
        anvilBase.castShadow = true;
        smelterGroup.add(anvilBase);

        const anvilTopGeo = new THREE.BoxGeometry(1.2, 0.3, 0.6);
        const anvilTop = new THREE.Mesh(anvilTopGeo, anvilMat);
        anvilTop.position.set(2.5, 0.55, 0);
        anvilTop.castShadow = true;
        smelterGroup.add(anvilTop);

        this.scene.add(smelterGroup);

        // Store smelter info
        this.smelter = {
            position: position,
            mesh: smelterGroup,
            fireMesh: fireMesh,
            fireLight: fireLight,
            interactionRange: 5,
            isSmelting: false,
            autoSmelt: null,
            playerStartPos: null
        };
    }

    updateSmelter(deltaTime) {
        if (!this.smelter || !this.player) return;

        const dx = this.player.position.x - this.smelter.position.x;
        const dz = this.player.position.z - this.smelter.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        // Check if near smelter
        this.smelter.isNearSmelter = distance < this.smelter.interactionRange;

        // Cancel smelting if player moves away
        if (this.smelter.isSmelting) {
            const startPos = this.smelter.playerStartPos;
            const movedDistance = Math.sqrt(
                Math.pow(this.player.position.x - startPos.x, 2) +
                Math.pow(this.player.position.z - startPos.z, 2)
            );
            if (movedDistance > 1.5) {
                this.stopSmelting('Moved away from forge');
            }
        }

        // Show/hide prompt
        const smeltingPrompt = document.getElementById('smelting-prompt');
        const smeltingPopup = document.getElementById('smelting-popup');

        if (this.smelter.isSmelting) {
            smeltingPrompt?.classList.remove('visible');
            // Update auto-smelting
            this.updateAutoSmelt(deltaTime);
        } else if (this.smelter.isNearSmelter) {
            smeltingPrompt?.classList.add('visible');
            smeltingPopup?.classList.remove('visible');
        } else {
            smeltingPrompt?.classList.remove('visible');
            smeltingPopup?.classList.remove('visible');
        }

        // Animate fire
        if (this.smelter.fireMesh) {
            const time = performance.now() / 1000;
            this.smelter.fireMesh.scale.y = 1 + Math.sin(time * 4) * 0.15;
            this.smelter.fireMesh.material.opacity = 0.7 + Math.sin(time * 5) * 0.2;
        }
    }

    playerHasOre() {
        if (!this.player.inventory) return false;
        const oreIds = ['ore_copper', 'ore_iron', 'ore_gold'];
        for (const oreId of oreIds) {
            if (this.player.inventory.getItemCount(oreId) > 0) {
                return true;
            }
        }
        return false;
    }

    getOresInInventory() {
        if (!this.player.inventory) return [];
        const oreIds = ['ore_copper', 'ore_iron', 'ore_gold'];
        const result = [];
        for (const oreId of oreIds) {
            const count = this.player.inventory.getItemCount(oreId);
            if (count > 0) {
                result.push({ id: oreId, count: count });
            }
        }
        return result;
    }

    startSmelting() {
        if (!this.smelter || this.smelter.isSmelting) return;
        if (!this.playerHasOre()) return;

        // Show ore selection popup
        this.showSmeltingSelection();
    }

    showSmeltingSelection() {
        const selectionPopup = document.getElementById('smelting-selection');
        const selectionGrid = document.getElementById('smelting-selection-grid');
        const closeBtn = document.getElementById('smelting-selection-close');
        if (!selectionPopup || !selectionGrid) return;

        // Clear existing options
        selectionGrid.innerHTML = '';

        // Add ore options with icons
        const oresInInventory = this.getOresInInventory();
        const oreIcons = {
            'ore_copper': '🟤',
            'ore_iron': '⚫',
            'ore_gold': '🟡'
        };
        const oreNames = {
            'ore_copper': 'Copper',
            'ore_iron': 'Iron',
            'ore_gold': 'Gold'
        };
        const oreRarities = {
            'ore_copper': 'common',
            'ore_iron': 'uncommon',
            'ore_gold': 'rare'
        };

        for (const ore of oresInInventory) {
            const div = document.createElement('div');
            div.className = `smelting-ore-option rarity-${oreRarities[ore.id] || 'common'}`;
            div.dataset.oreId = ore.id;
            div.innerHTML = `
                <span class="ore-icon">${oreIcons[ore.id] || '⚫'}</span>
                <span class="ore-name">${oreNames[ore.id] || 'Ore'}</span>
                <span class="ore-qty">x${ore.count}</span>
            `;
            div.onclick = () => this.selectOreToSmelt(ore.id);
            selectionGrid.appendChild(div);
        }

        // Setup close button
        if (closeBtn) {
            closeBtn.onclick = () => {
                selectionPopup.classList.remove('visible');
            };
        }

        selectionPopup.classList.add('visible');
    }

    selectOreToSmelt(oreId) {
        // Hide selection popup
        const selectionPopup = document.getElementById('smelting-selection');
        selectionPopup?.classList.remove('visible');

        // Count how many of this ore we have
        const oreCount = this.player.inventory.getItemCount(oreId);
        if (oreCount <= 0) return;

        // Start auto-smelting
        this.smelter.isSmelting = true;
        this.smelter.playerStartPos = {
            x: this.player.position.x,
            z: this.player.position.z
        };
        this.smelter.autoSmelt = {
            oreId: oreId,
            remaining: oreCount,
            total: oreCount,
            timer: 0,
            smeltTime: 3.0 // 3 seconds per bar
        };

        // Face the forge
        const dx = this.smelter.position.x - this.player.position.x;
        const dz = this.smelter.position.z - this.player.position.z;
        this.player.rotation = Math.atan2(dx, dz);

        // Show smelting popup with progress
        const smeltingPopup = document.getElementById('smelting-popup');
        smeltingPopup?.classList.add('visible');

        this.updateAutoSmeltUI();
    }

    updateAutoSmelt(deltaTime) {
        const as = this.smelter?.autoSmelt;
        if (!as) return;

        as.timer += deltaTime;

        // Update progress bar
        const progress = as.timer / as.smeltTime;
        const progressFill = document.getElementById('smelting-progress-fill');
        if (progressFill) {
            progressFill.style.width = `${progress * 100}%`;
        }

        // Check if current ore is done
        if (as.timer >= as.smeltTime) {
            as.timer = 0;

            // Mapping ore to bar
            const barMap = {
                'ore_copper': 'bar_copper',
                'ore_iron': 'bar_iron',
                'ore_gold': 'bar_gold'
            };

            if (this.player.inventory.removeItemById(as.oreId, 1)) {
                const barId = barMap[as.oreId];
                if (barId) {
                    this.player.inventory.addItemById(barId, 1);
                }
            }

            as.remaining--;
            this.updateAutoSmeltUI();

            // Check if all done
            if (as.remaining <= 0) {
                const total = as.total;
                const oreName = as.oreId.replace('ore_', '');
                this.stopSmelting();
                this.showSmeltingMessage(`Smelted ${total} ${oreName} bar${total > 1 ? 's' : ''}!`, 'uncommon');

                // Auto-save after smelting
                this.autoSave();
            }
        }
    }

    updateAutoSmeltUI() {
        const as = this.smelter?.autoSmelt;
        if (!as) return;

        const smelted = as.total - as.remaining;

        // Update status text
        const statusText = document.getElementById('smelting-status-text');
        if (statusText) {
            statusText.textContent = `Smelting... ${smelted} / ${as.total}`;
        }

        // Update bars counter
        const barsValue = document.getElementById('smelting-bars-value');
        if (barsValue) {
            barsValue.textContent = `${smelted} / ${as.total}`;
        }
    }

    stopSmelting(message = null) {
        if (!this.smelter) return;

        this.smelter.isSmelting = false;
        this.smelter.autoSmelt = null;
        this.smelter.playerStartPos = null;

        // Hide popups
        const smeltingPopup = document.getElementById('smelting-popup');
        const selectionPopup = document.getElementById('smelting-selection');
        smeltingPopup?.classList.remove('visible');
        selectionPopup?.classList.remove('visible');

        // Reset progress bar
        const progressFill = document.getElementById('smelting-progress-fill');
        if (progressFill) {
            progressFill.style.width = '0%';
        }

        if (message) {
            this.showSmeltingMessage(message);
        }
    }

    showSmeltingMessage(message, rarity = 'common') {
        const msgEl = document.getElementById('smelting-message');
        if (msgEl) {
            msgEl.textContent = message;
            msgEl.className = `rarity-${rarity}`;
            msgEl.classList.add('visible');
            setTimeout(() => msgEl.classList.remove('visible'), 2500);
        }
    }

    // ==================== ANVIL SYSTEM ====================

    createAnvil(config) {
        const { position } = config;
        const anvilGroup = new THREE.Group();
        anvilGroup.position.set(position.x, 0, position.z);

        // Anvil base (block)
        const baseGeo = new THREE.BoxGeometry(1.2, 0.6, 0.8);
        const anvilMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
        const base = new THREE.Mesh(baseGeo, anvilMat);
        base.position.y = 0.3;
        base.castShadow = true;
        base.receiveShadow = true;
        anvilGroup.add(base);

        // Anvil top (wider working surface)
        const topGeo = new THREE.BoxGeometry(1.8, 0.4, 1.0);
        const top = new THREE.Mesh(topGeo, anvilMat);
        top.position.y = 0.8;
        top.castShadow = true;
        anvilGroup.add(top);

        // Anvil horn (pointy end)
        const hornGeo = new THREE.ConeGeometry(0.3, 0.8, 8);
        const horn = new THREE.Mesh(hornGeo, anvilMat);
        horn.rotation.z = Math.PI / 2;
        horn.position.set(1.2, 0.8, 0);
        horn.castShadow = true;
        anvilGroup.add(horn);

        // Workbench/table
        const tableLegGeo = new THREE.BoxGeometry(0.15, 0.8, 0.15);
        const tableMat = new THREE.MeshLambertMaterial({ color: 0x4a3520 });
        const positions = [[-0.8, -0.6], [0.8, -0.6], [-0.8, 0.6], [0.8, 0.6]];
        for (const [x, z] of positions) {
            const leg = new THREE.Mesh(tableLegGeo, tableMat);
            leg.position.set(x + 2.5, 0.4, z);
            anvilGroup.add(leg);
        }
        const tableTopGeo = new THREE.BoxGeometry(2.0, 0.15, 1.5);
        const tableTop = new THREE.Mesh(tableTopGeo, tableMat);
        tableTop.position.set(2.5, 0.85, 0);
        tableTop.castShadow = true;
        anvilGroup.add(tableTop);

        // Hammer on table
        const hammerHeadGeo = new THREE.BoxGeometry(0.25, 0.2, 0.4);
        const hammerMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
        const hammerHead = new THREE.Mesh(hammerHeadGeo, hammerMat);
        hammerHead.position.set(2.2, 1.0, 0.3);
        anvilGroup.add(hammerHead);

        const hammerHandleGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8);
        const handleMat = new THREE.MeshLambertMaterial({ color: 0x6b4423 });
        const hammerHandle = new THREE.Mesh(hammerHandleGeo, handleMat);
        hammerHandle.rotation.z = Math.PI / 2;
        hammerHandle.position.set(2.5, 1.0, 0.3);
        anvilGroup.add(hammerHandle);

        this.scene.add(anvilGroup);

        // Store anvil info
        this.anvil = {
            position: position,
            mesh: anvilGroup,
            interactionRange: 5,
            isForging: false,
            forgeState: null,
            playerStartPos: null
        };
    }

    updateAnvil(deltaTime) {
        if (!this.anvil || !this.player) return;

        const dx = this.player.position.x - this.anvil.position.x;
        const dz = this.player.position.z - this.anvil.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        // Check if near anvil
        this.anvil.isNearAnvil = distance < this.anvil.interactionRange;

        // Cancel forging if player moves away
        if (this.anvil.isForging) {
            const startPos = this.anvil.playerStartPos;
            const movedDistance = Math.sqrt(
                Math.pow(this.player.position.x - startPos.x, 2) +
                Math.pow(this.player.position.z - startPos.z, 2)
            );
            if (movedDistance > 1.5) {
                this.stopAnvilForging('Moved away from anvil');
            }
        }

        // Show/hide prompt
        const anvilPrompt = document.getElementById('anvil-prompt');
        const anvilPopup = document.getElementById('anvil-popup');

        if (this.anvil.isForging) {
            anvilPrompt?.classList.remove('visible');
            // Update forging progress
            this.updateAnvilForging(deltaTime);
        } else if (this.anvil.isNearAnvil) {
            anvilPrompt?.classList.add('visible');
            anvilPopup?.classList.remove('visible');
        } else {
            anvilPrompt?.classList.remove('visible');
            anvilPopup?.classList.remove('visible');
        }
    }

    startAnvilCrafting() {
        if (!this.anvil || this.anvil.isForging) return;

        // Show recipe selection popup
        this.showAnvilSelection();
    }

    showAnvilSelection() {
        const selectionPopup = document.getElementById('anvil-selection');
        const recipeList = document.getElementById('anvil-recipe-list');
        const closeBtn = document.getElementById('anvil-selection-close');
        if (!selectionPopup || !recipeList) return;

        // Clear existing
        recipeList.innerHTML = '';

        // Get icons from itemDatabase
        const recipeIcons = {
            'copper_shortsword': '🗡️',
            'copper_dagger': '🔪',
            'iron_longsword': '⚔️',
            'gold_scepter': '🏆'
        };

        // Add recipes
        for (const recipe of this.anvilRecipes) {
            const div = document.createElement('div');
            const canCraft = this.canCraftAnvilRecipe(recipe);
            div.className = `anvil-recipe-item ${canCraft ? '' : 'disabled'}`;

            // Build materials string
            const matStrings = recipe.materials.map(m => {
                const item = ITEMS[m.itemId];
                const have = this.player.inventory?.getItemCount(m.itemId) || 0;
                const need = m.amount;
                const hasEnough = have >= need;
                return `<span class="${hasEnough ? '' : 'missing'}">${item?.name || m.itemId}: ${have}/${need}</span>`;
            });

            div.innerHTML = `
                <span class="anvil-recipe-icon">${recipeIcons[recipe.id] || '⚔️'}</span>
                <div class="anvil-recipe-info">
                    <div class="anvil-recipe-name">${recipe.name}</div>
                    <div class="anvil-recipe-cost">${matStrings.join(', ')}</div>
                </div>
            `;

            if (canCraft) {
                div.onclick = () => this.selectAnvilRecipe(recipe);
            }
            recipeList.appendChild(div);
        }

        // Setup close button
        if (closeBtn) {
            closeBtn.onclick = () => {
                selectionPopup.classList.remove('visible');
            };
        }

        selectionPopup.classList.add('visible');
    }

    canCraftAnvilRecipe(recipe) {
        if (!this.player.inventory) return false;
        for (const mat of recipe.materials) {
            const have = this.player.inventory.getItemCount(mat.itemId);
            if (have < mat.amount) return false;
        }
        return true;
    }

    selectAnvilRecipe(recipe) {
        if (!this.canCraftAnvilRecipe(recipe)) return;

        // Hide selection popup
        const selectionPopup = document.getElementById('anvil-selection');
        selectionPopup?.classList.remove('visible');

        // Remove materials
        for (const mat of recipe.materials) {
            this.player.inventory.removeItemById(mat.itemId, mat.amount);
        }

        // Start forging
        this.anvil.isForging = true;
        this.anvil.playerStartPos = {
            x: this.player.position.x,
            z: this.player.position.z
        };
        this.anvil.forgeState = {
            recipe: recipe,
            timer: 0,
            craftTime: recipe.craftTime
        };

        // Face the anvil
        const dx = this.anvil.position.x - this.player.position.x;
        const dz = this.anvil.position.z - this.player.position.z;
        this.player.rotation = Math.atan2(dx, dz);

        // Show forging popup
        const anvilPopup = document.getElementById('anvil-popup');
        const itemIcon = document.getElementById('anvil-item-icon');
        const itemName = document.getElementById('anvil-item-name');

        const recipeIcons = {
            'copper_shortsword': '🗡️',
            'copper_dagger': '🔪',
            'iron_longsword': '⚔️',
            'gold_scepter': '🏆'
        };

        if (itemIcon) itemIcon.textContent = recipeIcons[recipe.id] || '⚔️';
        if (itemName) itemName.textContent = recipe.name;

        anvilPopup?.classList.add('visible');
    }

    updateAnvilForging(deltaTime) {
        const state = this.anvil?.forgeState;
        if (!state) return;

        state.timer += deltaTime;

        // Update progress bar
        const progress = state.timer / state.craftTime;
        const progressFill = document.getElementById('anvil-progress-fill');
        if (progressFill) {
            progressFill.style.width = `${Math.min(progress * 100, 100)}%`;
        }

        // Update status text
        const statusText = document.getElementById('anvil-status-text');
        if (statusText) {
            const remaining = Math.ceil(state.craftTime - state.timer);
            statusText.textContent = `Forging... ${remaining}s remaining`;
        }

        // Check if done
        if (state.timer >= state.craftTime) {
            // Add crafted item
            if (this.player?.inventory) {
                this.player.inventory.addItemById(state.recipe.id, 1);
            }

            this.stopAnvilForging();
            this.showAnvilMessage(`Forged ${state.recipe.name}!`, 'uncommon');

            // Auto-save after forging
            this.autoSave();
        }
    }

    stopAnvilForging(message = null) {
        if (!this.anvil) return;

        this.anvil.isForging = false;
        this.anvil.forgeState = null;
        this.anvil.playerStartPos = null;

        // Hide popups
        const anvilPopup = document.getElementById('anvil-popup');
        const selectionPopup = document.getElementById('anvil-selection');
        anvilPopup?.classList.remove('visible');
        selectionPopup?.classList.remove('visible');

        // Reset progress bar
        const progressFill = document.getElementById('anvil-progress-fill');
        if (progressFill) {
            progressFill.style.width = '0%';
        }

        if (message) {
            this.showAnvilMessage(message);
        }
    }

    showAnvilMessage(message, rarity = 'common') {
        const msgEl = document.getElementById('anvil-message');
        if (msgEl) {
            msgEl.textContent = message;
            msgEl.className = `rarity-${rarity}`;
            msgEl.classList.add('visible');
            setTimeout(() => msgEl.classList.remove('visible'), 2500);
        }
    }

    // ========================================
    // CHOPPING SYSTEM
    // ========================================

    updateTrees(deltaTime) {
        if (!this.trees || !this.player) return;

        const dx = this.player.position.x - this.trees.position.x;
        const dz = this.player.position.z - this.trees.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        // Check if near trees
        this.trees.isNearTrees = distance < this.trees.interactionRange;

        // Cancel chopping if player moves away
        if (this.trees.isChopping) {
            const startPos = this.trees.playerStartPos;
            const movedDistance = Math.sqrt(
                Math.pow(this.player.position.x - startPos.x, 2) +
                Math.pow(this.player.position.z - startPos.z, 2)
            );
            if (movedDistance > 1.5) {
                this.stopChopping('Moved away from trees');
            }
        }

        // Show/hide prompt
        const choppingPrompt = document.getElementById('chopping-prompt');
        const choppingPopup = document.getElementById('chopping-popup');

        if (this.trees.isChopping) {
            choppingPrompt?.classList.remove('visible');

            // Update chopping minigame
            this.updateChoppingMinigame(deltaTime);
        } else if (this.trees.isNearTrees) {
            choppingPrompt?.classList.add('visible');
            choppingPopup?.classList.remove('visible');
        } else {
            choppingPrompt?.classList.remove('visible');
            choppingPopup?.classList.remove('visible');
        }
    }

    startChopping() {
        if (!this.trees || this.trees.isChopping) return;

        // Show wood selection popup
        this.showWoodSelection();
    }

    showWoodSelection() {
        const selectionPopup = document.getElementById('chopping-selection');
        const selectionGrid = document.getElementById('chopping-selection-grid');
        const closeBtn = document.getElementById('chopping-selection-close');
        if (!selectionPopup || !selectionGrid) return;

        // Clear existing options
        selectionGrid.innerHTML = '';

        // Add wood options
        const woodTypes = [
            { id: 'oak', name: 'Oak', icon: '🪵', rarity: 'common' },
            { id: 'birch', name: 'Birch', icon: '🪵', rarity: 'uncommon' },
            { id: 'mahogany', name: 'Mahogany', icon: '🪵', rarity: 'rare' }
        ];

        for (const wood of woodTypes) {
            if (this.trees.wood[wood.id] > 0) {
                const div = document.createElement('div');
                div.className = `chopping-wood-option rarity-${wood.rarity}`;
                div.dataset.woodId = wood.id;
                div.innerHTML = `
                    <span class="wood-icon">${wood.icon}</span>
                    <span class="wood-name">${wood.name}</span>
                `;
                div.onclick = () => this.selectWoodToChop(wood.id);
                selectionGrid.appendChild(div);
            }
        }

        // Setup close button
        if (closeBtn) {
            closeBtn.onclick = () => {
                selectionPopup.classList.remove('visible');
            };
        }

        selectionPopup.classList.add('visible');
    }

    selectWoodToChop(woodId) {
        // Hide selection popup
        const selectionPopup = document.getElementById('chopping-selection');
        selectionPopup?.classList.remove('visible');

        // Check available wood
        const woodCount = this.trees.wood[woodId] || 0;
        if (woodCount <= 0) return;

        // Start chopping minigame
        this.trees.isChopping = true;
        this.trees.playerStartPos = {
            x: this.player.position.x,
            z: this.player.position.z
        };

        // Initialize minigame state
        this.trees.minigame = {
            woodId: woodId,
            gameTimer: 20, // 20 second game
            indicatorPos: 10, // Position as percentage (10-90)
            indicatorSpeed: 80, // Speed (percentage per second)
            indicatorDirection: 1, // 1 = right, -1 = left
            score: 0,
            combo: 0,
            maxCombo: 0,
            woodChopped: 0,
            hitsForWood: 0, // Track hits toward next wood (5 good hits = 1 wood)
            choppedWoodList: [] // Track chopped wood
        };

        // Show chopping popup
        const choppingPopup = document.getElementById('chopping-popup');
        choppingPopup?.classList.add('visible');

        // Reset UI
        this.updateChoppingUI();

        const feedback = document.getElementById('chopping-feedback');
        if (feedback) feedback.textContent = '';

        const timeRemaining = document.getElementById('chopping-time-remaining');
        if (timeRemaining) {
            timeRemaining.textContent = '20';
            timeRemaining.classList.remove('warning', 'danger');
        }
    }

    updateChoppingMinigame(deltaTime) {
        const mg = this.trees?.minigame;
        if (!mg) return;

        // Update game timer
        mg.gameTimer -= deltaTime;

        // Update timer display
        const timeEl = document.getElementById('chopping-time-remaining');
        if (timeEl) {
            const seconds = Math.ceil(mg.gameTimer);
            timeEl.textContent = Math.max(0, seconds).toString();

            if (seconds <= 5) {
                timeEl.classList.add('danger');
                timeEl.classList.remove('warning');
            } else if (seconds <= 10) {
                timeEl.classList.add('warning');
                timeEl.classList.remove('danger');
            } else {
                timeEl.classList.remove('warning', 'danger');
            }
        }

        // Check if game over
        if (mg.gameTimer <= 0) {
            this.endChoppingMinigame();
            return;
        }

        // Move indicator back and forth
        mg.indicatorPos += mg.indicatorSpeed * mg.indicatorDirection * deltaTime;

        // Bounce off edges
        if (mg.indicatorPos >= 90) {
            mg.indicatorPos = 90;
            mg.indicatorDirection = -1;
        } else if (mg.indicatorPos <= 10) {
            mg.indicatorPos = 10;
            mg.indicatorDirection = 1;
        }

        // Update indicator position
        const indicator = document.getElementById('chopping-indicator');
        if (indicator) {
            indicator.style.left = `${mg.indicatorPos}%`;
        }
    }

    // Handle chopping swing (SPACE key)
    handleChoppingSwing() {
        const mg = this.trees?.minigame;
        if (!mg || mg.gameTimer <= 0) return;

        // Calculate distance from center (sweet spot is at 50%)
        const distanceFromCenter = Math.abs(mg.indicatorPos - 50);

        const feedback = document.getElementById('chopping-feedback');
        let rating = '';
        let points = 0;

        // Determine hit quality based on distance from center
        if (distanceFromCenter <= 8) {
            // Perfect hit (within 8% of center)
            rating = 'PERFECT!';
            points = 200;
            mg.combo++;
            mg.hitsForWood += 2; // Perfect counts as 2 hits
            if (feedback) {
                feedback.textContent = rating;
                feedback.className = 'perfect';
            }
        } else if (distanceFromCenter <= 15) {
            // Great hit
            rating = 'Great!';
            points = 150;
            mg.combo++;
            mg.hitsForWood += 1.5;
            if (feedback) {
                feedback.textContent = rating;
                feedback.className = 'great';
            }
        } else if (distanceFromCenter <= 25) {
            // Good hit
            rating = 'Good';
            points = 100;
            mg.combo++;
            mg.hitsForWood += 1;
            if (feedback) {
                feedback.textContent = rating;
                feedback.className = 'good';
            }
        } else {
            // Miss
            rating = 'Miss!';
            points = 0;
            mg.combo = 0;
            if (feedback) {
                feedback.textContent = rating;
                feedback.className = 'miss';
            }
        }

        // Apply combo multiplier
        mg.maxCombo = Math.max(mg.maxCombo, mg.combo);
        const comboMultiplier = 1 + (mg.combo * 0.1);
        points = Math.floor(points * comboMultiplier);
        mg.score += points;

        // Check if earned wood (every 5 hits worth)
        if (mg.hitsForWood >= 5) {
            mg.woodChopped++;
            mg.hitsForWood -= 5;

            // Add wood to inventory immediately
            const woodItemMap = {
                'oak': 'wood_oak',
                'birch': 'wood_birch',
                'mahogany': 'wood_mahogany'
            };
            const woodItemId = woodItemMap[mg.woodId];
            if (woodItemId && this.player.inventory) {
                this.player.inventory.addItemById(woodItemId, 1);
            }

            // Decrease tree wood count
            if (this.trees.wood[mg.woodId] > 0) {
                this.trees.wood[mg.woodId]--;
            }

            mg.choppedWoodList.push(mg.woodId);
        }

        // Speed up indicator slightly with each hit (makes it harder)
        if (points > 0) {
            mg.indicatorSpeed = Math.min(150, mg.indicatorSpeed + 2);
        }

        // Update UI
        this.updateChoppingUI();

        // Clear feedback after a moment
        setTimeout(() => {
            if (feedback && feedback.textContent === rating) {
                feedback.textContent = '';
            }
        }, 400);
    }

    updateChoppingUI() {
        const mg = this.trees?.minigame;
        if (!mg) return;

        const woodValue = document.getElementById('chopping-wood-value');
        if (woodValue) {
            woodValue.textContent = mg.woodChopped.toString();
        }

        const comboValue = document.getElementById('chopping-combo-value');
        if (comboValue) {
            comboValue.textContent = mg.combo.toString();
            if (mg.combo >= 10) {
                comboValue.classList.add('high');
            } else {
                comboValue.classList.remove('high');
            }
        }

        const scoreValue = document.getElementById('chopping-score-value');
        if (scoreValue) {
            scoreValue.textContent = mg.score.toString();
        }

        const statusText = document.getElementById('chopping-status-text');
        if (statusText) {
            const woodName = mg.woodId.charAt(0).toUpperCase() + mg.woodId.slice(1);
            statusText.textContent = `Chopping ${woodName}...`;
        }
    }

    endChoppingMinigame() {
        const mg = this.trees?.minigame;
        if (!mg) return;

        const woodChopped = mg.woodChopped;
        const finalScore = mg.score;
        const maxCombo = mg.maxCombo;
        const woodId = mg.woodId;
        const woodName = woodId.charAt(0).toUpperCase() + woodId.slice(1);

        // Stop chopping
        this.trees.isChopping = false;
        this.trees.minigame = null;
        this.trees.playerStartPos = null;

        // Hide popup
        const choppingPopup = document.getElementById('chopping-popup');
        choppingPopup?.classList.remove('visible');

        // Show summary message
        const rarity = woodId === 'mahogany' ? 'rare' : woodId === 'birch' ? 'uncommon' : 'common';
        const message = woodChopped > 0
            ? `Time's up! Chopped: ${woodChopped} ${woodName} Wood | Score: ${finalScore}`
            : `Time's up! No wood chopped | Score: ${finalScore}`;

        this.showChoppingMessage(message, woodChopped >= 5 ? 'rare' : woodChopped >= 3 ? 'uncommon' : 'common');
    }

    stopChopping(message = null) {
        if (!this.trees) return;

        this.trees.isChopping = false;
        this.trees.minigame = null;
        this.trees.playerStartPos = null;

        // Hide popups
        const choppingPopup = document.getElementById('chopping-popup');
        const selectionPopup = document.getElementById('chopping-selection');
        choppingPopup?.classList.remove('visible');
        selectionPopup?.classList.remove('visible');

        if (message) {
            this.showChoppingMessage(message);
        }
    }

    showChoppingMessage(message, rarity = 'common') {
        const msgEl = document.getElementById('chopping-message');
        if (msgEl) {
            msgEl.textContent = message;
            msgEl.className = `rarity-${rarity}`;
            msgEl.classList.add('visible');
            const displayTime = message.includes('Time') ? 4000 : 2500;
            setTimeout(() => msgEl.classList.remove('visible'), displayTime);
        }
    }

    // ========================================
    // CRAFTING SYSTEM
    // ========================================

    updateCraftingBench(deltaTime) {
        if (!this.craftingBench || !this.player) return;

        const dx = this.player.position.x - this.craftingBench.position.x;
        const dz = this.player.position.z - this.craftingBench.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        this.craftingBench.isNearBench = distance < this.craftingBench.interactionRange;

        if (this.craftingBench.isCrafting && this.craftingBench.craftingState) {
            this.updateCraftingProgress(deltaTime);
        }

        const craftingPrompt = document.getElementById('crafting-prompt');
        if (this.craftingBench.isCrafting) {
            craftingPrompt?.classList.remove('visible');
        } else if (this.craftingBench.isNearBench) {
            craftingPrompt?.classList.add('visible');
        } else {
            craftingPrompt?.classList.remove('visible');
        }
    }

    startCrafting() {
        if (!this.craftingBench || this.craftingBench.isCrafting) return;
        this.showCraftingMenu();
    }

    showCraftingMenu() {
        const selectionPopup = document.getElementById('crafting-selection');
        const recipeList = document.getElementById('crafting-recipe-list');
        const closeBtn = document.getElementById('crafting-selection-close');
        if (!selectionPopup || !recipeList) return;

        recipeList.innerHTML = '';

        for (const recipe of this.craftingRecipes) {
            const itemDef = ITEMS[recipe.id];
            if (!itemDef) continue;

            const canCraft = this.canCraftRecipe(recipe);
            const materialText = this.getMaterialText(recipe);

            const div = document.createElement('div');
            div.className = `crafting-recipe ${canCraft ? '' : 'cannot-craft'}`;
            div.innerHTML = `
                <div class="recipe-icon">${getItemIcon({ icon: itemDef.icon })}</div>
                <div class="recipe-info">
                    <div class="recipe-name">${itemDef.name}</div>
                    <div class="recipe-materials">${materialText}</div>
                    ${itemDef.stats ? `<div class="recipe-stats">${this.formatStats(itemDef.stats)}</div>` : ''}
                </div>
            `;
            if (canCraft) div.onclick = () => this.craftItem(recipe);
            recipeList.appendChild(div);
        }

        if (closeBtn) closeBtn.onclick = () => selectionPopup.classList.remove('visible');
        selectionPopup.classList.add('visible');
    }

    canCraftRecipe(recipe) {
        if (!this.player?.inventory) return false;
        for (const mat of recipe.materials) {
            if (this.player.inventory.countItem(mat.itemId) < mat.amount) return false;
        }
        return true;
    }

    getMaterialText(recipe) {
        return recipe.materials.map(mat => {
            const itemDef = ITEMS[mat.itemId];
            const name = itemDef ? itemDef.name : mat.itemId;
            const have = this.player?.inventory?.countItem(mat.itemId) || 0;
            const cls = have >= mat.amount ? 'has-material' : 'missing-material';
            return `<span class="${cls}">${name} (${have}/${mat.amount})</span>`;
        }).join(' + ');
    }

    formatStats(stats) {
        const parts = [];
        if (stats.damage) parts.push(`+${stats.damage} Damage`);
        if (stats.magicPower) parts.push(`+${stats.magicPower} Magic`);
        if (stats.attackSpeed) parts.push(`+${stats.attackSpeed} Speed`);
        if (stats.defense) parts.push(`+${stats.defense} Defense`);
        return parts.join(', ');
    }

    craftItem(recipe) {
        if (!this.canCraftRecipe(recipe)) return;

        document.getElementById('crafting-selection')?.classList.remove('visible');

        for (const mat of recipe.materials) {
            this.player.inventory.removeItemById(mat.itemId, mat.amount);
        }

        this.craftingBench.isCrafting = true;
        this.craftingBench.craftingState = { recipe, progress: 0, craftTime: recipe.craftTime };

        const itemDef = ITEMS[recipe.id];
        const itemIcon = document.getElementById('crafting-item-icon');
        const itemName = document.getElementById('crafting-item-name');
        const progressFill = document.getElementById('crafting-progress-fill');
        if (itemIcon) itemIcon.textContent = getItemIcon({ icon: itemDef?.icon });
        if (itemName) itemName.textContent = itemDef?.name || recipe.name;
        if (progressFill) progressFill.style.width = '0%';

        document.getElementById('crafting-popup')?.classList.add('visible');
    }

    updateCraftingProgress(deltaTime) {
        const state = this.craftingBench.craftingState;
        if (!state) return;

        state.progress += deltaTime;
        const progressFill = document.getElementById('crafting-progress-fill');
        if (progressFill) progressFill.style.width = `${Math.min(100, (state.progress / state.craftTime) * 100)}%`;

        if (state.progress >= state.craftTime) this.completeCrafting();
    }

    completeCrafting() {
        const state = this.craftingBench.craftingState;
        if (!state) return;

        const itemDef = ITEMS[state.recipe.id];
        if (this.player?.inventory) this.player.inventory.addItemById(state.recipe.id, 1);

        this.craftingBench.isCrafting = false;
        this.craftingBench.craftingState = null;

        document.getElementById('crafting-popup')?.classList.remove('visible');
        this.showCraftingMessage(`Crafted: ${itemDef?.name || state.recipe.name}!`, 'uncommon');

        // Auto-save after crafting
        this.autoSave();
    }

    stopCrafting(message = null) {
        if (!this.craftingBench) return;
        this.craftingBench.isCrafting = false;
        this.craftingBench.craftingState = null;
        document.getElementById('crafting-popup')?.classList.remove('visible');
        document.getElementById('crafting-selection')?.classList.remove('visible');
        if (message) this.showCraftingMessage(message);
    }

    showCraftingMessage(message, rarity = 'common') {
        const msgEl = document.getElementById('crafting-message');
        if (msgEl) {
            msgEl.textContent = message;
            msgEl.className = `rarity-${rarity}`;
            msgEl.classList.add('visible');
            setTimeout(() => msgEl.classList.remove('visible'), 2500);
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

    // Screen flash effect for damage/heal feedback
    addScreenFlash(type = 'damage') {
        const flashElement = document.getElementById('screen-flash');
        if (!flashElement) return;

        // Remove existing animation classes
        flashElement.classList.remove('damage', 'heal', 'critical');

        // Force reflow to restart animation
        void flashElement.offsetWidth;

        // Add the appropriate class
        flashElement.classList.add(type);

        // Remove class after animation completes
        setTimeout(() => {
            flashElement.classList.remove(type);
        }, type === 'heal' ? 400 : type === 'critical' ? 350 : 250);
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
        if (this.gameMode === 'adventure') {
            // Adventure mode starting zone
            this.minimapBounds = { minX: -35, maxX: 35, minZ: -15, maxZ: 40 };
        } else if (this.gameMode === 'horde') {
            // Winding dungeon bounds (extended for fishing lake and mine)
            this.minimapBounds = { minX: -50, maxX: 110, minZ: -55, maxZ: 150 };
        } else {
            // Standard dungeon/boss bounds
            this.minimapBounds = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };
        }
    }

    // Update minimap each frame
    updateMinimap() {
        if (!this.minimapCtx || !this.minimapCanvas || !this.player) return;

        const ctx = this.minimapCtx;
        const canvas = this.minimapCanvas;

        // Clear
        ctx.fillStyle = 'rgba(20, 20, 35, 0.9)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Player-centered minimap with fixed viewport size
        const viewportSize = 50; // World units visible in each direction
        const scale = (canvas.width / 2) / viewportSize;
        const offsetX = canvas.width / 2;
        const offsetY = canvas.height / 2;
        const centerX = this.player.position.x;
        const centerZ = this.player.position.z;

        // Helper to convert world coords to minimap coords (centered on player)
        const toMinimap = (x, z) => ({
            x: offsetX + (x - centerX) * scale,
            y: offsetY + (z - centerZ) * scale
        });

        // Draw floor areas (simplified rectangles)
        ctx.fillStyle = 'rgba(60, 60, 80, 0.5)';
        if (this.gameMode === 'adventure') {
            // Draw grassy starting zone
            ctx.fillStyle = 'rgba(61, 107, 61, 0.6)';
            const groundPos = toMinimap(-30, -10);
            ctx.fillRect(groundPos.x, groundPos.y, 60 * scale, 50 * scale);

            // Draw dirt path
            ctx.fillStyle = 'rgba(107, 90, 61, 0.7)';
            const pathPos = toMinimap(-2, -5);
            ctx.fillRect(pathPos.x, pathPos.y, 4 * scale, 30 * scale);

            // Draw NPCs (yellow dots)
            ctx.fillStyle = '#ffcc00';
            for (const npc of this.npcs) {
                const npcPos = toMinimap(npc.position.x, npc.position.z);
                ctx.beginPath();
                ctx.arc(npcPos.x, npcPos.y, 5, 0, Math.PI * 2);
                ctx.fill();
                // Quest indicator
                const quest = this.quests[npc.quest?.id];
                if (quest && (quest.status === 'available' || (quest.status === 'active' && this.isQuestComplete(quest)))) {
                    ctx.fillStyle = '#ffff00';
                    ctx.font = 'bold 10px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('!', npcPos.x, npcPos.y - 8);
                }
            }

            // Draw ore node
            if (this.mine) {
                ctx.fillStyle = '#b87333'; // Copper color
                const orePos = toMinimap(this.mine.position.x, this.mine.position.z);
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('⛏', orePos.x, orePos.y);
            }

            // Draw tree area
            if (this.trees) {
                ctx.fillStyle = '#44aa44';
                const treePos = toMinimap(this.trees.position.x, this.trees.position.z);
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('🌲', treePos.x, treePos.y);
            }

            // Draw crafting bench
            if (this.craftingBench) {
                ctx.fillStyle = '#ddaa66';
                const craftPos = toMinimap(this.craftingBench.position.x, this.craftingBench.position.z);
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('🔨', craftPos.x, craftPos.y);
            }

            // Draw smelter
            if (this.smelter) {
                ctx.fillStyle = '#ff6600';
                const smelterPos = toMinimap(this.smelter.position.x, this.smelter.position.z);
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('🔶', smelterPos.x, smelterPos.y);
            }

            // Draw anvil
            if (this.anvil) {
                ctx.fillStyle = '#888899';
                const anvilPos = toMinimap(this.anvil.position.x, this.anvil.position.z);
                ctx.font = 'bold 11px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('⚒️', anvilPos.x, anvilPos.y);
            }

            // Draw quest objective markers
            for (const questId in this.quests) {
                const quest = this.quests[questId];
                if (quest.status === 'active' && quest.objectives) {
                    for (const obj of quest.objectives) {
                        if (obj.location && !obj.completed) {
                            ctx.fillStyle = '#ffff00';
                            const objPos = toMinimap(obj.location.x, obj.location.z);
                            ctx.beginPath();
                            ctx.arc(objPos.x, objPos.y, 4, 0, Math.PI * 2);
                            ctx.fill();
                            ctx.strokeStyle = '#ffaa00';
                            ctx.lineWidth = 1;
                            ctx.stroke();
                        }
                    }
                }
            }
        } else if (this.gameMode === 'horde') {
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
                { x: -35, z: -5, w: 18, h: 18 },
                // Mine corridor and chamber
                { x: 0, z: -25, w: 12, h: 15 },
                { x: 0, z: -42, w: 20, h: 20 }
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

            // Draw campfire area on minimap
            if (this.campfire) {
                // Draw campfire clearing
                ctx.fillStyle = 'rgba(80, 50, 30, 0.5)';
                const campPos = toMinimap(this.campfire.position.x - 5, this.campfire.position.z - 5);
                ctx.fillRect(campPos.x, campPos.y, 10 * scale, 10 * scale);

                // Draw campfire icon
                ctx.fillStyle = '#ff6622';
                const firePos = toMinimap(this.campfire.position.x, this.campfire.position.z);
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('🔥', firePos.x, firePos.y);
            }

            // Draw mine area on minimap
            if (this.mine) {
                // Draw mine chamber
                ctx.fillStyle = 'rgba(60, 60, 70, 0.6)';
                const minePos = toMinimap(this.mine.position.x - 10, this.mine.position.z - 10);
                ctx.fillRect(minePos.x, minePos.y, 20 * scale, 20 * scale);

                // Draw mine icon
                ctx.fillStyle = '#aabbcc';
                const pickPos = toMinimap(this.mine.position.x, this.mine.position.z);
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('⛏', pickPos.x, pickPos.y);
            }

            // Draw tree area on minimap
            if (this.trees) {
                // Draw forest area
                ctx.fillStyle = 'rgba(34, 80, 34, 0.6)';
                const treeAreaPos = toMinimap(this.trees.position.x - 10, this.trees.position.z - 10);
                ctx.fillRect(treeAreaPos.x, treeAreaPos.y, 20 * scale, 20 * scale);

                // Draw tree icon
                ctx.fillStyle = '#44aa44';
                const treeIconPos = toMinimap(this.trees.position.x, this.trees.position.z);
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('🌲', treeIconPos.x, treeIconPos.y);
            }

            // Draw crafting bench on minimap
            if (this.craftingBench) {
                // Draw workshop area
                ctx.fillStyle = 'rgba(100, 80, 50, 0.6)';
                const craftAreaPos = toMinimap(this.craftingBench.position.x - 8, this.craftingBench.position.z - 8);
                ctx.fillRect(craftAreaPos.x, craftAreaPos.y, 16 * scale, 16 * scale);

                // Draw crafting icon
                ctx.fillStyle = '#ddaa66';
                const craftIconPos = toMinimap(this.craftingBench.position.x, this.craftingBench.position.z);
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('🔨', craftIconPos.x, craftIconPos.y);
            }

            // Draw smelter on minimap
            if (this.smelter) {
                // Draw forge area
                ctx.fillStyle = 'rgba(80, 40, 20, 0.6)';
                const smelterAreaPos = toMinimap(this.smelter.position.x - 6, this.smelter.position.z - 6);
                ctx.fillRect(smelterAreaPos.x, smelterAreaPos.y, 12 * scale, 12 * scale);

                // Draw smelter icon (anvil)
                ctx.fillStyle = '#ff6600';
                const smelterIconPos = toMinimap(this.smelter.position.x, this.smelter.position.z);
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('🔶', smelterIconPos.x, smelterIconPos.y);
            }

            // Draw anvil on minimap
            if (this.anvil) {
                // Draw anvil area
                ctx.fillStyle = 'rgba(50, 50, 60, 0.6)';
                const anvilAreaPos = toMinimap(this.anvil.position.x - 4, this.anvil.position.z - 4);
                ctx.fillRect(anvilAreaPos.x, anvilAreaPos.y, 8 * scale, 8 * scale);

                // Draw anvil icon
                ctx.fillStyle = '#888899';
                const anvilIconPos = toMinimap(this.anvil.position.x, this.anvil.position.z);
                ctx.font = 'bold 11px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('⚒️', anvilIconPos.x, anvilIconPos.y);
            }

            // Draw quest objective markers (horde mode)
            for (const questId in this.quests) {
                const quest = this.quests[questId];
                if (quest.status === 'active' && quest.objectives) {
                    for (const obj of quest.objectives) {
                        if (obj.location && !obj.completed) {
                            ctx.fillStyle = '#ffff00';
                            const objPos = toMinimap(obj.location.x, obj.location.z);
                            ctx.beginPath();
                            ctx.arc(objPos.x, objPos.y, 4, 0, Math.PI * 2);
                            ctx.fill();
                            ctx.strokeStyle = '#ffaa00';
                            ctx.lineWidth = 1;
                            ctx.stroke();
                        }
                    }
                }
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
            // Right wall split for campfire corridor
            { x1: 12, z1: -15, x2: 12, z2: -12 },      // Right wall bottom section
            { x1: 12, z1: 3, x2: 12, z2: 0 },          // Right wall top section (gap from z=-12 to z=3)
            // Back wall split for mine corridor (gap from x=-6 to x=6)
            { x1: -12, z1: -15, x2: -6, z2: -15 },     // Back wall left section
            { x1: 6, z1: -15, x2: 12, z2: -15 },       // Back wall right section

            // Mine corridor walls (x=-6 to 6, z=-15 to -32)
            { x1: -6, z1: -15, x2: -6, z2: -32 },      // Corridor left wall
            { x1: 6, z1: -15, x2: 6, z2: -32 },        // Corridor right wall
            // Mine chamber walls (x=-10 to 10, z=-32 to -52)
            { x1: -6, z1: -32, x2: -10, z2: -32 },     // Chamber entrance left
            { x1: 6, z1: -32, x2: 10, z2: -32 },       // Chamber entrance right
            { x1: -10, z1: -32, x2: -10, z2: -52 },    // Chamber left wall
            { x1: 10, z1: -32, x2: 10, z2: -52 },      // Chamber right wall
            { x1: -10, z1: -52, x2: 10, z2: -52 },     // Chamber back wall

            // Fishing lake area walls
            { x1: -12, z1: -12, x2: -27, z2: -12 },    // Corridor bottom wall
            { x1: -12, z1: 3, x2: -27, z2: 3 },        // Corridor top wall
            { x1: -27, z1: -14, x2: -44, z2: -14 },    // Lake bottom wall
            { x1: -27, z1: 4, x2: -44, z2: 4 },        // Lake top wall
            { x1: -44, z1: -14, x2: -44, z2: 4 },      // Lake back wall

            // Campfire area walls
            { x1: 12, z1: -12, x2: 27, z2: -12 },      // Corridor bottom wall
            { x1: 12, z1: 3, x2: 27, z2: 3 },          // Corridor top wall
            { x1: 27, z1: -13, x2: 43, z2: -13 },      // Campfire bottom wall
            { x1: 27, z1: 3, x2: 43, z2: 3 },          // Campfire top wall
            { x1: 43, z1: -13, x2: 43, z2: 3 },        // Campfire back wall

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

    // ==================== ADVENTURE MODE - NPC & QUEST SYSTEM ====================

    // Create NPC with visual mesh and dialog
    async createNPC(config) {
        const npc = {
            id: config.id,
            name: config.name,
            position: new THREE.Vector3(config.position.x, 0, config.position.z),
            dialog: config.dialog,
            quests: config.quests || (config.quest ? [config.quest] : []),
            currentQuestIndex: 0,
            interactionRange: 4,
            mesh: null
        };

        const npcGroup = new THREE.Group();
        npcGroup.position.set(config.position.x, 0, config.position.z);

        // Try to load 3D model if path provided
        if (config.modelPath) {
            try {
                const loader = new GLTFLoader();
                const gltf = await new Promise((resolve, reject) => {
                    loader.load(config.modelPath, resolve, undefined, reject);
                });
                const model = gltf.scene;
                model.scale.setScalar(1.0);
                model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                npcGroup.add(model);
            } catch (e) {
                console.warn(`Failed to load NPC model: ${config.modelPath}`, e);
                // Fallback to basic geometry
                this.createBasicNPCMesh(npcGroup, config.color);
            }
        } else {
            // Use basic geometry
            this.createBasicNPCMesh(npcGroup, config.color);
        }

        // Quest indicator - starts as ! symbol sprite
        const indicatorGroup = new THREE.Group();
        indicatorGroup.position.y = 2.8;

        // Create ! indicator (yellow, quest available)
        const exclamationMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const exclamationGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.4, 8);
        const exclamation = new THREE.Mesh(exclamationGeo, exclamationMat);
        exclamation.name = 'exclamation';
        indicatorGroup.add(exclamation);

        const dotGeo = new THREE.SphereGeometry(0.1, 8, 8);
        const dot = new THREE.Mesh(dotGeo, exclamationMat);
        dot.position.y = -0.35;
        dot.name = 'exclamationDot';
        indicatorGroup.add(dot);

        // Create ? indicator (hidden initially)
        const questionMat = new THREE.MeshBasicMaterial({ color: 0x888888 });
        const questionTop = new THREE.TorusGeometry(0.15, 0.06, 8, 16, Math.PI * 1.5);
        const question = new THREE.Mesh(questionTop, questionMat);
        question.rotation.x = Math.PI / 2;
        question.rotation.z = Math.PI / 4;
        question.position.y = 0.1;
        question.name = 'question';
        question.visible = false;
        indicatorGroup.add(question);

        const questionStem = new THREE.CylinderGeometry(0.06, 0.06, 0.15, 8);
        const stem = new THREE.Mesh(questionStem, questionMat);
        stem.position.y = -0.1;
        stem.name = 'questionStem';
        stem.visible = false;
        indicatorGroup.add(stem);

        const questionDot = new THREE.Mesh(dotGeo, questionMat);
        questionDot.position.y = -0.3;
        questionDot.name = 'questionDot';
        questionDot.visible = false;
        indicatorGroup.add(questionDot);

        npcGroup.add(indicatorGroup);

        this.scene.add(npcGroup);
        npc.mesh = npcGroup;
        npc.indicatorGroup = indicatorGroup;

        this.npcs.push(npc);

        // Register all quests for this NPC
        for (const quest of npc.quests) {
            const isFirstQuest = npc.quests.indexOf(quest) === 0;
            this.quests[quest.id] = {
                ...quest,
                status: isFirstQuest ? 'available' : 'locked',
                npcId: config.id
            };
        }

        return npc;
    }

    // Create basic NPC mesh (fallback)
    createBasicNPCMesh(group, color) {
        // Body
        const bodyGeo = new THREE.CylinderGeometry(0.4, 0.5, 1.2, 8);
        const bodyMat = new THREE.MeshLambertMaterial({ color: color || 0x8b4513 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 1;
        body.castShadow = true;
        group.add(body);

        // Head
        const headGeo = new THREE.SphereGeometry(0.35, 8, 8);
        const headMat = new THREE.MeshLambertMaterial({ color: 0xd4a574 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 1.9;
        head.castShadow = true;
        group.add(head);

        // Hat
        const hatGeo = new THREE.CylinderGeometry(0.3, 0.4, 0.3, 8);
        const hatMat = new THREE.MeshLambertMaterial({ color: 0xffcc00 });
        const hat = new THREE.Mesh(hatGeo, hatMat);
        hat.position.y = 2.2;
        hat.castShadow = true;
        group.add(hat);
    }

    // Add a simple tree
    addTree(x, z) {
        const treeGroup = new THREE.Group();
        treeGroup.position.set(x, 0, z);

        // Trunk
        const trunkGeo = new THREE.CylinderGeometry(0.3, 0.4, 2, 8);
        const trunkMat = new THREE.MeshLambertMaterial({ color: 0x4a3525 });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 1;
        trunk.castShadow = true;
        treeGroup.add(trunk);

        // Leaves (cone)
        const leavesGeo = new THREE.ConeGeometry(1.5, 3, 8);
        const leavesMat = new THREE.MeshLambertMaterial({ color: 0x228b22 });
        const leaves = new THREE.Mesh(leavesGeo, leavesMat);
        leaves.position.y = 3.5;
        leaves.castShadow = true;
        treeGroup.add(leaves);

        this.scene.add(treeGroup);
    }

    // Create ore node for mining in adventure mode
    createOreNode(config) {
        const oreColors = {
            copper: 0xb87333,
            iron: 0x808080,
            gold: 0xffd700
        };

        const oreGroup = new THREE.Group();
        oreGroup.position.set(config.position.x, 0, config.position.z);

        // Rock base
        const rockGeo = new THREE.DodecahedronGeometry(1.5, 0);
        const rockMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
        const rock = new THREE.Mesh(rockGeo, rockMat);
        rock.position.y = 1;
        rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
        rock.scale.set(1.2, 0.9, 1.1);
        rock.castShadow = true;
        oreGroup.add(rock);

        // Ore veins
        const veinGeo = new THREE.DodecahedronGeometry(0.5, 0);
        const veinMat = new THREE.MeshStandardMaterial({
            color: oreColors[config.type],
            roughness: 0.3,
            metalness: 0.7,
            emissive: oreColors[config.type],
            emissiveIntensity: 0.15
        });

        for (let i = 0; i < 4; i++) {
            const vein = new THREE.Mesh(veinGeo, veinMat);
            vein.position.set(
                (Math.random() - 0.5) * 2,
                0.5 + Math.random() * 1,
                (Math.random() - 0.5) * 2
            );
            vein.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
            vein.scale.setScalar(0.4 + Math.random() * 0.4);
            oreGroup.add(vein);
        }

        this.scene.add(oreGroup);

        // Set up mine data for this node
        this.mine = {
            position: { x: config.position.x, z: config.position.z },
            mesh: oreGroup,
            interactionRange: 5,
            isMining: false,
            ores: {
                [config.type]: 99
            }
        };

        return oreGroup;
    }

    // Create tree chopping area for adventure mode
    createTreeArea(config) {
        const position = config.position;
        const treeGroup = new THREE.Group();
        treeGroup.position.set(position.x, 0, position.z);

        // Create multiple trees
        const treePositions = [
            { x: -3, z: 0 },
            { x: 3, z: 0 },
            { x: 0, z: -3 },
            { x: -2, z: 3 },
            { x: 2, z: 3 }
        ];

        for (const treePos of treePositions) {
            // Tree trunk
            const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.4, 3, 8);
            const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
            const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
            trunk.position.set(treePos.x, 1.5, treePos.z);
            trunk.castShadow = true;
            treeGroup.add(trunk);

            // Foliage
            const foliageGeometry = new THREE.ConeGeometry(1.5, 3, 8);
            const foliageMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 });
            const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
            foliage.position.set(treePos.x, 4, treePos.z);
            foliage.castShadow = true;
            treeGroup.add(foliage);

            // Second layer of foliage
            const foliage2Geometry = new THREE.ConeGeometry(1.2, 2.5, 8);
            const foliage2 = new THREE.Mesh(foliage2Geometry, foliageMaterial);
            foliage2.position.set(treePos.x, 5.5, treePos.z);
            foliage2.castShadow = true;
            treeGroup.add(foliage2);
        }

        // Add a stump with axe
        const stumpGeometry = new THREE.CylinderGeometry(0.5, 0.6, 0.5, 8);
        const stumpMaterial = new THREE.MeshStandardMaterial({ color: 0x654321 });
        const stump = new THREE.Mesh(stumpGeometry, stumpMaterial);
        stump.position.set(0, 0.25, 0);
        stump.castShadow = true;
        treeGroup.add(stump);

        // Some logs on ground
        for (let i = 0; i < 3; i++) {
            const logGeometry = new THREE.CylinderGeometry(0.15, 0.15, 1.2, 6);
            const logMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
            const log = new THREE.Mesh(logGeometry, logMaterial);
            log.rotation.z = Math.PI / 2;
            log.rotation.y = Math.random() * Math.PI;
            log.position.set(
                (Math.random() - 0.5) * 4,
                0.15,
                (Math.random() - 0.5) * 4
            );
            log.castShadow = true;
            treeGroup.add(log);
        }

        this.scene.add(treeGroup);

        // Set up trees data for this area
        this.trees = {
            position: { x: position.x, z: position.z },
            mesh: treeGroup,
            interactionRange: 8,
            isChopping: false,
            wood: {
                oak: 99,
                birch: 50,
                mahogany: 25
            }
        };

        return treeGroup;
    }

    // Create crafting bench for adventure mode
    createCraftingBench(config) {
        const position = config.position;
        const craftingGroup = new THREE.Group();
        craftingGroup.position.set(position.x, 0, position.z);

        const benchWoodMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });

        // Table top
        const tableTopGeometry = new THREE.BoxGeometry(3, 0.3, 2);
        const tableTop = new THREE.Mesh(tableTopGeometry, benchWoodMaterial);
        tableTop.position.y = 1.15;
        tableTop.castShadow = true;
        craftingGroup.add(tableTop);

        // Legs
        const legGeometry = new THREE.BoxGeometry(0.2, 1, 0.2);
        const legPositions = [
            { x: -1.2, z: -0.7 },
            { x: 1.2, z: -0.7 },
            { x: -1.2, z: 0.7 },
            { x: 1.2, z: 0.7 }
        ];

        for (const pos of legPositions) {
            const leg = new THREE.Mesh(legGeometry, benchWoodMaterial);
            leg.position.set(pos.x, 0.5, pos.z);
            leg.castShadow = true;
            craftingGroup.add(leg);
        }

        // Hammer on table
        const hammerHandleGeom = new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6);
        const hammerHandle = new THREE.Mesh(hammerHandleGeom, benchWoodMaterial);
        hammerHandle.rotation.z = Math.PI / 6;
        hammerHandle.position.set(-0.5, 1.4, 0.3);
        craftingGroup.add(hammerHandle);

        const hammerHeadGeom = new THREE.BoxGeometry(0.15, 0.25, 0.15);
        const benchMetalMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 });
        const hammerHead = new THREE.Mesh(hammerHeadGeom, benchMetalMaterial);
        hammerHead.position.set(-0.3, 1.55, 0.3);
        craftingGroup.add(hammerHead);

        // Some wood planks
        for (let i = 0; i < 3; i++) {
            const plankGeom = new THREE.BoxGeometry(0.8, 0.1, 0.15);
            const plank = new THREE.Mesh(plankGeom, benchWoodMaterial);
            plank.position.set(0.5, 1.35 + i * 0.1, -0.2 + i * 0.15);
            plank.rotation.y = Math.random() * 0.3 - 0.15;
            craftingGroup.add(plank);
        }

        // Add a light
        const craftLight = new THREE.PointLight(0xffdd88, 1.2, 15);
        craftLight.position.set(0, 3, 0);
        craftingGroup.add(craftLight);

        this.scene.add(craftingGroup);

        // Set up crafting bench data
        this.craftingBench = {
            position: { x: position.x, z: position.z },
            mesh: craftingGroup,
            interactionRange: 5,
            isCrafting: false,
            craftingState: null
        };

        return craftingGroup;
    }

    // Check if player is near an NPC
    updateNPCProximity() {
        if (!this.player || this.npcs.length === 0) return;

        const playerPos = this.player.position;
        let closestNPC = null;
        let closestDist = Infinity;

        for (const npc of this.npcs) {
            const dx = playerPos.x - npc.position.x;
            const dz = playerPos.z - npc.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < npc.interactionRange && dist < closestDist) {
                closestDist = dist;
                closestNPC = npc;
            }
        }

        // Update nearby NPC and show/hide prompt
        const npcPrompt = document.getElementById('npc-prompt');
        if (closestNPC && !this.isDialogOpen()) {
            this.nearbyNPC = closestNPC;
            npcPrompt.style.display = 'block';
        } else {
            this.nearbyNPC = null;
            npcPrompt.style.display = 'none';
        }

        // Update quest indicators
        this.updateQuestIndicators();
    }

    // Update NPC quest indicators (! for available, gray ? for in-progress, gold ? for turn-in ready)
    updateQuestIndicators() {
        for (const npc of this.npcs) {
            if (!npc.indicatorGroup) continue;

            // Find current active quest for this NPC
            let currentQuest = null;
            for (const q of (npc.quests || [])) {
                const quest = this.quests[q.id];
                if (quest && (quest.status === 'available' || quest.status === 'active')) {
                    currentQuest = quest;
                    break;
                }
            }

            // Get indicator elements
            const exclamation = npc.indicatorGroup.getObjectByName('exclamation');
            const exclamationDot = npc.indicatorGroup.getObjectByName('exclamationDot');
            const question = npc.indicatorGroup.getObjectByName('question');
            const questionStem = npc.indicatorGroup.getObjectByName('questionStem');
            const questionDot = npc.indicatorGroup.getObjectByName('questionDot');

            // Hide all by default
            if (exclamation) exclamation.visible = false;
            if (exclamationDot) exclamationDot.visible = false;
            if (question) question.visible = false;
            if (questionStem) questionStem.visible = false;
            if (questionDot) questionDot.visible = false;
            npc.indicatorGroup.visible = false;

            if (!currentQuest) continue;

            npc.indicatorGroup.visible = true;

            if (currentQuest.status === 'available') {
                // Yellow ! for available quest
                if (exclamation) {
                    exclamation.visible = true;
                    exclamation.material.color.setHex(0xffff00);
                }
                if (exclamationDot) {
                    exclamationDot.visible = true;
                    exclamationDot.material.color.setHex(0xffff00);
                }
            } else if (currentQuest.status === 'active') {
                const isComplete = this.isQuestComplete(currentQuest);
                const color = isComplete ? 0xffff00 : 0x888888; // Gold if complete, gray if not

                if (question) {
                    question.visible = true;
                    question.material.color.setHex(color);
                }
                if (questionStem) {
                    questionStem.visible = true;
                    questionStem.material.color.setHex(color);
                }
                if (questionDot) {
                    questionDot.visible = true;
                    questionDot.material.color.setHex(color);
                }
            }

            // Bobbing animation
            npc.indicatorGroup.position.y = 2.8 + Math.sin(Date.now() * 0.005) * 0.1;
        }
    }

    // Check if NPC dialog is currently open
    isDialogOpen() {
        const dialog = document.getElementById('npc-dialog');
        return dialog && dialog.style.display === 'block';
    }

    // Open dialog with NPC
    openNPCDialog(npc) {
        const dialog = document.getElementById('npc-dialog');
        const nameEl = document.getElementById('npc-name');
        const textEl = document.getElementById('npc-dialog-text');
        const optionsEl = document.getElementById('npc-dialog-options');

        nameEl.textContent = npc.name;

        // Find current active quest for this NPC
        let currentQuest = null;
        for (const q of (npc.quests || [])) {
            const quest = this.quests[q.id];
            if (quest && (quest.status === 'available' || quest.status === 'active')) {
                currentQuest = quest;
                break;
            }
        }

        // Determine dialog text and options
        let dialogText = npc.dialog.default;
        let options = [];

        if (currentQuest) {
            // Get quest-specific dialog if available
            const questDialog = currentQuest.dialog || npc.dialog;

            if (currentQuest.status === 'available') {
                dialogText = questDialog.questAvailable || npc.dialog.questAvailable;
                options.push({ text: 'Accept Quest', action: () => this.acceptQuest(currentQuest.id) });
                options.push({ text: 'Not now', action: () => this.closeNPCDialog() });
            } else if (currentQuest.status === 'active') {
                if (this.isQuestComplete(currentQuest)) {
                    dialogText = questDialog.questComplete || npc.dialog.questComplete;
                    options.push({ text: 'Complete Quest', action: () => this.turnInQuest(currentQuest.id) });
                } else {
                    dialogText = questDialog.questInProgress || npc.dialog.questInProgress;
                    const obj = currentQuest.objectives[0];
                    dialogText += ` (${obj.current}/${obj.target})`;
                    options.push({ text: 'Okay', action: () => this.closeNPCDialog() });
                }
            }
        } else {
            dialogText = npc.dialog.default || "Thanks for your help!";
            options.push({ text: 'Goodbye', action: () => this.closeNPCDialog() });
        }

        textEl.textContent = dialogText;

        // Clear and add options
        optionsEl.innerHTML = '';
        for (const opt of options) {
            const btn = document.createElement('button');
            btn.className = 'dialog-option';
            btn.textContent = opt.text;
            btn.onclick = opt.action;
            optionsEl.appendChild(btn);
        }

        dialog.style.display = 'block';

        // Close button
        document.getElementById('npc-dialog-close').onclick = () => this.closeNPCDialog();
    }

    // Close NPC dialog
    closeNPCDialog() {
        document.getElementById('npc-dialog').style.display = 'none';
    }

    // Accept a quest
    acceptQuest(questId) {
        const quest = this.quests[questId];
        if (!quest || quest.status !== 'available') return;

        quest.status = 'active';
        this.activeQuests.push(questId);

        // Update quest tracker UI
        this.updateQuestTrackerUI();

        this.closeNPCDialog();
    }

    // Check if quest objectives are complete
    isQuestComplete(quest) {
        if (!quest || !quest.objectives) return false;

        for (const obj of quest.objectives) {
            if (obj.type === 'collect') {
                const count = this.player?.inventory?.getItemCount(obj.itemId) || 0;
                obj.current = count;
                if (count < obj.target) return false;
            }
        }
        return true;
    }

    // Turn in a completed quest
    turnInQuest(questId) {
        const quest = this.quests[questId];
        if (!quest || quest.status !== 'active') return;
        if (!this.isQuestComplete(quest)) return;

        // Remove required items (unless quest has keepItems flag)
        if (!quest.keepItems) {
            for (const obj of quest.objectives) {
                if (obj.type === 'collect') {
                    this.player.inventory.removeItemById(obj.itemId, obj.target);
                }
            }
        }

        // Give rewards
        if (quest.rewards) {
            if (quest.rewards.gold) {
                this.player.inventory.addGold(quest.rewards.gold);
            }
            for (const itemId of (quest.rewards.items || [])) {
                this.player.inventory.addItemById(itemId, 1);
            }
        }

        quest.status = 'turned_in';
        this.activeQuests = this.activeQuests.filter(id => id !== questId);

        // Unlock next quest if specified
        if (quest.nextQuestId && this.quests[quest.nextQuestId]) {
            this.quests[quest.nextQuestId].status = 'available';
        }

        // Update UI
        this.updateQuestTrackerUI();

        this.closeNPCDialog();

        // Auto-save after completing quest
        this.autoSave();
    }

    // Update quest tracker UI
    updateQuestTrackerUI() {
        const listEl = document.getElementById('quest-tracker-list');
        if (!listEl) return;

        listEl.innerHTML = '';

        for (const questId of this.activeQuests) {
            const quest = this.quests[questId];
            if (!quest) continue;

            const questEl = document.createElement('div');
            questEl.className = 'quest-item';

            const nameEl = document.createElement('div');
            nameEl.className = 'quest-name';
            nameEl.textContent = quest.name;
            questEl.appendChild(nameEl);

            for (const obj of quest.objectives) {
                const objEl = document.createElement('div');
                objEl.className = 'quest-objective';

                if (obj.type === 'collect') {
                    const count = this.player?.inventory?.getItemCount(obj.itemId) || 0;
                    obj.current = count;
                    const complete = count >= obj.target;
                    objEl.textContent = `- Collect ${obj.itemId.replace('ore_', '')}: ${count}/${obj.target}`;
                    if (complete) {
                        objEl.style.color = '#4ade80';
                        objEl.textContent += ' ✓';
                    }
                }

                questEl.appendChild(objEl);
            }

            listEl.appendChild(questEl);
        }

        // Show/hide tracker based on active quests
        const tracker = document.getElementById('quest-tracker');
        if (tracker) {
            tracker.style.display = this.activeQuests.length > 0 || this.gameMode === 'adventure' ? 'block' : 'none';
        }
    }

    // Interact with NPC (called from input.js)
    interactWithNPC() {
        if (this.nearbyNPC && !this.isDialogOpen()) {
            this.openNPCDialog(this.nearbyNPC);
            return true;
        }
        return false;
    }

    // ==================== END ADVENTURE MODE ====================

    // ==================== SAVE/LOAD SYSTEM ====================

    saveGame() {
        if (this.gameMode !== 'adventure') return; // Only save adventure mode

        const saveData = {
            version: 1,
            timestamp: Date.now(),
            gameMode: this.gameMode,
            selectedClass: this.selectedClass,
            player: {
                position: {
                    x: this.player.position.x,
                    y: this.player.position.y,
                    z: this.player.position.z
                },
                health: this.player.health,
                maxHealth: this.player.maxHealth,
                gold: this.player.gold || 0
            },
            inventory: this.serializeInventory(),
            equipment: this.serializeEquipment(),
            quests: this.serializeQuests(),
            activeQuests: [...this.activeQuests]
        };

        try {
            localStorage.setItem('tileGame3D_save', JSON.stringify(saveData));
            this.showSaveIndicator();
            console.log('Game saved!', saveData);
            return true;
        } catch (e) {
            console.error('Failed to save game:', e);
            return false;
        }
    }

    serializeInventory() {
        if (!this.player?.inventory?.slots) return [];

        return this.player.inventory.slots.map(slot => {
            if (!slot) return null;
            return {
                itemId: slot.definition.id,
                quantity: slot.quantity
            };
        });
    }

    serializeEquipment() {
        if (!this.player?.inventory?.equipment) return {};

        const equipment = {};
        for (const [slot, item] of Object.entries(this.player.inventory.equipment)) {
            if (item) {
                equipment[slot] = item.definition.id;
            }
        }
        return equipment;
    }

    serializeQuests() {
        const questData = {};
        for (const [questId, quest] of Object.entries(this.quests)) {
            questData[questId] = {
                status: quest.status,
                objectives: quest.objectives.map(obj => ({
                    type: obj.type,
                    itemId: obj.itemId,
                    target: obj.target,
                    current: obj.current
                }))
            };
        }
        return questData;
    }

    loadGame() {
        try {
            const saveStr = localStorage.getItem('tileGame3D_save');
            if (!saveStr) return false;

            const saveData = JSON.parse(saveStr);
            if (!saveData || saveData.version !== 1) return false;

            // Store save data to apply after game initializes
            this.pendingSaveData = saveData;
            return true;
        } catch (e) {
            console.error('Failed to load save:', e);
            return false;
        }
    }

    applySaveData() {
        const saveData = this.pendingSaveData;
        if (!saveData) return;

        console.log('Applying save data...', saveData);

        // Restore player position
        if (saveData.player && this.player) {
            this.player.position.x = saveData.player.position.x;
            this.player.position.y = saveData.player.position.y;
            this.player.position.z = saveData.player.position.z;
            this.player.health = saveData.player.health;
            this.player.maxHealth = saveData.player.maxHealth;
            this.player.gold = saveData.player.gold || 0;
        }

        // Restore inventory
        if (saveData.inventory && this.player?.inventory) {
            // Clear existing inventory (use .size, not .maxSlots)
            this.player.inventory.slots = new Array(this.player.inventory.size).fill(null);

            // Restore items
            for (let i = 0; i < saveData.inventory.length; i++) {
                const slotData = saveData.inventory[i];
                if (slotData && slotData.itemId) {
                    const item = ITEMS[slotData.itemId];
                    if (item) {
                        this.player.inventory.slots[i] = {
                            definition: item,
                            quantity: slotData.quantity,
                            instanceId: Math.random().toString(36).substr(2, 9)
                        };
                    }
                }
            }
        }

        // Restore equipment
        if (saveData.equipment && this.player?.inventory) {
            for (const [slot, itemId] of Object.entries(saveData.equipment)) {
                if (itemId) {
                    const item = ITEMS[itemId];
                    if (item) {
                        this.player.inventory.equipment[slot] = {
                            definition: item,
                            quantity: 1,
                            instanceId: Math.random().toString(36).substr(2, 9)
                        };
                    }
                }
            }
            // Notify equipment change to update stats
            this.player.inventory._notifyEquipChange();
        }

        // Restore quests
        if (saveData.quests) {
            for (const [questId, questData] of Object.entries(saveData.quests)) {
                if (this.quests[questId]) {
                    this.quests[questId].status = questData.status;
                    if (questData.objectives) {
                        for (let i = 0; i < questData.objectives.length; i++) {
                            if (this.quests[questId].objectives[i]) {
                                this.quests[questId].objectives[i].current = questData.objectives[i].current;
                            }
                        }
                    }
                }
            }
        }

        // Restore active quests
        if (saveData.activeQuests) {
            this.activeQuests = [...saveData.activeQuests];
        }

        // Update UI
        this.updateQuestTrackerUI();
        if (this.player?.inventory?.updateUI) {
            this.player.inventory.updateUI();
        }

        this.pendingSaveData = null;
        console.log('Save data applied!');
    }

    hasSaveData() {
        try {
            const saveStr = localStorage.getItem('tileGame3D_save');
            if (!saveStr) return false;
            const saveData = JSON.parse(saveStr);
            return saveData && saveData.version === 1 && saveData.gameMode === 'adventure';
        } catch (e) {
            return false;
        }
    }

    deleteSaveData() {
        localStorage.removeItem('tileGame3D_save');
    }

    showSaveIndicator() {
        const indicator = document.getElementById('save-indicator');
        if (indicator) {
            indicator.classList.add('visible');
            setTimeout(() => indicator.classList.remove('visible'), 1500);
        }
    }

    // Auto-save on important events
    autoSave() {
        if (this.gameMode === 'adventure' && this.gameState === 'playing') {
            this.saveGame();
        }
    }

    // ==================== END SAVE/LOAD SYSTEM ====================

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
