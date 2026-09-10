// Morel mushrooms: an egg-shaped cap carved into honeycomb pits with cellular
// noise, a chunky cream stem, and (for houses) an arched door, framed windows
// set into the pits, and a chimney that puffs smoke.

import * as THREE from 'three';
import { worleyF12 } from './rng.js';

export const MOREL_PALETTE = [
  { pit: '#5a3d8a', ridge: '#b79ad6' }, // lavender
  { pit: '#4e3479', ridge: '#a58bc9' }, // deeper purple
  { pit: '#6b4a92', ridge: '#c9b1e2' }, // pale lilac
  { pit: '#7a5a3a', ridge: '#d9b58c' }, // tan (the odd one out in the picture)
];

const NAME_A = ['Morel', 'Honey', 'Pit', 'Old', 'Bramble', 'Thistle', 'Cobble', 'Amber', 'Plum'];
const NAME_B = ['Cottage', 'House', 'Lodge', 'Nook', 'Bakery', 'Inn', 'Hollow', 'Post Office'];

const smooth = (a, b, x) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** Cap radius as a function of height fraction t ∈ [0,1], before pitting. */
function eggRadius(t, r) {
  if (t < 0.3) return r * (0.62 + 0.38 * (t / 0.3));
  return Math.max(0.001, r * Math.sqrt(Math.max(0, 1 - ((t - 0.3) / 0.7) ** 2)));
}

/**
 * Pitted morel cap. Vertex colours carry pit (dark) vs ridge (light).
 * @param {number} r      max radius
 * @param {number} h      height
 * @param {number} seed
 * @param {object} palette { pit, ridge }
 */
export function morelCapGeometry(r, h, seed, palette, { pitDepth = 0.2, cells = 4.6 } = {}) {
  const pts = [];
  const N = 56;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    pts.push(new THREE.Vector2(eggRadius(t, r), t * h));
  }
  const geo = new THREE.LatheGeometry(pts, 80);
  geo.computeVertexNormals();
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const col = new Float32Array(pos.count * 3);
  const pitC = new THREE.Color(palette.pit), ridgeC = new THREE.Color(palette.ridge), c = new THREE.Color();
  const k = cells / r;
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nor, i);
    const t = p.y / h;
    const [f1, f2] = worleyF12(p.x * k, p.y * k * 0.8, p.z * k, seed);
    // honeycomb: thin ridges where two cells meet, deep bowls inside; no pits at the base
    let depth = smooth(0.06, 0.32, f2 - f1) * smooth(0.02, 0.12, t);
    p.addScaledVector(n, -pitDepth * r * depth);
    pos.setXYZ(i, p.x, p.y, p.z);
    c.copy(pitC).lerp(ridgeC, 1 - depth * 0.85);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

const stemMat = new THREE.MeshStandardMaterial({ color: 0xf1dcc0, roughness: 0.85 });
const doorMat = new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.9 });
const frameMat = new THREE.MeshStandardMaterial({ color: 0x5b3a22, roughness: 0.9 });
const pipeMat = new THREE.MeshStandardMaterial({ color: 0x6f5a4e, roughness: 0.7, metalness: 0.2 });
const warm = () => new THREE.MeshStandardMaterial({ color: 0xffd08a, emissive: 0xffa640, emissiveIntensity: 1.6, roughness: 0.5 });

