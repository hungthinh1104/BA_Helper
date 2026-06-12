import type { Dirent } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type {
  DetectedRepositoryProfile,
  RepositoryProfileArchitectureStyle,
  RepositoryProfileDomain,
  RepositoryProfileFramework,
  RepositoryProfileLanguage,
} from '../scanner.types';

const PROFILE_VERSION = 'repo-profile@0.1.0';
const MAX_ROOTS = 20;
const MAX_MARKERS = 20;
const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  '.turbo',
  '.cache',
  'vendor',
  'tmp',
]);
const TEST_SEGMENTS = new Set(['test', 'tests', '__tests__']);

type DetectParams = {
  rootDir: string;
  languageHint?: RepositoryProfileLanguage;
  frameworkHint?: RepositoryProfileFramework;
  unsupportedReason?: string;
};

const normalizeRelative = (rootDir: string, targetPath: string): string => {
  const relativePath = path.relative(rootDir, targetPath).replace(/\\/g, '/');
  return relativePath === '' ? '.' : relativePath;
};

const pushUnique = (items: string[], value: string): void => {
  if (!value || items.includes(value) || items.length >= MAX_ROOTS) {
    return;
  }
  items.push(value);
};

const getProfileRoot = (rootDir: string, filePath: string, isTestFile: boolean): string => {
  const relativeFile = normalizeRelative(rootDir, filePath);
  const segments = relativeFile.split('/');
  const srcIndex = segments.findIndex((segment) => segment === 'src');
  if (srcIndex >= 0) {
    return segments.slice(0, srcIndex + 1).join('/');
  }

  const testIndex = segments.findIndex((segment) => TEST_SEGMENTS.has(segment));
  if (testIndex >= 0) {
    return segments.slice(0, testIndex + 1).join('/');
  }

  return isTestFile ? path.posix.dirname(relativeFile) || '.' : path.posix.dirname(relativeFile) || '.';
};

const PROFILE_EXTENSIONS = ['.ts', '.tsx', '.java', '.go', '.py', '.cs', '.php', '.rb'];

const collectProfileFiles = async (rootDir: string): Promise<string[]> => {
  const files: string[] = [];
  const queue: string[] = [rootDir];

  while (queue.length > 0) {
    const currentDir = queue.shift()!;
    let entries: Dirent[];
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) {
          queue.push(fullPath);
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (PROFILE_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) {
        files.push(fullPath);
      }
    }
  }

  return files.sort();
};

const detectArchitectureStyle = (
  rootDir: string,
  sourceFiles: string[],
): {
  architectureStyle: RepositoryProfileArchitectureStyle;
  detectedMarkers: string[];
  confidence: number;
} => {
  const lowerPaths = sourceFiles.map((filePath) => normalizeRelative(rootDir, filePath).toLowerCase());
  const sourcePaths = lowerPaths.filter((filePath) => !filePath.includes('.spec.') && !filePath.includes('.test.'));
  const hasLayeredRoots = ['controllers/', 'services/', 'repositories/'].filter((segment) =>
    sourcePaths.some((filePath) => filePath.startsWith(segment) || filePath.includes(`/${segment}`)),
  );
  const srcCapabilityBuckets = new Set(
    sourcePaths
      .filter((filePath) => filePath.startsWith('src/'))
      .map((filePath) => filePath.split('/')[1])
      .filter((segment) => segment && !['common', 'shared', 'config', 'types'].includes(segment)),
  );

  if (srcCapabilityBuckets.size >= 2) {
    return {
      architectureStyle: 'MODULAR_MONOLITH',
      detectedMarkers: Array.from(srcCapabilityBuckets).slice(0, MAX_MARKERS),
      confidence: 0.8,
    };
  }

  if (hasLayeredRoots.length >= 2) {
    return {
      architectureStyle: 'LAYERED',
      detectedMarkers: hasLayeredRoots,
      confidence: 0.7,
    };
  }

  return {
    architectureStyle: 'UNKNOWN',
    detectedMarkers: [],
    confidence: 0.3,
  };
};

const DOMAIN_KEYWORDS: Array<{
  domain: RepositoryProfileDomain;
  terms: string[];
}> = [
  { domain: 'BOOKING', terms: ['booking', 'reservation', 'cancel-booking'] },
  { domain: 'PAYMENT', terms: ['payment', 'wallet', 'ledger', 'settlement'] },
  { domain: 'REFUND', terms: ['refund', 'refunds', 'chargeback'] },
  { domain: 'NOTIFICATION', terms: ['notification', 'notify', 'mailer', 'email'] },
  { domain: 'INVENTORY', terms: ['inventory', 'stock', 'warehouse'] },
];

