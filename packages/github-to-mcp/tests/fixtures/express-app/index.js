/**
 * Sample Express.js application for testing
 */
const express = require('express');
const app = express();
const usersRouter = require('./routes/users');
const postsRouter = require('./routes/posts');

app.use(express.json());

// API routes
app.use('/api', usersRouter);
app.use('/api', postsRouter);

/**
 * Health check endpoint
 * @tag System
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

/**
 * API info endpoint
 * @tag System
 */
app.get('/api/info', (req, res) => {
  res.json({
    name: 'Test API',
    version: '1.0.0',
  });
});

module.exports = app;
