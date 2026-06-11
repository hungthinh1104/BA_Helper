import { join } from 'node:path';
import { scanJavaSpringProject } from './java-spring-scanner';
import { SafeFileEnumerator } from './safe-file-enumerator';

describe('scanJavaSpringProject', () => {
  const fixturePath = join(__dirname, '../../../../tests/fixtures/java-spring-basic');

  it('extracts Java Spring Boot artifacts from the pilot fixture', async () => {
    const enumerator = new SafeFileEnumerator(fixturePath);
    const result = await enumerator.enumerate();

    const scanResult = await scanJavaSpringProject({
      fixturePath,
      analyzerVersion: '0.1.0',
      javaFiles: result.javaFiles,
    });

    expect(scanResult.artifacts.length).toBeGreaterThan(0);

    const controllerMethod1 = scanResult.artifacts.find(a => a.type === 'SPRING_CONTROLLER_METHOD' && a.stableId.includes('getBooking'));
    const controllerMethod2 = scanResult.artifacts.find(a => a.type === 'SPRING_CONTROLLER_METHOD' && a.stableId.includes('createBooking'));
    const serviceMethod1 = scanResult.artifacts.find(a => a.type === 'SPRING_SERVICE_METHOD' && a.stableId.includes('getBooking'));
    const serviceMethod2 = scanResult.artifacts.find(a => a.type === 'SPRING_SERVICE_METHOD' && a.stableId.includes('createBooking'));
    const entity = scanResult.artifacts.find(a => a.type === 'SPRING_ENTITY' && a.stableId.includes('BookingEntity'));
    const testClass = scanResult.artifacts.find(a => a.type === 'SPRING_TEST' && a.stableId.includes('BookingServiceTest'));

    expect(controllerMethod1).toBeDefined();
    expect(controllerMethod1?.type).toBe('SPRING_CONTROLLER_METHOD');

    expect(controllerMethod2).toBeDefined();
    expect(controllerMethod2?.type).toBe('SPRING_CONTROLLER_METHOD');

    expect(serviceMethod1).toBeDefined();
    expect(serviceMethod1?.type).toBe('SPRING_SERVICE_METHOD');

    expect(serviceMethod2).toBeDefined();
    expect(serviceMethod2?.type).toBe('SPRING_SERVICE_METHOD');

    expect(entity).toBeDefined();
    expect(entity?.type).toBe('SPRING_ENTITY');

    expect(testClass).toBeDefined();
    expect(testClass?.type).toBe('SPRING_TEST');
  });
});
