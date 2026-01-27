/**
 * Tests for all parsers
 */
import { describe, it, expect } from 'vitest';
import { parseAsyncAPI } from '../src/asyncapi-parser.js';
import { parseGraphQL } from '../src/graphql-parser.js';
import { parsePostman } from '../src/postman-parser.js';
import { parseInsomnia } from '../src/insomnia-parser.js';
import { parseHAR } from '../src/har-parser.js';
import { detectFormat, parseSpec, OpenApiParser, OpenApiAnalyzer, OpenApiTransformer } from '../src/index.js';
import { OpenAPIV3 } from 'openapi-types';

// OpenAPI 3.1 Tests
describe('OpenAPI 3.1 Support', () => {
  it('should detect OpenAPI 3.1 version', () => {
    const spec = {
      openapi: '3.1.0',
      info: { title: 'Test', version: '1.0.0' },
      paths: {},
    } as OpenAPIV3.Document;
    
    const parser = new OpenApiParser();
    parser.parseObject(spec);
    
    expect(parser.isVersion31()).toBe(true);
  });

  it('should extract webhooks (OpenAPI 3.1)', () => {
    const spec = {
      openapi: '3.1.0',
      info: { title: 'Test', version: '1.0.0' },
      paths: {},
      webhooks: {
        newUser: {
          post: {
            operationId: 'onNewUser',
            summary: 'New user webhook',
            requestBody: {
              content: {
                'application/json': {
                  schema: { type: 'object', properties: { userId: { type: 'string' } } }
                }
              }
            },
            responses: { '200': { description: 'OK' } }
          }
        }
      }
    } as any;
    
    const parser = new OpenApiParser();
    parser.parseObject(spec);
    
    const webhooks = parser.getWebhooks();
    expect(Object.keys(webhooks)).toContain('newUser');
  });

  it('should handle type arrays (nullable types)', () => {
    const spec = {
      openapi: '3.1.0',
      info: { title: 'Test', version: '1.0.0' },
      paths: {
        '/users/{id}': {
          get: {
            operationId: 'getUser',
            parameters: [
              { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
            ],
            responses: {
              '200': {
                description: 'OK',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        name: { type: ['string', 'null'] },
                        age: { type: 'integer' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } as any;
    
    const parser = new OpenApiParser();
    parser.parseObject(spec);
    const analyzer = new OpenApiAnalyzer(spec);
    const transformer = new OpenApiTransformer(spec);
    
    const endpoints = analyzer.extractEndpoints();
    expect(endpoints).toHaveLength(1);
    
    const tools = transformer.transformEndpoints(endpoints);
    expect(tools).toHaveLength(1);
  });

  it('should support const keyword', () => {
    const spec = {
      openapi: '3.1.0',
      info: { title: 'Test', version: '1.0.0' },
      paths: {
        '/status': {
          get: {
            operationId: 'getStatus',
            responses: {
              '200': {
                description: 'OK',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        status: { const: 'active' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } as any;
    
    const parser = new OpenApiParser();
    parser.parseObject(spec);
    
    const validation = parser.validate();
    expect(validation.valid).toBe(true);
  });

  it('should include webhooks in endpoint extraction', () => {
    const spec = {
      openapi: '3.1.0',
      info: { title: 'Test', version: '1.0.0' },
      paths: {
        '/users': {
          get: {
            operationId: 'listUsers',
            responses: { '200': { description: 'OK' } }
          }
        }
      },
      webhooks: {
        userCreated: {
          post: {
            operationId: 'onUserCreated',
            responses: { '200': { description: 'OK' } }
          }
        }
      }
    } as any;
    
    const analyzer = new OpenApiAnalyzer(spec);
    const endpoints = analyzer.extractEndpoints({ includeWebhooks: true });
    
    expect(endpoints.length).toBe(2);
    
    const webhook = endpoints.find(e => e.isWebhook);
    expect(webhook).toBeDefined();
    expect(webhook?.operationId).toBe('onUserCreated');
  });
});

// Example Extraction Tests
describe('Example Extraction', () => {
  it('should extract request and response examples', () => {
    const spec = {
      openapi: '3.0.3',
      info: { title: 'Test', version: '1.0.0' },
      paths: {
        '/users': {
          post: {
            operationId: 'createUser',
            requestBody: {
              content: {
                'application/json': {
                  schema: { type: 'object' },
                  example: { name: 'John', email: 'john@example.com' }
                }
              }
            },
            responses: {
              '201': {
                description: 'Created',
                content: {
                  'application/json': {
                    schema: { type: 'object' },
                    example: { id: '123', name: 'John' }
                  }
                }
              }
            }
          }
        }
      }
    } as OpenAPIV3.Document;
    
    const analyzer = new OpenApiAnalyzer(spec);
    const endpoints = analyzer.extractEndpoints();
    
    expect(endpoints[0].examples).toBeDefined();
    expect(endpoints[0].examples?.length).toBeGreaterThan(0);
    expect(endpoints[0].examples?.[0].input).toEqual({ name: 'John', email: 'john@example.com' });
    expect(endpoints[0].examples?.[0].output).toEqual({ id: '123', name: 'John' });
  });
});

// Smart Grouping Tests
describe('Smart Operation Grouping', () => {
  it('should detect CRUD operations', () => {
    const spec = {
      openapi: '3.0.3',
      info: { title: 'Test', version: '1.0.0' },
      paths: {
        '/users': {
          get: { operationId: 'listUsers', responses: { '200': { description: 'OK' } } },
          post: { operationId: 'createUser', responses: { '201': { description: 'Created' } } },
        },
        '/users/{id}': {
          get: { operationId: 'getUser', responses: { '200': { description: 'OK' } } },
          put: { operationId: 'updateUser', responses: { '200': { description: 'OK' } } },
          delete: { operationId: 'deleteUser', responses: { '204': { description: 'Deleted' } } },
        }
      }
    } as OpenAPIV3.Document;
    
    const analyzer = new OpenApiAnalyzer(spec);
    const endpoints = analyzer.extractEndpoints();
    
    const listOp = endpoints.find(e => e.operationId === 'listUsers');
    expect(analyzer.detectCrudOperation(listOp!)).toBe('list');
    
    const getOp = endpoints.find(e => e.operationId === 'getUser');
    expect(analyzer.detectCrudOperation(getOp!)).toBe('get');
    
    const createOp = endpoints.find(e => e.operationId === 'createUser');
    expect(analyzer.detectCrudOperation(createOp!)).toBe('create');
    
    const updateOp = endpoints.find(e => e.operationId === 'updateUser');
    expect(analyzer.detectCrudOperation(updateOp!)).toBe('update');
    
    const deleteOp = endpoints.find(e => e.operationId === 'deleteUser');
    expect(analyzer.detectCrudOperation(deleteOp!)).toBe('delete');
  });

  it('should group by path prefix', () => {
    const spec = {
      openapi: '3.0.3',
      info: { title: 'Test', version: '1.0.0' },
      paths: {
        '/users': { get: { responses: { '200': { description: 'OK' } } } },
        '/users/{id}': { get: { responses: { '200': { description: 'OK' } } } },
        '/posts': { get: { responses: { '200': { description: 'OK' } } } },
        '/posts/{id}': { get: { responses: { '200': { description: 'OK' } } } },
      }
    } as OpenAPIV3.Document;
    
    const analyzer = new OpenApiAnalyzer(spec);
    const endpoints = analyzer.extractEndpoints();
    const groups = analyzer.groupEndpoints(endpoints, { groupBy: 'paths' });
    
    expect(Object.keys(groups)).toContain('users');
    expect(Object.keys(groups)).toContain('posts');
    expect(groups['users']).toHaveLength(2);
    expect(groups['posts']).toHaveLength(2);
  });
});

// Auth Detection Tests
describe('Authentication Detection', () => {
  it('should detect bearer auth', () => {
    const spec = {
      openapi: '3.0.3',
      info: { title: 'Test', version: '1.0.0' },
      paths: {},
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer'
          }
        }
      }
    } as OpenAPIV3.Document;
    
    const analyzer = new OpenApiAnalyzer(spec);
    const authInfo = analyzer.detectAuthentication();
    
    expect(authInfo).toHaveLength(1);
    expect(authInfo[0].type).toBe('bearer');
    expect(authInfo[0].envVar).toContain('TOKEN');
  });

  it('should detect API key auth', () => {
    const spec = {
      openapi: '3.0.3',
      info: { title: 'Test', version: '1.0.0' },
      paths: {},
      components: {
        securitySchemes: {
          apiKey: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key'
          }
        }
      }
    } as OpenAPIV3.Document;
    
    const analyzer = new OpenApiAnalyzer(spec);
    const authInfo = analyzer.detectAuthentication();
    
    expect(authInfo).toHaveLength(1);
    expect(authInfo[0].type).toBe('apiKey');
    expect(authInfo[0].in).toBe('header');
    expect(authInfo[0].headerName).toBe('X-API-Key');
  });

  it('should detect OAuth2', () => {
    const spec = {
      openapi: '3.0.3',
      info: { title: 'Test', version: '1.0.0' },
      paths: {},
      components: {
        securitySchemes: {
          oauth2: {
            type: 'oauth2',
            flows: {
              authorizationCode: {
                authorizationUrl: 'https://example.com/oauth/authorize',
                tokenUrl: 'https://example.com/oauth/token',
                scopes: {
                  'read:users': 'Read users'
                }
              }
            }
          }
        }
      }
    } as any;
    
    const analyzer = new OpenApiAnalyzer(spec);
    const authInfo = analyzer.detectAuthentication();
    
    expect(authInfo).toHaveLength(1);
    expect(authInfo[0].type).toBe('oauth2');
    expect(authInfo[0].flows).toBeDefined();
  });
});

// AsyncAPI Tests
describe('AsyncAPI Parser', () => {
  it('should parse AsyncAPI 2.x spec', () => {
    const spec = {
      asyncapi: '2.6.0',
      info: {
        title: 'Test API',
        version: '1.0.0',
        description: 'A test AsyncAPI spec',
      },
      channels: {
        'user/signup': {
          subscribe: {
            operationId: 'onUserSignup',
            summary: 'Receive user signup events',
            message: {
              payload: {
                type: 'object',
                properties: {
                  userId: { type: 'string' },
                  email: { type: 'string' },
                },
              },
            },
          },
          publish: {
            operationId: 'sendUserSignup',
            summary: 'Send user signup event',
            message: {
              payload: {
                type: 'object',
                properties: {
                  userId: { type: 'string' },
                  email: { type: 'string' },
                },
              },
            },
          },
        },
      },
    };

    const result = parseAsyncAPI(spec);

    expect(result.format).toBe('asyncapi');
    expect(result.version).toBe('2.6.0');
    expect(result.info.title).toBe('Test API');
    expect(result.tools).toHaveLength(2);
    
    const subscribeTool = result.tools.find(t => t.name === 'on_user_signup');
    expect(subscribeTool).toBeDefined();
    expect(subscribeTool?.metadata.operation).toBe('subscribe');
    
    const publishTool = result.tools.find(t => t.name === 'send_user_signup');
    expect(publishTool).toBeDefined();
    expect(publishTool?.metadata.operation).toBe('publish');
  });
});

// GraphQL Tests
describe('GraphQL Parser', () => {
  it('should parse GraphQL SDL', () => {
    const sdl = `
      type Query {
        user(id: ID!): User
        users(limit: Int = 10): [User!]!
      }
      
      type Mutation {
        createUser(input: CreateUserInput!): User
      }
      
      type Subscription {
        userCreated: User
      }
      
      type User {
        id: ID!
        name: String!
        email: String!
      }
      
      input CreateUserInput {
        name: String!
        email: String!
      }
    `;

    const result = parseGraphQL(sdl);

    expect(result.format).toBe('graphql');
    expect(result.tools.length).toBeGreaterThan(0);
    
    // Check for query tool
    const userTool = result.tools.find(t => t.name === 'user');
    expect(userTool).toBeDefined();
    expect(userTool?.inputSchema.properties).toHaveProperty('id');
    expect(userTool?.metadata.operationType).toBe('query');
    
    // Check for mutation tool
    const createUserTool = result.tools.find(t => t.name === 'mutate_create_user');
    expect(createUserTool).toBeDefined();
    expect(createUserTool?.metadata.operationType).toBe('mutation');
    
    // Check for subscription tool
    const subscriptionTool = result.tools.find(t => t.name === 'subscribe_user_created');
    expect(subscriptionTool).toBeDefined();
    expect(subscriptionTool?.metadata.operationType).toBe('subscription');
    
    // Check type stats
    expect(result.types.queries).toContain('user');
    expect(result.types.queries).toContain('users');
    expect(result.types.mutations).toContain('createUser');
    expect(result.types.subscriptions).toContain('userCreated');
  });
});

// Postman Tests
describe('Postman Parser', () => {
  it('should parse Postman Collection v2.1', () => {
    const collection = {
      info: {
        name: 'Test Collection',
        description: 'A test Postman collection',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      item: [
        {
          name: 'Users',
          item: [
            {
              name: 'Get User',
              request: {
                method: 'GET',
                url: {
                  raw: 'https://api.example.com/users/{{userId}}',
                  path: ['users', '{{userId}}'],
                  variable: [{ key: 'userId', value: '123' }],
                },
                description: 'Get a user by ID',
              },
              response: [
                {
                  name: 'Success',
                  code: 200,
                  body: '{"id": "123", "name": "John"}',
                },
              ],
            },
            {
              name: 'Create User',
              request: {
                method: 'POST',
                url: {
                  raw: 'https://api.example.com/users',
                  path: ['users'],
                },
                body: {
                  mode: 'raw',
                  raw: '{"name": "John", "email": "john@example.com"}',
                  options: { raw: { language: 'json' } },
                },
              },
            },
          ],
        },
      ],
      variable: [
        { key: 'baseUrl', value: 'https://api.example.com' },
      ],
    };

    const result = parsePostman(collection);

    expect(result.format).toBe('postman');
    expect(result.info.name).toBe('Test Collection');
    expect(result.tools).toHaveLength(2);
    
    const getUserTool = result.tools.find(t => t.name.includes('get_user'));
    expect(getUserTool).toBeDefined();
    expect(getUserTool?.metadata.endpoint.method).toBe('GET');
    expect(getUserTool?.metadata.folder).toBe('Users');
    
    const createUserTool = result.tools.find(t => t.name.includes('create_user'));
    expect(createUserTool).toBeDefined();
    expect(createUserTool?.metadata.endpoint.method).toBe('POST');
  });
});

// Insomnia Tests
describe('Insomnia Parser', () => {
  it('should parse Insomnia export v4', () => {
    const exportData = {
      _type: 'export',
      __export_format: 4,
      __export_date: '2024-01-01T00:00:00.000Z',
      __export_source: 'insomnia.desktop.app:v2023.5.0',
      resources: [
        {
          _id: 'wrk_1',
          _type: 'workspace' as const,
          name: 'Test Workspace',
          description: 'A test workspace',
        },
        {
          _id: 'fld_1',
          _type: 'request_group' as const,
          parentId: 'wrk_1',
          name: 'Users',
        },
        {
          _id: 'req_1',
          _type: 'request' as const,
          parentId: 'fld_1',
          name: 'Get User',
          method: 'GET',
          url: 'https://api.example.com/users/:id',
          description: 'Get a user by ID',
        },
        {
          _id: 'req_2',
          _type: 'request' as const,
          parentId: 'fld_1',
          name: 'Create User',
          method: 'POST',
          url: 'https://api.example.com/users',
          body: {
            mimeType: 'application/json',
            text: '{"name": "John", "email": "john@example.com"}',
          },
        },
      ],
    };

    const result = parseInsomnia(exportData);

    expect(result.format).toBe('insomnia');
    expect(result.workspaces).toHaveLength(1);
    expect(result.workspaces[0].name).toBe('Test Workspace');
    expect(result.tools).toHaveLength(2);
    
    const getUserTool = result.tools.find(t => t.name.includes('get_user'));
    expect(getUserTool).toBeDefined();
    expect(getUserTool?.metadata.endpoint.method).toBe('GET');
    expect(getUserTool?.metadata.folder).toBe('Users');
    
    const createUserTool = result.tools.find(t => t.name.includes('create_user'));
    expect(createUserTool).toBeDefined();
    expect(createUserTool?.metadata.endpoint.method).toBe('POST');
  });
});

// HAR Tests
describe('HAR Parser', () => {
  it('should parse HAR file and infer API endpoints', () => {
    const har = {
      log: {
        version: '1.2',
        creator: {
          name: 'Browser DevTools',
          version: '1.0',
        },
        entries: [
          {
            startedDateTime: '2024-01-01T00:00:00.000Z',
            time: 100,
            request: {
              method: 'GET',
              url: 'https://api.example.com/api/users/123',
              httpVersion: 'HTTP/1.1',
              cookies: [],
              headers: [
                { name: 'Authorization', value: 'Bearer token123' },
                { name: 'Content-Type', value: 'application/json' },
              ],
              queryString: [],
              headersSize: 100,
              bodySize: 0,
            },
            response: {
              status: 200,
              statusText: 'OK',
              httpVersion: 'HTTP/1.1',
              cookies: [],
              headers: [],
              content: {
                size: 50,
                mimeType: 'application/json',
                text: '{"id": "123", "name": "John"}',
              },
              redirectURL: '',
              headersSize: 100,
              bodySize: 50,
            },
          },
          {
            startedDateTime: '2024-01-01T00:00:01.000Z',
            time: 100,
            request: {
              method: 'GET',
              url: 'https://api.example.com/api/users/456',
              httpVersion: 'HTTP/1.1',
              cookies: [],
              headers: [
                { name: 'Authorization', value: 'Bearer token123' },
              ],
              queryString: [],
              headersSize: 100,
              bodySize: 0,
            },
            response: {
              status: 200,
              statusText: 'OK',
              httpVersion: 'HTTP/1.1',
              cookies: [],
              headers: [],
              content: {
                size: 50,
                mimeType: 'application/json',
                text: '{"id": "456", "name": "Jane"}',
              },
              redirectURL: '',
              headersSize: 100,
              bodySize: 50,
            },
          },
          {
            startedDateTime: '2024-01-01T00:00:02.000Z',
            time: 100,
            request: {
              method: 'POST',
              url: 'https://api.example.com/api/users',
              httpVersion: 'HTTP/1.1',
              cookies: [],
              headers: [
                { name: 'Content-Type', value: 'application/json' },
              ],
              queryString: [],
              postData: {
                mimeType: 'application/json',
                text: '{"name": "New User", "email": "new@example.com"}',
              },
              headersSize: 100,
              bodySize: 50,
            },
            response: {
              status: 201,
              statusText: 'Created',
              httpVersion: 'HTTP/1.1',
              cookies: [],
              headers: [],
              content: {
                size: 50,
                mimeType: 'application/json',
                text: '{"id": "789", "name": "New User"}',
              },
              redirectURL: '',
              headersSize: 100,
              bodySize: 50,
            },
          },
        ],
      },
    };

    const result = parseHAR(har);

    expect(result.format).toBe('har');
    expect(result.info.entryCount).toBe(3);
    expect(result.tools.length).toBeGreaterThan(0);
    
    // Should have combined the two GET /users/:id requests into one endpoint
    const getUserTool = result.tools.find(t => t.metadata.endpoint.method === 'GET');
    expect(getUserTool).toBeDefined();
    expect(getUserTool?.metadata.sampleCount).toBeGreaterThanOrEqual(1);
    
    // Should have detected bearer auth
    const toolWithAuth = result.tools.find(t => t.metadata.auth?.type === 'bearer');
    expect(toolWithAuth).toBeDefined();
    
    // Should have the POST endpoint
    const createTool = result.tools.find(t => t.metadata.endpoint.method === 'POST');
    expect(createTool).toBeDefined();
    expect(createTool?.examples).toBeDefined();
  });
});

// Format Detection Tests
describe('Format Detection', () => {
  it('should detect OpenAPI format', () => {
    expect(detectFormat({ openapi: '3.1.0', info: {}, paths: {} })).toBe('openapi');
    expect(detectFormat({ swagger: '2.0', info: {}, paths: {} })).toBe('openapi');
  });

  it('should detect AsyncAPI format', () => {
    expect(detectFormat({ asyncapi: '2.6.0', info: {}, channels: {} })).toBe('asyncapi');
    expect(detectFormat({ asyncapi: '3.0.0', info: {}, channels: {} })).toBe('asyncapi');
  });

  it('should detect Postman format', () => {
    expect(detectFormat({ info: { name: 'Test', schema: 'https://schema.getpostman.com/...' }, item: [] })).toBe('postman');
  });

  it('should detect Insomnia format', () => {
    expect(detectFormat({ _type: 'export', __export_format: 4, resources: [] })).toBe('insomnia');
  });

  it('should detect HAR format', () => {
    expect(detectFormat({ log: { version: '1.2', creator: {}, entries: [] } })).toBe('har');
  });

  it('should detect GraphQL SDL', () => {
    expect(detectFormat('type Query { hello: String }')).toBe('graphql');
  });

  it('should detect GraphQL introspection', () => {
    expect(detectFormat({ __schema: { types: [] } })).toBe('graphql');
    expect(detectFormat({ data: { __schema: { types: [] } } })).toBe('graphql');
  });
});

// Unified Parser Tests
describe('Unified Parser (parseSpec)', () => {
  it('should parse and unify AsyncAPI spec', async () => {
    const spec = {
      asyncapi: '2.6.0',
      info: {
        title: 'Test API',
        version: '1.0.0',
      },
      channels: {
        'test/channel': {
          subscribe: {
            operationId: 'onTest',
            message: {
              payload: {
                type: 'object',
                properties: {
                  data: { type: 'string' },
                },
              },
            },
          },
        },
      },
    };

    const result = await parseSpec(spec);

    expect(result.format).toBe('asyncapi');
    expect(result.info.title).toBe('Test API');
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].metadata.format).toBe('asyncapi');
    expect(result.tools[0].metadata.channel).toBe('test/channel');
  });

  it('should parse and unify GraphQL SDL', async () => {
    const sdl = `
      type Query {
        hello: String
      }
    `;

    const result = await parseSpec(sdl);

    expect(result.format).toBe('graphql');
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].name).toBe('hello');
    expect(result.tools[0].metadata.format).toBe('graphql');
    expect(result.tools[0].metadata.operationType).toBe('query');
  });

  it('should auto-detect format when not specified', async () => {
    // Postman format
    const postmanSpec = {
      info: { name: 'Test', schema: 'https://schema.getpostman.com/...' },
      item: [
        {
          name: 'Test Request',
          request: {
            method: 'GET',
            url: 'https://api.example.com/test',
          },
        },
      ],
    };

    const result = await parseSpec(postmanSpec);
    expect(result.format).toBe('postman');
  });
});
