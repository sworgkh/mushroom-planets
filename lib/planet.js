// A small bumpy mossy planet with glowing rivers painted on it. The rivers
// are generated as 3D walks on the sphere first, then drawn onto the texture,
// so the same curves can be used as walking paths for characters.

import * as THREE from 'three';
import { fbm3 } from './rng.js';
import { randomDir, scatterDirs, dirToUv } from './surface.js';

/**
 * @param {object} opts
 * @param {import('./rng.js').Rng} opts.rng
 * @param {number} [opts.radius]
 * @param {number} [opts.bump]        relief amplitude as a fraction of radius
 * @param {number} [opts.riverCount]
 * @param {object} [opts.colors]      { moss, mossDark, purple, river, riverCore }
 * @param {number} [opts.bushCount]   instanced foliage blobs
 * @param {number} [opts.sparkCount]  instanced glowing specks
 */
export function createPlanet({
  rng,
  radius = 2,
  bump = 0.035,
  riverCount = 4,
  colors = {},
  bushCount = 300,
  sparkCount = 320,
  texSize = 2048,
  style = 'glow', // 'glow' rivers | 'cobble' paths
} = {}) {
  const c = {
    moss: '#14484a',
    mossDark: '#0b2e34',
    mossLight: '#237a6c',
    purple: '#4a3aa8',
    river: '#3ff2dc',
    riverCore: '#d8fff8',
    lichen: '#d9822b', lichenLight: '#f2a54a', lichenDark: '#a85a1c',
    path: '#9d9283', pathEdge: '#5a5048', stoneA: '#b8ad9c', stoneB: '#8f8577', stoneC: '#cfc4b0',
    ...colors,
  };
  const noiseSeed = rng.int(0, 1e9);
  const radiusAt = (dir) => radius * (1 + bump * fbm3(dir.x * 3.1, dir.y * 3.1, dir.z * 3.1, { seed: noiseSeed, octaves: 4 }));

  const rivers = buildRivers(rng.fork('rivers'), riverCount);
  const { map, emissiveMap } = paintTextures(rng.fork('paint'), rivers, c, texSize, style);

  const geometry = new THREE.SphereGeometry(radius, 192, 128);
  displace(geometry, radiusAt);

  const material = new THREE.MeshStandardMaterial({
    map,
    emissiveMap,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: style === 'cobble' ? 0 : 1.5,
    roughness: 0.95,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData = { type: 'ground', name: 'Mossy ground' };

  const group = new THREE.Group();
  group.name = 'planet';
  group.add(mesh);
  group.add(buildBushes(rng.fork('bushes'), bushCount, radiusAt, c));
  if (style !== 'cobble') group.add(buildSparks(rng.fork('sparks'), sparkCount, radiusAt, c, rivers));

  // River curves at the actual surface height, for anything that walks them.
  const curves = rivers.map((pts) => {
    const onSurface = pts.map((d) => d.clone().multiplyScalar(radiusAt(d) + 0.02));
    return new THREE.CatmullRomCurve3(onSurface, false, 'centripetal', 0.5);
  });

  return { group, mesh, radius, radiusAt, rivers, curves, seed: noiseSeed };
}

// --- Rivers ----------------------------------------------------------------

function buildRivers(rng, count) {
  const rivers = [];
  // Spread the sources around the globe so every side gets some water.
  const sources = scatterDirs(rng, count, Math.PI / 2.2);
  for (let i = 0; i < count; i++) {
    // Some rivers branch off an earlier one, like the tributaries in the reference.
    const branch = i > 0 && rng.chance(0.4);
    const start = branch
      ? rng.pick(rivers)[rng.int(2, 10)].clone()
      : (sources[i] ?? randomDir(rng));
    rivers.push(walkOnSphere(rng, start, rng.int(80, 120), 0.028, 0.35));
  }
  return rivers;
}

/** A meandering path of unit vectors: constant step angle, slowly drifting heading. */
function walkOnSphere(rng, start, steps, stepAngle, maxDrift) {
  const p = start.clone().normalize();
  const t = randomDir(rng);
  t.addScaledVector(p, -t.dot(p)).normalize();
  const pts = [p.clone()];
  let drift = rng.range(-maxDrift, maxDrift);
  for (let i = 0; i < steps; i++) {
    drift = THREE.MathUtils.clamp(drift + rng.range(-0.12, 0.12), -maxDrift, maxDrift);
    t.applyAxisAngle(p, drift * 0.35);
    p.addScaledVector(t, stepAngle).normalize();
    t.addScaledVector(p, -t.dot(p)).normalize();
    pts.push(p.clone());
  }
  return pts;
}

// --- Texture painting ------------------------------------------------------

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  return canvas;
}

function paintTextures(rng, rivers, c, W, style) {
  const H = W / 2;
  const albedo = makeCanvas(W, H);
  const glow = makeCanvas(W, H);
  const a = albedo.getContext('2d');
  const g = glow.getContext('2d');

  // Moss: layered soft blobs in a few shades plus accent patches.
  a.fillStyle = c.moss;
  a.fillRect(0, 0, W, H);
  const palette = [c.mossDark, c.moss, c.mossLight, c.moss, c.mossDark, c.purple];
  for (let i = 0; i < 7000; i++) {
    const r = rng.range(3, 34);
    a.globalAlpha = rng.range(0.25, 0.6);
    a.fillStyle = rng.pick(palette);
    dot(a, rng.range(0, W), rng.range(0, H), r, true, W);
  }
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);

  if (style === 'cobble') {
    // Lichen: a few big soft orange patches made of many small dots.
    const lichen = [c.lichen, c.lichenLight, c.lichen, c.lichenDark];
    for (let k = 0; k < 26; k++) {
      const cx = rng.range(0, W), cy = rng.range(H * 0.1, H * 0.9), R = rng.range(40, 120);
      for (let i = 0; i < 180; i++) {
        const ang = rng.range(0, Math.PI * 2), rr = Math.sqrt(rng.next()) * R;
        a.globalAlpha = rng.range(0.35, 0.8);
        a.fillStyle = rng.pick(lichen);
        dot(a, cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr * 0.7, rng.range(2, 7), true, W);
      }
    }
    a.globalAlpha = 1;
    // Cobble paths: dark edge, fill, then individual stones.
    a.lineCap = 'round'; a.lineJoin = 'round';
    for (const [w, col] of [[42, c.pathEdge], [36, c.path]]) {
      a.strokeStyle = col; a.lineWidth = w;
      for (const pts of rivers) strokeSpherePath(a, pts, W, H);
    }
    const stones = [c.stoneA, c.stoneB, c.stoneC];
    for (const pts of rivers) {
      forEachAlongPath(pts, W, H, 8, (x, y, nx, ny) => {
        for (let k = -2; k <= 2; k++) {
          const off = k * 7 + rng.range(-2, 2);
          const sx = x + nx * off, sy = y + ny * off;
          a.fillStyle = rng.pick(stones);
          a.globalAlpha = 0.95;
          a.beginPath();
          a.ellipse(sx, sy, rng.range(3, 4.6), rng.range(2.2, 3.4), rng.range(0, Math.PI), 0, Math.PI * 2);
          a.fill();
        }
      });
    }
    a.globalAlpha = 1;
  } else {
    // Tiny leaf specks: on the albedo lightly, and very faintly on the glow map.
    for (let i = 0; i < 6000; i++) {
      const x = rng.range(0, W), y = rng.range(0, H), r = rng.range(1, 2.6);
      a.globalAlpha = 0.5;
      a.fillStyle = rng.chance(0.75) ? '#2fd6c0' : '#8a7cff';
      dot(a, x, y, r, false, W);
      g.globalAlpha = 0.1;
      g.fillStyle = a.fillStyle;
      dot(g, x, y, r, false, W);
    }
    a.globalAlpha = 1;
    g.globalAlpha = 1;

    // Rivers: wide soft glow, then a bright core, on both maps.
    const layers = [
      { width: 34, alpha: 0.2, color: c.river },
      { width: 18, alpha: 0.5, color: c.river },
      { width: 9, alpha: 1.0, color: c.river },
      { width: 3, alpha: 0.9, color: c.riverCore },
    ];
    for (const ctx of [a, g]) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const layer of layers) {
        ctx.globalAlpha = layer.alpha;
        ctx.strokeStyle = layer.color;
        ctx.lineWidth = layer.width;
        for (const pts of rivers) strokeSpherePath(ctx, pts, W, H);
      }
      ctx.globalAlpha = 1;
    }
  }

  const map = new THREE.CanvasTexture(albedo);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const emissiveMap = new THREE.CanvasTexture(glow);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  emissiveMap.anisotropy = 8;
  return { map, emissiveMap };
}

