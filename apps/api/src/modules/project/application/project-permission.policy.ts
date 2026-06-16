import { ProjectRole } from '@ba-helper/contracts';

export type ProjectPermission =
  | 'project:read'
  | 'project:manage'
  | 'repository:manage'
  | 'scan:run'
  | 'requirement:create'
  | 'analysis:create'
  | 'analysis:create-derived'
  | 'analysis:finalize'
  | 'review:write'
  | 'clarification:write'
  | 'report:export';

const ROLE_PERMISSIONS: Record<ProjectRole, readonly ProjectPermission[]> = {
  OWNER: [
    'project:read',
    'project:manage',
    'repository:manage',
    'scan:run',
    'requirement:create',
    'analysis:create',
    'analysis:create-derived',
    'analysis:finalize',
    'review:write',
    'clarification:write',
    'report:export',
  ],
  MAINTAINER: [
    'project:read',
    'repository:manage',
    'scan:run',
    'report:export',
  ],
  ANALYST: [
    'project:read',
    'requirement:create',
    'analysis:create',
    'analysis:create-derived',
    'analysis:finalize',
    'clarification:write',
    'report:export',
  ],
  REVIEWER: [
    'project:read',
    'analysis:create-derived',
    'review:write',
    'clarification:write',
    'report:export',
  ],
  VIEWER: ['project:read', 'report:export'],
};

export function projectRoleHasPermission(
  role: ProjectRole,
  permission: ProjectPermission,
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
