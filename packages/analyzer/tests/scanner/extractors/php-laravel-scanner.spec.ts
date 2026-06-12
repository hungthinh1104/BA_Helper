import { scanPhpLaravelProject } from '../../../src/scanner/extractors/php-laravel-scanner';
import * as fs from 'node:fs/promises';

jest.mock('node:fs/promises');

describe('php-laravel-scanner', () => {
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
    return scanPhpLaravelProject({ fixturePath: '/project', phpFiles: filePaths });
  };

  it('extracts Route::get/post/put/patch/delete with array handler syntax', async () => {
    const file = '/project/routes/api.php';
    const content = `<?php
use App\\Http\\Controllers\\RefundController;
use App\\Http\\Controllers\\BookingController;

Route::get('/refunds/{refundId}', [RefundController::class, 'show']);
Route::post('/refunds', [RefundController::class, 'store']);
Route::put('/refunds/{refundId}', [RefundController::class, 'update']);
Route::patch('/refunds/{refundId}/status', [RefundController::class, 'patch']);
Route::delete('/refunds/{refundId}', [RefundController::class, 'destroy']);
`;
    const result = await runScan([file], { [file]: content });

    expect(result.artifacts).toHaveLength(5);
    const names = result.artifacts.map(a => a.symbolName);
    expect(names).toContain('GET /refunds/{refundId} -> RefundController@show');
    expect(names).toContain('POST /refunds -> RefundController@store');
    expect(names).toContain('PUT /refunds/{refundId} -> RefundController@update');
    expect(names).toContain('PATCH /refunds/{refundId}/status -> RefundController@patch');
    expect(names).toContain('DELETE /refunds/{refundId} -> RefundController@destroy');

    expect(result.artifacts.every(a => a.type === 'HTTP_ENDPOINT')).toBe(true);

    // stableId / artifactKey generation is deterministic and path-safe
    expect(result.artifacts[0].stableId).toMatch(
      /^php_http_endpoint__laravel__GET__route_[a-f0-9]{8}__path_[a-f0-9]{8}__handler_RefundController_show$/,
    );
  });

  it('extracts legacy string handler Route::get(path, \'Controller@method\') and emits boundary diagnostic', async () => {
    const file = '/project/routes/web.php';
    const content = `<?php
Route::get('/bookings', 'BookingController@index');
Route::post('/bookings', 'BookingController@store');
`;
    const result = await runScan([file], { [file]: content });

    expect(result.artifacts).toHaveLength(2);
    expect(result.artifacts[0].symbolName).toBe('GET /bookings -> BookingController@index');

    // Legacy handler emits PHP_CONTROLLER_RESOLUTION_BOUNDARY
    const boundary = result.diagnostics?.find(d => d.code === 'PHP_CONTROLLER_RESOLUTION_BOUNDARY');
    expect(boundary).toBeDefined();
  });

  it('emits PHP_RESOURCE_ROUTE_UNSUPPORTED for Route::resource', async () => {
    const file = '/project/routes/api.php';
    const content = `<?php
Route::resource('/bookings', BookingController::class);
`;
    const result = await runScan([file], { [file]: content });

    expect(result.artifacts).toHaveLength(0);
    const diag = result.diagnostics?.find(d => d.code === 'PHP_RESOURCE_ROUTE_UNSUPPORTED');
    expect(diag).toBeDefined();
  });

  it('emits PHP_ROUTE_GROUP_UNSUPPORTED for Route::group', async () => {
    const file = '/project/routes/api.php';
    const content = `<?php
Route::group(['prefix' => 'api'], function () {
    Route::get('/users', [UserController::class, 'index']);
});
`;
    const result = await runScan([file], { [file]: content });

    const diag = result.diagnostics?.find(d => d.code === 'PHP_ROUTE_GROUP_UNSUPPORTED');
    expect(diag).toBeDefined();
    // The Route::get inside the group is still seen by the regex (lexical only)
    // — we don't block it, but the group diagnostic signals prefix is unresolved
  });

  it('emits PHP_MIDDLEWARE_BOUNDARY for ->middleware()', async () => {
    const file = '/project/routes/api.php';
    const content = `<?php
Route::get('/admin/refunds', [AdminController::class, 'index'])->middleware('auth');
`;
    const result = await runScan([file], { [file]: content });

    const diag = result.diagnostics?.find(d => d.code === 'PHP_MIDDLEWARE_BOUNDARY');
    expect(diag).toBeDefined();
    // Route is still extracted
    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0].symbolName).toBe('GET /admin/refunds -> AdminController@index');
  });

  it('emits PHP_DYNAMIC_ROUTE_UNSUPPORTED for Route::get($variable, ...)', async () => {
    const file = '/project/routes/api.php';
    const content = `<?php
$path = '/dynamic';
Route::get($path, [DynamicController::class, 'index']);
`;
    const result = await runScan([file], { [file]: content });

    const diag = result.diagnostics?.find(d => d.code === 'PHP_DYNAMIC_ROUTE_UNSUPPORTED');
    expect(diag).toBeDefined();
    expect(result.artifacts).toHaveLength(0);
  });

  it('emits PHP_UNKNOWN_ROUTER_PATTERN for $router->get() style', async () => {
    const file = '/project/routes/api.php';
    const content = `<?php
$router->get('/lumen/route', function () {
    return 'ok';
});
`;
    const result = await runScan([file], { [file]: content });

    const diag = result.diagnostics?.find(d => d.code === 'PHP_UNKNOWN_ROUTER_PATTERN');
    expect(diag).toBeDefined();
    expect(result.artifacts).toHaveLength(0);
  });

  it('supports route path templates with {id} parameters', async () => {
    const file = '/project/routes/api.php';
    const content = `<?php
Route::get('/orders/{orderId}/items/{itemId}', [OrderController::class, 'getItem']);
`;
    const result = await runScan([file], { [file]: content });

    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0].symbolName).toBe(
      'GET /orders/{orderId}/items/{itemId} -> OrderController@getItem',
    );
  });
});
