// Parametric glowing mushrooms: a lathe cap with painted spots, a cream stem,
// and optionally a door and lit windows so the mushroom is a house.

import * as THREE from 'three';

export const CAP_PALETTE = [
  { cap: '#2f7bff', spot: '#9ef5ff' }, // royal blue
  { cap: '#37e6d4', spot: '#e6fffb' }, // cyan
  { cap: '#6a5cff', spot: '#c9c0ff' }, // violet
  { cap: '#a35cff', spot: '#f0d6ff' }, // purple
  { cap: '#3fd0ff', spot: '#ffffff' }, // sky
];

const NAME_A = ['Blue', 'Glow', 'Moss', 'Dew', 'Star', 'Fog', 'Moon', 'Twilight', 'Ember', 'Frost'];
const NAME_B = ['Cap Cottage', 'Spore Inn', 'Hollow', 'Lantern House', 'Cap Lodge', 'Nook', 'Roost', 'Burrow'];

const geoCache = new Map();

/** Dome profile for LatheGeometry: top centre → rim → curled lip → underside. */
export function capGeometry(r, h) {
  const key = `${r.toFixed(3)}:${h.toFixed(3)}`;
  if (geoCache.has(key)) return geoCache.get(key);
  const pts = [];
  const segs = 16;
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 0.5;
    pts.push(new THREE.Vector2(Math.sin(a) * r, Math.cos(a) * h));
  }
  pts.push(new THREE.Vector2(r * 0.985, -h * 0.07));
  pts.push(new THREE.Vector2(r * 0.86, -h * 0.1));
  pts.push(new THREE.Vector2(r * 0.4, -h * 0.03));
  pts.push(new THREE.Vector2(0.001, 0));
  pts.reverse(); // lathe winds outward-facing only when the profile climbs in y
  const geo = new THREE.LatheGeometry(pts, 28);
  geoCache.set(key, geo);
  return geo;
}

export function capTextures(rng, capHex, spotHex, spots) {
  const W = 512, H = 256;
  const albedo = document.createElement('canvas');
  albedo.width = W; albedo.height = H;
  const glow = document.createElement('canvas');
  glow.width = W; glow.height = H;
  const a = albedo.getContext('2d');
  const g = glow.getContext('2d');

  // Lathe v runs underside→rim→top; with 4 underside points of 21 the rim sits
  // at v≈0.2, i.e. canvas y≈0.8H. Dome above it, gills below.
  const RIM = 0.8;
  const base = new THREE.Color(capHex);
  const light = base.clone().lerp(new THREE.Color(spotHex), 0.35);
  const grad = a.createLinearGradient(0, 0, 0, H * RIM);
  grad.addColorStop(0, `#${base.getHexString()}`);
  grad.addColorStop(1, `#${light.getHexString()}`);
  a.fillStyle = grad;
  a.fillRect(0, 0, W, H);
  // Underside (gills) a touch darker.
  a.fillStyle = `#${base.clone().multiplyScalar(0.55).getHexString()}`;
  a.fillRect(0, H * RIM, W, H * (1 - RIM));

  g.fillStyle = '#5a5a5a';
  g.fillRect(0, 0, W, H * RIM);
  g.fillStyle = '#202020';
  g.fillRect(0, H * RIM, W, H * (1 - RIM));

  if (spots) {
    const n = rng.int(7, 14);
    for (let i = 0; i < n; i++) {
      const x = rng.range(0, W), y = rng.range(H * 0.05, H * 0.62);
      const rx = rng.range(10, 30), ry = rx * rng.range(0.5, 0.9);
      for (const [ctx, color, alpha] of [[a, spotHex, 0.85], [g, '#ffffff', 0.9]]) {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        for (const dx of [0, -W, W]) {
          ctx.beginPath();
          ctx.ellipse(x + dx, y, rx, ry, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    a.globalAlpha = 1; g.globalAlpha = 1;
  }

  const map = new THREE.CanvasTexture(albedo);
  map.colorSpace = THREE.SRGBColorSpace;
  const emissiveMap = new THREE.CanvasTexture(glow);
  return { map, emissiveMap };
}

const stemMaterial = new THREE.MeshStandardMaterial({
  color: 0xe9dcc6, roughness: 0.75, emissive: 0xffe4c4, emissiveIntensity: 0.1,
});
const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x5b3b22, roughness: 0.9 });
const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x3a2412, roughness: 0.9 });

function windowMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xffc670, emissive: 0xffa640, emissiveIntensity: 2.4, roughness: 0.4,
  });
}

/**
 * @param {object} opts
 * @param {import('./rng.js').Rng} opts.rng
 * @param {number}  [opts.capRadius]
 * @param {number}  [opts.stemHeight]
 * @param {object}  [opts.palette]   { cap, spot } hex strings
 * @param {boolean} [opts.house]     add a door and windows
 * @param {boolean} [opts.spots]
 * @param {string}  [opts.name]
 */
