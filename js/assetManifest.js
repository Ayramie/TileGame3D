// KayKit Asset Manifest - Centralized asset path configuration
// All paths are relative to the project root

export const AssetManifest = {
    // Character models (GLB)
    characters: {
        adventurers: {
            knight: { path: 'assets/kaykit/characters/adventurers/Knight.glb', rig: 'medium' },
            mage: { path: 'assets/kaykit/characters/adventurers/Mage.glb', rig: 'medium' },
            barbarian: { path: 'assets/kaykit/characters/adventurers/Barbarian.glb', rig: 'medium' },
            ranger: { path: 'assets/kaykit/characters/adventurers/Ranger.glb', rig: 'medium' },
            rogue: { path: 'assets/kaykit/characters/adventurers/Rogue.glb', rig: 'medium' },
            rogueHooded: { path: 'assets/kaykit/characters/adventurers/Rogue_Hooded.glb', rig: 'medium' }
        },
        skeletons: {
            warrior: { path: 'assets/kaykit/characters/skeletons/Skeleton_Warrior.glb', rig: 'medium' },
            mage: { path: 'assets/kaykit/characters/skeletons/Skeleton_Mage.glb', rig: 'medium' },
            rogue: { path: 'assets/kaykit/characters/skeletons/Skeleton_Rogue.glb', rig: 'medium' },
            minion: { path: 'assets/kaykit/characters/skeletons/Skeleton_Minion.glb', rig: 'medium' }
        },
        textures: {
            knight: 'assets/kaykit/characters/textures/knight_texture.png',
            mage: 'assets/kaykit/characters/textures/mage_texture.png',
            barbarian: 'assets/kaykit/characters/textures/barbarian_texture.png',
            ranger: 'assets/kaykit/characters/textures/ranger_texture.png',
            rogue: 'assets/kaykit/characters/textures/rogue_texture.png',
            skeleton: 'assets/kaykit/characters/textures/skeleton_texture.png'
        }
    },

    // Animation sets (GLB)
    animations: {
        rigMedium: {
            combatMelee: 'assets/kaykit/animations/rig_medium/Rig_Medium_CombatMelee.glb',
            combatRanged: 'assets/kaykit/animations/rig_medium/Rig_Medium_CombatRanged.glb',
            general: 'assets/kaykit/animations/rig_medium/Rig_Medium_General.glb',
            movementAdvanced: 'assets/kaykit/animations/rig_medium/Rig_Medium_MovementAdvanced.glb',
            movementBasic: 'assets/kaykit/animations/rig_medium/Rig_Medium_MovementBasic.glb',
            simulation: 'assets/kaykit/animations/rig_medium/Rig_Medium_Simulation.glb',
            special: 'assets/kaykit/animations/rig_medium/Rig_Medium_Special.glb',
            tools: 'assets/kaykit/animations/rig_medium/Rig_Medium_Tools.glb'
        },
        rigLarge: {
            combatMelee: 'assets/kaykit/animations/rig_large/Rig_Large_CombatMelee.glb',
            general: 'assets/kaykit/animations/rig_large/Rig_Large_General.glb',
            movementAdvanced: 'assets/kaykit/animations/rig_large/Rig_Large_MovementAdvanced.glb',
            movementBasic: 'assets/kaykit/animations/rig_large/Rig_Large_MovementBasic.glb',
            simulation: 'assets/kaykit/animations/rig_large/Rig_Large_Simulation.glb',
            special: 'assets/kaykit/animations/rig_large/Rig_Large_Special.glb'
        }
    },

    // Equipment (GLTF)
    equipment: {
        weapons: {
            sword1h: 'assets/kaykit/equipment/weapons/sword_1handed.gltf',
            sword2h: 'assets/kaykit/equipment/weapons/sword_2handed.gltf',
            sword2hColor: 'assets/kaykit/equipment/weapons/sword_2handed_color.gltf',
            axe1h: 'assets/kaykit/equipment/weapons/axe_1handed.gltf',
            axe2h: 'assets/kaykit/equipment/weapons/axe_2handed.gltf',
            dagger: 'assets/kaykit/equipment/weapons/dagger.gltf'
        },
        shields: {
            badge: 'assets/kaykit/equipment/shields/shield_badge.gltf',
            badgeColor: 'assets/kaykit/equipment/shields/shield_badge_color.gltf',
            round: 'assets/kaykit/equipment/shields/shield_round.gltf',
            roundBarbarian: 'assets/kaykit/equipment/shields/shield_round_barbarian.gltf',
            roundColor: 'assets/kaykit/equipment/shields/shield_round_color.gltf',
            spikes: 'assets/kaykit/equipment/shields/shield_spikes.gltf',
            spikesColor: 'assets/kaykit/equipment/shields/shield_spikes_color.gltf',
            square: 'assets/kaykit/equipment/shields/shield_square.gltf',
            squareColor: 'assets/kaykit/equipment/shields/shield_square_color.gltf'
        },
        magic: {
            staff: 'assets/kaykit/equipment/magic/staff.gltf',
            wand: 'assets/kaykit/equipment/magic/wand.gltf',
            spellbookClosed: 'assets/kaykit/equipment/magic/spellbook_closed.gltf',
            spellbookOpen: 'assets/kaykit/equipment/magic/spellbook_open.gltf'
        },
        ranged: {
            bow: 'assets/kaykit/equipment/ranged/bow.gltf',
            bowWithString: 'assets/kaykit/equipment/ranged/bow_withString.gltf',
            crossbow1h: 'assets/kaykit/equipment/ranged/crossbow_1handed.gltf',
            crossbow2h: 'assets/kaykit/equipment/ranged/crossbow_2handed.gltf',
            arrowBow: 'assets/kaykit/equipment/ranged/arrow_bow.gltf',
            arrowBowBundle: 'assets/kaykit/equipment/ranged/arrow_bow_bundle.gltf',
            arrowCrossbow: 'assets/kaykit/equipment/ranged/arrow_crossbow.gltf',
            arrowCrossbowBundle: 'assets/kaykit/equipment/ranged/arrow_crossbow_bundle.gltf',
            quiver: 'assets/kaykit/equipment/ranged/quiver.gltf'
        },
        skeleton: {
            blade: 'assets/kaykit/equipment/skeleton/Skeleton_Blade.gltf',
            axe: 'assets/kaykit/equipment/skeleton/Skeleton_Axe.gltf',
            staff: 'assets/kaykit/equipment/skeleton/Skeleton_Staff.gltf',
            crossbow: 'assets/kaykit/equipment/skeleton/Skeleton_Crossbow.gltf',
            arrow: 'assets/kaykit/equipment/skeleton/Skeleton_Arrow.gltf',
            quiver: 'assets/kaykit/equipment/skeleton/Skeleton_Quiver.gltf',
            shieldLargeA: 'assets/kaykit/equipment/skeleton/Skeleton_Shield_Large_A.gltf',
            shieldLargeB: 'assets/kaykit/equipment/skeleton/Skeleton_Shield_Large_B.gltf',
            shieldSmallA: 'assets/kaykit/equipment/skeleton/Skeleton_Shield_Small_A.gltf',
            shieldSmallB: 'assets/kaykit/equipment/skeleton/Skeleton_Shield_Small_B.gltf'
        }
    },

    // Dungeon environment (GLTF)
    dungeon: {
        walls: {
            basic: 'assets/kaykit/dungeon/structure/walls/wall.gltf',
            arched: 'assets/kaykit/dungeon/structure/walls/wall_arched.gltf',
            broken: 'assets/kaykit/dungeon/structure/walls/wall_broken.gltf',
            corner: 'assets/kaykit/dungeon/structure/walls/wall_corner.gltf',
            cornerSmall: 'assets/kaykit/dungeon/structure/walls/wall_corner_small.gltf',
            doorway: 'assets/kaykit/dungeon/structure/walls/wall_doorway.gltf',
            doorwayClosed: 'assets/kaykit/dungeon/structure/walls/wall_doorway_closed.gltf',
            half: 'assets/kaykit/dungeon/structure/walls/wall_half.gltf',
            windowGated: 'assets/kaykit/dungeon/structure/walls/wall_archedwindow_gated.gltf',
            windowOpen: 'assets/kaykit/dungeon/structure/walls/wall_archedwindow_open.gltf'
        },
        floors: {
            tileLarge: 'assets/kaykit/dungeon/structure/floors/floor_tile_large.gltf',
            tileSmall: 'assets/kaykit/dungeon/structure/floors/floor_tile_small.gltf',
            tileDecorated: 'assets/kaykit/dungeon/structure/floors/floor_tile_small_decorated.gltf',
            tileBrokenA: 'assets/kaykit/dungeon/structure/floors/floor_tile_small_broken_A.gltf',
            tileBrokenB: 'assets/kaykit/dungeon/structure/floors/floor_tile_small_broken_B.gltf',
            dirtLarge: 'assets/kaykit/dungeon/structure/floors/floor_dirt_large.gltf',
            dirtLargeRocky: 'assets/kaykit/dungeon/structure/floors/floor_dirt_large_rocky.gltf',
            dirtSmallA: 'assets/kaykit/dungeon/structure/floors/floor_dirt_small_A.gltf',
            woodLarge: 'assets/kaykit/dungeon/structure/floors/floor_wood_large.gltf',
            woodSmall: 'assets/kaykit/dungeon/structure/floors/floor_wood_small.gltf',
            grate: 'assets/kaykit/dungeon/structure/floors/floor_tile_grate.gltf',
            grateOpen: 'assets/kaykit/dungeon/structure/floors/floor_tile_grate_open.gltf'
        },
        stairs: {
            basic: 'assets/kaykit/dungeon/structure/stairs/stairs.gltf',
            long: 'assets/kaykit/dungeon/structure/stairs/stairs_long.gltf',
            narrow: 'assets/kaykit/dungeon/structure/stairs/stairs_narrow.gltf',
            wide: 'assets/kaykit/dungeon/structure/stairs/stairs_wide.gltf',
            walled: 'assets/kaykit/dungeon/structure/stairs/stairs_walled.gltf',
            wood: 'assets/kaykit/dungeon/structure/stairs/stairs_wood.gltf'
        },
        furniture: {
            tableLong: 'assets/kaykit/dungeon/furniture/table_long.gltf',
            tableMedium: 'assets/kaykit/dungeon/furniture/table_medium.gltf',
            tableSmall: 'assets/kaykit/dungeon/furniture/table_small.gltf',
            tableRound: 'assets/kaykit/dungeon/furniture/table_round.gltf',
            chair: 'assets/kaykit/dungeon/furniture/chair.gltf',
            stool: 'assets/kaykit/dungeon/furniture/stool.gltf',
            bedSingle: 'assets/kaykit/dungeon/furniture/bed_single.gltf',
            bedDouble: 'assets/kaykit/dungeon/furniture/bed_double.gltf',
            shelfSmall: 'assets/kaykit/dungeon/furniture/shelf_small.gltf',
            shelfLarge: 'assets/kaykit/dungeon/furniture/shelf_large.gltf'
        },
        props: {
            barrelLarge: 'assets/kaykit/dungeon/props/barrel_large.gltf',
            barrelSmall: 'assets/kaykit/dungeon/props/barrel_small.gltf',
            barrelSmallStack: 'assets/kaykit/dungeon/props/barrel_small_stack.gltf',
            chest: 'assets/kaykit/dungeon/props/chest.gltf',
            chestOpen: 'assets/kaykit/dungeon/props/chest_open.gltf',
            trunkSmall: 'assets/kaykit/dungeon/props/trunk_small.gltf',
            trunkMedium: 'assets/kaykit/dungeon/props/trunk_medium.gltf',
            trunkLarge: 'assets/kaykit/dungeon/props/trunk_large.gltf',
            cratesStacked: 'assets/kaykit/dungeon/props/crates_stacked.gltf',
            boxSmall: 'assets/kaykit/dungeon/props/box_small.gltf',
            boxMedium: 'assets/kaykit/dungeon/props/box_medium.gltf',
            boxLarge: 'assets/kaykit/dungeon/props/box_large.gltf',
            keg: 'assets/kaykit/dungeon/props/keg.gltf'
        },
        lighting: {
            torch: 'assets/kaykit/dungeon/lighting/torch.gltf',
            torchLit: 'assets/kaykit/dungeon/lighting/torch_lit.gltf',
            torchMounted: 'assets/kaykit/dungeon/lighting/torch_mounted.gltf',
            candleSingle: 'assets/kaykit/dungeon/lighting/candle_single.gltf',
            candleTriple: 'assets/kaykit/dungeon/lighting/candle_triple.gltf',
            candleHolder: 'assets/kaykit/dungeon/lighting/candle_holder.gltf'
        },
        decoration: {
            pillar: 'assets/kaykit/dungeon/decoration/pillar.gltf',
            pillarBroken: 'assets/kaykit/dungeon/decoration/pillar_broken.gltf',
            column: 'assets/kaykit/dungeon/decoration/column.gltf',
            bannerBlue: 'assets/kaykit/dungeon/decoration/banner_blue.gltf',
            bannerRed: 'assets/kaykit/dungeon/decoration/banner_red.gltf',
            bannerGreen: 'assets/kaykit/dungeon/decoration/banner_green.gltf',
            bannerYellow: 'assets/kaykit/dungeon/decoration/banner_yellow.gltf',
            coinGold: 'assets/kaykit/dungeon/decoration/coin_gold.gltf',
            coinSilver: 'assets/kaykit/dungeon/decoration/coin_silver.gltf',
            coinStackGold: 'assets/kaykit/dungeon/decoration/coin_stack_gold.gltf',
            coinStackSilver: 'assets/kaykit/dungeon/decoration/coin_stack_silver.gltf',
            keyGold: 'assets/kaykit/dungeon/decoration/key_gold.gltf',
            keySilver: 'assets/kaykit/dungeon/decoration/key_silver.gltf',
            rubblePile: 'assets/kaykit/dungeon/decoration/rubble_pile.gltf'
        },
        texture: 'assets/kaykit/dungeon/texture/dungeon_texture.png'
    }
};

// Helper function to get character path
export function getCharacterPath(type, name) {
    return AssetManifest.characters[type]?.[name]?.path;
}

// Helper function to get animation path
export function getAnimationPath(rigType, animName) {
    return AssetManifest.animations[rigType]?.[animName];
}

// Helper function to get equipment path
export function getEquipmentPath(category, name) {
    return AssetManifest.equipment[category]?.[name];
}

// Helper function to get dungeon asset path
export function getDungeonPath(category, name) {
    return AssetManifest.dungeon[category]?.[name];
}
