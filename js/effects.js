import * as THREE from 'three';

export class EffectsManager {
    constructor(scene) {
        this.scene = scene;
        this.effects = [];

        // Cache for damage number textures to avoid WebGL texture limit
        this.damageTextureCache = new Map();
        this.maxDamageNumbers = 15; // Limit concurrent damage numbers
        this.damageNumberCount = 0;

        // Shared materials for simple effects (no textures)
        this.sharedMaterials = {
            white: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }),
            orange: new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true }),
            blue: new THREE.MeshBasicMaterial({ color: 0x4488ff, transparent: true }),
            yellow: new THREE.MeshBasicMaterial({ color: 0xffffaa, transparent: true })
        };
    }

    update(deltaTime) {
        for (let i = this.effects.length - 1; i >= 0; i--) {
            const effect = this.effects[i];
            effect.life -= deltaTime;

            if (effect.update) {
                effect.update(deltaTime, effect);
            }

            if (effect.life <= 0) {
                if (effect.mesh) {
                    this.scene.remove(effect.mesh);
                    if (effect.mesh.geometry) effect.mesh.geometry.dispose();
                    if (effect.mesh.material) {
                        // Don't dispose cached textures - only dispose non-cached materials
                        if (!effect.usesCachedTexture) {
                            if (effect.mesh.material.map) {
                                effect.mesh.material.map.dispose();
                            }
                            effect.mesh.material.dispose();
                        }
                    }
                }
                if (effect.group) {
                    effect.group.traverse((child) => {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material && !this.isSharedMaterial(child.material)) {
                            if (child.material.map) child.material.map.dispose();
                            child.material.dispose();
                        }
                    });
                    this.scene.remove(effect.group);
                }
                // Track damage number count
                if (effect.isDamageNumber) {
                    this.damageNumberCount--;
                }
                this.effects.splice(i, 1);
            }
        }
    }

    // Check if material is one of our shared materials
    isSharedMaterial(material) {
        return Object.values(this.sharedMaterials).includes(material);
    }

    // Get or create cached damage number texture with enhanced visuals
    getDamageTexture(damage, isHeal, isCrit) {
        const key = `${Math.round(damage)}_${isHeal ? 'h' : 'd'}_${isCrit ? 'c' : 'n'}`;

        if (this.damageTextureCache.has(key)) {
            return this.damageTextureCache.get(key);
        }

        // Limit cache size
        if (this.damageTextureCache.size > 50) {
            const keysToDelete = Array.from(this.damageTextureCache.keys()).slice(0, 10);
            for (const k of keysToDelete) {
                const tex = this.damageTextureCache.get(k);
                tex.dispose();
                this.damageTextureCache.delete(k);
            }
        }

        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        // Determine color and style based on damage type
        let color = '#ff4444';
        let glowColor = '#ff0000';
        let fontSize = 64;
        let prefix = '';

        if (isHeal) {
            color = '#44ff88';
            glowColor = '#00ff44';
            prefix = '+';
        } else if (isCrit || damage > 40) {
            color = '#ffdd44';
            glowColor = '#ffaa00';
            fontSize = 72;
            prefix = '!';
        } else if (damage > 25) {
            color = '#ff8844';
            glowColor = '#ff4400';
        }

        const text = prefix + Math.round(damage);

        // Draw outer glow
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 15;
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = glowColor;
        ctx.fillText(text, 128, 64);

        // Draw dark outline
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 6;
        ctx.strokeText(text, 128, 64);

        // Draw inner lighter outline for depth
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 3;
        ctx.strokeText(text, 128, 64);

        // Draw main text
        ctx.fillStyle = color;
        ctx.fillText(text, 128, 64);

        // Add highlight on top portion
        const gradient = ctx.createLinearGradient(0, 40, 0, 88);
        gradient.addColorStop(0, 'rgba(255,255,255,0.4)');
        gradient.addColorStop(0.5, 'rgba(255,255,255,0)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.2)');
        ctx.fillStyle = gradient;
        ctx.fillText(text, 128, 64);

        const texture = new THREE.CanvasTexture(canvas);
        this.damageTextureCache.set(key, texture);
        return texture;
    }

    // Sword swing arc effect - clear horizontal slash arc (90 degree, range 3)
    createSwingEffect(position, rotation, color = 0xffffff) {
        const group = new THREE.Group();

        // Create wide arc using TorusGeometry (90 degree arc)
        // Arc is in front of character (+Z direction in local space)
        const arcGeometry = new THREE.TorusGeometry(2.5, 0.1, 8, 32, Math.PI * 0.5);
        const arcMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffaa,
            transparent: true,
            opacity: 1.0
        });
        const arc = new THREE.Mesh(arcGeometry, arcMaterial);
        arc.rotation.x = -Math.PI / 2; // Lay horizontal, facing forward
        arc.rotation.z = Math.PI * 0.75; // Center the arc in front (+Z)
        arc.position.y = 1.2;
        group.add(arc);

        // Inner brighter arc
        const innerArcGeometry = new THREE.TorusGeometry(2, 0.15, 8, 32, Math.PI * 0.45);
        const innerArcMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 1.0
        });
        const innerArc = new THREE.Mesh(innerArcGeometry, innerArcMaterial);
        innerArc.rotation.x = -Math.PI / 2;
        innerArc.rotation.z = Math.PI * 0.775;
        innerArc.position.y = 1.2;
        group.add(innerArc);

        // Trailing particles across the wider arc - in front
        for (let i = 0; i < 7; i++) {
            const sparkGeometry = new THREE.SphereGeometry(0.1, 6, 6);
            const sparkMaterial = new THREE.MeshBasicMaterial({
                color: 0xffff88,
                transparent: true,
                opacity: 0.9
            });
            const spark = new THREE.Mesh(sparkGeometry, sparkMaterial);
            // Spread particles in arc in front (+Z direction)
            const angle = -Math.PI * 0.25 + (i / 6) * Math.PI * 0.5;
            spark.position.x = Math.sin(angle) * 2.5;
            spark.position.z = Math.abs(Math.cos(angle)) * 2.5 + 0.5; // Always positive Z (in front)
            spark.position.y = 1.2;
            group.add(spark);
        }

        group.position.copy(position);
        group.rotation.y = rotation; // Match player facing direction

        this.scene.add(group);

        this.effects.push({
            group: group,
            life: 0.25,
            update: (dt, eff) => {
                const progress = (0.25 - eff.life) / 0.25;
                // Sweep the arc
                const sweepAngle = progress * Math.PI * 0.3;
                group.children[0].rotation.z = Math.PI * 0.75 - sweepAngle;
                group.children[1].rotation.z = Math.PI * 0.775 - sweepAngle;

                // Fade and scale
                group.children.forEach((child) => {
                    child.material.opacity = eff.life * 4;
                    child.scale.setScalar(1 + progress * 0.2);
                });
            }
        });
    }

    // Cleave cone effect - ground shockwave expanding forward (126 degree, range 5.5)
    createCleaveEffect(position, rotation) {
        console.log('Creating cleave effect at', position, 'rotation', rotation);
        const group = new THREE.Group();

        // Ground cone shockwave (126 degree arc expanding outward, centered forward)
        const coneAngle = Math.PI * 0.7; // 126 degrees
        const coneArcGeometry = new THREE.RingGeometry(0.5, 1.2, 32, 1, -coneAngle / 2, coneAngle);
        const coneArcMaterial = new THREE.MeshBasicMaterial({
            color: 0xff6600,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        const coneArc = new THREE.Mesh(coneArcGeometry, coneArcMaterial);
        coneArc.rotation.x = -Math.PI / 2; // Flat on ground
        coneArc.rotation.z = -Math.PI / 2; // Point forward
        coneArc.position.y = 0.15;
        group.add(coneArc);

        // Second expanding ring
        const ring2Geometry = new THREE.RingGeometry(0.3, 1, 32, 1, -coneAngle / 2, coneAngle);
        const ring2Material = new THREE.MeshBasicMaterial({
            color: 0xffaa44,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        const ring2 = new THREE.Mesh(ring2Geometry, ring2Material);
        ring2.rotation.x = -Math.PI / 2;
        ring2.rotation.z = -Math.PI / 2;
        ring2.position.y = 0.2;
        group.add(ring2);

        // Particles shooting forward in wider spread
        for (let i = 0; i < 12; i++) {
            const particleGeometry = new THREE.SphereGeometry(0.18, 6, 6);
            const particleMaterial = new THREE.MeshBasicMaterial({
                color: 0xff8800,
                transparent: true,
                opacity: 0.9
            });
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            const spreadAngle = -coneAngle / 2 + (i / 11) * coneAngle;
            particle.position.x = Math.sin(spreadAngle) * 1.5;
            particle.position.z = -Math.cos(spreadAngle) * 1.5; // Negative Z for forward
            particle.position.y = 0.8 + Math.random() * 0.4;
            particle.userData.angle = spreadAngle;
            group.add(particle);
        }

        group.position.copy(position);
        group.rotation.y = rotation; // Match player facing direction

        this.scene.add(group);

        this.effects.push({
            group: group,
            life: 0.45,
            update: (dt, eff) => {
                const progress = (0.45 - eff.life) / 0.45;

                // Ground rings expand forward - larger scale for range 5.5
                const groundScale = 1 + progress * 5;
                group.children[0].scale.set(groundScale, groundScale, 1);
                group.children[0].material.opacity = eff.life * 2.2;

                group.children[1].scale.set(groundScale * 0.8, groundScale * 0.8, 1);
                group.children[1].material.opacity = eff.life * 2;

                // Particles shoot forward in cone pattern
                for (let i = 2; i < group.children.length; i++) {
                    const p = group.children[i];
                    const dist = 1.5 + progress * 5;
                    p.position.x = Math.sin(p.userData.angle) * dist;
                    p.position.z = -Math.cos(p.userData.angle) * dist; // Negative Z for forward
                    p.material.opacity = eff.life * 2.2;
                    p.scale.setScalar(1 - progress * 0.3);
                }
            }
        });
    }

    // Flame Wave effect - mage cone fire attack
    createFlameWaveEffect(position, rotation) {
        console.log('Creating flame wave effect at', position, 'rotation', rotation);
        const group = new THREE.Group();

        // Fire cone on ground
        const coneAngle = Math.PI * 0.6; // 108 degrees
        const fireArcGeometry = new THREE.RingGeometry(0.5, 1.5, 32, 1, -coneAngle / 2, coneAngle);
        const fireArcMaterial = new THREE.MeshBasicMaterial({
            color: 0xff4400,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        const fireArc = new THREE.Mesh(fireArcGeometry, fireArcMaterial);
        fireArc.rotation.x = -Math.PI / 2;
        fireArc.rotation.z = -Math.PI / 2;
        fireArc.position.y = 0.2;
        group.add(fireArc);

        // Inner brighter cone
        const innerArcGeometry = new THREE.RingGeometry(0.3, 1, 32, 1, -coneAngle / 2, coneAngle);
        const innerArcMaterial = new THREE.MeshBasicMaterial({
            color: 0xff8800,
            transparent: true,
            opacity: 0.85,
            side: THREE.DoubleSide
        });
        const innerArc = new THREE.Mesh(innerArcGeometry, innerArcMaterial);
        innerArc.rotation.x = -Math.PI / 2;
        innerArc.rotation.z = -Math.PI / 2;
        innerArc.position.y = 0.25;
        group.add(innerArc);

        // Fire particles in cone
        for (let i = 0; i < 15; i++) {
            const particleGeometry = new THREE.SphereGeometry(0.2, 6, 6);
            const particleMaterial = new THREE.MeshBasicMaterial({
                color: i < 5 ? 0xffcc00 : 0xff6600,
                transparent: true,
                opacity: 0.9
            });
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            const spreadAngle = -coneAngle / 2 + Math.random() * coneAngle;
            const dist = 0.5 + Math.random() * 1.5;
            particle.position.x = Math.sin(spreadAngle) * dist;
            particle.position.z = -Math.cos(spreadAngle) * dist;
            particle.position.y = 0.5 + Math.random() * 1;
            particle.userData.angle = spreadAngle;
            particle.userData.ySpeed = 2 + Math.random() * 2;
            group.add(particle);
        }

        group.position.copy(position);
        group.rotation.y = rotation;

        this.scene.add(group);

        this.effects.push({
            group: group,
            life: 0.5,
            update: (dt, eff) => {
                const progress = (0.5 - eff.life) / 0.5;

                // Fire arcs expand
                const scale = 1 + progress * 9;
                group.children[0].scale.set(scale, scale, 1);
                group.children[0].material.opacity = eff.life * 2;

                group.children[1].scale.set(scale * 0.9, scale * 0.9, 1);
                group.children[1].material.opacity = eff.life * 1.8;

                // Fire particles shoot out and rise
                for (let i = 2; i < group.children.length; i++) {
                    const p = group.children[i];
                    const dist = 1 + progress * 8;
                    p.position.x = Math.sin(p.userData.angle) * dist;
                    p.position.z = -Math.cos(p.userData.angle) * dist;
                    p.position.y += p.userData.ySpeed * dt;
                    p.material.opacity = eff.life * 2;
                    p.scale.setScalar(1 - progress * 0.4);
                }
            }
        });
    }

    // Parry shield effect - defensive stance around player
    createParryEffect(position, rotation = 0) {
        const shieldGeometry = new THREE.CircleGeometry(1.5, 24);
        const shieldMaterial = new THREE.MeshBasicMaterial({
            color: 0x4488ff,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        const shield = new THREE.Mesh(shieldGeometry, shieldMaterial);

        // Add inner glow ring
        const ringGeometry = new THREE.RingGeometry(1.2, 1.5, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0x88ccff,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        shield.add(ring);

        // Position around player (horizontal circle)
        shield.position.copy(position);
        shield.position.y += 1;
        shield.rotation.x = -Math.PI / 2; // Lay flat like a defensive aura

        this.scene.add(shield);

        this.effects.push({
            mesh: shield,
            life: 0.4,
            startPos: position.clone(),
            update: (dt, eff) => {
                eff.mesh.material.opacity = eff.life * 1.5;
                ring.material.opacity = eff.life * 2;
                // Pulse effect
                const pulse = 1 + Math.sin(eff.life * 30) * 0.1;
                eff.mesh.scale.set(pulse, pulse, pulse);
            }
        });
    }

    // Successful parry riposte effect
    createRiposteEffect(position, targetPosition) {
        const group = new THREE.Group();

        // Flash at player
        const flashGeometry = new THREE.SphereGeometry(1.5, 8, 8);
        const flashMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff44,
            transparent: true,
            opacity: 0.8
        });
        const flash = new THREE.Mesh(flashGeometry, flashMaterial);
        flash.position.copy(position);
        flash.position.y += 1;
        group.add(flash);

        // Slash toward target
        const dir = new THREE.Vector3().subVectors(targetPosition, position).normalize();
        const slashGeometry = new THREE.BoxGeometry(0.1, 0.3, 2);
        const slashMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff88,
            transparent: true,
            opacity: 0.9
        });
        const slash = new THREE.Mesh(slashGeometry, slashMaterial);
        slash.position.copy(position);
        slash.position.y += 1;
        slash.lookAt(targetPosition);
        group.add(slash);

        this.scene.add(group);

        this.effects.push({
            group: group,
            life: 0.3,
            update: (dt, eff) => {
                flash.material.opacity = eff.life * 2.5;
                flash.scale.multiplyScalar(1 + dt * 5);
                slash.material.opacity = eff.life * 3;
                slash.scale.z = 1 + (0.3 - eff.life) * 5;
            }
        });
    }

    // Spin attack AoE effect - expanding ring around player
    createSpinAttackEffect(position, radius) {
        const group = new THREE.Group();

        // Expanding ring
        const ringGeometry = new THREE.RingGeometry(0.5, 1.5, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0xff8844,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = -Math.PI / 2; // Lay flat
        ring.position.copy(position);
        ring.position.y = 0.2;
        group.add(ring);

        // Arc slashes around the player
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const slashGeometry = new THREE.PlaneGeometry(radius * 0.7, 0.4);
            const slashMaterial = new THREE.MeshBasicMaterial({
                color: 0xffaa44,
                transparent: true,
                opacity: 0.9,
                side: THREE.DoubleSide
            });
            const slash = new THREE.Mesh(slashGeometry, slashMaterial);
            slash.position.set(
                position.x + Math.cos(angle) * (radius * 0.5),
                1,
                position.z + Math.sin(angle) * (radius * 0.5)
            );
            slash.rotation.y = angle;
            slash.rotation.x = Math.PI / 4;
            group.add(slash);
        }

        this.scene.add(group);

        const startRadius = radius;
        this.effects.push({
            group: group,
            life: 0.4,
            update: (dt, eff) => {
                // Expand ring outward
                const progress = 1 - eff.life / 0.4;
                const currentRadius = 0.5 + progress * startRadius;
                ring.scale.set(currentRadius, currentRadius, 1);
                ring.material.opacity = eff.life * 2;

                // Fade slashes
                group.children.forEach((child, idx) => {
                    if (idx > 0) { // Skip ring
                        child.material.opacity = eff.life * 2;
                        child.rotation.y += dt * 15; // Spin effect
                    }
                });
            }
        });
    }

    // Charge dash trail effect
    createChargeEffect(startPosition, endPosition) {
        const group = new THREE.Group();

        // Trail particles
        const dir = new THREE.Vector3().subVectors(endPosition, startPosition);
        const distance = dir.length();
        dir.normalize();

        for (let i = 0; i < 10; i++) {
            const t = i / 10;
            const particleGeometry = new THREE.SphereGeometry(0.3 - t * 0.2, 6, 6);
            const particleMaterial = new THREE.MeshBasicMaterial({
                color: 0x44aaff,
                transparent: true,
                opacity: 0.8 - t * 0.5
            });
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            particle.position.copy(startPosition);
            particle.position.addScaledVector(dir, distance * t);
            particle.position.y += 1;
            group.add(particle);
        }

        // Impact ring at end
        const ringGeometry = new THREE.RingGeometry(0.5, 1.5, 16);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0x88ddff,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.position.copy(endPosition);
        ring.position.y += 0.1;
        ring.rotation.x = -Math.PI / 2;
        group.add(ring);

        this.scene.add(group);

        this.effects.push({
            group: group,
            life: 0.5,
            update: (dt, eff) => {
                group.children.forEach((child, i) => {
                    child.material.opacity *= 0.95;
                    if (i === group.children.length - 1) {
                        // Ring expands
                        child.scale.multiplyScalar(1 + dt * 4);
                    }
                });
            }
        });
    }

    // Bladestorm spinning blades effect
    createBladestormEffect(playerGroup) {
        const group = new THREE.Group();

        // Spinning blades
        for (let i = 0; i < 4; i++) {
            const bladeGeometry = new THREE.BoxGeometry(0.1, 0.4, 1.5);
            const bladeMaterial = new THREE.MeshBasicMaterial({
                color: 0xaaaaff,
                transparent: true,
                opacity: 0.8
            });
            const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
            blade.position.y = 1;
            const angle = (i / 4) * Math.PI * 2;
            blade.position.x = Math.cos(angle) * 1.5;
            blade.position.z = Math.sin(angle) * 1.5;
            blade.rotation.y = angle;
            group.add(blade);
        }

        // Central vortex
        const vortexGeometry = new THREE.CylinderGeometry(0.8, 1.2, 2, 16, 1, true);
        const vortexMaterial = new THREE.MeshBasicMaterial({
            color: 0x6666ff,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        });
        const vortex = new THREE.Mesh(vortexGeometry, vortexMaterial);
        vortex.position.y = 1;
        group.add(vortex);

        this.scene.add(group);

        const effect = {
            group: group,
            life: 3,
            playerGroup: playerGroup,
            spinAngle: 0,
            update: (dt, eff) => {
                // Follow player
                eff.group.position.copy(eff.playerGroup.position);

                // Spin
                eff.spinAngle += dt * 15;
                eff.group.rotation.y = eff.spinAngle;

                // Pulse opacity
                const pulse = 0.5 + Math.sin(eff.spinAngle * 2) * 0.3;
                vortex.material.opacity = pulse * 0.3;
            }
        };

        this.effects.push(effect);
        return effect;
    }

    // End bladestorm - throw disk
    createBladestormDiskEffect(position, direction) {
        const diskGeometry = new THREE.CylinderGeometry(0.8, 0.8, 0.1, 16);
        const diskMaterial = new THREE.MeshBasicMaterial({
            color: 0x88aaff,
            transparent: true,
            opacity: 0.9
        });
        const disk = new THREE.Mesh(diskGeometry, diskMaterial);
        disk.position.copy(position);
        disk.position.y += 1;
        disk.rotation.x = Math.PI / 2;

        this.scene.add(disk);

        this.effects.push({
            mesh: disk,
            life: 1.5,
            velocity: direction.clone().multiplyScalar(20),
            spinSpeed: 25,
            update: (dt, eff) => {
                eff.mesh.position.addScaledVector(eff.velocity, dt);
                eff.mesh.rotation.z += eff.spinSpeed * dt;
                eff.mesh.material.opacity = Math.min(eff.life, 1);
            }
        });
    }

    // Health potion effect
    createPotionEffect(position) {
        const group = new THREE.Group();

        // Rising particles
        for (let i = 0; i < 12; i++) {
            const particleGeometry = new THREE.SphereGeometry(0.15, 6, 6);
            const particleMaterial = new THREE.MeshBasicMaterial({
                color: 0x44ff44,
                transparent: true,
                opacity: 0.8
            });
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            const angle = (i / 12) * Math.PI * 2;
            particle.position.x = Math.cos(angle) * 0.5;
            particle.position.z = Math.sin(angle) * 0.5;
            particle.position.y = Math.random() * 0.5;
            particle.userData.angle = angle;
            particle.userData.speed = 2 + Math.random();
            group.add(particle);
        }

        // Heal aura ring
        const auraGeometry = new THREE.RingGeometry(0.8, 1.2, 32);
        const auraMaterial = new THREE.MeshBasicMaterial({
            color: 0x88ff88,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        });
        const aura = new THREE.Mesh(auraGeometry, auraMaterial);
        aura.rotation.x = -Math.PI / 2;
        aura.position.y = 0.1;
        group.add(aura);

        group.position.copy(position);

        this.scene.add(group);

        this.effects.push({
            group: group,
            life: 1,
            update: (dt, eff) => {
                group.children.forEach((child, i) => {
                    if (i < 12) {
                        // Particles rise and spiral
                        child.position.y += child.userData.speed * dt;
                        const angle = child.userData.angle + eff.life * 3;
                        child.position.x = Math.cos(angle) * (0.5 + (1 - eff.life) * 0.5);
                        child.position.z = Math.sin(angle) * (0.5 + (1 - eff.life) * 0.5);
                        child.material.opacity = eff.life * 0.8;
                    } else {
                        // Aura expands and fades
                        child.scale.set(1 + (1 - eff.life) * 2, 1 + (1 - eff.life) * 2, 1);
                        child.material.opacity = eff.life * 0.6;
                    }
                });
            }
        });
    }

    // Whirlwind 360° spin effect
    createWhirlwindEffect(position, radius = 3.5) {
        const group = new THREE.Group();

        // Spinning blade ring
        for (let i = 0; i < 6; i++) {
            const bladeGeometry = new THREE.BoxGeometry(0.08, 0.3, 1.2);
            const bladeMaterial = new THREE.MeshBasicMaterial({
                color: 0xffaa44,
                transparent: true,
                opacity: 0.9
            });
            const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
            const angle = (i / 6) * Math.PI * 2;
            blade.position.x = Math.cos(angle) * radius * 0.8;
            blade.position.z = Math.sin(angle) * radius * 0.8;
            blade.position.y = 1;
            blade.rotation.y = angle + Math.PI / 2;
            blade.userData.baseAngle = angle;
            group.add(blade);
        }

        // Ground shockwave ring
        const ringGeometry = new THREE.RingGeometry(radius * 0.3, radius, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0xff8844,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.15;
        group.add(ring);

        // Central vortex effect
        const vortexGeometry = new THREE.CylinderGeometry(0.3, radius * 0.6, 2, 16, 1, true);
        const vortexMaterial = new THREE.MeshBasicMaterial({
            color: 0xffcc66,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide
        });
        const vortex = new THREE.Mesh(vortexGeometry, vortexMaterial);
        vortex.position.y = 1;
        group.add(vortex);

        group.position.copy(position);
        this.scene.add(group);

        this.effects.push({
            group: group,
            life: 0.4,
            spinAngle: 0,
            update: (dt, eff) => {
                eff.spinAngle += dt * 25;
                const progress = (0.4 - eff.life) / 0.4;

                // Spin blades outward
                for (let i = 0; i < 6; i++) {
                    const blade = group.children[i];
                    const angle = blade.userData.baseAngle + eff.spinAngle;
                    const r = radius * (0.5 + progress * 0.5);
                    blade.position.x = Math.cos(angle) * r;
                    blade.position.z = Math.sin(angle) * r;
                    blade.rotation.y = angle + Math.PI / 2;
                    blade.material.opacity = eff.life * 2.5;
                }

                // Expand and fade ring
                const ringScale = 1 + progress * 0.5;
                group.children[6].scale.set(ringScale, ringScale, 1);
                group.children[6].material.opacity = eff.life * 2;

                // Vortex effect
                group.children[7].rotation.y = eff.spinAngle * 0.5;
                group.children[7].material.opacity = eff.life * 0.5;
            }
        });
    }

    // Heroic Leap launch trail effect
    createLeapTrailEffect(position) {
        const group = new THREE.Group();

        // Launch burst
        const burstGeometry = new THREE.RingGeometry(0.5, 2, 16);
        const burstMaterial = new THREE.MeshBasicMaterial({
            color: 0x66aaff,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        const burst = new THREE.Mesh(burstGeometry, burstMaterial);
        burst.rotation.x = -Math.PI / 2;
        burst.position.y = 0.1;
        group.add(burst);

        // Vertical energy column
        const columnGeometry = new THREE.CylinderGeometry(0.3, 0.8, 3, 12, 1, true);
        const columnMaterial = new THREE.MeshBasicMaterial({
            color: 0x88ccff,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        });
        const column = new THREE.Mesh(columnGeometry, columnMaterial);
        column.position.y = 1.5;
        group.add(column);

        group.position.copy(position);
        this.scene.add(group);

        this.effects.push({
            group: group,
            life: 0.5,
            update: (dt, eff) => {
                const progress = (0.5 - eff.life) / 0.5;

                // Burst expands
                const burstScale = 1 + progress * 2;
                group.children[0].scale.set(burstScale, burstScale, 1);
                group.children[0].material.opacity = eff.life * 2;

                // Column rises and fades
                group.children[1].position.y = 1.5 + progress * 3;
                group.children[1].scale.y = 1 - progress * 0.5;
                group.children[1].material.opacity = eff.life * 1.5;
            }
        });
    }

    // Ground slam AoE effect
    createGroundSlamEffect(position, radius = 4) {
        const group = new THREE.Group();

        // Central impact crater
        const craterGeometry = new THREE.RingGeometry(0.2, radius * 0.4, 24);
        const craterMaterial = new THREE.MeshBasicMaterial({
            color: 0xff6622,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        const crater = new THREE.Mesh(craterGeometry, craterMaterial);
        crater.rotation.x = -Math.PI / 2;
        crater.position.y = 0.12;
        group.add(crater);

        // Expanding shockwave rings
        for (let i = 0; i < 3; i++) {
            const ringGeometry = new THREE.RingGeometry(
                radius * (0.2 + i * 0.25),
                radius * (0.3 + i * 0.25),
                32
            );
            const ringMaterial = new THREE.MeshBasicMaterial({
                color: i === 0 ? 0xffaa44 : 0xff8822,
                transparent: true,
                opacity: 0.8 - i * 0.15,
                side: THREE.DoubleSide
            });
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.rotation.x = -Math.PI / 2;
            ring.position.y = 0.1 + i * 0.02;
            ring.userData.delay = i * 0.05;
            group.add(ring);
        }

        // Debris chunks flying up
        for (let i = 0; i < 8; i++) {
            const chunkGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
            const chunkMaterial = new THREE.MeshBasicMaterial({
                color: 0x886644,
                transparent: true,
                opacity: 0.9
            });
            const chunk = new THREE.Mesh(chunkGeometry, chunkMaterial);
            const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.3;
            const dist = radius * (0.3 + Math.random() * 0.4);
            chunk.position.x = Math.cos(angle) * dist;
            chunk.position.z = Math.sin(angle) * dist;
            chunk.position.y = 0.2;
            chunk.userData.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 4,
                6 + Math.random() * 4,
                (Math.random() - 0.5) * 4
            );
            chunk.userData.rotSpeed = (Math.random() - 0.5) * 10;
            group.add(chunk);
        }

        group.position.copy(position);
        this.scene.add(group);

        this.effects.push({
            group: group,
            life: 0.8,
            update: (dt, eff) => {
                const progress = (0.8 - eff.life) / 0.8;

                // Crater fades
                group.children[0].material.opacity = eff.life * 1.5;

                // Rings expand outward
                for (let i = 1; i < 4; i++) {
                    const ring = group.children[i];
                    const ringProgress = Math.max(0, progress - ring.userData.delay * 2);
                    const scale = 1 + ringProgress * 1.5;
                    ring.scale.set(scale, scale, 1);
                    ring.material.opacity = Math.max(0, eff.life * 2 - ringProgress);
                }

                // Debris flies up and falls
                for (let i = 4; i < group.children.length; i++) {
                    const chunk = group.children[i];
                    chunk.userData.velocity.y -= dt * 20; // Gravity
                    chunk.position.add(chunk.userData.velocity.clone().multiplyScalar(dt));
                    chunk.rotation.x += chunk.userData.rotSpeed * dt;
                    chunk.rotation.z += chunk.userData.rotSpeed * dt * 0.7;
                    chunk.material.opacity = eff.life;

                    // Stop at ground
                    if (chunk.position.y < 0.15) {
                        chunk.position.y = 0.15;
                        chunk.userData.velocity.set(0, 0, 0);
                    }
                }
            }
        });
    }

    // Sunder - ground spike wave (widens as it goes)
    createSunderEffect(position, direction, range = 12, spikeCount = 6) {
        const group = new THREE.Group();
        const dir = direction.clone().normalize();
        const perp = new THREE.Vector3(-dir.z, 0, dir.x);

        // Create spikes that erupt along the line - get wider and bigger as distance increases
        for (let i = 0; i < spikeCount; i++) {
            const t = (i + 1) / spikeCount; // 0 to 1 progress
            const dist = t * range;
            const spikePos = position.clone().add(dir.clone().multiplyScalar(dist));

            // Spike size increases with distance
            const spikeRadius = 0.25 + t * 0.3;
            const spikeHeight = 1.2 + t * 0.8;

            // Width spread increases with distance
            const spreadWidth = 0.3 + t * 2.0;

            // Main spike (cone)
            const spikeGeometry = new THREE.ConeGeometry(spikeRadius, spikeHeight, 6);
            const spikeMaterial = new THREE.MeshBasicMaterial({
                color: 0x886644,
                transparent: true,
                opacity: 0.9
            });
            const spike = new THREE.Mesh(spikeGeometry, spikeMaterial);
            spike.position.set(spikePos.x - position.x, -0.5, spikePos.z - position.z);
            spike.userData.targetY = spikeHeight / 2;
            spike.userData.delay = i * 0.04;
            spike.userData.emerged = false;
            group.add(spike);

            // Side spikes - more spread out at distance
            const numSideSpikes = Math.floor(2 + t * 2); // More side spikes at distance
            for (let j = -numSideSpikes; j <= numSideSpikes; j++) {
                if (j === 0) continue; // Skip center (already have main spike)

                const smallRadius = (spikeRadius * 0.5) + Math.random() * 0.1;
                const smallHeight = (spikeHeight * 0.6) + Math.random() * 0.2;
                const smallSpikeGeometry = new THREE.ConeGeometry(smallRadius, smallHeight, 4);
                const smallSpikeMaterial = new THREE.MeshBasicMaterial({
                    color: 0x776655,
                    transparent: true,
                    opacity: 0.8
                });
                const smallSpike = new THREE.Mesh(smallSpikeGeometry, smallSpikeMaterial);
                const perpOffset = (j / numSideSpikes) * spreadWidth;
                const randomOffset = (Math.random() - 0.5) * 0.3;
                smallSpike.position.set(
                    spikePos.x - position.x + perp.x * perpOffset + dir.x * randomOffset,
                    -0.5,
                    spikePos.z - position.z + perp.z * perpOffset + dir.z * randomOffset
                );
                smallSpike.rotation.z = (j / numSideSpikes) * 0.4;
                smallSpike.userData.targetY = smallHeight / 2;
                smallSpike.userData.delay = i * 0.04 + 0.02 + Math.random() * 0.02;
                smallSpike.userData.emerged = false;
                group.add(smallSpike);
            }
        }

        // Ground crack - trapezoid shape (narrow to wide)
        const crackShape = new THREE.Shape();
        const startWidth = 0.3;
        const endWidth = 2.5;
        crackShape.moveTo(-startWidth / 2, 0);
        crackShape.lineTo(-endWidth / 2, range);
        crackShape.lineTo(endWidth / 2, range);
        crackShape.lineTo(startWidth / 2, 0);
        crackShape.lineTo(-startWidth / 2, 0);

        const crackGeometry = new THREE.ShapeGeometry(crackShape);
        crackGeometry.rotateX(-Math.PI / 2);
        const crackMaterial = new THREE.MeshBasicMaterial({
            color: 0x442211,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide
        });
        const crack = new THREE.Mesh(crackGeometry, crackMaterial);
        crack.rotation.y = Math.atan2(dir.x, dir.z);
        crack.position.y = 0.05;
        group.add(crack);

        group.position.copy(position);
        this.scene.add(group);

        this.effects.push({
            group: group,
            life: 1.0,
            update: (dt, eff) => {
                const elapsed = 1.0 - eff.life;

                // Spikes emerge from ground
                for (let i = 0; i < group.children.length - 1; i++) {
                    const spike = group.children[i];
                    if (elapsed > spike.userData.delay && !spike.userData.emerged) {
                        const emergeProgress = Math.min(1, (elapsed - spike.userData.delay) / 0.15);
                        spike.position.y = -0.5 + (spike.userData.targetY + 0.5) * emergeProgress;
                        if (emergeProgress >= 1) spike.userData.emerged = true;
                    }
                    // Fade out after emerging
                    if (spike.userData.emerged) {
                        spike.material.opacity = eff.life * 1.5;
                    }
                }

                // Crack fades
                const crack = group.children[group.children.length - 1];
                crack.material.opacity = eff.life * 0.7;
            }
        });
    }

    // Damage number floating text (using sprite) with enhanced animation
    createDamageNumber(position, damage, isHeal = false, isCrit = false) {
        // Limit concurrent damage numbers to prevent texture overflow
        if (this.damageNumberCount >= this.maxDamageNumbers) {
            for (let i = 0; i < this.effects.length; i++) {
                if (this.effects[i].isDamageNumber) {
                    this.effects[i].life = 0;
                    break;
                }
            }
        }

        // Use cached texture
        const texture = this.getDamageTexture(damage, isHeal, isCrit);
        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false
        });
        const sprite = new THREE.Sprite(spriteMaterial);

        // Random offset and initial velocity for variety
        const offsetX = (Math.random() - 0.5) * 1.2;
        const offsetZ = (Math.random() - 0.5) * 0.6;
        const velocityX = (Math.random() - 0.5) * 2;
        sprite.position.set(position.x + offsetX, position.y + 2.2, position.z + offsetZ);
        sprite.scale.set(0.1, 0.05, 1); // Start tiny for pop-in effect

        this.scene.add(sprite);
        this.damageNumberCount++;

        // Determine animation style
        const baseScale = (isCrit || damage > 40) ? 3.5 : 2.5;
        const totalLife = (isCrit || damage > 40) ? 1.5 : 1.2;

        this.effects.push({
            mesh: sprite,
            life: totalLife,
            totalLife: totalLife,
            velocityY: (isCrit || damage > 40) ? 5 : 3.5,
            velocityX: velocityX,
            baseScale: baseScale,
            isDamageNumber: true,
            usesCachedTexture: true,
            update: (dt, eff) => {
                const progress = 1 - (eff.life / eff.totalLife);

                // Movement with slight arc
                eff.mesh.position.y += eff.velocityY * dt;
                eff.mesh.position.x += eff.velocityX * dt;
                eff.velocityY -= dt * 8; // Gravity
                eff.velocityX *= 0.98; // Slow horizontal drift

                // Pop-in bounce scale animation
                let scale;
                if (progress < 0.1) {
                    // Quick pop-in (0-10%)
                    scale = progress * 10 * eff.baseScale * 1.3;
                } else if (progress < 0.2) {
                    // Bounce back (10-20%)
                    const bounceProgress = (progress - 0.1) / 0.1;
                    scale = eff.baseScale * (1.3 - bounceProgress * 0.3);
                } else if (progress < 0.8) {
                    // Hold steady (20-80%)
                    scale = eff.baseScale;
                } else {
                    // Fade out and shrink (80-100%)
                    const fadeProgress = (progress - 0.8) / 0.2;
                    scale = eff.baseScale * (1 - fadeProgress * 0.5);
                }

                eff.mesh.scale.set(scale, scale * 0.5, 1);

                // Opacity: quick fade in, hold, then fade out
                let opacity;
                if (progress < 0.1) {
                    opacity = progress * 10;
                } else if (progress < 0.75) {
                    opacity = 1;
                } else {
                    opacity = 1 - ((progress - 0.75) / 0.25);
                }
                eff.mesh.material.opacity = opacity;
            }
        });
    }

    // Screen flash effect overlay (called from game when player takes damage)
    createScreenFlash(color = 0xff0000, intensity = 0.3, duration = 0.2) {
        // This creates a full-screen flash by adding a plane in front of the camera
        // The actual implementation will be handled by the game class with CSS overlay
        // This method is a placeholder for the effect trigger
        return {
            color: color,
            intensity: intensity,
            duration: duration
        };
    }
}
