import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface FrameworkDetectionResult {
  isSupported: boolean;
  language?: 'typescript' | 'java' | 'go' | 'python' | 'csharp' | 'php' | 'ruby' | 'UNKNOWN';
  framework?:
    | 'nestjs'
    | 'spring_boot'
    | 'generic_typescript'
    | 'net/http'
    | 'gin'
    | 'fastapi'
    | 'aspnetcore'
    | 'laravel'
    | 'rails'
    | 'UNKNOWN';
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

const exists = async (filePath: string): Promise<boolean> =>
  fs.access(filePath).then(() => true).catch(() => false);

const readIfExists = async (filePath: string): Promise<string> =>
  fs.readFile(filePath, 'utf8').catch(() => '');

const collectFiles = async (rootDir: string, extensions: string[], limit = 100): Promise<string[]> => {
  const files: string[] = [];
  const queue = [rootDir];

  while (queue.length > 0 && files.length < limit) {
    const currentDir = queue.shift()!;
    const entries = await fs.readdir(currentDir, { withFileTypes: true }).catch(() => []);

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) queue.push(fullPath);
        continue;
      }
      if (entry.isFile() && extensions.some((extension) => entry.name.endsWith(extension))) {
        files.push(fullPath);
        if (files.length >= limit) break;
      }
    }
  }

  return files.sort();
};

