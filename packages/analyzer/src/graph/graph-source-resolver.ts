import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { Node, Project } from 'ts-morph';
import type { ClassDeclaration, Expression, ImportDeclaration, SourceFile } from 'ts-morph';
import type { ScanArtifact, ScanResult } from '../scanner/scanner.types';
import { NestTestingReceiver } from './nest-testing-receiver';
import { LocalNewFactoryReceiver } from './local-new-factory-receiver';

/** Resolves only lexical declarations in files already accepted by the scanner. */
export class GraphSourceResolver {
  readonly ambiguousArtifacts: ScanArtifact[];
  readonly project = new Project({
    skipFileDependencyResolution: true,
    compilerOptions: { noResolve: true, noLib: true },
  });
  private readonly artifacts = new Map<string, ScanArtifact[]>();
  private readonly ambiguousIds = new Set<string>();
  private readonly testFiles = new Map<string, ScanArtifact>();
  private readonly casesByFile = new Map<string, ScanArtifact[]>();
  private readonly sources = new Map<string, SourceFile>();
  private readonly testingReceiver = new NestTestingReceiver(node => this.resolveClass(node));
  private readonly localFactory = new LocalNewFactoryReceiver(node => this.resolveClass(node));

  constructor(scan: ScanResult) {
    const keyCounts = new Map<string, number>();
    for (const artifact of scan.artifacts) keyCounts.set(artifact.stableId, (keyCounts.get(artifact.stableId) ?? 0) + 1);
    this.ambiguousArtifacts = scan.artifacts.filter(a => keyCounts.get(a.stableId)! > 1);
    for (const artifact of this.ambiguousArtifacts) this.ambiguousIds.add(artifact.stableId);
    const root = resolve(scan.sourceRoot!);
    const files = scan.sourceFiles ?? scan.artifacts.map(a => resolve(root, a.filePath));
    for (const file of [...new Set(files)].sort()) {
      const absolute = resolve(file);
      const path = relative(root, absolute);
      if (isAbsolute(path) || path === '..' || path.startsWith('../') || path.startsWith('..\\')) continue;
      if (!absolute.endsWith('.ts')) continue;
      this.sources.set(absolute, this.project.addSourceFileAtPath(absolute));
    }
    for (const artifact of scan.artifacts) {
      const path = resolve(root, artifact.filePath);
      const key = `${path}#${artifact.symbolName}`;
      const matches = this.artifacts.get(key) ?? [];
      matches.push(artifact);
      this.artifacts.set(key, matches);
      if (this.ambiguousIds.has(artifact.stableId)) continue;
      if (artifact.type === 'TEST' && !this.testFiles.has(path)) this.testFiles.set(path, artifact);
      if (artifact.type === 'JEST_TEST_CASE') {
        const cases = this.casesByFile.get(path) ?? [];
        cases.push(artifact);
        this.casesByFile.set(path, cases);
      }
    }
  }

  artifactFor(cls: ClassDeclaration, methodName?: string): ScanArtifact | undefined {
    const symbol = methodName ? `${cls.getName()}.${methodName}` : cls.getName();
    const matches = this.artifacts.get(`${resolve(cls.getSourceFile().getFilePath())}#${symbol}`);
    return matches?.length === 1 && !this.ambiguousIds.has(matches[0].stableId) ? matches[0] : undefined;
  }

  testArtifact(file: SourceFile): ScanArtifact | undefined {
    return this.testFiles.get(resolve(file.getFilePath()));
  }

  testCases(file: SourceFile): readonly ScanArtifact[] {
    return this.casesByFile.get(resolve(file.getFilePath())) ?? [];
  }

  resolveClass(identifier: Node): ClassDeclaration | undefined {
    if (!Node.isIdentifier(identifier)) return undefined;
    for (const declaration of identifier.getSymbol()?.getDeclarations() ?? []) {
      if (Node.isClassDeclaration(declaration)) return declaration;
      if (Node.isImportSpecifier(declaration)) {
        const target = this.importSource(declaration.getImportDeclaration());
        return target?.getClasses().find(c => c.getName() === declaration.getName() && c.isExported());
      }
      if (Node.isImportClause(declaration)) {
        const parent = declaration.getParent();
        if (Node.isImportDeclaration(parent)) {
          return this.importSource(parent)?.getClasses().find(c => c.isDefaultExport());
        }
      }
    }
    return undefined;
  }

  receiverClass(receiver: Expression, owner?: ClassDeclaration): ClassDeclaration | undefined {
    if (Node.isNewExpression(receiver)) return this.resolveClass(receiver.getExpression());
    if (!owner && Node.isCallExpression(receiver)) return this.localFactory.resolve(receiver);
    if (receiver.getText() === 'this') return owner;
    if (Node.isIdentifier(receiver)) {
      const declaration = receiver.getSymbol()?.getDeclarations()[0];
      if (declaration && Node.isVariableDeclaration(declaration)) {
        const list = declaration.getParent();
        if (!Node.isVariableDeclarationList(list)) return undefined;
        const initializer = declaration.getInitializer();
        // Typed mocks and object literals do not establish a real class instance.
        if (list.getDeclarationKind() === 'const' && initializer && Node.isNewExpression(initializer)) return this.resolveClass(initializer.getExpression());
        if (!owner) return this.testingReceiver.resolve(receiver);
      }
    }
    if (Node.isPropertyAccessExpression(receiver) && receiver.getExpression().getText() === 'this' && owner) {
      const parameter = this.injectedParameter(owner, receiver.getName());
      const type = parameter?.getTypeNode();
      if (type && Node.isTypeReference(type)) return this.resolveClass(type.getTypeName());
    }
    return undefined;
  }

  repositoryEntity(receiver: Expression, owner: ClassDeclaration): ClassDeclaration | undefined {
    if (!Node.isPropertyAccessExpression(receiver) || receiver.getExpression().getText() !== 'this') return undefined;
    const type = this.injectedParameter(owner, receiver.getName())?.getTypeNode();
    if (!type || !Node.isTypeReference(type)) return undefined;
    const name = type.getTypeName();
    if (!Node.isIdentifier(name)) return undefined;
    const imported = name.getSymbol()?.getDeclarations().find(Node.isImportSpecifier);
    if (!imported || imported.getName() !== 'Repository' ||
      imported.getImportDeclaration().getModuleSpecifierValue() !== 'typeorm') return undefined;
    const argument = type.getTypeArguments()[0];
    return argument && Node.isTypeReference(argument) ? this.resolveClass(argument.getTypeName()) : undefined;
  }

  private injectedParameter(owner: ClassDeclaration, name: string) {
    return owner.getConstructors().flatMap(c => c.getParameters()).find(p =>
      p.getName() === name && p.isParameterProperty());
  }

  private importSource(declaration: ImportDeclaration): SourceFile | undefined {
    const specifier = declaration.getModuleSpecifierValue();
    if (!specifier.startsWith('.')) return undefined;
    const base = resolve(dirname(declaration.getSourceFile().getFilePath()), specifier);
    return [base, `${base}.ts`, resolve(base, 'index.ts'), base.replace(/\.js$/, '.ts')]
      .map(path => this.sources.get(path)).find(Boolean);
  }
}
