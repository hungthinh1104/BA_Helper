import 'tsconfig-paths/register';
import { resolve } from 'node:path';
import { BUILT_IN_DOMAIN_PACK_CATALOG } from '../packages/backend-runtime/src/domain-pack/application/domain-pack.catalog';
import { validateDomainPackCatalog } from '../packages/backend-runtime/src/domain-pack/application/domain-pack.governance';

const result = validateDomainPackCatalog(BUILT_IN_DOMAIN_PACK_CATALOG, {
  glossaryRoot: resolve(process.cwd(), 'packages/domain-packs'),
});

if (!result.ok) {
  console.error('Domain pack governance validation failed.');
  for (const error of result.errors) {
    const suffix = error.packId ? ` [${error.packId}]` : '';
    console.error(`- ${error.code}${suffix}: ${error.message}`);
  }
  process.exit(1);
}

console.log('Domain pack governance validation passed.');
for (const item of result.digests) {
  console.log(`- ${item.canonicalId}: ${item.digest}`);
}
