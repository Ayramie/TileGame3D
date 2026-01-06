import * as THREE from 'three';

export class ThirdPersonCamera {
    constructor(camera, target) {
        this.camera = camera;
        this.target = target;

        // Camera orbit parameters
        this.distance = 10;
        this.minDistance = 3;
        this.maxDistance = 25;

        this.yaw = 0; // Horizontal rotation (around player)
        this.pitch = 0.3; // Vertical rotation (radians)
        this.minPitch = -0.5;
        this.maxPitch = Math.PI / 2.2;

        // Character rotation (separate from camera when using left-click)
        this.characterYaw = 0;

        // Smoothing
        this.positionSmoothing = 10;

        // Target offset (look at point above player's feet)
        this.targetOffset = new THREE.Vector3(0, 1.5, 0);

        // Current interpolated values
        this.currentPosition = new THREE.Vector3();
        this.currentLookAt = new THREE.Vector3();

        // Mouse sensitivity
        this.mouseSensitivity = 0.005;
        this.scrollSensitivity = 1.5;

        // Initialize position
        this.updateIdealPosition();
        this.currentPosition.copy(this.idealPosition);
        this.camera.position.copy(this.currentPosition);
    }

    updateIdealPosition() {
        // Calculate ideal camera position based on yaw, pitch, distance
        const targetPos = this.target.position.clone().add(this.targetOffset);

        // Spherical coordinates
        const x = Math.sin(this.yaw) * Math.cos(this.pitch) * this.distance;
        const y = Math.sin(this.pitch) * this.distance;
        const z = Math.cos(this.yaw) * Math.cos(this.pitch) * this.distance;

        this.idealPosition = targetPos.clone().add(new THREE.Vector3(x, y, z));
        this.idealLookAt = targetPos;
    }

    // Right-click drag: rotate character AND camera together
    rotateCharacter(deltaX, deltaY) {
        this.yaw -= deltaX * this.mouseSensitivity;
        this.pitch += deltaY * this.mouseSensitivity;
        this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch));

        // Character faces forward (away from camera) - same direction as camera yaw
        this.characterYaw = this.yaw;
        this.target.rotation = this.yaw + Math.PI;
    }

    // Left-click drag: rotate camera AND character faces camera direction
    rotateCamera(deltaX, deltaY) {
        this.yaw -= deltaX * this.mouseSensitivity;
        this.pitch += deltaY * this.mouseSensitivity;
        this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch));

        // Character faces where camera is looking
        this.target.rotation = this.yaw + Math.PI;
    }

    handleScroll(delta) {
        this.distance += delta * this.scrollSensitivity;
        this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance));
    }

    update(deltaTime, input) {
        // Only auto-follow when moving forward/back, not when strafing
        const isMovingForward = input.keys.w || input.keys.s;
        if (isMovingForward && !input.leftMouseDown) {
            // Smoothly align camera to be behind character
            // Since target.rotation = yaw + PI, we get yaw = target.rotation - PI
            const targetYaw = this.target.rotation - Math.PI;
            const yawDiff = targetYaw - this.yaw;

            // Normalize angle difference
            let normalizedDiff = yawDiff;
            while (normalizedDiff > Math.PI) normalizedDiff -= Math.PI * 2;
            while (normalizedDiff < -Math.PI) normalizedDiff += Math.PI * 2;

            // Smooth camera follow when moving forward/back
            this.yaw += normalizedDiff * deltaTime * 3;
        }

        // Update ideal position
        this.updateIdealPosition();

        // Smooth interpolation to ideal position
        const posLerp = 1 - Math.exp(-this.positionSmoothing * deltaTime);
        this.currentPosition.lerp(this.idealPosition, posLerp);
        this.currentLookAt.lerp(this.idealLookAt, posLerp);

        // Apply to camera
        this.camera.position.copy(this.currentPosition);
        this.camera.lookAt(this.currentLookAt);
    }

    // Get the camera's forward direction for movement
    getForwardYaw() {
        return this.yaw;
    }
}
