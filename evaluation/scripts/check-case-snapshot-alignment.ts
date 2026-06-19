import { existsSync } from 'fs';
import { readJsonFile, resolveRepoPath } from '../io';
import { writeResult } from '../src/core/write-result';
import { EvaluationPaths } from '../src/core/paths';
import {
  buildCaseSnapshotAlignmentRegistry,
  renderCaseSnapshotAlignmentMarkdown,
} from '../src/alignment/case-snapshot-alignment';

function parseArg(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function main(): void {
  const jsonPath = parseArg(
    '--json',
    EvaluationPaths.resultsLegacy.alignment.alignmentJson,
  );
  const markdownPath = parseArg(
    '--markdown',
    EvaluationPaths.resultsLegacy.alignment.alignmentMd,
  );

  const registry = buildCaseSnapshotAlignmentRegistry();
  
  const readinessPath = resolveRepoPath(EvaluationPaths.resultsLegacy.probes.dbReadinessJson);
  let isDbUnavailable = false;
  if (existsSync(readinessPath)) {
    const readiness = readJsonFile<any>(readinessPath);
    if (readiness.status === 'NO_DATABASE_URL' || readiness.status === 'DB_UNAVAILABLE') {
      isDbUnavailable = true;
    }
  }

  writeResult({
    canonicalJsonPath: isDbUnavailable ? undefined : EvaluationPaths.resultsV0.alignment + '/case-snapshot-alignment.v0.json',
    canonicalMarkdownPath: isDbUnavailable ? undefined : EvaluationPaths.resultsV0.alignment + '/case-snapshot-alignment.v0.md',
    legacyJsonPath: jsonPath,
    legacyMarkdownPath: markdownPath,
    jsonData: registry,
    markdownData: renderCaseSnapshotAlignmentMarkdown(registry)
  });

  if (isDbUnavailable) {
    console.warn(`[WARNING] DB is unavailable or all snapshots missing. Skipping canonical write. Wrote to legacy paths only.`);
  } else {
    console.log(`Wrote case snapshot alignment JSON to canonical path and legacy alias`);
    console.log(`Wrote case snapshot alignment markdown to canonical path and legacy alias`);
  }
}

main();
