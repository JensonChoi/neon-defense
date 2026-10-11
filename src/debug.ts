import type { Game } from './game/engine.ts';
import type { Battlefield } from './render/scene.ts';
import { PADS } from './game/paths.ts';
import { Vector3 } from 'three';
/** Exposed only in Vite development mode with ?test=1. Never in production. */
export function installTestBridge(game: Game, scene: Battlefield) {
    const bridge = { game, scene, padPosition(pad: number) { const p = PADS[pad]; const projected = new Vector3(p.x, .65, p.z).project(scene.camera); const rect = scene.renderer.domElement.getBoundingClientRect(); return { x: rect.left + (projected.x + 1) * rect.width / 2, y: rect.top + (1 - projected.y) * rect.height / 2 }; } };
    Object.assign(window, { __NEON_TEST__: bridge });
}
