import { Node, SyntaxKind } from 'ts-morph';
import type { CallExpression, SourceFile, Statement } from 'ts-morph';
import { createArtifactIdentity } from '@ba-helper/shared';
import type { ScanArtifact, TestModifier } from '../scanner.types';
import type { DiagnosticItem } from '../core/diagnostic-collector';
import { computeArtifactContentHash } from '../core/content-hasher';
import { createJestTestArtifact } from './jest-test-artifact';
import { createJestBehaviorBudget, extractJestBehavior, readJestHook } from './jest-test-behavior';
import type { JestBehaviorBudget } from './jest-test-behavior';
import { effectiveTestModifier, literalJestTitle, readJestDeclaration } from './jest-declaration';

export function extractJestTestArtifacts(file: SourceFile, filePath: string, commitSha?: string,
  behaviorBudget: JestBehaviorBudget = createJestBehaviorBudget()): {
  artifacts: ScanArtifact[]; diagnostics: DiagnosticItem[];
} {
  const parent: ScanArtifact = {
    stableId: createArtifactIdentity('test', filePath, 'file'), type: 'TEST', filePath,
    symbolName: file.getBaseName(), startLine: 1, endLine: file.getEndLineNumber(),
    excerpt: file.getText(), contentHash: computeArtifactContentHash(file.getText()),
  };
  const extractor = new JestTestExtractor(parent, commitSha, behaviorBudget);
  return extractor.extract(file);
}

class JestTestExtractor {
  private readonly cases: ScanArtifact[] = [];
  private readonly diagnostics = new Map<string, DiagnosticItem>();

  constructor(private readonly parent: ScanArtifact, private readonly commitSha: string | undefined,
    private readonly behaviorBudget: JestBehaviorBudget) {}

  extract(file: SourceFile) {
    this.statements(file.getStatements(), [], 'NORMAL', []);
    const counts = new Map<string, number>();
    for (const test of this.cases) counts.set(test.stableId, (counts.get(test.stableId) ?? 0) + 1);
    const unique = this.cases.filter(test => counts.get(test.stableId) === 1);
    if (unique.length !== this.cases.length) this.warn('JEST_DUPLICATE_TEST_IDENTITY');
    return { artifacts: [this.parent, ...unique], diagnostics: [...this.diagnostics.values()] };
  }

  private statements(statements: Statement[], suitePath: string[], inherited: TestModifier,
    inheritedHooks: CallExpression[]): void {
    const localHooks: CallExpression[] = [];
    const hookCalls = new Set<CallExpression>();
    for (const statement of statements) {
      const expression = Node.isExpressionStatement(statement) ? statement.getExpression() : undefined;
      const call = expression && Node.isCallExpression(expression) ? expression : undefined;
      const hook = call && readJestHook(call);
      if (!call || !hook) continue;
      hookCalls.add(call);
      if (hook.supported) localHooks.push(call);
      else this.behaviorUnresolved('UNSUPPORTED_SETUP_HOOK', call);
    }
    const setupHooks = [...inheritedHooks, ...localHooks];

    for (const statement of statements) {
      const expression = Node.isExpressionStatement(statement) ? statement.getExpression() : undefined;
      const declaration = expression && Node.isCallExpression(expression) ? readJestDeclaration(expression) : undefined;
      if (expression && Node.isCallExpression(expression) && hookCalls.has(expression)) continue;
      if (declaration && expression && Node.isCallExpression(expression)) {
        this.declaration(expression, declaration, suitePath, inherited, setupHooks);
      } else if (statement.getDescendantsOfKind(SyntaxKind.CallExpression).some(call => readJestDeclaration(call))) {
        this.warn('JEST_UNSUPPORTED_DECLARATION');
      }
    }
  }

