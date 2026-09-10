// Free-fly camera: drag the mouse to look around, WASD to move where you are
// looking, Q/E to sink and rise, Shift to go faster, scroll wheel to change the
// base speed. On touch: one finger looks, two fingers fly forward/back.
//
// Clicks still pick objects: the picker ignores any press that moved, so a
// look-drag never counts as a click.

import * as THREE from 'three';

const KEYS = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  KeyE: 'up', PageUp: 'up',
  KeyQ: 'down', PageDown: 'down',
};

/**
 * @param {THREE.PerspectiveCamera} camera
 * @param {HTMLElement} dom            the canvas
 * @param {object} [opts]
 * @param {number} [opts.speed]        base speed, world units per second
 * @param {number} [opts.boost]        Shift multiplier
 * @param {number} [opts.lookSpeed]    radians per pixel of drag
 * @param {number} [opts.smoothing]    0 = instant, higher = floatier (per-second decay)
 */
export function createFlyControls(camera, dom, {
  speed = 4,
  boost = 4,
  lookSpeed = 0.0032,
  smoothing = 8,
} = {}) {
  const state = { speed, boost, lookSpeed, smoothing, enabled: true };
  const held = new Set();
  const velocity = new THREE.Vector3();
  const wanted = new THREE.Vector3();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const MAX_PITCH = Math.PI / 2 - 0.02;
  let shift = false;
  let pointer = null;
  let pinch = null;
  let pinchPush = 0;

  camera.rotation.reorder('YXZ');
  euler.copy(camera.rotation);

  // --- Mouse / touch look ------------------------------------------------

  function onPointerDown(e) {
    if (!state.enabled) return;
    if (e.pointerType === 'touch') {
      const t = pointer ? 'second' : 'first';
      if (t === 'second') { pinch = { id: e.pointerId, y: e.clientY }; return; }
    } else if (e.button !== 0 && e.button !== 2) {
      return;
    }
    pointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
    dom.setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e) {
    if (!state.enabled) return;
    if (pinch && e.pointerId === pinch.id) {
      pinchPush += (pinch.y - e.clientY) * 0.02; // two fingers up = fly forward
      pinch.y = e.clientY;
      return;
    }
    if (!pointer || e.pointerId !== pointer.id) return;
    if (pinch) { pointer.x = e.clientX; pointer.y = e.clientY; return; } // two fingers down: no look
    const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y;
    pointer.x = e.clientX; pointer.y = e.clientY;
    euler.y -= dx * state.lookSpeed;
    euler.x = THREE.MathUtils.clamp(euler.x - dy * state.lookSpeed, -MAX_PITCH, MAX_PITCH);
    camera.quaternion.setFromEuler(euler);
  }
  function onPointerUp(e) {
    if (pinch && e.pointerId === pinch.id) { pinch = null; return; }
    if (pointer && e.pointerId === pointer.id) {
      dom.releasePointerCapture?.(e.pointerId);
      pointer = null;
      pinch = null;
    }
  }
  function onWheel(e) {
    if (!state.enabled) return;
    e.preventDefault();
    state.speed = THREE.MathUtils.clamp(state.speed * Math.exp(-e.deltaY * 0.0015), 0.25, 60);
  }
  function onContextMenu(e) { e.preventDefault(); }

  // --- Keys -------------------------------------------------------------

  function typing(e) {
    const tag = e.target?.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable;
  }
  function onKeyDown(e) {
    if (!state.enabled || typing(e)) return;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') shift = true;
    const dir = KEYS[e.code];
    if (dir) { held.add(dir); e.preventDefault(); }
  }
  function onKeyUp(e) {
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') shift = false;
    const dir = KEYS[e.code];
    if (dir) held.delete(dir);
  }
  function onBlur() { held.clear(); shift = false; pointer = null; pinch = null; }

  dom.addEventListener('pointerdown', onPointerDown);
  dom.addEventListener('pointermove', onPointerMove);
  dom.addEventListener('pointerup', onPointerUp);
  dom.addEventListener('pointercancel', onPointerUp);
  dom.addEventListener('wheel', onWheel, { passive: false });
  dom.addEventListener('contextmenu', onContextMenu);
  dom.style.touchAction = 'none';
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  // --- Per-frame ----------------------------------------------------------

  const fwd = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);

  function update(dt) {
    if (!state.enabled) return;
    camera.getWorldDirection(fwd);
    right.crossVectors(fwd, up).normalize();

    wanted.set(0, 0, 0);
    if (held.has('forward')) wanted.add(fwd);
    if (held.has('back')) wanted.sub(fwd);
    if (held.has('right')) wanted.add(right);
    if (held.has('left')) wanted.sub(right);
    if (held.has('up')) wanted.add(up);
    if (held.has('down')) wanted.sub(up);
    if (wanted.lengthSq() > 0) wanted.normalize().multiplyScalar(state.speed * (shift ? state.boost : 1));
    if (pinchPush !== 0) { wanted.addScaledVector(fwd, pinchPush * state.speed); pinchPush = 0; }

    // Ease toward the wanted velocity so starts and stops feel like flying, not teleporting.
    const k = state.smoothing > 0 ? 1 - Math.exp(-state.smoothing * dt) : 1;
    velocity.lerp(wanted, k);
    camera.position.addScaledVector(velocity, dt);
  }

  /** Jump to a position and look at a point. */
  function setView(position, target) {
    camera.position.set(...position);
    camera.lookAt(...target);
    euler.copy(camera.rotation);
    velocity.set(0, 0, 0);
  }

  function dispose() {
    dom.removeEventListener('pointerdown', onPointerDown);
    dom.removeEventListener('pointermove', onPointerMove);
    dom.removeEventListener('pointerup', onPointerUp);
    dom.removeEventListener('pointercancel', onPointerUp);
    dom.removeEventListener('wheel', onWheel);
    dom.removeEventListener('contextmenu', onContextMenu);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
  }

  return {
    state,
    update, setView, dispose,
    /** True while a look-drag is in progress. */
    get dragging() { return pointer !== null; },
  };
}
