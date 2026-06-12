import * as fs from 'node:fs/promises';
import { relative } from 'node:path';
import { createHash } from 'node:crypto';
import { ANALYZER_VERSION } from '../scanner.types';
import type { ScanInput, ScanResult, ScanArtifact } from '../scanner.types';
import { computeArtifactContentHash } from '../core/content-hasher';
import type { DiagnosticItem } from '../core/diagnostic-collector';

const getHash8 = (str: string) =>
  createHash('sha256').update(str).digest('hex').slice(0, 8);

// HTTP methods supported in Route::
const ROUTE_HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);

export const scanPhpLaravelProject = async (
  input: ScanInput & {
    phpFiles: string[];
    coverage?: import('../scanner.types').ScanCoverage;
  },
): Promise<ScanResult> => {
  const artifacts: ScanArtifact[] = [];
  const diagnostics: DiagnosticItem[] = [];

  for (const file of input.phpFiles) {
    let content = '';
    try {
      content = await fs.readFile(file, 'utf8');
    } catch {
      diagnostics.push({
        code: 'PHP_SCANNER_FILE_PARSE_SKIPPED',
        severity: 'WARN',
        category: 'SCANNER',
        message: `Failed to read file ${file}`,
      });
      continue;
    }

    const filePath = relative(input.fixturePath, file);
    const normalizedFilePath = filePath.split('\\').join('/');
    const relativePathHash = getHash8(normalizedFilePath);

    // ── Diagnostic: Route::resource / Route::apiResource ─────────────────────
    const phpResourcePattern = /Route\s*::\s*(?:resource|apiResource)\s*\(\s*['"]([^'"]+)['"]/g;
    let phpResourceMatch;
    while ((phpResourceMatch = phpResourcePattern.exec(content)) !== null) {
      diagnostics.push({
        code: 'PHP_RESOURCE_ROUTE_UNSUPPORTED',
        severity: 'WARN',
        category: 'SCANNER',
        message: `Route::resource/apiResource is unsupported in ${normalizedFilePath}`,
        payload: {
          language: 'php',
          framework: 'laravel',
          relativePath: normalizedFilePath,
          unsupportedPattern: 'resource',
          candidateTerms: [phpResourceMatch[1]],
        },
      });
    }

    // ── Diagnostic: Route groups with prefix ─────────────────────────────────
    const phpGroupPattern = /Route\s*::\s*group\s*\(\s*\[\s*['"]prefix['"]\s*=>\s*['"]([^'"]+)['"]/g;
    let phpGroupMatch;
    while ((phpGroupMatch = phpGroupPattern.exec(content)) !== null) {
      diagnostics.push({
        code: 'PHP_ROUTE_GROUP_UNSUPPORTED',
        severity: 'WARN',
        category: 'SCANNER',
        message: `Route::group is unsupported in ${normalizedFilePath}`,
        payload: {
          language: 'php',
          framework: 'laravel',
          relativePath: normalizedFilePath,
          unsupportedPattern: 'group',
          candidateTerms: [phpGroupMatch[1]],
        },
      });
    }
    
    // Fallback if we just find group without prefix we can capture
    if (/Route\s*::\s*group\s*\(/.test(content) && !content.match(phpGroupPattern)) {
      diagnostics.push({
        code: 'PHP_ROUTE_GROUP_UNSUPPORTED',
        severity: 'WARN',
        category: 'SCANNER',
        message: `Route::group is unsupported in ${normalizedFilePath}`,
        payload: {
          language: 'php',
          framework: 'laravel',
          relativePath: normalizedFilePath,
          unsupportedPattern: 'group',
        },
      });
    }

    // ── Diagnostic: Middleware usage ──────────────────────────────────────────
    if (/->middleware\s*\(/.test(content)) {
      diagnostics.push({
        code: 'PHP_MIDDLEWARE_BOUNDARY',
        severity: 'WARN',
        category: 'SCANNER',
        message: `Route middleware boundary detected in ${normalizedFilePath}`,
      });
    }

    // ── Diagnostic: Unknown router patterns (Symfony, Slim, CodeIgniter) ──────
    if (/\$router->(?:get|post|put|patch|delete)\s*\(/.test(content) ||
        /\$app->(?:get|post|put|patch|delete)\s*\(/.test(content)) {
      diagnostics.push({
        code: 'PHP_UNKNOWN_ROUTER_PATTERN',
        severity: 'WARN',
        category: 'SCANNER',
        message: `Non-Laravel router pattern detected in ${normalizedFilePath}`,
      });
    }

    // ── Main Route::method extraction ─────────────────────────────────────────
    // Supports:
    //   Route::get('/path', [Controller::class, 'method'])
    //   Route::post('/path', 'Controller@method')   (legacy)
    const routePattern =
      /Route\s*::\s*(get|post|put|patch|delete)\s*\(\s*(['"])(.*?)\2\s*,\s*(.*?)\s*\)/g;
    let routeMatch;

    while ((routeMatch = routePattern.exec(content)) !== null) {
      const method = routeMatch[1].toUpperCase();
      const routePath = routeMatch[3];
      const handlerRaw = routeMatch[4].trim();
      const startIndex = routeMatch.index;

      // Check for dynamic path: non-literal (variable reference)
      // routePath was already extracted as a literal string, so it's safe.
      // Detect if the path contains PHP variable interpolation (shouldn't after regex, but guard)
      if (routePath.includes('$')) {
        diagnostics.push({
          code: 'PHP_DYNAMIC_ROUTE_UNSUPPORTED',
          severity: 'WARN',
          category: 'SCANNER',
          message: `Dynamic route path detected in ${normalizedFilePath}`,
        });
        continue;
      }

      // Extract controller + method from handler expression
      // Array syntax: [SomeController::class, 'methodName']
      // Legacy string: 'SomeController@methodName'
      let controllerSymbol = 'anonymous';
      let methodSymbol = 'anonymous';

      const arrayHandlerMatch = handlerRaw.match(
        /\[\s*([A-Za-z_\\][A-Za-z0-9_\\]*)(?:::\s*class)?\s*,\s*['"]([A-Za-z_]\w*)["']\s*\]/,
      );
      const legacyHandlerMatch = handlerRaw.match(
        /['"]([A-Za-z_\\][A-Za-z0-9_\\]*)@([A-Za-z_]\w*)['"]/,
      );
      const closureMatch = handlerRaw.match(/function\s*\(/);

      if (arrayHandlerMatch) {
        // Extract just the class basename (no namespace)
        controllerSymbol = arrayHandlerMatch[1].split('\\').pop() ?? arrayHandlerMatch[1];
        methodSymbol = arrayHandlerMatch[2];
      } else if (legacyHandlerMatch) {
        controllerSymbol = legacyHandlerMatch[1].split('\\').pop() ?? legacyHandlerMatch[1];
        methodSymbol = legacyHandlerMatch[2];
        // Emit boundary diagnostic for legacy string controllers (cannot resolve class statically)
        diagnostics.push({
          code: 'PHP_CONTROLLER_RESOLUTION_BOUNDARY',
          severity: 'WARN',
          category: 'SCANNER',
          message: `Legacy string controller resolution boundary in ${normalizedFilePath}`,
        });
      } else if (closureMatch) {
        // Closure — still extract route, handler is 'closure'
        controllerSymbol = 'closure';
        methodSymbol = 'closure';
      } else {
        // Cannot determine handler — skip with diagnostic
        diagnostics.push({
          code: 'PHP_CONTROLLER_RESOLUTION_BOUNDARY',
          severity: 'WARN',
          category: 'SCANNER',
          message: `Cannot resolve controller handler in ${normalizedFilePath}`,
        });
        continue;
      }

      const routePathHash = getHash8(routePath);
      const handlerSlug = `${controllerSymbol}_${methodSymbol}`;
      const stableId = `php_http_endpoint__laravel__${method}__route_${routePathHash}__path_${relativePathHash}__handler_${handlerSlug}`;

      const startLine = content.substring(0, startIndex).split('\n').length;
      const excerpt = `// HTTP Endpoint: ${method} ${routePath}\n// Handler: ${controllerSymbol}@${methodSymbol}`;

      artifacts.push({
        stableId,
        type: 'HTTP_ENDPOINT',
        filePath,
        symbolName: `${method} ${routePath} -> ${controllerSymbol}@${methodSymbol}`,
        startLine,
        endLine: startLine + 1,
        excerpt,
        contentHash: computeArtifactContentHash(excerpt),
      });
    }

    // ── Detect non-Route:: dynamic route patterns (variable used as route) ───
    // e.g. Route::get($path, ...) — captured outside main regex
    const dynamicRoutePattern =
      /Route\s*::\s*(?:get|post|put|patch|delete)\s*\(\s*\$[A-Za-z_]\w*\s*,/g;
    if (dynamicRoutePattern.test(content)) {
      diagnostics.push({
        code: 'PHP_DYNAMIC_ROUTE_UNSUPPORTED',
        severity: 'WARN',
        category: 'SCANNER',
        message: `Dynamic (variable) route path in Route:: call in ${normalizedFilePath}`,
      });
    }
  }

  const defaultCoverage: import('../scanner.types').ScanCoverage = {
    status: 'PARTIAL',
    skippedFiles: [],
    skippedSummary: {
      IGNORED_DIRECTORY: 0,
      UNSUPPORTED_EXTENSION: 0,
      GENERATED_FILE: 0,
      VENDOR_FILE: 0,
      BUILD_OUTPUT: 0,
      FILE_TOO_LARGE: 0,
      REPO_FILE_LIMIT_EXCEEDED: 0,
      REPO_SIZE_LIMIT_EXCEEDED: 0,
      SYMLINK_OUTSIDE_ROOT: 0,
      BINARY_FILE: 0,
      READ_ERROR: 0,
      UNSUPPORTED_FRAMEWORK: 0,
      UNSUPPORTED_LANGUAGE: 0,
    },
    limits: { maxFiles: 0, maxFileBytes: 0 },
    limitHits: { fileLimitHit: false, repoSizeLimitHit: false },
  };

  const coverage = input.coverage ?? defaultCoverage;
  coverage.status = 'PARTIAL';

  return {
    analyzerVersion: input.analyzerVersion ?? ANALYZER_VERSION,
    artifacts,
    coverage,
    sourceRoot: input.fixturePath,
    diagnostics,
  };
};
