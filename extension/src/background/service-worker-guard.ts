/**
 * Service Worker Guard
 * 
 * Prevents window-dependent code from executing in service worker context
 * by providing safe fallbacks
 */

// Make window accessible safely in service worker context
if (typeof window === 'undefined') {
  // @ts-ignore - Creating window-like object for service worker
  (globalThis as any).window = {
    location: {
      href: '',
      hostname: 'chrome-extension',
      origin: 'chrome-extension://',
    },
    localStorage: typeof globalThis.localStorage !== 'undefined' ? globalThis.localStorage : {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    },
    sessionStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    fetch: typeof fetch !== 'undefined' ? fetch : () => Promise.reject(),
    BroadcastChannel: typeof BroadcastChannel !== 'undefined' ? BroadcastChannel : null,
    crypto: typeof crypto !== 'undefined' ? crypto : {},
    navigator: typeof navigator !== 'undefined' ? navigator : {},
    Buffer: typeof Buffer !== 'undefined' ? Buffer : null,
  };
}

// Guard for document
if (typeof document === 'undefined') {
  // @ts-ignore
  (globalThis as any).document = {
    visibilityState: 'visible',
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

// Ensure crypto is available
if (typeof crypto === 'undefined') {
  // @ts-ignore
  (globalThis as any).crypto = {
    subtle: {
      digest: () => Promise.reject(),
      importKey: () => Promise.reject(),
      verify: () => Promise.reject(),
    },
    getRandomValues: (arr: Uint8Array) => arr,
  };
}

export {};
