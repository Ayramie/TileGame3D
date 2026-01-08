import * as THREE from 'three';

// Sprite-based particle system with soft textures and additive blending
export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        this.maxParticles = 200;

        // Generate textures
        this.textures = {
            soft: this.createSoftCircleTexture(),
            spark: this.createSparkTexture(),
            smoke: this.createSmokeTexture(),
            star: this.createStarTexture(),
            // New magic/fantasy textures
            glow: this.createGlowTexture(),
            flare: this.createFlareTexture(),
            ember: this.createEmberTexture(),
            ring: this.createRingTexture(),
            streak: this.createStreakTexture(),
            magic: this.createMagicTexture()
        };

        // Pre-create sprite pool
        for (let i = 0; i < this.maxParticles; i++) {
            const spriteMaterial = new THREE.SpriteMaterial({
                map: this.textures.soft,
                transparent: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.visible = false;
            this.scene.add(sprite);
            this.particles.push({
                sprite,
                active: false,
                life: 0,
                maxLife: 0,
                velocity: new THREE.Vector3(),
                gravity: 0,
                startScale: 1,
                endScale: 0.5,
                drag: 1,
                startColor: new THREE.Color(),
                endColor: new THREE.Color(),
                rotation: 0,
                rotationSpeed: 0,
                textureType: 'soft',
                blendMode: 'additive'
            });
        }

        this.poolIndex = 0;
    }

    createSoftCircleTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    createSparkTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        // Bright center with sharp falloff
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 24);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.1, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.6)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    createSmokeTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        // Softer, more diffuse
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
        gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.4)');
        gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.15)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    createStarTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        // Star shape with glow
        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.fillRect(0, 0, 64, 64);

        // Glow
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 28);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.5)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);

        // Draw 4-point star
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.moveTo(32, 4);
        ctx.lineTo(36, 28);
        ctx.lineTo(60, 32);
        ctx.lineTo(36, 36);
        ctx.lineTo(32, 60);
        ctx.lineTo(28, 36);
        ctx.lineTo(4, 32);
        ctx.lineTo(28, 28);
        ctx.closePath();
        ctx.fill();

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    // === NEW MAGIC/FANTASY TEXTURES ===

    createGlowTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        // Wide, soft glow - perfect for auras and magic
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.1, 'rgba(255, 255, 255, 0.9)');
        gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.6)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)');
        gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.1)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    createFlareTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.fillRect(0, 0, 64, 64);

        // Central glow
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 20);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.7)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(32, 32, 20, 0, Math.PI * 2);
        ctx.fill();

        // 6-point lens flare rays
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            ctx.save();
            ctx.translate(32, 32);
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.moveTo(0, -4);
            ctx.lineTo(28, 0);
            ctx.lineTo(0, 4);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    createEmberTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.fillRect(0, 0, 64, 64);

        // Irregular flame shape with noise-like edges
        const gradient = ctx.createRadialGradient(32, 28, 0, 32, 32, 24);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.9)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(32, 8);
        // Irregular flame outline
        ctx.bezierCurveTo(45, 16, 52, 28, 48, 42);
        ctx.bezierCurveTo(44, 52, 38, 56, 32, 56);
        ctx.bezierCurveTo(26, 56, 20, 52, 16, 42);
        ctx.bezierCurveTo(12, 28, 19, 16, 32, 8);
        ctx.fill();

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    createRingTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.fillRect(0, 0, 64, 64);

        // Hollow ring/donut shape
        const outerRadius = 28;
        const innerRadius = 18;

        // Outer glow
        const glowGradient = ctx.createRadialGradient(32, 32, innerRadius - 4, 32, 32, outerRadius + 4);
        glowGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
        glowGradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.5)');
        glowGradient.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
        glowGradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.5)');
        glowGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(32, 32, outerRadius + 4, 0, Math.PI * 2);
        ctx.arc(32, 32, innerRadius - 4, 0, Math.PI * 2, true);
        ctx.fill();

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    createStreakTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.fillRect(0, 0, 64, 64);

        // Elongated motion blur / streak
        const gradient = ctx.createLinearGradient(0, 32, 64, 32);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
        gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.6)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.8, 'rgba(255, 255, 255, 0.6)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        // Vertical falloff
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(32, 32, 30, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Bright center line
        const centerGradient = ctx.createLinearGradient(0, 32, 64, 32);
        centerGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
        centerGradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
        centerGradient.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
        centerGradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.8)');
        centerGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = centerGradient;
        ctx.beginPath();
        ctx.ellipse(32, 32, 28, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    createMagicTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.fillRect(0, 0, 64, 64);

        // Sparkle with cross pattern - magical/arcane feel
        // Background glow
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 24);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.6)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);

        // Cross/plus sparkle
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        // Vertical bar
        ctx.beginPath();
        ctx.moveTo(32, 4);
        ctx.lineTo(36, 26);
        ctx.lineTo(36, 38);
        ctx.lineTo(32, 60);
        ctx.lineTo(28, 38);
        ctx.lineTo(28, 26);
        ctx.closePath();
        ctx.fill();
        // Horizontal bar
        ctx.beginPath();
        ctx.moveTo(4, 32);
        ctx.lineTo(26, 28);
        ctx.lineTo(38, 28);
        ctx.lineTo(60, 32);
        ctx.lineTo(38, 36);
        ctx.lineTo(26, 36);
        ctx.closePath();
        ctx.fill();

        // Diagonal accents (smaller)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
            ctx.save();
            ctx.translate(32, 32);
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.moveTo(0, -2);
            ctx.lineTo(18, 0);
            ctx.lineTo(0, 2);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    getParticle() {
        for (let i = 0; i < this.maxParticles; i++) {
            const idx = (this.poolIndex + i) % this.maxParticles;
            if (!this.particles[idx].active) {
                this.poolIndex = (idx + 1) % this.maxParticles;
                return this.particles[idx];
            }
        }
        // Recycle oldest
        this.poolIndex = (this.poolIndex + 1) % this.maxParticles;
        return this.particles[this.poolIndex];
    }

    spawn(position, options = {}) {
        const count = options.count || 8;
        const spread = options.spread || 0.5;
        const speed = options.speed || 5;
        const life = options.life || 0.8;
        const size = options.size || 0.4;
        const endSize = options.endSize !== undefined ? options.endSize : size * 0.1;
        const gravity = options.gravity !== undefined ? options.gravity : -15;
        const color = options.color || 0xffffff;
        const endColor = options.endColor !== undefined ? options.endColor : color;
        const upwardBias = options.upwardBias || 3;
        const drag = options.drag || 0.98;
        const texture = options.texture || 'soft';
        const blendMode = options.blendMode || 'additive';
        const rotationSpeed = options.rotationSpeed || 0;

        for (let i = 0; i < count; i++) {
            const p = this.getParticle();
            p.active = true;
            p.life = life * (0.6 + Math.random() * 0.8);
            p.maxLife = p.life;
            p.gravity = gravity;
            p.drag = drag;
            p.startScale = size * (0.6 + Math.random() * 0.8);
            p.endScale = endSize;
            p.textureType = texture;
            p.rotation = Math.random() * Math.PI * 2;
            p.rotationSpeed = rotationSpeed * (Math.random() - 0.5) * 2;

            // Set texture and blend mode
            p.sprite.material.map = this.textures[texture] || this.textures.soft;
            p.sprite.material.blending = blendMode === 'normal' ? THREE.NormalBlending : THREE.AdditiveBlending;
            p.sprite.material.needsUpdate = true;

            p.sprite.position.set(
                position.x + (Math.random() - 0.5) * spread,
                position.y + (Math.random() - 0.5) * spread * 0.5,
                position.z + (Math.random() - 0.5) * spread
            );

            const angle = Math.random() * Math.PI * 2;
            const upAngle = Math.random() * Math.PI * 0.5;
            p.velocity.set(
                Math.cos(angle) * Math.cos(upAngle) * speed * (0.3 + Math.random() * 0.7),
                Math.sin(upAngle) * speed * (0.3 + Math.random() * 0.7) + upwardBias,
                Math.sin(angle) * Math.cos(upAngle) * speed * (0.3 + Math.random() * 0.7)
            );

            // Color with variation
            const c = new THREE.Color(color);
            c.r = Math.max(0, Math.min(1, c.r + (Math.random() - 0.5) * 0.2));
            c.g = Math.max(0, Math.min(1, c.g + (Math.random() - 0.5) * 0.2));
            c.b = Math.max(0, Math.min(1, c.b + (Math.random() - 0.5) * 0.2));
            p.startColor.copy(c);
            p.endColor.set(endColor);
            p.sprite.material.color.copy(c);

            p.sprite.scale.setScalar(p.startScale);
            p.sprite.visible = true;
            p.sprite.material.opacity = 1;
        }
    }

    update(deltaTime) {
        for (const p of this.particles) {
            if (!p.active) continue;

            p.life -= deltaTime;
            if (p.life <= 0) {
                p.active = false;
                p.sprite.visible = false;
                continue;
            }

            // Physics
            p.velocity.y += p.gravity * deltaTime;
            p.velocity.multiplyScalar(Math.pow(p.drag, deltaTime * 60));
            p.sprite.position.addScaledVector(p.velocity, deltaTime);

            // Rotation
            p.sprite.material.rotation += p.rotationSpeed * deltaTime;

            // Interpolation factor
            const t = p.life / p.maxLife;

            // Scale interpolation
            const scale = p.startScale * t + p.endScale * (1 - t);
            p.sprite.scale.setScalar(scale);

            // Color interpolation
            p.sprite.material.color.lerpColors(p.endColor, p.startColor, t);

            // Opacity - fade out near end
            p.sprite.material.opacity = Math.min(1, t * 2.5) * Math.min(1, p.life * 4);
        }
    }

    // === Effect Presets ===

    slimeHit(position, intensity = 1) {
        // Layer 1: Core flash (bright white-green glow)
        this.spawn(position, {
            count: Math.floor(3 * intensity),
            spread: 0.1,
            speed: 0.5,
            life: 0.2,
            size: 0.8 * intensity,
            endSize: 0.1,
            gravity: 0,
            upwardBias: 0,
            color: 0xaaffaa,
            endColor: 0x66ff66,
            texture: 'glow'
        });
        // Layer 2: Main slime splatter
        this.spawn(position, {
            count: Math.floor(18 * intensity),
            spread: 0.4,
            speed: 8,
            life: 0.9,
            size: 0.55,
            endSize: 0.05,
            gravity: -14,
            upwardBias: 6,
            color: 0x66ff66,
            endColor: 0x22aa22,
            texture: 'soft'
        });
        // Layer 3: Bright sparks
        this.spawn(position, {
            count: Math.floor(10 * intensity),
            spread: 0.2,
            speed: 12,
            life: 0.4,
            size: 0.25,
            gravity: -10,
            upwardBias: 4,
            color: 0xccffcc,
            texture: 'spark'
        });
        // Layer 4: Lingering magic sparkles
        this.spawn(position, {
            count: Math.floor(6 * intensity),
            spread: 0.5,
            speed: 3,
            life: 0.7,
            size: 0.2,
            gravity: -5,
            upwardBias: 2,
            color: 0x88ff88,
            texture: 'star',
            rotationSpeed: 3
        });
    }

    purpleSlimeHit(position, intensity = 1) {
        // Layer 1: Void flash (dark purple core)
        this.spawn(position, {
            count: Math.floor(3 * intensity),
            spread: 0.1,
            speed: 0.5,
            life: 0.25,
            size: 0.9 * intensity,
            endSize: 0.1,
            gravity: 0,
            upwardBias: 0,
            color: 0xdd88ff,
            endColor: 0x8844cc,
            texture: 'glow'
        });
        // Layer 2: Main splatter (dark tendrils)
        this.spawn(position, {
            count: Math.floor(20 * intensity),
            spread: 0.5,
            speed: 9,
            life: 1.0,
            size: 0.6,
            endSize: 0.05,
            gravity: -12,
            upwardBias: 7,
            color: 0xcc66ff,
            endColor: 0x6622aa,
            texture: 'soft'
        });
        // Layer 3: Arcane symbols (magic sparkles)
        this.spawn(position, {
            count: Math.floor(12 * intensity),
            spread: 0.3,
            speed: 14,
            life: 0.5,
            size: 0.3,
            gravity: -6,
            upwardBias: 4,
            color: 0xffaaff,
            texture: 'magic',
            rotationSpeed: 6
        });
        // Layer 4: Ring burst (expanding void)
        this.spawn(position, {
            count: Math.floor(4 * intensity),
            spread: 0.2,
            speed: 6,
            life: 0.4,
            size: 0.5,
            endSize: 1.2,
            gravity: 0,
            upwardBias: 0,
            drag: 0.85,
            color: 0x9944dd,
            endColor: 0x441188,
            texture: 'ring'
        });
    }

    fireExplosion(position, radius = 3) {
        // Layer 1: Core flash (white-yellow glow, immediate)
        this.spawn(position, {
            count: 1,
            spread: 0,
            speed: 0,
            life: 0.3,
            size: radius * 1.2,
            endSize: radius * 0.3,
            gravity: 0,
            upwardBias: 0,
            color: 0xffffee,
            endColor: 0xffaa44,
            texture: 'glow'
        });
        // Layer 2: Expanding fireball (ember texture)
        this.spawn(position, {
            count: 28,
            spread: radius * 0.3,
            speed: 10,
            life: 0.8,
            size: 0.7,
            endSize: 0.1,
            gravity: 4,
            upwardBias: 8,
            color: 0xff6600,
            endColor: 0xff2200,
            texture: 'ember'
        });
        // Layer 3: Flying embers (high velocity sparks)
        this.spawn(position, {
            count: 24,
            spread: radius * 0.2,
            speed: 16,
            life: 0.7,
            size: 0.25,
            gravity: -12,
            upwardBias: 10,
            color: 0xffffaa,
            texture: 'spark'
        });
        // Layer 4: Rising smoke (normal blend)
        this.spawn(position, {
            count: 12,
            spread: radius * 0.4,
            speed: 3,
            life: 1.4,
            size: 1.1,
            endSize: 0.4,
            gravity: 3,
            upwardBias: 5,
            drag: 0.94,
            color: 0x555555,
            endColor: 0x111111,
            texture: 'smoke',
            blendMode: 'normal'
        });
        // Layer 5: Lingering embers (slow fade)
        this.spawn(position, {
            count: 15,
            spread: radius * 0.5,
            speed: 5,
            life: 1.2,
            size: 0.35,
            endSize: 0.05,
            gravity: 2,
            upwardBias: 6,
            drag: 0.96,
            color: 0xff4400,
            endColor: 0x882200,
            texture: 'ember'
        });
        // Layer 6: Ground ring burst
        this.spawn({x: position.x, y: position.y + 0.1, z: position.z}, {
            count: 6,
            spread: radius * 0.2,
            speed: 12,
            life: 0.4,
            size: 0.4,
            endSize: 1.5,
            gravity: 0,
            upwardBias: 0,
            drag: 0.8,
            color: 0xff8844,
            endColor: 0x442200,
            texture: 'ring'
        });
    }

    shockwave(position, color = 0x8855ff) {
        // Layer 1: Central glow flash
        this.spawn(position, {
            count: 1,
            spread: 0,
            speed: 0,
            life: 0.25,
            size: 1.2,
            endSize: 0.2,
            gravity: 0,
            upwardBias: 0,
            color: 0xffffff,
            endColor: color,
            texture: 'glow'
        });
        // Layer 2: Primary ring expanding outward
        this.spawn({x: position.x, y: position.y + 0.2, z: position.z}, {
            count: 3,
            spread: 0.1,
            speed: 14,
            life: 0.5,
            size: 0.6,
            endSize: 3.0,
            gravity: 0,
            upwardBias: 0,
            drag: 0.88,
            color: color,
            endColor: 0xffffff,
            texture: 'ring'
        });
        // Layer 3: Secondary wave (slightly delayed)
        setTimeout(() => {
            this.spawn({x: position.x, y: position.y + 0.15, z: position.z}, {
                count: 2,
                spread: 0.1,
                speed: 10,
                life: 0.4,
                size: 0.4,
                endSize: 2.2,
                gravity: 0,
                upwardBias: 0,
                drag: 0.9,
                color: new THREE.Color(color).multiplyScalar(1.3).getHex(),
                texture: 'ring'
            });
        }, 50);
        // Layer 4: Trailing particles in ring pattern
        for (let i = 0; i < 24; i++) {
            const angle = (i / 24) * Math.PI * 2;
            const offset = {
                x: position.x + Math.cos(angle) * 0.4,
                y: position.y + 0.3,
                z: position.z + Math.sin(angle) * 0.4
            };
            this.spawn(offset, {
                count: 2,
                spread: 0.15,
                speed: 13,
                life: 0.55,
                size: 0.35,
                endSize: 0.08,
                gravity: 0,
                upwardBias: 0,
                drag: 0.92,
                color: color,
                endColor: 0xffffff,
                texture: 'soft'
            });
        }
        // Layer 5: Upward sparkles
        this.spawn(position, {
            count: 10,
            spread: 0.4,
            speed: 4,
            life: 0.45,
            size: 0.25,
            gravity: 2,
            upwardBias: 3,
            color: 0xffffff,
            texture: 'spark'
        });
    }

    bounceImpact(position) {
        // Layer 1: Impact flash
        this.spawn(position, {
            count: 1,
            spread: 0,
            speed: 0,
            life: 0.2,
            size: 1.0,
            endSize: 0.2,
            gravity: 0,
            upwardBias: 0,
            color: 0xffffee,
            endColor: 0xccbb99,
            texture: 'glow'
        });
        // Layer 2: Dust cloud
        this.spawn(position, {
            count: 28,
            spread: 1.3,
            speed: 7,
            life: 1.1,
            size: 0.75,
            endSize: 0.2,
            gravity: -4,
            upwardBias: 3,
            drag: 0.91,
            color: 0xaa9977,
            endColor: 0x554433,
            texture: 'smoke',
            blendMode: 'normal'
        });
        // Layer 3: Impact sparks
        this.spawn(position, {
            count: 18,
            spread: 0.5,
            speed: 15,
            life: 0.45,
            size: 0.3,
            gravity: -16,
            upwardBias: 7,
            color: 0xffffcc,
            texture: 'spark'
        });
        // Layer 4: Expanding ground ring
        this.spawn({x: position.x, y: position.y + 0.1, z: position.z}, {
            count: 4,
            spread: 0.1,
            speed: 10,
            life: 0.4,
            size: 0.4,
            endSize: 2.0,
            gravity: 0,
            upwardBias: 0,
            drag: 0.85,
            color: 0xddccaa,
            endColor: 0x887766,
            texture: 'ring'
        });
        // Layer 5: Small debris particles
        this.spawn(position, {
            count: 12,
            spread: 0.8,
            speed: 10,
            life: 0.6,
            size: 0.2,
            gravity: -18,
            upwardBias: 4,
            drag: 0.95,
            color: 0xbbaa88,
            texture: 'soft'
        });
    }

    playerHit(position) {
        const hitPos = {x: position.x, y: position.y + 1, z: position.z};

        // Layer 1: Impact flash (bright center)
        this.spawn(hitPos, {
            count: 1,
            spread: 0,
            speed: 0,
            life: 0.15,
            size: 0.9,
            endSize: 0.1,
            gravity: 0,
            upwardBias: 0,
            color: 0xffffff,
            endColor: 0xff6666,
            texture: 'glow'
        });
        // Layer 2: Blood/damage particles
        this.spawn(hitPos, {
            count: 15,
            spread: 0.35,
            speed: 6,
            life: 0.7,
            size: 0.4,
            endSize: 0.05,
            gravity: -16,
            upwardBias: 4,
            color: 0xff4444,
            endColor: 0x880000,
            texture: 'soft'
        });
        // Layer 3: Bright sparks
        this.spawn(hitPos, {
            count: 8,
            spread: 0.25,
            speed: 10,
            life: 0.3,
            size: 0.2,
            gravity: -10,
            upwardBias: 3,
            color: 0xffaaaa,
            texture: 'spark'
        });
        // Layer 4: Motion streaks (directional)
        this.spawn(hitPos, {
            count: 4,
            spread: 0.4,
            speed: 12,
            life: 0.25,
            size: 0.3,
            endSize: 0.05,
            gravity: -8,
            upwardBias: 2,
            drag: 0.85,
            color: 0xff6666,
            texture: 'streak'
        });
    }

    healEffect(position) {
        // Rising green particles
        this.spawn({x: position.x, y: position.y + 0.3, z: position.z}, {
            count: 20,
            spread: 0.6,
            speed: 2,
            life: 1.5,
            size: 0.4,
            endSize: 0.1,
            gravity: 3,
            upwardBias: 4,
            drag: 0.97,
            color: 0x44ff88,
            endColor: 0x88ffaa,
            texture: 'soft'
        });
        // Sparkles
        this.spawn({x: position.x, y: position.y + 0.5, z: position.z}, {
            count: 10,
            spread: 0.8,
            speed: 1,
            life: 1.2,
            size: 0.25,
            gravity: 2,
            upwardBias: 3,
            color: 0xaaffcc,
            texture: 'star',
            rotationSpeed: 3
        });
    }

    slimeDrip(position) {
        // Purple slime drip falling down
        this.spawn(position, {
            count: 2,
            spread: 0.1,
            speed: 0.5,
            life: 1.2,
            size: 0.3,
            endSize: 0.15,
            gravity: -8,
            upwardBias: -1,
            drag: 0.98,
            color: 0x9955cc,
            endColor: 0x662288,
            texture: 'soft'
        });
    }

    swingTrail(startPos, endPos, color = 0xffffaa) {
        const dir = new THREE.Vector3().subVectors(endPos, startPos);
        const dist = dir.length();
        dir.normalize();

        const steps = Math.max(5, Math.floor(dist * 3));
        for (let i = 0; i < steps; i++) {
            const t = i / steps;
            const pos = new THREE.Vector3().lerpVectors(startPos, endPos, t);
            this.spawn(pos, {
                count: 1,
                spread: 0.05,
                speed: 0.5,
                life: 0.3,
                size: 0.25 * (1 - t * 0.6),
                endSize: 0.02,
                gravity: -2,
                upwardBias: 0,
                color: color,
                texture: 'soft'
            });
        }
    }

    cleaveWave(position, direction, range = 5) {
        const dir = direction.clone().normalize();
        for (let d = 1; d < range; d += 0.8) {
            const pos = position.clone().addScaledVector(dir, d);
            pos.y = 0.5;
            setTimeout(() => {
                // Main wave
                this.spawn(pos, {
                    count: 8,
                    spread: d * 0.25,
                    speed: 4,
                    life: 0.5,
                    size: 0.45,
                    endSize: 0.05,
                    gravity: 0,
                    upwardBias: 3,
                    color: 0xff9944,
                    endColor: 0xff4400,
                    texture: 'soft'
                });
                // Sparks
                this.spawn(pos, {
                    count: 3,
                    spread: d * 0.2,
                    speed: 8,
                    life: 0.3,
                    size: 0.2,
                    gravity: -5,
                    upwardBias: 4,
                    color: 0xffffaa,
                    texture: 'spark'
                });
            }, d * 20);
        }
    }

    bladestormSpin(position) {
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2 + Math.random() * 0.3;
            const radius = 1.8 + Math.random() * 0.5;
            const pos = {
                x: position.x + Math.cos(angle) * radius,
                y: position.y + 0.8 + Math.random() * 0.5,
                z: position.z + Math.sin(angle) * radius
            };
            this.spawn(pos, {
                count: 1,
                spread: 0.05,
                speed: 3,
                life: 0.35,
                size: 0.3,
                endSize: 0.05,
                gravity: 0,
                upwardBias: 0,
                drag: 0.85,
                color: 0x99aaff,
                endColor: 0x4466ff,
                texture: 'soft'
            });
        }
        // Central glow
        this.spawn(position, {
            count: 2,
            spread: 0.3,
            speed: 0.5,
            life: 0.2,
            size: 0.6,
            gravity: 0,
            upwardBias: 0,
            color: 0xaabbff,
            texture: 'soft'
        });
    }

    chargeTrail(position, direction) {
        this.spawn(position, {
            count: 5,
            spread: 0.25,
            speed: 1.5,
            life: 0.45,
            size: 0.4,
            endSize: 0.05,
            gravity: 0,
            upwardBias: 0.5,
            drag: 0.8,
            color: 0x66aaff,
            endColor: 0x2266ff,
            texture: 'soft'
        });
        // Sparks
        this.spawn(position, {
            count: 2,
            spread: 0.3,
            speed: 4,
            life: 0.25,
            size: 0.15,
            gravity: -3,
            upwardBias: 1,
            color: 0xaaddff,
            texture: 'spark'
        });
    }

    deathExplosion(position, color = 0x44dd44, intensity = 1) {
        const baseColor = new THREE.Color(color);
        const darkColor = baseColor.clone().multiplyScalar(0.3).getHex();
        const brightColor = baseColor.clone().multiplyScalar(1.5).getHex();

        // Layer 1: Core flash (bright glow)
        this.spawn(position, {
            count: 1,
            spread: 0,
            speed: 0,
            life: 0.3,
            size: 1.5 * intensity,
            endSize: 0.2,
            gravity: 0,
            upwardBias: 0,
            color: 0xffffff,
            endColor: color,
            texture: 'glow'
        });
        // Layer 2: Main burst (soft particles)
        this.spawn(position, {
            count: Math.floor(40 * intensity),
            spread: 0.6,
            speed: 13,
            life: 1.2,
            size: 0.55,
            endSize: 0.05,
            gravity: -11,
            upwardBias: 8,
            color: color,
            endColor: darkColor,
            texture: 'soft'
        });
        // Layer 3: Bright flash sparks
        this.spawn(position, {
            count: Math.floor(18 * intensity),
            spread: 0.3,
            speed: 18,
            life: 0.4,
            size: 0.35,
            gravity: -14,
            upwardBias: 6,
            color: 0xffffff,
            texture: 'spark'
        });
        // Layer 4: Rotating stars
        this.spawn(position, {
            count: Math.floor(10 * intensity),
            spread: 0.4,
            speed: 9,
            life: 0.9,
            size: 0.45,
            gravity: -6,
            upwardBias: 5,
            color: brightColor,
            texture: 'star',
            rotationSpeed: 5
        });
        // Layer 5: Expanding ring
        this.spawn({x: position.x, y: position.y + 0.5, z: position.z}, {
            count: Math.floor(3 * intensity),
            spread: 0.1,
            speed: 8,
            life: 0.45,
            size: 0.5,
            endSize: 2.0 * intensity,
            gravity: 0,
            upwardBias: 0,
            drag: 0.9,
            color: color,
            endColor: darkColor,
            texture: 'ring'
        });
    }

    ambientParticles(position, radius = 20) {
        if (Math.random() > 0.08) return;
        const pos = {
            x: position.x + (Math.random() - 0.5) * radius * 2,
            y: Math.random() * 3,
            z: position.z + (Math.random() - 0.5) * radius * 2
        };
        this.spawn(pos, {
            count: 1,
            spread: 0,
            speed: 0.2,
            life: 3,
            size: 0.12,
            endSize: 0.02,
            gravity: 0.2,
            upwardBias: 0,
            drag: 0.995,
            color: 0xffffee,
            texture: 'soft'
        });
    }

    firePoolEffect(position) {
        // Layer 1: Base glow
        this.spawn(position, {
            count: 1,
            spread: 1.5,
            speed: 0.5,
            life: 0.4,
            size: 0.8,
            endSize: 0.3,
            gravity: 1,
            upwardBias: 1,
            color: 0xff4400,
            endColor: 0xff2200,
            texture: 'glow'
        });
        // Layer 2: Flames rising (ember texture)
        this.spawn(position, {
            count: 5,
            spread: 1.8,
            speed: 2.5,
            life: 0.75,
            size: 0.45,
            endSize: 0.1,
            gravity: 3,
            upwardBias: 4,
            color: 0xff5500,
            endColor: 0xff2200,
            texture: 'ember'
        });
        // Layer 3: Rising embers/sparks
        if (Math.random() > 0.4) {
            this.spawn(position, {
                count: 3,
                spread: 1.6,
                speed: 5,
                life: 0.9,
                size: 0.18,
                gravity: 2,
                upwardBias: 5,
                color: 0xffaa44,
                texture: 'spark'
            });
        }
    }

    poisonPoolEffect(position) {
        // Bubbles rising
        this.spawn(position, {
            count: 3,
            spread: 1.3,
            speed: 1.2,
            life: 0.9,
            size: 0.3,
            endSize: 0.05,
            gravity: 2,
            upwardBias: 2,
            color: 0x66ff44,
            endColor: 0x33aa22,
            texture: 'soft'
        });
    }

    // New effects for enhanced visuals

    magicMissile(position, direction) {
        this.spawn(position, {
            count: 3,
            spread: 0.1,
            speed: 1,
            life: 0.3,
            size: 0.35,
            endSize: 0.05,
            gravity: 0,
            upwardBias: 0,
            drag: 0.9,
            color: 0x66aaff,
            texture: 'soft'
        });
        this.spawn(position, {
            count: 1,
            spread: 0.05,
            speed: 0.5,
            life: 0.15,
            size: 0.2,
            gravity: 0,
            upwardBias: 0,
            color: 0xffffff,
            texture: 'spark'
        });
    }

    levelUp(position) {
        // Golden spiral
        for (let i = 0; i < 30; i++) {
            const angle = (i / 30) * Math.PI * 4;
            const height = (i / 30) * 3;
            const radius = 1 - (i / 30) * 0.5;
            setTimeout(() => {
                const pos = {
                    x: position.x + Math.cos(angle) * radius,
                    y: position.y + height,
                    z: position.z + Math.sin(angle) * radius
                };
                this.spawn(pos, {
                    count: 2,
                    spread: 0.1,
                    speed: 1,
                    life: 0.8,
                    size: 0.3,
                    gravity: 1,
                    upwardBias: 0,
                    color: 0xffdd44,
                    texture: 'star',
                    rotationSpeed: 3
                });
            }, i * 15);
        }
    }

    criticalHit(position) {
        // Layer 1: Bright flash (lens flare)
        this.spawn(position, {
            count: 1,
            spread: 0,
            speed: 0,
            life: 0.25,
            size: 1.4,
            endSize: 0.3,
            gravity: 0,
            upwardBias: 0,
            color: 0xffffff,
            endColor: 0xffcc00,
            texture: 'flare'
        });
        // Layer 2: Main impact burst
        this.spawn(position, {
            count: 30,
            spread: 0.55,
            speed: 15,
            life: 0.75,
            size: 0.55,
            endSize: 0.05,
            gravity: -13,
            upwardBias: 7,
            color: 0xffaa00,
            endColor: 0xff4400,
            texture: 'ember'
        });
        // Layer 3: Bright sparks
        this.spawn(position, {
            count: 15,
            spread: 0.3,
            speed: 18,
            life: 0.4,
            size: 0.25,
            gravity: -10,
            upwardBias: 5,
            color: 0xffffaa,
            texture: 'spark'
        });
        // Layer 4: Spinning stars
        this.spawn(position, {
            count: 10,
            spread: 0.35,
            speed: 11,
            life: 0.55,
            size: 0.45,
            gravity: -9,
            upwardBias: 6,
            color: 0xffff88,
            texture: 'star',
            rotationSpeed: 8
        });
        // Layer 5: Impact ring
        this.spawn(position, {
            count: 3,
            spread: 0.1,
            speed: 10,
            life: 0.35,
            size: 0.4,
            endSize: 1.8,
            gravity: 0,
            upwardBias: 0,
            drag: 0.88,
            color: 0xffdd44,
            endColor: 0xff8800,
            texture: 'ring'
        });
    }

    // === Mage Ability Effects ===

    magicCast(position) {
        // Blue magic sparkles at cast point
        this.spawn(position, {
            count: 12,
            spread: 0.3,
            speed: 3,
            life: 0.4,
            size: 0.3,
            endSize: 0.05,
            gravity: 1,
            upwardBias: 2,
            color: 0x44aaff,
            endColor: 0x2266ff,
            texture: 'spark'
        });
        this.spawn(position, {
            count: 5,
            spread: 0.2,
            speed: 1,
            life: 0.3,
            size: 0.5,
            gravity: 0,
            color: 0x88ccff,
            texture: 'soft'
        });
    }

    magicImpact(position) {
        // Blue burst on hit
        this.spawn(position, {
            count: 15,
            spread: 0.2,
            speed: 6,
            life: 0.4,
            size: 0.35,
            endSize: 0.05,
            gravity: -5,
            upwardBias: 3,
            color: 0x66bbff,
            endColor: 0x2244ff,
            texture: 'soft'
        });
        // Sparks
        this.spawn(position, {
            count: 8,
            spread: 0.15,
            speed: 8,
            life: 0.3,
            size: 0.2,
            gravity: -8,
            upwardBias: 2,
            color: 0xaaddff,
            texture: 'spark'
        });
    }

    blizzardBurst(position) {
        // Initial ice burst
        this.spawn({x: position.x, y: position.y + 0.5, z: position.z}, {
            count: 30,
            spread: 3,
            speed: 4,
            life: 1.0,
            size: 0.4,
            endSize: 0.1,
            gravity: -2,
            upwardBias: 3,
            drag: 0.95,
            color: 0x88ddff,
            endColor: 0xaaeeff,
            texture: 'soft'
        });
        // Ice crystals
        this.spawn({x: position.x, y: position.y + 1, z: position.z}, {
            count: 15,
            spread: 2,
            speed: 2,
            life: 1.5,
            size: 0.25,
            gravity: -4,
            upwardBias: 0,
            color: 0xccffff,
            texture: 'star',
            rotationSpeed: 2
        });
    }

    blizzardTick(position) {
        // Ongoing ice particles
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 4;
        const pos = {
            x: position.x + Math.cos(angle) * dist,
            y: position.y + 0.3,
            z: position.z + Math.sin(angle) * dist
        };
        this.spawn(pos, {
            count: 3,
            spread: 0.3,
            speed: 1.5,
            life: 0.8,
            size: 0.25,
            endSize: 0.05,
            gravity: -3,
            upwardBias: 2,
            color: 0x88ccff,
            endColor: 0xaaddff,
            texture: 'soft'
        });
    }

    flameWave(position, direction, range = 8) {
        const dir = direction.clone().normalize();
        // Expanding wave of fire
        for (let d = 1; d < range; d += 0.6) {
            const pos = position.clone().addScaledVector(dir, d);
            pos.y = 0.5;
            setTimeout(() => {
                // Fire particles
                this.spawn(pos, {
                    count: 10,
                    spread: d * 0.3,
                    speed: 5,
                    life: 0.6,
                    size: 0.5,
                    endSize: 0.1,
                    gravity: 2,
                    upwardBias: 4,
                    color: 0xff6600,
                    endColor: 0xff2200,
                    texture: 'soft'
                });
                // Embers
                this.spawn(pos, {
                    count: 4,
                    spread: d * 0.2,
                    speed: 8,
                    life: 0.8,
                    size: 0.15,
                    gravity: -6,
                    upwardBias: 5,
                    color: 0xffaa44,
                    texture: 'spark'
                });
            }, d * 30);
        }
    }

    burnAuraFlame(position) {
        // Small fire puff
        this.spawn(position, {
            count: 2,
            spread: 0.1,
            speed: 2,
            life: 0.5,
            size: 0.3,
            endSize: 0.05,
            gravity: 3,
            upwardBias: 3,
            color: 0xff5500,
            endColor: 0xff2200,
            texture: 'soft'
        });
    }

    backstepTrail(startPos, endPos) {
        const dir = new THREE.Vector3().subVectors(endPos, startPos);
        const dist = dir.length();
        dir.normalize();

        // Trail of magic dust
        const steps = Math.floor(dist * 2);
        for (let i = 0; i < steps; i++) {
            const t = i / steps;
            const pos = new THREE.Vector3().lerpVectors(startPos, endPos, t);
            pos.y = 0.5;
            this.spawn(pos, {
                count: 3,
                spread: 0.2,
                speed: 2,
                life: 0.4,
                size: 0.3,
                endSize: 0.05,
                gravity: 0,
                upwardBias: 1,
                color: 0x8866ff,
                endColor: 0x4422aa,
                texture: 'soft'
            });
        }
        // Burst at end
        this.spawn(endPos, {
            count: 10,
            spread: 0.3,
            speed: 4,
            life: 0.3,
            size: 0.25,
            gravity: -2,
            upwardBias: 2,
            color: 0xaa88ff,
            texture: 'spark'
        });
    }

    // === Warrior Ability Effects ===

    whirlwindSpin(position, radius = 3.5) {
        // Create a ring of spinning particles
        for (let i = 0; i < 24; i++) {
            const angle = (i / 24) * Math.PI * 2 + Math.random() * 0.2;
            const r = radius * (0.6 + Math.random() * 0.4);
            const pos = {
                x: position.x + Math.cos(angle) * r,
                y: position.y + 0.5 + Math.random() * 1.0,
                z: position.z + Math.sin(angle) * r
            };
            this.spawn(pos, {
                count: 2,
                spread: 0.1,
                speed: 5,
                life: 0.4,
                size: 0.4,
                endSize: 0.05,
                gravity: 0,
                upwardBias: 1,
                drag: 0.85,
                color: 0xffaa44,
                endColor: 0xff6600,
                texture: 'soft'
            });
        }
        // Central burst
        this.spawn({x: position.x, y: position.y + 1, z: position.z}, {
            count: 15,
            spread: 0.5,
            speed: 8,
            life: 0.3,
            size: 0.3,
            gravity: 0,
            upwardBias: 2,
            color: 0xffffaa,
            texture: 'spark'
        });
    }

    dashTrail(position, direction) {
        // Trail particles behind during whirlwind dash
        const perpX = -direction.z;
        const perpZ = direction.x;
        for (let i = 0; i < 3; i++) {
            const offset = (i - 1) * 0.4;
            const pos = {
                x: position.x + perpX * offset,
                y: position.y + 0.5 + Math.random() * 0.5,
                z: position.z + perpZ * offset
            };
            this.spawn(pos, {
                count: 2,
                spread: 0.15,
                speed: 2,
                life: 0.35,
                size: 0.35,
                endSize: 0.05,
                gravity: 0,
                upwardBias: 0.5,
                drag: 0.9,
                color: 0xffcc66,
                endColor: 0xff8800,
                texture: 'soft'
            });
        }
    }

    leapTrail(position) {
        // Particles trailing during heroic leap
        this.spawn(position, {
            count: 4,
            spread: 0.3,
            speed: 2,
            life: 0.5,
            size: 0.4,
            endSize: 0.1,
            gravity: -8,
            upwardBias: 0,
            drag: 0.95,
            color: 0x66aaff,
            endColor: 0x2266ff,
            texture: 'soft'
        });
        // Sparks
        this.spawn(position, {
            count: 2,
            spread: 0.2,
            speed: 4,
            life: 0.3,
            size: 0.2,
            gravity: -10,
            upwardBias: -2,
            color: 0xaaddff,
            texture: 'spark'
        });
    }

    groundSlam(position, radius = 4) {
        // Expanding shockwave ring
        for (let ring = 0; ring < 3; ring++) {
            setTimeout(() => {
                const r = radius * (ring + 1) / 3;
                for (let i = 0; i < 20; i++) {
                    const angle = (i / 20) * Math.PI * 2;
                    const pos = {
                        x: position.x + Math.cos(angle) * r,
                        y: position.y + 0.2,
                        z: position.z + Math.sin(angle) * r
                    };
                    this.spawn(pos, {
                        count: 2,
                        spread: 0.2,
                        speed: 6,
                        life: 0.5,
                        size: 0.5,
                        endSize: 0.1,
                        gravity: -3,
                        upwardBias: 4,
                        drag: 0.9,
                        color: 0xffaa44,
                        endColor: 0xff6622,
                        texture: 'soft'
                    });
                }
            }, ring * 50);
        }

        // Central impact
        this.spawn(position, {
            count: 30,
            spread: 0.8,
            speed: 12,
            life: 0.6,
            size: 0.5,
            endSize: 0.05,
            gravity: -8,
            upwardBias: 8,
            color: 0xffdd66,
            endColor: 0xff8800,
            texture: 'soft'
        });

        // Dust cloud
        this.spawn(position, {
            count: 15,
            spread: 1.5,
            speed: 4,
            life: 1.0,
            size: 0.8,
            endSize: 0.3,
            gravity: -1,
            upwardBias: 2,
            drag: 0.92,
            color: 0xaa9977,
            endColor: 0x665544,
            texture: 'smoke',
            blendMode: 'normal'
        });

        // Sparks flying outward
        this.spawn(position, {
            count: 20,
            spread: 0.5,
            speed: 15,
            life: 0.5,
            size: 0.25,
            gravity: -12,
            upwardBias: 6,
            color: 0xffffaa,
            texture: 'spark'
        });
    }

    parryFlash(position) {
        // Bright defensive flash
        this.spawn({x: position.x, y: position.y + 1, z: position.z}, {
            count: 15,
            spread: 0.4,
            speed: 6,
            life: 0.3,
            size: 0.5,
            endSize: 0.1,
            gravity: 0,
            upwardBias: 0,
            color: 0xaaddff,
            endColor: 0x4488ff,
            texture: 'soft'
        });
        // Shield sparkles
        this.spawn({x: position.x, y: position.y + 1, z: position.z}, {
            count: 8,
            spread: 0.3,
            speed: 8,
            life: 0.4,
            size: 0.3,
            gravity: -5,
            upwardBias: 2,
            color: 0xffffff,
            texture: 'star',
            rotationSpeed: 5
        });
    }

    riposteSlash(fromPos, toPos) {
        // Quick slash trail toward enemy
        const dir = new THREE.Vector3().subVectors(toPos, fromPos);
        const dist = dir.length();
        dir.normalize();

        const steps = Math.max(3, Math.floor(dist * 2));
        for (let i = 0; i < steps; i++) {
            const t = i / steps;
            const pos = new THREE.Vector3().lerpVectors(fromPos, toPos, t);
            pos.y += 1;
            setTimeout(() => {
                this.spawn(pos, {
                    count: 3,
                    spread: 0.1,
                    speed: 3,
                    life: 0.25,
                    size: 0.4 * (1 - t * 0.5),
                    endSize: 0.05,
                    gravity: 0,
                    upwardBias: 0,
                    color: 0xffdd44,
                    endColor: 0xff8800,
                    texture: 'soft'
                });
            }, t * 80);
        }
        // Impact sparks at target
        setTimeout(() => {
            this.spawn({x: toPos.x, y: toPos.y + 1, z: toPos.z}, {
                count: 12,
                spread: 0.2,
                speed: 10,
                life: 0.3,
                size: 0.25,
                gravity: -8,
                upwardBias: 3,
                color: 0xffffaa,
                texture: 'spark'
            });
        }, 100);
    }

    // Sunder ground spike wave particles
    sunderWave(position, direction, range = 12) {
        const dir = new THREE.Vector3(direction.x, 0, direction.z).normalize();

        // Particles along the wave path
        for (let d = 1; d < range; d += 1.5) {
            const pos = {
                x: position.x + dir.x * d,
                y: 0.3,
                z: position.z + dir.z * d
            };

            setTimeout(() => {
                // Earth/rock debris
                this.spawn(pos, {
                    count: 8,
                    spread: 0.8,
                    speed: 6,
                    life: 0.6,
                    size: 0.35,
                    endSize: 0.1,
                    gravity: -15,
                    upwardBias: 8,
                    color: 0x886644,
                    endColor: 0x554433,
                    texture: 'soft'
                });

                // Dust cloud
                this.spawn(pos, {
                    count: 5,
                    spread: 0.5,
                    speed: 2,
                    life: 0.8,
                    size: 0.5,
                    endSize: 0.2,
                    gravity: 1,
                    upwardBias: 2,
                    drag: 0.92,
                    color: 0xaa9977,
                    endColor: 0x665544,
                    texture: 'smoke',
                    blendMode: 'normal'
                });

                // Sparks from impact
                this.spawn(pos, {
                    count: 4,
                    spread: 0.3,
                    speed: 10,
                    life: 0.4,
                    size: 0.2,
                    gravity: -12,
                    upwardBias: 5,
                    color: 0xffddaa,
                    texture: 'spark'
                });
            }, d * 40); // Delayed to follow the wave
        }
    }

    // === FROST/ICE EFFECTS ===

    frostNova(position, radius = 5) {
        // Layer 1: Central ice flash
        this.spawn({ x: position.x, y: position.y + 1, z: position.z }, {
            count: 1,
            spread: 0,
            speed: 0,
            life: 0.4,
            size: 1.5,
            endSize: 0.2,
            gravity: 0,
            color: 0xffffff,
            endColor: 0x66ddff,
            texture: 'flare'
        });

        // Layer 2: Ice shards radiating outward in ring
        for (let i = 0; i < 16; i++) {
            const angle = (i / 16) * Math.PI * 2;
            this.spawn({ x: position.x, y: position.y + 0.5, z: position.z }, {
                count: 2,
                spread: 0.1,
                speed: 8,
                velocityX: Math.cos(angle) * 8,
                velocityY: 0.5,
                velocityZ: Math.sin(angle) * 8,
                life: 0.5,
                size: 0.4,
                endSize: 0.1,
                gravity: -2,
                color: 0x88eeff,
                endColor: 0x4488cc,
                texture: 'streak',
                rotationSpeed: 3
            });
        }

        // Layer 3: Expanding frost ring on ground
        this.spawn({ x: position.x, y: position.y + 0.1, z: position.z }, {
            count: 1,
            spread: 0,
            speed: 0,
            life: 0.6,
            size: 0.5,
            endSize: radius * 1.5,
            gravity: 0,
            color: 0x88ddff,
            endColor: 0x4488aa,
            texture: 'ring'
        });

        // Layer 4: Swirling ice crystals
        this.spawn({ x: position.x, y: position.y + 0.8, z: position.z }, {
            count: 20,
            spread: radius * 0.5,
            speed: 3,
            life: 0.8,
            size: 0.3,
            endSize: 0.05,
            gravity: -2,
            upwardBias: 2,
            color: 0xccffff,
            endColor: 0x88ccee,
            texture: 'star',
            rotationSpeed: 2.5
        });

        // Layer 5: Frost mist
        this.spawn({ x: position.x, y: position.y + 0.3, z: position.z }, {
            count: 12,
            spread: radius * 0.4,
            speed: 1,
            life: 1.0,
            size: 0.6,
            endSize: 0.2,
            gravity: 0.5,
            upwardBias: 0.5,
            drag: 0.95,
            color: 0xaaddff,
            endColor: 0x6699cc,
            texture: 'smoke',
            blendMode: 'normal'
        });
    }

    frostCast(position) {
        // Gathering frost energy at cast point
        // Layer 1: Central bright glow
        this.spawn({ x: position.x, y: position.y + 1, z: position.z }, {
            count: 1,
            spread: 0,
            speed: 0,
            life: 0.5,
            size: 0.8,
            endSize: 0.2,
            gravity: 0,
            color: 0xffffff,
            endColor: 0x88ddff,
            texture: 'glow'
        });

        // Layer 2: Swirling ice particles inward
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const dist = 1.5;
            this.spawn({
                x: position.x + Math.cos(angle) * dist,
                y: position.y + 1,
                z: position.z + Math.sin(angle) * dist
            }, {
                count: 2,
                spread: 0.1,
                speed: 3,
                velocityX: -Math.cos(angle) * 3,
                velocityY: 0,
                velocityZ: -Math.sin(angle) * 3,
                life: 0.4,
                size: 0.25,
                endSize: 0.05,
                gravity: 0,
                color: 0x88eeff,
                endColor: 0xffffff,
                texture: 'magic',
                rotationSpeed: 4
            });
        }

        // Layer 3: Frost sparkles
        this.spawn({ x: position.x, y: position.y + 1, z: position.z }, {
            count: 8,
            spread: 0.5,
            speed: 2,
            life: 0.4,
            size: 0.2,
            endSize: 0.05,
            gravity: 0,
            color: 0xeeffff,
            texture: 'star',
            rotationSpeed: 3
        });
    }

    frozenOrbTrail(position) {
        // Trailing frost particles for projectile
        // Layer 1: Core glow
        this.spawn(position, {
            count: 1,
            spread: 0,
            speed: 0,
            life: 0.3,
            size: 0.5,
            endSize: 0.1,
            gravity: 0,
            color: 0x88ddff,
            endColor: 0x4488cc,
            texture: 'glow'
        });

        // Layer 2: Trailing ice particles
        this.spawn(position, {
            count: 3,
            spread: 0.2,
            speed: 1.5,
            life: 0.5,
            size: 0.2,
            endSize: 0.05,
            gravity: -1,
            upwardBias: 0,
            color: 0xccffff,
            endColor: 0x6699cc,
            texture: 'soft'
        });

        // Layer 3: Occasional ice sparkle
        if (Math.random() < 0.4) {
            this.spawn(position, {
                count: 1,
                spread: 0.3,
                speed: 0.5,
                life: 0.25,
                size: 0.25,
                endSize: 0.05,
                gravity: 0,
                color: 0xffffff,
                texture: 'star',
                rotationSpeed: 4
            });
        }
    }

    frozenOrbExplosion(position, radius = 4) {
        // Layer 1: Bright ice flash
        this.spawn(position, {
            count: 1,
            spread: 0,
            speed: 0,
            life: 0.35,
            size: 2.0,
            endSize: 0.3,
            gravity: 0,
            color: 0xffffff,
            endColor: 0x66ddff,
            texture: 'flare'
        });

        // Layer 2: Ice shards exploding outward
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const upAngle = (Math.random() - 0.5) * Math.PI * 0.5;
            this.spawn(position, {
                count: 2,
                spread: 0.1,
                speed: 7,
                velocityX: Math.cos(angle) * Math.cos(upAngle) * 7,
                velocityY: Math.sin(upAngle) * 4,
                velocityZ: Math.sin(angle) * Math.cos(upAngle) * 7,
                life: 0.6,
                size: 0.35,
                endSize: 0.08,
                gravity: -3,
                color: 0x88eeff,
                endColor: 0x4488cc,
                texture: 'streak',
                rotationSpeed: 3
            });
        }

        // Layer 3: Frost cloud
        this.spawn(position, {
            count: 15,
            spread: radius * 0.3,
            speed: 3,
            life: 0.8,
            size: 0.5,
            endSize: 0.15,
            gravity: -1,
            upwardBias: 1.5,
            drag: 0.94,
            color: 0xccffff,
            endColor: 0x88ccee,
            texture: 'soft'
        });

        // Layer 4: Ground frost ring
        this.spawn({ x: position.x, y: position.y - 0.5, z: position.z }, {
            count: 1,
            spread: 0,
            speed: 0,
            life: 0.5,
            size: 0.3,
            endSize: radius * 1.2,
            gravity: 0,
            color: 0x88ddff,
            endColor: 0x4488aa,
            texture: 'ring'
        });

        // Layer 5: Floating ice crystals
        this.spawn(position, {
            count: 10,
            spread: radius * 0.5,
            speed: 2,
            life: 1.0,
            size: 0.25,
            endSize: 0.05,
            gravity: -2.5,
            upwardBias: 0.5,
            color: 0xeeffff,
            texture: 'star',
            rotationSpeed: 2.5
        });
    }

    // === HUNTER EFFECTS ===

    arrowTrail(position) {
        // Trailing particles for arrows/bolts
        this.spawn(position, {
            count: 2,
            spread: 0.05,
            speed: 0.5,
            life: 0.3,
            size: 0.15,
            endSize: 0.03,
            gravity: 0,
            color: 0xffdd88,
            endColor: 0x886644,
            texture: 'streak'
        });
    }

    arrowWaveEffect(position, direction, range = 12) {
        const dir = new THREE.Vector3(direction.x, 0, direction.z).normalize();
        const perpX = -dir.z;
        const perpZ = dir.x;

        // Wave of arrow particles expanding outward
        for (let d = 2; d < range; d += 2) {
            const width = d * 0.3;
            const basePos = {
                x: position.x + dir.x * d,
                y: 0.8,
                z: position.z + dir.z * d
            };

            setTimeout(() => {
                // Arrow streaks
                for (let w = -2; w <= 2; w++) {
                    const offset = w * width * 0.2;
                    this.spawn({
                        x: basePos.x + perpX * offset,
                        y: basePos.y,
                        z: basePos.z + perpZ * offset
                    }, {
                        count: 1,
                        spread: 0.1,
                        speed: 8,
                        velocityX: dir.x * 8,
                        velocityY: 0,
                        velocityZ: dir.z * 8,
                        life: 0.3,
                        size: 0.3,
                        endSize: 0.05,
                        gravity: 0,
                        color: 0xffdd66,
                        endColor: 0xaa8844,
                        texture: 'streak'
                    });
                }

                // Dust/debris
                this.spawn(basePos, {
                    count: 4,
                    spread: width,
                    speed: 2,
                    life: 0.5,
                    size: 0.2,
                    endSize: 0.05,
                    gravity: -5,
                    upwardBias: 2,
                    color: 0xccbb99,
                    texture: 'soft'
                });
            }, d * 25);
        }
    }

    spinDashEffect(position) {
        // Spinning blade/arrow trail
        // Layer 1: Central spin blur
        this.spawn(position, {
            count: 8,
            spread: 0.8,
            speed: 4,
            life: 0.4,
            size: 0.4,
            endSize: 0.1,
            gravity: 0,
            color: 0xffcc44,
            endColor: 0xaa8822,
            texture: 'streak',
            rotationSpeed: 8
        });

        // Layer 2: Spark ring
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            this.spawn({
                x: position.x + Math.cos(angle) * 0.8,
                y: position.y + 0.5,
                z: position.z + Math.sin(angle) * 0.8
            }, {
                count: 1,
                spread: 0,
                speed: 3,
                velocityX: Math.cos(angle) * 3,
                velocityY: 1,
                velocityZ: Math.sin(angle) * 3,
                life: 0.3,
                size: 0.2,
                endSize: 0.05,
                gravity: -5,
                color: 0xffffaa,
                texture: 'spark'
            });
        }
    }

    shotgunBlast(position, direction) {
        const dir = new THREE.Vector3(direction.x, 0, direction.z).normalize();

        // Layer 1: Muzzle flash
        this.spawn(position, {
            count: 1,
            spread: 0,
            speed: 0,
            life: 0.15,
            size: 1.0,
            endSize: 0.3,
            gravity: 0,
            color: 0xffffcc,
            endColor: 0xffaa44,
            texture: 'flare'
        });

        // Layer 2: Pellet streaks
        for (let i = 0; i < 8; i++) {
            const spread = (Math.random() - 0.5) * 0.6;
            const perpX = -dir.z;
            const perpZ = dir.x;
            this.spawn({
                x: position.x + dir.x * 0.5,
                y: position.y + 0.8,
                z: position.z + dir.z * 0.5
            }, {
                count: 1,
                spread: 0.1,
                speed: 12,
                velocityX: (dir.x + perpX * spread) * 12,
                velocityY: 0.5,
                velocityZ: (dir.z + perpZ * spread) * 12,
                life: 0.25,
                size: 0.2,
                endSize: 0.05,
                gravity: -3,
                color: 0xffdd88,
                endColor: 0xaa7744,
                texture: 'streak'
            });
        }

        // Layer 3: Smoke puff
        this.spawn(position, {
            count: 5,
            spread: 0.3,
            speed: 2,
            life: 0.6,
            size: 0.5,
            endSize: 0.8,
            gravity: 1,
            upwardBias: 1,
            drag: 0.92,
            color: 0x888888,
            endColor: 0x444444,
            texture: 'smoke',
            blendMode: 'normal'
        });
    }

    trapPlace(position) {
        // Trap deployment effect
        // Layer 1: Ground ripple
        this.spawn({ x: position.x, y: 0.1, z: position.z }, {
            count: 1,
            spread: 0,
            speed: 0,
            life: 0.4,
            size: 0.3,
            endSize: 1.5,
            gravity: 0,
            color: 0x44aa44,
            endColor: 0x226622,
            texture: 'ring'
        });

        // Layer 2: Mechanical sparks
        this.spawn(position, {
            count: 8,
            spread: 0.3,
            speed: 4,
            life: 0.4,
            size: 0.15,
            endSize: 0.03,
            gravity: -8,
            upwardBias: 3,
            color: 0xffff88,
            texture: 'spark'
        });
    }

    trapTrigger(position) {
        // Trap activation/explosion
        // Layer 1: Flash
        this.spawn(position, {
            count: 1,
            spread: 0,
            speed: 0,
            life: 0.2,
            size: 1.5,
            endSize: 0.3,
            gravity: 0,
            color: 0xffff88,
            endColor: 0xff8844,
            texture: 'flare'
        });

        // Layer 2: Debris explosion
        this.spawn(position, {
            count: 15,
            spread: 0.5,
            speed: 8,
            life: 0.5,
            size: 0.25,
            endSize: 0.08,
            gravity: -12,
            upwardBias: 5,
            color: 0xddaa66,
            endColor: 0x886644,
            texture: 'soft'
        });

        // Layer 3: Metal sparks
        this.spawn(position, {
            count: 12,
            spread: 0.3,
            speed: 10,
            life: 0.35,
            size: 0.15,
            gravity: -10,
            upwardBias: 4,
            color: 0xffffaa,
            texture: 'spark'
        });

        // Layer 4: Smoke
        this.spawn(position, {
            count: 6,
            spread: 0.4,
            speed: 2,
            life: 0.8,
            size: 0.5,
            endSize: 1.0,
            gravity: 1.5,
            upwardBias: 1,
            drag: 0.93,
            color: 0x666666,
            endColor: 0x333333,
            texture: 'smoke',
            blendMode: 'normal'
        });
    }

    giantArrowTrail(position) {
        // Heavy arrow trail
        // Layer 1: Core trail
        this.spawn(position, {
            count: 2,
            spread: 0.1,
            speed: 1,
            life: 0.4,
            size: 0.4,
            endSize: 0.1,
            gravity: 0,
            color: 0xffcc44,
            endColor: 0xaa7722,
            texture: 'streak'
        });

        // Layer 2: Energy glow
        this.spawn(position, {
            count: 1,
            spread: 0,
            speed: 0,
            life: 0.25,
            size: 0.6,
            endSize: 0.2,
            gravity: 0,
            color: 0xffdd88,
            endColor: 0xff8844,
            texture: 'glow'
        });

        // Layer 3: Sparks
        if (Math.random() < 0.4) {
            this.spawn(position, {
                count: 2,
                spread: 0.2,
                speed: 2,
                life: 0.3,
                size: 0.15,
                endSize: 0.03,
                gravity: -5,
                color: 0xffffaa,
                texture: 'spark'
            });
        }
    }

    giantArrowImpact(position) {
        // Heavy arrow impact explosion
        // Layer 1: Bright flash
        this.spawn(position, {
            count: 1,
            spread: 0,
            speed: 0,
            life: 0.3,
            size: 2.5,
            endSize: 0.5,
            gravity: 0,
            color: 0xffffcc,
            endColor: 0xffaa44,
            texture: 'flare'
        });

        // Layer 2: Shockwave ring
        this.spawn({ x: position.x, y: 0.2, z: position.z }, {
            count: 1,
            spread: 0,
            speed: 0,
            life: 0.4,
            size: 0.5,
            endSize: 5,
            gravity: 0,
            color: 0xffcc66,
            endColor: 0xaa6622,
            texture: 'ring'
        });

        // Layer 3: Debris
        this.spawn(position, {
            count: 20,
            spread: 0.8,
            speed: 10,
            life: 0.6,
            size: 0.3,
            endSize: 0.08,
            gravity: -15,
            upwardBias: 6,
            color: 0xddaa66,
            endColor: 0x886644,
            texture: 'soft'
        });

        // Layer 4: Hot sparks
        this.spawn(position, {
            count: 15,
            spread: 0.5,
            speed: 12,
            life: 0.4,
            size: 0.2,
            gravity: -12,
            upwardBias: 5,
            color: 0xffffaa,
            texture: 'spark'
        });

        // Layer 5: Smoke
        this.spawn(position, {
            count: 8,
            spread: 0.6,
            speed: 2,
            life: 1.0,
            size: 0.6,
            endSize: 1.2,
            gravity: 2,
            upwardBias: 1.5,
            drag: 0.92,
            color: 0x777777,
            endColor: 0x333333,
            texture: 'smoke',
            blendMode: 'normal'
        });
    }

    markedTarget(position) {
        // Hunter's mark effect on target
        // Layer 1: Mark ring
        this.spawn({ x: position.x, y: 0.2, z: position.z }, {
            count: 1,
            spread: 0,
            speed: 0,
            life: 0.5,
            size: 0.3,
            endSize: 1.5,
            gravity: 0,
            color: 0xff4444,
            endColor: 0xaa2222,
            texture: 'ring'
        });

        // Layer 2: Rising markers
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            this.spawn({
                x: position.x + Math.cos(angle) * 0.5,
                y: position.y + 0.3,
                z: position.z + Math.sin(angle) * 0.5
            }, {
                count: 1,
                spread: 0,
                speed: 2,
                velocityX: 0,
                velocityY: 2,
                velocityZ: 0,
                life: 0.6,
                size: 0.2,
                endSize: 0.05,
                gravity: 0,
                color: 0xff6644,
                endColor: 0xff2222,
                texture: 'magic'
            });
        }
    }

    // === UTILITY EFFECTS ===

    bladestormSpin(position) {
        // Layer 1: Circular blade streaks (rotating)
        for (let i = 0; i < 16; i++) {
            const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.2;
            const radius = 1.6 + Math.random() * 0.4;
            const pos = {
                x: position.x + Math.cos(angle) * radius,
                y: position.y + 0.6 + Math.random() * 0.6,
                z: position.z + Math.sin(angle) * radius
            };
            this.spawn(pos, {
                count: 1,
                spread: 0.02,
                speed: 4,
                life: 0.4,
                size: 0.4,
                endSize: 0.05,
                gravity: 0,
                upwardBias: 0,
                drag: 0.88,
                color: 0xaaccff,
                endColor: 0x6688ff,
                texture: 'streak'
            });
        }

        // Layer 2: Central vortex energy (ring pulsing)
        this.spawn(position, {
            count: 3,
            spread: 0.2,
            speed: 1,
            life: 0.3,
            size: 0.8,
            endSize: 0.3,
            gravity: 0,
            upwardBias: 0,
            color: 0xccddff,
            endColor: 0x8899ff,
            texture: 'ring'
        });

        // Layer 3: Outer wind particles (spiral motion)
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const radius = 2.2;
            const pos = {
                x: position.x + Math.cos(angle) * radius,
                y: position.y + 0.3,
                z: position.z + Math.sin(angle) * radius
            };
            this.spawn(pos, {
                count: 2,
                spread: 0.2,
                speed: 2,
                life: 0.5,
                size: 0.3,
                endSize: 0.08,
                gravity: 2,
                upwardBias: 2,
                drag: 0.95,
                color: 0x99bbff,
                endColor: 0x6688cc,
                texture: 'soft'
            });
        }

        // Layer 4: Sparkles
        this.spawn(position, {
            count: 5,
            spread: 1.5,
            speed: 3,
            life: 0.4,
            size: 0.2,
            gravity: 0,
            upwardBias: 1,
            color: 0xeeffff,
            texture: 'star',
            rotationSpeed: 4
        });
    }

    directionalShockwave(position, direction, range = 10) {
        const dir = new THREE.Vector3(direction.x, 0, direction.z).normalize();

        for (let d = 0.5; d < range; d += 0.5) {
            const pos = position.clone().addScaledVector(dir, d);
            pos.y = 0.4;

            setTimeout(() => {
                // Layer 1: Leading edge energy wall
                this.spawn(pos, {
                    count: 5,
                    spread: 1.2,
                    speed: 4,
                    life: 0.45,
                    size: 0.55,
                    endSize: 0.1,
                    gravity: 0,
                    upwardBias: 3,
                    drag: 0.93,
                    color: 0x99bbff,
                    endColor: 0x5577ff,
                    texture: 'ring'
                });

                // Layer 2: Ground disturbance trail
                this.spawn(pos, {
                    count: 4,
                    spread: 0.8,
                    speed: 3,
                    life: 0.55,
                    size: 0.4,
                    endSize: 0.08,
                    gravity: 0,
                    upwardBias: 1,
                    drag: 0.95,
                    color: 0xaaccff,
                    endColor: 0x6688cc,
                    texture: 'streak'
                });

                // Layer 3: Scattered energy fragments
                this.spawn(pos, {
                    count: 3,
                    spread: 1.0,
                    speed: 6,
                    life: 0.5,
                    size: 0.3,
                    endSize: 0.05,
                    gravity: 2,
                    upwardBias: 4,
                    drag: 0.96,
                    color: 0xccddff,
                    endColor: 0x8899dd,
                    texture: 'magic',
                    rotationSpeed: 2
                });

                // Dust/debris
                this.spawn(pos, {
                    count: 3,
                    spread: 0.9,
                    speed: 2,
                    life: 0.6,
                    size: 0.35,
                    gravity: -1,
                    upwardBias: 1,
                    drag: 0.96,
                    color: 0xaa9988,
                    endColor: 0x665544,
                    texture: 'smoke',
                    blendMode: 'normal'
                });
            }, d * 22);
        }

        // Initial burst at player
        this.spawn(position, {
            count: 10,
            spread: 0.3,
            speed: 5,
            life: 0.3,
            size: 0.6,
            endSize: 0.15,
            gravity: 0,
            upwardBias: 2,
            color: 0xeeffff,
            endColor: 0xaaccff,
            texture: 'glow'
        });

        // Sparkle burst
        this.spawn(position, {
            count: 8,
            spread: 0.4,
            speed: 8,
            life: 0.35,
            size: 0.25,
            gravity: -5,
            upwardBias: 3,
            color: 0xffffff,
            texture: 'flare'
        });
    }

    portalEffect(position) {
        // Layer 1: Swirling vortex ring
        this.spawn({ x: position.x, y: position.y + 0.1, z: position.z }, {
            count: 1,
            spread: 0,
            speed: 0,
            life: 0.5,
            size: 0.5,
            endSize: 3,
            gravity: 0,
            color: 0x8855ff,
            endColor: 0x442288,
            texture: 'ring'
        });

        // Layer 2: Spiraling particles inward
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const dist = 2.5;
            const spiralPos = {
                x: position.x + Math.cos(angle) * dist,
                y: position.y + 0.5 + Math.random() * 1,
                z: position.z + Math.sin(angle) * dist
            };
            const toCenter = {
                x: (position.x - spiralPos.x) * 2,
                y: 0.5,
                z: (position.z - spiralPos.z) * 2
            };
            this.spawn(spiralPos, {
                count: 1,
                spread: 0.05,
                speed: 0,
                velocityX: toCenter.x + Math.cos(angle + Math.PI/2) * 3,
                velocityY: toCenter.y,
                velocityZ: toCenter.z + Math.sin(angle + Math.PI/2) * 3,
                life: 0.6,
                size: 0.3,
                endSize: 0.05,
                gravity: 0,
                color: 0xaa88ff,
                endColor: 0x6644cc,
                texture: 'magic',
                rotationSpeed: 4
            });
        }

        // Layer 3: Central glow pulse
        this.spawn(position, {
            count: 1,
            spread: 0,
            speed: 0,
            life: 0.4,
            size: 0.8,
            endSize: 1.5,
            gravity: 0,
            color: 0xbb99ff,
            endColor: 0x553399,
            texture: 'glow'
        });

        // Layer 4: Void particles rising from center
        this.spawn({ x: position.x, y: position.y + 0.2, z: position.z }, {
            count: 6,
            spread: 0.4,
            speed: 3,
            life: 0.8,
            size: 0.25,
            endSize: 0.05,
            gravity: 2,
            upwardBias: 4,
            color: 0x9966ff,
            endColor: 0x442288,
            texture: 'soft'
        });

        // Layer 5: Edge sparkles
        this.spawn(position, {
            count: 8,
            spread: 1.5,
            speed: 1,
            life: 0.5,
            size: 0.2,
            endSize: 0.03,
            gravity: 0,
            upwardBias: 0.5,
            color: 0xccaaff,
            texture: 'star',
            rotationSpeed: 3
        });
    }

    buffAura(position, color = 0x44ff88) {
        // Layer 1: Subtle persistent ring at base
        if (Math.random() < 0.15) {
            this.spawn({ x: position.x, y: position.y + 0.1, z: position.z }, {
                count: 1,
                spread: 0,
                speed: 0,
                life: 1.0,
                size: 0.8,
                endSize: 2,
                gravity: 0,
                color: color,
                endColor: 0x000000,
                texture: 'ring'
            });
        }

        // Layer 2: Floating aura particles around character
        const angle = Math.random() * Math.PI * 2;
        const dist = 0.6 + Math.random() * 0.4;
        const auraPos = {
            x: position.x + Math.cos(angle) * dist,
            y: position.y + 0.3 + Math.random() * 1.2,
            z: position.z + Math.sin(angle) * dist
        };
        this.spawn(auraPos, {
            count: 1,
            spread: 0.05,
            speed: 0.5,
            velocityX: Math.cos(angle + Math.PI/2) * 0.5,
            velocityY: 0.8,
            velocityZ: Math.sin(angle + Math.PI/2) * 0.5,
            life: 1.0,
            size: 0.18,
            endSize: 0.03,
            gravity: 0.3,
            upwardBias: 0.5,
            drag: 0.98,
            color: color,
            texture: 'soft'
        });

        // Layer 3: Occasional sparkle flash
        if (Math.random() < 0.2) {
            const sparkPos = {
                x: position.x + (Math.random() - 0.5) * 1,
                y: position.y + 0.5 + Math.random() * 1,
                z: position.z + (Math.random() - 0.5) * 1
            };
            this.spawn(sparkPos, {
                count: 1,
                spread: 0,
                speed: 0,
                life: 0.3,
                size: 0.25,
                endSize: 0.05,
                gravity: 0,
                color: 0xffffff,
                endColor: color,
                texture: 'magic',
                rotationSpeed: 2
            });
        }
    }

    chargeUp(position, progress = 0) {
        // progress: 0-1, how far along the charge is

        // Layer 1: Gathering energy swirl (intensity scales with progress)
        const particleCount = Math.floor(2 + progress * 4);
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 1.5 - progress * 0.8;
            const spiralPos = {
                x: position.x + Math.cos(angle) * dist,
                y: position.y + 0.5 + Math.random() * 0.8,
                z: position.z + Math.sin(angle) * dist
            };
            const toCenter = {
                x: (position.x - spiralPos.x) * (2 + progress * 2),
                y: 0.5,
                z: (position.z - spiralPos.z) * (2 + progress * 2)
            };
            this.spawn(spiralPos, {
                count: 1,
                spread: 0.05,
                speed: 0,
                velocityX: toCenter.x + Math.cos(angle + Math.PI/2) * (1 + progress),
                velocityY: toCenter.y,
                velocityZ: toCenter.z + Math.sin(angle + Math.PI/2) * (1 + progress),
                life: 0.35,
                size: 0.25 + progress * 0.15,
                endSize: 0.03,
                gravity: 0,
                color: 0x88ccff,
                endColor: 0x4466ff,
                texture: 'magic',
                rotationSpeed: 3 + progress * 2
            });
        }

        // Layer 2: Central glow (grows with progress)
        if (Math.random() < 0.3 + progress * 0.4) {
            this.spawn(position, {
                count: 1,
                spread: 0,
                speed: 0,
                life: 0.25,
                size: 0.5 + progress * 0.8,
                endSize: 0.3 + progress * 0.5,
                gravity: 0,
                color: 0xaaddff,
                endColor: 0x4488ff,
                texture: 'glow'
            });
        }

        // Layer 3: Rising energy sparks (more at higher charge)
        if (Math.random() < 0.2 + progress * 0.5) {
            this.spawn(position, {
                count: 1 + Math.floor(progress * 3),
                spread: 0.3,
                speed: 3 + progress * 3,
                life: 0.4,
                size: 0.15 + progress * 0.1,
                endSize: 0.02,
                gravity: 2 + progress * 2,
                upwardBias: 3 + progress * 2,
                color: 0xccffff,
                endColor: 0x6699ff,
                texture: 'spark'
            });
        }

        // Layer 4: Ground crackle effect at high charge
        if (progress > 0.6 && Math.random() < progress * 0.4) {
            const crackleAngle = Math.random() * Math.PI * 2;
            const cracklePos = {
                x: position.x + Math.cos(crackleAngle) * 0.8,
                y: position.y + 0.1,
                z: position.z + Math.sin(crackleAngle) * 0.8
            };
            this.spawn(cracklePos, {
                count: 1,
                spread: 0.1,
                speed: 4,
                life: 0.2,
                size: 0.3,
                endSize: 0.05,
                gravity: -8,
                upwardBias: 5,
                color: 0xffffff,
                endColor: 0x88aaff,
                texture: 'flare'
            });
        }
    }

    // Item pickup effect
    itemPickup(position, color = 0x44ff44) {
        // Layer 1: Upward sparkle burst
        this.spawn(position, {
            count: 12,
            spread: 0.3,
            speed: 4,
            life: 0.5,
            size: 0.25,
            endSize: 0.05,
            gravity: 3,
            upwardBias: 5,
            color: color,
            endColor: 0xffffff,
            texture: 'star',
            rotationSpeed: 4
        });

        // Layer 2: Central glow flash
        this.spawn(position, {
            count: 1,
            spread: 0,
            speed: 0,
            life: 0.3,
            size: 0.8,
            endSize: 0.1,
            gravity: 0,
            color: 0xffffff,
            endColor: color,
            texture: 'glow'
        });

        // Layer 3: Rising particles
        this.spawn(position, {
            count: 8,
            spread: 0.4,
            speed: 2,
            life: 0.6,
            size: 0.2,
            endSize: 0.03,
            gravity: 2,
            upwardBias: 4,
            drag: 0.97,
            color: color,
            texture: 'magic',
            rotationSpeed: 3
        });

        // Layer 4: Small sparks
        this.spawn(position, {
            count: 6,
            spread: 0.2,
            speed: 6,
            life: 0.3,
            size: 0.12,
            gravity: -5,
            upwardBias: 3,
            color: 0xffffff,
            texture: 'spark'
        });
    }

    // Buff applied effect
    buffApplied(position, color = 0x44ff44) {
        // Rising sparkles around player
        this.spawn(position, {
            count: 16,
            spread: 1.0,
            speed: 2,
            life: 1.0,
            size: 0.2,
            endSize: 0.05,
            gravity: 3,
            upwardBias: 4,
            color: color,
            endColor: 0xffffff,
            texture: 'star',
            rotationSpeed: 3
        });

        // Central glow
        this.spawn(position, {
            count: 1,
            spread: 0,
            speed: 0,
            life: 0.4,
            size: 1.5,
            endSize: 0.2,
            gravity: 0,
            color: color,
            endColor: color,
            texture: 'glow'
        });

        // Swirling particles
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const offset = {
                x: position.x + Math.cos(angle) * 0.8,
                y: position.y + 0.5,
                z: position.z + Math.sin(angle) * 0.8
            };
            this.spawn(offset, {
                count: 2,
                spread: 0.1,
                speed: 1,
                life: 0.8,
                size: 0.15,
                gravity: 2,
                upwardBias: 3,
                color: color,
                texture: 'magic'
            });
        }
    }

    // Item use effect (potions, etc.)
    itemUse(position, color = 0x44ff44) {
        // Splash particles
        this.spawn(position, {
            count: 12,
            spread: 0.5,
            speed: 3,
            life: 0.5,
            size: 0.2,
            endSize: 0.05,
            gravity: 5,
            upwardBias: 2,
            color: color,
            texture: 'circle'
        });

        // Center flash
        this.spawn(position, {
            count: 1,
            spread: 0,
            speed: 0,
            life: 0.3,
            size: 1.0,
            endSize: 0.1,
            gravity: 0,
            color: 0xffffff,
            endColor: color,
            texture: 'glow'
        });
    }
}
