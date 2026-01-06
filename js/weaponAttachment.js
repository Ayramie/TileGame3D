import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AssetManifest, getEquipmentPath } from './assetManifest.js';

// Weapon attachment system for KayKit characters
export class WeaponAttachment {
    constructor(character) {
        this.character = character;
        this.loader = new GLTFLoader();

        // Currently equipped items
        this.rightHandWeapon = null;
        this.leftHandItem = null; // Shield or secondary weapon

        // Bone references (set when weapon is attached)
        this.rightHandBone = null;
        this.leftHandBone = null;
    }

    // Find hand bones in the character model
    findHandBones() {
        if (!this.character || !this.character.model) return false;

        this.character.model.traverse((child) => {
            if (child.isBone) {
                const name = child.name.toLowerCase();
                if (name.includes('hand') && name.includes('r')) {
                    this.rightHandBone = child;
                } else if (name.includes('hand') && name.includes('l')) {
                    this.leftHandBone = child;
                }
            }
        });

        return !!(this.rightHandBone || this.leftHandBone);
    }

    // Load and attach a weapon to right hand
    async attachWeapon(category, weaponName) {
        const path = getEquipmentPath(category, weaponName);
        if (!path) {
            console.warn(`Weapon not found: ${category}/${weaponName}`);
            return false;
        }

        // Ensure we have bone references
        if (!this.rightHandBone) {
            this.findHandBones();
        }
        if (!this.rightHandBone) {
            console.warn('Right hand bone not found');
            return false;
        }

        // Remove existing weapon
        this.detachWeapon();

        try {
            const gltf = await this.loadGLTF(path);
            this.rightHandWeapon = gltf.scene;

            // Setup weapon mesh
            this.rightHandWeapon.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            // Position adjustments for different weapon types
            this.applyWeaponOffset(this.rightHandWeapon, category, weaponName);

            // Attach to hand bone
            this.rightHandBone.add(this.rightHandWeapon);

            console.log(`Attached weapon: ${category}/${weaponName}`);
            return true;
        } catch (error) {
            console.error(`Failed to load weapon ${weaponName}:`, error);
            return false;
        }
    }

    // Load and attach a shield or off-hand item
    async attachShield(category, shieldName) {
        const path = getEquipmentPath(category, shieldName);
        if (!path) {
            console.warn(`Shield not found: ${category}/${shieldName}`);
            return false;
        }

        // Ensure we have bone references
        if (!this.leftHandBone) {
            this.findHandBones();
        }
        if (!this.leftHandBone) {
            console.warn('Left hand bone not found');
            return false;
        }

        // Remove existing item
        this.detachShield();

        try {
            const gltf = await this.loadGLTF(path);
            this.leftHandItem = gltf.scene;

            // Setup shield mesh
            this.leftHandItem.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            // Position adjustments
            this.applyShieldOffset(this.leftHandItem, category, shieldName);

            // Attach to left hand bone
            this.leftHandBone.add(this.leftHandItem);

            console.log(`Attached shield: ${category}/${shieldName}`);
            return true;
        } catch (error) {
            console.error(`Failed to load shield ${shieldName}:`, error);
            return false;
        }
    }

    // Apply position/rotation offset for weapons based on type
    applyWeaponOffset(weapon, category, name) {
        // Default offset - adjust based on weapon type
        weapon.scale.setScalar(1.0);

        if (category === 'weapons') {
            if (name.includes('sword')) {
                weapon.rotation.set(Math.PI / 2, 0, 0);
                weapon.position.set(0, 0, 0.1);
            } else if (name.includes('axe')) {
                weapon.rotation.set(Math.PI / 2, 0, 0);
                weapon.position.set(0, 0, 0.1);
            } else if (name.includes('dagger')) {
                weapon.rotation.set(Math.PI / 2, 0, 0);
                weapon.position.set(0, 0, 0.05);
            }
        } else if (category === 'magic') {
            if (name.includes('staff')) {
                weapon.rotation.set(0, 0, -Math.PI / 2);
                weapon.position.set(0, 0.5, 0);
            } else if (name.includes('wand')) {
                weapon.rotation.set(Math.PI / 2, 0, 0);
                weapon.position.set(0, 0, 0.05);
            }
        } else if (category === 'ranged') {
            if (name.includes('bow')) {
                weapon.rotation.set(0, Math.PI / 2, 0);
                weapon.position.set(0.1, 0, 0);
            } else if (name.includes('crossbow')) {
                weapon.rotation.set(0, 0, 0);
                weapon.position.set(0, 0, 0.1);
            }
        } else if (category === 'skeleton') {
            // Skeleton weapons
            weapon.rotation.set(Math.PI / 2, 0, 0);
            weapon.position.set(0, 0, 0.1);
        }
    }

