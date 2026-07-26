import { z } from 'zod';

export const userRoleSchema = z.enum(['ADMIN', 'REVIEWER', 'VIEWER']);

export const requestUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().nullable().optional(),
  role: userRoleSchema,
});

// Emails are normalized (trim + lowercase) at the contract boundary so every
// lookup and write uses the canonical form; the database stores only normalized
// emails (see the 20260726000000_normalize_user_email migration).
const normalizedEmail = z.string().trim().toLowerCase().email().max(254);

export const loginRequestSchema = z.object({
  email: normalizedEmail,
  password: z.string().min(12).max(128),
});

export const devLoginRequestSchema = z.object({
  email: normalizedEmail,
  role: userRoleSchema.optional(),
});

export const loginResponseSchema = z.object({
  accessToken: z.string(),
  user: requestUserSchema,
});

export const accountProvisionRequestSchema = z.object({
  email: normalizedEmail,
  name: z.string().trim().min(1).max(120).optional(),
  password: z.string().min(12).max(128),
  role: userRoleSchema.default('REVIEWER'),
});

export const accountPasswordResetRequestSchema = z.object({
  password: z.string().min(12).max(128),
});

export const accountRoleUpdateRequestSchema = z.object({
  role: userRoleSchema,
});

export const changeOwnPasswordRequestSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(12).max(128),
});

export const accountOperationResponseSchema = z.object({
  userId: z.string().uuid(),
  status: z.enum([
    'ACTIVE',
    'DISABLED',
    'ENABLED',
    'PASSWORD_RESET',
    'PASSWORD_CHANGED',
    'ROLE_UPDATED',
  ]),
});

export const accountStatusSchema = z.enum(['ACTIVE', 'DISABLED']);

export const accountSummarySchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().nullable(),
  role: userRoleSchema,
  status: accountStatusSchema,
  createdAt: z.string(),
});

export const accountListResponseSchema = z.object({
  items: z.array(accountSummarySchema),
});

export const accountAuditEventSchema = z.object({
  id: z.string(),
  eventType: z.string(),
  actorUserId: z.string().nullable(),
  subjectUserId: z.string().nullable(),
  createdAt: z.string(),
});

export const accountAuditListResponseSchema = z.object({
  items: z.array(accountAuditEventSchema),
});

export type UserRole = z.infer<typeof userRoleSchema>;
export type RequestUser = z.infer<typeof requestUserSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type DevLoginRequest = z.infer<typeof devLoginRequestSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type AccountProvisionRequest = z.infer<
  typeof accountProvisionRequestSchema
>;
export type AccountPasswordResetRequest = z.infer<
  typeof accountPasswordResetRequestSchema
>;
export type AccountOperationResponse = z.infer<
  typeof accountOperationResponseSchema
>;
export type AccountRoleUpdateRequest = z.infer<
  typeof accountRoleUpdateRequestSchema
>;
export type ChangeOwnPasswordRequest = z.infer<
  typeof changeOwnPasswordRequestSchema
>;
export type AccountSummary = z.infer<typeof accountSummarySchema>;
export type AccountListResponse = z.infer<typeof accountListResponseSchema>;
export type AccountAuditEvent = z.infer<typeof accountAuditEventSchema>;
export type AccountAuditListResponse = z.infer<
  typeof accountAuditListResponseSchema
>;
