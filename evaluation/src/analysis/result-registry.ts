import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { readJsonFile } from '../../io';

export type RankedResultEntry = {
  rank: number;
  artifactKey: string;
  filePath: string;
  artifactType: string;
  score?: number;
};

export type NormalizedResultCase = {
  caseId: string;
  repo: string;
  requirementText?: string;
  groundTruthFiles: string[];
  rankedResults: RankedResultEntry[];
};

export type NormalizedResultMethod = {
  sourceFile: string;
  method: string;
  generatedAt: string;
  topK: number;
  cases: NormalizedResultCase[];
};

export type ResultRegistry = {
  methods: NormalizedResultMethod[];
  warnings: string[];
};

type KeywordBaselineResultFile = {
  generatedAt: string;
  method: string;
  topK: number;
  cases: Array<{
    caseId: string;
    repo: string;
    requirementText?: string;
    groundTruthFiles: string[];
    results: Array<{
      rank: number;
      artifactKey: string;
      filePath: string;
      artifactType: string;
      score?: number;
    }>;
  }>;
};

type Bm25BaselineResultFile = KeywordBaselineResultFile;

const OPTIONAL_EXCLUDED_FILES = [
  'rag-samples.current-hybrid.v0.json',
  'vector-baseline.v0.json',
];

const NON_BENCHMARK_FILES = new Set([
  'rag-samples.v0.json',
  'results.v0.json',
  'metrics.v0.json',
  'failure-analysis.v0.json',
]);

function loadKeywordBaselineResult(resultsDir: string): NormalizedResultMethod {
  const sourceFile = 'keyword-baseline.v0.json';
  const inputPath = join(resultsDir, sourceFile);
  const parsed = readJsonFile<KeywordBaselineResultFile>(inputPath);

  return {
    sourceFile,
    method: parsed.method,
    generatedAt: parsed.generatedAt,
    topK: parsed.topK,
    cases: parsed.cases.map((caseResult) => ({
      caseId: caseResult.caseId,
      repo: caseResult.repo,
      requirementText: caseResult.requirementText,
      groundTruthFiles: caseResult.groundTruthFiles,
      rankedResults: caseResult.results.map((result) => ({
        rank: result.rank,
        artifactKey: result.artifactKey,
        filePath: result.filePath,
        artifactType: result.artifactType,
        score: result.score,
      })),
    })),
  };
}

function loadBm25BaselineResult(resultsDir: string): NormalizedResultMethod {
  const sourceFile = 'bm25-baseline.v0.json';
  const inputPath = join(resultsDir, sourceFile);
  const parsed = readJsonFile<Bm25BaselineResultFile>(inputPath);

  return {
    sourceFile,
    method: parsed.method,
    generatedAt: parsed.generatedAt,
    topK: parsed.topK,
    cases: parsed.cases.map((caseResult) => ({
      caseId: caseResult.caseId,
      repo: caseResult.repo,
      requirementText: caseResult.requirementText,
      groundTruthFiles: caseResult.groundTruthFiles,
      rankedResults: caseResult.results.map((result) => ({
        rank: result.rank,
        artifactKey: result.artifactKey,
        filePath: result.filePath,
        artifactType: result.artifactType,
        score: result.score,
      })),
    })),
  };
}

export function loadResultRegistry(resultsDir: string): ResultRegistry {
  const warnings: string[] = [];
  const availableFiles = new Set(readdirSync(resultsDir));
  const methods: NormalizedResultMethod[] = [];

  if (availableFiles.has('keyword-baseline.v0.json')) {
    methods.push(loadKeywordBaselineResult(resultsDir));
    warnings.push('Included benchmark result: keyword-baseline.v0.json');
  } else {
    warnings.push('Missing benchmark result: keyword-baseline.v0.json');
  }

  if (availableFiles.has('bm25-baseline.v0.json')) {
    methods.push(loadBm25BaselineResult(resultsDir));
    warnings.push('Included benchmark result: bm25-baseline.v0.json');
  } else {
    warnings.push('Missing optional benchmark result: bm25-baseline.v0.json');
  }

  for (const fileName of NON_BENCHMARK_FILES) {
    if (availableFiles.has(fileName)) {
      warnings.push(`Excluded non-benchmark result file: ${fileName}`);
    }
  }

  for (const fileName of OPTIONAL_EXCLUDED_FILES) {
    if (availableFiles.has(fileName)) {
      warnings.push(`Optional result file present but excluded until explicitly supported: ${fileName}`);
    } else {
      warnings.push(`Optional result file not found: ${fileName}`);
    }
  }

  if (methods.length === 0) {
    throw new Error(
      `No supported benchmark result files found in ${resultsDir}.`,
    );
  }

  return {
    methods,
    warnings,
  };
}

export function hasResultFile(resultsDir: string, fileName: string): boolean {
  return existsSync(join(resultsDir, fileName));
}
