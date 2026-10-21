import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import type { OperationObject, ParameterObject, ResponseObject, SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { apiErrorResponseSchema, recoverableQueueNameSchema, supportedReportLocales } from '@ba-helper/contracts';
import { apiOverview } from './api-overview';
import { authProjectDocs } from './auth-project.docs';
import { repositoryDocs } from './repository.docs';
import { analysisDocs } from './analysis.docs';
import { reviewDocs } from './review.docs';
import { reportSystemDocs } from './report-system.docs';
import { ContractSchemas } from './contract-schemas';
import { collectRouteMetadata, type RouteMetadata } from './route-metadata';
import type { OperationDoc } from './operation-doc';

const catalogue = { ...authProjectDocs, ...repositoryDocs, ...analysisDocs, ...reviewDocs, ...reportSystemDocs };
const methods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);
const requestIdHeader = { description: 'Request correlation ID (also used in server logs).', schema: { type: 'string' } };

export function buildApiDocument(app: INestApplication, version: string): OpenAPIObject {
  const config = new DocumentBuilder().setTitle('BA Helper API').setDescription(apiOverview)
    .setVersion(version).addServer('/', 'Current API origin')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Paste the accessToken returned by login.' }, 'bearerAuth').build();
  const document = SwaggerModule.createDocument(app, config, {
    autoTagControllers: false, operationIdFactory: (controller, method) => `${controller}_${method}`,
  });
  const metadata = collectRouteMetadata(app);
  const schemas = new ContractSchemas();
  const seen = new Set<string>();
  for (const [path, item] of Object.entries(document.paths)) {
    for (const [method, value] of Object.entries(item)) {
      if (!methods.has(method)) continue;
      const operation = value as OperationObject;
      const id = operation.operationId!;
      const [controller, handler] = id.split('_');
      const group = catalogue[controller];
      const doc = group?.operations[handler];
      if (!doc || !metadata.has(id) || seen.has(id)) throw new Error(`Missing or duplicate API documentation: ${id}`);
      seen.add(id);
      describeOperation(operation, doc, group.tag, metadata.get(id)!, method, path, schemas);
    }
  }
  assertCatalogueCoverage(seen);
  document.components = { ...document.components };
  applyQueryParameters(document, schemas);
  document.tags = [...new Set(Object.values(catalogue).map(group => group.tag))].map(name => ({ name }));
  return document;
}

function describeOperation(operation: OperationObject, doc: OperationDoc, tag: string,
  metadata: RouteMetadata, method: string, path: string, schemas: ContractSchemas): void {
  operation.summary = doc.summary;
  operation.tags = [tag];
  operation.description = [doc.description, doc.permission && `Required permission: ${doc.permission}.`,
    metadata.roles.length && `Required account role: ${metadata.roles.join(', ')}.`].filter(Boolean).join('\n\n');
  operation.security = metadata.optionalAuth ? [{}, { bearerAuth: [] }]
    : metadata.isPublic ? [] : [{ bearerAuth: [] }];
  operation.parameters = pathParameters(path);
  if (doc.body) operation.requestBody = {
    required: !doc.optionalBody && !doc.body.isOptional(),
    content: { 'application/json': { schema: schemas.reference(doc.body, `${operation.operationId}Request`),
      ...(doc.bodyExample === undefined ? {} : { example: doc.bodyExample }) } },
  };
  const status = metadata.status ?? (method === 'post' ? 201 : 200);
  operation.responses = {
    [status]: successResponse(doc, schemas, operation.operationId!),
    default: { description: 'Application/domain or HTTP error. See response schema and the request conventions above.',
      headers: { 'x-request-id': requestIdHeader }, content: { 'application/json': { schema: schemas.reference(apiErrorResponseSchema, 'apiErrorResponse') } } },
  };
  operation.responses['400'] = {
    description: 'Request body, query or path input is invalid.',
    headers: { 'x-request-id': requestIdHeader },
    content: { 'application/json': { schema: schemas.reference(apiErrorResponseSchema, 'apiErrorResponse') } },
  };
  if (!metadata.isPublic || metadata.optionalAuth) operation.responses['401'] = {
    description: 'Authentication is missing, invalid, expired or revoked.',
    content: { 'application/json': { schema: schemas.reference(apiErrorResponseSchema, 'apiErrorResponse') } },
  };
  const errors = {
    ...(!metadata.isPublic && doc.permission ? { 403: 'The actor has insufficient permission.' } : {}),
    ...(typeof doc.response === 'string' ? { 400: 'The report is not exportable.', 404: 'Approved report not found.', 409: 'Export is blocked by observed source staleness.' } : {}),
    ...(doc.response === 'pdf' ? { 502: 'PDF rendering failed.' } : {}),
    ...doc.errors,
  };
  for (const [code, description] of Object.entries(errors)) operation.responses[code] = {
    description, headers: { 'x-request-id': requestIdHeader },
    content: { 'application/json': { schema: schemas.reference(apiErrorResponseSchema, 'apiErrorResponse') } },
  };
}

