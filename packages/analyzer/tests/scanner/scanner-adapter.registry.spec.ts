import { ScannerAdapterRegistry } from '../../src/scanner/scanner-adapter.registry';
import { ScannerAdapter, ScanAdapterInput } from '../../src/scanner/scanner.types';

describe('ScannerAdapterRegistry', () => {
  let registry: ScannerAdapterRegistry;

  beforeEach(() => {
    registry = new ScannerAdapterRegistry();
  });

  describe('Capability Profiles', () => {
    it('returns deterministic capabilities', () => {
      const capabilities = registry.listCapabilities();
      expect(capabilities.length).toBe(8);

      const tsCap = capabilities.find(c => c.language === 'typescript');
      expect(tsCap).toBeDefined();
      expect(tsCap?.status).toBe('STABLE');
      expect(tsCap?.confidence).toBe('HIGH');
      expect(tsCap?.supportedPatterns.length).toBeGreaterThan(0);

      const javaCap = capabilities.find(c => c.language === 'java');
      expect(javaCap).toBeDefined();
      expect(javaCap?.status).toBe('PARTIAL');
      expect(javaCap?.confidence).toBe('MEDIUM');
      expect(javaCap?.partialPatterns.length).toBeGreaterThan(0);
      expect(javaCap?.unsupportedPatterns.length).toBeGreaterThan(0);

      const goCap = capabilities.find(c => c.language === 'go');
      expect(goCap).toBeDefined();
      expect(goCap?.status).toBe('EXPERIMENTAL');
      expect(goCap?.confidence).toBe('LOW');
      expect(goCap?.unsupportedPatterns.length).toBeGreaterThan(0);

      const pyCap = capabilities.find(c => c.language === 'python');
      expect(pyCap).toBeDefined();
      expect(pyCap?.status).toBe('EXPERIMENTAL');
      expect(pyCap?.confidence).toBe('LOW');

      const csCap = capabilities.find(c => c.language === 'csharp');
      expect(csCap).toBeDefined();
      expect(csCap?.status).toBe('EXPERIMENTAL');
      expect(csCap?.confidence).toBe('LOW');
      expect(csCap?.unsupportedPatterns.length).toBeGreaterThan(0);

      const phpCap = capabilities.find(c => c.language === 'php');
      expect(phpCap).toBeDefined();
      expect(phpCap?.status).toBe('EXPERIMENTAL');
      expect(phpCap?.confidence).toBe('LOW');
      expect(phpCap?.framework).toBe('laravel');

      const rbCap = capabilities.find(c => c.language === 'ruby');
      expect(rbCap).toBeDefined();
      expect(rbCap?.status).toBe('EXPERIMENTAL');
      expect(rbCap?.confidence).toBe('LOW');
      expect(rbCap?.framework).toBe('rails');
    });
  });

  describe('Adapter Selection', () => {
    it('selects TypeScript/NestJS adapter', () => {
      const adapter = registry.getAdapter('typescript', 'nestjs');
      expect(adapter).toBeDefined();
      expect(adapter.language).toBe('typescript');
      expect(adapter.framework).toBe('nestjs');
    });

    it('selects Java/Spring adapter', () => {
      const adapter = registry.getAdapter('java', 'spring');
      expect(adapter).toBeDefined();
      expect(adapter.language).toBe('java');
      expect(adapter.framework).toBe('spring_boot');
    });

    it('selects Go adapter', () => {
      const adapter1 = registry.getAdapter('go', 'gin');
      expect(adapter1).toBeDefined();
      expect(adapter1.language).toBe('go');

      const adapter2 = registry.getAdapter('go', 'net/http');
      expect(adapter2).toBeDefined();
      expect(adapter2.language).toBe('go');
    });

    it('handles uppercase legacy inputs', () => {
      const adapter1 = registry.getAdapter('TYPESCRIPT', 'NESTJS');
      expect(adapter1).toBeDefined();

      const adapter2 = registry.getAdapter('JAVA', 'SPRING');
      expect(adapter2).toBeDefined();
    });

    it('selects CSharp/ASP.NET Core adapter', () => {
      const adapter = registry.getAdapter('csharp', 'aspnetcore');
      expect(adapter).toBeDefined();
      expect(adapter.language).toBe('csharp');
      expect(adapter.framework).toBe('aspnetcore');
    });

    it('selects PHP/Laravel adapter', () => {
      const adapter = registry.getAdapter('php', 'laravel');
      expect(adapter).toBeDefined();
      expect(adapter.language).toBe('php');
      expect(adapter.framework).toBe('laravel');
    });

    it('selects Ruby/Rails adapter', () => {
      const adapter = registry.getAdapter('ruby', 'rails');
      expect(adapter).toBeDefined();
      expect(adapter.language).toBe('ruby');
      expect(adapter.framework).toBe('rails');
    });

    it('returns null via tryGetAdapter for unknown framework with python', () => {
      const adapter = registry.tryGetAdapter('python', 'django');
      expect(adapter).toBeNull();
    });

    it('throws via getAdapter for unknown language', () => {
      expect(() => registry.getAdapter('ruby')).toThrow('UNSUPPORTED_LANGUAGE_OR_FRAMEWORK');
    });

    it('throws via getAdapter for ruby without explicit rails framework', () => {
      expect(() => registry.getAdapter('ruby')).toThrow('UNSUPPORTED_LANGUAGE_OR_FRAMEWORK');
    });

    it('throws via getAdapter for csharp without explicit aspnetcore framework', () => {
      expect(() => registry.getAdapter('csharp')).toThrow('UNSUPPORTED_LANGUAGE_OR_FRAMEWORK');
    });

    it('throws via getAdapter for csharp with unsupported framework', () => {
      expect(() => registry.getAdapter('csharp', 'dotnet-mvc' as any)).toThrow('UNSUPPORTED_LANGUAGE_OR_FRAMEWORK');
    });

    it('throws via getAdapter for php without laravel framework', () => {
      expect(() => registry.getAdapter('php')).toThrow('UNSUPPORTED_LANGUAGE_OR_FRAMEWORK');
    });
  });

  describe('Contract Compliance', () => {
    const mockInput: ScanAdapterInput = {
      rootDir: '/mock/path',
      tsFiles: [],
      javaFiles: [],
    };

    it('TypeScript/NestJS adapter complies with contract', async () => {
      const adapter = registry.getAdapter('typescript', 'nestjs');
      
      const result = await adapter.scan(mockInput);
      
      expect(Array.isArray(result.artifacts)).toBe(true);
      expect(Array.isArray(result.dependencyEdges)).toBe(true);
      expect(Array.isArray(result.diagnostics)).toBe(true);
      expect(result.capability).toBeDefined();
      expect(result.capability.status).toBe('STABLE');

      const summaryDiagnostic = result.diagnostics.find(d => d.code === 'SCANNER_CAPABILITY_SUMMARY');
      expect(summaryDiagnostic).toBeDefined();
      expect(summaryDiagnostic?.payload).toBeDefined();
      expect(summaryDiagnostic?.payload?.status).toBe('STABLE');
    });

    it('Java/Spring adapter complies with contract', async () => {
      const adapter = registry.getAdapter('java', 'spring');
      
      const result = await adapter.scan(mockInput);
      
      expect(Array.isArray(result.artifacts)).toBe(true);
      expect(Array.isArray(result.dependencyEdges)).toBe(true);
      expect(Array.isArray(result.diagnostics)).toBe(true);
      expect(result.capability).toBeDefined();
      expect(result.capability.status).toBe('PARTIAL');

      const summaryDiagnostic = result.diagnostics.find(d => d.code === 'SCANNER_CAPABILITY_SUMMARY');
      expect(summaryDiagnostic).toBeDefined();
      expect(summaryDiagnostic?.payload).toBeDefined();
      expect(summaryDiagnostic?.payload?.status).toBe('PARTIAL');
    });

    it('Go adapter complies with contract', async () => {
      const adapter = registry.getAdapter('go', 'gin');
      
      const result = await adapter.scan({ ...mockInput, goFiles: [] });
      
      expect(Array.isArray(result.artifacts)).toBe(true);
      expect(Array.isArray(result.dependencyEdges)).toBe(true);
      expect(Array.isArray(result.diagnostics)).toBe(true);
      expect(result.capability).toBeDefined();
      expect(result.capability.status).toBe('EXPERIMENTAL');

      const summaryDiagnostic = result.diagnostics.find(d => d.code === 'SCANNER_CAPABILITY_SUMMARY');
      expect(summaryDiagnostic).toBeDefined();
      expect(summaryDiagnostic?.payload).toBeDefined();
      expect(summaryDiagnostic?.payload?.status).toBe('EXPERIMENTAL');
    });

    it('CSharp/ASP.NET Core adapter complies with contract', async () => {
      const adapter = registry.getAdapter('csharp', 'aspnetcore');
      
      const result = await adapter.scan({ ...mockInput, csFiles: [] });
      
      expect(Array.isArray(result.artifacts)).toBe(true);
      expect(Array.isArray(result.dependencyEdges)).toBe(true);
      expect(Array.isArray(result.diagnostics)).toBe(true);
      expect(result.capability).toBeDefined();
      expect(result.capability.status).toBe('EXPERIMENTAL');
      expect(result.capability.language).toBe('csharp');

      const summaryDiagnostic = result.diagnostics.find(d => d.code === 'SCANNER_CAPABILITY_SUMMARY');
      expect(summaryDiagnostic).toBeDefined();
      expect(summaryDiagnostic?.payload?.status).toBe('EXPERIMENTAL');
    });

    it('PHP/Laravel adapter complies with contract', async () => {
      const adapter = registry.getAdapter('php', 'laravel');

      const result = await adapter.scan({ ...mockInput, phpFiles: [] });

      expect(Array.isArray(result.artifacts)).toBe(true);
      expect(Array.isArray(result.dependencyEdges)).toBe(true);
      expect(Array.isArray(result.diagnostics)).toBe(true);
      expect(result.capability).toBeDefined();
      expect(result.capability.status).toBe('EXPERIMENTAL');
      expect(result.capability.language).toBe('php');
      expect(result.capability.framework).toBe('laravel');

      const summaryDiagnostic = result.diagnostics.find(d => d.code === 'SCANNER_CAPABILITY_SUMMARY');
      expect(summaryDiagnostic).toBeDefined();
      expect(summaryDiagnostic?.payload?.status).toBe('EXPERIMENTAL');
    });

    it('Ruby/Rails adapter complies with contract', async () => {
      const adapter = registry.getAdapter('ruby', 'rails');

      const result = await adapter.scan({ ...mockInput, rbFiles: [] });

      expect(Array.isArray(result.artifacts)).toBe(true);
      expect(Array.isArray(result.dependencyEdges)).toBe(true);
      expect(Array.isArray(result.diagnostics)).toBe(true);
      expect(result.capability).toBeDefined();
      expect(result.capability.status).toBe('EXPERIMENTAL');
      expect(result.capability.language).toBe('ruby');
      expect(result.capability.framework).toBe('rails');

      const summaryDiagnostic = result.diagnostics.find(d => d.code === 'SCANNER_CAPABILITY_SUMMARY');
      expect(summaryDiagnostic).toBeDefined();
      expect(summaryDiagnostic?.payload?.status).toBe('EXPERIMENTAL');
    });
  });
});
