// Item Rarity definitions
export const ItemRarity = {
    COMMON: { name: 'common', color: 0xaaaaaa, dropWeight: 60 },
    UNCOMMON: { name: 'uncommon', color: 0x44ff44, dropWeight: 25 },
    RARE: { name: 'rare', color: 0x4488ff, dropWeight: 12 },
    EPIC: { name: 'epic', color: 0xaa44ff, dropWeight: 3 }
};

// Item type categories
export const ItemType = {
    CONSUMABLE: 'consumable',
    WEAPON: 'weapon',
    ARMOR: 'armor',
    ACCESSORY: 'accessory',
    MATERIAL: 'material',
    QUEST: 'quest'
};

// Equipment slot definitions
export const EquipSlot = {
    WEAPON: 'weapon',
    HELMET: 'helmet',
    CHEST: 'chest',
    GLOVES: 'gloves',
    BOOTS: 'boots',
    RING: 'ring',
    AMULET: 'amulet'
};

// Item stack class for inventory
export class ItemStack {
    constructor(definition, quantity = 1) {
        this.definition = definition;
        this.quantity = quantity;
        this.instanceId = Math.random().toString(36).substr(2, 9);
    }
}

// All item definitions
export const ITEMS = {
    // === CONSUMABLES ===
    health_potion_small: {
        id: 'health_potion_small',
        name: 'Small Health Potion',
        type: ItemType.CONSUMABLE,
        rarity: ItemRarity.COMMON,
        icon: 'potion_red',
        description: 'Restores 50 HP',
        stackable: true,
        maxStack: 20,
        value: 25,
        cooldown: 1.0,
        useEffect: (player) => {
            const healAmount = 50;
            player.health = Math.min(player.maxHealth, player.health + healAmount);
            return { type: 'heal', amount: healAmount };
        }
    },

    health_potion_large: {
        id: 'health_potion_large',
        name: 'Large Health Potion',
        type: ItemType.CONSUMABLE,
        rarity: ItemRarity.UNCOMMON,
        icon: 'potion_red_large',
        description: 'Restores 120 HP',
        stackable: true,
        maxStack: 10,
        value: 75,
        cooldown: 1.0,
        useEffect: (player) => {
            const healAmount = 120;
            player.health = Math.min(player.maxHealth, player.health + healAmount);
            return { type: 'heal', amount: healAmount };
        }
    },

    infinite_health_potion: {
        id: 'infinite_health_potion',
        name: 'Infinite Health Potion',
        type: ItemType.CONSUMABLE,
        rarity: ItemRarity.EPIC,
        icon: 'potion_red_infinite',
        description: 'Restores 100 HP. Infinite charges.',
        stackable: false,
        maxStack: 1,
        value: 0,
        cooldown: 10.0,
        infinite: true,  // Does not consume on use
        useEffect: (player) => {
            const healAmount = 100;
            player.health = Math.min(player.maxHealth, player.health + healAmount);
            return { type: 'heal', amount: healAmount };
        }
    },

    speed_potion: {
        id: 'speed_potion',
        name: 'Speed Potion',
        type: ItemType.CONSUMABLE,
        rarity: ItemRarity.UNCOMMON,
        icon: 'potion_blue',
        description: 'Increases movement speed by 50% for 10 seconds',
        stackable: true,
        maxStack: 10,
        value: 50,
        cooldown: 30,
        useEffect: (player) => {
            player.applyBuff('speed', { multiplier: 1.5, duration: 10 });
            return { type: 'buff', buff: 'speed', duration: 10 };
        }
    },

    damage_potion: {
        id: 'damage_potion',
        name: 'Strength Elixir',
        type: ItemType.CONSUMABLE,
        rarity: ItemRarity.RARE,
        icon: 'potion_orange',
        description: 'Increases damage by 25% for 15 seconds',
        stackable: true,
        maxStack: 5,
        value: 100,
        cooldown: 45,
        useEffect: (player) => {
            player.applyBuff('damage', { multiplier: 1.25, duration: 15 });
            return { type: 'buff', buff: 'damage', duration: 15 };
        }
    },

    defense_potion: {
        id: 'defense_potion',
        name: 'Iron Skin Potion',
        type: ItemType.CONSUMABLE,
        rarity: ItemRarity.RARE,
        icon: 'potion_gray',
        description: 'Reduces damage taken by 30% for 12 seconds',
        stackable: true,
        maxStack: 5,
        value: 100,
        cooldown: 45,
        useEffect: (player) => {
            player.applyBuff('defense', { multiplier: 0.7, duration: 12 });
            return { type: 'buff', buff: 'defense', duration: 12 };
        }
    },

    // === WARRIOR WEAPONS ===
    iron_sword: {
        id: 'iron_sword',
        name: 'Iron Sword',
        type: ItemType.WEAPON,
        rarity: ItemRarity.COMMON,
        icon: 'sword_iron',
        description: 'A sturdy iron blade',
        stackable: false,
        value: 50,
        equipSlot: EquipSlot.WEAPON,
        stats: { damage: 5 },
        classRestriction: ['warrior']
    },

    steel_sword: {
        id: 'steel_sword',
        name: 'Steel Sword',
        type: ItemType.WEAPON,
        rarity: ItemRarity.UNCOMMON,
        icon: 'sword_steel',
        description: 'A finely crafted steel blade',
        stackable: false,
        value: 150,
        equipSlot: EquipSlot.WEAPON,
        stats: { damage: 12, attackSpeed: 5 },
        classRestriction: ['warrior']
    },

    bone_cleaver: {
        id: 'bone_cleaver',
        name: 'Bone Cleaver',
        type: ItemType.WEAPON,
        rarity: ItemRarity.RARE,
        icon: 'sword_bone',
        description: 'A brutal weapon forged from giant bones',
        stackable: false,
        value: 350,
        equipSlot: EquipSlot.WEAPON,
        stats: { damage: 20, maxHealth: 25 },
        classRestriction: ['warrior']
    },

    // === MAGE WEAPONS ===
    apprentice_staff: {
        id: 'apprentice_staff',
        name: 'Apprentice Staff',
        type: ItemType.WEAPON,
        rarity: ItemRarity.COMMON,
        icon: 'staff_wood',
        description: 'A simple wooden staff',
        stackable: false,
        value: 50,
        equipSlot: EquipSlot.WEAPON,
        stats: { damage: 3, magicPower: 10 },
        classRestriction: ['mage']
    },

    crystal_staff: {
        id: 'crystal_staff',
        name: 'Crystal Staff',
        type: ItemType.WEAPON,
        rarity: ItemRarity.UNCOMMON,
        icon: 'staff_crystal',
        description: 'A staff topped with a glowing crystal',
        stackable: false,
        value: 150,
        equipSlot: EquipSlot.WEAPON,
        stats: { damage: 8, magicPower: 20 },
        classRestriction: ['mage']
    },

    dark_scepter: {
        id: 'dark_scepter',
        name: 'Dark Scepter',
        type: ItemType.WEAPON,
        rarity: ItemRarity.RARE,
        icon: 'staff_dark',
        description: 'Pulses with dark energy',
        stackable: false,
        value: 350,
        equipSlot: EquipSlot.WEAPON,
        stats: { damage: 15, magicPower: 35 },
        classRestriction: ['mage']
    },

    // === HUNTER WEAPONS ===
    wooden_bow: {
        id: 'wooden_bow',
        name: 'Wooden Bow',
        type: ItemType.WEAPON,
        rarity: ItemRarity.COMMON,
        icon: 'bow_wood',
        description: 'A simple hunting bow',
        stackable: false,
        value: 50,
        equipSlot: EquipSlot.WEAPON,
        stats: { damage: 4, attackSpeed: 5 },
        classRestriction: ['hunter']
    },

    hunters_crossbow: {
        id: 'hunters_crossbow',
        name: "Hunter's Crossbow",
        type: ItemType.WEAPON,
        rarity: ItemRarity.UNCOMMON,
        icon: 'crossbow',
        description: 'A reliable crossbow for skilled hunters',
        stackable: false,
        value: 150,
        equipSlot: EquipSlot.WEAPON,
        stats: { damage: 10, attackSpeed: 10 },
        classRestriction: ['hunter']
    },

    shadow_repeater: {
        id: 'shadow_repeater',
        name: 'Shadow Repeater',
        type: ItemType.WEAPON,
        rarity: ItemRarity.RARE,
        icon: 'crossbow_shadow',
        description: 'Fires bolts infused with shadow',
        stackable: false,
        value: 350,
        equipSlot: EquipSlot.WEAPON,
        stats: { damage: 18, attackSpeed: 15, moveSpeed: 5 },
        classRestriction: ['hunter']
    },

    // === ARMOR - HELMETS ===
    leather_cap: {
        id: 'leather_cap',
        name: 'Leather Cap',
        type: ItemType.ARMOR,
        rarity: ItemRarity.COMMON,
        icon: 'helm_leather',
        description: 'Basic head protection',
        stackable: false,
        value: 30,
        equipSlot: EquipSlot.HELMET,
        stats: { defense: 2, maxHealth: 10 }
    },

    chainmail_helm: {
        id: 'chainmail_helm',
        name: 'Chainmail Helm',
        type: ItemType.ARMOR,
        rarity: ItemRarity.UNCOMMON,
        icon: 'helm_chain',
        description: 'Flexible chain protection',
        stackable: false,
        value: 100,
        equipSlot: EquipSlot.HELMET,
        stats: { defense: 5, maxHealth: 20 }
    },

    skull_helm: {
        id: 'skull_helm',
        name: 'Skull Helm',
        type: ItemType.ARMOR,
        rarity: ItemRarity.RARE,
        icon: 'helm_skull',
        description: 'A helm shaped from bone',
        stackable: false,
        value: 250,
        equipSlot: EquipSlot.HELMET,
        stats: { defense: 8, maxHealth: 35, damage: 3 }
    },

    // === ARMOR - CHEST ===
    leather_vest: {
        id: 'leather_vest',
        name: 'Leather Vest',
        type: ItemType.ARMOR,
        rarity: ItemRarity.COMMON,
        icon: 'chest_leather',
        description: 'Basic torso protection',
        stackable: false,
        value: 40,
        equipSlot: EquipSlot.CHEST,
        stats: { defense: 3, maxHealth: 15 }
    },

    chainmail_vest: {
        id: 'chainmail_vest',
        name: 'Chainmail Vest',
        type: ItemType.ARMOR,
        rarity: ItemRarity.UNCOMMON,
        icon: 'chest_chain',
        description: 'Flexible chain armor',
        stackable: false,
        value: 120,
        equipSlot: EquipSlot.CHEST,
        stats: { defense: 7, maxHealth: 30 }
    },

    bone_plate: {
        id: 'bone_plate',
        name: 'Bone Plate Armor',
        type: ItemType.ARMOR,
        rarity: ItemRarity.RARE,
        icon: 'chest_bone',
        description: 'Armor crafted from monster bones',
        stackable: false,
        value: 300,
        equipSlot: EquipSlot.CHEST,
        stats: { defense: 12, maxHealth: 50 }
    },

    // === ARMOR - GLOVES ===
    leather_gloves: {
        id: 'leather_gloves',
        name: 'Leather Gloves',
        type: ItemType.ARMOR,
        rarity: ItemRarity.COMMON,
        icon: 'gloves_leather',
        description: 'Simple hand protection',
        stackable: false,
        value: 25,
        equipSlot: EquipSlot.GLOVES,
        stats: { defense: 1, attackSpeed: 3 }
    },

    chain_gauntlets: {
        id: 'chain_gauntlets',
        name: 'Chain Gauntlets',
        type: ItemType.ARMOR,
        rarity: ItemRarity.UNCOMMON,
        icon: 'gloves_chain',
        description: 'Chainmail hand protection',
        stackable: false,
        value: 80,
        equipSlot: EquipSlot.GLOVES,
        stats: { defense: 3, attackSpeed: 5, damage: 2 }
    },

    // === ARMOR - BOOTS ===
    leather_boots: {
        id: 'leather_boots',
        name: 'Leather Boots',
        type: ItemType.ARMOR,
        rarity: ItemRarity.COMMON,
        icon: 'boots_leather',
        description: 'Basic footwear',
        stackable: false,
        value: 25,
        equipSlot: EquipSlot.BOOTS,
        stats: { defense: 1, moveSpeed: 3 }
    },

    swift_boots: {
        id: 'swift_boots',
        name: 'Swift Boots',
        type: ItemType.ARMOR,
        rarity: ItemRarity.UNCOMMON,
        icon: 'boots_swift',
        description: 'Lightweight boots for quick movement',
        stackable: false,
        value: 100,
        equipSlot: EquipSlot.BOOTS,
        stats: { defense: 2, moveSpeed: 8 }
    },

    // === ACCESSORIES - RINGS ===
    copper_ring: {
        id: 'copper_ring',
        name: 'Copper Ring',
        type: ItemType.ACCESSORY,
        rarity: ItemRarity.COMMON,
        icon: 'ring_copper',
        description: 'A simple copper band',
        stackable: false,
        value: 20,
        equipSlot: EquipSlot.RING,
        stats: { maxHealth: 10 }
    },

    silver_ring: {
        id: 'silver_ring',
        name: 'Silver Ring',
        type: ItemType.ACCESSORY,
        rarity: ItemRarity.UNCOMMON,
        icon: 'ring_silver',
        description: 'A polished silver ring',
        stackable: false,
        value: 75,
        equipSlot: EquipSlot.RING,
        stats: { maxHealth: 25, damage: 3 }
    },

    bone_ring: {
        id: 'bone_ring',
        name: 'Bone Ring',
        type: ItemType.ACCESSORY,
        rarity: ItemRarity.RARE,
        icon: 'ring_bone',
        description: 'A ring carved from bone, emanating power',
        stackable: false,
        value: 200,
        equipSlot: EquipSlot.RING,
        stats: { damage: 8, attackSpeed: 5 }
    },

    // === ACCESSORIES - AMULETS ===
    wooden_charm: {
        id: 'wooden_charm',
        name: 'Wooden Charm',
        type: ItemType.ACCESSORY,
        rarity: ItemRarity.COMMON,
        icon: 'amulet_wood',
        description: 'A carved wooden pendant',
        stackable: false,
        value: 20,
        equipSlot: EquipSlot.AMULET,
        stats: { defense: 2 }
    },

    skull_pendant: {
        id: 'skull_pendant',
        name: 'Skull Pendant',
        type: ItemType.ACCESSORY,
        rarity: ItemRarity.UNCOMMON,
        icon: 'amulet_skull',
        description: 'A tiny skull on a chain',
        stackable: false,
        value: 100,
        equipSlot: EquipSlot.AMULET,
        stats: { damage: 5, maxHealth: 20 }
    },

    // === RAW FISH ===
    fish_small_trout: {
        id: 'fish_small_trout',
        name: 'Raw Small Trout',
        type: ItemType.MATERIAL,
        rarity: ItemRarity.COMMON,
        icon: 'fish_common',
        description: 'A small freshwater fish. Cook it at a campfire!',
        stackable: true,
        maxStack: 99,
        value: 5
    },

    fish_bass: {
        id: 'fish_bass',
        name: 'Raw Bass',
        type: ItemType.MATERIAL,
        rarity: ItemRarity.COMMON,
        icon: 'fish_common',
        description: 'A common bass. Cook it at a campfire!',
        stackable: true,
        maxStack: 99,
        value: 8
    },

    fish_golden_carp: {
        id: 'fish_golden_carp',
        name: 'Raw Golden Carp',
        type: ItemType.MATERIAL,
        rarity: ItemRarity.UNCOMMON,
        icon: 'fish_uncommon',
        description: 'A beautiful golden-scaled carp. Cook it at a campfire!',
        stackable: true,
        maxStack: 99,
        value: 20
    },

    fish_rainbow_trout: {
        id: 'fish_rainbow_trout',
        name: 'Raw Rainbow Trout',
        type: ItemType.MATERIAL,
        rarity: ItemRarity.RARE,
        icon: 'fish_rare',
        description: 'A prized rainbow trout. Cook it at a campfire!',
        stackable: true,
        maxStack: 99,
        value: 50
    },

    fish_legendary_koi: {
        id: 'fish_legendary_koi',
        name: 'Raw Legendary Koi',
        type: ItemType.MATERIAL,
        rarity: ItemRarity.EPIC,
        icon: 'fish_epic',
        description: 'An ancient koi. Cook it at a campfire!',
        stackable: true,
        maxStack: 99,
        value: 150
    },

    // === COOKED FISH (Consumables) ===
    cooked_small_trout: {
        id: 'cooked_small_trout',
        name: 'Grilled Trout',
        type: ItemType.CONSUMABLE,
        rarity: ItemRarity.COMMON,
        icon: 'fish_common',
        description: 'Restores 30 HP',
        stackable: true,
        maxStack: 20,
        value: 15,
        cooldown: 1.0,
        useEffect: (player) => {
            const healAmount = 30;
            player.health = Math.min(player.maxHealth, player.health + healAmount);
            return { type: 'heal', amount: healAmount };
        }
    },

    cooked_bass: {
        id: 'cooked_bass',
        name: 'Grilled Bass',
        type: ItemType.CONSUMABLE,
        rarity: ItemRarity.COMMON,
        icon: 'fish_common',
        description: 'Restores 40 HP',
        stackable: true,
        maxStack: 20,
        value: 20,
        cooldown: 1.0,
        useEffect: (player) => {
            const healAmount = 40;
            player.health = Math.min(player.maxHealth, player.health + healAmount);
            return { type: 'heal', amount: healAmount };
        }
    },

    cooked_golden_carp: {
        id: 'cooked_golden_carp',
        name: 'Golden Carp Fillet',
        type: ItemType.CONSUMABLE,
        rarity: ItemRarity.UNCOMMON,
        icon: 'fish_uncommon',
        description: 'Restores 60 HP',
        stackable: true,
        maxStack: 20,
        value: 50,
        cooldown: 1.0,
        useEffect: (player) => {
            const healAmount = 60;
            player.health = Math.min(player.maxHealth, player.health + healAmount);
            return { type: 'heal', amount: healAmount };
        }
    },

    cooked_rainbow_trout: {
        id: 'cooked_rainbow_trout',
        name: 'Rainbow Trout Steak',
        type: ItemType.CONSUMABLE,
        rarity: ItemRarity.RARE,
        icon: 'fish_rare',
        description: 'Restores 100 HP',
        stackable: true,
        maxStack: 20,
        value: 120,
        cooldown: 1.0,
        useEffect: (player) => {
            const healAmount = 100;
            player.health = Math.min(player.maxHealth, player.health + healAmount);
            return { type: 'heal', amount: healAmount };
        }
    },

    cooked_legendary_koi: {
        id: 'cooked_legendary_koi',
        name: 'Legendary Koi Feast',
        type: ItemType.CONSUMABLE,
        rarity: ItemRarity.EPIC,
        icon: 'fish_epic',
        description: 'Restores 150 HP and grants +10% damage for 30s',
        stackable: true,
        maxStack: 10,
        value: 300,
        cooldown: 1.0,
        useEffect: (player) => {
            const healAmount = 150;
            player.health = Math.min(player.maxHealth, player.health + healAmount);
            if (player.applyBuff) {
                player.applyBuff('damage', { multiplier: 1.1, duration: 30 });
            }
            return { type: 'heal', amount: healAmount };
        }
    },

    // === MATERIALS ===
    bone_fragment: {
        id: 'bone_fragment',
        name: 'Bone Fragment',
        type: ItemType.MATERIAL,
        rarity: ItemRarity.COMMON,
        icon: 'mat_bone',
        description: 'A piece of skeleton bone',
        stackable: true,
        maxStack: 99,
        value: 5
    },

    dark_essence: {
        id: 'dark_essence',
        name: 'Dark Essence',
        type: ItemType.MATERIAL,
        rarity: ItemRarity.UNCOMMON,
        icon: 'mat_essence',
        description: 'Magical essence from undead mages',
        stackable: true,
        maxStack: 50,
        value: 25
    },

    skeleton_key: {
        id: 'skeleton_key',
        name: 'Skeleton Key',
        type: ItemType.MATERIAL,
        rarity: ItemRarity.RARE,
        icon: 'mat_key',
        description: 'A key fashioned from bones',
        stackable: true,
        maxStack: 10,
        value: 100
    },

    // === ORES ===
    ore_copper: {
        id: 'ore_copper',
        name: 'Copper Ore',
        type: ItemType.MATERIAL,
        rarity: ItemRarity.COMMON,
        icon: 'ore_copper',
        description: 'Raw copper ore. Can be smelted into bars.',
        stackable: true,
        maxStack: 99,
        value: 5
    },

    ore_iron: {
        id: 'ore_iron',
        name: 'Iron Ore',
        type: ItemType.MATERIAL,
        rarity: ItemRarity.UNCOMMON,
        icon: 'ore_iron',
        description: 'Raw iron ore. Can be smelted into bars.',
        stackable: true,
        maxStack: 99,
        value: 10
    },

    ore_gold: {
        id: 'ore_gold',
        name: 'Gold Ore',
        type: ItemType.MATERIAL,
        rarity: ItemRarity.RARE,
        icon: 'ore_gold',
        description: 'Raw gold ore. Can be smelted into bars.',
        stackable: true,
        maxStack: 99,
        value: 25
    },

    // === WOOD ===
    wood_oak: {
        id: 'wood_oak',
        name: 'Oak Wood',
        type: ItemType.MATERIAL,
        rarity: ItemRarity.COMMON,
        icon: 'wood_oak',
        description: 'Sturdy oak wood. Good for basic crafting.',
        stackable: true,
        maxStack: 99,
        value: 5
    },

    wood_birch: {
        id: 'wood_birch',
        name: 'Birch Wood',
        type: ItemType.MATERIAL,
        rarity: ItemRarity.UNCOMMON,
        icon: 'wood_birch',
        description: 'Light and flexible birch wood.',
        stackable: true,
        maxStack: 99,
        value: 10
    },

    wood_mahogany: {
        id: 'wood_mahogany',
        name: 'Mahogany Wood',
        type: ItemType.MATERIAL,
        rarity: ItemRarity.RARE,
        icon: 'wood_mahogany',
        description: 'Rich, dark mahogany. Prized for fine crafting.',
        stackable: true,
        maxStack: 99,
        value: 25
    },

    // === QUEST ITEMS ===
    boss_trophy: {
        id: 'boss_trophy',
        name: 'Skull Crown',
        type: ItemType.QUEST,
        rarity: ItemRarity.EPIC,
        icon: 'quest_crown',
        description: 'The crown of the Skeleton Boss',
        stackable: false,
        value: 0
    }
};

