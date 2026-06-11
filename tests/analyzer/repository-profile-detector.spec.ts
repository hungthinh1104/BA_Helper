import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { FrameworkDetector, RepositoryProfileDetector } from '../../packages/analyzer/src';

const writeJson = async (filePath: string, value: unknown) => {
  await fs.mkdir(dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2));
};

const safeRm = async (targetPath: string) => {
  await fs.rm(targetPath, { recursive: true, force: true });
};

describe('RepositoryProfileDetector', () => {
  it('detects a NestJS fixture profile with bounded roots', async () => {
    const fixturePath = resolve(__dirname, '../fixtures/nestjs-booking-with-payment');

    const framework = await FrameworkDetector.detect(fixturePath);
    const profile = await RepositoryProfileDetector.detect({
      rootDir: fixturePath,
      frameworkHint: framework.framework,
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
        frameworkHint: framework.framework,
        unsupportedReason: framework.reason,
      });

      expect(framework.isSupported).toBe(false);
      expect(framework.framework).toBe('GENERIC_TYPESCRIPT');
      expect(profile.language).toBe('TYPESCRIPT');
      expect(profile.framework).toBe('GENERIC_TYPESCRIPT');
      expect(profile.sourceRoots).toContain('src');
      expect(profile.testRoots).toContain('tests');
      expect(profile.diagnostics?.unsupportedReason).toContain('@nestjs');
    } finally {
      await safeRm(tempDir);
    }
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
        frameworkHint: framework.framework,
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
      frameworkHint: framework.framework,
    });
    const second = await RepositoryProfileDetector.detect({
      rootDir: fixturePath,
      frameworkHint: framework.framework,
    });

    expect(second).toEqual(first);
  });
});
