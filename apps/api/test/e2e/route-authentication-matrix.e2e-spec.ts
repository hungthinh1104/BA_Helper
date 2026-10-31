import type { INestApplication } from '@nestjs/common';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ModulesContainer } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@ba-helper/backend-runtime/prisma';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { IS_PUBLIC_KEY, OPTIONAL_AUTH_KEY } from '../../src/modules/auth/application/jwt-auth.guard';
import { ROLES_KEY } from '../../src/modules/auth/api/roles.decorator';
import { createTestApp } from './helpers/test-app';

const EXPECTED_HTTP_ROUTE_COUNT = 105;

const EXPECTED_PUBLIC_ROUTES = [
  'GET /api/v1/system/live',
  'GET /api/v1/system/ready',
  'GET /api/v1/workspace/current',
  'POST /api/v1/auth/login',
  'POST /api/v1/auth/dev-login',
];

const EXPECTED_ROLE_ROUTES: Record<string, readonly string[]> = {
  'GET /api/v1/auth/accounts': ['ADMIN'],
  'GET /api/v1/auth/accounts/audit': ['ADMIN'],
  'GET /api/v1/auth/accounts/:userId': ['ADMIN'],
  'POST /api/v1/auth/accounts': ['ADMIN'],
  'POST /api/v1/auth/accounts/:userId/reset-password': ['ADMIN'],
  'POST /api/v1/auth/accounts/:userId/disable': ['ADMIN'],
  'POST /api/v1/auth/accounts/:userId/enable': ['ADMIN'],
  'POST /api/v1/auth/accounts/:userId/role': ['ADMIN'],
  'POST /api/v1/projects': ['ADMIN'],
  'GET /api/v1/system/operations': ['ADMIN'],
  'POST /api/v1/system/queues/:queueName/failed/:jobId/retry': ['ADMIN'],
  'POST /api/v1/analyses/:analysisId/localization': ['ADMIN', 'REVIEWER'],
};

type Route = {
  controllerName: string;
  handlerName: string;
  method: HttpMethod;
  path: string;
  isPublic: boolean;
  optionalAuth: boolean;
  roles: string[];
};

type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options' | 'head';

describe('API route authentication inventory (PostgreSQL-backed app)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let viewerToken: string;
  let reviewerToken: string;
  let testUserIds: string[];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const jwt = app.get(JwtService);
    const [viewer, reviewer] = await Promise.all([
      prisma.user.create({
        data: { email: `route-auth-viewer-${randomUUID()}@ba-helper.local`, name: 'Route Auth Viewer', role: 'VIEWER' },
      }),
      prisma.user.create({
        data: { email: `route-auth-reviewer-${randomUUID()}@ba-helper.local`, name: 'Route Auth Reviewer', role: 'REVIEWER' },
      }),
    ]);
    testUserIds = [viewer.id, reviewer.id];
    viewerToken = jwt.sign({ sub: viewer.id, email: viewer.email, role: viewer.role });
    reviewerToken = jwt.sign({ sub: reviewer.id, email: reviewer.email, role: reviewer.role });
  }, 120_000);

  afterAll(async () => {
    if (testUserIds?.length) await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });
    await app?.close();
  });

  it('classifies every HTTP route and keeps the public and global-role surfaces explicit', () => {
    const routes = collectRoutes(app);
    const routeKeys = routes.map(routeKey);
    expect(routes).toHaveLength(EXPECTED_HTTP_ROUTE_COUNT);
    expect(new Set(routeKeys).size).toBe(routeKeys.length);

    expect(routes.filter((route) => route.isPublic).map(routeKey).sort())
      .toEqual([...EXPECTED_PUBLIC_ROUTES].sort());
    expect(routes.filter((route) => route.optionalAuth).map(routeKey))
      .toEqual(['GET /api/v1/workspace/current']);

    const actualRoleRoutes = Object.fromEntries(
      routes.filter((route) => route.roles.length > 0)
        .map((route) => [routeKey(route), route.roles]),
    );
    expect(actualRoleRoutes).toEqual(EXPECTED_ROLE_ROUTES);
  });

  it('returns 401 for every non-public HTTP route before resource lookup or mutation', async () => {
    const protectedRoutes = collectRoutes(app).filter((route) => !route.isPublic);
    expect(protectedRoutes).toHaveLength(EXPECTED_HTTP_ROUTE_COUNT - EXPECTED_PUBLIC_ROUTES.length);

    for (const route of protectedRoutes) {
      const path = route.path.replace(/:([A-Za-z0-9_]+)/g, (_match, name: string) => `auth-probe-${name}`);
      const client = request(app.getHttpServer());
      const response = await sendRequest(client, route.method, path);
      expect(response.status).toBe(401);
    }
  }, 60_000);

  it('enforces each declared global role on its concrete HTTP route', async () => {
    const tokensByRole = { REVIEWER: reviewerToken, VIEWER: viewerToken } as const;
    const client = request(app.getHttpServer());
    for (const route of collectRoutes(app).filter((item) => item.roles.length > 0)) {
      const path = route.path.replace(/:([A-Za-z0-9_]+)/g, (_match, name: string) => `auth-probe-${name}`);
      const deniedRoles = Object.keys(tokensByRole).filter((role) => !route.roles.includes(role));
      for (const role of deniedRoles) {
        const response = await sendRequest(client, route.method, path)
          .set('Authorization', `Bearer ${tokensByRole[role as keyof typeof tokensByRole]}`)
          .send({});
        expect(response.status).toBe(403);
      }

      if (route.roles.includes('REVIEWER')) {
        const reviewerResponse = await sendRequest(client, route.method, path)
          .set('Authorization', `Bearer ${reviewerToken}`)
          .send({});
        expect(reviewerResponse.status).not.toBe(401);
        expect(reviewerResponse.status).not.toBe(403);
      }
    }
  }, 60_000);
});

