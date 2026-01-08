import * as THREE from 'three';
import { ITEMS } from './itemDatabase.js';
import { LootGenerator, getEnemyLootType } from './lootTable.js';

// World item pickup class
export class WorldItem {
    constructor(scene, position, itemId, quantity, game) {
        this.scene = scene;
        this.game = game;
        this.position = position.clone();
        this.itemId = itemId;
        this.quantity = quantity;
        this.pickupRadius = 1.2;
        this.bobTime = Math.random() * Math.PI * 2;  // Random start phase
        this.isCollected = false;
        this.lifetime = 60;  // Despawn after 60 seconds
        this.spawnTime = 0;
        this.spawnDuration = 0.3;  // Pop-in animation duration

        this.createMesh();
    }

    createMesh() {
        this.group = new THREE.Group();

        const itemDef = ITEMS[this.itemId];
        if (!itemDef) {
            console.warn(`Unknown item: ${this.itemId}`);
            return;
        }

        const rarity = itemDef.rarity;
        const color = rarity.color;

        // Create item visual based on type
        let geometry;
        if (itemDef.type === 'consumable') {
            // Potion-like shape (cylinder with rounded top)
            geometry = new THREE.CylinderGeometry(0.15, 0.12, 0.35, 8);
        } else if (itemDef.type === 'weapon') {
            // Elongated box for weapons
            geometry = new THREE.BoxGeometry(0.15, 0.4, 0.1);
        } else if (itemDef.type === 'armor') {
            // Box for armor
            geometry = new THREE.BoxGeometry(0.3, 0.3, 0.15);
        } else if (itemDef.type === 'material') {
            // Small sphere for materials
            geometry = new THREE.SphereGeometry(0.15, 8, 8);
        } else {
            // Default box
            geometry = new THREE.BoxGeometry(0.25, 0.25, 0.25);
        }

        const material = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.4,
            roughness: 0.4,
            metalness: 0.3
        });

        this.itemMesh = new THREE.Mesh(geometry, material);
        this.itemMesh.castShadow = true;
        this.group.add(this.itemMesh);

        // Glowing ring underneath
        const ringGeometry = new THREE.RingGeometry(0.2, 0.4, 24);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        this.ring = new THREE.Mesh(ringGeometry, ringMaterial);
        this.ring.rotation.x = -Math.PI / 2;
        this.ring.position.y = 0.02;
        this.group.add(this.ring);

        // Quantity indicator for stacks
        if (this.quantity > 1) {
            // Could add a number sprite here in the future
        }

        this.group.position.copy(this.position);
        this.group.position.y = 0.3;

        // Start small for pop-in effect
        this.group.scale.setScalar(0.01);

        this.scene.add(this.group);
    }

    update(deltaTime, playerPosition) {
        if (this.isCollected || !this.group) return false;

        // Spawn animation
        this.spawnTime += deltaTime;
        if (this.spawnTime < this.spawnDuration) {
            const t = this.spawnTime / this.spawnDuration;
            const scale = this.easeOutBack(t);
            this.group.scale.setScalar(scale);
        } else {
            this.group.scale.setScalar(1);
        }

        // Lifetime countdown
        this.lifetime -= deltaTime;
        if (this.lifetime <= 0) {
            this.dispose();
            return false;
        }

        // Bob animation
        this.bobTime += deltaTime * 3;
        this.group.position.y = 0.35 + Math.sin(this.bobTime) * 0.1;

        // Rotate item
        this.itemMesh.rotation.y += deltaTime * 2;

        // Pulse ring
        const pulse = Math.sin(this.bobTime * 2) * 0.2 + 0.5;
        if (this.ring && this.ring.material) {
            this.ring.material.opacity = pulse;
        }

        // Fade out when about to despawn
        if (this.lifetime < 5) {
            const alpha = this.lifetime / 5;
            if (this.itemMesh && this.itemMesh.material) {
                this.itemMesh.material.opacity = alpha;
                this.itemMesh.material.transparent = true;
            }
            if (this.ring && this.ring.material) {
                this.ring.material.opacity = pulse * alpha;
            }
        }

        // Check pickup distance
        if (playerPosition) {
            const dx = this.position.x - playerPosition.x;
            const dz = this.position.z - playerPosition.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < this.pickupRadius) {
                return true;  // Signal ready for pickup
            }
        }

        return false;
    }

    easeOutBack(t) {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }

    collect(inventory) {
        if (this.isCollected) return false;

        const itemDef = ITEMS[this.itemId];
        if (!itemDef) return false;

        const overflow = inventory.addItem(itemDef, this.quantity);

        if (overflow < this.quantity) {
            // At least some items were picked up
            this.isCollected = true;

            // Pickup visual effect
            if (this.game && this.game.particles) {
                this.game.particles.itemPickup(this.position, itemDef.rarity.color);
            }

            this.dispose();
            return true;
        }

        return false;  // Inventory full
    }

    dispose() {
        if (this.group) {
            this.scene.remove(this.group);
            this.group.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
            this.group = null;
        }
    }
}

// Manager class for all world items
export class WorldItemManager {
    constructor(scene, game) {
        this.scene = scene;
        this.game = game;
        this.items = [];
    }

    spawnDrop(position, itemId, quantity) {
        // Add some scatter from death position
        const offset = new THREE.Vector3(
            (Math.random() - 0.5) * 1.5,
            0,
            (Math.random() - 0.5) * 1.5
        );
        const spawnPos = position.clone().add(offset);
        spawnPos.y = 0;  // Ground level

        const worldItem = new WorldItem(this.scene, spawnPos, itemId, quantity, this.game);
        this.items.push(worldItem);

        return worldItem;
    }

    spawnLoot(position, enemyType) {
        const loot = LootGenerator.generateLoot(enemyType);

        // Spawn item drops
        for (const drop of loot.items) {
            this.spawnDrop(position, drop.itemId, drop.quantity);
        }

        // Add gold directly to player
        if (loot.gold > 0 && this.game.player && this.game.player.inventory) {
            this.game.player.inventory.addGold(loot.gold);

            // Show gold pickup text
            if (this.game.effects) {
                this.game.effects.createDamageNumber(
                    { x: position.x, y: position.y + 1, z: position.z },
                    `+${loot.gold}g`,
                    false,
                    0xffd700  // Gold color
                );
            }
        }

        return loot;
    }

    spawnLootFromEnemy(enemy) {
        const lootType = getEnemyLootType(enemy);
        return this.spawnLoot(enemy.position, lootType);
    }

    update(deltaTime) {
        const playerPos = this.game.player?.position;

        for (let i = this.items.length - 1; i >= 0; i--) {
            const item = this.items[i];
            const readyForPickup = item.update(deltaTime, playerPos);

            if (readyForPickup && this.game.player?.inventory) {
                if (item.collect(this.game.player.inventory)) {
                    this.items.splice(i, 1);
                }
            } else if (item.isCollected || item.lifetime <= 0) {
                item.dispose();
                this.items.splice(i, 1);
            }
        }
    }

    dispose() {
        for (const item of this.items) {
            item.dispose();
        }
        this.items = [];
    }

    // Get count of items on ground
    getItemCount() {
        return this.items.length;
    }
}
