// Night sky: a star field, a crescent moon sprite that also drives the key
// light, and a faint purple haze.

import * as THREE from 'three';

function softDot(size = 64, inner = '#ffffff', outer = 'rgba(255,255,255,0)') {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function starLayer(rng, count, size, distance, colors) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const z = rng.range(-1, 1), a = rng.range(0, Math.PI * 2), r = Math.sqrt(1 - z * z);
    pos[i * 3] = r * Math.cos(a) * distance;
    pos[i * 3 + 1] = r * Math.sin(a) * distance;
    pos[i * 3 + 2] = z * distance;
    c.set(rng.pick(colors));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size, sizeAttenuation: false, map: softDot(), vertexColors: true,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.raycast = () => {};
  return pts;
}

function crescentTexture(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const r = size * 0.28;
  ctx.shadowColor = 'rgba(200, 230, 255, 0.9)';
  ctx.shadowBlur = size * 0.12;
  ctx.fillStyle = '#eef6ff';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(size / 2 + r * 0.55, size / 2 - r * 0.25, r * 0.92, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * @param {object} opts
 * @param {import('./rng.js').Rng} opts.rng
 * @param {THREE.Vector3} [opts.moonDir]  direction of the moon from the origin
 */
export function createSky({
  rng,
  moon = true,
  moonDir = new THREE.Vector3(0.16, 0.1, -0.95).normalize(),
  moonDistance = 34,
  starColors = ['#ffffff', '#dfe9ff', '#c9f6ff', '#e8dcff'],
  brightStarColors = ['#ffffff', '#bff5ff', '#d6c8ff', '#ffe9c4'],
  starCount = 1600,
  brightStarCount = 110,
  key = { color: 0xc6d8ff, intensity: 1.2 },          // directional light from the moon direction
  hemi = { sky: 0x7f9cff, ground: 0x1a4a4a, intensity: 0.6 },
  ambient = { color: 0x3a4a8a, intensity: 0.7 },
  haze = 'rgba(120, 80, 220, 0.35)',                    // null for none
} = {}) {
  const group = new THREE.Group();
  group.name = 'sky';

  const dim = starLayer(rng, starCount, 1.8, 90, starColors);
  const bright = starLayer(rng, brightStarCount, 4.2, 88, brightStarColors);
  group.add(dim, bright);

  let moonSprite = null;
  if (moon) {
    moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: crescentTexture(), transparent: true, depthWrite: false }));
    moonSprite.scale.setScalar(4.2);
    moonSprite.position.copy(moonDir).multiplyScalar(moonDistance);
    moonSprite.raycast = () => {};
    group.add(moonSprite);
  }

  if (haze) {
    const hazeSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: softDot(128, haze, haze.replace(/[\d.]+\)$/, '0)')),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6,
    }));
    hazeSprite.scale.setScalar(40);
    hazeSprite.position.copy(moonDir).multiplyScalar(moonDistance * 1.4).add(new THREE.Vector3(6, -4, 0));
    hazeSprite.raycast = () => {};
    group.add(hazeSprite);
  }

  const moonLight = new THREE.DirectionalLight(key.color, key.intensity);
  moonLight.position.copy(moonDir).multiplyScalar(20);
  group.add(moonLight);
  const fill = new THREE.HemisphereLight(hemi.sky, hemi.ground, hemi.intensity);
  group.add(fill);
  const ambientLight = new THREE.AmbientLight(ambient.color, ambient.intensity);
  group.add(ambientLight);

  return {
    group, moon: moonSprite, moonLight,
    update(dt, t) {
      bright.material.opacity = 0.75 + Math.sin(t * 1.3) * 0.12 + Math.sin(t * 3.7) * 0.08;
    },
    setMoon(intensity) {
      moonLight.intensity = intensity;
      if (moonSprite) moonSprite.material.opacity = THREE.MathUtils.clamp(0.4 + intensity * 0.4, 0.3, 1);
    },
  };
}
