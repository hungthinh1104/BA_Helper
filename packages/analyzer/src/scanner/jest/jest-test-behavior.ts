import { Node } from 'ts-morph';
import type { CallExpression, Node as MorphNode } from 'ts-morph';
import { SecretRedactor } from '../core/secret-redactor';
import type { DiagnosticItem } from '../core/diagnostic-collector';
import type { ScanStaticBehaviorClaim } from '../scanner.types';

const MAX_CLAIMS_PER_CASE = 100;
const MAX_CLAIMS_PER_SCAN = 20_000;
const MAX_SOURCE_TEXT_LENGTH = 2000;
const HOOK_KINDS = new Map<string, 'SETUP_HOOK' | 'TEARDOWN_HOOK'>([
  ['beforeEach', 'SETUP_HOOK'], ['beforeAll', 'SETUP_HOOK'],
  ['afterEach', 'TEARDOWN_HOOK'], ['afterAll', 'TEARDOWN_HOOK'],
]);
const MOCK_METHODS = new Set([
  'fn', 'mock', 'doMock', 'dontMock', 'unmock', 'setMock', 'spyOn', 'replaceProperty',
  'clearAllMocks', 'resetAllMocks', 'restoreAllMocks', 'requireActual', 'requireMock',
  'mockClear', 'mockReset', 'mockRestore', 'mockImplementation', 'mockImplementationOnce',
  'mockReturnThis', 'mockReturnValue', 'mockReturnValueOnce', 'mockResolvedValue',
  'mockResolvedValueOnce', 'mockRejectedValue', 'mockRejectedValueOnce', 'mockName',
]);
const ZERO_ARGUMENT_OUTCOMES = new Set([
  'toBeDefined', 'toBeUndefined', 'toBeNull', 'toBeTruthy', 'toBeFalsy', 'toBeNaN',
  'toHaveBeenCalled', 'toHaveReturned', 'toThrow', 'toThrowError',
]);

export type JestBehaviorBudget = { remaining: number };

export function createJestBehaviorBudget(): JestBehaviorBudget {
  return { remaining: MAX_CLAIMS_PER_SCAN };
}

export function readJestHook(call: CallExpression): {
  kind: 'SETUP_HOOK' | 'TEARDOWN_HOOK'; callbackBody?: MorphNode; supported: boolean;
} | undefined {
  const expression = call.getExpression();
  if (!Node.isIdentifier(expression)) {
    return undefined;
  }
  const name = resolveJestImportName(expression) ?? expression.getText();
  const kind = HOOK_KINDS.get(name);
  if (!kind || !isJestGlobalOrImport(expression, name)) return undefined;
  const callback = call.getArguments()[0];
  const callbackBody = callback && (Node.isArrowFunction(callback) || Node.isFunctionExpression(callback))
    ? callback.getBody() : undefined;
  const supported = !!callbackBody && call.getArguments().length <= 2;
  return { kind, ...(callbackBody ? { callbackBody } : {}), supported };
}

type BehaviorInput = {
  body: MorphNode;
  setupHooks: CallExpression[];
  staticInputs?: MorphNode[];
  relativePath: string;
  commitSha?: string;
  budget: JestBehaviorBudget;
};

type ClaimRecorder = {
  claims: ScanStaticBehaviorClaim[];
  diagnostics: Map<string, DiagnosticItem>;
  addClaim(kind: ScanStaticBehaviorClaim['kind'], node: MorphNode): void;
  addDiagnostic(pattern: string, node?: MorphNode): void;
};

export function extractJestBehavior(input: BehaviorInput): {
  claims: ScanStaticBehaviorClaim[]; diagnostics: DiagnosticItem[];
} {
  const recorder = createClaimRecorder(input);
  for (const hook of input.setupHooks) {
    const expression = hook.getExpression();
    const hookName = Node.isIdentifier(expression) ? resolveJestImportName(expression) ?? expression.getText() : '';
    recorder.addClaim(HOOK_KINDS.get(hookName) ?? 'SETUP_HOOK', hook);
    recordHookClaims(hook, recorder);
  }
  for (const table of input.staticInputs ?? []) recorder.addClaim('INPUT', table);
  const { candidates, callsWithCallbacks } = collectDirectBodyNodes(input.body);
  recordCallClaims(candidates.filter(Node.isCallExpression), callsWithCallbacks, recorder);
  recordInputClaims(candidates, recorder);
  for (const node of candidates.filter(isFunctionLike)) recorder.addDiagnostic('NESTED_CALLBACK_NOT_ANALYZED', node);
  recorder.claims.sort((left, right) => left.sourceLocation.startOffset - right.sourceLocation.startOffset ||
    left.sourceLocation.endOffset - right.sourceLocation.endOffset || compareKinds(left.kind, right.kind));
  return { claims: recorder.claims, diagnostics: [...recorder.diagnostics.values()] };
}

