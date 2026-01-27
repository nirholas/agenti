/**
 * @fileoverview Unit tests for Rust extractor
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RustExtractor } from '../extractors/rust-extractor';

describe('RustExtractor', () => {
  let extractor: RustExtractor;

  beforeEach(() => {
    extractor = new RustExtractor();
  });

  describe('extract', () => {
    describe('Actix-web routes', () => {
      it('should extract GET routes', async () => {
        const code = `
use actix_web::{get, web, HttpResponse};

#[get("/users/{id}")]
async fn get_user(path: web::Path<String>) -> HttpResponse {
    HttpResponse::Ok().finish()
}
        `;

        const tools = await extractor.extract(code, 'handlers.rs');

        expect(tools.length).toBeGreaterThan(0);
        const tool = tools.find(t => t.name.includes('get_users'));
        expect(tool).toBeDefined();
        expect(tool?.inputSchema.properties).toHaveProperty('id');
      });

      it('should extract POST routes', async () => {
        const code = `
use actix_web::{post, web, HttpResponse};

#[post("/users")]
async fn create_user(body: web::Json<CreateUser>) -> HttpResponse {
    HttpResponse::Created().finish()
}
        `;

        const tools = await extractor.extract(code, 'handlers.rs');

        expect(tools.length).toBeGreaterThan(0);
        const tool = tools.find(t => t.name.includes('post_users'));
        expect(tool).toBeDefined();
      });

      it('should extract web::resource routes', async () => {
        const code = `
use actix_web::{web, App};

fn config(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::resource("/items")
            .route(web::get().to(list_items))
            .route(web::post().to(create_item))
    );
}
        `;

        const tools = await extractor.extract(code, 'config.rs');

        expect(tools.length).toBeGreaterThan(0);
      });
    });

    describe('Axum routes', () => {
      it('should extract router routes', async () => {
        const code = `
use axum::{Router, routing::get};

fn create_router() -> Router {
    Router::new()
        .route("/api/users", get(list_users))
        .route("/api/users/:id", get(get_user))
}
        `;

        const tools = await extractor.extract(code, 'router.rs');

        expect(tools.length).toBeGreaterThan(0);
        expect(tools.some(t => t.name.includes('api_users'))).toBe(true);
      });

      it('should extract debug_handler functions', async () => {
        const code = `
use axum::debug_handler;

#[debug_handler]
async fn my_handler() -> impl IntoResponse {
    "Hello"
}
        `;

        const tools = await extractor.extract(code, 'handlers.rs');

        expect(tools.some(t => t.name === 'my_handler')).toBe(true);
      });
    });

    describe('Rocket routes', () => {
      it('should extract Rocket routes with data', async () => {
        const code = `
use rocket::serde::json::Json;

#[post("/users", data = "<user>")]
async fn create_user(user: Json<CreateUser>) -> Json<User> {
    // Create user
}
        `;

        const tools = await extractor.extract(code, 'routes.rs');

        expect(tools.length).toBeGreaterThan(0);
        const tool = tools.find(t => t.name.includes('post_users'));
        expect(tool).toBeDefined();
      });
    });

    describe('Public functions', () => {
      it('should extract public functions with doc comments', async () => {
        const code = `
/// Calculate the sum of two numbers
///
/// # Arguments
/// * \`a\` - First number
/// * \`b\` - Second number
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}
        `;

        const tools = await extractor.extract(code, 'math.rs');

        expect(tools.length).toBeGreaterThan(0);
        const tool = tools.find(t => t.name === 'add');
        expect(tool).toBeDefined();
        expect(tool?.description).toContain('sum');
      });

      it('should extract async public functions', async () => {
        const code = `
/// Fetch data from the API
pub async fn fetch_data(url: String) -> Result<Data, Error> {
    // Fetch data
}
        `;

        const tools = await extractor.extract(code, 'client.rs');

        expect(tools.some(t => t.name === 'fetch_data')).toBe(true);
      });

      it('should skip functions without documentation', async () => {
        const code = `
pub fn undocumented_function(x: i32) -> i32 {
    x
}

/// Documented function
pub fn documented_function(x: i32) -> i32 {
    x
}
        `;

        const tools = await extractor.extract(code, 'lib.rs');

        // Only documented function should be included in public function extraction
        // (but it might also be skipped if not considered useful)
        expect(tools.every(t => t.name !== 'undocumented_function' || t.documentation !== null)).toBe(true);
      });
    });

    describe('Type conversion', () => {
      it('should convert Rust types to JSON schema types', async () => {
        const code = `
/// Process data
pub fn process(
    name: String,
    count: i32,
    enabled: bool,
    items: Vec<String>,
    config: HashMap<String, Value>
) -> Result<(), Error> {
    // Process
}
        `;

        const tools = await extractor.extract(code, 'processor.rs');

        const tool = tools.find(t => t.name === 'process');
        expect(tool?.inputSchema.properties.name?.type).toBe('string');
        expect(tool?.inputSchema.properties.count?.type).toBe('integer');
        expect(tool?.inputSchema.properties.enabled?.type).toBe('boolean');
        expect(tool?.inputSchema.properties.items?.type).toBe('array');
        expect(tool?.inputSchema.properties.config?.type).toBe('object');
      });

      it('should handle Option types', async () => {
        const code = `
/// Get user with optional email
pub fn get_user(id: String, email: Option<String>) -> User {
    // Get user
}
        `;

        const tools = await extractor.extract(code, 'users.rs');

        const tool = tools.find(t => t.name === 'get_user');
        // Required should only include 'id', not 'email'
        expect(tool?.inputSchema.required).toContain('id');
      });
    });

    describe('Path parameter extraction', () => {
      it('should extract path parameters from Actix routes', async () => {
        const code = `
#[get("/users/{user_id}/posts/{post_id}")]
async fn get_post(path: web::Path<(String, String)>) -> HttpResponse {
    HttpResponse::Ok().finish()
}
        `;

        const tools = await extractor.extract(code, 'handlers.rs');

        const tool = tools[0];
        expect(tool?.inputSchema.properties).toHaveProperty('user_id');
        expect(tool?.inputSchema.properties).toHaveProperty('post_id');
        expect(tool?.inputSchema.required).toContain('user_id');
        expect(tool?.inputSchema.required).toContain('post_id');
      });

      it('should extract path parameters from Rocket routes', async () => {
        const code = `
#[get("/items/<item_id>")]
fn get_item(item_id: i32) -> String {
    format!("Item {}", item_id)
}
        `;

        const tools = await extractor.extract(code, 'routes.rs');

        const tool = tools[0];
        expect(tool?.inputSchema.properties).toHaveProperty('item_id');
      });
    });
  });
});
