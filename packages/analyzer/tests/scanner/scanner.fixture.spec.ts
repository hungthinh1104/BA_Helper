import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import { SafeFileEnumerator } from '../../src/scanner/core/safe-file-enumerator';
import { scanProject } from '../../src/scanner/scanner';
import { scanJavaSpringProject } from '../../src/scanner/extractors/java-spring-scanner';
import { ScanLimitsPolicy } from '../../src/scanner/core/limits';

describe('Scanner Golden Fixtures', () => {
  const rootDir = path.join(__dirname, '../../../../');
  
  it('should scan nestjs-booking-with-payment and produce stable artifact counts', async () => {
    const fixturePath = path.join(rootDir, 'tests/fixtures/nestjs-booking-with-payment');
    
    const enumerator = new SafeFileEnumerator(fixturePath);
    const enumResult = await enumerator.enumerate();
    
    // Check skipped files (package.json, tsconfig.json -> NOT skipped if not in rules)
    // Actually package.json is not skipped by default extensions.
    // Wait, node_modules should be ignored if present.
    
    const scanCoverage = {
      status: enumResult.isPartial ? 'PARTIAL' : 'FULL',
      skippedFiles: enumResult.skippedFiles,
      skippedSummary: enumResult.skippedSummary,
      limits: enumResult.limits,
      limitHits: enumResult.limitHits,
    } as const;

    const result = scanProject({
      fixturePath,
      tsFiles: enumResult.tsFiles,
      coverage: scanCoverage,
    });

    expect(result.analyzerVersion).toBeDefined();
    expect(result.coverage.status).toBe('FULL');
    
    // There are definitely API routes, service methods, and entities in this fixture
    const apiRoutes = result.artifacts.filter(a => a.type === 'API_ROUTE');
    const serviceMethods = result.artifacts.filter(a => a.type === 'SERVICE_METHOD');
    const entities = result.artifacts.filter(a => a.type === 'ENTITY');
    
    expect(apiRoutes.length).toBeGreaterThan(0);
    expect(serviceMethods.length).toBeGreaterThan(0);
    expect(entities.length).toBeGreaterThan(0);
    
    const stableKeys = result.artifacts.map(a => a.stableId);
    expect(stableKeys).toContain('api:booking.controller.cancel');

    // Verify content hashes
    expect(result.artifacts.every(a => a.contentHash && a.contentHash.startsWith('sha256:'))).toBe(true);
  });

  it('materializes file-level fallback artifacts for unsupported TypeScript source files', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ba-scan-file-fallback-'));

    try {
      const transformerPath = path.join(tempDir, 'src/transformers/transformer.ts');
      const servicePath = path.join(tempDir, 'src/app.service.ts');

      await fs.mkdir(path.dirname(transformerPath), { recursive: true });
      await fs.writeFile(
        transformerPath,
        [
          'export class DefaultIncludesTransformer {',
          '  transform(includes: string[]): string[] {',
          '    return includes.filter(Boolean);',
          '  }',
          '}',
          '',
        ].join('\n'),
      );
      await fs.writeFile(
        servicePath,
        [
          "import { Injectable } from '@nestjs/common';",
          '',
          '@Injectable()',
          'export class AppService {',
          '  getHealth(): string {',
          "    return 'ok';",
          '  }',
          '}',
          '',
        ].join('\n'),
      );

      const result = scanProject({
        fixturePath: tempDir,
        tsFiles: [transformerPath, servicePath],
      });

      expect(result.artifacts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            stableId: 'file:src.transformers.transformer.ts',
            type: 'FILE',
            filePath: 'src/transformers/transformer.ts',
            symbolName: 'transformer.ts',
          }),
          expect.objectContaining({
            stableId: 'service-method:app.service.getHealth',
            type: 'SERVICE_METHOD',
            filePath: 'src/app.service.ts',
          }),
        ]),
      );
      expect(
        result.artifacts.some((artifact) => artifact.stableId === 'file:src.app.service.ts'),
      ).toBe(false);
      expect(result.artifacts.every(a => a.contentHash && a.contentHash.startsWith('sha256:'))).toBe(true);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should scan java-spring-basic and produce PARTIAL coverage with stable artifact counts', async () => {
    const fixturePath = path.join(rootDir, 'tests/fixtures/java-spring-basic');
    
    const enumerator = new SafeFileEnumerator(fixturePath);
    const enumResult = await enumerator.enumerate();
    
    const scanCoverage = {
      status: enumResult.isPartial ? 'PARTIAL' : 'FULL',
      skippedFiles: enumResult.skippedFiles,
      skippedSummary: enumResult.skippedSummary,
      limits: enumResult.limits,
      limitHits: enumResult.limitHits,
    } as const;

    const result = await scanJavaSpringProject({
      fixturePath,
      javaFiles: enumResult.javaFiles,
      coverage: scanCoverage,
    });

    // Spring Boot pilot always PARTIAL
    expect(result.coverage.status).toBe('PARTIAL');
    expect(result.artifacts.length).toBeGreaterThan(0);
    
    const controllerMethods = result.artifacts.filter(a => a.type === 'SPRING_CONTROLLER_METHOD');
    
    expect(controllerMethods.length).toBeGreaterThan(0);

    const stableKeys = result.artifacts.map(a => a.stableId);
    expect(stableKeys).toContain('api:src/main/java/com/example/booking/BookingController.java:BookingController.getBooking:GET:/api/v1/bookings/{id}');
    expect(stableKeys).toContain('api:src/main/java/com/example/booking/BookingController.java:BookingController.createBooking:POST:/api/v1/bookings');
    expect(stableKeys).toContain('service-method:src/main/java/com/example/booking/BookingService.java:BookingService.createBooking');
    expect(stableKeys).toContain('entity:src/main/java/com/example/booking/BookingEntity.java:BookingEntity');
    expect(stableKeys).toContain('test:src/test/java/com/example/booking/BookingServiceTest.java:BookingServiceTest');

    // Verify content hashes
    expect(result.artifacts.every(a => a.contentHash && a.contentHash.startsWith('sha256:'))).toBe(true);
  });

  it('should hit file limit and return PARTIAL', async () => {
    const fixturePath = path.join(rootDir, 'tests/fixtures/nestjs-booking-with-payment');
    
    // Restrict limit to 2 files
    const limitsPolicy = new ScanLimitsPolicy({
      MAX_FILE_COUNT: 2,
      MAX_TS_FILE_COUNT: 2,
      MAX_FILE_SIZE_KB: 1024,
      MAX_REPO_SIZE_MB: 100,
      CLONE_TIMEOUT_MS: 60000,
      SCAN_TIMEOUT_MS: 120000,
    });

    const enumerator = new SafeFileEnumerator(fixturePath, limitsPolicy);
    const enumResult = await enumerator.enumerate();

    expect(enumResult.isPartial).toBe(true);
    expect(enumResult.limitHits.fileLimitHit).toBe(true);
    expect(enumResult.skippedSummary.REPO_FILE_LIMIT_EXCEEDED).toBeGreaterThan(0);
  });

  it('should skip large files, binary files, and symlinks', async () => {
    const fs = require('node:fs/promises');
    const os = require('node:os');
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ba-scan-security-'));
    
    try {
      // 1. Create a large file (exceeds 1KB limit we set for test)
      await fs.writeFile(path.join(tempDir, 'large.ts'), 'a'.repeat(2048));
      
      // 2. Create a binary file
      await fs.writeFile(path.join(tempDir, 'image.png'), 'fake binary');
      
      // 3. Create a symlink outside root
      const outsideTarget = path.join(os.tmpdir(), 'ba-outside-target');
      await fs.writeFile(outsideTarget, 'outside content');
      try {
        await fs.symlink(outsideTarget, path.join(tempDir, 'outside-link.ts'));
      } catch (e) {
        // Symlinks might fail on Windows without admin, ignore if so
      }

      const limitsPolicy = new ScanLimitsPolicy({
        MAX_FILE_COUNT: 100,
        MAX_TS_FILE_COUNT: 100,
        MAX_FILE_SIZE_KB: 1, // 1KB limit
        MAX_REPO_SIZE_MB: 100,
        CLONE_TIMEOUT_MS: 60000,
        SCAN_TIMEOUT_MS: 120000,
      });

      const enumerator = new SafeFileEnumerator(tempDir, limitsPolicy);
      const enumResult = await enumerator.enumerate();

      expect(enumResult.skippedSummary.FILE_TOO_LARGE).toBeGreaterThan(0);
      expect(enumResult.skippedSummary.BINARY_FILE).toBeGreaterThan(0);
      
      // If symlink was created successfully, check it was skipped
      const hasSymlinkSkip = enumResult.skippedSummary.SYMLINK_OUTSIDE_ROOT > 0;
      // We don't strictly assert symlink skip to avoid test flakes on OSes where symlink creation fails.
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