function createClaimRecorder(input: BehaviorInput): ClaimRecorder {
  const claims: ScanStaticBehaviorClaim[] = [];
  const diagnostics = new Map<string, DiagnosticItem>();
  const addDiagnostic = (pattern: string, node?: MorphNode) => {
    const key = `${input.relativePath}::${pattern}`;
    const existing = diagnostics.get(key);
    const location = node ? sourcePosition(node) : undefined;
    diagnostics.set(key, {
      code: 'JEST_BEHAVIOR_UNRESOLVED', severity: 'WARN', category: 'SCANNER',
      message: 'Some Jest behavior declarations were not analyzed; inspect the source location and pattern.',
      count: (existing?.count ?? 0) + 1,
      samplePaths: [input.relativePath],
      payload: {
        relativePath: input.relativePath,
        unsupportedPattern: pattern,
        ...(location ? { startLine: location.startLine, startColumn: location.startColumn } : {}),
      },
    });
  };
  const addClaim = (kind: ScanStaticBehaviorClaim['kind'], node: MorphNode): void => {
    if (!input.commitSha) {
      addDiagnostic('COMMIT_CONTEXT_REQUIRED', node);
      return;
    }
    if (claims.length >= MAX_CLAIMS_PER_CASE) {
      addDiagnostic('CLAIM_LIMIT_EXCEEDED', node);
      return;
    }
    if (input.budget.remaining <= 0) {
      addDiagnostic('SCAN_CLAIM_LIMIT_EXCEEDED', node);
      return;
    }
    const rawText = node.getText();
    if (!rawText.trim() || rawText.length > MAX_SOURCE_TEXT_LENGTH) {
      addDiagnostic('SOURCE_TEXT_LIMIT_EXCEEDED', node);
      return;
    }
    const sourceText = SecretRedactor.redact(rawText).redactedContent;
    if (sourceText.length > MAX_SOURCE_TEXT_LENGTH) {
      addDiagnostic('SOURCE_TEXT_LIMIT_EXCEEDED', node);
      return;
    }
    const location = sourcePosition(node);
    claims.push({
      kind,
      evidenceKind: 'STATIC_DECLARATION',
      sourceText,
      sourceLocation: { relativePath: input.relativePath, ...location },
      commitSha: input.commitSha,
    });
    input.budget.remaining--;
  };
  return { claims, diagnostics, addClaim, addDiagnostic };
}

function recordCallClaims(calls: CallExpression[], callsWithCallbacks: Set<CallExpression>, recorder: ClaimRecorder): void {
  for (const call of calls) {
    if (isDynamicAssertionCall(call)) {
      recorder.addDiagnostic('DYNAMIC_MATCHER_NOT_ANALYZED', call);
      continue;
    }
    if (isAssertionCall(call)) {
      recordAssertion(call, recorder);
      continue;
    }
    if (isJestExpectCall(call)) continue;
    if (isMockCall(call)) {
      recorder.addClaim('MOCK', call);
      continue;
    }
    if (callsWithCallbacks.has(call)) continue;
    if (!isJestDeclarationOrHook(call)) recorder.addClaim('ACTION', call);
  }
}

function recordAssertion(call: CallExpression, recorder: ClaimRecorder): void {
  recorder.addClaim('ASSERTION', call);
  const matcher = callName(call);
  const expected = call.getArguments()[0];
  const isSnapshot = matcher === 'toMatchSnapshot' || matcher === 'toMatchInlineSnapshot';
  if (isSnapshot) recorder.addDiagnostic('SNAPSHOT_EXPECTATION_UNRESOLVED', call);
  else if (expected) recorder.addClaim('EXPECTED_OUTCOME', expected);
  else if (matcher && ZERO_ARGUMENT_OUTCOMES.has(matcher)) recorder.addClaim('EXPECTED_OUTCOME', call);
  else recorder.addDiagnostic('OUTCOME_NOT_EXPLICIT', call);
}

function recordInputClaims(candidates: MorphNode[], recorder: ClaimRecorder): void {
  for (const declaration of candidates.filter(Node.isVariableDeclaration)) {
    const initializer = declaration.getInitializer();
    if (initializer && isStaticInput(initializer)) recorder.addClaim('INPUT', declaration);
  }
}

function recordHookClaims(hook: CallExpression, recorder: ClaimRecorder): void {
  const parsed = readJestHook(hook);
  if (!parsed?.callbackBody) return;
  const { candidates, callsWithCallbacks } = collectDirectBodyNodes(parsed.callbackBody);
  recordCallClaims(candidates.filter(Node.isCallExpression), callsWithCallbacks, recorder);
  recordInputClaims(candidates, recorder);
  for (const node of candidates.filter(isFunctionLike)) recorder.addDiagnostic('NESTED_CALLBACK_NOT_ANALYZED', node);
}

