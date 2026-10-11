import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIFFICULTIES, DIFFICULTY_PROFILES } from '../src/game/difficulty.ts';
import { Game } from '../src/game/engine.ts';
import { ENEMIES } from '../src/game/config.ts';
import { LENGTHS } from '../src/game/paths.ts';
import { makeWave } from '../src/game/waves.ts';

for (const difficulty of DIFFICULTIES) {
  const profile = DIFFICULTY_PROFILES[difficulty];
  test(`${difficulty}: deterministic rounded formations preserve lanes and boss cadence`, () => {
    for (let wave = 1; wave <= 20; wave++) {
      const baseline = makeWave(wave, 'easy');
      const spawns = makeWave(wave, difficulty);
      assert.deepEqual(spawns, makeWave(wave, difficulty));
      assert.deepEqual(spawns.filter(s => s.kind === 'boss'), baseline.filter(s => s.kind === 'boss'));
      for (const kind of ['scout', 'assault', 'heavy', 'shield'] as const) {
        assert.equal(spawns.filter(s => s.kind === kind).length,
          Math.ceil(baseline.filter(s => s.kind === kind).length * profile.quantity));
      }
      const regular = spawns.filter(s => s.kind !== 'boss');
      const lanes = wave < 3 ? 1 : wave < 7 ? 2 : 3;
      const counts = ['scout', 'assault', 'heavy', 'shield'].map(kind => regular.filter(s => s.kind === kind).length);
      const order: string[] = [];
      while (counts.some(c => c > 0)) {
        for (let k = 0; k < counts.length; k++) if (counts[k] > 0) {
          order.push(['scout', 'assault', 'heavy', 'shield'][k]); counts[k]--;
        }
      }
      assert.deepEqual(regular.map(s => s.kind), order);
      regular.forEach((s, i) => {
        assert.equal(s.route, i % lanes);
        assert.equal(s.at, i * Math.max(.32, 1.05 - wave * .035) / profile.quantity);
      });
    }
  });
  test(`${difficulty}: health scales after wave scaling and restart retains selection`, () => {
    const g = new Game();
    assert.equal(g.difficulty, 'medium');
    g.reset(difficulty);
    assert.equal(g.hp, profile.reactorHp);
    assert.equal(g.getSnapshot().maxHp, profile.reactorHp);
    assert.equal(g.getSnapshot().difficulty, difficulty);
    g.wave = 10;
    for (const kind of ['scout', 'assault', 'heavy', 'shield', 'boss'] as const) {
      const enemy = g.spawn(kind, 0);
      assert.equal(enemy.hp, (kind === 'boss' ? 1800 : ENEMIES[kind].hp * 2.08) * profile.health);
      assert.equal(enemy.maxHp, enemy.hp);
      assert.equal(enemy.shield, ENEMIES[kind].shield * 2.08 * profile.health);
      assert.equal(enemy.maxShield, enemy.shield);
    }
    g.reset();
    assert.equal(g.difficulty, difficulty);
    assert.equal(g.hp, profile.reactorHp);
    g.startWave();
    assert.deepEqual(g.queue, makeWave(1, difficulty));
  });
  test(`${difficulty}: lethal breaches award neither kills nor completion credits`, () => {
    const g = new Game(); g.reset(difficulty); g.startWave(); g.queue = [];
    for (let i = 0; i < profile.reactorHp; i++) g.spawn('scout', i % 3).progress = LENGTHS[i % 3];
    g.step(1 / 60);
    assert.equal(g.phase, 'defeat'); assert.equal(g.hp, 0);
    assert.equal(g.kills, 0); assert.equal(g.credits, 350);
    g.step(1); assert.equal(g.credits, 350);
  });
}
