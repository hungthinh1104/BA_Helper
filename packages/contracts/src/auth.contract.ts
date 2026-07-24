import { z } from 'zod';

export const userRoleSchema = z.enum(['ADMIN', 'REVIEWER', 'VIEWER']);

export const requestUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().nullable().optional(),
  role: userRoleSchema,
});

export const loginRequestSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
});

export const devLoginRequestSchema = z.object({
  email: z.string().trim().email().max(254),
  role: userRoleSchema.optional(),
});

export const loginResponseSchema = z.object({
  accessToken: z.string(),
  user: requestUserSchema,
});

export type UserRole = z.infer<typeof userRoleSchema>;
export type RequestUser = z.infer<typeof requestUserSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type DevLoginRequest = z.infer<typeof devLoginRequestSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
