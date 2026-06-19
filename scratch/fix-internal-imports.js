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

const tsFiles = getFiles('evaluation/src');

for (const fp of tsFiles) {
  let content = fs.readFileSync(fp, 'utf8');

  // Fix imports
  content = content.replace(/from '\.\.\/io'/g, "from '../../io'");
  content = content.replace(/from '\.\.\/\.\.\/apps/g, "from '../../../apps");
  // Only replace './core...' if we are not already in core
  if (!fp.startsWith('evaluation/src/core/')) {
    content = content.replace(/from '\.\/core/g, "from '../core");
    content = content.replace(/from '\.\/types'/g, "from '../core/types'");
    content = content.replace(/from '\.\/vector-provider-gate'/g, "from '../core/vector-provider-gate'");
  }
  content = content.replace(/from '\.\.\/src\/core/g, "from '../core");
  content = content.replace(/from '\.\.\/src\/types'/g, "from '../core/types'");
  content = content.replace(/from '\.\.\/types'/g, "from '../core/types'");
  content = content.replace(/from '\.\/case-snapshot-alignment'/g, "from '../alignment/case-snapshot-alignment'");
  content = content.replace(/from '\.\/evidence-quality'/g, "from '../analysis/evidence-quality'");
  content = content.replace(/from '\.\/ground-truth-coverage'/g, "from '../analysis/ground-truth-coverage'");

  fs.writeFileSync(fp, content);
}
