import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const HTTP_DECORATORS = new Set([
  'Controller', 'UseGuards', 'CurrentUser', 'Req', 'Request', 'Res', 'Response', 'Next',
  'Get', 'Post', 'Put', 'Delete', 'Patch', 'All', 'Options', 'Head', 'Sse',
  'HttpCode', 'Header', 'Redirect', 'Render', 'Param', 'Body', 'Query', 'Headers',
  'HostParam', 'Ip', 'Session', 'UploadedFile', 'UploadedFiles',
]);
const NEST_HTTP_SYMBOLS = new Map<string, ReadonlySet<string>>([
  ['@nestjs/common', new Set([...HTTP_DECORATORS, 'CanActivate', 'ExecutionContext', 'HttpArgumentsHost'])],
  ['@nestjs/core', new Set(['APP_GUARD'])],
]);
const API_GUARDS = new Set(['JwtAuthGuard', 'RolesGuard']);

export type HttpBoundaryViolation = {
  filePath: string;
  line: number;
  column: number;
  kind: 'HTTP_DECORATOR' | 'HTTP_IMPORT' | 'API_IMPORT' | 'API_GUARD';
  symbol: string;
};

export function findHttpBoundaryViolationsInSource(sourceText: string, filePath: string): HttpBoundaryViolation[] {
  const source = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  return new BackendRuntimeBoundaryInspector(source, filePath).inspect();
}

class BackendRuntimeBoundaryInspector {
  private readonly violations: HttpBoundaryViolation[] = [];
  private readonly nestNamespaceBindings = new Map<string, string>();

  constructor(private readonly source: ts.SourceFile, private readonly filePath: string) {}

  inspect(): HttpBoundaryViolation[] {
    this.visit(this.source);
    return this.violations.sort((left, right) => left.line - right.line || left.column - right.column ||
      left.kind.localeCompare(right.kind));
  }

  private add(node: ts.Node, kind: HttpBoundaryViolation['kind'], symbol: string): void {
    const location = this.source.getLineAndCharacterOfPosition(node.getStart(this.source));
    this.violations.push({ filePath: this.filePath, line: location.line + 1,
      column: location.character + 1, kind, symbol });
  }

  private inspectModule(node: ts.Node, specifier: ts.Expression | undefined): void {
    if (!specifier || !ts.isStringLiteralLike(specifier)) return;
    const moduleName = specifier.text.replace(/\\/g, '/');
    if (moduleName === '@ba-helper/api' || moduleName.startsWith('@ba-helper/api/') ||
      /(?:^|\/)apps\/api(?:\/|$)/.test(moduleName)) this.add(node, 'API_IMPORT', moduleName);
    if (isHttpFrameworkModule(moduleName)) this.add(node, 'HTTP_IMPORT', moduleName);
  }

  private addNestImport(node: ts.Node, imported: string, moduleName: string): void {
    if (NEST_HTTP_SYMBOLS.get(moduleName)?.has(imported)) this.add(node, 'HTTP_IMPORT', imported);
  }

  private addNestBindings(binding: ts.BindingName, moduleName: string): void {
    if (!ts.isObjectBindingPattern(binding)) return;
    for (const element of binding.elements) {
      const imported = element.propertyName ?? element.name;
      if (ts.isIdentifier(imported)) this.addNestImport(element, imported.text, moduleName);
    }
  }

  private bindNestNamespace(name: ts.BindingName, moduleName: string): void {
    if (ts.isIdentifier(name) && NEST_HTTP_SYMBOLS.has(moduleName)) {
      this.nestNamespaceBindings.set(name.text, moduleName);
    }
  }

