// Sound Manager using Web Audio API
export class SoundManager {
    constructor() {
        this.audioContext = null;
        this.masterVolume = null;
        this.sfxVolume = null;
        this.musicVolume = null;
        this.initialized = false;
        this.muted = false;

        // Sound buffers cache
        this.buffers = new Map();

        // Active sounds for cleanup
        this.activeSounds = new Set();

        // Volume levels (0-1)
        this.volumes = {
            master: 0.7,
            sfx: 0.8,
            music: 0.5
        };

        // Sound definitions with procedural generation settings
        this.soundDefs = {
            // Combat sounds
            swordSwing: { type: 'swoosh', frequency: 200, duration: 0.15 },
            swordHit: { type: 'impact', frequency: 150, duration: 0.2 },
            criticalHit: { type: 'impact', frequency: 200, duration: 0.3, gain: 1.2 },

            // Ability sounds
            cleave: { type: 'swoosh', frequency: 120, duration: 0.3, gain: 1.1 },
            whirlwind: { type: 'wind', frequency: 300, duration: 0.5 },
            heroicLeap: { type: 'whoosh', frequency: 100, duration: 0.4 },
            groundSlam: { type: 'explosion', frequency: 60, duration: 0.5, gain: 1.3 },
            sunder: { type: 'rumble', frequency: 80, duration: 0.6 },
            spinAttack: { type: 'swoosh', frequency: 250, duration: 0.35 },

            // Magic sounds
            fireball: { type: 'fire', frequency: 200, duration: 0.4 },
            frostbolt: { type: 'ice', frequency: 400, duration: 0.3 },
            lightning: { type: 'zap', frequency: 800, duration: 0.2 },
            heal: { type: 'sparkle', frequency: 600, duration: 0.5 },

            // Arrow sounds
            arrowShoot: { type: 'swoosh', frequency: 500, duration: 0.12 },
            arrowHit: { type: 'thud', frequency: 200, duration: 0.15 },
            multishot: { type: 'swoosh', frequency: 400, duration: 0.2 },

            // UI sounds
            buttonClick: { type: 'click', frequency: 800, duration: 0.05 },
            menuOpen: { type: 'sparkle', frequency: 500, duration: 0.15 },
            itemPickup: { type: 'coin', frequency: 1000, duration: 0.2 },
            levelUp: { type: 'fanfare', frequency: 400, duration: 0.6 },

            // Environment
            footstep: { type: 'thud', frequency: 100, duration: 0.08 },
            splash: { type: 'splash', frequency: 200, duration: 0.3 },

            // Enemy sounds
            enemyHit: { type: 'impact', frequency: 180, duration: 0.15 },
            enemyDeath: { type: 'death', frequency: 100, duration: 0.4 },
            enemyAttack: { type: 'swoosh', frequency: 180, duration: 0.2 },

            // Player sounds
            playerHit: { type: 'impact', frequency: 120, duration: 0.2 },
            playerDeath: { type: 'death', frequency: 80, duration: 0.6 },
            dodge: { type: 'whoosh', frequency: 300, duration: 0.15 },

            // Life skills
            mining: { type: 'clang', frequency: 300, duration: 0.15 },
            chopping: { type: 'thud', frequency: 150, duration: 0.2 },
            fishing: { type: 'splash', frequency: 250, duration: 0.25 },
            cooking: { type: 'sizzle', frequency: 400, duration: 0.3 },
            crafting: { type: 'hammer', frequency: 350, duration: 0.15 },
            smelting: { type: 'fire', frequency: 150, duration: 0.4 }
        };
    }

    // Initialize audio context (must be called after user interaction)
    async init() {
        if (this.initialized) return true;

        try {
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Create volume nodes
            this.masterVolume = this.audioContext.createGain();
            this.masterVolume.gain.value = this.volumes.master;
            this.masterVolume.connect(this.audioContext.destination);

            this.sfxVolume = this.audioContext.createGain();
            this.sfxVolume.gain.value = this.volumes.sfx;
            this.sfxVolume.connect(this.masterVolume);

            this.musicVolume = this.audioContext.createGain();
            this.musicVolume.gain.value = this.volumes.music;
            this.musicVolume.connect(this.masterVolume);

            this.initialized = true;
            console.log('SoundManager initialized');
            return true;
        } catch (e) {
            console.warn('Failed to initialize audio:', e);
            return false;
        }
    }

    // Resume audio context if suspended (browsers require user interaction)
    async resume() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    // Play a sound by name
    play(soundName, options = {}) {
        if (!this.initialized || this.muted) return null;

        const def = this.soundDefs[soundName];
        if (!def) {
            console.warn(`Sound not found: ${soundName}`);
            return null;
        }

        // Resume context if needed
        this.resume();

        // Generate and play the sound
        return this.generateSound(def, options);
    }

