import { relative, resolve } from 'node:path';
import { Node, SyntaxKind } from 'ts-morph';
import type { ClassDeclaration, MethodDeclaration, SourceFile } from 'ts-morph';
import type { ScanArtifact, ScanResult } from '../scanner/scanner.types';
import type { GraphDiagnostic, GraphEdge, GraphProvenance, GraphResult } from './graph.types';
import { GraphSourceResolver } from './graph-source-resolver';

export const buildGraph = (scan: ScanResult): GraphResult => {
  if (!scan.sourceRoot) return { edges: [] };
  return new SourceGraphBuilder(scan).build();
};

class SourceGraphBuilder {
  private readonly resolver: GraphSourceResolver;
  private readonly edges = new Map<string, GraphEdge>();
  private readonly sourceLocations = new Map<string, Set<string>>();
  private readonly diagnostics = new Map<string, GraphDiagnostic>();

  constructor(private readonly scan: ScanResult) { this.resolver = new GraphSourceResolver(scan); }

  build(): GraphResult {
    for (const artifact of this.resolver.ambiguousArtifacts) {
      const file = this.resolver.project.getSourceFile(resolve(this.scan.sourceRoot!, artifact.filePath));
      if (file) this.diagnose('AMBIGUOUS_ARTIFACT_IDENTITY', file, artifact);
    }
    for (const file of this.resolver.project.getSourceFiles()) {
      const test = this.resolver.testArtifact(file);
      if (test) this.testEdges(file, test);
      else if (/\.(?:spec|test)\.ts$/.test(file.getFilePath())) continue;
      else for (const cls of file.getClasses()) this.classEdges(cls);
    }
    return { edges: [...this.edges.values()], diagnostics: [...this.diagnostics.values()] };
  }

  private testEdges(file: SourceFile, test: ScanArtifact): void {
    const cases = this.resolver.testCases(file);
    const calls = file.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const item of cases) {
      const span = item.testBodySpan;
      if (!span || item.testCase?.modifier === 'SKIP' || item.testCase?.modifier === 'TODO') continue;
      let resolved = false;
      for (const call of calls) {
        if (call.getStart() < span.start || call.getEnd() > span.end) continue;
        const access = call.getExpression();
        if (!Node.isPropertyAccessExpression(access)) continue;
        const cls = this.resolver.receiverClass(access.getExpression());
        const target = cls && this.resolver.artifactFor(cls, access.getName());
        if (!target) continue;
        this.addEdge(item, target, 'TESTS', call, 'TS_AST_DIRECT_CALL');
        resolved = true;
      }
      if (!resolved) this.diagnose('TEST_TARGET_UNRESOLVED', file, item);
    }
    if (!cases.length && file.getImportDeclarations().some(i => i.getModuleSpecifierValue().startsWith('.'))) {
      this.diagnose('TEST_TARGET_UNRESOLVED', file, test);
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
      if (call.getFirstAncestorByKind(SyntaxKind.ClassDeclaration) !== cls ||
        call.getAncestors().some(node => Node.isFunctionDeclaration(node) || Node.isFunctionExpression(node))) {
        this.diagnose('UNRESOLVED_RECEIVER_SCOPE', call.getSourceFile(), source);
        continue;
      }
      const receiver = access.getExpression();
      const targetClass = this.resolver.receiverClass(receiver, cls);
      const target = targetClass && this.resolver.artifactFor(targetClass, access.getName());
      if (target) this.addEdge(source, target, 'CALLS', call, 'TS_AST_DIRECT_CALL');
      else if (targetClass) this.diagnose('UNRESOLVED_METHOD_TARGET', call.getSourceFile(), source);
      else {
        const entityClass = this.resolver.repositoryEntity(receiver, cls);
        const entity = entityClass && this.resolver.artifactFor(entityClass);
        if (entity?.type === 'ENTITY') this.addEdge(source, entity, 'USES', call, 'TS_AST_ENTITY_REFERENCE');
        else if (receiver.getText().startsWith('this.')) {
          this.diagnose('UNRESOLVED_INJECTION_TOKEN', call.getSourceFile(), source);
        }
      }
    }
  }

  private addEdge(from: ScanArtifact, to: ScanArtifact, type: string, node: Node,
    resolver: GraphProvenance['resolver']): void {
    const key = `${from.stableId}->${type}->${to.stableId}`;
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
    this.edges.set(key, { stableId: `edge:${from.stableId}->${to.stableId}`, from: from.stableId,
      to: to.stableId, type, confidence: 1, provenance: { resolver, locations: [location] } });
  }

  private diagnose(code: string, file: SourceFile, source: ScanArtifact): void {
    const filePath = relative(this.scan.sourceRoot!, file.getFilePath()).replace(/\\/g, '/');
    this.diagnostics.set(`${code}:${filePath}:${source.stableId}`, {
      code, filePath, sourceSymbol: source.symbolName,
      message: 'No supported source relationship could be resolved; no dependency edge was inferred.',
    });
  }
}
