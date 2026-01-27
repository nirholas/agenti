/**
 * @fileoverview Unit tests for graphql-extractor module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GraphQLExtractor } from '../graphql-extractor';

describe('GraphQLExtractor', () => {
  let extractor: GraphQLExtractor;

  beforeEach(() => {
    extractor = new GraphQLExtractor();
  });

  describe('parseSchema', () => {
    it('should parse simple Query type', () => {
      const schema = `
        type Query {
          user(id: ID!): User
          users: [User!]!
        }
      `;

      const result = extractor.parseSchema(schema);

      expect(result.queries).toHaveLength(2);
      expect(result.queries[0].name).toBe('user');
      expect(result.queries[0].args).toHaveLength(1);
      expect(result.queries[0].args[0].name).toBe('id');
      expect(result.queries[0].args[0].required).toBe(true);
      expect(result.queries[1].name).toBe('users');
    });

    it('should parse Mutation type', () => {
      const schema = `
        type Mutation {
          createUser(name: String!, email: String!): User!
          deleteUser(id: ID!): Boolean!
        }
      `;

      const result = extractor.parseSchema(schema);

      expect(result.mutations).toHaveLength(2);
      expect(result.mutations[0].name).toBe('createUser');
      expect(result.mutations[0].args).toHaveLength(2);
    });

    it('should parse Subscription type', () => {
      const schema = `
        type Subscription {
          userUpdated(id: ID!): User
        }
      `;

      const result = extractor.parseSchema(schema);

      expect(result.subscriptions).toHaveLength(1);
      expect(result.subscriptions[0].name).toBe('userUpdated');
    });

    it('should parse custom types', () => {
      const schema = `
        type User {
          id: ID!
          name: String!
          email: String
          posts: [Post!]!
        }

        type Post {
          id: ID!
          title: String!
          content: String
        }
      `;

      const result = extractor.parseSchema(schema);

      expect(result.types['User']).toBeDefined();
      expect(result.types['User'].kind).toBe('object');
      expect(result.types['User'].fields).toHaveLength(4);
      expect(result.types['Post']).toBeDefined();
    });

    it('should parse input types', () => {
      const schema = `
        input CreateUserInput {
          name: String!
          email: String!
          role: UserRole
        }
      `;

      const result = extractor.parseSchema(schema);

      expect(result.types['CreateUserInput']).toBeDefined();
      expect(result.types['CreateUserInput'].kind).toBe('input');
    });

    it('should parse enum types', () => {
      const schema = `
        enum UserRole {
          ADMIN
          USER
          GUEST
        }
      `;

      const result = extractor.parseSchema(schema);

      expect(result.types['UserRole']).toBeDefined();
      expect(result.types['UserRole'].kind).toBe('enum');
      expect(result.types['UserRole'].values).toContain('ADMIN');
      expect(result.types['UserRole'].values).toContain('USER');
      expect(result.types['UserRole'].values).toContain('GUEST');
    });

    it('should parse comments as descriptions', () => {
      const schema = `
        type Query {
          # Get a single user by ID
          user(id: ID!): User
        }
      `;

      const result = extractor.parseSchema(schema);

      expect(result.queries[0].description).toContain('Get a single user');
    });

    it('should handle optional arguments', () => {
      const schema = `
        type Query {
          users(limit: Int, offset: Int): [User!]!
        }
      `;

      const result = extractor.parseSchema(schema);

      expect(result.queries[0].args[0].required).toBe(false);
      expect(result.queries[0].args[1].required).toBe(false);
    });

    it('should handle array types in arguments', () => {
      const schema = `
        type Query {
          usersByIds(ids: [ID!]!): [User!]!
        }
      `;

      const result = extractor.parseSchema(schema);

      expect(result.queries[0].args[0].type).toContain('ID');
    });

    it('should handle empty schema', () => {
      const result = extractor.parseSchema('');

      expect(result.queries).toEqual([]);
      expect(result.mutations).toEqual([]);
      expect(result.subscriptions).toEqual([]);
    });

    it('should parse implements keyword', () => {
      const schema = `
        type User implements Node {
          id: ID!
          name: String!
        }
      `;

      const result = extractor.parseSchema(schema);

      expect(result.types['User']).toBeDefined();
      expect(result.types['User'].fields).toHaveLength(2);
    });
  });

  describe('schemaToTools', () => {
    it('should convert queries to MCP tools', () => {
      const schema = `
        type Query {
          user(id: ID!): User
          users(limit: Int): [User!]!
        }
      `;

      const parsed = extractor.parseSchema(schema);
      const tools = extractor.schemaToTools(parsed, 'https://api.example.com/graphql', 'owner', 'repo');

      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe('graphql_user');
      expect(tools[1].name).toBe('graphql_users');
    });

    it('should convert mutations to MCP tools', () => {
      const schema = `
        type Mutation {
          createUser(name: String!, email: String!): User!
        }
      `;

      const parsed = extractor.parseSchema(schema);
      const tools = extractor.schemaToTools(parsed, 'https://api.example.com/graphql', 'owner', 'repo');

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('graphql_createUser');
      expect(tools[0].inputSchema.required).toContain('name');
      expect(tools[0].inputSchema.required).toContain('email');
    });

    it('should generate implementation code', () => {
      const schema = `
        type Query {
          user(id: ID!): User
        }
      `;

      const parsed = extractor.parseSchema(schema);
      const tools = extractor.schemaToTools(parsed, 'https://api.example.com/graphql', 'owner', 'repo');

      expect(tools[0].implementation).toBeDefined();
      expect(tools[0].implementation).toContain('fetch');
      expect(tools[0].implementation).toContain('graphql');
    });

    it('should set correct source information', () => {
      const schema = `
        type Query {
          user(id: ID!): User
        }
      `;

      const parsed = extractor.parseSchema(schema);
      const tools = extractor.schemaToTools(parsed, 'https://api.example.com/graphql', 'owner', 'repo');

      expect(tools[0].source.type).toBe('graphql');
      expect(tools[0].source.file).toContain('owner/repo');
    });

    it('should map GraphQL types to JSON schema types', () => {
      const schema = `
        type Query {
          test(
            str: String!,
            num: Int!,
            float: Float!,
            bool: Boolean!,
            id: ID!,
            list: [String!]!
          ): Result
        }
      `;

      const parsed = extractor.parseSchema(schema);
      const tools = extractor.schemaToTools(parsed, 'https://api.example.com/graphql', 'owner', 'repo');

      const { properties } = tools[0].inputSchema;
      expect(properties.str.type).toBe('string');
      expect(properties.num.type).toBe('integer');
      expect(properties.float.type).toBe('number');
      expect(properties.bool.type).toBe('boolean');
      expect(properties.id.type).toBe('string');
      expect(properties.list.type).toBe('array');
    });
  });

  describe('complex schemas', () => {
    it('should parse complete schema with all types', () => {
      const schema = `
        type Query {
          user(id: ID!): User
          users(limit: Int, offset: Int): [User!]!
          searchUsers(query: String!): [User!]!
        }

        type Mutation {
          createUser(input: CreateUserInput!): User!
          updateUser(id: ID!, input: UpdateUserInput!): User
          deleteUser(id: ID!): Boolean!
        }

        type Subscription {
          userUpdated(id: ID!): User
        }

        type User {
          id: ID!
          name: String!
          email: String!
          role: UserRole!
          posts: [Post!]!
        }

        type Post {
          id: ID!
          title: String!
          author: User!
        }

        enum UserRole {
          ADMIN
          USER
          GUEST
        }

        input CreateUserInput {
          name: String!
          email: String!
          role: UserRole
        }

        input UpdateUserInput {
          name: String
          email: String
          role: UserRole
        }
      `;

      const result = extractor.parseSchema(schema);

      expect(result.queries).toHaveLength(3);
      expect(result.mutations).toHaveLength(3);
      expect(result.subscriptions).toHaveLength(1);
      // Types: User, Post, UserRole (enum), CreateUserInput, UpdateUserInput = 5
      expect(Object.keys(result.types)).toHaveLength(5);
    });
  });
});
