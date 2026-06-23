import { EventLogService } from './event-log.service';
import { EventLogRepository } from '../infrastructure/event-log.repository';
import { EventLogDto } from '@ba-helper/contracts';

describe('EventLogService', () => {
  let service: EventLogService;
  let repository: jest.Mocked<EventLogRepository>;

  beforeEach(() => {
    repository = {
      createEvent: jest.fn(),
      findEventsByPrefixes: jest.fn(),
    } as unknown as jest.Mocked<EventLogRepository>;
    service = new EventLogService(repository);
  });

  describe('getScanJobEvents', () => {
    it('should query repository with exact trailing-colon prefixes for scan jobs', async () => {
      repository.findEventsByPrefixes.mockResolvedValue([]);
      
      await service.getScanJobEvents('job-123');

      expect(repository.findEventsByPrefixes).toHaveBeenCalledWith([
        'scan-job:job-123:',
        'scan:job-123:'
      ]);
    });
  });

  describe('getAnalysisEvents', () => {
    it('should query repository with exact trailing-colon prefixes for analysis', async () => {
      repository.findEventsByPrefixes.mockResolvedValue([]);
      
      await service.getAnalysisEvents('ana-456');

      expect(repository.findEventsByPrefixes).toHaveBeenCalledWith([
        'analysis:ana-456:',
        'impact:ana-456:'
      ]);
    });
  });

  describe('mapToDto', () => {
    it('should extract actorType and actorName correctly', async () => {
      repository.findEventsByPrefixes.mockResolvedValue([
        {
          id: 'ev-1',
          eventType: 'SCAN_COMPLETED',
          idempotencyKey: 'scan-job:1:',
          createdAt: new Date('2023-01-01T00:00:00.000Z'),
          payload: {
            actorType: 'USER',
            actorUserId: 'user-xyz',
            actorName: 'John Doe',
            artifactCount: 10,
          }
        }
      ]);

      const result = await service.getScanJobEvents('1');
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        actorType: 'USER',
        actorName: 'John Doe',
        triggeredByUserId: null,
      });
      expect(result[0].metadata).toEqual({
        artifactCount: 10
      });
    });

    it('should extract system actor and triggeredByUserId correctly', async () => {
      repository.findEventsByPrefixes.mockResolvedValue([
        {
          id: 'ev-2',
          eventType: 'ANALYSIS_STARTED',
          idempotencyKey: 'analysis:2:',
          createdAt: new Date('2023-01-01T00:00:00.000Z'),
          payload: {
            actorType: 'SYSTEM',
            actorUserId: 'system',
            actorName: 'Worker',
            triggeredByUserId: 'user-123',
            insightCount: 5,
            unknownCount: 0,
            secretField: 'should-not-be-exposed'
          }
        }
      ]);

      const result = await service.getAnalysisEvents('2');
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        actorType: 'SYSTEM',
        actorName: 'Worker',
        triggeredByUserId: 'user-123',
      });
      // Ensure blocklist/allowlist works
      expect(result[0].metadata).toEqual({
        insightCount: 5,
        unknownCount: 0,
      });
      expect(result[0].metadata).not.toHaveProperty('secretField');
    });

    it('should flatten nested llm token usage', async () => {
      repository.findEventsByPrefixes.mockResolvedValue([
        {
          id: 'ev-3',
          eventType: 'ANALYSIS_AI_REASONING_COMPLETED',
          idempotencyKey: 'analysis:3:',
          createdAt: new Date('2023-01-01T00:00:00.000Z'),
          payload: {
            actorType: 'SYSTEM',
            llm: {
              provider: 'openai',
              inputTokens: 100,
              outputTokens: 50,
              totalTokens: 150
            }
          }
        }
      ]);

      const result = await service.getAnalysisEvents('3');
      expect(result[0].metadata).toEqual({
        provider: 'openai',
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150
      });
    });
  });
});
