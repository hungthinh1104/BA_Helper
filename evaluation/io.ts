import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import {
  evaluationDatasetSchema,
  evaluationResultsSchema,
  type EvaluationDataset,
  type EvaluationResults,
} from './types';

export function resolveRepoPath(inputPath: string): string {
  return resolve(process.cwd(), inputPath);
}

export function readJsonFile<T>(inputPath: string): T {
  return JSON.parse(readFileSync(resolveRepoPath(inputPath), 'utf8')) as T;
}

export function writeJsonFile(outputPath: string, data: unknown): void {
  writeFileSync(
    resolveRepoPath(outputPath),
    `${JSON.stringify(data, null, 2)}\n`,
    'utf8',
  );
}

export function loadDataset(inputPath: string): EvaluationDataset {
  return evaluationDatasetSchema.parse(readJsonFile(inputPath));
}

export function loadResults(inputPath: string): EvaluationResults {
  return evaluationResultsSchema.parse(readJsonFile(inputPath));
}
