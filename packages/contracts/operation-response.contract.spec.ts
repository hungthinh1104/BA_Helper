import { apiErrorResponseSchema, documentJobCreateRequestSchema, memberRemovalResponseSchema,
  okResponseSchema, retryFailedJobResponseSchema, successResponseSchema } from './src';

describe('documented existing transport shapes', () => {
  it('keeps acknowledgement meanings distinct', () => {
    expect(okResponseSchema.parse({ ok: true })).toEqual({ ok: true });
    expect(successResponseSchema.parse({ success: true })).toEqual({ success: true });
    expect(memberRemovalResponseSchema.parse({ removed: true })).toEqual({ removed: true });
    expect(okResponseSchema.safeParse({ ok: false }).success).toBe(false);
  });
  it('represents both application and framework error envelopes', () => {
    expect(apiErrorResponseSchema.safeParse({ code: 'ANALYSIS_STALE', message: 'Rerun required.' }).success).toBe(true);
    expect(apiErrorResponseSchema.safeParse({ statusCode: 401, message: 'Authentication required', error: 'Unauthorized' }).success).toBe(true);
  });
  it('describes document job retries and actual recoverable queue names', () => {
    expect(documentJobCreateRequestSchema.parse({})).toEqual({});
    expect(documentJobCreateRequestSchema.parse({ requestKey: 'reviewed-report-1', retry: true }).retry).toBe(true);
    expect(retryFailedJobResponseSchema.safeParse({ queueName: 'scan-job', jobId: 'job-1', productEntityId: 'scan-1', status: 'RETRIED' }).success).toBe(true);
    expect(retryFailedJobResponseSchema.safeParse({ queueName: 'unknown', jobId: 'job-1', productEntityId: 'scan-1', status: 'RETRIED' }).success).toBe(false);
  });
});
