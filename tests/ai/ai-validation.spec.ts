import { AiService } from "@ba-helper/backend-runtime";

describe('AiService validation', () => {
  it('rejects responses that reference evidence outside bundle', () => {
    const service = new AiService();

    try {
      service.validateResponse({
        response: {
          insights: [
            {
              insightKey: 'claim:refund',
              insightType: 'CLAIM',
              certainty: 'EVIDENCED',
              confidence: 1,
              title: 'Refund exists',
              description: 'Refund exists',
              evidenceKeys: ['artifact:11111111'],
            },
          ],
          unknowns: [],
        },
        allowedEvidenceKeys: ['artifact:22222222'],
      });
      throw new Error('Expected validation to throw');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'INVALID_AI_EVIDENCE_REFERENCE',
      });
    }
  });

  it('accepts valid responses with allowed evidence keys', () => {
    const service = new AiService();

    const result = service.validateResponse({
      response: {
        insights: [
          {
            insightKey: 'claim:refund',
            insightType: 'CLAIM',
            certainty: 'EVIDENCED',
            confidence: 1,
            title: 'Refund exists',
            description: 'Refund exists',
            evidenceKeys: ['artifact:22222222'],
          },
        ],
        unknowns: [],
      },
      allowedEvidenceKeys: ['artifact:22222222'],
    });

    expect(result.insights).toHaveLength(1);
  });
});
