import type { INestApplication } from '@nestjs/common';
import { spawnSync } from 'node:child_process';
import request from 'supertest';
import { createTestApp } from './helpers/test-app';

describe('Scalar API documentation', () => {
  let app: INestApplication;
  beforeAll(async () => { app = await createTestApp(); });
  afterAll(async () => { await app?.close(); });

  it('serves a valid OpenAPI document with concrete schemas for every operation', async () => {
    const { body } = await request(app.getHttpServer()).get('/api/openapi.json').expect(200);
    // Native Node 22 supports the validator's ESM dependencies; Jest 30 does not.
    // Pass JSON over stdin, never through shell interpolation or executable code.
    const validation = spawnSync(process.execPath, ['-e', `
      const Parser = require(process.argv[1]);
      let input = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', data => { input += data; });
      process.stdin.on('end', async () => {
        try { await Parser.validate(JSON.parse(input), { resolve: { external: false } }); }
        catch (error) { console.error(error.message); process.exitCode = 1; }
      });
    `, require.resolve('@apidevtools/swagger-parser')], {
      input: JSON.stringify(body), encoding: 'utf8', timeout: 30_000, windowsHide: true,
    });
    expect(validation.error).toBeUndefined();
    expect({ status: validation.status, errors: validation.stderr }).toEqual({ status: 0, errors: '' });
    expect(body.servers).toEqual([{ url: '/', description: 'Current API origin' }]);
    expect(body.components.securitySchemes.bearerAuth).toMatchObject({ type: 'http', scheme: 'bearer' });
    const ids: string[] = [];
    for (const [path, item] of Object.entries(body.paths) as [string, Record<string, any>][]) {
      for (const [method, operation] of Object.entries(item)) {
        if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
        ids.push(operation.operationId);
        expect(operation.summary).toBeTruthy();
        expect(operation.tags).toHaveLength(1);
        const success = Object.entries(operation.responses).filter(([code]) => /^2\d\d$/.test(code));
        expect(success).toHaveLength(1);
        const returnsOk = path.endsWith('/auth/login') || path.endsWith('/review-notes');
        expect(success[0][0]).toBe(method === 'post' && !returnsOk ? '201' : '200');
        expect(Object.keys((success[0][1] as any).content)).toHaveLength(1);
        for (const name of [...path.matchAll(/\{([^}]+)\}/g)].map(match => match[1])) {
          expect(operation.parameters).toEqual(expect.arrayContaining([
            expect.objectContaining({ name, in: 'path', required: true, schema: expect.any(Object) }),
          ]));
        }
      }
    }
    expect(ids.length).toBeGreaterThan(90);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('documents real login status, optional workspace auth, query bounds and file downloads', async () => {
    const { body: spec } = await request(app.getHttpServer()).get('/api/openapi.json').expect(200);
    const login = spec.paths['/api/v1/auth/login'].post;
    expect(login.security).toEqual([]);
    expect(login.responses['401']).toBeDefined();
    expect(login.responses['429']).toBeDefined();
    expect(login.requestBody.content['application/json'].schema.$ref).toContain('loginRequest');
    expect(spec.paths['/api/v1/auth/dev-login'].post.responses['201']).toBeDefined();
    expect(spec.paths['/api/v1/workspace/current'].get.security).toEqual([{}, { bearerAuth: [] }]);
    expect(spec.paths['/api/v1/workspace/current'].get.responses['401']).toBeDefined();
    expect(spec.paths['/api/v1/workspace/select-project'].post.responses['400'].description)
      .toContain('Request body, query or path input is invalid.');
    expect(spec.paths['/api/v1/impact-analyses/{analysisId}/finalize'].post.responses['409']).toBeDefined();
    expect(spec.paths['/api/v1/impact-analyses/{analysisId}/finalize'].post.description).toContain('document job');
    expect(spec.paths['/api/v1/projects/{projectId}/analyses'].get.parameters).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'limit', in: 'query', schema: expect.objectContaining({ maximum: 100 }) })]),
    );
    const pdf = spec.paths['/api/v1/impact-analyses/{analysisId}/approved-report/export.pdf'].get.responses['200'];
    expect(pdf.content['application/pdf'].schema).toEqual({ type: 'string', format: 'binary' });
    expect(pdf.headers['Content-Disposition']).toBeDefined();
    const qa = spec.paths['/api/v1/impact-analyses/{analysisId}/qa-coverage'].get;
    expect(qa.description).toContain('static');
    expect(qa.description).toContain('execution');
  });

  it('serves Scalar and its pinned browser asset locally without matching unknown docs paths', async () => {
    const docs = await request(app.getHttpServer()).get('/api/docs').expect(200).expect('Content-Type', /html/);
    expect(docs.text).toContain('/api/openapi.json');
    expect(docs.text).toContain('/api/docs/scalar.js');
    expect(docs.text).not.toContain('cdn.jsdelivr.net');
    const asset = await request(app.getHttpServer()).get('/api/docs/scalar.js').expect(200);
    expect(asset.headers['content-type']).toMatch(/javascript/);
    expect(asset.text.length).toBeGreaterThan(100_000);
    await request(app.getHttpServer()).post('/api/docs').expect(404);
    await request(app.getHttpServer()).get('/api/docs/missing').expect(404);
  });
});
