import { loadDataset } from '../io';
import { EvaluationPaths } from '../src/core/paths';
import { writeResult } from '../src/core/write-result';
import {
  probeDbSnapshotReadiness,
  renderDbSnapshotReadinessMarkdown,
} from '../src/probes/db-snapshot-readiness';

function parseArg(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

async function main(): Promise<void> {
  const jsonPath = parseArg(
    '--json',
    EvaluationPaths.resultsLegacy.probes.dbReadinessJson,
  );
  const markdownPath = parseArg(
    '--markdown',
    EvaluationPaths.resultsLegacy.probes.dbReadinessMd,
  );
  const dataset = loadDataset(EvaluationPaths.datasetV0.cases);
  const exampleCaseId = dataset.cases[0]?.id;

  const report = await probeDbSnapshotReadiness();
  
  const isDbUnavailable = report.status === 'NO_DATABASE_URL' || report.status === 'DB_UNAVAILABLE';
  
  writeResult({
    canonicalJsonPath: isDbUnavailable ? undefined : EvaluationPaths.resultsV0.probes + '/db-snapshot-readiness.v0.json',
    canonicalMarkdownPath: isDbUnavailable ? undefined : EvaluationPaths.resultsV0.probes + '/db-snapshot-readiness.v0.md',
    legacyJsonPath: jsonPath,
    legacyMarkdownPath: markdownPath,
    jsonData: report,
    markdownData: renderDbSnapshotReadinessMarkdown({ report, exampleCaseId })
  });

  if (isDbUnavailable) {
    console.warn(`[WARNING] DB is unavailable (${report.status}). Skipping canonical write. Wrote to legacy paths only.`);
  } else {
    console.log(`Wrote DB snapshot readiness JSON to ${jsonPath} and canonical path`);
    console.log(`Wrote DB snapshot readiness markdown to ${markdownPath} and canonical path`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
