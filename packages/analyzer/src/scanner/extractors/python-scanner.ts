import * as fs from 'node:fs/promises';
import { relative } from 'node:path';
import { createHash } from 'node:crypto';
import { ANALYZER_VERSION } from '../scanner.types';
import type { ScanInput, ScanResult, ScanArtifact, ScanCoverage } from '../scanner.types';
import type { DiagnosticItem } from '../core/diagnostic-collector';
import { computeArtifactContentHash } from '../core/content-hasher';

export const scanPythonProject = async (
  input: ScanInput & { pyFiles: string[], coverage?: ScanCoverage },
): Promise<ScanResult> => {
  const artifacts: ScanArtifact[] = [];
  const diagnostics: DiagnosticItem[] = [];

  const getHash8 = (str: string) => createHash('sha256').update(str).digest('hex').slice(0, 8);

  const extractBlock = (text: string, startIndex: number) => {
    // Basic extraction: grab the decorator line and the next line (def ...)
    const defIndex = text.indexOf('def ', startIndex);
    if (defIndex === -1) return text.substring(startIndex, text.indexOf('\n', startIndex) + 1);
    const endOfDefLine = text.indexOf('\n', defIndex);
    return text.substring(startIndex, endOfDefLine === -1 ? text.length : endOfDefLine + 1);
  };

  let totalFilesScanned = 0;

  for (const file of input.pyFiles) {
    let content = '';
    try {
      content = await fs.readFile(file, 'utf8');
      totalFilesScanned++;
    } catch {
      diagnostics.push({
        code: 'PY_SCANNER_FILE_PARSE_SKIPPED',
        severity: 'WARN',
        category: 'SCANNER',
        message: `Failed to read file ${file}`,
        payload: {
          language: 'python',
          framework: 'fastapi',
          relativePath: relative(input.fixturePath, file).split('\\').join('/'),
          candidateTerms: [file.split('/').pop()?.split('.')[0] || ''],
        }
      });
      continue;
    }

    const filePath = relative(input.fixturePath, file);
    const normalizedFilePath = filePath.split('\\').join('/');
    const relativePathHash = getHash8(normalizedFilePath);

    // Unknown routers
    if (content.match(/\bFlask\s*\(/) || content.match(/\bdjango\./)) {
      diagnostics.push({ code: 'PY_UNKNOWN_ROUTER_PATTERN', severity: 'WARN', category: 'SCANNER', message: `Unsupported router detected in file ${normalizedFilePath}` });
    }

    // Dependency Injection boundary
    if (content.match(/\bDepends\s*\(/)) {
      diagnostics.push({ code: 'PY_DEPENDENCY_INJECTION_BOUNDARY', severity: 'WARN', category: 'SCANNER', message: `FastAPI Depends injection boundary detected in file ${normalizedFilePath}` });
    }

    // Check for router prefix
    let hasRouterPrefix = false;
    const prefixMatch = content.match(/\bAPIRouter\s*\([^)]*prefix\s*=\s*['"]([^'"]+)['"]/);
    if (prefixMatch) {
      hasRouterPrefix = true;
      diagnostics.push({
        code: 'PY_ROUTER_PREFIX_UNSUPPORTED',
        severity: 'WARN',
        category: 'SCANNER',
        message: `APIRouter prefix is unsupported in file ${normalizedFilePath}`,
        payload: {
          language: 'python',
          framework: 'fastapi',
          relativePath: normalizedFilePath,
          unsupportedPattern: 'APIRouter',
          candidateTerms: [prefixMatch[1]],
        }
      });
    } else if (content.match(/\bAPIRouter\s*\([^)]*prefix\s*=/)) {
      hasRouterPrefix = true;
      diagnostics.push({ code: 'PY_ROUTER_PREFIX_UNSUPPORTED', severity: 'WARN', category: 'SCANNER', message: `APIRouter prefix is unsupported in file ${normalizedFilePath}` });
    }

    // Match @app.get("/path") or @router.post("/path")
    // Note: We need to handle single or double quotes, but NOT f-strings
    // Non-literal paths: if it starts with f" or f' or has variables or +
    const routePattern = /@([a-zA-Z0-9_]+)\.(get|post|put|patch|delete|options|head)\s*\(\s*(.*)\s*\)/g;
    let match;

    while ((match = routePattern.exec(content)) !== null) {
      const startIndex = match.index;
      const instanceName = match[1]; // 'app' or 'router'
      const method = match[2].toUpperCase();
      const rawArgs = match[3];

      // If it's a router and we have a prefix, skip extraction but we already emitted diagnostic
      if (instanceName !== 'app' && hasRouterPrefix) {
        // user requirement: "@router.post only when no APIRouter prefix is detected"
        continue;
      }

      // Extract the path string
      // Let's find the first argument. It should be a string literal.
      const firstArgMatch = rawArgs.match(/^\s*(f?["'])(.*?)\1/);
      
      if (!firstArgMatch) {
        // Could be a variable or concatenation
        diagnostics.push({ code: 'PY_DYNAMIC_ROUTE_UNSUPPORTED', severity: 'WARN', category: 'SCANNER', message: `Non-literal route path detected in file ${normalizedFilePath}` });
        continue;
      }

      const quoteType = firstArgMatch[1];
      const routePath = firstArgMatch[2];

      if (quoteType.startsWith('f') || rawArgs.split(',')[0].includes('+')) {
        diagnostics.push({ code: 'PY_DYNAMIC_ROUTE_UNSUPPORTED', severity: 'WARN', category: 'SCANNER', message: `f-string or concatenated route path detected in file ${normalizedFilePath}` });
        continue;
      }

      // We need to find the handler function name. The next non-empty line usually starts with 'def ' or 'async def '
      const remainder = content.substring(startIndex + match[0].length);
      const defMatch = remainder.match(/^\s*(?:async\s+)?def\s+([a-zA-Z0-9_]+)\s*\(/);
      
      if (!defMatch) {
         continue;
      }

      const handlerSymbol = defMatch[1];

      const framework = 'fastapi';
      const routePathHash = getHash8(routePath);

      // Key: python_http_endpoint__<framework>__<method>__route_<routePathHash>__path_<relativePathHash>__handler_<handlerSymbol>
      const stableId = `python_http_endpoint__${framework}__${method}__route_${routePathHash}__path_${relativePathHash}__handler_${handlerSymbol}`;
      
      const startLine = content.substring(0, startIndex).split('\n').length;
      const canonicalContentForHash = extractBlock(content, startIndex);

      artifacts.push({
        stableId,
        type: 'HTTP_ENDPOINT',
        filePath,
        symbolName: `${method} ${routePath} -> ${handlerSymbol}`,
        startLine,
        endLine: startLine + canonicalContentForHash.split('\n').length - 1,
        excerpt: `// HTTP Endpoint: ${method} ${routePath}\n// Handler: ${handlerSymbol}`,
        contentHash: computeArtifactContentHash(canonicalContentForHash),
      });
    }
  }

  const defaultCoverage: ScanCoverage = {
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
    limitHits: { fileLimitHit: false, repoSizeLimitHit: false }
  };

  const coverage = input.coverage || defaultCoverage;
  coverage.status = 'PARTIAL';

  return {
    analyzerVersion: input.analyzerVersion || ANALYZER_VERSION,
    artifacts,
    coverage,
    sourceRoot: input.fixturePath,
    diagnostics,
  };
};
