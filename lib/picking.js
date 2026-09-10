// Hover and click on scene objects. Hits resolve to the nearest ancestor
// that carries `userData.pickRoot` (set by the builders), so clicking a
// mushroom's window picks the mushroom. A click is a press+release that
// did not move, so orbiting the camera never counts as a click.

import * as THREE from 'three';

/**
 * @param {object} opts
 * @param {THREE.Camera} opts.camera
 * @param {HTMLElement} opts.dom             the canvas
 * @param {() => THREE.Object3D[]} opts.targets  roots to raycast (recursively)
 * @param {(hit: Hit|null) => void} [opts.onHover]
 * @param {(hit: Hit) => void} [opts.onClick]
 * Hit = { object: root, point, normal, distance, raw }
 */
export function createPicker({ camera, dom, targets, onHover, onClick }) {
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hovered = null;
  let down = null;
  let lastEvent = null;

  function cast(ev) {
    const rect = dom.getBoundingClientRect();
    ndc.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(targets(), true);
    for (const h of hits) {
      const root = h.object.userData.pickRoot ?? h.object;
      if (!root.userData?.type) continue;
      return { object: root, point: h.point, normal: h.face?.normal, distance: h.distance, raw: h };
    }
    return null;
  }

  function move(ev) {
    lastEvent = ev;
    const hit = cast(ev);
    const obj = hit?.object ?? null;
    if (obj !== hovered) {
      hovered = obj;
      onHover?.(hit);
    }
    dom.style.cursor = obj ? 'pointer' : 'grab';
  }

  dom.addEventListener('pointermove', move);
  dom.addEventListener('pointerdown', (ev) => { down = { x: ev.clientX, y: ev.clientY }; });
  dom.addEventListener('pointerup', (ev) => {
    if (!down) return;
    const moved = Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 5;
    down = null;
    if (moved) return;
    const hit = cast(ev);
    if (hit) onClick?.(hit);
  });
  dom.addEventListener('pointerleave', () => {
    if (hovered) { hovered = null; onHover?.(null); }
  });

  return {
    get hovered() { return hovered; },
    /** Re-run hover after the scene changed under a still pointer. */
    refresh() { if (lastEvent) move(lastEvent); },
  };
}
