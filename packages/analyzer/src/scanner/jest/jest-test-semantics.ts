import { Node, SyntaxKind } from 'ts-morph';
import type { CallExpression } from 'ts-morph';
import type { Node as MorphNode } from 'ts-morph';
import type { ScanAssertionKind } from '../scanner.types';

const JEST_ROOT_MOCK_METHODS = new Set([
  'fn', 'mock', 'doMock', 'dontMock', 'unmock', 'setMock', 'spyOn', 'replaceProperty',
  'clearAllMocks', 'resetAllMocks', 'restoreAllMocks', 'requireActual', 'requireMock',
]);
const MOCK_CONFIGURATION_METHODS = new Set([
  'mockClear', 'mockReset', 'mockRestore', 'mockImplementation', 'mockImplementationOnce',
  'mockReturnThis', 'mockReturnValue', 'mockReturnValueOnce', 'mockResolvedValue',
  'mockResolvedValueOnce', 'mockRejectedValue', 'mockRejectedValueOnce', 'mockName',
]);
const JEST_ASYMMETRIC_MATCHERS = new Set([
  'any', 'anything', 'arrayContaining', 'objectContaining', 'stringContaining', 'stringMatching',
]);
const RETURN_MATCHERS = new Set([
  'toBe', 'toEqual', 'toStrictEqual', 'toMatchObject', 'toContain', 'toContainEqual',
  'toBeCloseTo', 'toBeGreaterThan', 'toBeGreaterThanOrEqual', 'toBeLessThan',
  'toBeLessThanOrEqual', 'toBeInstanceOf', 'toBeDefined', 'toBeUndefined', 'toBeNull',
  'toBeTruthy', 'toBeFalsy', 'toBeNaN', 'toHaveLength', 'toMatch',
]);
const CALL_COUNT_MATCHERS = new Set([
  'toHaveBeenCalled', 'toHaveBeenCalledOnce', 'toHaveBeenCalledTimes', 'toHaveReturned',
  'toHaveReturnedTimes',
]);
const INVOCATION_MATCHERS = new Set(['toHaveBeenCalledWith', 'toHaveBeenLastCalledWith']);
const EXCEPTION_MATCHERS = new Set(['toThrow', 'toThrowError']);

export type ExpectedAssertionValue = { node: MorphNode; kind: ScanAssertionKind };
export type AssertionSemantics = {
  assertionKind?: ScanAssertionKind;
  expected: ExpectedAssertionValue[];
  unresolved?: 'SNAPSHOT_EXPECTATION_UNRESOLVED' | 'ASSERTION_SEMANTICS_UNRESOLVED' | 'OUTCOME_NOT_EXPLICIT';
};

export function looksLikeMockConfiguration(call: CallExpression): boolean {
  const name = propertyName(call);
  return !!name && MOCK_CONFIGURATION_METHODS.has(name);
}

/** Built-in static/data helpers do not establish a business action by themselves. */
export function isBuiltInDataPreparationCall(call: CallExpression): boolean {
  const expression = call.getExpression();
  const receiver = Node.isPropertyAccessExpression(expression) ? expression.getExpression() : undefined;
  if (receiver && Node.isIdentifier(receiver) && BUILTIN_DATA_HELPERS.has(receiver.getText())) {
    return (receiver.getSymbol()?.getDeclarations().length ?? 0) === 0;
  }
  return Node.isIdentifier(expression) && BUILTIN_DATA_HELPERS.has(expression.getText()) &&
    (expression.getSymbol()?.getDeclarations().length ?? 0) === 0;
}

const BUILTIN_DATA_HELPERS = new Set([
  'Array', 'BigInt', 'Boolean', 'Buffer', 'Date', 'JSON', 'Map', 'Math', 'Number', 'Object', 'Promise',
  'RegExp', 'Set', 'String', 'URL', 'URLSearchParams', 'WeakMap', 'WeakSet', 'isFinite', 'isNaN',
  'parseFloat', 'parseInt', 'structuredClone',
]);

export function isJestAsymmetricMatcher(call: CallExpression,
  isJestRoot: (identifier: MorphNode) => boolean): boolean {
  const expression = call.getExpression();
  if (!Node.isPropertyAccessExpression(expression) || !JEST_ASYMMETRIC_MATCHERS.has(expression.getName())) return false;
  let root: MorphNode = expression.getExpression();
  while (Node.isPropertyAccessExpression(root)) root = root.getExpression();
  return Node.isIdentifier(root) && isJestRoot(root);
}

