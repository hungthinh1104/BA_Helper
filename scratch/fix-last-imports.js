const fs = require('fs');

function replace(fp, search, repl) {
  if (fs.existsSync(fp)) {
    fs.writeFileSync(fp, fs.readFileSync(fp, 'utf8').replace(search, repl));
  }
}

replace('evaluation/metrics.ts', "from './src/result-registry'", "from './src/analysis/result-registry'");
replace('evaluation/scripts/run-vector-baseline.ts', "from '../src/vector-provider-gate'", "from '../src/core/vector-provider-gate'");
replace('evaluation/src/analysis/failure-analysis.ts', "from '../metrics'", "from '../../metrics'");
replace('evaluation/src/analysis/failure-analysis.spec.ts', "from '../metrics'", "from '../../metrics'");
replace('evaluation/src/analysis/metrics.spec.ts', "from '../metrics'", "from '../../metrics'");
replace('evaluation/src/core/current-hybrid-export-guard.ts', "from './core/paths'", "from './paths'");
replace('evaluation/src/core/current-hybrid-export-guard.spec.ts', "from './core/paths'", "from './paths'");

