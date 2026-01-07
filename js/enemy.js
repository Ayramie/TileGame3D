import * as THREE from 'three';

export class Enemy {
    constructor(scene, x, z) {
        this.scene = scene;
        this.position = new THREE.Vector3(x, 0, z);

        this.maxHealth = 100;
        this.health = this.maxHealth;
        this.isAlive = true;

        this.attackDamage = 5;
        this.attackCooldown = 0;
        this.attackCooldownMax = 2;
        this.attackRange = 1.5;

        this.moveSpeed = 3;
        this.aggroRange = 10;
        this.isAggro = false;

        this.stunTime = 0;

        this.createMesh();
        this.createHealthBar();
    }

    createMesh() {
        // Override in subclass
    }

    createHealthBar() {
        // Health bar background
        const bgGeometry = new THREE.PlaneGeometry(1.2, 0.15);
        const bgMaterial = new THREE.MeshBasicMaterial({
            color: 0x333333,
            side: THREE.DoubleSide
        });
        this.healthBarBg = new THREE.Mesh(bgGeometry, bgMaterial);

        // Health bar fill
        const fillGeometry = new THREE.PlaneGeometry(1.1, 0.1);
        const fillMaterial = new THREE.MeshBasicMaterial({
            color: 0xff4444,
            side: THREE.DoubleSide
        });
        this.healthBarFill = new THREE.Mesh(fillGeometry, fillMaterial);
        this.healthBarFill.position.z = 0.01;

        // Health bar group
        this.healthBarGroup = new THREE.Group();
        this.healthBarGroup.add(this.healthBarBg);
        this.healthBarGroup.add(this.healthBarFill);
        this.scene.add(this.healthBarGroup);

        // Target ring (hidden by default)
        const ringGeometry = new THREE.RingGeometry(1.2, 1.4, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0xff4444,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8,
            depthWrite: false,
            depthTest: true,
            polygonOffset: true,
            polygonOffsetFactor: -4,
            polygonOffsetUnits: -4
        });
        this.targetRing = new THREE.Mesh(ringGeometry, ringMaterial);
        this.targetRing.rotation.x = -Math.PI / 2; // Lay flat
        this.targetRing.position.y = 0.3;
        this.targetRing.visible = false;
        this.scene.add(this.targetRing);
    }

    setTargeted(isTargeted) {
        if (this.targetRing) {
            this.targetRing.visible = isTargeted;
        }
    }

    update(deltaTime, player, camera) {
        if (!this.isAlive) return;

        // Stun
        if (this.stunTime > 0) {
            this.stunTime -= deltaTime;
            return;
        }

        // Slow effect timer (from mage blizzard)
        if (this.slowTimer && this.slowTimer > 0) {
            this.slowTimer -= deltaTime;
            if (this.slowTimer <= 0 && this.originalMoveSpeed) {
                // Restore original speed when slow expires
                this.moveSpeed = this.originalMoveSpeed;
                this.originalMoveSpeed = null;
            }
        }

        // Attack cooldown
        if (this.attackCooldown > 0) {
            this.attackCooldown -= deltaTime;
        }

        // Check aggro
        const distToPlayer = this.position.distanceTo(player.position);
        if (distToPlayer < this.aggroRange) {
            this.isAggro = true;
        }

        // Move toward player if aggro
        if (this.isAggro && distToPlayer > this.attackRange) {
            const dir = new THREE.Vector3()
                .subVectors(player.position, this.position)
                .normalize();
            dir.y = 0;

            this.position.add(dir.multiplyScalar(this.moveSpeed * deltaTime));

            // Face player
            if (this.mesh) {
                this.mesh.rotation.y = Math.atan2(dir.x, dir.z);
            }
        }

        // Update mesh position
        if (this.mesh) {
            this.mesh.position.copy(this.position);
        }

        // Update target ring position
        if (this.targetRing) {
            this.targetRing.position.x = this.position.x;
            this.targetRing.position.z = this.position.z;
        }

        // Update health bar to face camera
        this.updateHealthBar(camera);
    }

    updateHealthBar(camera) {
        if (!this.healthBarGroup) return;

        // Position above enemy
        this.healthBarGroup.position.copy(this.position);
        this.healthBarGroup.position.y = this.healthBarHeight || 2.5;

        // Face camera (proper billboard)
        if (camera) {
            this.healthBarGroup.lookAt(camera.position);
        }

        // Scale fill based on health (clamp to 0-1 range)
        const healthPercent = Math.max(0, Math.min(1, this.health / this.maxHealth));
        this.healthBarFill.scale.x = Math.max(0.001, healthPercent); // Prevent zero scale
        this.healthBarFill.position.x = (healthPercent - 1) * 0.55;
    }

    tryAttack(player) {
        if (this.attackCooldown > 0 || this.stunTime > 0) return false;

        // Check if player can parry
        if (player.tryParry && player.tryParry(this)) {
            this.attackCooldown = this.attackCooldownMax;
            return false;
        }

        player.takeDamage(this.attackDamage);
        this.attackCooldown = this.attackCooldownMax;
        return true;
    }

    takeDamage(amount, source) {
        this.health -= amount;
        this.isAggro = true;

        // Flash red
        if (this.mesh && this.mesh.material) {
            const originalColor = this.mesh.material.color.getHex();
            this.mesh.material.color.setHex(0xff0000);
            setTimeout(() => {
                if (this.mesh && this.mesh.material) {
                    this.mesh.material.color.setHex(originalColor);
                }
            }, 100);
        }

        // Emit hit particles (will be picked up by game)
        this.lastHitPosition = this.position.clone();
        this.lastHitPosition.y += 1;
        this.lastHitAmount = amount;

        if (this.health <= 0) {
            this.die();
        }
    }

    stun(duration) {
        this.stunTime = duration;
    }

    die() {
        this.isAlive = false;

        // Store death position for particles
        this.deathPosition = this.position.clone();
        this.deathPosition.y += 1;
        this.justDied = true;

        // Remove mesh
        if (this.mesh) {
            this.scene.remove(this.mesh);
        }

        // Remove health bar
        if (this.healthBarGroup) {
            this.scene.remove(this.healthBarGroup);
        }

        // Remove target ring
        if (this.targetRing) {
            this.scene.remove(this.targetRing);
        }
    }
}
