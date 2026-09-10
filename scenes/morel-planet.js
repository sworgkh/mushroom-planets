// Purple Morel Planet: a cosy twilight village of honeycomb morel houses with
// chimneys, cobblestone paths through moss and orange lichen, sweater-wearing
// villagers who wave, lanterns, ladders, fences and signposts.

import * as THREE from 'three';
import { Rng } from '../lib/rng.js';
import { createPlanet } from '../lib/planet.js';
import { createMorel, createMorelCluster, MOREL_PALETTE } from '../lib/morel.js';
import { createVillager } from '../lib/villager.js';
import { createSky } from '../lib/sky.js';
import {
  createLantern, createPine, createRoundTree, createLadder, createFence,
  createSignpost, createFlowerBox, createBench,
} from '../lib/props.js';
import { randomDir, placeOnSurface, Tweens, ease } from '../lib/surface.js';

export const id = 'morel';
export const label = 'Purple Morel';

export const DEFAULTS = {
  seed: 'morel',
  radius: 2,
  houses: 12,
  clusters: 28,
  villagers: 8,
  lanterns: 8,
  trees: 9,
  props: 18,
  paths: 5,
};

/** Panel ranges for the World folder: [min, max, step, label]. */
export const RANGES = {
  houses: [0, 20, 1, 'morel houses'],
  clusters: [0, 80, 1, 'morel patches'],
  villagers: [0, 16, 1],
  lanterns: [0, 16, 1],
  trees: [0, 20, 1],
  props: [0, 40, 1, 'fences & co.'],
  paths: [1, 8, 1, 'cobble paths'],
};

export const LOOK = {
  background: 0x120c16,
  bloom: 0.35, bloomRadius: 0.3, bloomThreshold: 0.75,
  exposure: 1.05,
  keyLight: 1.7,
  groundGlow: 0,
  spin: 0.05,
};

export function makeSky() {
  return createSky({
    rng: new Rng('morel-sky'),
    moon: false,
    moonDir: new THREE.Vector3(-0.45, 0.65, 0.6).normalize(),
    starColors: ['#ffe9b8', '#fff4dc', '#ffd27a', '#ffffff'],
    brightStarColors: ['#ffd27a', '#fff4dc'],
    starCount: 520,
    brightStarCount: 36,
    key: { color: 0xffd9b0, intensity: LOOK.keyLight },
    hemi: { sky: 0xb08cc0, ground: 0x3a2a20, intensity: 0.75 },
    ambient: { color: 0x6a5070, intensity: 0.55 },
    haze: null,
  });
}

const SWEATERS = [
  { color: '#efe0c4', stripe: '#8a5a3a' },
  { color: '#3f7fd6' },
  { color: '#d63f4a' },
  { color: '#3f9a5a' },
  { color: '#f3e6cc', stripe: '#c96b3a' },
  { color: '#e0b04a' },
  { color: '#7a5cc4' },
];
const HAT = { cap: '#7a4a2a', spot: '#a97a52', spots: false, glow: 0.05 };
const LINES = [
  'lovely evening!', 'the bread is almost done', 'have you seen my scarf?', 'mind the ladder',
  'come in for tea', '*waves*', 'the lichen turned orange again', 'chimney needs sweeping',
  'knitted this myself', 'cobbles are slippery tonight', '♪ la la ♪',
];

