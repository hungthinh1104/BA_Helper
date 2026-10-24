import { Node, SyntaxKind } from 'ts-morph';
import type { CallExpression, ClassDeclaration, Expression, VariableDeclaration } from 'ts-morph';
import { readJestDeclaration } from '../scanner/jest/jest-declaration';
import { readJestHook } from '../scanner/jest/jest-test-behavior';
import { isJestThrowCallback } from './jest-throw-callback';

type BindingWrite = { node: Node; value?: Expression };
type BindingContext = {
  suites: CallExpression[];
  kind: 'CASE' | 'THROW_CALLBACK' | 'SETUP_HOOK' | 'TEARDOWN_HOOK' | 'STATIC' | 'OTHER';
  owner?: Node;
  body: Node;
  position: number;
};

/** Static class-token references, including mocked providers; never runtime DI resolution. */
export class NestTestingReceiver {
  private readonly writes = new Map<VariableDeclaration, BindingWrite[] | undefined>();
  private readonly classWrites = new Map<VariableDeclaration, boolean>();

  constructor(private readonly resolveClass: (node: Node) => ClassDeclaration | undefined) {}

  resolve(receiver: Expression): ClassDeclaration | undefined {
    const declaration = this.variable(receiver);
    if (!declaration) return undefined;
    const values = this.bindingValues(declaration, receiver);
    const targets = values?.map(value => this.classToken(value));
    const target = targets?.[0];
    return target && targets?.every(value => value === target) ? target : undefined;
  }

  hasUnprovenClassWrite(receiver: Expression): boolean {
    const declaration = this.variable(receiver);
    if (!declaration) return false;
    if (this.classWrites.has(declaration)) return this.classWrites.get(declaration)!;
    if (!this.writes.has(declaration)) this.writes.set(declaration, observedWrites(declaration));
    const result = this.writes.get(declaration)?.some(write => !!write.value && !!this.classToken(write.value)) ?? false;
    this.classWrites.set(declaration, result);
    return result;
  }

  private classToken(value: Expression): ClassDeclaration | undefined {
    const call = unparenthesized(value);
    if (Node.isNewExpression(call)) return this.resolveClass(call.getExpression());
    if (!Node.isCallExpression(call)) return undefined;
    const access = call.getExpression();
    if (!Node.isPropertyAccessExpression(access) || access.getName() !== 'get' ||
      !this.isTestingModule(access.getExpression())) return undefined;
    const args = call.getArguments(), types = call.getTypeArguments();
    if (args.length < 1 || args.length > 2 || !Node.isIdentifier(args[0]) || types.length > 1) return undefined;
    const target = this.resolveClass(args[0]);
    if (!target) return undefined;
    if (types.length && (!Node.isTypeReference(types[0]) || this.resolveClass(types[0].getTypeName()) !== target)) return undefined;
    return target;
  }

  private isTestingModule(receiver: Expression): boolean {
    const declaration = this.variable(receiver);
    if (!declaration) return false;
    const values = this.bindingValues(declaration, receiver);
    return Boolean(values?.length && values.every(isNestCompilation));
  }

  private variable(receiver: Expression): VariableDeclaration | undefined {
    if (!Node.isIdentifier(receiver)) return undefined;
    const declarations = receiver.getSymbol()?.getDeclarations() ?? [];
    return declarations.length === 1 && Node.isVariableDeclaration(declarations[0]) ? declarations[0] : undefined;
  }

  private bindingValues(declaration: VariableDeclaration, receiver: Expression): Expression[] | undefined {
    if (!this.writes.has(declaration)) this.writes.set(declaration, observedWrites(declaration));
    const writes = this.writes.get(declaration);
    if (!writes) return undefined;
    const use = bindingContext(receiver);
    const values: Expression[] = [];
    for (const write of writes) {
      const scope = bindingContext(write.node);
      if (!isSuitePrefix(scope.suites, use.suites) || !isRelevantWrite(scope, use, write.node)) continue;
      if (!write.value || !isDirectWrite(write.node, scope)) return undefined;
      values.push(write.value);
    }
    return values.length ? values : undefined;
  }
}

function unparenthesized(value: Expression): Expression {
  for (let depth = 0; depth < 8 && Node.isParenthesizedExpression(value); depth++) value = value.getExpression();
  return value;
}

function isNestCompilation(value: Expression): boolean {
  const awaited = unparenthesized(value);
  if (!Node.isAwaitExpression(awaited)) return false;
  const compile = unparenthesized(awaited.getExpression());
  if (!Node.isCallExpression(compile)) return false;
  const access = compile.getExpression();
  if (!Node.isPropertyAccessExpression(access) || access.getName() !== 'compile') return false;
  let chain: Expression = access.getExpression();
  for (let depth = 0; depth < 12 && Node.isCallExpression(chain); depth++) {
    const factory = chain.getExpression();
    if (!Node.isPropertyAccessExpression(factory)) return false;
    if (factory.getName() === 'createTestingModule') {
      const receiver = factory.getExpression();
      return Node.isIdentifier(receiver) && isNestTestImport(receiver);
    }
    if (!['useMocker', 'overrideProvider', 'overrideGuard', 'overrideInterceptor', 'overridePipe',
      'overrideFilter', 'useValue', 'useClass', 'useFactory'].includes(factory.getName())) return false;
    chain = unparenthesized(factory.getExpression());
  }
  return false;
}

