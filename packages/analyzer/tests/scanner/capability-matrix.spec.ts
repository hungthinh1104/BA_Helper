import { ScannerAdapterRegistry } from '../../src/scanner/scanner-adapter.registry';

describe('Scanner Capability Matrix & Regression Lockdown', () => {
  const registry = new ScannerAdapterRegistry();

  describe('Explicit Adapter Resolution', () => {
    const supportedPairs = [
      { lang: 'typescript', fw: 'nestjs', expectedStatus: 'STABLE', expectedConfidence: 'HIGH' },
      { lang: 'java', fw: 'spring', expectedStatus: 'PARTIAL', expectedConfidence: 'MEDIUM' },
      { lang: 'go', fw: 'net/http', expectedStatus: 'EXPERIMENTAL', expectedConfidence: 'LOW' },
      { lang: 'go', fw: 'gin', expectedStatus: 'EXPERIMENTAL', expectedConfidence: 'LOW' },
      { lang: 'python', fw: 'fastapi', expectedStatus: 'EXPERIMENTAL', expectedConfidence: 'LOW' },
      { lang: 'csharp', fw: 'aspnetcore', expectedStatus: 'EXPERIMENTAL', expectedConfidence: 'LOW' },
      { lang: 'php', fw: 'laravel', expectedStatus: 'EXPERIMENTAL', expectedConfidence: 'LOW' },
      { lang: 'ruby', fw: 'rails', expectedStatus: 'EXPERIMENTAL', expectedConfidence: 'LOW' },
    ] as const;

    it.each(supportedPairs)(
      'resolves $lang + $fw explicitly without fallback',
      ({ lang, fw, expectedStatus, expectedConfidence }) => {
        const adapter = registry.getAdapter(lang, fw);
        expect(adapter).toBeDefined();
        expect(adapter.language).toBe(lang);
        expect(adapter.framework).toBe(fw);
        expect(adapter.capability.status).toBe(expectedStatus);
        expect(adapter.capability.confidence).toBe(expectedConfidence);
      },
    );
  });

  describe('Rejection of Unsupported Language/Framework Pairs', () => {
    const unsupportedPairs = [
      { lang: 'python', fw: 'django' },
      { lang: 'python', fw: 'flask' },
      { lang: 'php', fw: 'symfony' },
      { lang: 'csharp', fw: undefined }, // csharp requires explicit framework
      { lang: 'go', fw: 'echo' },
      { lang: 'java', fw: undefined }, // java requires explicit framework
      { lang: 'unknown', fw: 'nestjs' },
      { lang: 'ruby', fw: 'sinatra' },
      { lang: 'ruby', fw: 'hanami' },
      { lang: 'ruby', fw: undefined },
    ] as const;

    it.each(unsupportedPairs)(
      'rejects $lang + $fw with UNSUPPORTED_LANGUAGE_OR_FRAMEWORK',
      ({ lang, fw }) => {
        expect(() => registry.getAdapter(lang, fw)).toThrow('UNSUPPORTED_LANGUAGE_OR_FRAMEWORK');
      },
    );
  });

  describe('Artifact Integrity & Diagnostic Emission', () => {
    const testCases = [
      { lang: 'java', fw: 'spring', fileField: 'javaFiles', files: ['Test.java'] },
      { lang: 'go', fw: 'gin', fileField: 'goFiles', files: ['main.go'] },
      { lang: 'python', fw: 'fastapi', fileField: 'pyFiles', files: ['main.py'] },
      { lang: 'csharp', fw: 'aspnetcore', fileField: 'csFiles', files: ['Controller.cs'] },
      { lang: 'php', fw: 'laravel', fileField: 'phpFiles', files: ['api.php'] },
      { lang: 'ruby', fw: 'rails', fileField: 'rbFiles', files: ['routes.rb'] },
    ];

    it.each(testCases)(
      'verifies $lang + $fw emits SCANNER_CAPABILITY_SUMMARY',
      async ({ lang, fw, fileField, files }) => {
        const adapter = registry.getAdapter(lang, fw);
        
        const input: any = {
          rootDir: '/tmp/project',
          fixturePath: '/tmp/project',
          tsFiles: [],
          javaFiles: [],
          goFiles: [],
          pyFiles: [],
          csFiles: [],
          phpFiles: [],
          rbFiles: [],
        };
        input[fileField] = files;

        const result = await adapter.scan(input);

        // 1. SCANNER_CAPABILITY_SUMMARY exists
        const capSummary = result.diagnostics?.find(d => d.code === 'SCANNER_CAPABILITY_SUMMARY');
        expect(capSummary).toBeDefined();
        expect(capSummary?.payload?.status).toBe(adapter.capability.status);

        // 2. Artifact keys must be deterministic and path-safe
        // (Even if 0 artifacts, we assert that ALL returned artifacts conform to the rules)
        for (const artifact of result.artifacts) {
          expect(artifact.type).toBe('HTTP_ENDPOINT');

          const key = artifact.stableId;
          expect(key).not.toContain('/'); // Path-safe
          expect(key).not.toContain('\\');
          expect(key).not.toMatch(/\d{10,}/); // No timestamps
          
          // Should not contain absolute paths (assuming /tmp/project is an absolute path)
          expect(key).not.toContain('tmp');
          expect(key).not.toContain('project');

          // No line numbers (usually seen as :123 or _L123)
          expect(key).not.toMatch(/:\d+$/);
          expect(key).not.toMatch(/_L\d+$/);
        }
      },
    );
  });
});
