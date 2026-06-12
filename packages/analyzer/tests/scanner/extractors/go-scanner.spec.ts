import * as fs from 'node:fs/promises';
import { scanGoProject } from '../../../src/scanner/extractors/go-scanner';
import { resolve } from 'node:path';

jest.mock('node:fs/promises');

describe('Go Scanner', () => {
  const fixturePath = '/test/repo';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should extract net/http HandleFunc with method UNKNOWN and correct artifact keys', async () => {
    const mockContent = `
package main
import "net/http"

func main() {
    http.HandleFunc("/api/v1/health", healthHandler)
    mux.HandleFunc("/api/v1/status", statusHandler)
}
    `;
    jest.mocked(fs.readFile).mockResolvedValue(mockContent);

    const result = await scanGoProject({
      fixturePath,
      goFiles: ['/test/repo/main.go'],
    });

    expect(result.artifacts.length).toBe(2);

    const healthEndpoint = result.artifacts.find(a => a.symbolName.includes('/api/v1/health'));
    expect(healthEndpoint).toBeDefined();
    expect(healthEndpoint?.symbolName).toBe('UNKNOWN /api/v1/health -> healthHandler');
    expect(healthEndpoint?.stableId).toMatch(/^go_http_endpoint__net_http__UNKNOWN__route_[a-f0-9]{8}__path_[a-f0-9]{8}__handler_healthHandler$/);
    expect(healthEndpoint?.filePath).toBe('main.go');

    const statusEndpoint = result.artifacts.find(a => a.symbolName.includes('/api/v1/status'));
    expect(statusEndpoint).toBeDefined();
    expect(statusEndpoint?.symbolName).toBe('UNKNOWN /api/v1/status -> statusHandler');

    // Should emit diagnostic about unknown HTTP method
    const methodDiag = result.diagnostics?.find(d => d.code === 'GO_HTTP_METHOD_NOT_EXTRACTED');
    expect(methodDiag).toBeDefined();
  });

  it('should extract Gin direct routes with exact methods', async () => {
    const mockContent = `
package main
import "github.com/gin-gonic/gin"

func main() {
    router := gin.Default()
    router.GET("/users", getUsers)
    router.POST("/users", createUsers)
}
    `;
    jest.mocked(fs.readFile).mockResolvedValue(mockContent);

    const result = await scanGoProject({
      fixturePath,
      goFiles: ['/test/repo/router.go'],
    });

    expect(result.artifacts.length).toBe(2);

    const getEndpoint = result.artifacts.find(a => a.symbolName.includes('GET /users'));
    expect(getEndpoint).toBeDefined();
    expect(getEndpoint?.stableId).toMatch(/^go_http_endpoint__gin__GET__route_[a-f0-9]{8}__path_[a-f0-9]{8}__handler_getUsers$/);

    const postEndpoint = result.artifacts.find(a => a.symbolName.includes('POST /users'));
    expect(postEndpoint).toBeDefined();
    expect(postEndpoint?.stableId).toMatch(/^go_http_endpoint__gin__POST__route_[a-f0-9]{8}__path_[a-f0-9]{8}__handler_createUsers$/);
  });

  it('should reject unsupported patterns and emit diagnostics', async () => {
    const mockContent = `
package main

func main() {
    router.GET("/users/:id", getUser) // dynamic
    api := router.Group("/api") // group
    router.Use(loggerMiddleware) // middleware
    router.GET("/path", mw1, mw2, handler) // middleware chain in handler
    router.GET(MyRoute, handler) // constant
    router.GET("/inline", func(c *gin.Context) {}) // inline
    
    echo.New() // unknown router
}
    `;
    jest.mocked(fs.readFile).mockResolvedValue(mockContent);

    const result = await scanGoProject({
      fixturePath,
      goFiles: ['/test/repo/unsupported.go'],
    });

    expect(result.artifacts.length).toBe(0);

    const codes = result.diagnostics?.map(d => d.code);
    expect(codes).toContain('GO_DYNAMIC_ROUTE_UNSUPPORTED');
    expect(codes).toContain('GO_ROUTE_GROUP_UNSUPPORTED');
    expect(codes).toContain('GO_MIDDLEWARE_CHAIN_UNSUPPORTED');
    expect(codes).toContain('GO_ROUTE_CONSTANT_RESOLUTION_UNSUPPORTED');
    expect(codes).toContain('GO_INLINE_HANDLER_UNSTABLE_IDENTITY_UNSUPPORTED');
    expect(codes).toContain('GO_UNKNOWN_ROUTER_PATTERN');
  });

  it('should be deterministic and path-safe', async () => {
    const mockContent = `
package main
func main() {
    router.GET("/api/test", testHandler)
}
    `;
    jest.mocked(fs.readFile).mockResolvedValue(mockContent);

    const result1 = await scanGoProject({
      fixturePath: '/abs/path/to/repo1',
      goFiles: ['/abs/path/to/repo1/main.go'],
    });

    const result2 = await scanGoProject({
      fixturePath: '/different/path/repo2',
      goFiles: ['/different/path/repo2/main.go'],
    });

    // Same stableId despite different absolute paths
    expect(result1.artifacts[0].stableId).toEqual(result2.artifacts[0].stableId);
    expect(result1.artifacts[0].stableId).not.toContain('/abs/path');
    expect(result1.artifacts[0].stableId).not.toContain('/different/path');
  });
});
