import {TOWERS} from './config.ts';
import type {TowerKind} from './config.ts';

export function towerStats(kind: TowerKind, level: number) { const t = TOWERS[kind]; return { damage: t.damage * 1.3 ** level, range: t.range * 1.08 ** level, rate: t.rate * 1.1 ** level, slow: 0.3 + level * 0.05, splash: 2.2 + level * 0.3, chains: 3 + level }; }
export const upgradeCost = (kind: TowerKind, level: number) => level >= 3 ? 0 : Math.round(TOWERS[kind].cost * [0.7, 1.1, 1.6][level]);

export const sellValue = (invested:number) => Math.floor(invested * 0.7);
export const waveReward = (wave:number) => 40 + 5 * wave;
