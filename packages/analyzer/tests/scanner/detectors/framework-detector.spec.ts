import { join } from 'node:path';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { FrameworkDetector } from '../../../src/scanner/detectors/framework-detector';

describe('FrameworkDetector', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it('detects Java Spring Boot from the pilot fixture', async () => {
    const fixturePath = join(__dirname, '../../../../../tests/fixtures/java-spring-basic');
    const result = await FrameworkDetector.detect(fixturePath);

    expect(result.isSupported).toBe(true);
    expect(result.language).toBe('java');
    expect(result.framework).toBe('spring_boot');
  });

  it('rejects ambiguous polyglot repositories instead of picking the first adapter', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'ba-polyglot-'));
    tempDirs.push(tempDir);
    await mkdir(join(tempDir, 'src/main/java/com/example'), { recursive: true });
    await writeFile(join(tempDir, 'pom.xml'), '<project><parent><groupId>org.springframework.boot</groupId></parent></project>');
    await writeFile(join(tempDir, 'src/main/java/com/example/App.java'), 'class App {}');
    await writeFile(join(tempDir, 'package.json'), '{"dependencies":{"@nestjs/common":"10.0.0","typescript":"5.0.0"}}');
    await writeFile(join(tempDir, 'tsconfig.json'), '{}');
    await mkdir(join(tempDir, 'src'), { recursive: true });
    await writeFile(join(tempDir, 'src/app.controller.ts'), 'import { Controller } from "@nestjs/common"; @Controller() class AppController {}');

    const result = await FrameworkDetector.detect(tempDir);

    expect(result.isSupported).toBe(false);
    expect(result.language).toBe('UNKNOWN');
    expect(result.framework).toBe('UNKNOWN');
    expect(result.reason).toContain('Ambiguous polyglot repository markers detected');
  });

  it('does not reject a clear primary framework because of auxiliary script files', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'ba-primary-with-scripts-'));
    tempDirs.push(tempDir);
    await writeFile(join(tempDir, 'package.json'), '{"dependencies":{"@nestjs/common":"10.0.0","typescript":"5.0.0"}}');
    await writeFile(join(tempDir, 'tsconfig.json'), '{}');
    await mkdir(join(tempDir, 'src'), { recursive: true });
    await writeFile(join(tempDir, 'src/app.controller.ts'), 'import { Controller } from "@nestjs/common"; @Controller() class AppController {}');
    await mkdir(join(tempDir, 'scripts'), { recursive: true });
    await writeFile(join(tempDir, 'scripts/maintenance.py'), 'print("maintenance helper")');

    const result = await FrameworkDetector.detect(tempDir);

    expect(result.isSupported).toBe(true);
    expect(result.language).toBe('typescript');
    expect(result.framework).toBe('nestjs');
  });
});
