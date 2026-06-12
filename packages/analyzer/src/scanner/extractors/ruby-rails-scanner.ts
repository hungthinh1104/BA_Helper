import * as fs from 'node:fs/promises';
import { relative } from 'node:path';
import { createHash } from 'node:crypto';
import { ANALYZER_VERSION } from '../scanner.types';
import type { ScanInput, ScanResult, ScanArtifact } from '../scanner.types';
import { computeArtifactContentHash } from '../core/content-hasher';
import type { DiagnosticItem } from '../core/diagnostic-collector';

const getHash8 = (str: string) =>
  createHash('sha256').update(str).digest('hex').slice(0, 8);

export const scanRubyRailsProject = async (
  input: ScanInput & {
    rbFiles: string[];
    coverage?: import('../scanner.types').ScanCoverage;
  },
): Promise<ScanResult> => {
  const artifacts: ScanArtifact[] = [];
  const diagnostics: DiagnosticItem[] = [];

  for (const file of input.rbFiles) {
    let content = '';
    try {
      content = await fs.readFile(file, 'utf8');
    } catch {
      diagnostics.push({
        code: 'RB_SCANNER_FILE_PARSE_SKIPPED',
        severity: 'WARN',
        category: 'SCANNER',
        message: `Failed to read file ${file}`,
      });
      continue;
    }

    const filePath = relative(input.fixturePath, file);
    const normalizedFilePath = filePath.split('\\').join('/');
    const relativePathHash = getHash8(normalizedFilePath);

    // ── Diagnostic: resources / resource ───────────────────────────────────────
    const resourcePattern = /\b(?:resources|resource)\s+[:'"](\w+)/g;
    let resourceMatch;
    while ((resourceMatch = resourcePattern.exec(content)) !== null) {
      diagnostics.push({
        code: 'RB_RESOURCE_ROUTE_UNSUPPORTED',
        severity: 'WARN',
        category: 'SCANNER',
        message: `Rails resource route unsupported in ${normalizedFilePath}`,
        payload: {
          language: 'ruby',
          framework: 'rails',
          relativePath: normalizedFilePath,
          unsupportedPattern: 'resources',
          candidateTerms: [resourceMatch[1]],
        },
      });
    }

    // ── Diagnostic: namespace blocks ───────────────────────────────────────────
    const namespacePattern = /\bnamespace\s+[:'"](\w+)\s+do\b/g;
    let namespaceMatch;
    while ((namespaceMatch = namespacePattern.exec(content)) !== null) {
      diagnostics.push({
        code: 'RB_NAMESPACE_ROUTE_UNSUPPORTED',
        severity: 'WARN',
        category: 'SCANNER',
        message: `Rails namespace block unsupported in ${normalizedFilePath}`,
        payload: {
          language: 'ruby',
          framework: 'rails',
          relativePath: normalizedFilePath,
          unsupportedPattern: 'namespace',
          candidateTerms: [namespaceMatch[1]],
        },
      });
    }

    // ── Diagnostic: scope blocks ───────────────────────────────────────────────
    const scopePattern = /\bscope\s+(?:[:'"](\w+)|\(.*?\)|module:.*?)\s+do\b/g;
    let scopeMatch;
    while ((scopeMatch = scopePattern.exec(content)) !== null) {
      const term = scopeMatch[1];
      diagnostics.push({
        code: 'RB_SCOPE_ROUTE_UNSUPPORTED',
        severity: 'WARN',
        category: 'SCANNER',
        message: `Rails scope/module block unsupported in ${normalizedFilePath}`,
        payload: {
          language: 'ruby',
          framework: 'rails',
          relativePath: normalizedFilePath,
          unsupportedPattern: 'scope',
          candidateTerms: term ? [term] : [],
        },
      });
    }

    // ── Diagnostic: mounted engines ────────────────────────────────────────────
    if (/\bmount\s+[A-Z]\w*::Engine/.test(content) || /\bmount\s+/.test(content)) {
      diagnostics.push({
        code: 'RB_MOUNTED_ENGINE_UNSUPPORTED',
        severity: 'WARN',
        category: 'SCANNER',
        message: `Rails mounted engine unsupported in ${normalizedFilePath}`,
      });
    }

    // ── Diagnostic: unknown router (Sinatra / Hanami style direct methods) ─────
    // Sinatra style gets inside classes or blocks that aren't Rails routes
    // For now we'll just guard against pure Sinatra class wrappers if it's not a routes.rb file
    // But since we just scan .rb files, let's keep it simple: if there's no Rails.application.routes.draw,
    // and we find get/post blocks, it might be Sinatra, but we don't emit a diagnostic unless we are sure.
    // However, if we see Sinatra typical class inheritance:
    if (/< Sinatra::Base/.test(content)) {
      diagnostics.push({
        code: 'RB_UNKNOWN_ROUTER_PATTERN',
        severity: 'WARN',
        category: 'SCANNER',
        message: `Non-Rails router pattern (Sinatra) detected in ${normalizedFilePath}`,
      });
    }

    // ── Main get/post/put/patch/delete extraction ──────────────────────────────
    // Supports:
    // get "/path", to: "controller#action"
    // get "/path" => "controller#action" (legacy hash)
    // We only want to match literal string paths.
    // e.g., get "/refunds/:id", to: "refunds#show"
    const routePattern =
      /^\s*(get|post|put|patch|delete)\s+(['"])(.*?)\2\s*(?:(?:,\s*to:\s*)|(?:=>\s*))(['"])([^#'"]+#[^#'"]+)\4/gm;
    let routeMatch;

    while ((routeMatch = routePattern.exec(content)) !== null) {
      const method = routeMatch[1].toUpperCase();
      const routePath = routeMatch[3];
      const handlerStr = routeMatch[5]; // "controller#action"
      const startIndex = routeMatch.index;

      // Check for dynamic paths: #{var} interpolation inside double quotes
      if (routeMatch[2] === '"' && routePath.includes('#{')) {
        diagnostics.push({
          code: 'RB_DYNAMIC_ROUTE_UNSUPPORTED',
          severity: 'WARN',
          category: 'SCANNER',
          message: `Dynamic route path interpolation detected in ${normalizedFilePath}`,
        });
        continue;
      }

      // If the path contains variable tokens like % or just standard variables without quotes,
      // the regex `(['"])(.*?)\2` wouldn't match it anyway. So we're safe.

      const routePathHash = getHash8(routePath);
      const handlerSlug = handlerStr.replace('#', '_');
      const stableId = `ruby_http_endpoint__rails__${method}__route_${routePathHash}__path_${relativePathHash}__handler_${handlerSlug}`;

      const startLine = content.substring(0, startIndex).split('\n').length;
      const excerpt = `# HTTP Endpoint: ${method} ${routePath}\n# Handler: ${handlerStr}`;

      const isLegacy = routeMatch[0].includes('=>');
      if (isLegacy) {
        diagnostics.push({
          code: 'RB_CONTROLLER_RESOLUTION_BOUNDARY',
          severity: 'WARN',
          category: 'SCANNER',
          message: `Legacy hash rocket controller routing boundary in ${normalizedFilePath}`,
        });
      }

      artifacts.push({
        stableId,
        type: 'HTTP_ENDPOINT',
        filePath,
        symbolName: `${method} ${routePath} -> ${handlerStr}`,
        startLine,
        endLine: startLine + 1,
        excerpt,
        contentHash: computeArtifactContentHash(excerpt),
      });
    }

    // ── Detect dynamic non-literal route patterns ───
    // e.g. get my_variable, to: ...
    const dynamicRoutePattern = /^\s*(?:get|post|put|patch|delete)\s+(?!['"])[a-zA-Z_]\w*\s*,/gm;
    if (dynamicRoutePattern.test(content)) {
      diagnostics.push({
        code: 'RB_DYNAMIC_ROUTE_UNSUPPORTED',
        severity: 'WARN',
        category: 'SCANNER',
        message: `Dynamic (variable) route path in route call in ${normalizedFilePath}`,
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
