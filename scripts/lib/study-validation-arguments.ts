export function parseStudyValidationArguments(arguments_: string[]): { inputPath: string; outputPath?: string } {
  let inputPath: string | undefined;
  let outputPath: string | undefined;
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--') continue;
    if (argument === '--output') {
      outputPath = arguments_[index + 1];
      if (!outputPath || outputPath.startsWith('-')) {
        throw new Error('The --output option requires a destination path.');
      }
      index += 1;
      continue;
    }
    if (argument.startsWith('--output=')) {
      outputPath = argument.slice('--output='.length);
      if (!outputPath) throw new Error('The --output option requires a destination path.');
      continue;
    }
    if (argument.startsWith('-')) throw new Error(`Unknown option: ${argument}`);
    if (inputPath) throw new Error('Only one dataset path may be supplied.');
    inputPath = argument;
  }
  if (!inputPath) {
    throw new Error('Usage: pnpm validate:developer-study -- <dataset-path> [--output <scorecard-path>]');
  }
  return { inputPath, outputPath };
}
