import { Injectable } from '@nestjs/common';
import {
  comprehensionEvidenceSchema,
  comprehensionRelationshipSchema,
  comprehensionScenarioSchema,
  codeComprehensionResponseSchema,
  type CodeComprehensionResponse,
  type ComprehensionEvidence,
  type ComprehensionRelationship,
  type TestStaticBehaviorClaim,
} from '@ba-helper/contracts';
import { AppError } from '@ba-helper/shared';
import type { DependencyEdgeType } from '@prisma/client';
import { PrismaService, ArtifactRepository, EvidenceRepository, GraphRepository } from '@ba-helper/backend-runtime';
import { validateQaTraceEdge } from '../../impact-analysis/domain/qa-trace.policy';
import { validateStaticEntityUse } from './validate-static-entity-use';
import {
  dedupeDiagnostics, findCallPath, limitation, mapArtifact, mapEdgeEvidence, readSnapshotLimitations,
  mapCodeEvidence, readCodeEvidence, readTestCase, safeProvenance, type ArtifactRecord, type Diagnostic, type EdgeRecord, type EvidenceRecord,
} from './get-code-comprehension.mapper';

const MAX_CALL_DEPTH = 4;
const MAX_SCENARIOS = 50;
const MAX_SCENARIO_OFFSET = 500;
const MAX_SCENARIO_SOURCE_SCAN = 5000;
const SCENARIO_SOURCE_BATCH = 50;
const MAX_RELATIONSHIPS = 80;
const MAX_STATIC_CALLS = 50;
const MAX_DEPENDENCIES = 50;
const MAX_DIRECT_EDGES = MAX_STATIC_CALLS + MAX_DEPENDENCIES + 1;
const PROJECTION_VERSION = 'code-comprehension@2';
const MAX_PROJECTION_CACHE_ENTRIES = 64;
const PRODUCTION_ARTIFACT_TYPES = new Set(['CONTROLLER', 'API_ROUTE', 'SERVICE', 'SERVICE_METHOD', 'ENTITY']);
const CALL_EDGE_TYPES: DependencyEdgeType[] = ['CALLS'];
const CODE_EDGE_TYPES: DependencyEdgeType[] = ['CALLS', 'REFERENCES'];
type SnapshotProjectionRecord = {
  id: string;
  repositoryId: string;
  commitSha: string;
  analyzerVersion: string;
  coverageStatus: CodeComprehensionResponse['snapshotContext']['coverageStatus'];
  diagnostics: unknown;
};
type ScenarioEdgeCollection = { edges: EdgeRecord[]; hasValidatedReference: boolean; scanIncomplete: boolean };
type ProjectionData = {
  limitations: Diagnostic[];
  directEdgeOverflow: boolean;
  validatedDirectEdges: EdgeRecord[];
  additionalDependenciesExist: boolean;
  scenarioEdges: EdgeRecord[];
  source: ComprehensionEvidence;
  structuredCodeEvidence: ReturnType<typeof mapCodeEvidence> | undefined;
  staticCalls: CodeComprehensionResponse['codeEvidence']['staticCalls'];
  dependencies: CodeComprehensionResponse['codeEvidence']['dependencies'];
  scenarios: CodeComprehensionResponse['relatedScenarios'];
};

