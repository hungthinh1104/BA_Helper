import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

// Define the boundaries
const API_MODULES_PATH = path.resolve(__dirname, '../apps/api/src/modules');
const BACKEND_RUNTIME_PATH = path.resolve(__dirname, '../packages/backend-runtime/src');

// Define file patterns to check for duplication
const PATTERNS_TO_CHECK = [
  '**/*.repository.ts',
  '**/*.usecase.ts',
  '**/*.policy.ts',
  '**/*.step.ts'
];

function getBasenames(baseDir: string, patterns: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const pattern of patterns) {
    const matches = glob.sync(pattern, { cwd: baseDir });
    for (const match of matches) {
      const basename = path.basename(match);
      map.set(basename, match);
    }
  }
  return map;
}

console.log('Verifying backend-runtime boundaries to prevent file duplication...');

const apiFiles = getBasenames(API_MODULES_PATH, PATTERNS_TO_CHECK);
const runtimeFiles = getBasenames(BACKEND_RUNTIME_PATH, PATTERNS_TO_CHECK);

const duplicates: string[] = [];

for (const [basename, apiRelPath] of apiFiles.entries()) {
  if (runtimeFiles.has(basename)) {
    const runtimeRelPath = runtimeFiles.get(basename);
    duplicates.push(`- ${basename}:\n    apps/api/src/modules/${apiRelPath}\n    packages/backend-runtime/src/${runtimeRelPath}`);
  }
}

if (duplicates.length > 0) {
  console.error('\n❌ BOUNDARY VIOLATION DETECTED: File Duplication between apps/api and packages/backend-runtime');
  console.error('The following files exist in both contexts. Infrastructure belongs to backend-runtime and use cases belong to application; each implementation must have one owner.\n');
  console.error(duplicates.join('\n\n'));
  process.exit(1);
}

console.log('✅ Boundary verification passed. No duplicated files found.');
