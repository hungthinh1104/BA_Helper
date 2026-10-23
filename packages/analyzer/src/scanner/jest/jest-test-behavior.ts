import { Node, SyntaxKind } from 'ts-morph';
import type { CallExpression, Node as MorphNode } from 'ts-morph';
import { SecretRedactor } from '../core/secret-redactor';
import type { DiagnosticItem } from '../core/diagnostic-collector';
import type { ScanStaticBehaviorClaim } from '../scanner.types';
import {
  classifyAssertion, isBuiltInDataPreparationCall, isJestAsymmetricMatcher, isVerifiedJestMockCall,
  looksLikeMockConfiguration,
} from './jest-test-semantics';

const MAX_CLAIMS_PER_CASE = 100;
const MAX_CLAIMS_PER_SCAN = 20_000;
const MAX_SOURCE_TEXT_LENGTH = 2000;
const HOOK_KINDS = new Map<string, 'SETUP_HOOK' | 'TEARDOWN_HOOK'>([
  ['beforeEach', 'SETUP_HOOK'], ['beforeAll', 'SETUP_HOOK'],
  ['afterEach', 'TEARDOWN_HOOK'], ['afterAll', 'TEARDOWN_HOOK'],
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
  addClaim(kind: ScanStaticBehaviorClaim['kind'], node: MorphNode,
    assertionKind?: ScanStaticBehaviorClaim['assertionKind']): void;
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
  const calls = candidates.filter(Node.isCallExpression);
  recordCallClaims(calls, callsWithCallbacks, recorder);
  recordInputClaims(candidates, recorder);
  const verified = new Set<MorphNode>();
  for (const call of calls) {
    const callback = verifiedThrowCallback(call, input.body);
    if (!callback || verified.has(callback)) continue;
    verified.add(callback);
    const nested = collectDirectBodyNodes(callback.getBody());
    recordCallClaims(nested.candidates.filter(Node.isCallExpression), nested.callsWithCallbacks, recorder);
    for (const node of nested.candidates.filter(isFunctionLike)) recorder.addDiagnostic('NESTED_CALLBACK_NOT_ANALYZED', node);
  }
  for (const node of candidates.filter(isFunctionLike)) {
    if (!verified.has(node)) recorder.addDiagnostic('NESTED_CALLBACK_NOT_ANALYZED', node);
  }
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
  const addClaim = (kind: ScanStaticBehaviorClaim['kind'], node: MorphNode,
    assertionKind?: ScanStaticBehaviorClaim['assertionKind']): void => {
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
      ...(assertionKind ? { assertionKind } : {}),
      evidenceKind: 'STATIC_DECLARATION',
      sourceText,
      sourceLocation: { relativePath: input.relativePath, ...location },
      commitSha: input.commitSha,
    });
    input.budget.remaining--;
  };
  return { claims, diagnostics, addClaim, addDiagnostic };
}

function recordCallClaims(calls: CallExpression[], callsWithCallbacks: Set<CallExpression>, recorder: ClaimRecorder,
  allowActions = true): void {
  for (const call of calls) {
    if (isJestAsymmetricMatcher(call, isJestExpectIdentifier) || isBuiltInDataPreparationCall(call)) continue;
    if (isDynamicAssertionShapedCall(call)) {
      recorder.addDiagnostic(isJestExpectCallFromDynamic(call)
        ? 'DYNAMIC_MATCHER_NOT_ANALYZED' : 'ASSERTION_IDENTITY_UNRESOLVED', call);
      continue;
    }
    if (isAssertionShapedCall(call)) {
      if (isAssertionCall(call)) recordAssertion(call, recorder);
      else recorder.addDiagnostic('ASSERTION_IDENTITY_UNRESOLVED', call);
      continue;
    }
    if (isJestExpectCall(call) || isExpectationCall(call)) continue;
    if (isVerifiedJestMockCall(call, isJestRoot)) {
      recorder.addClaim('MOCK', call);
      continue;
    }
    if (looksLikeMockConfiguration(call)) {
      recorder.addDiagnostic('MOCK_IDENTITY_UNRESOLVED', call);
      continue;
    }
    if (isInsideMockConfiguration(call)) continue;
    if (callsWithCallbacks.has(call)) continue;
    if (!allowActions || isJestDeclarationOrHook(call)) continue;
    const action = classifyActionCall(call);
    if (action === 'ACTION') recorder.addClaim('ACTION', call);
    else if (action === 'UNRESOLVED') recorder.addDiagnostic('ACTION_RECEIVER_UNRESOLVED', call);
  }
}