export function isVerifiedJestMockCall(call: CallExpression,
  isJestRoot: (identifier: MorphNode) => boolean): boolean {
  const expression = call.getExpression();
  const name = propertyName(call);
  if (!name) return false;
  if (JEST_ROOT_MOCK_METHODS.has(name)) {
    return Node.isPropertyAccessExpression(expression) && Node.isIdentifier(expression.getExpression()) &&
      isJestRoot(expression.getExpression());
  }
  if (!MOCK_CONFIGURATION_METHODS.has(name) || !Node.isPropertyAccessExpression(expression)) return false;
  return isVerifiedMockValue(expression.getExpression(), isJestRoot);
}

export function classifyAssertion(call: CallExpression): AssertionSemantics {
  const matcher = propertyName(call);
  const expected = call.getArguments();
  if (!matcher) return { expected: [], unresolved: 'ASSERTION_SEMANTICS_UNRESOLVED' };
  if (matcher === 'toMatchSnapshot' || matcher === 'toMatchInlineSnapshot') {
    return { expected: [], unresolved: 'SNAPSHOT_EXPECTATION_UNRESOLVED' };
  }
  if (CALL_COUNT_MATCHERS.has(matcher)) {
    return { assertionKind: 'CALL_COUNT', expected: expected.length
      ? expected.map(node => ({ node, kind: 'CALL_COUNT' }))
      : [{ node: call, kind: 'CALL_COUNT' }] };
  }
  if (matcher === 'toHaveBeenNthCalledWith') {
    const [ordinal, ...args] = expected;
    return { assertionKind: 'INVOCATION_ARGUMENTS', expected: [
      ...(ordinal ? [{ node: ordinal, kind: 'CALL_COUNT' as const }] : []),
      ...args.map(node => ({ node, kind: 'INVOCATION_ARGUMENTS' as const })),
    ], ...(ordinal ? {} : { unresolved: 'OUTCOME_NOT_EXPLICIT' as const }) };
  }
  if (INVOCATION_MATCHERS.has(matcher)) {
    return { assertionKind: 'INVOCATION_ARGUMENTS', expected: expected.length
      ? expected.map(node => ({ node, kind: 'INVOCATION_ARGUMENTS' }))
      : [{ node: call, kind: 'INVOCATION_ARGUMENTS' }] };
  }
  if (EXCEPTION_MATCHERS.has(matcher)) {
    return { assertionKind: 'EXCEPTION', expected: expected.length
      ? expected.map(node => ({ node, kind: 'EXCEPTION' }))
      : [{ node: call, kind: 'EXCEPTION' }] };
  }
  if (matcher === 'toHaveProperty') {
    return { assertionKind: 'STATE', expected: expected.map(node => ({ node, kind: 'STATE' })),
      ...(expected.length ? {} : { unresolved: 'OUTCOME_NOT_EXPLICIT' as const }) };
  }
  if (RETURN_MATCHERS.has(matcher)) {
    const kind = isStateSubject(assertionSubject(call)) ? 'STATE' : 'RETURN_VALUE';
    return { assertionKind: kind, expected: expected.map(node => ({ node, kind })),
      ...(expected.length ? {} : { unresolved: 'OUTCOME_NOT_EXPLICIT' as const }) };
  }
  return { expected: [], unresolved: 'ASSERTION_SEMANTICS_UNRESOLVED' };
}

function isVerifiedMockValue(node: MorphNode,
  isJestRoot: (identifier: MorphNode) => boolean,
  visited = new Set<MorphNode>()): boolean {
  if (visited.has(node)) return false;
  visited.add(node);
  if (Node.isParenthesizedExpression(node)) return isVerifiedMockValue(node.getExpression(), isJestRoot, visited);
  if (Node.isCallExpression(node)) {
    const expression = node.getExpression();
    if (Node.isPropertyAccessExpression(expression) && Node.isIdentifier(expression.getExpression()) &&
      isJestRoot(expression.getExpression()) &&
      ['fn', 'spyOn', 'mocked'].includes(expression.getName())) return true;
    if (looksLikeMockConfiguration(node) && Node.isPropertyAccessExpression(expression)) {
      return isVerifiedMockValue(expression.getExpression(), isJestRoot, visited);
    }
    return false;
  }
  if (Node.isIdentifier(node)) {
    const declarations = node.getSymbol()?.getDeclarations() ?? [];
    return declarations.some(declaration => Node.isVariableDeclaration(declaration) &&
      !!declaration.getInitializer() && isVerifiedMockValue(declaration.getInitializer()!, isJestRoot, visited));
  }
  if (Node.isPropertyAccessExpression(node) || Node.isElementAccessExpression(node)) {
    const argument = Node.isElementAccessExpression(node) ? node.getArgumentExpression() : undefined;
    const property = Node.isPropertyAccessExpression(node) ? node.getName() :
      argument && Node.isStringLiteral(argument) ? argument.getLiteralValue() : undefined;
    if (!property) return false;
    const declarations = Node.isIdentifier(node.getExpression())
      ? node.getExpression().getSymbol()?.getDeclarations() ?? [] : [];
    return declarations.some(declaration => {
      if (!Node.isVariableDeclaration(declaration)) return false;
      const initializer = declaration.getInitializer();
      if (initializer && Node.isObjectLiteralExpression(initializer) && initializer.getProperties().some(member => {
          if (!Node.isPropertyAssignment(member) || member.getName() !== property) return false;
          const propertyInitializer = member.getInitializer();
          return !!propertyInitializer && isVerifiedMockValue(propertyInitializer, isJestRoot, visited);
        })) return true;
      return isJestMockedType(declaration.getTypeNode());
    });
  }
  return false;
}

