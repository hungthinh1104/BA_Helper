import { Body, Controller, Param, Post, Get, Query, BadRequestException } from '@nestjs/common';
import {
  repositoryCreateRequestSchema,
  repositoryCreateResponseSchema,
  repositoryListResponseSchema,
  repositoryDetailResponseSchema,
  paginationQuerySchema,
  RequestUser,
} from '@ba-helper/contracts';
import { CreateRepositoryUseCase } from '../application/create-repository.usecase';
import { ListRepositoriesUseCase } from '../application/list-repositories.usecase';
import { GetRepositoryUseCase } from '../application/get-repository.usecase';
import { Roles } from '../../auth/api/roles.decorator';
import { CurrentUser } from '../../auth/api/current-user.decorator';
import { ProjectPermissionService } from '../../project/application/project-permission.service';

@Controller('/api/v1/projects/:projectId/repositories')
export class RepositoryController {
  constructor(
    private readonly createRepository: CreateRepositoryUseCase,
    private readonly listRepositories: ListRepositoriesUseCase,
    private readonly getRepository: GetRepositoryUseCase,
    private readonly permissions: ProjectPermissionService,
  ) {}

  private mapRepositoryProfile(profile: any) {
    if (!profile) {
      return undefined;
    }

    return {
      domain: profile.domain,
      language: profile.language,
      framework: profile.framework,
      architectureStyle: profile.architectureStyle,
      sourceRoots: Array.isArray(profile.sourceRoots) ? profile.sourceRoots : [],
      testRoots: Array.isArray(profile.testRoots) ? profile.testRoots : [],
      diagnostics: profile.diagnostics ?? undefined,
      profileVersion: profile.profileVersion,
    };
  }

  private mapRepository(r: any) {
    const latestScanJob = r.scanJobs?.[0];
    const latestSnapshot = r.snapshots?.[0];
    const latestTarget = r.targets?.[0];
    return {
      id: r.id,
      canonicalUrl: r.canonicalUrl,
      displayName: r.canonicalUrl.split('/').pop() || r.canonicalUrl,
      framework: latestSnapshot?.profile?.framework ?? undefined,
      lastObservedAt: latestTarget?.lastObservedAt?.toISOString(),
      isConnected: true,
      latestTarget: latestTarget ? {
        id: latestTarget.id,
        requestedRef: latestTarget.requestedRef,
        resolvedCommitSha: latestTarget.latestObservedCommitSha ?? undefined,
      } : undefined,
      latestScanJob: latestScanJob ? {
        id: latestScanJob.id,
        status: latestScanJob.status,
        stage: latestScanJob.stage,
        progress: latestScanJob.progress,
        canCancel: latestScanJob.status === 'QUEUED' || latestScanJob.status === 'RUNNING',
        diagnostics: latestScanJob.diagnostics ?? undefined,
        error: latestScanJob.errorCode
          ? {
              code: latestScanJob.errorCode,
              message: latestScanJob.errorMessage ?? '',
            }
          : null,
      } : undefined,
      latestSnapshot: latestSnapshot ? {
        id: latestSnapshot.id,
        commitSha: latestSnapshot.commitSha,
        analyzerVersion: latestSnapshot.analyzerVersion,
        coverageStatus: latestSnapshot.coverageStatus,
        indexStatus: latestSnapshot.indexStatus,
        diagnostics: latestSnapshot.diagnostics ?? undefined,
        profile: this.mapRepositoryProfile(latestSnapshot.profile),
      } : undefined,
      createdAt: r.createdAt.toISOString(),
    };
  }

  private summarizeArtifactStats(artifacts: Array<{ universalKind?: string }>) {
    return {
      controllers: artifacts.filter((artifact) => artifact.universalKind === 'API_ENDPOINT').length,
      services: artifacts.filter((artifact) => artifact.universalKind === 'DOMAIN_SERVICE').length,
      entities: artifacts.filter((artifact) => artifact.universalKind === 'DATA_MODEL').length,
      tests: artifacts.filter((artifact) => artifact.universalKind === 'TEST_CASE').length,
    };
  }

  @Post()
  @Roles('ADMIN')
  async create(
    @Param('projectId') projectId: string,
    @Body() body: unknown,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertPermission(
      actor,
      projectId,
      'repository:manage',
      'Project',
    );
    const input = repositoryCreateRequestSchema.parse(body);
    const repository = await this.createRepository.execute({
      projectId,
      url: input.url,
    });

    const response = repositoryCreateResponseSchema.parse({
      repositoryId: repository.id,
      projectId: repository.projectId,
      canonicalUrl: repository.canonicalUrl,
      createdAt: repository.createdAt.toISOString(),
    });

    return response;
  }

  @Get()
  async list(
    @Param('projectId') projectId: string,
    @Query() query: unknown,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertCanReadProject(actor, projectId);
    const parsedQuery = paginationQuerySchema.safeParse(query);
    if (!parsedQuery.success) {
      throw new BadRequestException(parsedQuery.error.errors);
    }
    const { limit, offset } = parsedQuery.data;

    const repositories = await this.listRepositories.execute({ projectId, limit, offset });
    return repositoryListResponseSchema.parse({
      items: repositories.map((r) => this.mapRepository(r)),
    });
  }

  @Get('/:repositoryId')
  async getDetail(
    @Param('projectId') projectId: string,
    @Param('repositoryId') repositoryId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertCanReadRepository(
      actor,
      repositoryId,
      projectId,
    );
    const r = await this.getRepository.execute({ repositoryId });
    const artifacts = (r as any).snapshots?.[0]?.artifacts || [];
    const artifactStats = this.summarizeArtifactStats(artifacts);

    return repositoryDetailResponseSchema.parse({
      ...this.mapRepository(r),
      artifactStats,
    });
  }
}
