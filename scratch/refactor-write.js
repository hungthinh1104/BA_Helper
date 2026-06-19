const fs = require('fs');

const scripts = [
  {
    path: 'evaluation/scripts/run-keyword-baseline.ts',
    canonicalJson: "EvaluationPaths.resultsV0.baselines + '/keyword-baseline.v0.json'",
    canonicalMd: "EvaluationPaths.resultsV0.baselines + '/keyword-baseline.v0.md'",
    render: "renderMarkdown(output)",
    reportVar: "output"
  },
  {
    path: 'evaluation/scripts/run-vector-baseline.ts',
    canonicalJson: "EvaluationPaths.resultsV0.baselines + '/vector-baseline.v0.json'",
    canonicalMd: "null",
    render: "null",
    reportVar: "output"
  },
  {
    path: 'evaluation/scripts/compute-metrics.ts',
    canonicalJson: "EvaluationPaths.resultsV0.analysis + '/metrics.v0.json'",
    canonicalMd: "EvaluationPaths.resultsV0.analysis + '/metrics.v0.md'",
    render: "renderMetricsMarkdown(report)",
    reportVar: "report"
  },
  {
    path: 'evaluation/scripts/analyze-failures.ts',
    canonicalJson: "EvaluationPaths.resultsV0.analysis + '/failure-analysis.v0.json'",
    canonicalMd: "EvaluationPaths.resultsV0.analysis + '/failure-analysis.v0.md'",
    render: "renderFailureAnalysisMarkdown(report)",
    reportVar: "report"
  },
  {
    path: 'evaluation/scripts/run-evaluation.ts',
    canonicalJson: "EvaluationPaths.resultsLegacy.root + '/results.v0.json'", // Wait, this gets moved to canonical too, but wait
    canonicalMd: "EvaluationPaths.resultsV0.analysis + '/research-summary.v0.md'",
    render: "markdown",
    reportVar: "results"
  }
];

for (const s of scripts) {
  if (!fs.existsSync(s.path)) continue;
  let content = fs.readFileSync(s.path, 'utf8');

  // Add imports if missing
  if (!content.includes('writeResult')) {
    content = content.replace("import { loadDataset", "import { writeResult } from '../src/core/write-result';\nimport { EvaluationPaths } from '../src/core/paths';\nimport { loadDataset");
  }

  // Replace writeJsonFile
  if (s.canonicalMd !== "null" && s.path !== 'evaluation/scripts/run-evaluation.ts') {
    content = content.replace(/writeJsonFile\([^\n]+\n\s+writeFileSync\([^\n]+\n[^\n]+\n\s+'utf8',\n\s+\);/m, 
`writeResult({
    canonicalJsonPath: ${s.canonicalJson},
    canonicalMarkdownPath: ${s.canonicalMd},
    legacyJsonPath: jsonPath,
    legacyMarkdownPath: markdownPath,
    jsonData: ${s.reportVar},
    markdownData: ${s.render}
  });`
    );
  } else if (s.path === 'evaluation/scripts/run-vector-baseline.ts') {
    content = content.replace(/writeJsonFile\(outputPath, output\);/, 
`writeResult({
    canonicalJsonPath: ${s.canonicalJson},
    legacyJsonPath: outputPath,
    jsonData: output
  });`
    );
  } else if (s.path === 'evaluation/scripts/run-evaluation.ts') {
    content = content.replace(/writeJsonFile\(resultsPath, results\);\n\s+writeFileSync\(resolveRepoPath\(markdownPath\), markdown, 'utf8'\);/m,
`writeResult({
    canonicalJsonPath: EvaluationPaths.resultsV0.analysis + '/research-summary.v0.json',
    canonicalMarkdownPath: EvaluationPaths.resultsV0.analysis + '/research-summary.v0.md',
    legacyJsonPath: resultsPath,
    legacyMarkdownPath: markdownPath,
    jsonData: results,
    markdownData: markdown
  });`
    );
  }

  fs.writeFileSync(s.path, content);
}
