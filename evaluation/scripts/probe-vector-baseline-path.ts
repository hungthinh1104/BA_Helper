import { writeResult } from '../src/core/write-result';
import { EvaluationPaths } from '../src/core/paths';
import {
  probeVectorBaselinePath,
  renderVectorPathProbeMarkdown,
} from '../src/probes/vector-path-probe';

function parseArg(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function main(): void {
  const jsonPath = parseArg(
    '--json',
    EvaluationPaths.resultsLegacy.probes.vectorBaselinePathJson,
  );
  const markdownPath = parseArg(
    '--markdown',
    EvaluationPaths.resultsLegacy.probes.vectorBaselinePathMd,
  );

  const report = probeVectorBaselinePath();
  writeResult({
    canonicalJsonPath: EvaluationPaths.resultsV0.probes + '/vector-baseline-path.v0.json',
    canonicalMarkdownPath: EvaluationPaths.resultsV0.probes + '/vector-baseline-path.v0.md',
    legacyJsonPath: jsonPath,
    legacyMarkdownPath: markdownPath,
    jsonData: report,
    markdownData: renderVectorPathProbeMarkdown(report)
  });

  console.log(`Wrote vector path probe JSON to ${jsonPath}`);
  console.log(`Wrote vector path probe markdown to ${markdownPath}`);
}

main();
