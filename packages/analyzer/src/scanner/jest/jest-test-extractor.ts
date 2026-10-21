import { Node, SyntaxKind } from 'ts-morph';
import type { CallExpression, SourceFile, Statement } from 'ts-morph';
import type { ScanArtifact, TestModifier } from '../scanner.types';
import type { DiagnosticItem } from '../core/diagnostic-collector';
import { computeArtifactContentHash } from '../core/content-hasher';
import { createJestTestArtifact } from './jest-test-artifact';
import { effectiveTestModifier, literalJestTitle, readJestDeclaration } from './jest-declaration';

export function extractJestTestArtifacts(file: SourceFile, filePath: string): {
  artifacts: ScanArtifact[]; diagnostics: DiagnosticItem[];
} {
  const parent: ScanArtifact = {
    stableId: `test:${filePath.replace(/[/\\]/g, '.')}`, type: 'TEST', filePath,
    symbolName: file.getBaseName(), startLine: 1, endLine: file.getEndLineNumber(),
    excerpt: file.getText(), contentHash: computeArtifactContentHash(file.getText()),
  };
  const extractor = new JestTestExtractor(parent);
  return extractor.extract(file);
}

class JestTestExtractor {
  private readonly cases: ScanArtifact[] = [];
  private readonly diagnostics = new Map<string, DiagnosticItem>();

  constructor(private readonly parent: ScanArtifact) {}

  extract(file: SourceFile) {
    this.statements(file.getStatements(), [], 'NORMAL');
    const counts = new Map<string, number>();
    for (const test of this.cases) counts.set(test.stableId, (counts.get(test.stableId) ?? 0) + 1);
    const unique = this.cases.filter(test => counts.get(test.stableId) === 1);
    if (unique.length !== this.cases.length) this.warn('JEST_DUPLICATE_TEST_IDENTITY');
    return { artifacts: [this.parent, ...unique], diagnostics: [...this.diagnostics.values()] };
  }

  private statements(statements: Statement[], suitePath: string[], inherited: TestModifier): void {
    for (const statement of statements) {
      const expression = Node.isExpressionStatement(statement) ? statement.getExpression() : undefined;
      const declaration = expression && Node.isCallExpression(expression) ? readJestDeclaration(expression) : undefined;
      if (declaration && expression && Node.isCallExpression(expression)) {
        this.declaration(expression, declaration, suitePath, inherited);
      } else if (statement.getDescendantsOfKind(SyntaxKind.CallExpression).some(call => readJestDeclaration(call))) {
        this.warn('JEST_UNSUPPORTED_DECLARATION');
      }
    }
  }

  private declaration(call: CallExpression, declaration: NonNullable<ReturnType<typeof readJestDeclaration>>,
    suitePath: string[], inherited: TestModifier): void {
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
      this.statements(body.getStatements(), [...suitePath, title], modifier);
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
    this.cases.push(createJestTestArtifact({ call, parent: this.parent, title, suitePath,
      modifier, declaredModifier: declaration.modifier,
      bodySpan: body ? { start: body.getStart(), end: body.getEnd() } : undefined }));
  }

  private warn(code: string): void {
    const existing = this.diagnostics.get(code);
    this.diagnostics.set(code, { code, severity: 'WARN', category: 'SCANNER',
      message: 'Some test declarations have unsupported or ambiguous identities; inspect the test file.',
      count: (existing?.count ?? 0) + 1, samplePaths: [this.parent.filePath],
      payload: { relativePath: this.parent.filePath, unsupportedPattern: code } });
  }
}
