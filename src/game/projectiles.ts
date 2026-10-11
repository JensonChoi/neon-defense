import type {Vec} from './config.ts';
import {distance} from './paths.ts';

/** Move a homing projectile without overshooting. True signals an impact this tick. */
export function moveProjectile(projectile:Vec,target:Vec,speed:number,dt:number):boolean {
 const separation=distance(projectile,target);
 const travel=speed*dt;
 if(separation<=travel+.15)return true;
 projectile.x+=(target.x-projectile.x)/separation*travel;
 projectile.z+=(target.z-projectile.z)/separation*travel;
 return false;
}