/** Walk a sphere path in texture space, calling fn(x, y, nx, ny) every `step` px (n = unit normal). */
function forEachAlongPath(pts, W, H, step, fn) {
  const uv = pts.map((d) => { const [u, v] = dirToUv(d); return [u * W, (1 - v) * H]; });
  let carry = 0;
  for (let i = 0; i < uv.length - 1; i++) {
    let [x0, y0] = uv[i];
    const [x1, y1] = uv[i + 1];
    if (Math.abs(x1 - x0) > W / 2) continue; // skip the seam segment
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    const nx = -dy / len, ny = dx / len;
    for (let t = carry; t < len; t += step) fn(x0 + dx * (t / len), y0 + dy * (t / len), nx, ny);
    carry = (carry + Math.ceil((len - carry) / step) * step) - len;
  }
}

/** Filled circle; optionally also drawn wrapped across the horizontal seam. */
function dot(ctx, x, y, r, wrap, W) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  if (wrap && (x < r || x > W - r)) {
    ctx.beginPath();
    ctx.arc(x < r ? x + W : x - W, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Stroke a path of unit vectors in equirectangular space, handling the seam. */
function strokeSpherePath(ctx, pts, W, H) {
  const uv = pts.map((d) => {
    const [u, v] = dirToUv(d);
    return [u * W, (1 - v) * H];
  });
  for (let i = 0; i < uv.length - 1; i++) {
    let [x0, y0] = uv[i];
    let [x1, y1] = uv[i + 1];
    if (Math.abs(x1 - x0) > W / 2) {
      // Crosses the seam: draw the segment twice, shifted each way.
      const shift = x1 > x0 ? -W : W;
      seg(ctx, x0, y0, x1 + shift, y1);
      seg(ctx, x0 - shift, y0, x1, y1);
    } else {
      seg(ctx, x0, y0, x1, y1);
    }
  }
}

function seg(ctx, x0, y0, x1, y1) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

// --- Geometry --------------------------------------------------------------

function displace(geometry, radiusAt) {
  const pos = geometry.attributes.position;
  const d = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    d.fromBufferAttribute(pos, i).normalize();
    const r = radiusAt(d);
    pos.setXYZ(i, d.x * r, d.y * r, d.z * r);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
}

// --- Instanced foliage -----------------------------------------------------

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

function buildBushes(rng, count, radiusAt, c) {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const mat = new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true, emissive: new THREE.Color(c.bushGlow ?? '#1a7a6a'), emissiveIntensity: c.bushGlow === null ? 0 : 0.1 });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const shades = (c.bushShades ?? [c.mossDark, c.moss, c.mossLight, c.purple, '#1b4f7a']).map((h) => new THREE.Color(h));
  for (let i = 0; i < count; i++) {
    const dir = randomDir(rng);
    const s = rng.range(0.035, 0.095);
    _s.set(s * rng.range(0.8, 1.3), s * rng.range(0.5, 0.9), s * rng.range(0.8, 1.3));
    _p.copy(dir).multiplyScalar(radiusAt(dir) - s * 0.25);
    _q.setFromUnitVectors(UP, dir);
    _m.compose(_p, _q, _s);
    mesh.setMatrixAt(i, _m);
    mesh.setColorAt(i, rng.pick(shades));
  }
  mesh.userData = { type: 'ground', name: 'Mossy ground' };
  mesh.name = 'bushes';
  return mesh;
}

/** Small glowing specks, denser near rivers so the banks shimmer. */
function buildSparks(rng, count, radiusAt, c, rivers) {
  const geo = new THREE.SphereGeometry(1, 6, 5);
  const mat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(c.river), emissiveIntensity: 1.4 });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const riverPts = rivers.flat();
  for (let i = 0; i < count; i++) {
    let dir;
    if (riverPts.length && rng.chance(0.65)) {
      dir = rng.pick(riverPts).clone();
      dir.add(randomDir(rng).multiplyScalar(rng.range(0.03, 0.09))).normalize();
    } else {
      dir = randomDir(rng);
    }
    const s = rng.range(0.008, 0.02);
    _s.set(s, s * 0.6, s);
    _p.copy(dir).multiplyScalar(radiusAt(dir) + 0.005);
    _q.setFromUnitVectors(UP, dir);
    _m.compose(_p, _q, _s);
    mesh.setMatrixAt(i, _m);
  }
  mesh.raycast = () => {}; // never picked
  mesh.name = 'sparks';
  return mesh;
}
