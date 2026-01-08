// Loot tables for different enemy types
export const LOOT_TABLES = {
    // Basic skeleton minion
    skeleton_minion: {
        guaranteedDrops: [],
        possibleDrops: [
            { itemId: 'bone_fragment', weight: 70, minQuantity: 1, maxQuantity: 2 },
            { itemId: 'health_potion_small', weight: 20, minQuantity: 1, maxQuantity: 1 },
            { itemId: 'copper_ring', weight: 5, minQuantity: 1, maxQuantity: 1 },
            { itemId: 'leather_cap', weight: 5, minQuantity: 1, maxQuantity: 1 }
        ],
        dropCount: { min: 0, max: 1 },
        goldDrop: { min: 3, max: 10 },
        dropChance: 0.6  // 60% chance to drop anything
    },

    // Skeleton warrior (melee)
    skeleton_warrior: {
        guaranteedDrops: [],
        possibleDrops: [
            { itemId: 'bone_fragment', weight: 50, minQuantity: 1, maxQuantity: 3 },
            { itemId: 'health_potion_small', weight: 25, minQuantity: 1, maxQuantity: 1 },
            { itemId: 'iron_sword', weight: 8, minQuantity: 1, maxQuantity: 1 },
            { itemId: 'leather_vest', weight: 7, minQuantity: 1, maxQuantity: 1 },
            { itemId: 'chainmail_helm', weight: 5, minQuantity: 1, maxQuantity: 1 },
            { itemId: 'steel_sword', weight: 3, minQuantity: 1, maxQuantity: 1 },
            { itemId: 'bone_ring', weight: 2, minQuantity: 1, maxQuantity: 1 }
        ],
        dropCount: { min: 1, max: 2 },
        goldDrop: { min: 8, max: 20 },
        dropChance: 0.75
    },

    // Skeleton mage (ranged magic)
    skeleton_mage: {
        guaranteedDrops: [],
        possibleDrops: [
            { itemId: 'bone_fragment', weight: 40, minQuantity: 1, maxQuantity: 2 },
            { itemId: 'dark_essence', weight: 30, minQuantity: 1, maxQuantity: 2 },
            { itemId: 'health_potion_small', weight: 15, minQuantity: 1, maxQuantity: 1 },
            { itemId: 'apprentice_staff', weight: 5, minQuantity: 1, maxQuantity: 1 },
            { itemId: 'crystal_staff', weight: 3, minQuantity: 1, maxQuantity: 1 },
            { itemId: 'speed_potion', weight: 4, minQuantity: 1, maxQuantity: 1 },
            { itemId: 'skull_pendant', weight: 3, minQuantity: 1, maxQuantity: 1 }
        ],
        dropCount: { min: 1, max: 2 },
        goldDrop: { min: 12, max: 25 },
        dropChance: 0.8
    },

    // Skeleton rogue (fast melee)
    skeleton_rogue: {
        guaranteedDrops: [],
        possibleDrops: [
            { itemId: 'bone_fragment', weight: 45, minQuantity: 1, maxQuantity: 2 },
            { itemId: 'health_potion_small', weight: 20, minQuantity: 1, maxQuantity: 1 },
            { itemId: 'leather_boots', weight: 12, minQuantity: 1, maxQuantity: 1 },
            { itemId: 'swift_boots', weight: 5, minQuantity: 1, maxQuantity: 1 },
            { itemId: 'leather_gloves', weight: 10, minQuantity: 1, maxQuantity: 1 },
            { itemId: 'wooden_bow', weight: 5, minQuantity: 1, maxQuantity: 1 },
            { itemId: 'skeleton_key', weight: 3, minQuantity: 1, maxQuantity: 1 }
        ],
        dropCount: { min: 1, max: 2 },
        goldDrop: { min: 10, max: 22 },
        dropChance: 0.75
    },

    // Skeleton boss
    skeleton_boss: {
        guaranteedDrops: [
            { itemId: 'boss_trophy', minQuantity: 1, maxQuantity: 1 },
            { itemId: 'health_potion_large', minQuantity: 2, maxQuantity: 3 }
        ],
        possibleDrops: [
            { itemId: 'bone_fragment', weight: 20, minQuantity: 3, maxQuantity: 6 },
            { itemId: 'dark_essence', weight: 20, minQuantity: 2, maxQuantity: 4 },
            { itemId: 'skeleton_key', weight: 15, minQuantity: 1, maxQuantity: 2 },
            { itemId: 'bone_cleaver', weight: 10, minQuantity: 1, maxQuantity: 1 },
            { itemId: 'dark_scepter', weight: 8, minQuantity: 1, maxQuantity: 1 },
            { itemId: 'shadow_repeater', weight: 8, minQuantity: 1, maxQuantity: 1 },
            { itemId: 'skull_helm', weight: 7, minQuantity: 1, maxQuantity: 1 },
            { itemId: 'bone_plate', weight: 7, minQuantity: 1, maxQuantity: 1 },
            { itemId: 'damage_potion', weight: 5, minQuantity: 1, maxQuantity: 2 }
        ],
        dropCount: { min: 3, max: 5 },
        goldDrop: { min: 80, max: 150 },
        dropChance: 1.0  // Always drops
    },

    // Generic skeleton (fallback)
    skeleton: {
        guaranteedDrops: [],
        possibleDrops: [
            { itemId: 'bone_fragment', weight: 60, minQuantity: 1, maxQuantity: 2 },
            { itemId: 'health_potion_small', weight: 25, minQuantity: 1, maxQuantity: 1 },
            { itemId: 'leather_cap', weight: 8, minQuantity: 1, maxQuantity: 1 },
            { itemId: 'copper_ring', weight: 7, minQuantity: 1, maxQuantity: 1 }
        ],
        dropCount: { min: 0, max: 1 },
        goldDrop: { min: 5, max: 15 },
        dropChance: 0.65
    }
};