    // Generate procedural sound
    generateSound(def, options = {}) {
        const ctx = this.audioContext;
        const now = ctx.currentTime;
        const duration = (options.duration || def.duration) * (options.durationMult || 1);
        const frequency = (options.frequency || def.frequency) * (options.pitchMult || 1);
        const gain = (options.gain || def.gain || 1) * (options.volumeMult || 1);

        // Create nodes
        const gainNode = ctx.createGain();
        gainNode.connect(this.sfxVolume);

        let source;

        switch (def.type) {
            case 'swoosh':
                source = this.createSwoosh(ctx, now, duration, frequency, gainNode);
                break;
            case 'impact':
                source = this.createImpact(ctx, now, duration, frequency, gainNode);
                break;
            case 'explosion':
                source = this.createExplosion(ctx, now, duration, frequency, gainNode);
                break;
            case 'wind':
                source = this.createWind(ctx, now, duration, frequency, gainNode);
                break;
            case 'whoosh':
                source = this.createWhoosh(ctx, now, duration, frequency, gainNode);
                break;
            case 'rumble':
                source = this.createRumble(ctx, now, duration, frequency, gainNode);
                break;
            case 'fire':
                source = this.createFire(ctx, now, duration, frequency, gainNode);
                break;
            case 'ice':
                source = this.createIce(ctx, now, duration, frequency, gainNode);
                break;
            case 'zap':
                source = this.createZap(ctx, now, duration, frequency, gainNode);
                break;
            case 'sparkle':
                source = this.createSparkle(ctx, now, duration, frequency, gainNode);
                break;
            case 'click':
                source = this.createClick(ctx, now, duration, frequency, gainNode);
                break;
            case 'thud':
                source = this.createThud(ctx, now, duration, frequency, gainNode);
                break;
            case 'coin':
                source = this.createCoin(ctx, now, duration, frequency, gainNode);
                break;
            case 'fanfare':
                source = this.createFanfare(ctx, now, duration, frequency, gainNode);
                break;
            case 'splash':
                source = this.createSplash(ctx, now, duration, frequency, gainNode);
                break;
            case 'death':
                source = this.createDeath(ctx, now, duration, frequency, gainNode);
                break;
            case 'clang':
                source = this.createClang(ctx, now, duration, frequency, gainNode);
                break;
            case 'sizzle':
                source = this.createSizzle(ctx, now, duration, frequency, gainNode);
                break;
            case 'hammer':
                source = this.createHammer(ctx, now, duration, frequency, gainNode);
                break;
            default:
                source = this.createSwoosh(ctx, now, duration, frequency, gainNode);
        }

        // Apply gain envelope
        gainNode.gain.setValueAtTime(gain * 0.001, now);
        gainNode.gain.exponentialRampToValueAtTime(gain, now + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

        // Track active sound
        this.activeSounds.add(source);
        source.onended = () => {
            this.activeSounds.delete(source);
            gainNode.disconnect();
        };

        return source;
    }

    // Sound generators
    createSwoosh(ctx, now, duration, freq, gainNode) {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq * 2, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + duration);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(freq * 4, now);
        filter.frequency.exponentialRampToValueAtTime(freq, now + duration);
        filter.Q.value = 2;

        // Add noise for texture
        const noise = this.createNoiseSource(ctx, duration);
        const noiseGain = ctx.createGain();
        noiseGain.gain.value = 0.3;
        noise.connect(noiseGain);
        noiseGain.connect(filter);

        osc.connect(filter);
        filter.connect(gainNode);

        osc.start(now);
        osc.stop(now + duration);
        noise.start(now);
        noise.stop(now + duration);

        return osc;
    }

    createImpact(ctx, now, duration, freq, gainNode) {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.3, now + duration);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(freq * 8, now);
        filter.frequency.exponentialRampToValueAtTime(freq, now + duration);