function isStaticInput(node: MorphNode): boolean {
  if (Node.isCallExpression(node) || Node.isNewExpression(node) || Node.isAwaitExpression(node) ||
      Node.isYieldExpression(node) || Node.isTaggedTemplateExpression(node)) return false;
  return !node.getDescendants().some(child => Node.isCallExpression(child) || Node.isNewExpression(child) ||
    Node.isAwaitExpression(child) || Node.isYieldExpression(child) || Node.isTaggedTemplateExpression(child));
}

function collectDirectBodyNodes(body: MorphNode): { candidates: MorphNode[]; callsWithCallbacks: Set<CallExpression> } {
  const candidates: MorphNode[] = [body];
  const callsWithCallbacks = new Set<CallExpression>();
  const pending = body.getChildren().reverse();
  while (pending.length) {
    const node = pending.pop()!;
    candidates.push(node);
    if (isFunctionLike(node)) {
      for (let parent = node.getParent(); parent && parent !== body; parent = parent.getParent()) {
        if (Node.isCallExpression(parent)) callsWithCallbacks.add(parent);
      }
      continue;
    }
    pending.push(...node.getChildren().reverse());
  }
  return { candidates, callsWithCallbacks };
}

function isFunctionLike(node: MorphNode): boolean {
  return Node.isArrowFunction(node) || Node.isFunctionExpression(node) || Node.isFunctionDeclaration(node) ||
    Node.isMethodDeclaration(node) || Node.isConstructorDeclaration(node);
}

function isAssertionCall(call: CallExpression): boolean {
  const expression = call.getExpression();
  if (!Node.isPropertyAccessExpression(expression)) return false;
  let base: MorphNode = expression.getExpression();
  while (Node.isPropertyAccessExpression(base)) base = base.getExpression();
  return Node.isCallExpression(base) && isJestExpectCall(base);
}

function isJestExpectCall(call: CallExpression): boolean {
  const expression = call.getExpression();
  return Node.isIdentifier(expression) &&
    (resolveJestImportName(expression) ?? expression.getText()) === 'expect' &&
    isJestGlobalOrImport(expression, 'expect');
}

function isDynamicAssertionCall(call: CallExpression): boolean {
  const expression = call.getExpression();
  if (!Node.isElementAccessExpression(expression)) return false;
  const candidate = expression.getExpression();
  return Node.isCallExpression(candidate) && isJestExpectCall(candidate as CallExpression);
}

function isJestDeclarationOrHook(call: CallExpression): boolean {
  const expression = call.getExpression();
  return Node.isIdentifier(expression) &&
    ['describe', 'it', 'test', ...HOOK_KINDS.keys()].includes(resolveJestImportName(expression) ?? expression.getText()) &&
    isJestGlobalOrImport(expression, resolveJestImportName(expression) ?? expression.getText());
}

function isMockCall(call: CallExpression): boolean {
  const name = callName(call);
  if (!name || !MOCK_METHODS.has(name)) return false;
  if (name === 'fn' || ['mock', 'doMock', 'dontMock', 'unmock', 'setMock', 'spyOn', 'replaceProperty',
    'clearAllMocks', 'resetAllMocks', 'restoreAllMocks', 'requireActual', 'requireMock'].includes(name)) {
    const expression = call.getExpression();
    return Node.isPropertyAccessExpression(expression) && Node.isIdentifier(expression.getExpression()) &&
      (resolveJestImportName(expression.getExpression()) ?? expression.getExpression().getText()) === 'jest' &&
      isJestGlobalOrImport(expression.getExpression(), 'jest');
  }
  return true;
}

function callName(call: CallExpression): string | undefined {
  const expression = call.getExpression();
  if (Node.isPropertyAccessExpression(expression)) return expression.getName();
  return Node.isIdentifier(expression) ? expression.getText() : undefined;
}

function resolveJestImportName(identifier: MorphNode): string | undefined {
  if (!Node.isIdentifier(identifier)) return undefined;
  const declarations = identifier.getSymbol()?.getDeclarations() ?? [];
  const imported = declarations.find(Node.isImportSpecifier);
  return imported?.getImportDeclaration().getModuleSpecifierValue() === '@jest/globals' ? imported.getName() : undefined;
}

function isJestGlobalOrImport(identifier: MorphNode, expectedName: string): boolean {
  if (!Node.isIdentifier(identifier)) return false;
  const declarations = identifier.getSymbol()?.getDeclarations() ?? [];
  if (declarations.length === 0) return identifier.getText() === expectedName || resolveJestImportName(identifier) === expectedName;
  const imported = declarations.find(Node.isImportSpecifier);
  return !!imported && imported.getImportDeclaration().getModuleSpecifierValue() === '@jest/globals' &&
    imported.getName() === expectedName;
}

function sourcePosition(node: MorphNode) {
  const source = node.getSourceFile();
  const startOffset = node.getStart();
  const endOffset = node.getEnd();
  const start = source.getLineAndColumnAtPos(startOffset);
  const end = source.getLineAndColumnAtPos(endOffset);
  return { startOffset, endOffset, startLine: start.line, startColumn: start.column,
    endLine: end.line, endColumn: end.column };
}

function compareKinds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
