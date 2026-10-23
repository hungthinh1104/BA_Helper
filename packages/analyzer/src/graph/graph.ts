import { relative, resolve } from 'node:path';
import { Node, SyntaxKind } from 'ts-morph';
import type { CallExpression, ClassDeclaration, MethodDeclaration, SourceFile } from 'ts-morph';
import type { ScanArtifact, ScanResult } from '../scanner/scanner.types';
import type { GraphDiagnostic, GraphEdge, GraphProvenance, GraphResult } from './graph.types';
import { isBuiltInDataPreparationCall, looksLikeMockConfiguration } from '../scanner/jest/jest-test-semantics';
import { GraphSourceResolver } from './graph-source-resolver';
import { TestCallIndex } from './test-call-index';

export const buildGraph = (scan: ScanResult): GraphResult => {
  if (!scan.sourceRoot) return { edges: [] };
  return new SourceGraphBuilder(scan).build();
};

export function createGraphEdgeId(from: string, type: string, to: string): string {
  return `edge:${encodeURIComponent(from)}:${encodeURIComponent(type)}:${encodeURIComponent(to)}`;
}

class SourceGraphBuilder {
  private readonly resolver: GraphSourceResolver;
  private readonly edges = new Map<string, GraphEdge>();
  private readonly sourceLocations = new Map<string, Set<string>>();
  private readonly diagnostics = new Map<string, GraphDiagnostic>();

  constructor(private readonly scan: ScanResult) { this.resolver = new GraphSourceResolver(scan); }

  build(): GraphResult {
    for (const artifact of this.resolver.ambiguousArtifacts) {
      const file = this.resolver.project.getSourceFile(resolve(this.scan.sourceRoot!, artifact.filePath));
      if (file) this.diagnose('AMBIGUOUS_ARTIFACT_IDENTITY', file, artifact, { reason: 'AMBIGUOUS_SYMBOL' });
    }
    for (const artifact of this.resolver.ambiguousSymbols) {
      const file = this.resolver.project.getSourceFile(resolve(this.scan.sourceRoot!, artifact.filePath));
      if (file) this.diagnose('AMBIGUOUS_SYMBOL_RESOLUTION', file, artifact, { reason: 'AMBIGUOUS_SYMBOL' });
    }
    for (const file of this.resolver.project.getSourceFiles()) {
      const test = this.resolver.testArtifact(file);
      if (test) this.testEdges(file, test);
      else if (!/\.(?:spec|test)\.ts$/.test(file.getFilePath())) {
        for (const cls of file.getClasses()) this.classEdges(cls);
      }
    }
    return { edges: [...this.edges.values()], diagnostics: [...this.diagnostics.values()] };
  }

  private testEdges(file: SourceFile, test: ScanArtifact): void {
    const cases = this.resolver.testCases(file);
    const calls = new TestCallIndex(file.getDescendantsOfKind(SyntaxKind.CallExpression));
    for (const item of cases) {
      const span = item.testBodySpan;
      if (!span || item.testCase?.modifier === 'SKIP' || item.testCase?.modifier === 'TODO') continue;
      let candidateCount = 0;
      for (const call of calls.within(span)) {
        const access = call.getExpression();
        if (!Node.isPropertyAccessExpression(access) || isTestInfrastructureCall(call)) continue;
        const receiver = access.getExpression();
        if (!this.resolver.isPotentialTestReceiver(receiver)) continue;
        candidateCount++;
        if (isNestedCallback(call, span) && !isThrowAssertionCallback(call, span)) {
          this.diagnose('TEST_TARGET_UNRESOLVED', file, item, {
            reason: 'UNSUPPORTED_NESTED_CALLBACK', node: call, targetExpression: call.getText(),
          });
          continue;
        }
        const cls = this.resolver.receiverClass(receiver);
        if (!cls) {
          const resolution = this.resolver.receiverFailure(receiver);
          this.diagnose('TEST_TARGET_UNRESOLVED', file, item, {
            reason: resolution.failure ?? 'UNRESOLVED_RECEIVER', node: call,
            targetExpression: resolution.targetExpression ?? call.getText(),
          });
          continue;
        }
        const result = this.resolver.artifactResolution(cls, access.getName());
        if (!result.artifact) {
          this.diagnose('TEST_TARGET_UNRESOLVED', file, item, {
            reason: result.failure ?? 'METHOD_ARTIFACT_NOT_EXTRACTED', node: call, targetExpression: call.getText(),
          });
          continue;
        }
        this.addEdge(item, result.artifact, 'TESTS', call, 'TS_AST_DIRECT_CALL');
      }
      if (!candidateCount) this.diagnose('TEST_TARGET_UNRESOLVED', file, item, { reason: 'NO_SUPPORTED_DIRECT_REFERENCE' });
    }
    if (!cases.length && file.getImportDeclarations().some(i => i.getModuleSpecifierValue().startsWith('.'))) {
      this.diagnose('TEST_TARGET_UNRESOLVED', file, test, { reason: 'NO_SUPPORTED_DIRECT_REFERENCE' });
    }
  }

