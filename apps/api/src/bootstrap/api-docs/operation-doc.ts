import type { ZodTypeAny, ZodObject, ZodRawShape } from 'zod';

export type OperationDoc = {
  summary: string;
  response: ZodTypeAny | 'markdown' | 'pdf';
  body?: ZodTypeAny;
  query?: ZodObject<ZodRawShape>;
  description?: string;
  permission?: string;
  bodyExample?: unknown;
  optionalBody?: boolean;
  errors?: Record<number, string>;
};

export type ControllerDocs = { tag: string; operations: Record<string, OperationDoc> };
export const operation = (
  summary: string,
  response: OperationDoc['response'],
  options: Omit<OperationDoc, 'summary' | 'response'> = {},
): OperationDoc => ({ summary, response, ...options });
