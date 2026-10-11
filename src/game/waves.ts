import type { EnemyKind } from './config.ts';
export type Spawn = {
    at: number;
    kind: EnemyKind;
    route: number;
};
// Handcrafted compositions; timing and lanes turn these into predictable formations.
const COMPOSITIONS: [
    number,
    number,
    number,
    number
][] = [
    [10, 0, 0, 0], [8, 5, 0, 0], [14, 6, 0, 0], [10, 8, 2, 0], [12, 8, 2, 0],
    [12, 8, 2, 4], [18, 10, 4, 4], [12, 12, 6, 6], [22, 12, 6, 8], [16, 14, 8, 8],
    [24, 14, 8, 10], [18, 18, 10, 10], [28, 16, 12, 12], [22, 20, 12, 14], [24, 22, 14, 14],
    [30, 22, 14, 16], [26, 26, 16, 18], [34, 24, 18, 18], [30, 28, 20, 20], [36, 30, 22, 22],
];
export const WAVE_NAMES = ['First contact', 'Steel footsteps', 'Signal interference', 'Heavy industry', 'The gatekeeper', 'Ghost protocol', 'Crossfire', 'Pressure system', 'Blackout warning', 'Siege engine', 'Neural storm', 'Broken skyline', 'Hostile network', 'Terminal velocity', 'The destroyer', 'Zero hour', 'City under fire', 'Critical mass', 'Last transmission', 'The final light'];
export function makeWave(wave: number): Spawn[] {
    const c = COMPOSITIONS[wave - 1];
    if (!c)
        return [];
    const lanes = wave < 3 ? 1 : wave < 7 ? 2 : 3;
    const kinds: EnemyKind[] = ['scout', 'assault', 'heavy', 'shield'];
    const groups = c.flatMap((count, i) => Array.from({ length: count }, () => kinds[i]));
    // Round-robin formations avoid a single homogeneous tail.
    const ordered: EnemyKind[] = [];
    const left = [...c];
    while (ordered.length < groups.length)
        for (let k = 0; k < 4; k++)
            if (left[k] > 0) {
                ordered.push(kinds[k]);
                left[k]--;
            }
    const spawns = ordered.map((kind, i) => ({ kind, at: i * Math.max(0.32, 1.05 - wave * 0.035), route: i % lanes }));
    if (wave % 5 === 0)
        spawns.push({ kind: 'boss', at: 6, route: wave === 5 ? 0 : 2 });
    return spawns.sort((a, b) => a.at - b.at);
}