const detectDomain = async (
  rootDir: string,
  sourceFiles: string[],
): Promise<{
  domain: RepositoryProfileDomain;
  detectedMarkers: string[];
  confidence: number;
}> => {
  const keywordMatches = new Map<RepositoryProfileDomain, Set<string>>();

  for (const filePath of sourceFiles.slice(0, 200)) {
    const relativeFile = normalizeRelative(rootDir, filePath).toLowerCase();
    for (const candidate of DOMAIN_KEYWORDS) {
      for (const term of candidate.terms) {
        if (relativeFile.includes(term)) {
          if (!keywordMatches.has(candidate.domain)) {
            keywordMatches.set(candidate.domain, new Set());
          }
          keywordMatches.get(candidate.domain)!.add(term);
        }
      }
    }
  }

  const ranked = Array.from(keywordMatches.entries()).sort((a, b) => b[1].size - a[1].size);
  if (ranked.length === 0) {
    return { domain: 'UNKNOWN', detectedMarkers: [], confidence: 0.2 };
  }

  const [topDomain, topMatches] = ranked[0];
  const nextCount = ranked[1]?.[1].size ?? 0;
  if (topMatches.size < 2 || topMatches.size === nextCount) {
    return {
      domain: 'UNKNOWN',
      detectedMarkers: Array.from(topMatches).slice(0, MAX_MARKERS),
      confidence: 0.35,
    };
  }

  return {
    domain: topDomain,
    detectedMarkers: Array.from(topMatches).slice(0, MAX_MARKERS),
    confidence: Math.min(0.9, 0.5 + topMatches.size * 0.1),
  };
};

const inferLanguageFromFiles = (sourceFiles: string[]): RepositoryProfileLanguage => {
  const extensions = new Set(sourceFiles.map((filePath) => path.extname(filePath).toLowerCase()));
  if (extensions.has('.ts') || extensions.has('.tsx')) return 'TYPESCRIPT';
  if (extensions.has('.java')) return 'JAVA';
  if (extensions.has('.go')) return 'GO';
  if (extensions.has('.py')) return 'PYTHON';
  if (extensions.has('.cs')) return 'CSHARP';
  if (extensions.has('.php')) return 'PHP';
  if (extensions.has('.rb')) return 'RUBY';
  return 'UNKNOWN';
};

const buildDiagnostics = (params: {
  framework: RepositoryProfileFramework;
  architectureMarkers: string[];
  architectureConfidence: number;
  domainMarkers: string[];
  domainConfidence: number;
  unsupportedReason?: string;
}) => {
  const detectedMarkers = Array.from(
    new Set([
      params.framework,
      ...params.architectureMarkers,
      ...params.domainMarkers,
    ]),
  ).slice(0, MAX_MARKERS);

  const confidence = Number(
    Math.max(params.architectureConfidence, params.domainConfidence, params.framework === 'NESTJS' ? 0.9 : 0.5).toFixed(2),
  );

  const diagnostics: NonNullable<DetectedRepositoryProfile['diagnostics']> = {
    detectedMarkers,
    confidence,
  };

  if (params.unsupportedReason) {
    diagnostics.unsupportedReason = params.unsupportedReason;
  }

  return diagnostics;
};

export class RepositoryProfileDetector {
  static async detect(params: DetectParams): Promise<DetectedRepositoryProfile> {
    const sourceFiles = await collectProfileFiles(params.rootDir);
    const language: RepositoryProfileLanguage = params.languageHint ?? inferLanguageFromFiles(sourceFiles);
    const framework = params.frameworkHint ?? (language === 'TYPESCRIPT' ? 'GENERIC_TYPESCRIPT' : 'UNKNOWN');

    const sourceRoots: string[] = [];
    const testRoots: string[] = [];

    for (const filePath of sourceFiles) {
      const relativeFile = normalizeRelative(params.rootDir, filePath).toLowerCase();
      const isTestFile =
        relativeFile.includes('.spec.') ||
        relativeFile.includes('.test.') ||
        relativeFile.includes('_test.') ||
        relativeFile.split('/').some((segment) => TEST_SEGMENTS.has(segment));
      const root = getProfileRoot(params.rootDir, filePath, isTestFile);
      if (isTestFile) {
        pushUnique(testRoots, root);
      } else {
        pushUnique(sourceRoots, root);
      }
    }

    const architecture = detectArchitectureStyle(params.rootDir, sourceFiles);
    const domain = await detectDomain(params.rootDir, sourceFiles);

    return {
      domain: domain.domain,
      language,
      framework,
      architectureStyle: architecture.architectureStyle,
      sourceRoots,
      testRoots,
      diagnostics: buildDiagnostics({
        framework,
        architectureMarkers: architecture.detectedMarkers,
        architectureConfidence: architecture.confidence,
        domainMarkers: domain.detectedMarkers,
        domainConfidence: domain.confidence,
        unsupportedReason: params.unsupportedReason,
      }),
      profileVersion: PROFILE_VERSION,
    };
  }
}