function isNestTestImport(receiver: Expression): boolean {
  if (!Node.isIdentifier(receiver)) return false;
  return receiver.getSymbol()?.getDeclarations().some(declaration => Node.isImportSpecifier(declaration) &&
    declaration.getName() === 'Test' && declaration.getImportDeclaration().getModuleSpecifierValue() === '@nestjs/testing') ?? false;
}

function isAssignment(node: Node): boolean {
  return Node.isBinaryExpression(node) && node.getOperatorToken().getKind() >= SyntaxKind.FirstAssignment &&
    node.getOperatorToken().getKind() <= SyntaxKind.LastAssignment;
}

/** Cache writes once, then evaluate them in the lexical Jest suite of each use. */
function observedWrites(declaration: VariableDeclaration): BindingWrite[] | undefined {
  const writes: BindingWrite[] = [];
  const initial = declaration.getInitializer();
  if (initial) writes.push({ node: declaration, value: initial });
  for (const reference of declaration.findReferencesAsNodes()) {
    const parent = reference.getParent();
    if ((Node.isPrefixUnaryExpression(parent) || Node.isPostfixUnaryExpression(parent)) &&
      [SyntaxKind.PlusPlusToken, SyntaxKind.MinusMinusToken].includes(parent.getOperatorToken())) {
      writes.push({ node: parent });
    }
    if (parent && Node.isBinaryExpression(parent) && parent.getLeft() === reference && isAssignment(parent)) {
      writes.push({ node: parent, ...(parent.getOperatorToken().getKind() === SyntaxKind.EqualsToken
        ? { value: parent.getRight() } : {}) });
    } else if (reference.getAncestors().some(ancestor => Node.isBinaryExpression(ancestor) && isAssignment(ancestor) &&
      ancestor.getLeft().getDescendants().includes(reference))) writes.push({ node: reference });
    if (writes.length > 64) return undefined;
  }
  return writes;
}

function bindingContext(node: Node): BindingContext {
  const suites: CallExpression[] = [];
  let kind: BindingContext['kind'] = 'STATIC';
  let owner: Node | undefined;
  let body: Node = node.getSourceFile();
  for (const ancestor of node.getAncestors()) {
    if (!Node.isArrowFunction(ancestor) && !Node.isFunctionExpression(ancestor) &&
      !Node.isFunctionDeclaration(ancestor)) continue;
    const parent = ancestor.getParent();
    const call = Node.isCallExpression(parent) && parent.getArguments().includes(ancestor) ? parent : undefined;
    const declaration = call && readJestDeclaration(call);
    if (declaration?.supported && declaration.api === 'describe') {
      suites.push(call!);
      if (kind === 'STATIC') body = ancestor.getBody() ?? ancestor;
      continue;
    }
    if (kind === 'THROW_CALLBACK' && declaration?.supported && declaration.api !== 'describe') {
      kind = 'CASE';
      owner = ancestor;
      body = ancestor.getBody() ?? ancestor;
      continue;
    }
    if (kind !== 'STATIC') continue;
    if ((Node.isArrowFunction(ancestor) || Node.isFunctionExpression(ancestor)) && isJestThrowCallback(ancestor)) {
      kind = 'THROW_CALLBACK';
      owner = ancestor;
      body = ancestor.getBody() ?? ancestor;
      continue;
    }
    const hook = call && readJestHook(call);
    kind = declaration?.supported && declaration.api !== 'describe' ? 'CASE'
      : hook?.supported ? hook.kind === 'SETUP_HOOK' ? 'SETUP_HOOK' : 'TEARDOWN_HOOK' : 'OTHER';
    owner = ancestor;
    body = ancestor.getBody() ?? ancestor;
  }
  suites.reverse();
  return { suites, kind, ...(owner ? { owner } : {}), body, position: node.getStart() };
}

function isSuitePrefix(prefix: CallExpression[], suites: CallExpression[]): boolean {
  return prefix.length <= suites.length && prefix.every((suite, index) => suite === suites[index]);
}

function isRelevantWrite(write: BindingContext, use: BindingContext, node: Node): boolean {
  if (write.kind === 'CASE') {
    return (use.kind === 'CASE' || use.kind === 'THROW_CALLBACK') &&
      write.owner === use.owner && node.getStart() < use.position;
  }
  if (write.kind === 'SETUP_HOOK') {
    return (use.kind === 'CASE' || use.kind === 'THROW_CALLBACK') || use.kind === 'SETUP_HOOK' && write.owner === use.owner &&
      node.getStart() < use.position;
  }
  if (write.kind === 'STATIC') return use.kind !== 'OTHER' && use.kind !== 'TEARDOWN_HOOK' &&
    (use.kind !== 'STATIC' || node.getStart() < use.position);
  return write.kind === 'OTHER';
}

function isDirectWrite(node: Node, context: BindingContext): boolean {
  const statement = Node.isVariableDeclaration(node) ? node.getFirstAncestorByKind(SyntaxKind.VariableStatement)
    : node.getFirstAncestorByKind(SyntaxKind.ExpressionStatement);
  return !!statement && statement.getParent() === context.body;
}
