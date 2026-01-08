import { ITEMS, ItemType, getItemIcon } from './itemDatabase.js';

// Inventory UI Controller
export class InventoryUI {
    constructor(game) {
        this.game = game;
        this.isOpen = false;
        this.selectedSlot = null;

        // DOM elements
        this.panel = document.getElementById('inventory-panel');
        this.grid = document.getElementById('inventory-grid');
        this.closeBtn = document.getElementById('inventory-close');
        this.tooltip = document.getElementById('item-tooltip');

        // Hotbar elements
        this.hotbarSlots = document.querySelectorAll('.hotbar-slot');
        this.goldDisplay = document.getElementById('gold-amount');

        // Equipment slot elements
        this.equipSlots = document.querySelectorAll('.equip-slot');

        // Stats display
        this.statDamage = document.getElementById('stat-damage');
        this.statDefense = document.getElementById('stat-defense');

        this.initGrid();
        this.initEventListeners();
    }

    initGrid() {
        // Create 24 inventory slots
        this.grid.innerHTML = '';
        for (let i = 0; i < 24; i++) {
            const slot = document.createElement('div');
            slot.className = 'inv-slot';
            slot.dataset.slot = i;

            const icon = document.createElement('div');
            icon.className = 'item-icon';
            slot.appendChild(icon);

            const quantity = document.createElement('div');
            quantity.className = 'item-quantity';
            slot.appendChild(quantity);

            this.grid.appendChild(slot);
        }
    }

