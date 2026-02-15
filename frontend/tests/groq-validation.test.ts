import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MODE_MARKER_LIMITS,
  applyMarkerRepairs,
  validateGroqOutput,
} from '../lib/ai/validation';

const marker = (text: string, weight = 1) => ({ text, weight });

test('validateGroqOutput enforces marker minimums per mode', () => {
  const input = [
    {
      name: 'Foundations',
      markers: [
        marker('quarks'),
        marker('leptons'),
        marker('gauge bosons'),
        marker('symmetry'),
      ],
    },
    {
      name: 'Experiments',
      markers: [
        marker('detectors'),
        marker('collider'),
        marker('luminosity'),
        marker('event reconstruction'),
      ],
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
      markers: [
        marker('lagrangian'),
        marker('renormalization'),
        marker('gauge invariance'),
        marker('effective field theory'),
      ],
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
      markers: [
        marker('lagrangian'),
        marker('renormalization'),
        marker('gauge invariance'),
        marker('effective field theory'),
      ],
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
      markers: [
        marker('lagrangian'),
        marker('renormalization'),
        marker('gauge invariance'),
      ],
    },
    {
      name: 'Detectors',
      markers: [marker('tracker'), marker('calorimeter'), marker('trigger')],
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
  assert.equal(repaired[0].markers.some((m) => m.text === 'effective field theory'), true);
  assert.equal(repaired[0].markers.some((m) => m.text === 'ward identity'), false);
  assert.equal(repaired[0].markers.length, fastMax);
  assert.equal(repaired[1].markers.some((m) => m.text === 'pileup mitigation'), true);
  assert.equal(repaired[1].markers.some((m) => m.text === 'calorimeter'), true);
  assert.equal(repaired[1].markers.length, fastMax);
});
