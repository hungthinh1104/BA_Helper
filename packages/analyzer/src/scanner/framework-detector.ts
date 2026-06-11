import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface FrameworkDetectionResult {
  isSupported: boolean;
  framework?: 'NESTJS' | 'UNKNOWN';
  reason?: string;
}

export class FrameworkDetector {
  /**
   * Statically checks if the repository is a supported framework (NestJS).
   * Does NOT run npm install or execute code.
   */
  static async detect(rootDir: string): Promise<FrameworkDetectionResult> {
    try {
      // 1. Check package.json
      const pkgPath = path.join(rootDir, 'package.json');
      let pkgContent: string;
      try {
        pkgContent = await fs.readFile(pkgPath, 'utf8');
      } catch (err) {
        return { isSupported: false, reason: 'package.json not found' };
      }

      let pkg: any;
      try {
        pkg = JSON.parse(pkgContent);
      } catch (err) {
        return { isSupported: false, reason: 'package.json is invalid JSON' };
      }

      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (!deps['@nestjs/common'] && !deps['@nestjs/core']) {
        return { isSupported: false, reason: 'Missing @nestjs/common or @nestjs/core in package.json' };
      }

      // 2. Check for tsconfig.json
      const tsconfigPath = path.join(rootDir, 'tsconfig.json');
      try {
        await fs.access(tsconfigPath);
      } catch (err) {
        return { isSupported: false, reason: 'tsconfig.json not found' };
      }

      return { isSupported: true, framework: 'NESTJS' };
    } catch (err) {
      return { isSupported: false, reason: `Detection error: ${(err as Error).message}` };
    }
  }
}
