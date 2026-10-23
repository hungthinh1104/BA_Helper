import { isAbsolute, relative, resolve } from 'node:path';
import { Node, Project } from 'ts-morph';
import type { ClassDeclaration, Expression, SourceFile, TypeNode } from 'ts-morph';
import type { ScanArtifact, ScanResult } from '../scanner/scanner.types';
import { NestTestingReceiver } from './nest-testing-receiver';
import { LocalNewFactoryReceiver } from './local-new-factory-receiver';
import { ScannedModuleResolver } from './scanned-module-resolver';
import { ScannedExportResolver } from './scanned-export-resolver';
import type { ClassResolution } from './scanned-export-resolver';

/** Resolves only lexical declarations in files already accepted by the scanner. */
export class GraphSourceResolver {
  readonly ambiguousArtifacts: ScanArtifact[];
  readonly ambiguousSymbols: ScanArtifact[];
  readonly project = new Project({
    skipFileDependencyResolution: true,
    compilerOptions: { noResolve: true, noLib: true },
  });
  private readonly artifacts = new Map<string, ScanArtifact[]>();
  private readonly ambiguousIds = new Set<string>();
  private readonly testFiles = new Map<string, ScanArtifact>();
  private readonly casesByFile = new Map<string, ScanArtifact[]>();
  private readonly sources = new Map<string, SourceFile>();
  private readonly moduleResolver: ScannedModuleResolver;
  private readonly exportResolver: ScannedExportResolver;
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
    this.moduleResolver = new ScannedModuleResolver(root, this.sources);
    this.exportResolver = new ScannedExportResolver(this.moduleResolver);
    for (const artifact of scan.artifacts) this.indexArtifact(root, artifact);
    this.ambiguousSymbols = [...this.artifacts.values()].filter(matches => matches.length > 1).flat();
  }

  artifactFor(cls: ClassDeclaration, methodName?: string): ScanArtifact | undefined {
    return this.artifactResolution(cls, methodName).artifact;
  }

  artifactResolution(cls: ClassDeclaration, methodName?: string): { artifact?: ScanArtifact; failure?: string } {
    const symbol = methodName ? `${cls.getName()}.${methodName}` : cls.getName();
    const matches = this.artifacts.get(`${resolve(cls.getSourceFile().getFilePath())}#${symbol}`);
    if (matches?.length === 1 && !this.ambiguousIds.has(matches[0].stableId)) return { artifact: matches[0] };
    if ((matches?.length ?? 0) > 1 || matches?.some(match => this.ambiguousIds.has(match.stableId))) {
      return { failure: 'AMBIGUOUS_SYMBOL' };
    }
    return {};
  }

  testArtifact(file: SourceFile): ScanArtifact | undefined { return this.testFiles.get(resolve(file.getFilePath())); }
  testCases(file: SourceFile): readonly ScanArtifact[] { return this.casesByFile.get(resolve(file.getFilePath())) ?? []; }

  resolveClass(identifier: Node): ClassDeclaration | undefined { return this.resolveClassDetails(identifier).declaration; }

  resolveClassDetails(identifier: Node): ClassResolution {
    const result = this.exportResolver.resolveClass(identifier);
    if (result.declaration) return result;
    const declaration = Node.isIdentifier(identifier) ? identifier.getSymbol()?.getDeclarations()
      .find(Node.isImportClause) : undefined;
    if (!declaration) return result;
    const importDeclaration = declaration.getParent();
    if (!Node.isImportDeclaration(importDeclaration)) return result;
    return this.exportResolver.resolveDefaultImport(importDeclaration.getModuleSpecifierValue(),
      identifier.getSourceFile().getFilePath());
  }

  receiverClass(receiver: Expression, owner?: ClassDeclaration): ClassDeclaration | undefined {
    if (Node.isNewExpression(receiver)) return this.resolveClass(receiver.getExpression());
    if (!owner && Node.isCallExpression(receiver)) return this.localFactory.resolve(receiver);
    if (receiver.getText() === 'this') return owner;
    if (Node.isIdentifier(receiver)) {
      const importedClass = this.resolveClass(receiver);
      if (importedClass) return importedClass;
      const declaration = receiver.getSymbol()?.getDeclarations()[0];
      if (declaration && Node.isVariableDeclaration(declaration)) {
        const initializer = declaration.getInitializer();
        const list = declaration.getParent();
        if (initializer && Node.isNewExpression(initializer) && Node.isVariableDeclarationList(list) &&
          list.getDeclarationKind() === 'const') {
          return this.resolveClass(initializer.getExpression());
        }
        if (!owner) return this.testingReceiver.resolve(receiver);
      }
    }
    if (Node.isPropertyAccessExpression(receiver) && receiver.getExpression().getText() === 'this' && owner) {
      return this.classFromType(this.dependencyType(owner, receiver.getName()));
    }
    return undefined;
  }

  isPotentialTestReceiver(receiver: Expression): boolean {
    if (Node.isNewExpression(receiver)) return true;
    if (Node.isPropertyAccessExpression(receiver) && receiver.getExpression().getText() === 'this') return true;
    if (Node.isCallExpression(receiver)) return !!this.localFactory.resolve(receiver) || isLocalFactoryCall(receiver);
    if (!Node.isIdentifier(receiver)) return false;
    const declarations = receiver.getSymbol()?.getDeclarations() ?? [];
    if (declarations.some(Node.isImportSpecifier)) {
      const result = this.resolveClassDetails(receiver);
      return !!result.declaration || (!!result.failure && result.failure !== 'IMPORT_RESOLUTION_FAILED');
    }
    const variable = declarations.find(Node.isVariableDeclaration);
    if (!variable) return false;
    if (this.receiverClass(receiver)) return true;
    const type = variable.getTypeNode();
    if (type && Node.isTypeReference(type)) {
      const result = this.classFromTypeDetails(type);
      if (result.declaration || (result.failure && result.failure !== 'IMPORT_RESOLUTION_FAILED')) return true;
      const typeDeclarations = type.getTypeName().getSymbol()?.getDeclarations() ?? [];
      if (typeDeclarations.some(Node.isImportSpecifier) && result.failure === 'IMPORT_RESOLUTION_FAILED') return false;
      return true;
    }
    const initializer = variable.getInitializer();
    return this.testingReceiver.hasUnprovenClassWrite(receiver) ||
      !!initializer && (Node.isNewExpression(initializer) || this.testingReceiver.resolve(receiver) !== undefined);
  }

  receiverFailure(receiver: Expression, owner?: ClassDeclaration): ClassResolution {
    if (Node.isNewExpression(receiver)) return this.resolveClassDetails(receiver.getExpression());
    if (Node.isCallExpression(receiver)) {
      const declaration = this.localFactory.resolve(receiver);
      if (declaration) return { declaration };
      return isLocalFactoryCall(receiver) ? { failure: 'UNSUPPORTED_PATTERN', targetExpression: receiver.getText() } : {};
    }
    if (Node.isPropertyAccessExpression(receiver) && receiver.getExpression().getText() === 'this' && owner) {
      return this.classFromTypeDetails(this.dependencyType(owner, receiver.getName()));
    }
    if (Node.isIdentifier(receiver)) {
      const declaration = receiver.getSymbol()?.getDeclarations().find(Node.isVariableDeclaration);
      if (!owner && this.testingReceiver.hasUnprovenClassWrite(receiver)) {
        return { failure: 'SETUP_BINDING_NOT_PROVEN', targetExpression: receiver.getText() };
      }
      if (declaration?.getTypeNode()) return this.classFromTypeDetails(declaration.getTypeNode()!);
      if (!owner) {
        const resolved = this.testingReceiver.resolve(receiver);
        if (resolved) return { declaration: resolved };
      }
    }
    return {};
  }

  repositoryEntity(receiver: Expression, owner: ClassDeclaration): ClassDeclaration | undefined {
    if (!Node.isPropertyAccessExpression(receiver) || receiver.getExpression().getText() !== 'this') return undefined;
    const type = this.dependencyType(owner, receiver.getName());
    if (!type || !Node.isTypeReference(type)) return undefined;
    const name = type.getTypeName();
    if (!Node.isIdentifier(name)) return undefined;
    const imported = name.getSymbol()?.getDeclarations().find(Node.isImportSpecifier);
    if (!imported || imported.getName() !== 'Repository' ||
      imported.getImportDeclaration().getModuleSpecifierValue() !== 'typeorm') return undefined;
    const argument = type.getTypeArguments()[0];
    return argument && Node.isTypeReference(argument) ? this.resolveClass(argument.getTypeName()) : undefined;
  }

  private indexArtifact(root: string, artifact: ScanArtifact): void {
    const path = resolve(root, artifact.filePath), key = `${path}#${artifact.symbolName}`;
    const matches = this.artifacts.get(key) ?? [];
    matches.push(artifact);
    this.artifacts.set(key, matches);
    if (this.ambiguousIds.has(artifact.stableId)) return;
    if (artifact.type === 'TEST' && !this.testFiles.has(path)) this.testFiles.set(path, artifact);
    if (artifact.type === 'JEST_TEST_CASE') {
      const cases = this.casesByFile.get(path) ?? [];
      cases.push(artifact);
      this.casesByFile.set(path, cases);
    }
  }

  private dependencyType(owner: ClassDeclaration, name: string): TypeNode | undefined {
    const parameter = owner.getConstructors().flatMap(constructor => constructor.getParameters())
      .find(item => item.getName() === name && item.isParameterProperty());
    if (parameter?.getTypeNode()) return parameter.getTypeNode();
    return owner.getProperties().find(property => property.getName() === name)?.getTypeNode();
  }

  private classFromType(type?: TypeNode): ClassDeclaration | undefined {
    return this.classFromTypeDetails(type).declaration;
  }

  private classFromTypeDetails(type?: TypeNode): ClassResolution {
    return type && Node.isTypeReference(type) ? this.resolveClassDetails(type.getTypeName()) : {};
  }
}

function isLocalFactoryCall(call: Expression): boolean {
  if (!Node.isCallExpression(call) || !Node.isIdentifier(call.getExpression())) return false;
  const declarations = call.getExpression().getSymbol()?.getDeclarations() ?? [];
  return declarations.some(declaration => Node.isFunctionDeclaration(declaration) ||
    (Node.isVariableDeclaration(declaration) && !!declaration.getInitializer() &&
      (Node.isArrowFunction(declaration.getInitializer()!) || Node.isFunctionExpression(declaration.getInitializer()!))));
}
