import { Node, SyntaxKind } from 'ts-morph';
import type { ClassDeclaration, Expression, VariableDeclaration } from 'ts-morph';

/** Static class-token references, including mocked providers; never runtime DI resolution. */
export class NestTestingReceiver {
  private readonly classes = new Map<VariableDeclaration, ClassDeclaration | undefined>();
  private readonly modules = new Map<VariableDeclaration, boolean>();

  constructor(private readonly resolveClass: (node: Node) => ClassDeclaration | undefined) {}

  resolve(receiver: Expression): ClassDeclaration | undefined {
    const declaration = this.variable(receiver);
    if (!declaration) return undefined;
    if (this.classes.has(declaration)) return this.classes.get(declaration);
    const values = bindingValues(declaration);
    const targets = values?.map(value => this.classToken(value));
    const target = targets?.[0];
    const result = target && targets?.every(value => value === target) ? target : undefined;
    this.classes.set(declaration, result);
    return result;
  }

  private classToken(value: Expression): ClassDeclaration | undefined {
    const call = unparenthesized(value);
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
    if (this.modules.has(declaration)) return this.modules.get(declaration)!;
    const values = bindingValues(declaration);
    const result = Boolean(values?.length && values.every(isNestCompilation));
    this.modules.set(declaration, result);
    return result;
  }

  private variable(receiver: Expression): VariableDeclaration | undefined {
    if (!Node.isIdentifier(receiver)) return undefined;
    const declarations = receiver.getSymbol()?.getDeclarations() ?? [];
    return declarations.length === 1 && Node.isVariableDeclaration(declarations[0]) ? declarations[0] : undefined;
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
  const create = access.getExpression();
  if (!Node.isCallExpression(create)) return false;
  const factory = create.getExpression();
  if (!Node.isPropertyAccessExpression(factory) || factory.getName() !== 'createTestingModule') return false;
  const receiver = factory.getExpression();
  if (!Node.isIdentifier(receiver)) return false;
  return receiver.getSymbol()?.getDeclarations().some(declaration => Node.isImportSpecifier(declaration) &&
    declaration.getName() === 'Test' && declaration.getImportDeclaration().getModuleSpecifierValue() === '@nestjs/testing') ?? false;
}

function isAssignment(node: Node): boolean {
  return Node.isBinaryExpression(node) && node.getOperatorToken().getKind() >= SyntaxKind.FirstAssignment &&
    node.getOperatorToken().getKind() <= SyntaxKind.LastAssignment;
}

/** Every observed write must be a supported assignment; annotations alone prove no binding. */
function bindingValues(declaration: VariableDeclaration): Expression[] | undefined {
  const values: Expression[] = [];
  const initial = declaration.getInitializer();
  if (initial) values.push(initial);
  for (const reference of declaration.findReferencesAsNodes()) {
    const parent = reference.getParent();
    if ((Node.isPrefixUnaryExpression(parent) || Node.isPostfixUnaryExpression(parent)) &&
      [SyntaxKind.PlusPlusToken, SyntaxKind.MinusMinusToken].includes(parent.getOperatorToken())) return undefined;
    if (parent && Node.isBinaryExpression(parent) && parent.getLeft() === reference && isAssignment(parent)) {
      if (parent.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) return undefined;
      values.push(parent.getRight());
    } else if (reference.getAncestors().some(ancestor => Node.isBinaryExpression(ancestor) && isAssignment(ancestor) &&
      ancestor.getLeft().getDescendants().includes(reference))) return undefined;
    if (values.length > 64) return undefined;
  }
  return values.length ? values : undefined;
}
