export interface LeaseWrappedCommand {
  file: string;
  args: string[];
  cwd: string;
}

export function resolveLeaseWrappedCommand(
  args: string[],
  root: string,
  nodeExecutable: string,
  pnpmCli: string | undefined,
  workingDirectory: string,
): LeaseWrappedCommand {
  if (args[0] === '--run') {
    const scriptName = args[1];
    if (!scriptName || !pnpmCli) throw new Error('A package script and pnpm invocation are required for --run.');
    const scriptArgs = args.slice(2);
    const forwardedArgs = scriptArgs[0] === '--' ? scriptArgs.slice(1) : scriptArgs;
    return {
      file: nodeExecutable,
      args: [pnpmCli, '--dir', root, 'run', scriptName, ...forwardedArgs],
      cwd: root,
    };
  }

  const separator = args.indexOf('--');
  const command = separator >= 0 ? args.slice(separator + 1) : args;
  if (command.length === 0) throw new Error('Pass a command after -- to run under the test database lease.');
  if (['pnpm', 'pnpm.cmd'].includes(command[0]!.toLowerCase())) {
    if (!pnpmCli) throw new Error('The active pnpm CLI path is not available in this process.');
    return { file: nodeExecutable, args: [pnpmCli, ...command.slice(1)], cwd: workingDirectory };
  }
  return { file: command[0]!, args: command.slice(1), cwd: workingDirectory };
}
