import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  celestialPoleAltitudeDeg, skyRotationGlobe, skyRotationFlat, poleStarName,
} from '../js/physics/sky.js';

test('pole altitude equals the observer latitude', () => {
  assert.equal(celestialPoleAltitudeDeg(40), 40);
  assert.equal(celestialPoleAltitudeDeg(-40), 40);
});

test('the globe turns the sky opposite ways in the two hemispheres', () => {
  assert.equal(skyRotationGlobe(40), 'CCW');
  assert.equal(skyRotationGlobe(-40), 'CW');
});

test('the flat model has one sky, so one rotation direction everywhere', () => {
  assert.equal(skyRotationFlat(40), 'CCW');
  assert.equal(skyRotationFlat(-40), 'CCW');
});

test('each hemisphere has its own pole star', () => {
  assert.equal(poleStarName(40), 'Polaris');
  assert.equal(poleStarName(-40), 'Sigma Octantis');
});
