import type {Vec} from './config.ts';

export const ROUTES: Vec[][] = [
    [{ x: -22, z: -12 }, { x: -12, z: -12 }, { x: -12, z: 0 }, { x: 0, z: 0 }, { x: 0, z: 10 }, { x: 13, z: 10 }],
    [{ x: 0, z: -22 }, { x: 0, z: -12 }, { x: -12, z: -12 }, { x: -12, z: 0 }, { x: 0, z: 0 }, { x: 0, z: 10 }, { x: 13, z: 10 }],
    [{ x: 22, z: -3 }, { x: 12, z: -3 }, { x: 12, z: 0 }, { x: 0, z: 0 }, { x: 0, z: 10 }, { x: 13, z: 10 }],
];
export const PADS: Vec[] = [
    { x: -16, z: -8 }, { x: -8, z: -8 }, { x: -16, z: -2 }, { x: -8, z: -3 },
    { x: -7, z: 4 }, { x: -3, z: -4 }, { x: 4, z: 4 }, { x: -4, z: 8 },
    { x: 4, z: 8 }, { x: 4, z: 14 }, { x: 9, z: 6 }, { x: 9, z: 14 },
    { x: -5, z: -16 }, { x: 4, z: -16 }, { x: 4, z: -8 }, { x: -8, z: -16 },
    { x: 8, z: -7 }, { x: 16, z: -7 }, { x: 16, z: 2 }, { x: 8, z: 3 },
    { x: -17, z: 5 }, { x: -12, z: 5 }, { x: -4, z: 14 }, { x: 16, z: 14 },
];
export const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z);
export const routeLength = (route: Vec[]) => route.slice(1).reduce((n, p, i) => n + distance(p, route[i]), 0);
export const LENGTHS = ROUTES.map(routeLength);
export function positionOnRoute(route: number, progress: number): Vec {
    const points = ROUTES[route];
    for (let i = 1; i < points.length; i++) {
        const length = distance(points[i - 1], points[i]);
        if (progress <= length) {
            const t = progress / length;
            return { x: points[i - 1].x + (points[i].x - points[i - 1].x) * t, z: points[i - 1].z + (points[i].z - points[i - 1].z) * t };
        }
        progress -= length;
    }
    return { ...points[points.length - 1] };
}
