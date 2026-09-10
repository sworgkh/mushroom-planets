// The shell every scene runs in: renderer, camera, orbit controls, bloom
// post-processing, resize handling and a tick loop. Scenes only add objects
// and register tick callbacks.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * @param {object} opts
 * @param {HTMLElement} opts.container   where the canvas goes
 * @param {number}  [opts.background]    clear colour
 * @param {object}  [opts.bloom]         { strength, radius, threshold }
 * @param {number}  [opts.exposure]      tone-mapping exposure
 * @param {number[]}[opts.cameraPos]     initial camera position
 */
export function createApp({
  container,
  background = 0x040718,
  bloom = { strength: 0.55, radius: 0.45, threshold: 0.5 },
  exposure = 1.0,
  cameraPos = [0, 2.2, 7.5],
} = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);

  const camera = new THREE.PerspectiveCamera(42, container.clientWidth / container.clientHeight, 0.05, 200);
  camera.position.set(...cameraPos);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 2.5;
  controls.maxDistance = 30;
  controls.enablePan = false;

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(container.clientWidth, container.clientHeight),
    bloom.strength, bloom.radius, bloom.threshold,
  );
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());

  const clock = new THREE.Clock();
  const tickers = new Set();
  let running = false;
  let frame = 0;

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
  }
  window.addEventListener('resize', resize);

  function render() {
    if (!running) return;
    frame = requestAnimationFrame(render);
    const dt = Math.min(clock.getDelta(), 0.1);
    const t = clock.elapsedTime;
    for (const fn of tickers) fn(dt, t);
    controls.update();
    composer.render();
  }

  return {
    renderer, scene, camera, controls, composer, bloomPass,
    /** Register a per-frame callback (dt seconds, elapsed seconds). Returns an unsubscribe fn. */
    onTick(fn) {
      tickers.add(fn);
      return () => tickers.delete(fn);
    },
    start() {
      if (running) return;
      running = true;
      clock.start();
      render();
    },
    stop() {
      running = false;
      cancelAnimationFrame(frame);
    },
    /** PNG data URL of the current frame. */
    snapshot() {
      composer.render();
      return renderer.domElement.toDataURL('image/png');
    },
    dispose() {
      this.stop();
      window.removeEventListener('resize', resize);
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

/** Dispose every geometry/material under a subtree and detach it from its parent. */
export function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      for (const key of ['map', 'emissiveMap', 'alphaMap', 'normalMap']) m[key]?.dispose?.();
      m.dispose();
    }
  });
  root.parent?.remove(root);
}