function successResponse(doc: OperationDoc, schemas: ContractSchemas, id: string): ResponseObject {
  const headers = { 'x-request-id': requestIdHeader };
  if (typeof doc.response !== 'string') return {
    description: 'Successful response.', headers,
    content: { 'application/json': { schema: schemas.reference(doc.response, `${id}Response`) } },
  };
  return {
    description: 'Download of an approved, exportable report. Stale or unavailable content is rejected.',
    headers: { ...headers, 'Content-Disposition': { description: 'Attachment filename supplied by the API.', schema: { type: 'string' } } },
    content: { [doc.response === 'pdf' ? 'application/pdf' : 'text/markdown']: {
      schema: doc.response === 'pdf' ? { type: 'string', format: 'binary' } : { type: 'string' },
    } },
  };
}

function pathParameters(path: string): ParameterObject[] {
  return [...path.matchAll(/\{([^}]+)\}/g)].map(([, name]) => ({
    name, in: 'path', required: true,
    description: name === 'queueName' ? 'Recoverable queue name.' : name === 'locale' ? 'Report locale.' : `${name}: opaque resource identifier.`,
    schema: { type: 'string', ...(name === 'queueName' ? { enum: recoverableQueueNameSchema.options } : name === 'locale' ? { enum: [...supportedReportLocales] } : {}) },
  }));
}

function applyQueryParameters(document: OpenAPIObject, schemas: ContractSchemas): void {
  // Register queries first, then build once so nested references remain valid.
  const queries: { operation: OperationObject; name: string; doc: OperationDoc }[] = [];
  for (const item of Object.values(document.paths)) for (const [method, value] of Object.entries(item)) {
    if (!methods.has(method)) continue;
    const operation = value as OperationObject;
    const [controller, handler] = operation.operationId!.split('_');
    const doc = catalogue[controller].operations[handler];
    if (doc.query) {
      const ref = schemas.reference(doc.query, `${operation.operationId}Query`);
      queries.push({ operation, name: ref.$ref.split('/').pop()!, doc });
    }
  }
  document.components!.schemas = schemas.build();
  for (const { operation, name, doc } of queries) {
    const query = document.components!.schemas![name] as SchemaObject;
    for (const [key, value] of Object.entries(query.properties ?? {})) operation.parameters!.push({
      name: key, in: 'query', required: !doc.query!.shape[key].isOptional(), schema: value,
      ...('description' in value ? { description: value.description } : {}),
    });
  }
}

function assertCatalogueCoverage(seen: Set<string>): void {
  for (const [controller, group] of Object.entries(catalogue)) for (const method of Object.keys(group.operations)) {
    if (!seen.has(`${controller}_${method}`)) throw new Error(`Documentation has no registered route: ${controller}_${method}`);
  }
}