@Injectable()
export class GetCodeComprehensionUseCase {
  private readonly projectionCache = new Map<string, CodeComprehensionResponse>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly artifacts: ArtifactRepository,
    private readonly graph: GraphRepository,
    private readonly evidence: EvidenceRepository,
  ) {}

  async execute(snapshotId: string, artifactId: string, options?: { scenarioLimit?: number; scenarioOffset?: number }): Promise<CodeComprehensionResponse> {
    const snapshot = await this.prisma.repositorySnapshot.findUnique({
      where: { id: snapshotId },
      select: { id: true, repositoryId: true, commitSha: true, analyzerVersion: true,
        coverageStatus: true, diagnostics: true },
    });
    if (!snapshot) throw new AppError('SNAPSHOT_NOT_FOUND', 'Snapshot not found.');

    const selected = await this.artifacts.findBySnapshotAndId(snapshotId, artifactId);
    if (!selected) throw new AppError('ARTIFACT_NOT_FOUND', 'Artifact not found in the selected snapshot.');
    if (!PRODUCTION_ARTIFACT_TYPES.has(selected.artifactType)) {
      throw new AppError('ARTIFACT_NOT_PRODUCTION_CODE', 'Code comprehension requires a production artifact.');
    }
    const scenarioLimit = normalizeScenarioLimit(options?.scenarioLimit);
    const scenarioOffset = normalizeScenarioOffset(options?.scenarioOffset);
    const cacheKey = `${PROJECTION_VERSION}:${snapshotId}:${artifactId}:${scenarioLimit}:${scenarioOffset}`;
    const cached = this.projectionCache.get(cacheKey);
    if (cached) return cached;

    const projection = await this.collectProjection(snapshot, selected, scenarioLimit, scenarioOffset);
    const response = this.createResponse(snapshot, selected, scenarioLimit, scenarioOffset, projection);
    this.projectionCache.set(cacheKey, response);
    while (this.projectionCache.size > MAX_PROJECTION_CACHE_ENTRIES) {
      const oldest = this.projectionCache.keys().next().value;
      if (oldest === undefined) break;
      this.projectionCache.delete(oldest);
    }
    return response;
  }

  private async collectProjection(snapshot: SnapshotProjectionRecord, selected: ArtifactRecord,
    scenarioLimit: number, scenarioOffset: number): Promise<ProjectionData> {
    const snapshotId = snapshot.id;
    const limitations = readSnapshotLimitations(snapshot.diagnostics);
    if (snapshot.coverageStatus === 'PARTIAL') limitations.push(limitation(
      'SNAPSHOT_PARTIAL', 'The selected snapshot is partial; relationships outside the accepted scan scope may be missing.', 'WARN'));
    limitations.push(limitation(
      'RUNTIME_OBSERVATIONS_NOT_IMPORTED', 'This projection contains static declarations only; no test execution or runtime observation was imported.', 'INFO'));

    const fetchedDirectEdges = await this.graph.listOutgoingBySnapshotAndSources(
      snapshotId, [selected.id], CODE_EDGE_TYPES, MAX_DIRECT_EDGES + 1);
    const directEdgeOverflow = fetchedDirectEdges.length > MAX_DIRECT_EDGES;
    const directEdges = fetchedDirectEdges.slice(0, MAX_DIRECT_EDGES);
    const incomingCallEdges = await this.collectIncomingCallEdges(snapshotId, selected.id, limitations);
    const codeIds = new Set([selected.id]);
    for (const edge of incomingCallEdges) codeIds.add(edge.fromArtifactId);

    const allRelatedIds = new Set<string>([selected.id]);
    for (const edge of directEdges) allRelatedIds.add(edge.toArtifactId);
    for (const edge of incomingCallEdges) allRelatedIds.add(edge.fromArtifactId);
    const relatedArtifacts = await this.artifacts.listBySnapshotAndIds(snapshotId, [...allRelatedIds]);
    const artifactById = new Map(relatedArtifacts.map(artifact => [artifact.id, artifact]));
    artifactById.set(selected.id, selected);
    const evidenceRecords = await this.evidence.listByArtifactIds({ snapshotId, artifactIds: [...allRelatedIds] });
    const evidenceByProvenance = new Map(evidenceRecords.map(record => [record.provenanceKey, record]));
    const validatedDirectEdges = this.validateEdges(directEdges, snapshotId, artifactById, evidenceByProvenance, limitations);
    const validatedIncomingCallEdges = this.validateEdges(incomingCallEdges, snapshotId, artifactById, evidenceByProvenance, limitations);
    const reachableCodeIds = [selected.id, ...validatedIncomingCallEdges.map(edge => edge.fromArtifactId)];
    const scenarioCollection = await this.collectScenarioEdges(snapshotId, reachableCodeIds, validatedIncomingCallEdges,
      selected.id, scenarioOffset + scenarioLimit + 1, artifactById, evidenceByProvenance, limitations);
    const scenarioEdges = scenarioCollection.edges;
    const pageEdges = scenarioEdges.slice(scenarioOffset, scenarioOffset + scenarioLimit);
    const parentFileKeys = pageEdges.flatMap(edge => {
      const artifact = artifactById.get(edge.fromArtifactId);
      const testCase = artifact ? readTestCase(artifact) : undefined;
      return testCase?.parentFileArtifactKey ? [testCase.parentFileArtifactKey] : [];
    });
    const parentFileArtifacts = await this.artifacts.listBySnapshotAndArtifactKeys(snapshotId, parentFileKeys);
    if (parentFileArtifacts.length > 0) {
      const parentEvidence = await this.evidence.listByArtifactIds({ snapshotId,
        artifactIds: parentFileArtifacts.map(artifact => artifact.id) });
      for (const artifact of parentFileArtifacts) artifactById.set(artifact.id, artifact);
      for (const record of parentEvidence) evidenceByProvenance.set(record.provenanceKey, record);
    }
    const source = this.sourceEvidence(selected, evidenceRecords, snapshot.commitSha, limitations);
    const codeMetadata = readCodeEvidence(selected);
    const structuredCodeEvidence = codeMetadata
      ? mapCodeEvidence(codeMetadata, selected, source, snapshot.commitSha, limitations)
      : undefined;
    if (!structuredCodeEvidence) limitations.push(limitation(
      'CODE_EVIDENCE_UNAVAILABLE', 'The selected artifact predates structured signature, condition, and exception evidence.', 'WARN'));

    const staticCalls = validatedDirectEdges.filter(edge => edge.type === 'CALLS')
      .slice(0, MAX_STATIC_CALLS)
      .map(edge => this.mapRelationship(edge, evidenceByProvenance, snapshot.commitSha, limitations));
    const dependencyById = new Map<string, ArtifactRecord>();
    for (const edge of validatedDirectEdges) {
      const artifact = artifactById.get(edge.toArtifactId);
      if (artifact) dependencyById.set(artifact.id, artifact);
    }
    const dependencyArtifacts = [...dependencyById.values()];
    const additionalDependenciesExist = dependencyArtifacts.length > MAX_DEPENDENCIES;
    const dependencies = dependencyArtifacts.slice(0, MAX_DEPENDENCIES).map(mapArtifact);
    const scenarios = this.mapScenarios(pageEdges, validatedIncomingCallEdges, selected.id, artifactById,
      evidenceByProvenance, snapshot.commitSha, limitations, scenarioLimit);
    if (!scenarioCollection.hasValidatedReference && !scenarioCollection.scanIncomplete) limitations.push(limitation(
      'NO_SUPPORTED_TEST_REFERENCE',
      'No supported static test relationship was found in this snapshot; this does not establish that no tests exist.',
      'INFO'));
    return { limitations, directEdgeOverflow, validatedDirectEdges, additionalDependenciesExist,
      scenarioEdges, source, structuredCodeEvidence, staticCalls, dependencies, scenarios };
  }

  private createResponse(snapshot: SnapshotProjectionRecord, selected: ArtifactRecord,
    scenarioLimit: number, scenarioOffset: number, projection: ProjectionData): CodeComprehensionResponse {
    const { limitations, directEdgeOverflow, validatedDirectEdges, additionalDependenciesExist,
      scenarioEdges, source, structuredCodeEvidence, staticCalls, dependencies, scenarios } = projection;
    const nextOffset = scenarioOffset + scenarioLimit;
    const additionalScenarioExists = scenarioEdges.length > nextOffset;
    const hasMoreScenarios = additionalScenarioExists && nextOffset <= MAX_SCENARIO_OFFSET;
    if (additionalScenarioExists && !hasMoreScenarios) limitations.push(limitation(
      'SCENARIO_OFFSET_LIMIT', 'Additional validated scenarios exist beyond the last retrievable page.', 'WARN'));
    const scenarioDataUnreachable = additionalScenarioExists && !hasMoreScenarios;
    const truncated = directEdgeOverflow || additionalDependenciesExist ||
      validatedDirectEdges.filter(edge => edge.type === 'CALLS').length > MAX_STATIC_CALLS ||
      scenarioDataUnreachable || limitations.some(item => item.code === 'CALL_DEPTH_LIMIT') ||
      limitations.some(item => item.code === 'SCENARIO_SOURCE_SCAN_LIMIT');
    if (truncated) limitations.push(limitation(
      'COMPREHENSION_LIMIT', 'The projection was bounded and one or more related paths may be omitted.', 'WARN'));

    const response = codeComprehensionResponseSchema.parse({
      selectedCode: mapArtifact(selected),
      codeEvidence: { source, parameters: structuredCodeEvidence?.parameters ?? [],
        returnType: structuredCodeEvidence?.returnType ?? null, conditions: structuredCodeEvidence?.conditions ?? [],
        exceptionHandlers: structuredCodeEvidence?.exceptionHandlers ?? [], dependencies, staticCalls },
      relatedScenarios: scenarios.slice(0, MAX_SCENARIOS),
      scenarioPagination: { limit: scenarioLimit, offset: scenarioOffset, hasMore: hasMoreScenarios },
      limitations: dedupeDiagnostics(limitations),
      snapshotContext: { repositoryId: snapshot.repositoryId, snapshotId: snapshot.id,
        commitSha: snapshot.commitSha, analyzerVersion: snapshot.analyzerVersion,
        coverageStatus: snapshot.coverageStatus, basis: 'STATIC_SOURCE_REFERENCE', runtimeObservations: 'NOT_IMPORTED' },
      limits: { maxCallDepth: MAX_CALL_DEPTH, maxScenarios: MAX_SCENARIOS, maxRelationships: MAX_RELATIONSHIPS },
      truncated,
    });
    return response;
  }

  private async collectScenarioEdges(snapshotId: string, codeIds: string[], callEdges: EdgeRecord[], selectedId: string,
    requested: number, artifacts: Map<string, ArtifactRecord>, evidences: Map<string, EvidenceRecord>,
    limitations: Diagnostic[]): Promise<{ edges: EdgeRecord[]; hasValidatedReference: boolean; scanIncomplete: boolean }> {
    const scenarios: EdgeRecord[] = [];
    let cursor: string | undefined;
    let scanned = 0;
    let hasValidatedReference = false;
    let scanIncomplete = false;
    while (scenarios.length < requested && scanned < MAX_SCENARIO_SOURCE_SCAN) {
      const batchSize = Math.min(SCENARIO_SOURCE_BATCH, MAX_SCENARIO_SOURCE_SCAN - scanned);
      const sourceIds = await this.graph.listIncomingTestSourceIds(snapshotId, codeIds, cursor, batchSize);
      if (sourceIds.length === 0) break;
      cursor = sourceIds[sourceIds.length - 1];
      scanned += sourceIds.length;
      const [edges, testArtifacts] = await Promise.all([
        this.graph.listTestEdgesBySourcesAndTargets(snapshotId, sourceIds, codeIds),
        this.artifacts.listBySnapshotAndIds(snapshotId, sourceIds),
      ]);
      const testEvidences = await this.evidence.listByArtifactIds({ snapshotId,
        artifactIds: testArtifacts.map(artifact => artifact.id) });
      const batchArtifacts = new Map([...artifacts, ...testArtifacts.map(artifact => [artifact.id, artifact] as const)]);
      const batchEvidences = new Map([...evidences, ...testEvidences.map(record => [record.provenanceKey, record] as const)]);
      const validated = this.validateEdges(edges, snapshotId, batchArtifacts, batchEvidences, limitations);
      hasValidatedReference ||= validated.length > 0;
      const selected = this.selectScenarioEdges(validated, callEdges, selectedId);
      scenarios.push(...selected);
      for (const edge of selected) {
        const artifact = batchArtifacts.get(edge.fromArtifactId);
        if (artifact) artifacts.set(artifact.id, artifact);
        for (const record of testEvidences) {
          if (record.artifactId === edge.fromArtifactId) evidences.set(record.provenanceKey, record);
        }
      }
      if (sourceIds.length < batchSize) break;
    }
    if (scanned === MAX_SCENARIO_SOURCE_SCAN && scenarios.length < requested) {
      const nextCandidate = await this.graph.listIncomingTestSourceIds(snapshotId, codeIds, cursor, 1);
      if (nextCandidate.length > 0) {
        scanIncomplete = true;
        limitations.push(limitation(
          'SCENARIO_SOURCE_SCAN_LIMIT', 'The bounded test-case search ended before all candidates could be validated.', 'WARN'));
      }
    }
    if (hasValidatedReference && scenarios.length === 0) limitations.push(limitation(
      'RELATED_TEST_PATH_UNRESOLVED', 'Test relationships exist, but no bounded static path to the selected artifact was established.', 'WARN'));
    return { edges: scenarios, hasValidatedReference, scanIncomplete };
  }

  private async collectIncomingCallEdges(snapshotId: string, selectedId: string, limitations: Diagnostic[]): Promise<EdgeRecord[]> {
    const edges: EdgeRecord[] = [];
    const visited = new Set([selectedId]);
    let frontier = [selectedId];
    for (let depth = 0; depth < MAX_CALL_DEPTH && frontier.length > 0; depth++) {
      const incoming = await this.graph.listIncomingBySnapshotAndTargets(
        snapshotId, frontier, CALL_EDGE_TYPES, MAX_RELATIONSHIPS - edges.length + 1);
      const next = new Set<string>();
      for (const edge of incoming) {
        if (edges.length >= MAX_RELATIONSHIPS) {
          limitations.push(limitation('CALL_DEPTH_LIMIT', 'The reverse static call search reached its relationship bound.', 'WARN'));
          return edges;
        }
        edges.push(edge);
        if (!visited.has(edge.fromArtifactId)) { visited.add(edge.fromArtifactId); next.add(edge.fromArtifactId); }
      }
      frontier = [...next].sort();
    }
    if (frontier.length > 0) limitations.push(limitation(
      'CALL_DEPTH_LIMIT', 'Callers beyond the bounded reverse search depth were not inspected.', 'WARN'));
    return edges;
  }

  private validateEdges(edges: EdgeRecord[], snapshotId: string, artifacts: Map<string, ArtifactRecord>,
    evidences: Map<string, EvidenceRecord>, limitations: Diagnostic[]): EdgeRecord[] {
    const qaArtifacts = new Map([...artifacts].map(([id, artifact]) => [id, {
      ...artifact, universalKind: artifact.universalKind ?? 'UNKNOWN', metadata: artifact.metadata ?? null,
    }]));
    const qaEvidences = new Map([...evidences].map(([key, evidence]) => [key, {
      ...evidence, sourcePath: evidence.sourcePath ?? null, startLine: evidence.startLine ?? null,
      endLine: evidence.endLine ?? null,
    }]));
    let omitted = 0;
    const examples: string[] = [];
    const validated = edges.filter(edge => {
      const valid = edge.type === 'REFERENCES'
        ? validateStaticEntityUse(edge, snapshotId, artifacts, evidences)
        : validateQaTraceEdge(edge, snapshotId, qaArtifacts, qaEvidences);
      if (!valid) {
        omitted += 1;
        if (examples.length < 3) examples.push(edge.id);
      }
      return Boolean(valid);
    });
    if (omitted > 0) {
      const existing = limitations.find(item => item.code === 'EDGE_PROVENANCE_UNRESOLVED');
      const count = (existing?.count ?? 0) + omitted;
      const sampleEdgeIds = [...(existing?.payload?.sampleEdgeIds ?? []), ...examples].slice(0, 3);
      const message = `${count} graph edge(s) were omitted because snapshot, artifact, source, or provenance evidence was not validated. Example IDs: ${sampleEdgeIds.join(', ')}.`;
      if (existing) Object.assign(existing, { count, message, payload: { sampleEdgeIds } });
      else limitations.push({ code: 'EDGE_PROVENANCE_UNRESOLVED', severity: 'WARN', message,
        count, payload: { sampleEdgeIds } });
    }
    return validated;
  }

  private selectScenarioEdges(testEdges: EdgeRecord[], callEdges: EdgeRecord[], selectedId: string): EdgeRecord[] {
    const outgoing = new Map<string, EdgeRecord[]>();
    for (const edge of callEdges) outgoing.set(edge.fromArtifactId, [...(outgoing.get(edge.fromArtifactId) ?? []), edge]);
    for (const edges of outgoing.values()) edges.sort((a, b) => a.toArtifactId.localeCompare(b.toArtifactId) || a.id.localeCompare(b.id));
    const grouped = new Map<string, Array<{ edge: EdgeRecord; path: EdgeRecord[] }>>();
    for (const edge of testEdges.slice().sort((a, b) => a.fromArtifactId.localeCompare(b.fromArtifactId) ||
      a.toArtifactId.localeCompare(b.toArtifactId) || a.id.localeCompare(b.id))) {
      const path = findCallPath(edge.toArtifactId, selectedId, outgoing, MAX_CALL_DEPTH);
      if (edge.toArtifactId !== selectedId && !path) continue;
      grouped.set(edge.fromArtifactId, [...(grouped.get(edge.fromArtifactId) ?? []), { edge, path: path ?? [] }]);
    }
    return [...grouped.values()].map(candidates => candidates.sort((a, b) => a.path.length - b.path.length ||
      a.edge.toArtifactId.localeCompare(b.edge.toArtifactId) || a.edge.id.localeCompare(b.edge.id))[0].edge)
      .sort((a, b) => a.fromArtifactId.localeCompare(b.fromArtifactId) || a.id.localeCompare(b.id));
  }

  private sourceEvidence(artifact: ArtifactRecord, records: EvidenceRecord[], commitSha: string,
    limitations: Diagnostic[]): ComprehensionEvidence {
    const record = records.find(item => item.artifactId === artifact.id && item.sourceType === 'CODE');
    if (!record) limitations.push(limitation(
      'SOURCE_EVIDENCE_MISSING', 'The selected artifact has no persisted source evidence in this snapshot.', 'WARN'));
    return comprehensionEvidenceSchema.parse({
      id: record?.id ?? null, evidenceKind: 'PRODUCTION_SOURCE', sourceType: 'CODE',
      artifactId: artifact.id, provenanceKey: record?.provenanceKey ?? null,
      filePath: record?.sourcePath ?? artifact.filePath, startLine: record?.startLine ?? artifact.startLine,
      endLine: record?.endLine ?? artifact.endLine, excerpt: record?.excerpt ?? '', commitSha,
    });
  }

  private mapRelationship(edge: EdgeRecord, evidenceByProvenance: Map<string, EvidenceRecord>, commitSha: string,
    limitations: Diagnostic[]): ComprehensionRelationship {
    const parsed = edge.metadata && typeof edge.metadata === 'object' && !Array.isArray(edge.metadata)
      ? safeProvenance(edge.metadata) : undefined;
    const evidenceRecord = parsed ? evidenceByProvenance.get(parsed.evidenceProvenanceKey) : undefined;
    if (parsed && !evidenceRecord) limitations.push(limitation(
      'EDGE_EVIDENCE_MISSING', 'A persisted graph edge has no matching source evidence record.', 'WARN'));
    const evidence = evidenceRecord ? mapEdgeEvidence(evidenceRecord, edge.type === 'TESTS'
      ? 'STATIC_TEST_DECLARATION' : 'STATIC_EDGE', commitSha, limitations) : undefined;
    return comprehensionRelationshipSchema.parse({
      edgeId: edge.id, type: edge.type, sourceArtifactId: edge.fromArtifactId, targetArtifactId: edge.toArtifactId,
      ...(edge.confidence === null ? {} : { confidence: edge.confidence ?? undefined }),
      ...(parsed ? { provenance: parsed } : {}),
      ...(evidence ? { evidence } : {}),
    });
  }

  private mapScenarios(testEdges: EdgeRecord[], callEdges: EdgeRecord[], selectedId: string,
    artifactById: Map<string, ArtifactRecord>, evidenceByProvenance: Map<string, EvidenceRecord>, commitSha: string,
    limitations: Diagnostic[], maxScenarios = MAX_SCENARIOS): Array<ReturnType<typeof comprehensionScenarioSchema.parse>> {
    const outgoing = new Map<string, EdgeRecord[]>();
    for (const edge of callEdges) outgoing.set(edge.fromArtifactId, [...(outgoing.get(edge.fromArtifactId) ?? []), edge]);
    for (const edges of outgoing.values()) edges.sort((a, b) => a.toArtifactId.localeCompare(b.toArtifactId) || a.id.localeCompare(b.id));
    const scenarios = [];
    for (const testEdge of testEdges.slice().sort((a, b) => a.fromArtifactId.localeCompare(b.fromArtifactId) || a.id.localeCompare(b.id))) {
      if (scenarios.length >= maxScenarios) break;
      const path = findCallPath(testEdge.toArtifactId, selectedId, outgoing, MAX_CALL_DEPTH);
      if (testEdge.toArtifactId !== selectedId && !path) continue;
      const pathEdges = [testEdge, ...(path ?? [])];
      const relationships = pathEdges.map(edge => this.mapRelationship(
        edge, evidenceByProvenance, commitSha, limitations));
      const test = artifactById.get(testEdge.fromArtifactId);
      if (!test) continue;
      const testCase = readTestCase(test);
      const allClaims = testCase?.behaviorEvidence ?? [];
      const claims = allClaims.filter(claim => claim.commitSha === commitSha && evidenceByProvenance.has(claim.evidenceProvenanceKey));
      const unresolved = testCase ? [] : [limitation(
        'TEST_METADATA_UNAVAILABLE', 'The related test artifact has no validated Jest metadata.', 'WARN')];
      if (testCase && allClaims.some(claim => claim.commitSha !== commitSha)) unresolved.push(limitation(
        'TEST_CLAIM_COMMIT_MISMATCH', 'Some static test claims belong to a different commit and were omitted.', 'WARN'));
      if (testCase && allClaims.some(claim => !evidenceByProvenance.has(claim.evidenceProvenanceKey))) unresolved.push(limitation(
        'TEST_CLAIM_EVIDENCE_MISSING', 'Some static test claims have no matching same-snapshot source evidence.', 'WARN'));
      const responseTestCase = testCase ? { ...testCase,
        ...(testCase.behaviorEvidence ? { behaviorEvidence: claims } : {}) } : undefined;
      const behaviorAssociations = this.mapBehaviorAssociations(claims);
      for (const association of behaviorAssociations) unresolved.push(...association.unresolved);
      const traceArtifactIds = new Set<string>([test.id]);
      for (const edge of pathEdges) {
        traceArtifactIds.add(edge.fromArtifactId);
        traceArtifactIds.add(edge.toArtifactId);
      }
      const traceArtifacts = [...traceArtifactIds].map(id => artifactById.get(id)).filter(
        (artifact): artifact is ArtifactRecord => artifact !== undefined,
      ).slice(0, 6).map(mapArtifact);
      scenarios.push(comprehensionScenarioSchema.parse({ testArtifact: mapArtifact(test), testCase: responseTestCase,
        setup: claims.filter(claim => claim.kind === 'SETUP_HOOK' || claim.kind === 'TEARDOWN_HOOK'),
        inputs: claims.filter(claim => claim.kind === 'INPUT'), invocations: claims.filter(claim => claim.kind === 'ACTION'),
        assertions: claims.filter(claim => claim.kind === 'ASSERTION'), mockedBoundaries: claims.filter(claim => claim.kind === 'MOCK'),
        expectedOutcomes: claims.filter(claim => claim.kind === 'EXPECTED_OUTCOME'),
        behaviorAssociations,
        trace: { relation: relationships.length === 1 ? 'DIRECT_REFERENCE' : 'CALL_PATH', artifacts: traceArtifacts,
          relationships }, unresolved }));
    }
    return scenarios;
  }

  private mapBehaviorAssociations(claims: TestStaticBehaviorClaim[]) {
    const actions = claims.filter(claim => claim.kind === 'ACTION');
    const assertions = claims.filter(claim => claim.kind === 'ASSERTION');
    const outcomes = claims.filter(claim => claim.kind === 'EXPECTED_OUTCOME');
    return assertions.slice().sort((left, right) => compareClaimLocations(left.sourceLocation, right.sourceLocation))
      .map(assertion => {
        const unresolved: Diagnostic[] = [];
        const related = assertion.relatedInvocationSourceLocation;
        const invocation = related
          ? actions.find(action => sameLocation(action.sourceLocation, related))
          : undefined;
        if (!related) unresolved.push(limitation('ASSERTION_INVOCATION_UNRESOLVED',
          'The assertion subject is not linked to one unique invocation by AST evidence.', 'WARN'));
        else if (!invocation) unresolved.push(limitation('ASSERTION_INVOCATION_UNRESOLVED',
          'The assertion subject location has no matching persisted action claim in this snapshot.', 'WARN'));
        const expectedOutcomes = outcomes.filter(outcome => {
          if (outcome.relatedAssertionSourceLocation) return sameLocation(outcome.relatedAssertionSourceLocation, assertion.sourceLocation);
          return containsLocation(assertion.sourceLocation, outcome.sourceLocation);
        });
        return {
          associationId: `assertion:${assertion.sourceLocation.relativePath}:${assertion.sourceLocation.startOffset}`,
          ...(invocation ? { invocation } : {}), assertion, expectedOutcomes, mockedBoundaries: [],
          basis: invocation ? 'AST_SUBJECT_REFERENCE' as const : 'UNRESOLVED' as const, unresolved,
        };
      });
  }
}

function normalizeScenarioLimit(value: number | undefined): number {
  if (!Number.isFinite(value)) return MAX_SCENARIOS;
  return Math.min(MAX_SCENARIOS, Math.max(1, Math.trunc(value!)));
}

function normalizeScenarioOffset(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_SCENARIO_OFFSET, Math.max(0, Math.trunc(value!)));
}

function sameLocation(left: { relativePath: string; startOffset: number; endOffset: number },
  right: { relativePath: string; startOffset: number; endOffset: number }): boolean {
  return left.relativePath === right.relativePath && left.startOffset === right.startOffset && left.endOffset === right.endOffset;
}

function containsLocation(container: { relativePath: string; startOffset: number; endOffset: number },
  nested: { relativePath: string; startOffset: number; endOffset: number }): boolean {
  return container.relativePath === nested.relativePath && container.startOffset <= nested.startOffset && container.endOffset >= nested.endOffset;
}

function compareClaimLocations(left: { relativePath: string; startOffset: number; endOffset: number },
  right: { relativePath: string; startOffset: number; endOffset: number }): number {
  return left.relativePath.localeCompare(right.relativePath) || left.startOffset - right.startOffset || left.endOffset - right.endOffset;
}
