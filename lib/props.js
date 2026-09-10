// Small set dressing: lanterns, floating spirit orbs, glow-moss trees and
// tiny cottages. Every prop is a Group with userData { type, name } and, if it
// animates, userData.update(dt, t).

import * as THREE from 'three';

const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a2f1c, roughness: 0.95 });
const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x2e1c10, roughness: 0.95 });
const warmMat = () => new THREE.MeshStandardMaterial({ color: 0xffc670, emissive: 0xffa640, emissiveIntensity: 2.6, roughness: 0.4 });
const leafMat = new THREE.MeshStandardMaterial({ color: 0x0f4a44, roughness: 1, flatShading: true, emissive: 0x1ec8b0, emissiveIntensity: 0.12 });
const wallMat = new THREE.MeshStandardMaterial({ color: 0xe8d9bf, roughness: 0.9 });
const roofMat = new THREE.MeshStandardMaterial({ color: 0x3b2a7a, roughness: 0.8, emissive: 0x5a3fd0, emissiveIntensity: 0.15 });

function tagTree(group, ud) {
  group.userData = ud;
  group.traverse((o) => { if (o !== group) o.userData.pickRoot = group; });
  return group;
}

/** A crooked lantern post with a warm glowing lamp. `light: true` adds a real PointLight (use sparingly). */
export function createLantern({ rng, height = 0.32, light = false } = {}) {
  const group = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, height, 8), woodMat);
  post.position.y = height / 2;
  post.rotation.z = rng.range(-0.12, 0.12);
  group.add(post);
  // Hook: a short quarter-torus arm at the top.
  const arm = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.01, 6, 12, Math.PI / 2), woodMat);
  arm.position.set(0.0, height - 0.06, 0);
  arm.rotation.z = Math.PI / 2;
  arm.rotation.y = Math.PI / 2;
  group.add(arm);
  const lamp = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.05), warmMat());
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.03, 4), darkWoodMat);
  cap.position.y = 0.045;
  cap.rotation.y = Math.PI / 4;
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.008, 0.055), darkWoodMat);
  base.position.y = -0.034;
  lamp.add(glass, cap, base);
  lamp.position.set(0, height - 0.09, 0.075);
  group.add(lamp);
  if (light) {
    const pl = new THREE.PointLight(0xffb060, 0.8, 0.9, 2);
    pl.position.copy(lamp.position);
    group.add(pl);
  }
  return tagTree(group, {
    type: 'lantern', name: 'Lantern', lamp,
    update(dt, t) {
      // gentle flicker
      glass.material.emissiveIntensity = 2.4 + Math.sin(t * 7.3 + height * 40) * 0.25 + Math.sin(t * 13.1) * 0.12;
    },
  });
}

/** A translucent floating orb that bobs and breathes. Click → pop, then regrow. */
export function createOrb({ rng, radius = 0.09, color = '#8fe6ff', hover = 0.05 } = {}) {
  const group = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color),
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.3,
    roughness: 0.08,
    metalness: 0,
    transmission: 0.85,
    thickness: 0.2,
    clearcoat: 1,
    transparent: true,
    opacity: 0.8,
  });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(radius, 28, 22), mat);
  const baseY = radius + hover;
  ball.position.y = baseY;
  group.add(ball);
  // faint inner core
  const core = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.35, 12, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.6 }));
  ball.add(core);
  const phase = rng.range(0, Math.PI * 2);
  const speed = rng.range(0.8, 1.4);
  let popped = 0;
  return tagTree(group, {
    type: 'orb', name: 'Spirit orb', ball,
    pop() { if (popped <= 0) popped = 3.5; },
    update(dt, t) {
      ball.position.y = baseY + Math.sin(t * speed + phase) * hover * 0.6;
      mat.emissiveIntensity = 0.22 + (Math.sin(t * speed * 1.7 + phase) * 0.5 + 0.5) * 0.3;
      if (popped > 0) {
        popped -= dt;
        // shrink fast, then regrow with a little overshoot
        const k = popped > 3.2 ? (popped - 3.2) / 0.3 : Math.max(0, 1 - popped / 3.2);
        const s = popped > 3.2 ? k : 1 - Math.pow(1 - k, 3);
        ball.scale.setScalar(Math.max(0.001, s));
      } else if (ball.scale.x !== 1) {
        ball.scale.setScalar(1);
      }
    },
  });
}