  private classEdges(cls: ClassDeclaration): void {
    for (const method of cls.getMethods()) {
      const source = this.resolver.artifactFor(cls, method.getName());
      if (!source) continue;
      this.methodCalls(cls, method, source);
      for (const identifier of method.getDescendantsOfKind(SyntaxKind.Identifier)) {
        const entityClass = this.resolver.resolveClass(identifier);
        const entity = entityClass && this.resolver.artifactFor(entityClass);
        if (entity?.type === 'ENTITY') this.addEdge(source, entity, 'USES', identifier, 'TS_AST_ENTITY_REFERENCE');
      }
    }
  }

  private methodCalls(cls: ClassDeclaration, method: MethodDeclaration, source: ScanArtifact): void {
    for (const call of method.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const access = call.getExpression();
      if (!Node.isPropertyAccessExpression(access)) continue;
      if (call.getFirstAncestorByKind(SyntaxKind.ClassDeclaration) !== cls || hasChangingFunctionScope(call, method)) {
        this.diagnose('UNRESOLVED_RECEIVER_SCOPE', call.getSourceFile(), source, {
          reason: 'UNSUPPORTED_NESTED_CALLBACK', node: call, targetExpression: call.getText(),
        });
        continue;
      }
      const receiver = access.getExpression();
      const targetClass = this.resolver.receiverClass(receiver, cls);
      const target = targetClass && this.resolver.artifactResolution(targetClass, access.getName());
      if (target?.artifact) this.addEdge(source, target.artifact, 'CALLS', call, 'TS_AST_DIRECT_CALL');
      else if (targetClass) this.diagnose('UNRESOLVED_METHOD_TARGET', call.getSourceFile(), source, {
        reason: target?.failure ?? 'METHOD_ARTIFACT_NOT_EXTRACTED', node: call, targetExpression: call.getText(),
      });
      else {
        const entityClass = this.resolver.repositoryEntity(receiver, cls);
        const entity = entityClass && this.resolver.artifactFor(entityClass);
        if (entity?.type === 'ENTITY') this.addEdge(source, entity, 'USES', call, 'TS_AST_ENTITY_REFERENCE');
        else if (Node.isPropertyAccessExpression(receiver) && receiver.getExpression().getText() === 'this') {
          const resolution = this.resolver.receiverFailure(receiver, cls);
          this.diagnose('UNRESOLVED_INJECTION_TOKEN', call.getSourceFile(), source, {
            reason: resolution.failure ?? 'UNRESOLVED_RECEIVER', node: call,
            targetExpression: resolution.targetExpression ?? call.getText(),
          });
        }
      }
    }
  }

  private addEdge(from: ScanArtifact, to: ScanArtifact, type: string, node: Node,
    resolver: GraphProvenance['resolver']): void {
    const key = JSON.stringify([from.stableId, type, to.stableId]);
    const location = {
      sourcePath: relative(this.scan.sourceRoot!, node.getSourceFile().getFilePath()).replace(/\\/g, '/'),
      startLine: node.getStartLineNumber(),
      endLine: node.getEndLineNumber(),
    };
    const existing = this.edges.get(key);
    const locationKey = `${location.sourcePath}:${location.startLine}:${location.endLine}`;
    const seen = this.sourceLocations.get(key) ?? new Set<string>();
    if (seen.has(locationKey)) return;
    seen.add(locationKey);
    this.sourceLocations.set(key, seen);
    if (existing?.provenance) {
      if (existing.provenance.locations.length < 20) existing.provenance.locations.push(location);
      else existing.provenance.omittedLocationCount = (existing.provenance.omittedLocationCount ?? 0) + 1;
      return;
    }
    this.edges.set(key, { stableId: createGraphEdgeId(from.stableId, type, to.stableId), from: from.stableId,
      to: to.stableId, type, confidence: 1, provenance: { resolver, locations: [location] } });
  }

