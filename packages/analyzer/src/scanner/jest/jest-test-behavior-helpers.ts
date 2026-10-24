import { Node, SyntaxKind } from 'ts-morph';
import type { CallExpression, Node as MorphNode } from 'ts-morph';
import { looksLikeMockConfiguration } from './jest-test-semantics';

const JEST_DECLARATION_NAMES = new Set(['describe', 'it', 'test', 'beforeEach', 'beforeAll', 'afterEach', 'afterAll']);

export function classifyActionCall(call: CallExpression): 'ACTION' | 'SKIP' | 'UNRESOLVED' {
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
  const initializer = variable.getInitializer();
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
  const access = node.getExpression();
  const token = node.getArguments()[0];
  const generic = node.getTypeArguments()[0];
  return Node.isPropertyAccessExpression(access) && access.getName() === 'get' &&
    node.getArguments().length === 1 && !!token && Node.isIdentifier(token) &&
    (!declaredType || declaredType === token.getText()) &&
    (!generic || (Node.isTypeReference(generic) && generic.getTypeName().getText() === token.getText())) &&
    (!!declaredType || !!generic);
}

export function isInsideMockConfiguration(call: CallExpression): boolean {
  return call.getAncestors().some(node => Node.isCallExpression(node) && node !== call &&
    looksLikeMockConfiguration(node));
}

export function verifiedThrowCallback(call: CallExpression, body: MorphNode) {
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

export function isAssertionCall(call: CallExpression): boolean {
  const expression = call.getExpression();
  if (!Node.isPropertyAccessExpression(expression)) return false;
  let base: MorphNode = expression.getExpression();
  while (Node.isPropertyAccessExpression(base)) base = base.getExpression();
  return Node.isCallExpression(base) && isJestExpectCall(base);
}

export function isAssertionShapedCall(call: CallExpression): boolean {
  const expression = call.getExpression();
  if (!Node.isPropertyAccessExpression(expression)) return false;
  let base: MorphNode = expression.getExpression();
  while (Node.isPropertyAccessExpression(base)) base = base.getExpression();
  return Node.isCallExpression(base) && isExpectationCall(base);
}

export function isJestExpectCall(call: CallExpression): boolean {
  const expression = call.getExpression();
  return Node.isIdentifier(expression) &&
    (resolveJestImportName(expression) ?? expression.getText()) === 'expect' &&
    isJestGlobalOrImport(expression, 'expect');
}

export function isDynamicAssertionShapedCall(call: CallExpression): boolean {
  const expression = call.getExpression();
  if (!Node.isElementAccessExpression(expression)) return false;
  const candidate = expression.getExpression();
  return Node.isCallExpression(candidate) && isExpectationCall(candidate);
}

export function isJestExpectCallFromDynamic(call: CallExpression): boolean {
  const expression = call.getExpression();
  if (!Node.isElementAccessExpression(expression)) return false;
  const candidate = expression.getExpression();
  return Node.isCallExpression(candidate) && isJestExpectCall(candidate);
}

export function isJestDeclarationOrHook(call: CallExpression): boolean {
  const expression = call.getExpression();
  const name = resolveJestImportName(expression) ?? expression.getText();
  return Node.isIdentifier(expression) && JEST_DECLARATION_NAMES.has(name) && isJestGlobalOrImport(expression, name);
}

export function isJestRoot(identifier: MorphNode): boolean {
  return (resolveJestImportName(identifier) ?? identifier.getText()) === 'jest' && isJestGlobalOrImport(identifier, 'jest');
}

export function isJestExpectIdentifier(identifier: MorphNode): boolean {
  return (resolveJestImportName(identifier) ?? identifier.getText()) === 'expect' && isJestGlobalOrImport(identifier, 'expect');
}

export function isExpectationCall(call: CallExpression): boolean {
  const expression = call.getExpression();
  return Node.isIdentifier(expression) && (resolveJestImportName(expression) ?? expression.getText()) === 'expect';
}

function callName(call: CallExpression): string | undefined {
  const expression = call.getExpression();
  if (Node.isPropertyAccessExpression(expression)) return expression.getName();
  return Node.isIdentifier(expression) ? expression.getText() : undefined;
}

export function resolveJestImportName(identifier: MorphNode): string | undefined {
  if (!Node.isIdentifier(identifier)) return undefined;
  const declarations = identifier.getSymbol()?.getDeclarations() ?? [];
  const imported = declarations.find(Node.isImportSpecifier);
  return imported?.getImportDeclaration().getModuleSpecifierValue() === '@jest/globals' ? imported.getName() : undefined;
}

export function isJestGlobalOrImport(identifier: MorphNode, expectedName: string): boolean {
  if (!Node.isIdentifier(identifier)) return false;
  const declarations = identifier.getSymbol()?.getDeclarations() ?? [];
  if (declarations.length === 0) return identifier.getText() === expectedName || resolveJestImportName(identifier) === expectedName;
  const imported = declarations.find(Node.isImportSpecifier);
  return !!imported && imported.getImportDeclaration().getModuleSpecifierValue() === '@jest/globals' &&
    imported.getName() === expectedName;
}

function isFunctionLike(node: MorphNode): boolean {
  return Node.isArrowFunction(node) || Node.isFunctionExpression(node) || Node.isFunctionDeclaration(node) ||
    Node.isMethodDeclaration(node) || Node.isConstructorDeclaration(node);
}
