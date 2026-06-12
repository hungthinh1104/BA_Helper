import { join } from 'node:path';
import { FrameworkDetector } from '../../../src/scanner/detectors/framework-detector';

describe('FrameworkDetector', () => {
  it('detects Java Spring Boot from the pilot fixture', async () => {
    const fixturePath = join(__dirname, '../../../../../tests/fixtures/java-spring-basic');
    const result = await FrameworkDetector.detect(fixturePath);

    expect(result.isSupported).toBe(true);
    expect(result.language).toBe('JAVA');
    expect(result.framework).toBe('SPRING_BOOT');
  });
});
