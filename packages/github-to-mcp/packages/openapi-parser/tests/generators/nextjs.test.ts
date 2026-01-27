/**
 * Tests for Next.js analyzer
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { NextJSAnalyzer } from '../../src/generators/nextjs-analyzer.js';
import { FileContent } from '../../src/generators/types.js';
import { promises as fs } from 'fs';
import path from 'path';

describe('NextJSAnalyzer', () => {
  let analyzer: NextJSAnalyzer;
  let fixtureFiles: FileContent[];

  beforeAll(async () => {
    analyzer = new NextJSAnalyzer();
    
    // Load fixture files
    const fixturesPath = path.join(__dirname, '../../../tests/fixtures/nextjs-app');
    
    const usersRouteContent = await fs.readFile(
      path.join(fixturesPath, 'app/api/users/route.ts'),
      'utf-8'
    );
    const userByIdRouteContent = await fs.readFile(
      path.join(fixturesPath, 'app/api/users/[id]/route.ts'),
      'utf-8'
    );
    const postsRouteContent = await fs.readFile(
      path.join(fixturesPath, 'app/api/posts/route.ts'),
      'utf-8'
    );
    const healthContent = await fs.readFile(
      path.join(fixturesPath, 'pages/api/health.ts'),
      'utf-8'
    );

    fixtureFiles = [
      { path: 'app/api/users/route.ts', content: usersRouteContent, language: 'typescript' },
      { path: 'app/api/users/[id]/route.ts', content: userByIdRouteContent, language: 'typescript' },
      { path: 'app/api/posts/route.ts', content: postsRouteContent, language: 'typescript' },
      { path: 'pages/api/health.ts', content: healthContent, language: 'typescript' },
    ];
  });

  describe('canAnalyze', () => {
    it('should detect Next.js App Router API routes', () => {
      const files: FileContent[] = [
        {
          path: 'app/api/users/route.ts',
          content: "import { NextRequest, NextResponse } from 'next/server';",
        },
      ];
      expect(analyzer.canAnalyze(files)).toBe(true);
    });

    it('should detect Next.js Pages Router API routes', () => {
      const files: FileContent[] = [
        {
          path: 'pages/api/hello.ts',
          content: 'export default function handler(req, res) {}',
        },
      ];
      expect(analyzer.canAnalyze(files)).toBe(true);
    });

    it('should not match non-API files', () => {
      const files: FileContent[] = [
        {
          path: 'app/page.tsx',
          content: 'export default function Page() { return <div>Hello</div>; }',
        },
      ];
      expect(analyzer.canAnalyze(files)).toBe(false);
    });
  });

  describe('analyze', () => {
    it('should extract routes from Next.js files', async () => {
      const result = await analyzer.analyze(fixtureFiles);
      
      expect(result.framework).toBe('nextjs');
      expect(result.routes.length).toBeGreaterThan(0);
      expect(result.filesAnalyzed.length).toBeGreaterThan(0);
    });

    it('should extract user routes from App Router', async () => {
      const result = await analyzer.analyze(fixtureFiles);
      
      const userRoutes = result.routes.filter(r => r.path.includes('/users'));
      expect(userRoutes.length).toBeGreaterThan(0);
      
      // Check GET /api/users exists
      const getUsersRoute = userRoutes.find(
        r => r.method === 'get' && r.path === '/api/users'
      );
      expect(getUsersRoute).toBeDefined();
    });

    it('should extract dynamic route parameters', async () => {
      const result = await analyzer.analyze(fixtureFiles);
      
      const getUserByIdRoute = result.routes.find(
        r => r.method === 'get' && r.path.includes('/users/{id}')
      );
      
      expect(getUserByIdRoute).toBeDefined();
      expect(getUserByIdRoute?.pathParameters).toHaveLength(1);
      expect(getUserByIdRoute?.pathParameters[0].name).toBe('id');
    });

    it('should extract multiple HTTP methods from same route file', async () => {
      const result = await analyzer.analyze(fixtureFiles);
      
      const usersRoutes = result.routes.filter(r => 
        r.path === '/api/users' && r.sourceFile.includes('app/api/users/route.ts')
      );
      
      expect(usersRoutes.length).toBe(2); // GET and POST
      expect(usersRoutes.map(r => r.method)).toContain('get');
      expect(usersRoutes.map(r => r.method)).toContain('post');
    });

    it('should extract query parameters from searchParams usage', async () => {
      const result = await analyzer.analyze(fixtureFiles);
      
      const getUsersRoute = result.routes.find(
        r => r.method === 'get' && r.path === '/api/users'
      );
      
      expect(getUsersRoute?.queryParameters.length).toBeGreaterThan(0);
    });

    it('should detect header parameters', async () => {
      const result = await analyzer.analyze(fixtureFiles);
      
      const createPostRoute = result.routes.find(
        r => r.method === 'post' && r.path.includes('/posts')
      );
      
      expect(createPostRoute?.headerParameters.length).toBeGreaterThan(0);
      expect(
        createPostRoute?.headerParameters.some(p => p.name.toLowerCase() === 'authorization')
      ).toBe(true);
    });

    it('should handle Pages Router routes', async () => {
      const result = await analyzer.analyze(fixtureFiles);
      
      const healthRoute = result.routes.find(r => r.path.includes('/health'));
      expect(healthRoute).toBeDefined();
    });
  });

  describe('inline code analysis', () => {
    it('should parse export async function patterns', async () => {
      const files: FileContent[] = [
        {
          path: 'app/api/items/route.ts',
          content: `
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({ items: [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  return NextResponse.json(body, { status: 201 });
}
          `,
          language: 'typescript',
        },
      ];

      const result = await analyzer.analyze(files);
      
      expect(result.routes.length).toBe(2);
      expect(result.routes.map(r => r.method)).toContain('get');
      expect(result.routes.map(r => r.method)).toContain('post');
    });

    it('should parse export const arrow function patterns', async () => {
      const files: FileContent[] = [
        {
          path: 'app/api/data/route.ts',
          content: `
import { NextResponse } from 'next/server';

export const GET = async () => {
  return NextResponse.json({ data: [] });
};

export const PUT = async (request) => {
  return NextResponse.json({});
};
          `,
          language: 'typescript',
        },
      ];

      const result = await analyzer.analyze(files);
      
      expect(result.routes.length).toBe(2);
      expect(result.routes.map(r => r.method)).toContain('get');
      expect(result.routes.map(r => r.method)).toContain('put');
    });
  });

  describe('path conversion', () => {
    it('should convert [param] to {param}', async () => {
      const files: FileContent[] = [
        {
          path: 'app/api/users/[userId]/posts/[postId]/route.ts',
          content: `
export async function GET() {
  return Response.json({});
}
          `,
          language: 'typescript',
        },
      ];

      const result = await analyzer.analyze(files);
      
      expect(result.routes[0].openApiPath).toBe('/api/users/{userId}/posts/{postId}');
    });

    it('should handle catch-all routes', async () => {
      const files: FileContent[] = [
        {
          path: 'app/api/[...slug]/route.ts',
          content: `
export async function GET() {
  return Response.json({});
}
          `,
          language: 'typescript',
        },
      ];

      const result = await analyzer.analyze(files);
      
      expect(result.routes[0].openApiPath).toBe('/api/{slug}');
    });
  });

  describe('response inference', () => {
    it('should extract status codes from NextResponse.json', async () => {
      const files: FileContent[] = [
        {
          path: 'app/api/test/route.ts',
          content: `
import { NextResponse } from 'next/server';

export async function POST() {
  if (error) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  return NextResponse.json({ id: '123' }, { status: 201 });
}
          `,
          language: 'typescript',
        },
      ];

      const result = await analyzer.analyze(files);
      
      const route = result.routes[0];
      expect(route.responses.some(r => r.statusCode === 201)).toBe(true);
      expect(route.responses.some(r => r.statusCode === 400)).toBe(true);
    });
  });
});
