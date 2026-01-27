/**
 * Posts routes for testing
 */
const express = require('express');
const router = express.Router();

/**
 * Get all posts with pagination
 * @tag Posts
 * @param {number} req.query.page - Page number
 * @param {number} req.query.limit - Items per page
 */
router.get('/posts', (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  res.json({ posts: [], page, limit, total: 0 });
});

/**
 * Get post by ID
 * @tag Posts
 */
router.get('/posts/:postId', (req, res) => {
  res.json({ id: req.params.postId, title: 'Test Post' });
});

/**
 * Create post
 * @tag Posts
 */
router.post('/posts', (req, res) => {
  res.status(201).json({ id: '456', ...req.body });
});

/**
 * Get comments for a post
 * @tag Posts
 * @tag Comments
 */
router.get('/posts/:postId/comments', (req, res) => {
  res.json({ comments: [] });
});

module.exports = router;