// Helper function to get item by ID
export function getItem(itemId) {
    return ITEMS[itemId] || null;
}

// Helper function to create an item stack
export function createItemStack(itemId, quantity = 1) {
    const definition = ITEMS[itemId];
    if (!definition) return null;
    return new ItemStack(definition, quantity);
}

// Helper function to get item icon (emoji representation)
export function getItemIcon(item) {
    // Map item types to emoji icons
    const iconMap = {
        // Consumables
        'potion_red': '🧪',
        'potion_red_large': '🧪',
        'potion_red_infinite': '🏺',
        'potion_speed': '💨',
        'potion_strength': '💪',

        // Warrior weapons
        'sword_rusty': '🗡️',
        'sword_iron': '⚔️',
        'sword_knight': '⚔️',
        'axe_battle': '🪓',

        // Mage weapons
        'staff_apprentice': '🪄',
        'staff_crystal': '🔮',
        'staff_dark': '🔮',

        // Hunter weapons
        'bow_wood': '🏹',
        'crossbow': '🏹',
        'crossbow_shadow': '🏹',

        // Armor
        'helm_leather': '🪖',
        'helm_chain': '⛑️',
        'helm_skull': '💀',
        'chest_leather': '🥋',
        'chest_chain': '🛡️',
        'chest_plate': '🛡️',
        'gloves_leather': '🧤',
        'gloves_chain': '🧤',
        'boots_leather': '👢',
        'boots_chain': '👢',

        // Accessories
        'ring_copper': '💍',
        'ring_silver': '💍',
        'ring_bone': '💀',
        'amulet_wood': '📿',
        'amulet_skull': '💀',

        // Materials
        'mat_bone': '🦴',
        'mat_essence': '✨',
        'mat_key': '🔑',

        // Fish (raw)
        'fish_common': '🐟',
        'fish_uncommon': '🐠',
        'fish_rare': '🐡',
        'fish_epic': '🎏',

        // Ores
        'ore_copper': '🟤',
        'ore_iron': '⚫',
        'ore_gold': '🟡',

        // Wood
        'wood_oak': '🪵',
        'wood_birch': '🪵',
        'wood_mahogany': '🪵',

        // Quest
        'quest_crown': '👑'
    };

    // Check for icon in map
    if (item.icon && iconMap[item.icon]) {
        return iconMap[item.icon];
    }

    // Fallback based on type
    switch (item.type) {
        case ItemType.CONSUMABLE:
            return '🧪';
        case ItemType.WEAPON:
            return '⚔️';
        case ItemType.ARMOR:
            return '🛡️';
        case ItemType.ACCESSORY:
            return '💍';
        case ItemType.MATERIAL:
            return '📦';
        case ItemType.QUEST:
            return '⭐';
        default:
            return '❓';
    }
}