function classifyActionCall(call: CallExpression): 'ACTION' | 'SKIP' | 'UNRESOLVED' {
  if (isFluentReceiver(call) || isInsideAssertionExpectedValue(call)) return 'SKIP';
  if (isPrimitiveDataReceiver(call)) return 'SKIP';
  const enclosing = enclosingArgumentCall(call);
  if (enclosing && !isJestExpectCall(enclosing) &&
    (importedRoot(enclosing) || Node.isIdentifier(call.getExpression())) &&
    !isLocallyConstructedReceiver(call) && !isClassTokenBoundReceiver(call)) return 'SKIP';
  if (isLocallyConstructedReceiver(call) || isClassTokenBoundReceiver(call)) return 'ACTION';
  const imported = importedRoot(call);
  if (imported) {
    const expression = call.getExpression();
    const directNamedReceiver = Node.isPropertyAccessExpression(expression) &&
      Node.isIdentifier(expression.getExpression()) && imported === 'named';
    return directNamedReceiver && enclosing && isJestExpectCall(enclosing) ? 'ACTION' : 'UNRESOLVED';
  }
  const expression = call.getExpression();
  if (Node.isPropertyAccessExpression(expression) && Node.isCallExpression(expression.getExpression()) &&
    !callRootIdentifier(call)) return 'UNRESOLVED';
  if (isLocalClassDataBuilder(call)) return 'UNRESOLVED';
  if (Node.isIdentifier(call.getExpression()) && Node.isVariableDeclaration(call.getParent())) return 'UNRESOLVED';
  return 'ACTION';
}

function isFluentReceiver(call: CallExpression): boolean {
  const parent = call.getParent();
  const outer = parent?.getParent();
  return Node.isPropertyAccessExpression(parent) && parent.getExpression() === call &&
    Node.isCallExpression(outer) && outer.getExpression() === parent;
}

function isInsideAssertionExpectedValue(call: CallExpression): boolean {
  return actionAncestors(call).some(node => Node.isCallExpression(node) && isAssertionShapedCall(node) &&
    node.getArguments().some(argument => containsNode(argument, call)));
}

function enclosingArgumentCall(call: CallExpression): CallExpression | undefined {
  return actionAncestors(call).find((node): node is CallExpression => Node.isCallExpression(node) &&
    node.getArguments().some(argument => containsNode(argument, call)));
}

function actionAncestors(call: CallExpression): MorphNode[] {
  const ancestors: MorphNode[] = [];
  for (const node of call.getAncestors()) {
    if (isFunctionLike(node)) break;
    ancestors.push(node);
  }
  return ancestors;
}

function containsNode(container: MorphNode, node: MorphNode): boolean {
  return container.getStart() <= node.getStart() && container.getEnd() >= node.getEnd();
}

function callRootIdentifier(call: CallExpression): MorphNode | undefined {
  let root: MorphNode = call.getExpression();
  for (let depth = 0; depth < 64; depth++) {
    if (Node.isCallExpression(root)) root = root.getExpression();
    else if (Node.isPropertyAccessExpression(root) || Node.isElementAccessExpression(root)) root = root.getExpression();
    else break;
  }
  return Node.isIdentifier(root) ? root : undefined;
}

function importedRoot(call: CallExpression, depth = 0): 'named' | 'default' | 'namespace' | undefined {
  const root = callRootIdentifier(call);
  if (!root) return undefined;
  const declarations = root.getSymbol()?.getDeclarations() ?? [];
  if (declarations.some(Node.isImportSpecifier)) return 'named';
  if (declarations.some(Node.isNamespaceImport)) return 'namespace';
  if (declarations.some(Node.isImportClause)) return 'default';
  if (depth >= 4) return undefined;
  const local = declarations.find(declaration => Node.isVariableDeclaration(declaration) || Node.isBindingElement(declaration));
  const variable = local && Node.isVariableDeclaration(local) ? local :
    local?.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
  let initializer: MorphNode | undefined = variable?.getInitializer();
  if (initializer && Node.isAwaitExpression(initializer)) initializer = initializer.getExpression();
  if (initializer && Node.isParenthesizedExpression(initializer)) initializer = initializer.getExpression();
  if (initializer && Node.isCallExpression(initializer)) return importedRoot(initializer, depth + 1);
  return undefined;
}

