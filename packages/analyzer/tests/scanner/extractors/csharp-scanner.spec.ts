import { scanCSharpProject } from '../../../src/scanner/extractors/csharp-scanner';
import * as fs from 'node:fs/promises';

jest.mock('node:fs/promises');

describe('csharp-scanner', () => {
  const mockFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  const runScan = async (filePaths: string[], contents: Record<string, string>) => {
    mockFs.readFile.mockImplementation(async (path: any) => {
      const pathStr = path.toString();
      if (contents[pathStr] !== undefined) return contents[pathStr];
      throw new Error(`File not found: ${pathStr}`);
    });
    return scanCSharpProject({ fixturePath: '/project', csFiles: filePaths });
  };

  it('extracts controller [HttpGet/Post/Put/Patch/Delete] attributes with literal paths', async () => {
    const file = '/project/src/RefundController.cs';
    const content = `
[ApiController]
[Route("api/refund")]
public class RefundController : ControllerBase
{
    [HttpGet("{refund_id}")]
    public IActionResult GetRefund(string refund_id) => Ok();

    [HttpPost("")]
    public IActionResult CreateRefund() => Ok();

    [HttpPut("{refund_id}")]
    public IActionResult UpdateRefund(string refund_id) => Ok();

    [HttpPatch("{refund_id}/status")]
    public IActionResult PatchRefundStatus(string refund_id) => Ok();

    [HttpDelete("{refund_id}")]
    public IActionResult DeleteRefund(string refund_id) => Ok();
}`;
    const result = await runScan([file], { [file]: content });

    expect(result.artifacts).toHaveLength(5);
    const names = result.artifacts.map(a => a.symbolName);
    expect(names).toContain('GET {refund_id} -> GetRefund');
    expect(names).toContain('POST  -> CreateRefund');
    expect(names).toContain('PUT {refund_id} -> UpdateRefund');
    expect(names).toContain('PATCH {refund_id}/status -> PatchRefundStatus');
    expect(names).toContain('DELETE {refund_id} -> DeleteRefund');

    // All type HTTP_ENDPOINT
    expect(result.artifacts.every(a => a.type === 'HTTP_ENDPOINT')).toBe(true);

    // Deterministic stableId shape
    expect(result.artifacts[0].stableId).toMatch(
      /^csharp_http_endpoint__aspnetcore__GET__route_[a-f0-9]{8}__path_[a-f0-9]{8}__handler_GetRefund$/,
    );
  });

  it('extracts Minimal API MapGet/Post/Put/Delete routes', async () => {
    const file = '/project/src/Program.cs';
    const content = `
var app = builder.Build();

app.MapGet("/refunds", GetRefunds);
app.MapPost("/refunds", CreateRefund);
app.MapPut("/refunds/{id}", UpdateRefund);
app.MapDelete("/refunds/{id}", DeleteRefund);

app.Run();`;
    const result = await runScan([file], { [file]: content });

    expect(result.artifacts).toHaveLength(4);
    const names = result.artifacts.map(a => a.symbolName);
    expect(names).toContain('GET /refunds -> GetRefunds');
    expect(names).toContain('POST /refunds -> CreateRefund');
    expect(names).toContain('PUT /refunds/{id} -> UpdateRefund');
    expect(names).toContain('DELETE /refunds/{id} -> DeleteRefund');

    expect(result.artifacts[0].stableId).toMatch(
      /^csharp_http_endpoint__aspnetcore__GET__route_[a-f0-9]{8}__path_[a-f0-9]{8}__handler_\w+$/,
    );
  });

  it('emits CS_ROUTE_TOKEN_UNSUPPORTED for [Route("api/[controller]")]', async () => {
    const file = '/project/src/BookingController.cs';
    const content = `
[Route("api/[controller]")]
public class BookingController : ControllerBase
{
    [HttpGet("all")]
    public IActionResult GetAll() => Ok();
}`;
    const result = await runScan([file], { [file]: content });

    const tokenDiag = result.diagnostics?.find(d => d.code === 'CS_ROUTE_TOKEN_UNSUPPORTED');
    expect(tokenDiag).toBeDefined();

    // Route should still be extracted for the method-level attribute
    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0].symbolName).toBe('GET all -> GetAll');
  });

  it('does NOT emit any diagnostic for plain [Route("prefix")] — path-template {id} is supported', async () => {
    const file = '/project/src/PaymentController.cs';
    const content = `
[Route("api/payment")]
public class PaymentController : ControllerBase
{
    [HttpGet("{id}")]
    public IActionResult Detail(string id) => Ok();
}`;
    const result = await runScan([file], { [file]: content });

    // Plain [Route("api/payment")] does not emit CS_ROUTE_PREFIX_UNSUPPORTED
    const prefixDiag = result.diagnostics?.find(d => d.code === 'CS_ROUTE_PREFIX_UNSUPPORTED');
    expect(prefixDiag).toBeUndefined();

    // {id} is a valid path template, not flagged
    const tokenDiag = result.diagnostics?.find(d => d.code === 'CS_ROUTE_TOKEN_UNSUPPORTED');
    expect(tokenDiag).toBeUndefined();

    // Method-level route still extracted
    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0].symbolName).toBe('GET {id} -> Detail');
  });

  it('emits CS_MINIMAL_API_GROUP_UNSUPPORTED for MapGroup', async () => {
    const file = '/project/src/Program.cs';
    const content = `
var refunds = app.MapGroup("/refunds");
refunds.MapGet("/{id}", GetRefund);`;
    const result = await runScan([file], { [file]: content });

    const groupDiag = result.diagnostics?.find(d => d.code === 'CS_MINIMAL_API_GROUP_UNSUPPORTED');
    expect(groupDiag).toBeDefined();
    // No artifacts since the handler is on the group, not app directly
    expect(result.artifacts).toHaveLength(0);
  });

  it('emits CS_DI_BOUNDARY for [FromServices]', async () => {
    const file = '/project/src/ServicedController.cs';
    const content = `
public class ServicedController : ControllerBase
{
    [HttpGet("/service")]
    public IActionResult Get([FromServices] IMyService svc) => Ok();
}`;
    const result = await runScan([file], { [file]: content });

    const diBoundary = result.diagnostics?.find(d => d.code === 'CS_DI_BOUNDARY');
    expect(diBoundary).toBeDefined();
    // Route still extracted
    expect(result.artifacts).toHaveLength(1);
  });

  it('emits CS_UNKNOWN_ROUTER_PATTERN for WCF [WebGet]', async () => {
    const file = '/project/src/WcfService.cs';
    const content = `
[WebGet(UriTemplate = "/refunds")]
public Refund GetRefund() { return null; }`;
    const result = await runScan([file], { [file]: content });

    const unknownDiag = result.diagnostics?.find(d => d.code === 'CS_UNKNOWN_ROUTER_PATTERN');
    expect(unknownDiag).toBeDefined();
    expect(result.artifacts).toHaveLength(0);
  });

  it('emits CS_DYNAMIC_ROUTE_UNSUPPORTED for non-literal Minimal API route', async () => {
    const file = '/project/src/Program.cs';
    const content = `
var path = "/dynamic";
app.MapGet(path, GetHandler);`;
    const result = await runScan([file], { [file]: content });

    const dynDiag = result.diagnostics?.find(d => d.code === 'CS_DYNAMIC_ROUTE_UNSUPPORTED');
    expect(dynDiag).toBeDefined();
    expect(result.artifacts).toHaveLength(0);
  });
});
