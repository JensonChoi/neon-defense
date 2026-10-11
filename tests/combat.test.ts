import {test} from 'node:test';
import assert from 'node:assert/strict';
import {intersectsShot,targetsInRange} from '../src/game/combat.ts';
import {moveProjectile} from '../src/game/projectiles.ts';

test('rail ray rejects enemies behind, outside range, or off axis',()=>{
 const origin={x:0,z:0},direction={x:1,z:0};
 assert.equal(intersectsShot(origin,direction,{x:5,z:.3},10),true);
 assert.equal(intersectsShot(origin,direction,{x:5,z:.8},10),false);
 assert.equal(intersectsShot(origin,direction,{x:-1,z:0},10),false);
 assert.equal(intersectsShot(origin,direction,{x:11,z:0},10),false);
});
test('target priority compares distance remaining across different entrances',()=>{
 const nearTower={id:1,x:0,z:0,route:1,progress:30};
 const nearExit={id:2,x:3,z:0,route:2,progress:30};
 assert.equal(targetsInRange([nearTower,nearExit],{x:0,z:0},6)[0].id,2);
});
test('projectiles travel at their configured speed and cannot overshoot',()=>{
 const p={x:0,z:0},target={x:3,z:4};
 assert.equal(moveProjectile(p,target,10,.1),false);
 assert.ok(Math.abs(Math.hypot(p.x,p.z)-1)<.00001);
 assert.equal(moveProjectile(p,target,100,1),true);
 assert.ok(p.x<=target.x&&p.z<=target.z);
});
