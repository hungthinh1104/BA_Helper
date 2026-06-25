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

  it('accepts a partial rental pack with English and Vietnamese glossary metadata', () => {
    const payload: DomainPack = {
      id: 'rental',
      name: 'Rental',
      version: '0.1.0',
      status: 'PARTIAL',
      description: 'Partial rental lifecycle hints.',
      glossaryMetadata: [
        { locale: 'en', status: 'foundation', version: '1.0.0', termCount: 9 },
        { locale: 'vi', status: 'foundation', version: '1.0.0', termCount: 9 },
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

  it('accepts partial status in domain pack diagnostics', () => {
    const payload: DomainPackAppliedDiagnosticPayload = {
      domainPackId: 'rental',
      domainPackVersion: '0.1.0',
      domainPackStatus: 'PARTIAL',
      selectedBy: 'repository_profile',
      conceptCount: 9,
      retrievalHintCount: 5,
      riskTemplateCount: 4,
      qaTemplateCount: 3,
      unknownTemplateCount: 4,
    };

    expect(domainPackAppliedDiagnosticPayloadSchema.parse(payload)).toEqual(payload);
  });
});
