import { validateResults } from '../src/validation/validate-results';

function main() {
  console.log('Running evaluation result validation...');
  const { valid, errors } = validateResults();
  
  if (!valid) {
    console.error('Validation failed with the following errors:');
    for (const err of errors) {
      console.error(`- ${err}`);
    }
    process.exit(1);
  }
  
  console.log('Validation passed.');
}

main();
