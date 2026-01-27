/**
 * Tests for FastAPI analyzer
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { FastAPIAnalyzer } from '../../src/generators/fastapi-analyzer.js';
import { FileContent } from '../../src/generators/types.js';
import { promises as fs } from 'fs';
import path from 'path';

describe('FastAPIAnalyzer', () => {
  let analyzer: FastAPIAnalyzer;
  let fixtureFiles: FileContent[];

  beforeAll(async () => {
    analyzer = new FastAPIAnalyzer();
    
    // Load fixture files
    const fixturesPath = path.join(__dirname, '../../../tests/fixtures/fastapi-app');
    
    const mainContent = await fs.readFile(
      path.join(fixturesPath, 'main.py'),
      'utf-8'
    );
    const adminContent = await fs.readFile(
      path.join(fixturesPath, 'routes/admin.py'),
      'utf-8'
    );

    fixtureFiles = [
      { path: 'main.py', content: mainContent, language: 'python' },
      { path: 'routes/admin.py', content: adminContent, language: 'python' },
    ];
  });

  describe('canAnalyze', () => {
    it('should detect FastAPI code', () => {
      const files: FileContent[] = [
        { path: 'main.py', content: 'from fastapi import FastAPI\napp = FastAPI()' },
      ];
      expect(analyzer.canAnalyze(files)).toBe(true);
    });

    it('should detect Flask code', () => {
      const files: FileContent[] = [
        { path: 'app.py', content: 'from flask import Flask\napp = Flask(__name__)' },
      ];
      expect(analyzer.canAnalyze(files)).toBe(true);
    });

    it('should detect FastAPI decorators', () => {
      const files: FileContent[] = [
        { path: 'routes.py', content: '@app.get("/users")\nasync def get_users():' },
      ];
      expect(analyzer.canAnalyze(files)).toBe(true);
    });

    it('should not match non-Python API code', () => {
      const files: FileContent[] = [
        { path: 'utils.py', content: 'def helper():\n    return 42' },
      ];
      expect(analyzer.canAnalyze(files)).toBe(false);
    });
  });

  describe('analyze', () => {
    it('should extract routes from FastAPI files', async () => {
      const result = await analyzer.analyze(fixtureFiles);
      
      expect(result.framework).toBe('fastapi');
      expect(result.routes.length).toBeGreaterThan(0);
      expect(result.filesAnalyzed.length).toBeGreaterThan(0);
    });

    it('should extract user routes', async () => {
      const result = await analyzer.analyze(fixtureFiles);
      
      const userRoutes = result.routes.filter(r => r.path.includes('/users'));
      expect(userRoutes.length).toBeGreaterThan(0);
      
      // Check GET /users exists
      const listUsersRoute = userRoutes.find(
        r => r.method === 'get' && r.path === '/users'
      );
      expect(listUsersRoute).toBeDefined();
      expect(listUsersRoute?.tags).toContain('Users');
    });

    it('should extract path parameters', async () => {
      const result = await analyzer.analyze(fixtureFiles);
      
      const getUserByIdRoute = result.routes.find(
        r => r.method === 'get' && r.path === '/users/{user_id}'
      );
      
      expect(getUserByIdRoute).toBeDefined();
      expect(getUserByIdRoute?.pathParameters).toHaveLength(1);
      expect(getUserByIdRoute?.pathParameters[0].name).toBe('user_id');
    });

    it('should extract Pydantic models as schemas', async () => {
      const result = await analyzer.analyze(fixtureFiles);
      
      expect(Object.keys(result.schemas).length).toBeGreaterThan(0);
      expect(result.schemas['UserCreate']).toBeDefined();
      expect(result.schemas['UserResponse']).toBeDefined();
    });

    it('should extract query parameters', async () => {
      const result = await analyzer.analyze(fixtureFiles);
      
      const listUsersRoute = result.routes.find(
        r => r.method === 'get' && r.path === '/users'
      );
      
      expect(listUsersRoute?.queryParameters.length).toBeGreaterThan(0);
      const skipParam = listUsersRoute?.queryParameters.find(p => p.name === 'skip');
      expect(skipParam).toBeDefined();
    });

    it('should detect deprecated endpoints', async () => {
      const result = await analyzer.analyze(fixtureFiles);
      
      const deprecatedRoute = result.routes.find(
        r => r.path.includes('/maintenance')
      );
      
      expect(deprecatedRoute?.deprecated).toBe(true);
    });

    it('should extract admin routes', async () => {
      const result = await analyzer.analyze(fixtureFiles);
      
      const adminRoutes = result.routes.filter(r => r.path.includes('/admin'));
      expect(adminRoutes.length).toBeGreaterThan(0);
    });
  });

  describe('inline code analysis', () => {
    it('should parse FastAPI decorator patterns', async () => {
      const files: FileContent[] = [
        {
          path: 'api.py',
          content: `
from fastapi import FastAPI

app = FastAPI()

@app.get("/items")
async def list_items():
    """List all items."""
    return []

@app.post("/items", status_code=201)
async def create_item(item: dict):
    """Create a new item."""
    return item

@app.delete("/items/{item_id}")
async def delete_item(item_id: str):
    """Delete an item."""
    pass
          `,
          language: 'python',
        },
      ];

      const result = await analyzer.analyze(files);
      
      expect(result.routes.length).toBe(3);
      expect(result.routes.map(r => r.method)).toContain('get');
      expect(result.routes.map(r => r.method)).toContain('post');
      expect(result.routes.map(r => r.method)).toContain('delete');
    });

    it('should extract docstrings as descriptions', async () => {
      const files: FileContent[] = [
        {
          path: 'api.py',
          content: `
from fastapi import FastAPI
app = FastAPI()

@app.get("/test")
async def test_endpoint():
    """
    This is a test endpoint.
    
    It returns a simple message.
    """
    return {"message": "test"}
          `,
          language: 'python',
        },
      ];

      const result = await analyzer.analyze(files);
      
      expect(result.routes[0].summary).toBeDefined();
    });
  });

  describe('Pydantic model parsing', () => {
    it('should parse Pydantic models correctly', async () => {
      const files: FileContent[] = [
        {
          path: 'models.py',
          content: `
from pydantic import BaseModel
from typing import Optional, List

class Item(BaseModel):
    name: str
    price: float
    tags: List[str] = []
    description: Optional[str] = None

@app.post("/items")
async def create_item(item: Item):
    return item
          `,
          language: 'python',
        },
      ];

      const result = await analyzer.analyze(files);
      
      expect(result.schemas['Item']).toBeDefined();
      const itemSchema = result.schemas['Item'];
      expect(itemSchema.type).toBe('object');
      expect(itemSchema.properties?.name).toBeDefined();
      expect(itemSchema.properties?.price).toBeDefined();
      expect(itemSchema.required).toContain('name');
      expect(itemSchema.required).toContain('price');
    });
  });
});