function isJestMockedType(type: MorphNode | undefined): boolean {
  if (!type || !Node.isTypeReference(type)) return false;
  const name = type.getTypeName().getText();
  if (name === 'jest.Mocked') return true;
  if (name !== 'Mocked') return false;
  const declarations = type.getTypeName().getSymbol()?.getDeclarations() ?? [];
  return declarations.some(declaration => Node.isImportSpecifier(declaration) &&
    declaration.getName() === 'Mocked' && declaration.getImportDeclaration().getModuleSpecifierValue() === '@jest/globals');
}

export function assertionSubject(call: CallExpression): MorphNode | undefined {
  let expression = call.getExpression();
  while (Node.isPropertyAccessExpression(expression)) expression = expression.getExpression();
  if (!Node.isCallExpression(expression)) return undefined;
  const callee = expression.getExpression();
  return Node.isIdentifier(callee) && callee.getText() === 'expect' ? expression.getArguments()[0] : undefined;
}

/**
 * Resolve the invocation used as an assertion subject when the AST gives one
 * unique declaration or assignment. This deliberately stops at ambiguous
 * symbols and wrappers whose business subject cannot be proven.
 */
export function resolveAssertionInvocation(subject: MorphNode | undefined): MorphNode | undefined {
  return resolveAssertionInvocationNode(subject, new Set<MorphNode>(), 0);
}

function resolveAssertionInvocationNode(subject: MorphNode | undefined, visited: Set<MorphNode>, depth: number): MorphNode | undefined {
  if (!subject || depth > 8 || visited.has(subject)) return undefined;
  visited.add(subject);
  const unwrapped = unwrapExpression(subject);
  if (unwrapped !== subject) return resolveAssertionInvocationNode(unwrapped, visited, depth + 1);
  if (Node.isCallExpression(subject)) return subject;
  if (Node.isPropertyAccessExpression(subject) || Node.isElementAccessExpression(subject)) {
    return resolveAssertionInvocationNode(subject.getExpression(), visited, depth + 1);
  }
  if (!Node.isIdentifier(subject)) return undefined;
  const declarations = subject.getSymbol()?.getDeclarations() ?? [];
  const variables = declarations.filter(Node.isVariableDeclaration);
  if (variables.length > 1) return undefined;
  const declaration = variables[0];
  if (declaration?.getInitializer()) {
    return resolveAssertionInvocationNode(declaration.getInitializer(), visited, depth + 1);
  }
  const assignments = subject.findReferencesAsNodes().flatMap(reference => {
    const parent = reference.getParent();
    if (!Node.isBinaryExpression(parent) || parent.getLeft() !== reference ||
      parent.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) return [];
    return [parent.getRight()];
  });
  if (assignments.length !== 1) return undefined;
  return resolveAssertionInvocationNode(assignments[0], visited, depth + 1);
}

function unwrapExpression(node: MorphNode): MorphNode {
  if (Node.isParenthesizedExpression(node) || Node.isAwaitExpression(node) ||
    Node.isAsExpression(node) || Node.isNonNullExpression(node) || Node.isTypeAssertion(node) ||
    Node.isSatisfiesExpression(node)) {
    return (node as MorphNode & { getExpression(): MorphNode }).getExpression();
  }
  return node;
}

function isStateSubject(node: MorphNode | undefined): boolean {
  return !!node && (Node.isPropertyAccessExpression(node) || Node.isElementAccessExpression(node));
}

function propertyName(call: CallExpression): string | undefined {
  const expression = call.getExpression();
  return Node.isPropertyAccessExpression(expression) ? expression.getName() : undefined;
}