const hasNestMarkers = async (rootDir: string): Promise<boolean> => {
  const tsFiles = await collectFiles(rootDir, ['.ts', '.tsx']);

  for (const filePath of tsFiles.slice(0, 100)) {
    const content = await readIfExists(filePath);
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
  const javaFiles = await collectFiles(path.join(rootDir, 'src', 'main', 'java'), ['.java']);
  return javaFiles.length > 0;
};

export class FrameworkDetector {
  static async detect(rootDir: string): Promise<FrameworkDetectionResult> {
    try {
      const javaResult = await this.detectJava(rootDir);
      if (javaResult) return javaResult;

      const pythonResult = await this.detectPython(rootDir);
      if (pythonResult) return pythonResult;

      const goResult = await this.detectGo(rootDir);
      if (goResult) return goResult;

      const phpResult = await this.detectPhp(rootDir);
      if (phpResult) return phpResult;

      const rubyResult = await this.detectRuby(rootDir);
      if (rubyResult) return rubyResult;

      const csharpResult = await this.detectCSharp(rootDir);
      if (csharpResult) return csharpResult;

      return await this.detectTypeScript(rootDir);
    } catch (e) {
      return {
        isSupported: false,
        language: 'UNKNOWN',
        framework: 'UNKNOWN',
        reason: e instanceof Error ? e.message : 'Unknown detection error',
      };
    }
  }

  private static async detectJava(rootDir: string): Promise<FrameworkDetectionResult | null> {
    const buildFileContent = [
      await readIfExists(path.join(rootDir, 'pom.xml')),
      await readIfExists(path.join(rootDir, 'build.gradle')),
      await readIfExists(path.join(rootDir, 'build.gradle.kts')),
    ].join('\n');

    if (!buildFileContent.trim()) return null;

    if (buildFileContent.includes('org.springframework.boot') && await hasJavaMarkers(rootDir)) {
      return { isSupported: true, language: 'java', framework: 'spring_boot' };
    }

    return {
      isSupported: false,
      language: 'java',
      framework: 'UNKNOWN',
      reason: 'Spring Boot project markers were not detected.',
    };
  }

  private static async detectPython(rootDir: string): Promise<FrameworkDetectionResult | null> {
    const hasPythonMarkers =
      await exists(path.join(rootDir, 'requirements.txt')) ||
      await exists(path.join(rootDir, 'Pipfile')) ||
      await exists(path.join(rootDir, 'main.py')) ||
      await exists(path.join(rootDir, 'manage.py')) ||
      (await collectFiles(rootDir, ['.py'], 1)).length > 0;

    if (!hasPythonMarkers) return null;

    const pyFiles = await collectFiles(rootDir, ['.py']);
    const source = [
      await readIfExists(path.join(rootDir, 'requirements.txt')),
      await readIfExists(path.join(rootDir, 'Pipfile')),
      ...(await Promise.all(pyFiles.slice(0, 50).map(readIfExists))),
    ].join('\n').toLowerCase();

    if (source.includes('fastapi')) {
      return { isSupported: true, language: 'python', framework: 'fastapi' };
    }
    if (source.includes('django')) {
      return { isSupported: false, language: 'python', framework: 'UNKNOWN', reason: 'Django repositories are not supported.' };
    }
    if (source.includes('flask')) {
      return { isSupported: false, language: 'python', framework: 'UNKNOWN', reason: 'Flask repositories are not supported.' };
    }
    return {
      isSupported: false,
      language: 'python',
      framework: 'UNKNOWN',
      reason: 'Supported Python framework markers were not detected.',
    };
  }

  private static async detectGo(rootDir: string): Promise<FrameworkDetectionResult | null> {
    const hasGoMod = await exists(path.join(rootDir, 'go.mod'));
    const goFiles = await collectFiles(rootDir, ['.go']);
    if (!hasGoMod && goFiles.length === 0) return null;

    const source = [
      await readIfExists(path.join(rootDir, 'go.mod')),
      ...(await Promise.all(goFiles.slice(0, 50).map(readIfExists))),
    ].join('\n');

    if (source.includes('http.HandleFunc')) {
      return { isSupported: true, language: 'go', framework: 'net/http' };
    }
    if (
      source.includes('github.com/gin-gonic/gin') ||
      source.includes('gin.Default()') ||
      source.includes('gin.New()')
    ) {
      return { isSupported: true, language: 'go', framework: 'gin' };
    }
    if (source.includes('github.com/labstack/echo')) {
      return { isSupported: false, language: 'go', framework: 'UNKNOWN', reason: 'Echo repositories are not supported.' };
    }
    return {
      isSupported: false,
      language: 'go',
      framework: 'UNKNOWN',
      reason: 'Supported Go HTTP framework markers were not detected.',
    };
  }

  private static async detectPhp(rootDir: string): Promise<FrameworkDetectionResult | null> {
    const hasComposer = await exists(path.join(rootDir, 'composer.json'));
    const hasArtisan = await exists(path.join(rootDir, 'artisan'));
    if (!hasComposer && !hasArtisan) return null;

    const composer = await readIfExists(path.join(rootDir, 'composer.json'));
    if (composer.includes('laravel/framework') || hasArtisan) {
      return { isSupported: true, language: 'php', framework: 'laravel' };
    }
    if (composer.includes('symfony/')) {
      return { isSupported: false, language: 'php', framework: 'UNKNOWN', reason: 'Symfony repositories are not supported.' };
    }
    return {
      isSupported: false,
      language: 'php',
      framework: 'UNKNOWN',
      reason: 'Supported PHP framework markers were not detected.',
    };
  }

  private static async detectRuby(rootDir: string): Promise<FrameworkDetectionResult | null> {
    const gemfilePath = path.join(rootDir, 'Gemfile');
    if (!await exists(gemfilePath)) return null;

    const gemfile = await readIfExists(gemfilePath);
    if (gemfile.includes('gem "rails"') || gemfile.includes("gem 'rails'")) {
      return { isSupported: true, language: 'ruby', framework: 'rails' };
    }
    if (gemfile.includes('gem "sinatra"') || gemfile.includes("gem 'sinatra'")) {
      return { isSupported: false, language: 'ruby', framework: 'UNKNOWN', reason: 'Sinatra repositories are not supported.' };
    }
    return {
      isSupported: false,
      language: 'ruby',
      framework: 'UNKNOWN',
      reason: 'Supported Ruby framework markers were not detected.',
    };
  }

  private static async detectCSharp(rootDir: string): Promise<FrameworkDetectionResult | null> {
    const files = await fs.readdir(rootDir).catch(() => []);
    const csprojName = files.find((fileName) => fileName.endsWith('.csproj'));
    if (!csprojName) return null;

    const csproj = await readIfExists(path.join(rootDir, csprojName));
    if (csproj.includes('Microsoft.AspNetCore.App') || csproj.includes('Microsoft.NET.Sdk.Web')) {
      return { isSupported: true, language: 'csharp', framework: 'aspnetcore' };
    }
    return {
      isSupported: false,
      language: 'csharp',
      framework: 'UNKNOWN',
      reason: 'ASP.NET Core project markers were not detected.',
    };
  }

  private static async detectTypeScript(rootDir: string): Promise<FrameworkDetectionResult> {
    const pkgPath = path.join(rootDir, 'package.json');
    const pkgContent = await readIfExists(pkgPath);
    if (!pkgContent) {
      return { isSupported: false, language: 'UNKNOWN', framework: 'UNKNOWN', reason: 'package.json not found' };
    }

    let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    try {
      pkg = JSON.parse(pkgContent);
    } catch {
      return { isSupported: false, language: 'UNKNOWN', framework: 'UNKNOWN', reason: 'package.json is invalid JSON' };
    }

    const hasTsConfig = await exists(path.join(rootDir, 'tsconfig.json'));
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
    const detectedNestMarkers = hasNestDependencies || await hasNestMarkers(rootDir);

    if (!detectedNestMarkers) {
      return {
        isSupported: false,
        language: 'typescript',
        framework: 'generic_typescript',
        reason: 'Missing @nestjs/common or @nestjs/core in package.json',
      };
    }

    if (!hasTsConfig) {
      return {
        isSupported: false,
        language: 'UNKNOWN',
        framework: 'UNKNOWN',
        reason: 'TypeScript project markers were not detected',
      };
    }

    return { isSupported: true, language: 'typescript', framework: 'nestjs' };
  }
}
