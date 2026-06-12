import { scanRubyRailsProject } from '../../../src/scanner/extractors/ruby-rails-scanner';
import * as fs from 'node:fs/promises';

jest.mock('node:fs/promises');

describe('ruby-rails-scanner', () => {
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
    return scanRubyRailsProject({ fixturePath: '/project', rbFiles: filePaths });
  };

  it('extracts get/post/put/patch/delete routes with literal path strings', async () => {
    const file = '/project/config/routes.rb';
    const content = `
Rails.application.routes.draw do
  get "/refunds/:id", to: "refunds#show"
  post "/refunds", to: "refunds#create"
  put "/refunds/:id", to: "refunds#update"
  patch "/refunds/:id/status", to: "refunds#patch"
  delete "/refunds/:id", to: "refunds#destroy"
end
`;
    const result = await runScan([file], { [file]: content });

    expect(result.artifacts).toHaveLength(5);
    const names = result.artifacts.map(a => a.symbolName);
    expect(names).toContain('GET /refunds/:id -> refunds#show');
    expect(names).toContain('POST /refunds -> refunds#create');
    expect(names).toContain('PUT /refunds/:id -> refunds#update');
    expect(names).toContain('PATCH /refunds/:id/status -> refunds#patch');
    expect(names).toContain('DELETE /refunds/:id -> refunds#destroy');

    expect(result.artifacts.every(a => a.type === 'HTTP_ENDPOINT')).toBe(true);

    // stableId generation is deterministic and path-safe
    expect(result.artifacts[0].stableId).toMatch(
      /^ruby_http_endpoint__rails__GET__route_[a-f0-9]{8}__path_[a-f0-9]{8}__handler_refunds_show$/,
    );
  });

  it('extracts legacy hash rocket syntax routes and emits diagnostic', async () => {
    const file = '/project/config/routes.rb';
    const content = `
Rails.application.routes.draw do
  get "/bookings" => "bookings#index"
end
`;
    const result = await runScan([file], { [file]: content });

    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0].symbolName).toBe('GET /bookings -> bookings#index');

    const diag = result.diagnostics?.find(d => d.code === 'RB_CONTROLLER_RESOLUTION_BOUNDARY');
    expect(diag).toBeDefined();
  });

  it('emits RB_RESOURCE_ROUTE_UNSUPPORTED for resources / resource', async () => {
    const file = '/project/config/routes.rb';
    const content = `
Rails.application.routes.draw do
  resources :users
  resource :profile
end
`;
    const result = await runScan([file], { [file]: content });

    expect(result.artifacts).toHaveLength(0);
    const diag = result.diagnostics?.find(d => d.code === 'RB_RESOURCE_ROUTE_UNSUPPORTED');
    expect(diag).toBeDefined();
  });

  it('emits RB_NAMESPACE_ROUTE_UNSUPPORTED for namespace blocks', async () => {
    const file = '/project/config/routes.rb';
    const content = `
Rails.application.routes.draw do
  namespace :admin do
    get "/dashboard", to: "dashboard#index"
  end
end
`;
    const result = await runScan([file], { [file]: content });

    const diag = result.diagnostics?.find(d => d.code === 'RB_NAMESPACE_ROUTE_UNSUPPORTED');
    expect(diag).toBeDefined();
    // Lexical extraction still grabs the inner route, which is fine since we don't try to join the prefix.
    expect(result.artifacts).toHaveLength(1);
  });

  it('emits RB_SCOPE_ROUTE_UNSUPPORTED for scope/module blocks', async () => {
    const file = '/project/config/routes.rb';
    const content = `
Rails.application.routes.draw do
  scope module: 'admin' do
    get "/metrics", to: "metrics#show"
  end
end
`;
    const result = await runScan([file], { [file]: content });

    const diag = result.diagnostics?.find(d => d.code === 'RB_SCOPE_ROUTE_UNSUPPORTED');
    expect(diag).toBeDefined();
  });

  it('emits RB_MOUNTED_ENGINE_UNSUPPORTED for mounted engines', async () => {
    const file = '/project/config/routes.rb';
    const content = `
Rails.application.routes.draw do
  mount ActionCable.server => '/cable'
  mount Blorgh::Engine, at: "/blog"
end
`;
    const result = await runScan([file], { [file]: content });

    const diag = result.diagnostics?.find(d => d.code === 'RB_MOUNTED_ENGINE_UNSUPPORTED');
    expect(diag).toBeDefined();
  });

  it('emits RB_DYNAMIC_ROUTE_UNSUPPORTED for dynamic path interpolation', async () => {
    const file = '/project/config/routes.rb';
    const content = `
Rails.application.routes.draw do
  get "/api/#{version}/users", to: "users#index"
end
`;
    const result = await runScan([file], { [file]: content });

    const diag = result.diagnostics?.find(d => d.code === 'RB_DYNAMIC_ROUTE_UNSUPPORTED');
    expect(diag).toBeDefined();
    expect(result.artifacts).toHaveLength(0);
  });

  it('emits RB_DYNAMIC_ROUTE_UNSUPPORTED for dynamic non-literal paths', async () => {
    const file = '/project/config/routes.rb';
    const content = `
Rails.application.routes.draw do
  get dynamic_path, to: "users#index"
end
`;
    const result = await runScan([file], { [file]: content });

    const diag = result.diagnostics?.find(d => d.code === 'RB_DYNAMIC_ROUTE_UNSUPPORTED');
    expect(diag).toBeDefined();
    expect(result.artifacts).toHaveLength(0);
  });

  it('emits RB_UNKNOWN_ROUTER_PATTERN for Sinatra Base inheritance', async () => {
    const file = '/project/app.rb';
    const content = `
class MyApp < Sinatra::Base
  get '/' do
    'Hello world!'
  end
end
`;
    const result = await runScan([file], { [file]: content });

    const diag = result.diagnostics?.find(d => d.code === 'RB_UNKNOWN_ROUTER_PATTERN');
    expect(diag).toBeDefined();
    expect(result.artifacts).toHaveLength(0);
  });
});
