import {
  domainPackAppliedDiagnosticPayloadSchema,
  domainPackSchema,
  domainProfileRegistryEntrySchema,
  type DomainPack,
  type DomainPackAppliedDiagnosticPayload,
  type DomainProfileRegistryEntry,
} from './src';

describe('domain pack contracts', () => {
  it('accepts a stable booking pack with English and Vietnamese glossary metadata', () => {
    const payload: DomainPack = {
      id: 'booking',
      name: 'Booking',
      version: '0.1.0',
      status: 'STABLE',
      description: 'Booking, payment, and refund lifecycle hints.',
      glossaryMetadata: [
        { locale: 'en', status: 'foundation', version: '1.0.0', termCount: 6 },
        { locale: 'vi', status: 'foundation', version: '1.0.0', termCount: 6 },
      ],
      concepts: [],
      retrievalHints: [],
      riskTemplates: [],
      qaTemplates: [],
      unknownTemplates: [],
    };

    expect(domainPackSchema.parse(payload)).toEqual(payload);
  });

  it('accepts a fallback registry entry without executable hint bodies', () => {
    const payload: DomainProfileRegistryEntry = {
      id: 'general',
      name: 'General',
      version: '0.0.0',
      status: 'FALLBACK',
      description: 'Safe fallback used when no specific profile is selected.',
      glossaryMetadata: [],
    };

    expect(domainProfileRegistryEntrySchema.parse(payload)).toEqual(payload);
  });

  it('requires capability status in domain pack diagnostics', () => {
    const payload: DomainPackAppliedDiagnosticPayload = {
      domainPackId: 'booking',
      domainPackVersion: '0.1.0',
      domainPackStatus: 'STABLE',
      selectedBy: 'repository_profile',
      conceptCount: 5,
      retrievalHintCount: 6,
      riskTemplateCount: 10,
      qaTemplateCount: 10,
      unknownTemplateCount: 10,
    };

    expect(domainPackAppliedDiagnosticPayloadSchema.parse(payload)).toEqual(payload);
  });
});
