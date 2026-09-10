// Golden Chanterelle Planet: a warm painterly world of trumpet-shaped golden
// mushrooms with wavy rims, tall chanterelle towers with arched windows and
// balconies, cobble paths edged with green moss over yellow ground, villagers
// in sweaters with golden hats (one reading on a bench), under a deep navy sky.

import * as THREE from 'three';
import { Rng } from '../lib/rng.js';
import { createPlanet } from '../lib/planet.js';
import { createChanterelle, createChanterelleCluster, CHANTERELLE_PALETTE } from '../lib/chanterelle.js';
import { createVillager } from '../lib/villager.js';
import { createSky } from '../lib/sky.js';
import { createLantern, createRoundTree, createFence, createSignpost, createBench, createFlowerBox } from '../lib/props.js';
import { randomDir, placeOnSurface, Tweens, ease } from '../lib/surface.js';

export const id = 'chanterelle';
export const label = 'Golden Chanterelle';

export const DEFAULTS = {
  seed: 'chanterelle',
  radius: 2,
  houses: 8,
  bigs: 30,
  clusters: 40,
  villagers: 7,
  lanterns: 5,
  props: 12,
  paths: 5,
};

export const RANGES = {
  houses: [0, 16, 1, 'chanterelle towers'],
  bigs: [0, 40, 1, 'big chanterelles'],
  clusters: [0, 80, 1, 'small patches'],
  villagers: [0, 16, 1],
  lanterns: [0, 12, 1],
  props: [0, 30, 1, 'benches & co.'],
  paths: [1, 8, 1, 'cobble paths'],
};

export const LOOK = {
  background: 0x140f2e,
  bloom: 0.3, bloomRadius: 0.3, bloomThreshold: 0.8,
  exposure: 1.2,
  keyLight: 2.0,
  groundGlow: 0,
  spin: 0.05,
};

export function makeSky() {
  return createSky({
    rng: new Rng('chanterelle-sky'),
    moon: false,
    moonDir: new THREE.Vector3(-0.35, 0.7, 0.6).normalize(),
    starColors: ['#ffffff', '#fff4dc', '#ffe6a8', '#d8d0ff'],
    brightStarColors: ['#ffffff', '#ffe6a8'],
    starCount: 700,
    brightStarCount: 40,
    key: { color: 0xfff1d6, intensity: LOOK.keyLight },
    hemi: { sky: 0x9c8ad8, ground: 0x7a6a2a, intensity: 0.9 },
    ambient: { color: 0x6a5c8a, intensity: 0.7 },
    haze: 'rgba(90, 70, 200, 0.25)',
  });
}

const SWEATERS = [
  { color: '#4a7a3a' },
  { color: '#efdcb8', stripe: '#c98a3a' },
  { color: '#7a4a2a' },
  { color: '#d9823a' },
  { color: '#3f6fb0' },
  { color: '#f0e2c8', stripe: '#8a5a3a' },
];
const HAT = { cap: '#f3c552', spot: '#fff0b0', spots: false, glow: 0.12 };
const LINES = [
  'what a golden evening', 'the trumpets are ringing', 'have you read this one?', 'mind the step',
  'tea at the tower later?', '*waves*', 'the moss is extra yellow today', 'my hat is a bit wavy',
  '♪ hum hum ♪', 'the balcony has the best view',
];

