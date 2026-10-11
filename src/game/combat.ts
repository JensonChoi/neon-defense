import type {Vec} from './config.ts';
import {distance,LENGTHS} from './paths.ts';

export type PathTarget = Vec & {route:number;progress:number};

/** Target the earliest breach, rather than the enemy nearest the gun. */
export function targetsInRange<T extends PathTarget>(enemies:T[],origin:Vec,range:number):T[] {
 return enemies.filter(enemy=>distance(origin,enemy)<=range)
  .sort((a,b)=>(LENGTHS[a.route]-a.progress)-(LENGTHS[b.route]-b.progress));
}

export function damageAfterShield(amount:number,shield:number,armor:number,ignoreArmor=false) {
 const shieldHit=Math.min(shield,amount);
 return {shieldHit,healthHit:(amount-shieldHit)*(ignoreArmor?1:1-armor)};
}

/** Finite forward ray: no hits behind the muzzle or outside its lateral width. */
export function intersectsShot(origin:Vec,direction:Vec,target:Vec,range:number,width=.6) {
 const x=target.x-origin.x,z=target.z-origin.z;
 const along=x*direction.x+z*direction.z;
 return along>=0 && along<=range && Math.abs(x*direction.z-z*direction.x)<width;
}