    // Apply position/rotation offset for shields
    applyShieldOffset(shield, category, name) {
        shield.scale.setScalar(1.0);

        // Position shield on forearm/wrist area
        shield.rotation.set(0, Math.PI, -Math.PI / 4);
        shield.position.set(0, -0.1, 0.15);
    }

    // Detach current weapon
    detachWeapon() {
        if (this.rightHandWeapon) {
            if (this.rightHandBone) {
                this.rightHandBone.remove(this.rightHandWeapon);
            }
            this.disposeModel(this.rightHandWeapon);
            this.rightHandWeapon = null;
        }
    }

    // Detach current shield
    detachShield() {
        if (this.leftHandItem) {
            if (this.leftHandBone) {
                this.leftHandBone.remove(this.leftHandItem);
            }
            this.disposeModel(this.leftHandItem);
            this.leftHandItem = null;
        }
    }

    // Detach all equipment
    detachAll() {
        this.detachWeapon();
        this.detachShield();
    }

    // Load GLTF model
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

    // Dispose of a model and its resources
    disposeModel(model) {
        if (!model) return;

        model.traverse((child) => {
            if (child.geometry) {
                child.geometry.dispose();
            }
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
    }

    // Cleanup
    dispose() {
        this.detachAll();
        this.rightHandBone = null;
        this.leftHandBone = null;
    }
}

// Preset equipment loadouts
export const EquipmentLoadouts = {
    warrior: {
        weapon: { category: 'weapons', name: 'sword1h' },
        shield: { category: 'shields', name: 'round' }
    },
    knight: {
        weapon: { category: 'weapons', name: 'sword2h' },
        shield: null
    },
    barbarian: {
        weapon: { category: 'weapons', name: 'axe2h' },
        shield: null
    },
    ranger: {
        weapon: { category: 'ranged', name: 'bowWithString' },
        shield: null
    },
    rogue: {
        weapon: { category: 'weapons', name: 'dagger' },
        shield: null
    },
    mage: {
        weapon: { category: 'magic', name: 'staff' },
        shield: null
    },
    skeletonWarrior: {
        weapon: { category: 'skeleton', name: 'blade' },
        shield: { category: 'skeleton', name: 'shieldLargeA' }
    },
    skeletonMage: {
        weapon: { category: 'skeleton', name: 'staff' },
        shield: null
    },
    skeletonRogue: {
        weapon: { category: 'skeleton', name: 'axe' },
        shield: null
    }
};

// Helper to equip a full loadout
export async function equipLoadout(weaponAttachment, loadoutName) {
    const loadout = EquipmentLoadouts[loadoutName];
    if (!loadout) {
        console.warn(`Loadout not found: ${loadoutName}`);
        return false;
    }

    let success = true;

    if (loadout.weapon) {
        const weaponSuccess = await weaponAttachment.attachWeapon(
            loadout.weapon.category,
            loadout.weapon.name
        );
        success = success && weaponSuccess;
    }

    if (loadout.shield) {
        const shieldSuccess = await weaponAttachment.attachShield(
            loadout.shield.category,
            loadout.shield.name
        );
        success = success && shieldSuccess;
    }

    return success;
}
