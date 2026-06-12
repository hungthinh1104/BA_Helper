import { scanPythonProject } from '../../../src/scanner/extractors/python-scanner';
import * as fs from 'node:fs/promises';

jest.mock('node:fs/promises');

describe('python-scanner', () => {
  const mockFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  const runScan = async (filePaths: string[], contents: Record<string, string>) => {
    mockFs.readFile.mockImplementation(async (path: any) => {
      const pathStr = path.toString();
      if (contents[pathStr] !== undefined) {
        return contents[pathStr];
      }
      throw new Error(`File not found: ${pathStr}`);
    });

    return scanPythonProject({
      fixturePath: '/project',
      pyFiles: filePaths,
    });
  };

  it('extracts basic FastAPI @app routes', async () => {
    const file = '/project/src/main.py';
    const content = `
from fastapi import FastAPI
app = FastAPI()

@app.get("/users")
def get_users():
    return []

@app.post("/users")
async def create_user():
    return {}
    `;
    
    const result = await runScan([file], { [file]: content });
    
    expect(result.artifacts).toHaveLength(2);
    expect(result.artifacts[0].symbolName).toBe('GET /users -> get_users');
    expect(result.artifacts[0].stableId).toContain('python_http_endpoint__fastapi__GET__route_');
    expect(result.artifacts[0].stableId).toContain('__handler_get_users');
    
    expect(result.artifacts[1].symbolName).toBe('POST /users -> create_user');
  });

  it('extracts route templates with path variables safely', async () => {
    const file = '/project/src/orders.py';
    const content = `
@app.get("/orders/{order_id}/items")
def get_order_items(order_id: str):
    pass
    `;
    
    const result = await runScan([file], { [file]: content });
    
    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0].symbolName).toBe('GET /orders/{order_id}/items -> get_order_items');
  });

  it('extracts @router routes when NO prefix is detected', async () => {
    const file = '/project/src/routes.py';
    const content = `
from fastapi import APIRouter
router = APIRouter()

@router.delete("/resource")
def delete_resource():
    pass
    `;
    
    const result = await runScan([file], { [file]: content });
    
    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0].symbolName).toBe('DELETE /resource -> delete_resource');
  });

  it('emits PY_ROUTER_PREFIX_UNSUPPORTED and skips router methods when prefix is detected', async () => {
    const file = '/project/src/prefix.py';
    const content = `
from fastapi import APIRouter
router = APIRouter(prefix="/api/v1")

@router.put("/update")
def update_item():
    pass
    `;
    
    const result = await runScan([file], { [file]: content });
    
    expect(result.artifacts).toHaveLength(0);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'PY_ROUTER_PREFIX_UNSUPPORTED' })
      ])
    );
  });

  it('emits PY_DEPENDENCY_INJECTION_BOUNDARY but extracts the route', async () => {
    const file = '/project/src/deps.py';
    const content = `
@app.get("/secure")
def secure_route(user = Depends(get_current_user)):
    pass
    `;
    
    const result = await runScan([file], { [file]: content });
    
    expect(result.artifacts).toHaveLength(1);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'PY_DEPENDENCY_INJECTION_BOUNDARY' })
      ])
    );
  });

  it('emits PY_DYNAMIC_ROUTE_UNSUPPORTED for f-strings and non-literal paths', async () => {
    const file = '/project/src/dynamic.py';
    const content = `
base = "/api"

@app.get(f"{base}/status")
def status_fstring():
    pass

@app.get(base + "/health")
def status_concat():
    pass

@app.get(base_path)
def status_var():
    pass
    `;
    
    const result = await runScan([file], { [file]: content });
    
    expect(result.artifacts).toHaveLength(0);
    const diag = result.diagnostics?.filter(d => d.code === 'PY_DYNAMIC_ROUTE_UNSUPPORTED');
    expect(diag?.length).toBe(3);
  });

  it('emits PY_UNKNOWN_ROUTER_PATTERN for Flask or Django', async () => {
    const file = '/project/src/other.py';
    const content = `
from flask import Flask
app = Flask(__name__)
    `;
    
    const result = await runScan([file], { [file]: content });
    
    expect(result.artifacts).toHaveLength(0);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'PY_UNKNOWN_ROUTER_PATTERN' })
      ])
    );
  });
});
