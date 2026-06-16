import { resolveJwtSecret } from './jwt-config';

describe('jwt-config', () => {
  let originalEnv: string | undefined;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.JWT_SECRET;
    originalNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalEnv;
    }
    
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('should return process.env.JWT_SECRET if provided', () => {
    process.env.JWT_SECRET = 'my-custom-secret';
    expect(resolveJwtSecret()).toBe('my-custom-secret');
  });

  it('should return default secret if JWT_SECRET is missing and not in production', () => {
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'development';
    expect(resolveJwtSecret()).toBe('dev-only-local-jwt-secret');
  });

  it('should throw Error if JWT_SECRET is missing in production', () => {
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'production';
    expect(() => resolveJwtSecret()).toThrow('Environment variable JWT_SECRET is required in production.');
  });

  it('should throw if process.env.JWT_SECRET is an empty string in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = '   ';
    expect(() => resolveJwtSecret()).toThrow('Environment variable JWT_SECRET must not use a weak or default value in production.');
  });

  it('should throw if process.env.JWT_SECRET is a weak string in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'dev-secret-change-me';
    expect(() => resolveJwtSecret()).toThrow('Environment variable JWT_SECRET must not use a weak or default value in production.');
  });

  it('should accept a strong custom JWT secret in production', () => {
    process.env.JWT_SECRET = '0123456789abcdef0123456789abcdef';
    process.env.NODE_ENV = 'production';
    expect(resolveJwtSecret()).toBe('0123456789abcdef0123456789abcdef');
  });
});