let smokeTex = null;
function smokeTexture() {
  if (smokeTex) return smokeTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(210,200,210,0.9)');
  g.addColorStop(0.6, 'rgba(190,180,195,0.35)');
  g.addColorStop(1, 'rgba(180,170,190,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  smokeTex = new THREE.CanvasTexture(c);
  return smokeTex;
}

/**
 * @param {object} opts
 * @param {import('./rng.js').Rng} opts.rng
 * @param {number}  [opts.capRadius]
 * @param {number}  [opts.capHeight]
 * @param {number}  [opts.stemHeight]
 * @param {object}  [opts.palette]   { pit, ridge }
 * @param {boolean} [opts.house]
 * @param {string}  [opts.name]
 */
export function createMorel({
  rng,
  capRadius = 0.3,
  capHeight = capRadius * rng.range(1.9, 2.4),
  stemHeight = capRadius * rng.range(0.7, 0.95),
  palette = rng.pick(MOREL_PALETTE),
  house = false,
  name,
} = {}) {
  const group = new THREE.Group();
  const stemR = capRadius * 0.62;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(stemR * 0.98, stemR * 1.06, stemHeight, 24, 1), stemMat);
  stem.position.y = stemHeight / 2;
  group.add(stem);

  const capMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
  const cap = new THREE.Mesh(morelCapGeometry(capRadius, capHeight, rng.int(0, 1e9), palette), capMat);
  cap.position.y = stemHeight * 0.97;
  group.add(cap);

  const windows = [];
  const smoke = [];
  if (house) {
    // Arched door on the stem front.
    const doorW = stemR * 0.9, doorH = stemHeight * 0.62;
    const door = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.02), doorMat);
    slab.position.y = doorH / 2;
    const arch = new THREE.Mesh(new THREE.CylinderGeometry(doorW / 2, doorW / 2, 0.02, 16, 1, false, 0, Math.PI), doorMat);
    arch.rotation.set(Math.PI / 2, Math.PI / 2, 0);
    arch.position.y = doorH;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(doorW * 1.2, doorH * 1.04, 0.012), frameMat);
    frame.position.set(0, doorH / 2, -0.004);
    const archFrame = new THREE.Mesh(new THREE.CylinderGeometry(doorW * 0.6, doorW * 0.6, 0.012, 16, 1, false, 0, Math.PI), frameMat);
    archFrame.rotation.set(Math.PI / 2, Math.PI / 2, 0);
    archFrame.position.set(0, doorH, -0.004);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(doorW * 0.06, 8, 8), warm());
    knob.position.set(doorW * 0.3, doorH * 0.45, 0.015);
    door.add(frame, archFrame, slab, arch, knob);
    door.position.set(0, 0.005, stemR * 1.0);
    group.add(door);
    // Step in front of the door.
    const step = new THREE.Mesh(new THREE.BoxGeometry(doorW * 1.3, 0.015, doorW * 0.5), frameMat);
    step.position.set(0, 0.008, stemR + doorW * 0.25);
    group.add(step);

    // Windows set into the cap: framed, warm, at a few heights around the front half.
    const wm = warm();
    const n = rng.int(2, 4);
    for (let i = 0; i < n; i++) {
      const a = rng.range(-1.3, 1.3) + (i % 2 ? 0.6 : -0.6) * 0.5;
      const t = rng.range(0.22, 0.62);
      const rr = eggRadius(t, capRadius) * 0.9;
      const size = capRadius * rng.range(0.16, 0.22);
      const win = new THREE.Group();
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(size, size * 1.15), wm);
      const fr = new THREE.Mesh(new THREE.TorusGeometry(size * 0.62, size * 0.09, 6, 16), frameMat);
      fr.scale.set(1, 1.15, 1);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(size * 0.08, size * 1.1, 0.008), frameMat);
      const bar2 = new THREE.Mesh(new THREE.BoxGeometry(size * 1.0, size * 0.08, 0.008), frameMat);
      bar.position.z = bar2.position.z = 0.004;
      win.add(glass, fr, bar, bar2);
      win.position.set(Math.sin(a) * rr, cap.position.y + t * capHeight, Math.cos(a) * rr);
      win.lookAt(new THREE.Vector3(Math.sin(a) * rr * 3, win.position.y + capHeight * 0.15, Math.cos(a) * rr * 3));
      group.add(win);
      windows.push(glass);
    }
    // A window on the stem too, sometimes.
    if (rng.chance(0.6)) {
      const a = rng.range(1.2, 1.8) * (rng.chance(0.5) ? 1 : -1);
      const size = stemHeight * 0.22;
      const w = new THREE.Mesh(new THREE.CircleGeometry(size * 0.5, 16), wm);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(size * 0.5, size * 0.07, 6, 16), frameMat);
      const g = new THREE.Group();
      g.add(w, ring);
      g.position.set(Math.sin(a) * (stemR + 0.004), stemHeight * 0.6, Math.cos(a) * (stemR + 0.004));
      g.lookAt(g.position.clone().multiplyScalar(3).setY(g.position.y));
      group.add(g);
      windows.push(w);
    }

    // Chimney pipe out of the cap's side, plus smoke puffs.
    const a = rng.range(-2.6, -1.4) * (rng.chance(0.5) ? 1 : -1);
    const t = 0.72;
    const rr = eggRadius(t, capRadius) * 0.8;
    const pipe = new THREE.Group();
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(capRadius * 0.07, capRadius * 0.07, capRadius * 0.5, 10), pipeMat);
    tube.position.y = capRadius * 0.25;
    const hat = new THREE.Mesh(new THREE.ConeGeometry(capRadius * 0.11, capRadius * 0.08, 10), pipeMat);
    hat.position.y = capRadius * 0.53;
    pipe.add(tube, hat);
    pipe.position.set(Math.sin(a) * rr, cap.position.y + t * capHeight, Math.cos(a) * rr);
    pipe.rotation.z = -Math.sin(a) * 0.35;
    pipe.rotation.x = Math.cos(a) * 0.35;
    group.add(pipe);
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTexture(), transparent: true, depthWrite: false, opacity: 0.5 }));
      s.raycast = () => {};
      s.userData.phase = i / 4;
      pipe.add(s);
      smoke.push(s);
    }
  }

  const displayName = name ?? (house ? `${rng.pick(NAME_A)} ${rng.pick(NAME_B)}` : 'Wild morel');
  let puff = 0;
  const ud = {
    type: 'mushroom',
    house,
    name: displayName,
    lit: true,
    cap, stem, windows,
    baseEmissive: 0,
    setLit(on) {
      ud.lit = on;
      for (const w of windows) w.material.emissiveIntensity = on ? 1.6 : 0.04;
    },
    /** Extra burst of smoke for a moment. */
    puff() { puff = 2.5; },
    update(dt, t) {
      if (!smoke.length) return;
      if (puff > 0) puff -= dt;
      const boost = puff > 0 ? 1.8 : 1;
      for (const s of smoke) {
        const k = ((t * 0.25 + s.userData.phase) % 1);
        s.position.set(Math.sin(k * 9 + s.userData.phase * 7) * 0.02 * k, capRadius * (0.55 + k * 0.55 * boost), 0);
        s.scale.setScalar(capRadius * (0.12 + k * 0.32) * boost);
        s.material.opacity = (1 - k) * 0.55 * (ud.lit ? 1 : 0.3);
      }
    },
  };
  group.userData = ud;
  group.traverse((o) => { if (o !== group) o.userData.pickRoot = group; });
  return group;
}

/** A few small morels around the local origin. */
export function createMorelCluster({ rng, count = 3, spread = 0.1, scale = 1 } = {}) {
  const group = new THREE.Group();
  const palette = rng.pick(MOREL_PALETTE);
  for (let i = 0; i < count; i++) {
    const r = rng.range(0.035, 0.07) * scale;
    const m = createMorel({ rng, capRadius: r, palette });
    m.position.set(rng.range(-spread, spread), 0, rng.range(-spread, spread));
    m.rotation.set(rng.range(-0.25, 0.25), rng.range(0, Math.PI * 2), rng.range(-0.25, 0.25));
    group.add(m);
  }
  group.userData = { type: 'cluster', name: 'Morel patch' };
  group.traverse((o) => { if (o !== group) o.userData.pickRoot = group; });
  return group;
}
