import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { GraphSourceResolver } from '../../src/graph/graph-source-resolver';
import { scanProject } from '../../src/scanner/scanner';

describe('graph source artifact indexes', () => {
  let root: string;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'ba-graph-index-')); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  it('preserves the scan order and global ambiguity exclusions of per-file lookups', () => {
    const paths = ['a.spec.ts', 'b.spec.ts'].map(name => {
      const file = join(root, name);
      writeFileSync(file, "it('first', () => action()); it('second', () => other());");
      return file;
    });
    const scan = scanProject({ fixturePath: root, tsFiles: paths });
    const first = scan.artifacts.find(artifact => artifact.type === 'JEST_TEST_CASE')!;
    scan.artifacts.push({ ...first, filePath: 'b.spec.ts' });
    const test = scan.artifacts.find(artifact => artifact.type === 'TEST')!;
    scan.artifacts.unshift({ ...test, stableId: 'test:alternate-first-match' });
    const resolver = new GraphSourceResolver(scan);
    for (const file of resolver.project.getSourceFiles()) {
      const eligible = scan.artifacts.filter(artifact =>
        !resolver.ambiguousArtifacts.includes(artifact) &&
        resolve(scan.sourceRoot!, artifact.filePath) === resolve(file.getFilePath()));
      expect(resolver.testArtifact(file)).toBe(eligible.find(artifact => artifact.type === 'TEST'));
      expect(resolver.testCases(file)).toEqual(eligible.filter(artifact => artifact.type === 'JEST_TEST_CASE'));
    }
  });

  it('does not share indexes across builds or load an excluded import', () => {
    const accepted = join(root, 'payment.spec.ts');
    const excluded = join(root, 'excluded.spec.ts');
    writeFileSync(accepted, "import './excluded.spec'; it('accepted', () => action());");
    writeFileSync(excluded, "it('excluded', () => action());");
    const scan = scanProject({ fixturePath: root, tsFiles: [accepted] });
    const resolver = new GraphSourceResolver(scan);
    expect(resolver.project.getSourceFiles()).toHaveLength(1);
    expect(resolver.testCases(resolver.project.getSourceFiles()[0])).toHaveLength(1);
    const empty = new GraphSourceResolver({ ...scan, artifacts: [] });
    const file = empty.project.getSourceFiles()[0];
    expect(empty.testArtifact(file)).toBeUndefined();
    expect(empty.testCases(file)).toEqual([]);
  });
});
