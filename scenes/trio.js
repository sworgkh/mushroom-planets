// All three planets in one view: the Bioluminescent, Purple Morel and Golden
// Chanterelle worlds arranged in a triangle, each spinning on its own tilted
// axis, the whole group drifting slowly under one shared sky.

import * as THREE from 'three';
import { Rng } from '../lib/rng.js';
import { createSky } from '../lib/sky.js';
import { Tweens, ease } from '../lib/surface.js';
import * as bioluminescent from './mushroom-planet.js';
import * as morel from './morel-planet.js';
import * as chanterelle from './chanterelle-planet.js';

export const id = 'trio';
export const label = 'All three';
export const title = 'Three Mushroom Planets';

const MEMBERS = [
  { scene: morel, angle: -Math.PI / 6, tilt: -0.18, spin: 0.07 },
  { scene: bioluminescent, angle: Math.PI / 2, tilt: 0.12, spin: 0.05, lift: 1.4 },
  { scene: chanterelle, angle: Math.PI + Math.PI / 6, tilt: 0.2, spin: 0.06 },
];

export const DEFAULTS = {
  seed: 'trio',
  spacing: 6.2,
  size: 1,
};

export const RANGES = {
  spacing: [4.5, 10, 0.1, 'distance apart'],
  size: [0.5, 1.3, 0.05, 'planet size'],
};

export const LOOK = {
  background: 0x0a0a20,
  bloom: 0.4, bloomRadius: 0.35, bloomThreshold: 0.7,
  exposure: 1.1,
  keyLight: 1.6,
  groundGlow: 1.3,
  spin: 0.03,
};

/** Camera preset for this scene: further back, a little higher. */
export const CAMERA = { position: [0, 7.5, 21], target: [0, 0, 0] };

export function makeSky() {
  return createSky({
    rng: new Rng('trio-sky'),
    moon: true,
    moonDir: new THREE.Vector3(-0.42, 0.42, -0.8).normalize(),
    moonDistance: 60,
    starColors: ['#ffffff', '#cfe8ff', '#ffe6a8', '#d8d0ff'],
    brightStarColors: ['#ffffff', '#aef7ff', '#ffd27a'],
    starCount: 900,
    brightStarCount: 60,
    key: { color: 0xfff0dc, intensity: LOOK.keyLight },
    hemi: { sky: 0x8a86c8, ground: 0x3a3a2a, intensity: 0.8 },
    ambient: { color: 0x5a5a80, intensity: 0.55 },
    haze: 'rgba(90, 80, 200, 0.18)',
  });
}

export function createWorld(params = {}) {
  const p = { ...DEFAULTS, ...params };
  const group = new THREE.Group();
  group.name = 'world';

  const worlds = [];
  const pivots = [];
  const tweens = new Tweens();

  for (const m of MEMBERS) {
    // Default trio seed shows each planet's canonical world; any other seed re-rolls all three.
    const seed = p.seed === DEFAULTS.seed ? m.scene.DEFAULTS.seed : `${p.seed}-${m.scene.id}`;
    const w = m.scene.createWorld({ seed });
    const pivot = new THREE.Group();
    pivot.position.set(Math.cos(m.angle) * p.spacing, m.lift ?? 0, -Math.sin(m.angle) * p.spacing);
    pivot.rotation.z = m.tilt;
    pivot.scale.setScalar(p.size);
    pivot.add(w.group);
    group.add(pivot);
    // Remember which world a ground click belongs to, so planting lands on the right planet.
    w.planet.mesh.userData.world = w;
    worlds.push(w);
    pivots.push({ pivot, spin: m.spin, world: w });
  }

  function plant(worldPoint, obj) {
    const w = obj?.userData.world ?? worlds[1];
    return w.plant(worldPoint);
  }

  function bounce(obj) {
    tweens.add({
      dur: 0.55, easing: ease.linear,
      fn: (k) => {
        const s = 1 + Math.sin(k * Math.PI) * 0.18 * (1 - k);
        obj.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
      },
      done: () => obj.scale.setScalar(1),
    });
  }

  return {
    group,
    worlds,
    planet: worlds[1].planet, // the glowing one: 'ground glow' in the panel drives it
    houses: worlds.flatMap((w) => w.houses),
    villagers: worlds.flatMap((w) => w.villagers),
    orbs: worlds.flatMap((w) => w.orbs),
    get pickables() { return worlds.flatMap((w) => w.pickables); }, // live: planted mushrooms join the sub-world lists
    tweens,
    params: p,
    plant, bounce,
    update(dt, t) {
      for (const { world, pivot, spin } of pivots) {
        world.update(dt, t);
        world.group.rotation.y += spin * dt;
      }
      tweens.update(dt);
    },
  };
}
