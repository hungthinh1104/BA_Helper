import { join } from 'node:path';
import { scanJavaSpringProject } from '../../../src/scanner/extractors/java-spring-scanner';
import { SafeFileEnumerator } from '../../../src/scanner/core/safe-file-enumerator';

describe('scanJavaSpringProject', () => {
  const fixturePath = join(__dirname, '../../../../../tests/fixtures/java-spring-basic');

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

  it('extracts supported Spring patterns from PaymentController and RefundService', async () => {
    const enumerator = new SafeFileEnumerator(fixturePath);
    const result = await enumerator.enumerate();

    const scanResult = await scanJavaSpringProject({
      fixturePath,
      analyzerVersion: '0.1.0',
      javaFiles: result.javaFiles,
    });

    const paymentController = scanResult.artifacts.filter(a => a.filePath.includes('PaymentController.java'));
    expect(paymentController.length).toBeGreaterThan(0);

    const postMethod = paymentController.find(a => a.stableId.includes('POST:/api/payments'));
    const putMethod = paymentController.find(a => a.stableId.includes('PUT:/api/payments/{id}'));
    const deleteMethod = paymentController.find(a => a.stableId.includes('DELETE:/api/payments/{id}'));
    const getMethod = paymentController.find(a => a.stableId.includes('GET:/api/payments/{id}'));
    const patchMethod = paymentController.find(a => a.stableId.includes('PATCH:/api/payments/{id}'));
    const getAllMethod = paymentController.find(a => a.stableId.includes('GET:/api/payments/all'));
    const submitMethod = paymentController.find(a => a.stableId.includes('POST:/api/payments/submit'));
    const cancelMethod = paymentController.find(a => a.stableId.includes('DELETE:/api/payments/cancel/{id}'));

    expect(postMethod).toBeDefined();
    expect(putMethod).toBeDefined();
    expect(deleteMethod).toBeDefined();
    expect(getMethod).toBeDefined();
    expect(patchMethod).toBeDefined();
    expect(getAllMethod).toBeDefined();
    expect(submitMethod).toBeDefined();
    expect(cancelMethod).toBeDefined();

    const refundService = scanResult.artifacts.filter(a => a.filePath.includes('RefundService.java'));
    expect(refundService.length).toBeGreaterThan(0);
    const processRefund = refundService.find(a => a.stableId.includes('RefundService.processRefund'));
    expect(processRefund).toBeDefined();
  });

  it('emits bounded diagnostics for unsupported patterns and does not fabricate endpoints', async () => {
    const enumerator = new SafeFileEnumerator(fixturePath);
    const result = await enumerator.enumerate();

    const scanResult = await scanJavaSpringProject({
      fixturePath,
      analyzerVersion: '0.1.0',
      javaFiles: result.javaFiles,
    });

    const complexControllerArtifacts = scanResult.artifacts.filter(a => a.filePath.includes('ComplexUnsupportedController.java'));
    
    // It should not extract any API endpoints from the unsupported methods
    expect(complexControllerArtifacts.length).toBe(0);

    // It should have emitted the specific bounded diagnostics
    const codes = scanResult.diagnostics?.map(d => d.code) || [];
    
    expect(codes).toContain('SPRING_COMPOSED_MAPPING_UNSUPPORTED');
    expect(codes).toContain('SPRING_DYNAMIC_ROUTE_UNSUPPORTED');
    expect(codes).toContain('SPRING_MULTI_ROUTE_MAPPING_UNSUPPORTED');
    expect(codes).toContain('SPRING_REQUEST_MAPPING_FORM_UNSUPPORTED');
    expect(codes).toContain('SPRING_HTTP_METHOD_UNKNOWN');

    // Diagnostics should not contain full file dumps, so we check for bounded messages
    const composedDiag = scanResult.diagnostics?.find(d => d.code === 'SPRING_COMPOSED_MAPPING_UNSUPPORTED');
    expect(composedDiag?.message).toMatch(/BookingPostMapping unsupported at ComplexUnsupportedController\.customMapping/);
  });

  it('ensures artifact keys are deterministic, path-safe, and do not use line numbers', async () => {
    const enumerator = new SafeFileEnumerator(fixturePath);
    const result = await enumerator.enumerate();

    const scan1 = await scanJavaSpringProject({
      fixturePath,
      analyzerVersion: '0.1.0',
      javaFiles: result.javaFiles,
    });

    const scan2 = await scanJavaSpringProject({
      fixturePath,
      analyzerVersion: '0.1.0',
      javaFiles: result.javaFiles,
    });

    const keys1 = scan1.artifacts.map(a => a.stableId).sort();
    const keys2 = scan2.artifacts.map(a => a.stableId).sort();

    expect(keys1).toEqual(keys2);

    for (const key of keys1) {
      // Keys should not contain absolute paths (assuming /home or C: would be absolute)
      expect(key).not.toMatch(/^\/home/);
      expect(key).not.toMatch(/^[A-Z]:\\/);
      
      // Keys should not contain line numbers separated by colon at the end, 
      // typically in the format :L123 or :123 as the identity of the method.
      // E.g. we expect "api:path:class.method:HTTP:route"
      expect(key).not.toMatch(/:\d+$/);
    }
  });
});