export function createWorld(params = {}) {
  const p = { ...DEFAULTS, ...params };
  const rng = new Rng(p.seed);
  const group = new THREE.Group();
  group.name = 'world';

  const planet = createPlanet({
    rng: rng.fork('planet'), radius: p.radius, riverCount: p.paths, style: 'cobble', bump: 0.03,
    colors: {
      moss: '#52702a', mossDark: '#354c1e', mossLight: '#7d9a38', purple: '#5f7f2a',
      bushShades: ['#3c5420', '#5b7a2e', '#8aa33c', '#d9822b', '#b0662a', '#4f7a2e'],
      bushGlow: null,
    },
  });
  group.add(planet.group);

  const animated = [];
  const pickables = [planet.mesh];
  const tweens = new Tweens();

  const occupied = [];
  const free = (dir, r) => occupied.every((o) => dir.dot(o.dir) < Math.cos(o.r + r));
  const claim = (dir, r) => { occupied.push({ dir: dir.clone(), r }); };
  const findSpot = (r, rr, tries = 400, near = null, spread = 0) => {
    for (let i = 0; i < tries; i++) {
      const d = near ? near.clone().add(randomDir(rr).multiplyScalar(spread)).normalize() : randomDir(rr);
      if (free(d, r)) return d;
    }
    return null;
  };
  const pathPts = planet.rivers.flat();
  for (let i = 0; i < pathPts.length; i += 3) occupied.push({ dir: pathPts[i], r: 0.035 });

  const put = (obj, dir, r, { sink = 0.01, tilt = 0.1, spin = true, facePath = false } = {}) => {
    placeOnSurface(obj, dir, planet.radiusAt, -sink, spin ? rng.next() * Math.PI * 2 : 0);
    if (facePath) {
      // turn the door (+Z) toward the nearest path point
      let best = null, bd = -2;
      for (const q of pathPts) { const d = q.dot(dir); if (d > bd) { bd = d; best = q; } }
      if (best) {
        const local = obj.worldToLocal(best.clone().multiplyScalar(planet.radiusAt(best)));
        obj.rotateY(Math.atan2(local.x, local.z));
      }
    }
    if (tilt) { obj.rotateX(rng.range(-tilt, tilt)); obj.rotateZ(rng.range(-tilt, tilt)); }
    claim(dir, r);
    group.add(obj);
    pickables.push(obj);
    if (obj.userData.update) animated.push(obj);
    return obj;
  };

  // Morel houses: big, facing a path.
  const houses = [];
  const hr = rng.fork('houses');
  for (let i = 0; i < p.houses; i++) {
    const base = hr.pick(pathPts);
    const dir = findSpot(0.26, hr, 120, base, 0.45) ?? findSpot(0.26, hr);
    if (!dir) break;
    const capRadius = hr.range(0.34, 0.48);
    const m = createMorel({ rng: hr, house: true, capRadius, palette: hr.pick(MOREL_PALETTE) });
    houses.push(put(m, dir, 0.24, { tilt: 0.05, facePath: true }));
  }

  // Trees: pines and round ones.
  const tr = rng.fork('trees');
  for (let i = 0; i < p.trees; i++) {
    const dir = findSpot(0.16, tr);
    if (!dir) break;
    const tree = tr.chance(0.55) ? createPine({ rng: tr, height: tr.range(0.3, 0.42) }) : createRoundTree({ rng: tr, height: tr.range(0.26, 0.36) });
    put(tree, dir, 0.12);
  }

  // Lanterns along the paths.
  const lr = rng.fork('lanterns');
  for (let i = 0; i < p.lanterns; i++) {
    const base = lr.pick(pathPts);
    const dir = findSpot(0.07, lr, 80, base, 0.12);
    if (dir) put(createLantern({ rng: lr, light: i < 4 }), dir, 0.06, { tilt: 0.04 });
  }

  // Fences, ladders, signposts, flower boxes, benches: near paths and houses.
  const pr = rng.fork('props');
  const makers = [
    () => createFence({ rng: pr, posts: pr.int(3, 5) }),
    () => createLadder({ rng: pr, height: pr.range(0.24, 0.34) }),
    () => createSignpost({ rng: pr }),
    () => createFlowerBox({ rng: pr }),
    () => createBench({ rng: pr }),
    () => createFence({ rng: pr, posts: pr.int(3, 5) }),
  ];
  for (let i = 0; i < p.props; i++) {
    const base = pr.pick(pathPts);
    const dir = findSpot(0.08, pr, 80, base, 0.16) ?? findSpot(0.08, pr, 80);
    if (!dir) break;
    put(makers[i % makers.length](), dir, 0.07, { tilt: 0.03 });
  }

  // Small morel patches fill the gaps.
  const kr = rng.fork('clusters');
  for (let i = 0; i < p.clusters; i++) {
    const dir = findSpot(0.08, kr, 200);
    if (!dir) break;
    put(createMorelCluster({ rng: kr, count: kr.int(2, 4) }), dir, 0.06);
  }

  // Villagers in sweaters, walking the paths.
  const villagers = [];
  const vr = rng.fork('villagers');
  for (let i = 0; i < p.villagers; i++) {
    const curve = planet.curves[i % planet.curves.length];
    const v = createVillager({ rng: vr, curve, hat: HAT, outfit: SWEATERS[i % SWEATERS.length], arms: true, size: 1.05, lines: LINES });
    group.add(v);
    pickables.push(v);
    animated.push(v);
    villagers.push(v);
  }

  function plant(worldPoint) {
    const dir = group.worldToLocal(worldPoint.clone()).normalize();
    const pr2 = rng.fork(`plant:${occupied.length}`);
    const m = createMorel({ rng: pr2, capRadius: pr2.range(0.04, 0.08) });
    put(m, dir, 0.04, { sink: 0.004, tilt: 0.12 });
    m.scale.setScalar(0.001);
    tweens.add({ dur: 0.9, easing: ease.outElastic, fn: (k) => m.scale.setScalar(Math.max(0.001, k)) });
    return m;
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
    group, planet, houses, villagers, orbs: [], pickables, tweens,
    params: p,
    plant, bounce,
    update(dt, t) {
      for (const o of animated) o.userData.update(dt, t);
      tweens.update(dt);
    },
  };
}
