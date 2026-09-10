// The bioluminescent mushroom planet: composes lib/ pieces into one world.
// Everything is placed from a seeded RNG so the same seed rebuilds the same
// planet.

import * as THREE from 'three';
import { Rng } from '../lib/rng.js';
import { createPlanet } from '../lib/planet.js';
import { createMushroom, createMushroomCluster, CAP_PALETTE } from '../lib/mushroom.js';
import { createVillager } from '../lib/villager.js';
import { createLantern, createOrb, createTree, createCottage } from '../lib/props.js';
import { createSky } from '../lib/sky.js';
import { randomDir, placeOnSurface, Tweens, ease } from '../lib/surface.js';

export const id = 'bioluminescent';
export const label = 'Bioluminescent';

export const DEFAULTS = {
  seed: 'bioluminescent',
  radius: 2,
  houses: 16,
  clusters: 42,
  villagers: 6,
  orbs: 12,
  lanterns: 9,
  trees: 6,
  cottages: 3,
  rivers: 5,
};

/** Panel ranges for the World folder: [min, max, step, label]. */
export const RANGES = {
  houses: [0, 24, 1],
  clusters: [0, 120, 1, 'mushroom tufts'],
  villagers: [0, 16, 1],
  orbs: [0, 30, 1],
  lanterns: [0, 20, 1],
  rivers: [1, 8, 1],
};

export const LOOK = {
  background: 0x040718,
  bloom: 0.55, bloomRadius: 0.45, bloomThreshold: 0.5,
  exposure: 1.0,
  keyLight: 1.2,
  groundGlow: 1.5,
  spin: 0.06,
};

export function makeSky() {
  return createSky({ rng: new Rng('sky') });
}

/**
 * Build the world. Returns a Group plus handles for interaction.
 * @param {Partial<typeof DEFAULTS>} params
 */
export function createWorld(params = {}) {
  const p = { ...DEFAULTS, ...params };
  const rng = new Rng(p.seed);
  const group = new THREE.Group();
  group.name = 'world';

  const planet = createPlanet({ rng: rng.fork('planet'), radius: p.radius, riverCount: p.rivers });
  group.add(planet.group);

  const animated = [];
  const pickables = [planet.mesh];
  const tweens = new Tweens();

  // Angular exclusion zones so props do not overlap. Radius is in radians.
  const occupied = [];
  const free = (dir, r) => occupied.every((o) => dir.dot(o.dir) < Math.cos(o.r + r));
  const claim = (dir, r) => { occupied.push({ dir: dir.clone(), r }); };
  const findSpot = (r, rr, tries = 400, near = null, spread = 0) => {
    for (let i = 0; i < tries; i++) {
      const d = near
        ? near.clone().add(randomDir(rr).multiplyScalar(spread)).normalize()
        : randomDir(rr);
      if (free(d, r)) return d;
    }
    return null;
  };
  const riverPts = planet.rivers.flat();
  // Keep the rivers themselves clear of big things.
  for (let i = 0; i < riverPts.length; i += 3) occupied.push({ dir: riverPts[i], r: 0.04 });

  const put = (obj, dir, r, { sink = 0.01, tilt = 0.12, spin = true } = {}) => {
    placeOnSurface(obj, dir, planet.radiusAt, -sink, spin ? rng.next() * Math.PI * 2 : 0);
    if (tilt) { obj.rotateX(rng.range(-tilt, tilt)); obj.rotateZ(rng.range(-tilt, tilt)); }
    claim(dir, r);
    group.add(obj);
    pickables.push(obj);
    if (obj.userData.update) animated.push(obj);
    return obj;
  };

  // Houses: big glowing mushrooms with doors and windows.
  const houses = [];
  const hr = rng.fork('houses');
  for (let i = 0; i < p.houses; i++) {
    const dir = findSpot(0.24, hr);
    if (!dir) break;
    const capRadius = hr.range(0.26, 0.42);
    const m = createMushroom({
      rng: hr, house: true, capRadius, stemHeight: capRadius * hr.range(1.3, 1.9),
      palette: hr.pick(CAP_PALETTE),
    });
    houses.push(put(m, dir, 0.22, { tilt: 0.08 }));
  }

  // Cottages and trees.
  const cr = rng.fork('cottages');
  for (let i = 0; i < p.cottages; i++) {
    const dir = findSpot(0.22, cr);
    if (dir) put(createCottage({ rng: cr }), dir, 0.16, { tilt: 0.04 });
  }
  const tr = rng.fork('trees');
  for (let i = 0; i < p.trees; i++) {
    const dir = findSpot(0.2, tr);
    if (dir) put(createTree({ rng: tr, height: tr.range(0.26, 0.4) }), dir, 0.14);
  }

  // Lanterns along the river banks; the first few carry a real light.
  const lr = rng.fork('lanterns');
  for (let i = 0; i < p.lanterns; i++) {
    const base = lr.pick(riverPts);
    const dir = findSpot(0.08, lr, 80, base, 0.14);
    if (dir) put(createLantern({ rng: lr, light: i < 4 }), dir, 0.08, { tilt: 0.05 });
  }

  // Spirit orbs, drawn to the water.
  const orbs = [];
  const orr = rng.fork('orbs');
  for (let i = 0; i < p.orbs; i++) {
    const base = orr.pick(riverPts);
    const dir = findSpot(0.11, orr, 80, base, 0.14) ?? findSpot(0.11, orr);
    if (!dir) break;
    const orb = createOrb({ rng: orr, radius: orr.range(0.05, 0.1), color: orr.pick(['#8fe6ff', '#b6f0ff', '#a08cff', '#7ff5dc']) });
    orbs.push(put(orb, dir, 0.1, { sink: 0, tilt: 0 }));
  }

  // Small mushroom tufts fill the gaps.
  const kr = rng.fork('clusters');
  for (let i = 0; i < p.clusters; i++) {
    const dir = findSpot(0.09, kr, 200);
    if (!dir) break;
    put(createMushroomCluster({ rng: kr, count: kr.int(2, 4) }), dir, 0.07);
  }

  // Villagers walk the rivers.
  const villagers = [];
  const vr = rng.fork('villagers');
  for (let i = 0; i < p.villagers; i++) {
    const curve = planet.curves[i % planet.curves.length];
    const v = createVillager({ rng: vr, curve });
    group.add(v);
    pickables.push(v);
    animated.push(v);
    villagers.push(v);
  }

  /** Grow a wild mushroom at a world-space point on the ground (click-to-plant). */
  function plant(worldPoint) {
    const dir = group.worldToLocal(worldPoint.clone()).normalize();
    const pr = rng.fork(`plant:${occupied.length}`);
    const capRadius = pr.range(0.05, 0.11);
    const m = createMushroom({ rng: pr, capRadius, stemHeight: capRadius * pr.range(1.4, 2.4) });
    put(m, dir, 0.04, { sink: 0.005, tilt: 0.15 });
    m.scale.setScalar(0.001);
    tweens.add({ dur: 0.9, easing: ease.outElastic, fn: (k) => m.scale.setScalar(Math.max(0.001, k)) });
    return m;
  }

  /** Squash-and-stretch bounce on any placed object. */
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
    group, planet, houses, villagers, orbs, pickables, tweens,
    params: p,
    plant, bounce,
    update(dt, t) {
      for (const o of animated) o.userData.update(dt, t);
      tweens.update(dt);
    },
  };
}
