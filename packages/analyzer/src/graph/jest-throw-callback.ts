import { Node } from 'ts-morph';
import type { ArrowFunction, CallExpression, FunctionExpression } from 'ts-morph';

type Span = { start: number; end: number };

/** A synchronous Jest throw matcher proves which local callback it invokes. */
export function provenJestThrowCallback(call: CallExpression, span: Span): ArrowFunction | FunctionExpression | undefined {
  const callback = call.getFirstAncestor(node => Node.isArrowFunction(node) || Node.isFunctionExpression(node));
  if (!callback || (!Node.isArrowFunction(callback) && !Node.isFunctionExpression(callback)) ||
    callback.getStart() <= span.start || callback.getStart() >= span.end) return undefined;
  if (callback.getAncestors().some(node => isFunctionLike(node) &&
    node.getStart() > span.start && node.getStart() < span.end)) return undefined;
  return isJestThrowCallback(callback, span) ? callback : undefined;
}

/** Recognizes only callbacks directly proven as the subject of a Jest throw matcher. */
export function isJestThrowCallback(callback: ArrowFunction | FunctionExpression, span?: Span): boolean {
  const parent = callback.getParent();
  if (Node.isVariableDeclaration(parent) && parent.getInitializer() === callback) {
    return parent.findReferencesAsNodes().some(reference => {
      if (span && (reference.getStart() <= span.start || reference.getStart() >= span.end)) return false;
      const expectCall = reference.getParent();
      return Node.isCallExpression(expectCall) && isJestExpectIdentifier(expectCall.getExpression()) &&
        expectCall.getArguments().includes(reference) && hasThrowMatcher(expectCall);
    });
  }
  return Node.isCallExpression(parent) && isJestExpectIdentifier(parent.getExpression()) &&
    parent.getArguments().includes(callback) && hasThrowMatcher(parent);
}

export function isJestExpectIdentifier(node: Node): boolean {
  if (!Node.isIdentifier(node) || node.getText() !== 'expect') return false;
  const declarations = node.getSymbol()?.getDeclarations() ?? [];
  if (!declarations.length) return true;
  return declarations.some(declaration => Node.isImportSpecifier(declaration) &&
    declaration.getName() === 'expect' && declaration.getImportDeclaration().getModuleSpecifierValue() === '@jest/globals');
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

function isFunctionLike(node: Node): boolean {
  return Node.isArrowFunction(node) || Node.isFunctionExpression(node) || Node.isFunctionDeclaration(node) ||
    Node.isMethodDeclaration(node) || Node.isConstructorDeclaration(node);
}
