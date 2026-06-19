const fs = require('fs');
const path = require('path');

function getFiles(dir, files = []) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const name = dir + '/' + file;
    if (fs.statSync(name).isDirectory()) {
      getFiles(name, files);
    } else if (name.endsWith('.ts')) {
      files.push(name);
    }
  }
  return files;
}

const tsFiles = [...getFiles('evaluation/scripts'), ...getFiles('evaluation/baselines'), 'evaluation/types.ts', 'evaluation/metrics.ts'];

for (const fp of tsFiles) {
  if (!fs.existsSync(fp)) continue;
  let content = fs.readFileSync(fp, 'utf8');

  content = content.replace(/from '\.\.\/src\/types'/g, "from '../src/core/types'");
  content = content.replace(/from '\.\/src\/types'/g, "from './src/core/types'");
  content = content.replace(/from '\.\.\/src\/case-snapshot-alignment'/g, "from '../src/alignment/case-snapshot-alignment'");
  content = content.replace(/from '\.\.\/src\/validate-cases'/g, "from '../src/alignment/validate-cases'");
  content = content.replace(/from '\.\.\/src\/db-snapshot-readiness'/g, "from '../src/probes/db-snapshot-readiness'");
  content = content.replace(/from '\.\.\/src\/vector-path-probe'/g, "from '../src/probes/vector-path-probe'");
  content = content.replace(/from '\.\.\/src\/evidence-quality'/g, "from '../src/analysis/evidence-quality'");
  content = content.replace(/from '\.\.\/src\/ground-truth-coverage'/g, "from '../src/analysis/ground-truth-coverage'");
  content = content.replace(/from '\.\.\/src\/rag-export-db-read-model'/g, "from '../src/analysis/rag-export-db-read-model'");
  content = content.replace(/from '\.\.\/src\/current-hybrid-export-guard'/g, "from '../src/core/current-hybrid-export-guard'");
  content = content.replace(/from '\.\.\/src\/failure-analysis'/g, "from '../src/analysis/failure-analysis'");
  content = content.replace(/from '\.\.\/src\/metrics'/g, "from '../src/analysis/metrics'");
  content = content.replace(/from '\.\.\/src\/result-registry'/g, "from '../src/analysis/result-registry'");
  content = content.replace(/from '\.\/src\/metrics'/g, "from './src/analysis/metrics'");
  
  fs.writeFileSync(fp, content);
}