/** A round-canopy tree in dark teal with a few glowing specks. */
export function createTree({ rng, height = 0.3 } = {}) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, height * 0.5, 7), woodMat);
  trunk.position.y = height * 0.25;
  group.add(trunk);
  const blobs = rng.int(3, 5);
  for (let i = 0; i < blobs; i++) {
    const r = height * rng.range(0.16, 0.26);
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leafMat);
    b.position.set(rng.range(-0.08, 0.08) * height * 2, height * rng.range(0.45, 0.85), rng.range(-0.08, 0.08) * height * 2);
    b.rotation.set(rng.next() * 3, rng.next() * 3, 0);
    group.add(b);
  }
  const specks = new THREE.Mesh(new THREE.SphereGeometry(0.008, 5, 4), new THREE.MeshStandardMaterial({ emissive: 0x7ff0ff, emissiveIntensity: 2 }));
  for (let i = 0; i < 6; i++) {
    const s = specks.clone();
    s.position.set(rng.range(-0.12, 0.12), height * rng.range(0.5, 0.95), rng.range(-0.12, 0.12));
    group.add(s);
  }
  return tagTree(group, { type: 'tree', name: 'Glow-moss tree' });
}

/** A tiny cottage: box, pointed roof, one warm window, chimney. */
export function createCottage({ rng, size = 0.16 } = {}) {
  const group = new THREE.Group();
  const w = size, h = size * 0.85, d = size * 0.9;
  const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
  walls.position.y = h / 2;
  group.add(walls);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.85, h * 0.8, 4), roofMat);
  roof.position.y = h + h * 0.4;
  roof.rotation.y = Math.PI / 4;
  group.add(roof);
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(w * 0.16, h * 0.5, w * 0.16), darkWoodMat);
  chimney.position.set(w * 0.28, h + h * 0.35, -d * 0.15);
  group.add(chimney);
  const wm = warmMat();
  const windows = [];
  const win = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.28, h * 0.3), wm);
  win.position.set(w * 0.18, h * 0.55, d / 2 + 0.003);
  group.add(win);
  windows.push(win);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.26, h * 0.55), darkWoodMat);
  door.position.set(-w * 0.2, h * 0.28, d / 2 + 0.003);
  group.add(door);
  if (rng.chance(0.7)) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(d * 0.25, h * 0.25), wm);
    side.position.set(w / 2 + 0.003, h * 0.55, 0);
    side.rotation.y = Math.PI / 2;
    group.add(side);
    windows.push(side);
  }
  const ud = {
    type: 'cottage', name: rng.pick(['Woodcutter\'s cottage', 'Ferryman\'s hut', 'Old moss cabin']),
    lit: true, windows,
    setLit(on) { ud.lit = on; wm.emissiveIntensity = on ? 2.6 : 0.05; },
  };
  return tagTree(group, ud);
}

// --- Cozy village props (Purple Morel planet) --------------------------------

const plankMat = new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.95 });
const darkPlankMat = new THREE.MeshStandardMaterial({ color: 0x5b3a22, roughness: 0.95 });
const pineMat = new THREE.MeshStandardMaterial({ color: 0x2f5a2a, roughness: 1, flatShading: true });
const roundLeafMat = new THREE.MeshStandardMaterial({ color: 0x4f7a2e, roughness: 1, flatShading: true });
const flowerMats = ['#ff5f7e', '#ffb347', '#ff8bd1', '#ffe066', '#ff6b6b'].map((h) => new THREE.MeshStandardMaterial({ color: h, roughness: 0.8 }));

/** Stacked-cone pine tree. */
export function createPine({ rng, height = 0.36 } = {}) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, height * 0.3, 7), woodMat);
  trunk.position.y = height * 0.15;
  group.add(trunk);
  const tiers = rng.int(3, 4);
  for (let i = 0; i < tiers; i++) {
    const k = i / tiers;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(height * (0.28 - k * 0.16), height * 0.32, 7), pineMat);
    cone.position.y = height * (0.32 + k * 0.6);
    cone.rotation.y = rng.next() * 3;
    group.add(cone);
  }
  return tagTree(group, { type: 'tree', name: 'Pine' });
}

