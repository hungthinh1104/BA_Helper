import { DiagnosticCollector } from '../../../src/scanner/core/diagnostic-collector';

describe('DiagnosticCollector', () => {
  it('groups multiple diagnostics by code and counts them', () => {
    const collector = new DiagnosticCollector();
    
    collector.add({
      code: 'FILE_TOO_LARGE',
      severity: 'WARN',
      message: 'File skipped because it exceeded size limits.',
      category: 'FILE_SYSTEM',
      samplePaths: ['src/large1.ts']
    });
    
    collector.add({
      code: 'FILE_TOO_LARGE',
      severity: 'WARN',
      message: 'File skipped because it exceeded size limits.',
      category: 'FILE_SYSTEM',
      samplePaths: ['src/large2.ts']
    });
    
    const items = collector.getItems();
    expect(items.length).toBe(1);
    expect(items[0].code).toBe('FILE_TOO_LARGE');
    expect(items[0].count).toBe(2);
    expect(items[0].samplePaths).toEqual(['src/large1.ts', 'src/large2.ts']);
  });

  it('keeps up to 5 sample paths', () => {
    const collector = new DiagnosticCollector();
    
    for (let i = 0; i < 10; i++) {
      collector.add({
        code: 'SYMLINK_SKIPPED',
        severity: 'INFO',
        message: 'Symlink ignored.',
        category: 'FILE_SYSTEM',
        samplePaths: [`src/sym${i}.ts`]
      });
    }
    
    const items = collector.getItems();
    expect(items[0].count).toBe(10);
    expect(items[0].samplePaths?.length).toBe(5);
  });
});
