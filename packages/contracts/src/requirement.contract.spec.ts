import {
  requirementCreateFieldsSchema,
  requirementCreateRequestSchema,
} from './requirement.contract';

describe('requirement create contracts', () => {
  it('validates the user-entered fields independently from the retry key', () => {
    expect(requirementCreateFieldsSchema.parse({
      title: 'Cancel paid booking',
      rawText: 'Allow users to cancel paid bookings and receive a refund.',
    })).toEqual({
      title: 'Cancel paid booking',
      rawText: 'Allow users to cancel paid bookings and receive a refund.',
      submitForReadinessCheck: true,
    });
  });

  it('requires a UUID request key for the create API request', () => {
    const fields = {
      title: 'Cancel paid booking',
      rawText: 'Allow users to cancel paid bookings and receive a refund.',
    };

    expect(requirementCreateRequestSchema.safeParse(fields).success).toBe(false);
    expect(requirementCreateRequestSchema.parse({
      ...fields,
      requestKey: '11111111-1111-4111-8111-111111111111',
    })).toMatchObject({ ...fields, requestKey: '11111111-1111-4111-8111-111111111111' });
  });
});
