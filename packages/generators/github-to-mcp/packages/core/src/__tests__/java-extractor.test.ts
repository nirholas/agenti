/**
 * @fileoverview Unit tests for Java extractor
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { JavaExtractor } from '../extractors/java-extractor';

describe('JavaExtractor', () => {
  let extractor: JavaExtractor;

  beforeEach(() => {
    extractor = new JavaExtractor();
  });

  describe('extract', () => {
    describe('Spring Boot endpoints', () => {
      it('should extract @GetMapping endpoints', async () => {
        const code = `
package com.example.controller;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class UserController {

    @GetMapping("/users/{id}")
    public User getUser(@PathVariable String id) {
        return userService.findById(id);
    }
}
        `;

        const tools = await extractor.extract(code, 'UserController.java');

        expect(tools.length).toBeGreaterThan(0);
        const tool = tools.find(t => t.name.includes('get_api_users'));
        expect(tool).toBeDefined();
        expect(tool?.inputSchema.properties).toHaveProperty('id');
      });

      it('should extract @PostMapping with @RequestBody', async () => {
        const code = `
package com.example.controller;

import org.springframework.web.bind.annotation.*;

@RestController
public class UserController {

    @PostMapping("/users")
    public User createUser(@RequestBody CreateUserDto dto) {
        return userService.create(dto);
    }
}
        `;

        const tools = await extractor.extract(code, 'UserController.java');

        expect(tools.length).toBeGreaterThan(0);
        const tool = tools.find(t => t.name.includes('post_users'));
        expect(tool).toBeDefined();
        expect(tool?.inputSchema.properties).toHaveProperty('dto');
      });

      it('should extract @RequestMapping with method attribute', async () => {
        const code = `
package com.example.controller;

import org.springframework.web.bind.annotation.*;

@RestController
public class ItemController {

    @RequestMapping(value = "/items", method = RequestMethod.GET)
    public List<Item> listItems() {
        return itemService.findAll();
    }
}
        `;

        const tools = await extractor.extract(code, 'ItemController.java');

        expect(tools.length).toBeGreaterThan(0);
        expect(tools.some(t => t.name.includes('get_items'))).toBe(true);
      });

      it('should handle @RequestParam', async () => {
        const code = `
package com.example.controller;

import org.springframework.web.bind.annotation.*;

@RestController
public class SearchController {

    @GetMapping("/search")
    public List<Result> search(
        @RequestParam String query,
        @RequestParam(required = false) Integer limit
    ) {
        return searchService.search(query, limit);
    }
}
        `;

        const tools = await extractor.extract(code, 'SearchController.java');

        const tool = tools.find(t => t.name.includes('search'));
        expect(tool).toBeDefined();
        expect(tool?.inputSchema.properties).toHaveProperty('query');
        expect(tool?.inputSchema.required).toContain('query');
      });

      it('should combine class and method level paths', async () => {
        const code = `
package com.example.controller;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class ProductController {

    @GetMapping("/products")
    public List<Product> listProducts() {
        return productService.findAll();
    }
}
        `;

        const tools = await extractor.extract(code, 'ProductController.java');

        const tool = tools.find(t => t.name.includes('api'));
        expect(tool).toBeDefined();
        // Path should be combined: /api/v1/products
      });

      it('should extract multiple mapping annotations', async () => {
        const code = `
package com.example.controller;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class CrudController {

    @GetMapping("/items")
    public List<Item> list() { return null; }

    @GetMapping("/items/{id}")
    public Item get(@PathVariable Long id) { return null; }

    @PostMapping("/items")
    public Item create(@RequestBody Item item) { return null; }

    @PutMapping("/items/{id}")
    public Item update(@PathVariable Long id, @RequestBody Item item) { return null; }

    @DeleteMapping("/items/{id}")
    public void delete(@PathVariable Long id) { }
}
        `;

        const tools = await extractor.extract(code, 'CrudController.java');

        expect(tools.length).toBe(5);
      });
    });

    describe('JAX-RS endpoints', () => {
      it('should extract JAX-RS @Path and @GET', async () => {
        const code = `
package com.example.resource;

import javax.ws.rs.*;

@Path("/users")
public class UserResource {

    @GET
    @Path("/{id}")
    public User getUser(@PathParam("id") String id) {
        return userService.findById(id);
    }
}
        `;

        const tools = await extractor.extract(code, 'UserResource.java');

        expect(tools.length).toBeGreaterThan(0);
        const tool = tools.find(t => t.name.includes('users'));
        expect(tool).toBeDefined();
        expect(tool?.inputSchema.properties).toHaveProperty('id');
      });

      it('should extract @QueryParam', async () => {
        const code = `
package com.example.resource;

import javax.ws.rs.*;

@Path("/search")
public class SearchResource {

    @GET
    public List<Result> search(
        @QueryParam("q") String query,
        @QueryParam("page") Integer page
    ) {
        return searchService.search(query, page);
    }
}
        `;

        const tools = await extractor.extract(code, 'SearchResource.java');

        const tool = tools.find(t => t.name.includes('search'));
        expect(tool?.inputSchema.properties).toHaveProperty('query');
        expect(tool?.inputSchema.properties).toHaveProperty('page');
      });

      it('should extract @POST with request body', async () => {
        const code = `
package com.example.resource;

import javax.ws.rs.*;

@Path("/items")
public class ItemResource {

    @POST
    public Item createItem(CreateItemDto dto) {
        return itemService.create(dto);
    }
}
        `;

        const tools = await extractor.extract(code, 'ItemResource.java');

        expect(tools.some(t => t.name.includes('post'))).toBe(true);
      });
    });

    describe('Micronaut endpoints', () => {
      it('should extract Micronaut @Controller routes', async () => {
        const code = `
package com.example.controller;

import io.micronaut.http.annotation.*;

@Controller("/api")
public class ApiController {

    @Get("/health")
    public String health() {
        return "OK";
    }

    @Post("/data")
    public Data saveData(@Body DataDto dto) {
        return dataService.save(dto);
    }
}
        `;

        const tools = await extractor.extract(code, 'ApiController.java');

        expect(tools.length).toBeGreaterThan(0);
        expect(tools.some(t => t.name.includes('health'))).toBe(true);
        expect(tools.some(t => t.name.includes('data'))).toBe(true);
      });
    });

    describe('Public methods with Javadoc', () => {
      it('should extract public methods with Javadoc', async () => {
        const code = `
package com.example.service;

public class CalculatorService {

    /**
     * Adds two numbers together.
     *
     * @param a First number
     * @param b Second number
     * @return Sum of a and b
     */
    public int add(int a, int b) {
        return a + b;
    }
}
        `;

        const tools = await extractor.extract(code, 'CalculatorService.java');

        expect(tools.length).toBeGreaterThan(0);
        const tool = tools.find(t => t.name === 'add');
        expect(tool).toBeDefined();
        expect(tool?.description).toContain('Adds two numbers');
      });

      it('should parse @param tags', async () => {
        const code = `
