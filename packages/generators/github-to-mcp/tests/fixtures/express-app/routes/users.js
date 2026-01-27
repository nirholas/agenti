/**
 * Sample Express.js application for testing
 */
const express = require('express');
const router = express.Router();

/**
 * Get all users
 * @tag Users
 * @returns {array} List of users
 */
router.get('/users', (req, res) => {
  const { limit, offset } = req.query;
  res.json({ users: [], limit, offset });
});

/**
 * Get user by ID
 * @tag Users
 * @param {string} req.params.id - User ID
 * @returns {object} User object
 */
router.get('/users/:id', (req, res) => {
  const { id } = req.params;
  res.json({ id, name: 'Test User' });
});

/**
 * Create a new user
 * @tag Users
 * @body {object} User data
 * @returns {object} Created user
 */
router.post('/users', (req, res) => {
  const userData = req.body;
  res.status(201).json({ id: '123', ...userData });
});

/**
 * Update user
 * @tag Users
 * @deprecated
 */
router.put('/users/:id', (req, res) => {
  const { id } = req.params;
  const userData = req.body;
  res.json({ id, ...userData });
});

/**
 * Delete user
 * @tag Users
 */
router.delete('/users/:id', (req, res) => {
  res.status(204).send();
});

module.exports = router;