function isPrimitiveDataReceiver(call: CallExpression): boolean {
  const expression = call.getExpression();
  if (Node.isPropertyAccessExpression(expression)) {
    const receiver = expression.getExpression();
    if (Node.isStringLiteral(receiver) || Node.isNoSubstitutionTemplateLiteral(receiver) ||
      Node.isNumericLiteral(receiver)) return true;
  }
  const root = callRootIdentifier(call);
  if (!root) return false;
  const variable = root.getSymbol()?.getDeclarations().find(Node.isVariableDeclaration);
  const initializer = variable?.getInitializer();
  return !!initializer && (Node.isStringLiteral(initializer) || Node.isNoSubstitutionTemplateLiteral(initializer) ||
    Node.isNumericLiteral(initializer));
}

function isLocallyConstructedReceiver(call: CallExpression): boolean {
  const expression = call.getExpression();
  if (!Node.isPropertyAccessExpression(expression) || !Node.isIdentifier(expression.getExpression())) return false;
  const receiver = expression.getExpression();
  const variable = receiver.getSymbol()?.getDeclarations().find(Node.isVariableDeclaration);
  return !!variable?.getInitializer() && Node.isNewExpression(variable.getInitializer());
}

function isLocalClassDataBuilder(call: CallExpression): boolean {
  if (!Node.isVariableDeclaration(call.getParent())) return false;
  const root = callRootIdentifier(call);
  return !!root && (root.getSymbol()?.getDeclarations().some(Node.isClassDeclaration) ?? false);
}

function isClassTokenBoundReceiver(call: CallExpression): boolean {
  const root = callRootIdentifier(call);
  if (!root) return false;
  const variable = root.getSymbol()?.getDeclarations().find(Node.isVariableDeclaration);
  if (!variable) return false;
  const initializer = variable?.getInitializer();
  const declaredType = variable.getTypeNode();
  const typeName = declaredType && Node.isTypeReference(declaredType) ? declaredType.getTypeName().getText() : undefined;
  if (initializer && !isMatchingClassTokenGet(initializer, typeName)) return false;
  if (!initializer && !typeName) return false;
  const references = variable.findReferencesAsNodes();
  if (references.length > 64) return false;
  let hasBinding = !!initializer;
  for (const reference of references) {
    const parent = reference.getParent();
    if (!Node.isBinaryExpression(parent) || parent.getLeft() !== reference) continue;
    if (parent.getOperatorToken().getKind() !== SyntaxKind.EqualsToken ||
      !isMatchingClassTokenGet(parent.getRight(), typeName)) return false;
    hasBinding = true;
  }
  return hasBinding;
}

function isMatchingClassTokenGet(node: MorphNode, declaredType?: string): boolean {
  if (!Node.isCallExpression(node)) return false;
  const access = node.getExpression(), token = node.getArguments()[0], generic = node.getTypeArguments()[0];
  return Node.isPropertyAccessExpression(access) && access.getName() === 'get' &&
    node.getArguments().length === 1 && !!token && Node.isIdentifier(token) &&
    (!declaredType || declaredType === token.getText()) &&
    (!generic || (Node.isTypeReference(generic) && generic.getTypeName().getText() === token.getText())) &&
    (!!declaredType || !!generic);
}

function isInsideMockConfiguration(call: CallExpression): boolean {
  return call.getAncestors().some(node => Node.isCallExpression(node) && node !== call &&
    looksLikeMockConfiguration(node));
}

