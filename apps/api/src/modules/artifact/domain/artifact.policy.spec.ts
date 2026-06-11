import { ArtifactPolicy } from './artifact.policy';

describe('ArtifactPolicy', () => {
  describe('validateArtifactPayload', () => {
    it('throws if artifact key is absolute', () => {
      expect(() => {
        ArtifactPolicy.validateArtifactPayload({
          artifactKey: '/home/user/project/src/foo.ts',
          name: 'FooService',
          artifactType: 'SERVICE',
        });
      }).toThrow('Artifact key must be repository-relative, not an absolute path.');
    });

    it('throws if artifact key contains path traversal', () => {
      expect(() => {
        ArtifactPolicy.validateArtifactPayload({
          artifactKey: '../../etc/passwd',
          name: 'FooService',
          artifactType: 'SERVICE',
        });
      }).toThrow('Artifact key must not contain path traversal (../).');
    });

    it('throws if file path is absolute', () => {
      expect(() => {
        ArtifactPolicy.validateArtifactPayload({
          artifactKey: 'src/foo.ts',
          name: 'FooService',
          artifactType: 'SERVICE',
          filePath: '/home/user/project/src/foo.ts',
        });
      }).toThrow('File path must be repository-relative.');
    });

    it('throws if artifact name is too long', () => {
      expect(() => {
        ArtifactPolicy.validateArtifactPayload({
          artifactKey: 'src/foo.ts',
          name: 'a'.repeat(201),
          artifactType: 'SERVICE',
        });
      }).toThrow('Artifact name exceeds the 200 character limit.');
    });

    it('throws if extracted payload is too large', () => {
      expect(() => {
        ArtifactPolicy.validateArtifactPayload({
          artifactKey: 'src/foo.ts',
          name: 'FooService',
          artifactType: 'SERVICE',
          excerpt: 'a'.repeat(50001),
        });
      }).toThrow('Artifact excerpt exceeds the 50KB limit.');
    });

    it('throws if artifact type is unknown', () => {
      expect(() => {
        ArtifactPolicy.validateArtifactPayload({
          artifactKey: 'src/foo.ts',
          name: 'FooService',
          artifactType: 'WEIRD_TYPE',
        });
      }).toThrow('Artifact type WEIRD_TYPE is not supported.');
    });

    it('passes for a valid artifact', () => {
      expect(() => {
        ArtifactPolicy.validateArtifactPayload({
          artifactKey: 'apps/api/src/foo.ts::class:FooService::method:create',
          name: 'FooService.create',
          artifactType: 'SERVICE_METHOD',
          filePath: 'apps/api/src/foo.ts',
          excerpt: 'function create() {}',
        });
      }).not.toThrow();
    });
  });
});
