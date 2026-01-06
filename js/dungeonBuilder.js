import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AssetManifest, getDungeonPath } from './assetManifest.js';

// Dungeon builder using KayKit dungeon assets
export class DungeonBuilder {
    constructor(scene) {
        this.scene = scene;
        this.loader = new GLTFLoader();
        this.loadedAssets = new Map();
        this.placedObjects = [];

        // Dungeon texture
        this.dungeonTexture = null;

        // Tile size (KayKit tiles are 2x2 units)
        this.tileSize = 2;
    }

    // Preload dungeon assets
    async preloadAssets() {
        console.log('Preloading dungeon assets...');

        // Load dungeon texture first
        const textureLoader = new THREE.TextureLoader();
        try {
            this.dungeonTexture = await new Promise((resolve, reject) => {
                textureLoader.load(
                    AssetManifest.dungeon.texture,
                    resolve,
                    undefined,
                    reject
                );
            });
            this.dungeonTexture.colorSpace = THREE.SRGBColorSpace;
            console.log('Dungeon texture loaded');
        } catch (error) {
            console.warn('Could not load dungeon texture:', error);
        }

        // Preload commonly used pieces
        const commonAssets = [
            { category: 'floors', name: 'tileLarge' },
            { category: 'floors', name: 'tileSmall' },
            { category: 'walls', name: 'basic' },
            { category: 'walls', name: 'corner' },
            { category: 'walls', name: 'doorway' },
            { category: 'props', name: 'chest' },
            { category: 'props', name: 'barrelSmall' },
            { category: 'lighting', name: 'torchMounted' }
        ];

        const loadPromises = commonAssets.map(async ({ category, name }) => {
            const path = getDungeonPath(category, name);
            if (path) {
                try {
                    const gltf = await this.loadGLTF(path);
                    this.loadedAssets.set(`${category}/${name}`, gltf.scene);
                    return true;
                } catch (error) {
                    console.warn(`Failed to preload ${category}/${name}:`, error);
                    return false;
                }
            }
            return false;
        });

        await Promise.all(loadPromises);
        console.log(`Preloaded ${this.loadedAssets.size} dungeon assets`);
    }

    // Get or load an asset
    async getAsset(category, name) {
        const key = `${category}/${name}`;

        // Check cache
        if (this.loadedAssets.has(key)) {
            return this.loadedAssets.get(key).clone();
        }

        // Load and cache
        const path = getDungeonPath(category, name);
        if (!path) {
            console.warn(`Asset not found: ${key}`);
            return null;
        }

        try {
            const gltf = await this.loadGLTF(path);
            this.loadedAssets.set(key, gltf.scene);
            return gltf.scene.clone();
        } catch (error) {
            console.error(`Failed to load asset ${key}:`, error);
            return null;
        }
    }

    loadGLTF(path) {
        return new Promise((resolve, reject) => {
            this.loader.load(
                path,
                (gltf) => resolve(gltf),
                undefined,
                (error) => reject(error)
            );
        });
    }

