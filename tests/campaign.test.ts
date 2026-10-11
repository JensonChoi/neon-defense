import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/engine.ts';
import type { TowerKind } from '../src/game/config.ts';
import { upgradeCost } from '../src/game/economy.ts';
// A reproducible strategy using only earned credits; deliberately no combat-time purchases.
export function campaign(variant = 0) {
    const g = new Game();
    g.reset();
    const plan: [
        number,
        TowerKind
    ][] = [[3, 'laser'], [1, 'laser'], [5, 'laser'], [7, 'laser'], [6, 'missile'], [8, 'cryo'], [10, 'railgun'], [4, 'tesla'], [19, 'tesla'], [16, 'laser'], [2, 'missile'], [21, 'railgun'], [9, 'missile'], [11, 'railgun'], [0, 'laser'], [14, 'tesla'], [22, 'railgun'], [18, 'missile'], [12, 'laser'], [15, 'tesla'], [17, 'laser'], [20, 'railgun'], [13, 'laser'], [23, 'railgun']];
    if (variant === 1) {
        plan[4][1] = 'tesla';
        plan[7][1] = 'missile';
    }
    if (variant === 2) {
        plan[5][1] = 'tesla';
        plan[7][1] = 'cryo';
    }
    const log: {
        wave: number;
        hp: number;
        credits: number;
        towers: number;
        kills: number;
    }[] = [];
    for (let wave = 1; wave <= 20 && g.phase === 'preparation'; wave++) {
        // Establish a perimeter before concentrating investment into higher levels.
        const targetCount = Math.min(plan.length, 3 + Math.floor(wave * .9));
        for (let i = 0; i < targetCount; i++) {
            const [pad, kind] = plan[i];
            if (!g.towers.some(t => t.pad === pad))
                g.build(kind, pad);
        }
        for (let level = 0; level < 3; level++)
            for (const t of g.towers) {
                if (t.level === level && g.credits >= upgradeCost(t.kind, t.level) + ((g.towers.length < targetCount) ? 100 : 0))
                    g.upgrade(t.pad);
            }
        g.startWave();
        for (let tick = 0; tick < 60 * 220 && g.phase === 'combat'; tick++) {
            g.step(1 / 60);
            g.drainEffects();
        }
        log.push({ wave, hp: g.hp, credits: g.credits, towers: g.towers.length, kills: g.kills });
    }
    return { g, log };
}
for (let variant = 0; variant < 3; variant++)
    test(`earned-credit mixed strategy ${variant + 1} completes the campaign`, () => { const { g, log } = campaign(variant); assert.equal(g.phase, 'victory', JSON.stringify(log)); assert.ok(g.hp > 0); });
test('building no towers results in defeat', () => { const g = new Game(); g.reset(); for (let wave = 0; wave < 20 && g.phase !== 'defeat'; wave++) {
    g.startWave();
    for (let i = 0; i < 12000 && g.phase === 'combat'; i++) {
        g.step(1 / 60);
        g.drainEffects();
    }
} assert.equal(g.phase, 'defeat'); });
