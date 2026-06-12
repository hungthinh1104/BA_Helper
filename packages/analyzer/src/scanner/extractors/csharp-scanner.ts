import * as fs from 'node:fs/promises';
import { relative } from 'node:path';
import { createHash } from 'node:crypto';
import { ANALYZER_VERSION } from '../scanner.types';
import type { ScanInput, ScanResult, ScanArtifact } from '../scanner.types';
import { computeArtifactContentHash } from '../core/content-hasher';
import type { DiagnosticItem } from '../core/diagnostic-collector';

const getHash8 = (str: string) =>
  createHash('sha256').update(str).digest('hex').slice(0, 8);

// HTTP method attribute names supported for controller scanning
const CONTROLLER_HTTP_METHODS = ['HttpGet', 'HttpPost', 'HttpPut', 'HttpPatch', 'HttpDelete'];

// Minimal API MapXxx method names
const MINIMAL_API_MAP_METHODS: Record<string, string> = {
  MapGet: 'GET',
  MapPost: 'POST',
  MapPut: 'PUT',
  MapPatch: 'PATCH',
  MapDelete: 'DELETE',
};

export const scanCSharpProject = async (
  input: ScanInput & {
    csFiles: string[];
    coverage?: import('../scanner.types').ScanCoverage;
  },
): Promise<ScanResult> => {
  const artifacts: ScanArtifact[] = [];
  const diagnostics: DiagnosticItem[] = [];

  for (const file of input.csFiles) {
    let content = '';
    try {
      content = await fs.readFile(file, 'utf8');
    } catch {
      diagnostics.push({
        code: 'CS_SCANNER_FILE_PARSE_SKIPPED',
        severity: 'WARN',
        category: 'SCANNER',
        message: `Failed to read file ${file}`,
      });
      continue;
    }

    const filePath = relative(input.fixturePath, file);
    const normalizedFilePath = filePath.split('\\').join('/');
    const relativePathHash = getHash8(normalizedFilePath);

    // ── Diagnostic: [Route(...)] with framework token substitution ────────────
    // Only [controller] and [action] tokens are unsupported — they require
    // runtime substitution that a lexical scanner cannot resolve.
    // Plain [Route("prefix")] and path-template {id} parameters are valid and
    // are NOT flagged: we cannot reliably distinguish class-level vs method-level
    // without a full parser, so we avoid false positives on plain prefixes.
    const classRouteTokenPattern = /\[Route\s*\(\s*["'][^"']*\[(?:controller|action)\][^"']*["']\s*\)\]/gi;
    if (classRouteTokenPattern.test(content)) {
      diagnostics.push({
        code: 'CS_ROUTE_TOKEN_UNSUPPORTED',
        severity: 'WARN',
        category: 'SCANNER',
        message: `Route token replacement [controller]/[action] not supported in ${normalizedFilePath}`,
        payload: {
          language: 'csharp',
          framework: 'aspnetcore',
          relativePath: normalizedFilePath,
          unsupportedPattern: '[controller]/[action]',
          candidateTerms: [normalizedFilePath.split('/').pop()?.split('.')[0] || ''],
        },
      });
    }

    // ── Diagnostic: Dependency Injection (Constructor DI / [FromServices]) ────
    if (content.match(/\[FromServices\]/) || content.match(/IServiceProvider\s+\w+/)) {
      diagnostics.push({
        code: 'CS_DI_BOUNDARY',
        severity: 'WARN',
        category: 'SCANNER',
        message: `Dependency injection boundary detected in ${normalizedFilePath}`,
      });
    }

    // ── Diagnostic: MapGroup (route grouping, Minimal API) ────────────────────
    const mapGroupPattern = /\.MapGroup\s*\(\s*["']([^"']+)["']\s*\)/g;
    let mapGroupMatch;
    while ((mapGroupMatch = mapGroupPattern.exec(content)) !== null) {
      diagnostics.push({
        code: 'CS_MINIMAL_API_GROUP_UNSUPPORTED',
        severity: 'WARN',
        category: 'SCANNER',
        message: `Minimal API MapGroup is unsupported in ${normalizedFilePath}`,
        payload: {
          language: 'csharp',
          framework: 'aspnetcore',
          relativePath: normalizedFilePath,
          unsupportedPattern: 'MapGroup',
          candidateTerms: [mapGroupMatch[1]],
        },
      });
    }
    
    // Fallback if we just find MapGroup without a literal prefix
    if (/\.MapGroup\s*\(/.test(content) && !content.match(mapGroupPattern)) {
      diagnostics.push({
        code: 'CS_MINIMAL_API_GROUP_UNSUPPORTED',
        severity: 'WARN',
        category: 'SCANNER',
        message: `Minimal API MapGroup is unsupported in ${normalizedFilePath}`,
        payload: {
          language: 'csharp',
          framework: 'aspnetcore',
          relativePath: normalizedFilePath,
          unsupportedPattern: 'MapGroup',
        },
      });
    }

    // ── Controller Attribute Routes ────────────────────────────────────────────
    // Pattern: [HttpGet("path")] (or multi-line with optional params)
    // then: next public method declaration
    const attrRoutePattern = /\[(?:Http(?:Get|Post|Put|Patch|Delete))\s*\(\s*(.*?)\s*\)\]/g;
    let attrMatch;
    while ((attrMatch = attrRoutePattern.exec(content)) !== null) {
      const attrName = attrMatch[0].match(/\[Http(\w+)/i)?.[1]?.toUpperCase() ?? 'UNKNOWN';
      const rawArgs = attrMatch[1];
      const startIndex = attrMatch.index;

      // Extract route path: first string literal arg
      const pathMatch = rawArgs.match(/^\s*["']([^"']*?)["']/);
      if (!pathMatch) {
        // Dynamic or no literal path
        const hasVariable = rawArgs.match(/\b[A-Za-z_]\w*\b/) && !rawArgs.match(/^["']/);
        if (rawArgs.trim().length > 0 && hasVariable) {
          diagnostics.push({
            code: 'CS_DYNAMIC_ROUTE_UNSUPPORTED',
            severity: 'WARN',
            category: 'SCANNER',
            message: `Non-literal route path in controller attribute in ${normalizedFilePath}`,
          });
        }
        // Empty HttpGet() — no path is fine (root), treat as "/" but we can't join prefix
        // Only skip if we have a non-empty non-literal
        if (rawArgs.trim().length > 0) continue;
      }

      const routePath = pathMatch ? pathMatch[1] : '/';
      const routePathHash = getHash8(routePath);

      // Find handler method name: next public method after attribute
      const remainder = content.substring(startIndex + attrMatch[0].length);
      const defMatch = remainder.match(
        /^\s*(?:(?:public|private|protected|internal|static|async|override|virtual)\s+)*\w[\w<>\[\],\s]*\s+(\w+)\s*\(/,
      );
      if (!defMatch) continue;
      const handlerSymbol = defMatch[1];

      const startLine = content.substring(0, startIndex).split('\n').length;
      const blockEnd = remainder.indexOf('}');
      const excerpt = `// HTTP Endpoint: ${attrName} ${routePath}\n// Handler: ${handlerSymbol}`;

      const stableId = `csharp_http_endpoint__aspnetcore__${attrName}__route_${routePathHash}__path_${relativePathHash}__handler_${handlerSymbol}`;

      artifacts.push({
        stableId,
        type: 'HTTP_ENDPOINT',
        filePath,
        symbolName: `${attrName} ${routePath} -> ${handlerSymbol}`,
        startLine,
        endLine: startLine + (blockEnd > -1 ? remainder.substring(0, blockEnd).split('\n').length : 1),
        excerpt,
        contentHash: computeArtifactContentHash(excerpt),
      });
    }

    // ── Minimal API Routes ────────────────────────────────────────────────────
    // Pattern: app.MapGet("/path", handler) or app.MapPost("/path", ...)
    const mapPattern = /\bapp\s*\.\s*(MapGet|MapPost|MapPut|MapPatch|MapDelete)\s*\(\s*(.*?)\s*(?:,|\))/g;
    let mapMatch;
    while ((mapMatch = mapPattern.exec(content)) !== null) {
      const mapMethod = mapMatch[1];
      const method = MINIMAL_API_MAP_METHODS[mapMethod] ?? 'UNKNOWN';
      const rawArgs = mapMatch[2];
      const startIndex = mapMatch.index;

      // Extract literal path string
      const pathMatch = rawArgs.match(/^\s*["']([^"']*?)["']/);
      if (!pathMatch) {
        diagnostics.push({
          code: 'CS_DYNAMIC_ROUTE_UNSUPPORTED',
          severity: 'WARN',
          category: 'SCANNER',
          message: `Non-literal Minimal API route path in ${normalizedFilePath}`,
        });
        continue;
      }

      const routePath = pathMatch[1];
      const routePathHash = getHash8(routePath);

      // Extract handler name from the full match group 2 which captured up to first comma or )
      // The match stops at the comma; the handler is the next non-whitespace token after the comma in context.
      // Re-read from a wider window around the map call.
      const callStartIndex = mapMatch.index;
      const callWindow = content.substring(callStartIndex, callStartIndex + 300);
      const handlerArgMatch = callWindow.match(/(?:MapGet|MapPost|MapPut|MapPatch|MapDelete)\s*\(\s*["'][^"']*["']\s*,\s*([A-Za-z_]\w*)/);
      const handlerSymbol = handlerArgMatch ? handlerArgMatch[1] : 'anonymous';

      const startLine = content.substring(0, startIndex).split('\n').length;
      const excerpt = `// HTTP Endpoint: ${method} ${routePath}\n// Minimal API handler: ${handlerSymbol}`;

      const stableId = `csharp_http_endpoint__aspnetcore__${method}__route_${routePathHash}__path_${relativePathHash}__handler_${handlerSymbol}`;

      artifacts.push({
        stableId,
        type: 'HTTP_ENDPOINT',
        filePath,
        symbolName: `${method} ${routePath} -> ${handlerSymbol}`,
        startLine,
        endLine: startLine + 1,
        excerpt,
        contentHash: computeArtifactContentHash(excerpt),
      });
    }

    // ── Diagnostic: Unknown framework patterns (e.g. WCF, OWIN, SignalR) ─────
    if (/\[WebGet[\s(\]]|\[WebInvoke[\s(\]]|\[OperationContract[\s(\]]/.test(content)) {
      diagnostics.push({
        code: 'CS_UNKNOWN_ROUTER_PATTERN',
        severity: 'WARN',
        category: 'SCANNER',
        message: `Unsupported C# router pattern (WCF/OWIN) detected in ${normalizedFilePath}`,
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