  private diagnose(code: string, file: SourceFile, source: ScanArtifact, options: {
    reason?: string; node?: Node; targetExpression?: string;
  } = {}): void {
    const filePath = relative(this.scan.sourceRoot!, file.getFilePath()).replace(/\\/g, '/');
    const reason = options.reason ?? code;
    const targetExpression = options.targetExpression?.slice(0, 300);
    const node = options.node;
    const sample = {
      sourcePath: filePath,
      sourceSymbol: source.symbolName,
      startLine: node?.getStartLineNumber() ?? source.startLine,
      endLine: node?.getEndLineNumber() ?? source.endLine,
      ...(targetExpression ? { targetExpression } : {}),
    };
    const key = `${code}:${reason}:${filePath}`;
    const existing = this.diagnostics.get(key);
    const samples = existing?.sampleEvidence ?? [];
    if (!samples.some(item => item.sourceSymbol === sample.sourceSymbol && item.startLine === sample.startLine &&
      item.targetExpression === sample.targetExpression) && samples.length < 5) samples.push(sample);
    this.diagnostics.set(key, {
      code, reason, count: (existing?.count ?? 0) + 1, filePath,
      sourceSymbol: existing?.sourceSymbol ?? source.symbolName,
      ...(targetExpression && !existing?.targetExpression ? { targetExpression } : {}),
      sampleEvidence: samples,
      message: `${reason}: no dependency edge was inferred from the available source evidence.`,
    });
  }
}

function isTestInfrastructureCall(call: CallExpression): boolean {
  if (looksLikeMockConfiguration(call) || isBuiltInDataPreparationCall(call)) return true;
  const access = call.getExpression();
  if (!Node.isPropertyAccessExpression(access)) return false;
  let root: Node = access;
  while (Node.isPropertyAccessExpression(root) || Node.isElementAccessExpression(root)) root = root.getExpression();
  if (Node.isCallExpression(root)) {
    const expression = root.getExpression();
    return Node.isIdentifier(expression) && jestIdentifier(expression, 'expect');
  }
  return Node.isIdentifier(root) && jestIdentifier(root, 'expect') &&
    ['any', 'anything', 'arrayContaining', 'objectContaining', 'stringContaining', 'stringMatching'].includes(access.getName());
}

function jestIdentifier(identifier: Node, name: string): boolean {
  if (!Node.isIdentifier(identifier) || identifier.getText() !== name) return false;
  const declarations = identifier.getSymbol()?.getDeclarations() ?? [];
  if (!declarations.length) return true;
  return declarations.some(declaration => Node.isImportSpecifier(declaration) &&
    declaration.getName() === name && declaration.getImportDeclaration().getModuleSpecifierValue() === '@jest/globals');
}

function isNestedCallback(call: CallExpression, span: { start: number; end: number }): boolean {
  return call.getAncestors().some(node => isFunctionLike(node) && node.getStart() > span.start && node.getStart() < span.end);
}

/** Synchronous Jest throw matchers declare the callback whose body contains the tested call. */
function isThrowAssertionCallback(call: CallExpression, span: { start: number; end: number }): boolean {
  const callback = call.getFirstAncestor(node => Node.isArrowFunction(node) || Node.isFunctionExpression(node));
  if (!callback || callback.getStart() <= span.start || callback.getStart() >= span.end) return false;
  const callbackParent = callback.getParent();
  if (Node.isVariableDeclaration(callbackParent) && callbackParent.getInitializer() === callback) {
    return callbackParent.findReferencesAsNodes().some(reference => {
      if (reference.getStart() <= span.start || reference.getStart() >= span.end) return false;
      const parent = reference.getParent();
      return Node.isCallExpression(parent) && Node.isIdentifier(parent.getExpression()) &&
        jestIdentifier(parent.getExpression(), 'expect') && parent.getArguments().includes(reference) &&
        hasThrowMatcher(parent);
    });
  }
  return Node.isCallExpression(callbackParent) && Node.isIdentifier(callbackParent.getExpression()) &&
    jestIdentifier(callbackParent.getExpression(), 'expect') && callbackParent.getArguments().includes(callback) &&
    hasThrowMatcher(callbackParent);
}

function hasThrowMatcher(expectCall: CallExpression): boolean {
  let current: Node = expectCall;
  for (let depth = 0; depth < 6; depth++) {
    const parent = current.getParent();
    if (!Node.isPropertyAccessExpression(parent) || parent.getExpression() !== current) return false;
    if (/^toThrow(?:Error)?/.test(parent.getName())) {
      const matcherCall = parent.getParent();
      return Node.isCallExpression(matcherCall) && matcherCall.getExpression() === parent;
    }
    current = parent;
  }
  return false;
}

function hasChangingFunctionScope(call: CallExpression, method: MethodDeclaration): boolean {
  return call.getAncestors().some(node => node !== method &&
    (Node.isFunctionDeclaration(node) || Node.isFunctionExpression(node)) &&
    node.getStart() > method.getStart() && node.getEnd() <= method.getEnd());
}

function isFunctionLike(node: Node): boolean {
  return Node.isArrowFunction(node) || Node.isFunctionExpression(node) || Node.isFunctionDeclaration(node) ||
    Node.isMethodDeclaration(node) || Node.isConstructorDeclaration(node);
}
