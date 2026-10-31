export type VerificationLevel = 'focused' | 'affected' | 'full';

export interface VerifyArguments {
  level: VerificationLevel;
  files?: string[];
  base?: string;
  plan: boolean;
  outputDirectory?: string;
}

export type ChangeKind = 'added' | 'modified' | 'deleted' | 'renamed-from' | 'renamed-to';

export interface ChangedPath {
  path: string;
  kind: ChangeKind;
  source: 'working-tree' | 'committed' | 'explicit';
}

export type ChangeArea =
  | 'backend' | 'contracts' | 'prisma' | 'embedding' | 'worker'
  | 'analyzer' | 'frontend' | 'api-e2e' | 'tests' | 'docs' | 'full';

export interface RelatedTestSelection {
  id: string;
  config: string;
  sourceFiles: string[];
  fallbackFiles: string[];
  fallbackConfig?: string;
  fallbackRequires?: CommandSpec['requires'];
  cwd?: string;
  reason: string;
}

export interface CommandSpec {
  id: string;
  executable: 'pnpm' | 'node' | 'git' | 'playwright';
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  reason: string;
  requires?: Array<'test-targets' | 'migration-target' | 'docker' | 'browser' | 'pinned-corpus'>;
  dependsOn?: string[];
  selection?: RelatedTestSelection;
  reportPath?: string;
}

export interface CheckResult {
  id: string;
  command: string;
  reason: string;
  status: 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIPPED' | 'INTERRUPTED';
  startedAt: string;
  durationMs: number;
  exitCode: number | null;
  signal?: string;
  evidence?: string;
  details?: string;
}
