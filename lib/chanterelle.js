// Golden chanterelles: a trumpet-shaped funnel cap with a wavy rim, ridged
// false gills underneath and a dip in the middle; a tapering stem; house
// variant with arched windows, a door and sometimes a balcony.

import * as THREE from 'three';

export const CHANTERELLE_PALETTE = [
  { top: '#f9d25c', under: '#e8a63a', stem: '#f2cf7e' },
  { top: '#ffd96a', under: '#efb247', stem: '#f6d68a' },
  { top: '#f2c449', under: '#dc9430', stem: '#eec572' },
  { top: '#fbd66e', under: '#e9ad48', stem: '#f4d184' },
];

const NAME_A = ['Golden', 'Trumpet', 'Amber', 'Honey', 'Saffron', 'Butter', 'Sunny', 'Marigold'];
const NAME_B = ['Tower', 'House', 'Lodge', 'Loft', 'Library', 'Bakery', 'Nook', 'Chapel'];

const smooth = (a, b, x) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/**
 * Funnel profile: from the stem top out along the underside to the rim, then
 * back in over the top to a central dip. Returns points and the rim index.
 */
function funnelProfile(r, h, r0) {
  const pts = [];
  const N = 18;
  // underside: flare out and up
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    // trumpet: rise almost straight up first, then flare out
    const x = r0 + (r - r0) * Math.pow(t, 1.7);
    const y = h * 0.8 * Math.pow(t, 0.85);
    pts.push(new THREE.Vector2(x, y));
  }
  const rim = pts.length - 1;
  // lip: tiny climb over the edge
  pts.push(new THREE.Vector2(r * 0.995, h * 0.82));
  // top: back in with a dip in the middle
  const M = 12;
  for (let i = 1; i <= M; i++) {
    const t = i / M;
    const x = r * (1 - t) * 0.97 + 0.001;
    const y = h * (0.82 - 0.24 * Math.pow(t, 1.4));
    pts.push(new THREE.Vector2(Math.max(0.001, x), y));
  }
  return { pts, rim };
}

/**
 * Chanterelle cap geometry with vertex colours.
 * @param {number} r  rim radius
 * @param {number} h  height
 * @param {number} r0 radius where it meets the stem
 * @param {object} palette { top, under }
 * @param {import('./rng.js').Rng} rng
 */
export function chanterelleCapGeometry(r, h, r0, palette, rng) {
  const { pts, rim } = funnelProfile(r, h, r0);
  const segs = 72;
  const geo = new THREE.LatheGeometry(pts, segs);
  const pos = geo.attributes.position;
  const P = pts.length;
  const waves = rng.int(3, 5);
  const phase = rng.range(0, Math.PI * 2);
  const amp = rng.range(0.045, 0.09);
  const topC = new THREE.Color(palette.top), underC = new THREE.Color(palette.under), c = new THREE.Color();
  const col = new Float32Array(pos.count * 3);
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const j = i % P;
    p.fromBufferAttribute(pos, i);
    const phi = Math.atan2(p.z, p.x);
    const radial = Math.hypot(p.x, p.z);
    // how close to the rim along the profile (both sides)
    const rimW = j <= rim ? smooth(0.35, 1, j / rim) : smooth(0.35, 1, 1 - (j - rim - 1) / (P - rim - 1));
    // wavy rim: radial and vertical ripples that fade toward the centre
    const wave = Math.sin(phi * waves + phase) + 0.4 * Math.sin(phi * (waves * 2 + 1) - phase);
    const scale = 1 + amp * wave * rimW;
    let y = p.y + h * 0.08 * Math.sin(phi * waves + phase + 1.3) * rimW;
    // ridged false gills on the underside
    if (j <= rim && radial > 1e-4) {
      const ridge = Math.sin(phi * 34) * 0.5 + 0.5;
      const gillW = smooth(0.1, 0.9, j / rim);
      y -= h * 0.03 * ridge * gillW;
      c.copy(underC).multiplyScalar(0.78 + 0.22 * ridge);
    } else {
      c.copy(topC);
      // slightly darker toward the dip
      const dipW = j > rim ? (j - rim - 1) / (P - rim - 1) : 0;
      c.multiplyScalar(1 - 0.18 * dipW);
    }
    pos.setXYZ(i, p.x * scale, y, p.z * scale);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

const doorMat = new THREE.MeshStandardMaterial({ color: 0x6b4426, roughness: 0.9 });
const frameMat = new THREE.MeshStandardMaterial({ color: 0x4a2c16, roughness: 0.9 });
const railMat = new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.9 });
const warm = () => new THREE.MeshStandardMaterial({ color: 0xfff0b0, emissive: 0xffb54a, emissiveIntensity: 1.5, roughness: 0.5 });

/**
 * @param {object} opts
 * @param {import('./rng.js').Rng} opts.rng
 * @param {number}  [opts.capRadius]
 * @param {number}  [opts.stemHeight]
 * @param {object}  [opts.palette]
 * @param {boolean} [opts.house]
 * @param {string}  [opts.name]
 */
