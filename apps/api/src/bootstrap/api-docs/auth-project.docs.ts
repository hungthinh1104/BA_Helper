import * as c from '@ba-helper/contracts';
import { z } from 'zod';
import { operation as op, type ControllerDocs } from './operation-doc';

export const authProjectDocs: Record<string, ControllerDocs> = {
  AuthController: { tag: 'Authentication & accounts', operations: {
    login: op('Sign in with email and password', c.loginResponseSchema, {
      body: c.loginRequestSchema, description: 'Returns an access token. Paste accessToken into the Bearer authentication field. Disabled accounts and invalid credentials return the same 401 response.',
      bodyExample: { email: 'reviewer@example.com', password: 'replace-with-your-password' },
      errors: { 400: 'Invalid login input.', 401: 'Invalid credentials or disabled account.', 429: 'Login rate limit exceeded.', 503: 'Distributed rate limiter unavailable.' },
    }),
    devLogin: op('Create or sign in as a development user', c.loginResponseSchema, {
      body: c.devLoginRequestSchema, description: 'Development only. Returns 403 when ENABLE_DEV_LOGIN is disabled. This POST returns 201, unlike the normal login endpoint.',
      bodyExample: { email: 'developer@example.com', role: 'ADMIN' },
      errors: { 400: 'Invalid development login input.', 403: 'Development login is disabled by runtime policy.', 429: 'Login rate limit exceeded.', 503: 'Distributed rate limiter unavailable.' },
    }),
    getMe: op('Read the current user', c.requestUserSchema),
    changeOwnPassword: op('Change your password and revoke existing sessions', c.accountOperationResponseSchema, { body: c.changeOwnPasswordRequestSchema }),
    provisionAccount: op('Provision an account', c.accountOperationResponseSchema, { body: c.accountProvisionRequestSchema, permission: 'Global ADMIN' }),
    resetPassword: op('Reset an account password', c.accountOperationResponseSchema, { body: c.accountPasswordResetRequestSchema, permission: 'Global ADMIN' }),
    disableAccount: op('Disable an account and revoke its sessions', c.accountOperationResponseSchema, { permission: 'Global ADMIN' }),
    enableAccount: op('Enable an account', c.accountOperationResponseSchema, { permission: 'Global ADMIN' }),
    updateAccountRole: op('Change an account role and revoke its sessions', c.accountOperationResponseSchema, { body: c.accountRoleUpdateRequestSchema, permission: 'Global ADMIN' }),
    listAccounts: op('List accounts', c.accountListResponseSchema, { permission: 'Global ADMIN' }),
    listAccountAudit: op('Read account audit events', c.accountAuditListResponseSchema, {
      permission: 'Global ADMIN', query: z.object({ limit: z.coerce.number().int().min(1).max(500).default(100).describe('Parsed as an integer and clamped to 1–500; invalid or zero values use 100.') }),
    }),
    getAccount: op('Read an account', c.accountSummarySchema, { permission: 'Global ADMIN' }),
  } },
  WorkspaceController: { tag: 'Workspace & projects', operations: {
    getCurrent: op('Resolve the current workspace', c.currentWorkspaceResponseSchema, { description: 'Accepts an optional Bearer token. Without a token, resolves the configured single-user workspace. A supplied invalid token returns 401.', errors: { 401: 'A supplied authorization header or token is invalid.' } }),
    select: op('Select your current project', c.currentWorkspaceResponseSchema, { body: c.selectProjectRequestSchema, description: 'The actor must already be a member of the selected project.' }),
  } },
  ProjectController: { tag: 'Workspace & projects', operations: {
    list: op('List your projects', c.projectListResponseSchema),
    create: op('Create a project', c.projectCreateResponseSchema, { body: c.projectCreateRequestSchema, permission: 'Global ADMIN', bodyExample: { name: 'Booking cancellation and refunds' } }),
  } },
  ProjectMembershipController: { tag: 'Project members', operations: {
    list: op('List project members', c.projectMemberListResponseSchema),
    create: op('Add or update an existing user by email', c.projectMemberListResponseSchema, { body: c.projectMemberUpsertRequestSchema, permission: 'project:manage' }),
    update: op('Update a project member role', c.projectMemberListResponseSchema, { body: c.projectMemberUpdateRequestSchema, permission: 'project:manage' }),
    remove: op('Remove a project member', c.memberRemovalResponseSchema, { permission: 'project:manage', description: 'The last project owner cannot be removed.' }),
  } },
};
