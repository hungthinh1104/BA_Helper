import { Project, SyntaxKind } from 'ts-morph';
import * as contracts from '@ba-helper/contracts';
import type { ZodTypeAny } from 'zod';
import { authProjectDocs } from '../../apps/api/src/bootstrap/api-docs/auth-project.docs';
import { repositoryDocs } from '../../apps/api/src/bootstrap/api-docs/repository.docs';
import { analysisDocs } from '../../apps/api/src/bootstrap/api-docs/analysis.docs';
import { reviewDocs } from '../../apps/api/src/bootstrap/api-docs/review.docs';
import { reportSystemDocs } from '../../apps/api/src/bootstrap/api-docs/report-system.docs';

const catalogue = { ...authProjectDocs, ...repositoryDocs, ...analysisDocs, ...reviewDocs, ...reportSystemDocs };
const schemas = contracts as unknown as Record<string, ZodTypeAny>;

describe('API documentation matches controller input contracts', () => {
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  project.addSourceFilesAtPaths('apps/api/src/**/*.controller.ts');

  it('documents every registered body and query, using the actual parsed request schema', () => {
    let count = 0;
    for (const source of project.getSourceFiles()) for (const controller of source.getClasses()) {
      if (!controller.getDecorator('Controller')) continue;
      for (const method of controller.getMethods()) {
        if (!method.getDecorators().some(d => ['Get', 'Post', 'Put', 'Patch', 'Delete'].includes(d.getName()))) continue;
        const doc = catalogue[controller.getName()!]?.operations[method.getName()];
        expect({ id: `${controller.getName()}_${method.getName()}`, documented: Boolean(doc) }).toMatchObject({ documented: true });
        count++;
        for (const param of method.getParameters()) {
          if (param.getDecorator('Body')) {
            expect(doc.body).toBeDefined();
            const name = param.getName();
            const calls = method.getDescendantsOfKind(SyntaxKind.CallExpression);
            for (const call of calls.filter(c => c.getArguments()[0]?.getText() === name)) {
              const match = call.getExpression().getText().match(/^(\w+Schema)\.(?:safeParse|parse)$/);
              if (match) expect(doc.body).toBe(schemas[match[1]]);
            }
          }
          const query = param.getDecorator('Query');
          if (query) {
            expect(doc.query).toBeDefined();
            const key = query.getArguments()[0]?.getText().replace(/['"]/g, '');
            if (key) expect(Object.keys(doc.query!.shape)).toContain(key);
          }
        }
        if (doc.bodyExample !== undefined) expect(doc.body!.safeParse(doc.bodyExample).success).toBe(true);
      }
    }
    expect(count).toBeGreaterThan(90);
    expect(Object.values(catalogue).reduce((sum, group) => sum + Object.keys(group.operations).length, 0)).toBe(count);
  });
});