function collectRoutes(app: INestApplication): Route[] {
  const routes: Route[] = [];
  for (const module of app.get(ModulesContainer).values()) {
    for (const wrapper of module.controllers.values()) {
      const controller = wrapper.metatype;
      if (!controller) continue;
      const controllerPaths = asPaths(Reflect.getMetadata(PATH_METADATA, controller));
      for (const handlerName of Object.getOwnPropertyNames(controller.prototype)) {
        const handler = controller.prototype[handlerName];
        if (handlerName === 'constructor' || typeof handler !== 'function') continue;
        const requestMethod = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
        if (requestMethod === undefined) continue;
        const method = methodName(requestMethod);
        const handlerPaths = asPaths(Reflect.getMetadata(PATH_METADATA, handler));
        for (const controllerPath of controllerPaths) {
          for (const handlerPath of handlerPaths) {
            routes.push({
              controllerName: controller.name,
              handlerName,
              method,
              path: joinPaths(controllerPath, handlerPath),
              isPublic: readBooleanMetadata(IS_PUBLIC_KEY, handler, controller),
              optionalAuth: readBooleanMetadata(OPTIONAL_AUTH_KEY, handler, controller),
              roles: Reflect.getMetadata(ROLES_KEY, handler) ?? Reflect.getMetadata(ROLES_KEY, controller) ?? [],
            });
          }
        }
      }
    }
  }
  return routes.sort((left, right) => routeKey(left).localeCompare(routeKey(right)));
}

function readBooleanMetadata(key: string, handler: object, controller: object): boolean {
  return Reflect.getMetadata(key, handler) ?? Reflect.getMetadata(key, controller) ?? false;
}

function asPaths(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  return [value === undefined ? '' : String(value)];
}

function joinPaths(controllerPath: string, handlerPath: string): string {
  const joined = `/${[controllerPath, handlerPath].filter(Boolean).join('/')}`;
  return joined.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
}

function methodName(method: RequestMethod): HttpMethod {
  const methods: Partial<Record<RequestMethod, HttpMethod>> = {
    [RequestMethod.GET]: 'get',
    [RequestMethod.POST]: 'post',
    [RequestMethod.PUT]: 'put',
    [RequestMethod.DELETE]: 'delete',
    [RequestMethod.PATCH]: 'patch',
    [RequestMethod.OPTIONS]: 'options',
    [RequestMethod.HEAD]: 'head',
  };
  const name = methods[method];
  if (!name) throw new Error(`Route uses unsupported HTTP method metadata: ${method}`);
  return name;
}

function routeKey(route: Pick<Route, 'method' | 'path'>): string {
  return `${route.method.toUpperCase()} ${route.path}`;
}

function sendRequest(
  client: ReturnType<typeof request>,
  method: HttpMethod,
  path: string,
) {
  switch (method) {
    case 'get': return client.get(path);
    case 'post': return client.post(path);
    case 'put': return client.put(path);
    case 'delete': return client.delete(path);
    case 'patch': return client.patch(path);
    case 'options': return client.options(path);
    case 'head': return client.head(path);
  }
}
