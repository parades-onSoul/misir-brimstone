#!/usr/bin/env node

// Polyfill for undici before any imports
if (typeof globalThis.ReadableStream === 'undefined') {
  globalThis.ReadableStream = class ReadableStream {
    constructor() {}
  };
}
if (typeof globalThis.File === 'undefined') {
  globalThis.File = class File {
    constructor() {}
  };
}
if (typeof globalThis.FormData === 'undefined') {
  globalThis.FormData = class FormData {
    constructor() {}
  };
}

// Now run vite
import('vite').then(({ build }) => {
  return build();
}).then(() => {
  // Run patch script
  import('./scripts/patch-service-worker.js');
}).catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
