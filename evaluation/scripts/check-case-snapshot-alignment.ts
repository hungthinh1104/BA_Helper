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
  writeResult({
    canonicalJsonPath: EvaluationPaths.resultsV0.alignment + '/case-snapshot-alignment.v0.json',
    canonicalMarkdownPath: EvaluationPaths.resultsV0.alignment + '/case-snapshot-alignment.v0.md',
    legacyJsonPath: jsonPath,
    legacyMarkdownPath: markdownPath,
    jsonData: registry,
    markdownData: renderCaseSnapshotAlignmentMarkdown(registry)
  });

  console.log(`Wrote case snapshot alignment JSON to canonical path and legacy alias`);
  console.log(`Wrote case snapshot alignment markdown to canonical path and legacy alias`);
}

main();
