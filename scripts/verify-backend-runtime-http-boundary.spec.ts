import { findHttpBoundaryViolationsInSource } from './verify-backend-runtime-http-boundary';

describe('backend-runtime HTTP boundary', () => {
  it('ignores source-looking decorators inside evidence strings and comments', () => {
    const source = [
      "const evidence = `excerpt:\\n@Post('cancel')\\nfile: controller.ts`;",
      "// @Controller() is a sample from the analyzed repository",
    ].join('\n');
    expect(findHttpBoundaryViolationsInSource(source, 'fake-ai.provider.spec.ts')).toEqual([]);
  });

  it('rejects actual decorators and aliased Nest HTTP imports', () => {
    const source = [
      "import { Post as RoutePost } from '@nestjs/common';",
      "class ControllerLike { @RoutePost('cancel') cancel() {} }",
      '@Controller() class AnotherController {}',
    ].join('\n');
    const violations = findHttpBoundaryViolationsInSource(source, 'controller-like.ts');
    expect(violations.map(item => item.symbol)).toContain('Post');
    expect(violations.map(item => item.symbol)).toContain('Controller');
  });

  it('rejects HTTP decorators through a Nest namespace import', () => {
    const source = [
      "import * as nest from '@nestjs/common';",
      "class HttpTransport { @nest.Post('cancel') cancel() {} }",
    ].join('\n');
    const violations = findHttpBoundaryViolationsInSource(source, 'namespace-http-transport.ts');

    expect(violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'HTTP_DECORATOR', symbol: 'Post' }),
    ]));
  });

  it('rejects HTTP parameter, status, and route decorators', () => {
    const source = [
      "import { Body as RequestBody, All, HttpCode } from '@nestjs/common';",
      "class HttpTransport { @All('') @HttpCode(202) run(@RequestBody() payload: unknown) { return payload; } }",
    ].join('\n');
    const violations = findHttpBoundaryViolationsInSource(source, 'http-transport.ts');

    expect(violations.map(item => item.symbol)).toEqual(expect.arrayContaining(['Body', 'All', 'HttpCode']));
  });

  it('rejects API imports and guard identifiers outside strings', () => {
    const source = [
      "import { JwtAuthGuard } from '../../../../apps/api/src/auth/jwt-auth.guard';",
      'const guard = JwtAuthGuard;',
    ].join('\n');
    const violations = findHttpBoundaryViolationsInSource(source, 'guard.ts');
    expect(violations.some(item => item.kind === 'API_IMPORT')).toBe(true);
    expect(violations.some(item => item.symbol === 'JwtAuthGuard')).toBe(true);
  });

  it('rejects Nest guard contracts and global HTTP guard registration', () => {
    const source = [
      "import { CanActivate, ExecutionContext } from '@nestjs/common';",
      "import { APP_GUARD } from '@nestjs/core';",
      'class TenantGuard implements CanActivate { canActivate(context: ExecutionContext) { return true; } }',
      'const providers = [{ provide: APP_GUARD, useClass: TenantGuard }];',
    ].join('\n');
    const violations = findHttpBoundaryViolationsInSource(source, 'tenant-guard.ts');

    expect(violations.map(item => item.symbol)).toEqual(expect.arrayContaining([
      'CanActivate', 'ExecutionContext', 'APP_GUARD',
    ]));
  });

  it('rejects HTTP server framework imports and arbitrary API guard dependencies', () => {
    const source = [
      "import type { Request } from 'express';",
      "import type { FastifyInstance } from 'fastify';",
      "import { TenantGuard as Guard } from '../../apps/api/src/auth/tenant.guard';",
    ].join('\n');
    const violations = findHttpBoundaryViolationsInSource(source, 'http-framework.ts');

    expect(violations.map(item => item.symbol)).toEqual(expect.arrayContaining([
      'express', 'fastify', '../../apps/api/src/auth/tenant.guard',
    ]));
    expect(violations.some(item => item.kind === 'API_IMPORT')).toBe(true);
  });

  it('allows framework-neutral Nest modules and providers used by backend-runtime', () => {
    const source = "import { Injectable, Module } from '@nestjs/common'; @Injectable() class Provider {} @Module({}) class RuntimeModule {}";
    expect(findHttpBoundaryViolationsInSource(source, 'runtime-module.ts')).toEqual([]);
  });

  it('rejects an HTTP decorator imported through destructured CommonJS require', () => {
    const source = [
      "const { Controller: RouteController } = require('@nestjs/common');",
      '@RouteController() class HttpEndpoint {}',
    ].join('\n');
    const violations = findHttpBoundaryViolationsInSource(source, 'require-controller.ts');
    expect(violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'HTTP_IMPORT', symbol: 'Controller' }),
    ]));
  });

  it('rejects a Nest HTTP symbol read from an inline CommonJS require', () => {
    const source = "const routeDecorator = require('@nestjs/common').Controller;";
    const violations = findHttpBoundaryViolationsInSource(source, 'inline-require-controller.ts');

    expect(violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'HTTP_IMPORT', symbol: 'Controller' }),
    ]));
    expect(findHttpBoundaryViolationsInSource(
      "const controller = require('./local-helper').Controller;", 'local-helper.ts',
    )).toEqual([]);
    expect(findHttpBoundaryViolationsInSource(
      "const routeDecorator = (await import('@nestjs/common')).Controller;", 'inline-import-controller.ts',
    )).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'HTTP_IMPORT', symbol: 'Controller' }),
    ]));
  });

  it('rejects an HTTP decorator from a destructured dynamic Nest import', () => {
    const source = [
      "const { Controller: RouteController } = await import('@nestjs/common');",
      '@RouteController() class HttpEndpoint {}',
    ].join('\n');
    const violations = findHttpBoundaryViolationsInSource(source, 'dynamic-controller.ts');

    expect(violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'HTTP_IMPORT', symbol: 'Controller' }),
    ]));
  });

  it('rejects HTTP decorators destructured in a dynamic import callback', () => {
    const source = [
      "import('@nestjs/common').then(({ Controller: RouteController }) => {",
      '  @RouteController() class HttpEndpoint {}',
      '});',
    ].join('\n');
    const violations = findHttpBoundaryViolationsInSource(source, 'dynamic-callback-controller.ts');

    expect(violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'HTTP_IMPORT', symbol: 'Controller' }),
    ]));
  });

  it('rejects re-exporting HTTP decorators from the shared Nest module', () => {
    const source = "export { Controller as RouteController, Post } from '@nestjs/common';";
    const violations = findHttpBoundaryViolationsInSource(source, 'http-reexports.ts');

    expect(violations.map(item => item.symbol)).toEqual(['Controller', 'Post']);
  });
});
