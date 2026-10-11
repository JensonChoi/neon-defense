export type Vec = {
    x: number;
    z: number;
};
export type TowerKind = 'laser' | 'missile' | 'tesla' | 'railgun' | 'cryo';
export type EnemyKind = 'scout' | 'assault' | 'heavy' | 'shield' | 'boss';
export const TOWERS: Record<TowerKind, {
    name: string;
    label: string;
    cost: number;
    damage: number;
    rate: number;
    range: number;
    color: string;
    description: string;
}> = {
    laser: { name: 'Laser turret', label: 'PRECISION / RAPID FIRE', cost: 100, damage: 9, rate: 4, range: 6, color: '#61ffe2', description: 'Rapid energy bolts. Reliable, precise defense against fast drones.' },
    missile: { name: 'Missile launcher', label: 'EXPLOSIVE / AREA DAMAGE', cost: 160, damage: 45, rate: 0.65, range: 7, color: '#ffb56b', description: 'Homing missiles detonate on impact, devastating tightly packed formations.' },
    tesla: { name: 'Tesla coil', label: 'ELECTRIC / CHAIN ATTACK', cost: 180, damage: 22, rate: 1.3, range: 5.5, color: '#b294ff', description: 'Lightning jumps between nearby targets. Each upgrade adds another chain.' },
    railgun: { name: 'Railgun', label: 'KINETIC / ARMOR PIERCING', cost: 220, damage: 100, rate: 0.45, range: 10, color: '#ff6ab3', description: 'Heavy penetrating shots ignore armor and hit everything along the firing line.' },
    cryo: { name: 'Cryo tower', label: 'CONTROL / SLOW FIELD', cost: 120, damage: 4, rate: 4, range: 4.5, color: '#85cfff', description: 'A freezing field slows every enemy in range, buying your defenses precious time.' },
};
export const ENEMIES: Record<EnemyKind, {
    hp: number;
    speed: number;
    armor: number;
    shield: number;
    reward: number;
    color: string;
}> = {
    scout: { hp: 32, speed: 2.4, armor: 0, shield: 0, reward: 8, color: '#ff536f' },
    assault: { hp: 85, speed: 1.5, armor: 0.15, shield: 0, reward: 12, color: '#ff9261' },
    heavy: { hp: 260, speed: 0.85, armor: 0.4, shield: 0, reward: 24, color: '#ffce7a' },
    shield: { hp: 100, speed: 1.35, armor: 0, shield: 100, reward: 20, color: '#b894ff' },
    boss: { hp: 1000, speed: 0.65, armor: 0.25, shield: 0, reward: 120, color: '#ff386c' },
};
