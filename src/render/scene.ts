import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { TOWERS, ENEMIES } from '../game/config.ts';
import {PADS,ROUTES,positionOnRoute} from '../game/paths.ts';
import {towerStats} from '../game/economy.ts';
import type { TowerKind, Vec } from '../game/config.ts';
import { Game } from '../game/engine.ts';
import type { Effect, Enemy, Tower } from '../game/engine.ts';
import { AudioSystem } from '../game/audio.ts';
export type Settings = {
    quality: 'low' | 'medium' | 'high';
    volume: number;
    music: number;
    reducedMotion: boolean;
    damageNumbers: boolean;
};
const UP = new THREE.Vector3(0, 1, 0);
export class Battlefield {
    readonly scene = new THREE.Scene();
    readonly camera = new THREE.OrthographicCamera(-35, 35, 25, -25, .1, 220);
    readonly renderer: THREE.WebGLRenderer;
    private composer: EffectComposer;
    private bloom: UnrealBloomPass;
    private sun = new THREE.DirectionalLight('#a4c9ff', 3);
    private root = new THREE.Group();
    private clock = new THREE.Clock();
    private frame = 0;
    private observer: ResizeObserver;
    private geometries = new Map<string, THREE.BufferGeometry>();
    private materials = new Map<string, THREE.Material>();
    private textures: THREE.Texture[] = [];
    private padMeshes: THREE.Mesh[] = [];
    private enemyModels = new Map<number, THREE.Group>();
    private towerModels = new Map<number, THREE.Group>();
    private projectileModels = new Map<number, THREE.Mesh>();
    private projectileMeshes: THREE.Mesh[] = [];
    private rings: THREE.Mesh[] = [];
    private ads: THREE.Mesh[] = [];
    private reactor = new THREE.Group();
    private range: THREE.Mesh;
    private rangeFill: THREE.Mesh;
    private preview = new THREE.Group();
    private hoverKind: TowerKind = 'laser';
    private hovered = -1;
    private raycaster = new THREE.Raycaster();
    private pointer = new THREE.Vector2();
    private aim = new THREE.Vector3(-1, 0, -2);
    private smoothAim = this.aim.clone();
    private yaw = .69;
    private smoothYaw = .69;
    private zoom = 1;
    private smoothZoom = 1;
    private keys = new Set<string>();
    private drag: {
        x: number;
        y: number;
        button: number;
        distance: number;
    } | null = null;
    private particles: THREE.InstancedMesh;
    private particleData: {
        x: number;
        y: number;
        z: number;
        vx: number;
        vy: number;
        vz: number;
        life: number;
        max: number;
        color: THREE.Color;
        size: number;
    }[] = [];
    private dummy = new THREE.Object3D();
    private beams: {
        mesh: THREE.Mesh;
        life: number;
        max: number;
    }[] = [];
    private beamPool: THREE.Mesh[] = [];
    private floats: {
        element: HTMLSpanElement;
        pos: THREE.Vector3;
        life: number;
    }[] = [];
    private floatPool: HTMLSpanElement[] = [];
    private rain: THREE.Points;
    private visualTime = 0;
    private shake = 0;
    private flyover = 0;
    private disposed = false;
    private settings: Settings;
    private minimap: HTMLCanvasElement | null = null;
    private onError: (message: string) => void;
    constructor(private host: HTMLElement, readonly game: Game, readonly audio: AudioSystem, settings: Settings, onError: (message: string) => void) {
        this.settings = settings;
        this.onError = onError;
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
        this.renderer.setClearColor('#060c17');
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.35;
        this.renderer.domElement.setAttribute('aria-label', '3D battlefield. Click a glowing hexagonal build site to construct a tower.');
        this.renderer.domElement.tabIndex = 0;
        host.appendChild(this.renderer.domElement);
        this.scene.fog = new THREE.FogExp2('#080f21', .009);
        this.scene.add(this.root);
        this.scene.add(new THREE.HemisphereLight('#a3c9ff', '#171b32', 2));
        this.sun.position.set(10, 35, 12);
        this.sun.castShadow = true;
        this.sun.shadow.mapSize.set(1024, 1024);
        Object.assign(this.sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 100 });
        this.sun.shadow.bias = -.001;
        this.sun.shadow.normalBias = .03;
        this.scene.add(this.sun);
        const rim = new THREE.DirectionalLight('#ae4cff', 2);
        rim.position.set(-15, 12, -20);
        this.scene.add(rim);
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .5, .6, .85);
        this.composer.addPass(this.bloom);
        this.composer.addPass(new OutputPass());
        this.buildWorld();
        this.range = this.mesh('ring', this.basic('#5fffd6', .12));
        this.range.rotation.x = -Math.PI / 2;
        this.range.position.y = .73;
        this.range.visible = false;
        this.rangeFill = new THREE.Mesh(new THREE.CircleGeometry(1, 72), this.basic('#61ffe2', .035));
        this.geometries.set('rangeFill', this.rangeFill.geometry);
        this.rangeFill.rotation.x = -Math.PI / 2;
        this.rangeFill.position.y = .72;
        this.rangeFill.visible = false;
        this.root.add(this.range, this.rangeFill, this.preview);
        this.mesh('hex', this.basic('#61ffe2', .22), this.preview, 0, .15, 0, .9, .3, .9);
        this.mesh('cylinder', this.basic('#61ffe2', .22), this.preview, 0, .65, 0, .3, 1, .3);
        this.mesh('box', this.basic('#61ffe2', .22), this.preview, 0, 1.2, .35, .7, .4, 1.2);
        this.preview.visible = false;
        this.particles = new THREE.InstancedMesh(this.geometry('sphere'), this.basic('#ffffff'), 600);
        this.particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.particles.frustumCulled = false;
        this.particles.count = 0;
        this.root.add(this.particles);
        const rainGeometry = new THREE.BufferGeometry();
        const points = new Float32Array(480 * 3);
        for (let i = 0; i < 480; i++) {
            points[i * 3] = (Math.random() - .5) * 75;
            points[i * 3 + 1] = Math.random() * 32;
            points[i * 3 + 2] = (Math.random() - .5) * 65;
        }
        rainGeometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
        this.geometries.set('rain', rainGeometry);
        const rainMaterial = new THREE.PointsMaterial({ color: '#86a5d7', size: .065, transparent: true, opacity: .35, depthWrite: false });
        this.materials.set('rain', rainMaterial);
        this.rain = new THREE.Points(rainGeometry, rainMaterial);
        this.root.add(this.rain);
        this.observer = new ResizeObserver(() => this.resize());
        this.observer.observe(host);
        this.bind();
        this.applySettings(settings);
        this.resize();
        this.animate();
    }
    private geometry(kind: string) { let g = this.geometries.get(kind); if (!g) {
        g = kind === 'box' ? new THREE.BoxGeometry(1, 1, 1) : kind === 'sphere' ? new THREE.IcosahedronGeometry(1, 1) : kind === 'cylinder' ? new THREE.CylinderGeometry(1, 1, 1, 12) : kind === 'hex' ? new THREE.CylinderGeometry(1, 1, 1, 6) : kind === 'cone' ? new THREE.ConeGeometry(1, 1, 8) : kind === 'torus' ? new THREE.TorusGeometry(1, .035, 5, 48) : kind === 'ring' ? new THREE.RingGeometry(.97, 1, 72) : new THREE.PlaneGeometry(1, 1);
        this.geometries.set(kind, g);
    } return g; }
    private basic(color: string, opacity = 1) { const key = `b${color}${opacity}`; let m = this.materials.get(key); if (!m) {
        m = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, side: THREE.DoubleSide, depthWrite: opacity === 1 });
        if(opacity===1)(m as THREE.MeshBasicMaterial).color.multiplyScalar(1.5);
        this.materials.set(key, m);
    } return m; }
    private metal(color = '#172535', emissive = '#000000', intensity = 0) { const key = `m${color}${emissive}${intensity}`; let m = this.materials.get(key); if (!m) {
        m = new THREE.MeshStandardMaterial({ color, metalness: .65, roughness: .45, emissive, emissiveIntensity: intensity });
        this.materials.set(key, m);
    } return m; }
    private mesh(kind: string, material: THREE.Material, parent?: THREE.Object3D, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) { const m = new THREE.Mesh(this.geometry(kind), material); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = material instanceof THREE.MeshStandardMaterial; m.receiveShadow = material instanceof THREE.MeshStandardMaterial; parent?.add(m); return m; }
    private box(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, color: string, glow = false) { return this.mesh('box', glow ? this.basic(color) : this.metal(color), parent, x, y, z, w, h, d); }
    private sign(text: string, sub: string, width: number, height: number, color: string) { const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 160; const c = canvas.getContext('2d')!; c.fillStyle = '#081621'; c.fillRect(0, 0, 512, 160); c.strokeStyle = color; c.lineWidth = 5; c.strokeRect(5, 5, 502, 150); c.fillStyle = color; c.font = 'bold 60px sans-serif'; c.textAlign = 'center'; c.fillText(text, 256, 81); c.font = '18px monospace'; c.fillText(sub, 256, 122); const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; this.textures.push(texture); const mat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }); this.materials.set(`sign${this.textures.length}`, mat); const m = this.mesh('plane', mat, undefined, 0, 0, 0, width, height, 1); this.ads.push(m); return m; }
    private buildWorld() {
        this.box(this.root, 0, -1.1, 0, 51, 2, 43, '#0c1420');
        this.box(this.root, 0, -.03, 0, 50, .2, 42, '#101e2a');
        const grid = new THREE.GridHelper(50, 50, '#253d48', '#172f3c');
        grid.position.y = .09;
        this.root.add(grid);
        this.geometries.set('grid', grid.geometry);
        if (Array.isArray(grid.material))
            grid.material.forEach((m, i) => this.materials.set(`grid${i}`, m));
        else
            this.materials.set('grid', grid.material);
        for (const x of [-25, 25])
            this.box(this.root, x, -.35, 0, .06, .12, 43, '#337c94', true);
        for (const z of [-21, 21])
            this.box(this.root, 0, -.35, z, 50, .12, .06, '#286478', true);
        const segments = new Set<string>();
        for (const route of ROUTES)
            for (let i = 1; i < route.length; i++) {
                const a = route[i - 1], b = route[i];
                const key = [`${a.x},${a.z}`, `${b.x},${b.z}`].sort().join('|');
                if (segments.has(key))
                    continue;
                segments.add(key);
                const horizontal = a.z === b.z;
                const length = Math.hypot(a.x - b.x, a.z - b.z);
                const x = (a.x + b.x) / 2, z = (a.z + b.z) / 2;
                this.box(this.root, x, .3, z, horizontal ? length + 2.2 : 2.2, .55, horizontal ? 2.2 : length + 2.2, '#283642');
                this.box(this.root, x, .595, z, horizontal ? length + 2.2 : 2.2, .04, horizontal ? 2.2 : length + 2.2, '#182b35');
                for (const side of [-1, 1])
                    this.box(this.root, x + (horizontal ? 0 : side * 1.03), .65, z + (horizontal ? side * 1.03 : 0), horizontal ? length : .04, .04, horizontal ? .04 : length, '#35918e', true);
                for (let d = 1; d < length; d += 2) {
                    const t = d / length;
                    this.box(this.root, a.x + (b.x - a.x) * t, .66, a.z + (b.z - a.z) * t, horizontal ? .65 : .06, .015, horizontal ? .06 : .65, '#709486', true);
                }
                for (let d = 3; d < length; d += 7) {
                    const t = d / length;
                    this.box(this.root, a.x + (b.x - a.x) * t, -.1, a.z + (b.z - a.z) * t, 1.2, .6, 1.2, '#344453');
                }
            }
        for (let i = 0; i < PADS.length; i++) {
            const p = PADS[i];
            this.mesh('hex', this.metal('#1d3541'), this.root, p.x, .31, p.z, 1.45, .5, 1.45);
            const pad = this.mesh('hex', this.metal('#24454b', '#33af9a', .12), this.root, p.x, .59, p.z, 1.23, .1, 1.23);
            pad.userData.pad = i;
            this.padMeshes.push(pad);
            const ring = this.mesh('torus', this.basic('#51b5a6', .7), this.root, p.x, .68, p.z, 1.12, 1.12, 1.12);
            ring.rotation.x = Math.PI / 2;
            this.rings.push(ring);
            this.box(this.root, p.x, .67, p.z, .55, .015, .06, '#76d4bc', true);
            this.box(this.root, p.x, .67, p.z, .06, .015, .55, '#76d4bc', true);
        }
        ROUTES.forEach((r, i) => { const p = r[0]; const g = new THREE.Group(); g.position.set(p.x, .65, p.z); this.root.add(g); this.box(g, -1.5, 1.5, 0, .3, 3, .45, '#263545'); this.box(g, 1.5, 1.5, 0, .3, 3, .45, '#263545'); this.box(g, 0, 3, 0, 3.3, .3, .45, '#ff506d', true); const sign = this.sign(`0${i + 1}`, 'HOSTILE INGRESS', 3.7, 1.2, '#ff6680'); sign.position.set(0, 4.25, 0); g.add(sign); });
        this.reactor.position.set(13, .6, 10);
        this.root.add(this.reactor);
        this.mesh('hex', this.metal('#344552'), this.reactor, 0, .1, 0, 2.8, .5, 2.8);
        this.mesh('cylinder', this.metal('#192d3d'), this.reactor, 0, 1.4, 0, 1.55, 2.5, 1.55);
        this.mesh('cylinder', this.basic('#91ffdf'), this.reactor, 0, 2.1, 0, .83, 3.6, .83);
        this.mesh('cone', this.basic('#d7ffea'), this.reactor, 0, 4.3, 0, .75, 1, .75);
        for (let i = 0; i < 4; i++) {
            const a = i * Math.PI / 2;
            this.box(this.reactor, Math.cos(a) * 1.5, 2, Math.sin(a) * 1.5, .4, 3.4, .4, '#344858');
        }
        for (let i = 0; i < 3; i++) {
            const ring = this.mesh('torus', this.basic('#73ffd7'), this.reactor, 0, .7 + i * 1.35, 0, 1.8, 1.8, 1.8);
            ring.rotation.x = Math.PI / 2;
        }
        const halo = this.mesh('ring', this.basic('#68ffd7', .4), this.reactor, 0, .14, 0, 3.6, 3.6, 3.6);
        halo.rotation.x = -Math.PI / 2;
        const light = new THREE.PointLight('#60ffd7', 35, 12, 2);
        light.position.set(13, 4, 10);
        this.root.add(light);
        // Seeded city blocks keep the skyline consistent across sessions.
        let seed = 97;
        const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
        const lots: Vec[] = [];
        for (let x = -28; x <= 28; x += 5.5) {
            lots.push({ x, z: -26 }, { x, z: 26 });
        }
        for (let z = -17; z < 24; z += 6) {
            lots.push({ x: -30, z }, { x: 30, z });
        }
        lots.push({ x: -21, z: 11 }, { x: -15, z: 14 }, { x: 20, z: -15 }, { x: 11, z: -16 }, { x: -20, z: -18 });
        const city = new THREE.Group();
        this.root.add(city);
        lots.forEach((p, i) => {
            const h = 4 + random() * 13, w = 2.8 + random() * 1.6, d = 2.8 + random() * 1.6;
            const g = new THREE.Group();
            g.position.set(p.x, 0, p.z);
            city.add(g);
            const color = i % 3 === 0 ? '#a45cff' : i % 3 === 1 ? '#4ac7df' : '#f163ad';
            this.box(g, 0, h / 2, 0, w, h, d, i % 2 ? '#12202f' : '#1c273c');
            this.box(g, 0, h + .15, 0, w + .2, .3, d + .2, '#24374a');
            this.box(g, w / 2 + .01, h / 2, 0, .035, h, .05, color, true);
            for (let y = 1; y < h - .5; y += .8) {
                for (let xx = -w / 2 + .35; xx < w / 2; xx += .65) {
                    if (random() > .27)
                        this.box(g, xx, y, d / 2 + .012, .25, .3, .018, random() > .3 ? '#36677e' : color, true);
                }
                for (let zz = -d / 2 + .35; zz < d / 2; zz += .65) {
                    if (random() > .35)
                        this.box(g, w / 2 + .012, y, zz, .018, .3, .25, random() > .3 ? '#355971' : color, true);
                }
            }
            this.box(g, 0, h + .8, 0, .08, 1.4, .08, color, true);
            if (i % 4 === 0) {
                const sign = this.sign(['NOVA', '新世界', 'NEON', '未来'][i / 4 % 4 | 0], 'THE FUTURE IS ELECTRIC', w * 1.4, 1.8, color);
                sign.position.set(0, h * .65, d / 2 + .08);
                g.add(sign);
            }
        });
        this.batchStatic(city);
        // Utility cabinets and light pylons add scale without hiding the build sites.
        for (const [x, z] of [[-20, 2], [-10, 10], [6, -12], [19, 7], [-4, -20], [20, -11]]) {
            this.box(this.root, x, .5, z, 1.2, 1, 1.3, '#253848');
            this.box(this.root, x, .95, z, 1.1, .1, .7, '#527887');
            this.box(this.root, x + .8, 2, z, .08, 4, .08, '#567381');
            this.box(this.root, x + .8, 4, z, .4, .12, .4, '#85c8ff', true);
        }
    }
    private batchStatic(group: THREE.Group) {
        group.updateMatrixWorld(true);
        const batches = new Map<string, {
            geometry: THREE.BufferGeometry;
            material: THREE.Material;
            meshes: THREE.Mesh[];
        }>();
        group.traverse(object => { if (!(object instanceof THREE.Mesh) || this.ads.includes(object))
            return; const material = object.material as THREE.Material, key = object.geometry.uuid + material.uuid; let batch = batches.get(key); if (!batch) {
            batch = { geometry: object.geometry, material, meshes: [] };
            batches.set(key, batch);
        } batch.meshes.push(object); });
        for (const batch of batches.values()) {
            const instances = new THREE.InstancedMesh(batch.geometry, batch.material, batch.meshes.length);
            batch.meshes.forEach((mesh, index) => { instances.setMatrixAt(index, mesh.matrixWorld); mesh.removeFromParent(); });
            instances.castShadow = true;
            instances.receiveShadow = true;
            this.root.add(instances);
        }
    }
    private makeTower(t: Tower) {
        const g = new THREE.Group(), p = PADS[t.pad], c = TOWERS[t.kind].color;
        g.position.set(p.x, .7, p.z);
        this.mesh('hex', this.metal('#304957'), g, 0, .25, 0, 1, .5, 1);
        this.mesh('cylinder', this.metal('#172735'), g, 0, .75, 0, .55, .7, .55);
        const head = new THREE.Group();
        head.position.y = 1.15;
        g.add(head);
        g.userData.pad = t.pad;
        g.userData.head = head;
        g.userData.level = t.level;
        if (t.kind === 'laser') {
            this.box(head, 0, .2, 0, .9, .6, 1.1, '#3d6471');
            this.box(head, 0, .2, .85, .22, .22, 1.3, c, true);
            this.box(head, -.38, .35, -.2, .12, .12, .55, c, true);
        }
        if (t.kind === 'missile') {
            for (const x of [-.48, .48]) {
                this.box(head, x, .3, 0, .7, .9, 1.2, '#52616b');
                for (const y of [.1, .5])
                    this.mesh('sphere', this.basic(c), head, x, y, .66, .16, .16, .08);
            }
        }
        if (t.kind === 'tesla') {
            this.mesh('cylinder', this.metal('#6d6585'), head, 0, .65, 0, .18, 1.5, .18);
            for (let i = 0; i < 3; i++) {
                const r = this.mesh('torus', this.basic(c), head, 0, .25 + i * .45, 0, .65 - i * .1, .65 - i * .1, .65 - i * .1);
                r.rotation.x = Math.PI / 2;
            }
            this.mesh('sphere', this.basic(c), head, 0, 1.5, 0, .3, .3, .3);
        }
        if (t.kind === 'railgun') {
            this.box(head, 0, .15, 0, 1, .6, 1.2, '#514e6c');
            for (const x of [-.22, .22])
                this.box(head, x, .28, 1, .13, .18, 2, c, true);
            this.box(head, 0, .2, -.5, .65, .9, .35, '#9f5d88');
        }
        if (t.kind === 'cryo') {
            this.mesh('sphere', this.metal('#4a80a4', c, 1), head, 0, .5, 0, .55, .8, .55);
            for (let i = 0; i < 3; i++) {
                const ring = this.mesh('torus', this.basic(c), head, 0, .5, 0, .85, .85, .85);
                ring.rotation.set(i * Math.PI / 3, 0, i * Math.PI / 3);
            }
        }
        for (let i = 0; i < t.level; i++)
            this.box(g, -.5 + i * .5, .52, -.7, .18, .12, .13, c, true);
        this.root.add(g);
        this.towerModels.set(t.id, g);
        return g;
    }
    private makeEnemy(e: Enemy) {
        const g = new THREE.Group(), c = ENEMIES[e.kind].color;
        const body = new THREE.Group();
        g.add(body);
        g.userData.body = body;
        if (e.kind === 'scout') {
            this.mesh('sphere', this.metal('#694254'), body, 0, .75, 0, .4, .23, .5);
            for (const x of [-.5, .5]) {
                this.box(body, x, .72, 0, .5, .08, .15, '#aa667f');
                this.mesh('sphere', this.basic(c), body, x, .7, 0, .11, .07, .11);
            }
            this.box(body, 0, .75, .42, .3, .08, .04, c, true);
        }
        else if (e.kind === 'shield') {
            this.mesh('cone', this.metal('#625179'), body, 0, 1, 0, .5, .8, .5);
            this.mesh('sphere', this.basic('#b693ff', .17), body, 0, 1, 0, .85, .85, .85).name = 'shield';
            this.mesh('sphere', this.basic(c), body, 0, 1, 0, .2, .2, .2);
        }
        else {
            const boss = e.kind === 'boss', heavy = e.kind === 'heavy';
            const s = boss ? 2 : heavy ? 1.3 : 1;
            this.box(body, 0, .95, 0, .7 * s, .75 * s, .65 * s, heavy ? '#75604b' : '#62374a');
            this.box(body, 0, 1.5 * s, 0, .5 * s, .4 * s, .5 * s, '#584253');
            this.box(body, 0, 1.52 * s, .27 * s, .36 * s, .1 * s, .05, c, true);
            for (const side of [-1, 1]) {
                const leg = this.box(body, side * .27 * s, .35, 0, .22 * s, .65, .28 * s, '#3d4251');
                leg.name = `leg${side}`;
                this.box(body, side * .55 * s, .9 * s, 0, .3 * s, .6 * s, .4 * s, '#5d5361');
            }
            if (boss) {
                this.box(body, 0, 2.4, -.2, 1.8, .35, .8, '#992d52');
                this.mesh('sphere', this.basic(c), body, 0, 1.6, .7, .25, .25, .15);
            }
        }
        const frozen = this.mesh('torus', this.basic('#9bdeff', .6), g, 0, .08, 0, .8, .8, .8);
        frozen.rotation.x = Math.PI / 2;
        frozen.name = 'frozen';
        frozen.visible = false;
        const bar = new THREE.Group();
        bar.position.y = e.kind === 'boss' ? 3.8 : 2.15;
        this.mesh('plane', this.basic('#0d1420'), bar, 0, 0, 0, 1.1, .13, 1);
        const hp = this.mesh('plane', this.basic(c), bar, 0, 0, .005, 1, .08, 1);
        g.userData.hp = hp;
        if (e.maxShield) {
            const shield = this.mesh('plane', this.basic('#ba9bff'), bar, 0, .14, .005, 1, .05, 1);
            g.userData.shield = shield;
        }
        g.add(bar);
        g.userData.bar = bar;
        this.root.add(g);
        this.enemyModels.set(e.id, g);
        return g;
    }
    private syncEntities() {
        const liveTowers = new Set(this.game.towers.map(t => t.id));
        for (const [id, g] of this.towerModels)
            if (!liveTowers.has(id)) {
                this.root.remove(g);
                this.towerModels.delete(id);
            }
        for (const t of this.game.towers) {
            let g = this.towerModels.get(t.id);
            if (g && g.userData.level !== t.level) {
                this.root.remove(g);
                this.towerModels.delete(t.id);
                g = undefined;
            }
            g ??= this.makeTower(t);
            g.userData.head.rotation.y = t.angle;
            g.visible = t.disabledUntil <= this.game.time || Math.sin(this.visualTime * 15) > 0;
        }
        const liveEnemies = new Set(this.game.enemies.map(e => e.id));
        for (const [id, g] of this.enemyModels)
            if (!liveEnemies.has(id)) {
                this.root.remove(g);
                this.enemyModels.delete(id);
            }
        for (const e of this.game.enemies) {
            const g = this.enemyModels.get(e.id) ?? this.makeEnemy(e);
            g.position.set(e.x, .7, e.z);
            const next = positionOnRoute(e.route, e.progress + .1);
            const body = g.userData.body as THREE.Group;
            body.rotation.y = Math.atan2(next.x - e.x, next.z - e.z);
            body.position.y = Math.sin(this.game.time * 9 + e.id) * .07;
            for (const side of [-1, 1]) {
                const leg = body.getObjectByName(`leg${side}`);
                if (leg)
                    leg.rotation.x = Math.sin(this.game.time * 10 + e.id) * .4 * side;
            }
            g.userData.bar.quaternion.copy(this.camera.quaternion);
            g.userData.hp.scale.x = Math.max(0, e.hp / e.maxHp);
            if (g.userData.shield)
                g.userData.shield.scale.x = e.shield / e.maxShield;
            const bubble = body.getObjectByName('shield');
            if (bubble)
                bubble.visible = e.shield > 0;
            const frozen = g.getObjectByName('frozen');
            if (frozen)
                frozen.visible = e.slowUntil > this.game.time;
            body.scale.setScalar(e.slowUntil > this.game.time ? 1 + Math.sin(this.visualTime * 15) * .015 : 1);
        }
        const liveProjectiles = new Set(this.game.projectiles.map(p => p.id));
        for (const [id, m] of this.projectileModels)
            if (!liveProjectiles.has(id)) {
                this.root.remove(m);
                this.projectileModels.delete(id);
                this.projectileMeshes.push(m);
            }
        for (const p of this.game.projectiles) {
            let m = this.projectileModels.get(p.id);
            if (!m) {
                m = this.projectileMeshes.pop() ?? this.mesh('sphere', this.basic(TOWERS[p.kind].color));
                m.material = this.basic(TOWERS[p.kind].color);
                m.scale.setScalar(p.kind === 'missile' ? .16 : .08);
                this.root.add(m);
                this.projectileModels.set(p.id, m);
            }
            m.position.set(p.x, 1.6, p.z);
            if (p.kind === 'missile' && !this.game.paused && Math.random() > .55)
                this.particle(p.x, 1.5, p.z, '#7e95ac', .4, .14);
        }
        for (let i = 0; i < this.padMeshes.length; i++) {
            const occupied = this.game.towers.some(t => t.pad === i);
            const selected = this.game.selected === i;
            this.padMeshes[i].material = this.metal(selected ? '#46796d' : this.hovered === i ? '#365d61' : '#24454b', '#33af9a', selected ? .5 : .12);
            this.rings[i].visible = !occupied || selected;
            this.rings[i].scale.setScalar(selected ? 1.2 : 1.12);
        }
        const p = this.game.selected === null ? null : PADS[this.game.selected];
        this.range.visible = !!p && this.game.editable();
        this.rangeFill.visible = this.range.visible;
        this.preview.visible = false;
        if (p) {
            const t = this.game.towers.find(t => t.pad === this.game.selected);
            const stats = towerStats(t?.kind ?? this.hoverKind, t?.level ?? 0);
            this.range.position.set(p.x, .73, p.z);
            this.range.scale.setScalar(stats.range);
            this.rangeFill.position.set(p.x, .72, p.z);
            this.rangeFill.scale.setScalar(stats.range);
            this.range.material = this.basic(TOWERS[t?.kind ?? this.hoverKind].color, .3);
            this.preview.visible = !t && this.game.editable();
            this.preview.position.set(p.x, 1 + Math.sin(this.visualTime * 2) * .1, p.z);
            this.preview.children.forEach(child => { (child as THREE.Mesh).material = this.basic(TOWERS[this.hoverKind].color, .22); });
        }
    }
    private particle(x: number, y: number, z: number, color: string, life = .5, size = .1) { if (this.particleData.length >= 600)
        return; this.particleData.push({ x, y, z, vx: (Math.random() - .5) * 4, vy: Math.random() * 4, vz: (Math.random() - .5) * 4, life, max: life, color: new THREE.Color(color), size }); }
    private beam(a: Vec, b: Vec, color: string, width: number, life: number) { if (this.beams.length >= 160)
        return; const m = this.beamPool.pop() ?? this.mesh('cylinder', this.basic(color)); m.material = this.basic(color); const from = new THREE.Vector3(a.x, 1.7, a.z), to = new THREE.Vector3(b.x, 1.3, b.z), direction = to.clone().sub(from); m.position.copy(from).add(to).multiplyScalar(.5); m.scale.set(width, direction.length(), width); m.quaternion.setFromUnitVectors(UP, direction.normalize()); this.root.add(m); this.beams.push({ mesh: m, life, max: life }); }
    private showFloat(event: Effect) { if (!this.settings.damageNumbers || this.floats.length >= 36)
        return; if (event.type === 'hit' && (event.value ?? 0) < 3)
        return; const element = this.floatPool.pop() ?? document.createElement('span'); element.className = `float-number ${event.type === 'reward' ? 'reward' : ''}`; element.textContent = event.type === 'reward' ? `+${event.value} ◈` : `${event.value}`; element.style.color = event.color; this.host.appendChild(element); this.floats.push({ element, pos: new THREE.Vector3(event.to.x, 2.8, event.to.z), life: .85 }); }
    private events(events: Effect[]) { for (const e of events) {
        if (e.type === 'hit' || e.type === 'reward') {
            this.showFloat(e);
            continue;
        }
        if (e.type === 'chain') {
            const mid = { x: (e.from.x + e.to.x) / 2 + (Math.random() - .5), z: (e.from.z + e.to.z) / 2 + (Math.random() - .5) };
            this.beam(e.from, mid, e.color, .04, .16);
            this.beam(mid, e.to, e.color, .04, .16);
        }
        else if (e.type === 'rail')
            this.beam(e.from, e.to, e.color, .065, .25);
        else if (e.type === 'shot') {
            for (let i = 0; i < 2; i++)
                this.particle(e.from.x, 1.8, e.from.z, e.color, .15, .1);
        }
        else if (e.type === 'explosion' || e.type === 'breach') {
            for (let i = 0; i < (e.radius ?? 1) * 14; i++)
                this.particle(e.to.x, 1, e.to.z, e.color, .45 + Math.random() * .5, .1 + Math.random() * .15);
            if ((e.radius ?? 0) > 2)
                this.shake = .12;
        }
        else if (e.type === 'emp' || e.type === 'warning') {
            const radius = e.radius ?? 5;
            for (let i = 0; i < 36; i++) {
                const a = i / 36 * Math.PI * 2;
                this.particle(e.to.x + Math.cos(a) * radius, .8, e.to.z + Math.sin(a) * radius, e.color, e.type === 'warning' ? 1.5 : .5, .09);
            }
        }
    } }
    private animate = () => { if (this.disposed)
        return; this.frame = requestAnimationFrame(this.animate); const dt = Math.min(this.clock.getDelta(), .05); this.visualTime += dt; this.game.advance(dt); this.audio.active = this.game.editable() && !this.game.paused; this.audio.update(dt); const events = this.game.drainEffects(); this.audio.effects(events); this.events(events); this.updateCamera(dt); this.syncEntities(); this.updateEffects(this.game.paused ? 0 : dt); this.drawMinimap(); this.reactor.children.forEach((c, i) => { if (i > 7 && c instanceof THREE.Mesh)
        c.rotation.z += this.settings.reducedMotion ? 0 : dt * .2; }); this.ads.forEach((m, i) => { m.visible = this.settings.reducedMotion || Math.sin(this.visualTime * .7 + i) > .0 || Math.sin(this.visualTime * 9 + i) > -.95; }); this.renderer.info.autoReset = true; if (this.settings.quality === 'low')
        this.renderer.render(this.scene, this.camera);
    else
        this.composer.render(); };
    private updateEffects(dt: number) {
        for (let i = this.particleData.length - 1; i >= 0; i--) {
            const p = this.particleData[i];
            p.life -= dt;
            if (p.life <= 0) {
                this.particleData.splice(i, 1);
                continue;
            }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.z += p.vz * dt;
            p.vy -= 6 * dt;
            this.dummy.position.set(p.x, p.y, p.z);
            this.dummy.scale.setScalar(p.size * p.life / p.max);
            this.dummy.updateMatrix();
            this.particles.setMatrixAt(i, this.dummy.matrix);
            this.particles.setColorAt(i, p.color);
        }
        this.particles.count = this.particleData.length;
        this.particles.instanceMatrix.needsUpdate = true;
        if (this.particles.instanceColor)
            this.particles.instanceColor.needsUpdate = true;
        for (let i = this.beams.length - 1; i >= 0; i--) {
            const b = this.beams[i];
            b.life -= dt;
            if (b.life <= 0) {
                this.root.remove(b.mesh);
                this.beamPool.push(b.mesh);
                this.beams.splice(i, 1);
            }
        }
        for (let i = this.floats.length - 1; i >= 0; i--) {
            const f = this.floats[i];
            f.life -= dt;
            if (f.life <= 0) {
                f.element.remove();
                this.floatPool.push(f.element);
                this.floats.splice(i, 1);
                continue;
            }
            f.pos.y += dt;
            const p = f.pos.clone().project(this.camera);
            f.element.style.transform = `translate(${(p.x * .5 + .5) * this.host.clientWidth}px,${(-p.y * .5 + .5) * this.host.clientHeight}px)`;
            f.element.style.opacity = String(Math.min(1, f.life * 3));
        }
        if (!this.settings.reducedMotion && this.settings.quality !== 'low') {
            const a = this.rain.geometry.attributes.position;
            for (let i = 0; i < a.count; i++) {
                let y = a.getY(i) - dt * 13;
                if (y < 0)
                    y = 32;
                a.setY(i, y);
            }
            a.needsUpdate = true;
        }
    }
    private updateCamera(dt: number) { const speed = dt * 15 / this.zoom; const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)), right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); if (this.keys.has('w'))
        this.aim.addScaledVector(forward, speed); if (this.keys.has('s'))
        this.aim.addScaledVector(forward, -speed); if (this.keys.has('a'))
        this.aim.addScaledVector(right, -speed); if (this.keys.has('d'))
        this.aim.addScaledVector(right, speed); this.aim.x = THREE.MathUtils.clamp(this.aim.x, -18, 18); this.aim.z = THREE.MathUtils.clamp(this.aim.z, -16, 16); const smoothing = this.settings.reducedMotion ? 1 : 1 - Math.exp(-dt * 8); this.smoothAim.lerp(this.aim, smoothing); this.smoothYaw += (this.yaw - this.smoothYaw) * smoothing; this.smoothZoom += (this.zoom - this.smoothZoom) * smoothing; this.flyover = Math.max(0, this.flyover - dt); const angle = this.smoothYaw + (this.settings.reducedMotion ? 0 : this.flyover * .14); const shake = this.settings.reducedMotion ? 0 : this.shake; this.shake = Math.max(0, this.shake - dt); this.camera.position.set(this.smoothAim.x + Math.sin(angle) * 48 + (Math.random() - .5) * shake, this.smoothAim.y + 43 + this.flyover * 3, this.smoothAim.z + Math.cos(angle) * 48); this.camera.lookAt(this.smoothAim); this.camera.zoom = this.smoothZoom; this.camera.updateProjectionMatrix(); }
    private resize() { const w = this.host.clientWidth, h = this.host.clientHeight; this.renderer.setSize(w, h); this.composer.setSize(w, h); const aspect = w / h; this.camera.left = -28 * aspect; this.camera.right = 28 * aspect; this.camera.top = 28; this.camera.bottom = -28; this.camera.updateProjectionMatrix(); }
    private hit(event: PointerEvent) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const hits = this.raycaster.intersectObjects([...this.padMeshes, ...this.towerModels.values()], true);
        let object: THREE.Object3D | null = hits[0]?.object ?? null;
        while(object) {
            if(typeof object.userData.pad === 'number') return object.userData.pad as number;
            object = object.parent;
        }
        return undefined;
    }
    private down = (e: PointerEvent) => { this.audio.unlock(); this.renderer.domElement.focus({ preventScroll: true }); this.drag = { x: e.clientX, y: e.clientY, button: e.button, distance: 0 }; this.renderer.domElement.setPointerCapture(e.pointerId); };
    private move = (e: PointerEvent) => { if (this.drag) {
        const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
        this.drag.distance += Math.abs(dx) + Math.abs(dy);
        if (this.drag.button === 2)
            this.yaw -= dx * .006;
        this.drag.x = e.clientX;
        this.drag.y = e.clientY;
    }
    else {
        this.hovered = this.hit(e) ?? -1;
        this.renderer.domElement.style.cursor = this.hovered >= 0 ? 'pointer' : 'grab';
    } };
    private up = (e: PointerEvent) => { const drag = this.drag; this.drag = null; if (!drag || drag.distance > 6)
        return; if (e.button === 2)
        this.game.select(null);
    else if (e.button === 0 && this.game.editable())
        this.game.select(this.hit(e) ?? null); };
    private wheel = (e: WheelEvent) => { e.preventDefault(); this.zoom = THREE.MathUtils.clamp(this.zoom * Math.exp(-e.deltaY * .001), .65, 1.9); };
    private context = (e: Event) => e.preventDefault();
    private keyDown = (e: KeyboardEvent) => { if ((e.target as HTMLElement)?.matches('input,select,textarea'))
        return; const key = e.key.toLowerCase(); if (['w', 'a', 's', 'd'].includes(key)) {
        e.preventDefault();
        this.keys.add(key);
    } if (key === 'escape') {
        if (this.game.selected !== null)
            this.game.select(null);
        else
            this.game.togglePause();
    } if (key === ' ' && !(e.target as HTMLElement)?.matches('button')) {
        e.preventDefault();
        this.game.phase === 'preparation' ? this.game.startWave() : this.game.togglePause();
    } if (['1', '2', '3'].includes(key))
        this.game.setSpeed(Number(key)); if (key === 'home')
        this.resetCamera(); };
    private keyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
    private blur = () => { this.keys.clear(); this.drag = null; if (this.game.phase === 'combat' && !this.game.paused)
        this.game.togglePause(); };
    private lostContext = (e: Event) => { e.preventDefault(); if (this.game.editable() && !this.game.paused)
        this.game.togglePause(); this.onError('The graphics context was interrupted. Reload to restore the battlefield.'); };
    private bind() { const c = this.renderer.domElement; c.addEventListener('pointerdown', this.down); c.addEventListener('pointermove', this.move); c.addEventListener('pointerup', this.up); c.addEventListener('wheel', this.wheel, { passive: false }); c.addEventListener('contextmenu', this.context); c.addEventListener('webglcontextlost', this.lostContext); window.addEventListener('keydown', this.keyDown); window.addEventListener('keyup', this.keyUp); window.addEventListener('blur', this.blur); }
    resetCamera() { this.aim.set(-1, 0, -2); this.yaw = .69; this.zoom = 1; }
    startFlyover() { this.flyover = 2; this.resetCamera(); }
    skipFlyover() { this.flyover = 0; }
    setPreview(kind: TowerKind) { this.hoverKind = kind; }
    setMinimap(canvas: HTMLCanvasElement | null) { this.minimap = canvas; }
    applySettings(settings: Settings) { this.settings = settings; this.renderer.shadowMap.enabled = settings.quality !== 'low'; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; this.audio.volume = settings.volume; this.audio.music = settings.music; this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.quality === 'high' ? 2 : settings.quality === 'medium' ? 1.5 : 1)); this.bloom.strength = settings.quality === 'high' ? .55 : .38; this.rain.visible = settings.quality !== 'low' && !settings.reducedMotion; this.resize(); }
    private drawMinimap() { const canvas = this.minimap; if (!canvas)
        return; const c = canvas.getContext('2d')!; const w = canvas.width, h = canvas.height; const x = (v: number) => (v + 25) / 50 * w, z = (v: number) => (v + 23) / 46 * h; c.clearRect(0, 0, w, h); c.lineWidth = 3; c.strokeStyle = '#335662'; for (const route of ROUTES) {
        c.beginPath();
        route.forEach((p, i) => i ? c.lineTo(x(p.x), z(p.z)) : c.moveTo(x(p.x), z(p.z)));
        c.stroke();
    } for (const p of PADS) {
        c.fillStyle = '#355064';
        c.fillRect(x(p.x) - 1, z(p.z) - 1, 2, 2);
    } for (const t of this.game.towers) {
        const p = PADS[t.pad];
        c.fillStyle = TOWERS[t.kind].color;
        c.fillRect(x(p.x) - 2, z(p.z) - 2, 4, 4);
    } for (const e of this.game.enemies) {
        c.fillStyle = ENEMIES[e.kind].color;
        c.beginPath();
        c.arc(x(e.x), z(e.z), e.kind === 'boss' ? 4 : 2, 0, Math.PI * 2);
        c.fill();
    } c.fillStyle = '#9affd9'; c.fillRect(x(13) - 3, z(10) - 3, 6, 6); }
    dispose() { this.disposed = true; cancelAnimationFrame(this.frame); this.observer.disconnect(); const c = this.renderer.domElement; c.removeEventListener('pointerdown', this.down); c.removeEventListener('pointermove', this.move); c.removeEventListener('pointerup', this.up); c.removeEventListener('wheel', this.wheel); c.removeEventListener('contextmenu', this.context); c.removeEventListener('webglcontextlost', this.lostContext); window.removeEventListener('keydown', this.keyDown); window.removeEventListener('keyup', this.keyUp); window.removeEventListener('blur', this.blur); this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); this.textures.forEach(t => t.dispose()); this.composer.dispose(); this.renderer.dispose(); c.remove(); this.floats.forEach(f => f.element.remove()); }
}
