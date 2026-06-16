import { projectRoleHasPermission, ProjectPermission } from './project-permission.policy';

describe('projectRoleHasPermission', () => {
  it('should allow OWNER all defined capabilities', () => {
    const ownerPermissions: ProjectPermission[] = [
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
    ];
    for (const perm of ownerPermissions) {
      expect(projectRoleHasPermission('OWNER', perm)).toBe(true);
    }
  });

  it('should allow MAINTAINER repository and scan capabilities but not requirements', () => {
    expect(projectRoleHasPermission('MAINTAINER', 'project:read')).toBe(true);
    expect(projectRoleHasPermission('MAINTAINER', 'repository:manage')).toBe(true);
    expect(projectRoleHasPermission('MAINTAINER', 'scan:run')).toBe(true);
    expect(projectRoleHasPermission('MAINTAINER', 'report:export')).toBe(true);
    
    expect(projectRoleHasPermission('MAINTAINER', 'requirement:create')).toBe(false);
    expect(projectRoleHasPermission('MAINTAINER', 'analysis:create')).toBe(false);
  });

  it('should allow ANALYST requirement and analysis capabilities including clarification', () => {
    expect(projectRoleHasPermission('ANALYST', 'project:read')).toBe(true);
    expect(projectRoleHasPermission('ANALYST', 'requirement:create')).toBe(true);
    expect(projectRoleHasPermission('ANALYST', 'analysis:create')).toBe(true);
    expect(projectRoleHasPermission('ANALYST', 'analysis:finalize')).toBe(true);
    expect(projectRoleHasPermission('ANALYST', 'clarification:write')).toBe(true);
    
    expect(projectRoleHasPermission('ANALYST', 'repository:manage')).toBe(false);
    expect(projectRoleHasPermission('ANALYST', 'scan:run')).toBe(false);
    expect(projectRoleHasPermission('ANALYST', 'review:write')).toBe(false);
  });

  it('should allow REVIEWER review and clarification capabilities but not analysis creation', () => {
    expect(projectRoleHasPermission('REVIEWER', 'project:read')).toBe(true);
    expect(projectRoleHasPermission('REVIEWER', 'review:write')).toBe(true);
    expect(projectRoleHasPermission('REVIEWER', 'clarification:write')).toBe(true);
    
    expect(projectRoleHasPermission('REVIEWER', 'requirement:create')).toBe(false);
    expect(projectRoleHasPermission('REVIEWER', 'analysis:create')).toBe(false);
    expect(projectRoleHasPermission('REVIEWER', 'analysis:finalize')).toBe(false);
  });

  it('should allow VIEWER only read and export capabilities', () => {
    expect(projectRoleHasPermission('VIEWER', 'project:read')).toBe(true);
    expect(projectRoleHasPermission('VIEWER', 'report:export')).toBe(true);
    
    expect(projectRoleHasPermission('VIEWER', 'requirement:create')).toBe(false);
    expect(projectRoleHasPermission('VIEWER', 'review:write')).toBe(false);
    expect(projectRoleHasPermission('VIEWER', 'analysis:create')).toBe(false);
  });
});
