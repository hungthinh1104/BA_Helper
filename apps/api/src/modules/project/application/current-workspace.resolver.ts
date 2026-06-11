import type { ProjectRole, RequestUser } from '@ba-helper/contracts';

export interface ResolvedWorkspace {
  mode: 'dev-single-user';
  project: {
    id: string;
    name: string;
    createdAt: Date;
  };
  membershipRole: ProjectRole | null;
}

export interface CurrentWorkspaceResolver {
  readonly mode: ResolvedWorkspace['mode'];
  resolveCurrentWorkspace(actor?: RequestUser): Promise<ResolvedWorkspace>;
}

export const CURRENT_WORKSPACE_RESOLVERS = Symbol(
  'CURRENT_WORKSPACE_RESOLVERS',
);
