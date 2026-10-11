import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/engine.ts';
import { PADS, ROUTES, LENGTHS, positionOnRoute, distance } from '../src/game/paths.ts';
import {towerStats,upgradeCost} from '../src/game/economy.ts';
import { makeWave } from '../src/game/waves.ts';
const run = (g: Game, seconds: number) => { for (let i = 0; i < seconds * 60; i++) {
    g.step(1 / 60);
    g.drainEffects();
} };
test('recycling a once-upgraded laser refunds exactly 70 percent', () => {
  const game = new Game();
  game.reset();
  assert.equal(game.build('laser', 0), true);
  assert.equal(game.upgrade(0), true);
  assert.equal(game.sell(0), true);
  assert.equal(game.credits, 299);
});
function combat() { const g = new Game(); g.reset(); g.phase = 'combat'; g.wave = 1; g.queue = [{ at: 9999, kind: 'scout', route: 0 }]; return g; }
function at(g: Game, kind: Parameters<Game['spawn']>[0], progress: number, route = 0) { const e = g.spawn(kind, route); e.progress = progress; Object.assign(e, positionOnRoute(route, progress)); return e; }
test('all routes are finite, continuous, and reach the same reactor', () => { ROUTES.forEach((r, i) => { assert.deepEqual(positionOnRoute(i, 0), r[0]); assert.deepEqual(positionOnRoute(i, LENGTHS[i] + 1), { x: 13, z: 10 }); let last = r[0]; for (let d = .1; d <= LENGTHS[i]; d += .1) {
    const p = positionOnRoute(i, d);
    assert.ok(distance(last, p) <= .10001);
    last = p;
} }); });
test('construction validates pads, funds, and occupancy atomically', () => { const g = new Game(); assert.equal(g.build('laser', 0), false); g.reset(); assert.equal(g.build('laser', 99), false); assert.equal(g.build('laser', 1), true); assert.equal(g.credits, 250); assert.equal(g.build('cryo', 1), false); g.build('railgun', 2); assert.equal(g.credits, 30); assert.equal(g.build('laser', 3), false); });
test('three upgrades, exact investment accounting and selling refund', () => { const g = new Game(); g.reset(); g.credits = 1000; g.build('laser', 0); for (let i = 0; i < 3; i++)
    assert.equal(g.upgrade(0), true); assert.equal(g.upgrade(0), false); assert.equal(g.towers[0].invested, 440); assert.equal(g.credits, 560); assert.equal(g.sell(0), true); assert.equal(g.credits, 868); assert.equal(g.sell(0), false); assert.equal(g.towers.length, 0); assert.equal(upgradeCost('laser', 3), 0); });
