import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createServer } from './server.js';
import { initializeDatabase } from './db/index.js';
import { initializeAuth } from './auth/index.js';
import type { Express } from 'express';
import fs from 'fs';

describe('Auth Routes', () => {
  let app: Express;
  const testDbPath = './data/test-openfacilitator.db';

  beforeAll(async () => {
    // Use test database
    process.env.DATABASE_PATH = testDbPath;
    process.env.BETTER_AUTH_SECRET = 'test-secret-for-testing-only';
    process.env.BETTER_AUTH_URL = 'http://localhost:5002';

    await initializeDatabase(testDbPath);
    initializeAuth(testDbPath);
    app = createServer();
  });

  afterAll(() => {
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('POST /api/auth/sign-up/email should not return 404', async () => {
    const response = await request(app)
      .post('/api/auth/sign-up/email')
      .send({
        email: 'test@example.com',
        password: 'testpassword123',
        name: 'Test User',
      })
      .set('Content-Type', 'application/json');

    // Should not be 404 - the route should be found
    // It might return 200 (success) or 400 (validation error) or other, but NOT 404
    expect(response.status).not.toBe(404);
  });

  it('POST /api/auth/sign-in/email should not return 404', async () => {
    const response = await request(app)
      .post('/api/auth/sign-in/email')
      .send({
        email: 'test@example.com',
        password: 'testpassword123',
      })
      .set('Content-Type', 'application/json');

    expect(response.status).not.toBe(404);
  });

  it('GET /api/auth/get-session should not return 404', async () => {
    const response = await request(app)
      .get('/api/auth/get-session');

    expect(response.status).not.toBe(404);
  });

  it('POST /api/auth/sign-out should not return 404', async () => {
    const response = await request(app)
      .post('/api/auth/sign-out');

    expect(response.status).not.toBe(404);
  });
});

describe('Health Check', () => {
  let app: Express;

  beforeAll(() => {
    app = createServer();
  });

  it('GET /health should return 200', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
  });
});
