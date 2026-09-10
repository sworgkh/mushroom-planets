// Putting things on a sphere: scatter points, orient objects so their +Y
// points away from the centre, and simple easing/tween helpers.

import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _x = new THREE.Vector3();
const _z = new THREE.Vector3();

/** Random unit vector. */
export function randomDir(rng, out = new THREE.Vector3()) {
  const z = rng.range(-1, 1);
  const a = rng.range(0, Math.PI * 2);
  const r = Math.sqrt(1 - z * z);
  return out.set(r * Math.cos(a), r * Math.sin(a), z);
}

/**
 * `count` directions no closer than `minAngle` radians to each other or to
 * anything in `avoid`. Rejection sampling: gives up after `tries` attempts,
 * so you may get fewer than asked for on a crowded sphere.
 */
export function scatterDirs(rng, count, minAngle, avoid = [], tries = 4000) {
  const out = [];
  const all = [...avoid];
  const cosMin = Math.cos(minAngle);
  for (let i = 0; i < tries && out.length < count; i++) {
    const d = randomDir(rng);
    let ok = true;
    for (const other of all) {
      if (d.dot(other) > cosMin) { ok = false; break; }
    }
    if (ok) { out.push(d); all.push(d); }
  }
  return out;
}

/** Rotate `obj` so its local +Y is `normal`. Keeps a random spin around it if `spin` given. */
export function orientToNormal(obj, normal, spin = 0) {
  _q.setFromUnitVectors(UP, normal);
  obj.quaternion.copy(_q);
  if (spin) obj.rotateY(spin);
}

/** Orient so +Y = normal and +Z = forward (projected onto the tangent plane). */
export function orientAlong(obj, normal, forward) {
  _z.copy(forward).addScaledVector(normal, -forward.dot(normal)).normalize();
  if (_z.lengthSq() < 1e-6) return orientToNormal(obj, normal);
  _x.crossVectors(normal, _z).normalize();
  _m.makeBasis(_x, normal, _z);
  obj.quaternion.setFromRotationMatrix(_m);
}

/** Place `obj` at direction `dir` on a surface described by `radiusAt(dir)`, sunk/raised by `offset`. */
export function placeOnSurface(obj, dir, radiusAt, offset = 0, spin = 0) {
  const r = radiusAt(dir) + offset;
  obj.position.copy(dir).multiplyScalar(r);
  orientToNormal(obj, dir, spin);
  return obj;
}

/** Direction (unit vector) → equirectangular uv matching three's SphereGeometry. */
export function dirToUv(d) {
  const theta = Math.acos(THREE.MathUtils.clamp(d.y, -1, 1));
  let phi = Math.atan2(d.z, -d.x);
  if (phi < 0) phi += Math.PI * 2;
  return [phi / (Math.PI * 2), 1 - theta / Math.PI];
}

// --- Easing / tweens --------------------------------------------------------

export const ease = {
  outElastic: (t) => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1,
  outBack: (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
  inOut: (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  linear: (t) => t,
};

/** A tiny tween runner. `add({ dur, fn, easing, done })`; call `update(dt)` each frame. */
export class Tweens {
  constructor() { this.list = []; }
  add({ dur = 0.5, fn, easing = ease.inOut, done }) {
    const tw = { t: 0, dur, fn, easing, done };
    this.list.push(tw);
    return tw;
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const tw = this.list[i];
      tw.t += dt;
      const k = Math.min(tw.t / tw.dur, 1);
      tw.fn(tw.easing(k), k);
      if (k >= 1) {
        this.list.splice(i, 1);
        tw.done?.();
      }
    }
  }
}
