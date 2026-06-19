const fs = require('fs');

const filePaths = [
  'evaluation/scripts/compute-metrics.ts',
  'evaluation/scripts/run-bm25-baseline.ts',
  'evaluation/scripts/run-vector-baseline.ts',
  'evaluation/src/case-snapshot-alignment.spec.ts',
  'evaluation/src/current-hybrid-export-guard.spec.ts',
  'evaluation/src/current-hybrid-export-guard.ts',
  'evaluation/src/validate-cases.spec.ts',
  'evaluation/src/vector-path-probe.ts'
];

for (const fp of filePaths) {
  if (!fs.existsSync(fp)) continue;
  let content = fs.readFileSync(fp, 'utf8');

  if (!content.includes('import { EvaluationPaths }') && !content.includes('import {EvaluationPaths}')) {
    const isScript = fp.startsWith('evaluation/scripts/');
    const importPath = isScript ? '../src/core/paths' : './core/paths';
    content = `import { EvaluationPaths } from '${importPath}';\n` + content;
  }

  fs.writeFileSync(fp, content);
}
