import express from 'express';

const router = express.Router();

// GET /health
router.get('/', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