/** Round lollipop tree. */
export function createRoundTree({ rng, height = 0.3 } = {}) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.025, height * 0.45, 7), woodMat);
  trunk.position.y = height * 0.22;
  group.add(trunk);
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(height * 0.32, 1), roundLeafMat);
  crown.position.y = height * 0.68;
  crown.rotation.set(rng.next() * 3, rng.next() * 3, 0);
  crown.scale.set(1, 0.9, 1);
  group.add(crown);
  return tagTree(group, { type: 'tree', name: 'Round tree' });
}

/** A wooden ladder leaning back a little. */
export function createLadder({ rng, height = 0.3 } = {}) {
  const group = new THREE.Group();
  const w = 0.07;
  for (const sx of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.012, height, 0.012), plankMat);
    rail.position.set(sx * w / 2, height / 2, 0);
    group.add(rail);
  }
  const rungs = Math.round(height / 0.05);
  for (let i = 1; i <= rungs; i++) {
    const rung = new THREE.Mesh(new THREE.BoxGeometry(w, 0.01, 0.012), plankMat);
    rung.position.y = (i / (rungs + 1)) * height;
    group.add(rung);
  }
  group.rotation.x = -0.35;
  const outer = new THREE.Group();
  outer.add(group);
  return tagTree(outer, { type: 'prop', name: 'Ladder' });
}

/** A short picket fence, `posts` posts long, along local +X. */
export function createFence({ rng, posts = 4, gap = 0.06 } = {}) {
  const group = new THREE.Group();
  const len = (posts - 1) * gap;
  for (let i = 0; i < posts; i++) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.09, 0.014), plankMat);
    post.position.set(i * gap - len / 2, 0.045, 0);
    post.rotation.z = rng.range(-0.05, 0.05);
    group.add(post);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.015, 4), plankMat);
    tip.position.set(post.position.x, 0.097, 0);
    tip.rotation.y = Math.PI / 4;
    group.add(tip);
  }
  for (const y of [0.03, 0.065]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len + 0.02, 0.01, 0.008), darkPlankMat);
    rail.position.set(0, y, 0.008);
    group.add(rail);
  }
  return tagTree(group, { type: 'prop', name: 'Fence' });
}

/** Signpost with one or two arrow boards. */
export function createSignpost({ rng, height = 0.22 } = {}) {
  const group = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, height, 7), darkPlankMat);
  post.position.y = height / 2;
  group.add(post);
  const boards = rng.int(1, 2);
  for (let i = 0; i < boards; i++) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.028, 0.01), plankMat);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.02, 4), plankMat);
    tip.rotation.z = -Math.PI / 2;
    tip.rotation.y = Math.PI / 4;
    tip.position.x = 0.055;
    const g = new THREE.Group();
    g.add(board, tip);
    g.position.set(0.02, height - 0.03 - i * 0.04, 0);
    g.rotation.y = rng.range(-0.6, 0.6) + i * Math.PI;
    group.add(g);
  }
  return tagTree(group, { type: 'prop', name: 'Signpost' });
}

/** A planter box with bright flower heads. */
export function createFlowerBox({ rng } = {}) {
  const group = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.04), plankMat);
  box.position.y = 0.015;
  group.add(box);
  for (let i = 0; i < 6; i++) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.03, 5), roundLeafMat);
    const x = rng.range(-0.035, 0.035), z = rng.range(-0.012, 0.012);
    stem.position.set(x, 0.045, z);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), rng.pick(flowerMats));
    head.position.set(x, 0.062, z);
    group.add(stem, head);
  }
  return tagTree(group, { type: 'prop', name: 'Flower box' });
}

/** A little bench. */
export function createBench({ rng } = {}) {
  const group = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.012, 0.035), plankMat);
  seat.position.y = 0.04;
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.035, 0.01), plankMat);
  back.position.set(0, 0.065, -0.015);
  group.add(seat, back);
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.04, 0.03), darkPlankMat);
    leg.position.set(sx * 0.04, 0.02, 0);
    group.add(leg);
  }
  return tagTree(group, { type: 'prop', name: 'Bench' });
}
