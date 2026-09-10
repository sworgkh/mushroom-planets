// Little mushroom-hat villagers that walk along a curve on the planet and
// say something when clicked.

import * as THREE from 'three';
import { capGeometry, capTextures, CAP_PALETTE } from './mushroom.js';
import { orientAlong } from './surface.js';

const NAMES = ['Pip', 'Moss', 'Dobbin', 'Lumen', 'Fennel', 'Wisp', 'Tansy', 'Bramble', 'Nib', 'Quill'];
const LINES = [
  'hi!', 'the moss is soft today', 'have you seen my lantern?', '♪ hmm hm hmm ♪',
  'it glows!', 'spore-tacular night', 'zzz…', 'mind the river', 'moon looks close tonight',
  'I live in the blue one', 'shh, the orbs are sleeping',
];

const bodyMat = new THREE.MeshStandardMaterial({ color: 0xfbe9cf, roughness: 0.7, emissive: 0xffe2c0, emissiveIntensity: 0.12 });
const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1428, roughness: 0.3 });
const cheekMat = new THREE.MeshStandardMaterial({ color: 0xffa3b8, roughness: 0.8 });
const scarfMats = ['#7a4cff', '#3fbfff', '#c56bff', '#2fd6c0'].map((h) => new THREE.MeshStandardMaterial({ color: h, roughness: 0.9 }));

/**
 * @param {object} opts
 * @param {import('./rng.js').Rng} opts.rng
 * @param {THREE.Curve} opts.curve   path to walk (world-space points on the planet surface)
 * @param {number} [opts.size]
 */
/**
 * Extra options:
 *   hat    { cap, spot, spots }   hat colours; spots=false for plain caps
 *   outfit { color, stripe }      sweater colour, optional stripe colour
 *   arms   true                   little arms; `wave()` raises one
 */