  private declaration(call: CallExpression, declaration: NonNullable<ReturnType<typeof readJestDeclaration>>,
    suitePath: string[], inherited: TestModifier, setupHooks: CallExpression[]): void {
    const title = literalJestTitle(call.getArguments()[0]);
    if (!declaration.supported || title === undefined ||
      (declaration.api === 'describe' && suitePath.length >= 20)) {
      this.warn('JEST_UNSUPPORTED_DECLARATION');
      return;
    }
    const modifier = effectiveTestModifier(inherited, declaration.modifier);
    const callback = call.getArguments()[1];
    const body = callback && (Node.isArrowFunction(callback) || Node.isFunctionExpression(callback))
      ? callback.getBody() : undefined;
    if (declaration.api === 'describe') {
      const asyncSuite = callback && (Node.isArrowFunction(callback) || Node.isFunctionExpression(callback)) && callback.isAsync();
      if (!body || !Node.isBlock(body) || asyncSuite) {
        this.warn('JEST_UNSUPPORTED_DECLARATION');
        return;
      }
      this.statements(body.getStatements(), [...suitePath, title], modifier, setupHooks);
      return;
    }
    if (declaration.modifier !== 'TODO' && !body) {
      this.warn('JEST_UNSUPPORTED_DECLARATION');
      return;
    }
    if (declaration.modifier === 'TODO' && callback) {
      this.warn('JEST_UNSUPPORTED_DECLARATION');
      return;
    }
    if (body?.getDescendantsOfKind(SyntaxKind.CallExpression).some(nested => readJestDeclaration(nested))) {
      this.warn('JEST_UNSUPPORTED_DECLARATION');
      return;
    }
    const behavior = body && modifier !== 'SKIP' && modifier !== 'TODO'
      ? extractJestBehavior({ body, setupHooks, relativePath: this.parent.filePath,
        ...(declaration.parameterized ? { staticInputs: [this.parameterizedInput(call)].filter((node): node is Node => !!node) } : {}),
        commitSha: this.commitSha, budget: this.behaviorBudget })
      : undefined;
    const artifact = createJestTestArtifact({ call, parent: this.parent, title, suitePath,
      modifier, declaredModifier: declaration.modifier,
      ...(declaration.parameterized ? { parameterized: true } : {}),
      ...(behavior?.claims.length ? { behaviorEvidence: behavior.claims } : {}),
      bodySpan: body ? { start: body.getStart(), end: body.getEnd() } : undefined });
    for (const diagnostic of behavior?.diagnostics ?? []) this.addDiagnostic(diagnostic);
    this.cases.push(artifact);
  }

  private parameterizedInput(call: CallExpression): Node | undefined {
    const factory = call.getExpression();
    if (!Node.isCallExpression(factory)) return undefined;
    const each = factory.getExpression();
    const table = factory.getArguments()[0];
    return Node.isPropertyAccessExpression(each) && each.getName() === 'each' && table && Node.isArrayLiteralExpression(table)
      ? table : undefined;
  }

  private warn(code: string): void {
    this.addDiagnostic({ code, severity: 'WARN', category: 'SCANNER',
      message: 'Some test declarations have unsupported or ambiguous identities; inspect the test file.',
      count: 1, samplePaths: [this.parent.filePath],
      payload: { relativePath: this.parent.filePath, unsupportedPattern: code } });
  }

  private behaviorUnresolved(pattern: string, node: CallExpression): void {
    this.addDiagnostic({ code: 'JEST_BEHAVIOR_UNRESOLVED', severity: 'WARN', category: 'SCANNER',
      message: 'Some Jest behavior declarations were not analyzed; inspect the source location and pattern.',
      count: 1, samplePaths: [this.parent.filePath],
      payload: { relativePath: this.parent.filePath, unsupportedPattern: pattern,
        startLine: node.getStartLineNumber(), startColumn: node.getSourceFile().getLineAndColumnAtPos(node.getStart()).column } });
  }

  private addDiagnostic(diagnostic: DiagnosticItem): void {
    const key = `${diagnostic.code}::${diagnostic.payload?.relativePath ?? ''}::${diagnostic.payload?.unsupportedPattern ?? ''}`;
    const existing = this.diagnostics.get(key);
    this.diagnostics.set(key, existing
      ? { ...existing, count: (existing.count ?? 1) + (diagnostic.count ?? 1) }
      : { ...diagnostic });
  }
}
