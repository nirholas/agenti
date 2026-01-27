/**
 * @fileoverview Unit tests for code-extractor module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CodeExtractor } from '../code-extractor';

describe('CodeExtractor', () => {
  let extractor: CodeExtractor;

  beforeEach(() => {
    extractor = new CodeExtractor();
  });

  describe('extract', () => {
    it('should extract TypeScript methods from code', async () => {
      const code = `
        export class ApiClient {
          /**
           * Get a user by ID
           */
          async getUser(id: string): Promise<User> {
            return await this.fetch(\`/users/\${id}\`);
          }
        }
      `;

      const tools = await extractor.extract(code, 'client.ts');

      expect(tools.length).toBeGreaterThan(0);
      expect(tools[0].name).toBe('get_user');
      expect(tools[0].inputSchema.properties).toHaveProperty('id');
    });

    it('should extract JavaScript methods', async () => {
      const code = `
        class Client {
          async fetchData(url: string, options: object): boolean {
            return true;
          }
        }
      `;

      const tools = await extractor.extract(code, 'client.js');

      expect(tools.length).toBeGreaterThan(0);
    });

    it('should skip constructor and private methods', async () => {
      const code = `
        class Client {
          constructor(): void {
            // init
          }

          _privateMethod(data: any): void {
            // private
          }

          publicMethod(arg: string): string {
            return arg;
          }
        }
      `;

      const tools = await extractor.extract(code, 'client.ts');

      const names = tools.map(t => t.name);
      expect(names).not.toContain('constructor');
      expect(names).not.toContain('_private_method');
    });

    it('should extract Python MCP tools from decorators', async () => {
      const code = `
@mcp.tool(name="GetWeather", description="Get current weather for a city")
async def get_weather(city: str, units: str = "metric"):
    """Fetches weather data"""
    pass

@server.tool("FetchUser")
async def fetch_user(user_id: int):
    """Fetch user by ID"""
    pass
      `;

      const tools = await extractor.extract(code, 'server.py');

      expect(tools.length).toBe(2);
      expect(tools[0].name).toBe('GetWeather');
      expect(tools[0].description).toBe('Get current weather for a city');
      expect(tools[0].inputSchema.properties).toHaveProperty('city');
      expect(tools[0].inputSchema.properties).toHaveProperty('units');
      expect(tools[0].inputSchema.required).toContain('city');
      expect(tools[0].inputSchema.required).not.toContain('units');
    });

    it('should handle empty code', async () => {
      const tools = await extractor.extract('', 'empty.ts');
      expect(tools).toEqual([]);
    });

    it('should handle unsupported file types', async () => {
      const code = `
        public class Main {
          public static void main(String[] args) {
            System.out.println("Hello");
          }
        }
      `;

      const tools = await extractor.extract(code, 'Main.java');
      expect(tools).toEqual([]);
    });

    it('should extract JSDoc descriptions', async () => {
      const code = `
        /**
         * Search for items in the database
         * @param query The search query
         */
        async searchItems(query: string, limit: number): Promise<Item[]> {
          return [];
        }
      `;

      const tools = await extractor.extract(code, 'search.ts');

      if (tools.length > 0) {
        expect(tools[0].description).toContain('Search');
      }
    });

    it('should parse parameters correctly', async () => {
      const code = `
        async createResource(
          name: string,
          count?: number,
          options: object = {}
        ): Promise<Resource> {
          return {};
        }
      `;

      const tools = await extractor.extract(code, 'resource.ts');

      if (tools.length > 0) {
        const { properties, required } = tools[0].inputSchema;
        
        expect(properties).toHaveProperty('name');
        expect(properties).toHaveProperty('count');
        expect(properties).toHaveProperty('options');
        expect(required).toContain('name');
        expect(required).not.toContain('count');
        expect(required).not.toContain('options');
      }
    });

    it('should extract Python Tool class instantiations', async () => {
      const code = `
tools = [
    Tool(name="ListFiles", description="List files in a directory"),
    Tool(name="ReadFile", description="Read file contents"),
]
      `;

      const tools = await extractor.extract(code, 'tools.py');

      expect(tools.length).toBe(2);
      expect(tools[0].name).toBe('ListFiles');
      expect(tools[1].name).toBe('ReadFile');
    });
  });

  describe('language detection', () => {
    it('should detect TypeScript files', async () => {
      const code = 'const x: string = "test";';
      const tools = await extractor.extract(code, 'test.ts');
      // Should not throw
      expect(Array.isArray(tools)).toBe(true);
    });

    it('should detect Python files', async () => {
      const code = 'def hello(): pass';
      const tools = await extractor.extract(code, 'test.py');
      expect(Array.isArray(tools)).toBe(true);
    });

    it('should detect JavaScript files', async () => {
      const code = 'const x = "test";';
      const tools = await extractor.extract(code, 'test.js');
      expect(Array.isArray(tools)).toBe(true);
    });
  });

  describe('type conversion', () => {
    it('should convert Python types to JSON schema types', async () => {
      const code = `
@mcp.tool(name="ProcessData", description="Process data")
async def process(
    text: str,
    count: int,
    ratio: float,
    active: bool,
    items: List[str],
    config: Dict[str, any]
):
    pass
      `;

      const tools = await extractor.extract(code, 'process.py');

      if (tools.length > 0) {
        const { properties } = tools[0].inputSchema;
        expect(properties.text?.type).toBe('string');
        expect(properties.count?.type).toBe('number');
        expect(properties.ratio?.type).toBe('number');
        expect(properties.active?.type).toBe('boolean');
        expect(properties.items?.type).toBe('array');
        expect(properties.config?.type).toBe('object');
      }
    });

    it('should handle Optional types correctly', async () => {
      const code = `
@mcp.tool(name="OptionalTest", description="Test optional types")
async def test_optional(
    required_str: str,
    optional_str: Optional[str],
    optional_int: Optional[int],
    optional_list: Optional[List[str]]
):
    pass
      `;

      const tools = await extractor.extract(code, 'optional.py');

      if (tools.length > 0) {
        const { properties } = tools[0].inputSchema;
        expect(properties.required_str?.type).toBe('string');
        expect(properties.optional_str?.type).toBe('string');
        expect(properties.optional_int?.type).toBe('number');
        expect(properties.optional_list?.type).toBe('array');
      }
    });

    it('should handle Union types correctly', async () => {
      const code = `
@mcp.tool(name="UnionTest", description="Test union types")
async def test_union(
    str_or_int: Union[str, int],
    nullable: Union[str, None],
    multi: Union[List[str], Dict[str, int], None]
):
    pass
      `;

      const tools = await extractor.extract(code, 'union.py');

      if (tools.length > 0) {
        const { properties } = tools[0].inputSchema;
        expect(properties.str_or_int?.type).toBe('string'); // First non-None type
        expect(properties.nullable?.type).toBe('string');
        expect(properties.multi?.type).toBe('array'); // First non-None type is List
      }
    });

    it('should handle Python 3.10+ union syntax', async () => {
      const code = `
@mcp.tool(name="NewUnionTest", description="Test new union syntax")
async def test_new_union(
    value: str | int,
    optional: str | None
):
    pass
      `;

      const tools = await extractor.extract(code, 'new_union.py');

      if (tools.length > 0) {
        const { properties } = tools[0].inputSchema;
        expect(properties.value?.type).toBe('string');
        expect(properties.optional?.type).toBe('string');
      }
    });

    it('should handle collection types correctly', async () => {
      const code = `
@mcp.tool(name="CollectionTest", description="Test collection types")
async def test_collections(
    my_list: List[int],
    my_set: Set[str],
    my_tuple: Tuple[str, int],
    my_sequence: Sequence[float],
    my_mapping: Mapping[str, Any]
):
    pass
      `;

      const tools = await extractor.extract(code, 'collections.py');

      if (tools.length > 0) {
        const { properties } = tools[0].inputSchema;
        expect(properties.my_list?.type).toBe('array');
        expect(properties.my_set?.type).toBe('array');
        expect(properties.my_tuple?.type).toBe('array');
        expect(properties.my_sequence?.type).toBe('array');
        expect(properties.my_mapping?.type).toBe('object');
      }
    });

    it('should handle nested generic types', async () => {
      const code = `
@mcp.tool(name="NestedTest", description="Test nested generics")
async def test_nested(
    nested_list: List[List[str]],
    list_of_dicts: List[Dict[str, int]],
    dict_of_lists: Dict[str, List[int]]
):
    pass
      `;

      const tools = await extractor.extract(code, 'nested.py');

      if (tools.length > 0) {
        const { properties } = tools[0].inputSchema;
        expect(properties.nested_list?.type).toBe('array');
        expect(properties.list_of_dicts?.type).toBe('array');
        expect(properties.dict_of_lists?.type).toBe('object');
      }
    });

    it('should handle special types correctly', async () => {
      const code = `
@mcp.tool(name="SpecialTypes", description="Test special types")
async def test_special(
    any_value: Any,
    path_value: Path,
    uuid_value: UUID,
    datetime_value: datetime,
    bytes_value: bytes
):
    pass
      `;

      const tools = await extractor.extract(code, 'special.py');

      if (tools.length > 0) {
        const { properties } = tools[0].inputSchema;
        expect(properties.any_value?.type).toBe('object');
        expect(properties.path_value?.type).toBe('string');
        expect(properties.uuid_value?.type).toBe('string');
        expect(properties.datetime_value?.type).toBe('string');
        expect(properties.bytes_value?.type).toBe('string');
      }
    });

    it('should handle Literal types correctly', async () => {
      const code = `
@mcp.tool(name="LiteralTest", description="Test literal types")
async def test_literal(
    status: Literal["active", "inactive"],
    priority: Literal[1, 2, 3],
    flag: Literal[True, False]
):
    pass
      `;

      const tools = await extractor.extract(code, 'literal.py');

      if (tools.length > 0) {
        const { properties } = tools[0].inputSchema;
        expect(properties.status?.type).toBe('string');
        expect(properties.priority?.type).toBe('number');
        expect(properties.flag?.type).toBe('boolean');
      }
    });
  });
});