export function createChanterelle({
  rng,
  capRadius = 0.3,
  stemHeight = capRadius * rng.range(1.4, 2.2),
  palette = rng.pick(CHANTERELLE_PALETTE),
  house = false,
  name,
} = {}) {
  const group = new THREE.Group();
  const stemTop = capRadius * 0.36;
  const stemBottom = capRadius * rng.range(0.24, 0.3);
  const stemMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(palette.stem), roughness: 0.85 });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(stemTop, stemBottom, stemHeight, 24, 1), stemMat);
  stem.position.y = stemHeight / 2;
  group.add(stem);

  const capHeight = capRadius * rng.range(0.85, 1.1);
  const capMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide });
  const cap = new THREE.Mesh(chanterelleCapGeometry(capRadius, capHeight, stemTop * 0.98, palette, rng), capMat);
  cap.position.y = stemHeight * 0.96;
  cap.rotation.y = rng.range(0, Math.PI * 2);
  group.add(cap);

  const windows = [];
  if (house) {
    const wm = warm();
    // Arched door at the base.
    const doorW = stemBottom * 1.1, doorH = stemHeight * 0.28;
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
    const knob = new THREE.Mesh(new THREE.SphereGeometry(doorW * 0.06, 8, 8), wm);
    knob.position.set(doorW * 0.3, doorH * 0.45, 0.015);
    door.add(frame, archFrame, slab, arch, knob);
    door.position.set(0, 0.005, stemBottom * 0.98);
    group.add(door);

    // Arched windows up the stem: a few, spiralling.
    const n = rng.int(2, 4);
    for (let i = 0; i < n; i++) {
      const a = rng.range(-0.9, 0.9) + (i % 2 ? 1.4 : -1.4) * rng.range(0.4, 1);
      const y = stemHeight * (0.3 + 0.55 * (i + rng.range(0.1, 0.9)) / (n + 1));
      const size = stemHeight * 0.1;
      const rr = THREE.MathUtils.lerp(stemBottom, stemTop, y / stemHeight) + 0.004;
      const win = new THREE.Group();
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(size, size), wm);
      const top = new THREE.Mesh(new THREE.CircleGeometry(size / 2, 12, 0, Math.PI), wm);
      top.position.y = size / 2;
      const fr = new THREE.Mesh(new THREE.PlaneGeometry(size * 1.25, size * 1.25), frameMat);
      fr.position.z = -0.003;
      const frTop = new THREE.Mesh(new THREE.CircleGeometry(size * 0.625, 12, 0, Math.PI), frameMat);
      frTop.position.set(0, size * 0.5, -0.003);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(size * 0.08, size * 1.4, 0.006), frameMat);
      bar.position.set(0, size * 0.15, 0.003);
      const bar2 = new THREE.Mesh(new THREE.BoxGeometry(size, size * 0.08, 0.006), frameMat);
      bar2.position.z = 0.003;
      win.add(fr, frTop, glass, top, bar, bar2);
      win.position.set(Math.sin(a) * rr, y, Math.cos(a) * rr);
      win.lookAt(win.position.clone().multiplyScalar(3).setY(y));
      group.add(win);
      windows.push(glass, top);
    }

    // Balcony, sometimes: a half-disc ledge with railing posts.
    if (rng.chance(0.45)) {
      const a = rng.range(-0.6, 0.6);
      const y = stemHeight * rng.range(0.5, 0.7);
      const rr = THREE.MathUtils.lerp(stemBottom, stemTop, y / stemHeight);
      const bal = new THREE.Group();
      const ledgeR = rr * 1.2;
      const ledge = new THREE.Mesh(new THREE.CylinderGeometry(ledgeR, ledgeR, 0.012, 16, 1, false, 0, Math.PI), railMat);
      bal.add(ledge);
      for (let i = 0; i <= 5; i++) {
        const t = (i / 5) * Math.PI;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.06, 6), frameMat);
        post.position.set(Math.cos(t) * ledgeR * 0.92, 0.03, Math.sin(t) * ledgeR * 0.92);
        bal.add(post);
      }
      const rail = new THREE.Mesh(new THREE.TorusGeometry(ledgeR * 0.92, 0.006, 6, 20, Math.PI), frameMat);
      rail.rotation.x = Math.PI / 2;
      rail.position.y = 0.06;
      bal.add(rail);
      const bdoor = new THREE.Mesh(new THREE.PlaneGeometry(rr * 0.6, 0.08), wm);
      bdoor.position.set(0, 0.045, -rr * 0.02);
      bal.add(bdoor);
      windows.push(bdoor);
      bal.position.set(Math.sin(a) * rr * 0.55, y, Math.cos(a) * rr * 0.55);
      bal.rotation.y = -a;
      group.add(bal);
    }
  }

  const displayName = name ?? (house ? `${rng.pick(NAME_A)} ${rng.pick(NAME_B)}` : 'Wild chanterelle');
  const ud = {
    type: 'mushroom',
    house,
    name: displayName,
    lit: true,
    cap, stem, windows,
    baseEmissive: 0,
    setLit(on) {
      ud.lit = on;
      for (const w of windows) w.material.emissiveIntensity = on ? 1.5 : 0.04;
    },
  };
  group.userData = ud;
  group.traverse((o) => { if (o !== group) o.userData.pickRoot = group; });
  return group;
}

/** A few small chanterelles around the local origin. */
export function createChanterelleCluster({ rng, count = 3, spread = 0.1, scale = 1 } = {}) {
  const group = new THREE.Group();
  const palette = rng.pick(CHANTERELLE_PALETTE);
  for (let i = 0; i < count; i++) {
    const r = rng.range(0.04, 0.09) * scale;
    const m = createChanterelle({ rng, capRadius: r, stemHeight: r * rng.range(0.9, 1.6), palette });
    m.position.set(rng.range(-spread, spread), 0, rng.range(-spread, spread));
    m.rotation.set(rng.range(-0.3, 0.3), rng.range(0, Math.PI * 2), rng.range(-0.3, 0.3));
    group.add(m);
  }
  group.userData = { type: 'cluster', name: 'Chanterelle patch' };
  group.traverse((o) => { if (o !== group) o.userData.pickRoot = group; });
  return group;
}