export function createWorld(params = {}) {
  const p = { ...DEFAULTS, ...params };
  const rng = new Rng(p.seed);
  const group = new THREE.Group();
  group.name = 'world';

  const planet = createPlanet({
    rng: rng.fork('planet'), radius: p.radius, riverCount: p.paths, style: 'cobble', bump: 0.03,
    colors: {
      moss: '#dcc247', mossDark: '#ab9a30', mossLight: '#f0dc6a', purple: '#b5ab3c',
      lichen: '#6f8a2c', lichenLight: '#8ea63a', lichenDark: '#4f6a20',
      path: '#a89c8c', pathEdge: '#5f7a2a', stoneA: '#bdb2a0', stoneB: '#8f8577', stoneC: '#d0c6b2',
      bushShades: ['#a3922c', '#d4b93f', '#ecd763', '#6f8a2c', '#8ea63a'],
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

  // Towers: tall chanterelle houses facing a path.
  const houses = [];
  const hr = rng.fork('houses');
  for (let i = 0; i < p.houses; i++) {
    const base = hr.pick(pathPts);
    const dir = findSpot(0.26, hr, 120, base, 0.4) ?? findSpot(0.26, hr);
    if (!dir) break;
    const capRadius = hr.range(0.3, 0.42);
    const m = createChanterelle({ rng: hr, house: true, capRadius, stemHeight: capRadius * hr.range(2.0, 2.8), palette: hr.pick(CHANTERELLE_PALETTE) });
    houses.push(put(m, dir, 0.22, { tilt: 0.05, facePath: true }));
  }

  // Big wild chanterelles: the picture is crowded with them, leaning every way.
  const br = rng.fork('bigs');
  for (let i = 0; i < p.bigs; i++) {
    const dir = findSpot(0.15, br, 300);
    if (!dir) break;
    const capRadius = br.range(0.2, 0.36);
    const m = createChanterelle({ rng: br, capRadius, stemHeight: capRadius * br.range(0.9, 1.6), palette: br.pick(CHANTERELLE_PALETTE) });
    put(m, dir, 0.13, { tilt: 0.3 });
  }

  // A few round trees and lanterns.
  const tr = rng.fork('trees');
  for (let i = 0; i < 3; i++) {
    const dir = findSpot(0.14, tr);
    if (dir) put(createRoundTree({ rng: tr, height: tr.range(0.24, 0.32) }), dir, 0.1);
  }
  const lr = rng.fork('lanterns');
  for (let i = 0; i < p.lanterns; i++) {
    const base = lr.pick(pathPts);
    const dir = findSpot(0.07, lr, 80, base, 0.12);
    if (dir) put(createLantern({ rng: lr, light: i < 3 }), dir, 0.06, { tilt: 0.04 });
  }

  // Benches, fences, signposts, flower boxes near the paths. One bench gets a reader.
  const pr = rng.fork('props');
  const makers = [
    () => createBench({ rng: pr }),
    () => createFence({ rng: pr, posts: pr.int(3, 4) }),
    () => createSignpost({ rng: pr }),
    () => createFlowerBox({ rng: pr }),
    () => createBench({ rng: pr }),
  ];
  const villagers = [];
  const vr = rng.fork('villagers');
  let readerPlaced = false;
  for (let i = 0; i < p.props; i++) {
    const base = pr.pick(pathPts);
    const dir = findSpot(0.08, pr, 80, base, 0.15) ?? findSpot(0.08, pr, 80);
    if (!dir) break;
    const prop = makers[i % makers.length]();
    put(prop, dir, 0.07, { tilt: 0.03 });
    if (!readerPlaced && prop.userData.name === 'Bench') {
      // Sit a reader on it: parked villager with a book, in the bench's frame.
      const v = createVillager({ rng: vr, hat: HAT, outfit: SWEATERS[3], arms: false, lines: LINES, book: true, size: 0.85 });
      v.userData.name = 'Reader';
      v.position.set(0, 0.045, 0.008);
      v.userData.body.rotation.x = 0.15;
      prop.add(v);
      v.traverse((o) => { if (o !== v) o.userData.pickRoot = v; });
      pickables.push(v);
      animated.push(v);
      villagers.push(v);
      readerPlaced = true;
    }
  }

  // Small patches fill the gaps.
  const kr = rng.fork('clusters');
  for (let i = 0; i < p.clusters; i++) {
    const dir = findSpot(0.08, kr, 200);
    if (!dir) break;
    put(createChanterelleCluster({ rng: kr, count: kr.int(2, 4) }), dir, 0.06);
  }

  // Walking villagers.
  for (let i = 0; i < p.villagers; i++) {
    const curve = planet.curves[i % planet.curves.length];
    const v = createVillager({ rng: vr, curve, hat: HAT, outfit: SWEATERS[i % SWEATERS.length], arms: true, lines: LINES, size: 1.05 });
    group.add(v);
    pickables.push(v);
    animated.push(v);
    villagers.push(v);
  }

  function plant(worldPoint) {
    const dir = group.worldToLocal(worldPoint.clone()).normalize();
    const pr2 = rng.fork(`plant:${occupied.length}`);
    const r = pr2.range(0.05, 0.1);
    const m = createChanterelle({ rng: pr2, capRadius: r, stemHeight: r * pr2.range(0.9, 1.6) });
    put(m, dir, 0.04, { sink: 0.004, tilt: 0.2 });
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
