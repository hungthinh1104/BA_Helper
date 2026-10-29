import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { ProjectRole } from '@ba-helper/contracts';
import { ProjectPermissionService } from './project-permission.service';
import type { ProjectRepository } from '../infrastructure/project.repository';
import type { ProjectScopeRepository } from '../infrastructure/project-scope.repository';
import {
  projectRoleHasPermission,
  type ProjectPermission,
} from './project-permission.policy';

const expectedPermissions: Record<ProjectRole, readonly ProjectPermission[]> = {
  OWNER: [
    'project:read', 'project:manage', 'repository:manage', 'scan:run',
    'requirement:create', 'analysis:create', 'analysis:create-derived',
    'analysis:finalize', 'review:write', 'clarification:write', 'report:export',
  ],
  MAINTAINER: ['project:read', 'repository:manage', 'scan:run', 'report:export'],
  ANALYST: [
    'project:read', 'requirement:create', 'analysis:create',
    'analysis:create-derived', 'analysis:finalize', 'clarification:write',
    'report:export',
  ],
  REVIEWER: [
    'project:read', 'analysis:create-derived', 'review:write',
    'clarification:write', 'report:export',
  ],
  VIEWER: ['project:read', 'report:export'],
};

const allPermissions: readonly ProjectPermission[] = [
  'project:read', 'project:manage', 'repository:manage', 'scan:run',
  'requirement:create', 'analysis:create', 'analysis:create-derived',
  'analysis:finalize', 'review:write', 'clarification:write', 'report:export',
];

describe('project role permission matrix', () => {
  it.each(Object.keys(expectedPermissions) as ProjectRole[])(
    'matches the documented permission set for %s',
    (role) => {
      for (const permission of allPermissions) {
        expect(projectRoleHasPermission(role, permission)).toBe(
          expectedPermissions[role].includes(permission),
        );
      }
    },
  );
});

describe('ProjectPermissionService', () => {
  let projects: jest.Mocked<ProjectRepository>;
  let scope: jest.Mocked<ProjectScopeRepository>;
  let service: ProjectPermissionService;

  const actor = {
    id: 'user-1',
    email: 'user@test.local',
    role: 'REVIEWER' as const,
    name: 'User',
  };

  beforeEach(() => {
    projects = {
      findProjectMember: jest.fn(),
    } as unknown as jest.Mocked<ProjectRepository>;
    scope = {
      findAnalysisProjectId: jest.fn(),
      findRequirementProjectId: jest.fn(),
      findRequirementRevisionProjectId: jest.fn(),
      findRepositoryProjectId: jest.fn(),
      findScanJobProjectId: jest.fn(),
      findClarificationProjectId: jest.fn(),
      findReviewClarificationProjectId: jest.fn(),
      findReviewDecisionProjectId: jest.fn(),
      findInsightProjectId: jest.fn(),
      findTraceabilityLinkProjectId: jest.fn(),
    } as unknown as jest.Mocked<ProjectScopeRepository>;

    service = new ProjectPermissionService(projects, scope);
  });

  it('allows OWNER all permissions', async () => {
    projects.findProjectMember.mockResolvedValue({ role: 'OWNER' } as never);

    await expect(
      service.assertPermission(actor, 'project-1', 'scan:run'),
    ).resolves.toBeUndefined();
    await expect(
      service.assertPermission(actor, 'project-1', 'analysis:finalize'),
    ).resolves.toBeUndefined();
  });

  it('allows MAINTAINER repository and scan permissions but not review write', async () => {
    projects.findProjectMember.mockResolvedValue({ role: 'MAINTAINER' } as never);

    await expect(
      service.assertPermission(actor, 'project-1', 'repository:manage'),
    ).resolves.toBeUndefined();
    await expect(
      service.assertPermission(actor, 'project-1', 'scan:run'),
    ).resolves.toBeUndefined();
    await expect(
      service.assertPermission(actor, 'project-1', 'review:write'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows ANALYST create/finalize but not repository manage', async () => {
    projects.findProjectMember.mockResolvedValue({ role: 'ANALYST' } as never);

    await expect(
      service.assertPermission(actor, 'project-1', 'requirement:create'),
    ).resolves.toBeUndefined();
    await expect(
      service.assertPermission(actor, 'project-1', 'analysis:create'),
    ).resolves.toBeUndefined();
    await expect(
      service.assertPermission(actor, 'project-1', 'analysis:finalize'),
    ).resolves.toBeUndefined();
    await expect(
      service.assertPermission(actor, 'project-1', 'repository:manage'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows REVIEWER review/clarification/derived export but not base analysis create', async () => {
    projects.findProjectMember.mockResolvedValue({ role: 'REVIEWER' } as never);

    await expect(
      service.assertPermission(actor, 'project-1', 'review:write'),
    ).resolves.toBeUndefined();
    await expect(
      service.assertPermission(actor, 'project-1', 'clarification:write'),
    ).resolves.toBeUndefined();
    await expect(
      service.assertPermission(actor, 'project-1', 'analysis:create-derived'),
    ).resolves.toBeUndefined();
    await expect(
      service.assertPermission(actor, 'project-1', 'analysis:create'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows VIEWER read/export only', async () => {
    projects.findProjectMember.mockResolvedValue({ role: 'VIEWER' } as never);

    await expect(
      service.assertPermission(actor, 'project-1', 'project:read'),
    ).resolves.toBeUndefined();
    await expect(
      service.assertPermission(actor, 'project-1', 'report:export'),
    ).resolves.toBeUndefined();
    await expect(
      service.assertPermission(actor, 'project-1', 'review:write'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns 404 when actor has no membership', async () => {
    projects.findProjectMember.mockResolvedValue(null);

    await expect(
      service.assertPermission(actor, 'project-1', 'project:read'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns 404 for cross-project analysis access without leaking existence', async () => {
    scope.findAnalysisProjectId.mockResolvedValue('project-2');
    projects.findProjectMember.mockResolvedValue(null);

    await expect(
      service.assertCanReadAnalysis(actor, 'analysis-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns 404 for a review decision outside actor membership scope', async () => {
    scope.findReviewDecisionProjectId.mockResolvedValue('project-2');
    projects.findProjectMember.mockResolvedValue(null);

    await expect(
      service.assertPermissionForReviewDecision(
        actor,
        'decision-1',
        'clarification:write',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