    // Place a dungeon piece at a location
    async placePiece(category, name, x, y, z, rotation = 0) {
        const piece = await this.getAsset(category, name);
        if (!piece) return null;

        // Apply dungeon texture if available
        if (this.dungeonTexture) {
            piece.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    // Apply texture to materials that accept it
                    if (child.material && child.material.map === null) {
                        child.material.map = this.dungeonTexture;
                        child.material.needsUpdate = true;
                    }
                }
            });
        }

        piece.position.set(x, y, z);
        piece.rotation.y = rotation;
        this.scene.add(piece);
        this.placedObjects.push(piece);

        return piece;
    }

    // Build a simple rectangular room
    async buildRoom(centerX, centerZ, width, depth, wallHeight = 1) {
        const halfWidth = (width * this.tileSize) / 2;
        const halfDepth = (depth * this.tileSize) / 2;

        // Floor tiles
        for (let x = 0; x < width; x++) {
            for (let z = 0; z < depth; z++) {
                const posX = centerX - halfWidth + (x * this.tileSize) + this.tileSize / 2;
                const posZ = centerZ - halfDepth + (z * this.tileSize) + this.tileSize / 2;

                // Vary floor tile types
                const floorType = Math.random() < 0.1 ? 'tileDecorated' : 'tileSmall';
                await this.placePiece('floors', floorType, posX, 0, posZ);
            }
        }

        // Walls - North
        for (let x = 0; x < width; x++) {
            const posX = centerX - halfWidth + (x * this.tileSize) + this.tileSize / 2;
            const posZ = centerZ - halfDepth;
            await this.placePiece('walls', 'basic', posX, 0, posZ, 0);
        }

        // Walls - South
        for (let x = 0; x < width; x++) {
            const posX = centerX - halfWidth + (x * this.tileSize) + this.tileSize / 2;
            const posZ = centerZ + halfDepth;
            await this.placePiece('walls', 'basic', posX, 0, posZ, Math.PI);
        }

        // Walls - West
        for (let z = 0; z < depth; z++) {
            const posX = centerX - halfWidth;
            const posZ = centerZ - halfDepth + (z * this.tileSize) + this.tileSize / 2;
            await this.placePiece('walls', 'basic', posX, 0, posZ, Math.PI / 2);
        }

        // Walls - East
        for (let z = 0; z < depth; z++) {
            const posX = centerX + halfWidth;
            const posZ = centerZ - halfDepth + (z * this.tileSize) + this.tileSize / 2;
            await this.placePiece('walls', 'basic', posX, 0, posZ, -Math.PI / 2);
        }

        // Corners
        await this.placePiece('walls', 'corner', centerX - halfWidth, 0, centerZ - halfDepth, 0);
        await this.placePiece('walls', 'corner', centerX + halfWidth, 0, centerZ - halfDepth, -Math.PI / 2);
        await this.placePiece('walls', 'corner', centerX - halfWidth, 0, centerZ + halfDepth, Math.PI / 2);
        await this.placePiece('walls', 'corner', centerX + halfWidth, 0, centerZ + halfDepth, Math.PI);
    }

    // Add decorative props to a room
    async decorateRoom(centerX, centerZ, width, depth, density = 0.3) {
        const halfWidth = (width * this.tileSize) / 2;
        const halfDepth = (depth * this.tileSize) / 2;

        const decorations = [
            { category: 'props', name: 'barrelSmall', chance: 0.3 },
            { category: 'props', name: 'barrelLarge', chance: 0.2 },
            { category: 'props', name: 'boxSmall', chance: 0.3 },
            { category: 'props', name: 'chest', chance: 0.1 },
            { category: 'furniture', name: 'tableSmall', chance: 0.15 },
            { category: 'furniture', name: 'chair', chance: 0.2 },
            { category: 'decoration', name: 'rubblePile', chance: 0.1 }
        ];

        // Calculate number of props
        const propCount = Math.floor(width * depth * density);

        for (let i = 0; i < propCount; i++) {
            // Random position within room (offset from walls)
            const margin = 1;
            const x = centerX - halfWidth + margin + Math.random() * (width * this.tileSize - margin * 2);
            const z = centerZ - halfDepth + margin + Math.random() * (depth * this.tileSize - margin * 2);

            // Pick random decoration based on chances
            const roll = Math.random();
            let cumulative = 0;
            for (const deco of decorations) {
                cumulative += deco.chance;
                if (roll < cumulative) {
                    const rotation = Math.random() * Math.PI * 2;
                    await this.placePiece(deco.category, deco.name, x, 0, z, rotation);
                    break;
                }
            }
        }
    }

    // Add torches along walls
    async addTorches(centerX, centerZ, width, depth, spacing = 4) {
        const halfWidth = (width * this.tileSize) / 2;
        const halfDepth = (depth * this.tileSize) / 2;

        // Calculate torch positions along walls
        const torchPositions = [];

        // North and South walls
        for (let x = 0; x < width * this.tileSize; x += spacing) {
            const posX = centerX - halfWidth + x + spacing / 2;
            torchPositions.push({ x: posX, z: centerZ - halfDepth + 0.3, rotation: 0 });
            torchPositions.push({ x: posX, z: centerZ + halfDepth - 0.3, rotation: Math.PI });
        }

        // East and West walls
        for (let z = 0; z < depth * this.tileSize; z += spacing) {
            const posZ = centerZ - halfDepth + z + spacing / 2;
            torchPositions.push({ x: centerX - halfWidth + 0.3, z: posZ, rotation: Math.PI / 2 });
            torchPositions.push({ x: centerX + halfWidth - 0.3, z: posZ, rotation: -Math.PI / 2 });
        }

        for (const pos of torchPositions) {
            const torch = await this.placePiece('lighting', 'torchMounted', pos.x, 1.5, pos.z, pos.rotation);

            // Add point light for each torch
            if (torch) {
                const light = new THREE.PointLight(0xff6622, 0.8, 8);
                light.position.set(pos.x, 2, pos.z);
                light.castShadow = true;
                light.shadow.mapSize.width = 256;
                light.shadow.mapSize.height = 256;
                this.scene.add(light);
            }
        }
    }

    // Build a dungeon corridor
    async buildCorridor(startX, startZ, endX, endZ, width = 2) {
        const dx = endX - startX;
        const dz = endZ - startZ;
        const length = Math.sqrt(dx * dx + dz * dz);
        const steps = Math.ceil(length / this.tileSize);

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = startX + dx * t;
            const z = startZ + dz * t;

            // Floor
            await this.placePiece('floors', 'tileSmall', x, 0, z);

            // Walls on sides (perpendicular to direction)
            if (i > 0 && i < steps) {
                const perpX = -dz / length;
                const perpZ = dx / length;
                const wallOffset = width * this.tileSize / 2;

                await this.placePiece('walls', 'basic',
                    x + perpX * wallOffset, 0, z + perpZ * wallOffset,
                    Math.atan2(dx, dz)
                );
                await this.placePiece('walls', 'basic',
                    x - perpX * wallOffset, 0, z - perpZ * wallOffset,
                    Math.atan2(dx, dz) + Math.PI
                );
            }
        }
    }

    // Create a simple test dungeon layout
    async buildTestDungeon() {
        console.log('Building test dungeon...');

        // Main room
        await this.buildRoom(0, 0, 10, 10);
        await this.decorateRoom(0, 0, 10, 10, 0.15);
        await this.addTorches(0, 0, 10, 10, 6);

        console.log('Test dungeon complete');
    }

    // Clear all placed objects
    clear() {
        for (const obj of this.placedObjects) {
            this.scene.remove(obj);
            obj.traverse((child) => {
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
        this.placedObjects = [];
    }

    // Cleanup
    dispose() {
        this.clear();
        this.loadedAssets.clear();
        if (this.dungeonTexture) {
            this.dungeonTexture.dispose();
        }
    }
}
