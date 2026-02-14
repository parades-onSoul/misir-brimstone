import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MODE_MARKER_LIMITS,
  applyMarkerRepairs,
  validateGroqOutput,
} from '../lib/ai/validation';

test('validateGroqOutput enforces marker minimums per mode', () => {
  const input = [
    {
      name: 'Foundations',
      markers: ['quarks', 'leptons', 'gauge bosons', 'symmetry'],
    },
    {
      name: 'Experiments',
      markers: ['detectors', 'collider', 'luminosity', 'event reconstruction'],
    },
  ];

  const result = validateGroqOutput(input, 'standard');
  assert.equal(result.length, 2);
  assert.equal(result[0].markers.length, 4);
});

test('validateGroqOutput fails strict advanced mode when underfilled', () => {
  const input = [
    {
      name: 'Field Theory',
      markers: ['lagrangian', 'renormalization', 'gauge invariance', 'effective field theory'],
    },
  ];

  assert.throws(
    () => validateGroqOutput(input, 'advanced'),
    /Underfilled markers/
  );
});

test('validateGroqOutput allows underfilled output in relaxed mode', () => {
  const input = [
    {
      name: 'Field Theory',
      markers: ['lagrangian', 'renormalization', 'gauge invariance', 'effective field theory'],
    },
  ];

  const relaxed = validateGroqOutput(input, 'advanced', { enforceMarkerMinimum: false });
  assert.equal(relaxed.length, 1);
  assert.equal(relaxed[0].markers.length, 4);
});

test('applyMarkerRepairs fills missing markers while preserving uniqueness and caps', () => {
  const subspaces = [
    {
      name: 'Field Theory',
      markers: ['lagrangian', 'renormalization', 'gauge invariance'],
    },
    {
      name: 'Detectors',
      markers: ['tracker', 'calorimeter', 'trigger'],
    },
  ];

  const repaired = applyMarkerRepairs(
    subspaces,
    {
      'field theory': [
        'effective field theory',
        'gauge invariance',
        'ward identity',
      ],
      detectors: [
        'calorimeter',
        'pileup mitigation',
      ],
    },
    'fast'
  );

  const fastMax = MODE_MARKER_LIMITS.fast.max;
  assert.equal(repaired[0].markers.includes('effective field theory'), true);
  assert.equal(repaired[0].markers.includes('ward identity'), false);
  assert.equal(repaired[0].markers.length, fastMax);
  assert.equal(repaired[1].markers.includes('pileup mitigation'), true);
  assert.equal(repaired[1].markers.includes('calorimeter'), true);
  assert.equal(repaired[1].markers.length, fastMax);
});
