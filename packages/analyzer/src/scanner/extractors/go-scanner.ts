import * as fs from 'node:fs/promises';
import { relative } from 'node:path';
import { createHash } from 'node:crypto';
import { ANALYZER_VERSION } from '../scanner.types';
import type { ScanInput, ScanResult, ScanArtifact } from '../scanner.types';
import { computeArtifactContentHash } from '../core/content-hasher';

export const scanGoProject = async (
  input: ScanInput & { goFiles: string[], coverage?: import('../scanner.types').ScanCoverage },
): Promise<ScanResult> => {
  const artifacts: ScanArtifact[] = [];
  const diagnostics: import('../core/diagnostic-collector').DiagnosticItem[] = [];

  const getHash8 = (str: string) => createHash('sha256').update(str).digest('hex').slice(0, 8);

  const extractBlock = (text: string, startIndex: number) => {
    // For Go, a simple line-based extraction since we are doing regex instead of full AST.
    // For simplicity, we just extract the single line of the route registration as the block,
    // because we don't have a reliable way to get the full handler body with regex alone if it's external.
    const newLineIndex = text.indexOf('\n', startIndex);
    if (newLineIndex === -1) return text.substring(startIndex);
    return text.substring(startIndex, newLineIndex + 1);
  };

  let totalFilesScanned = 0;

  for (const file of input.goFiles) {
    let content = '';
    try {
      content = await fs.readFile(file, 'utf8');
      totalFilesScanned++;
    } catch {
      diagnostics.push({
        code: 'GO_SCANNER_FILE_PARSE_SKIPPED',
        severity: 'WARN',
        category: 'SCANNER',
        message: `Failed to read file ${file}`,
        payload: {
          language: 'go',
          framework: 'gin',
          relativePath: relative(input.fixturePath, file).split('\\').join('/'),
          candidateTerms: [file.split('/').pop()?.split('.')[0] || ''],
        }
      });
      continue;
    }

    const filePath = relative(input.fixturePath, file);
    const normalizedFilePath = filePath.split('\\').join('/');
    const relativePathHash = getHash8(normalizedFilePath);

    // Detect route groups
    const groupPattern = /\.Group\s*\(\s*["']([^"']+)["']\s*(?:,|\))/g;
    let groupMatch;
    while ((groupMatch = groupPattern.exec(content)) !== null) {
      diagnostics.push({
        code: 'GO_ROUTE_GROUP_UNSUPPORTED',
        severity: 'WARN',
        category: 'SCANNER',
        message: `Gin route groups are unsupported in file ${normalizedFilePath}`,
        payload: {
          language: 'go',
          framework: 'gin',
          relativePath: normalizedFilePath,
          unsupportedPattern: 'Group',
          candidateTerms: [groupMatch[1]],
        }
      });
    }
    
    if (/\.Group\s*\(/.test(content) && !content.match(groupPattern)) {
      diagnostics.push({
        code: 'GO_ROUTE_GROUP_UNSUPPORTED',
        severity: 'WARN',
        category: 'SCANNER',
        message: `Gin route groups are unsupported in file ${normalizedFilePath}`,
        payload: {
          language: 'go',
          framework: 'gin',
          relativePath: normalizedFilePath,
          unsupportedPattern: 'Group',
        }
      });
    }

    // Detect middleware
    if (content.match(/\.Use\s*\(/)) {
      diagnostics.push({ code: 'GO_MIDDLEWARE_CHAIN_UNSUPPORTED', severity: 'WARN', category: 'SCANNER', message: `Middleware chains are unsupported in file ${normalizedFilePath}` });
    }

    // net/http matcher: http.HandleFunc("/path", handler) or mux.HandleFunc(...)
    const netHttpPattern = /(?:http|mux)\.HandleFunc\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/g;
    let match;

    while ((match = netHttpPattern.exec(content)) !== null) {
      const startIndex = match.index;
      let routePath = match[1].trim();
      const handlerStr = match[2].trim();

      if (!routePath.startsWith('"') && !routePath.startsWith('`')) {
        diagnostics.push({ code: 'GO_ROUTE_CONSTANT_RESOLUTION_UNSUPPORTED', severity: 'WARN', category: 'SCANNER', message: `Route constant resolution unsupported in file ${normalizedFilePath}` });
        continue;
      }
      routePath = routePath.replace(/^["`]/, '').replace(/["`]$/, '');

      if (handlerStr.startsWith('func')) {
        diagnostics.push({ code: 'GO_INLINE_HANDLER_UNSTABLE_IDENTITY_UNSUPPORTED', severity: 'WARN', category: 'SCANNER', message: `Inline handler unsupported in file ${normalizedFilePath}` });
        continue;
      }

      if (routePath.includes(':') || routePath.includes('*') || routePath.includes('{')) {
         diagnostics.push({ code: 'GO_DYNAMIC_ROUTE_UNSUPPORTED', severity: 'WARN', category: 'SCANNER', message: `Dynamic route unsupported for ${routePath}` });
         // we might still extract it as unknown, but requirements say out of scope. Let's skip for now to be safe, or just emit diag.
         // Requirements: out of scope, but unsupported pattern must yield diagnostic, not fake artifact.
         continue;
      }

      const method = 'UNKNOWN';
      const framework = 'net/http';
      const routePathHash = getHash8(routePath);
      const handlerSymbol = handlerStr.replace(/[^a-zA-Z0-9_]/g, '');

      // Key: go_http_endpoint__<framework>__<method>__route_<routePathHash>__path_<relativePathHash>__handler_<handlerSymbol>
      const stableId = `go_http_endpoint__${framework.replace('/', '_')}__${method}__route_${routePathHash}__path_${relativePathHash}__handler_${handlerSymbol}`;
      
      const startLine = content.substring(0, startIndex).split('\n').length;
      const canonicalContentForHash = extractBlock(content, startIndex);

      artifacts.push({
        stableId,
        type: 'HTTP_ENDPOINT',
        filePath,
        symbolName: `${method} ${routePath} -> ${handlerSymbol}`,
        startLine,
        endLine: startLine,
        excerpt: `// HTTP Endpoint: ${method} ${routePath}\n// Handler: ${handlerSymbol}`,
        contentHash: computeArtifactContentHash(canonicalContentForHash),
      });
      diagnostics.push({ code: 'GO_HTTP_METHOD_NOT_EXTRACTED', severity: 'WARN', category: 'SCANNER', message: `net/http method cannot be determined for ${routePath}` });
    }

    // Gin matcher: router.GET("/path", handler)
    const ginPattern = /\b(?:\w+)\.(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD|ANY)\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/g;
    while ((match = ginPattern.exec(content)) !== null) {
      const startIndex = match.index;
      const method = match[1];
      let routePath = match[2].trim();
      const handlerArgs = match[3].trim(); // could be multiple args for middleware

      if (!routePath.startsWith('"') && !routePath.startsWith('`')) {
        diagnostics.push({ code: 'GO_ROUTE_CONSTANT_RESOLUTION_UNSUPPORTED', severity: 'WARN', category: 'SCANNER', message: `Route constant resolution unsupported in file ${normalizedFilePath}` });
        continue;
      }
      routePath = routePath.replace(/^["`]/, '').replace(/["`]$/, '');

      if (routePath.includes(':') || routePath.includes('*')) {
         diagnostics.push({ code: 'GO_DYNAMIC_ROUTE_UNSUPPORTED', severity: 'WARN', category: 'SCANNER', message: `Dynamic route unsupported for ${routePath}` });
         continue;
      }

      // Check for middleware in handlerArgs (if it contains commas, it's likely middleware + handler)
      const args = handlerArgs.split(',').map(s => s.trim());
      if (args.length > 1) {
         diagnostics.push({ code: 'GO_MIDDLEWARE_CHAIN_UNSUPPORTED', severity: 'WARN', category: 'SCANNER', message: `Middleware chains are unsupported in file ${normalizedFilePath}` });
         continue;
      }

      const handlerStr = args[0];

      if (handlerStr.startsWith('func')) {
        diagnostics.push({ code: 'GO_INLINE_HANDLER_UNSTABLE_IDENTITY_UNSUPPORTED', severity: 'WARN', category: 'SCANNER', message: `Inline handler unsupported in file ${normalizedFilePath}` });
        continue;
      }

      const framework = 'gin';
      const routePathHash = getHash8(routePath);
      const handlerSymbol = handlerStr.replace(/[^a-zA-Z0-9_]/g, '');

      const stableId = `go_http_endpoint__${framework}__${method}__route_${routePathHash}__path_${relativePathHash}__handler_${handlerSymbol}`;
      
      const startLine = content.substring(0, startIndex).split('\n').length;
      const canonicalContentForHash = extractBlock(content, startIndex);

      artifacts.push({
        stableId,
        type: 'HTTP_ENDPOINT',
        filePath,
        symbolName: `${method} ${routePath} -> ${handlerSymbol}`,
        startLine,
        endLine: startLine,
        excerpt: `// HTTP Endpoint: ${method} ${routePath}\n// Handler: ${handlerSymbol}`,
        contentHash: computeArtifactContentHash(canonicalContentForHash),
      });
    }

    // Detecting unknown router patterns like echo.New() or fiber.New()
    if (content.match(/(?:echo|fiber|chi)\.New\(/)) {
        diagnostics.push({ code: 'GO_UNKNOWN_ROUTER_PATTERN', severity: 'WARN', category: 'SCANNER', message: `Unsupported router detected in file ${normalizedFilePath}` });
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