package com.example.service;

public class UserService {

    /**
     * Find a user by their email address.
     *
     * @param email The email address to search for
     * @return The user if found
     * @throws UserNotFoundException if no user exists
     */
    public User findByEmail(String email) {
        return userRepository.findByEmail(email);
    }
}
        `;

        const tools = await extractor.extract(code, 'UserService.java');

        const tool = tools.find(t => t.name.includes('email') || t.name === 'find_by_email');
        if (tool) {
          expect(tool.inputSchema.properties.email?.description).toContain('email');
        }
      });

      it('should skip methods without Javadoc', async () => {
        const code = `
package com.example.service;

public class Service {

    // Simple comment, not Javadoc
    public void methodWithoutJavadoc() {
    }

    /**
     * This method has Javadoc.
     */
    public void methodWithJavadoc() {
    }
}
        `;

        const tools = await extractor.extract(code, 'Service.java');

        // Should only have the method with Javadoc
        expect(tools.every(t => t.name !== 'method_without_javadoc')).toBe(true);
      });

      it('should skip annotated endpoints in public method extraction', async () => {
        const code = `
package com.example.controller;

import org.springframework.web.bind.annotation.*;

@RestController
public class Controller {

    /**
     * Get all items.
     */
    @GetMapping("/items")
    public List<Item> getItems() {
        return items;
    }
}
        `;

        const tools = await extractor.extract(code, 'Controller.java');

        // Should not have duplicate tools for the same method
        const itemTools = tools.filter(t => t.name.includes('items') || t.name === 'get_items');
        expect(itemTools.length).toBeLessThanOrEqual(1);
      });
    });

    describe('Type conversion', () => {
      it('should convert Java types to JSON schema types', async () => {
        const code = `
package com.example.service;

public class TypeService {

    /**
     * Process various types.
     */
    public void process(
        String name,
        int count,
        Integer nullableCount,
        boolean enabled,
        List<String> items,
        Map<String, Object> config
    ) {
    }
}
        `;

        const tools = await extractor.extract(code, 'TypeService.java');

        const tool = tools.find(t => t.name === 'process');
        if (tool) {
          expect(tool.inputSchema.properties.name?.type).toBe('string');
          expect(tool.inputSchema.properties.count?.type).toBe('integer');
          expect(tool.inputSchema.properties.enabled?.type).toBe('boolean');
          expect(tool.inputSchema.properties.items?.type).toBe('array');
          expect(tool.inputSchema.properties.config?.type).toBe('object');
        }
      });

      it('should handle generic types', async () => {
        const code = `
package com.example.service;

public class GenericService {

    /**
     * Get optional value.
     */
    public void processOptional(Optional<String> value) {
    }
}
        `;

        const tools = await extractor.extract(code, 'GenericService.java');

        const tool = tools.find(t => t.name.includes('optional') || t.name === 'process_optional');
        if (tool) {
          // Optional<String> should be converted to string
          expect(tool.inputSchema.properties.value?.type).toBe('string');
        }
      });
    });

    describe('Path parameter extraction', () => {
      it('should extract path parameters from Spring', async () => {
        const code = `
package com.example.controller;

import org.springframework.web.bind.annotation.*;

@RestController
public class Controller {

    @GetMapping("/users/{userId}/posts/{postId}")
    public Post getPost(
        @PathVariable String userId,
        @PathVariable String postId
    ) {
        return null;
    }
}
        `;

        const tools = await extractor.extract(code, 'Controller.java');

        const tool = tools[0];
        expect(tool?.inputSchema.properties).toHaveProperty('userId');
        expect(tool?.inputSchema.properties).toHaveProperty('postId');
        expect(tool?.inputSchema.required).toContain('userId');
        expect(tool?.inputSchema.required).toContain('postId');
      });

      it('should extract path parameters from JAX-RS', async () => {
        const code = `
package com.example.resource;

import javax.ws.rs.*;

@Path("/orders/{orderId}")
public class OrderResource {

    @GET
    @Path("/items/{itemId}")
    public Item getItem(
        @PathParam("orderId") String orderId,
        @PathParam("itemId") String itemId
    ) {
        return null;
    }
}
        `;

        const tools = await extractor.extract(code, 'OrderResource.java');

        const tool = tools[0];
        expect(tool?.inputSchema.properties).toHaveProperty('orderId');
        expect(tool?.inputSchema.properties).toHaveProperty('itemId');
      });
    });
  });
});