  private unwrapExpression(expression: ts.Expression): ts.Expression {
    let current = expression;
    while (ts.isAwaitExpression(current) || ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) || ts.isTypeAssertionExpression(current) || ts.isNonNullExpression(current)) {
      current = current.expression;
    }
    return current;
  }

  private nestModuleForExpression(expression: ts.Expression): string | undefined {
    const target = this.unwrapExpression(expression);
    if (ts.isIdentifier(target)) return this.nestNamespaceBindings.get(target.text);
    if (!ts.isCallExpression(target) || target.arguments.length === 0) return undefined;
    const isRequire = ts.isIdentifier(target.expression) && target.expression.text === 'require';
    if (!isRequire && target.expression.kind !== ts.SyntaxKind.ImportKeyword) return undefined;
    const specifier = target.arguments[0];
    return ts.isStringLiteralLike(specifier) && NEST_HTTP_SYMBOLS.has(specifier.text)
      ? specifier.text : undefined;
  }

  private inspectDynamicNestBindings(node: ts.CallExpression): void {
    const specifier = node.arguments[0];
    if (node.expression.kind !== ts.SyntaxKind.ImportKeyword || !specifier || !ts.isStringLiteralLike(specifier) ||
      !NEST_HTTP_SYMBOLS.has(specifier.text)) return;
    const moduleName = specifier.text;

    let parent = node.parent;
    while (parent && (ts.isAwaitExpression(parent) || ts.isParenthesizedExpression(parent) ||
      ts.isAsExpression(parent) || ts.isTypeAssertionExpression(parent) || ts.isNonNullExpression(parent))) {
      parent = parent.parent;
    }
    if (parent && ts.isVariableDeclaration(parent) && parent.initializer &&
      this.unwrapExpression(parent.initializer) === node) {
      if (ts.isObjectBindingPattern(parent.name)) this.addNestBindings(parent.name, moduleName);
      else this.bindNestNamespace(parent.name, moduleName);
    }

    const thenAccess = node.parent;
    if (!thenAccess || !ts.isPropertyAccessExpression(thenAccess) || thenAccess.expression !== node ||
      thenAccess.name.text !== 'then' || !ts.isCallExpression(thenAccess.parent) || thenAccess.parent.expression !== thenAccess) {
      return;
    }
    const callback = thenAccess.parent.arguments[0];
    if ((callback && ts.isArrowFunction(callback)) || (callback && ts.isFunctionExpression(callback))) {
      if (callback.parameters[0]) {
        const name = callback.parameters[0].name;
        if (ts.isObjectBindingPattern(name)) this.addNestBindings(name, moduleName);
        else this.bindNestNamespace(name, moduleName);
      }
    }
  }

  private visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node)) {
      this.inspectModule(node, node.moduleSpecifier);
      if (ts.isStringLiteralLike(node.moduleSpecifier) && NEST_HTTP_SYMBOLS.has(node.moduleSpecifier.text)) {
        const moduleName = node.moduleSpecifier.text;
        const bindings = node.importClause?.namedBindings;
        if (bindings && ts.isNamedImports(bindings)) {
          for (const item of bindings.elements) {
            const imported = (item.propertyName ?? item.name).text;
            this.addNestImport(item, imported, moduleName);
          }
        } else if (bindings && ts.isNamespaceImport(bindings)) {
          this.bindNestNamespace(bindings.name, moduleName);
        }
      }
    }
    if (ts.isExportDeclaration(node)) {
      this.inspectModule(node, node.moduleSpecifier);
      if (node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier) &&
        NEST_HTTP_SYMBOLS.has(node.moduleSpecifier.text) && !node.exportClause) {
        this.add(node, 'HTTP_IMPORT', `* from ${node.moduleSpecifier.text}`);
      }
      if (node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier) &&
        NEST_HTTP_SYMBOLS.has(node.moduleSpecifier.text) && node.exportClause && ts.isNamedExports(node.exportClause)) {
        const moduleName = node.moduleSpecifier.text;
        for (const item of node.exportClause.elements) {
          const imported = item.propertyName ?? item.name;
          this.addNestImport(item, imported.text, moduleName);
        }
      }
    }
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression && ts.isStringLiteralLike(node.moduleReference.expression)) {
      const moduleName = node.moduleReference.expression.text;
      this.inspectModule(node, node.moduleReference.expression);
      this.bindNestNamespace(node.name, moduleName);
    }
    if (ts.isCallExpression(node) && node.arguments.length > 0 &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      this.inspectModule(node, node.arguments[0]);
      this.inspectDynamicNestBindings(node);
      if (ts.isIdentifier(node.expression) && node.expression.text === 'require' &&
        ts.isStringLiteralLike(node.arguments[0]) && NEST_HTTP_SYMBOLS.has(node.arguments[0].text) &&
        ts.isVariableDeclaration(node.parent)) {
        const moduleName = node.arguments[0].text;
        if (ts.isObjectBindingPattern(node.parent.name)) this.addNestBindings(node.parent.name, moduleName);
        else this.bindNestNamespace(node.parent.name, moduleName);
      }
    }
    if (ts.isPropertyAccessExpression(node)) {
      const moduleName = this.nestModuleForExpression(node.expression);
      if (moduleName && NEST_HTTP_SYMBOLS.get(moduleName)?.has(node.name.text)) {
        this.add(node, 'HTTP_IMPORT', node.name.text);
      }
    }
    if (ts.isDecorator(node)) {
      const expression = ts.isCallExpression(node.expression) ? node.expression.expression : node.expression;
      const name = ts.isIdentifier(expression) ? expression.text
        : ts.isPropertyAccessExpression(expression) ? expression.name.text : undefined;
      if (name && HTTP_DECORATORS.has(name)) this.add(node, 'HTTP_DECORATOR', name);
    }
    if (ts.isIdentifier(node) && API_GUARDS.has(node.text)) this.add(node, 'API_GUARD', node.text);
    ts.forEachChild(node, child => this.visit(child));
  }
}

function isHttpFrameworkModule(moduleName: string): boolean {
  return moduleName.startsWith('@nestjs/platform-') || moduleName === 'express' || moduleName.startsWith('express/') ||
    moduleName === '@types/express' || moduleName === 'fastify' || moduleName.startsWith('fastify/') ||
    moduleName.startsWith('@fastify/') || moduleName === 'koa' || moduleName.startsWith('koa/') ||
    moduleName === '@types/koa' || moduleName === '@hapi/hapi' || moduleName === 'restify' ||
    moduleName === 'hono' || moduleName.startsWith('hono/');
}

function sourceFiles(root: string): string[] {
  const pending = [root];
  const files: string[] = [];
  while (pending.length > 0) {
    const directory = pending.pop()!;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory() && !['dist', 'node_modules'].includes(entry.name)) pending.push(absolute);
      else if (entry.isFile() && /\.tsx?$/.test(entry.name)) files.push(absolute);
    }
  }
  return files.sort();
}

function main(): void {
  const root = path.resolve(__dirname, '../packages/backend-runtime/src');
  const violations = sourceFiles(root).flatMap(file => findHttpBoundaryViolationsInSource(
    fs.readFileSync(file, 'utf8'), path.relative(root, file).replace(/\\/g, '/')));
  if (violations.length === 0) {
    process.stdout.write('Backend-runtime HTTP boundary: PASS (AST imports, decorators, and guards).\n');
    return;
  }
  for (const item of violations.slice(0, 20)) {
    process.stderr.write(`${item.filePath}:${item.line}:${item.column} ${item.kind} ${item.symbol}\n`);
  }
  process.stderr.write(`Backend-runtime HTTP boundary: ${violations.length} violation(s).\n`);
  process.exitCode = 1;
}

if (require.main === module) main();