// Loot generator class
export class LootGenerator {
    static generateLoot(enemyType) {
        const table = LOOT_TABLES[enemyType] || LOOT_TABLES['skeleton'];

        // Check if anything drops at all
        if (Math.random() > (table.dropChance || 1.0)) {
            return { items: [], gold: 0 };
        }

        const drops = [];

        // Add guaranteed drops
        for (const drop of table.guaranteedDrops) {
            const quantity = this._randomRange(drop.minQuantity, drop.maxQuantity);
            drops.push({ itemId: drop.itemId, quantity });
        }

        // Roll for possible drops
        const dropCount = this._randomRange(table.dropCount.min, table.dropCount.max);
        const totalWeight = table.possibleDrops.reduce((sum, d) => sum + d.weight, 0);

        for (let i = 0; i < dropCount; i++) {
            let roll = Math.random() * totalWeight;

            for (const drop of table.possibleDrops) {
                roll -= drop.weight;
                if (roll <= 0) {
                    const quantity = this._randomRange(drop.minQuantity, drop.maxQuantity);

                    // Check if we already have this item in drops, stack if possible
                    const existing = drops.find(d => d.itemId === drop.itemId);
                    if (existing) {
                        existing.quantity += quantity;
                    } else {
                        drops.push({ itemId: drop.itemId, quantity });
                    }
                    break;
                }
            }
        }

        // Calculate gold drop
        const gold = this._randomRange(table.goldDrop.min, table.goldDrop.max);

        return { items: drops, gold };
    }

    static _randomRange(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
}

// Helper to get loot table type from enemy
export function getEnemyLootType(enemy) {
    // Check enemy type property
    if (enemy.enemyType) {
        const typeMap = {
            'warrior': 'skeleton_warrior',
            'mage': 'skeleton_mage',
            'rogue': 'skeleton_rogue',
            'minion': 'skeleton_minion'
        };
        return typeMap[enemy.enemyType] || 'skeleton';
    }

    // Check if boss
    if (enemy.isBoss) {
        return 'skeleton_boss';
    }

    // Default
    return 'skeleton';
}
