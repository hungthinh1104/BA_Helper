import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { FrameworkDetector, RepositoryProfileDetector } from '../../packages/analyzer/src';
import type { DetectedRepositoryProfile } from '../../packages/analyzer/src';

const writeJson = async (filePath: string, value: unknown) => {
  await fs.mkdir(dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2));
};

const safeRm = async (targetPath: string) => {
  await fs.rm(targetPath, { recursive: true, force: true });
};

const toProfileFrameworkHint = (framework?: string): DetectedRepositoryProfile['framework'] | undefined => {
  if (framework === 'nestjs') return 'NESTJS';
  if (framework === 'spring_boot') return 'SPRING_BOOT';
  if (framework === 'generic_typescript') return 'GENERIC_TYPESCRIPT';
  if (framework === 'net/http') return 'NET_HTTP';
  if (framework === 'gin') return 'GIN';
  if (framework === 'fastapi') return 'FASTAPI';
  if (framework === 'aspnetcore') return 'ASPNETCORE';
  if (framework === 'laravel') return 'LARAVEL';
  if (framework === 'rails') return 'RAILS';
  return undefined;
};

const toProfileLanguageHint = (language?: string): DetectedRepositoryProfile['language'] | undefined => {
  if (language === 'typescript') return 'TYPESCRIPT';
  if (language === 'java') return 'JAVA';
  if (language === 'go') return 'GO';
  if (language === 'python') return 'PYTHON';
  if (language === 'csharp') return 'CSHARP';
  if (language === 'php') return 'PHP';
  if (language === 'ruby') return 'RUBY';
  return undefined;
};

describe('RepositoryProfileDetector', () => {
  it('detects a NestJS fixture profile with bounded roots', async () => {
    const fixturePath = resolve(__dirname, '../fixtures/nestjs-booking-with-payment');

    const framework = await FrameworkDetector.detect(fixturePath);
    const profile = await RepositoryProfileDetector.detect({
      rootDir: fixturePath,
      languageHint: toProfileLanguageHint(framework.language),
      frameworkHint: toProfileFrameworkHint(framework.framework),
    });

    expect(profile.language).toBe('TYPESCRIPT');
    expect(profile.framework).toBe('NESTJS');
    expect(profile.sourceRoots.length).toBeGreaterThan(0);
    expect(profile.sourceRoots.length).toBeLessThanOrEqual(20);
    expect(profile.testRoots.length).toBeLessThanOrEqual(20);
    expect(profile.profileVersion).toBe('repo-profile@0.1.0');
  });

  it('detects generic typescript without broadening extraction support', async () => {
    const tempDir = await fs.mkdtemp(join(os.tmpdir(), 'ba-profile-generic-'));

    try {
      await writeJson(join(tempDir, 'package.json'), {
        name: 'generic-typescript-service',
        devDependencies: {
          typescript: '^5.0.0',
        },
      });
      await fs.writeFile(join(tempDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: {} }, null, 2));
      await fs.mkdir(join(tempDir, 'src', 'services'), { recursive: true });
      await fs.mkdir(join(tempDir, 'tests'), { recursive: true });
      await fs.writeFile(
        join(tempDir, 'src', 'services', 'refund-service.ts'),
        'export class RefundService { run() { return true; } }',
      );
      await fs.writeFile(
        join(tempDir, 'tests', 'refund-service.spec.ts'),
        'describe("refund service", () => it("works", () => expect(true).toBe(true)));',
      );

      const framework = await FrameworkDetector.detect(tempDir);
      const profile = await RepositoryProfileDetector.detect({
        rootDir: tempDir,
        languageHint: toProfileLanguageHint(framework.language),
        frameworkHint: toProfileFrameworkHint(framework.framework),
        unsupportedReason: framework.reason,
      });

      expect(framework.isSupported).toBe(false);
      expect(framework.framework).toBe('generic_typescript');
      expect(profile.language).toBe('TYPESCRIPT');
      expect(profile.framework).toBe('GENERIC_TYPESCRIPT');
      expect(profile.sourceRoots).toContain('src');
      expect(profile.testRoots).toContain('tests');
      expect(profile.diagnostics?.unsupportedReason).toContain('@nestjs');
    } finally {
      await safeRm(tempDir);
    }
  });

  it('aligns a Java Spring detector result to a persisted repository profile shape', async () => {
    const fixturePath = resolve(__dirname, '../fixtures/java-spring-basic');

    const framework = await FrameworkDetector.detect(fixturePath);
    const profile = await RepositoryProfileDetector.detect({
      rootDir: fixturePath,
      languageHint: toProfileLanguageHint(framework.language),
      frameworkHint: toProfileFrameworkHint(framework.framework),
    });

    expect(framework).toMatchObject({
      isSupported: true,
      language: 'java',
      framework: 'spring_boot',
    });
    expect(profile.language).toBe('JAVA');
    expect(profile.framework).toBe('SPRING_BOOT');
    expect(profile.sourceRoots).toContain('src');
  });

  it('aligns FastAPI detector hints to non-TypeScript profile values', async () => {
    const fixturePath = resolve(__dirname, '../fixtures/python-fastapi-basic');

    const framework = await FrameworkDetector.detect(fixturePath);
    const profile = await RepositoryProfileDetector.detect({
      rootDir: fixturePath,
      languageHint: toProfileLanguageHint(framework.language),
      frameworkHint: toProfileFrameworkHint(framework.framework),
    });

    expect(framework).toMatchObject({
      isSupported: true,
      language: 'python',
      framework: 'fastapi',
    });
    expect(profile.language).toBe('PYTHON');
    expect(profile.framework).toBe('FASTAPI');
  });

  it('keeps weak domain evidence as UNKNOWN', async () => {
    const tempDir = await fs.mkdtemp(join(os.tmpdir(), 'ba-profile-unknown-'));

    try {
      await writeJson(join(tempDir, 'package.json'), {
        name: 'generic-typescript-service',
        dependencies: {
          '@nestjs/common': '^10.0.0',
          '@nestjs/core': '^10.0.0',
        },
        devDependencies: {
          typescript: '^5.0.0',
        },
      });
      await fs.writeFile(join(tempDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: {} }, null, 2));
      await fs.mkdir(join(tempDir, 'src', 'common'), { recursive: true });
      await fs.writeFile(
        join(tempDir, 'src', 'common', 'health.controller.ts'),
        'import { Controller } from "@nestjs/common"; @Controller() export class HealthController {}',
      );

      const framework = await FrameworkDetector.detect(tempDir);
      const profile = await RepositoryProfileDetector.detect({
        rootDir: tempDir,
        languageHint: toProfileLanguageHint(framework.language),
        frameworkHint: toProfileFrameworkHint(framework.framework),
      });

      expect(profile.domain).toBe('UNKNOWN');
    } finally {
      await safeRm(tempDir);
    }
  });

  it('produces deterministic output across reruns', async () => {
    const fixturePath = resolve(__dirname, '../fixtures/nestjs-booking-with-payment');
    const framework = await FrameworkDetector.detect(fixturePath);

    const first = await RepositoryProfileDetector.detect({
      rootDir: fixturePath,
      languageHint: toProfileLanguageHint(framework.language),
      frameworkHint: toProfileFrameworkHint(framework.framework),
    });
    const second = await RepositoryProfileDetector.detect({
      rootDir: fixturePath,
      languageHint: toProfileLanguageHint(framework.language),
      frameworkHint: toProfileFrameworkHint(framework.framework),
    });

    expect(second).toEqual(first);
  });
});
