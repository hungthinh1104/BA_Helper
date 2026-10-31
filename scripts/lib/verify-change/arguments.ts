import type { VerificationLevel, VerifyArguments } from './types';

export function parseVerifyArguments(argv: string[]): VerifyArguments {
  const parsed: VerifyArguments = { level: 'affected', plan: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--plan') { parsed.plan = true; continue; }
    if (arg === '--level') {
      const value = argv[++index];
      if (!isLevel(value)) throw new Error('--level requires focused, affected, or full.');
      parsed.level = value;
      continue;
    }
    if (arg === '--base') {
      parsed.base = requireValue(argv[++index], '--base');
      continue;
    }
    if (arg === '--output') {
      parsed.outputDirectory = requireValue(argv[++index], '--output');
      continue;
    }
    if (arg === '--files') {
      const files: string[] = [];
      while (index + 1 < argv.length && !argv[index + 1].startsWith('--')) files.push(argv[++index]);
      if (files.length === 0) throw new Error('--files requires one or more paths.');
      parsed.files = [...(parsed.files ?? []), ...files];
      continue;
    }
    if (arg === '--help' || arg === '-h') throw new Error(usage());
    throw new Error(`Unknown verification option: ${arg}\n${usage()}`);
  }
  return parsed;
}

function isLevel(value: string | undefined): value is VerificationLevel {
  return value === 'focused' || value === 'affected' || value === 'full';
}

function requireValue(value: string | undefined, option: string): string {
  if (!value || value.startsWith('--')) throw new Error(`${option} requires a value.`);
  return value;
}

function usage(): string {
  return 'Usage: pnpm verify:change [--level focused|affected|full] [--files <paths...>] [--base <ref>] [--plan] [--output <directory>]';
}
