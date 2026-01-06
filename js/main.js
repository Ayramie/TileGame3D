import * as THREE from 'three';
import { Game } from './game.js';

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const game = new Game(canvas);
    game.start();
});
