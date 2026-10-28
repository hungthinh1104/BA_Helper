import { mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SecretRedactor } from '../packages/analyzer/src/scanner/core/secret-redactor';
import { verifyPinnedProjectionProvenance } from './verify-pinned-comprehension-provenance';

const filePath = 'scripts/verify-pinned-comprehension-provenance.spec.ts';
const sourceLine = "import { verifyPinnedProjectionProvenance } from './verify-pinned-comprehension-provenance';";
const sourceLineNumber = readFileSync(filePath, 'utf8').split(/\r\n?|\n/).findIndex(line => line === sourceLine) + 1;
const location = { sourcePath: filePath, startLine: sourceLineNumber, endLine: sourceLineNumber };

function fixture() {
  const source = { id: 'source-evidence', sourceType: 'CODE', artifactId: 'code', provenanceKey: 'source-key',
    filePath, startLine: sourceLineNumber, endLine: sourceLineNumber, excerpt: sourceLine, commitSha: 'pinned-sha' };
  const edgeEvidence = { id: 'test-evidence', sourceType: 'TEST', artifactId: 'test', provenanceKey: 'test-key',
    filePath, startLine: sourceLineNumber, endLine: sourceLineNumber, excerpt: sourceLine, commitSha: 'pinned-sha' };
  const provenance = { kind: 'STATIC_SOURCE_REFERENCE', resolver: 'TS_AST_DIRECT_CALL',
    evidenceProvenanceKey: 'test-key', locations: [location] };
  return {
    root: process.cwd(), snapshotId: 'snapshot', commitSha: 'pinned-sha',
    projections: [{ selectedCode: { id: 'code', filePath }, codeEvidence: { source, staticCalls: [] },
      relatedScenarios: [{ trace: { relationships: [{ edgeId: 'edge', type: 'TESTS',
        sourceArtifactId: 'test', targetArtifactId: 'code', provenance, evidence: edgeEvidence }] } }] }],
    artifacts: [{ id: 'code', snapshotId: 'snapshot', filePath, startLine: sourceLineNumber, endLine: sourceLineNumber },
      { id: 'test', snapshotId: 'snapshot', filePath, startLine: sourceLineNumber, endLine: sourceLineNumber }],
    evidences: [{ ...source, isRedacted: false, snapshotId: 'snapshot', sourcePath: filePath, sourceType: 'CODE' },
      { ...edgeEvidence, isRedacted: false, snapshotId: 'snapshot', sourcePath: filePath, sourceType: 'TEST' }],
    edges: [{ id: 'edge', snapshotId: 'snapshot', fromArtifactId: 'test', toArtifactId: 'code',
      type: 'TESTS', metadata: structuredClone(provenance) }],
  };
}

describe('pinned comprehension provenance verification', () => {
  it('matches displayed source and relationships to persisted records and repository locations', () => {
    expect(verifyPinnedProjectionProvenance(fixture())).toEqual({
      sourceEvidenceCount: 1, relationshipCount: 1, sourceFileCount: 1,
    });
  });

  it('rejects an edge backed by evidence for another artifact', () => {
    const input = fixture();
    input.evidences[1].artifactId = 'code';
    expect(() => verifyPinnedProjectionProvenance(input)).toThrow(/persisted snapshot provenance/);
  });

  it('rejects a relationship whose persisted provenance points elsewhere', () => {
    const input = fixture();
    input.edges[0].metadata.evidenceProvenanceKey = 'another-key';
    expect(() => verifyPinnedProjectionProvenance(input)).toThrow(/provenance/);
  });

  it('rejects relationship provenance paired with different displayed source evidence', () => {
    const input = fixture();
    const relationship = input.projections[0].relatedScenarios[0].trace.relationships[0];
    const persistedEvidence = input.evidences[1];
    relationship.evidence = { ...relationship.evidence!, id: 'alternate-test-evidence',
      provenanceKey: 'alternate-test-key' };
    input.evidences.push({ ...persistedEvidence, id: 'alternate-test-evidence',
      provenanceKey: 'alternate-test-key' });

    expect(() => verifyPinnedProjectionProvenance(input)).toThrow(/evidence provenance key/);
  });

  it('rejects source locations outside the repository', () => {
    const input = fixture();
    input.projections[0].codeEvidence.source.filePath = '../outside.ts';
    expect(() => verifyPinnedProjectionProvenance(input)).toThrow(/repository-relative/);
  });

  it('rejects persisted excerpts that do not match the pinned source text', () => {
    const input = fixture();
    input.projections[0].codeEvidence.source.excerpt = 'unrelated source text';
    input.evidences[0].excerpt = 'unrelated source text';
    expect(() => verifyPinnedProjectionProvenance(input)).toThrow(/excerpt does not match source text/);
  });

  it('validates secret-redacted excerpts against redacted pinned source', () => {
    const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), 'g2a-provenance-'));
    const temporarySourcePath = path.join(temporaryDirectory, 'source.ts');
    try {
      const relativeSourcePath = 'source.ts';
      const source = "const PASSWORD = 'abcdefghijklmnopqrstuvwx';";
      const excerpt = SecretRedactor.redact(source).redactedContent;
      writeFileSync(temporarySourcePath, source);
      const input = fixture();
      input.root = temporaryDirectory;
      input.projections[0].selectedCode.filePath = relativeSourcePath;
      input.projections[0].codeEvidence.source.filePath = relativeSourcePath;
      input.projections[0].codeEvidence.source.startLine = 1;
      input.projections[0].codeEvidence.source.endLine = 1;
      input.projections[0].codeEvidence.source.excerpt = excerpt;
      const relationshipEvidence = input.projections[0].relatedScenarios[0].trace.relationships[0].evidence!;
      relationshipEvidence.filePath = relativeSourcePath;
      relationshipEvidence.startLine = 1;
      relationshipEvidence.endLine = 1;
      relationshipEvidence.excerpt = excerpt;
      input.projections[0].relatedScenarios[0].trace.relationships[0].provenance!.locations[0].sourcePath = relativeSourcePath;
      input.projections[0].relatedScenarios[0].trace.relationships[0].provenance!.locations[0].startLine = 1;
      input.projections[0].relatedScenarios[0].trace.relationships[0].provenance!.locations[0].endLine = 1;
      input.artifacts.forEach(artifact => { artifact.filePath = relativeSourcePath; });
      input.evidences.forEach(evidence => {
        evidence.filePath = relativeSourcePath;
        evidence.sourcePath = relativeSourcePath;
        evidence.excerpt = excerpt;
        evidence.isRedacted = true;
      });
      input.edges[0].metadata.locations[0].sourcePath = relativeSourcePath;
      input.edges[0].metadata.locations[0].startLine = 1;
      input.edges[0].metadata.locations[0].endLine = 1;
      input.artifacts.forEach(artifact => { artifact.startLine = 1; artifact.endLine = 1; });
      input.evidences.forEach(evidence => { evidence.startLine = 1; evidence.endLine = 1; });

      expect(verifyPinnedProjectionProvenance(input)).toEqual({
        sourceEvidenceCount: 1, relationshipCount: 1, sourceFileCount: 1,
      });
    } finally {
      unlinkSync(temporarySourcePath);
      rmdirSync(temporaryDirectory);
    }
  });
});