function recordAssertion(call: CallExpression, recorder: ClaimRecorder): void {
  const semantics = classifyAssertion(call);
  recorder.addClaim('ASSERTION', call, semantics.assertionKind);
  for (const outcome of semantics.expected) recorder.addClaim('EXPECTED_OUTCOME', outcome.node, outcome.kind);
  if (semantics.unresolved) recorder.addDiagnostic(semantics.unresolved, call);
  else if (!semantics.expected.length) recorder.addDiagnostic('OUTCOME_NOT_EXPLICIT', call);
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
  recordCallClaims(candidates.filter(Node.isCallExpression), callsWithCallbacks, recorder, false);
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
      for (let parent = node.getParent(); parent; parent = parent.getParent()) {
        if (Node.isCallExpression(parent)) callsWithCallbacks.add(parent);
        if (parent === body) break;
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

function verifiedThrowCallback(call: CallExpression, body: MorphNode) {
  if (!isAssertionCall(call) || !['toThrow', 'toThrowError'].includes(callName(call) ?? '')) return undefined;
  let expectCall: MorphNode = call.getExpression();
  while (Node.isPropertyAccessExpression(expectCall)) expectCall = expectCall.getExpression();
  if (!Node.isCallExpression(expectCall)) return undefined;
  const subject = expectCall.getArguments()[0];
  let callback = Node.isArrowFunction(subject) || Node.isFunctionExpression(subject) ? subject : undefined;
  if (Node.isIdentifier(subject)) {
    const declaration = subject.getSymbol()?.getDeclarations().find(Node.isVariableDeclaration);
    const initializer = declaration?.getInitializer();
    const list = declaration?.getParent();
    if (Node.isVariableDeclarationList(list) && list.getDeclarationKind() === 'const' &&
      (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer))) callback = initializer;
  }
  return callback && !callback.isAsync() && callback.getStart() >= body.getStart() &&
    callback.getEnd() <= body.getEnd() ? callback : undefined;
}

function isAssertionCall(call: CallExpression): boolean {
  const expression = call.getExpression();
  if (!Node.isPropertyAccessExpression(expression)) return false;
  let base: MorphNode = expression.getExpression();
  while (Node.isPropertyAccessExpression(base)) base = base.getExpression();
  return Node.isCallExpression(base) && isJestExpectCall(base);
}

function isAssertionShapedCall(call: CallExpression): boolean {
  const expression = call.getExpression();
  if (!Node.isPropertyAccessExpression(expression)) return false;
  let base: MorphNode = expression.getExpression();
  while (Node.isPropertyAccessExpression(base)) base = base.getExpression();
  return Node.isCallExpression(base) && isExpectationCall(base);
}

function isJestExpectCall(call: CallExpression): boolean {
  const expression = call.getExpression();
  return Node.isIdentifier(expression) &&
    (resolveJestImportName(expression) ?? expression.getText()) === 'expect' &&
    isJestGlobalOrImport(expression, 'expect');
}

function isDynamicAssertionShapedCall(call: CallExpression): boolean {
  const expression = call.getExpression();
  if (!Node.isElementAccessExpression(expression)) return false;
  const candidate = expression.getExpression();
  return Node.isCallExpression(candidate) && isExpectationCall(candidate as CallExpression);
}

function isJestExpectCallFromDynamic(call: CallExpression): boolean {
  const expression = call.getExpression();
  if (!Node.isElementAccessExpression(expression)) return false;
  const candidate = expression.getExpression();
  return Node.isCallExpression(candidate) && isJestExpectCall(candidate);
}

function isJestDeclarationOrHook(call: CallExpression): boolean {
  const expression = call.getExpression();
  return Node.isIdentifier(expression) &&
    ['describe', 'it', 'test', ...HOOK_KINDS.keys()].includes(resolveJestImportName(expression) ?? expression.getText()) &&
    isJestGlobalOrImport(expression, resolveJestImportName(expression) ?? expression.getText());
}

function isJestRoot(identifier: MorphNode): boolean {
  return (resolveJestImportName(identifier) ?? identifier.getText()) === 'jest' && isJestGlobalOrImport(identifier, 'jest');
}

function isJestExpectIdentifier(identifier: MorphNode): boolean {
  return (resolveJestImportName(identifier) ?? identifier.getText()) === 'expect' && isJestGlobalOrImport(identifier, 'expect');
}

function isExpectationCall(call: CallExpression): boolean {
  const expression = call.getExpression();
  return Node.isIdentifier(expression) &&
    (resolveJestImportName(expression) ?? expression.getText()) === 'expect';
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
