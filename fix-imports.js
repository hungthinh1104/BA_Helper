const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const mapping = {
  'new-analysis-dialog': 'analysis/new-analysis/new-analysis-dialog',
  'analysis-header': 'analysis/analysis-header',
  'analysis-progress': 'analysis/analysis-progress',
  'scan-diagnostics-panel': 'analysis/scan-diagnostics-panel',
  'finalize-analysis-dialog': 'analysis/finalize-analysis-dialog',
  'finalize-dialog': 'analysis/report/finalize-dialog',
  'e2e-timeline': 'analysis/e2e-timeline',
  'impact-analysis-workspace': 'analysis/impact-analysis-workspace',
  'affected-artifact-card': 'analysis/affected-artifact-card',
  'clarification-widget': 'analysis/clarification/clarification-widget',
  'impact-matrix-table': 'matrix/impact-matrix-table',
  'matrix-artifact-detail-card': 'matrix/matrix-artifact-detail-card',
  'matrix-row-detail-drawer': 'matrix/matrix-row-detail-drawer',
  'connect-repo-dialog': 'repository/connect-repo-dialog',
  'scan-job-progress': 'repository/scan-job-progress',
  'new-requirement-dialog': 'requirement/new-requirement-dialog',
  'decision-note-form': 'review/decision-note-form',
  'review-action-panel': 'review/review-action-panel',
  'review-queue-panel': 'review/review-queue-panel',
  'insight-card': 'shared/insight/insight-card',
  'insight-filter-bar': 'shared/insight/insight-filter-bar',
  'insight-list': 'shared/insight/insight-list',
  'qa-coverage-badge': 'shared/qa/qa-coverage-badge',
  'qa-coverage-panel': 'shared/qa/qa-coverage-panel',
  'retrieval-signals': 'shared/retrieval/retrieval-signals',
  'retrieval-suggestion': 'shared/retrieval/retrieval-suggestion',
  'code-evidence-block': 'shared/retrieval/code-evidence-block',
  'evidence-inspector': 'shared/retrieval/evidence-inspector',
  'back-button': 'shared/back-button',
  'data-list': 'shared/data-list',
  'page-header': 'shared/page-header',
  'panel': 'shared/panel',
  'mermaid-renderer': 'shared/mermaid-renderer'
};

const findFiles = (dir) => {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(findFiles(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
};

const files = findFiles('apps/web/src');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  for (const [oldName, newPath] of Object.entries(mapping)) {
    // Replace exact absolute imports
    const regex1 = new RegExp(`"@/components/workspace/${oldName}"`, 'g');
    if (regex1.test(content)) {
      content = content.replace(regex1, `"@/components/workspace/${newPath}"`);
      changed = true;
    }
    
    // Replace relative imports, more tricky but let's do a simple regex for "../workspace/oldName" and "./oldName"
    // Since everything was in `workspace`, any import to oldName could be `../workspace/oldName`
    // Actually we can just regex for `/(['"])((\\.?\\.\\/)*)(workspace\\/)?${oldName}(['"])/`
    // Wait, replacing relative paths with absolute is safer
    const relRegex = new RegExp(`(['"])(\\.?\\.\\/)+(workspace\\/)?${oldName}(['"])`, 'g');
    if (relRegex.test(content)) {
       content = content.replace(relRegex, `"@/components/workspace/${newPath}"`);
       changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
});
