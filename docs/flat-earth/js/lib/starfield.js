import * as THREE from 'three';
import { MATERIALS } from './materials.js';

/**
 * Deterministic star sphere. Uses a fixed-seed LCG rather than Math.random so
 * the sky is identical on every load — a demo that reshuffles its stars between
 * runs looks broken.
 */
export function makeStarSphere(count = 1400, radius = 1000) {
  let seed = 20260802;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const u = rand() * 2 - 1;
    const theta = rand() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    positions[i * 3] = radius * r * Math.cos(theta);
    positions[i * 3 + 1] = radius * u;
    positions[i * 3 + 2] = radius * r * Math.sin(theta);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(geo, MATERIALS.starPoint);
}
