import { backendTransform, backendTransformIgnorePatterns } from '../../jest.transforms.cjs';
import root from '../../jest.config';
import ci from '../../jest.ci.config';
import e2e from '../../jest.e2e.config';
import unit from '../../jest.unit.config';
import integration from '../../jest.integration.config';
import analyzer from '../../jest.analyzer.config';

const ignored = (path: string) => backendTransformIgnorePatterns.some(pattern => new RegExp(pattern).test(path));

describe('backend ESM parser compatibility', () => {
  it.each([
    '/repo/node_modules/.pnpm/htmlparser2@12.0.0/node_modules/htmlparser2/dist/index.js',
    '/repo/node_modules/.pnpm/dom-serializer@3.1.1/node_modules/dom-serializer/dist/index.js',
    '/repo/node_modules/domhandler/dist/index.js',
    '/repo/node_modules/.pnpm/@scalar+client-side-rendering@0.4.12/node_modules/@scalar/client-side-rendering/dist/index.js',
    'C:\\repo\\node_modules\\@scalar\\helpers\\dist\\json\\serialize-property-key.js',
    'C:\\repo\\node_modules\\.pnpm\\entities@8.1.0\\node_modules\\entities\\dist\\index.js',
  ])('transforms the sanitizer parser dependency: %s', path => {
    expect(ignored(path)).toBe(false);
    expect(Object.keys(backendTransform!).some(pattern => new RegExp(pattern).test(path))).toBe(true);
  });

  it.each([
    '/repo/node_modules/react/index.js',
    '/repo/node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/typescript.js',
    'C:\\repo\\node_modules\\.pnpm\\htmlparser2-other@1\\node_modules\\htmlparser2-other\\index.js',
  ])('keeps unrelated dependencies excluded: %s', path => {
    expect(ignored(path)).toBe(true);
  });

  it('uses the same bounded transforms for every backend test entry point', () => {
    for (const config of [root, ci, e2e, unit, integration, analyzer]) {
      expect(config.transform).toEqual(backendTransform);
      expect(config.transformIgnorePatterns).toEqual(backendTransformIgnorePatterns);
    }
  });
});
