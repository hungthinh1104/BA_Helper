import { Node } from 'ts-morph';
import type { CallExpression, ClassDeclaration, FunctionDeclaration } from 'ts-morph';

/** A source reference through `function build() { return new Subject(...); }`, never execution. */
export class LocalNewFactoryReceiver {
  private readonly targets = new Map<FunctionDeclaration, ClassDeclaration | undefined>();

  constructor(private readonly resolveClass: (node: Node) => ClassDeclaration | undefined) {}

  resolve(call: CallExpression): ClassDeclaration | undefined {
    const receiver = call.getExpression();
    if (!Node.isIdentifier(receiver) || call.getArguments().length || call.getTypeArguments().length) return undefined;
    const declarations = receiver.getSymbol()?.getDeclarations() ?? [];
    if (declarations.length !== 1 || !Node.isFunctionDeclaration(declarations[0])) return undefined;
    const factory = declarations[0];
    if (factory.getSourceFile() !== call.getSourceFile()) return undefined;
    if (this.targets.has(factory)) return this.targets.get(factory);
    const target = this.factoryTarget(factory);
    this.targets.set(factory, target);
    return target;
  }

  private factoryTarget(factory: FunctionDeclaration): ClassDeclaration | undefined {
    if (factory.isAsync() || factory.isGenerator() || factory.getParameters().length || factory.getTypeParameters().length) return undefined;
    const body = factory.getBody();
    if (!body || !Node.isBlock(body)) return undefined;
    const statements = body.getStatements();
    if (statements.length !== 1 || !Node.isReturnStatement(statements[0])) return undefined;
    const returned = statements[0].getExpression();
    if (!returned || !Node.isNewExpression(returned)) return undefined;
    // Reject writes, aliases and escapes. Only direct references as calls are accepted.
    if (factory.findReferencesAsNodes().some(reference => {
      const parent = reference.getParent();
      return !Node.isCallExpression(parent) || parent.getExpression() !== reference;
    })) return undefined;
    return this.resolveClass(returned.getExpression());
  }
}
