import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProjectRole, RequestUser } from '@ba-helper/contracts';
import { ProjectRepository } from '../infrastructure/project.repository';
import { ProjectScopeRepository } from '../infrastructure/project-scope.repository';
import {
  ProjectPermission,
  projectRoleHasPermission,
} from './project-permission.policy';

@Injectable()
export class ProjectPermissionService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly scope: ProjectScopeRepository,
  ) {}

  async getMembershipRole(
    actor: RequestUser,
    projectId: string,
  ): Promise<ProjectRole | null> {
    const member = await this.projects.findProjectMember(projectId, actor.id);
    return (member?.role as ProjectRole | undefined) ?? null;
  }

  async assertCanReadProject(actor: RequestUser, projectId: string): Promise<void> {
    await this.assertPermission(actor, projectId, 'project:read', 'Project');
  }

  async assertPermission(
    actor: RequestUser,
    projectId: string,
    permission: ProjectPermission,
    resourceLabel = 'Project',
  ): Promise<void> {
    const role = await this.getMembershipRole(actor, projectId);
    if (!role) {
      throw new NotFoundException(`${resourceLabel} not found.`);
    }
    if (!projectRoleHasPermission(role, permission)) {
      throw new ForbiddenException(
        `Project role '${role}' does not allow '${permission}'.`,
      );
    }
  }

  async assertCanReadAnalysis(actor: RequestUser, analysisId: string): Promise<void> {
    await this.assertPermissionForScopedResource(
      actor,
      () => this.scope.findAnalysisProjectId(analysisId),
      'project:read',
      'Impact analysis',
    );
  }

  async assertCanReadMultiRepoRun(
    actor: RequestUser,
    runId: string,
  ): Promise<void> {
    await this.assertPermissionForScopedResource(
      actor,
      () => this.scope.findMultiRepoRunProjectId(runId),
      'project:read',
      'Multi-repo analysis run',
    );
  }

  async assertPermissionForMultiRepoRun(
    actor: RequestUser,
    runId: string,
    permission: ProjectPermission,
  ): Promise<void> {
    await this.assertPermissionForScopedResource(
      actor,
      () => this.scope.findMultiRepoRunProjectId(runId),
      permission,
      'Multi-repo analysis run',
    );
  }

  async assertPermissionForAnalysis(
    actor: RequestUser,
    analysisId: string,
    permission: ProjectPermission,
  ): Promise<void> {
    await this.assertPermissionForScopedResource(
      actor,
      () => this.scope.findAnalysisProjectId(analysisId),
      permission,
      'Impact analysis',
    );
  }

  async assertCanReadRequirement(
    actor: RequestUser,
    requirementId: string,
    expectedProjectId?: string,
  ): Promise<void> {
    await this.assertCanReadScopedResource(
      actor,
      () => this.scope.findRequirementProjectId(requirementId),
      'Requirement',
      expectedProjectId,
    );
  }

  async assertPermissionForRequirement(
    actor: RequestUser,
    requirementId: string,
    permission: ProjectPermission,
  ): Promise<void> {
    await this.assertPermissionForScopedResource(
      actor,
      () => this.scope.findRequirementProjectId(requirementId),
      permission,
      'Requirement',
    );
  }

  async assertPermissionForRequirementRevision(
    actor: RequestUser,
    revisionId: string,
    permission: ProjectPermission,
  ): Promise<void> {
    await this.assertPermissionForScopedResource(
      actor,
      () => this.scope.findRequirementRevisionProjectId(revisionId),
      permission,
      'Requirement revision',
    );
  }

  async assertCanReadRepository(
    actor: RequestUser,
    repositoryId: string,
    expectedProjectId?: string,
  ): Promise<void> {
    await this.assertCanReadScopedResource(
      actor,
      () => this.scope.findRepositoryProjectId(repositoryId),
      'Repository',
      expectedProjectId,
    );
  }

  async assertPermissionForRepository(
    actor: RequestUser,
    repositoryId: string,
    permission: ProjectPermission,
  ): Promise<void> {
    await this.assertPermissionForScopedResource(
      actor,
      () => this.scope.findRepositoryProjectId(repositoryId),
      permission,
      'Repository',
    );
  }

  async assertCanReadScanJob(actor: RequestUser, scanJobId: string): Promise<void> {
    await this.assertPermissionForScopedResource(
      actor,
      () => this.scope.findScanJobProjectId(scanJobId),
      'project:read',
      'Scan job',
    );
  }

  async assertCanReadSnapshot(
    actor: RequestUser,
    snapshotId: string,
  ): Promise<void> {
    await this.assertPermissionForScopedResource(
      actor,
      () => this.scope.findSnapshotProjectId(snapshotId),
      'project:read',
      'Repository snapshot',
    );
  }

  async assertPermissionForClarification(
    actor: RequestUser,
    clarificationId: string,
    permission: ProjectPermission,
  ): Promise<void> {
    await this.assertPermissionForScopedResource(
      actor,
      () => this.scope.findClarificationProjectId(clarificationId),
      permission,
      'Clarification',
    );
  }

  async assertPermissionForReviewClarification(
    actor: RequestUser,
    clarificationId: string,
    permission: ProjectPermission,
  ): Promise<void> {
    await this.assertPermissionForScopedResource(
      actor,
      () => this.scope.findReviewClarificationProjectId(clarificationId),
      permission,
      'Review clarification',
    );
  }

  async assertPermissionForInsight(
    actor: RequestUser,
    insightId: string,
    permission: ProjectPermission,
  ): Promise<void> {
    await this.assertPermissionForScopedResource(
      actor,
      () => this.scope.findInsightProjectId(insightId),
      permission,
      'Insight',
    );
  }

  async assertPermissionForTraceabilityLink(
    actor: RequestUser,
    linkId: string,
    permission: ProjectPermission,
  ): Promise<void> {
    await this.assertPermissionForScopedResource(
      actor,
      () => this.scope.findTraceabilityLinkProjectId(linkId),
      permission,
      'Traceability link',
    );
  }

  private async assertCanReadScopedResource(
    actor: RequestUser,
    findProjectId: () => Promise<string | null>,
    resourceLabel: string,
    expectedProjectId?: string,
  ): Promise<void> {
    const projectId = await findProjectId();
    if (!projectId || (expectedProjectId && expectedProjectId !== projectId)) {
      throw new NotFoundException(`${resourceLabel} not found.`);
    }
    await this.assertPermission(actor, projectId, 'project:read', resourceLabel);
  }

  private async assertPermissionForScopedResource(
    actor: RequestUser,
    findProjectId: () => Promise<string | null>,
    permission: ProjectPermission,
    resourceLabel: string,
  ): Promise<void> {
    const projectId = await findProjectId();
    if (!projectId) {
      throw new NotFoundException(`${resourceLabel} not found.`);
    }
    await this.assertPermission(actor, projectId, permission, resourceLabel);
  }
}
