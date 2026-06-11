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
  role: userRoleSchema.optional(),
});

export const loginResponseSchema = z.object({
  accessToken: z.string(),
  user: requestUserSchema,
});

export type UserRole = z.infer<typeof userRoleSchema>;
export type RequestUser = z.infer<typeof requestUserSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
