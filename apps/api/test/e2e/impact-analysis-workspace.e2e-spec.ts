import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
	analysisWorkspaceResponseSchema,
	impactAnalysisResponseSchema,
	projectCreateResponseSchema,
	repositoryCreateResponseSchema,
	requirementCreateResponseSchema,
	requirementRevisionCreateResponseSchema,
	scanJobResponseSchema,
} from '@ba-helper/contracts';
import * as crypto from 'crypto';
import request from 'supertest';
import { PrismaService } from '../../src/modules/prisma/prisma.service';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';
import {
	seedImpactAnalysisCompletion,
	seedScanJobCompletion,
} from './helpers/seed-fixture';

describe('Impact Analysis Workspace (E2E)', () => {
	let app: INestApplication;
	let prisma: PrismaService;
	let jwtService: JwtService;
	let adminToken: string;

	beforeAll(async () => {
		app = await createTestApp();
		prisma = app.get(PrismaService);
		jwtService = app.get(JwtService);
	});

	afterAll(async () => {
		await prisma.$disconnect();
		await app.close();
	});

	beforeEach(async () => {
		await resetDatabase(prisma);
		const user = await prisma.user.create({
			data: {
				id: crypto.randomUUID(),
				email: 'admin@ba-helper.local',
				name: 'John Doe',
				role: 'ADMIN',
			},
		});
		adminToken = jwtService.sign({
			sub: user.id,
			email: user.email,
			role: user.role,
		});
	});

	it('returns the analysis workspace presentation read model', async () => {
		const analysisId = await seedAnalysis();

		const workspaceRes = await request(app.getHttpServer())
			.get(`/api/v1/impact-analyses/${analysisId}/workspace`)
			.set('Authorization', `Bearer ${adminToken}`)
			.expect(200);

		const workspace = analysisWorkspaceResponseSchema.parse(workspaceRes.body);
		expect(workspace.overview.analysisId).toBe(analysisId);
		expect(workspace.overview.status.reportStatus).toBe('missing');
		expect(workspace.overview.status.driftStatus).toBe('fresh');
		expect(workspace.reviewQueue).toHaveLength(1);
		expect(workspace.evidenceCards[0]).toMatchObject({
			filePath: 'src/mock.ts',
			lineRange: { startLine: null, endLine: null },
		});
	});

	async function seedAnalysis() {
		const createProjectRes = await request(app.getHttpServer())
			.post('/api/v1/projects')
			.set('Authorization', `Bearer ${adminToken}`)
			.send({ name: 'Workspace Project' })
			.expect(201);
		const project = projectCreateResponseSchema.parse(createProjectRes.body);

		const createRepoRes = await request(app.getHttpServer())
			.post(`/api/v1/projects/${project.projectId}/repositories`)
			.set('Authorization', `Bearer ${adminToken}`)
			.send({ url: 'https://github.com/mock/repo' })
			.expect(201);
		const repository = repositoryCreateResponseSchema.parse(createRepoRes.body);

		const createScanJobRes = await request(app.getHttpServer())
			.post(`/api/v1/repositories/${repository.repositoryId}/scan-jobs`)
			.set('Authorization', `Bearer ${adminToken}`)
			.send({
				requestKey: crypto.randomUUID(),
				requestedRef: 'main',
			})
			.expect(201);
		const scanJob = scanJobResponseSchema.parse(createScanJobRes.body);
		const { snapshot, target } = await seedScanJobCompletion(prisma, scanJob.id);

		const createRequirementRes = await request(app.getHttpServer())
			.post(`/api/v1/projects/${project.projectId}/requirements`)
			.set('Authorization', `Bearer ${adminToken}`)
			.send({
				title: 'Refund API',
				rawText: 'Allow users to cancel and refund bookings.',
			})
			.expect(201);
		const requirement = requirementCreateResponseSchema.parse(
			createRequirementRes.body,
		);

		const createRevisionRes = await request(app.getHttpServer())
			.post(`/api/v1/requirements/${requirement.requirementId}/revisions`)
			.set('Authorization', `Bearer ${adminToken}`)
			.send({
				title: 'Refund API (Final)',
				rawText: 'Allow users to cancel and refund bookings.',
				readinessStatus: 'READY_FOR_ANALYSIS',
			})
			.expect(201);
		const revision = requirementRevisionCreateResponseSchema.parse(
			createRevisionRes.body,
		);

		const createAnalysisRes = await request(app.getHttpServer())
			.post(`/api/v1/requirement-revisions/${revision.revisionId}/impact-analyses`)
			.set('Authorization', `Bearer ${adminToken}`)
			.send({
				snapshotId: snapshot.id,
				sourceTargetId: target.id,
				allowPartialSnapshot: false,
				requestKey: crypto.randomUUID(),
			})
			.expect(201);
		const analysis = impactAnalysisResponseSchema.parse(createAnalysisRes.body);
		await seedImpactAnalysisCompletion(prisma, analysis.id);
		return analysis.id;
	}
});
