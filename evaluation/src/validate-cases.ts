import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import {
  reqImpactEvaluationDatasetSchema,
  type CandidateArtifact,
  type ReqImpactEvaluationCase,
} from './types';

const DEFAULT_DATASET_PATH = 'evaluation/datasets/cases.v0.json';

type ValidationWarning = {
  caseId: string;
  message: string;
};

function resolveDatasetPath(): string {
  const datasetArgIndex = process.argv.indexOf('--dataset');
  const relativePath =
    datasetArgIndex >= 0 && process.argv[datasetArgIndex + 1]
      ? process.argv[datasetArgIndex + 1]
      : DEFAULT_DATASET_PATH;
  return resolve(process.cwd(), relativePath);
}

function loadDatasetFromDisk(datasetPath: string): unknown {
  return JSON.parse(readFileSync(datasetPath, 'utf8')) as unknown;
}

function collectWarnings(
  evaluationCases: ReqImpactEvaluationCase[],
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  for (const evaluationCase of evaluationCases) {
    const candidateFileSet = new Set(
      evaluationCase.candidateArtifacts.map(
        (candidateArtifact: CandidateArtifact) => candidateArtifact.filePath,
      ),
    );
    const groundTruthFileSet = new Set(evaluationCase.groundTruth.files);

    const sameSize = candidateFileSet.size === groundTruthFileSet.size;
    const sameMembers =
      sameSize &&
      [...groundTruthFileSet].every((filePath) => candidateFileSet.has(filePath));

    if (sameMembers) {
      warnings.push({
        caseId: evaluationCase.id,
        message:
          'candidateArtifacts file set matches groundTruth.files exactly; retrieval evaluation may be artificially pre-filtered.',
      });
    }
  }

  return warnings;
}

export function validateCasesDataset(datasetPath: string): {
  ok: boolean;
  warnings: ValidationWarning[];
  errors: string[];
} {
  if (!existsSync(datasetPath)) {
    return {
      ok: true,
      warnings: [],
      errors: [`Dataset file not found: ${datasetPath}`],
    };
  }

  try {
    const rawDataset = loadDatasetFromDisk(datasetPath);
    const dataset = reqImpactEvaluationDatasetSchema.parse(rawDataset);
    return {
      ok: true,
      warnings: collectWarnings(dataset.cases),
      errors: [],
    };
  } catch (error) {
    if (error instanceof Error && 'issues' in error) {
      const issues = (error as { issues?: Array<{ path: (string | number)[]; message: string }> }).issues ?? [];
      return {
        ok: false,
        warnings: [],
        errors: issues.map((issue) => {
          const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
          return `${path}: ${issue.message}`;
        }),
      };
    }

    return {
      ok: false,
      warnings: [],
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

function main(): void {
  const datasetPath = resolveDatasetPath();

  if (!existsSync(datasetPath)) {
    console.log(
      `[info] Dataset file not found at ${datasetPath}. Skipping validation for now.`,
    );
    process.exit(0);
  }

  const result = validateCasesDataset(datasetPath);

  for (const warning of result.warnings) {
    console.warn(`[warn] ${warning.caseId}: ${warning.message}`);
  }

  if (!result.ok) {
    for (const error of result.errors) {
      console.error(`[error] ${error}`);
    }
    process.exit(1);
  }

  console.log(
    `[ok] Dataset validation passed for ${datasetPath}. Cases: ${
      reqImpactEvaluationDatasetSchema.parse(loadDatasetFromDisk(datasetPath)).cases
        .length
    }`,
  );
}

if (require.main === module) {
  main();
}
