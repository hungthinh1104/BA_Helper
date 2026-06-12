import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface FrameworkDetectionResult {
  isSupported: boolean;
  language?: 'TYPESCRIPT' | 'JAVA' | 'UNKNOWN';
  framework?: 'NESTJS' | 'SPRING_BOOT' | 'GENERIC_TYPESCRIPT' | 'UNKNOWN';
  reason?: string;
}

const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  '.turbo',
  '.cache',
  'vendor',
  'tmp',
]);

const collectTypeScriptFiles = async (rootDir: string): Promise<string[]> => {
  const files: string[] = [];
  const queue: string[] = [rootDir];

  while (queue.length > 0) {
    const currentDir = queue.shift()!;
    let entries: Array<import('node:fs').Dirent>;
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) {
          queue.push(fullPath);
        }
        continue;
      }

      if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        files.push(fullPath);
      }
    }
  }

  return files;
};

const hasNestMarkers = async (rootDir: string): Promise<boolean> => {
  const tsFiles = await collectTypeScriptFiles(rootDir);

  for (const filePath of tsFiles.slice(0, 100)) {
    let content = '';
    try {
      content = await fs.readFile(filePath, 'utf8');
    } catch {
      continue;
    }

    if (
      content.includes('@nestjs/') ||
      content.includes('@Controller(') ||
      content.includes('@Injectable(') ||
      content.includes('@Module(')
    ) {
      return true;
    }
  }

  return false;
};

const hasJavaMarkers = async (rootDir: string): Promise<boolean> => {
  const queue: string[] = [path.join(rootDir, 'src', 'main', 'java')];
  
  while (queue.length > 0) {
    const currentDir = queue.shift()!;
    let entries: Array<import('node:fs').Dirent>;
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        queue.push(path.join(currentDir, entry.name));
      } else if (entry.isFile() && entry.name.endsWith('.java')) {
        return true;
      }
    }
  }
  return false;
};

export class FrameworkDetector {
  /**
   * Statically checks if the repository is a supported framework (NestJS).
   * Does NOT run npm install or execute code.
   */
  static async detect(rootDir: string): Promise<FrameworkDetectionResult> {
    try {
      // 1. Check for Java Spring Boot
      const pomPath = path.join(rootDir, 'pom.xml');
      const gradlePath = path.join(rootDir, 'build.gradle');
      const gradleKtsPath = path.join(rootDir, 'build.gradle.kts');
      
      let buildFileContent = '';
      try {
        buildFileContent = await fs.readFile(pomPath, 'utf8');
      } catch {
        try {
          buildFileContent = await fs.readFile(gradlePath, 'utf8');
        } catch {
          try {
            buildFileContent = await fs.readFile(gradleKtsPath, 'utf8');
          } catch {
            // Not a recognized Java build file
          }
        }
      }

      if (buildFileContent && buildFileContent.includes('org.springframework.boot')) {
        const hasJavaSrc = await hasJavaMarkers(rootDir);
        if (hasJavaSrc) {
          return { isSupported: true, language: 'JAVA', framework: 'SPRING_BOOT' };
        }
      }

      // 2. Check package.json for Node.js/TypeScript
      const pkgPath = path.join(rootDir, 'package.json');
      let pkgContent: string;
      try {
        pkgContent = await fs.readFile(pkgPath, 'utf8');
      } catch (err) {
        return { isSupported: false, language: 'UNKNOWN', framework: 'UNKNOWN', reason: 'package.json not found' };
      }

      let pkg: any;
      try {
        pkg = JSON.parse(pkgContent);
      } catch (err) {
        return { isSupported: false, language: 'UNKNOWN', framework: 'UNKNOWN', reason: 'package.json is invalid JSON' };
      }

      const hasTsConfig = await fs
        .access(path.join(rootDir, 'tsconfig.json'))
        .then(() => true)
        .catch(() => false);
      const hasTypeScriptSignal =
        hasTsConfig ||
        Boolean(pkg.devDependencies?.typescript) ||
        Boolean(pkg.dependencies?.typescript);

      if (!hasTypeScriptSignal) {
        return {
          isSupported: false,
          language: 'UNKNOWN',
          framework: 'UNKNOWN',
          reason: 'TypeScript project markers were not detected',
        };
      }

      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      const hasNestDependencies = Boolean(deps['@nestjs/common'] || deps['@nestjs/core']);
      const detectedNestMarkers = hasNestDependencies || (await hasNestMarkers(rootDir));
      if (!detectedNestMarkers) {
        return {
          isSupported: false,
          language: 'TYPESCRIPT',
          framework: 'GENERIC_TYPESCRIPT',
          reason: 'Missing @nestjs/common or @nestjs/core in package.json',
        };
      }

      // 3. Check for tsconfig.json
      if (!hasTsConfig) {
        return {
          isSupported: false,
          language: 'TYPESCRIPT',
          framework: 'GENERIC_TYPESCRIPT',
          reason: 'tsconfig.json not found',
        };
      }

      return { isSupported: true, language: 'TYPESCRIPT', framework: 'NESTJS' };
    } catch (err) {
      return {
        isSupported: false,
        language: 'UNKNOWN',
        framework: 'UNKNOWN',
        reason: `Detection error: ${(err as Error).message}`,
      };
    }
  }
}
