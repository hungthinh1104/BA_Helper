import * as fs from 'fs';
import * as path from 'path';

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
  const matches = walkFiles(baseDir).filter(match => patterns.some(pattern => {
    const suffix = pattern.replace('**/*', '');
    return match.endsWith(suffix);
  }));
  for (const match of matches) {
    const relative = path.relative(baseDir, match);
    const basename = path.basename(relative);
    map.set(basename, relative);
  }
  return map;
}

function walkFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  const files: string[] = [];
  const pending = [directory];
  while (pending.length > 0) {
    const current = pending.pop()!;
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory() && !['dist', 'node_modules'].includes(entry.name)) pending.push(absolute);
      else if (entry.isFile()) files.push(absolute);
    }
  }
  return files.sort();
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