export function createMushroom({
  rng,
  capRadius = 0.3,
  stemHeight = 0.55,
  palette = rng.pick(CAP_PALETTE),
  house = false,
  spots = true,
  name,
} = {}) {
  const group = new THREE.Group();
  const capHeight = capRadius * rng.range(0.5, 0.68);
  const stemTop = capRadius * 0.4;
  const stemBottom = capRadius * rng.range(0.48, 0.58);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(stemTop, stemBottom, stemHeight, 20, 1), stemMaterial);
  stem.position.y = stemHeight / 2;
  group.add(stem);

  const { map, emissiveMap } = capTextures(rng, palette.cap, palette.spot, spots);
  const capMat = new THREE.MeshStandardMaterial({
    map, emissiveMap,
    emissive: new THREE.Color(palette.cap),
    emissiveIntensity: 0.7,
    roughness: 0.45,
  });
  const cap = new THREE.Mesh(capGeometry(capRadius, capHeight), capMat);
  cap.position.y = stemHeight * 0.98;
  group.add(cap);

  const windows = [];
  if (house) {
    // Door on the front of the stem.
    const doorW = stemBottom * 1.0, doorH = stemHeight * 0.42;
    const door = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.02), doorMaterial);
    slab.position.y = doorH / 2;
    const arch = new THREE.Mesh(new THREE.CylinderGeometry(doorW / 2, doorW / 2, 0.02, 16, 1, false, 0, Math.PI), doorMaterial);
    arch.rotation.x = Math.PI / 2;
    arch.rotation.y = Math.PI / 2;
    arch.position.y = doorH;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(doorW * 1.18, doorH * 1.06, 0.012), frameMaterial);
    frame.position.y = doorH / 2;
    frame.position.z = -0.004;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(doorW * 0.07, 8, 8), windowMaterial());
    knob.position.set(doorW * 0.3, doorH * 0.5, 0.015);
    door.add(frame, slab, arch, knob);
    door.position.set(0, 0.01, stemBottom * 0.96);
    group.add(door);

    // Windows: one or two on the stem, one on the cap.
    const wm = windowMaterial();
    const stemWin = (angle, y, round) => {
      const size = stemHeight * 0.13;
      const geo = round ? new THREE.CircleGeometry(size * 0.55, 16) : new THREE.PlaneGeometry(size, size);
      const w = new THREE.Mesh(geo, wm);
      const rr = THREE.MathUtils.lerp(stemBottom, stemTop, y / stemHeight) + 0.004;
      w.position.set(Math.sin(angle) * rr, y, Math.cos(angle) * rr);
      w.lookAt(w.position.clone().multiplyScalar(2).setY(y));
      group.add(w);
      windows.push(w);
    };
    stemWin(rng.range(1.1, 1.6), stemHeight * rng.range(0.45, 0.65), rng.chance(0.5));
    if (rng.chance(0.6)) stemWin(-rng.range(1.1, 1.6), stemHeight * rng.range(0.35, 0.6), rng.chance(0.5));
    // Cap window: sits on the dome, tilted with the surface.
    {
      const a = rng.range(-0.5, 0.5);
      const t = 0.62; // fraction down the dome
      const ang = t * Math.PI * 0.5;
      const r = Math.sin(ang) * capRadius, h = Math.cos(ang) * capHeight;
      const w = new THREE.Mesh(new THREE.CircleGeometry(capRadius * 0.11, 16), wm);
      w.position.set(Math.sin(a) * r, cap.position.y + h, Math.cos(a) * r);
      const normal = new THREE.Vector3(Math.sin(a) * Math.sin(ang) / capRadius, Math.cos(ang) / capHeight, Math.cos(a) * Math.sin(ang) / capRadius).normalize();
      w.position.addScaledVector(normal, 0.004);
      w.lookAt(w.position.clone().add(normal));
      group.add(w);
      windows.push(w);
    }
    // Soft warm light spilling from the door, so houses read as inhabited.
    const glowMat = windowMaterial();
    glowMat.transparent = true; glowMat.opacity = 0.9;
    const doormat = new THREE.Mesh(new THREE.CircleGeometry(doorW * 0.8, 12), glowMat);
    doormat.rotation.x = -Math.PI / 2;
    doormat.position.set(0, 0.006, stemBottom + doorW * 0.5);
    doormat.scale.set(1, 0.55, 1);
    group.add(doormat);
    windows.push(doormat);
  }

  const displayName = name ?? (house ? `${rng.pick(NAME_A)} ${rng.pick(NAME_B)}` : 'Wild mushroom');
  const ud = {
    type: 'mushroom',
    house,
    name: displayName,
    lit: true,
    cap, stem, windows,
    baseEmissive: capMat.emissiveIntensity,
    setLit(on) {
      ud.lit = on;
      for (const w of windows) w.material.emissiveIntensity = on ? 2.4 : 0.05;
    },
  };
  group.userData = ud;
  // Children resolve to the group when picked.
  group.traverse((o) => { if (o !== group) o.userData.pickRoot = group; });
  return group;
}

/** A tuft of a few small mushrooms around the local origin, lying on the local XZ plane. */
export function createMushroomCluster({ rng, count = 3, palette = rng.pick(CAP_PALETTE), spread = 0.12, scale = 1 } = {}) {
  const group = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const s = rng.range(0.05, 0.11) * scale;
    const m = createMushroom({
      rng, capRadius: s, stemHeight: s * rng.range(1.2, 2.2), palette, spots: rng.chance(0.7),
    });
    m.position.set(rng.range(-spread, spread), 0, rng.range(-spread, spread));
    m.rotation.set(rng.range(-0.25, 0.25), rng.range(0, Math.PI * 2), rng.range(-0.25, 0.25));
    group.add(m);
  }
  group.userData = { type: 'cluster', name: 'Mushroom tuft' };
  group.traverse((o) => { if (o !== group) o.userData.pickRoot = group; });
  return group;
}
