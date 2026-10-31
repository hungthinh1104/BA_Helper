import * as dotenv from 'dotenv';
import * as path from 'node:path';
import { configureIsolatedE2EEnvironment } from './test-environment';

dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });
configureIsolatedE2EEnvironment(process.env);
