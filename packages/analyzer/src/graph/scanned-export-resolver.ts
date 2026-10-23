import { Node } from 'ts-morph';
import type { ClassDeclaration, ImportSpecifier, Node as MorphNode, SourceFile } from 'ts-morph';
import type { ModuleResolutionFailure } from './scanned-module-resolver';
import type { ScannedModuleResolver } from './scanned-module-resolver';

const MAX_EXPORT_LOOKUP_KEYS = 4096;
const MAX_EXPORT_LOOKUP_DEPTH = 256;

export type ClassResolution = {
  declaration?: ClassDeclaration;
  failure?: ModuleResolutionFailure | 'AMBIGUOUS_SYMBOL' | 'UNSUPPORTED_NAMESPACE_REEXPORT' |
    'UNSUPPORTED_PATTERN' | 'SETUP_BINDING_NOT_PROVEN' | 'EXPORT_RESOLUTION_LIMIT_EXCEEDED';
  targetExpression?: string;
};

type ExportLookupBudget = { remaining: number; exceeded: boolean };

/** Follows imported and re-exported class symbols without loading unscanned source files. */
export class ScannedExportResolver {
  private readonly exportCache = new Map<string, ClassResolution>();

  constructor(private readonly modules: ScannedModuleResolver) {}

  resolveClass(identifier: MorphNode): ClassResolution {
    if (!Node.isIdentifier(identifier)) return {};
    const declarations = identifier.getSymbol()?.getDeclarations() ?? [];
    const local = declarations.filter(Node.isClassDeclaration);
    if (local.length) return unique(local, identifier.getText());
    const imports = declarations.filter(Node.isImportSpecifier);
    const results = imports.map(specifier => this.resolveImportSpecifier(specifier));
    if (!results.length) return {};
    return combine(results, identifier.getText());
  }

  resolveDefaultImport(moduleSpecifier: string, containingFile: string): ClassResolution {
    const module = this.modules.resolve(moduleSpecifier, containingFile);
    if (!module.sourceFile) return { failure: module.failure, targetExpression: moduleSpecifier };
    return this.exportedClass(module.sourceFile, 'default', new Set(), {
      remaining: MAX_EXPORT_LOOKUP_KEYS, exceeded: false,
    }, 0);
  }

  private resolveImportSpecifier(specifier: ImportSpecifier): ClassResolution {
    const imported = specifier.getName();
    const declaration = specifier.getImportDeclaration();
    const module = this.modules.resolve(declaration.getModuleSpecifierValue(), declaration.getSourceFile().getFilePath());
    if (!module.sourceFile) return { failure: module.failure, targetExpression: declaration.getModuleSpecifierValue() };
    return this.exportedClass(module.sourceFile, imported, new Set(), {
      remaining: MAX_EXPORT_LOOKUP_KEYS, exceeded: false,
    }, 0);
  }

  private exportedClass(source: SourceFile, exportName: string, visited: Set<string>,
    budget: ExportLookupBudget, depth: number): ClassResolution {
    const key = `${source.getFilePath()}#${exportName}`;
    if (budget.exceeded) return { failure: 'EXPORT_RESOLUTION_LIMIT_EXCEEDED', targetExpression: exportName };
    if (visited.has(key)) return {};
    if (depth >= MAX_EXPORT_LOOKUP_DEPTH) {
      budget.exceeded = true;
      return { failure: 'EXPORT_RESOLUTION_LIMIT_EXCEEDED', targetExpression: exportName };
    }
    // Shared visits process each reachable export once, including cyclic and diamond-shaped barrels.
    // Cache only complete root lookups; nested results depend on the traversal context.
    const rootLookup = visited.size === 0;
    if (rootLookup) {
      const cached = this.exportCache.get(key);
      if (cached) return cached;
    }
    if (budget.remaining === 0) {
      budget.exceeded = true;
      return { failure: 'EXPORT_RESOLUTION_LIMIT_EXCEEDED', targetExpression: exportName };
    }
    budget.remaining--;
    visited.add(key);
    const candidates: ClassDeclaration[] = [];
    const failures: ClassResolution[] = [];

    for (const cls of source.getClasses()) {
      if ((exportName === 'default' && cls.isDefaultExport()) ||
        (cls.getName() === exportName && cls.isExported())) candidates.push(cls);
    }
    for (const statement of source.getExportDeclarations()) {
      if (budget.exceeded) break;
      const moduleSpecifier = statement.getModuleSpecifierValue();
      if (!moduleSpecifier) {
        for (const named of statement.getNamedExports()) {
          if ((named.getAliasNode()?.getText() ?? named.getName()) !== exportName) continue;
          const localName = named.getName();
          candidates.push(...source.getClasses().filter(cls => cls.getName() === localName));
        }
        continue;
      }
      const namespace = statement.getNamespaceExport();
      if (namespace) {
        if (namespace.getName() === exportName) failures.push({
          failure: 'UNSUPPORTED_NAMESPACE_REEXPORT', targetExpression: moduleSpecifier,
        });
        continue;
      }
      const namedExports = statement.getNamedExports();
      if (namedExports.length && !namedExports.some(named =>
        (named.getAliasNode()?.getText() ?? named.getName()) === exportName)) continue;
      const target = this.modules.resolve(moduleSpecifier, source.getFilePath());
      if (!target.sourceFile) {
        failures.push({ failure: target.failure, targetExpression: moduleSpecifier });
        continue;
      }
      if (!namedExports.length) {
        const result = this.exportedClass(target.sourceFile, exportName, visited, budget, depth + 1);
        if (result.declaration) candidates.push(result.declaration);
        else failures.push(result);
      } else {
        for (const named of namedExports) {
          if (budget.exceeded) break;
          if ((named.getAliasNode()?.getText() ?? named.getName()) !== exportName) continue;
          const original = named.getName();
          const result = this.exportedClass(target.sourceFile, original, visited, budget, depth + 1);
          if (result.declaration) candidates.push(result.declaration);
          else failures.push(result);
        }
      }
    }
    const distinct = [...new Set(candidates)];
    const result = budget.exceeded ? { failure: 'EXPORT_RESOLUTION_LIMIT_EXCEEDED' as const, targetExpression: exportName }
      : distinct.length > 1 ? { failure: 'AMBIGUOUS_SYMBOL' as const, targetExpression: exportName }
        : distinct.length === 1 ? { declaration: distinct[0] } : failures.find(item => item.failure) ?? {};
    if (rootLookup) this.exportCache.set(key, result);
    return result;
  }
}

function unique(classes: ClassDeclaration[], expression: string): ClassResolution {
  const distinct = [...new Set(classes)];
  return distinct.length === 1 ? { declaration: distinct[0] } : { failure: 'AMBIGUOUS_SYMBOL', targetExpression: expression };
}

function combine(results: ClassResolution[], expression: string): ClassResolution {
  const classes = results.flatMap(result => result.declaration ? [result.declaration] : []);
  const distinct = [...new Set(classes)];
  if (distinct.length > 1) return { failure: 'AMBIGUOUS_SYMBOL', targetExpression: expression };
  if (distinct.length === 1) return { declaration: distinct[0] };
  return results.find(result => result.failure) ?? {};
}
