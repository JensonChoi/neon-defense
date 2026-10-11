import {damageAfterShield,targetsInRange,intersectsShot} from './combat.ts';
import {moveProjectile} from './projectiles.ts';
import { ENEMIES, TOWERS } from './config.ts';
import {PADS,LENGTHS,positionOnRoute,distance} from './paths.ts';
import {towerStats,upgradeCost,sellValue,waveReward} from './economy.ts';
import type { Vec, TowerKind, EnemyKind } from './config.ts';
import { makeWave } from './waves.ts';
import type { Spawn } from './waves.ts';
export type Phase = 'menu' | 'preparation' | 'combat' | 'victory' | 'defeat';
export type Enemy = Vec & {
    id: number;
    kind: EnemyKind;
    hp: number;
    maxHp: number;
    shield: number;
    maxShield: number;
    route: number;
    progress: number;
    slow: number;
    slowUntil: number;
    empAt: number;
    warned: boolean;
};
export type Tower = {
    id: number;
    pad: number;
    kind: TowerKind;
    level: number;
    invested: number;
    cooldown: number;
    disabledUntil: number;
    angle: number;
};
export type Projectile = Vec & {
    id: number;
    kind: 'laser' | 'missile';
    target: number;
    damage: number;
    splash: number;
    life: number;
};
export type Effect = {
    id: number;
    type: 'shot' | 'explosion' | 'chain' | 'rail' | 'hit' | 'reward' | 'breach' | 'emp' | 'warning';
    from: Vec;
    to: Vec;
    color: string;
    value?: number;
    radius?: number;
};
export type Snapshot = {
    phase: Phase;
    paused: boolean;
    credits: number;
    hp: number;
    wave: number;
    remaining: number;
    queued: number;
    kills: number;
    countdown: number;
    hold: boolean;
    speed: number;
    towers: Tower[];
    selected: number | null;
    notice: string;
    revision: number;
};
export class Game {
    phase: Phase = 'menu';
    paused = false;
    credits = 350;
    hp = 20;
    wave = 0;
    kills = 0;
    countdown = 15;
    hold = true;
    speed = 1;
    time = 0;
    enemies: Enemy[] = [];
    towers: Tower[] = [];
    projectiles: Projectile[] = [];
    selected: number | null = null;
    effects: Effect[] = [];
    queue: Spawn[] = [];
    waveTime = 0;
    notice = 'Select a build site to deploy your first tower.';
    private nextId = 1;
    private listeners = new Set<() => void>();
    private revision = 0;
    private accumulator = 0;
    private publishClock = 0;
    private projectilePool: Projectile[] = [];
    private snapshot!: Snapshot;
    constructor() { this.publish(); }
    subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
    getSnapshot = () => this.snapshot;
    publish() { this.snapshot = { phase: this.phase, paused: this.paused, credits: this.credits, hp: this.hp, wave: this.wave, remaining: this.enemies.length + this.queue.length, queued: this.queue.length, kills: this.kills, countdown: this.countdown, hold: this.hold, speed: this.speed, towers: this.towers.map(t => ({ ...t })), selected: this.selected, notice: this.notice, revision: ++this.revision }; this.listeners.forEach(f => f()); }
    reset() { this.phase = 'preparation'; this.paused = false; this.credits = 350; this.hp = 20; this.wave = 0; this.kills = 0; this.countdown = 15; this.hold = true; this.speed = 1; this.time = 0; this.enemies = []; this.towers = []; this.projectiles = []; this.effects = []; this.queue = []; this.selected = null; this.accumulator = 0; this.notice = 'Build near the first entrance, then start the wave.'; this.publish(); }
    select(pad: number | null) { this.selected = pad; this.publish(); }
    editable() { return this.phase === 'preparation' || this.phase === 'combat'; }
    build(kind: TowerKind, pad = this.selected): boolean { if (!this.editable() || pad === null || !PADS[pad] || this.towers.some(t => t.pad === pad) || this.credits < TOWERS[kind].cost)
        return false; this.credits -= TOWERS[kind].cost; this.towers.push({ id: this.nextId++, pad, kind, level: 0, invested: TOWERS[kind].cost, cooldown: 0, disabledUntil: 0, angle: 0 }); this.notice = `${TOWERS[kind].name} online. Perimeter secured.`; this.publish(); return true; }
    upgrade(pad = this.selected): boolean { const t = this.towers.find(t => t.pad === pad); if (!this.editable() || !t || t.level >= 3)
        return false; const cost = upgradeCost(t.kind, t.level); if (this.credits < cost)
        return false; this.credits -= cost; t.invested += cost; t.level++; this.notice = 'Upgrade complete. Combat systems enhanced.'; this.publish(); return true; }
    sell(pad = this.selected): boolean { const t = this.towers.find(t => t.pad === pad); if (!this.editable() || !t)
        return false; this.credits += sellValue(t.invested); this.towers = this.towers.filter(x => x !== t); this.notice = 'Tower recycled. Credits returned.'; this.publish(); return true; }
    startWave() { if (this.phase !== 'preparation' || this.paused)
        return; this.wave++; this.phase = 'combat'; this.queue = makeWave(this.wave); this.waveTime = 0; this.notice = this.wave % 5 === 0 ? 'WARNING: Boss signature detected. Watch for EMP pulses.' : `Wave ${this.wave} inbound. Defend the reactor.`; this.publish(); }
    setSpeed(speed: number) { if ([1, 2, 3].includes(speed)) {
        this.speed = speed;
        this.publish();
    } }
    togglePause() { if (!this.editable())
        return; this.paused = !this.paused; this.publish(); }
    toggleHold() { this.hold = !this.hold; this.publish(); }
    emit(type: Effect['type'], from: Vec, to: Vec, color: string, value?: number, radius?: number) { if (this.effects.length < 240)
        this.effects.push({ id: this.nextId++, type, from: { ...from }, to: { ...to }, color, value, radius }); }
    drainEffects() { const effects = this.effects; this.effects = []; return effects; }
    spawn(kind: EnemyKind, route: number) { const base = ENEMIES[kind]; const scale = 1 + .12 * (this.wave - 1); const hp = kind === 'boss' ? [1000, 1800, 2800, 4000][Math.max(0, Math.floor(this.wave / 5) - 1)] : base.hp * scale; const e: Enemy = { id: this.nextId++, kind, hp, maxHp: hp, shield: base.shield * scale, maxShield: base.shield * scale, route, progress: 0, ...positionOnRoute(route, 0), slow: 0, slowUntil: 0, empAt: this.time + 8, warned: false }; this.enemies.push(e); return e; }
    damage(enemy: Enemy, amount: number, ignoreArmor = false) {
        if (enemy.hp <= 0 || !this.enemies.includes(enemy))
            return;
        const {shieldHit,healthHit} = damageAfterShield(amount,enemy.shield,ENEMIES[enemy.kind].armor,ignoreArmor);
        enemy.shield -= shieldHit;
        enemy.hp -= healthHit;
        this.emit('hit', enemy, enemy, '#ffffff', Math.round(healthHit + shieldHit));
        if (enemy.hp <= 0) {
            this.kills++;
            this.credits += ENEMIES[enemy.kind].reward;
            this.emit('explosion', enemy, enemy, ENEMIES[enemy.kind].color, undefined, enemy.kind === 'boss' ? 3 : 1);
            this.emit('reward', enemy, enemy, '#83ffce', ENEMIES[enemy.kind].reward);
            this.enemies = this.enemies.filter(e => e !== enemy);
        }
    }
    advance(realDt: number) { if (this.paused || !this.editable())
        return; this.accumulator += Math.min(realDt, .1) * this.speed; while (this.accumulator >= 1 / 60) {
        this.step(1 / 60);
        this.accumulator -= 1 / 60;
        if (!this.editable())
            break;
    } this.publishClock += realDt; if (this.publishClock > .08) {
        this.publishClock = 0;
        this.publish();
    } }
    step(dt: number) {
        if (this.paused || !this.editable())
            return;
        this.time += dt;
        if (this.phase === 'preparation') {
            if (!this.hold) {
                this.countdown -= dt;
                if (this.countdown <= 0)
                    this.startWave();
            }
            return;
        }
        this.waveTime += dt;
        while (this.queue.length && this.queue[0].at <= this.waveTime) {
            const s = this.queue.shift()!;
            this.spawn(s.kind, s.route);
        }
        for (const e of [...this.enemies]) {
            if (e.kind === 'boss') {
                if (!e.warned && this.time >= e.empAt - 1.5) {
                    e.warned = true;
                    this.emit('warning', e, e, '#ff386c', undefined, 5);
                }
                if (this.time >= e.empAt) {
                    for (const t of this.towers)
                        if (distance(PADS[t.pad], e) <= 5)
                            t.disabledUntil = this.time + 2;
                    this.emit('emp', e, e, '#ff386c', undefined, 5);
                    e.empAt = this.time + 8;
                    e.warned = false;
                }
            }
            const slow = e.slowUntil > this.time ? e.slow : 0;
            e.progress += ENEMIES[e.kind].speed * (1 - slow) * dt;
            Object.assign(e, positionOnRoute(e.route, e.progress));
            if (e.progress >= LENGTHS[e.route]) {
                this.hp = Math.max(0, this.hp - (e.kind === 'boss' ? 5 : 1));
                this.enemies = this.enemies.filter(x => x !== e);
                this.emit('breach', e, e, '#ff386c');
                this.notice = 'PERIMETER BREACH — Reactor integrity compromised.';
                if (this.hp <= 0) {
                    this.phase = 'defeat';
                    this.publish();
                    return;
                }
            }
        }
        for (const t of this.towers) {
            t.cooldown = Math.max(0, t.cooldown - dt);
            if (t.disabledUntil > this.time)
                continue;
            const s = towerStats(t.kind, t.level);
            const p = PADS[t.pad];
            const candidates = targetsInRange(this.enemies,p,s.range);
            if (!candidates.length)
                continue;
            const target = candidates[0];
            t.angle = Math.atan2(target.x - p.x, target.z - p.z);
            if (t.kind === 'cryo') {
                for (const e of candidates) {
                    e.slow = Math.max(e.slowUntil > this.time ? e.slow : 0, s.slow);
                    e.slowUntil = this.time + .2;
                }
                if (t.cooldown === 0) {
                    for (const e of candidates)
                        this.damage(e, s.damage / s.rate);
                    this.emit('shot', p, target, TOWERS.cryo.color, undefined, s.range);
                    t.cooldown = 1 / s.rate;
                }
                continue;
            }
            if (t.cooldown > 0)
                continue;
            t.cooldown = 1 / s.rate;
            if (t.kind === 'tesla') {
                let last: Vec = p;
                let next: Enemy | undefined = target;
                const hit = new Set<number>();
                for (let n = 0; n < s.chains && next; n++) {
                    hit.add(next.id);
                    this.emit('chain', last, next, TOWERS.tesla.color);
                    this.damage(next, s.damage * .75 ** n);
                    last = next;
                    next = this.enemies.filter(e => !hit.has(e.id) && distance(last, e) <= 3.8).sort((a, b) => distance(last, a) - distance(last, b))[0];
                }
            }
            else if (t.kind === 'railgun') {
                const d = distance(p, target);
                const dx = (target.x - p.x) / Math.max(.001, d), dz = (target.z - p.z) / Math.max(.001, d);
                const end = { x: p.x + dx * s.range, z: p.z + dz * s.range };
                this.emit('rail', p, end, TOWERS.railgun.color);
                for (const e of [...this.enemies]) {
                    if (intersectsShot(p,{x:dx,z:dz},e,s.range))
                        this.damage(e, s.damage, true);
                }
            }
            else {
                const projectile = this.projectilePool.pop() ?? {} as Projectile;
                Object.assign(projectile, { id: this.nextId++, kind: t.kind, target: target.id, x: p.x, z: p.z, damage: s.damage, splash: s.splash, life: 4 });
                this.projectiles.push(projectile);
                this.emit('shot', p, target, TOWERS[t.kind].color);
            }
        }
        for (const p of [...this.projectiles]) {
            p.life -= dt;
            let target = this.enemies.find(e => e.id === p.target);
            if (!target && p.kind === 'missile') {
                target = this.enemies.filter(e => distance(e, p) < 5).sort((a, b) => distance(a, p) - distance(b, p))[0];
                if (target)
                    p.target = target.id;
            }
            if (!target || p.life <= 0) {
                this.releaseProjectile(p);
                continue;
            }
            if (moveProjectile(p,target,p.kind==='laser'?35:13,dt)) {
                if (p.kind === 'missile') {
                    this.emit('explosion', target, target, TOWERS.missile.color, undefined, p.splash);
                    for (const e of [...this.enemies])
                        if (distance(e, target) <= p.splash)
                            this.damage(e, p.damage);
                }
                else
                    this.damage(target, p.damage);
                this.releaseProjectile(p);
            }
        }
        if (!this.enemies.length && !this.queue.length) {
            this.credits += waveReward(this.wave);
            this.projectilePool.push(...this.projectiles);
            this.projectiles = [];
            if (this.wave === 20) {
                this.phase = 'victory';
                this.notice = 'All threats eliminated. The city lives.';
            }
            else {
                this.phase = 'preparation';
                this.countdown = 15;
                this.notice = `Wave ${this.wave} cleared. +${waveReward(this.wave)} completion credits.`;
            }
            this.publish();
        }
    }
    private releaseProjectile(p: Projectile) { const i = this.projectiles.indexOf(p); if (i >= 0) {
        this.projectiles.splice(i, 1);
        this.projectilePool.push(p);
    } }
}
