#!/usr/bin/env node
/**
 * Post-build script: Patches service-worker-loader.js and bundle
 * 1. Injects globals guard into loader
 * 2. Replaces bare window/document/crypto with globalThis versions in bundle
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, '../dist');
const loaderPath = path.join(distPath, 'service-worker-loader.js');

const guard = `// ============================================================================
// PHASE 1: Establish globals BEFORE importing worker bundle
// ============================================================================

globalThis.__misir_guard_applied = true;

if (typeof window === 'undefined') {
  globalThis.window = {
    location: { href: '', hostname: 'chrome-extension', origin: 'chrome-extension://', pathname: '/', protocol: 'chrome-extension:', host: '', hash: '', search: '', port: '' },
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    fetch: typeof fetch !== 'undefined' ? fetch : () => Promise.reject(),
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {}, length: 0, key: () => null },
    sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {}, length: 0, key: () => null },
    __isServiceWorkerContext: true,
  };
}

if (typeof document === 'undefined') {
  globalThis.document = {
    visibilityState: 'visible',
    addEventListener: () => {},
    removeEventListener: () => {},
    createElement: () => ({
      addEventListener: () => {},
      removeEventListener: () => {},
      setAttribute: () => {},
      appendChild: () => {},
      relList: { supports: () => false },
    }),
    head: { appendChild: () => {} },
    body: {},
    querySelectorAll: () => [],
    querySelector: () => null,
    getElementsByTagName: () => [],
  };
}

if (typeof crypto === 'undefined') {
  globalThis.crypto = {
    subtle: {
      digest: () => Promise.reject(new Error('Crypto not available in service worker')),
      importKey: () => Promise.reject(new Error('Crypto not available in service worker')),
      verify: () => Promise.reject(new Error('Crypto not available in service worker')),
    },
    getRandomValues: (arr) => arr,
  };
}

// Create module-level aliases so bare window/document/crypto work in the bundle
var window = globalThis.window;
var document = globalThis.document;
var crypto = globalThis.crypto;

// ============================================================================
// PHASE 2: Import worker bundle (globals are now established)
// ============================================================================

`;

try {
  if (!fs.existsSync(loaderPath)) {
    // Loader doesn't exist yet, create it
    const assetsPath = path.join(distPath, 'assets');
    const files = fs.readdirSync(assetsPath);
    const workerBundleFile = files.find(f => f.startsWith('worker') && f.endsWith('.js') && !f.includes('globals'));
    
    if (!workerBundleFile) {
      console.error('❌ No worker bundle found to reference');
      process.exit(1);
    }

    const loaderTemplate = `// Service Worker Guard - MUST run before any imports
// Establish globals immediately with comprehensive stubs

// Create mock element factory
const __mockElement = {
  addEventListener: function() {},
  removeEventListener: function() {},
  setAttribute: function() {},
  appendChild: function() { return this; },
  relList: {
    supports: function() { return false; },
    add: function() {},
    remove: function() {},
  },
  href: '',
  rel: '',
  as: '',
  crossOrigin: '',
};

if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    addEventListener: function() {},
    removeEventListener: function() {},
    dispatchEvent: function() { return true; },
    location: { href: '', origin: '', protocol: '' },
    navigator: { userAgent: '' },
  };
}

if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    addEventListener: function() {},
    removeEventListener: function() {},
    dispatchEvent: function() { return true; },
    querySelector: function() { return null; },
    querySelectorAll: function() { return []; },
    createElement: function() { return { ...__mockElement }; },
    getElementsByTagName: function() { return []; },
    head: { appendChild: function() {} },
    body: {},
    visibilityState: 'visible',
  };
}

if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = {
    getRandomValues: function(arr) { return arr; },
    subtle: {
      importKey: async function() {},
      sign: async function() {},
      verify: async function() {},
    },
  };
}

// Module-level aliases for scope access
var window = globalThis.window;
var document = globalThis.document;
var crypto = globalThis.crypto;

// Now import the worker bundle (globals are established)
import './assets/\${workerBundleFile}';
`;
    
    fs.writeFileSync(loaderPath, loaderTemplate, 'utf8');
    console.log('✅ Service worker loader created');
  }

  let loaderContent = fs.readFileSync(loaderPath, 'utf8');
  
  // Remove old guard if it exists (from old patch runs)
  loaderContent = loaderContent.replace(/\/\/ ={70,}[\s\S]*?\/\/ PHASE 2:[\s\S]*?\/\/ ={70,}\s*/, '');

  fs.writeFileSync(loaderPath, loaderContent, 'utf8');

  // CRITICAL FIX: Replace bare window/document/crypto with globalThis versions in the bundle
  // This ensures strict-mode code can access them
  const assetsPath = path.join(distPath, 'assets');
  const files = fs.readdirSync(assetsPath);
  const workerBundleFile = files.find(f => f.startsWith('worker') && f.endsWith('.js') && !f.includes('globals'));
  
  if (!workerBundleFile) {
    console.error('❌ No worker bundle found in', assetsPath);
    process.exit(1);
  }

  const workerBundlePath = path.join(assetsPath, workerBundleFile);
  let bundleContent = fs.readFileSync(workerBundlePath, 'utf8');
  
  // Replace bare window/document/crypto references with globalThis versions
  // But be careful not to replace inside strings or comments
  bundleContent = bundleContent
    .replace(/([^a-zA-Z_$])window\.addEventListener\(/g, '$1globalThis.window.addEventListener(')
    .replace(/([^a-zA-Z_$])window\.removeEventListener\(/g, '$1globalThis.window.removeEventListener(')
    .replace(/([^a-zA-Z_$])document\.querySelector\(/g, '$1globalThis.document.querySelector(')
    .replace(/([^a-zA-Z_$])document\.querySelectorAll\(/g, '$1globalThis.document.querySelectorAll(')
    .replace(/([^a-zA-Z_$])document\.createElement\(/g, '$1globalThis.document.createElement(')
    .replace(/([^a-zA-Z_$])document\.getElementsByTagName\(/g, '$1globalThis.document.getElementsByTagName(')
    .replace(/([^a-zA-Z_$])document\.head\b/g, '$1globalThis.document.head')
    .replace(/([^a-zA-Z_$])document\.body\b/g, '$1globalThis.document.body')
    .replace(/([^a-zA-Z_$])window\.dispatchEvent\(/g, '$1globalThis.window.dispatchEvent(');

  fs.writeFileSync(workerBundlePath, bundleContent, 'utf8');
  console.log('✅ Worker bundle patched - replaced bare window/document references');

  // Create or update manifest.json
  const manifestSourcePath = path.join(__dirname, '../manifest.json');
  const manifestDestPath = path.join(distPath, 'manifest.json');
  
  if (fs.existsSync(manifestSourcePath)) {
    let manifest = JSON.parse(fs.readFileSync(manifestSourcePath, 'utf8'));
    
    // Update service worker path
    manifest.background.service_worker = 'service-worker-loader.js';
    
    // Update popup path
    manifest.action.default_popup = 'src/popup/index.html';
    
    // Update settings path
    manifest.options_page = 'src/settings/index.html';
    
    // Update content script with current filename
    const contentScriptFile = files.find(f => f.startsWith('content') && f.endsWith('.js'));
    if (contentScriptFile && manifest.content_scripts) {
      manifest.content_scripts[0].js = [`assets/${contentScriptFile}`];
    }
    
    // Remove web_accessible_resources if present (not needed for service workers)
    delete manifest.web_accessible_resources;
    
    fs.writeFileSync(manifestDestPath, JSON.stringify(manifest, null, 2), 'utf8');
    console.log('✅ Manifest.json created in dist/');
  }

  // Copy icons to dist
  const iconsSource = path.join(__dirname, '../icons');
  const iconsDest = path.join(distPath, 'icons');
  if (fs.existsSync(iconsSource)) {
    if (fs.existsSync(iconsDest)) {
      fs.rmSync(iconsDest, { recursive: true });
    }
    // Simple recursive copy
    function copyDir(src, dest) {
      fs.mkdirSync(dest, { recursive: true });
      const files = fs.readdirSync(src);
      files.forEach(file => {
        const srcPath = path.join(src, file);
        const destPath = path.join(dest, file);
        if (fs.statSync(srcPath).isDirectory()) {
          copyDir(srcPath, destPath);
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
      });
    }
    copyDir(iconsSource, iconsDest);
    console.log('✅ Icons copied');
  }

} catch (err) {
  console.error('❌ Patch failed:', err.message);
  process.exit(1);
}
