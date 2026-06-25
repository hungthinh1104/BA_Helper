import type { RequestUser } from '@ba-helper/contracts';
import { AppError } from '@ba-helper/shared';
import {
  CurrentWorkspaceResolver,
} from './current-workspace.resolver';
import { getRuntimeConfig } from '../../../bootstrap/runtime-config';

export class GetCurrentWorkspaceUseCase {
  constructor(
    private readonly resolvers: CurrentWorkspaceResolver[],
  ) {}

  async execute(actor?: RequestUser) {
    const { workspaceMode } = getRuntimeConfig(process.env);
    const resolver = this.resolvers.find(
      (candidate) => candidate.mode === workspaceMode,
    );

    if (!resolver) {
      throw new AppError(
        'WORKSPACE_MODE_UNSUPPORTED',
        `Unsupported WORKSPACE_MODE: ${workspaceMode}`,
      );
    }

    return resolver.resolveCurrentWorkspace(actor);
  }
}
