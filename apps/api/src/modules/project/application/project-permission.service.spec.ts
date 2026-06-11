import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProjectPermissionService } from './project-permission.service';
import { ProjectRepository } from '../infrastructure/project.repository';
import { ProjectScopeRepository } from '../infrastructure/project-scope.repository';

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
});
