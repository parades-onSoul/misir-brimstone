/**
 * Service Worker Entry Point
 * 
 * CRITICAL: This file MUST run FIRST to establish window/document/crypto globals
 * BEFORE any other modules are imported or executed.
 */

// ============================================================================
// PHASE 1: ESTABLISH GLOBALS IMMEDIATELY
// ============================================================================

(() => {
  (globalThis as any).__misir_guard_applied = true;

  if (typeof window === 'undefined') {
    (globalThis as any).window = {
      location: {
        href: '',
        hostname: 'chrome-extension',
        origin: 'chrome-extension://',
        pathname: '/',
        protocol: 'chrome-extension:',
        host: '',
        hash: '',
        search: '',
        port: '',
      },
      addEventListener: () => { },
      removeEventListener: () => { },
      dispatchEvent: () => true,
      fetch: typeof fetch !== 'undefined' ? fetch : () => Promise.reject(),
      localStorage: {
        getItem: () => null,
        setItem: () => { },
        removeItem: () => { },
        clear: () => { },
        length: 0,
        key: () => null,
      },
      sessionStorage: {
        getItem: () => null,
        setItem: () => { },
        removeItem: () => { },
        clear: () => { },
        length: 0,
        key: () => null,
      },
      __isServiceWorkerContext: true,
    };
  }

  if (typeof document === 'undefined') {
    (globalThis as any).document = {
      visibilityState: 'visible',
      addEventListener: () => { },
      removeEventListener: () => { },
      createElement: () => ({
        addEventListener: () => { },
        removeEventListener: () => { },
        setAttribute: () => { },
        appendChild: () => { },
      }),
      head: {},
      body: {},
      querySelectorAll: () => [],
      querySelector: () => null,
      getElementsByTagName: () => [],
    };
  }

  if (typeof crypto === 'undefined') {
    (globalThis as any).crypto = {
      subtle: {
        digest: () => Promise.reject(new Error('Crypto not available in service worker')),
        importKey: () => Promise.reject(new Error('Crypto not available in service worker')),
        verify: () => Promise.reject(new Error('Crypto not available in service worker')),
      },
      getRandomValues: (arr: Uint8Array) => arr,
    };
  }
})();

// ============================================================================
// PHASE 2: Static import (service workers only support static imports)
// ============================================================================

import './index';