    initEventListeners() {
        // Close button
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.close());
        }

        // Inventory slots
        this.grid.addEventListener('click', (e) => {
            const slot = e.target.closest('.inv-slot');
            if (slot) {
                this.onInventorySlotClick(parseInt(slot.dataset.slot));
            }
        });

        // Right-click to assign to hotbar
        this.grid.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const slot = e.target.closest('.inv-slot');
            if (slot) {
                this.onInventorySlotRightClick(parseInt(slot.dataset.slot));
            }
        });

        // Inventory slot hover for tooltip
        this.grid.addEventListener('mousemove', (e) => {
            const slot = e.target.closest('.inv-slot');
            if (slot) {
                this.showTooltipForInventory(parseInt(slot.dataset.slot), e);
            }
        });

        this.grid.addEventListener('mouseleave', () => {
            this.hideTooltip();
        });

        // Equipment slots
        this.equipSlots.forEach(slot => {
            slot.addEventListener('click', () => {
                this.onEquipSlotClick(slot.dataset.slot);
            });

            slot.addEventListener('mousemove', (e) => {
                this.showTooltipForEquipment(slot.dataset.slot, e);
            });

            slot.addEventListener('mouseleave', () => {
                this.hideTooltip();
            });
        });

        // Hotbar slots
        this.hotbarSlots.forEach(slot => {
            slot.addEventListener('click', () => {
                const slotIndex = parseInt(slot.dataset.slot);
                this.useHotbarSlot(slotIndex);
            });

            slot.addEventListener('mousemove', (e) => {
                this.showTooltipForHotbar(parseInt(slot.dataset.slot), e);
            });

            slot.addEventListener('mouseleave', () => {
                this.hideTooltip();
            });
        });

        // Keyboard - ESC to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
                e.preventDefault();
            }
        });
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        this.isOpen = true;
        this.panel.classList.add('visible');
        this.refresh();
    }

    close() {
        this.isOpen = false;
        this.panel.classList.remove('visible');
        this.hideTooltip();
    }

    getInventory() {
        return this.game?.player?.inventory;
    }

    refresh() {
        const inventory = this.getInventory();
        if (!inventory) return;

        this.refreshInventoryGrid(inventory);
        this.refreshEquipment(inventory);
        this.refreshHotbar(inventory);
        this.refreshStats(inventory);
        this.refreshGold(inventory);
    }

    refreshInventoryGrid(inventory) {
        const slots = this.grid.querySelectorAll('.inv-slot');

        slots.forEach((slotEl, i) => {
            const item = inventory.slots[i];
            const icon = slotEl.querySelector('.item-icon');
            const quantity = slotEl.querySelector('.item-quantity');

            // Clear previous classes
            slotEl.classList.remove('has-item', 'rarity-common', 'rarity-uncommon', 'rarity-rare', 'rarity-epic');

            if (item) {
                slotEl.classList.add('has-item');
                slotEl.classList.add(`rarity-${item.definition.rarity.name}`);
                icon.textContent = getItemIcon(item.definition);
                quantity.textContent = item.quantity > 1 ? item.quantity : '';
            } else {
                icon.textContent = '';
                quantity.textContent = '';
            }
        });
    }

    refreshEquipment(inventory) {
        this.equipSlots.forEach(slotEl => {
            const slotName = slotEl.dataset.slot;
            const equipped = inventory.equipment[slotName];

            // Clear previous classes
            slotEl.classList.remove('has-item', 'rarity-common', 'rarity-uncommon', 'rarity-rare', 'rarity-epic');

            // Get or create icon element
            let icon = slotEl.querySelector('.equip-icon');
            if (!icon) {
                icon = document.createElement('div');
                icon.className = 'equip-icon';
                icon.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:18px;';
                slotEl.insertBefore(icon, slotEl.firstChild);
            }

            if (equipped) {
                slotEl.classList.add('has-item');
                slotEl.classList.add(`rarity-${equipped.definition.rarity.name}`);
                icon.textContent = getItemIcon(equipped.definition);
            } else {
                icon.textContent = '';
            }
        });
    }

    refreshHotbar(inventory) {
        this.hotbarSlots.forEach((slotEl, i) => {
            const hotbarItem = inventory.hotbar[i];
            const itemEl = slotEl.querySelector('.hotbar-item');
            const quantityEl = slotEl.querySelector('.hotbar-quantity');
            const cooldownEl = slotEl.querySelector('.hotbar-cooldown');

            // Clear previous classes
            slotEl.classList.remove('has-item', 'rarity-common', 'rarity-uncommon', 'rarity-rare', 'rarity-epic', 'on-cooldown');

            if (hotbarItem) {
                const invSlot = inventory.slots[hotbarItem.inventorySlot];
                if (invSlot && invSlot.definition) {
                    slotEl.classList.add('has-item');
                    slotEl.classList.add(`rarity-${invSlot.definition.rarity.name}`);
                    itemEl.textContent = getItemIcon(invSlot.definition);
                    quantityEl.textContent = invSlot.quantity > 1 ? invSlot.quantity : '';

                    // Check cooldown
                    const cooldown = inventory.itemCooldowns[invSlot.definition.id];
                    if (cooldown && cooldown > 0) {
                        slotEl.classList.add('on-cooldown');
                        const cooldownPercent = (cooldown / invSlot.definition.cooldown) * 100;
                        cooldownEl.style.height = `${cooldownPercent}%`;
                    } else {
                        cooldownEl.style.height = '0%';
                    }
                } else {
                    // Item was removed from inventory, clear hotbar reference
                    inventory.hotbar[i] = null;
                    itemEl.textContent = '';
                    quantityEl.textContent = '';
                }
            } else {
                itemEl.textContent = '';
                quantityEl.textContent = '';
            }
        });
    }

    refreshStats(inventory) {
        const stats = inventory.getEquipmentStats();
        if (this.statDamage) {
            this.statDamage.textContent = stats.damage || 0;
        }
        if (this.statDefense) {
            this.statDefense.textContent = stats.defense || 0;
        }
    }

    refreshGold(inventory) {
        if (this.goldDisplay) {
            this.goldDisplay.textContent = inventory.gold;
        }
    }

    onInventorySlotClick(slotIndex) {
        const inventory = this.getInventory();
        if (!inventory) return;

        const item = inventory.slots[slotIndex];
        if (!item) return;

        // Use consumables, equip equipment
        if (item.definition.type === ItemType.CONSUMABLE) {
            if (inventory.useItem(slotIndex, this.game.player)) {
                // Particle effect
                if (this.game.particles && this.game.particles.itemUse) {
                    this.game.particles.itemUse(this.game.player.position, 0x44ff44);
                }
            }
        } else if (item.definition.equipSlot) {
            inventory.equipItem(slotIndex);
        }

        this.refresh();
    }

    onInventorySlotRightClick(slotIndex) {
        const inventory = this.getInventory();
        if (!inventory) return;

        const item = inventory.slots[slotIndex];
        if (!item || item.definition.type !== ItemType.CONSUMABLE) return;

        // Find first empty hotbar slot
        for (let i = 0; i < 5; i++) {
            if (!inventory.hotbar[i]) {
                inventory.hotbar[i] = { inventorySlot: slotIndex };
                this.refreshHotbar(inventory);
                return;
            }
        }
    }

    onEquipSlotClick(slotName) {
        const inventory = this.getInventory();
        if (!inventory) return;

        const equipped = inventory.equipment[slotName];
        if (equipped) {
            inventory.unequipItem(slotName);
            this.refresh();
        }
    }

    useHotbarSlot(slotIndex) {
        const inventory = this.getInventory();
        if (!inventory) return;

        if (inventory.useHotbarItem(slotIndex, this.game.player)) {
            // Particle effect
            if (this.game.particles && this.game.particles.itemUse) {
                this.game.particles.itemUse(this.game.player.position, 0x44ff44);
            }
            this.refreshHotbar(inventory);
        }
    }

    showTooltipForInventory(slotIndex, event) {
        const inventory = this.getInventory();
        if (!inventory) return;

        const item = inventory.slots[slotIndex];
        if (item) {
            this.showTooltip(item.definition, event);
        } else {
            this.hideTooltip();
        }
    }

    showTooltipForEquipment(slotName, event) {
        const inventory = this.getInventory();
        if (!inventory) return;

        const item = inventory.equipment[slotName];
        if (item) {
            this.showTooltip(item.definition, event);
        } else {
            this.hideTooltip();
        }
    }

    showTooltipForHotbar(slotIndex, event) {
        const inventory = this.getInventory();
        if (!inventory) return;

        const hotbarItem = inventory.hotbar[slotIndex];
        if (hotbarItem) {
            const invSlot = inventory.slots[hotbarItem.inventorySlot];
            if (invSlot && invSlot.definition) {
                this.showTooltip(invSlot.definition, event);
                return;
            }
        }
        this.hideTooltip();
    }

    showTooltip(item, event) {
        const nameEl = document.getElementById('tooltip-name');
        const typeEl = document.getElementById('tooltip-type');
        const statsEl = document.getElementById('tooltip-stats');
        const descEl = document.getElementById('tooltip-desc');

        // Name with rarity color
        nameEl.textContent = item.name;
        nameEl.className = `rarity-${item.rarity.name}`;

        // Type
        let typeText = item.type;
        if (item.equipSlot) {
            typeText += ` (${item.equipSlot})`;
        }
        typeEl.textContent = typeText;

        // Stats
        statsEl.innerHTML = '';
        if (item.stats) {
            for (const [stat, value] of Object.entries(item.stats)) {
                const statDiv = document.createElement('div');
                statDiv.textContent = `+${value} ${stat}`;
                statsEl.appendChild(statDiv);
            }
        }
        if (item.healAmount) {
            const healDiv = document.createElement('div');
            healDiv.textContent = `Restores ${item.healAmount} HP`;
            statsEl.appendChild(healDiv);
        }
        if (item.buffType) {
            const buffDiv = document.createElement('div');
            const buffName = item.buffType.charAt(0).toUpperCase() + item.buffType.slice(1);
            const buffPercent = Math.round(item.buffValue * 100);
            buffDiv.textContent = `+${buffPercent}% ${buffName} for ${item.buffDuration}s`;
            statsEl.appendChild(buffDiv);
        }

        // Description
        descEl.textContent = item.description || '';

        // Position tooltip
        this.tooltip.style.left = (event.clientX + 15) + 'px';
        this.tooltip.style.top = (event.clientY + 15) + 'px';

        // Keep tooltip on screen
        const rect = this.tooltip.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            this.tooltip.style.left = (event.clientX - rect.width - 15) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            this.tooltip.style.top = (event.clientY - rect.height - 15) + 'px';
        }

        this.tooltip.classList.add('visible');
    }

    hideTooltip() {
        this.tooltip.classList.remove('visible');
    }

    // Called from game.js to update hotbar and gold display
    updateHotbarDisplay() {
        const inventory = this.getInventory();
        if (inventory) {
            this.refreshHotbar(inventory);
            this.refreshGold(inventory);
        }
    }
}
