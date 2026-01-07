import * as THREE from 'three';

export class ThirdPersonCamera {
    constructor(camera, target) {
        this.camera = camera;
        this.target = target;

        // Camera orbit parameters
        this.distance = 30; // More zoomed out by default
        this.minDistance = 10;
        this.maxDistance = 60;

        this.yaw = 0; // Horizontal rotation (around player) - 360° allowed
        this.targetYaw = 0; // For smooth rotation
        this.pitch = Math.PI / 3.5; // More top-down angle (~51°) - LOCKED

        // Smoothing
        this.positionSmoothing = 10;
        this.rotationSmoothing = 8;

        // Target offset (look at point above player's feet)
        this.targetOffset = new THREE.Vector3(0, 1.5, 0);

        // Current interpolated values
        this.currentPosition = new THREE.Vector3();
        this.currentLookAt = new THREE.Vector3();

        // Mouse sensitivity
        this.mouseSensitivity = 0.005;
        this.scrollSensitivity = 1.5;

        // Mouse drag state
        this.isDragging = false;
        this.lastMouseX = 0;

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

    // Start right-click drag for rotation
    startDrag(mouseX) {
        this.isDragging = true;
        this.lastMouseX = mouseX;
    }

    // Update rotation during drag (horizontal only - pitch is locked)
    updateDrag(mouseX) {
        if (!this.isDragging) return;

        const deltaX = mouseX - this.lastMouseX;
        this.targetYaw -= deltaX * this.mouseSensitivity;

        // Normalize yaw to 0-2PI range
        while (this.targetYaw < 0) this.targetYaw += Math.PI * 2;
        while (this.targetYaw >= Math.PI * 2) this.targetYaw -= Math.PI * 2;

        this.lastMouseX = mouseX;
    }

    // End drag
    endDrag() {
        this.isDragging = false;
    }

    // Legacy methods for compatibility
    rotateCharacter(deltaX, deltaY) {
        this.targetYaw -= deltaX * this.mouseSensitivity;
    }

    rotateCamera(deltaX, deltaY) {
        this.targetYaw -= deltaX * this.mouseSensitivity;
    }

    handleScroll(delta) {
        this.distance += delta * this.scrollSensitivity;
        this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance));
    }

    update(deltaTime, input) {
        // Smooth yaw rotation - handle wraparound
        let yawDiff = this.targetYaw - this.yaw;
        // Take shortest path around circle
        if (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
        if (yawDiff < -Math.PI) yawDiff += Math.PI * 2;

        const rotLerp = 1 - Math.exp(-this.rotationSmoothing * deltaTime);
        this.yaw += yawDiff * rotLerp;

        // Normalize yaw
        while (this.yaw < 0) this.yaw += Math.PI * 2;
        while (this.yaw >= Math.PI * 2) this.yaw -= Math.PI * 2;

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

    // Alias for compatibility
    getYaw() {
        return this.yaw;
    }
}
