import { ItemType, ItemStack, ITEMS } from './itemDatabase.js';

export class Inventory {
    constructor(size = 24) {
        this.size = size;                           // 24 slots (6x4 grid)
        this.slots = new Array(size).fill(null);    // Main inventory slots
        this.hotbar = new Array(5).fill(null);      // 5 hotbar slots (keys 1-5)
        this.equipment = {
            weapon: null,
            helmet: null,
            chest: null,
            gloves: null,
            boots: null,
            ring: null,
            amulet: null
        };

        // Cooldown tracking for consumables
        this.itemCooldowns = {};  // itemId -> remainingCooldown

        // Gold currency
        this.gold = 0;

        // Event callbacks
        this.onInventoryChanged = null;
        this.onEquipmentChanged = null;
        this.onHotbarChanged = null;
    }

    // Add item to inventory - returns overflow quantity
    addItem(itemDef, quantity = 1) {
        let remaining = quantity;

        // If stackable, try to stack with existing
        if (itemDef.stackable) {
            for (let i = 0; i < this.size && remaining > 0; i++) {
                const slot = this.slots[i];
                if (slot && slot.definition.id === itemDef.id) {
                    const maxStack = itemDef.maxStack || 99;
                    const canAdd = Math.min(remaining, maxStack - slot.quantity);
                    slot.quantity += canAdd;
                    remaining -= canAdd;
                }
            }
        }

        // Add to empty slots
        while (remaining > 0) {
            const emptySlot = this.slots.findIndex(s => s === null);
            if (emptySlot === -1) break;  // Inventory full

            const maxStack = itemDef.maxStack || 99;
            const stackSize = itemDef.stackable
                ? Math.min(remaining, maxStack)
                : 1;

            this.slots[emptySlot] = new ItemStack(itemDef, stackSize);
            remaining -= stackSize;
        }

        this._notifyChange();
        return remaining;  // Return overflow
    }

    // Add item by ID
    addItemById(itemId, quantity = 1) {
        const itemDef = ITEMS[itemId];
        if (!itemDef) {
            console.warn(`Item not found: ${itemId}`);
            return quantity;
        }
        return this.addItem(itemDef, quantity);
    }

    // Remove item by slot index
    removeItem(slotIndex, quantity = 1) {
        const slot = this.slots[slotIndex];
        if (!slot) return false;

        slot.quantity -= quantity;
        if (slot.quantity <= 0) {
            this.slots[slotIndex] = null;
        }

        this._notifyChange();
        return true;
    }

    // Remove item by ID (finds first stack)
    removeItemById(itemId, quantity = 1) {
        let remaining = quantity;

        for (let i = 0; i < this.size && remaining > 0; i++) {
            const slot = this.slots[i];
            if (slot && slot.definition.id === itemId) {
                const toRemove = Math.min(remaining, slot.quantity);
                slot.quantity -= toRemove;
                remaining -= toRemove;

                if (slot.quantity <= 0) {
                    this.slots[i] = null;
                }
            }
        }

        if (remaining < quantity) {
            this._notifyChange();
        }

        return remaining === 0;
    }

    // Use consumable item from inventory slot
    useItem(slotIndex, player) {
        const stack = this.slots[slotIndex];
        if (!stack) return null;

        const item = stack.definition;
        if (item.type !== ItemType.CONSUMABLE) return null;

        // Check cooldown
        if (this.itemCooldowns[item.id] > 0) return null;

        // Execute use effect
        let result = null;
        if (item.useEffect) {
            result = item.useEffect(player);
        }

        // Start cooldown
        if (item.cooldown > 0) {
            this.itemCooldowns[item.id] = item.cooldown;
        }

        // Consume item (unless infinite)
        if (!item.infinite) {
            this.removeItem(slotIndex, 1);
        }

        return result;
    }

    // Equip item from inventory
    equipItem(slotIndex, player = null) {
        const stack = this.slots[slotIndex];
        if (!stack || !stack.definition.equipSlot) return false;

        const item = stack.definition;
        const slot = item.equipSlot;

        // Check class restriction (adventurer can equip anything)
        if (item.classRestriction && player) {
            const playerClass = player.className || 'warrior';
            if (playerClass !== 'adventurer' && !item.classRestriction.includes(playerClass.toLowerCase())) {
                return false;  // Can't equip this class's item
            }
        }

        // Swap with currently equipped
        const current = this.equipment[slot];
        this.equipment[slot] = stack;
        this.slots[slotIndex] = current;

        this._notifyEquipChange();
        this._notifyChange();
        return true;
    }

    // Unequip to inventory
    unequipItem(equipSlot) {
        const equipped = this.equipment[equipSlot];
        if (!equipped) return false;

        // Find empty slot
        const emptySlot = this.slots.findIndex(s => s === null);
        if (emptySlot === -1) return false;  // Inventory full

        this.slots[emptySlot] = equipped;
        this.equipment[equipSlot] = null;

        this._notifyEquipChange();
        this._notifyChange();
        return true;
    }

