import * as THREE from 'three';
import { KayKitCharacter } from './kayKitCharacter.js';
import { WeaponFactory } from './weaponFactory.js';
import { Inventory } from './inventory.js';

export class Player {
    constructor(scene, game) {
        this.scene = scene;
        this.game = game; // Reference to game for effects
        this.position = new THREE.Vector3(0, 0, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.rotation = 0; // Y-axis rotation

        // Class identifier
        this.className = 'warrior';

        // Inventory system
        this.inventory = new Inventory(24);
        this.inventory.giveStarterItems(this.className);

        // Buff system
        this.buffs = {};

        // Stats
        this.maxHealth = 500;
        this.health = this.maxHealth;
        this.moveSpeed = 8;
        this.jumpForce = 12;
        this.isGrounded = true;

        // Combat
        this.targetEnemy = null;
        this.attackRange = 2.5;
        this.autoAttackCooldown = 0;
        this.autoAttackCooldownMax = 0.8; // Faster attacks
        this.autoAttackDamage = 25;

        // Abilities - Warrior kit:
        // Q: Cleave (cone damage)
        // F: Whirlwind (360° spin + forward dash)
        // E: Parry (block + counter)
        // R: Heroic Leap (jump to location + AoE)
        // 1: Potion (heal)
        this.abilities = {
            cleave: {
                cooldown: 4,
                cooldownRemaining: 0,
                damage: 45,
                range: 8.0,
                angle: Math.PI * 0.6, // 108 degrees
                isCharging: false,
                isActive: false
            },
            whirlwind: {
                cooldown: 6,
                cooldownRemaining: 0,
                damage: 35,
                range: 3.5,
                dashDistance: 10,
                dashDuration: 0.5,
                isActive: false,
                activeTime: 0,
                dashDirection: null
            },
            parry: {
                cooldown: 5,
                cooldownRemaining: 0,
                damage: 50,
                range: 4, // AoE radius
                spinDuration: 0.4,
                isActive: false,
                activeTime: 0
            },
            heroicLeap: {
                cooldown: 10,
                cooldownRemaining: 0,
                damage: 50,
                stunDuration: 0.8,
                range: 20,
                aoeRadius: 4,
                isActive: false,
                activeTime: 0,
                leapDuration: 0.5,
                targetPos: null,
                startPos: null
            },
            sunder: {
                cooldown: 5,
                cooldownRemaining: 0,
                damage: 40,
                range: 16,
                width: 3.5, // Width of spike wave
                spikeCount: 8, // Number of spikes
                isActive: false,
                activeTime: 0
            },
            potion: {
                cooldown: 12,
                cooldownRemaining: 0,
                healAmount: 100,
                isActive: false
            }
        };

        // KayKit character controller for animated model
        this.character = new KayKitCharacter(scene);
        this.useAnimatedCharacter = false;
        this.characterLoading = false;

        // Click-to-move target
        this.moveTarget = null;
        this.moveTargetThreshold = 0.5; // Distance at which we consider target reached

        // Ability indicators
        this.cleaveIndicator = null;
        this.createAbilityIndicators();

        // Visual representation (fallback)
        this.createMesh();

        // Try to load animated character
        this.loadCharacter();
    }

    createAbilityIndicators() {
        // Cleave cone indicator - enhanced with gradient rings and animated edge
        const ability = this.abilities.cleave;
        const group = new THREE.Group();
        const angleOffset = -Math.PI / 2;

        // Inner gradient rings (lighter in center, darker at edges)
        const ringColors = [0xff8833, 0xff6600, 0xee5500, 0xcc4400];
        const ringRanges = [0.25, 0.5, 0.75, 1.0];

        for (let i = 0; i < ringRanges.length; i++) {
            const innerR = i === 0 ? 0 : ability.range * ringRanges[i - 1];
            const outerR = ability.range * ringRanges[i];
            const ringGeo = new THREE.RingGeometry(innerR, outerR, 32, 1, -ability.angle / 2 + angleOffset, ability.angle);
            const ringMat = new THREE.MeshBasicMaterial({
                color: ringColors[i],
                transparent: true,
                opacity: 0.25 - i * 0.04,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = -Math.PI / 2;
            ring.position.y = 0.08 + i * 0.01;
            group.add(ring);
        }

        // Animated outer edge glow (thick)
        const edgeGeo = new THREE.RingGeometry(ability.range - 0.25, ability.range, 48, 1, -ability.angle / 2 + angleOffset, ability.angle);
        const edgeMat = new THREE.MeshBasicMaterial({
            color: 0xffcc44,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const edge = new THREE.Mesh(edgeGeo, edgeMat);
        edge.rotation.x = -Math.PI / 2;
        edge.position.y = 0.14;
        edge.userData.isPulsingEdge = true;
        group.add(edge);

        // Inner bright edge
        const innerEdgeGeo = new THREE.RingGeometry(ability.range - 0.12, ability.range - 0.08, 48, 1, -ability.angle / 2 + angleOffset, ability.angle);
        const innerEdgeMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const innerEdge = new THREE.Mesh(innerEdgeGeo, innerEdgeMat);
        innerEdge.rotation.x = -Math.PI / 2;
        innerEdge.position.y = 0.15;
        group.add(innerEdge);

        // Arc end lines (sides of cone)
        const lineLength = ability.range;
        for (let side = -1; side <= 1; side += 2) {
            const lineGeo = new THREE.PlaneGeometry(0.08, lineLength);
            const lineMat = new THREE.MeshBasicMaterial({
                color: 0xffdd66,
                transparent: true,
                opacity: 0.7,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            const line = new THREE.Mesh(lineGeo, lineMat);
            const sideAngle = side * ability.angle / 2 + angleOffset;
            line.position.x = Math.cos(sideAngle) * lineLength / 2;
            line.position.z = -Math.sin(sideAngle) * lineLength / 2;
            line.position.y = 0.13;
            line.rotation.x = -Math.PI / 2;
            line.rotation.z = -sideAngle;
            group.add(line);
        }

        // Tick marks around the arc
        const tickCount = 8;
        for (let i = 0; i <= tickCount; i++) {
            const tickAngle = -ability.angle / 2 + (i / tickCount) * ability.angle + angleOffset;
            const tickGeo = new THREE.PlaneGeometry(0.04, 0.4);
            const tickMat = new THREE.MeshBasicMaterial({
                color: 0xffeeaa,
                transparent: true,
                opacity: 0.6,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            const tick = new THREE.Mesh(tickGeo, tickMat);
            tick.position.x = Math.cos(tickAngle) * (ability.range - 0.2);
            tick.position.z = -Math.sin(tickAngle) * (ability.range - 0.2);
            tick.position.y = 0.12;
            tick.rotation.x = -Math.PI / 2;
            tick.rotation.z = -tickAngle;
            group.add(tick);
        }

        group.visible = false;
        group.userData.animTime = 0;
        this.cleaveIndicator = group;
        this.scene.add(this.cleaveIndicator);

        // Sunder line indicator
        this.createSunderIndicator();
    }

    createSunderIndicator() {
        const ability = this.abilities.sunder;
        const range = ability.range;
        const startWidth = 0.5;
        const endWidth = ability.width * 2;

        const group = new THREE.Group();

        // Create multiple gradient layers
        const layerColors = [0xaa7744, 0x996633, 0x885522, 0x774411];
        for (let i = 0; i < 4; i++) {
            const layerStart = startWidth * (1 - i * 0.15);
            const layerEnd = endWidth * (1 - i * 0.15);
            const layerRange = range * (1 - i * 0.05);

            const shape = new THREE.Shape();
            shape.moveTo(-layerStart / 2, 0);
            shape.lineTo(-layerEnd / 2, layerRange);
            shape.lineTo(layerEnd / 2, layerRange);
            shape.lineTo(layerStart / 2, 0);
            shape.lineTo(-layerStart / 2, 0);

            const geometry = new THREE.ShapeGeometry(shape);
            const material = new THREE.MeshBasicMaterial({
                color: layerColors[i],
                transparent: true,
                opacity: 0.2 - i * 0.03,
                side: THREE.DoubleSide,
                depthWrite: false
            });

            const trapezoid = new THREE.Mesh(geometry, material);
            trapezoid.rotation.x = Math.PI / 2;
            trapezoid.position.y = 0.08 + i * 0.01;
            group.add(trapezoid);
        }

        // Glowing edge outline with thick border
        const edgePoints = [];
        edgePoints.push(new THREE.Vector3(-startWidth / 2, 0, 0));
        edgePoints.push(new THREE.Vector3(-endWidth / 2, 0, range));
        edgePoints.push(new THREE.Vector3(endWidth / 2, 0, range));
        edgePoints.push(new THREE.Vector3(startWidth / 2, 0, 0));

        // Draw edge lines with planes
        const edgePairs = [
            [edgePoints[0], edgePoints[1]], // left side
            [edgePoints[1], edgePoints[2]], // far end
            [edgePoints[2], edgePoints[3]]  // right side
        ];

        for (const [p1, p2] of edgePairs) {
            const length = p1.distanceTo(p2);
            const midPoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
            const angle = Math.atan2(p2.z - p1.z, p2.x - p1.x);

            const lineGeo = new THREE.PlaneGeometry(length, 0.15);
            const lineMat = new THREE.MeshBasicMaterial({
                color: 0xddaa66,
                transparent: true,
                opacity: 0.8,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            const line = new THREE.Mesh(lineGeo, lineMat);
            line.position.set(midPoint.x, 0.14, midPoint.z);
            line.rotation.x = -Math.PI / 2;
            line.rotation.z = -angle;
            line.userData.isPulsingEdge = true;
            group.add(line);
        }

        // Inner bright edge
        for (const [p1, p2] of edgePairs) {
            const length = p1.distanceTo(p2);
            const midPoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
            const angle = Math.atan2(p2.z - p1.z, p2.x - p1.x);

            const lineGeo = new THREE.PlaneGeometry(length, 0.05);
            const lineMat = new THREE.MeshBasicMaterial({
                color: 0xffeedd,
                transparent: true,
                opacity: 0.9,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            const line = new THREE.Mesh(lineGeo, lineMat);
            line.position.set(midPoint.x, 0.15, midPoint.z);
            line.rotation.x = -Math.PI / 2;
            line.rotation.z = -angle;
            group.add(line);
        }

        // Spike marks along the path
        const spikeCount = 6;
        for (let i = 1; i <= spikeCount; i++) {
            const t = i / (spikeCount + 1);
            const widthAtT = startWidth + (endWidth - startWidth) * t;
            const zPos = range * t;

            // Small triangular spike markers
            const spikeGeo = new THREE.BufferGeometry();
            const vertices = new Float32Array([
                0, 0, 0,
                -0.15, 0, 0.3,
                0.15, 0, 0.3
            ]);
            spikeGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
            const spikeMat = new THREE.MeshBasicMaterial({
                color: 0xccaa77,
                transparent: true,
                opacity: 0.6,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            const spike = new THREE.Mesh(spikeGeo, spikeMat);
            spike.position.set(0, 0.12, zPos);
            spike.rotation.x = -Math.PI / 2;
            group.add(spike);
        }

        group.visible = false;
        group.userData.animTime = 0;
        this.sunderIndicator = group;
        this.scene.add(this.sunderIndicator);

        // Heroic Leap indicator
        this.createHeroicLeapIndicator();
    }

    createHeroicLeapIndicator() {
        const ability = this.abilities.heroicLeap;

        // Create range indicator group for animation
        this.leapRangeGroup = new THREE.Group();

        // Range circle gradient rings
        const rangeRingCount = 4;
        for (let i = 0; i < rangeRingCount; i++) {
            const innerR = ability.range * (0.85 + i * 0.04);
            const outerR = ability.range * (0.89 + i * 0.04);
            const rangeRingGeo = new THREE.RingGeometry(innerR, outerR, 64);
            const rangeRingMat = new THREE.MeshBasicMaterial({
                color: i === 0 ? 0x6699ff : 0x4488ff,
                transparent: true,
                opacity: 0.15 + i * 0.05,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            const rangeRing = new THREE.Mesh(rangeRingGeo, rangeRingMat);
            rangeRing.rotation.x = -Math.PI / 2;
            rangeRing.position.y = 0.08 + i * 0.01;
            this.leapRangeGroup.add(rangeRing);
        }

        // Dashed tick marks around range circle
        const tickCount = 24;
        for (let i = 0; i < tickCount; i++) {
            const angle = (i / tickCount) * Math.PI * 2;
            const tickGeo = new THREE.PlaneGeometry(0.05, 0.6);
            const tickMat = new THREE.MeshBasicMaterial({
                color: 0x88bbff,
                transparent: true,
                opacity: 0.5,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            const tick = new THREE.Mesh(tickGeo, tickMat);
            tick.position.x = Math.cos(angle) * (ability.range - 0.3);
            tick.position.z = Math.sin(angle) * (ability.range - 0.3);
            tick.position.y = 0.12;
            tick.rotation.x = -Math.PI / 2;
            tick.rotation.z = -angle + Math.PI / 2;
            this.leapRangeGroup.add(tick);
        }

        this.leapRangeGroup.visible = false;
        this.leapRangeGroup.userData.animTime = 0;
        this.scene.add(this.leapRangeGroup);
        this.leapRangeIndicator = this.leapRangeGroup;

        // Create target indicator group
        this.leapTargetGroup = new THREE.Group();

        // AoE radius gradient circles
        const aoeColors = [0xff6666, 0xff4444, 0xee3333, 0xcc2222];
        for (let i = 0; i < 4; i++) {
            const innerR = ability.aoeRadius * (i * 0.25);
            const outerR = ability.aoeRadius * ((i + 1) * 0.25);
            const aoeRingGeo = new THREE.RingGeometry(innerR, outerR, 32);
            const aoeRingMat = new THREE.MeshBasicMaterial({
                color: aoeColors[i],
                transparent: true,
                opacity: 0.25 - i * 0.05,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            const aoeRing = new THREE.Mesh(aoeRingGeo, aoeRingMat);
            aoeRing.rotation.x = -Math.PI / 2;
            aoeRing.position.y = 0.09 + i * 0.01;
            this.leapTargetGroup.add(aoeRing);
        }

        // Outer glowing edge
        const targetEdgeGeo = new THREE.RingGeometry(ability.aoeRadius - 0.15, ability.aoeRadius, 48);
        const targetEdgeMat = new THREE.MeshBasicMaterial({
            color: 0xffaa44,
            transparent: true,
            opacity: 0.85,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const targetEdge = new THREE.Mesh(targetEdgeGeo, targetEdgeMat);
        targetEdge.rotation.x = -Math.PI / 2;
        targetEdge.position.y = 0.14;
        targetEdge.userData.isPulsingEdge = true;
        this.leapTargetGroup.add(targetEdge);

        // Inner bright edge
        const innerEdgeGeo = new THREE.RingGeometry(ability.aoeRadius - 0.08, ability.aoeRadius - 0.05, 48);
        const innerEdgeMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const innerEdge = new THREE.Mesh(innerEdgeGeo, innerEdgeMat);
        innerEdge.rotation.x = -Math.PI / 2;
        innerEdge.position.y = 0.15;
        this.leapTargetGroup.add(innerEdge);

        // Cross-hair at center
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const crossGeo = new THREE.PlaneGeometry(0.08, 1.2);
            const crossMat = new THREE.MeshBasicMaterial({
                color: 0xffdd88,
                transparent: true,
                opacity: 0.7,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            const cross = new THREE.Mesh(crossGeo, crossMat);
            cross.rotation.x = -Math.PI / 2;
            cross.rotation.z = angle;
            cross.position.y = 0.13;
            this.leapTargetGroup.add(cross);
        }

        // Central landing circle (pulsing)
        const centerGeo = new THREE.CircleGeometry(0.5, 16);
        const centerMat = new THREE.MeshBasicMaterial({
            color: 0xffcc00,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const center = new THREE.Mesh(centerGeo, centerMat);
        center.rotation.x = -Math.PI / 2;
        center.position.y = 0.16;
        center.userData.isPulsingCenter = true;
        this.leapTargetGroup.add(center);

        // Outer center ring
        const centerRingGeo = new THREE.RingGeometry(0.45, 0.55, 16);
        const centerRingMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const centerRing = new THREE.Mesh(centerRingGeo, centerRingMat);
        centerRing.rotation.x = -Math.PI / 2;
        centerRing.position.y = 0.17;
        this.leapTargetGroup.add(centerRing);

        this.leapTargetGroup.visible = false;
        this.leapTargetGroup.userData.animTime = 0;
        this.scene.add(this.leapTargetGroup);
        this.leapTargetIndicator = this.leapTargetGroup;
        this.leapInnerIndicator = this.leapTargetGroup; // Combined into target group
    }

    showSunderIndicator(show) {
        if (this.sunderIndicator) {
            this.sunderIndicator.visible = show;
        }
    }

    updateSunderIndicator(mouseWorldPos) {
        if (!this.sunderIndicator || !this.sunderIndicator.visible) return;

        // Position at player
        this.sunderIndicator.position.x = this.position.x;
        this.sunderIndicator.position.z = this.position.z;

        // Point toward mouse - the shape is created pointing +Z after rotation.x
        const dx = mouseWorldPos.x - this.position.x;
        const dz = mouseWorldPos.z - this.position.z;
        this.sunderIndicator.rotation.y = Math.atan2(dx, dz);
    }

    showHeroicLeapIndicator(show) {
        if (this.leapRangeIndicator) this.leapRangeIndicator.visible = show;
        if (this.leapTargetIndicator) this.leapTargetIndicator.visible = show;
        if (this.leapInnerIndicator) this.leapInnerIndicator.visible = show;
    }

    updateHeroicLeapIndicator(mouseWorldPos) {
        if (!this.leapRangeIndicator || !this.leapRangeIndicator.visible) return;

        const ability = this.abilities.heroicLeap;

        // Position range indicator at player
        this.leapRangeIndicator.position.x = this.position.x;
        this.leapRangeIndicator.position.z = this.position.z;

        // Calculate target position (clamped to range)
        const dx = mouseWorldPos.x - this.position.x;
        const dz = mouseWorldPos.z - this.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        let targetX, targetZ;
        if (dist > ability.range) {
            // Clamp to max range
            const dir = new THREE.Vector3(dx, 0, dz).normalize();
            targetX = this.position.x + dir.x * ability.range;
            targetZ = this.position.z + dir.z * ability.range;
        } else {
            targetX = mouseWorldPos.x;
            targetZ = mouseWorldPos.z;
        }

        // Position target indicators at landing spot
        this.leapTargetIndicator.position.x = targetX;
        this.leapTargetIndicator.position.z = targetZ;
        this.leapInnerIndicator.position.x = targetX;
        this.leapInnerIndicator.position.z = targetZ;
    }

    showCleaveIndicator(show) {
        if (this.cleaveIndicator) {
            this.cleaveIndicator.visible = show;
        }
    }

    updateCleaveIndicator(mouseWorldPos) {
        if (!this.cleaveIndicator || !this.cleaveIndicator.visible) return;

        // Position at player
        this.cleaveIndicator.position.x = this.position.x;
        this.cleaveIndicator.position.z = this.position.z;

        // Point toward mouse (same as TileGame-3D)
        const dx = mouseWorldPos.x - this.position.x;
        const dz = mouseWorldPos.z - this.position.z;
        this.cleaveIndicator.rotation.y = Math.atan2(dx, dz);
    }

    updateIndicatorAnimations(deltaTime) {
        // Animate visible indicators with pulsing edges
        const indicators = [this.cleaveIndicator, this.sunderIndicator, this.leapTargetGroup, this.leapRangeGroup];

        for (const indicator of indicators) {
            if (!indicator || !indicator.visible) continue;

            // Update animation time
            indicator.userData.animTime = (indicator.userData.animTime || 0) + deltaTime;
            const time = indicator.userData.animTime;

            // Animate children with special properties
            indicator.traverse((child) => {
                if (child.userData.isPulsingEdge && child.material) {
                    // Pulse opacity between 0.5 and 1.0
                    const pulse = 0.65 + Math.sin(time * 6) * 0.35;
                    child.material.opacity = pulse;
                }
                if (child.userData.isPulsingCenter && child.material) {
                    // Faster pulse for center crosshair
                    const pulse = 0.4 + Math.sin(time * 8) * 0.3;
                    child.material.opacity = pulse;
                    // Slight scale pulse
                    const scale = 1 + Math.sin(time * 8) * 0.1;
                    child.scale.set(scale, scale, 1);
                }
            });
        }
    }

    async loadCharacter() {
        this.characterLoading = true;
        // Hide fallback mesh immediately while loading
        this.group.visible = false;

        try {
            // Load KayKit Knight character
            const success = await this.character.load('adventurers', 'knight');
            if (success) {
                this.useAnimatedCharacter = true;
                console.log('Using KayKit Knight character model');

                // Attach sword weapon
                const weapon = WeaponFactory.createWeaponForClass('warrior');
                this.character.attachWeapon(weapon.mesh, 'handR', weapon.offset, weapon.rotation);
            } else {
                // Show fallback if loading failed
                this.group.visible = true;
            }
        } catch (error) {
            console.warn('Failed to load KayKit character, using fallback:', error);
            this.group.visible = true;
        }
        this.characterLoading = false;
    }

    createMesh() {
        this.group = new THREE.Group();

        // Materials
        const skinMaterial = new THREE.MeshStandardMaterial({
            color: 0xffddaa,
            roughness: 0.7
        });
        const armorMaterial = new THREE.MeshStandardMaterial({
            color: 0x4488ff,
            roughness: 0.5,
            metalness: 0.3
        });
        const darkArmorMaterial = new THREE.MeshStandardMaterial({
            color: 0x2255aa,
            roughness: 0.5,
            metalness: 0.3
        });
        const bootMaterial = new THREE.MeshStandardMaterial({
            color: 0x4a3728,
            roughness: 0.8
        });

        // === TORSO ===
        const torsoGeometry = new THREE.BoxGeometry(0.6, 0.7, 0.35);
        const torso = new THREE.Mesh(torsoGeometry, armorMaterial);
        torso.position.y = 1.15;
        torso.castShadow = true;
        this.group.add(torso);

        // Chest plate detail
        const chestGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.1);
        const chest = new THREE.Mesh(chestGeometry, darkArmorMaterial);
        chest.position.set(0, 1.2, 0.2);
        this.group.add(chest);

        // === LEGS ===
        // Left leg
        this.leftLeg = new THREE.Group();
        const leftThighGeometry = new THREE.CapsuleGeometry(0.12, 0.3, 4, 8);
        const leftThigh = new THREE.Mesh(leftThighGeometry, darkArmorMaterial);
        leftThigh.position.y = -0.25;
        this.leftLeg.add(leftThigh);

        const leftShinGeometry = new THREE.CapsuleGeometry(0.1, 0.3, 4, 8);
        const leftShin = new THREE.Mesh(leftShinGeometry, darkArmorMaterial);
        leftShin.position.y = -0.55;
        this.leftLeg.add(leftShin);

        const leftBootGeometry = new THREE.BoxGeometry(0.15, 0.15, 0.25);
        const leftBoot = new THREE.Mesh(leftBootGeometry, bootMaterial);
        leftBoot.position.set(0, -0.78, 0.05);
        this.leftLeg.add(leftBoot);

        this.leftLeg.position.set(-0.15, 0.8, 0);
        this.group.add(this.leftLeg);

        // Right leg
        this.rightLeg = new THREE.Group();
        const rightThighGeometry = new THREE.CapsuleGeometry(0.12, 0.3, 4, 8);
        const rightThigh = new THREE.Mesh(rightThighGeometry, darkArmorMaterial);
        rightThigh.position.y = -0.25;
        this.rightLeg.add(rightThigh);

        const rightShinGeometry = new THREE.CapsuleGeometry(0.1, 0.3, 4, 8);
        const rightShin = new THREE.Mesh(rightShinGeometry, darkArmorMaterial);
        rightShin.position.y = -0.55;
        this.rightLeg.add(rightShin);

        const rightBootGeometry = new THREE.BoxGeometry(0.15, 0.15, 0.25);
        const rightBoot = new THREE.Mesh(rightBootGeometry, bootMaterial);
        rightBoot.position.set(0, -0.78, 0.05);
        this.rightLeg.add(rightBoot);

        this.rightLeg.position.set(0.15, 0.8, 0);
        this.group.add(this.rightLeg);

        // === ARMS ===
        // Left arm (shield arm)
        this.leftArm = new THREE.Group();
        const leftShoulderGeometry = new THREE.SphereGeometry(0.12, 8, 8);
        const leftShoulder = new THREE.Mesh(leftShoulderGeometry, armorMaterial);
        this.leftArm.add(leftShoulder);

        const leftUpperArmGeometry = new THREE.CapsuleGeometry(0.08, 0.25, 4, 8);
        const leftUpperArm = new THREE.Mesh(leftUpperArmGeometry, skinMaterial);
        leftUpperArm.position.y = -0.2;
        this.leftArm.add(leftUpperArm);

        const leftForearmGeometry = new THREE.CapsuleGeometry(0.07, 0.2, 4, 8);
        const leftForearm = new THREE.Mesh(leftForearmGeometry, skinMaterial);
        leftForearm.position.y = -0.42;
        this.leftArm.add(leftForearm);

        // Small shield
        const shieldGeometry = new THREE.BoxGeometry(0.35, 0.45, 0.05);
        const shieldMaterial = new THREE.MeshStandardMaterial({
            color: 0x666688,
            roughness: 0.3,
            metalness: 0.7
        });
        const shield = new THREE.Mesh(shieldGeometry, shieldMaterial);
        shield.position.set(0, -0.45, 0.15);
        this.leftArm.add(shield);

        this.leftArm.position.set(-0.42, 1.35, 0);
        this.leftArm.rotation.z = 0.2;
        this.group.add(this.leftArm);

        // Right arm (sword arm)
        this.rightArm = new THREE.Group();
        const rightShoulderGeometry = new THREE.SphereGeometry(0.12, 8, 8);
        const rightShoulder = new THREE.Mesh(rightShoulderGeometry, armorMaterial);
        this.rightArm.add(rightShoulder);

        const rightUpperArmGeometry = new THREE.CapsuleGeometry(0.08, 0.25, 4, 8);
        const rightUpperArm = new THREE.Mesh(rightUpperArmGeometry, skinMaterial);
        rightUpperArm.position.y = -0.2;
        this.rightArm.add(rightUpperArm);

        const rightForearmGeometry = new THREE.CapsuleGeometry(0.07, 0.2, 4, 8);
        const rightForearm = new THREE.Mesh(rightForearmGeometry, skinMaterial);
        rightForearm.position.y = -0.42;
        this.rightArm.add(rightForearm);

        this.rightArm.position.set(0.42, 1.35, 0);
        this.rightArm.rotation.z = -0.2;
        this.group.add(this.rightArm);

        // === HEAD ===
        const headGeometry = new THREE.SphereGeometry(0.25, 16, 12);
        this.headMesh = new THREE.Mesh(headGeometry, skinMaterial);
        this.headMesh.position.y = 1.7;
        this.headMesh.castShadow = true;
        this.group.add(this.headMesh);

        // Helmet
        const helmetGeometry = new THREE.SphereGeometry(0.28, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6);
        const helmetMaterial = new THREE.MeshStandardMaterial({
            color: 0x4488ff,
            roughness: 0.3,
            metalness: 0.5
        });
        const helmet = new THREE.Mesh(helmetGeometry, helmetMaterial);
        helmet.position.y = 1.75;
        this.group.add(helmet);

        // Eyes (to show facing direction)
        const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const eyeGeometry = new THREE.SphereGeometry(0.04, 8, 8);

        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.08, 1.72, 0.22);
        this.group.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.08, 1.72, 0.22);
        this.group.add(rightEye);

        // === SWORD ===
        const swordGroup = new THREE.Group();

        const bladeGeometry = new THREE.BoxGeometry(0.06, 1.0, 0.02);
        const bladeMaterial = new THREE.MeshStandardMaterial({
            color: 0xdddddd,
            roughness: 0.2,
            metalness: 0.9
        });
        const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
        blade.position.y = 0.5;
        swordGroup.add(blade);

        // Blade tip
        const tipGeometry = new THREE.ConeGeometry(0.03, 0.15, 4);
        const tip = new THREE.Mesh(tipGeometry, bladeMaterial);
        tip.position.y = 1.05;
        swordGroup.add(tip);

        const hiltGeometry = new THREE.BoxGeometry(0.25, 0.06, 0.06);
        const hiltMaterial = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            roughness: 0.4,
            metalness: 0.6
        });
        const hilt = new THREE.Mesh(hiltGeometry, hiltMaterial);
        swordGroup.add(hilt);

        const handleGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8);
        const handleMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const handle = new THREE.Mesh(handleGeometry, handleMaterial);
        handle.position.y = -0.12;
        swordGroup.add(handle);

        // Attach sword to right hand
        swordGroup.position.set(0, -0.55, 0.1);
        swordGroup.rotation.x = -0.3;
        this.swordMesh = swordGroup;
        this.rightArm.add(swordGroup);

        // Animation state
        this.walkCycle = 0;

        this.scene.add(this.group);
    }

    setTarget(enemy) {
        // Clear previous target highlight
        if (this.targetEnemy && this.targetEnemy.setTargeted) {
            this.targetEnemy.setTargeted(false);
        }

        this.targetEnemy = enemy;

        // Set new target highlight
        if (enemy && enemy.setTargeted) {
            enemy.setTargeted(true);
        }
    }

    setMoveTarget(position) {
        this.moveTarget = position;
    }

    clearMoveTarget() {
        this.moveTarget = null;
    }

    update(deltaTime, input, cameraController) {
        // Process movement (pass input to check if mouse turning)
        const isMoving = this.handleMovement(deltaTime, input, cameraController, input.rightMouseDown);

        // Process abilities
        this.updateAbilities(deltaTime);

        // Animate ability indicators
        this.updateIndicatorAnimations(deltaTime);

        // Auto-attack cooldown
        if (this.autoAttackCooldown > 0) {
            this.autoAttackCooldown -= deltaTime;
        }

        // Automatically attack target if in range (unless in movement ability)
        const inMovementAbility = this.abilities.whirlwind.isActive || this.abilities.heroicLeap.isActive;
        if (this.targetEnemy && this.targetEnemy.isAlive && this.autoAttackCooldown <= 0 && !inMovementAbility) {
            const dx = this.targetEnemy.position.x - this.position.x;
            const dz = this.targetEnemy.position.z - this.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist <= this.attackRange) {
                this.performAutoAttack();
            }
        }

        // Update visual position - use animated character if loaded
        if (this.useAnimatedCharacter) {
            this.character.setPosition(this.position.x, this.position.y, this.position.z);
            this.character.setRotation(this.rotation);
            this.character.update(deltaTime, isMoving, true, this.isGrounded);
        } else {
            // Fallback to procedural mesh
            this.group.position.copy(this.position);
            this.group.rotation.y = this.rotation;

            // Walk animation for fallback
            if (isMoving && this.isGrounded) {
                this.walkCycle += deltaTime * 12;
                const legSwing = Math.sin(this.walkCycle) * 0.5;
                const armSwing = Math.sin(this.walkCycle) * 0.3;

                this.leftLeg.rotation.x = legSwing;
                this.rightLeg.rotation.x = -legSwing;
                this.leftArm.rotation.x = -armSwing;
                this.rightArm.rotation.x = armSwing;
            } else {
                this.walkCycle = 0;
                this.leftLeg.rotation.x *= 0.9;
                this.rightLeg.rotation.x *= 0.9;
                this.leftArm.rotation.x *= 0.9;
                this.rightArm.rotation.x *= 0.9;
            }
        }
    }

    handleMovement(deltaTime, input, cameraController, isMouseTurning = false) {
        // Forward/backward movement (W/S)
        const forwardBack = new THREE.Vector3();
        if (input.keys.w || input.keys.arrowup) forwardBack.z -= 1;
        if (input.keys.s || input.keys.arrowdown) forwardBack.z += 1;

        // Strafe movement (A/D) - sideways, no turning
        const strafe = new THREE.Vector3();
        if (input.keys.a || input.keys.arrowleft) strafe.x -= 1;
        if (input.keys.d || input.keys.arrowright) strafe.x += 1;

        // Check if using keyboard movement
        const usingKeyboard = forwardBack.length() > 0 || strafe.length() > 0;

        // Clear move target if using keyboard
        if (usingKeyboard && this.moveTarget) {
            this.clearMoveTarget();
        }

        // Calculate final movement direction
        const moveDir = new THREE.Vector3();
        const cameraYaw = -cameraController.yaw;
        const cos = Math.cos(cameraYaw);
        const sin = Math.sin(cameraYaw);

        // Rotate forward/back by camera yaw
        if (forwardBack.length() > 0) {
            const rotatedZ = forwardBack.z * cos;
            const rotatedX = -forwardBack.z * sin;
            moveDir.x += rotatedX;
            moveDir.z += rotatedZ;
        }

        // Rotate strafe by camera yaw (perpendicular)
        if (strafe.length() > 0) {
            const rotatedX = strafe.x * cos;
            const rotatedZ = strafe.x * sin;
            moveDir.x += rotatedX;
            moveDir.z += rotatedZ;
        }

        let isMoving = false;

        // Save old position for collision resolution
        const oldX = this.position.x;
        const oldZ = this.position.z;

        // Click-to-move: if we have a move target and not using keyboard, move toward it
        if (this.moveTarget && !usingKeyboard) {
            const dx = this.moveTarget.x - this.position.x;
            const dz = this.moveTarget.z - this.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist > this.moveTargetThreshold) {
                // Move toward target
                moveDir.x = dx / dist;
                moveDir.z = dz / dist;
                isMoving = true;

                // Apply movement
                this.position.x += moveDir.x * this.moveSpeed * deltaTime;
                this.position.z += moveDir.z * this.moveSpeed * deltaTime;

                // Face movement direction
                this.rotation = Math.atan2(moveDir.x, moveDir.z);
            } else {
                // Reached target
                this.clearMoveTarget();
            }
        } else if (moveDir.length() > 0) {
            isMoving = true;
            moveDir.normalize();

            // Apply movement
            this.position.x += moveDir.x * this.moveSpeed * deltaTime;
            this.position.z += moveDir.z * this.moveSpeed * deltaTime;

            // Character faces the direction they're moving
            this.rotation = Math.atan2(moveDir.x, moveDir.z);
        }

        // Wall collision check
        if (this.game && this.game.resolveWallCollision) {
            const resolved = this.game.resolveWallCollision(oldX, oldZ, this.position.x, this.position.z, 0.5);
            this.position.x = resolved.x;
            this.position.z = resolved.z;
        }

        // Jumping (spacebar is ' ' key)
        if (input.keys[' '] && this.isGrounded) {
            this.velocity.y = this.jumpForce;
            this.isGrounded = false;
            input.keys[' '] = false; // Consume jump input

            // Play jump animation
            if (this.useAnimatedCharacter) {
                this.character.playJump();
            }
        }

        // Apply gravity
        if (!this.isGrounded) {
            this.velocity.y -= 30 * deltaTime;
            this.position.y += this.velocity.y * deltaTime;

            if (this.position.y <= 0) {
                this.position.y = 0;
                this.velocity.y = 0;
                this.isGrounded = true;
            }
        }

        // Keep in bounds
        const bounds = 95;
        this.position.x = Math.max(-bounds, Math.min(bounds, this.position.x));
        this.position.z = Math.max(-bounds, Math.min(bounds, this.position.z));

        return isMoving;
    }

    updateAbilities(deltaTime) {
        // Update cooldowns
        for (const key in this.abilities) {
            const ability = this.abilities[key];
            if (ability.cooldownRemaining > 0) {
                ability.cooldownRemaining -= deltaTime;
                if (ability.cooldownRemaining < 0) ability.cooldownRemaining = 0;
            }
        }

        // Spin Attack duration
        if (this.abilities.parry.isActive) {
            const ability = this.abilities.parry;
            ability.activeTime += deltaTime;

            // Spin the player during the attack
            const spinSpeed = Math.PI * 4; // 2 rotations during spin
            this.rotation += spinSpeed * deltaTime;

            if (ability.activeTime >= ability.spinDuration) {
                ability.isActive = false;
                ability.activeTime = 0;
            }
        }

        // Whirlwind dash
        if (this.abilities.whirlwind.isActive) {
            this.updateWhirlwind(deltaTime);
        }

        // Heroic Leap arc
        if (this.abilities.heroicLeap.isActive) {
            this.updateHeroicLeap(deltaTime);
        }
    }

    // Target-based auto attack
    performAutoAttack() {
        if (this.autoAttackCooldown > 0) return false;
        if (!this.targetEnemy || !this.targetEnemy.isAlive) return false;

        // Check range (horizontal distance so jumping doesn't affect range)
        const dx = this.targetEnemy.position.x - this.position.x;
        const dz = this.targetEnemy.position.z - this.position.z;
        const horizontalDist = Math.sqrt(dx * dx + dz * dz);

        if (horizontalDist > this.attackRange) return false;

        this.autoAttackCooldown = this.autoAttackCooldownMax;

        // Face the target
        this.rotation = Math.atan2(dx, dz);

        // Play attack animation
        if (this.useAnimatedCharacter) {
            // Cycle through attack animations
            this.attackAnimIndex = ((this.attackAnimIndex || 0) % 4) + 1;
            this.character.playAttack(this.attackAnimIndex);
        }

        // Visual swing effect toward target
        if (this.game && this.game.effects) {
            this.game.effects.createSwingEffect(this.position, this.rotation, 0xffffff);
        }

        // Play swing sound
        if (this.game && this.game.sound) {
            this.game.sound.play('swordSwing');
        }

        // Swing trail particles
        if (this.game && this.game.particles) {
            const startPos = this.position.clone();
            startPos.y += 1;
            const endPos = this.targetEnemy.position.clone();
            endPos.y += 1;
            this.game.particles.swingTrail(startPos, endPos);
        }

        // Deal damage and show damage number
        this.targetEnemy.takeDamage(this.autoAttackDamage, this);
        if (this.game && this.game.effects) {
            this.game.effects.createDamageNumber(this.targetEnemy.position, this.autoAttackDamage);
        }

        // Play hit sound
        if (this.game && this.game.sound) {
            this.game.sound.play('swordHit', { volumeMult: 0.8 });
        }

        return true;
    }

    // Ability: Cleave - fires toward specified direction
    useCleave(enemies, direction = null) {
        const ability = this.abilities.cleave;
        if (ability.cooldownRemaining > 0) return false;

        ability.cooldownRemaining = ability.cooldown;

        // Use provided direction or default to player facing
        let forward;
        if (direction) {
            forward = new THREE.Vector3(direction.x, 0, direction.z).normalize();
            // Face the cleave direction
            this.rotation = Math.atan2(forward.x, forward.z);
        } else {
            forward = new THREE.Vector3(
                Math.sin(this.rotation),
                0,
                Math.cos(this.rotation)
            );
        }

        // Play attack animation for cleave
        if (this.useAnimatedCharacter) {
            this.character.playAttack(2);
        }

        // Visual effect
        if (this.game && this.game.effects) {
            this.game.effects.createCleaveEffect(this.position, this.rotation);
        }

        // Play cleave sound
        if (this.game && this.game.sound) {
            this.game.sound.play('cleave');
        }

        // Particle effect - cleave wave
        if (this.game && this.game.particles) {
            this.game.particles.cleaveWave(this.position, forward, ability.range);
        }

        // Hit enemies in front cone
        let hitCount = 0;
        for (const enemy of enemies) {
            if (!enemy.isAlive) continue;

            const dx = enemy.position.x - this.position.x;
            const dz = enemy.position.z - this.position.z;
            const horizontalDist = Math.sqrt(dx * dx + dz * dz);

            if (horizontalDist > ability.range) continue;

            // Check if in cone
            const toEnemy = new THREE.Vector3(dx, 0, dz).normalize();
            const dot = forward.dot(toEnemy);
            const angleToEnemy = Math.acos(Math.min(1, Math.max(-1, dot)));

            if (angleToEnemy <= ability.angle / 2) {
                enemy.takeDamage(ability.damage, this);
                if (this.game && this.game.effects) {
                    this.game.effects.createDamageNumber(enemy.position, ability.damage);
                }
                hitCount++;
            }
        }

        return hitCount > 0;
    }

    // Ability: Whirlwind - 360° spin attack with forward dash
    useWhirlwind(direction = null) {
        const ability = this.abilities.whirlwind;
        if (ability.cooldownRemaining > 0) return false;
        if (ability.isActive) return false;

        ability.isActive = true;
        ability.activeTime = 0;
        ability.cooldownRemaining = ability.cooldown;

        // Set dash direction (forward by default, or toward cursor)
        if (direction) {
            ability.dashDirection = new THREE.Vector3(direction.x, 0, direction.z).normalize();
            this.rotation = Math.atan2(direction.x, direction.z);
        } else {
            ability.dashDirection = new THREE.Vector3(
                Math.sin(this.rotation),
                0,
                Math.cos(this.rotation)
            );
        }

        // Store start position
        ability.startPos = this.position.clone();

        // Play attack animation (spin)
        if (this.useAnimatedCharacter) {
            this.character.playAttack(2);
        }

        // Create whirlwind visual effect
        if (this.game && this.game.effects) {
            this.game.effects.createWhirlwindEffect(this.position, ability.range);
        }

        // Play whirlwind sound
        if (this.game && this.game.sound) {
            this.game.sound.play('whirlwind');
        }

        // Emit spin particles
        if (this.game && this.game.particles) {
            this.game.particles.whirlwindSpin(this.position, ability.range);
        }

        // Deal damage to all nearby enemies immediately
        if (this.game) {
            for (const enemy of this.game.enemies) {
                if (!enemy.isAlive) continue;
                const dx = enemy.position.x - this.position.x;
                const dz = enemy.position.z - this.position.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                if (dist <= ability.range) {
                    enemy.takeDamage(ability.damage, this);
                    if (this.game.effects) {
                        this.game.effects.createDamageNumber(enemy.position, ability.damage);
                    }
                }
            }
        }

        return true;
    }

    updateWhirlwind(deltaTime) {
        const ability = this.abilities.whirlwind;
        ability.activeTime += deltaTime;

        // Progress through dash
        const progress = ability.activeTime / ability.dashDuration;

        if (progress < 1) {
            // Move player forward during dash
            const moveAmount = (ability.dashDistance / ability.dashDuration) * deltaTime;
            const oldX = this.position.x;
            const oldZ = this.position.z;
            this.position.add(ability.dashDirection.clone().multiplyScalar(moveAmount));

            // Wall collision check for dash
            if (this.game && this.game.resolveWallCollision) {
                const resolved = this.game.resolveWallCollision(oldX, oldZ, this.position.x, this.position.z, 0.5);
                this.position.x = resolved.x;
                this.position.z = resolved.z;
            }

            // Spin the player rapidly while dashing (3 full rotations during dash)
            const spinSpeed = Math.PI * 6; // 3 rotations per dashDuration
            this.rotation += spinSpeed * deltaTime;

            // Update character rotation for spinning effect
            if (this.useAnimatedCharacter) {
                this.character.setRotation(this.rotation);
            }

            // Spin particles during dash
            if (this.game && this.game.particles && Math.random() < 0.7) {
                this.game.particles.dashTrail(this.position, ability.dashDirection);
                // Add whirlwind spin particles around player
                this.game.particles.whirlwindSpin(this.position);
            }

            // Damage enemies we pass through during spin
            if (this.game && this.game.enemies) {
                for (const enemy of this.game.enemies) {
                    if (!enemy.isAlive) continue;
                    if (enemy.whirlwindHit) continue; // Already hit this spin

                    const dx = enemy.position.x - this.position.x;
                    const dz = enemy.position.z - this.position.z;
                    const dist = Math.sqrt(dx * dx + dz * dz);

                    if (dist <= ability.range) {
                        enemy.takeDamage(ability.damage, this);
                        enemy.whirlwindHit = true; // Mark as hit

                        if (this.game.effects) {
                            this.game.effects.createDamageNumber(enemy.position, ability.damage, false, false);
                        }
                    }
                }
            }
        } else {
            // End whirlwind - reset hit flags
            if (this.game && this.game.enemies) {
                for (const enemy of this.game.enemies) {
                    enemy.whirlwindHit = false;
                }
            }

            ability.isActive = false;
            ability.activeTime = 0;
            ability.dashDirection = null;

            // Face the direction we were dashing
            this.rotation = Math.atan2(ability.dashDirection?.x || 0, ability.dashDirection?.z || 1);
        }
    }

    // Ability: Spin Attack (E) - AoE spin damage around player
    useParry() {
        const ability = this.abilities.parry;
        if (ability.cooldownRemaining > 0) return false;
        if (ability.isActive) return false;

        ability.isActive = true;
        ability.activeTime = 0;
        ability.cooldownRemaining = ability.cooldown;
        ability.startRotation = this.rotation;

        // Play attack animation
        if (this.useAnimatedCharacter) {
            this.character.playAttack(2);
        }

        // Create spin visual effect
        if (this.game && this.game.effects) {
            this.game.effects.createSpinAttackEffect(this.position, ability.range);
        }

        // Play spin attack sound
        if (this.game && this.game.sound) {
            this.game.sound.play('spinAttack');
        }

        // Damage all enemies in range
        if (this.game && this.game.enemies) {
            for (const enemy of this.game.enemies) {
                if (enemy.isAlive) {
                    const dx = enemy.position.x - this.position.x;
                    const dz = enemy.position.z - this.position.z;
                    const dist = Math.sqrt(dx * dx + dz * dz);

                    if (dist <= ability.range) {
                        enemy.takeDamage(ability.damage, this);
                        if (this.game.effects) {
                            this.game.effects.createDamageNumber(enemy.position, ability.damage, false, false);
                        }
                    }
                }
            }
        }

        return true;
    }

    // Legacy tryParry kept for compatibility but now does nothing
    tryParry(attacker) {
        return false;
    }

    // Ability: Heroic Leap - jump to target location with AoE damage
    useHeroicLeap(targetPos) {
        const ability = this.abilities.heroicLeap;
        if (ability.cooldownRemaining > 0) return false;
        if (ability.isActive) return false;

        // Validate target position
        if (!targetPos) return false;

        // Check range
        const dx = targetPos.x - this.position.x;
        const dz = targetPos.z - this.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // Clamp to max range
        let finalTarget = targetPos.clone();
        const leapDist = Math.min(dist, ability.range);
        if (dist > ability.range) {
            const dir = new THREE.Vector3(dx, 0, dz).normalize();
            finalTarget = this.position.clone().add(dir.multiplyScalar(ability.range));
        }

        // Check for walls along the entire leap path (can't leap over walls)
        if (this.game && this.game.checkWallCollision) {
            const dir = new THREE.Vector3(dx, 0, dz).normalize();
            const stepSize = 0.5;
            let maxValidDist = 0;

            // Step along path and find furthest valid position before hitting a wall
            for (let testDist = stepSize; testDist <= leapDist; testDist += stepSize) {
                const testPos = this.position.clone().add(dir.clone().multiplyScalar(testDist));
                if (this.game.checkWallCollision(testPos.x, testPos.z, 0.5)) {
                    // Hit a wall - stop here
                    break;
                }
                maxValidDist = testDist;
            }

            // If we can't move at all, cancel the leap
            if (maxValidDist < 1) {
                return false;
            }

            // Update final target to furthest valid position
            if (maxValidDist < leapDist) {
                finalTarget = this.position.clone().add(dir.clone().multiplyScalar(maxValidDist));
            }
        }

        ability.isActive = true;
        ability.activeTime = 0;
        ability.cooldownRemaining = ability.cooldown;
        ability.startPos = this.position.clone();
        ability.targetPos = finalTarget;

        // Face target direction
        this.rotation = Math.atan2(dx, dz);

        // Play jump animation
        if (this.useAnimatedCharacter) {
            this.character.playJump();
        }

        // Create leap trail effect
        if (this.game && this.game.effects) {
            this.game.effects.createLeapTrailEffect(this.position);
        }

        // Play leap launch sound
        if (this.game && this.game.sound) {
            this.game.sound.play('heroicLeap');
        }

        return true;
    }

    updateHeroicLeap(deltaTime) {
        const ability = this.abilities.heroicLeap;
        ability.activeTime += deltaTime;

        const progress = Math.min(ability.activeTime / ability.leapDuration, 1);

        // Parabolic arc - higher jump at midpoint
        const arcHeight = 5;
        const t = progress;
        const heightOffset = 4 * arcHeight * t * (1 - t); // Parabola peaking at t=0.5

        // Interpolate position
        this.position.x = ability.startPos.x + (ability.targetPos.x - ability.startPos.x) * progress;
        this.position.z = ability.startPos.z + (ability.targetPos.z - ability.startPos.z) * progress;
        this.position.y = heightOffset;

        // Trail particles during leap
        if (this.game && this.game.particles && Math.random() < 0.8) {
            this.game.particles.leapTrail(this.position);
        }

        // Land
        if (progress >= 1) {
            this.position.y = 0;
            ability.isActive = false;
            ability.activeTime = 0;

            // AoE damage and stun on landing
            if (this.game) {
                // Ground slam effect
                if (this.game.effects) {
                    this.game.effects.createGroundSlamEffect(this.position, ability.aoeRadius);
                }

                // Shockwave particles
                if (this.game.particles) {
                    this.game.particles.groundSlam(this.position, ability.aoeRadius);
                }

                // Screen shake
                this.game.addScreenShake(0.8);

                // Play ground slam sound
                if (this.game.sound) {
                    this.game.sound.play('groundSlam');
                }

                // Damage and stun enemies in AoE
                for (const enemy of this.game.enemies) {
                    if (!enemy.isAlive) continue;
                    const dx = enemy.position.x - this.position.x;
                    const dz = enemy.position.z - this.position.z;
                    const dist = Math.sqrt(dx * dx + dz * dz);
                    if (dist <= ability.aoeRadius) {
                        enemy.takeDamage(ability.damage, this);
                        enemy.stun(ability.stunDuration);
                        if (this.game.effects) {
                            this.game.effects.createDamageNumber(enemy.position, ability.damage);
                        }
                    }
                }
            }

            ability.startPos = null;
            ability.targetPos = null;
        }
    }

    // Ability: Health Potion
    usePotion() {
        const ability = this.abilities.potion;
        if (ability.cooldownRemaining > 0) return false;

        ability.cooldownRemaining = ability.cooldown;
        this.health = Math.min(this.maxHealth, this.health + ability.healAmount);

        // Healing effect
        if (this.game && this.game.effects) {
            this.game.effects.createPotionEffect(this.position);
            this.game.effects.createDamageNumber(this.position, ability.healAmount, true);
        }

        // Heal particles
        if (this.game && this.game.particles) {
            this.game.particles.healEffect(this.position);
        }

        // Play heal sound
        if (this.game && this.game.sound) {
            this.game.sound.play('heal');
        }

        // Screen flash effect for healing
        if (this.game && this.game.addScreenFlash) {
            this.game.addScreenFlash('heal');
        }

        return true;
    }

    // Ability: Sunder - shoot a wave of ground spikes
    useSunder(direction = null) {
        const ability = this.abilities.sunder;
        if (ability.cooldownRemaining > 0) return false;

        ability.cooldownRemaining = ability.cooldown;

        // Use provided direction or default to player facing
        let forward;
        if (direction) {
            forward = new THREE.Vector3(direction.x, 0, direction.z).normalize();
            this.rotation = Math.atan2(forward.x, forward.z);
        } else {
            forward = new THREE.Vector3(
                Math.sin(this.rotation),
                0,
                Math.cos(this.rotation)
            );
        }

        // Play attack animation
        if (this.useAnimatedCharacter) {
            this.character.playAttack(3);
        }

        // Create spike wave visual effect
        if (this.game && this.game.effects) {
            this.game.effects.createSunderEffect(this.position, forward, ability.range, ability.spikeCount);
        }

        // Particle effect
        if (this.game && this.game.particles) {
            this.game.particles.sunderWave(this.position, forward, ability.range);
        }

        // Play sunder sound
        if (this.game && this.game.sound) {
            this.game.sound.play('sunder');
        }

        // Damage enemies in line (widening cone)
        if (this.game && this.game.enemies) {
            const perp = new THREE.Vector3(-forward.z, 0, forward.x);
            const startWidth = 0.5;
            const endWidth = ability.width * 2;

            for (const enemy of this.game.enemies) {
                if (!enemy.isAlive) continue;

                const toEnemy = new THREE.Vector3(
                    enemy.position.x - this.position.x,
                    0,
                    enemy.position.z - this.position.z
                );

                // Check if enemy is in front (within range)
                const forwardDist = toEnemy.dot(forward);
                if (forwardDist < 0.5 || forwardDist > ability.range) continue;

                // Width increases with distance (trapezoid shape)
                const distRatio = forwardDist / ability.range;
                const widthAtDist = startWidth + (endWidth - startWidth) * distRatio;

                // Check if enemy is within width at that distance
                const perpDist = Math.abs(toEnemy.dot(perp));
                if (perpDist > widthAtDist) continue;

                // Hit this enemy!
                enemy.takeDamage(ability.damage, this);

                // Damage number
                if (this.game.effects) {
                    this.game.effects.createDamageNumber(enemy.position, ability.damage, false, false);
                }
            }
        }

        return true;
    }

    takeDamage(amount) {
        // Invulnerable during spin attack
        if (this.abilities.parry.isActive) {
            return;
        }

        this.health -= amount;

        // Play impact animation
        if (this.useAnimatedCharacter) {
            this.character.playImpact();
        }

        // Hit particles
        if (this.game && this.game.particles) {
            this.game.particles.playerHit(this.position);
            this.game.addScreenShake(Math.min(amount / 20, 0.5));
        }

        // Play hit sound
        if (this.game && this.game.sound) {
            this.game.sound.play('playerHit');
        }

        // Screen flash effect
        if (this.game && this.game.addScreenFlash) {
            this.game.addScreenFlash(amount > 20 ? 'critical' : 'damage');
        }

        if (this.health <= 0) {
            this.health = 0;
            this.die();
        }
    }

    die() {
        console.log('Player died!');

        // Play death animation
        if (this.useAnimatedCharacter) {
            this.character.playDeath();
        }

        // Play death sound
        if (this.game && this.game.sound) {
            this.game.sound.play('playerDeath');
        }

        // Reset for now
        setTimeout(() => {
            this.health = this.maxHealth;
            this.position.set(0, 0, 0);
            // Reset to idle after respawn
            if (this.useAnimatedCharacter) {
                this.character.playAnimation('idle', true);
            }
        }, 2000);
    }

    // Apply a temporary buff
    applyBuff(buffType, options) {
        const { multiplier, duration } = options;

        // Store original value if not already buffed
        if (!this.buffs[buffType]) {
            this.buffs[buffType] = {
                originalValue: this.getBuffBaseValue(buffType),
                multiplier: multiplier,
                remaining: duration
            };
        } else {
            // Refresh duration if already buffed
            this.buffs[buffType].remaining = duration;
            this.buffs[buffType].multiplier = multiplier;
        }

        // Apply the buff effect
        this.applyBuffEffect(buffType);

        // Visual feedback
        if (this.game && this.game.particles) {
            const color = this.getBuffColor(buffType);
            this.game.particles.buffAura(this.position, color);
        }
    }

    getBuffBaseValue(buffType) {
        switch (buffType) {
            case 'speed': return this.moveSpeed;
            case 'damage': return this.autoAttackDamage;
            case 'defense': return 1; // Damage multiplier
            default: return 1;
        }
    }

    getBuffColor(buffType) {
        switch (buffType) {
            case 'speed': return 0x44aaff;
            case 'damage': return 0xff6644;
            case 'defense': return 0x888888;
            default: return 0x44ff88;
        }
    }

    applyBuffEffect(buffType) {
        const buff = this.buffs[buffType];
        if (!buff) return;

        switch (buffType) {
            case 'speed':
                this.moveSpeed = buff.originalValue * buff.multiplier;
                break;
            case 'damage':
                this.autoAttackDamage = Math.floor(buff.originalValue * buff.multiplier);
                break;
            // Defense is checked in takeDamage
        }
    }

    removeBuffEffect(buffType) {
        const buff = this.buffs[buffType];
        if (!buff) return;

        switch (buffType) {
            case 'speed':
                this.moveSpeed = buff.originalValue;
                break;
            case 'damage':
                this.autoAttackDamage = buff.originalValue;
                break;
        }

        delete this.buffs[buffType];
    }

    updateBuffs(deltaTime) {
        for (const buffType in this.buffs) {
            const buff = this.buffs[buffType];
            buff.remaining -= deltaTime;

            if (buff.remaining <= 0) {
                this.removeBuffEffect(buffType);
            }
        }
    }

    // Get total stats including equipment bonuses
    getStats() {
        const baseStats = {
            damage: this.autoAttackDamage,
            defense: 0,
            maxHealth: this.maxHealth,
            attackSpeed: 0,
            moveSpeed: this.moveSpeed,
            magicPower: 0
        };

        // Add equipment bonuses
        if (this.inventory) {
            const equipStats = this.inventory.getEquipmentStats();
            return {
                damage: baseStats.damage + (equipStats.damage || 0),
                defense: baseStats.defense + (equipStats.defense || 0),
                maxHealth: baseStats.maxHealth + (equipStats.maxHealth || 0),
                attackSpeed: baseStats.attackSpeed + (equipStats.attackSpeed || 0),
                moveSpeed: baseStats.moveSpeed + (baseStats.moveSpeed * (equipStats.moveSpeed || 0) / 100),
                magicPower: baseStats.magicPower + (equipStats.magicPower || 0)
            };
        }

        return baseStats;
    }
}