test('damage drains shields first and armor reduces only health damage', () => { const g = combat(), e = at(g, 'shield', 10); g.damage(e, 60); assert.equal(e.shield, 40); assert.equal(e.hp, 100); g.damage(e, 60); assert.equal(e.shield, 0); assert.equal(e.hp, 80); const heavy = at(g, 'heavy', 10); g.damage(heavy, 100); assert.equal(heavy.hp, 200); g.damage(heavy, 100, true); assert.equal(heavy.hp, 100); });
test('dead enemies award credits once even under simultaneous attacks', () => { const g = combat(), e = at(g, 'scout', 10); g.damage(e, 100); g.damage(e, 100); assert.equal(g.kills, 1); assert.equal(g.credits, 358); assert.equal(g.enemies.length, 0); });
test('laser acquires, fires and kills in range but cannot shoot out of range', () => { const g = combat(); g.build('laser', 3); const outside = at(g, 'heavy', 0); run(g, .3); assert.equal(outside.hp, outside.maxHp); const target = at(g, 'scout', 20); run(g, 3); assert.ok(!g.enemies.includes(target)); assert.equal(g.kills, 1); });
test('missile splash damages nearby enemies and excludes outside radius', () => { const g = combat(); const first = at(g, 'heavy', 20), near = at(g, 'heavy', 21), far = at(g, 'heavy', 25); g.projectiles.push({ id: 999, kind: 'missile', target: first.id, x: first.x, z: first.z, damage: 100, splash: 2.2, life: 4 }); g.step(1 / 60); assert.equal(first.hp, 200); assert.equal(near.hp, 200); assert.equal(far.hp, 260); });
test('missiles reacquire nearby targets while orphaned laser projectiles expire', () => { const g = combat(); const e = at(g, 'heavy', 20); g.projectiles.push({ id: 999, kind: 'missile', target: -1, x: e.x, z: e.z, damage: 100, splash: 2.2, life: 4 }, { id: 998, kind: 'laser', target: -2, x: 0, z: 0, damage: 10, splash: 0, life: 4 }); g.step(1 / 60); assert.equal(e.hp, 200); assert.equal(g.projectiles.length, 0); });
test('Tesla chains hit distinct enemies with diminishing damage', () => { const g = combat(); g.build('tesla', 3); const a = at(g, 'heavy', 20), b = at(g, 'heavy', 22), c = at(g, 'heavy', 24); g.step(1 / 60); const losses = [a, b, c].map(e => 260 - e.hp).sort((a, b) => b - a); assert.ok(Math.abs(losses[0] - 13.2) < .001); assert.ok(Math.abs(losses[1] - 9.9) < .001); assert.ok(Math.abs(losses[2] - 7.425) < .001); });
test('railgun penetrates aligned enemies and ignores armor', () => { const g = combat(); g.build('railgun', 21); const a = at(g, 'heavy', 22), b = at(g, 'heavy', 20), outside = at(g, 'heavy', 0, 2); g.step(1 / 60); assert.equal(a.hp, 160); assert.equal(b.hp, 160); assert.equal(outside.hp, 260); });
test('cryo applies strongest slow without stacking and improves with levels', () => { const g = combat(); g.credits = 2000; g.build('cryo', 3); g.build('cryo', 5); g.upgrade(3); g.upgrade(3); g.upgrade(3); const e = at(g, 'heavy', 25); g.step(1 / 60); assert.equal(e.slow, towerStats('cryo', 3).slow); const before = e.progress; g.step(1 / 60); assert.ok(e.progress - before < .85 / 60); });
test('EMP telegraphs and temporarily disables only nearby towers', () => { const g = combat(); g.build('laser', 3); g.build('laser', 13); const boss = at(g, 'boss', 21); boss.empAt = 1; g.step(1 / 60); assert.equal(boss.warned, true); assert.ok(g.effects.some(e => e.type === 'warning')); run(g, 1); assert.ok(g.towers[0].disabledUntil > g.time); assert.equal(g.towers[1].disabledUntil, 0); run(g, 2.1); assert.ok(g.towers[0].disabledUntil <= g.time); });
test('each entrance leaks reliably; bosses inflict five damage', () => { for (let route = 0; route < 3; route++) {
    const g = combat();
    at(g, 'scout', LENGTHS[route] - .01, route);
    g.step(1 / 60);
    assert.equal(g.hp, 19);
    assert.equal(g.enemies.length, 0);
} const g = combat(); at(g, 'boss', LENGTHS[0] - .001); g.step(1 / 60); assert.equal(g.hp, 15); });
test('wave completion waits for queued and living enemies and awards once', () => { const g = combat(); run(g, 1); assert.equal(g.phase, 'combat'); g.queue = []; const e = at(g, 'scout', 5); g.step(1 / 60); assert.equal(g.phase, 'combat'); g.damage(e, 100); g.step(1 / 60); assert.equal(g.phase, 'preparation'); assert.equal(g.credits, 403); run(g, 3); assert.equal(g.credits, 403); });
test('manual start, hold countdown, pause and speed controls', () => { const g = new Game(); g.reset(); run(g, 20); assert.equal(g.wave, 0); g.toggleHold(); g.togglePause(); run(g, 20); assert.equal(g.countdown, 15); g.togglePause(); run(g, 16); assert.equal(g.wave, 1); g.setSpeed(3); const before = g.time; g.advance(.1); assert.ok(g.time - before > .28); g.setSpeed(12); assert.equal(g.speed, 3); g.startWave(); assert.equal(g.wave, 1); });
test('same elapsed time at 30 and 120 FPS produces equivalent movement', () => { const a = combat(), b = combat(); at(a, 'heavy', 0); at(b, 'heavy', 0); for (let i = 0; i < 300; i++)
    a.advance(1 / 30); for (let i = 0; i < 1200; i++)
    b.advance(1 / 120); assert.ok(Math.abs(a.enemies[0].progress - b.enemies[0].progress) < .02); });
test('victory, defeat and restart are terminal and reset cleanly', () => { const g = combat(); g.wave = 20; g.queue = []; g.step(1 / 60); assert.equal(g.phase, 'victory'); const credits = g.credits; run(g, 1); assert.equal(g.credits, credits); g.reset(); assert.equal(g.hp, 20); assert.equal(g.credits, 350); assert.equal(g.wave, 0); g.phase = 'combat'; g.hp = 1; g.queue = []; at(g, 'scout', LENGTHS[0] - .001); g.step(1 / 60); assert.equal(g.phase, 'defeat'); assert.equal(g.hp, 0); assert.equal(g.build('laser', 0), false); });
test('20 wave definitions have valid times and bosses precisely every five waves', () => { for (let w = 1; w <= 20; w++) {
    const spawns = makeWave(w);
    assert.ok(spawns.length >= 10);
    assert.equal(spawns.filter(s => s.kind === 'boss').length, w % 5 === 0 ? 1 : 0);
    assert.ok(spawns.every((s, i) => s.at >= 0 && s.route >= 0 && s.route < 3 && (!i || spawns[i - 1].at <= s.at)));
} assert.deepEqual(makeWave(21), []); });