export function createVillager({ rng, curve = null, size = 1, name = rng.pick(NAMES), hat, outfit, arms = false, lines = LINES, book = false } = {}) {
  const group = new THREE.Group();
  const body = new THREE.Group(); // bobs up and down inside the group
  group.add(body);

  const r = 0.07 * size;
  const torsoMat = outfit ? sweaterMaterial(outfit) : bodyMat;
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(r, r * 1.1, 6, 14), torsoMat);
  torso.position.y = r * 1.55;
  body.add(torso);

  const palette = hat ?? rng.pick(CAP_PALETTE);
  const { map, emissiveMap } = capTextures(rng, palette.cap, palette.spot, palette.spots ?? true);
  const hatMat = new THREE.MeshStandardMaterial({ map, emissiveMap, emissive: new THREE.Color(palette.cap), emissiveIntensity: palette.glow ?? 0.8, roughness: 0.6 });
  const hatMesh = new THREE.Mesh(capGeometry(r * 1.7, r * 1.0), hatMat);
  hatMesh.position.y = r * 2.55;
  hatMesh.rotation.z = rng.range(-0.15, 0.15);
  body.add(hatMesh);

  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(r * 0.13, 8, 8), eyeMat);
    eye.position.set(sx * r * 0.32, r * 2.0, r * 0.97);
    body.add(eye);
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(r * 0.12, 8, 8), cheekMat);
    cheek.position.set(sx * r * 0.55, r * 1.75, r * 0.86);
    cheek.scale.set(1, 0.6, 0.4);
    body.add(cheek);
  }

  const scarf = new THREE.Mesh(new THREE.TorusGeometry(r * 0.72, r * 0.3, 8, 18), rng.pick(scarfMats));
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = outfit ? r * 1.45 : r * 1.05;
  body.add(scarf);

  if (book) {
    // an open book held in front: two thin pages at an angle
    const pageMat = new THREE.MeshStandardMaterial({ color: 0xfff4dc, roughness: 0.9 });
    const coverMat = new THREE.MeshStandardMaterial({ color: 0x3f7a4a, roughness: 0.9 });
    for (const sx of [-1, 1]) {
      const page = new THREE.Mesh(new THREE.BoxGeometry(r * 0.75, r * 0.08, r * 0.9), pageMat);
      page.position.set(sx * r * 0.36, r * 1.35, r * 0.95);
      page.rotation.z = -sx * 0.35;
      const cover = new THREE.Mesh(new THREE.BoxGeometry(r * 0.78, r * 0.03, r * 0.94), coverMat);
      cover.position.set(0, -r * 0.05, 0);
      page.add(cover);
      body.add(page);
    }
  }

  let armR = null, waving = 0;
  if (arms) {
    for (const sx of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(r * 0.16, r * 0.5, 4, 8), torsoMat);
      arm.position.set(sx * r * 1.05, r * 1.4, 0);
      arm.rotation.z = sx * 0.5;
      body.add(arm);
      if (sx === 1) armR = arm;
    }
  }

  const walker = {
    curve,
    u: rng.next(),
    dir: rng.chance(0.5) ? 1 : -1,
    speed: rng.range(0.012, 0.02),
    pause: 0,
    phase: rng.range(0, Math.PI * 2),
  };

  let bubble = null;
  let bubbleTimer = 0;

  const ud = {
    type: 'villager',
    name,
    walker,
    body,
    /** Show a speech bubble for a couple of seconds and stop walking meanwhile. */
    /** Raise the right arm and wiggle it for a moment (needs `arms`). */
    wave(seconds = 1.6) { waving = seconds; },
    say(text = rng.pick(lines), seconds = 2.6) {
      if (armR) waving = Math.min(seconds, 1.8);
      if (bubble) group.remove(bubble);
      bubble = makeBubble(text);
      bubble.position.set(0, r * 4.6, 0);
      group.add(bubble);
      bubbleTimer = seconds;
      walker.pause = seconds;
    },
    update(dt, t) {
      if (walker.pause > 0) walker.pause -= dt;
      if (!curve) {
        // parked (sitting on a bench, say): only the bubble and the arm animate
        if (bubble) {
          bubbleTimer -= dt;
          bubble.material.opacity = Math.min(1, bubbleTimer * 2);
          if (bubbleTimer <= 0) { group.remove(bubble); bubble.material.map.dispose(); bubble.material.dispose(); bubble = null; }
        }
        if (armR) armR.rotation.z = waving > 0 ? (waving -= dt, -2.4 + Math.sin(t * 14) * 0.35) : 0.5;
        return;
      }
      if (walker.pause <= 0) {
        walker.u += walker.speed * walker.dir * dt;
        if (walker.u >= 1) { walker.u = 1; walker.dir = -1; }
        if (walker.u <= 0) { walker.u = 0; walker.dir = 1; }
      }
      const p = curve.getPointAt(walker.u);
      const tangent = curve.getTangentAt(walker.u).multiplyScalar(walker.dir);
      const normal = p.clone().normalize();
      group.position.copy(p);
      orientAlong(group, normal, tangent);
      const moving = walker.pause <= 0;
      body.position.y = moving ? Math.abs(Math.sin(t * 9 + walker.phase)) * r * 0.35 : 0;
      body.rotation.z = moving ? Math.sin(t * 9 + walker.phase) * 0.08 : 0;
      if (armR) {
        if (waving > 0) {
          waving -= dt;
          armR.rotation.z = -2.4 + Math.sin(t * 14) * 0.35;
        } else {
          armR.rotation.z = 0.5 + (moving ? Math.sin(t * 9 + walker.phase) * 0.25 : 0);
        }
      }
      if (bubble) {
        bubbleTimer -= dt;
        bubble.material.opacity = Math.min(1, bubbleTimer * 2);
        if (bubbleTimer <= 0) { group.remove(bubble); bubble.material.map.dispose(); bubble.material.dispose(); bubble = null; }
      }
    },
  };
  group.userData = ud;
  group.traverse((o) => { if (o !== group) o.userData.pickRoot = group; });
  ud.update(0, 0);
  return group;
}

/** Knitted-sweater material: flat colour or horizontal stripes. */
function sweaterMaterial({ color, stripe }) {
  if (!stripe) return new THREE.MeshStandardMaterial({ color, roughness: 0.95 });
  const c = document.createElement('canvas');
  c.width = 8; c.height = 64;
  const ctx = c.getContext('2d');
  for (let y = 0; y < 64; y += 8) {
    ctx.fillStyle = (y / 8) % 2 ? stripe : color;
    ctx.fillRect(0, y, 8, 8);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1.5);
  tex.magFilter = THREE.NearestFilter;
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 });
}

function makeBubble(text) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = '600 34px system-ui, sans-serif';
  const w = Math.ceil(ctx.measureText(text).width) + 48;
  canvas.width = w; canvas.height = 96;
  ctx.font = '600 34px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(214, 208, 240, 0.96)';
  roundRect(ctx, 2, 2, w - 4, 66, 22);
  ctx.fill();
  // tail
  ctx.beginPath();
  ctx.moveTo(w / 2 - 12, 66); ctx.lineTo(w / 2, 88); ctx.lineTo(w / 2 + 12, 66);
  ctx.fill();
  ctx.fillStyle = '#2a1f4d';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, 36);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, toneMapped: false }));
  sprite.scale.set(w / 96 * 0.22, 0.22, 1);
  sprite.renderOrder = 10;
  sprite.raycast = () => {};
  return sprite;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
