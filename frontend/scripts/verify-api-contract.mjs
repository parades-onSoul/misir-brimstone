#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const frontendClientPath = path.join(repoRoot, 'frontend', 'lib', 'api', 'client.ts');
const frontendSource = fs.readFileSync(frontendClientPath, 'utf8');

function normalizePath(value) {
  let p = value.trim();
  if (!p.startsWith('/')) p = `/${p}`;
  p = p.split('?')[0];
  p = p.replace(/\$\{[^}]+\}/g, '{param}');
  p = p.replace(/\{[^}]+\}/g, '{param}');
  p = p.replace(/\/+/g, '/');
  p = p.replace(/\/$/, '') || '/';
  return p;
}

function stripApiV1Prefix(value) {
  if (value.startsWith('/api/v1')) {
    const stripped = value.slice('/api/v1'.length);
    return stripped || '/';
  }
  return value;
}

function joinPaths(...parts) {
  return normalizePath(parts.filter(Boolean).join('/'));
}

function extractFrontendRoutes(tsSource) {
  const routes = [];
  const regex = /this\.request(?:<[^>]+>)?\(\s*`([^`]+)`/g;
  let match;
  while ((match = regex.exec(tsSource)) !== null) {
    routes.push(match[1]);
  }
  return routes;
}

function parseRouterPrefixes(pySource) {
  const map = new Map();
  const regexWithPrefix = /(\w+)\s*=\s*APIRouter\(\s*prefix="([^"]*)"/g;
  const regexWithoutPrefix = /(\w+)\s*=\s*APIRouter\(\s*\)/g;
  let match;
  while ((match = regexWithPrefix.exec(pySource)) !== null) {
    map.set(match[1], match[2] || '');
  }
  while ((match = regexWithoutPrefix.exec(pySource)) !== null) {
    if (!map.has(match[1])) {
      map.set(match[1], '');
    }
  }
  return map;
}

function extractBackendRoutes(pySource, routeMountMap) {
  const prefixes = parseRouterPrefixes(pySource);
  const routes = [];
  const regex = /@(\w+)\.(get|post|put|patch|delete)\(\s*"([^"]*)"/g;
  let match;
  while ((match = regex.exec(pySource)) !== null) {
    const routerName = match[1];
    const method = match[2].toUpperCase();
    const decoratorPath = match[3] || '';
    const routerPrefix = prefixes.get(routerName);
    const mountPrefix = routeMountMap[routerName];
    if (routerPrefix === undefined || mountPrefix === undefined) {
      continue;
    }
    const fullPath = joinPaths(mountPrefix, routerPrefix, decoratorPath);
    routes.push({ method, path: stripApiV1Prefix(fullPath) });
  }
  return routes;
}

const backendRouteConfigs = [
  {
    file: path.join(repoRoot, 'backend', 'interfaces', 'api', 'spaces.py'),
    mounts: { router: '/api/v1' },
  },
  {
    file: path.join(repoRoot, 'backend', 'interfaces', 'api', 'subspaces.py'),
    mounts: { router: '/api/v1' },
  },
  {
    file: path.join(repoRoot, 'backend', 'interfaces', 'api', 'artifacts.py'),
    mounts: { router: '/api/v1/artifacts' },
  },
  {
    file: path.join(repoRoot, 'backend', 'interfaces', 'api', 'capture.py'),
    mounts: { router: '/api/v1/artifacts' },
  },
  {
    file: path.join(repoRoot, 'backend', 'interfaces', 'api', 'search.py'),
    mounts: { router: '/api/v1' },
  },
  {
    file: path.join(repoRoot, 'backend', 'interfaces', 'api', 'analytics.py'),
    mounts: { router: '/api/v1/spaces', global_router: '/api/v1' },
  },
  {
    file: path.join(repoRoot, 'backend', 'interfaces', 'api', 'profile.py'),
    mounts: { router: '/api/v1' },
  },
  {
    file: path.join(repoRoot, 'backend', 'interfaces', 'api', 'insights.py'),
    mounts: { router: '/api/v1' },
  },
];

const frontendRoutes = extractFrontendRoutes(frontendSource)
  .map((rawPath) => ({ rawPath, path: normalizePath(rawPath) }));

const backendRoutes = backendRouteConfigs.flatMap(({ file, mounts }) => {
  const source = fs.readFileSync(file, 'utf8');
  return extractBackendRoutes(source, mounts);
});

const backendPathSet = new Set(backendRoutes.map((route) => route.path));

const missing = frontendRoutes.filter(({ path: clientPath }) => !backendPathSet.has(clientPath));

if (missing.length > 0) {
  console.error('API contract check failed. Frontend routes missing on backend:');
  for (const route of missing) {
    console.error(`  - ${route.path} (from ${route.rawPath})`);
  }
  process.exit(1);
}

const criticalChecks = [
  {
    label: 'Backend SpaceArtifactResponse fields',
    file: path.join(repoRoot, 'backend', 'interfaces', 'api', 'spaces.py'),
    requiredSnippets: [
      'reading_depth',
      'word_count',
      'dwell_time_ms',
      'content_source',
      'captured_at',
    ],
  },
  {
    label: 'Frontend SpaceArtifactResponse fields',
    file: path.join(repoRoot, 'frontend', 'types', 'api.ts'),
    requiredSnippets: [
      'reading_depth?:',
      'word_count?:',
      'dwell_time_ms: number',
      'content_source?:',
      'captured_at?:',
    ],
  },
];

for (const check of criticalChecks) {
  const content = fs.readFileSync(check.file, 'utf8');
  const missingSnippets = check.requiredSnippets.filter((snippet) => !content.includes(snippet));
  if (missingSnippets.length > 0) {
    console.error(`${check.label} check failed in ${check.file}:`);
    for (const snippet of missingSnippets) {
      console.error(`  - Missing snippet: ${snippet}`);
    }
    process.exit(1);
  }
}

console.log(`API contract check passed: ${frontendRoutes.length} frontend routes matched backend definitions, and critical artifact fields are present.`);
