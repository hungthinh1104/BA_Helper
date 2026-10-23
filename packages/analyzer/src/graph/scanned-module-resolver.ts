import { basename, isAbsolute, relative, resolve } from 'node:path';
import { ts } from 'ts-morph';
import type { SourceFile } from 'ts-morph';

export type ModuleResolutionFailure = 'PATH_ALIAS_RESOLUTION_FAILED' | 'IMPORT_RESOLUTION_FAILED' | 'OUT_OF_SCOPE_TARGET';
export type ModuleResolutionResult = { sourceFile?: SourceFile; failure?: ModuleResolutionFailure };

/** Uses TypeScript path rules while allowing graph targets only from the accepted scan file set. */
export class ScannedModuleResolver {
  private readonly options: ts.CompilerOptions;
  private readonly cache = new Map<string, ModuleResolutionResult>();
  private readonly selected = new Map<string, SourceFile>();
  private readonly directories = new Set<string>();
  private readonly caseSensitive = ts.sys.useCaseSensitiveFileNames;
  private readonly host: ts.ModuleResolutionHost;

  constructor(private readonly root: string, sources: ReadonlyMap<string, SourceFile>) {
    this.options = readCompilerOptions(root);
    for (const [path, source] of sources) {
      const normalized = resolve(path);
      this.selected.set(this.pathKey(normalized), source);
      for (let directory = resolve(normalized, '..');; directory = resolve(directory, '..')) {
        this.directories.add(this.pathKey(directory));
        if (directory === root) break;
      }
    }
    this.host = {
      fileExists: path => this.selected.has(this.pathKey(path)),
      readFile: path => this.selected.get(this.pathKey(path))?.getFullText(),
      directoryExists: path => this.directories.has(this.pathKey(path)),
      getCurrentDirectory: () => root,
      getDirectories: path => [...this.directories]
        .filter(directory => this.pathKey(resolve(directory, '..')) === this.pathKey(path))
        .map(directory => basename(directory)),
      realpath: path => resolve(path),
      useCaseSensitiveFileNames: this.caseSensitive,
    };
  }

  resolve(specifier: string, containingFile: string): ModuleResolutionResult {
    const key = `${resolve(containingFile)}\u0000${specifier}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const resolution = ts.resolveModuleName(specifier, containingFile, this.options, this.host).resolvedModule;
    const source = resolution && this.selected.get(this.pathKey(resolution.resolvedFileName));
    if (source) return this.remember(key, { sourceFile: source });

    // The fallback is diagnostic-only: it identifies an excluded in-repository target,
    // but its source is never loaded or used to create an edge.
    const candidate = ts.resolveModuleName(specifier, containingFile, this.options, ts.sys).resolvedModule;
    if (candidate && this.isWithinRoot(candidate.resolvedFileName)) {
      return this.remember(key, { failure: 'OUT_OF_SCOPE_TARGET' });
    }
    const failure = this.isPathAlias(specifier) ? 'PATH_ALIAS_RESOLUTION_FAILED' : 'IMPORT_RESOLUTION_FAILED';
    return this.remember(key, { failure });
  }

  private remember(key: string, result: ModuleResolutionResult): ModuleResolutionResult {
    this.cache.set(key, result);
    return result;
  }

  private pathKey(path: string): string {
    const absolute = resolve(path);
    return this.caseSensitive ? absolute : absolute.toLowerCase();
  }

  private isWithinRoot(path: string): boolean {
    const relativePath = relative(this.root, resolve(path));
    return !isAbsolute(relativePath) && relativePath !== '..' && !relativePath.startsWith(`..\\`) &&
      !relativePath.startsWith('../');
  }

  private isPathAlias(specifier: string): boolean {
    const patterns = Object.keys(this.options.paths ?? {});
    return patterns.some(pattern => {
      const wildcard = pattern.indexOf('*');
      if (wildcard < 0) return pattern === specifier;
      const prefix = pattern.slice(0, wildcard), suffix = pattern.slice(wildcard + 1);
      return specifier.startsWith(prefix) && specifier.endsWith(suffix) && specifier.length >= prefix.length + suffix.length;
    });
  }
}

function readCompilerOptions(root: string): ts.CompilerOptions {
  const configPath = resolve(root, 'tsconfig.json');
  const parsed = ts.getParsedCommandLineOfConfigFile(configPath, {}, {
    ...ts.sys,
    readDirectory: () => [],
    onUnRecoverableConfigFileDiagnostic: () => undefined,
  });
  return {
    ...(parsed?.options ?? {}),
    baseUrl: parsed?.options.baseUrl ?? root,
    pathsBasePath: parsed?.options.pathsBasePath ?? root,
    moduleResolution: parsed?.options.moduleResolution ?? ts.ModuleResolutionKind.Node10,
    noResolve: false,
  };
}
