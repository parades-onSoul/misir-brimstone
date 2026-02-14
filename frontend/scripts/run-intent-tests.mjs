import { rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const TMP_DIR = '.tmp-tests';

function cleanTmp() {
  rmSync(TMP_DIR, { recursive: true, force: true });
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    const code = result.status || 1;
    process.exitCode = code;
    throw new Error(`${cmd} ${args.join(' ')} failed with exit code ${code}`);
  }
}

try {
  cleanTmp();
  run('tsc', ['-p', 'tsconfig.intent-tests.json']);
  run('node', ['--test', '.tmp-tests/tests/**/*.test.js']);
} finally {
  cleanTmp();
}