        // Add noise burst
        const noise = this.createNoiseSource(ctx, duration * 0.3);
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.5, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + duration * 0.3);
        noise.connect(noiseGain);
        noiseGain.connect(gainNode);

        osc.connect(filter);
        filter.connect(gainNode);

        osc.start(now);
        osc.stop(now + duration);
        noise.start(now);
        noise.stop(now + duration * 0.3);

        return osc;
    }

    createExplosion(ctx, now, duration, freq, gainNode) {
        // Low rumble
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.2, now + duration);

        // Noise burst
        const noise = this.createNoiseSource(ctx, duration);
        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(freq * 10, now);
        noiseFilter.frequency.exponentialRampToValueAtTime(freq, now + duration);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.8, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(gainNode);
        osc.connect(gainNode);

        osc.start(now);
        osc.stop(now + duration);
        noise.start(now);
        noise.stop(now + duration);

        return osc;
    }

    createWind(ctx, now, duration, freq, gainNode) {
        const noise = this.createNoiseSource(ctx, duration);
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = freq;
        filter.Q.value = 5;

        // Modulate filter for wind effect
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 3;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = freq * 0.5;
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);

        noise.connect(filter);
        filter.connect(gainNode);

        lfo.start(now);
        lfo.stop(now + duration);
        noise.start(now);
        noise.stop(now + duration);

        return noise;
    }

    createWhoosh(ctx, now, duration, freq, gainNode) {
        const noise = this.createNoiseSource(ctx, duration);
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(freq * 0.5, now);
        filter.frequency.exponentialRampToValueAtTime(freq * 2, now + duration * 0.5);
        filter.frequency.exponentialRampToValueAtTime(freq * 0.3, now + duration);
        filter.Q.value = 3;

        noise.connect(filter);
        filter.connect(gainNode);

        noise.start(now);
        noise.stop(now + duration);

        return noise;
    }

    createRumble(ctx, now, duration, freq, gainNode) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq * 1.5, now);

        // Add tremolo
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 20;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.3;
        lfo.connect(lfoGain);

        const tremolo = ctx.createGain();
        lfoGain.connect(tremolo.gain);

        osc.connect(tremolo);
        osc2.connect(tremolo);
        tremolo.connect(gainNode);

        lfo.start(now);
        lfo.stop(now + duration);
        osc.start(now);
        osc.stop(now + duration);
        osc2.start(now);
        osc2.stop(now + duration);

        return osc;
    }

    createFire(ctx, now, duration, freq, gainNode) {
        const noise = this.createNoiseSource(ctx, duration);
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = freq;
        filter.Q.value = 1;

        // Crackling effect
        const lfo = ctx.createOscillator();
        lfo.type = 'square';
        lfo.frequency.value = 15;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.3;
        lfo.connect(lfoGain);

        const crackle = ctx.createGain();
        crackle.gain.value = 0.7;
        lfoGain.connect(crackle.gain);

        noise.connect(filter);
        filter.connect(crackle);
        crackle.connect(gainNode);

        lfo.start(now);
        lfo.stop(now + duration);
        noise.start(now);
        noise.stop(now + duration);

        return noise;
    }

    createIce(ctx, now, duration, freq, gainNode) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.setValueAtTime(freq * 1.2, now + duration * 0.3);
        osc.frequency.setValueAtTime(freq * 0.8, now + duration * 0.6);

        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = freq * 0.5;
        filter.Q.value = 10;

        osc.connect(filter);
        filter.connect(gainNode);

        osc.start(now);
        osc.stop(now + duration);

        return osc;
    }

    createZap(ctx, now, duration, freq, gainNode) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';

        // Rapid frequency changes for electric effect
        for (let i = 0; i < 10; i++) {
            const t = now + (i / 10) * duration;
            const f = freq * (0.5 + Math.random());
            osc.frequency.setValueAtTime(f, t);
        }

        const distortion = ctx.createWaveShaper();
        distortion.curve = this.makeDistortionCurve(50);

        osc.connect(distortion);
        distortion.connect(gainNode);

        osc.start(now);
        osc.stop(now + duration);

        return osc;
    }

    createSparkle(ctx, now, duration, freq, gainNode) {
        const oscs = [];
        for (let i = 0; i < 5; i++) {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            const startTime = now + (i * duration * 0.15);
            osc.frequency.setValueAtTime(freq * (1 + i * 0.2), startTime);
            osc.frequency.exponentialRampToValueAtTime(freq * (1.5 + i * 0.3), startTime + duration * 0.2);

            const oscGain = ctx.createGain();
            oscGain.gain.setValueAtTime(0.001, now);
            oscGain.gain.setValueAtTime(0.001, startTime);
            oscGain.gain.exponentialRampToValueAtTime(0.3 / (i + 1), startTime + 0.02);
            oscGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 0.3);

            osc.connect(oscGain);
            oscGain.connect(gainNode);

            osc.start(startTime);
            osc.stop(startTime + duration * 0.4);
            oscs.push(osc);
        }
        return oscs[0];
    }

    createClick(ctx, now, duration, freq, gainNode) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;

        osc.connect(gainNode);
        osc.start(now);
        osc.stop(now + duration);

        return osc;
    }

    createThud(ctx, now, duration, freq, gainNode) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + duration);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = freq * 4;

        osc.connect(filter);
        filter.connect(gainNode);

        osc.start(now);
        osc.stop(now + duration);

        return osc;
    }

    createCoin(ctx, now, duration, freq, gainNode) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.setValueAtTime(freq * 1.5, now + duration * 0.3);

        osc.connect(gainNode);
        osc.start(now);
        osc.stop(now + duration);

        return osc;
    }

    createFanfare(ctx, now, duration, freq, gainNode) {
        const notes = [1, 1.25, 1.5, 2]; // Major chord arpeggio
        notes.forEach((mult, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.value = freq * mult;

            const noteGain = ctx.createGain();
            const noteStart = now + i * 0.1;
            noteGain.gain.setValueAtTime(0.001, now);
            noteGain.gain.setValueAtTime(0.001, noteStart);
            noteGain.gain.exponentialRampToValueAtTime(0.3, noteStart + 0.05);
            noteGain.gain.exponentialRampToValueAtTime(0.001, noteStart + duration * 0.5);

            osc.connect(noteGain);
            noteGain.connect(gainNode);

            osc.start(noteStart);
            osc.stop(noteStart + duration * 0.6);
        });

        // Return dummy for tracking
        const dummy = ctx.createOscillator();
        dummy.connect(ctx.createGain());
        dummy.start(now);
        dummy.stop(now + duration);
        return dummy;
    }

    createSplash(ctx, now, duration, freq, gainNode) {
        const noise = this.createNoiseSource(ctx, duration);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(freq * 4, now);
        filter.frequency.exponentialRampToValueAtTime(freq * 0.5, now + duration);

        noise.connect(filter);
        filter.connect(gainNode);

        noise.start(now);
        noise.stop(now + duration);

        return noise;
    }

    createDeath(ctx, now, duration, freq, gainNode) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq * 2, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.3, now + duration);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(freq * 8, now);
        filter.frequency.exponentialRampToValueAtTime(freq, now + duration);

        osc.connect(filter);
        filter.connect(gainNode);

        osc.start(now);
        osc.stop(now + duration);

        return osc;
    }

    createClang(ctx, now, duration, freq, gainNode) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;

        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.value = freq * 2.4; // Metallic overtone

        const osc2Gain = ctx.createGain();
        osc2Gain.gain.value = 0.3;
        osc2.connect(osc2Gain);
        osc2Gain.connect(gainNode);

        osc.connect(gainNode);

        osc.start(now);
        osc.stop(now + duration);
        osc2.start(now);
        osc2.stop(now + duration);

        return osc;
    }

    createSizzle(ctx, now, duration, freq, gainNode) {
        const noise = this.createNoiseSource(ctx, duration);
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = freq;
        filter.Q.value = 2;

        noise.connect(filter);
        filter.connect(gainNode);

        noise.start(now);
        noise.stop(now + duration);

        return noise;
    }

    createHammer(ctx, now, duration, freq, gainNode) {
        // Metal hit
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.7, now + duration);

        // Impact noise
        const noise = this.createNoiseSource(ctx, duration * 0.3);
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.4, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + duration * 0.3);
        noise.connect(noiseGain);
        noiseGain.connect(gainNode);

        osc.connect(gainNode);

        osc.start(now);
        osc.stop(now + duration);
        noise.start(now);
        noise.stop(now + duration * 0.3);

        return osc;
    }

    // Create white noise source
    createNoiseSource(ctx, duration) {
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        return source;
    }

    // Create distortion curve for effects
    makeDistortionCurve(amount) {
        const samples = 44100;
        const curve = new Float32Array(samples);
        const deg = Math.PI / 180;

        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;
            curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
        }

        return curve;
    }

    // Volume controls
    setMasterVolume(value) {
        this.volumes.master = Math.max(0, Math.min(1, value));
        if (this.masterVolume) {
            this.masterVolume.gain.value = this.volumes.master;
        }
    }

    setSFXVolume(value) {
        this.volumes.sfx = Math.max(0, Math.min(1, value));
        if (this.sfxVolume) {
            this.sfxVolume.gain.value = this.volumes.sfx;
        }
    }

    setMusicVolume(value) {
        this.volumes.music = Math.max(0, Math.min(1, value));
        if (this.musicVolume) {
            this.musicVolume.gain.value = this.volumes.music;
        }
    }

    // Mute/unmute
    toggleMute() {
        this.muted = !this.muted;
        return this.muted;
    }

    setMuted(muted) {
        this.muted = muted;
    }

    // Stop all sounds
    stopAll() {
        for (const sound of this.activeSounds) {
            try {
                sound.stop();
            } catch (e) {
                // Already stopped
            }
        }
        this.activeSounds.clear();
    }

    // Cleanup
    dispose() {
        this.stopAll();
        if (this.audioContext) {
            this.audioContext.close();
        }
    }
}
