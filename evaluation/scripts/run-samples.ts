import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { readJsonFile, resolveRepoPath } from '../io';
import { EvaluationPaths } from '../src/core/paths';

function main(): void {
  const alignmentPath = resolveRepoPath(EvaluationPaths.resultsV0.alignment + '/case-snapshot-alignment.v0.json');
  if (!existsSync(alignmentPath)) {
    console.warn('[WARNING] Alignment file missing. Skipping eval:samples.');
    return;
  }

  const alignment = readJsonFile<any>(alignmentPath);
  const eligibleCases = alignment.cases.filter((c: any) => c.status === 'ALIGNED_VECTOR_READY');

  if (eligibleCases.length === 0) {
    console.warn('[WARNING] No ALIGNED_VECTOR_READY cases found. Skipping eval:samples.');
    return;
  }

  for (const caseData of eligibleCases) {
    console.log(`Running export-rag-samples for ${caseData.caseId}...`);
    try {
      execSync(
        `pnpm exec ts-node --project tsconfig.json evaluation/scripts/export-rag-samples.ts ` +
        `--caseId ${caseData.caseId} ` +
        `--projectId ${caseData.projectId} ` +
        `--repositoryId ${caseData.repositoryId} ` +
        `--snapshotId ${caseData.snapshotId}`,
        { stdio: 'inherit' }
      );
    } catch (e) {
      console.error(`[ERROR] Failed to export samples for ${caseData.caseId}`);
    }
  }
}

main();
