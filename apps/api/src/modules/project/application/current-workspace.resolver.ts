export interface ResolvedWorkspace {
  mode: 'dev-single-user';
  project: {
    id: string;
    name: string;
    createdAt: Date;
  };
}

export interface CurrentWorkspaceResolver {
  readonly mode: ResolvedWorkspace['mode'];
  resolveCurrentWorkspace(): Promise<ResolvedWorkspace>;
}

export const CURRENT_WORKSPACE_RESOLVERS = Symbol(
  'CURRENT_WORKSPACE_RESOLVERS',
);