    // Assign item to hotbar (by item ID reference)
    assignToHotbar(inventorySlot, hotbarSlot) {
        if (hotbarSlot < 0 || hotbarSlot >= 5) return false;

        const stack = this.slots[inventorySlot];
        if (!stack || stack.definition.type !== ItemType.CONSUMABLE) return false;

        // Hotbar stores reference to item definition ID
        this.hotbar[hotbarSlot] = stack.definition.id;
        this._notifyHotbarChange();
        return true;
    }

    // Clear hotbar slot
    clearHotbarSlot(hotbarSlot) {
        if (hotbarSlot < 0 || hotbarSlot >= 5) return false;
        this.hotbar[hotbarSlot] = null;
        this._notifyHotbarChange();
        return true;
    }

    // Use hotbar item
    useHotbarItem(hotbarSlot, player) {
        const hotbarEntry = this.hotbar[hotbarSlot];
        if (!hotbarEntry) return null;

        const slotIndex = hotbarEntry.inventorySlot;
        const stack = this.slots[slotIndex];
        if (!stack) return null;

        return this.useItem(slotIndex, player);
    }

    // Get hotbar item cooldown percentage (0-1)
    getHotbarCooldown(hotbarSlot) {
        const itemId = this.hotbar[hotbarSlot];
        if (!itemId) return 0;

        const item = ITEMS[itemId];
        if (!item || !item.cooldown) return 0;

        const remaining = this.itemCooldowns[itemId] || 0;
        return remaining / item.cooldown;
    }

    // Calculate total stats from equipment
    getEquipmentStats() {
        const stats = {
            damage: 0,
            defense: 0,
            maxHealth: 0,
            attackSpeed: 0,
            magicPower: 0,
            moveSpeed: 0
        };

        for (const slot in this.equipment) {
            const stack = this.equipment[slot];
            if (stack && stack.definition.stats) {
                for (const stat in stack.definition.stats) {
                    stats[stat] = (stats[stat] || 0) + stack.definition.stats[stat];
                }
            }
        }

        return stats;
    }

    // Update cooldowns each frame
    update(deltaTime) {
        for (const itemId in this.itemCooldowns) {
            if (this.itemCooldowns[itemId] > 0) {
                this.itemCooldowns[itemId] -= deltaTime;
                if (this.itemCooldowns[itemId] < 0) {
                    this.itemCooldowns[itemId] = 0;
                }
            }
        }
    }

    // Get item count by ID
    getItemCount(itemId) {
        return this.slots.reduce((sum, slot) => {
            if (slot && slot.definition.id === itemId) {
                return sum + slot.quantity;
            }
            return sum;
        }, 0);
    }

    // Alias for getItemCount (used by crafting system)
    countItem(itemId) {
        return this.getItemCount(itemId);
    }

    // Check if inventory has space
    hasSpace() {
        return this.slots.some(s => s === null);
    }

    // Get number of empty slots
    getEmptySlotCount() {
        return this.slots.filter(s => s === null).length;
    }

    // Swap two inventory slots
    swapSlots(indexA, indexB) {
        if (indexA < 0 || indexA >= this.size) return false;
        if (indexB < 0 || indexB >= this.size) return false;

        const temp = this.slots[indexA];
        this.slots[indexA] = this.slots[indexB];
        this.slots[indexB] = temp;
        this._notifyChange();
        return true;
    }

    // Try to stack two slots (if same item and stackable)
    tryStackSlots(fromIndex, toIndex) {
        const fromSlot = this.slots[fromIndex];
        const toSlot = this.slots[toIndex];

        if (!fromSlot || !toSlot) return false;
        if (fromSlot.definition.id !== toSlot.definition.id) return false;
        if (!fromSlot.definition.stackable) return false;

        const maxStack = fromSlot.definition.maxStack || 99;
        const canAdd = Math.min(fromSlot.quantity, maxStack - toSlot.quantity);

        if (canAdd > 0) {
            toSlot.quantity += canAdd;
            fromSlot.quantity -= canAdd;

            if (fromSlot.quantity <= 0) {
                this.slots[fromIndex] = null;
            }

            this._notifyChange();
            return true;
        }

        return false;
    }

    // Add gold
    addGold(amount) {
        this.gold += amount;
        this._notifyChange();
    }

    // Remove gold (returns false if not enough)
    removeGold(amount) {
        if (this.gold < amount) return false;
        this.gold -= amount;
        this._notifyChange();
        return true;
    }

    // Give starter items for a class
    giveStarterItems(className) {
        // Everyone gets the infinite health potion
        this.addItemById('infinite_health_potion', 1);

        // Find the slot where infinite potion was added and assign to hotbar slot 1
        for (let i = 0; i < this.slots.length; i++) {
            if (this.slots[i] && this.slots[i].definition.id === 'infinite_health_potion') {
                this.hotbar[0] = { inventorySlot: i };
                break;
            }
        }

        // Testing: Add some raw fish for cooking
        this.addItemById('fish_small_trout', 3);
        this.addItemById('fish_bass', 2);
        this.addItemById('fish_golden_carp', 1);
    }

    _notifyChange() {
        if (this.onInventoryChanged) this.onInventoryChanged();
    }

    _notifyEquipChange() {
        if (this.onEquipmentChanged) this.onEquipmentChanged();
    }

    _notifyHotbarChange() {
        if (this.onHotbarChanged) this.onHotbarChanged();
    }
}
