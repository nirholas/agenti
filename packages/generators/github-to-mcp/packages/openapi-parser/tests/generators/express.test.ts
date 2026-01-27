/**
 * Tests for Express.js analyzer
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { ExpressAnalyzer } from '../../src/generators/express-analyzer.js';
import { FileContent } from '../../src/generators/types.js';
import { promises as fs } from 'fs';
import path from 'path';

describe('ExpressAnalyzer', () => {
  let analyzer: ExpressAnalyzer;
  let fixtureFiles: FileContent[];

  beforeAll(async () => {
    analyzer = new ExpressAnalyzer();
    
    // Load fixture files
    const fixturesPath = path.join(__dirname, '../../../tests/fixtures/express-app');
    
    const indexContent = await fs.readFile(
      path.join(fixturesPath, 'index.js'),
      'utf-8'
    );
    const usersContent = await fs.readFile(
      path.join(fixturesPath, 'routes/users.js'),
      'utf-8'
    );
    const postsContent = await fs.readFile(
      path.join(fixturesPath, 'routes/posts.js'),
      'utf-8'
    );

    fixtureFiles = [
      { path: 'index.js', content: indexContent },
      { path: 'routes/users.js', content: usersContent },
      { path: 'routes/posts.js', content: postsContent },
    ];
  });

  describe('canAnalyze', () => {
    it('should detect Express.js code', () => {
      const files: FileContent[] = [
        { path: 'app.js', content: "const express = require('express');" },
      ];
      expect(analyzer.canAnalyze(files)).toBe(true);
    });

    it('should detect Express router usage', () => {
      const files: FileContent[] = [
        { path: 'routes.js', content: "router.get('/users', handler);" },
      ];
      expect(analyzer.canAnalyze(files)).toBe(true);
    });

    it('should not match non-Express code', () => {
      const files: FileContent[] = [
        { path: 'utils.js', content: 'function helper() { return 42; }' },
      ];
      expect(analyzer.canAnalyze(files)).toBe(false);
    });
  });

  describe('analyze', () => {
    it('should extract routes from Express.js files', async () => {
      const result = await analyzer.analyze(fixtureFiles);
      
      expect(result.framework).toBe('express');
      expect(result.routes.length).toBeGreaterThan(0);
      expect(result.filesAnalyzed.length).toBeGreaterThan(0);
    });

    it('should extract user routes', async () => {
      const result = await analyzer.analyze(fixtureFiles);
      
      const userRoutes = result.routes.filter(r => r.path.includes('/users'));
      expect(userRoutes.length).toBeGreaterThan(0);
      
      // Check GET /users exists
      const getUsersRoute = userRoutes.find(
        r => r.method === 'get' && r.path === '/users'
      );
      expect(getUsersRoute).toBeDefined();
      expect(getUsersRoute?.tags).toContain('Users');
    });

    it('should extract path parameters', async () => {
      const result = await analyzer.analyze(fixtureFiles);
      
      const getUserByIdRoute = result.routes.find(
        r => r.method === 'get' && r.path === '/users/:id'
      );
      
      expect(getUserByIdRoute).toBeDefined();
      expect(getUserByIdRoute?.openApiPath).toBe('/users/{id}');
      expect(getUserByIdRoute?.pathParameters).toHaveLength(1);
      expect(getUserByIdRoute?.pathParameters[0].name).toBe('id');
    });

    it('should detect deprecated endpoints', async () => {
      const result = await analyzer.analyze(fixtureFiles);
      
      const deprecatedRoute = result.routes.find(
        r => r.method === 'put' && r.path.includes('/users')
      );
      
      expect(deprecatedRoute?.deprecated).toBe(true);
    });

    it('should extract post routes', async () => {
      const result = await analyzer.analyze(fixtureFiles);
      
      const postRoutes = result.routes.filter(r => r.path.includes('/posts'));
      expect(postRoutes.length).toBeGreaterThan(0);
    });

    it('should generate operation IDs', async () => {
      const result = await analyzer.analyze(fixtureFiles);
      
      for (const route of result.routes) {
        expect(route.operationId).toBeDefined();
        expect(route.operationId).not.toBe('');
      }
    });
  });

  describe('inline code analysis', () => {
    it('should parse app.method() patterns', async () => {
      const files: FileContent[] = [
        {
          path: 'api.js',
          content: `
const express = require('express');
const app = express();

app.get('/items', (req, res) => {
  res.json([]);
});

app.post('/items', (req, res) => {
  res.status(201).json(req.body);
});

app.delete('/items/:id', (req, res) => {
  res.status(204).send();
});
          `,
        },
      ];

      const result = await analyzer.analyze(files);
      
      expect(result.routes).toHaveLength(3);
      expect(result.routes.map(r => r.method)).toContain('get');
      expect(result.routes.map(r => r.method)).toContain('post');
      expect(result.routes.map(r => r.method)).toContain('delete');
    });

    it('should parse router.route() chains', async () => {
      const files: FileContent[] = [
        {
          path: 'router.js',
          content: `
const router = require('express').Router();

router.route('/products')
  .get((req, res) => res.json([]))
  .post((req, res) => res.status(201).json({}));

router.route('/products/:id')
  .get((req, res) => res.json({}))
  .put((req, res) => res.json({}))
  .delete((req, res) => res.status(204).send());
          `,
        },
      ];

      const result = await analyzer.analyze(files);
      
      expect(result.routes.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('response inference', () => {
    it('should infer default responses based on method', async () => {
      const files: FileContent[] = [
        {
          path: 'api.js',
          content: `
const app = require('express')();
app.get('/test', handler);
app.post('/test', handler);
app.delete('/test/:id', handler);
          `,
        },
      ];

      const result = await analyzer.analyze(files);
      
      const getRoute = result.routes.find(r => r.method === 'get');
      expect(getRoute?.responses.some(r => r.statusCode === 200)).toBe(true);
      
      const postRoute = result.routes.find(r => r.method === 'post');
      expect(postRoute?.responses.some(r => r.statusCode === 201)).toBe(true);
      
      const deleteRoute = result.routes.find(r => r.method === 'delete');
      expect(deleteRoute?.responses.some(r => r.statusCode === 204)).toBe(true);
    });
  });
});
